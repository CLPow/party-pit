export const N = 1, E = 2, S = 4, W = 8;
export const DIRS = [[N, 0, -1], [E, 1, 0], [S, 0, 1], [W, -1, 0]];
export const rot = (m) => ((m << 2) | (m >> 2)) & 15;
const bitsOf = (m) => [N, E, S, W].filter((b) => m & b);
export const key = (x, y) => x + ',' + y;
export const MAX_SEATS = 32;
export const CLAIM_SECS = 60;
export const LADDER_X = 3;
export const TOOLS = { d: 'Drill', l: 'Lamp', c: 'Cart' };
export const TOOL_ICON = { d: '⛏️', l: '🔦', c: '🛒' };

const through = (mask, extra = {}) => ({ type: 'path', mask, groups: [mask], ...extra });
const deadEnd = (mask) => ({ type: 'path', mask, groups: bitsOf(mask), dead: true });
const action = (name, desc, target, extra = {}) => ({ type: 'act', name, desc, target, ...extra });

export const CARDS = {
  p15: through(15), p7: through(7), p14: through(14), p10: through(10), p5: through(5), p3: through(3), p6: through(6),
  x15: deadEnd(15), x7: deadEnd(7), x14: deadEnd(14), x10: deadEnd(10), x5: deadEnd(5), x3: deadEnd(3), x6: deadEnd(6), x1: deadEnd(1), x2: deadEnd(2),
  c15: through(15, { crystal: 1 }), c10: through(10, { crystal: 1 }), c5: through(5, { crystal: 1 }), c7: through(7, { crystal: 1 }),
  lad: through(15, { ladder: true }),
  br: { type: 'path', mask: 15, groups: [5, 10], bridge: true },
  da10: through(10, { door: 'a' }), da15: through(15, { door: 'a' }), da14: through(14, { door: 'a' }),
  dc10: through(10, { door: 'c' }), dc15: through(15, { door: 'c' }), dc14: through(14, { door: 'c' }),
  'brk-d': action('Snap the Drill', 'Break a player\'s drill. They can\'t dig until it is fixed.', 'player', { brk: 'd' }),
  'brk-l': action('Smash the Lamp', 'Break a player\'s lamp. They can\'t dig until it is fixed.', 'player', { brk: 'l' }),
  'brk-c': action('Wreck the Cart', 'Break a player\'s cart. They can\'t dig until it is fixed.', 'player', { brk: 'c' }),
  'fix-d': action('Drill Repair', 'Fix a broken drill (yours or anyone\'s).', 'player', { fix: 'd' }),
  'fix-l': action('Lamp Repair', 'Fix a broken lamp (yours or anyone\'s).', 'player', { fix: 'l' }),
  'fix-c': action('Cart Repair', 'Fix a broken cart (yours or anyone\'s).', 'player', { fix: 'c' }),
  'fix-dl': action('Toolbox', 'Fix a broken drill OR lamp.', 'player', { fix: 'dl' }),
  'fix-lc': action('Toolbox', 'Fix a broken lamp OR cart.', 'player', { fix: 'lc' }),
  'fix-dc': action('Toolbox', 'Fix a broken drill OR cart.', 'player', { fix: 'dc' }),
  cave: action('Cave-in', 'Collapse one tunnel card on the board.', 'cell'),
  survey: action('Survey', 'Secretly look at a hidden vein, then you MUST tell everyone what you saw by text or voice. You may lie.', 'goal'),
  pick: action('Pickpocket', 'Keep it in front of you. At round end you steal 1 gold from the biggest earner.', 'self'),
  handsoff: action('Hands Off', 'Remove a Pickpocket from any player.', 'player'),
  shack: action('Shackles', 'Shackle a player: no digging, and no gold this round while shackled.', 'player'),
  free: action('Bolt Cutters', 'Free a shackled player.', 'player'),
  interro: action('Interrogate', 'Secretly see another player\'s role.', 'player'),
  badge: action('Swap Badges', 'Give a player (or yourself) a fresh secret role from the spare pile.', 'player'),
  hswap: action('Sticky Fingers', 'Swap your whole hand with another player.', 'player'),
  flood: action('Flood', 'Flood an empty cell. Nobody can dig there until it is pumped.', 'cell'),
  pump: action('Pump', 'Pump out a flooded cell.', 'cell'),
  bats: action('Bats!', 'A swarm makes a player drop 1 random card.', 'player'),
  dyn: action('Dynamite', 'Blow up every tunnel card in a 3×3 area.', 'cell'),
};

const PATH_NAMES = { 15: 'Crossroads', 7: 'T-junction', 14: 'T-junction', 13: 'T-junction', 11: 'T-junction', 10: 'Straight', 5: 'Straight', 3: 'Bend', 6: 'Bend', 9: 'Bend', 12: 'Bend' };
export function cardName(k) {
  const c = CARDS[k];
  if (!c) return '?';
  if (c.type === 'act') return c.name;
  if (c.ladder) return 'Ladder';
  if (c.bridge) return 'Bridge';
  if (c.door) return (c.door === 'a' ? 'Amber' : 'Cobalt') + ' Door';
  if (c.crystal) return 'Crystal ' + (PATH_NAMES[c.mask] || 'Tunnel');
  if (c.dead) return 'Dead End';
  return PATH_NAMES[c.mask] || 'Tunnel';
}

const BASE = {
  p15: 5, p7: 5, p14: 5, p10: 4, p5: 3, p3: 4, p6: 5, x15: 1, x7: 1, x14: 1, x10: 1, x5: 1, x3: 1, x6: 1, x1: 1, x2: 1,
  'brk-d': 3, 'brk-l': 3, 'brk-c': 3, 'fix-d': 2, 'fix-l': 2, 'fix-c': 2, 'fix-dl': 1, 'fix-lc': 1, 'fix-dc': 1, cave: 3, survey: 6,
};

