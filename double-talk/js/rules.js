import { PAIRS, PACKS, VAGUE } from './words.js';

export const MAX_PLAYERS = 40;
export const MIN_PLAYERS = 3;
const REVEAL_MS = 5200;
const RUNOFF_SECS = 30;
const GUESS_SECS = 25;

export const doublesFor = (n) => (n <= 5 ? 1 : n <= 9 ? 2 : n <= 14 ? 3 : n <= 20 ? 4 : Math.round(n * 0.2));
export const blanksFor = (n, want) => Math.max(0, Math.min(want || 0, Math.floor((n - 1) / 2) - doublesFor(n)));

export function newGame(hostId) {
  return {
    phase: 'lobby',
    hostId,
    players: [],
    settings: { clueSecs: 60, voteSecs: 60, games: 3, blanks: 0, blankGuess: false, packs: PACKS.map((p) => p.id) },
    gameNo: 0,
    round: 0,
    alive: [],
    roles: {},
    pair: null,
    civWord: '',
    dblWord: '',
    clues: {},
    history: [],
    votes: {},
    runoff: null,
    tied: 0,
    deadline: 0,
    elim: null,
    result: null,
    used: [],
    log: [],
    botAt: {},
  };
}

export const P = (s, id) => s.players.find((p) => p.id === id);
export const seated = (s) => s.players.filter((p) => !p.spectator);
const isAlive = (s, id) => s.alive.includes(id);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

function log(s, text) {
  s.log.push({ at: Date.now(), text });
  if (s.log.length > 60) s.log.shift();
}

export function addPlayer(s, { id, name, emoji, color, bot }) {
  let p = P(s, id);
  if (p) { p.on = true; p.name = name || p.name; p.emoji = emoji || p.emoji; return p; }
  const spectator = s.phase !== 'lobby' || seated(s).length >= MAX_PLAYERS;
  let nm = name;
  let k = 2;
  while (s.players.some((x) => x.name === nm)) nm = `${name} ${k++}`;
  p = { id, name: nm, emoji: emoji || '🙂', color: color || '#ff4fd8', bot: !!bot, on: true, spectator, score: 0 };
  s.players.push(p);
  return p;
}

export function removePlayer(s, id) {
  s.players = s.players.filter((p) => p.id !== id);
  if (s.phase !== 'lobby' && s.phase !== 'over' && isAlive(s, id)) {
    s.alive = s.alive.filter((x) => x !== id);
    delete s.votes[id];
    checkEnd(s, Date.now());
  }
}

export function setConnected(s, id, on) {
  const p = P(s, id);
  if (p) p.on = on;
}

export function startGame(s, now = Date.now()) {
  const ps = seated(s).filter((p) => p.on);
  if (ps.length < MIN_PLAYERS) return 'need-3';
  s.players.forEach((p) => { p.spectator = !ps.includes(p); });
  if (s.phase === 'lobby') { s.gameNo = 0; s.players.forEach((p) => { p.score = 0; }); }
  s.gameNo++;
  const packs = s.settings.packs.length ? s.settings.packs : PACKS.map((p) => p.id);
  let pool = PAIRS.filter((x) => packs.includes(x.pack) && !s.used.includes(x.id));
  if (!pool.length) { s.used = []; pool = PAIRS.filter((x) => packs.includes(x.pack)); }
  const pair = pool[Math.floor(Math.random() * pool.length)];
  s.used.push(pair.id);
  const flip = Math.random() < 0.5;
  s.pair = pair.id;
  s.civWord = flip ? pair.a : pair.b;
  s.dblWord = flip ? pair.b : pair.a;
  const ids = shuffle(ps.map((p) => p.id));
  const nd = doublesFor(ids.length);
  const nb = blanksFor(ids.length, s.settings.blanks);
  s.roles = {};
  ids.forEach((id, i) => { s.roles[id] = i < nd ? 'dbl' : i < nd + nb ? 'blank' : 'civ'; });
  s.alive = shuffle([...ids]);
  s.round = 0;
  s.history = [];
  s.result = null;
  s.elim = null;
  s.tied = 0;
  s.botAt = {};
  log(s, `Game ${s.gameNo}: ${ids.length} players, ${nd} Imposter${nd === 1 ? '' : 's'}${nb ? `, ${nb} Blank${nb === 1 ? '' : 's'}` : ''}.`);
  nextRound(s, now);
  return null;
}

