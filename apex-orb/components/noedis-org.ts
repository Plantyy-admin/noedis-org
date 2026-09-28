/* ══════════════════════════════════════════════════════════════
   The constellation around the orb — the real NOEDIS company.

   Upstream APEX-UI orbits a demo roster (Chief of staff, CRM, Drive…).
   This replaces it with the company that actually exists on the board:
   NOE (Senior Advisor), CODY (Right Hand), RENE (Left Hand) and the
   seven department heads — all read live from Paperclip through the
   cockpit's `/noedis/api/voice/agents`.

   The layout is fixed and the names are filled in from the live roster,
   because a constellation that re-arranges itself every poll is
   unreadable; and a hard-coded fallback means the orb never renders an
   empty sky when the board is unreachable.
   ══════════════════════════════════════════════════════════════ */

import { ND } from "./noedis-skin";

/** The viewBox the reasoning web draws into. */
export const VIEW_W = 680;
export const VIEW_H = 480;
export const AX = VIEW_W / 2;
export const AY = VIEW_H / 2;

export type OrgAgent = {
  id: string;
  name: string;
  title: string;
  role?: string | null;
  status?: string | null;
  reportsTo?: string | null;
  reportsToName?: string | null;
  department?: string | null;
  isDepartmentHead?: boolean;
  isLeadership?: boolean;
};

export type ConstellationNode = {
  /** Stable id — this is what `fire()` lights. */
  key: string;
  /** Label under/next to the node. */
  name: string;
  /** What the overview card shows as the heading. */
  fullName: string;
  title: string;
  department: string;
  status: string;
  agentId: string | null;
  reportsTo: string | null;
  /** Name of the agent this one reports to, when the board knows it. */
  reportsToName: string | null;
  color: string;
  /** ReasoningWeb roster tuple: layer drives the colour family. */
  layer: "lead" | "cody" | "rene" | "dept";
  x: number;
  y: number;
  r: number;
  bend: number;
  live: boolean;
};

type Slot = {
  key: string;
  /** Fallback label when the board has nobody in this slot. */
  name: string;
  layer: ConstellationNode["layer"];
  color: string;
  angle: number;
  radius: number;
  /** Vertical radius, when the slot sits on a flattened arc. The department
   *  fan uses it so the bottom circles — and the labels drawn above them —
   *  clear the status bar that owns the strip under the orb. */
  ry?: number;
  r: number;
  bend: number;
  /** How to recognise the agent that belongs in this slot. */
  match: RegExp;
};

const polar = (angle: number, radius: number, ry = radius) => {
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.round((AX + radius * Math.cos(rad)) * 10) / 10,
    y: Math.round((AY + ry * Math.sin(rad)) * 10) / 10,
  };
};

/* Seven department heads fanned across the bottom, leadership on top: NOE at
   twelve o'clock (the one the founder talks to), CODY and RENE flanking him —
   exactly the reporting tree on the board.

   Two deliberate choices in the fan. It is flattened (`ry` < `radius`) so the
   bottom circles clear the status bar, and it is rotated half a step so the
   24° gap between the fourth and fifth head lands dead centre: the cockpit's
   microphone button sits there, and it must not sit on an agent. */
const DEPT_RY = 112;
const DEPT_ANGLES = [174, 150, 126, 102, 78, 54, 30];

const SLOTS: Slot[] = [
  { key: "noe", name: "NOE", layer: "lead", color: ND.product, angle: -90, radius: 150, r: 15, bend: -18, match: /(^|\s)NOE(\s|$)/i },
  { key: "cody", name: "CODY", layer: "cody", color: ND.framework, angle: -32, radius: 184, r: 11, bend: -14, match: /(^|\s)CODY(\s|$)/i },
  { key: "rene", name: "RENE", layer: "rene", color: ND.green, angle: -148, radius: 184, r: 11, bend: 14, match: /(^|\s)RENE(\s|$)/i },
  ...DEPT_ANGLES.map((angle, i) => ({
    key: `dept${i}`,
    name: "VOLNÉ",
    layer: "dept" as const,
    color: ND.system,
    angle,
    // The outer two tuck in slightly so the fan keeps a round silhouette.
    radius: 206 - Math.abs(i - 3) * 4,
    ry: DEPT_RY,
    r: 8,
    bend: (90 - angle) * 0.28,
    match: /^$/,
  })),
];

/** Baked-in fallback, mirroring the board on 2026-09-28. Only used when the
 *  roster fetch fails, so the orb is never blank. */
export const FALLBACK_ORG: OrgAgent[] = [
  { id: "3aeb9559-c953-4e1e-b551-c8201554c98e", name: "NOE", title: "NOE — Senior Advisor", role: "ceo", status: "idle", reportsTo: null, isLeadership: true },
  { id: "39c710c0-c4c1-4612-bbef-5e4a9f60d12b", name: "CODY", title: "CODY — Right Hand", role: "cto", status: "idle", reportsTo: "3aeb9559-c953-4e1e-b551-c8201554c98e", isLeadership: true },
  { id: "63d3dbf5-3cb1-44f0-8285-543c07f5a5aa", name: "RENE", title: "RENE — Left Hand", role: "pm", status: "idle", reportsTo: "3aeb9559-c953-4e1e-b551-c8201554c98e", isLeadership: true },
  { id: "e6e6c2a2-2af3-4be5-934f-f0156e3665e7", name: "Frontend Engineer", title: "Vedoucí oddělení VÝVOJ", status: "idle", isDepartmentHead: true },
  { id: "0fe8e9f4-401c-4b2d-b25c-0f4d55885ea2", name: "DevOps Engineer", title: "Vedoucí oddělení INFRA", status: "idle", isDepartmentHead: true },
  { id: "1863a587-6558-46bc-a42e-61136ca95c28", name: "Support Specialist", title: "Vedoucí oddělení IT", status: "idle", isDepartmentHead: true },
  { id: "a47aede3-b55b-4081-afe7-1970ff40188e", name: "Legal Counsel", title: "Vedoucí oddělení LEGAL", status: "idle", isDepartmentHead: true },
  { id: "46d6f342-8e9a-4f50-a704-77c5278d59cc", name: "Research Scientist", title: "Vedoucí oddělení LABS", status: "idle", isDepartmentHead: true },
  { id: "9dd7bb8b-cbdb-49c3-9c67-499da05a8970", name: "Marketing Lead", title: "Vedoucí oddělení MARKETING", status: "idle", isDepartmentHead: true },
  { id: "a8252b65-3570-47aa-8bd3-20dbf9572148", name: "Business Analyst", title: "Vedoucí oddělení FINANCE", status: "idle", isDepartmentHead: true },
];

