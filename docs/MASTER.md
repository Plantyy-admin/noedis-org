# NOEDIS — MASTER BUSINESS LOGIC & BACKEND DOMAIN SPECIFICATION
## Canonical product logic for RIGHT / UP / DOWN, HOMESCREENS, FRAMEWORKS, NODES, TOTEMS, NP, CREDITS, SCORE, XP and subscription tiers

**Document status:** Canonical working specification  
**Version:** 1.0-draft  
**Language:** Czech  
**Primary purpose:** Jediný srozumitelný zdroj pravdy pro člověka i vývojového/AI agenta  
**Scope:** Business logika prostředí NOEDIS tak, jak byla společně vyjasněna v aktuální konverzaci  
**Criticality:** HIGH — tato logika má ovlivnit backend doménový model, stavové automaty, ekonomiku, telemetry, UI orchestration a další vývoj NOEDIS.

---

# 0. Jak tento dokument používat

Tento dokument je záměrně psán jako **produktová a backendová specifikace**, nikoli jako marketingový text.

Vývojový agent má tento dokument chápat jako:

1. **doménový model NOEDIS**,
2. **sadu invariantů, které se nesmí porušit**,
3. **návod, jak spolu komunikují jednotlivé obrazovky a ekonomiky**,
4. **zdroj terminologie**,
5. **základ pro API, databázi, eventy, stavové automaty a testy**,
6. **zdroj acceptance criteria pro MVP a další iterace**.

Pokud implementace narazí na nejasnost:

- nesmí svévolně spojovat mechanismy, které jsou zde výslovně oddělené,
- nesmí zavádět zkratky typu „Credit = Totem“ nebo „NODE = Framework“,
- nesmí zaměnit časový RIGHT mechanismus se spotřebním UP mechanismem,
- musí zachovat účetní a auditní oddělení všech ekonomických jednotek,
- pokud zde není pravidlo výslovně definované, má jej označit jako **OPEN DECISION**, nikoli si jej domyslet jako finální business rule.

---

# 1. Jedna věta, která vysvětluje NOEDIS

NOEDIS je prostředí, kde **reálný čas řídí dostupnost tematických Frameworků**, přítomnost v nich vytváří **Totemy**, vyvážená sada Totemů se převádí na **NP**, NP financují časově omezené používání konkrétních **NODE** v samostatné SUPER-APP vrstvě, spotřebované NP vytvářejí **Credits**, dokončené reálné činnosti vytvářejí **Score**, Score zvyšuje **XP/Level**, a Level + Credits společně odemykají a rozvíjejí herní svět v obrazovce DOWN.

Nejkratší ekonomicko-progresní formule:

```text
REAL TIME
→ HOMESCREEN
→ FRAMEWORK
→ TOTEM
→ NP
→ NODE
→ CREDIT

ACTIVATE
→ REAL-LIFE ACTION
→ COLLECT
→ SCORE
→ XP
→ LEVEL
→ GAME WORLD

CREDIT
→ CASH OUT CZK
nebo
→ INVEST INTO GAME WORLD
```

---

# 2. Hlavní architektura uživatelského prostředí

NOEDIS není jedna obrazovka s jedním dashboardem. Základní logika, kterou je nutné udržet, používá oddělené prostorové směry / obrazovky.

V této specifikaci jsou klíčové:

- **RIGHT** — časově řízený HOMESCREEN / FRAMEWORK prostor,
- **UP** — SUPER-APP, ve které se používají NODE za NP,
- **DOWN** — GAME / svět, kam proudí SCORE, XP, LEVEL a Credits,
- **LEFT / CORE** — není v této konverzaci dostatečně definován; agent jej nesmí svévolně doplnit.

Konceptuálně:

```text
                         UP
                    SUPER-APP
                       NODES
                         ▲
                         │
                         │
        LEFT  ◄──── USER / CORE ────► RIGHT
                         │          HOMESCREENS
                         │          FRAMEWORKS
                         │          TIME / TOTEMS
                         ▼
                       DOWN
                       GAME
                SCORE / XP / LEVEL
                   CREDIT SINK
```

## 2.1 Zásadní pravidlo oddělení obrazovek

Tyto vrstvy spolu komunikují, ale **nejsou stejný mechanismus**.

### RIGHT
Řeší:

- reálný čas,
- HOMESCREEN schedule,
- aktuálně dostupný Framework,
- UNLOCK,
- ACTIVATE,
- Totem generation,
- časovou vzácnost / motivaci zůstat nebo se vrátit.

### UP
Řeší:

- SUPER-APP,
- konkrétní NODE,
- časové session NODE,
- spotřebu NP,
- vznik Credits za spotřebované NP,
- používání funkcí, které byly dříve odemčeny.

### DOWN
Řeší:

- Score,
- XP,
- Level,
- gameplay,
- herní svět,
- investici Credits do světa,
- odemykání game content na základě achievementu + ekonomického rozhodnutí.

**Implementace nesmí například ukončit běžící NODE session jen proto, že se změnil HOMESCREEN na RIGHT.** Jedná se o dva rozdílné runtime mechanismy.

---

# 3. Klíčové doménové objekty

## 3.1 HOMESCREEN

HOMESCREEN (HS) je časově definovaná sekce hodinového cyklu NOEDIS.

Každý HS:

- má unikátní identitu,
- má vlastní časové okno,
- mapuje se na konkrétní Framework / experience,
- generuje vlastní typ Totemu,
- může mít vlastní Unlock / Activate / Collect obsah,
- je součástí podmínky pro konverzi Totemů na NP.

HOMESCREEN není totožný s NODE.

## 3.2 FRAMEWORK

FRAMEWORK je **tematické prostředí**, které je na RIGHT uživateli dostupné v době, kdy je aktivní jeho HOMESCREEN.

Framework může obsahovat:

- dashboardy,
- přehledy,
- data,
- kategorie,
- plánovací funkce,
- seznamy,
- odkazy na content,
- reprezentace NODE, které jsou později použitelné v UP,
- read-only variantu při Unlock,
- write variantu při Activate.

Framework je **širší kontext**, ne jednotlivá placená 3minutová aplikace.

## 3.3 NODE

NODE je individuální funkční jednotka / mini-aplikace / dashboard / nástroj uvnitř SUPER-APP vrstvy UP.

NODE:

- patří k určitému Frameworku nebo oblasti,
- je skutečně použitelný v UP,
- může být neviditelný, dokud jej uživatel neodemkne přes RIGHT,
- vyžaduje NP pro časový přístup,
- standardně používá 3minutový časový blok na 1 NP,
- je nezávislý na tom, jaký HS je právě aktivní na RIGHT.

Příklady konceptuálních NODE ve WORK Frameworku:

- Tasks,
- Projects,
- Income,
- Career,
- Jobs,
- AI Workspace.

Tyto příklady nejsou nutně finální taxonomie.

## 3.4 TOTEM

Totem je **časově specifická stopa přítomnosti uživatele v daném HOMESCREEN/FRAMEWORK okně**.

Každý Homescreen má svůj vlastní Totem.

Příklad:

```text
HS1_TOTEM
HS2_TOTEM
...
HS10_TOTEM
```

Totemy jsou surovina pro NP.

Totem není Credit.  
Totem není Score.  
Totem není peněžní jednotka.  
Totem není NODE access.

## 3.5 NP

NP je utility / access token.

Jeho role:

- vzniká konverzí vyváženého setu Totemů,
- reprezentuje možnost používat NODE,
- 1 NP financuje standardně 3 minuty jednoho NODE,
- jeho spotřeba je předpokladem vzniku jednoho Credit.

NP není Score.  
NP není přímá CZK měna.  
NP nevzniká koupí Creditů, pokud nebude později explicitně definováno jinak.

## 3.6 CREDIT

