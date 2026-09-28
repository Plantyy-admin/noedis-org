#!/bin/bash
# Reset admin password in database and create a new session
set -e
: "${NOEDIS_ADMIN_PASS:?set NOEDIS_ADMIN_PASS}"

# Generate password hash using Node.js
PASSWORD_HASH=$(node -e "
const crypto = require('crypto');
const password = process.env.NOEDIS_ADMIN_PASS;
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
console.log(salt + ':' + hash);
")

echo "Generated password hash for $NOEDIS_ADMIN_PASS"

# Update the admin account password
docker exec -i noedis-pg psql -U paperclip -d paperclip <<SQL
UPDATE account 
SET password = '$PASSWORD_HASH'
WHERE user_id = '9g34DIk7jSnQQYlMn0bg36c7vTRbmO86';

-- Also invalidate old sessions so we get fresh ones
DELETE FROM session WHERE user_id = '9g34DIk7jSnQQYlMn0bg36c7vTRbmO86';
SQL

echo "Password updated and old sessions deleted."
echo "DONE"