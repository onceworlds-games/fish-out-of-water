// The park: trees with lumpy leafy crowns (oaks, limes, poplars, pines, a cherry in blossom, a copper beech, birches),
// clipped hedges, flower borders and rose beds, gravel walks with lamps, the bouncy castle and the trampoline, the
// bandstand under its striped canvas with the band playing, the duck pond (lilies, reeds, a duck house, ducks paddling
// round), and people out in the sun: picnics, walkers and their dogs, frisbee, benches, a child with a balloon.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { M } from './materials.js';
import { G, rng } from './geo.js';
import { person, limb } from './beach.js';

const TAU = Math.PI * 2;
const NO_CAST = { cast: false };
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- small helpers

/** A matrix from a parent frame (p, yaw) and a local offset, rotation (YXZ) and scale. */
function at(p, yaw, local = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const v = new THREE.Vector3(p[0] + local[0] * c + local[2] * s, p[1] + local[1], p[2] - local[0] * s + local[2] * c);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1] + yaw, rot[2], 'YXZ'));
  return new THREE.Matrix4().compose(v, q, new THREE.Vector3(scale[0], scale[1], scale[2]));
}

/** A world point from a parent frame (p, yaw) and a local offset. */
function loc(p, yaw, lx, ly, lz) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [p[0] + lx * c + lz * s, p[1] + ly, p[2] - lx * s + lz * c];
}

/** A matrix that stands a unit upright piece (y -0.5..0.5) between points a and b, `r` thick. */
function between(a, b, r) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length() || 1e-3;
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.divideScalar(len));
  return new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(r, len, r));
}

