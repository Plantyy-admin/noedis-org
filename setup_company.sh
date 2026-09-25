#!/bin/bash
# Setup Paperclip company and agents via API using session token
set -e

PAPERCLIP_API="http://127.0.0.1:3100/api"
SESSION_TOKEN="WHuR1PFQrzzQ2VHCbRB18vQ2z0kbrPkM"

# Test session auth
echo "=== TEST AUTH ==="
curl -s "$PAPERCLIP_API/auth/get-session" \
  -H "Cookie: paperclip-session=$SESSION_TOKEN" | python3 -m json.tool 2>/dev/null || echo "session auth failed"

echo ""
echo "=== CREATE COMPANY ==="
curl -s -X POST "$PAPERCLIP_API/companies" \
  -H "Cookie: paperclip-session=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Noedis","description":"NOEDIS Autonomous Company"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "=== LIST COMPANIES ==="
curl -s "$PAPERCLIP_API/companies" \
  -H "Cookie: paperclip-session=$SESSION_TOKEN" | python3 -m json.tool 2>/dev/null

echo ""
echo "=== COMPANY ADAPTERS ==="
curl -s "$PAPERCLIP_API/adapters" \
  -H "Cookie: paperclip-session=$SESSION_TOKEN" | python3 -m json.tool 2>/dev/null | head -20

echo ""
echo "=== DONE ==="