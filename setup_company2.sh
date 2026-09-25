#!/bin/bash
# Setup Paperclip company and agents via API using session cookie
set -e

PAPERCLIP_API="http://127.0.0.1:3100/api"
SESSION_COOKIE="paperclip-session=YWqQnKemHSDWzAizGd9KpkRP4iapSB7t.JDrjHYquOl8K1QqK-kVALVN0beke7x7meFZYBqFp760"

echo "=== TEST AUTH ==="
AUTH_RESULT=$(curl -s "$PAPERCLIP_API/auth/get-session" -H "Cookie: $SESSION_COOKIE")
echo "$AUTH_RESULT" | python3 -m json.tool 2>/dev/null || echo "$AUTH_RESULT"

echo ""
echo "=== CREATE COMPANY ==="
COMPANY_RESULT=$(curl -s -X POST "$PAPERCLIP_API/companies" \
  -H "Cookie: $SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Noedis","description":"NOEDIS Autonomous Company","issuePrefix":"NOE"}')
echo "$COMPANY_RESULT" | python3 -m json.tool 2>/dev/null || echo "$COMPANY_RESULT"

# Extract company ID
COMPANY_ID=$(echo "$COMPANY_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
echo ""
echo "Company ID: $COMPANY_ID"

echo ""
echo "=== LIST COMPANIES ==="
curl -s "$PAPERCLIP_API/companies" -H "Cookie: $SESSION_COOKIE" | python3 -m json.tool 2>/dev/null

echo ""
echo "=== LIST ADAPTERS ==="
curl -s "$PAPERCLIP_API/adapters" -H "Cookie: $SESSION_COOKIE" | python3 -m json.tool 2>/dev/null | head -30

echo ""
echo "=== DONE ==="