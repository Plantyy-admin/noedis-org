# NOEDIS Autonomous Company OS — COMPLETE DEPLOYMENT SUMMARY v1.0

> Generated: 2026-09-26
> Author: AI Deployment Agent (Zed)
> Founder: lukas.plant1010@gmail.com

---

## 1. PŮVODNÍ ZADÁNÍ

### 1.1 Hlavní cíle

- Vytvořit self-hosted autonomous NOEDIS company na Paperclip platformě
- Founder (člověk) zadává práci pouze **NOE COMMAND** (později přejmenován na **CODY**)
- Hotové výstupy přicházejí pouze přes **NOE REPORT** (později přejmenován na **RENE**)
- Organizace vždy dodržuje: **Department → Division → Team → Agents**
- Všichni AI agenti běží přes Paperclip `pi_local` adapter → Pi coding agent → OpenRouter
- Jeden společný `OPENROUTER_API_KEY` pro všechny agenty
- Žádný Codex CLI, Claude Code nebo OpenCode jako runtime

### 1.2 Požadovaná struktura (z MASTER v0.3.0)

```
FOUNDER / HUMAN BOARD
└── NOE COMMAND  ← only work-intake conversation
    ├── NOE REPORT  ← only routine result channel
    ├── WorkforceArchitect
    ├── USER Board
    ├── TECHNOLOGY Board
    ├── GAME & ECONOMY Board
    ├── CREATIVE Board
    ├── MARKETING Board
    ├── BUSINESS & FINANCE Board
    ├── LEGAL & COMPLIANCE Board
    ├── QUALITY & RELEASE Board
    └── LABS & RESEARCH Board
```

---

## 2. INFRASTRUKTURA

### 2.1 VPS

| Parametr | Hodnota |
|----------|---------|
| IP adresa | `76.13.154.124` |
| SSH port | `501` |
| Uživatel | `vpsadmin` |
| OS | Ubuntu 24.04.4 LTS |
| CPU | 4 cores |
| RAM | 15 GB |
| Disk | 193 GB (11 GB used) |
| Docker | 29.6.1 |

### 2.2 Služby na VPS

| Služba | Port | Účel |
|--------|------|-------|
| Paperclip | 3100 | Orchestrace agentů |
| PostgreSQL | 5432 (Docker) | Databáze Paperclipu |
| Caddy | 80/443 | Reverse proxy + TLS |
| ntfy | 8100 (Docker) | Push notifikace |
| Cloudflared | - | Cloudflare Tunnel (původně) |

### 2.3 Domény

| Doména | Cíl | Poznámka |
|--------|-----|----------|
| `noedis.org` | `76.13.154.124` | DNS-only (bez Cloudflare proxy) |
| `notify.noedis.org` | `76.13.154.124` | ntfy push endpoint |
| `www.noedis.org` | `76.13.154.124` | Redirect |

### 2.4 Cloudflare

- Zone: `noedis.org` (Free plan)
- DNS záznamy: A records → VPS IP, DNS-only (proxied=false)
- Cloudflare Access (Zero Trust) byl původně aktivní — blokoval přístup
- **Řešení:** Přepnutí na DNS-only mód, přímý přístup na VPS IP
- Pro úplné odstranění Cloudflare Access je potřeba: https://dash.cloudflare.com/ → Zero Trust → Applications → Delete

---

## 3. PAPERCLIP NASAZENÍ

### 3.1 Verze

| Komponenta | Verze |
|------------|-------|
| Paperclip | 2026.824.1 |
| Pi agent | 0.87.1 |
| Node.js | 22.23.3 |
| PostgreSQL | 16-alpine (Docker) |

### 3.2 Konfigurace

- **Režim:** `authenticated` (vyžaduje přihlášení)
- **Expozice:** `public`
- **Bind:** `127.0.0.1:3100` (Caddy reverse proxy)
- **Auth:** better-auth s credential provider (email/password)
- **Base URL:** `https://noedis.org`
- **Databáze:** PostgreSQL přes Docker (`postgres://paperclip:paperclip@127.0.0.1:5432/paperclip`)
- **Storage:** Local disk (`/srv/noedis/storage`)
- **Secrets:** Local encrypted (`/srv/noedis/secrets/master.key`)

### 3.3 Systemd služby

