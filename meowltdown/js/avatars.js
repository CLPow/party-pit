export const FURS = [
  ['#f2a65a', '#c97a34', '#ffe3c4'],
  ['#8d8d94', '#5f5f66', '#d9d9de'],
  ['#2b2b33', '#16161b', '#5b5b66'],
  ['#f4efe6', '#d8cfbf', '#ffffff'],
  ['#c98b5b', '#8a5a36', '#efd2b5'],
  ['#e8c36b', '#b8913a', '#fff1c7'],
  ['#9a7b66', '#6c5242', '#d8c3b3'],
  ['#5d6b8a', '#3d4864', '#a9b4cc'],
  ['#d98a8a', '#a85c5c', '#f6d1d1'],
  ['#6fae7f', '#467d56', '#c7e6cf'],
  ['#b48ad9', '#7f59a8', '#e6d5f5'],
  ['#3a2f2a', '#1e1714', '#8c7466'],
];
export const ACCS = ['None', 'Goggles', 'Hard hat', 'Headphones', 'Bow tie', 'Specs', 'Gas mask', 'Antenna', 'Crown'];

const parse = (a) => {
  const [f, x] = String(a || '0-0').split('-').map((n) => Number(n) || 0);
  return [Math.abs(f) % FURS.length, Math.abs(x) % ACCS.length];
};

function eyes(mood) {
  if (mood === 'dead') return '<path d="M34 50l10 10M44 50l-10 10M66 50l10 10M76 50l-10 10" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>';
  if (mood === 'happy') return '<path d="M32 58q7-10 14 0M64 58q7-10 14 0" stroke="#1a1a1a" stroke-width="4" fill="none" stroke-linecap="round"/>';
  const r = mood === 'scared' ? 9 : 8;
  const pr = mood === 'scared' ? 2.4 : 4.6;
  return `<ellipse cx="39" cy="56" rx="${r}" ry="${r + 1}" fill="#fff"/><ellipse cx="71" cy="56" rx="${r}" ry="${r + 1}" fill="#fff"/>
    <ellipse cx="40" cy="57" rx="${pr}" ry="${pr + 2}" fill="#14231a"/><ellipse cx="70" cy="57" rx="${pr}" ry="${pr + 2}" fill="#14231a"/>
    <circle cx="42" cy="53" r="1.8" fill="#fff"/><circle cx="72" cy="53" r="1.8" fill="#fff"/>`;
}

function mouth(mood) {
  if (mood === 'scared') return '<ellipse cx="55" cy="80" rx="6" ry="7" fill="#3a1010"/>';
  if (mood === 'happy') return '<path d="M45 76q10 12 20 0" stroke="#1a1a1a" stroke-width="3" fill="#7a2020" stroke-linecap="round"/>';
  return '<path d="M48 76q3.5 4 7 0q3.5 4 7 0" stroke="#1a1a1a" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
}

function acc(i) {
  switch (i) {
    case 1: return '<rect x="22" y="44" width="66" height="8" rx="4" fill="#333"/><circle cx="39" cy="55" r="13" fill="rgba(120,255,200,.35)" stroke="#2c2c2c" stroke-width="4"/><circle cx="71" cy="55" r="13" fill="rgba(120,255,200,.35)" stroke="#2c2c2c" stroke-width="4"/>';
    case 2: return '<path d="M24 40q31-34 62 0z" fill="#ffc21a" stroke="#b07d00" stroke-width="3"/><rect x="18" y="37" width="74" height="7" rx="3.5" fill="#ffcf3d" stroke="#b07d00" stroke-width="2"/><rect x="51" y="14" width="8" height="24" rx="3" fill="#e6a800"/>';
    case 3: return '<path d="M20 58q0-44 35-44t35 44" stroke="#222" stroke-width="5" fill="none"/><rect x="12" y="50" width="14" height="22" rx="6" fill="#ff5ea8"/><rect x="84" y="50" width="14" height="22" rx="6" fill="#ff5ea8"/>';
    case 4: return '<path d="M55 98l-16-9v18zM55 98l16-9v18z" fill="#e63946"/><circle cx="55" cy="98" r="4.5" fill="#b3202c"/>';
    case 5: return '<circle cx="39" cy="56" r="12" fill="none" stroke="#111" stroke-width="3"/><circle cx="71" cy="56" r="12" fill="none" stroke="#111" stroke-width="3"/><path d="M51 56h8" stroke="#111" stroke-width="3"/>';
    case 6: return '<path d="M33 70q22 28 44 0v-4q-22-6-44 0z" fill="#3c4a3e" stroke="#1d241e" stroke-width="2"/><circle cx="55" cy="84" r="8" fill="#5e6f61" stroke="#1d241e" stroke-width="2"/><circle cx="55" cy="84" r="3" fill="#1d241e"/>';
    case 7: return '<path d="M55 22V6" stroke="#444" stroke-width="3"/><circle class="ant-led" cx="55" cy="6" r="5" fill="#39ff88"/>';
    case 8: return '<path d="M32 30l6-18 9 12 8-16 8 16 9-12 6 18z" fill="#ffd23d" stroke="#b88a00" stroke-width="2"/>';
    default: return '';
  }
}

