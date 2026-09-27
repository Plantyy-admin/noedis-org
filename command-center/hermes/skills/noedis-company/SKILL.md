---
name: noedis-company
description: Hand real work to the NOEDIS company. Use when the founder asks for something to be built, fixed, checked, researched, shipped or delivered — anything that is a task rather than a question about the current conversation. The task is created in Paperclip addressed to NOE, the Senior Advisor, who routes it onward to CODY and the departments. Do NOT use it for small talk, for questions about this conversation, or for anything you can answer yourself in one reply.
version: 1.0.0
platforms:
  - linux
metadata:
  hermes:
    tags: [noedis, company, delegation, tasks, paperclip]
---

# noedis-company

The NOEDIS company runs on Paperclip. Its org is `FOUNDER → NOE (Senior Advisor)
→ CODY (Right Hand) + RENE (Left Hand) → 7 departments`. Work enters the company
as an issue assigned to **NOE**; NOE decides what happens next and hands it to
CODY and the departments. This skill is how a request that arrives from WhatsApp
or from the cockpit's VOICE panel becomes a real issue on that board.

## When to use

Use it when the founder asks for something to be **done**:

- "postav landing page pro produkt X"
- "oprav to, co padá na frontendu"
- "zjisti, jak si stojí konkurence, a napiš mi to"
- "přidej do balíčků novou položku"
- "napiš release notes k poslední verzi"

Do **not** use it for:

- greetings, thanks, or small talk
- questions about this conversation or about your own state
- anything you can answer in one reply without the company doing work

When in doubt: if the founder would expect a person to spend real time on it,
delegate it. If they expect an answer right now, answer it yourself.

## How

Create the task and wake NOE in one call:

```bash
python3 ~/.hermes/skills/noedis-company/delegate.py "Short imperative title" "Everything the team needs to know: what, why, constraints, and what done looks like."
```

- The **title** is what the board shows — keep it under ~80 characters, start
  with a verb, no trailing period.
- The **body** is the brief. Write it for someone who has not seen this
  conversation: context, the ask, constraints, and the definition of done. Write
  it in Czech if the founder wrote in Czech.
- Add a third argument to raise the priority: `low`, `medium` (default), `high`,
  `critical`.

The script prints a JSON line with the created issue id. A successful hand-off
looks like:

```
{"at":"2026-09-27T20:41:02Z","title":"…","id":"NOE-42","wakeError":null,"source":"hermes"}
```

## After a successful hand-off

Reply to the founder in **one short line** saying what you sent and that it is
with NOE — for example: *„Předal jsem to NOE: přidat landing page. Ozve se, až to
CODY dotáhne."* Do not paste the JSON, do not re-list the brief, and do not
promise an outcome you cannot see. The company reports back through RENE, and
those reports surface in the cockpit's INBOX.

## When it fails

- `NOEDIS_BRIDGE_TOKEN` missing → tell the founder the bridge token is not
  configured; nothing was sent.
- A non-2xx answer or a connection error → tell the founder the hand-off failed
  and pass on the error text. Never claim a task was created when it was not.
