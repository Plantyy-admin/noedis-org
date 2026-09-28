"use client";

/**
 * The orb's ring frame — the SVG half of the core.
 *
 * Upstream this was hard-coded gold (#f5a623). Every colour now comes from
 * the NOEDIS skin for the current state, so the ring, the sound waves and the
 * centre cluster carry the same gradient as the particle core and the status
 * bar: orange-to-red while the founder speaks, silver-white-green while the
 * company thinks, blue-to-violet while the orb answers.
 */

import { useId } from "react";
import { skinFor, rgba } from "./noedis-skin";

function Waveform({ active, cx, cy, width = 220, color, bright }) {
  const barCount = 28;
  const barW = 3;
  const gap = (width - barCount * barW) / (barCount - 1);
  return (
    <g>
      {Array.from({ length: barCount }, (_, i) => {
        const x = cx - width / 2 + i * (barW + gap);
        const baseH = 3 + Math.abs(Math.sin(i * 0.6)) * 5;
        const activeH = 8 + Math.abs(Math.sin(i * 0.8)) * 28;
        return (
          <rect
            key={i}
            x={x}
            y={cy - (active ? activeH : baseH) / 2}
            width={barW}
            height={active ? activeH : baseH}
            rx={1.5}
            fill={i % 5 === 0 ? bright : color}
            opacity={active ? 0.85 : 0.25}
            className={`wavebar wavebar-${i % 7}`}
          />
        );
      })}
    </g>
  );
}

/** Always-on sound wave rings — subtle idle, bright active. */
function SoundWaves({ cx, cy, R, active, color }) {
  return (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={R}
          stroke={color}
          strokeWidth={active ? 1.5 : 0.8}
          fill="none"
          opacity={active ? 0.55 : 0.18}
          className={`sound-wave wave-${i}`}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
    </g>
  );
}

