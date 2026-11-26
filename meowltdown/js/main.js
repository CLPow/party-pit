import { joinHost, randomCode, RELAY_URL } from './net.js';
import { startHost, savedHost, clearSavedHost } from './host.js';
import { CARDS, PACKS, HOUSE, PLAYABLE, TARGETED } from './packs.js';
import { catSvg, cardArt, FURS, ACCS } from './avatars.js';
import { logo } from '../../shared/logos.js';
import * as F from './fx.js';
import { setMood, kickMusic, getMusicVolume, setMusicVolume, duck } from './music.js';
import { initPwa, keepAwake } from './pwa.js';
import * as V from './voice.js';
import { initQuality, quality, qualityMode, setQualityMode, rich } from './quality.js';

const { sfx } = F;
const COLORS = ['#ffd23d', '#39ff88', '#4cc9ff', '#ff5ea8', '#c25bff', '#ff8a1f', '#ff4d4d', '#f5f5f5', '#9dff3d', '#3dffe8'];
const ORDER = ['coolant', 'hiss', 'nap', 'overload', 'target', 'peek', 'recal', 'scramble', 'bribe', 'reverse', 'bottom', 'contain', 'cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'meltdown'];
const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const gsap = window.gsap;
gsap.defaults({ overwrite: 'auto' });
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
F.onSfx(duck);

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
  const saved = store('l', 'mow-me') || {};
  let key = store('s', 'mow-key');
  if (!key) { key = rid(); store('s', 'mow-key', key); }
  return {
    key,
    name: saved.name || '',
    avatar: saved.avatar || `${Math.floor(Math.random() * FURS.length)}-${Math.floor(Math.random() * ACCS.length)}`,
    color: saved.color || COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

const app = {
  me: loadMe(),
  role: null,
  code: null,
  pub: null,
  mine: { cards: [], priv: null, top: null },
  seq: -1,
  host: null,
  client: null,
  sel: [],
  recvAt: 0,
  welcomed: false,
  lastN: -1,
  lastPriv: 0,
  queue: [],
  busy: false,
  inGame: false,
  shownWin: 0,
  lastSec: -1,
};
if (store('l', 'mow-calm')) document.body.classList.add('calm');

function hit(kind, extra = {}) {
  if (params.has('nohit')) return;
  try { fetch(RELAY_URL + '/hit', { method: 'POST', body: JSON.stringify({ game: 'meowltdown', kind, name: app.me.name || '', wd: navigator.webdriver ? 1 : 0, ...extra }), keepalive: true, mode: 'cors' }).catch(() => {}); } catch { /* offline */ }
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 4) box.firstElementChild.remove();
  gsap.fromTo(el, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
  setTimeout(() => gsap.to(el, { opacity: 0, x: 30, duration: 0.3, onComplete: () => el.remove() }), kind === 'bad' ? 5000 : 3200);
}

function modal(html, { wide = false, onClose, cls = '', lock = false } = {}) {
  const m = $('#modal');
  const card = $('#modalCard');
  stopModalFx(m);
  card.className = 'modal-card' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '');
  card.innerHTML = html;
  m.hidden = false;
  m._onClose = onClose;
  m._lock = lock;
  gsap.fromTo(card, { scale: 0.9, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(2)' });
  return card;
}
function stopModalFx(m) {
  if (m._tl) { m._tl.kill(); m._tl = null; }
  gsap.killTweensOf(m.querySelectorAll('.win-cat, .crown-glint'));
}
function closeModal(force = true) {
  const m = $('#modal');
  if (m.hidden || (!force && m._lock)) return;
  stopModalFx(m);
  m.hidden = true;
  m._tag = null;
  const f = m._onClose;
  m._onClose = null;
  if (f) f();
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(false); });
$('#critMark').addEventListener('click', (e) => { e.stopPropagation(); toast(e.currentTarget.title); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(false); });

function ask(title, body, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const card = modal(`<h3>${esc(title)}</h3><p>${body}</p><div class="modal-actions"><button class="btn ghost" data-x="no">Cancel</button><button class="btn ${danger ? 'danger' : 'hot'}" data-x="yes">${esc(okLabel)}</button></div>`, {
      onClose: () => { if (!done) resolve(false); },
    });
    card.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => { done = true; closeModal(); resolve(b.dataset.x === 'yes'); }));
  });
}

function show(screen) {
  for (const id of ['home', 'lobby', 'table']) {
    const el = document.getElementById(id);
    const on = id === screen;
    if (el.hidden === !on) continue;
    el.hidden = !on;
    if (on) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  }
  if (screen !== 'table') keepAwake(false);
  if (screen !== 'table') hideBomb(true);
}

const P = (id) => app.pub?.players.find((p) => p.id === id);
const isHost = () => app.role === 'host';
const myTurn = () => app.pub && app.pub.phase === 'play' && app.pub.turn === app.me.key && app.pub.stage === 'act';
const amIn = () => { const p = P(app.me.key); return p && !p.out && !p.spectator && app.pub.order.includes(p.id); };
const nameOf = (id) => (id === app.me.key ? 'You' : P(id)?.name || 'Someone');
const cname = (k) => CARDS[k]?.name || k;
const isAre = (id) => (id === app.me.key ? 'You are' : `${nameOf(id)} is`);

function cardHtml(k, { id = null, cls = '', small = true } = {}) {
  if (!k) return `<div class="card back ${cls}"></div>`;
  const c = CARDS[k];
  return `<div class="card t-${c.tone} ${cls}" ${id != null ? `data-card="${id}"` : ''} data-k="${k}">
    <span class="corner">${c.pack === 'chaos' ? 'CHAOS' : c.pack === 'mega' ? 'MEGA' : ''}</span>
    <div class="art-box">${cardArt(k)}</div>
    <div class="ct">${esc(c.name)}</div>
    ${small ? '' : `<div class="cx">${esc(c.text)}</div>`}
  </div>`;
}

function catFor(p, extra = '') {
  if (!p) return '';
  const pub = app.pub;
  let mood = 'normal';
  if (p.out) mood = 'dead';
  else if (pub && pub.bomb && pub.bomb.pid === p.id) mood = 'scared';
  else if (pub && pub.winner === p.id) mood = 'happy';
  return catSvg(p.avatar, mood, extra);
}

function renderHome() {
  $('#heroLogo').innerHTML = logo('meowltdown', { text: true });
  $$('.brand-ic').forEach((e) => { e.innerHTML = logo('meowltdown'); });
  $('#nameIn').value = app.me.name;
  const [f, a] = app.me.avatar.split('-').map(Number);
  $('#furRow').innerHTML = FURS.map((c, i) => `<button type="button" data-fur="${i}" class="${i === f ? 'on' : ''}" style="background:linear-gradient(135deg, ${c[0]}, ${c[1]})" aria-label="fur ${i + 1}"></button>`).join('');
  $('#accRow').innerHTML = ACCS.map((n, i) => `<button type="button" data-acc="${i}" class="${i === a ? 'on' : ''}">${catSvg(`${f}-${i}`)}${esc(n)}</button>`).join('');
  $('#colorRow').innerHTML = COLORS.map((c) => `<button type="button" data-col="${c}" style="background:${c}" class="${c === app.me.color ? 'on' : ''}" aria-label="colour ${c}"></button>`).join('');
  $('#mePreview').innerHTML = catSvg(app.me.avatar, 'happy');
  $('#mePreview').style.setProperty('--c', app.me.color);
  const code = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code) $('#codeIn').value = code;
  const saved = savedHost();
  $('#resumeBox').hidden = !saved;
  if (saved) $('#resumeCode').textContent = saved.code;
}

function saveMe() {
  app.me.name = $('#nameIn').value.trim().slice(0, 20);
  store('l', 'mow-me', { name: app.me.name, avatar: app.me.avatar, color: app.me.color });
}

function needName() {
  saveMe();
  if (app.me.name) return true;
  toast('Type your name first.', 'bad');
  $('#nameIn').focus();
  gsap.fromTo('#nameIn', { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(3, 0.3)' });
  return false;
}

function setUrl(code) {
  const u = new URL(location.href);
  if (code) u.searchParams.set('room', code);
  else u.searchParams.delete('room');
  u.searchParams.delete('bots');
  history.replaceState(null, '', u);
}

function resetView() {
  app.seq = -1;
  app.pub = null;
  app.lastN = -1;
  app.queue = [];
  app.sel = [];
  app.shownWin = 0;
}

function beginHost(resume) {
  const code = resume ? resume.code : randomCode();
  if (resume) app.me.key = resume.me.key;
  store('s', 'mow-key', app.me.key);
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
    bots: Math.min(39, parseInt(params.get('bots') || '0', 10) || 0),
    onUpdate: (pub, mine) => { onMine(mine); onPub(pub); },
    onFx,
    onReady: () => { $('#netNote').textContent = 'Room is open. Share the code!'; },
    onError: () => { $('#netNote').textContent = 'Network trouble. Retrying…'; toast('Could not reach the game servers. Check your connection.', 'bad'); },
    onToast: (m, k) => toast(m, k),
    onVoice: (m) => V.handle(m),
  });
  hit('host', { room: code });
}

function beginJoin(code) {
  app.role = 'client';
  app.code = code;
  resetView();
  app.welcomed = false;
  document.body.classList.remove('is-host');
  store('s', 'mow-seat', { code });
  setUrl(code);
  toast(`Joining room ${code}…`);
  const join = () => app.client && app.client.send({ t: 'join', key: app.me.key, name: app.me.name, avatar: app.me.avatar, color: app.me.color });
  app.client = joinHost(code, {
    onOpen: () => join(),
    onData: (m) => {
      if (!m) return;
      if (m.t === 'welcome') {
        if (!app.welcomed) { toast('You are in the lab! 🧪', 'good'); hit('join', { room: code }); }
        app.welcomed = true;
        if (m.spectator) toast('A round is running, so you are watching. You will be dealt in next round.');
      } else if (m.t === 'state') {
        if (m.seq < app.seq && m.seq > 2) return;
        app.seq = m.seq;
        onPub(m.pub);
      } else if (m.t === 'hand') {
        onMine(m);
        if (app.pub) renderTable();
      } else if (m.t === 'fx') onFx(m);
      else if (m.t === 'vo') V.handle(m);
      else if (m.t === 'rejoin') join();
      else if (m.t === 'kicked') { toast('The host removed you from the room.', 'bad'); leaveRoom(true); }
      else if (m.t === 'err') errToast(m.err);
    },
    onClose: () => { if (app.welcomed) toast('Connection hiccup, reconnecting…'); },
    onError: (e) => {
      toast(e.type === 'peer-unavailable' ? `Room ${code} was not found. Check the code.` : 'Could not connect. Check your connection.', 'bad');
      leaveRoom(true);
    },
  });
}

function leaveRoom(silent) {
  V.leaveCall(true);
  V.stopPTT();
  if (app.host) { app.host.destroy(); app.host = null; }
  if (app.client) {
    if (!silent) app.client.send({ t: 'leave' });
    const c = app.client;
    app.client = null;
    setTimeout(() => c.destroy(), 150);
  }
  store('s', 'mow-seat', null);
  app.role = null;
  document.body.classList.remove('is-host', 'danger');
  resetView();
  setUrl(null);
  closeModal();
  F.geiger(0);
  setMood('lobby');
  renderHome();
  show('home');
}

const ERRS = {
  'bad-combo': 'That is not a valid combo. Play 2 or 3 matching cards, or 5 different ones.',
  'not-playable': 'That card can only be played at a special moment.',
  'empty-target': 'That player has no cards.',
  'empty-discard': 'The discard pile has nothing to take.',
  'no-hiss': 'You have no Hiss! card.',
};
function errToast(e) { if (ERRS[e]) toast(ERRS[e], 'bad'); }

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
      if (!app.client || !app.pub || app.pub.turnId !== m.ctx || n++ >= 3) return;
      app.client.send(m);
      setTimeout(again, 2200);
    };
    setTimeout(again, 2200);
  }
  return res;
}

function onMine(m) {
  const prev = app.mine;
  app.mine = { cards: m.cards || [], priv: m.priv || null, top: m.top || null };
  const ids = new Set(app.mine.cards.map((c) => c.i));
  app.sel = app.sel.filter((i) => ids.has(i));
  const pv = app.mine.priv;
  if (pv && pv.n !== app.lastPriv) {
    const first = app.lastPriv === 0 && prev.cards.length === 0;
    app.lastPriv = pv.n;
    if (!first) enqueue(() => privShow(pv), 'priv');
  }
}

