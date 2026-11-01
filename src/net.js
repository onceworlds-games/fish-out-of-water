// The room and the cup: joining once, the match (lobby → intro → race → results) on the SDK's helpers, bots in empty
// seats, finishes the host checks, and a stand-in room for a page on its own (posters, a plain file server).

import { createMatch, createHost, t } from '@onceworlds/sdk/match';
import { createBots } from '@onceworlds/sdk/bots';
import { POINTS, RACE } from './sim/config.js';
import { cupCourses } from './sim/race.js';

const ow = typeof window !== 'undefined' ? window.onceworlds : null;

export const JOIN = {
  maxPlayers: 8,
  minPlayers: 1,
  lobby: 'bar',
  countdown: 0,
  settings: [
    { id: 'cup', label: 'Cup', options: [{ value: 'harbour', label: 'Harbour Cup' }, { value: 'seaside', label: 'Seaside Cup' }, { value: 'tour', label: 'Grand Tour' }], default: 'harbour' },
    { id: 'races', label: 'Races', options: [{ value: 3, label: '3 races' }, { value: 1, label: '1 race' }], default: 3 },
  ],
};

export const BOT_NAMES = ['Sal', 'Pearl', 'Kipper', 'Bones', 'Captain Gill', 'Marisol', 'Nico', 'Lulu', 'Bream', 'Dot'];
export const BOT_STYLE = {
  Sal: { personality: 'hothead', fish: 'mackerel', cw: 1 },
  Pearl: { personality: 'careful', fish: 'goldfish', cw: 1 },
  Kipper: { personality: 'showoff', fish: 'mackerel', cw: 2 },
  Bones: { personality: 'wobbly', fish: 'eel', cw: 1 },
  'Captain Gill': { personality: 'steady', fish: 'flatfish', cw: 1 },
  Marisol: { personality: 'steady', fish: 'goldfish', cw: 2 },
  Nico: { personality: 'steady', fish: 'puffer', cw: 1 },
  Lulu: { personality: 'careful', fish: 'puffer', cw: 2 },
  Bream: { personality: 'hothead', fish: 'flatfish', cw: 2 },
  Dot: { personality: 'showoff', fish: 'eel', cw: 2 },
};

export async function joinRoom() {
  if (!ow?.rooms?.join) return stubRoom();
  try {
    return await ow.rooms.join(JOIN);
  } catch (err) {
    console.warn('[fish] join failed, playing alone', err);
    return stubRoom();
  }
}

/** Is a value a sane presence of ours? (other players' pages are untrusted) */
export function readPresence(p) {
  if (!p || typeof p !== 'object') return null;
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  if (!num(p.x, -1e5, 1e5) || !num(p.y, -1e5, 1e5) || !num(p.z, -1e5, 1e5)) return null;
  return {
    x: p.x / 100,
    y: p.y / 100,
    z: p.z / 100,
    h: num(p.h, -1e4, 1e4) ? p.h : 0,
    c: num(p.c, 0, 100) ? p.c / 100 : 0,
    m: num(p.m, 0, 100) ? p.m : 100,
    s: num(p.s, 0, 7) ? Math.round(p.s) : 0,
    p: num(p.p, 0, 1e5) ? p.p / 10 : 0,
    f: num(p.f, 0, 4) ? Math.round(p.f) : 0,
    k: num(p.k, 0, 2) ? Math.round(p.k) : 0,
    r: typeof p.r === 'string' && p.r.length <= 80 ? p.r : '',
    n: num(p.n, 0, 1e7) ? Math.round(p.n) : 0,
    l: num(p.l, 0, 1e7) ? Math.round(p.l) : 0,
    g: num(p.g, 0, 1e7) ? Math.round(p.g) : 0,
  };
}

