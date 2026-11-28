const TIERS = ['low', 'med', 'high'];
const coarse = matchMedia('(pointer: coarse)').matches;
const cores = navigator.hardwareConcurrency || 4;
const mem = navigator.deviceMemory || 4;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = !!navigator.connection?.saveData;
const baseCeiling = reduced || saveData ? 0 : coarse ? 0 : cores >= 6 && mem >= 4 ? 2 : 1;

let cfg = { key: 'pp-quality', prefix: 'q-', low: [] };
let ceiling = baseCeiling;
let mode = 'auto';
let tier = ceiling;
let lowBattery = false;
const listeners = [];

function apply() {
  const b = document.body;
  TIERS.forEach((t) => b.classList.remove(cfg.prefix + t));
  b.classList.add(cfg.prefix + TIERS[tier]);
  cfg.low.forEach((c) => b.classList.toggle(c, tier === 0));
  const g = window.gsap;
  if (g?.ticker?.fps) g.ticker.fps(tier === 0 ? 30 : 60);
  listeners.forEach((f) => f(TIERS[tier]));
}

export const quality = () => TIERS[tier];
export const qualityMode = () => mode;
export const onQuality = (f) => listeners.push(f);
export const dprCap = () => [1, 1.5, 3][tier];
export const particleScale = () => [0.3, 0.6, 1][tier];
export const rich = () => tier === 2;
export const low = () => tier === 0;

function cap() { return lowBattery ? 0 : ceiling; }

export function setQualityMode(m) {
  mode = m;
  try { localStorage.setItem(cfg.key, m); } catch { /* storage unavailable */ }
  tier = m === 'auto' ? cap() : TIERS.indexOf(m);
  apply();
  watch(6000);
}

const times = [];
let last = 0;
let until = 0;
let calmSince = 0;
let running = false;
let strikes = 0;

function judge(t) {
  const sorted = [...times].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  times.length = 0;
  if (p90 > 28 && tier > 0) {
    tier--;
    calmSince = t;
    if (++strikes >= 2) ceiling = Math.min(ceiling, tier);
    apply();
    watch(6000);
  } else if (p90 < 18) {
    if (t - calmSince > 20000 && tier < cap()) {
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

async function watchBattery() {
  try {
    const bat = await navigator.getBattery?.();
    if (!bat) return;
    const check = () => {
      const was = lowBattery;
      lowBattery = !bat.charging && bat.level <= 0.2;
      if (was !== lowBattery && mode === 'auto') { tier = Math.min(tier, cap()); if (!lowBattery) tier = Math.min(cap(), tier); apply(); }
    };
    bat.addEventListener('levelchange', check);
    bat.addEventListener('chargingchange', check);
    check();
  } catch { /* battery API unavailable */ }
}

export function initQuality(opts = {}) {
  cfg = { ...cfg, ...opts };
  try { mode = localStorage.getItem(cfg.key) || 'auto'; } catch { /* storage unavailable */ }
  tier = mode === 'auto' ? cap() : Math.max(0, TIERS.indexOf(mode));
  apply();
  calmSince = performance.now();
  watch(6000);
  setInterval(() => watch(3000), 45000);
  watchBattery();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) watch(4000); });
}

export const qualityCheck = () => watch(6000);

export function qualityPicker() {
  return `<div class="pp-q"><span>Graphics <small>(now: ${quality()})</small></span><div class="pp-q-seg">${['auto', 'high', 'med', 'low'].map((m) => `<button type="button" data-ppq="${m}" class="${mode === m ? 'on' : ''}">${{ auto: 'Auto', high: 'High', med: 'Medium', low: 'Low' }[m]}</button>`).join('')}</div></div>`;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-ppq]');
  if (!b) return;
  setQualityMode(b.dataset.ppq);
  const box = b.closest('.pp-q');
  box.querySelectorAll('[data-ppq]').forEach((x) => x.classList.toggle('on', x === b));
  box.querySelector('small').textContent = `(now: ${quality()})`;
});