function onPub(pub) {
  const prev = app.pub;
  app.pub = pub;
  app.recvAt = performance.now();
  if (pub.phase === 'lobby') {
    app.inGame = false;
    app.lastN = -1;
    hideBomb(true);
    show('lobby');
    renderLobby();
    setMood('lobby');
    return;
  }
  if (!app.inGame) {
    app.inGame = true;
    if (P(app.me.key) && !P(app.me.key).spectator) hit('game', { room: pub.code, players: pub.players.filter((x) => !x.bot && !x.spectator).length });
  }
  show('table');
  keepAwake(pub.phase !== 'over');
  if (prev && prev.phase !== 'lobby') {
    const known = new Set(prev.players.map((x) => x.id));
    for (const x of pub.players) if (!known.has(x.id) && x.id !== app.me.key) { toast(`${x.name} joined${x.spectator ? ' as a spectator' : ''}`, 'good'); sfx.pop(); }
  }
  const fresh = app.lastN < 0;
  for (const e of pub.log) {
    if (e.n <= app.lastN) continue;
    if (!fresh || pub.log.length - pub.log.indexOf(e) <= 0) enqueue(() => animate(e), e.k);
  }
  if (pub.log.length) app.lastN = Math.max(app.lastN, pub.log[pub.log.length - 1].n);
  if (fresh && pub.log.length && pub.log[0].k === 'deal' && pub.log.length < 3) enqueue(() => animate(pub.log[0]), 'deal');
  renderTable();
  if (!app.busy) syncBomb();
  const danger = pub.stage === 'defuse' || pub.stage === 'doom' || (pub.stage === 'place' && pub.bomb);
  setMood(pub.phase === 'over' ? 'victory' : danger || pub.sudden ? 'tension' : 'play');
  if (pub.phase === 'over' && app.shownWin !== pub.round && !app.queue.length && !app.busy) showWin();
}

function enqueue(fn, tag) {
  app.queue.push({ fn, tag });
  if (!app.busy) pump();
}

async function pump() {
  app.busy = true;
  while (app.queue.length) {
    const { fn } = app.queue.shift();
    try { await fn(app.queue.length > 3); } catch (e) { console.error(e); }
  }
  app.busy = false;
  syncBomb();
  renderTable();
  if (app.pub && app.pub.phase === 'over' && app.shownWin !== app.pub.round) showWin();
}

function seatEl(pid) {
  if (pid === app.me.key && amIn()) return $('#hand');
  return document.querySelector(`.seat[data-pid="${pid}"] .ava`) || $('#deck');
}

function rectOf(el) {
  if (!el) return { x: innerWidth / 2, y: innerHeight / 2, w: 100 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
}

function cardW() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')) || 112;
}

function flyCard(k, from, to, { dur = 0.7, flip = false, scale0 = 0.5, scale1 = 1, arc = -120, spin = 0, keep = false, cls = '', delay = 0 } = {}) {
  return new Promise((resolve) => {
    const layer = $('#flyLayer');
    const wrap = document.createElement('div');
    wrap.innerHTML = cardHtml(flip ? k : k, { cls: (flip || !k ? '' : '') + ' ' + cls, small: true });
    const el = wrap.firstElementChild;
    if (!k) el.classList.add('back');
    const w = cardW();
    el.style.width = w + 'px';
    layer.appendChild(el);
    const a = typeof from.x === 'number' ? from : rectOf(from);
    const b = typeof to.x === 'number' ? to : rectOf(to);
    const h = w * 4 / 3;
    if (flip) el.classList.add('back');
    const o = { t: 0 };
    const cx = (a.x + b.x) / 2;
    const cy = Math.min(a.y, b.y) + arc;
    gsap.set(el, { x: a.x - w / 2, y: a.y - h / 2, scale: scale0, rotation: (Math.random() - 0.5) * 20 });
    gsap.to(o, {
      t: 1, duration: F.calm() ? dur * 0.6 : dur, delay, ease: 'power2.inOut',
      onUpdate: () => {
        const t = o.t;
        const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x;
        const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y;
        gsap.set(el, { x: x - w / 2, y: y - h / 2, scale: scale0 + (scale1 - scale0) * t, rotation: spin * t + (1 - t) * 8, rotationY: flip ? 180 * (1 - Math.min(1, t * 1.6)) : 0 });
        if (flip && t > 0.32 && el.classList.contains('back')) el.classList.remove('back');
      },
      onComplete: () => {
        if (!keep) el.remove();
        resolve(el);
      },
    });
  });
}

function banner(title, sub = '', color = '#ffd23d', hold = 1.1) {
  const b = $('#banner');
  b.innerHTML = `<div class="bt" style="--bc:${color}">${esc(title)}</div>${sub ? `<div class="bsub">${esc(sub)}</div>` : ''}`;
  const t = b.querySelector('.bt');
  gsap.killTweensOf([b, t]);
  gsap.set(b, { opacity: 1 });
  if (rich()) gsap.fromTo(t, { scale: 2.6, opacity: 0, rotation: -6, filter: 'blur(8px)' }, { scale: 1, opacity: 1, rotation: 0, filter: 'blur(0px)', duration: 0.42, ease: 'back.out(2.2)', clearProps: 'filter' });
  else gsap.fromTo(t, { scale: 2.6, opacity: 0, rotation: -6 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.42, ease: 'back.out(2.2)' });
  gsap.to(b, { opacity: 0, delay: hold, duration: 0.4 });
}