/** A frame for a box look (t: { p, r }) and a local offset/rotation/scale inside it. */
function frame(t, local = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const base = new THREE.Matrix4().compose(new THREE.Vector3(t.p[0], t.p[1], t.p[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(t.r?.[0] ?? 0, t.r?.[1] ?? 0, t.r?.[2] ?? 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const l = new THREE.Matrix4().compose(new THREE.Vector3(...local), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(...scale));
  return base.multiply(l);
}

function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
/** Smooth 3D value noise in 0..1. */
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, k) => a + (b - a) * k;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// ---------------------------------------------------------------- shapes

const TAPER = new THREE.CylinderGeometry(0.62, 1, 1, 7, 1);
const FLARE = new THREE.CylinderGeometry(0.5, 1, 1, 7, 1);
const ICO0 = new THREE.IcosahedronGeometry(1, 0);
const DISC = new THREE.CylinderGeometry(1, 1, 1, 16);
const LILY = new THREE.CircleGeometry(1, 18, 0.35, TAU - 0.35).rotateX(-Math.PI / 2);
const capsules = new Map();
function capsule(r, len) {
  const key = `${r.toFixed(3)}:${len.toFixed(2)}`;
  let g = capsules.get(key);
  if (!g) capsules.set(key, (g = new THREE.CapsuleGeometry(r, Math.max(0.002, len - 2 * r), 4, 12)));
  return g;
}

const blobs = new Map();
/** A leafy lump: a sphere pushed in and out by noise, smooth-shaded, a flatter underside. `detail` 1 far, 2 near. */
function blobGeo(variant, detail = 2) {
  const key = `${variant % 5}:${detail}`;
  let g = blobs.get(key);
  if (g) return g;
  const ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  g = mergeVertices(ico);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const o = (variant % 5) * 17.3 + 3.1;
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k).normalize();
    const n = noise3(v.x * 1.7 + o, v.y * 1.7, v.z * 1.7) * 0.55 + noise3(v.x * 3.6, v.y * 3.6 + o, v.z * 3.6) * 0.3 + noise3(v.x * 7.5 + o, v.y * 7.5, v.z * 7.5) * 0.15;
    v.multiplyScalar(0.76 + n * 0.46);
    if (v.y < -0.45) v.y = -0.45 + (v.y + 0.45) * 0.5;
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  blobs.set(key, g);
  return g;
}
/** The same lump with its paint index in the uv, for instanced copies (the world material reads it there). */
const painted = new Map();
function paintedBlob(variant, detail, paint) {
  const key = `${variant % 5}:${detail}:${paint}`;
  let g = painted.get(key);
  if (g) return g;
  g = blobGeo(variant, detail).clone();
  const uv = new Float32Array(g.attributes.position.count * 2);
  for (let i = 0; i < uv.length; i += 2) uv[i + 1] = paint;
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  painted.set(key, g);
  return g;
}

const pines = [];
/** A ragged cone of pine needles: a tier of a fir. */
function pineGeo(i) {
  if (pines[i]) return pines[i];
  const c = new THREE.ConeGeometry(1, 1, 16, 3);
  c.deleteAttribute('normal');
  c.deleteAttribute('uv');
  const g = mergeVertices(c);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    const rr = Math.hypot(v.x, v.z);
    if (rr > 1e-3) {
      const a = Math.atan2(v.z, v.x);
      const j = 0.82 + noise3(Math.cos(a) * 2.2 + i * 7, v.y * 3, Math.sin(a) * 2.2) * 0.36 + (Math.sin(a * 8 + i) * 0.5 + 0.5) * 0.08;
      v.x *= j;
      v.z *= j;
      if (v.y < -0.45) v.y -= (j - 0.8) * 0.25; // the tips of the lowest boughs droop
    }
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return (pines[i] = g);
}

let hedgeSeed = 1;
/** A clipped hedge: a box with rounded edges and leafy lumps all over (noise along the surface normal). */
function hedgeGeo(w, h, d, seed) {
  const seg = (L) => Math.max(2, Math.round(L / 0.3));
  const box = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d));
  box.deleteAttribute('normal');
  box.deleteAttribute('uv');
  const g = mergeVertices(box);
  const pos = g.attributes.position;
  const rr = Math.min(0.22, w / 2 - 0.02, h / 2 - 0.02, d / 2 - 0.02);
  const inner = [w / 2 - rr, h / 2 - rr, d / 2 - rr];
  const v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const cl = (a, m) => Math.max(-m, Math.min(m, a));
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    c.set(cl(v.x, inner[0]), cl(v.y, inner[1]), cl(v.z, inner[2]));
    n.subVectors(v, c);
    const len = n.length();
    if (len < 1e-5) continue;
    n.divideScalar(len);
    v.copy(c).addScaledVector(n, rr);
    if (v.y > -h / 2 + 0.05) {
      const lump = noise3(v.x * 2.6 + seed, v.y * 2.6, v.z * 2.6) * 0.6 + noise3(v.x * 6.5, v.y * 6.5 + seed, v.z * 6.5) * 0.4;
      v.addScaledVector(n, (lump - 0.5) * 0.16);
    }
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- trees

/**
 * A tree standing at (x, y, z): `h` to the crown's middle-top (as the sim's shade), crown radius `cr`. kind: oak | lime
 * | blossom | copper | birch | poplar | pine. `near`: the trees by the course get limbs and finer crowns.
 */
export function drawTree(batch, sc, kind, x, y, z, h, cr, seed, near) {
  const r = rng(seed);
  const det = near ? 2 : 1;
  const leaves = M.leaves();
  const bark = kind === 'birch' ? M.birch() : M.bark();
  const tr = 0.12 + cr * 0.045;
  if (kind === 'pine') {
    batch.add(M.bark(), TAPER, between([x, y - 0.05, z], [x, y + h + cr * 0.4, z], tr));
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers;
      const rad = cr * (1.05 - k * 0.72);
      const th = h * 0.42;
      batch.add(leaves, pineGeo((seed + i) % 3), { p: [x, y + 1.2 + k * (h - 0.6) + th / 2, z], r: [0, r() * TAU, 0], s: [rad, th, rad] }, { paint: 7 });
    }
    return;
  }
  if (kind === 'poplar') {
    batch.add(bark, TAPER, between([x, y - 0.05, z], [x, y + h * 0.85, z], tr * 0.8));
    const n = 6;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const s = cr * 0.52 * (1.05 - k * 0.5);
      batch.add(leaves, blobGeo(seed + i, det), { p: [x + (r() - 0.5) * 0.25, y + 1.4 + k * (h + cr * 0.4 - 1.6), z + (r() - 0.5) * 0.25], r: [0, r() * TAU, 0], s: [s, s * 1.5, s] }, { paint: k > 0.5 ? 2 : 1 });
    }
    return;
  }
  const pal = kind === 'blossom' ? [4, 4, 5] : kind === 'copper' ? [6, 6, 6] : kind === 'lime' || kind === 'birch' ? [1, 2, 3] : [0, 1, 2];
  const tall = kind === 'lime' || kind === 'birch' ? 1.22 : 1;
  const cy = y + h - cr * 0.55;
  const lean = [(r() - 0.5) * 0.35, (r() - 0.5) * 0.35];
  const top = [x + lean[0], cy - cr * 0.15, z + lean[1]];
  batch.add(bark, TAPER, between([x, y - 0.05, z], top, kind === 'birch' ? tr * 0.7 : tr));
  batch.add(bark, FLARE, { p: [x, y + 0.14, z], r: [0, r() * 3, 0], s: [tr * 1.9, 0.3, tr * 1.9] });
  if (kind === 'birch') for (let i = 0; i < 6; i++) batch.add(M.dark(), G.box, { p: [x + lean[0] * (0.2 + i * 0.1) + tr * 0.62 * Math.cos(i * 2.4), y + 0.6 + i * 0.42, z + lean[1] * (0.2 + i * 0.1) + tr * 0.62 * Math.sin(i * 2.4)], r: [0, -i * 2.4, 0], s: [0.02, 0.05, 0.1] });
  if (near) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + r() * 0.8;
      const k = 0.42 + r() * 0.2;
      const from = [x + lean[0] * k, y + (cy - y) * k, z + lean[1] * k];
      const to = [top[0] + Math.cos(a) * cr * 0.62, cy + (r() - 0.3) * cr * 0.4, top[2] + Math.sin(a) * cr * 0.62];
      batch.add(bark, TAPER, between(from, to, tr * 0.42));
    }
  }
  // the crown: a core and lumps all round it, the sunny top lighter, the underside darker
  batch.add(leaves, blobGeo(seed, det), { p: [top[0], cy, top[2]], r: [0, r() * TAU, 0], s: [cr * 0.8, cr * 0.72 * tall, cr * 0.8] }, { paint: pal[1] });
  const n = near ? 10 : 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.6;
    const e = -0.35 + r() * 1.1;
    const dd = cr * (0.5 + r() * 0.14);
    const p = [top[0] + Math.cos(a) * Math.cos(e) * dd, cy + Math.sin(e) * dd * 0.85 * tall, top[2] + Math.sin(a) * Math.cos(e) * dd];
    const s = cr * (0.4 + r() * 0.16);
    batch.add(leaves, blobGeo(seed + i + 1, det), { p, r: [r(), r() * TAU, r()], s: [s, s * 0.86 * tall, s] }, { paint: e > 0.4 ? pal[2] : e < 0.05 ? pal[0] : pal[1] });
  }
  batch.add(leaves, blobGeo(seed + 7, det), { p: [top[0] + (r() - 0.5) * cr * 0.3, cy + cr * 0.55 * tall, top[2] + (r() - 0.5) * cr * 0.3], s: [cr * 0.42, cr * 0.36, cr * 0.42] }, { paint: pal[2] });
  if (kind === 'blossom' && near) {
    // fallen petals round the foot
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * cr * 1.2;
      sc.add('petal', ICO0, M.flowerPink(), [x + Math.cos(a) * d, y + 0.01, z + Math.sin(a) * d], [0, r() * 3, 0], [0.05, 0.006, 0.035]);
    }
  }
}

const KINDS = [
  ['oak', 0.3],
  ['lime', 0.2],
  ['poplar', 0.1],
  ['pine', 0.14],
  ['blossom', 0.1],
  ['copper', 0.08],
  ['birch', 0.08],
];
function pickKind(u) {
  let acc = 0;
  for (const [k, p] of KINDS) if (u < (acc += p)) return k;
  return 'oak';
}

const levelOf = (levels, z) => (levels.find(([z1]) => z < z1) ?? levels[levels.length - 1])[1];
const skipped = (skip, z) => (skip ?? []).some(([a, b]) => z > a && z < b);

// ---------------------------------------------------------------- people, dogs, benches

const lookOf = (r, top = true) => ({ skin: Math.floor(r() * 8), cloth: Math.floor(r() * 8), hair: Math.floor(r() * 8), top });