Credit je ekonomická jednotka NOEDIS.

Aktuální business intent:

```text
1 Credit ≈ 1 CZK hodnoty
```

Credit může vzniknout:

1. **earned** — za spotřebovaný NP při použití NODE,
2. **purchased** — nákupem v poměru 1 CZK = 1 Credit.

Uživatel může Credits:

- směnit zpět na CZK (cash-out; přesné podmínky jsou právně/finančně kritické a musí být samostatně definovány),
- nebo investovat do herního světa v DOWN.

Backend musí minimálně oddělovat:

```text
earned_credits
purchased_credits
```

a ve skutečnosti je vhodnější vést plný immutable ledger s typem původu.

## 3.7 SCORE

Score je **achievement hodnota**.

Vzniká z dokončených činností v COLLECT fázi.

Například:

- dokončený task,
- dokončený project,
- splněný goal,
- jiná ověřená nebo potvrzená dokončená aktivita.

Score nereprezentuje peníze ani čas.

## 3.8 XP / LEVEL

Score se promítá do XP/Level progression.

Navržený model prahů:

```text
Level 1 = 10 Score
Level 2 = 20 Score
Level 3 = 40 Score
Level 4 = 80 Score
Level 5 = 160 Score
...
```

Konceptuálně jde o exponenciální řadu:

```text
threshold(level) = 10 × 2^(level - 1)
```

**Open decision:** zda jsou hodnoty kumulativní prahy nebo cena jednotlivého přechodu. Preferovaný návrh této specifikace je chápat je jako **kumulativní threshold**, protože je jednodušší na audit a interpretaci.

---

# 4. Časový engine RIGHT — 60minutový cyklus

NOEDIS používá hodinový cyklus, ve kterém je vždy aktivní konkrétní HOMESCREEN a jeho Framework.

Podle aktuálního schématu:

| HS | Relativní čas cyklu | Délka | Max Totemů za cyklus při 1/s |
|---|---:|---:|---:|
| HS1 | 00:00–03:00 | 3 min | 180 |
| HS7 | 03:00–08:00 | 5 min | 300 |
| HS8 | 08:00–16:00 | 8 min | 480 |
| HS3 | 16:00–20:00 | 4 min | 240 |
| HS5 | 20:00–30:00 | 10 min | 600 |
| HS6 | 30:00–45:00 | 15 min | 900 |
| HS10 | 45:00–47:00 | 2 min | 120 |
| HS9 | 47:00–54:00 | 7 min | 420 |
| HS4 | 54:00–59:00 | 5 min | 300 |
| HS2 | 59:00–60:00 | 1 min | 60 |
| **Celkem** | **00:00–60:00** | **60 min** | **3600** |

Poznámka:

- poslední slot lze v UI reprezentovat jako `59:00–59:59`, ale backend musí pracovat s přesnými intervaly bez mezer a překryvů,
- doporučený model je half-open interval `[start, end)`, tedy například HS1 `[00:00, 03:00)`.

## 4.1 Totem generation

Pokud je uživatel v RIGHT prostředí a odpovídá podmínkám aktivní přítomnosti:

```text
1 sekunda v aktuálním HS Frameworku
= 1 Totem daného HS
```

Příklad:

```text
03:00–08:00
HS7
→ až 300 HS7 Totemů
```

**Totem se negeneruje v UP jen proto, že uživatel používá NODE.**

UP a RIGHT se nesmí účetně sloučit.

## 4.2 Proč mají HS rozdílnou délku

Rozdílné délky vytvářejí:

- různé množství jednotlivých Totemů,
- přirozený scarcity mechanismus,
- časovou dramaturgii,
- očekávání dalšího Frameworku,
- důvod zůstat,
- důvod vrátit se,
- přirozený ekonomický bottleneck bez hardcoded denního limitu.

Nejkratší HS2 je zároveň přirozený limiter NP ekonomiky.

---

# 5. NP conversion — hlavní ekonomický bottleneck

Pro vytvoření 1 NP je nutné spotřebovat:

```text
1 × HS1 Totem
1 × HS2 Totem
1 × HS3 Totem
1 × HS4 Totem
1 × HS5 Totem
1 × HS6 Totem
1 × HS7 Totem
1 × HS8 Totem
1 × HS9 Totem
1 × HS10 Totem
```

Tedy 10 Totemů celkem, ale **nikoli libovolných 10 Totemů**.

Je nutný jeden kus z každého Homescreenu.

## 5.1 Maximální NP z jednoho kompletního 60minutového cyklu

Maximální konverze je určena nejnižším Totem balance:

```text
NP_convertible = MIN(
  HS1_balance,
  HS2_balance,
  HS3_balance,
  HS4_balance,
  HS5_balance,
  HS6_balance,
  HS7_balance,
  HS8_balance,
  HS9_balance,
  HS10_balance
)
```

Při plné hodině:

```text
HS1  = 180
HS2  = 60
HS3  = 240
HS4  = 300
HS5  = 600
HS6  = 900
HS7  = 300
HS8  = 480
HS9  = 420
HS10 = 120
```

Bottleneck:

```text
HS2 = 60
```

Proto:

```text
MAX = 60 NP / úplný 60minutový cyklus
```

## 5.2 Zůstatky po konverzi 60 NP

Po konverzi 60 NP:

| HS | Před | Spotřeba | Zůstává |
|---|---:|---:|---:|
| HS1 | 180 | 60 | 120 |
| HS2 | 60 | 60 | 0 |
| HS3 | 240 | 60 | 180 |
| HS4 | 300 | 60 | 240 |
| HS5 | 600 | 60 | 540 |
| HS6 | 900 | 60 | 840 |
| HS7 | 300 | 60 | 240 |
| HS8 | 480 | 60 | 420 |
| HS9 | 420 | 60 | 360 |
| HS10 | 120 | 60 | 60 |

Celkově:

```text
3600 Totemů vytvořeno
600 Totemů spotřebováno
3000 Totemů zůstává
60 NP vytvořeno
```

To je žádoucí vlastnost, ne nutně chyba.

HS2 vytváří scarcity.

---

# 6. UNLOCK / ACTIVATE / COLLECT — hlavní stavová logika contentu

NOEDIS nepoužívá jen klasické „locked/unlocked“.

Zásadní business state je:

```text
LOCKED
→ UNLOCK
→ ACTIVATE
→ COLLECT
```

Tyto fáze vyjadřují **jiný vztah uživatele k obsahu**.

---

# 7. UNLOCK — READ-ONLY discovery fáze

UNLOCK je první zásadní průchod.

Princip:

> Uživatel nejprve obsah objevuje a chápe. Je observer.

V Unlock fázi je Framework / jeho relevantní content:

```text
READ-ONLY
```

Uživatel může:

- Framework zobrazit,
- procházet dashboardy,
- číst,
- pochopit, co jednotlivé části dělají,
- prohlédnout dostupné koncepty a funkce,
- objevovat NODE, které k Frameworku patří.

Uživatel nesmí:

- zapisovat data,
- vytvářet plán,
- měnit business state,
- označovat real-world položky za splněné,
- používat plnou write logiku Activate.

## 7.1 Unlock jako content discovery gate

Zásadní vazba:

```text
RIGHT / UNLOCK
→ user genuinely discovers content
→ CONTENT_UNLOCKED
→ content/NODE can become visible in UP SUPER-APP
```

SUPER-APP nemá automaticky zobrazovat vše.

Uživatel nejprve obsah **objeví přes RIGHT**.

Teprve potom se příslušný Node/Content může stát dostupným v UP.

Tím NOEDIS vytváří pocit:

> „Nejdřív jsem tento nástroj ve světě objevil; teprve potom ho mohu skutečně používat.“

## 7.2 Co znamená „projít celý Unlock“

Přesný UX completion criterion může být pro každý Framework jiný.

