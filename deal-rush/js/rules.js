export const GROUPS = [
  { id: 'af', name: 'Africa', color: '#a0673f', size: 2, rent: [1, 2], v: 1, cities: ['Lagos', 'Cairo'] },
  { id: 'sa', name: 'South America', color: '#5bc0eb', size: 3, rent: [1, 2, 3], v: 1, cities: ['Lima', 'Bogotá', 'Buenos Aires'] },
  { id: 'si', name: 'South Asia', color: '#e056a0', size: 3, rent: [1, 2, 4], v: 2, cities: ['Dhaka', 'Mumbai', 'Delhi'] },
  { id: 'se', name: 'Southeast Asia', color: '#f79824', size: 3, rent: [1, 3, 5], v: 2, cities: ['Manila', 'Jakarta', 'Bangkok'] },
  { id: 'me', name: 'Middle East', color: '#e63946', size: 3, rent: [2, 3, 6], v: 3, cities: ['Istanbul', 'Doha', 'Dubai'] },
  { id: 'ce', name: 'Central Europe', color: '#f4d03f', size: 3, rent: [2, 4, 6], v: 3, cities: ['Warsaw', 'Prague', 'Vienna'] },
  { id: 'oc', name: 'Oceania', color: '#2ec4b6', size: 3, rent: [2, 4, 7], v: 4, cities: ['Auckland', 'Melbourne', 'Sydney'] },
  { id: 'ea', name: 'East Asia', color: '#8338ec', size: 3, rent: [3, 5, 8], v: 4, cities: ['Seoul', 'Hong Kong', 'Tokyo'] },
  { id: 'ge', name: 'Global Elite', color: '#22304a', size: 2, rent: [3, 8], v: 4, cities: ['Zurich', 'London'] },
  { id: 'ap', name: 'Airports', color: '#6b7a8f', size: 4, rent: [1, 2, 3, 4], v: 2, cities: ['North Gate', 'East Bay', 'South Port', 'West Wind'], noUp: true },
  { id: 'ut', name: 'Utilities', color: '#9bb53a', size: 2, rent: [1, 2], v: 2, cities: ['Power Grid', 'Waterworks'], noUp: true },
];
export const G = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

const WILD_PAIRS = [['af', 'sa', 1], ['si', 'se', 2], ['me', 'ce', 3], ['oc', 'ea', 4], ['ge', 'ap', 4], ['ap', 'ut', 2], ['sa', 'ap', 4], ['me', 'se', 3]];
const RENT_PAIRS = [['af', 'sa'], ['si', 'se'], ['me', 'ce'], ['oc', 'ea'], ['ge', 'ap'], ['ap', 'ut']];

export const ACTIONS = {
  payday: { name: 'Payday', icon: '💸', v: 1, text: 'Draw 2 cards.' },
  house: { name: 'Housewarming', icon: '🎁', v: 2, text: 'Every other player pays you 2M.' },
  debt: { name: 'Debt Collector', icon: '🧾', v: 3, text: 'One player pays you 5M.' },
  swipe: { name: 'Swipe', icon: '🫳', v: 3, text: "Take one city from another player. Not from a complete set." },
  swap: { name: 'Swap', icon: '🔁', v: 3, text: 'Swap one of your cities for one of theirs. Not from complete sets.' },
  takeover: { name: 'Hostile Takeover', icon: '🏴', v: 5, text: 'Take a complete set from another player, upgrades included.' },
  veto: { name: 'Veto', icon: '✋', v: 4, text: 'Cancel an action played against you. A Veto can be vetoed.' },
  double: { name: 'Double Up', icon: '✖️', v: 1, text: 'Play with a rent card to double the rent. Uses a play.' },
  sky: { name: 'Skyscraper', icon: '🏢', v: 3, text: 'Add to a complete set: +3M rent. Not Airports or Utilities.' },
  term: { name: 'Terminal', icon: '🛫', v: 4, text: 'Add to a set with a Skyscraper: +4M rent.' },
};
const ACTION_COUNTS = { payday: 10, house: 3, debt: 3, swipe: 3, swap: 3, takeover: 2, veto: 3, double: 2, sky: 3, term: 2 };
const MONEY_COUNTS = { 1: 6, 2: 5, 3: 3, 4: 3, 5: 2, 10: 1 };

export const HAND_MAX = 7;
export const PLAYS = 3;
export const setsToWin = (n) => (n <= 5 ? 3 : n <= 10 ? 4 : n <= 15 ? 5 : 6);
export const MAX_PLAYERS = 20;
const LOG_KEEP = 60;
const BOT_MS = 900;
const QUIET_MS = 1100;

