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

# Create new admin user in the database directly
docker exec -i noedis-pg psql -U paperclip -d paperclip <<SQL
-- Create user
INSERT INTO "user" (id, name, email, email_verified)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Founder', 'founder@noedis.org', true)
ON CONFLICT (id) DO UPDATE SET name = 'Founder', email = 'founder@noedis.org', email_verified = true;

-- Create account
INSERT INTO account (id, user_id, provider_id, password)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'credential', '$PASS_HASH')
ON CONFLICT (id) DO UPDATE SET password = '$PASS_HASH';

-- Make them instance admin
INSERT INTO instance_user_roles (user_id, role)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'instance_admin')
ON CONFLICT (user_id, role) DO NOTHING;

SQL

echo "Admin user created"
echo ""
echo "Email: founder@noedis.org"
echo "Password: NoedisPass2026!"
echo ""
echo "DONE"