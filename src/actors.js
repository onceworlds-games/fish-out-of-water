// The fish on screen: yours (simulated here), bots (simulated by the host, or drawn from its snapshots), other players
// (drawn from their presence), ghosts (from a recorded run) and the title's wanderers. Each turns into a fish view, sounds
// and splashes the same way.

import { createFishView, COLOURWAYS } from './render/fish.js';
import { STEP, FISH, SEAT_COLOURS, WATER } from './sim/config.js';
import { createBody, stepBody, chargeOf } from './sim/body.js';

export const FISH_IDS = FISH.map((f) => f.id);
const WET_SURF = new Set(['wet', 'water', 'ice', 'wetsand']);

/**
 * ctx: { scene, audio, fx, cam, listener: () => {x,y,z} } (sounds fade with distance from the listener).
 * o: { id, name, seat (index), fish, cw, kind: 'me' | 'bot' | 'remote' | 'ghost' | 'wander', ghostColor, look: { hat, trail,
 * splash } }
 */
export function createActor(ctx, o) {
  const seat = SEAT_COLOURS[(o.seat ?? 0) % SEAT_COLOURS.length];
  const look = o.kind === 'ghost' ? {} : o.look ?? {};
  const view = createFishView(o.fish, o.cw ?? 0, { ghost: o.kind === 'ghost', ghostColor: o.ghostColor, pin: seat.hex, tag: o.kind !== 'ghost', hat: look.hat && look.hat !== 'none' ? look.hat : null });
  ctx.scene.add(view.group);
  const a = {
    id: o.id,
    name: o.name ?? '',
    seatIndex: o.seat ?? 0,
    seat,
    fish: o.fish,
    cw: o.cw ?? 0,
    kind: o.kind,
    look,
    trailState: {},
    view,
    body: null,
    brain: null,
    simT: 0,
    hint: -1,
    prog: 0,
    done: false,
    finishT: null,
    gone: false,
    visible: true,
    rs: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, aim: 0, curl: 0, ground: true, wet: 1, state: 'ok' },
    last: null, // previous drawn position (for velocities of remote fish)
    n: 0,
    l: 0,
    track: null,
    nextTrack: 0,
    dispose() {
      ctx.scene.remove(view.group);
      view.dispose();
    },
  };
  // the trail rides on the view's own frame update (wherever the page draws this fish)
  if (look.trail && o.kind !== 'ghost') {
    const draw = view.update;
    view.update = (dt, rs) => {
      draw(dt, rs);
      if (rs === a.rs) emitTrail(ctx, a, dt);
    };
  }
  return a;
}

/** Give an actor a body to simulate (yours, a host's bot, a wanderer, a podium fish). */
export function giveBody(a, pos, yaw) {
  a.body = createBody(a.fish, pos, yaw);
  a.simT = 0;
  a.rs.aim = yaw;
  return a.body;
}

/**
 * Step a simulated actor up to time `until` (fixed steps). inputFn(a, dt, t) → { hold, yaw }. env: { world, hazards, twist }.
 * Events go to `onEvent(a, e)`. Returns the number of steps.
 */
export function simulate(a, until, inputFn, env, onEvent, maxSteps = 60) {
  const b = a.body;
  if (!b) return 0;
  if (until - a.simT > maxSteps * STEP) a.simT = until - maxSteps * STEP;
  let n = 0;
  while (a.simT + STEP <= until + 1e-9) {
    a.simT += STEP;
    env.t = a.simT;
    b.px = b.x;
    b.py = b.y;
    b.pz = b.z;
    const input = inputFn(a, STEP, a.simT);
    stepBody(b, input, env);
    if (input.yaw !== undefined) a.rs.aim = input.yaw;
    for (const e of b.events) {
      if (e.type === 'flop') a.n++;
      else if (e.type === 'land') a.l++;
      else if (e.type === 'finish' && a.finishT === null) a.finishT = a.simT;
      onEvent?.(a, e);
    }
    b.events.length = 0;
    if (a.track && a.simT >= a.nextTrack) {
      a.track.push([a.nextTrack, b.x, b.y, b.z, a.rs.aim]);
      a.nextTrack += 0.125;
    }
    n++;
  }
  a.alpha = Math.max(0, Math.min(1, (until - a.simT) / STEP));
  return n;
}

/** Copy a simulated body into the render state, between its last two steps (so motion is smooth at any frame rate). */
export function syncFromBody(a) {
  const b = a.body;
  const s = a.rs;
  const k = a.alpha ?? 1;
  if (b.px === undefined || Math.abs(b.x - b.px) + Math.abs(b.y - b.py) + Math.abs(b.z - b.pz) > 1.5) {
    s.x = b.x;
    s.y = b.y;
    s.z = b.z;
  } else {
    s.x = b.px + (b.x - b.px) * k;
    s.y = b.py + (b.y - b.py) * k;
    s.z = b.pz + (b.z - b.pz) * k;
  }
  s.vx = b.vx;
  s.vy = b.vy;
  s.vz = b.vz;
  s.ground = b.ground;
  s.curl = b.holding ? chargeOf(b.holdT, b.fish) : 0;
  s.wet = b.m / WATER.max;
  s.state = b.state;
}

/** Set the render state from a network sample { x, y, z, h, c, m, s } (presence or a bot snapshot row). */
export function syncFromSample(a, p, dt) {
  const s = a.rs;
  if (a.last && dt > 0) {
    const vx = (p.x - a.last.x) / dt, vy = (p.y - a.last.y) / dt, vz = (p.z - a.last.z) / dt;
    const k = Math.min(1, dt * 12);
    s.vx += (vx - s.vx) * k;
    s.vy += (vy - s.vy) * k;
    s.vz += (vz - s.vz) * k;
  }
  a.last = { x: p.x, y: p.y, z: p.z };
  s.x = p.x;
  s.y = p.y;
  s.z = p.z;
  s.aim = p.h;
  s.curl = p.c;
  s.wet = p.m / 100;
  const code = p.s & 3;
  s.state = code === 1 ? 'dry' : code === 2 ? 'grab' : code === 3 ? 'done' : 'ok';
  s.ground = (p.s & 4) !== 0;
}