export default function ApexOrb({ state = "idle", onRingClick, variant }) {
  const uid = useId().replace(/:/g, "");
  const frameOnly = variant === "frame";
  const skin = skinFor(state);
  const [C0, C1, C2] = skin.grad;

  const W = 900;
  const H = 520;
  const cx = W / 2;
  const cy = frameOnly ? H / 2 : H / 2 - 20;
  const R = 155;
  const OUTER = [178, 194, 212, 230, 250];

  const isActive = skin.key !== "idle";
  const isListening = skin.key === "listening";
  const isSpeaking = skin.key === "speaking";
  const isThinking = skin.key === "thinking";
  const isDelegating = skin.key === "delegating";
  const label = skin.label;

  const ringGrad = `ndRing-${uid}`;
  const ambGrad = `ndAmb-${uid}`;
  const ringBlur = `ndRingBlur-${uid}`;
  const dotF = `ndDotF-${uid}`;
  const txtF = `ndTxtF-${uid}`;
  const gndF = `ndGndF-${uid}`;

  return (
    <div className="apex-orb-wrap" data-state={skin.key} style={{ width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        <defs>
          {/* The state gradient: this is what makes the ring read as
              orange→red / silver→green / blue→violet rather than one flat hue. */}
          <linearGradient id={ringGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={C0} stopOpacity="0.95" />
            <stop offset="52%" stopColor={C1} stopOpacity="1" />
            <stop offset="100%" stopColor={C2} stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id={ambGrad} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C0} stopOpacity="0.22" />
            <stop offset="50%" stopColor={C1} stopOpacity="0.14" />
            <stop offset="100%" stopColor={C2} stopOpacity="0.22" />
          </linearGradient>

          <radialGradient id={`${ringGrad}-fill`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C0} stopOpacity="0" />
            <stop offset="70%" stopColor={C1} stopOpacity="0.04" />
            <stop offset="88%" stopColor={C2} stopOpacity="0.18" />
            <stop offset="100%" stopColor={C1} stopOpacity="0.5" />
          </radialGradient>

          <radialGradient id={`${ambGrad}-bg`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C1} stopOpacity="0.08" />
            <stop offset="100%" stopColor={C1} stopOpacity="0" />
          </radialGradient>

          <filter id={ringBlur} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={dotF} x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id={txtF} x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={gndF} x="-100%" y="-400%" width="300%" height="800%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
        </defs>

        {/* ambient backdrop — always breathes, tinted by the state */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={R + 130}
          ry={R + 90}
          fill={`url(#${ambGrad}-bg)`}
          className="orb-ambient"
        />

        {/* outer thin rings */}
        {OUTER.map((r, i) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={r}
            stroke={i % 2 ? C2 : C0}
            strokeWidth={i === 0 ? 0.8 : 0.4}
            strokeOpacity={0.16 - i * 0.02}
            fill="none"
            strokeDasharray={i % 2 ? "3 7" : "none"}
          />
        ))}

        {/* crosshair ticks */}
        <line x1={cx} y1={cy - OUTER[4] - 10} x2={cx} y2={cy - OUTER[4] + 10} stroke={C1} strokeWidth="1" opacity="0.3" />
        <line x1={cx} y1={cy + OUTER[4] - 10} x2={cx} y2={cy + OUTER[4] + 10} stroke={C1} strokeWidth="1" opacity="0.3" />

        {/* Sound waves — listening gets extra-bright rings */}
        <SoundWaves cx={cx} cy={cy} R={R} active={isActive || isListening} color={C1} />

        {/* thinking / delegating dashed orbit */}
        {(isThinking || isDelegating) && (
          <circle
            cx={cx}
            cy={cy}
            r={R + 22}
            stroke={isDelegating ? C0 : C2}
            strokeWidth="1"
            strokeOpacity="0.45"
            strokeDasharray="8 14"
            fill="none"
            className="orb-orbit-cw"
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        )}

        {/* main ring fill glow */}
        <circle cx={cx} cy={cy} r={R} fill={`url(#${ringGrad}-fill)`} className="orb-ring-breathe" />

        {/* main ring glow layers, painted with the state gradient */}
        <circle cx={cx} cy={cy} r={R} stroke={`url(#${ringGrad})`} strokeWidth="18" strokeOpacity="0.1" fill="none" filter={`url(#${ringBlur})`} className="orb-ring-glow" />
        <circle cx={cx} cy={cy} r={R} stroke={`url(#${ringGrad})`} strokeWidth="6" strokeOpacity="0.45" fill="none" filter={`url(#${ringBlur})`} />
        {/* bright line — always rotates slowly */}
        <circle cx={cx} cy={cy} r={R} stroke={`url(#${ringGrad})`} strokeWidth="2.5" strokeOpacity="0.95" fill="none" className="orb-ring-bright" />

        {/* inner swirl — visible in idle too, slower */}
        <circle cx={cx} cy={cy} r={R * 0.58} stroke={C2} strokeWidth="1.5" strokeOpacity={isActive ? 0.45 : 0.15} fill="none" strokeDasharray="55 25" className="orb-orbit-cw" style={{ transformOrigin: `${cx}px ${cy}px` }} />
        <circle cx={cx} cy={cy} r={R * 0.35} stroke={C0} strokeWidth="1" strokeOpacity={isActive ? 0.3 : 0.1} fill="none" strokeDasharray="28 18" className="orb-orbit-ccw" style={{ transformOrigin: `${cx}px ${cy}px` }} />

        {/* CENTER CLUSTER — equalizer + core ball + ring + label (hidden in frame mode) */}
        {!frameOnly && (
          <g>
            <line x1={cx - R - 90} y1={cy} x2={cx - R + 15} y2={cy} stroke={C1} strokeWidth="1" opacity={isActive ? 0.55 : 0.15} strokeDasharray="4 3" />
            <line x1={cx + R - 15} y1={cy} x2={cx + R + 90} y2={cy} stroke={C1} strokeWidth="1" opacity={isActive ? 0.55 : 0.15} strokeDasharray="4 3" />

            <Waveform active={isActive} cx={cx} cy={cy} width={200} color={C0} bright={C1} />

            <circle cx={cx} cy={cy} r={20} stroke={C1} strokeWidth="1.5" strokeOpacity="0.7" fill="#03060f" filter={`url(#${ringBlur})`} className="orb-center-ring" />
            <circle cx={cx} cy={cy} r={6} fill={skin.ball} opacity="0.95" className="orb-center" style={{ filter: `drop-shadow(0 0 10px ${C1})` }} />

            <text x={cx} y={cy + R * 0.52} textAnchor="middle" fill={C1} fontSize="12" fontFamily="'JetBrains Mono',monospace" fontWeight="400" letterSpacing="0.28em" opacity="0.7" filter={`url(#${txtF})`}>
              {label}
            </text>

            {[0, 1, 2].map((i) => (
              <circle key={i} cx={cx + (i - 1) * 12} cy={cy + R * 0.52 + 18} r={2.5} fill={C2} className={`orb-dot-blink blink-${i}`} />
            ))}
          </g>
        )}

        {/* Invisible clickable zone over the ring — only this triggers onRingClick */}
        {onRingClick && (
          <circle cx={cx} cy={cy} r={R + 20} fill="transparent" style={{ cursor: "pointer", pointerEvents: "all" }} onClick={onRingClick} />
        )}

        {/* ground glow — only in the full orb, not the floating frame */}
        {!frameOnly && (
          <g>
            <ellipse cx={cx} cy={H - 8} rx={70} ry={10} fill={C1} opacity={isActive ? 0.3 : 0.12} filter={`url(#${gndF})`} className="orb-ambient" />
            <line x1={cx} y1={cy + R + 6} x2={cx} y2={H - 10} stroke={C1} strokeWidth="1" opacity={isActive ? 0.28 : 0.1} strokeDasharray="3 5" />
            {[35, 60, 85].map((rx, i) => (
              <ellipse key={i} cx={cx} cy={H - 14} rx={rx} ry={rx * 0.16} stroke={C2} strokeWidth="0.5" strokeOpacity={0.14 - i * 0.03} fill="none" />
            ))}
          </g>
        )}
      </svg>

      {/* A soft state tint over the whole frame so the ring's colour is felt
          even at the edges of the stage. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(circle at 50% 50%, ${rgba(C1, 0.05 * (1 + skin.intensity))} 0%, transparent 62%)`,
          transition: "background .8s ease",
        }}
      />
    </div>
  );
}
