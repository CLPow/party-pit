import { CARDS, placed, key } from './rules.js';

const gsap = window.gsap;
export const CELL = 72;
const svgCache = new Map();
const SEG = { 1: [50, 0], 2: [100, 50], 4: [50, 100], 8: [0, 50] };

(function defs() {
  if (document.getElementById('ttDefs')) return;
  const d = document.createElement('div');
  d.innerHTML = `<svg id="ttDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <radialGradient id="ttEarth" cx="40%" cy="30%" r="85%"><stop offset="0" stop-color="#5a4030"/><stop offset=".55" stop-color="#3a281c"/><stop offset="1" stop-color="#21160f"/></radialGradient>
    <linearGradient id="ttBevel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
    <linearGradient id="ttRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c79a5b"/><stop offset=".5" stop-color="#6b4626"/><stop offset="1" stop-color="#2e1d10"/></linearGradient>
    <linearGradient id="ttFloorH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c7752"/><stop offset=".5" stop-color="#e4c69c"/><stop offset="1" stop-color="#9c7752"/></linearGradient>
    <linearGradient id="ttFloorV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9c7752"/><stop offset=".5" stop-color="#e4c69c"/><stop offset="1" stop-color="#9c7752"/></linearGradient>
    <radialGradient id="ttHub" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e9cda4"/><stop offset="1" stop-color="#a8835c"/></radialGradient>
    <radialGradient id="ttLamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2c4" stop-opacity=".95"/><stop offset=".35" stop-color="#ffc94d" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a1f" stop-opacity="0"/></radialGradient>
    <radialGradient id="ttGold" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff6c8"/><stop offset=".4" stop-color="#ffd23f"/><stop offset="1" stop-color="#b87807"/></radialGradient>
    <radialGradient id="ttRock" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#a9a29a"/><stop offset=".6" stop-color="#6c665f"/><stop offset="1" stop-color="#3b3733"/></radialGradient>
    <linearGradient id="ttGem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4e3ff"/><stop offset=".45" stop-color="#b86bff"/><stop offset="1" stop-color="#5b1fa8"/></linearGradient>
    <linearGradient id="ttRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8ecf2"/><stop offset="1" stop-color="#6b7280"/></linearGradient>
    <pattern id="ttBack" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#1d1824"/><rect width="7" height="14" fill="#231d2c"/></pattern>
    <linearGradient id="ttFoil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".3" stop-color="#e0a23a"/><stop offset=".55" stop-color="#ffe08a"/><stop offset=".8" stop-color="#9a6214"/><stop offset="1" stop-color="#ffd36b"/></linearGradient>
  </defs></svg>`;
  document.body.prepend(d.firstChild);
})();

function rng(seed) {
  let h = seed;
  return () => { h = (h * 9301 + 49297) % 233280; return h / 233280; };
}

function earth(seed) {
  const r = rng(seed);
  let o = '<rect width="100" height="100" rx="8" fill="url(#ttEarth)"/>';
  for (let i = 0; i < 3; i++) {
    const y = 18 + i * 28 + r() * 10;
    o += `<path d="M0 ${y} Q25 ${y - 6 + r() * 12} 50 ${y} T100 ${y + r() * 6 - 3}" stroke="${i % 2 ? '#6a4c36' : '#2a1b12'}" stroke-width="${1.5 + r() * 2}" fill="none" opacity=".55"/>`;
  }
  for (let i = 0; i < 10; i++) o += `<ellipse cx="${(r() * 100).toFixed(1)}" cy="${(r() * 100).toFixed(1)}" rx="${(1 + r() * 2.6).toFixed(1)}" ry="${(0.8 + r() * 1.6).toFixed(1)}" fill="${r() > 0.5 ? '#7b5b43' : '#1b120c'}" opacity=".8"/>`;
  return o;
}

function stub(b, len, w = 30) {
  const [ex, ey] = SEG[b];
  return { ex, ey, x2: ex + (50 - ex) * (len / 50), y2: ey + (50 - ey) * (len / 50), w, horiz: ey === 50 };
}