export function cardInfo(k) {
  if (k[0] === 'm') return { type: 'money', v: Number(k.slice(1)), name: k.slice(1) + 'M' };
  if (k.startsWith('p:')) {
    const [, g, i] = k.split(':');
    return { type: 'prop', g, gs: [g], v: G[g].v, name: G[g].cities[Number(i)] };
  }
  if (k === 'wa') return { type: 'wild', gs: GROUPS.map((x) => x.id), v: 0, name: 'Any City', any: true };
  if (k.startsWith('w:')) {
    const [, a, b, v] = k.split(':');
    return { type: 'wild', gs: [a, b], v: Number(v), name: `${G[a].name} / ${G[b].name}` };
  }
  if (k === 'ra') return { type: 'rent', gs: GROUPS.map((x) => x.id), v: 3, name: 'Any Rent', any: true };
  if (k.startsWith('r:')) {
    const [, a, b] = k.split(':');
    return { type: 'rent', gs: [a, b], v: 1, name: 'Rent' };
  }
  const a = ACTIONS[k];
  return { type: 'action', v: a.v, name: a.name };
}

export function deckKinds() {
  const out = [];
  for (const g of GROUPS) g.cities.forEach((_, i) => out.push(`p:${g.id}:${i}`));
  for (const [a, b, v] of WILD_PAIRS) out.push(`w:${a}:${b}:${v}`);
  out.push('wa', 'wa');
  for (const [v, n] of Object.entries(MONEY_COUNTS)) for (let i = 0; i < n; i++) out.push('m' + v);
  for (const [a, b] of RENT_PAIRS) out.push(`r:${a}:${b}`, `r:${a}:${b}`);
  out.push('ra', 'ra', 'ra');
  for (const [k, n] of Object.entries(ACTION_COUNTS)) for (let i = 0; i < n; i++) out.push(k);
  return out;
}

export const decksFor = (n) => Math.max(1, Math.ceil(n / 5));

function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(hostId) {
  return {
    phase: 'lobby', hostId, players: [], order: [], turn: null, plays: 0, turnId: 0, round: 0,
    cards: [], deck: [], discard: [], hands: {}, bank: {}, table: {}, ups: {},
    stage: null, pending: null, deadline: 0, dur: 0, log: [], n: 0, winner: null, botAt: 0,
    settings: { timer: true, turnSecs: 60, reactSecs: 6, paySecs: 30 },
  };
}

export const P = (s, id) => s.players.find((p) => p.id === id);
export const seated = (s) => s.players.filter((p) => !p.spectator);
const alive = (s) => s.order.filter((id) => P(s, id));

export function addPlayer(s, { id, name, emoji, color, bot }) {
  let p = P(s, id);
  if (p) { p.on = true; p.name = name || p.name; return p; }
  const spectator = s.phase !== 'lobby' || seated(s).length >= MAX_PLAYERS;
  p = { id, name, emoji: emoji || '🙂', color: color || '#ffb020', bot: !!bot, on: true, spectator, wins: 0 };
  s.players.push(p);
  return p;
}

export function removePlayer(s, id) {
  const i = s.players.findIndex((p) => p.id === id);
  if (i < 0) return;
  const was = s.players[i];
  s.players.splice(i, 1);
  if (s.phase !== 'play' || was.spectator) return;
  const hand = s.hands[id] || [];
  s.discard.push(...hand, ...(s.bank[id] || []), ...(s.table[id] || []).map((t) => t.id), ...upIds(s, id));
  delete s.hands[id]; delete s.bank[id]; delete s.table[id]; delete s.ups[id];
  const wasTurn = s.turn === id;
  const idx = s.order.indexOf(id);
  s.order.splice(idx, 1);
  if (s.pending) {
    if (s.pending.targets) delete s.pending.targets[id];
    if (s.pending.debts) delete s.pending.debts[id];
  }
  if (s.order.length < 2) { finish(s, s.order[0] || null, Date.now()); return; }
  if (wasTurn) { s.pending = null; beginTurn(s, s.order[idx % s.order.length], Date.now()); }
  else if (s.stage === 'pay' && !Object.keys(s.pending.debts).length) afterAction(s, Date.now());
}

export function setConnected(s, id, on) {
  const p = P(s, id);
  if (p) { p.on = on; if (!on) p.offAt = Date.now(); }
}

function ev(s, k, data = {}) {
  const { k: card, ...rest } = data;
  s.log.push({ n: ++s.n, k, ...(card !== undefined ? { card } : {}), ...rest });
  if (s.log.length > LOG_KEEP) s.log.splice(0, s.log.length - LOG_KEEP);
}

const kindOf = (s, id) => s.cards[id];
const infoOf = (s, id) => cardInfo(s.cards[id]);

function upIds(s, pid) {
  const u = s.ups[pid] || {};
  return Object.values(u).flatMap((x) => [x.sky, x.term].filter((v) => v != null));
}

