#!/bin/bash
# Update NOE REPORT to report to NOE COMMAND
set -e

COMPANY_ID="8b5aa752-5199-4f51-9a9c-817647ef1aae"
BOARD_KEY="REDACTED"

echo "=== UPDATE NOE REPORT ==="
curl -s -X PATCH "http://127.0.0.1:3100/api/companies/$COMPANY_ID/agents/63d3dbf5-3cb1-44f0-8285-543c07f5a5aa" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOARD_KEY" \
  -H "Origin: https://noedis.org" \
  -d '{"reportsTo":"39c710c0-c4c1-4612-bbef-5e4a9f60d12b"}' 2>/dev/null

echo ""
echo "=== VERIFY CHAIN ==="
curl -s "http://127.0.0.1:3100/api/companies/$COMPANY_ID/org" \
  -H "Authorization: Bearer $BOARD_KEY" \
  -H "Origin: https://noedis.org" 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
if isinstance(data, list):
    for a in data:
        print(f'  {a.get(\"name\",\"\")} -> reportsTo: {a.get(\"reportsTo\",\"none\")}')
elif isinstance(data, dict):
    print(json.dumps(data, indent=2)[:500])
"

echo ""
echo "=== DONE ==="