export const PACKS = [
  { id: 'crews', icon: '🚪', name: 'Rival Crews', desc: 'Diggers split into Amber and Cobalt crews. Coloured doors only let one crew through to the gold.', cards: { da10: 1, da15: 1, da14: 1, dc10: 1, dc15: 1, dc14: 1 } },
  { id: 'specialists', icon: '🎩', name: 'Specialists', desc: 'New secret roles: the Foreman wins with any crew for a smaller cut, and the Fence always skims a little.', cards: {} },
  { id: 'tricks', icon: '🃏', name: 'Dirty Tricks', desc: 'Pickpockets, Shackles, Interrogate, Swap Badges and Sticky Fingers hand swaps.', cards: { pick: 4, handsoff: 2, shack: 3, free: 3, interro: 2, badge: 2, hswap: 2 } },
  { id: 'crystal', icon: '💎', name: 'Crystal Veins', desc: 'Crystal tunnels, ladders that open new entrances near the mine mouth, bridges, and the Geologist who cashes in crystals.', cards: { c15: 2, c10: 2, c5: 1, c7: 1, lad: 3, br: 2 } },
  { id: 'hazards', icon: '🌊', name: 'Hazards', desc: 'Floods block cells until pumped, bats knock cards out of hands, and Dynamite clears a 3×3 blast.', cards: { flood: 3, pump: 2, bats: 3, dyn: 1 } },
];

export const ROLES = {
  digger: { name: 'Digger', icon: '⛏️', side: 'dig', desc: 'Dig a tunnel from the entrance to the gold. Gold found = you get paid.' },
  amber: { name: 'Amber Digger', icon: '🟧', side: 'dig', crew: 'a', desc: 'Reach the gold with no Cobalt door in your way. Amber doors are fine.' },
  cobalt: { name: 'Cobalt Digger', icon: '🟦', side: 'dig', crew: 'c', desc: 'Reach the gold with no Amber door in your way. Cobalt doors are fine.' },
  traitor: { name: 'Traitor', icon: '🗡️', side: 'trt', desc: 'Secretly stop the diggers. If the cards run out before the gold is reached, you get paid.' },
  foreman: { name: 'Foreman', icon: '🎩', side: 'dig', desc: 'Get the gold reached by any crew. You get half a normal cut.' },
  fence: { name: 'Fence', icon: '🕶️', side: 'neutral', desc: 'You get 1 gold if the diggers win and 2 if the traitors win. Play both sides.' },
  geologist: { name: 'Geologist', icon: '💎', side: 'neutral', desc: 'You don\'t care about gold. Earn 1 for every 2 crystals on the board at round end (max 4).' },
};

export const defaultSettings = () => ({ packs: [], rounds: 3, turnSecs: 30, revealRoles: true, traitors: 0, hand: 0 });

export function newGame(hostId) {
  return {
    phase: 'lobby', hostId, players: [], settings: defaultSettings(), round: 0, roundId: 0,
    board: {}, goals: [], flood: {}, deck: [], cards: [], hands: {}, roles: {}, rolePool: [],
    order: [], turn: null, turnNo: 0, deadline: 0, log: [], logId: 0, result: null, peeks: {}, intel: {}, sus: {},
    discards: 0, botAt: 0, bounds: null, podium: null, hist: [], claims: [], await: null,
  };
}

const seated = (s) => s.players.filter((p) => !p.spectator);
export const inRound = (s, p) => p && !p.spectator && !p.wait && s.order.includes(p.id);
export const P = (s, id) => s.players.find((p) => p.id === id);

export function addPlayer(s, info) {
  let p = P(s, info.id);
  if (p) {
    Object.assign(p, { name: info.name, avatar: info.avatar, color: info.color, on: true });
    return p;
  }
  const full = seated(s).length >= MAX_SEATS;
  p = { id: info.id, name: info.name, avatar: info.avatar, color: info.color, bot: !!info.bot, on: true, spectator: full, gold: 0, tools: {}, shack: false, pick: 0, wait: s.phase !== 'lobby' };
  s.players.push(p);
  return p;
}

export function removePlayer(s, id) {
  const i = s.players.findIndex((p) => p.id === id);
  if (i < 0) return;
  s.players.splice(i, 1);
  if (s.phase === 'lobby') return;
  delete s.hands[id];
  const wasTurn = s.turn === id;
  const oi = s.order.indexOf(id);
  if (oi >= 0) s.order.splice(oi, 1);
  if (s.await && s.await.pid === id) s.await = null;
  if (s.phase === 'play') {
    if (s.order.length < 2) { endRound(s, 'abandon'); return; }
    if (wasTurn) advance(s, oi - 1);
  }
}

