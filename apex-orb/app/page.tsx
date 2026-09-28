import ApexWorld from "@/components/ApexWorld";
import ApexOverviewPanel from "@/components/ApexOverviewPanel";

/**
 * The NOEDIS voice deck: a company HUD top-left, the orb and its
 * constellation filling the frame. Everything the founder needs to see while
 * talking lives on this one screen — which agent is lit, what state the orb is
 * in, and what the company is doing.
 */
export default function Home() {
  return (
    <main
      id="main"
      style={{ background: "#050b18", color: "#eef5ff", position: "relative", overflow: "hidden" }}
    >
      <ApexOverviewPanel />

      <section style={{ position: "relative", height: "100vh", minHeight: 620 }}>
        <ApexWorld />
      </section>
    </main>
  );
}
