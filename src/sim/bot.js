// The bot brain: picks the farthest spot it can land on along its route, works out the charge with the same arc the
// player sees, then holds the button like a person would (late, a little off). Skill 0 is clumsy, 1 is sharp.
// It also drives the gold ghost and the trailer's autoplay. Pure: node tests race bots through whole courses.

import { predictArc, canFlop, respawn } from './body.js';
import { FLOP, SLAP, WATER, SURFACES } from './config.js';
import { polyLengths, project, pointAt } from './build.js';
import { createRng, clamp, lerp } from './rng.js';

export const PERSONALITIES = {
  steady: { reach: 1, water: 1, chain: 1, aim: 1, shortcut: 1 },
  hothead: { reach: 1.1, water: 0.45, chain: 1.2, aim: 1.2, shortcut: 1.2 },
  careful: { reach: 0.72, water: 1.6, chain: 0.5, aim: 0.8, shortcut: 0.4 },
  showoff: { reach: 1.05, water: 0.9, chain: 1.5, aim: 1, shortcut: 1.8 },
  wobbly: { reach: 0.95, water: 1.1, chain: 0.6, aim: 2.2, shortcut: 0.6 },
};

const CANDIDATES = [6.6, 6.0, 5.4, 4.8, 4.2, 3.6, 3.0, 2.4, 1.8, 1.2, 0.8];

