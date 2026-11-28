import { bindVoice, unbindVoice, handle as handleVoice, validVoice, cleanVoice, voiceOn } from './voice.js';
export const RELAY_URL = 'https://party-pit-relay.landlords.workers.dev';
const relayOverride = (() => { try { return new URLSearchParams(window.location.search).get('relay'); } catch { return null; } })();
const RELAY = relayOverride || RELAY_URL;
export const RELAY_BASE = RELAY;
const BROKERS = [
  ...(RELAY ? ['relay:' + RELAY] : []),
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];
const PREFER_WAIT_MS = 1500;
const SILENT_MS = 15000;
let PREFIX = '';
let GAME = '';
let CID = '';

export function configureNet({ game, prefix, cid }) {
  GAME = game;
  PREFIX = prefix;
  CID = cid;
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PING_MS = 5000;
const DEAD_MS = 30000;
const WELCOME_MS = 9000;
const CONNECT_MS = 12000;

export const randomCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function parse(buf) {
  try { return JSON.parse(typeof buf === 'string' ? buf : new TextDecoder().decode(buf)); } catch { return null; }
}

class RelayLink {
  constructor(url, { role, cid, code }) {
    this.url = `${url.replace(/^http/, 'ws')}/room/${GAME}/${code}?role=${role}${cid ? '&cid=' + cid : ''}`;
    this.role = role;
    this.handlers = {};
    this.connected = false;
    this.closed = false;
    this.tries = 0;
    this.open();
  }

  on(ev, fn) {
    (this.handlers[ev] = this.handlers[ev] || []).push(fn);
    return this;
  }

  emit(ev, ...args) {
    (this.handlers[ev] || []).forEach((fn) => fn(...args));
  }

  open() {
    if (this.closed) return;
    let ws;
    try { ws = new WebSocket(this.url); } catch { this.later(); return; }
    this.ws = ws;
    ws.onopen = () => { this.connected = true; this.tries = 0; this.emit('connect'); };
    ws.onmessage = (e) => this.emit('message', 'relay/up', e.data);
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      if (was) this.emit('offline');
      this.later();
    };
    ws.onerror = () => {};
  }

  later() {
    if (this.closed) return;
    this.tries++;
    setTimeout(() => this.open(), Math.min(10000, 800 * this.tries));
  }

  subscribe(topics, opts, cb) {
    if (cb) cb(null);
  }

  publish(topic, payload) {
    if (!this.connected) return;
    let out = payload;
    if (this.role === 'host') {
      const to = topic.split('/to/')[1];
      out = JSON.stringify(to ? { to, d: payload } : { b: payload });
    }
    try { this.ws.send(out); } catch { /* socket closing */ }
  }

  end(force) {
    if (this.closed) return;
    this.closed = true;
    if (this.connected && this.role === 'client' && force === false) {
      try { this.ws.send(JSON.stringify({ quiet: 1 })); } catch { /* socket closing */ }
    }
    this.connected = false;
    try { this.ws && this.ws.close(1000); } catch { /* already closed */ }
  }
}

function connect(url, opts) {
  if (url.startsWith('relay:')) return new RelayLink(url.slice(6), opts);
  return window.mqtt.connect(url, { connectTimeout: 8000, reconnectPeriod: 3000, keepalive: 30, clean: true, ...opts });
}

