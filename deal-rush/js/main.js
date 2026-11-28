import { initVoice } from '../../shared/voice.js';
import { initQuality, onQuality } from '../../shared/perf.js';
import { initFeedback } from '../../shared/feedback.js';
import { joinHost, randomCode, RELAY_URL } from './net.js';
import { startHost, savedHost, clearSavedHost } from './host.js';
import { GROUPS, G, ACTIONS, cardInfo, HAND_MAX, PLAYS, setsToWin, bestCover } from './rules.js';
import { logo } from '../../shared/logos.js';
import { sfx, buzz, unlockAudio, getSfxVolume, setSfxVolume } from './fx.js';
import { initPwa, keepAwake } from './pwa.js';

const EMOJI = ['🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐯', '🐧', '🐨', '🐵', '🦉', '🐳'];
const COLORS = ['#ffb020', '#39d98a', '#4cc9ff', '#ff5ea8', '#b18cff', '#ff7a45', '#f4d03f', '#2ec4b6'];
const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const gsap = window.gsap;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

function store(kind, key, val) {
  try {
    const s = kind === 'l' ? localStorage : sessionStorage;
    if (val === undefined) return JSON.parse(s.getItem(key) || 'null');
    if (val === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(val));
  } catch { /* storage unavailable */ }
  return null;
}

function loadMe() {
  const saved = store('l', 'dr-me') || {};
  let key = store('s', 'dr-key');
  if (!key) { key = rid(); store('s', 'dr-key', key); }
  return {
    key,
    name: saved.name || '',
    emoji: saved.emoji || EMOJI[Math.floor(Math.random() * EMOJI.length)],
    color: saved.color || COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

const app = { me: loadMe(), role: null, code: null, pub: null, hand: [], seq: -1, host: null, client: null, welcomed: false, lastN: -1, inGame: false, shownWin: 0, recvAt: 0, modalFor: null };

function hit(kind, extra = {}) {
  if (params.has('nohit')) return;
  try { fetch(RELAY_URL + '/hit', { method: 'POST', body: JSON.stringify({ game: 'deal-rush', kind, name: app.me.name || '', wd: navigator.webdriver ? 1 : 0, ...extra }), keepalive: true, mode: 'cors' }).catch(() => {}); } catch { /* offline */ }
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = msg;
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

function modal(html, { tag = null, lock = false, wide = false } = {}) {
  const m = $('#modal');
  const card = $('#modalCard');
  card.className = 'modal-card' + (wide ? ' wide' : '');
  card.innerHTML = html;
  m.hidden = false;
  m._lock = lock;
  app.modalFor = tag;
  gsap.fromTo(card, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: 'power2.out' });
  return card;
}
function closeModal(force = true) {
  const m = $('#modal');
  if (m.hidden || (!force && m._lock)) return;
  m.hidden = true;
  app.modalFor = null;
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(false); });

function show(screen) {
  for (const id of ['home', 'lobby', 'table']) {
    const el = document.getElementById(id);
    const on = id === screen;
    if (el.hidden === !on) continue;
    el.hidden = !on;
    if (on) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  }
  if (screen !== 'table') keepAwake(false);
}

const P = (id) => app.pub?.players.find((p) => p.id === id);
const nameOf = (id) => (id === app.me.key ? 'You' : esc(P(id)?.name || '?'));
const isHost = () => app.role === 'host';
const myTurn = () => app.pub && app.pub.phase === 'play' && app.pub.turn === app.me.key;
const money = (v) => `${v}M`;

function gCount(p, g) { return p.table.filter((e) => e.g === g).length; }
function gComplete(p, g) { const l = p.table.filter((e) => e.g === g); return l.length >= G[g].size && l.some((e) => !cardInfo(e.k).any); }
function rentFor(p, g) {
  const c = Math.min(gCount(p, g), G[g].size);
  if (!c) return 0;
  let r = G[g].rent[c - 1];
  if (gComplete(p, g)) { const u = p.ups[g]; if (u?.sky != null) r += 3; if (u?.term != null) r += 4; }
  return r;
}
const lockedIds = (p) => new Set(p.table.filter((e) => gComplete(p, e.g)).map((e) => e.id));

function cardHtml(k, { id = null, cls = '', mini = false } = {}) {
  const i = cardInfo(k);
  const attrs = `${id != null ? `data-id="${id}"` : ''} data-k="${esc(k)}"`;
  const val = i.v ? `<span class="cv">${i.v}M</span>` : '';
  if (i.type === 'money') return `<div class="card money ${cls}" ${attrs}><span class="cv">${i.v}M</span><b class="big">${i.v}M</b><small>Money</small></div>`;
  if (i.type === 'prop') {
    const g = G[i.g];
    return `<div class="card prop ${cls}" ${attrs} style="--g:${g.color}"><div class="band">${esc(g.name)}</div><b>${esc(i.name)}</b>${mini ? '' : `<div class="ladder">${g.rent.map((r, n) => `<span>${n + 1}🏠 ${r}M</span>`).join('')}</div>`}${val}</div>`;
  }
  if (i.type === 'wild') {
    if (i.any) return `<div class="card wild any ${cls}" ${attrs}><div class="band rainbow">Any city</div><b>🌍 Wild</b><small>Counts as any colour</small></div>`;
    const [a, b] = i.gs.map((x) => G[x]);
    return `<div class="card wild ${cls}" ${attrs} style="--a:${a.color};--b:${b.color}"><div class="band split"><span>${esc(a.name)}</span><span>${esc(b.name)}</span></div><b>🔀 Wild city</b><small>Either colour</small>${val}</div>`;
  }
  if (i.type === 'rent') {
    if (i.any) return `<div class="card rent any ${cls}" ${attrs}><div class="band rainbow">Rent · any colour</div><b>💰 Rent</b><small>One player pays you rent for any set you own</small>${val}</div>`;
    const [a, b] = i.gs.map((x) => G[x]);
    return `<div class="card rent ${cls}" ${attrs} style="--a:${a.color};--b:${b.color}"><div class="band split"><span>${esc(a.name)}</span><span>${esc(b.name)}</span></div><b>💰 Rent</b><small>Everyone pays you rent for one of these colours</small>${val}</div>`;
  }
  const a = ACTIONS[k];
  return `<div class="card action act-${k} ${cls}" ${attrs}><div class="band">Action</div><span class="ai">${a.icon}</span><b>${esc(a.name)}</b>${mini ? '' : `<small>${esc(a.text)}</small>`}${val}</div>`;
}

function renderHome() {
  $('#heroLogo').innerHTML = logo('deal-rush', { text: true });
  $('#nameIn').value = app.me.name;
  $('#emojiRow').innerHTML = EMOJI.map((e) => `<button type="button" data-emoji="${e}" class="${e === app.me.emoji ? 'on' : ''}">${e}</button>`).join('');
  $('#colorRow').innerHTML = COLORS.map((c) => `<button type="button" data-col="${c}" style="background:${c}" class="${c === app.me.color ? 'on' : ''}" aria-label="colour ${c}"></button>`).join('');
  const code = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code) $('#codeIn').value = code;
  const saved = savedHost();
  $('#resumeBox').hidden = !saved;
  if (saved) $('#resumeCode').textContent = saved.code;
}

