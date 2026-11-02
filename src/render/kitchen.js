// The restaurant kitchen as a room: white tiles to shoulder height and cream plaster above, a ceiling of light panels
// (no sky), frosted daylight windows down the harbour side, the big window over the pot sink with the sea in it, the
// stainless extraction hood over the range, the order rail at the pass, rubber mats, wet-floor signs, a clock, a fire
// extinguisher and the walk-in's door. All static: it goes into the course batch.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M } from './materials.js';
import { G, rng } from './geo.js';
import { tiledBox } from './batch.js';

const NO_CAST = { cast: false };
export const TILE_H = 2.45;

/** A run of wall along z at x (facing `sgn` into the room), with window openings [[z0, z1]] from `sill` to `head`. */
function sideWall(batch, x, sgn, z0, z1, H, windows, sill = 1.25, head = 2.85) {
  const T = 0.3;
  const xx = x + (sgn * T) / 2;
  const segs = [];
  let z = z0;
  for (const [a, c] of windows ?? []) {
    segs.push([z, a, false]);
    segs.push([a, c, true]);
    z = c;
  }
  segs.push([z, z1, false]);
  for (const [a, c, win] of segs) {
    const len = c - a;
    if (len <= 0.01) continue;
    const cz = (a + c) / 2;
    if (!win) {
      batch.add(M.subway(), tiledBox(T, TILE_H, len, 1.2), { p: [xx, TILE_H / 2, cz] });
      batch.add(M.kplaster(), G.box, { p: [xx, TILE_H + (H - TILE_H) / 2, cz], s: [T, H - TILE_H, len] });
      continue;
    }
    // below the sill (tiles, and plaster above them under a high window), above the head, the frames and frosted daylight
    // glass between
    const th = Math.min(sill, TILE_H);
    batch.add(M.subway(), tiledBox(T, th, len, 1.2), { p: [xx, th / 2, cz] });
    if (sill > th) batch.add(M.kplaster(), G.box, { p: [xx, th + (sill - th) / 2, cz], s: [T, sill - th, len] });
    batch.add(M.kplaster(), G.box, { p: [xx, head + (H - head) / 2, cz], s: [T, H - head, len] });
    // the sill: a deep tiled ledge
    batch.add(M.china(), G.rbox, { p: [xx - sgn * 0.08, sill + 0.03, cz], s: [T + 0.22, 0.06, len + 0.04] });
    // the glass sits toward the outside
    batch.add(M.daylight(), G.box, { p: [xx + sgn * 0.08, (sill + head) / 2, cz], s: [0.02, head - sill, len] }, NO_CAST);
    // the frames: painted steel, panes of ~0.9 m, a transom near the top
    const n = Math.max(1, Math.round(len / 0.95));
    for (let i = 0; i <= n; i++) batch.add(M.white(), G.box, { p: [xx, (sill + head) / 2, a + (len * i) / n], s: [T * 0.7, head - sill, 0.07] });
    batch.add(M.white(), G.box, { p: [xx, head - 0.45, cz], s: [T * 0.7, 0.06, len] });
    batch.add(M.white(), G.box, { p: [xx, head - 0.03, cz], s: [T + 0.04, 0.08, len] });
    // a few panes swung open on their hinges at the top
    const r = rng(Math.round(a * 13));
    for (let i = 0; i < n; i++) {
      if (r() < 0.6) continue;
      const pz = a + (len * (i + 0.5)) / n;
      batch.add(M.white(), G.box, { p: [xx - sgn * 0.17, head - 0.27, pz], r: [0, 0, -sgn * 0.5], s: [0.03, 0.38, len / n - 0.1] });
    }
  }
  // the kick plate and the blue band in the tiles
  batch.add(M.steel(), G.box, { p: [x + sgn * 0.02, 0.07, (z0 + z1) / 2], s: [0.05, 0.14, z1 - z0] });
  batch.add(M.bluetile(), G.box, { p: [x + sgn * 0.012, 1.18, (z0 + z1) / 2], s: [0.03, 0.09, z1 - z0] });
  batch.add(M.bluetile(), G.box, { p: [x + sgn * 0.012, TILE_H - 0.03, (z0 + z1) / 2], s: [0.04, 0.06, z1 - z0] });
}

