// The Catch: XP for a run, levels and what they give, the day's goals (the same for everyone), the streak, and the save
// that keeps it all (scales collected, looks worn) and survives a broken or hostile save.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XP, toNext, levelOf, runXp, rewardsAt, nextReward, goalsFor, applyRun, bumpStreak, liveStreak, GOAL_KINDS } from '../src/catch.js';
import { HATS, TRAILS, SPLASHES, COLOURWAY_LEVELS } from '../src/cosmetics.js';
import { COURSE_IDS } from '../src/sim/courses/index.js';

// progress.js saves through localStorage on a page on its own
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { createProgress } = await import('../src/progress.js');

test('levels fill in order and every level up to 30 is reachable', () => {
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: toNext(1) });
  assert.equal(levelOf(toNext(1)).level, 2);
  assert.equal(levelOf(toNext(1) - 1).level, 1);
  let xp = 0;
  for (let l = 1; l < 30; l++) xp += toNext(l);
  assert.equal(levelOf(xp).level, 30);
  assert.equal(levelOf(xp).into, 0);
  // a good run is a real step but not a level a run
  const good = runXp({ finished: true, medal: 'gold', drops: 30, newScales: 0, oldScales: 2, bestChain: 5, perfects: 6, close: 2 }).total;
  assert.ok(good > 100 && good < toNext(3), `a good run is worth ${good}`);
});

test('every cosmetic with a level is given by exactly one level, and the next reward is found', () => {
  const seen = new Set();
  for (let l = 1; l <= 40; l++) for (const r of rewardsAt(l)) seen.add(`${r.slot}:${r.id}`);
  for (const [slot, table] of [['hat', HATS], ['trail', TRAILS], ['splash', SPLASHES]])
    for (const [id, it] of Object.entries(table)) if (it.level) assert.ok(seen.has(`${slot}:${id}`), `${slot} ${id}`);
  COLOURWAY_LEVELS.forEach((l, i) => i > 0 && assert.ok(seen.has(`colourway:${i}`)));
  assert.equal(nextReward(1).level, 2);
  assert.ok(nextReward(1).rewards.some((r) => r.id === 'bucket'));
});

test('a run is worth its parts, in the order shown, nothing for what it lacked', () => {
  const r = runXp({ finished: true, place: 1, medal: 'silver', drops: 12, newScales: 1, oldScales: 1, bestChain: 7, perfects: 2, close: 0 });
  const by = Object.fromEntries(r.lines);
  assert.equal(by['Back in the sea'], XP.finish);
  assert.equal(by['1st place'], XP.place[0]);
  assert.equal(by['Silver time'], XP.medal.silver);
  assert.equal(by['Drops ×12'], 12);
  assert.equal(by['New golden scale'], XP.newScale);
  assert.equal(by['Flow ×7'], 5 * XP.flowLink); // capped at the chain's five links
  assert.ok(!r.lines.some(([l]) => l.startsWith('Close')));
  assert.equal(r.total, r.lines.reduce((n, l) => n + l[1], 0));
  assert.equal(runXp({ finished: false, drops: 0 }).total, 0);
});

test('the day has three different goals, the same for everyone, easy to hard, one course goal at most', () => {
  for (let day = 20000; day < 20200; day++) {
    const g = goalsFor(day);
    assert.equal(g.length, 3);
    assert.equal(new Set(g.map((x) => x.kind)).size, 3);
    assert.deepEqual(goalsFor(day), g);
    assert.ok(g.filter((x) => x.course).length <= 1);
    for (const x of g) {
      assert.ok(GOAL_KINDS.includes(x.kind));
      assert.ok(x.need >= 1 && x.text.length > 4);
      if (x.course) assert.ok(COURSE_IDS.includes(x.course));
    }
  }
  // a course goal only ever names a course the player can run
  for (let day = 20000; day < 20100; day++) for (const x of goalsFor(day, ['market'])) if (x.course) assert.equal(x.course, 'market');
});

test('goals count up across runs (or take a best), and finish once', () => {
  const goals = [
    { id: 'a', kind: 'drops', need: 30 },
    { id: 'b', kind: 'flow', need: 4 },
    { id: 'c', kind: 'silver', need: 1, course: 'market' },
  ];
  const have = [0, 0, 0];
  assert.deepEqual(applyRun(goals, have, { course: 'market', finished: true, time: 999, drops: 18, bestChain: 3 }), []);
  assert.deepEqual(have, [18, 3, 0]);
  assert.deepEqual(applyRun(goals, have, { course: 'kitchen', finished: true, time: 1, drops: 15, bestChain: 4 }), [0, 1]);
  assert.deepEqual(have, [30, 4, 0]);
  assert.deepEqual(applyRun(goals, have, { course: 'market', finished: true, time: 30, drops: 5, bestChain: 5 }), [2]);
  assert.deepEqual(have, [30, 4, 1]);
  assert.deepEqual(applyRun(goals, have, { course: 'market', finished: true, time: 30, drops: 50, bestChain: 5 }), []);
});

