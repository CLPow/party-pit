import { audioCtx, sfx, getSfxVolume, holdAudio } from './fx.js';
import { duck } from './music.js';

const RATE = 16000;
const FRAME = 1600;
const VAD = 0.012;
const HOLD = 4;
const CLIP_MAX_MS = 10000;
const MAX_LEAD = 0.6;

let o = null;
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
export const stats = { tx: 0, rx: 0, played: 0, clipsTx: 0, clipsRx: 0, listenOnly: false };
window.__mowVoice = stats;
const present = new Map();
const blocked = new Set();

export function initVoice(opts) {
  o = opts;
}

export const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
export const isInCall = () => inCall;
export const isSelfMuted = () => selfMuted;
export const isBlocked = (pid) => blocked.has(pid);
export const inCallSet = () => {
  const now = Date.now();
  const out = new Set();
  for (const [pid, at] of present) if (now - at < 25000) out.add(pid);
  if (inCall) out.add(o.me());
  return out;
};

export function toggleBlock(pid) {
  if (blocked.has(pid)) blocked.delete(pid);
  else blocked.add(pid);
  return blocked.has(pid);
}

function gainNode() {
  const ctx = audioCtx();
  if (!ctx) return null;
  if (!voiceGain) {
    voiceGain = ctx.createGain();
    voiceGain.connect(ctx.destination);
  }
  voiceGain.gain.value = Math.max(0.6, getSfxVolume() + 0.3);
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
    o.send({ t: 'vo', k: 'f', from: o.me(), s: seq++, d: toB64(bytes), lv: Math.min(1, rms * 8) });
    stats.tx++;
    o.onSpeaking(o.me(), Math.min(1, rms * 8));
  }
}

const WORKLET = `class MowCap extends AudioWorkletProcessor { constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; } process(inputs) { const ch = inputs[0] && inputs[0][0]; if (!ch) return true; this.buf.set(ch, this.n); this.n += ch.length; if (this.n + 128 > this.buf.length) { const out = this.buf.slice(0, this.n); this.port.postMessage(out, [out.buffer]); this.n = 0; } return true; } } registerProcessor('mow-cap', MowCap);`;

async function micStream() {
  if (stream && stream.getAudioTracks().some((t) => t.readyState === 'live')) return stream;
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  return stream;
}

export async function joinCall() {
  if (inCall) return true;
  if (!supported()) { o.toast('Voice is not supported in this browser.', 'bad'); return false; }
  const ctx = audioCtx();
  if (!ctx) return false;
  let mic = true;
  try { await micStream(); } catch { mic = false; }
  stats.listenOnly = !mic;
  inCall = true;
  holdAudio('voice', true);
  selfMuted = !mic;
  acc = new Float32Array(0);
  o.send({ t: 'vo', k: 'join', from: o.me() });
  hereTimer = setInterval(() => o.send({ t: 'vo', k: 'here', from: o.me() }), 10000);
  if (!mic) {
    o.toast('No microphone access, so you joined the call as a listener.', 'bad');
    o.onChange();
    return true;
  }
  src = ctx.createMediaStreamSource(stream);
  sink = ctx.createGain();
  sink.gain.value = 0;
  sink.connect(ctx.destination);
  try {
    if (!ctx.audioWorklet) throw new Error('no worklet');
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
    capNode = new AudioWorkletNode(ctx, 'mow-cap');
    capNode.port.onmessage = (e) => onCapture(e.data, ctx.sampleRate);
  } catch {
    capNode = ctx.createScriptProcessor(2048, 1, 1);
    capNode.onaudioprocess = (e) => onCapture(e.inputBuffer.getChannelData(0).slice(0), ctx.sampleRate);
  }
  src.connect(capNode);
  capNode.connect(sink);
  sfx.turn();
  o.onChange();
  return true;
}

export function leaveCall(silent = false) {
  if (!inCall) return;
  inCall = false;
  holdAudio('voice', false);
  clearInterval(hereTimer);
  try { src && src.disconnect(); capNode && capNode.disconnect(); sink && sink.disconnect(); } catch { /* already disconnected */ }
  if (capNode && capNode.port) capNode.port.onmessage = null;
  capNode = null;
  src = null;
  if (!rec) releaseMic();
  if (!silent) o.send({ t: 'vo', k: 'leave', from: o.me() });
  for (const p of peers.values()) p.next = 0;
  o.onChange();
}

function releaseMic() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

export function toggleSelfMute() {
  if (stats.listenOnly) { o.toast('Allow microphone access to talk.', 'bad'); return true; }
  selfMuted = !selfMuted;
  o.onChange();
  return selfMuted;
}

export async function startPTT() {
  if (rec) return false;
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
    o.onChange();
    if (dur < 400) { o.toast('Hold the 🎙 button while you talk.'); return; }
    const blob = new Blob(chunks, { type: r.mimeType || mime || 'audio/webm' });
    const fr = new FileReader();
    fr.onload = () => {
      const d = String(fr.result);
      if (d.length > 215000) { o.toast('That message was too long.', 'bad'); return; }
      o.send({ t: 'vo', k: 'clip', from: o.me(), d, dur });
      stats.clipsTx++;
      sfx.pop();
    };
    fr.readAsDataURL(blob);
  };
  recCap = setTimeout(() => stopPTT(), CLIP_MAX_MS);
  r.start();
  sfx.click();
  o.onChange();
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
  setTimeout(() => o.onSpeaking(from, lv || 0.4), Math.max(0, at));
  duck(0.2);
}

function nextClip() {
  if (clipPlaying || !clipQueue.length) return;
  const { from, d, dur } = clipQueue.shift();
  clipPlaying = true;
  const a = new Audio(d);
  a.volume = Math.min(1, Math.max(0.6, getSfxVolume() + 0.3));
  const pulse = setInterval(() => { o.onSpeaking(from, 0.35 + Math.random() * 0.5); duck(0.2); }, 120);
  const done = () => { clearInterval(pulse); clipPlaying = false; o.onSpeaking(from, 0); setTimeout(nextClip, 150); };
  a.onended = done;
  a.onerror = done;
  setTimeout(() => { if (clipPlaying && !a.ended) { a.pause(); done(); } }, (dur || CLIP_MAX_MS) + 2500);
  o.onClip(from);
  a.play().catch(done);
}

export function handle(m) {
  if (!m || typeof m.from !== 'string' || m.from === o.me()) return;
  if (!o.enabled()) return;
  if (m.k === 'join' || m.k === 'here') { present.set(m.from, Date.now()); if (m.k === 'join') o.onChange(); return; }
  if (m.k === 'leave') { present.delete(m.from); peers.delete(m.from); o.onChange(); return; }
  if (blocked.has(m.from)) return;
  if (m.k === 'f' && typeof m.d === 'string' && m.d.length < 4000) {
    if (!present.has(m.from)) { present.set(m.from, Date.now()); o.onChange(); } else present.set(m.from, Date.now());
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
  if (!m || m.t !== 'vo' || typeof m.k !== 'string') return false;
  if (m.k === 'f') return typeof m.d === 'string' && m.d.length < 4000 && /^[A-Za-z0-9+/=]+$/.test(m.d);
  if (m.k === 'clip') return typeof m.d === 'string' && m.d.length < 220000 && /^data:audio\/[\w.+-]+(;[\w=.+-]+)*;base64,[A-Za-z0-9+/=]+$/.test(m.d);
  return ['join', 'here', 'leave'].includes(m.k);
}