function saveMe() {
  app.me.name = $('#nameIn').value.trim().slice(0, 20);
  store('l', 'dr-me', { name: app.me.name, emoji: app.me.emoji, color: app.me.color });
}

function needName() {
  saveMe();
  if (app.me.name) return true;
  toast('Type your name first.', 'bad');
  $('#nameIn').focus();
  return false;
}

function setUrl(code) {
  const u = new URL(location.href);
  if (code) u.searchParams.set('room', code);
  else u.searchParams.delete('room');
  history.replaceState(null, '', u);
}

function resetView() {
  app.seq = -1;
  app.pub = null;
  app.lastN = -1;
  app.shownWin = 0;
  app.inGame = false;
  closeModal();
}

function beginHost(resume) {
  const code = resume ? resume.code : randomCode();
  if (resume) app.me.key = resume.me.key;
  store('s', 'dr-key', app.me.key);
  app.role = 'host';
  app.code = code;
  resetView();
  document.body.classList.add('is-host');
  setUrl(code);
  $('#netNote').textContent = 'Opening the room…';
  show('lobby');
  app.host = startHost({
    code,
    me: { ...app.me },
    resume,
    onUpdate: (pub, mine) => { app.hand = mine.hand; onPub(pub); },
    onFx,
    onReady: () => { $('#netNote').textContent = 'Room is open. Share the code!'; },
    onError: () => { $('#netNote').textContent = 'Network trouble. Retrying…'; toast('Could not reach the game servers. Check your connection.', 'bad'); },
    onToast: (m, k) => toast(esc(m), k),
  });
  hit('host', { room: code });
}

function beginJoin(code) {
  app.role = 'client';
  app.code = code;
  resetView();
  app.welcomed = false;
  document.body.classList.remove('is-host');
  setUrl(code);
  toast(`Joining room ${esc(code)}…`);
  const join = () => app.client && app.client.send({ t: 'join', key: app.me.key, name: app.me.name, emoji: app.me.emoji, color: app.me.color });
  app.client = joinHost(code, {
    onOpen: () => join(),
    onData: (m) => {
      if (!m) return;
      if (m.t === 'welcome') {
        if (!app.welcomed) { toast('You are in! 🏙️', 'good'); hit('join', { room: code }); }
        app.welcomed = true;
        if (m.spectator) toast('A game is running, so you are watching. You will be dealt in next game.');
      } else if (m.t === 'state') {
        if (m.seq < app.seq && m.seq > 2) return;
        app.seq = m.seq;
        onPub(m.pub);
      } else if (m.t === 'hand') {
        app.hand = m.hand || [];
        if (app.pub && app.pub.phase !== 'lobby') renderTable();
      } else if (m.t === 'fx') onFx(m);
      else if (m.t === 'rejoin') join();
      else if (m.t === 'kicked') { toast('The host removed you from the room.', 'bad'); leaveRoom(true); }
      else if (m.t === 'err') errToast(m.err);
    },
    onClose: () => { if (app.welcomed) toast('Connection hiccup, reconnecting…'); },
    onError: (e) => {
      toast(e.type === 'peer-unavailable' ? `Room ${esc(code)} was not found. Check the code.` : 'Could not connect. Check your connection.', 'bad');
      leaveRoom(true);
    },
  });
}

function leaveRoom(silent) {
  if (app.host) { app.host.destroy(); app.host = null; }
  if (app.client) {
    if (!silent) app.client.send({ t: 'leave' });
    const c = app.client;
    app.client = null;
    setTimeout(() => c.destroy(), 150);
  }
  app.role = null;
  document.body.classList.remove('is-host', 'my-turn');
  resetView();
  setUrl(null);
  renderHome();
  show('home');
}

const ERRS = {
  'no-plays': `You have used all ${PLAYS} plays this turn. End your turn.`,
  'cannot-bank-cities': 'Cities go on the table, not in the bank.',
  'need-city': 'You need at least one city of that colour to charge rent.',
  'need-full-set': 'Upgrades go on a complete set (not Airports or Utilities).',
  'need-sky': 'A Terminal needs a Skyscraper on that set first.',
  'already': 'That set already has one.',
  'bad-pick': 'That card can no longer be taken.',
  'bad-give': 'You cannot give that city.',
  'not-enough': 'That is not enough. Pick more cards.',
  'bank-it': 'Veto and Double Up cannot be played alone. Bank them or keep them.',
};
function errToast(e) { if (ERRS[e]) toast(ERRS[e], 'bad'); else if (/^pick-/.test(e)) toast(`Pick exactly ${e.slice(5)} cards.`, 'bad'); }

function send(m) {
  if (app.role === 'host') return m.t === 'act' ? app.host.act(m) : app.host.react(m);
  if (app.client) app.client.send(m);
  return null;
}

function act(a, extra = {}) {
  if (!app.pub) return null;
  const m = { t: 'act', a, ctx: app.pub.turnId, ...extra };
  const res = send(m);
  if (res) errToast(res);
  if (app.role === 'client') {
    let n = 0;
    const again = () => {
      if (!app.client || !app.pub || app.pub.turnId !== m.ctx || n++ >= 2) return;
      app.client.send(m);
      setTimeout(again, 2500);
    };
    setTimeout(again, 2500);
  }
  return res;
}

function onFx(m) {
  if (m.k === 'react') {
    const el = document.querySelector(`[data-pid="${CSS.escape(m.from)}"] .oav, #turnBar .tav`);
    const r = (document.querySelector(`.opp[data-pid="${CSS.escape(m.from)}"]`) || $('#turnBar')).getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'floater';
    f.textContent = m.e;
    f.style.left = `${r.left + r.width / 2}px`;
    f.style.top = `${r.top + 10}px`;
    document.body.appendChild(f);
    gsap.to(f, { y: -70, opacity: 0, duration: 1.4, ease: 'power1.out', onComplete: () => f.remove() });
    if (el) gsap.fromTo(el, { scale: 1.25 }, { scale: 1, duration: 0.4 });
  }
  if (m.k === 'chat') toast(`<b>${nameOf(m.from)}:</b> ${esc(m.text)}`);
}

