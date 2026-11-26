export const MAX_PLAYERS = 50;
export const RANDO_ID = 'rando';
export const DEFAULTS = {
  packs: ['s'],
  goal: 8,
  hand: 10,
  submitSecs: 90,
  judgeSecs: 60,
  rando: false,
  blanks: 0,
  swaps: true,
  nextSecs: 7,
};

export function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(hostId) {
  return {
    phase: 'lobby',
    hostId,
    players: [],
    settings: { ...DEFAULTS },
    round: 0,
    roundId: '',
    judge: null,
    black: null,
    subs: [],
    reveal: 0,
    winner: null,
    deadline: 0,
    hands: {},
    deck: null,
    note: '',
    winners: [],
  };
}

export const player = (s, id) => s.players.find((p) => p.id === id);
const active = (p) => p.on && !p.spectator;

export function addPlayer(s, info) {
  const existing = player(s, info.id);
  if (existing) {
    existing.on = true;
    Object.assign(existing, { name: info.name || existing.name, avatar: info.avatar || existing.avatar, color: info.color || existing.color });
    return existing;
  }
  const humans = s.players.filter((p) => p.id !== RANDO_ID).length;
  const p = {
    id: info.id,
    name: (info.name || 'Player').slice(0, 20),
    avatar: info.avatar || '😈',
    color: info.color || '#ff4d8d',
    score: 0,
    on: true,
    bot: !!info.bot,
    spectator: humans >= MAX_PLAYERS,
  };
  s.players.push(p);
  if (s.deck && !p.spectator) deal(s, p.id);
  return p;
}

export function setConnected(s, id, on, rnd = Math.random, now = Date.now()) {
  const p = player(s, id);
  if (!p) return;
  p.on = on;
  if (!on) afterLeave(s, id, rnd, now);
}

export function removePlayer(s, id, rnd = Math.random, now = Date.now()) {
  const p = player(s, id);
  if (!p) return;
  if (s.deck && s.hands[id]) s.deck.wd.push(...s.hands[id]);
  delete s.hands[id];
  s.subs = s.subs.filter((x) => x.pid !== id || s.phase !== 'submit');
  s.players = s.players.filter((x) => x.id !== id);
  afterLeave(s, id, rnd, now);
}

function afterLeave(s, id, rnd, now) {
  if (s.phase === 'submit' || s.phase === 'judge') {
    if (s.judge === id) {
      voidRound(s, 'The judge left, so this round was skipped.');
      startRound(s, rnd, now);
      return;
    }
    if (s.phase === 'submit') maybeAllIn(s, rnd, now);
  }
  if (s.phase === 'wait') startRound(s, rnd, now);
}

export function setRando(s, on) {
  s.settings.rando = on;
  const has = player(s, RANDO_ID);
  if (on && !has) s.players.push({ id: RANDO_ID, name: 'Rando the Bot', avatar: '🤖', color: '#8a8f98', score: 0, on: true, bot: true, rando: true, spectator: false });
  if (!on && has) {
    if (s.deck && s.hands[RANDO_ID]) s.deck.wd.push(...s.hands[RANDO_ID]);
    delete s.hands[RANDO_ID];
    s.players = s.players.filter((p) => p.id !== RANDO_ID);
  }
}

function drawWhite(s, rnd) {
  const d = s.deck;
  if (!d.w.length) {
    d.w = shuffle(d.wd, rnd);
    d.wd = [];
  }
  return d.w.length ? d.w.pop() : null;
}

function drawBlack(s, rnd) {
  const d = s.deck;
  if (!d.b.length) {
    d.b = shuffle(d.bd, rnd);
    d.bd = [];
  }
  return d.b.length ? d.b.pop() : null;
}

export function deal(s, id, rnd = Math.random) {
  const hand = (s.hands[id] = s.hands[id] || []);
  while (hand.length < s.settings.hand) {
    const c = drawWhite(s, rnd);
    if (c === null) break;
    hand.push(c);
  }
}

