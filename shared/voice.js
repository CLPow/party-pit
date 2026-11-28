const RATE = 16000;
const FRAME = 1600;
const VAD = 0.012;
const HOLD = 4;
const CLIP_MAX_MS = 10000;
const MAX_LEAD = 0.6;

const noop = () => {};
let o = null;
let sendFn = null;
let ownCtx = null;
let inCall = false;
let selfMuted = false;
let stream = null;
let capNode = null;
let sink = null;
let src = null;
let acc = new Float32Array(0);
let hold = 0;
let seq = 0;
let hereTimer = null;
let rec = null;
let recStart = 0;
let recCap = null;
let clipQueue = [];
let clipPlaying = false;
let voiceGain = null;
const peers = new Map();
const present = new Map();
const blocked = new Set();
const talking = new Map();
export const stats = { tx: 0, rx: 0, played: 0, clipsTx: 0, clipsRx: 0, listenOnly: false };
window.__ppVoice = stats;

export function initVoice(opts) {
  o = { toast: noop, onSpeaking: noop, onChange: noop, onClip: noop, duck: noop, hold: noop, sfx: {}, volume: () => 0.9, players: () => [], dock: true, ...opts };
  if (o.dock) mountDock();
}

export function bindVoice(fn) { sendFn = fn; refresh(); }
export function unbindVoice() {
  if (inCall) leaveCall(true);
  sendFn = null;
  present.clear();
  peers.clear();
  refresh();
}
export const voiceOn = () => !!(o && sendFn && o.enabled());
const send = (m) => { if (sendFn) sendFn(m); };
const me = () => o.me();
const sfx = (k) => { try { o.sfx[k]?.(); } catch { /* sound failed */ } };

function audioCtx() {
  if (o.audioCtx) return o.audioCtx();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ownCtx) ownCtx = new AC();
  if (ownCtx.state === 'suspended') ownCtx.resume().catch(noop);
  return ownCtx;
}

export const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
export const isInCall = () => inCall;
export const isSelfMuted = () => selfMuted;
export const isBlocked = (pid) => blocked.has(pid);
export const inCallSet = () => {
  const now = Date.now();
  const out = new Set();
  for (const [pid, at] of present) if (now - at < 25000) out.add(pid);
  if (inCall) out.add(me());
  return out;
};

export function toggleBlock(pid) {
  if (blocked.has(pid)) blocked.delete(pid);
  else blocked.add(pid);
  refresh();
  return blocked.has(pid);
}

function gainNode() {
  const ctx = audioCtx();
  if (!ctx) return null;
  if (!voiceGain || voiceGain.context !== ctx) {
    voiceGain = ctx.createGain();
    voiceGain.connect(ctx.destination);
  }
  voiceGain.gain.value = Math.max(0.6, o.volume() + 0.3);
  return voiceGain;
}

const BIAS = 0x84;
const CLIP = 32635;
function mulawEncode(sample) {
  let s = Math.max(-1, Math.min(1, sample)) * 32767;
  const sign = s < 0 ? 0x80 : 0;
  if (s < 0) s = -s;
  s = Math.min(CLIP, s) + BIAS;
  let exp = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exp > 0; exp--, mask >>= 1);
  const man = (s >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | man) & 0xff;
}
const DECODE = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff;
  const sign = u & 0x80;
  const exp = (u >> 4) & 0x07;
  const man = u & 0x0f;
  let s = ((man << 3) + BIAS) << exp;
  s -= BIAS;
  DECODE[i] = (sign ? -s : s) / 32768;
}

