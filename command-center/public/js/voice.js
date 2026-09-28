/* ══════════════════════════════════════════════════════════════
   VOICE panel — the CHAT | VOICE switcher and the APEX voice loop

   One loop: record → transcribe → ask → show the reply → speak it, then
   listen again. The APEX orb in the stage is driven from here by
   postMessage, so it reflects what the loop is actually doing — including
   which agent the turn went to, which lights that agent's circle.

   The microphone is captured in the browser; everything else (STT, the
   agent, the routing, TTS) runs on the VPS behind /noedis/api/voice/*.
   ══════════════════════════════════════════════════════════════ */

import { esc } from './util.js';

const BASE = '/noedis';
const MODE_KEY = 'noedis.chatMode';
const AUTOLISTEN_KEY = 'noedis.voiceAutoListen';
const TARGET_KEY = 'noedis.voiceTarget';

/** How many silent turns in a row before hands-free listening gives up. */
const MAX_EMPTY_TURNS = 2;

let onToast = () => {};
let mode = 'text';
let recorder = null;
let chunks = [];
let stream = null;
let audioCtx = null;
let analyser = null;
let waveRaf = null;
let busy = false;
let statusTimer = null;

/* voice targeting */
let agents = [];
let targetAgentId = '';       // '' = NOE / auto
let autoListen = true;
let listening = false;
let emptyTurns = 0;
let delegations = [];
let lastApex = 'idle';

/* ── tiny helpers ─────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

async function jsonFetch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 401 && res.headers.get('x-noedis-auth') === 'required') {
    location.replace('/noedis/login');
    throw new Error('unauthenticated');
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (res.status === 401 && res.headers.get('x-noedis-auth') === 'required') {
    location.replace('/noedis/login');
    throw new Error('unauthenticated');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── conversation rendering ───────────────────────────────── */

function logEl() {
  return $('voice-log');
}

function appendMsg(who, text, cls = '') {
  const host = logEl();
  if (!host) return;
  host.querySelector('.empty-note')?.remove();
  const node = document.createElement('div');
  node.className = `voice-msg ${cls}`.trim();
  node.innerHTML = `<div class="voice-msg-who">${esc(who)}</div><div class="voice-msg-text">${esc(text)}</div>`;
  host.append(node);
  host.scrollTop = host.scrollHeight;
}

function setStatus(text, isError = false) {
  const el = $('voice-status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', Boolean(isError));
}

/* ── driving the APEX orb ─────────────────────────────────── */

/**
 * Tell the orb what is happening. `agents` names who the turn touched — the
 * orb resolves each handle to a circle and lights it, so the picture around
 * the orb is the picture of the work.
 */
function setHudState(state, { agents: touched = null, action = null } = {}) {
  lastApex = state;
  const el = $('voice-hud-state');
  if (el) {
    el.dataset.state = state;
    el.textContent = state.toUpperCase();
  }
  const frame = $('apex-frame');
  const payload = { apex: state };
  if (touched && touched.length) {
    payload.agents = touched;
    if (action) payload.action = action;
  } else if (state === 'idle') {
    payload.clearActions = true;
  }
  try {
    frame?.contentWindow?.postMessage(payload, '*');
  } catch {
    /* the frame may not be up yet — the orb keeps its own state */
  }
}

function setMicState(state, label) {
  const mic = $('voice-mic');
  if (!mic) return;
  mic.classList.toggle('recording', state === 'recording');
  mic.classList.toggle('busy', state === 'busy');
  mic.disabled = state === 'busy';
  mic.setAttribute('aria-pressed', String(state === 'recording'));
  const l = $('voice-mic-label');
  if (l && label) l.textContent = label;
}

/* ── the APEX stage ───────────────────────────────────────── */

function loadApex() {
  const frame = $('apex-frame');
  if (!frame || frame.dataset.loaded === 'yes') return;
  // served by Caddy from the APEX-UI service; see docs/COMMAND-CENTER.md §7c
  frame.src = '/voice';
  frame.dataset.loaded = 'yes';
  frame.addEventListener('load', () => {
    // Re-send the current state: the orb was not listening when it was posted.
    setHudState(lastApex);
    pushTargetToOrb();
  });
}

