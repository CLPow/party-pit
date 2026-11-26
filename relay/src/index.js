import { DurableObject } from 'cloudflare:workers';

const ALLOWED_ORIGINS = [/^https:\/\/clpow\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
const MAX_MESSAGE = 256 * 1024;
const KEEP_DAYS = 90;
const HITS_PER_MINUTE = 20;
const KINDS = ['visit', 'host', 'join', 'game'];
const GAMES = ['landlords', 'mean-meme-card-club', 'tunnel-traitors', 'meowltdown'];
const MAX_SOCKETS = 64;
const VOICE_PER_SEC = 60;
const BOT_UA = /bot|crawl|spider|slurp|headless|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|curl|wget|python|node-fetch|undici|axios|go-http|java\/|lighthouse|pagespeed|phantom|puppeteer|playwright|selenium/i;

const allowed = (origin) => ALLOWED_ORIGINS.some((re) => re.test(origin || ''));

function cors(origin, res) {
  const h = new Headers(res.headers);
  if (allowed(origin)) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    h.set('Access-Control-Max-Age', '86400');
    h.set('Vary', 'Origin');
  }
  return new Response(res.body, { status: res.status, headers: h });
}

function sameKey(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if (url.pathname === '/') return new Response('Party Pit relay is running.');

    if (url.pathname === '/hit' || url.pathname === '/stats' || url.pathname === '/stats/reset') {
      if (request.method === 'OPTIONS') return cors(origin, new Response(null, { status: 204 }));
      const stats = env.STATS.get(env.STATS.idFromName('global'));
      if (url.pathname === '/hit') {
        if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
        if (!allowed(origin)) return new Response('Forbidden origin', { status: 403 });
        let body = {};
        try { body = JSON.parse(await request.text()); } catch { /* empty body */ }
        const kind = KINDS.includes(body.kind) ? body.kind : 'visit';
        const ua = request.headers.get('User-Agent') || '';
        if (!ua || BOT_UA.test(ua) || body.wd) return cors(origin, new Response(null, { status: 204 }));
        const cf = request.cf || {};
        if (!GAMES.includes(body.game)) return cors(origin, new Response('Unknown game', { status: 400 }));
        await stats.hit({
          game: body.game,
          ip: request.headers.get('CF-Connecting-IP') || 'unknown',
          kind,
          name: cleanName(body.name),
          room: String(body.room || '').replace(/[^A-Z0-9]/g, '').slice(0, 5),
          players: Math.max(0, Math.min(64, Number(body.players) || 0)),
          country: cf.country || '',
          city: cf.city || '',
          ua: ua.slice(0, 300),
        });
        return cors(origin, new Response(null, { status: 204 }));
      }
      const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!env.ADMIN_KEY || !sameKey(auth, env.ADMIN_KEY)) return cors(origin, new Response('Unauthorized', { status: 401 }));
      if (url.pathname === '/stats/reset') {
        if (request.method !== 'POST') return cors(origin, new Response('Method not allowed', { status: 405 }));
        await stats.reset();
        return cors(origin, new Response(null, { status: 204 }));
      }
      if (request.method !== 'GET') return cors(origin, new Response('Method not allowed', { status: 405 }));
      const game = GAMES.includes(url.searchParams.get('game')) ? url.searchParams.get('game') : '';
      return cors(origin, Response.json(await stats.report(game), { headers: { 'Cache-Control': 'no-store' } }));
    }

    const match = url.pathname.match(/^\/room\/([a-z-]+)\/([A-Z0-9]{5})$/);
    if (!match || !GAMES.includes(match[1])) return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (!allowed(origin)) return new Response('Forbidden origin', { status: 403 });
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1] + ':' + match[2]));
    return room.fetch(request);
  },
};

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.recent = new Map();
    this.sql.exec(`CREATE TABLE IF NOT EXISTS visitors (
      game TEXT NOT NULL, ip TEXT NOT NULL, visits INTEGER NOT NULL DEFAULT 0, hosts INTEGER NOT NULL DEFAULT 0, joins INTEGER NOT NULL DEFAULT 0,
      games INTEGER NOT NULL DEFAULT 0, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, country TEXT, city TEXT, last_ua TEXT, last_name TEXT, PRIMARY KEY (game, ip))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS names (
      game TEXT NOT NULL, name TEXT NOT NULL, ip TEXT NOT NULL, hosts INTEGER NOT NULL DEFAULT 0, joins INTEGER NOT NULL DEFAULT 0, games INTEGER NOT NULL DEFAULT 0,
      first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, last_room TEXT, PRIMARY KEY (game, name, ip))`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS events (ts INTEGER NOT NULL, game TEXT NOT NULL, ip TEXT NOT NULL, kind TEXT NOT NULL, name TEXT, room TEXT, players INTEGER)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS events_ts ON events (ts)');
  }

  limited(ip, now) {
    const list = (this.recent.get(ip) || []).filter((t) => now - t < 60000);
    list.push(now);
    this.recent.set(ip, list);
    if (this.recent.size > 5000) this.recent.clear();
    return list.length > HITS_PER_MINUTE;
  }

  async hit({ game, ip, kind, name, room, players, country, city, ua }) {
    const now = Date.now();
    if (this.limited(ip, now)) return;
    const col = kind === 'host' ? 'hosts' : kind === 'join' ? 'joins' : kind === 'game' ? 'games' : 'visits';
    this.sql.exec(
      `INSERT INTO visitors (game, ip, first_seen, last_seen, country, city, last_ua, last_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(game, ip) DO UPDATE SET last_seen = excluded.last_seen, country = excluded.country, city = excluded.city,
         last_ua = excluded.last_ua, last_name = COALESCE(excluded.last_name, visitors.last_name)`,
      game, ip, now, now, country, city, ua, name || null,
    );
    this.sql.exec(`UPDATE visitors SET ${col} = ${col} + 1 WHERE game = ? AND ip = ?`, game, ip);
    if (name && kind !== 'visit') {
      this.sql.exec(
        `INSERT INTO names (game, name, ip, first_seen, last_seen, last_room) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(game, name, ip) DO UPDATE SET last_seen = excluded.last_seen, last_room = excluded.last_room`,
        game, name, ip, now, now, room || null,
      );
      this.sql.exec(`UPDATE names SET ${col} = ${col} + 1 WHERE game = ? AND name = ? AND ip = ?`, game, name, ip);
    }
    this.sql.exec('INSERT INTO events (ts, game, ip, kind, name, room, players) VALUES (?, ?, ?, ?, ?, ?, ?)', now, game, ip, kind, name || null, room || null, players || null);
    if (Math.random() < 0.02) this.sql.exec('DELETE FROM events WHERE ts < ?', now - KEEP_DAYS * 86400000);
  }

  async reset() {
    this.sql.exec('DELETE FROM visitors');
    this.sql.exec('DELETE FROM names');
    this.sql.exec('DELETE FROM events');
    this.recent.clear();
  }

  async report(game) {
    const f = game ? 'WHERE game = ?' : '';
    const g = game ? [game] : [];
    const V = `(SELECT ip, SUM(visits) AS visits, SUM(hosts) AS hosts, SUM(joins) AS joins, SUM(games) AS games,
        MIN(first_seen) AS first_seen, MAX(last_seen) AS last_seen, group_concat(DISTINCT game) AS game_list,
        (SELECT country FROM visitors x WHERE x.ip = v0.ip ORDER BY last_seen DESC LIMIT 1) AS country,
        (SELECT city FROM visitors x WHERE x.ip = v0.ip ORDER BY last_seen DESC LIMIT 1) AS city,
        (SELECT last_ua FROM visitors x WHERE x.ip = v0.ip ORDER BY last_seen DESC LIMIT 1) AS last_ua,
        (SELECT last_name FROM visitors x WHERE x.ip = v0.ip ORDER BY last_seen DESC LIMIT 1) AS last_name
      FROM visitors v0 ${f} GROUP BY ip)`;
    const N = `(SELECT * FROM names ${f})`;
    const visitors = this.sql.exec(`SELECT v.*, (SELECT group_concat(name, ', ') FROM (SELECT DISTINCT name FROM ${N} WHERE ip = v.ip ORDER BY last_seen DESC)) AS names
      FROM ${V} v ORDER BY v.last_seen DESC`, ...g, ...g).toArray();
    const players = this.sql.exec(`SELECT n.name, COUNT(DISTINCT n.ip) AS ip_count, group_concat(DISTINCT n.ip) AS ips, group_concat(DISTINCT n.game) AS game_list,
        SUM(n.hosts) AS hosts, SUM(n.joins) AS joins, SUM(n.games) AS games, MIN(n.first_seen) AS first_seen, MAX(n.last_seen) AS last_seen,
        (SELECT country FROM visitors WHERE ip = (SELECT ip FROM names WHERE name = n.name ORDER BY last_seen DESC LIMIT 1) ORDER BY last_seen DESC LIMIT 1) AS country,
        (SELECT city FROM visitors WHERE ip = (SELECT ip FROM names WHERE name = n.name ORDER BY last_seen DESC LIMIT 1) ORDER BY last_seen DESC LIMIT 1) AS city,
        (SELECT last_ua FROM visitors WHERE ip = (SELECT ip FROM names WHERE name = n.name ORDER BY last_seen DESC LIMIT 1) ORDER BY last_seen DESC LIMIT 1) AS last_ua,
        (SELECT last_room FROM names WHERE name = n.name ORDER BY last_seen DESC LIMIT 1) AS last_room
      FROM ${N} n GROUP BY n.name ORDER BY last_seen DESC`, ...g).toArray();
    const since = Date.now() - 60 * 86400000;
    const ef = game ? 'AND game = ?' : '';
    const days = this.sql.exec(
      `SELECT date(ts / 1000, 'unixepoch') AS day,
              SUM(kind = 'visit') AS visits, SUM(kind = 'host') AS hosts, SUM(kind = 'join') AS joins, SUM(kind = 'game') AS games,
              COUNT(DISTINCT ip) AS unique_ips, COUNT(DISTINCT name) AS unique_names
       FROM events WHERE ts >= ? ${ef} GROUP BY day ORDER BY day`,
      since, ...g,
    ).toArray();
    const recent = this.sql.exec(`SELECT ts, game, ip, kind, name, room, players FROM events WHERE kind != 'visit' ${ef} ORDER BY ts DESC LIMIT 200`, ...g).toArray();
    const totals = this.sql.exec(`SELECT COUNT(*) AS unique_ips, COALESCE(SUM(visits), 0) AS visits, COALESCE(SUM(hosts), 0) AS hosts,
      COALESCE(SUM(joins), 0) AS joins, COALESCE(SUM(games), 0) AS games, (SELECT COUNT(DISTINCT name) FROM ${N}) AS names FROM ${V}`, ...g, ...g).one();
    const byGame = this.sql.exec(`SELECT game, COUNT(DISTINCT ip) AS unique_ips, SUM(visits) AS visits, SUM(hosts) AS hosts, SUM(joins) AS joins, SUM(games) AS games
      FROM visitors GROUP BY game`).toArray();
    return { generated: Date.now(), game: game || 'all', totals, byGame, days, visitors, players, recent };
  }
}

