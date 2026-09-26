# NOEDIS Command Center

The cockpit for the NOEDIS Autonomous Company: one interface on top of Paperclip that
shows the whole organisation, the live agent roster, work intake and the report inbox.

- **Cockpit:** <https://noedis.org/command/>
- **Paperclip (native UI, unchanged):** <https://noedis.org/>
- **Source of truth:** [`NOEDIS_AUTONOMOUS_COMPANY_MASTER_v0.3.0.md`](../NOEDIS_AUTONOMOUS_COMPANY_MASTER_v0.3.0.md)

---

## 1. Why the cockpit is on a path

Paperclip's authenticated mode pins its auth base URL to `https://noedis.org`.
Taking over that host would redirect logins into the cockpit and break the founder's
existing session. So Paperclip keeps the root and its own paths, and the cockpit is
published one level down:

| URL | Serves | Notes |
|-----|--------|-------|
| `https://noedis.org/` | Paperclip UI | untouched, auth base URL intact |
| `https://noedis.org/api/*` | Paperclip API | untouched |
| `https://noedis.org/command/` | **Command Center** | the cockpit |
| `https://noedis.org/noedis/*` | **Command Center API + WS** | server-side Paperclip access |

No DNS change and no new TLS certificate were required.

---

## 2. Views

The top navigation leads with **STRUCTURE**, which is the panel the founder asked for:
organisation *and* company units in one place.

| View | What it shows |
|------|---------------|
| **STRUCTURE** | Two blocks. **ORG — vedení společnosti**: `FOUNDER → NOE (Senior Advisor) → CODY (Right Hand) + RENE (Left Hand) → 7 department heads`, with live status. **JEDNOTKY SPOLEČNOSTI**: `Department → Division → Team → Agent`, expandable and searchable, with unstaffed teams marked *neinstantováno*. |
| **CHAT** | Work intake with an **agent dropdown** covering every agent (§5.2). Paperclip models "talking to an agent" as creating an issue assigned to that agent and waking it, so the panel does exactly that: pick an agent, write the assignment, choose priority, optionally wake. |
| **PAPERCLIP** | The native Paperclip UI embedded in an iframe, plus a link to open it standalone. |
| **GAMEPLAY** | Isometric pixel-art station with **ten floors** — `NOE → CODY → RENE → VÝVOJ → INFRA → IT → MARKETING → LEGAL → FINANCE → LABS` — on a starfield, agents as glowing dots (squares for leads, circles for specialists), 60 fps. The crew rail lists the roster grouped by the same ten floors. |
| **DASHBOARD** | Agent / task / cost metrics, the **runtime invariant readout** (adapter, provider, model, drift), company record and the full agent roster with each agent's unit. |
| **INBOX** | Reports arriving via **RENE → NOE → Founder**, classified into exactly four categories: **DONE · DECISION · RISK · RELEASE**. Anything else is deliberately not shown. |

### §5.3 technical details

| Requirement | Implementation |
|-------------|----------------|
| Compact top bar **36 px** | `#top-nav { height: 36px }`, views sized `calc(100vh - 36px)` |
| Auto-refresh **STRUCTURE 5 s / DASHBOARD 4 s / INBOX 6 s** | one `setInterval` per view in `app.js` |
| **60 fps** canvas | `requestAnimationFrame` loop in `gameplay.js` |
| All views read the Paperclip API | proxied through `/noedis/api/*` with the board key added server-side |

The original implementation injected CSS and JS into Paperclip's own `index.html`.
This cockpit is a standalone app published on a path instead, which keeps Paperclip's
auth and upgrades untouched — see §1.

---

## 3. Architecture

```
browser ──▶ https://noedis.org/command/     (static UI)
        └─▶ https://noedis.org/noedis/api/* (JSON)  ──▶ Command Center (Express, 127.0.0.1:3200)
        └─▶ wss://noedis.org/noedis/ws              ──▶        │
                                                                │  Bearer pcp_board_…
                                                                ▼
                                                    Paperclip (127.0.0.1:3100)
```

