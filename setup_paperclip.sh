#!/bin/bash
# Run on VPS via SSH
set -e

TOKEN="${1:-pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab}"

echo "=== ACCEPT BOOTSTRAP INVITE ==="
curl -s -X POST "http://127.0.0.1:3100/api/invites/${TOKEN}/accept" \
  -H "Content-Type: application/json" \
  -d '{"requestType":"human"}'

echo ""
echo "=== DONE ==="