function dog(batch, p, yaw, fur) {
  const hair = M.hairPal();
  limb(batch, hair, p, yaw, [0, 0.34, -0.2], [0, 0.36, 0.18], 0.11, fur);
  batch.add(hair, G.sphere, at(p, yaw, [0, 0.5, 0.3], [0, 0, 0], [0.1, 0.1, 0.11]), { paint: fur });
  batch.add(hair, G.sphere, at(p, yaw, [0, 0.47, 0.41], [0, 0, 0], [0.055, 0.05, 0.075]), { paint: fur });
  batch.add(M.dark(), G.sphere, at(p, yaw, [0, 0.49, 0.48], [0, 0, 0], [0.022, 0.02, 0.02]));
  for (const sx of [-1, 1]) {
    batch.add(hair, G.sphere, at(p, yaw, [sx * 0.07, 0.53, 0.28], [0, 0, sx * 0.4], [0.03, 0.075, 0.05]), { paint: fur === 6 ? 0 : fur });
    for (const sz of [-1, 1]) limb(batch, hair, p, yaw, [sx * 0.07, 0.3, sz * 0.17], [sx * 0.07, 0.03, sz * 0.19], 0.035, fur);
  }
  limb(batch, hair, p, yaw, [0, 0.4, -0.26], [0, 0.6, -0.38], 0.025, fur);
}

/** A park bench: slats on cast-iron ends, facing +z local. */
function bench(batch, p, yaw) {
  for (const sx of [-0.8, 0.8]) {
    batch.add(M.wroughtIron(), G.box, at(p, yaw, [sx, 0.22, 0.14], [0.1, 0, 0], [0.05, 0.44, 0.05]));
    batch.add(M.wroughtIron(), G.box, at(p, yaw, [sx, 0.42, -0.16], [-0.15, 0, 0], [0.05, 0.84, 0.05]));
    batch.add(M.wroughtIron(), G.box, at(p, yaw, [sx, 0.62, 0.0], [0, 0, 0], [0.05, 0.04, 0.42]));
  }
  for (let i = 0; i < 3; i++) batch.add(M.planks(), G.box, at(p, yaw, [0, 0.45, 0.16 - i * 0.12], [0, 0, 0], [1.8, 0.04, 0.1]));
  for (let i = 0; i < 2; i++) batch.add(M.planks(), G.box, at(p, yaw, [0, 0.62 + i * 0.16, -0.2 - i * 0.03], [-0.2, 0, 0], [1.8, 0.1, 0.035]));
}

/** A picnic: a gingham blanket, a basket, plates and a bottle, two or three people on it. */
function picnicGroup(batch, r, p, yaw) {
  batch.add(M.gingham(), G.box, at(p, yaw, [0, 0.012, 0], [0, 0, 0], [2.0, 0.02, 1.6]));
  const bp = loc(p, yaw, 0.55, 0, -0.45);
  batch.add(M.crate(), G.rbox, at(bp, yaw, [0, 0.14, 0], [0, 0, 0], [0.5, 0.28, 0.32]));
  batch.add(M.crateDark(), new THREE.TorusGeometry(0.2, 0.015, 4, 12, Math.PI), at(bp, yaw, [0, 0.28, 0], [0, 0, 0]));
  batch.add(M.glass(), G.cyl, at(p, yaw, [0.15, 0.14, 0.35], [0, 0, 0], [0.04, 0.28, 0.04]));
  for (const [lx, lz] of [[-0.25, 0.1], [0.3, 0.05]]) batch.add(M.china(), DISC, at(p, yaw, [lx, 0.03, lz], [0, 0, 0], [0.12, 0.012, 0.12]));
  const n = 2 + Math.floor(r() * 2);
  const spots = [[-0.6, 0.02, -0.5, 0.4, 'sit'], [0.65, 0.02, 0.45, Math.PI + 0.3, 'sit'], [-0.2, 0.02, 0.6, Math.PI / 2, 'lie']];
  for (let i = 0; i < n; i++) {
    const [lx, ly, lz, ya, pose] = spots[i];
    person(batch, loc(p, yaw, lx, ly, lz), yaw + ya, pose, lookOf(r));
  }
}

function walker(batch, r, p, yaw, withDog) {
  person(batch, p, yaw, 'stand', lookOf(r));
  if (withDog) {
    const dp = loc(p, yaw, 0.7, 0, 0.9);
    dog(batch, dp, yaw + (r() - 0.5) * 0.8, [0, 2, 4, 5, 6][Math.floor(r() * 5)]);
    // the lead
    batch.add(M.dark(), G.cyl8, between(loc(p, yaw, 0.3, 0.92, 0.05), loc(dp, yaw, 0, 0.42, 0.25), 0.008));
  }
}

// ---------------------------------------------------------------- box looks

