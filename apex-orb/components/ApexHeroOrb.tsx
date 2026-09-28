"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ApexOrb from "./ApexOrb";
import { skinFor, type OrbState } from "./noedis-skin";
import "./apex-orb.css";

// three/fiber must never SSR
const ApexCore3D = dynamic(() => import("./ApexCore3D"), { ssr: false });

// Stage matches the Apex app's on-screen proportions: the ring renders at its
// natural 900×520 and the particle canvas gets ~900px of height, so the awake
// ball (~166px) fills the R=155 ring exactly like in the app. The whole stage
// scales down to fit whatever container the hero gives it.
const STAGE_W = 900;
const STAGE_H = 900;

export type { OrbState };

export default function ApexHeroOrb({
  state: controlled,
  onStateChange,
  interactive = true,
}: {
  state?: OrbState;
  onStateChange?: (s: OrbState) => void;
  interactive?: boolean;
} = {}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [inner, setInner] = useState<OrbState>("idle");
  const state = controlled ?? inner;
  const [reducedMotion, setReducedMotion] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skin = skinFor(state);
  const update = (s: OrbState) => {
    setInner(s);
    onStateChange?.(s);
  };

  // Motion-sensitive users get the static ring without the particle sim.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      setScale(Math.min(1.6, el.clientWidth / 560, el.clientHeight / 540));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Tap 1 → the core surges. Tap 2 → voice mode. Tap 3 (or 8s) → back to idle.
  const boost = () => {
    const next: OrbState = state === "idle" ? "thinking" : state === "thinking" ? "speaking" : "idle";
    update(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update("idle"), 8000);
  };

  return (
    <div
      ref={boxRef}
      {...(interactive
        ? {
            onClick: boost,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                boost();
              }
            },
            onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
            role: "button",
            tabIndex: 0,
            "aria-label": "NOEDIS orb — klepnutím přepneš stav",
          }
        : { "aria-hidden": true as const })}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: interactive ? "pointer" : "default",
        pointerEvents: interactive ? "auto" : "none",
        borderRadius: "50%",
        userSelect: "none",
      }}
    >
      <div
        data-apex-stage
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          // The state's own light, so the stage never reads as neutral.
          filter: `drop-shadow(0 0 ${18 + skin.intensity * 26}px ${skin.glow}44)`,
          transition: "filter .8s ease",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: (STAGE_H - 520) / 2, pointerEvents: "none" }}>
          <ApexOrb state={skin.key} variant="frame" onRingClick={undefined} />
        </div>
        {!reducedMotion && (
          <ApexCore3D state={skin.key} variant="particles" contained onClick={undefined} />
        )}
      </div>
    </div>
  );
}
