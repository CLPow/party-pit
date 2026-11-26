import { CARDS, BASE, PACKS, PLAYABLE, TARGETED } from './packs.js';

export const MAX_PLAYERS = 40;
const LOG_KEEP = 40;
const DEFUSE_MS = 15000;
const DOOM_MS = 3400;
const PLACE_MS = 15000;
const GIVE_MS = 15000;
const ALTER_MS = 20000;
const AFTER_MS = 3200;
const DEAL_MS = 2600;
const QUIET_MS = 900;

export function defaultSettings() {
  return {
    packs: { chaos: false, mega: false, party: true },
    house: { timer: false, streak: false, sudden: false, double: false, nohiss: false },
    hand: 7,
    turnSecs: 30,
    reactSecs: 3,
    suddenMins: 8,
    voice: true,
  };
}

export function newGame(hostId) {
  return {
    phase: 'lobby', hostId, players: [], settings: defaultSettings(),
    deck: [], discard: [], removed: [], hands: {}, priv: {}, order: [],
    turn: null, dir: 1, turnsLeft: 1, stage: null, turnId: 0, deadline: 0, dur: 0,
    pending: null, bomb: null, log: [], n: 0, round: 0, nextId: 1, winner: null,
    startedAt: 0, sudden: false, deckVer: 0, pn: 0, bots: {},
  };
}

const alive = (s) => s.order.filter((id) => { const p = P(s, id); return p && !p.out; });
export const P = (s, id) => s.players.find((p) => p.id === id);
const hand = (s, id) => (s.hands[id] = s.hands[id] || []);
const count = (s, id, k) => hand(s, id).filter((c) => c.k === k).length;

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function seated(s) {
  return s.players.filter((p) => p.on && !p.spectator);
}

export function addPlayer(s, { id, name, avatar, color, bot = false }) {
  let p = P(s, id);
  if (p) {
    Object.assign(p, { name, avatar, color, on: true });
    return p;
  }
  const full = seated(s).length >= MAX_PLAYERS;
  p = { id, name, avatar, color, bot, on: true, wins: 0, out: false, place: 0, spectator: s.phase !== 'lobby' || full, joinedAt: Date.now() };
  s.players.push(p);
  return p;
}

export function removePlayer(s, id, now = Date.now()) {
  const p = P(s, id);
  if (!p) return;
  if (s.phase === 'lobby' || p.spectator || p.out || !s.order.includes(id)) {
    s.players = s.players.filter((x) => x !== p);
    delete s.hands[id];
    return;
  }
  p.on = false;
  p.left = true;
  eliminate(s, id, now, true);
}

export function setConnected(s, id, on) {
  const p = P(s, id);
  if (p) { p.on = on; if (!on) p.offAt = Date.now(); }
}

export function partyOn(s) {
  return !!s.settings.packs.party;
}

export function houseOn(s, k) {
  if (k === 'timer' && partyOn(s) && s.order.length > 15) return true;
  return !!s.settings.house[k];
}

export function reactMs(s) {
  const base = s.settings.reactSecs * 1000;
  return partyOn(s) && s.order.length > 15 ? Math.min(base, 2500) : base;
}

export function deckPlan(settings, n) {
  const kinds = { ...BASE };
  for (const pk of PACKS) if (settings.packs[pk.id]) for (const [k, v] of Object.entries(pk.cards)) kinds[k] = (kinds[k] || 0) + v;
  if (settings.house.nohiss) delete kinds.hiss;
  const per = Object.values(kinds).reduce((a, b) => a + b, 0);
  const handExtra = Math.max(1, settings.hand - 1);
  const copies = settings.packs.party ? Math.max(1, Math.ceil((n * (handExtra + 3)) / per)) : 1;
  const coolStart = settings.house.double ? 2 : 1;
  const coolDeck = settings.packs.party ? Math.max(2, Math.ceil(n / 4)) : Math.max(1, 6 - n * coolStart);
  const crit = settings.packs.mega && n >= 2 ? 1 : 0;
  const melt = Math.max(0, n - 1 - crit);
  const ok = per * copies >= n * handExtra + n;
  return { kinds, copies, per, coolStart, coolDeck, crit, melt, ok, maxPlayers: settings.packs.party ? MAX_PLAYERS : 5 };
}

