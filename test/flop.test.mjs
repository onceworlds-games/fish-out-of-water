// The flop and the water: the arc preview lands where the fish really lands, the gills drain on dry ground and fill
// in a puddle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP, WATER, FISH } from '../src/sim/config.js';
import { createBody, stepBody, predictArc, chargeOf } from '../src/sim/body.js';
import { getCourse, COURSE_IDS } from '../src/sim/courses/index.js';
import { pointAt } from '../src/sim/build.js';

const settle = (b, env, secs = 1.5) => {
  for (let t = 0; t < secs; t += STEP) stepBody(b, { hold: false, yaw: 0 }, env);
  b.events.length = 0;
};

test('the arc preview matches the real landing', () => {
  let checked = 0;
  const misses = [];
  for (const id of ['quay', ...COURSE_IDS]) {
    const c = getCourse(id);
    const env = { world: c.world, hazards: null, t: 0 };
    for (let k = 0; k < 8; k++) {
      const s = (c.length * (k + 0.5)) / 8;
      const p = pointAt(c.spine, c.lens, s);
      const q = pointAt(c.spine, c.lens, s + 3);
      const ahead = Math.atan2(q[0] - p[0], q[2] - p[2]);
      for (const fish of FISH) {
        for (const [hold, turn] of [[0.12, 0], [0.45, 0.4], [0.8, -0.5], [1.3, 0.15]]) {
          const b = createBody(fish.id, [p[0], p[1] + 0.6, p[2]], ahead);
          settle(b, env);
          if (b.state !== 'ok' || !b.ground) continue;
          const yaw = ahead + turn;
          let land = null;
          for (let t = 0; t < hold; t += STEP) {
            stepBody(b, { hold: true, yaw }, env);
            land = predictArc(b, c.world, yaw, chargeOf(b.holdT, b.fish), undefined, { dt: STEP });
          }
          b.events.length = 0;
          // the first thing it touches: a landing, or for a wall, where the fish is when the arc says it gets there
          let real = null;
          for (let t = 0, n = 0; t < 4 && !real; t += STEP, n++) {
            stepBody(b, { hold: false, yaw }, env);
            if (land && !land.ground && n === Math.round(land.t / STEP) - 1) real = { x: b.x, z: b.z };
            for (const e of b.events) if (!real && (e.type === 'land' || e.type === 'bonk' || e.type === 'finish')) real = e.type === 'finish' ? { x: b.x, z: b.z } : e;
            b.events.length = 0;
          }
          if (!land || !real) continue;
          checked++;
          const d = Math.hypot(land.x - real.x, land.z - real.z);
          if (d > 0.3) misses.push(`${id} ${fish.id} s${s.toFixed(0)} hold ${hold}: ${d.toFixed(2)} m`);
        }
      }
    }
  }
  assert.ok(checked > 200, `only ${checked} flops checked`);
  // a landing right on an edge can differ by a step; the preview has to be right almost every time
  assert.ok(misses.length <= checked * 0.01, `the preview missed ${misses.length} of ${checked}:\n${misses.slice(0, 12).join('\n')}`);
});

test('gills drain on dry ground and fill in a puddle', () => {
  const c = getCourse('market');
  const env = { world: c.world, hazards: null, t: 0 };
  const b = createBody('mackerel', [c.start.x, c.start.y + 0.3, c.start.z], c.start.yaw);
  settle(b, env, 0.5);
  // off the ice: a dry spot next to the start
  const dry = createBody('mackerel', [c.spine[1][0], c.spine[1][1] + 0.5, c.spine[1][2]], 0);
  settle(dry, env, 0.5);
  const m0 = dry.m;
  for (let t = 0; t < 5; t += STEP) stepBody(dry, { hold: false, yaw: 0 }, env);
  assert.ok(dry.m < m0 - 5 && dry.m > m0 - 5 * WATER.base * 3, `water went ${m0} → ${dry.m}`);

  const puddle = c.world.zones.find((z) => z.kind === 'puddle');
  const wet = createBody('mackerel', [puddle.c[0], puddle.c[1] + 0.4, puddle.c[2]], 0);
  wet.m = 20;
  for (let t = 0; t < 2; t += STEP) stepBody(wet, { hold: false, yaw: 0 }, env);
  assert.ok(wet.m >= 99, `a puddle filled the gills to ${wet.m}`);
});

test('a fish left on dry ground dries out and goes back to the last puddle', () => {
  const c = getCourse('market');
  const env = { world: c.world, hazards: null, t: 0 };
  const b = createBody('mackerel', [c.spine[1][0], c.spine[1][1] + 0.5, c.spine[1][2]], 0);
  b.m = 3;
  let dried = false, back = false;
  for (let t = 0; t < 6; t += STEP) {
    stepBody(b, { hold: false, yaw: 0 }, env);
    for (const e of b.events) {
      if (e.type === 'dry') dried = true;
      if (e.type === 'respawn') back = true;
    }
    b.events.length = 0;
  }
  assert.ok(dried && back, 'dried and came back');
  assert.equal(b.state, 'ok');
  assert.ok(b.m > 90);
});
