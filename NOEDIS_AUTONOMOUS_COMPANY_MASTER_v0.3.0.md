# NOEDIS Autonomous Company OS — MASTER v0.3.0

## 1. Goal

Create a self-hosted autonomous NOEDIS company on Paperclip where:

- the Founder is the human authority at the top;
- the Founder gives work only to **NOE COMMAND**;
- routine finished output comes only from **NOE REPORT**;
- the organization always follows **Department → Division → Team → Agents**;
- NOE COMMAND may request/instantiate missing organizational capability through WorkforceArchitect;
- agents run persistently from VPS workspaces but wake event-first instead of burning tokens continuously;
- **every AI agent runs through the Paperclip `pi_local` adapter using Pi coding agent**;
- **all Pi agents use OpenRouter as their model gateway through one shared `OPENROUTER_API_KEY`**;
- Codex CLI, Claude Code and OpenCode are not used as NOEDIS agent runtimes;
- GitHub/Cloudflare/notification credentials remain separate, least-privilege secrets;
- agents can use role-specific open-source tools such as Blender, FFmpeg and audio pipelines;
- repository/domain routing is explicit, never guessed.

## 2. Executive interface

```text
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

## 2.1 Company-wide AI runtime invariant

The organization structure may grow dynamically, but **the AI runtime may not drift**.

Every new Department, Division, Team or Specialist created by `WorkforceArchitect` must inherit:

```yaml
adapterType: pi_local
provider: openrouter
credential: OPENROUTER_API_KEY
```

The exact Paperclip field names must be taken from the installed Paperclip version rather than guessed, but the resulting behavior must be equivalent.

`WorkforceArchitect` must reject or correct a generated agent definition that attempts to use Codex, Claude Code, OpenCode or another harness without explicit Founder authorization.

## 3. Full logical organization

- **USER** — Own product usefulness, user journeys, UX, accessibility, localization, support and feedback.
  - **Product & Journey** → Product Architecture, Onboarding & UX Research
  - **Experience & Accessibility** → UI & Interaction, Accessibility & Localization
  - **Community & Support** → Support & Feedback
- **TECHNOLOGY** — Own application engineering, game runtime, platform, infrastructure, security and delivery mechanics.
  - **Application Engineering** → Frontend & PWA, Backend & API, State & Economy Integration
  - **Game Engineering** → Gameplay Runtime, 3D Rendering & Physics, Asset Integration
  - **Platform Engineering** → DevOps & VPS, Cloudflare & Edge, GitHub & CI/CD
  - **Security & Identity** → Application Security, IAM & Secrets
- **GAME & ECONOMY** — Own gameplay rules, progression, NOEDIS economy, balancing, world systems and live game design.
  - **Game Design** → Core Mechanics, Combat & Defence
  - **Progression & Economy** → Token & Credit Economy, Progression, Balance & Simulation
  - **World Systems & Live Ops** → Atlas & Citadel Systems, Live Ops & Content
- **CREATIVE** — Own visual identity, 2D/3D assets, technical art, music, SFX, narrative and product-facing content.
  - **Brand & Visual** → Brand & Design System, 2D Assets & Illustration
  - **3D Art** → Blender Environments & Props, Technical Art & Optimization
  - **Audio** → Music, SFX & Mix
  - **Narrative & Content** → World, Lore & UX Copy
- **MARKETING** — Own external communication, campaigns, social presence, growth, content discovery and partnerships.
  - **Brand Communications** → Campaigns, Social & PR
  - **Growth** → SEO & Content, CRM, Acquisition & Partnerships
- **BUSINESS & FINANCE** — Own business model, monetization, package design, budgets, forecasts, funding and unit economics.
  - **Strategy & Monetization** → Pricing & Packages, Business Model & Unit Economics
  - **Finance & Funding** → Budget & Forecast, Funding & Investor Materials
- **LEGAL & COMPLIANCE** — Own legal research, IP, licensing, privacy, terms, contracts and compliance escalation.
  - **IP & Licensing** → Trademark, Domain & IP, Open Source & Asset Licensing
  - **Privacy & Commercial** → Privacy, GDPR & Terms, Contracts & Compliance Risk
- **QUALITY & RELEASE** — Independently verify correctness, performance, accessibility, releases, documentation and source-of-truth integrity.
  - **QA & Verification** → Automation & E2E, Performance & Accessibility QA
  - **Release & Change** → Release Management & Deployment Verification
  - **Knowledge & Canon** → Spec & Decision Governance, Technical Documentation
- **LABS & RESEARCH** — Explore experimental technologies, agent systems and prototypes without silently changing production canon.
  - **Agent & Automation R&D** → Agent Systems & Skills
  - **Product & Technology Research** → Experimental Prototypes & Technology Scouting

## 4. Why lazy instantiation

The full company structure exists in `config/org-blueprint.yaml` and `catalog/`.
Only executive/Department Board agents need to exist from bootstrap.
A Division/Team can be installed when work first requires it.

Benefits:
- lower cost;
- smaller live org chart;
- specialists are created with the correct tools for the actual task;
- NOE COMMAND can expand the company without asking the Founder to manually configure every agent.

## 5. Reporting law

```text
Specialist
  ↓ evidence