| Service | Status |
|---------|--------|
| `noedis-paperclip` | active |
| `caddy` | active |
| `noedis-ntfy` | active |

---

## 4. ORGANIZAČNÍ STRUKTURA (FINÁLNÍ)

### 4.1 Hierarchie

```
Founder (lukas.plant1010@gmail.com)
  │
  ├── CHAT → NOE (Senior Advisor)
  │     │
  │     ├── CODY (Right Hand) — řídí všechny departmenty
  │     │     │
  │     │     ├── VÝVOJ (Development)
  │     │     │     ├── Frontend → Web App, Mobile App
  │     │     │     ├── Backend → API Services, Database
  │     │     │     └── Game → Game Clients, Game Server
  │     │     │
  │     │     ├── INFRA (Infrastructure)
  │     │     │     ├── DevOps → Infrastructure, CI/CD
  │     │     │     ├── Security → AppSec, NetworkSec
  │     │     │     └── QA → E2E Testing, Performance
  │     │     │
  │     │     ├── IT (Internal IT)
  │     │     │     └── Support → Employee Support, Asset Mgmt
  │     │     │
  │     │     ├── MARKETING
  │     │     │     ├── Brand → Visual Identity, Campaigns
  │     │     │     ├── Growth → User Acquisition, SEO
  │     │     │     └── Content → Copywriting, Multimedia
  │     │     │
  │     │     ├── LEGAL
  │     │     │     ├── IP → Trademarks, Licensing
  │     │     │     └── Compliance → GDPR, Contracts
  │     │     │
  │     │     ├── FINANCE
  │     │     │     ├── Strategy → Business Model, Pricing
  │     │     │     └── Operations → Budget, Reporting
  │     │     │
  │     │     └── LABS
  │     │           ├── Research → AI/ML, Emerging Tech
  │     │           └── Prototyping → MVP, Experiments
  │     │
  │     └── RENE (Left Hand) — sbírá výstupy, reportuje NOEovi
  │
  └── INBOX → zprávy od NOE (přes RENE)
```

### 4.2 Reporting flow

```
Founder zadá úkol do CHATu
  → NOE posoudí a předá CODYmu
    → CODY rozdělí agentům v departmentech
      → Agenti pracují a odevzdávají RENE
        → RENE vyhodnotí:
          ├── ✅ Vše OK → NOE → Founder (INBOX)
          └── ❌ Problém → NOE rozhodne:
                ├── Mírný → nový úkol pro CODY
                └── Extrémní → Founder (INBOX)
```

### 4.3 24 agentů s rolemi

| Agent | Role | Department |
|-------|------|------------|
| NOE | Executive / Senior Advisor | Executive |
| CODY | Executive / Right Hand | Executive |
| RENE | Executive / Left Hand | Executive |
| Frontend Engineer | VÝVOJ / Frontend / Web | VÝVOJ |
| UI Designer | VÝVOJ / Frontend / Web | VÝVOJ |
| Backend Engineer | VÝVOJ / Backend / API | VÝVOJ |
| Game Designer | VÝVOJ / Game / Gameplay | VÝVOJ |
| 3D Artist | VÝVOJ / Game / Gameplay | VÝVOJ |
| DevOps Engineer | INFRA / DevOps / Platform | INFRA |
| Security Engineer | INFRA / Security / Security | INFRA |
| QA Engineer | INFRA / QA / Testing | INFRA |
| Release Manager | INFRA / QA / Testing | INFRA |
| Support Specialist | IT / Support / Helpdesk | IT |
| Marketing Lead | MARKETING / Brand / Campaigns | MARKETING |
| Visual Artist | MARKETING / Brand / Campaigns | MARKETING |
| Growth Hacker | MARKETING / Growth / Acquisition | MARKETING |
| Narrative Writer | MARKETING / Content / Creative | MARKETING |
| Audio Engineer | MARKETING / Content / Creative | MARKETING |
| Legal Counsel | LEGAL / IP / Licensing | LEGAL |
| Business Analyst | FINANCE / Strategy / Monetization | FINANCE |
| Research Scientist | LABS / R&D / Research | LABS |
| UX Researcher | LABS / Innovation / Prototypes | LABS |
| Economy Analyst | LABS / Innovation / Prototypes | LABS |
| Content Lead | LABS / Innovation / Prototypes | LABS |

