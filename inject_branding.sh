#!/bin/bash
set -e

COMPANY_ID="8b5aa752-5199-4f51-9a9c-817647ef1aae"
BOARD_KEY="pcp_board_founder_key_2026"
API="http://127.0.0.1:3100"

echo "=== CREATE GAMEPLAY VIEW ==="
sudo mkdir -p /srv/noedis/gameplay
sudo tee /srv/noedis/gameplay/index.html > /dev/null << 'GAMEPLAY_HTML'
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>NOEDIS GAMEPLAY</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;overflow:hidden;font-family:'Courier New',monospace;color:#0f0}canvas{display:block}#hud{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:20px;z-index:10}.hud-item{background:rgba(0,20,0,0.8);border:1px solid #0f0;padding:8px 16px;font-size:12px;white-space:nowrap}#crew-rail{position:fixed;top:20px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:10}.crew-dot{width:32px;height:32px;border-radius:50%;border:2px solid #0f0;display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;background:rgba(0,0,0,0.7);transition:all 0.3s}.crew-dot:hover{background:rgba(0,255,0,0.3);transform:scale(1.2)}.crew-dot.active{background:rgba(0,255,0,0.5);box-shadow:0 0 10px #0f0}#status-bar{position:fixed;top:60px;right:20px;z-index:10;text-align:right}#status-bar div{font-size:11px;margin:4px 0;opacity:0.7}</style></head><body><canvas id="station"></canvas><div id="crew-rail"><div class="crew-dot active" title="NOE COMMAND">⚡</div><div class="crew-dot" title="NOE REPORT">📡</div><div class="crew-dot" title="TECHNOLOGY">🔧</div><div class="crew-dot" title="CREATIVE">🎨</div><div class="crew-dot" title="GAME">🎮</div><div class="crew-dot" title="BUSINESS">💼</div><div class="crew-dot" title="QUALITY">✅</div><div class="crew-dot" title="LABS">🔬</div></div><div id="status-bar"><div>⚡ NOE COMMAND · IDLE</div><div>📡 NOE REPORT · MONITORING</div><div>🔗 pi_local · OPENROUTER</div></div><div id="hud"><div class="hud-item">DEPT: 8</div><div class="hud-item">AGENTS: 3</div><div class="hud-item">STATUS: OPERATIONAL</div><div class="hud-item">RUNTIME: pi_local</div></div><script>
const c=document.getElementById('station'),x=c.getContext('2d');let W,H;
function r(){W=c.width=innerWidth;H=c.height=innerHeight}
addEventListener('resize',r);r();
const rooms=[
{x:.1,y:.15,w:.18,h:.25,label:'COMMAND',color:'#0f0'},
{x:.35,y:.1,w:.22,h:.22,label:'TECHNOLOGY',color:'#0ff'},
{x:.65,y:.12,w:.2,h:.2,label:'CREATIVE',color:'#f0f'},
{x:.1,y:.55,w:.2,h:.22,label:'GAME',color:'#ff0'},
{x:.38,y:.5,w:.2,h:.2,label:'BUSINESS',color:'#fa0'},
{x:.65,y:.48,w:.18,h:.22,label:'MARKETING',color:'#0af'},
{x:.15,y:.82,w:.18,h:.14,label:'QUALITY',color:'#0f8'},
{x:.65,y:.78,w:.2,h:.16,label:'LABS',color:'#80f'},
{x:.38,y:.78,w:.18,h:.16,label:'LEGAL',color:'#f80'},
];
const dots=[{x:.15,y:.28,color:'#0f0',s:.3},{x:.18,y:.33,color:'#0f0',s:.2},{x:.42,y:.22,color:'#0ff',s:.4}];
const stars=[];for(let i=0;i<200;i++)stars.push({x:Math.random(),y:Math.random(),s:Math.random()*1.5+.5,b:Math.random()});
let t=0;
function d(){t+=.02;const g=x.createRadialGradient(W/2,H/2,0,W/2,H/2,W*.7);g.addColorStop(0,'#0a0a2e');g.addColorStop(1,'#020210');
x.fillStyle=g;x.fillRect(0,0,W,H);
for(const s of stars){const f=Math.sin(t*2+s.b*10)*.3+.7;x.fillStyle='rgba(200,200,255,'+(f*.8)+')';x.fillRect(s.x*W,s.y*H,s.s,s.s)}
x.strokeStyle='rgba(0,255,0,0.05)';x.lineWidth=1;
for(let i=0;i<W;i+=40){x.beginPath();x.moveTo(i,0);x.lineTo(i,H);x.stroke()}
for(let i=0;i<H;i+=40){x.beginPath();x.moveTo(0,i);x.lineTo(W,i);x.stroke()}
x.strokeStyle='rgba(0,255,0,0.15)';x.lineWidth=2;x.setLineDash([4,8]);
x.beginPath();x.moveTo(.19*W,.28*H);x.lineTo(.35*W,.21*H);x.moveTo(.19*W,.28*H);x.lineTo(.2*W,.55*H);
x.moveTo(.46*W,.21*H);x.lineTo(.65*W,.22*H);x.moveTo(.28*W,.66*H);x.lineTo(.38*W,.6*H);x.stroke();x.setLineDash([]);
for(const r of rooms){const a=r.x*W,b=r.y*H,c=r.w*W,d=r.h*H;
x.fillStyle='rgba(0,20,0,0.6)';x.fillRect(a,b,c,d);
const p=Math.sin(t+rooms.indexOf(r))*.3+.7;x.strokeStyle=r.color;x.globalAlpha=p*.6+.4;x.lineWidth=2;x.strokeRect(a,b,c,d);x.globalAlpha=1;
x.fillStyle=r.color;x.font='12px "Courier New"';x.textAlign='center';x.fillText(r.label,a+c/2,b+d/2+4)}
for(const a of dots){const dx=Math.sin(t*a.s+dots.indexOf(a))*.02,dy=Math.cos(t*a.s*.7+dots.indexOf(a)*2)*.02;
const ax=a.x*W+dx*W,ay=a.y*H+dy*H;const gl=x.createRadialGradient(ax,ay,0,ax,ay,15);
gl.addColorStop(0,a.color);gl.addColorStop(1,'transparent');x.fillStyle=gl;x.fillRect(ax-15,ay-15,30,30);
x.beginPath();x.arc(ax,ay,4,0,Math.PI*2);x.fillStyle=a.color;x.fill();x.strokeStyle='#fff';x.lineWidth=1;x.stroke()}
requestAnimationFrame(d)}d();
</script></body></html>
GAMEPLAY_HTML