/* ── targets ──────────────────────────────────────────────── */

function agentLabel(a) {
  const where = a.department ? ` · ${a.department}` : '';
  const lead = a.isLeadership ? '★ ' : '';
  return `${lead}${a.name}${where}`;
}

async function loadAgents() {
  const select = $('voice-target');
  try {
    const data = await getJson('/api/voice/agents');
    agents = Array.isArray(data?.agents) ? data.agents : [];
  } catch {
    agents = [];
  }
  if (!select) return;
  const previous = targetAgentId;
  select.innerHTML = '';

  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'AUTO — podle jména v řeči, jinak NOE';
  select.append(auto);

  const lead = agents.filter((a) => a.isLeadership);
  const heads = agents.filter((a) => a.isDepartmentHead && !a.isLeadership);
  const rest = agents.filter((a) => !a.isLeadership && !a.isDepartmentHead);

  const group = (label, list) => {
    if (!list.length) return;
    const g = document.createElement('optgroup');
    g.label = label;
    for (const a of list) {
      const o = document.createElement('option');
      o.value = a.id;
      o.textContent = agentLabel(a);
      g.append(o);
    }
    select.append(g);
  };
  group('Vedení', lead);
  group('Oddělení', heads);
  group('Agent', rest);

  if (previous && agents.some((a) => a.id === previous)) select.value = previous;
  else select.value = '';

  const count = $('voice-target-count');
  if (count) count.textContent = `${agents.length} agentů`;
  markTarget();
}

function markTarget() {
  const hint = $('voice-target-hint');
  if (!hint) return;
  if (!targetAgentId) {
    hint.textContent = 'Mluvíš na firmu — úkol převezme NOE a rozdělí ho.';
    return;
  }
  const a = agents.find((x) => x.id === targetAgentId);
  hint.textContent = a ? `Mluvíš přímo na ${a.name}.` : 'Vybraný agent už v adresáři není.';
}

function setTarget(id, { announce = false } = {}) {
  targetAgentId = id || '';
  try {
    localStorage.setItem(TARGET_KEY, targetAgentId);
  } catch {
    /* private mode */
  }
  const select = $('voice-target');
  if (select && select.value !== targetAgentId) select.value = targetAgentId;
  markTarget();
  pushTargetToOrb();
  if (announce) {
    const a = agents.find((x) => x.id === targetAgentId);
    setStatus(a ? `Cíl: ${a.name}` : 'Cíl: NOE (auto)');
  }
}

/** The orb highlights the picked circle too, so the picture agrees with the panel. */
function pushTargetToOrb() {
  const frame = $('apex-frame');
  try {
    frame?.contentWindow?.postMessage(
      { noedis: 'target', agentId: targetAgentId || null },
      '*',
    );
  } catch {
    /* no frame yet */
  }
}

/* ── mode switching ───────────────────────────────────────── */

function setMode(next) {
  mode = next === 'voice' ? 'voice' : 'text';
  document.querySelectorAll('.mode-key').forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('#view-chat .mode-pane').forEach((p) => {
    p.classList.toggle('active', p.dataset.pane === mode);
  });
  const hint = $('mode-hint');
  if (hint) {
    hint.textContent =
      mode === 'voice'
        ? 'Mluv na firmu — jméno v řeči určí, kdo úkol dostane'
        : 'Zadání práce agentovi v Paperclipu';
  }
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* private mode — not worth surfacing */
  }
  if (mode === 'voice') {
    loadApex();
    startStatusPolling();
    loadAgents();
    loadDelegations();
  } else {
    stopStatusPolling();
    stopRecording();
  }
}

/* ── Hermes status ────────────────────────────────────────── */

/* Last channel configuration seen in /status. refreshWhatsapp() needs it
   to know whether the WhatsApp half is switched on at all, and it is
   cheaper to remember it than to fetch /status a second time. */
let lastChannels = null;

