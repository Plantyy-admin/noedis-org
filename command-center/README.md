# NOEDIS Command Center v0.5.0

**STRUCTURE · CHAT · PAPERCLIP · GAMEPLAY · DASHBOARD · INBOX**

The cockpit for the NOEDIS Autonomous Company. It reads the canonical org blueprint
derived from **`NOEDIS_COMPLETE_SUMMARY_v1.0.md`**, merges it with the live Paperclip
org, and presents the whole company — organisation and units — in one interface.

Live state it reflects: **3 executive agents + 7 departments + 24 agents**,
one org root (`NOE`), zero runtime drift.

- **Live:** <https://noedis.org/>  (Paperclip: <https://www.noedis.org/>)
- **Full documentation:** [`docs/COMMAND-CENTER.md`](../docs/COMMAND-CENTER.md)

---

## The bridge

The header is a three-part grid, in the order the founder asked for:

```
┌──────────────────────┬───────────────────────────────┬──────────────────────────┐
│ ◆  NOEDIS            │  STRUCTURE CHAT PAPERCLIP     │  ● LIVE  24 AGENTŮ       │
│    COMPANY           │  GAMEPLAY DASHBOARD INBOX     │  ⏻ ODHLÁSIT SE           │
└──────────────────────┴───────────────────────────────┴──────────────────────────┘
```

- **Left** — mark, gradient wordmark, and the amber `COMPANY` subtitle.
- **Centre** — the six stop switchers as violet gradient keys; the active key is lit.
- **Right** — the Paperclip uplink read-out, the roster size, and the sign-out key.

The whole cockpit wears the NOEDIS STATS instrument language: midnight glass, a
blueprint field with corner glows and a slow aurora, a per-surface accent variable
(`--nd-accent` / `--c`) driving every edge and glow, and read-outs in wide-tracked
micro caps. Palette and rules: `public/css/style.css` §00.

---

## Quick start

```bash
npm install
cp .env.example .env      # then set PAPERCLIP_API_KEY and the sign-in pair
npm start                 # http://127.0.0.1:3200
```

Against the live VPS Paperclip, tunnel first:

```bash
ssh -N -L 127.0.0.1:13100:127.0.0.1:3100 -p 501 vpsadmin@76.13.154.124 &
# .env -> PAPERCLIP_URL=http://127.0.0.1:13100
```

Verify a running instance in a real browser (32 assertions + screenshots):

```bash
NOEDIS_AUTH_USER=noedis NOEDIS_AUTH_PASS=… npm test -- https://noedis.org
```

---

## Sign-in

The cockpit carries its own gate (`lib/auth.js`): a signed session cookie, a
self-contained sign-in screen, and a working **ODHLÁSIT SE**. It replaced Caddy's
HTTP basic auth, which the browser cannot sign out of. With no `NOEDIS_AUTH_PASS`
set the gate is off and the cockpit is published openly — the boot log says which.
See [`docs/COMMAND-CENTER.md` §7b](../docs/COMMAND-CENTER.md).

---

## The STRUCTURE panel

The first tab, and the point of the cockpit. It renders two blocks:

1. **ORG — vedení společnosti** — `FOUNDER → NOE (Senior Advisor) → CODY (Right
   Hand) + RENE (Left Hand) → 7 department heads`, with live status per node.
2. **JEDNOTKY SPOLEČNOSTI** — `Department → Division → Team → Agent`, expandable and
   searchable. All 32 teams are listed; the 16 not yet staffed are marked
   `neinstantováno`.

Shape comes from `config/org-blueprint.json`; reality (which agents exist, their
status, their unit) comes from Paperclip. Anything Paperclip has that the blueprint
does not know about is shown under **NEPŘIŘAZENO** instead of being hidden.

---

## Layout

```
command-center/
├── server.js              Express app — the only holder of the Paperclip key
├── lib/
│   ├── config.js          env-driven configuration + blueprint loader
│   ├── auth.js            session gate: signed cookie, credential check, throttling
│   ├── login-page.js      the sign-in screen (self-contained HTML)
│   └── paperclip.js       authenticated Paperclip API client
├── config/
│   ├── org-blueprint.json canonical org (summary v1.0 §4.1 + §4.3) + model policy
│   └── org-blueprint.yaml generated readable mirror
├── public/
│   ├── index.html         shell + the bridge
│   ├── css/style.css      the Command Deck design system
│   └── js/
│       ├── app.js         bootstrap, navigation, sign-out, live wiring
│       ├── api.js         fetch wrappers + WebSocket
│       ├── store.js       blueprint × Paperclip merge
│       ├── structure.js   STRUCTURE panel
│       ├── dashboard.js   DASHBOARD panel
│       ├── inbox.js       INBOX panel
│       ├── chat.js        CHAT (work intake)
│       ├── gameplay.js    GAMEPLAY canvas
│       └── util.js
└── test/
    ├── smoke.mjs          Playwright smoke test (32 assertions, signs in first)
    └── shots.mjs          one screenshot per view
```

The board API key never reaches the browser: all Paperclip access is proxied through
`/noedis/api/*` on the server.

---

## Company model policy

```json
"runtime": { "model": "openrouter/~deepseek/deepseek-flash-latest" }
```

One value, applied to every agent by the reconciler. The previous pin
(`deepseek/deepseek-v4.1-flash`) does not exist in pi 0.87.1 and made every run fail
with `adapter_failed`; see [`docs/COMMAND-CENTER.md` §5](../docs/COMMAND-CENTER.md)
for the full story and how to change it.
