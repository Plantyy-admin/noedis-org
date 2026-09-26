# NOEDIS Command Center v0.4.0

**STRUCTURE · CHAT · PAPERCLIP · GAMEPLAY · DASHBOARD · INBOX**

The cockpit for the NOEDIS Autonomous Company. It reads the canonical org blueprint
derived from **`NOEDIS_COMPLETE_SUMMARY_v1.0.md`**, merges it with the live Paperclip
org, and presents the whole company — organisation and units — in one interface.

Live state it reflects: **3 executive agents + 7 departments + 24 agents**,
one org root (`NOE`), zero runtime drift.

- **Live:** <https://noedis.org/command/>
- **Full documentation:** [`docs/COMMAND-CENTER.md`](../docs/COMMAND-CENTER.md)

---

## Quick start

```bash
npm install
cp .env.example .env      # then set PAPERCLIP_API_KEY
npm start                 # http://127.0.0.1:3200
```

Against the live VPS Paperclip, tunnel first:

```bash
ssh -N -L 127.0.0.1:13100:127.0.0.1:3100 -p 501 vpsadmin@76.13.154.124 &
# .env -> PAPERCLIP_URL=http://127.0.0.1:13100
```

Verify a running instance in a real browser (21 assertions + screenshots):

```bash
npm test -- https://noedis.org/command/
```

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
│   └── paperclip.js       authenticated Paperclip API client
├── config/
│   ├── org-blueprint.json canonical org (summary v1.0 §4.1 + §4.3) + model policy
│   └── org-blueprint.yaml generated readable mirror
├── public/
│   ├── index.html         shell + top navigation
│   ├── css/style.css
│   └── js/
│       ├── app.js         bootstrap, navigation, live wiring
│       ├── api.js         fetch wrappers + WebSocket
│       ├── store.js       blueprint × Paperclip merge
│       ├── structure.js   STRUCTURE panel
│       ├── dashboard.js   DASHBOARD panel
│       ├── inbox.js       INBOX panel
│       ├── chat.js        CHAT (work intake)
│       ├── gameplay.js    GAMEPLAY canvas
│       └── util.js
└── test/
    ├── smoke.mjs          Playwright smoke test (26 assertions)
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