async function refreshStatus() {
  const badge = $('hermes-state');
  if (!badge) return null;
  try {
    const res = await fetch(`${BASE}/api/voice/status`, { headers: { Accept: 'application/json' } });
    const s = await res.json();
    const ok = Boolean(s?.hermes?.reachable);
    const ch = s?.hermes?.channels || {};
    const tg = Boolean(ch?.telegram?.configured);
    const waOn = Boolean(ch?.whatsapp?.enabled);
    const linked = Boolean(s?.whatsapp?.linked);
    lastChannels = ch;
    if (!ok) {
      badge.dataset.state = 'off';
      badge.textContent = 'OFFLINE';
      badge.title = s?.hermes?.error || 'Hermes neodpovídá';
    } else if (tg) {
      const n = Number(ch?.telegram?.authorisedUsers || 0);
      badge.dataset.state = 'ok';
      badge.textContent = 'HERMES · TG';
      badge.title = `model ${s.hermes.model || '?'} · Telegram, oprávněných uživatelů: ${n}`;
    } else if (waOn && !linked) {
      badge.dataset.state = 'warn';
      badge.textContent = 'PŘIPOJIT WA';
      badge.title = 'Hermes běží, ale WhatsApp ještě není spárovaný';
    } else if (!waOn) {
      badge.dataset.state = 'warn';
      badge.textContent = 'BEZ KANÁLU';
      badge.title = 'Hermes běží, ale není zapnutý žádný messenger';
    } else {
      badge.dataset.state = 'ok';
      badge.textContent = 'HERMES · WA';
      badge.title = `model ${s.hermes.model || '?'} · WhatsApp spárováno`;
    }
    return s;
  } catch {
    badge.dataset.state = 'off';
    badge.textContent = 'OFFLINE';
    return null;
  }
}

function startStatusPolling() {
  if (statusTimer) return;
  refreshStatus().then(() => refreshWhatsapp());
  statusTimer = setInterval(async () => {
    await refreshStatus();
    refreshWhatsapp();
  }, 8000);
}

function stopStatusPolling() {
  if (!statusTimer) return;
  clearInterval(statusTimer);
  statusTimer = null;
  stopQrRefresh();
}

/* ── the hand-off feed ────────────────────────────────────── */

function delegationLine(d) {
  const who = d.assigneeName || 'NOE';
  const id = d.id ? String(d.id).slice(0, 8) : null;
  const broken = d.error || d.wakeError;
  return { who, id, broken, title: d.title || '(bez názvu)', at: d.at };
}