export function setConnected(s, id, on) {
  const p = P(s, id);
  if (p) p.on = on;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const handSize = (n, set) => set || (n <= 5 ? 6 : n <= 7 ? 5 : 4);
export const goalCount = (n) => (n <= 10 ? 3 : n <= 20 ? 5 : 7);
export const goalDist = (n) => (n <= 10 ? 8 : n <= 20 ? 10 : 12);
export function traitorCount(n) {
  const table = [0, 1, 1, 1, 1, 2, 2, 3, 3, 3, 4];
  return n <= 10 ? table[n] : Math.round(n * 0.4);
}
const has = (s, pack) => s.settings.packs.includes(pack);

function buildRoles(s, n) {
  const t = s.settings.traitors ? Math.min(n - 1, s.settings.traitors) : traitorCount(n);
  const exact = !!s.settings.traitors;
  const pool = [];
  for (let i = 0; i < t; i++) pool.push('traitor');
  if (has(s, 'specialists') && n >= 5) {
    for (let i = 0; i < Math.max(1, Math.floor(n / 10)); i++) pool.push('foreman');
    for (let i = 0; i < Math.max(1, Math.floor(n / 10)); i++) pool.push('fence');
  }
  if (has(s, 'crystal') && n >= 4) for (let i = 0; i < Math.max(1, Math.floor(n / 8)); i++) pool.push('geologist');
  const diggers = Math.max(1, n + (exact ? 0 : 1) - pool.length);
  for (let i = 0; i < diggers; i++) pool.push(has(s, 'crews') ? (i % 2 ? 'cobalt' : 'amber') : 'digger');
  shuffle(pool);
  if (exact) {
    const tr = pool.filter((r) => r === 'traitor');
    const rest = pool.filter((r) => r !== 'traitor');
    return { deal: shuffle([...tr, ...rest.slice(0, n - tr.length)]), spare: rest.slice(n - tr.length) };
  }
  return { deal: pool.slice(0, n), spare: pool.slice(n) };
}

function buildDeck(s, n) {
  const m = Math.ceil(n / 10);
  const counts = { ...BASE };
  for (const pk of PACKS) if (has(s, pk.id)) for (const [k, v] of Object.entries(pk.cards)) counts[k] = (counts[k] || 0) + v;
  const deck = [];
  for (const [k, v] of Object.entries(counts)) for (let i = 0; i < v * m; i++) deck.push(k);
  return shuffle(deck).slice(0, 34 + n * 4);
}

export function startGame(s) {
  for (const p of s.players) { p.gold = 0; p.wait = false; }
  s.round = 0;
  s.podium = null;
  s.hist = [];
  s.sus = {};
  startRound(s);
}

export function startRound(s) {
  for (const p of s.players) { if (!p.spectator) p.wait = false; p.tools = {}; p.shack = false; p.pick = 0; p.got = 0; }
  const players = s.players.filter((p) => !p.spectator);
  const n = players.length;
  s.round++;
  s.roundId++;
  const first = s.nextFirst && players.findIndex((p) => p.id === s.nextFirst);
  const start = first > 0 ? first : 0;
  s.order = [...players.slice(start), ...players.slice(0, start)].map((p) => p.id);
  const { deal, spare } = buildRoles(s, n);
  s.roles = {};
  s.order.forEach((id, i) => { s.roles[id] = deal[i]; });
  s.rolePool = spare;
  s.cards = buildDeck(s, n);
  s.deck = s.cards.map((_, i) => i);
  shuffle(s.deck);
  const hs = handSize(n, s.settings.hand);
  s.hands = {};
  for (const id of s.order) s.hands[id] = s.deck.splice(0, hs);
  const gc = goalCount(n);
  const golds = gc === 7 ? 2 : 1;
  const kinds = shuffle([...Array(golds).fill('gold'), ...Array.from({ length: gc - golds }, (_, i) => (i % 2 ? 'rockR' : 'rockL'))]);
  const span = gc - 1;
  const gx = goalDist(n);
  s.goals = kinds.map((g, i) => ({ x: gx, y: -span + i * 2, kind: g, open: false, mask: g === 'gold' ? 15 : g === 'rockL' ? 9 : 12 }));
  s.bounds = { x0: -5, x1: gx + 5, y0: -span - 4, y1: span + 4 };
  s.board = { [key(0, 0)]: { k: 'start', mask: 15, groups: [15], r: 0 } };
  s.flood = {};
  s.peeks = {};
  s.intel = {};
  s.claims = [];
  s.await = null;
  s.log = [];
  s.result = null;
  s.discards = 0;
  s.turnNo = 0;
  s.phase = 'play';
  s.turn = null;
  advance(s, -1);
  pushLog(s, { a: 'round', round: s.round });
}

export const goalAt = (s, x, y) => s.goals.findIndex((g) => g.x === x && g.y === y);

export function cellInfo(s, x, y) {
  const b = s.board[key(x, y)];
  if (b) return b;
  const gi = goalAt(s, x, y);
  if (gi >= 0) {
    const g = s.goals[gi];
    return g.open ? { k: 'goal', goal: gi, mask: g.mask, groups: [g.mask] } : { k: 'goal', goal: gi, hidden: true };
  }
  return null;
}

export function placed(k, r) {
  const c = CARDS[k];
  const f = r ? rot : (m) => m;
  return { mask: f(c.mask), groups: c.groups.map(f) };
}

export function reach(s, block = null) {
  const seen = new Set();
  const q = [];
  const visit = (x, y, gi) => {
    const id = key(x, y) + '#' + gi;
    if (seen.has(id)) return;
    seen.add(id);
    q.push([x, y, gi]);
  };
  visit(0, 0, 0);
  for (const [kk, b] of Object.entries(s.board)) {
    if (b.k === 'lad') { const [x, y] = kk.split(',').map(Number); visit(x, y, 0); }
  }
  while (q.length) {
    const [x, y, gi] = q.shift();
    const c = cellInfo(s, x, y);
    const g = c.groups[gi];
    for (const [b, dx, dy] of DIRS) {
      if (!(g & b)) continue;
      const nx = x + dx, ny = y + dy;
      const nb = cellInfo(s, nx, ny);
      if (!nb || nb.hidden) continue;
      if (block && nb.door && nb.door === block) continue;
      const o = rot(b);
      const ni = nb.groups.findIndex((m) => m & o);
      if (ni >= 0) visit(nx, ny, ni);
    }
  }
  return seen;
}

export function canPlace(s, k, r, x, y, rs = null) {
  const bd = s.bounds;
  if (x < bd.x0 || x > bd.x1 || y < bd.y0 || y > bd.y1) return false;
  if (cellInfo(s, x, y) || s.flood[key(x, y)]) return false;
  const { mask } = placed(k, r);
  const ladder = CARDS[k].ladder;
  let links = false;
  let any = false;
  const R = rs || reach(s);
  for (const [b, dx, dy] of DIRS) {
    const nb = cellInfo(s, x + dx, y + dy);
    if (!nb || nb.hidden) continue;
    any = true;
    const o = rot(b);
    const mine = !!(mask & b);
    const theirs = !!(nb.mask & o);
    if (mine !== theirs) return false;
    if (mine) {
      const ni = nb.groups.findIndex((m) => m & o);
      if (R.has(key(x + dx, y + dy) + '#' + ni)) links = true;
    }
  }
  if (ladder) return x <= LADDER_X;
  return links && any;
}

export function legalCells(s, k, r) {
  const rs = reach(s);
  const out = [];
  const bd = s.bounds;
  const cand = new Set();
  if (CARDS[k].ladder) {
    for (let x = bd.x0; x <= LADDER_X; x++) for (let y = bd.y0; y <= bd.y1; y++) cand.add(key(x, y));
  } else {
    for (const id of rs) {
      const [x, y] = id.split('#')[0].split(',').map(Number);
      for (const [, dx, dy] of DIRS) cand.add(key(x + dx, y + dy));
    }
  }
  for (const c of cand) {
    const [x, y] = c.split(',').map(Number);
    if (canPlace(s, k, r, x, y, rs)) out.push([x, y]);
  }
  return out;
}

export const canDig = (p) => !p.shack && !Object.values(p.tools || {}).some(Boolean);

export function targets(s, pid, k) {
  const c = CARDS[k];
  const me = P(s, pid);
  const live = s.order.map((id) => P(s, id)).filter(Boolean);
  if (c.brk) return live.filter((p) => p.id !== pid && !p.tools[c.brk]).map((p) => p.id);
  if (c.fix) return live.filter((p) => [...c.fix].some((t) => p.tools[t])).map((p) => p.id);
  switch (k) {
    case 'pick': return [pid];
    case 'handsoff': return live.filter((p) => p.pick > 0).map((p) => p.id);
    case 'shack': return live.filter((p) => p.id !== pid && !p.shack).map((p) => p.id);
    case 'free': return live.filter((p) => p.shack).map((p) => p.id);
    case 'interro': return live.filter((p) => p.id !== pid && !(s.intel[pid] || {})[p.id]).map((p) => p.id);
    case 'badge': return s.rolePool.length ? live.map((p) => p.id) : [];
    case 'hswap': case 'bats': return live.filter((p) => p.id !== pid && (s.hands[p.id] || []).length).map((p) => p.id);
    default: return me ? [] : [];
  }
}

export function cellTargets(s, k) {
  const out = [];
  if (k === 'survey') return s.goals.map((g, i) => (g.open ? -1 : i)).filter((i) => i >= 0);
  if (k === 'cave') {
    for (const [kk, b] of Object.entries(s.board)) if (b.k !== 'start') out.push(kk.split(',').map(Number));
    return out;
  }
  if (k === 'dyn') {
    const set = new Set();
    for (const [kk, b] of Object.entries(s.board)) {
      if (b.k === 'start') continue;
      const [x, y] = kk.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) set.add(key(x + dx, y + dy));
    }
    return [...set].map((c) => c.split(',').map(Number));
  }
  if (k === 'pump') return Object.keys(s.flood).map((c) => c.split(',').map(Number));
  if (k === 'flood') {
    const set = new Set();
    const bd = s.bounds;
    for (const kk of Object.keys(s.board)) {
      const [x, y] = kk.split(',').map(Number);
      for (const [, dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < bd.x0 || nx > bd.x1 || ny < bd.y0 || ny > bd.y1) continue;
        if (!cellInfo(s, nx, ny) && !s.flood[key(nx, ny)]) set.add(key(nx, ny));
      }
    }
    return [...set].map((c) => c.split(',').map(Number));
  }
  return out;
}