function tunnel(segs, hub) {
  let o = '';
  const cap = hub ? 'round' : 'butt';
  for (const s of segs) o += `<line x1="${s.ex}" y1="${s.ey}" x2="${s.x2}" y2="${s.y2}" stroke="#1a110b" stroke-width="${s.w + 12}" stroke-linecap="${cap}" opacity=".85"/>`;
  if (hub) o += `<circle cx="50" cy="50" r="${(segs[0].w + 12) / 2}" fill="#1a110b" opacity=".85"/>`;
  for (const s of segs) o += `<line x1="${s.ex}" y1="${s.ey}" x2="${s.x2}" y2="${s.y2}" stroke="#7a5a3c" stroke-width="${s.w + 4}" stroke-linecap="${cap}"/>`;
  if (hub) o += `<circle cx="50" cy="50" r="${(segs[0].w + 4) / 2}" fill="#7a5a3c"/>`;
  for (const s of segs) o += `<line x1="${s.ex}" y1="${s.ey}" x2="${s.x2}" y2="${s.y2}" stroke="url(#${s.horiz ? 'ttFloorH' : 'ttFloorV'})" stroke-width="${s.w}" stroke-linecap="${cap}"/>`;
  if (hub) o += `<circle cx="50" cy="50" r="${segs[0].w / 2}" fill="url(#ttHub)"/>`;
  for (const s of segs) {
    for (let t = 0.1; t < 1; t += 0.22) {
      const x = s.ex + (s.x2 - s.ex) * t, y = s.ey + (s.y2 - s.ey) * t;
      o += s.horiz ? `<rect x="${(x - 2.2).toFixed(1)}" y="${y - 11}" width="4.4" height="22" rx="1.2" fill="#5b3a20" stroke="#2e1c0e" stroke-width=".6"/>` : `<rect x="${x - 11}" y="${(y - 2.2).toFixed(1)}" width="22" height="4.4" rx="1.2" fill="#5b3a20" stroke="#2e1c0e" stroke-width=".6"/>`;
    }
    const off = 6.5;
    const rail = (dx, dy) => `<line x1="${s.ex + dx}" y1="${s.ey + dy}" x2="${s.x2 + dx}" y2="${s.y2 + dy}" stroke="#3b3f46" stroke-width="3.2"/><line x1="${s.ex + dx}" y1="${s.ey + dy}" x2="${s.x2 + dx}" y2="${s.y2 + dy}" stroke="url(#ttRail)" stroke-width="1.8"/>`;
    o += s.horiz ? rail(0, -off) + rail(0, off) : rail(-off, 0) + rail(off, 0);
  }
  return o;
}

