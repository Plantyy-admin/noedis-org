/* ── API + live socket ─────────────────────────────────────── */

const BASE = '/noedis';

/** An expired session must not leave a half-drawn cockpit on screen.
 *  Only the cockpit's own gate counts — a Paperclip 401 that travelled
 *  through a passthrough route is an uplink problem, not a sign-out. */
function bounceToLogin(res) {
  if (res.status === 401 && res.headers.get('x-noedis-auth') === 'required') {
    location.replace('/noedis/login');
    return true;
  }
  return false;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (bounceToLogin(res)) throw new Error('unauthenticated');
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status} on ${path}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (bounceToLogin(res)) throw new Error('unauthenticated');
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status} on ${path}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => get('/health'),
  overview: () => get('/api/overview'),
  blueprint: () => get('/api/blueprint'),
  company: () => get('/api/company'),
  agents: () => get('/api/agents'),
  org: () => get('/api/org'),
  dashboard: () => get('/api/dashboard'),
  issues: (query = '') => get(`/api/issues${query}`),
  activity: (limit = 25) => get(`/api/activity?limit=${limit}`),
  inbox: () => get('/api/inbox'),
  clientConfig: () => get('/config'),

  createWork: (payload) => post('/api/work', payload),
  wake: (agentId) => post('/api/wake', { agentId }),
};

/**
 * Live socket. Emits Paperclip snapshot deltas pushed by the server, so the
 * UI does not have to poll every panel independently.
 */
export function connectLive({ onSnapshot, onUplink, onStatus } = {}) {
  let socket = null;
  let closedByUs = false;
  let retry = 0;

  function open() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      socket = new WebSocket(`${proto}//${location.host}/noedis/ws`);
    } catch {
      scheduleRetry();
      return;
    }

    socket.onopen = () => {
      retry = 0;
      onStatus?.({ connected: true });
    };

    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'snapshot') onSnapshot?.(msg.data);
      else if (msg.type === 'uplink') onUplink?.(msg.data);
      else if (msg.type === 'connected') onUplink?.(msg.data);
    };

    socket.onclose = () => {
      onStatus?.({ connected: false });
      if (!closedByUs) scheduleRetry();
    };

    socket.onerror = () => {
      onStatus?.({ connected: false });
    };
  }

  function scheduleRetry() {
    retry = Math.min(retry + 1, 6);
    setTimeout(open, 1000 * retry);
  }

  open();

  return {
    close() {
      closedByUs = true;
      socket?.close();
    },
  };
}