function pushLog(s, e) {
  e.i = ++s.logId;
  s.log.push(e);
  if (s.log.length > 40) s.log.shift();
  return e;
}

function draw(s, pid) {
  if (s.deck.length) s.hands[pid].push(s.deck.shift());
}

function turnSecs(s, p) {
  if (!p) return 0;
  if (p.bot) return 0;
  if (!p.on) return 4;
  return s.settings.turnSecs;
}

function advance(s, fromIdx) {
  const n = s.order.length;
  for (let step = 1; step <= n; step++) {
    const id = s.order[(fromIdx + step + n) % n];
    if ((s.hands[id] || []).length) {
      s.turn = id;
      s.turnNo++;
      const p = P(s, id);
      const secs = turnSecs(s, p);
      s.deadline = secs ? Date.now() + secs * 1000 : 0;
      s.botAt = Date.now() + (p && p.bot ? botDelay(s) : 0);
      return;
    }
  }
  endRound(s, 'empty');
}

function botDelay(s) {
  const humans = s.players.filter((p) => !p.bot && p.on && !p.spectator).length;
  if (s.fast) return 0;
  return humans ? 900 + Math.random() * 900 : 250;
}

function nextTurn(s) {
  if (s.phase !== 'play') return;
  advance(s, s.order.indexOf(s.turn));
}

function takeCard(s, pid, id) {
  const h = s.hands[pid] || [];
  const i = h.indexOf(id);
  if (i < 0) return null;
  h.splice(i, 1);
  return s.cards[id];
}

const sus = (s, pid, d) => { s.sus[pid] = (s.sus[pid] || 0) + d; };

export function play(s, pid, m) {
  if (s.phase !== 'play') return 'not-now';
  if (s.turn !== pid) return 'not-your-turn';
  if (s.await) return 'claim-first';
  const id = Number(m.id);
  const hand = s.hands[pid] || [];
  if (!hand.includes(id)) return 'no-card';
  const k = s.cards[id];
  const c = CARDS[k];
  const me = P(s, pid);
  if (m.discard) {
    takeCard(s, pid, id);
    s.discards++;
    pushLog(s, { a: 'discard', pid });
    draw(s, pid);
    nextTurn(s);
    return null;
  }
  let entry;
  if (c.type === 'path') {
    if (!canDig(me)) return 'tools-broken';
    const x = Number(m.x), y = Number(m.y), r = m.r ? 1 : 0;
    if (!canPlace(s, k, r, x, y)) return 'illegal';
    const before = frontierDist(s);
    takeCard(s, pid, id);
    s.board[key(x, y)] = { k, r, ...placed(k, r), door: c.door, crystal: c.crystal, by: pid };
    const after = frontierDist(s);
    sus(s, pid, c.dead ? 2 : after < before ? -1 : 0.5);
    entry = pushLog(s, { a: 'place', pid, k, r, x, y });
    const found = revealGoals(s, pid);
    if (found) { draw(s, pid); return null; }
  } else {
    entry = actCard(s, pid, k, m);
    if (typeof entry === 'string') return entry;
    takeCard(s, pid, id);
    if (k === 'survey') {
      draw(s, pid);
      const p = P(s, pid);
      s.await = { pid, goal: entry.goal };
      s.deadline = Date.now() + (p.bot ? 0 : (p.on ? CLAIM_SECS : 6) * 1000);
      s.botAt = Date.now() + (p.bot ? botDelay(s) * 1.5 : 0);
      return null;
    }
  }
  draw(s, pid);
  nextTurn(s);
  return null;
}

