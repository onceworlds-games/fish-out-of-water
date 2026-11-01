// The solid world a fish collides with: oriented boxes (ramps are pitched boxes), vertical cylinders and spheres, in a
// spatial hash. Plus zones (puddles, shade, the finish, rising air) the fish can be inside, shade casters that only block
// the sun (a tree's crown, a parasol's cloth), and the pickups along the lines. Pure: no three.js, no page.

import { SUN } from './config.js';

const CELL = 4;
const keyOf = (ix, iz) => (ix + 2048) * 4096 + (iz + 2048);

/** A box collider: centre, half extents, yaw (about y) then pitch (about the box's own x), like three's 'YXZ' order. */
export function box(c, h, opts = {}) {
  const yaw = opts.yaw ?? 0;
  const pitch = opts.pitch ?? 0;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const ux = [cy, 0, -sy];
  const uy = [sy * sp, cp, cy * sp];
  const uz = [sy * cp, -sp, cy * cp];
  const col = { kind: 'box', c: [c[0], c[1], c[2]], h: [h[0], h[1], h[2]], yaw, pitch, ux, uy, uz, surf: opts.surf ?? 'tile', look: opts.look ?? null, id: opts.id ?? null };
  // world-space bounding radius on xz and y extent, for the hash
  const ex = Math.abs(ux[0]) * h[0] + Math.abs(uy[0]) * h[1] + Math.abs(uz[0]) * h[2];
  const ey = Math.abs(ux[1]) * h[0] + Math.abs(uy[1]) * h[1] + Math.abs(uz[1]) * h[2];
  const ez = Math.abs(ux[2]) * h[0] + Math.abs(uy[2]) * h[1] + Math.abs(uz[2]) * h[2];
  col.aabb = [c[0] - ex, c[1] - ey, c[2] - ez, c[0] + ex, c[1] + ey, c[2] + ez];
  return col;
}

export function cyl(c, r, hh, opts = {}) {
  return { kind: 'cyl', c: [c[0], c[1], c[2]], r, hh, surf: opts.surf ?? 'wood', look: opts.look ?? null, id: opts.id ?? null, aabb: [c[0] - r, c[1] - hh, c[2] - r, c[0] + r, c[1] + hh, c[2] + r] };
}

export function sphere(c, r, opts = {}) {
  return { kind: 'sphere', c: [c[0], c[1], c[2]], r, surf: opts.surf ?? 'wood', look: opts.look ?? null, id: opts.id ?? null, aabb: [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r] };
}

/**
 * The closest contact between a sphere (p, r) and a collider, written into `out` ({ nx, ny, nz, depth }); false when they don't touch.
 * The normal points from the collider to the sphere.
 */
