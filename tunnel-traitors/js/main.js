import { initVoice } from '../../shared/voice.js';
import { initQuality, onQuality } from '../../shared/perf.js';
import { initFeedback } from '../../shared/feedback.js';
import { joinHost, randomCode, RELAY_URL } from './net.js';
import { startHost, savedHost, clearSavedHost } from './host.js';
import * as R from './rules.js';
import { Board, tileSvg, actionArt } from './board.js';
import { sfx, unlockAudio, getSfxVolume, setSfxVolume, burst, center, floatText, banner, shake, confetti, fireworks, toast as fxToast, onSfx } from './fx.js';
import { setMood, kickMusic, getMusicVolume, setMusicVolume, duck } from './music.js';
import { initPwa, keepAwake } from './pwa.js';

const AVATARS = ['⛏️', '🧔', '👷', '👩‍🔧', '🧑‍🚒', '🤠', '🦫', '🐀', '🦡', '🐻', '🦉', '🐸', '👹', '🧌', '🧙', '🥷', '🕵️', '🤖', '👽', '💀', '🦝', '🐲', '🧛', '🧟'];
const COLORS = ['#f5a524', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#f97316', '#e5e7eb'];
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
  const saved = store('l', 'tt-me') || {};
  let key = store('s', 'tt-key');
  if (!key) { key = rid(); store('s', 'tt-key', key); }
  return {
    key,
    name: saved.name || '',
    avatar: saved.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
    color: saved.color || COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

const app = {
  me: loadMe(), role: null, code: null, pub: null, priv: null, seq: -1, host: null, client: null,
  sel: null, recvAt: 0, welcomed: false, lastLog: 0, lastTickSec: -1, roleShownFor: -1, board: null,
  showRole: false, endShown: -1, inGame: false, retry: null, gameHit: -1, lastTurnNo: -1, claimOpen: null, voices: {},
};

function hit(kind, extra = {}) {
  if (params.has('nohit')) return;
  try { fetch(RELAY_URL + '/hit', { method: 'POST', body: JSON.stringify({ game: 'tunnel-traitors', kind, name: app.me.name || '', wd: navigator.webdriver ? 1 : 0, ...extra }), keepalive: true, mode: 'cors' }).catch(() => {}); } catch { /* offline */ }
}

const toast = (msg, kind = '') => fxToast(msg, kind);

function modal(html, { wide = false, onClose, cls = '', sticky = false } = {}) {
  const m = $('#modal');
  const card = $('#modalCard');
  card.className = 'modal-card' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '');
  card.innerHTML = html;
  m.hidden = false;
  m._onClose = onClose;
  m._sticky = sticky;
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
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('#modal')._sticky) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) { if (!$('#modal')._sticky) closeModal(); } else clearSel(); }
  if ((e.key === 'r' || e.key === 'R') && !/input|textarea/i.test(e.target.tagName)) rotateSel();
});

function ask(title, body, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const card = modal(`<h3>${esc(title)}</h3><p>${body}</p><div class="modal-actions"><button class="btn ghost" data-x="no">Cancel</button><button class="btn ${danger ? 'danger' : 'gold'}" data-x="yes">${esc(okLabel)}</button></div>`, {
      onClose: () => { if (!done) resolve(false); },
    });
    card.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => { done = true; closeModal(); resolve(b.dataset.x === 'yes'); }));
  });
}

function promptText(title, placeholder, maxlen = 140) {
  return new Promise((resolve) => {
    let done = false;
    const card = modal(`<h3>${esc(title)}</h3><input id="pIn" maxlength="${maxlen}" placeholder="${esc(placeholder)}" autocomplete="off"><div class="modal-actions"><button class="btn ghost" data-x="no">Cancel</button><button class="btn gold" data-x="yes">Send</button></div>`, {
      onClose: () => { if (!done) resolve(null); },
    });
    const input = card.querySelector('#pIn');
    setTimeout(() => input.focus(), 50);
    const finish = (ok) => { done = true; const v = input.value.trim(); closeModal(); resolve(ok && v ? v : null); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); });
    card.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.x === 'yes')));
  });
}

function show(screen) {
  for (const id of ['home', 'lobby', 'game']) {
    const el = document.getElementById(id);
    const on = id === screen;
    if (el.hidden === !on) continue;
    el.hidden = !on;
    if (on && gsap) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.35 });
  }
  keepAwake(screen !== 'home');
  setMood(screen === 'game' ? 'play' : 'lobby');
}

const avatar = (p, extra = '') => `<div class="av ${extra}" style="--c:${esc(p?.color || '#555')}">${esc(p?.avatar || '❔')}</div>`;
const P = (id) => app.pub?.players.find((p) => p.id === id);
const meP = () => P(app.me.key);
const isHost = () => app.role === 'host';
const myTurn = () => app.pub && app.pub.phase === 'play' && app.pub.turn === app.me.key;
const nm = (id) => { const p = P(id); return p ? `${p.avatar} ${p.name}` : 'Someone'; };

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
  store('l', 'tt-me', { name: app.me.name, avatar: app.me.avatar, color: app.me.color });
}

