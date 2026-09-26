#!/usr/bin/env python3
"""
Publish the NOEDIS Command Center through Caddy — idempotently.

Topology it enforces:

    noedis.org        -> Command Center (cockpit), at the ROOT
    noedis.org/noedis/*  -> cockpit API + live socket
    noedis.org/command*  -> 308 to / (the cockpit's original URL)
    www.noedis.org    -> Paperclip (native UI), its own canonical host

Paperclip moved to www.noedis.org because the founder wants `noedis.org` to open
the cockpit. Paperclip's own `auth.customBaseUrl` must match that host, otherwise
better-auth redirects logins back to the cockpit. The www block therefore carries
`Content-Security-Policy: frame-ancestors https://noedis.org` so only the cockpit
may embed it.

Both regions are delimited by explicit managed markers, so re-running replaces
them instead of appending duplicates. Legacy unmarked injections from earlier
deployments are stripped too.

Usage:  sudo python3 caddy-command-center.py /etc/caddy/Caddyfile
"""

import os
import re
import sys

COCKPIT = "127.0.0.1:3200"
PAPERCLIP = "127.0.0.1:3100"

CC_START = "\t# >>> NOEDIS Command Center (managed) >>>"
CC_END = "\t# <<< NOEDIS Command Center (managed) <<<"
PC_START = "# >>> NOEDIS Paperclip host (managed) >>>"
PC_END = "# <<< NOEDIS Paperclip host (managed) <<<"

# The cockpit holds the board API key and can create work that spends money, so
# it is published behind HTTP basic auth. The plaintext password is never stored
# here — only a bcrypt hash, generated with `caddy hash-password --plaintext`.
# Both come from the environment (deploy/.vps.env, git-ignored); when unset the
# cockpit is published unprotected, which is only appropriate on a private host.
AUTH_USER = os.environ.get("NOEDIS_AUTH_USER", "").strip()
AUTH_HASH = os.environ.get("NOEDIS_AUTH_HASH", "").strip()
AUTH_REQUIRED = os.environ.get("NOEDIS_AUTH_REQUIRED", "").strip().lower() in ("1", "true", "yes")

if AUTH_REQUIRED and not (AUTH_USER and AUTH_HASH):
    sys.exit(
        "ERROR: NOEDIS_AUTH_REQUIRED is set but NOEDIS_AUTH_USER / NOEDIS_AUTH_HASH are missing."
    )


def auth_directive(indent: str) -> str:
    """`basic_auth { ... }` for the cockpit routes, or "" when unconfigured."""
    if not (AUTH_USER and AUTH_HASH):
        return ""
    i1 = indent + "\t"
    i2 = indent + "\t\t"
    return (
        f"{indent}basic_auth {{\n"
        f"{i1}{AUTH_USER} {AUTH_HASH}\n"
        f"{indent}}}\n"
    )


COCKPIT_ROUTES = f"""{CC_START}
\t# The cockpit owns the root. Paperclip moved to www.noedis.org.
\t# A named matcher + bare redir runs before the mutually exclusive handle set.
\t@noedis_cc_old path /command /command/*
\tredir @noedis_cc_old / 308

\thandle /noedis/* {{
{auth_directive("\t\t")}\t\treverse_proxy {COCKPIT}
\t}}
{CC_END}
"""

PAPERCLIP_BLOCK = f"""{PC_START}
www.noedis.org {{
\treverse_proxy {PAPERCLIP}
\tencode zstd gzip
\theader {{
\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"
\t\tX-Content-Type-Options "nosniff"
\t\tReferrer-Policy "strict-origin-when-cross-origin"
\t\tContent-Security-Policy "frame-ancestors https://noedis.org"
\t}}
}}
{PC_END}
"""

# Legacy unmarked injections from earlier deployments.
LEGACY = re.compile(
    r"(?:\t#[^\n]*(?:NOEDIS Command Center|managed block|cockpit)[^\n]*\n)*"
    r"\thandle /command \{\n\t\tredir /command/ 308\n\t\}\n"
    r"(?:\thandle_path /command/\* \{\n\t\treverse_proxy [^\n]+\n\t\}\n)?"
    r"\thandle /noedis/\* \{\n\t\treverse_proxy [^\n]+\n\t\}\n"
)