Team Leader
  ↓ accepted team result
Division Lead
  ↓ division result
Department Board
  ↓ department result / escalation
NOE COMMAND
  ↓ finished package
NOE REPORT
  ↓
Founder
```

Founder notifications are only DONE / DECISION / RISK / RELEASE.

## 6. Example cross-department job

For a gameplay mechanic requiring assets:
- GAME & ECONOMY defines mechanic/balance;
- USER validates controls/journey;
- CREATIVE makes 2D/3D/audio assets;
- TECHNOLOGY integrates runtime and repo changes;
- QUALITY & RELEASE independently verifies and deploys;
- NOE REPORT returns one finished result.

## 7. Source-of-truth law

All product work uses the source hierarchy embedded in `noedis-source-of-truth`.
Open questions are STOP conditions, not invitations to improvise.

## 8. Tool model

Paperclip orchestrates work; it does not replace creative/engineering executables.
Use `docs/OPEN-SOURCE-TOOLCHAIN.md` and `config/tool-profiles.yaml`.

## 9. Mandatory AI runtime — Pi + OpenRouter

This is a **company-wide invariant**.

```text
Paperclip
   ↓
pi_local adapter
   ↓
Pi coding agent
   ↓
OpenRouter
   ↓
approved tool-capable model
```

### Runtime rules

1. **Every NOEDIS AI agent uses Pi (`pi_local`).**
2. **Every Pi agent uses OpenRouter.**
3. All agents consume one shared Paperclip-managed secret:
   - `OPENROUTER_API_KEY`
4. Do **not** configure NOEDIS agents with:
   - `codex_local`
   - `claude_local`
   - `opencode_local`
   - Gemini or another runtime adapter
   unless the Founder later explicitly changes this company invariant.
5. Do not install Codex CLI or Claude Code merely for NOEDIS orchestration.
6. Pi skills/extensions/packages may be added per role without changing the runtime standard.
7. The model is a separate policy from the runtime:
   - runtime = always Pi;
   - provider gateway = always OpenRouter;
   - model = selected from approved tool-capable OpenRouter models.
8. The OpenRouter model must not be silently changed by an individual worker. Model policy is controlled centrally.
9. The deployment must support a default company model plus optional manager/specialist model overrides through Paperclip configuration, while still using the same OpenRouter API key.

### Founder credential experience

The intended bootstrap is:

1. deployment agent gives the Founder `https://noedis.org`;
2. Founder claims the Paperclip account;
3. Founder enters **one `OPENROUTER_API_KEY` once**;
4. the key is stored as a Paperclip Connection/Secret;
5. all approved Pi agents reference that secret;
6. no plaintext copy of the key is placed into agent instructions, repositories, `.md` files or shell history.

### Important separation

```text
OPENROUTER_API_KEY = model access for Pi agents

GitHub credential     = repository operations
Cloudflare credential = DNS / edge / deployment operations
ntfy credential       = mobile push
```

The OpenRouter key does not replace external service credentials. Those remain separately scoped operational identities.

### Pi workspace model

Each Pi invocation starts in the workspace assigned to the Paperclip project/agent.
Pi may use its normal file/shell tools only inside the effective runtime confinement defined for that agent.

Paperclip organization/instructions alone are **not** treated as a filesystem security boundary.

## 10. Mobile

- Input: Paperclip Agent Chat with NOE COMMAND from mobile browser; phone dictation is enough for voice.
- Output: ntfy push from NOE REPORT.
- Optional later: Paperclip Telegram connector, which adds a separate bot credential.

## 11. VPS

Paperclip stays online on the VPS. Agents are not continuous daemons by default; they wake on assignment/chat/automation and use persistent workspaces. This is cheaper and safer than keeping every model session permanently running.

## 12. Deployment

Give `deploy/AGENT-INSTALL-PROMPT.md` plus this package to the VPS deployment agent.

Do not consider deployment complete until the agent returns a working HTTPS URL, Founder bootstrap, shared-model-key insertion point, push path and smoke-test evidence.
