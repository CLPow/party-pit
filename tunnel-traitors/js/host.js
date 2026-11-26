import { createHost } from './net.js';
import * as R from './rules.js';

const SAVE_KEY = 'tt-host';

function ticker(fn, ms) {
  try {
    const src = `setInterval(() => postMessage(0), ${ms});`;
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = fn;
    return () => w.terminate();
  } catch {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}

export function savedHost() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw && Date.now() - raw.at < 3 * 3600 * 1000) return raw;
  } catch { /* storage unavailable */ }
  return null;
}

export function clearSavedHost() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

let botNo = 0;
const BOT_NAMES = ['Rusty', 'Pebble', 'Gravel', 'Flint', 'Cobble', 'Shale', 'Nugget', 'Dusty', 'Clank', 'Boulder', 'Ember', 'Quartz', 'Tinker', 'Grit', 'Slate', 'Mica'];
const BOT_FACES = ['🤖', '🦾', '🛠️', '⚙️'];

export function startHost({ code, me, resume, bots = 0, onUpdate, onFx, onReady, onError }) {
  const s = resume ? resume.s : R.newGame(me.key);
  const pidOf = new Map();
  const cidOf = new Map();
  const lastPriv = new Map();
  const lastFx = new Map();
  const kicked = new Set(resume?.kicked || []);
  let seq = 0;
  let queued = false;
  let saveAt = 0;
  let destroyed = false;

  s.hostId = me.key;
  R.addPlayer(s, { id: me.key, name: me.name, avatar: me.avatar, color: me.color });
  if (resume) for (const p of s.players) if (p.id !== me.key && !p.bot) p.on = false;
  const addBot = () => {
    const n = s.players.filter((p) => p.bot).length;
    R.addPlayer(s, { id: 'bot' + (botNo++) + Math.random().toString(36).slice(2, 6), name: BOT_NAMES[n % BOT_NAMES.length] + (n >= BOT_NAMES.length ? ' ' + (Math.floor(n / BOT_NAMES.length) + 1) : ''), avatar: BOT_FACES[n % BOT_FACES.length], color: '#7d8590', bot: true });
  };
  for (let i = 0; i < bots; i++) addBot();

  function save() {
    const now = Date.now();
    if (now - saveAt < 1500) return;
    saveAt = now;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ code, s, kicked: [...kicked], at: now, me })); } catch { /* quota */ }
  }

  function flush() {
    if (queued || destroyed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (destroyed) return;
      seq++;
      const p = R.publicState(s);
      p.code = code;
      net.broadcast({ t: 'state', seq, pub: p });
      for (const [pid, cid] of cidOf) {
        const pr = R.privateState(s, pid);
        const j = JSON.stringify(pr);
        if (lastPriv.get(pid) !== j) {
          lastPriv.set(pid, j);
          net.send(cid, { t: 'priv', priv: pr });
        }
      }
      onUpdate(p, R.privateState(s, me.key));
      save();
    });
  }

  function sendFull(cid, pid) {
    const p = R.publicState(s);
    p.code = code;
    net.send(cid, { t: 'state', seq, pub: p });
    const pr = R.privateState(s, pid);
    lastPriv.set(pid, JSON.stringify(pr));
    net.send(cid, { t: 'priv', priv: pr });
  }

  function fx(pid, m) {
    const now = Date.now();
    if (now - (lastFx.get(pid) || 0) < 350) return;
    lastFx.set(pid, now);
    let out = null;
    if (m.t === 'react' && typeof m.e === 'string' && m.e.length <= 8) out = { t: 'fx', k: 'react', from: pid, e: m.e };
    if (m.t === 'chat' && typeof m.text === 'string' && m.text.trim()) out = { t: 'fx', k: 'chat', from: pid, text: m.text.trim().slice(0, 140) };
    if (!out) return;
    net.broadcast(out);
    onFx(out);
  }

  function act(pid, m) {
    if (m.a !== 'play' && m.a !== 'claim') return 'unknown';
    if (m.ctx !== s.roundId + ':' + s.turnNo) return 'stale';
    if (m.a === 'claim') {
      const voice = typeof m.voice === 'string' && /^data:audio\/[\w.+-]+(;[\w=.+-]+)*;base64,[A-Za-z0-9+/=]+$/.test(m.voice) && m.voice.length < 220000 ? m.voice : null;
      const goal = s.await?.goal;
      const err = R.claim(s, pid, { says: m.says, text: m.text, voice: !!voice });
      if (err) return err;
      if (voice) {
        const out = { t: 'fx', k: 'voice', from: pid, goal, data: voice };
        net.broadcast(out);
        onFx(out);
      }
      flush();
      return null;
    }
    const err = R.play(s, pid, m);
    if (!err) flush();
    return err;
  }

  function hostAct(m) {
    switch (m.a) {
      case 'settings': {
        if (s.phase !== 'lobby') return 'not-now';
        const st = s.settings;
        const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
        const p = m.patch || {};
        if (Array.isArray(p.packs)) st.packs = R.PACKS.map((x) => x.id).filter((id) => p.packs.includes(id));
        if ('rounds' in p) st.rounds = num(p.rounds, 1, 5, st.rounds);
        if ('turnSecs' in p) st.turnSecs = num(p.turnSecs, 0, 300, st.turnSecs);
        if ('traitors' in p) st.traitors = num(p.traitors, 0, 16, st.traitors);
        if ('hand' in p) st.hand = num(p.hand, 0, 8, st.hand);
        if ('revealRoles' in p) st.revealRoles = !!p.revealRoles;
        break;
      }
      case 'start': {
        const n = s.players.filter((p) => !p.spectator).length;
        if (n < 3) return 'too-few';
        R.startGame(s);
        break;
      }
      case 'kick': {
        const cid = cidOf.get(m.pid);
        kicked.add(m.pid);
        if (cid) net.send(cid, { t: 'kicked' });
        R.removePlayer(s, m.pid);
        cidOf.delete(m.pid);
        break;
      }
      case 'bot':
        addBot();
        break;
      case 'next':
        if (s.phase === 'end') R.startRound(s);
        break;
      case 'skip':
        if (s.phase === 'play') R.autoMove(s, s.turn);
        break;
      case 'lobby':
        R.backToLobby(s);
        break;
      default:
        return act(me.key, m);
    }
    flush();
    return null;
  }

  const net = createHost(code, {
    onReady() {
      onReady(code);
      flush();
    },
    onError(e) { onError(e); },
    onClose(cid) {
      const pid = pidOf.get(cid);
      pidOf.delete(cid);
      if (!pid || cidOf.get(pid) !== cid) return;
      cidOf.delete(pid);
      if (s.phase === 'lobby') R.removePlayer(s, pid);
      else R.setConnected(s, pid, false);
      flush();
    },
    onData(cid, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'join') {
        const key = String(m.key || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
        if (!key || key === me.key) return;
        if (kicked.has(key)) { net.send(cid, { t: 'kicked' }); return; }
        const old = cidOf.get(key);
        if (old && old !== cid) pidOf.delete(old);
        pidOf.set(cid, key);
        cidOf.set(key, cid);
        const p = R.addPlayer(s, { id: key, name: String(m.name || '').trim().slice(0, 20) || 'Miner', avatar: String(m.avatar || '⛏️').slice(0, 8), color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#f5a524' });
        net.send(cid, { t: 'welcome', id: key, code, spectator: p.spectator, wait: p.wait });
        sendFull(cid, key);
        flush();
        return;
      }
      const pid = pidOf.get(cid);
      if (!pid) { net.send(cid, { t: 'rejoin' }); return; }
      if (m.t === 'act') {
        const err = act(pid, m);
        if (err && err !== 'stale') net.send(cid, { t: 'err', err });
        return;
      }
      if (m.t === 'react' || m.t === 'chat') { fx(pid, m); return; }
      if (m.t === 'leave') {
        cidOf.delete(pid);
        pidOf.delete(cid);
        R.removePlayer(s, pid);
        flush();
      }
    },
  });

  const stopTick = ticker(() => {
    let changed = R.botStep(s);
    if (R.tick(s)) changed = true;
    if (changed) flush();
  }, 250);

  return {
    state: s,
    act: (m) => hostAct(m),
    react: (m) => fx(me.key, m),
    debug: () => net.debug(),
    destroy() {
      destroyed = true;
      stopTick();
      net.destroy();
      clearSavedHost();
    },
  };
}