Business intent:

- nestačí pouze vstoupit na obrazovku na jednu milisekundu,
- uživatel má projít definovaný Unlock experience,
- může být vyžadováno zobrazení všech klíčových částí,
- nebo dokončení specifické guided/read-only cesty.

Backend by měl podporovat:

```text
unlock_progress
unlock_requirements
unlock_completed_at
```

Nesmí být hardcoded pouze jako boolean bez důvodu, protože různé Frameworky mohou mít jiný completion model.

---

# 8. ACTIVATE — WRITE / planning fáze

Po odemčení obsahu může uživatel přejít do Activate fáze.

Klíčový význam:

```text
UNLOCK = READ
ACTIVATE = WRITE
```

V Activate fázi uživatel může:

- zapisovat,
- plánovat,
- vytvářet úkoly,
- vytvářet projekty,
- nastavovat cíle,
- měnit konfiguraci,
- ukládat vlastní data,
- připravit činnosti, které budou později dokončeny.

Příklad:

```text
ACTIVATE:
Create task:
"Dokončit specifikaci NOEDIS"
```

Zde ještě Score nevzniká.

Uživatel něco **naplánoval / aktivoval**, ale zatím nic nedokončil.

To je kritické:

> ACTIVATE není odměna za dokončení. Je to vytvoření nebo aktivní použití write state.

---

# 9. COLLECT — completion / harvest fáze

Collect je třetí významová fáze.

Princip:

```text
ACTIVATE = "Udělám."
COLLECT  = "Udělal jsem."
```

Pokud uživatel dříve vytvořil například task a později jej označí jako skutečně dokončený:

```text
Task:
Dokončit specifikaci NOEDIS

Status:
COMPLETED
```

nastává Collect mechanismus.

Příklad:

```text
COLLECT
→ +5 SCORE
```

Collect tedy:

- reaguje na dokončenou aktivitu,
- vytváří achievement value,
- generuje Score,
- posouvá XP/Level,
- může dále odemykat gameplay.

Collect nemá být zaměněn za:

- Totem earning,
- NP generation,
- Credit generation.

---

# 10. SCORE — odměna za dokončené věci

Score je odměna za reálně dokončené akce.

Příklad modelu:

```text
Small task complete   → +2 Score
Project complete      → +10 Score
Goal complete         → +25 Score
```

Tato čísla jsou pouze příklady. Finální score economy musí být zvlášť vybalancována.

Důležité je:

```text
COMPLETION
→ COLLECT
→ SCORE
```

Score se nesmí vydávat pouze za vytvoření tasku.

Jinak by bylo možné farmit Score zakládáním nesmyslných položek.

---

# 11. SCORE → XP → LEVEL

Score je vstup do progression systému herního světa.

Navržená exponenciální křivka:

| Level | Cumulative Score threshold |
|---:|---:|
| 1 | 10 |
| 2 | 20 |
| 3 | 40 |
| 4 | 80 |
| 5 | 160 |
| 6 | 320 |
| 7 | 640 |
| 8 | 1280 |
| 9 | 2560 |
| 10 | 5120 |

Koncept:

```text
SCORE
→ XP/PROGRESS
→ LEVEL
→ GAME CONTENT ELIGIBILITY
```

Level představuje:

> „Uživatel si aktivitou zasloužil možnost mít přístup k určitému hernímu obsahu.“

---

# 12. DOWN — GAME WORLD

DOWN je herní vrstva.

Základní vstupy:

- Score,
- XP,
- Level,
- Credits.

DOWN není místo, kde vznikají Totemy nebo NP.

## 12.1 Dvojitá brána pro game content

Ideální model:

```text
LEVEL REQUIREMENT
+
CREDIT PRICE
=
GAME CONTENT UNLOCK
```

Příklad:

```text
CASTLE

Required:
Level 3

Price:
150 Credits
```

Pokud:

```text
Level >= 3
AND
Credits >= 150
```

pak lze Castle koupit / odemknout.

To vytváří dvě nezávislé podmínky:

### Level
„Zasloužil sis možnost.“

### Credit
„Rozhodl ses do ní ekonomicky investovat.“

Výhoda:

- samotné peníze nekoupí celý progres,
- samotný gameplay achievement automaticky nekoupí všechny assety,
- systém není čisté pay-to-win.

---

# 13. UP — SUPER-APP

UP je samostatné aplikační prostředí.

Je to „Super-App“, která zpřístupňuje jednotlivé NODE.

UP není časový Homescreen mechanismus.

NODE v UP mohou být dostupné bez ohledu na to, který Framework právě běží v RIGHT, pokud:

1. Node byl odemčen přes Unlock discovery,
2. uživatel má potřebné entitlementy,
3. uživatel zaplatí NP,
4. nejsou porušeny jiné explicitní constraints.

## 13.1 NODE access

Standardní pravidlo:

```text
1 NP = 03:00 NODE access
```

Příklad:

```text
TASKS NODE

Price:
1 NP

Session:
03:00
```

Po vstupu:

```text
02:59
02:58
02:57
...
00:00
```

Po vypršení session:

```text
SESSION COMPLETE

[ +03:00 / 1 NP ]
[ EXIT ]
```

Pokud uživatel nemá NP:

```text
NOT ENOUGH NP
```

To ho přirozeně vrací do earning loopu na RIGHT.

## 13.2 NODE session je nezávislá na RIGHT

Pokud uživatel spustí NODE v UP:

- změna RIGHT Homescreenu nemá session zrušit,
- NODE má dokončit zaplacený časový blok,
- protože NP platí za UP utility, nikoli za RIGHT schedule.

To je hard invariant.

---

# 14. CREDIT generation

Credit vzniká z **reálně spotřebovaného NP v NODE utility vrstvě**.

Business rule:

```text
1 NP spent on NODE
→ 1 Credit earned
```

Současně:

```text
1 NP
→ 03:00 NODE time
```

Proto:

```text
1 Credit earned
≈ 3 minuty zaplaceného NODE používání
```

Kontinuální NODE usage:

```text
20 NP / hodina
→ 20 Credits / hodina
```

Pokud uživatel nejprve získá maximum 60 NP za jednu plnou hodinu RIGHT cyklu a potom je všechny spotřebuje:

```text
60 NP
→ 180 minut NODE time
→ 60 earned Credits
```

Toto je důležitá jednotková ekonomika.

---

# 15. CREDIT purchase

Vedle earned Credit existuje purchased Credit.

Business intent:

```text
1 CZK
→ 1 purchased Credit
```

Uživatel tak může Credits:

- vydělat používáním NOEDIS utility,
- nebo dokoupit za fiat měnu.

UI může uživateli zobrazovat jednu celkovou Credit balance, ale backend nesmí ztratit původ.

Minimální interní rozdělení:

```text
earned_credits
purchased_credits
```

Preferovaný model je ledger:

```text
credit_ledger_entry {
  id,
  user_id,
  amount,
  direction,
  origin_type,
  origin_reference,
  currency_reference,
  created_at,
  reversible,
  reversed_by,
  metadata
}
```

Možné `origin_type`:

```text
NODE_NP_SPEND_REWARD
FIAT_PURCHASE
REFUND
PROMOTION
ADMIN_ADJUSTMENT
GAME_SPEND
CASHOUT
REVERSAL
```

---

# 16. CREDIT cash-out a game investment

Uživatel se má rozhodnout:

```text
CREDIT
        ┌──────────────┐
        ▼              ▼
      CASH OUT       INVEST
       CZK           GAME
```

Toto je důležitý produktový moment.

Uživatel:

- získal ekonomickou hodnotu,
- může ji realizovat,
- nebo ji reinvestovat do svého virtuálního světa.

## 16.1 Cash-out

Intent:

```text
Credits
→ CZK
```