export function startGame(s, rng = Math.random, now = Date.now()) {
  const ids = seated(s).map((p) => p.id);
  if (ids.length < 2) return 'need-2';
  s.phase = 'play';
  s.round++;
  s.order = shuffle(ids.slice(), rng);
  s.cards = [];
  for (let d = 0; d < decksFor(ids.length); d++) s.cards.push(...deckKinds());
  s.deck = shuffle(s.cards.map((_, i) => i), rng);
  s.discard = [];
  s.hands = {}; s.bank = {}; s.table = {}; s.ups = {};
  s.order.forEach((id, i) => { s.hands[id] = draw(s, 5 + (i >= s.order.length / 2 ? 1 : 0), rng); s.bank[id] = []; s.table[id] = []; s.ups[id] = {}; });
  s.winner = null;
  s.turns = 0;
  s.log = [];
  ev(s, 'start', { players: s.order.length, decks: decksFor(ids.length) });
  beginTurn(s, s.order[0], now, rng);
  return null;
}

export function backToLobby(s) {
  s.phase = 'lobby';
  s.stage = null;
  s.pending = null;
  s.deadline = 0;
  for (const p of s.players) p.spectator = false;
  const extra = s.players.slice(MAX_PLAYERS);
  for (const p of extra) p.spectator = true;
}

function draw(s, n, rng = Math.random) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      if (!s.discard.length) break;
      s.deck = shuffle(s.discard.splice(0), rng);
      ev(s, 'reshuffle', { size: s.deck.length });
    }
    out.push(s.deck.pop());
  }
  return out;
}

function stage(s, name, ms, now) {
  s.stage = name;
  s.turnId++;
  s.dur = ms;
  s.deadline = ms ? now + ms : 0;
}

function beginTurn(s, pid, now, rng) {
  s.turn = pid;
  s.turns = (s.turns || 0) + 1;
  s.plays = 0;
  s.pending = null;
  const n = s.hands[pid].length ? 2 : 5;
  const got = draw(s, n, rng);
  s.hands[pid].push(...got);
  ev(s, 'turn', { pid, drew: got.length });
  stage(s, 'act', s.settings.timer ? s.settings.turnSecs * 1000 : 0, now);
}

function nextTurn(s, now) {
  const ids = alive(s);
  const i = ids.indexOf(s.turn);
  beginTurn(s, ids[(i + 1) % ids.length], now);
}

export function groupCount(s, pid, g) {
  return (s.table[pid] || []).filter((t) => t.g === g).length;
}

export function isComplete(s, pid, g) {
  const list = (s.table[pid] || []).filter((t) => t.g === g);
  return list.length >= G[g].size && list.some((t) => !cardInfo(kindOf(s, t.id)).any);
}

export function completeSets(s, pid) {
  return GROUPS.filter((g) => isComplete(s, pid, g.id)).map((g) => g.id);
}

export function rentOf(s, pid, g) {
  const c = Math.min(groupCount(s, pid, g), G[g].size);
  if (!c) return 0;
  let r = G[g].rent[c - 1];
  if (isComplete(s, pid, g)) {
    const u = s.ups[pid][g] || {};
    if (u.sky != null) r += 3;
    if (u.term != null) r += 4;
  }
  return r;
}

export function worth(s, pid) {
  return (s.bank[pid] || []).reduce((a, id) => a + infoOf(s, id).v, 0);
}

function checkWin(s, now) {
  for (const id of alive(s)) {
    if (completeSets(s, id).length >= setsToWin(s.order.length)) { finish(s, id, now); return true; }
  }
  return false;
}

function finish(s, id, now) {
  s.phase = 'over';
  s.winner = id;
  s.pending = null;
  stage(s, null, 0, now);
  const p = P(s, id);
  if (p) p.wins++;
  ev(s, 'win', { pid: id, sets: id ? completeSets(s, id) : [] });
}

function fixUps(s, pid) {
  const u = s.ups[pid];
  for (const g of Object.keys(u)) {
    if (isComplete(s, pid, g)) continue;
    const x = u[g];
    if (x.sky != null) s.bank[pid].push(x.sky);
    if (x.term != null) s.bank[pid].push(x.term);
    delete u[g];
    ev(s, 'upsdrop', { pid, g });
  }
}

const takeFromHand = (s, pid, id) => {
  const h = s.hands[pid];
  const i = h.indexOf(id);
  if (i < 0) return false;
  h.splice(i, 1);
  return true;
};

const tableEntry = (s, pid, id) => (s.table[pid] || []).find((t) => t.id === id);

function removeFromTable(s, pid, id) {
  const t = s.table[pid];
  const i = t.findIndex((x) => x.id === id);
  if (i < 0) return null;
  return t.splice(i, 1)[0];
}

function bestGroup(s, pid, gs) {
  let best = gs[0];
  let score = -1;
  for (const g of gs) {
    const c = groupCount(s, pid, g);
    const sc = c >= G[g].size ? -1 : c * 10 + G[g].rent[G[g].size - 1];
    if (sc > score) { score = sc; best = g; }
  }
  return best;
}

