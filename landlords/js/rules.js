import {
  SPACES, GROUPS, GROUP_SPACES, AIRPORT_SPACES, UTILITY_SPACES, FORTUNE, TREASURY,
  BOARD_SIZE, JAIL, PASS_START, JAIL_FINE,
} from './board.js';
import {
  packOn, houseOn, SPEED_FACES, TERMINAL_COST, PARK_COST, FACTORY_COST, UNZONE_COST,
  SKIM_AMT, SWIPE_AMT, CATCH_REWARD, FALSE_FINE, CHEAT_WINDOW, MARKET_EVENTS,
} from './packs.js';

export const MAX_PLAYERS = 32;
const LOG_MAX = 60;

const rnd = (n) => Math.floor(Math.random() * n);
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ownable = (i) => !!SPACES[i] && ['city', 'airport', 'utility'].includes(SPACES[i].type);
export const P = (s, id) => s.players.find((p) => p.id === id);
export const cur = (s) => s.players[s.turn];
const alive = (s) => s.players.filter((p) => !p.bankrupt);

export function newState(settings = {}) {
  return {
    phase: 'lobby',
    settings: { startCash: 1500, turnSeconds: 45, mode: 'classic', minutes: 20, rounds: 10, packs: {}, house: {}, ...settings },
    players: [],
    nextId: 1,
    props: SPACES.map((_, i) => (ownable(i) ? { o: null, h: 0, m: false, z: null, t: false } : null)),
    turn: 0,
    turnId: 0,
    stage: 'roll',
    dice: [3, 4],
    rollAgain: false,
    doubles: 0,
    pending: null,
    auction: null,
    pot: 0,
    round: 1,
    turnEnds: 0,
    decks: { fortune: [], treasury: [] },
    trades: [],
    nextTrade: 1,
    monos: {},
    log: [],
    logId: 0,
    winner: null,
    ranking: null,
    speed: null,
    choices: null,
    bonusMove: null,
    market: [],
    cheat: null,
    cheated: false,
    zoned: false,
    accused: {},
    prevPid: null,
  };
}

export const MODES = {
  classic: { name: 'Classic', icon: '👑', desc: 'Last landlord standing wins.' },
  time: { name: 'Time Attack', icon: '⏱️', desc: 'Race the clock. Two winners when time runs out: most cash and highest property value.' },
  property: { name: 'Property Fight', icon: '🏙️', desc: 'Ends when every property is owned. Highest property value wins.' },
  rounds: { name: 'Rounds', icon: '🔁', desc: 'Play a set number of rounds. Two winners: most cash and highest property value.' },
};

export function modeLabel(st) {
  const m = MODES[st.mode] || MODES.classic;
  if (st.mode === 'time') return `${m.icon} ${m.name} · ${st.minutes} min`;
  if (st.mode === 'rounds') return `${m.icon} ${m.name} · ${st.rounds} rounds`;
  return `${m.icon} ${m.name}`;
}

export const playerColor = (n) => `hsl(${Math.round((n * 137.508) % 360)} 80% 60%)`;