The Command Center is the **only** component that holds the board API key. The browser
never receives it: every Paperclip call is proxied server-side. The UI is served as
plain ES modules with no build step and no runtime dependencies beyond `express` and `ws`.

Live updates come from the server, which polls Paperclip every 4 s and pushes a
snapshot over WebSocket only when something actually changed. The UI degrades to
periodic polling if the socket drops (the uplink indicator shows `live` vs `poll`).

---

## 4. Organisation model

Shape comes from the blueprint; reality comes from Paperclip. The two are merged at
render time in [`public/js/store.js`](public/js/store.js).

- **Shape —** [`config/org-blueprint.json`](config/org-blueprint.json) is canonical and
  derives from `NOEDIS_COMPLETE_SUMMARY_v1.0.md` §4.1 + §4.3: 3 executive agents,
  **7 departments** (VÝVOJ, INFRA, IT, MARKETING, LEGAL, FINANCE, LABS),
  16 divisions, 32 teams and exactly **24 agents**. `config/org-blueprint.yaml` is a
  generated readable mirror; regenerate it with `node deploy/gen-blueprint-yaml.mjs`.
- **Reality —** Paperclip supplies which agents exist, their status, their unit
  (from `metadata`) and their runtime.

An agent is placed by, in order of trust: `metadata.{dept,division,team}`, then the
blueprint's `staffed` list, then the live `reports_to` chain. Anything the blueprint
does not know about is shown under **NEPŘIŘAZENO** rather than silently dropped.

### Department heads, not boards

The summary leads each department with one of the existing agents rather than a
separate board agent: VÝVOJ → Frontend Engineer, INFRA → DevOps Engineer, IT →
Support Specialist, MARKETING → Marketing Lead, LEGAL → Legal Counsel, FINANCE →
Business Analyst, LABS → Research Scientist. Each head reports to CODY (never to
itself), and the rest of the department reports to its head. The resulting live tree
is exactly one root: `NOE → CODY → 7 heads → 21 specialists`.

### Lazy instantiation

The summary defines a division/team structure that is broader than the current
roster, so the cockpit renders **all 32 teams** even though only 16 are staffed,
marking the rest as `neinstantováno`. Those are the units that would be created when
work first requires them.

### `role` is an enum

Paperclip validates `agents.role` against a fixed vocabulary
(`ceo`, `cto`, `cmo`, `cfo`, `security`, `engineer`, `designer`, `pm`, `qa`,
`devops`, `researcher`, `general`). The organisational path is **not** stored there.
It lives in `metadata.path`, and the human-readable designation in `title`.
The mapping is declared in `org-blueprint.json → roleEnums`.

---

## 5. Runtime invariant

Every agent runs `pi_local` → OpenRouter through one shared `OPENROUTER_API_KEY`.
The DASHBOARD *RUNTIME* card reports the adapter, provider, model and the number of
agents drifting from that invariant, so a drift is visible rather than silent.

### Model policy — one value, centrally set

```json
"runtime": { "model": "openrouter/~deepseek/deepseek-flash-latest" }
```

**This value was changed during deployment and you should know why.** The previous
configuration pinned `deepseek/deepseek-v4.1-flash`, an identifier that does not
exist in pi 0.87.1. Every agent run failed with `adapter_failed`:

```
Configured Pi model is unavailable: deepseek/deepseek-v4.1-flash.
```

Pi exposes models as `<provider>/<model>`, where the `~` entries are Pi aliases.
`pi --list-models` is the authoritative list. The evergreen `-latest` alias was
chosen so a future version bump cannot silently break the company again — and it
resolves to the original intent: OpenRouter reports `responseModel:
deepseek/deepseek-v4.1-flash` for it.

To change the company model, edit that one value and re-run the reconciler; use
`NOEDIS_MODEL` to override without editing files:

```bash
node deploy/reconcile-org.mjs --model 'openrouter/~anthropic/claude-sonnet-latest' …
```

---

## 6. Reconciling the live org

[`deploy/reconcile-org.mjs`](../deploy/reconcile-org.mjs) makes the live Paperclip org
match the blueprint. It is **idempotent** — re-running it reports `unchanged` for
everything already correct.

