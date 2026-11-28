let uid = 0;
const scope = (svg) => {
  const k = 'l' + (++uid).toString(36);
  return svg.replace(/id="([\w-]+)"/g, `id="$1-${k}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-${k})`);
};

const SERIF = "'Cinzel', 'Trajan Pro', Georgia, serif";
const ROUND = "'Fredoka', 'Bricolage Grotesque', 'Arial Rounded MT Bold', system-ui, sans-serif";
const GROT = "'Bricolage Grotesque', 'Arial Black', system-ui, sans-serif";

function tile({ bleed, ink, frame, panel, defs, art, word }) {
  if (bleed) {
    return scope(`<svg viewBox="0 0 512 512" class="logo-svg" aria-hidden="true"><defs>${defs}</defs>
      <rect width="512" height="512" fill="${panel}"/>
      <g transform="translate(256 256) scale(.8) translate(-256 -256)">${art}</g></svg>`);
  }
  return scope(`<svg viewBox="0 0 512 512" class="logo-svg" aria-hidden="true"><defs>${defs}
      <clipPath id="inner"><rect x="40" y="40" width="432" height="432" rx="96"/></clipPath></defs>
    <rect x="16" y="16" width="480" height="480" rx="118" fill="${ink}"/>
    <rect x="28" y="28" width="456" height="456" rx="108" fill="${frame}"/>
    <rect x="40" y="40" width="432" height="432" rx="96" fill="${panel}"/>
    <g clip-path="url(#inner)">${word ? `<g transform="translate(256 40) scale(.82) translate(-256 -40)">${art}</g>${word}` : art}</g>
    <rect x="40" y="40" width="432" height="432" rx="96" fill="none" stroke="${ink}" stroke-width="5"/></svg>`);
}