function renderDelegations() {
  const host = $('voice-delegations');
  if (!host) return;
  if (!delegations.length) {
    host.innerHTML = '<div class="empty-note">Zatím žádné předání.</div>';
    return;
  }
  host.innerHTML = delegations
    .map((d) => {
      const { who, id, broken, title } = delegationLine(d);
      const time = d.at ? new Date(d.at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '';
      return `<div class="voice-dlg${broken ? ' err' : ''}">
        <div class="voice-dlg-top"><span class="voice-dlg-who">${esc(who)}</span><span class="voice-dlg-time">${esc(time)}</span></div>
        <div class="voice-dlg-title">${esc(title)}</div>
        ${id ? `<div class="voice-dlg-id">issue ${esc(id)}${broken ? ` · chyba: ${esc(String(broken))}` : ''}</div>` : ''}
      </div>`;
    })
    .join('');
}

async function loadDelegations() {
  try {
    const data = await getJson('/api/voice/delegations?limit=10');
    delegations = Array.isArray(data?.items) ? data.items : [];
  } catch {
    delegations = [];
  }
  renderDelegations();
}

/* ── WhatsApp pairing card ────────────────────────────────── */

let qrTimer = null;

function stopQrRefresh() {
  if (!qrTimer) return;
  clearInterval(qrTimer);
  qrTimer = null;
}

/** The scanned code rotates every ~20 s, so the image is re-fetched often. */
function startQrRefresh() {
  if (qrTimer) return;
  qrTimer = setInterval(loadQr, 4000);
}

function loadQr() {
  const img = $('wa-qr');
  if (!img) return;
  const url = `${BASE}/api/voice/whatsapp/qr.png?t=${Date.now()}`;
  const probe = new Image();
  probe.onload = () => {
    img.src = url;
  };
  probe.src = url;
}

async function refreshWhatsapp() {
  const card = $('wa-pair');
  if (!card) return;
  if (lastChannels && lastChannels.whatsapp && !lastChannels.whatsapp.enabled) {
    card.hidden = true;
    stopQrRefresh();
    return;
  }
  try {
    const res = await fetch(`${BASE}/api/voice/whatsapp`, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      card.hidden = true;
      stopQrRefresh();
      return;
    }
    const s = await res.json();
    if (s.linked) {
      card.hidden = true;
      stopQrRefresh();
      return;
    }
    card.hidden = false;
    const title = $('wa-pair-title');
    const body = $('wa-pair-body');
    const start = $('wa-start');
    const stop = $('wa-stop');
    const waiting = s.state === 'waiting';

    if (title) {
      title.textContent = s.error
        ? `Chyba: ${s.error}`
        : waiting
          ? `Naskenuj QR — platí ${Math.max(0, 20 - (s.qrAgeSeconds || 0))} s`
          : `WhatsApp: ${s.state === 'starting' ? 'startuji…' : 'nepřipojeno'}`;
    }
    if (body) body.hidden = !waiting;
    if (start) start.hidden = waiting || s.state === 'starting';
    if (stop) stop.hidden = !(waiting || s.state === 'starting');

    if (waiting) {
      loadQr();
      startQrRefresh();
    } else {
      stopQrRefresh();
    }
  } catch {
    /* the status poll already reports an offline Hermes; stay quiet here */
  }
}

async function startPairing() {
  const start = $('wa-start');
  if (start) start.disabled = true;
  try {
    await jsonFetch('/api/voice/whatsapp/start', {});
    await refreshWhatsapp();
  } catch (err) {
    onToast(`Párování se nepovedlo: ${err.message}`, 'error');
  } finally {
    if (start) start.disabled = false;
  }
}

async function stopPairing() {
  try {
    await jsonFetch('/api/voice/whatsapp/stop', {});
  } catch {
    /* nothing to report — the card reflects the real state anyway */
  }
  await refreshWhatsapp();
}

/* ── recording + waveform ─────────────────────────────────── */

function drawWave() {
  const canvas = $('voice-wave');
  if (!canvas || !analyser) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);

  // The waveform wears the state's colour: orange while the founder speaks.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ff8737';
  ctx.shadowColor = '#ff8737';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w;
    const y = h / 2 + ((data[i] - 128) / 128) * (h / 2 - 3);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  waveRaf = requestAnimationFrame(drawWave);
}

function stopWave() {
  if (waveRaf) cancelAnimationFrame(waveRaf);
  waveRaf = null;
  const canvas = $('voice-wave');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

async function startRecording({ automatic = false } = {}) {
  if (busy || listening) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Tenhle prohlížeč neumí mikrofon.', true);
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    setStatus('Mikrofon se nepodařilo otevřít — povol přístup.', true);
    onToast('Mikrofon zamítnut', 'error');
    setHudState('error');
    disarmAutoListen('bez mikrofonu');
    return;
  }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';
  chunks = [];
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };
  recorder.onstop = () => {
    const type = recorder?.mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type });
    releaseMic();
    listening = false;
    if (blob.size < 1200) {
      handleEmptyTurn('Nic jsem neslyšel.');
      return;
    }
    transcribeAndAsk(blob);
  };

  listening = true;
  recorder.start();
  setMicState('recording', 'STOP');
  setStatus(automatic ? 'Poslouchám…' : 'Mluv… klikni znovu pro konec');
  setHudState('listening');
  drawWave();
}

function releaseMic() {
  stopWave();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  audioCtx?.close().catch(() => {});
  audioCtx = null;
  analyser = null;
}

function stopRecording() {
  if (recorder && recorder.state === 'recording') recorder.stop();
  recorder = null;
  listening = false;
}

