// The Catch: what a run is worth (XP), the levels it fills and what each level gives, and the three daily goals (the
// same for everyone on a day) with the day streak. Pure: no page, no saves (progress.js keeps the numbers).

import { HATS, TRAILS, SPLASHES, COLOURWAY_LEVELS } from './cosmetics.js';
import { COURSE_IDS } from './sim/courses/index.js';
import { MEDALS } from './sim/race.js';
import { mulberry32 } from './sim/rng.js';

export const XP = {
  finish: 40,
  medal: { bronze: 20, silver: 40, gold: 70 },
  place: [60, 40, 25, 15, 10, 10, 10, 10],
  drop: 1,
  newScale: 50,
  oldScale: 5,
  flowLink: 4, // per link of the best chain
  perfect: 3,
  close: 5,
  goal: 100,
  dailyFirst: 30,
};

/** XP to go from level L to L+1. */
export const toNext = (level) => 150 + 50 * (level - 1);

/** The level and the progress into it for a total of XP. */
export function levelOf(xp) {
  let level = 1;
  let left = Math.max(0, Math.floor(xp));
  while (left >= toNext(level) && level < 99) {
    left -= toNext(level);
    level++;
  }
  return { level, into: left, need: toNext(level) };
}

/**
 * What one finished run is worth. run: { finished, medal, place (races), drops, newScales, oldScales, bestChain,
 * perfects, close, daily, dailyFirst }. Returns { total, lines: [[label, xp]] } (lines in the order shown).
 */
export function runXp(run) {
  const lines = [];
  const add = (label, xp) => {
    if (xp > 0) lines.push([label, xp]);
  };
  if (run.finished) add('Back in the sea', XP.finish);
  if (run.place) add(placeLabel(run.place), XP.place[Math.min(XP.place.length - 1, run.place - 1)] ?? 10);
  if (run.medal) add(`${run.medal[0].toUpperCase()}${run.medal.slice(1)} time`, XP.medal[run.medal] ?? 0);
  add(`Drops ×${run.drops ?? 0}`, (run.drops ?? 0) * XP.drop);
  add(`New golden scale${(run.newScales ?? 0) > 1 ? 's' : ''}`, (run.newScales ?? 0) * XP.newScale);
  add('Scales again', (run.oldScales ?? 0) * XP.oldScale);
  add(`Flow ×${run.bestChain ?? 0}`, Math.min(5, run.bestChain ?? 0) * XP.flowLink);
  add(`Perfect slaps ×${run.perfects ?? 0}`, Math.min(20, run.perfects ?? 0) * XP.perfect);
  add(`Close shaves ×${run.close ?? 0}`, Math.min(10, run.close ?? 0) * XP.close);
  if (run.dailyFirst) add("Today's Daily Catch", XP.dailyFirst);
  return { total: lines.reduce((n, l) => n + l[1], 0), lines };
}

