# NOEDIS Command Center — MASTER SUMMARY

**Datum:** 2026-09-26  
**Projekt:** NOEDIS Autonomous Company System  
**Repozitář:** `noedis-org/`

---

## 1. CO JSME ŘEŠILI

Cílem bylo **přepracovat GAMEPLAY view** v NOEDIS Command Center — nahradit původní 2D Canvas renderer moderním **Three.js 3D isometrickým prostředím**, které kombinuje inspiraci ze čtyř zdrojů:

| Zdroj | Popis | Co jsme si vzali |
|---|---|---|
| **Původní NOEDIS** (`noedis-org`) | 2D isometrická budova s patry, agent data z Paperclip API | Struktura pater (7 pater: EXECUTIVE … LEGAL + QA), firemní API, crew rail |
| **harishkotra/agent-office** | Pixel-art office s Phaser.js, Colyseus real-time, agenti co chodí, mluví, najímají | Inspirace pro agent figurky a status lighty |
| **ajsahni/agents-office** | 3D isometrický office s Three.js, 35 agentů, 6 departmentů | Použití Three.js, floor switching, click-to-chat koncept |
| **bagidea/bagidea-office** | Godot 2.5D wallpaper office, komplexní plugin systém | Hierarchické linky, ambientní částice, vizuální polish |

---

## 2. STRUKTURA PROJEKTU (relevantní část)

```
noedis-org/
├── command-center/
│   ├── server.js                              # Express server + API proxy + WebSocket
│   ├── noedis-isometric.js                    # ★ PŮVODNÍ (zachován, ale nepoužíván)
│   ├── public/
│   │   ├── index.html                         # Hlavní HTML s importmap pro Three.js
│   │   ├── css/style.css                      # Kompletní CSS (původní + nové styly)
│   │   ├── js/
│   │   │   ├── app.js                         # Hlavní JS (tab navigace, data, Three.js init)
│   │   │   └── three-gameplay.js              # ★ NOVÝ: Three.js 3D isometrický engine
│   │   └── assets/
│   └── config/
│       └── org-blueprint.yaml
├── catalog/divisions.yaml
├── docs/INDEX.md
├── NOEDIS_AUTONOMOUS_COMPANY_MASTER_v0.3.0.md
└── PROMPT_VPS_AGENT_NOEDIS_COMPANY_OS_v0.3.0.md
```

---

## 3. CO JSME VYTVOŘILI — DETIALNĚ

### 3.1. `three-gameplay.js` — Hlavní herní engine

**Umístění:** `command-center/public/js/three-gameplay.js`  
**Velikost:** ~940 řádků  
**Technologie:** Three.js r170 (ESM modul z CDN přes importmap)  
**Typ kamery:** Orthographic (isometrický pohled)  
**Render:** WebGL s antialiasing, ACES filmic tone mapping, shadow map (2048px)

#### 🏗️ Building

- 7 pater, každé ve výšce `y = i × 3.2`
- Každé patro má:
  - **Platformu** — `BoxGeometry(8, 0.08, 6)` — transparentní (25 %) s `MeshPhysicalMaterial` (roughness 0.3, metalness 0.6, clearcoat 0.3)
  - **Border glow** — `EdgesGeometry` s `LineBasicMaterial` (60 % opacita)
  - **Skleněné stěny** — 3 ks `PlaneGeometry` s 8% opacitou, oboustranné
  - **Štítek patra** — `Sprite` z canvas textury s názvem patra
  - **Agenti** — dle přiřazení (`getAgentFloor()`)
- **Výtahová šachta** vlevo — úzký sloupek s barevnými okénky
- **Grid** pod budovou — `GridHelper(30, 30)`

#### 🧑‍💼 Agent Figures

Každý agent je `Group` obsahující:

| Část | Geometrie | Materiál | Vlastnosti |
|---|---|---|---|
| Tělo | `CylinderGeometry(0.25, 0.3, 0.5, 8)` | `MeshPhysicalMaterial` | Emisivní podle statusu, castShadow |
| Hlava | `SphereGeometry(0.18, 12, 12)` | `MeshPhysicalMaterial` | `#ddddff`, castShadow |
| Glow ring | `RingGeometry(0.35, 0.45, 24)` | `MeshBasicMaterial` | 40 % opacita, pod nohama |
| Status light | `SphereGeometry(0.06, 8, 8)` | `MeshBasicMaterial` | Pulsuje podle statusu |
| Jméno | `Sprite` (canvas) | `SpriteMaterial` | Žlutý text na černém pozadí |
| Role | `Sprite` (canvas) | `SpriteMaterial` | Menší, šedý text |
| Hit area | `CylinderGeometry(0.4, 0.4, 0.8, 8)` | Invisible (opacity 0) | Pro raycasting |

