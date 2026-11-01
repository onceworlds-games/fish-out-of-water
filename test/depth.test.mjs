// The things that make each flop a choice: sun and shade, drops and golden scales, Flow (slaps in a row, PERFECT ones),
// near misses, and the moving parts (belts, swinging pans, rising air, drains).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP, WATER, SUN, SLAP, FLOW, slapPower, DROPS } from '../src/sim/config.js';
import { createBody, stepBody, predictArc, predictFall, chargeOf } from '../src/sim/body.js';
import { courseBuilder } from '../src/sim/build.js';
import { createWorld, rayHits, box, cyl, sphere } from '../src/sim/world.js';
import { createHazards } from '../src/sim/hazards.js';

/** A flat yard (tile, 40 × 40 m) plus whatever `fill` adds. */
function yard(fill = () => {}, opts = {}) {
  const b = courseBuilder('yard');
  b.slab(-20, -20, 20, 20, 0, opts.surf ?? 'tile', 'tile', 1);
  fill(b);
  const world = createWorld({ colliders: b.colliders, zones: b.zones, casters: b.casters, items: b.items, sun: opts.sun ?? true, bounds: { minY: -10, min: [-30, -30], max: [30, 30] } });
  return { b, world, course: { id: 'yard', builder: b, start: { x: 0, y: 0, z: 0, yaw: 0 } } };
}

const run = (body, env, secs, input = { hold: false, yaw: 0 }, onEvent) => {
  for (let t = 0; t < secs; t += STEP) {
    env.t = (env.t ?? 0) + STEP;
    stepBody(body, typeof input === 'function' ? input(t) : input, env);
    for (const e of body.events) onEvent?.(e, t);
    body.events.length = 0;
  }
};

test('rays find boxes, turned boxes, cylinders and spheres, and miss beside them', () => {
  const up = [0, 1, 0];
  const bx = box([0, 3, 0], [1, 0.2, 1], {});
  assert.ok(rayHits(bx, 0, 0, 0, ...up, 10));
  assert.ok(!rayHits(bx, 1.5, 0, 0, ...up, 10));
  assert.ok(!rayHits(bx, 0, 0, 0, ...up, 2.5), 'too short to reach it');
  const turned = box([0, 3, 0], [2, 0.2, 0.2], { yaw: Math.PI / 2 }); // long along z now
  assert.ok(rayHits(turned, 0, 0, 1.5, ...up, 10));
  assert.ok(!rayHits(turned, 1.5, 0, 0, ...up, 10));
  const c = cyl([0, 3, 0], 0.5, 1, {});
  assert.ok(rayHits(c, 0.3, 0, 0, ...up, 10));
  assert.ok(!rayHits(c, 0.6, 0, 0, ...up, 10));
  const sp = sphere([0, 3, 0], 1, {});
  assert.ok(rayHits(sp, 0.9, 0, 0, ...up, 10));
  assert.ok(!rayHits(sp, 1.1, 0, 0, ...up, 10));
  assert.ok(!rayHits(sp, 0, 5, 0, ...up, 10), 'behind the start');
});

test('a wall between the fish and the sun is shade; open ground is sun; indoors there is none', () => {
  // a 6 m wall standing toward the sun from the origin
  const { world } = yard((b) => b.box([SUN[0] * 3, 3, SUN[2] * 3], [6, 6, 0.4], { surf: 'wall', look: 'plaster', yaw: Math.atan2(SUN[0], SUN[2]) }));
  assert.equal(world.sunlit(0, 0.3, 0), false);
  assert.equal(world.sunlit(-6, 0.3, -6), true);
  // shade from something that isn't solid: a tree's crown
  const { world: w2 } = yard((b) => b.tree(SUN[0] * 4, 0, SUN[2] * 4, { h: 4.5, r: 1.8 }));
  const k = 3.4 / SUN[1];
  assert.equal(w2.sunlit(SUN[0] * 4 - SUN[0] * k, 0.3, SUN[2] * 4 - SUN[2] * k), false, 'under the crown');
  assert.equal(w2.sunlit(-5, 0.3, 5), true);
  const { world: w3 } = yard(() => {}, { sun: false });
  assert.equal(w3.sunlit(0, 0.3, 0), false);
});

