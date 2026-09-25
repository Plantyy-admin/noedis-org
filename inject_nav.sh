#!/bin/bash
# Inject three-view navigation into Paperclip UI
set -e

echo "=== CREATE GAMEPLAY VIEW ==="

# Create gameplay directory
sudo mkdir -p /srv/noedis/gameplay

# Create the pixel-art station canvas HTML/JS
cat > /srv/noedis/gameplay/index.html << 'GAMEPLAY'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NOEDIS GAMEPLAY — Space Station Canvas</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a1a; overflow: hidden; font-family: 'Courier New', monospace; color: #0f0; }
  canvas { display: block; }
  #hud { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 20px; z-index: 10; }
  .hud-item { background: rgba(0,20,0,0.8); border: 1px solid #0f0; padding: 8px 16px; font-size: 12px; white-space: nowrap; }
  #crew-rail { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 10; }
  .crew-dot { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #0f0; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; background: rgba(0,0,0,0.7); transition: all 0.3s; }
  .crew-dot:hover { background: rgba(0,255,0,0.3); transform: scale(1.2); }
  .crew-dot.active { background: rgba(0,255,0,0.5); box-shadow: 0 0 10px #0f0; }
  #status-bar { position: fixed; top: 60px; right: 20px; z-index: 10; text-align: right; }
  #status-bar div { font-size: 11px; margin: 4px 0; opacity: 0.7; }
</style>
</head>
<body>
<canvas id="station"></canvas>

<div id="crew-rail">
  <div class="crew-dot active" title="NOE COMMAND">⚡</div>
  <div class="crew-dot" title="NOE REPORT">📡</div>
  <div class="crew-dot" title="TECHNOLOGY">🔧</div>
  <div class="crew-dot" title="CREATIVE">🎨</div>
  <div class="crew-dot" title="BUSINESS">💼</div>
  <div class="crew-dot" title="GAME">🎮</div>
  <div class="crew-dot" title="QUALITY">✅</div>
  <div class="crew-dot" title="LABS">🔬</div>
</div>

<div id="status-bar">
  <div>⚡ NOE COMMAND · IDLE</div>
  <div>📡 NOE REPORT · MONITORING</div>
  <div>🔗 pi_local · OPENROUTER</div>
</div>

<div id="hud">
  <div class="hud-item">DEPT: 8</div>
  <div class="hud-item">AGENTS: 3</div>
  <div class="hud-item">STATUS: OPERATIONAL</div>
  <div class="hud-item">RUNTIME: pi_local</div>
</div>

<script>
const canvas = document.getElementById('station');
const ctx = canvas.getContext('2d');
let W, H;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Station rooms
const rooms = [
  { x: 0.1, y: 0.15, w: 0.18, h: 0.25, label: 'COMMAND', color: '#0f0', agents: [] },
  { x: 0.35, y: 0.10, w: 0.22, h: 0.22, label: 'TECHNOLOGY', color: '#0ff', agents: [] },
  { x: 0.65, y: 0.12, w: 0.20, h: 0.20, label: 'CREATIVE', color: '#f0f', agents: [] },
  { x: 0.10, y: 0.55, w: 0.20, h: 0.22, label: 'GAME', color: '#ff0', agents: [] },
  { x: 0.38, y: 0.50, w: 0.20, h: 0.20, label: 'BUSINESS', color: '#fa0', agents: [] },
  { x: 0.65, y: 0.48, w: 0.18, h: 0.22, label: 'MARKETING', color: '#0af', agents: [] },
  { x: 0.15, y: 0.82, w: 0.18, h: 0.14, label: 'QUALITY', color: '#0f8', agents: [] },
  { x: 0.65, y: 0.78, w: 0.20, h: 0.16, label: 'LABS', color: '#80f', agents: [] },
  { x: 0.38, y: 0.78, w: 0.18, h: 0.16, label: 'LEGAL', color: '#f80', agents: [] },
];

// Agent dots
const agentDots = [
  { x: 0.15, y: 0.28, label: 'NOE-C', color: '#0f0', speed: 0.3 },
  { x: 0.18, y: 0.33, label: 'NOE-R', color: '#0f0', speed: 0.2 },
  { x: 0.42, y: 0.22, label: 'TECH-1', color: '#0ff', speed: 0.4 },
];

const stars = [];
for (let i = 0; i < 200; i++) {
  stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.5 + 0.5, b: Math.random() });
}

let time = 0;
function draw() {
  time += 0.02;
  // Deep space background
  const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.7);
  grad.addColorStop(0, '#0a0a2e');
  grad.addColorStop(1, '#020210');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const s of stars) {
    const flicker = Math.sin(time * 2 + s.b * 10) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(200,200,255,${flicker * 0.8})`;
    ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(0,255,0,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Corridors between rooms
  ctx.strokeStyle = 'rgba(0,255,0,0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 8]);
  // Draw some connection lines
  ctx.beginPath();
  ctx.moveTo(0.19*W, 0.28*H); ctx.lineTo(0.35*W, 0.21*H);
  ctx.moveTo(0.19*W, 0.28*H); ctx.lineTo(0.20*W, 0.55*H);
  ctx.moveTo(0.46*W, 0.21*H); ctx.lineTo(0.65*W, 0.22*H);
  ctx.moveTo(0.28*W, 0.66*H); ctx.lineTo(0.38*W, 0.60*H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw rooms
  for (const r of rooms) {
    const rx = r.x * W, ry = r.y * H, rw = r.w * W, rh = r.h * H;
    
    // Room fill
    ctx.fillStyle = `rgba(0,20,0,0.6)`;
    ctx.fillRect(rx, ry, rw, rh);
    
    // Room border
    const pulse = Math.sin(time + rooms.indexOf(r)) * 0.3 + 0.7;
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = pulse * 0.6 + 0.4;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.globalAlpha = 1;

    // Room label
    ctx.fillStyle = r.color;
    ctx.font = '12px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(r.label, rx + rw/2, ry + rh/2 + 4);
  }

  // Draw agent dots
  for (const a of agentDots) {
    const dx = Math.sin(time * a.speed + agentDots.indexOf(a)) * 0.02;
    const dy = Math.cos(time * a.speed * 0.7 + agentDots.indexOf(a) * 2) * 0.02;
    const ax = a.x * W + dx * W;
    const ay = a.y * H + dy * H;
    
    // Glow
    const glow = ctx.createRadialGradient(ax, ay, 0, ax, ay, 15);
    glow.addColorStop(0, a.color);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(ax - 15, ay - 15, 30, 30);
    
    // Dot
    ctx.beginPath();
    ctx.arc(ax, ay, 4, 0, Math.PI * 2);
    ctx.fillStyle = a.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Label
    ctx.fillStyle = a.color;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(a.label, ax, ay - 12);
  }

  requestAnimationFrame(draw);
}
draw();
</script>
</body>
</html>
GAMEPLAY

echo "Gameplay view created at /srv/noedis/gameplay/index.html"

echo ""
echo "=== INJECT THREE-VIEW NAVIGATION INTO PAPERCLIP ==="

# Read the current Paperclip HTML, inject the navigation script between branding markers
# and write it back
# First find where Paperclip's HTML files are served from
PAPERCLIP_DIR=$(find /usr/lib/node_modules/paperclipai -name 'index.html' -path '*/ui/*' 2>/dev/null | head -1)
echo "Paperclip UI index.html: $PAPERCLIP_DIR"

# If we can find the HTML, modify it directly
if [ -n "$PAPERCLIP_DIR" ] && [ -f "$PAPERCLIP_DIR" ]; then
  # Check if already injected
  if grep -q 'NOEDIS_VIEW_SWITCHER' "$PAPERCLIP_DIR" 2>/dev/null; then
    echo "Already injected, skipping."
  else
    # Create the inject script
    INJECT_SCRIPT='<!-- NOEDIS_VIEW_SWITCHER -->
<style>
  .noedis-nav { position:fixed; top:0; left:0; right:0; z-index:99999; display:flex; 
    justify-content:center; gap:4px; padding:8px; background:rgba(0,0,0,0.85); 
    border-bottom:1px solid #333; font-family:system-ui,sans-serif; }
  .noedis-nav a { color:#888; text-decoration:none; padding:6px 20px; border-radius:4px; 
    font-size:13px; font-weight:600; letter-spacing:1px; transition:all 0.2s; }
  .noedis-nav a:hover { color:#fff; background:rgba(255,255,255,0.1); }
  .noedis-nav a.active { color:#0f0; background:rgba(0,255,0,0.1); }
  .noedis-nav a:first-child { color:#0af; }
</style>
<div class="noedis-nav">
  <a href="/" class="active">PAPERCLIP</a>
  <a href="#" onclick="toggleGameplay();return false;">GAMEPLAY</a>
  <a href="#" onclick="toggleDashboard();return false;">DASHBOARD</a>
</div>
<script>
function toggleGameplay() {
  const w = window.open("about:blank","_blank","width=1200,height=800");
  w.document.write('<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;overflow:hidden}</style></head><body><iframe src="/gameplay/" style="width:100vw;height:100vh;border:none"></iframe><div style="position:fixed;top:10px;right:10px;z-index:99"><a href="#" onclick="window.close()" style="color:#0f0;text-decoration:none;font-family:monospace;font-size:20px;background:rgba(0,0,0,0.7);padding:8px 16px;border:1px solid #0f0">✕ CLOSE</a></div></body></html>');
}
function toggleDashboard() {
  window.location.href = "/noedis/dashboard/";
}
</script>
<!-- /NOEDIS_VIEW_SWITCHER -->'

    # Inject after the branding end marker
    sed -i '/PAPERCLIP_RUNTIME_BRANDING_END/a '"$INJECT_SCRIPT" "$PAPERCLIP_DIR"
    echo "Navigation injected into $PAPERCLIP_DIR"
  fi
else
  # Alternative: inject via the runtime hook
  echo "Paperclip UI file not found at expected location, checking alternatives..."
  find /usr/lib/node_modules/paperclipai -name 'index.html' 2>/dev/null | head -5
fi

echo ""
echo "=== SET UP CADDY FOR GAMEPLAY ==="
# Add a reverse proxy for gameplay if Caddy is configured
sudo mkdir -p /srv/noedis/gameplay
# Check current Caddy config to see if we need to add gameplay route
if grep -q 'noedis.org' /etc/caddy/Caddyfile 2>/dev/null; then
  echo "Caddy config exists for noedis.org - gameplay will be served via Paperclip's static file handler"
fi

echo ""
echo "=== DONE ==="