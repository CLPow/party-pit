const TIERS = ['low', 'med', 'high'];
const KEY = 'mow-quality';
const coarse = matchMedia('(pointer: coarse)').matches;
const cores = navigator.hardwareConcurrency || 4;
const mem = navigator.deviceMemory || 4;
const ceiling = coarse ? 0 : cores >= 6 && mem >= 4 ? 2 : 1;

let mode = 'auto';
try { mode = localStorage.getItem(KEY) || 'auto'; } catch { /* storage unavailable */ }
let tier = mode === 'auto' ? ceiling : TIERS.indexOf(mode);
const listeners = [];

function apply() {
  document.body.classList.remove('q-low', 'q-med', 'q-high');
  document.body.classList.add('q-' + TIERS[tier]);
  listeners.forEach((f) => f(TIERS[tier]));
}

export const quality = () => TIERS[tier];
export const qualityMode = () => mode;
export const onQuality = (f) => listeners.push(f);
export const dprCap = () => [1, 1.5, 3][tier];
export const particleScale = () => [0.3, 0.6, 1][tier];
export const rich = () => tier === 2;

export function setQualityMode(m) {
  mode = m;
  try { localStorage.setItem(KEY, m); } catch { /* storage unavailable */ }
  tier = m === 'auto' ? ceiling : TIERS.indexOf(m);
  apply();
  watch(6000);
}

const times = [];
let last = 0;
let until = 0;
let calmSince = 0;
let running = false;

function judge(t) {
  const sorted = [...times].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  times.length = 0;
  if (p90 > 28 && tier > 0) {
    tier--;
    calmSince = t;
    apply();
    watch(6000);
  } else if (p90 < 18) {
    if (t - calmSince > 10000 && tier < ceiling) {
      tier++;
      calmSince = t;
      apply();
      watch(6000);
    }
  } else calmSince = t;
}

function sample(t) {
  const dt = t - last;
  last = t;
  if (!document.hidden && dt < 500) times.push(dt);
  if (t < until) { requestAnimationFrame(sample); return; }
  running = false;
  if (mode === 'auto' && times.length > 40) judge(t);
  else times.length = 0;
}

function watch(ms) {
  if (mode !== 'auto' || document.hidden) return;
  until = performance.now() + ms;
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(sample);
}

export function initQuality() {
  apply();
  calmSince = performance.now();
  watch(6000);
  setInterval(() => watch(3000), 60000);
}

export const qualityCheck = () => watch(6000);