export function createBrain(course, opts = {}) {
  const skill = clamp(opts.skill ?? 0.5, 0, 1);
  const pers = PERSONALITIES[opts.personality] ?? PERSONALITIES.steady;
  const rng = createRng(opts.seed ?? 1);
  const useExpert = !!course.expert && (opts.route === 'expert' || (opts.route !== 'spine' && rng.next() < clamp((skill - 0.45) * 1.6 * pers.shortcut, 0, 0.95)));
  let route = useExpert ? course.expert : course.spine;
  let lens = useExpert ? course.expertLens ?? polyLengths(route) : course.lens;
  let total = lens[lens.length - 1];
  const world = course.world;
  const sAim = lerp(9, 1.2, skill) * pers.aim * (Math.PI / 180);
  const sCharge = lerp(0.14, 0.022, skill) * pers.aim;
  const react = lerp(0.62, 0.16, skill);
  const waterAt = clamp(lerp(46, 24, skill) * pers.water, 10, 75);
  const chainSkill = skill * pers.chain;
  const hazardSense = clamp(0.25 + skill * 0.8, 0, 1);
  const p = { x: 0, y: 0, z: 0 };
  const pt = [0, 0, 0];

  const brain = {
    skill,
    route,
    expert: useExpert,
    mode: 'wait',
    wait: 0.5 + rng.next() * 0.4,
    holdFor: 0,
    held: 0,
    yaw: opts.yaw ?? 0,
    aimYaw: opts.yaw ?? 0,
    seg: -1,
    s: 0,
    best: 0,
    stuck: 0,
    target: null,
    chain: null, // a planned flop for the moment we land: { yaw, holdFor, startAt }
    airT: 0,
    flops: -1,
    pending: null,
    drinking: 0,
    respawns: 0,
    /** One step: returns { hold, yaw } for stepBody. t: race seconds (for hazards). */
    step(b, dt, t, hazards) {
      brain.airT = b.ground ? 0 : brain.airT + dt;
      if (b.state !== 'ok') {
        // dried out or carried off: it comes back somewhere else, so progress starts over from there
        brain.mode = 'wait';
        brain.wait = react * 0.6;
        brain.held = 0;
        brain.chain = null;
        brain.best = -Infinity;
        brain.stuck = 0;
        brain.seg = -1;
        return out(false);
      }
      const pr = project(route, lens, b.x, b.z, brain.seg);
      brain.seg = pr.seg;
      brain.s = pr.s;
      if (pr.s > brain.best + 0.5) {
        brain.best = pr.s;
        brain.stuck = 0;
      } else brain.stuck += dt;
      // the shortcut didn't work out (missed the awning, can't get up the kiosk): take the main way like a person would
      if (brain.expert && brain.stuck > 3.2 && b.ground) {
        route = course.spine;
        lens = course.lens;
        total = lens[lens.length - 1];
        brain.route = route;
        brain.expert = false;
        brain.stuck = 0;
        brain.best = -Infinity;
        brain.seg = -1;
        brain.chain = null;
      }
      if (brain.stuck > 9 && b.ground) {
        respawn(b);
        brain.stuck = 0;
        brain.best = -Infinity;
        brain.respawns++;
        brain.seg = -1;
        return out(false);
      }

      // a flop happened (ours, or a queued one at touchdown): plan the next one in the air
      if (brain.flops < 0) brain.flops = b.flops;
      if (b.flops !== brain.flops) {
        brain.flops = b.flops;
        brain.mode = 'air';
        brain.target = brain.pending;
        brain.pending = null;
        planChain(b, t, hazards);
      }
      if (brain.mode === 'charge') {
        brain.held += dt;
        brain.yaw += wrap(brain.aimYaw - brain.yaw) * Math.min(1, dt * (8 + skill * 12));
        if (brain.held >= brain.holdFor && Math.abs(wrap(brain.aimYaw - brain.yaw)) < 0.05) {
          brain.mode = 'released';
          brain.held = 0;
          brain.pending = brain.target;
          return out(false);
        }
        return out(true);
      }
      if (brain.mode === 'released') {
        // the flop didn't happen (stunned, or not touching): try again soon
        brain.mode = 'wait';
        brain.wait = 0.2;
        return out(false);
      }
      if (brain.mode === 'air') {
        const c = brain.chain;
        if (c) {
          c.age += dt;
          brain.yaw += wrap(c.yaw - brain.yaw) * Math.min(1, dt * 10);
          if (c.age >= c.startAt && !c.done) {
            c.held += dt;
            if (c.held >= c.holdFor) {
              c.done = true;
              brain.pending = c.land;
              return out(false); // let go: on the ground it flops now, in the air it waits for touchdown
            }
            return out(true);
          }
          if (c.done && c.age > c.startAt + c.holdFor + 0.6) brain.chain = null;
          return out(false);
        }
        if (b.ground && Math.hypot(b.vx, b.vz) < 2.5) {
          brain.mode = 'wait';
          brain.wait = react * (0.7 + rng.next() * 0.8);
        }
        return out(false);
      }
      // waiting on the ground
      if (!b.ground) return out(false);
      // drinking: stay in the puddle until nearly full
      if (b.zones.some((z) => z.rate) && b.m < 92 && brain.wantWater) {
        brain.drinking += dt;
        if (brain.drinking < 1.6) return out(false);
      }
      brain.drinking = 0;
      brain.wantWater = false;
      if (Math.hypot(b.vx, b.vz) > 1.6) return out(false);
      brain.wait -= dt;
      if (brain.wait > 0) return out(false);
      plan(b, t, hazards);
      brain.mode = 'charge';
      brain.held = 0;
      return out(true);
    },
  };

  function out(hold) {
    return { hold, yaw: brain.yaw };
  }

  function nearestRefill(b, ahead) {
    let best = null, bd = Infinity;
    for (const z of course.refills ?? []) {
      if (z.kind === 'spray' && z.rate < 40) continue;
      const pr = project(route, lens, z.c[0], z.c[2], -1);
      if (pr.s < brain.s - 6 || pr.s > brain.s + ahead) continue;
      if (pr.off > 6) continue;
      const d = Math.hypot(z.c[0] - b.x, z.c[2] - b.z) + Math.max(0, brain.s - pr.s) * 2;
      if (d < bd) {
        bd = d;
        best = z;
      }
    }
    return best;
  }

  /** Find a charge that lands near (tx, ty, tz) from the body (or from `from`); null when none does. */
  function solve(b, tx, ty, tz, t, hazards, from = null) {
    const ox = from ? from.x : b.x, oz = from ? from.z : b.z;
    const yaw = Math.atan2(tx - ox, tz - oz);
    const want = Math.hypot(tx - ox, tz - oz);
    let lo = 0, hi = 1, best = null;
    for (let i = 0; i < 8; i++) {
      const c = (lo + hi) / 2;
      const land = predictArc(b, world, yaw, c, opts.twist, { dt: 1 / 40, from, maxT: 2.5 });
      const got = Math.hypot(land.x - ox, land.z - oz);
      if (!land.surf) {
        hi = c;
        continue;
      }
      if (got < want) lo = c;
      else hi = c;
      best = { c, land, yaw };
    }
    if (!best) return null;
    const land = best.land;
    const err = Math.hypot(land.x - tx, land.z - tz);
    if (err > 0.7 || land.y < ty - 0.3) return null;
    if (land.surf === 'net' && rng.next() < skill) return null;
    if (land.surf === 'hot' && b.m < 60 && rng.next() < skill) return null;
    if (hazards && rng.next() < hazardSense && hazards.danger(land.x, land.z, t + land.t)) return null;
    return best;
  }

  function choose(b, t, hazards, from = null) {
    const fx = from ? from.x : b.x, fz = from ? from.z : b.z;
    // water first when running low
    // on a surface that dries you faster, think of water sooner
    const sd = SURFACES[b.surf]?.drain ?? 1;
    const at = Math.min(72, waterAt * clamp(sd, 1, 2.2));
    const low = b.m < at || (from && b.m < at + 12);
    if (low) {
      const z = nearestRefill(b, 30);
      if (z) {
        const d = Math.hypot(z.c[0] - fx, z.c[2] - fz);
        brain.wantWater = true;
        if (d < 6.2) {
          const sol = solve(b, z.c[0], z.c[1], z.c[2], t, hazards, from);
          if (sol) return sol;
        }
        // head toward it in hops
        const k = Math.min(1, (5.2 * pers.reach) / Math.max(0.1, d));
        const sol = solve(b, fx + (z.c[0] - fx) * k, z.c[1], fz + (z.c[2] - fz) * k, t, hazards, from);
        if (sol) return sol;
      }
    }
    const pr = from ? project(route, lens, from.x, from.z, brain.seg) : { s: brain.s };
    const maxReach = 6.6 * pers.reach * lerp(0.82, 1, skill);
    for (const d of CANDIDATES) {
      if (d > maxReach) continue;
      pointAt(route, lens, Math.min(total, pr.s + d), pt);
      const sol = solve(b, pt[0], pt[1], pt[2], t, hazards, from);
      if (sol) return sol;
    }
    return null;
  }

  function plan(b, t, hazards) {
    let sol = choose(b, t, hazards);
    let yaw, c;
    if (sol) {
      yaw = sol.yaw;
      c = sol.c;
    } else {
      // nothing fits: a hop toward the route, a bit to the side each time
      pointAt(route, lens, Math.min(total, brain.s + 2.5), pt);
      yaw = Math.atan2(pt[0] - b.x, pt[2] - b.z) + (rng.next() - 0.5) * 1.2;
      c = 0.35 + rng.next() * 0.5;
    }
    yaw += rng.gauss() * sAim;
    c = clamp(c + rng.gauss() * sCharge, 0, 1);
    brain.aimYaw = yaw;
    brain.holdFor = holdFor(b, c);
    brain.target = sol ? sol.land : null;
  }

  function holdFor(b, c) {
    const full = FLOP.minHold + (FLOP.fullHold - FLOP.minHold) * (b.fish?.charge ?? 1);
    return FLOP.minHold + c * (full - FLOP.minHold);
  }

  /** Skilled bots plan the next flop for the moment they land, and hold through the flight. */
  function planChain(b, t, hazards) {
    brain.chain = null;
    if (rng.next() > chainSkill * 0.9) return;
    if (b.m < waterAt + 10) return;
    const land = brain.target;
    if (!land || land.t < 0.55) return;
    const from = { x: land.x, y: land.y, z: land.z, vel: [land.vx, land.vz], slap: true };
    const sol = choose(b, t + land.t, hazards, from);
    if (!sol) return;
    const c = clamp(sol.c + rng.gauss() * sCharge, 0, 1);
    const hold = holdFor(b, c);
    const timing = rng.gauss() * lerp(0.12, 0.03, skill);
    const startAt = Math.max(0.02, land.t - hold + timing);
    brain.chain = { yaw: sol.yaw + rng.gauss() * sAim, holdFor: hold, startAt, age: 0, held: 0, done: false, land: sol.land };
  }

  return brain;
}