export function startGame(s, lib, rnd = Math.random, now = Date.now()) {
  const blanks = Array.from({ length: s.settings.blanks }, (_, i) => -(i + 1));
  s.deck = {
    w: shuffle([...lib.white.keys(), ...blanks], rnd),
    b: shuffle([...lib.black.keys()], rnd),
    wd: [],
    bd: [],
    pick: lib.black.map((b) => b.pick),
  };
  s.hands = {};
  s.winners = [];
  s.round = 0;
  s.judge = null;
  s.judgePos = -1;
  for (const p of s.players) p.score = 0;
  for (const p of s.players) if (!p.spectator) deal(s, p.id, rnd);
  startRound(s, rnd, now);
}

const judgeable = (s) => s.players.filter((p) => active(p) && !p.rando);

export function submitters(s) {
  return s.players.filter((p) => active(p) && p.id !== s.judge);
}

export function startRound(s, rnd = Math.random, now = Date.now()) {
  const pool = judgeable(s);
  if (pool.length + (s.settings.rando ? 1 : 0) < 3 || pool.length < 2) {
    s.phase = 'wait';
    s.note = 'Waiting for at least 3 players.';
    s.deadline = 0;
    s.subs = [];
    return;
  }
  const lastPos = s.judgePos ?? -1;
  const next = pool.find((p) => s.players.indexOf(p) > lastPos) || pool[0];
  s.judgePos = s.players.indexOf(next);
  const b = drawBlack(s, rnd);
  if (b === null) {
    s.phase = 'over';
    s.note = 'The prompt deck ran out.';
    finish(s);
    return;
  }
  s.round += 1;
  s.roundId = s.round + '-' + Math.floor(rnd() * 1e6).toString(36);
  s.judge = next.id;
  s.black = { i: b, pick: s.deck.pick[b] || 1 };
  s.subs = [];
  s.reveal = 0;
  s.winner = null;
  s.note = '';
  s.phase = 'submit';
  s.deadline = s.settings.submitSecs ? now + s.settings.submitSecs * 1000 : 0;
  for (const p of s.players) if (!p.spectator) deal(s, p.id, rnd);
  if (s.settings.rando) randoPlay(s, rnd);
}

function randoPlay(s, rnd) {
  const hand = s.hands[RANDO_ID] || [];
  const picks = shuffle(hand.filter((c) => c >= 0), rnd).slice(0, s.black.pick);
  if (picks.length === s.black.pick) submit(s, RANDO_ID, picks, {}, rnd, Date.now());
}

export function submit(s, pid, ids, texts = {}, rnd = Math.random, now = Date.now()) {
  if (s.phase !== 'submit' || pid === s.judge) return 'not-now';
  const p = player(s, pid);
  if (!p || p.spectator) return 'not-playing';
  if (s.subs.some((x) => x.pid === pid)) return 'already';
  if (!Array.isArray(ids) || ids.length !== s.black.pick || new Set(ids).size !== ids.length) return 'bad-count';
  const hand = s.hands[pid] || [];
  if (!ids.every((c) => hand.includes(c))) return 'not-in-hand';
  const cards = ids.map((c) => {
    if (c >= 0) return { c };
    const t = String(texts[c] || '').trim().slice(0, 120);
    return { c, t: t || '(blank)' };
  });
  s.hands[pid] = hand.filter((c) => !ids.includes(c));
  s.subs.push({ pid, cards });
  maybeAllIn(s, rnd, now);
  return null;
}

function maybeAllIn(s, rnd, now) {
  if (s.phase !== 'submit') return;
  const need = submitters(s);
  if (need.length && need.every((p) => s.subs.some((x) => x.pid === p.id))) toJudge(s, rnd, now);
}

function toJudge(s, rnd, now) {
  if (!s.subs.length) {
    voidRound(s, 'Nobody played a card, so this round was skipped.');
    startRound(s, rnd, now);
    return;
  }
  shuffle(s.subs, rnd);
  s.phase = 'judge';
  s.reveal = 0;
  s.deadline = s.settings.judgeSecs ? now + (s.settings.judgeSecs + 2 * s.subs.length) * 1000 : 0;
}

function voidRound(s, note) {
  if (!s.deck) return;
  for (const sub of s.subs) {
    const back = sub.cards.map((x) => x.c);
    if (s.hands[sub.pid]) s.hands[sub.pid].push(...back);
    else s.deck.wd.push(...back.filter((c) => c >= 0));
  }
  if (s.black) s.deck.bd.push(s.black.i);
  s.subs = [];
  s.black = null;
  s.note = note;
}