export function stateCode(b) {
  const st = b.state === 'dry' ? 1 : b.state === 'grab' ? 2 : b.state === 'done' ? 3 : 0;
  return st + (b.ground ? 4 : 0);
}

/** The sounds and splashes of one event, for any fish. `near`: 0..1 how close to the listener (1 = yours). */
export function eventFx(ctx, a, e, near = 1) {
  const { audio, fx, cam } = ctx;
  const mine = a.kind === 'me';
  a.view.events([e]);
  const loud = near > 0.15;
  switch (e.type) {
    case 'flop':
      if (loud) audio.flop(e.charge * near, e.slap && mine);
      if (mine) {
        cam.kick?.(2 + e.charge * 5 + (e.slap ? 4 : 0));
        cam.punch?.(-0.08 - e.charge * 0.12);
        if (e.slap) cam.addTrauma(0.12);
      }
      fx.burst(a.rs.x, a.rs.y - 0.1, a.rs.z, 4 + Math.round(e.charge * 6), WET_SURF.has(a.body?.lastSurf) ? 'splash' : 'dust', 0.6 + e.charge * 0.5);
      if (e.slap) fx.burst(a.rs.x, a.rs.y - 0.1, a.rs.z, 14, 'sparkle', 1.2);
      break;
    case 'land': {
      if (loud) audio.land(soundOf(e.surf), e.speed * near);
      const wet = WET_SURF.has(e.surf) || (a.body?.zones?.some?.((z) => z.rate) ?? false);
      const kind = e.surf === 'sand' || e.surf === 'gravel' ? 'sand' : wet ? 'splash' : 'dust';
      fx.burst(e.x, e.y - 0.12, e.z, Math.min(18, 3 + Math.round(e.speed * 1.4)), kind, Math.min(1.4, e.speed / 7));
      if (e.speed > 3.5 && a.kind !== 'ghost') fx.splat(e.x, e.y - 0.15, e.z, 0.24 + Math.min(0.2, e.speed * 0.02), a.rs.wet);
      if (mine) {
        cam.punch?.(Math.min(0.25, e.speed * 0.025));
        if (e.speed > 7) cam.addTrauma(Math.min(0.3, (e.speed - 7) * 0.06));
      }
      break;
    }
    case 'bonk':
      if (loud) audio.bonk();
      if (mine) cam.addTrauma(0.18);
      break;
    case 'refill':
      if (mine) audio.refill();
      fx.burst(a.rs.x, a.rs.y, a.rs.z, 6, 'splash', 0.5);
      break;
    case 'dry':
      if (loud) audio.dry();
      fx.burst(a.rs.x, a.rs.y, a.rs.z, 8, 'dust', 0.6);
      break;
    case 'respawn':
      fx.burst(a.body?.x ?? a.rs.x, (a.body?.y ?? a.rs.y) - 0.1, a.body?.z ?? a.rs.z, 16, 'splash', 1);
      if (mine) audio.refill();
      break;
    case 'knock':
      if (loud) audio.knock(e.kind);
      fx.burst(e.x, e.y, e.z, 10, 'dust', 1);
      if (mine) cam.addTrauma(0.35);
      break;
    case 'finish':
      if (loud) audio.finish();
      break;
    case 'splashdown':
      // where it goes in: a crown of water and the spray (in the fish's own finish style)
      fx.burst(e.x, e.y, e.z, 56, 'splash', 2.4);
      fx.finishSplash(a.look?.splash ?? 'plain', e.x, e.y, e.z);
      if (mine) cam.addTrauma(0.2);
      break;
    case 'grab':
      if (loud) audio.gull(0.24);
      fx.burst(e.x, e.y, e.z, 10, 'splash', 0.8);
      if (mine) cam.addTrauma(0.25);
      break;
    case 'drop':
      if (loud) audio.gull(0.12);
      break;
  }
}

/** The fish's trail while it flies (every frame, after its render state is set). */
export function emitTrail(ctx, a, dt) {
  const kind = a.look?.trail;
  if (!kind || a.rs.ground || a.kind === 'ghost' || a.visible === false || a.rs.state === 'done') return;
  ctx.fx.trail(a.trailState, kind, a.rs.x, a.rs.y, a.rs.z, Math.hypot(a.rs.vx, a.rs.vy, a.rs.vz), dt);
}

const SOUND_OF = { tile: 'slap', wet: 'wet', stone: 'slap', wood: 'thud', steel: 'plink', ice: 'ice', sand: 'sand', wetsand: 'sand', gravel: 'gravel', grass: 'grass', hot: 'sizzle', plush: 'plush', rail: 'plink', bounce: 'boing', net: 'net', water: 'splash', wall: 'thud' };
export const soundOf = (surf) => SOUND_OF[surf] ?? 'slap';

/** A remote fish's flops and landings, from counters in its presence. */
export function remoteEvents(ctx, a, p, near) {
  if (p.n > a.n && a.n > 0) eventFx(ctx, a, { type: 'flop', charge: 0.7, slap: false }, near);
  if (p.l > a.l && a.l > 0) {
    eventFx(ctx, a, { type: 'land', surf: 'tile', speed: Math.max(3, Math.abs(a.rs.vy)), x: a.rs.x, y: a.rs.y, z: a.rs.z }, near);
  }
  a.n = p.n;
  a.l = p.l;
}

export { COLOURWAYS };