function toB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function resample(input, from) {
  if (from === RATE) return input;
  const ratio = from / RATE;
  const n = Math.floor(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function onCapture(chunk, rate) {
  const r = resample(chunk, rate);
  const merged = new Float32Array(acc.length + r.length);
  merged.set(acc);
  merged.set(r, acc.length);
  acc = merged;
  while (acc.length >= FRAME) {
    const frame = acc.subarray(0, FRAME);
    acc = acc.slice(FRAME);
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);
    if (rms > VAD) hold = HOLD;
    if (hold <= 0 || selfMuted) continue;
    hold--;
    const bytes = new Uint8Array(frame.length);
    for (let i = 0; i < frame.length; i++) bytes[i] = mulawEncode(frame[i]);
    send({ t: 'vo', k: 'f', from: me(), s: seq++, d: toB64(bytes), lv: Math.min(1, rms * 8) });
    stats.tx++;
    speaking(me(), Math.min(1, rms * 8));
  }
}

const WORKLET = `class PpCap extends AudioWorkletProcessor { constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; } process(inputs) { const ch = inputs[0] && inputs[0][0]; if (!ch) return true; this.buf.set(ch, this.n); this.n += ch.length; if (this.n + 128 > this.buf.length) { const out = this.buf.slice(0, this.n); this.port.postMessage(out, [out.buffer]); this.n = 0; } return true; } } registerProcessor('pp-cap', PpCap);`;
const workletReady = new WeakMap();

async function micStream() {
  if (stream && stream.getAudioTracks().some((t) => t.readyState === 'live')) return stream;
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  return stream;
}

export async function joinCall() {
  if (inCall) return true;
  if (!voiceOn()) return false;
  if (!supported()) { o.toast('Voice is not supported in this browser.', 'bad'); return false; }
  const ctx = audioCtx();
  if (!ctx) return false;
  let mic = true;
  try { await micStream(); } catch { mic = false; }
  stats.listenOnly = !mic;
  inCall = true;
  o.hold('voice', true);
  selfMuted = !mic;
  acc = new Float32Array(0);
  send({ t: 'vo', k: 'join', from: me() });
  hereTimer = setInterval(() => send({ t: 'vo', k: 'here', from: me() }), 10000);
  if (!mic) {
    o.toast('No microphone access, so you joined the call as a listener.', 'bad');
    refresh();
    return true;
  }
  src = ctx.createMediaStreamSource(stream);
  sink = ctx.createGain();
  sink.gain.value = 0;
  sink.connect(ctx.destination);
  try {
    if (!ctx.audioWorklet) throw new Error('no worklet');
    if (!workletReady.has(ctx)) workletReady.set(ctx, ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }))));
    await workletReady.get(ctx);
    capNode = new AudioWorkletNode(ctx, 'pp-cap');
    capNode.port.onmessage = (e) => onCapture(e.data, ctx.sampleRate);
  } catch {
    capNode = ctx.createScriptProcessor(2048, 1, 1);
    capNode.onaudioprocess = (e) => onCapture(e.inputBuffer.getChannelData(0).slice(0), ctx.sampleRate);
  }
  src.connect(capNode);
  capNode.connect(sink);
  sfx('turn');
  refresh();
  return true;
}

export function leaveCall(silent = false) {
  if (!inCall) return;
  inCall = false;
  o.hold('voice', false);
  clearInterval(hereTimer);
  try { src && src.disconnect(); capNode && capNode.disconnect(); sink && sink.disconnect(); } catch { /* already disconnected */ }
  if (capNode && capNode.port) capNode.port.onmessage = null;
  capNode = null;
  src = null;
  if (!rec) releaseMic();
  if (!silent) send({ t: 'vo', k: 'leave', from: me() });
  for (const p of peers.values()) p.next = 0;
  refresh();
}

function releaseMic() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

export function toggleSelfMute() {
  if (stats.listenOnly) { o.toast('Allow microphone access to talk.', 'bad'); return true; }
  selfMuted = !selfMuted;
  refresh();
  return selfMuted;
}

export async function startPTT() {
  if (rec || !voiceOn()) return false;
  if (!supported() || !window.MediaRecorder) { o.toast('Push-to-talk is not supported in this browser.', 'bad'); return false; }
  let s;
  try { s = await micStream(); } catch { o.toast('Microphone access was blocked. Allow it in your browser settings to talk.', 'bad'); return false; }
  const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
  const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
  const chunks = [];
  rec = r;
  recStart = Date.now();
  r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  r.onstop = () => {
    clearTimeout(recCap);
    const dur = Date.now() - recStart;
    rec = null;
    if (!inCall) releaseMic();
    refresh();
    if (dur < 400) { o.toast('Hold the 🎙 button while you talk.'); return; }
    const blob = new Blob(chunks, { type: r.mimeType || mime || 'audio/webm' });
    const fr = new FileReader();
    fr.onload = () => {
      const d = String(fr.result);
      if (d.length > 215000) { o.toast('That message was too long.', 'bad'); return; }
      send({ t: 'vo', k: 'clip', from: me(), d, dur });
      stats.clipsTx++;
      sfx('pop');
    };
    fr.readAsDataURL(blob);
  };
  recCap = setTimeout(() => stopPTT(), CLIP_MAX_MS);
  r.start();
  sfx('click');
  refresh();
  return true;
}

