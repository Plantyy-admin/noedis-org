/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — session auth

   A single-operator gate in front of the whole cockpit. The cookie is
   an HMAC-signed payload, so no session store is needed and a restart
   cannot resurrect a revoked token.

   Environment
     NOEDIS_AUTH_USER           login name; auth is OFF while unset
     NOEDIS_AUTH_PASS           plaintext password (compared in constant time)
     NOEDIS_AUTH_PASS_HASH      scrypt "salt:hash" alternative to the above
     NOEDIS_SESSION_SECRET      cookie signing key; generated per boot if unset
     NOEDIS_SESSION_HOURS       session lifetime, default 12

   With neither password form set the gate stays open on purpose: a
   half-configured deploy must never lock the operator out of the box.
   ══════════════════════════════════════════════════════════════ */

import crypto from 'node:crypto';
import { log } from './config.js';

const COOKIE = 'noedis_session';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

/* ── password hashing ───────────────────────────────────────── */

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `${salt}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  const want = Buffer.from(expected, 'hex');
  if (want.length !== actual.length) return false;
  return crypto.timingSafeEqual(want, actual);
}

const safeEqualText = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
};

/* ── the gate ───────────────────────────────────────────────── */

export function createAuth(cfg) {
  const user = (cfg.user || '').trim();
  const plain = cfg.pass || '';
  const hash = cfg.hash || '';
  const enabled = Boolean(user && (plain || hash));

  if (user && !plain && !hash) {
    log('AUTH: NOEDIS_AUTH_USER is set but no password/hash is — the cockpit stays OPEN.');
  }

  const secret = cfg.secret || crypto.randomBytes(32).toString('hex');
  if (enabled && !cfg.secret) {
    log('AUTH: no NOEDIS_SESSION_SECRET — sessions will not survive a restart.');
  }
  const sessionMs = Math.max(1, Number(cfg.sessionHours) || 12) * 3600 * 1000;

  /* The one route a local process may call without a session: Hermes hands a
     task to NOE from its skill script. A bearer token, not a cookie, because
     the caller is a script — and it opens exactly this path. */
  const bridgeToken = String(cfg.bridgeToken || '');
  const BRIDGE_PATH = '/noedis/api/voice/delegate';

  function bridgeAuthorised(req) {
    if (!bridgeToken) return false;
    const header = String(req.headers.authorization || '');
    if (!header.startsWith('Bearer ')) return false;
    const supplied = header.slice(7).trim();
    if (supplied.length !== bridgeToken.length) return false;
    return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(bridgeToken));
  }

  /* Failed sign-ins, keyed by client. 10 tries per 15 minutes, then a
     quarter-hour cool-down — the cockpit only ever has one operator. */
  const attempts = new Map();
  const WINDOW = 15 * 60 * 1000;
  const MAX_TRIES = 10;

  function throttled(ip) {
    const rec = attempts.get(ip);
    if (!rec) return 0;
    if (Date.now() - rec.first > WINDOW) {
      attempts.delete(ip);
      return 0;
    }
    if (rec.count < MAX_TRIES) return 0;
    return Math.ceil((WINDOW - (Date.now() - rec.first)) / 1000);
  }

  function noteFailure(ip) {
    const rec = attempts.get(ip);
    if (!rec || Date.now() - rec.first > WINDOW) attempts.set(ip, { first: Date.now(), count: 1 });
    else rec.count += 1;
  }

  const sign = (payload) =>
    crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  function issue() {
    const body = Buffer.from(
      JSON.stringify({ u: user, exp: Date.now() + sessionMs }),
    ).toString('base64url');
    return `${body}.${sign(body)}`;
  }

  function read(token) {
    if (!token || typeof token !== 'string') return null;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const body = token.slice(0, dot);
    const mac = token.slice(dot + 1);
    const expected = sign(body);
    if (mac.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    try {
      const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (!data?.exp || Date.now() > data.exp) return null;
      if (data.u !== user) return null;
      return data;
    } catch {
      return null;
    }
  }

  const cookies = (req) => {
    const raw = req.headers.cookie;
    if (!raw) return {};
    const out = {};
    for (const part of raw.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
    }
    return out;
  };

  const isSecure = (req) =>
    req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

  function setCookie(res, req, value, maxAgeSec) {
    const bits = [
      `${COOKIE}=${encodeURIComponent(value)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAgeSec}`,
    ];
    if (isSecure(req)) bits.push('Secure');
    res.append('Set-Cookie', bits.join('; '));
  }

  const clearCookie = (req, res) => setCookie(res, req, '', 0);

  /** True when the request carries a valid, unexpired session. */
  function isAuthed(req) {
    if (!enabled) return true;
    return Boolean(read(cookies(req)[COOKIE]));
  }

  /** Constant-time credential check that does not leak which half failed. */
  function checkCredentials(name, password) {
    if (!enabled) return true;
    const userOk = safeEqualText(name || '', user);
    const passOk = hash ? verifyPassword(password || '', hash) : safeEqualText(password || '', plain);
    return userOk && passOk;
  }

  /* ── request gate ─────────────────────────────────────────
     `/noedis/login`, `/noedis/logout` and `/noedis/health` stay open.
     API and socket paths answer 401 JSON; page paths redirect. */
  const OPEN = [/^\/noedis\/login\/?$/, /^\/noedis\/logout\/?$/, /^\/noedis\/health\/?$/];

  function middleware(req, res, next) {
    if (!enabled) return next();

    const path = req.path || '/';
    if (OPEN.some((re) => re.test(path))) return next();
    if (path === BRIDGE_PATH && bridgeAuthorised(req)) return next();
    if (isAuthed(req)) return next();

    const wantsJson =
      path.startsWith('/noedis/api/') ||
      path === '/noedis/config' ||
      path === '/noedis/ws' ||
      String(req.headers.accept || '').includes('application/json');

    if (wantsJson) {
      // The header is what tells the cockpit apart from a Paperclip 401 that
      // travelled through a passthrough route: only this one means "signed out".
      res.set('X-Noedis-Auth', 'required');
      return res.status(401).json({ error: 'unauthenticated', login: '/noedis/login' });
    }
    res.set('X-Noedis-Auth', 'required');
    const next_ = encodeURIComponent(req.originalUrl || '/');
    return res.redirect(302, `/noedis/login?next=${next_}`);
  }

  return {
    enabled,
    middleware,
    issue: (req, res) => setCookie(res, req, issue(), Math.floor(sessionMs / 1000)),
    clear: clearCookie,
    isAuthed,
    checkCredentials,
    throttled,
    noteFailure,
    resetFailures: (ip) => attempts.delete(ip),
    /** `?next=` is only honoured for same-site absolute paths. */
    safeNext(value) {
      const raw = String(value || '');
      if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
      if (raw.startsWith('/noedis/login') || raw.startsWith('/noedis/logout')) return '/';
      return raw;
    },
  };
}