function describe(e) {
  const card = (k) => (k ? esc(cardInfo(k).name) : '');
  switch (e.k) {
    case 'place': return [`${nameOf(e.pid)} placed ${card(e.card)} in ${esc(G[e.g].name)}`, 'place'];
    case 'bank': return [`${nameOf(e.pid)} banked ${money(e.v)}`, 'coin'];
    case 'rent': return [`${nameOf(e.pid)} charges ${e.double ? 'DOUBLE ' : ''}rent: <b>${money(e.amount)}</b> for ${esc(G[e.g].name)}${e.targets.length === 1 ? ` from ${nameOf(e.targets[0])}` : ' from everyone'}`, 'rent'];
    case 'action': {
      const a = ACTIONS[e.card];
      const tg = e.targets.length === 1 ? ` on ${nameOf(e.targets[0])}` : '';
      const extra = e.card === 'swipe' ? `: wants ${card(e.take)}` : e.card === 'swap' ? `: ${card(e.give)} for ${card(e.take)}` : e.card === 'takeover' ? `: wants the whole ${esc(G[e.g].name)} set` : '';
      return [`${nameOf(e.pid)} played ${a.icon} <b>${a.name}</b>${tg}${extra}`, 'rent'];
    }
    case 'veto': return [`✋ ${nameOf(e.pid)} played Veto${e.blocked ? '' : ' back'}!`, 'veto'];
    case 'paid': return [`${nameOf(e.pid)} paid ${nameOf(e.to)} <b>${money(e.amount)}</b>${e.amount < e.owed ? ' (all they had)' : ''}`, 'coin'];
    case 'broke': return [`${nameOf(e.pid)} had nothing to pay`, null];
    case 'took': return [`🫳 ${nameOf(e.pid)} swiped ${card(e.card)} from ${nameOf(e.from)}`, 'steal'];
    case 'swapped': return [`🔁 ${nameOf(e.pid)} swapped with ${nameOf(e.with)}`, 'steal'];
    case 'takeover': return [`🏴 ${nameOf(e.pid)} took over ${nameOf(e.from)}'s ${esc(G[e.g].name)} set!`, 'steal'];
    case 'blocked': return ['The action was vetoed.', 'veto'];
    case 'upgrade': return [`${nameOf(e.pid)} built a ${ACTIONS[e.card].name} on ${esc(G[e.g].name)}`, 'place'];
    case 'payday': return [`${nameOf(e.pid)} drew 2 extra cards`, 'deal'];
    case 'timeout': return [`${nameOf(e.pid)} ran out of time`, null];
    case 'reshuffle': return ['The discard pile was shuffled into a new deck', null];
    default: return null;
  }
}

function onPub(pub) {
  const prev = app.pub;
  app.pub = pub;
  app.recvAt = performance.now();
  if (pub.phase === 'lobby') {
    app.inGame = false;
    show('lobby');
    renderLobby();
    return;
  }
  if (!app.inGame) {
    app.inGame = true;
    const me = P(app.me.key);
    if (me && !me.spectator) hit('game', { room: pub.code, players: pub.order.filter((id) => !P(id)?.bot).length });
  }
  show('table');
  keepAwake(pub.phase === 'play');
  const fresh = app.lastN < 0;
  let last = null;
  for (const e of pub.log) {
    if (e.n <= app.lastN) continue;
    if (fresh) continue;
    if (e.k === 'turn' && e.pid === app.me.key) { sfx.turn(); buzz([30, 40, 30]); }
    const d = describe(e);
    if (!d) continue;
    last = d[0];
    if (d[1] && sfx[d[1]]) sfx[d[1]]();
    const involved = e.pid === app.me.key || e.to === app.me.key || e.from === app.me.key || e.with === app.me.key || (e.targets || []).includes(app.me.key);
    if (involved || ['takeover', 'win'].includes(e.k)) toast(d[0], ['took', 'takeover', 'swapped'].includes(e.k) && e.pid !== app.me.key ? 'bad' : '');
  }
  if (pub.log.length) app.lastN = Math.max(app.lastN, pub.log[pub.log.length - 1].n);
  if (last) app.lastLine = last;
  if (prev && prev.players) {
    const before = new Map(prev.players.map((p) => [p.id, p.sets.length]));
    for (const p of pub.players) if ((before.get(p.id) || 0) < p.sets.length && p.id === app.me.key) { sfx.set(); toast(`🏙️ Set complete! ${p.sets.length} of ${setsToWin(pub.order.length)}`, 'good'); }
  }
  renderTable();
  stagePrompts();
  if (pub.phase === 'over' && app.shownWin !== pub.round) { app.shownWin = pub.round; setTimeout(showWin, 600); }
}

let qrFor = null;
function inviteUrl() {
  return `${location.origin}${location.pathname}?room=${app.pub.code}`;
}

function setHtml(el, html) {
  if (el._h === html) return false;
  el._h = html;
  el.innerHTML = html;
  return true;
}

function renderLobby() {
  const p = app.pub;
  $('#bigCode').textContent = p.code;
  if (qrFor !== p.code && window.QRCode) {
    qrFor = p.code;
    $('#qr').innerHTML = '';
    try { new window.QRCode($('#qr'), { text: inviteUrl(), width: 150, height: 150, colorDark: '#0c1222', colorLight: '#ffffff' }); } catch { /* qr failed */ }
  }
  const seated = p.players.filter((x) => !x.spectator);
  $('#lobbyHead').textContent = `${seated.length} player${seated.length === 1 ? '' : 's'} (2–32)`;
  setHtml($('#lobbyPlayers'), seated.map((x) => `<div class="lp ${x.id === app.me.key ? 'me' : ''}" style="--c:${esc(x.color)}"><span class="av">${esc(x.emoji)}</span><span class="nm">${esc(x.name)}${x.id === p.hostId ? ' 👑' : ''}${x.bot ? ' <small>bot</small>' : ''}</span>${isHost() && x.id !== app.me.key ? `<button class="xbtn" data-kick="${esc(x.id)}" aria-label="Remove">✕</button>` : ''}</div>`).join(''));
  const st = p.settings;
  const n = Math.max(2, seated.length);
  setHtml($('#settings'), `<div class="set-row"><span>Turn timer</span><div class="seg">${[0, 45, 60, 90].map((v) => `<button data-timer="${v}" class="${(v === 0 ? !st.timer : st.timer && st.turnSecs === v) ? 'on' : ''}">${v ? v + 's' : 'Off'}</button>`).join('')}</div></div>
    <div class="set-row"><span>Veto window</span><div class="seg">${[4, 6, 8].map((v) => `<button data-react="${v}" class="${st.reactSecs === v ? 'on' : ''}">${v}s</button>`).join('')}</div></div>
    <p class="muted small">${p.decks} deck${p.decks > 1 ? 's' : ''} for ${n} players · first to <b>${setsToWin(n)} complete sets</b> wins.</p>`);
}