export function createHost(code, h) {
  const base = PREFIX + code;
  const seen = new Map();
  const route = new Map();
  const heard = new Map();
  let ready = false;

  const send = (cid, msg, everywhere = false) => {
    const payload = JSON.stringify(msg);
    const targets = everywhere ? [...(heard.get(cid) || [])] : [route.get(cid)];
    for (const c of targets) if (c && c.connected) c.publish(`${base}/to/${cid}`, payload, { qos: 0 });
  };

  const clients = BROKERS.map((url, i) => {
    const c = connect(url, { clientId: `${CID}-host-${i}-${randomId()}`, role: 'host', code });
    c.upAt = 0;
    c.on('connect', () => {
      c.upAt = Date.now();
      c.subscribe(base + '/up', { qos: 0 }, (err) => {
        if (err || ready) return;
        ready = true;
        h.onReady(code);
      });
    });
    c.on('message', (topic, payload) => {
      const env = parse(payload);
      if (!env || typeof env.cid !== 'string') return;
      const { cid } = env;
      if (env.bye) {
        if (route.get(cid) === c && seen.delete(cid)) h.onClose(cid);
        return;
      }
      route.set(cid, c);
      if (!heard.has(cid)) heard.set(cid, new Set());
      heard.get(cid).add(c);
      const known = seen.has(cid);
      seen.set(cid, Date.now());
      if (env.ping) {
        send(cid, { t: known ? 'pong' : 'rejoin' });
        return;
      }
      if (!env.m) return;
      if (!known && env.m.t !== 'join') {
        send(cid, { t: 'rejoin' });
        return;
      }
      if (env.m.t === 'vo') {
        if (!voiceOn() || !validVoice(env.m)) return;
        const out = cleanVoice(env.m);
        const raw = JSON.stringify(out);
        const used = new Set(route.values());
        const relayed = c instanceof RelayLink;
        for (const x of clients) if (x.connected && used.has(x) && !(relayed && x instanceof RelayLink)) x.publish(base + '/down', raw, { qos: 0 });
        handleVoice(out);
        return;
      }
      h.onData(cid, env.m, c instanceof RelayLink);
    });
    return c;
  });

  const failTimer = setTimeout(() => { if (!ready) h.onError({ type: 'network' }); }, CONNECT_MS);
  bindVoice((m) => {
    const payload = JSON.stringify(m);
    const used = new Set(route.values());
    for (const c of clients) if (c.connected && used.has(c)) c.publish(base + '/down', payload, { qos: 0 });
  });
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [cid, at] of seen) {
      const via = route.get(cid);
      if (via && (!via.connected || now - via.upAt < DEAD_MS)) continue;
      if (now - at > DEAD_MS) {
        seen.delete(cid);
        h.onClose(cid);
      }
    }
  }, 3000);

  return {
    send,
    debug: () => ({ seen: [...seen].map(([k, v]) => [k, Date.now() - v]), routes: [...route].map(([k, c]) => [k, c.idx ?? c.options?.hostname ?? (c.url || '').split('/')[2]]) }),
    broadcastLegacy(msg) {
      const payload = JSON.stringify(msg);
      const used = new Set(route.values());
      for (const c of clients) if (c.connected && used.has(c) && !(c instanceof RelayLink)) c.publish(base + '/down', payload, { qos: 0 });
    },
    broadcast(msg) {
      const payload = JSON.stringify(msg);
      const used = new Set(route.values());
      for (const c of clients) if (c.connected && used.has(c)) c.publish(base + '/down', payload, { qos: 0 });
    },
    destroy() {
      unbindVoice();
      clearTimeout(failTimer);
      clearInterval(sweep);
      clients.forEach((c) => c.end(true));
    },
  };
}

