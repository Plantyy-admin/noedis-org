# VOICE + APEX orb — mluvený příkaz, který se opravdu dostane k agentům

**Datum:** 2026-09-28
**Stav:** hotovo, nasazeno na noedis.org a ověřeno
**Dotyčené části:** `command-center/` (cockpit), `apex-orb/` (orb za panelem VOICE)

---

## 1 · Co je špatně dnes

Panel VOICE v kokpitu má kolem sebe tři samostatné problémy, které dohromady
vypadají jako „mluvím a nic se neděje".

1. **Předání úkolu je na milosti modelu.** Řetěz je
   `mikrofon → /voice/transcribe → /voice/ask → Hermes → skill noedis-company →
   delegate.py → /voice/delegate → Paperclip`.
   Poslední krok se stane jen tehdy, když se Hermes *sám rozhodne* skill zavolat.
   Když usoudí, že odpoví sám, úkol nevznikne a nikde to není vidět. V logu
   kokpitu je 7 předání, ale jen 1 úspěšný přepis z mikrofonu — poměr, který
   přesně tuhle nespolehlivost ukazuje.

2. **Nedá se cílit.** Všechno jde na NOE. Neexistuje „Cody, připrav nabídku".
   `/voice/ask` bere jen `{ text }`.

3. **Orb je cizí grafika s placeholdery.** Apex orb je klon
   `RubenM1990/APEX-UI`: zlatá `#f5a623`, anglické labely a kolem orbu
   vymyšlení agenti (`CRM`, `Marketing`, `Calendar`, `Drive`…). Stavy zná jen
   `idle / thinking / speaking`; `listening` se v `ApexWorld` mapuje na
   `thinking`, takže barva pro „mluvím já" vůbec neexistuje. Kolečka jsou
   dekorace, ne stav firmy.

## 2 · Rozhodnutí zadavatele

| Otázka | Volba |
|---|---|
| Rozsah | upravit v repu **a nasadit** na VPS |
| Cílení hlasem | podle jména v řeči, jinak NOE |
| Kolečka kolem orbu | vedení (NOE, CODY, RENE) + 7 šéfů oddělení, živě z Paperclipu |
| Režim mluvení | push-to-talk + automatický návrat do poslechu |

## 3 · Řešení

### 3.1 Cílení a spolehlivé předání

`/voice/ask` dostane dva vstupy: `text` a volitelný `targetAgentId` z UI.
Cíl se vyřeší v tomto pořadí:

1. `targetAgentId` z panelu (uživatel ho vybral),
2. jméno na začátku věty — „Cody, …", „NOE, …" — porovnané proti živému
   seznamu agentů (bez diakritiky, bez ohledu na velikost písmen),
3. jinak **NOE**.

Samotné předání pak **není na rozhodnutí modelu**. Kokpit pošle Hermesovi
jeden turn s adresářem agentů a s pevným kontraktem odpovědi:

```json
{ "say": "co mám říct nahlas", "task": { "title": "…", "brief": "…", "target": "CODY" } }
```

Když `task` přijde, **kokpit sám** založí issue v Paperclipu, probudí agenta a
zapíše řádek do `delegations.jsonl`. Když nepřijde, odpověď se jen přečte.
Tím je předání deterministické a pozorovatelné — a Hermesův vlastní skill
`noedis-company` zůstává pro Telegram a ostatní kanály beze změny.

Kdyby Hermes přesto skill zavolal sám, kokpit to pozná podle nového řádku
v delegačním logu a vlastní issue už nevytvoří (žádné duplikáty).

### 3.2 Panel VOICE

- řádek **KOMU** se seznamem cílů (NOE + všech 24 agentů, živě),
- po odpovědi se mikrofon sám vrátí do poslechu (lze vypnout),
- české labely místo anglických placeholderů,
- feed **PŘEDÁNO** — co komu odešlo a s jakým id,
- stav orbu se posílá i s tím, *kdo* je ve hře, aby se rozsvítilo správné kolečko.

### 3.3 Orb v barvách NOEDIS

Paleta se bere z `command-center/public/css/style.css` §00.

| Stav | Gradient | Význam |
|---|---|---|
| `idle` | cyan → violet, tlumený | pohotovost |
| `listening` | `#ff8737` → `#ff4d3d` → `#dd397b` | mluvím já |
| `thinking` | `#c8d6ea` → `#ffffff` → `#63dda8` | přemýšlí |
| `speaking` | `#4aa8ff` → `#7fe9ff` → `#b07cff` | mluví apex |
| `error` | `#dd397b` | chyba |

