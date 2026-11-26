import * as R from '../js/rules.js';

const runs = Number(process.argv[2] || 40);
const mode = process.argv[3] || 'mixed';
const sizes = (process.argv[4] || '2,3,5,8,16,30,40').split(',').map(Number);

let seed = 12345;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const origRandom = Math.random;
Math.random = rng;

function settingsFor(i) {
  const pick = (p) => (mode === 'all' ? true : mode === 'none' ? false : rng() < p);
  return {
    packs: { chaos: pick(0.5), mega: pick(0.5), party: true },
    house: { timer: pick(0.3), streak: pick(0.4), sudden: pick(0.3), double: pick(0.3), nohiss: mode === 'all' ? false : pick(0.15) },
    hand: 7, turnSecs: 20, reactSecs: 3, suddenMins: 2,
  };
}

const stats = { games: 0, steps: 0, booms: 0, cools: 0, hisses: 0, crits: 0, holds: 0, minutes: 0, kinds: {} };
let fails = 0;
for (const n of sizes) {
  for (let r = 0; r < runs; r++) {
    const s = R.newGame('h');
    for (let i = 0; i < n; i++) R.addPlayer(s, { id: 'p' + i, name: 'P' + i, avatar: 0, color: '#fff', bot: true });
    s.settings = settingsFor(r);
    let now = 1_000_000;
    const err = R.startGame(s, rng, now);
    if (err) { console.log('start error', n, err); fails++; continue; }
    const total = R.totalCards(s);
    let steps = 0;
    while (s.phase === 'play' && steps < 200000) {
      now += 250;
      R.botStep(s, now, rng);
      R.tick(s, now, rng);
      steps++;
      if (R.totalCards(s) !== total) { console.log('card leak', n, R.totalCards(s), total, s.stage); fails++; break; }
      if (s.round > 99) break;
    }
    if (s.phase !== 'over') { console.log('stalled', n, s.stage, s.turn, s.deck.length, JSON.stringify(s.settings)); fails++; continue; }
    const winners = s.players.filter((p) => !p.out);
    if (winners.length !== 1 || s.winner !== winners[0].id) { console.log('bad winner', n); fails++; }
    stats.games++;
    stats.steps += steps;
    stats.minutes += (steps * 250) / 60000;
    for (const e of s.log) stats.kinds[e.k] = (stats.kinds[e.k] || 0) + 1;
  }
  console.log(`n=${n}: ok`);
}
Math.random = origRandom;
console.log(`games ${stats.games}, fails ${fails}, avg game ${(stats.minutes / Math.max(1, stats.games)).toFixed(1)} min (bot pace)`);
console.log('last-40 event mix', stats.kinds);
process.exit(fails ? 1 : 0);