const finishSchema = { rid: t.string(80), t: t.int(0, 600000) };
const botsSchema = (v) => {
  if (!v || typeof v !== 'object' || typeof v.rid !== 'string' || v.rid.length > 80 || !Array.isArray(v.list) || v.list.length > 30) return 'bad bots';
  for (const row of v.list) if (!Array.isArray(row) || row.length !== 11 || typeof row[0] !== 'string' || row[0].length > 32 || !row.slice(1).every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e7)) return 'bad row';
  return true;
};
const dataSchema = (v) => {
  if (!v || typeof v !== 'object') return 'not an object';
  if (typeof v.c !== 'string' || v.c.length > 24) return 'course';
  if (!v.fin || typeof v.fin !== 'object' || Object.keys(v.fin).length > 40) return 'fin';
  for (const [k, n] of Object.entries(v.fin)) if (k.length > 128 || typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 600000) return 'fin value';
  if (typeof v.first !== 'number' || !Number.isFinite(v.first) || v.first < 0) return 'first';
  if (v.prog && (typeof v.prog !== 'object' || Object.keys(v.prog).length > 40)) return 'prog';
  return true;
};

/**
 * The cup on top of the room. hooks: { courseLength(id), progressOf(id): metres, botFinish... }.
 * Returns { room, host, match, bots, finish(rid, ms), publishBots(list), botsState }.
 */
export function createCup(room, hooks) {
  const host = createHost(room);
  const lastProg = new Map();
  room.on('presence', (p) => {
    const r = readPresence(p?.presence);
    if (r) lastProg.set(p.id, r.p);
  });
  const match = createMatch(room, {
    rounds: 'races',
    roundSeconds: RACE.capSeconds,
    introSeconds: RACE.introSeconds,
    roundEndSeconds: RACE.roundEndSeconds,
    resultsSeconds: RACE.resultsSeconds,
    points: POINTS,
    admit: 'round',
    data: dataSchema,
    startRound(m) {
      const list = cupCourses(m.settings.cup ?? 'harbour', room.match.seed ?? 0);
      const c = list[(m.round - 1) % list.length];
      return { c, fin: {}, first: 0, prog: {} };
    },
    onTick(m) {
      const d = m.data;
      if (!d || !d.fin) return;
      const done = Object.keys(d.fin);
      const present = m.present;
      const elapsed = m.elapsed;
      if (present.length && present.every((s) => d.fin[s.id] !== undefined)) return m.endRound();
      if (done.length && d.first > 0 && elapsed >= d.first + RACE.lastCall * 1000) return m.endRound();
    },
    score(m) {
      const d = m.data ?? { fin: {} };
      const seats = m.seats;
      const fin = seats.filter((s) => d.fin?.[s.id] !== undefined).sort((a, b) => d.fin[a.id] - d.fin[b.id]);
      const botProg = hooks.botProgress?.() ?? {};
      const rest = seats
        .filter((s) => d.fin?.[s.id] === undefined)
        .map((s) => ({ s, p: s.bot ? botProg[s.id] ?? d.prog?.[s.id] ?? 0 : (s.me ? hooks.myProgress?.() : undefined) ?? lastProg.get(s.id) ?? 0 }))
        .sort((a, b) => b.p - a.p)
        .map((x) => x.s);
      return [...fin, ...rest].map((s) => [s.id]);
    },
    resume() {
      hooks.onResume?.();
    },
  });
  const bots = createBots(match, { host, fill: RACE.seats, names: BOT_NAMES, skill: [0.25, 0.85], every: 5000, think: () => null });

  const botsState = host.state('bots', { schema: botsSchema, initial: { rid: '', list: [] } });

  const sendFinish = host.rpc('finish', {
    args: finishSchema,
    rate: 2,
    validate: (from, a) => {
      if (match.phase !== 'round') return 'not racing';
      if (a.rid !== match.roundId) return 'old race';
      const d = match.data;
      if (!d || d.fin?.[from.id] !== undefined) return 'already in';
      const len = hooks.courseLength?.(d.c) ?? 150;
      if (a.t < (len / 9) * 1000) return 'too fast';
      const el = match.elapsed;
      if (a.t > el + 1500 || a.t < el - 5000) return 'clock';
      const p = lastProg.get(from.id);
      if (p !== undefined && p < len * 0.8 && from.id !== room.me.id) return 'not there';
      return true;
    },
    run: (from, a) => {
      match.setData((d) => {
        d.fin[from.id] = a.t;
        if (!d.first) d.first = a.t;
      });
    },
  });

  const cup = {
    room,
    host,
    match,
    bots,
    botsState,
    lastProg,
    /** Tell the host this page's fish reached the water. */
    finish(rid, ms) {
      try {
        sendFinish({ rid, t: Math.round(ms) });
      } catch {}
    },
    /** Host: a bot reached the water. */
    botFinish(id, ms) {
      if (!match.isHost) return;
      match.setData((d) => {
        if (d.fin[id] !== undefined) return;
        d.fin[id] = Math.round(ms);
        if (!d.first) d.first = Math.round(ms);
      });
    },
  };
  return cup;
}

