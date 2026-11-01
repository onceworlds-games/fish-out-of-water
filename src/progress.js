// The player's own saves: fish, bests, medals, ghosts, the daily, badge counters. Saved with onceworlds.save (local
// storage on a page on its own). Everything read back is checked: a save from an older version must never break a page.

import { FISH, UNLOCKS } from './sim/config.js';
import { COURSE_IDS } from './sim/courses/index.js';
import { medalFor, MEDAL_NAMES } from './sim/race.js';
import { SLOTS, DEFAULTS, COLOURWAY_LEVELS, COLOURWAY_COUNT, GOALS } from './cosmetics.js';
import { levelOf, runXp, rewardsAt, goalsFor, applyRun, bumpStreak, liveStreak, dayOf, XP } from './catch.js';

const ow = typeof window !== 'undefined' ? window.onceworlds : null;
const KEY = 'profile';
const local = {
  async get(k) {
    try {
      return JSON.parse(localStorage.getItem(`fish-out-of-water:${k}`) ?? 'null');
    } catch {
      return null;
    }
  },
  async set(k, v) {
    try {
      localStorage.setItem(`fish-out-of-water:${k}`, JSON.stringify(v));
    } catch {}
  },
};
const store = () => (ow?.save?.get ? ow.save : local);

function blank() {
  return { v: 1, fish: 'mackerel', cw: 0, best: {}, medals: {}, daily: { day: -1, best: 0 }, tips: 0, races: 0, wins: 0, finished: {}, slapRun: 0, scales: {}, xp: 0, look: { ...DEFAULTS }, feats: {}, goals: { day: -1, have: [0, 0, 0] }, streak: { day: -9, n: 0, best: 0 }, dailyRun: -1, seen: 1 };
}

function clean(p) {
  const out = blank();
  if (!p || typeof p !== 'object') return out;
  if (typeof p.fish === 'string' && FISH.some((f) => f.id === p.fish)) out.fish = p.fish;
  if (Number.isInteger(p.cw) && p.cw >= 0 && p.cw < COLOURWAY_COUNT) out.cw = p.cw;
  for (const c of COURSE_IDS) {
    const b = p.best?.[c];
    if (typeof b === 'number' && b > 5 && b < 600) out.best[c] = b;
    const m = p.medals?.[c];
    if (typeof m === 'string' && MEDAL_NAMES.includes(m)) out.medals[c] = m;
    if (p.finished?.[c] === true) out.finished[c] = true;
    const sc = p.scales?.[c];
    if (Array.isArray(sc)) out.scales[c] = [...new Set(sc.filter((n) => Number.isInteger(n) && n >= 0 && n < 3))].sort();
  }
  if (p.daily && Number.isInteger(p.daily.day) && typeof p.daily.best === 'number') out.daily = { day: p.daily.day, best: p.daily.best };
  for (const k of ['tips', 'races', 'wins', 'xp', 'dailyRun', 'seen']) if (Number.isInteger(p[k]) && p[k] >= 0 && p[k] < 1e9) out[k] = p[k];
  for (const slot of Object.keys(SLOTS)) if (typeof p.look?.[slot] === 'string' && SLOTS[slot][p.look[slot]]) out.look[slot] = p.look[slot];
  for (const f of Object.keys(GOALS)) if (p.feats?.[f] === true) out.feats[f] = true;
  if (Number.isInteger(p.goals?.day) && Array.isArray(p.goals.have) && p.goals.have.length === 3 && p.goals.have.every((n) => Number.isInteger(n) && n >= 0 && n < 1000)) out.goals = { day: p.goals.day, have: p.goals.have.slice() };
  const st = p.streak;
  if (st && Number.isInteger(st.day) && Number.isInteger(st.n) && Number.isInteger(st.best) && st.n >= 0 && st.best >= st.n) out.streak = { day: st.day, n: st.n, best: st.best };
  return out;
}