function oppHtml(p, pub) {
  const turn = pub.turn === p.id;
  const sets = GROUPS.filter((g) => gCount(p, g.id)).map((g) => {
    const full = gComplete(p, g.id);
    return `<i class="${full ? 'full' : ''}" style="--g:${g.color}" title="${esc(g.name)} ${Math.min(gCount(p, g.id), g.size)}/${g.size}">${Math.min(gCount(p, g.id), g.size)}/${g.size}</i>`;
  }).join('');
  return `<button class="opp ${turn ? 'turn' : ''} ${p.on ? '' : 'off'}" data-pid="${esc(p.id)}" style="--c:${esc(p.color)}">
    <span class="oav">${esc(p.emoji)}</span>
    <span class="on">${esc(p.name)}</span>
    <span class="ostats"><b title="Complete sets">🏙️${p.sets.length}</b><b title="Bank">💰${p.worth}M</b><b title="Cards in hand">🂠${p.hand}</b></span>
    <span class="osets">${sets || '<em>no cities</em>'}</span>
  </button>`;
}

function mineHtml(p) {
  const groups = GROUPS.filter((g) => gCount(p, g.id));
  const sets = groups.map((g) => {
    const cards = p.table.filter((e) => e.g === g.id);
    const full = gComplete(p, g.id);
    const u = p.ups[g.id] || {};
    return `<div class="set ${full ? 'full' : ''}" style="--g:${g.color}">
      <div class="set-head"><b>${esc(g.name)}</b><span>${Math.min(cards.length, g.size)}/${g.size}${full ? ' ✓' : ''}</span><span class="rent">rent ${rentFor(p, g.id)}M</span></div>
      <div class="set-cards">${cards.map((e) => cardHtml(e.k, { id: e.id, cls: 'mini' + (cardInfo(e.k).type === 'wild' ? ' movable' : ''), mini: true })).join('')}${u.sky != null ? '<span class="up">🏢</span>' : ''}${u.term != null ? '<span class="up">🛫</span>' : ''}</div>
    </div>`;
  }).join('');
  const bank = p.bank.length ? p.bank.map((b) => `<span class="chip">${cardInfo(b.k).v}M</span>`).join('') : '<em class="muted">empty</em>';
  return `<div class="mine-head"><span class="me-av" style="--c:${esc(p.color)}">${esc(p.emoji)}</span><b>Your empire</b><span class="muted">🏙️ ${p.sets.length}/${setsToWin(app.pub.order.length)} sets</span><span class="bank">💰 Bank <b>${p.worth}M</b> ${bank}</span></div>
    <div class="sets">${sets || '<p class="muted empty">Play city cards from your hand to start building sets.</p>'}</div>`;
}