function wrap(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** A brain that flops about at random inside a box (the title's attract mode, the lobby's idle fish). */
export function createWanderer(world, box, seed = 1) {
  const rng = createRng(seed);
  let wait = rng.next() * 1.5;
  let holdFor = 0, held = 0, charging = false, yaw = rng.next() * 6.28, aim = yaw;
  return {
    step(b, dt) {
      if (b.state !== 'ok') return { hold: false, yaw };
      if (charging) {
        held += dt;
        yaw += wrap(aim - yaw) * Math.min(1, dt * 8);
        if (held >= holdFor) {
          charging = false;
          wait = 0.6 + rng.next() * 2.2;
          return { hold: false, yaw };
        }
        return { hold: true, yaw };
      }
      if (!b.ground) return { hold: false, yaw };
      wait -= dt;
      if (wait > 0) return { hold: false, yaw };
      // pick a spot inside the box
      for (let i = 0; i < 6; i++) {
        const tx = box[0] + rng.next() * (box[2] - box[0]);
        const tz = box[1] + rng.next() * (box[3] - box[1]);
        const d = Math.hypot(tx - b.x, tz - b.z);
        if (d < 1 || d > 5.5) continue;
        aim = Math.atan2(tx - b.x, tz - b.z);
        holdFor = FLOP.minHold + clamp((d - 0.8) / 5.2, 0, 1) * (FLOP.fullHold - FLOP.minHold);
        charging = true;
        held = 0;
        return { hold: true, yaw };
      }
      wait = 0.5;
      return { hold: false, yaw };
    },
  };
}

export { WATER, SLAP };
