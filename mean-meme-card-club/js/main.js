import { initFeedback } from '../../shared/feedback.js';
import { joinHost, randomCode, RELAY_URL } from './net.js';
import { startHost, savedHost, clearSavedHost } from './host.js';
import { catalogue, loadDataset, presetPacks } from './cards.js';
import { sfx, buzz, confettiBurst, floatEmoji, isMuted, setMuted } from './fx.js';
import { initPwa, keepAwake } from './pwa.js';
import { t, tn, tc, lang, setLang, onLang, initialLang, applyStatic } from './i18n.js';

const AVATARS = ['😈', '🤡', '👽', '🤖', '👻', '💀', '🐸', '🦝', '🦆', '🐙', '🦄', '🐔', '🌚', '🍑', '🌶️', '🧠', '🤠', '🥸', '😎', '🫠', '🤪', '🐒', '🦖', '🐧', '🍕', '🧛', '🧟', '🐼'];
const COLORS = ['#ff3d8b', '#7c5cff', '#22c3ee', '#c6ff3d', '#ffd23d', '#ff8a3d', '#2ee59d', '#ff5a5a', '#b06bff', '#f5f5f5'];
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
  const saved = store('l', 'mmcc-me') || {};
  let key = store('s', 'mmcc-key');
  if (!key) { key = rid(); store('s', 'mmcc-key', key); }
  return {
    key,
    name: saved.name || '',
    avatar: saved.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
    color: saved.color || COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

const app = {
  me: loadMe(),
  role: null,
  code: null,
  pub: null,
  hand: [],
  seq: -1,
  host: null,
  client: null,
  sel: [],
  texts: {},
  recvAt: 0,
  cat: null,
  welcomed: false,
  retry: null,
  lastTickSec: -1,
};

function hit(kind, extra = {}) {
  if (params.has('nohit')) return;
  try { fetch(RELAY_URL + '/hit', { method: 'POST', body: JSON.stringify({ game: 'mean-meme-card-club', kind, name: app.me.name || '', wd: navigator.webdriver ? 1 : 0, ...extra }), keepalive: true, mode: 'cors' }).catch(() => {}); } catch { /* offline */ }
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  const box = $('#toasts');
  while (box.children.length > 3) box.firstElementChild.remove();
  if (gsap) gsap.fromTo(el, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
  setTimeout(() => {
    if (gsap) gsap.to(el, { opacity: 0, x: 30, duration: 0.3, onComplete: () => el.remove() });
    else el.remove();
  }, kind === 'bad' ? 5000 : 3000);
}

function modal(html, { wide = false, onClose, cls = '' } = {}) {
  const m = $('#modal');
  const card = $('#modalCard');
  card.className = 'modal-card' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '');
  card.innerHTML = html;
  m.hidden = false;
  m._onClose = onClose;
  if (gsap) gsap.fromTo(card, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' });
  return card;
}
function closeModal() {
  const m = $('#modal');
  if (m.hidden) return;
  m.hidden = true;
  const f = m._onClose;
  m._onClose = null;
  if (f) f();
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function ask(title, body, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const card = modal(`<h3>${esc(title)}</h3><p>${body}</p><div class="modal-actions"><button class="btn ghost" data-x="no">${t('Cancel')}</button><button class="btn ${danger ? 'danger' : 'pink'}" data-x="yes">${esc(okLabel)}</button></div>`, {
      onClose: () => { if (!done) resolve(false); },
    });
    card.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => {
      done = true;
      closeModal();
      resolve(b.dataset.x === 'yes');
    }));
  });
}

function prompt(title, placeholder, maxlen = 120) {
  return new Promise((resolve) => {
    let done = false;
    const card = modal(`<h3>${esc(title)}</h3><input id="pIn" maxlength="${maxlen}" placeholder="${esc(placeholder)}" autocomplete="off"><div class="modal-actions"><button class="btn ghost" data-x="no">${t('Cancel')}</button><button class="btn pink" data-x="yes">${t('OK')}</button></div>`, {
      onClose: () => { if (!done) resolve(null); },
    });
    const input = card.querySelector('#pIn');
    setTimeout(() => input.focus(), 50);
    const finish = (ok) => {
      done = true;
      const v = input.value.trim();
      closeModal();
      resolve(ok && v ? v : null);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); });
    card.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.x === 'yes')));
  });
}

function show(screen) {
  for (const id of ['home', 'lobby', 'table']) {
    const el = document.getElementById(id);
    const on = id === screen;
    if (el.hidden === !on) continue;
    el.hidden = !on;
    if (on && gsap) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.35 });
  }
  keepAwake(screen !== 'home');
}

function avatar(p, extra = '') {
  return `<div class="av ${extra}" style="--c:${esc(p?.color || '#555')}">${esc(p?.avatar || '❔')}</div>`;
}

function blackHtml(text, answers = null) {
  let i = 0;
  const parts = esc(tc(text)).split(/_+/);
  if (!answers) return parts.join('<span class="blank"></span>');
  let out = parts[0];
  for (let k = 1; k < parts.length; k++) {
    const a = answers[i++];
    out += (a ? `<span class="fill">${esc(tc(a).replace(/[.。]$/, ''))}</span>` : '<span class="blank"></span>') + parts[k];
  }
  while (i < answers.length) out += ` <span class="fill">${esc(tc(answers[i++]))}</span>`;
  return out;
}

function hallHtml(text) {
  return esc(tc(text)).replace(/\[\[(.*?)\]\]/g, '<span class="fill">$1</span>');
}

const P = (id) => app.pub?.players.find((p) => p.id === id);
const meP = () => P(app.me.key);
const isHost = () => app.role === 'host';
const amJudge = () => app.pub && app.pub.judge === app.me.key;
const canSubmit = () => {
  const p = app.pub;
  const me = meP();
  return p && p.phase === 'submit' && me && !me.spectator && !amJudge() && !me.sub;
};

function renderHome() {
  $('#nameIn').value = app.me.name;
  $('#avatarGrid').innerHTML = AVATARS.map((a) => `<button type="button" data-av="${a}" class="${a === app.me.avatar ? 'on' : ''}">${a}</button>`).join('');
  $('#colorRow').innerHTML = COLORS.map((c) => `<button type="button" data-col="${c}" style="background:${c}" class="${c === app.me.color ? 'on' : ''}" aria-label="colour ${c}"></button>`).join('');
  const code = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code) $('#codeIn').value = code;
  const saved = savedHost();
  $('#resumeBox').hidden = !saved;
  if (saved) $('#resumeCode').textContent = saved.code;
}

function saveMe() {
  app.me.name = $('#nameIn').value.trim().slice(0, 20);
  store('l', 'mmcc-me', { name: app.me.name, avatar: app.me.avatar, color: app.me.color });
}

