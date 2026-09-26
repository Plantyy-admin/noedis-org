   function initGameplay(container) {
    var canvas = document.createElement('canvas');
    canvas.id = 'noedis-gameplay-canvas';
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    container.innerHTML = '';
    container.appendChild(canvas);
    gameplayCanvas = canvas;
    gameplayCtx = canvas.getContext('2d');
    var running = true;

    var TILE_W = 64, TILE_H = 32, FLOOR_H = 90;
    var COLS = 8, ROWS = 6;
    var agentData = [];
    var dataReady = false;

    // Floor definitions: label, color, z-level, room grid positions
    var floors = [
      { label: 'EXECUTIVE', color: '#ffb000', z: 0,
        rooms: [{c:1,r:1},{c:2,r:1}] },
      { label: 'USER', color: '#33ddff', z: 1,
        rooms: [{c:0,r:0},{c:2,r:0},{c:1,r:2}] },
      { label: 'TECHNOLOGY', color: '#33ff33', z: 2,
        rooms: [{c:0,r:0},{c:2,r:0},{c:0,r:2},{c:2,r:2}] },
      { label: 'GAME & ECONOMY', color: '#aa66ff', z: 3,
        rooms: [{c:1,r:0},{c:0,r:2},{c:2,r:2}] },
      { label: 'CREATIVE', color: '#ff66aa', z: 4,
        rooms: [{c:0,r:0},{c:2,r:0},{c:0,r:2},{c:2,r:2}] },
      { label: 'MARKETING + BUSINESS', color: '#ff8800', z: 5,
        rooms: [{c:0,r:1},{c:2,r:0},{c:2,r:2}] },
      { label: 'LEGAL + QA + LABS', color: '#4488ff', z: 6,
        rooms: [{c:0,r:0},{c:2,r:0},{c:0,r:2},{c:2,r:2}] }
    ];

    // Fetch agents
    fetch(API + '/api/companies/' + companyId + '/agents')
      .then(function(r) { return r.json(); })
      .then(function(agents) {
        dataReady = true;
        if (!agents || !agents.length) return;
        var noeCommandSet = false, noeReportSet = false;
        var unmatched = [];
        agents.forEach(function(a) {
          var n = (a.name || '').toUpperCase();
          var rl = (a.role || '').toUpperCase();
          if (n.indexOf('COMMAND') >= 0 || rl.indexOf('COMMAND') >= 0) {
            agentData.push({ agent: a, floorIdx: 0 });
            noeCommandSet = true;
          } else if (n.indexOf('REPORT') >= 0 || rl.indexOf('REPORT') >= 0) {
            agentData.push({ agent: a, floorIdx: 0 });
            noeReportSet = true;
          } else if (n.indexOf('NOE') >= 0) {
            if (!noeCommandSet) { agentData.push({ agent: a, floorIdx: 0 }); noeCommandSet = true; }
            else if (!noeReportSet) { agentData.push({ agent: a, floorIdx: 0 }); noeReportSet = true; }
            else { unmatched.push(a); }
          } else if (n.indexOf('USER') >= 0 || rl.indexOf('USER') >= 0) {
            agentData.push({ agent: a, floorIdx: 1 });
          } else if (n.indexOf('TECH') >= 0 || n.indexOf('ENGINEER') >= 0 || n.indexOf('DEVELOP') >= 0 || rl.indexOf('TECH') >= 0) {
            agentData.push({ agent: a, floorIdx: 2 });
          } else if (n.indexOf('GAME') >= 0 || n.indexOf('ECONOMY') >= 0 || rl.indexOf('GAME') >= 0) {
            agentData.push({ agent: a, floorIdx: 3 });
          } else if (n.indexOf('CREATE') >= 0 || n.indexOf('DESIGN') >= 0 || n.indexOf('ART') >= 0 || rl.indexOf('CREATE') >= 0) {
            agentData.push({ agent: a, floorIdx: 4 });
          } else if (n.indexOf('MARKET') >= 0 || n.indexOf('BUSINESS') >= 0 || rl.indexOf('MARKET') >= 0) {
            agentData.push({ agent: a, floorIdx: 5 });
          } else if (n.indexOf('LEGAL') >= 0 || n.indexOf('QA') >= 0 || n.indexOf('LAB') >= 0 || n.indexOf('RELEASE') >= 0 || n.indexOf('QUALITY') >= 0) {
            agentData.push({ agent: a, floorIdx: 6 });
          } else {
            unmatched.push(a);
          }
        });
        // Distribute unmatched round-robin across floors 1-6
        var fi = 1;
        unmatched.forEach(function(a) {
          agentData.push({ agent: a, floorIdx: fi });
          fi = (fi % 6) + 1;
        });
      })
      .catch(function() { dataReady = true; });

    function isoToScreen(tx, ty, tz) {
      return {
        x: (tx - ty) * TILE_W / 2,
        y: (tx + ty) * TILE_H / 2 - tz * FLOOR_H
      };
    }

    function resize() {
      var w = container.clientWidth, h = container.clientHeight;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      gameplayCtx.setTransform(window.devicePixelRatio,0,0,window.devicePixelRatio,0,0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Get screen center of a room at grid (col, row) on floor z
    function getRoomCenter(col, row, z) {
      return isoToScreen(col * 2 + 1, row * 2 + 1, z);
    }

    // Draw a room as isometric box
    function drawRoom(ctx, col, row, z, color, pulse) {
      var tx0 = col * 2, ty0 = row * 2;
      var wallH = 0.4;

      // Wall corners
      var w0 = isoToScreen(tx0, ty0, z);
      var w1 = isoToScreen(tx0 + 2, ty0, z);
      var w2 = isoToScreen(tx0 + 2, ty0 + 2, z);
      var w3 = isoToScreen(tx0, ty0 + 2, z);
      var w0t = isoToScreen(tx0, ty0, z + wallH);
      var w1t = isoToScreen(tx0 + 2, ty0, z + wallH);
      var w2t = isoToScreen(tx0 + 2, ty0 + 2, z + wallH);
      var w3t = isoToScreen(tx0, ty0 + 2, z + wallH);

      var wallFill = color + '55';
      var wallStroke = color + '99';
      var winColor = color + 'bb';

      // Left wall (w0-w3 rising)
      ctx.beginPath();
      ctx.moveTo(w0.x, w0.y); ctx.lineTo(w3.x, w3.y);
      ctx.lineTo(w3t.x, w3t.y); ctx.lineTo(w0t.x, w0t.y);
      ctx.closePath();
      ctx.fillStyle = wallFill; ctx.fill();
      ctx.strokeStyle = wallStroke; ctx.lineWidth = 0.5; ctx.stroke();

      // Right wall (w1-w2 rising) - only if not at the far edge
      if (col < 3) {
        ctx.beginPath();
        ctx.moveTo(w1.x, w1.y); ctx.lineTo(w2.x, w2.y);
        ctx.lineTo(w2t.x, w2t.y); ctx.lineTo(w1t.x, w1t.y);
        ctx.closePath();
        ctx.fillStyle = wallFill; ctx.fill();
        ctx.strokeStyle = wallStroke; ctx.lineWidth = 0.5; ctx.stroke();
      }

      // Windows on left wall
      var ww = (w3.x - w0.x) * 0.12;
      var wh = (w3t.y - w3.y) * 0.35;
      ctx.fillStyle = winColor + '33';
      ctx.fillRect(w0.x + (w3.x - w0.x) * 0.25, w3.y + (w3t.y - w3.y) * 0.25, ww, wh);
      ctx.fillRect(w0.x + (w3.x - w0.x) * 0.55, w3.y + (w3t.y - w3.y) * 0.25, ww, wh);

      // Roof
      ctx.beginPath();
      ctx.moveTo(w0t.x, w0t.y); ctx.lineTo(w1t.x, w1t.y);
      ctx.lineTo(w2t.x, w2t.y); ctx.lineTo(w3t.x, w3t.y);
      ctx.closePath();
      ctx.fillStyle = color + (pulse > 0.8 ? 'cc' : '77');
      ctx.fill();
      ctx.strokeStyle = color + 'aa'; ctx.lineWidth = 0.5; ctx.stroke();
    }

    var time = 0;

    function render() {
      if (!running) return;
      time += 0.016;
      var w = container.clientWidth, h = container.clientHeight;
      var ctx = gameplayCtx;

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      // Auto-scale to fit viewport
      var bw = Math.abs(isoToScreen(COLS, 0, 0).x - isoToScreen(0, ROWS, 0).x);
      var bh = Math.abs(isoToScreen(0, ROWS, 0).y - isoToScreen(COLS, 0, 0).y) + (floors.length * FLOOR_H);
      var scale = Math.min((w * 0.82) / bw, (h * 0.82) / bh, 1.5);
      scale = Math.max(scale, 0.4);

      var centerIso = isoToScreen(COLS / 2, ROWS / 2, floors.length / 2);
      var ox = w / 2 - centerIso.x * scale;
      var oy = h / 2 - centerIso.y * scale;

      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);

      // Draw each floor
      var i, fi;
      for (i = 0; i < floors.length; i++) {
        fi = floors[i];
        var z = fi.z;
        var color = fi.color;

        // Drop shadow
        var sc = [
          isoToScreen(COLS, 0, z - 0.3),
          isoToScreen(COLS, ROWS, z - 0.3),
          isoToScreen(0, ROWS, z - 0.3)
        ];
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(sc[0].x + 5, sc[0].y + 5);
        ctx.lineTo(sc[1].x + 5, sc[1].y + 5);
        ctx.lineTo(sc[2].x + 5, sc[2].y + 5);
        ctx.closePath(); ctx.fill();

        // Floor platform
        ctx.beginPath();
        var p = [
          isoToScreen(0, 0, z),
          isoToScreen(COLS, 0, z),
          isoToScreen(COLS, ROWS, z),
          isoToScreen(0, ROWS, z)
        ];
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.lineTo(p[2].x, p[2].y);
        ctx.lineTo(p[3].x, p[3].y);
        ctx.closePath();
        ctx.fillStyle = color + '33';
        ctx.fill();
        ctx.strokeStyle = color + '77';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Grid lines
        ctx.strokeStyle = color + '22';
        ctx.lineWidth = 0.5;
        var g;
        for (g = 0; g <= COLS; g++) {
          var g1 = isoToScreen(g, 0, z);
          var g2 = isoToScreen(g, ROWS, z);
          ctx.beginPath(); ctx.moveTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.stroke();
        }
        for (g = 0; g <= ROWS; g++) {
          var g1b = isoToScreen(0, g, z);
          var g2b = isoToScreen(COLS, g, z);
          ctx.beginPath(); ctx.moveTo(g1b.x, g1b.y); ctx.lineTo(g2b.x, g2b.y); ctx.stroke();
        }

        // Draw rooms
        var pulse = Math.sin(time * 2 + i) * 0.25 + 0.75;
        for (var ri = 0; ri < fi.rooms.length; ri++) {
          drawRoom(ctx, fi.rooms[ri].c, fi.rooms[ri].r, z, color, pulse);
        }

        // Floor label
        var lp = isoToScreen(COLS / 2, ROWS / 2, z + 0.05);
        ctx.fillStyle = color;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText(fi.label, lp.x, lp.y);
        ctx.shadowBlur = 0;

        // Collect agents on this floor
        var floorAgents = [];
        for (var ai = 0; ai < agentData.length; ai++) {
          if (agentData[ai].floorIdx === i) floorAgents.push(agentData[ai]);
        }

        // Draw agent indicators
        for (var aj = 0; aj < floorAgents.length; aj++) {
          var ad = floorAgents[aj];
          // Assign room round-robin
          var roomIdx = aj % fi.rooms.length;
          var rr = fi.rooms[roomIdx];
          var rc = getRoomCenter(rr.c, rr.r, z);

          // Position dot above room
          var dotX = rc.x + (aj - (floorAgents.length - 1) / 2) * 30;
          var dotY = rc.y - 55;

          var status = (ad.agent.status || 'idle').toLowerCase();
          var dotColor, glowColor, radius = 5, glowR = 14, isGlowing = false;

          if (status === 'working' || status === 'active' || status === 'running') {
            dotColor = '#33ff33'; glowColor = 'rgba(51,255,51,0.35)'; isGlowing = true;
          } else if (status === 'error' || status === 'failed') {
            dotColor = '#ff4444'; glowColor = 'rgba(255,68,68,0.45)'; isGlowing = true;
          } else if (status === 'paused') {
            dotColor = '#ffb000'; glowColor = 'rgba(255,176,0,0.2)';
          } else {
            dotColor = '#888888'; glowColor = 'rgba(136,136,136,0.15)';
          }

          // Animated glow
          var gs = glowR;
          if (isGlowing) gs += Math.sin(time * 4 + aj * 1.7) * 4;

          var grad = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, gs);
          grad.addColorStop(0, glowColor);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(dotX, dotY, gs, 0, Math.PI * 2); ctx.fill();

          // Dot
          ctx.fillStyle = dotColor;
          ctx.shadowColor = dotColor + '99';
          ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(dotX, dotY, radius, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;

          // Agent name
          var nameParts = (ad.agent.name || '').split(' ');
          var shortName = ad.agent.name || '?';
          if (shortName.length > 10) {
            shortName = nameParts[0] || '?';
            if (nameParts.length > 1) shortName = nameParts[0].substring(0,5) + '.' + nameParts[1].substring(0,3);
          }
          ctx.fillStyle = '#bbbbbb';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(shortName, dotX, dotY + radius + 2);
        }
      }

      ctx.restore();

      // Loading overlay
      if (!dataReady) {
        ctx.fillStyle = 'rgba(10,10,10,0.7)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#33ff33';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = Math.sin(time * 2) * 0.3 + 0.7;
        ctx.fillText('LOADING NOEDIS ASSETS...', w / 2, h / 2);
        ctx.globalAlpha = 1;
      }

      // Footer info
      ctx.fillStyle = '#1a1a2a';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('NOEDIS HQ  •  ISOMETRIC v1.0', w - 12, h - 12);

      // Building outer glow
      var grad2 = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.6);
      grad2.addColorStop(0, 'transparent');
      grad2.addColorStop(1, 'rgba(0,20,0,0.06)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      animFrameId = requestAnimationFrame(render);
    }
    render();
  }