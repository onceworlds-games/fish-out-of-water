// Hazards: pure functions of the course and the race clock, so every page sees the same cat at the same moment with no
// messages. Each one is telegraphed before it strikes. A page applies them only to its own fish (the host to the bots).

import { knock } from './body.js';
import { box } from './world.js';
import { NEAR_MISS } from './config.js';
import { hashString, mulberry32 } from './rng.js';

const TAU = Math.PI * 2;
const posMod = (a, n) => ((a % n) + n) % n;

/** A strike that just missed: once per strike, counted on the body. */
function nearMiss(b, h, cycle, kind) {
  b.near ??= {};
  if (b.near[h.id] === cycle || b.hits[h.id] === cycle) return;
  b.near[h.id] = cycle;
  b.close = (b.close ?? 0) + 1;
  b.events.push({ type: 'close', kind, x: b.x, y: b.y, z: b.z });
}

/** Move a box collider to a new centre (its bounds follow). */
function moveBox(col, x, y, z) {
  const dx = x - col.c[0], dy = y - col.c[1], dz = z - col.c[2];
  col.c[0] = x;
  col.c[1] = y;
  col.c[2] = z;
  const a = col.aabb;
  a[0] += dx; a[3] += dx;
  a[1] += dy; a[4] += dy;
  a[2] += dz; a[5] += dz;
}

/** Where a walker is on a back-and-forth path at time t: { x, z, dx, dz } (dx, dz: the way it faces). */
function pingpong(path, speed, t, out) {
  const [a, c] = path;
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const s = posMod(speed * t, 2 * L);
  const fwd = s <= L;
  const d = fwd ? s : 2 * L - s;
  const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
  out.x = a[0] + ux * d;
  out.z = a[1] + uz * d;
  out.dx = fwd ? ux : -ux;
  out.dz = fwd ? uz : -uz;
  return out;
}