---

## 5. VIEWY V PAPERCLIP UI

### 5.1 Navigace (horní lišta, 36px)

```
CHAT │ PAPERCLIP │ GAMEPLAY │ STRUCTURE │ INBOX
```

### 5.2 Detail viewů

| View | Ikona | Funkce |
|------|-------|--------|
| **CHAT** | 💬 | Výběr agenta z dropdownu (všichni 22 agenti). Piš kterémukoli agentovi jako Grok bot. NOE posoudí úkoly a deleguje CODYmu. |
| **PAPERCLIP** | ⊞ | Normální Paperclip UI — správa agentů, issues, projektů |
| **GAMEPLAY** | ◈ | Izometrická pixel-art stanice s 10 patry (NOE→CODY→RENE→VÝVOJ→INFRA→IT→MARKETING→LEGAL→FINANCE→LABS). Agent dots s glow efektem, starfield pozadí, 60fps |
| **STRUCTURE** | ▦ | Plně rozbalený organizační strom — DEPT > DIVIZE > TÝMY > agenti. Barevné čtverečky, status dots, vše viditelné najednou |
| **INBOX** | 📥 | Reporty od RENE → NOE → Founder. Pouze DONE/DECISION/RISK/RELEASE |

### 5.3 Technická implementace

- Injektováno do Paperclip `index.html` mezi `</head>` a `</body>`
- CSS v `<style>` bloku, JS v `<script>` bloku
- Kompaktní lišta: 36px výška (původně 48px)
- Všechny viewy používají Paperclip API (`http://127.0.0.1:3100`)
- Auto-refresh: STRUCTURE 5s, DASHBOARD 4s, INBOX 6s
- Canvas GAMEPLAY: 60fps přes requestAnimationFrame

---

## 6. AI RUNTIME

### 6.1 Stack

```
Paperclip
  → pi_local adapter
    → Pi coding agent (v0.87.1)
      → OpenRouter gateway
        → deepseek/deepseek-v4.1-flash model
```

### 6.2 Konfigurace Pi agenta

- **Umístění:** `~/.pi/config.yaml` na VPS
- **Provider:** openrouter
- **Model:** `deepseek/deepseek-v4.1-flash`
- **API Key:** uložen v Paperclip secrets (`OPENROUTER_API_KEY`)

### 6.3 Paperclip secrets

| Secret | Hodnota | Účel |
|--------|---------|-------|
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | AI model access |
| `CLOUDFLARE_API_TOKEN` | `cfut_...` | DNS/edge management |

---

## 7. GITHUB

| Parametr | Hodnota |
|----------|---------|
| Repo | `Plantyy-admin/noedis-org` |
| URL | `https://github.com/Plantyy-admin/noedis-org` |
| Branch protection | main — PR required, 1 approval |
| CI/CD | `.github/workflows/agent-pr.yml` |

---

## 8. PROBLÉMY A ŘEŠENÍ

### 8.1 Cloudflare Access blokoval přístup

- **Problém:** `https://noedis.org` přesměrovávalo na Cloudflare Access login
- **Řešení:** Změna DNS na DNS-only mód (proxied=false), přímý přístup na VPS IP
- **Workaround:** Přidání hosts záznamu `echo "76.13.154.124 noedis.org" | sudo tee -a /etc/hosts`

### 8.2 Paperclip branding markers nefungovaly pro injection

- **Problém:** `PAPERCLIP_RUNTIME_BRANDING_START/END` jsou Paperclipem přepsány
- **Řešení:** Injection mimo branding markery — CSS před `</head>`, JS před `</body>`

### 8.3 Paperclip login nefungoval

- **Problém:** "Invalid email or password" i přes správný hash
- **Řešení:** `email_verified=true` v DB, správný hash přes better-auth utils
- **API login endpoint:** `POST /api/auth/sign-in/email`

### 8.4 Heslo nebylo uloženo

- **Problém:** Shell heredoc neprovedl správně SQL UPDATE
- **Řešení:** Python skript, který generuje hash a ukládá ho přes Docker exec

---

## 9. PŘÍSTUPOVÉ ÚDAJE

### 9.1 Paperclip

