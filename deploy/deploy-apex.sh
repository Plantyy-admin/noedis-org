#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Deploy the APEX orb that fills the cockpit's VOICE panel.
#
#   ./deploy/deploy-apex.sh
#
# Clones RubenM1990/APEX-UI, applies the two NOEDIS changes (basePath /voice
# and a postMessage listener so the orb follows the voice loop), builds it on
# the VPS and runs it as `noedis-apex` on 127.0.0.1:3400. Caddy publishes it at
# https://noedis.org/voice.
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
WORK="${REPO_ROOT}/.noedis-work/apex"
REMOTE_DIR="/srv/noedis/apex-ui"

SSH_OPTS=(-F /dev/null -o PreferredAuthentications=password -o PubkeyAuthentication=no
          -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -p "$VPS_PORT")
remote() { sshpass -p "$VPS_PASS" ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_HOST" "$@"; }
say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

say "Fetching APEX-UI"
if [[ -d "$WORK/.git" ]]; then
  git -C "$WORK" pull --ff-only
else
  mkdir -p "$WORK"
  git clone --depth 1 https://github.com/RubenM1990/APEX-UI.git "$WORK"
fi

say "Applying the NOEDIS changes"
python3 - "$WORK" <<'PY'
import io, os, sys
work = sys.argv[1]

cfg = os.path.join(work, "next.config.mjs")
io.open(cfg, "w", encoding="utf-8").write('''/** @type {import('next').NextConfig} */
const nextConfig = {
  // Served by Caddy under the cockpit's own host, so the orb lives at
  // https://noedis.org/voice/ and inherits the same sign-in gate.
  basePath: "/voice",
  reactStrictMode: true,
};

export default nextConfig;
''')

world = os.path.join(work, "components", "ApexWorld.tsx")
src = io.open(world, encoding="utf-8").read()
if "apex: state" not in src:
    anchor = "  useEffect(() => () => { if (showTimer.current) clearTimeout(showTimer.current); }, []);\n"
    if anchor not in src:
        sys.exit("ApexWorld.tsx: anchor not found — the upstream file changed")
    src = src.replace(anchor, anchor + '''
  // Driven from the NOEDIS cockpit. The VOICE panel posts { apex: state } as
  // the conversation moves, so the orb reflects what is actually happening
  // instead of only reacting to a tap. "listening" has no own state in the
  // original art, so it borrows the active one.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const next = event?.data?.apex;
      if (next !== "idle" && next !== "thinking" && next !== "speaking" && next !== "listening") return;
      if (showTimer.current) clearTimeout(showTimer.current);
      setShowState(next === "listening" ? "thinking" : (next as OrbState));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
''', 1)
    io.open(world, "w", encoding="utf-8").write(src)
print("  basePath + postMessage listener in place")
PY

say "Uploading to $REMOTE_DIR"
remote "mkdir -p $REMOTE_DIR && rm -rf $REMOTE_DIR/*"
timeout 200 bash -c "tar -czf - -C '$WORK' --exclude=./.git --exclude=./node_modules --exclude=./.next . | \
  $(printf '%q ' sshpass -p "$VPS_PASS" ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_HOST" "tar -xzf - -C $REMOTE_DIR")"

say "Building on the VPS"
remote "set -e
export PATH=\"\$HOME/.hermes/tools/node-26.7.0-linux-x64/bin:\$HOME/.hermes/tools/npm-12.0.2-linux-x64/bin:\$PATH\"
cd $REMOTE_DIR
npm install --no-audit --no-fund >/tmp/apex-npm.log 2>&1 || { tail -20 /tmp/apex-npm.log; exit 1; }
npm run build >/tmp/apex-build.log 2>&1 || { tail -30 /tmp/apex-build.log; exit 1; }
tail -6 /tmp/apex-build.log"

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
curl -s -o /dev/null -w '  http://127.0.0.1:3400/voice -> %{http_code}\n' http://127.0.0.1:3400/voice"

say "Done — Caddy publishes it at /voice via deploy/caddy-command-center.py"