function ev(s, k, data = {}, now = Date.now()) {
  s.log.push({ ...data, n: ++s.n, k, at: now });
  if (s.log.length > LOG_KEEP) s.log.splice(0, s.log.length - LOG_KEEP);
}

function stage(s, name, ms, now = Date.now(), who = null) {
  s.stage = name;
  s.turnId++;
  s.deadline = ms ? now + ms : 0;
  s.dur = ms || 0;
  s.who = who;
}

function nextAlive(s, from, dir = s.dir) {
  const ids = s.order;
  const len = ids.length;
  let i = ids.indexOf(from);
  for (let k = 0; k < len; k++) {
    i = (i + dir + len) % len;
    const p = P(s, ids[i]);
    if (p && !p.out) return ids[i];
  }
  return from;
}

function act(s, now) {
  stage(s, 'act', houseOn(s, 'timer') ? s.settings.turnSecs * 1000 : 0, now, s.turn);
}

function beginTurn(s, pid, turns, now) {
  if (s.sudden) turns = Math.max(turns, 2);
  s.turn = pid;
  s.turnsLeft = turns;
  s.acts = 0;
  act(s, now);
}

function endTurn(s, now) {
  s.turnsLeft--;
  if (s.turnsLeft > 0) {
    s.acts = 0;
    act(s, now);
    return;
  }
  beginTurn(s, nextAlive(s, s.turn), 1, now);
}

export function startGame(s, rng = Math.random, now = Date.now()) {
  for (const p of s.players) {
    if (!p.on) continue;
    p.spectator = false;
    p.out = false;
    p.place = 0;
    p.left = false;
  }
  s.players = s.players.filter((p) => p.on || p.bot);
  const seats = seated(s).slice(0, MAX_PLAYERS);
  for (const p of s.players) if (!seats.includes(p)) p.spectator = true;
  const n = seats.length;
  if (n < 2) return 'need-2';
  const plan = deckPlan(s.settings, n);
  if (n > plan.maxPlayers) return 'need-party';
  if (!plan.ok) return 'too-few';
  s.nextId = 1;
  const mk = (k) => ({ i: s.nextId++, k });
  let pile = [];
  for (let c = 0; c < plan.copies; c++) for (const [k, v] of Object.entries(plan.kinds)) for (let j = 0; j < v; j++) pile.push(mk(k));
  shuffle(pile, rng);
  s.hands = {};
  s.priv = {};
  s.bots = {};
  const handExtra = Math.max(1, s.settings.hand - 1);
  for (const p of seats) {
    const h = [];
    for (let j = 0; j < plan.coolStart; j++) h.push(mk('coolant'));
    for (let j = 0; j < handExtra; j++) h.push(pile.pop());
    s.hands[p.id] = h;
  }
  for (let j = 0; j < plan.coolDeck; j++) pile.push(mk('coolant'));
  for (let j = 0; j < plan.melt; j++) pile.push(mk('meltdown'));
  for (let j = 0; j < plan.crit; j++) pile.push(mk('critical'));
  shuffle(pile, rng);
  s.deck = pile;
  s.discard = [];
  s.removed = [];
  s.order = shuffle(seats.map((p) => p.id), rng);
  s.dir = 1;
  s.round++;
  s.phase = 'play';
  s.winner = null;
  s.bomb = null;
  s.pending = null;
  s.sudden = false;
  s.startedAt = now;
  s.deckVer++;
  s.log = [];
  s.turn = s.order[0];
  s.turnsLeft = 1;
  ev(s, 'deal', { n: seats.length, deck: s.deck.length }, now);
  stage(s, 'deal', DEAL_MS, now);
  return null;
}

