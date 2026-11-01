// A small vocabulary for writing courses as data: every solid gets a surface (how it plays) and a look (how the renderer
// draws it). Decor is drawn but never collides. Pure: the course files only call these.

import { box, cyl, sphere } from './world.js';

export function courseBuilder(id) {
  const colliders = [];
  const zones = [];
  const decor = [];
  const hazards = [];
  let zid = 0;

  const b = {
    id,
    colliders,
    zones,
    decors: decor,
    hazards,
    /** A solid box by its centre and full size. */
    box(c, size, opts = {}) {
      const col = box(c, [size[0] / 2, size[1] / 2, size[2] / 2], opts);
      if (opts.tint) col.tint = opts.tint;
      if (opts.noCamera) col.noCamera = true;
      if (opts.hidden) col.look = null;
      colliders.push(col);
      return col;
    },
    /** A slab whose top is at `top`, spanning x0..x1, z0..z1. */
    slab(x0, z0, x1, z1, top, surf, look, depth = 1, opts = {}) {
      return b.box([(x0 + x1) / 2, top - depth / 2, (z0 + z1) / 2], [Math.abs(x1 - x0), depth, Math.abs(z1 - z0)], { surf, look, ...opts });
    },
    /** A ramp from (x, y0, z0) to (x, y1, z1) along z, `w` wide, `t` thick. */
    rampZ(x, z0, y0, z1, y1, w, surf, look, t = 0.2) {
      const len = Math.hypot(z1 - z0, y1 - y0);
      const pitch = -Math.atan2(y1 - y0, z1 - z0);
      const cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
      // centre the box below the surface line by half its thickness
      const nY = Math.cos(pitch), nZ = Math.sin(pitch);
      return b.box([x, cy - (t / 2) * nY, cz + (t / 2) * nZ], [w, t, len], { surf, look, pitch });
    },
    cyl(c, r, h, opts = {}) {
      const col = cyl([c[0], c[1] + h / 2, c[2]], r, h / 2, opts);
      if (opts.tint) col.tint = opts.tint;
      colliders.push(col);
      return col;
    },
    sphere(c, r, opts = {}) {
      const col = sphere(c, r, opts);
      colliders.push(col);
      return col;
    },
    /** An invisible wall from (x0, z0) to (x1, z1). */
    wall(x0, z0, x1, z1, h = 6, y0 = -1) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      return b.box([(x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2], [0.4, h, len], { surf: 'wall', look: null, yaw, noCamera: true });
    },
    /** Water you can refill in: a puddle on a surface at height y. */
    puddle(x, y, z, r, opts = {}) {
      const zone = { id: `w${zid++}`, kind: opts.kind ?? 'puddle', shape: 'cyl', c: [x, y, z], r, y0: y - 0.3, y1: y + 0.45, rate: opts.rate ?? 100, surf: 'water', respawn: [x, y + 0.16, z], look: opts.look ?? 'puddle' };
      zones.push(zone);
      return zone;
    },
    /** A spray or drip zone: refills slower, no puddle on the floor (sprinkler, hose, shower). */
    spray(x, y, z, r, rate = 45, look = 'spray', h = 2.5) {
      const zone = { id: `w${zid++}`, kind: 'spray', shape: 'cyl', c: [x, y, z], r, y0: y - 0.3, y1: y + h, rate, respawn: [x, y + 0.16, z], look };
      zones.push(zone);
      return zone;
    },
    shade(min, max) {
      const zone = { id: `s${zid++}`, kind: 'shade', shape: 'box', min, max };
      zones.push(zone);
      return zone;
    },
    finish(min, max, look = 'sea') {
      const zone = { id: 'finish', kind: 'finish', shape: 'box', min, max, look };
      zones.push(zone);
      return zone;
    },
    decor(look, at, opts = {}) {
      const d = { look, at, ...opts };
      decor.push(d);
      return d;
    },
    hazard(h) {
      hazards.push(h);
      return h;
    },

    // ------------------------------------------------------------ kit pieces (a look and its solids together)

    crate(x, y, z, opts = {}) {
      const s = opts.size ?? [0.6, 0.45, 0.45];
      return b.box([x, y + s[1] / 2, z], s, { surf: opts.surf ?? 'wood', look: opts.look ?? 'crate', yaw: opts.yaw ?? 0, tint: opts.tint });
    },
    /** A crate full of crushed ice: slides like a skating rink and keeps you wet. */
    iceCrate(x, y, z, opts = {}) {
      const s = opts.size ?? [0.7, 0.42, 0.5];
      return b.box([x, y + s[1] / 2, z], s, { surf: 'ice', look: 'icecrate', yaw: opts.yaw ?? 0 });
    },
    barrel(x, y, z, r = 0.32, h = 0.85) {
      return b.cyl([x, y, z], r, h, { surf: 'wood', look: 'barrel' });
    },
    bollard(x, y, z) {
      return b.cyl([x, y, z], 0.18, 0.55, { surf: 'stone', look: 'bollard' });
    },
    /** A market stall: a counter (front faces +x or -x), an ice tray on top, an awning above. */
    stall(x, z, len, side, opts = {}) {
      // side: +1 = the stall is on the right of the aisle (front faces -x), -1 = on the left (front faces +x)
      const depth = opts.depth ?? 1.3;
      const h = opts.h ?? 0.9;
      const cx = x;
      b.box([cx, h / 2, z], [depth, h, len], { surf: 'wood', look: 'counter', tint: opts.tint });
      if (opts.ice !== false) b.box([cx, h + 0.05, z], [depth - 0.15, 0.1, len - 0.2], { surf: 'ice', look: 'ice' });
      b.decor('stallgoods', [cx, h + 0.1, z], { len, depth, side, seed: Math.round(z * 7 + x) });
      if (opts.awning !== false) {
        const ah = opts.awningH ?? 2.5;
        const aw = depth + 1.2;
        const ax = cx - side * 0.5;
        const col = b.box([ax, ah, z], [aw, 0.08, len + 0.2], { surf: opts.bouncy ? 'bounce' : 'bounce', look: 'awning', pitch: 0, yaw: 0, tint: opts.awning ?? 'red' });
        col.slope = side * 0.22;
        b.decor('awningposts', [ax, ah, z], { len, aw, side });
        b.shade([ax - aw / 2, -1, z - len / 2], [ax + aw / 2, ah - 0.1, z + len / 2]);
      }
    },
    /** A row of whitewashed houses as a backdrop along a line (decor only; the course has walls of its own). */
    houses(x, z0, z1, side, opts = {}) {
      b.decor('houses', [x, 0, z0], { z1, side, seed: opts.seed ?? Math.round(z0 * 13 + x), base: opts.base ?? 0, tall: opts.tall ?? 1 });
    },
  };
  return b;
}