function turnHtml(pub) {
  const t = P(pub.turn);
  if (pub.phase === 'over') {
    const w = P(pub.winner);
    return `<span class="tav">${esc(w?.emoji || '🏆')}</span><div class="tt"><b>${w ? `${nameOf(w.id)} ${w.id === app.me.key ? 'win' : 'wins'}!` : 'Game over'}</b><small>${app.lastLine || ''}</small></div>`;
  }
  if (!t) return '';
  const mine = t.id === app.me.key;
  let sub = '';
  if (pub.stage === 'act') sub = mine ? `${PLAYS - pub.plays} play${PLAYS - pub.plays === 1 ? '' : 's'} left · tap a card` : `${PLAYS - pub.plays} play${PLAYS - pub.plays === 1 ? '' : 's'} left`;
  if (pub.stage === 'react') sub = 'Waiting for Vetoes…';
  if (pub.stage === 'pay') sub = `Waiting for ${Object.keys(pub.pending?.debts || {}).length} to pay…`;
  if (pub.stage === 'discard') sub = 'Discarding down to 7…';
  const next = pub.order[(pub.order.indexOf(pub.turn) + 1) % pub.order.length];
  return `<span class="tav" style="--c:${esc(t.color)}">${esc(t.emoji)}</span>
    <div class="tt"><b>${mine ? 'YOUR TURN' : `${esc(t.name)}'s turn`}</b><small>${sub}${app.lastLine ? ` · ${app.lastLine}` : ''}</small></div>
    <div class="timer" id="timer" hidden><svg viewBox="0 0 36 36"><circle class="tr-bg" cx="18" cy="18" r="15.5"/><circle class="tr-fg" id="timerRing" cx="18" cy="18" r="15.5"/></svg><span id="timerText"></span></div>
    <span class="next" title="Next player">next ${esc(P(next)?.emoji || '')}</span>`;
}

function renderTable() {
  const pub = app.pub;
  if (!pub || pub.phase === 'lobby') return;
  const me = P(app.me.key);
  $('#goalInfo').textContent = `First to ${setsToWin(pub.order.length)} sets`;
  $('#codeMini').textContent = pub.code;
  $('#deckInfo').textContent = `🂠 ${pub.deck}`;
  const opps = pub.order.filter((id) => id !== app.me.key).map(P).filter(Boolean);
  setHtml($('#opps'), opps.map((p) => oppHtml(p, pub)).join(''));
  const tb = $('#turnBar');
  const tbHtml = turnHtml(pub);
  if (setHtml(tb, tbHtml)) { tb.style.setProperty('--c', P(pub.turn)?.color || '#ffd35a'); timerLoop(); }
  tb.classList.toggle('mine', myTurn());
  document.body.classList.toggle('my-turn', myTurn() && pub.stage === 'act');
  setHtml($('#mine'), me && !me.spectator ? mineHtml(me) : '<p class="muted empty">You are watching this game. You will be dealt in next game.</p>');
  const canPlay = myTurn() && pub.stage === 'act';
  setHtml($('#hand'), app.hand.map((c) => cardHtml(c.k, { id: c.id, cls: canPlay ? 'can' : '' })).join('') || '<p class="muted empty">No cards in hand</p>');
  $('#endBtn').hidden = !canPlay;
  $('#dockInfo').innerHTML = canPlay ? `<b>${PLAYS - pub.plays}</b> play${PLAYS - pub.plays === 1 ? '' : 's'} left · hand ${app.hand.length}${app.hand.length > HAND_MAX ? ` <span class="warn">(max ${HAND_MAX})</span>` : ''}` : `Hand ${app.hand.length}`;
  const t = `${myTurn() && pub.phase === 'play' ? '● Your turn — ' : ''}Deal Rush`;
  if (document.title !== t) document.title = t;
}

function timerLoop() {
  const p = app.pub;
  const t = $('#timer');
  if (!t) return;
  if (!p || p.phase !== 'play' || !p.left || !p.dur) { t.hidden = true; return; }
  const rem = Math.max(0, p.left - (performance.now() - app.recvAt));
  t.hidden = false;
  $('#timerText').textContent = Math.ceil(rem / 1000);
  $('#timerRing').style.strokeDashoffset = String(97.4 * (1 - Math.min(1, rem / p.dur)));
  t.classList.toggle('low', rem < 8000 && myTurn());
}
setInterval(timerLoop, 500);

function pickList(title, items, cb, { sub = '' } = {}) {
  const card = modal(`<h3>${title}</h3>${sub ? `<p class="muted">${sub}</p>` : ''}<div class="pick-list">${items.map((it, i) => `<button class="pick ${it.disabled ? 'off' : ''}" data-i="${i}" ${it.disabled ? 'disabled' : ''}>${it.html}</button>`).join('')}</div><div class="modal-actions"><button class="btn ghost" data-close>Cancel</button></div>`, { wide: items.length > 6 });
  card.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { const it = items[Number(b.dataset.i)]; closeModal(); cb(it.v); }));
}

const playerItem = (p, note = '') => ({ v: p.id, html: `<span class="pav" style="--c:${esc(p.color)}">${esc(p.emoji)}</span><span><b>${esc(p.name)}</b><small>${note}</small></span>` });

function pickTarget(title, cb, filter = () => true, note = (p) => `💰 ${p.worth}M · 🏙️ ${p.sets.length} sets`) {
  const others = app.pub.order.filter((id) => id !== app.me.key).map(P).filter(Boolean);
  const items = others.map((p) => ({ ...playerItem(p, note(p)), disabled: !filter(p) }));
  if (!items.some((x) => !x.disabled)) { toast('Nobody can be targeted with that right now.', 'bad'); return; }
  pickList(title, items, cb);
}

function cardMenu(id) {
  const pub = app.pub;
  const c = app.hand.find((x) => x.id === id);
  if (!c) return;
  const me = P(app.me.key);
  const i = cardInfo(c.k);
  const opts = [];
  const left = PLAYS - pub.plays;
  if (i.type === 'prop') opts.push({ label: `🏙️ Place in ${G[i.g].name} (${Math.min(gCount(me, i.g) + 1, G[i.g].size)}/${G[i.g].size})`, run: () => act('play', { id, g: i.g }) });
  if (i.type === 'wild') for (const g of i.gs) if (!i.any || gCount(me, g)) opts.push({ label: `🔀 Place as ${G[g].name} (${Math.min(gCount(me, g) + 1, G[g].size)}/${G[g].size})`, run: () => act('play', { id, g }) });
  if (i.type === 'wild' && i.any && !opts.length) for (const g of GROUPS) opts.push({ label: `🔀 Place as ${g.name}`, run: () => act('play', { id, g: g.id }) });
  if (i.type === 'rent') {
    const dbl = app.hand.find((x) => x.k === 'double');
    for (const g of i.gs) {
      const r = rentFor(me, g);
      if (!r) continue;
      const go = (double) => (i.any ? pickTarget(`Who pays ${money(r * (double ? 2 : 1))} rent?`, (t) => act('play', { id, g, target: t, double })) : act('play', { id, g, double }));
      opts.push({ label: `💰 Charge ${money(r)} for ${G[g].name}${i.any ? ' (one player)' : ' (everyone)'}`, run: () => go(undefined) });
      if (dbl && left >= 2) opts.push({ label: `✖️ Double Up: charge ${money(r * 2)} for ${G[g].name} (uses 2 plays)`, run: () => go(dbl.id) });
    }
    if (!opts.length) opts.push({ label: 'You own no city of these colours yet', disabled: true });
  }
  if (i.type === 'action') {
    switch (c.k) {
      case 'payday': opts.push({ label: '💸 Draw 2 cards', run: () => act('play', { id }) }); break;
      case 'house': opts.push({ label: '🎁 Everyone pays me 2M', run: () => act('play', { id }) }); break;
      case 'debt': opts.push({ label: '🧾 Make one player pay 5M', run: () => pickTarget('Who pays you 5M?', (t) => act('play', { id, target: t })) }); break;
      case 'swipe': opts.push({ label: '🫳 Take one city', run: () => pickTarget('Swipe from whom?', (t) => pickCity(t, 'Which city?', (take) => act('play', { id, target: t, take })), (p) => p.table.some((e) => !lockedIds(p).has(e.id))) }); break;
      case 'swap': opts.push({
        label: '🔁 Swap a city', run: () => {
          const mineFree = me.table.filter((e) => !lockedIds(me).has(e.id));
          if (!mineFree.length) { toast('You need a city outside a complete set to swap.', 'bad'); return; }
          pickTarget('Swap with whom?', (t) => pickCity(t, 'Which of their cities?', (take) => pickCity(app.me.key, 'Which of yours do you give?', (give) => act('play', { id, target: t, take, give }))), (p) => p.table.some((e) => !lockedIds(p).has(e.id)));
        },
      }); break;
      case 'takeover': opts.push({
        label: '🏴 Take a complete set', run: () => pickTarget('Take over whom?', (t) => {
          const p = P(t);
          pickList('Which set?', p.sets.map((g) => ({ v: g, html: `<span class="sw" style="--g:${G[g].color}"></span><b>${esc(G[g].name)}</b><small>rent ${rentFor(p, g)}M</small>` })), (g) => act('play', { id, target: t, g }));
        }, (p) => p.sets.length > 0, (p) => `${p.sets.length} complete set${p.sets.length === 1 ? '' : 's'}`),
      }); break;
      case 'sky':
      case 'term': {
        const ok = me.sets.filter((g) => !G[g].noUp && (c.k === 'sky' ? me.ups[g]?.sky == null : me.ups[g]?.sky != null && me.ups[g]?.term == null));
        for (const g of ok) opts.push({ label: `${ACTIONS[c.k].icon} Build on ${G[g].name} (+${c.k === 'sky' ? 3 : 4}M rent)`, run: () => act('play', { id, g }) });
        if (!ok.length) opts.push({ label: c.k === 'sky' ? 'Needs a complete set (not Airports/Utilities)' : 'Needs a set with a Skyscraper', disabled: true });
        break;
      }
      case 'veto': opts.push({ label: '✋ Keep it: it pops up when someone acts against you', disabled: true }); break;
      case 'double': opts.push({ label: '✖️ Play it together with a rent card', disabled: true }); break;
      default: break;
    }
  }
  if (i.type !== 'prop' && i.type !== 'wild') opts.push({ label: `🏦 Bank it as ${money(i.v)}`, run: () => act('play', { id, as: 'bank' }) });
  const card = modal(`<div class="menu-card">${cardHtml(c.k)}</div><div class="menu-opts">${opts.map((o, n) => `<button class="btn ${o.disabled ? 'ghost' : n === 0 ? 'gold' : 'blue'}" data-o="${n}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}<button class="btn ghost" data-close>Cancel</button></div>`, { tag: 'menu' });
  card.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => { const o = opts[Number(b.dataset.o)]; closeModal(); sfx.tap(); o.run(); }));
}

