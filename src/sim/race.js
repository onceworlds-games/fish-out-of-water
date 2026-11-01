// Cups, medals, the daily catch and how times read. Pure: the page, the host and the tests share it.

import { COURSE_IDS } from './courses/index.js';
import { hashString, mulberry32 } from './rng.js';
import { TWISTS } from './config.js';

export const CUPS = {
  harbour: { name: 'Harbour Cup', courses: ['market', 'kitchen', 'beach'] },
  seaside: { name: 'Seaside Cup', courses: ['beach', 'park', 'market'] },
  tour: { name: 'Grand Tour', courses: null },
};

/** The courses of a cup, in race order (the Grand Tour shuffles every course by the match's seed). */
export function cupCourses(cup, seed = 0) {
  const def = CUPS[cup] ?? CUPS.harbour;
  let list = def.courses ? def.courses.filter((c) => COURSE_IDS.includes(c)) : [...COURSE_IDS];
  if (!def.courses) {
    const r = mulberry32(hashString(`tour:${seed}`));
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  if (!list.length) list = [COURSE_IDS[0]];
  return list;
}

// Medal times (seconds) per course: from the bot sims (see test/balance.test.mjs), rounded to a half second.
// gold ≈ a sharp bot's median × 1.06, silver ≈ a middling bot's, bronze ≈ a clumsy bot's × 1.1.
export const MEDALS = {
  market: { gold: 21, silver: 38, bronze: 65 },
  kitchen: { gold: 26, silver: 40, bronze: 80 },
  beach: { gold: 50, silver: 85, bronze: 160 },
  park: { gold: 42, silver: 75, bronze: 130 },
};

export const MEDAL_NAMES = ['gold', 'silver', 'bronze'];

/** The best medal a time earns on a course: 'gold' | 'silver' | 'bronze' | null. */
export function medalFor(course, seconds) {
  const m = MEDALS[course];
  if (!m || !(seconds > 0)) return null;
  for (const k of MEDAL_NAMES) if (seconds <= m[k]) return k;
  return null;
}

/** The next medal to chase after a best time: { medal, time } or null when gold is in. */
export function nextMedal(course, best) {
  const m = MEDALS[course];
  if (!m) return null;
  for (const k of ['bronze', 'silver', 'gold']) if (!(best > 0) || best > m[k]) return { medal: k, time: m[k] };
  return null;
}

/** "0:42.3" (or "1:05.0"). */
export function fmtTime(seconds, tenths = true) {
  if (!(seconds >= 0)) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const whole = Math.floor(s);
  const t = Math.floor((s - whole) * 10);
  return `${m}:${String(whole).padStart(2, '0')}${tenths ? `.${t}` : ''}`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Today's catch: one course and one twist, the same for everyone (UTC day). */
export function dailyCatch(dayMs = Date.now()) {
  const day = Math.floor(dayMs / 86400000);
  const r = mulberry32(hashString(`daily:${day}`));
  const course = COURSE_IDS[Math.floor(r() * COURSE_IDS.length)];
  const keys = Object.keys(TWISTS);
  const twistId = keys[Math.floor(r() * keys.length)];
  return { day, course, twistId, twist: twistOf(twistId, day) };
}

/** A twist in the form stepBody reads: wind (m/s² across), friction scale, drain scale. */
export function twistOf(id, seed = 0) {
  const t = TWISTS[id];
  if (!t) return { id: null, wind: [0, 0], friction: 1, drain: 1 };
  const r = mulberry32(hashString(`wind:${seed}`));
  const a = r() * Math.PI * 2;
  const w = t.wind ?? 0;
  return { id, name: t.name, wind: [Math.sin(a) * w, Math.cos(a) * w], friction: t.friction ?? 1, drain: t.drain ?? 1 };
}

export const NO_TWIST = twistOf(null);
