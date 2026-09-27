/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — Hermes Agent client

   Hermes Agent (Nous Research) runs on the same host and exposes an
   OpenAI-compatible API server. Everything the cockpit needs goes
   through it:

     POST /v1/chat/completions   full agent turn (tools, skills, memory)
     GET  /health                liveness
     GET  /v1/models             readiness + model name

   Speech stays inside the same installation: transcription runs through
   Hermes' own Whisper (`lib/stt.py`) and speech synthesis through the
   Edge TTS voice Hermes already uses, so there is one speech stack and
   one key, not two.
   ══════════════════════════════════════════════════════════════ */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { log } from './config.js';

const run = promisify(execFile);

const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');

/**
 * Hermes keeps its Python dependencies in a PM-managed virtualenv that is
 * re-leased whenever the extras change, so the path carries a hash and cannot
 * be pinned. The newest environment that can import faster_whisper wins.
 */
function pythonCandidates() {
  const out = [process.env.HERMES_PYTHON];
  const installs = path.join(HERMES_HOME, 'installs');
  try {
    for (const install of fs.readdirSync(installs)) {
      const envsDir = path.join(installs, install, 'environments');
      if (!fs.existsSync(envsDir)) continue;
      const envs = fs
        .readdirSync(envsDir)
        .map((name) => path.join(envsDir, name, 'venv', 'bin', 'python'))
        .filter((p) => fs.existsSync(p))
        .map((p) => ({ p, mtime: fs.statSync(p).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      out.push(...envs.map((e) => e.p));
    }
  } catch {
    /* no installs yet — the fixed fallbacks below still get a chance */
  }
  out.push(
    path.join(HERMES_HOME, 'hermes-agent', '.venv', 'bin', 'python'),
    path.join(HERMES_HOME, 'venv', 'bin', 'python'),
    '/usr/bin/python3',
  );
  return out.filter(Boolean);
}

export class HermesClient {
  constructor({ baseUrl, apiKey, model, cli, timeoutMs = 180000, chatTimeoutMs = 300000, voice }) {
    this.baseUrl = String(baseUrl || 'http://127.0.0.1:8642').replace(/\/+$/, '');
    this.apiKey = apiKey || '';
    this.model = model || 'hermes-agent';
    this.cli = cli || path.join(os.homedir(), '.local', 'bin', 'hermes');
    this.timeoutMs = timeoutMs;
    this.chatTimeoutMs = chatTimeoutMs;
    this.voice = {
      language: voice?.language || 'cs',
      ttsVoice: voice?.ttsVoice || 'cs-CZ-VlastaNeural',
    };
    this.python = null;
    this.lastError = null;
    this.sessionDir = path.join(HERMES_HOME, 'platforms', 'whatsapp', 'session');
  }

  get configured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  /** First interpreter that can actually import faster_whisper wins. */
  async resolvePython() {
    if (this.python) return this.python;
    for (const candidate of pythonCandidates()) {
      try {
        if (!fs.existsSync(candidate)) continue;
        await run(candidate, ['-c', 'import faster_whisper, edge_tts'], { timeout: 90000 });
        this.python = candidate;
        log(`voice: STT/TTS interpreter -> ${candidate}`);
        return candidate;
      } catch {
        /* try the next candidate */
      }
    }
    return null;
  }

  async request(pathname, { method = 'GET', body, timeoutMs, raw = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${pathname}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: raw ? 'audio/mpeg, application/octet-stream' : 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (raw) {
        if (!res.ok) throw new Error(`Hermes ${pathname} -> HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      }
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text.slice(0, 400) };
      }
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || `Hermes ${pathname} -> HTTP ${res.status}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async health() {
    const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async models() {
    return this.request('/v1/models', { timeoutMs: 10000 });
  }

  /**
   * One agent turn. Hermes keeps the conversation in its own session store
   * keyed by the `user` field, so the cockpit passes a stable id.
   */
  async chat(text, { user = 'founder' } = {}) {
    const data = await this.request('/v1/chat/completions', {
      method: 'POST',
      timeoutMs: this.chatTimeoutMs,
      body: {
        model: this.model,
        user,
        messages: [{ role: 'user', content: String(text) }],
      },
    });
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      throw new Error(`Hermes vrátil neočekávanou odpověď: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return { reply: reply.trim(), usage: data?.usage || null, model: data?.model || this.model };
  }

  /** Local Whisper through Hermes' own interpreter. */
  async transcribe(filePath) {
    const python = await this.resolvePython();
    if (!python) throw new Error('nenašel jsem interpret s faster_whisper (Hermes STT není nainstalované)');
    const script = path.join(path.dirname(new URL(import.meta.url).pathname), 'stt.py');
    const { stdout, stderr } = await run(python, [script, filePath, this.voice.language], {
      timeout: this.timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    const line = String(stdout).trim().split('\n').filter(Boolean).pop() || '{}';
    let data;
    try {
      data = JSON.parse(line);
    } catch {
      throw new Error(`STT vrátilo nečitelný výstup: ${line.slice(0, 200)} ${String(stderr).slice(0, 200)}`);
    }
    if (data.error) throw new Error(data.error);
    return data;
  }

  /** Speech synthesis through the Edge TTS voice Hermes ships with. */
  async speak(text, outPath) {
    const python = await this.resolvePython();
    if (!python) throw new Error('nenašel jsem interpret pro TTS');
    await run(
      python,
      ['-m', 'edge_tts', '--voice', this.voice.ttsVoice, '--text', String(text).slice(0, 4000), '--write-media', outPath],
      { timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
    );
    const stat = fs.statSync(outPath);
    if (!stat.size) throw new Error('TTS vygenerovalo prázdný soubor');
    return outPath;
  }

  /**
   * WhatsApp link state. The session *directory* is created as soon as a
   * pairing attempt starts, so its existence proves nothing — only the
   * `creds.json` Hermes writes on a successful pair does. Mirrors
   * WhatsAppPair.linked so the two never disagree in /voice/status.
   */
  whatsapp() {
    const sessionDir = this.sessionDir;
    try {
      const creds = path.join(sessionDir, 'creds.json');
      return { linked: fs.existsSync(creds) && fs.statSync(creds).size > 0, sessionDir };
    } catch {
      return { linked: false, sessionDir };
    }
  }

  /** Full picture for the VOICE panel badge. */
  async status() {
    const out = { reachable: false, model: null, error: null, whatsapp: this.whatsapp() };
    try {
      await this.health();
      const models = await this.models();
      out.reachable = true;
      out.model = models?.data?.[0]?.id || null;
      this.lastError = null;
    } catch (err) {
      out.error = err?.message || String(err);
      this.lastError = out.error;
    }
    return out;
  }

  /** CLI passthrough — used for gateway control and diagnostics. */
  async cliJson(args, { timeoutMs = 60000 } = {}) {
    const { stdout } = await run(this.cli, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
    return String(stdout);
  }
}

export { HERMES_HOME };
