import * as R from '../js/rules.js';

const runs = Number(process.argv[2] || 30);
const sizes = (process.argv[3] || '2,3,4,5,6,8,10,15,20').split(',').map(Number);
let seed = 4242;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
Math.random = rng;
let fails = 0;
const turnsBy = {};
const kinds = {};
const seatWins = {};
for (const n of sizes) {
  let turns = 0;
  seatWins[n] = Array(n).fill(0);
  for (let r = 0; r < runs; r++) {
    const s = R.newGame('h');
    for (let i = 0; i < n; i++) R.addPlayer(s, { id: 'b' + i, name: 'Bot ' + i, bot: true });
    s.settings.timer = r % 3 === 0;
    let t = 1e6;
    R.startGame(s, rng, t);
    const total = s.cards.length;
    let steps = 0;
    while (s.phase === 'play' && steps++ < 60000) {
      t += 500;
      if (!R.botStep(s, t, rng, true)) R.tick(s, t + 1e6);
      const count = s.deck.length + s.discard.length + Object.values(s.hands).flat().length + Object.values(s.bank).flat().length
        + Object.values(s.table).flat().length + Object.values(s.ups).flatMap((u) => Object.values(u).flatMap((x) => [x.sky, x.term].filter((v) => v != null))).length;
      if (count !== total) { console.log('card leak', n, count, total, s.stage); fails++; break; }
      for (const pid of s.order) for (const e of s.table[pid]) if (!R.cardInfo(s.cards[e.id]).gs.includes(e.g)) { console.log('bad group', e); fails++; }
    }
    if (s.phase !== 'over') { console.log('stalled', n, s.stage, steps); fails++; continue; }
    if (R.completeSets(s, s.winner).length < R.setsToWin(s.order.length)) { console.log('bad winner', n); fails++; }
    seatWins[n][s.order.indexOf(s.winner)]++;
    turns += s.turns;
    for (const e of s.log) kinds[e.k] = (kinds[e.k] || 0) + 1;
    JSON.stringify(R.publicView(s));
  }
  turnsBy[n] = Math.round(turns / runs);
}
for (const n of sizes) console.log(`n=${n}: avg ${turnsBy[n]} turns (${(turnsBy[n] / n).toFixed(1)} laps), seat wins ${seatWins[n].join(' ')}`);
console.log('event mix (last 60 per game)', kinds);
console.log(`fails ${fails}`);
process.exit(fails ? 1 : 0);
