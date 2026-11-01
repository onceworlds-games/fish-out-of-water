// Every course: it builds, a fish settles on the start, bots of every skill reach the sea, the medal times fit, and
// the hazards are fair (same on every page, warned before they strike).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP } from '../src/sim/config.js';
import { createBody, stepBody } from '../src/sim/body.js';
import { getCourse, COURSE_IDS } from '../src/sim/courses/index.js';
import { createHazards } from '../src/sim/hazards.js';
import { runBot } from '../src/sim/run.js';
import { MEDALS } from '../src/sim/race.js';

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

for (const id of COURSE_IDS) {
  test(`${id}: every start slot settles on the ice`, () => {
    const c = getCourse(id);
    const env = { world: c.world, hazards: null, t: 0 };
    assert.ok(c.slots.length >= 8);
    for (const slot of c.slots) {
      const b = createBody('mackerel', slot, c.start.yaw);
      for (let t = 0; t < 1.5; t += STEP) stepBody(b, { hold: false, yaw: c.start.yaw }, env);
      assert.equal(b.state, 'ok');
      assert.ok(b.ground, `slot ${slot} is on the ground`);
      assert.ok(Math.abs(b.y - slot[1]) < 0.3, `slot ${slot} settled at ${b.y}`);
    }
  });

  test(`${id}: bots of every skill reach the sea, and the medals fit them`, () => {
    const c = getCourse(id);
    const m = MEDALS[id];
    assert.ok(m && m.gold < m.silver && m.silver < m.bronze);
    const runs = (skill, personality, route = 'spine', n = 5) =>
      Array.from({ length: n }, (_, seed) => runBot(c, { skill, seed, route, personality, max: 240 }));
    const best = [...runs(1, 'steady', 'spine', 4), ...runs(1, 'steady', 'expert', 4)];
    const good = runs(0.8, 'steady');
    const fair = runs(0.55, 'steady');
    const slow = [...runs(0.3, 'careful', 'spine', 3), ...runs(0.3, 'wobbly', 'spine', 3)];
    for (const r of [...best, ...good, ...fair, ...slow]) assert.ok(r.finished, `a bot stopped at ${r.progress?.toFixed(0)} m (${r.x?.toFixed(1)}, ${r.z?.toFixed(1)})`);
    const t = (rs) => rs.map((r) => r.time);
    // gold takes a near-perfect run; a fair player gets silver some of the time; everyone who keeps going gets bronze
    assert.ok(Math.min(...t(best)) < m.gold, `best ${Math.min(...t(best)).toFixed(1)} vs gold ${m.gold}`);
    assert.ok(median(t(good)) > m.gold * 0.85, `skilled bots take gold too easily (${median(t(good)).toFixed(1)})`);
    assert.ok(median(t(fair)) < m.silver * 1.25, `silver is out of reach (${median(t(fair)).toFixed(1)} vs ${m.silver})`);
    assert.ok(median(t(slow)) < m.bronze * 1.25, `bronze is out of reach (${median(t(slow)).toFixed(1)} vs ${m.bronze})`);
  });

  test(`${id}: hazards are the same on every page and warn before they strike`, () => {
    const c = getCourse(id);
    const a = createHazards(c, 42), b = createHazards(c, 42);
    for (const t of [0, 1.3, 7.77, 33.1, 95.05]) assert.deepEqual(JSON.parse(JSON.stringify(a.at(t))), JSON.parse(JSON.stringify(b.at(t))));
    for (const h of a.list) {
      const warn = h.kind === 'gull' ? h.dive : h.kind === 'boules' ? h.wind : h.kind === 'cat' || h.kind === 'chef' ? h.tele : null;
      if (warn !== null) assert.ok(warn >= 0.8, `${h.id} warns for only ${warn} s`);
    }
  });
}

test('the gentle start: no hazard reaches a fish in the first metres', () => {
  for (const id of COURSE_IDS) {
    const c = getCourse(id);
    const hz = createHazards(c, 1, { gentle: c.gentle });
    const b = createBody('mackerel', [c.start.x, c.start.y, c.start.z + 2], 0);
    b.hits = {};
    for (let t = 0; t < 20; t += 0.05) hz.affect(b, t);
    assert.equal(b.events.length, 0);
  }
});
