#!/bin/bash
# Try bootstrap claim
set -e
: "${NOEDIS_ADMIN_PASS:?set NOEDIS_ADMIN_PASS}"

echo "=== BOOTSTRAP CLAIM ==="
curl -sv -X POST "http://127.0.0.1:3100/api/bootstrap/claim" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"founder@noedis.org\",\"name\":\"Founder\",\"password\":\"$NOEDIS_ADMIN_PASS\"}" 2>&1

echo ""
echo "=== DONE ==="