test('the streak grows a day at a time and starts again after a missed day', () => {
  let s = bumpStreak(null, 100);
  assert.deepEqual(s, { day: 100, n: 1, best: 1 });
  s = bumpStreak(s, 100);
  assert.equal(s.n, 1);
  s = bumpStreak(s, 101);
  s = bumpStreak(s, 102);
  assert.deepEqual(s, { day: 102, n: 3, best: 3 });
  assert.equal(liveStreak(s, 103), 3); // still alive until the day is over
  assert.equal(liveStreak(s, 104), 0);
  s = bumpStreak(s, 105);
  assert.deepEqual(s, { day: 105, n: 1, best: 3 });
});

test('a run in the save: XP, levels, rewards, goals, the streak, scales kept once', async () => {
  store.clear();
  const p = createProgress();
  await p.load();
  const day = 20500;
  const now = day * 86400000 + 3600000;
  assert.deepEqual(p.scalesKept('market'), []);
  assert.deepEqual(p.keepScales('market', [2, 0, 2]), [0, 2]);
  assert.deepEqual(p.keepScales('market', [0, 1]), [1]);
  assert.deepEqual(p.scalesKept('market'), [0, 1, 2]);
  assert.deepEqual(p.keepScales('nowhere', [0]), []);
  const goals = p.goals(now);
  // a run that does everything at once
  const r = p.addRun({ course: 'market', finished: true, time: 20, medal: 'gold', race: true, place: 1, drops: 80, scales: 3, newScales: 3, oldScales: 0, bestChain: 5, perfects: 6, close: 5, springs: 10 }, now);
  assert.ok(r.total > 0);
  assert.equal(r.before.level, 1);
  assert.ok(r.after.level >= 2);
  assert.ok(r.rewards.some((x) => x.id === 'bucket'));
  assert.ok(r.rewards.some((x) => x.id === 'gold' && x.feat), 'Flow ×5 gives the gold-leaf trail');
  // one run can't make several runs or races; everything else it does here
  assert.equal(r.goalsDone.length, goals.filter((g) => !['runs', 'races'].includes(g.kind)).length);
  if (r.goalsDone.length) assert.equal(p.streak(now).n, 1);
  assert.ok(p.owned('hat', 'bucket'));
  assert.ok(!p.owned('hat', 'crown'));
  assert.ok(p.owned('trail', 'gold'));
  p.wear('hat', 'bucket');
  p.wear('hat', 'crown'); // not owned: ignored
  assert.equal(p.data.look.hat, 'bucket');
  // it all comes back from the save
  await new Promise((res) => setTimeout(res, 350));
  const q = createProgress();
  await q.load();
  assert.equal(q.data.xp, p.data.xp);
  assert.equal(q.data.look.hat, 'bucket');
  assert.deepEqual(q.scalesKept('market'), [0, 1, 2]);
});

test('a broken or hostile save loads as a clean one', async () => {
  store.clear();
  store.set('fish-out-of-water:profile', JSON.stringify({ xp: -5, cw: 9, look: { hat: 'crown', trail: '<b>', splash: 7 }, scales: { market: [0, 5, 'x', 1, 1], kitchen: 'all' }, feats: { 'gold-all': 'yes' }, goals: { day: 3, have: [1, 2] }, streak: { day: 1, n: 50, best: 2 } }));
  const p = createProgress();
  await p.load();
  assert.equal(p.data.xp, 0);
  assert.equal(p.data.cw, 0);
  assert.equal(p.data.look.hat, 'none'); // the crown needs gold everywhere
  assert.equal(p.data.look.trail, 'drips');
  assert.deepEqual(p.scalesKept('market'), [0, 1]);
  assert.deepEqual(p.scalesKept('kitchen'), []);
  assert.deepEqual(p.data.feats, {});
  assert.equal(p.data.goals.day, -1);
  assert.equal(p.data.streak.n, 0);
  store.set('fish-out-of-water:profile', '{not json');
  await p.load();
  assert.equal(p.data.xp, 0);
});