Barevné kódování statusu:
- `working/active/running` → **zelená** (`#33ff33`) — silný pulz
- `paused` → **oranžová** (`#ffb000`)
- `error/failed` → **červená** (`#ff4444`)
- `idle` → **šedá** (`#888888`)

#### 🔗 Hierarchy Lines

Catmull-Rom křivky (4 control points) spojující agenty napříč patry:
- Start: agent na vyšším patře
- Middle 1: nad budovou
- Middle 2: u agenta dole
- End: agent na nižším patře

Po každé křivce putuje **data dot** (`SphereGeometry(0.04)`) — animovaná tečka signalizující datový tok.

#### 🎨 Floor Switcher

Panel vpravo nahoře (CSS absolutní pozice, `right: 276px, top: 12px`):
- Každé patro má tlačítko s barevnou tečkou, názvem a číslem (`L0`–`L6`)
- Aktivní patro má zvýrazněný border barvou patra + glow shadow
- Lze přepínat i klávesami **šipka nahoru/dolu**

#### 💬 Chat Panel

UI overlay vpravo dole:
- Header s avatarem, jménem, rolí a tlačítkem zavřít
- Seznam zpráv s bublinami (user = žlutá, agent = tmavá)
- Loading animace (tři tečky)
- Input pole + send tlačítko

Chat volá `POST /noedis/api/chat` s `{agentId, message}`.

#### 🎞️ Animace

V `animate()` loop (requestAnimationFrame):

| Animace | Co dělá |
|---|---|
| Auto-rotate kamery | `targetAngle = PI/4 + sin(t × 0.03) × 0.1` |
| Floor transition | Kamera plynule sleduje `targetFloor × 3.2` |
| Agent bob | `sin(t × 0.8 + idx × 2) × 0.0005` |
| Status light pulse | Aktivní agenti: `sin(t × 3 + idx) × 0.3 + 0.7` |
| Data dots | Pohyb po křivkách (progress += delta × speed) |
| Částice | Pomalý vertikální drift |
| Floor glow | Aktivní patro: `0.35 + sin(t × 1.5) × 0.1` |

---

### 3.2. Úpravy v `app.js`

- **Odebrán starý 2D canvas renderer** (~170 řádků):
  - `renderLoop()`, `drawRoom()`, `getAgentPositions()`, `setupCanvas()`
- **Přidáno:**
  - `initThreeGameplay()` — dynamický import a inicializace Three.js
  - `updateCrewRail3d()` — crew rail pro 3D view (working/idle count)
  - `window.__selectThreeAgent()` — propojení crew railu s Three.js chatem
  - `window.__threeGameplayCleanup` — cleanup reference

### 3.3. Úpravy v `index.html`

```html
<!-- importmap pro Three.js ESM -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"
  }
}
</script>

<!-- GAMEPLAY view (nový) -->
<section id="view-gameplay" class="view">
  <div class="gameplay-layout-3d">
    <div class="three-view" id="three-container"></div>
    <aside class="crew-rail">
      <div class="crew-head">...</div>
      <div id="crew-list-3d" class="crew-list"></div>
    </aside>
  </div>
</section>

<!-- Three.js modul -->
<script type="module" src="js/three-gameplay.js"></script>
```

### 3.4. Úpravy v `server.js`

**Přidán endpoint** `POST /noedis/api/chat`:

```js
app.post('/noedis/api/chat', express.json(), async (req, res) => {
  const { agentId, message } = req.body;
  // 1. Zkusí forward na Paperclip:
  fetch(`${PAPERCLIP}/api/companies/${COMPANY_ID}/agents/${agentId}/chat`, {...})
  // 2. Fallback (demo mód):
  res.json({ response: `[${agentName}]: I received: "${message}"` });
});
```

### 3.5. Nové CSS styly (~280 řádků)