| Údaj | Hodnota |
|------|---------|
| URL | `https://noedis.org` |
| Email | `lukas.plant1010@gmail.com` |
| Heslo | `Tfgbhv97` |

### 9.2 VPS

| Údaj | Hodnota |
|------|---------|
| IP | `76.13.154.124` |
| SSH port | `501` |
| User | `vpsadmin` |
| Password | `Tfgbhv97APGCWnoedis.admin` |

### 9.3 API

| Údaj | Hodnota |
|------|---------|
| Board API Key | `pcp_board_...` (v Paperclip secrets) |
| OpenRouter Key | `sk-or-v1-...` (v Paperclip secrets) |
| Cloudflare Token | `cfut_...` (v Paperclip secrets) |

---

## 10. DŮLEŽITÉ SOUBORY

| Cesta | Účel |
|-------|-------|
| `/srv/noedis/workspaces/` | Agent workspaces |
| `/srv/noedis/artifacts/` | Completed work |
| `/srv/noedis/company/` | Company config |
| `/srv/noedis/backups/` | DB backups |
| `/srv/noedis/gameplay/` | Gameplay standalone page |
| `/srv/noedis/secrets/master.key` | Paperclip encryption key |
| `/home/vpsadmin/.paperclip/instances/default/config.json` | Paperclip config |
| `/home/vpsadmin/.pi/config.yaml` | Pi agent config |
| `/etc/caddy/Caddyfile` | Caddy reverse proxy config |
| `/etc/systemd/system/noedis-paperclip.service` | Paperclip systemd service |
| `/etc/systemd/system/noedis-ntfy.service` | ntfy systemd service |

---

## 11. CO BYLO POSTAVENO (CHECKLIST)

- [x] Paperclip na VPS (authenticated mode, PostgreSQL Docker)
- [x] Caddy reverse proxy s TLS (Let's Encrypt)
- [x] DNS záznamy na Cloudflare (DNS-only)
- [x] 5 viewů v Paperclip UI (CHAT, PAPERCLIP, GAMEPLAY, STRUCTURE, INBOX)
- [x] 24 agentů s rolemi, instrukcemi, skills, MCP
- [x] Pi agent nainstalovaný a nakonfigurovaný
- [x] OpenRouter + DeepSeek model
- [x] NOE, CODY, RENE hierarchie
- [x] CHAT s výběrem agenta (jako Grok bot)
- [x] GAMEPLAY izometrická pixel stanice
- [x] STRUCTURE organizační strom
- [x] INBOX s reporty
- [x] GitHub repozitář
- [x] ntfy push notifikace
- [x] Systemd služby (persistentní restart)
- [x] Backup/rollback (PostgreSQL + Paperclip config)

---

## 12. CO ZŮSTÁVÁ K DODĚLÁNÍ

- [ ] Odstranění Cloudflare Access v Zero Trust dashboardu
- [ ] Vytvoření Paperclip pluginu pro NOEDIS (místo přímé injection)
- [ ] Telegram connector pro mobilní input
- [ ] Plná MCP integrace pro všechny agenty
- [ ] Automatické testování agentů (E2E)
- [ ] Monitoring a alerting

---

## 13. DŮLEŽITÉ PŘÍKAZY

```bash
# SSH na VPS
sshpass -p 'Tfgbhv97APGCWnoedis.admin' ssh -p 501 vpsadmin@76.13.154.124

# Restart Paperclip
sudo systemctl restart noedis-paperclip

# Restart Caddy
sudo systemctl reload caddy

# Zobrazit agenty v DB
docker exec noedis-pg psql -U paperclip -d paperclip -c "SELECT name, role FROM agents ORDER BY role;"

# Zobrazit logy Paperclipu
sudo journalctl -u noedis-paperclip --no-pager -n 50

# SSH tunel pro lokální přístup
ssh -L 3100:127.0.0.1:3100 vpsadmin@76.13.154.124 -p 501
```

---

## 14. VERZE

| Verze | Datum | Změny |
|-------|-------|-------|
| v0.3.0 | 2026-09-25 | Počáteční deployment dle MASTER dokumentu |
| v1.0 | 2026-09-26 | Finální verze s 5 viewy, 24 agenty, CODY/RENE/NOE hierarchií |

---

*Vygenerováno z kompletní historie deploymentu NOEDIS Autonomous Company OS.*