/** Length along a polyline of [x, y, z] points, cumulative per point. */
export function polyLengths(pts) {
  const out = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], c = pts[i];
    out.push(out[i - 1] + Math.hypot(c[0] - a[0], c[2] - a[2]));
  }
  return out;
}

/** The distance along a polyline nearest to a point (horizontal), and how far off it is. */
export function project(pts, lens, x, z, hint = -1) {
  let best = 0, bestD = Infinity, bestOff = 0;
  const from = hint >= 0 ? Math.max(1, hint - 3) : 1;
  const to = hint >= 0 ? Math.min(pts.length - 1, hint + 4) : pts.length - 1;
  let seg = 1;
  for (let i = from; i <= to; i++) {
    const a = pts[i - 1], c = pts[i];
    const dx = c[0] - a[0], dz = c[2] - a[2];
    const l2 = dx * dx + dz * dz || 1e-9;
    let t = ((x - a[0]) * dx + (z - a[2]) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a[0] + dx * t, pz = a[2] + dz * t;
    const d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < bestD) {
      bestD = d;
      best = lens[i - 1] + Math.sqrt(l2) * t;
      bestOff = Math.sqrt(d);
      seg = i;
    }
  }
  return { s: best, off: bestOff, seg };
}

/** The point at distance s along a polyline. */
export function pointAt(pts, lens, s, out = [0, 0, 0]) {
  if (s <= 0) return ((out[0] = pts[0][0]), (out[1] = pts[0][1]), (out[2] = pts[0][2]), out);
  for (let i = 1; i < pts.length; i++) {
    if (lens[i] >= s) {
      const a = pts[i - 1], c = pts[i];
      const t = (s - lens[i - 1]) / Math.max(1e-9, lens[i] - lens[i - 1]);
      out[0] = a[0] + (c[0] - a[0]) * t;
      out[1] = a[1] + (c[1] - a[1]) * t;
      out[2] = a[2] + (c[2] - a[2]) * t;
      return out;
    }
  }
  const l = pts[pts.length - 1];
  out[0] = l[0];
  out[1] = l[1];
  out[2] = l[2];
  return out;
}