function pickCity(pid, title, cb) {
  const p = P(pid);
  const locked = lockedIds(p);
  const items = p.table.map((e) => ({ v: e.id, disabled: locked.has(e.id), html: `${cardHtml(e.k, { cls: 'mini', mini: true })}<small>${locked.has(e.id) ? 'in a complete set' : esc(G[e.g].name)}</small>` }));
  pickList(title, items, cb);
}

function oppDetail(pid) {
  const p = P(pid);
  if (!p) return;
  const sets = GROUPS.filter((g) => gCount(p, g.id)).map((g) => `<div class="set ${gComplete(p, g.id) ? 'full' : ''}" style="--g:${g.color}"><div class="set-head"><b>${esc(g.name)}</b><span>${Math.min(gCount(p, g.id), g.size)}/${g.size}</span><span class="safety">${gComplete(p, g.id) ? '🔒 safe from Swipe/Swap · 🏴 Takeover target' : '🫳 can be swiped'}</span><span class="rent">rent ${rentFor(p, g.id)}M</span></div><div class="set-cards">${p.table.filter((e) => e.g === g.id).map((e) => cardHtml(e.k, { cls: 'mini', mini: true })).join('')}${p.ups[g.id]?.sky != null ? '<span class="up">🏢</span>' : ''}${p.ups[g.id]?.term != null ? '<span class="up">🛫</span>' : ''}</div></div>`).join('');
  modal(`<h3><span class="pav" style="--c:${esc(p.color)}">${esc(p.emoji)}</span> ${esc(p.name)}</h3><p class="muted">🏙️ ${p.sets.length} complete · 💰 ${p.worth}M in the bank (${p.bank.map((b) => cardInfo(b.k).v + 'M').join(', ') || 'empty'}) · 🂠 ${p.hand} in hand</p><div class="sets">${sets || '<p class="muted">No cities yet.</p>'}</div><div class="modal-actions"><button class="btn gold" data-close>Close</button></div>`, { wide: true });
}

function stagePrompts() {
  const pub = app.pub;
  const pd = pub.pending;
  if (pub.phase !== 'play') { if (['react', 'pay', 'discard'].includes(app.modalFor)) closeModal(); return; }
  const me = app.me.key;
  if (pub.stage === 'react' && pd) {
    const vetoes = app.hand.filter((c) => c.k === 'veto').length;
    const imTarget = pd.targets.includes(me) && pd.chain[me] % 2 === 0;
    const counters = pd.by === me ? pd.targets.filter((x) => pd.chain[x] % 2 === 1) : [];
    const key = `react:${pub.turnId}`;
    if (app.modalFor === key) return;
    if (imTarget) {
      const what = pd.a === 'rent' ? `charges you <b>${money(pd.amount)}</b> rent` : pd.a === 'charge' ? `wants <b>${money(pd.amount)}</b> from you` : pd.a === 'swipe' ? `wants to swipe your <b>${esc(cardInfo(pd.take).name)}</b>` : pd.a === 'swap' ? `wants your <b>${esc(cardInfo(pd.take).name)}</b> for their <b>${esc(cardInfo(pd.give).name)}</b>` : `wants your whole <b>${esc(G[pd.g].name)}</b> set`;
      const card = modal(`<h3>${pd.chain[me] ? 'They vetoed your Veto!' : 'Incoming!'}</h3><p>${nameOf(pd.by)} ${what}.</p><div class="menu-opts">${vetoes ? `<button class="btn gold" data-veto>✋ Veto it (${vetoes} in hand)</button>` : '<p class="muted">You have no Veto card.</p>'}<button class="btn ghost" data-close>Let it happen</button></div>`, { tag: key });
      card.querySelector('[data-veto]')?.addEventListener('click', () => { closeModal(); sfx.veto(); act('veto'); });
      if (vetoes) buzz([60, 40, 60]);
      return;
    }
    if (counters.length && vetoes) {
      const card = modal(`<h3>Vetoed!</h3><p>${counters.map(nameOf).join(', ')} vetoed your action. Veto back?</p><div class="menu-opts">${counters.map((x) => `<button class="btn gold" data-for="${esc(x)}">✋ Veto ${nameOf(x)}</button>`).join('')}<button class="btn ghost" data-close>Accept it</button></div>`, { tag: key });
      card.querySelectorAll('[data-for]').forEach((b) => b.addEventListener('click', () => { closeModal(); sfx.veto(); act('veto', { for: b.dataset.for }); }));
      return;
    }
    if (app.modalFor?.startsWith('react:')) closeModal();
    return;
  }
  if (app.modalFor?.startsWith('react:')) closeModal();
  if (pub.stage === 'pay' && pd?.debts?.[me] != null) {
    if (app.modalFor === 'pay') return;
    payModal(pd.debts[me], pd.by);
    return;
  }
  if (app.modalFor === 'pay') closeModal();
  if (pub.stage === 'discard' && pub.turn === me) {
    if (app.modalFor === 'discard') return;
    discardModal(app.hand.length - HAND_MAX);
    return;
  }
  if (app.modalFor === 'discard') closeModal();
}

