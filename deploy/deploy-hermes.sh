#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# Deploy Hermes Agent — the cockpit's voice and WhatsApp brain.
#
#   ./deploy/deploy-hermes.sh
#
# What it does, all of it idempotent:
#   1. installs Hermes Agent as the service user (official installer) and the
#      `voice` + `edge-tts` extras, so Whisper and Czech speech work locally
#   2. points it at OpenRouter and picks a tool-capable model
#   3. turns on its OpenAI-compatible API server on the loopback interface
#   4. sets the STT/TTS voice, WhatsApp self-chat and the cockpit bridge token
#   5. installs the noedis-company skill that hands work to NOE
#   6. runs the gateway as a lingering user service
#
# Pairing WhatsApp is a separate, interactive step — the cockpit's VOICE panel
# shows a live QR for it (see docs/COMMAND-CENTER.md §7c).
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
cd "$REPO_ROOT"

OPENROUTER_KEY="${OPENROUTER_API_KEY:?set OPENROUTER_API_KEY in deploy/.vps.env}"
HERMES_KEY="${HERMES_API_KEY:?set HERMES_API_KEY in deploy/.vps.env}"
BRIDGE_TOKEN="${NOEDIS_BRIDGE_TOKEN:?set NOEDIS_BRIDGE_TOKEN in deploy/.vps.env}"
WHATSAPP_NUMBER="${WHATSAPP_OWNER_NUMBER:-}"
# Telegram is the cockpit's messaging channel; WhatsApp is parked by
# default because an enabled-but-unpaired platform leaves the gateway
# DEGRADED forever. Set WHATSAPP_ENABLED=true in deploy/.vps.env to
# bring the QR pairing flow back.
WA_ON="${WHATSAPP_ENABLED:-false}"
TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_USERS="${TELEGRAM_ALLOWED_USERS:-}"
# Every Hermes/Nous model on OpenRouter is text-only, so the agent cannot call
# tools on one. The framework still does the work; a tool-capable model runs it.
HERMES_MODEL_NAME="${HERMES_MODEL_NAME:-~deepseek/deepseek-flash-latest}"

SSH_OPTS=(-F /dev/null -o PreferredAuthentications=password -o PubkeyAuthentication=no
          -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -p "$VPS_PORT")