```bash
node deploy/reconcile-org.mjs \
  --blueprint command-center/config/org-blueprint.json \
  --api http://127.0.0.1:3100 \
  --key "$PAPERCLIP_API_KEY" \
  --company "$NOEDIS_COMPANY_ID" \
  [--dry-run] [--model 'openrouter/~deepseek/deepseek-flash-latest']
```

It aligns the three executive agents and the seven department heads, then places
every specialist into its division and team by writing `role`, `title`, `reportsTo`
and `metadata`.

`--prune` additionally deletes agents this reconciler previously managed (they carry
`metadata.blueprintVersion`) that the current blueprint no longer defines. Agents it
never touched are never deleted.

Current effect: the live company is exactly **24 agents** with one org root (`NOE`)
and zero runtime drift; re-running reports `unchanged` for all 24.

One Paperclip quirk to know: `POST /api/agents/{id}/clear-error` only accepts agents
whose status is already `error`, so a stale message on an idle agent (NOE's
pre-Pi-install `Command not found in PATH: "pi"`) can only be cleared by writing the
column directly. The script prints the exact SQL when it meets this case.

---

## 7. Deploying

```bash
./deploy/deploy-command-center.sh
```

The script packages the app, uploads it to `/srv/noedis/command-center`, installs
dependencies, writes `.env` (mode 600), installs and restarts the
`noedis-command-center` systemd unit, then publishes the Caddy routes. It is
idempotent and safe to re-run.

Caddy handling lives in [`deploy/caddy-command-center.py`](../deploy/caddy-command-center.py).
It rewrites only the `noedis.org` block, strips any previously injected copy before
writing exactly one, and relaxes `X-Frame-Options` from `DENY` to `SAMEORIGIN` so the
cockpit may embed Paperclip on its own origin (third-party framing stays blocked).
The Caddyfile is backed up before every change and **restored automatically if
`caddy validate` fails**.

### Run locally against live Paperclip

```bash
ssh -N -L 127.0.0.1:13100:127.0.0.1:3100 -p 501 vpsadmin@76.13.154.124 &
cd command-center && npm install && npm start
# .env: PAPERCLIP_URL=http://127.0.0.1:13100
```

---

## 8. Verifying

```bash
node command-center/test/smoke.mjs https://noedis.org/command/
```

Drives a real browser against a real deployment and asserts 21 properties: the
the structure counters, the org tree, the seven departments of §4.1 and their heads,
that each of the 21 specialists appears in exactly one team and no head leaks into
teams, the 24-row dashboard roster, the `pi_local` runtime readout, the four INBOX
categories, the chat dropdown, the ten GAMEPLAY floors in order, the embedded
Paperclip iframe, and that the cockpit itself logs no console errors. Screenshots land
in `command-center/test/out/` (`node test/shots.mjs`).

---

## 9. Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `NOEDIS_PORT` | `3200` | listen port |
| `NOEDIS_HOST` | `0.0.0.0` | bind address (`127.0.0.1` on the VPS) |
| `PAPERCLIP_URL` | `http://127.0.0.1:3100` | Paperclip base URL |
| `PAPERCLIP_API_KEY` | — | board API key (**server-side only**) |
| `NOEDIS_COMPANY_ID` | NOEDIS company UUID | which company to show |
| `NOEDIS_PAPERCLIP_UI_URL` | `https://www.noedis.org` | iframe target for the PAPERCLIP tab |
| `NOEDIS_POLL_MS` | `4000` | live polling interval |

`command-center/.env` is git-ignored and holds the board key in production. Note that
**the board key is still a weak, human-chosen default** — rotating it is worthwhile, but it
must be rotated in Paperclip and `command-center/.env` together. It is deliberately not
reproduced in this repository.

---

## 10. Rollback

```bash
# stop publishing the cockpit (Paperclip keeps working — it was never touched)
sudo cp /etc/caddy/Caddyfile.bak-command-center-<stamp> /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl disable --now noedis-command-center
```

Org changes are reversible from the pre-mutation dump:

```bash
docker exec -i noedis-pg psql -U paperclip -d paperclip \
  < /srv/noedis/backups/pre-reconcile/paperclip-<stamp>.sql
```
