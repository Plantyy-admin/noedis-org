#!/bin/bash
# Simple preflight script
echo "=== PREFLIGHT START ==="

# Try SSH with explicit password
export SSHPASS='Tfgbhv97APGCWnoedis.admin'
sshpass -e ssh -p 501 -o StrictHostKeyChecking=no -o ConnectTimeout=15 vpsadmin@76.13.154.124 "hostname && uname -a && node --version"

echo "=== PREFLIGHT END ==="