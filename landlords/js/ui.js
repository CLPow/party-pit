import { SPACES, GROUPS, FORTUNE, TREASURY, JAIL, PARKING, START, JAIL_FINE, PASS_START } from './board.js';
import {
  P, calcRent, buildError, sellError, mortgageError, unmortgageError, unmortgageCost, netWorth, MAX_PLAYERS, ownable,
  MODES, modeLabel, propertyValue, unownedCount, metricOf, terminalError, zoneError, buildCost, buildingName, marketMult, bestTeleport,
} from './rules.js';
import * as fx from './fx.js';
import { initPwa, keepAwake } from './pwa.js';
import { setMood, kickMusic, getMusicVolume, setMusicVolume, duck } from './music.js';
import {
  PACKS, HOUSE_RULES, packOn, activePacks, PARK_COST, FACTORY_COST, UNZONE_COST, TERMINAL_COST, SKIM_AMT, SWIPE_AMT,
} from './packs.js';

const gsap = window.gsap;
const $ = (sel, root = document) => root.querySelector(sel);
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function btn(label, cls, onClick, disabled = false, title = '') {
  const b = el('button', 'btn ' + (cls || ''), label);
  b.type = 'button';
  b.disabled = !!disabled;
  if (disabled) b.dataset.off = '1';
  if (title) b.title = title;
  b.addEventListener('click', () => {
    fx.sfx.click();
    const group = b.closest('.actions, .deed-actions');
    const btns = group ? [...group.querySelectorAll('button')] : [];
    btns.forEach((x) => { x.disabled = true; });
    onClick();
    if (group) {
      setTimeout(() => {
        if (!group.isConnected) return;
        btns.forEach((x) => { if (x.isConnected && !x.dataset.off) x.disabled = false; });
      }, 4000);
    }
  });
  return b;
}

const load = (k) => { try { return localStorage.getItem('landlords-' + k); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem('landlords-' + k, v); } catch { /* storage unavailable */ } };

export const EMOJIS = ['🦊', '🐼', '🐸', '🐯', '🦁', '🐵', '🐧', '🦄', '🐙', '🦖', '🐳', '🦉', '🐢', '🐝', '🦋', '🐞',
  '🐨', '🐰', '🐶', '🐱', '🐮', '🐷', '🐲', '👽', '🤖', '👻', '🎩', '🚗', '🚀', '⚓', '🎸', '🍕'];
const EMOTES = ['😂', '😎', '😱', '😡', '👏', '🔥', '💸', '🙏', '🤝', '💀'];
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const DIE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

let H = null;
let latest = null;
const queue = [];
let busy = false;
let speed = 1;
let inGame = false;
let gameOverShown = false;

const cells = [];
const tokens = {};
const shownPos = {};
const rows = {};
const cashShown = {};
const propShown = [];
const lobbyEls = {};
let lastLogId = 0;
const seenTrades = new Set();
let spaceModal = null;

const me = () => (latest ? P(latest, H.me()) : null);
const pl = (id) => (latest ? P(latest, id) : null);

export function initUI(handlers) {
  H = handlers;
  buildHome();
  buildBoard();
  buildScene();
  buildDice();
  setupCamera();
  setupSide();
  setupLobbyControls();
  setupPhone();
  initPwa({ toast });
  fx.onSfx(duck);
  const wake = () => { fx.unlockAudio(); kickMusic(); };
  document.addEventListener('pointerdown', wake, true);
  document.addEventListener('keydown', wake, true);
  reduceMQ.addEventListener('change', () => { if (load('motion') === null) setMotion(!reduceMQ.matches, false); });
  applyMotion();
  setInterval(ambientTick, 7000);
  setInterval(frame, 250);
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      const b = $('#actions .primary:not(:disabled)') || $('#buyBox .primary:not(:disabled)');
      if (b) { e.preventDefault(); b.click(); }
    }
  });
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

export function setHomeStatus(text, kind = '') {
  const s = $('#homeStatus');
  s.textContent = text;
  s.className = 'status ' + kind;
  document.querySelectorAll('#createBtn, #joinBtn').forEach((b) => { b.disabled = kind === 'busy'; });
}

export const toast = fx.toast;
export const isBusy = () => busy || queue.length > 0;

/* ---------- home & lobby ---------- */

