import { dprCap, particleScale, onQuality } from './quality.js';
let actx = null;
let sfxBus = null;
let noiseBuf = null;
let sfxVol = 0.9;
let sfxHook = null;
try {
  const v = localStorage.getItem('mow-sfx');
  if (v !== null) sfxVol = Math.max(0, Math.min(1, Number(v)));
} catch { /* storage unavailable */ }

export const isMuted = () => sfxVol === 0;
export function setMuted(m) { setSfxVolume(m ? 0 : 0.9); }
export const getSfxVolume = () => sfxVol;
export function setSfxVolume(v) {
  sfxVol = Math.max(0, Math.min(1, v));
  try { localStorage.setItem('mow-sfx', String(sfxVol)); } catch { /* storage unavailable */ }
  if (sfxBus) sfxBus.gain.value = sfxVol;
}
export const onSfx = (fn) => { sfxHook = fn; };
export const calm = () => document.body.classList.contains('calm');

function ctx() {
  if (!actx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    actx = new C();
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    sfxBus = actx.createGain();
    sfxBus.gain.value = sfxVol;
    sfxBus.connect(comp).connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  lastUse = performance.now();
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}

let lastUse = 0;
const holds = new Set();
export function holdAudio(key, on) {
  if (on) { holds.add(key); ctx(); } else holds.delete(key);
}
setInterval(() => {
  if (!actx || actx.state !== 'running' || holds.size) return;
  if (document.hidden || performance.now() - lastUse > 10000) actx.suspend().catch(() => {});
}, 3000);
document.addEventListener('pointerdown', () => { if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); }, { passive: true });
export const unlockAudio = () => ctx();
export const audioCtx = () => ctx();

function tone(freq, dur = 0.12, { type = 'sine', vol = 0.12, when = 0, slide = 0, attack = 0.008 } = {}) {
  if (!sfxVol) return;
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
  if (sfxHook) sfxHook(vol);
}

function noise(dur = 0.1, { vol = 0.1, when = 0, type = 'highpass', f = 1800, f2 = 0, q = 0.8, attack = 0.004 } = {}) {
  if (!sfxVol) return;
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + when;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const fl = a.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  fl.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl).connect(g).connect(sfxBus);
  src.start(t, Math.random() * 1.2, dur + 0.05);
  if (sfxHook) sfxHook(vol);
}