| Selektor | Účel |
|---|---|
| `.gameplay-layout-3d` | Flex layout (3D scéna + crew rail) |
| `.three-view` | Kontejner pro Three.js canvas |
| `#floor-switcher` | Vertikální panel pater |
| `.floor-btn` / `.active` | Tlačítka pater |
| `.chat-panel` | Chatovací overlay |
| `.chat-message` / `.msg-bubble` | Zprávy |
| `.thinking` | Loading animace (tři tečky) |
| `.hierarchy-label` | Tooltip |
| `@media (max-width: 768px)` | Responzivní úpravy |

---

## 4. ARCHITEKTURA THREE.JS SCÉNY

```
Scene
├── AmbientLight (0x222244, 0.6)
├── HemisphereLight (0x4466ff/0x222244, 0.8)
├── DirectionalLight (0xffeedd, 2.5) + shadow map 2048px
├── FillLight (0x8888ff, 0.6)
├── RimLight (0x00ffaa, 0.4)
├── Ground (PlaneGeometry 40×40, #0a0a14, receiveShadow)
├── GridHelper (30×30, #222244 / #111833)
├── Fog (0x0a0a0f, near=30, far=60)
│
├── [buildingGroup]
│   ├── [floorGroup × 7] (y = 0, 3.2, 6.4, … 19.2)
│   │   ├── Platform (Box 8×0.08×6, MeshPhysicalMaterial, transparent)
│   │   ├── Border (EdgesGeometry, LineBasicMaterial)
│   │   ├── Wall × 3 (PlaneGeometry, MeshPhysicalMaterial, 8%)
│   │   ├── Label (Sprite, canvas text)
│   │   └── [AgentGroup × N]
│   │       ├── Body (Cylinder 0.25×0.3×0.5)
│   │       ├── Head (Sphere 0.18)
│   │       ├── GlowRing (Ring 0.35–0.45)
│   │       ├── StatusLight (Sphere 0.06, pulsing)
│   │       ├── NameSprite (Sprite)
│   │       ├── RoleSprite (Sprite)
│   │       └── HitMesh (Cylinder, invisible)
│   ├── ElevatorCore (Box 0.3×22.4×0.3)
│   ├── [HierarchyLine × N] (CatmullRomCurve3 + Line)
│   └── [DataDot × N] (Sphere 0.04, animated)
│
└── [AmbientParticles]
    └── Points (200 vertices, vertex colors, additive blending)
```

---

## 5. KLÍČOVÉ FUNKCE

### `initThreeGameplay(container, agentsData)`
Hlavní vstupní bod. Vytvoří scénu, kameru, renderer, světla, budovu, agenty, UI.

### `buildBuilding()`
Postaví všech 7 pater — pro každé zavolá `createFloor()` interně, přidá core, zavolá `buildHierarchyLines()`.

### `createAgentMesh(agent, floorIdx)`
Vytvoří Group s geometriemi agenta (tělo, hlava, ring, light, sprites, hit area).

### `createTextSprite(text, color)`
Canvas 256×64 → `CanvasTexture` → `SpriteMaterial` → `Sprite`.

### `buildHierarchyLines()`
Pro každé patro (kromě 0) — spojí agenty s agenty o patro níž Catmull-Rom křivkami, přidá data dots.

### `switchToFloor(index)`
Animovaný přechod kamery na zvolené patro. Nastaví `isTransitioning=true`, UI update.

### `openChat(agent)` / `closeChat()` / `sendChatMessage(text)`
Otevře/zavře chat panel, komunikuje s API.

### Events
- `onMouseDown` — raycasting hit area → `openChat()` nebo `closeChat()`
- `onMouseMove` — raycasting → kurzor pointer, highlight agenta
- `onWheel` — zoom (`targetCameraState.zoom *= 1.1/0.9`)
- `onKeyDown` — Escape = zavřít chat, šipky = přepnout patro
- `onResize` — update frustum + renderer size

---

## 6. BAREVNÉ SCHÉMA

### Patra

| Index | Název | HEX barva |
|---|---|---|
| 0 | EXECUTIVE | `#ffb000` |
| 1 | USER | `#33ddff` |
| 2 | TECHNOLOGY | `#33ff33` |
| 3 | GAME & ECONOMY | `#aa66ff` |
| 4 | CREATIVE | `#ff66aa` |
| 5 | MARKETING + BIZ | `#ff8800` |
| 6 | LEGAL + QA | `#4488ff` |

### Status agentů

