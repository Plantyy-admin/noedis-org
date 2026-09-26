#!/usr/bin/env python3
"""Deploy org tree GAMEPLAY view to Paperclip on VPS"""
import subprocess, sys, base64, json

VPS = '76.13.154.124'
PORT = '501'
USER = 'vpsadmin'
PASS = 'REDACTED'

def ssh(cmd):
    full = f"sshpass -p '{PASS}' ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o ConnectTimeout=10 -p {PORT} {USER}@{VPS} {cmd}"
    r = subprocess.run(full, capture_output=True, text=True, shell=True, timeout=30)
    return r.stdout, r.stderr, r.returncode

def scp_put(local, remote):
    full = f"sshpass -p '{PASS}' scp -P {PORT} -o PreferredAuthentications=password -o StrictHostKeyChecking=accept-new {local} {USER}@{VPS}:{remote}"
    r = subprocess.run(full, capture_output=True, text=True, shell=True, timeout=30)
    return r.returncode

# Step 1: Read current file
out, err, rc = ssh("cat /usr/lib/node_modules/paperclipai/node_modules/@paperclipai/server/ui-dist/index.html")
if rc != 0:
    print("Error reading file:", err)
    sys.exit(1)
h = out
print(f"Read: {len(h)} bytes")

# Step 2: Find and replace gameplay function
idx = h.find('function gameplay(c)')
if idx == -1:
    idx = h.find('function gameplay(')
print(f"Gameplay at: {idx}")

# Find next function marker
for marker in ['function dash(', 'function inbox(', 'function chat(']:
    nidx = h.find('\n  ' + marker, idx)
    if nidx > 0:
        break

print(f"Next function at: {nidx}")