export class Room extends DurableObject {
  hosts() {
    return this.ctx.getWebSockets('host');
  }

  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const cid = (url.searchParams.get('cid') || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    if (role === 'client' && (!cid || this.hosts().length === 0)) return new Response('Room not found', { status: 404 });
    if (role === 'client' && this.ctx.getWebSockets('c:' + cid).length === 0 && this.ctx.getWebSockets().length >= MAX_SOCKETS) return new Response('Room is full', { status: 429 });
    const [client, server] = Object.values(new WebSocketPair());
    if (role === 'host') {
      for (const old of this.hosts()) {
        try { old.close(4000, 'Replaced by a new host connection'); } catch { /* already closed */ }
      }
      this.ctx.acceptWebSocket(server, ['host']);
    } else {
      for (const old of this.ctx.getWebSockets('c:' + cid)) {
        try { old.close(4000, 'Replaced'); } catch { /* already closed */ }
      }
      this.ctx.acceptWebSocket(server, ['c:' + cid]);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > MAX_MESSAGE) return;
    const tag = this.ctx.getTags(ws)[0];
    if (tag === 'host') {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.to) {
        for (const s of this.ctx.getWebSockets('c:' + msg.to)) this.trySend(s, msg.d);
      } else if (typeof msg.b === 'string') {
        for (const s of this.ctx.getWebSockets()) if (this.ctx.getTags(s)[0] !== 'host') this.trySend(s, msg.b);
      }
      return;
    }
    let env;
    try { env = JSON.parse(data); } catch { return; }
    if (env.vo && typeof env.vo === 'object') {
      const att = ws.deserializeAttachment() || {};
      const now = Date.now();
      const sec = Math.floor(now / 1000);
      if (att.vs !== sec) { att.vs = sec; att.vn = 0; }
      if (++att.vn > VOICE_PER_SEC) return;
      if (env.vo.k === 'join' || env.vo.k === 'here') att.call = true;
      if (env.vo.k === 'leave') att.call = false;
      ws.serializeAttachment(att);
      const frame = env.vo.k === 'f';
      const cid = tag.slice(2);
      const raw = JSON.stringify(env.vo);
      const toHost = JSON.stringify({ cid, m: env.vo });
      for (const s of this.ctx.getWebSockets()) {
        if (s === ws) continue;
        if (this.ctx.getTags(s)[0] === 'host') { this.trySend(s, toHost); continue; }
        if (frame && !s.deserializeAttachment()?.call) continue;
        this.trySend(s, raw);
      }
      return;
    }
    if (env.quiet) {
      ws.serializeAttachment({ ...(ws.deserializeAttachment() || {}), quiet: true });
      return;
    }
    env.cid = tag.slice(2);
    const out = JSON.stringify(env);
    for (const h of this.hosts()) this.trySend(h, out);
  }

  webSocketClose(ws, code) {
    this.gone(ws);
    try { ws.close(code === 1005 ? 1000 : code, 'Closing'); } catch { /* already closed */ }
  }

  webSocketError(ws) {
    this.gone(ws);
  }

  gone(ws) {
    const tag = this.ctx.getTags(ws)[0];
    if (!tag || tag === 'host') return;
    if (ws.deserializeAttachment()?.quiet) return;
    const cid = tag.slice(2);
    if (this.ctx.getWebSockets(tag).some((s) => s !== ws && s.readyState === 1)) return;
    for (const h of this.hosts()) this.trySend(h, JSON.stringify({ cid, bye: true }));
  }

  trySend(ws, data) {
    try { ws.send(data); } catch { /* socket closing */ }
  }
}