function needName() {
  saveMe();
  if (app.me.name) return true;
  toast('Type your name first.', 'bad');
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

function resetRoomState() {
  app.seq = -1;
  app.pub = null;
  app.priv = null;
  app.sel = null;
  app.lastLog = 0;
  app.roleShownFor = -1;
  app.endShown = -1;
}

function beginHost(resume) {
  const code = resume ? resume.code : randomCode();
  if (resume) app.me.key = resume.me.key;
  store('s', 'tt-key', app.me.key);
  app.role = 'host';
  app.code = code;
  resetRoomState();
  setUrl(code);
  $('#netNote').textContent = 'Opening the mine…';
  show('lobby');
  app.host = startHost({
    code,
    me: { ...app.me },
    resume,
    bots: Math.min(40, parseInt(params.get('bots') || '0', 10) || 0),
    onUpdate: (pub, priv) => { onPriv(priv); onPub(pub); },
    onFx,
    onReady: () => { $('#netNote').textContent = 'The mine is open. Share the code!'; },
    onError: () => { $('#netNote').textContent = 'Network trouble. Retrying…'; toast('Could not reach the game servers. Check your connection.', 'bad'); },
  });
  hit('host', { room: code });
}

function beginJoin(code) {
  app.role = 'client';
  app.code = code;
  resetRoomState();
  app.welcomed = false;
  store('s', 'tt-seat', { code });
  setUrl(code);
  toast(`Joining mine ${code}…`);
  const join = () => app.client && app.client.send({ t: 'join', key: app.me.key, name: app.me.name, avatar: app.me.avatar, color: app.me.color });
  app.client = joinHost(code, {
    onOpen: () => join(),
    onData: (m) => {
      if (!m) return;
      if (m.t === 'welcome') {
        if (!app.welcomed) { toast('You are in! ⛏️', 'good'); hit('join', { room: code }); }
        app.welcomed = true;
        if (m.spectator) toast('The mine is full, so you are watching as a spectator.');
        else if (m.wait) toast('A round is underway. You will get a role when the next round starts.');
      } else if (m.t === 'state') {
        if (m.seq < app.seq && m.seq > 2) return;
        app.seq = m.seq;
        onPub(m.pub);
      } else if (m.t === 'priv') {
        onPriv(m.priv);
        if (app.pub) { renderGame(); maybeShowRole(); maybeClaim(); }
      } else if (m.t === 'fx') {
        onFx(m);
      } else if (m.t === 'rejoin') {
        join();
      } else if (m.t === 'kicked') {
        toast('The host removed you from the mine.', 'bad');
        leaveRoom(true);
      } else if (m.t === 'err') {
        errToast(m.err);
      }
    },
    onClose: () => { if (app.welcomed) toast('Connection hiccup, reconnecting…'); },
    onError: (e) => {
      toast(e.type === 'peer-unavailable' ? `Mine ${code} was not found. Check the code.` : 'Could not connect. Check your connection.', 'bad');
      leaveRoom(true);
    },
  });
}

function errToast(err) {
  const msg = {
    'tools-broken': 'Your tools are broken. Fix them first, or play an action card or discard.',
    illegal: 'That tunnel does not fit there.',
    'bad-target': 'You can\'t use that card on that target.',
    'not-your-turn': 'It is not your turn.',
    'claim-first': 'Report what you surveyed first.',
    'say-something': 'Type a message or record a voice note.',
    'pick-verdict': 'Pick GOLD or ROCK first.',
  }[err];
  if (msg) toast(msg, 'bad');
}

function leaveRoom(silent) {
  if (app.host) { app.host.destroy(); app.host = null; }
  if (app.client) {
    if (!silent) app.client.send({ t: 'leave' });
    const c = app.client;
    app.client = null;
    setTimeout(() => c.destroy(), 150);
  }
  store('s', 'tt-seat', null);
  app.role = null;
  resetRoomState();
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

function playCard(extra) {
  const p = app.pub;
  const m = { t: 'act', a: 'play', ctx: p.roundId + ':' + p.turnNo, ...extra };
  const res = send(m);
  if (res) { errToast(res); return; }
  clearSel();
  if (app.role === 'client') {
    clearTimeout(app.retry);
    let n = 0;
    const sentAt = app.pub.log.length ? app.pub.log[app.pub.log.length - 1].i : 0;
    const again = () => {
      if (!app.client || !app.pub || app.pub.roundId + ':' + app.pub.turnNo !== m.ctx || n++ >= 3) return;
      if (app.pub.await || app.pub.log.some((e) => e.i > sentAt && e.pid === app.me.key)) return;
      app.client.send(m);
      app.retry = setTimeout(again, 2500);
    };
    app.retry = setTimeout(again, 2500);
  }
}

function onPriv(priv) {
  const prev = app.priv;
  app.priv = priv;
  if (app.sel && !priv.hand.some((c) => c.id === app.sel.id)) app.sel = null;
  if (prev && priv.rid === prev.rid && priv.role !== prev.role && priv.role) {
    sfx.reveal();
    showRoleCard('Your badge was swapped!');
  }
  if (prev && priv.rid === prev.rid) {
    for (const [pid, role] of Object.entries(priv.intel)) {
      if (prev.intel[pid] !== role) {
        const r = R.ROLES[role];
        modal(`<div class="intel"><div class="big-ic">🕵️</div><h3>${esc(nm(pid))}</h3><p>is secretly a <b class="role-${role}">${r.icon} ${r.name}</b></p><p class="muted small">Only you know this. Use it wisely.</p><div class="modal-actions"><button class="btn gold" data-close>Got it</button></div></div>`);
      }
    }
    for (const gi of Object.keys(priv.peeks)) if (prev.peeks[gi] === undefined) sfx.peek();
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
  if (app.gameHit !== pub.roundId && pub.round === 1 && !app.inGame) {
    app.inGame = true;
    app.gameHit = pub.roundId;
    hit('game', { room: pub.code, players: pub.players.filter((x) => !x.bot && !x.spectator).length });
  }
  app.inGame = true;
  const firstView = !prev || prev.phase === 'lobby';
  show('game');
  if (firstView) {
    app.lastLog = pub.log.length ? pub.log[pub.log.length - 1].i : 0;
  }
  if (prev && prev.phase !== 'lobby') {
    const known = new Set(prev.players.map((x) => x.id));
    for (const x of pub.players) {
      if (known.has(x.id) || x.id === app.me.key) continue;
      toast(`${x.avatar} ${x.name} ${x.spectator ? 'is watching' : 'joined the mine'}`, 'good');
    }
  }
  renderGame();
  const fresh = pub.log.filter((e) => e.i > app.lastLog);
  if (fresh.length) app.lastLog = fresh[fresh.length - 1].i;
  if (fresh.length > 12) fresh.splice(0, fresh.length - 12);
  fresh.forEach((e, i) => setTimeout(() => animateLog(e), i * 120));
  if (pub.phase === 'play' && pub.turn === app.me.key && app.lastTurnNo !== pub.turnNo) {
    sfx.turn();
    if ($('#modal').hidden && !document.body.classList.contains('calm')) banner('YOUR TURN', 'Dig · Sabotage · Discard', '#ffd36b', 1.2);
    try { navigator.vibrate?.([20, 40, 20]); } catch { /* not supported */ }
  }
  if (app.lastTurnNo !== pub.turnNo) requestAnimationFrame(() => $('#players .pl.turn')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  app.lastTurnNo = pub.turnNo;
  maybeShowRole();
  maybeClaim();
  if ((pub.phase === 'end' || pub.phase === 'over') && app.endShown !== pub.roundId) {
    app.endShown = pub.roundId;
    setTimeout(() => showResult(), fresh.some((e) => e.a === 'reveal') ? 1600 : 400);
  }
  if (pub.phase === 'end' && prev && prev.phase === 'end' && !$('#modal').hidden) updateResultTimer();
  const nearGold = pub.phase === 'play' && (pub.goals.some((g) => g.open) || pub.deck < pub.order.length);
  setMood(pub.phase === 'play' ? (nearGold ? 'tension' : 'play') : pub.phase === 'over' ? 'victory' : 'play');
}

function maybeShowRole() {
  const pub = app.pub;
  if (!pub || pub.phase !== 'play' || app.roleShownFor === pub.roundId || !app.priv || app.priv.rid !== pub.roundId || !app.priv.role) return;
  app.roleShownFor = pub.roundId;
  setTimeout(() => showRoleCard(`Round ${pub.round} of ${pub.settings.rounds}`), 350);
}

const QUICK = {
  gold: ['It\'s GOLD, dig to vein {n}!', 'Trust me, {n} is the one 💰', 'Vein {n} is shining!'],
  rock: ['Vein {n} is just rock 🪨', 'Skip {n}, nothing there', '{n} is a dead end, trust me'],
};

function maybeClaim() {
  const pub = app.pub;
  if (!pub || pub.phase !== 'play' || !pub.await || pub.await.pid !== app.me.key) return;
  if (app.claimOpen === pub.roundId + ':' + pub.turnNo) return;
  if (!app.priv || app.priv.rid !== pub.roundId || app.priv.peeks[pub.await.goal] === undefined) return;
  openClaim();
}

function openClaim() {
  const pub = app.pub;
  const a = pub.await;
  app.claimOpen = pub.roundId + ':' + pub.turnNo;
  const gi = a.goal;
  const n = gi + 1;
  const saw = app.priv?.peeks?.[gi];
  const st = { says: null, voice: null, rec: null, sent: false };
  const card = modal(`<div class="claim">
      <div class="claim-head"><div class="survey-tile sm">${tileSvg(saw ? 'gold' : saw === false ? 'rockL' : 'back')}</div>
        <div><h3>📣 Report vein ${n}</h3><p class="muted small">You secretly saw <b class="${saw ? 'gold-t' : ''}">${saw ? 'GOLD' : 'ROCK'}</b>. Now tell the mine what you saw. You may tell the truth or bluff.</p></div></div>
      <div class="seg verdict"><button data-says="gold">💰 It's GOLD</button><button data-says="rock">🪨 It's ROCK</button></div>
      <div class="quick" id="cQuick"></div>
      <div class="claim-input"><input id="cText" maxlength="160" placeholder="Type what you tell everyone…" autocomplete="off">
        <button class="btn small ghost mic" id="cMic" type="button">🎤</button></div>
      <div class="voice-row" id="cVoice" hidden><button class="btn small ghost" id="cPlay" type="button">▶ Play</button><span class="muted small" id="cVLen"></span><button class="mini danger" id="cDel" type="button">Delete</button></div>
      <p class="muted small req">A typed message or a voice note is required. <span id="cLeft"></span></p>
      <div class="modal-actions"><button class="btn gold" id="cSend" disabled>📣 Announce</button></div>
    </div>`, { sticky: true, cls: 'claim-modal' });
  const text = card.querySelector('#cText');
  const sendBtn = card.querySelector('#cSend');
  const mic = card.querySelector('#cMic');
  const ok = () => { sendBtn.disabled = !st.says || (text.value.trim().length < 2 && !st.voice); };
  const quick = () => {
    card.querySelector('#cQuick').innerHTML = st.says ? QUICK[st.says].map((q) => `<button type="button" data-q="${esc(q.replace('{n}', n))}">${esc(q.replace('{n}', n))}</button>`).join('') : '';
  };
  card.querySelectorAll('[data-says]').forEach((b) => b.addEventListener('click', () => {
    st.says = b.dataset.says;
    card.querySelectorAll('[data-says]').forEach((x) => x.classList.toggle('on', x === b));
    sfx.select();
    quick();
    ok();
  }));
  card.querySelector('#cQuick').addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (!q) return;
    text.value = q.dataset.q;
    ok();
  });
  text.addEventListener('input', ok);
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !sendBtn.disabled) sendBtn.click(); });
  const stopRec = () => { if (st.rec && st.rec.state === 'recording') st.rec.stop(); };
  mic.addEventListener('click', async () => {
    if (st.rec && st.rec.state === 'recording') { stopRec(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Voice notes are not supported in this browser. Type instead.', 'bad'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { toast('Microphone access was blocked. Type your message instead.', 'bad'); return; }
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
    const chunks = [];
    const t0 = Date.now();
    st.rec = rec;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const tick = setInterval(() => { mic.textContent = `⏹ ${Math.ceil((Date.now() - t0) / 1000)}s`; }, 250);
    const cap = setTimeout(stopRec, 12000);
    rec.onstop = () => {
      clearInterval(tick);
      clearTimeout(cap);
      stream.getTracks().forEach((t) => t.stop());
      mic.textContent = '🎤';
      mic.classList.remove('rec');
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      const fr = new FileReader();
      fr.onload = () => {
        st.voice = String(fr.result).replace(/^data:audio\/([^;,]+)(;[^,]*)?;base64,/, (m0) => m0);
        if (st.voice.length > 215000) { st.voice = null; toast('That voice note is too long. Keep it under 12 seconds.', 'bad'); }
        card.querySelector('#cVoice').hidden = !st.voice;
        card.querySelector('#cVLen').textContent = st.voice ? `${((Date.now() - t0) / 1000).toFixed(1)} s voice note` : '';
        ok();
      };
      fr.readAsDataURL(blob);
    };
    rec.start();
    mic.classList.add('rec');
    sfx.click();
  });
  card.querySelector('#cPlay').addEventListener('click', () => { if (st.voice) new Audio(st.voice).play().catch(() => {}); });
  card.querySelector('#cDel').addEventListener('click', () => { st.voice = null; card.querySelector('#cVoice').hidden = true; ok(); });
  const left = setInterval(() => {
    if (!document.body.contains(card) || $('#modal').hidden || !app.pub?.await || app.pub.await.pid !== app.me.key) { clearInterval(left); stopRec(); if (!st.sent && $('#modal')._sticky && card.classList.contains('claim-modal')) closeModal(); return; }
    const rem = Math.max(0, app.pub.left - (performance.now() - app.recvAt));
    const el = card.querySelector('#cLeft');
    if (el) el.textContent = `${Math.ceil(rem / 1000)} s left, or you will be marked as silent 🤐.`;
  }, 300);
  sendBtn.addEventListener('click', () => {
    if (sendBtn.disabled) return;
    st.sent = true;
    clearInterval(left);
    const p = app.pub;
    const m = { t: 'act', a: 'claim', ctx: p.roundId + ':' + p.turnNo, says: st.says, text: text.value.trim(), voice: st.voice || undefined };
    $('#modal')._sticky = false;
    closeModal();
    const res = send(m);
    if (res) { toast('Could not announce that. Try again.', 'bad'); app.claimOpen = null; return; }
    if (app.role === 'client') {
      let n2 = 0;
      const again = () => { if (!app.client || !app.pub?.await || app.pub.await.pid !== app.me.key || n2++ >= 3) return; app.client.send(m); setTimeout(again, 3000); };
      setTimeout(again, 3000);
    }
  });
  if (window.matchMedia('(pointer: fine)').matches) setTimeout(() => text.focus(), 150);
}

function claimBubble(e) {
  const g = app.pub?.goals?.[e.goal];
  const c = g && app.board ? app.board.screenOf(g.x, g.y) : null;
  const p = P(e.pid);
  if (!p) return;
  const b = document.createElement('div');
  b.className = 'claim-bubble ' + (e.says || 'silent');
  const verdict = e.auto ? '🤐 said nothing' : e.says === 'gold' ? '💰 GOLD' : '🪨 ROCK';
  b.innerHTML = `<div class="cb-head">${avatar(p, 'sm')}<b>${esc(p.name)}</b><span class="cb-v">${verdict}</span><span class="cb-n">vein ${e.goal + 1}</span></div>${e.text ? `<div class="cb-t">“${esc(e.text)}”</div>` : ''}${e.voice ? `<button class="cb-play" data-voice="${esc(e.pid)}:${e.goal}">🔊 Play voice note</button>` : ''}`;
  document.body.append(b);
  const w = b.offsetWidth, h = b.offsetHeight;
  const x = c ? Math.max(10, Math.min(innerWidth - w - 10, c.x - w - c.size * 0.6)) : (innerWidth - w) / 2;
  const y = c ? Math.max(70, Math.min(innerHeight - h - 160, c.y - h / 2)) : innerHeight * 0.3;
  b.style.left = x + 'px';
  b.style.top = y + 'px';
  if (gsap) {
    gsap.fromTo(b, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
    gsap.to(b, { opacity: 0, y: -12, delay: e.voice ? 9 : 6.5, duration: 0.5, onComplete: () => b.remove() });
  } else setTimeout(() => b.remove(), 7000);
}

function playVoice(key) {
  const data = app.voices[key];
  if (!data) return;
  try { duck(1); new Audio(data).play().catch(() => toast('Tap 🔊 to hear the voice note.')); } catch { /* audio unavailable */ }
}

function showRoleCard(sub) {
  const role = app.priv?.role;
  if (!role) return;
  const r = R.ROLES[role];
  const pub = app.pub;
  const inPlay = pub.rolesInPlay;
  const card = modal(`<div class="role-reveal">
      <p class="muted">${esc(sub)}</p>
      <div class="flip"><div class="flip-in">
        <div class="face back"><span>⛏️</span><b>Tunnel Traitors</b></div>
        <div class="face front role-${role}"><div class="ric">${r.icon}</div><div class="rname">${r.name}</div><p>${esc(r.desc)}</p></div>
      </div></div>
      <p class="muted small">${inPlay ? `This round: ${inPlay.traitors} traitor${inPlay.traitors === '1' ? '' : 's'} hiding among ${pub.order.length} players.` : ''} Keep your role to yourself.</p>
      <div class="modal-actions"><button class="btn gold" data-close>Let's dig</button></div>
    </div>`, { cls: 'role-modal' });
  const inner = card.querySelector('.flip-in');
  sfx.reveal();
  if (gsap) gsap.fromTo(inner, { rotationY: 0 }, { rotationY: 180, duration: 0.9, delay: 0.5, ease: 'back.out(1.4)' });
  else inner.style.transform = 'rotateY(180deg)';
}

function showResult() {
  const pub = app.pub;
  const res = pub.result;
  if (!res) return;
  const dig = res.side === 'dig';
  const why = res.why === 'gold'
    ? (dig ? `${esc(nm(res.finder))} struck gold!` : 'Gold reached, but sealed behind the wrong doors!')
    : res.why === 'abandon' ? 'Too many miners left the mine.' : 'The cards ran out before anyone reached the gold.';
  const head = dig ? '💰 The diggers win!' : '🗡️ The traitors win!';
  const rows = pub.order.map((id) => {
    const p = P(id);
    if (!p) return '';
    const role = res.roles?.[id];
    const r = role ? R.ROLES[role] : null;
    const got = res.pay[id] || 0;
    return `<div class="rrow ${id === app.me.key ? 'me' : ''}">${avatar(p)}<div class="nm">${esc(p.name)}${r ? `<small class="role-${role}">${r.icon} ${r.name}</small>` : ''}</div><div class="got ${got ? 'yes' : ''}">${got ? '+' + got + ' 💰' : '—'}</div><div class="tot">${p.gold}</div></div>`;
  }).join('');
  const thefts = (res.thefts || []).map((t) => `<li>🫳 ${esc(nm(t.by))} pickpocketed ${esc(nm(t.from))}</li>`).join('');
  const over = pub.phase === 'over';
  const card = modal(`<div class="result ${dig ? 'dig' : 'trt'}">
      <h2>${head}</h2><p class="why">${why}</p>
      ${res.crewsOk ? `<p class="muted small">Amber crew ${res.crewsOk.a ? 'got through ✅' : 'was blocked ❌'} · Cobalt crew ${res.crewsOk.c ? 'got through ✅' : 'was blocked ❌'}</p>` : ''}
      <div class="rlist"><div class="rrow head"><span></span><span>Miner</span><span>This round</span><span>Total</span></div>${rows}</div>
      ${thefts ? `<ul class="thefts">${thefts}</ul>` : ''}
      ${over ? podiumHtml() : `<p class="muted small" id="nextIn">Next round soon…</p>`}
      <div class="modal-actions">
        ${isHost() ? (over ? '<button class="btn gold" data-action="again">⛏️ Back to the lobby</button>' : '<button class="btn gold" data-action="next">Next round now</button>') : ''}
        <button class="btn ghost" data-close>${over ? 'Close' : 'See the board'}</button>
      </div></div>`, { wide: true, cls: 'result-modal' });
  const meGot = res.pay[app.me.key] || 0;
  if (dig) { sfx.gold(); confetti(innerWidth / 2, innerHeight * 0.3, ['#f5b81c', '#fff3b0', '#ffd36b']); } else sfx.sting();
  if (gsap) gsap.from(card.querySelectorAll('.rrow:not(.head)'), { x: -30, opacity: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out' });
  if (meGot) setTimeout(() => { sfx.coin(); floatText(innerWidth / 2, innerHeight / 2, `+${meGot} 💰`, { color: '#ffd36b', size: 40 }); }, 600);
  if (over) {
    setTimeout(() => { sfx.fanfare(); fireworks(4); }, 700);
  }
  updateResultTimer();
}

function podiumHtml() {
  const pod = app.pub.podium || [];
  const top = pod.slice(0, 3);
  const medal = ['🥇', '🥈', '🥉'];
  return `<div class="podium">${top.map((x, i) => { const p = P(x.id); return p ? `<div class="pod p${i + 1}">${avatar(p, 'big')}<b>${esc(p.name)}</b><span>${medal[i]} ${x.gold} gold</span></div>` : ''; }).join('')}</div>`;
}

function updateResultTimer() {
  const el = document.getElementById('nextIn');
  if (!el || !app.pub || app.pub.phase !== 'end') return;
  const rem = Math.max(0, app.pub.left - (performance.now() - app.recvAt));
  el.textContent = `Round ${app.pub.round + 1} of ${app.pub.settings.rounds} starts in ${Math.ceil(rem / 1000)} s. New secret roles for everyone.`;
}

function logLine(e) {
  const who = esc(nm(e.pid));
  const tgt = e.target ? esc(nm(e.target)) : '';
  const tool = e.tool ? `${R.TOOL_ICON[e.tool]} ${R.TOOLS[e.tool]}` : '';
  switch (e.a) {
    case 'place': return `${who} dug a ${R.cardName(e.k)}`;
    case 'discard': return `${who} discarded a card`;
    case 'break': return `${who} broke ${tgt}'s ${tool}`;
    case 'fix': return e.pid === e.target ? `${who} fixed their own ${tool}` : `${who} fixed ${tgt}'s ${tool}`;
    case 'cave': return `${who} caved in a tunnel`;
    case 'dyn': return `${who} set off DYNAMITE 🧨`;
    case 'survey': return `${who} surveyed vein ${e.goal + 1} 🔍 and must report…`;
    case 'claim': return e.auto ? `${who} stayed silent about vein ${e.goal + 1} 🤐` : `📣 ${who}: vein ${e.goal + 1} is ${e.says === 'gold' ? '💰 GOLD' : '🪨 ROCK'}${e.text ? ` · “${esc(e.text)}”` : ''}${e.voice ? ' 🎙️' : ''}`;
    case 'reveal': return e.gold ? `💰 GOLD in vein ${e.goal + 1}!` : `🪨 Vein ${e.goal + 1} is just rock`;
    case 'pick': return `${who} is ready to pickpocket 🫳`;
    case 'handsoff': return `${who} stopped ${tgt}'s pickpocket 🙅`;
    case 'shack': return `${who} shackled ${tgt} ⛓️`;
    case 'free': return `${who} freed ${tgt} ✂️`;
    case 'interro': return `${who} interrogated ${tgt} 🕵️`;
    case 'badge': return `${who} swapped ${tgt === who ? 'their own' : tgt + "'s"} badge 🎭`;
    case 'hswap': return `${who} swapped hands with ${tgt} 🔄`;
    case 'flood': return `${who} flooded a tunnel cell 🌊`;
    case 'pump': return `${who} pumped out a flood 🚰`;
    case 'bats': return `${who} set bats on ${tgt} 🦇`;
    case 'round': return `⛏️ Round ${e.round} begins`;
    case 'end': return e.side === 'dig' ? '💰 Round over: diggers win' : '🗡️ Round over: traitors win';
    default: return '';
  }
}

function feed(e) {
  const line = logLine(e);
  if (!line) return;
  const box = $('#feed');
  const d = document.createElement('div');
  d.className = 'fl ' + e.a;
  d.innerHTML = line;
  box.append(d);
  while (box.children.length > 4) box.firstElementChild.remove();
  if (gsap) {
    gsap.fromTo(d, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 });
    gsap.to(d, { opacity: 0, delay: 7, duration: 0.6, onComplete: () => d.remove() });
  }
}

const rowOf = (pid) => document.querySelector(`.pl[data-pid="${CSS.escape(pid || '')}"]`);

function animateLog(e) {
  feed(e);
  const b = app.board;
  const calm = document.body.classList.contains('calm');
  const at = (x, y) => (b ? b.screenOf(x, y) : null);
  switch (e.a) {
    case 'place': {
      sfx.dig();
      const el = b.tileAt(e.x, e.y);
      if (el) {
        b.dropIn(el);
        el.style.setProperty('--pc', P(e.pid)?.color || '#ffd36b');
        el.classList.remove('just');
        void el.offsetWidth;
        el.classList.add('just');
        setTimeout(() => el.classList.remove('just'), 2600);
      }
      b.ensureVisible(e.x, e.y);
      const c = at(e.x, e.y);
      if (c && !calm) setTimeout(() => burst(c.x, c.y + c.size * 0.3, { colors: ['#8c6a48', '#d8b48a', '#5b4130'], n: 16, speed: 3, size: 3, life: 40 }), 300);
      break;
    }
    case 'discard': sfx.flip(); break;
    case 'break': {
      sfx.clank();
      const r = rowOf(e.target);
      if (r) { shake(r, 8); const c = center(r); floatText(c.x, c.y, '💥' + R.TOOL_ICON[e.tool], { size: 28 }); }
      break;
    }
    case 'fix': {
      sfx.fix();
      const r = rowOf(e.target);
      if (r) { const c = center(r); floatText(c.x, c.y, '✨' + R.TOOL_ICON[e.tool], { size: 26 }); }
      break;
    }
    case 'cave': {
      sfx.rumble();
      const c = at(e.x, e.y);
      if (c && !calm) { burst(c.x, c.y, { colors: ['#6e6a66', '#9a948d', '#4a3424'], n: 40, speed: 6, size: 4 }); shake($('#board'), 10); }
      break;
    }
    case 'dyn': {
      sfx.boom();
      const c = at(e.x, e.y);
      if (c && !calm) {
        burst(c.x, c.y, { colors: ['#ff6b2b', '#ffd36b', '#fff', '#6e6a66'], n: 90, speed: 10, size: 5, shape: 'shard' });
        shake(document.body, 18);
      }
      break;
    }
    case 'flood': case 'pump': sfx.splash(); break;
    case 'survey': if (e.pid !== app.me.key) sfx.peek(); break;
    case 'claim': sfx.chat(); claimBubble(e); break;
    case 'reveal': {
      const g = app.pub.goals[e.goal];
      const c = g && at(g.x, g.y);
      if (e.gold) {
        sfx.gold();
        if (c) { confetti(c.x, c.y, ['#f5b81c', '#fff3b0', '#ffd36b', '#fff']); burst(c.x, c.y, { colors: ['#ffd36b', '#fff3b0'], n: 50, speed: 7, shape: 'star', size: 5 }); }
        banner('GOLD!', `${nm(e.pid)} broke through`, '#ffd36b', 1.2);
      } else {
        sfx.rock();
        if (c) floatText(c.x, c.y - 20, '🪨 rock', { size: 22 });
      }
      break;
    }
    case 'bats': sfx.bats(); { const r = rowOf(e.target); if (r) { const c = center(r); floatText(c.x, c.y, '🦇🦇', { size: 28 }); } } break;
    case 'shack': case 'free': case 'handsoff': case 'pick': case 'interro': case 'badge': case 'hswap': {
      sfx.whoosh();
      const r = rowOf(e.target || e.pid);
      if (r) { const c = center(r); floatText(c.x, c.y, actionArt(e.k).icon, { size: 28 }); }
      break;
    }
    case 'round': sfx.deal(); break;
    default: break;
  }
}

function onFx(m) {
  const p = P(m.from);
  if (!p) return;
  if (m.k === 'voice') {
    const k = m.from + ':' + m.goal;
    app.voices[k] = m.data;
    const keys = Object.keys(app.voices);
    if (keys.length > 30) delete app.voices[keys[0]];
    if (m.from !== app.me.key) setTimeout(() => playVoice(k), 400);
    return;
  }
  const row = rowOf(m.from);
  const visible = row && row.offsetParent;
  const c = visible ? center(row) : { x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight - 140 };
  if (m.k === 'react') {
    floatText(c.x, c.y, m.e, { size: 34, rise: 120 });
    return;
  }
  if (m.k === 'chat') {
    sfx.chat();
    const b = document.createElement('div');
    b.className = 'bubble';
    b.innerHTML = `<b>${esc(p.avatar)} ${esc(p.name)}</b>`;
    b.appendChild(document.createTextNode(m.text));
    const r = visible ? row.getBoundingClientRect() : null;
    const n = $$('.bubble').length;
    b.style.left = Math.min(innerWidth - 260, r ? r.right + 10 : 16) + 'px';
    b.style.top = (r ? r.top : 80 + n * 60) + 'px';
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
    try { new window.QRCode($('#qr'), { text: inviteUrl(), width: 150, height: 150, colorDark: '#140e0a', colorLight: '#ffffff' }); } catch { /* qr failed */ }
  }
  if (app.role === 'client') $('#netNote').textContent = 'Connected. Waiting for the host to start.';
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

const opt = (list, v) => list.map(([k, l]) => `<option value="${k}" ${+k === +v ? 'selected' : ''}>${l}</option>`).join('');

function previewLine(p) {
  const n = p.players.filter((x) => !x.spectator).length;
  if (n < 3) return 'You need at least 3 miners. Bots count.';
  const t = p.settings.traitors ? Math.min(n - 1, p.settings.traitors) : R.traitorCount(n);
  const tr = p.settings.traitors ? `${t}` : `${Math.max(0, t - 1)}–${t}`;
  const gc = R.goalCount(n);
  return `With ${n} miners: ${tr} traitors, ${gc} hidden veins (${gc === 7 ? '2 gold' : '1 gold'}), ${R.handSize(n, p.settings.hand)} cards each, deck ×${Math.ceil(n / 10)}.`;
}

function renderSettings() {
  const p = app.pub;
  const s = p.settings;
  const n = p.players.filter((x) => x.on && !x.spectator).length;
  const packs = R.PACKS.map((pk) => {
    const on = s.packs.includes(pk.id);
    return `<button class="pack ${on ? 'on' : ''}" ${isHost() ? `data-pack="${pk.id}"` : 'disabled'} aria-pressed="${on}"><span class="pi">${pk.icon}</span><span class="pt"><b>${pk.name}</b><small>${pk.desc}</small></span><span class="ck"></span></button>`;
  }).join('');
  const dis = isHost() ? '' : 'disabled';
  setHtml($('#settingsBox'), `
    <div class="sec-title">Expansion packs</div>
    <div class="packs">${packs}</div>
    <div class="sec-title">House rules</div>
    <div class="set-row"><label for="sRounds">Rounds</label><select id="sRounds" data-set="rounds" ${dis}>${opt([[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], s.rounds)}</select></div>
    <div class="set-row"><label for="sTurn">Turn timer<small>A card is discarded for you when time runs out</small></label><select id="sTurn" data-set="turnSecs" ${dis}>${opt([[0, 'Off'], [15, '15 s'], [20, '20 s'], [30, '30 s'], [45, '45 s'], [60, '1 min'], [90, '1.5 min']], s.turnSecs)}</select></div>
    <div class="set-row"><label for="sTr">Traitors<small>Auto keeps the exact count a secret</small></label><select id="sTr" data-set="traitors" ${dis}>${opt([[0, 'Auto'], ...Array.from({ length: 12 }, (_, i) => [i + 1, String(i + 1)])], s.traitors)}</select></div>
    <div class="set-row"><label for="sHand">Cards in hand</label><select id="sHand" data-set="hand" ${dis}>${opt([[0, 'Auto'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']], s.hand)}</select></div>
    <div class="set-row"><label for="sRev">Reveal roles after each round</label><input type="checkbox" id="sRev" data-set="revealRoles" ${s.revealRoles ? 'checked' : ''} ${dis}></div>
    <p class="preview">${previewLine(p)}</p>
    ${isHost() ? `<div class="start-row">
      <button class="btn big gold ${n >= 3 ? 'pulse' : ''}" data-action="start" ${n >= 3 ? '' : 'disabled'}>⛏️ Start digging</button>
      <button class="btn small ghost" data-action="addbot">🤖 Add a bot miner</button>
      <p class="muted small">Players can also join mid-game; they get a role at the next round.</p>
    </div>` : '<p class="muted small">Only the host can change these. Waiting for the host to start…</p>'}`);
}

function inviteUrl() {
  return location.origin + location.pathname + '?room=' + app.code;
}

function boardState() {
  return R.boardFromPub(app.pub);
}

function targetState() {
  const pub = app.pub;
  return {
    order: pub.order,
    players: pub.players,
    rolePool: [1],
    hands: Object.fromEntries(pub.players.map((p) => [p.id, new Array(p.cards).fill(0)])),
    intel: { [app.me.key]: app.priv?.intel || {} },
  };
}

function selectCard(id) {
  if (!app.priv) return;
  const c = app.priv.hand.find((x) => x.id === id);
  if (!c) return;
  if (app.sel && app.sel.id === id) {
    if (R.CARDS[c.k].type === 'path') rotateSel();
    else clearSel();
    return;
  }
  app.sel = { id, k: c.k, r: 0 };
  app.pending = null;
  sfx.select();
  updateSelection();
}

function rotateSel() {
  if (!app.sel || R.CARDS[app.sel.k].type !== 'path') return;
  app.sel.r = app.sel.r ? 0 : 1;
  sfx.rotate();
  if (app.pending) {
    const [px, py] = app.pending.split(',').map(Number);
    if (R.canPlace(boardState(), app.sel.k, app.sel.r, px, py)) setTimeout(() => { if (app.sel) { app.board.preview(app.sel.k, app.sel.r, px, py); markPending(); } }, 0);
    else app.pending = null;
  }
  const el = document.querySelector(`#hand .card[data-id="${app.sel.id}"] .art`);
  if (el && gsap) gsap.fromTo(el, { rotation: app.sel.r ? 0 : 180 }, { rotation: app.sel.r ? 180 : 360, duration: 0.3, ease: 'back.out(2)', onComplete: () => gsap.set(el, { rotation: app.sel?.r ? 180 : 0 }) });
  updateSelection();
}

function clearSel() {
  app.sel = null;
  app.pending = null;
  updateSelection();
}

function updateSelection() {
  const pub = app.pub;
  const sel = app.sel;
  const b = app.board;
  const info = $('#selInfo');
  $$('#hand .card').forEach((el) => el.classList.toggle('sel', !!sel && Number(el.dataset.id) === sel.id));
  $$('.pl').forEach((el) => el.classList.remove('target'));
  $('#rotBtn').hidden = true;
  $('#selfBtn').hidden = true;
  $('#discBtn').hidden = !sel || !myTurn();
  $('#cancelBtn').hidden = !sel;
  if (b) { b.highlight([]); if (!app.pending) b.preview(null); }
  if (!sel || !pub || pub.phase !== 'play') { info.innerHTML = ''; app.pending = null; b?.preview(null); return; }
  const c = R.CARDS[sel.k];
  const turn = myTurn();
  if (c.type === 'path') {
    $('#rotBtn').hidden = false;
    const me = meP();
    if (!R.canDig(me)) {
      info.innerHTML = `<b>${R.cardName(sel.k)}</b><span class="warn">${me.shack ? 'You are shackled' : 'Your tools are broken'}: you can only discard it.</span>`;
      return;
    }
    const cells = R.legalCells(boardState(), sel.k, sel.r);
    b.highlight(cells, turn ? 'place' : 'ghost');
    if (app.pending && !cells.some(([cx, cy]) => cx + ',' + cy === app.pending)) { app.pending = null; b.preview(null); }
    info.innerHTML = `<b>${R.cardName(sel.k)}</b><span>${cells.length ? (turn ? 'Drag it onto a glowing spot, or tap a spot. ↻ rotates.' : `${cells.length} spots fit. Wait for your turn.`) : 'Fits nowhere right now. Try rotating, or discard it.'}</span>`;
    markPending();
    return;
  }
  info.innerHTML = `<b>${actionArt(sel.k).icon} ${c.name}</b><span>${esc(c.desc)}</span>`;
  if (!turn) return;
  if (c.target === 'self') { $('#selfBtn').hidden = false; return; }
  if (c.target === 'goal') {
    const gs = R.cellTargets({ goals: app.pub.goals.map((g) => ({ ...g, open: !!g.open })) }, 'survey');
    b.highlight([], 'act', gs);
    info.innerHTML += '<span class="hint">Tap a hidden vein on the board.</span>';
    return;
  }
  if (c.target === 'cell') {
    const cells = R.cellTargets(boardState(), sel.k);
    b.highlight(cells, sel.k === 'pump' || sel.k === 'flood' ? 'water' : 'danger');
    info.innerHTML += `<span class="hint">${cells.length ? 'Tap a highlighted cell.' : 'No valid cell right now.'}</span>`;
    markPending();
    return;
  }
  const ts = R.targets(targetState(), app.me.key, sel.k);
  ts.forEach((id) => rowOf(id)?.classList.add('target'));
  info.innerHTML += `<span class="hint">${ts.length ? 'Tap a glowing player.' : 'Nobody can be targeted right now.'}</span>`;
  if (window.matchMedia('(max-width: 820px)').matches && ts.length) $('#players').classList.add('open');
}

function setupHandDrag() {
  const hand = $('#hand');
  let d = null;
  hand.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.card');
    if (!card || e.button > 0) return;
    d = { card, id: Number(card.dataset.id), x: e.clientX, y: e.clientY, pid: e.pointerId, on: false, drop: null };
  });
  window.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.pid) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.on) {
      if (Math.hypot(dx, dy) < 12 || Math.abs(dy) < Math.abs(dx) * 0.8) return;
      if (!myTurn()) { d = null; return; }
      if (!app.sel || app.sel.id !== d.id) selectCard(d.id);
      d.on = true;
      d.ghost = d.card.cloneNode(true);
      d.ghost.classList.add('drag-ghost');
      d.ghost.removeAttribute('style');
      document.body.append(d.ghost);
      d.card.classList.add('lifted');
    }
    suppressClick = performance.now() + 400;
    const gw = d.ghost.offsetWidth, gh = d.ghost.offsetHeight;
    d.ghost.style.transform = `translate(${e.clientX - gw / 2}px, ${e.clientY - gh * 0.9}px) rotate(${Math.max(-12, Math.min(12, dx * 0.04))}deg)`;
    const under = document.elementFromPoint(e.clientX, e.clientY - gh * 0.45);
    const hl = under?.closest?.('#board .hl:not(.ghost)');
    const pl = under?.closest?.('.pl.target');
    const sel = app.sel;
    d.drop = null;
    $$('.pl.drop').forEach((x) => x.classList.remove('drop'));
    if (hl && !hl.dataset.goal) {
      d.drop = { x: Number(hl.dataset.x), y: Number(hl.dataset.y) };
      if (R.CARDS[sel.k].type === 'path') app.board.preview(sel.k, sel.r, d.drop.x, d.drop.y);
    } else if (hl && hl.dataset.goal) {
      d.drop = { goal: Number(hl.dataset.goal) };
    } else if (pl) {
      d.drop = { pid: pl.dataset.pid };
      pl.classList.add('drop');
    } else app.board?.preview(null);
    d.ghost.classList.toggle('over', !!d.drop);
  });
  const end = (e) => {
    if (!d || e.pointerId !== d.pid) return;
    const cur = d;
    d = null;
    if (!cur.on) return;
    cur.card.classList.remove('lifted');
    $$('.pl.drop').forEach((x) => x.classList.remove('drop'));
    if (cur.drop && app.sel) {
      cur.ghost.remove();
      if (cur.drop.pid) onPlayerTap(cur.drop.pid);
      else if (cur.drop.goal !== undefined) onGoal(cur.drop.goal);
      else onCell(cur.drop.x, cur.drop.y, 'drop');
      return;
    }
    app.board?.preview(null);
    const r = cur.card.getBoundingClientRect();
    if (gsap) gsap.to(cur.ghost, { transform: `translate(${r.left}px, ${r.top}px) rotate(0deg)`, opacity: 0.4, duration: 0.3, ease: 'power2.out', onComplete: () => cur.ghost.remove() });
    else cur.ghost.remove();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
let suppressClick = 0;

async function onPlayerTap(pid) {
  const sel = app.sel;
  if (!sel || !myTurn()) return false;
  const c = R.CARDS[sel.k];
  if (c.type !== 'act' || c.target !== 'player') return false;
  if (!R.targets(targetState(), app.me.key, sel.k).includes(pid)) { toast('Not a valid target for that card.', 'bad'); return true; }
  let tool;
  if (c.fix && c.fix.length > 1) {
    const p = P(pid);
    const opts = [...c.fix].filter((t) => p.tools[t]);
    if (opts.length > 1) {
      tool = await new Promise((resolve) => {
        const card = modal(`<h3>Fix which tool?</h3><div class="modal-actions">${opts.map((t) => `<button class="btn gold" data-tool="${t}">${R.TOOL_ICON[t]} ${R.TOOLS[t]}</button>`).join('')}</div>`, { onClose: () => resolve(null) });
        card.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.tool; card._v = v; $('#modal')._onClose = null; closeModal(); resolve(v); }));
      });
      if (!tool) return true;
    }
  }
  if (sel.k === 'hswap' && !(await ask('Swap hands?', `You give your whole hand to ${esc(nm(pid))} and take theirs.`, 'Swap'))) return true;
  $('#players').classList.remove('open');
  playCard({ id: sel.id, target: pid, tool });
  return true;
}

