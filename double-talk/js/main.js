import { initVoice } from '../../shared/voice.js';
import { initQuality, onQuality, qualityPicker, low } from '../../shared/perf.js';
import { initFeedback } from '../../shared/feedback.js';
import { logo } from '../../shared/logos.js';
import { joinHost, randomCode, RELAY_URL } from './net.js';
import { startHost, savedHost, clearSavedHost } from './host.js';
import { MIN_PLAYERS, MAX_PLAYERS, doublesFor, blanksFor } from './rules.js';
import { PACKS } from './words.js';
import { sfx, buzz, unlockAudio, getSfxVolume, setSfxVolume } from './fx.js';
import { initPwa, keepAwake } from './pwa.js';

const EMOJI = ['🕵️', '🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐯', '🐧', '🦉', '🐵', '👽'];
const COLORS = ['#ff4fd8', '#36e6ff', '#ffd447', '#4ade80', '#b18cff', '#ff7a45', '#ff4d6d', '#2ec4b6'];
const REACTS = ['😂', '🤔', '😱', '🤥', '👀'];
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
  const saved = store('l', 'dt-me') || {};
  let key = store('s', 'dt-key');
  if (!key) { key = rid(); store('s', 'dt-key', key); }
  return { key, name: saved.name || '', emoji: saved.emoji || EMOJI[Math.floor(Math.random() * EMOJI.length)], color: saved.color || COLORS[Math.floor(Math.random() * COLORS.length)] };
}

const app = { me: loadMe(), role: null, code: null, pub: null, mine: {}, seq: -1, host: null, client: null, welcomed: false, pick: null, lastPhase: '', lastKey: '', shownOver: 0, talking: new Map() };
window.__dt = app;

function hit(kind, extra = {}) {
  if (params.has('nohit')) return;
  try { fetch(RELAY_URL + '/hit', { method: 'POST', body: JSON.stringify({ game: 'double-talk', kind, name: app.me.name || '', wd: navigator.webdriver ? 1 : 0, ...extra }), keepalive: true, mode: 'cors' }).catch(() => {}); } catch { /* offline */ }
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

function modal(html) {
  const m = $('#modal');
  const card = $('#modalCard');
  card.innerHTML = html;
  m.hidden = false;
  gsap.fromTo(card, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: 'power2.out' });
  return card;
}
const closeModal = () => { $('#modal').hidden = true; };
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function show(screen) {
  for (const id of ['home', 'lobby', 'table']) {
    const el = document.getElementById(id);
    const on = id === screen;
    if (el.hidden === !on) continue;
    el.hidden = !on;
    if (on) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  }
  keepAwake(screen === 'table');
}

const P = (id) => app.pub?.players.find((p) => p.id === id);
const nameOf = (id) => (id === app.me.key ? 'You' : esc(P(id)?.name || '?'));
const isHost = () => app.role === 'host';
const av = (p, cls = '') => `<span class="av ${cls}" style="--c:${esc(p?.color || '#888')}">${esc(p?.emoji || '🙂')}</span>`;
const alive = (id) => app.pub?.alive.includes(id);

function renderHome() {
  $('#heroLogo').innerHTML = logo('double-talk', { text: true });
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
  store('l', 'dt-me', { name: app.me.name, emoji: app.me.emoji, color: app.me.color });
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
  app.mine = {};
  app.pick = null;
  app.lastPhase = '';
  app.lastKey = '';
  app.shownOver = 0;
  $('#overlay').hidden = true;
  closeModal();
}