export const PARK_BOX_LOOKS = {
  /** A clipped hedge: lumpy and leafy all over. */
  hedge(batch, sc, w, h, d, t) {
    batch.add(M.leaves(), hedgeGeo(w, h, d, (hedgeSeed++ % 7) * 13.7), frame(t), { paint: 1 });
  },
  /** A raised rose bed: a stone kerb, dark soil, bushes in flower, a few standard roses. */
  roses(batch, sc, w, h, d, t) {
    const r = rng(Math.round(t.p[2] * 7 + t.p[0]));
    batch.add(M.stone(), G.rbox, frame(t, [0, -0.04, 0], [0, 0, 0], [w + 0.1, h - 0.08, d + 0.1]));
    batch.add(M.soil(), G.box, frame(t, [0, h / 2 - 0.05, 0], [0, 0, 0], [w - 0.12, 0.04, d - 0.12]), NO_CAST);
    const heads = ['flowerRed', 'flowerPink', 'flowerWhite', 'lemon'];
    const top = t.p[1] + h / 2;
    const nx = Math.max(2, Math.round((w - 0.4) / 0.55)), nz = Math.max(1, Math.round((d - 0.3) / 0.55));
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const px = t.p[0] - (w - 0.5) / 2 + ((i + 0.5) / nx) * (w - 0.5) + (r() - 0.5) * 0.12;
        const pz = t.p[2] - (d - 0.4) / 2 + ((j + 0.5) / nz) * (d - 0.4) + (r() - 0.5) * 0.12;
        const standard = (i + j) % 4 === 0;
        const by = standard ? top + 0.75 : top + 0.16;
        const s = standard ? 0.22 : 0.24 + r() * 0.08;
        if (standard) batch.add(M.bark(), G.cyl8, { p: [px, top + 0.38, pz], s: [0.02, 0.76, 0.02] });
        batch.add(M.leaves(), blobGeo(i * 3 + j, 1), { p: [px, by, pz], r: [0, r() * 3, 0], s: [s, s * 0.8, s] }, { paint: 0 });
        const hm = heads[Math.floor(r() * heads.length)];
        for (let k = 0; k < 6; k++) {
          const a = r() * TAU, e = r() * 1.2;
          sc.add(`rose:${hm}`, ICO0, M[hm](), [px + Math.cos(a) * Math.cos(e) * s * 0.85, by + Math.sin(e) * s * 0.7, pz + Math.sin(a) * Math.cos(e) * s * 0.85], [r() * 3, r() * 3, 0], [0.045, 0.04, 0.045]);
        }
      }
  },
  /** The bouncy castle's floor: a red base and a quilted blue mat. */
  bouncy(batch, sc, w, h, d, t) {
    batch.add(M.pvcRed(), G.rbox2, frame(t, [0, -h * 0.18, 0], [0, 0, 0], [w + 0.06, h * 0.66, d + 0.06]));
    batch.add(M.pvcBlue(), G.rbox2, frame(t, [0, h / 2 - h * 0.17, 0], [0, 0, 0], [w - 0.04, h * 0.34, d - 0.04]));
    for (let i = 1; i < 4; i++) batch.add(M.pvcSky(), capsule(0.05, d - 0.3), frame(t, [-w / 2 + (i / 4) * w, h / 2 - 0.035, 0], [Math.PI / 2, 0, 0]));
  },
  /** A wall of the bouncy castle: fat upright tubes in red and yellow under a blue rail. */
  bouncywall(batch, sc, w, h, d, t) {
    const along = d > w;
    const L = along ? d : w, T = along ? w : d;
    const n = Math.max(3, Math.round(L / 0.3));
    const rr = T / 2;
    for (let i = 0; i < n; i++) {
      const u = -L / 2 + rr + ((L - 2 * rr) * i) / (n - 1);
      batch.add(i % 2 ? M.pvcYellow() : M.pvcRed(), capsule(rr, h - 0.05), frame(t, along ? [0, -0.02, u] : [u, -0.02, 0]));
    }
    batch.add(M.pvcBlue(), capsule(rr * 1.15, L + 0.1), frame(t, [0, h / 2 - rr * 0.9, 0], along ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]));
  },
  /** The castle's back bumper: one fat yellow tube with red ends. */
  bouncybump(batch, sc, w, h, d, t) {
    const along = d > w;
    const L = along ? d : w;
    const rr = Math.min(h, along ? w : d) / 2;
    const rot = along ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2];
    batch.add(M.pvcYellow(), capsule(rr * 1.05, L - 0.5), frame(t, [0, 0, 0], rot));
    for (const s of [-1, 1]) batch.add(M.pvcRed(), capsule(rr * 1.12, 0.5), frame(t, along ? [0, 0, s * (L / 2 - 0.25)] : [s * (L / 2 - 0.25), 0, 0], rot));
  },
  /** A garden trampoline: black mat on springs inside a padded steel frame. */
  trampoline(batch, sc, w, h, d, t) {
    const top = h / 2;
    for (const [lx, lz, sx, sz] of [[0, d / 2 - 0.12, w, 0.24], [0, -d / 2 + 0.12, w, 0.24], [w / 2 - 0.12, 0, 0.24, d - 0.48], [-w / 2 + 0.12, 0, 0.24, d - 0.48]])
      batch.add(M.pvcBlue(), G.rbox2, frame(t, [lx, top - 0.04, lz], [0, 0, 0], [sx, 0.08, sz]));
    batch.add(M.tyre(), G.box, frame(t, [0, top - 0.06, 0], [0, 0, 0], [w - 0.52, 0.02, d - 0.52]), NO_CAST);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const u = -0.5 + (i + 0.5) / n;
      for (const s of [-1, 1]) {
        batch.add(M.steel(), G.cyl8, frame(t, [u * (w - 0.6), top - 0.07, s * (d / 2 - 0.25)], [Math.PI / 2, 0, 0], [0.012, 0.1, 0.012]));
        batch.add(M.steel(), G.cyl8, frame(t, [s * (w / 2 - 0.25), top - 0.07, u * (d - 0.6)], [0, 0, Math.PI / 2], [0.012, 0.1, 0.012]));
      }
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) batch.add(M.steel(), G.cyl8, frame(t, [sx * (w / 2 - 0.1), -0.04, sz * (d / 2 - 0.1)], [0, 0, 0], [0.03, h - 0.08, 0.03]));
  },
};

// ---------------------------------------------------------------- cylinder looks

export const PARK_CYL_LOOKS = {
  /** The bandstand's stone plinth: a moulded cap, a darker foot, boards on top. */
  bandbase(batch, sc, col) {
    const [x, cy, z] = col.c;
    const r = col.r, h = col.hh * 2, y0 = cy - col.hh;
    const g12 = new THREE.CylinderGeometry(1, 1, 1, 12);
    batch.add(M.stone(), g12, { p: [x, y0 + (h - 0.1) / 2, z], s: [r * 1.012, h - 0.1, r * 1.012] });
    batch.add(M.trim(), g12, { p: [x, y0 + h - 0.05, z], s: [r * 1.012 + 0.08, 0.1, r * 1.012 + 0.08] });
    batch.add(M.quayside(), g12, { p: [x, y0 + 0.08, z], s: [r * 1.012 + 0.05, 0.16, r * 1.012 + 0.05] });
    batch.add(M.planks(), new THREE.CylinderGeometry(1, 1, 1, 24), { p: [x, y0 + h + 0.005, z], s: [r - 0.08, 0.012, r - 0.08] }, NO_CAST);
    // steps up on the pond side
    for (let i = 0; i < 2; i++) batch.add(M.stone(), G.box, { p: [x - r - 0.18 - i * 0.32, y0 + (h * (2 - i)) / 3 / 2, z], s: [0.36, (h * (2 - i)) / 3, 1.5] });
  },
};

