const gsap = window.gsap;

let actx = null;
let muted = false;
try { muted = localStorage.getItem('tt-muted') === '1'; } catch { /* storage unavailable */ }

let sfxVol = 0.9;
try { const v = localStorage.getItem('tt-sfx'); if (v !== null) sfxVol = Math.max(0, Math.min(1, Number(v))); } catch { /* storage unavailable */ }
if (muted) sfxVol = 0;
let sfxGain = null;
let sfxHook = null;

export const isMuted = () => sfxVol === 0;
export function setMuted(m) { setSfxVolume(m ? 0 : 0.9); }
export const getSfxVolume = () => sfxVol;
export function setSfxVolume(v) {
  sfxVol = Math.max(0, Math.min(1, v));
  muted = sfxVol === 0;
  if (sfxGain) sfxGain.gain.setTargetAtTime(sfxVol, actx.currentTime, 0.03);
  try {
    localStorage.setItem('tt-sfx', String(sfxVol));
    localStorage.setItem('tt-muted', muted ? '1' : '0');
  } catch { /* storage unavailable */ }
}
export const onSfx = (fn) => { sfxHook = fn; };

function out(c) {
  if (!sfxGain) {
    sfxGain = c.createGain();
    sfxGain.gain.value = sfxVol;
    sfxGain.connect(c.destination);
  }
  return sfxGain;
}

function ctx() {
  if (!actx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    actx = new C();
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
export const unlockAudio = () => ctx();
export const audioCtx = () => ctx();

function tone(f, d, { type = 'sine', vol = 0.12, at = 0, to = null, attack = 0.005 } = {}) {
  if (muted) return;
  const c = ctx();
  if (!c) return;
  if (sfxHook) sfxHook(vol);
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(out(c));
  o.start(t);
  o.stop(t + d + 0.05);
}

let noiseBuf = null;
function noise(d, { vol = 0.1, at = 0, freq = 2000, q = 1, type = 'bandpass' } = {}) {
  if (muted) return;
  const c = ctx();
  if (!c) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(f).connect(g).connect(out(c));
  src.start(t, Math.random() * 0.5, d + 0.05);
}

export const sfx = {
  click() { tone(720, 0.05, { type: 'triangle', vol: 0.06 }); },
  pop() { tone(380, 0.1, { vol: 0.09, to: 980 }); },
  select() { tone(660, 0.06, { type: 'triangle', vol: 0.07 }); },
  rotate() { noise(0.08, { vol: 0.08, freq: 2400, q: 3 }); tone(520, 0.05, { type: 'triangle', vol: 0.04, at: 0.03 }); },
  deal() { for (let i = 0; i < 5; i++) noise(0.05, { at: i * 0.06, vol: 0.06, freq: 3200, type: 'highpass' }); },
  dig() {
    noise(0.16, { vol: 0.32, freq: 320, type: 'lowpass' });
    tone(150, 0.14, { type: 'triangle', vol: 0.14, to: 90 });
    noise(0.1, { vol: 0.08, freq: 2600, q: 2, at: 0.05 });
  },
  clank() { tone(1250, 0.22, { type: 'square', vol: 0.04, to: 900 }); tone(1870, 0.25, { type: 'square', vol: 0.025, at: 0.02 }); noise(0.1, { vol: 0.15, freq: 4200, q: 6 }); },
  fix() { [660, 880, 1320].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.07, at: i * 0.07 })); },
  rumble() {
    noise(0.9, { vol: 0.45, freq: 140, type: 'lowpass' });
    tone(70, 0.8, { type: 'sawtooth', vol: 0.12, to: 40 });
    for (let i = 0; i < 6; i++) noise(0.06, { at: 0.15 + i * 0.09 + Math.random() * 0.05, vol: 0.12, freq: 900 + Math.random() * 1500, q: 3 });
  },
  boom() { noise(1.2, { vol: 0.7, freq: 110, type: 'lowpass' }); tone(55, 1, { type: 'sawtooth', vol: 0.18, to: 30 }); noise(0.4, { vol: 0.2, freq: 2400, at: 0.05 }); },
  splash() { noise(0.6, { vol: 0.22, freq: 900, q: 0.6 }); tone(300, 0.3, { vol: 0.05, to: 120, at: 0.1 }); },
  bats() { for (let i = 0; i < 10; i++) tone(2800 + Math.random() * 1600, 0.04, { type: 'square', vol: 0.02, at: i * 0.05 }); },
  peek() { tone(520, 0.2, { vol: 0.07, to: 780 }); tone(1040, 0.3, { vol: 0.04, at: 0.15 }); },
  flip() { noise(0.12, { vol: 0.1, freq: 3000, type: 'highpass' }); tone(440, 0.1, { type: 'triangle', vol: 0.06, at: 0.06, to: 660 }); },
  rock() { tone(196, 0.3, { type: 'triangle', vol: 0.1, to: 140 }); noise(0.25, { vol: 0.15, freq: 400, type: 'lowpass' }); },
  gold() {
    [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.08, at: i * 0.08 }));
    for (let i = 0; i < 12; i++) tone(2400 + Math.random() * 1800, 0.08, { type: 'sine', vol: 0.03, at: 0.3 + i * 0.05 });
  },
  coin() { tone(1320, 0.06, { type: 'square', vol: 0.03 }); tone(1980, 0.16, { type: 'square', vol: 0.03, at: 0.05 }); },
  turn() { tone(660, 0.16, { vol: 0.1 }); tone(990, 0.3, { vol: 0.1, at: 0.12 }); },
  tick() { tone(1800, 0.03, { type: 'square', vol: 0.025 }); },
  reveal() { tone(110, 0.9, { type: 'sawtooth', vol: 0.06, to: 220 }); [330, 415, 494].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.06, at: 0.5 + i * 0.12 })); },
  sting() { [392, 370, 311, 233].forEach((f, i) => tone(f, 0.28, { type: 'sawtooth', vol: 0.05, at: i * 0.16, to: f * 0.9 })); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.6 : 0.16, { type: 'sawtooth', vol: 0.045, at: i * 0.11 })); },
  fail() { [392, 311, 233].forEach((f, i) => tone(f, 0.3, { type: 'sawtooth', vol: 0.06, at: i * 0.2, to: f * 0.85 })); },
  whoosh() { noise(0.35, { vol: 0.12, freq: 900, q: 0.7 }); },
  chat() { tone(1500, 0.06, { vol: 0.04 }); tone(2000, 0.06, { vol: 0.03, at: 0.05 }); },
};

