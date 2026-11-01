// A fish's gameplay body: one sphere that flops, flies, bounces, slides and dries out (fast in the sun, slowly in the
// shade), picks up drops and golden scales, and chains slaps into Flow. The arc preview runs the same code, so what it
// shows is where the fish lands. Pure: node tests and every page use it.

import { STEP, GRAVITY, BODY_RADIUS, FLOP, SLAP, FLOW, slapPower, STUN, RESTING, GROUND_NY, WATER, SURFACES, DROPS, SCALES, UPDRAFT, fishById } from './config.js';
import { contact, inZone } from './world.js';

const NO_TWIST = { wind: [0, 0], friction: 1, drain: 1 };

export function createBody(fishId = 'mackerel', pos = [0, 0.2, 0], yaw = 0) {
  const fish = fishById(fishId);
  return {
    fish,
    x: pos[0], y: pos[1], z: pos[2],
    vx: 0, vy: 0, vz: 0,
    yaw,
    t: 0,
    state: 'ok', // ok | dry | grab | done
    ground: false,
    surf: 'tile',
    lastSurf: 'tile',
    gn: [0, 1, 0], // last ground normal
    wall: null, // last wall normal [x, z] when the newest contact was a wall
    contactT: -1,
    airT: 0,
    touchT: -9, // when it last landed from a real flight
    touchV: [0, 0], // horizontal speed coming in at that landing
    touchSurf: null, // ... and what it landed on
    holding: false,
    holdT: 0,
    queued: null, // a release in the air: { charge, at }
    stun: 0,
    stick: 0,
    m: WATER.max,
    dryT: 0,
    refill: [pos[0], pos[1], pos[2]], // where a dry fish comes back
    refillId: null,
    slide: 0, // metres of the slide going on
    slapChain: 0, // slaps in a row (Flow)
    bestChain: 0,
    perfects: 0,
    gv: [0, 0], // the ground's own velocity under the fish (a belt, a swinging pan)
    sun: true, // out in the sun (or in the shade)
    sunT: 0,
    got: null, // pickups taken (one byte per pickup of the world)
    drops: 0,
    scales: [], // golden scales picked up this run (their indices)
    close: 0, // near misses
    grab: null,
    flops: 0,
    events: [],
    zones: [],
    hits: {},
    doneY: 0, // finished: how far down it goes
    surfY: null, // finished: the water's height, where the splash still has to happen
    inAt: null, // finished: where it goes into the water
  };
}

/** Charge 0..1 from seconds held. */
export function chargeOf(held, fish) {
  const full = FLOP.minHold + (FLOP.fullHold - FLOP.minHold) * (fish?.charge ?? 1);
  const c = (held - FLOP.minHold) / (full - FLOP.minHold);
  return c < 0 ? 0 : c > 1 ? 1 : c;
}

export const dirOf = (yaw) => [Math.sin(yaw), Math.cos(yaw)];

/**
 * The launch velocity of a flop. `vel` is the fish's horizontal velocity to carry ([vx, vz]), `carry` the share kept,
 * `power` × the flop, `wall` a wall normal [x, z] when flopping off a wall.
 */
