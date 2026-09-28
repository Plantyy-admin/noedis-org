#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Deploy the NOEDIS Command Center to the VPS.
#
#   ./deploy/deploy-command-center.sh
#
# The app is installed to /srv/noedis/command-center, runs as the
# noedis-command-center systemd service on 127.0.0.1:3200, and is
# published by Caddy at the root of https://noedis.org/.
#
# Sign-in: the cockpit now carries its OWN session gate (a signed
# cookie, `lib/auth.js`) instead of Caddy's HTTP basic auth, because
# basic auth has no working sign-out. Credentials are written into the
# server-side .env below; Caddy's basic_auth is deliberately left off so
# the operator is prompted once, by the cockpit's own screen.
#
# Idempotent: safe to re-run. Caddy is backed up and validated
# before being reloaded.
# ══════════════════════════════════════════════════════════════
set -euo pipefail

# Credentials come from deploy/.vps.env (git-ignored) or the environment.
# They are NEVER defaulted here — this file is committed.
VPS_ENV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.vps.env"
if [[ -f "$VPS_ENV" ]]; then
  set -a; . "$VPS_ENV"; set +a
fi

VPS_HOST="${VPS_HOST:-76.13.154.124}"
VPS_PORT="${VPS_PORT:-501}"
VPS_USER="${VPS_USER:-vpsadmin}"
VPS_PASS="${VPS_PASS:?set VPS_PASS in deploy/.vps.env or the environment}"
COMPANY_ID="${NOEDIS_COMPANY_ID:-8b5aa752-5199-4f51-9a9c-817647ef1aae}"
API_KEY="${PAPERCLIP_API_KEY:?set PAPERCLIP_API_KEY in deploy/.vps.env or the environment}"
REMOTE_DIR="/srv/noedis/command-center"

# ── cockpit sign-in ───────────────────────────────────────────
# NOEDIS_AUTH_OFF=1 publishes the cockpit openly (private hosts only).
AUTH_OFF="${NOEDIS_AUTH_OFF:-0}"
AUTH_USER="${NOEDIS_AUTH_USER:-noedis}"
AUTH_PASS="${NOEDIS_AUTH_PASS:-}"
AUTH_SECRET="${NOEDIS_SESSION_SECRET:-}"
AUTH_HOURS="${NOEDIS_SESSION_HOURS:-12}"

# ── Hermes Agent bridge ───────────────────────────────────────
# The voice panel talks to Hermes' OpenAI-compatible API server on the
# loopback interface; the bridge token is what lets the agent hand a task to
# NOE without holding a cockpit session.
HERMES_KEY="${HERMES_API_KEY:-}"
BRIDGE_TOKEN="${NOEDIS_BRIDGE_TOKEN:-}"
NOE_AGENT_ID="${NOEDIS_NOE_AGENT_ID:-3aeb9559-c953-4e1e-b551-c8201554c98e}"
if [[ -z "$HERMES_KEY" || -z "$BRIDGE_TOKEN" ]]; then
  echo "WARNING: HERMES_API_KEY / NOEDIS_BRIDGE_TOKEN are not set — the VOICE panel" >&2
  echo "         will report Hermes as offline. Set them in deploy/.vps.env." >&2
fi

if [[ "$AUTH_OFF" != "1" && -z "$AUTH_PASS" ]]; then
  cat >&2 <<'MSG'
ERROR: NOEDIS_AUTH_PASS is not set, so the cockpit would be published with no
       sign-in at all. Put it in deploy/.vps.env (git-ignored):

           NOEDIS_AUTH_USER='noedis'
           NOEDIS_AUTH_PASS='...'
           NOEDIS_SESSION_SECRET='...'

       Or run with NOEDIS_AUTH_OFF=1 if this host is genuinely private.
MSG
  exit 1
fi