function onCell(x, y, type) {
  const sel = app.sel;
  if (!sel || !myTurn()) return;
  const c = R.CARDS[sel.k];
  const at = x + ',' + y;
  if (type !== 'mouse' && type !== 'drop' && app.pending !== at) {
    app.pending = at;
    sfx.select();
    if (c.type === 'path') app.board.preview(sel.k, sel.r, x, y);
    markPending();
    return;
  }
  app.pending = null;
  app.board.preview(null);
  if (c.type === 'path') playCard({ id: sel.id, x, y, r: sel.r });
  else if (c.target === 'cell') playCard({ id: sel.id, x, y });
}

function markPending() {
  $$('#board .hl').forEach((h) => h.classList.toggle('pending', app.pending === h.dataset.x + ',' + h.dataset.y));
  const hint = $('#selInfo .hint2');
  if (hint) hint.remove();
  if (app.pending) $('#selInfo').insertAdjacentHTML('beforeend', '<span class="hint2">Tap the same spot again to confirm ✓</span>');
}

function onHover(cell) {
  const sel = app.sel;
  if (!sel || !myTurn() || R.CARDS[sel.k].type !== 'path' || !cell) { if (!app.pending) app.board?.preview(null); return; }
  app.board.preview(sel.k, sel.r, cell[0], cell[1]);
}