export function launchVelocity(fish, yaw, charge, vel, carry, power, wall, out = [0, 0, 0]) {
  const H = fish.height, G = fish.gravity, R = fish.range;
  let dx = Math.sin(yaw), dz = Math.cos(yaw);
  let lift = 1;
  if (wall) {
    const dot = dx * wall[0] + dz * wall[1];
    if (dot < 0) {
      dx -= 2 * dot * wall[0];
      dz -= 2 * dot * wall[1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      lift = FLOP.wallLift;
    }
  }
  const vy = (FLOP.vyMin + (FLOP.vyMax - FLOP.vyMin) * charge) * Math.sqrt(G * H) * power * lift;
  let vh = ((FLOP.vhMin + (FLOP.vhMax - FLOP.vhMin) * charge) * R) / Math.sqrt(H / G) * power;
  if (vel) {
    const along = vel[0] * dx + vel[1] * dz;
    if (along > 0) vh += along * carry;
  }
  out[0] = dx * vh;
  out[1] = vy;
  out[2] = dz * vh;
  return out;
}

const tmp = { nx: 0, ny: 0, nz: 0, depth: 0 };
const vtmp = [0, 0, 0];

function surfOf(name) {
  return SURFACES[name] ?? SURFACES.tile;
}

/** Can it flop now (touching something, not stunned)? */
export const canFlop = (b) => b.state === 'ok' && b.stun <= 0 && b.t - b.contactT <= FLOP.coyote;

function flop(b, yaw, charge, slap, perfect = false) {
  const fish = b.fish;
  const vel = slap ? b.touchV : [b.vx, b.vz];
  const wall = !b.ground && b.wall ? b.wall : null;
  launchVelocity(fish, yaw, charge, vel, slap ? SLAP.carry : FLOP.carry, slap ? slapPower(b.slapChain, perfect) : 1, wall, vtmp);
  const springy = slap && !!SURFACES[b.touchSurf]?.minUp;
  const along = springy ? SLAP.springy.along : 1;
  b.vx = vtmp[0] * along;
  b.vy = vtmp[1] * (springy ? SLAP.springy.up : 1);
  b.vz = vtmp[2] * along;
  b.yaw = yaw;
  b.ground = false;
  b.contactT = -1;
  b.airT = 0;
  b.stick = 0;
  b.flops++;
  if (b.slide > 0.5) b.events.push({ type: 'slide', dist: b.slide });
  b.slide = 0;
  if (!slap && b.slapChain > 0) b.events.push({ type: 'flowEnd', chain: b.slapChain });
  b.slapChain = slap ? b.slapChain + 1 : 0;
  if (b.slapChain > b.bestChain) b.bestChain = b.slapChain;
  if (slap && perfect) b.perfects++;
  b.events.push({ type: 'flop', charge, slap, perfect: !!(slap && perfect), chain: b.slapChain, wall: !!wall, springy });
}

export function respawn(b, at = b.refill) {
  b.x = at[0];
  b.y = at[1] + 0.05;
  b.z = at[2];
  b.vx = b.vy = b.vz = 0;
  b.m = WATER.max;
  b.state = 'ok';
  b.stun = 0;
  b.stick = 0;
  b.queued = null;
  b.holding = false;
  b.holdT = 0;
  b.slide = 0;
  if (b.slapChain > 0) b.events.push({ type: 'flowEnd', chain: b.slapChain });
  b.slapChain = 0;
  b.grab = null;
  b.airT = 0.3;
  b.events.push({ type: 'respawn' });
}

/**
 * One fixed step. `input` { hold, yaw }; `env` { world, twist, hazards, t } (t: race seconds, for hazards).
 * Appends what happened to `b.events` (the page turns them into sound and motion).
 */
export function stepBody(b, input, env, dt = STEP) {
  const world = env.world;
  const twist = env.twist ?? NO_TWIST;
  const fish = b.fish;
  b.t += dt;
  if (b.stun > 0) b.stun -= dt;
  if (b.state === 'done') {
    // in the water: carry on down under the surface (the splash has happened), then stay
    if (b.y > b.doneY) {
      const y0 = b.y;
      b.vy -= GRAVITY * fish.gravity * dt;
      b.x += b.vx * 0.6 * dt;
      b.y += b.vy * dt;
      b.z += b.vz * 0.6 * dt;
      if (b.surfY !== null && y0 > b.surfY && b.y <= b.surfY) b.events.push({ type: 'splashdown', x: b.x, y: b.surfY, z: b.z });
      if (b.y <= b.doneY) {
        b.y = b.doneY;
        b.vx = b.vy = b.vz = 0;
      }
    }
    return;
  }

  // Carried by a gull: the hazard moves us.
  if (b.state === 'grab') {
    const g = env.hazards?.carry?.(b, env.t);
    if (g && !g.done) {
      b.x = g.pos[0];
      b.y = g.pos[1];
      b.z = g.pos[2];
      b.vx = g.vel[0];
      b.vy = g.vel[1];
      b.vz = g.vel[2];
      b.holdT = 0;
      b.holding = false;
      return;
    }
    b.state = 'ok';
    b.grab = null;
    b.stun = STUN;
    b.airT = 0.3;
    b.events.push({ type: 'drop' });
  }

  // Input: hold to charge, let go to flop (in the air, the release waits for touchdown).
  if (b.state === 'ok') {
    const hold = !!input.hold && b.stun <= 0;
    if (hold) {
      if (!b.holding) b.holdT = 0;
      b.holdT += dt;
      b.holding = true;
    } else if (b.holding) {
      b.holding = false;
      const charge = chargeOf(b.holdT, fish);
      b.holdT = 0;
      if (canFlop(b)) {
        const late = b.t - b.touchT;
        const slap = late <= SLAP.after;
        flop(b, input.yaw, charge, slap, late <= FLOW.perfect);
      } else {
        b.queued = { charge, at: b.t };
      }
    }
    if (b.queued && canFlop(b)) {
      const slap = b.touchT >= b.queued.at - 1e-6 && b.touchT - b.queued.at <= SLAP.before && b.t - b.touchT <= SLAP.after;
      const q = b.queued;
      b.queued = null;
      flop(b, input.yaw, q.charge, slap, b.touchT - q.at <= FLOW.perfect);
    }
  } else {
    b.holding = false;
    b.holdT = 0;
  }

  // Forces.
  const g = GRAVITY * fish.gravity;
  b.vy -= g * dt;
  if (!b.ground && (twist.wind[0] || twist.wind[1])) {
    b.vx += twist.wind[0] * dt;
    b.vz += twist.wind[1] * dt;
  }
  if (!b.ground && world.updrafts.length) updraft(world, b.x, b.y, b.z, b, dt);
  if (b.ground) {
    // friction pulls toward the ground's own motion (a belt, a pan): standing on it, you go with it
    const s = surfOf(b.surf);
    const gx = b.gv[0], gz = b.gv[1];
    const rx = b.vx - gx, rz = b.vz - gz;
    const hs = Math.hypot(rx, rz);
    const dec = s.friction * fish.friction * twist.friction * dt;
    if (hs <= dec) {
      b.vx = gx;
      b.vz = gz;
    } else {
      const k = (hs - dec) / hs;
      b.vx = gx + rx * k;
      b.vz = gz + rz * k;
    }
    if (hs > 1.2 && s.friction <= 3.5) b.slide += hs * dt;
    else if (hs < 0.4 && b.slide > 0) {
      if (b.slide > 0.5) b.events.push({ type: 'slide', dist: b.slide });
      b.slide = 0;
    }
  }
  if (b.stick > 0) {
    b.stick -= dt;
    b.vx = b.vz = 0;
    if (b.vy > 0) b.vy = 0;
  }

  // Move, then resolve contacts.
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  const wasAir = b.airT;
  const r = BODY_RADIUS;
  let ground = false;
  let groundSurf = null;
  let wallN = null;
  let landed = false;
  let gvx = 0, gvz = 0;
  const solids = env.hazards?.solids ? env.hazards.solids(env.t) : null;
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    const list = world.query(b.x, b.y, b.z, r);
    for (let pass = 0; pass < 3; pass++) {
      const cols = pass === 0 ? list : pass === 1 ? world.dynamic : solids;
      if (!cols) continue;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        if (!contact(col, b.x, b.y, b.z, r, tmp)) continue;
        if (tmp.depth <= 1e-6) continue;
        any = true;
        const nx = tmp.nx, ny = tmp.ny, nz = tmp.nz;
        b.x += nx * tmp.depth;
        b.y += ny * tmp.depth;
        b.z += nz * tmp.depth;
        const cv = col.v;
        const rvx = b.vx - (cv ? cv[0] : 0), rvy = b.vy - (cv ? cv[1] : 0), rvz = b.vz - (cv ? cv[2] : 0);
        const vn = rvx * nx + rvy * ny + rvz * nz;
        if (col.knock && pass === 1) {
          env.hazards?.hit?.(b, col, env.t);
          continue;
        }
        const s = surfOf(col.surf);
        if (ny > GROUND_NY) {
          ground = true;
          groundSurf = col.surf;
          b.gn[0] = nx; b.gn[1] = ny; b.gn[2] = nz;
          gvx = col.belt ? col.belt[0] : cv ? cv[0] : 0;
          gvz = col.belt ? col.belt[1] : cv ? cv[2] : 0;
          if (vn < 0) {
            const impact = -vn;
            let tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz;
            let out = 0;
            if (wasAir > 0.05 && impact > RESTING && !landed) {
              landed = true;
              const rest = Math.max(0, s.rest + fish.rest);
              out = impact * rest;
              if (s.minUp) out = Math.max(out, s.minUp);
              if (out < RESTING) out = 0;
              const keep = s.keep;
              tx *= keep; ty *= keep; tz *= keep;
              if (wasAir >= SLAP.minAir) {
                b.touchT = b.t;
                b.touchV[0] = b.vx;
                b.touchV[1] = b.vz;
                b.touchSurf = col.surf;
              }
              if (s.sticky) b.stick = s.sticky;
              b.events.push({ type: 'land', surf: col.surf, speed: impact, x: b.x, y: b.y - r, z: b.z, air: wasAir, bounce: out > 0 });
            }
            b.vx = tx + nx * out + (cv ? cv[0] : 0);
            b.vy = ty + ny * out + (cv ? cv[1] : 0);
            b.vz = tz + nz * out + (cv ? cv[2] : 0);
          }
        } else {
          if (ny > -0.3) {
            wallN = [nx, nz];
            const l = Math.hypot(nx, nz) || 1;
            wallN[0] /= l;
            wallN[1] /= l;
          }
          if (vn < 0) {
            const bounce = impactBounce(-vn, s);
            b.vx += -vn * nx * (1 + bounce);
            b.vy += -vn * ny * (1 + bounce);
            b.vz += -vn * nz * (1 + bounce);
            if (-vn > 2.5 && wasAir > 0.05) b.events.push({ type: 'bonk', surf: col.surf, speed: -vn, x: b.x, y: b.y, z: b.z });
          }
        }
      }
    }
    if (!any) break;
  }

  if (ground || wallN) b.contactT = b.t;
  b.wall = ground ? null : wallN ?? (b.t - b.contactT <= FLOP.coyote ? b.wall : null);
  b.ground = ground;
  b.gv[0] = gvx;
  b.gv[1] = gvz;
  if (ground) {
    b.surf = groundSurf;
    b.lastSurf = groundSurf;
    b.airT = 0;
    // a chain of slaps ends when the fish lies there past the slap's moment
    if (b.slapChain > 0 && !b.queued && b.t - b.touchT > SLAP.after + 1e-6) {
      b.events.push({ type: 'flowEnd', chain: b.slapChain });
      b.slapChain = 0;
    }
  } else {
    b.airT += dt;
    if (b.slide > 0 && b.airT > 0.15) {
      if (b.slide > 0.5) b.events.push({ type: 'slide', dist: b.slide });
      b.slide = 0;
    }
  }

  // Zones: water in, the finish, shade, heat, drains.
  const zones = world.zonesAt(b.x, b.y, b.z, b.zones);
  let refill = 0;
  let shadeZone = false;
  let heat = 1;
  let wetSurf = null;
  for (const zone of zones) {
    if (zone.kind === 'finish') {
      b.state = 'done';
      b.doneY = Math.max(zone.min[1] + 0.2, b.y - (zone.depth ?? 1.6));
      b.events.push({ type: 'finish', x: b.x, y: b.y, z: b.z });
      // the splash comes when it reaches the water: now if it's already in, or on the way down
      b.surfY = zone.surface ?? null;
      if (b.surfY === null || b.y <= b.surfY || b.doneY >= b.surfY) {
        b.surfY = null;
        b.inAt = [b.x, b.y, b.z];
        b.events.push({ type: 'splashdown', x: b.x, y: b.y, z: b.z });
      } else {
        // where it will go in (the camera turns to it before it gets there)
        const g = GRAVITY * fish.gravity;
        const t = (b.vy + Math.sqrt(b.vy * b.vy + 2 * g * (b.y - b.surfY))) / g;
        b.inAt = [b.x + b.vx * 0.6 * t, b.surfY, b.z + b.vz * 0.6 * t];
      }
      return;
    }
    if (zone.kind === 'shade') shadeZone = true;
    else if (zone.kind === 'heat') heat = Math.max(heat, zone.k ?? 2);
    else if (zone.kind === 'drain' && b.ground && b.state === 'ok') {
      b.events.push({ type: 'drain', x: b.x, y: b.y, z: b.z });
      respawn(b);
      return;
    }
    if (zone.rate) {
      refill += zone.rate;
      if (zone.respawn && b.refillId !== zone.id) {
        b.refillId = zone.id;
        b.refill = zone.respawn;
      }
      if (zone.surf && b.ground) wetSurf = zone.surf;
    }
  }
  const dyn = env.hazards?.refill?.(b, env.t) ?? 0;
  refill += dyn;
  if (wetSurf) b.surf = wetSurf;

  // The sun (looked up a few times a second: nothing between the fish and the sun means sun).
  if (b.t >= b.sunT) {
    b.sunT = b.t + 0.05;
    const lit = !shadeZone && world.sunlit(b.x, b.y + 0.12, b.z);
    if (lit !== b.sun) {
      b.sun = lit;
      b.events.push({ type: 'sun', on: lit });
    }
  }

  // Water.
  if (b.state === 'ok') {
    const s = surfOf(b.ground ? b.surf : b.lastSurf);
    const light = world.sun ? (b.sun && !shadeZone ? WATER.sun : WATER.shade) : shadeZone ? WATER.shade : 1;
    const drain = WATER.base * s.drain * (s.drain > 0 ? twist.drain * light * heat : 1);
    const before = b.m;
    b.m += (refill - drain) * dt;
    if (b.m > WATER.max) b.m = WATER.max;
    if (refill > 0 && before < WATER.max - 1 && (b.t - (b.lastRefillEv ?? -9)) > 0.4) {
      b.lastRefillEv = b.t;
      b.events.push({ type: 'refill', amount: refill });
    }
    if (b.m <= 0) {
      b.m = 0;
      b.state = 'dry';
      b.dryT = WATER.dryTime;
      b.queued = null;
      b.events.push({ type: 'dry' });
    }
  } else if (b.state === 'dry') {
    b.dryT -= dt;
    if (b.dryT <= 0) respawn(b);
  }

  // Pickups: drops and golden scales.
  if (b.state === 'ok' && world.items.length) pickUp(b, world);

  // Hazards that reach in (a swipe, a slam, a gull).
  if (b.state === 'ok') env.hazards?.affect?.(b, env.t);

  // Out of the world: back to the last puddle.
  const bd = world.bounds;
  if (bd && (b.y < bd.minY || b.x < bd.min[0] || b.x > bd.max[0] || b.z < bd.min[1] || b.z > bd.max[1])) respawn(b);
}

