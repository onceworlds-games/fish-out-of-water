// Hazards: pure functions of the course and the race clock, so every page sees the same cat at the same moment with no
// messages. Each one is telegraphed before it strikes. A page applies them only to its own fish (the host to the bots).

import { knock } from './body.js';
import { hashString, mulberry32 } from './rng.js';

const TAU = Math.PI * 2;
const posMod = (a, n) => ((a % n) + n) % n;

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
      if (d > h.radius || d < 0.05) return;
      if (Math.sign(dx) !== s.side && Math.abs(dx) > 0.25) return;
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
      if (!s.striking || b.y > 0.9) return;
      const f = s.feet[0];
      const dx = b.x - f.x, dz = b.z - f.z;
      if (dx * dx + dz * dz > h.reach * h.reach) return;
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
