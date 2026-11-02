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

// Every golden scale can be reached: some flop or slap from a point a fish can stand on (route points, drops, water)
// passes through it.
for (const id of COURSE_IDS) {
  test(`${id}: every golden scale can be reached`, async () => {
    const { predictArc } = await import('../src/sim/body.js');
    const { SCALES, BODY_RADIUS } = await import('../src/sim/config.js');
    const c = getCourse(id);
    const w = c.world;
    const scales = c.builder.items.filter((i) => i.kind === 'scale');
    assert.equal(scales.length, 3, `${id} has three scales`);
    const froms = [...c.spine, ...(c.expert ?? []), ...c.builder.items.filter((i) => i.kind === 'drop').map((i) => [i.p[0], i.p[1] - 0.3, i.p[2]]), ...c.builder.zones.filter((z) => z.rate).map((z) => z.c)];
    const reach = (s) => {
      for (const f of froms) {
        const dx = s.p[0] - f[0], dz = s.p[2] - f[2];
        if (Math.hypot(dx, dz) > 11) continue;
        const body = createBody('mackerel', [f[0], f[1] + 0.17, f[2]], 0);
        const surf = w.query(f[0], f[1] + 0.05, f[2], 0.3)[0]?.surf ?? 'sand';
        for (const dy of [-0.15, 0, 0.15])
          for (let ch = 0; ch <= 1.0001; ch += 0.1)
            for (const mode of ['flop', 'slap5']) {
              const from = mode === 'flop' ? null : { x: f[0], y: f[1] + 0.17, z: f[2], vel: [0, 0], slap: true, chain: 5, surf };
              const pts = [];
              body.ground = true;
              predictArc(body, w, Math.atan2(dx, dz) + dy, ch, undefined, { dt: 1 / 120, every: 1, points: pts, from, maxT: 3 });
              for (let k = 0; k < pts.length; k += 3) {
                const ex = pts[k] - s.p[0], ey = pts[k + 1] - s.p[1], ez = pts[k + 2] - s.p[2];
                if (ex * ex + ey * ey + ez * ez < (SCALES.radius + BODY_RADIUS) ** 2) return true;
              }
            }
      }
      return false;
    };
    for (const s of scales) assert.ok(reach(s), `${id} scale ${s.n} at (${s.p.map((v) => v.toFixed(1))}) can't be reached`);
  });
}

test('the blowhole throws a fish clear: nobody hovers in the spout', () => {
  const c = getCourse('beach');
  const z = c.builder.zones.find((q) => q.kind === 'updraft' && q.look === 'blowhole');
  assert.ok(z, 'the beach has a blowhole');
  const env = { world: c.world, hazards: null, t: 0 };
  // dropped dead centre with no speed at all, from just above the vent
  const b = createBody('mackerel', [z.c[0], z.c[1] + 0.6, z.c[2]], 0);
  b.ground = false;
  let inside = 0;
  for (let t = 0; t < 6; t += STEP) {
    stepBody(b, { hold: false, yaw: 0 }, env);
    if (Math.hypot(b.x - z.c[0], b.z - z.c[2]) < z.r && b.y > z.c[1] + 0.3) inside += STEP;
  }
  assert.ok(inside < 2.5, `the fish hung in the spout for ${inside.toFixed(1)} s`);
  assert.ok(Math.hypot(b.x - z.c[0], b.z - z.c[2]) > z.r, 'and landed outside it');
});

test('a slap on something springy goes higher than one on sand', async () => {
  const { predictArc } = await import('../src/sim/body.js');
  const c = getCourse('beach');
  const top = (surf) => {
    const body = createBody('mackerel', [0, 20.17, 0], 0);
    body.ground = true;
    const pts = [];
    predictArc(body, c.world, 0, 1, undefined, { dt: 1 / 120, every: 1, points: pts, from: { x: 0, y: 20.17, z: 0, vel: [0, 0], slap: true, chain: 0, surf }, maxT: 2 });
    let m = -Infinity;
    for (let k = 1; k < pts.length; k += 3) m = Math.max(m, pts[k]);
    return m - 20.17;
  };
  assert.ok(top('bounce') > top('sand') * 1.15, `springy ${top('bounce').toFixed(2)} vs sand ${top('sand').toFixed(2)}`);
});

test('the kitchen holds every fish: no leap goes out through its ceiling, hood, lamps or lintels', () => {
  const c = getCourse('kitchen');
  const env = { world: c.world, hazards: null, t: 0 };
  // thrown straight up harder than any slap chain, from the floor, the pan shelf, the pass and a doorway
  for (const [x, y, z] of [[0, 0.2, 20], [-5.45, 2.1, 70], [0, 1.25, 110], [0, 0.2, 96.4], [3, 0.2, 140]]) {
    const b = createBody('mackerel', [x, y, z], 0);
    b.vy = 15;
    let top = 0;
    for (let t = 0; t < 2.5; t += STEP) {
      stepBody(b, { hold: false, yaw: 0 }, env);
      top = Math.max(top, b.y + 0.16);
    }
    assert.ok(top < 5.45, `a fish from (${x}, ${y}, ${z}) flew up to ${top.toFixed(2)} m`);
  }
  // and the sharpest bots, on both routes, stay inside the room the whole way
  for (const route of ['spine', 'expert']) for (const personality of ['steady', 'showoff', 'hothead']) for (let seed = 0; seed < 3; seed++) {
    const r = runBot(c, { skill: 1, seed, route, personality, max: 200, track: true });
    assert.ok(r.finished);
    for (const [, x, y] of r.track) assert.ok(y < 5.3 && Math.abs(x) < 6, `a bot left the room at (${x.toFixed(1)}, ${y.toFixed(1)})`);
  }
});
