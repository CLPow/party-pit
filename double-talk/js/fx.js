let actx = null;
let bus = null;
let vol = 0.8;
let lastUse = 0;
try { const v = localStorage.getItem('dt-sfx'); if (v !== null) vol = Math.max(0, Math.min(1, Number(v))); } catch { /* storage unavailable */ }

export const getSfxVolume = () => vol;
export function setSfxVolume(v) {
  vol = Math.max(0, Math.min(1, v));
  try { localStorage.setItem('dt-sfx', String(vol)); } catch { /* storage unavailable */ }
  if (bus) bus.gain.value = vol;
}

function ctx() {
  if (!actx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    actx = new C();
    bus = actx.createGain();
    bus.gain.value = vol;
    bus.connect(actx.destination);
  }
  lastUse = performance.now();
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
export const unlockAudio = () => ctx();

setInterval(() => {
  if (actx && actx.state === 'running' && (document.hidden || performance.now() - lastUse > 8000)) actx.suspend().catch(() => {});
}, 3000);

function tone(f, dur = 0.12, { type = 'sine', v = 0.1, when = 0, slide = 0 } = {}) {
  if (!vol) return;
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  tap: () => tone(660, 0.05, { v: 0.05 }),
  send: () => { tone(520, 0.07, { type: 'triangle', v: 0.08 }); tone(880, 0.1, { type: 'triangle', v: 0.07, when: 0.06 }); },
  flip: () => tone(300, 0.12, { type: 'triangle', v: 0.06, slide: 500 }),
  reveal: () => [392, 523, 659].forEach((f, i) => tone(f, 0.14, { type: 'triangle', v: 0.07, when: i * 0.07 })),
  vote: () => tone(240, 0.1, { type: 'square', v: 0.05, slide: -60 }),
  phase: () => { tone(440, 0.12, { v: 0.08 }); tone(660, 0.16, { v: 0.08, when: 0.12 }); },
  tick: () => tone(1200, 0.03, { type: 'square', v: 0.025 }),
  out: () => { tone(330, 0.2, { type: 'sawtooth', v: 0.06, slide: -200 }); tone(165, 0.35, { type: 'sawtooth', v: 0.05, when: 0.18, slide: -60 }); },
  caught: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', v: 0.07, when: i * 0.08 })),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', v: 0.08, when: i * 0.13 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.28, { type: 'sine', v: 0.08, when: i * 0.16 })),
  bad: () => tone(180, 0.18, { type: 'square', v: 0.05 }),
};

export function buzz(p) { try { navigator.vibrate?.(p); } catch { /* unsupported */ } }