const KINDS = {
  // A cat on a barrel swipes one side, then the other. The side about to be swiped shows a red arc for `tele` seconds.
  cat: {
    init(h) {
      h.strike = 0.15;
    },
    state(h, t, s) {
      const local = posMod(t + h.phase, h.period);
      const k = Math.floor((t + h.phase) / h.period);
      s.side = k % 2 === 0 ? -1 : 1;
      s.cycle = k;
      s.tele = local < h.tele ? local / h.tele : 0;
      s.striking = local >= h.tele && local < h.tele + h.strike;
      s.swipe = local >= h.tele ? Math.min(1, (local - h.tele) / 0.35) : 0;
      return s;
    },
    affect(h, b, t, s) {
      if (!s.striking || b.y > h.floor + 1.5) return;
      const dx = b.x - h.at[0], dz = b.z - h.at[2];
      const d = Math.hypot(dx, dz);
      if (d > h.radius + NEAR_MISS || d < 0.05) return;
      if (d > h.radius || (Math.sign(dx) !== s.side && Math.abs(dx) > 0.25)) {
        if (d < h.radius + NEAR_MISS) nearMiss(b, h, s.cycle, 'cat');
        return;
      }
      if (b.hits[h.id] === s.cycle) return;
      b.hits[h.id] = s.cycle;
      const nx = dx / d, nz = dz / d;
      knock(b, [nx * 4.5 + s.side * 3.5, 3.5, nz * 4.5], 'cat');
    },
    danger(h, x, z, t) {
      const s = KINDS.cat.state(h, t, {});
      const dx = x - h.at[0], dz = z - h.at[2];
      const d = Math.hypot(dx, dz);
      if (d > h.radius + 0.3) return false;
      const local = posMod(t + h.phase, h.period);
      return local > h.tele - 0.5 && local < h.tele + 0.35 && (Math.sign(dx) === s.side || Math.abs(dx) < 0.4);
    },
  },

  // A shopper walks back and forth across the aisle; each foot comes down every `stride` seconds. Its shadow darkens first.
  feet: {
    init(h) {
      h.stride = h.stride ?? 0.55;
      h.down = 0.4;
      h.tele = 0.35;
      h.reach = 0.42;
    },
    state(h, t, s) {
      pingpong(h.path, h.speed, t + h.phase, s);
      const k = Math.floor((t + h.phase) / h.stride);
      s.step = k;
      const local = posMod(t + h.phase, h.stride);
      s.local = local / h.stride;
      // the planted foot (k) and the one coming down next (k + 1)
      s.feet = s.feet ?? [{}, {}];
      for (let j = 0; j < 2; j++) {
        const kk = k + j;
        const tk = kk * h.stride - h.phase;
        const p = pingpong(h.path, h.speed, tk + h.phase, {});
        const side = kk % 2 === 0 ? 1 : -1;
        const f = s.feet[j];
        f.x = p.x + -p.dz * 0.15 * side + p.dx * 0.18;
        f.z = p.z + p.dx * 0.15 * side + p.dz * 0.18;
        f.dx = p.dx;
        f.dz = p.dz;
        f.side = side;
        f.k = kk;
      }
      s.tele = local > h.stride - h.tele ? (local - (h.stride - h.tele)) / h.tele : 0;
      s.striking = local < 0.1;
      return s;
    },
    affect(h, b, t, s) {
      if (!s.striking || b.y > (h.floor ?? 0) + 0.9) return;
      const f = s.feet[0];
      const dx = b.x - f.x, dz = b.z - f.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > h.reach * h.reach) {
        if (d2 < (h.reach + NEAR_MISS * 0.5) ** 2) nearMiss(b, h, s.step, 'foot');
        return;
      }
      if (b.hits[h.id] === s.step) return;
      b.hits[h.id] = s.step;
      knock(b, [f.dx * 4 + dx * 3, 2.2, f.dz * 4 + dz * 3], 'foot');
    },
    danger(h, x, z, t) {
      const s = KINDS.feet.state(h, t, {});
      for (const f of s.feet) {
        const dx = x - f.x, dz = z - f.z;
        if (dx * dx + dz * dz < 0.7 * 0.7) return true;
      }
      return false;
    },
  },

  // The chef works the line: he walks to a station, raises his pan (a red circle on the floor for `tele` seconds) and
  // slams it down, then on to the next station and back. He stands `back` metres behind the spot, facing -z.
  chef: {
    init(h) {
      h.period = h.period ?? 3.2;
      h.tele = h.tele ?? 0.8;
      h.strike = 0.15;
      h.slamAt = h.period - 0.5;
      h.radius = h.radius ?? 1.4;
      h.back = h.back ?? 2.0;
      h.floor = h.floor ?? 0;
      const n = h.stations.length;
      h.seq = [];
      for (let i = 0; i < n; i++) h.seq.push(i);
      for (let i = n - 2; i > 0; i--) h.seq.push(i);
    },
    state(h, t, s) {
      const u = t + h.phase;
      const k = Math.floor(u / h.period);
      const local = posMod(u, h.period);
      const cur = h.stations[h.seq[posMod(k, h.seq.length)]];
      const prev = h.stations[h.seq[posMod(k - 1, h.seq.length)]];
      const walkEnd = h.slamAt - h.tele;
      const w = Math.min(1, local / walkEnd);
      const e = w * w * (3 - 2 * w);
      s.cycle = k;
      s.sx = cur[0];
      s.sz = cur[1];
      s.x = prev[0] + (cur[0] - prev[0]) * e;
      s.z = prev[1] + (cur[1] - prev[1]) * e + h.back;
      s.walking = w < 1;
      s.walk = local / walkEnd;
      s.tele = local >= walkEnd && local < h.slamAt ? (local - walkEnd) / h.tele : 0;
      s.striking = local >= h.slamAt && local < h.slamAt + h.strike;
      s.after = local >= h.slamAt ? (local - h.slamAt) / (h.period - h.slamAt) : 0;
      return s;
    },
    affect(h, b, t, s) {
      // his legs are solid: out of a 0.4 m column
      const cx = b.x - s.x, cz = b.z - s.z;
      const cd = Math.hypot(cx, cz);
      if (cd < 0.4 + 0.16 && b.y < h.floor + 1.9 && cd > 1e-4) {
        const push = 0.56 - cd;
        b.x += (cx / cd) * push;
        b.z += (cz / cd) * push;
        const vn = (b.vx * cx + b.vz * cz) / cd;
        if (vn < 0) {
          b.vx -= (vn * cx) / cd;
          b.vz -= (vn * cz) / cd;
        }
      }
      if (!s.striking || b.y > h.floor + 1.0) return;
      const dx = b.x - s.sx, dz = b.z - s.sz;
      const d = Math.hypot(dx, dz);
      if (d > h.radius) {
        if (d < h.radius + NEAR_MISS) nearMiss(b, h, s.cycle, 'pan');
        return;
      }
      if (b.hits[h.id] === s.cycle) return;
      b.hits[h.id] = s.cycle;
      const nx = d > 0.05 ? dx / d : 1, nz = d > 0.05 ? dz / d : 0;
      knock(b, [nx * 6, 4, nz * 6], 'pan');
    },
    danger(h, x, z, t) {
      const s = KINDS.chef.state(h, t, {});
      const dx = x - s.sx, dz = z - s.sz;
      if (dx * dx + dz * dz > (h.radius + 0.4) ** 2) return false;
      const local = posMod(t + h.phase, h.period);
      return local > h.slamAt - h.tele - 0.4 && local < h.slamAt + 0.3;
    },
  },

  // A gull circles over one of its stations, dives (its shadow grows for `dive` seconds), snatches any fish under it,
  // carries it to that station's drop point (back down the beach, or 20 m ahead for the lucky gull) and flies back up.
  // Its whole flight is a function of the clock; a carried fish just rides along. Caught fish can't be caught for 3 s.
  gull: {
    init(h) {
      h.period = h.period ?? 8;
      h.dive = h.dive ?? 1.1;
      h.strike = 0.3;
      h.carry = 1.6;
      h.back = 1.5;
      h.cruiseH = h.cruiseH ?? 5;
      h.cruiseR = h.cruiseR ?? 4;
      h.radius = h.radius ?? 0.8;
      h.floor = h.floor ?? 0;
      h.cruise = h.period - h.dive - h.strike - h.carry - h.back;
    },
    state(h, t, s) {
      const u = t + h.phase;
      const k = Math.floor(u / h.period);
      const local = posMod(u, h.period);
      const n = h.stations.length;
      const st = h.stations[posMod(k, n)];
      const nx = h.stations[posMod(k + 1, n)];
      s.cycle = k;
      s.at = st.at;
      s.drop = st.drop;
      s.tele = 0;
      s.striking = false;
      s.pos = s.pos ?? [0, 0, 0];
      const cruise = (c, uu, out) => {
        const a = uu * 0.9 + (h.spin ?? 0);
        out[0] = c[0] + Math.cos(a) * h.cruiseR;
        out[1] = c[1] + h.cruiseH + Math.sin(uu * 1.7) * 0.3;
        out[2] = c[2] + Math.sin(a) * h.cruiseR;
        s.heading = a + Math.PI / 2;
        return out;
      };
      const A = h.cruise, D = A + h.dive, S = D + h.strike, C = S + h.carry;
      const p = s.pos;
      if (local < A) {
        s.mode = 'cruise';
        cruise(st.at, u, p);
      } else if (local < D) {
        s.mode = 'dive';
        const k1 = (local - A) / h.dive;
        s.tele = k1;
        const from = cruise(st.at, u - local + A, [0, 0, 0]);
        const e = k1 * k1;
        p[0] = from[0] + (st.at[0] - from[0]) * e;
        p[1] = from[1] + (st.at[1] + 0.35 - from[1]) * (1 - Math.pow(1 - k1, 2.2));
        p[2] = from[2] + (st.at[2] - from[2]) * e;
        s.heading = Math.atan2(st.at[0] - from[0], st.at[2] - from[2]);
      } else if (local < S) {
        s.mode = 'strike';
        s.striking = true;
        p[0] = st.at[0];
        p[1] = st.at[1] + 0.35;
        p[2] = st.at[2];
        s.heading = Math.atan2(st.drop[0] - st.at[0], st.drop[2] - st.at[2]);
      } else if (local < C) {
        s.mode = 'carry';
        const k2 = (local - S) / h.carry;
        s.k = k2;
        p[0] = st.at[0] + (st.drop[0] - st.at[0]) * k2;
        p[1] = st.at[1] + 0.35 + Math.sin(k2 * Math.PI) * 4 + (st.drop[1] + 1.2 - st.at[1]) * k2;
        p[2] = st.at[2] + (st.drop[2] - st.at[2]) * k2;
        s.heading = Math.atan2(st.drop[0] - st.at[0], st.drop[2] - st.at[2]);
      } else {
        s.mode = 'back';
        const k3 = (local - C) / h.back;
        const to = cruise(nx.at, u - local + h.period, [0, 0, 0]);
        const e = k3 * k3 * (3 - 2 * k3);
        p[0] = st.drop[0] + (to[0] - st.drop[0]) * e;
        p[1] = st.drop[1] + 1.55 + (to[1] - st.drop[1] - 1.55) * Math.sqrt(k3);
        p[2] = st.drop[2] + (to[2] - st.drop[2]) * e;
        s.heading = Math.atan2(to[0] - st.drop[0], to[2] - st.drop[2]);
      }
      return s;
    },
    affect(h, b, t, s) {
      if (!s.striking || b.y > h.floor + s.at[1] + 1.0) return;
      if ((b.immune ?? -1) > t) return;
      const dx = b.x - s.at[0], dz = b.z - s.at[2];
      const d2 = dx * dx + dz * dz;
      if (d2 > h.radius * h.radius) {
        if (!h.lucky && d2 < (h.radius + NEAR_MISS) ** 2) nearMiss(b, h, s.cycle, 'gull');
        return;
      }
      b.state = 'grab';
      b.grab = { id: h.id, cycle: s.cycle, lucky: !!h.lucky };
      b.holding = false;
      b.holdT = 0;
      b.queued = null;
      b.events.push({ type: 'grab', lucky: !!h.lucky, x: b.x, y: b.y, z: b.z });
    },
    carry(h, b, t) {
      const s = KINDS.gull.state(h, t, {});
      if (s.cycle !== b.grab.cycle || (s.mode !== 'strike' && s.mode !== 'carry')) {
        b.immune = t + 3;
        return { done: true };
      }
      const p = [s.pos[0], s.pos[1] - 0.42, s.pos[2]];
      const s2 = KINDS.gull.state(h, t + 0.02, {});
      const vel = s2.cycle === s.cycle ? [(s2.pos[0] - s.pos[0]) / 0.02, (s2.pos[1] - s.pos[1]) / 0.02, (s2.pos[2] - s.pos[2]) / 0.02] : [0, 0, 0];
      return { pos: p, vel, done: false };
    },
    danger(h, x, z, t) {
      if (h.lucky) return false;
      const local = posMod(t + h.phase, h.period);
      if (local < h.cruise - 0.3 || local > h.cruise + h.dive + h.strike + 0.2) return false;
      const s = KINDS.gull.state(h, t, {});
      const dx = x - s.at[0], dz = z - s.at[2];
      return dx * dx + dz * dz < (h.radius + 0.5) ** 2;
    },
  },

  // A boules lane: a throw every `period` seconds, from alternate ends. For `wind` seconds before a throw the lane's
  // start lights up; the boule then rolls across at `speed`. A boule bowls a fish over.
  boules: {
    init(h) {
      h.period = h.period ?? 2.6;
      h.wind = h.wind ?? 0.8;
      h.speed = h.speed ?? 5;
      h.r = h.r ?? 0.36;
      h.floor = h.floor ?? 0;
      h.len = Math.abs(h.x1 - h.x0);
      h.life = h.len / h.speed;
    },
    state(h, t, s) {
      const u = t + h.phase;
      const k = Math.floor(u / h.period);
      const local = posMod(u, h.period);
      s.balls = s.balls ?? [];
      s.balls.length = 0;
      // every throw still rolling: thrown at the start of its cycle
      const back = Math.ceil(h.life / h.period);
      for (let j = 0; j <= back; j++) {
        const kk = k - j;
        const age = local + j * h.period;
        if (age < 0 || age > h.life) continue;
        const dir = kk % 2 === 0 ? 1 : -1;
        const x = dir > 0 ? h.x0 + h.speed * age : h.x1 - h.speed * age;
        s.balls.push({ x, z: h.z, dir, k: kk, roll: age * h.speed / h.r });
      }
      // the next throw's wind-up
      s.tele = local > h.period - h.wind ? (local - (h.period - h.wind)) / h.wind : 0;
      s.nextDir = (k + 1) % 2 === 0 ? 1 : -1;
      return s;
    },
    affect(h, b, t, s) {
      const top = h.floor + h.r * 2 + 0.3;
      if (b.y > top + 1.2) return;
      for (const ball of s.balls) {
        const dx = b.x - ball.x, dz = b.z - ball.z;
        const d2 = dx * dx + dz * dz;
        if (b.y > top) {
          // flying over it: a hurdle
          if (d2 < 0.5 * 0.5) nearMiss(b, h, ball.k, 'boule');
          continue;
        }
        const hitR = h.r + 0.16;
        if (d2 > hitR * hitR) {
          if (Math.abs(dx) < 0.3 && d2 < (hitR + NEAR_MISS * 0.6) ** 2) nearMiss(b, h, ball.k, 'boule');
          continue;
        }
        const key = `${h.id}`;
        if (b.hits[key] === ball.k) continue;
        b.hits[key] = ball.k;
        knock(b, [ball.dir * 5, 2.2, Math.sign(dz || 1) * 1.2], 'boule');
      }
    },
    danger(h, x, z, t) {
      if (Math.abs(z - h.z) > h.r + 0.7) return false;
      for (const dt of [-0.3, 0, 0.3]) {
        const s = KINDS.boules.state(h, t + dt, {});
        for (const ball of s.balls) if (Math.abs(ball.x - x) < 1.2) return true;
      }
      return false;
    },
  },

  // Something hanging that swings (a fishmonger's scale pan, a sign, a basket): a level platform on a pendulum. Ride it
  // and flop off at the end of a swing. It shoves what it swings into.
  pendulum: {
    init(h) {
      h.period = h.period ?? 3.2;
      h.amp = h.amp ?? 0.7;
      h.len = h.len ?? 2.2;
      h.yaw = h.yaw ?? Math.PI / 2; // the way it swings (about y; π/2 = along x)
      h.size = h.size ?? [0.9, 0.08, 0.9];
      h.col = box([h.pivot[0], h.pivot[1] - h.len, h.pivot[2]], [h.size[0] / 2, h.size[1] / 2, h.size[2] / 2], { surf: h.surf ?? 'wood', look: null });
      h.col.v = [0, 0, 0];
      h.col.id = h.id;
    },
    state(h, t, s) {
      const w = TAU / h.period;
      const u = (t + h.phase) * w;
      const th = h.amp * Math.sin(u);
      const dth = h.amp * w * Math.cos(u);
      const dx = Math.sin(h.yaw), dz = Math.cos(h.yaw);
      s.angle = th;
      s.x = h.pivot[0] + Math.sin(th) * h.len * dx;
      s.y = h.pivot[1] - Math.cos(th) * h.len;
      s.z = h.pivot[2] + Math.sin(th) * h.len * dz;
      s.vx = Math.cos(th) * h.len * dth * dx;
      s.vy = Math.sin(th) * h.len * dth;
      s.vz = Math.cos(th) * h.len * dth * dz;
      return s;
    },
    solid(h, s) {
      moveBox(h.col, s.x, s.y, s.z);
      h.col.v[0] = s.vx;
      h.col.v[1] = s.vy;
      h.col.v[2] = s.vz;
      return h.col;
    },
  },

  // A platform that glides back and forth (a fish cart, a dumbwaiter, a bobbing boat), easing at each end.
  mover: {
    init(h) {
      h.period = h.period ?? 6;
      h.size = h.size ?? [1.2, 0.3, 1.2];
      const a = h.path[0];
      h.col = box([a[0], a[1], a[2]], [h.size[0] / 2, h.size[1] / 2, h.size[2] / 2], { surf: h.surf ?? 'wood', look: null, yaw: h.yaw ?? 0 });
      h.col.v = [0, 0, 0];
      h.col.id = h.id;
    },
    state(h, t, s) {
      const [a, c] = h.path;
      const u = ((t + h.phase) / h.period) * TAU;
      const k = 0.5 - 0.5 * Math.cos(u);
      const dk = (0.5 * Math.sin(u) * TAU) / h.period;
      s.k = k;
      s.x = a[0] + (c[0] - a[0]) * k;
      s.y = a[1] + (c[1] - a[1]) * k;
      s.z = a[2] + (c[2] - a[2]) * k;
      s.vx = (c[0] - a[0]) * dk;
      s.vy = (c[1] - a[1]) * dk;
      s.vz = (c[2] - a[2]) * dk;
      return s;
    },
    solid(h, s) {
      moveBox(h.col, s.x, s.y + h.size[1] / 2, s.z);
      h.col.v[0] = s.vx;
      h.col.v[1] = s.vy;
      h.col.v[2] = s.vz;
      return h.col;
    },
  },

  // A crab scuttles sideways along a line, stops, raises its claws (`tele` s), and snaps whatever is in front of it.
  crab: {
    init(h) {
      h.period = h.period ?? 2.8;
      h.tele = h.tele ?? 0.8;
      h.strike = 0.15;
      h.reach = h.reach ?? 0.75;
      h.floor = h.floor ?? 0;
      h.walk = h.period - h.tele - 0.5;
    },
    state(h, t, s) {
      const u = t + h.phase;
      const k = Math.floor(u / h.period);
      const local = posMod(u, h.period);
      const [a, c] = h.path;
      // it walks to the next stop on its line, then snaps
      const n = h.stops ?? 3;
      const seq = (j) => {
        const m = posMod(j, 2 * (n - 1));
        return m < n ? m : 2 * (n - 1) - m;
      };
      const from = seq(k - 1) / (n - 1), to = seq(k) / (n - 1);
      const w = Math.min(1, local / h.walk);
      const e = w * w * (3 - 2 * w);
      const f = from + (to - from) * e;
      s.x = a[0] + (c[0] - a[0]) * f;
      s.z = a[1] + (c[1] - a[1]) * f;
      s.walking = w < 1;
      s.dir = Math.sign(to - from) || 1;
      s.cycle = k;
      s.tele = local >= h.walk && local < h.walk + h.tele ? (local - h.walk) / h.tele : 0;
      s.striking = local >= h.walk + h.tele && local < h.walk + h.tele + h.strike;
      s.face = h.face ?? 0; // the way its claws point (yaw)
      return s;
    },
    affect(h, b, t, s) {
      if (!s.striking || b.y > h.floor + 0.8) return;
      const dx = b.x - s.x, dz = b.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d > h.reach) {
        if (d < h.reach + NEAR_MISS) nearMiss(b, h, s.cycle, 'crab');
        return;
      }
      if (b.hits[h.id] === s.cycle) return;
      b.hits[h.id] = s.cycle;
      const nx = d > 0.05 ? dx / d : Math.sin(s.face), nz = d > 0.05 ? dz / d : Math.cos(s.face);
      knock(b, [nx * 4.5, 3.4, nz * 4.5], 'crab');
    },
    danger(h, x, z, t) {
      const s = KINDS.crab.state(h, t, {});
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz > (h.reach + 0.5) ** 2) return false;
      const local = posMod(t + h.phase, h.period);
      return local > h.walk - 0.3;
    },
  },

  // A lawn sprinkler sweeps its jet back and forth: a fish in the jet is watered and nudged along it.
  sprinkler: {
    init(h) {
      h.period = h.period ?? 4.8;
      h.reach = h.reach ?? 4;
      h.arc = h.arc ?? 1.6;
      h.width = 0.22;
      h.rate = h.rate ?? 55;
    },
    state(h, t, s) {
      const u = (t + h.phase) / h.period;
      s.angle = h.yaw + Math.sin(u * Math.PI * 2) * h.arc * 0.5;
      s.dx = Math.sin(s.angle);
      s.dz = Math.cos(s.angle);
      return s;
    },
    inJet(h, b, s) {
      const dx = b.x - h.at[0], dz = b.z - h.at[2];
      const along = dx * s.dx + dz * s.dz;
      if (along < 0.3 || along > h.reach || b.y > h.at[1] + 2.4) return false;
      const across = Math.abs(dx * s.dz - dz * s.dx);
      return across < h.width + along * 0.08;
    },
    refill(h, b, t, s) {
      return KINDS.sprinkler.inJet(h, b, s) ? h.rate : 0;
    },
    affect(h, b, t, s) {
      if (!b.ground || !KINDS.sprinkler.inJet(h, b, s)) return;
      const along = b.vx * s.dx + b.vz * s.dz;
      if (along < 1) {
        b.vx += s.dx * 4 * (1 / 120);
        b.vz += s.dz * 4 * (1 / 120);
      }
    },
  },
};