const placeLabel = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} place`;

/** Everything a level gives: [{ slot, id, name }] (slot: hat | trail | splash | colourway). */
export function rewardsAt(level) {
  const out = [];
  for (const [slot, table] of [['hat', HATS], ['trail', TRAILS], ['splash', SPLASHES]])
    for (const [id, it] of Object.entries(table)) if (it.level === level) out.push({ slot, id, name: it.name });
  COLOURWAY_LEVELS.forEach((l, i) => {
    if (i > 0 && l === level) out.push({ slot: 'colourway', id: String(i), name: `Colourway ${i + 1}` });
  });
  return out;
}

/** The next level (above `level`) that gives something, and what. */
export function nextReward(level) {
  for (let l = level + 1; l <= 40; l++) {
    const r = rewardsAt(l);
    if (r.length) return { level: l, rewards: r };
  }
  return null;
}

// ---------------------------------------------------------------- daily goals

/** The day number (UTC) for a date. */
export const dayOf = (ms) => Math.floor(ms / 86400000);

const COURSE_NAMES = { market: 'the Fish Market', kitchen: 'the Kitchen', beach: 'the Beach', park: 'the Park' };

/**
 * The goal kinds. `need`: the target; `measure(r)`: what a finished run adds (count goals) or reaches (best goals).
 * r: { course, finished, time, drops, scales, bestChain, perfects, close, springs, place, race }
 */
const KINDS = {
  drops: { mode: 'count', text: (n) => `Take ${n} drops`, need: [30, 45, 60], measure: (r) => r.drops },
  flow: { mode: 'best', text: (n) => `Reach Flow ×${n}`, need: [3, 4, 5], measure: (r) => r.bestChain },
  perfects: { mode: 'best', text: (n) => `${n} perfect slaps in one run`, need: [2, 3, 5], measure: (r) => r.perfects },
  close: { mode: 'count', text: (n) => `${n} close shaves`, need: [2, 3, 4], measure: (r) => r.close },
  springs: { mode: 'count', text: (n) => `Boing off ${n} springy things`, need: [3, 5, 8], measure: (r) => r.springs },
  runs: { mode: 'count', text: (n) => `Finish ${n} runs`, need: [3, 4, 5], measure: (r) => (r.finished ? 1 : 0) },
  races: { mode: 'count', text: (n) => `Race ${n} times`, need: [2, 3, 3], measure: (r) => (r.race && r.finished ? 1 : 0) },
  podium: { mode: 'count', text: () => 'Finish a race in the top 3', need: [1, 1, 1], measure: (r) => (r.race && r.place && r.place <= 3 ? 1 : 0) },
  scale: { mode: 'count', text: () => 'Take a golden scale', need: [1, 1, 1], measure: (r) => r.scales },
  silver: { mode: 'count', text: (n, c) => `Silver time or better in ${COURSE_NAMES[c]}`, need: [1, 1, 1], course: true, measure: (r, g) => (r.course === g.course && r.finished && r.time <= MEDALS[g.course].silver ? 1 : 0) },
  dry: { mode: 'count', text: (n, c) => `Finish ${COURSE_NAMES[c]}`, need: [1, 1, 1], course: true, measure: (r, g) => (r.course === g.course && r.finished ? 1 : 0) },
};
export const GOAL_KINDS = Object.keys(KINDS);

/**
 * The day's three goals (the same for everyone who has the same courses open): [{ id, kind, need, course, text }].
 * `open`: the courses this player can run (a course goal picks among them).
 */
export function goalsFor(day, open = COURSE_IDS) {
  const courses = open.length ? open : COURSE_IDS.slice(0, 1);
  const rnd = mulberry32((day * 2654435761) >>> 0);
  const pool = [...GOAL_KINDS];
  const out = [];
  while (out.length < 3 && pool.length) {
    const k = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    // one course goal a day at most
    if (KINDS[k].course && out.some((g) => KINDS[g.kind].course)) continue;
    const tier = out.length; // easy, medium, hard
    const need = KINDS[k].need[tier];
    const pick = rnd();
    const course = KINDS[k].course ? courses[Math.floor(pick * courses.length)] : null;
    out.push({ id: `${day}-${k}`, kind: k, need, course, text: KINDS[k].text(need, course) });
  }
  return out;
}

/** Apply a finished (or abandoned) run to the day's goals. state: { day, have: [n, n, n] }. Returns indexes just done. */
export function applyRun(goals, have, r) {
  const done = [];
  goals.forEach((g, i) => {
    const k = KINDS[g.kind];
    const before = have[i] ?? 0;
    if (before >= g.need) return;
    const m = Math.max(0, Number(k.measure(r, g)) || 0);
    have[i] = Math.min(g.need, k.mode === 'best' ? Math.max(before, m) : before + m);
    if (have[i] >= g.need) done.push(i);
  });
  return done;
}

/** The streak after a day with a goal done: { day, n, best }. A missed day starts again from one. */
export function bumpStreak(streak, day) {
  const s = { day: streak?.day ?? -9, n: streak?.n ?? 0, best: streak?.best ?? 0 };
  if (s.day === day) return s;
  s.n = s.day === day - 1 ? s.n + 1 : 1;
  s.day = day;
  s.best = Math.max(s.best, s.n);
  return s;
}

/** The streak as it stands today (0 when the last day with a goal was before yesterday). */
export const liveStreak = (streak, day) => (streak && (streak.day === day || streak.day === day - 1) ? streak.n : 0);
