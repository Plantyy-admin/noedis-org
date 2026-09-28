/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — sign-in screen

   Self-contained on purpose: it carries its own styles, so it can be
   served before any session exists without exposing the cockpit's
   asset tree.
   ══════════════════════════════════════════════════════════════ */

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function renderLoginPage({ error = '', next = '/', user = '', locked = 0 } = {}) {
  const message = error
    ? `<p class="gate-error" role="alert">${esc(error)}</p>`
    : locked
      ? `<p class="gate-error" role="alert">Příliš mnoho pokusů. Zkus to za ${esc(Math.ceil(locked / 60))} min.</p>`
      : '<p class="gate-hint">Vstup jen pro Foundera. Relace vyprší sama.</p>';

  return `<!DOCTYPE html>
<html lang="cs" class="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#050b18" />
<meta name="robots" content="noindex, nofollow" />
<title>NOEDIS — přihlášení</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='24' font-size='24' fill='%237fe9ff'>&#9670;</text></svg>" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap" rel="stylesheet" />
<style>
  :root{
    --nd-void:#03060f; --nd-abyss:#050b18; --nd-panel:#0a1225; --nd-panel-2:#0d1a31;
    --nd-line:#ffffff14; --nd-ink:#eef5ff; --nd-ink-dim:#a9bad6; --nd-ink-mute:#8b9dba;
    --nd-cyan:#7fe9ff; --nd-blue:#4aa8ff; --nd-system:#b07cff; --nd-magenta:#dd397b;
    --nd-silver:#c8d6ea;
  }
  *,*::before,*::after{box-sizing:border-box}
  html,body{height:100%;margin:0}
  body{
    display:grid; place-items:center; padding:28px 20px;
    background:var(--nd-abyss); color:var(--nd-ink);
    font-family:"Montserrat",system-ui,-apple-system,"Segoe UI",sans-serif;
    -webkit-font-smoothing:antialiased; overflow:hidden;
  }
  /* The same drifting field the cockpit sits on. */
  body::before{
    content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
    background:
      radial-gradient(760px 520px at 0% 0%, #4aa8ff2e, #4aa8ff00 64%),
      radial-gradient(680px 480px at 100% 4%, #b07cff2b, #b07cff00 64%),
      radial-gradient(700px 460px at 50% 100%, #7fe9ff1f, #7fe9ff00 68%),
      repeating-linear-gradient(#ffffff12 0 1px, #ffffff00 1px 130px),
      repeating-linear-gradient(90deg, #ffffff12 0 1px, #ffffff00 1px 130px),
      repeating-linear-gradient(#ffffff10 0 1px, #ffffff00 1px 26px),
      repeating-linear-gradient(90deg, #ffffff10 0 1px, #ffffff00 1px 26px),
      linear-gradient(180deg,#060e20 0%,#081327 42%,#050b18 100%);
    -webkit-mask-image:radial-gradient(125% 88% at 50% 30%, #0000 30%, #0009 62%, #000 100%);
    mask-image:radial-gradient(125% 88% at 50% 30%, #0000 30%, #0009 62%, #000 100%);
  }
  body::after{
    content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.55;
    background:
      radial-gradient(1100px 600px at 20% 6%, #3f7ce83d, #3f7ce800 62%),
      radial-gradient(900px 540px at 82% 66%, #9a5ce033, #9a5ce000 64%);
    animation:gate-aurora 30s ease-in-out infinite alternate;
  }
  @keyframes gate-aurora{
    from{transform:translate3d(-1.2%,-1%,0) scale(1.02)}
    to{transform:translate3d(1.4%,1.2%,0) scale(1.06)}
  }

  .gate{
    position:relative; z-index:1; width:min(430px,100%);
    padding:30px 30px 26px;
    border:1px solid #7fe9ff2e; border-radius:20px;
    background:
      linear-gradient(180deg,#ffffff08,transparent 34%),
      linear-gradient(158deg,#0f1d38,#070e20f7 74%);
    box-shadow:0 34px 80px #01040ccc, 0 0 60px #7fe9ff1a, inset 0 1px #ffffff14;
    backdrop-filter:blur(18px) saturate(150%);
  }
  .gate::after{
    content:""; position:absolute; inset:0; border-radius:20px; pointer-events:none; opacity:.5;
    background:repeating-linear-gradient(180deg,#ffffff05 0 1px,transparent 1px 4px);
    -webkit-mask-image:linear-gradient(180deg,transparent,#000 40%,#000 60%,transparent);
    mask-image:linear-gradient(180deg,transparent,#000 40%,#000 60%,transparent);
  }

  .gate-brand{display:flex; align-items:center; gap:13px; margin-bottom:22px}
  .gate-swan{
    display:grid; place-items:center; width:46px; height:46px; flex:none;
    border:1px solid #7fe9ff40; border-radius:15px; color:var(--nd-cyan); font-size:21px;
    background:radial-gradient(circle at 50% 12%,#7fe9ff1f,transparent 70%),linear-gradient(145deg,#ffffff0f,#7fe9ff08);
    box-shadow:inset 0 1px #ffffff1f, 0 0 22px #7fe9ff1a;
  }
  .gate-brand b{
    display:block; font-size:17px; font-weight:800; letter-spacing:.2em; line-height:1.1;
    background:linear-gradient(180deg,#ffffff,var(--nd-silver) 55%,#8ea6c6);
    -webkit-background-clip:text; background-clip:text; color:transparent;
    -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 14px #9fd8ff3d);
  }
  .gate-brand small{
    display:block; margin-top:5px; color:var(--nd-cyan);
    font-size:7.5px; font-weight:900; letter-spacing:.36em;
    text-shadow:0 0 12px #7fe9ff6b;
  }

  .gate-kicker{
    display:block; margin-bottom:10px; color:var(--nd-ink-mute);
    font-size:8.5px; font-weight:850; letter-spacing:.3em; text-transform:uppercase;
  }

  .gate-field{margin-bottom:13px}
  .gate-field label{
    display:block; margin-bottom:6px; color:var(--nd-ink-mute);
    font-size:8px; font-weight:850; letter-spacing:.24em; text-transform:uppercase;
  }
  .gate-field input{
    width:100%; min-height:44px; padding:10px 13px;
    border:1px solid #ffffff1a; border-radius:11px;
    background:linear-gradient(180deg,#060d1c,#040a16); color:var(--nd-ink);
    font-family:inherit; font-size:13px; font-weight:600; letter-spacing:.02em;
    outline:none; transition:border-color .2s, box-shadow .2s, background .2s;
  }
  .gate-field input::placeholder{color:#5b6b88; font-weight:500}
  .gate-field input:focus{
    border-color:#7fe9ff8c;
    box-shadow:0 0 0 3px #7fe9ff1f, 0 0 26px #7fe9ff26;
    background:linear-gradient(180deg,#081224,#050c1a);
  }

  .gate-submit{
    width:100%; min-height:46px; margin-top:19px; cursor:pointer;
    border:1px solid #8790ff4d; border-radius:11px; color:#f4fbff;
    background:linear-gradient(135deg,#426be0,#7148d2 72%,#8749d0);
    box-shadow:inset 0 1px #ffffff3b, 0 10px 26px #1e1b6745;
    font-family:inherit; font-size:10.5px; font-weight:900; letter-spacing:.2em; text-transform:uppercase;
    transition:transform .18s, box-shadow .2s, border-color .2s, background .2s;
  }
  .gate-submit:hover{
    border-color:#bcb8ff;
    background:linear-gradient(135deg,#5b7df0,#7d57e4 72%,#9559df);
    box-shadow:inset 0 1px #ffffff65, 0 0 30px #7661ff55;
    transform:translateY(-1px);
  }
  .gate-submit:active{transform:translateY(0)}

  .gate-hint,.gate-error{
    margin:15px 0 0; font-size:10px; font-weight:600; letter-spacing:.05em; line-height:1.5;
  }
  .gate-hint{color:var(--nd-ink-mute)}
  .gate-error{
    padding:10px 12px; border:1px solid #dd397b5c; border-radius:11px;
    background:linear-gradient(135deg,#dd397b1f,#dd397b0a); color:#ffb9cf;
  }

  .gate-foot{
    margin-top:20px; padding-top:15px; border-top:1px solid var(--nd-line);
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    color:#6c7c99; font-size:8px; font-weight:800; letter-spacing:.24em; text-transform:uppercase;
  }
  .gate-foot i{color:var(--nd-cyan); font-style:normal; text-shadow:0 0 10px #7fe9ff6b}

  @media (max-width:440px){
    .gate{padding:24px 20px 20px; border-radius:18px}
  }
</style>
</head>
<body>
  <main class="gate">
    <div class="gate-brand">
      <span class="gate-swan" aria-hidden="true">&#9670;</span>
      <span>
        <b>NOEDIS</b>
        <small>COMPANY</small>
      </span>
    </div>

    <span class="gate-kicker">&#9670; Zabezpe&#269;en&yacute; vstup &middot; Command Center</span>

    <form method="post" action="/noedis/login" autocomplete="on">
      <input type="hidden" name="next" value="${esc(next)}" />
      <div class="gate-field">
        <label for="u">U&#382;ivatel</label>
        <input id="u" name="username" type="text" value="${esc(user)}" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required />
      </div>
      <div class="gate-field">
        <label for="p">Heslo</label>
        <input id="p" name="password" type="password" autocomplete="current-password" required />
      </div>
      <button class="gate-submit" type="submit">P&#345;ihl&aacute;sit se</button>
    </form>

    ${message}

    <div class="gate-foot">
      <span>NOEDIS &middot; Company OS</span>
      <span><i>&#9670;</i> v0.5.0</span>
    </div>
  </main>
</body>
</html>`;
}
