import { initFeedback } from '../../shared/feedback.js';
import { newState, addPlayer, removePlayer, startGame, act, tick, endNow, P, MAX_PLAYERS, StaleAction, TURN_ACTS, actCtx } from './rules.js';
import { botStep, BOT_NAMES } from './bot.js';
import { createHost, joinHost, randomCode, RELAY_URL } from './net.js';
import * as ui from './ui.js';
import { PACKS, HOUSE_RULES } from './packs.js';

const app = { role: null, code: null, me: null, hostPid: null, offset: 0, state: null, net: null, conns: {}, keys: {} };
const params = new URLSearchParams(location.search);

function hit(kind, extra = {}) {
  if (params.has('nohit')) return;
  try {
    fetch(RELAY_URL + '/hit', { method: 'POST', body: JSON.stringify({ game: 'landlords', kind, wd: navigator.webdriver ? 1 : 0, ...extra }), keepalive: true, mode: 'cors' }).catch(() => {});
  } catch { /* offline */ }
}

let gameHit = false;
function reportGame(name) {
  if (gameHit || !app.state || app.state.phase !== 'playing' || !app.me) return;
  gameHit = true;
  hit('game', { name, room: app.code, players: app.state.players.length });
}
if (params.has('debug')) window.__ll = app;

function clientKey() {
  let k = null;
  try { k = sessionStorage.getItem('landlords-key'); } catch { /* storage unavailable */ }
  if (!k) {
    k = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem('landlords-key', k); } catch { /* storage unavailable */ }
  }
  return k;
}

function errText(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'Room not found. Check the code, and make sure the host still has the game open.';
  if (t === 'network') return 'Could not reach the game relay. Check your internet connection and try again.';
  return (e && e.message) || 'Connection problem';
}

/* ---------- host ---------- */

let pendingEv = null;
let lastLogSent = 0;
let seq = 0;

function commit(ev) {
  if (pendingEv) {
    pendingEv.push(...ev);
    return;
  }
  pendingEv = [...ev];
  queueMicrotask(flush);
}

function flush() {
  const ev = pendingEv;
  pendingEv = null;
  const full = JSON.parse(JSON.stringify(app.state));
  const lg = full.log.filter((l) => l.id > lastLogSent);
  lastLogSent = full.logId;
  const slim = { ...full, log: null, decks: null, cheat: null, cheated: false };
  seq++;
  app.net.broadcast({ t: 'state', seq, s: slim, lg, ev, now: Date.now() });
  ui.pushUpdate(full, ev);
}

function sendFullState(id, everywhere = false) {
  const full = JSON.parse(JSON.stringify(app.state));
  app.net.send(id, { t: 'state', seq, s: { ...full, decks: null, cheat: null, cheated: false }, ev: [], now: Date.now() }, everywhere);
}

function relay(msg) {
  app.net.broadcast(msg);
  if (msg.t === 'chat') ui.addChat(msg.pid, msg.text);
  if (msg.t === 'emote') ui.showEmote(msg.pid, msg.e);
}

function runAct(pid, a, connId = null) {
  const ev = [];
  try {
    act(app.state, pid, a, ev, Date.now());
  } catch (e) {
    if (e instanceof StaleAction) return;
    if (connId) app.net.send(connId, { t: 'error', msg: e.message });
    else if (pid === app.me) ui.toast(e.message, 'bad');
    return;
  }
  commit(ev);
}

