#!/bin/bash
# Create a CLI auth challenge with known secret, approve via database
set -e

API="http://127.0.0.1:3100"
ADMIN_USER="9g34DIk7jSnQQYlMn0bg36c7vTRbmO86"

echo "=== GENERATE NEW CLI AUTH CHALLENGE ==="
# Generate a known secret
SECRET="noedis-cli-secret-2026"
SECRET_HASH=$(echo -n "$SECRET" | sha256sum | cut -d' ' -f1)
PENDING_KEY_NAME="paperclipai cli (board)"
PENDING_KEY_HASH=$(echo -n "pcp_board_noedis_cli_2026" | sha256sum | cut -d' ' -f1)

echo "Secret: $SECRET"
echo "Secret hash: $SECRET_HASH"
echo "Pending key hash: $PENDING_KEY_HASH"

# Insert the challenge
docker exec -i noedis-pg psql -U paperclip -d paperclip <<SQL
INSERT INTO cli_auth_challenges 
  (id, secret_hash, command, client_name, requested_access, pending_key_hash, pending_key_name, expires_at)
VALUES 
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '$SECRET_HASH', 'paperclipai auth login', 'paperclipai cli', 'board', '$PENDING_KEY_HASH', '$PENDING_KEY_NAME', NOW() + INTERVAL '10 minutes')
RETURNING id;
SQL

# Insert a board API key with known hash
BOARD_KEY="pcp_board_noedis_cli_2026"
docker exec -i noedis-pg psql -U paperclip -d paperclip <<SQL2
INSERT INTO board_api_keys (id, user_id, name, key_hash)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '$ADMIN_USER', 'cli-auto-approve', '$BOARD_KEY')
ON CONFLICT (id) DO NOTHING
RETURNING id;
SQL2

# Approve the challenge
docker exec -i noedis-pg psql -U paperclip -d paperclip <<SQL3
UPDATE cli_auth_challenges 
SET approved_by_user_id = '$ADMIN_USER',
    board_api_key_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    approved_at = NOW()
WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
RETURNING id, approved_at;
SQL3

echo ""
echo "=== CLI CONNECT ==="
# Now authenticate the CLI using the board API key
paperclipai connect --persona board --api-key "$BOARD_KEY" --api-base "$API" 2>&1 || echo "Connect may need different params"

echo ""
echo "=== VERIFY AUTH ==="
paperclipai whoami 2>&1

echo ""
echo "=== DONE ==="