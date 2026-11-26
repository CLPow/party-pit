import * as R from '../js/rules.js';

const games = Number(process.argv[2] || 30);
const mode = process.argv[3] || 'mixed';
const ALL = R.PACKS.map((p) => p.id);
const sizes = [3, 4, 5, 6, 7, 8, 10, 12, 15, 16, 20, 24, 28, 32];
let rounds = 0, gold = 0, turnsTotal = 0, maxTurns = 0, claims = 0;
const t0 = Date.now();

function check(s) {
  const rs = R.reach(s);
  for (const [kk, b] of Object.entries(s.board)) {
    if (b.k === 'start') continue;
    const [x, y] = kk.split(',').map(Number);
    for (const [bit, dx, dy] of R.DIRS) {
      const nb = R.cellInfo(s, x + dx, y + dy);
      if (!nb || nb.hidden || nb.k === 'goal') continue;
      if (!!(b.mask & bit) !== !!(nb.mask & R.rot(bit))) throw new Error(`edge mismatch at ${kk} dir ${bit}`);
    }
  }
  const pub = JSON.stringify({ ...R.publicState(s), rolesInPlay: null });
  if (s.phase === 'play' && /"(traitor|digger|amber|cobalt|foreman|fence|geologist)"/.test(pub)) throw new Error('role leaked');
  if (/"hands"|"peeks"|"intel"|"deck":\[/.test(pub)) throw new Error('private data leaked');
  if (s.phase === 'play' && R.publicState(s).result) throw new Error('result during play');
  return rs;
}

for (let g = 0; g < games; g++) {
  const n = sizes[g % sizes.length];
  const s = R.newGame('p0');
  s.fast = true;
  for (let i = 0; i < n; i++) R.addPlayer(s, { id: 'p' + i, name: 'P' + i, avatar: '🤖', color: '#888', bot: true });
  s.settings.packs = mode === 'all' ? ALL : mode === 'none' ? [] : ALL.filter(() => Math.random() < 0.5);
  s.settings.rounds = 3;
  R.startGame(s);
  let guard = 0;
  let turns = 0;
  while (s.phase !== 'over') {
    if (s.phase === 'end') {
      rounds++;
      if (s.result.side === 'dig') gold++;
      const pub = R.publicState(s);
      if (!pub.result.roles) throw new Error('roles hidden at end');
      R.startRound(s);
      continue;
    }
    if (s.await) { claims++; if (!R.botClaim(s)) throw new Error('claim failed'); continue; }
    const before = s.turnNo;
    const who = s.turn;
    const hand = s.hands[who].length;
    R.botMove(s, who);
    if (s.await) continue;
    turns++;
    if (s.phase === 'play' && s.turnNo === before) throw new Error(`stall: ${who} hand ${hand}`);
    if (guard++ % 7 === 0) check(s);
    if (guard > 20000) throw new Error('runaway game');
  }
  rounds++;
  if (s.result.side === 'dig') gold++;
  turnsTotal += turns;
  maxTurns = Math.max(maxTurns, turns);
  const priv = R.privateState(s, 'p1');
  if (!Array.isArray(priv.hand)) throw new Error('bad private state');
  const total = s.players.reduce((a, p) => a + p.gold, 0);
  if (g < sizes.length) console.log(`n=${String(n).padStart(2)} packs=[${s.settings.packs.join(',')}] turns=${turns} gold=${total} hist=${s.hist.map((h) => h.side).join('/')}`);
}
console.log(`${games} games, ${claims} survey claims, ${rounds} rounds, diggers won ${Math.round((gold / rounds) * 100)}%, avg turns/game ${Math.round(turnsTotal / games)}, max ${maxTurns}, ${Date.now() - t0} ms`);
