#!/usr/bin/env python3
"""
Publish the NOEDIS Command Center through Caddy — idempotently.

Adds, inside the `noedis.org` server block:

    handle /command            -> 308 redirect to /command/
    handle_path /command/*     -> reverse_proxy 127.0.0.1:3200
    handle /noedis/*           -> reverse_proxy 127.0.0.1:3200

Paperclip keeps the root (`/`), `/api/*` and its auth base URL, so nothing
about the existing deployment changes.

It also relaxes `X-Frame-Options` from DENY to SAMEORIGIN inside that block,
because the cockpit embeds the Paperclip UI in an iframe on the same origin.
SAMEORIGIN still blocks every third-party site from framing us.

Running it repeatedly is safe: any previously injected copies are removed
before exactly one copy is written back.

Usage:  sudo python3 caddy-command-center.py /etc/caddy/Caddyfile
"""

import re
import sys

BACKEND = "127.0.0.1:3200"
MARKER = "# ── NOEDIS Command Center (managed block — do not edit by hand) ──"

ROUTES = f"""\t{MARKER}
\thandle /command {{
\t\tredir /command/ 308
\t}}
\thandle_path /command/* {{
\t\treverse_proxy {BACKEND}
\t}}
\thandle /noedis/* {{
\t\treverse_proxy {BACKEND}
\t}}
"""

# Any previously injected copy: our own comment lines, then the routes.
# The comment matcher must accept every wording this script has ever emitted,
# otherwise re-runs leave orphaned markers behind.
INJECTED = re.compile(
    r"(?:\t#[^\n]*(?:NOEDIS Command Center|managed block|cockpit)[^\n]*\n)*"
    r"\thandle /command \{\n\t\tredir /command/ 308\n\t\}\n"
    r"\thandle_path /command/\* \{\n\t\treverse_proxy [^\n]+\n\t\}\n"
    r"\thandle /noedis/\* \{\n\t\treverse_proxy [^\n]+\n\t\}\n"
)

BLOCK_START = re.compile(r"^noedis\.org \{$", re.M)


def block_span(src: str):
    """Return (start, end) of the noedis.org server block, end exclusive."""
    m = BLOCK_START.search(src)
    if not m:
        sys.exit("ERROR: no `noedis.org {` server block found")
    # Walk braces to find the matching close.
    depth = 0
    i = m.end() - 1
    while i < len(src):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return m.start(), i + 1
        i += 1
    sys.exit("ERROR: unbalanced braces in noedis.org block")


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "/etc/caddy/Caddyfile"
    with open(path) as fh:
        src = fh.read()

    removed = len(INJECTED.findall(src))
    src = INJECTED.sub("", src)

    start, end = block_span(src)
    block = src[start:end]

    # Relax X-Frame-Options only inside this block, only if still DENY.
    frame_changes = 0
    if re.search(r'X-Frame-Options\s+"DENY"', block):
        block = re.sub(r'X-Frame-Options\s+"DENY"', 'X-Frame-Options "SAMEORIGIN"', block)
        frame_changes = 1

    h = re.search(r"^\thandle ", block, re.M)
    if not h:
        sys.exit("ERROR: no `handle` directive inside the noedis.org block")
    block = block[: h.start()] + ROUTES + block[h.start() :]

    out = src[:start] + block + src[end:]
    with open(path, "w") as fh:
        fh.write(out)

    print(f"Caddy: removed {removed} previous injection(s), wrote 1 managed block")
    print(f"Caddy: X-Frame-Options DENY -> SAMEORIGIN ({frame_changes} change)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