export const sfx = {
  unlock: () => ctx(),
  click: () => { noise(0.012, { vol: 0.25, f: 3000, type: 'bandpass', q: 2 }); },
  select: () => tone(720, 0.06, { type: 'triangle', vol: 0.07 }),
  deselect: () => tone(480, 0.06, { type: 'triangle', vol: 0.05 }),
  card: () => { noise(0.07, { vol: 0.09, f: 2500, f2: 800, type: 'bandpass', q: 1.2 }); },
  flip: () => { noise(0.05, { vol: 0.1, f: 4000, type: 'highpass' }); tone(620, 0.05, { type: 'triangle', vol: 0.04, when: 0.02 }); },
  deal: () => { for (let i = 0; i < 6; i++) noise(0.04, { vol: 0.06, f: 3000, type: 'bandpass', when: i * 0.06 }); },
  draw: () => { noise(0.09, { vol: 0.08, f: 1200, f2: 3500, type: 'bandpass' }); tone(330, 0.1, { type: 'sine', vol: 0.05, slide: 200, when: 0.05 }); },
  safe: () => { tone(660, 0.1, { type: 'sine', vol: 0.06 }); tone(990, 0.16, { type: 'sine', vol: 0.05, when: 0.08 }); },
  pop: () => tone(900, 0.07, { vol: 0.06, slide: 400 }),
  play: () => { noise(0.1, { vol: 0.12, f: 900, f2: 3000, type: 'bandpass' }); tone(240, 0.12, { type: 'square', vol: 0.03, slide: 300 }); },
  hiss: () => {
    noise(0.55, { vol: 0.35, f: 3200, f2: 5200, type: 'bandpass', q: 1.5, attack: 0.03 });
    noise(0.4, { vol: 0.12, f: 7000, type: 'highpass', when: 0.05 });
    tone(180, 0.18, { type: 'sawtooth', vol: 0.05, slide: -60 });
  },
  stamp: () => { tone(90, 0.2, { type: 'sine', vol: 0.4, slide: -40 }); noise(0.08, { vol: 0.25, f: 600, type: 'lowpass' }); },
  zap: () => {
    for (let i = 0; i < 5; i++) tone(1400 - i * 180, 0.05, { type: 'sawtooth', vol: 0.05, when: i * 0.035, slide: -600 });
    noise(0.35, { vol: 0.2, f: 5000, f2: 900, type: 'bandpass', q: 0.6 });
    tone(60, 0.4, { type: 'sine', vol: 0.25, slide: -20, when: 0.05 });
  },
  nap: () => { tone(392, 0.3, { vol: 0.05 }); tone(330, 0.4, { vol: 0.05, when: 0.25 }); tone(262, 0.6, { vol: 0.05, when: 0.5 }); },
  shuffle: () => { for (let i = 0; i < 16; i++) noise(0.025, { vol: 0.07, f: 2500 + Math.random() * 2000, type: 'bandpass', q: 2, when: i * 0.04 }); },
  peek: () => { tone(1200, 0.06, { type: 'square', vol: 0.03 }); tone(1600, 0.06, { type: 'square', vol: 0.03, when: 0.09 }); noise(0.4, { vol: 0.03, f: 6000, type: 'highpass', when: 0.1 }); },
  steal: () => { noise(0.22, { vol: 0.12, f: 600, f2: 4000, type: 'bandpass', q: 1 }); tone(500, 0.12, { vol: 0.04, slide: 500, when: 0.12 }); },
  reverse: () => { tone(300, 0.35, { type: 'triangle', vol: 0.07, slide: 600 }); tone(900, 0.35, { type: 'triangle', vol: 0.05, slide: -600, when: 0.2 }); },
  geiger: (n = 1) => { for (let i = 0; i < n; i++) noise(0.006, { vol: 0.35, f: 2800 + Math.random() * 1500, type: 'bandpass', q: 3, when: Math.random() * 0.08 }); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone(880, 0.18, { type: 'square', vol: 0.05, when: i * 0.36 }); tone(660, 0.18, { type: 'square', vol: 0.05, when: i * 0.36 + 0.18 }); } },
  klaxon: () => { for (let i = 0; i < 4; i++) tone(220, 0.32, { type: 'sawtooth', vol: 0.09, slide: 220, when: i * 0.4 }); },
  riser: (dur = 2.4) => {
    noise(dur, { vol: 0.12, f: 300, f2: 6000, type: 'bandpass', q: 2, attack: dur * 0.9 });
    tone(80, dur, { type: 'sawtooth', vol: 0.04, slide: 400, attack: dur * 0.9 });
  },
  freeze: () => {
    noise(1.2, { vol: 0.35, f: 9000, f2: 2500, type: 'highpass', attack: 0.01 });
    noise(0.8, { vol: 0.15, f: 1500, f2: 400, type: 'bandpass', q: 0.7, when: 0.05 });
    [2093, 2637, 3136, 3951, 4699].forEach((f, i) => tone(f, 0.9, { type: 'sine', vol: 0.035, when: 0.12 + i * 0.07 }));
    tone(1046, 1.4, { type: 'triangle', vol: 0.03, when: 0.4 });
  },
  shimmer: () => { [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.4, { type: 'sine', vol: 0.03, when: i * 0.05 })); noise(0.3, { vol: 0.06, f: 8000, type: 'highpass' }); },
  boom: (big = false) => {
    const k = big ? 1.4 : 1;
    tone(110, 1.6 * k, { type: 'sine', vol: 0.8, slide: -85, attack: 0.004 });
    tone(55, 2.2 * k, { type: 'sine', vol: 0.6, slide: -30, attack: 0.01 });
    noise(2.4 * k, { vol: 0.9, f: 2600, f2: 80, type: 'lowpass', q: 0.5, attack: 0.003 });
    noise(0.25, { vol: 0.5, f: 4000, type: 'highpass' });
    for (let i = 0; i < 18; i++) noise(0.03, { vol: 0.12, f: 2000 + Math.random() * 3000, type: 'bandpass', q: 3, when: 0.25 + Math.random() * 1.6 });
  },
  implode: () => {
    noise(1.1, { vol: 0.4, f: 200, f2: 5000, type: 'bandpass', q: 1.5, attack: 1.0 });
    tone(40, 1.1, { type: 'sawtooth', vol: 0.12, slide: 300, attack: 1.0 });
  },
  tick: () => tone(1250, 0.03, { type: 'square', vol: 0.03 }),
  turn: () => { tone(523, 0.12, { type: 'triangle', vol: 0.07 }); tone(784, 0.18, { type: 'triangle', vol: 0.07, when: 0.1 }); },
  chat: () => tone(760, 0.05, { vol: 0.05 }),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.05, when: i * 0.12 })),
  lose: () => { tone(330, 0.25, { type: 'sawtooth', vol: 0.05 }); tone(247, 0.4, { type: 'sawtooth', vol: 0.05, when: 0.2 }); },
};