/* ── hands-free bookkeeping ───────────────────────────────── */

function disarmAutoListen(why) {
  autoListen = false;
  const box = $('voice-autolisten');
  if (box) box.checked = false;
  if (why) setStatus(`Poslech vypnut — ${why}. Klikni MLUVIT.`);
}

function handleEmptyTurn(message) {
  emptyTurns += 1;
  setMicState('idle', 'MLUVIT');
  if (autoListen && emptyTurns >= MAX_EMPTY_TURNS) {
    setHudState('idle');
    disarmAutoListen('dvakrát jsem nic neslyšel');
    return;
  }
  setStatus(`${message} ${emptyTurns}/2`, true);
  setHudState('idle');
  if (autoListen) setTimeout(() => startRecording({ automatic: true }), 900);
}

/* ── the loop ─────────────────────────────────────────────── */

async function transcribeAndAsk(blob) {
  if (busy) return;
  busy = true;
  setMicState('busy', '…');
  setStatus('Přepisuji…');
  setHudState('thinking');
  try {
    const res = await fetch(`${BASE}/api/voice/transcribe`, {
      method: 'POST',
      body: blob,
      headers: { 'Content-Type': blob.type || 'audio/webm', Accept: 'application/json' },
    });
    if (res.status === 401 && res.headers.get('x-noedis-auth') === 'required') {
      location.replace('/noedis/login');
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    const text = String(data?.text || '').trim();
    if (!text) {
      handleEmptyTurn('Přepis je prázdný.');
      return;
    }
    emptyTurns = 0;
    appendMsg('TY (hlas)', text, 'me');
    await ask(text, true);
  } catch (err) {
    setStatus(`Přepis selhal: ${err.message}`, true);
    appendMsg('CHYBA', `Přepis se nepovedl: ${err.message}`, 'err');
    setHudState('error');
    if (autoListen) setTimeout(() => startRecording({ automatic: true }), 1600);
  } finally {
    busy = false;
    setMicState('idle', 'MLUVIT');
  }
}

async function ask(text, spoken) {
  setStatus('Hermes přemýšlí…');
  setHudState('thinking');
  try {
    const data = await jsonFetch('/api/voice/ask', {
      text,
      targetAgentId: targetAgentId || undefined,
    });
    const reply = String(data?.reply || '').trim() || '(prázdná odpověď)';
    const who = data?.target?.name ? `HERMES → ${String(data.target.name).toUpperCase()}` : 'HERMES';
    appendMsg(who, reply, 'hermes');

    // Tell the orb who this turn touched, so the right circle lights.
    const lit = Array.isArray(data?.agents) ? data.agents : [];

    if (data?.task) {
      const t = data.task;
      const failed = Boolean(t.error);
      appendMsg(
        failed ? 'PŘEDÁNÍ SELHALO' : 'PŘEDÁNO',
        `${t.assigneeName || 'NOE'}: ${t.title || text}` +
          (t.id ? `  ·  issue ${String(t.id).slice(0, 8)}` : '') +
          (t.wakeError ? `  ·  agent se neprobudil: ${t.wakeError}` : '') +
          (t.error ? `  ·  chyba: ${t.error}` : ''),
        failed ? 'err' : 'task',
      );
      setHudState(failed ? 'error' : 'delegating', {
        agents: lit,
        action: failed ? 'chyba' : 'předáno',
      });
      loadDelegations();
    } else if (!lit.length) {
      setHudState('idle');
    }

    setStatus(data?.task ? `Předáno: ${data.task.assigneeName || 'NOE'}` : 'Hotovo');
    if (spoken) speak(reply, { agents: lit, delegated: Boolean(data?.task) });
    else if (data?.task) setHudState('idle');
  } catch (err) {
    appendMsg('CHYBA', `Hermes neodpověděl: ${err.message}`, 'err');
    setStatus(`Hermes neodpověděl: ${err.message}`, true);
    setHudState('error');
    if (autoListen && mode === 'voice') setTimeout(() => startRecording({ automatic: true }), 1800);
  }
}

async function speak(text, { agents: lit = [], delegated = false } = {}) {
  if (!$('voice-tts-toggle')?.checked) {
    setHudState(delegated ? 'delegating' : 'idle', { agents: lit });
    resumeListening();
    return;
  }
  setHudState('speaking', { agents: lit });
  setStatus('Mluvím…');
  const done = () => {
    setStatus('Připraveno');
    setHudState('idle');
    resumeListening();
  };
  try {
    const res = await fetch(`${BASE}/api/voice/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg, application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!type.includes('audio')) throw new Error('server nevrátil audio');
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      done();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      done();
    };
    await audio.play();
  } catch (err) {
    // fall back to the browser's own voice rather than going silent
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'cs-CZ';
      u.onend = done;
      u.onerror = done;
      speechSynthesis.speak(u);
    } catch {
      setStatus(`Hlas nešel přehrát: ${err.message}`, true);
      done();
    }
  }
}

/** Hands-free: once the reply has been spoken, open the mic again. */
function resumeListening() {
  if (!autoListen || mode !== 'voice' || busy) return;
  setTimeout(() => {
    if (!autoListen || mode !== 'voice' || busy || listening) return;
    startRecording({ automatic: true });
  }, 420);
}

/* ── wiring ───────────────────────────────────────────────── */

export function initVoice({ toast } = {}) {
  onToast = toast || onToast;

  document.querySelectorAll('.mode-key').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  const mic = $('voice-mic');
  mic?.addEventListener('click', () => {
    if (recorder && recorder.state === 'recording') stopRecording();
    else startRecording();
  });

  $('voice-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('voice-text');
    const text = String(input?.value || '').trim();
    if (!text || busy) return;
    input.value = '';
    appendMsg('TY', text, 'me');
    busy = true;
    await ask(text, true);
    busy = false;
  });

  $('voice-target')?.addEventListener('change', (e) => setTarget(e.target.value, { announce: true }));

  const autoBox = $('voice-autolisten');
  if (autoBox) {
    autoBox.checked = autoListen;
    autoBox.addEventListener('change', () => {
      autoListen = Boolean(autoBox.checked);
      try {
        localStorage.setItem(AUTOLISTEN_KEY, autoListen ? '1' : '0');
      } catch {
        /* private mode */
      }
      if (autoListen && mode === 'voice' && !listening && !busy) startRecording({ automatic: true });
      else if (!autoListen) setStatus('Poslech vypnut.');
    });
  }

  $('voice-delegations-refresh')?.addEventListener('click', loadDelegations);

  $('voice-open-apex')?.addEventListener('click', () => {
    window.open('/voice/', '_blank', 'noopener');
  });

  $('wa-start')?.addEventListener('click', startPairing);
  $('wa-stop')?.addEventListener('click', stopPairing);

  // The orb can hand its clicked agent back as the voice target, so picking a
  // circle around the orb and picking it in the list are the same gesture.
  window.addEventListener('message', (event) => {
    const data = event?.data;
    if (!data || typeof data !== 'object' || data.noedis !== 'target') return;
    const id = data.agentId ? String(data.agentId) : '';
    if (!id) return;
    if (!agents.some((a) => a.id === id)) return;
    setTarget(id, { announce: true });
  });

  // Restore the last mode, target and hands-free preference.
  let storedMode = 'text';
  let storedTarget = '';
  try {
    storedMode = localStorage.getItem(MODE_KEY) || 'text';
    storedTarget = localStorage.getItem(TARGET_KEY) || '';
    const storedAuto = localStorage.getItem(AUTOLISTEN_KEY);
    if (storedAuto !== null) autoListen = storedAuto !== '0';
  } catch {
    /* ignore */
  }
  targetAgentId = storedTarget;
  setMode(storedMode);
}

/** Called when the CHAT stop is opened — the stage needs a size to paint into. */
export function refreshVoice() {
  if (mode === 'voice') {
    refreshStatus();
    loadAgents();
    loadDelegations();
  }
}