function beginHost(resume) {
  const code = resume ? resume.code : randomCode();
  if (resume) app.me.key = resume.me.key;
  store('s', 'dt-key', app.me.key);
  app.role = 'host';
  app.code = code;
  resetView();
  document.body.classList.add('is-host');
  setUrl(code);
  $('#netNote').textContent = 'Opening the room…';
  show('lobby');
  renderCode();
  app.host = startHost({
    code,
    me: { ...app.me },
    resume,
    onUpdate: (pub, mine) => { app.mine = mine; onPub(pub); },
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
        if (!app.welcomed) { toast('You are in! 🕵️', 'good'); hit('join', { room: code }); }
        app.welcomed = true;
        if (m.spectator) toast('A game is running, so you are watching. You join in next game.');
      } else if (m.t === 'state') {
        if (m.seq < app.seq && m.seq > 2) return;
        app.seq = m.seq;
        onPub(m.pub);
      } else if (m.t === 'hand') {
        app.mine = m;
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
  document.body.classList.remove('is-host');
  resetView();
  setUrl(null);
  renderHome();
  show('home');
}

const ERRS = {
  'says-word': 'Your clue cannot contain your secret word.',
  empty: 'Type something first.',
  self: 'You cannot vote for yourself.',
  'runoff-only': 'This is a runoff. Vote for one of the tied players.',
  'bad-target': 'That player is already out.',
  out: 'You are out this game. Watch and enjoy!',
  'not-now': 'Too late for that.',
  'need-3': `You need at least ${MIN_PLAYERS} players.`,
};
const errToast = (e) => { toast(esc(ERRS[e] || 'That did not work.'), 'bad'); sfx.bad(); };

function send(m) {
  if (isHost()) {
    const err = app.host.act(m);
    if (err) errToast(err);
  } else app.client?.send({ t: 'act', ...m });
}

function onPub(pub) {
  const prev = app.pub;
  app.pub = pub;
  if (pub.phase === 'lobby') {
    $('#overlay').hidden = true;
    show('lobby');
    renderLobby();
    return;
  }
  show('table');
  if (prev && (prev.phase !== pub.phase || prev.round !== pub.round || !!prev.runoff !== !!pub.runoff)) onPhase(prev, pub);
  else if (!prev || prev.phase === 'lobby') onPhase(null, pub);
  renderTable();
}

function renderCode() {
  $('#roomCode').textContent = app.code || '-----';
  const box = $('#qr');
  box.innerHTML = '';
  if (window.QRCode && app.code) {
    try { new window.QRCode(box, { text: inviteUrl(), width: 256, height: 256, colorDark: '#0b0620', colorLight: '#ffffff' }); } catch { /* qr failed */ }
  }
}
const inviteUrl = () => { const u = new URL(location.href); u.search = ''; u.searchParams.set('room', app.code); return u.toString(); };

function renderLobby() {
  const pub = app.pub;
  if ($('#roomCode').textContent !== pub.code) { app.code = pub.code; renderCode(); }
  const ps = pub.players.filter((p) => !p.spectator);
  $('#lobbyCount').textContent = `${ps.length} / ${MAX_PLAYERS}`;
  $('#lobbyHead').textContent = `${ps.length} player${ps.length === 1 ? '' : 's'}`;
  $('#lobbyPlayers').innerHTML = ps.map((p) => `<div class="lp ${p.on ? '' : 'off'}">${av(p)}<b>${esc(p.name)}${p.id === pub.hostId ? ' 👑' : ''}${p.bot ? ' 🤖' : ''}</b>${isHost() && p.id !== app.me.key ? `<button class="kick" data-kick="${esc(p.id)}" title="Remove">✕</button>` : ''}</div>`).join('');
  const st = pub.settings;
  const n = Math.max(MIN_PLAYERS, ps.length);
  const seg = (key, vals, fmt) => `<div class="seg">${vals.map((v) => `<button data-set="${key}" data-v="${v}" class="${st[key] === v ? 'on' : ''}">${fmt(v)}</button>`).join('')}</div>`;
  $('#hostSettings').innerHTML = isHost() ? `<div class="sett">
    <div class="sett-row"><span>Clue time</span>${seg('clueSecs', [30, 60, 90], (v) => v + 's')}</div>
    <div class="sett-row"><span>Vote time</span>${seg('voteSecs', [30, 60, 90], (v) => v + 's')}</div>
    <div class="sett-row"><span>Games per match</span>${seg('games', [1, 3, 5], (v) => v)}</div>
    <div class="sett-row"><span>Blank players <small class="note">(no word at all)</small></span>${seg('blanks', [0, 1, 2, 3], (v) => v)}</div>
    <div class="sett-row"><span>Caught Blank may guess the word</span><div class="seg"><button data-bguess="1" class="${st.blankGuess ? 'on' : ''}">On</button><button data-bguess="0" class="${st.blankGuess ? '' : 'on'}">Off</button></div></div>
    <div><div class="lbl">Word packs</div><div class="packs">${PACKS.map((p) => `<button data-pack="${p.id}" class="${st.packs.includes(p.id) ? 'on' : ''}">${p.icon} ${esc(p.name)}</button>`).join('')}</div></div>
    <p class="note">With ${n} players: ${doublesFor(n)} Imposter${doublesFor(n) === 1 ? '' : 's'}${blanksFor(n, st.blanks) ? ` and ${blanksFor(n, st.blanks)} Blank${blanksFor(n, st.blanks) === 1 ? '' : 's'}` : ''}${st.blanks > blanksFor(n, st.blanks) ? ' (more Blanks need more players)' : ''}.</p>
  </div>` : '';
  $('#guestWait').textContent = `Waiting for the host to start… (${ps.length} in the room)`;
  const startBtn = document.querySelector('[data-action="start"]');
  if (startBtn) startBtn.disabled = ps.length < MIN_PLAYERS;
}

const PHASES = {
  clue: ['Give a clue', 'Describe your word without saying it'],
  vote: ['Vote', 'Find the Imposters'],
  reveal: ['The verdict', ''],
  guess: ['Last chance', 'The Blank guesses the word'],
  over: ['Game over', ''],
};

function onPhase(prev, pub) {
  app.pick = null;
  const mine = app.mine;
  if (pub.phase === 'clue' || pub.phase === 'vote') $('#overlay').hidden = true;
  $('#overlay').dataset.kind = pub.phase;
  if (pub.phase === 'clue') {
    if (!prev || prev.phase === 'over' || prev.phase === 'lobby' || pub.round === 1) introCard();
    else banner(`Round ${pub.round}`, 'New clues, please');
    sfx.phase();
    if (mine.playing && alive(app.me.key)) buzz(30);
  } else if (pub.phase === 'vote') {
    banner(pub.runoff ? 'Runoff!' : 'Vote!', pub.runoff ? 'Only the tied players can be voted' : 'Tap who you suspect');
    sfx.phase();
    flipClues();
  } else if (pub.phase === 'reveal') showReveal(pub);
  else if (pub.phase === 'guess') showGuess(pub);
  else if (pub.phase === 'over') showOver(pub);
}

function banner(title, sub) {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.style.background = 'transparent';
  el.style.pointerEvents = 'none';
  el.innerHTML = `<div style="text-align:center"><div style="font:700 clamp(2.2rem,9vw,4rem) Fredoka,sans-serif;background:linear-gradient(90deg,#ff4fd8,#36e6ff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 18px rgba(0,0,0,.6))">${esc(title)}</div><div style="color:#fff;font-weight:600;text-shadow:0 2px 10px #000">${esc(sub)}</div></div>`;
  document.body.appendChild(el);
  if (low()) { setTimeout(() => el.remove(), 1100); return; }
  gsap.timeline({ onComplete: () => el.remove() })
    .fromTo(el.firstChild, { scale: 0.6, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(2)' })
    .to(el.firstChild, { opacity: 0, y: -20, duration: 0.3, delay: 0.7 });
}

function introCard() {
  const m = app.mine;
  if (!m.playing) { banner(`Game ${app.pub.gameNo}`, 'You are watching this one'); return; }
  const ov = $('#overlay');
  ov.hidden = false;
  ov.innerHTML = `<div class="ov-card"><p style="margin:0">Game ${app.pub.gameNo} · ${app.pub.alive.length} players · ${app.pub.doubles} Imposter${app.pub.doubles === 1 ? '' : 's'}${app.pub.blanks ? ` · ${app.pub.blanks} Blank${app.pub.blanks === 1 ? '' : 's'}` : ''}</p>
    <div class="word-card peek ${m.blank ? 'blank' : ''}" style="height:120px;margin:14px auto"><div class="wc-inner"><div class="wc-front"></div><div class="wc-back"><small>${m.blank ? 'You are' : 'Your secret word'}</small><b>${m.blank ? 'THE BLANK' : esc(m.word)}</b></div></div></div>
    <p>${m.blank ? app.pub.settings.blankGuess ? 'You have no word. Listen to the clues and blend in. If you are caught, guess the word to steal the win.' : 'You have no word. Listen to the clues and blend in with the majority. You win with the Imposters.' : 'Most players share this word. The Imposters got a similar but <b>different</b> word, and they do not know it. Maybe that is you.'}</p>
    <button class="btn big pink" data-ov-close>Got it</button></div>`;
  sfx.flip();
  if (!low()) gsap.fromTo(ov.querySelector('.wc-inner'), { rotateX: 0 }, { rotateX: 180, duration: 0.8, ease: 'back.out(1.6)', delay: 0.25 });
  setTimeout(() => { if (ov.querySelector('[data-ov-close]')) ov.hidden = true; }, 9000);
}

function flipClues() {
  if (low()) return;
  const els = $$('#grid .clue:not(.wait)');
  gsap.fromTo(els, { rotateX: -90, opacity: 0 }, { rotateX: 0, opacity: 1, duration: 0.45, stagger: Math.min(0.06, 1.2 / Math.max(1, els.length)), ease: 'back.out(1.8)' });
}

function tallyHtml(t) {
  if (!t) return '';
  const rows = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return `<div class="tally">${rows.map(([id, n]) => `<div><b>${nameOf(id)}</b><i style="width:${(n / max) * 60}%"></i><span>${n}</span></div>`).join('')}</div>`;
}

function showReveal(pub) {
  const e = pub.elim;
  const ov = $('#overlay');
  ov.hidden = false;
  if (!e || !e.id) {
    ov.innerHTML = `<div class="ov-card"><h2>🤝 Hung vote</h2><p>${e && e.tie?.length ? 'Still tied after the runoff.' : 'Nobody voted.'} Nobody is out this round.</p>${tallyHtml(e?.votes)}</div>`;
    sfx.vote();
  } else {
    const p = P(e.id);
    const cls = e.role;
    const label = e.role === 'civ' ? 'CIVILIAN' : e.role === 'dbl' ? 'IMPOSTER' : 'BLANK';
    ov.innerHTML = `<div class="ov-card">${av(p, 'ov-av')}<h2>${nameOf(e.id)} ${e.id === app.me.key ? 'are' : 'is'} out</h2>${tallyHtml(e.votes)}<p>And they were…</p><div class="big-stamp stamp ${cls}">${label}</div></div>`;
    const stamp = ov.querySelector('.big-stamp');
    if (!low()) gsap.fromTo(stamp, { scale: 3, opacity: 0, rotate: -30 }, { scale: 1, opacity: 1, rotate: -8, duration: 0.45, delay: 1.4, ease: 'back.out(2)', onStart: () => (e.role === 'civ' ? sfx.out() : sfx.caught()) });
    else (e.role === 'civ' ? sfx.out : sfx.caught)();
    if (!low()) gsap.fromTo(ov.querySelector('.ov-av'), { scale: 0.4 }, { scale: 1, duration: 0.5, ease: 'back.out(2)' });
  }
  if (!low()) gsap.fromTo(ov.firstChild, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 });
  setTimeout(() => { if (ov.dataset.kind === 'reveal' && app.pub?.phase !== 'reveal') ov.hidden = true; }, 5400);
}

function showGuess(pub) {
  const ov = $('#overlay');
  if (pub.guesser === app.me.key) {
    ov.hidden = false;
    ov.innerHTML = `<div class="ov-card"><h2>🎯 Steal the win</h2><p>You are the Blank and you got caught. Guess the word most players had. Get it right and you win alone.</p><div class="clue-row"><input id="guessIn" maxlength="30" placeholder="Your guess" autocomplete="off"><button class="btn pink" data-action="guess">Guess</button></div></div>`;
    setTimeout(() => $('#guessIn')?.focus(), 100);
  } else {
    ov.hidden = false;
    ov.innerHTML = `<div class="ov-card">${av(P(pub.guesser), 'ov-av')}<h2>${nameOf(pub.guesser)} was the Blank</h2><p>They get one guess at the word. If they get it, they win alone…</p></div>`;
  }
}

function showOver(pub) {
  const r = pub.result;
  if (!r || app.shownOver === r.gameNo) return;
  app.shownOver = r.gameNo;
  const ov = $('#overlay');
  ov.hidden = false;
  const myRole = r.roles[app.me.key];
  const won = (r.winner === 'civ' && myRole === 'civ') || (r.winner === 'odd' && myRole && myRole !== 'civ') || (r.winner === 'blank' && r.soloId === app.me.key);
  const head = r.winner === 'civ' ? '🎉 Civilians win!' : r.winner === 'odd' ? '🎭 The Imposters win!' : '🎯 The Blank steals it!';
  const sub = r.winner === 'civ' ? 'Every Imposter was caught.' : r.winner === 'odd' ? 'They blended in until the end.' : `${nameOf(r.soloId)} guessed the word.`;
  const odd = Object.entries(r.roles).filter(([, x]) => x !== 'civ');
  const board = [...pub.players].filter((p) => r.roles[p.id] || p.score).sort((a, b) => b.score - a.score).slice(0, 10);
  ov.innerHTML = `<div class="ov-card"><h2>${head}</h2><p>${sub}${myRole ? ` ${won ? 'You won this one!' : 'Better luck next time.'}` : ''}</p>
    <div class="words"><div><small>Civilians</small><b>${esc(r.civWord)}</b></div><div><small>Imposters</small><b>${esc(r.dblWord)}</b></div></div>
    <div class="roles">${odd.map(([id, x]) => `<span class="${x}">${x === 'dbl' ? '🎭' : '❔'} ${nameOf(id)}</span>`).join('')}</div>
    <div class="lbl">Scores ${r.last ? '· final' : `· game ${r.gameNo} of ${pub.settings.games}`}</div>
    <div class="board-list">${board.map((p, i) => `<div>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span style="width:20px;text-align:center">${i + 1}</span>`}${av(p)}<b>${esc(p.name)}</b><span>${p.score}</span></div>`).join('')}</div>
    <div class="ov-btns">${isHost() ? `<button class="btn big pink" data-action="next">${r.last ? '🏁 Back to lobby' : '▶ Next game'}</button>` : '<p class="note">Waiting for the host…</p>'}</div></div>`;
  (won ? sfx.win : sfx.lose)();
  if (!low()) gsap.fromTo(ov.firstChild, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' });
  if (!low()) gsap.fromTo(ov.querySelectorAll('.words div'), { rotateY: 90 }, { rotateY: 0, duration: 0.5, stagger: 0.2, delay: 0.3 });
}

function renderTable() {
  const pub = app.pub;
  const m = app.mine;
  if (!pub || pub.phase === 'lobby') return;
  const [t, sub] = PHASES[pub.phase] || ['', ''];
  $('#phaseTitle').textContent = pub.phase === 'vote' && pub.runoff ? 'Runoff vote' : t;
  $('#phaseSub').textContent = `Game ${pub.gameNo}/${pub.settings.games} · Round ${pub.round}${sub ? ' · ' + sub : ''}`;
  const wc = $('#wordCard');
  wc.classList.toggle('blank', !!m.blank);
  $('#wordLbl').textContent = m.playing ? (m.blank ? 'You are' : 'Your secret word') : 'You are watching';
  $('#wordTxt').textContent = m.playing ? (m.blank ? 'THE BLANK' : m.word) : '👀';
  const outN = Object.keys(pub.out).length;
  $('#stats').innerHTML = `<span>👥 <b>${pub.alive.length}</b> left</span><span>🎭 <b>${pub.doubles}</b> Imposter${pub.doubles === 1 ? '' : 's'}${pub.blanks ? ` · ❔ <b>${pub.blanks}</b> Blank${pub.blanks === 1 ? '' : 's'}` : ''}</span>${outN ? `<span>☠️ <b>${outN}</b> out</span>` : ''}`;
  renderGrid();
  renderDock();
}

function renderGrid() {
  const pub = app.pub;
  const me = app.me.key;
  const iAmIn = alive(me);
  const order = [...pub.alive, ...Object.keys(pub.out)];
  const voting = pub.phase === 'vote' && iAmIn;
  const myVote = app.mine.vote;
  const html = order.map((id) => {
    const p = P(id) || { id, name: '?', emoji: '❔', color: '#555' };
    const out = pub.out[id];
    const isIn = alive(id);
    const canPick = voting && id !== me && isIn && (!pub.runoff || pub.runoff.includes(id));
    let clue = '';
    if (pub.phase === 'clue') clue = isIn ? (pub.clued.includes(id) ? '<div class="clue done">✓ clue ready</div>' : '<div class="clue wait">thinking…</div>') : '';
    else if (pub.clues[id]) clue = `<div class="clue">${esc(pub.clues[id])}</div>`;
    const past = pub.history.filter((h) => !(pub.phase !== 'clue' && h.round === pub.round)).map((h) => h.clues[id]).filter(Boolean);
    const votesN = pub.tally?.[id];
    const st = pub.phase === 'vote' && isIn && pub.voted.includes(id) ? '🗳️' : '';
    const cls = ['tile', id === me ? 'me' : '', out ? 'out' : '', canPick ? 'can' : '', app.pick === id ? 'pick' : '', myVote === id && pub.phase === 'vote' ? 'mine-vote' : '', pub.runoff?.includes(id) && pub.phase === 'vote' ? 'runoff' : '', p.on === false ? 'off' : '', app.talking.has(id) ? 'talk' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}" data-pid="${esc(id)}">${votesN && pub.phase !== 'clue' ? `<span class="votes">${votesN}</span>` : ''}<span class="st">${st}</span>
      <div class="row">${av(p)}<div class="nm"><b>${esc(p.name)}${id === me ? ' (you)' : ''}</b><small>${p.score} pts</small></div></div>
      ${clue}${past.length ? `<div class="past">${past.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
      ${out ? `<span class="stamp ${out}">${out === 'civ' ? 'CIVILIAN' : out === 'dbl' ? 'IMPOSTER' : 'BLANK'}</span>` : ''}</div>`;
  }).join('');
  const key = html;
  if (app.lastKey === key) return;
  app.lastKey = key;
  $('#grid').innerHTML = html;
}

function renderDock() {
  const pub = app.pub;
  const m = app.mine;
  const me = app.me.key;
  const dock = $('#dock');
  let html = '';
  if (!m.playing) html = '<div class="hint">You are watching this game. You will be dealt in next game.</div>';
  else if (!alive(me) && pub.phase !== 'over') html = '<div class="hint">You are out. Keep watching, and no hints to the others! 🤐</div>';
  else if (pub.phase === 'clue') {
    if (m.clue) html = `<div class="hint">Your clue: <b>${esc(m.clue)}</b>. Waiting for ${pub.alive.length - pub.clued.length} more…</div>`;
    else html = `<div class="hint">${m.blank ? 'You have no word. Give a vague clue that blends in.' : 'One word or a short phrase. Do not say your word!'}</div><div class="clue-row"><input id="clueIn" maxlength="28" placeholder="Your clue" autocomplete="off" enterkeyhint="send"><button class="btn pink" data-action="clue">Send</button></div>`;
  } else if (pub.phase === 'vote') {
    if (m.vote) html = `<div class="hint">You voted for <b>${nameOf(m.vote)}</b>. Tap another player to change. ${pub.voted.length}/${pub.alive.length} voted.</div>`;
    else if (app.pick) html = `<div class="hint">Vote out <b>${nameOf(app.pick)}</b>?</div><div class="clue-row"><button class="btn ghost" data-action="unpick" style="flex:1">Cancel</button><button class="btn big pink" data-action="vote" style="flex:2">🗳️ Vote</button></div>`;
    else html = `<div class="hint">Tap the player you think has a <b>different</b> word. ${pub.voted.length}/${pub.alive.length} voted.</div>`;
  } else if (pub.phase === 'over') html = isHost() ? '<div class="clue-row"><button class="btn big pink" data-action="next">▶ Continue</button></div>' : '<div class="hint">Waiting for the host…</div>';
  else html = '<div class="hint">…</div>';
  if (dock._h === html) return;
  const typing = document.activeElement?.id === 'clueIn' ? $('#clueIn').value : null;
  dock._h = html;
  dock.innerHTML = `<div class="dock-in">${html}</div>`;
  if (typing !== null && $('#clueIn')) { $('#clueIn').value = typing; $('#clueIn').focus(); }
}

function tickTimer() {
  const pub = app.pub;
  const box = $('#timerBox');
  if (!pub || !pub.deadline || $('#table').hidden || pub.phase === 'over') { box.style.visibility = 'hidden'; return; }
  box.style.visibility = '';
  const total = (pub.phase === 'clue' ? pub.settings.clueSecs : pub.phase === 'vote' ? (pub.runoff ? 30 : pub.settings.voteSecs) : pub.phase === 'guess' ? 25 : 5.2) * 1000;
  const left = Math.max(0, pub.deadline - Date.now());
  const secs = Math.ceil(left / 1000);
  $('#timerNum').textContent = secs;
  $('#timerRing').style.strokeDashoffset = String(119.4 * (1 - Math.min(1, left / total)));
  const isLow = secs <= 10 && (pub.phase === 'clue' || pub.phase === 'vote');
  box.classList.toggle('low', isLow);
  if (isLow && secs !== app.lastTick && secs > 0) { app.lastTick = secs; if (secs <= 5) sfx.tick(); }
}
setInterval(tickTimer, 250);

function onFx(m) {
  if (m.k === 'react') floatEmoji(m.e, m.from);
  if (m.k === 'chat') toast(`${nameOf(m.from)}: ${esc(m.text)}`);
}
function floatEmoji(e, from) {
  const tile = document.querySelector(`.tile[data-pid="${CSS.escape(from)}"]`);
  const r = tile ? tile.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = e;
  el.style.left = r.left + r.width / 2 - 16 + 'px';
  el.style.top = r.top + 10 + 'px';
  document.body.appendChild(el);
  if (low()) { setTimeout(() => el.remove(), 900); return; }
  gsap.to(el, { y: -80, opacity: 0, scale: 1.6, duration: 1.3, ease: 'power1.out', onComplete: () => el.remove() });
}

function react(e) {
  const m = { t: 'react', e };
  if (isHost()) app.host.react(m);
  else app.client?.send(m);
  floatEmoji(e, app.me.key);
}

function submitClue() {
  const v = $('#clueIn')?.value.trim();
  if (!v) return errToast('empty');
  const w = app.mine.word;
  if (w && v.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').includes(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))) return errToast('says-word');
  send({ a: 'clue', text: v });
  sfx.send();
}

function rulesModal() {
  modal(`<h3>📜 How to play</h3><ol>
    <li>Everyone gets a secret word. Most players share it. The <b>Imposters</b> got a similar but different word, and they do not know they are Imposters.</li>
    <li>The host can also add <b>Blank</b> players. They get no word at all, know it, and play on the Imposters' side.</li>
    <li><b>Clues:</b> everyone types a short clue at the same time. Do not say your word. Use 🎙 or 📞 to talk it out.</li>
    <li><b>Vote:</b> everyone votes for who they think is an Imposter. A tie goes to a quick runoff.</li>
    <li>The player voted out is revealed. With the house rule on, a caught Blank gets one guess at the word and wins alone if right.</li>
    <li><b>Civilians win</b> when every Imposter and Blank is out. <b>Imposters win</b> when they match the Civilians in number.</li>
  </ol><p>Points: Civilians +2 (+1 if still in), Imposters and Blanks +4 when the Imposters win, a Blank's correct guess +6.</p><div class="modal-actions"><button class="btn pink" data-close>Got it</button></div>`);
}

function settingsModal() {
  const card = modal(`<h3>⚙️ Settings</h3>
    <label class="slider"><span>🔔 Sounds</span><input type="range" min="0" max="100" value="${Math.round(getSfxVolume() * 100)}" id="sVol"></label>
    ${qualityPicker()}
    <p class="note">Auto lowers effects when your device is busy, hot or on low battery.</p>
    <div class="modal-actions"><button class="btn pink" data-close>Done</button></div>`);
  card.querySelector('#sVol').addEventListener('input', (e) => setSfxVolume(e.target.value / 100));
  card.querySelector('#sVol').addEventListener('change', () => sfx.tap());
}

function hostMenu() {
  const card = modal(`<h3>👑 Host controls</h3><p>Players: ${app.pub.players.filter((p) => !p.spectator).length}</p><div class="modal-actions"><button class="btn ghost" data-host="lobby">🏁 End and go to lobby</button><button class="btn pink" data-close>Close</button></div>`);
  card.querySelector('[data-host="lobby"]').addEventListener('click', () => { app.host.act({ a: 'lobby' }); closeModal(); });
}

document.addEventListener('click', async (e) => {
  unlockAudio();
  const em = e.target.closest('[data-emoji]');
  if (em) { app.me.emoji = em.dataset.emoji; saveMe(); renderHome(); sfx.tap(); return; }
  const col = e.target.closest('[data-col]');
  if (col) { app.me.color = col.dataset.col; saveMe(); renderHome(); sfx.tap(); return; }
  const kick = e.target.closest('[data-kick]');
  if (kick && isHost()) { app.host.act({ a: 'kick', pid: kick.dataset.kick }); return; }
  const set = e.target.closest('[data-set]');
  if (set && isHost()) { app.host.act({ a: 'settings', patch: { [set.dataset.set]: Number(set.dataset.v) } }); sfx.tap(); return; }
  const bg = e.target.closest('[data-bguess]');
  if (bg && isHost()) { app.host.act({ a: 'settings', patch: { blankGuess: bg.dataset.bguess === '1' } }); sfx.tap(); return; }
  const pk = e.target.closest('[data-pack]');
  if (pk && isHost()) { app.host.act({ a: 'settings', patch: { pack: pk.dataset.pack } }); sfx.tap(); return; }
  const rc = e.target.closest('[data-react]');
  if (rc) { react(rc.dataset.react); return; }
  if (e.target.closest('[data-ov-close]')) { $('#overlay').hidden = true; return; }
  const tile = e.target.closest('.tile.can');
  if (tile) {
    const id = tile.dataset.pid;
    if (app.mine.vote && app.mine.vote !== id) { send({ a: 'vote', target: id }); sfx.vote(); return; }
    app.pick = app.pick === id ? null : id;
    sfx.tap();
    renderGrid();
    renderDock();
    return;
  }
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  if (a === 'create') { if (needName()) beginHost(null); }
  else if (a === 'join') {
    const code = $('#codeIn').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (!needName()) return;
    if (code.length !== 5) { toast('Room codes have 5 characters.', 'bad'); return; }
    beginJoin(code);
  } else if (a === 'resume') { if (needName()) beginHost(savedHost()); }
  else if (a === 'forget') { clearSavedHost(); renderHome(); }
  else if (a === 'rules') rulesModal();
  else if (a === 'credits') modal('<h3>Credits &amp; privacy</h3><p>Double Talk is an original game by Party Pit. Fonts from Google Fonts, animation by GSAP.</p><p>Each game records your IP address and play name for usage statistics. Voice is relayed live and never stored.</p><div class="modal-actions"><button class="btn pink" data-close>OK</button></div>');
  else if (a === 'settings') settingsModal();
  else if (a === 'hostmenu') hostMenu();
  else if (a === 'leave') { if (!app.pub || app.pub.phase === 'lobby' || confirmLeave()) leaveRoom(false); }
  else if (a === 'copy') { try { await navigator.clipboard.writeText(inviteUrl()); toast('Invite link copied!', 'good'); } catch { toast(esc(inviteUrl())); } }
  else if (a === 'share') { if (navigator.share) navigator.share({ title: 'Double Talk', text: `Join my Double Talk room ${app.code}`, url: inviteUrl() }).catch(() => {}); else toast(esc(inviteUrl())); }
  else if (a === 'addbot') app.host.act({ a: 'bot' });
  else if (a === 'start') { unlockAudio(); app.host.act({ a: 'start' }); hit('game', { room: app.code, players: app.pub.players.length }); }
  else if (a === 'clue') submitClue();
  else if (a === 'unpick') { app.pick = null; renderGrid(); renderDock(); }
  else if (a === 'vote' && app.pick) { send({ a: 'vote', target: app.pick }); sfx.vote(); buzz(20); app.pick = null; }
  else if (a === 'guess') { const v = $('#guessIn')?.value.trim(); if (v) { send({ a: 'guess', text: v }); $('#overlay').hidden = true; } }
  else if (a === 'next') { app.host.act({ a: 'next' }); $('#overlay').hidden = true; }
});

let leaveAsked = 0;
function confirmLeave() {
  if (Date.now() - leaveAsked < 4000) return true;
  leaveAsked = Date.now();
  toast('Tap 🚪 again to leave the game.');
  return false;
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'clueIn') submitClue();
  if (e.target.id === 'guessIn') document.querySelector('[data-action="guess"]')?.click();
  if (e.target.id === 'codeIn') document.querySelector('[data-action="join"]')?.click();
  if (e.target.id === 'nameIn') saveMe();
});
$('#nameIn').addEventListener('change', saveMe);