function log(s, t, pid = null) {
  s.log.push({ id: ++s.logId, t, pid });
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

export function addPlayer(s, { name, emoji, bot = false }) {
  if (s.players.length >= MAX_PLAYERS) throw new Error('This room is full');
  const base = String(name || 'Player').trim().slice(0, 16) || 'Player';
  let nm = base;
  let k = 2;
  while (s.players.some((p) => p.name === nm)) nm = `${base} ${k++}`;
  const n = s.nextId++;
  const p = {
    id: 'p' + n, name: nm, emoji: emoji || '🙂', color: playerColor(n - 1), bot,
    cash: 0, pos: 0, inJail: false, jailTurns: 0, jailCards: 0, bankrupt: false, connected: true,
  };
  s.players.push(p);
  return p;
}

export function removePlayer(s, pid) {
  s.players = s.players.filter((p) => p.id !== pid);
}

const turnMs = (s, p) => (p.connected || p.bot ? s.settings.turnSeconds * 1000 : 12000);

export function startGame(s, ev, now = Date.now()) {
  if (s.players.length < 2) throw new Error('You need at least 2 players');
  shuffle(s.players);
  for (const p of s.players) {
    Object.assign(p, { cash: s.settings.startCash, pos: 0, inJail: false, jailTurns: 0, jailCards: 0, bankrupt: false });
  }
  s.decks.fortune = shuffle(FORTUNE.map((_, i) => i));
  s.decks.treasury = shuffle(TREASURY.map((_, i) => i));
  s.phase = 'playing';
  s.turn = 0;
  s.turnId = 1;
  s.stage = 'roll';
  s.round = 1;
  s.turnEnds = now + turnMs(s, s.players[0]);
  s.endsAt = s.settings.mode === 'time' ? now + s.settings.minutes * 60000 : 0;
  s.warned = 0;
  s.market = [];
  s.cheat = null;
  s.cheated = false;
  s.zoned = false;
  s.accused = {};
  log(s, `The game begins with ${s.players.length} landlords — ${modeLabel(s.settings)}. Good luck!`);
  ev.push({ k: 'start' });
  if (houseOn(s, 'starterDeeds')) dealStarterDeeds(s, ev);
  ev.push({ k: 'turn', pid: s.players[0].id });
}

function dealStarterDeeds(s, ev) {
  const pool = shuffle(SPACES.filter((sp) => sp.type === 'city' && !s.props[sp.i].o).map((sp) => sp.i));
  const each = Math.min(2, Math.floor((pool.length * 0.5) / s.players.length));
  if (!each) {
    log(s, 'Too many landlords for starter deeds — everyone starts empty-handed');
    return;
  }
  for (const p of s.players) {
    const got = pool.splice(0, each);
    got.forEach((i) => { s.props[i].o = p.id; ev.push({ k: 'buy', pid: p.id, sp: i, free: true }); });
    if (got.length) log(s, `${p.name} starts with ${got.map((i) => SPACES[i].name).join(' and ')}`, p.id);
  }
  checkMonos(s, ev);
}

export function ownsGroup(s, pid, g) {
  return GROUP_SPACES[g].every((i) => s.props[i].o === pid);
}

export function marketMult(s, i) {
  const sp = SPACES[i];
  let m = 1;
  for (const e of s.market || []) {
    if (e.target === 'all') m *= e.mult;
    else if (e.target === 'group' && sp.type === 'city' && sp.group === e.group) m *= e.mult;
    else if (e.target === sp.type) m *= e.mult;
  }
  return m;
}

export function calcRent(s, i, dice = 7) {
  const sp = SPACES[i];
  const pr = s.props[i];
  if (!pr || !pr.o || pr.m) return 0;
  const owner = P(s, pr.o);
  if (owner && owner.inJail && houseOn(s, 'jailNoRent')) return 0;
  let r = 0;
  if (sp.type === 'city') {
    if (pr.h > 0) r = sp.rent[pr.h];
    else r = ownsGroup(s, pr.o, sp.group) ? sp.rent[0] * 2 : sp.rent[0];
    if (pr.z === 'park') r *= 1.5;
    if (pr.z === 'factory') r *= 0.5;
  } else if (sp.type === 'airport') {
    const n = AIRPORT_SPACES.filter((j) => s.props[j].o === pr.o).length;
    r = 25 * 2 ** (n - 1);
    if (pr.t) r *= 2;
  } else if (sp.type === 'utility') {
    const n = UTILITY_SPACES.filter((j) => s.props[j].o === pr.o).length;
    r = dice * (n >= 2 ? 10 : 4);
  }
  return Math.round(r * marketMult(s, i));
}

export function propertyValue(s, p) {
  return netWorth(s, p) - p.cash;
}

export const unownedCount = (s) => s.props.filter((pr) => pr && !pr.o).length;

export function netWorth(s, p) {
  let v = p.cash;
  s.props.forEach((pr, i) => {
    if (!pr || pr.o !== p.id) return;
    const sp = SPACES[i];
    v += pr.m ? sp.price / 2 : sp.price;
    if (sp.houseCost) v += Math.min(pr.h, 5) * sp.houseCost + (pr.h === 6 ? sp.houseCost * 2 : 0);
    if (pr.t) v += TERMINAL_COST;
    if (pr.z === 'park') v += PARK_COST;
  });
  return Math.round(v);
}

const groupHouses = (s, g) => GROUP_SPACES[g].map((j) => s.props[j].h);
const groupClear = (s, i) => SPACES[i].type !== 'city' || groupHouses(s, SPACES[i].group).every((h) => h === 0);
export const unmortgageCost = (i) => Math.ceil((SPACES[i].price / 2) * 1.1);

export const buildCost = (i, level) => (level === 6 ? SPACES[i].houseCost * 2 : SPACES[i].houseCost);
export const buildingName = (h) => (h === 6 ? 'skyscraper' : h === 5 ? 'hotel' : 'house');

export function buildError(s, pid, i) {
  const sp = SPACES[i];
  const pr = s.props[i];
  const p = P(s, pid);
  if (!sp || sp.type !== 'city') return 'Only cities can have houses';
  if (!p || pr.o !== pid) return 'You do not own this city';
  if (!ownsGroup(s, pid, sp.group)) return `Own all of ${GROUPS[sp.group].name} first`;
  if (GROUP_SPACES[sp.group].some((j) => s.props[j].m)) return 'Unmortgage the whole set first';
  if (pr.z === 'factory') return 'A factory blocks building here';
  if (pr.h >= 6) return 'Already has a skyscraper';
  if (pr.h === 5) {
    if (!packOn(s, 'sky')) return 'Already has a hotel';
    if (groupHouses(s, sp.group).some((h) => h < 5)) return 'Every city in the set needs a hotel first';
  }
  if (!houseOn(s, 'freeBuild') && pr.h > Math.min(...groupHouses(s, sp.group))) return 'Build evenly across the set';
  if (p.cash < buildCost(i, pr.h + 1)) return 'Not enough cash';
  return null;
}

export function sellError(s, pid, i) {
  const sp = SPACES[i];
  const pr = s.props[i];
  if (!sp || sp.type !== 'city') return 'Nothing to sell';
  if (pr.o !== pid) return 'You do not own this city';
  if (pr.h <= 0) return 'No houses here';
  if (!houseOn(s, 'freeBuild') && pr.h < Math.max(...groupHouses(s, sp.group))) return 'Sell evenly across the set';
  return null;
}

export function terminalError(s, pid, i, on) {
  const pr = s.props[i];
  const p = P(s, pid);
  if (!packOn(s, 'sky')) return 'Terminals are not in this game';
  if (!SPACES[i] || SPACES[i].type !== 'airport') return 'Only airports can have a terminal';
  if (!p || pr.o !== pid) return 'You do not own this airport';
  if (on) {
    if (pr.t) return 'Already has a terminal';
    if (pr.m) return 'Unmortgage it first';
    if (p.cash < TERMINAL_COST) return 'Not enough cash';
  } else if (!pr.t) return 'No terminal here';
  return null;
}

export function zoneError(s, pid, i, kind) {
  const sp = SPACES[i];
  const pr = s.props[i];
  const p = P(s, pid);
  if (!packOn(s, 'zoning')) return 'Zoning is not in this game';
  if (!p || cur(s).id !== pid) return 'Zone on your own turn';
  if (s.zoned) return 'One zoning move per turn';
  if (!sp || sp.type !== 'city') return 'Only cities can be zoned';
  if (kind === 'park') {
    if (pr.o !== pid) return 'Parks go on your own city';
    if (pr.z) return 'This city is already zoned';
    if (p.cash < PARK_COST) return 'Not enough cash';
  } else if (kind === 'factory') {
    if (!pr.o || pr.o === pid) return 'Factories go on a rival’s city';
    if (pr.z) return 'This city is already zoned';
    if (p.cash < FACTORY_COST) return 'Not enough cash';
  } else if (kind === 'clear') {
    if (pr.o !== pid) return 'You do not own this city';
    if (pr.z !== 'factory') return 'No factory to remove';
    if (p.cash < UNZONE_COST) return 'Not enough cash';
  } else return 'Unknown zoning';
  return null;
}

export function mortgageError(s, pid, i) {
  const pr = s.props[i];
  if (!pr || pr.o !== pid) return 'You do not own this';
  if (pr.m) return 'Already mortgaged';
  if (!groupClear(s, i)) return 'Sell the houses in this set first';
  return null;
}

export function unmortgageError(s, pid, i) {
  const pr = s.props[i];
  const p = P(s, pid);
  if (!pr || pr.o !== pid) return 'You do not own this';
  if (!pr.m) return 'Not mortgaged';
  if (p.cash < unmortgageCost(i)) return 'Not enough cash';
  return null;
}

function checkMonos(s, ev) {
  GROUPS.forEach((g, gi) => {
    const o = s.props[GROUP_SPACES[gi][0]].o;
    if (o && ownsGroup(s, o, gi)) {
      if (s.monos[gi] !== o) {
        s.monos[gi] = o;
        ev.push({ k: 'monopoly', pid: o, g: gi });
        log(s, `${P(s, o).name} owns all of ${g.name}! Rents doubled.`, o);
      }
    } else delete s.monos[gi];
  });
}

function payBank(s, p, amt, why, ev) {
  p.cash += amt;
  ev.push({ k: 'pay', from: 'bank', to: p.id, amt, why });
}

function pay(s, from, to, amt, why, ev, quiet = false) {
  if (amt <= 0 || from.bankrupt) return;
  if (from.cash < amt) liquidate(s, from, amt, ev);
  if (from.cash < amt) {
    goBankrupt(s, from, to, ev);
    return;
  }
  from.cash -= amt;
  if (to === 'pot') s.pot += amt;
  else if (to !== 'bank') to.cash += amt;
  ev.push({ k: 'pay', from: from.id, to: typeof to === 'string' ? to : to.id, amt, why, quiet });
}

function liquidate(s, p, target, ev) {
  let raised = 0;
  const mine = [];
  s.props.forEach((pr, i) => { if (pr && pr.o === p.id) mine.push([pr, i]); });
  while (p.cash < target) {
    const term = mine.find(([pr]) => pr.t);
    if (term) {
      const [pr, i] = term;
      pr.t = false;
      const v = TERMINAL_COST / 2;
      p.cash += v;
      raised += v;
      ev.push({ k: 'terminal', sp: i, on: false, pid: p.id });
      continue;
    }
    const built = mine.filter(([pr]) => pr.h > 0).sort((a, b) => b[0].h - a[0].h)[0];
    if (built) {
      const [pr, i] = built;
      const v = Math.floor(buildCost(i, pr.h) / 2);
      pr.h--;
      p.cash += v;
      raised += v;
      ev.push({ k: 'sell', sp: i, h: pr.h, pid: p.id });
      continue;
    }
    const m = mine.find(([pr, i]) => !pr.m && groupClear(s, i));
    if (m) {
      const [pr, i] = m;
      pr.m = true;
      const v = Math.floor(SPACES[i].price / 2);
      p.cash += v;
      raised += v;
      ev.push({ k: 'mortgage', sp: i, m: true, pid: p.id });
      continue;
    }
    break;
  }
  if (raised) {
    ev.push({ k: 'liquidate', pid: p.id, amt: raised });
    log(s, `${p.name} sold assets to raise ${money(raised)}`, p.id);
  }
}

function goBankrupt(s, p, to, ev) {
  const creditor = to && typeof to === 'object' ? to : null;
  if (p.cash > 0) {
    if (creditor) creditor.cash += p.cash;
    else if (to === 'pot') s.pot += p.cash;
    ev.push({ k: 'pay', from: p.id, to: creditor ? creditor.id : to, amt: p.cash, why: 'Everything left' });
  }
  p.cash = 0;
  s.props.forEach((pr) => {
    if (!pr || pr.o !== p.id) return;
    pr.h = 0;
    if (creditor) pr.o = creditor.id;
    else { pr.o = null; pr.m = false; pr.t = false; pr.z = null; }
  });
  p.bankrupt = true;
  p.inJail = false;
  s.trades = s.trades.filter((t) => t.from !== p.id && t.to !== p.id);
  if (s.auction && s.auction.bidder === p.id) { s.auction.bidder = null; s.auction.bid = 0; }
  ev.push({ k: 'bankrupt', pid: p.id, to: creditor ? creditor.id : null });
  log(s, `${p.name} is BANKRUPT${creditor ? ` — ${creditor.name} takes everything` : ''}`, p.id);
  checkMonos(s, ev);
  const left = alive(s);
  if (left.length <= 1) endGame(s, ev, left[0] ? left[0].id : null);
}

const BOARDS = {
  classic: [{ key: 'worth', label: 'Richest landlord' }],
  time: [{ key: 'cash', label: 'Most cash' }, { key: 'property', label: 'Highest property value' }],
  property: [{ key: 'property', label: 'Highest property value' }],
  rounds: [{ key: 'cash', label: 'Most cash' }, { key: 'property', label: 'Highest property value' }],
};

export function metricOf(s, p, key) {
  if (key === 'cash') return p.cash;
  if (key === 'property') return propertyValue(s, p);
  return netWorth(s, p);
}

function endGame(s, ev, survivorId = null, reason = 'last') {
  s.phase = 'over';
  s.auction = null;
  s.pending = null;
  s.endReason = reason;
  const boards = BOARDS[s.settings.mode] || BOARDS.classic;
  const order = (key) => [...s.players]
    .sort((a, b) => (a.bankrupt - b.bankrupt) || metricOf(s, b, key) - metricOf(s, a, key))
    .map((p) => p.id);
  s.winners = boards.map((b) => ({ ...b, pid: survivorId || order(b.key)[0] }));
  if (survivorId) s.winners.forEach((w) => { w.label = 'Last landlord standing'; });
  if (survivorId && s.winners.length > 1) s.winners = [s.winners[0]];
  s.ranking = order(boards[0].key);
  if (survivorId) s.ranking = [survivorId, ...s.ranking.filter((id) => id !== survivorId)];
  s.winner = s.winners[0].pid;
  for (const w of s.winners) log(s, `🏆 ${P(s, w.pid).name} wins — ${w.label}!`, w.pid);
  ev.push({ k: 'win', pid: s.winner, reason });
}

function sendToJail(s, p, ev) {
  p.pos = JAIL;
  p.inJail = true;
  p.jailTurns = 0;
  s.rollAgain = false;
  s.doubles = 0;
  ev.push({ k: 'jail', pid: p.id });
  log(s, `${p.name} was sent to jail`, p.id);
}

function moveBy(s, p, n, ev, opts = {}) {
  const path = [];
  let pos = p.pos;
  let passed = false;
  for (let k = 0; k < n; k++) {
    pos = (pos + 1) % BOARD_SIZE;
    path.push(pos);
    if (pos === 0) passed = true;
  }
  if (!path.length) return;
  p.pos = pos;
  ev.push({ k: 'move', pid: p.id, path, fly: !!opts.fly });
  if (passed) payBank(s, p, PASS_START, 'Passed START', ev);
  if (pos === 0 && houseOn(s, 'doubleStart')) {
    payBank(s, p, PASS_START, 'Exact START bonus', ev);
    log(s, `${p.name} landed exactly on START — double pay!`, p.id);
  }
}

function moveTo(s, p, target, ev, opts = {}) {
  moveBy(s, p, (target - p.pos + BOARD_SIZE) % BOARD_SIZE, ev, opts);
}

function moveBack(s, p, n, ev) {
  const path = [];
  let pos = p.pos;
  for (let k = 0; k < n; k++) {
    pos = (pos - 1 + BOARD_SIZE) % BOARD_SIZE;
    path.push(pos);
  }
  p.pos = pos;
  ev.push({ k: 'move', pid: p.id, path });
}

function land(s, p, ev, dice, opt = {}) {
  const i = p.pos;
  const sp = SPACES[i];
  ev.push({ k: 'land', pid: p.id, sp: i });
  switch (sp.type) {
    case 'city':
    case 'airport':
    case 'utility': {
      const pr = s.props[i];
      if (!pr.o) {
        s.stage = 'buy';
        s.pending = i;
        log(s, `${p.name} landed on ${sp.name} — for sale at ${money(sp.price)}`, p.id);
      } else if (pr.o === p.id) {
        log(s, `${p.name} relaxes in their own ${sp.name}`, p.id);
      } else if (pr.m) {
        log(s, `${sp.name} is mortgaged — no rent due`, p.id);
      } else {
        const owner = P(s, pr.o);
        let rent = opt.utility10 ? dice * 10 : calcRent(s, i, dice);
        if (opt.mult) rent *= opt.mult;
        log(s, `${p.name} pays ${money(rent)} rent to ${owner.name} for ${sp.name}`, p.id);
        pay(s, p, owner, rent, `Rent · ${sp.name}`, ev);
      }
      break;
    }
    case 'tax':
      log(s, `${p.name} pays ${money(sp.amount)} ${sp.name} into the jackpot`, p.id);
      pay(s, p, 'pot', sp.amount, sp.name, ev);
      break;
    case 'fortune':
    case 'treasury':
      drawCard(s, p, sp.type, ev, dice);
      break;
    case 'gotojail':
      sendToJail(s, p, ev);
      break;
    case 'parking':
      if (s.pot > 0) {
        const amt = s.pot;
        s.pot = 0;
        p.cash += amt;
        ev.push({ k: 'pay', from: 'pot', to: p.id, amt, why: 'JACKPOT!', jackpot: true });
        log(s, `🎰 ${p.name} hit the JACKPOT and collects ${money(amt)}!`, p.id);
      } else log(s, `${p.name} parks at an empty jackpot`, p.id);
      break;
    default:
      break;
  }
}

function drawCard(s, p, deck, ev, dice) {
  const cards = deck === 'fortune' ? FORTUNE : TREASURY;
  if (!s.decks[deck].length) s.decks[deck] = shuffle(cards.map((_, i) => i));
  const idx = s.decks[deck].pop();
  const c = cards[idx];
  ev.push({ k: 'card', deck, idx, pid: p.id });
  log(s, `${p.name} drew ${deck === 'fortune' ? 'Fortune' : 'Treasury'}: “${c.text}”`, p.id);
  switch (c.a) {
    case 'goto':
      moveTo(s, p, c.to, ev);
      land(s, p, ev, dice);
      break;
    case 'nearest': {
      const list = c.kind === 'airport' ? AIRPORT_SPACES : UTILITY_SPACES;
      const t = list.find((j) => j > p.pos) ?? list[0];
      moveTo(s, p, t, ev);
      land(s, p, ev, dice, c.kind === 'airport' ? { mult: 2 } : { utility10: true });
      break;
    }
    case 'back':
      moveBack(s, p, c.n, ev);
      land(s, p, ev, dice);
      break;
    case 'jail':
      sendToJail(s, p, ev);
      break;
    case 'jailcard':
      p.jailCards++;
      break;
    case 'collect':
      payBank(s, p, c.n, 'Card', ev);
      break;
    case 'pay':
      pay(s, p, 'pot', c.n, 'Card', ev);
      break;
    case 'repairs': {
      let tot = 0;
      s.props.forEach((pr) => { if (pr && pr.o === p.id) tot += pr.h === 5 ? c.H : pr.h * c.h; });
      if (tot) pay(s, p, 'pot', tot, 'Repairs', ev);
      break;
    }
    case 'each':
      for (const q of alive(s)) if (q.id !== p.id) pay(s, q, p, c.n, 'Birthday', ev);
      break;
    case 'payEach':
      for (const q of alive(s)) {
        if (p.bankrupt) break;
        if (q.id !== p.id && !q.bankrupt) pay(s, p, q, c.n, 'Card', ev);
      }
      break;
    default:
      break;
  }
}

function tycoonTarget(s, p) {
  for (let k = 1; k < BOARD_SIZE; k++) {
    const i = (p.pos + k) % BOARD_SIZE;
    if (ownable(i) && !s.props[i].o) return i;
  }
  for (let k = 1; k < BOARD_SIZE; k++) {
    const i = (p.pos + k) % BOARD_SIZE;
    if (ownable(i) && s.props[i].o !== p.id && !s.props[i].m) return i;
  }
  return null;
}

export function bestTeleport(s, p) {
  let best = null;
  for (let k = 1; k < BOARD_SIZE; k++) {
    const i = (p.pos + k) % BOARD_SIZE;
    if (ownable(i) && !s.props[i].o && p.cash >= SPACES[i].price && (best === null || SPACES[i].price > SPACES[best].price)) best = i;
  }
  if (best !== null) return best;
  for (let k = 1; k < BOARD_SIZE; k++) {
    const i = (p.pos + k) % BOARD_SIZE;
    if (s.props[i] && s.props[i].o === p.id) return i;
  }
  return 32;
}

function finishLanding(s, p, ev) {
  if (p.bankrupt || s.phase !== 'playing') return;
  if (s.stage === 'buy' || s.stage === 'auction') return;
  if (s.bonusMove === 'tycoon' && !p.inJail) {
    s.bonusMove = null;
    const t = tycoonTarget(s, p);
    if (t !== null && t !== p.pos) {
      log(s, `🎩 Tycoon move! ${p.name} heads to ${SPACES[t].name}`, p.id);
      ev.push({ k: 'tycoon', pid: p.id, sp: t });
      s.stage = 'moving';
      moveTo(s, p, t, ev);
      land(s, p, ev, s.dice[0] + s.dice[1]);
      finishLanding(s, p, ev);
      return;
    }
  }
  s.bonusMove = null;
  s.stage = s.rollAgain && !p.inJail ? 'roll' : 'end';
  if (s.stage === 'roll') log(s, `Doubles! ${p.name} rolls again`, p.id);
}

function doRoll(s, p, ev) {
  const d = [1 + rnd(6), 1 + rnd(6)];
  let tot = d[0] + d[1];
  const dbl = d[0] === d[1];
  const sp = packOn(s, 'turbo') && !p.inJail ? SPEED_FACES[rnd(SPEED_FACES.length)] : null;
  s.dice = d;
  s.speed = sp;
  s.bonusMove = null;
  ev.push({ k: 'dice', pid: p.id, d, sp });
  const spText = sp === null ? '' : typeof sp === 'number' ? ` + ⚡${sp}` : sp === 'bus' ? ' + 🚌' : ' + 🎩';
  log(s, `${p.name} rolled ${d[0]} + ${d[1]}${spText}`, p.id);
  if (p.inJail) {
    if (dbl) {
      p.inJail = false;
      p.jailTurns = 0;
      ev.push({ k: 'free', pid: p.id });
      log(s, `${p.name} rolled doubles and broke out of jail!`, p.id);
    } else if (++p.jailTurns >= 3) {
      log(s, `${p.name} served their time and pays ${money(JAIL_FINE)}`, p.id);
      pay(s, p, 'pot', JAIL_FINE, 'Jail fine', ev);
      if (p.bankrupt) return;
      p.inJail = false;
      p.jailTurns = 0;
      ev.push({ k: 'free', pid: p.id });
    } else {
      log(s, `${p.name} stays in jail (${p.jailTurns}/3)`, p.id);
      s.rollAgain = false;
      s.stage = 'end';
      return;
    }
    s.rollAgain = false;
  } else if (dbl) {
    if (++s.doubles >= 3) {
      log(s, `${p.name} rolled doubles three times in a row!`, p.id);
      sendToJail(s, p, ev);
      s.stage = 'end';
      return;
    }
    s.rollAgain = true;
  } else s.rollAgain = false;
  if (sp !== null && typeof sp === 'number' && dbl && d[0] === sp) {
    log(s, `⚡ TRIPLES! ${p.name} can move to any space`, p.id);
    s.rollAgain = false;
    s.stage = 'teleport';
    return;
  }
  if (sp === 'bus') {
    s.choices = [...new Set([d[0], d[1], tot])];
    s.stage = 'bus';
    return;
  }
  if (typeof sp === 'number') tot += sp;
  if (sp === 'tycoon') s.bonusMove = 'tycoon';
  s.stage = 'moving';
  moveBy(s, p, tot, ev);
  land(s, p, ev, tot);
  finishLanding(s, p, ev);
}

function startAuction(s, ev, now) {
  const i = s.pending;
  s.pending = null;
  s.stage = 'auction';
  s.auction = { sp: i, bid: 0, bidder: null, ends: now + 10000 };
  ev.push({ k: 'auction', sp: i });
  log(s, `${SPACES[i].name} goes up for auction!`);
}

function resolveAuction(s, ev, now) {
  const a = s.auction;
  s.auction = null;
  const sp = SPACES[a.sp];
  const w = a.bidder ? P(s, a.bidder) : null;
  if (w && !w.bankrupt && w.cash >= a.bid) {
    w.cash -= a.bid;
    s.props[a.sp].o = w.id;
    ev.push({ k: 'pay', from: w.id, to: 'bank', amt: a.bid, why: sp.name });
    ev.push({ k: 'sold', pid: w.id, sp: a.sp, amt: a.bid });
    log(s, `SOLD! ${w.name} wins ${sp.name} for ${money(a.bid)}`, w.id);
    checkMonos(s, ev);
  } else {
    ev.push({ k: 'sold', pid: null, sp: a.sp });
    log(s, `No bids for ${sp.name}`);
  }
  const c = cur(s);
  s.stage = 'moving';
  finishLanding(s, c, ev);
  s.turnEnds = now + turnMs(s, c);
}

const MARKET_TEXT = {
  boom: (g) => `📈 Boom in ${GROUPS[g].name}! Rents +50% for 2 rounds`,
  crash: (g) => `📉 Crash in ${GROUPS[g].name}! Rents −50% for 2 rounds`,
  recession: () => '🌧️ Recession! All rents −25% this round',
  bull: () => '🐂 Bull market! All rents +25% this round',
  tourism: () => '✈️ Tourist season! Airport rents double for 2 rounds',
  blackout: () => '🔌 Blackout! Utilities earn nothing this round',
  stimulus: () => '💵 Stimulus! Every landlord receives $100',
  proptax: () => '🏛️ Property tax! Everyone pays 3% of their property value into the jackpot',
};

function drawMarket(s, ev) {
  s.market = (s.market || []).filter((e) => e.until >= s.round);
  const total = MARKET_EVENTS.reduce((a, e) => a + e.w, 0);
  let r = Math.random() * total;
  const e = MARKET_EVENTS.find((x) => (r -= x.w) < 0) || MARKET_EVENTS[0];
  const group = e.target === 'group' ? rnd(GROUPS.length) : null;
  const text = MARKET_TEXT[e.kind](group);
  if (e.kind === 'stimulus') {
    for (const p of alive(s)) p.cash += e.amt;
  } else if (e.kind === 'proptax') {
    for (const p of alive(s)) {
      const due = Math.round(propertyValue(s, p) * e.pct);
      if (due > 0) pay(s, p, 'pot', due, 'Property tax', ev, true);
    }
  } else {
    s.market.push({ kind: e.kind, target: e.target, group, mult: e.mult, until: s.round + e.rounds - 1, text });
  }
  log(s, 'BREAKING: ' + text);
  ev.push({ k: 'market', kind: e.kind, group, text });
}

function nextTurn(s, ev, now) {
  s.pending = null;
  s.auction = null;
  s.doubles = 0;
  s.rollAgain = false;
  s.bonusMove = null;
  s.choices = null;
  s.speed = null;
  s.zoned = false;
  s.cheated = false;
  if (s.phase !== 'playing') return;
  s.prevPid = cur(s) ? cur(s).id : null;
  const n = s.players.length;
  let j = s.turn;
  let wrapped = false;
  for (let k = 0; k < n; k++) {
    j = (j + 1) % n;
    if (j === 0) wrapped = true;
    if (!s.players[j].bankrupt) break;
  }
  if (wrapped) {
    s.round++;
    if (s.settings.mode === 'rounds' && s.round > s.settings.rounds) {
      log(s, `All ${s.settings.rounds} rounds are done!`);
      endGame(s, ev, null, 'rounds');
      return;
    }
    ev.push({ k: 'round', r: s.round });
    if (packOn(s, 'market')) {
      drawMarket(s, ev);
      if (s.phase !== 'playing') return;
      if (s.players[j].bankrupt) {
        for (let k = 0; k < n && s.players[j].bankrupt; k++) j = (j + 1) % n;
      }
    }
  }
  s.turn = j;
  s.stage = 'roll';
  s.turnId++;
  s.turnEnds = now + turnMs(s, s.players[j]);
  ev.push({ k: 'turn', pid: s.players[j].id });
}

function post(s, ev, now) {
  if (s.phase === 'playing' && s.settings.mode === 'property' && s.stage !== 'auction' && unownedCount(s) === 0) {
    log(s, 'Every property on the board is owned!');
    endGame(s, ev, null, 'property');
    return;
  }
  if (s.phase === 'playing' && cur(s).bankrupt) nextTurn(s, ev, now);
}

function cleanSide(x) {
  const cash = Math.max(0, Math.floor(Number(x && x.cash) || 0));
  const props = [...new Set(((x && x.props) || []).map(Number))].filter(ownable);
  return { cash, props };
}

export function tradeError(s, t) {
  const A = P(s, t.from);
  const B = P(s, t.to);
  if (!A || !B || A.bankrupt || B.bankrupt) return 'That player is out of the game';
  const ok = (owner, list) => list.every((i) => s.props[i].o === owner.id && groupClear(s, i));
  if (!ok(A, t.give.props) || !ok(B, t.get.props)) return 'Properties changed hands or have houses';
  if (t.give.cash > A.cash || t.get.cash > B.cash) return 'Not enough cash for this trade';
  if (!t.give.props.length && !t.get.props.length && !t.give.cash && !t.get.cash) return 'The trade is empty';
  return null;
}

export class StaleAction extends Error {}
export const TURN_ACTS = ['roll', 'payJail', 'useCard', 'buy', 'decline', 'end', 'busPick', 'teleport'];
export const actCtx = (s) => `${s.turnId}:${s.stage}`;

export function act(s, pid, a, ev, now = Date.now()) {
  if (s.phase !== 'playing') throw new Error('The game is not running');
  if (a.ctx && a.ctx !== actCtx(s)) throw new StaleAction('stale');
  const p = P(s, pid);
  if (!p || p.bankrupt) throw new Error('You are not in this game');
  const mine = cur(s).id === pid;
  const need = (ok, msg) => { if (!ok) throw new Error(msg); };
  const turnAct = (stage) => {
    need(mine, 'It is not your turn');
    need(s.stage === stage, 'You cannot do that right now');
  };
  switch (a.t) {
    case 'roll':
      turnAct('roll');
      doRoll(s, p, ev);
      break;
    case 'payJail':
      turnAct('roll');
      need(p.inJail, 'You are not in jail');
      need(p.cash >= JAIL_FINE, 'Not enough cash');
      p.cash -= JAIL_FINE;
      s.pot += JAIL_FINE;
      p.inJail = false;
      p.jailTurns = 0;
      ev.push({ k: 'pay', from: pid, to: 'pot', amt: JAIL_FINE, why: 'Bail' }, { k: 'free', pid });
      log(s, `${p.name} paid ${money(JAIL_FINE)} bail`, pid);
      break;
    case 'useCard':
      turnAct('roll');
      need(p.inJail && p.jailCards > 0, 'You have no card to use');
      p.jailCards--;
      p.inJail = false;
      p.jailTurns = 0;
      ev.push({ k: 'free', pid });
      log(s, `${p.name} used a Get Out of Jail Free card`, pid);
      break;
    case 'buy': {
      turnAct('buy');
      const i = s.pending;
      const sp = SPACES[i];
      need(p.cash >= sp.price, 'Not enough cash');
      p.cash -= sp.price;
      s.props[i].o = pid;
      s.pending = null;
      ev.push({ k: 'pay', from: pid, to: 'bank', amt: sp.price, why: sp.name }, { k: 'buy', pid, sp: i });
      log(s, `${p.name} bought ${sp.name} for ${money(sp.price)}`, pid);
      checkMonos(s, ev);
      s.stage = 'moving';
      finishLanding(s, p, ev);
      break;
    }
    case 'decline':
      turnAct('buy');
      if (houseOn(s, 'noAuction')) {
        log(s, `${SPACES[s.pending].name} stays unsold`, pid);
        s.pending = null;
        s.stage = 'moving';
        finishLanding(s, p, ev);
      } else startAuction(s, ev, now);
      break;
    case 'busPick': {
      turnAct('bus');
      const n = Math.floor(Number(a.n));
      need(Array.isArray(s.choices) && s.choices.includes(n), 'Pick one of the bus options');
      log(s, `🚌 ${p.name} takes the bus ${n} spaces`, pid);
      s.choices = null;
      s.stage = 'moving';
      moveBy(s, p, n, ev);
      land(s, p, ev, n);
      finishLanding(s, p, ev);
      break;
    }
    case 'teleport': {
      turnAct('teleport');
      const i = Math.floor(Number(a.sp));
      need(i >= 0 && i < BOARD_SIZE, 'Pick a space on the board');
      log(s, `⚡ ${p.name} warps to ${SPACES[i].name}`, pid);
      s.stage = 'moving';
      if (i !== p.pos) moveTo(s, p, i, ev, { fly: true });
      land(s, p, ev, s.dice[0] + s.dice[1]);
      finishLanding(s, p, ev);
      break;
    }
    case 'terminal': {
      const on = a.on !== false;
      const err = terminalError(s, pid, a.sp, on);
      need(!err, err);
      const pr = s.props[a.sp];
      if (on) {
        p.cash -= TERMINAL_COST;
        pr.t = true;
        ev.push({ k: 'pay', from: pid, to: 'bank', amt: TERMINAL_COST, why: 'Terminal' });
        log(s, `🛫 ${p.name} opened a terminal at ${SPACES[a.sp].name}`, pid);
      } else {
        pr.t = false;
        payBank(s, p, TERMINAL_COST / 2, 'Sold terminal', ev);
        log(s, `${p.name} sold the terminal at ${SPACES[a.sp].name}`, pid);
      }
      ev.push({ k: 'terminal', sp: a.sp, on, pid });
      break;
    }
    case 'zone': {
      const kind = a.kind;
      const err = zoneError(s, pid, a.sp, kind);
      need(!err, err);
      const pr = s.props[a.sp];
      const cost = kind === 'park' ? PARK_COST : kind === 'factory' ? FACTORY_COST : UNZONE_COST;
      p.cash -= cost;
      pr.z = kind === 'clear' ? null : kind;
      s.zoned = true;
      ev.push({ k: 'pay', from: pid, to: kind === 'clear' ? 'bank' : 'pot', amt: cost, why: kind === 'park' ? 'Park' : kind === 'factory' ? 'Factory' : 'Cleanup' });
      if (kind !== 'clear') s.pot += cost;
      ev.push({ k: 'zone', sp: a.sp, z: pr.z, kind, pid });
      const owner = P(s, pr.o);
      log(s, kind === 'park' ? `🌳 ${p.name} built a park in ${SPACES[a.sp].name}`
        : kind === 'factory' ? `🏭 ${p.name} dropped a factory on ${owner.name}'s ${SPACES[a.sp].name}!`
          : `🧹 ${p.name} cleared the factory from ${SPACES[a.sp].name}`, pid);
      break;
    }
    case 'cheat': {
      need(packOn(s, 'cheats'), 'Cheats are not in this game');
      need(mine, 'Cheat on your own turn');
      need(!s.cheated, 'You already cheated this turn');
      need(['roll', 'end', 'buy'].includes(s.stage), 'Not now');
      if (a.kind === 'swipe') {
        const v = P(s, a.target);
        need(v && !v.bankrupt && v.id !== pid, 'Pick a rival to swipe from');
        const amt = Math.min(SWIPE_AMT, v.cash);
        need(amt > 0, 'They have no cash');
        v.cash -= amt;
        p.cash += amt;
        s.cheat = { pid, kind: 'swipe', amt, victim: v.id, at: now };
      } else {
        p.cash += SKIM_AMT;
        s.cheat = { pid, kind: 'skim', amt: SKIM_AMT, victim: null, at: now };
      }
      s.cheated = true;
      break;
    }
    case 'accuse': {
      need(packOn(s, 'cheats'), 'Cheats are not in this game');
      const target = P(s, a.target);
      need(target && !target.bankrupt && target.id !== pid, 'Pick someone to accuse');
      const key = `${s.turnId}:${pid}`;
      need(!s.accused[key], 'You already accused someone this turn');
      s.accused = { [key]: true, ...Object.fromEntries(Object.entries(s.accused).filter(([k]) => k.startsWith(s.turnId + ':'))) };
      const c = s.cheat;
      if (c && c.pid === target.id && now - c.at <= CHEAT_WINDOW) {
        s.cheat = null;
        log(s, `🚨 ${p.name} caught ${target.name} cheating!`, pid);
        ev.push({ k: 'caught', pid: target.id, by: pid, kind: c.kind, amt: c.amt });
        const victim = c.victim ? P(s, c.victim) : null;
        pay(s, target, victim && !victim.bankrupt ? victim : 'bank', c.amt, 'Give it back', ev);
        pay(s, target, p, CATCH_REWARD, 'Caught cheating', ev);
      } else {
        log(s, `🙊 ${p.name} wrongly accused ${target.name}`, pid);
        ev.push({ k: 'falseAccuse', pid, target: target.id });
        pay(s, p, target, FALSE_FINE, 'False accusation', ev);
      }
      break;
    }
    case 'bid': {
      need(s.stage === 'auction' && s.auction, 'No auction is running');
      const amt = Math.floor(Number(a.amt));
      need(amt > s.auction.bid, 'Bid higher than the current bid');
      need(amt <= p.cash, 'Not enough cash');
      s.auction.bid = amt;
      s.auction.bidder = pid;
      s.auction.ends = Math.max(s.auction.ends, now + 5000);
      ev.push({ k: 'bid', pid, amt });
      break;
    }
    case 'end':
      turnAct('end');
      nextTurn(s, ev, now);
      post(s, ev, now);
      return;
    case 'build': {
      const err = buildError(s, pid, a.sp);
      need(!err, err);
      const sp = SPACES[a.sp];
      const pr = s.props[a.sp];
      const cost = buildCost(a.sp, pr.h + 1);
      p.cash -= cost;
      pr.h++;
      ev.push({ k: 'pay', from: pid, to: 'bank', amt: cost, why: buildingName(pr.h) }, { k: 'build', sp: a.sp, h: pr.h, pid });
      log(s, `${p.name} built a ${pr.h >= 5 ? buildingName(pr.h).toUpperCase() : 'house'} in ${sp.name}`, pid);
      break;
    }
    case 'sell': {
      const err = sellError(s, pid, a.sp);
      need(!err, err);
      const sp = SPACES[a.sp];
      const pr = s.props[a.sp];
      const refund = Math.floor(buildCost(a.sp, pr.h) / 2);
      pr.h--;
      payBank(s, p, refund, 'Sold building', ev);
      ev.push({ k: 'sell', sp: a.sp, h: pr.h, pid });
      log(s, `${p.name} sold a building in ${sp.name}`, pid);
      break;
    }
    case 'mortgage': {
      const err = mortgageError(s, pid, a.sp);
      need(!err, err);
      s.props[a.sp].m = true;
      payBank(s, p, Math.floor(SPACES[a.sp].price / 2), 'Mortgage', ev);
      ev.push({ k: 'mortgage', sp: a.sp, m: true, pid });
      log(s, `${p.name} mortgaged ${SPACES[a.sp].name}`, pid);
      break;
    }
    case 'unmortgage': {
      const err = unmortgageError(s, pid, a.sp);
      need(!err, err);
      const cost = unmortgageCost(a.sp);
      p.cash -= cost;
      s.props[a.sp].m = false;
      ev.push({ k: 'pay', from: pid, to: 'bank', amt: cost, why: 'Unmortgage' }, { k: 'mortgage', sp: a.sp, m: false, pid });
      log(s, `${p.name} paid off the mortgage on ${SPACES[a.sp].name}`, pid);
      break;
    }
    case 'propose': {
      need(a.to !== pid, 'You cannot trade with yourself');
      need(s.trades.filter((t) => t.from === pid).length < 3, 'You already have 3 open offers');
      const t = { id: s.nextTrade++, from: pid, to: a.to, give: cleanSide(a.give), get: cleanSide(a.get) };
      const err = tradeError(s, t);
      need(!err, err);
      s.trades.push(t);
      ev.push({ k: 'tradeOffer', id: t.id, from: pid, to: t.to });
      log(s, `${p.name} offered a trade to ${P(s, t.to).name}`, pid);
      break;
    }
    case 'tradeReply': {
      const t = s.trades.find((x) => x.id === a.id);
      need(t && t.to === pid, 'That offer is gone');
      s.trades = s.trades.filter((x) => x !== t);
      const A = P(s, t.from);
      const err = a.accept ? tradeError(s, t) : null;
      if (a.accept && !err) {
        A.cash += t.get.cash - t.give.cash;
        p.cash += t.give.cash - t.get.cash;
        t.give.props.forEach((i) => { s.props[i].o = p.id; });
        t.get.props.forEach((i) => { s.props[i].o = A.id; });
        ev.push({ k: 'trade', from: A.id, to: p.id, t });
        log(s, `🤝 ${A.name} and ${p.name} made a deal`, pid);
        checkMonos(s, ev);
      } else {
        ev.push({ k: 'tradeNo', from: A.id, to: p.id, why: err });
        log(s, `${p.name} declined ${A.name}'s offer${err ? ` (${err})` : ''}`, pid);
      }
      break;
    }
    case 'tradeCancel': {
      const t = s.trades.find((x) => x.id === a.id);
      need(t && t.from === pid, 'That offer is gone');
      s.trades = s.trades.filter((x) => x !== t);
      ev.push({ k: 'tradeNo', from: pid, to: t.to, cancelled: true });
      break;
    }
    default:
      throw new Error('Unknown action');
  }
  if (mine && s.phase === 'playing' && cur(s).id === pid && ['roll', 'payJail', 'useCard', 'buy', 'busPick', 'teleport'].includes(a.t)) {
    s.turnEnds = now + turnMs(s, p);
  }
  post(s, ev, now);
}

export function endNow(s, ev) {
  if (s.phase !== 'playing') throw new Error('The game is not running');
  log(s, '🏁 The host ended the game');
  endGame(s, ev, null, 'host');
}

export function tick(s, now, ev) {
  if (s.phase !== 'playing') return false;
  if (s.endsAt) {
    const left = s.endsAt - now;
    if (left <= 0) {
      log(s, '⏱️ Time is up!');
      endGame(s, ev, null, 'time');
      return true;
    }
    const marks = [300000, 60000, 10000];
    const next = marks.findIndex((m, k) => k >= s.warned && left <= m && m < s.settings.minutes * 60000);
    if (next >= 0) {
      s.warned = next + 1;
      ev.push({ k: 'clock', left: marks[next] });
      return true;
    }
  }
  if (s.cheat && now - s.cheat.at > CHEAT_WINDOW) s.cheat = null;
  if (s.stage === 'auction') {
    if (s.auction && now >= s.auction.ends) {
      resolveAuction(s, ev, now);
      post(s, ev, now);
      return true;
    }
    return false;
  }
  if (now < s.turnEnds) return false;
  const p = cur(s);
  let a;
  if (s.stage === 'roll') a = { t: 'roll' };
  else if (s.stage === 'buy') a = { t: 'decline' };
  else if (s.stage === 'bus') a = { t: 'busPick', n: s.choices[s.choices.length - 1] };
  else if (s.stage === 'teleport') a = { t: 'teleport', sp: bestTeleport(s, p) };
  else a = { t: 'end' };
  if (p.connected && !p.bot && a.t !== 'end') log(s, `⏰ ${p.name} ran out of time`, p.id);
  try {
    act(s, p.id, a, ev, now);
  } catch (e) {
    nextTurn(s, ev, now);
  }
  if (s.phase === 'playing' && cur(s).id === p.id && s.stage !== 'auction') {
    s.turnEnds = now + (p.connected || p.bot ? 10000 : 8000);
  }
  return true;
}
