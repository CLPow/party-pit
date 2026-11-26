import { audioCtx, holdAudio } from './fx.js';

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const freq = (n) => {
  const m = n.match(/^([A-G]#?)(\d)$/);
  return 440 * 2 ** ((NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
};

const SONGS = {
  lobby: {
    bpm: 84, swing: 0.16, keys: 0.05, pad: 0.035, bass: 0.09, drums: 0.45,
    chords: [['D3', 'F3', 'A3', 'C4'], ['A#2', 'D3', 'F3', 'A3'], ['G2', 'A#2', 'D3', 'F3'], ['A2', 'C#3', 'E3', 'G3']],
    arp: [0, 3, 6, 10, 12], kick: [0, 10], snare: [8], hat: 4,
  },
  play: {
    bpm: 100, swing: 0.1, keys: 0.05, pad: 0.03, bass: 0.11, drums: 0.65,
    chords: [['E3', 'G3', 'B3', 'D4'], ['C3', 'E3', 'G3', 'B3'], ['A2', 'C3', 'E3', 'G3'], ['B2', 'D#3', 'F#3', 'A3']],
    arp: [0, 3, 6, 8, 11, 14], kick: [0, 7, 10], snare: [4, 12], hat: 2,
  },
  tension: {
    bpm: 132, swing: 0, keys: 0.04, pad: 0.045, bass: 0.14, drums: 0.9,
    chords: [['E2', 'G2', 'A#2'], ['E2', 'G2', 'B2'], ['F2', 'G#2', 'B2'], ['E2', 'G2', 'A#2']],
    arp: [0, 2, 4, 6, 8, 10, 12, 14], kick: [0, 4, 8, 12], snare: [4, 12], hat: 1, pulse: true,
  },
  victory: {
    bpm: 116, swing: 0.1, keys: 0.06, pad: 0.035, bass: 0.1, drums: 0.7,
    chords: [['D3', 'F#3', 'A3', 'D4'], ['G3', 'B3', 'D4', 'G4'], ['B2', 'D3', 'F#3', 'B3'], ['A2', 'C#3', 'E3', 'A3']],
    arp: [0, 2, 4, 6, 8, 10, 12, 14], kick: [0, 8], snare: [4, 12], hat: 2, bars: 8, then: 'play',
  },
};

const isPhoneDevice = () => window.matchMedia('(pointer: coarse)').matches;
let volume = isPhoneDevice() ? 0 : 0.45;
try {
  const v = localStorage.getItem('mow-music');
  if (v !== null) volume = Math.max(0, Math.min(1, Number(v)));
} catch { /* storage unavailable */ }

let ctx = null;
let bus = null;
let comp = null;
let warm = null;
let timer = null;
let mood = 'lobby';
let wanted = 'lobby';
let step = 0;
let bar = 0;
let barsInMood = 0;
let nextTime = 0;
let noiseBuf = null;
let duckUntil = 0;

function graph() {
  if (bus) return true;
  ctx = audioCtx();
  if (!ctx) return false;
  bus = ctx.createGain();
  bus.gain.value = 0;
  warm = ctx.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = 5200;
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 3;
  bus.connect(warm).connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

function voice(f, t, dur, { type = 'triangle', vol = 0.05, attack = 0.01, release = 0.3, cutoff = 0, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setTargetAtTime(0.0001, t + Math.max(attack, dur - release), release / 3);
  let node = o.connect(g);
  if (cutoff) {
    const f2 = ctx.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = cutoff;
    node = node.connect(f2);
  }
  node.connect(bus);
  o.start(t);
  o.stop(t + dur + release * 2);
}

function hit(t, { vol = 0.1, dur = 0.05, type = 'highpass', f = 7000, q = 0.7 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl).connect(g).connect(bus);
  src.start(t, Math.random() * 0.8, dur + 0.02);
}

function kick(t, vol) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + 0.25);
}

function schedule(t) {
  const song = SONGS[mood];
  const sixteenth = 60 / song.bpm / 4;
  const chord = song.chords[bar % song.chords.length];
  const swing = step % 2 === 1 ? song.swing * sixteenth : 0;
  const at = t + swing + (Math.random() - 0.5) * 0.006;
  if (step === 0) {
    chord.forEach((n, k) => voice(freq(n), at, sixteenth * 16, { type: 'sawtooth', vol: song.pad / chord.length * 1.6, attack: 0.35, release: 0.9, cutoff: 900, detune: k % 2 ? 6 : -6 }));
  }
  if (song.arp.includes(step)) {
    const idx = song.arp.indexOf(step);
    const n = chord[(idx + bar) % chord.length];
    voice(freq(n) * 2, at, sixteenth * 3, { type: 'sine', vol: song.keys, attack: 0.005, release: 0.45 });
    voice(freq(n) * 4, at, sixteenth * 2, { type: 'triangle', vol: song.keys * 0.25, attack: 0.003, release: 0.2 });
  }
  const root = freq(chord[0]) / 2;
  if (song.pulse ? step % 2 === 0 : (step === 0 || step === 8 || (mood === 'play' && step === 10))) {
    voice(root, at, song.pulse ? sixteenth * 1.6 : sixteenth * 5, { type: 'triangle', vol: song.bass, attack: 0.01, release: song.pulse ? 0.08 : 0.25 });
  }
  const dv = song.drums;
  if (song.kick.includes(step)) kick(at, 0.32 * dv);
  if (song.snare.includes(step)) hit(at, { vol: 0.09 * dv, dur: 0.14, type: 'bandpass', f: 1800, q: 0.8 });
  if (step % song.hat === 0) hit(at, { vol: (step % 4 === 2 ? 0.035 : 0.022) * dv, dur: 0.035 });
}

function loop() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.15) {
    if (step === 0) {
      const song = SONGS[mood];
      barsInMood++;
      if (song.bars && barsInMood > song.bars) {
        mood = song.then;
        wanted = song.then;
        barsInMood = 1;
      } else if (wanted !== mood && (bar % 2 === 0 || wanted === 'tension' || wanted === 'victory')) {
        mood = wanted;
        bar = 0;
        barsInMood = 1;
      }
    }
    schedule(nextTime);
    nextTime += 60 / SONGS[mood].bpm / 4;
    step = (step + 1) % 16;
    if (step === 0) bar++;
  }
  const now = ctx.currentTime;
  const target = document.hidden ? 0 : volume * (performance.now() < duckUntil ? 0.55 : 1);
  bus.gain.setTargetAtTime(target, now, 0.12);
}

function start() {
  if (timer || volume <= 0 || !graph()) return;
  if (ctx.state === 'suspended') ctx.resume();
  nextTime = ctx.currentTime + 0.1;
  step = 0;
  bar = 0;
  barsInMood = 0;
  timer = setInterval(loop, 30);
  holdAudio('music', true);
}

function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  holdAudio('music', false);
  if (bus) bus.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
}

export function setMood(m) {
  if (!SONGS[m]) return;
  if (m === 'victory' && (wanted === 'victory' || mood === 'victory')) return;
  wanted = m;
  if (m === 'victory') barsInMood = 0;
}

export function kickMusic() {
  if (volume > 0) start();
}

export const getMusicVolume = () => volume;
export function setMusicVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem('mow-music', String(volume)); } catch { /* storage unavailable */ }
  if (volume > 0) start();
  else stop();
}

export function duck(strength) {
  if (strength > 0.04) duckUntil = performance.now() + 450;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
  else if (volume > 0 && bus) start();
});

export const musicStatus = () => ({ running: !!timer, mood, wanted, bar, gain: bus ? +bus.gain.value.toFixed(3) : 0, ctx: ctx ? ctx.state : 'none', volume });
