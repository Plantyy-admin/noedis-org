#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Deploy the NOEDIS Command Center to the VPS.
#
#   ./deploy/deploy-command-center.sh
#
# The app is installed to /srv/noedis/command-center, runs as the
# noedis-command-center systemd service on 127.0.0.1:3200, and is
# published by Caddy at https://noedis.org/command/
#
# Idempotent: safe to re-run. Caddy is backed up and validated
# before being reloaded.
# ══════════════════════════════════════════════════════════════
set -euo pipefail

VPS_HOST="${VPS_HOST:-76.13.154.124}"
VPS_PORT="${VPS_PORT:-501}"
VPS_USER="${VPS_USER:-vpsadmin}"
VPS_PASS="${VPS_PASS:-REDACTED}"
COMPANY_ID="${NOEDIS_COMPANY_ID:-8b5aa752-5199-4f51-9a9c-817647ef1aae}"
API_KEY="${PAPERCLIP_API_KEY:-REDACTED}"
REMOTE_DIR="/srv/noedis/command-center"

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
NOEDIS_PAPERCLIP_UI_URL=https://noedis.org
NOEDIS_POLL_MS=4000
ENV
chmod 600 $REMOTE_DIR/.env

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

say "Publishing through Caddy at https://noedis.org/command/"
sshpass -p "$VPS_PASS" scp "${SCP_OPTS[@]}" deploy/caddy-command-center.py "$VPS_USER@$VPS_HOST:/tmp/caddy-command-center.py"
remote bash -s <<'REMOTE'
set -euo pipefail
CADDY=/etc/caddy/Caddyfile
STAMP=$(date +%Y%m%d-%H%M%S)
sudo cp "$CADDY" "/etc/caddy/Caddyfile.bak-command-center-$STAMP"

sudo python3 /tmp/caddy-command-center.py "$CADDY"

if ! sudo caddy validate --config "$CADDY" --adapter caddyfile >/dev/null 2>&1; then
  echo "Caddy validation FAILED — restoring backup"
  sudo cp "/etc/caddy/Caddyfile.bak-command-center-$STAMP" "$CADDY"
  exit 1
fi
sudo systemctl reload caddy
sleep 2
systemctl is-active caddy
REMOTE

say "Verifying public URL"
curl -s -m 15 -o /dev/null -w "  https://noedis.org/command/  -> %{http_code}\n" https://noedis.org/command/
curl -s -m 15 -o /dev/null -w "  https://noedis.org/          -> %{http_code} (Paperclip, unchanged)\n" https://noedis.org/
curl -s -m 15 https://noedis.org/command/noedis/health | head -c 300; echo

say "Done"