Přesný konverzní kurz se nyní chápe jako:

```text
1 Credit ≈ 1 CZK
```

Ale backend a business musí před produkční implementací explicitně rozhodnout:

- zda lze cash-outovat earned Credits,
- zda lze cash-outovat purchased Credits,
- minimální cash-out,
- poplatky,
- KYC/AML povinnosti,
- daňové zacházení,
- payout provider,
- chargeback policy,
- refund policy,
- settlement delay,
- země, kde je cash-out povolen,
- age limits,
- fraud controls.

**Agent nesmí tyto otevřené právně-ekonomické otázky zamaskovat jako technický detail.**

---

# 17. Propojení ekonomiky — celý loop

## 17.1 Presence / utility loop

```text
RIGHT
→ current HS
→ current Framework
→ Totem generation
→ complete 10-HS Totem set
→ convert to NP
→ UP
→ choose Node
→ spend NP
→ use Node for 03:00
→ earn Credit
```

## 17.2 Achievement / gameplay loop

```text
RIGHT / ACTIVATE
→ plan / write / create task
→ real-world action
→ complete task
→ COLLECT
→ SCORE
→ XP
→ LEVEL
→ DOWN / GAME
```

## 17.3 Economic choice loop

```text
CREDIT
→ cash out CZK

or

CREDIT
→ invest in GAME
→ unlock/build world
```

## 17.4 Retention loop

```text
Framework is available only in its HS time window
→ user sees limited opportunity
→ wants to stay / return
→ obtains scarce HS Totems
→ completes balanced set
→ gets NP
→ returns to Super-App
```

---

# 18. Proč je time-limited FRAMEWORK důležitý

Časové omezení není pouze kosmetický timer.

Je to strategická business mechanika.

Každý Framework je přístupný na RIGHT jen v předem definovaném okně.

To vytváří:

- anticipation,
- scarcity,
- rytmus,
- habit,
- návratovost,
- motivaci projít celý cyklus,
- odlišné množství Totemů,
- přirozený cap NP.

Uživatel může například vědět:

```text
WORK Framework:
03:00–08:00
```

a pokud jej nestihne:

> počká na další cyklus.

To vytváří touhu zůstat v NOEDIS nebo se vrátit ve správný okamžik.

Důležité:

- Framework access v RIGHT je časově omezen,
- ale jednou zaplacený Node v UP je samostatná session.

---

# 19. Subscription tiers / Packages

NOEDIS obsahuje produktové balíčky:

```text
FREE
BASIC
PRO
DELUXE
VIP
```

Zásadní pravidlo:

> Package != Progress.

Package určuje **svobodu a oprávnění**.  
Progress určuje **co už uživatel objevil, aktivoval a dokončil**.

Uživatel může být například:

```text
Plan: FREE
Level: 8
```

nebo:

```text
Plan: VIP
Level: 1
```

VIP nesmí automaticky znamenat vysoký Score, NP nebo dokončený progression.

---

# 20. FREE

Princip:

```text
LEARN
```

FREE je guided onboarding.

Vlastnosti:

- AI průvodce,
- aktivní je pouze relevantní krok,
- ostatní prvky mohou být disabled / greyed,
- uživatel je systémem veden,
- Unlock je silně řízený,
- cílem je pochopení NOEDIS.

FREE neznamená, že uživatel nesmí chápat základní ekonomiku.

Měl by být schopen poznat:

```text
TIME
→ TOTEM
→ NP
→ NODE
→ CREDIT
```

a:

```text
ACTIVATE
→ COLLECT
→ SCORE
→ LEVEL
```

---

# 21. BASIC

Princip:

```text
EXPLORE
```

BASIC odstraňuje povinný walkthrough.

Uživatel:

- má více svobody,
- může procházet právě dostupný sandbox,
- stále respektuje time/progress gates,
- nemá plnou modularitu PRO.

---

# 22. PRO

Princip:

```text
CUSTOMIZE
```

PRO přidává přepínání modulů / DIV.

Například ve WORK:

```text
INCOME
WISHLIST
JOBS
PROJECTS
GOALS
```

PRO uživatel může rozhodovat, jaký modul chce zobrazovat.

---

# 23. DELUXE

Princip:

```text
CREATE
```

DELUXE umožňuje:

- custom DIV,
- tvorbu vlastních modulů,
- Store,
- instalaci komunitního obsahu,
- creator functionality.

Budoucí creator economy může být napojena na Credits nebo jiné ekonomické vrstvy, ale finální revenue share v této specifikaci není definován.

---

# 24. VIP

Princip:

```text
CONTROL
```

VIP přidává maximální navigační svobodu.

Například:

- direct Homescreen navigation,
- pokročilé přechody,
- odstranění části navigačního friction.

Ale:

> VIP nesmí automaticky obejít progression invarianty.

VIP může snadněji navigovat **odemčený** obsah.

Nemá bez dalšího pravidla odemknout obsah, který uživatel nikdy neprošel v Unlock.

---

# 25. Package permissions — doporučený backend model

Nedoporučuje se implementovat vše jako:

```text
if plan == "PRO"
```

Místo toho:

```yaml
plan: PRO

entitlements:
  guided_mode: false
  sandbox_navigation: true
  module_switching: true
  custom_modules: false
  store_install: false
  direct_homescreen_navigation: false
```

Tím lze balíčky v budoucnu měnit bez refaktoru celé aplikace.

---

# 26. Unified access equation

Aktuální user experience vzniká kombinací:

```text
PACKAGE PERMISSION
+
TIME WINDOW
+
PROGRESSION STATE
+
TOKEN STATE
+
CONTENT UNLOCK STATE
=
CURRENT USER EXPERIENCE
```

To je důležitější než jakýkoli jeden boolean.

Například Node může být použitelný pouze pokud:

```text
node_discovered == true
AND
package_allows_node == true
AND
np_balance >= 1
AND
node_not_suspended == true
```

Zatímco write access ve Frameworku může vyžadovat:

```text
current_homescreen == framework.homescreen
AND
framework.unlock_completed == true
AND
framework.activation_enabled == true
```

---

# 27. Doporučený backend domain model

Níže je konceptuální model. Názvy tabulek nejsou závazné, ale business separace ano.

## 27.1 User

```text
User
- id
- account_status
- package_id
- created_at
- timezone
- locale
- progression_version
```

## 27.2 HomescreenDefinition

```text
HomescreenDefinition
- id
- code (HS1..HS10)
- cycle_start_second
- cycle_end_second
- framework_id
- totem_type_id
- unlock_definition_id
- activation_definition_id
- collect_definition_id
- enabled
- version
```

## 27.3 Framework

```text
Framework
- id
- code
- name
- homescreen_id
- read_model
- write_model
- enabled
- version
```

## 27.4 Node

```text
Node
- id
- framework_id
- name
- description
- access_cost_np
- access_duration_seconds
- discovery_required
- package_requirement
- enabled
```

Default:

```text
access_cost_np = 1
access_duration_seconds = 180
```

## 27.5 UserFrameworkState

```text
UserFrameworkState
- user_id
- framework_id
- state
- unlock_progress
- unlocked_at
- activated_at
- last_active_at
- collect_state
- version
```

Možné `state`:

```text
LOCKED
UNLOCKING
UNLOCKED
ACTIVE
```

Collect doporučeně není jediný permanentní state Frameworku, protože Collect může probíhat opakovaně nad jednotlivými entitami.

## 27.6 TotemWallet

```text
UserTotemBalance
- user_id
- totem_type_id
- balance
- lifetime_earned
- lifetime_spent
```

## 27.7 TotemLedger

```text
TotemLedgerEntry
- id
- user_id
- totem_type_id
- amount
- reason
- homescreen_id
- framework_id
- session_id
- occurred_at
- idempotency_key
```

## 27.8 NPWallet