function addToTable(s, pid, id, g) {
  const info = infoOf(s, id);
  const grp = info.gs.includes(g) ? g : bestGroup(s, pid, info.gs);
  s.table[pid].push({ id, g: grp });
  return grp;
}

const canAct = (s, pid) => s.phase === 'play' && s.stage === 'act' && s.turn === pid;
const lockedIds = (s, pid) => new Set((s.table[pid] || []).filter((t) => isComplete(s, pid, t.g)).map((t) => t.id));

export function play(s, pid, m, now = Date.now(), rng = Math.random) {
  if (!canAct(s, pid)) return 'not-your-turn';
  const id = Number(m.id);
  if (!s.hands[pid].includes(id)) return 'no-card';
  const info = infoOf(s, id);
  const k = kindOf(s, id);
  const others = alive(s).filter((x) => x !== pid);
  const target = others.includes(m.target) ? m.target : null;

  if (m.as === 'bank') {
    if (info.type === 'prop' || info.type === 'wild') return 'cannot-bank-cities';
    if (s.plays >= PLAYS) return 'no-plays';
    takeFromHand(s, pid, id);
    s.bank[pid].push(id);
    s.plays++;
    ev(s, 'bank', { pid, k, v: info.v });
    return afterPlay(s, now);
  }
  if (info.type === 'prop' || info.type === 'wild') {
    if (s.plays >= PLAYS) return 'no-plays';
    takeFromHand(s, pid, id);
    const g = addToTable(s, pid, id, m.g);
    s.plays++;
    ev(s, 'place', { pid, k, g });
    return afterPlay(s, now);
  }
  if (info.type === 'money') return play(s, pid, { ...m, as: 'bank' }, now, rng);
  if (s.plays >= PLAYS) return 'no-plays';

  if (info.type === 'rent') {
    const g = info.gs.includes(m.g) ? m.g : null;
    if (!g || !groupCount(s, pid, g)) return 'need-city';
    let mult = 1;
    const dbl = m.double != null ? Number(m.double) : null;
    if (dbl != null) {
      if (kindOf(s, dbl) !== 'double' || !s.hands[pid].includes(dbl)) return 'no-card';
      if (s.plays + 2 > PLAYS) return 'no-plays';
      mult = 2;
    }
    if (info.any && !target) return 'need-target';
    const amount = rentOf(s, pid, g) * mult;
    takeFromHand(s, pid, id);
    s.discard.push(id);
    s.plays++;
    if (dbl != null) { takeFromHand(s, pid, dbl); s.discard.push(dbl); s.plays++; }
    const tg = info.any ? [target] : others;
    ev(s, 'rent', { pid, g, amount, targets: tg, double: mult > 1 });
    return startAction(s, { a: 'rent', by: pid, amount, g, targets: tg }, now);
  }

  switch (k) {
    case 'payday': {
      takeFromHand(s, pid, id);
      s.discard.push(id);
      s.plays++;
      const got = draw(s, 2, rng);
      s.hands[pid].push(...got);
      ev(s, 'payday', { pid, drew: got.length });
      return afterPlay(s, now);
    }
    case 'house': {
      takeFromHand(s, pid, id); s.discard.push(id); s.plays++;
      ev(s, 'action', { pid, k, targets: others });
      return startAction(s, { a: 'charge', by: pid, amount: 2, targets: others, k }, now);
    }
    case 'debt': {
      if (!target) return 'need-target';
      takeFromHand(s, pid, id); s.discard.push(id); s.plays++;
      ev(s, 'action', { pid, k, targets: [target] });
      return startAction(s, { a: 'charge', by: pid, amount: 5, targets: [target], k }, now);
    }
    case 'swipe': {
      if (!target) return 'need-target';
      const take = Number(m.take);
      if (!tableEntry(s, target, take) || lockedIds(s, target).has(take)) return 'bad-pick';
      takeFromHand(s, pid, id); s.discard.push(id); s.plays++;
      ev(s, 'action', { pid, k, targets: [target], take: kindOf(s, take) });
      return startAction(s, { a: 'swipe', by: pid, targets: [target], take, k }, now);
    }
    case 'swap': {
      if (!target) return 'need-target';
      const take = Number(m.take);
      const give = Number(m.give);
      if (!tableEntry(s, target, take) || lockedIds(s, target).has(take)) return 'bad-pick';
      if (!tableEntry(s, pid, give) || lockedIds(s, pid).has(give)) return 'bad-give';
      takeFromHand(s, pid, id); s.discard.push(id); s.plays++;
      ev(s, 'action', { pid, k, targets: [target], take: kindOf(s, take), give: kindOf(s, give) });
      return startAction(s, { a: 'swap', by: pid, targets: [target], take, give, k }, now);
    }
    case 'takeover': {
      if (!target) return 'need-target';
      if (!G[m.g] || !isComplete(s, target, m.g)) return 'bad-pick';
      takeFromHand(s, pid, id); s.discard.push(id); s.plays++;
      ev(s, 'action', { pid, k, targets: [target], g: m.g });
      return startAction(s, { a: 'takeover', by: pid, targets: [target], g: m.g, k }, now);
    }
    case 'sky':
    case 'term': {
      const g = m.g;
      if (!G[g] || G[g].noUp || !isComplete(s, pid, g)) return 'need-full-set';
      const u = (s.ups[pid][g] = s.ups[pid][g] || {});
      if (k === 'sky' && u.sky != null) return 'already';
      if (k === 'term' && (u.sky == null || u.term != null)) return 'need-sky';
      takeFromHand(s, pid, id);
      u[k] = id;
      s.plays++;
      ev(s, 'upgrade', { pid, k, g });
      return afterPlay(s, now);
    }
    case 'veto':
    case 'double':
      return 'bank-it';
    default:
      return 'unknown';
  }
}

