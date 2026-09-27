/* ══════════════════════════════════════════════════════════════
   VOICE panel — the CHAT | VOICE switcher and the Hermes voice loop

   One loop, five steps: record → transcribe → ask Hermes → show the
   reply → speak it. The APEX orb in the stage is driven from here by
   postMessage so it reflects what the loop is actually doing.

   The microphone is captured in the browser; everything else (STT, the
   agent, TTS) runs on the VPS behind /noedis/api/voice/*.
   ══════════════════════════════════════════════════════════════ */

import { esc } from './util.js';

const BASE = '/noedis';
const MODE_KEY = 'noedis.chatMode';
const APEX_STATE = { idle: 'idle', listening: 'listening', thinking: 'thinking', speaking: 'speaking' };

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

function setHudState(state) {
  const el = $('voice-hud-state');
  if (el) {
    el.dataset.state = state;
    el.textContent = state.toUpperCase();
  }
  const frame = $('apex-frame');
  try {
    frame?.contentWindow?.postMessage({ apex: state }, '*');
  } catch {
    /* the frame may not be up yet — the orb simply keeps its own state */
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
      mode === 'voice' ? 'Mluv s Hermesem — a ten to předá NOE' : 'Zadání práce agentovi v Paperclipu';
  }
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* private mode — not worth surfacing */
  }
  if (mode === 'voice') {
    loadApex();
    startStatusPolling();
  } else {
    stopStatusPolling();
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
      // Telegram is the live channel; it needs no scanning, so a
      // configured bot is a working bot.
      const n = Number(ch?.telegram?.authorisedUsers || 0);
      badge.dataset.state = 'ok';
      badge.textContent = 'HERMES · TG';
      badge.title = `model ${s.hermes.model || '?'} · Telegram, oprávněných uživatelů: ${n}`;
    } else if (waOn && !linked) {
      // Reachable but nobody has scanned the QR yet — say so rather than
      // looking healthy, because the WhatsApp half does not work until then.
      badge.dataset.state = 'warn';
      badge.textContent = 'PŘIPOJIT WA';
      badge.title = 'Hermes běží, ale WhatsApp ještě není spárovaný — otevři VOICE a naskenuj QR';
    } else if (!waOn) {
      badge.dataset.state = 'warn';
      badge.textContent = 'BEZ KANÁLU';
      badge.title = 'Hermes běží, ale není zapnutý žádný messenger — v Telegramu napiš @NOEDIS_bot';
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
  // WhatsApp is parked while Telegram is the channel; showing a "pair me"
  // card for a disabled platform would just be something to ignore.
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

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#63dda8';
  ctx.shadowColor = '#63dda8';
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

async function startRecording() {
  if (busy) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    setStatus('Mikrofon se nepodařilo otevřít — povol přístup.', true);
    onToast('Mikrofon zamítnut', 'error');
    setHudState('error');
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
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    releaseMic();
    if (blob.size < 1200) {
      setStatus('Nic jsem neslyšel, zkus to znovu.', true);
      setHudState('idle');
      setMicState('idle', 'MLUVIT');
      return;
    }
    transcribeAndAsk(blob);
  };

  recorder.start();
  setMicState('recording', 'STOP');
  setStatus('Mluv… klikni znovu pro konec');
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
}

/* ── the loop ─────────────────────────────────────────────── */

async function transcribeAndAsk(blob) {
  if (busy) return;
  busy = true;
  setMicState('busy', '…');
  setStatus('Přepisuji…');
  setHudState('thinking');
  try {
    const form = new Blob([blob], { type: blob.type || 'audio/webm' });
    const res = await fetch(`${BASE}/api/voice/transcribe`, {
      method: 'POST',
      body: form,
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
      setStatus('Přepis je prázdný, zkus to znovu.', true);
      setHudState('idle');
      return;
    }
    appendMsg('TY (hlas)', text, 'me');
    await ask(text, true);
  } catch (err) {
    setStatus(`Přepis selhal: ${err.message}`, true);
    appendMsg('CHYBA', `Přepis se nepovedl: ${err.message}`, 'err');
    setHudState('error');
  } finally {
    busy = false;
    setMicState('idle', 'MLUVIT');
  }
}

async function ask(text, spoken) {
  setStatus('Hermes přemýšlí…');
  setHudState('thinking');
  try {
    const data = await jsonFetch('/api/voice/ask', { text });
    const reply = String(data?.reply || '').trim() || '(prázdná odpověď)';
    appendMsg('HERMES', reply, 'hermes');
    if (data?.task) {
      appendMsg(
        'PŘEDÁNO',
        `Úkol pro NOE: ${data.task.title || text}` +
          (data.task.id ? `  ·  issue ${data.task.id}` : '') +
          (data.task.error ? `  ·  chyba: ${data.task.error}` : ''),
        data.task.error ? 'err' : 'task',
      );
    }
    setStatus('Hotovo');
    if (spoken) speak(reply);
    else setHudState('idle');
  } catch (err) {
    appendMsg('CHYBA', `Hermes neodpověděl: ${err.message}`, 'err');
    setStatus(`Hermes neodpověděl: ${err.message}`, true);
    setHudState('error');
  }
}

async function speak(text) {
  if (!$('voice-tts-toggle')?.checked) {
    setHudState('idle');
    return;
  }
  setHudState('speaking');
  setStatus('Mluvím…');
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
      setHudState('idle');
      setStatus('Připraveno');
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      setHudState('idle');
    };
    await audio.play();
  } catch (err) {
    // fall back to the browser's own voice rather than going silent
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'cs-CZ';
      u.onend = () => setHudState('idle');
      speechSynthesis.speak(u);
    } catch {
      setHudState('idle');
      setStatus(`Hlas nešel přehrát: ${err.message}`, true);
    }
  }
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

  $('voice-open-apex')?.addEventListener('click', () => {
    window.open('/voice/', '_blank', 'noopener');
  });

  $('wa-start')?.addEventListener('click', startPairing);
  $('wa-stop')?.addEventListener('click', stopPairing);

  // Remember the last mode so a reload lands where you left off.
  let stored = 'text';
  try {
    stored = localStorage.getItem(MODE_KEY) || 'text';
  } catch {
    /* ignore */
  }
  setMode(stored);
}

/** Called when the CHAT stop is opened — the stage needs a size to paint into. */
export function refreshVoice() {
  if (mode === 'voice') refreshStatus();
}
