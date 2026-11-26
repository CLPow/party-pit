import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const GAMES = ['landlords', 'mean-meme-card-club', 'tunnel-traitors', 'meowltdown'];
const v = Date.now().toString(36);
const shared = readdirSync('shared').filter((f) => f.endsWith('.js'));

function stampPage(file, mods, entry) {
  let html = readFileSync(file, 'utf8');
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\n\s*/, '');
  html = html.replace(/href="([^"]*\.css)(\?v=\w+)?"/g, (m, href) => (href.startsWith('http') ? m : `href="${href}?v=${v}"`));
  const re = new RegExp(`<script type="module" src="${entry.replace(/[.]/g, '\\.')}(\\?v=\\w+)?"></script>`);
  if (!re.test(html)) throw new Error(`${file}: entry ${entry} not found`);
  html = html.replace(re, `<script type="importmap">${JSON.stringify({ imports: mods })}</script>\n  <script type="module" src="${entry}?v=${v}"></script>`);
  writeFileSync(file, html);
}

for (const g of GAMES) {
  const own = readdirSync(join(g, 'js')).filter((f) => f.endsWith('.js'));
  const map = Object.fromEntries([
    ...own.map((f) => [`./js/${f}`, `./js/${f}?v=${v}`]),
    ...shared.map((f) => [`../shared/${f}`, `../shared/${f}?v=${v}`]),
  ]);
  stampPage(join(g, 'index.html'), map, 'js/main.js');
  const swp = join(g, 'sw.js');
  writeFileSync(swp, readFileSync(swp, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${v}';`));
}
stampPage('stats.html', Object.fromEntries(shared.map((f) => [`./shared/${f}`, `./shared/${f}?v=${v}`])), 'stats.js');
stampPage('index.html', Object.fromEntries(shared.map((f) => [`./shared/${f}`, `./shared/${f}?v=${v}`])), 'hub.js');
console.log('stamped', v);