# New org tree gameplay
new_gp = '''function gameplay(c){
  var DEPT = [
    {n:'VÝVOJ',c:'#33ff33',d:[
      {n:'Frontend',t:[{n:'Web',a:['Frontend Engineer','UI Designer']}]},
      {n:'Backend',t:[{n:'API',a:['Backend Engineer']}]},
      {n:'Game',t:[{n:'Gameplay',a:['Game Designer','3D Artist']}]}
    ]},
    {n:'INFRA',c:'#00ccff',d:[
      {n:'DevOps',t:[{n:'Platform',a:['DevOps Engineer']}]},
      {n:'Security',t:[{n:'Security',a:['Security Engineer']}]},
      {n:'QA',t:[{n:'Testing',a:['QA Engineer','Release Manager']}]}
    ]},
    {n:'IT',c:'#4488ff',d:[{n:'Support',t:[{n:'Helpdesk',a:['Support Specialist']}]}]},
    {n:'MARKETING',c:'#ffb000',d:[
      {n:'Brand',t:[{n:'Campaigns',a:['Marketing Lead','Visual Artist']}]},
      {n:'Growth',t:[{n:'Acquisition',a:['Growth Hacker']}]},
      {n:'Content',t:[{n:'Creative',a:['Narrative Writer','Audio Engineer']}]}
    ]},
    {n:'LEGAL',c:'#aa66ff',d:[{n:'IP',t:[{n:'Licensing',a:['Legal Counsel']}]}]},
    {n:'FINANCE',c:'#ff66aa',d:[{n:'Strategy',t:[{n:'Monetization',a:['Business Analyst']}]}]},
    {n:'LABS',c:'#bb66ff',d:[
      {n:'R&D',t:[{n:'Research',a:['Research Scientist']}]},
      {n:'Innovation',t:[{n:'Prototypes',a:['UX Researcher','Economy Analyst','Content Lead']}]}
    ]}
  ];
  var agents=[];
  c.innerHTML='<div id="org-tree" style="padding:16px;max-width:800px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;color:#ccc"></div>';
  function fetchA(){fetch('http://127.0.0.1:3100/api/companies/8b5aa752-5199-4f51-9a9c-817647ef1aae/agents').then(function(r){return r.json();}).then(function(a){agents=a||[];ren();}).catch(function(){});}
  function gs(n){for(var i=0;i<agents.length;i++){if(agents[i].name===n)return agents[i].status||'idle';}return'idle';}
  function ren(){
    var el=document.getElementById('org-tree');if(!el)return;
    var h='<div style="margin-bottom:16px"><span style="font-size:15px;font-weight:600;color:#eee">ORGANIGRAM</span><span style="font-size:10px;color:#555;margin-left:12px">NOEDIS Command Structure</span></div>'+
      '<div style="margin-bottom:10px;padding:10px 14px;background:#111;border:1px solid #1a2a1a;border-radius:6px;border-left:3px solid #ffb000;display:flex;gap:20px;flex-wrap:wrap">'+
      '<span style="font-size:11px;color:#888">FOUNDER <span style="color:#eee;font-weight:500">lukas.plant1010@gmail.com</span></span>'+
      '<span style="font-size:11px;color:#888">LEFT HAND <span style="color:#33ddff">NOE REPORT</span></span>'+
      '<span style="font-size:11px;color:#888">RIGHT HAND <span style="color:#33ff33">NOE COMMAND</span></span></div>';
    var ta=0;
    DEPT.forEach(function(dep){
      var dc=0;
      h+='<div class="od" style="background:#111;border:1px solid #1a2a1a;border-radius:6px;margin-bottom:6px;overflow:hidden">'+
        '<div class="oh" onclick="ts(this)" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-left:3px solid '+dep.c+';user-select:none">'+
        '<span style="font-size:9px;color:#555;transition:transform 0.2s">\\u25B6</span>'+
        '<span style="font-weight:600;font-size:13px;color:#eee">'+dep.n+'</span>'+
        '<span style="font-size:10px;color:#555;margin-left:auto">'+dep.d.length+' divize</span></div>'+
        '<div class="ob" style="display:none;padding:0 14px 10px 24px">';
      dep.d.forEach(function(div){
        h+='<div style="margin:3px 0"><div class="oh" onclick="ts(this)" style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border-radius:4px;user-select:none">'+
          '<span style="font-size:8px;color:#444;transition:transform 0.2s">\\u25B6</span>'+
          '<span style="font-size:12px;color:'+dep.c+'">'+div.n+'</span>'+
          '<span style="font-size:9px;color:#555;margin-left:auto">'+div.t.length+' t\\u00fdmy</span></div>'+
          '<div class="ob" style="display:none;padding:0 0 4px 18px">';
        div.t.forEach(function(team){
          h+='<div style="margin:2px 0"><div class="oh" onclick="ts(this)" style="display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;border-radius:4px;user-select:none">'+
            '<span style="font-size:7px;color:#333;transition:transform 0.2s">\\u25B6</span>'+
            '<span style="font-size:11px;color:#999">'+team.n+'</span>'+
            '<span style="font-size:9px;color:#555;margin-left:auto">'+team.a.length+' \\u010dlen\\u016f</span></div>'+
            '<div class="ob" style="display:none;padding:0 0 2px 16px">';
          team.a.forEach(function(an){
            var st=gs(an);var dt=st==='running'?'#33ff33':st==='error'?'#ff4444':st==='paused'?'#ffb000':'#555';
            h+='<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:12px;color:#aaa">'+
              '<span style="width:8px;height:8px;border-radius:50%;background:'+dt+';flex-shrink:0;display:inline-block"></span>'+an+'</div>';dc++;
          });h+='</div></div>';ta+=dc;
        });h+='</div></div>';
      });h+='</div></div>';
    });
    h+='<div style="margin-top:12px;padding:8px;border-top:1px solid #1a2a1a;font-size:10px;color:#555;text-align:center">DONE</div>';
    el.innerHTML=h;
  }
  fetchA();setInterval(fetchA,5000);
}
window.ts=function(el){
  var a=el.querySelector('span:first-child'),b=el.nextElementSibling;
  if(!b||b.className!=='ob')return;
  if(b.style.display==='none'){b.style.display='block';if(a)a.style.transform='rotate(90deg)';}
  else{b.style.display='none';if(a)a.style.transform='rotate(0deg)';}
};'''

new_h = h[:idx] + new_gp + h[nidx:]
print(f"New file: {len(new_h)} bytes")

# Write to temp
with open('/tmp/index-org.html', 'w') as f:
    f.write(new_h)

# SCP to VPS
scp_put('/tmp/index-org.html', '/tmp/index-org.html')

# Copy with sudo and restart
out, err, rc = ssh("sudo cp /tmp/index-org.html /usr/lib/node_modules/paperclipai/node_modules/@paperclipai/server/ui-dist/index.html && sudo systemctl restart noedis-paperclip && sleep 4 && sudo systemctl is-active noedis-paperclip")
print(f"Deploy: {out}")

# Verify
out, err, rc = ssh("curl -s http://127.0.0.1:3100/ | grep -c 'VÝVOJ\\|INFRA\\|MARKETING\\|ORGANIGRAM'")
print(f"Org tree matches: {out.strip()}")

# Clean
subprocess.run(['rm', '-f', '/tmp/index-org.html'])

print("DONE")