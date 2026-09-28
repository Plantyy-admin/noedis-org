#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Deploy the NOEDIS APEX orb that fills the cockpit's VOICE panel.
#
#   ./deploy/deploy-apex.sh
#
# The source of truth is `apex-orb/` in this repo. It started life as a clone
# of RubenM1990/APEX-UI (MIT — see apex-orb/CREDITS.md) and has been re-skinned
# for NOEDIS: the company's own colours, its own agent constellation instead of
# the demo roster, and a postMessage contract with the cockpit's voice loop.
# Because those changes touch most of the components, the app is vendored here
# rather than re-patched onto a fresh upstream checkout on every deploy — a
# `git pull` would have fought the local edits, and a patch script would have
# had to grow to a dozen files.
#
# The script uploads `apex-orb/`, builds it on the VPS and runs it as
# `noedis-apex` on 127.0.0.1:3400. Caddy publishes it at https://noedis.org/voice.
# ══════════════════════════════════════════════════════════════
set -euo pipefail

VPS_ENV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.vps.env"
if [[ -f "$VPS_ENV" ]]; then
  set -a; . "$VPS_ENV"; set +a
fi

VPS_HOST="${VPS_HOST:-76.13.154.124}"
VPS_PORT="${VPS_PORT:-501}"
VPS_USER="${VPS_USER:-vpsadmin}"
VPS_PASS="${VPS_PASS:?set VPS_PASS in deploy/.vps.env}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${REPO_ROOT}/apex-orb"
REMOTE_DIR="/srv/noedis/apex-ui"

if [[ ! -f "$WORK/package.json" ]]; then
  echo "ERROR: $WORK is missing — the orb source lives in apex-orb/ in this repo." >&2
  exit 1
fi

SSH_OPTS=(-F /dev/null -o PreferredAuthentications=password -o PubkeyAuthentication=no
          -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -p "$VPS_PORT")
remote() { sshpass -p "$VPS_PASS" ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_HOST" "$@"; }
say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

say "Uploading apex-orb/ to $REMOTE_DIR"
# node_modules and .next are built on the VPS; only sources travel. The remote
# tree is cleared of everything else so a deleted file cannot linger and keep
# rendering an old component.
remote "mkdir -p $REMOTE_DIR && find $REMOTE_DIR -mindepth 1 -maxdepth 1 \
  ! -name node_modules ! -name .next -exec rm -rf {} +"
timeout 240 bash -c "tar -czf - -C '$WORK' \
  --exclude=./node_modules --exclude=./.next --exclude=./.git . | \
  $(printf '%q ' sshpass -p "$VPS_PASS" ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_HOST" "tar -xzf - -C $REMOTE_DIR")"

say "Building on the VPS"
remote "set -e
export PATH=\"\$HOME/.hermes/tools/node-26.7.0-linux-x64/bin:\$HOME/.hermes/tools/npm-12.0.2-linux-x64/bin:\$PATH\"
cd $REMOTE_DIR
npm install --no-audit --no-fund >/tmp/apex-npm.log 2>&1 || { tail -20 /tmp/apex-npm.log; exit 1; }
npm run build >/tmp/apex-build.log 2>&1 || { tail -30 /tmp/apex-build.log; exit 1; }
tail -8 /tmp/apex-build.log"

say "Service + start"
remote "set -e
NODE=\$(ls ~/.hermes/tools/node-*/bin/node | head -1)
sudo tee /etc/systemd/system/noedis-apex.service >/dev/null <<UNIT
[Unit]
Description=NOEDIS APEX orb (VOICE panel)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=vpsadmin
Group=vpsadmin
WorkingDirectory=$REMOTE_DIR
Environment=NODE_ENV=production
Environment=PORT=3400
ExecStart=\$NODE $REMOTE_DIR/node_modules/next/dist/bin/next start -p 3400 -H 127.0.0.1
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable noedis-apex >/dev/null 2>&1 || true
sudo systemctl restart noedis-apex
sleep 5
systemctl is-active noedis-apex
curl -s -o /dev/null -w '  http://127.0.0.1:3400/voice -> %{http_code}\n' http://127.0.0.1:3400/voice
curl -s http://127.0.0.1:3400/voice | grep -o '<title>[^<]*</title>' | head -1"

say "Done — Caddy publishes it at /voice via deploy/caddy-command-center.py"