export function backToLobby(s) {
  s.phase = 'lobby';
  s.stage = null;
  s.deadline = 0;
  s.pending = null;
  s.bomb = null;
  s.hands = {};
  s.priv = {};
  s.deck = [];
  s.discard = [];
  s.order = [];
  s.turn = null;
  s.log = [];
  s.players = s.players.filter((p) => p.on || p.bot);
  for (const p of s.players) { p.out = false; p.spectator = false; p.place = 0; }
  const keep = s.players.slice(0, MAX_PLAYERS);
  for (const p of s.players) if (!keep.includes(p)) p.spectator = true;
}

function anyHiss(s) {
  if (houseOn(s, 'nohiss')) return false;
  return alive(s).some((id) => count(s, id, 'hiss') > 0);
}

function priv(s, pid, k, cards) {
  s.priv[pid] = { k, cards, n: ++s.pn, ver: s.deckVer };
}

export function critPos(s) {
  return s.deck.findIndex((c) => c.k === 'critical' && c.up);
}

export function classify(s, pid, ids) {
  const h = hand(s, pid);
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return { err: 'bad-cards' };
  const cards = ids.map((i) => h.find((c) => c.i === i));
  if (cards.some((c) => !c)) return { err: 'bad-cards' };
  const kinds = cards.map((c) => c.k);
  if (kinds.some((k) => k === 'meltdown' || k === 'critical')) return { err: 'bad-cards' };
  if (cards.length === 1) {
    const k = kinds[0];
    if (!PLAYABLE.has(k) || k === 'hiss') return { err: 'not-playable' };
    return { cards, type: 'single', k };
  }
  const same = kinds.every((k) => k === kinds[0]);
  if (same && cards.length === 2) return { cards, type: 'pair', k: kinds[0] };
  if (same && cards.length === 3) return { cards, type: 'triple', k: kinds[0] };
  if (cards.length === 5 && new Set(kinds).size === 5) return { cards, type: 'five' };
  return { err: 'bad-combo' };
}

function takeCards(s, pid, cards) {
  const ids = new Set(cards.map((c) => c.i));
  s.hands[pid] = hand(s, pid).filter((c) => !ids.has(c.i));
  s.discard.push(...cards);
}

export function play(s, pid, ids, opt = {}, now = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'act' || s.turn !== pid) return 'not-your-turn';
  const c = classify(s, pid, ids);
  if (c.err) return c.err;
  const needsTarget = c.type === 'pair' || c.type === 'triple' || (c.type === 'single' && TARGETED.has(c.k));
  let target = null;
  if (needsTarget) {
    target = opt.target;
    const tp = P(s, target);
    if (!tp || tp.out || target === pid || !s.order.includes(target)) return 'bad-target';
    if (c.k !== 'target' && !hand(s, target).length) return 'empty-target';
  }
  let name = null;
  if (c.type === 'triple') {
    name = opt.name;
    if (!CARDS[name] || name === 'meltdown' || name === 'critical') return 'bad-name';
  }
  if (c.type === 'five' && !s.discard.some((x) => x.k !== 'meltdown' && x.k !== 'critical')) return 'empty-discard';
  takeCards(s, pid, c.cards);
  s.acts = (s.acts || 0) + 1;
  s.pending = { by: pid, type: c.type, k: c.k || null, kinds: c.cards.map((x) => x.k), target, name, hiss: 0, chain: [] };
  ev(s, 'play', { by: pid, type: c.type, kinds: c.cards.map((x) => x.k), target, name }, now);
  stage(s, 'react', anyHiss(s) ? reactMs(s) : QUIET_MS, now);
  checkHeld(s, now);
  return null;
}

export function hiss(s, pid, id, now = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'react' || !s.pending) return 'not-now';
  if (houseOn(s, 'nohiss')) return 'not-now';
  const p = P(s, pid);
  if (!p || p.out || !s.order.includes(pid)) return 'not-now';
  const h = hand(s, pid);
  const card = (id != null && h.find((c) => c.i === id && c.k === 'hiss')) || h.find((c) => c.k === 'hiss');
  if (!card) return 'no-hiss';
  takeCards(s, pid, [card]);
  s.pending.hiss++;
  s.pending.chain.push(pid);
  ev(s, 'hiss', { by: pid, cancel: s.pending.hiss % 2 === 1, depth: s.pending.hiss }, now);
  stage(s, 'react', anyHiss(s) ? reactMs(s) : QUIET_MS, now);
  checkHeld(s, now);
  return null;
}

