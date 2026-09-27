# NOEDIS Command Center

The cockpit for the NOEDIS Autonomous Company: one interface on top of Paperclip that
shows the whole organisation, the live agent roster, work intake and the report inbox.

- **Cockpit:** <https://noedis.org/> — this is what `noedis.org` opens
- **Paperclip (native UI):** <https://www.noedis.org/>
- **Source of truth:** [`NOEDIS_AUTONOMOUS_COMPANY_MASTER_v0.3.0.md`](../NOEDIS_AUTONOMOUS_COMPANY_MASTER_v0.3.0.md)

---

## 1. Two hostnames, one purpose

`noedis.org` opens the **cockpit**. Paperclip's native UI lives on
`www.noedis.org`. Both resolve to the same VPS; no DNS change was needed because
`www.noedis.org` already pointed there and Caddy issues its certificate on demand.

| URL | Serves |
|-----|--------|
| `https://noedis.org/` | **Command Center** (the cockpit) |
| `https://noedis.org/noedis/*` | cockpit API + WebSocket |
| `https://noedis.org/js/*`, `/css/*` | cockpit assets |
| `https://noedis.org/command*` | 308 → `/` (the cockpit's original URL) |
| `https://www.noedis.org/` | Paperclip UI and its `/api/*`, `/assets/*` |

### Why Paperclip moved

Paperclip was configured with `auth.customBaseUrl = https://noedis.org`. Once the
cockpit took that root, better-auth would have redirected logins back into the
cockpit. So Paperclip's canonical host was moved to `www.noedis.org` — config,
allowed hostnames and Caddy together:

```jsonc
// ~/.paperclip/instances/default/config.json
"auth":          { "customBaseUrl": "https://www.noedis.org",
                   "publicBaseUrl": "https://www.noedis.org" },
"server":        { "allowedHostnames": ["localhost", "noedis.org", "www.noedis.org"] }
```

Verified: `POST https://www.noedis.org/api/auth/sign-in/email` answers with a
normal `401 INVALID_EMAIL_OR_PASSWORD`, not an origin/CSRF rejection.

The `www` block sets `Content-Security-Policy: frame-ancestors https://noedis.org`
so only the cockpit may embed Paperclip — every other site is refused, and no
`X-Frame-Options` header is sent (it would block the cockpit's own iframe).

The cockpit's PAPERCLIP tab therefore embeds `https://www.noedis.org`
(`NOEDIS_PAPERCLIP_UI_URL`). Pointing it at `noedis.org` would nest the cockpit
inside itself.

### Paperclip's shell is clean

An earlier deployment injected a second navigation — a fixed 36 px bar with
CHAT / PAPERCLIP / GAMEPLAY / STRUCTURE / INBOX overlays — straight into
Paperclip's own UI shell:

```
/usr/lib/node_modules/paperclipai/node_modules/@paperclipai/server/ui-dist/index.html
```

Those views now live here, at `/command/`, so that injection was removed: it left
every page of the native Paperclip UI carrying a duplicate, conflicting menu.
The file went from 18 918 to 2 271 bytes and now contains only the original
Paperclip shell (`#root` plus its two asset tags).

Re-run the removal at any time with:

```bash
sudo python3 deploy/remove-paperclip-injection.py
sudo systemctl restart noedis-paperclip
```

It is idempotent (on a clean file it prints `clean already`) and writes a
timestamped backup first.

> **Do not run the legacy injection scripts** left in the repository root
> (`inject_nav.sh`, `premium-inject.js`, `noedis-inject.js`, `rebuild_gameplay.py`).
> They recreate exactly this bar. They are untracked leftovers from the previous
> deployment, not part of the current build.

---

## 2. Views

The **bridge** at the top is a three-part grid: the mark, wordmark and the
`COMPANY` subtitle on the left; the six stop switchers in the middle; the uplink
read-out, the roster size and **ODHLÁSIT SE** on the right. The cockpit wears the
same instrument language as the NOEDIS STATS deck — midnight glass, a blueprint
field with corner glows, one accent variable per surface (`--nd-accent`, `--c`)
and read-outs in wide-tracked micro caps.

| View | What it shows |
|------|---------------|
| **STRUCTURE** | Two blocks. **ORG — vedení společnosti**: `FOUNDER → NOE (Senior Advisor) → CODY (Right Hand) + RENE (Left Hand) → 7 department heads`, with live status. **JEDNOTKY SPOLEČNOSTI**: `Department → Division → Team → Agent`, expandable and searchable, with unstaffed teams marked *neinstantováno*. |
| **CHAT** | Two modes behind one switcher. **CHAT** is work intake with an **agent dropdown** covering every agent (§5.2): Paperclip models "talking to an agent" as creating an issue assigned to that agent and waking it, so the panel does exactly that. **VOICE** is a spoken loop with the Hermes agent — see §7c. |
| **PAPERCLIP** | The native Paperclip UI embedded in an iframe, plus a link to open it standalone. |
| **GAMEPLAY** | Isometric pixel-art station with **ten floors** — `NOE → CODY → RENE → VÝVOJ → INFRA → IT → MARKETING → LEGAL → FINANCE → LABS` — on a starfield, agents as glowing dots (squares for leads, circles for specialists), 60 fps. The crew rail lists the roster grouped by the same ten floors. |
| **DASHBOARD** | Agent / task / cost metrics, the **runtime invariant readout** (adapter, provider, model, drift), company record and the full agent roster with each agent's unit. |
| **INBOX** | Reports arriving via **RENE → NOE → Founder**, classified into exactly four categories: **DONE · DECISION · RISK · RELEASE**. Anything else is deliberately not shown. |

### §5.3 technical details

| Requirement | Implementation |
|-------------|----------------|
| Brand **left** — mark, wordmark, `COMPANY` | `.nav-brand` (grid column 1), gradient wordmark + amber micro-caps subtitle |
| Switchers **centre** | `.nav-tabs` (grid column `auto`), violet gradient key pills, active key lit |
| Sign-out **right** | `.nav-status` → `#nav-logout`, magenta key that ends the server session |
| Auto-refresh **STRUCTURE 5 s / DASHBOARD 4 s / INBOX 6 s** | one `setInterval` per view in `app.js` |
| **60 fps** canvas | `requestAnimationFrame` loop in `gameplay.js` |
| All views read the Paperclip API | proxied through `/noedis/api/*` with the board key added server-side |

The original implementation injected CSS and JS into Paperclip's own `index.html`.
This cockpit is a standalone app published on a path instead, which keeps Paperclip's
auth and upgrades untouched — see §1.

---

## 3. Architecture

```
browser ──▶ https://noedis.org/              (static UI)
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

## 7b. The sign-in gate

The cockpit holds the board API key and can create work that spends real money, so
it is gated by its own session screen (`lib/auth.js`, `lib/login-page.js`).

- `GET /noedis/login` — the sign-in screen, self-contained so it needs no assets.
- `POST /noedis/login` — constant-time credential check, then a signed cookie.
- `GET|POST /noedis/logout` — clears the cookie; the bridge's **ODHLÁSIT SE** calls it.
- `/noedis/health` stays open so monitoring works without a session.

The cookie is an HMAC-signed payload (`{user, exp}`) keyed with
`NOEDIS_SESSION_SECRET`; there is no session store, so a restart cannot resurrect a
revoked token. Sign-in attempts are capped at 10 per 15 minutes per client.

**This replaced Caddy's HTTP basic auth.** Basic auth has no working sign-out — the
browser keeps replaying the credentials — so the header's ODHLÁSIT SE button could
never have ended a session. `deploy/deploy-command-center.sh` therefore strips
`NOEDIS_AUTH_USER` / `NOEDIS_AUTH_HASH` before calling `caddy-command-center.py`, and
the operator is prompted exactly once, by the cockpit.

**The gate fails open on purpose.** With no `NOEDIS_AUTH_PASS` (or
`NOEDIS_AUTH_PASS_HASH`) the cockpit is published unprotected rather than locking the
founder out; the boot log states which it is:

```
[noedis] Auth        : ON (user "noedis")
```

A 401 from the gate carries `X-Noedis-Auth: required`. Upstream Paperclip 401/403
responses are re-mapped to 502 by `sendError`, so a broken board key can never be
mistaken for an expired session.

---

## 7c. Hermes — the voice and WhatsApp brain

The CHAT stop carries a **CHAT | VOICE** switcher. CHAT is the original work
intake (create an issue for one agent). VOICE is a spoken loop with **Hermes
Agent** (Nous Research), the autonomous-agent framework installed on the same
VPS, and it is the same agent the founder can reach on WhatsApp.

```
WhatsApp (self-chat, +420 721 982 621)
        │  Baileys bridge, paired once by QR
        ▼
Hermes Agent (vpsadmin, ~/.hermes)          cockpit VOICE panel
  ├─ LLM    OpenRouter                        ├─ mic → Whisper (local) → text
  ├─ STT    faster-whisper, local, Czech       ├─ POST /noedis/api/voice/ask
  ├─ TTS    Edge TTS, cs-CZ-VlastaNeural       ├─ reply + Edge TTS audio
  ├─ API    127.0.0.1:8642, OpenAI-compatible  └─ APEX orb at /voice
  └─ skill  noedis-company → delegate.py
                    │  POST /noedis/api/voice/delegate  (bridge token)
                    ▼
        Paperclip issue assigned to NOE → NOE routes it on to CODY
```

**Why a model other than Hermes.** Every Hermes/Nous model on OpenRouter
(`hermes-4-405b`, `hermes-3-*`) reports `supported_parameters` without `tools`,
and an agent that cannot call tools cannot invoke the delegation skill, read a
file or run a command. The **framework** is Hermes; the **model** is
`~deepseek/deepseek-flash-latest` — the same family the company's Paperclip
policy already pins, and tool-capable. Change it in `deploy/.vps.env`
(`HERMES_MODEL_NAME`) and re-run `deploy/deploy-hermes.sh`.

**The hand-off.** Hermes decides when something is real work and calls
`~/.hermes/skills/noedis-company/delegate.py`, which POSTs to
`/noedis/api/voice/delegate`. That is the one route a local script may call
without a cockpit session: it is opened by `NOEDIS_BRIDGE_TOKEN`, compared in
constant time, and it does exactly one thing — create an issue for NOE and wake
him. Every hand-off appends a line to `/srv/noedis/logs/delegations.jsonl`, which
is how the VOICE panel can show "PŘEDÁNO" for the turn that produced it.

**The hop to CODY needs to be asked for.** NOE's canonical role is "posoudí každý
úkol a deleguje CODYmu", but in practice NOE *did the work itself* and closed the
task — twice, including after its prompt was given an explicit routing rule — so
nothing ever reached CODY. Asked for the sub-issue directly in the brief, it does
it reliably: it created `NOE-11` assigned to CODY with a brief CODY could act on,
and CODY delivered. The bridge therefore appends a short routing duty to every
brief it writes for NOE (`withRoutingDuty` in `lib/voice-api.js`). That keeps the
decision with NOE — the bridge only states the duty; NOE still writes the
sub-issue, chooses its wording and closes the parent — instead of hard-coding the
chain here.

Verified end to end: a plain task sent through the bridge produced a NOE parent
and a CODY child; NOE commented *"Předáno agentu CODY … Vytvořil jsem podúkol
NOE-11"*, and CODY returned measurements.

`deploy/reconcile-org.mjs --instructions-only` applies just the executive
prompts. Instructions are deliberately outside the normal drift check (rewriting
a prompt is a behaviour change, not a reconciliation), so without that flag a
corrected prompt never reaches an agent that already exists.

**Voice notes on WhatsApp** are transcribed by the same local Whisper, and TTS
replies go back as audio attachments — both are Hermes features, not ours.

**Web search and browsing.** Hermes carries the `web` and `browser` toolsets, both
enabled. They need the pinned Chromium that ships as the `agent-browser` tool, so
`deploy/deploy-hermes.sh` installs it explicitly — an earlier install had recorded
it as declined (`--skip-browser`) and that opt-out survives updates. Search itself
resolves through the provider chain in `tools/web_tools.py`; with no search key set
it lands on **`ddgs`** (DuckDuckGo), which is free and keyless. Set `EXA_API_KEY`,
`PARALLEL_API_KEY`, `FIRECRAWL_API_KEY`, `SEARXNG_URL` or `BRAVE_SEARCH_API_KEY` in
`~/.hermes/.env` to move it up that chain. Page reading and clicking need no key at
all.

Verified on the live agent: a browser turn opened `https://example.com` and read its
`H1`, and a search turn returned the day's EUR/CZK close — both without any search
credential.

**Deploying it.**

```bash
./deploy/deploy-hermes.sh     # install + configure + skill + gateway
./deploy/deploy-apex.sh       # the orb behind the VOICE panel
./deploy/deploy-command-center.sh
```

**Pairing WhatsApp** is the one step that needs a human. The QR rotates every
~20 s, so it is not something to paste into a chat: the VOICE panel renders it
live. `POST /noedis/api/voice/whatsapp/start` spawns Hermes' own bridge
(`--pair-only --pair-json`), the raw QR payload is kept in memory, and
`/noedis/api/voice/whatsapp/qr.png` serves it through `qrencode`. Scan it from
**WhatsApp → Settings → Linked devices → Link a device**; on success the cockpit
restarts the gateway so the session attaches, and the card disappears. The
session lives in `~/.hermes/platforms/whatsapp/session` — treat it as a
password.

**APEX-UI** (`RubenM1990/APEX-UI`, MIT) is the orb in the stage. It is a Next.js
15 app of its own, kept separate because the cockpit is plain ES modules. Two
changes were needed: `basePath: "/voice"` so one host and one gate cover it, and
a `postMessage` listener in `ApexWorld.tsx` so the orb follows the loop
(`idle → listening → thinking → speaking`) instead of only reacting to a tap.
Caddy routes `/voice` and `/voice/*` to it.

**Rollback**

```bash
systemctl --user stop hermes-gateway && systemctl --user disable hermes-gateway
sudo systemctl stop noedis-apex && sudo systemctl disable noedis-apex
# the cockpit keeps working; the VOICE panel simply reports Hermes as offline
```

---

## 8. Verifying

```bash
NOEDIS_AUTH_USER=noedis NOEDIS_AUTH_PASS=… \
  node command-center/test/smoke.mjs https://noedis.org
```

Drives a real browser against a real deployment and asserts 32 properties: that the
gate accepts the operator, that the bridge renders the `COMPANY` subtitle and a
sign-out control, the structure counters, the org tree, the seven departments of §4.1
and their heads, that each of the 21 specialists appears in exactly one team and no
head leaks into teams, the 24-row dashboard roster, the `pi_local` runtime readout,
the four INBOX categories, the chat dropdown, the ten GAMEPLAY floors in order, the
embedded Paperclip iframe, that the cockpit itself logs no console errors, and that
sign-out really ends the session. Screenshots land in `command-center/test/out/`.

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
| `NOEDIS_AUTH_USER` | — | operator name; the gate is off while unset |
| `NOEDIS_AUTH_PASS` | — | plaintext password, compared in constant time |
| `NOEDIS_AUTH_PASS_HASH` | — | scrypt `salt:hash` alternative to `NOEDIS_AUTH_PASS` |
| `NOEDIS_SESSION_SECRET` | per-boot random | cookie signing key; without it a restart signs everyone out |
| `NOEDIS_SESSION_HOURS` | `12` | session lifetime |
| `HERMES_API_URL` | `http://127.0.0.1:8642` | Hermes' OpenAI-compatible API server |
| `HERMES_API_KEY` | — | bearer token for that server (shared with Hermes) |
| `HERMES_MODEL` | `hermes-agent` | the model name the API server advertises |
| `HERMES_CLI` | `~/.local/bin/hermes` | the Hermes launcher (gateway restarts, diagnostics) |
| `HERMES_VOICE_LANG` | `cs` | language handed to Whisper |
| `HERMES_TTS_VOICE` | `cs-CZ-VlastaNeural` | Edge TTS voice for spoken replies |
| `NOEDIS_NOE_AGENT_ID` | NOE's UUID | who every delegated task is addressed to |
| `NOEDIS_BRIDGE_TOKEN` | — | lets the Hermes skill open `/noedis/api/voice/delegate` without a session |
| `NOEDIS_DELEGATION_LOG` | `/srv/noedis/logs/delegations.jsonl` | one JSON line per hand-off |
| `WHATSAPP_BRIDGE_DIR` | Hermes' `scripts/whatsapp-bridge` | where the Baileys bridge lives |
| `WHATSAPP_SESSION_DIR` | `~/.hermes/platforms/whatsapp/session` | the paired session (**treat as a password**) |

`command-center/.env` is git-ignored and holds the board key and the operator
password in production; `deploy/.vps.env` (also git-ignored) holds the values the
deploy script writes into it. Note that **the board key is still a weak,
human-chosen default** — rotating it is worthwhile, but it must be rotated in
Paperclip and `command-center/.env` together. It is deliberately not reproduced in
this repository.

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