export function catSvg(avatar, mood = 'normal', cls = '') {
  const [f, a] = parse(avatar);
  const [fur, dark, light] = FURS[f];
  const stripes = f % 3 === 0 ? `<path d="M50 24v12M58 22v12M42 27v9" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>` : '';
  return `<svg class="cat ${cls}" viewBox="0 0 110 110" aria-hidden="true">
    <path d="M18 50L22 10l30 20z" fill="${fur}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M92 50L88 10 58 30z" fill="${fur}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 40l2-20 16 12z" fill="#ff9fb2"/><path d="M86 40l-2-20-16 12z" fill="#ff9fb2"/>
    <ellipse cx="55" cy="62" rx="40" ry="36" fill="${fur}" stroke="${dark}" stroke-width="3"/>
    ${stripes}
    <ellipse cx="55" cy="78" rx="20" ry="14" fill="${light}"/>
    ${a === 6 ? '' : eyes(mood)}
    ${a === 6 ? eyes(mood) : ''}
    <path d="M51 70h8l-4 5z" fill="#ff7a93"/>
    ${a === 6 ? '' : mouth(mood)}
    <path d="M30 72h-18M30 78l-17 4M80 72h18M80 78l17 4" stroke="${dark}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    ${acc(a)}
  </svg>`;
}

const ART = {
  meltdown: `<svg viewBox="0 0 120 120" class="art"><defs><radialGradient id="mg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6b0"/><stop offset=".35" stop-color="#ffb020"/><stop offset="1" stop-color="#ff3b1f" stop-opacity="0"/></radialGradient></defs>
    <circle cx="60" cy="60" r="56" fill="url(#mg)"/><circle cx="60" cy="60" r="38" fill="#1b1205" stroke="#ffd23d" stroke-width="4"/>
    <g fill="#ffd23d"><path d="M60 60L42 29a36 36 0 0 1 36 0z"/><path d="M60 60l36 0a36 36 0 0 1-18 31z"/><path d="M60 60L42 91a36 36 0 0 1-18-31z"/></g>
    <circle cx="60" cy="60" r="9" fill="#1b1205" stroke="#ffd23d" stroke-width="3"/>
    <path d="M47 102q-6 10 3 12M73 102q6 10-3 12" stroke="#ffd23d" stroke-width="3" fill="none"/><path d="M38 24l-6-14 14 8M82 24l6-14-14 8" fill="#1b1205" stroke="#ffd23d" stroke-width="3"/></svg>`,
  critical: `<svg viewBox="0 0 120 120" class="art"><defs><radialGradient id="cg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe8ff"/><stop offset=".4" stop-color="#c25bff"/><stop offset="1" stop-color="#4b00a0" stop-opacity="0"/></radialGradient></defs>
    <circle cx="60" cy="60" r="56" fill="url(#cg)"/><g stroke="#f0c8ff" stroke-width="3" fill="none"><ellipse cx="60" cy="60" rx="44" ry="14"/><ellipse cx="60" cy="60" rx="44" ry="14" transform="rotate(60 60 60)"/><ellipse cx="60" cy="60" rx="44" ry="14" transform="rotate(-60 60 60)"/></g>
    <circle cx="60" cy="60" r="14" fill="#1a0033" stroke="#f0c8ff" stroke-width="3"/><circle cx="55" cy="58" r="2.5" fill="#f0c8ff"/><circle cx="65" cy="58" r="2.5" fill="#f0c8ff"/><path d="M54 65q6 4 12 0" stroke="#f0c8ff" stroke-width="2" fill="none"/></svg>`,
  coolant: `<svg viewBox="0 0 120 120" class="art"><defs><linearGradient id="cl" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e9fbff"/><stop offset="1" stop-color="#36c6ff"/></linearGradient></defs>
    <rect x="36" y="22" width="48" height="84" rx="12" fill="url(#cl)" stroke="#0a6c96" stroke-width="4"/><rect x="48" y="10" width="24" height="16" rx="4" fill="#0a6c96"/>
    <g stroke="#0a6c96" stroke-width="4" stroke-linecap="round"><path d="M60 46v40M43 56l34 20M77 56L43 76"/></g>
    <g stroke="#0a6c96" stroke-width="3" stroke-linecap="round"><path d="M55 50l5 5 5-5M55 82l5-5 5 5"/></g></svg>`,
};

const G = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;