export function stopPTT() {
  if (rec && rec.state === 'recording') rec.stop();
}
export const isRecording = () => !!rec;
export const recElapsed = () => (rec ? Date.now() - recStart : 0);

function playFrame(from, d, lv) {
  const ctx = audioCtx();
  const g = gainNode();
  if (!ctx || !g) return;
  const bytes = fromB64(d);
  const buf = ctx.createBuffer(1, bytes.length, RATE);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < bytes.length; i++) ch[i] = DECODE[bytes[i]];
  const p = peers.get(from) || { next: 0 };
  peers.set(from, p);
  const now = ctx.currentTime;
  if (p.next < now + 0.04 || p.next > now + MAX_LEAD) p.next = now + 0.12;
  const node = ctx.createBufferSource();
  node.buffer = buf;
  node.connect(g);
  node.start(p.next);
  stats.played++;
  const at = (p.next - now) * 1000;
  p.next += buf.duration;
  setTimeout(() => speaking(from, lv || 0.4), Math.max(0, at));
  o.duck(0.2);
}

function nextClip() {
  if (clipPlaying || !clipQueue.length) return;
  const { from, d, dur } = clipQueue.shift();
  clipPlaying = true;
  const a = new Audio(d);
  a.volume = Math.min(1, Math.max(0.6, o.volume() + 0.3));
  const pulse = setInterval(() => { speaking(from, 0.35 + Math.random() * 0.5); o.duck(0.2); }, 120);
  const done = () => { clearInterval(pulse); clipPlaying = false; speaking(from, 0); setTimeout(nextClip, 150); };
  a.onended = done;
  a.onerror = done;
  setTimeout(() => { if (clipPlaying && !a.ended) { a.pause(); done(); } }, (dur || CLIP_MAX_MS) + 2500);
  o.onClip(from);
  a.play().catch(done);
}

export function handle(m) {
  if (!o || !m || typeof m.from !== 'string' || m.from === me()) return;
  if (!o.enabled()) return;
  if (m.k === 'join' || m.k === 'here') { present.set(m.from, Date.now()); if (m.k === 'join') refresh(); return; }
  if (m.k === 'leave') { present.delete(m.from); peers.delete(m.from); refresh(); return; }
  if (blocked.has(m.from)) return;
  if (m.k === 'f' && typeof m.d === 'string' && m.d.length < 4000) {
    if (!present.has(m.from)) { present.set(m.from, Date.now()); refresh(); } else present.set(m.from, Date.now());
    stats.rx++;
    if (inCall) playFrame(m.from, m.d, m.lv);
    return;
  }
  if (m.k === 'clip' && typeof m.d === 'string' && /^data:audio\//.test(m.d)) {
    stats.clipsRx++;
    if (clipQueue.length > 8) clipQueue.shift();
    clipQueue.push({ from: m.from, d: m.d, dur: Math.min(CLIP_MAX_MS, Number(m.dur) || CLIP_MAX_MS) });
    nextClip();
  }
}

export function validVoice(m) {
  if (!m || m.t !== 'vo' || typeof m.k !== 'string' || typeof m.from !== 'string' || m.from.length > 64) return false;
  if (m.k === 'f') return typeof m.d === 'string' && m.d.length < 4000 && /^[A-Za-z0-9+/=]+$/.test(m.d);
  if (m.k === 'clip') return typeof m.d === 'string' && m.d.length < 220000 && /^data:audio\/[\w.+-]+(;[\w=.+-]+)*;base64,[A-Za-z0-9+/=]+$/.test(m.d);
  return ['join', 'here', 'leave'].includes(m.k);
}

export function cleanVoice(m) {
  return { t: 'vo', k: m.k, from: m.from, s: m.s, d: m.d, lv: m.lv, dur: m.dur };
}

function speaking(pid, lv) {
  o.onSpeaking(pid, lv);
  if (!dock) return;
  if (lv > 0.02) talking.set(pid, Date.now());
  renderTalkers();
}