export function moveWild(s, pid, id, g) {
  if (!canAct(s, pid)) return 'not-your-turn';
  const t = tableEntry(s, pid, Number(id));
  if (!t) return 'no-card';
  const info = infoOf(s, t.id);
  if (info.type !== 'wild' || !info.gs.includes(g) || t.g === g) return 'bad-move';
  t.g = g;
  fixUps(s, pid);
  ev(s, 'move', { pid, k: kindOf(s, t.id), g });
  checkWin(s, Date.now());
  return null;
}

function afterPlay(s, t) {
  if (checkWin(s, t)) return null;
  s.turnId++;
  return null;
}

function hasVeto(s, pid) {
  return (s.hands[pid] || []).some((id) => kindOf(s, id) === 'veto');
}

function startAction(s, pend, t) {
  pend.chain = Object.fromEntries(pend.targets.map((x) => [x, 0]));
  pend.actLeft = s.deadline ? Math.max(0, s.deadline - t) : 0;
  s.pending = pend;
  openReact(s, t);
  return null;
}

function openReact(s, t) {
  const pd = s.pending;
  const live = pd.targets.some((x) => (pd.chain[x] % 2 === 0 ? hasVeto(s, x) : hasVeto(s, pd.by)));
  stage(s, 'react', live ? s.settings.reactSecs * 1000 : QUIET_MS, t);
}

export function veto(s, pid, forPid, t = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'react' || !s.pending) return 'not-now';
  const pd = s.pending;
  let tgt;
  if (pd.targets.includes(pid) && pd.chain[pid] % 2 === 0) tgt = pid;
  else if (pid === pd.by && pd.targets.includes(forPid) && pd.chain[forPid] % 2 === 1) tgt = forPid;
  else return 'not-now';
  const id = s.hands[pid].find((x) => kindOf(s, x) === 'veto');
  if (id == null) return 'no-veto';
  takeFromHand(s, pid, id);
  s.discard.push(id);
  pd.chain[tgt]++;
  ev(s, 'veto', { pid, target: tgt, blocked: pd.chain[tgt] % 2 === 1, by: pd.by });
  openReact(s, t);
  return null;
}

function resolve(s, t) {
  const pd = s.pending;
  const hit = pd.targets.filter((x) => pd.chain[x] % 2 === 0 && P(s, x) && s.order.includes(x));
  const by = pd.by;
  if (pd.a === 'rent' || pd.a === 'charge') {
    pd.debts = {};
    for (const x of hit) {
      const total = payable(s, x).reduce((a, id) => a + infoOf(s, id).v, 0);
      if (total <= 0) { ev(s, 'broke', { pid: x, to: by }); continue; }
      pd.debts[x] = pd.amount;
    }
    if (!Object.keys(pd.debts).length) { afterAction(s, t); return; }
    stage(s, 'pay', s.settings.paySecs * 1000, t);
    return;
  }
  if (hit.length) {
    const x = hit[0];
    if (pd.a === 'swipe' && tableEntry(s, x, pd.take) && !lockedIds(s, x).has(pd.take)) {
      removeFromTable(s, x, pd.take);
      fixUps(s, x);
      const g = addToTable(s, by, pd.take, null);
      ev(s, 'took', { pid: by, from: x, k: kindOf(s, pd.take), g });
    }
    if (pd.a === 'swap' && tableEntry(s, x, pd.take) && tableEntry(s, by, pd.give) && !lockedIds(s, x).has(pd.take) && !lockedIds(s, by).has(pd.give)) {
      removeFromTable(s, x, pd.take);
      removeFromTable(s, by, pd.give);
      fixUps(s, x);
      fixUps(s, by);
      addToTable(s, by, pd.take, null);
      addToTable(s, x, pd.give, null);
      ev(s, 'swapped', { pid: by, with: x, take: kindOf(s, pd.take), give: kindOf(s, pd.give) });
    }
    if (pd.a === 'takeover' && isComplete(s, x, pd.g)) {
      const moving = s.table[x].filter((e) => e.g === pd.g);
      s.table[x] = s.table[x].filter((e) => e.g !== pd.g);
      for (const e of moving) s.table[by].push(e);
      const u = s.ups[x][pd.g];
      delete s.ups[x][pd.g];
      if (u) {
        const mine = (s.ups[by][pd.g] = s.ups[by][pd.g] || {});
        for (const key of ['sky', 'term']) if (u[key] != null) { if (mine[key] == null) mine[key] = u[key]; else s.bank[by].push(u[key]); }
      }
      fixUps(s, by);
      ev(s, 'takeover', { pid: by, from: x, g: pd.g, n: moving.length });
    }
  } else ev(s, 'blocked', { pid: by, a: pd.a });
  afterAction(s, t);
}