Object.assign(ART, {
  hiss: `<svg viewBox="0 0 120 120" class="art">${G('hg', '#ff8a8a', '#c41d3a')}
    <g stroke="#ffd0d0" stroke-width="3" stroke-linecap="round"><path d="M60 8v14M28 18l8 12M92 18l-8 12M12 46l14 4M108 46l-14 4"/></g>
    <path d="M14 98q4-40 26-52l-6-22 18 14q8-3 16 0l18-14-6 22q22 12 26 52z" fill="url(#hg)" stroke="#6b0f1f" stroke-width="3" stroke-linejoin="round"/>
    <path d="M38 62l12 6M82 62l-12 6" stroke="#2a0008" stroke-width="5" stroke-linecap="round"/>
    <path d="M42 84q18-14 36 0l-6 8-6-6-6 8-6-8-6 6z" fill="#2a0008"/><path d="M48 84l3 7M72 84l-3 7" stroke="#fff" stroke-width="3"/></svg>`,
  nap: `<svg viewBox="0 0 120 120" class="art">${G('ng', '#b9d6ff', '#4a6fb8')}
    <path d="M84 14a22 22 0 1 0 18 34 26 26 0 0 1-18-34z" fill="#ffe9a8"/>
    <path d="M16 96q0-34 40-34t48 26q0 14-26 14H28q-12 0-12-6z" fill="url(#ng)" stroke="#233a6b" stroke-width="3"/>
    <path d="M30 66l2-16 12 12M56 62l6-14 6 14" fill="url(#ng)" stroke="#233a6b" stroke-width="3" stroke-linejoin="round"/>
    <path d="M34 78q5 4 10 0M54 78q5 4 10 0" stroke="#233a6b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M100 92q14-4 8-22" stroke="#233a6b" stroke-width="5" fill="none" stroke-linecap="round"/>
    <text x="74" y="46" font-size="16" font-weight="900" fill="#dff0ff" font-family="sans-serif">z</text><text x="88" y="32" font-size="12" font-weight="900" fill="#dff0ff" font-family="sans-serif">z</text></svg>`,
  overload: `<svg viewBox="0 0 120 120" class="art">${G('og', '#fff7a8', '#ffb020')}
    <rect x="22" y="30" width="70" height="60" rx="10" fill="#1d1a10" stroke="#ffd23d" stroke-width="4"/><rect x="92" y="48" width="10" height="24" rx="3" fill="#ffd23d"/>
    <rect x="30" y="38" width="16" height="44" rx="3" fill="#ff4d1f"/><rect x="50" y="38" width="16" height="44" rx="3" fill="#ff8a1f"/><rect x="70" y="38" width="14" height="44" rx="3" fill="#ffd23d"/>
    <path d="M66 4L36 62h22l-8 54 38-66H64z" fill="url(#og)" stroke="#7a4b00" stroke-width="3" stroke-linejoin="round"/></svg>`,
  peek: `<svg viewBox="0 0 120 120" class="art">${G('pg', '#d8ffe9', '#2fbf6f')}
    <rect x="18" y="22" width="84" height="80" rx="14" fill="#18221c" stroke="#39ff88" stroke-width="4"/>
    <path d="M32 74a28 28 0 0 1 56 0" stroke="#39ff88" stroke-width="3" fill="none"/>
    <g stroke="#39ff88" stroke-width="2"><path d="M36 64l5 3M46 52l3 5M60 47v6M74 52l-3 5M84 64l-5 3"/></g>
    <path class="geiger-needle" d="M60 74L80 54" stroke="#ff4d1f" stroke-width="4" stroke-linecap="round"/>
    <circle cx="60" cy="74" r="5" fill="#39ff88"/><rect x="36" y="84" width="48" height="10" rx="3" fill="url(#pg)"/><rect x="84" y="8" width="8" height="18" rx="3" fill="#39ff88"/></svg>`,
  scramble: `<svg viewBox="0 0 120 120" class="art">${G('sg', '#e3d6ff', '#7a55e0')}
    <g transform="rotate(-18 60 60)"><rect x="30" y="26" width="40" height="58" rx="7" fill="#2a2140" stroke="#b89cff" stroke-width="3"/></g>
    <g transform="rotate(14 60 60)"><rect x="50" y="34" width="40" height="58" rx="7" fill="url(#sg)" stroke="#3a2780" stroke-width="3"/></g>
    <path d="M18 70a42 42 0 0 1 64-46" stroke="#ffd23d" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M78 14l8 12-14 2z" fill="#ffd23d"/>
    <path d="M102 50a42 42 0 0 1-64 46" stroke="#39ff88" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M42 106l-8-12 14-2z" fill="#39ff88"/></svg>`,
  bribe: `<svg viewBox="0 0 120 120" class="art">${G('bg', '#bfe9ff', '#3c8fc4')}
    <path d="M14 60q24-30 60-14l22-16v60l-22-16q-36 16-60-14z" fill="url(#bg)" stroke="#1c4d6e" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="32" cy="56" r="4" fill="#1c4d6e"/><path d="M50 48q6 12 0 24M62 46q6 14 0 28" stroke="#1c4d6e" stroke-width="2.5" fill="none" opacity=".6"/>
    <circle cx="84" cy="94" r="16" fill="#ffd23d" stroke="#a87400" stroke-width="3"/><path d="M84 86v16M79 90q5-4 10 0t-10 6q5 4 10 0" stroke="#a87400" stroke-width="2.5" fill="none"/></svg>`,
  reverse: `<svg viewBox="0 0 120 120" class="art">
    <path d="M30 40a34 34 0 0 1 58 0" stroke="#ff5ea8" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M96 26l-4 24-20-10z" fill="#ff5ea8"/>
    <path d="M90 80a34 34 0 0 1-58 0" stroke="#4cc9ff" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M24 94l4-24 20 10z" fill="#4cc9ff"/>
    <path d="M42 50v22a18 18 0 0 0 36 0V50" stroke="#e6e6ef" stroke-width="10" fill="none"/><rect x="36" y="44" width="12" height="10" fill="#ff5ea8"/><rect x="72" y="44" width="12" height="10" fill="#4cc9ff"/></svg>`,
  bottom: `<svg viewBox="0 0 120 120" class="art">
    <g fill="#2b2b38" stroke="#8a8aa8" stroke-width="2.5"><rect x="26" y="20" width="68" height="14" rx="4"/><rect x="26" y="36" width="68" height="14" rx="4"/><rect x="26" y="52" width="68" height="14" rx="4"/></g>
    <rect x="26" y="68" width="68" height="14" rx="4" fill="#ffb020" stroke="#7a4b00" stroke-width="2.5"/>
    <path d="M60 4v60" stroke="#ddd" stroke-width="2"/><path d="M60 82v16a12 12 0 0 1-24 0" stroke="#e6e6ef" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M36 98l-6-8 10 2z" fill="#e6e6ef"/></svg>`,
  recal: `<svg viewBox="0 0 120 120" class="art">
    <rect x="12" y="20" width="96" height="80" rx="12" fill="#15161f" stroke="#ff5ea8" stroke-width="4"/>
    <g stroke="#4a4c63" stroke-width="5" stroke-linecap="round"><path d="M34 34v52M60 34v52M86 34v52"/></g>
    <rect x="24" y="66" width="20" height="10" rx="3" fill="#ff5ea8"/><rect x="50" y="40" width="20" height="10" rx="3" fill="#4cc9ff"/><rect x="76" y="56" width="20" height="10" rx="3" fill="#ffd23d"/></svg>`,
  target: `<svg viewBox="0 0 120 120" class="art">
    <circle cx="60" cy="62" r="44" fill="none" stroke="#ff4d6a" stroke-width="5"/><circle cx="60" cy="62" r="28" fill="none" stroke="#ff4d6a" stroke-width="4"/><circle cx="60" cy="62" r="10" fill="#ff4d6a"/>
    <g stroke="#ff4d6a" stroke-width="4"><path d="M60 8v20M60 96v20M6 62h20M94 62h20"/></g>
    <path d="M72 0L56 34h12l-6 30 22-38H72z" fill="#ffd23d" stroke="#7a4b00" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  contain: `<svg viewBox="0 0 120 120" class="art">${G('kg', '#5a6b52', '#2b3527')}
    <ellipse cx="60" cy="24" rx="32" ry="10" fill="#6d7f63" stroke="#1a2216" stroke-width="3"/>
    <path d="M28 24v70q32 18 64 0V24q-32 18-64 0z" fill="url(#kg)" stroke="#1a2216" stroke-width="3"/>
    <path d="M28 46q32 14 64 0M28 74q32 14 64 0" stroke="#1a2216" stroke-width="3" fill="none"/>
    <path d="M44 52l16-8 16 8v14l-16 8-16-8z" fill="#ffd23d" stroke="#1a2216" stroke-width="2.5"/><circle cx="60" cy="59" r="4" fill="#1a2216"/></svg>`,
});

let uid = 0;
const scope = (svg) => {
  const n = ++uid;
  return svg.replace(/id="(\w+)"/g, `id="$1_${n}"`).replace(/url\(#(\w+)\)/g, `url(#$1_${n})`);
};

export function cardArt(k) {
  if (ART[k]) return scope(ART[k]);
  const cats = { cat1: '7-1', cat2: '9-7', cat3: '3-3', cat4: '2-8', cat5: '5-4' };
  if (cats[k]) return catSvg(cats[k], k === 'cat2' ? 'happy' : 'normal', 'art');
  return '';
}
