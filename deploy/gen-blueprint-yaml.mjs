#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   Generate the human-readable YAML mirror of the canonical
   org-blueprint.json.

   MASTER v0.3.0 §3 refers to `config/org-blueprint.yaml`, and the JSON is
   what the server actually serves. Keeping both, generated from one source,
   means the spec and the running system cannot drift apart.

   Usage: node deploy/gen-blueprint-yaml.mjs
   ══════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = path.join(ROOT, 'command-center/config/org-blueprint.json');
const YAML_PATH = path.join(ROOT, 'command-center/config/org-blueprint.yaml');

const blueprint = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const needsQuote = (s) => /^[\s>|*&!%@`{}[\],#?:-]|[:#]\s|^\s|\s$|^(true|false|null|yes|no|on|off|~)$|^[-\d.]/.test(s)
  || s.includes(': ') || s.includes(' #');

const scalar = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (s.includes('\n')) {
    return '|\n' + s.split('\n').map((l) => `      ${l}`).join('\n');
  }
  return needsQuote(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
};

function dump(value, indent = 0) {
  const pad = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return ' []';
    return '\n' + value.map((item) => {
      if (item !== null && typeof item === 'object') {
        // Render the object one level deeper, then hang its first key off the
        // dash so nested sequences stay valid YAML ("- key: value").
        const inner = '  '.repeat(indent + 1);
        const lines = dump(item, indent + 1).replace(/^\n/, '').split('\n');
        lines[0] = `${pad}- ${lines[0].slice(inner.length)}`;
        return lines.join('\n');
      }
      return `${pad}- ${scalar(item)}`;
    }).join('\n');
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return ' {}';
    return '\n' + keys.map((k) => {
      const v = value[k];
      const rendered = v !== null && typeof v === 'object' ? dump(v, indent + 1) : ` ${scalar(v)}`;
      return `${pad}${k}:${rendered}`;
    }).join('\n');
  }
  return ` ${scalar(value)}`;
}

const header = `# NOEDIS org-blueprint — human-readable mirror of org-blueprint.json
#
# GENERATED FILE — do not edit by hand.
#   canonical : command-center/config/org-blueprint.json
#   regenerate: node deploy/gen-blueprint-yaml.mjs
#
# Source of truth: NOEDIS_AUTONOMOUS_COMPANY_MASTER_v0.3.0.md
# Runtime invariant: every agent is pi_local -> OpenRouter (OPENROUTER_API_KEY).

`;

fs.writeFileSync(YAML_PATH, header + dump(blueprint).replace(/^\n/, '') + '\n');

const depts = blueprint.departments.length;
const divisions = blueprint.departments.reduce((n, d) => n + d.divisions.length, 0);
const teams = blueprint.departments.reduce(
  (n, d) => n + d.divisions.reduce((m, v) => m + v.teams.length, 0), 0);

console.log(`wrote ${path.relative(ROOT, YAML_PATH)}`);
console.log(`  ${depts} departments / ${divisions} divisions / ${teams} teams`);
console.log(`  model policy: ${blueprint.runtime.model}`);
