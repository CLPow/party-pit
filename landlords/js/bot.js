import { SPACES, GROUP_SPACES, BOARD_SIZE } from './board.js';
import { P, cur, buildError, buildCost, unmortgageError, tradeError, terminalError, zoneError, bestTeleport, netWorth, calcRent } from './rules.js';
import { packOn, SKIM_AMT, SWIPE_AMT } from './packs.js';

export const BOT_NAMES = [
  'Baron Bot', 'Lady Ledger', 'Tycoon-9', 'Rentmaster', 'Count Coin', 'Duke Deed', 'Mogul Max', 'Penny Pixel',
  'Sir Lease', 'Auntie Asset', 'Captain Cash', 'Dr. Dividend', 'Madame Mortgage', 'Hotel Hal', 'Broker Bea',
  'Rookie Rae', 'Landlord Lu', 'Mister Mint', 'Quinn Quota', 'Ziggy Zoning', 'Professor Profit', 'Gigi Gold',
  'Tiny Tenant', 'Ace Acre', 'Vera Venture', 'Otto Owner', 'Kiki Kapital', 'Nina Net', 'Bruno Bond', 'Sunny Shares', 'Wally Wealth',
];

const lastBid = {};
const lastOffer = {};
const seenCash = {};
let seenTurn = -1;
const accusedTurn = {};
const hash = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function wantsTrade(t) {
  const v = (side) => side.cash + side.props.reduce((a, i) => a + SPACES[i].price, 0);
  return v(t.give) >= v(t.get) * 1.15 + 20;
}

function setOffer(s, b) {
  if (lastOffer[b.id] && s.turnId - lastOffer[b.id] < 3) return null;
  if (s.trades.some((t) => t.from === b.id)) return null;
  let best = null;
  GROUP_SPACES.forEach((spaces) => {
    const counts = {};
    spaces.forEach((i) => { const o = s.props[i].o; if (o) counts[o] = (counts[o] || 0) + 1; });
    const mine = counts[b.id] || 0;
    if (!mine || mine === spaces.length) return;
    spaces.forEach((i) => {
      const o = s.props[i].o;
      if (!o || o === b.id || counts[o] > mine) return;
      const owner = P(s, o);
      if (!owner || owner.bankrupt) return;
      const completes = mine + 1 === spaces.length;
      if (!owner.bot && !completes && mine < 2) return;
      const score = mine / spaces.length + (completes ? 1 : 0) + (owner.bot ? 0.2 : 0);
      if (!best || score > best.score) best = { i, owner, score };
    });
  });
  if (!best) return null;
  const { i, owner } = best;
  const cash = Math.min(b.cash - 150, Math.round((SPACES[i].price * 2.2) / 10) * 10);
  if (cash < SPACES[i].price * 1.6) return null;
  const t = { from: b.id, to: owner.id, give: { cash, props: [] }, get: { cash: 0, props: [i] } };
  if (tradeError(s, t)) return null;
  lastOffer[b.id] = s.turnId;
  return { pid: b.id, a: { t: 'propose', to: owner.id, give: t.give, get: t.get } };
}