function nextRound(s, now) {
  s.round++;
  s.phase = 'clue';
  s.clues = {};
  s.votes = {};
  s.runoff = null;
  s.elim = null;
  s.deadline = now + s.settings.clueSecs * 1000;
  s.botAt = {};
}

export const wordFor = (s, id) => (s.roles[id] === 'civ' ? s.civWord : s.roles[id] === 'dbl' ? s.dblWord : null);

export function clueCheck(s, id, text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 28);
  if (!t) return { err: 'empty' };
  const w = wordFor(s, id);
  if (w && norm(t).includes(norm(w))) return { err: 'says-word' };
  if (w && norm(w).length >= 4 && norm(t).length >= 4 && norm(w).includes(norm(t))) return { err: 'says-word' };
  return { t };
}

export function giveClue(s, id, text, now = Date.now()) {
  if (s.phase !== 'clue') return 'not-now';
  if (!isAlive(s, id)) return 'out';
  const r = clueCheck(s, id, text);
  if (r.err) return r.err;
  s.clues[id] = r.t;
  if (s.alive.every((x) => s.clues[x])) toVote(s, now);
  return null;
}

function toVote(s, now) {
  for (const id of s.alive) if (!s.clues[id]) s.clues[id] = '…';
  s.history.push({ round: s.round, clues: { ...s.clues } });
  s.phase = 'vote';
  s.votes = {};
  s.runoff = null;
  s.deadline = now + s.settings.voteSecs * 1000;
  s.botAt = {};
}

export function vote(s, id, target, now = Date.now()) {
  if (s.phase !== 'vote') return 'not-now';
  if (!isAlive(s, id)) return 'out';
  if (target === id) return 'self';
  if (!isAlive(s, target)) return 'bad-target';
  if (s.runoff && !s.runoff.includes(target)) return 'runoff-only';
  s.votes[id] = target;
  if (s.alive.every((x) => s.votes[x])) tally(s, now);
  return null;
}

function tally(s, now) {
  const count = {};
  for (const t of Object.values(s.votes)) count[t] = (count[t] || 0) + 1;
  const top = Math.max(0, ...Object.values(count));
  const lead = Object.keys(count).filter((k) => count[k] === top);
  if (!top) {
    s.elim = { id: null, tie: [], votes: count };
    log(s, 'Nobody voted. Nobody is out.');
    s.phase = 'reveal';
    s.deadline = now + REVEAL_MS;
    return;
  }
  if (lead.length > 1 && !s.runoff) {
    s.runoff = lead;
    s.votes = {};
    s.lastCount = count;
    s.deadline = now + RUNOFF_SECS * 1000;
    s.botAt = {};
    log(s, `Tie between ${lead.map((x) => P(s, x)?.name || '?').join(', ')}. Runoff vote!`);
    return;
  }
  if (lead.length > 1) {
    s.elim = { id: null, tie: lead, votes: count };
    log(s, 'Still tied. Nobody is out this round.');
  } else {
    const id = lead[0];
    s.alive = s.alive.filter((x) => x !== id);
    s.elim = { id, role: s.roles[id], votes: count };
    log(s, `${P(s, id)?.name || '?'} was voted out. They were ${roleName(s.roles[id])}.`);
  }
  s.phase = 'reveal';
  s.deadline = now + REVEAL_MS;
}

export const roleName = (r) => (r === 'civ' ? 'a Civilian' : r === 'dbl' ? 'an Imposter' : 'a Blank');

