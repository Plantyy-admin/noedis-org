"use client";

/**
 * The NOEDIS world: the orb at the centre, the company around it.
 *
 * Three inputs drive everything on this screen, and they all come from the
 * cockpit's VOICE panel over postMessage:
 *
 *   { apex: "listening" }                        the founder is speaking
 *   { apex: "thinking", agents: ["cody"] }       work is being routed
 *   { apex: "speaking" }                         the orb is answering
 *
 * `agents` may hold node keys (cody, dept0…), Paperclip agent ids, department
 * names or agent names — they all resolve to a circle, which then lights and
 * appears as a chip under the orb. So the picture on screen is the picture of
 * what the company is actually doing, not a decorative animation.
 *
 * Clicking a circle opens that agent's card and can hand it to the voice panel
 * as the next target.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ApexHeroOrb from "./ApexHeroOrb";
import ReasoningWebJs from "./ReasoningWeb";
import ShaderBackgroundJs from "./ShaderBackground";
import OrbStatusBarJs from "./OrbStatusBar";
import { ND, skinFor, type OrbState } from "./noedis-skin";
import {
  buildConstellation,
  fetchOrg,
  toRoster,
  nodeKeyFor,
  FALLBACK_ORG,
  type ConstellationNode,
  type OrgAgent,
  type OrbAction,
} from "./noedis-org";

const ReasoningWeb = ReasoningWebJs as unknown as React.ComponentType<{
  state?: string;
  trace?: unknown;
  mode?: string;
  coreless?: boolean;
  onSelect?: (n: NodeSel) => void;
  light?: boolean;
  roster?: unknown;
}>;

const ShaderBackground = ShaderBackgroundJs as unknown as React.ComponentType<{
  opacity?: number;
  voiceActive?: boolean;
  gold?: boolean;
}>;

// The .jsx copy defaults `actions` to [], which TS infers as never[]; the cast
// states the real contract instead of widening the prop to any.
const OrbStatusBar = OrbStatusBarJs as unknown as React.ComponentType<{
  state?: string;
  actions?: OrbAction[];
}>;

export type NodeSel = { name: string; key: string; color: string };

/** Board status, in the cockpit's language. */
const STATUS_CS: Record<string, { text: string; color: string }> = {
  running: { text: "Pracuje", color: ND.green },
  working: { text: "Pracuje", color: ND.green },
  idle: { text: "Připraven", color: ND.cyan },
  standby: { text: "V pohotovosti", color: ND.silver },
  paused: { text: "Pozastaven", color: ND.amber },
  error: { text: "Chyba", color: ND.magenta },
  unassigned: { text: "Neobsazeno", color: ND.inkGhost },
};

const statusOf = (s: string) => STATUS_CS[s] || { text: s || "—", color: ND.inkMute };

