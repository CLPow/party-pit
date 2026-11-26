import { logo } from './shared/logos.js';

export const GAMES = [
  { id: 'landlords', name: 'Landlords', players: '2–32', tag: 'Property trading', desc: 'Roll, buy world cities, build skyscrapers and bankrupt your friends on an animated board.', color: '#2f7de1' },
  { id: 'mean-meme-card-club', name: 'Mean Meme Card Club', players: '3–50', tag: 'Fill-in-the-blank', desc: 'One judge, one prompt, everyone plays their worst card. Hundreds of packs, English and Chinese.', color: '#7a3cff' },
  { id: 'tunnel-traitors', name: 'Tunnel Traitors', players: '3–32', tag: 'Hidden traitors', desc: 'Dig toward the gold together, while the traitors among you quietly cave the tunnels in.', color: '#e8912a' },
  { id: 'meowltdown', name: 'Meow-ltdown', players: '2–40', tag: 'Push-your-luck', desc: 'Lab cats draw from a reactor until someone pulls the Meltdown. Hiss, overload and bribe to survive.', color: '#2aa86a' },
];

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

document.getElementById('heroLogo').innerHTML = logo('party-pit', { text: true });
document.getElementById('games').innerHTML = GAMES.map((g) => `
  <a class="game" href="${g.id}/" style="--gc:${g.color}">
    <img src="${g.id}/icons/icon-192.png" alt="" width="96" height="96" loading="lazy">
    <div class="gi">
      <div class="gt"><h2>${esc(g.name)}</h2><span class="pp">${esc(g.players)} players</span></div>
      <div class="tag">${esc(g.tag)}</div>
      <p>${esc(g.desc)}</p>
    </div>
    <span class="play">Play ▶</span>
  </a>`).join('');