function impactBounce(speed, s) {
  return speed > 2 ? Math.min(0.35, s.rest) : 0;
}

/** Rising air: pushes a fish in the air up, toward the zone's top speed. */
/** Rising air lifts `v` ({ vx, vy, vz }) in its column; a spout (`spread`) also throws it out from the middle (along
 *  `dir` when it's dead centre), so nothing hovers in one for ever. */
function updraft(world, x, y, z, v, dt) {
  for (const zone of world.updrafts) {
    if (!inZone(zone, x, y, z)) continue;
    const top = zone.maxUp ?? UPDRAFT.maxUp;
    if (v.vy < top) v.vy = Math.min(top, v.vy + zone.lift * dt);
    if (zone.spread) {
      let dx = x - zone.c[0], dz = z - zone.c[2];
      const d = Math.hypot(dx, dz);
      if (d < zone.r * 0.2) {
        dx = zone.dir?.[0] ?? 0;
        dz = zone.dir?.[1] ?? 1;
      } else {
        dx /= d;
        dz /= d;
      }
      v.vx += dx * zone.spread * dt;
      v.vz += dz * zone.spread * dt;
    }
  }
}
const upV = { vx: 0, vy: 0, vz: 0 };

function pickUp(b, world) {
  const items = world.items;
  if (!b.got || b.got.length !== items.length) b.got = new Uint8Array(items.length);
  for (let i = 0; i < items.length; i++) {
    if (b.got[i]) continue;
    const it = items[i];
    const p = it.p;
    const dx = b.x - p[0], dy = b.y - p[1], dz = b.z - p[2];
    if (Math.abs(dz) > 1 || Math.abs(dx) > 1) continue;
    const rr = (it.kind === 'scale' ? SCALES.radius : DROPS.radius) + BODY_RADIUS;
    if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
    b.got[i] = 1;
    if (it.kind === 'scale') {
      b.scales.push(it.n);
      b.events.push({ type: 'pick', kind: 'scale', i, n: it.n, x: p[0], y: p[1], z: p[2] });
    } else {
      b.drops++;
      b.m = Math.min(WATER.max, b.m + DROPS.water);
      b.events.push({ type: 'pick', kind: 'drop', i, n: b.drops, x: p[0], y: p[1], z: p[2] });
    }
  }
}

