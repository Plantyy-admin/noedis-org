"use client";

/**
 * The read-out in the top-left corner of the voice deck.
 *
 * Upstream this was a weather lamp for a demo site: Tel-Aviv temperature,
 * "your town" when the geo headers were missing, and three social links to the
 * original author's profiles. None of that belongs in the NOEDIS cockpit, so
 * it now shows what the founder actually needs while talking: the time, how
 * many agents the board has, whether Hermes is answering, and which NOE the
 * company routes through.
 */

import { useEffect, useState } from "react";
import { ND } from "./noedis-skin";

type Status = {
  hermesOk: boolean | null;
  model?: string | null;
  agentCount: number | null;
  noeAgentId?: string | null;
  channels?: string[];
  error?: string | null;
};

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function useCompanyStatus() {
  const [st, setSt] = useState<Status>({ hermesOk: null, agentCount: null });

  useEffect(() => {
    let live = true;
    const load = async () => {
      const out: Status = { hermesOk: null, agentCount: null };
      try {
        const res = await fetch("/noedis/api/voice/status", {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (res.ok) {
          const d = await res.json();
          out.hermesOk = Boolean(d?.hermes?.reachable);
          out.model = d?.hermes?.model ?? null;
          out.noeAgentId = d?.noeAgentId ?? null;
          out.error = d?.hermes?.error ?? null;
          const ch = d?.hermes?.channels || {};
          out.channels = [
            ch?.telegram?.configured ? "TG" : null,
            ch?.whatsapp?.enabled ? "WA" : null,
          ].filter(Boolean) as string[];
        }
      } catch {
        out.hermesOk = false;
      }
      try {
        const res = await fetch("/noedis/api/voice/agents", {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d?.agents)) out.agentCount = d.agents.length;
        }
      } catch {
        /* the count is optional */
      }
      if (live) setSt(out);
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  return st;
}

export default function ApexOverviewPanel() {
  const now = useClock();
  const st = useCompanyStatus();

  const time = now ? now.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const date = now
    ? now.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "long" })
    : "";

  const hermes = st.hermesOk === null ? "—" : st.hermesOk ? "ONLINE" : "OFFLINE";

  return (
    <div className="nd-hud">
      <div className="nd-hud-brand">
        <span className="nd-mark">◆</span>
        <span>NOEDIS</span>
        <span className="nd-sub">APEX · HLASOVÉ ŘÍZENÍ</span>
      </div>
      <div className="nd-hud-rule" />

      <div className="nd-hud-row">
        <div>
          <div className="nd-hud-clock">{time}</div>
          <div className="nd-hud-date">{date}</div>
        </div>

        <div className="nd-hud-stat">
          <b style={{ color: ND.cyan }}>{st.agentCount ?? "—"}</b>
          <span>Agentů</span>
        </div>

        <div className="nd-hud-stat">
          <b
            style={{
              color: st.hermesOk ? ND.green : st.hermesOk === false ? ND.magenta : ND.inkMute,
            }}
          >
            {hermes}
          </b>
          <span>Hermes</span>
        </div>

        {st.channels && st.channels.length > 0 && (
          <div className="nd-hud-stat">
            <b style={{ color: ND.system }}>{st.channels.join(" · ")}</b>
            <span>Kanály</span>
          </div>
        )}
      </div>

      <div className="nd-hud-company">
        <span>
          NOE <b>{st.noeAgentId ? `${st.noeAgentId.slice(0, 8)}…` : "—"}</b>
        </span>
        <span>
          Model <b>{st.model || "hermes-agent"}</b>
        </span>
        {st.hermesOk === false && <span className="nd-hud-err">{st.error || "Hermes neodpovídá"}</span>}
      </div>
    </div>
  );
}