function actCard(s, pid, k, m) {
  const c = CARDS[k];
  if (c.target === 'player' || c.target === 'self') {
    const tid = c.target === 'self' ? pid : m.target;
    if (!targets(s, pid, k).includes(tid)) return 'bad-target';
    const t = P(s, tid);
    if (c.brk) {
      t.tools[c.brk] = true;
      sus(s, pid, (s.sus[tid] || 0) < 0 ? 1.5 : -0.5);
      return pushLog(s, { a: 'break', pid, target: tid, tool: c.brk, k });
    }
    if (c.fix) {
      const tool = c.fix.length === 1 ? c.fix : (m.tool && c.fix.includes(m.tool) && t.tools[m.tool] ? m.tool : [...c.fix].find((x) => t.tools[x]));
      t.tools[tool] = false;
      if (tid !== pid) sus(s, pid, (s.sus[tid] || 0) > 1 ? 1 : -0.3);
      return pushLog(s, { a: 'fix', pid, target: tid, tool, k });
    }
    switch (k) {
      case 'pick': t.pick++; return pushLog(s, { a: 'pick', pid, k });
      case 'handsoff': t.pick--; return pushLog(s, { a: 'handsoff', pid, target: tid, k });
      case 'shack': t.shack = true; return pushLog(s, { a: 'shack', pid, target: tid, k });
      case 'free': t.shack = false; return pushLog(s, { a: 'free', pid, target: tid, k });
      case 'interro':
        (s.intel[pid] = s.intel[pid] || {})[tid] = s.roles[tid];
        return pushLog(s, { a: 'interro', pid, target: tid, k });
      case 'badge': {
        const i = Math.floor(Math.random() * s.rolePool.length);
        const fresh = s.rolePool.splice(i, 1)[0];
        s.rolePool.push(s.roles[tid]);
        s.roles[tid] = fresh;
        for (const v of Object.values(s.intel)) delete v[tid];
        return pushLog(s, { a: 'badge', pid, target: tid, k });
      }
      case 'hswap': {
        takeCard(s, pid, Number(m.id));
        const mine = s.hands[pid];
        s.hands[pid] = s.hands[tid];
        s.hands[tid] = mine;
        return pushLog(s, { a: 'hswap', pid, target: tid, k });
      }
      case 'bats': {
        const h = s.hands[tid];
        h.splice(Math.floor(Math.random() * h.length), 1);
        s.discards++;
        return pushLog(s, { a: 'bats', pid, target: tid, k });
      }
      default: return 'unknown';
    }
  }
  if (c.target === 'goal') {
    const gi = Number(m.goal);
    if (!s.goals[gi] || s.goals[gi].open) return 'bad-target';
    s.peeks[pid] = s.peeks[pid] || {};
    s.peeks[pid][gi] = s.goals[gi].kind === 'gold';
    return pushLog(s, { a: 'survey', pid, goal: gi, k });
  }
  if (c.target === 'cell') {
    const x = Number(m.x), y = Number(m.y);
    const ok = cellTargets(s, k).some(([a, b]) => a === x && b === y);
    if (!ok) return 'bad-target';
    if (k === 'cave') {
      const was = s.board[key(x, y)];
      delete s.board[key(x, y)];
      sus(s, pid, was && !was.dead ? 1.5 : -1);
      return pushLog(s, { a: 'cave', pid, x, y, k, was: was?.k, r: was?.r });
    }
    if (k === 'dyn') {
      const gone = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const kk = key(x + dx, y + dy);
        if (s.board[kk] && s.board[kk].k !== 'start') { gone.push([x + dx, y + dy]); delete s.board[kk]; }
      }
      sus(s, pid, 1);
      return pushLog(s, { a: 'dyn', pid, x, y, k, gone });
    }
    if (k === 'flood') { s.flood[key(x, y)] = 1; sus(s, pid, 0.5); return pushLog(s, { a: 'flood', pid, x, y, k }); }
    if (k === 'pump') { delete s.flood[key(x, y)]; return pushLog(s, { a: 'pump', pid, x, y, k }); }
  }
  return 'unknown';
}

export function claim(s, pid, m = {}) {
  if (s.phase !== 'play' || !s.await) return 'not-now';
  if (s.await.pid !== pid) return 'not-your-claim';
  const says = m.says === 'gold' || m.says === 'rock' ? m.says : null;
  const text = String(m.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160);
  const voice = !!m.voice;
  if (!m.auto && !says) return 'pick-verdict';
  if (!m.auto && text.length < 2 && !voice) return 'say-something';
  const c = { pid, goal: s.await.goal, says, text, voice, auto: !!m.auto };
  s.claims.push(c);
  if (m.auto) sus(s, pid, 1.5);
  pushLog(s, { a: 'claim', pid, goal: c.goal, says, text, voice, auto: c.auto });
  s.await = null;
  nextTurn(s);
  return null;
}

const CLAIM_LINES = {
  gold: ['Vein {n} is GOLD. Dig there!', 'Trust me, {n} is the gold.', 'I saw gold in vein {n}!', 'Go for vein {n}, it shines.'],
  rock: ['Vein {n} is just rock.', 'Skip vein {n}, nothing there.', 'Rock in {n}. Waste of time.', 'Vein {n}? Rubble.'],
};

export function botClaim(s) {
  const a = s.await;
  if (!a) return false;
  const role = ROLES[s.roles[a.pid]];
  const truth = s.goals[a.goal].kind === 'gold' ? 'gold' : 'rock';
  const lie = role?.side === 'trt' ? Math.random() < 0.6 : role?.side === 'neutral' ? Math.random() < 0.3 : false;
  const says = lie ? (truth === 'gold' ? 'rock' : 'gold') : truth;
  const lines = CLAIM_LINES[says];
  return !claim(s, a.pid, { says, text: lines[Math.floor(Math.random() * lines.length)].replace('{n}', a.goal + 1) });
}

function judgeClaims(s, gi) {
  const truth = s.goals[gi].kind === 'gold' ? 'gold' : 'rock';
  for (const c of s.claims) {
    if (c.goal !== gi || !c.says || c.lie !== undefined) continue;
    c.lie = c.says !== truth;
    sus(s, c.pid, c.lie ? 3 : -1);
  }
}

function revealGoals(s, pid) {
  let changed = true;
  let gold = null;
  while (changed) {
    changed = false;
    const rs = reach(s);
    for (let gi = 0; gi < s.goals.length; gi++) {
      const g = s.goals[gi];
      if (g.open) continue;
      for (const [b, dx, dy] of DIRS) {
        const nx = g.x + dx, ny = g.y + dy;
        const nb = cellInfo(s, nx, ny);
        if (!nb || nb.hidden) continue;
        const o = rot(b);
        const ni = nb.groups.findIndex((m) => m & o);
        if (ni < 0 || !rs.has(key(nx, ny) + '#' + ni)) continue;
        g.open = true;
        judgeClaims(s, gi);
        if (g.kind !== 'gold' && !(g.mask & b)) g.mask = rot(g.mask);
        pushLog(s, { a: 'reveal', pid, goal: gi, gold: g.kind === 'gold' });
        if (g.kind === 'gold' && !gold) gold = gi;
        changed = true;
        break;
      }
    }
  }
  if (gold !== null) { endRound(s, 'gold', pid, gold); return true; }
  return false;
}

