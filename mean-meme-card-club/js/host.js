import { createHost } from './net.js';
import * as R from './rules.js';
import { loadDataset, buildLibrary, packNames, needsDataset, packLangs, presetPacks, catalogue } from './cards.js';

const SAVE_KEY = 'mmcc-host';
const ROUND_ACTS = new Set(['submit', 'reveal', 'revealAll', 'pick', 'swap', 'focus']);

function ticker(fn) {
  try {
    const src = 'setInterval(() => postMessage(0), 1000);';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = fn;
    return () => w.terminate();
  } catch {
    const id = setInterval(fn, 1000);
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

export function startHost({ code, me, resume, bots = 0, zh = false, onUpdate, onFx, onReady, onError, onToast }) {
  const s = resume ? resume.s : R.newGame(me.key);
  let lib = { white: [], black: [] };
  let libSig = resume ? resume.libSig : '';
  let dataset = null;
  const pidOf = new Map();
  const cidOf = new Map();
  const lastHand = new Map();
  const lastFx = new Map();
  const kicked = new Set(resume?.kicked || []);
  let seq = 0;
  let queued = false;
  let saveAt = 0;
  let destroyed = false;

  s.hostId = me.key;
  R.addPlayer(s, { id: me.key, name: me.name, avatar: me.avatar, color: me.color });
  if (resume) for (const p of s.players) if (p.id !== me.key && !p.bot) p.on = false;
  for (let i = 0; i < bots; i++) R.addPlayer(s, { id: 'bot' + i + Math.random().toString(36).slice(2, 6), name: 'Bot ' + (i + 1), avatar: '🤖', color: '#5c6370', bot: true });

  const text = (c) => (c.c < 0 ? c.t : lib.white[c.c]);
  const handOf = (pid) => (s.hands[pid] || []).map((c) => (c < 0 ? { c, blank: true } : { c, t: lib.white[c] }));

  function fill(blackText, answers) {
    let i = 0;
    let out = blackText.replace(/_+/g, () => (i < answers.length ? `[[${answers[i++].replace(/\.$/, '')}]]` : '____'));
    while (i < answers.length) out += ` [[${answers[i++]}]]`;
    return out;
  }

  function pub() {
    const showOwners = s.phase === 'result' || s.phase === 'over';
    const subs = s.phase === 'submit' || s.phase === 'wait' || s.phase === 'lobby'
      ? []
      : s.subs.map((x, i) => (s.phase === 'judge' && i >= s.reveal ? null : { cards: x.cards.map(text), pid: showOwners ? x.pid : undefined }));
    const { packs, ...settings } = s.settings;
    const names = packNames(dataset, packs);
    return {
      code,
      phase: s.phase,
      hostId: s.hostId,
      players: s.players.map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, score: p.score, on: p.on, bot: !!p.bot, rando: !!p.rando, spectator: p.spectator,
        sub: s.phase === 'submit' && s.subs.some((x) => x.pid === p.id),
      })),
      settings,
      packIds: packs,
      packCount: packs.length,
      packNames: names.slice(0, 8),
      mixed: packLangs(packs).length > 1,
      round: s.round,
      roundId: s.roundId,
      judge: s.judge,
      black: s.black && lib.black[s.black.i] ? { text: lib.black[s.black.i].text, pick: s.black.pick } : null,
      subCount: s.subs.length,
      subs,
      reveal: s.reveal,
      focus: s.focus ?? -1,
      winner: s.winner,
      left: s.deadline ? Math.max(0, s.deadline - Date.now()) : 0,
      dur: s.phase === 'submit' ? s.settings.submitSecs * 1000 : s.phase === 'judge' ? (s.settings.judgeSecs + 2 * s.subs.length) * 1000 : s.settings.nextSecs * 1000,
      note: s.note,
      podium: s.podium || [],
      hall: s.winners.slice(-12).reverse().map((w) => ({
        pid: w.pid, round: w.round, text: lib.black[w.black] ? fill(lib.black[w.black].text, w.cards.map(text)) : '',
      })),
      libSize: lib.white.length ? `${lib.white.length} answers · ${lib.black.length} prompts` : '',
    };
  }

  function save() {
    const now = Date.now();
    if (now - saveAt < 1500) return;
    saveAt = now;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ code, s, libSig, kicked: [...kicked], at: now, me })); } catch { /* quota */ }
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
        const h = JSON.stringify(s.hands[pid] || []);
        if (lastHand.get(pid) !== h) {
          lastHand.set(pid, h);
          net.send(cid, { t: 'hand', rid: s.roundId, cards: handOf(pid) });
        }
      }
      onUpdate(p, handOf(me.key));
      save();
    });
  }

  function sendFull(cid, pid) {
    net.send(cid, { t: 'state', seq, pub: pub() });
    lastHand.set(pid, JSON.stringify(s.hands[pid] || []));
    net.send(cid, { t: 'hand', rid: s.roundId, cards: handOf(pid) });
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
    if (ROUND_ACTS.has(m.a) && m.ctx !== s.roundId + ':' + s.phase) return 'stale';
    let err = null;
    switch (m.a) {
      case 'submit': {
        const texts = {};
        if (m.texts && typeof m.texts === 'object') for (const [k, v] of Object.entries(m.texts)) texts[Number(k)] = String(v);
        err = R.submit(s, pid, (m.ids || []).map(Number), texts);
        break;
      }
      case 'reveal': err = R.reveal(s, pid); break;
      case 'revealAll': err = R.reveal(s, pid, true); break;
      case 'pick': err = R.pick(s, pid, Number(m.idx)); if (!err) s.focus = -1; break;
      case 'focus':
        if (pid !== s.judge || s.phase !== 'judge') return 'not-now';
        s.focus = Number.isInteger(m.idx) && m.idx < s.reveal ? m.idx : -1;
        break;
      case 'swap': err = R.swapHand(s, pid); break;
      default: return 'unknown';
    }
    if (!err) flush();
    return err;
  }

  function hostAct(m) {
    switch (m.a) {
      case 'settings': {
        const st = s.settings;
        const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
        const p = m.patch || {};
        if (p.packs) st.packs = p.packs.filter((x) => typeof x === 'string').slice(0, 400);
        if ('goal' in p) st.goal = num(p.goal, 0, 50, st.goal);
        if ('hand' in p) st.hand = num(p.hand, 5, 15, st.hand);
        if ('submitSecs' in p) st.submitSecs = num(p.submitSecs, 0, 600, st.submitSecs);
        if ('judgeSecs' in p) st.judgeSecs = num(p.judgeSecs, 0, 600, st.judgeSecs);
        if ('blanks' in p) st.blanks = num(p.blanks, 0, 200, st.blanks);
        if ('swaps' in p) st.swaps = !!p.swaps;
        if ('rando' in p) R.setRando(s, !!p.rando);
        break;
      }
      case 'start':
        return startGame();
      case 'kick': {
        const cid = cidOf.get(m.pid);
        kicked.add(m.pid);
        if (cid) net.send(cid, { t: 'kicked' });
        R.removePlayer(s, m.pid);
        cidOf.delete(m.pid);
        break;
      }
      case 'bot':
        R.addPlayer(s, { id: 'bot' + Math.random().toString(36).slice(2, 8), name: 'Bot ' + (s.players.filter((p) => p.bot && !p.rando).length + 1), avatar: '🤖', color: '#5c6370', bot: true });
        break;
      case 'next':
        if (s.phase === 'result') R.startRound(s);
        else if (s.phase === 'wait') R.startRound(s);
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

  async function needDataset(packs) {
    if (!needsDataset(packs)) return null;
    if (dataset) return dataset;
    dataset = await loadDataset();
    return dataset;
  }

  async function startGame() {
    let ds = null;
    try {
      ds = await needDataset(s.settings.packs);
    } catch {
      onToast('Could not download the card packs. Starting with the club originals instead.', 'bad');
      s.settings.packs = ['s'];
    }
    lib = buildLibrary(ds, s.settings.packs);
    const seats = s.players.filter((p) => p.on && !p.spectator).length;
    const need = seats * (s.settings.hand + 3);
    if (lib.black.length < 3 || lib.white.length + s.settings.blanks < need) {
      onToast('Not enough answer cards for {n} players: these packs have {have}, you need at least {need}. Add more card packs.', 'bad', { n: seats, have: lib.white.length, need });
      flush();
      return 'too-few';
    }
    libSig = `${lib.white.length}/${lib.black.length}/${s.settings.packs.join(',')}`;
    R.startGame(s, lib);
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
        const p = R.addPlayer(s, { id: key, name: String(m.name || '').trim().slice(0, 20) || 'Player', avatar: String(m.avatar || '😈').slice(0, 8), color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#ff4d8d' });
        if (s.phase === 'wait') R.startRound(s);
        net.send(cid, { t: 'welcome', id: key, code, spectator: p.spectator });
        sendFull(cid, key);
        flush();
        return;
      }
      const pid = pidOf.get(cid);
      if (!pid) { net.send(cid, { t: 'rejoin' }); return; }
      if (m.t === 'act') {
        const err = act(pid, m);
        if (err && err !== 'stale' && err !== 'already') net.send(cid, { t: 'err', a: m.a, err });
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

  if (!resume && zh) {
    s.settings.packs = presetPacks(catalogue(null), 'zh');
  } else if (!resume) {
    needDataset(['x']).then((ds) => {
      const base = ds.packs.findIndex((p) => p.name === 'CAH Base Set');
      if (base >= 0 && s.phase === 'lobby' && s.settings.packs.join() === 's') {
        s.settings.packs = ['d' + base, 's'];
        flush();
      }
    }).catch(() => {});
  }

  const stopTick = ticker(() => {
    let changed = R.botStep(s);
    if (R.tick(s)) changed = true;
    if (changed) flush();
  });

  if (resume && s.deck) {
    needDataset(s.settings.packs).catch(() => null).then((ds) => {
      lib = buildLibrary(ds, s.settings.packs);
      if (`${lib.white.length}/${lib.black.length}/${s.settings.packs.join(',')}` !== libSig) {
        R.backToLobby(s);
        onToast('The card packs changed since this room was saved, so the game went back to the lobby.', 'bad');
      }
      flush();
    });
  }

  return {
    state: s,
    act: (m) => hostAct(m),
    react: (m) => fx(me.key, m),
    loadDataset: () => needDataset(['x']),
    debug: () => net.debug(),
    destroy() {
      destroyed = true;
      stopTick();
      net.destroy();
      clearSavedHost();
    },
  };
}