let geigerTimer = null;
let geigerRate = 0;
export function geiger(rate) {
  geigerRate = rate;
  if (rate <= 0) { clearTimeout(geigerTimer); geigerTimer = null; return; }
  if (geigerTimer) return;
  const step = () => {
    if (geigerRate <= 0) { geigerTimer = null; return; }
    sfx.geiger(1 + Math.floor(Math.random() * Math.min(3, geigerRate / 6)));
    geigerTimer = setTimeout(step, Math.max(25, (1000 / geigerRate) * (0.4 + Math.random() * 1.2)));
  };
  step();
}

export function buzz(ms = 15) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* not supported */ }
}

let cv = null;
let g2 = null;
let parts = [];
let rings = [];
let bolts = [];
let running = false;
let dpr = 1;

function canvas() {
  if (cv) return cv;
  cv = document.getElementById('fxCanvas');
  g2 = cv.getContext('2d');
  const fit = () => {
    dpr = Math.min(dprCap(), window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
  };
  fit();
  addEventListener('resize', fit);
  onQuality(fit);
  return cv;
}

const smokeSprite = (() => {
  let c = null;
  return () => {
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.55)');
    gr.addColorStop(0.5, 'rgba(255,255,255,.22)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    return c;
  };
})();

function tinted(color) {
  const key = '_t' + color;
  if (smokeSprite[key]) return smokeSprite[key];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.drawImage(smokeSprite(), 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, 128, 128);
  smokeSprite[key] = c;
  return c;
}

function loop() {
  canvas();
  const W = cv.width;
  const H = cv.height;
  g2.setTransform(1, 0, 0, 1, 0, 0);
  g2.clearRect(0, 0, W, H);
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const r of rings) {
    r.t++;
    const k = r.t / r.life;
    const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) ** 3);
    g2.globalCompositeOperation = 'lighter';
    g2.strokeStyle = r.color;
    g2.globalAlpha = Math.max(0, 1 - k) * r.alpha;
    g2.lineWidth = r.w * (1 - k) + 1;
    g2.beginPath();
    g2.arc(r.x, r.y, rad, 0, Math.PI * 2);
    g2.stroke();
    if (r.fill) {
      const gr = g2.createRadialGradient(r.x, r.y, 0, r.x, r.y, rad);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.85, r.fill);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g2.fillStyle = gr;
      g2.globalAlpha = Math.max(0, 1 - k) * 0.5;
      g2.fill();
    }
  }
  rings = rings.filter((r) => r.t < r.life);
  for (const b of bolts) {
    b.t++;
    if (b.t % 3 === 1) b.pts = jag(b.a, b.b, b.spread);
    g2.globalCompositeOperation = 'lighter';
    for (const [w, a, c] of [[10, 0.18, b.color], [4, 0.6, b.color], [1.6, 1, '#fff']]) {
      g2.globalAlpha = a * Math.max(0, 1 - b.t / b.life) * (0.6 + Math.random() * 0.4);
      g2.strokeStyle = c;
      g2.lineWidth = w;
      g2.lineJoin = 'round';
      g2.beginPath();
      b.pts.forEach(([x, y], i) => (i ? g2.lineTo(x, y) : g2.moveTo(x, y)));
      g2.stroke();
    }
  }
  bolts = bolts.filter((b) => b.t < b.life);
  for (const p of parts) {
    p.t++;
    if (p.delay > 0) { p.delay--; p.t--; continue; }
    if (p.attract) {
      const dx = p.attract.x - p.x;
      const dy = p.attract.y - p.y;
      const d = Math.hypot(dx, dy) + 1;
      p.vx += (dx / d) * p.pull;
      p.vy += (dy / d) * p.pull;
      p.vx *= 0.92;
      p.vy *= 0.92;
      if (d < 10) p.t = p.life;
    }
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const k = p.t / p.life;
    const fade = k < 0.1 && p.type === 'smoke' ? k / 0.1 : 1 - k;
    g2.globalAlpha = Math.max(0, fade) * p.alpha;
    if (p.type === 'smoke') {
      g2.globalCompositeOperation = 'source-over';
      const sz = p.size * (1 + k * p.grow);
      g2.drawImage(tinted(p.color), p.x - sz / 2, p.y - sz / 2, sz, sz);
    } else if (p.type === 'debris') {
      g2.globalCompositeOperation = 'source-over';
      g2.save();
      g2.translate(p.x, p.y);
      g2.rotate(p.rot);
      g2.fillStyle = p.color;
      g2.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      g2.restore();
    } else if (p.type === 'shard') {
      g2.globalCompositeOperation = 'lighter';
      g2.save();
      g2.translate(p.x, p.y);
      g2.rotate(p.rot);
      g2.fillStyle = p.color;
      g2.beginPath();
      g2.moveTo(0, -p.size);
      g2.lineTo(p.size * 0.35, 0);
      g2.lineTo(0, p.size);
      g2.lineTo(-p.size * 0.35, 0);
      g2.closePath();
      g2.fill();
      g2.restore();
    } else if (p.type === 'text') {
      g2.globalCompositeOperation = 'source-over';
      g2.fillStyle = p.color;
      g2.font = `800 ${p.size}px Bricolage Grotesque, system-ui, sans-serif`;
      g2.textAlign = 'center';
      g2.fillText(p.text, p.x, p.y);
    } else {
      g2.globalCompositeOperation = 'lighter';
      g2.fillStyle = p.color;
      if (p.streak) {
        g2.strokeStyle = p.color;
        g2.lineWidth = p.size;
        g2.lineCap = 'round';
        g2.beginPath();
        g2.moveTo(p.x, p.y);
        g2.lineTo(p.x - p.vx * p.streak, p.y - p.vy * p.streak);
        g2.stroke();
      } else {
        g2.beginPath();
        g2.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2);
        g2.fill();
      }
    }
  }
  g2.globalAlpha = 1;
  g2.globalCompositeOperation = 'source-over';
  parts = parts.filter((p) => p.t < p.life);
  if (parts.length || rings.length || bolts.length) requestAnimationFrame(loop);
  else { running = false; g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, cv.width, cv.height); }
}

