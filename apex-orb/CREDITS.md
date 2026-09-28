# Credits

The NOEDIS APEX orb is derived from **APEX-UI**, MIT-licensed, and that
attribution is kept here on purpose.

APEX-UI in turn builds on two excellent **MIT-licensed** community components
from [21st.dev](https://21st.dev/community/components):

- **Animated shader background** — `components/ShaderBackground.jsx`
  (the WebGL "plasma waves" backdrop behind the orb).
- **Overview lamp panel** — the glowing filament HUD that
  `components/ApexOverviewPanel.tsx` replaced with the NOEDIS read-out.

Both are used under the MIT license, which permits reuse (including commercial)
provided attribution is kept — hence this file.

> Original APEX-UI: <https://github.com/RubenM1990/APEX-UI>
>
> Upstream asks that forks keep this attribution and, if the original authors'
> 21st.dev handles are known, add the exact component links so credit is
> precise:
>
> - Shader background: `<21st.dev component URL / author>`
> - Overview lamp: `<21st.dev component URL / author>`

Everything else — the SVG orb, the reasoning-web graph, the status bar and the
app wiring — is original to APEX-UI.

## What NOEDIS wrote on top

The files below are NOEDIS additions; see `README.md` for what they do.

- `components/noedis-skin.ts` — the company palette and the six state gradients
- `components/noedis-org.ts` — the live NOEDIS constellation
- `components/ApexWorld.tsx`, `ApexHeroOrb.tsx`, `OrbStatusBar.jsx`,
  `ApexOverviewPanel.tsx`, `ApexOrb.jsx`, `ApexCore3D.jsx`,
  `ReasoningWeb.jsx`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css` —
  re-skinned and re-pointed at the real company