function afterAction(s, t) {
  const left = s.pending?.actLeft || 0;
  s.pending = null;
  if (checkWin(s, t)) return;
  stage(s, 'act', s.settings.timer ? Math.max(15000, left) : 0, t);
}

export function payable(s, pid) {
  const ids = [...(s.bank[pid] || [])];
  for (const e of s.table[pid] || []) if (infoOf(s, e.id).v > 0) ids.push(e.id);
  for (const u of Object.values(s.ups[pid] || {})) for (const key of ['sky', 'term']) if (u[key] != null) ids.push(u[key]);
  return ids;
}

export function pay(s, pid, ids, t = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'pay' || !s.pending?.debts?.[pid]) return 'not-now';
  const owed = s.pending.debts[pid];
  const can = new Set(payable(s, pid));
  const pick = [...new Set((ids || []).map(Number))].filter((x) => can.has(x));
  const sum = pick.reduce((a, id) => a + infoOf(s, id).v, 0);
  const all = [...can].reduce((a, id) => a + infoOf(s, id).v, 0);
  if (sum < owed && sum < all) return 'not-enough';
  transfer(s, pid, s.pending.by, pick);
  ev(s, 'paid', { pid, to: s.pending.by, amount: sum, owed, cards: pick.map((id) => kindOf(s, id)) });
  delete s.pending.debts[pid];
  if (!Object.keys(s.pending.debts).length) afterAction(s, t);
  else s.turnId++;
  return null;
}

function transfer(s, from, to, ids) {
  for (const id of ids) {
    let i = s.bank[from].indexOf(id);
    if (i >= 0) { s.bank[from].splice(i, 1); s.bank[to].push(id); continue; }
    if (removeFromTable(s, from, id)) { addToTable(s, to, id, null); continue; }
    for (const [g, u] of Object.entries(s.ups[from])) {
      for (const key of ['sky', 'term']) if (u[key] === id) { delete u[key]; s.bank[to].push(id); }
      if (u.sky == null && u.term == null) delete s.ups[from][g];
    }
  }
  fixUps(s, from);
  fixUps(s, to);
}

export function bestCover(vals, owed) {
  const n = Math.min(vals.length, 14);
  let best = null;
  let bestSum = Infinity;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { sum += vals[i]; cnt++; }
    if (sum >= owed && (sum < bestSum || (sum === bestSum && cnt < best.cnt))) { bestSum = sum; best = { mask, cnt }; }
  }
  if (!best) return null;
  const out = [];
  for (let i = 0; i < n; i++) if (best.mask & (1 << i)) out.push(i);
  return out;
}

export function autoPayPick(s, pid, owed) {
  const bankAll = [...s.bank[pid]];
  const cover = bestCover(bankAll.map((id) => infoOf(s, id).v), owed);
  if (cover) return cover.map((i) => bankAll[i]);
  const bank = [...s.bank[pid]].sort((a, b) => infoOf(s, a).v - infoOf(s, b).v);
  const pick = [];
  let sum = 0;
  const bigFirst = [...bank].sort((a, b) => infoOf(s, b).v - infoOf(s, a).v);
  for (const id of bigFirst) {
    if (sum >= owed) break;
    const v = infoOf(s, id).v;
    if (sum + v > owed) {
      const exact = bank.find((x) => !pick.includes(x) && sum + infoOf(s, x).v >= owed);
      if (exact != null) { pick.push(exact); sum += infoOf(s, exact).v; break; }
    }
    pick.push(id);
    sum += v;
  }
  if (sum < owed) {
    const locked = lockedIds(s, pid);
    const props = (s.table[pid] || []).map((e) => e.id).filter((id) => infoOf(s, id).v > 0)
      .sort((a, b) => (locked.has(a) - locked.has(b)) || infoOf(s, a).v - infoOf(s, b).v);
    for (const id of props) { if (sum >= owed) break; pick.push(id); sum += infoOf(s, id).v; }
    for (const u of Object.values(s.ups[pid] || {})) for (const key of ['sky', 'term']) if (sum < owed && u[key] != null) { pick.push(u[key]); sum += infoOf(s, u[key]).v; }
  }
  return pick;
}