# A missing signing key would be regenerated every restart, silently signing
# every operator out; make one here and keep it in deploy/.vps.env.
if [[ "$AUTH_OFF" != "1" && -z "$AUTH_SECRET" ]]; then
  AUTH_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  printf "\nNOEDIS_SESSION_SECRET='%s'\n" "$AUTH_SECRET" >>"$VPS_ENV"
  echo "▸ generated NOEDIS_SESSION_SECRET and appended it to deploy/.vps.env"
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SSH_OPTS=(-F /dev/null -o PreferredAuthentications=password -o PubkeyAuthentication=no
          -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$VPS_PORT")
SCP_OPTS=(-F /dev/null -o PreferredAuthentications=password -o PubkeyAuthentication=no
          -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$VPS_PORT")

remote() { sshpass -p "$VPS_PASS" ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_HOST" "$@"; }

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

say "Packaging command-center"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
tar -czf "$STAGE/command-center.tgz" \
  --exclude=node_modules \
  --exclude=test/out \
  --exclude=.env \
  --exclude='*.log' \
  command-center

say "Uploading to $VPS_USER@$VPS_HOST:$REMOTE_DIR"
remote "mkdir -p $REMOTE_DIR"
sshpass -p "$VPS_PASS" scp "${SCP_OPTS[@]}" "$STAGE/command-center.tgz" "$VPS_USER@$VPS_HOST:/tmp/command-center.tgz"

say "Installing on the VPS"
remote bash -s <<REMOTE
set -euo pipefail
mkdir -p $REMOTE_DIR
tar -xzf /tmp/command-center.tgz -C $REMOTE_DIR --strip-components=1
rm -f /tmp/command-center.tgz

# Runtime configuration — the board key stays on the server, never in the browser.
cat > $REMOTE_DIR/.env <<ENV
NOEDIS_PORT=3200
NOEDIS_HOST=127.0.0.1
PAPERCLIP_URL=http://127.0.0.1:3100
PAPERCLIP_API_KEY=$API_KEY
NOEDIS_COMPANY_ID=$COMPANY_ID
NOEDIS_PAPERCLIP_UI_URL=https://www.noedis.org
NOEDIS_POLL_MS=4000
NOEDIS_AUTH_USER=$AUTH_USER
NOEDIS_AUTH_PASS=$AUTH_PASS
NOEDIS_SESSION_SECRET=$AUTH_SECRET
NOEDIS_SESSION_HOURS=$AUTH_HOURS
HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=$HERMES_KEY
HERMES_MODEL=hermes-agent
HERMES_CLI=/home/vpsadmin/.local/bin/hermes
HERMES_VOICE_LANG=cs
HERMES_TTS_VOICE=cs-CZ-VlastaNeural
NOEDIS_NOE_AGENT_ID=$NOE_AGENT_ID
NOEDIS_BRIDGE_TOKEN=$BRIDGE_TOKEN
NOEDIS_DELEGATION_LOG=/srv/noedis/logs/delegations.jsonl
ENV
chmod 600 $REMOTE_DIR/.env
sudo mkdir -p /srv/noedis/logs && sudo chown vpsadmin:vpsadmin /srv/noedis/logs

cd $REMOTE_DIR
if [ ! -d node_modules ]; then
  npm install --omit=dev --no-audit --no-fund
fi

sudo tee /etc/systemd/system/noedis-command-center.service >/dev/null <<'UNIT'
[Unit]
Description=NOEDIS Command Center
After=network-online.target noedis-paperclip.service
Wants=network-online.target

[Service]
Type=simple
User=vpsadmin
Group=vpsadmin
WorkingDirectory=/srv/noedis/command-center
ExecStart=/usr/bin/node /srv/noedis/command-center/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
LimitNOFILE=65536
StandardOutput=append:/srv/noedis/logs/command-center.log
StandardError=append:/srv/noedis/logs/command-center.log

[Install]
WantedBy=multi-user.target
UNIT

sudo mkdir -p /srv/noedis/logs
sudo chown vpsadmin:vpsadmin /srv/noedis/logs
sudo systemctl daemon-reload
sudo systemctl enable noedis-command-center >/dev/null 2>&1 || true
sudo systemctl restart noedis-command-center
sleep 3
systemctl is-active noedis-command-center
REMOTE

say "Health check (direct)"
remote "curl -s -m 10 http://127.0.0.1:3200/noedis/health | head -c 400; echo"
remote "curl -s -m 10 -o /dev/null -w '  sign-in screen -> %{http_code}\n' http://127.0.0.1:3200/noedis/login"

say "Publishing through Caddy at the root of https://noedis.org/"
sshpass -p "$VPS_PASS" scp "${SCP_OPTS[@]}" deploy/caddy-command-center.py "$VPS_USER@$VPS_HOST:/tmp/caddy-command-center.py"
# No NOEDIS_AUTH_* is exported for this step on purpose: the cockpit gates
# itself now, and Caddy's basic_auth would only add a second prompt that the
# cockpit's own sign-out cannot clear.
remote bash -s <<'REMOTE'
set -euo pipefail
CADDY=/etc/caddy/Caddyfile
STAMP=$(date +%Y%m%d-%H%M%S)
sudo cp "$CADDY" "/etc/caddy/Caddyfile.bak-command-center-$STAMP"

sudo env -u NOEDIS_AUTH_USER -u NOEDIS_AUTH_HASH -u NOEDIS_AUTH_REQUIRED \
  python3 /tmp/caddy-command-center.py "$CADDY"

if ! sudo caddy validate --config "$CADDY" --adapter caddyfile >/dev/null 2>&1; then
  echo "Caddy validation FAILED — restoring backup"
  sudo cp "/etc/caddy/Caddyfile.bak-command-center-$STAMP" "$CADDY"
  exit 1
fi
sudo systemctl reload caddy
sleep 2
systemctl is-active caddy
REMOTE

say "Verifying public URLs"
# Each probe is allowed to fail: a workstation that cannot reach the public host
# must not turn a successful deploy into a non-zero exit.
curl -s -m 20 -o /dev/null -w "  https://noedis.org/                -> %{http_code} %{redirect_url}\n" https://noedis.org/ || echo "  https://noedis.org/                -> unreachable from here"
curl -s -m 20 -o /dev/null -w "  https://noedis.org/noedis/login    -> %{http_code}\n" https://noedis.org/noedis/login || echo "  https://noedis.org/noedis/login    -> unreachable from here"
curl -s -m 20 -o /dev/null -w "  https://noedis.org/noedis/health   -> %{http_code}\n" https://noedis.org/noedis/health || echo "  https://noedis.org/noedis/health   -> unreachable from here"
curl -s -m 20 -o /dev/null -w "  https://noedis.org/css/style.css   -> %{http_code} (302 while signed out)\n" https://noedis.org/css/style.css || echo "  https://noedis.org/css/style.css   -> unreachable from here"
curl -s -m 20 -o /dev/null -w "  https://www.noedis.org/            -> %{http_code} (Paperclip)\n" https://www.noedis.org/ || echo "  https://www.noedis.org/            -> unreachable from here"

if [[ "$AUTH_OFF" == "1" ]]; then
  echo "  cockpit sign-in: OFF — published openly"
else
  echo "  cockpit sign-in: ON  — user '$AUTH_USER'"
fi

say "Done"
