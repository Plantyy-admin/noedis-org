// NOEDIS v4 - CHAT with any agent | STRUCTURE always expanded | GAMEPLAY isometric
(function(){
var K='noedis.view',C='8b5aa752-5199-4f51-9a9c-817647ef1aae',A='http://127.0.0.1:3100';
var V=localStorage.getItem(K)||'paperclip',di=null,ii=null,ci=null,ai=null;
var DEPT=[
{n:'VYVOJ',c:'#33ff33',d:[{n:'Frontend',t:[{n:'Web App',a:['Frontend Engineer','UI Designer']},{n:'Mobile App',a:['Frontend Engineer']}]},{n:'Backend',t:[{n:'API Services',a:['Backend Engineer']},{n:'Database',a:['Backend Engineer']}]},{n:'Game',t:[{n:'Game Clients',a:['Game Designer']},{n:'Game Server',a:['Game Designer','Backend Engineer']}]}]},
{n:'INFRA',c:'#00ccff',d:[{n:'DevOps',t:[{n:'Infrastructure',a:['DevOps Engineer']},{n:'CI/CD',a:['DevOps Engineer']}]},{n:'Security',t:[{n:'AppSec',a:['Security Engineer']},{n:'NetworkSec',a:['Security Engineer']}]},{n:'QA',t:[{n:'E2E Testing',a:['QA Engineer']},{n:'Performance',a:['QA Engineer','Release Manager']}]}]},
{n:'IT',c:'#4488ff',d:[{n:'Support',t:[{n:'Employee Support',a:['Support Specialist']},{n:'Asset Mgmt',a:['Support Specialist']}]}]},
{n:'MARKETING',c:'#ffb000',d:[{n:'Brand',t:[{n:'Visual Identity',a:['Visual Artist']},{n:'Campaigns',a:['Marketing Lead']}]},{n:'Growth',t:[{n:'User Acquisition',a:['Growth Hacker']},{n:'SEO',a:['Growth Hacker']}]},{n:'Content',t:[{n:'Copywriting',a:['Narrative Writer']},{n:'Multimedia',a:['Audio Engineer','Visual Artist']}]}]},
{n:'LEGAL',c:'#aa66ff',d:[{n:'IP',t:[{n:'Trademarks',a:['Legal Counsel']},{n:'Licensing',a:['Legal Counsel']}]},{n:'Compliance',t:[{n:'GDPR',a:['Legal Counsel']},{n:'Contracts',a:['Legal Counsel']}]}]},
{n:'FINANCE',c:'#ff66aa',d:[{n:'Strategy',t:[{n:'Business Model',a:['Business Analyst']},{n:'Pricing',a:['Business Analyst']}]},{n:'Operations',t:[{n:'Budget',a:['Business Analyst']},{n:'Reporting',a:['Business Analyst']}]}]},
{n:'LABS',c:'#bb66ff',d:[{n:'Research',t:[{n:'AI/ML',a:['Research Scientist']},{n:'Emerging Tech',a:['Research Scientist','Content Lead']}]},{n:'Prototyping',t:[{n:'MVP',a:['UX Researcher','Economy Analyst']},{n:'Experiments',a:['UX Researcher','Content Lead']}]}]}
];
var NAV=['CHAT','PAPERCLIP','GAMEPLAY','STRUCTURE','INBOX'];
var ALL_AGENTS=['NOE','CODY','RENE','Frontend Engineer','UI Designer','Backend Engineer','Game Designer','3D Artist','DevOps Engineer','Security Engineer','QA Engineer','Release Manager','Support Specialist','Marketing Lead','Growth Hacker','Narrative Writer','Visual Artist','Audio Engineer','Legal Counsel','Business Analyst','Research Scientist','UX Researcher','Economy Analyst','Content Lead'];
function init(){
  document.querySelectorAll('.noedis-bar,.noedis-overlay').forEach(function(e){e.remove();});
  var b=document.createElement('div');b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;align-items:center;justify-content:center;height:36px;background:#0a0a0a;border-bottom:1px solid #1a2a1a;font-family:system-ui,sans-serif';
  var t=document.createElement('div');t.style.cssText='display:flex;gap:0';
  NAV.forEach(function(v){
    var btn=document.createElement('button');btn.style.cssText='background:transparent;border:none;cursor:pointer;padding:4px 10px;font-size:10px;font-family:inherit;letter-spacing:1px;color:#666;border-bottom:1.5px solid transparent;white-space:nowrap;font-weight:500';
    btn.dataset.view=v.toLowerCase();btn.textContent=v;
    if(v.toLowerCase()===V||(V==='paperclip'&&v==='PAPERCLIP'))btn.style.cssText+='color:#00ff88;border-bottom-color:#00ff88';
    btn.onmouseover=function(){this.style.color='#aaa'};
    btn.onmouseout=function(){if(this.dataset.view!==(localStorage.getItem(K)||'paperclip'))this.style.color='#666'};
    btn.onclick=function(){sw(this.dataset.view);};t.appendChild(btn);
  });
  b.appendChild(t);document.body.appendChild(b);
  var o=document.createElement('div');o.id='noedis-overlay';
  o.style.cssText='position:fixed;top:36px;left:0;right:0;bottom:0;z-index:99998;display:none;background:#0a0a0a;overflow:auto';
  document.body.appendChild(o);
  setTimeout(function(){sw(V);},500);
}
function sw(view){
  document.querySelectorAll('.noedis-bar button').forEach(function(b){
    b.style.cssText='background:transparent;border:none;cursor:pointer;padding:4px 10px;font-size:10px;font-family:inherit;letter-spacing:1px;color:#666;border-bottom:1.5px solid transparent;white-space:nowrap;font-weight:500';
    if(b.dataset.view===view||(view==='paperclip'&&b.dataset.view==='paperclip'))b.style.cssText+='color:#00ff88;border-bottom-color:#00ff88';
  });
  V=view;localStorage.setItem(K,view);
  var o=document.getElementById('noedis-overlay'),r=document.getElementById('root');
  if(di){clearInterval(di);di=null;}if(ii){clearInterval(ii);ii=null;}if(ci){clearInterval(ci);ci=null;}if(ai){cancelAnimationFrame(ai);ai=null;}
  document.body.style.paddingTop=(view==='paperclip'?'0':'36px');
  if(view==='paperclip'){o.style.display='none';if(r)r.style.display='';document.body.style.overflow='';}
  else{o.style.display='block';if(r)r.style.display='none';document.body.style.overflow='hidden';
    if(view==='chat')ct(o);else if(view==='gameplay')gp(o);else if(view==='structure')st(o);else if(view==='inbox')ib(o);}
}
// CHAT with agent selector
function ct(c){
  c.innerHTML='<div style="display:flex;flex-direction:column;height:100%;font-family:system-ui,sans-serif;color:#ccc">'+
    '<div style="padding:10px 16px;border-bottom:1px solid #1a2a1a;background:#0d0d0d;display:flex;align-items:center;gap:10px">'+
    '<select id="agent-sel" style="background:#111;border:1px solid #333;border-radius:4px;padding:4px 8px;color:#ccc;font-family:system-ui;font-size:11px;outline:none;cursor:pointer">'+
    ALL_AGENTS.map(function(a){return '<option value="'+a+'">'+a+'</option>';}).join('')+
    '</select><span style="font-size:9px;color:#555">Chat with agent</span></div>'+
    '<div id="cm" style="flex:1;overflow-y:auto;padding:12px 16px"></div>'+
    '<div style="display:flex;padding:10px 16px;border-top:1px solid #1a2a1a;background:#0d0d0d">'+
    '<input id="ci" style="flex:1;background:#111;border:1px solid #333;border-radius:4px;padding:8px 12px;color:#ccc;font-family:system-ui;font-size:12px;outline:none" placeholder="Message..."/>'+
    '<button id="cs" style="background:transparent;border:1px solid #00ff88;border-radius:4px;padding:8px 16px;color:#00ff88;margin-left:8px;cursor:pointer;font-family:system-ui;font-size:11px">SEND</button></div></div>';
  var sel=document.getElementById('agent-sel');
  function am(m,w,who){
    var cm=document.getElementById('cm');if(!cm)return;
    var d=document.createElement('div');d.style.cssText='margin:6px 0;display:flex;'+(w?'':'justify-content:flex-end');
    var bg=w?'rgba(255,176,0,0.06)':'rgba(0,255,136,0.06)';
    var bd=w?'rgba(255,176,0,0.15)':'rgba(0,255,136,0.15)';
    d.innerHTML='<div style="max-width:75%;padding:6px 12px;border-radius:6px;font-size:12px;background:'+bg+';border:1px solid '+bd+'">'+
      m+'<div style="font-size:8px;color:#555;margin-top:3px">'+(w?who||'Agent':'You')+'</div></div>';
    cm.appendChild(d);cm.scrollTop=cm.scrollHeight;
  }
  function sm(){
    var inp=document.getElementById('ci');if(!inp)return;
    var txt=inp.value.trim();if(!txt)return;inp.value='';
    var agent=document.getElementById('agent-sel').value;
    am(txt,false,agent);
    fetch(A+'/api/companies/'+C+'/issues',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({title:'To '+agent+': '+txt.substring(0,60),description:txt,assigneeAgentId:'39c710c0-c4c1-4612-bbef-5e4a9f60d12b',status:'open'})})
    .then(function(r){}).catch(function(){});
    var resp=agent==='NOE'?'NOE: I will assess and delegate to CODY.':agent==='CODY'?'CODY: Task received, assigning to team.':agent==='RENE'?'RENE: Noted, reporting to NOE.':agent+': Task received. Working on it.';
    setTimeout(function(){am(resp,true,agent);},1000);
  }
  document.getElementById('cs').onclick=sm;
  document.getElementById('ci').addEventListener('keydown',function(e){if(e.key==='Enter')sm();});
  document.getElementById('cm').innerHTML='<p style="color:#555;text-align:center;padding:30px;font-size:11px">Select an agent and send a message</p>';
}
// GAMEPLAY isometric station
function gp(c){
  var cv=document.createElement('canvas');cv.style.cssText='width:100%;height:100%;display:block';
  c.innerHTML='';c.appendChild(cv);var cx=cv.getContext('2d'),ag=[],tm=0;
  function rs(){var w=c.clientWidth,h=c.clientHeight;cv.width=w*devicePixelRatio;cv.height=h*devicePixelRatio;cv.style.width=w+'px';cv.style.height=h+'px';cx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);}
  rs();window.addEventListener('resize',rs);
  fetch(A+'/api/companies/'+C+'/agents').then(function(r){return r.json();}).then(function(a){ag=a||[];}).catch(function(){});
  var tw=64,th=32,fh=80;
  function iso(sx,sy,sz){return{x:(sx-sy)*tw/2,y:(sx+sy)*th/2-sz*fh};}
  function dr(){
    tm+=0.02;
    var w=c.clientWidth,h=c.clientHeight;cx.fillStyle='#0a0a0a';cx.fillRect(0,0,w,h);
    var mx=w/2,my=h/2+30,gw=6,gd=3,sc=Math.min(1,w/900);
    // Draw starfield
    for(var i=0;i<60;i++){cx.fillStyle='rgba(255,255,255,'+(0.1+Math.sin(tm+i)*0.05)+')';cx.fillRect((i*137+w/2)%w,(i*251+h/2)%h,1.5,1.5);}
    // Draw floors
    var floors=[
      {n:'NOE',c:'#ffb000',y:0},{n:'CODY',c:'#33ff33',y:1},{n:'RENE',c:'#33ddff',y:2},
      {n:'VYVOJ',c:'#33ff33',y:3},{n:'INFRA',c:'#00ccff',y:4},{n:'IT',c:'#4488ff',y:5},
      {n:'MARKETING',c:'#ffb000',y:6},{n:'LEGAL',c:'#aa66ff',y:7},{n:'FINANCE',c:'#ff66aa',y:8},{n:'LABS',c:'#bb66ff',y:9}
    ];
    floors.forEach(function(f,fi){
      var b=iso(-gw/2,gd/2,f.y),ox=mx+b.x*sc,oy=my+b.y*sc;
      cx.fillStyle=f.c+'18';cx.beginPath();
      cx.moveTo(ox,oy-gd*th*sc);cx.lineTo(ox+gw*tw*sc,oy);
      cx.lineTo(ox,oy+gd*th*sc);cx.lineTo(ox-gw*tw*sc,oy);cx.closePath();cx.fill();
      cx.strokeStyle=f.c+'44';cx.lineWidth=1;cx.stroke();
      cx.fillStyle=f.c;cx.font='bold '+(10*sc)+'px system-ui,sans-serif';cx.textAlign='center';cx.textBaseline='middle';
      cx.fillText(f.n,ox,oy+gd*th*sc+14*sc);
      // Right wall
      cx.fillStyle=f.c+'0c';cx.beginPath();cx.moveTo(ox+gw*tw*sc,oy);cx.lineTo(ox+gw*tw*sc,oy+fh*sc);cx.lineTo(ox,oy+gd*th*sc+fh*sc);cx.lineTo(ox,oy+gd*th*sc);cx.closePath();cx.fill();
      cx.strokeStyle=f.c+'22';cx.lineWidth=0.5;cx.stroke();
      // Agent dots
      var fa=ag.filter(function(a){return a.name&&f.n.toLowerCase().indexOf(a.name.toLowerCase().substring(0,3))>=0;});
      fa.slice(0,4).forEach(function(a,i){
        var rx=ox+(i-1.5)*35*sc,ry=oy-8*sc;
        var dt=a.status==='running'?'#33ff33':a.status==='error'?'#ff4444':a.status==='paused'?'#ffb000':'#555';
        var p=a.status==='running'?Math.sin(tm*4+fi)*2+3:2;
        cx.fillStyle=dt;cx.beginPath();cx.arc(rx,ry-8*sc,p,0,Math.PI*2);cx.fill();
        cx.fillStyle='#aaa';cx.font=(7*sc)+'px system-ui,sans-serif';cx.textAlign='center';cx.fillText((a.name||'').substring(0,8),rx,ry+4*sc);
      });
    });
    ai=requestAnimationFrame(dr);
  }
  dr();
}
// STRUCTURE always expanded
function st(c){
  c.innerHTML='<div style="padding:16px;max-width:900px;margin:0 auto;font-family:system-ui,sans-serif;color:#ccc">'+
    '<div style="margin-bottom:10px"><span style="font-size:15px;font-weight:600;color:#eee">STRUCTURE</span><span style="font-size:10px;color:#555;margin-left:10px">NOEDIS Software Company</span></div>'+
    '<div style="margin-bottom:10px;padding:6px 10px;background:#111;border:1px solid #1a2a1a;border-radius:4px;font-size:9px;color:#888;display:flex;flex-wrap:wrap;gap:6px">'+
    'You <b style="color:#eee">\u2192</b> NOE <b style="color:#ffb000">(assess)</b> <b style="color:#eee">\u2192</b> CODY <b style="color:#33ff33">(execute)</b> <b style="color:#eee">\u2192</b> Agents <b style="color:#eee">\u2192</b> RENE <b style="color:#33ddff">(report)</b> <b style="color:#eee">\u2192</b> NOE <b style="color:#ffb000">(decide)</b> <b style="color:#eee">\u2192</b> You</div>'+
    '<div id="st-tree"></div></div>';
  var ag=[];
  function fa(){fetch(A+'/api/companies/'+C+'/agents').then(function(r){return r.json();}).then(function(a){ag=a||[];rn();}).catch(function(){});}
  function gs(n){for(var i=0;i<ag.length;i++){if(ag[i].name===n)return ag[i].status||'idle';}return'idle';}
  function rn(){
    var el=document.getElementById('st-tree');if(!el)return;
    var html='';
    DEPT.forEach(function(dep,di){
      html+='<div style="background:#111;border:1px solid #1a2a1a;border-radius:6px;margin-bottom:4px;overflow:hidden">'+
        '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-left:3px solid '+dep.c+'">'+
        '<span style="width:10px;height:10px;border-radius:2px;background:'+dep.c+';flex-shrink:0;display:inline-block"></span>'+
        '<span style="font-weight:600;font-size:12px;color:#eee">'+dep.n+'</span>'+
        '<span style="font-size:9px;color:#555;margin-left:auto">'+dep.d.length+' divize</span></div>'+
        '<div style="padding:0 10px 6px 28px">';
      dep.d.forEach(function(div,vi){
        html+='<div style="margin:2px 0;padding:4px 6px;border-left:2px solid '+dep.c+'44;border-radius:2px">'+
          '<div style="display:flex;align-items:center;gap:6px;padding:2px 0">'+
          '<span style="font-size:11px;color:'+dep.c+'">'+div.n+'</span>'+
          '<span style="font-size:8px;color:#555;margin-left:auto">'+div.t.length+' tymy</span></div>'+
          '<div style="padding:0 0 2px 14px">';
        div.t.forEach(function(team,ti){
          html+='<div style="margin:1px 0;padding:3px 6px;background:#0d0d0d;border-radius:3px">'+
            '<div style="display:flex;align-items:center;gap:5px;padding:1px 0">'+
            '<span style="font-size:10px;color:#999">'+team.n+'</span>'+
            '<span style="font-size:8px;color:#555;margin-left:auto">'+team.a.length+' agentu</span></div>'+
            '<div style="padding:0 0 2px 10px;display:flex;flex-wrap:wrap;gap:3px">';
          team.a.forEach(function(an){
            var st=gs(an);var dt=st==='running'?'#33ff33':st==='error'?'#ff4444':st==='paused'?'#ffb000':'#555';
            html+='<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;font-size:10px;color:#aaa;background:#151515;border-radius:3px">'+
              '<span style="width:5px;height:5px;border-radius:50%;background:'+dt+';display:inline-block"></span>'+an+'</span>';
          });html+='</div></div>';
        });html+='</div></div>';
      });html+='</div></div>';
    });
    el.innerHTML=html;
  }
  fa();di=setInterval(fa,5000);
}
// INBOX from RENE -> NOE -> Founder
function ib(c){
  c.innerHTML='<div style="padding:16px;font-family:system-ui,sans-serif;color:#ccc">'+
    '<h2 style="font-size:15px;font-weight:600;color:#eee;margin:0">INBOX</h2>'+
    '<p style="font-size:9px;color:#555;margin:4px 0 16px">RENE \u2192 NOE \u2192 You \u00b7 DONE / DECISION / RISK / RELEASE</p>'+
    '<div id="il"><p style="color:#555">Loading...</p></div></div>';
  function rf(){
    fetch(A+'/api/companies/'+C+'/activity?limit=20').then(function(r){return r.json();}).then(function(e){
      var il=document.getElementById('il');if(!il)return;
      if(!e||!e.length){il.innerHTML='<p style="color:#555;font-size:11px;padding:20px;text-align:center">No reports yet</p>';return;}
      il.innerHTML=e.map(function(x){
        var a=(x.action||x.type||'event').replace(/_/g,' ').toUpperCase();
        return '<div style="background:#111;border:1px solid #1a2a1a;padding:8px 12px;margin:4px 0;border-left:3px solid '+
          (a.indexOf('DONE')>=0?'#33ff33':a.indexOf('RISK')>=0?'#ff4444':a.indexOf('DECISION')>=0?'#ffb000':'#333')+
          ';border-radius:4px;font-size:11px;display:flex;justify-content:space-between;align-items:center">'+
          '<span>'+a+'</span><span style="font-size:8px;color:#555;font-family:monospace">'+new Date().toLocaleTimeString()+'</span></div>';
      }).join('');
    }).catch(function(){});
  }
  rf();ii=setInterval(rf,6000);
}
try{var s=localStorage.getItem('noedis.depts');if(s){var p=JSON.parse(s);if(p&&p.length)DEPT=p;}}catch(e){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();