function resolve(s, now) {
  const pd = s.pending;
  s.pending = null;
  if (!pd) { act(s, now); return; }
  const by = pd.by;
  if (pd.hiss % 2 === 1) {
    ev(s, 'cancelled', { by, card: pd.k, type: pd.type }, now);
    act(s, now);
    return;
  }
  const back = () => act(s, now);
  if (pd.type === 'pair' || pd.type === 'triple') {
    const th = hand(s, pd.target);
    let got = null;
    if (pd.type === 'pair' && th.length) got = th[Math.floor(Math.random() * th.length)];
    if (pd.type === 'triple') got = th.find((c) => c.k === pd.name) || null;
    if (got) {
      s.hands[pd.target] = th.filter((c) => c !== got);
      hand(s, by).push(got);
      priv(s, by, 'got', [got.k]);
      priv(s, pd.target, 'lost', [got.k]);
    }
    ev(s, 'steal', { from: pd.target, to: by, type: pd.type, name: pd.name, ok: !!got, card: pd.type === 'triple' && got ? got.k : undefined }, now);
    back();
    checkHeld(s, now);
    return;
  }
  if (pd.type === 'five') {
    stage(s, 'salvage', ALTER_MS, now, by);
    return;
  }
  switch (pd.k) {
    case 'nap':
      ev(s, 'nap', { by }, now);
      endTurn(s, now);
      return;
    case 'overload':
    case 'target': {
      const to = pd.k === 'target' && P(s, pd.target) && !P(s, pd.target).out ? pd.target : nextAlive(s, by);
      const carry = s.turnsLeft > 1 ? s.turnsLeft : s.sudden ? 2 : 0;
      const n = carry + 2;
      ev(s, 'overload', { by, to, n, carry }, now);
      beginTurn(s, to, n, now);
      return;
    }
    case 'reverse':
      s.dir *= -1;
      ev(s, 'reverse', { by, dir: s.dir }, now);
      endTurn(s, now);
      return;
    case 'peek':
      priv(s, by, 'peek', s.deck.slice(0, 3).map((c) => (c.k === 'critical' && !c.up ? 'critical' : c.k)));
      ev(s, 'peek', { by }, now);
      back();
      return;
    case 'recal':
      priv(s, by, 'alter', s.deck.slice(0, 3).map((c) => c.k));
      ev(s, 'peek', { by, alter: true }, now);
      stage(s, 'alter', ALTER_MS, now, by);
      return;
    case 'scramble':
      shuffle(s.deck, Math.random);
      s.deckVer++;
      ev(s, 'scramble', { by }, now);
      back();
      return;
    case 'bribe':
      if (!hand(s, pd.target).length) {
        ev(s, 'steal', { from: pd.target, to: by, type: 'bribe', ok: false }, now);
        back();
        return;
      }
      s.giveTo = by;
      stage(s, 'give', GIVE_MS, now, pd.target);
      return;
    case 'bottom':
      draw(s, by, true, now);
      return;
    case 'contain':
      if (!s.deck.length) { endTurn(s, now); return; }
      stage(s, 'bury', PLACE_MS, now, by);
      return;
    default:
      back();
  }
}

function vent(s, now) {
  const held = [];
  for (const id of alive(s)) {
    const h = hand(s, id);
    for (const c of h.filter((x) => x.k === 'meltdown')) held.push(c);
    s.hands[id] = h.filter((x) => x.k !== 'meltdown');
  }
  if (!held.length) {
    const need = Math.max(1, alive(s).length - 1);
    for (let i = s.removed.length - 1; i >= 0 && held.length < need; i--) {
      if (s.removed[i].k === 'meltdown') held.push(...s.removed.splice(i, 1));
    }
  }
  if (!held.length) return false;
  s.deck.push(...held);
  shuffle(s.deck, Math.random);
  s.deckVer++;
  ev(s, 'vent', { n: held.length }, now);
  return true;
}