let dock = null;
let refreshQueued = false;
function refresh() {
  if (!o) return;
  o.onChange();
  if (!dock || refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => { refreshQueued = false; renderDock(); });
}

const CSS = `
.ppv { position: fixed; left: 8px; top: 42%; z-index: 44; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; transform: translateY(-50%); pointer-events: none; font: 600 13px/1.2 Inter, system-ui, sans-serif; -webkit-user-select: none; user-select: none; }
.ppv[hidden] { display: none; }
.ppv button { pointer-events: auto; width: 46px; height: 46px; border-radius: 50%; border: 1px solid rgba(255,255,255,.18); background: rgba(14,20,38,.82); color: #fff; font-size: 20px; display: grid; place-items: center; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.35); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); touch-action: none; transition: transform .12s, background .2s, box-shadow .2s; position: relative; padding: 0; }
.ppv button:active { transform: scale(.92); }
.ppv button small { position: absolute; bottom: -2px; right: -4px; font-size: 9px; background: #ffc53d; color: #2a1a00; border-radius: 8px; padding: 1px 4px; font-weight: 800; }
.ppv .on { background: linear-gradient(180deg, #4ade80, #16a34a); border-color: transparent; }
.ppv .muted { background: rgba(120,20,30,.85); }
.ppv .rec { background: linear-gradient(180deg, #ff8aa0, #ff2a4a); border-color: transparent; box-shadow: 0 0 0 5px rgba(255,42,74,.28), 0 0 26px rgba(255,42,74,.6); animation: ppvPulse 1s ease-in-out infinite; }
@keyframes ppvPulse { 50% { box-shadow: 0 0 0 9px rgba(255,42,74,.12), 0 0 30px rgba(255,42,74,.7); } }
.ppv-talk { position: fixed; left: 62px; top: 42%; transform: translateY(-50%); z-index: 44; display: flex; flex-direction: column; gap: 4px; pointer-events: none; }
.ppv-talk span { background: rgba(14,20,38,.86); color: #fff; border: 1px solid rgba(74,222,128,.6); border-radius: 999px; padding: 4px 10px 4px 8px; font: 600 12px/1.2 Inter, system-ui, sans-serif; white-space: nowrap; max-width: 46vw; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 0 12px rgba(74,222,128,.35); animation: ppvIn .18s ease-out; }
@keyframes ppvIn { from { opacity: 0; transform: translateX(-6px); } }
.ppv-sheet { position: fixed; inset: 0; z-index: 95; background: rgba(4,8,18,.6); display: grid; place-items: center; padding: 16px; }
.ppv-card { width: min(380px, 100%); max-height: 80vh; overflow: auto; background: #141d35; color: #f3f5ff; border: 1px solid rgba(255,255,255,.14); border-radius: 20px; padding: 16px; font: 14px/1.4 Inter, system-ui, sans-serif; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
.ppv-card h3 { margin: 0 0 4px; font-size: 1.1rem; }
.ppv-card p { margin: 0 0 10px; color: #9aa6c8; font-size: .85rem; }
.ppv-row { display: flex; align-items: center; gap: 8px; padding: 8px 4px; border-top: 1px solid rgba(255,255,255,.08); }
.ppv-row b { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ppv-row i { font-style: normal; font-size: .75rem; color: #4ade80; }
.ppv-row button, .ppv-close { border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.07); color: #fff; border-radius: 12px; padding: 6px 10px; font: 600 13px Inter, system-ui, sans-serif; cursor: pointer; }
.ppv-row button.x { background: rgba(180,30,50,.6); }
.ppv-close { margin-top: 10px; width: 100%; padding: 10px; }
body.calm .ppv .rec, body.q-low .ppv .rec, body.lite .ppv .rec { animation: none; }
@media (max-width: 760px) { body.ppv-on #lobby { padding-left: 54px; } }
@media (orientation: landscape) and (max-height: 560px) { .ppv { top: 50%; gap: 6px; } .ppv button { width: 40px; height: 40px; font-size: 17px; } .ppv-talk { left: 54px; top: 50%; } }
`;