export function crystals(s) {
  return Object.values(s.board).filter((b) => b.crystal).length;
}

function goldDraws(n) {
  const out = [];
  for (let i = 0; i < n; i++) { const r = Math.random(); out.push(r < 0.57 ? 1 : r < 0.86 ? 2 : 3); }
  return out.sort((a, b) => b - a);
}

export function endRound(s, why, finder = null, goldIdx = null) {
  if (s.phase !== 'play') return;
  const ids = s.order.slice();
  const role = (id) => s.roles[id];
  const pay = {};
  const add = (id, v, note) => { if (v > 0) { const p = P(s, id); if (!p) return; pay[id] = pay[id] || { gold: 0, notes: [] }; pay[id].gold += v; pay[id].notes.push(note); } };
  let side = 'trt';
  let crewsOk = null;
  if (why === 'gold') {
    side = 'dig';
    if (has(s, 'crews')) {
      const g = s.goals[goldIdx];
      const at = (rs) => [...rs].some((x) => x.startsWith(key(g.x, g.y) + '#'));
      crewsOk = { a: at(reach(s, 'c')), c: at(reach(s, 'a')) };
      if (!crewsOk.a && !crewsOk.c) side = 'trt';
    }
  }
  const free = (id) => { const p = P(s, id); return p && !p.shack; };
  if (side === 'dig') {
    const win = ids.filter((id) => {
      const r = ROLES[role(id)];
      if (!r || r.side !== 'dig') return false;
      if (r.crew && crewsOk) return crewsOk[r.crew];
      return true;
    });
    const start = Math.max(0, ids.indexOf(finder));
    const rota = [...ids.slice(start), ...ids.slice(0, start)].filter((id) => win.includes(id) && free(id));
    if (rota.length) {
      const draws = goldDraws(Math.max(rota.length, Math.min(ids.length, rota.length * 2)));
      draws.forEach((v, i) => {
        const id = rota[i % rota.length];
        add(id, role(id) === 'foreman' ? Math.ceil(v / 2) : v, 'gold');
      });
    }
  } else if (why !== 'abandon') {
    const tr = ids.filter((id) => role(id) === 'traitor');
    const each = tr.length <= 1 ? 4 : tr.length <= 3 ? 3 : 2;
    for (const id of tr) if (free(id)) add(id, each, 'sabotage');
  }
  if (why !== 'abandon') {
    for (const id of ids) {
      if (!free(id)) continue;
      if (role(id) === 'fence') add(id, side === 'dig' ? 1 : 2, 'fence');
      if (role(id) === 'geologist') add(id, Math.min(4, Math.floor(crystals(s) / 2)), 'crystals');
    }
    const thefts = [];
    for (const id of ids) {
      const p = P(s, id);
      for (let i = 0; p && i < p.pick; i++) {
        const victim = Object.entries(pay).filter(([v, x]) => v !== id && x.gold > 0).sort((a, b) => b[1].gold - a[1].gold)[0];
        if (!victim) break;
        victim[1].gold--;
        add(id, 1, 'stolen');
        thefts.push({ by: id, from: victim[0] });
      }
    }
    s.thefts = thefts;
  }
  for (const [id, x] of Object.entries(pay)) { const p = P(s, id); if (p) { p.gold += x.gold; p.got = x.gold; } }
  const fi = ids.indexOf(finder);
  s.nextFirst = fi >= 0 ? ids[(fi + 1) % ids.length] : ids[(ids.indexOf(s.turn) + 1) % ids.length] || null;
  s.result = {
    why, side, finder, crewsOk, goal: goldIdx,
    pay: Object.fromEntries(Object.entries(pay).map(([k, v]) => [k, v.gold])),
    roles: { ...s.roles }, thefts: s.thefts || [],
  };
  s.hist.push({ round: s.round, side, why });
  s.goals.forEach((g, i) => { if (!g.open) { g.open = true; judgeClaims(s, i); } });
  s.await = null;
  s.phase = s.round >= s.settings.rounds ? 'over' : 'end';
  s.turn = null;
  s.deadline = s.phase === 'end' ? Date.now() + 20000 : 0;
  if (s.phase === 'over') {
    s.podium = s.players.filter((p) => !p.spectator).slice().sort((a, b) => b.gold - a.gold).map((p) => ({ id: p.id, gold: p.gold }));
  }
  pushLog(s, { a: 'end', why, side });
}

export function backToLobby(s) {
  s.phase = 'lobby';
  s.turn = null;
  s.result = null;
  s.board = {};
  s.goals = [];
  s.order = [];
  s.hands = {};
  s.roles = {};
  for (const p of s.players) { p.gold = 0; p.wait = false; p.tools = {}; p.shack = false; p.pick = 0; }
}

export function tick(s, now = Date.now()) {
  if (s.phase === 'end' && s.deadline && now >= s.deadline) { startRound(s); return true; }
  if (s.phase === 'play' && s.await) {
    const p = P(s, s.await.pid);
    if (p && !p.bot && s.deadline && now >= s.deadline) return !claim(s, s.await.pid, { auto: true });
    return false;
  }
  if (s.phase !== 'play' || !s.deadline || now < s.deadline) return false;
  const p = P(s, s.turn);
  if (!p || p.bot) return false;
  return autoMove(s, p.id);
}

export function autoMove(s, pid) {
  if (s.await) return !claim(s, s.await.pid, { auto: true });
  const h = s.hands[pid] || [];
  if (!h.length) { nextTurn(s); return true; }
  const worst = h.slice().sort((a, b) => keepScore(s.cards[a]) - keepScore(s.cards[b]))[0];
  return !play(s, pid, { id: worst, discard: true });
}

const keepScore = (k) => {
  const c = CARDS[k];
  if (c.type === 'path') return c.dead ? 0 : 2 + c.groups[0].toString(2).split('1').length;
  return c.fix ? 5 : 3;
};