test('the sun dries a fish faster than the shade does', () => {
  const { world } = yard((b) => b.box([SUN[0] * 3, 3, SUN[2] * 3], [6, 6, 0.4], { surf: 'wall', look: 'plaster', yaw: Math.atan2(SUN[0], SUN[2]) }));
  const env = { world, hazards: null, t: 0 };
  const shade = createBody('mackerel', [0, 0.3, 0], 0);
  const sun = createBody('mackerel', [-6, 0.3, -6], 0);
  run(shade, env, 0.5);
  run(sun, { ...env }, 0.5);
  const s0 = shade.m, u0 = sun.m;
  run(shade, env, 4);
  run(sun, { ...env }, 4);
  const lostShade = s0 - shade.m, lostSun = u0 - sun.m;
  assert.ok(Math.abs(lostShade - 4 * WATER.base * WATER.shade) < 0.6, `shade lost ${lostShade}`);
  assert.ok(Math.abs(lostSun - 4 * WATER.base * WATER.sun) < 0.6, `sun lost ${lostSun}`);
  assert.equal(shade.sun, false);
  assert.equal(sun.sun, true);
});

test('drops give water and count once each; golden scales are kept by number', () => {
  const { world } = yard((b) => {
    b.drops([[0, 0, 1], [0, 0, 6]], 1);
    b.scale(0, 0, 7.5);
  });
  assert.equal(world.items.filter((i) => i.kind === 'drop').length, 6);
  const env = { world, hazards: null, t: 0 };
  const fish = createBody('mackerel', [0, 0.2, 0], 0);
  fish.m = 50;
  // slide along the line on ice-like speed: push it through
  const picks = [];
  for (let t = 0; t < 3; t += STEP) {
    fish.vx = 0;
    fish.vz = 3.5;
    stepBody(fish, { hold: false, yaw: 0 }, env);
    for (const e of fish.events) if (e.type === 'pick') picks.push(e);
    fish.events.length = 0;
  }
  assert.equal(fish.drops, 6);
  assert.deepEqual(fish.scales, [0]);
  assert.equal(picks.filter((p) => p.kind === 'drop').length, 6);
  assert.ok(fish.m > 50 + 6 * DROPS.water - 3 * WATER.base * WATER.sun - 1, `water ${fish.m}`);
  // back through: nothing new
  fish.x = 0;
  fish.z = 0;
  for (let t = 0; t < 3; t += STEP) {
    fish.vz = 3.5;
    stepBody(fish, { hold: false, yaw: 0 }, env);
    fish.events.length = 0;
  }
  assert.equal(fish.drops, 6);
});

/** Hold for `hold` s, let go; then in each flight, hold `hold2` s and let go `early` s before touchdown (from predictFall). */
function chainFlops(world, n, hold, early, perfect = false) {
  const env = { world, hazards: null, t: 0 };
  const b = createBody('mackerel', [0, 0.2, -15], 0);
  run(b, env, 0.5);
  const flops = [];
  let holdLeft = hold, phase = 'charge';
  let plan = null;
  for (let t = 0; t < 30 && flops.length < n; t += STEP) {
    let hold = false;
    if (phase === 'charge') {
      holdLeft -= STEP;
      hold = holdLeft > 0;
      if (!hold) phase = 'air';
    } else if (phase === 'air' && !b.ground) {
      const fall = predictFall(b, world);
      // start holding so the release lands `early` s before touchdown
      if (!plan && fall.surf && fall.t < 0.9) plan = { releaseIn: fall.t - early, held: 0 };
      if (plan) {
        plan.releaseIn -= STEP;
        hold = plan.releaseIn > 0;
      }
    }
    env.t += STEP;
    stepBody(b, { hold, yaw: 0 }, env);
    for (const e of b.events) if (e.type === 'flop') {
      flops.push({ ...e, vy: b.vy, vz: b.vz });
      plan = null;
    }
    b.events.length = 0;
  }
  return { b, flops };
}

