import { readFileSync } from 'node:fs';
import { newGame, addPlayer, startGame, tick, botStep, setConnected, removePlayer, setRando, swapHand } from '../js/rules.js';
import { buildLibrary, catalogue, presetPacks } from '../js/cards.js';

const path = process.argv[2];
const dataset = path ? JSON.parse(readFileSync(path, 'utf8')) : null;
const cat = catalogue(dataset);

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function play(n, preset, opts = {}) {
  const s = newGame('p0');
  s.settings.packs = presetPacks(cat, preset);
  Object.assign(s.settings, opts);
  for (let i = 0; i < n; i++) addPlayer(s, { id: 'p' + i, name: 'Bot ' + i, bot: true });
  if (opts.rando) setRando(s, true);
  const lib = buildLibrary(dataset, s.settings.packs);
  let now = 0;
  startGame(s, lib, rnd, now);
  let steps = 0;
  const picks = new Set();
  while (s.phase !== 'over' && steps < 20000) {
    steps++;
    now += 1000;
    if (s.black) picks.add(s.black.pick);
    if (!botStep(s, rnd, now)) tick(s, rnd, now);
    if (steps % 97 === 0) setConnected(s, 'p' + (1 + (steps % (n - 1))), false, rnd, now);
    if (steps % 101 === 0) setConnected(s, 'p' + (1 + ((steps - 4) % (n - 1))), true, rnd, now);
    if (steps === 500 && n > 4) removePlayer(s, 'p' + (n - 1), rnd, now);
    if (steps % 53 === 0) swapHand(s, 'p2', rnd);
    for (const [pid, h] of Object.entries(s.hands)) if (new Set(h).size !== h.length) throw new Error('duplicate card in hand of ' + pid);
    if (s.phase === 'wait') throw new Error('stuck waiting with ' + s.players.filter((p) => p.on).length + ' online');
  }
  if (s.phase !== 'over') throw new Error(`game did not finish (${n} players, ${preset}) phase=${s.phase}`);
  const top = [...s.players].sort((a, b) => b.score - a.score)[0];
  console.log(`${String(n).padStart(2)} players, ${preset.padEnd(8)} rounds=${String(s.round).padStart(3)} winner=${top.name} (${top.score}) picks=${[...picks].sort()} lib=${lib.white.length}w/${lib.black.length}b`);
}

const presets = dataset ? ['starter', 'base', 'official', 'all'] : ['starter'];
for (const preset of presets) for (const n of [3, 8, 25, 50]) play(n, preset, { goal: n > 20 ? 4 : 6, blanks: 5, rando: n === 3 });
play(50, 'starter', { goal: 30, hand: 12 });
console.log('ok');
