/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — the VOICE panel API

   Everything the browser cannot do locally lives here:

     GET  /noedis/api/voice/status       Hermes reachable? WhatsApp linked?
     GET  /noedis/api/voice/agents       the live Paperclip roster + NOEDIS shape
     GET  /noedis/api/voice/delegations  the newest hand-offs
     POST /noedis/api/voice/transcribe   raw audio body -> text (Whisper)
     POST /noedis/api/voice/ask          text -> reply + a real board task
     POST /noedis/api/voice/speak        text -> MP3 (Edge TTS)
     POST /noedis/api/voice/delegate     the hand-off Hermes' own skill calls

   The hand-off used to depend on Hermes *deciding* to call its skill, which
   meant a spoken order sometimes turned into nothing at all. The cockpit now
   owns the routing: `/ask` resolves a target (the picker, a name spoken at the
   start of the sentence, else NOE), asks Hermes for one strict JSON answer,
   and creates the issue itself. Exactly one place creates work, and exactly
   one log records it.

   Audio is posted as a raw body rather than multipart on purpose: it keeps the
   dependency list at express + ws.
   ══════════════════════════════════════════════════════════════ */

import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { log } from './config.js';

const AUDIO_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'application/octet-stream',
];

export function createVoiceApi({
  hermes,
  paperclip,
  agentDirectory,
  companyId,
  noeAgentId,
  delegationLog,
  onDelegate,
  whatsapp,
}) {
  const router = express.Router();

  const audioBody = express.raw({ type: AUDIO_TYPES, limit: '25mb' });

  router.get('/status', async (_req, res) => {
    const status = await hermes.status();
    res.json({
      hermes: status,
      voice: { language: hermes.voice.language, ttsVoice: hermes.voice.ttsVoice },
      whatsapp: whatsapp ? { ...whatsapp.status(), linked: whatsapp.linked } : status.whatsapp,
      companyId,
      noeAgentId,
    });
  });

  /* ── the roster the panel's target picker and the orb's constellation use ── */

  router.get('/agents', async (_req, res) => {
    try {
      const roster = await agentDirectory.list();
      res.json({
        agents: roster.agents,
        leadership: roster.leadership,
        noeAgentId: roster.noeAgentId || noeAgentId,
        companyId,
        stale: Boolean(roster.stale),
        generatedAt: roster.generatedAt,
      });
    } catch (err) {
      log('voice: roster failed:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  /* ── what has actually been handed over ── */

  router.get('/delegations', (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    res.json({ items: readDelegations(delegationLog, limit) });
  });

  /* ── WhatsApp pairing, driven from the VOICE panel ── */

  router.get('/whatsapp', (_req, res) => {
    if (!whatsapp) return res.status(501).json({ error: 'WhatsApp bridge není nakonfigurovaný' });
    res.json(whatsapp.status());
  });

  router.post('/whatsapp/start', express.json({ limit: '8kb' }), async (_req, res) => {
    if (!whatsapp) return res.status(501).json({ error: 'WhatsApp bridge není nakonfigurovaný' });
    try {
      res.json(await whatsapp.start());
    } catch (err) {
      log('whatsapp: start failed:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/whatsapp/stop', express.json({ limit: '8kb' }), (_req, res) => {
    if (!whatsapp) return res.status(501).json({ error: 'WhatsApp bridge není nakonfigurovaný' });
    res.json(whatsapp.stop('zastaveno z kokpitu'));
  });

  router.get('/whatsapp/qr.png', async (_req, res) => {
    if (!whatsapp) return res.status(501).json({ error: 'WhatsApp bridge není nakonfigurovaný' });
    const png = await whatsapp.qrPng();
    if (!png) return res.status(404).json({ error: 'QR není k dispozici' });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(png);
  });

  /* ── speech ── */

  router.post('/transcribe', audioBody, async (req, res) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length < 512) {
      return res.status(400).json({ error: 'žádné audio v těle požadavku' });
    }
    const ext = (req.headers['content-type'] || '').includes('ogg') ? 'ogg' : 'webm';
    const file = path.join(os.tmpdir(), `noedis-voice-${crypto.randomUUID()}.${ext}`);
    try {
      fs.writeFileSync(file, body);
      const out = await hermes.transcribe(file);
      log(`voice: transcribed ${body.length} B in ${out.seconds ?? '?'}s -> ${String(out.text).length} chars`);
      res.json(out);
    } catch (err) {
      log('voice: transcribe failed:', err.message);
      res.status(502).json({ error: err.message });
    } finally {
      fs.rm(file, { force: true }, () => {});
    }
  });

  router.post('/speak', express.json({ limit: '64kb' }), async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text je povinný' });
    const out = path.join(os.tmpdir(), `noedis-tts-${crypto.randomUUID()}.mp3`);
    try {
      await hermes.speak(text, out);
      const buf = fs.readFileSync(out);
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'no-store');
      res.send(buf);
    } catch (err) {
      log('voice: speak failed:', err.message);
      res.status(502).json({ error: err.message });
    } finally {
      fs.rm(out, { force: true }, () => {});
    }
  });

  /* ── the loop: one spoken turn in, one answer and at most one task out ── */

  router.post('/ask', express.json({ limit: '256kb' }), async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text je povinný' });
    const targetAgentId = req.body?.targetAgentId ? String(req.body.targetAgentId) : null;

    // The delegation skill appends a JSON line per hand-off; remember where the
    // log ended so we can tell what THIS turn produced.
    const before = readDelegationCount(delegationLog);

    let roster;
    let resolved;
    try {
      roster = await agentDirectory.list();
      resolved = await agentDirectory.resolve({ targetAgentId, text });
    } catch (err) {
      log('voice: could not read the roster:', err.message);
      return res.status(502).json({ error: `Nepodařilo se načíst agenty: ${err.message}` });
    }

    let routed;
    try {
      routed = await hermes.route(text, { agents: roster.agents, target: resolved.agent });
    } catch (err) {
      log('voice: ask failed:', err.message);
      return res.status(502).json({ error: err.message });
    }

    // If Hermes' own skill fired during the turn, that hand-off is the truth —
    // never create a second issue for the same sentence.
    const bySkill = pickDelegation(delegationLog, before);

    let task = null;
    let assignee = resolved.agent;
    let via = resolved.via;

    if (bySkill) {
      task = { ...bySkill, assigneeId: noeAgentId, assigneeName: 'NOE', via: 'skill' };
    } else if (routed.task) {
      const picked = routed.task.target ? await agentDirectory.byHandle(routed.task.target) : null;
      assignee = picked || resolved.agent;
      via = picked ? 'model' : resolved.via;
      task = await handOff({
        paperclip,
        delegationLog,
        task: routed.task,
        assignee,
        noeAgentId,
        founderWords: text,
      });
    }

    const reply =
      String(routed.say || '').trim() ||
      (task ? `Předal jsem to: ${task.title}.` : '(prázdná odpověď)');

    if (task && !task.error) {
      log(`voice: "${task.title}" -> ${task.assigneeName || assignee?.name || '?'} (${task.id || 'no id'})`);
    }

    res.json({
      reply,
      task,
      target: assignee
        ? {
            id: assignee.id,
            name: assignee.name,
            key: assignee.key || null,
            color: assignee.color || null,
            department: assignee.department || null,
          }
        : null,
      via,
      /** What the orb should light: the agent that took the work. */
      agents: assignee ? [assignee.id] : [],
      parsed: routed.parsed !== false,
      model: routed.model || null,
    });
  });

  /* ── the hand-off the agent triggers through its skill ── */

  router.post('/delegate', express.json({ limit: '256kb' }), async (req, res) => {
    if (onDelegate && !onDelegate(req)) return res.status(403).json({ error: 'forbidden' });
    const { title, description, priority, assigneeAgentId, target } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'title je povinný' });
    try {
      let assignee = null;
      if (assigneeAgentId) assignee = await agentDirectory.byHandle(String(assigneeAgentId));
      if (!assignee && target) assignee = await agentDirectory.byHandle(String(target));
      if (!assignee) assignee = await agentDirectory.byHandle(noeAgentId);

      const issue = await paperclip.createWork({
        title: String(title).trim().slice(0, 200),
        description: briefFor(description, assignee, noeAgentId),
        assigneeAgentId: assignee?.id || noeAgentId,
        priority: priority || 'medium',
      });
      let wakeError = null;
      try {
        await paperclip.wake(assignee?.id || noeAgentId);
      } catch (err) {
        wakeError = err.message;
      }
      const record = {
        at: new Date().toISOString(),
        title: String(title).trim().slice(0, 200),
        id: issue?.id || null,
        assigneeId: assignee?.id || noeAgentId,
        assigneeName: assignee?.name || 'NOE',
        wakeError,
        source: req.body?.source || 'hermes',
      };
      appendDelegation(delegationLog, record);
      log(`voice: delegated "${record.title}" to ${record.assigneeName} -> ${record.id || 'no id'}`);
      res.status(201).json(record);
    } catch (err) {
      log('voice: delegate failed:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}

/* ── the hand-off itself ──────────────────────────────────── */

/**
 * Create the issue for a spoken task and wake whoever owns it.
 *
 * Failure here is reported to the caller rather than thrown: the founder still
 * gets the spoken answer, and the panel shows the hand-off as failed instead
 * of the whole turn disappearing.
 */
async function handOff({ paperclip, delegationLog, task, assignee, noeAgentId, founderWords }) {
  const record = {
    at: new Date().toISOString(),
    title: task.title,
    id: null,
    assigneeId: assignee?.id || noeAgentId,
    assigneeName: assignee?.name || 'NOE',
    via: 'voice',
    wakeError: null,
    error: null,
  };
  try {
    const issue = await paperclip.createWork({
      title: task.title,
      description: briefFor(task.brief, assignee, noeAgentId, founderWords),
      assigneeAgentId: assignee?.id || noeAgentId,
      priority: task.priority || 'medium',
    });
    record.id = issue?.id || null;
  } catch (err) {
    record.error = err.message;
    appendDelegation(delegationLog, record);
    return record;
  }
  try {
    await paperclip.wake(assignee?.id || noeAgentId);
  } catch (err) {
    record.wakeError = err.message;
  }
  appendDelegation(delegationLog, record);
  return record;
}

/**
 * NOE's canonical role is to assess and route, not to execute — but in practice
 * it did the work itself and closed the task, so nothing ever reached CODY.
 * Asked directly in the brief, it creates the CODY sub-issue reliably.
 *
 * When the founder addressed a specific agent by voice, the brief instead
 * carries that agent's ownership note: the task is theirs, NOE is only
 * informed.
 */
const ROUTING_DUTY =
  '\n\n———\n' +
  'Pokyn pro NOE (Senior Advisor): posuď tento úkol a předej ho CODYmu (Right Hand) ' +
  'jako podúkol přiřazený jemu, s krátkým briefem, který CODY zvládne bez dohadování. ' +
  'Práci sám neprováděj a neuzavírej ji jako hotovou — uzavři ji, až ji CODY převezme, ' +
  'a do komentáře napiš, co jsi mu předal.';

function ownershipNote(assignee) {
  if (!assignee) return ROUTING_DUTY;
  const where = assignee.department ? ` (útvar ${assignee.department})` : '';
  return (
    '\n\n———\n' +
    `Zadáno hlasem přímo agentovi ${assignee.name}${where}. ` +
    'Úkol je tvůj; proveď ho a uzavři s odkazem na výsledek. ' +
    'Pokud potřebuješ něco mimo svůj útvar, eskaluj to nadřízenému, nedělej cizí práci.'
  );
}

function briefFor(description, assignee, noeAgentId, founderWords) {
  const body = description ? String(description).trim() : '';
  const withWords = founderWords
    ? `${body}\n\n———\nDoslova řečeno (hlasem): „${String(founderWords).slice(0, 400)}“`
    : body;
  const isNoe = !assignee || assignee.id === noeAgentId;
  const note = isNoe ? ROUTING_DUTY : ownershipNote(assignee);
  if (withWords.includes('Pokyn pro NOE') || withWords.includes('Zadáno hlasem přímo agentovi')) {
    return withWords;
  }
  return withWords ? `${withWords}${note}` : note.trim();
}

/* ── delegation log helpers ───────────────────────────────── */

function readDelegationCount(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function pickDelegation(file, before) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    if (lines.length <= before) return null;
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

function readDelegations(file, limit) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  } catch {
    return [];
  }
}

function appendDelegation(file, record) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
  } catch (err) {
    log('voice: could not write the delegation log:', err.message);
  }
}
