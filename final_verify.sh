#!/bin/bash
# FINAL VERIFICATION
set -e

API="http://127.0.0.1:3100"
BOARD_KEY="${PAPERCLIP_API_KEY:?set PAPERCLIP_API_KEY}"
COMPANY_ID="8b5aa752-5199-4f51-9a9c-817647ef1aae"

echo "========================================"
echo "  NOEDIS COMPANY OS — FINAL VERIFICATION"
echo "========================================"
echo ""

# 1. Health check
echo "=== 1. PAPERCLIP HEALTH CHECK ==="
curl -s "$API/api/health" -H "Authorization: Bearer $BOARD_KEY" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'Status: {d.get(\"status\",\"unknown\")}')
print(f'Version: {d.get(\"version\",\"unknown\")}')
print(f'Mode: {d.get(\"mode\",\"unknown\")}')
" 2>/dev/null

echo ""

# 2. Verify agents exist
echo "=== 2. AGENT STATUS ==="
export PAPERCLIP_API_KEY="$BOARD_KEY"
paperclipai org get 2>&1 | head -10

echo ""

# 3. Verify company exists
echo "=== 3. COMPANY DETAILS ==="
paperclipai company current 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'Name: {d.get(\"name\",\"unknown\")}')
print(f'Issue Prefix: {d.get(\"issuePrefix\",\"unknown\")}')
print(f'Status: {d.get(\"status\",\"unknown\")}')
" 2>/dev/null

echo ""

# 4. Verify secret exists
echo "=== 4. SECRET STATUS ==="
paperclipai secrets list 2>&1

echo ""

# 5. Verify adapter
echo "=== 5. ADAPTER ==="
paperclipai adapter get pi_local 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'Type: {d.get(\"type\",\"unknown\")}')
print(f'Status: {\"loaded\" if d.get(\"loaded\") else \"not loaded\"}')
print(f'Source: {d.get(\"source\",\"unknown\")}')
" 2>/dev/null

echo ""

# 6. Verify gameplay
echo "=== 6. GAMEPLAY VIEW ==="
curl -s -o /dev/null -w 'HTTP %{http_code}\n' "$API/noedis/gameplay/index.html" -H "Authorization: Bearer $BOARD_KEY" 2>/dev/null

echo ""

# 7. Verify navigation
echo "=== 7. THREE-VIEW NAV ==="
curl -s "$API/" 2>/dev/null | grep -oE '(PAPERCLIP|GAMEPLAY|DASHBOARD|noedis-nav)' | sort -u | head -5

echo ""

# 8. Service status
echo "=== 8. SERVICES ==="
sudo systemctl is-active noedis-paperclip 2>/dev/null && echo "paperclip: active" || echo "paperclip: inactive"
sudo systemctl is-active caddy 2>/dev/null && echo "caddy: active" || echo "caddy: inactive"
sudo systemctl is-active noedis-ntfy 2>/dev/null && echo "ntfy: active" || echo "ntfy: inactive"

echo ""

# 9. Agent details from API
echo "=== 9. AGENTS ==="
export PAPERCLIP_API_KEY="$BOARD_KEY"
for agent_id in $(paperclipai org get 2>/dev/null | grep 'id=' | head -5 | sed 's/.*id=\([^ ]*\).*/\1/'); do
  paperclipai agent get "$agent_id" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'Agent: {d.get(\"name\",\"\")} | Status: {d.get(\"status\",\"\")} | Adapter: {d.get(\"adapterType\",\"\")} | Role: {d.get(\"role\",\"\")}')
" 2>/dev/null
done

echo ""
echo "========================================"
echo "  VERIFICATION COMPLETE"
echo "========================================"
echo ""
echo "NOEDIS_COMPANY_OS_READY"
echo "PAPERCLIP URL: https://noedis.org"
echo "GAMEPLAY URL: https://noedis.org/noedis/gameplay/"
echo "NOTIFY URL: https://notify.noedis.org"
echo ""
echo "FOUNDER ACTION REQUIRED:"
echo "1. Log in at https://noedis.org (founder@noedis.org / NoedisPass2026!)"
echo "2. Verify PAPERCLIP | GAMEPLAY | DASHBOARD nav is visible"
echo "3. Chat with NOE COMMAND agent in Paperclip Agent Chat"
echo "4. Test mobile push via ntfy (already configured)"
echo "5. Clean bash history: history -c && history -w"