function kick() {
  canvas();
  if (!running) { running = true; requestAnimationFrame(loop); }
}

const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const scaleN = (n) => Math.round(n * (calm() ? 0.25 : particleScale()));

function add(p) {
  parts.push({ t: 0, vx: 0, vy: 0, g: 0, drag: 0.98, rot: 0, vr: 0, alpha: 1, size: 3, life: 60, type: 'spark', grow: 1, delay: 0, ...p });
}

export function sparks(x, y, { n = 40, colors = ['#ffd23d', '#fff'], speed = 8, g = 0.15, life = 50, size = 2.4, streak = 2.5 } = {}) {
  for (let i = 0; i < scaleN(n); i++) {
    const a = R(0, Math.PI * 2);
    const v = R(0.3, 1) * speed;
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g, life: R(life * 0.6, life * 1.3), size: R(size * 0.6, size * 1.3), color: pick(colors), streak, drag: 0.96 });
  }
  kick();
}

export function ring(x, y, { r0 = 10, r1 = 300, life = 40, color = '#fff', w = 18, alpha = 1, fill = null } = {}) {
  rings.push({ x, y, r0, r1, life, color, w, alpha, fill, t: 0 });
  kick();
}

export function smoke(x, y, { n = 20, color = '#3a3330', spread = 60, rise = 1.4, size = 90, life = 160, grow = 2.2, alpha = 0.8 } = {}) {
  for (let i = 0; i < scaleN(n); i++) {
    add({ type: 'smoke', x: x + R(-spread, spread), y: y + R(-spread / 2, spread / 2), vx: R(-0.6, 0.6), vy: -R(rise * 0.4, rise), g: -0.002, drag: 0.99, size: R(size * 0.6, size * 1.2), life: R(life * 0.7, life * 1.2), grow, color, alpha: R(alpha * 0.6, alpha), delay: Math.floor(R(0, 18)) });
  }
  kick();
}

