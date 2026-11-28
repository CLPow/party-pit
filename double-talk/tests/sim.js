import * as R from '../js/rules.js';

const runs = Number(process.argv[2] || 40);
const sizes = (process.argv[3] || '3,4,6,8,12,20,30,40').split(',').map(Number);
let seed = 777;
Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
let fails = 0;
for (const n of sizes) {
  const wins = { civ: 0, odd: 0, blank: 0 };
  let rounds = 0;
  let ms = 0;
  for (let r = 0; r < runs; r++) {
    const s = R.newGame('b0');
    for (let i = 0; i < n; i++) R.addPlayer(s, { id: 'b' + i, name: 'Bot ' + i, bot: true });
    s.settings.games = 1;
    s.settings.blanks = r % 3;
    s.settings.blankGuess = r % 2 === 0;
    let now = 1e12;
    if (R.startGame(s, now)) { fails++; continue; }
    let steps = 0;
    while (s.phase !== 'over' && steps < 20000) {
      now += 500;
      R.botStep(s, now);
      R.tick(s, now);
      steps++;
    }
    if (s.phase !== 'over') { fails++; console.log('stuck', n, s.phase, s.round); continue; }
    wins[s.result.winner]++;
    rounds += s.round;
    ms += now - 1e12;
    const pv = R.publicView(s);
    if (!pv.result || !pv.players.length) fails++;
    if (R.nextGame(s, now) !== null || s.phase !== 'lobby') { fails++; console.log('nextGame failed', s.phase); }
  }
  console.log(`n=${n}: civ ${wins.civ} odd ${wins.odd} blank ${wins.blank}, avg ${(rounds / runs).toFixed(1)} rounds, ${(ms / runs / 60000).toFixed(1)} min`);
}
console.log('fails', fails);
if (fails) process.exit(1);