// ---------------------------------------------------------------- decor

const SCALLOP = (() => {
  const s = new THREE.Shape();
  const w = 1;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, -0.55);
  s.absarc(0, -0.55, w / 2, 0, Math.PI, true);
  s.lineTo(-w / 2, 0);
  return new THREE.ShapeGeometry(s, 6);
})();

export const PARK_DECOR = {
  /** A tree by the course (b.tree): limbs and a fine crown. */
  parktree(batch, sc, d, at0) {
    drawTree(batch, sc, d.kind ?? 'oak', at0[0], at0[1], at0[2], d.h, d.r, d.seed ?? 1, true);
  },
  /** The woods either side of the course: a mix of trees, coarser, off the walks. */
  woods(batch, sc, d) {
    const r = rng(d.seed ?? 1);
    for (let i = 0; i < d.n; i++) {
      const side = r() < 0.5 ? -1 : 1;
      let ax = d.xin + r() * (d.xout - d.xin);
      if (d.walk && Math.abs(ax - d.walk) < 2.4) ax += ax < d.walk ? -2.6 : 2.6;
      const z = d.z0 + r() * (d.z1 - d.z0);
      const kind = pickKind(r());
      const h = 4.6 + r() * 3.4, cr = (kind === 'poplar' ? 1.4 : 1.9) + r() * 1.2;
      const seed = Math.floor(r() * 1e5);
      if (skipped(d.skip, z)) continue;
      drawTree(batch, sc, kind, side * ax, levelOf(d.levels, z), z, h, cr, seed, false);
    }
  },
  /** Gravel walks either side beyond the hedges, stone edged, with lamps. */
  walks(batch, sc, d) {
    for (const [z0, z1, y] of d.bands)
      for (const sx of [-1, 1]) {
        const x = sx * d.x, zc = (z0 + z1) / 2, L = z1 - z0;
        batch.add(M.gravel(), G.box, { p: [x, y + 0.008, zc], s: [d.w, 0.016, L] }, NO_CAST);
        for (const e of [-1, 1]) batch.add(M.stone(), G.box, { p: [x + e * (d.w / 2 + 0.05), y + 0.02, zc], s: [0.1, 0.05, L] }, NO_CAST);
        for (let z = z0 + 4; z < z1 - 2; z += 14) {
          const lx = x + sx * (d.w / 2 + 0.5);
          batch.add(M.parkGreen(), G.cyl8, { p: [lx, y + 0.2, z], s: [0.11, 0.4, 0.11] });
          batch.add(M.parkGreen(), G.cyl8, { p: [lx, y + 1.7, z], s: [0.05, 3.0, 0.05] });
          batch.add(M.parkGreen(), G.box, { p: [lx, y + 3.0, z], s: [0.5, 0.04, 0.04] });
          batch.add(M.lamp(), G.box, { p: [lx, y + 3.36, z], s: [0.2, 0.3, 0.2] });
          batch.add(M.parkGreen(), G.cone, { p: [lx, y + 3.6, z], s: [0.18, 0.2, 0.18] });
        }
      }
  },
  /** Flower borders along the inner foot of the hedges: drifts of colour in dark soil. */
  borders(batch, sc, d) {
    const r = rng(d.seed ?? 5);
    const cols = ['flowerPurple', 'flowerPink', 'flowerWhite', 'lemon', 'flowerRed'];
    for (const [z0, z1, y] of d.bands)
      for (const sx of [-1, 1]) {
        const x0 = sx * (d.x - d.w / 2);
        batch.add(M.soil(), G.box, { p: [x0, y + 0.01, (z0 + z1) / 2], s: [d.w, 0.02, z1 - z0] }, NO_CAST);
        let drift = Math.floor(r() * cols.length), left = 3 + r() * 5;
        for (let z = z0 + 0.3; z < z1 - 0.3; z += 0.55) {
          if ((left -= 0.55) < 0) (drift = (drift + 1 + Math.floor(r() * 3)) % cols.length), (left = 3 + r() * 5);
          for (const row of [-0.2, 0.2]) {
            const px = x0 + row * sx + (r() - 0.5) * 0.12, pz = z + (r() - 0.5) * 0.2 + (row > 0 ? 0.27 : 0);
            const s = 0.16 + r() * 0.08;
            sc.add('border:leaf', paintedBlob(Math.floor(r() * 5), 1, 1), M.leaves(), [px, y + s * 0.6, pz], [0, r() * 3, 0], [s, s * 0.9, s]);
            const hm = cols[(drift + (r() < 0.15 ? 1 : 0)) % cols.length];
            for (let k = 0; k < 2; k++) sc.add(`border:${hm}`, ICO0, M[hm](), [px + (r() - 0.5) * s, y + s * 1.25 + r() * 0.08, pz + (r() - 0.5) * s], [r() * 3, r() * 3, 0], [0.05, 0.045, 0.05]);
          }
        }
      }
  },
  /** People in the park beyond the hedges: picnics, walkers with dogs, frisbee, benches, a child with a balloon. */
  parkfolk(batch, sc, d) {
    const r = rng(d.seed ?? 8);
    for (let i = 0; i < d.n; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const x = side * (d.xin + r() * (d.xout - d.xin));
      const z = d.z0 + r() * (d.z1 - d.z0);
      const kind = r(), yaw = r() * TAU;
      if (skipped(d.skip, z)) continue;
      const p = [x, levelOf(d.levels, z), z];
      if (kind < 0.28) picnicGroup(batch, r, p, yaw);
      else if (kind < 0.5) {
        // along the walk, a couple or one with a dog
        const wp = [side * (d.walk + (r() - 0.5) * 0.8), p[1], z];
        const ya = r() < 0.5 ? 0 : Math.PI;
        walker(batch, r, wp, ya, r() < 0.55);
        if (r() < 0.5) person(batch, loc(wp, ya, 0.55, 0, 0.1), ya, 'stand', lookOf(r));
      } else if (kind < 0.62) {
        // frisbee across the grass, the disc in the air between them
        const b2 = loc(p, yaw, 0, 0, 6);
        person(batch, p, yaw, 'stand', lookOf(r));
        person(batch, b2, yaw + Math.PI, 'stand', lookOf(r));
        batch.add(M.frisbee(), DISC, at(p, yaw, [0.3, 1.9, 2.6], [0.15, 0, 0.1], [0.13, 0.025, 0.13]));
      } else if (kind < 0.8) {
        // a bench facing the course, someone on it, maybe a dog at their feet
        const bp = [side * (d.walk - 1.6), p[1], z];
        const ya = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        bench(batch, bp, ya);
        person(batch, loc(bp, ya, -0.35, 0.34, 0.05), ya, 'sit', lookOf(r));
        if (r() < 0.5) person(batch, loc(bp, ya, 0.4, 0.34, 0.05), ya, 'sit', lookOf(r));
        else if (r() < 0.5) dog(batch, loc(bp, ya, 0.6, 0, 0.6), ya + 0.6, [0, 2, 4, 5, 6][Math.floor(r() * 5)]);
      } else if (kind < 0.9) {
        // someone reading, lying on a towel
        batch.add(M.gingham(), G.box, at(p, yaw, [0, 0.012, 0], [0, 0, 0], [0.9, 0.02, 1.9]));
        person(batch, loc(p, yaw, 0, 0.02, 0.2), yaw, 'lieFront', lookOf(r));
        batch.add(M.white(), G.box, at(p, yaw, [0, 0.07, -0.85], [0.6, 0, 0], [0.24, 0.02, 0.16]));
      } else {
        // a child with a balloon and a grown-up
        person(batch, p, yaw, 'stand', lookOf(r));
        const cp = loc(p, yaw, 0.6, 0, 0.2);
        person(batch, cp, yaw, 'stand', lookOf(r), 0.62);
        const hand = loc(cp, yaw, 0.2, 0.6, 0.05), bl = [hand[0] + 0.2, hand[1] + 1.4, hand[2]];
        batch.add(M.string(), G.cyl8, between(hand, bl, 0.006));
        batch.add(M.balloon(), G.sphere, { p: [bl[0], bl[1] + 0.2, bl[2]], s: [0.2, 0.25, 0.2] });
      }
    }
  },
  /** The duck pond's fixtures: a dark bed under the water, a stone kerb, lily pads in flower, reeds, the duck house. */
  pond(batch, sc, d, at0) {
    const [x, y, z] = at0;
    const R = d.r;
    const r = rng(Math.round(x * 7 + z));
    batch.add(M.pondBed(), new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), { p: [x, y + 0.006, z], s: [R + 0.08, 1, R + 0.08] }, NO_CAST);
    const n = Math.round((TAU * (R + 0.22)) / 0.52);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      batch.add(M.stone(), G.rbox, { p: [x + Math.cos(a) * (R + 0.22), y + 0.03, z + Math.sin(a) * (R + 0.22)], r: [0, -a, 0], s: [0.38, 0.1, 0.5] });
    }
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, rr = R * (0.35 + r() * 0.55);
      const s = 0.16 + r() * 0.14;
      const lp = [x + Math.cos(a) * rr, y + 0.03, z + Math.sin(a) * rr];
      batch.add(M.lily(), LILY, { p: lp, r: [0, r() * TAU, 0], s: [s, 1, s] }, NO_CAST);
      if (i % 3 === 0) {
        for (let k = 0; k < 6; k++) batch.add(i % 2 ? M.flowerPink() : M.flowerWhite(), G.cone, { p: [lp[0] + Math.cos(k) * 0.035, y + 0.07, lp[2] + Math.sin(k) * 0.035], r: [Math.cos(k) * 0.5, 0, -Math.sin(k) * 0.5], s: [0.03, 0.08, 0.03] });
        batch.add(M.lemon(), G.sphere, { p: [lp[0], y + 0.07, lp[2]], s: [0.025, 0.02, 0.025] });
      }
    }
    // reeds and bulrushes round the far side
    for (let c = 0; c < 6; c++) {
      const a = Math.PI * (0.55 + (c / 5) * 0.9) + (r() - 0.5) * 0.2;
      const cx = x + Math.cos(a) * (R - 0.05), cz = z + Math.sin(a) * (R - 0.05);
      for (let j = 0; j < 10; j++) {
        const len = 0.7 + r() * 0.6, ox = (r() - 0.5) * 0.4, oz = (r() - 0.5) * 0.4;
        const tilt = [(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3];
        sc.add('reed', G.cyl8, M.reed(), [cx + ox, y + len / 2, cz + oz], tilt, [0.012, len, 0.012]);
        if (j < 3) sc.add('bulrush', capsule(0.03, 0.18), M.bulrush(), [cx + ox + tilt[2] * -len * 0.5, y + len + 0.05, cz + oz + tilt[0] * len * 0.5], tilt, [1, 1, 1]);
      }
    }
    // the duck house on its post, a ramp down into the water
    const hx = x - R * 0.42, hz = z + R * 0.38;
    batch.add(M.bark(), G.cyl8, { p: [hx, y + 0.3, hz], s: [0.06, 0.7, 0.06] });
    batch.add(M.planks(), G.box, { p: [hx, y + 0.66, hz], s: [0.8, 0.04, 0.7] });
    batch.add(M.hutPal(), G.box, { p: [hx, y + 0.86, hz], s: [0.52, 0.36, 0.42] }, { paint: 1 });
    batch.add(M.red(), G.prism, { p: [hx, y + 1.04, hz], s: [0.62, 0.22, 0.5] });
    batch.add(M.dark(), G.box, { p: [hx + 0.262, y + 0.8, hz], s: [0.01, 0.2, 0.14] });
    batch.add(M.planks(), G.box, { p: [hx + 0.62, y + 0.36, hz], r: [0, 0, -0.62], s: [0.6, 0.03, 0.2] });
    // a sign: no fishing (not that you'd mind)
    batch.add(M.bark(), G.box, { p: [x + R + 0.6, y + 0.5, z - R * 0.6], s: [0.05, 1.0, 0.05] });
    batch.add(M.white(), G.box, { p: [x + R + 0.6, y + 0.95, z - R * 0.6], s: [0.04, 0.26, 0.42] });
  },
  /** The bandstand: iron columns with brackets, a balustrade, a striped canvas roof with a scalloped edge, pennants, and
   *  the band playing (a tuba, a drum, a trumpet) toward the pond. */
  bandstand(batch, sc, d, at0) {
    const [x, y, z] = at0;
    const R = d.r, floor = y + (d.base ?? 0.7), roof = d.roof;
    const rimR = 2.95, roofTop = roof + 0.16;
    const colR = 2.35;
    const cols = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const px = x + Math.cos(a) * colR, pz = z + Math.sin(a) * colR;
      cols.push([px, pz, a]);
      batch.add(M.parkGreen(), G.cyl8, { p: [px, (floor + roof) / 2, pz], s: [0.075, roof - floor, 0.075] });
      batch.add(M.parkGreen(), G.box, { p: [px, floor + 0.14, pz], r: [0, -a, 0], s: [0.22, 0.28, 0.22] });
      batch.add(M.trim(), G.cyl8, { p: [px, roof - 0.06, pz], s: [0.13, 0.12, 0.13] });
      // brackets out to the roof's ring either side
      for (const s of [-1, 1]) {
        const b = a + s * 0.2;
        batch.add(M.parkGreen(), G.cyl8, between([px, roof - 0.65, pz], [x + Math.cos(b) * (colR + 0.05), roof - 0.05, z + Math.sin(b) * (colR + 0.05)], 0.022));
      }
      // a pennant on the rim above each column
      const fx = x + Math.cos(a) * (rimR - 0.05), fz = z + Math.sin(a) * (rimR - 0.05);
      batch.add(M.trim(), G.cyl8, { p: [fx, roofTop + 0.3, fz], s: [0.015, 0.6, 0.015] });
      batch.add(i % 2 ? M.lemonPaint() : M.blueDeep(), G.prism, { p: [fx, roofTop + 0.5, fz], r: [0, -a, -Math.PI / 2], s: [0.2, 0.32, 0.01] });
    }
    // the balustrade between the columns (open on the pond side, where the steps are)
    for (let i = 0; i < 8; i++) {
      const [ax, az, a0] = cols[i], [bx, bz] = cols[(i + 1) % 8];
      const mid = a0 + Math.PI / 8;
      if (Math.cos(mid) < -0.9) continue;
      for (const hy of [0.12, 0.85]) batch.add(M.trim(), G.cyl8, between([ax, floor + hy, az], [bx, floor + hy, bz], 0.03));
      for (let k = 1; k < 7; k++) {
        const u = k / 7;
        batch.add(M.parkGreen(), G.cyl8, { p: [ax + (bx - ax) * u, floor + 0.48, az + (bz - az) * u], s: [0.016, 0.72, 0.016] });
      }
    }
    // the roof: a shallow cone of red and white panels, a white rim, a scalloped valance hanging round
    const n = 16;
    for (let i = 0; i < n; i++) {
      const g = new THREE.ConeGeometry(rimR, 0.06, 3, 1, true, (i / n) * TAU, TAU / n);
      batch.add(i % 2 ? M.canvasWhite() : M.canvasRed(), g, { p: [x, roofTop + 0.025, z] });
    }
    batch.add(M.trim(), new THREE.TorusGeometry(rimR, 0.045, 6, 48).rotateX(Math.PI / 2), { p: [x, roofTop - 0.005, z] });
    batch.add(M.trim(), new THREE.TorusGeometry(colR + 0.05, 0.035, 6, 40).rotateX(Math.PI / 2), { p: [x, roof - 0.05, z] });
    const nv = 28;
    for (let i = 0; i < nv; i++) {
      const a = ((i + 0.5) / nv) * TAU;
      const w = (TAU * rimR) / nv;
      batch.add(i % 2 ? M.canvasWhite() : M.canvasRed(), SCALLOP, { p: [x + Math.cos(a) * rimR, roofTop - 0.02, z + Math.sin(a) * rimR], r: [0, -a + Math.PI / 2, 0], s: [w * 1.02, 0.42, 1] }, NO_CAST);
    }
    // the band, facing the pond: a tuba, a drum, a trumpet, music stands
    const band = [[0.6, -1.0, 'tuba'], [1.35, 0, 'drum'], [0.6, 1.0, 'trumpet']];
    const r = rng(Math.round(x * 3 + z));
    for (const [lx, lz, inst] of band) {
      const p = [x + lx, floor, z + lz];
      const yaw = -Math.PI / 2;
      person(batch, p, yaw, 'stand', { skin: Math.floor(r() * 8), cloth: 0, hair: Math.floor(r() * 8), top: true });
      batch.add(M.red(), G.cyl, { p: [p[0], floor + 1.78, p[2]], s: [0.13, 0.12, 0.13] });
      batch.add(M.dark(), G.box, { p: [p[0] - 0.12, floor + 1.73, p[2]], s: [0.08, 0.02, 0.2] });
      if (inst === 'tuba') {
        batch.add(M.brass(), new THREE.TorusGeometry(0.2, 0.06, 6, 16), at(p, yaw, [0, 1.15, 0.22], [0, Math.PI / 2, 0]));
        batch.add(M.brass(), new THREE.ConeGeometry(0.2, 0.4, 14, 1, true), at(p, yaw, [0.05, 1.5, 0.28], [0, 0, 0]));
      } else if (inst === 'drum') {
        batch.add(M.white(), G.cyl, at(p, yaw, [0, 0.95, 0.3], [Math.PI / 2, 0, 0], [0.26, 0.3, 0.26]));
        batch.add(M.red(), G.cyl, at(p, yaw, [0, 0.95, 0.3], [Math.PI / 2, 0, 0], [0.27, 0.06, 0.27]));
      } else {
        batch.add(M.brass(), G.cyl8, at(p, yaw, [0, 1.45, 0.35], [Math.PI / 2 - 0.2, 0, 0], [0.02, 0.4, 0.02]));
        batch.add(M.brass(), new THREE.ConeGeometry(0.06, 0.12, 10, 1, true), at(p, yaw, [0, 1.49, 0.58], [-Math.PI / 2 - 0.2, 0, 0]));
      }
      const sp = loc(p, yaw, 0, 0, 0.75);
      batch.add(M.wroughtIron(), G.cyl8, { p: [sp[0], floor + 0.55, sp[2]], s: [0.012, 1.1, 0.012] });
      batch.add(M.wroughtIron(), G.box, at(sp, yaw, [0, 1.1, 0], [-0.5, 0, 0], [0.4, 0.28, 0.01]));
      batch.add(M.white(), G.box, at(sp, yaw, [0, 1.11, -0.008], [-0.5, 0, 0], [0.36, 0.24, 0.005]));
    }
  },
  /** The bouncy castle's turrets (domed, with spikes and pennants), its blower, and shoes left at the front. */
  bouncy(batch, sc, d, at0) {
    const [x, y, z] = at0;
    const hw = d.w / 2 + 0.16;
    let i = 0;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const tx = x + sx * hw, tz = z + sz * hw;
        const th = sz < 0 ? 2.7 : 2.3;
        batch.add(i % 2 ? M.pvcYellow() : M.pvcRed(), capsule(0.34, th), { p: [tx, y + th / 2, tz] });
        for (let k = 1; k < 4; k++) batch.add(M.pvcBlue(), new THREE.TorusGeometry(0.34, 0.05, 6, 20).rotateX(Math.PI / 2), { p: [tx, y + (k / 4) * th * 0.9, tz] });
        batch.add(M.pvcBlue(), G.sphere, { p: [tx, y + th, tz], s: [0.38, 0.32, 0.38] });
        batch.add(M.pvcYellow(), G.cone, { p: [tx, y + th + 0.45, tz], s: [0.14, 0.5, 0.14] });
        batch.add(M.pvcGreen(), G.prism, { p: [tx + 0.14, y + th + 0.62, tz], r: [0, 0, -Math.PI / 2], s: [0.16, 0.26, 0.01] });
        i++;
      }
    // the blower on the grass behind, its tube into the side
    const bx = x + hw + 0.9, bz = z + 1.2;
    batch.add(M.pvcGreen(), G.rbox, { p: [bx, y + 0.2, bz], s: [0.5, 0.4, 0.4] });
    batch.add(M.dark(), G.cyl, { p: [bx + 0.26, y + 0.2, bz], r: [0, 0, Math.PI / 2], s: [0.14, 0.02, 0.14] });
    batch.add(M.pvcRed(), capsule(0.1, 1.2), { p: [bx - 0.55, y + 0.25, bz], r: [0, 0, Math.PI / 2 + 0.2] });
    // shoes left at the entrance
    const r = rng(Math.round(x * 5 + z));
    for (let k = 0; k < 6; k++) batch.add([M.plasticRed(), M.plasticBlue(), M.white(), M.pvcGreen()][k % 4], G.rbox, { p: [x - 1.2 + k * 0.42 + (r() - 0.5) * 0.1, y + 0.04, z - hw - 0.35 + (r() - 0.5) * 0.15], r: [0, (r() - 0.5) * 1.2, 0], s: [0.09, 0.08, 0.2] });
  },
};