test('slaps in a row build Flow: each one flies further; a perfect one more', () => {
  assert.ok(slapPower(0, false) === SLAP.power);
  assert.ok(slapPower(3, false) > slapPower(2, false));
  assert.equal(slapPower(99, false), slapPower(FLOW.links, false));
  assert.ok(slapPower(1, true) > slapPower(1, false));
  const { world } = yard(() => {}, { surf: 'wood' });
  const { flops, b } = chainFlops(world, 6, 0.5, 0.07);
  assert.ok(flops.length >= 5, `${flops.length} flops`);
  assert.equal(flops[0].slap, false);
  for (let i = 1; i < flops.length; i++) assert.equal(flops[i].chain, i, `flop ${i} chain ${flops[i].chain}`);
  assert.ok(flops[4].vy > flops[1].vy * 1.05, `flow raises the leap: ${flops[1].vy} → ${flops[4].vy}`);
  assert.ok(b.bestChain >= 5);
  const perfect = chainFlops(world, 4, 0.5, 0.0);
  assert.ok(perfect.flops.slice(1).every((f) => f.slap && f.perfect), 'released on the touchdown: perfect');
  assert.ok(perfect.b.perfects >= 3);
});

test('a slap\'s preview from the landing point matches where the slap really lands', () => {
  const { world } = yard((b) => {
    b.box([2, 0.4, 6], [2, 0.8, 2], { surf: 'wood', look: 'crate' });
  }, { surf: 'wood' });
  const env = { world, hazards: null, t: 0 };
  const b = createBody('mackerel', [0, 0.2, -12], 0);
  run(b, env, 0.4);
  // a first flop
  run(b, env, 0.6, { hold: true, yaw: 0 });
  run(b, env, STEP, { hold: false, yaw: 0 });
  let checked = 0;
  let pending = null;
  const check = (land) => {
    if (!pending) return;
    checked++;
    assert.ok(Math.hypot(land.x - pending.x, land.z - pending.z) < 0.3, `slap ${checked}: preview ${pending.x.toFixed(2)},${pending.z.toFixed(2)} vs ${land.x.toFixed(2)},${land.z.toFixed(2)}`);
    pending = null;
  };
  for (let k = 0; k < 5; k++) {
    // in the air: where it comes down, and where a slap from there goes
    const fall = predictFall(b, world);
    assert.ok(fall.surf, 'it comes down');
    const holdT = 0.45;
    const yaw = 0.12 * (k - 2);
    const arc = predictArc(b, world, yaw, chargeOf(holdT, b.fish), undefined, { from: { x: fall.x, y: fall.y, z: fall.z, vel: [fall.vx, fall.vz], slap: true, chain: b.slapChain } });
    // hold so the release comes 2 steps before touchdown
    const steps = Math.round(fall.t / STEP);
    const start = steps - Math.round(holdT / STEP) - 2;
    assert.ok(start >= 0, 'a long enough flight');
    let flopped = false;
    for (let i = 0; i < 400; i++) {
      env.t += STEP;
      stepBody(b, { hold: i >= start && i < steps - 2, yaw }, env);
      for (const e of b.events) {
        if (e.type === 'land') check(e);
        if (e.type === 'flop') {
          assert.ok(e.slap, 'it was a slap');
          flopped = true;
        }
      }
      b.events.length = 0;
      if (flopped && !b.ground) break;
    }
    pending = arc;
  }
  for (let i = 0; i < 400 && pending; i++) {
    env.t += STEP;
    stepBody(b, { hold: false, yaw: 0 }, env);
    for (const e of b.events) if (e.type === 'land') check(e);
    b.events.length = 0;
  }
  assert.equal(checked, 5);
});

test('a belt carries a fish that lies on it', () => {
  const { world } = yard((b) => b.belt([0, 0.2, 0], [1, 0.4, 12], [0, 1.6]));
  const env = { world, hazards: null, t: 0 };
  const f = createBody('mackerel', [0, 0.6, -4], 0);
  run(f, env, 2.5);
  assert.ok(f.z > -4 + 2.5, `carried to ${f.z}`);
  assert.ok(Math.abs(f.vz - 1.6) < 0.05);
});