/**
 * The hazards of a course for one race: `seed` shifts their phases a little so races differ. `env.hazards` for stepBody.
 * `gentle`: no hazard strikes within this many metres of the start (a first race).
 */
export function createHazards(course, seed = 0, opts = {}) {
  const defs = course.builder.hazards;
  const rng = mulberry32(hashString(`${course.id}:${seed}`));
  const list = defs.map((d) => {
    const h = { ...d, phase: (d.phase ?? 0) + rng() * (d.period ?? 2) * 0.5 };
    KINDS[h.kind]?.init?.(h);
    return h;
  });
  const states = list.map(() => ({}));
  list.forEach((h, i) => (h.index = i));
  const movers = list.filter((h) => KINDS[h.kind]?.solid);
  const moverCols = movers.map((h) => h.col);
  let stateT = NaN;
  const gentleZ = opts.gentle ? course.start.z + opts.gentle : -Infinity;

  function refresh(t) {
    if (t === stateT) return;
    stateT = t;
    for (let i = 0; i < list.length; i++) KINDS[list[i].kind]?.state(list[i], t, states[i]);
  }

  const api = {
    list,
    states,
    /** Bring every hazard's state to race time t (for drawing). */
    at(t) {
      refresh(t);
      return states;
    },
    affect(b, t) {
      if (!list.length) return;
      if (b.z < gentleZ) return;
      refresh(t);
      b.hits ??= {};
      for (let i = 0; i < list.length; i++) KINDS[list[i].kind]?.affect?.(list[i], b, t, states[i]);
    },
    refill(b, t) {
      let r = 0;
      for (let i = 0; i < list.length; i++) {
        const k = KINDS[list[i].kind];
        if (k?.refill) {
          refresh(t);
          r += k.refill(list[i], b, t, states[i]);
        }
      }
      return r;
    },
    carry(b, t) {
      const h = list.find((x) => x.id === b.grab?.id);
      return h ? KINDS[h.kind].carry(h, b, t) : null;
    },
    hit() {},
    /** The moving solids (swinging pans, carts) where they are at race time t. */
    solids(t) {
      if (!movers.length) return null;
      refresh(t);
      for (let i = 0; i < movers.length; i++) KINDS[movers[i].kind].solid(movers[i], states[movers[i].index]);
      return moverCols;
    },
    /** Would a fish at (x, z) be in trouble at race time t? (for bots) */
    danger(x, z, t) {
      for (const h of list) if (KINDS[h.kind]?.danger?.(h, x, z, t)) return true;
      return false;
    },
  };
  return api;
}

export const HAZARD_KINDS = KINDS;
export { TAU };
