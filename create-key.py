import hashlib, os, subprocess, sys

user_id = '9g34DIk7jSnQQYlMn0bg36c7vTRbmO86'
api_key = 'pcp_board_' + os.urandom(24).hex()
key_hash = hashlib.sha256(api_key.encode()).hexdigest()

print('API_KEY=' + api_key)
print('KEY_HASH=' + key_hash)

insert = subprocess.run([
    'docker', 'exec', '-i', 'noedis-pg', 'psql', '-U', 'paperclip', '-d', 'paperclip',
    '-c', f"DELETE FROM public.board_api_keys WHERE user_id='{user_id}' AND name='NOEDIS-Admin';"
], capture_output=True, text=True)

insert = subprocess.run([
    'docker', 'exec', '-i', 'noedis-pg', 'psql', '-U', 'paperclip', '-d', 'paperclip',
    '-c', f"INSERT INTO public.board_api_keys (user_id, name, key_hash) VALUES ('{user_id}', 'NOEDIS-Admin', '{key_hash}') RETURNING id;"
], capture_output=True, text=True)
print(insert.stdout.strip())
if insert.returncode != 0:
    print('STDERR:', insert.stderr)
    sys.exit(1)