function onGoal(gi) {
  const sel = app.sel;
  if (!sel || !myTurn() || sel.k !== 'survey') return;
  playCard({ id: sel.id, goal: gi });
}

function toolBadges(p) {
  const t = Object.keys(R.TOOLS).map((k) => `<span class="tool ${p.tools?.[k] ? 'broken' : ''}" title="${R.TOOLS[k]}${p.tools?.[k] ? ' (broken)' : ''}">${R.TOOL_ICON[k]}</span>`).join('');
  return `<span class="tools">${t}${p.shack ? '<span class="tool broken" title="Shackled">⛓️</span>' : ''}${p.pick ? `<span class="tool pick" title="Pickpocket ready">🫳${p.pick > 1 ? p.pick : ''}</span>` : ''}</span>`;
}

function renderPlayers() {
  const pub = app.pub;
  const order = pub.order.length ? pub.order : pub.players.map((p) => p.id);
  const rest = pub.players.filter((p) => !order.includes(p.id));
  const intel = app.priv?.intel || {};
  const roles = pub.result?.roles;
  const nextId = upcoming(1)[0];
  const rows = [...order.map(P).filter(Boolean), ...rest].map((p) => {
    const turn = pub.phase === 'play' && pub.turn === p.id;
    const state = pub.phase !== 'play' ? '' : pub.await?.pid === p.id ? '<span class="pst now">📣 reporting</span>' : turn ? `<span class="pst now">⛏ ${p.bot ? 'thinking' : 'digging'}</span>` : p.id === nextId ? '<span class="pst next">next</span>' : '';
    const known = roles?.[p.id] || intel[p.id] || (p.id === app.me.key && app.showRole ? app.priv?.role : null);
    const rk = known ? R.ROLES[known] : null;
    const lies = (pub.claims || []).filter((c) => c.pid === p.id && c.lie).length;
    const truths = (pub.claims || []).filter((c) => c.pid === p.id && c.lie === false).length;
    return `<div class="pl ${turn ? 'turn' : ''} ${p.id === app.me.key ? 'me' : ''} ${p.on ? '' : 'off'} ${p.wait || p.spectator ? 'wait' : ''}" data-pid="${esc(p.id)}">
      <div class="av-ring">${avatar(p)}</div>
      <div class="pm"><div class="pn">${esc(p.name)}${state}${p.id === pub.hostId ? ' <span title="Host">👑</span>' : ''}${p.bot ? ' <span class="muted">bot</span>' : ''}${rk ? ` <span class="rk role-${known}" title="${rk.name}">${rk.icon}</span>` : ''}${lies ? ` <span class="liar" title="Caught lying about a vein">🤥${lies > 1 ? lies : ''}</span>` : ''}${truths ? ` <span class="honest" title="Told the truth about a vein">✅${truths > 1 ? truths : ''}</span>` : ''}</div>
        <div class="ps">${p.spectator ? '<span class="muted">watching</span>' : p.wait ? '<span class="muted">joins next round</span>' : `${toolBadges(p)}<span class="cards" title="Cards in hand">🂠 ${p.cards}</span>`}</div></div>
      <div class="gold-c" title="Gold">${p.gold}<small>💰</small></div>
    </div>`;
  }).join('');
  if (setHtml($('#players'), rows)) updateSelection();
}

