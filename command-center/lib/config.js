/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — runtime configuration
   Every value is env-overridable so the same build runs locally and
   on the VPS. No secret is ever sent to the browser.
   ══════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadDotEnv(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* no .env — fine */
  }
}

loadDotEnv(path.join(ROOT, '.env'));

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

export const config = {
  root: ROOT,
  publicDir: path.join(ROOT, 'public'),
  configDir: path.join(ROOT, 'config'),

  port: Number(env('NOEDIS_PORT', 3200)),
  host: env('NOEDIS_HOST', '0.0.0.0'),

  paperclip: {
    baseUrl: env('PAPERCLIP_URL', 'http://127.0.0.1:3100'),
    apiKey: env('PAPERCLIP_API_KEY', ''),
    companyId: env('NOEDIS_COMPANY_ID', '8b5aa752-5199-4f51-9a9c-817647ef1aae'),
    timeoutMs: Number(env('NOEDIS_API_TIMEOUT_MS', 15000)),
  },

  /** URL of the native Paperclip UI, used by the PAPERCLIP tab iframe. */
  paperclipUiUrl: env('NOEDIS_PAPERCLIP_UI_URL', 'https://www.noedis.org'),

  pollIntervalMs: Number(env('NOEDIS_POLL_MS', 4000)),
  logLevel: env('NOEDIS_LOG_LEVEL', 'info'),
};

export function readBlueprint() {
  const file = path.join(config.configDir, 'org-blueprint.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function log(...args) {
  if (config.logLevel !== 'silent') console.log('[noedis]', ...args);
}