export function joinHost(code, h) {
  const base = PREFIX + code;
  const cid = randomId();
  const bad = new Map();
  let candidates = [];
  let live = new Set();
  let pending = new Map();
  let welcomes = new Map();
  let client = null;
  let gen = 0;
  let welcomeTimer = null;
  let preferTimer = null;
  let connectTimer = null;
  let destroyed = false;
  let failed = false;
  let everWelcomed = false;
  let lastHeard = 0;

  const publish = (c, obj) => { if (c.connected) c.publish(base + '/up', JSON.stringify({ cid, ...obj }), { qos: 0 }); };
  const up = (obj) => {
    if (client) publish(client, obj);
    else live.forEach((c) => publish(c, obj));
  };

  const clearTimers = () => {
    clearTimeout(welcomeTimer);
    clearTimeout(preferTimer);
    clearTimeout(connectTimer);
    welcomeTimer = null;
    preferTimer = null;
  };

  const fail = (type) => {
    if (destroyed || client) return;
    if (everWelcomed) {
      setTimeout(() => { if (!destroyed && !client) start(); }, 3000);
      return;
    }
    if (failed) return;
    failed = true;
    h.onError({ type });
  };

  const choose = (c) => {
    client = c;
    everWelcomed = true;
    lastHeard = Date.now();
    clearTimers();
    candidates.forEach((o) => { if (o !== c) o.end(o instanceof RelayLink ? false : true); });
    live = new Set([c]);
    publish(c, { ping: 1 });
  };

  function start() {
    const g = ++gen;
    candidates.forEach((c) => c.end(false));
    clearTimers();
    client = null;
    live = new Set();
    pending = new Map();
    welcomes = new Map();
    let idxs = BROKERS.map((_, i) => i).filter((i) => !((bad.get(i) || 0) > Date.now()));
    if (!idxs.length) {
      bad.clear();
      idxs = BROKERS.map((_, i) => i);
    }
    candidates = idxs.map((i) => {
      const c = connect(BROKERS[i], {
        clientId: `${CID}-${cid}-${i}-${g}`,
        role: 'client',
        cid,
        code,
      });
      c.idx = i;
      c.on('connect', () => {
        if (g !== gen || (client && client !== c)) return;
        c.subscribe([base + '/down', `${base}/to/${cid}`], { qos: 0 }, (err) => {
          if (err || g !== gen || (client && client !== c)) return;
          live.add(c);
          h.onOpen();
          if (!client && !welcomeTimer) {
            welcomeTimer = setTimeout(() => {
              if (client || g !== gen) return;
              h.onOpen();
              welcomeTimer = setTimeout(() => fail('peer-unavailable'), WELCOME_MS);
            }, WELCOME_MS);
          }
        });
      });
      c.on('message', (topic, payload) => {
        if (g !== gen) return;
        const msg = parse(payload);
        if (!msg) return;
        if (!client) {
          if (msg.t !== 'welcome') {
            if (msg.t === 'state' && (!pending.has(c) || (msg.seq ?? 0) >= (pending.get(c).seq ?? 0))) pending.set(c, msg);
            return;
          }
          welcomes.set(c, msg);
          const settle = () => {
            if (client || g !== gen) return;
            const best = candidates.find((o) => welcomes.has(o));
            choose(best);
            h.onData(welcomes.get(best));
            const st = pending.get(best);
            pending.clear();
            if (st) h.onData(st);
          };
          if (c === candidates[0]) settle();
          else if (!preferTimer) preferTimer = setTimeout(settle, PREFER_WAIT_MS);
          return;
        }
        if (c !== client) return;
        lastHeard = Date.now();
        if (msg.t === 'pong') return;
        if (msg.t === 'vo') { if (validVoice(msg)) handleVoice(msg); return; }
        h.onData(msg);
      });
      c.on('offline', () => { if (g === gen && c === client) h.onClose(); });
      return c;
    });
    connectTimer = setTimeout(() => { if (g === gen && !live.size && !client) fail('network'); }, CONNECT_MS);
  }

  start();
  const pinger = setInterval(() => up({ ping: 1 }), PING_MS);
  const sendVoice = (m) => {
    if (client instanceof RelayLink && client.connected) {
      try { client.ws.send(JSON.stringify({ vo: m })); } catch { /* socket closing */ }
      return;
    }
    up({ m });
  };
  bindVoice(sendVoice);
  const failover = () => {
    if (destroyed || !client) return;
    bad.set(client.idx, Date.now() + 60000);
    h.onClose();
    start();
  };
  const watchdog = setInterval(() => {
    if (!destroyed && client && Date.now() - lastHeard > SILENT_MS) failover();
  }, 3000);

  return {
    send(m) { up({ m }); },
    voice: sendVoice,
    failover,
    destroy() {
      destroyed = true;
      unbindVoice();
      clearTimers();
      clearInterval(pinger);
      clearInterval(watchdog);
      up({ bye: true });
      candidates.forEach((c) => c.end(false));
    },
  };
}