export function createProgress() {
  let data = blank();
  let saving = null;
  const api = {
    get data() {
      return data;
    },
    async load() {
      try {
        data = clean(await store().get(KEY));
      } catch {
        data = blank();
      }
      if (!api.unlocked(data.fish)) data.fish = 'mackerel';
      if (!api.cwOwned(data.cw)) data.cw = 0;
      for (const slot of Object.keys(SLOTS)) if (!api.owned(slot, data.look[slot])) data.look[slot] = DEFAULTS[slot];
      return data;
    },
    save() {
      if (saving) return;
      saving = setTimeout(async () => {
        saving = null;
        try {
          await store().set(KEY, data);
        } catch {}
      }, 300);
    },
    /** The golden scales already collected on a course (numbers 0..2). */
    scalesKept(course) {
      return data.scales[course]?.slice() ?? [];
    },
    /** Keep the scales a run took (in a trial or a race); returns the ones that are new. */
    keepScales(course, list) {
      if (!COURSE_IDS.includes(course)) return [];
      const had = data.scales[course] ?? [];
      const fresh = [...new Set(list)].filter((n) => Number.isInteger(n) && n >= 0 && n < 3 && !had.includes(n)).sort();
      if (fresh.length) {
        data.scales[course] = [...had, ...fresh].sort();
        api.save();
      }
      return fresh;
    },
    scaleCount() {
      return COURSE_IDS.reduce((n, c) => n + (data.scales[c]?.length ?? 0), 0);
    },
    /** Medals count one per tier earned on a course (a gold there is three). */
    medalCount() {
      let n = 0;
      for (const c of COURSE_IDS) n += { gold: 3, silver: 2, bronze: 1 }[data.medals[c]] ?? 0;
      return n;
    },
    golds() {
      return COURSE_IDS.filter((c) => data.medals[c] === 'gold').length;
    },
    tally() {
      const t = { gold: 0, silver: 0, bronze: 0 };
      for (const c of COURSE_IDS) if (data.medals[c]) t[data.medals[c]]++;
      return t;
    },
    unlocked(fishId) {
      const u = UNLOCKS[fishId];
      if (!u) return false;
      if (u.course && !data.finished[u.course]) return false;
      return api.medalCount() >= u.medals && api.golds() >= u.golds;
    },
    unlockText(fishId) {
      const u = UNLOCKS[fishId];
      if (!u) return '';
      if (u.course) return 'Finish the Fish Market';
      if (u.golds) return `${u.golds} gold medals`;
      return `${u.medals} medals`;
    },
    /** A course opens when the one before it is finished (in a trial or a race). */
    courseOpen(id) {
      const i = COURSE_IDS.indexOf(id);
      return i <= 0 || !!data.finished[COURSE_IDS[i - 1]];
    },
    setFish(id, cw) {
      if (!api.unlocked(id)) return;
      data.fish = id;
      data.cw = api.cwOwned(cw | 0) ? cw | 0 : 0;
      api.save();
    },
    // ---------------------------------------------------------------- the Catch level and what it gives
    level() {
      return levelOf(data.xp);
    },
    cwOwned(i) {
      return i >= 0 && i < COLOURWAY_COUNT && api.level().level >= COLOURWAY_LEVELS[i];
    },
    /** Does the player have this hat / trail / splash? */
    owned(slot, id) {
      const it = SLOTS[slot]?.[id];
      if (!it) return false;
      if (it.goal) return !!data.feats[it.goal];
      return api.level().level >= (it.level ?? 0);
    },
    /** How to get one: 'Level 6', or the feat. */
    howTo(slot, id) {
      const it = SLOTS[slot]?.[id];
      if (!it) return '';
      return it.goal ? GOALS[it.goal] : `Level ${it.level ?? 1}`;
    },
    wear(slot, id) {
      if (!api.owned(slot, id)) return;
      data.look[slot] = id;
      api.save();
    },
    /** The feats a page can check after a run (gold everywhere, every scale, a 7-day streak, Flow ×5). */
    checkFeats(run = {}) {
      const got = [];
      const feat = (id, ok) => {
        if (ok && !data.feats[id]) {
          data.feats[id] = true;
          got.push(id);
        }
      };
      feat('gold-kitchen', data.medals.kitchen === 'gold');
      feat('gold-all', COURSE_IDS.every((c) => data.medals[c] === 'gold'));
      feat('scales-all', COURSE_IDS.every((c) => (data.scales[c]?.length ?? 0) >= 3));
      feat('flow-max', (run.bestChain ?? 0) >= 5);
      feat('streak-7', data.streak.best >= 7);
      return got;
    },
    // ---------------------------------------------------------------- daily goals and the streak
    today(now = Date.now()) {
      return dayOf(now);
    },
    /** The day's goals with how far along they are: [{ ...goal, have, done }]. */
    goals(now = Date.now()) {
      const day = dayOf(now);
      if (data.goals.day !== day) data.goals = { day, have: [0, 0, 0] };
      const open = COURSE_IDS.filter((c) => api.courseOpen(c));
      return goalsFor(day, open).map((g, i) => ({ ...g, have: data.goals.have[i] ?? 0, done: (data.goals.have[i] ?? 0) >= g.need }));
    },
    streak(now = Date.now()) {
      return { n: liveStreak(data.streak, dayOf(now)), best: data.streak.best };
    },
    /**
     * A run is over (finished or not): goals, XP, level, rewards, feats. r: { course, finished, time, medal, place,
     * race, daily, drops, scales (count taken), newScales, oldScales, bestChain, perfects, close, springs }.
     * Returns { lines, total, before, after, rewards, goalsDone: [goal], streak, feats }.
     */
    addRun(r, now = Date.now()) {
      const day = dayOf(now);
      const goals = api.goals(now);
      const have = data.goals.have;
      const doneIdx = applyRun(goals, have, r);
      const goalsDone = doneIdx.map((i) => goals[i]);
      let streak = null;
      if (goalsDone.length) {
        const was = data.streak.n;
        data.streak = bumpStreak(data.streak, day);
        if (data.streak.n !== was || data.streak.day === day) streak = data.streak.n;
      }
      const dailyFirst = !!(r.daily && r.finished && data.dailyRun !== day);
      if (dailyFirst) data.dailyRun = day;
      const x = runXp({ ...r, place: r.race ? r.place : 0, dailyFirst });
      for (const g of goalsDone) x.lines.push([`Goal: ${g.text}`, XP.goal]);
      x.total += goalsDone.length * XP.goal;
      const before = levelOf(data.xp);
      data.xp += x.total;
      const after = levelOf(data.xp);
      const rewards = [];
      for (let l = before.level + 1; l <= after.level; l++) rewards.push(...rewardsAt(l).map((it) => ({ ...it, level: l })));
      const feats = api.checkFeats(r);
      for (const f of feats)
        for (const [slot, table] of Object.entries(SLOTS))
          for (const [id, it] of Object.entries(table)) if (it.goal === f) rewards.push({ slot, id, name: it.name, feat: GOALS[f] });
      api.save();
      return { lines: x.lines, total: x.total, before, after, rewards, goalsDone, streak, feats };
    },
    /** A finished run: returns { best, medal, newBest, newMedal, unlockedFish: [] }. */
    finish(course, seconds) {
      const before = FISH.filter((f) => api.unlocked(f.id)).map((f) => f.id);
      data.finished[course] = true;
      const old = data.best[course];
      const newBest = !(old > 0) || seconds < old;
      if (newBest) data.best[course] = Math.round(seconds * 1000) / 1000;
      const medal = medalFor(course, seconds);
      const order = { gold: 3, silver: 2, bronze: 1 };
      const newMedal = medal && (order[medal] ?? 0) > (order[data.medals[course]] ?? 0);
      if (newMedal) data.medals[course] = medal;
      api.save();
      const after = FISH.filter((f) => api.unlocked(f.id)).map((f) => f.id);
      return { best: data.best[course], medal, newBest, newMedal: newMedal ? medal : null, unlockedFish: after.filter((f) => !before.includes(f)) };
    },
    dailyFinish(day, seconds) {
      if (data.daily.day !== day) data.daily = { day, best: 0 };
      const newBest = !(data.daily.best > 0) || seconds < data.daily.best;
      if (newBest) data.daily.best = Math.round(seconds * 1000) / 1000;
      api.save();
      return newBest;
    },
    dailyBest(day) {
      return data.daily.day === day ? data.daily.best : 0;
    },
    async ghost(course) {
      try {
        const g = await store().get(`ghost-${course}`);
        return decodeGhost(g);
      } catch {
        return null;
      }
    },
    async saveGhost(course, track) {
      try {
        await store().set(`ghost-${course}`, encodeGhost(track));
      } catch {}
    },
  };
  return api;
}