function needName() {
  saveMe();
  if (app.me.name) return true;
  toast(t('Type your name first.'), 'bad');
  $('#nameIn').focus();
  if (gsap) gsap.fromTo('#nameIn', { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(3, 0.3)' });
  return false;
}

function setUrl(code) {
  const u = new URL(location.href);
  if (code) u.searchParams.set('room', code);
  else u.searchParams.delete('room');
  u.searchParams.delete('bots');
  history.replaceState(null, '', u);
}

function beginHost(resume) {
  const code = resume ? resume.code : randomCode();
  if (resume) app.me.key = resume.me.key;
  store('s', 'mmcc-key', app.me.key);
  app.role = 'host';
  app.code = code;
  app.seq = -1;
  app.pub = null;
  setUrl(code);
  $('#netNote').textContent = t('Opening the room…');
  show('lobby');
  app.host = startHost({
    code,
    me: { ...app.me },
    resume,
    zh: lang() !== 'en',
    bots: Math.min(60, parseInt(params.get('bots') || '0', 10) || 0),
    onUpdate: (pub, hand) => { onHand(hand); onPub(pub); },
    onFx: onFx,
    onReady: () => { $('#netNote').textContent = t('Room is open. Share the code!'); },
    onError: () => { $('#netNote').textContent = t('Network trouble. Retrying…'); toast(t('Could not reach the game servers. Check your connection.'), 'bad'); },
    onToast: (m, k, v) => toast(t(m, v), k),
  });
  hit('host', { room: code });
}

function beginJoin(code) {
  app.role = 'client';
  app.code = code;
  app.seq = -1;
  app.pub = null;
  app.welcomed = false;
  store('s', 'mmcc-seat', { code });
  setUrl(code);
  toast(t('Joining room {code}…', { code }));
  const join = () => app.client && app.client.send({ t: 'join', key: app.me.key, name: app.me.name, avatar: app.me.avatar, color: app.me.color });
  app.client = joinHost(code, {
    onOpen: () => join(),
    onData: (m) => {
      if (!m) return;
      if (m.t === 'welcome') {
        if (!app.welcomed) { toast(t('You are in! 🎉'), 'good'); hit('join', { room: code }); }
        app.welcomed = true;
        if (m.spectator) toast(t('The room is full, so you are watching as a spectator.'));
      } else if (m.t === 'state') {
        if (m.seq < app.seq && m.seq > 2) return;
        app.seq = m.seq;
        onPub(m.pub);
      } else if (m.t === 'hand') {
        onHand(m.cards);
        renderTable(app.pub);
      } else if (m.t === 'fx') {
        onFx(m);
      } else if (m.t === 'rejoin') {
        join();
      } else if (m.t === 'kicked') {
        toast(t('The host removed you from the room.'), 'bad');
        leaveRoom(true);
      } else if (m.t === 'err') {
        if (m.err === 'reveal-first') toast(t('Flip every card before you pick.'));
      }
    },
    onClose: () => { if (app.welcomed) toast(t('Connection hiccup, reconnecting…')); },
    onError: (e) => {
      toast(e.type === 'peer-unavailable' ? t('Room {code} was not found. Check the code.', { code }) : t('Could not connect. Check your connection.'), 'bad');
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
  store('s', 'mmcc-seat', null);
  app.role = null;
  app.pub = null;
  app.hand = [];
  app.sel = [];
  setUrl(null);
  closeModal();
  renderHome();
  show('home');
}

function send(m) {
  if (app.role === 'host') {
    if (m.t === 'act') return app.host.act(m);
    return app.host.react(m);
  }
  if (app.client) app.client.send(m);
  return null;
}

function act(a, extra = {}) {
  const p = app.pub;
  const m = { t: 'act', a, ctx: p.roundId + ':' + p.phase, ...extra };
  const res = send(m);
  if (app.role === 'client' && a === 'submit') {
    clearTimeout(app.retry);
    let n = 0;
    const again = () => {
      const me = meP();
      if (!app.client || !app.pub || app.pub.roundId + ':' + app.pub.phase !== m.ctx || me?.sub || n++ >= 3) return;
      app.client.send(m);
      app.retry = setTimeout(again, 3000);
    };
    app.retry = setTimeout(again, 3000);
  }
  if (res === 'reveal-first') toast(t('Flip every card before you pick.'));
  return res;
}

function onHand(cards) {
  const ids = new Set(cards.map((c) => c.c));
  app.sel = app.sel.filter((c) => ids.has(c));
  app.hand = cards;
}

function onPub(pub) {
  const prev = app.pub;
  app.pub = pub;
  app.recvAt = performance.now();
  const me = pub.players.find((p) => p.id === app.me.key);
  if (pub.phase === 'lobby') app.inGame = false;
  else if (!app.inGame) {
    app.inGame = true;
    hit('game', { room: pub.code, players: pub.players.filter((x) => !x.bot).length });
  }
  if (pub.phase === 'lobby') {
    show('lobby');
    renderLobby();
    return;
  }
  show('table');
  const newRound = !prev || prev.roundId !== pub.roundId;
  if (newRound) {
    app.sel = [];
    app.texts = {};
    if (pub.phase === 'submit') {
      sfx.deal();
      if (amJudge()) { sfx.judge(); buzz(30); toast(t('You are the judge this round 👑'), 'good'); }
    }
  }
  if (prev && prev.phase !== 'lobby') {
    const known = new Set(prev.players.map((x) => x.id));
    for (const x of pub.players) {
      if (known.has(x.id) || x.id === app.me.key || x.rando) continue;
      toast(t(x.spectator ? '{who} joined as a spectator' : '{who} joined the club', { who: `${x.avatar} ${x.name}` }), 'good');
      sfx.pop();
    }
  }
  if (prev && prev.phase === 'submit' && pub.phase === 'submit' && pub.subCount > prev.subCount) sfx.submitted();
  if (prev && pub.phase === 'judge' && prev.phase !== 'judge') sfx.flip();
  if (prev && pub.phase === 'judge' && prev.phase === 'judge' && pub.reveal > prev.reveal) sfx.flip();
  if (prev && pub.phase === 'judge' && prev.phase === 'judge' && pub.focus !== prev.focus && pub.focus >= 0) sfx.select();
  const won = (pub.phase === 'result' || pub.phase === 'over') && pub.winner && (!prev || prev.roundId !== pub.roundId || (prev.phase !== 'result' && prev.phase !== 'over'));
  renderTable(prev);
  if (won) {
    const w = P(pub.winner.pid);
    if (pub.winner.pid === app.me.key) { sfx.win(); buzz([30, 50, 30]); confettiBurst(false); toast(t('Your card won! +1 🏆'), 'good'); }
    else { sfx.pop(); confettiBurst(false); }
    const row = document.querySelector(`.sb[data-pid="${pub.winner.pid}"]`);
    if (w) floatEmoji('+1', w.name, row || document.querySelector('.sub.win'));
  }
  if (pub.phase === 'over' && (!prev || prev.phase !== 'over')) {
    sfx.fanfare();
    confettiBurst(true);
  }
  if (me && me.spectator && newRound && prev) toast(t('You are spectating this game.'));
}

function onFx(m) {
  const p = P(m.from);
  if (!p) return;
  if (m.k === 'react') {
    const row = document.querySelector(`.sb[data-pid="${m.from}"]`);
    const visible = row && row.offsetParent;
    floatEmoji(m.e, p.name, visible ? row : null);
    return;
  }
  if (m.k === 'chat') {
    sfx.chat();
    const b = document.createElement('div');
    b.className = 'bubble';
    b.innerHTML = `<b>${esc(p.avatar)} ${esc(p.name)}</b>`;
    b.appendChild(document.createTextNode(m.text));
    const row = document.querySelector(`.sb[data-pid="${m.from}"]`);
    const r = row && row.offsetParent ? row.getBoundingClientRect() : null;
    const existing = $$('.bubble').length;
    b.style.left = (r ? r.right + 10 : 16) + 'px';
    b.style.top = (r ? r.top : 80 + existing * 60) + 'px';
    document.body.appendChild(b);
    if (gsap) {
      gsap.fromTo(b, { scale: 0.5, opacity: 0, transformOrigin: 'left top' }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
      gsap.to(b, { opacity: 0, y: -10, delay: 4.5, duration: 0.4, onComplete: () => b.remove() });
    } else setTimeout(() => b.remove(), 5000);
  }
}

let qrFor = null;
function renderLobby() {
  const p = app.pub;
  if (!p) return;
  $('#roomCode').textContent = p.code;
  if (qrFor !== p.code && window.QRCode) {
    qrFor = p.code;
    $('#qr').innerHTML = '';
    try { new window.QRCode($('#qr'), { text: inviteUrl(), width: 160, height: 160, colorDark: '#140b1f', colorLight: '#ffffff' }); } catch { /* qr failed */ }
  }
  if (app.role === 'client') $('#netNote').textContent = t('Connected. Waiting for the host to start.');
  const players = p.players;
  $('#playerCount').textContent = players.filter((x) => !x.spectator).length;
  const prevIds = new Set($$('#lobbyPlayers .lp').map((e) => e.dataset.pid));
  setHtml($('#lobbyPlayers'), players.map((x) => `
    <div class="lp ${x.id === app.me.key ? 'me' : ''} ${x.on ? '' : 'off'}" data-pid="${esc(x.id)}">
      ${x.id === p.hostId ? '<span class="badge" title="Host">👑</span>' : x.spectator ? '<span class="badge" title="Spectator">👀</span>' : ''}
      ${isHost() && x.id !== app.me.key ? `<button class="kick" data-kick="${esc(x.id)}" title="Remove">✕</button>` : ''}
      ${avatar(x)}
      <div class="nm">${esc(x.name)}${x.id === app.me.key ? ' (you)' : ''}</div>
    </div>`).join(''));
  $$('#lobbyPlayers .lp').forEach((el) => {
    if (!prevIds.has(el.dataset.pid) && gsap) { gsap.fromTo(el, { scale: 0, rotation: -15 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.5)' }); sfx.pop(); }
  });
  renderSettings();
}

function setHtml(el, html) {
  if (el._h === html) return false;
  el._h = html;
  el.innerHTML = html;
  return true;
}

const SECS = () => [[0, t('No limit')], [30, t('{n} s', { n: 30 })], [45, t('{n} s', { n: 45 })], [60, t('1 min')], [90, t('1.5 min')], [120, t('2 min')], [180, t('3 min')]];
const opt = (list, v) => list.map(([k, l]) => `<option value="${k}" ${+k === +v ? 'selected' : ''}>${l}</option>`).join('');

function renderSettings() {
  const p = app.pub;
  const s = p.settings;
  const chips = p.packNames.map((n) => `<span class="chip">${esc(tc(n))}</span>`).join('') + (p.packCount > p.packNames.length ? `<span class="chip">${t('+{n} more', { n: p.packCount - p.packNames.length })}</span>` : '');
  const activeCount = p.players.filter((x) => x.on && !x.spectator).length;
  if (!isHost()) {
    setHtml($('#settingsBox'), `
      <div class="packs-sum"><b>${tn(p.packCount, '{n} card pack', '{n} card packs')}</b><div class="chips">${chips}</div></div>
      <div class="ro-rules">
        <div><span>${t('Points to win')}</span><b>${s.goal || t('Endless')}</b></div>
        <div><span>${t('Cards in hand')}</span><b>${s.hand}</b></div>
        <div><span>${t('Answer timer')}</span><b>${s.submitSecs ? t('{n} s', { n: s.submitSecs }) : t('Off')}</b></div>
        <div><span>${t('Judge timer')}</span><b>${s.judgeSecs ? t('{n} s', { n: s.judgeSecs }) : t('Off')}</b></div>
        <div><span>${t('Blank cards')}</span><b>${s.blanks || t('None')}</b></div>
        <div><span>${t('Rando the Bot')}</span><b>${s.rando ? t('Playing') : t('Off')}</b></div>
        <div><span>${t('Swap hand for 1 point')}</span><b>${s.swaps ? t('Allowed') : t('Off')}</b></div>
      </div>
      <p class="muted small" style="margin-top:14px">${t('Only the host can change the rules. Waiting for the host to start…')}</p>`);
    return;
  }
  setHtml($('#settingsBox'), `
    <div class="packs-sum"><b>${tn(p.packCount, '{n} card pack', '{n} card packs')}</b><div class="chips">${chips}</div>
      <button class="btn small violet" data-action="packs">${t('🃏 Choose card packs')}</button></div>
    <div class="set-row"><label for="sGoal">${t('Points to win')}</label><select id="sGoal" data-set="goal">${opt([[3, '3'], [5, '5'], [8, '8'], [10, '10'], [15, '15'], [20, '20'], [0, t('Endless')]], s.goal)}</select></div>
    <div class="set-row"><label for="sHand">${t('Cards in hand')}</label><select id="sHand" data-set="hand">${opt([[7, '7'], [8, '8'], [10, '10'], [12, '12'], [15, '15']], s.hand)}</select></div>
    <div class="set-row"><label for="sSub">${t('Answer timer')}<small>${t('Random card is played when time runs out')}</small></label><select id="sSub" data-set="submitSecs">${opt(SECS(), s.submitSecs)}</select></div>
    <div class="set-row"><label for="sJudge">${t('Judge timer')}<small>${t('Random winner when time runs out')}</small></label><select id="sJudge" data-set="judgeSecs">${opt(SECS(), s.judgeSecs)}</select></div>
    <div class="set-row"><label for="sBl">${t('Blank cards')}<small>${t('Write your own answer')}</small></label><select id="sBl" data-set="blanks">${opt([[0, t('None')], [10, '10'], [25, '25'], [50, '50'], [100, '100']], s.blanks)}</select></div>
    <div class="set-row"><label for="sRando">${t('Rando the Bot')}<small>${t('Plays a random card every round')}</small></label><input type="checkbox" id="sRando" data-set="rando" ${s.rando ? 'checked' : ''}></div>
    <div class="set-row"><label for="sSwap">${t('Swap hand for 1 point')}</label><input type="checkbox" id="sSwap" data-set="swaps" ${s.swaps ? 'checked' : ''}></div>
    <div class="start-row">
      <button class="btn big pink ${activeCount >= 3 ? 'pulse' : ''}" data-action="start" ${activeCount >= 2 ? '' : 'disabled'}>${t('🚀 Start the game')}</button>
      <button class="btn small ghost" data-action="addbot">${t('🤖 Add a bot player')}</button>
      <p class="muted small">${activeCount < 3 ? t('You need at least 3 players (Rando the Bot counts). ') : ''}${t('Players can also join after the game starts.')}</p>${p.mixed ? `<p class="pk-warn" style="margin:8px 0 0">${t('Mixing English and Chinese packs in one game makes the cards hard to read.')}</p>` : ''}
    </div>`);
}

function inviteUrl() {
  return location.origin + location.pathname + '?room=' + app.code;
}

const plural = (n, one, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const GROUP_ICONS = { 'Club originals': '😈', '中文原创': '🀄', 'Anime, manga & manhwa': '🍥', 'Base sets': '📦', 'Official expansions': '🧩', 'Official themed packs': '🎭', 'Promos, holidays & events': '🎉', 'Community packs': '🌍' };

async function openPacks() {
  const card = modal(`<div class="pk-head"><h3>${t('Card packs')}</h3><button class="xbtn" data-x="cancel" aria-label="Close">✕</button></div>
    <div class="pk-loading"><div class="spinner"></div><span>${t('Loading every pack…')}</span></div>`, { wide: true, cls: 'packs' });
  let ds = null;
  let offline = false;
  try {
    ds = await loadDataset();
  } catch {
    offline = true;
  }
  if ($('#modal').hidden) return;
  app.cat = catalogue(ds);
  const sel = new Set(app.pub.packIds);
  const cat = app.cat;
  const open = new Set(cat.groups.filter((g) => cat.packs.some((p) => p.group === g && sel.has(p.id))));
  let q = '';
  const PRESETS = [['zh', t('Chinese')], ['anime', t('Anime')], ['base', t('Base set')], ['official', t('All official')], ['all', t('Everything (English)')]];

  card.innerHTML = `<div class="pk-head"><h3>${t('Card packs')}</h3><span class="pill" id="pkSel"></span><span class="grow"></span><button class="xbtn" data-x="cancel" aria-label="Close">✕</button></div>
    <div class="pk-tools">
      <label class="search"><span>🔎</span><input id="pkQ" placeholder="${t('Search {n} packs…', { n: cat.packs.length })}" autocomplete="off"></label>
      <div class="seg">${PRESETS.map(([k, l]) => `<button data-pre="${k}">${l}</button>`).join('')}</div>
    </div>
    ${offline ? `<p class="pk-warn">${t('The classic packs could not be downloaded right now. The club originals are still available.')}</p>` : ''}
    <div class="pk-body" id="pkBody"></div>
    <div class="pk-foot"><div class="pk-total" id="pkTotal"></div><button class="btn ghost" data-x="cancel">${t('Cancel')}</button><button class="btn pink" data-x="save">${t('Use these packs')}</button></div>`;

  const body = card.querySelector('#pkBody');
  const totals = () => {
    let w = 0;
    let b = 0;
    for (const p of cat.packs) if (sel.has(p.id)) { w += p.white; b += p.black; }
    card.querySelector('#pkSel').textContent = tn(sel.size, '{n} pack on', '{n} packs on');
    card.querySelector('#pkTotal').innerHTML = `<b>${tn(b, '{n} prompt', '{n} prompts')}</b><span>${tn(w, '{n} answer', '{n} answers')}</span>`;
    card.querySelector('[data-x=save]').disabled = !sel.size;
  };
  const renderBody = () => {
    const ql = q.toLowerCase();
    const html = cat.groups.map((g) => {
      const all = cat.packs.filter((p) => p.group === g);
      const packs = all.filter((p) => !ql || p.name.toLowerCase().includes(ql));
      if (!packs.length) return '';
      const on = all.filter((p) => sel.has(p.id)).length;
      const allOn = packs.every((p) => sel.has(p.id));
      const isOpen = ql || open.has(g);
      return `<section class="pk-group ${isOpen ? 'open' : ''}" data-g="${esc(g)}">
        <header data-tog="${esc(g)}"><span class="gi">${GROUP_ICONS[g] || '🃏'}</span><span class="gn">${esc(t(g))}</span>
          <span class="gc ${on ? 'some' : ''}">${on} / ${all.length}</span><span class="grow"></span>
          <button class="mini ${allOn ? 'on' : ''}" data-grp="${esc(g)}">${allOn ? t('Clear') : t('Select all')}</button><span class="chev">▾</span></header>
        ${isOpen ? `<div class="pk-list">${packs.map((p) => `<button class="pk ${sel.has(p.id) ? 'on' : ''}" data-pk="${p.id}" aria-pressed="${sel.has(p.id)}">
          <span class="ck"></span><span class="pt"><span class="pn">${esc(tc(p.name))}${p.lang === 'zh' ? ' <span class="lang-tag">中文</span>' : ''}</span><span class="pc">${tn(p.black, '{n} prompt', '{n} prompts')} · ${tn(p.white, '{n} answer', '{n} answers')}</span></span></button>`).join('')}</div>` : ''}
      </section>`;
    }).join('');
    body.innerHTML = html || `<p class="muted pk-empty">${t('No packs match that search.')}</p>`;
    totals();
  };
  card.querySelector('#pkQ').addEventListener('input', (e) => { q = e.target.value; renderBody(); });
  card.onclick = (e) => {
    const t = e.target.closest('[data-grp],[data-pre],[data-x],[data-pk],[data-tog]');
    if (!t) return;
    if (t.dataset.pk) {
      if (sel.has(t.dataset.pk)) sel.delete(t.dataset.pk);
      else sel.add(t.dataset.pk);
      const on = sel.has(t.dataset.pk);
      t.classList.toggle('on', on);
      t.setAttribute('aria-pressed', on);
      sfx[on ? 'select' : 'deselect']();
      const g = t.closest('.pk-group').dataset.g;
      const all = cat.packs.filter((p) => p.group === g);
      const gc = t.closest('.pk-group').querySelector('.gc');
      const n = all.filter((p) => sel.has(p.id)).length;
      gc.textContent = `${n} / ${all.length}`;
      gc.classList.toggle('some', n > 0);
      totals();
    } else if (t.dataset.grp) {
      e.stopPropagation();
      const packs = cat.packs.filter((p) => p.group === t.dataset.grp && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
      const allOn = packs.every((p) => sel.has(p.id));
      packs.forEach((p) => (allOn ? sel.delete(p.id) : sel.add(p.id)));
      if (!allOn) open.add(t.dataset.grp);
      renderBody();
    } else if (t.dataset.tog) {
      if (open.has(t.dataset.tog)) open.delete(t.dataset.tog);
      else open.add(t.dataset.tog);
      renderBody();
    } else if (t.dataset.pre) {
      sel.clear();
      presetPacks(cat, t.dataset.pre).forEach((id) => sel.add(id));
      cat.groups.forEach((g) => { if (cat.packs.some((p) => p.group === g && sel.has(p.id))) open.add(g); });
      sfx.pop();
      renderBody();
    } else if (t.dataset.x === 'save') {
      app.host.act({ a: 'settings', patch: { packs: cat.packs.filter((p) => sel.has(p.id)).map((p) => p.id) } });
      closeModal();
      toast(t('Card packs updated.'), 'good');
    } else if (t.dataset.x === 'cancel') closeModal();
  };
  renderBody();
}

function lenCls(text) {
  const n = String(text || '').length;
  return n > 230 ? 'len-xl' : n > 120 ? 'len-l' : n > 70 ? 'len-m' : '';
}

function statusLine() {
  const p = app.pub;
  const j = P(p.judge);
  const me = meP();
  const jn = j ? `<b>${esc(j.avatar)} ${esc(j.name)}</b>` : 'the judge';
  if (p.phase === 'wait') return esc(t(p.note || 'Waiting for more players…'));
  if (me?.spectator) return p.phase === 'submit' ? t('Players are choosing answers. {judge} is judging.', { judge: jn }) : t('{judge} is judging.', { judge: jn });
  if (p.phase === 'submit') {
    if (amJudge()) return t('You are the judge 👑 Wait for the answers to come in.');
    if (me?.sub) return t('Locked in ✓ Waiting for everyone else…');
    return p.black?.pick > 1 ? t('Pick <b>{n}</b> cards in order. {judge} is judging.', { n: p.black.pick, judge: jn }) : t('Pick your funniest card. {judge} is judging.', { judge: jn });
  }
  if (p.phase === 'judge') {
    if (amJudge()) return p.reveal < p.subs.length ? t('Tap the wiggling card to flip it 👇') : t('Tap your favourite, then crown it 👑');
    return t('{judge} is reading the answers…', { judge: jn });
  }
  if (p.phase === 'result') {
    const w = P(p.winner?.pid);
    return w ? t('{who} wins the round!', { who: `<b>${esc(w.avatar)} ${esc(w.name)}</b>` }) + (p.note ? ' <span class="muted">' + esc(t(p.note)) + '</span>' : '') : esc(t(p.note));
  }
  if (p.phase === 'over') {
    const w = P(p.podium[0]);
    return w ? t('🏆 {who} wins the game!', { who: `<b>${esc(w.name)}</b>` }) : t('Game over');
  }
  return '';
}

function renderScoreboard() {
  const p = app.pub;
  const list = [...p.players].sort((a, b) => b.score - a.score || (a.spectator - b.spectator));
  const top = list[0]?.score || 0;
  const html = `<div class="sb-title">${t('Scores')} <span>${t('{n} playing', { n: list.filter((x) => !x.spectator).length })}</span></div>` + list.map((x, i) => {
    const judge = x.id === p.judge && p.phase !== 'over';
    const st = x.spectator ? t('spectating') : !x.on ? t('away') : judge ? t('👑 judging') : p.phase === 'submit' ? (x.sub ? t('✓ played') : t('thinking…')) : '';
    const medal = x.score > 0 && i < 3 && !x.spectator ? ['🥇', '🥈', '🥉'][i] : '';
    return `<div class="sb ${judge ? 'judge' : ''} ${x.sub ? 'done' : ''} ${x.on ? '' : 'off'} ${x.id === app.me.key ? 'me' : ''} ${x.score && x.score === top ? 'lead' : ''}" data-pid="${esc(x.id)}">
      <div class="av-wrap">${avatar(x)}${medal ? `<span class="medal">${medal}</span>` : ''}</div><div class="who"><div class="nm">${esc(x.name)}${x.id === app.me.key ? ` <span class="you">${t('you')}</span>` : ''}</div><div class="st">${st}</div></div><div class="sc">${x.score}</div></div>`;
  }).join('');
  const before = new Map($$('#scoreboard .sb').map((e) => [e.dataset.pid, e.querySelector('.sc').textContent]));
  if (setHtml($('#scoreboard'), html) && gsap) {
    $$('#scoreboard .sb').forEach((e) => {
      const was = before.get(e.dataset.pid);
      if (was !== undefined && was !== e.querySelector('.sc').textContent) gsap.fromTo(e.querySelector('.sc'), { scale: 2.2, color: '#c6ff3d' }, { scale: 1, color: '#f6f1ff', duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    });
  }
}

function renderTable(prev) {
  const p = app.pub;
  if (!p || p.phase === 'lobby') return;
  $('#roundNo').textContent = p.phase === 'over' ? t('Game over') : t('Round {n}', { n: p.round });
  $('#codeMini').textContent = p.code;
  $$('.host-only').forEach((e) => { e.hidden = !isHost(); });
  renderScoreboard();
  $('#status').innerHTML = statusLine();
  renderStage(prev);
  renderHand(prev);
}

function blackCard(text, answers, id = 'blackCard', pick = 1) {
  return `<div class="card black big ${lenCls(text + (answers || []).join(' '))}" id="${id}">${blackHtml(text, answers)}${pick > 1 ? `<span class="pick">${t('PICK {n}', { n: pick })}</span>` : ''}<span class="brand">MEAN MEME CARD CLUB</span></div>`;
}

function subFace(sub) {
  const cls = lenCls(sub.cards.join(' '));
  return sub.cards.map((c, i) => `<div class="ans ${cls}">${sub.cards.length > 1 ? `<span class="n">${i + 1}</span>` : ''}${esc(tc(c))}</div>`).join('');
}

function renderStage(prev) {
  const p = app.pub;
  const top = $('#stageTop');
  const area = $('#subsArea');
  const newRound = !prev || prev.roundId !== p.roundId;
  if (p.phase === 'wait') {
    setHtml(top, `<div class="card black big">${esc(t(p.note || 'Waiting for more players…'))}<span class="brand">MEAN MEME CARD CLUB</span></div>`);
    setHtml(area, isHost() ? `<div class="judge-bar"><button class="btn lime" data-action="addbot">${t('🤖 Add a bot')}</button><button class="btn ghost" data-action="tolobby">${t('Back to lobby')}</button></div>` : '');
    return;
  }
  if (p.phase === 'over') {
    const pod = p.podium.map((id) => P(id)).filter(Boolean);
    const order = [pod[1], pod[0], pod[2]];
    const cls = ['p2', 'p1', 'p3'];
    const html = `<div style="width:100%;text-align:center"><div class="podium">${order.map((x, i) => (x ? `<div class="pl ${cls[i]}">${avatar(x)}<div class="nm"><b>${esc(x.name)}</b></div><div class="blk">${x.score}</div></div>` : '')).join('')}</div>
      ${isHost() ? `<div class="judge-bar"><button class="btn big pink" data-action="again">${t('🔁 Play again')}</button></div>` : `<p class="muted">${t('Waiting for the host to start a new game…')}</p>`}</div>`;
    if (setHtml(top, html) && gsap) gsap.from('.podium .pl', { y: 80, opacity: 0, stagger: 0.2, duration: 0.7, ease: 'back.out(1.7)' });
    setHtml(area, p.hall.length ? `<h2 style="text-align:center">${t('Hall of Shame')}</h2><div class="hall-list">${p.hall.map(hallItem).join('')}</div>` : '');
    return;
  }
  if (!p.black) return;

  if (p.phase === 'submit') {
    const mine = app.sel.map((c) => app.hand.find((h) => h.c === c)).filter(Boolean);
    let zone = '';
    if (canSubmit()) {
      zone = mine.length
        ? `<div class="slot-cards" id="dropZone">${mine.map((h, i) => `<div class="card white ${lenCls(h.t)}" data-unsel="${h.c}">${p.black.pick > 1 ? `<span class="slot-n">${i + 1}</span>` : ''}${esc(h.blank ? app.texts[h.c] || '(blank)' : tc(h.t))}<span class="brand">${t('tap to remove')}</span></div>`).join('')}</div>`
        : `<div class="drop-hint" id="dropZone">${t('Drag a card here<br>or tap one in your hand')}</div>`;
    } else if (meP()?.sub) {
      zone = `<div class="drop-hint" style="border-style:solid;color:var(--lime)">${t('✓ Locked in')}</div>`;
    }
    const answers = canSubmit() && mine.length ? mine.map((h) => (h.blank ? app.texts[h.c] || '…' : h.t)) : null;
    const html = blackCard(p.black.text, answers, 'blackCard', p.black.pick) + zone;
    if (setHtml(top, html) && newRound && gsap) {
      gsap.fromTo('#blackCard', { rotationY: 180, scale: 0.6, y: -120, opacity: 0 }, { rotationY: 0, scale: 1, y: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.4)' });
    }
    const subs = p.players.filter((x) => x.on && !x.spectator && x.id !== p.judge);
    const html2 = `<div class="waiting-row">${subs.map((x) => avatar(x, x.sub ? 'done' : 'pending').replace('class="av', `title="${esc(x.name)}" class="av`)).join('')}</div>
      <div class="facedown-pile">${Array.from({ length: Math.min(p.subCount, 14) }, (_, i) => `<div class="fd" style="transform:translateX(${(i - Math.min(p.subCount, 14) / 2) * 16}px) rotate(${((i * 37) % 21) - 10}deg)"></div>`).join('')}</div>`;
    const prevCount = prev && prev.roundId === p.roundId ? prev.subCount : 0;
    if (setHtml(area, html2) && gsap && p.subCount > prevCount) {
      const pile = $$('.facedown-pile .fd');
      pile.slice(prevCount).forEach((el) => gsap.from(el, { y: 160, opacity: 0, duration: 0.5, ease: 'back.out(1.5)' }));
    }
    return;
  }

  const focusSub = p.phase === 'judge' && p.focus >= 0 ? p.subs[p.focus] : p.winner ? p.subs[p.winner.idx] : null;
  setHtml(top, blackCard(p.black.text, focusSub ? focusSub.cards : null, 'blackCard', p.black.pick));
  const judge = amJudge() && p.phase === 'judge';
  const items = p.subs.map((s, i) => {
    if (!s) {
      const next = judge && i === p.reveal;
      return `<div class="sub back ${next ? 'next' : ''}" data-sub="${i}" ${next ? 'data-reveal="1"' : ''}><div class="face">?</div></div>`;
    }
    const win = p.winner && p.winner.idx === i;
    const owner = s.pid ? P(s.pid) : null;
    const cls = [judge && p.reveal >= p.subs.length ? 'can' : '', p.phase === 'judge' && p.focus === i ? 'focus' : '', win ? 'win' : '', p.winner && !win ? 'lose' : ''].join(' ');
    return `<div class="sub ${cls}" data-sub="${i}" ${judge ? 'data-focus="1"' : ''}>${win ? '<div class="crown">👑</div>' : ''}<div class="face">${subFace(s)}</div>${owner ? `<div class="owner">${avatar(owner)}${esc(owner.name)}</div>` : s.pid ? `<div class="owner">${t('(left)')}</div>` : ''}</div>`;
  }).join('');
  let bar = '';
  if (judge) {
    bar = `<div class="judge-bar">${p.reveal < p.subs.length ? `<button class="btn lime" data-action="revealAll">${t('Flip them all')}</button>` : ''}${p.reveal >= p.subs.length ? `<button class="btn big pink ${p.focus >= 0 ? 'pulse' : ''}" data-action="crown" ${p.focus >= 0 ? '' : 'disabled'}>${t('👑 Crown this one')}</button>` : ''}</div>`;
  } else if (p.phase === 'result' && isHost()) {
    bar = `<div class="judge-bar"><button class="btn lime" data-action="next">${t('Next round ⏭')}</button></div>`;
  }
  const prevReveal = prev && prev.roundId === p.roundId && prev.phase === 'judge' ? prev.reveal : 0;
  const enteringJudge = !prev || prev.phase !== p.phase || prev.roundId !== p.roundId;
  if (setHtml(area, bar + `<div class="subs-grid">${items}</div>`) && gsap) {
    if (enteringJudge && p.phase === 'judge') gsap.from('.subs-grid .sub', { y: 120, rotation: () => Math.random() * 30 - 15, opacity: 0, stagger: 0.05, duration: 0.5, ease: 'back.out(1.5)' });
    for (let i = prevReveal; i < p.reveal && p.phase === 'judge'; i++) {
      const el = document.querySelector(`.sub[data-sub="${i}"] .face`);
      if (el) gsap.fromTo(el, { rotationY: -180 }, { rotationY: 0, duration: 0.55, ease: 'power2.out' });
    }
    if (p.phase === 'result' && prev && prev.phase === 'judge') {
      const w = document.querySelector('.sub.win');
      if (w) {
        gsap.fromTo(w, { scale: 1 }, { scale: 1.12, duration: 0.35, yoyo: true, repeat: 1, ease: 'power2.out' });
        gsap.from(w.querySelector('.crown'), { y: -80, rotation: -40, opacity: 0, duration: 0.6, ease: 'bounce.out' });
        w.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      gsap.fromTo('#blackCard', { scale: 0.92 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    }
  }
}

function hallItem(h) {
  const o = P(h.pid);
  return `<div class="hall-item">${hallHtml(h.text)}<div class="by">${o ? avatar(o) + esc(o.name) : t('someone who left')} · ${t('round {n}', { n: h.round })}</div></div>`;
}

function renderHand(prev) {
  const p = app.pub;
  const handEl = $('#hand');
  const me = meP();
  const can = canSubmit();
  const noHand = !me || me.spectator || p.phase !== 'submit' || amJudge();
  handEl.hidden = noHand;
  $('#handBar').hidden = !me || me.spectator || p.phase !== 'submit';
  handEl.classList.toggle('locked', !can);
  const ids = app.hand.map((h) => h.c).join(',');
  if (handEl._ids !== ids) {
    const old = new Set((handEl._ids || '').split(',').filter(Boolean));
    handEl._ids = ids;
    const mid = (app.hand.length - 1) / 2;
    handEl.innerHTML = app.hand.map((h, i) => `<div class="card white ${h.blank ? 'blank-card' : lenCls(h.t)}" data-card="${h.c}" style="--r:${((i - mid) * 2.2).toFixed(1)}deg;--y:${(Math.abs(i - mid) ** 2 * 1.6).toFixed(0)}px">${h.blank ? `<span class="bl">${t('Blank card: write anything')}</span>` : esc(tc(h.t))}<span class="brand">MMCC</span></div>`).join('');
    const fresh = $$('#hand .card').filter((el) => !old.has(el.dataset.card));
    if (gsap && fresh.length && fresh.length < 20) gsap.from(fresh, { y: -260, x: 80, rotation: 25, opacity: 0, stagger: 0.06, duration: 0.55, ease: 'back.out(1.3)', clearProps: 'transform,opacity' });
  }
  $$('#hand .card').forEach((el) => {
    const i = app.sel.indexOf(Number(el.dataset.card));
    el.classList.toggle('sel', i >= 0);
    const bl = el.querySelector('.bl');
    if (bl) {
      const typed = app.texts[Number(el.dataset.card)];
      bl.textContent = typed && i >= 0 ? typed : t('Blank card: write anything');
      bl.classList.toggle('typed', !!(typed && i >= 0));
    }
    let n = el.querySelector('.slot-n');
    if (i >= 0 && p.black?.pick > 1) {
      if (!n) { n = document.createElement('span'); n.className = 'slot-n'; el.appendChild(n); }
      n.textContent = i + 1;
    } else if (n) n.remove();
  });
  let bar = '';
  if (can) {
    const pick = p.black.pick;
    const ready = app.sel.length === pick;
    bar = ready
      ? `<button class="btn big lime pulse" data-action="play">${pick > 1 ? t('✅ Play these') : t('✅ Play this card')}</button><button class="btn ghost small" data-action="clearsel">${t('Undo')}</button>`
      : `<span class="hint">${pick > 1 ? tn(pick - app.sel.length, 'Choose {n} more card (order matters)', 'Choose {n} more cards (order matters)') : t('Drag a card up to the prompt, or tap one')}</span>`;
    if (p.settings.swaps && me.score >= 1) bar += `<button class="btn ghost small" data-action="swap">${t('♻️ New hand (−1 point)')}</button>`;
  } else if (amJudge() && p.phase === 'submit') bar = `<span class="hint">${t('You are judging this round. Your hand takes a break.')}</span>`;
  else if (me?.sub && p.phase === 'submit') bar = `<span class="hint">${t('Answer locked in. Send some reactions while you wait 😏')}</span>`;
  setHtml($('#handBar'), bar);
}

async function choose(c, viaDrag = false) {
  if (!canSubmit()) return;
  const p = app.pub;
  const i = app.sel.indexOf(c);
  if (i >= 0) {
    app.sel.splice(i, 1);
    sfx.deselect();
    renderTable(app.pub);
    return;
  }
  const h = app.hand.find((x) => x.c === c);
  if (!h) return;
  if (h.blank) {
    const typed = await prompt(t('Write your own answer'), t('Something terrible…'), 120);
    if (!typed) return;
    app.texts[c] = typed;
  }
  if (app.sel.length >= p.black.pick) app.sel.shift();
  app.sel.push(c);
  sfx.select();
  buzz(10);
  renderTable(app.pub);
  if (viaDrag && p.black.pick === 1) playSelected();
}

function playSelected() {
  const p = app.pub;
  if (!canSubmit() || app.sel.length !== p.black.pick) return;
  const ids = [...app.sel];
  const texts = {};
  for (const c of ids) if (c < 0) texts[c] = app.texts[c] || '';
  const target = $('#blackCard')?.getBoundingClientRect();
  if (gsap && target) {
    ids.forEach((c, i) => {
      const el = document.querySelector(`#hand .card[data-card="${c}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const ghost = el.cloneNode(true);
      ghost.classList.remove('sel');
      Object.assign(ghost.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', margin: 0, zIndex: 65, width: r.width + 'px' });
      document.body.appendChild(ghost);
      gsap.to(ghost, { left: target.left + target.width / 2 - r.width / 2 + i * 20, top: target.top + 40, rotation: 360 + (i * 8 - 8), scale: 0.5, opacity: 0, duration: 0.6, ease: 'power2.in', onComplete: () => ghost.remove() });
    });
  }
  sfx.play();
  buzz(25);
  act('submit', { ids, texts });
  app.sel = [];
}

let drag = null;
function setupDrag() {
  const hand = $('#hand');
  hand.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.card');
    if (!card || !canSubmit() || e.button > 0) return;
    drag = { card, x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.on) {
      if (dy > -14 || Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 14) drag = null;
        return;
      }
      drag.on = true;
      const r = drag.card.getBoundingClientRect();
      const ghost = drag.card.cloneNode(true);
      ghost.classList.remove('sel');
      ghost.style.width = r.width + 'px';
      ghost.style.minHeight = r.height + 'px';
      drag.ox = e.clientX - r.left;
      drag.oy = e.clientY - r.top;
      drag.ghost = ghost;
      drag.card.style.opacity = '0.3';
      $('#drag-layer').appendChild(ghost);
      try { drag.card.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      sfx.select();
    }
    drag.ghost.style.left = e.clientX - drag.ox + 'px';
    drag.ghost.style.top = e.clientY - drag.oy + 'px';
    const dz = $('#dropZone');
    const zone = dz && dz.offsetParent ? dz : $('#blackCard');
    const over = zone && hitTest(zone, e.clientX, e.clientY, 60);
    if (zone) zone.classList.toggle('hot', !!over);
    drag.over = over;
  }, { passive: true });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.on) return;
    d.card.style.opacity = '';
    $('#dropZone')?.classList.remove('hot');
    d.suppressClick = true;
    suppressClickUntil = performance.now() + 300;
    if (d.over) {
      d.ghost.remove();
      choose(Number(d.card.dataset.card), true);
    } else if (gsap) {
      const r = d.card.getBoundingClientRect();
      gsap.to(d.ghost, { left: r.left, top: r.top, rotation: 0, duration: 0.3, ease: 'back.out(2)', onComplete: () => d.ghost.remove() });
    } else d.ghost.remove();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
let suppressClickUntil = 0;

function hitTest(el, x, y, pad = 0) {
  const r = el.getBoundingClientRect();
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

function openChat() {
  prompt(t('Say something to the table'), t('Type a message…'), 140).then((t) => { if (t) send({ t: 'chat', text: t }); });
}

function openHall() {
  const h = app.pub?.hall || [];
  modal(`<h3>${t('🏆 Hall of Shame')}</h3>${h.length ? `<div class="hall-list">${h.map(hallItem).join('')}</div>` : `<p class="muted">${t('No winning cards yet. Give it a round.')}</p>`}<div class="modal-actions"><button class="btn pink" data-close>${t('Close')}</button></div>`);
}

function openHostMenu() {
  const p = app.pub;
  const others = p.players.filter((x) => x.id !== app.me.key && !x.rando);
  const tile = (h, icon, title, sub, cls = '') => `<button class="act-tile ${cls}" data-h="${h}"><span class="ai">${icon}</span><span><b>${title}</b><small>${sub}</small></span></button>`;
  const card = modal(`<div class="pk-head"><h3>${t('Host controls')}</h3><span class="grow"></span><button class="xbtn" data-close aria-label="Close">✕</button></div>
    <div class="act-grid">
      ${p.phase === 'result' || p.phase === 'wait' ? tile('next', '⏭', t('Next round'), t('Skip the countdown'), 'hot') : ''}
      ${tile('invite', '🔗', t('Invite link'), t('Copy it for friends'))}
      ${tile('addbot', '🤖', t('Add a bot'), t('Plays random cards'))}
      ${tile('rando', '🎲', p.settings.rando ? t('Remove Rando') : t('Add Rando'), t('A bot that never judges'))}
      ${tile('lobby', '🛑', t('End game'), t('Back to the lobby'), 'danger')}
    </div>
    <div class="sec-title">${t('Players')} <span>${others.length}</span></div>
    <div class="plist">${others.map((x) => `<div class="prow">${avatar(x)}<div class="nm">${esc(x.name)}${x.on ? '' : ` <span class="muted">${t('· away')}</span>`}</div><button class="mini danger" data-kick="${esc(x.id)}">${t('Remove')}</button></div>`).join('') || `<p class="muted">${t('Nobody else yet. Share the invite link!')}</p>`}</div>`);
  card.onclick = async (e) => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    const h = b.dataset.h;
    if (h === 'next') app.host.act({ a: 'next' });
    if (h === 'addbot') app.host.act({ a: 'bot' });
    if (h === 'rando') app.host.act({ a: 'settings', patch: { rando: !p.settings.rando } });
    if (h === 'invite') copyInvite();
    if (h === 'lobby') {
      closeModal();
      if (await ask(t('End this game?'), t('Scores reset and everyone goes back to the lobby.'), t('End game'), true)) app.host.act({ a: 'lobby' });
      return;
    }
    closeModal();
  };
}

function copyInvite() {
  const url = inviteUrl();
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
    () => toast(t('Invite link copied!'), 'good'),
    () => modal(`<h3>${t('Invite link')}</h3><input value="${esc(url)}" readonly onclick="this.select()"><div class="modal-actions"><button class="btn pink" data-close>${t('Close')}</button></div>`),
  );
}

function credits() {
  modal(`<h3>Credits &amp; privacy</h3>
    <p><b>Mean Meme Card Club</b> is a free, non-commercial fan-made party game. The game code and the Club Starter Deck are original.</p>
    <p>The classic card packs are downloaded while you play from the community <a href="https://github.com/crhallberg/json-against-humanity" target="_blank" rel="noopener">JSON Against Humanity</a> dataset. Those cards were written by Cards Against Humanity LLC and released under the <a href="https://creativecommons.org/licenses/by-nc-sa/2.0/" target="_blank" rel="noopener">Creative Commons BY-NC-SA 2.0</a> licence. This site is not affiliated with or endorsed by Cards Against Humanity LLC.</p>
    <p><b>Privacy:</b> when you open the site, host a room or join one, the server records your IP address, your approximate location from the IP (country and city), your browser's user agent, and a count of your visits. The site owner uses this only to see how many people play. Game traffic passes through a Cloudflare relay and, as a fallback, public MQTT brokers. Chat and cards are not stored.</p>
    <p class="muted small">Sounds are generated in your browser. Animations use GSAP and canvas-confetti.</p>
    <div class="modal-actions"><button class="btn pink" data-close>Close</button></div>`);
}

function updateMuteIcons() {
  $$('.mute-ic').forEach((e) => { e.textContent = isMuted() ? '🔇' : '🔊'; });
}

function timerLoop() {
  const p = app.pub;
  const t = $('#timer');
  if (!p || !p.left || !['submit', 'judge', 'result'].includes(p.phase) || $('#table').hidden) {
    t.hidden = true;
    return;
  }
  const rem = Math.max(0, p.left - (performance.now() - app.recvAt));
  const sec = Math.ceil(rem / 1000);
  t.hidden = false;
  $('#timerText').textContent = sec;
  const frac = p.dur ? Math.min(1, rem / p.dur) : 0;
  $('#timerRing').style.strokeDashoffset = String(97.4 * (1 - frac));
  const urgent = sec <= 10 && p.phase !== 'result' && (canSubmit() || (amJudge() && p.phase === 'judge'));
  t.classList.toggle('low', urgent);
  if (urgent && sec !== app.lastTickSec && sec > 0) { app.lastTickSec = sec; sfx.tick(); }
}
setInterval(timerLoop, 250);

document.addEventListener('click', async (e) => {
  sfx.unlock();
  const lb = e.target.closest('[data-lang]');
  if (lb) { closeModal(); setLang(lb.dataset.lang); return; }
  if (e.target.closest('[data-close]')) { closeModal(); return; }
  const av = e.target.closest('[data-av]');
  if (av) {
    app.me.avatar = av.dataset.av;
    saveMe();
    $$('#avatarGrid button').forEach((b) => b.classList.toggle('on', b === av));
    if (gsap) gsap.fromTo(av, { scale: 1.5, rotation: 20 }, { scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(3)' });
    sfx.pop();
    return;
  }
  const col = e.target.closest('[data-col]');
  if (col) {
    app.me.color = col.dataset.col;
    saveMe();
    $$('#colorRow button').forEach((b) => b.classList.toggle('on', b === col));
    sfx.select();
    return;
  }
  const kick = e.target.closest('[data-kick]');
  if (kick && isHost()) {
    const x = P(kick.dataset.kick);
    closeModal();
    if (x && await ask(t('Remove player?'), t('Remove <b>{name}</b> from the room? They will not be able to rejoin this room.', { name: esc(x.name) }), t('Remove'), true)) app.host.act({ a: 'kick', pid: x.id });
    return;
  }
  const react = e.target.closest('[data-react]');
  if (react) {
    send({ t: 'react', e: react.dataset.react });
    if (app.role === 'client') floatEmoji(react.dataset.react, app.me.name, react);
    if (gsap) gsap.fromTo(react, { scale: 1.6 }, { scale: 1, duration: 0.3 });
    return;
  }
  const handCard = e.target.closest('#hand .card');
  if (handCard) {
    if (performance.now() < suppressClickUntil) return;
    choose(Number(handCard.dataset.card));
    return;
  }
  const unsel = e.target.closest('[data-unsel]');
  if (unsel) { choose(Number(unsel.dataset.unsel)); return; }
  const sub = e.target.closest('.sub');
  if (sub && amJudge() && app.pub.phase === 'judge') {
    const i = Number(sub.dataset.sub);
    if (sub.dataset.reveal) act('reveal');
    else if (app.pub.subs[i] && app.pub.reveal >= app.pub.subs.length) act('focus', { idx: i });
    else if (app.pub.subs[i]) toast(t('Flip every card first.'));
    return;
  }
  const b = e.target.closest('[data-action]');
  if (!b) return;
  switch (b.dataset.action) {
    case 'create': if (needName()) beginHost(null); break;
    case 'join': {
      if (!needName()) return;
      const code = $('#codeIn').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(code)) { toast(t('Room codes are 5 letters or numbers.'), 'bad'); return; }
      beginJoin(code);
      break;
    }
    case 'resume': { const s = savedHost(); if (s) beginHost(s); break; }
    case 'forget': clearSavedHost(); $('#resumeBox').hidden = true; break;
    case 'credits': credits(); break;
    case 'copy': copyInvite(); break;
    case 'share':
      if (navigator.share) navigator.share({ title: 'Mean Meme Card Club', text: t('Join my game! Room {code}', { code: app.code }), url: inviteUrl() }).catch(() => {});
      else copyInvite();
      break;
    case 'packs': openPacks(); break;
    case 'start': {
      b.disabled = true;
      b.textContent = t('Shuffling…');
      const err = await app.host.act({ a: 'start' });
      if (err) { $('#settingsBox')._h = ''; renderSettings(); }
      break;
    }
    case 'addbot': app.host.act({ a: 'bot' }); break;
    case 'tolobby': app.host.act({ a: 'lobby' }); break;
    case 'play': playSelected(); break;
    case 'clearsel': app.sel = []; renderTable(app.pub); break;
    case 'swap':
      if (await ask(t('Swap your hand?'), t('You lose 1 point and get a whole new hand.'), t('Swap it'))) act('swap');
      break;
    case 'revealAll': act('revealAll'); break;
    case 'crown':
      if (app.pub.focus >= 0) { act('pick', { idx: app.pub.focus }); sfx.win(); }
      break;
    case 'next': app.host.act({ a: 'next' }); break;
    case 'again': app.host.act({ a: 'lobby' }); break;
    case 'hall': openHall(); break;
    case 'hostmenu': openHostMenu(); break;
    case 'chat': openChat(); break;
    case 'scores': $('#scoreboard').classList.toggle('open'); break;
    case 'mute': setMuted(!isMuted()); updateMuteIcons(); break;
    case 'lang': modal(`<div class="pk-head"><h3>🌐 ${t('Language')}</h3><span class="grow"></span><button class="xbtn" data-close aria-label="Close">✕</button></div><div class="lang-pick"><button data-lang="en" class="${lang() === 'en' ? 'on' : ''}">English</button><button data-lang="zhs" class="${lang() === 'zhs' ? 'on' : ''}">简体中文</button><button data-lang="zht" class="${lang() === 'zht' ? 'on' : ''}">繁體中文</button></div>`); break;
    case 'leave': {
      const msg = isHost() ? t('You are the host. If you leave, the room closes for everyone.') : t('You can rejoin with the same code later.');
      if (await ask(t('Leave the room?'), msg, t('Leave'), true)) leaveRoom(false);
      break;
    }
    default: break;
  }
});

document.addEventListener('change', (e) => {
  const k = e.target.dataset?.set;
  if (!k || !isHost()) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
  app.host.act({ a: 'settings', patch: { [k]: v } });
});

$('#codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.querySelector('[data-action="join"]').click(); });
$('#nameIn').addEventListener('change', saveMe);
window.addEventListener('beforeunload', (e) => {
  if (isHost() && app.pub && app.pub.players.some((p) => p.on && !p.bot && p.id !== app.me.key)) { e.preventDefault(); e.returnValue = ''; }
});

onLang(() => {
  for (const sel of ['#settingsBox', '#scoreboard', '#stageTop', '#subsArea', '#handBar', '#lobbyPlayers']) { const el = $(sel); if (el) el._h = null; }
  const h = $('#hand');
  if (h) h._ids = null;
  if (app.pub && app.pub.phase === 'lobby') renderLobby();
  else if (app.pub) renderTable(app.pub);
});
await setLang(initialLang());
initPwa({ toast });
if (window.ResizeObserver) new ResizeObserver(([e]) => document.documentElement.style.setProperty('--dock-h', Math.round(e.contentRect.height) + 'px')).observe($('#handDock'));
setupDrag();
updateMuteIcons();
renderHome();
hit('visit');

const seat = store('s', 'mmcc-seat');
const urlCode = (params.get('room') || '').toUpperCase();
const saved = savedHost();
if (saved && urlCode === saved.code && saved.me?.key === app.me.key) {
  beginHost(saved);
} else if (seat && urlCode && seat.code === urlCode && app.me.name) {
  beginJoin(urlCode);
}

window.__mmcc = app;

initFeedback({ game: 'mean-meme-card-club' });
