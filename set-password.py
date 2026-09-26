import subprocess, sys

# Generate hash with Node.js
node_code = '''
import { hashPassword } from "/usr/lib/node_modules/paperclipai/node_modules/@better-auth/utils/dist/password.node.mjs";
const hash = await hashPassword("REDACTED");
console.log(hash);
'''

result = subprocess.run(
    ['node', '--input-type=module', '-e', node_code],
    capture_output=True, text=True, timeout=30
)

if result.returncode != 0:
    print(f'Node error: {result.stderr}')
    sys.exit(1)

hash_val = result.stdout.strip()
print(f'Hash: {len(hash_val)} chars')

# Update database
update = subprocess.run([
    'docker', 'exec', '-i', 'noedis-pg', 'psql', '-U', 'paperclip', '-d', 'paperclip',
    '-c', f"UPDATE public.account SET password = '{hash_val}' WHERE user_id = (SELECT id FROM public.user WHERE email = 'lukas.plant1010@gmail.com');"
], capture_output=True, text=True, timeout=10)
print(f'Update: {update.stdout.strip()}')

# Verify
verify = subprocess.run([
    'docker', 'exec', '-i', 'noedis-pg', 'psql', '-U', 'paperclip', '-d', 'paperclip',
    '-t', '-A',
    '-c', "SELECT length(password) FROM public.account a JOIN public.user u ON u.id = a.user_id WHERE u.email = 'lukas.plant1010@gmail.com';"
], capture_output=True, text=True, timeout=10)
print(f'Password length: {verify.stdout.strip()} chars')
print(f'Length > 0: {len(verify.stdout.strip()) > 0}')