function mountDock() {
  if (dock) return;
  const style = document.createElement('style');
  style.textContent = CSS + (o.dockCss || '');
  document.head.appendChild(style);
  dock = document.createElement('div');
  dock.className = 'ppv';
  dock.hidden = true;
  dock.innerHTML = '<button type="button" data-v="ptt" aria-label="Hold to talk" title="Hold to talk">🎙</button><button type="button" data-v="call" aria-label="Join the live call" title="Live call">📞</button><button type="button" data-v="mute" aria-label="Mute my microphone" title="Mute my mic" hidden>🎤</button><button type="button" data-v="list" aria-label="Who is in the call" title="Voice settings" hidden>👥</button>';
  const talk = document.createElement('div');
  talk.className = 'ppv-talk';
  document.body.append(dock, talk);
  dock._talk = talk;
  const ptt = dock.querySelector('[data-v="ptt"]');
  let down = false;
  const start = async (e) => {
    e.preventDefault();
    if (down) return;
    down = true;
    audioCtx();
    try { ptt.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const ok = await startPTT();
    if (!ok) { down = false; return; }
    if (!down) stopPTT();
  };
  const end = () => { if (!down) return; down = false; stopPTT(); };
  ptt.addEventListener('pointerdown', start);
  ptt.addEventListener('pointerup', end);
  ptt.addEventListener('pointercancel', end);
  ptt.addEventListener('lostpointercapture', end);
  ptt.addEventListener('contextmenu', (e) => e.preventDefault());
  dock.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    if (b.dataset.v === 'call') { if (inCall) leaveCall(); else joinCall(); }
    if (b.dataset.v === 'mute') toggleSelfMute();
    if (b.dataset.v === 'list') openSheet();
  });
  setInterval(() => { renderDock(); renderTalkers(); }, 1000);
}

function renderDock() {
  if (!dock) return;
  const on = voiceOn() && supported();
  if (dock.hidden === on) dock.hidden = !on;
  document.body.classList.toggle('ppv-on', on);
  dock._talk.hidden = !on;
  if (!on) { if (inCall) leaveCall(true); return; }
  const call = dock.querySelector('[data-v="call"]');
  call.classList.toggle('on', inCall);
  call.title = inCall ? 'Leave the call' : 'Join the live call';
  const n = inCallSet().size;
  const badge = n && !inCall ? `<small>${n}</small>` : '';
  if (call._h !== badge + inCall) { call.innerHTML = (inCall ? '📵' : '📞') + badge; call._h = badge + inCall; }
  const mute = dock.querySelector('[data-v="mute"]');
  mute.hidden = !inCall;
  mute.classList.toggle('muted', selfMuted);
  mute.textContent = selfMuted ? '🔇' : '🎤';
  dock.querySelector('[data-v="list"]').hidden = !(inCall || blocked.size || n);
  dock.querySelector('[data-v="ptt"]').classList.toggle('rec', !!rec);
}

const nameOf = (pid) => (o.players().find((p) => p.id === pid)?.name) || 'Someone';

function renderTalkers() {
  if (!dock) return;
  const now = Date.now();
  for (const [pid, at] of talking) if (now - at > 700) talking.delete(pid);
  const html = rec ? '<span>🔴 Recording… release to send</span>' : [...talking.keys()].slice(0, 4).map((pid) => `<span>🔊 ${esc(pid === me() ? 'You' : nameOf(pid))}</span>`).join('');
  if (dock._talk._h !== html) { dock._talk.innerHTML = html; dock._talk._h = html; }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function openSheet() {
  const back = document.createElement('div');
  back.className = 'ppv-sheet';
  const draw = () => {
    const calls = inCallSet();
    const ps = o.players().filter((p) => p.id !== me());
    back.innerHTML = `<div class="ppv-card"><h3>🎧 Voice</h3><p>Hold 🎙 to send a voice message. Join 📞 to talk live. Mute anyone you don't want to hear.</p>${ps.map((p) => `<div class="ppv-row"><b>${esc(p.name)}</b>${calls.has(p.id) ? '<i>● in call</i>' : ''}<button type="button" data-b="${esc(p.id)}" class="${blocked.has(p.id) ? 'x' : ''}">${blocked.has(p.id) ? '🔇 Muted' : '🔊 Mute'}</button></div>`).join('') || '<p>No one else is here yet.</p>'}<button type="button" class="ppv-close">Done</button></div>`;
  };
  draw();
  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('.ppv-close')) { back.remove(); return; }
    const b = e.target.closest('[data-b]');
    if (b) { toggleBlock(b.dataset.b); draw(); }
  });
  document.body.appendChild(back);
}