/* ── Agent card — the window a clicked circle opens ─────────────── */
function AgentCard({
  node,
  onClose,
  onTarget,
}: {
  node: ConstellationNode;
  onClose: () => void;
  onTarget: (n: ConstellationNode) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const c = node.color;
  const status = statusOf(node.status);

  useEffect(() => {
    setPos({
      x: Math.max(8, window.innerWidth / 2 - 170),
      y: Math.max(90, window.innerHeight * 0.16),
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!pos) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [pos]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!pos) return;
    dragRef.current = { sx: e.clientX - pos.x, sy: e.clientY - pos.y };
    const move = (ev: MouseEvent) => {
      if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.sx, y: ev.clientY - dragRef.current.sy });
    };
    const up = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  if (!pos) return null;

  const rows: [string, string][] = [
    ["Útvar", node.department || "—"],
    ["Role", node.title || "—"],
    ["Stav", status.text],
    ["Nadřízený", node.reportsToName || (node.layer === "lead" ? "FOUNDER" : "—")],
    ["ID", node.agentId ? `${node.agentId.slice(0, 8)}…` : "—"],
  ];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${node.fullName} — karta agenta`}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: "min(360px, 92vw)",
        zIndex: 60,
        background: "rgba(5,11,24,0.94)",
        backdropFilter: "blur(24px)",
        border: `1px solid ${c}44`,
        borderRadius: 16,
        boxShadow: `0 0 40px ${c}18, 0 8px 32px rgba(0,0,0,0.6)`,
        overflow: "hidden",
      }}
    >
      <div
        onMouseDown={onMouseDown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px",
          borderBottom: `1px solid ${c}22`,
          cursor: "grab",
          userSelect: "none",
          background: `linear-gradient(135deg, ${c}0a 0%, transparent 100%)`,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: `${c}14`,
            border: `1px solid ${c}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 10px ${c}` }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: c }}>
            {node.fullName.toUpperCase()}
          </div>
          <div style={{ fontSize: 10, color: "rgba(238,245,255,0.4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {node.title || "Agent"}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Zavřít"
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: "rgba(238,245,255,0.35)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: "6px 8px",
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", color: ND.inkGhost, textTransform: "uppercase" }}>
                {k}
              </span>
              <span style={{ fontSize: 11.5, color: ND.inkDim, textAlign: "right" }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, borderTop: `1px solid ${c}1a`, paddingTop: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: status.color, boxShadow: `0 0 8px ${status.color}` }} />
          <span style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "rgba(238,245,255,0.5)", textTransform: "uppercase" }}>
            {status.text}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onTarget(node)}
            disabled={!node.agentId}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 999,
              border: `1px solid ${c}66`,
              background: `${c}1a`,
              color: c,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: node.agentId ? "pointer" : "not-allowed",
              opacity: node.agentId ? 1 : 0.4,
            }}
          >
            Mluvit s tímto
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── The world ─────────────────────────────────────────────────── */
export default function ApexWorld() {
  const [selected, setSelected] = useState<ConstellationNode | null>(null);
  const [reduced, setReduced] = useState(false);
  const [agents, setAgents] = useState<OrgAgent[]>(FALLBACK_ORG);
  const [actions, setActions] = useState<OrbAction[]>([]);

  const [state, setState] = useState<OrbState>("idle");
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trace, setTrace] = useState<{ n: number; trace: { helper: string }[] } | null>(null);
  const traceN = useRef(0);

  const nodes = useMemo(() => buildConstellation(agents), [agents]);
  const roster = useMemo(() => toRoster(nodes), [nodes]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  /* Live company from the cockpit. A failure keeps the baked-in fallback, so
     the sky is never empty — it just stops being live. */
  useEffect(() => {
    const ac = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = () =>
      fetchOrg(ac.signal)
        .then((d) => setAgents(d.agents))
        .catch(() => {
          /* keep the fallback */
        });
    load();
    timer = setInterval(load, 60000);
    return () => {
      ac.abort();
      if (timer) clearInterval(timer);
    };
  }, []);

  const clearTimer = () => {
    if (stateTimer.current) clearTimeout(stateTimer.current);
    stateTimer.current = null;
  };

  /* The cockpit's voice loop drives everything. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;

      if (typeof data.apex === "string") {
        const next = data.apex.toLowerCase();
        clearTimer();
        setState(next as OrbState);
        // A terminal state lingers briefly, then the orb goes back to calm.
        if (next === "idle" || next === "error") {
          stateTimer.current = setTimeout(() => setState("idle"), next === "error" ? 4000 : 0);
        }
      }

      if (Array.isArray(data.agents) && data.agents.length) {
        const keys: string[] = [];
        const chips: OrbAction[] = [];
        for (const raw of data.agents) {
          const handle = typeof raw === "string" ? raw : raw?.key || raw?.id || raw?.name;
          if (!handle) continue;
          const key = nodeKeyFor(nodesRef.current, String(handle));
          if (!key) continue;
          keys.push(key);
          const node = nodesRef.current.find((n) => n.key === key);
          if (node && !chips.some((c) => c.key === key)) {
            chips.push({
              key,
              name: node.name,
              color: node.color,
              kind: typeof raw === "object" && raw?.kind ? String(raw.kind) : data.action ? String(data.action) : undefined,
            });
          }
        }
        if (keys.length) {
          traceN.current += 1;
          setTrace({ n: traceN.current, trace: keys.map((helper) => ({ helper })) });
          setActions(chips);
        }
      } else if (data.clearActions) {
        setActions([]);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const openAgent = useCallback((n: NodeSel) => {
    const node = nodesRef.current.find((x) => x.key === n.key);
    if (node) setSelected(node);
  }, []);

  /** Hand the picked agent to the cockpit, which uses it as the voice target. */
  const makeTarget = useCallback((n: ConstellationNode) => {
    try {
      window.parent?.postMessage(
        { noedis: "target", agentId: n.agentId, name: n.fullName, key: n.key },
        "*",
      );
    } catch {
      /* standalone (opened in its own tab) — nothing to tell */
    }
    setSelected(null);
  }, []);

  // orb state → the web's activity level
  const webState =
    state === "thinking" || state === "delegating"
      ? "processing"
      : state === "speaking"
        ? "speaking"
        : state === "listening"
          ? "listening"
          : "standby";

  const skin = skinFor(state);
  const [G0, G1, G2] = skin.grad;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", userSelect: "none" }}>
      {/* Backdrop — the cockpit's own night glass, tinted by the state so the
          whole frame answers to who is talking. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 95% 88% at 50% 42%, ${ND.deep} 0%, ${ND.abyss} 44%, ${ND.void} 100%)`,
        }}
      />

      {/* background waves */}
      {!reduced && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <ShaderBackground opacity={0.12} voiceActive={state === "speaking"} gold={false} />
        </div>
      )}

      {/* state light-cast — only ever lifts the navy, never darkens it */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          mixBlendMode: "screen",
          background:
            state === "listening"
              ? `radial-gradient(circle at 50% 42%, ${G1}${state === "listening" ? "4d" : "2e"} 0%, ${G0}14 30%, transparent 62%)`
              : `radial-gradient(circle at 50% 42%, ${G1}${state === "speaking" ? "4d" : "2b"} 0%, ${G2}12 30%, transparent 62%)`,
          transition: "background 0.8s ease",
        }}
      />

      {/* the reasoning web — below the orb, exactly as upstream */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
        <ReasoningWeb
          state={webState}
          mode="full"
          coreless
          roster={roster}
          trace={trace}
          onSelect={(n: NodeSel) => openAgent(n)}
        />
      </div>

      {/* Keyboard and screen-reader equivalent of the graph. */}
      <nav className="visually-hidden" aria-label="NOEDIS agenti">
        <ul>
          {nodes.map((a) => (
            <li key={a.key}>
              <button type="button" onClick={() => setSelected(a)}>
                {a.fullName} — {a.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* the core */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "min(560px, 58vw)",
          height: "min(500px, 56vw, 70vh)",
          transform: "translate(-50%, -50%)",
          zIndex: 3,
          pointerEvents: "none",
        }}
      >
        <ApexHeroOrb state={state} interactive={false} />
      </div>

      {/* central tap disc — a tap nudges the orb's own demo cycle */}
      <div
        role="button"
        tabIndex={0}
        aria-label="NOEDIS orb — klepnutím přepneš stav"
        onClick={() => {
          clearTimer();
          setState((s) => (s === "idle" ? "thinking" : s === "thinking" ? "speaking" : "idle"));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            clearTimer();
            setState((s) => (s === "idle" ? "thinking" : s === "thinking" ? "speaking" : "idle"));
          }
        }}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(340px, 36vw)",
          height: "min(340px, 36vw)",
          borderRadius: "50%",
          zIndex: 4,
          cursor: "pointer",
          background: "transparent",
          border: "none",
          userSelect: "none",
        }}
      />

      <OrbStatusBar state={state} actions={actions} />

      {selected && <AgentCard node={selected} onClose={() => setSelected(null)} onTarget={makeTarget} />}
    </div>
  );
}