function jag(a, b, spread) {
  const pts = [[a.x, a.y]];
  const n = 12;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    const off = R(-spread, spread) * Math.sin(Math.PI * t);
    pts.push([a.x + (b.x - a.x) * t + (nx / len) * off, a.y + (b.y - a.y) * t + (ny / len) * off]);
  }
  pts.push([b.x, b.y]);
  return pts;
}

export function lightning(a, b, { color = '#7fd8ff', life = 26, spread = 40 } = {}) {
  bolts.push({ a, b, color, life, spread, t: 0, pts: jag(a, b, spread) });
  bolts.push({ a, b, color, life: life * 0.7, spread: spread * 1.4, t: 0, pts: jag(a, b, spread * 1.4) });
  sparks(b.x, b.y, { n: 30, colors: ['#bff0ff', '#fff', color], speed: 7, life: 30 });
  kick();
}

export function flash(color = '#fff', dur = 0.6, peak = 1) {
  const el = document.getElementById('flash');
  if (!el || !window.gsap) return;
  el.style.background = color;
  window.gsap.killTweensOf(el);
  window.gsap.fromTo(el, { opacity: calm() ? peak * 0.4 : peak }, { opacity: 0, duration: dur, ease: 'power2.out', overwrite: true });
}

export function shake(el, power = 14, dur = 0.9) {
  if (!el || !window.gsap || calm()) return;
  const g = window.gsap;
  const tl = g.timeline();
  const steps = Math.round(dur / 0.045);
  for (let i = 0; i < steps; i++) {
    const k = 1 - i / steps;
    tl.to(el, { x: R(-power, power) * k, y: R(-power, power) * k, rotation: R(-1, 1) * k * (power / 14), duration: 0.045, ease: 'none' });
  }
  tl.to(el, { x: 0, y: 0, rotation: 0, duration: 0.1 });
}

export function explosion(x, y, { scale = 1, tint = 'fire' } = {}) {
  const pal = tint === 'violet'
    ? { core: ['#fff', '#f2d4ff', '#d18bff', '#9b4dff'], smoke: '#3a2050', ember: ['#e2a8ff', '#ff7af6', '#fff'], ring: '#e6b8ff', fill: 'rgba(170,80,255,.35)' }
    : { core: ['#fff', '#fff6c0', '#ffd23d', '#ff8a1f', '#ff4d1f'], smoke: '#2e2622', ember: ['#ffb020', '#ff6a1f', '#ffd23d'], ring: '#ffe7a8', fill: 'rgba(255,140,40,.35)' };
  ring(x, y, { r0: 20 * scale, r1: Math.max(innerWidth, innerHeight) * 0.75 * scale, life: 55, color: pal.ring, w: 26 * scale, fill: pal.fill });
  setTimeout(() => ring(x, y, { r0: 10, r1: 260 * scale, life: 38, color: '#fff', w: 10 }), 90);
  sparks(x, y, { n: 220 * scale, colors: pal.core, speed: 16 * scale, g: 0.18, life: 70, size: 3, streak: 3 });
  sparks(x, y, { n: 80 * scale, colors: pal.ember, speed: 5 * scale, g: -0.03, life: 150, size: 2.2, streak: 0 });
  for (let i = 0; i < scaleN(36 * scale); i++) {
    const a = R(0, Math.PI * 2);
    const v = R(4, 13) * scale;
    add({ type: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, g: 0.35, drag: 0.985, vr: R(-0.4, 0.4), size: R(4, 11), life: R(60, 110), color: pick(['#1d1a17', '#3b2f26', '#5a4a3b', '#ffb020']) });
  }
  for (let i = 0; i < scaleN(18 * scale); i++) {
    const a = R(0, Math.PI * 2);
    add({ type: 'smoke', x, y, vx: Math.cos(a) * R(1, 4) * scale, vy: Math.sin(a) * R(1, 3) * scale - 1, drag: 0.95, g: -0.01, size: R(80, 150) * scale, grow: 1.6, life: R(120, 200), color: pick(['#ffb020', '#ff6a1f']), alpha: 0.35 });
  }
  smoke(x, y - 20, { n: 26 * scale, color: pal.smoke, spread: 70 * scale, rise: 2.4, size: 140 * scale, life: 230, grow: 2.4, alpha: 0.85 });
  setTimeout(() => smoke(x, y - 140 * scale, { n: 16 * scale, color: pal.smoke, spread: 130 * scale, rise: 1.2, size: 180 * scale, life: 220, grow: 2, alpha: 0.7 }), 450);
}