remote() { sshpass -p "$VPS_PASS" ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_HOST" "$@"; }
put() { # put <local> <remote>
  timeout 60 bash -c "cat '$1' | $(printf '%q ' sshpass -p "$VPS_PASS" ssh "${SSH_OPTS[@]}" "$VPS_USER@$VPS_HOST" "cat > '$2'")"
}

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

say "Installing Hermes Agent (skips if already present)"
remote 'set -e
export PATH="$HOME/.local/bin:$PATH"
if [ ! -x "$HOME/.local/bin/hermes" ]; then
  curl -fsSL https://hermes-agent.nousresearch.com/install.sh -o /tmp/hermes-install.sh
  # The browser tools are wanted (web search, page reading), so no --skip-browser:
  # that flag records an opt-out that later installs and updates honour.
  bash /tmp/hermes-install.sh --non-interactive > /tmp/hermes-install.log 2>&1 || {
    echo "installer failed — last lines:"; grep -vE "^ +[a-z]+: +[0-9.]+%" /tmp/hermes-install.log | tail -20; exit 1; }
fi
hermes --version | head -1'

say "Adding the voice, edge-tts and browser extras"
remote 'export PATH="$HOME/.local/bin:$PATH"
hermes pm install --extra voice --extra edge-tts >/tmp/hermes-voice.log 2>&1 || {
  grep -vE "^ +[a-z]+: +[0-9.]+%" /tmp/hermes-voice.log | tail -20; exit 1; }
# The pinned Chromium behind web_search / web_extract / the browser toolset.
# Naming it explicitly is what undoes an earlier `--skip-browser` opt-out.
hermes pm install agent-browser >/tmp/hermes-browser.log 2>&1 || {
  grep -vE "^ +[a-z]+: +[0-9.]+%" /tmp/hermes-browser.log | tail -20; exit 1; }
echo "  ✓ voice + browser extras ready"
hermes tools list 2>/dev/null | grep -iE "web |browser " | sed "s/^/  /"'

say "Configuring model, API server, voice and messaging"
put "${REPO_ROOT}/deploy/hermes-setup.sh" /tmp/hermes-setup.sh
remote "chmod +x /tmp/hermes-setup.sh
HERMES_API_KEY='$HERMES_KEY' NOEDIS_BRIDGE_TOKEN='$BRIDGE_TOKEN' \
OPENROUTER_KEY='$OPENROUTER_KEY' HERMES_MODEL_NAME='$HERMES_MODEL_NAME' \
WHATSAPP_OWNER_NUMBER='$WHATSAPP_NUMBER' WHATSAPP_ENABLED='$WA_ON' \
TELEGRAM_BOT_TOKEN='$TG_TOKEN' TELEGRAM_ALLOWED_USERS='$TG_USERS' \
bash /tmp/hermes-setup.sh; rm -f /tmp/hermes-setup.sh"

say "Installing the noedis-company skill"
remote "mkdir -p /tmp/noedis-skill ~/.hermes/skills/noedis-company"
put "${REPO_ROOT}/command-center/hermes/skills/noedis-company/SKILL.md" /tmp/noedis-skill/SKILL.md
put "${REPO_ROOT}/command-center/hermes/skills/noedis-company/delegate.py" /tmp/noedis-skill/delegate.py
remote 'install -m 644 /tmp/noedis-skill/SKILL.md ~/.hermes/skills/noedis-company/SKILL.md
install -m 755 /tmp/noedis-skill/delegate.py ~/.hermes/skills/noedis-company/delegate.py
rm -rf /tmp/noedis-skill; ls -l ~/.hermes/skills/noedis-company | tail -2'

# Hermes records per-platform health in gateway_state.json and never
# clears the entry when a platform is switched off: the record keeps the
# dead run's writer_pid and its last error forever, so `gateway status`
# keeps reporting "WhatsApp enabled but not paired" for a platform that
# is no longer even started.
#
# Order matters, and both halves were learned the hard way. The gateway
# holds this file in memory and rewrites it whole — once on shutdown and
# again as it runs — so cleaning it while a gateway is alive only lasts
# until that gateway's next write. The old process must be down first,
# and the new one must not start until the file is clean.
say "Stopping the gateway so its final state write cannot undo the cleanup"
remote 'export PATH="$HOME/.local/bin:$PATH"
sudo loginctl enable-linger vpsadmin
hermes gateway install >/dev/null 2>&1 || true
hermes gateway stop >/dev/null 2>&1 || true
sleep 4
hermes gateway status 2>&1 | grep -iE "inactive|dead|stopped" | head -2 || true'

say "Dropping stale platform health records"
put "${REPO_ROOT}/deploy/hermes-clean-state.py" /tmp/hermes-clean-state.py
remote "WHATSAPP_ENABLED='$WA_ON' python3 /tmp/hermes-clean-state.py; rm -f /tmp/hermes-clean-state.py"

say "Starting the gateway"
remote 'export PATH="$HOME/.local/bin:$PATH"
hermes gateway start >/dev/null 2>&1 || hermes gateway restart >/dev/null 2>&1 || true
sleep 12
hermes gateway status 2>&1 | tail -6'

say "Checking the API server"
remote 'K=$(grep -m1 ^API_SERVER_KEY= ~/.hermes/.env | cut -d= -f2-)
curl -s -m 10 http://127.0.0.1:8642/health; echo
curl -s -m 10 -H "Authorization: Bearer $K" http://127.0.0.1:8642/v1/models | head -c 160; echo'

say "Done — Telegram is the cockpit's channel (WhatsApp parked if disabled)"