```text
UserNPBalance
- user_id
- balance
- lifetime_minted
- lifetime_spent
```

## 27.9 NPLedger

```text
NPLedgerEntry
- id
- user_id
- amount
- type
- source_reference
- occurred_at
- idempotency_key
```

Types:

```text
TOTEM_CONVERSION_MINT
NODE_SESSION_SPEND
REVERSAL
ADMIN_ADJUSTMENT
```

## 27.10 NodeSession

```text
NodeSession
- id
- user_id
- node_id
- np_cost
- purchased_duration_seconds
- started_at
- expires_at
- status
- credit_reward_state
```

## 27.11 CreditLedger

```text
CreditLedgerEntry
- id
- user_id
- amount
- origin_type
- direction
- fiat_value_czk
- source_reference
- occurred_at
- status
- idempotency_key
```

## 27.12 Activity / Task

```text
Activity
- id
- user_id
- framework_id
- node_id
- type
- title
- state
- created_at
- activated_at
- completed_at
- collected_at
```

## 27.13 ScoreLedger

```text
ScoreLedgerEntry
- id
- user_id
- activity_id
- score_delta
- reason
- occurred_at
- idempotency_key
```

## 27.14 UserLevelState

```text
UserLevelState
- user_id
- total_score
- level
- level_threshold_version
- updated_at
```

## 27.15 GameAsset

```text
GameAsset
- id
- name
- required_level
- credit_price
- enabled
```

## 27.16 UserGameAsset

```text
UserGameAsset
- user_id
- game_asset_id
- unlocked_at
- credits_spent
```

---

# 28. Ledgers jsou povinné, ne volitelné

NOEDIS pracuje s ekonomikou.

Proto nelze spoléhat pouze na:

```text
user.credits = 125
```

Potřebujeme:

```text
balance
+
immutable transaction history
```

Totéž pro:

- Totemy,
- NP,
- Credits,
- Score.

Každá změna musí být:

- auditovatelná,
- idempotentní,
- dohledatelná,
- spojitelná se zdrojovou událostí,
- bezpečná vůči retry requestům.

---

# 29. Event-driven pohled

Doporučené business eventy:

```text
USER_ENTERED_RIGHT
HOMESCREEN_WINDOW_STARTED
HOMESCREEN_WINDOW_ENDED
FRAMEWORK_VIEWED
TOTEM_EARNED
UNLOCK_PROGRESS_UPDATED
FRAMEWORK_UNLOCK_COMPLETED
CONTENT_DISCOVERED
FRAMEWORK_ACTIVATED
ACTIVITY_CREATED
ACTIVITY_COMPLETED
REWARD_COLLECTED
SCORE_GRANTED
LEVEL_CHANGED
TOTEMS_CONVERTED_TO_NP
NODE_SESSION_PURCHASED
NP_SPENT
NODE_SESSION_STARTED
NODE_SESSION_EXPIRED
CREDIT_EARNED
CREDIT_PURCHASED
CREDIT_SPENT_IN_GAME
CREDIT_CASHOUT_REQUESTED
GAME_ASSET_UNLOCKED
```

Všechny eventy by měly mít:

```text
event_id
user_id
occurred_at
event_version
correlation_id
causation_id
idempotency_key
payload
```

---

# 30. Idempotence — kritická ekonomická vlastnost

Příklad:

Uživatel klikne dvakrát na `CONVERT`.

Backend nesmí:

- dvakrát odečíst Totemy,
- dvakrát přidat NP.

Stejně:

- Node session request retry nesmí dvakrát odečíst NP,
- completion request retry nesmí dvakrát přidat Score,
- payment webhook retry nesmí dvakrát přidat purchased Credits,
- cash-out retry nesmí dvakrát poslat CZK.

Každý finanční/progresní mutation endpoint musí mít:

```text
idempotency_key
```

---

# 31. Concurrency

Příklad:

Uživatel má:

```text
1 NP
```

Otevře dvě záložky a současně spustí dva NODE.

Pouze jeden request může uspět.

Potřebujeme:

- atomic transaction,
- row-level lock / compare-and-swap / transactional ledger,
- nikdy negativní NP balance.

Podobně pro:

- Totem conversion,
- Credit spend,
- game purchase,
- cash-out.

---

# 32. Anti-cheat / anti-abuse

Protože Totem vzniká z času a Credits mají ekonomickou hodnotu, systém bude přirozeně cílem automatizace.

Minimální ochrany:

## Totem earning
- server-authoritative time,
- ne klientský JS counter jako zdroj pravdy,
- kontrola session validity,
- heartbeat,
- detekce multi-session abuse,
- reasonable inactivity policy,
- detekce extrémního množství paralelních tabů,
- rate limits,
- audit.

## Collect
- Score se nesmí nekonečně generovat opakovaným togglem complete/uncomplete,
- Collect musí být idempotentní,
- u některých aktivit může být cooldown nebo ověření.

## Credits
- každý Credit musí mít původ,
- cash-out nesmí pracovat jen s UI balance,
- refund/chargeback musí umět provést korektní reverse ledger operation.

---

# 33. Server-authoritative clock

Time engine musí být řízen serverem.

Klient smí zobrazovat:

```text
03:42 remaining
```

ale rozhodnutí:

```text
which Homescreen is active?
how many Totems were earned?
```

musí vycházet ze server-authoritative času.

Tím se předchází:

- změně lokálních hodin,
- manipulaci JavaScriptem,
- speed hackům,
- offline spoofingu.

---

# 34. Přítomnost vs. pouhé otevření tabu

Business intent je „uživatel je v prostředí“, ne „tab existuje“.

Proto backend musí podporovat definici valid presence.

Možné signály:

- active authenticated session,
- periodic heartbeat,
- foreground/visibility,
- user interaction,
- inactivity threshold.

Přesná anti-idle politika není v této specifikaci uzamčena.

Je to OPEN DECISION.

Ale systém musí být technicky navržen tak, aby bylo možné pravidlo později měnit.

---

# 35. Totem accrual — doporučený technický přístup

Nedoporučuje se zapisovat do DB jeden ledger row každou sekundu.

Místo:

```text
1 sec
→ 1 DB write
```

použít session accounting.

Například:

```text
PresenceSegment:
user_id
homescreen_id
valid_from
valid_to
accrued_seconds
```

Při uzavření segmentu:

```text
accrued_seconds
=
Totem amount
```

Pak jeden ledger zápis:

```text
+137 HS7 Totem
```

místo 137 samostatných řádků.

UI může přesto zobrazovat realtime increment.

---

# 36. Unlock progression a čas

Unlock phase není Totem conversion.

Uživatel může během Unlock:

- získávat Totemy za přítomnost,
- zároveň procházet read-only content.

To jsou paralelní state dimensions.

Příklad:

```text
HS7 current
Totems: +1/sec

FrameworkState:
UNLOCKING
Progress:
70%
```

Když dokončí Unlock:

```text
FrameworkState:
UNLOCKED
```

a při budoucí Activate interakci získá write práva podle příslušných pravidel.

---

# 37. Content visibility v UP

Node může mít například tyto visibility states:

```text
HIDDEN
DISCOVERED
AVAILABLE
TEMPORARILY_UNAVAILABLE
```

Doporučená logika:

```text
HIDDEN
→ user has never unlocked/discovered

DISCOVERED
→ user saw it in RIGHT Unlock

AVAILABLE
→ discovery + entitlement + system enabled

TEMPORARILY_UNAVAILABLE
→ known, but blocked by maintenance/policy/etc.
```

Tím se oddělí:

- „nevím, že to existuje“
- od
- „vím, že to existuje, ale nyní ho nemohu použít“.

---

# 38. Retention design — bez narušení ekonomiky

NOEDIS vytváří retention třemi odlišnými mechanismy:

## 38.1 Time scarcity
„Tento Framework je otevřený jen nyní.“

## 38.2 Economic need
„Došel mi NP; potřebuji znovu projít RIGHT earning loop.“

## 38.3 Progression desire
„Chci vyšší Level, protože chci nový herní obsah.“

Tyto mechanismy se mají podporovat, ne slít do jedné paywall logiky.

---

# 39. Hlavní invariants — agent je nesmí porušit

## INVARIANT 1
Totem se váže na konkrétní HOMESCREEN.

## INVARIANT 2
1 NP vyžaduje minimálně 1 Totem z každého z 10 HS.

## INVARIANT 3
Maximální NP z aktuálního perfektního hodinového cyklu je 60, protože HS2 generuje max. 60 Totemů.

## INVARIANT 4
1 NP standardně financuje 180 sekund NODE session.

## INVARIANT 5
RIGHT a UP jsou samostatné mechanismy.

## INVARIANT 6
Změna RIGHT Homescreenu nesmí sama od sebe ukončit zaplacenou UP Node session.

## INVARIANT 7
UNLOCK je read-only discovery.

## INVARIANT 8
ACTIVATE je write/planning state.

## INVARIANT 9
COLLECT je completion/reward state a vytváří Score.

## INVARIANT 10
Score nevzniká automaticky za pouhé vytvoření/aktivaci tasku.

## INVARIANT 11
NP nevzniká z Credits.

## INVARIANT 12
Credit nevzniká za samotnou přítomnost na RIGHT.

## INVARIANT 13
Earned Credit vzniká za spotřebovaný NP v NODE.

## INVARIANT 14
Purchased Credits a earned Credits musí být backendově rozlišitelné.

## INVARIANT 15
Level se váže na Score/XP, nikoli přímo na nákup Creditů.

## INVARIANT 16
Game asset může vyžadovat současně Level i Credit.

## INVARIANT 17
VIP nesmí automaticky znamenat dokončený progression.

## INVARIANT 18
Super-App nemá ukázat content, který uživatel ještě podle discovery pravidel neodemkl, pokud konkrétní produktové pravidlo výslovně nestanoví výjimku.

## INVARIANT 19
Server je autoritou pro čas a ekonomické zůstatky.

## INVARIANT 20
Všechny ekonomické mutation operace musí být idempotentní.

---

# 40. End-to-end příklad uživatele

## Fáze A — RIGHT / first discovery

Uživatel vstoupí do NOEDIS.

Aktuální cycle time:

```text
03:14
```

Aktivní:

```text
HS7
WORK Framework
```

Framework je pro uživatele poprvé:

```text
UNLOCK / READ-ONLY
```

Uživatel:

- prohlíží Tasks,
- Projects,
- Income,
- Career,
- další části,
- zároveň získává HS7 Totemy.

Dokončí definovaný discovery flow:

```text
WORK Framework unlocked
```

Výsledek:

- WORK content je odemčen,
- relevantní Node se mohou objevit v UP.

## Fáze B — další Activate window

Při dalším odpovídajícím HS7 okně je už Framework aktivovatelný pro write.

Uživatel vytvoří:

```text
Task:
"Dokončit návrh backendu NOEDIS"
```

To je Activate.

Score zatím:

```text
0
```

## Fáze C — Totem conversion

Po kompletním cyklu uživatel má například:

```text
HS1  180
HS2   60
HS3  240
...
HS10 120
```

Konvertuje:

```text
60 NP
```

## Fáze D — UP / Super-App

Otevře UP.

Vidí Tasks Node, protože ho dříve objevil přes RIGHT.

Klikne:

```text
ENTER TASKS NODE
1 NP / 03:00
```

Backend:

```text
NP 60 → 59
NodeSession = 180 sec
```

Za validní spotřebu:

```text
earned Credits +1
```

## Fáze E — reálné dokončení

Později skutečně dokončí task.

Klikne:

```text
COMPLETE
COLLECT
```

Backend:

```text
Score +X
```

Například:

```text
Score +10
```

Dosáhne:

```text
Level 1
```

## Fáze F — DOWN / Game

Hra ukáže nový obsah:

```text
Small House
Required Level: 1
Price: 25 Credits
```

Uživatel se rozhodne:

- Credits vybrat jako CZK,
- nebo je investovat do House.

Tím se uzavírá celý NOEDIS loop.

---

# 41. Co uživateli jednotlivé měny skutečně znamenají

## TOTEM
„Byl jsem přítomen v konkrétní části času / reality.“

## NP
„Mám právo využít NOEDIS utility.“

## CREDIT
„Vytvořil jsem ekonomickou hodnotu použitím utility nebo jsem ji koupil.“

## SCORE
„Něco jsem skutečně dokončil.“

## LEVEL
„Můj dlouhodobý achievement/progress dosáhl další úrovně.“

Tato vysvětlení by měla být konzistentní i v UI copy.

---

# 42. Doporučené wallet UI

Uživatel může vidět jednu NOEDIS Wallet, ale interně musí být oddělená.

Příklad:

```text
NOEDIS WALLET

TOTEMS
HS1    120
HS2      0
HS3    180
HS4    240
HS5    540
HS6    840
HS7    240
HS8    420
HS9    360
HS10    60

NP
42

CREDITS
148 CR

SCORE
76

LEVEL
3
```

UI může zároveň zobrazit:

```text
Credits:
148 CR
≈ 148 CZK nominal NOEDIS value
```

Interně:

```text
earned: 91
purchased: 57
```

---

# 43. Business analytics

Systém by měl měřit minimálně:

## RIGHT
- active time per HS,
- Totems earned per HS,
- drop-off per Framework,
- Unlock completion rate,
- Activate usage rate,
- time until next return.

## UP
- Node sessions,
- NP spent,
- average session extensions,
- most-used Nodes,
- session completion rate,
- credit generation rate.

## COLLECT
- activities created,
- completion rate,
- Collect rate,
- Score distribution,
- abuse patterns.

## DOWN
- Level distribution,
- Credits invested,
- most unlocked assets,
- Credits cashed out vs reinvested.

## Economy
- Totems minted,
- NP minted,
- NP spent,
- Credits earned,
- Credits purchased,
- Credits cashed out,
- Credits burned/spent,
- outstanding Credit liability.

---

# 44. Ekonomické metriky

Z aktuálního designu:

```text
Max Totems per perfect hour:
3600

Max NP per perfect hour:
60

NODE time per NP:
3 min

Max NODE time from 60 NP:
180 min

Credits earned if 60 NP are spent:
60 CR
```

Jedna čistá sekvence:

```text
1h RIGHT perfect cycle
→ 60 NP

60 NP
→ 3h NODE access

3h NODE
→ 60 earned Credits
```

Pokud počítáme čistě sekvenčně:

```text
1h earning + 3h spending
= 4h
→ 60 Credits
```

To odpovídá:

```text
15 Credits / h total sequential time
```

Toto není nutně výplata „mzdy“; je to produktová jednotková matematika.

---

# 45. Credits jako finanční závazek

Pokud cash-out opravdu funguje 1:1 do CZK, každý outstanding earned Credit může představovat potenciální budoucí payout liability.

Backend proto musí sledovat:

```text
total_credit_liability
earned_credit_liability
purchased_credit_balance
pending_cashouts
settled_cashouts
reversed_credits
```

Produkt nesmí mít pouze „hezké číslo v peněžence“.

---

# 46. Refund a chargeback logika

Příklad:

Uživatel koupí:

```text
100 CZK
→ 100 purchased Credits
```

Pokud payment provider provede chargeback, backend musí vědět:

- kolik purchased Credits ještě zbývá,
- kolik již bylo spotřebováno,
- jak se řeší záporná ekonomická expozice.

Tato pravidla nejsou finalizována, ale ledger na ně musí být připraven.

