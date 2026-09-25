#!/bin/sh
# NOEDIS Command Center — startup script
# Usage: ./start.sh [--daemon]

DIR="/var/home/plantyy/Projects/noedis-org/command-center"
cd "$DIR" || exit 1

# Ensure npm deps
[ ! -d node_modules ] && npm install

# Kill existing if any
kill $(cat /tmp/noedis-cc.pid 2>/dev/null) 2>/dev/null

# Start
node server.js > /tmp/noedis-cc.log 2>&1 &
PID=$!
echo $PID > /tmp/noedis-cc.pid
echo "◆ NOEDIS Command Center started (PID $PID)"
echo "  → http://127.0.0.1:3200"