Stejný skin dostane SVG prstenec (`ApexOrb.jsx`), částicové jádro
(`ApexCore3D.jsx`), spodní status bar (`OrbStatusBar.jsx`) i pavučina
(`ReasoningWeb.jsx`) — `fire()` na ní rozsvítí uzel agenta, kterého se to týká.

### 3.4 Kolečka = skutečná firma

Konstelaice se staví z živého orgu Paperclipu:

```
              NOE (Senior Advisor)
             /                    \
     CODY (Right Hand)          RENE (Left Hand)
       ├── VÝVOJ, INFRA, IT, LEGAL,
       ├── LABS, MARKETING, FINANCE      ← 7 šéfů oddělení
```

Když fetch selže, použije se pevný záložní seznam (stejná jména a id), takže
orb nikdy nezůstane prázdný. Klik na kolečko otevře kartu agenta s jeho
titulem, oddělením a stavem — a nastaví ho jako cíl pro hlas.

Odstraňují se všechny placeholdery: `CRM`, `Marketing`, `Calendar`, `Email`,
`Drive`, `Analytics`, anglický hint v status baru, odkaz „View on GitHub"
a cizí social odkazy v overview panelu.

## 4 · Soubory

```
command-center/
  lib/agent-directory.js      NOVÝ  živý seznam agentů + párování jmen
  lib/voice-api.js            /agents, /delegations, přepsané /ask
  lib/hermes.js               chat() s adresářem a kontraktem odpovědi
  server.js                   zapojení adresáře a bridge guardu
  public/index.html           řádek KOMU, feed PŘEDÁNO
  public/js/voice.js          cílení, auto-listen, postMessage s akcí
  public/css/style.css        styly pro cíl a feed

apex-orb/                     NOVÝ  vendorovaný APEX-UI (bez .git)
  components/noedis-skin.ts   NOVÝ  paleta + stavové gradienty
  components/ApexOrb.jsx      skin místo zlaté
  components/ApexCore3D.jsx   skin místo zlaté/cyan
  components/OrbStatusBar.jsx NOEDIS barvy, české labely
  components/ReasoningWeb.jsx NOEDIS barvy, roster zvenčí
  components/ApexWorld.tsx    živý NOEDIS org, žádné placeholdery
  app/page.tsx, layout.tsx    branding, bez GitHub odkazu

deploy/deploy-apex.sh         nahrává apex-orb/ místo klonu z GitHubu
```

## 5 · Ověření

Vše proběhlo proti nasazenému stacku na VPS, ne proti mockům.

1. `node --check` na serveru, `next build` na orbu — čisté.
2. `npm test` v kokpitu — 23 asercí na párování oslovení a kontrakt
   s Hermesem, bez sítě.
3. Playwright na cockpit s nastubovaným API — panel se vykreslí, cíl jde
   vybrat, feed se naplní.
4. Playwright přes lokální náhradu Caddy proti VPS — **13/13**: přihlášení,
   živý roster (24 agentů, 7 šéfů oddělení), picker, orb s 10 kolečky
   a žádným placeholderem, klik na orb nastaví cíl, dotaz nevytvoří úkol,
   věta adresovaná CODYmu vytvoří issue přiřazené CODYmu a objeví se ve feedu.
5. Reálné audio: `edge_tts` → Whisper → `/ask` → issue `8b7100a2` na CODYm.
   Přepis vrátil „Kody" (foneticky), což vedlo k doplnění aliasů pro mluvená
   jména.
6. Bez zadavatele: „Vývoji, kolik máme otevřených úkolů?" → cíl VÝVOJ
   (Frontend Engineer), úkol žádný.
7. Latence jednoho hlasového tahu: 1,1–4,3 s.

Testovací issue (`886b6efa`, `09afd0b2`, `6e57ac58`, `8b7100a2`, `26e28edc`,
`c16984b3`, `df82a772`, `c5f260bc`) zůstávají na boardu ve stavu `done` —
Paperclip neumí issue mazat přes API.

## 6 · Co zůstalo otevřené

- **Nouzový režim:** kdyby model neposlal `task` u věty, která prací být měla,
  úkol nevznikne. Kokpit to pozná jen podle chybějícího řádku v logu; řešil
  by to až třetí krok (Heuristika „je to rozkaz?").
- **Zpětná vazba z boardu:** orb ukazuje, komu úkol odešel, ale ne už to,
  že ho agent dokončil. Data pro to jsou (`/noedis/api/issue`/`activity`),
  chybí napojení.

