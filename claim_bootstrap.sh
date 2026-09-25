#!/bin/bash
# Try bootstrap claim
set -e

echo "=== BOOTSTRAP CLAIM ==="
curl -sv -X POST "http://127.0.0.1:3100/api/bootstrap/claim" \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@noedis.org","name":"Founder","password":"__REDACTED__"}' 2>&1

echo ""
echo "=== DONE ==="