export function botStep(s, now, animating) {
  if (s.phase !== 'playing') return null;

  for (const t of s.trades) {
    const b = P(s, t.to);
    if (b && b.bot) return { pid: b.id, a: { t: 'tradeReply', id: t.id, accept: wantsTrade(t) } };
  }

  if (s.stage === 'auction' && s.auction) {
    const a = s.auction;
    const sp = SPACES[a.sp];
    const bots = s.players.filter((p) => p.bot && !p.bankrupt && p.id !== a.bidder && now - (lastBid[p.id] || 0) > 1200);
    if (!bots.length || Math.random() < 0.35) return null;
    const b = bots[Math.floor(Math.random() * bots.length)];
    lastBid[b.id] = now;
    const value = Math.floor(sp.price * (0.55 + (hash(b.id + ':' + a.sp) % 70) / 100));
    const next = a.bid + [10, 10, 20, 50][Math.floor(Math.random() * 4)];
    if (next <= value && next <= b.cash - 60) return { pid: b.id, a: { t: 'bid', amt: next } };
    return null;
  }

  const c = cur(s);

  if (packOn(s, 'cheats')) {
    if (seenTurn !== s.turnId) {
      seenTurn = s.turnId;
      seenCash[c.id] = c.cash;
    }
    const jump = c.cash - (seenCash[c.id] ?? c.cash);
    if ((jump === SKIM_AMT || jump === SWIPE_AMT) && accusedTurn.any !== s.turnId) {
      accusedTurn.any = s.turnId;
      const accusers = s.players.filter((p) => p.bot && !p.bankrupt && p.id !== c.id);
      if (accusers.length && Math.random() < 0.35) {
        const b = accusers[Math.floor(Math.random() * accusers.length)];
        accusedTurn[b.id] = s.turnId;
        seenCash[c.id] = c.cash;
        return { pid: b.id, a: { t: 'accuse', target: c.id } };
      }
    }
  }

  if (!c.bot || animating) return null;

  if (s.stage === 'bus') {
    const score = (n) => {
      const i = (c.pos + n) % BOARD_SIZE;
      const pr = s.props[i];
      if (pr && !pr.o) return 1000 - SPACES[i].price / 10;
      if (pr && pr.o && pr.o !== c.id) return -calcRent(s, i, n);
      return 0;
    };
    const n = [...s.choices].sort((a, b) => score(b) - score(a))[0];
    return { pid: c.id, a: { t: 'busPick', n } };
  }
  if (s.stage === 'teleport') return { pid: c.id, a: { t: 'teleport', sp: bestTeleport(s, c) } };

  if ((s.stage === 'roll' || s.stage === 'end') && packOn(s, 'cheats') && !s.cheated && Math.random() < 0.15) {
    return { pid: c.id, a: { t: 'cheat', kind: 'skim' } };
  }
  if ((s.stage === 'roll' || s.stage === 'end') && packOn(s, 'sky') && c.cash > 500) {
    const ap = s.props.findIndex((pr, i) => pr && pr.o === c.id && !terminalError(s, c.id, i, true));
    if (ap >= 0) return { pid: c.id, a: { t: 'terminal', sp: ap, on: true } };
  }
  if ((s.stage === 'roll' || s.stage === 'end') && packOn(s, 'zoning') && !s.zoned && Math.random() < 0.2) {
    const mineBest = s.props.map((pr, i) => i).filter((i) => !zoneError(s, c.id, i, 'park')).sort((a, b) => SPACES[b].price - SPACES[a].price)[0];
    const leader = s.players.filter((p) => !p.bankrupt && p.id !== c.id).sort((a, b) => netWorth(s, b) - netWorth(s, a))[0];
    const target = leader ? s.props.map((pr, i) => i).filter((i) => s.props[i] && s.props[i].o === leader.id && !zoneError(s, c.id, i, 'factory')).sort((a, b) => calcRent(s, b) - calcRent(s, a))[0] : undefined;
    if (target !== undefined && c.cash > 700) return { pid: c.id, a: { t: 'zone', sp: target, kind: 'factory' } };
    if (mineBest !== undefined && c.cash > 500) return { pid: c.id, a: { t: 'zone', sp: mineBest, kind: 'park' } };
    const dirty = s.props.findIndex((pr, i) => pr && !zoneError(s, c.id, i, 'clear'));
    if (dirty >= 0 && c.cash > 400) return { pid: c.id, a: { t: 'zone', sp: dirty, kind: 'clear' } };
  }

  if (s.stage === 'roll' || s.stage === 'end') {
    if (c.cash > 250) {
      const spots = s.props.map((pr, i) => i).filter((i) => s.props[i] && s.props[i].o === c.id && SPACES[i].type === 'city');
      for (const i of spots) {
        if (!buildError(s, c.id, i) && c.cash - buildCost(i, s.props[i].h + 1) > (s.props[i].h >= 5 ? 400 : 150) && Math.random() < 0.85) {
          return { pid: c.id, a: { t: 'build', sp: i } };
        }
      }
    }
    if (c.cash > 900) {
      const m = s.props.findIndex((pr, i) => pr && pr.o === c.id && pr.m && !unmortgageError(s, c.id, i));
      if (m >= 0) return { pid: c.id, a: { t: 'unmortgage', sp: m } };
    }
  }

  if (s.stage === 'end') {
    const offer = setOffer(s, c);
    if (offer) return offer;
  }

  if (s.stage === 'roll') {
    if (c.inJail && c.jailCards) return { pid: c.id, a: { t: 'useCard' } };
    if (c.inJail && c.cash > 500 && Math.random() < 0.5) return { pid: c.id, a: { t: 'payJail' } };
    return { pid: c.id, a: { t: 'roll' } };
  }
  if (s.stage === 'buy') {
    const sp = SPACES[s.pending];
    const reserve = s.settings.mode === 'property' ? 0 : 120;
    return { pid: c.id, a: { t: c.cash - sp.price >= reserve ? 'buy' : 'decline' } };
  }
  if (s.stage === 'end') return { pid: c.id, a: { t: 'end' } };
  return null;
}
