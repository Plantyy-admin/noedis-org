#!/usr/bin/env bash
# Configure Hermes Agent for the NOEDIS cockpit. Runs ON THE VPS as the
# service user; deploy/deploy-hermes.sh uploads it and supplies the values.
# Idempotent: every step overwrites the same keys.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

OPENROUTER_KEY="${OPENROUTER_KEY:?}"
API_KEY="${HERMES_API_KEY:?}"
BRIDGE="${NOEDIS_BRIDGE_TOKEN:?}"
MODEL="${HERMES_MODEL_NAME:-~deepseek/deepseek-flash-latest}"
WA="${WHATSAPP_OWNER_NUMBER:?}"
TTS="${HERMES_TTS_VOICE:-cs-CZ-VlastaNeural}"
STT_MODEL="${HERMES_STT_MODEL:-small}"

s() { printf '  %s\n' "$*"; }

s "provider + model ($MODEL)"
hermes config set model.provider openrouter >/dev/null
hermes config set model.default "$MODEL" >/dev/null
hermes config set OPENROUTER_API_KEY "$OPENROUTER_KEY" >/dev/null

s "API server on 127.0.0.1:8642"
hermes config set API_SERVER_ENABLED true >/dev/null
hermes config set API_SERVER_HOST 127.0.0.1 >/dev/null
hermes config set API_SERVER_PORT 8642 >/dev/null
hermes config set API_SERVER_KEY "$API_KEY" >/dev/null

s "voice: local Whisper ($STT_MODEL) + Edge TTS ($TTS)"
hermes config set stt.provider local >/dev/null
hermes config set stt.enabled true >/dev/null
hermes config set stt.local.model "$STT_MODEL" >/dev/null
hermes config set tts.provider edge >/dev/null
hermes config set tts.edge.voice "$TTS" >/dev/null

s "WhatsApp self-chat + the cockpit bridge token"
WHATSAPP_NUMBER="$WA" BRIDGE_TOKEN="$BRIDGE" python3 - <<'PY'
import io, os
number = os.environ["WHATSAPP_NUMBER"]
bridge = os.environ["BRIDGE_TOKEN"]
path = os.path.expanduser('~/.hermes/.env')
text = io.open(path, encoding='utf-8').read() if os.path.exists(path) else ''
keys = [
    'WHATSAPP_ENABLED', 'WHATSAPP_MODE', 'WHATSAPP_ALLOWED_USERS',
    'NOEDIS_BRIDGE_TOKEN', 'NOEDIS_COCKPIT_URL',
]
kept = [l for l in text.splitlines() if not any(l.startswith(k + '=') for k in keys)]
block = (
    "# ── NOEDIS cockpit bridge (managed by deploy/deploy-hermes.sh) ──\n"
    "WHATSAPP_ENABLED=true\n"
    "WHATSAPP_MODE=self-chat\n"
    f"WHATSAPP_ALLOWED_USERS={number}\n"
    f"NOEDIS_BRIDGE_TOKEN={bridge}\n"
    "NOEDIS_COCKPIT_URL=http://127.0.0.1:3200\n"
)
io.open(path, 'w', encoding='utf-8').write('\n'.join(kept).rstrip('\n') + '\n\n' + block)
os.chmod(path, 0o600)
print('    .env updated (mode 600)')
PY

s "done"
