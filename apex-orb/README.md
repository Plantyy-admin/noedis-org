# NOEDIS APEX orb

The animated orb that fills the cockpit's **VOICE** panel. You talk, it listens,
it answers — and the circles around it are the real company.

Served by Caddy at <https://noedis.org/voice> and embedded as an iframe by
`command-center/public/index.html`. It is a separate Next.js service
(`noedis-apex` on `127.0.0.1:3400`) because the cockpit is plain ES modules
while the orb is React 19 + three.js.

## What NOEDIS changed

This started as a clone of [APEX-UI](https://github.com/RubenM1990/APEX-UI)
(MIT — see `LICENSE` and `CREDITS.md`). The upstream tree is a demo: gold
`#f5a623`, English labels, and a made-up roster of eighteen agents
(Chief of staff, CRM, Calendar, Drive…). Three things were replaced.

### 1 · The colours are the company's

Every hue comes from the NOEDIS instrument palette in
`command-center/public/css/style.css` §00, and the orb carries a *gradient* per
state rather than one flat colour:

| State | Gradient | Meaning |
|---|---|---|
| `idle` | blue → cyan → violet, dimmed | pohotovost |
| `listening` | amber → orange → magenta | the founder is speaking |
| `thinking` | silver → white → green | the company is working |
| `speaking` | blue → cyan → violet | the orb is answering |
| `delegating` | gold → amber → orange | a task is being handed over |
| `error` | magenta → red | something broke |

The single source of truth is `components/noedis-skin.ts`; the SVG ring, the
three.js particle core, the status bar and the cockpit's HUD all read from it.

### 2 · The circles are the real org

`components/noedis-org.ts` lays out nine slots — NOE at twelve o'clock, CODY
and RENE flanking him, and the seven department heads fanned across the bottom
— and fills them from the live roster at `/noedis/api/voice/agents`. A baked-in
fallback mirroring the board keeps the sky populated when Paperclip is
unreachable. Clicking a circle opens that agent's card and can hand it to the
voice panel as the next target.

### 3 · It answers the voice loop

The cockpit posts messages into this frame:

```js
{ apex: "listening" }                                 // the founder speaks
{ apex: "thinking", agents: ["cody"], action: "pracuje" }
{ apex: "speaking" }
{ apex: "delegating", agents: ["<agent-uuid>"] }
{ apex: "error" }
```

`agents` accepts node keys (`cody`, `dept3`), Paperclip ids, agent names or
department names. Each resolves to a circle, which lights and appears as a chip
under the orb — so what you see around the orb is what the company is doing.

The orb talks back too: `{ noedis: "target", agentId }` sets the voice target
when you pick an agent on the orb instead of in the panel.

## Layout

```
apex-orb/
├── app/
│   ├── layout.tsx           Czech metadata + the cockpit's fonts
│   ├── page.tsx             the deck: company HUD + the world
│   └── globals.css          NOEDIS tokens (a copy of the cockpit's §00)
├── components/
│   ├── noedis-skin.ts       the palette and the six state gradients
│   ├── noedis-org.ts        constellation layout + live roster
│   ├── ApexWorld.tsx        the orchestrator: state, roster, agent cards
│   ├── ApexHeroOrb.tsx      stage + scale, wires skin into the art
│   ├── ApexOrb.jsx          the SVG ring, tinted by the state gradient
│   ├── ApexCore3D.jsx       the three.js particle core
│   ├── OrbStatusBar.jsx     equalizer, Czech state, agent chips
│   ├── ReasoningWeb.jsx     the constellation graph
│   ├── ApexOverviewPanel.tsx  top-left read-out: clock, agents, Hermes
│   └── ShaderBackground.jsx the plasma backdrop (gold={false} = NOEDIS cyan)
└── next.config.mjs          basePath /voice
```

## Running it

```bash
npm install
npm run dev          # http://127.0.0.1:3000/voice
npm run build && npm start
```

Against the live cockpit, deploy with `../deploy/deploy-apex.sh` — it uploads
this directory, builds on the VPS and restarts `noedis-apex`.