function ttLantern() {
  const ink = '#140904';
  const defs = `
    <radialGradient id="panel" cx="42%" cy="40%" r="75%"><stop offset="0" stop-color="#5a3518"/><stop offset=".55" stop-color="#2a170a"/><stop offset="1" stop-color="#120803"/></radialGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b347"/><stop offset="1" stop-color="#9a4f12"/></linearGradient>
    <radialGradient id="glow" cx="36%" cy="34%" r="58%"><stop offset="0" stop-color="#ffd77a" stop-opacity=".95"/><stop offset=".45" stop-color="#e88a24" stop-opacity=".55"/><stop offset="1" stop-color="#2a1206" stop-opacity="0"/></radialGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5326"/><stop offset=".5" stop-color="#b9763a"/><stop offset="1" stop-color="#6b3c18"/></linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a45"/><stop offset="1" stop-color="#6b3c18"/></linearGradient>
    <radialGradient id="flame" cx="50%" cy="65%" r="60%"><stop offset="0" stop-color="#fffbe2"/><stop offset=".5" stop-color="#ffd35a"/><stop offset="1" stop-color="#ff8a1f"/></radialGradient>
    <clipPath id="hole"><path d="M148 470V176H364V470Z"/></clipPath>`;
  const art = `
    <path d="M148 470V176H364V470Z" fill="#0c0603"/>
    <g clip-path="url(#hole)">
      <rect x="120" y="150" width="280" height="340" fill="url(#glow)"/>
      <g transform="rotate(14 300 330)" fill="#0b0402" opacity=".92">
        <circle cx="300" cy="222" r="15"/>
        <rect x="290" y="232" width="20" height="44" rx="6"/>
        <path d="M240 278H360Q366 286 360 294H240Q234 286 240 278Z"/>
        <path d="M282 294H318L300 452Z"/>
      </g>
      <g stroke="#3b220f" stroke-width="7" stroke-linecap="round">
        <path d="M232 470L250 384M280 470L262 384"/>
        <path d="M226 446H286M234 418H278M242 398H270" stroke-width="5"/>
      </g>
    </g>
    <rect x="118" y="170" width="32" height="300" rx="6" fill="url(#wood)" stroke="${ink}" stroke-width="5"/>
    <rect x="362" y="170" width="32" height="300" rx="6" fill="url(#wood)" stroke="${ink}" stroke-width="5"/>
    <rect x="96" y="134" width="320" height="42" rx="8" fill="url(#beam)" stroke="${ink}" stroke-width="5"/>
    <path d="M110 150H400" stroke="#e7b06a" stroke-opacity=".5" stroke-width="3"/>
    <g fill="${ink}"><circle cx="132" cy="155" r="5"/><circle cx="380" cy="155" r="5"/></g>
    <path d="M196 176V196" stroke="${ink}" stroke-width="5"/>
    <circle cx="196" cy="200" r="6" fill="none" stroke="${ink}" stroke-width="4"/>
    <circle cx="196" cy="250" r="64" fill="#ffc94d" opacity=".18"/>
    <path d="M176 210H216L222 222H170Z" fill="#3b2410" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <rect x="172" y="222" width="48" height="56" rx="6" fill="url(#flame)" stroke="${ink}" stroke-width="5"/>
    <path d="M196 228C206 242 210 252 204 262C200 268 192 268 188 262C182 252 188 242 196 228Z" fill="#fff6c8"/>
    <path d="M184 222V278M208 222V278" stroke="${ink}" stroke-width="3" opacity=".7"/>
    <path d="M168 278H224L218 290H174Z" fill="#3b2410" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
  return { ink, defs, art, frame: 'url(#frame)', panel: 'url(#panel)' };
}

function ttBadge() {
  const ink = '#140904';
  const defs = `
    <radialGradient id="panel" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#4a2a12"/><stop offset="1" stop-color="#140a04"/></radialGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b347"/><stop offset="1" stop-color="#9a4f12"/></linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9eef2"/><stop offset=".5" stop-color="#9aa5ad"/><stop offset="1" stop-color="#55606a"/></linearGradient>
    <linearGradient id="handle" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4520"/><stop offset=".5" stop-color="#b9763a"/><stop offset="1" stop-color="#5e3315"/></linearGradient>
    <radialGradient id="gem" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff4c2"/><stop offset=".45" stop-color="#ffbf2e"/><stop offset="1" stop-color="#b35a0a"/></radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf5a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf5a" stop-opacity="0"/></radialGradient>`;
  const art = `
    <circle cx="256" cy="262" r="190" fill="url(#halo)"/>
    <g transform="rotate(-42 256 262)">
      <rect x="244" y="96" width="24" height="300" rx="10" fill="url(#handle)" stroke="${ink}" stroke-width="5"/>
      <path d="M150 128Q256 70 362 128L356 146Q256 104 156 146Z" fill="url(#steel)" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>
      <rect x="238" y="112" width="36" height="30" rx="5" fill="#4a4f55" stroke="${ink}" stroke-width="5"/>
    </g>
    <g transform="rotate(42 256 262)">
      <path d="M256 70L282 116V300H230V116Z" fill="url(#steel)" stroke="${ink}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M256 84V292" stroke="#ffffff" stroke-opacity=".55" stroke-width="4"/>
      <rect x="188" y="300" width="136" height="22" rx="8" fill="#c58a2e" stroke="${ink}" stroke-width="5"/>
      <rect x="242" y="322" width="28" height="56" rx="8" fill="#3b2410" stroke="${ink}" stroke-width="5"/>
      <circle cx="256" cy="390" r="16" fill="#c58a2e" stroke="${ink}" stroke-width="5"/>
    </g>
    <path d="M256 196L306 236L290 300H222L206 236Z" fill="url(#gem)" stroke="${ink}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M206 236H306M256 196L236 236L256 300L276 236Z" fill="none" stroke="#7a3a06" stroke-width="3" stroke-linejoin="round"/>
    <path d="M232 214L246 204" stroke="#fffbe8" stroke-width="5" stroke-linecap="round"/>`;
  return { ink, defs, art, frame: 'url(#frame)', panel: 'url(#panel)' };
}

