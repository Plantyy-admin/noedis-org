#!/usr/bin/env python3
"""Drop platform health records for platforms we switched off.

Runs ON THE VPS after the gateway restart, via deploy/deploy-hermes.sh.

Hermes keeps per-platform health in ~/.hermes/gateway_state.json and only
ever *writes* entries — a platform that is no longer started keeps its
record, including the writer_pid of the dead run and its last error. So
`hermes gateway status` reports:

    ⚠ whatsapp: WhatsApp enabled but not paired

for a platform that is not even in the current configuration, because a
previous process wrote that record before WHATSAPP_ENABLED was set to
false. Anyone reading the status is then told the opposite of the truth.

Read-modify-write, and only ever remove: records for platforms that are
still running are left exactly as Hermes wrote them.
"""
import json
import os
import sys

HERMES_HOME = os.environ.get("HERMES_HOME") or os.path.expanduser("~/.hermes")
STATE = os.path.join(HERMES_HOME, "gateway_state.json")

TRUTHY = {"1", "true", "yes", "on"}


def enabled(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in TRUTHY


def main() -> int:
    # Platform -> the env flag deploy/hermes-setup.sh writes for it.
    owned = {"whatsapp": "WHATSAPP_ENABLED"}

    if not os.path.exists(STATE):
        print("  no gateway_state.json yet")
        return 0

    with open(STATE, encoding="utf-8") as fh:
        state = json.load(fh)

    platforms = state.get("platforms")
    if not isinstance(platforms, dict):
        print("  no platform records present")
        return 0

    dropped = []
    for platform, flag in owned.items():
        if enabled(flag):
            continue
        record = platforms.pop(platform, None)
        if record is not None:
            dropped.append(
                "{} ({}: {} from pid {})".format(
                    platform,
                    record.get("state"),
                    record.get("error_code"),
                    record.get("writer_pid"),
                )
            )

    if not dropped:
        print("  nothing stale to drop")
        return 0

    tmp = STATE + ".new"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(state, fh, indent=2)
    os.replace(tmp, STATE)
    for line in dropped:
        print("  dropped stale record: " + line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