function addBot() {
  const s = app.state;
  if (s.phase !== 'lobby' || s.players.length >= MAX_PLAYERS) return;
  const used = new Set(s.players.map((p) => p.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot';
  addPlayer(s, { name, emoji: ui.EMOJIS[Math.floor(Math.random() * ui.EMOJIS.length)], bot: true });
}

function handleHostMsg(id, msg) {
  const s = app.state;
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'join': {
      const key = String(msg.key || '');
      let p = app.keys[key] ? P(s, app.keys[key]) : null;
      if (p) {
        p.connected = true;
      } else if (s.phase === 'lobby') {
        if (s.players.length >= MAX_PLAYERS) {
          app.net.send(id, { t: 'error', msg: 'This room is full (32 players).' });
          return;
        }
        p = addPlayer(s, { name: msg.name, emoji: String(msg.emoji || '🙂').slice(0, 8) });
        app.keys[key] = p.id;
      }
      app.conns[id] = p ? p.id : null;
      app.net.send(id, { t: 'welcome', you: p ? p.id : null, host: app.hostPid, code: app.code }, true);
      sendFullState(id, true);
      commit([]);
      break;
    }
    case 'act': {
      const pid = app.conns[id];
      if (pid && msg.a && typeof msg.a === 'object') runAct(pid, msg.a, id);
      break;
    }
    case 'chat': {
      if (!(id in app.conns)) return;
      const text = String(msg.text || '').trim().slice(0, 140);
      if (text) relay({ t: 'chat', pid: app.conns[id], text });
      break;
    }
    case 'emote': {
      const pid = app.conns[id];
      const e = String(msg.e || '').slice(0, 4);
      if (pid && e) relay({ t: 'emote', pid, e });
      break;
    }
    default:
      break;
  }
}

function host({ name, emoji }) {
  const code = randomCode();
  ui.setHomeStatus('Opening a room…', 'busy');
  app.net = createHost(code, {
    onReady() {
      if (app.role) return;
      app.role = 'host';
      app.code = code;
      app.state = newState();
      const p = addPlayer(app.state, { name, emoji });
      app.me = p.id;
      app.hostPid = p.id;
      app.myName = p.name;
      hit('host', { name: p.name, room: code });
      history.replaceState(null, '', `?room=${code}`);
      const bots = Math.min(MAX_PLAYERS - 1, Number(params.get('bots')) || 0);
      for (let i = 0; i < bots; i++) addBot();
      commit([]);
      setInterval(hostTick, 250);
      window.addEventListener('beforeunload', (e) => {
        if (app.state.phase === 'over' || !Object.values(app.conns).some(Boolean)) return;
        e.preventDefault();
        e.returnValue = '';
      });
    },
    onError(e) {
      if (!app.role) ui.setHomeStatus(errText(e), 'bad');
      else ui.toast('Connection to the relay dropped — reconnecting…', 'bad');
    },
    onData: handleHostMsg,
    onClose(id) {
      const pid = app.conns[id];
      delete app.conns[id];
      const s = app.state;
      const p = pid ? P(s, pid) : null;
      if (!p) return;
      if (Object.values(app.conns).includes(pid)) return;
      if (s.phase === 'lobby') {
        removePlayer(s, pid);
        for (const k of Object.keys(app.keys)) if (app.keys[k] === pid) delete app.keys[k];
      } else {
        p.connected = false;
        if (s.phase === 'playing' && s.players[s.turn].id === pid) s.turnEnds = Math.min(s.turnEnds, Date.now() + 12000);
      }
      commit([]);
    },
  });
}

let lastBot = 0;
function hostTick() {
  const s = app.state;
  if (!s || s.phase !== 'playing') return;
  const now = Date.now();
  const ev = [];
  if (tick(s, now, ev)) commit(ev);
  if (now - lastBot > 650) {
    lastBot = now;
    const step = botStep(s, now, ui.isBusy() && !document.hidden);
    if (step) runAct(step.pid, step.a);
  }
}

/* ---------- client ---------- */

let lastSeq = -1;
let clientLog = [];
let lastAct = null;
let retryTimer = null;

function sendAct(a) {
  if (TURN_ACTS.includes(a.t) && app.state) a = { ...a, ctx: actCtx(app.state) };
  lastAct = { a, at: Date.now() };
  app.net.send({ t: 'act', a });
  clearTimeout(retryTimer);
  if (!a.ctx) return;
  const sent = a.ctx;
  let tries = 0;
  const retry = () => {
    if (!app.state || actCtx(app.state) !== sent || !app.net) return;
    tries++;
    if (tries === 3 && app.net.failover) app.net.failover();
    else app.net.send({ t: 'act', a });
    if (tries < 6) retryTimer = setTimeout(retry, 3000);
  };
  retryTimer = setTimeout(retry, 2500);
}

function join({ code, name, emoji }) {
  ui.setHomeStatus(`Connecting to room ${code}…`, 'busy');
  app.code = code;
  let lost = false;
  const sendJoin = () => app.net.send({ t: 'join', key: clientKey(), name, emoji });
  app.net = joinHost(code, {
    onOpen() {
      if (lost) { lost = false; ui.toast('Reconnected!', 'good'); }
      sendJoin();
    },
    onData(msg) {
      if (!msg || typeof msg !== 'object') return;
      switch (msg.t) {
        case 'welcome':
          app.role = 'client';
          app.me = msg.you;
          app.hostPid = msg.host;
          if (!app.joinedHit) {
            app.joinedHit = true;
            hit('join', { name, room: code });
          }
          history.replaceState(null, '', `?room=${code}`);
          if (!msg.you) ui.toast('The game has already started — you are spectating.');
          if (app.state) ui.pushUpdate(app.state, []);
          break;
        case 'rejoin':
          sendJoin();
          if (lastAct && Date.now() - lastAct.at < 10000) setTimeout(() => app.net.send({ t: 'act', a: lastAct.a }), 400);
          break;
        case 'state': {
          if (typeof msg.seq === 'number') {
            if (msg.seq < lastSeq) break;
            lastSeq = msg.seq;
          }
          if (Array.isArray(msg.s.log)) clientLog = msg.s.log.slice(-60);
          else if (Array.isArray(msg.lg)) {
            const top = clientLog.length ? clientLog[clientLog.length - 1].id : 0;
            clientLog = clientLog.concat(msg.lg.filter((l) => l.id > top)).slice(-60);
          }
          msg.s.log = clientLog;
          app.offset = msg.now - Date.now();
          app.state = msg.s;
          if (app.role) ui.pushUpdate(msg.s, msg.ev || []);
          reportGame((P(msg.s, app.me) || {}).name || name);
          break;
        }
        case 'chat': ui.addChat(msg.pid, msg.text); break;
        case 'emote': ui.showEmote(msg.pid, msg.e); break;
        case 'error':
          ui.toast(msg.msg, 'bad');
          if (!app.role) ui.setHomeStatus(msg.msg, 'bad');
          break;
        default: break;
      }
    },
    onClose() {
      if (!app.role || lost) return;
      lost = true;
      ui.toast('Connection lost — reconnecting…', 'bad');
    },
    onError(e) {
      if (app.role) return;
      app.net.destroy();
      ui.setHomeStatus(errText(e), 'bad');
    },
  });
}

/* ---------- wire up ---------- */

ui.initUI({
  onCreate: host,
  onJoin: join,
  send(a) {
    if (app.role === 'host') runAct(app.me, a);
    else if (app.net) sendAct(a);
  },
  chat(text) {
    if (app.role === 'host') relay({ t: 'chat', pid: app.me, text: text.slice(0, 140) });
    else if (app.net) app.net.send({ t: 'chat', text });
  },
  emote(e) {
    if (app.role === 'host') relay({ t: 'emote', pid: app.me, e });
    else if (app.net) app.net.send({ t: 'emote', e });
  },
  me: () => app.me,
  hostPid: () => app.hostPid,
  isHost: () => app.role === 'host',
  roomCode: () => app.code,
  offset: () => (app.role === 'host' ? 0 : app.offset),
  setSettings(o) {
    if (app.role !== 'host' || app.state.phase !== 'lobby') return;
    const st = app.state.settings;
    const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, !!(obj && obj[k])]));
    if (o.packs) o.packs = pick(o.packs, PACKS.map((p) => p.id));
    if (o.house) o.house = pick(o.house, HOUSE_RULES.map((h) => h.id));
    for (const k of ['startCash', 'turnSeconds', 'mode', 'minutes', 'rounds', 'packs', 'house']) if (k in o) st[k] = o[k];
    commit([]);
  },
  addBot() {
    if (app.role !== 'host') return;
    addBot();
    commit([]);
  },
  endGame() {
    if (app.role !== 'host') return;
    const ev = [];
    try {
      endNow(app.state, ev);
    } catch (e) {
      ui.toast(e.message, 'bad');
      return;
    }
    commit(ev);
  },
  start() {
    if (app.role !== 'host') return;
    const ev = [];
    try {
      startGame(app.state, ev, Date.now());
    } catch (e) {
      ui.toast(e.message, 'bad');
      return;
    }
    commit(ev);
    reportGame(app.myName);
  },
});

hit('visit');

initFeedback({ game: 'landlords' });