---

# 47. Score fraud

Protože Score odemyká Game content, bude motivace Score farmit.

Minimální design:

- activity completion musí mít unique collect state,
- Collect nelze opakovat,
- reopen/complete nesmí generovat opakovaný reward bez výslovného pravidla,
- některé activity typy mohou mít denní limity,
- backend musí ukládat source Activity ID do Score ledgeru.

---

# 48. Versioning business rules

Ekonomika se bude vyvíjet.

Proto doporučení:

```text
economy_version
homescreen_schedule_version
level_curve_version
package_entitlement_version
```

U ledger entry ukládat relevantní rule version.

Například:

```text
NP_CONVERSION_V1
NODE_PRICE_V1
LEVEL_CURVE_V1
```

Tím lze později změnit ekonomiku bez ztráty auditní interpretace minulosti.

---

# 49. Configuration, ne hardcode

Backend by měl mít konfigurovatelné:

- HS schedule,
- Totem rate,
- NP conversion basket,
- Node duration,
- Node NP price,
- Credit reward per NP,
- level thresholds,
- game asset prices,
- package entitlements.

Ale konfigurace nesmí umožnit runtime chaos bez verze a auditu.

---

# 50. Doporučené API operace

Konceptuálně:

```text
GET /time/current-homescreen
POST /presence/start
POST /presence/heartbeat
POST /presence/stop

GET /frameworks/{id}
GET /frameworks/{id}/state
POST /frameworks/{id}/unlock-progress
POST /frameworks/{id}/activate

POST /activities
POST /activities/{id}/complete
POST /activities/{id}/collect

GET /wallet
POST /wallet/np/convert

GET /nodes
POST /nodes/{id}/sessions
POST /node-sessions/{id}/extend
POST /node-sessions/{id}/close

POST /credits/purchase
POST /credits/cashout
POST /game/assets/{id}/purchase
```

Skutečné endpoint názvy nejsou závazné.

---

# 51. Wallet conversion transaction

`Totems → NP` musí být jedna atomická transakce.

Pseudo:

```text
BEGIN

lock all 10 relevant balances

assert each balance >= requested_np

for each HS:
  balance -= requested_np

NP += requested_np

write 10 Totem spend ledger entries
write 1 NP mint ledger entry

COMMIT
```

Při fail:

```text
ROLLBACK
```

Nesmí vzniknout stav:

- Totemy odečtené,
- NP nepřipsané.

---

# 52. Node purchase transaction

Pseudo:

```text
BEGIN

lock NP balance

assert NP >= cost

NP -= cost

create NodeSession

create NP_SPEND ledger

create/queue earned Credit reward according to business rule

COMMIT
```

Je nutné rozhodnout, zda Credit vzniká:

A. při zahájení placené session,  
B. po doběhnutí placených 3 minut.

Z aktuálního business popisu:

> „za každý utracený NP neboli 03:00 minuty 1 Credit“

Nejčistší interpretace pro anti-abuse je:

- NP je spotřebován při nákupu session,
- Credit je **earned po validním spotřebování / dokončení příslušného placeného bloku**.

Toto doporučení je bezpečnější než instantní Credit při startu a okamžitý exit.

Je však vhodné finálně potvrdit.

---

# 53. Collect transaction

Pseudo:

```text
BEGIN

lock Activity

assert Activity.status == COMPLETED
assert Activity.collected_at IS NULL

calculate reward according to activity/reward rules

mark collected_at

Score += reward

write Score ledger

recalculate Level

if Level changed:
  emit LEVEL_CHANGED

COMMIT
```

---

# 54. Game purchase transaction

Pseudo:

```text
BEGIN

lock Credit balance / ledger state

assert user.level >= asset.required_level
assert spendable_credits >= asset.credit_price
assert asset not already owned (unless repeatable)

debit Credits
create ownership

COMMIT
```

---

# 55. Package vs economy

Package nesmí nahradit ekonomiku.

Například VIP:

- může mít direct navigation,
- customizaci,
- access privileges,

ale automaticky:

```text
VIP != infinite NP
VIP != infinite Credits
VIP != Level 10
VIP != all content discovered
```

Toto je kritické pro integritu NOEDIS.

---

# 56. RIGHT UX state example

```text
RIGHT

HS7 — WORK
03:52 REMAINING

STATUS:
ACTIVATE

TOTEM:
HS7 +1/sec

WORK
────────────────
Tasks
Projects
Career
Income
Goals
────────────────

Unlocked Nodes:
4 / 7
```

První návštěva:

```text
STATUS:
UNLOCK

MODE:
READ-ONLY
```

Po Unlock:

```text
STATUS:
ACTIVATE

MODE:
WRITE
```

---

# 57. UP UX state example

```text
UP — SUPER-APP

WORK
────────────────
Tasks NODE
1 NP / 03:00

Projects NODE
1 NP / 03:00

Career NODE
1 NP / 03:00
────────────────

NP BALANCE:
12
```

Po spuštění:

```text
TASKS NODE

02:41 remaining

NP:
11

Credit reward:
pending for current paid block
```

---

# 58. DOWN UX state example

```text
DOWN — WORLD

LEVEL 3
SCORE 56 / 80

CREDITS:
148

AVAILABLE
────────────────
CASTLE
Level requirement: 3 ✓
Price: 150 CR ✗

HOUSE
Level requirement: 2 ✓
Price: 80 CR ✓
```

---

# 59. Co nesmí UI uživateli tvrdit nepřesně

Neříkat:

> „Vyděláváš 1 Kč za sekundu.“

Správně:

- sekundy generují Totemy,
- Totemy se vyváženě převádějí na NP,
- NP kupují utility time,
- spotřebované utility bloky generují Credits.

Neříkat:

> „NP je 1 Kč.“

NP není CZK jednotka.

Neříkat:

> „Score je měna.“

Score je progression/achievement.

---

# 60. Glossary

## RIGHT
Časově řízená Homescreen/Framework obrazovka.

## UP
SUPER-APP s NODE.

## DOWN
GAME / world.

## HOMESCREEN
Časový slot hodinového cyklu.

## FRAMEWORK
Tematické prostředí přiřazené k Homescreenu.

## NODE
Konkrétní utilitní aplikace/nástroj v UP.

## UNLOCK
První read-only discovery.

## ACTIVATE
Write/planning použití.

## COLLECT
Dokončení a převzetí achievement odměny.

## TOTEM
Per-HS časová stopa/presence unit.

## NP
Utility access token.

## CREDIT
Ekonomická jednotka, 1 CR ≈ 1 CZK.

## SCORE
Odměna za dokončené činnosti.

## XP
Progress reprezentace Score.

## LEVEL
Dlouhodobá achievement úroveň.

## PACKAGE
FREE/BASIC/PRO/DELUXE/VIP entitlement vrstva.

---

# 61. OPEN DECISIONS — zatím neuzamčeno

Agent nesmí tyto body považovat za final:

1. přesná definice validní „presence“ pro Totem accrual,
2. inactivity timeout,
3. zda se Totem earning zastaví při background tabu,
4. zda lze mít více paralelních zařízení,
5. přesné unlock completion criteria každého Frameworku,
6. přesná Score odměna za každý activity type,
7. cumulative vs incremental Level threshold — doporučeno cumulative,
8. kdy přesně vznikne Credit: start vs completion 3min bloku — doporučeno completion,
9. přesná pravidla cash-out,
10. cash-out eligibility purchased Credits,
11. fees,
12. KYC/AML,
13. tax/accounting treatment,
14. creator economy,
15. Store revenue share,
16. zda některé NODE stojí více než 1 NP,
17. zda některé NODE mají jiné délky než 3 min,
18. package-specific NP/Credit modifiers — nedoporučuje se bez zvláštního důvodu,
19. LEFT screen logika,
20. přesné mapování všech HS na finální Framework názvy,
21. přesné UI transitions.

