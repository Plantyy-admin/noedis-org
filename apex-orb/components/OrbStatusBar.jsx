"use client";

/**
 * The cluster under the orb: equalizer, the state in Czech, and the agents the
 * current turn actually touches.
 *
 * Upstream this was a gold "STANDBY" label with an English hint about tapping
 * and scrolling. It is now the cockpit's read-out: the same three-stop state
 * gradient as the orb, and one chip per agent that the turn reached — coloured
 * with that agent's own node colour, so the row under the orb and the circles
 * around it say the same thing.
 */

import { skinFor, ND } from "./noedis-skin";

function Waveform({ active, cx, cy, width = 200, a, b, c }) {
  const barCount = 28;
  const barW = 3;
  const gap = (width - barCount * barW) / (barCount - 1);
  return (
    <g>
      {Array.from({ length: barCount }, (_, i) => {
        const x = cx - width / 2 + i * (barW + gap);
        const baseH = 3 + Math.abs(Math.sin(i * 0.6)) * 5;
        const activeH = 8 + Math.abs(Math.sin(i * 0.8)) * 26;
        const h = active ? activeH : baseH;
        const fill = i % 3 === 0 ? a : i % 3 === 1 ? b : c;
        return (
          <rect
            key={i}
            x={x}
            y={cy - h / 2}
            width={barW}
            height={h}
            rx={1.5}
            fill={fill}
            opacity={active ? 0.9 : 0.32}
            style={{
              transformOrigin: `${x + barW / 2}px ${cy}px`,
              animation: active
                ? `sbBar ${0.55 + (i % 5) * 0.16}s ease-in-out ${(i % 7) * 0.07}s infinite alternate`
                : "none",
            }}
          />
        );
      })}
    </g>
  );
}

export default function OrbStatusBar({ state = "idle", actions = [] }) {
  const skin = skinFor(state);
  const [C0, C1, C2] = skin.grad;
  const active = skin.key !== "idle";

  const W = 460;
  // Kept shallow: the equalizer row must sit clear of the department circles
  // that fan across the bottom of the constellation above it.
  const H = 122;
  const cx = W / 2;
  const cy = 44;

  const shown = (actions || []).slice(0, 6);

  return (
    <div
      style={{
        position: "absolute",
        // Bottom-LEFT, not bottom-centre. The cockpit draws its microphone
        // button in the middle of the strip under the orb, and two centred
        // read-outs — the equalizer and the mic's own status line — landed on
        // top of each other.
        left: 26,
        right: "auto",
        bottom: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        zIndex: 18,
        pointerEvents: "none",
      }}
    >
      <style>{`@keyframes sbBar { from { transform: scaleY(0.35); } to { transform: scaleY(1.15); } }
        @keyframes sbChipIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="sbLabel" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C0} />
            <stop offset="52%" stopColor={C1} />
            <stop offset="100%" stopColor={C2} />
          </linearGradient>
          <filter id="sbBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* extension lines */}
        <line x1={cx - 150} y1={cy} x2={cx - 28} y2={cy} stroke={C0} strokeWidth="1" opacity={active ? 0.5 : 0.18} strokeDasharray="4 3" />
        <line x1={cx + 28} y1={cy} x2={cx + 150} y2={cy} stroke={C2} strokeWidth="1" opacity={active ? 0.5 : 0.18} strokeDasharray="4 3" />

        {/* equalizer, painted with the state gradient */}
        <Waveform active={active} cx={cx} cy={cy} width={170} a={C0} b={C1} c={C2} />

        {/* centre ring + ball */}
        <circle cx={cx} cy={cy} r={20} stroke={C1} strokeWidth="1.5" strokeOpacity="0.75" fill={ND.void} filter="url(#sbBlur)" className="orb-center-ring" />
        <circle cx={cx} cy={cy} r={6} fill={skin.ball} opacity="0.95" className="orb-center" style={{ filter: `drop-shadow(0 0 10px ${C1})` }} />

        {/* the state, in Czech */}
        <text
          x={cx}
          y={cy + 44}
          textAnchor="middle"
          fill="url(#sbLabel)"
          fontSize="13"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.4em"
          opacity="0.9"
        >
          {skin.label}
        </text>

        {[0, 1, 2].map((i) => (
          <circle key={i} cx={cx + (i - 1) * 12} cy={cy + 62} r={2.5} fill={i === 1 ? C1 : i === 0 ? C0 : C2} className={`orb-dot-blink blink-${i}`} />
        ))}
      </svg>

      {/* Which agents this turn touched — the bottom half of "the circles show
          the action": same colours as the nodes around the orb. */}
      {shown.length > 0 && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-start", maxWidth: "min(560px, 62vw)" }}>
          {shown.map((a) => {
            const col = a.color || C1;
            return (
              <span
                key={a.key || a.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "4px 11px",
                  borderRadius: 999,
                  border: `1px solid ${col}55`,
                  background: `${col}14`,
                  color: col,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  animation: "sbChipIn .35s ease both",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: col, boxShadow: `0 0 8px ${col}` }} />
                {a.name}
                {a.kind ? <span style={{ color: ND.inkGhost, letterSpacing: "0.1em" }}>· {a.kind}</span> : null}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