function renderHand() {
  const priv = app.priv;
  const hand = priv && priv.rid === app.pub.roundId ? priv.hand : [];
  const me = meP();
  const ids = hand.map((c) => c.id).join(',') + ':' + (app.pub.phase);
  const el = $('#hand');
  const turn = myTurn();
  el.classList.toggle('my-turn', turn);
  if (el._ids === ids) return;
  const prevIds = new Set((el._ids || '').split(':')[0].split(',').filter(Boolean).map(Number));
  el._ids = ids;
  if (!me || me.spectator || me.wait) {
    el.innerHTML = `<p class="muted small hand-empty">${me?.spectator ? 'You are watching this game.' : 'You get a role and cards when the next round starts.'}</p>`;
    return;
  }
  if (!hand.length) {
    el.innerHTML = `<p class="muted small hand-empty">${app.pub.phase === 'play' ? 'No cards left. Watch the others dig.' : ''}</p>`;
    return;
  }
  const mid = (hand.length - 1) / 2;
  el.innerHTML = hand.map((c, i) => {
    const d = R.CARDS[c.k];
    const o = i - mid;
    const st = `style="--rot:${(o * 3.2).toFixed(1)}deg;--dy:${(o * o * 2.2).toFixed(1)}px"`;
    if (d.type === 'path') return `<button class="card path ${d.dead ? 'dead' : ''}" data-id="${c.id}" ${st} title="${R.cardName(c.k)}"><span class="art">${tileSvg(c.k, 0)}</span><span class="cn">${R.cardName(c.k)}</span><span class="gem-type">${d.dead ? '✖' : '⛏'}</span></button>`;
    const a = actionArt(c.k);
    return `<button class="card act ${a.tone}" data-id="${c.id}" ${st} title="${esc(d.desc)}"><span class="art"><span class="ai">${a.icon}</span></span><span class="cn">${d.name}</span><span class="gem-type">★</span></button>`;
  }).join('');
  const fresh = [...el.querySelectorAll('.card')].filter((x) => !prevIds.has(Number(x.dataset.id)));
  if (gsap && fresh.length && fresh.length < hand.length + 1) gsap.from(fresh, { y: 60, opacity: 0, rotation: 8, stagger: 0.06, duration: 0.45, ease: 'back.out(1.8)' });
  updateSelection();
}