export function reveal(s, pid, all = false) {
  if (s.phase !== 'judge' || pid !== s.judge) return 'not-now';
  s.reveal = all ? s.subs.length : Math.min(s.subs.length, s.reveal + 1);
  return null;
}

export function pick(s, pid, idx, rnd = Math.random, now = Date.now()) {
  if (s.phase !== 'judge' || pid !== s.judge) return 'not-now';
  if (s.reveal < s.subs.length) return 'reveal-first';
  const sub = s.subs[idx];
  if (!sub) return 'bad-pick';
  award(s, idx, now);
  return null;
}

function award(s, idx, now) {
  const sub = s.subs[idx];
  const w = player(s, sub.pid);
  if (w) w.score += 1;
  s.winner = { idx, pid: sub.pid };
  s.winners.push({ round: s.round, pid: sub.pid, black: s.black.i, cards: sub.cards });
  if (s.winners.length > 40) s.winners.shift();
  for (const x of s.subs) s.deck.wd.push(...x.cards.map((c) => c.c).filter((c) => c >= 0));
  s.deck.wd.push(...s.subs.flatMap((x) => x.cards.map((c) => c.c)).filter((c) => c < 0));
  s.deck.bd.push(s.black.i);
  if (s.settings.goal && w && w.score >= s.settings.goal) {
    s.phase = 'over';
    s.deadline = 0;
    finish(s);
    return;
  }
  s.phase = 'result';
  s.deadline = now + s.settings.nextSecs * 1000;
}

function finish(s) {
  s.podium = [...s.players].filter((p) => !p.spectator).sort((a, b) => b.score - a.score).slice(0, 3).map((p) => p.id);
}

export function swapHand(s, pid, rnd = Math.random) {
  const p = player(s, pid);
  if (!s.settings.swaps || !p || p.score < 1 || s.phase !== 'submit' || pid === s.judge) return 'not-now';
  if (s.subs.some((x) => x.pid === pid)) return 'already';
  p.score -= 1;
  s.deck.wd.push(...(s.hands[pid] || []));
  s.hands[pid] = [];
  deal(s, pid, rnd);
  return null;
}

export function backToLobby(s) {
  s.phase = 'lobby';
  s.deck = null;
  s.hands = {};
  s.subs = [];
  s.black = null;
  s.judge = null;
  s.winner = null;
  s.deadline = 0;
  s.note = '';
  for (const p of s.players) p.score = 0;
}

export function tick(s, rnd = Math.random, now = Date.now()) {
  if (!s.deadline || now < s.deadline) return false;
  if (s.phase === 'submit') {
    for (const p of submitters(s)) {
      if (s.subs.some((x) => x.pid === p.id)) continue;
      const hand = (s.hands[p.id] || []).filter((c) => c >= 0);
      const picks = shuffle([...hand], rnd).slice(0, s.black.pick);
      if (picks.length === s.black.pick) submit(s, p.id, picks, {}, rnd, now);
    }
    if (s.phase === 'submit') toJudge(s, rnd, now);
    return true;
  }
  if (s.phase === 'judge') {
    s.reveal = s.subs.length;
    award(s, Math.floor(rnd() * s.subs.length), now);
    s.note = 'The judge ran out of time, so a random card won.';
    return true;
  }
  if (s.phase === 'result') {
    startRound(s, rnd, now);
    return true;
  }
  return false;
}

export function botStep(s, rnd = Math.random, now = Date.now()) {
  let changed = false;
  if (s.phase === 'submit') {
    for (const p of submitters(s)) {
      if (!p.bot || p.rando || s.subs.some((x) => x.pid === p.id) || rnd() < 0.5) continue;
      const hand = (s.hands[p.id] || []).filter((c) => c >= 0);
      const picks = shuffle([...hand], rnd).slice(0, s.black.pick);
      if (picks.length === s.black.pick && !submit(s, p.id, picks, {}, rnd, now)) changed = true;
    }
  } else if (s.phase === 'judge') {
    const j = player(s, s.judge);
    if (j && j.bot && rnd() < 0.6) {
      if (s.reveal < s.subs.length) reveal(s, j.id);
      else pick(s, j.id, Math.floor(rnd() * s.subs.length), rnd, now);
      changed = true;
    }
  }
  return changed;
}
