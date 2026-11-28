import { createHost } from './net.js';
import * as R from './rules.js';

const SAVE_KEY = 'mow-host';

function ticker(fn) {
  try {
    const src = 'setInterval(() => postMessage(0), 200);';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
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

const cleanAvatar = (a) => (/^\d{1,2}-\d{1,2}$/.test(String(a)) ? String(a) : '0-0');

export function startHost({ code, me, resume, bots = 0, onUpdate, onReady, onError, onToast, onFx }) {
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
  if (resume) for (const p of s.players) if (p.id !== me.key && !p.bot) { p.on = false; p.offAt = Date.now(); }
  const addBot = () => {
    const n = s.players.filter((p) => p.bot).length + 1;
    R.addPlayer(s, { id: 'bot' + Math.random().toString(36).slice(2, 8), name: 'Bot ' + n, avatar: `${n % 12}-${(n * 5) % 9}`, color: ['#ffb020', '#39ff88', '#4cc9ff', '#ff5ea8', '#b18cff'][n % 5], bot: true });
  };
  for (let i = 0; i < bots; i++) addBot();

  function pub() {
    const pd = s.pending;
    const plan = R.deckPlan(s.settings, Math.max(2, s.phase === 'lobby' ? R.seated(s).length : s.order.length));
    return {
      code,
      phase: s.phase,
      hostId: s.hostId,
      round: s.round,
      stage: s.stage,
      turnId: s.turnId,
      who: s.who,
      turn: s.turn,
      turnsLeft: s.turnsLeft,
      dir: s.dir,
      left: s.deadline ? Math.max(0, s.deadline - Date.now()) : 0,
      dur: s.dur,
      deck: s.deck.length,
      discard: s.discard.slice(-6).map((c) => c.k),
      discardKinds: [...new Set(s.discard.map((c) => c.k))],
      discardCount: s.discard.length,
      pending: pd ? { by: pd.by, type: pd.type, k: pd.k, kinds: pd.kinds, target: pd.target, name: pd.name, hiss: pd.hiss } : null,
      bomb: s.bomb ? { pid: s.bomb.pid, crit: !!s.bomb.crit, held: !!s.bomb.held, up: !!s.bomb.card.up } : null,
      giveTo: s.stage === 'give' ? s.giveTo : null,
      crit: R.critPos(s),
      log: s.log,
      order: s.order,
      players: s.players.map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, bot: !!p.bot, on: p.on, out: !!p.out, place: p.place, wins: p.wins,
        spectator: !!p.spectator, cards: (s.hands[p.id] || []).length,
      })),
      settings: s.settings,
      plan: { copies: plan.copies, melt: plan.melt, crit: plan.crit, coolDeck: plan.coolDeck, ok: plan.ok, maxPlayers: plan.maxPlayers },
      timer: R.houseOn(s, 'timer'),
      reactMs: R.reactMs(s),
      winner: s.winner,
      sudden: s.sudden,
    };
  }

  const privOf = (pid) => ({ cards: s.hands[pid] || [], priv: s.priv[pid] || null, top: s.bomb && s.bomb.pid === pid ? s.bomb.card.k : null });

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
        const v = privOf(pid);
        const h = JSON.stringify(v);
        if (lastPriv.get(pid) !== h) {
          lastPriv.set(pid, h);
          net.send(cid, { t: 'hand', ...v });
        }
      }
      onUpdate(p, privOf(me.key));
      save();
    });
  }

  function sendFull(cid, pid) {
    net.send(cid, { t: 'state', seq, pub: pub() });
    const v = privOf(pid);
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
    if (m.ctx !== s.turnId) return 'stale';
    const now = Date.now();
    const ids = Array.isArray(m.ids) ? m.ids.map(Number).slice(0, 5) : [];
    let err;
    switch (m.a) {
      case 'play': err = R.play(s, pid, ids, { target: m.target, name: m.name }, now); break;
      case 'draw': err = R.draw(s, pid, false, now); break;
      case 'hiss': err = R.hiss(s, pid, ids[0], now); break;
      case 'cool': err = R.cool(s, pid, now); break;
      case 'hold': err = R.hold(s, pid, now); break;
      case 'place': err = R.place(s, pid, m.pos, now); break;
      case 'bury': err = R.bury(s, pid, m.pos, now); break;
      case 'give': err = R.give(s, pid, ids[0], now); break;
      case 'alter': err = R.alter(s, pid, Array.isArray(m.order) ? m.order.map(Number) : null, now); break;
      case 'salvage': err = R.salvage(s, pid, String(m.k || ''), now); break;
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
        const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
        const p = m.patch || {};
        for (const k of ['chaos', 'mega', 'party']) if (k in (p.packs || {})) st.packs[k] = !!p.packs[k];
        for (const k of ['timer', 'streak', 'sudden', 'double', 'nohiss']) if (k in (p.house || {})) st.house[k] = !!p.house[k];
        if ('hand' in p) st.hand = num(p.hand, 4, 9, st.hand);
        if ('turnSecs' in p) st.turnSecs = num(p.turnSecs, 10, 120, st.turnSecs);
        if ('reactSecs' in p) st.reactSecs = num(p.reactSecs, 2, 8, st.reactSecs);
        if ('suddenMins' in p) st.suddenMins = num(p.suddenMins, 2, 30, st.suddenMins);
        if ('voice' in p) st.voice = !!p.voice;
        break;
      }
      case 'start': {
        const err = R.startGame(s);
        if (err === 'need-2') onToast('You need at least 2 players. Add a bot or invite a friend.', 'bad');
        if (err === 'need-party') onToast('More than 5 players needs the Party Scaling pack.', 'bad');
        if (err === 'too-few') onToast('Not enough cards for this many players.', 'bad');
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
        if (s.phase === 'lobby') addBot();
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
    onData(cid, m, relayed) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'join') {
        const key = String(m.key || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
        if (!key || key === me.key) return;
        if (kicked.has(key)) { net.send(cid, { t: 'kicked' }); return; }
        const old = cidOf.get(key);
        if (old && old !== cid) pidOf.delete(old);
        pidOf.set(cid, key);
        cidOf.set(key, cid);
        const p = R.addPlayer(s, { id: key, name: String(m.name || '').trim().slice(0, 20) || 'Player', avatar: cleanAvatar(m.avatar), color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#ffb020' });
        net.send(cid, { t: 'welcome', id: key, code, spectator: p.spectator });
        sendFull(cid, key);
        flush();
        return;
      }
      const pid = pidOf.get(cid);
      if (!pid) { net.send(cid, { t: 'rejoin' }); return; }
      if (m.t === 'act') {
        const err = act(pid, m);
        if (err && err !== 'stale') net.send(cid, { t: 'err', a: m.a, err });
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
