#!/bin/bash
# SSH with expect-based approach
SCRIPT="
spawn ssh -p 501 -o StrictHostKeyChecking=no vpsadmin@76.13.154.124
expect \"password:\"
send \"REDACTED\r\"
expect \"\$\"
send \"hostname && uname -a && node --version && paperclipai --version 2>/dev/null || echo 'no pc' && curl -s http://127.0.0.1:3100 2>/dev/null | head -3 || echo 'no pc http'\r\"
expect \"\$\"
send \"exit\r\"
expect eof
"

output=$(expect -c "$SCRIPT" 2>&1)
echo "$output" | tail -30
echo "---DONE---"