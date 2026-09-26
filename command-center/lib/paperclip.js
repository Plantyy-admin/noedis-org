/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — Paperclip API client
   Server-side only. The board API key never reaches the browser.
   ══════════════════════════════════════════════════════════════ */

const DEFAULT_TIMEOUT_MS = 15000;

export class PaperclipError extends Error {
  constructor(message, { status = 0, path = '', body = null } = {}) {
    super(message);
    this.name = 'PaperclipError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export class PaperclipClient {
  /**
   * @param {{ baseUrl: string, apiKey: string, companyId: string, timeoutMs?: number }} opts
   */
  constructor({ baseUrl, apiKey, companyId, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.apiKey = apiKey || '';
    this.companyId = companyId || '';
    this.timeoutMs = timeoutMs;
    /** Last observed reachability, for the UI uplink indicator. */
    this.lastOk = null;
    this.lastError = null;
    this.lastCheckedAt = null;
  }

  get configured() {
    return Boolean(this.baseUrl && this.apiKey && this.companyId);
  }

  /**
   * Perform an authenticated request against Paperclip.
   * Always resolves with a plain object; throws PaperclipError on failure.
   */
  async request(pathname, { method = 'GET', body, headers = {}, timeoutMs } = {}) {
    if (!this.configured) {
      throw new PaperclipError('Paperclip client is not configured', { path: pathname });
    }

    const url = `${this.baseUrl}${pathname}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);

    const init = {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        ...headers,
      },
    };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let parsed = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text.slice(0, 2000) };
        }
      }

      if (!res.ok) {
        const detail =
          (parsed && (parsed.error || parsed.message)) || `HTTP ${res.status}`;
        this.lastOk = false;
        this.lastError = `${res.status} ${detail}`;
        this.lastCheckedAt = new Date().toISOString();
        throw new PaperclipError(`Paperclip ${method} ${pathname} failed: ${detail}`, {
          status: res.status,
          path: pathname,
          body: parsed,
        });
      }

      this.lastOk = true;
      this.lastError = null;
      this.lastCheckedAt = new Date().toISOString();
      return parsed;
    } catch (err) {
      if (err instanceof PaperclipError) throw err;
      const aborted = err?.name === 'AbortError';
      const message = aborted
        ? `Paperclip request timed out after ${timeoutMs ?? this.timeoutMs}ms`
        : `Paperclip unreachable: ${err?.message || err}`;
      this.lastOk = false;
      this.lastError = message;
      this.lastCheckedAt = new Date().toISOString();
      throw new PaperclipError(message, { path: pathname });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Company-scoped helper. */
  company(pathname, opts) {
    return this.request(`/api/companies/${this.companyId}${pathname}`, opts);
  }

  health() {
    return this.request('/api/health', { timeoutMs: 5000 });
  }

  company_() {
    return this.company('');
  }

  dashboard() {
    return this.company('/dashboard');
  }

  agents() {
    return this.company('/agents');
  }

  org() {
    return this.company('/org');
  }

  issues(query = {}) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ).toString();
    return this.company(`/issues${qs ? `?${qs}` : ''}`);
  }

  activity(limit = 25) {
    return this.company(`/activity?limit=${encodeURIComponent(limit)}`);
  }

  approvals() {
    return this.company('/approvals');
  }

  projects() {
    return this.company('/projects');
  }

  goals() {
    return this.company('/goals');
  }

  heartbeatRuns(limit = 25) {
    return this.company(`/heartbeat-runs?limit=${encodeURIComponent(limit)}`);
  }

  /** Work intake — create an issue assigned to an agent. */
  createWork({ title, description, assigneeAgentId, priority = 'medium', status = 'todo', parentId }) {
    return this.company('/issues', {
      method: 'POST',
      body: {
        title,
        description,
        assigneeAgentId: assigneeAgentId || null,
        priority,
        status,
        ...(parentId ? { parentId } : {}),
      },
    });
  }

  /** Wake an agent so it picks up assigned work. */
  wake(agentId) {
    return this.request(`/api/agents/${agentId}/wakeup`, {
      method: 'POST',
      body: {},
    });
  }

  /** Board-level inbox for the company. */
  async inbox() {
    // The company inbox is composed of issues needing board attention plus
    // pending approvals; both are already-exposed board surfaces.
    const [issues, approvals] = await Promise.allSettled([
      this.issues({ limit: 50 }),
      this.approvals(),
    ]);
    return {
      issues: issues.status === 'fulfilled' ? issues.value : [],
      approvals: approvals.status === 'fulfilled' ? approvals.value : [],
      issuesError: issues.status === 'rejected' ? issues.reason?.message : null,
      approvalsError: approvals.status === 'rejected' ? approvals.reason?.message : null,
    };
  }

  status() {
    return {
      configured: this.configured,
      baseUrl: this.baseUrl,
      companyId: this.companyId,
      reachable: this.lastOk,
      lastError: this.lastError,
      lastCheckedAt: this.lastCheckedAt,
    };
  }
}
