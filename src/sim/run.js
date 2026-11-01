// Runs a fish through a course with a brain, headless: for tests, balance numbers and the gold ghost.

import { STEP } from './config.js';
import { createBody, stepBody } from './body.js';
import { createBrain } from './bot.js';
import { createHazards } from './hazards.js';

export function runBot(course, opts = {}) {
  const slot = course.slots[opts.slot ?? 0];
  const b = createBody(opts.fish ?? 'mackerel', slot, course.start.yaw);
  const hazards = createHazards(course, opts.seed ?? 0, { gentle: opts.gentle ? course.gentle : 0 });
  const brain = createBrain(course, { skill: opts.skill ?? 1, seed: opts.seed ?? 1, personality: opts.personality, route: opts.route, yaw: course.start.yaw, twist: opts.twist });
  const env = { world: course.world, hazards, twist: opts.twist, t: 0 };
  const max = opts.max ?? 240;
  let t = 0;
  const stats = { dries: 0, knocks: 0, slaps: 0, flops: 0, minWater: 100, respawns: 0, track: opts.track ? [] : null };
  let nextTrack = 0;
  while (t < max) {
    t += STEP;
    env.t = t;
    const input = brain.step(b, STEP, t, hazards);
    stepBody(b, input, env);
    for (const e of b.events) {
      if (e.type === 'dry') stats.dries++;
      else if (e.type === 'knock') stats.knocks++;
      else if (e.type === 'flop') {
        stats.flops++;
        if (e.slap) stats.slaps++;
      } else if (e.type === 'respawn') stats.respawns++;
    }
    b.events.length = 0;
    stats.minWater = Math.min(stats.minWater, b.m);
    if (stats.track && t >= nextTrack) {
      stats.track.push([t, b.x, b.y, b.z, brain.yaw]);
      nextTrack += 0.125;
    }
    if (b.state === 'done') return { finished: true, time: t, water: b.m, ...stats, body: b, brain };
  }
  const pr = course.progress(b.x, b.z);
  return { finished: false, time: t, progress: pr.s, x: b.x, z: b.z, ...stats, body: b, brain };
}