function mowEye() {
  const ink = '#0b1208';
  const defs = `
    <pattern id="haz" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="48" height="48" fill="#ffc81f"/><rect width="24" height="48" fill="#1a1a14"/></pattern>
    <radialGradient id="panel" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#1f3a1c"/><stop offset="1" stop-color="#081208"/></radialGradient>
    <radialGradient id="iris" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f2ff9a"/><stop offset=".35" stop-color="#b6ff3d"/><stop offset=".78" stop-color="#2fbf4a"/><stop offset="1" stop-color="#0d4d1f"/></radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#b6ff3d" stop-opacity=".5"/><stop offset="1" stop-color="#b6ff3d" stop-opacity="0"/></radialGradient>
    <clipPath id="eye"><path d="M76 286Q256 112 436 286Q256 460 76 286Z"/></clipPath>`;
  const sector = (a) => {
    const r1 = 22, r2 = 86, s = (a - 30) * Math.PI / 180, e = (a + 30) * Math.PI / 180;
    const p = (r, t) => `${(256 + r * Math.cos(t)).toFixed(1)} ${(286 + r * Math.sin(t)).toFixed(1)}`;
    return `M${p(r1, s)}L${p(r2, s)}A${r2} ${r2} 0 0 1 ${p(r2, e)}L${p(r1, e)}A${r1} ${r1} 0 0 0 ${p(r1, s)}Z`;
  };
  const art = `
    <path d="M96 196L150 60L226 150Z" fill="#1a2b17" stroke="${ink}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M416 196L362 60L286 150Z" fill="#1a2b17" stroke="${ink}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M128 168L152 104L190 150Z M384 168L360 104L322 150Z" fill="#ff8fb0" opacity=".85"/>
    <circle cx="256" cy="286" r="210" fill="url(#halo)"/>
    <path d="M76 286Q256 112 436 286Q256 460 76 286Z" fill="#eaffd0" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/>
    <g clip-path="url(#eye)">
      <circle cx="256" cy="286" r="132" fill="url(#iris)"/>
      <g transform="translate(256 286) scale(.84 1) translate(-256 -286)" fill="#0b1208">${[-90, 30, 150].map((a) => `<path d="${sector(a)}"/>`).join('')}<circle cx="256" cy="286" r="14"/></g>
      <circle cx="306" cy="232" r="20" fill="#fff" opacity=".9"/>
      <circle cx="214" cy="340" r="9" fill="#fff" opacity=".6"/>
    </g>
    <path d="M76 286Q256 112 436 286" fill="none" stroke="${ink}" stroke-width="16" stroke-linecap="round"/>`;
  return { ink, defs, art, frame: 'url(#haz)', panel: 'url(#panel)' };
}