function buildHome() {
  const pick = $('#emojiPick');
  let chosen = load('emoji');
  if (!EMOJIS.includes(chosen)) chosen = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  EMOJIS.forEach((e) => {
    const b = el('button', 'emo' + (e === chosen ? ' sel' : ''), e);
    b.type = 'button';
    b.onclick = () => {
      chosen = e;
      pick.querySelectorAll('.emo').forEach((x) => x.classList.toggle('sel', x === b));
      fx.unlockAudio();
      fx.sfx.pop();
      gsap.fromTo(b, { scale: 0.5, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' });
    };
    pick.append(b);
  });
  const nameIn = $('#nameIn');
  nameIn.value = load('name') || '';
  const codeIn = $('#codeIn');
  const q = new URLSearchParams(location.search).get('room');
  if (q) {
    codeIn.value = q.toUpperCase().slice(0, 5);
    $('#joinBtn').classList.add('primary');
    $('#createBtn').classList.remove('primary');
  }
  codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  const go = (fn) => {
    fx.unlockAudio();
    const name = nameIn.value.trim();
    if (!name) { fx.shake(nameIn, 8); nameIn.focus(); return; }
    save('name', name);
    save('emoji', chosen);
    fn(name, chosen);
  };
  $('#createBtn').onclick = () => go((name, emoji) => H.onCreate({ name, emoji }));
  $('#joinBtn').onclick = () => go((name, emoji) => {
    const code = codeIn.value.trim();
    if (code.length !== 5) { fx.shake(codeIn, 8); codeIn.focus(); return; }
    H.onJoin({ code, name, emoji });
  });
  $('#homeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (document.activeElement) document.activeElement.blur();
    (codeIn.value.length === 5 ? $('#joinBtn') : $('#createBtn')).click();
  });

  const bg = $('#bg');
  for (let i = 0; i < 22; i++) {
    const f = el('div', 'floater', EMOJIS[(i * 7) % EMOJIS.length]);
    f.style.left = Math.random() * 100 + 'vw';
    f.style.fontSize = 18 + Math.random() * 34 + 'px';
    f.style.animationDuration = 16 + Math.random() * 18 + 's';
    f.style.animationDelay = -Math.random() * 34 + 's';
    bg.append(f);
  }
  gsap.from('.home-card', { y: 50, opacity: 0, duration: 0.9, ease: 'power3.out' });
  gsap.from('.logo-big span', { y: -80, opacity: 0, rotation: () => gsap.utils.random(-25, 25), stagger: 0.12, duration: 0.9, ease: 'bounce.out', delay: 0.2 });
  gsap.from('#emojiPick .emo', { scale: 0, stagger: 0.02, duration: 0.4, ease: 'back.out(3)', delay: 0.5 });
}

function setupLobbyControls() {
  $('#copyLink').onclick = async () => {
    const url = `${location.origin}${location.pathname}?room=${H.roomCode()}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Invite link copied!', 'good');
    } catch {
      toast(url);
    }
  };
  $('#setCash').onchange = (e) => H.setSettings({ startCash: Number(e.target.value) });
  $('#setTimer').onchange = (e) => H.setSettings({ turnSeconds: Number(e.target.value) });
  $('#setMinutes').onchange = (e) => H.setSettings({ minutes: Number(e.target.value) });
  $('#setRounds').onchange = (e) => H.setSettings({ rounds: Number(e.target.value) });
  const packPick = $('#packPick');
  PACKS.forEach((pk) => {
    const b = el('button', 'pack-card');
    b.type = 'button';
    b.dataset.pack = pk.id;
    b.append(el('div', 'pack-icon', pk.icon), el('div', 'pack-name', pk.name), el('div', 'pack-desc', pk.desc), el('div', 'pack-from', `Inspired by ${pk.inspired}`), el('div', 'pack-check', 'OFF'));
    b.onclick = () => {
      if (!H.isHost() || !latest) return;
      fx.sfx.pop();
      gsap.fromTo(b, { scale: 0.92 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
      const cur = { ...(latest.settings.packs || {}) };
      cur[pk.id] = !cur[pk.id];
      H.setSettings({ packs: cur });
    };
    packPick.append(b);
  });
  const housePick = $('#housePick');
  HOUSE_RULES.forEach((hr) => {
    const l = el('label', 'house-rule');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.dataset.rule = hr.id;
    cb.onchange = () => {
      if (!H.isHost() || !latest) return;
      H.setSettings({ house: Object.fromEntries([...document.querySelectorAll('#housePick input')].map((x) => [x.dataset.rule, x.checked])) });
    };
    const txt = el('span', 'hr-text');
    txt.append(el('b', '', hr.name), el('span', 'hr-desc', hr.desc));
    l.append(cb, txt);
    housePick.append(l);
  });
  $('#packAll').onclick = () => {
    if (!H.isHost() || !latest) return;
    const all = PACKS.every((p) => latest.settings.packs && latest.settings.packs[p.id]);
    fx.sfx.pop();
    H.setSettings({ packs: Object.fromEntries(PACKS.map((p) => [p.id, !all])) });
  };
  const pick = $('#modePick');
  Object.entries(MODES).forEach(([key, m]) => {
    const b = el('button', 'mode-card');
    b.type = 'button';
    b.dataset.mode = key;
    b.append(el('div', 'mode-icon', m.icon), el('div', 'mode-name', m.name), el('div', 'mode-desc', m.desc));
    b.onclick = () => {
      if (!H.isHost()) return;
      fx.sfx.pop();
      gsap.fromTo(b, { scale: 0.9 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
      H.setSettings({ mode: key });
    };
    pick.append(b);
  });
  $('#addBotBtn').onclick = () => { fx.sfx.click(); H.addBot(); };
  $('#startBtn').onclick = () => { fx.sfx.click(); H.start(); };
}

let lobbyShownOnce = false;
function renderLobby(s) {
  showScreen('lobby');
  if (!lobbyShownOnce) {
    lobbyShownOnce = true;
    gsap.from('.lobby-card', { y: 40, opacity: 0, duration: 0.6, ease: 'power3.out' });
    gsap.from('#roomCode', { scale: 0.3, duration: 0.8, ease: 'elastic.out(1, 0.5)', delay: 0.2 });
  }
  $('#roomCode').textContent = H.roomCode();
  const wrap = $('#lobbyPlayers');
  const ids = new Set(s.players.map((p) => p.id));
  for (const id of Object.keys(lobbyEls)) {
    if (!ids.has(id)) {
      const e = lobbyEls[id];
      delete lobbyEls[id];
      gsap.to(e, { scale: 0, opacity: 0, duration: 0.3, onComplete: () => e.remove() });
    }
  }
  s.players.forEach((p) => {
    let e = lobbyEls[p.id];
    if (!e) {
      e = el('div', 'lp');
      e.append(el('div', 'avatar'), el('div', 'lp-name'));
      wrap.append(e);
      lobbyEls[p.id] = e;
      gsap.from(e, { scale: 0, rotation: gsap.utils.random(-30, 30), duration: 0.6, ease: 'back.out(2.5)' });
      fx.sfx.pop();
    }
    const av = $('.avatar', e);
    av.textContent = p.emoji;
    av.style.setProperty('--c', p.color);
    $('.lp-name', e).textContent = p.name + (p.id === H.me() ? ' (you)' : '');
    e.classList.toggle('bot', p.bot);
    e.classList.toggle('host', p.id === H.hostPid());
    e.classList.toggle('off', !p.connected);
  });
  $('#lobbyCount').textContent = `${s.players.length} / ${MAX_PLAYERS} players`;
  const host = H.isHost();
  const mode = s.settings.mode || 'classic';
  document.querySelectorAll('.mode-card').forEach((b) => {
    const on = b.dataset.mode === mode;
    if (on && !b.classList.contains('sel')) gsap.fromTo(b, { scale: 1.08 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    b.classList.toggle('sel', on);
    b.disabled = !host && !on;
  });
  const packs = s.settings.packs || {};
  document.querySelectorAll('.pack-card').forEach((b) => {
    const on = !!packs[b.dataset.pack];
    if (on && !b.classList.contains('sel')) gsap.fromTo(b, { scale: 1.06 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    b.classList.toggle('sel', on);
    b.disabled = !host;
    $('.pack-check', b).textContent = on ? '✓ ON' : 'OFF';
  });
  $('#housePick').hidden = !packs.house;
  document.querySelectorAll('#housePick input').forEach((cb) => {
    cb.checked = !!(s.settings.house || {})[cb.dataset.rule];
    cb.disabled = !host;
  });
  $('#packAll').hidden = !host;
  $('#packAll').textContent = PACKS.every((p) => packs[p.id]) ? 'Turn all off' : 'Turn all on';
  $('#minutesWrap').hidden = mode !== 'time';
  $('#roundsWrap').hidden = mode !== 'rounds';
  const packIcons = activePacks(s.settings).map((p) => p.icon).join('');
  $('#waitMsg').firstChild.textContent = `Waiting for the host to start · ${modeLabel(s.settings)}${packIcons ? ' · ' + packIcons : ''}`;
  $('#hostControls').hidden = !host;
  $('#waitMsg').hidden = host;
  if (host) {
    $('#setCash').value = String(s.settings.startCash);
    $('#setTimer').value = String(s.settings.turnSeconds);
    $('#setMinutes').value = String(s.settings.minutes);
    $('#setRounds').value = String(s.settings.rounds);
    $('#startBtn').disabled = s.players.length < 2;
    $('#addBotBtn').disabled = s.players.length >= MAX_PLAYERS;
  }
}

/* ---------- board ---------- */

function coord(i) {
  const side = Math.floor(i / 16);
  const pos = i % 16;
  if (side === 0) return [17, 17 - pos];
  if (side === 1) return [17 - pos, 1];
  if (side === 2) return [1, 1 + pos];
  return [1 + pos, 17];
}

const CITY_ICON = {
  Lagos: '🥁', Nairobi: '🦒', Cairo: '🐪', Lima: '🦙', 'Bogotá': '☕', Santiago: '🍷', 'Buenos Aires': '💃',
  Kathmandu: '🏔️', Dhaka: '🛺', Mumbai: '🚂', Delhi: '🐘', Manila: '🏝️', Jakarta: '🌋', Bangkok: '🛕',
  Istanbul: '🕌', Doha: '🏟️', 'Abu Dhabi': '🏜️', Dubai: '🏙️', Warsaw: '🧜', Prague: '🏰', Budapest: '♨️', Vienna: '🎻',
  Auckland: '⛵', Melbourne: '🎾', Sydney: '🦘', Lisbon: '🚋', Madrid: '🐂', Barcelona: '⛪', Rome: '🏛️',
  Amsterdam: '🚲', Berlin: '🐻', Stockholm: '👑', Copenhagen: '⚓', Seoul: '🎤', 'Hong Kong': '🌃', Tokyo: '🗼',
  Toronto: '🍁', 'Los Angeles': '🎬', 'San Francisco': '🌉', 'New York': '🗽', Singapore: '🦁', Zurich: '🏦', Paris: '🥐', London: '💂',
};

const towers = [];

function buildScene() {
  const bg = $('.center-bg');
  bg.append(el('div', 'rays'), el('div', 'stars'));
  const sky = el('div', 'skyline');
  const back = el('div', 'sky-back');
  let x = 0;
  while (x < 100) {
    const w = 3 + Math.random() * 4;
    const b = el('div', 'bld');
    b.style.cssText = `left:${x}%;width:${w}%;height:${30 + Math.random() * 90}px`;
    back.append(b);
    x += w + Math.random() * 0.8;
  }
  sky.append(back);
  const front = el('div', 'sky-front');
  GROUPS.forEach((g, gi) => {
    const t = el('div', 'tower');
    t.style.setProperty('--g', g.color);
    t.style.height = `${48 + ((gi * 37) % 5) * 9}px`;
    const flag = el('div', 'tflag');
    flag.hidden = true;
    t.append(el('div', 'troof'), flag);
    front.append(t);
    towers[gi] = { t, flag, key: '' };
  });
  sky.append(front);
  bg.append(sky);
}

function renderSkyline(s) {
  GROUPS.forEach((g, gi) => {
    const tw = towers[gi];
    if (!tw) return;
    const ids = SPACES.filter((sp) => sp.type === 'city' && sp.group === gi).map((sp) => sp.i);
    const owners = new Set(ids.map((i) => s.props[i] && s.props[i].o));
    const owner = owners.size === 1 ? [...owners][0] : null;
    const dev = ids.reduce((a, i) => a + ((s.props[i] && s.props[i].h) || 0), 0) / ids.length;
    const owned = ids.filter((i) => s.props[i] && s.props[i].o).length / ids.length;
    const p = owner ? pl(owner) : null;
    const key = `${owner}|${dev}|${owned}`;
    if (tw.key === key) return;
    const first = !tw.key;
    tw.key = key;
    const base = 48 + ((gi * 37) % 5) * 9;
    gsap.to(tw.t, { height: base + owned * 30 + dev * 22, duration: first ? 0 : 1.2, ease: 'elastic.out(1, 0.6)' });
    tw.t.classList.toggle('lit', owned > 0);
    tw.t.classList.toggle('full', !!p);
    tw.flag.hidden = !p;
    if (p) {
      tw.flag.textContent = p.emoji;
      tw.flag.style.setProperty('--c', p.color);
    }
  });
}

const CORNER_SUB = { start: `Collect ${money(PASS_START)} as you pass`, jail: 'Just visiting', parking: '', gotojail: 'Do not pass START' };

function buildBoard() {
  const board = $('#board');
  SPACES.forEach((sp, i) => {
    const [r, c] = coord(i);
    const side = Math.floor(i / 16);
    const corner = i % 16 === 0;
    const cell = el('div', `cell s${side} t-${sp.type}${corner ? ' corner' : ''}`);
    cell.style.gridArea = `${r} / ${c}`;
    const inner = el('div', 'inner');
    const txt = el('div', 'txt');
    if (sp.type === 'city') {
      const band = el('div', 'band');
      band.style.background = GROUPS[sp.group].color;
      band.append(el('div', 'houses'));
      inner.append(band);
      const long = sp.name.split(' ').some((w) => w.length > 8);
      txt.append(el('div', 'cicon', CITY_ICON[sp.name] || '🏙️'), el('div', 'name' + (long ? ' long' : ''), sp.name), el('div', 'price', money(sp.price)));
    } else if (corner) {
      txt.append(el('div', 'corner-icon', sp.icon), el('div', 'name', sp.name));
      const sub = el('div', 'sub', CORNER_SUB[sp.type]);
      if (sp.type === 'parking') sub.id = 'potLabel';
      txt.append(sub);
    } else {
      const price = sp.price ? money(sp.price) : sp.amount ? `Pay ${money(sp.amount)}` : '';
      txt.append(el('div', 'icon' + (sp.icon === '☀️' ? ' spin' : sp.icon === '💧' ? ' ripple' : ''), sp.icon), el('div', 'name', sp.name), el('div', 'price', price));
    }
    inner.append(txt);
    if (ownable(i)) {
      const owner = el('div', 'owner');
      owner.append(el('span', 'owner-emo'));
      inner.append(owner, el('div', 'mstamp', 'MORTGAGED'));
    }
    cell.append(inner);
    cell.addEventListener('click', () => {
      if (cam.dragged) return;
      if (warpPick(i)) return;
      openSpace(i);
    });
    board.append(cell);
    cells[i] = cell;
  });
}

const SPEED_FACE_SLOT = { 1: 1, 2: 2, 3: 3, bus: 4, tycoon: 5 };

function buildDice() {
  const d3 = $('#die3');
  for (let f = 1; f <= 6; f++) {
    const face = el('div', `face f${f}`);
    if (f <= 3) for (let k = 0; k < 9; k++) face.append(el('span', PIPS[f].includes(k) ? 'pip' : 'pip off'));
    else face.append(el('span', 'speed-emo', f === 4 ? '🚌' : '🎩'));
    d3.append(face);
  }
  gsap.set(d3, { rotationX: 0, rotationY: 0 });
  for (const id of ['die1', 'die2']) {
    const d = $('#' + id);
    for (let f = 1; f <= 6; f++) {
      const face = el('div', `face f${f}`);
      for (let k = 0; k < 9; k++) face.append(el('span', PIPS[f].includes(k) ? 'pip' : 'pip off'));
      d.append(face);
    }
    gsap.set(d, { rotationX: 0, rotationY: 0 });
  }
}

function cellCenter(i) {
  const c = cells[i];
  return [c.offsetLeft + c.offsetWidth / 2, c.offsetTop + c.offsetHeight / 2];
}

/* ---------- camera ---------- */

const cam = { s: 1, x: 0, y: 0, fit: 1, follow: true, dragged: false, touched: false };

const zoomOk = typeof CSS !== 'undefined' && CSS.supports('zoom', '2');
function applyCam() {
  const st = $('#stage');
  if (zoomOk) {
    const z = String(cam.s);
    if (st.style.zoom !== z) st.style.zoom = z;
    st.style.transform = `translate(${cam.x / cam.s}px, ${cam.y / cam.s}px)`;
  } else {
    st.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`;
  }
}

function hudSpace() {
  if (isPhone()) return { top: 0, bottom: 0 };
  const v = $('#viewport').getBoundingClientRect();
  const t = $('#deskTop').getBoundingClientRect();
  return { top: t.height ? t.bottom - v.top + 10 : 0, bottom: 84 };
}

function clampCam() {
  applyCam();
  const v = $('#viewport').getBoundingClientRect();
  const b = $('#board').getBoundingClientRect();
  if (cam.s <= cam.fit * 1.02) {
    const hs = hudSpace();
    cam.x += v.left + v.width / 2 - (b.left + b.width / 2);
    cam.y += v.top + hs.top + (v.height - hs.top - hs.bottom) / 2 - (b.top + b.height / 2);
    return;
  }
  const mx = v.width * 0.2;
  const my = v.height * 0.16;
  if (b.width < v.width - 2 * mx) cam.x += v.left + v.width / 2 - (b.left + b.width / 2);
  else if (b.left > v.left + mx) cam.x -= b.left - (v.left + mx);
  else if (b.right < v.right - mx) cam.x += v.right - mx - b.right;
  if (b.height < v.height - 2 * my) cam.y += v.top + v.height / 2 - (b.top + b.height / 2);
  else if (b.top > v.top + my) cam.y -= b.top - (v.top + my);
  else if (b.bottom < v.bottom - my) cam.y += v.bottom - my - b.bottom;
}

function fitCam(keepZoom = false, whole = false) {
  const r = $('#viewport').getBoundingClientRect();
  if (!r.width) return;
  const ratio = cam.fit ? cam.s / cam.fit : 1;
  const hs = hudSpace();
  const availH = r.height - hs.top - hs.bottom;
  cam.fit = Math.min(r.width, availH) / 1050;
  cam.s = cam.fit;
  cam.x = (r.width - 1000 * cam.s) / 2;
  cam.y = hs.top + (availH - 1000 * cam.s) / 2;
  applyCam();
  const b = $('#board').getBoundingClientRect();
  if (b.width && b.height) {
    cam.fit *= Math.min((r.width * 0.97) / b.width, (availH * 0.97) / b.height);
  }
  cam.s = whole ? cam.fit : keepZoom ? cam.fit * Math.max(1, ratio) : cam.fit * (isLand() ? 1.6 : isPhone() ? 2.4 : 1);
  clampCam();
  applyCam();
}

function zoomAt(px, py, factor) {
  const ns = Math.max(cam.fit, Math.min(cam.fit * 4, cam.s * factor));
  const k = ns / cam.s;
  cam.x = px - (px - cam.x) * k;
  cam.y = py - (py - cam.y) * k;
  cam.s = ns;
  clampCam();
  applyCam();
}

let probe = null;
function screenOf(bx, by) {
  if (!probe) {
    probe = el('div', 'probe');
    $('#board').append(probe);
  }
  probe.style.transform = `translate(${bx}px, ${by}px)`;
  const r = probe.getBoundingClientRect();
  return { x: r.left, y: r.top };
}

function panTo(bx, by, dur = 0.45) {
  if (!cam.follow || cam.s <= cam.fit * 1.05) return;
  const r = $('#viewport').getBoundingClientRect();
  const pt = screenOf(bx, by);
  const target = { x: cam.x + (r.left + r.width / 2 - pt.x), y: cam.y + (r.top + r.height / 2 - pt.y) };
  gsap.to(cam, {
    x: target.x, y: target.y, duration: dur, ease: 'power2.out', overwrite: true,
    onUpdate() { clampCam(); applyCam(); },
  });
}

function setupCamera() {
  const vp = $('#viewport');
  const pts = new Map();
  let start = null;
  vp.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = vp.getBoundingClientRect();
    gsap.killTweensOf(cam);
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  vp.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, .overlay-box .deed, .bigcard, .auction')) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cam.dragged = false;
    start = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, s: cam.s, d: 0 };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      start.d = Math.hypot(a.x - b.x, a.y - b.y);
      start.mx = (a.x + b.x) / 2;
      start.my = (a.y + b.y) / 2;
    }
  });
  window.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = vp.getBoundingClientRect();
    if (pts.size >= 2 && start.d) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = Math.max(cam.fit, Math.min(cam.fit * 4, start.s * (d / start.d)));
      zoomAt(start.mx - r.left, start.my - r.top, target / cam.s);
      cam.dragged = true;
      return;
    }
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) cam.dragged = true;
    if (cam.dragged) {
      gsap.killTweensOf(cam);
      cam.x = start.cx + dx;
      cam.y = start.cy + dy;
      clampCam();
      applyCam();
    }
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (!pts.size) {
      start = null;
      setTimeout(() => { cam.dragged = false; }, 0);
    } else {
      const [a] = [...pts.values()];
      start = { x: a.x, y: a.y, cx: cam.x, cy: cam.y, s: cam.s, d: 0 };
    }
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  const zc = (f) => () => {
    const r = vp.getBoundingClientRect();
    gsap.killTweensOf(cam);
    zoomAt(r.width / 2, r.height / 2, f);
  };
  $('#zoomIn').onclick = zc(1.3);
  $('#zoomOut').onclick = zc(1 / 1.3);
  $('#zoomFit').onclick = () => {
    gsap.killTweensOf(cam);
    fitCam(false, true);
  };
  $('#followBtn').onclick = (e) => {
    cam.follow = !cam.follow;
    e.currentTarget.classList.toggle('on', cam.follow);
    toast(cam.follow ? 'Camera follows the action' : 'Camera stays put');
  };
  window.addEventListener('resize', () => { if (inGame) { fitCam(true); layoutTokens(0); followActive(0); } });
  if (window.ResizeObserver) {
    let last = '';
    const ro = new ResizeObserver(() => {
      const sig = String($('#deskTop').offsetHeight);
      if (sig === last) return;
      last = sig;
      if (inGame && !isPhone() && cam.s <= cam.fit * 1.02) fitCam();
    });
    ro.observe($('#deskTop'));
  }
}

/* ---------- tokens ---------- */

function ensureToken(p) {
  let t = tokens[p.id];
  if (!t) {
    t = el('div', 'token');
    t.append(el('span', 'te'), el('span', 'bars'));
    $('#tokens').append(t);
    tokens[p.id] = t;
    shownPos[p.id] = p.pos;
    const [x, y] = cellCenter(p.pos);
    gsap.set(t, { x, y });
    standToken(t);
    gsap.from(t, { scale: 0, duration: 0.6, ease: 'back.out(3)', delay: Math.random() * 0.4 });
  }
  $('.te', t).textContent = p.emoji;
  t.style.setProperty('--c', p.color);
  return t;
}

function layoutTokens(dur = 0.3, skip = null) {
  if (!latest) return;
  const groups = {};
  latest.players.forEach((p) => {
    if (!tokens[p.id] || p.bankrupt) return;
    const pos = shownPos[p.id];
    (groups[pos] = groups[pos] || []).push(p.id);
  });
  for (const pos of Object.keys(groups)) {
    const ids = groups[pos];
    const c = cells[pos];
    const [cx, cy] = cellCenter(pos);
    const n = ids.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rws = Math.ceil(n / cols);
    const sx = cols > 1 ? Math.min(20, (c.offsetWidth - 26) / (cols - 1)) : 0;
    const sy = rws > 1 ? Math.min(20, (c.offsetHeight - 26) / (rws - 1)) : 0;
    ids.forEach((id, k) => {
      if (id === skip) return;
      const x = cx + ((k % cols) - (cols - 1) / 2) * sx;
      const y = cy + (Math.floor(k / cols) - (rws - 1) / 2) * sy + (tiltDeg() > 0 ? 12 : 0);
      gsap.to(tokens[id], { x, y, duration: dur, ease: 'power2.out', overwrite: 'auto' });
    });
  }
}

function syncTokens(s) {
  s.players.forEach((p) => {
    if (p.bankrupt) {
      if (tokens[p.id]) { tokens[p.id].remove(); delete tokens[p.id]; }
      return;
    }
    const t = ensureToken(p);
    shownPos[p.id] = p.pos;
    t.classList.toggle('jailed', p.inJail);
    t.classList.toggle('active', s.phase === 'playing' && s.players[s.turn].id === p.id);
    t.classList.toggle('mine', p.id === H.me());
  });
  layoutTokens(0.35);
}

/* ---------- update queue ---------- */