---

# 62. Doporučené testy — minimální sada

## Time engine
- každý second-of-hour mapuje právě na jeden HS,
- žádná mezera,
- žádný overlap,
- HS2 má přesně 60s.

## Totems
- 1 valid second = 1 správný HS Totem,
- UP Node time nevytváří Totem,
- invalid presence nevytváří Totem.

## Conversion
- 1 NP odečte právě 1 z každého HS Totemu,
- pokud jediný HS má 0, conversion fail,
- convert 60 při full hour succeed,
- convert 61 fail.

## Unlock
- locked Node hidden,
- discovery completion makes Node visible,
- read-only mode cannot write.

## Activate
- unlocked Framework allows permitted writes,
- Activate itself does not grant Score.

## Collect
- completed activity can collect once,
- double collect returns idempotent result,
- Score granted once.

## Node
- 1 NP creates 180s session,
- concurrent request cannot overspend NP,
- RIGHT HS change does not kill Node.

## Credit
- valid Node spend produces earned Credit according to chosen timing rule,
- purchase produces purchased Credit,
- wallet can show total while ledger preserves origin.

## Game
- insufficient level blocks purchase,
- insufficient Credits blocks purchase,
- both satisfied unlock asset atomically.

---

# 63. Agent implementation guidance

Před implementací agent:

1. načte tuto specifikaci,
2. vytvoří domain glossary,
3. vytvoří state diagrams,
4. navrhne database schema,
5. navrhne ledger invariants,
6. navrhne API contracts,
7. vytvoří unit tests business rules,
8. vytvoří integration tests,
9. teprve poté implementuje UI orchestration.

Agent nesmí začít tím, že nakreslí dashboard a business logiku „doplní později“.

NOEDIS stojí na doménových pravidlech.

---

# 64. Doporučené state machines

## Framework state

```text
LOCKED
  ↓
UNLOCKING (READ-ONLY)
  ↓
UNLOCKED
  ↓
ACTIVE (WRITE-enabled when context allows)
```

Collect není nutně permanentní Framework state.

Je lepší jako:

```text
Activity:
PLANNED
→ ACTIVE
→ COMPLETED
→ COLLECTED
```

## Node session

```text
REQUESTED
→ PAID
→ ACTIVE
→ EXPIRED/COMPLETED
```

## Credit cash-out

```text
REQUESTED
→ REVIEW/PENDING
→ APPROVED
→ PAID

or

→ REJECTED
```

---

# 65. Filosofie produktu

NOEDIS nemá člověka jen odměňovat za pasivní čas.

Má spojit:

```text
PRESENCE
DISCOVERY
PLANNING
UTILITY
COMPLETION
ACHIEVEMENT
ECONOMIC CHOICE
GAMEPLAY
```

RIGHT dává rytmus.

UP dává utilitu.

COLLECT dává smysl dokončeným věcem.

DOWN dává dlouhodobou reprezentaci progresu.

Credits dávají uživateli volbu mezi:

```text
real-world value
a
virtual-world investment
```

---

# 66. Nejkratší canonical flow

```text
RIGHT
→ TIME WINDOW
→ FRAMEWORK
→ UNLOCK (READ)
→ ACTIVATE (WRITE)
→ TOTEMS

10 HS TOTEM SET
→ NP

UP
→ NODE
→ 1 NP / 3 MIN
→ CREDIT

REAL-LIFE COMPLETION
→ COLLECT
→ SCORE
→ XP
→ LEVEL

DOWN
→ LEVEL GATE
+ CREDIT PRICE
→ GAME WORLD

CREDIT
→ CZK
or
→ GAME
```

---

# 67. Finální business definice

NOEDIS vytváří uzavřený systém mezi **časem, přítomností, objevováním, plánováním, skutečným použitím nástrojů, dokončováním reálných věcí, ekonomickou hodnotou a herním světem**.

Nejzásadnější separace:

```text
TOTEM = presence
NP = utility access
CREDIT = economic value
SCORE = achievement
LEVEL = progression
```

Nejzásadnější fáze:

```text
UNLOCK = read / discover
ACTIVATE = write / plan
COLLECT = complete / reward
```

Nejzásadnější obrazovky:

```text
RIGHT = time + framework + totems
UP = super-app + nodes + NP spend + credits
DOWN = game + score + level + credit investment
```

A nejzásadnější produktová smyčka:

```text
Uživatel se vrací kvůli času,
zůstává kvůli Frameworku,
získává Totemy,
mění je na NP,
používá utility v NODE,
získává Credits,
plánuje své skutečné věci,
dokončuje je,
Collect mění dokončení na Score,
Score mění jeho Level,
Level + Credits mění jeho herní svět,
a Credits může místo toho převést zpět do CZK.
```

Toto je aktuální canonical význam NOEDIS business logiky zachycený v této specifikaci.

---

# 68. DO NOT FORGET — deset vět pro budoucího agenta

1. RIGHT není Super-App.
2. FRAMEWORK není NODE.
3. Totem není Credit.
4. NP není Score.
5. Unlock je read-only.
6. Activate je write.
7. Collect odměňuje dokončení.
8. NODE stojí NP a běží v UP nezávisle na RIGHT.
9. Level pochází ze Score, ne z peněz.
10. Credits musí mít auditovatelný původ a jejich cash-out je finančně citlivá část systému.

---

# 69. Canonical constants — v1

```yaml
noedis_business_logic_v1:

  cycle:
    duration_seconds: 3600

  homescreens:
    HS1:
      start_second: 0
      end_second: 180
      max_totems_per_cycle: 180

    HS7:
      start_second: 180
      end_second: 480
      max_totems_per_cycle: 300

    HS8:
      start_second: 480
      end_second: 960
      max_totems_per_cycle: 480

    HS3:
      start_second: 960
      end_second: 1200
      max_totems_per_cycle: 240

    HS5:
      start_second: 1200
      end_second: 1800
      max_totems_per_cycle: 600

    HS6:
      start_second: 1800
      end_second: 2700
      max_totems_per_cycle: 900

    HS10:
      start_second: 2700
      end_second: 2820
      max_totems_per_cycle: 120

    HS9:
      start_second: 2820
      end_second: 3240
      max_totems_per_cycle: 420

    HS4:
      start_second: 3240
      end_second: 3540
      max_totems_per_cycle: 300

    HS2:
      start_second: 3540
      end_second: 3600
      max_totems_per_cycle: 60

  totem:
    accrual_rate_per_valid_second: 1

  np_conversion:
    required_each_homescreen_totem: 1
    resulting_np: 1
    theoretical_max_np_per_perfect_cycle: 60

  node:
    default_np_price: 1
    default_access_seconds: 180

  credit:
    earned_per_valid_np_consumed: 1
    purchase_price_czk_per_credit: 1
    nominal_value_czk_per_credit: 1

  level_curve:
    type: exponential_cumulative_threshold
    base_score: 10
    multiplier: 2
```

---

# 70. Závěr

Tento dokument má být používán jako **Master Business Logic Specification**.

Před každou změnou backendu, ekonomiky nebo UX je potřeba zkontrolovat:

- porušuje změna některý invariant?
- nemíchá dvě původně oddělené ekonomiky?
- je změna auditovatelná?
- je server zdrojem pravdy?
- je možné mutation opakovat bezpečně?
- jsou Credits účetně rozlišitelné?
- zůstává význam UNLOCK / ACTIVATE / COLLECT zachován?
- zůstává RIGHT / UP / DOWN separace zachována?

Pokud ano, změna odpovídá základní filozofii NOEDIS.

Pokud ne, musí být považována za změnu produktu, nikoli za „technickou optimalizaci“.

---

**END OF MASTER SPECIFICATION**