export function implode(x, y, ms = 1100) {
  const n = scaleN(160);
  for (let i = 0; i < n; i++) {
    const a = R(0, Math.PI * 2);
    const d = R(180, Math.max(innerWidth, innerHeight) * 0.6);
    add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, attract: { x, y }, pull: R(0.6, 1.4), drag: 1, life: ms / 16, size: R(1.5, 3.5), color: pick(['#f2d4ff', '#c25bff', '#fff', '#8a5bff']), streak: 3, delay: Math.floor(R(0, 25)) });
  }
  ring(x, y, { r0: 420, r1: 8, life: ms / 16, color: '#c25bff', w: 8, alpha: 0.8 });
  kick();
}

export function cryo(x, y, { scale = 1 } = {}) {
  ring(x, y, { r0: 30, r1: 520 * scale, life: 48, color: '#bff4ff', w: 30, fill: 'rgba(120,220,255,.35)' });
  for (let i = 0; i < scaleN(90 * scale); i++) {
    const a = R(0, Math.PI * 2);
    const v = R(2, 13) * scale;
    add({ type: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.05, drag: 0.95, vr: R(-0.2, 0.2), rot: a, size: R(4, 12), life: R(40, 90), color: pick(['#e9fbff', '#9fe8ff', '#5fd0ff', '#ffffff']) });
  }
  sparks(x, y, { n: 120 * scale, colors: ['#fff', '#cff6ff', '#7fdcff'], speed: 9 * scale, g: 0.02, life: 60, size: 2, streak: 1.5 });
  smoke(x, y, { n: 30 * scale, color: '#e8f7ff', spread: 90, rise: 0.9, size: 130, life: 170, grow: 2.2, alpha: 0.6 });
}

export function steam(x, y, n = 8) {
  smoke(x, y, { n, color: '#ffffff', spread: 25, rise: 1.4, size: 50, life: 90, grow: 2, alpha: 0.5 });
}

export function embers(x, y, n = 6) {
  for (let i = 0; i < scaleN(n); i++) add({ x: x + R(-25, 25), y, vx: R(-0.4, 0.4), vy: -R(0.4, 1.4), g: -0.004, drag: 0.995, size: R(1, 2.4), life: R(60, 120), color: pick(['#ff8a1f', '#ffd23d', '#ff4d1f']) });
  smoke(x, y - 10, { n: 2, color: '#2b2522', spread: 15, rise: 0.6, size: 40, life: 120, grow: 2, alpha: 0.5 });
}

export function zzz(x, y) {
  for (let i = 0; i < 3; i++) add({ type: 'text', text: 'z', x: x + i * 8, y, vx: R(0.3, 0.8), vy: -R(0.6, 1), drag: 1, g: 0, size: 18 + i * 8, life: 90, color: '#bfe3ff', delay: i * 14 });
  kick();
}

export function sparkle(x, y, colors = ['#ffd23d', '#fff']) {
  sparks(x, y, { n: 26, colors, speed: 4, g: 0.04, life: 40, size: 2, streak: 0 });
}