function renderRoleChip() {
  const role = app.priv?.role;
  const chip = $('#roleChip');
  const me = meP();
  if (!role || !me || me.spectator || me.wait || app.pub.phase === 'lobby') { chip.hidden = true; return; }
  chip.hidden = false;
  const r = R.ROLES[role];
  chip.className = 'role-chip ' + (app.showRole ? 'role-' + role : 'hidden-role');
  chip.innerHTML = app.showRole ? `${r.icon} <b>${r.name}</b>` : '🕵️ <b>Your role</b> <small>tap</small>';
}

function upcoming(k) {
  const pub = app.pub;
  if (!pub || pub.phase !== 'play') return [];
  const order = pub.order.filter((id) => { const p = P(id); return p && !p.wait && !p.spectator; });
  const i = order.indexOf(pub.turn);
  if (i < 0) return [];
  const out = [];
  for (let j = 1; j <= Math.min(k, order.length - 1); j++) out.push(order[(i + j) % order.length]);
  return out;
}

const BASE_TITLE = document.title;

function renderStatus() {
  const pub = app.pub;
  const st = $('#status');
  const bar = $('#turnBar');
  let html = '';
  let mine = false;
  let who = null;
  const line = (p, big, hint) => `${avatar(p, 'lg')}<div class="tb-txt"><div class="tb-name">${big}</div><div class="tb-hint">${hint}</div></div>`;
  if (pub.phase === 'play' && pub.await) {
    who = P(pub.await.pid);
    mine = pub.await.pid === app.me.key;
    html = mine ? line(who, '<b class="your-turn">REPORT!</b>', 'Tell everyone what you saw in the vein.') : line(who, `<b>${esc(who?.name || '')}</b> is reporting`, `On vein ${pub.await.goal + 1} · gold or rock? 📣`);
  } else if (pub.phase === 'play') {
    who = P(pub.turn);
    if (pub.turn === app.me.key) {
      mine = true;
      const me = meP();
      html = line(who, '<b class="your-turn">YOUR TURN</b>', R.canDig(me) ? 'Dig a tunnel, play an action, or discard.' : me.shack ? 'You are shackled: play an action or discard.' : 'Your tools are broken: fix them, play an action, or discard.');
    } else if (who) html = line(who, `<b>${esc(who.name)}</b>'s turn`, who.bot ? 'Thinking…' : 'Digging…');
  } else if (pub.phase === 'end') html = '<div class="tb-txt">Round over. <button class="linkbtn" data-action="result">See results</button></div>';
  else if (pub.phase === 'over') html = '<div class="tb-txt">Game over! <button class="linkbtn" data-action="result">Final results</button></div>';
  setHtml(st, html);
  bar.classList.toggle('mine', mine);
  const wasIdle = bar.classList.contains('idle');
  bar.classList.toggle('idle', !html);
  if (wasIdle && html && app.board) requestAnimationFrame(() => app.board.fit(true));
  bar.style.setProperty('--pc', who?.color || '#ffd36b');
  document.body.classList.toggle('my-turn', mine);
  const next = upcoming(3).map(P).filter(Boolean);
  setHtml($('#nextRail'), next.length ? `<span>Next</span>${next.map((p, i) => `<i class="${i ? '' : 'first'}" title="${esc(p.name)}">${avatar(p, 'sm')}</i>`).join('')}` : '');
  const t = mine ? `● Your turn — ${BASE_TITLE}` : BASE_TITLE;
  if (document.title !== t) document.title = t;
  const hand = $('#hand');
  const wait = pub.phase === 'play' && !mine && who ? `Waiting for ${who.name}…` : '';
  if (hand.dataset.wait !== wait) hand.dataset.wait = wait;
}

