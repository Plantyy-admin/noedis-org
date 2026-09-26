#!/usr/bin/env python3
"""
Remove the legacy NOEDIS navigation that an earlier deployment injected into
Paperclip's own UI shell.

That injection added a fixed 36px bar (`.noedis-bar`) plus a `<style>` and a
large `<script>` rendering CHAT / PAPERCLIP / GAMEPLAY / STRUCTURE / INBOX
overlays directly inside

    /usr/lib/node_modules/paperclipai/node_modules/@paperclipai/server/ui-dist/index.html

Those views now live in the Command Center at https://noedis.org/command/, so
the Paperclip shell must stay clean — otherwise every page of the native UI
carries a second, conflicting navigation.

This is idempotent: running it on an already-clean file changes nothing.
A timestamped backup is written before any change.

Usage:  sudo python3 remove-paperclip-injection.py [path-to-index.html]
"""

import os
import re
import shutil
import sys
import time

DEFAULT = (
    "/usr/lib/node_modules/paperclipai/node_modules/@paperclipai/server/ui-dist/index.html"
)

# Content markers left behind by the injection.
STYLE_MARKER = ".noedis-bar"
SCRIPT_MARKER = "// NOEDIS v4"


def strip_between(src: str, marker: str, open_tag: str, close_tag: str):
    """Remove the open_tag..close_tag element that contains `marker`."""
    at = src.find(marker)
    if at == -1:
        return src, False
    start = src.rfind(open_tag, 0, at)
    end = src.find(close_tag, at)
    if start == -1 or end == -1:
        return src, False
    return src[:start] + src[end + len(close_tag):], True


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT

    if not os.path.isfile(path):
        print(f"ERROR: not found: {path}")
        return 2

    with open(path) as fh:
        src = fh.read()
    original_len = len(src)

    src, removed_style = strip_between(src, STYLE_MARKER, "<style>", "</style>")
    src, removed_script = strip_between(src, SCRIPT_MARKER, "<script>", "</script>")

    if not (removed_style or removed_script):
        print(f"clean already — nothing to remove ({original_len} bytes)")
        return 0

    # Tidy the whitespace the removals left behind.
    src = re.sub(r"\n[ \t]*\n[ \t]*\n+", "\n\n", src)
    src = re.sub(r"[ \t]+\n", "\n", src)

    backup = f"{path}.noedis-inject.bak-{time.strftime('%Y%m%d-%H%M%S')}"
    shutil.copy2(path, backup)

    with open(path, "w") as fh:
        fh.write(src)

    print(f"style block removed : {removed_style}")
    print(f"script block removed: {removed_script}")
    print(f"size: {original_len} -> {len(src)} bytes")
    print(f"backup: {backup}")
    print("\nRestart Paperclip to serve the cleaned shell:")
    print("  sudo systemctl restart noedis-paperclip")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