function pulse(el, color = '#ffd23d') {
  if (!el) return;
  gsap.fromTo(el, { boxShadow: `0 0 0 0 ${color}` }, { boxShadow: `0 0 0 18px rgba(0,0,0,0)`, duration: 0.7, clearProps: 'boxShadow' });
  gsap.fromTo(el, { scale: 1.2 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.4)', clearProps: 'scale' });
}

function shakeSeat(pid, power = 8) {
  const s = document.querySelector(`.seat[data-pid="${pid}"]`);
  if (s) F.shake(s, power, 0.6);
}

const pendingC = () => rectOf($("#pendingSlot").firstElementChild || $("#pendingSlot"));
const coreC = () => rectOf($('#deck'));

async function animate(e, fast) {
  const sp = fast ? 0.45 : 1;
  const by = e.by;
  switch (e.k) {
    case 'deal': {
      sfx.deal();
      banner('REACTOR ONLINE', `${e.n} cats in the lab · ${e.deck} cards in the core`, '#39ff88', 1.6);
      F.ring(coreC().x, coreC().y, { r0: 20, r1: 420, life: 50, color: '#39ff88', w: 14 });
      const ids = app.pub.order.slice(0, 40);
      ids.forEach((pid, i) => flyCard(null, coreC(), rectOf(seatEl(pid)), { dur: 0.55, delay: i * 0.04, scale0: 0.6, scale1: 0.4, arc: -60, spin: 360 }));
      await wait(600 + ids.length * 40);
      break;
    }
    case 'play': {
      sfx.play();
      const src = rectOf(seatEl(by));
      const slot = $('#pendingSlot');
      const n = e.kinds.length;
      const w = cardW() * 1.15;
      const base = rectOf(slot);
      await Promise.all(e.kinds.map((k, i) => flyCard(k, src, { x: base.x + (i - (n - 1) / 2) * (w + 6), y: base.y }, { dur: 0.55 * sp, flip: by !== app.me.key, scale0: 0.5, scale1: 1.15, spin: 0, arc: -80, delay: i * 0.06 })));
      renderPending();
      const c = pendingC();
      const k = e.kinds[0];
      const col = { hiss: '#ff2a4a', nap: '#8fb6ff', overload: '#ffd23d', target: '#ff4d6a', peek: '#39ff88', recal: '#ff5ea8', scramble: '#b89cff', bribe: '#4cc9ff', reverse: '#ff5ea8', bottom: '#ffb020', contain: '#9dbf7f' }[k] || '#ffd23d';
      F.ring(c.x, c.y, { r0: 20, r1: 180, life: 30, color: col, w: 8 });
      F.sparkle(c.x, c.y, [col, '#fff']);
      const t = e.type === 'single' ? cname(k) : e.type === 'pair' ? 'Pair!' : e.type === 'triple' ? 'Triple!' : 'Five-card combo!';
      const tgt = e.target ? ` → ${nameOf(e.target)}` : '';
      logLine(`${nameOf(by)} played ${t}${tgt}${e.name ? ` (asks for ${cname(e.name)})` : ''}`);
      if (e.target) {
        const ts = document.querySelector(`.seat[data-pid="${e.target}"]`);
        if (ts) { ts.classList.add('target'); setTimeout(() => ts.classList.remove('target'), 1600); }
      }
      await wait(250 * sp);
      break;
    }
    case 'hiss': {
      const src = rectOf(seatEl(by));
      const c = pendingC();
      sfx.hiss();
      await flyCard('hiss', src, c, { dur: 0.35 * sp, flip: by !== app.me.key, scale0: 0.6, scale1: 1.15, arc: -40, spin: -12 });
      sfx.stamp();
      F.ring(c.x, c.y, { r0: 30, r1: 340, life: 34, color: '#ff2a4a', w: 16, fill: 'rgba(255,40,70,.3)' });
      F.sparks(c.x, c.y, { n: 60, colors: ['#ff2a4a', '#ff9ab0', '#fff'], speed: 9, life: 34 });
      F.shake($('#arena'), 9, 0.5);
      F.flash('#ff2a4a', 0.35, 0.25);
      const slot = $('#pendingSlot');
      const st = document.createElement('div');
      st.className = 'stamp' + (e.cancel ? '' : ' blue');
      st.textContent = e.cancel ? (e.depth > 1 ? 'BLOCKED AGAIN' : 'BLOCKED') : 'BACK ON';
      slot.appendChild(st);
      gsap.fromTo(st, { scale: 3.2, opacity: 0, rotation: -30 }, { scale: 1, opacity: 1, rotation: -14 + (Math.random() - 0.5) * 10, duration: 0.28, ease: 'power4.in' });
      logLine(`${nameOf(by)} hissed! ${e.cancel ? 'The action is blocked.' : 'The action is back on.'}`, 'hiss');
      if (by === app.me.key) F.buzz(40);
      await wait(400 * sp);
      break;
    }
    case 'cancelled': {
      const slot = $('#pendingSlot');
      const cards = [...slot.querySelectorAll('.card, .stamp')];
      sfx.lose();
      gsap.to(cards, { scale: 0.2, rotation: () => (Math.random() - 0.5) * 220, y: 140, x: 90, opacity: 0, filter: 'grayscale(1)', duration: 0.55 * sp, ease: 'power2.in', stagger: 0.04 });
      logLine(`Cancelled: ${e.card ? cname(e.card) : 'the combo'} fizzled.`, 'hiss');
      await wait(560 * sp);
      clearPending();
      break;
    }
    case 'nap': {
      await toDiscard();
      sfx.nap();
      const r = rectOf(seatEl(by));
      F.zzz(r.x + 20, r.y - 30);
      const a = seatEl(by);
      if (a && a.id !== 'hand') gsap.fromTo(a, { rotation: 0 }, { rotation: -14, yoyo: true, repeat: 1, duration: 0.5, ease: 'sine.inOut' });
      banner('CATNAP', `${nameOf(by)} skips the draw`, '#8fb6ff', 0.8);
      logLine(`${nameOf(by)} took a catnap and skipped drawing.`);
      await wait(700 * sp);
      break;
    }
    case 'overload': {
      await toDiscard();
      const a = rectOf(seatEl(by));
      const b = rectOf(seatEl(e.to));
      sfx.zap();
      F.lightning(a, b, { color: '#ffd23d', life: 30, spread: 55 });
      setTimeout(() => F.lightning(coreC(), b, { color: '#7fd8ff', life: 22, spread: 35 }), 120);
      F.flash('#ffe27a', 0.3, 0.3);
      shakeSeat(e.to, 12);
      const s = document.querySelector(`.seat[data-pid="${e.to}"]`);
      if (s) {
        const tag = document.createElement('div');
        tag.className = 'tl';
        tag.textContent = '+2';
        s.appendChild(tag);
        gsap.fromTo(tag, { scale: 4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(3)', onComplete: () => setTimeout(() => tag.remove(), 900) });
      }
      banner('+2 TURNS', e.carry ? `${nameOf(e.to)} now has ${e.n} turns in a row (2 + ${e.carry} passed on)` : `${nameOf(e.to)} takes 2 turns in a row`, '#ffd23d', 1);
      logLine(`${nameOf(by)} overloaded ${nameOf(e.to)}: ${e.n} turns in a row${e.carry ? ` (2 + ${e.carry} passed on)` : ''}!`, 'bad');
      if (e.to === app.me.key) F.buzz([40, 40, 80]);
      await wait(900 * sp);
      break;
    }
    case 'reverse': {
      await toDiscard();
      sfx.reverse();
      const ring = $('#tableTop');
      $('#dirRing').classList.toggle('rev', e.dir < 0);
      gsap.fromTo(ring, { scale: 1.04, filter: 'brightness(1.8)' }, { scale: 1, filter: 'brightness(1)', duration: 0.9 * sp, ease: 'elastic.out(1, 0.4)', clearProps: 'transform,filter' });
      const c = coreC();
      F.ring(c.x, c.y, { r0: 260, r1: 40, life: 34, color: '#ff5ea8', w: 10 });
      F.ring(c.x, c.y, { r0: 40, r1: 260, life: 34, color: '#4cc9ff', w: 10 });
      banner('POLARITY REVERSED', 'Turn order flipped', '#ff5ea8', 0.9);
      logLine(`${nameOf(by)} reversed the turn order.`);
      await wait(900 * sp);
      break;
    }
    case 'peek': {
      await toDiscard();
      sfx.peek();
      const a = coreC();
      const b = rectOf(seatEl(by));
      F.lightning(a, b, { color: '#39ff88', life: 18, spread: 6 });
      F.ring(a.x, a.y, { r0: 10, r1: 150, life: 40, color: '#39ff88', w: 4 });
      F.ring(a.x, a.y, { r0: 10, r1: 110, life: 40, color: '#39ff88', w: 3 });
      logLine(`${nameOf(by)} ${e.alter ? 'is recalibrating' : 'took a Geiger peek at'} the top of the reactor.`);
      await wait(500 * sp);
      break;
    }
    case 'alter': {
      const d = $('#deck .deck-stack');
      gsap.fromTo(d, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(3, 0.2)' });
      sfx.shuffle();
      logLine(`${nameOf(by)} recalibrated the top of the reactor.`);
      await wait(400 * sp);
      break;
    }
    case 'scramble': {
      await toDiscard();
      await riffle();
      logLine(`${nameOf(by)} scrambled the reactor.`);
      break;
    }
    case 'steal': {
      await toDiscard();
      const a = rectOf(seatEl(e.from));
      const b = rectOf(seatEl(e.to));
      if (e.ok) {
        sfx.steal();
        await flyCard(e.card || null, a, b, { dur: 0.6 * sp, spin: 540, scale0: 0.6, scale1: 0.6, arc: -140 });
        F.sparkle(b.x, b.y, ['#4cc9ff', '#fff']);
        pulse(seatEl(e.to), '#4cc9ff');
        const what = e.type === 'bribe' ? 'was bribed and handed over a card to' : e.type === 'triple' ? `handed a ${cname(e.card)} to` : 'had a card swiped by';
        logLine(`${nameOf(e.from)} ${what} ${nameOf(e.to)}.`, 'good');
      } else {
        sfx.lose();
        F.floatEmoji('🙅', 'Nothing!', seatEl(e.from));
        logLine(`${nameOf(e.to)} came up empty from ${nameOf(e.from)}.`);
      }
      await wait(200 * sp);
      break;
    }
    case 'salvage': {
      clearPending();
      sfx.steal();
      await flyCard(e.card, rectOf($('#discardPile')), rectOf(seatEl(by)), { dur: 0.7 * sp, scale0: 0.8, scale1: 0.6, arc: -160 });
      logLine(`${nameOf(by)} salvaged a ${cname(e.card)} from the discard pile.`, 'good');
      break;
    }
    case 'draw': {
      clearPending();
      sfx.draw();
      gsap.fromTo('#deck .deck-stack', { y: -6 }, { y: 0, duration: 0.35, ease: 'back.out(3)' });
      const mine = by === app.me.key;
      const from = e.bottom ? { x: coreC().x, y: coreC().y + 40 } : coreC();
      await flyCard(null, from, rectOf(seatEl(by)), { dur: 0.5 * sp, scale0: 0.95, scale1: mine ? 1 : 0.5, arc: -50, spin: mine ? 0 : 200 });
      if (!mine) pulse(seatEl(by), '#39ff88');
      logLine(`${nameOf(by)} drew${e.bottom ? ' from the bottom' : ''} and survived.`);
      break;
    }
    case 'meltdown':
      await meltdownSeq(e, sp);
      break;
    case 'cool':
      await coolSeq(e, sp);
      break;
    case 'place':
      await placeSeq(e, sp);
      break;
    case 'hold': {
      const card = $('#bsCard .card');
      sfx.riser(0.6);
      if (card) gsap.to(card, { scale: 0.3, y: 200, opacity: 0, duration: 0.6 });
      banner('STREAKING!', `${nameOf(by)} is holding a live Meltdown`, '#ff8a1f', 1.2);
      logLine(`${nameOf(by)} is streaking with a live Meltdown in hand!`, 'bad');
      await wait(700);
      hideBomb();
      break;
    }
    case 'critflip':
      await critFlipSeq(e, sp);
      break;
    case 'critical':
      await meltdownSeq({ ...e, crit: true }, sp);
      break;
    case 'boom':
      await boomSeq(e, sp);
      break;
    case 'bury': {
      await toDiscard();
      sfx.card();
      const d = coreC();
      await flyCard(null, { x: d.x, y: d.y - 20 }, { x: d.x, y: d.y + 10 }, { dur: 0.6, scale0: 1, scale1: 0.8, arc: -90, spin: 0 });
      F.smoke(d.x, d.y, { n: 6, color: '#5a6b52', spread: 30, rise: 0.6, size: 60, life: 70, alpha: 0.5 });
      logLine(`${nameOf(by)} buried the top card somewhere in the reactor.`);
      break;
    }
    case 'vent': {
      sfx.alarm();
      $('#deck').classList.add('hot');
      banner('REACTOR VENTED', `${e.n} held Meltdown${e.n > 1 ? 's' : ''} sucked back into the core`, '#ff4d1f', 1.4);
      await riffle();
      break;
    }
    case 'sudden':
      sfx.klaxon();
      F.flash('#ff2a1f', 0.8, 0.4);
      banner('SUDDEN DEATH', 'Every turn is now a double draw', '#ff4d1f', 2);
      await wait(1500);
      break;
    case 'empty':
      logLine('The reactor was empty. Turn passes.');
      break;
    case 'left':
      logLine(`${nameOf(by)} left the lab.`, 'bad');
      break;
    case 'win':
      hideBomb();
      await wait(300);
      break;
    default:
      break;
  }
}

function logLine(text, kind = '') {
  const box = $('#logBox');
  const li = document.createElement('div');
  li.className = 'li ' + kind;
  li.textContent = text;
  box.prepend(li);
  while (box.children.length > 14) box.lastElementChild.remove();
  gsap.fromTo(li, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 });
}

function renderPending() {
  const p = app.pub;
  const slot = $('#pendingSlot');
  if (!p || !p.pending) return;
  if (slot.dataset.for === String(p.turnId) || slot.querySelector('.card')) return;
  slot.innerHTML = p.pending.kinds.map((k) => cardHtml(k, { small: true })).join('');
}

function clearPending() {
  $('#pendingSlot').innerHTML = '';
}

async function toDiscard() {
  const slot = $('#pendingSlot');
  const cards = [...slot.querySelectorAll('.card')];
  slot.querySelectorAll('.stamp').forEach((s) => gsap.to(s, { opacity: 0, duration: 0.2 }));
  if (!cards.length) return;
  const d = rectOf($('#discardPile'));
  const proms = cards.map((c, i) => {
    const r = c.getBoundingClientRect();
    const k = c.dataset.k;
    c.style.visibility = 'hidden';
    return flyCard(k, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, d, { dur: 0.35, scale0: 0.9, scale1: 0.95, arc: -30, spin: (Math.random() - 0.5) * 30, delay: i * 0.04 });
  });
  await Promise.all(proms);
  clearPending();
  renderDiscard();
}

async function riffle() {
  sfx.shuffle();
  const c = coreC();
  const layer = $('#flyLayer');
  const w = cardW();
  const els = [];
  for (let i = 0; i < 10; i++) {
    const el = document.createElement('div');
    el.className = 'card back';
    el.style.width = w + 'px';
    layer.appendChild(el);
    gsap.set(el, { x: c.x - w / 2, y: c.y - (w * 2) / 3 - i, rotation: 0 });
    els.push(el);
  }
  const tl = gsap.timeline();
  els.forEach((el, i) => {
    const side = i % 2 ? 1 : -1;
    tl.to(el, { x: c.x - w / 2 + side * w * 0.75, rotation: side * 12, y: `-=${10 + i * 2}`, duration: 0.22, ease: 'power2.out' }, 0);
    tl.to(el, { x: c.x - w / 2, rotation: 0, y: c.y - (w * 2) / 3 - i * 0.6, duration: 0.18, ease: 'power2.in' }, 0.35 + i * 0.035);
  });
  tl.to(els, { scale: 1.06, duration: 0.08, yoyo: true, repeat: 1 }, '>');
  await new Promise((r) => tl.eventCallback('onComplete', r));
  F.sparkle(c.x, c.y, ['#b89cff', '#fff']);
  els.forEach((e) => e.remove());
}

function bombUi(cls) {
  const st = $('#bombStage');
  st._gen = (st._gen || 0) + 1;
  gsap.killTweensOf(st);
  gsap.set(st, { opacity: 1 });
  st.className = 'bomb-stage ' + cls;
  if (st.hidden) {
    st.hidden = false;
    gsap.fromTo(st.querySelector('.bs-vignette'), { opacity: 0 }, { opacity: 1, duration: 0.4 });
  }
  document.body.classList.add('danger');
  return st;
}

function hideBomb(now = false) {
  const st = $('#bombStage');
  st.querySelectorAll('.bs-glow').forEach((g) => { gsap.killTweensOf(g); g.remove(); });
  st.querySelectorAll('.card').forEach((c) => gsap.killTweensOf(c));
  document.body.classList.remove('danger');
  F.geiger(0);
  if (st.hidden) return;
  if (now) { st.hidden = true; return; }
  const gen = st._gen;
  gsap.killTweensOf(st);
  gsap.to(st, { opacity: 0, duration: 0.4, onComplete: () => { if (st._gen !== gen) return; st.hidden = true; gsap.set(st, { opacity: 1 }); } });
}

function landscape() {
  return matchMedia('(orientation: landscape) and (max-height: 560px)').matches;
}

function title(text, sub = '') {
  const side = $('.bs-title2');
  if (landscape()) {
    side.innerHTML = '<div class="bs-title"></div><div class="bs-sub"></div>';
    side.firstChild.textContent = text;
    side.lastChild.textContent = sub;
  }
  const t = landscape() ? side.firstChild : $('#bsTitle');
  $('#bsTitle').textContent = text;
  $('#bsSub').textContent = sub;
  if (rich()) gsap.fromTo(t, { scale: 3, opacity: 0, filter: 'blur(10px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power4.out', clearProps: 'filter' });
  else gsap.fromTo(t, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'power4.out' });
  if (!F.calm()) {
    gsap.fromTo(t, { x: -6 }, { x: 0, duration: 0.05, repeat: 7, yoyo: true, delay: 0.5, ease: 'none' });
  }
}

function pulseGlow(holder, color) {
  const g = document.createElement('div');
  g.className = 'bs-glow';
  g.style.setProperty('--gc', color);
  holder.prepend(g);
  gsap.fromTo(g, { opacity: 0.45, scale: 0.9 }, { opacity: 1, scale: 1.08, repeat: -1, yoyo: true, duration: 0.45, ease: 'sine.inOut' });
}

async function meltdownSeq(e, sp) {
  clearPending();
  const crit = !!e.crit;
  const st = bombUi(crit ? 'crit' : '');
  $('#bsControls').innerHTML = '';
  const holder = $('#bsCard');
  holder.innerHTML = '';
  const target = rectOf(holder);
  const from = e.held ? rectOf(seatEl(e.by)) : coreC();
  sfx.riser(1.1 * sp);
  F.geiger(8);
  const fc = await flyCard(null, from, target, { dur: 0.75 * sp, scale0: 0.5, scale1: 200 / cardW(), arc: -40, keep: true });
  fc.remove();
  holder.innerHTML = cardHtml(crit ? 'critical' : 'meltdown');
  const card = holder.querySelector('.card');
  gsap.fromTo(card, { rotationY: 180, scale: 0.9 }, { rotationY: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)' });
  sfx.flip();
  setTimeout(() => sfx.alarm(), 120);
  F.flash(crit ? '#c25bff' : '#ff3b1f', 0.6, 0.55);
  const c = rectOf(holder);
  F.ring(c.x, c.y, { r0: 60, r1: 600, life: 45, color: crit ? '#c25bff' : '#ff4d1f', w: 20 });
  F.sparks(c.x, c.y, { n: 80, colors: crit ? ['#e6b8ff', '#fff'] : ['#ffd23d', '#ff4d1f', '#fff'], speed: 10, life: 40 });
  F.shake($('.bs-main'), 12, 0.6);
  F.buzz(e.by === app.me.key ? [80, 40, 160] : 30);
  pulseGlow(holder, crit ? 'rgba(194,91,255,.85)' : 'rgba(255,77,31,.85)');
  gsap.to(card, { rotation: 1.5, repeat: -1, yoyo: true, duration: 0.06, ease: 'none' });
  const who = e.by === app.me.key ? 'YOU' : P(e.by)?.name || 'Someone';
  if (crit) title('CRITICAL MASS', `${who === 'YOU' ? 'You drew' : who + ' drew'} it again. Nothing can stop it now.`);
  else title('MELTDOWN!', e.held ? `${who === 'YOU' ? 'Your' : who + "'s"} streaking Meltdown went live with no Coolant left!` : `${who === 'YOU' ? 'You drew' : who + ' drew'} a Meltdown${e.cool ? '' : ' with no Coolant…'}`);
  logLine(`${nameOf(e.by)} drew a ${crit ? 'Critical Mass' : 'Meltdown'}!`, 'bad');
  F.geiger(e.cool ? 14 : 28);
  if (crit) { sfx.klaxon(); }
  await wait(700 * sp);
}

async function coolSeq(e, sp) {
  const holder = $('#bsCard');
  const card = holder.querySelector('.card');
  bombUi('');
  const c = rectOf(holder);
  sfx.whoosh?.();
  await flyCard('coolant', rectOf(seatEl(e.by)), c, { dur: 0.5 * sp, scale0: 0.6, scale1: 1.3, arc: -160, spin: 360 });
  sfx.freeze();
  F.geiger(0);
  F.cryo(c.x, c.y, { scale: innerWidth < 700 ? 0.7 : 1.1 });
  F.flash('#bff4ff', 0.9, 0.8);
  if (card) {
    gsap.killTweensOf(card);
    holder.querySelectorAll('.bs-glow').forEach((g) => { gsap.killTweensOf(g); g.style.setProperty('--gc', 'rgba(120,220,255,.7)'); gsap.to(g, { opacity: 0.7, scale: 1, duration: 0.6 }); });
    card.classList.add('frozen');
    gsap.fromTo(card, { scale: 1.15 }, { scale: 0.92, rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)', boxShadow: '0 0 60px rgba(120,220,255,.9)' });
  }
  bombUi('cooled');
  title('STABILIZED', `${e.by === app.me.key ? 'You' : nameOf(e.by)} used Coolant. The Meltdown goes back into the reactor…`);
  logLine(`${nameOf(e.by)} cooled the Meltdown down!`, 'good');
  F.buzz(20);
  const steamLoop = setInterval(() => { const r = rectOf(holder); F.steam(r.x + (Math.random() - 0.5) * 120, r.y + 60, 2); }, 260);
  setTimeout(() => clearInterval(steamLoop), 4000);
  await wait(900 * sp);
}

async function placeSeq(e, sp) {
  const holder = $('#bsCard');
  const card = holder.querySelector('.card');
  $('#bsControls').innerHTML = '';
  const from = rectOf(holder);
  if (card) card.style.visibility = 'hidden';
  sfx.shimmer();
  await flyCard(e.crit ? 'critical' : null, from, coreC(), { dur: 0.7 * sp, scale0: 200 / cardW(), scale1: 0.9, arc: -120, cls: e.crit ? '' : 'frozen' });
  const d = coreC();
  F.ring(d.x, d.y, { r0: 10, r1: 160, life: 30, color: e.crit ? '#c25bff' : '#4cc9ff', w: 8 });
  F.sparkle(d.x, d.y, e.crit ? ['#e6b8ff', '#fff'] : ['#bff4ff', '#fff']);
  pulse($('#deck .deck-stack'), e.crit ? '#c25bff' : '#4cc9ff');
  logLine(e.crit ? `${nameOf(e.by)} put the Critical Mass back face up at position ${e.pos + 1}.` : `${nameOf(e.by)} hid the Meltdown somewhere in the reactor.`, e.crit ? 'bad' : '');
  hideBomb();
  await wait(300);
}

async function critFlipSeq(e, sp) {
  clearPending();
  const st = bombUi('crit');
  $('#bsControls').innerHTML = '';
  const holder = $('#bsCard');
  holder.innerHTML = '';
  F.geiger(10);
  const fc = await flyCard(null, coreC(), rectOf(holder), { dur: 0.7 * sp, scale0: 0.5, scale1: 200 / cardW(), arc: -40, keep: true });
  fc.remove();
  holder.innerHTML = cardHtml('critical');
  const card = holder.querySelector('.card');
  gsap.fromTo(card, { rotationY: 180 }, { rotationY: 0, duration: 0.6, ease: 'back.out(1.6)' });
  sfx.klaxon();
  const c = rectOf(holder);
  F.ring(c.x, c.y, { r0: 40, r1: 520, life: 50, color: '#c25bff', w: 18 });
  F.flash('#c25bff', 0.6, 0.45);
  F.shake($('.bs-main'), 10, 0.5);
  pulseGlow(holder, 'rgba(194,91,255,.85)');
  title('CRITICAL MASS', `${e.by === app.me.key ? 'You' : nameOf(e.by)} flipped it face up. It goes back in the reactor where everyone can see it. Next time, it ends someone.`);
  logLine(`${nameOf(e.by)} flipped the Critical Mass face up!`, 'bad');
  await wait(900 * sp);
}

async function boomSeq(e, sp) {
  const st = bombUi(e.crit ? 'crit' : '');
  $('#bsControls').innerHTML = '';
  const holder = $('#bsCard');
  const card = holder.querySelector('.card');
  const c = rectOf(holder);
  F.geiger(0);
  if (e.crit) {
    sfx.implode();
    F.implode(c.x, c.y, 1000);
    if (card) gsap.killTweensOf(card);
    if (card) gsap.to(card, { scale: 0.4, rotation: 720, duration: 1, ease: 'power3.in' });
    await wait(1000);
  } else if (card) {
    gsap.killTweensOf(card);
    sfx.riser(0.5);
    gsap.to(card, { scale: 1.25, filter: 'brightness(3) saturate(0)', duration: 0.45, ease: 'power2.in' });
    gsap.to(card, { x: 'random(-10, 10)', y: 'random(-10, 10)', duration: 0.04, repeat: 10, yoyo: true });
    await wait(450);
  }
  if (card) card.style.visibility = 'hidden';
  sfx.boom(!!e.crit);
  F.flash('#fff', 1.1, 1);
  F.explosion(c.x, c.y, { scale: e.crit ? 1.5 : (innerWidth < 700 ? 0.8 : 1.1), tint: e.crit ? 'violet' : 'fire' });
  F.shake($('.bs-main'), e.crit ? 30 : 22, 1.2);
  F.shake($('#arena'), e.crit ? 16 : 12, 1);
  F.buzz([200, 60, 300]);
  const who = e.by === app.me.key ? 'YOU' : (P(e.by)?.name || 'Someone').toUpperCase();
  title(`${who} MELTED DOWN`, e.by === app.me.key ? 'You are out of this round. Stick around and watch the chaos.' : '');
  bombUi(e.crit ? 'crit' : '');
  logLine(`${nameOf(e.by)} melted down! ☢`, 'bad');
  await wait(900);
  renderSeats();
  const seat = document.querySelector(`.seat[data-pid="${e.by}"]`);
  const sc = rectOf(seat?.querySelector('.ava'));
  hideBomb();
  if (seat) {
    F.explosion(sc.x, sc.y, { scale: 0.35, tint: e.crit ? 'violet' : 'fire' });
    sfx.boom(false);
    const m = seat.querySelector('.melted');
    if (m) gsap.fromTo(m, { scale: 4, opacity: 0, rotation: -40 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.35, ease: 'power4.in' });
    const smokeLoop = setInterval(() => { const r = rectOf(seat.querySelector('.ava')); F.embers(r.x, r.y - 10, 3); }, 500);
    setTimeout(() => clearInterval(smokeLoop), 6000);
  }
  if (e.by === app.me.key) sfx.lose();
  await wait(900 * sp);
  void st;
}

function syncBomb() {
  const p = app.pub;
  if (!p || p.phase !== 'play') { hideBomb(); return; }
  const b = p.bomb;
  const mine = b && b.pid === app.me.key;
  const ctl = $('#bsControls');
  const st = $('#bombStage');
  if (!b || !['defuse', 'doom', 'place'].includes(p.stage)) {
    if (!st.hidden && p.stage !== 'after') hideBomb();
    return;
  }
  if (st.hidden) {
    bombUi(b.crit ? 'crit' : p.stage === 'place' && !b.crit ? 'cooled' : '');
    $('#bsCard').innerHTML = cardHtml(b.crit ? 'critical' : 'meltdown', { cls: p.stage === 'place' && !b.crit ? 'frozen' : '' });
    title(b.crit ? 'CRITICAL MASS' : p.stage === 'place' ? 'STABILIZED' : 'MELTDOWN!', '');
  }
  const key = `${p.turnId}:${mine}`;
  if (ctl.dataset.key === key) return;
  ctl.dataset.key = key;
  if (p.stage === 'defuse' && mine) {
    const has = app.mine.cards.some((c) => c.k === 'coolant');
    const streak = p.settings.house.streak && has;
    ctl.innerHTML = has
      ? `<div class="row"><button class="btn cool" data-action="cool">🧊 Use Coolant</button>${streak ? '<button class="btn hot" data-action="hold">😼 Hold it (streak)</button>' : ''}</div><div class="muted small">Coolant is used automatically if the clock runs out.</div>`
      : '<div class="muted">No Coolant in your hand…</div>';
    if (has) gsap.fromTo(ctl.querySelector('.btn'), { scale: 0.6 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1.3, 0.4)' });
  } else if (p.stage === 'place' && mine) {
    const n = p.deck;
    ctl.innerHTML = `<div class="place-ui">
      <div class="place-quick"><button class="btn small ghost" data-pos="0">Top</button><button class="btn small ghost" data-pos="1">2nd</button><button class="btn small ghost" data-pos="2">3rd</button><button class="btn small ghost" data-pos="${n}">Bottom</button><button class="btn small ghost" data-pos="rand">Random</button></div>
      <input id="placeIn" type="range" min="0" max="${n}" value="${Math.floor(n / 2)}">
      <div class="place-lbl"><span>Top</span><span>${n} cards</span><span>Bottom</span></div>
      <div class="place-val" id="placeVal"></div>
      <div class="row"><button class="btn ${b.crit ? 'violet' : 'cool'}" data-action="place">${b.crit ? 'Put it back face up' : 'Hide it here'}</button></div></div>`;
    const upd = () => { const v = +$('#placeIn').value; $('#placeVal').textContent = v === 0 ? 'Very top: the next draw!' : v >= n ? 'At the very bottom' : `${v + 1}${['st', 'nd', 'rd'][v] || 'th'} card from the top`; };
    $('#placeIn').addEventListener('input', () => { upd(); sfx.click(); });
    upd();
  } else if (p.stage === 'place') {
    ctl.innerHTML = `<div class="muted">${esc(isAre(b.pid))} choosing where to hide it…</div>`;
  } else if (p.stage === 'defuse') {
    ctl.innerHTML = `<div class="muted">${esc(isAre(b.pid))} reaching for Coolant…</div>`;
  } else ctl.innerHTML = '';
}

async function privShow(pv) {
  if (pv.k === 'peek' || pv.k === 'alter') {
    if (pv.k === 'alter') return;
    sfx.peek();
    const card = modal(`<h3>📟 Geiger Peek</h3><p class="muted">The top of the reactor, from next draw to third. Only you can see this.</p>
      <div class="peek-row" style="position:relative">${pv.cards.map((k, i) => `<div class="slot">${cardHtml(k, { small: true })}<span>${i === 0 ? 'Next draw' : `#${i + 1}`}</span></div>`).join('') || '<p>The reactor is empty.</p>'}<div class="scanline"></div></div>
      <div class="modal-actions"><button class="btn hot" data-close>Got it</button></div>`, { cls: 'peek' });
    const cards = card.querySelectorAll('.card');
    gsap.fromTo(cards, { rotationY: 180, y: 40, opacity: 0 }, { rotationY: 0, y: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: 'back.out(1.5)' });
    gsap.fromTo(card.querySelector('.scanline'), { top: '0%', opacity: 1 }, { top: '100%', opacity: 0, duration: 1.2, ease: 'power1.inOut' });
    if (pv.cards.some((k) => k === 'meltdown' || k === 'critical')) setTimeout(() => sfx.alarm(), 500);
    return;
  }
  if (pv.k === 'drew') {
    sfx.safe();
    return;
  }
  if (pv.k === 'got') { toast(`You got: ${cname(pv.cards[0])}`, 'good'); sfx.select(); }
  if (pv.k === 'lost') { toast(`You lost: ${cname(pv.cards[0])}`, 'bad'); }
}

function openAlter() {
  const p = app.pub;
  const pv = app.mine.priv;
  if (!pv || pv.k !== 'alter') return;
  let order = pv.cards.map((_, i) => i);
  const draw = () => {
    const card = modal(`<h3>🎛️ Recalibrate</h3><p class="muted">Rearrange the top of the reactor. Leftmost is drawn next.</p>
      <div class="peek-row">${order.map((i, pos) => `<div class="slot">${cardHtml(pv.cards[i], { small: true })}<div class="arrows"><button data-mv="${pos}:-1" ${pos === 0 ? 'disabled' : ''}>◀</button><button data-mv="${pos}:1" ${pos === order.length - 1 ? 'disabled' : ''}>▶</button></div></div>`).join('')}</div>
      <div class="modal-actions"><button class="btn hot" data-x="ok">Lock it in</button></div>`, { lock: true, cls: 'alter' });
    $('#modal')._tag = 'alter:' + p.turnId;
    card.querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', () => {
      const [pos, d] = b.dataset.mv.split(':').map(Number);
      [order[pos], order[pos + d]] = [order[pos + d], order[pos]];
      sfx.card();
      draw();
    }));
    card.querySelector('[data-x="ok"]').addEventListener('click', () => { closeModal(); act('alter', { order }); });
  };
  draw();
}

function openSalvage() {
  const p = app.pub;
  const kinds = p.discardKinds.filter((k) => k !== 'meltdown' && k !== 'critical');
  const card = modal(`<h3>♻️ Salvage</h3><p class="muted">Five different cards! Take any card from the discard pile.</p><div class="name-grid">${kinds.map((k) => `<div data-salv="${k}">${cardHtml(k, { small: true })}</div>`).join('')}</div>`, { lock: true, wide: true });
  $('#modal')._tag = 'salvage:' + p.turnId;
  card.querySelectorAll('[data-salv]').forEach((b) => b.addEventListener('click', () => { closeModal(); act('salvage', { k: b.dataset.salv }); }));
}

function openBury() {
  const p = app.pub;
  const n = Math.max(0, p.deck - 1);
  const card = modal(`<h3>🛢️ Containment</h3><p class="muted">Bury the top card anywhere in the reactor without looking at it.</p>
    <div class="place-ui"><input id="buryIn" type="range" min="0" max="${n}" value="${Math.floor(n / 2)}"><div class="place-lbl"><span>Top</span><span>Bottom</span></div><div class="place-val" id="buryVal"></div></div>
    <div class="modal-actions"><button class="btn hot" data-x="ok">Bury it</button></div>`, { lock: true });
  $('#modal')._tag = 'bury:' + p.turnId;
  const upd = () => { $('#buryVal').textContent = `Position ${+$('#buryIn').value + 1} of ${n + 1}`; };
  card.querySelector('#buryIn').addEventListener('input', upd);
  upd();
  card.querySelector('[data-x="ok"]').addEventListener('click', () => { closeModal(); act('bury', { pos: +$('#buryIn').value }); });
}

function stageModals() {
  const p = app.pub;
  const m = $('#modal');
  if (!p || p.phase !== 'play') return;
  const tag = m.hidden ? null : m._tag;
  const meWho = p.who === app.me.key;
  if (meWho && p.stage === 'alter' && tag !== 'alter:' + p.turnId) openAlter();
  else if (meWho && p.stage === 'salvage' && tag !== 'salvage:' + p.turnId) openSalvage();
  else if (meWho && p.stage === 'bury' && tag !== 'bury:' + p.turnId) openBury();
  else if (tag && !tag.endsWith(':' + p.turnId)) closeModal();
}

let qrFor = null;
function renderLobby() {
  const p = app.pub;
  if (!p) return;
  $('#roomCode').textContent = p.code;
  if (qrFor !== p.code && window.QRCode) {
    qrFor = p.code;
    $('#qr').innerHTML = '';
    try { new window.QRCode($('#qr'), { text: inviteUrl(), width: 160, height: 160, colorDark: '#0b0f0c', colorLight: '#ffffff' }); } catch { /* qr failed */ }
  }
  if (app.role === 'client') $('#netNote').textContent = 'Connected. Waiting for the host to start.';
  const seated = p.players.filter((x) => !x.spectator);
  $('#playerCount').textContent = seated.length;
  const html = p.players.map((x) => `<div class="lp ${x.id === p.hostId ? 'host' : ''}" style="--c:${esc(x.color)}">
      ${isHost() && x.id !== app.me.key ? `<button class="kick" data-kick="${esc(x.id)}" title="Remove">✕</button>` : ''}
      ${catSvg(x.avatar, 'normal')}<div class="nm" style="color:${esc(x.color)}">${esc(x.name)}</div>
      <div class="tagline">${x.id === p.hostId ? '👑 Host' : x.bot ? '🤖 Bot' : x.spectator ? 'Spectator' : 'Ready'}${x.wins ? ` · 🏆 ${x.wins}` : ''}</div></div>`).join('');
  setHtml($('#lobbyPlayers'), html);
  renderSettings();
}

function setHtml(el, html) {
  const key = html.replace(/_\d+([")])/g, '$1');
  if (el._h === key) return;
  el._h = key;
  el.innerHTML = html;
}

function renderSettings() {
  const p = app.pub;
  const st = p.settings;
  const host = isHost();
  const packIcon = { chaos: cardArt('reverse'), mega: cardArt('critical'), party: catSvg('5-8', 'happy') };
  const pk = PACKS.map((x) => `<div class="pack ${st.packs[x.id] ? 'on' : ''}" ${host ? `data-pack="${x.id}"` : ''}><div class="pi">${packIcon[x.id]}</div><div><b>${esc(x.name)}</b><p>${esc(x.desc)}</p></div><div class="sw"></div></div>`).join('');
  const hr = HOUSE.map((x) => `<div class="pack ${st.house[x.id] ? 'on' : ''}" ${host ? `data-house="${x.id}"` : ''}><div><b>${esc(x.name)}</b><p>${esc(x.desc)}</p></div><div class="sw"></div></div>`).join('');
  const sel = (k, list, fmt) => `<select data-set="${k}" ${host ? '' : 'disabled'}>${list.map((v) => `<option value="${v}" ${+st[k] === v ? 'selected' : ''}>${fmt(v)}</option>`).join('')}</select>`;
  const n = p.players.filter((x) => !x.spectator).length;
  const plan = p.plan;
  const html = `<h2>Expansion packs</h2>${pk}
    <div class="sect">House rules</div>${hr}
    <div class="sect">Tuning</div>
    <div class="set-row">Starting hand ${sel('hand', [4, 5, 6, 7, 8, 9], (v) => `${v} cards`)}</div>
    <div class="set-row">Hiss! window ${sel('reactSecs', [2, 3, 4, 5, 6], (v) => `${v} s`)}</div>
    <div class="set-row">Turn timer ${sel('turnSecs', [15, 20, 30, 45, 60, 90], (v) => `${v} s`)}</div>
    <div class="sect">Voice</div><div class="pack ${st.voice !== false ? 'on' : ''}" ${host ? 'data-voice="1"' : ''}><div class="pi">🎙</div><div><b>Voice chat</b><p>Hold-to-talk voice messages and a live call through the game relay. Everyone can mute anyone.</p></div><div class="sw"></div></div>
    ${st.house.sudden ? `<div class="set-row">Sudden death after ${sel('suddenMins', [3, 5, 8, 10, 15, 20], (v) => `${v} min`)}</div>` : ''}
    <div class="deck-info">Reactor for ${n} player${n === 1 ? '' : 's'}: ${plan.copies} deck cop${plan.copies === 1 ? 'y' : 'ies'}, ${plan.melt} Meltdown${plan.melt === 1 ? '' : 's'}${plan.crit ? ' + 1 Critical Mass' : ''}, ${plan.coolDeck} spare Coolant. ${n > plan.maxPlayers ? '<b style="color:var(--red)">Turn on Party Scaling for more than 5 players.</b>' : ''}${n > 15 && st.packs.party ? ' Big room: turn timer and faster Hiss! window are on.' : ''}</div>
    ${host ? `<div class="start-row"><button class="btn ghost" data-action="addbot">+ Bot</button><button class="btn big hot" data-action="start" ${n < 2 ? 'disabled' : ''}>☢ Start the reactor</button></div>` : '<p class="muted">Only the host can change these.</p>'}`;
  setHtml($('#settingsBox'), html);
}

function inviteUrl() {
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('room', app.code);
  return u.toString();
}

function layoutSeats(again = false) {
  const p = app.pub;
  const arena = $('#arena');
  const W = arena.clientWidth;
  const H = arena.clientHeight;
  const ids = p.order.length ? p.order : p.players.filter((x) => !x.spectator).map((x) => x.id);
  const n = ids.length;
  const meIdx = Math.max(0, ids.indexOf(app.me.key));
  const phone = W < 820 || landscape();
  const box = $('#seats');
  box.classList.toggle('compact', n > (phone ? 6 : 10) || (landscape() && H < 380));
  box.classList.toggle('tiny', n > (landscape() ? 8 : phone ? 12 : 22));
  const land = landscape();
  const cx = W / 2;
  const cy = H * (land ? 0.5 : phone ? 0.52 : 0.48);
  const sr = box.classList.contains('tiny') ? 30 : box.classList.contains('compact') ? 38 : 48;
  const hh = Math.max(40, Math.min(H * (land ? 0.34 : phone ? 0.38 : 0.39), cy - sr, H - cy - sr - 18));
  const hw = land ? W * 0.43 : phone ? W * 0.41 : Math.min(W * 0.42, hh * 1.9 + 140);
  const tw = land ? hw * 1.42 : Math.max(hw * 1.2, (hw - sr - 16) * 2);
  const th = land ? hh * 1.42 : Math.max(hh * 1.1, (hh - sr - 26) * 2);
  const top = $('#tableTop');
  if (top) Object.assign(top.style, { left: `${cx - tw / 2}px`, top: `${cy - th / 2}px`, width: `${tw}px`, height: `${th}px` });
  const st = $('#status');
  const deckH = $('#deck')?.offsetHeight || 120;
  const room = th / 2 - deckH / 2 - 14;
  const inDock = land || phone || room < 54;
  if (document.body.classList.contains('status-in-dock') !== inDock) {
    document.body.classList.toggle('status-in-dock', inDock);
    if (!again) return layoutSeats(true);
  }
  if (st) st.style.top = inDock ? '' : `${Math.max(8, cy - th / 2 + 14)}px`;
  const POW = 2 / 7;
  const STEPS = 960;
  const pts = [];
  let total = 0;
  for (let k = 0; k <= STEPS; k++) {
    const a = Math.PI / 2 + (k / STEPS) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const pt = { x: cx + Math.sign(c) * Math.abs(c) ** POW * hw, y: cy + Math.sign(s) * Math.abs(s) ** POW * hh };
    if (k) total += Math.hypot(pt.x - pts[k - 1].x, pt.y - pts[k - 1].y);
    pt.len = total;
    pts.push(pt);
  }
  return ids.map((id, i) => {
    const want = (((i - meIdx + n) % n) / n) * total;
    let j = 0;
    while (j < STEPS - 1 && pts[j + 1].len <= want) j++;
    const a0 = pts[j];
    const a1 = pts[j + 1];
    const f = a1.len > a0.len ? Math.min(1, Math.max(0, (want - a0.len) / (a1.len - a0.len))) : 0;
    return { id, x: a0.x + (a1.x - a0.x) * f, y: a0.y + (a1.y - a0.y) * f };
  });
}

function renderSeats() {
  const p = app.pub;
  const pos = layoutSeats();
  const box = $('#seats');
  const keep = new Set();
  for (const { id, x, y } of pos) {
    const pl = P(id);
    if (!pl) continue;
    keep.add(id);
    let s = box.querySelector(`.seat[data-pid="${id}"]`);
    if (!s) {
      s = document.createElement('div');
      s.className = 'seat';
      s.dataset.pid = id;
      box.appendChild(s);
    }
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.setProperty('--c', pl.color);
    const turn = p.phase === 'play' && p.turn === id;
    s.classList.toggle('turn', turn);
    s.classList.toggle('me', id === app.me.key);
    s.classList.toggle('out', pl.out);
    s.classList.toggle('off', !pl.on && !pl.bot);
    const mood = pl.out ? 'dead' : p.bomb && p.bomb.pid === id ? 'scared' : p.winner === id ? 'happy' : 'normal';
    const sig = `${pl.avatar}|${mood}|${pl.cards}|${pl.wins}|${pl.name}|${turn ? p.turnsLeft : 0}`;
    if (s._sig !== sig) {
      s._sig = sig;
      s.innerHTML = `<div class="ava">${catSvg(pl.avatar, mood)}<span class="cc"><i></i>${pl.cards}</span>${turn && p.turnsLeft > 1 ? `<span class="tl" title="${p.turnsLeft} turns left">${p.turnsLeft} turns</span>` : ''}</div>
        <div class="melted">MELTED</div><div class="nm" style="color:${esc(pl.color)}">${esc(pl.name)}${pl.bot ? ' 🤖' : ''}</div>${pl.wins ? `<div class="wins">🏆 ${pl.wins}</div>` : ''}`;
    }
  }
  for (const s of [...box.children]) if (!keep.has(s.dataset.pid)) s.remove();
}

function renderDiscard() {
  const p = app.pub;
  const html = p.discard.map((k, i) => cardHtml(k, { small: true, cls: '' }).replace('class="card', `style="transform:rotate(${((i * 37) % 22) - 11}deg)" class="card`)).join('');
  setHtml($('#discardPile'), html);
}

function statusText() {
  const p = app.pub;
  const me = app.me.key;
  if (p.phase === 'over') return [`🏆 ${nameOf(p.winner)} ${p.winner === me ? 'win' : 'wins'} the round!`, 'mine'];
  const tn = nameOf(p.turn);
  switch (p.stage) {
    case 'deal': return ['Powering up the reactor…', ''];
    case 'act':
      if (p.turn === me) return [`Your turn${p.turnsLeft > 1 ? ` (${p.turnsLeft} turns left)` : ''}: play cards, then draw from the reactor`, 'mine'];
      return [`${tn}'s turn${p.turnsLeft > 1 ? ` · ${p.turnsLeft} turns left` : ''}`, ''];
    case 'react': {
      const pd = p.pending;
      const has = amIn() && app.mine.cards.some((c) => c.k === 'hiss') && !p.settings.house.nohiss;
      const what = pd ? (pd.type === 'single' ? cname(pd.k) : pd.type) : 'action';
      return [has ? `${nameOf(pd?.by)} played ${what}. Hiss! to ${pd && pd.hiss % 2 ? 'unblock it' : 'block it'}?` : `${nameOf(pd?.by)} played ${what}${pd && pd.hiss % 2 ? ' (blocked)' : '…'}`, has ? 'alert' : ''];
    }
    case 'defuse': return [`${p.bomb?.pid === app.me.key ? 'You' : nameOf(p.bomb?.pid)} drew a Meltdown!`, 'alert'];
    case 'doom': return [`${isAre(p.bomb?.pid)} going critical…`, 'alert'];
    case 'place': return [`${isAre(p.bomb?.pid)} hiding the ${p.bomb?.crit ? 'Critical Mass' : 'Meltdown'}…`, ''];
    case 'give': return p.who === me ? [`You were bribed by ${nameOf(p.giveTo)}. Tap a card to give it.`, 'alert'] : [`${isAre(p.who)} picking a card to give ${p.giveTo === app.me.key ? 'you' : nameOf(p.giveTo)}…`, ''];
    case 'alter': return [`${isAre(p.who)} recalibrating…`, ''];
    case 'salvage': return [`${isAre(p.who)} salvaging the discard pile…`, ''];
    case 'bury': return [`${isAre(p.who)} burying a card…`, ''];
    case 'after': return ['☢ Fallout… clearing the lab', 'alert'];
    default: return ['', ''];
  }
}

function localClassify(ids) {
  const cards = ids.map((i) => app.mine.cards.find((c) => c.i === i)).filter(Boolean);
  const kinds = cards.map((c) => c.k);
  if (!cards.length || kinds.some((k) => k === 'meltdown' || k === 'critical')) return null;
  if (cards.length === 1) return PLAYABLE.has(kinds[0]) && kinds[0] !== 'hiss' ? { type: 'single', k: kinds[0] } : null;
  const same = kinds.every((k) => k === kinds[0]);
  if (same && cards.length === 2) return { type: 'pair' };
  if (same && cards.length === 3) return { type: 'triple' };
  if (cards.length === 5 && new Set(kinds).size === 5) return { type: 'five' };
  return null;
}

const COMBO_TXT = 'Combos: 2 matching cards steal a random card · 3 matching name a card to take · 5 different cards take one from the discard pile.';
const inspector = { open: false, src: null, k: null, id: null, busy: false };

function inspectActions() {
  const p = app.pub;
  const { k, id } = inspector;
  let html = '';
  if (id != null && p && p.phase === 'play' && amIn()) {
    if (p.stage === 'give' && p.who === app.me.key) html += `<button class="btn hot" data-action="in-give">🐟 Give to ${esc(nameOf(p.giveTo))}</button>`;
    else if (k === 'hiss' && p.stage === 'react' && p.pending && !p.settings.house.nohiss) html += '<button class="btn hissbtn" data-action="in-hiss">🙀 HISS!</button>';
    if (myTurn() && k !== 'meltdown' && k !== 'critical') {
      const sel = app.sel.includes(id);
      html += `<button class="btn ${sel ? 'ghost' : 'cool'}" data-action="in-sel">${sel ? '✕ Deselect' : app.sel.length ? '＋ Add to combo' : '✓ Select'}</button>`;
      if (PLAYABLE.has(k) && k !== 'hiss' && !app.sel.length) html += '<button class="btn hot" data-action="in-play">▶ Play now</button>';
    }
  }
  html += '<button class="btn ghost" data-action="uninspect">Close</button>';
  $('#inActions').innerHTML = html;
}

function openInspect(srcEl, k, id) {
  if (!k || !CARDS[k] || inspector.busy) return;
  const c = CARDS[k];
  Object.assign(inspector, { open: true, busy: true, src: srcEl, k, id });
  sfx.flip();
  const glow = { bomb: 'rgba(255,77,31,.6)', crit: 'rgba(194,91,255,.6)', cool: 'rgba(76,201,255,.5)', hiss: 'rgba(255,42,74,.5)' }[c.tone] || 'rgba(255,210,61,.3)';
  $('#inFront').innerHTML = cardHtml(k);
  $('#inBack').innerHTML = `<div class="card t-${c.tone}"><span class="ib-tag">${c.pack === 'chaos' ? 'CHAOS PACK' : c.pack === 'mega' ? 'MEGA BOMB PACK' : 'CORE DECK'}</span>
    <div class="ib-art">${cardArt(k)}</div><div class="ib-name">${esc(c.name)}</div><div class="ib-text">${esc(c.text)}</div>
    ${k === 'meltdown' || k === 'critical' ? '' : `<div class="ib-combo">${COMBO_TXT}</div>`}</div>`;
  const card = $('#inCard');
  card.style.setProperty('--glow', glow);
  inspectActions();
  const ov = $('#inspect');
  gsap.set(card, { clearProps: 'all' });
  ov.hidden = false;
  const big = card.getBoundingClientRect();
  const r = srcEl.getBoundingClientRect();
  const dx = r.left + r.width / 2 - (big.left + big.width / 2);
  const dy = r.top + r.height / 2 - (big.top + big.height / 2);
  srcEl.style.visibility = 'hidden';
  const q = F.calm() ? 0.5 : 1;
  const tl = gsap.timeline({ onComplete: () => { inspector.busy = false; } });
  tl.fromTo('.in-scrim', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0);
  tl.fromTo(card, { x: dx, y: dy, scale: r.width / big.width, rotationY: 0, rotationZ: (Math.random() - 0.5) * 10 }, { x: 0, y: 0, scale: 1, rotationZ: 0, duration: 0.5 * q, ease: 'power3.out' }, 0);
  tl.to(card, { rotationY: 180, duration: 0.65 * q, ease: 'back.inOut(1.3)', onStart: () => sfx.card() }, '+=0.15');
  tl.to(card, { scale: 1.07, duration: 0.32 * q, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<');
  tl.fromTo('#inActions .btn', { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.3, ease: 'back.out(2)' }, '-=0.3');
  if (c.tone === 'bomb' || c.tone === 'crit') {
    tl.call(() => { const b = rectOf(card); F.sparks(b.x, b.y, { n: 30, colors: c.tone === 'crit' ? ['#e6b8ff', '#fff'] : ['#ffd23d', '#ff4d1f'], speed: 6, life: 35 }); sfx.geiger(4); }, null, '-=0.4');
  }
}

function closeInspect(instant = false) {
  if (!inspector.open) return;
  inspector.open = false;
  const ov = $('#inspect');
  const card = $('#inCard');
  const src = inspector.src;
  const done = () => { ov.hidden = true; gsap.set(card, { clearProps: 'all' }); gsap.set('.in-scrim', { clearProps: 'opacity' }); if (src) src.style.visibility = ''; inspector.busy = false; };
  gsap.killTweensOf(card);
  if (instant || !src || !src.isConnected) {
    inspector.busy = true;
    gsap.to(ov, { opacity: 0, duration: 0.18, onComplete: () => { gsap.set(ov, { opacity: 1 }); done(); } });
    return;
  }
  inspector.busy = true;
  sfx.card();
  const s0 = gsap.getProperty(card, 'scale') || 1;
  const big = card.getBoundingClientRect();
  const r = src.getBoundingClientRect();
  const baseW = card.offsetWidth;
  const cx = big.left + big.width / 2 - gsap.getProperty(card, 'x');
  const cy = big.top + big.height / 2 - gsap.getProperty(card, 'y');
  void s0;
  const q = F.calm() ? 0.5 : 1;
  const tl = gsap.timeline({ onComplete: done });
  tl.to('#inActions .btn', { opacity: 0, y: 10, duration: 0.15 }, 0);
  tl.to(card, { rotationY: 0, scale: 1, duration: 0.42 * q, ease: 'power2.inOut' }, 0);
  tl.to(card, { x: r.left + r.width / 2 - cx, y: r.top + r.height / 2 - cy, scale: r.width / baseW, rotationZ: 4, duration: 0.38 * q, ease: 'power3.in' }, '>-0.05');
  tl.to('.in-scrim', { opacity: 0, duration: 0.3 }, '<');
}

function inspectSelect() {
  const id = inspector.id;
  if (id == null || !myTurn()) return;
  if (app.sel.includes(id)) { app.sel = app.sel.filter((x) => x !== id); sfx.deselect(); }
  else { app.sel.push(id); sfx.select(); }
  closeInspect();
  setTimeout(() => { $('#hand')._sig = null; renderTable(); }, 900);
}

function inspectPlayNow() {
  const id = inspector.id;
  if (id == null || !myTurn()) return;
  closeInspect(true);
  app.sel = [id];
  doPlay();
}

function speak(pid, lv) {
  const a = document.querySelector(`.seat[data-pid="${pid}"] .ava`);
  if (!a) return;
  a.style.setProperty('--lv', lv.toFixed(2));
  a.classList.toggle('talk', lv > 0.02);
  clearTimeout(a._talk);
  if (lv > 0.02) a._talk = setTimeout(() => a.classList.remove('talk'), 280);
}

function renderVoice() {
  const p = app.pub;
  const bar = $('#voiceBar');
  const on = !!p && p.phase !== 'lobby' && p.settings.voice !== false && V.supported();
  bar.hidden = !on;
  if (!on) { if (V.isInCall()) V.leaveCall(true); return; }
  const call = V.isInCall();
  $('#callBtn').classList.toggle('on', call);
  $('#callBtn').querySelector('.vt').textContent = call ? 'Leave' : 'Call';
  $('#muteBtn').hidden = !call;
  $('#muteBtn').classList.toggle('muted', V.isSelfMuted());
  $('#muteBtn').querySelector('.vi').textContent = V.isSelfMuted() ? '🔇' : '🎤';
  $('#pttBtn').classList.toggle('rec', V.isRecording());
  let hint = $('.rec-hint');
  if (V.isRecording()) {
    if (!hint) { hint = document.createElement('div'); hint.className = 'rec-hint'; document.body.appendChild(hint); }
    hint.innerHTML = `<i></i>Recording… release to send`;
  } else if (hint) hint.remove();
  const calls = V.inCallSet();
  $$('.seat').forEach((el) => {
    el.classList.toggle('incall', calls.has(el.dataset.pid));
    el.classList.toggle('vmuted', V.isBlocked(el.dataset.pid));
  });
}

function setupPTT() {
  const b = $('#pttBtn');
  let down = false;
  const start = async (e) => {
    e.preventDefault();
    if (down) return;
    down = true;
    sfx.unlock();
    try { b.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const ok = await V.startPTT();
    if (!ok) { down = false; return; }
    if (!down) V.stopPTT();
  };
  const end = () => { if (!down) return; down = false; V.stopPTT(); };
  b.addEventListener('pointerdown', start);
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  b.addEventListener('lostpointercapture', end);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}

function renderDock() {
  const p = app.pub;
  const box = $('#dockActions');
  let html = '';
  if (p.phase === 'over') {
    html = isHost() ? '<button class="btn hot" data-action="again">☢ Play again</button><button class="btn ghost" data-action="tolobby">Lobby</button>' : '<span class="muted">Waiting for the host…</span>';
  } else if (!amIn()) {
    const me = P(app.me.key);
    html = `<span class="muted">${me && me.out ? '☢ You melted down. Spectating until the next round.' : '👀 Spectating. You will be dealt in next round.'}</span>`;
  } else if (p.stage === 'give' && p.who === app.me.key) {
    const c = app.mine.cards.find((x) => x.i === app.sel[0]);
    html = `<button class="btn hot" data-action="give" ${c ? '' : 'disabled'}>🐟 ${c ? `Give ${esc(cname(c.k))}` : 'Tap a card to give'}</button>`;
  } else {
    const hissable = p.stage === 'react' && p.pending && !p.settings.house.nohiss && app.mine.cards.some((c) => c.k === 'hiss');
    if (hissable) html += `<button class="btn hissbtn" data-action="hiss">🙀 HISS!${p.pending.hiss % 2 ? ' (unblock)' : ''}</button>`;
    if (myTurn()) {
      const c = localClassify(app.sel);
      const label = !app.sel.length ? 'Tap a card' : c ? (c.type === 'single' ? `Play ${cname(c.k)}` : `Play ${c.type}`) : 'Not a valid play';
      html += `<button class="btn cool" data-action="play" ${c ? '' : 'disabled'}>${esc(label)}</button>`;
      html += `<button class="btn hot drawbtn" data-action="draw">☢ Draw</button>`;
    }
  }
  setHtml(box, html);
}

function renderHand() {
  const p = app.pub;
  const box = $('#hand');
  const giving = p.stage === 'give' && p.who === app.me.key;
  const cards = [...app.mine.cards].sort((a, b) => ORDER.indexOf(a.k) - ORDER.indexOf(b.k) || a.i - b.i);
  const n = cards.length;
  const W = box.clientWidth || innerWidth;
  const cw = cardW();
  const ov = n > 1 ? Math.min(-0.05, Math.max(-0.42, ((W - 20) / n - cw) / (2 * cw))) : 0;
  box.style.setProperty('--ov', ov);
  const sig = cards.map((c) => c.i).join(',') + '|' + app.sel.join(',') + '|' + giving + '|' + myTurn() + '|' + (app.pub.stage === 'react');
  if (box._sig === sig) return;
  box._sig = sig;
  const have = new Map([...box.querySelectorAll(':scope > .card')].map((el) => [Number(el.dataset.card), el]));
  const keep = new Set();
  cards.forEach((c, idx) => {
    const sel = app.sel.includes(c.i);
    const rot = n > 1 ? (idx - (n - 1) / 2) * Math.min(5, 40 / n) : 0;
    const lift = n > 1 ? Math.abs(idx - (n - 1) / 2) ** 2 * Math.min(2.2, 30 / n) : 0;
    const dim = !giving && !myTurn() && !(c.k === 'hiss' && p.stage === 'react');
    let el = have.get(c.i);
    if (!el) {
      const t = document.createElement('template');
      t.innerHTML = cardHtml(c.k, { id: c.i }).trim();
      el = t.content.firstElementChild;
    }
    keep.add(el);
    el.classList.toggle('sel', sel);
    el.classList.toggle('pick', giving);
    el.classList.toggle('dim', dim);
    el.style.transform = `translateY(${lift}px) rotate(${rot}deg)`;
    if (box.children[idx] !== el) box.insertBefore(el, box.children[idx] || null);
  });
  for (const el of [...box.children]) if (!keep.has(el)) el.remove();
  const known = box._ids;
  box._ids = new Set(cards.map((c) => c.i));
  if (known) {
    for (const c of cards) {
      if (known.has(c.i)) continue;
      const el = box.querySelector(`.card[data-card="${c.i}"]`);
      if (!el) continue;
      if (el.scrollIntoView && box.scrollWidth > box.clientWidth) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      gsap.fromTo(el, { y: -70, scale: 1.18, opacity: 0, boxShadow: '0 0 0 3px #39ff88, 0 0 40px rgba(57,255,136,.8)' }, { y: 0, scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.8)', clearProps: 'y,scale,opacity' });
      gsap.to(el, { boxShadow: '0 0 0 0 rgba(0,0,0,0)', duration: 1.2, delay: 0.5, clearProps: 'boxShadow' });
    }
  }
  box._count = n;
  box.classList.toggle('scrolls', box.scrollWidth > box.clientWidth + 4);
}

function renderTable() {
  const p = app.pub;
  if (!p || p.phase === 'lobby') return;
  $('#roundNo').textContent = `Round ${p.round}`;
  $('#codeMini').textContent = p.code;
  renderSeats();
  $('#deckCount').textContent = `${p.deck} cards`;
  $('#deck').classList.toggle('hot', p.stage === 'defuse' || p.stage === 'doom');
  $('#dirRing').classList.toggle('rev', p.dir < 0);
  const cm = $('#critMark');
  cm.hidden = p.crit < 0;
  if (p.crit >= 0) {
    const pos = p.crit + 1;
    cm.textContent = pos === 1 ? '☢ on top!' : `☢ ${pos}${['th', 'st', 'nd', 'rd'][pos % 100 > 10 && pos % 100 < 14 ? 0 : pos % 10] || 'th'} from top`;
    cm.title = `The face-up Critical Mass is card ${pos} from the top of the reactor`;
    cm.style.top = `${Math.min(90, (p.crit / Math.max(1, p.deck)) * 100)}%`;
  }
  if (!app.busy) {
    renderDiscard();
    if (p.stage === 'react') renderPending();
    else if (!['react'].includes(p.stage)) clearPending();
  }
  const [txt, cls] = statusText();
  const st = $('#status');
  if (st._t !== txt) {
    st._t = txt;
    st.textContent = txt;
    st.className = 'status ' + cls;
    const sd = $('#statusDock');
    sd.textContent = txt;
    sd.className = 'status-dock ' + cls;
    gsap.fromTo(st, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 });
    if (cls === 'mine' && p.stage === 'act') { sfx.turn(); F.buzz(25); }
  }
  renderDock();
  renderVoice();
  renderHand();
  stageModals();
  if (!app.busy) syncBomb();
}

function showWin() {
  const p = app.pub;
  app.shownWin = p.round;
  const w = P(p.winner);
  const mine = p.winner === app.me.key;
  if (mine) sfx.win(); else sfx.pop();
  const ranks = [...p.players].filter((x) => p.order.includes(x.id)).sort((a, b) => (a.place || 99) - (b.place || 99));
  const crown = `<svg class="crown" viewBox="0 0 80 54"><defs><linearGradient id="crG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".45" stop-color="#ffd23d"/><stop offset="1" stop-color="#d68a00"/></linearGradient><linearGradient id="crS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="crC"><path d="M6 48l6-34 16 16 12-26 12 26 16-16 6 34z"/></clipPath></defs>
    <path d="M6 48l6-34 16 16 12-26 12 26 16-16 6 34z" fill="url(#crG)" stroke="#8a5a00" stroke-width="3" stroke-linejoin="round"/>
    <rect x="9" y="40" width="62" height="8" fill="#b36f00" opacity=".55" clip-path="url(#crC)"/>
    <circle cx="40" cy="31" r="5" fill="#39ff88" stroke="#0b5a2a" stroke-width="1.5"/><circle cx="22" cy="38" r="3" fill="#ff4d1f"/><circle cx="58" cy="38" r="3" fill="#ff4d1f"/>
    <circle cx="12" cy="13" r="3.4" fill="#fff3a8"/><circle cx="40" cy="4" r="3.4" fill="#fff3a8"/><circle cx="68" cy="13" r="3.4" fill="#fff3a8"/>
    <g clip-path="url(#crC)"><rect class="crown-glint" x="-40" y="0" width="22" height="54" fill="url(#crS)" transform="skewX(-20)"/></g></svg>`;
  const head = mine ? 'YOU SURVIVED' : `${w?.name || '?'} SURVIVED`;
  const letters = [...head].map((ch) => `<span>${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
  const card = modal(`<div class="win-card${mine ? ' mine' : ''}">
    <div class="win-stage"><div class="win-rays"></div><div class="win-glow"></div><canvas class="win-fx"></canvas>
      <div class="crown-cat"><div class="win-cat">${w ? catSvg(w.avatar, 'happy') : ''}</div>${crown}</div></div>
    <h3 class="win-title">${letters}</h3>
    <div class="win-sub">Reactor stabilised · round ${p.round}</div>
    <div class="standings">${ranks.map((x) => `<div><b>#${x.place || '-'}</b>${catSvg(x.avatar, x.out ? 'dead' : 'happy')}<span>${esc(x.name)}</span><span class="grow"></span><span class="muted">🏆 ${x.wins}</span></div>`).join('')}</div>
    <div class="modal-actions">${isHost() ? '<button class="btn ghost" data-action="tolobby">Lobby</button><button class="btn hot" data-action="again">☢ Play again</button>' : '<button class="btn hot" data-close>Nice</button>'}</div></div>`, { wide: false });
  const $c = (s) => card.querySelector(s);
  const fx = F.celebrate($c('.win-fx'));
  const tl = gsap.timeline();
  $('#modal')._tl = tl;
  tl.fromTo($c('.win-rays'), { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'expo.out' }, 0)
    .fromTo($c('.win-glow'), { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'power2.out' }, 0)
    .fromTo($c('.win-cat'), { y: 70, scaleX: 0.8, scaleY: 1.25, opacity: 0 }, { y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.6, ease: 'back.out(2.2)' }, 0.1)
    .fromTo($c('.crown'), { y: -170, rotation: -14, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 0.55, ease: 'power3.in' }, 0.45)
    .add(() => { fx.burst(); sfx.pop(); }, 1.0)
    .to($c('.win-cat'), { scaleX: 1.12, scaleY: 0.86, duration: 0.09, ease: 'power1.out', transformOrigin: '50% 100%' }, 1.0)
    .to($c('.win-cat'), { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1.1,0.45)' }, 1.09)
    .fromTo($c('.crown'), { scaleY: 0.82 }, { scaleY: 1, duration: 0.5, ease: 'elastic.out(1.2,0.4)', transformOrigin: '50% 100%', immediateRender: false }, 1.0)
    .fromTo($c('.crown-glint'), { x: 0 }, { x: 130, duration: 0.7, ease: 'power2.inOut' }, 1.25)
    .fromTo(card.querySelectorAll('.win-title span'), { y: 26, opacity: 0, scale: 0.4 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)', stagger: 0.035 }, 0.95)
    .fromTo($c('.win-sub'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 }, 1.4)
    .fromTo(card.querySelectorAll('.standings div'), { x: -24, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.05, duration: 0.35 }, 1.5)
    .to($c('.win-cat'), { y: -6, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 1.7)
    .fromTo($c('.crown-glint'), { x: 0 }, { x: 130, duration: 0.8, ease: 'power2.inOut', repeat: -1, repeatDelay: 2.6, immediateRender: false }, 3.5);
}

function pickTarget(titleText, cb, { allowEmpty = false } = {}) {
  const p = app.pub;
  const others = p.order.map(P).filter((x) => x && !x.out && x.id !== app.me.key);
  const card = modal(`<h3>${esc(titleText)}</h3><div class="target-grid">${others.map((x) => `<button data-tg="${esc(x.id)}" ${!allowEmpty && !x.cards ? 'disabled' : ''}>${catSvg(x.avatar, 'scared')}<div>${esc(x.name)}</div><small>${x.cards} cards</small></button>`).join('')}</div><div class="modal-actions"><button class="btn ghost" data-close>Cancel</button></div>`, { wide: others.length > 8 });
  card.querySelectorAll('[data-tg]').forEach((b) => b.addEventListener('click', () => { closeModal(); cb(b.dataset.tg); }));
}

function pickName(cb) {
  const kinds = Object.keys(CARDS).filter((k) => k !== 'meltdown' && k !== 'critical' && (!CARDS[k].pack || app.pub.settings.packs[CARDS[k].pack]));
  const card = modal(`<h3>Name a card to demand</h3><div class="name-grid">${kinds.map((k) => `<div data-nm="${k}">${cardHtml(k, { small: true })}</div>`).join('')}</div><div class="modal-actions"><button class="btn ghost" data-close>Cancel</button></div>`, { wide: true });
  card.querySelectorAll('[data-nm]').forEach((b) => b.addEventListener('click', () => { closeModal(); cb(b.dataset.nm); }));
}

function doPlay() {
  const c = localClassify(app.sel);
  if (!c || !myTurn()) return;
  const ids = [...app.sel];
  const go = (extra = {}) => { app.sel = []; act('play', { ids, ...extra }); };
  if (c.type === 'pair') return pickTarget('Steal a random card from…', (t) => go({ target: t }));
  if (c.type === 'triple') return pickTarget('Demand a card from…', (t) => pickName((nm) => go({ target: t, name: nm })));
  if (c.type === 'single' && TARGETED.has(c.k)) return pickTarget(c.k === 'target' ? 'Overload who?' : 'Bribe who?', (t) => go({ target: t }), { allowEmpty: c.k === 'target' });
  return go();
}

function rules() {
  const list = ['meltdown', 'coolant', 'hiss', 'nap', 'overload', 'peek', 'scramble', 'bribe', 'cat1', 'reverse', 'bottom', 'recal', 'target', 'critical', 'contain'];
  modal(`<div class="rules"><h3>How to play Meow-ltdown</h3>
    <p>The deck in the middle is the <b>reactor</b>. On your turn, play as many cards as you like, then <b>draw one card</b> to end your turn.</p>
    <p>Draw a <b>Meltdown</b> and you are out, unless you play a <b>Coolant</b>. Then you secretly slide the Meltdown back into the reactor anywhere you want. The last cat standing wins.</p>
    <h4>Combos</h4><ul><li><b>2 matching cards:</b> steal a random card from a player.</li><li><b>3 matching cards:</b> name a card. If they have it, they must hand it over.</li><li><b>5 different cards:</b> take any card from the discard pile.</li></ul>
    <h4>Hiss!</h4><p>When someone plays a card, a short window opens. Anyone holding a <b>Hiss!</b> can cancel it. A Hiss! can be Hissed back.</p>
    <h4>The cards</h4><div class="cardlist">${list.map((k) => cardHtml(k)).join('')}</div>
    <div class="modal-actions"><button class="btn hot" data-close>Let's go</button></div></div>`, { wide: true });
}

function credits() {
  modal(`<h3>Credits &amp; privacy</h3>
    <p><b>Meow-ltdown</b> is a free, non-commercial, original party game. The game code, card designs, and all art are original.</p>
    <p><b>Privacy:</b> when you open the site, host a room or join one, the server records your IP address, your approximate location from the IP (country and city), your browser's user agent, your player name, and a count of your visits. The site owner uses this only to see how many people play. Game traffic passes through a Cloudflare relay and, as a fallback, public MQTT brokers. Chat is not stored.</p>
    <p class="muted small">Sound and music are generated in your browser. Animations use GSAP.</p>
    <div class="modal-actions"><button class="btn hot" data-close>Close</button></div>`);
}

function audioMenu() {
  const card = modal(`<h3>Sound &amp; motion</h3>
    <div class="slider-row">🎵 Music<input type="range" id="musVol" min="0" max="100" value="${Math.round(getMusicVolume() * 100)}"></div>
    <div class="slider-row">🔊 Sound<input type="range" id="sfxVol" min="0" max="100" value="${Math.round(F.getSfxVolume() * 100)}"></div>
    <div class="field"><span>Motion</span><div class="seg"><button data-motion="full" class="${F.calm() ? '' : 'on'}">Full</button><button data-motion="calm" class="${F.calm() ? 'on' : ''}">Reduced</button></div></div>
    <div class="field"><span>Graphics quality <small class="muted" id="qNow">(now: ${quality()})</small></span><div class="seg">${['auto', 'high', 'med', 'low'].map((m) => `<button data-q="${m}" class="${qualityMode() === m ? 'on' : ''}">${{ auto: 'Auto', high: 'High', med: 'Medium', low: 'Low' }[m]}</button>`).join('')}</div></div>
    <div class="modal-actions"><button class="btn hot" data-close>Done</button></div>`);
  card.querySelector('#musVol').addEventListener('input', (e) => setMusicVolume(e.target.value / 100));
  card.querySelector('#sfxVol').addEventListener('input', (e) => { F.setSfxVolume(e.target.value / 100); });
  card.querySelector('#sfxVol').addEventListener('change', () => sfx.select());
  card.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    setQualityMode(b.dataset.q);
    card.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', x === b));
    card.querySelector('#qNow').textContent = `(now: ${quality()})`;
  }));
  card.querySelectorAll('[data-motion]').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.motion === 'calm';
    document.body.classList.toggle('calm', c);
    store('l', 'mow-calm', c ? 1 : null);
    card.querySelectorAll('[data-motion]').forEach((x) => x.classList.toggle('on', x === b));
  }));
}

function hostMenu() {
  const p = app.pub;
  const card = modal(`<h3>Host controls</h3>
    <div class="target-grid">${p.players.filter((x) => x.id !== app.me.key).map((x) => `<button data-kick="${esc(x.id)}">${catSvg(x.avatar)}<div>${esc(x.name)}</div><small>Remove</small></button>`).join('')}</div>
    <div class="modal-actions"><button class="btn danger" data-action="tolobby">End round → lobby</button><button class="btn ghost" data-close>Close</button></div>`, { wide: true });
  void card;
}

function onFx(m) {
  const p = P(m.from);
  if (!p) return;
  const at = document.querySelector(`.seat[data-pid="${m.from}"] .ava`);
  if (m.k === 'react') { F.floatEmoji(m.e, p.name, at); return; }
  if (m.k === 'chat') {
    sfx.chat();
    const b = document.createElement('div');
    b.className = 'bubble';
    b.innerHTML = `<b>${esc(p.name)}</b>`;
    b.appendChild(document.createTextNode(m.text));
    const r = rectOf(at);
    b.style.left = Math.min(innerWidth - 230, Math.max(8, r.x - 40)) + 'px';
    b.style.top = Math.max(60, r.y - 90) + 'px';
    document.body.appendChild(b);
    gsap.fromTo(b, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
    gsap.to(b, { opacity: 0, y: -10, delay: 4.5, duration: 0.4, onComplete: () => b.remove() });
  }
}

function copyInvite() {
  const url = inviteUrl();
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
    () => toast('Invite link copied!', 'good'),
    () => modal(`<h3>Invite link</h3><input value="${esc(url)}" readonly onclick="this.select()"><div class="modal-actions"><button class="btn hot" data-close>Close</button></div>`),
  );
}

function timerLoop() {
  const p = app.pub;
  const clock = $('#turnClock');
  const ring = $('#reactRing');
  const setHidden = (el, v) => { if (el.hidden !== v) el.hidden = v; };
  if (!p || p.phase !== 'play' || $('#table').hidden) { setHidden(clock, true); setHidden(ring, true); return; }
  const rem = Math.max(0, p.left - (performance.now() - app.recvAt));
  const frac = p.dur ? Math.min(1, rem / p.dur) : 0;
  const sec = Math.ceil(rem / 1000);
  const reacting = p.stage === 'react' && p.pending && p.dur > 1000 && !app.busy;
  setHidden(ring, !reacting);
  if (reacting) {
    $('#rrFg').style.strokeDashoffset = String(339.3 * (1 - frac));
    const txt = p.pending.hiss % 2 ? `BLOCKED ${sec}` : `HISS? ${sec}`;
    const lbl = $('#rrText');
    if (lbl.textContent !== txt) lbl.textContent = txt;
    ring.classList.toggle('urgent', sec <= 1);
  }
  const showClock = p.left > 0 && p.dur && ['act', 'give', 'alter', 'salvage', 'bury'].includes(p.stage);
  setHidden(clock, !showClock);
  if (showClock) {
    const t = String(sec);
    if ($('#clockText').textContent !== t) $('#clockText').textContent = t;
    $('#clockRing').style.strokeDashoffset = String(97.4 * (1 - frac));
    const urgent = sec <= 5 && (p.turn === app.me.key || p.who === app.me.key);
    clock.classList.toggle('low', urgent);
    if (urgent && sec !== app.lastSec && sec > 0) { app.lastSec = sec; sfx.tick(); }
  }
  if (!$('#bombStage').hidden && p.dur && ['defuse', 'doom', 'place'].includes(p.stage)) {
    $('#bsRing').style.strokeDashoffset = String(578 * (1 - frac));
  }
}
setInterval(timerLoop, 100);

document.addEventListener('click', async (e) => {
  sfx.unlock();
  kickMusic();
  if (e.target.closest('[data-close]')) { closeModal(); return; }
  const fur = e.target.closest('[data-fur]');
  if (fur) {
    const [, a] = app.me.avatar.split('-');
    app.me.avatar = `${fur.dataset.fur}-${a}`;
    saveMe();
    renderHome();
    sfx.select();
    gsap.fromTo('#mePreview svg', { scale: 1.3, rotation: 10 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' });
    return;
  }
  const acc = e.target.closest('[data-acc]');
  if (acc) {
    const [f] = app.me.avatar.split('-');
    app.me.avatar = `${f}-${acc.dataset.acc}`;
    saveMe();
    renderHome();
    sfx.pop();
    gsap.fromTo('#mePreview svg', { y: -14 }, { y: 0, duration: 0.5, ease: 'bounce.out' });
    return;
  }
  const col = e.target.closest('[data-col]');
  if (col) {
    app.me.color = col.dataset.col;
    saveMe();
    renderHome();
    sfx.select();
    return;
  }
  const pack = e.target.closest('[data-pack]');
  if (pack && isHost()) { app.host.act({ a: 'settings', patch: { packs: { [pack.dataset.pack]: !app.pub.settings.packs[pack.dataset.pack] } } }); sfx.select(); return; }
  const vset = e.target.closest('[data-voice]');
  if (vset && isHost()) { app.host.act({ a: 'settings', patch: { voice: app.pub.settings.voice === false } }); sfx.select(); return; }
  const house = e.target.closest('[data-house]');
  if (house && isHost()) { app.host.act({ a: 'settings', patch: { house: { [house.dataset.house]: !app.pub.settings.house[house.dataset.house] } } }); sfx.select(); return; }
  const kick = e.target.closest('[data-kick]');
  if (kick && isHost()) {
    const x = P(kick.dataset.kick);
    closeModal();
    if (x && await ask('Remove player?', `Remove <b>${esc(x.name)}</b> from the room? They cannot rejoin this room.`, 'Remove', true)) app.host.act({ a: 'kick', pid: x.id });
    return;
  }
  const seatTap = e.target.closest('.seat');
  if (seatTap && seatTap.dataset.pid !== app.me.key && app.pub && app.pub.settings.voice !== false && !$('#table').hidden) {
    const x = P(seatTap.dataset.pid);
    if (x && !x.bot) {
      const m = V.isBlocked(x.id);
      if (await ask(m ? 'Unmute voice?' : 'Mute voice?', m ? `Hear <b>${esc(x.name)}</b> again?` : `Stop hearing <b>${esc(x.name)}</b>'s push-to-talk and call audio?`, m ? 'Unmute' : 'Mute')) {
        V.toggleBlock(x.id);
        renderVoice();
      }
      return;
    }
  }
  const react = e.target.closest('[data-react]');
  if (react) {
    send({ t: 'react', e: react.dataset.react });
    if (app.role === 'client') F.floatEmoji(react.dataset.react, app.me.name, react);
    gsap.fromTo(react, { scale: 1.6 }, { scale: 1, duration: 0.3 });
    return;
  }
  const pos = e.target.closest('[data-pos]');
  if (pos && $('#placeIn')) {
    const v = pos.dataset.pos === 'rand' ? Math.floor(Math.random() * (+$('#placeIn').max + 1)) : +pos.dataset.pos;
    $('#placeIn').value = v;
    $('#placeIn').dispatchEvent(new Event('input'));
    return;
  }
  const hc = e.target.closest('#hand .card');
  if (hc) {
    const id = Number(hc.dataset.card);
    const p = app.pub;
    if (p.stage === 'give' && p.who === app.me.key) { app.sel = [id]; sfx.select(); renderTable(); return; }
    if (hc.dataset.k === 'hiss' && p.stage === 'react' && p.pending && amIn()) { act('hiss', { ids: [id] }); gsap.fromTo(hc, { y: -30 }, { y: 0, duration: 0.3 }); return; }
    if (!myTurn() || hc.dataset.k === 'meltdown') { gsap.fromTo(hc, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(3, 0.3)' }); return; }
    if (app.sel.includes(id)) { app.sel = app.sel.filter((x) => x !== id); sfx.deselect(); }
    else { app.sel.push(id); sfx.select(); }
    renderTable();
    return;
  }
  const rc = e.target.closest('.rules .cardlist .card');
  if (rc) { openInspect(rc, rc.dataset.k, null); return; }
  const b = e.target.closest('[data-action]');
  if (!b) return;
  switch (b.dataset.action) {
    case 'create': if (needName()) beginHost(null); break;
    case 'join': {
      if (!needName()) return;
      const code = $('#codeIn').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(code)) { toast('Room codes are 5 letters or numbers.', 'bad'); return; }
      beginJoin(code);
      break;
    }
    case 'resume': { const s = savedHost(); if (s) beginHost(s); break; }
    case 'forget': clearSavedHost(); $('#resumeBox').hidden = true; break;
    case 'credits': credits(); break;
    case 'rules': rules(); break;
    case 'copy': copyInvite(); break;
    case 'share':
      if (navigator.share) navigator.share({ title: 'Meow-ltdown', text: `Join my reactor! Room ${app.code}`, url: inviteUrl() }).catch(() => {});
      else copyInvite();
      break;
    case 'start': app.host.act({ a: 'start' }); break;
    case 'addbot': app.host.act({ a: 'bot' }); sfx.pop(); break;
    case 'again': closeModal(); app.host.act({ a: 'again' }); break;
    case 'tolobby': closeModal(); app.host.act({ a: 'lobby' }); break;
    case 'play': doPlay(); break;
    case 'draw': app.sel = []; act('draw'); break;
    case 'give': if (app.sel.length) { const id = app.sel[0]; app.sel = []; act('give', { ids: [id] }); } break;
    case 'hiss': act('hiss'); break;
    case 'cool': act('cool'); b.disabled = true; break;
    case 'hold': act('hold'); break;
    case 'place': act('place', { pos: +$('#placeIn').value }); b.disabled = true; break;
    case 'hostmenu': hostMenu(); break;
    case 'call':
      if (V.isInCall()) { V.leaveCall(); toast('You left the call.'); }
      else if (await V.joinCall()) toast('You joined the live call 📞. Talk any time; tap 🎤 to mute.', 'good');
      break;
    case 'selfmute': toast(V.toggleSelfMute() ? 'Your mic is muted.' : 'Your mic is live.'); break;
    case 'uninspect': closeInspect(); break;
    case 'in-sel': inspectSelect(); break;
    case 'in-play': inspectPlayNow(); break;
    case 'in-hiss': { const id = inspector.id; closeInspect(true); act('hiss', { ids: [id] }); break; }
    case 'in-give': { const id = inspector.id; closeInspect(true); act('give', { ids: [id] }); break; }
    case 'audio': audioMenu(); break;
    case 'log': document.body.classList.toggle('show-log'); document.body.classList.toggle('hide-log', !document.body.classList.contains('show-log') && innerWidth > 820); break;
    case 'chat': {
      const card = modal('<h3>Say something</h3><input id="chatIn" maxlength="140" placeholder="Type a message" autocomplete="off"><div class="modal-actions"><button class="btn ghost" data-close>Cancel</button><button class="btn hot" id="chatGo">Send</button></div>');
      const input = card.querySelector('#chatIn');
      setTimeout(() => input.focus(), 50);
      const go = () => { const v = input.value.trim(); closeModal(); if (v) { send({ t: 'chat', text: v }); if (app.role === 'client') onFx({ k: 'chat', from: app.me.key, text: v }); } };
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
      card.querySelector('#chatGo').addEventListener('click', go);
      break;
    }
    case 'leave': {
      const msg = isHost() ? 'You are the host. If you leave, the room closes for everyone.' : 'You can rejoin with the same code later.';
      if (await ask('Leave the room?', msg, 'Leave', true)) leaveRoom(false);
      break;
    }
    default: break;
  }
});

document.addEventListener('change', (e) => {
  const k = e.target.dataset?.set;
  if (!k || !isHost()) return;
  app.host.act({ a: 'settings', patch: { [k]: Number(e.target.value) } });
});

$('#codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.querySelector('[data-action="join"]').click(); });
$('#nameIn').addEventListener('change', saveMe);
window.addEventListener('beforeunload', (e) => {
  if (isHost() && app.pub && app.pub.players.some((p) => p.on && !p.bot && p.id !== app.me.key)) { e.preventDefault(); e.returnValue = ''; }
});
const relayout = () => { if (app.pub && app.pub.phase !== 'lobby') { $('#hand')._sig = null; renderTable(); } };
window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', () => setTimeout(relayout, 250));

initPwa({ toast });
V.initVoice({
  send: (m) => { if (app.role === 'host') app.host?.voice(m); else app.client?.voice(m); },
  me: () => app.me.key,
  enabled: () => !!app.pub && app.pub.settings.voice !== false,
  toast,
  onSpeaking: speak,
  onChange: renderVoice,
  onClip: (from) => logLine(`🎙 ${nameOf(from)} sent a voice message.`),
});
setupPTT();
initQuality();
renderHome();
hit('visit');

const seat = store('s', 'mow-seat');
const urlCode = (params.get('room') || '').toUpperCase();
const saved = savedHost();
if (saved && urlCode === saved.code && saved.me?.key === app.me.key) beginHost(saved);
else if (seat && urlCode && seat.code === urlCode && app.me.name) beginJoin(urlCode);
else if (params.has('bots') && params.has('autostart') && app.me.name) beginHost(null);

window.__mow = app;