BLOCK_START = re.compile(r"^noedis\.org \{$", re.M)


def block_span(src: str):
    m = BLOCK_START.search(src)
    if not m:
        sys.exit("ERROR: no `noedis.org {` server block found")
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


def bare_handle_span(block: str):
    """Span of the root catch-all `handle { ... }` (no matcher) in a server block.

    The catch-all is the un-prefixed `handle` at one tab of indentation; every
    other route in these blocks carries a matcher (`/app/*`, `/noedis/*`, ...),
    so this uniquely identifies the root route.
    """
    m = re.search(r"^\thandle \{\s*$", block, re.M)
    if not m:
        return None
    depth = 0
    i = m.end() - 1
    while i < len(block):
        if block[i] == "{":
            depth += 1
        elif block[i] == "}":
            depth -= 1
            if depth == 0:
                return m.start(), i + 1
        i += 1
    return None


def replace_region(src: str, start_marker: str, end_marker: str, body: str):
    """Replace an existing managed region, or report that there was none."""
    a = src.find(start_marker)
    if a == -1:
        return src, False
    b = src.find(end_marker, a)
    if b == -1:
        return src, False
    b += len(end_marker)
    # swallow the newline after the end marker
    if b < len(src) and src[b] == "\n":
        b += 1
    # keep everything after the region — dropping it truncates the Caddyfile
    return src[:a] + body + src[b:], True


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "/etc/caddy/Caddyfile"
    with open(path) as fh:
        src = fh.read()

    legacy = len(LEGACY.findall(src))
    src = LEGACY.sub("", src)

    # ── cockpit region inside the noedis.org block ────────────────
    src, had_cc = replace_region(src, CC_START, CC_END, COCKPIT_ROUTES)
    if not had_cc:
        start, end = block_span(src)
        block = src[start:end]
        h = re.search(r"^\thandle ", block, re.M)
        if not h:
            sys.exit("ERROR: no `handle` directive inside the noedis.org block")
        block = block[: h.start()] + COCKPIT_ROUTES + block[h.start():]
        src = src[:start] + block + src[end:]

    # The root catch-all must serve the cockpit; Paperclip is on www now.
    # Whatever the root route currently does (reverse_proxy to Paperclip, or a
    # static file_server from an earlier deployment), it is replaced wholesale —
    # otherwise a file_server root would keep shadowing the cockpit.
    start, end = block_span(src)
    block = src[start:end]
    span = bare_handle_span(block)
    if not span:
        sys.exit("ERROR: no root `handle {` catch-all inside the noedis.org block")
    a, b = span
    root_route = (
        "\thandle {\n"
        f"{auth_directive(chr(9) * 2)}"
        f"\t\treverse_proxy {COCKPIT}\n"
        "\t}"
    )
    block = block[:a] + root_route + block[b:]
    src = src[:start] + block + src[end:]
    print(f"Caddy: root catch-all -> {COCKPIT}")

    # X-Frame-Options on the cockpit stays SAMEORIGIN (never framed).
    start, end = block_span(src)
    block = src[start:end]
    if re.search(r'X-Frame-Options\s+"DENY"', block):
        block = re.sub(r'X-Frame-Options\s+"DENY"', 'X-Frame-Options "SAMEORIGIN"', block)
        src = src[:start] + block + src[end:]

    # ── Paperclip host block, top level ───────────────────────────
    src, had_pc = replace_region(src, PC_START, PC_END, PAPERCLIP_BLOCK)
    if not had_pc:
        src = src.rstrip("\n") + "\n\n" + PAPERCLIP_BLOCK

    with open(path, "w") as fh:
        fh.write(src)

    print(f"Caddy: stripped {legacy} legacy injection(s)")
    print(f"Caddy: cockpit region {'replaced' if had_cc else 'inserted'} (root + /noedis/*)")
    print(f"Caddy: root catch-all -> {COCKPIT}")
    print(f"Caddy: Paperclip block {'replaced' if had_pc else 'appended'} (www.noedis.org)")
    if AUTH_USER and AUTH_HASH:
        print(f"Caddy: cockpit protected with basic_auth (user: {AUTH_USER})")
    else:
        print("Caddy: WARNING — cockpit published WITHOUT authentication")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