function afterReveal(s, now) {
  const e = s.elim;
  if (e && e.id && e.role === 'blank' && s.settings.blankGuess) {
    s.phase = 'guess';
    s.guesser = e.id;
    s.deadline = now + GUESS_SECS * 1000;
    s.botAt = {};
    return;
  }
  if (!checkEnd(s, now)) nextRound(s, now);
}

export function guess(s, id, text, now = Date.now()) {
  if (s.phase !== 'guess' || s.guesser !== id) return 'not-now';
  const g = String(text || '').trim().slice(0, 30);
  if (!g) return 'empty';
  s.guessText = g;
  if (norm(g) === norm(s.civWord)) {
    log(s, `${P(s, id)?.name || '?'} guessed the word "${s.civWord}". The Blank wins!`);
    finish(s, 'blank', now, id);
    return null;
  }
  log(s, `${P(s, id)?.name || '?'} guessed "${g}". Wrong!`);
  if (!checkEnd(s, now)) nextRound(s, now);
  return null;
}

function checkEnd(s, now) {
  if (s.phase === 'over') return true;
  const odd = s.alive.filter((x) => s.roles[x] !== 'civ').length;
  const civ = s.alive.length - odd;
  if (odd === 0) { finish(s, 'civ', now); return true; }
  if (civ <= odd || s.alive.length <= 2 || s.round >= Object.keys(s.roles).length + 2) { finish(s, 'odd', now); return true; }
  return false;
}

function finish(s, winner, now, soloId = null) {
  s.phase = 'over';
  s.result = { winner, soloId, civWord: s.civWord, dblWord: s.dblWord, roles: { ...s.roles }, gameNo: s.gameNo, last: s.gameNo >= s.settings.games };
  for (const [id, r] of Object.entries(s.roles)) {
    const p = P(s, id);
    if (!p) continue;
    if (winner === 'civ' && r === 'civ') p.score += 2 + (s.alive.includes(id) ? 1 : 0);
    if (winner === 'odd' && r !== 'civ') p.score += 4;
    if (winner === 'blank' && id === soloId) p.score += 6;
  }
  s.deadline = 0;
  log(s, winner === 'civ' ? 'Civilians win! Every Imposter was caught.' : winner === 'odd' ? 'The Imposters win! They blended in.' : 'The Blank stole the win!');
}

export function backToLobby(s) {
  s.phase = 'lobby';
  s.alive = [];
  s.roles = {};
  s.result = null;
  s.players.forEach((p) => { p.spectator = false; });
  s.players = s.players.filter((p) => p.on || p.bot);
}

export function nextGame(s, now = Date.now()) {
  if (s.phase !== 'over') return 'not-now';
  if (s.result?.last) { backToLobby(s); return null; }
  s.players.forEach((p) => { if (p.on || p.bot) p.spectator = false; });
  const phase = s.phase;
  s.phase = 'between';
  const err = startGame(s, now);
  if (err) s.phase = phase;
  return err;
}

export function tick(s, now = Date.now()) {
  if (!s.deadline || now < s.deadline) return false;
  if (s.phase === 'clue') { toVote(s, now); return true; }
  if (s.phase === 'vote') { tally(s, now); return true; }
  if (s.phase === 'reveal') { afterReveal(s, now); return true; }
  if (s.phase === 'guess') {
    log(s, 'The Blank ran out of time to guess.');
    if (!checkEnd(s, now)) nextRound(s, now);
    return true;
  }
  return false;
}

const pairOf = (s) => PAIRS.find((x) => x.id === s.pair);

function botClue(s, id) {
  const w = wordFor(s, id);
  const pair = pairOf(s);
  const given = new Set(s.history.flatMap((h) => (h.clues[id] ? [h.clues[id]] : [])));
  if (!w) {
    const seen = s.history.flatMap((h) => Object.values(h.clues)).filter((c) => c !== '…');
    if (seen.length && Math.random() < 0.7) return seen[Math.floor(Math.random() * seen.length)];
    return VAGUE[Math.floor(Math.random() * VAGUE.length)];
  }
  if (Math.random() < 0.25) return VAGUE[Math.floor(Math.random() * VAGUE.length)];
  const opts = (pair?.hints[w] || []).filter((h) => !given.has(h));
  return opts.length ? opts[Math.floor(Math.random() * opts.length)] : VAGUE[Math.floor(Math.random() * VAGUE.length)];
}