export function celebrate(cvEl, { ms = 4200 } = {}) {
  const c = cvEl.getContext('2d');
  const dp = Math.min(dprCap(), window.devicePixelRatio || 1);
  const W = cvEl.clientWidth, H = cvEl.clientHeight;
  cvEl.width = W * dp; cvEl.height = H * dp;
  const cx = W / 2, cy = H * 0.52;
  const q = calm() ? 0.25 : particleScale();
  const gold = ['#ffd23d', '#ffe98a', '#fff6cf', '#ffb020'];
  let ps = [], rs = [], stars = [], alive = true;
  const t0 = performance.now();
  const mote = () => {
    const a = R(0, Math.PI * 2), d = R(30, Math.min(W, H) * 0.45);
    ps.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.6 + 30, vx: R(-0.25, 0.25), vy: -R(0.5, 1.6), w: R(0, 6.28), ws: R(0.03, 0.08), s: R(0.8, 2.4), t: 0, life: R(70, 130), col: pick(gold) });
  };
  const api = {
    burst() {
      rs.push({ r0: 20, r1: Math.max(W, H) * 0.7, t: 0, life: 42, col: '#ffd23d', w: 14 });
      rs.push({ r0: 10, r1: Math.max(W, H) * 0.5, t: -8, life: 50, col: '#39ff88', w: 6 });
      for (let i = 0; i < Math.round(70 * q); i++) {
        const a = R(0, Math.PI * 2), v = R(2, 7);
        ps.push({ x: cx, y: cy - 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, g: 0.06, drag: 0.95, s: R(1, 2.6), t: 0, life: R(40, 75), col: pick(gold), streak: true });
      }
      for (let i = 0; i < Math.max(2, Math.round(6 * q)); i++) stars.push({ x: cx + R(-W * 0.38, W * 0.38), y: cy + R(-H * 0.4, H * 0.2), t: -Math.floor(R(0, 60)), life: 34, s: R(7, 14) });
    },
    stop() { alive = false; },
  };
  const star = (x, y, r, a) => {
    c.globalAlpha = a; c.fillStyle = '#fff8d8';
    c.beginPath();
    for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.16 : r; const an = (i * Math.PI) / 4; c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    c.closePath(); c.fill();
  };
  (function frame(now) {
    if (!alive || !cvEl.isConnected) return;
    const el = now - t0;
    if (el < ms) { const n = (Math.random() < q ? 1 : 0) + (q > 0.5 ? 1 : 0); for (let i = 0; i < n; i++) mote(); }
    if (el < ms && Math.random() < 0.035 * (q + 0.3)) stars.push({ x: cx + R(-W * 0.4, W * 0.4), y: cy + R(-H * 0.45, H * 0.3), t: 0, life: 30, s: R(5, 11) });
    c.setTransform(dp, 0, 0, dp, 0, 0);
    c.clearRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    for (const r of rs) {
      r.t++; if (r.t < 0) continue;
      const k = r.t / r.life, rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) ** 3);
      c.globalAlpha = Math.max(0, 1 - k) * 0.85; c.strokeStyle = r.col; c.lineWidth = r.w * (1 - k) + 1;
      c.beginPath(); c.arc(cx, cy - 40, rad, 0, Math.PI * 2); c.stroke();
    }
    rs = rs.filter((r) => r.t < r.life);
    for (const p of ps) {
      p.t++;
      if (p.streak) { p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; } else { p.w += p.ws; p.vx += Math.sin(p.w) * 0.02; }
      p.x += p.vx; p.y += p.vy;
      const k = p.t / p.life, a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      c.globalAlpha = Math.max(0, a); c.fillStyle = c.strokeStyle = p.col;
      if (p.streak) { c.lineWidth = p.s; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); c.stroke(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.s, 0, Math.PI * 2); c.fill(); c.globalAlpha *= 0.25; c.beginPath(); c.arc(p.x, p.y, p.s * 3, 0, Math.PI * 2); c.fill(); }
    }
    ps = ps.filter((p) => p.t < p.life);
    for (const s of stars) {
      s.t++; if (s.t < 0) continue;
      const k = s.t / s.life, a = Math.sin(k * Math.PI);
      star(s.x, s.y, s.s * (0.4 + a * 0.6), a);
    }
    stars = stars.filter((s) => s.t < s.life);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (el < ms || ps.length || rs.length || stars.length) requestAnimationFrame(frame);
    else c.clearRect(0, 0, W, H);
  })(t0);
  return api;
}

export function center(el) {
  if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function floatEmoji(emoji, label, fromEl) {
  const layer = document.getElementById('floaters');
  if (!layer || !window.gsap) return;
  const el = document.createElement('div');
  el.className = 'floater';
  el.innerHTML = '<span class="fe"></span><span class="fl"></span>';
  el.querySelector('.fe').textContent = emoji;
  el.querySelector('.fl').textContent = label || '';
  const c = center(fromEl);
  el.style.left = c.x + 'px';
  el.style.top = c.y + 'px';
  layer.appendChild(el);
  const g = window.gsap;
  g.fromTo(el, { scale: 0.3, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 0.25, ease: 'back.out(3)' });
  g.to(el, { y: -(160 + Math.random() * 120), x: (Math.random() - 0.5) * 120, rotation: (Math.random() - 0.5) * 50, duration: 2, ease: 'power1.out' });
  g.to(el, { opacity: 0, duration: 0.6, delay: 1.4, onComplete: () => el.remove() });
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
