import { createHost } from './net.js';
import * as R from './rules.js';

const SAVE_KEY = 'dr-host';
const BOT_EMOJI = ['🤖', '👾', '🦾', '🛰️', '🧠', '⚙️'];
const BOT_COLORS = ['#ffb020', '#39d98a', '#4cc9ff', '#ff5ea8', '#b18cff', '#ff7a45'];

function ticker(fn) {
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 200);'], { type: 'text/javascript' })));
    w.onmessage = fn;
    return () => w.terminate();
  } catch {
    const id = setInterval(fn, 200);
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

const cleanEmoji = (e) => (typeof e === 'string' && e.length <= 8 && e.trim() ? e : '🙂');

export function startHost({ code, me, resume, onUpdate, onReady, onError, onToast, onFx }) {
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
  R.addPlayer(s, { id: me.key, name: me.name, emoji: me.emoji, color: me.color });
  if (resume) for (const p of s.players) if (p.id !== me.key && !p.bot) R.setConnected(s, p.id, false);
  const addBot = () => {
    const n = s.players.filter((p) => p.bot).length + 1;
    R.addPlayer(s, { id: 'bot' + Math.random().toString(36).slice(2, 8), name: 'Bot ' + n, emoji: BOT_EMOJI[n % BOT_EMOJI.length], color: BOT_COLORS[n % BOT_COLORS.length], bot: true });
  };

  const pub = () => ({ code, ...R.publicView(s) });

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
      const p = pub();
      net.broadcast({ t: 'state', seq, pub: p });
      for (const [pid, cid] of cidOf) {
        const v = R.privateView(s, pid);
        const h = JSON.stringify(v);
        if (lastPriv.get(pid) !== h) {
          lastPriv.set(pid, h);
          net.send(cid, { t: 'hand', ...v });
        }
      }
      onUpdate(p, R.privateView(s, me.key));
      save();
    });
  }

  function sendFull(cid, pid) {
    net.send(cid, { t: 'state', seq, pub: pub() });
    const v = R.privateView(s, pid);
    lastPriv.set(pid, JSON.stringify(v));
    net.send(cid, { t: 'hand', ...v });
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
    if (s.phase !== 'play') return 'not-now';
    const now = Date.now();
    let err;
    switch (m.a) {
      case 'play': err = R.play(s, pid, { id: m.id, as: m.as, g: m.g, target: m.target, take: m.take, give: m.give, double: m.double }, now); break;
      case 'move': err = R.moveWild(s, pid, m.id, m.g); break;
      case 'end': err = R.endTurn(s, pid, now); break;
      case 'veto': err = R.veto(s, pid, m.for, now); break;
      case 'pay': err = R.pay(s, pid, Array.isArray(m.ids) ? m.ids.slice(0, 60) : [], now); break;
      case 'discard': err = R.discard(s, pid, Array.isArray(m.ids) ? m.ids.slice(0, 40) : [], now); break;
      default: return 'unknown';
    }
    if (!err) flush();
    return err;
  }

  function hostAct(m) {
    switch (m.a) {
      case 'settings': {
        if (s.phase !== 'lobby') return 'not-now';
        const st = s.settings;
        const p = m.patch || {};
        const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
        if ('timer' in p) st.timer = !!p.timer;
        if ('turnSecs' in p) st.turnSecs = num(p.turnSecs, 20, 180, st.turnSecs);
        if ('reactSecs' in p) st.reactSecs = num(p.reactSecs, 3, 12, st.reactSecs);
        break;
      }
      case 'start': {
        const err = R.startGame(s);
        if (err === 'need-2') onToast('You need at least 2 players. Add a bot or invite a friend.', 'bad');
        flush();
        return err;
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
        if (s.phase === 'lobby' && R.seated(s).length < R.MAX_PLAYERS) addBot();
        break;
      case 'lobby':
        R.backToLobby(s);
        break;
      case 'again':
        R.backToLobby(s);
        R.startGame(s);
        break;
      default:
        return act(me.key, m);
    }
    flush();
    return null;
  }

  const net = createHost(code, {
    onReady() { onReady(code); flush(); },
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
        const p = R.addPlayer(s, { id: key, name: String(m.name || '').trim().slice(0, 20) || 'Player', emoji: cleanEmoji(m.emoji), color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#ffb020' });
        net.send(cid, { t: 'welcome', id: key, code, spectator: p.spectator });
        sendFull(cid, key);
        flush();
        return;
      }
      const pid = pidOf.get(cid);
      if (!pid) { net.send(cid, { t: 'rejoin' }); return; }
      if (m.t === 'act') {
        const err = act(pid, m);
        if (err) net.send(cid, { t: 'err', a: m.a, err });
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
    const now = Date.now();
    let changed = R.botStep(s, now);
    if (R.tick(s, now)) changed = true;
    if (changed) flush();
  });

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