/** A wall across the room at z (facing `sgn` into it), with an opening [x0, x1] from `sill` to `head` (the harbour window). */
function endWall(batch, z, sgn, x0, x1, H, win) {
  const T = 0.3;
  const zz = z + (sgn * T) / 2;
  const W = x1 - x0;
  if (!win) {
    batch.add(M.subway(), tiledBox(W, TILE_H, T, 1.2), { p: [(x0 + x1) / 2, TILE_H / 2, zz] });
    batch.add(M.kplaster(), G.box, { p: [(x0 + x1) / 2, TILE_H + (H - TILE_H) / 2, zz], s: [W, H - TILE_H, T] });
    return;
  }
  const [w0, w1, sill, head] = win;
  batch.add(M.subway(), tiledBox(W, sill, T, 1.2), { p: [(x0 + x1) / 2, sill / 2, zz] });
  batch.add(M.subway(), tiledBox(w0 - x0, TILE_H - sill, T, 1.2), { p: [(x0 + w0) / 2, sill + (TILE_H - sill) / 2, zz] });
  batch.add(M.subway(), tiledBox(x1 - w1, TILE_H - sill, T, 1.2), { p: [(w1 + x1) / 2, sill + (TILE_H - sill) / 2, zz] });
  batch.add(M.kplaster(), G.box, { p: [(x0 + w0) / 2, TILE_H + (H - TILE_H) / 2, zz], s: [w0 - x0, H - TILE_H, T] });
  batch.add(M.kplaster(), G.box, { p: [(w1 + x1) / 2, TILE_H + (H - TILE_H) / 2, zz], s: [x1 - w1, H - TILE_H, T] });
  batch.add(M.kplaster(), G.box, { p: [(w0 + w1) / 2, head + (H - head) / 2, zz], s: [w1 - w0, H - head, T] });
  // the frame: chunky painted wood, blue, with a central mullion and a transom; open to the harbour
  batch.add(M.white(), G.rbox, { p: [(w0 + w1) / 2, sill + 0.03, zz - sgn * 0.1], s: [w1 - w0 + 0.24, 0.07, T + 0.25] });
  for (const x of [w0, (w0 + w1) / 2, w1]) batch.add(M.blue(), G.box, { p: [x, (sill + head) / 2, zz], s: [0.12, head - sill, T + 0.03] });
  batch.add(M.blue(), G.box, { p: [(w0 + w1) / 2, head, zz], s: [w1 - w0 + 0.12, 0.12, T + 0.03] });
  batch.add(M.blue(), G.box, { p: [(w0 + w1) / 2, head - 0.42, zz], s: [w1 - w0, 0.06, T * 0.5] });
}