function targetsFor(s, pid) {
  const known = s.peeks[pid] || {};
  const gold = s.goals.map((g, i) => [g, i]).filter(([g, i]) => !g.open && known[i] === true);
  if (gold.length) return gold.map(([g]) => g);
  const score = s.goals.map(() => 0);
  for (const c of s.claims || []) {
    if (c.pid === pid || !c.says || (s.sus[c.pid] || 0) >= 1.5 || (s.intel[pid] || {})[c.pid] === 'traitor') continue;
    score[c.goal] += c.says === 'gold' ? 1 : -1;
  }
  const open = s.goals.filter((g, i) => !g.open && known[i] !== false);
  const hot = open.filter((g) => score[s.goals.indexOf(g)] > 0);
  if (hot.length) return hot;
  const cool = open.filter((g) => score[s.goals.indexOf(g)] >= 0);
  if (cool.length) return cool;
  return open.length ? open : s.goals.filter((g) => !g.open);
}

function distTo(x, y, goals) {
  let best = 99;
  for (const g of goals) best = Math.min(best, Math.abs(g.x - x) + Math.abs(g.y - y));
  return best;
}

function frontierDist(s, goals = s.goals.filter((g) => !g.open)) {
  const rs = reach(s);
  let best = 99;
  for (const id of rs) {
    const [cell, gi] = id.split('#');
    const [x, y] = cell.split(',').map(Number);
    const c = cellInfo(s, x, y);
    const g = c.groups[Number(gi)];
    if (CARDS[c.k]?.dead) continue;
    for (const [b, dx, dy] of DIRS) {
      if (!(g & b)) continue;
      const nx = x + dx, ny = y + dy;
      const nb = cellInfo(s, nx, ny);
      if (nb && !nb.hidden) continue;
      best = Math.min(best, distTo(nx, ny, goals));
    }
  }
  return best;
}

function bestPlacement(s, pid, ids, goals, wantDead) {
  const base = frontierDist(s, goals);
  let best = null;
  for (const id of ids) {
    const k = s.cards[id];
    const c = CARDS[k];
    if (c.type !== 'path') continue;
    if (!!c.dead !== wantDead) continue;
    for (const r of [0, 1]) {
      for (const [x, y] of legalCells(s, k, r)) {
        const kk = key(x, y);
        s.board[kk] = { k, r, ...placed(k, r), door: c.door, crystal: c.crystal };
        const d = wantDead ? distTo(x, y, goals) : frontierDist(s, goals);
        delete s.board[kk];
        const score = wantDead ? d : d - (c.mask === 15 ? 0.2 : 0) + (Math.abs(y) > 5 ? 0.1 : 0);
        if (!best || score < best.score) best = { id, x, y, r, score, gain: base - d };
      }
    }
  }
  return best;
}

export function botMove(s, pid) {
  const me = P(s, pid);
  const role = s.roles[pid];
  const side = ROLES[role]?.side;
  const ids = (s.hands[pid] || []).slice();
  if (!ids.length) { nextTurn(s); return true; }
  const byKind = (pred) => ids.filter((id) => pred(s.cards[id], CARDS[s.cards[id]]));
  const trust = (id) => -(s.sus[id] || 0);
  const knowsTraitor = (id) => (s.intel[pid] || {})[id] === 'traitor';
  const traitor = side === 'trt';
  const tryPlay = (m) => !play(s, pid, m);

  const broken = Object.entries(me.tools).filter(([, v]) => v).map(([t]) => t);
  if (broken.length) {
    for (const id of byKind((k, c) => c.fix)) {
      const tool = [...CARDS[s.cards[id]].fix].find((t) => me.tools[t]);
      if (tool && tryPlay({ id, target: pid, tool })) return true;
    }
  }
  if (me.shack) for (const id of byKind((k) => k === 'free')) if (tryPlay({ id, target: pid })) return true;

  const goals = targetsFor(s, pid);
  if (!traitor) {
    const unknown = s.goals.filter((g, i) => !g.open && (s.peeks[pid] || {})[i] === undefined).length;
    const knowGold = Object.values(s.peeks[pid] || {}).includes(true);
    if (!knowGold && unknown > 1 && frontierDist(s) < 6) {
      for (const id of byKind((k) => k === 'survey')) {
        const near = s.goals.map((g, i) => [i, g]).filter(([i, g]) => !g.open && (s.peeks[pid] || {})[i] === undefined)
          .sort((a, b) => distTo(a[1].x, a[1].y, [{ x: 0, y: 0 }]) - distTo(b[1].x, b[1].y, [{ x: 0, y: 0 }]));
        const gi = near[Math.floor(Math.random() * near.length)][0];
        if (tryPlay({ id, goal: gi })) return true;
      }
    }
    if (canDig(me)) {
      const b = bestPlacement(s, pid, ids, goals, false);
      if (b && b.gain > 0) return tryPlay({ id: b.id, x: b.x, y: b.y, r: b.r });
    }
    for (const id of byKind((k, c) => c.fix)) {
      const tg = targets(s, pid, s.cards[id]).filter((t) => t !== pid && !knowsTraitor(t) && trust(t) > -1.5);
      if (tg.length) { const t = tg.sort((a, b) => trust(b) - trust(a))[0]; if (tryPlay({ id, target: t })) return true; }
    }
    for (const id of byKind((k, c) => c.brk || k === 'shack' || k === 'bats')) {
      const tg = targets(s, pid, s.cards[id]).filter((t) => knowsTraitor(t) || (s.sus[t] || 0) >= 2.5);
      if (tg.length) { const t = tg.sort((a, b) => trust(a) - trust(b))[0]; if (tryPlay({ id, target: t })) return true; }
    }
    for (const id of byKind((k) => k === 'cave')) {
      const deadOnes = cellTargets(s, 'cave').filter(([x, y]) => s.board[key(x, y)]?.k && CARDS[s.board[key(x, y)].k]?.dead && distTo(x, y, goals) < 6);
      if (deadOnes.length) { const [x, y] = deadOnes[0]; if (tryPlay({ id, x, y })) return true; }
    }
    for (const id of byKind((k) => k === 'pump')) { const c = cellTargets(s, 'pump')[0]; if (c && tryPlay({ id, x: c[0], y: c[1] })) return true; }
    for (const id of byKind((k) => k === 'pick')) if (tryPlay({ id })) return true;
    for (const id of byKind((k) => k === 'interro')) { const t = targets(s, pid, 'interro').sort((a, b) => (s.sus[b] || 0) - (s.sus[a] || 0))[0]; if (t && tryPlay({ id, target: t })) return true; }
    if (canDig(me)) {
      const b = bestPlacement(s, pid, ids, goals, false);
      if (b && b.gain >= 0 && Math.random() < 0.5) return tryPlay({ id: b.id, x: b.x, y: b.y, r: b.r });
    }
  } else {
    const fd = frontierDist(s, goals);
    if (Math.random() < 0.25 && canDig(me)) {
      const b = bestPlacement(s, pid, ids, goals, false);
      if (b && b.gain >= 0) return tryPlay({ id: b.id, x: b.x, y: b.y, r: b.r });
    }
    if (fd <= 4) {
      for (const id of byKind((k) => k === 'cave' || k === 'dyn')) {
        const k = s.cards[id];
        const cells = cellTargets(s, k).filter(([x, y]) => { const b = s.board[key(x, y)]; return k === 'dyn' || (b && !CARDS[b.k]?.dead); })
          .sort((a, b) => distTo(a[0], a[1], goals) - distTo(b[0], b[1], goals));
        if (cells.length) { const [x, y] = cells[0]; if (tryPlay({ id, x, y })) return true; }
      }
      if (canDig(me)) {
        const b = bestPlacement(s, pid, ids, goals, true);
        if (b && b.score <= fd + 2) return tryPlay({ id: b.id, x: b.x, y: b.y, r: b.r });
      }
    }
    for (const id of byKind((k, c) => c.brk || k === 'shack' || k === 'bats')) {
      const tg = targets(s, pid, s.cards[id]).filter((t) => !knowsTraitor(t));
      if (tg.length) { const t = tg.sort((a, b) => trust(b) - trust(a))[0]; if (tryPlay({ id, target: t })) return true; }
    }
    for (const id of byKind((k) => k === 'flood')) {
      const c = cellTargets(s, 'flood').sort((a, b) => distTo(a[0], a[1], goals) - distTo(b[0], b[1], goals))[0];
      if (c && tryPlay({ id, x: c[0], y: c[1] })) return true;
    }
    for (const id of byKind((k) => k === 'pick')) if (tryPlay({ id })) return true;
    if (canDig(me)) {
      const b = bestPlacement(s, pid, ids, goals, true);
      if (b) return tryPlay({ id: b.id, x: b.x, y: b.y, r: b.r });
    }
  }
  const junk = ids.slice().sort((a, b) => keepScore(s.cards[a]) - keepScore(s.cards[b]))[0];
  return tryPlay({ id: junk, discard: true });
}