/** "Vedoucí oddělení VÝVOJ" → "VÝVOJ"; anything else keeps the agent's name. */
export function departmentOf(agent: OrgAgent): string {
  const m = /vedouc[íi]\s+odd[ěe]len[íi]\s+(.+)$/i.exec(String(agent.title || ""));
  if (m) return m[1].trim().toUpperCase();
  return String(agent.name || "").trim();
}

function isHead(agent: OrgAgent): boolean {
  if (agent.isDepartmentHead) return true;
  return /vedouc[íi]\s+odd[ěe]len[íi]/i.test(String(agent.title || ""));
}

/** Who lands in the nine surrounding slots. */
export function pickLeadership(agents: OrgAgent[]) {
  const find = (re: RegExp) =>
    agents.find((a) => re.test(String(a.name || "")) || re.test(String(a.title || "")));
  const noe = find(/(^|\s)NOE(\s|$)/i);
  const cody = find(/(^|\s)CODY(\s|$)/i);
  const rene = find(/(^|\s)RENE(\s|$)/i);
  const heads = agents
    .filter((a) => isHead(a))
    .filter((a) => a.id !== noe?.id && a.id !== cody?.id && a.id !== rene?.id)
    .sort((a, b) => departmentOf(a).localeCompare(departmentOf(b), "cs"));
  return { noe, cody, rene, heads };
}

/** Merge the fixed layout with whatever the board currently has. */
export function buildConstellation(agents: OrgAgent[]): ConstellationNode[] {
  const { noe, cody, rene, heads } = pickLeadership(agents);
  const assigned = [noe, cody, rene, ...heads];
  const byId = new Map(agents.map((a) => [a.id, a]));

  return SLOTS.map((slot, i) => {
    const agent = assigned[i];
    const { x, y } = polar(slot.angle, slot.radius, slot.ry);
    const dept = agent ? departmentOf(agent) : "";
    const boss = agent?.reportsTo ? byId.get(agent.reportsTo) : undefined;
    return {
      key: slot.key,
      name:
        slot.layer === "dept"
          ? dept || "VOLNÉ"
          : agent
            ? String(agent.name || slot.key).toUpperCase()
            : slot.key.toUpperCase(),
      fullName: agent ? String(agent.name || slot.name) : slot.name,
      title: agent ? String(agent.title || "") : "Neobsazeno",
      department: dept,
      status: String(agent?.status || (agent ? "idle" : "unassigned")),
      agentId: agent?.id ?? null,
      reportsTo: agent?.reportsTo ?? null,
      reportsToName: boss ? String(boss.name || "") : null,
      color: slot.color,
      layer: slot.layer,
      x,
      y,
      r: slot.r,
      bend: slot.bend,
      live: Boolean(agent),
    };
  });
}

/** ReasoningWeb wants roster tuples: [id, label, layer, x, y, live, bend, r]. */
export function toRoster(nodes: ConstellationNode[]) {
  return nodes.map((n) => [n.key, n.name, n.layer, n.x, n.y, n.live, n.bend, n.r]);
}

/** Resolve a short handle the cockpit may send ("cody", "vyvoj", an id) to a
 *  node key, so an action can light the right circle. */
export function nodeKeyFor(nodes: ConstellationNode[], handle: string): string | null {
  const h = String(handle || "").trim().toLowerCase();
  if (!h) return null;
  const norm = (s: string) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const hn = norm(h);
  for (const n of nodes) {
    if (n.key === h) return n.key;
    if (n.agentId && n.agentId === handle) return n.key;
    if (norm(n.name) === hn) return n.key;
    if (norm(n.department) === hn) return n.key;
    if (norm(n.fullName) === hn) return n.key;
    if (hn.length >= 3 && norm(n.fullName).startsWith(hn)) return n.key;
  }
  return null;
}

export type OrgPayload = { agents: OrgAgent[]; noeAgentId?: string | null; generatedAt?: string };

/** One chip in the status bar under the orb. */
export type OrbAction = {
  key: string;
  name: string;
  color?: string;
  /** předávám | pracuje | hotovo | chyba */
  kind?: string;
};

/** Read the live roster from the cockpit. Same origin as this iframe, so the
 *  cockpit's session cookie travels with it. */
export async function fetchOrg(signal?: AbortSignal): Promise<OrgPayload> {
  const res = await fetch("/noedis/api/voice/agents", {
    headers: { Accept: "application/json" },
    signal,
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as OrgPayload;
  if (!Array.isArray(data?.agents) || data.agents.length === 0) {
    throw new Error("prázdný seznam agentů");
  }
  return data;
}