function renderGame() {
  const pub = app.pub;
  if (!pub || pub.phase === 'lobby') return;
  if (!app.board) app.board = new Board($('#board'), { onCell, onGoal, onHover });
  $('#roundNo').textContent = `Round ${pub.round}/${pub.settings.rounds}`;
  $('#deckInfo').textContent = `🂠 ${pub.deck}`;
  $('#deckInfo').title = `${pub.deck} cards left in the draw pile`;
  $('#codeMini').textContent = pub.code || app.code;
  $$('.host-only').forEach((e) => { e.hidden = !isHost(); });
  const lit = new Set([...R.reach(boardState())].map((id) => id.split('#')[0]));
  app.board.render(pub, app.priv, { lit, claims: pub.claims || [] });
  renderPlayers();
  renderHand();
  renderRoleChip();
  renderStatus();
  if (app.sel) updateSelection();
}

function timerLoop() {
  const p = app.pub;
  const t = $('#timer');
  if ($('#game').hidden) { document.body.classList.remove('my-turn'); if (document.title !== BASE_TITLE) document.title = BASE_TITLE; }
  if (!p || !p.left || p.phase !== 'play' || $('#game').hidden) { t.hidden = true; updateResultTimer(); return; }
  if (p.await && p.await.pid !== app.me.key && !p.settings.turnSecs) { t.hidden = true; return; }
  const rem = Math.max(0, p.left - (performance.now() - app.recvAt));
  const sec = Math.ceil(rem / 1000);
  t.hidden = false;
  $('#timerText').textContent = sec;
  const frac = p.dur ? Math.min(1, rem / p.dur) : 0;
  $('#timerRing').style.strokeDashoffset = String(97.4 * (1 - frac));
  const urgent = sec <= 8 && (myTurn() || p.await?.pid === app.me.key);
  t.classList.toggle('low', urgent);
  if (urgent && sec !== app.lastTickSec && sec > 0) { app.lastTickSec = sec; sfx.tick(); }
}
setInterval(timerLoop, 250);

function openHostMenu() {
  const p = app.pub;
  const others = p.players.filter((x) => x.id !== app.me.key);
  const tile = (h, icon, title, sub, cls = '') => `<button class="act-tile ${cls}" data-h="${h}"><span class="ai">${icon}</span><span><b>${title}</b><small>${sub}</small></span></button>`;
  const card = modal(`<div class="pk-head"><h3>Host controls</h3><span class="grow"></span><button class="xbtn" data-close aria-label="Close">✕</button></div>
    <div class="act-grid">
      ${p.phase === 'end' ? tile('next', '⏭', 'Next round', 'Skip the countdown', 'hot') : ''}
      ${p.phase === 'play' && p.turn !== app.me.key ? tile('skip', '⏩', 'Skip this turn', 'Discards a card for them') : ''}
      ${tile('invite', '🔗', 'Invite link', 'Copy it for friends')}
      ${tile('addbot', '🤖', 'Add a bot', 'Joins next round')}
      ${tile('lobby', '🛑', 'End game', 'Back to the lobby', 'danger')}
    </div>
    <div class="sec-title">Miners <span>${others.length}</span></div>
    <div class="plist">${others.map((x) => `<div class="prow">${avatar(x)}<div class="nm">${esc(x.name)}${x.on ? '' : ' <span class="muted">· away</span>'}</div><button class="mini danger" data-kick="${esc(x.id)}">Remove</button></div>`).join('') || '<p class="muted">Nobody else yet. Share the invite link!</p>'}</div>`);
  card.onclick = async (e) => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    const h = b.dataset.h;
    if (h === 'next') app.host.act({ a: 'next' });
    if (h === 'skip') app.host.act({ a: 'skip' });
    if (h === 'addbot') app.host.act({ a: 'bot' });
    if (h === 'invite') copyInvite();
    if (h === 'lobby') {
      closeModal();
      if (await ask('End this game?', 'Gold resets and everyone goes back to the lobby.', 'End game', true)) app.host.act({ a: 'lobby' });
      return;
    }
    closeModal();
  };
}

function copyInvite() {
  const url = inviteUrl();
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
    () => toast('Invite link copied!', 'good'),
    () => modal(`<h3>Invite link</h3><input value="${esc(url)}" readonly onclick="this.select()"><div class="modal-actions"><button class="btn gold" data-close>Close</button></div>`),
  );
}