test('a swinging pan carries a fish standing on it, the same on every page', () => {
  const { course, world } = yard((b) => b.hazard({ kind: 'pendulum', id: 'pan', pivot: [0, 4, 0], len: 2.5, amp: 0.6, period: 3, size: [1.2, 0.1, 1.2] }));
  const hz = createHazards(course, 3);
  const hz2 = createHazards(course, 3);
  const env = { world, hazards: hz, t: 0 };
  const s0 = hz.at(0)[0];
  const f = createBody('mackerel', [s0.x, s0.y + 0.25, s0.z], 0);
  let maxDx = 0;
  run(f, env, 3, { hold: false, yaw: 0 }, () => {});
  for (let t = 0; t < 3; t += STEP) {
    env.t += STEP;
    stepBody(f, { hold: false, yaw: 0 }, env);
    f.events.length = 0;
    const s = hz.at(env.t)[0];
    maxDx = Math.max(maxDx, Math.abs(f.x));
    assert.ok(Math.hypot(f.x - s.x, f.z - s.z) < 0.7, `stays on the pan at ${env.t.toFixed(2)}: ${f.x.toFixed(2)} vs ${s.x.toFixed(2)}`);
  }
  assert.ok(maxDx > 1, 'it swung across');
  assert.deepEqual(JSON.parse(JSON.stringify(hz.at(5.5))), JSON.parse(JSON.stringify(hz2.at(5.5))));
});

test('rising air lifts a fish, and the arc preview knows it', () => {
  const { world } = yard((b) => b.updraft(0, 0, 4, 1.2, 4, 34));
  const env = { world, hazards: null, t: 0 };
  const plain = yard().world;
  const f = createBody('mackerel', [0, 0.2, 0], 0);
  run(f, env, 0.3);
  const arc = predictArc(f, world, 0, 0.6);
  const flat = predictArc(f, plain, 0, 0.6);
  assert.ok(Math.hypot(arc.x, arc.z) > Math.hypot(flat.x, flat.z) + 0.8, `lifted: ${arc.z.toFixed(2)} vs ${flat.z.toFixed(2)}`);
  let land = null;
  run(f, env, 0.15 + 0.66 * 0.95 + 0.0, { hold: true, yaw: 0 });
  const arc2 = predictArc(f, world, 0, chargeOf(f.holdT, f.fish));
  run(f, env, 4, { hold: false, yaw: 0 }, (e) => {
    if (e.type === 'land' && !land) land = e;
  });
  assert.ok(land);
  assert.ok(Math.hypot(land.x - arc2.x, land.z - arc2.z) < 0.3, `preview ${arc2.z.toFixed(2)} vs ${land.z.toFixed(2)}`);
});

test('a drain washes a fish back to the last water', () => {
  const { world } = yard((b) => {
    b.puddle(0, 0, 0, 0.8);
    b.drain(0, 0, 4, 0.5);
  });
  const env = { world, hazards: null, t: 0 };
  const f = createBody('mackerel', [0, 0.3, 0], 0);
  run(f, env, 0.5);
  f.x = 0;
  f.z = 4;
  f.y = 0.4;
  let drained = false;
  run(f, env, 0.5, { hold: false, yaw: 0 }, (e) => {
    if (e.type === 'drain') drained = true;
  });
  assert.ok(drained);
  assert.ok(Math.hypot(f.x, f.z) < 0.5, 'back at the puddle');
});

test('a strike that only just misses is a near miss, once', () => {
  const { course, world } = yard((b) => b.hazard({ kind: 'cat', id: 'cat', at: [0, 0.8, 0], floor: 0, radius: 2.0, period: 2.0, tele: 0.9, phase: 0 }));
  const hz = createHazards(course, 0);
  const env = { world, hazards: hz, t: 0 };
  // just outside the swipe's reach, on the struck side every other time: lies there for a few swipes
  const f = createBody('mackerel', [0, 0.2, 2.4], 0);
  let close = 0, knocks = 0;
  run(f, env, 8.5, { hold: false, yaw: 0 }, (e) => {
    if (e.type === 'close') close++;
    if (e.type === 'knock') knocks++;
  });
  assert.equal(knocks, 0);
  assert.ok(close >= 3 && close <= 5, `${close} near misses`);
  assert.equal(f.close, close);
});
