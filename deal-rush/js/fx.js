let actx = null;
let bus = null;
let vol = 0.8;
let lastUse = 0;
try { const v = localStorage.getItem('dr-sfx'); if (v !== null) vol = Math.max(0, Math.min(1, Number(v))); } catch { /* storage unavailable */ }

export const getSfxVolume = () => vol;
export function setSfxVolume(v) {
  vol = Math.max(0, Math.min(1, v));
  try { localStorage.setItem('dr-sfx', String(vol)); } catch { /* storage unavailable */ }
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
  deal: () => tone(420, 0.07, { type: 'triangle', v: 0.07, slide: 180 }),
  place: () => { tone(520, 0.08, { type: 'triangle', v: 0.08 }); tone(780, 0.1, { type: 'triangle', v: 0.06, when: 0.06 }); },
  coin: () => { tone(1320, 0.08, { type: 'square', v: 0.04 }); tone(1760, 0.14, { type: 'square', v: 0.04, when: 0.07 }); },
  rent: () => [440, 554, 659].forEach((f, i) => tone(f, 0.12, { type: 'sawtooth', v: 0.04, when: i * 0.07 })),
  steal: () => tone(700, 0.25, { type: 'sawtooth', v: 0.06, slide: -450 }),
  veto: () => { tone(200, 0.12, { type: 'square', v: 0.08 }); tone(150, 0.2, { type: 'square', v: 0.08, when: 0.1 }); },
  turn: () => { tone(660, 0.12, { v: 0.09 }); tone(990, 0.18, { v: 0.09, when: 0.12 }); },
  set: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', v: 0.07, when: i * 0.08 })),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', v: 0.08, when: i * 0.13 })),
  bad: () => tone(180, 0.18, { type: 'square', v: 0.05 }),
};

export function buzz(p) { try { navigator.vibrate?.(p); } catch { /* unsupported */ } }
