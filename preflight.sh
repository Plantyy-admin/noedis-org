#!/bin/bash
sshpass -p 'Tfgbhv97APGCWnoedis.admin' ssh \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -p 501 \
  -o StrictHostKeyChecking=no \
  vpsadmin@76.13.154.124 \
  "echo '=== OS ===' && cat /etc/os-release | head -5 && echo '=== KERNEL ===' && uname -r && echo '=== CPU ===' && nproc && free -h | head -2 && echo '=== DISK ===' && df -h / | tail -1 && echo '=== NODE ===' && node --version 2>/dev/null && npm --version 2>/dev/null && echo '=== DOCKER ===' && docker --version 2>/dev/null && echo '=== PORTS ===' && ss -tlnp | head -20 && echo '=== CADDY ===' && which caddy 2>/dev/null && caddy version 2>/dev/null && echo '=== PAPERCLIP HEALTH ===' && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/health 2>/dev/null || echo 'no health endpoint' && echo '=== PAPERCLIPAI ===' && paperclipai --version 2>/dev/null || echo 'not found'"