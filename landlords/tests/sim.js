import { newState, addPlayer, startGame, act, tick, netWorth } from '../js/rules.js';
import { botStep } from '../js/bot.js';
import { PACKS, HOUSE_RULES } from '../js/packs.js';

const games = Number(process.argv[2] || 40);
const packArg = process.argv[3] || 'mixed';
const MODES = ['classic', 'time', 'property', 'rounds'];
const ALL = Object.fromEntries(PACKS.map((p) => [p.id, true]));
const ALL_HOUSE = Object.fromEntries(HOUSE_RULES.map((h) => [h.id, true]));
const randomPacks = () => Object.fromEntries(PACKS.map((p) => [p.id, Math.random() < 0.5]));
const randomHouse = () => Object.fromEntries(HOUSE_RULES.map((h) => [h.id, Math.random() < 0.5]));

let totalTurns = 0;
const errors = {};
const seen = {};
const bump = (k) => { seen[k] = (seen[k] || 0) + 1; };

for (let g = 0; g < games; g++) {
  const players = 2 + (g % 31);
  const mode = MODES[g % 4];
  const all = packArg === 'all' || (packArg === 'mixed' && g % 2 === 0);
  const none = packArg === 'none';
  const packs = none ? {} : all ? ALL : randomPacks();
  const house = none ? {} : all ? ALL_HOUSE : randomHouse();
  const s = newState({ mode, minutes: 20, rounds: 10, packs, house });
  for (let i = 0; i < players; i++) addPlayer(s, { name: 'Bot', emoji: '🤖', bot: true });
  let now = 0;
  startGame(s, [], now);
  let steps = 0;
  while (s.phase === 'playing' && steps < 200000) {
    now += 300;
    const ev = [];
    tick(s, now, ev);
    const step = botStep(s, now, false);
    if (step) {
      try {
        act(s, step.pid, step.a, ev, now);
      } catch (e) {
        const k = `${step.a.t}: ${e.message}`;
        errors[k] = (errors[k] || 0) + 1;
      }
    }
    for (const e of ev) {
      if (e.k === 'dice' && e.sp != null) bump('speed:' + e.sp);
      if (['market', 'caught', 'falseAccuse', 'tycoon', 'zone', 'terminal'].includes(e.k)) bump(e.k + (e.kind ? ':' + e.kind : ''));
      if (e.k === 'build' && e.h === 6) bump('skyscraper');
      if (e.k === 'move' && e.fly) bump('teleport');
    }
    steps++;
    const cash = s.players.reduce((a, p) => a + p.cash, 0);
    if (s.players.some((p) => p.cash < 0)) throw new Error('negative cash ' + JSON.stringify(s.players.map((p) => p.cash)));
    if (s.props.some((pr) => pr && pr.o && s.players.find((p) => p.id === pr.o).bankrupt)) throw new Error('bankrupt owner');
    if (s.pot < 0) throw new Error('negative pot');
    if (!Number.isFinite(cash)) throw new Error('nan cash');
    if ((s.market || []).length > 12) throw new Error('market grew unbounded');
    if (s.props.some((pr) => pr && (pr.h < 0 || pr.h > 6))) throw new Error('bad building level');
  }
  totalTurns += s.turnId;
  const w = s.players.find((p) => p.id === s.winner);
  const on = Object.keys(packs).filter((k) => packs[k]).join('+') || 'none';
  console.log(`game ${g}: ${mode.padEnd(8)} ${String(players).padStart(2)}p packs=${on.padEnd(36)} reason=${s.endReason}, round=${s.round}, turns=${s.turnId}, phase=${s.phase}, winner=${w ? w.name + ' ' + netWorth(s, w) : '-'}, state=${JSON.stringify(s).length}B`);
}
console.log('ok, total turns', totalTurns);
console.log('pack features seen:', JSON.stringify(seen));
console.log('rejected bot actions:', Object.keys(errors).length ? JSON.stringify(errors) : 'none');