/** A knock from a hazard: the fish flies off, can't flop for a moment. */
export function knock(b, v, kind) {
  b.vx = v[0];
  b.vy = v[1];
  b.vz = v[2];
  b.ground = false;
  b.airT = 0.06;
  b.stun = STUN;
  b.queued = null;
  b.holding = false;
  b.holdT = 0;
  b.stick = 0;
  if (b.slapChain > 0) b.events.push({ type: 'flowEnd', chain: b.slapChain });
  b.slapChain = 0;
  b.events.push({ type: 'knock', kind, x: b.x, y: b.y, z: b.z });
}

/**
 * Where a flop would go: the arc's points (every `every` steps) and the first thing it touches. Runs the same launch,
 * gravity, wind and rising air as stepBody, against the static world. `from` overrides the start ({ x, y, z, vel:[vx,vz],
 * slap, chain, perfect, wall }): a slap from where the fish will land, `chain` slaps already in a row.
 */
export function predictArc(b, world, yaw, charge, twist = NO_TWIST, opts = {}) {
  const fish = b.fish;
  const from = opts.from ?? null;
  const slap = from ? !!from.slap : false;
  const vel = from ? from.vel : [b.vx, b.vz];
  const wall = from ? from.wall ?? null : !b.ground && b.wall ? b.wall : null;
  const power = slap ? slapPower(from.chain ?? 0, !!from.perfect) : 1;
  const v = launchVelocity(fish, yaw, charge, vel, slap ? SLAP.carry : FLOP.carry, power, wall, [0, 0, 0]);
  if (slap && SURFACES[from.surf]?.minUp) {
    v[0] *= SLAP.springy.along;
    v[1] *= SLAP.springy.up;
    v[2] *= SLAP.springy.along;
  }
  const x = from ? from.x : b.x, y = from ? from.y : b.y, z = from ? from.z : b.z;
  return trace(fish, world, x, y, z, v[0], v[1], v[2], twist, opts);
}