| Status | Barva | Efekt |
|---|---|---|
| `working` / `active` / `running` | `#33ff33` | Silný pulz, glow |
| `paused` | `#ffb000` | Mírný glow |
| `error` / `failed` | `#ff4444` | Silný pulz, glow |
| `idle` | `#888888` | Minimální glow |

### UI theme (CSS proměnné)

| Proměnná | Hodnota |
|---|---|
| `--bg-deep` | `#0a0a0f` |
| `--bg-panel` | `#0f0f17` |
| `--bg-card` | `#13131e` |
| `--border` | `#1e1e3a` |
| `--ph-amber` | `#ffb000` |
| `--ph-green` | `#00ff88` |
| `--ph-red` | `#ff3355` |
| `--ph-text` | `#c8c8d4` |

---

## 7. API ENDPOINTY

| Endpoint | Metoda | Účel |
|---|---|---|
| `/noedis/api/agents` | GET | Seznam všech agentů |
| `/noedis/api/chat` | POST | Odeslání zprávy agentovi |
| `/noedis/api/dashboard` | GET | Dashboard data |
| `/noedis/api/company` | GET | Informace o firmě |
| `/noedis/health` | GET | Health check |
| `/noedis/ws` | WS | WebSocket live eventy |

---

## 8. HERARCHIE SOUBORŮ — CO NA CO NAVAZUJE

```
index.html
  ├── importmap → three.module.js (CDN)
  ├── css/style.css
  ├── js/app.js (IIFE)
  │     └── initThreeGameplay() → dynamic import
  │           └── js/three-gameplay.js (ESM module)
  │                 └── import THREE from 'three'
  └── js/three-gameplay.js (type="module")
        └── window.__threeOpenChat() — globální API pro app.js
```

---

## 9. CO LZE DÁLE ROZŠIŘOVAT (priority)

### 🟢 Nízká náročnost
1. **Agent animace** — chůze / mávání / práce u stolu (tweening)
2. **Reálná data z Paperclipu** — napojit chat na skutečné AI agenty
3. **Více agentů na patro** — dynamické grid rozložení

### 🟡 Střední náročnost
4. **Kvalitnější 3D modely (GLTF)** — místo primitiv (válec + koule)
5. **Minimapa** — malý přehled budovy v rohu
6. **Zoom to agent** — dvojklik → kamera přiblíží
7. **Sound FX** — ambient, notifikace
8. **Particle efekty** — při změně statusu, odeslání zprávy

### 🔴 Vyšší náročnost
9. **Multi-building** — více budov v campusu
10. **Timeline / replay** — přehrávání historie agent aktivit
11. **Drag & drop agentů** — přesouvání mezi patry
12. **Fullscreen mód** + screenshot export

---

## 10. TECHNICKÉ POZNÁMKY

### Dependency
- **Runtime:** Express 4.18, http-proxy-middleware 3.0, ws 8.16
- **Frontend:** Three.js r170 (CDN, ESM)
- **Fonty:** VT323 (display), JetBrains Mono (code), Inter (UI)

### Limity / TODO
- `onResize()` je volán v každém framu — throttlovat pro produkci
- Chat fallback (když Paperclip nedostupný) vrací mock odpověď
- Textury se vytvářejí canvasem — otestovat češtinu
- Raycasting přes průhledné hit arey — při 50+ agentech může být pomalejší
- Při přepnutí tabu se Three.js scéna nerestartuje (pouze schová/zobrazí)
- `cameraState.zoom` není omezen — zoom in/out bez limitu

---

## 11. HISTORIE ZMĚN

| Datum | Soubor | Změna |
|---|---|---|
| 2026-09-26 | `js/three-gameplay.js` | **Vytvořen** — kompletní Three.js engine |
| 2026-09-26 | `js/app.js` | Odebrán 2D canvas, přidán Three.js init |
| 2026-09-26 | `index.html` | Přidán importmap, Three.js modul, nový gameplay view |
| 2026-09-26 | `server.js` | Přidán `/noedis/api/chat` endpoint |
| 2026-09-26 | `css/style.css` | Přidány styly pro 3D layout, floor switcher, chat |
| 2026-09-26 | `docs/MASTER.md` | **Vytvořen** — tento dokument |

---

*Dokument vytvořen 2026-09-26 jako souhrn implementace Three.js isometrického gameplaye pro NOEDIS Command Center. Pokrývá vše od architektury přes detaily implementace až po další možnosti rozšíření.*