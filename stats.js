import { RELAY_BASE as RELAY_URL } from './shared/net.js';

const GAMES = [['', 'All games'], ['landlords', 'Landlords'], ['mean-meme-card-club', 'Mean Meme Card Club'], ['tunnel-traitors', 'Tunnel Traitors'], ['meowltdown', 'Meow-ltdown'], ['deal-rush', 'Deal Rush']];
const GNAME = { ...Object.fromEntries(GAMES.slice(1)), hub: 'Hub' };
const chips = (list) => String(list || '').split(',').filter(Boolean).map((g) => `<span class="gchip ${esc(g)}">${esc(GNAME[g] || g)}</span>`).join('');
let game = '';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (ts) => (ts ? new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const ago = (ts) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

function browser(ua) {
  if (!ua) return '';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  return `${br}${os ? ' · ' + os : ''}`;
}

const KIND = { host: ['host', 'Hosted a room'], join: ['join', 'Joined a room'], game: ['game', 'Played a game'] };

const VIEWS = {
  feedback: {
    sub: 'What players sent through the Feedback tab, newest first.',
    list: () => data.feedback || [],
    cols: [['ts', 'When'], ['game', 'Game'], ['rating', 'Stars'], ['text', 'Feedback'], ['name', 'Name'], ['contact', 'Contact'], ['ip', 'IP address'], ['country', 'Country'], ['ua', 'Device']],
    search: (v) => [v.text, v.name, v.contact, v.ip, v.country, v.game],
    row: (v) => `<td title="${esc(when(v.ts))}">${esc(when(v.ts))}</td><td>${chips(v.game)}</td><td class="num">${v.rating ? '⭐'.repeat(v.rating) : '<span class="muted">-</span>'}</td>
      <td class="fbtext">${esc(v.text)}</td><td class="name">${esc(v.name)}</td><td>${esc(v.contact)}</td><td class="mono">${esc(v.ip)}</td><td>${esc(v.country)}</td><td class="ua" title="${esc(v.ua)}">${esc(browser(v.ua))}</td>`,
    sort: { key: 'ts', asc: false },
  },
  players: {
    sub: 'Everyone who hosted, joined or played, by the name they used. Use this to reach people for feedback.',
    list: () => data.players,
    cols: [
      ['name', 'Name'], ['game_list', 'Played'], ['games', 'Games'], ['hosts', 'Hosted'], ['joins', 'Joined'], ['last_seen', 'Last played'],
      ['first_seen', 'First seen'], ['last_room', 'Last room'], ['ips', 'IP address(es)'], ['country', 'Country'], ['city', 'City'], ['last_ua', 'Device'],
    ],
    search: (v) => [v.name, v.ips, v.last_room, v.country, v.city, v.last_ua],
    row: (v) => `<td class="name">${esc(v.name)}</td><td>${chips(v.game_list)}</td><td class="num"><b>${v.games}</b></td><td class="num">${v.hosts}</td><td class="num">${v.joins}</td>
      <td title="${esc(when(v.last_seen))}">${esc(ago(v.last_seen))}</td><td>${esc(when(v.first_seen))}</td><td class="mono">${esc(v.last_room)}</td>
      <td class="mono">${esc(v.ips)}</td><td>${esc(v.country)}</td><td>${esc(v.city)}</td><td class="ua" title="${esc(v.last_ua)}">${esc(browser(v.last_ua))}</td>`,
    sort: { key: 'last_seen', asc: false },
  },
  ips: {
    sub: 'Every IP address that opened the game, with the names used from it.',
    list: () => data.visitors,
    cols: [
      ['ip', 'IP address'], ['names', 'Names used'], ['game_list', 'Games opened'], ['visits', 'Visits'], ['hosts', 'Hosted'], ['joins', 'Joined'], ['games', 'Games'],
      ['last_seen', 'Last seen'], ['first_seen', 'First seen'], ['country', 'Country'], ['city', 'City'], ['last_ua', 'Device'],
    ],
    search: (v) => [v.ip, v.names, v.country, v.city, v.last_ua],
    row: (v) => `<td class="mono">${esc(v.ip)}</td><td class="names">${v.names ? esc(v.names) : '<span class="muted">only visited</span>'}</td><td>${chips(v.game_list)}</td>
      <td class="num"><b>${v.visits}</b></td><td class="num">${v.hosts}</td><td class="num">${v.joins}</td><td class="num">${v.games}</td>
      <td title="${esc(when(v.last_seen))}">${esc(ago(v.last_seen))}</td><td>${esc(when(v.first_seen))}</td><td>${esc(v.country)}</td><td>${esc(v.city)}</td>
      <td class="ua" title="${esc(v.last_ua)}">${esc(browser(v.last_ua))}</td>`,
    sort: { key: 'last_seen', asc: false },
  },
  recent: {
    sub: 'The latest 200 hosts, joins and games.',
    list: () => data.recent,
    cols: [['ts', 'When'], ['game', 'Game'], ['kind', 'What'], ['name', 'Name'], ['room', 'Room'], ['players', 'Players'], ['ip', 'IP address']],
    search: (v) => [v.name, v.room, v.ip, v.kind],
    row: (v) => `<td title="${esc(when(v.ts))}">${esc(when(v.ts))}</td><td>${chips(v.game)}</td><td><span class="chip ${KIND[v.kind] ? KIND[v.kind][0] : ''}">${esc(KIND[v.kind] ? KIND[v.kind][1] : v.kind)}</span></td>
      <td class="name">${esc(v.name)}</td><td class="mono">${esc(v.room)}</td><td class="num">${v.players || ''}</td><td class="mono">${esc(v.ip)}</td>`,
    sort: { key: 'ts', asc: false },
  },
};

let data = null;
let view = 'players';
const sorts = Object.fromEntries(Object.entries(VIEWS).map(([k, v]) => [k, { ...v.sort }]));

const getKey = () => { try { return localStorage.getItem('pp-admin') || ''; } catch { return ''; } };
const setKey = (k) => { try { if (k) localStorage.setItem('pp-admin', k); else localStorage.removeItem('pp-admin'); } catch { /* storage unavailable */ } };

async function load() {
  const key = getKey();
  if (!key) { showLogin(); return; }
  $('#updated').textContent = 'Loading…';
  let res;
  try {
    res = await fetch(RELAY_URL + '/stats' + (game ? '?game=' + game : ''), { headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' });
  } catch {
    $('#updated').textContent = 'Network error';
    return;
  }
  if (res.status === 401) { setKey(''); showLogin('That key is not right.'); return; }
  data = await res.json();
  $('#login').hidden = true;
  $('#dash').hidden = false;
  render();
}

function showLogin(msg = '') {
  $('#dash').hidden = true;
  $('#login').hidden = false;
  $('#loginErr').textContent = msg;
  $('#key').focus();
}

function render() {
  $('#games').innerHTML = GAMES.map(([k, l]) => {
    const n = k ? (data.byGame.find((x) => x.game === k) || {}).games || 0 : data.byGame.reduce((a, x) => a + (x.games || 0), 0);
    return `<button class="tab${k === game ? ' on' : ''}" data-game="${k}">${l} <span class="muted">${n}</span></button>`;
  }).join('');
  const t = data.totals;
  const today = new Date().toISOString().slice(0, 10);
  const td = data.days.find((d) => d.day === today) || { visits: 0, unique_ips: 0, unique_names: 0, games: 0 };
  const tiles = [
    ['Named players', t.names, true], ['Games played', t.games, true], ['Rooms hosted', t.hosts], ['Room joins', t.joins],
    ['Unique IPs', t.unique_ips], ['Total visits', t.visits], ['Players today', td.unique_names], ['Games today', td.games],
  ];
  $('#tiles').innerHTML = tiles.map(([k, v, hl]) => `<div class="tile${hl ? ' hl' : ''}"><div class="k">${k}</div><div class="v">${Number(v || 0).toLocaleString()}</div></div>`).join('');
  $('#updated').textContent = 'Updated ' + new Date(data.generated).toLocaleTimeString();
  $('#fbCount').textContent = (data.feedback || []).length ? `(${data.feedback.length})` : '';

  const days = [];
  for (let i = 59; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push(data.days.find((x) => x.day === d) || { day: d, visits: 0, unique_ips: 0, unique_names: 0, hosts: 0, joins: 0, games: 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.visits));
  $('#chart').innerHTML = days.map((d) => `<div class="bar" style="height:${(d.visits / max) * 100}%" data-tip="${d.day}: ${d.visits} visits, ${d.unique_names} players, ${d.games} games, ${d.hosts} hosted, ${d.joins} joins"></div>`).join('');
  $('#axis').innerHTML = `<span>${days[0].day}</span><span>${days[29].day}</span><span>${days[59].day}</span>`;
  renderView();
}

function renderView() {
  const v = VIEWS[view];
  const sort = sorts[view];
  $('#viewSub').textContent = v.sub;
  $('#head').innerHTML = v.cols.map(([k, l]) => `<th data-k="${k}" class="${sort.key === k ? 'sorted' + (sort.asc ? ' asc' : '') : ''}">${l}</th>`).join('');
  const q = $('#q').value.trim().toLowerCase();
  const all = v.list();
  let rows = all.filter((r) => !q || v.search(r).some((x) => String(x || '').toLowerCase().includes(q)));
  const k = sort.key;
  rows = rows.sort((a, b) => {
    const x = a[k] ?? '';
    const y = b[k] ?? '';
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return sort.asc ? c : -c;
  });
  $('#count').textContent = `${rows.length} of ${all.length}`;
  $('#rows').innerHTML = rows.map((r) => `<tr>${v.row(r)}</tr>`).join('') || `<tr><td colspan="${v.cols.length}" class="muted">Nothing yet.</td></tr>`;
  document.querySelectorAll('#rows tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (v.cols[i]) td.dataset.label = v.cols[i][1]; }));
}

function csv() {
  const v = VIEWS[view];
  const keys = v.cols.map((c) => c[0]);
  const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const fmt = (k, x) => (['first_seen', 'last_seen', 'ts'].includes(k) && x ? new Date(x).toISOString() : x);
  const lines = [v.cols.map((c) => q(c[1])).join(','), ...v.list().map((r) => keys.map((k) => q(fmt(k, r[k]))).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `party-pit-${game || 'all'}-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  setKey($('#key').value.trim());
  load();
});
$('#refresh').addEventListener('click', load);
$('#csv').addEventListener('click', () => data && csv());
let resetArmed = 0;
$('#reset').addEventListener('click', async () => {
  const b = $('#reset');
  if (Date.now() - resetArmed > 4000) {
    resetArmed = Date.now();
    b.textContent = 'Click again to erase all games';
    b.style.background = 'var(--red)';
    b.style.color = '#fff';
    setTimeout(() => { if (Date.now() - resetArmed >= 4000) { b.textContent = 'Reset stats'; b.style.background = ''; b.style.color = ''; } }, 4100);
    return;
  }
  resetArmed = 0;
  b.textContent = 'Resetting…';
  const res = await fetch(RELAY_URL + '/stats/reset', { method: 'POST', headers: { Authorization: 'Bearer ' + getKey() } }).catch(() => null);
  b.textContent = 'Reset stats';
  b.style.background = '';
  b.style.color = '';
  if (res && res.ok) load();
  else $('#updated').textContent = 'Reset failed';
});
$('#logout').addEventListener('click', () => { setKey(''); data = null; showLogin(); });
$('#q').addEventListener('input', () => data && renderView());
$('#games').addEventListener('click', (e) => {
  const b = e.target.closest('[data-game]');
  if (!b) return;
  game = b.dataset.game;
  load();
});
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  view = b.dataset.view;
  document.querySelectorAll('#tabs .tab').forEach((x) => x.classList.toggle('on', x === b));
  if (data) renderView();
});
$('#head').addEventListener('click', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const s = sorts[view];
  sorts[view] = s.key === k ? { key: k, asc: !s.asc } : { key: k, asc: ['ip', 'name', 'names', 'country', 'city', 'room', 'kind'].includes(k) };
  renderView();
});
const tip = $('#tip');
$('#chart').addEventListener('mousemove', (e) => {
  const t = e.target.dataset.tip;
  tip.style.display = t ? 'block' : 'none';
  if (t) { tip.textContent = t; tip.style.left = e.clientX + 12 + 'px'; tip.style.top = e.clientY - 30 + 'px'; }
});
$('#chart').addEventListener('mouseleave', () => { tip.style.display = 'none'; });
load();
setInterval(() => { if (data && document.visibilityState === 'visible') load(); }, 60000);