export function pushUpdate(s, ev) {
  latest = s;
  if (s.phase === 'lobby') { renderLobby(s); return; }
  queue.push({ s, ev });
  if (!busy) run();
}

async function run() {
  busy = true;
  renderActions(latest);
  while (queue.length) {
    const { s, ev } = queue.shift();
    speed = queue.length > 4 ? 4 : queue.length > 1 ? 2 : 1;
    if (!inGame) enterGame(s);
    for (const e of ev) {
      if (document.hidden) break;
      try { await Promise.race([animate(e, s), fx.wait(6000)]); } catch (err) { console.error(err); }
    }
    try { render(s); } catch (err) { console.error(err); }
  }
  busy = false;
  if (latest && latest.phase !== 'lobby') renderActions(latest);
}

function enterGame(s) {
  inGame = true;
  keepAwake(true);
  showScreen('game');
  document.body.classList.add('ingame');
  fitCam();
  requestAnimationFrame(() => followActive(0));
  s.players.forEach((p) => { if (!p.bankrupt) ensureToken(p); });
  layoutTokens(0);
  if (!isPhone()) gsap.from('#side', { x: 60, opacity: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' });
  gsap.from('.cell', { scale: 0.4, opacity: 0, duration: 0.5, stagger: { each: 0.008, from: 'start' }, ease: 'back.out(2)' });
  gsap.from('#logo span', { y: -60, opacity: 0, stagger: 0.15, duration: 0.9, ease: 'bounce.out', delay: 0.4 });
}

function render(s) {
  renderCells(s);
  syncTokens(s);
  renderPlayers(s);
  renderMe(s);
  renderCenter(s);
  renderFeed(s);
  renderTrades(s);
  if (spaceModal) fillSpace(spaceModal.body, spaceModal.i, s);
  if (s.phase === 'over') showGameOver(s);
}

const sleep = (ms) => fx.wait(ms / speed);

/* ---------- phone layout ---------- */

const phoneMQ = window.matchMedia('(max-width: 820px), (orientation: landscape) and (max-height: 520px)');
const landMQ = window.matchMedia('(orientation: landscape) and (max-height: 520px)');
const isPhone = () => phoneMQ.matches;
const isLand = () => phoneMQ.matches && landMQ.matches;
const homes = new Map();
let sheetTab = null;
let unread = 0;

function remember(el) {
  if (!homes.has(el)) homes.set(el, { parent: el.parentNode, next: el.nextSibling });
}

function applyLayout() {
  const phone = isPhone();
  document.body.classList.toggle('phone', phone);
  document.body.classList.toggle('land', isLand());
  const moves = [
    [$('#meBar'), $('#hudTop'), null],
    [$('#turnBanner'), $('#hudTop'), $('#deskTop')],
    [$('#modeBar'), $('#hudTop'), $('#deskTop')],
    [$('#marketBar'), $('#hudTop'), $('#deskTop')],
    [$('#diceArea'), $('#hudBottom .hb-main'), null],
    [$('#actions'), $('#hudBottom .hb-main'), $('#deskDock')],
    [$('#buyBox'), $('#phoneOverlay'), $('#deskOverlay')],
    [$('#auctionBox'), $('#phoneOverlay'), $('#deskOverlay')],
    [$('#cardBox'), $('#phoneOverlay'), $('#deskOverlay')],
  ];
  for (const [el, phoneParent, deskParent] of moves) {
    remember(el);
    if (phone) phoneParent.append(el);
    else if (deskParent) deskParent.append(el);
    else {
      const h = homes.get(el);
      h.parent.insertBefore(el, h.next && h.next.parentNode === h.parent ? h.next : null);
    }
  }
  if (!phone) closeSheet();
  applyMotion();
  if (inGame) {
    fitCam();
    layoutTokens(0);
    followActive(0);
  }
}

function followActive(dur = 0.5) {
  if (!latest || latest.phase !== 'playing') return;
  const c = latest.players[latest.turn];
  const t = c && tokens[c.id];
  if (t) panTo(gsap.getProperty(t, 'x'), gsap.getProperty(t, 'y'), dur);
}

function openSheet(tab) {
  const side = $('#side');
  if (side.classList.contains('open') && sheetTab === tab) { closeSheet(); return; }
  sheetTab = tab;
  side.dataset.tab = tab;
  $('.sheet-title', side).textContent = tab === 'chat' ? '💬 Chat & log' : '👥 Landlords';
  side.classList.add('open');
  $('#sheetBackdrop').classList.add('show');
  document.querySelectorAll('.tabbar .tab').forEach((b) => b.classList.toggle('on', b.id === tab + 'Tab'));
  if (tab === 'chat') {
    unread = 0;
    updateBadge();
    const feed = $('#feed');
    feed.scrollTop = feed.scrollHeight;
  }
  fx.sfx.click();
}

function closeSheet() {
  const side = $('#side');
  if (!side.classList.contains('open')) return;
  side.classList.remove('open');
  $('#sheetBackdrop').classList.remove('show');
  document.querySelectorAll('.tabbar .tab').forEach((b) => b.classList.remove('on'));
  if (document.activeElement && document.activeElement.id === 'chatIn') document.activeElement.blur();
  sheetTab = null;
}

function updateBadge() {
  const b = $('#chatBadge');
  b.hidden = unread === 0;
  b.textContent = unread > 9 ? '9+' : String(unread);
  if (unread) gsap.fromTo(b, { scale: 1.6 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
}

function setupPhone() {
  $('#playersTab').onclick = () => openSheet('players');
  $('#chatTab').onclick = () => openSheet('chat');
  $('#tradeTab').onclick = () => { closeSheet(); openTrade(); };
  $('#rulesTab').onclick = () => { closeSheet(); openRules(); };
  $('#endTab').onclick = () => { closeSheet(); confirmEnd(); };
  const mt = $('#muteTab');
  const setIcon = () => updateSoundIcons();
  setIcon();
  mt.onclick = () => { closeSheet(); openSettings(); };
  $('#sheetClose').onclick = closeSheet;
  $('#sheetBackdrop').onclick = closeSheet;
  $('#chatIn').addEventListener('focus', () => {
    if (isPhone()) setTimeout(() => { $('#feed').scrollTop = $('#feed').scrollHeight; }, 300);
  });
  phoneMQ.addEventListener('change', applyLayout);
  landMQ.addEventListener('change', applyLayout);
  applyLayout();
}

async function animate(e, s) {
  switch (e.k) {
    case 'start':
      fx.sfx.fanfare();
      fx.banner('GAME ON!', `${modeLabel(s.settings)} · ${s.players.length} landlords${activePacks(s.settings).length ? ' · ' + activePacks(s.settings).map((p) => p.icon).join('') : ''}`, '#06d6a0', 1.4);
      { const c = fx.center($('#logo')); fx.confetti(c.x, c.y); }
      await fx.wait(900);
      break;
    case 'turn': return animTurn(e);
    case 'round':
      fx.toast(`Round ${e.r}`);
      break;
    case 'dice': return animDice(e);
    case 'move': return animMove(e);
    case 'land': {
      const c = cells[e.sp];
      c.classList.remove('flash');
      void c.offsetWidth;
      c.classList.add('flash');
      break;
    }
    case 'pay': return animPay(e);
    case 'buy':
    case 'sold': return animSold(e);
    case 'card': return animCard(e);
    case 'jail': return animJail(e);
    case 'free': {
      const t = tokens[e.pid];
      if (t) {
        t.classList.remove('jailed');
        const c = fx.center(t);
        fx.burst(c.x, c.y, { colors: ['#fff', '#ffd166'], n: 24, shape: 'star' });
        fx.sfx.pop();
      }
      await sleep(300);
      break;
    }
    case 'build':
    case 'sell':
      setHouses(e.sp, e.h, true);
      if (propShown[e.sp]) propShown[e.sp].h = e.h;
      await sleep(e.k === 'build' ? 250 : 120);
      break;
    case 'mortgage':
      cells[e.sp].classList.toggle('mortgaged', e.m);
      if (propShown[e.sp]) propShown[e.sp].m = e.m;
      if (e.m) gsap.fromTo($('.mstamp', cells[e.sp]), { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'power4.in' });
      fx.sfx.sold();
      await sleep(200);
      break;
    case 'liquidate': {
      const c = fx.center(tokens[e.pid]);
      if (c) fx.floatText(c.x, c.y - 20, `Sold assets +${money(e.amt)}`, { color: '#ffd166', size: 16 });
      break;
    }
    case 'monopoly': {
      const p = pl(e.pid);
      const g = GROUPS[e.g];
      fx.sfx.fanfare();
      for (const i of SPACES.filter((x) => x.group === e.g && x.type === 'city').map((x) => x.i)) {
        const c = fx.center(cells[i]);
        fx.burst(c.x, c.y, { colors: [g.color, '#fff', '#ffd166'], n: 30, shape: 'star', speed: 6 });
        gsap.fromTo(cells[i], { scale: 1.25, zIndex: 5 }, { scale: 1, zIndex: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      }
      const lc = fx.center($('#logo'));
      fx.confetti(lc.x, lc.y, [g.color, '#ffffff', '#ffd166']);
      await fx.banner(`${p ? p.emoji + ' ' + p.name : 'Someone'} owns ${g.name}!`, 'Full set · rents doubled · houses unlocked', g.color, 1 / speed);
      break;
    }
    case 'bankrupt': {
      const p = pl(e.pid);
      const t = tokens[e.pid];
      fx.sfx.fail();
      if (t) {
        const c = fx.center(t);
        fx.burst(c.x, c.y, { colors: [p ? p.color : '#fff', '#222', '#888'], n: 70, speed: 8, shape: 'shard', size: 6, g: 0.25, life: 80 });
        gsap.to(t, { scale: 2, opacity: 0, rotation: 180, duration: 0.4, onComplete: () => { t.remove(); } });
        delete tokens[e.pid];
      }
      fx.shake($('#viewport'), 14);
      await fx.banner(`💀 ${p ? p.name : 'A player'} is bankrupt`, '', '#ef476f', 1 / speed);
      break;
    }
    case 'tradeOffer':
      if (e.to === H.me()) { fx.sfx.chat(); }
      break;
    case 'trade': {
      const a = pl(e.from);
      const b = pl(e.to);
      fx.sfx.buy();
      const ca = fx.center(tokens[e.from]);
      const cb = fx.center(tokens[e.to]);
      if (ca && cb) fx.flyCoins(ca, cb, 4, speed).then(() => fx.flyCoins(cb, ca, 4, speed));
      await fx.banner('🤝 Deal!', `${a ? a.name : '?'} ⇄ ${b ? b.name : '?'}`, '#4cc9f0', 0.8 / speed);
      break;
    }
    case 'tradeNo':
      if (e.from === H.me() && !e.cancelled) toast(`${pl(e.to)?.name || 'They'} declined your offer${e.why ? ` (${e.why})` : ''}`, 'bad');
      break;
    case 'bid': {
      fx.sfx.bid();
      const r = rows[e.pid];
      const c = fx.center(r ? $('.avatar', r) : null) || fx.center($('#auctionBox'));
      if (c) fx.floatText(c.x, c.y, money(e.amt), { color: '#ffd166', size: 16, rise: 40 });
      break;
    }
    case 'auction':
      fx.sfx.whoosh();
      break;
    case 'clock': {
      const label = e.left >= 60000 ? `${e.left / 60000} MINUTE${e.left > 60000 ? 'S' : ''} LEFT!` : `${e.left / 1000} SECONDS LEFT!`;
      fx.sfx.turn();
      fx.shake($('#modeBar'), 8);
      await fx.banner(`⏱️ ${label}`, 'Most cash and highest property value win when the clock hits zero', '#ef476f', 0.8);
      break;
    }
    case 'market': {
      const good = ['boom', 'bull', 'tourism', 'stimulus'].includes(e.kind);
      if (good) fx.sfx.fanfare(); else fx.sfx.fail();
      const hit = [];
      SPACES.forEach((sp) => {
        if (e.group != null ? sp.type === 'city' && sp.group === e.group : e.kind === 'tourism' ? sp.type === 'airport' : e.kind === 'blackout' ? sp.type === 'utility' : ownable(sp.i)) hit.push(sp.i);
      });
      hit.forEach((i) => gsap.fromTo(cells[i], { scale: 1.15 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' }));
      if (e.group != null) {
        const c = fx.center(cells[hit[0]]);
        fx.burst(c.x, c.y, { colors: [GROUPS[e.group].color, '#fff'], n: 40, shape: 'star', speed: 6 });
      }
      await fx.banner('📰 BREAKING NEWS', e.text, good ? '#06d6a0' : '#ef476f', 1.4 / speed);
      break;
    }
    case 'caught': {
      const t = tokens[e.pid];
      fx.sfx.jail();
      fx.shake($('#viewport'), 12);
      if (t) {
        const c = fx.center(t);
        fx.burst(c.x, c.y, { colors: ['#ef476f', '#4cc9f0', '#fff'], n: 50, shape: 'star', speed: 7 });
        fx.floatText(c.x, c.y - 30, '🚔', { size: 40 });
      }
      await fx.banner('🚨 CAUGHT CHEATING!', `${pl(e.by)?.name || '?'} caught ${pl(e.pid)?.name || '?'} ${e.kind === 'skim' ? 'skimming the bank' : 'swiping cash'}`, '#ef476f', 1 / speed);
      break;
    }
    case 'falseAccuse':
      fx.sfx.fail();
      await fx.banner('🙊 WRONG!', `${pl(e.pid)?.name || '?'} falsely accused ${pl(e.target)?.name || '?'}`, '#f79824', 0.8 / speed);
      break;
    case 'tycoon': {
      const t = tokens[e.pid];
      if (t) {
        const c = fx.center(t);
        fx.floatText(c.x, c.y - 30, '🎩 TYCOON MOVE!', { color: '#ffd166', size: 20 });
      }
      fx.sfx.whoosh();
      await sleep(400);
      break;
    }
    case 'zone':
      setZone(e.sp, e.z, true);
      if (propShown[e.sp]) propShown[e.sp].z = e.z;
      await sleep(450);
      break;
    case 'terminal':
      setTerminal(e.sp, e.on, true);
      if (propShown[e.sp]) propShown[e.sp].t = e.on;
      await sleep(350);
      break;
    case 'win':
      fx.sfx.fanfare();
      await fx.banner(s.endReason === 'host' ? '🏁 GAME ENDED' : s.endReason === 'time' ? '⏱️ TIME UP!' : s.endReason === 'rounds' ? '🔁 FINAL ROUND DONE!' : s.endReason === 'property' ? '🏙️ BOARD SOLD OUT!' : '🏆 GAME OVER', '', '#ffd166', 0.9);
      break;
    default:
      break;
  }
  return undefined;
}

async function animTurn(e) {
  const p = pl(e.pid);
  if (!p) return;
  Object.entries(tokens).forEach(([id, t]) => t.classList.toggle('active', id === e.pid));
  const t = tokens[e.pid];
  if (t) {
    const [x, y] = [gsap.getProperty(t, 'x'), gsap.getProperty(t, 'y')];
    panTo(x, y, 0.6);
    gsap.fromTo(t, { scale: 1.6 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  }
  const r = rows[e.pid];
  if (r) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (e.pid === H.me()) {
    fx.sfx.turn();
    if (navigator.vibrate) navigator.vibrate(60);
    await fx.banner('YOUR TURN!', 'Press Space or tap Roll', p.color, 0.6);
  } else await sleep(150);
}

async function animDice(e) {
  const [a, b] = e.d;
  fx.sfx.dice();
  const area = $('#diceArea');
  area.classList.remove('dbl');
  const tl = gsap.timeline();
  const set = [[$('#die1'), a], [$('#die2'), b]];
  if (e.sp != null) set.push([$('#die3'), SPEED_FACE_SLOT[e.sp]]);
  set.forEach(([d, v], k) => {
    const [rx, ry] = DIE_ROT[v];
    const sx = 360 * (2 + Math.floor(Math.random() * 2));
    const sy = 360 * (2 + Math.floor(Math.random() * 2));
    gsap.set(d, { rotationX: gsap.getProperty(d, 'rotationX') % 360, rotationY: gsap.getProperty(d, 'rotationY') % 360 });
    tl.to(d, { rotationX: rx + sx, rotationY: ry + sy, duration: 1.05 / speed, ease: 'power3.out' }, k * 0.05);
    if (!isPhone() && motionFull) {
      const sx = 360 + k * 46;
      const sy = 250 - k * 24;
      tl.fromTo(d.parentElement, { x: sx, y: sy, scale: 1.8 }, { keyframes: { x: [sx * 0.42, sx * 0.12, 0], y: [-26, 10, 0], scale: [1.18, 1.04, 1] }, duration: 1.05 / speed, ease: 'power2.out' }, k * 0.07);
      tl.fromTo(d.parentElement, { opacity: 0 }, { opacity: 1, duration: 0.15 }, k * 0.07);
    } else {
      tl.fromTo(d.parentElement, { y: -90, x: (k ? 40 : -40) }, { y: 0, x: 0, duration: 0.95 / speed, ease: 'bounce.out' }, k * 0.05);
    }
  });
  await tl.then();
  if (typeof e.sp === 'number' && a === b && b === e.sp) {
    area.classList.add('dbl');
    fx.sfx.fanfare();
    const c = fx.center(area);
    fx.confetti(c.x, c.y, ['#ffd166', '#f77f00', '#ffffff']);
    await fx.banner('⚡ TRIPLES!', 'Warp to any space on the board', '#f77f00', 0.8 / speed);
  } else if (a === b) {
    area.classList.add('dbl');
    const c = fx.center(area);
    fx.floatText(isPhone() ? c.x + 90 : c.x, c.y - (isPhone() ? 24 : 58), 'DOUBLES!', { color: '#ffd166', size: isPhone() ? 20 : 26, rise: isPhone() ? 30 : 70 });
    fx.burst(c.x, c.y, { colors: ['#ffd166', '#fff'], n: 30, shape: 'star' });
    fx.sfx.pop();
  }
  const c = fx.center(area);
  const label = e.sp === 'bus' ? '🚌 BUS!' : e.sp === 'tycoon' ? `${a + b} + 🎩` : typeof e.sp === 'number' ? String(a + b + e.sp) : String(a + b);
  fx.floatText(isPhone() ? c.x + 90 : c.x, isPhone() ? c.y : c.y + 62, label, { color: e.sp != null && typeof e.sp !== 'number' ? '#ffd166' : '#fff', size: 30, rise: 30, dur: 0.9 });
  await sleep(250);
}

async function animMove(e) {
  const t = tokens[e.pid];
  if (!t || !e.path.length) return;
  if (e.fly) {
    const last = e.path[e.path.length - 1];
    const [x, y] = cellCenter(last);
    const sx = gsap.getProperty(t, 'x');
    const sy = gsap.getProperty(t, 'y');
    fx.sfx.whoosh();
    panTo(x, y, 0.6);
    t.classList.add('moving');
    await gsap.to(t, { keyframes: { x: [(sx + x) / 2, x], y: [Math.min(sy, y) - 220, y] }, rotation: 360, scale: 1.4, duration: 1 / speed, ease: 'power2.inOut' }).then();
    gsap.set(t, { rotation: 0, scale: 1 });
    t.classList.remove('moving');
    shownPos[e.pid] = last;
    const c = fx.center(t);
    fx.burst(c.x, c.y, { colors: ['#f77f00', '#ffd166', '#fff'], n: 40, shape: 'star', speed: 6 });
    fx.sfx.land();
    layoutTokens(0.25);
    await sleep(200);
    return;
  }
  t.classList.add('moving');
  const per = (e.path.length > 14 ? 0.09 : e.path.length > 7 ? 0.13 : 0.17) / speed;
  const tl = gsap.timeline();
  let py = gsap.getProperty(t, 'y');
  e.path.forEach((i, k) => {
    const [x, y] = cellCenter(i);
    const at = k * per;
    if (tiltDeg() > 0) {
      tl.to(t, { x, y, duration: per, ease: 'none' }, at);
      tl.to(t, { z: 34, duration: per / 2, ease: 'power1.out' }, at);
      tl.to(t, { z: 0, duration: per / 2, ease: 'power1.in' }, at + per / 2);
    } else {
      tl.to(t, { x, duration: per, ease: 'none' }, at);
      tl.to(t, { y: Math.min(py, y) - 26, duration: per / 2, ease: 'power1.out' }, at);
      tl.to(t, { y, duration: per / 2, ease: 'power1.in' }, at + per / 2);
    }
    tl.to(t, { scaleY: 0.78, scaleX: 1.2, duration: per * 0.2, yoyo: true, repeat: 1, ease: 'power1.out' }, at + per * 0.85);
    tl.call(() => {
      fx.sfx.hop();
      panTo(x, y, per * 3);
      if (i === START && e.path.length > 1) {
        const c = fx.center(cells[START]);
        fx.burst(c.x, c.y, { colors: ['#06d6a0', '#ffd166', '#fff'], n: 40, shape: 'star', speed: 6 });
      }
    }, null, at);
    py = y;
  });
  await tl.then();
  t.classList.remove('moving');
  shownPos[e.pid] = e.path[e.path.length - 1];
  fx.sfx.land();
  const c = fx.center(t);
  fx.burst(c.x, c.y + 8, { colors: ['rgba(255,255,255,0.8)'], n: 10, speed: 2.5, g: 0, size: 3, life: 25 });
  layoutTokens(0.25);
  await sleep(200);
}

function anchor(id) {
  if (id === 'bank') return fx.center($('#logo'));
  if (id === 'pot') return fx.center(cells[PARKING]);
  if (tokens[id]) return fx.center(tokens[id]);
  const r = rows[id];
  return r ? fx.center($('.avatar', r)) : fx.center($('#logo'));
}

function bumpCash(pid, delta) {
  if (cashShown[pid] == null) return;
  animateCash(pid, cashShown[pid] + delta);
}

function animateCash(pid, to) {
  const r = rows[pid];
  const from = cashShown[pid] ?? to;
  cashShown[pid] = to;
  const targets = [r ? $('.pcash', r) : null, pid === H.me() ? $('.me-cash') : null].filter(Boolean);
  const o = { v: from };
  gsap.to(o, {
    v: to, duration: 0.8, ease: 'power2.out',
    onUpdate() { targets.forEach((x) => { x.textContent = money(o.v); }); },
  });
  targets.forEach((x) => {
    x.classList.remove('up', 'down');
    void x.offsetWidth;
    x.classList.add(to >= from ? 'up' : 'down');
  });
}

async function animPay(e) {
  if (e.quiet) {
    if (e.from !== 'bank' && e.from !== 'pot') bumpCash(e.from, -e.amt);
    if (e.to !== 'bank' && e.to !== 'pot') bumpCash(e.to, e.amt);
    if (e.to === 'pot') setPot(potShown + e.amt);
    return;
  }
  const a = anchor(e.from);
  const b = anchor(e.to);
  const n = Math.max(3, Math.min(14, Math.round(e.amt / 40)));
  const flight = fx.flyCoins(a, b, n, speed);
  if (e.from !== 'bank' && e.from !== 'pot') {
    bumpCash(e.from, -e.amt);
    if (a) fx.floatText(a.x, a.y - 18, `−${money(e.amt)}`, { color: '#ff6b81', size: 18 });
  }
  if (e.jackpot) {
    fx.sfx.jackpot();
    const c = fx.center(cells[PARKING]);
    fx.confetti(c.x, c.y, ['#ffd166', '#fff3b0', '#f77f00']);
    fx.banner(`🎰 JACKPOT ${money(e.amt)}!`, pl(e.to)?.name || '', '#ffd166', 1);
  }
  if (e.why === 'Passed START') {
    const c = fx.center(cells[START]);
    fx.floatText(c.x, c.y - 30, `+${money(e.amt)} PASS START`, { color: '#06d6a0', size: 18 });
  }
  if (e.why && e.why.startsWith('Rent') && a) fx.floatText(a.x, a.y - 46, e.why, { color: '#fff', size: 13, rise: 30 });
  await Promise.race([flight, fx.wait(900 / speed)]);
  if (e.to !== 'bank' && e.to !== 'pot') {
    bumpCash(e.to, e.amt);
    if (b) fx.floatText(b.x, b.y - 18, `+${money(e.amt)}`, { color: '#5df2a3', size: 18 });
  }
  if (e.to === 'pot' || e.from === 'pot') setPot(e.to === 'pot' ? (potShown + e.amt) : 0);
  await sleep(e.jackpot ? 1200 : 150);
}

async function animSold(e) {
  const p = pl(e.pid);
  if (e.k === 'sold') {
    const box = $('#auctionBox .auction');
    if (box) {
      const st = el('div', 'stamp', p ? 'SOLD!' : 'NO SALE');
      box.append(st);
      fx.sfx.sold();
      gsap.fromTo(st, { scale: 3, opacity: 0, rotation: -25 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.35, ease: 'power4.in' });
      fx.shake(box, 8);
      await sleep(900);
    }
    if (!p) return;
  }
  const i = e.sp;
  const c = fx.center(cells[i]);
  fx.sfx.buy();
  fx.burst(c.x, c.y, { colors: [p.color, '#fff', '#ffd166'], n: 36, shape: 'star', speed: 5 });
  setOwner(i, { o: e.pid, h: 0, m: false }, true);
  await sleep(500);
}

async function animCard(e) {
  const c = (e.deck === 'fortune' ? FORTUNE : TREASURY)[e.idx];
  const p = pl(e.pid);
  const box = $('#cardBox');
  box.innerHTML = '';
  const card = el('div', `bigcard ${e.deck}`);
  const back = el('div', 'bc-face bc-back');
  back.append(el('div', 'bc-logo', e.deck === 'fortune' ? '❓' : '💰'), el('div', 'bc-deck', e.deck === 'fortune' ? 'FORTUNE' : 'TREASURY'));
  const front = el('div', 'bc-face bc-front');
  front.append(
    el('div', 'bc-title', e.deck === 'fortune' ? 'FORTUNE' : 'TREASURY'),
    el('div', 'bc-icon', c.icon),
    el('div', 'bc-text', c.text),
    el('div', 'bc-who', p ? `${p.emoji} ${p.name}` : ''),
  );
  card.append(back, front);
  box.append(card);
  const deck = $(`.deck.${e.deck}`);
  const dc = fx.center(deck);
  const bc = fx.center(box);
  const k = box.closest('#board') ? cam.s : 1;
  const dx = (dc.x - bc.x) / k;
  const dy = (dc.y - bc.y) / k;
  fx.sfx.card();
  gsap.fromTo(deck, { y: -6 }, { y: 0, duration: 0.4, ease: 'bounce.out' });
  const tl = gsap.timeline();
  tl.fromTo(card, { x: dx, y: dy, scale: 0.3, rotation: -12, rotationY: 0 }, { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.5 / speed, ease: 'power3.out' })
    .to(card, { rotationY: 180, duration: 0.55 / speed, ease: 'back.out(1.6)' })
    .from(front.children, { y: 12, opacity: 0, stagger: 0.06, duration: 0.25 }, '-=0.25');
  await tl.then();
  const ic = fx.center($('.bc-icon', card));
  fx.burst(ic.x, ic.y, { colors: e.deck === 'fortune' ? ['#c77dff', '#fff'] : ['#2ec4b6', '#fff'], n: 24, shape: 'star' });
  await sleep(1900);
  await gsap.to(card, { y: -90, opacity: 0, scale: 0.8, rotation: 8, duration: 0.35 / speed, ease: 'power2.in' }).then();
  box.innerHTML = '';
}

async function animJail(e) {
  const t = tokens[e.pid];
  if (!t) return;
  const [x, y] = cellCenter(JAIL);
  fx.sfx.whoosh();
  panTo(x, y, 0.5);
  const tl = gsap.timeline();
  const sx = gsap.getProperty(t, 'x');
  const sy = gsap.getProperty(t, 'y');
  tl.to(t, { keyframes: { x: [(sx + x) / 2, x], y: [Math.min(sy, y) - 160, y] }, rotation: 720, duration: 0.8 / speed, ease: 'power2.inOut' });
  await tl.then();
  gsap.set(t, { rotation: 0 });
  shownPos[e.pid] = JAIL;
  t.classList.add('jailed');
  gsap.fromTo($('.bars', t), { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'bounce.out' });
  fx.sfx.jail();
  fx.shake($('#viewport'), 16);
  const c = fx.center(cells[JAIL]);
  fx.burst(c.x, c.y, { colors: ['#adb5bd', '#495057', '#ef476f'], n: 30, shape: 'shard', speed: 6 });
  layoutTokens(0.25);
  await fx.banner('🚔 TO JAIL!', pl(e.pid)?.name || '', '#ef476f', 0.5 / speed);
}

/* ---------- cells ---------- */

function setOwner(i, pr, animate) {
  const c = cells[i];
  const o = $('.owner', c);
  const p = pr.o ? pl(pr.o) : null;
  propShown[i] = { ...(propShown[i] || { h: 0, m: false }), o: pr.o };
  c.classList.toggle('owned', !!p);
  c.style.setProperty('--oc', p ? p.color : 'transparent');
  if (p) {
    o.style.setProperty('--c', p.color);
    $('.owner-emo', o).textContent = p.emoji;
    if (SPACES[i].type === 'city') {
      let lights = $('.lights', c);
      if (!lights) {
        lights = el('div', 'lights');
        for (let k = 0; k < 3; k++) {
          const dot = el('span');
          dot.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
          dot.style.animationDuration = `${(2.2 + Math.random() * 2).toFixed(2)}s`;
          lights.append(dot);
        }
        $('.inner', c).append(lights);
      }
      lights.style.setProperty('--c', p.color);
    }
    if (animate) gsap.fromTo(o, { y: -60, opacity: 0, scale: 1.6 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'bounce.out' });
  }
}

function setHouses(i, h, animate) {
  const box = $('.houses', cells[i]);
  if (!box) return;
  const first = box.firstChild;
  const prev = first && first.classList.contains('sky') ? 6 : first && first.classList.contains('hotel') ? 5 : box.childElementCount;
  box.innerHTML = '';
  if (h === 6) box.append(el('div', 'sky'));
  else if (h === 5) box.append(el('div', 'hotel'));
  else for (let k = 0; k < h; k++) box.append(el('div', 'house'));
  if (animate && h !== prev) {
    if (h > prev) {
      const last = box.lastChild;
      if (last) gsap.fromTo(last, { y: -30, scale: 0, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'bounce.out' });
      fx.sfx.build();
      const c = fx.center(cells[i]);
      fx.burst(c.x, c.y, { colors: [h === 6 ? '#4cc9f0' : h === 5 ? '#ef476f' : '#06d6a0', '#fff'], n: h === 6 ? 50 : 18, speed: h === 6 ? 7 : 4, shape: h === 6 ? 'star' : 'circle' });
    } else {
      fx.sfx.whoosh();
    }
  }
}

function renderCells(s) {
  s.props.forEach((pr, i) => {
    if (!pr) return;
    const prev = propShown[i];
    if (!prev || prev.o !== pr.o) {
      if (pr.o) setOwner(i, pr, !!prev);
      else {
        cells[i].classList.remove('owned');
        propShown[i] = { o: null, h: 0, m: false };
      }
    }
    if (!prev || prev.h !== pr.h) setHouses(i, pr.h, !!prev);
    if (!prev || prev.z !== pr.z) setZone(i, pr.z, !!prev);
    if (!prev || prev.t !== pr.t) setTerminal(i, pr.t, !!prev);
    cells[i].classList.toggle('mortgaged', pr.m);
    const local = (s.market || []).filter((e) => e.target !== 'all');
    const mm = local.length ? marketMult({ ...s, market: local }, i) : 1;
    cells[i].classList.toggle('boom', mm > 1.001);
    cells[i].classList.toggle('crash', mm < 0.999);
    propShown[i] = { o: pr.o, h: pr.h, m: pr.m, z: pr.z, t: pr.t };
  });
  const p = me();
  document.body.classList.toggle('picking', s.phase === 'playing' && s.stage === 'teleport' && !!p && s.players[s.turn].id === p.id && !busy);
  setPot(s.pot);
  renderSkyline(s);
}

function badge(i, cls) {
  let b = $('.' + cls, cells[i]);
  if (!b) {
    b = el('div', cls);
    $('.inner', cells[i]).append(b);
  }
  return b;
}

function setZone(i, z, animate) {
  const b = badge(i, 'zbadge');
  b.textContent = z === 'park' ? '🌳' : z === 'factory' ? '🏭' : '';
  b.hidden = !z;
  cells[i].classList.toggle('factory', z === 'factory');
  if (animate && z) {
    gsap.fromTo(b, { scale: 3, opacity: 0, y: -40 }, { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: 'bounce.out' });
    const c = fx.center(cells[i]);
    fx.burst(c.x, c.y, { colors: z === 'park' ? ['#2bd47d', '#a7f3d0'] : ['#6c757d', '#343a40', '#adb5bd'], n: 30, speed: 5, shape: z === 'park' ? 'star' : 'shard' });
    fx.sfx.build();
  }
}

function setTerminal(i, on, animate) {
  const b = badge(i, 'tbadge');
  b.textContent = on ? '🛫' : '';
  b.hidden = !on;
  if (animate && on) {
    gsap.fromTo(b, { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(3)' });
    const c = fx.center(cells[i]);
    fx.burst(c.x, c.y, { colors: ['#4cc9f0', '#fff'], n: 30, speed: 5, shape: 'star' });
    fx.sfx.build();
  }
}

function warpPick(i) {
  const s = latest;
  const p = me();
  if (!s || !p || s.phase !== 'playing' || s.stage !== 'teleport' || s.players[s.turn].id !== p.id) return false;
  fx.sfx.click();
  document.body.classList.remove('picking');
  H.send({ t: 'teleport', sp: i });
  return true;
}

let cheatTurn = -1;
function openCheat(s) {
  const p = me();
  if (!p) return;
  const root = el('div', 'cheat');
  root.append(el('h2', '', '🃏 Cheat… quietly'), el('p', 'muted', `Anyone can accuse you in the next 12 seconds. Caught = refund + pay the accuser.`));
  const m = modal(root, { cls: 'wide' });
  const go = (a, msg) => {
    cheatTurn = s.turnId;
    H.send(a);
    m.close();
    toast(msg, 'good');
    const box = $('#actions');
    box.dataset.key = '';
    renderActions(latest);
  };
  const skim = el('button', 'btn primary', `💵 Skim ${money(SKIM_AMT)} from the bank`);
  skim.type = 'button';
  skim.onclick = () => go({ t: 'cheat', kind: 'skim' }, '🤫 Skimmed. Act natural…');
  root.append(skim, el('div', 'tc-label', `Or swipe ${money(SWIPE_AMT)} from…`));
  const list = el('div', 'trade-pick');
  s.players.filter((q) => !q.bankrupt && q.id !== p.id).forEach((q) => {
    const b = el('button', 'tp', q.emoji);
    b.type = 'button';
    b.title = q.name;
    b.style.setProperty('--c', q.color);
    b.onclick = () => go({ t: 'cheat', kind: 'swipe', target: q.id }, `🤫 Swiped from ${q.name}. Act natural…`);
    list.append(b);
  });
  root.append(list);
}

function openAccuse(s) {
  const p = me();
  if (!p) return;
  const cands = [s.players[s.turn], s.prevPid ? P(s, s.prevPid) : null].filter((q, k, arr) => q && !q.bankrupt && q.id !== p.id && arr.indexOf(q) === k);
  const root = el('div', 'cheat');
  root.append(el('h2', '', '🚨 Who’s cheating?'), el('p', 'muted', 'Right: they refund and pay you $100. Wrong: you pay them $50. One accusation per turn.'));
  const m = modal(root);
  cands.forEach((q) => {
    const b = el('button', 'btn big accuse-pick', `${q.emoji} ${q.name}`);
    b.type = 'button';
    b.onclick = () => { fx.sfx.click(); H.send({ t: 'accuse', target: q.id }); m.close(); };
    root.append(b);
  });
  if (!cands.length) root.append(el('div', 'tc-empty', 'Nobody to accuse right now'));
}

const MARKET_SHORT = {
  boom: (e) => `📈 ${GROUPS[e.group].name} +50%`,
  crash: (e) => `📉 ${GROUPS[e.group].name} −50%`,
  recession: () => '🌧️ All rents −25%',
  bull: () => '🐂 All rents +25%',
  tourism: () => '✈️ Airports ×2',
  blackout: () => '🔌 Utilities off',
};

let potShown = -1;
function setPot(v) {
  if (v === potShown) return;
  const lbl = $('#potLabel');
  const from = Math.max(0, potShown);
  potShown = v;
  const o = { v: from };
  gsap.to(o, { v, duration: 0.8, onUpdate() { lbl.textContent = money(o.v); } });
  gsap.fromTo(cells[PARKING], { scale: 1.12 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
}

/* ---------- sidebar ---------- */

function setupSide() {
  const em = $('#emotes');
  EMOTES.forEach((e) => {
    const b = el('button', 'emote', e);
    b.type = 'button';
    b.onclick = () => {
      if (b.dataset.cool) return;
      b.dataset.cool = '1';
      setTimeout(() => { delete b.dataset.cool; }, 700);
      H.emote(e);
    };
    em.append(b);
  });
  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#chatIn');
    const t = inp.value.trim();
    if (t) H.chat(t);
    inp.value = '';
  });
  $('#tradeBtn').onclick = () => openTrade();
  $('#endBtn').onclick = () => confirmEnd();
  $('#accuseBtn').onclick = () => { fx.sfx.click(); if (latest) openAccuse(latest); };
  $('#rulesBtn').onclick = openRules;
  const mute = $('#muteBtn');
  const setIcon = () => updateSoundIcons();
  setIcon();
  mute.onclick = () => { fx.sfx.click(); openSettings(); };
}

function renderPlayers(s) {
  const list = $('#players');
  const order = s.players.map((p) => p.id).join(',');
  s.players.forEach((p) => {
    let r = rows[p.id];
    if (!r) {
      r = el('div', 'prow');
      const info = el('div', 'pinfo');
      const name = el('div', 'pname');
      name.append(el('span', 'nm'), el('span', 'badges'));
      info.append(name, el('div', 'chips'));
      r.append(el('div', 'avatar'), info, el('div', 'pcash'));
      r.addEventListener('click', (ev) => {
        if (ev.target.closest('.chip')) return;
        const t = tokens[p.id];
        if (t) {
          panTo(gsap.getProperty(t, 'x'), gsap.getProperty(t, 'y'), 0.5);
          gsap.fromTo(t, { scale: 1.8 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.3)' });
        }
      });
      rows[p.id] = r;
      cashShown[p.id] = p.cash;
      $('.pcash', r).textContent = money(p.cash);
      list.append(r);
    }
    const av = $('.avatar', r);
    av.textContent = p.emoji;
    av.style.setProperty('--c', p.color);
    $('.nm', r).textContent = p.name;
    const badges = [];
    if (p.id === H.hostPid()) badges.push('👑');
    if (p.bot) badges.push('🤖');
    if (p.inJail) badges.push('🔒');
    if (p.jailCards) badges.push('🗝️');
    if (!p.connected && !p.bot) badges.push('📴');
    $('.badges', r).textContent = badges.join(' ');
    r.classList.toggle('turn', s.phase === 'playing' && s.players[s.turn].id === p.id);
    r.classList.toggle('me', p.id === H.me());
    r.classList.toggle('out', p.bankrupt);
    if (cashShown[p.id] !== p.cash) animateCash(p.id, p.cash);
    const owned = [];
    s.props.forEach((pr, i) => { if (pr && pr.o === p.id) owned.push(i); });
    const sig = owned.map((i) => `${i}:${s.props[i].h}:${s.props[i].m ? 1 : 0}`).join(',');
    const chips = $('.chips', r);
    if (chips.dataset.sig !== sig) {
      chips.dataset.sig = sig;
      chips.innerHTML = '';
      owned.forEach((i) => chips.append(chipEl(i, s.props[i])));
    }
  });
  if (list.dataset.order !== order) {
    list.dataset.order = order;
    s.players.forEach((p) => list.append(rows[p.id]));
  }
  $('#aliveCount').textContent = `${s.players.filter((p) => !p.bankrupt).length} / ${s.players.length}`;
}

function chipEl(i, pr) {
  const sp = SPACES[i];
  const c = el('span', 'chip' + (pr && pr.m ? ' m' : ''));
  if (sp.type === 'city') c.style.background = GROUPS[sp.group].color;
  else c.textContent = sp.icon;
  if (pr && pr.h) c.dataset.h = pr.h === 5 ? 'H' : String(pr.h);
  c.title = sp.name;
  c.addEventListener('click', () => openSpace(i));
  return c;
}

function renderMe(s) {
  const p = me();
  const bar = $('#meBar');
  if (!p) {
    $('.me-avatar', bar).textContent = '👀';
    $('.me-name', bar).textContent = 'Spectating';
    $('.me-cash', bar).textContent = '';
    $('.me-worth', bar).textContent = '';
    $('#tradeBtn').disabled = true;
    return;
  }
  const av = $('.me-avatar', bar);
  av.textContent = p.emoji;
  av.style.setProperty('--c', p.color);
  $('.me-name', bar).textContent = p.name + (p.bankrupt ? ' · bankrupt' : '');
  if (!$('.me-cash', bar).dataset.init) {
    $('.me-cash', bar).dataset.init = '1';
    $('.me-cash', bar).textContent = money(p.cash);
  }
  $('.me-worth', bar).textContent = `Net worth ${money(netWorth(s, p))}`;
  $('#tradeBtn').disabled = p.bankrupt || s.phase !== 'playing';
  const canEnd = H.isHost() && s.phase === 'playing';
  $('#endBtn').hidden = !canEnd;
  $('#endTab').hidden = !canEnd;
}

function renderFeed(s) {
  const feed = $('#feed');
  const fresh = s.log.filter((l) => l.id > lastLogId);
  if (!fresh.length) return;
  lastLogId = fresh[fresh.length - 1].id;
  const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
  fresh.slice(-20).forEach((l) => {
    const line = el('div', 'fl');
    const p = l.pid ? P(s, l.pid) : null;
    if (p) {
      const dot = el('span', 'dot');
      dot.style.background = p.color;
      line.append(dot);
    }
    line.append(document.createTextNode(l.t));
    feed.append(line);
    gsap.from(line, { x: 30, opacity: 0, duration: 0.35, ease: 'power2.out' });
  });
  while (feed.childElementCount > 150) feed.firstChild.remove();
  if (atBottom) feed.scrollTop = feed.scrollHeight;
}

export function addChat(pid, text) {
  const p = pl(pid);
  const feed = $('#feed');
  const line = el('div', 'fl chat');
  const who = el('b', '', `${p ? p.emoji + ' ' + p.name : 'Spectator'}: `);
  if (p) who.style.color = p.color;
  line.append(who, document.createTextNode(text));
  feed.append(line);
  gsap.from(line, { scale: 0.8, opacity: 0, duration: 0.3, ease: 'back.out(2)' });
  feed.scrollTop = feed.scrollHeight;
  fx.sfx.chat();
  if (isPhone() && !(sheetTab === 'chat') && pid !== H.me()) {
    unread++;
    updateBadge();
    toast(`${p ? p.emoji + ' ' + p.name : 'Spectator'}: ${text.length > 60 ? text.slice(0, 60) + '…' : text}`);
  }
  const t = tokens[pid];
  if (t && inGame) {
    const c = fx.center(t);
    const bub = el('div', 'bubble', text.length > 40 ? text.slice(0, 40) + '…' : text);
    $('#fxLayer').append(bub);
    gsap.set(bub, { x: c.x, y: c.y - 26, xPercent: -50, yPercent: -100 });
    gsap.timeline({ onComplete: () => bub.remove() })
      .from(bub, { scale: 0, duration: 0.3, ease: 'back.out(2)' })
      .to(bub, { opacity: 0, y: c.y - 50, duration: 0.4 }, 3);
  }
}

export function showEmote(pid, e) {
  const t = tokens[pid];
  const r = rows[pid];
  [t, r ? $('.avatar', r) : null].forEach((src, k) => {
    const c = fx.center(src);
    if (!c || (k === 0 && !inGame)) return;
    for (let n = 0; n < 3; n++) {
      const d = el('div', 'emote-float', e);
      $('#fxLayer').append(d);
      gsap.set(d, { x: c.x + (Math.random() - 0.5) * 30, y: c.y, xPercent: -50, yPercent: -50 });
      gsap.timeline({ delay: n * 0.12, onComplete: () => d.remove() })
        .from(d, { scale: 0, duration: 0.3, ease: 'back.out(3)' })
        .to(d, { y: c.y - 110 - Math.random() * 40, x: `+=${(Math.random() - 0.5) * 60}`, rotation: (Math.random() - 0.5) * 60, duration: 1.6, ease: 'power1.out' }, 0)
        .to(d, { opacity: 0, duration: 0.4 }, 1.2);
    }
  });
  fx.sfx.pop();
}

/* ---------- center ---------- */

const VERB = { roll: 'rolling', buy: 'deciding', auction: 'watching the auction', end: 'wrapping up', moving: 'moving', bus: 'choosing a bus ride', teleport: 'picking a warp spot' };

function renderCenter(s) {
  const c = s.players[s.turn];
  const tb = $('#turnBanner');
  if (c) {
    const av = $('.tb-avatar', tb);
    if (av.textContent !== c.emoji || tb.dataset.pid !== c.id) {
      tb.dataset.pid = c.id;
      gsap.fromTo(tb, { y: -10, opacity: 0.3 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
    }
    av.textContent = c.emoji;
    av.style.setProperty('--c', c.color);
    $('.tb-name', tb).textContent = c.id === H.me() ? 'Your turn' : `${c.name}'s turn`;
    $('.tb-round', tb).textContent = s.phase === 'over' ? 'Game over' : `Round ${s.round} · ${VERB[s.stage] || ''}`;
  }
  if (s.settings.mode === 'property') {
    const left = unownedCount(s);
    if (lastUnowned != null && left < lastUnowned && s.phase === 'playing') {
      const mark = [10, 5, 3, 1].find((m) => left <= m && lastUnowned > m);
      if (mark) fx.banner(`🏙️ ${left} PROPERT${left === 1 ? 'Y' : 'IES'} LEFT!`, 'Highest property value wins when the board sells out', '#4cc9f0', 0.8);
    }
    lastUnowned = left;
  }
  const mb = $('#marketBar');
  const fx2 = (s.market || []).filter((e) => MARKET_SHORT[e.kind]);
  mb.hidden = !packOn(s, 'market') || !fx2.length;
  const mtxt = fx2.map((e) => `${MARKET_SHORT[e.kind](e)} (${e.until - s.round + 1})`).join(' · ');
  if (mb.textContent !== mtxt) mb.textContent = mtxt;
  $('#die3').parentElement.hidden = !packOn(s, 'turbo');
  const ab = $('#accuseBtn');
  const p = me();
  const canAccuse = packOn(s, 'cheats') && s.phase === 'playing' && p && !p.bankrupt && !(s.accused || {})[`${s.turnId}:${p.id}`]
    && (s.players[s.turn].id !== p.id || (s.prevPid && s.prevPid !== p.id));
  ab.hidden = !canAccuse;
  renderBuy(s);
  renderAuction(s);
}

function renderActions(s) {
  const box = $('#actions');
  if (!s || s.phase === 'lobby') return;
  const c = s.players[s.turn];
  const p = me();
  const mine = s.phase === 'playing' && c && p && c.id === p.id;
  const key = [s.phase, s.turnId, s.stage, mine, busy, p && p.inJail, p && p.jailCards, p && p.cash >= JAIL_FINE, (s.choices || []).join(','), cheatTurn === s.turnId].join('|');
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.innerHTML = '';
  box.classList.remove('stack');
  if (s.phase !== 'playing') return;
  if (!mine) {
    if (s.stage !== 'buy' && s.stage !== 'auction') box.append(el('div', 'waiting', `${c.emoji} ${c.name} is ${VERB[s.stage] || 'thinking'}…`));
    return;
  }
  if (busy) return;
  if (s.stage === 'roll') {
    box.append(btn('🎲 Roll dice', 'primary big pulse', () => H.send({ t: 'roll' })));
    if (p.inJail) {
      box.append(btn(`Pay ${money(JAIL_FINE)} bail`, '', () => H.send({ t: 'payJail' }), p.cash < JAIL_FINE));
      if (p.jailCards) box.append(btn('🗝️ Use free card', '', () => H.send({ t: 'useCard' })));
    }
  } else if (s.stage === 'end') {
    box.append(btn('End turn ➜', 'primary big', () => H.send({ t: 'end' })));
  } else if (s.stage === 'bus') {
    const best = Math.max(...s.choices);
    s.choices.forEach((n) => {
      const b = btn(`🚌 Move ${n}`, n === best ? 'primary big' : 'big', () => H.send({ t: 'busPick', n }));
      const dest = cells[(p.pos + n) % SPACES.length];
      b.addEventListener('mouseenter', () => dest.classList.add('preview'));
      b.addEventListener('mouseleave', () => dest.classList.remove('preview'));
      b.addEventListener('click', () => dest.classList.remove('preview'));
      box.append(b);
    });
  } else if (s.stage === 'teleport') {
    box.append(el('div', 'waiting warp-hint', '⚡ Tap any space to warp there'));
    box.append(btn('✨ Best pick', '', () => H.send({ t: 'teleport', sp: bestTeleport(s, p) })));
  }
  if (packOn(s, 'cheats') && ['roll', 'end', 'buy'].includes(s.stage) && cheatTurn !== s.turnId) {
    const cb = el('button', 'btn cheat-btn', '🃏');
    cb.type = 'button';
    cb.title = 'Cheat';
    cb.onclick = () => { fx.sfx.click(); openCheat(latest); };
    box.append(cb);
  }
  box.classList.toggle('stack', !!box.querySelector('.btn.big') && box.querySelectorAll('.btn:not(.big)').length > 0);
  [...box.children].forEach((c, k) => gsap.from(c, { y: 24, opacity: 0, scale: 0.8, delay: k * 0.07, duration: 0.4, ease: 'back.out(2)', clearProps: 'transform,opacity,translate,rotate,scale' }));
}

function deedEl(s, i, compact = false) {
  const sp = SPACES[i];
  const pr = s.props[i];
  const d = el('div', 'deed' + (compact ? ' compact' : ''));
  const head = el('div', 'deed-head');
  head.style.background = sp.type === 'city' ? GROUPS[sp.group].color : 'linear-gradient(135deg,#33415c,#5c677d)';
  head.append(
    el('div', 'deed-kicker', sp.type === 'city' ? GROUPS[sp.group].name : sp.type === 'airport' ? 'Airport' : 'Utility'),
    el('div', 'deed-name', (sp.type === 'city' ? '' : sp.icon + ' ') + sp.name),
  );
  d.append(head);
  const body = el('div', 'deed-body');
  const row = (a, b, hl = false) => {
    const r = el('div', 'drow' + (hl ? ' hl' : ''));
    r.append(el('span', '', a), el('span', '', b));
    body.append(r);
  };
  row('Price', money(sp.price));
  if (!compact) {
    if (sp.type === 'city') {
      const full = pr && pr.o && pr.h === 0 && GROUPS[sp.group] && SPACES.filter((x) => x.group === sp.group && x.type === 'city').every((x) => s.props[x.i].o === pr.o);
      row('Rent', money(sp.rent[0]), pr && pr.o && pr.h === 0 && !full);
      row('Full set', money(sp.rent[0] * 2), full);
      ['1 house', '2 houses', '3 houses', '4 houses', 'Hotel'].forEach((lbl, k) => row(lbl, money(sp.rent[k + 1]), pr && pr.h === k + 1));
      if (packOn(s, 'sky')) row('🏙️ Skyscraper', money(sp.rent[6]), pr && pr.h === 6);
      row('House cost', money(sp.houseCost));
      if (packOn(s, 'sky')) row('Skyscraper cost', money(buildCost(i, 6)));
    } else if (sp.type === 'airport') {
      [1, 2, 3, 4].forEach((n) => row(`${n} airport${n > 1 ? 's' : ''}`, money(25 * 2 ** (n - 1))));
      if (packOn(s, 'sky')) row(`🛫 Terminal (${money(TERMINAL_COST)})`, 'rent ×2', pr && pr.t);
    } else {
      row('1 utility', '4× dice');
      row('2 utilities', '10× dice');
    }
    row('Mortgage', money(sp.price / 2));
  }
  d.append(body);
  return d;
}

function renderBuy(s) {
  const box = $('#buyBox');
  if (s.phase !== 'playing' || s.stage !== 'buy' || s.pending == null) {
    if (box.dataset.key) {
      box.dataset.key = '';
      const kids = [...box.children];
      gsap.to(kids, { scale: 0.7, opacity: 0, duration: 0.2, onComplete: () => kids.forEach((k) => k.remove()) });
    }
    return;
  }
  const key = `${s.turnId}:${s.pending}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.innerHTML = '';
  const c = s.players[s.turn];
  const sp = SPACES[s.pending];
  const d = deedEl(s, s.pending);
  const acts = el('div', 'deed-actions');
  if (c.id === H.me()) {
    acts.append(
      btn(`Buy ${money(sp.price)}`, 'primary', () => H.send({ t: 'buy' }), c.cash < sp.price, c.cash < sp.price ? 'Not enough cash' : ''),
      btn('Auction 🔨', '', () => H.send({ t: 'decline' })),
    );
  } else acts.append(el('div', 'waiting', `${c.emoji} ${c.name} is deciding…`));
  d.append(acts);
  box.append(d);
  fx.sfx.card();
  gsap.fromTo(d, { rotationY: -100, scale: 0.5, opacity: 0 }, { rotationY: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.5)' });
}

let aucUI = null;
function renderAuction(s) {
  const box = $('#auctionBox');
  if (s.phase !== 'playing' || s.stage !== 'auction' || !s.auction) {
    if (aucUI) { aucUI = null; box.innerHTML = ''; }
    return;
  }
  const a = s.auction;
  const key = `${s.turnId}:${a.sp}`;
  if (!aucUI || aucUI.key !== key) {
    box.innerHTML = '';
    const wrap = el('div', 'auction');
    const title = el('div', 'auc-title', '🔨 AUCTION');
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 44 44');
    ring.classList.add('ring', 'auc-ring');
    ring.innerHTML = '<circle class="ring-bg" cx="22" cy="22" r="19"/><circle class="ring-fg" cx="22" cy="22" r="19"/>';
    const head = el('div', 'auc-head');
    head.append(title, ring);
    const bid = el('div', 'auc-bid', '$0');
    const who = el('div', 'auc-who', 'No bids yet');
    const btns = el('div', 'auc-btns');
    const custom = el('div', 'auc-custom');
    const inp = el('input');
    inp.type = 'number';
    inp.min = '1';
    inp.placeholder = 'Amount';
    const cb = el('button', 'btn small', 'Bid');
    cb.type = 'button';
    cb.onclick = () => { const v = Math.floor(Number(inp.value)); if (v > 0) { H.send({ t: 'bid', amt: v }); inp.value = ''; } };
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') cb.click(); });
    custom.append(inp, cb);
    wrap.append(head, deedEl(s, a.sp, true), bid, who, btns, custom);
    box.append(wrap);
    aucUI = { key, wrap, bid, who, btns, custom, lastBid: -1, ring };
    gsap.fromTo(wrap, { scale: 0.3, rotation: -6, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)' });
  }
  const u = aucUI;
  if (u.lastBid !== a.bid) {
    const from = Math.max(0, u.lastBid);
    u.lastBid = a.bid;
    const o = { v: from };
    gsap.to(o, { v: a.bid, duration: 0.4, onUpdate() { u.bid.textContent = money(o.v); } });
    gsap.fromTo(u.bid, { scale: 1.5, color: '#ffd166' }, { scale: 1, color: '#ffffff', duration: 0.5, ease: 'back.out(3)' });
  }
  const bidder = a.bidder ? P(s, a.bidder) : null;
  u.who.textContent = bidder ? `${bidder.emoji} ${bidder.name} leads` : 'No bids yet';
  u.who.style.color = bidder ? bidder.color : '';
  const p = me();
  const canBid = p && !p.bankrupt && a.bidder !== p.id;
  const sig = [a.bid, canBid, p && p.cash].join('|');
  if (u.btns.dataset.sig !== sig) {
    u.btns.dataset.sig = sig;
    u.btns.innerHTML = '';
    if (p && !p.bankrupt) {
      [10, 50, 100].forEach((inc) => {
        const amt = a.bid + inc;
        const b = el('button', 'btn small bidb', `+${inc} → ${money(amt)}`);
        b.type = 'button';
        b.disabled = !canBid || amt > p.cash;
        b.onclick = () => { fx.sfx.click(); H.send({ t: 'bid', amt }); };
        u.btns.append(b);
      });
    } else u.btns.append(el('div', 'waiting', 'Watching'));
    u.custom.hidden = !canBid;
  }
}

/* ---------- frame loop (timers) ---------- */

let lastTickSec = -1;
let lastUnowned = null;
const TOTAL_PROPS = SPACES.filter((_, i) => ownable(i)).length;

function modeBarText(s, now) {
  const st = s.settings;
  const short = isPhone();
  if (st.mode === 'time') {
    const left = Math.max(0, Math.ceil((s.endsAt - now) / 1000));
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    return { text: short ? `⏱️ ${clock} left` : `⏱️ ${clock} left · most cash & top property value win`, frac: left / (st.minutes * 60), low: left <= 60 };
  }
  if (st.mode === 'property') {
    const owned = TOTAL_PROPS - unownedCount(s);
    return { text: short ? `🏙️ ${owned}/${TOTAL_PROPS} owned` : `🏙️ ${owned} / ${TOTAL_PROPS} owned · top property value wins`, frac: owned / TOTAL_PROPS, low: owned >= TOTAL_PROPS - 3 };
  }
  if (st.mode === 'rounds') {
    const r = Math.min(s.round, st.rounds);
    return { text: short ? `🔁 Round ${r}/${st.rounds}` : `🔁 Round ${r} of ${st.rounds} · most cash & top property value win`, frac: (s.round - 1) / st.rounds, low: s.round >= st.rounds };
  }
  return { text: short ? '👑 Classic' : '👑 Classic · last landlord standing wins', frac: null, low: false };
}

function moodFor(s) {
  if (!s || s.phase === 'lobby') return 'lobby';
  if (s.phase === 'over') return 'victory';
  const now = Date.now() + H.offset();
  const mine = s.players[s.turn] && s.players[s.turn].id === H.me();
  if (s.stage === 'auction' || (s.endsAt && s.endsAt - now < 60000) || (mine && s.turnEnds - now < 10000)) return 'tension';
  return 'play';
}

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionFull = (() => { const v = load('motion'); return v ? v === 'full' : !reduceMQ.matches; })();
const tiltDeg = () => (motionFull ? (isPhone() ? 14 : 24) : 0);

function standToken(t) {
  const d = tiltDeg();
  gsap.set(t, { rotationX: -d, transformOrigin: '50% 100%' });
  t.classList.toggle('standing', d > 0);
}

function applyMotion() {
  document.body.classList.toggle('calm', !motionFull);
  document.body.classList.toggle('lite', !motionFull || (matchMedia('(pointer: coarse)').matches && load('motion') !== 'full'));
  document.documentElement.style.setProperty('--tilt', tiltDeg() + 'deg');
  Object.values(tokens).forEach(standToken);
}

function setMotion(full, remember = true) {
  motionFull = full;
  if (remember) save('motion', full ? 'full' : 'reduced');
  applyMotion();
  if (inGame) {
    fitCam(true);
    layoutTokens(0);
  }
}

function ambientTick() {
  if (!inGame || !motionFull || document.body.classList.contains('lite') || document.hidden || !latest || latest.phase !== 'playing') return;
  if (Math.random() < 0.65) flyPlane();
}

function flyPlane() {
  const ports = SPACES.filter((sp) => sp.type === 'airport').map((sp) => sp.i);
  const a = ports[Math.floor(Math.random() * ports.length)];
  const rest = ports.filter((x) => x !== a);
  const b = rest[Math.floor(Math.random() * rest.length)];
  const [x1, y1] = cellCenter(a);
  const [x2, y2] = cellCenter(b);
  const mx = 500 + (Math.random() - 0.5) * 260;
  const my = 500 + (Math.random() - 0.5) * 260;
  const ang = (ax, ay, bx2, by2) => (Math.atan2(by2 - ay, bx2 - ax) * 180) / Math.PI + 45;
  const plane = el('div', 'plane', '✈️');
  $('#ambient').append(plane);
  gsap.set(plane, { x: x1, y: y1, scale: 0.4, opacity: 0, rotation: ang(x1, y1, mx, my), force3D: false });
  gsap.timeline({ defaults: { force3D: false }, onComplete: () => plane.remove() })
    .to(plane, { opacity: 1, duration: 0.5 })
    .to(plane, { keyframes: { x: [mx, x2], y: [my, y2], scale: [1.5, 0.4] }, duration: 6, ease: 'sine.inOut' }, 0)
    .to(plane, { rotation: ang(mx, my, x2, y2), duration: 6, ease: 'sine.inOut' }, 0)
    .to(plane, { opacity: 0, duration: 0.6 }, 5.4);
}

function openSettings() {
  const c = el('div', 'settings-panel');
  c.append(el('h2', '', '⚙️ Sound & motion'));
  const slider = (label, get, set, test) => {
    const row = el('label', 'set-row');
    const r = el('input');
    r.type = 'range';
    r.min = '0';
    r.max = '100';
    r.value = String(Math.round(get() * 100));
    const v = el('span', 'set-val', r.value + '%');
    r.oninput = () => { set(Number(r.value) / 100); v.textContent = r.value + '%'; updateSoundIcons(); };
    if (test) r.onchange = test;
    row.append(el('span', 'set-label', label), r, v);
    return row;
  };
  c.append(
    slider('🎵 Music', getMusicVolume, (x) => { fx.unlockAudio(); setMusicVolume(x); }),
    slider('🔊 Sound effects', fx.getSfxVolume, fx.setSfxVolume, () => fx.sfx.coin()),
  );
  const mrow = el('div', 'set-row');
  const seg = el('div', 'seg');
  const mk = (label, full) => {
    const b = el('button', 'seg-btn' + (motionFull === full ? ' on' : ''), label);
    b.type = 'button';
    b.onclick = () => {
      setMotion(full);
      seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('on', x === b));
      fx.sfx.click();
    };
    return b;
  };
  seg.append(mk('Full', true), mk('Reduced', false));
  mrow.append(el('span', 'set-label', '✨ Motion'), seg);
  c.append(mrow, el('p', 'muted', 'Reduced turns off the tabletop tilt, thrown dice, flying planes, drifting clouds and twinkling lights. It saves battery on phones.'));
  modal(c);
}

function updateSoundIcons() {
  const silent = fx.getSfxVolume() === 0 && getMusicVolume() === 0;
  const icon = silent ? '🔇' : '🔊';
  $('#muteBtn').textContent = icon;
  const tab = $('#muteTab span');
  if (tab) tab.textContent = icon;
}

function frame() {
  const s = latest;
  setMood(moodFor(s));
  if (!s || s.phase !== 'playing') return;
  const now = Date.now() + H.offset();
  const mb = modeBarText(s, now);
  const bar = $('#modeBar');
  if (bar.dataset.text !== mb.text) {
    bar.dataset.text = mb.text;
    $('.mb-text', bar).textContent = mb.text;
    $('.mb-fill', bar).style.width = mb.frac == null ? '0' : `${Math.round(Math.max(0, Math.min(1, mb.frac)) * 100)}%`;
    bar.classList.toggle('low', mb.low);
    bar.classList.toggle('nofill', mb.frac == null);
  }
  const ring = $('#turnBanner .ring-fg');
  const total = s.settings.turnSeconds * 1000;
  const rem = s.stage === 'auction' ? total : Math.max(0, s.turnEnds - now);
  const frac = Math.max(0, Math.min(1, rem / total));
  ring.style.strokeDashoffset = String(119.4 * (1 - frac));
  ring.classList.toggle('low', rem < 10000 && s.stage !== 'auction');
  const mine = s.players[s.turn].id === H.me();
  const sec = Math.ceil(rem / 1000);
  if (mine && rem < 6000 && rem > 0 && sec !== lastTickSec && !busy && s.stage !== 'auction') {
    lastTickSec = sec;
    fx.sfx.tick();
  }
  if (aucUI && s.auction) {
    const ar = Math.max(0, s.auction.ends - now);
    const fg = aucUI.ring.querySelector('.ring-fg');
    fg.style.strokeDashoffset = String(119.4 * (1 - Math.min(1, ar / 10000)));
    fg.classList.toggle('low', ar < 3000);
  }
}

/* ---------- modals ---------- */

function modal(content, { cls = '', onClose } = {}) {
  const root = $('#modalRoot');
  const wrap = el('div', 'modal-wrap');
  const box = el('div', 'modal ' + cls);
  const x = el('button', 'modal-x', '✕');
  x.type = 'button';
  box.append(x, content);
  wrap.append(box);
  root.append(wrap);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    gsap.to(box, { y: 30, scale: 0.92, opacity: 0, duration: 0.2 });
    gsap.to(wrap, { opacity: 0, duration: 0.22, onComplete: () => { wrap.remove(); if (onClose) onClose(); } });
  };
  x.onclick = close;
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
  gsap.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.2 });
  gsap.fromTo(box, { y: 40, scale: 0.9, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.7)' });
  return { close, box };
}

const SPACE_INFO = {
  start: `Collect ${money(PASS_START)} every time you pass or land here.`,
  jail: `Just visiting, unless you were sent here. Get out with doubles, a free card, or ${money(JAIL_FINE)} bail.`,
  parking: 'Taxes, fines and bail pile up here. Land on it to win the whole jackpot!',
  gotojail: 'Go straight to Jail. Do not pass START.',
  fortune: 'Draw a Fortune card. Anything can happen.',
  treasury: 'Draw a Treasury card. Usually about money.',
  tax: 'Pay the amount shown into the jackpot.',
};

function openSpace(i) {
  if (!latest) return;
  fx.sfx.click();
  const body = el('div', 'space-modal');
  const m = modal(body, { onClose: () => { if (spaceModal && spaceModal.body === body) spaceModal = null; } });
  spaceModal = { i, body, m };
  fillSpace(body, i, latest);
  const c = fx.center(cells[i]);
  fx.burst(c.x, c.y, { colors: ['#fff'], n: 12, speed: 3 });
}

function fillSpace(body, i, s) {
  body.innerHTML = '';
  const sp = SPACES[i];
  if (!ownable(i)) {
    const card = el('div', 'info-card');
    card.append(el('div', 'info-icon', sp.icon), el('div', 'info-name', sp.name), el('div', 'info-text', SPACE_INFO[sp.type] || ''));
    if (sp.type === 'tax') card.append(el('div', 'info-amt', money(sp.amount)));
    if (sp.type === 'parking') card.append(el('div', 'info-amt', `Jackpot: ${money(s.pot)}`));
    body.append(card);
    return;
  }
  const pr = s.props[i];
  body.append(deedEl(s, i));
  const info = el('div', 'space-owner');
  const owner = pr.o ? P(s, pr.o) : null;
  if (owner) {
    const av = el('span', 'avatar sm', owner.emoji);
    av.style.setProperty('--c', owner.color);
    info.append(av, document.createTextNode(` Owned by ${owner.name}${pr.m ? ' · mortgaged' : ''}`));
    if (!pr.m) info.append(el('div', 'rent-now', `Current rent: ${sp.type === 'utility' ? (calcRent(s, i, 1) >= 10 ? '10×' : '4×') + ' dice' : money(calcRent(s, i))}`));
    const notes = [];
    if (pr.z === 'park') notes.push('🌳 Park: rent +50%');
    if (pr.z === 'factory') notes.push('🏭 Factory: rent −50%, no building');
    if (pr.t) notes.push('🛫 Terminal: rent ×2');
    const mm = marketMult(s, i);
    if (Math.abs(mm - 1) > 0.001) notes.push(`📰 Market: rent ×${+mm.toFixed(2)}`);
    if (notes.length) info.append(el('div', 'hint', notes.join(' · ')));
  } else info.append(document.createTextNode('For sale — land on it to buy'));
  body.append(info);
  const myId = H.me();
  if (owner && owner.id === myId && s.phase === 'playing' && !owner.bankrupt) {
    const acts = el('div', 'manage');
    const mk = (label, t, err) => {
      const b = el('button', 'btn small' + (t === 'build' ? ' primary' : ''), label);
      b.type = 'button';
      b.disabled = !!err;
      if (err) b.title = err;
      b.onclick = () => { fx.sfx.click(); H.send({ t, sp: i }); };
      acts.append(b);
    };
    if (sp.type === 'city') {
      const next = pr.h + 1;
      mk(`${next === 6 ? '🏙️ Skyscraper' : next === 5 ? '🏨 Hotel' : '🏠 House'} (${money(buildCost(i, Math.min(next, 6)))})`, 'build', buildError(s, myId, i));
      mk(`Sell ${buildingName(Math.max(pr.h, 1))} (+${money(buildCost(i, Math.max(pr.h, 1)) / 2)})`, 'sell', sellError(s, myId, i));
    }
    if (sp.type === 'airport' && packOn(s, 'sky')) {
      const tb = el('button', 'btn small', pr.t ? `Sell terminal (+${money(TERMINAL_COST / 2)})` : `🛫 Terminal (${money(TERMINAL_COST)})`);
      tb.type = 'button';
      const terr = terminalError(s, myId, i, !pr.t);
      tb.disabled = !!terr;
      if (terr) tb.title = terr;
      tb.onclick = () => { fx.sfx.click(); H.send({ t: 'terminal', sp: i, on: !pr.t }); };
      acts.append(tb);
    }
    if (pr.m) mk(`Unmortgage (${money(unmortgageCost(i))})`, 'unmortgage', unmortgageError(s, myId, i));
    else mk(`Mortgage (+${money(sp.price / 2)})`, 'mortgage', mortgageError(s, myId, i));
    body.append(acts);
    const err = sp.type === 'city' ? buildError(s, myId, i) : null;
    if (err && err !== 'Not enough cash' && err !== 'Already has a hotel' && err !== 'Already has a skyscraper') body.append(el('div', 'hint', err));
  }
  const meP = myId ? P(s, myId) : null;
  if (sp.type === 'city' && packOn(s, 'zoning') && s.phase === 'playing' && meP && !meP.bankrupt) {
    const z = el('div', 'manage');
    const mz = (label, kind) => {
      const err = zoneError(s, myId, i, kind);
      const b = el('button', 'btn small', label);
      b.type = 'button';
      b.disabled = !!err;
      if (err) b.title = err;
      b.onclick = () => { fx.sfx.click(); H.send({ t: 'zone', sp: i, kind }); };
      z.append(b);
    };
    if (pr.o === myId && !pr.z) mz(`🌳 Park (${money(PARK_COST)})`, 'park');
    if (pr.o === myId && pr.z === 'factory') mz(`🧹 Remove factory (${money(UNZONE_COST)})`, 'clear');
    if (pr.o && pr.o !== myId && !pr.z) mz(`🏭 Factory (${money(FACTORY_COST)})`, 'factory');
    if (z.childElementCount) {
      body.append(z);
      const zerr = zoneError(s, myId, i, pr.o === myId ? (pr.z === 'factory' ? 'clear' : 'park') : 'factory');
      if (zerr && zerr !== 'Not enough cash') body.append(el('div', 'hint', zerr));
    }
  }
}

function openRules() {
  const c = el('div', 'rules');
  c.innerHTML = `
    <h2>How to play</h2>
    <ul>
      <li>🎲 Roll and move around the 64-space world board. Pass <b>START</b> to collect ${money(PASS_START)}.</li>
      <li>🏙️ Land on an unowned city, airport or utility to <b>buy</b> it, or send it to an <b>auction</b> where everyone can bid.</li>
      <li>🎨 Own every city of a colour set to <b>double rent</b> and unlock <b>houses</b> and <b>hotels</b>. Click a city to build.</li>
      <li>🎰 Taxes, fines and bail go into the <b>Jackpot</b>. Land on it to take everything.</li>
      <li>❓ Fortune and 💰 Treasury cards can send you flying or change your fortunes.</li>
      <li>🔒 In jail: roll doubles, use a free card, or pay ${money(JAIL_FINE)} bail. Three failed tries and you pay the fine.</li>
      <li>🤝 Trade properties and cash with anyone at any time.</li>
      <li>💸 Can't pay? Your houses are sold and properties mortgaged automatically. If that's still not enough, you're bankrupt.</li>
      <li>🎮 <b>Game modes.</b> 👑 Classic: last landlord standing wins. ⏱️ Time Attack: when the clock runs out there are two winners, most cash and highest property value. 🏙️ Property Fight: once every property is owned, the highest property value wins. 🔁 Rounds: after the set number of rounds there are two winners, most cash and highest property value. In every mode, the last landlord standing wins outright.</li>
      <li>📈 Property value counts each city, airport and utility at its price (half if mortgaged), plus the cost of its houses and hotel.</li>
      ${(() => { const on = latest ? activePacks(latest.settings) : []; return on.length ? '<li>🧩 <b>Expansion packs in this game:</b><ul class="pack-rules">' + on.map((p) => `<li>${p.icon} <b>${p.name}</b> — ${p.desc}${p.id === 'house' ? ' On: ' + (HOUSE_RULES.filter((h) => latest.settings.house && latest.settings.house[h.id]).map((h) => h.name).join(', ') || 'none') : ''}</li>`).join('') + '</ul></li>' : '<li>🧩 No expansion packs in this game.</li>'; })()}
    </ul>
    <p class="muted">Privacy: this site records your IP address and play name, for usage statistics and so the creator can ask players for feedback.</p>
    <p class="muted">Tips: drag to pan, scroll or pinch to zoom, Space to roll / end turn, and click any space for details.</p>`;
  modal(c, { cls: 'wide' });
}

const END_RULE = {
  classic: 'the richest landlord (cash + property value) wins',
  time: 'most cash and highest property value both win',
  property: 'the highest property value wins',
  rounds: 'most cash and highest property value both win',
};

function confirmEnd() {
  if (!H.isHost() || !latest || latest.phase !== 'playing') return;
  fx.sfx.click();
  const c = el('div', 'confirm');
  c.append(
    el('div', 'cf-icon', '🏁'),
    el('h2', '', 'End the game now?'),
    el('p', '', `The game stops for everyone and is scored right now: ${END_RULE[latest.settings.mode] || END_RULE.classic}.`),
  );
  const acts = el('div', 'deed-actions');
  c.append(acts);
  const m = modal(c);
  acts.append(
    btn('Keep playing', '', () => m.close()),
    btn('🏁 End game', 'danger', () => { m.close(); H.endGame(); }),
  );
}

/* ---------- trading ---------- */

function tradable(s, pid) {
  const out = [];
  s.props.forEach((pr, i) => {
    if (!pr || pr.o !== pid) return;
    const sp = SPACES[i];
    if (sp.type === 'city' && SPACES.some((x) => x.group === sp.group && x.type === 'city' && s.props[x.i].h > 0)) return;
    out.push(i);
  });
  return out;
}

function openTrade(toPid = null, prefill = null) {
  const s = latest;
  const myId = H.me();
  const mine = me();
  if (!s || !mine || mine.bankrupt || s.phase !== 'playing') return;
  const others = s.players.filter((p) => !p.bankrupt && p.id !== myId);
  if (!others.length) return;
  let target = toPid && others.some((p) => p.id === toPid) ? toPid : others[0].id;
  const give = new Set(prefill ? prefill.give.props : []);
  const get = new Set(prefill ? prefill.get.props : []);
  const root = el('div', 'trade');
  root.append(el('h2', '', '🤝 Make a deal'));
  const pick = el('div', 'trade-pick');
  others.forEach((p) => {
    const b = el('button', 'tp' + (p.id === target ? ' sel' : ''), p.emoji);
    b.type = 'button';
    b.title = p.name;
    b.style.setProperty('--c', p.color);
    b.onclick = () => {
      target = p.id;
      get.clear();
      pick.querySelectorAll('.tp').forEach((x) => x.classList.toggle('sel', x === b));
      gsap.fromTo(b, { scale: 1.4 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      draw();
    };
    pick.append(b);
  });
  const cols = el('div', 'trade-cols');
  const mkCol = (title) => {
    const c = el('div', 'trade-col');
    const h = el('div', 'tc-title', title);
    const offer = el('div', 'tc-offer');
    const pool = el('div', 'tc-pool');
    const cashRow = el('div', 'tc-cash');
    const rng = el('input');
    rng.type = 'range';
    rng.min = '0';
    rng.step = '10';
    rng.max = '100000';
    rng.value = '0';
    const val = el('span', 'tc-cashval', '$0');
    rng.oninput = () => { val.textContent = money(Number(rng.value)); };
    cashRow.append(el('span', '', '💵'), rng, val);
    c.append(h, el('div', 'tc-label', 'Offer'), offer, cashRow, el('div', 'tc-label', 'Available (click or drag)'), pool);
    return { c, h, offer, pool, rng, val };
  };
  const L = mkCol('You give');
  const R = mkCol('You get');
  cols.append(L.c, el('div', 'trade-arrows', '⇄'), R.c);
  const sendB = el('button', 'btn primary big', 'Send offer');
  sendB.type = 'button';
  root.append(pick, cols, sendB);
  if (prefill) {
    L.rng.value = String(prefill.give.cash);
    R.rng.value = String(prefill.get.cash);
  }

  const chipFor = (i, set, zoneSet) => {
    const sp = SPACES[i];
    const c = el('div', 'tchip');
    c.draggable = true;
    const sw = el('span', 'tsw');
    if (sp.type === 'city') sw.style.background = GROUPS[sp.group].color;
    else sw.textContent = sp.icon;
    c.append(sw, el('span', '', sp.name));
    if (latest.props[i].m) c.classList.add('m');
    c.onclick = () => { fx.sfx.pop(); if (set.has(i)) set.delete(i); else set.add(i); draw(); };
    c.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', String(i)); c.classList.add('drag'); });
    c.addEventListener('dragend', () => c.classList.remove('drag'));
    void zoneSet;
    return c;
  };
  const dropZone = (zone, set, add) => {
    zone.addEventListener('dragover', (ev) => { ev.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (ev) => {
      ev.preventDefault();
      zone.classList.remove('over');
      const i = Number(ev.dataTransfer.getData('text/plain'));
      if (Number.isNaN(i)) return;
      if (add) set.add(i); else set.delete(i);
      fx.sfx.pop();
      draw();
    });
  };
  dropZone(L.offer, give, true);
  dropZone(L.pool, give, false);
  dropZone(R.offer, get, true);
  dropZone(R.pool, get, false);

  function draw() {
    const st = latest;
    const them = P(st, target);
    const meNow = P(st, myId);
    if (!them || !meNow) return;
    R.h.textContent = `${them.emoji} ${them.name} gives`;
    const mineT = tradable(st, myId);
    const theirsT = tradable(st, target);
    [...give].forEach((i) => { if (!mineT.includes(i)) give.delete(i); });
    [...get].forEach((i) => { if (!theirsT.includes(i)) get.delete(i); });
    const fill = (col, list, set) => {
      col.offer.innerHTML = '';
      col.pool.innerHTML = '';
      list.forEach((i) => (set.has(i) ? col.offer : col.pool).append(chipFor(i, set)));
      if (!set.size) col.offer.append(el('div', 'tc-empty', 'Drop properties here'));
      if (!list.length) col.pool.append(el('div', 'tc-empty', 'No tradable properties'));
      gsap.from(col.offer.children, { scale: 0.8, opacity: 0, duration: 0.25, stagger: 0.02 });
    };
    fill(L, mineT, give);
    fill(R, theirsT, get);
    L.rng.max = String(meNow.cash);
    R.rng.max = String(them.cash);
    if (Number(L.rng.value) > meNow.cash) L.rng.value = String(meNow.cash);
    if (Number(R.rng.value) > them.cash) R.rng.value = String(them.cash);
    L.val.textContent = money(Number(L.rng.value));
    R.val.textContent = money(Number(R.rng.value));
  }
  draw();
  const m = modal(root, { cls: 'wide' });
  sendB.onclick = () => {
    const offer = {
      t: 'propose', to: target,
      give: { cash: Number(L.rng.value), props: [...give] },
      get: { cash: Number(R.rng.value), props: [...get] },
    };
    if (!offer.give.props.length && !offer.get.props.length && !offer.give.cash && !offer.get.cash) {
      fx.shake(sendB, 6);
      return;
    }
    H.send(offer);
    fx.sfx.whoosh();
    const c = fx.center(sendB);
    const rc = rows[target] ? fx.center($('.avatar', rows[target])) : null;
    if (rc) fx.flyCoins(c, rc, 5);
    m.close();
    toast('Offer sent!', 'good');
  };
}

function sideSummary(s, side) {
  const box = el('div', 'offer-side');
  side.props.forEach((i) => box.append(chipLine(i)));
  if (side.cash) box.append(el('div', 'offer-cash', `💵 ${money(side.cash)}`));
  if (!side.props.length && !side.cash) box.append(el('div', 'tc-empty', 'Nothing'));
  return box;
}

function chipLine(i) {
  const sp = SPACES[i];
  const c = el('div', 'tchip static');
  const sw = el('span', 'tsw');
  if (sp.type === 'city') sw.style.background = GROUPS[sp.group].color;
  else sw.textContent = sp.icon;
  c.append(sw, el('span', '', sp.name));
  return c;
}

const tradeModals = {};
function renderTrades(s) {
  const myId = H.me();
  for (const t of s.trades) {
    if (t.to === myId && !seenTrades.has(t.id)) {
      seenTrades.add(t.id);
      showIncoming(s, t);
    }
  }
  for (const id of Object.keys(tradeModals)) {
    if (!s.trades.some((t) => String(t.id) === id)) {
      tradeModals[id].close();
      delete tradeModals[id];
    }
  }
  const out = $('#myOffers');
  const mineOut = s.trades.filter((t) => t.from === myId);
  const sig = mineOut.map((t) => t.id).join(',');
  if (out.dataset.sig === sig) return;
  out.dataset.sig = sig;
  out.innerHTML = '';
  mineOut.forEach((t) => {
    const to = P(s, t.to);
    const r = el('div', 'offer-pill', `⏳ Offer to ${to ? to.emoji + ' ' + to.name : '?'}`);
    const x = el('button', 'btn tiny', 'Cancel');
    x.type = 'button';
    x.onclick = () => H.send({ t: 'tradeCancel', id: t.id });
    r.append(x);
    out.append(r);
    gsap.from(r, { x: 40, opacity: 0, duration: 0.3 });
  });
}

function showIncoming(s, t) {
  const from = P(s, t.from);
  const root = el('div', 'incoming');
  const h = el('h2', '');
  h.append(el('span', 'avatar sm', from.emoji), document.createTextNode(` ${from.name} wants to trade`));
  $('.avatar', h).style.setProperty('--c', from.color);
  const cols = el('div', 'trade-cols');
  const a = el('div', 'trade-col');
  a.append(el('div', 'tc-title', 'You get'), sideSummary(s, t.give));
  const b = el('div', 'trade-col');
  b.append(el('div', 'tc-title', 'You give'), sideSummary(s, t.get));
  cols.append(a, el('div', 'trade-arrows', '⇄'), b);
  const acts = el('div', 'deed-actions');
  const m = modal(root, { cls: 'wide' });
  tradeModals[t.id] = m;
  acts.append(
    btn('✅ Accept', 'primary', () => { H.send({ t: 'tradeReply', id: t.id, accept: true }); m.close(); }),
    btn('❌ Decline', '', () => { H.send({ t: 'tradeReply', id: t.id, accept: false }); m.close(); }),
    btn('↩️ Counter', '', () => {
      H.send({ t: 'tradeReply', id: t.id, accept: false });
      m.close();
      setTimeout(() => openTrade(t.from, { give: t.get, get: t.give }), 300);
    }),
  );
  root.append(h, cols, acts);
  gsap.fromTo(m.box, { rotation: -3 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
}

/* ---------- game over ---------- */

const METRIC_LABEL = { cash: 'Cash', property: 'Property value', worth: 'Cash + property value' };
const COLS = ['cash', 'property', 'worth'];

function showGameOver(s) {
  if (gameOverShown) return;
  gameOverShown = true;
  keepAwake(false);
  const winners = s.winners && s.winners.length ? s.winners : [{ key: 'worth', label: 'Winner', pid: s.winner }];
  const key = winners[0].key;
  const ranked = s.ranking.map((id) => P(s, id));
  const root = el('div', 'gameover');
  root.append(el('div', 'go-trophy', '🏆'), el('div', 'go-mode', modeLabel(s.settings)));
  const wrow = el('div', 'go-winners');
  winners.forEach((w) => {
    const p = P(s, w.pid);
    const card = el('div', 'go-winner');
    card.style.setProperty('--c', p.color);
    const av = el('div', 'avatar lg', p.emoji);
    av.style.setProperty('--c', p.color);
    card.append(el('div', 'gw-label', w.label), av, el('div', 'gw-name', p.name), el('div', 'gw-value', money(metricOf(s, p, w.key))));
    wrow.append(card);
  });
  root.append(wrow);
  const pod = el('div', 'podium');
  [1, 0, 2].forEach((k) => {
    const p = ranked[k];
    if (!p) return;
    const col = el('div', `pod pod${k + 1}`);
    const av = el('div', 'avatar', p.emoji);
    av.style.setProperty('--c', p.color);
    const bar = el('div', 'pod-bar', String(k + 1));
    bar.style.setProperty('--c', p.color);
    col.append(av, el('div', 'pod-name', p.name), el('div', 'pod-worth', money(metricOf(s, p, key))), bar);
    pod.append(col);
  });
  root.append(el('div', 'go-sub', `Ranked by ${METRIC_LABEL[key].toLowerCase()}`), pod);
  const table = el('div', 'go-table');
  const head = el('div', 'go-row head');
  head.append(el('span', '', '#'), el('span', '', 'Landlord'), el('span', 'num', 'Cash'), el('span', 'num', 'Property'), el('span', 'num', 'Net worth'));
  table.append(head);
  const keys = new Set(winners.map((w) => w.key));
  ranked.forEach((p, k) => {
    const r = el('div', 'go-row' + (p.id === H.me() ? ' me' : ''));
    r.append(el('span', 'go-rank', String(k + 1)), el('span', 'go-name', `${p.emoji} ${p.name}`));
    if (p.bankrupt) r.append(el('span', 'num out', 'bankrupt'), el('span', 'num'), el('span', 'num'));
    else COLS.forEach((c) => r.append(el('span', 'num' + (keys.has(c) ? ' key' : ''), money(metricOf(s, p, c)))));
    table.append(r);
  });
  root.append(table);
  const again = el('button', 'btn primary big', '🔁 New game');
  again.type = 'button';
  again.onclick = () => { location.href = location.pathname; };
  root.append(again);
  setTimeout(() => {
    modal(root, { cls: 'wide go' });
    gsap.from('.go-winner', { y: 40, scale: 0.6, opacity: 0, stagger: 0.25, duration: 0.7, ease: 'back.out(2)' });
    gsap.from('.pod-bar', { height: 0, duration: 1, ease: 'bounce.out', stagger: 0.2, delay: 0.4 });
    gsap.from('.go-trophy', { scale: 0, rotation: -180, duration: 1, ease: 'back.out(2)' });
    gsap.from('.go-table .go-row', { x: 30, opacity: 0, stagger: 0.03, duration: 0.3, delay: 0.8 });
    fx.fireworks(5);
  }, 600);
}