const boulder = (x, y, r = 9) => `<g><ellipse cx="${x + 1.5}" cy="${y + r * 0.7}" rx="${r}" ry="${r * 0.35}" fill="#000" opacity=".35"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#ttRock)"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.4}" rx="${r * 0.35}" ry="${r * 0.22}" fill="#d6d0c8" opacity=".55"/></g>`;
const gem = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><polygon points="0,-12 9,-3 5,11 -5,11 -9,-3" fill="url(#ttGem)" stroke="#f8eaff" stroke-width="1.2"/><polygon points="0,-12 3,-3 0,11 -3,-3" fill="#fff" opacity=".45"/><circle cx="-3" cy="-6" r="1.6" fill="#fff"/></g>`;
const nugget = (x, y, r) => `<g><ellipse cx="${x + 1}" cy="${y + r * 0.6}" rx="${r}" ry="${r * 0.3}" fill="#000" opacity=".35"/><path d="M${x - r} ${y} Q${x - r * 0.8} ${y - r * 0.9} ${x} ${y - r * 0.8} Q${x + r} ${y - r * 0.7} ${x + r} ${y + r * 0.1} Q${x + r * 0.5} ${y + r * 0.75} ${x - r * 0.3} ${y + r * 0.6} Q${x - r * 1.05} ${y + r * 0.4} ${x - r} ${y}Z" fill="url(#ttGold)" stroke="#8a5a05" stroke-width=".8"/><ellipse cx="${x - r * 0.3}" cy="${y - r * 0.35}" rx="${r * 0.3}" ry="${r * 0.16}" fill="#fff" opacity=".8"/></g>`;
const lamp = '<g class="lamp"><circle cx="50" cy="50" r="30" fill="url(#ttLamp)"/><circle cx="50" cy="50" r="3.2" fill="#fff6d6"/></g>';

function frame(inner) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}<rect width="100" height="100" rx="8" fill="url(#ttBevel)"/><rect x="1.2" y="1.2" width="97.6" height="97.6" rx="7.4" fill="none" stroke="url(#ttRim)" stroke-width="2.4"/>${[[6, 6], [94, 6], [6, 94], [94, 94]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.9" fill="#d7b27a" stroke="#3a2514" stroke-width=".6"/>`).join('')}</svg>`;
}

export function tileSvg(k, r = 0) {
  const id = k + ':' + r;
  if (svgCache.has(id)) return svgCache.get(id);
  const seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 233280;
  let out = '';
  if (k === 'start') {
    const segs = [1, 2, 4, 8].map((b) => stub(b, 50));
    out = frame(earth(seed) + tunnel(segs, true) + `<circle cx="50" cy="52" r="34" fill="url(#ttLamp)"/>
      <path d="M26 74 V38 Q50 12 74 38 V74" fill="none" stroke="#2e1c0e" stroke-width="11"/>
      <path d="M26 74 V38 Q50 12 74 38 V74" fill="none" stroke="#8a5a30" stroke-width="7"/>
      <path d="M28 38 Q50 15 72 38" fill="none" stroke="#c98d4c" stroke-width="2.2"/>
      <rect x="44" y="26" width="12" height="8" rx="1.5" fill="#2e1c0e"/><text x="50" y="32.5" text-anchor="middle" font-size="6" fill="#ffd36b" font-weight="900">IN</text>
      <circle cx="50" cy="52" r="5" fill="#fff6d6"/><circle cx="50" cy="52" r="9" fill="none" stroke="#ffd36b" stroke-width="1.2" opacity=".7"/>`);
  } else if (k === 'back') {
    out = `<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="8" fill="url(#ttBack)"/><rect x="5" y="5" width="90" height="90" rx="6" fill="none" stroke="url(#ttFoil)" stroke-width="2.2"/><rect x="10" y="10" width="80" height="80" rx="4" fill="none" stroke="#e0a23a" stroke-width=".8" stroke-dasharray="2 3" opacity=".7"/>
      <path d="M50 20 L76 50 L50 80 L24 50 Z" fill="#14101a" stroke="url(#ttFoil)" stroke-width="2.6"/><path d="M50 28 L68 50 L50 72 L32 50 Z" fill="none" stroke="#e0a23a" stroke-width=".8" opacity=".6"/>
      <text x="50" y="60" text-anchor="middle" font-size="28" font-weight="900" fill="url(#ttFoil)" font-family="Cinzel, Georgia, serif">?</text>
      <rect width="100" height="100" rx="8" fill="url(#ttBevel)"/></svg>`;
  } else if (k === 'gold' || k === 'rockL' || k === 'rockR') {
    const mask = k === 'gold' ? 15 : k === 'rockL' ? 9 : 12;
    const m = r ? ((mask << 2) | (mask >> 2)) & 15 : mask;
    const segs = [1, 2, 4, 8].filter((b) => m & b).map((b) => stub(b, 50));
    if (k === 'gold') {
      out = frame(earth(seed) + tunnel(segs, true) + '<circle cx="50" cy="50" r="40" fill="url(#ttLamp)"/>' + nugget(40, 56, 12) + nugget(60, 52, 10) + nugget(50, 40, 9) + nugget(64, 66, 6) + nugget(33, 42, 5)
        + '<g fill="#fff"><path d="M24 26 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z"/><path d="M76 72 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1z"/></g>');
    } else {
      out = frame(earth(seed) + tunnel(segs, true) + boulder(44, 52, 11) + boulder(59, 44, 7) + boulder(55, 61, 6) + '<circle cx="36" cy="40" r="4.5" fill="#1b1b1b"/><circle cx="64" cy="58" r="3.8" fill="#151515"/>');
    }
  } else {
    const c = CARDS[k];
    const { mask, groups } = placed(k, r);
    let inner = earth(seed);
    if (c.bridge) {
      inner += tunnel([1, 2, 4, 8].filter((x) => groups[0] & x).map((x) => stub(x, 50)), false);
      inner += '<rect x="0" y="31" width="100" height="38" fill="#000" opacity=".4"/><rect x="0" y="34" width="100" height="30" fill="#7a4e2a"/>';
      for (let x = 2; x < 100; x += 11) inner += `<rect x="${x}" y="34" width="8.5" height="30" fill="#a8743f" stroke="#5d3a1e" stroke-width=".8"/>`;
      inner += '<line x1="0" y1="35" x2="100" y2="35" stroke="#3a2412" stroke-width="3"/><line x1="0" y1="63" x2="100" y2="63" stroke="#3a2412" stroke-width="3"/>';
    } else if (c.dead) {
      inner += tunnel([1, 2, 4, 8].filter((b) => mask & b).map((b) => stub(b, 30)), false);
      inner += boulder(50, 50, 15) + boulder(38, 40, 7) + boulder(62, 60, 8) + boulder(60, 38, 5) + boulder(40, 62, 5);
    } else {
      inner += tunnel([1, 2, 4, 8].filter((b) => mask & b).map((b) => stub(b, 50)), true);
      if (mask === 15 || [7, 14, 13, 11].includes(mask)) inner += lamp;
    }
    if (c.crystal) inner += gem(r ? 82 : 18, r ? 80 : 20, 1) + gem(r ? 70 : 30, r ? 88 : 12, 0.55) + gem(r ? 88 : 12, r ? 66 : 34, 0.45);
    if (c.door) {
      const col = c.door === 'a' ? ['#ffd27a', '#f59e0b', '#8a4b06'] : ['#9cc3ff', '#3b82f6', '#1e3a8a'];
      inner += `<rect x="36" y="27" width="28" height="46" rx="5" fill="#1b1410"/><rect x="38" y="29" width="24" height="42" rx="4" fill="${col[1]}" stroke="${col[2]}" stroke-width="2"/><rect x="41" y="32" width="18" height="16" rx="2" fill="${col[0]}" opacity=".6"/><rect x="41" y="51" width="18" height="16" rx="2" fill="${col[2]}" opacity=".35"/><circle cx="57" cy="50" r="2.6" fill="#fff4d0" stroke="#1b1410" stroke-width=".8"/>`;
    }
    if (c.ladder) {
      inner += '<rect x="34" y="18" width="32" height="64" rx="4" fill="#000" opacity=".3"/><g stroke="#3a2412" stroke-width="6.5" stroke-linecap="round"><line x1="40" y1="20" x2="40" y2="80"/><line x1="60" y1="20" x2="60" y2="80"/></g><g stroke="#c08a50" stroke-width="4" stroke-linecap="round"><line x1="40" y1="20" x2="40" y2="80"/><line x1="60" y1="20" x2="60" y2="80"/></g><g stroke="#e0ab6c" stroke-width="3.2">' + [28, 40, 52, 64, 74].map((y) => `<line x1="40" y1="${y}" x2="60" y2="${y}"/>`).join('') + '</g>';
    }
    out = frame(inner);
  }
  svgCache.set(id, out);
  return out;
}

const ACT_ART = {
  'brk-d': ['⛏️', 'break'], 'brk-l': ['🔦', 'break'], 'brk-c': ['🛒', 'break'],
  'fix-d': ['⛏️', 'fix'], 'fix-l': ['🔦', 'fix'], 'fix-c': ['🛒', 'fix'], 'fix-dl': ['⛏️🔦', 'fix'], 'fix-lc': ['🔦🛒', 'fix'], 'fix-dc': ['⛏️🛒', 'fix'],
  cave: ['🪨', 'cave'], survey: ['🔍', 'peek'], pick: ['🫳', 'trick'], handsoff: ['🙅', 'trick'], shack: ['⛓️', 'trick'], free: ['✂️', 'trick'],
  interro: ['🕵️', 'trick'], badge: ['🎭', 'trick'], hswap: ['🔄', 'trick'], flood: ['🌊', 'hazard'], pump: ['🚰', 'hazard'], bats: ['🦇', 'hazard'], dyn: ['🧨', 'hazard'],
};

export function actionArt(k) {
  const [icon, tone] = ACT_ART[k] || ['❔', 'trick'];
  return { icon, tone };
}

const calm = () => document.body.classList.contains('calm');

export class Board {
  constructor(el, { onCell, onGoal, onHover }) {
    this.el = el;
    this.plane = document.createElement('div');
    this.plane.className = 'plane';
    this.world = document.createElement('div');
    this.world.className = 'world';
    this.bg = document.createElement('div');
    this.bg.className = 'world-bg';
    this.world.append(this.bg);
    this.hlLayer = document.createElement('div');
    this.hlLayer.className = 'hl-layer';
    this.ghost = document.createElement('div');
    this.ghost.className = 'tile preview';
    this.ghost.hidden = true;
    this.probe = document.createElement('div');
    this.probe.className = 'probe';
    this.world.append(this.hlLayer, this.ghost, this.probe);
    this.plane.append(this.world);
    this.light = document.createElement('div');
    this.light.className = 'lantern';
    this.dust = document.createElement('canvas');
    this.dust.className = 'dust';
    el.append(this.plane, this.light, this.dust);
    this.tiles = new Map();
    this.goalEls = [];
    this.floods = new Map();
    this.view = { x: 0, y: 0, s: 1 };
    this.onCell = onCell;
    this.onGoal = onGoal;
    this.onHover = onHover;
    this.bounds = null;
    this.lastUser = 0;
    this.pointers = new Map();
    this.bind();
    this.startDust();
  }

  px(x) { return (x - this.bounds.x0) * CELL; }
  py(y) { return (y - this.bounds.y0) * CELL; }

  apply(animate = false) {
    const { x, y, s } = this.view;
    if (animate && gsap && !calm()) gsap.to(this.world, { x, y, scale: s, duration: 0.6, ease: 'power2.inOut' });
    else if (gsap) gsap.set(this.world, { x, y, scale: s });
    else this.world.style.transform = `translate(${x}px,${y}px) scale(${s})`;
  }

  setLight(cx, cy) {
    const r = this.el.getBoundingClientRect();
    this.el.style.setProperty('--lx', ((cx - r.left) / r.width * 100).toFixed(1) + '%');
    this.el.style.setProperty('--ly', ((cy - r.top) / r.height * 100).toFixed(1) + '%');
  }

  bind() {
    const el = this.el;
    let drag = null;
    let pinch = null;
    el.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, moved: 0, target: e.target, type: e.pointerType };
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.view.s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: this.view.x, vy: this.view.y };
        drag = null;
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this.setLight(e.clientX, e.clientY);
      if (!this.pointers.has(e.pointerId)) {
        if (e.pointerType === 'mouse' && this.onHover) {
          const hl = e.target.closest?.('.hl');
          this.onHover(hl && !hl.dataset.goal ? [Number(hl.dataset.x), Number(hl.dataset.y)] : null);
        }
        return;
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = this.el.getBoundingClientRect();
        const ns = Math.max(0.25, Math.min(2.5, pinch.s * d / pinch.d));
        const cx = pinch.cx - r.left, cy = pinch.cy - r.top;
        this.view.s = ns;
        this.view.x = cx - (cx - pinch.vx) * (ns / pinch.s) + ((a.x + b.x) / 2 - pinch.cx);
        this.view.y = cy - (cy - pinch.vy) * (ns / pinch.s) + ((a.y + b.y) / 2 - pinch.cy);
        this.lastUser = Date.now();
        this.apply();
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      if (drag.moved > 8) {
        if (!el.classList.contains('dragging')) el.setPointerCapture?.(e.pointerId);
        this.view.x = drag.vx + dx;
        this.view.y = drag.vy + dy;
        this.lastUser = Date.now();
        this.apply();
        el.classList.add('dragging');
      }
    });
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) pinch = null;
      el.classList.remove('dragging');
      if (drag && drag.moved <= 8 && this.pointers.size === 0 && e.type === 'pointerup') {
        const hl = drag.target.closest?.('.hl');
        if (hl) {
          if (hl.dataset.goal) this.onGoal?.(Number(hl.dataset.goal));
          else this.onCell?.(Number(hl.dataset.x), Number(hl.dataset.y), drag.type);
        }
      }
      if (this.pointers.size === 0) drag = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.onHover?.(null); });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const ns = Math.max(0.25, Math.min(2.5, this.view.s * Math.exp(-e.deltaY * 0.0015)));
      this.view.x = cx - (cx - this.view.x) * (ns / this.view.s);
      this.view.y = cy - (cy - this.view.y) * (ns / this.view.s);
      this.view.s = ns;
      this.lastUser = Date.now();
      this.apply();
    }, { passive: false });
  }

  startDust() {
    const cv = this.dust;
    const g = cv.getContext('2d');
    const motes = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, vx: (Math.random() - 0.5) * 0.00018, vy: -0.00005 - Math.random() * 0.00016, a: 0.15 + Math.random() * 0.45, p: Math.random() * 6 }));
    let idle = false;
    const tick = () => {
      if (calm() || document.body.classList.contains('lite') || document.hidden || !this.el.offsetParent) {
        if (!idle) { g.clearRect(0, 0, cv.width, cv.height); idle = true; }
        setTimeout(() => requestAnimationFrame(tick), 1000);
        return;
      }
      idle = false;
      requestAnimationFrame(tick);
      const w = this.el.clientWidth, h = this.el.clientHeight;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      g.clearRect(0, 0, w, h);
      const t = performance.now() / 1000;
      for (const m of motes) {
        m.x += m.vx; m.y += m.vy;
        if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
        if (m.x < -0.02) m.x = 1.02; if (m.x > 1.02) m.x = -0.02;
        g.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t * 1.3 + m.p));
        g.fillStyle = '#ffd9a0';
        g.beginPath();
        g.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    };
    requestAnimationFrame(tick);
  }

  zoom(f) {
    const r = this.el.getBoundingClientRect();
    const cx = r.width / 2, cy = r.height / 2;
    const ns = Math.max(0.25, Math.min(2.5, this.view.s * f));
    this.view.x = cx - (cx - this.view.x) * (ns / this.view.s);
    this.view.y = cy - (cy - this.view.y) * (ns / this.view.s);
    this.view.s = ns;
    this.lastUser = Date.now();
    this.apply(true);
  }

  fit(animate = true, pts = null) {
    if (!this.bounds) return;
    const all = pts || [...this.tiles.keys()].map((k) => k.split(',').map(Number)).concat(this.goalPts || []);
    if (!all.length) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const pad = window.matchMedia('(max-width: 820px)').matches ? 0.3 : 0.8;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const tb = document.getElementById('turnBar');
    const top = tb && !tb.classList.contains('idle') ? Math.max(0, Math.min(r.height * 0.4, tb.getBoundingClientRect().bottom - r.top + 4)) : 0;
    const avail = r.height - top;
    const w = (x1 - x0 + 1) * CELL, h = (y1 - y0 + 1) * CELL;
    const s = Math.max(0.25, Math.min(1.5, Math.min(r.width / w, (avail * 0.94) / h)));
    this.view.s = s;
    this.view.x = (r.width - w * s) / 2 - this.px(x0) * s;
    this.view.y = top + (avail - h * s) / 2 - this.py(y0) * s;
    this.apply(animate);
  }

  ensureVisible(x, y) {
    if (Date.now() - this.lastUser < 8000) return;
    const c = this.screenOf(x, y);
    const r = this.el.getBoundingClientRect();
    const pad = c.size;
    if (c.x > r.left + pad && c.x < r.right - pad && c.y > r.top + pad && c.y < r.bottom - pad) return;
    this.fit(true);
  }

  screenOf(x, y) {
    if (!this.bounds) return null;
    this.probe.style.left = this.px(x) + 'px';
    this.probe.style.top = this.py(y) + 'px';
    const r = this.probe.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width };
  }

  reset(bounds) {
    this.bounds = bounds;
    for (const el of this.tiles.values()) el.remove();
    for (const el of this.goalEls) el.remove();
    for (const el of this.floods.values()) el.remove();
    this.tiles.clear();
    this.floods.clear();
    this.goalEls = [];
    this.goalPts = [];
    this.world.style.width = (bounds.x1 - bounds.x0 + 1) * CELL + 'px';
    this.world.style.height = (bounds.y1 - bounds.y0 + 1) * CELL + 'px';
  }

  tileEl(k, r, x, y, cls = '') {
    const d = document.createElement('div');
    d.className = 'tile ' + cls;
    d.style.left = this.px(x) + 'px';
    d.style.top = this.py(y) + 'px';
    d.innerHTML = tileSvg(k, r);
    return d;
  }

  render(pub, priv, { animate = true, lit = null, claims = [] } = {}) {
    if (!pub.bounds) return [];
    const b = pub.bounds;
    if (!this.bounds || this.roundId !== pub.roundId || this.bounds.y0 !== b.y0) {
      this.roundId = pub.roundId;
      this.reset(b);
      animate = false;
      this.needFit = true;
    }
    const seen = new Set();
    const added = [];
    for (const [kk, k, r] of pub.board) {
      seen.add(kk);
      const old = this.tiles.get(kk);
      if (old && old.dataset.k === k + r) continue;
      if (old) old.remove();
      const [x, y] = kk.split(',').map(Number);
      const el = this.tileEl(k, r, x, y, k === 'start' ? 'start lit' : '');
      el.dataset.k = k + r;
      this.world.insertBefore(el, this.hlLayer);
      this.tiles.set(kk, el);
      if (animate) added.push([el, x, y]);
    }
    for (const [kk, el] of this.tiles) {
      if (seen.has(kk)) continue;
      this.tiles.delete(kk);
      if (animate && gsap && !calm()) gsap.to(el, { scale: 0.2, rotation: (Math.random() - 0.5) * 80, opacity: 0, y: 20, duration: 0.55, ease: 'power2.in', onComplete: () => el.remove() });
      else el.remove();
    }
    if (lit) for (const [kk, el] of this.tiles) el.classList.toggle('lit', lit.has(kk) || kk === '0,0');
    this.goalPts = pub.goals.map((g) => [g.x, g.y]);
    pub.goals.forEach((g, i) => {
      let el = this.goalEls[i];
      const peek = priv?.peeks?.[i];
      if (!el) {
        el = document.createElement('div');
        el.className = 'tile goal';
        el.style.left = this.px(g.x) + 'px';
        el.style.top = this.py(g.y) + 'px';
        this.world.insertBefore(el, this.hlLayer);
        this.goalEls[i] = el;
      }
      const mine = claims.filter((c) => c.goal === i && c.says);
      const cg = mine.filter((c) => c.says === 'gold').length, cr = mine.length - cg, lies = mine.filter((c) => c.lie).length;
      const sig = (g.open ? `${g.kind}:${g.mask}` : 'back') + ':' + peek + ':' + cg + ':' + cr + ':' + lies;
      if (el.dataset.s === sig) return;
      const wasBack = el.dataset.s && el.dataset.s.startsWith('back');
      el.dataset.s = sig;
      const base = g.kind === 'gold' ? 15 : g.kind === 'rockL' ? 9 : 12;
      const art = g.open ? tileSvg(g.kind, g.mask === base ? 0 : 1) : tileSvg('back');
      const tally = mine.length ? `<span class="claims">${cg ? `<b class="cg">💰${cg}</b>` : ''}${cr ? `<b class="cr">🪨${cr}</b>` : ''}${lies ? `<b class="cl">🤥${lies}</b>` : ''}</span>` : '';
      el.innerHTML = art + (!g.open && peek !== undefined ? `<span class="peek ${peek ? 'yes' : 'no'}">${peek ? '💰' : '🪨'}</span>` : '') + `<span class="gnum">${i + 1}</span>` + tally;
      el.classList.toggle('gold', g.open && g.kind === 'gold');
      el.classList.toggle('open', !!g.open);
      if (g.open && wasBack && animate && gsap && !calm()) gsap.fromTo(el, { rotationY: -180, scale: 1.4, z: 60 }, { rotationY: 0, scale: 1, z: 0, duration: 0.9, ease: 'back.out(1.6)' });
    });
    const fl = new Set(pub.flood);
    for (const f of fl) {
      if (this.floods.has(f)) continue;
      const [x, y] = f.split(',').map(Number);
      const d = document.createElement('div');
      d.className = 'flood';
      d.style.left = this.px(x) + 'px';
      d.style.top = this.py(y) + 'px';
      d.innerHTML = '<i></i><i></i><span>🌊</span>';
      this.world.insertBefore(d, this.hlLayer);
      this.floods.set(f, d);
      if (animate && gsap) gsap.from(d, { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2)' });
    }
    for (const [f, d] of this.floods) {
      if (fl.has(f)) continue;
      this.floods.delete(f);
      if (gsap) gsap.to(d, { scale: 0, opacity: 0, duration: 0.4, onComplete: () => d.remove() });
      else d.remove();
    }
    if (this.needFit) {
      const r = this.el.getBoundingClientRect();
      if (r.width) { this.needFit = false; this.fit(false, [[0, 0], ...this.goalPts]); }
    }
    return added;
  }

  dropIn(el) {
    if (!gsap || calm()) return;
    gsap.fromTo(el, { scale: 1.9, opacity: 0, y: -40, rotation: (Math.random() - 0.5) * 24 }, { scale: 1, opacity: 1, y: 0, rotation: 0, duration: 0.55, ease: 'bounce.out' });
  }

  preview(k, r, x, y, ok = true) {
    if (k == null) { this.ghost.hidden = true; this.ghost.dataset.at = ''; return; }
    const at = `${k}:${r}:${x},${y}`;
    if (this.ghost.dataset.at === at && !this.ghost.hidden) return;
    const fresh = this.ghost.hidden || this.ghost.dataset.k !== k + r;
    this.ghost.dataset.at = at;
    this.ghost.dataset.k = k + r;
    if (fresh) this.ghost.innerHTML = tileSvg(k, r);
    this.ghost.classList.toggle('bad', !ok);
    this.ghost.style.left = this.px(x) + 'px';
    this.ghost.style.top = this.py(y) + 'px';
    this.ghost.hidden = false;
    if (gsap && !calm()) gsap.fromTo(this.ghost, { scale: 1.15 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
  }

  highlight(cells, kind = 'place', goals = []) {
    this.hlLayer.innerHTML = '';
    if (!this.bounds) return;
    const frag = document.createDocumentFragment();
    for (const [x, y] of cells) {
      const d = document.createElement('div');
      d.className = 'hl ' + kind;
      d.dataset.x = x;
      d.dataset.y = y;
      d.style.left = this.px(x) + 'px';
      d.style.top = this.py(y) + 'px';
      frag.append(d);
    }
    for (const gi of goals) {
      const g = this.goalPts[gi];
      if (!g) continue;
      const d = document.createElement('div');
      d.className = 'hl peek';
      d.dataset.goal = gi;
      d.style.left = this.px(g[0]) + 'px';
      d.style.top = this.py(g[1]) + 'px';
      frag.append(d);
    }
    this.hlLayer.append(frag);
  }

  tileAt(x, y) { return this.tiles.get(key(x, y)); }
}
