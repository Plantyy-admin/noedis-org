#!/bin/bash
set -e

# Generate proper board API key
KEY_VALUE="pcp_board_founder_key_2026"
KEY_HASH=$(node -e "
const crypto = require('crypto');
const h = crypto.createHash('sha256').update('$KEY_VALUE').digest('hex');
console.log(h);
")

echo "Key value: $KEY_VALUE"
echo "Key hash: $KEY_HASH"

# Insert board API key with correct hash
docker exec -i noedis-pg psql -U paperclip -d paperclip <<SQL
INSERT INTO board_api_keys (user_id, name, key_hash)
SELECT 'vrJdY8JDHBRck6EyBVVocDhBMHlNzOEW', 'founder-admin-key', '$KEY_HASH'
WHERE NOT EXISTS (
  SELECT 1 FROM board_api_keys WHERE name = 'founder-admin-key'
);
SQL

echo "Board API key created/verified"

# Now connect Paperclip CLI using this key
echo ""
echo "=== CONNECT CLI ==="
paperclipai connect \
  --persona board \
  --api-base http://127.0.0.1:3100 \
  --api-key "$KEY_VALUE" \
  --token-name "founder-cli-token" 2>&1

echo ""
echo "=== VERIFY CLI AUTH ==="
paperclipai whoami 2>&1

echo ""
echo "=== LIST COMPANIES ==="
paperclipai company list 2>&1

echo ""
echo "=== DONE ==="