export const KITCHEN_DECOR = {
  /** The room. d: { x0, x1, z0, z1, h, windows: [[z0, z1]] (harbour side, +x), end: [x0, x1, sill, head] }. */
  kroom(batch, sc, d) {
    const H = d.h;
    sideWall(batch, d.x0, -1, d.z0, d.z1, H, d.high?.windows ?? null, d.high?.sill, d.high?.head);
    sideWall(batch, d.x1, 1, d.z0, d.z1, H, d.windows, d.sill, d.head);
    endWall(batch, d.z0, -1, d.x0, d.x1, H, null);
    endWall(batch, d.z1, 1, d.x0, d.x1, H, d.end);
    // the ceiling: painted board, a cornice, rows of light panels (they light the room's reflections, and bloom)
    const W = d.x1 - d.x0 + 0.6, L = d.z1 - d.z0 + 0.6;
    for (let z = d.z0 - 0.3; z < d.z1 + 0.3; z += 24) {
      const len = Math.min(24, d.z1 + 0.3 - z);
      batch.add(M.ceiling(), tiledBox(W, 0.14, len, 1.2), { p: [(d.x0 + d.x1) / 2, H + 0.07, z + len / 2] }, NO_CAST);
    }
    for (const x of [d.x0 + 0.05, d.x1 - 0.05]) batch.add(M.white(), G.box, { p: [x, H - 0.06, (d.z0 + d.z1) / 2], s: [0.16, 0.12, L - 0.6] }, NO_CAST);
    for (let z = d.z0 + 2; z < d.z1 - 1; z += 4)
      for (const x of [-2.7, 2.7]) {
        batch.add(M.iron(), G.box, { p: [x, H - 0.015, z], s: [0.82, 0.03, 1.62] }, NO_CAST);
        batch.add(M.lightPanel(), G.box, { p: [x, H - 0.035, z], s: [0.72, 0.02, 1.52] }, NO_CAST);
      }
    // pipes along the ceiling on the range side, a clock and a fire extinguisher at the start
    batch.add(M.pipe(), G.cyl8, { p: [d.x0 + 0.35, H - 0.25, (d.z0 + d.z1) / 2], r: [Math.PI / 2, 0, 0], s: [0.07, L - 0.6, 0.07] }, NO_CAST);
    batch.add(M.pipe(), G.cyl8, { p: [d.x0 + 0.55, H - 0.2, (d.z0 + d.z1) / 2], r: [Math.PI / 2, 0, 0], s: [0.045, L - 0.6, 0.045] }, NO_CAST);
    // clocks: [x, y, z, facing (+1: +z, -1: -z), size]
    for (const c of d.clocks ?? [[0, 2.75, d.z0 + 0.02, 1]]) {
      const [cx, cy, cz, f = 1, k = 1] = c;
      batch.add(M.white(), G.cyl, { p: [cx, cy, cz], r: [Math.PI / 2, 0, 0], s: [0.32 * k, 0.06, 0.32 * k] });
      batch.add(M.slate(), G.torus, { p: [cx, cy, cz + f * 0.035], s: [0.32 * k, 0.32 * k, 0.5] });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        batch.add(M.slate(), G.box, { p: [cx + Math.sin(a) * 0.25 * k, cy + Math.cos(a) * 0.25 * k, cz + f * 0.035], r: [0, 0, -a], s: [0.018 * k, (i % 3 ? 0.04 : 0.07) * k, 0.01] }, NO_CAST);
      }
      batch.add(M.slate(), G.box, { p: [cx + f * 0.06 * k, cy + 0.08 * k, cz + f * 0.05], r: [0, 0, -0.6 * f], s: [0.025 * k, 0.2 * k, 0.01] });
      batch.add(M.slate(), G.box, { p: [cx - f * 0.05 * k, cy + 0.03 * k, cz + f * 0.05], r: [0, 0, 1.0 * f], s: [0.03 * k, 0.14 * k, 0.01] });
      batch.add(M.red(), G.box, { p: [cx, cy - 0.06 * k, cz + f * 0.055], r: [0, 0, 0.3 * f], s: [0.01 * k, 0.24 * k, 0.008] }, NO_CAST);
    }
  },

  /** The stainless canopy over the range: a sloped front, grease filters, a light strip under it, along z. */
  khood(batch, sc, d, at) {
    const [x, y, z] = at;
    const w = d.w, len = d.len, h = d.h ?? 0.6;
    batch.add(M.steel(), tiledBox(w, h * 0.55, len, 1.2), { p: [x, y + h * 0.72, z] }, NO_CAST);
    // the sloped front
    const slope = new THREE.BoxGeometry(1, 1, 1);
    batch.add(M.steel(), slope, { p: [x + w / 2 - 0.12, y + h * 0.28, z], r: [0, 0, -0.55], s: [0.06, h * 0.62, len] }, NO_CAST);
    batch.add(M.steel(), G.box, { p: [x, y + 0.03, z], s: [w, 0.06, len] }, NO_CAST);
    // filters: dark slatted panels
    for (let zz = z - len / 2 + 0.5; zz < z + len / 2 - 0.3; zz += 0.62) batch.add(M.iron(), G.box, { p: [x - 0.05, y + 0.07, zz], s: [w * 0.7, 0.02, 0.5] }, NO_CAST);
    batch.add(M.lamp(), G.box, { p: [x + w / 2 - 0.25, y - 0.005, z], s: [0.06, 0.02, len - 0.4] }, NO_CAST);
    // the duct up into the ceiling
    batch.add(M.steel(), G.box, { p: [x - w * 0.1, y + h + 0.25, z], s: [w * 0.5, 0.5, 1.2] }, NO_CAST);
  },

  /** The order rail over the pass: a steel bar with tickets clipped along it. */
  tickets(batch, sc, d, at) {
    const [x, y, z] = at;
    batch.add(M.steel(), G.box, { p: [x, y, z], s: [0.06, 0.05, d.len] }, NO_CAST);
    const r = rng(d.seed ?? 7);
    for (let zz = z - d.len / 2 + 0.3; zz < z + d.len / 2 - 0.2; zz += 0.22 + r() * 0.25) {
      const h = 0.18 + r() * 0.12;
      batch.add(M.china(), G.box, { p: [x + 0.035, y - h / 2 - 0.01, zz], r: [0, 0, (r() - 0.5) * 0.15], s: [0.004, h, 0.1] }, NO_CAST);
      batch.add(M.slate(), G.box, { p: [x + 0.04, y - 0.06, zz], s: [0.003, 0.012, 0.07] }, NO_CAST);
      if (r() < 0.4) batch.add(M.red(), G.box, { p: [x + 0.04, y - 0.1, zz], s: [0.003, 0.01, 0.06] }, NO_CAST);
    }
  },

  /** A yellow wet-floor sign: an A-frame with a slipping figure. */
  wetsign(batch, sc, d, at) {
    const yaw = d.yaw ?? 0;
    const t = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
    const part = (p, r, s, mat) => {
      const l = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'YXZ')), new THREE.Vector3(...s));
      batch.add(mat, G.box, t.clone().multiply(l));
    };
    for (const s of [-1, 1]) {
      part([0, 0.3, s * 0.1], [s * 0.32, 0, 0], [0.3, 0.62, 0.02], M.lemonPaint());
      part([0, 0.36, s * 0.115], [s * 0.32, 0, 0], [0.18, 0.012, 0.005], M.slate());
      part([0.02, 0.27, s * 0.118], [s * 0.32, 0, 0.5], [0.025, 0.12, 0.005], M.slate());
      part([-0.04, 0.2, s * 0.13], [s * 0.32, 0, -0.9], [0.12, 0.02, 0.005], M.slate());
    }
    part([0, 0.62, 0], [0, 0, 0], [0.3, 0.04, 0.06], M.lemonPaint());
  },

  /** A rubber anti-slip mat on the floor (holes in a grid), along z. */
  mat(batch, sc, d, at) {
    const [x, y, z] = at;
    batch.add(M.rubber(), G.box, { p: [x, y + 0.012, z], r: [0, d.yaw ?? 0, 0], s: [d.w, 0.025, d.len] });
    const n = Math.floor(d.w / 0.16), m = Math.floor(d.len / 0.16);
    const c = Math.cos(d.yaw ?? 0), s = Math.sin(d.yaw ?? 0);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < m; k++) {
        const u = -d.w / 2 + 0.08 + i * 0.16, v = -d.len / 2 + 0.08 + k * 0.16;
        sc.add('mathole', G.cyl8, M.slate(), [x + u * c + v * s, y + 0.026, z - u * s + v * c], [0, 0, 0], [0.04, 0.004, 0.04]);
      }
  },

  /** The walk-in fridge's door on the range-side wall: steel, a big lever handle, a strip curtain behind. */
  walkin(batch, sc, d, at) {
    const [x, y, z] = at;
    const sgn = d.sgn ?? 1;
    batch.add(M.steel(), new RoundedBoxGeometry(1, 1, 1, 2, 0.04), { p: [x + sgn * 0.06, y + 1.05, z], s: [0.1, 2.1, 1.1] });
    batch.add(M.iron(), G.box, { p: [x + sgn * 0.13, y + 1.05, z + 0.38], s: [0.05, 0.08, 0.3] });
    batch.add(M.iron(), G.cyl8, { p: [x + sgn * 0.13, y + 1.05, z + 0.5], s: [0.04, 0.12, 0.04] });
    batch.add(M.plasticBlue(), G.box, { p: [x + sgn * 0.12, y + 1.75, z], s: [0.01, 0.12, 0.6] });
    batch.add(M.white(), G.box, { p: [x + sgn * 0.125, y + 1.75, z], s: [0.01, 0.03, 0.4] });
  },
};