/** Where a fish in the air comes down, as it flies now (for the slap ring): same result shape as predictArc. */
export function predictFall(b, world, twist = NO_TWIST, opts = {}) {
  return trace(b.fish, world, b.x, b.y, b.z, b.vx, b.vy, b.vz, twist, { ...opts, falling: true });
}

function trace(fish, world, x, y, z, vx, vy, vz, twist, opts) {
  const dt = opts.dt ?? STEP;
  const g = GRAVITY * fish.gravity;
  const points = opts.points ?? null;
  if (points) points.length = 0;
  const every = opts.every ?? 4;
  const r = BODY_RADIUS;
  const maxT = opts.maxT ?? 3;
  twist = twist ?? NO_TWIST;
  let t = 0;
  let n = 0;
  if (points) points.push(x, y, z);
  // Walls the fish is already leaning on: the real step slides off them, so we do too instead of stopping there.
  const leaning = [];
  for (const col of world.query(x, y, z, r + 0.03)) if (contact(col, x, y, z, r + 0.03, tmp) && tmp.ny <= GROUND_NY) leaning.push(col);
  // (a falling fish already touching the ground beneath doesn't count that as where it lands)
  const resting = [];
  if (opts.falling) for (const col of world.query(x, y, z, r + 0.01)) if (contact(col, x, y, z, r + 0.01, tmp) && tmp.ny > GROUND_NY) resting.push(col);
  const ups = world.updrafts?.length ? world.updrafts : null;
  // The real step moves first, then resolves: so do we, and we stop at the first contact we're moving into.
  while (t < maxT) {
    t += dt;
    vy -= g * dt;
    if (twist.wind[0] || twist.wind[1]) {
      vx += twist.wind[0] * dt;
      vz += twist.wind[1] * dt;
    }
    if (ups) {
      upV.vx = vx;
      upV.vy = vy;
      upV.vz = vz;
      updraft(world, x, y, z, upV, dt);
      vx = upV.vx;
      vy = upV.vy;
      vz = upV.vz;
    }
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    n++;
    const list = world.query(x, y, z, r);
    let hit = null;
    let ny = 0;
    for (let i = 0; i < list.length; i++) {
      const col = list[i];
      if (!contact(col, x, y, z, r, tmp)) continue;
      if (tmp.depth <= 1e-6) continue;
      const vn = vx * tmp.nx + vy * tmp.ny + vz * tmp.nz;
      if (vn >= 0) continue;
      x += tmp.nx * tmp.depth;
      y += tmp.ny * tmp.depth;
      z += tmp.nz * tmp.depth;
      if (tmp.ny <= GROUND_NY && leaning.includes(col)) {
        const bounce = impactBounce(-vn, surfOf(col.surf));
        vx += -vn * tmp.nx * (1 + bounce);
        vy += -vn * tmp.ny * (1 + bounce);
        vz += -vn * tmp.nz * (1 + bounce);
        continue;
      }
      if (resting.includes(col) && n < 3) continue;
      if (!hit || tmp.ny > ny) {
        hit = col;
        ny = tmp.ny;
      }
    }
    if (points && (n % every === 0 || hit)) points.push(x, y, z);
    if (!hit && world.finishes) {
      for (const fz of world.finishes) if (inZone(fz, x, y, z)) return { x, y, z, t, surf: 'water', ground: true, zone: fz, vx, vy, vz };
    }
    if (hit) {
      const zones = world.zonesAt(x, y, z, []);
      const zone = zones.find((zz) => zz.kind === 'finish') ?? zones.find((zz) => zz.rate) ?? null;
      return { x, y, z, t, surf: hit.surf, ground: ny > GROUND_NY, zone, vx, vy, vz };
    }
    if (world.bounds && y < world.bounds.minY) break;
  }
  return { x, y, z, t, surf: null, ground: false, zone: null, vx, vy, vz };
}
