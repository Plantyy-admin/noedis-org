// Verify password hash
import { readFileSync } from 'fs';
import { verifyPassword } from '/usr/lib/node_modules/paperclipai/node_modules/@better-auth/utils/dist/password.node.mjs';

const storedHash = readFileSync('/tmp/stored-hash.txt', 'utf8').trim();
console.log('Hash length:', storedHash.length);

const result = await verifyPassword(storedHash, 'REDACTED');
console.log('Verify result:', result);

if (result === true) {
  console.log('✅ PASSWORD IS CORRECT');
} else {
  console.log('❌ PASSWORD IS WRONG');
}