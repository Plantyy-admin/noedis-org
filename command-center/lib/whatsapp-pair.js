/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — WhatsApp pairing

   Hermes' Baileys bridge can be run in a pairing mode that streams JSON
   instead of drawing an ASCII QR in a terminal:

       node bridge.js --pair-only --pair-json --session <dir>

   That is what this wraps. The raw QR payload is kept in memory, rendered to
   a PNG with `qrencode` on demand, and the bridge is stopped the moment the
   link is made (or after a few minutes of nobody scanning). Nothing here is
   exposed outside the cockpit's own gate.
   ══════════════════════════════════════════════════════════════ */

import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { log } from './config.js';

const run = promisify(execFile);

/** Hard stop for a pairing nobody completed. */
const PAIR_TIMEOUT_MS = 5 * 60 * 1000;

function firstExisting(candidates) {
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

export class WhatsAppPairing {
  constructor({ bridgeDir, sessionPath, mode = 'self-chat', hermesCli, nodeHome = os.homedir() }) {
    this.bridgeDir = bridgeDir;
    this.bridgeScript = path.join(bridgeDir, 'bridge.js');
    this.sessionPath = sessionPath;
    this.mode = mode;
    this.hermesCli = hermesCli;
    this.node = firstExisting([
      process.env.WHATSAPP_NODE,
      ...this.#glob(path.join(nodeHome, '.hermes', 'tools'), 'node-*', 'bin', 'node'),
      '/usr/bin/node',
    ]);
    this.qrencode = process.env.QRENCODE || '/usr/bin/qrencode';

    this.proc = null;
    this.qr = null;
    this.qrAt = 0;
    this.state = 'idle'; // idle | starting | waiting | linked | error
    this.error = null;
    this.buffer = '';
    this.timer = null;
  }

  #glob(base, ...parts) {
    try {
      return fs
        .readdirSync(base)
        .filter((name) => name.startsWith(parts[0].replace('*', '')))
        .sort()
        .reverse()
        .map((name) => path.join(base, name, ...parts.slice(1)));
    } catch {
      return [];
    }
  }

  get credsFile() {
    return path.join(this.sessionPath, 'creds.json');
  }

  get linked() {
    try {
      return fs.existsSync(this.credsFile);
    } catch {
      return false;
    }
  }

  /** The number the session is linked to, when the bridge recorded one. */
  get account() {
    try {
      const creds = JSON.parse(fs.readFileSync(this.credsFile, 'utf8'));
      const id = creds?.me?.id || creds?.me?.jid || '';
      const number = String(id).split(/[:@]/)[0];
      return number || null;
    } catch {
      return null;
    }
  }

  get running() {
    return Boolean(this.proc && this.proc.exitCode === null && !this.proc.killed);
  }

  status() {
    return {
      linked: this.linked,
      account: this.account,
      state: this.linked ? 'linked' : this.state,
      hasQr: Boolean(this.qr) && Date.now() - this.qrAt < 60000,
      qrAgeSeconds: this.qr ? Math.round((Date.now() - this.qrAt) / 1000) : null,
      error: this.error,
      mode: this.mode,
      bridgeReady: fs.existsSync(this.bridgeScript),
      node: this.node,
    };
  }

  async start() {
    if (this.linked) return this.status();
    if (this.running) return this.status();

    if (!fs.existsSync(this.bridgeScript)) {
      this.state = 'error';
      this.error = `bridge nenalezen: ${this.bridgeScript}`;
      return this.status();
    }
    if (!this.node) {
      this.state = 'error';
      this.error = 'nenašel jsem Node pro bridge';
      return this.status();
    }

    this.state = 'starting';
    this.error = null;
    this.qr = null;

    const env = {
      ...process.env,
      WHATSAPP_MODE: this.mode,
      WHATSAPP_DM_POLICY: 'pairing',
    };
    log(`whatsapp: starting pairing bridge (${this.node})`);
    this.proc = spawn(
      this.node,
      [this.bridgeScript, '--pair-only', '--pair-json', '--session', this.sessionPath],
      { cwd: this.bridgeDir, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    const onData = (chunk) => this.#feed(String(chunk));
    this.proc.stdout?.on('data', onData);
    this.proc.stderr?.on('data', onData);
    this.proc.on('exit', (code) => {
      log(`whatsapp: pairing bridge exited (${code})`);
      if (!this.linked && this.state !== 'error' && this.state !== 'linked') {
        this.state = 'idle';
        this.qr = null;
      }
      this.proc = null;
    });
    this.proc.on('error', (err) => {
      this.state = 'error';
      this.error = err.message;
      this.proc = null;
    });

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.linked) {
        log('whatsapp: nobody scanned the QR in time — stopping the bridge');
        this.stop('vypršel čas na naskenování');
      }
    }, PAIR_TIMEOUT_MS);

    return this.status();
  }

  #feed(text) {
    this.buffer += text;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      let event;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }
      this.#handle(event);
    }
  }

  #handle(event) {
    const name = String(event.event || event.type || '');
    if (name === 'qr' && event.qr) {
      this.qr = String(event.qr);
      this.qrAt = Date.now();
      this.state = 'waiting';
      this.error = null;
      return;
    }
    if (['connected', 'open', 'ready', 'paired', 'success'].includes(name)) {
      this.state = 'linked';
      log('whatsapp: linked');
      this.stop();
      this.#restartGateway();
      return;
    }
    if (name === 'error' || name === 'fatal') {
      this.state = 'error';
      this.error = String(event.message || event.error || 'bridge hlásí chybu');
      return;
    }
    if (name === 'started') {
      this.state = 'starting';
    }
  }

  /** The gateway only picks the session up on a restart. */
  async #restartGateway() {
    if (!this.hermesCli) return;
    try {
      await run(this.hermesCli, ['gateway', 'restart'], { timeout: 120000 });
      log('whatsapp: gateway restarted to attach the new session');
    } catch (err) {
      log('whatsapp: gateway restart failed:', err.message);
    }
  }

  stop(reason = 'zastaveno') {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.proc) {
      try {
        this.proc.kill('SIGTERM');
      } catch {
        /* already gone */
      }
      this.proc = null;
    }
    if (!this.linked) {
      this.state = 'idle';
      this.qr = null;
    }
    this.error = this.state === 'error' ? this.error : null;
    return { stopped: true, reason, ...this.status() };
  }

  /** Current QR as a PNG, or null when there is nothing to show. */
  async qrPng() {
    if (!this.qr) return null;
    const fresh = Date.now() - this.qrAt < 60000;
    if (!fresh) return null;

    // spawn, not execFile: this is binary, and execFile would decode stdout as
    // UTF-8 and quietly corrupt the PNG signature.
    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(this.qrencode, ['-o', '-', '-t', 'PNG', '-s', '7', '-m', '2', this.qr], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        log('whatsapp: qrencode could not start:', err.message);
        return resolve(null);
      }
      const chunks = [];
      let stderr = '';
      const done = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* gone */
        }
        resolve(null);
      }, 15000);

      child.stdout.on('data', (d) => chunks.push(d));
      child.stderr.on('data', (d) => {
        stderr += String(d).slice(0, 200);
      });
      child.on('error', (err) => {
        clearTimeout(done);
        log('whatsapp: qrencode failed:', err.message);
        resolve(null);
      });
      child.on('close', (code) => {
        clearTimeout(done);
        const buf = Buffer.concat(chunks);
        const isPng = buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG';
        if (code !== 0 || !isPng) {
          log(`whatsapp: qrencode produced no PNG (exit ${code}) ${stderr}`);
          return resolve(null);
        }
        resolve(buf);
      });
    });
  }
}