export function draw(s, pid, bottom = false, now = Date.now()) {
  if (!bottom && (s.phase !== 'play' || s.stage !== 'act' || s.turn !== pid)) return 'not-your-turn';
  if (!s.deck.length && !vent(s, now)) {
    ev(s, 'empty', { by: pid }, now);
    endTurn(s, now);
    return null;
  }
  const card = bottom ? s.deck.pop() : s.deck.shift();
  s.deckVer++;
  if (card.k === 'meltdown') {
    s.bomb = { card, pid };
    ev(s, 'meltdown', { by: pid, bottom, cool: count(s, pid, 'coolant') }, now);
    stage(s, 'defuse', count(s, pid, 'coolant') ? DEFUSE_MS : DOOM_MS, now, pid);
    return null;
  }
  if (card.k === 'critical') {
    s.bomb = { card, pid, crit: true };
    if (card.up) {
      ev(s, 'critical', { by: pid, bottom }, now);
      stage(s, 'doom', DOOM_MS + 800, now, pid);
    } else {
      card.up = true;
      ev(s, 'critflip', { by: pid, bottom }, now);
      stage(s, 'place', PLACE_MS, now, pid);
    }
    return null;
  }
  hand(s, pid).push(card);
  priv(s, pid, 'drew', [card.k]);
  ev(s, 'draw', { by: pid, bottom }, now);
  endTurn(s, now);
  checkHeld(s, now);
  return null;
}

export function cool(s, pid, now = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'defuse' || !s.bomb || s.bomb.pid !== pid) return 'not-now';
  const c = hand(s, pid).find((x) => x.k === 'coolant');
  if (!c) return 'no-coolant';
  takeCards(s, pid, [c]);
  ev(s, 'cool', { by: pid }, now);
  stage(s, 'place', PLACE_MS, now, pid);
  return null;
}

export function hold(s, pid, now = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'defuse' || !s.bomb || s.bomb.pid !== pid || s.bomb.crit) return 'not-now';
  if (!houseOn(s, 'streak') || !count(s, pid, 'coolant')) return 'not-now';
  hand(s, pid).push(s.bomb.card);
  s.bomb = null;
  ev(s, 'hold', { by: pid }, now);
  endTurn(s, now);
  return null;
}

export function place(s, pid, pos, now = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'place' || !s.bomb || s.bomb.pid !== pid) return 'not-now';
  const at = Math.max(0, Math.min(s.deck.length, Math.round(Number(pos) || 0)));
  const card = s.bomb.card;
  s.deck.splice(at, 0, card);
  s.deckVer++;
  s.bomb = null;
  ev(s, 'place', { by: pid, crit: card.k === 'critical', pos: card.k === 'critical' ? at : undefined, size: s.deck.length }, now);
  endTurn(s, now);
  checkHeld(s, now);
  return null;
}

export function bury(s, pid, pos, now = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'bury' || s.who !== pid) return 'not-now';
  const card = s.deck.shift();
  const at = Math.max(0, Math.min(s.deck.length, Math.round(Number(pos) || 0)));
  s.deck.splice(at, 0, card);
  s.deckVer++;
  ev(s, 'bury', { by: pid, crit: card.k === 'critical' && card.up, pos: card.k === 'critical' && card.up ? at : undefined }, now);
  endTurn(s, now);
  return null;
}

export function give(s, pid, id, now = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'give' || s.who !== pid) return 'not-now';
  const h = hand(s, pid);
  const card = h.find((c) => c.i === id);
  if (!card) return 'bad-cards';
  s.hands[pid] = h.filter((c) => c !== card);
  hand(s, s.giveTo).push(card);
  priv(s, s.giveTo, 'got', [card.k]);
  ev(s, 'steal', { from: pid, to: s.giveTo, type: 'bribe', ok: true }, now);
  s.giveTo = null;
  act(s, now);
  checkHeld(s, now);
  return null;
}