function mowFace() {
  const ink = '#141008';
  const defs = `
    <radialGradient id="panel" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#ffe36b"/><stop offset=".6" stop-color="#ffb21f"/><stop offset="1" stop-color="#c76a06"/></radialGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a30"/><stop offset="1" stop-color="#10100c"/></linearGradient>
    <radialGradient id="iris" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f2ff9a"/><stop offset=".45" stop-color="#b6ff3d"/><stop offset="1" stop-color="#1f8f35"/></radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#c6ff3d" stop-opacity=".7"/><stop offset="1" stop-color="#c6ff3d" stop-opacity="0"/></radialGradient>`;
  const tre = (cx, cy, r) => {
    const sec = (a) => {
      const r1 = r * 0.24, s = (a - 30) * Math.PI / 180, e = (a + 30) * Math.PI / 180;
      const p = (rr, t) => `${(cx + rr * Math.cos(t)).toFixed(1)} ${(cy + rr * Math.sin(t)).toFixed(1)}`;
      return `<path d="M${p(r1, s)}L${p(r, s)}A${r} ${r} 0 0 1 ${p(r, e)}L${p(r1, e)}A${r1} ${r1} 0 0 0 ${p(r1, s)}Z"/>`;
    };
    return `<g fill="${ink}">${[-90, 30, 150].map(sec).join('')}<circle cx="${cx}" cy="${cy}" r="${r * 0.16}"/></g>`;
  };
  const eye = (cx) => `<circle cx="${cx}" cy="276" r="74" fill="url(#glow)"/>
    <path d="M${cx - 58} 276Q${cx} 214 ${cx + 58} 276Q${cx} 338 ${cx - 58} 276Z" fill="url(#iris)" stroke="${ink}" stroke-width="6"/>
    ${tre(cx, 276, 30)}<circle cx="${cx + 18}" cy="260" r="7" fill="#fff"/>`;
  const art = `
    <g fill="none" stroke="${ink}" stroke-opacity=".18" stroke-width="22">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<path d="M${-200 + i * 90} 520L${40 + i * 90} 0"/>`).join('')}</g>
    <path d="M100 210L120 70L210 140Q256 126 302 140L392 70L412 210Q440 268 420 330Q380 440 256 446Q132 440 92 330Q72 268 100 210Z" fill="#17130c" stroke="${ink}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M132 170L140 104L188 142Z M380 170L372 104L324 142Z" fill="#3a2a1a"/>
    ${eye(186)}${eye(326)}
    <path d="M244 336H268L256 352Z" fill="#ff8fb0"/>
    <path d="M256 352Q240 372 222 362M256 352Q272 372 290 362" fill="none" stroke="#b6ff3d" stroke-width="5" stroke-linecap="round"/>
    <g stroke="#b6ff3d" stroke-width="5" stroke-linecap="round" opacity=".9"><path d="M160 344L74 330M160 360L80 372M352 344L438 330M352 360L432 372"/></g>`;
  return { ink, defs, art, frame: 'url(#frame)', panel: 'url(#panel)' };
}

const GAME_COLORS = ['#2f7de1', '#7a3cff', '#e8912a', '#2aa86a'];

const glyphs = {
  house: (x, y) => `<path d="M${x - 20} ${y + 2}L${x} ${y - 18}L${x + 20} ${y + 2}V${y + 20}H${x - 20}Z" fill="#fff"/><rect x="${x - 6}" y="${y + 6}" width="12" height="14" fill="currentColor"/>`,
  card: (x, y) => `<rect x="${x - 15}" y="${y - 20}" width="30" height="40" rx="5" fill="#fff" transform="rotate(-12 ${x} ${y})"/><path d="M${x - 6} ${y - 4}H${x + 6}M${x - 6} ${y + 4}H${x + 4}" stroke="currentColor" stroke-width="4" stroke-linecap="round" transform="rotate(-12 ${x} ${y})"/>`,
  pick: (x, y) => `<path d="M${x - 22} ${y - 8}Q${x} ${y - 26} ${x + 22} ${y - 8}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M${x} ${y - 16}V${y + 22}" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`,
  paw: (x, y) => `<ellipse cx="${x}" cy="${y + 8}" rx="13" ry="11" fill="#fff"/>${[[-14, -6], [-5, -15], [5, -15], [14, -6]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="5.5" fill="#fff"/>`).join('')}`,
};

function ppArena() {
  const ink = '#0a0b1a';
  const defs = `
    <radialGradient id="panel" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#2b2f6b"/><stop offset="1" stop-color="#0d0f26"/></radialGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5d8f"/><stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="#5ad1ff"/></linearGradient>
    <radialGradient id="pit" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#05060f"/><stop offset=".55" stop-color="#14173a"/><stop offset=".85" stop-color="#2d3274"/><stop offset="1" stop-color="#4a52b0"/></radialGradient>
    <radialGradient id="star" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fffbe6"/><stop offset=".5" stop-color="#ffd35a" stop-opacity=".9"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>`;
  const seats = [['house', 256, 104], ['card', 408, 256], ['pick', 256, 408], ['paw', 104, 256]];
  const art = `
    <circle cx="256" cy="256" r="170" fill="url(#pit)" stroke="${ink}" stroke-width="8"/>
    <circle cx="256" cy="256" r="132" fill="none" stroke="#6c75e0" stroke-opacity=".45" stroke-width="4"/>
    <circle cx="256" cy="256" r="96" fill="none" stroke="#6c75e0" stroke-opacity=".3" stroke-width="4"/>
    <circle cx="256" cy="256" r="62" fill="none" stroke="#6c75e0" stroke-opacity=".2" stroke-width="4"/>
    <circle cx="256" cy="256" r="80" fill="url(#star)"/>
    <path d="M256 206L268 244L306 256L268 268L256 306L244 268L206 256L244 244Z" fill="#fffbe6"/>
    ${seats.map(([g, x, y], i) => `<g color="${GAME_COLORS[i]}"><circle cx="${x}" cy="${y}" r="50" fill="${GAME_COLORS[i]}" stroke="${ink}" stroke-width="8"/><circle cx="${x}" cy="${y}" r="42" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>${glyphs[g](x, y)}</g>`).join('')}`;
  return { ink, defs, art, frame: 'url(#frame)', panel: 'url(#panel)' };
}

function ppRing() {
  const ink = '#0a0b1a';
  const defs = `
    <radialGradient id="panel" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#2b2f6b"/><stop offset="1" stop-color="#0d0f26"/></radialGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5d8f"/><stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="#5ad1ff"/></linearGradient>
    <radialGradient id="pit" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#05060f"/><stop offset=".55" stop-color="#14173a"/><stop offset=".85" stop-color="#2d3274"/><stop offset="1" stop-color="#4a52b0"/></radialGradient>
    <radialGradient id="star" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fffbe6"/><stop offset=".5" stop-color="#ffd35a" stop-opacity=".9"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>`;
  const hues = ['#ff5d8f', '#ff8a3d', '#ffd23d', '#8ce04a', '#2fd6a0', '#3db8ff', '#5a7cff', '#a05cff', '#e05cd8', '#ff5d5d'];
  const seats = hues.map((c, i) => {
    const t = (i / hues.length) * Math.PI * 2 - Math.PI / 2;
    const x = (256 + 176 * Math.cos(t)).toFixed(1), y = (256 + 176 * Math.sin(t)).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="26" fill="${c}" stroke="${ink}" stroke-width="6"/><circle cx="${x - 7}" cy="${y - 8}" r="7" fill="#fff" opacity=".55"/>`;
  }).join('');
  const art = `
    <circle cx="256" cy="256" r="150" fill="url(#pit)" stroke="${ink}" stroke-width="8"/>
    <circle cx="256" cy="256" r="116" fill="none" stroke="#6c75e0" stroke-opacity=".45" stroke-width="4"/>
    <circle cx="256" cy="256" r="82" fill="none" stroke="#6c75e0" stroke-opacity=".3" stroke-width="4"/>
    <circle cx="256" cy="256" r="96" fill="url(#star)"/>
    <path d="M256 186L272 240L326 256L272 272L256 326L240 272L186 256L240 240Z" fill="#fffbe6"/>
    ${seats}`;
  return { ink, defs, art, frame: 'url(#frame)', panel: 'url(#panel)' };
}

function ppDie() {
  const ink = '#0a0b1a';
  const defs = `
    <radialGradient id="panel" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#ff7aa2"/><stop offset=".6" stop-color="#e8406f"/><stop offset="1" stop-color="#8a1840"/></radialGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2f6b"/><stop offset="1" stop-color="#0d0f26"/></linearGradient>
    <linearGradient id="die" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe3f5"/></linearGradient>
    <radialGradient id="hole" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000"/><stop offset=".6" stop-color="#14173a"/><stop offset="1" stop-color="#3d448f"/></radialGradient>`;
  const pip = (x, y, i, g) => `<g color="${GAME_COLORS[i]}"><circle cx="${x}" cy="${y}" r="44" fill="${GAME_COLORS[i]}" stroke="${ink}" stroke-width="6"/>${glyphs[g](x, y)}</g>`;
  const art = `
    <g transform="rotate(-8 256 256)">
      <rect x="96" y="104" width="320" height="320" rx="64" fill="${ink}" opacity=".35" transform="translate(10 14)"/>
      <rect x="96" y="96" width="320" height="320" rx="64" fill="url(#die)" stroke="${ink}" stroke-width="10"/>
      ${pip(176, 176, 0, 'house')}${pip(336, 176, 1, 'card')}${pip(176, 336, 2, 'pick')}${pip(336, 336, 3, 'paw')}
      <circle cx="256" cy="256" r="40" fill="url(#hole)" stroke="${ink}" stroke-width="6"/>
      <circle cx="256" cy="256" r="26" fill="none" stroke="#6c75e0" stroke-opacity=".6" stroke-width="3"/>
      <circle cx="256" cy="256" r="12" fill="none" stroke="#6c75e0" stroke-opacity=".4" stroke-width="3"/>
    </g>`;
  return { ink, defs, art, frame: 'url(#frame)', panel: 'url(#panel)' };
}

function drFan() {
  const ink = '#0a0f1f';
  const defs = `
    <radialGradient id="panel" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#25407a"/><stop offset=".7" stop-color="#12213f"/><stop offset="1" stop-color="#0a1428"/></radialGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd35a"/><stop offset="1" stop-color="#e8912a"/></linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#efe6cf"/></linearGradient>
    <linearGradient id="bolt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset="1" stop-color="#ffb020"/></linearGradient>`;
  const card = (rot, color, label, icon) => `<g transform="rotate(${rot} 256 430)">
      <rect x="176" y="120" width="160" height="224" rx="18" fill="url(#paper)" stroke="${ink}" stroke-width="7"/>
      <rect x="186" y="130" width="140" height="52" rx="10" fill="${color}"/>
      <text x="256" y="262" text-anchor="middle" font-size="64">${icon}</text>
      <circle cx="306" cy="316" r="17" fill="${ink}"/><text x="306" y="323" text-anchor="middle" font-family="${ROUND}" font-weight="700" font-size="18" fill="#ffd35a">4M</text>
    </g>`;
  const towers = [[70, 360, 46, 120], [122, 330, 38, 150], [168, 380, 44, 100], [330, 350, 40, 130], [376, 316, 48, 164], [430, 372, 40, 108]]
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0b1630" stroke="#1f3566" stroke-width="3"/>`).join('');
  const art = `
    ${towers}
    <g fill="#ffd35a" opacity=".7">${[[84, 380], [96, 400], [136, 352], [136, 376], [344, 372], [392, 340], [404, 366], [444, 392]].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="10"/>`).join('')}</g>
    ${card(-22, '#e63946', 'DUBAI', '🏙️')}
    ${card(0, '#3a86ff', 'BERLIN', '🏢')}
    ${card(22, '#8338ec', 'TOKYO', '🗼')}
    <path d="M300 84L246 196H290L258 300L360 160H312L346 84Z" fill="url(#bolt)" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/>`;
  return { ink, defs, art, frame: 'url(#frame)', panel: 'url(#panel)' };
}

const word = (text, { font, fill, ink, size = 52, y = 450, spacing = 2 }) => `
  <rect x="40" y="${y - size - 18}" width="432" height="${size + 44}" fill="${ink}" opacity=".78"/>
  <text x="256" y="${y}" text-anchor="middle" font-family="${font}" font-weight="800" font-size="${size}" letter-spacing="${spacing}" fill="${fill}" stroke="${ink}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">${text}</text>`;

const DESIGNS = {
  'deal-rush': {
    a: [drFan, (k) => word('DEAL RUSH', { font: ROUND, fill: '#ffd35a', ink: k, size: 58, spacing: 3 })],
  },
  'tunnel-traitors': {
    a: [ttLantern, (k) => word('TUNNEL TRAITORS', { font: SERIF, fill: '#ffc95a', ink: k, size: 34, spacing: 0 })],
    b: [ttBadge, (k) => word('TUNNEL TRAITORS', { font: SERIF, fill: '#ffc95a', ink: k, size: 34, spacing: 0 })],
  },
  meowltdown: {
    a: [mowEye, (k) => word('MEOW-LTDOWN', { font: GROT, fill: '#c6ff3d', ink: k, size: 44 })],
    b: [mowFace, (k) => word('MEOW-LTDOWN', { font: GROT, fill: '#c6ff3d', ink: k, size: 44 })],
  },
  'party-pit': {
    a: [ppArena, (k) => word('PARTY PIT', { font: ROUND, fill: '#fffbe6', ink: k, size: 60, spacing: 4 })],
    b: [ppDie, (k) => word('PARTY PIT', { font: ROUND, fill: '#fffbe6', ink: k, size: 60, spacing: 4 })],
    c: [ppRing, (k) => word('PARTY PIT', { font: ROUND, fill: '#fffbe6', ink: k, size: 60, spacing: 4 })],
  },
};

export const CHOSEN = { 'tunnel-traitors': 'a', meowltdown: 'a', 'party-pit': 'c', 'deal-rush': 'a' };

export function logo(game, { variant = CHOSEN[game], text = false, bleed = false } = {}) {
  const [make, wm] = DESIGNS[game][variant];
  const d = make();
  return tile({ ...d, bleed, word: text && !bleed ? wm(d.ink) : '' });
}
