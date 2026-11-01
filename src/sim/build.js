// A small vocabulary for writing courses as data: every solid gets a surface (how it plays) and a look (how the renderer
// draws it). Decor is drawn but never collides. Pure: the course files only call these.

import { box, cyl, sphere } from './world.js';

export function courseBuilder(id) {
  const colliders = [];
  const zones = [];
  const decor = [];
  const hazards = [];
  const casters = [];
  const items = [];
  let zid = 0;
  let scaleN = 0;

  const b = {
    id,
    colliders,
    zones,
    decors: decor,
    hazards,
    casters,
    items,
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
    /** A ramp from (x0, y0, z) to (x1, y1, z) along x, `w` deep, `t` thick. */
    rampX(z, x0, y0, x1, y1, w, surf, look, t = 0.2) {
      // a z-ramp turned a quarter: yaw π/2 maps the box's z onto x
      const len = Math.hypot(x1 - x0, y1 - y0);
      const pitch = -Math.atan2(y1 - y0, Math.abs(x1 - x0));
      const yaw = x1 >= x0 ? Math.PI / 2 : -Math.PI / 2;
      const cy = (y0 + y1) / 2, cx = (x0 + x1) / 2;
      const nY = Math.cos(pitch), nH = Math.sin(pitch);
      const dir = Math.sign(x1 - x0) || 1;
      return b.box([cx - (t / 2) * nH * dir, cy - (t / 2) * nY, z], [w, t, len], { surf, look, pitch, yaw });
    },
    /** A ramp from (x, y0, z0) to (x, y1, z1) along z, `w` wide, `t` thick. */
    rampZ(x, z0, y0, z1, y1, w, surf, look, t = 0.2) {
      const len = Math.hypot(z1 - z0, y1 - y0);
      const pitch = -Math.atan2(y1 - y0, z1 - z0);
      const cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
      // centre the box below the surface line by half its thickness
      const nY = Math.cos(pitch), nZ = Math.sin(pitch);
      return b.box([x, cy - (t / 2) * nY, cz - (t / 2) * nZ], [w, t, len], { surf, look, pitch });
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
    /** An invisible wall from (x0, z0) to (x1, z1). The camera passes through it unless it stands where a drawn wall
     *  or house does (`camera: true`). */
    wall(x0, z0, x1, z1, h = 6, y0 = -1, opts = {}) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      return b.box([(x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2], [0.4, h, len], { surf: 'wall', look: null, yaw, noCamera: !opts.camera });
    },
    /** Water you can refill in: a puddle on a surface at height y. */
    puddle(x, y, z, r, opts = {}) {
      const zone = { id: `w${zid++}`, kind: opts.kind ?? 'puddle', shape: 'cyl', c: [x, y, z], r, y0: y - 0.3, y1: y + 0.45, rate: opts.rate ?? 100, surf: 'water', respawn: [x, y + 0.16, z], look: opts.look ?? 'puddle' };
      zones.push(zone);
      return zone;
    },
    /** A spray or drip zone: refills slower, no puddle on the floor (sprinkler, hose, shower). */
    spray(x, y, z, r, rate = 45, look = 'spray', h = 2.5, opts = {}) {
      const zone = { id: `w${zid++}`, kind: 'spray', shape: 'cyl', c: [x, y, z], r, y0: y - 0.3, y1: y + h, rate, respawn: opts.respawn ?? [x, y + 0.16, z], look, bots: opts.bots ?? true };
      zones.push(zone);
      return zone;
    },
    shade(min, max) {
      const zone = { id: `s${zid++}`, kind: 'shade', shape: 'box', min, max };
      zones.push(zone);
      return zone;
    },
    /** The finish: a box zone. `depth`: how far a finished fish sinks out of sight (shallow surf: a little); `surface`:
     *  the water's height, where the splash goes (none: it splashes where it crosses). */
    finish(min, max, look = 'sea', depth = 1.6, surface = null) {
      const zone = { id: 'finish', kind: 'finish', shape: 'box', min, max, look, depth, surface };
      zones.push(zone);
      return zone;
    },
    /** Something that only blocks the sun (a tree's crown, a parasol's cloth): drawn by its decor, solid to nothing. */
    casterSphere(c, r) {
      const col = sphere(c, r, {});
      casters.push(col);
      return col;
    },
    casterBox(c, size, opts = {}) {
      const col = box(c, [size[0] / 2, size[1] / 2, size[2] / 2], opts);
      casters.push(col);
      return col;
    },
    casterCyl(c, r, h) {
      const col = cyl([c[0], c[1] + h / 2, c[2]], r, h / 2, {});
      casters.push(col);
      return col;
    },
    /** Water drops along a line of surface points [x, y, z] (they float a little above), every `gap` metres. */
    drops(pts, gap = 1.1, lift = 0.3) {
      let carry = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], c = pts[i];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
        let d = i === 1 ? 0 : gap - carry;
        for (; d <= len + 1e-6; d += gap) {
          const k = d / len;
          items.push({ kind: 'drop', p: [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k + lift, a[2] + (c[2] - a[2]) * k] });
        }
        carry = len - (d - gap);
      }
    },
    /** `n` drops along a leap from a to c (surface points) over a hump `h` above the higher end: a line to fly. */
    dropArc(a, c, h, n) {
      const top = Math.max(a[1], c[1]) + h;
      for (let i = 0; i < n; i++) {
        const k = (i + 1) / (n + 1);
        // a parabola through a, the top and c (the top at the middle)
        const y = a[1] + (c[1] - a[1]) * k + 4 * (top - (a[1] + c[1]) / 2) * k * (1 - k);
        items.push({ kind: 'drop', p: [a[0] + (c[0] - a[0]) * k, y + 0.3, a[2] + (c[2] - a[2]) * k] });
      }
    },
    /** A golden scale on a surface point (three per course, on the risky lines). */
    scale(x, y, z) {
      items.push({ kind: 'scale', n: scaleN++, p: [x, y + 0.42, z] });
    },
    /** Rising air from a vent or a hood: a column that lifts a fish in the air. */
    updraft(x, y, z, r, h, lift = 30, look = 'steam', opts = {}) {
      const zone = { id: `u${zid++}`, kind: 'updraft', shape: 'cyl', c: [x, y, z], r, y0: y, y1: y + h, lift, look, spread: opts.spread ?? 0, dir: opts.dir ?? null };
      zones.push(zone);
      return zone;
    },
    /** A drain in the floor: lie on it and you're washed back to the last water. */
    drain(x, y, z, r = 0.45) {
      const zone = { id: `d${zid++}`, kind: 'drain', shape: 'cyl', c: [x, y, z], r, y0: y - 0.3, y1: y + 0.3, look: 'drain' };
      zones.push(zone);
      return zone;
    },
    /** Hot air under a heat lamp or over a grill: dries you `k` times faster. */
    heat(min, max, k = 2.2) {
      const zone = { id: `h${zid++}`, kind: 'heat', shape: 'box', min, max, k };
      zones.push(zone);
      return zone;
    },
    /** A moving belt (a conveyor): a box whose top carries a fish at `v` [vx, vz]. */
    belt(c, size, v, opts = {}) {
      const col = b.box(c, size, { surf: opts.surf ?? 'steel', look: opts.look ?? 'belt', yaw: opts.yaw ?? 0 });
      col.belt = [v[0], v[1]];
      return col;
    },
    /** A tree: a solid trunk, a crown that casts shade (and is drawn by its decor). */
    tree(x, y, z, opts = {}) {
      const h = opts.h ?? 4.2, cr = opts.r ?? 2.0;
      // a look that draws its own trunk (with limbs) leaves the solid trunk undrawn
      b.cyl([x, y, z], opts.trunk ?? 0.2, h * 0.6, { surf: 'wood', look: opts.look ? null : 'trunk' });
      b.casterSphere([x, y + h - cr * 0.55, z], cr);
      b.decor(opts.look ?? 'tree', [x, y, z], { h, r: cr, seed: opts.seed ?? Math.round(x * 7 + z * 3), kind: opts.kind });
    },
    /** A beach or café parasol: a pole and a bouncy canopy that shades the ground under it. */
    parasol(x, y, z, opts = {}) {
      const h = opts.h ?? 2.1, r = opts.r ?? 1.2;
      b.cyl([x, y, z], 0.05, h, { surf: 'wood', look: 'pole' });
      const top = b.cyl([x, y + h, z], r, 0.08, { surf: 'bounce', look: opts.look ?? 'umbrella', tint: opts.tint ?? 'red' });
      return top;
    },
    // ------------------------------------------------------------ the town

    /** A house block (solid: it casts shade and stops the camera), x0..x1, z0..z1, from y0 up `h`. `face`: the sides on
     *  the street ('x+', 'x-', 'z+', 'z-'), drawn with windows and doors; `kind`: house | shop | hall | shed. */
    house(x0, z0, x1, z1, y0, h, opts = {}) {
      const col = b.box([(x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2], [x1 - x0, h, z1 - z0], { surf: 'wall', look: opts.look ?? 'house' });
      col.house = { x0, x1, z0, z1, y0, h, face: [].concat(opts.face ?? 'x+'), kind: opts.kind ?? 'house', seed: opts.seed ?? Math.round(x0 * 13 + z0 * 7), paint: opts.paint ?? null, roof: opts.roof ?? 'tiles', ground: opts.ground ?? y0, sign: opts.sign ?? null };
      return col;
    },
    /** A row of houses along a street edge at x (the street on the `side` they face: +1 → faces +x), z0..z1, `depth` deep,
     *  standing on the ground height base(z). Widths and heights vary by seed. */
    row(x, z0, z1, side, opts = {}) {
      const r = mulberrySmall(opts.seed ?? Math.round(x * 31 + z0 * 7));
      const depth = opts.depth ?? 6;
      const base = typeof opts.base === 'function' ? opts.base : () => opts.base ?? 0;
      const hs = opts.heights ?? [7.5, 11];
      let z = z0;
      const out = [];
      while (z < z1 - 0.5) {
        let w = (opts.widths?.[0] ?? 4) + r() * ((opts.widths?.[1] ?? 6.5) - (opts.widths?.[0] ?? 4));
        if (z1 - (z + w) < 2.5) w = z1 - z;
        const y0 = base(z + w / 2);
        const h = hs[0] + r() * (hs[1] - hs[0]) + (opts.top ?? 0) - y0 * (opts.level ? 1 : 0);
        const x0 = side > 0 ? x - depth : x, x1 = side > 0 ? x : x + depth;
        const face = [side > 0 ? 'x+' : 'x-'];
        if (opts.endFace && z + w >= z1 - 0.01) face.push(opts.endFace);
        if (opts.startFace && z <= z0 + 0.01) face.push(opts.startFace);
        out.push(b.house(x0, z, x1, z + w, opts.under ?? y0, h + (y0 - (opts.under ?? y0)), { face, seed: Math.floor(r() * 1e6), kind: opts.kind, ground: y0 }));
        z += w;
      }
      return out;
    },
    /** Stone steps down along +z from the level yTop (before z0) to yBot (after z1), x0..x1, `n` steps between. */
    steps(x0, x1, z0, z1, yTop, yBot, n, opts = {}) {
      const dz = (z1 - z0) / n, dy = (yTop - yBot) / (n + 1);
      const out = [];
      for (let i = 0; i < n; i++) {
        const top = yTop - (i + 1) * dy;
        out.push(b.slab(x0, z0 + i * dz, x1, z0 + (i + 1) * dz, top, opts.surf ?? 'stone', opts.look ?? 'step', top - yBot + 1));
      }
      return out;
    },
    /** A running-water channel down a slope (slide in it, drink as you go), with stone curbs either side. */
    runnel(x, w, z0, y0, z1, y1) {
      const ch = b.rampZ(x, z0, y0, z1, y1, w, 'gutter', 'runnel', 0.35);
      for (const s of [-1, 1]) b.rampZ(x + s * (w / 2 + 0.08), z0, y0 + 0.1, z1, y1 + 0.1, 0.16, 'stone', 'curb', 0.5);
      return ch;
    },
    /** A town fountain: a basin you can fall into (water), a rim to land on, a column with a bowl of water on top. */
    fountain(x, y, z, r = 1.7, opts = {}) {
      const n = 12, rimH = opts.rim ?? 0.45, t = 0.26;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const len = 2 * Math.PI * (r - t / 2) / n + 0.12;
        b.box([x + Math.sin(a) * (r - t / 2), y + rimH / 2, z + Math.cos(a) * (r - t / 2)], [len, rimH, t], { surf: 'stone', look: 'rim', yaw: a + Math.PI / 2 });
      }
      b.box([x, y + 0.05, z], [r * 1.5, 0.1, r * 1.5], { surf: 'stone', look: null });
      b.puddle(x, y + 0.08, z, r - t, { look: 'basin' });
      b.cyl([x, y, z], 0.26, 1.35, { surf: 'stone', look: 'column' });
      b.cyl([x, y + 1.35, z], 0.8, 0.14, { surf: 'stone', look: 'bowl' });
      b.puddle(x, y + 1.49, z, 0.68, { look: 'bowlwater' });
      b.decor('fountain', [x, y, z], { r, rim: rimH });
    },
    /** A café table with two chairs and a parasol over it. */
    cafe(x, y, z, opts = {}) {
      b.cyl([x, y, z], 0.38, 0.74, { surf: 'wood', look: 'cafetable' });
      const yaw = opts.yaw ?? 0;
      for (const s of [-1, 1]) b.box([x + Math.cos(yaw) * s * 0.75, y + 0.23, z - Math.sin(yaw) * s * 0.75], [0.42, 0.46, 0.42], { surf: 'wood', look: 'chair', yaw: yaw + (s > 0 ? Math.PI / 2 : -Math.PI / 2) });
      return b.parasol(x, y, z, { h: opts.h ?? 2.15, r: opts.r ?? 1.2, tint: opts.tint ?? 'red', look: 'parasol' });
    },
    /** A flower-box ledge along a house front (a long plank on brackets): a high line. */
    ledge(x0, z0, x1, z1, y, opts = {}) {
      return b.box([(x0 + x1) / 2, y - 0.06, (z0 + z1) / 2], [Math.abs(x1 - x0), 0.12, Math.abs(z1 - z0)], { surf: opts.surf ?? 'wood', look: 'ledge', tint: opts.tint });
    },
    /** A shade sail strung high over the street: it only blocks the sun. */
    sail(x0, z0, x1, z1, y, tint = 'cream') {
      b.casterBox([(x0 + x1) / 2, y, (z0 + z1) / 2], [Math.abs(x1 - x0), 0.05, Math.abs(z1 - z0)]);
      b.decor('sail', [(x0 + x1) / 2, y, (z0 + z1) / 2], { w: Math.abs(x1 - x0), d: Math.abs(z1 - z0), tint });
    },
    lamp(x, y, z) {
      return b.cyl([x, y, z], 0.07, 3.6, { surf: 'steel', look: 'lamppost' });
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
    /** A market stall: a counter (front faces +x or -x), an ice tray on top, an awning above (bouncy, and its shadow
     *  is shade). side: +1 = the stall is on the right of the aisle (front faces -x), -1 = on the left (front faces +x). */
    stall(x, z, len, side, opts = {}) {
      const depth = opts.depth ?? 1.3;
      const h = opts.h ?? 0.9;
      const y0 = opts.base ?? 0;
      b.box([x, y0 + h / 2, z], [depth, h, len], { surf: 'wood', look: 'counter', tint: opts.tint });
      if (opts.ice !== false) b.box([x, y0 + h + 0.05, z], [depth - 0.15, 0.1, len - 0.2], { surf: 'ice', look: 'ice' });
      b.decor('stallgoods', [x, y0 + h + 0.1, z], { len, depth, side, seed: Math.round(z * 7 + x), goods: opts.goods ?? 'fish' });
      if (opts.awning !== false) {
        const ah = y0 + (opts.awningH ?? 2.5);
        const aw = depth + 1.0;
        const ax = x - side * 0.45;
        const col = b.box([ax, ah, z], [aw, 0.08, len + 0.2], { surf: 'bounce', look: 'awning', tint: opts.awning ?? 'red' });
        col.slope = side * 0.22;
        b.decor('awningposts', [ax, ah, z], { len, aw, side, base: y0 });
      }
    },
    /** A row of whitewashed houses as a backdrop along a line (decor only; the course has walls of its own). */
    houses(x, z0, z1, side, opts = {}) {
      b.decor('houses', [x, 0, z0], { z1, side, seed: opts.seed ?? Math.round(z0 * 13 + x), base: opts.base ?? 0, tall: opts.tall ?? 1 });
    },
  };
  return b;
}

function mulberrySmall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