function payModal(owed, to) {
  const me = P(app.me.key);
  const items = [
    ...me.bank.map((b) => ({ id: b.id, k: b.k, v: cardInfo(b.k).v, where: 'bank' })),
    ...me.table.filter((e) => cardInfo(e.k).v > 0).map((e) => ({ id: e.id, k: e.k, v: cardInfo(e.k).v, where: G[e.g].name })),
    ...Object.values(me.ups).flatMap((u) => [u.sky, u.term].filter((x) => x != null)).map((id) => ({ id, k: '?', v: 0, where: 'upgrade' })),
  ];
  const sel = new Set();
  let sum = 0;
  const bankItems = items.filter((x) => x.where === 'bank');
  const cover = bestCover(bankItems.map((x) => x.v), owed);
  if (cover) cover.forEach((i) => sel.add(bankItems[i].id));
  else for (const it of bankItems) { sel.add(it.id); sum += it.v; }
  const total = items.reduce((a, x) => a + x.v, 0);
  const card = modal(`<h3>Pay ${nameOf(to)} ${money(owed)}</h3><p class="muted">Pick cards from your bank or cities. No change is given.</p><div class="pay-list">${items.map((it) => `<button class="pay-item" data-id="${it.id}">${it.k === '?' ? '<span class="chip">🏢</span>' : cardHtml(it.k, { cls: 'mini', mini: true })}<small>${esc(it.where)}</small></button>`).join('')}</div><div class="modal-actions"><span id="paySum" class="muted"></span><button class="btn gold" id="payGo">Pay</button></div>`, { tag: 'pay', lock: true, wide: true });
  const upd = () => {
    let s2 = 0;
    card.querySelectorAll('.pay-item').forEach((b) => { const on = sel.has(Number(b.dataset.id)); b.classList.toggle('on', on); if (on) s2 += items.find((x) => x.id === Number(b.dataset.id)).v; });
    card.querySelector('#paySum').textContent = `Selected ${money(s2)} of ${money(owed)}`;
    card.querySelector('#payGo').disabled = !(s2 >= owed || s2 >= total);
  };
  card.querySelectorAll('.pay-item').forEach((b) => b.addEventListener('click', () => { const id = Number(b.dataset.id); if (sel.has(id)) sel.delete(id); else sel.add(id); sfx.tap(); upd(); }));
  card.querySelector('#payGo').addEventListener('click', () => { closeModal(); act('pay', { ids: [...sel] }); sfx.coin(); });
  upd();
}

function discardModal(n) {
  const sel = new Set();
  const card = modal(`<h3>Too many cards</h3><p class="muted">You can keep ${HAND_MAX}. Pick ${n} to discard.</p><div class="pay-list">${app.hand.map((c) => `<button class="pay-item" data-id="${c.id}">${cardHtml(c.k, { cls: 'mini', mini: true })}</button>`).join('')}</div><div class="modal-actions"><button class="btn gold" id="discGo" disabled>Discard</button></div>`, { tag: 'discard', lock: true, wide: true });
  const upd = () => { card.querySelectorAll('.pay-item').forEach((b) => b.classList.toggle('on', sel.has(Number(b.dataset.id)))); card.querySelector('#discGo').disabled = sel.size !== n; };
  card.querySelectorAll('.pay-item').forEach((b) => b.addEventListener('click', () => { const id = Number(b.dataset.id); if (sel.has(id)) sel.delete(id); else if (sel.size < n) sel.add(id); upd(); }));
  card.querySelector('#discGo').addEventListener('click', () => { closeModal(); act('discard', { ids: [...sel] }); });
}