export function endTurn(s, pid, t = Date.now()) {
  if (!canAct(s, pid)) return 'not-your-turn';
  if (s.hands[pid].length > HAND_MAX) {
    stage(s, 'discard', s.settings.timer ? 20000 : 0, t);
    return null;
  }
  nextTurn(s, t);
  return null;
}

export function discard(s, pid, ids, t = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'discard' || s.turn !== pid) return 'not-now';
  const over = s.hands[pid].length - HAND_MAX;
  const pick = [...new Set((ids || []).map(Number))].filter((x) => s.hands[pid].includes(x));
  if (pick.length !== over) return 'pick-' + over;
  for (const id of pick) { takeFromHand(s, pid, id); s.discard.push(id); }
  ev(s, 'discard', { pid, n: pick.length });
  nextTurn(s, t);
  return null;
}

const cheapest = (s, ids, n) => ids.slice().sort((a, b) => cardValueForKeep(s, a) - cardValueForKeep(s, b)).slice(0, n);
function cardValueForKeep(s, id) {
  const k = kindOf(s, id);
  const i = cardInfo(k);
  if (k === 'veto') return 20;
  if (k === 'takeover') return 18;
  if (i.type === 'prop' || i.type === 'wild') return 10 + i.v;
  return i.v;
}

export function tick(s, t = Date.now()) {
  if (s.phase !== 'play' || !s.deadline || t < s.deadline) return false;
  if (s.stage === 'react') { resolve(s, t); return true; }
  if (s.stage === 'pay') {
    for (const pid of Object.keys(s.pending.debts)) pay(s, pid, autoPayPick(s, pid, s.pending.debts[pid]), t);
    return true;
  }
  if (s.stage === 'discard') {
    const h = s.hands[s.turn];
    discard(s, s.turn, cheapest(s, h, h.length - HAND_MAX), t);
    return true;
  }
  if (s.stage === 'act') {
    ev(s, 'timeout', { pid: s.turn });
    if (s.hands[s.turn].length > HAND_MAX) { const h = s.hands[s.turn]; for (const id of cheapest(s, h, h.length - HAND_MAX)) { takeFromHand(s, s.turn, id); s.discard.push(id); } }
    nextTurn(s, t);
    return true;
  }
  return false;
}

function leader(s, pid) {
  return alive(s).filter((x) => x !== pid).sort((a, b) => score(s, b) - score(s, a))[0];
}
function score(s, pid) {
  return completeSets(s, pid).length * 20 + (s.table[pid] || []).length * 2 + worth(s, pid);
}

function botPlay(s, pid, rng) {
  const hand = s.hands[pid];
  const others = alive(s).filter((x) => x !== pid);
  const try1 = (m) => !play(s, pid, m, Date.now(), rng);
  const ofKind = (k) => hand.filter((id) => kindOf(s, id) === k);
  const mySets = completeSets(s, pid);

  for (const id of ofKind('takeover')) {
    const opts = others.flatMap((o) => completeSets(s, o).filter((g) => !mySets.includes(g)).map((g) => [o, g]));
    if (opts.length) { const [o, g] = opts.sort((a, b) => G[b[1]].rent.at(-1) - G[a[1]].rent.at(-1))[0]; if (try1({ id, target: o, g })) return true; }
  }
  for (const id of hand.filter((x) => ['prop', 'wild'].includes(infoOf(s, x).type))) {
    const info = infoOf(s, id);
    if (info.any && !(s.table[pid] || []).length) continue;
    if (try1({ id, g: bestGroup(s, pid, info.gs) })) return true;
  }
  for (const id of ofKind('swipe')) {
    let best = null;
    for (const o of others) {
      const locked = lockedIds(s, o);
      for (const e of s.table[o]) {
        if (locked.has(e.id)) continue;
        const need = G[e.g].size - groupCount(s, pid, e.g);
        const sc = (need === 1 ? 50 : 10 - need) + G[e.g].v;
        if (!best || sc > best.sc) best = { sc, o, take: e.id };
      }
    }
    if (best && try1({ id, target: best.o, take: best.take })) return true;
  }
  for (const id of ['sky', 'term'].flatMap(ofKind)) {
    for (const g of mySets) if (try1({ id, g })) return true;
  }
  const rents = hand.filter((x) => infoOf(s, x).type === 'rent');
  if (rents.length && others.some((o) => payable(s, o).length)) {
    let best = null;
    for (const id of rents) {
      const info = infoOf(s, id);
      for (const g of info.gs) {
        const r = rentOf(s, pid, g);
        if (!r) continue;
        const val = r * (info.any ? 1 : others.length);
        if (!best || val > best.val) best = { val, id, g, any: info.any };
      }
    }
    if (best && best.val >= 2) {
      const dbl = ofKind('double')[0];
      const m = { id: best.id, g: best.g, target: best.any ? leader(s, pid) : undefined };
      if (dbl != null && s.plays + 2 <= PLAYS && best.val >= 3) m.double = dbl;
      if (try1(m)) return true;
    }
  }
  for (const id of ofKind('debt')) {
    const rich = others.sort((a, b) => worth(s, b) - worth(s, a))[0];
    if (rich && payable(s, rich).length && try1({ id, target: rich })) return true;
  }
  for (const id of ofKind('house')) if (others.some((o) => payable(s, o).length) && try1({ id })) return true;
  for (const id of ofKind('payday')) if (s.plays < PLAYS - 1 && try1({ id })) return true;
  const money = hand.filter((x) => infoOf(s, x).type === 'money').sort((a, b) => infoOf(s, b).v - infoOf(s, a).v);
  if (money.length && try1({ id: money[0], as: 'bank' })) return true;
  if (worth(s, pid) < 6) {
    const spare = hand.filter((x) => ['action', 'rent'].includes(infoOf(s, x).type) && !['veto', 'takeover'].includes(kindOf(s, x)))
      .sort((a, b) => infoOf(s, b).v - infoOf(s, a).v);
    if (spare.length && try1({ id: spare[0], as: 'bank' })) return true;
  }
  return false;
}

