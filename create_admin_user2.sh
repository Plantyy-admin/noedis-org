#!/bin/bash
set -e

# Generate password hash for new admin user
PASS_HASH=$(node -e "
const crypto = require('crypto');
const password = 'NoedisPass2026!';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
console.log(salt + ':' + hash);
")

echo "Password hash generated"

# Delete any existing data for this user first
docker exec -i noedis-pg psql -U paperclip -d paperclip <<SQL
-- Delete if exists
DELETE FROM instance_user_roles WHERE user_id = 'founder-user-id';
DELETE FROM account WHERE user_id = 'founder-user-id';
DELETE FROM session WHERE user_id = 'founder-user-id';
DELETE FROM "user" WHERE id = 'founder-user-id';
SQL

# Create new admin user with all required fields
docker exec -i noedis-pg psql -U paperclip -d paperclip <<SQL
INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
VALUES ('founder-user-id', 'Founder', 'founder@noedis.org', true, NOW(), NOW());

INSERT INTO account (id, account_id, user_id, provider_id, password, created_at, updated_at)
VALUES ('founder-account-id', 'founder-account-id', 'founder-user-id', 'credential', '$PASS_HASH', NOW(), NOW());

INSERT INTO instance_user_roles (user_id, role)
VALUES ('founder-user-id', 'instance_admin');
SQL

echo ""
echo "Admin user created successfully!"
echo "Email: founder@noedis.org"
echo "Password: NoedisPass2026!"
echo ""
echo "DONE"