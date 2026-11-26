import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const game = process.argv[2];
const out = game === 'party-pit' ? 'hub' : join(game, 'icons');
const PORT = Number(process.env.CDP_PORT || 9444);
const BASE = process.env.SITE || 'http://localhost:8080';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jobs = [
  ['icon-192.png', 192, 'any'],
  ['icon-512.png', 512, 'any'],
  ['icon-maskable-512.png', 512, 'mask'],
  ['apple-touch-icon.png', 180, 'apple'],
  ['favicon-64.png', 64, 'any'],
  ['logo.png', 720, 'logo'],
];

mkdirSync(out, { recursive: true });
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(process.env.TEMP || '.', 'pp-icons-chrome')}`, 'about:blank'], { stdio: 'ignore' });
let tab;
for (let i = 0; i < 50 && !tab; i++) {
  await sleep(200);
  tab = await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json()).catch(() => null);
}
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0;
const call = (method, params = {}) => new Promise((res) => {
  const i = ++n;
  const h = (ev) => { const m = JSON.parse(ev.data); if (m.id === i) { ws.removeEventListener('message', h); res(m.result); } };
  ws.addEventListener('message', h);
  ws.send(JSON.stringify({ id: i, method, params }));
});
await call('Page.enable');
await call('Runtime.enable');
for (const [file, size, mode] of jobs) {
  await call('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await call('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await call('Page.navigate', { url: `${BASE}/tools/icon.html?game=${game}&size=${size}&mode=${mode}` });
  for (let i = 0; i < 40; i++) {
    const t = await call('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
    if (t.result.value === 'ready') break;
    await sleep(150);
  }
  await sleep(200);
  const shot = await call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  writeFileSync(join(out, file), Buffer.from(shot.data, 'base64'));
  console.log('wrote', join(out, file));
}
proc.kill();
process.exit(0);