echo "Gameplay view created"

echo ""
echo "=== INJECT THREE-VIEW NAV VIA BRANDING ==="
# The branding payload expects CSS/JS to inject between the markers
INJECT_HTML=$(cat << 'INJECT'
<style>
.noedis-topnav{position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;justify-content:center;gap:2px;padding:6px;background:rgba(0,0,0,0.9);border-bottom:1px solid #333;font-family:system-ui,sans-serif}
.noedis-topnav a{color:#666;text-decoration:none;padding:4px 16px;border-radius:4px;font-size:12px;font-weight:600;letter-spacing:1px;transition:all .2s}
.noedis-topnav a:hover{color:#fff;background:rgba(255,255,255,0.1)}
.noedis-topnav a.active{color:#0f0;background:rgba(0,255,0,0.1)}
.noedis-topnav a:first-child{color:#0af}
</style>
<div class="noedis-topnav"><a href="/" class="active">PAPERCLIP</a><a href="#" onclick="window.open('/noedis/gameplay/','_blank','width=1200,height=800');return false">GAMEPLAY</a><a href="#" onclick="alert('Dashboard view coming soon');return false">DASHBOARD</a></div>
INJECT
)

# Escape for JSON
ESCAPED=$(echo "$INJECT_HTML" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null)

echo "Injecting branding HTML..."
curl -s -X POST "$API/api/companies/$COMPANY_ID/branding" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOARD_KEY" \
  -H "Origin: https://noedis.org" \
  -d "{\"runtimeBrandingHtml\": $ESCAPED}" 2>/dev/null | python3 -m json.tool 2>/dev/null

echo ""
echo "=== VERIFY ==="
curl -s "http://127.0.0.1:3100/" 2>/dev/null | grep -o 'noedis-topnav\|PAPERCLIP\|GAMEPLAY\|DASHBOARD' | head -5

echo ""
echo "=== DONE ==="