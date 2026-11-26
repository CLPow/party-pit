let ctx = null;
let muted = false;
try { muted = localStorage.getItem('mmcc-muted') === '1'; } catch { /* storage unavailable */ }

export const isMuted = () => muted;
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('mmcc-muted', v ? '1' : '0'); } catch { /* storage unavailable */ }
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.12, when = 0, slide = 0) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur = 0.08, vol = 0.08, when = 0) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1800;
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + when);
}

export const sfx = {
  unlock: () => ac(),
  deal: () => noise(0.06, 0.05),
  flip: () => { noise(0.05, 0.07); tone(520, 0.06, 'triangle', 0.05, 0.02); },
  select: () => tone(660, 0.07, 'triangle', 0.08),
  deselect: () => tone(440, 0.07, 'triangle', 0.06),
  play: () => { tone(300, 0.12, 'square', 0.05, 0, 400); noise(0.08, 0.05, 0.04); },
  submitted: () => tone(880, 0.05, 'sine', 0.04),
  pop: () => tone(990, 0.06, 'sine', 0.06, 0, 300),
  tick: () => tone(1200, 0.03, 'square', 0.03),
  judge: () => { tone(392, 0.15, 'triangle', 0.08); tone(523, 0.2, 'triangle', 0.08, 0.12); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.1)),
  lose: () => { tone(330, 0.2, 'sawtooth', 0.04); tone(247, 0.3, 'sawtooth', 0.04, 0.15); },
  fanfare: () => [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'square', 0.06, i * 0.13)),
  chat: () => tone(740, 0.05, 'sine', 0.05),
};

export function buzz(ms = 15) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* not supported */ }
}

export function confettiBurst(big = false) {
  if (!window.confetti) return;
  const colors = ['#ff3d8b', '#c6ff3d', '#ffffff', '#7c5cff', '#ffd23d'];
  if (!big) {
    window.confetti({ particleCount: 90, spread: 75, origin: { y: 0.45 }, colors, disableForReducedMotion: true });
    return;
  }
  const end = Date.now() + 1800;
  (function frame() {
    window.confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors, disableForReducedMotion: true });
    window.confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function floatEmoji(emoji, label, fromEl) {
  const layer = document.getElementById('floaters');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = 'floater';
  el.innerHTML = `<span class="fe"></span><span class="fl"></span>`;
  el.querySelector('.fe').textContent = emoji;
  el.querySelector('.fl').textContent = label || '';
  const r = fromEl ? fromEl.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : window.innerWidth * (0.2 + Math.random() * 0.6);
  const y = r ? r.top : window.innerHeight - 90;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  layer.appendChild(el);
  const g = window.gsap;
  if (!g) { setTimeout(() => el.remove(), 1500); return; }
  g.fromTo(el, { scale: 0.3, opacity: 0, x: 0 }, { scale: 1.2, opacity: 1, duration: 0.25, ease: 'back.out(3)' });
  g.to(el, { y: -(220 + Math.random() * 160), x: (Math.random() - 0.5) * 160, rotation: (Math.random() - 0.5) * 50, duration: 2.2, ease: 'power1.out' });
  g.to(el, { opacity: 0, duration: 0.6, delay: 1.6, onComplete: () => el.remove() });
}