export function botStep(s, t = Date.now(), rng = Math.random, fast = false) {
  if (s.phase !== 'play' || (!fast && t < s.botAt)) return false;
  const bot = (id) => P(s, id)?.bot;
  if (s.stage === 'react' && s.pending) {
    const pd = s.pending;
    for (const x of pd.targets) {
      if (pd.chain[x] % 2 === 0 && bot(x) && hasVeto(s, x)) {
        const big = pd.a === 'takeover' || pd.a === 'swipe' || (pd.amount || 0) >= 4;
        if ((big ? 0.9 : 0.35) > rng() && !veto(s, x, null, t)) { s.botAt = t + BOT_MS; return true; }
      }
      if (pd.chain[x] % 2 === 1 && bot(pd.by) && hasVeto(s, pd.by) && rng() < 0.6) {
        if (!veto(s, pd.by, x, t)) { s.botAt = t + BOT_MS; return true; }
      }
    }
    if (fast) { resolve(s, t); return true; }
    return false;
  }
  if (s.stage === 'pay' && s.pending) {
    let did = false;
    for (const pid of Object.keys(s.pending.debts)) {
      if (!bot(pid)) continue;
      pay(s, pid, autoPayPick(s, pid, s.pending.debts[pid]), t);
      did = true;
      if (s.stage !== 'pay') break;
    }
    if (did) s.botAt = t + BOT_MS;
    return did;
  }
  if (!bot(s.turn)) return false;
  const pid = s.turn;
  if (s.stage === 'discard') {
    const h = s.hands[pid];
    discard(s, pid, cheapest(s, h, h.length - HAND_MAX), t);
    s.botAt = t + BOT_MS;
    return true;
  }
  if (s.stage !== 'act') return false;
  if (s.plays < PLAYS && botPlay(s, pid, rng)) { s.botAt = t + BOT_MS; return true; }
  endTurn(s, pid, t);
  s.botAt = t + BOT_MS;
  return true;
}

export function publicView(s) {
  const pd = s.pending;
  return {
    phase: s.phase, hostId: s.hostId, round: s.round, stage: s.stage, turnId: s.turnId, turn: s.turn, plays: s.plays,
    deck: s.deck.length, discardTop: s.discard.length ? kindOf(s, s.discard[s.discard.length - 1]) : null,
    left: s.deadline ? Math.max(0, s.deadline - Date.now()) : 0, dur: s.dur,
    pending: pd ? {
      a: pd.a, k: pd.k, by: pd.by, amount: pd.amount, g: pd.g, targets: pd.targets, chain: pd.chain,
      take: pd.take != null ? kindOf(s, pd.take) : null, give: pd.give != null ? kindOf(s, pd.give) : null,
      debts: pd.debts || null,
    } : null,
    order: s.order, winner: s.winner, log: s.log, settings: s.settings, decks: decksFor(Math.max(2, s.phase === 'lobby' ? seated(s).length : s.order.length)),
    players: s.players.map((p) => ({
      id: p.id, name: p.name, emoji: p.emoji, color: p.color, bot: p.bot, on: p.on, spectator: p.spectator, wins: p.wins,
      hand: (s.hands[p.id] || []).length,
      bank: (s.bank[p.id] || []).map((id) => ({ id, k: kindOf(s, id) })),
      worth: worth(s, p.id),
      table: (s.table[p.id] || []).map((e) => ({ id: e.id, k: kindOf(s, e.id), g: e.g })),
      ups: Object.fromEntries(Object.entries(s.ups[p.id] || {}).map(([g, u]) => [g, { sky: u.sky != null ? u.sky : null, term: u.term != null ? u.term : null }])),
      sets: s.phase === 'lobby' ? [] : completeSets(s, p.id),
    })),
  };
}

export const privateView = (s, pid) => ({ hand: (s.hands[pid] || []).map((id) => ({ id, k: kindOf(s, id) })) });
