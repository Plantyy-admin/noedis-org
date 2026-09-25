#!/bin/bash
set -e

API="http://127.0.0.1:3100"
SESSION_TOKEN="lnPg2U2z5oxIADRB30pbfNl1Pb6zscpY"

echo "=== SETUP CLI AUTH WITH SESSION TOKEN ==="
# First, use the token to create a proper session cookie by calling get-session
# Get the session ID from the response
SESSION_RESP=$(curl -s "$API/api/auth/get-session" -H "Cookie: paperclip-session.token=$SESSION_TOKEN" -H "Origin: https://noedis.org" -H "Referer: https://noedis.org/")
echo "Session response: $SESSION_RESP" | python3 -m json.tool 2>/dev/null

# Try with Referer
SESSION_RESP2=$(curl -s "$API/api/auth/get-session" -H "Cookie: paperclip-session.token=$SESSION_TOKEN" -H "Origin: https://noedis.org" -H "Referer: https://noedis.org/invite/pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab")
echo "Session response 2: $SESSION_RESP2" | python3 -m json.tool 2>/dev/null

# Let me check what cookies we should use from the signup response
# The signup returned a token but no cookie headers. Let me check the response headers
echo "=== CHECK SIGNUP RESPONSE HEADERS ==="
curl -sv -X POST "$API/api/auth/sign-up/email" \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://noedis.org' \
  -H 'Cookie: paperclip-session.pending-invite-token=pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab' \
  -d '{"name":"Founder","email":"founder@noedis.org","password":"NoedisPass2026!","inviteToken":"pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab"}' 2>&1 | grep -i 'set-cookie\|< HTTP'

echo ""
echo "=== DONE ==="