export function alter(s, pid, order, now = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'alter' || s.who !== pid) return 'not-now';
  const n = Math.min(3, s.deck.length);
  if (Array.isArray(order) && order.length === n && [...order].sort().join() === [...Array(n).keys()].join()) {
    const top = s.deck.slice(0, n);
    s.deck.splice(0, n, ...order.map((i) => top[i]));
    s.deckVer++;
  }
  priv(s, pid, 'peek', s.deck.slice(0, n).map((c) => c.k));
  ev(s, 'alter', { by: pid }, now);
  act(s, now);
  return null;
}

export function salvage(s, pid, k, now = Date.now()) {
  if (s.phase !== 'play' || s.stage !== 'salvage' || s.who !== pid) return 'not-now';
  let idx = -1;
  for (let i = s.discard.length - 1; i >= 0; i--) if (s.discard[i].k === k) { idx = i; break; }
  if (idx < 0 || k === 'meltdown' || k === 'critical') return 'bad-name';
  const [card] = s.discard.splice(idx, 1);
  hand(s, pid).push(card);
  ev(s, 'salvage', { by: pid, card: k }, now);
  act(s, now);
  return null;
}

function checkHeld(s, now) {
  if (s.phase !== 'play' || s.bomb || s.stage === 'after') return;
  for (const id of alive(s)) {
    const h = hand(s, id);
    const m = h.find((c) => c.k === 'meltdown');
    if (!m || h.some((c) => c.k === 'coolant')) continue;
    s.hands[id] = h.filter((c) => c !== m);
    s.bomb = { card: m, pid: id, held: true };
    s.pendingSave = s.pending;
    ev(s, 'meltdown', { by: id, held: true, cool: 0 }, now);
    stage(s, 'doom', DOOM_MS, now, id);
    return;
  }
}

function eliminate(s, pid, now, quiet = false) {
  const p = P(s, pid);
  if (!p || p.out) return;
  p.out = true;
  p.place = alive(s).length + 1;
  s.discard.push(...hand(s, pid).filter((c) => c.k !== 'meltdown' && c.k !== 'critical'));
  for (const c of hand(s, pid).filter((x) => x.k === 'meltdown' || x.k === 'critical')) {
    s.deck.splice(Math.floor(Math.random() * (s.deck.length + 1)), 0, c);
    s.deckVer++;
  }
  s.hands[pid] = [];
  if (quiet) {
    ev(s, 'left', { by: pid }, now);
    const m = s.deck.findIndex((c) => c.k === 'meltdown');
    if (m >= 0) { s.removed.push(...s.deck.splice(m, 1)); s.deckVer++; }
    if (s.bomb && s.bomb.pid === pid) { s.removed.push(s.bomb.card); s.bomb = null; s.pendingSave = null; }
    if (checkWin(s, now)) return;
    if (s.pending && s.pending.by === pid) s.pending = null;
    if (s.turn === pid) beginTurn(s, nextAlive(s, pid), 1, now);
    else if (s.who === pid) {
      if (s.stage === 'give') { s.giveTo = null; act(s, now); }
      else if (s.stage !== 'react') act(s, now);
    }
  }
}

function checkWin(s, now) {
  const left = alive(s);
  if (left.length > 1) return false;
  const w = P(s, left[0]);
  s.phase = 'over';
  s.winner = w ? w.id : null;
  if (w) { w.wins++; w.place = 1; }
  s.bomb = null;
  s.pending = null;
  ev(s, 'win', { by: s.winner }, now);
  stage(s, 'over', 0, now);
  return true;
}

function boom(s, now) {
  const b = s.bomb;
  if (!b) { act(s, now); return; }
  s.removed.push(b.card);
  s.bomb = null;
  ev(s, 'boom', { by: b.pid, crit: !!b.crit }, now);
  eliminate(s, b.pid, now);
  if (checkWin(s, now)) return;
  stage(s, 'after', AFTER_MS, now, b.pid);
}