const layer = () => document.getElementById('fxLayer');

const canvas = document.getElementById('fxCanvas');
const g2d = canvas.getContext('2d');
let parts = [];
let running = false;
function sizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);

function loop() {
  g2d.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0);
  for (const p of parts) {
    p.vx *= 0.985;
    p.vy = p.vy * 0.985 + p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life--;
    g2d.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.5));
    g2d.fillStyle = p.c;
    if (p.shape === 'star') {
      g2d.save();
      g2d.translate(p.x, p.y);
      g2d.rotate(p.rot);
      g2d.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? p.s * 0.45 : p.s;
        g2d.lineTo(Math.cos((k * Math.PI) / 5) * r, Math.sin((k * Math.PI) / 5) * r);
      }
      g2d.fill();
      g2d.restore();
    } else if (p.shape === 'shard') {
      g2d.save();
      g2d.translate(p.x, p.y);
      g2d.rotate(p.rot);
      g2d.fillRect(-p.s, -p.s / 3, p.s * 2, p.s * 0.66);
      g2d.restore();
    } else {
      g2d.beginPath();
      g2d.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      g2d.fill();
    }
  }
  g2d.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(loop);
  else running = false;
}

export function burst(x, y, { colors = ['#ffd166', '#fff'], n = 26, speed = 5, g = 0.12, size = 4, life = 55, shape = 'circle' } = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g, s: size * (0.5 + Math.random()),
      c: colors[i % colors.length], life: life * (0.6 + Math.random() * 0.6), max: life, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, shape,
    });
  }
  if (!running) { running = true; requestAnimationFrame(loop); }
}

