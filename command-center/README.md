# NOEDIS Command Center v0.3.0

**PAPERCLIP · GAMEPLAY · DASHBOARD**

Autonomous agent company command center for the NOEDIS ecosystem. Three views in one interface — Paperclip orchestration, pixel-art station gameplay, and real-time dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  NOEDIS Command Center (port 3200)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐      │
│  │  PAPERCLIP  │  │  GAMEPLAY   │  │  DASHBOARD    │      │
│  │  (iframe)   │  │  (canvas)   │  │  (metrics)    │      │
│  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘      │
│         │                │                 │              │
│         └────────────────┼─────────────────┘              │
│                          │                                │
│                  ┌───────┴────────┐                       │
│                  │  Node.js Server │                       │
│                  │  API Proxy + WS │                       │
│                  └───────┬────────┘                       │
│                          │                                │
│                  ┌───────┴────────┐                       │
│                  │  Paperclip API  │                       │
│                  │  127.0.0.1:3100 │                       │
│                  └────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd /var/home/plantyy/Projects/noedis-org/command-center

# Install dependencies
npm install

# Start manually
node server.js

# Or use the start script
./start.sh
```

**Open:** `http://127.0.0.1:3200`

## Views

### PAPERCLIP
Direct iframe integration with the Paperclip orchestration UI. Full access to:
- Company management
- Agent recruitment and management
- Issue tracking
- Approval workflows
- Everything Paperclip offers

### GAMEPLAY
StarNet-inspired pixel-art space station visualization:
- **Station Map**: Top-down pixel station with department rooms (USER, TECHNOLOGY, GAME & ECONOMY, CREATIVE, etc.)
- **Corridors with data pulses**: Animated data packets flowing when agents are active
- **CREW Rail**: Real-time agent list with status badges
- **Agent Dots**: Pulsing dots on the map showing agent positions and activity
- **HUD**: Station status indicator

### DASHBOARD
Real-time command center with:
- Agent metrics (active, running, paused, error)
- Task tracking (open, in progress, blocked, done)
- Cost monitoring (spend, budget, utilization)
- Pending items (approvals, incidents)
- Company info (status, prefix, created)
- Agent roster table
- Organization chart (full NOEDIS hierarchy from MASTER v0.3.0)

## Real-time Updates

- WebSocket connection for instant dashboard updates
- 4-second polling fallback for dashboard metrics
- 8-second polling for agent list
- Automatic reconnection with 3-second delay
- Uplink status indicator in top navigation bar

## NOEDIS Company Structure

Pre-configured company: **Noedis** (ID: `66147035-...`)
Issue prefix: `NOE`

### Executive Board
- **NOE COMMAND** — Work intake and delegation
- **NOE REPORT** — Results channel and push notifications
- **WorkforceArchitect** — Dynamic agent instantiation

### Departments
| Department | Divisions |
|---|---|
| USER | Product & Journey, Experience & Accessibility, Community & Support |
| TECHNOLOGY | Application Engineering, Game Engineering, Platform Engineering, Security & Identity |
| GAME & ECONOMY | Game Design, Progression & Economy, World Systems & Live Ops |
| CREATIVE | Brand & Visual, 3D Art, Audio, Narrative & Content |
| MARKETING | Brand Communications, Growth |
| BUSINESS & FINANCE | Strategy & Monetization, Finance & Funding |
| LEGAL & COMPLIANCE | IP & Licensing, Privacy & Commercial |
| QUALITY & RELEASE | QA & Verification, Release & Change, Knowledge & Canon |
| LABS & RESEARCH | Agent & Automation R&D, Product & Technology Research |

### Reporting Chain
```
Specialist → Team Leader → Division Lead → Department Board → NOE COMMAND → NOE REPORT → Founder
```

Notifications: **DONE** | **DECISION** | **RISK** | **RELEASE**

## Runtime Invariant

All NOEDIS AI agents use:
```
Paperclip → pi_local → Pi coding agent → OpenRouter
```

- **OpenRouter** is the single AI provider gateway
- **Pi** is the only agent runtime
- No Codex CLI, Claude Code, or OpenCode for NOEDIS orchestration

## System Service

To run as a persistent systemd user service:

```bash
# Copy the service file
cp /var/home/plantyy/Projects/noedis-org/command-center/noedis-command-center.service ~/.config/systemd/user/

# Enable and start
systemctl --user daemon-reload
systemctl --user enable noedis-command-center
systemctl --user start noedis-command-center

# Check status
systemctl --user status noedis-command-center

# View logs
journalctl --user -u noedis-command-center -f
```

## VPS Workspace Structure

```
/srv/noedis/
├── workspaces/    # Agent workspaces (isolated per agent)
├── artifacts/     # Completed work output
├── company/       # Company configuration
└── backups/       # Backup storage
```

## Configuration

Environment variables (or edit `server.js`):

| Variable | Default | Description |
|---|---|---|
| `NOEDIS_PORT` | `3200` | Command center HTTP port |
| `PAPERCLIP_URL` | `http://127.0.0.1:3100` | Paperclip server URL |
| `NOEDIS_COMPANY_ID` | `66147035-...` | Paperclip company UUID |

## Credentials Needed

| Credential | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | AI model access for Pi agents |
| GitHub PAT | Repository operations |
| Cloudflare API Token | DNS / edge / CDN |
| ntfy credentials | Mobile push notifications |

## Deployment Status

- [x] Paperclip running on `http://127.0.0.1:3100`
- [x] Pi coding agent installed (v0.85.1)
- [x] NOEDIS company created in Paperclip
- [x] VPS workspace structure created
- [x] Command Center built (PAPERCLIP | GAMEPLAY | DASHBOARD)
- [x] WebSocket real-time updates
- [x] Dashboard with agent/task/cost metrics
- [x] Pixel-art station visualization
- [ ] OpenRouter API key configuration (needs your input)
- [ ] GitHub credential setup
- [ ] Cloudflare + noedis.org DNS
- [ ] ntfy push notifications

---

*Generated from NOEDIS Autonomous Company OS — MASTER v0.3.0*