function rulesModal() {
  const pk = R.PACKS.map((p) => `<li><b>${p.icon} ${p.name}</b>: ${p.desc}</li>`).join('');
  modal(`<div class="rules">
    <div class="pk-head"><h3>📜 How to play</h3><span class="grow"></span><button class="xbtn" data-close aria-label="Close">✕</button></div>
    <p>Every round each miner secretly gets a role. <b>Diggers</b> want to build a tunnel from the mine entrance to the hidden <b>gold</b>. <b>Traitors</b> hide among them and want the cards to run out first. Nobody knows who is who.</p>
    <h4>On your turn</h4>
    <ol><li><b>Dig</b>: drag a tunnel card onto a glowing spot (or tap the spot twice). Every edge must match its neighbours and it must connect back to the entrance. Tap a selected card again (or press R) to rotate it. Tunnels connected to the entrance light up.</li>
    <li><b>Act</b>: break someone's ⛏️ Drill, 🔦 Lamp or 🛒 Cart (a miner with any broken tool can't dig), fix a tool, cave in a tunnel, or survey a hidden vein.</li>
    <li><b>Discard</b> one card.</li></ol>
    <h4>📣 Survey and bluff</h4>
    <p>A <b>Survey</b> card lets you secretly look at one hidden vein. Then you <b>must</b> tell everyone what you saw, GOLD or ROCK, with a typed message or a voice note. You may lie. Every claim is pinned under its vein (💰2 🪨1), and when a vein flips, liars get a 🤥 badge for the rest of the round. Traitors use fake reports to send diggers the wrong way.</p>
    <p>Then you draw a card. When a tunnel reaches a hidden vein it flips: rock, or <b>gold</b>. Gold ends the round and the diggers share nuggets, starting with whoever broke through. If every hand runs dry first, the traitors get paid.</p>
    <p>After all rounds, the miner with the most gold wins. Roles are dealt fresh every round, so yesterday's friend may be today's traitor.</p>
    <h4>Big games</h4>
    <p>Up to 32 miners. Bigger mines get more hidden veins (7 veins with 2 gold for 21+ players), veins further from the entrance, and up to 40% of the table are traitors. The deck holds about 4 cards per miner, so a mine can run dry: if it does before anyone strikes gold, the traitors win.</p>
    <h4>Expansion packs</h4><ul>${pk}</ul>
    <div class="modal-actions"><button class="btn gold" data-close>Got it</button></div></div>`, { wide: true });
}

function soundModal() {
  const motion = document.body.classList.contains('calm');
  const card = modal(`<div class="pk-head"><h3>🔊 Sound &amp; motion</h3><span class="grow"></span><button class="xbtn" data-close aria-label="Close">✕</button></div>
    <label class="slider"><span>🎵 Music</span><input type="range" min="0" max="100" value="${Math.round(getMusicVolume() * 100)}" id="mVol"></label>
    <label class="slider"><span>🔔 Sounds</span><input type="range" min="0" max="100" value="${Math.round(getSfxVolume() * 100)}" id="sVol"></label>
    <div class="seg motion"><button data-m="full" class="${motion ? '' : 'on'}">Full motion</button><button data-m="calm" class="${motion ? 'on' : ''}">Reduced motion</button></div>
    <div class="modal-actions"><button class="btn gold" data-close>Done</button></div>`);
  card.querySelector('#mVol').addEventListener('input', (e) => setMusicVolume(e.target.value / 100));
  card.querySelector('#sVol').addEventListener('input', (e) => setSfxVolume(e.target.value / 100));
  card.querySelector('#sVol').addEventListener('change', () => sfx.coin());
  card.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
    const calm = b.dataset.m === 'calm';
    document.body.classList.toggle('calm', calm);
    document.body.classList.remove('lite');
    store('l', 'tt-calm', calm);
    store('l', 'tt-full', !calm);
    card.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b));
  }));
}

function credits() {
  modal(`<h3>Credits &amp; privacy</h3>
    <p><b>Tunnel Traitors</b> is a free, non-commercial, original hidden-role game. All card art is drawn in code for this game.</p>
    <p><b>Privacy:</b> when you open the site, host a room or join one, the server records your IP address, your approximate location from the IP (country and city), your browser's user agent, your player name, and a count of your visits. The site owner uses this only to see how many people play. Game traffic passes through a Cloudflare relay and, as a fallback, public MQTT brokers. Chat and moves are not stored.</p>
    <p class="muted small">Sounds and music are generated in your browser. Animations use GSAP and canvas-confetti.</p>
    <div class="modal-actions"><button class="btn gold" data-close>Close</button></div>`);
}

document.addEventListener('click', async (e) => {
  unlockAudio();
  kickMusic();
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
  const pack = e.target.closest('[data-pack]');
  if (pack && isHost()) {
    const cur = new Set(app.pub.settings.packs);
    if (cur.has(pack.dataset.pack)) cur.delete(pack.dataset.pack); else cur.add(pack.dataset.pack);
    sfx.select();
    app.host.act({ a: 'settings', patch: { packs: [...cur] } });
    return;
  }
  const kick = e.target.closest('[data-kick]');
  if (kick && isHost()) {
    const x = P(kick.dataset.kick);
    closeModal();
    if (x && await ask('Remove miner?', `Remove <b>${esc(x.name)}</b> from the mine? They can't rejoin this room.`, 'Remove', true)) app.host.act({ a: 'kick', pid: x.id });
    return;
  }
  const vb = e.target.closest('[data-voice]');
  if (vb) { playVoice(vb.dataset.voice); return; }
  const react = e.target.closest('[data-react]');
  if (react) {
    send({ t: 'react', e: react.dataset.react });
    if (app.role === 'client') { const c = center(react); floatText(c.x, c.y, react.dataset.react, { size: 30 }); }
    if (gsap) gsap.fromTo(react, { scale: 1.6 }, { scale: 1, duration: 0.3 });
    return;
  }
  const handCard = e.target.closest('#hand .card');
  if (handCard) { if (performance.now() > suppressClick) selectCard(Number(handCard.dataset.id)); return; }
  const pl = e.target.closest('.pl');
  if (pl && await onPlayerTap(pl.dataset.pid)) return;
  const b = e.target.closest('[data-action]');
  if (!b) {
    if (e.target.closest('#players') === null && window.matchMedia('(max-width: 820px)').matches && !e.target.closest('.dock')) $('#players').classList.remove('open');
    return;
  }
  switch (b.dataset.action) {
    case 'create': if (needName()) beginHost(null); break;
    case 'join': {
      if (!needName()) return;
      const code = $('#codeIn').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(code)) { toast('Mine codes are 5 letters or numbers.', 'bad'); return; }
      beginJoin(code);
      break;
    }
    case 'resume': { const s = savedHost(); if (s) beginHost(s); break; }
    case 'forget': clearSavedHost(); $('#resumeBox').hidden = true; break;
    case 'credits': credits(); break;
    case 'rules': rulesModal(); break;
    case 'sound': soundModal(); break;
    case 'copy': copyInvite(); break;
    case 'share':
      if (navigator.share) navigator.share({ title: 'Tunnel Traitors', text: `Join my mine! Code ${app.code}`, url: inviteUrl() }).catch(() => {});
      else copyInvite();
      break;
    case 'start': {
      b.disabled = true;
      b.textContent = 'Dealing roles…';
      const err = await app.host.act({ a: 'start' });
      if (err) { $('#settingsBox')._h = ''; renderSettings(); toast('You need at least 3 miners. Add a bot?', 'bad'); }
      break;
    }
    case 'addbot': app.host.act({ a: 'bot' }); break;
    case 'next': closeModal(); app.host.act({ a: 'next' }); break;
    case 'again': closeModal(); app.host.act({ a: 'lobby' }); break;
    case 'result': showResult(); break;
    case 'hostmenu': openHostMenu(); break;
    case 'chat': promptText('Say something to the mine', 'Type a message…').then((t) => { if (t) send({ t: 'chat', text: t }); }); break;
    case 'role': app.showRole = !app.showRole; sfx.flip(); renderRoleChip(); $('#players')._h = ''; renderPlayers(); break;
    case 'rotate': rotateSel(); break;
    case 'cancel': clearSel(); break;
    case 'playself': if (app.sel && myTurn()) playCard({ id: app.sel.id }); break;
    case 'discard':
      if (app.sel && myTurn()) playCard({ id: app.sel.id, discard: true });
      break;
    case 'fit': app.board?.fit(true); break;
    case 'zin': app.board?.zoom(1.25); break;
    case 'zout': app.board?.zoom(0.8); break;
    case 'players': $('#players').classList.toggle('open'); break;
    case 'leave': {
      const msg = isHost() ? 'You are the host. If you leave, the mine closes for everyone.' : 'You can rejoin with the same code later.';
      if (await ask('Leave the mine?', msg, 'Leave', true)) leaveRoom(false);
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
window.addEventListener('resize', () => { if (app.board && app.pub && app.pub.phase !== 'lobby' && Date.now() - app.board.lastUser > 3000) app.board.fit(false); });

if (store('l', 'tt-calm')) document.body.classList.add('calm');
if (matchMedia('(pointer: coarse)').matches && !store('l', 'tt-full')) document.body.classList.add('lite');
onSfx(duck);
initPwa({ toast });
if (window.ResizeObserver) new ResizeObserver(([e]) => document.documentElement.style.setProperty('--dock-h', Math.round(e.contentRect.height) + 'px')).observe($('#dock'));
setupHandDrag();
renderHome();
hit('visit');

const seat = store('s', 'tt-seat');
const urlCode = (params.get('room') || '').toUpperCase();
const saved = savedHost();
if (saved && urlCode === saved.code && saved.me?.key === app.me.key) beginHost(saved);
else if (seat && urlCode && seat.code === urlCode && app.me.name) beginJoin(urlCode);

window.__tt = app;

initFeedback({ game: 'tunnel-traitors' });
initVoice({ me: () => app.me.key, enabled: () => !!app.pub && !!(app.host || app.client), players: () => app.pub?.players || [], toast });
onQuality((t) => { if (t === 'low') document.body.classList.add('lite'); });
initQuality();