function showWin() {
  const pub = app.pub;
  if (!pub || pub.phase !== 'over') return;
  const w = P(pub.winner);
  const mine = pub.winner === app.me.key;
  sfx.win();
  const ranks = pub.order.map(P).filter(Boolean).sort((a, b) => b.sets.length - a.sets.length || b.worth - a.worth);
  const card = modal(`<div class="win">
      <div class="win-stage"><div class="win-rays"></div><div class="win-crown">👑</div><div class="win-av" style="--c:${esc(w?.color || '#ffd35a')}">${esc(w?.emoji || '🏆')}</div></div>
      <h2>${mine ? 'YOU WIN!' : `${esc(w?.name || '?')} WINS!`}</h2>
      <p class="muted">${w ? w.sets.map((g) => `<span class="sw" style="--g:${G[g].color}"></span>${esc(G[g].name)}`).join(' · ') : ''}</p>
      <div class="standings">${ranks.map((p, i) => `<div><b>#${i + 1}</b><span class="pav" style="--c:${esc(p.color)}">${esc(p.emoji)}</span><span>${esc(p.name)}</span><span class="grow"></span><span class="muted">🏙️ ${p.sets.length} · 💰 ${p.worth}M · 🏆 ${p.wins}</span></div>`).join('')}</div>
      <div class="modal-actions">${isHost() ? '<button class="btn ghost" data-action="tolobby">Lobby</button><button class="btn gold" data-action="again">🔁 Play again</button>' : '<button class="btn gold" data-close>Nice</button>'}</div></div>`, { tag: 'win', wide: true });
  const $c = (s) => card.querySelector(s);
  gsap.timeline()
    .fromTo($c('.win-rays'), { scale: 0.2, opacity: 0, rotation: -30 }, { scale: 1, opacity: 1, rotation: 0, duration: 1.2, ease: 'expo.out' }, 0)
    .fromTo($c('.win-av'), { y: 60, scale: 0.6, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)' }, 0.1)
    .fromTo($c('.win-crown'), { y: -140, opacity: 0, rotation: -15 }, { y: 0, opacity: 1, rotation: 0, duration: 0.5, ease: 'power3.in' }, 0.5)
    .fromTo($c('.win-av'), { scaleY: 1 }, { scaleY: 0.88, duration: 0.08, yoyo: true, repeat: 1 }, 1.0)
    .fromTo(card.querySelectorAll('.standings > div'), { x: -20, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.05, duration: 0.3 }, 1.0);
}

function rules() {
  modal(`<h3>How to play Deal Rush</h3>
    <p><b>Goal:</b> be the first with complete city sets in different colours: 3 sets for up to 5 players, 4 up to 10, 5 up to 15, 6 for bigger tables.</p>
    <ul>
      <li>On your turn you draw 2 cards (5 if your hand was empty), then make up to <b>${PLAYS} plays</b>.</li>
      <li>A play is: put a city on the table, bank a money or action card, or use an action.</li>
      <li>Cities never go in the bank. Wild cities can be moved between their colours on your turn by tapping them.</li>
      <li><b>Rent</b> cards charge for a colour you own. The amount grows with how many of that set you have, plus 🏢 Skyscraper (+3M) and 🛫 Terminal (+4M) on complete sets.</li>
      <li>When you owe money you pick what to pay with, from your bank or your cities. No change is given. If you cannot cover it you pay everything you have.</li>
      <li><b>✋ Veto</b> cancels an action against you. The other player can Veto your Veto.</li>
      <li>Swipe and Swap cannot touch cities in a complete set. Hostile Takeover takes a whole complete set.</li>
      <li>End your turn with at most ${HAND_MAX} cards in hand.</li>
      <li>Big tables use more decks: one per 5 players.</li>
    </ul>
    <div class="modal-actions"><button class="btn gold" data-close>Got it</button></div>`, { wide: true });
}

function soundModal() {
  const card = modal(`<h3>🔊 Sound</h3><label class="slider"><span>Sounds</span><input type="range" min="0" max="100" value="${Math.round(getSfxVolume() * 100)}" id="sVol"></label><div class="modal-actions"><button class="btn gold" data-close>Done</button></div>`);
  card.querySelector('#sVol').addEventListener('input', (e) => setSfxVolume(e.target.value / 100));
  card.querySelector('#sVol').addEventListener('change', () => sfx.coin());
}

function hostMenu() {
  const pub = app.pub;
  const others = pub.players.filter((p) => p.id !== app.me.key);
  const card = modal(`<h3>⚙️ Host controls</h3><div class="menu-opts"><button class="btn blue" data-h="lobby">↩ Back to lobby</button></div><h4>Players</h4><div class="pick-list">${others.map((p) => `<div class="kick-row"><span class="pav" style="--c:${esc(p.color)}">${esc(p.emoji)}</span><span>${esc(p.name)}${p.on ? '' : ' <small class="muted">(offline)</small>'}</span><span class="grow"></span><button class="btn small ghost" data-kick="${esc(p.id)}">Remove</button></div>`).join('') || '<p class="muted">Nobody else here.</p>'}</div><div class="modal-actions"><button class="btn gold" data-close>Close</button></div>`, { wide: true });
  card.querySelector('[data-h="lobby"]').addEventListener('click', () => { closeModal(); app.host.act({ a: 'lobby' }); });
}

function chat() {
  const card = modal(`<h3>💬 Say something</h3><input id="chatIn" maxlength="140" placeholder="Type a message"><div class="modal-actions"><button class="btn ghost" data-close>Cancel</button><button class="btn gold" id="chatGo">Send</button></div>`);
  const go = () => { const v = card.querySelector('#chatIn').value.trim(); if (v) send({ t: 'chat', text: v }); closeModal(); };
  card.querySelector('#chatGo').addEventListener('click', go);
  card.querySelector('#chatIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  card.querySelector('#chatIn').focus();
}

async function share() {
  const url = inviteUrl();
  if (navigator.share) { try { await navigator.share({ title: 'Deal Rush', text: `Join my Deal Rush room ${app.pub.code}`, url }); return; } catch { /* cancelled */ } }
  copyLink();
}
async function copyLink() {
  try { await navigator.clipboard.writeText(inviteUrl()); toast('Invite link copied.', 'good'); } catch { toast(inviteUrl()); }
}

document.addEventListener('click', async (e) => {
  unlockAudio();
  const b = e.target.closest('[data-action], [data-emoji], [data-col], [data-kick], [data-timer], [data-react], [data-close]');
  if (b?.dataset.close !== undefined && b.matches('[data-close]')) { closeModal(); return; }
  if (b?.dataset.emoji) { app.me.emoji = b.dataset.emoji; saveMe(); renderHome(); return; }
  if (b?.dataset.col) { app.me.color = b.dataset.col; saveMe(); renderHome(); return; }
  if (b?.dataset.kick && isHost()) { app.host.act({ a: 'kick', pid: b.dataset.kick }); closeModal(); return; }
  if (b?.dataset.timer !== undefined && isHost()) { const v = Number(b.dataset.timer); app.host.act({ a: 'settings', patch: v ? { timer: true, turnSecs: v } : { timer: false } }); return; }
  if (b?.matches('[data-react]') && b.closest('#settings') && isHost()) { app.host.act({ a: 'settings', patch: { reactSecs: Number(b.dataset.react) } }); return; }
  if (b?.matches('[data-react]') && b.closest('#reactBar')) { send({ t: 'react', e: b.dataset.react }); onFx({ k: 'react', from: app.me.key, e: b.dataset.react }); return; }
  const a = b?.dataset.action;
  if (a) {
    switch (a) {
      case 'create': if (needName()) beginHost(null); return;
      case 'join': {
        if (app.role || !needName()) return;
        const code = $('#codeIn').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        if (code.length !== 5) { toast('Room codes have 5 characters.', 'bad'); return; }
        beginJoin(code);
        return;
      }
      case 'resume': { const s = savedHost(); if (s) beginHost(s); return; }
      case 'forget': clearSavedHost(); renderHome(); return;
      case 'leave': leaveRoom(false); return;
      case 'rules': rules(); return;
      case 'sound': soundModal(); return;
      case 'hostmenu': hostMenu(); return;
      case 'addbot': app.host?.act({ a: 'bot' }); sfx.deal(); return;
      case 'start': app.host?.act({ a: 'start' }); return;
      case 'tolobby': closeModal(); app.host?.act({ a: 'lobby' }); return;
      case 'again': closeModal(); app.host?.act({ a: 'again' }); return;
      case 'copy': copyLink(); return;
      case 'share': share(); return;
      case 'chat': chat(); return;
      case 'end': if (myTurn()) { act('end'); sfx.tap(); } return;
      default: return;
    }
  }
  const opp = e.target.closest('.opp');
  if (opp) { oppDetail(opp.dataset.pid); return; }
  const hc = e.target.closest('#hand .card');
  if (hc) {
    if (!(myTurn() && app.pub.stage === 'act')) { toast(myTurn() ? 'Wait a moment…' : 'It is not your turn yet.'); return; }
    cardMenu(Number(hc.dataset.id));
    return;
  }
  const mv = e.target.closest('#mine .card.movable');
  if (mv && myTurn() && app.pub.stage === 'act') {
    const i = cardInfo(mv.dataset.k);
    pickList('Move this wild city to…', i.gs.map((g) => ({ v: g, html: `<span class="sw" style="--g:${G[g].color}"></span><b>${esc(G[g].name)}</b>` })), (g) => act('move', { id: Number(mv.dataset.id), g }));
  }
});

$('#nameIn').addEventListener('change', saveMe);
$('#codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.querySelector('[data-action="join"]').click(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && app.pub) renderTable(); });

if (window.ResizeObserver) new ResizeObserver(([e]) => document.documentElement.style.setProperty('--dock-h', Math.round(e.contentRect.height + 14) + 'px')).observe($('#dock'));
renderHome();
initPwa({ toast: (m, k) => toast(esc(m), k) });
hit('visit');
const roomParam = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
if (roomParam && app.me.name && !params.has('nojoin')) setTimeout(() => { if (!app.role) beginJoin(roomParam); }, 50);
window.__dr = app;

initFeedback({ game: 'deal-rush' });
initVoice({ me: () => app.me.key, enabled: () => !!app.pub && !!(app.host || app.client), players: () => app.pub?.players || [], toast: (m, k) => toast(esc(m), k) });
initQuality();