/** A room for a page on its own: one player, matches that start when you're ready, bots fill the rest. */
export function stubRoom() {
  const handlers = {};
  const me = { id: 'me', name: 'You', presence: null, team: 0, ready: false, connected: true, guest: true };
  const players = new Map([['me', me]]);
  let t0 = 0;
  let n = 0;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const emit = (ev, ...args) => {
    for (const fn of handlers[ev] ?? []) {
      try {
        fn(...args);
      } catch (err) {
        console.error(err);
      }
    }
  };
  const room = {
    id: 'solo',
    me,
    players,
    get online() {
      return [me];
    },
    host: 'me',
    isHost: true,
    connected: true,
    closed: false,
    kind: 'solo',
    ranked: false,
    state: {},
    private: {},
    settings: { cup: 'harbour', races: 3 },
    match: { phase: 'lobby', n: 0, id: '', seed: 0, participants: [], min: 1 },
    get participants() {
      return room.match.participants;
    },
    spectators: [],
    get spectating() {
      return false;
    },
    get canStart() {
      return true;
    },
    allReady: true,
    notReady: [],
    leftOut: [],
    budget: { messagesPerSecond: 60, presenceHz: 20, bytesPerSecond: 128000 },
    get running() {
      return room.match.phase === 'playing';
    },
    matchNow: () => (room.match.phase === 'playing' ? now() - t0 : 0),
    isParticipant: (id) => room.match.participants.includes(id),
    on(ev, fn) {
      (handlers[ev] ??= []).push(fn);
      return () => {
        handlers[ev] = (handlers[ev] ?? []).filter((f) => f !== fn);
      };
    },
    setState(k, v) {
      if (v === null) delete room.state[k];
      else room.state[k] = v;
    },
    setPresence(p) {
      me.presence = p;
    },
    presenceAt: () => null,
    send() {},
    setReady(on) {
      me.ready = !!on;
      if (on) setTimeout(() => room.startMatch(), 0);
    },
    clearReady() {
      me.ready = false;
    },
    setSetting(id, v) {
      room.settings = { ...room.settings, [id]: v };
      emit('settings', room.settings);
    },
    admit() {},
    hideLobby() {},
    setOpen() {},
    reportResult() {},
    setPrivate() {},
    startMatch() {
      if (room.match.phase !== 'lobby') return;
      t0 = now();
      n++;
      const previous = room.match;
      room.match = { phase: 'playing', n, id: `solo${n}.${Date.now()}`, seed: Math.floor(Math.random() * 2 ** 31), participants: ['me'], min: 1, startedAt: Date.now() };
      me.ready = false;
      emit('match', room.match, previous);
      emit('matchstart', room.match);
    },
    endMatch() {
      const previous = room.match;
      room.match = { phase: 'lobby', n: previous.n, id: '', seed: 0, participants: [], min: 1 };
      emit('match', room.match, previous);
      emit('matchend', room.match, previous);
    },
    pauseMatch() {},
    leave() {},
    _emit: emit,
  };
  return room;
}
