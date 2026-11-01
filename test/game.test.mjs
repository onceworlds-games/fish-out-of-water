// The race around the sim: cups, medals, ghosts, presence from other pages, and finishes only the host can accept.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUPS, cupCourses, medalFor, nextMedal, MEDALS } from '../src/sim/race.js';
import { COURSE_IDS, getCourse } from '../src/sim/courses/index.js';
import { encodeGhost, decodeGhost, ghostAt } from '../src/progress.js';
import { readPresence, stubRoom, createCup } from '../src/net.js';
import { runBot } from '../src/sim/run.js';

test('cups run their courses in order; the Grand Tour shuffles all of them by seed', () => {
  assert.deepEqual(cupCourses('harbour', 5), CUPS.harbour.courses);
  assert.deepEqual(cupCourses('seaside', 5), CUPS.seaside.courses);
  const a = cupCourses('tour', 7), b = cupCourses('tour', 7);
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort(), [...COURSE_IDS].sort());
  const orders = new Set(Array.from({ length: 12 }, (_, s) => cupCourses('tour', s).join()));
  assert.ok(orders.size > 3);
  assert.deepEqual(cupCourses('nonsense', 1), CUPS.harbour.courses);
  for (const c of Object.values(CUPS)) for (const id of c.courses ?? []) assert.ok(COURSE_IDS.includes(id), id);
});

test('medals and the next one to chase', () => {
  const m = MEDALS.market;
  assert.equal(medalFor('market', m.gold - 0.1), 'gold');
  assert.equal(medalFor('market', m.silver), 'silver');
  assert.equal(medalFor('market', m.bronze + 0.1), null);
  assert.equal(medalFor('market', NaN), null);
  assert.deepEqual(nextMedal('market', 0), { medal: 'bronze', time: m.bronze });
  assert.deepEqual(nextMedal('market', m.silver - 1), { medal: 'gold', time: m.gold });
  assert.equal(nextMedal('market', m.gold - 1), null);
});

test('a ghost survives its trip through a save', () => {
  const r = runBot(getCourse('kitchen'), { skill: 1, seed: 2, track: true });
  const g = encodeGhost(r.track);
  const back = decodeGhost(JSON.parse(JSON.stringify(g)));
  assert.equal(back.length, r.track.length);
  for (let i = 0; i < back.length; i += 17) for (let k = 1; k < 5; k++) assert.ok(Math.abs(back[i][k] - r.track[i][k]) < 0.011);
  const p = ghostAt(back, 3.3);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
  assert.equal(decodeGhost({ v: 1, d: [1, 2, 3] }), null);
  assert.equal(decodeGhost({ v: 1, d: [1, 2, 'x', 4] }), null);
  assert.equal(decodeGhost({ v: 2, d: [] }), null);
  assert.equal(decodeGhost(null), null);
});

test('presence from another page is read defensively', () => {
  assert.equal(readPresence(null), null);
  assert.equal(readPresence({ x: 'a', y: 0, z: 0 }), null);
  assert.equal(readPresence({ x: Infinity, y: 0, z: 0 }), null);
  const p = readPresence({ x: 120, y: 50, z: 900, c: 1e9, m: -5, s: 99, r: 'x'.repeat(500), n: 3.7, f: 2 });
  assert.equal(p.x, 1.2);
  assert.equal(p.z, 9);
  assert.equal(p.c, 0);
  assert.equal(p.m, 100);
  assert.equal(p.s, 0);
  assert.equal(p.r, '');
  assert.equal(p.n, 4);
  assert.equal(p.f, 2);
});

test('the host only takes a finish for this race, on the clock', async () => {
  const room = stubRoom();
  let len = 200;
  const cup = createCup(room, { courseLength: () => len });
  const warn = console.warn;
  console.warn = () => {};
  try {
    room.setReady(true);
    const until = Date.now() + 9000;
    while (cup.match.phase !== 'round' && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
    assert.equal(cup.match.phase, 'round');
    const fin = () => Object.keys(cup.match.data.fin).length;
    const wait = () => new Promise((r) => setTimeout(r, 600));
    cup.finish(cup.match.roundId, 1000); // faster than any fish can flop the course
    await wait();
    cup.finish('an-old-race', 30000);
    await wait();
    cup.finish(cup.match.roundId, 120000); // two minutes ahead of the race clock
    await wait();
    assert.equal(fin(), 0);
    len = 1;
    cup.finish(cup.match.roundId, cup.match.elapsed);
    await wait();
    assert.equal(fin(), 1);
    cup.finish(cup.match.roundId, cup.match.elapsed); // only once
    await wait();
    assert.equal(fin(), 1);
  } finally {
    console.warn = warn;
    cup.bots.dispose?.();
    cup.match.dispose?.();
    cup.host.dispose?.();
    room._emit('close');
  }
});