function afterBoom(s, now) {
  const tp = P(s, s.turn);
  if (!tp || tp.out) {
    beginTurn(s, nextAlive(s, s.turn), 1, now);
    return;
  }
  if (s.pendingSave) {
    s.pending = s.pendingSave;
    s.pendingSave = null;
    stage(s, 'react', anyHiss(s) ? reactMs(s) : QUIET_MS, now);
    return;
  }
  s.giveTo = null;
  act(s, now);
}

export function tick(s, now = Date.now(), rng = Math.random) {
  if (s.phase !== 'play') return false;
  let changed = false;
  if (houseOn(s, 'sudden') && !s.sudden && now - s.startedAt > s.settings.suddenMins * 60000) {
    s.sudden = true;
    ev(s, 'sudden', {}, now);
    changed = true;
  }
  if (!s.deadline || now < s.deadline) return changed;
  switch (s.stage) {
    case 'deal':
      beginTurn(s, s.turn, 1, now);
      break;
    case 'act':
      draw(s, s.turn, false, now);
      break;
    case 'react':
      resolve(s, now);
      break;
    case 'defuse':
      if (s.bomb && count(s, s.bomb.pid, 'coolant')) cool(s, s.bomb.pid, now);
      else boom(s, now);
      break;
    case 'doom':
      boom(s, now);
      break;
    case 'place':
      place(s, s.bomb.pid, Math.floor(rng() * (s.deck.length + 1)), now);
      break;
    case 'bury':
      bury(s, s.who, Math.floor(rng() * s.deck.length), now);
      break;
    case 'give': {
      const h = hand(s, s.who);
      if (h.length) give(s, s.who, h[Math.floor(rng() * h.length)].i, now);
      else { s.giveTo = null; act(s, now); }
      break;
    }
    case 'alter':
      alter(s, s.who, null, now);
      break;
    case 'salvage': {
      const pick = [...s.discard].reverse().find((c) => c.k !== 'meltdown' && c.k !== 'critical');
      if (pick) salvage(s, s.who, pick.k, now);
      else act(s, now);
      break;
    }
    case 'after':
      afterBoom(s, now);
      break;
    default:
      s.deadline = 0;
  }
  return true;
}

const controlled = (p, now) => p.bot || (!p.on && now - (p.offAt || 0) > 8000);

function botWait(s, pid, now, lo = 700, hi = 1700, rng = Math.random) {
  const b = (s.bots[pid] = s.bots[pid] || {});
  if (b.tid !== s.turnId) {
    b.tid = s.turnId;
    b.at = now + lo + rng() * (hi - lo);
    b.done = false;
  }
  if (b.done || now < b.at) return null;
  b.done = true;
  return b;
}

function knownTop(s, pid) {
  const pv = s.priv[pid];
  if (!pv || pv.ver !== s.deckVer || (pv.k !== 'peek' && pv.k !== 'alter')) return null;
  return pv.cards;
}

function botTurn(s, pid, now, rng) {
  const h = hand(s, pid);
  const others = alive(s).filter((x) => x !== pid);
  const rich = others.filter((x) => hand(s, x).length).sort((a, b) => hand(s, b).length - hand(s, a).length);
  const has = (k) => h.find((c) => c.k === k);
  const top = knownTop(s, pid);
  const danger = top && (top[0] === 'meltdown' || top[0] === 'critical');
  const try1 = (k, opt) => { const c = has(k); return c && !play(s, pid, [c.i], opt, now); };
  if ((s.acts || 0) >= 3) return draw(s, pid, false, now);
  const crit = critPos(s);
  if (danger || crit === 0) {
    for (const k of ['nap', 'overload', 'contain', 'reverse', 'scramble']) if (try1(k)) return null;
    if (try1('target', { target: others[Math.floor(rng() * others.length)] })) return null;
    if (try1('bottom')) return null;
  }
  if (!top && rng() < 0.35 && try1('peek')) return null;
  if (!top && rng() < 0.2 && try1('recal')) return null;
  if (rich.length) {
    const groups = {};
    for (const c of h) if (c.k !== 'coolant' && c.k !== 'meltdown' && c.k !== 'critical') (groups[c.k] = groups[c.k] || []).push(c);
    const pair = Object.values(groups).find((g) => g.length >= 2 && CARDS[g[0].k].cat);
    if (pair && rng() < 0.6) {
      const tgt = rich[0];
      if (pair.length >= 3 && rng() < 0.5) {
        if (!play(s, pid, pair.slice(0, 3).map((c) => c.i), { target: tgt, name: 'coolant' }, now)) return null;
      } else if (!play(s, pid, pair.slice(0, 2).map((c) => c.i), { target: tgt }, now)) return null;
    }
    if (rng() < 0.25 && try1('bribe', { target: rich[0] })) return null;
  }
  if (s.turnsLeft > 1 && rng() < 0.6) {
    if (try1('overload')) return null;
    if (try1('target', { target: others[Math.floor(rng() * others.length)] })) return null;
  }
  if (rng() < 0.08 && try1('scramble')) return null;
  return draw(s, pid, false, now);
}

