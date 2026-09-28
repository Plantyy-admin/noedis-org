/* ══════════════════════════════════════════════════════════════
   NOEDIS skin for the APEX orb.

   The orb ships from upstream wearing gold (#f5a623). The cockpit wears
   the NOEDIS instrument palette, so the orb is re-tinted from the same
   tokens — the source of truth is `command-center/public/css/style.css`
   §00 · TOKENS. Keep the two in step: a colour that is not in that block
   does not belong here.

   Every state carries a three-stop gradient, not a single hue, because
   the founder asked for gradients: the orb reads as a living thing that
   changes colour with what the conversation is doing.

     idle        cyan → violet, dimmed        nothing happening
     listening   amber → orange → magenta     the founder is speaking
     thinking    silver → white → green       Hermes/agents are working
     speaking    blue → cyan → violet         the orb is answering
     delegating  gold → amber → orange        a task is being handed over
     error       magenta                      something broke
   ══════════════════════════════════════════════════════════════ */

export const ND = {
  void: "#03060f",
  abyss: "#050b18",
  deep: "#071026",
  panel: "#0a1225",
  panel2: "#0d1a31",

  framework: "#4aa8ff",
  system: "#b07cff",
  product: "#ffd23f",
  cyan: "#7fe9ff",
  magenta: "#dd397b",
  green: "#63dda8",
  orange: "#ff8737",
  silver: "#c8d6ea",
  amber: "#ffb05c",
  red: "#ff4d3d",

  ink: "#eef5ff",
  inkDim: "#a9bad6",
  inkMute: "#8b9dba",
  inkGhost: "#55688a",
} as const;

/** Every state the orb can be in. `listening` used to be folded into
 *  `thinking`; it now has its own colour, which is the whole point of the
 *  orange-to-red gradient. */
export type OrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "delegating"
  | "error";

export type Skin = {
  key: OrbState;
  /** Czech, uppercase — the status bar is part of the cockpit, not the demo. */
  label: string;
  /** Three-stop gradient: [from, mid, to]. */
  grad: [string, string, string];
  /** Primary stroke for the main ring. */
  line: string;
  /** Orbiting nodes and dots. */
  node: string;
  /** The bright centre. */
  ball: string;
  /** Haze, bloom and light-cast tint. */
  glow: string;
  /** How strongly the state lights the backdrop, 0–1. */
  intensity: number;
};

const SKINS: Record<OrbState, Skin> = {
  idle: {
    key: "idle",
    label: "POHOTOVOST",
    grad: [ND.framework, ND.cyan, ND.system],
    line: ND.framework,
    node: ND.cyan,
    ball: "#dff4ff",
    glow: ND.framework,
    intensity: 0.34,
  },
  listening: {
    key: "listening",
    label: "POSLOUCHÁM",
    grad: [ND.amber, ND.orange, ND.magenta],
    line: ND.orange,
    node: ND.amber,
    ball: "#ffe3c2",
    glow: ND.orange,
    intensity: 0.72,
  },
  thinking: {
    key: "thinking",
    label: "PŘEMÝŠLÍM",
    grad: [ND.silver, "#ffffff", ND.green],
    line: ND.green,
    node: ND.silver,
    ball: "#ffffff",
    glow: ND.green,
    intensity: 0.66,
  },
  speaking: {
    key: "speaking",
    label: "MLUVÍM",
    grad: [ND.framework, ND.cyan, ND.system],
    line: ND.system,
    node: ND.cyan,
    ball: "#eaf6ff",
    glow: ND.system,
    intensity: 0.8,
  },
  delegating: {
    key: "delegating",
    label: "PŘEDÁVÁM",
    grad: [ND.product, ND.amber, ND.orange],
    line: ND.product,
    node: ND.amber,
    ball: "#fff3cf",
    glow: ND.product,
    intensity: 0.74,
  },
  error: {
    key: "error",
    label: "CHYBA",
    grad: [ND.magenta, ND.red, ND.magenta],
    line: ND.magenta,
    node: ND.red,
    ball: "#ffd9e6",
    glow: ND.magenta,
    intensity: 0.6,
  },
};

/** Tolerant lookup: the cockpit sends "listening", the upstream art says
 *  "processing"; both must land on a skin rather than fall back to idle. */
export function normalizeState(state?: string | null): OrbState {
  const s = String(state || "").toLowerCase();
  if (s.includes("listen") || s.includes("record")) return "listening";
  if (s.includes("think") || s.includes("process") || s.includes("reason")) return "thinking";
  if (s.includes("speak") || s.includes("talk")) return "speaking";
  if (s.includes("delegat") || s.includes("hand")) return "delegating";
  if (s.includes("error") || s.includes("fail")) return "error";
  return "idle";
}

export function skinFor(state?: string | null): Skin {
  return SKINS[normalizeState(state)];
}

export const STATE_ORDER: OrbState[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "delegating",
  "error",
];

/** The cockpit's own words for the state — the status bar reads Czech. */
export function labelFor(state?: string | null): string {
  return skinFor(state).label;
}

/** A CSS `linear-gradient(...)` string for HTML surfaces that cannot take an
 *  SVG gradient (the status bar labels, the panel chips). */
export function gradientCss(state?: string | null, angle = 90): string {
  const g = skinFor(state).grad;
  return `linear-gradient(${angle}deg, ${g[0]}, ${g[1]} 52%, ${g[2]})`;
}

/** hex → "r,g,b" so components can build rgba() at any alpha. */
export function rgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function rgba(hex: string, alpha: number): string {
  return `rgba(${rgb(hex)},${alpha})`;
}

const skin = { ND, skinFor, normalizeState, labelFor, gradientCss, rgba, rgb, STATE_ORDER };
export default skin;
