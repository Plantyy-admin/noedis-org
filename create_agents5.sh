#!/bin/bash
set -e

COMPANY_ID="8b5aa752-5199-4f51-9a9c-817647ef1aae"
API="http://127.0.0.1:3100"
BOARD_KEY="pcp_board_founder_key_2026"
SECRET_ID="082434e2-6087-4270-a326-97b10cd411ff"

echo "=== CREATE NOE COMMAND ==="
NOE_COMMAND=$(curl -s -X POST "$API/api/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOARD_KEY" \
  -H "Origin: https://noedis.org" \
  -d '{
    "name": "NOE COMMAND",
    "role": "ceo",
    "title": "Founder Left Hand — Command & Dispatch",
    "adapterType": "pi_local",
    "adapterConfig": {
      "provider": "openrouter",
      "model": "openai/gpt-4o",
      "credentials": {
        "OPENROUTER_API_KEY": "'"$SECRET_ID"'"
      }
    },
    "instructionsBundle": {
      "files": {
        "instructions.md": "You are NOE COMMAND, the Founder'\''s left hand. You receive work requests from the Founder via Paperclip Agent Chat. You coordinate work across the NOEDIS organization. You can request new agents, departments, divisions, and teams from WorkforceArchitect. You never communicate directly with the Founder except to accept work and return results through NOE REPORT."
      }
    },
    "budgetMonthlyCents": 1000000
  }')
echo "$NOE_COMMAND" | python3 -m json.tool 2>/dev/null || echo "$NOE_COMMAND"
NOE_COMMAND_ID=$(echo "$NOE_COMMAND" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
echo "NOE COMMAND ID: $NOE_COMMAND_ID"

echo ""
echo "=== CREATE NOE REPORT ==="
NOE_REPORT=$(curl -s -X POST "$API/api/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOARD_KEY" \
  -H "Origin: https://noedis.org" \
  -d '{
    "name": "NOE REPORT",
    "role": "ceo",
    "title": "Founder Right Hand — Monitoring & Reporting",
    "adapterType": "pi_local",
    "adapterConfig": {
      "provider": "openrouter",
      "model": "openai/gpt-4o",
      "credentials": {
        "OPENROUTER_API_KEY": "'"$SECRET_ID"'"
      }
    },
    "instructionsBundle": {
      "files": {
        "instructions.md": "You are NOE REPORT, the Founder'\''s right hand. You monitor all work across the NOEDIS organization and report status to the Founder. You only send DONE / DECISION / RISK / RELEASE notifications. You never send heartbeat, progress updates, or debug info. You provide concise, actionable summaries."
      }
    },
    "budgetMonthlyCents": 500000
  }')
echo "$NOE_REPORT" | python3 -m json.tool 2>/dev/null || echo "$NOE_REPORT"
NOE_REPORT_ID=$(echo "$NOE_REPORT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
echo "NOE REPORT ID: $NOE_REPORT_ID"

echo ""
echo "=== LIST ALL AGENTS ==="
curl -s "$API/api/companies/$COMPANY_ID/agents" \
  -H "Authorization: Bearer $BOARD_KEY" \
  -H "Origin: https://noedis.org" | python3 -c "
import sys,json
agents=json.load(sys.stdin)
for a in agents:
    status = a.get('status','unknown')
    name = a.get('name','unknown')
    adapter = a.get('adapterType','unknown')
    role = a.get('role','unknown')
    id = a.get('id','unknown')
    print(f'  {status:10s} | {name:20s} | role={role:10s} | adapter={adapter:15s} | {id}')
" 2>/dev/null

echo ""
echo "=== DONE ==="