#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Lock the NOEDIS origin down to Cloudflare.
#
# Cloudflare Access (and the proxy generally) only protects traffic that
# travels THROUGH Cloudflare. Anyone who learns the origin IP can connect
# straight to it with `Host: noedis.org` and reach Caddy directly — which
# bypasses Access completely. This was verified on 2026-09-26: a direct
# request to the origin returned the cockpit and its API with no login.
#
# This script closes that hole at the firewall: port 443 accepts traffic
# only from Cloudflare's published ranges.
#
# Port 80 deliberately stays open. Caddy answers the ACME HTTP-01 challenge
# there, and Let's Encrypt does not come from Cloudflare — restricting 80
# would break certificate renewal. HTTP only ever returns a redirect to
# HTTPS, so it exposes no content.
#
# !! IMPORTANT !!
# The firewall works on the IP:port level, not per hostname, so this rule
# covers EVERY site served by this VPS at once. Any DNS record still pointing
# straight at the origin (grey cloud / "DNS only" in Cloudflare) is cut off
# the moment this runs. Before enabling, make sure every A/AAAA record for
# these domains is proxied — orange cloud, not grey.
# This bit us once: www.noedis.io was DNS-only and went dark until it was
# switched to proxied.
#
# Usage:
#   sudo ./firewall-cloudflare-only.sh
#   sudo ./firewall-cloudflare-only.sh --ssh-from 203.0.113.7
#
# Idempotent and safe to re-run. Re-run it whenever Cloudflare's ranges
# change (they do, occasionally) — e.g. from a monthly systemd timer:
#
#   /etc/systemd/system/cloudflare-firewall.service
#     [Unit]
#     Description=Restrict origin 443 to Cloudflare
#     [Service]
#     Type=oneshot
#     ExecStart=/srv/noedis/deploy/firewall-cloudflare-only.sh
#   /etc/systemd/system/cloudflare-firewall.timer
#     [Unit]
#     Description=Refresh Cloudflare ranges monthly
#     [Timer]
#     OnCalendar=monthly
#     Persistent=true
#     [Install]
#     WantedBy=timers.target
# ══════════════════════════════════════════════════════════════
set -euo pipefail

V4_URL="https://www.cloudflare.com/ips-v4"
V6_URL="https://www.cloudflare.com/ips-v6"
SSH_FROM=""
PROTECTED_PORTS=(443)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ssh-from)
      SSH_FROM="${2:?--ssh-from needs an IP or CIDR}"
      shift 2
      ;;
    -h|--help)
      sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run me with sudo (ufw needs root)." >&2
  exit 1
fi

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

# ── fetch Cloudflare's ranges BEFORE touching anything ────────
# If this fails we abort untouched: deleting the open rules without a
# replacement list would take the whole site down.
say "Fetching Cloudflare ranges"
CF4="$(curl -fsS -m 25 "$V4_URL" | grep -E '^[0-9]' || true)"
CF6="$(curl -fsS -m 25 "$V6_URL" | grep -E '^[0-9a-fA-F]' || true)"
n4=$(grep -c . <<<"$CF4" || true)
n6=$(grep -c . <<<"$CF6" || true)

if [[ "$n4" -lt 10 || "$n6" -lt 5 ]]; then
  echo "ERROR: Cloudflare returned $n4 IPv4 / $n6 IPv6 ranges — refusing to continue." >&2
  echo "       (expected ~15 and ~7; leaving the firewall untouched)" >&2
  exit 1
fi
echo "  got $n4 IPv4 and $n6 IPv6 ranges"

# ── back up ───────────────────────────────────────────────────
STAMP="$(date +%Y%m%d-%H%M%S)"
cp -a /etc/ufw "/root/ufw-backup-$STAMP"
say "Backup: /root/ufw-backup-$STAMP"

# ── add the allows FIRST, so 443 is never briefly unreachable ──
# (adding first, deleting after — otherwise there is a window with no
#  Cloudflare allow rule in place and the site 522s)
say "Allowing 443 from Cloudflare"
added=0
for ip in $CF4 $CF6; do
  ufw allow from "$ip" to any port 443 proto tcp >/dev/null
  added=$((added + 1))
done
echo "  ensured $added allow rules for 443/tcp"

# ── now drop 443 rules open to the whole world ────────────────
say "Removing world-open 443 rules"
removed=0
# Delete from the highest rule number down so earlier numbers stay valid.
mapfile -t nums < <(
  ufw status numbered \
    | grep -E '443/tcp' \
    | grep -E 'Anywhere( \(v6\))?[[:space:]]*$' \
    | grep -oE '^\[[[:space:]]*[0-9]+' \
    | tr -d '[ ' \
    | sort -rn
)
for n in "${nums[@]:-}"; do
  [[ -n "$n" ]] || continue
  ufw --force delete "$n" >/dev/null
  removed=$((removed + 1))
done
echo "  removed $removed world-open rule(s)"

# ── optionally pin SSH to a single source ─────────────────────
if [[ -n "$SSH_FROM" ]]; then
  say "Pinning SSH to $SSH_FROM"
  ufw allow from "$SSH_FROM" to any port 501 proto tcp >/dev/null
  ufw allow from "$SSH_FROM" to any port 22 proto tcp >/dev/null
  for n in $(ufw status numbered \
               | grep -E '(501|22)/tcp' \
               | grep -E 'Anywhere( \(v6\))?[[:space:]]*$' \
               | grep -oE '^\[[[:space:]]*[0-9]+' \
               | tr -d '[ ' \
               | sort -rn); do
    ufw --force delete "$n" >/dev/null
  done
  echo "  SSH now accepts only $SSH_FROM"
else
  say "SSH left as-is"
  echo "  NOTE: ports 501 and 22 are still open to the whole internet with"
  echo "        password auth. Re-run with --ssh-from <your-ip> to pin them."
fi

# ── report ────────────────────────────────────────────────────
say "Result"
ufw status numbered | grep -E '443/tcp|Anywhere' | head -40

say "Checks"
printf '  port 80 open for ACME : %s\n' "$(ufw status | grep -c '^80/tcp.*Anywhere' || true) rule(s)"
printf '  443 world-open rules  : %s (must be 0)\n' \
  "$(ufw status | grep '443/tcp' | grep -cE 'Anywhere( \(v6\))?[[:space:]]*$' || true)"
echo
echo "Now verify from outside that the origin no longer answers directly:"
echo "  curl --resolve noedis.org:443:\$(curl -s ifconfig.me) https://noedis.org/   # must NOT return the cockpit"
echo "and that the Cloudflare path still works:"
echo "  curl -sI https://www.noedis.org/ | head -1                                 # must be 200"
