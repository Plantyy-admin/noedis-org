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
WA="${WHATSAPP_OWNER_NUMBER:-}"
# WhatsApp stays off unless the caller opts in: an enabled-but-unpaired
# platform parks and leaves the whole gateway DEGRADED, which is worse
# than an honest "not configured". Telegram is the cockpit's channel.
WA_ON="${WHATSAPP_ENABLED:-false}"
TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_USERS="${TELEGRAM_ALLOWED_USERS:-}"
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

# Which channels end up live, derived from both flags rather than from
# whichever one happens to be set.
case "$WA_ON:$TG_TOKEN" in
  true:?*) s "messaging: Telegram + WhatsApp" ;;
  true:*)  s "messaging: WhatsApp only" ;;
  *:?*)    s "messaging: Telegram only" ;;
  *)       s "messaging: none configured" ;;
esac
WHATSAPP_NUMBER="$WA" WA_ON="$WA_ON" BRIDGE_TOKEN="$BRIDGE" \
TG_TOKEN="$TG_TOKEN" TG_USERS="$TG_USERS" python3 - <<'PY'
import io, os

number   = os.environ["WHATSAPP_NUMBER"]
wa_on    = os.environ["WA_ON"].strip().lower() in {"1", "true", "yes", "on"}
bridge   = os.environ["BRIDGE_TOKEN"]
tg_token = os.environ["TG_TOKEN"].strip()
tg_users = os.environ["TG_USERS"].strip()

path = os.path.expanduser('~/.hermes/.env')
text = io.open(path, encoding='utf-8').read() if os.path.exists(path) else ''

MARKER = '# ── NOEDIS cockpit (managed by deploy/deploy-hermes.sh) ──'
# Every key this script owns is rewritten from scratch, so a channel that
# was turned off leaves nothing behind to resurrect it. The marker goes
# too, otherwise each run would stack another copy of it.
keys = [
    'WHATSAPP_ENABLED', 'WHATSAPP_MODE', 'WHATSAPP_ALLOWED_USERS',
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USERS',
    'NOEDIS_BRIDGE_TOKEN', 'NOEDIS_COCKPIT_URL',
]
kept = [l for l in text.splitlines()
        if l.strip() != MARKER and not any(l.startswith(k + '=') for k in keys)]

block = [MARKER]
block.append(f"WHATSAPP_ENABLED={'true' if wa_on else 'false'}")
if wa_on:
    if not number:
        raise SystemExit(
            'WHATSAPP_ENABLED is on but WHATSAPP_OWNER_NUMBER is not set — '
            'the self-chat allowlist would be empty.')
    block.append("WHATSAPP_MODE=self-chat")
    block.append(f"WHATSAPP_ALLOWED_USERS={number}")
if tg_token:
    # Without an explicit allowlist Hermes falls through to its own
    # authorization and the bot answers whoever finds it — and this bot
    # has shell access, so an empty allowlist is not an option.
    if not tg_users:
        raise SystemExit(
            'TELEGRAM_BOT_TOKEN is set but TELEGRAM_ALLOWED_USERS is not — '
            'refusing to publish a bot that answers anyone.')
    block.append(f"TELEGRAM_BOT_TOKEN={tg_token}")
    block.append(f"TELEGRAM_ALLOWED_USERS={tg_users}")
block.append(f"NOEDIS_BRIDGE_TOKEN={bridge}")
block.append("NOEDIS_COCKPIT_URL=http://127.0.0.1:3200")

body = '\n'.join(kept).rstrip('\n')
io.open(path, 'w', encoding='utf-8').write(
    (body + '\n\n' if body else '') + '\n'.join(block) + '\n')
os.chmod(path, 0o600)
print('    .env updated (mode 600): '
      + ', '.join(k.split('=')[0] for k in block if '=' in k))
PY

s "done"
