import { spawnSync } from 'node:child_process';

const runs = [
  ['landlords', ['20', 'mixed']],
  ['mean-meme-card-club', []],
  ['tunnel-traitors', ['20', 'mixed']],
  ['meowltdown', ['20', 'mixed']],
  ['deal-rush', ['20']],
  ['double-talk', ['20']],
];
let bad = 0;
for (const [g, args] of runs) {
  console.log(`\n=== ${g}`);
  const r = spawnSync(process.execPath, ['tests/sim.js', ...args], { cwd: g, stdio: 'inherit' });
  if (r.status !== 0) bad++;
}
process.exit(bad ? 1 : 0);