// ---------------------------------------------------------------- ghosts: [t, x, y, z, yaw] at 8 Hz, delta-coded

export function encodeGhost(track) {
  if (!track || track.length < 2) return null;
  const q = (v) => Math.round(v * 100);
  const out = [];
  let px = 0, py = 0, pz = 0, ph = 0;
  for (const [, x, y, z, h] of track) {
    const X = q(x), Y = q(y), Z = q(z), H = Math.round(h * 100);
    out.push(X - px, Y - py, Z - pz, H - ph);
    px = X;
    py = Y;
    pz = Z;
    ph = H;
  }
  return { v: 1, hz: 8, d: out, end: track[track.length - 1][0] };
}

export function decodeGhost(g) {
  if (!g || g.v !== 1 || !Array.isArray(g.d) || g.d.length % 4 || g.d.length > 4 * 8 * 600) return null;
  const track = [];
  let x = 0, y = 0, z = 0, h = 0;
  for (let i = 0; i < g.d.length; i += 4) {
    const a = g.d[i], b = g.d[i + 1], c = g.d[i + 2], d = g.d[i + 3];
    if (![a, b, c, d].every((n) => Number.isInteger(n) && Math.abs(n) < 1e6)) return null;
    x += a;
    y += b;
    z += c;
    h += d;
    track.push([i / 4 / 8, x / 100, y / 100, z / 100, h / 100]);
  }
  return track;
}

/** Where a ghost is at time t (linear between samples). */
export function ghostAt(track, t, out = {}) {
  if (!track?.length) return null;
  const f = Math.max(0, t) * 8;
  const i = Math.min(track.length - 1, Math.floor(f));
  const j = Math.min(track.length - 1, i + 1);
  const k = Math.min(1, f - i);
  const a = track[i], b = track[j];
  out.x = a[1] + (b[1] - a[1]) * k;
  out.y = a[2] + (b[2] - a[2]) * k;
  out.z = a[3] + (b[3] - a[3]) * k;
  out.h = a[4] + (b[4] - a[4]) * k;
  out.vy = (b[2] - a[2]) * 8;
  out.done = f >= track.length - 1;
  return out;
}

// ---------------------------------------------------------------- badges and boards (fire and forget, never throw)

export function award(key) {
  try {
    ow?.badges?.award?.(key)?.catch?.(() => {});
  } catch {}
}

export function submitTime(board, seconds) {
  try {
    return ow?.leaderboards?.submit?.(board, Math.round(seconds * 10) / 10, { lowerIsBetter: true })?.catch?.(() => null) ?? Promise.resolve(null);
  } catch {
    return Promise.resolve(null);
  }
}
