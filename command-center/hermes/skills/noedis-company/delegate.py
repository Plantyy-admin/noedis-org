#!/usr/bin/env python3
"""Hand one task to the NOEDIS company.

Creates the work item in Paperclip addressed to NOE and wakes him, through the
cockpit's bridge route. Prints the created record as one JSON line.

    delegate.py "Title" "Body" [priority]

Needs NOEDIS_BRIDGE_TOKEN in the environment (it lives in ~/.hermes/.env) and
reaches the cockpit on the loopback interface, so nothing has to be exposed.
"""
import json
import os
import sys
import urllib.error
import urllib.request

COCKPIT = os.environ.get("NOEDIS_COCKPIT_URL", "http://127.0.0.1:3200")
ENDPOINT = f"{COCKPIT}/noedis/api/voice/delegate"
TIMEOUT_S = 45


def fail(message: str, code: int = 1) -> int:
    print(json.dumps({"error": message}, ensure_ascii=False))
    return code


def main() -> int:
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        return fail("usage: delegate.py <title> [body] [priority]", 2)

    token = os.environ.get("NOEDIS_BRIDGE_TOKEN", "").strip()
    if not token:
        return fail("NOEDIS_BRIDGE_TOKEN is not set — nothing was sent", 3)

    payload = {
        "title": sys.argv[1].strip(),
        "description": (sys.argv[2] if len(sys.argv) > 2 else "").strip(),
        "priority": (sys.argv[3] if len(sys.argv) > 3 else "medium").strip() or "medium",
        "source": "hermes",
    }

    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
            print(response.read().decode("utf-8").strip())
            return 0
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:400]
        return fail(f"cockpit answered HTTP {exc.code}: {detail}", 4)
    except Exception as exc:  # noqa: BLE001 - the message is the point
        return fail(f"could not reach the cockpit at {ENDPOINT}: {exc}", 5)


if __name__ == "__main__":
    raise SystemExit(main())