export function botStep(s, now = Date.now()) {
  if (s.phase !== 'play') return false;
  if (s.await) {
    const a = P(s, s.await.pid);
    if (!a || !a.bot || now < s.botAt) return false;
    return botClaim(s);
  }
  const p = P(s, s.turn);
  if (!p || !p.bot || now < s.botAt) return false;
  botMove(s, p.id);
  return true;
}

export function publicState(s) {
  const showRoles = s.phase === 'over' || (s.phase === 'end' && s.settings.revealRoles);
  return {
    phase: s.phase, hostId: s.hostId, round: s.round, roundId: s.roundId, turn: s.turn, turnNo: s.turnNo,
    settings: s.settings,
    players: s.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, color: p.color, on: p.on, bot: p.bot, spectator: p.spectator, wait: p.wait,
      gold: p.gold, got: p.got || 0, tools: p.tools, shack: p.shack, pick: p.pick, cards: (s.hands[p.id] || []).length,
    })),
    order: s.order,
    board: Object.entries(s.board).map(([kk, b]) => [kk, b.k, b.r || 0]),
    goals: s.goals.map((g) => (g.open ? { x: g.x, y: g.y, open: true, kind: g.kind, mask: g.mask } : { x: g.x, y: g.y })),
    flood: Object.keys(s.flood),
    bounds: s.bounds,
    deck: s.deck.length,
    discards: s.discards,
    log: s.log,
    await: s.await ? { pid: s.await.pid, goal: s.await.goal } : null,
    claims: (s.claims || []).map((c) => ({ pid: c.pid, goal: c.goal, says: c.says, text: c.text, voice: c.voice, auto: c.auto, lie: s.goals[c.goal]?.open ? c.lie : undefined })),
    result: s.result ? { ...s.result, roles: showRoles ? s.result.roles : undefined } : null,
    podium: s.podium,
    hist: s.hist,
    left: s.deadline ? Math.max(0, s.deadline - Date.now()) : 0,
    dur: s.phase === 'play' ? (s.await ? CLAIM_SECS * 1000 : turnSecs(s, P(s, s.turn)) * 1000) : s.phase === 'end' ? 20000 : 0,
    rolesInPlay: s.phase === 'lobby' ? null : rolesSummary(s),
  };
}

function rolesSummary(s) {
  const out = {};
  for (const id of s.order) out[s.roles[id]] = (out[s.roles[id]] || 0) + 1;
  for (const r of s.rolePool) out[r] = out[r] || 0;
  const n = s.order.length;
  const t = s.settings.traitors ? Math.min(n - 1, s.settings.traitors) : traitorCount(n);
  return { kinds: Object.keys(out), traitors: s.settings.traitors ? `${t}` : `${Math.max(0, t - 1)}–${t}` };
}

export function privateState(s, pid) {
  return {
    rid: s.roundId,
    role: s.phase === 'lobby' ? null : s.roles[pid] || null,
    hand: (s.hands[pid] || []).map((id) => ({ id, k: s.cards[id] })),
    peeks: s.peeks[pid] || {},
    intel: s.intel[pid] || {},
  };
}

export function boardFromPub(pub) {
  const s = { board: {}, goals: pub.goals.map((g) => ({ ...g, open: !!g.open, mask: g.mask })), flood: {}, bounds: pub.bounds, cards: [], hands: {} };
  for (const [kk, k, r] of pub.board) {
    if (k === 'start') s.board[kk] = { k, mask: 15, groups: [15], r: 0 };
    else { const c = CARDS[k]; s.board[kk] = { k, r, ...placed(k, r), door: c.door, crystal: c.crystal }; }
  }
  for (const f of pub.flood) s.flood[f] = 1;
  return s;
}