// ---------------------------------------------------------------- the moving pond

/** The pond's water (deep green-teal, glinting) with rings spreading, and three ducks paddling slow rounds. */
export function makePond(root, z) {
  const g = new THREE.Group();
  g.position.set(z.c[0], z.c[1] + 0.014, z.c[2]);
  const water = new THREE.Mesh(new THREE.CircleGeometry(z.r + 0.08, 48).rotateX(-Math.PI / 2), M.pond());
  water.receiveShadow = true;
  g.add(water);
  const ringGeo = new THREE.RingGeometry(0.9, 1.0, 32).rotateX(-Math.PI / 2);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe8fff8, transparent: true, opacity: 0, depthWrite: false }));
    m.position.y = 0.004;
    g.add(m);
    rings.push(m);
  }
  const body = new THREE.SphereGeometry(1, 12, 8);
  const ducks = [];
  for (let i = 0; i < 3; i++) {
    const duck = new THREE.Group();
    const drake = i !== 1;
    const add = (mat, geo, p, s, r = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...p);
      m.scale.set(...s);
      m.rotation.set(...r);
      m.castShadow = true;
      duck.add(m);
      return m;
    };
    add(M.duckBrown(), body, [0, 0.06, 0], [0.11, 0.08, 0.17]);
    add(drake ? M.china() : M.duckBrown(), body, [0, 0.06, -0.16], [0.06, 0.05, 0.06], [0.5, 0, 0]);
    add(M.duckBrown(), body, [0, 0.1, 0.02], [0.1, 0.05, 0.13]);
    add(M.china(), body, [0, 0.13, 0.11], [0.04, 0.012, 0.04]);
    const head = add(drake ? M.duckGreen() : M.duckBrown(), body, [0, 0.2, 0.14], [0.06, 0.06, 0.07]);
    add(M.duckBill(), body, [0, 0.19, 0.21], [0.025, 0.014, 0.05]);
    add(M.dark(), body, [0.045, 0.215, 0.16], [0.01, 0.01, 0.01]);
    add(M.dark(), body, [-0.045, 0.215, 0.16], [0.01, 0.01, 0.01]);
    g.add(duck);
    ducks.push({ duck, head, rad: z.r * (0.4 + i * 0.18), speed: 0.11 + i * 0.03, phase: i * 2.1, dir: i === 1 ? -1 : 1 });
  }
  root.add(g);
  return {
    zone: z,
    group: g,
    update(t) {
      for (let i = 0; i < rings.length; i++) {
        const k = ((t * 0.18 + i / rings.length) % 1 + 1) % 1;
        const d = ducks[i];
        rings[i].position.x = d.duck.position.x;
        rings[i].position.z = d.duck.position.z;
        rings[i].scale.setScalar(0.15 + k * 0.7);
        rings[i].material.opacity = 0.4 * (1 - k);
      }
      for (const d of ducks) {
        const a = d.phase + t * d.speed * d.dir + Math.sin(t * 0.3 + d.phase) * 0.4;
        d.duck.position.set(Math.cos(a) * d.rad, Math.sin(t * 2.2 + d.phase) * 0.008, Math.sin(a) * d.rad * 0.85);
        d.duck.rotation.y = Math.atan2(-Math.sin(a) * d.dir, Math.cos(a) * 0.85 * d.dir);
        // now and then a duck dips its head
        const dip = Math.max(0, Math.sin(t * 0.7 + d.phase * 3) - 0.85) * 6;
        d.head.position.y = 0.2 - dip * 0.14;
        d.head.position.z = 0.14 + dip * 0.06;
      }
    },
  };
}
