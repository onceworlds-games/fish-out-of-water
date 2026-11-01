// A fish's gameplay body: one sphere that flops, flies, bounces, slides and dries out. The arc preview runs the same
// code, so what it shows is where the fish lands. Pure: node tests and every page use it.

import { STEP, GRAVITY, BODY_RADIUS, FLOP, SLAP, STUN, RESTING, GROUND_NY, WATER, SURFACES, fishById } from './config.js';
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
    slapChain: 0,
    grab: null,
    flops: 0,
    events: [],
    zones: [],
    hits: {},
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

function flop(b, yaw, charge, slap) {
  const fish = b.fish;
  const vel = slap ? b.touchV : [b.vx, b.vz];
  const wall = !b.ground && b.wall ? b.wall : null;
  launchVelocity(fish, yaw, charge, vel, slap ? SLAP.carry : FLOP.carry, slap ? SLAP.power : 1, wall, vtmp);
  b.vx = vtmp[0];
  b.vy = vtmp[1];
  b.vz = vtmp[2];
  b.yaw = yaw;
  b.ground = false;
  b.contactT = -1;
  b.airT = 0;
  b.stick = 0;
  b.flops++;
  if (b.slide > 0.5) b.events.push({ type: 'slide', dist: b.slide });
  b.slide = 0;
  b.slapChain = slap ? b.slapChain + 1 : 0;
  b.events.push({ type: 'flop', charge, slap, chain: b.slapChain, wall: !!wall });
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
      b.vy -= GRAVITY * fish.gravity * dt;
      b.x += b.vx * 0.6 * dt;
      b.y += b.vy * dt;
      b.z += b.vz * 0.6 * dt;
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
        const slap = b.t - b.touchT <= SLAP.after;
        flop(b, input.yaw, charge, slap);
      } else {
        b.queued = { charge, at: b.t };
      }
    }
    if (b.queued && canFlop(b)) {
      const slap = b.touchT >= b.queued.at - 1e-6 && b.touchT - b.queued.at <= SLAP.before && b.t - b.touchT <= SLAP.after;
      const q = b.queued;
      b.queued = null;
      flop(b, input.yaw, q.charge, slap);
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
  if (b.ground) {
    const s = surfOf(b.surf);
    const hs = Math.hypot(b.vx, b.vz);
    const dec = s.friction * fish.friction * twist.friction * dt;
    if (hs <= dec) {
      b.vx = 0;
      b.vz = 0;
    } else {
      const k = (hs - dec) / hs;
      b.vx *= k;
      b.vz *= k;
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
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    const list = world.query(b.x, b.y, b.z, r);
    for (let pass = 0; pass < 2; pass++) {
      const cols = pass === 0 ? list : world.dynamic;
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
  if (ground) {
    b.surf = groundSurf;
    b.lastSurf = groundSurf;
    b.airT = 0;
  } else {
    b.airT += dt;
    if (b.slide > 0 && b.airT > 0.15) {
      if (b.slide > 0.5) b.events.push({ type: 'slide', dist: b.slide });
      b.slide = 0;
    }
  }

  // Zones: water in, the finish, shade.
  const zones = world.zonesAt(b.x, b.y, b.z, b.zones);
  let refill = 0;
  let shade = 1;
  let wetSurf = null;
  for (const zone of zones) {
    if (zone.kind === 'finish') {
      b.state = 'done';
      b.doneY = Math.max(zone.min[1] + 0.2, b.y - 1.6);
      b.events.push({ type: 'finish', x: b.x, y: b.y, z: b.z });
      return;
    }
    if (zone.kind === 'shade') shade = Math.min(shade, WATER.shade);
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

  // Water.
  if (b.state === 'ok') {
    const s = surfOf(b.ground ? b.surf : b.lastSurf);
    const drain = WATER.base * s.drain * (s.drain > 0 ? twist.drain * shade : 1);
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

  // Hazards that reach in (a swipe, a slam, a gull).
  if (b.state === 'ok') env.hazards?.affect?.(b, env.t);

  // Out of the world: back to the last puddle.
  const bd = world.bounds;
  if (bd && (b.y < bd.minY || b.x < bd.min[0] || b.x > bd.max[0] || b.z < bd.min[1] || b.z > bd.max[1])) respawn(b);
}

function impactBounce(speed, s) {
  return speed > 2 ? Math.min(0.35, s.rest) : 0;
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
  b.events.push({ type: 'knock', kind, x: b.x, y: b.y, z: b.z });
}

/**
 * Where a flop would go: the arc's points (every `every` steps) and the first thing it touches. Runs the same launch,
 * gravity and wind as stepBody, against the static world. `from` overrides the start ({ x, y, z, vel:[vx,vz], slap, wall }).
 */
export function predictArc(b, world, yaw, charge, twist = NO_TWIST, opts = {}) {
  const fish = b.fish;
  const dt = opts.dt ?? STEP;
  const from = opts.from ?? null;
  const slap = from ? !!from.slap : false;
  const vel = from ? from.vel : [b.vx, b.vz];
  const wall = from ? from.wall ?? null : !b.ground && b.wall ? b.wall : null;
  const v = launchVelocity(fish, yaw, charge, vel, slap ? SLAP.carry : FLOP.carry, slap ? SLAP.power : 1, wall, [0, 0, 0]);
  let x = from ? from.x : b.x, y = from ? from.y : b.y, z = from ? from.z : b.z;
  let vx = v[0], vy = v[1], vz = v[2];
  const g = GRAVITY * fish.gravity;
  const points = opts.points ?? null;
  if (points) points.length = 0;
  const every = opts.every ?? 4;
  const r = BODY_RADIUS;
  const maxT = opts.maxT ?? 3;
  let t = 0;
  let n = 0;
  if (points) points.push(x, y, z);
  // Walls the fish is already leaning on: the real step slides off them, so we do too instead of stopping there.
  const leaning = [];
  for (const col of world.query(x, y, z, r + 0.03)) if (contact(col, x, y, z, r + 0.03, tmp) && tmp.ny <= GROUND_NY) leaning.push(col);
  // The real step moves first, then resolves: so do we, and we stop at the first contact we're moving into.
  while (t < maxT) {
    t += dt;
    vy -= g * dt;
    if (twist.wind[0] || twist.wind[1]) {
      vx += twist.wind[0] * dt;
      vz += twist.wind[1] * dt;
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
