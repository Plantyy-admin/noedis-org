/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — the VOICE panel API

   Everything the browser cannot do locally lives here:

     GET  /noedis/api/voice/status      Hermes reachable? WhatsApp linked?
     POST /noedis/api/voice/transcribe  raw audio body -> text (Whisper)
     POST /noedis/api/voice/ask         text -> one Hermes agent turn
     POST /noedis/api/voice/speak       text -> MP3 (Edge TTS)

   Audio is posted as a raw body rather than multipart on purpose: it
   keeps the dependency list at express + ws.
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

export function createVoiceApi({ hermes, paperclip, companyId, noeAgentId, delegationLog, onDelegate, whatsapp }) {
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

  router.post('/ask', express.json({ limit: '256kb' }), async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text je povinný' });

    // The delegation skill appends a JSON line per hand-off; remember where
    // the log ended so we can tell what THIS turn produced.
    const before = readDelegationCount(delegationLog);

    try {
      const answer = await hermes.chat(text);
      const task = pickDelegation(delegationLog, before);
      if (task) log(`voice: handed "${task.title}" to NOE (${task.id || 'no id'})`);
      res.json({ ...answer, task });
    } catch (err) {
      log('voice: ask failed:', err.message);
      res.status(502).json({ error: err.message });
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

  /* ── the hand-off the agent triggers through its skill ── */

  router.post('/delegate', express.json({ limit: '256kb' }), async (req, res) => {
    if (onDelegate && !onDelegate(req)) return res.status(403).json({ error: 'forbidden' });
    const { title, description, priority } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'title je povinný' });
    try {
      const issue = await paperclip.createWork({
        title: String(title).trim().slice(0, 200),
        description: withRoutingDuty(description),
        assigneeAgentId: noeAgentId,
        priority: priority || 'medium',
      });
      let wakeError = null;
      try {
        await paperclip.wake(noeAgentId);
      } catch (err) {
        wakeError = err.message;
      }
      const record = {
        at: new Date().toISOString(),
        title: String(title).trim().slice(0, 200),
        id: issue?.id || null,
        wakeError,
        source: req.body?.source || 'hermes',
      };
      appendDelegation(delegationLog, record);
      log(`voice: delegated "${record.title}" to NOE -> ${record.id || 'no id'}`);
      res.status(201).json(record);
    } catch (err) {
      log('voice: delegate failed:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}

/* ── delegation log helpers ───────────────────────────────── */

/**
 * NOE's canonical role is to assess and route, not to execute — but in
 * practice it did the work itself and closed the task, so nothing ever reached
 * CODY. Asked directly in the brief, it creates the CODY sub-issue reliably.
 * The brief this bridge writes therefore carries that duty explicitly, which
 * keeps the routing decision with NOE instead of hard-coding the chain here.
 */
const ROUTING_DUTY =
  '\n\n———\n' +
  'Pokyn pro NOE (Senior Advisor): posuď tento úkol a předej ho CODYmu (Right Hand) ' +
  'jako podúkol přiřazený jemu, s krátkým briefem, který CODY zvládne bez dohadování. ' +
  'Práci sám neprováděj a neuzavírej ji jako hotovou — uzavři ji, až ji CODY převezme, ' +
  'a do komentáře napiš, co jsi mu předal.';

function withRoutingDuty(description) {
  const body = description ? String(description).trim() : '';
  if (body.includes('Pokyn pro NOE')) return body;
  return body ? `${body}${ROUTING_DUTY}` : ROUTING_DUTY.trim();
}

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

function appendDelegation(file, record) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
  } catch (err) {
    log('voice: could not write the delegation log:', err.message);
  }
}