export function botStep(s, now = Date.now(), rng = Math.random) {
  if (s.phase !== 'play') return false;
  const before = s.turnId;
  if (s.stage === 'react' && s.pending) {
    const pd = s.pending;
    for (const id of alive(s)) {
      const p = P(s, id);
      if (!controlled(p, now) || !count(s, id, 'hiss')) continue;
      const b = botWait(s, id, now, 500, Math.max(900, reactMs(s) - 600), rng);
      if (!b) continue;
      const mine = pd.by === id;
      const hit = pd.target === id || (pd.k === 'overload' && nextAlive(s, pd.by) === id);
      const cancelling = pd.hiss % 2 === 1;
      let want = 0;
      if (!mine && !cancelling && hit) want = 0.65;
      else if (mine && cancelling) want = 0.5;
      else if (!mine && !cancelling) want = 0.05;
      if (rng() < want && !hiss(s, id, null, now)) return true;
    }
    return false;
  }
  const who = s.stage === 'act' ? s.turn : s.stage === 'defuse' || s.stage === 'place' ? s.bomb?.pid : s.who;
  const p = who && P(s, who);
  if (!p || !controlled(p, now)) return false;
  if (!botWait(s, who, now, s.stage === 'act' ? 800 : 1100, 2000, rng)) return false;
  switch (s.stage) {
    case 'act': botTurn(s, who, now, rng); break;
    case 'defuse':
      if (count(s, who, 'coolant')) {
        if (houseOn(s, 'streak') && count(s, who, 'coolant') > 1 && rng() < 0.3) hold(s, who, now);
        else cool(s, who, now);
      }
      break;
    case 'place': {
      const n = s.deck.length;
      place(s, who, rng() < 0.5 ? Math.floor(rng() * Math.min(3, n + 1)) : Math.floor(rng() * (n + 1)), now);
      break;
    }
    case 'bury': bury(s, who, Math.floor(rng() * s.deck.length), now); break;
    case 'give': {
      const h = hand(s, who);
      const pick = h.find((c) => CARDS[c.k].cat) || h.find((c) => c.k !== 'coolant') || h[0];
      if (pick) give(s, who, pick.i, now);
      break;
    }
    case 'alter': {
      const top = s.deck.slice(0, 3);
      const bad = top.findIndex((c) => c.k === 'meltdown' || c.k === 'critical');
      const order = top.map((_, i) => i);
      if (bad === 0 && top.length > 1) order.push(order.shift());
      alter(s, who, order, now);
      break;
    }
    case 'salvage': {
      const want = ['coolant', 'hiss', 'nap', 'overload'];
      const k = want.find((x) => s.discard.some((c) => c.k === x)) || [...s.discard].reverse().find((c) => c.k !== 'meltdown' && c.k !== 'critical')?.k;
      if (k) salvage(s, who, k, now);
      break;
    }
    default: break;
  }
  return s.turnId !== before;
}

export function totalCards(s) {
  let n = s.deck.length + s.discard.length + s.removed.length + (s.bomb ? 1 : 0);
  for (const h of Object.values(s.hands)) n += h.length;
  return n;
}