export const center = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export function floatText(x, y, text, { color = '#fff', size = 22, rise = 70, dur = 1.5 } = {}) {
  const d = document.createElement('div');
  d.className = 'float-text';
  d.textContent = text;
  d.style.color = color;
  d.style.fontSize = size + 'px';
  layer().append(d);
  gsap.set(d, { x, y, xPercent: -50, yPercent: -50 });
  gsap.timeline({ onComplete: () => d.remove() })
    .from(d, { scale: 0.3, duration: 0.3, ease: 'back.out(3)' })
    .to(d, { y: y - rise, duration: dur, ease: 'power2.out' }, 0)
    .to(d, { opacity: 0, duration: 0.4 }, dur - 0.3);
}

export function flyCoins(a, b, n = 6, speed = 1) {
  if (!a || !b) return Promise.resolve();
  const jobs = [];
  for (let k = 0; k < n; k++) {
    const c = document.createElement('div');
    c.className = 'coin';
    c.textContent = '$';
    layer().append(c);
    const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 160;
    const my = Math.min(a.y, b.y) - 70 - Math.random() * 90;
    gsap.set(c, { x: a.x - 12, y: a.y - 12, scale: 0.3, opacity: 0 });
    jobs.push(
      gsap.timeline({ delay: (k * 0.06) / speed, onComplete: () => { c.remove(); if (k % 2 === 0) sfx.coin(); } })
        .to(c, { opacity: 1, scale: 1, duration: 0.12 })
        .to(c, { keyframes: { x: [mx - 12, b.x - 12], y: [my - 12, b.y - 12] }, rotation: 540, duration: 0.7 / speed, ease: 'power1.inOut' }, 0)
        .to(c, { scale: 0.5, opacity: 0, duration: 0.12 }, `>-0.08`)
        .then(),
    );
  }
  return Promise.all(jobs);
}

export function banner(title, sub = '', color = '#ffd166', hold = 1.1) {
  const b = document.createElement('div');
  b.className = 'banner';
  b.style.setProperty('--c', color);
  const t = document.createElement('div');
  t.className = 'banner-title';
  t.textContent = title;
  b.append(t);
  if (sub) {
    const s = document.createElement('div');
    s.className = 'banner-sub';
    s.textContent = sub;
    b.append(s);
  }
  layer().append(b);
  return gsap.timeline({ onComplete: () => b.remove() })
    .fromTo(b, { scale: 0.2, rotation: -8, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' })
    .fromTo(t, { letterSpacing: '0.4em' }, { letterSpacing: '0.04em', duration: 0.6, ease: 'power3.out' }, 0)
    .to(b, { y: -40, opacity: 0, scale: 0.9, duration: 0.35, ease: 'power2.in' }, 0.5 + hold)
    .then();
}

export function shake(el, power = 10) {
  gsap.fromTo(el, { x: -power, y: power / 2 }, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.2)' });
}

export function confetti(x, y, colors) {
  if (window.confetti) {
    window.confetti({ particleCount: 110, spread: 85, startVelocity: 38, origin: { x: x / innerWidth, y: y / innerHeight }, colors, zIndex: 9999 });
  } else burst(x, y, { colors: colors || ['#ffd166', '#ef476f', '#06d6a0', '#118ab2'], n: 80, speed: 9, shape: 'shard', size: 5 });
}

export function fireworks(seconds = 4) {
  const end = Date.now() + seconds * 1000;
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#f72585', '#fff'];
  const id = setInterval(() => {
    if (Date.now() > end) { clearInterval(id); return; }
    const x = innerWidth * (0.15 + Math.random() * 0.7);
    const y = innerHeight * (0.15 + Math.random() * 0.4);
    if (window.confetti) {
      window.confetti({ particleCount: 60, spread: 360, startVelocity: 28, gravity: 0.9, ticks: 120, origin: { x: x / innerWidth, y: y / innerHeight }, colors, zIndex: 9999 });
    } else burst(x, y, { colors, n: 60, speed: 7, shape: 'star', size: 5 });
    sfx.pop();
  }, 380);
}

export function toast(msg, kind = '') {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  box.append(t);
  gsap.timeline({ onComplete: () => t.remove() })
    .from(t, { y: -30, opacity: 0, scale: 0.8, duration: 0.35, ease: 'back.out(2)' })
    .to(t, { opacity: 0, y: -10, duration: 0.3 }, 3.2);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