export function contact(col, px, py, pz, r, out) {
  const c = col.c;
  const dx = px - c[0], dy = py - c[1], dz = pz - c[2];
  if (col.kind === 'box') {
    const { ux, uy, uz, h } = col;
    const lx = dx * ux[0] + dy * ux[1] + dz * ux[2];
    const ly = dx * uy[0] + dy * uy[1] + dz * uy[2];
    const lz = dx * uz[0] + dy * uz[1] + dz * uz[2];
    const qx = lx < -h[0] ? -h[0] : lx > h[0] ? h[0] : lx;
    const qy = ly < -h[1] ? -h[1] : ly > h[1] ? h[1] : ly;
    const qz = lz < -h[2] ? -h[2] : lz > h[2] ? h[2] : lz;
    const ex = lx - qx, ey = ly - qy, ez = lz - qz;
    const d2 = ex * ex + ey * ey + ez * ez;
    if (d2 > r * r) return false;
    if (d2 > 1e-12) {
      const d = Math.sqrt(d2);
      const nx = ex / d, ny = ey / d, nz = ez / d;
      out.nx = nx * ux[0] + ny * uy[0] + nz * uz[0];
      out.ny = nx * ux[1] + ny * uy[1] + nz * uz[1];
      out.nz = nx * ux[2] + ny * uy[2] + nz * uz[2];
      out.depth = r - d;
      return true;
    }
    // The centre is inside: out along the axis with the least to go (preferring up, so a deep landing comes out on top).
    const px1 = h[0] - Math.abs(lx), py1 = h[1] - Math.abs(ly) - 0.02, pz1 = h[2] - Math.abs(lz);
    if (py1 <= px1 && py1 <= pz1) {
      const s = ly >= 0 ? 1 : -1;
      out.nx = uy[0] * s; out.ny = uy[1] * s; out.nz = uy[2] * s;
      out.depth = py1 + 0.02 + r;
    } else if (px1 <= pz1) {
      const s = lx >= 0 ? 1 : -1;
      out.nx = ux[0] * s; out.ny = ux[1] * s; out.nz = ux[2] * s;
      out.depth = px1 + r;
    } else {
      const s = lz >= 0 ? 1 : -1;
      out.nx = uz[0] * s; out.ny = uz[1] * s; out.nz = uz[2] * s;
      out.depth = pz1 + r;
    }
    return true;
  }
  if (col.kind === 'cyl') {
    const rho = Math.sqrt(dx * dx + dz * dz);
    const hh = col.hh, R = col.r;
    if (Math.abs(dy) <= hh && rho <= R) {
      // inside
      const side = R - rho, vert = hh - Math.abs(dy);
      if (vert <= side) {
        const s = dy >= 0 ? 1 : -1;
        out.nx = 0; out.ny = s; out.nz = 0;
        out.depth = vert + r;
      } else {
        const inv = rho > 1e-9 ? 1 / rho : 0;
        out.nx = rho > 1e-9 ? dx * inv : 1; out.ny = 0; out.nz = rho > 1e-9 ? dz * inv : 0;
        out.depth = side + r;
      }
      return true;
    }
    const qy = dy < -hh ? -hh : dy > hh ? hh : dy;
    let qx = dx, qz = dz;
    if (rho > R) {
      qx = (dx / rho) * R;
      qz = (dz / rho) * R;
    }
    const ex = dx - qx, ey = dy - qy, ez = dz - qz;
    const d2 = ex * ex + ey * ey + ez * ez;
    if (d2 > r * r || d2 < 1e-12) return false;
    const d = Math.sqrt(d2);
    out.nx = ex / d; out.ny = ey / d; out.nz = ez / d;
    out.depth = r - d;
    return true;
  }
  // sphere
  const d2 = dx * dx + dy * dy + dz * dz;
  const rr = r + col.r;
  if (d2 > rr * rr) return false;
  const d = Math.sqrt(d2);
  if (d < 1e-9) {
    out.nx = 0; out.ny = 1; out.nz = 0; out.depth = rr;
    return true;
  }
  out.nx = dx / d; out.ny = dy / d; out.nz = dz / d;
  out.depth = rr - d;
  return true;
}

/** Is the point inside a zone ({ shape: 'cyl', c, r, y0, y1 } or { shape: 'box', min, max })? */
export function inZone(z, x, y, zz) {
  if (z.shape === 'box') return x >= z.min[0] && x <= z.max[0] && y >= z.min[1] && y <= z.max[1] && zz >= z.min[2] && zz <= z.max[2];
  const dx = x - z.c[0], dz = zz - z.c[2];
  return dx * dx + dz * dz <= z.r * z.r && y >= z.y0 && y <= z.y1;
}