function setupPeek() {
  const wc = $('#wordCard');
  const on = (e) => { e.preventDefault(); wc.classList.add('peek'); sfx.flip(); };
  const off = () => wc.classList.remove('peek');
  wc.addEventListener('pointerdown', on);
  wc.addEventListener('pointerup', off);
  wc.addEventListener('pointerleave', off);
  wc.addEventListener('pointercancel', off);
  wc.addEventListener('contextmenu', (e) => e.preventDefault());
}

window.addEventListener('beforeunload', (e) => {
  if (isHost() && app.pub && app.pub.phase !== 'lobby' && app.pub.players.some((p) => p.on && !p.bot && p.id !== app.me.key)) { e.preventDefault(); e.returnValue = ''; }
});

$('#reactBar').innerHTML = REACTS.map((e) => `<button data-react="${e}" aria-label="React ${e}">${e}</button>`).join('');
setupPeek();
initPwa({ toast: (m, k) => toast(esc(m), k) });
initVoice({
  me: () => app.me.key,
  enabled: () => !!app.pub && !!(app.host || app.client),
  players: () => app.pub?.players || [],
  toast: (m, k) => toast(esc(m), k),
  sfx: { turn: () => sfx.phase(), click: () => sfx.tap(), pop: () => sfx.send() },
  onSpeaking: (pid, lv) => {
    if (lv > 0.02) app.talking.set(pid, Date.now());
    const t = document.querySelector(`.tile[data-pid="${CSS.escape(pid)}"]`);
    if (t) { t.classList.toggle('talk', lv > 0.02); clearTimeout(t._tk); t._tk = setTimeout(() => { t.classList.remove('talk'); app.talking.delete(pid); }, 400); }
  },
});
onQuality(() => {});
initQuality();
renderHome();
hit('visit');

const saved = savedHost();
const roomParam = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
if (saved && roomParam === saved.code && saved.me?.key === app.me.key) beginHost(saved);
else if (roomParam && app.me.name && !params.has('nojoin')) setTimeout(() => { if (!app.role) beginJoin(roomParam); }, 50);
initFeedback({ game: 'double-talk' });
