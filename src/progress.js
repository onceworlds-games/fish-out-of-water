// The player's own saves: fish, bests, medals, ghosts, the daily, badge counters. Saved with onceworlds.save (local
// storage on a page on its own). Everything read back is checked: a save from an older version must never break a page.

import { FISH, UNLOCKS } from './sim/config.js';
import { COURSE_IDS } from './sim/courses/index.js';
import { medalFor, MEDAL_NAMES } from './sim/race.js';

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
  return { v: 1, fish: 'mackerel', cw: 0, best: {}, medals: {}, daily: { day: -1, best: 0 }, tips: 0, races: 0, wins: 0, finished: {}, slapRun: 0 };
}

function clean(p) {
  const out = blank();
  if (!p || typeof p !== 'object') return out;
  if (typeof p.fish === 'string' && FISH.some((f) => f.id === p.fish)) out.fish = p.fish;
  if (Number.isInteger(p.cw) && p.cw >= 0 && p.cw < 3) out.cw = p.cw;
  for (const c of COURSE_IDS) {
    const b = p.best?.[c];
    if (typeof b === 'number' && b > 5 && b < 600) out.best[c] = b;
    const m = p.medals?.[c];
    if (typeof m === 'string' && MEDAL_NAMES.includes(m)) out.medals[c] = m;
    if (p.finished?.[c] === true) out.finished[c] = true;
  }
  if (p.daily && Number.isInteger(p.daily.day) && typeof p.daily.best === 'number') out.daily = { day: p.daily.day, best: p.daily.best };
  for (const k of ['tips', 'races', 'wins']) if (Number.isInteger(p[k]) && p[k] >= 0) out[k] = p[k];
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
      data.cw = Math.max(0, Math.min(2, cw | 0));
      api.save();
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