/** Does the ray o + d·t (0 < t < maxT) hit the collider? */
export function rayHits(col, ox, oy, oz, dx, dy, dz, maxT) {
  const c = col.c;
  const px = ox - c[0], py = oy - c[1], pz = oz - c[2];
  if (col.kind === 'box') {
    const { ux, uy, uz, h } = col;
    let t0 = 0, t1 = maxT;
    for (let k = 0; k < 3; k++) {
      const u = k === 0 ? ux : k === 1 ? uy : uz;
      const p = px * u[0] + py * u[1] + pz * u[2];
      const d = dx * u[0] + dy * u[1] + dz * u[2];
      const e = h[k];
      if (Math.abs(d) < 1e-9) {
        if (p < -e || p > e) return false;
        continue;
      }
      let a = (-e - p) / d, b = (e - p) / d;
      if (a > b) [a, b] = [b, a];
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return false;
    }
    return true;
  }
  if (col.kind === 'cyl') {
    // the vertical slab, then the circle
    let t0 = 0, t1 = maxT;
    if (Math.abs(dy) < 1e-9) {
      if (Math.abs(py) > col.hh) return false;
    } else {
      let a = (-col.hh - py) / dy, b = (col.hh - py) / dy;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    const A = dx * dx + dz * dz, B = 2 * (px * dx + pz * dz), C = px * px + pz * pz - col.r * col.r;
    if (A < 1e-12) return C <= 0;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return false;
    const q = Math.sqrt(disc);
    const a = (-B - q) / (2 * A), b = (-B + q) / (2 * A);
    return Math.max(t0, a) <= Math.min(t1, b);
  }
  // sphere
  const B = px * dx + py * dy + pz * dz, C = px * px + py * py + pz * pz - col.r * col.r;
  const disc = B * B - C;
  if (disc < 0) return false;
  const q = Math.sqrt(disc);
  return -B + q > 0 && -B - q < maxT;
}

export function createWorld({ colliders = [], zones = [], bounds = null, casters = [], items = [], sun = true } = {}) {
  const cells = new Map();
  const statics = colliders.slice();
  statics.forEach((col, i) => {
    col.index = i;
    col.stamp = 0;
    const [x0, , z0, x1, , z1] = col.aabb;
    for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++)
      for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
        const k = keyOf(ix, iz);
        let list = cells.get(k);
        if (!list) cells.set(k, (list = []));
        list.push(col);
      }
  });
  let stamp = 0;
  const found = [];
  // how far up the sun's line we look for something in the way (the tallest house's shadow)
  const SUN_REACH = 16;

  const world = {
    colliders: statics,
    zones,
    finishes: zones.filter((z) => z.kind === 'finish'),
    updrafts: zones.filter((z) => z.kind === 'updraft'),
    casters,
    items,
    /** Is there a sun at all (outdoors)? */
    sun,
    bounds,
    /** Kinematic colliders this step (hazards): each also has `v` (its velocity) and maybe `knock`. */
    dynamic: [],
    /** Static colliders whose boxes overlap the sphere's box. Reuses one array: copy it if you keep it. */
    query(x, y, z, r) {
      stamp++;
      found.length = 0;
      const ix0 = Math.floor((x - r) / CELL), ix1 = Math.floor((x + r) / CELL);
      const iz0 = Math.floor((z - r) / CELL), iz1 = Math.floor((z + r) / CELL);
      for (let ix = ix0; ix <= ix1; ix++)
        for (let iz = iz0; iz <= iz1; iz++) {
          const list = cells.get(keyOf(ix, iz));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const col = list[i];
            if (col.stamp === stamp) continue;
            col.stamp = stamp;
            const a = col.aabb;
            if (x + r < a[0] || x - r > a[3] || y + r < a[1] || y - r > a[4] || z + r < a[2] || z - r > a[5]) continue;
            found.push(col);
          }
        }
      return found;
    },
    /** Out in the sun (nothing between the point and the sun)? Indoors there is no sun. */
    sunlit(x, y, z) {
      if (!sun) return false;
      const dx = SUN[0], dy = SUN[1], dz = SUN[2];
      for (const col of casters) if (rayHits(col, x, y, z, dx, dy, dz, SUN_REACH)) return false;
      stamp++;
      const ex = x + dx * SUN_REACH, ez = z + dz * SUN_REACH;
      const ix0 = Math.floor(Math.min(x, ex) / CELL), ix1 = Math.floor(Math.max(x, ex) / CELL);
      const iz0 = Math.floor(Math.min(z, ez) / CELL), iz1 = Math.floor(Math.max(z, ez) / CELL);
      for (let ix = ix0; ix <= ix1; ix++)
        for (let iz = iz0; iz <= iz1; iz++) {
          const list = cells.get(keyOf(ix, iz));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const col = list[i];
            if (col.stamp === stamp) continue;
            col.stamp = stamp;
            if (col.noShade || (col.look === null && !col.shade)) continue;
            if (col.aabb[4] < y) continue;
            if (rayHits(col, x, y, z, dx, dy, dz, SUN_REACH)) return false;
          }
        }
      return true;
    },
    zonesAt(x, y, z, out) {
      out.length = 0;
      for (const zone of zones) if (inZone(zone, x, y, z)) out.push(zone);
      return out;
    },
    /** How far along the segment a→b (0..1) until a sphere of radius r would touch a static solid; 1 when clear. */
    sweep(ax, ay, az, bx, by, bz, r, steps = 12) {
      const tmp = { nx: 0, ny: 0, nz: 0, depth: 0 };
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
        const list = world.query(x, y, z, r);
        for (let j = 0; j < list.length; j++) {
          const col = list[j];
          if (col.noCamera) continue;
          if (contact(col, x, y, z, r, tmp)) return Math.max(0, (i - 1) / steps);
        }
      }
      return 1;
    },
  };
  return world;
}