function botVote(s, id) {
  const w = wordFor(s, id);
  const pair = pairOf(s);
  const mine = new Set((w && pair?.hints[w]) || []);
  const pool = s.alive.filter((x) => x !== id && (!s.runoff || s.runoff.includes(x)));
  if (!pool.length) return null;
  const score = (x) => {
    let sus = Math.random() * 1.2;
    for (const h of s.history) {
      const c = h.clues[x];
      if (!c || c === '…') { sus += 0.8; continue; }
      if (mine.size && !mine.has(c)) sus += 1;
    }
    return sus;
  };
  return pool.map((x) => [x, score(x)]).sort((a, b) => b[1] - a[1])[0][0];
}

export function botStep(s, now = Date.now()) {
  let changed = false;
  const bots = s.players.filter((p) => p.bot && isAlive(s, p.id));
  for (const b of bots) {
    const key = `${s.phase}:${s.round}:${s.runoff ? 'r' : ''}`;
    if (!s.botAt[b.id] || s.botAt[b.id].key !== key) s.botAt[b.id] = { key, at: now + 1200 + Math.random() * 5000 };
    if (now < s.botAt[b.id].at) continue;
    if (s.phase === 'clue' && !s.clues[b.id]) { giveClue(s, b.id, botClue(s, b.id), now); changed = true; }
    else if (s.phase === 'vote' && !s.votes[b.id]) { const t = botVote(s, b.id); if (t) { vote(s, b.id, t, now); changed = true; } }
    if (s.phase !== 'vote' && s.phase !== 'clue') break;
  }
  if (s.phase === 'guess') {
    const g = P(s, s.guesser);
    if (g?.bot) {
      if (!s.botAt.guess) s.botAt.guess = now + 3000;
      else if (now >= s.botAt.guess) {
        const pick = Math.random() < 0.3 ? s.civWord : s.dblWord;
        guess(s, g.id, pick, now);
        changed = true;
      }
    }
  }
  return changed;
}

export function publicView(s) {
  const showRoles = s.phase === 'over';
  return {
    phase: s.phase,
    hostId: s.hostId,
    players: s.players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color, bot: p.bot, on: p.on, spectator: p.spectator, score: p.score })),
    settings: s.settings,
    gameNo: s.gameNo,
    round: s.round,
    alive: s.alive,
    clued: s.phase === 'clue' ? Object.keys(s.clues) : [],
    clues: s.phase === 'clue' ? {} : s.clues,
    history: s.history,
    voted: Object.keys(s.votes),
    votes: s.phase === 'reveal' || s.phase === 'guess' || s.phase === 'over' ? s.votes : null,
    tally: s.elim ? s.elim.votes : s.runoff ? s.lastCount : null,
    runoff: s.runoff,
    deadline: s.deadline,
    elim: s.elim,
    guesser: s.phase === 'guess' ? s.guesser : null,
    guessText: s.phase === 'over' ? s.guessText || null : null,
    result: showRoles ? s.result : null,
    doubles: s.phase === 'lobby' ? 0 : Object.values(s.roles).filter((r) => r === 'dbl').length,
    blanks: s.phase === 'lobby' ? 0 : Object.values(s.roles).filter((r) => r === 'blank').length,
    out: Object.fromEntries(Object.keys(s.roles).filter((id) => !s.alive.includes(id)).map((id) => [id, s.roles[id]])),
    log: s.log.slice(-12),
  };
}

export function privateView(s, id) {
  const r = s.roles[id];
  if (!r) return { word: null, blank: false, playing: false };
  return { word: wordFor(s, id), blank: r === 'blank', playing: true, clue: s.clues[id] || null, vote: s.votes[id] || null };
}
