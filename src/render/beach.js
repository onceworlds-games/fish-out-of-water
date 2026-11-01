// The beach: dunes with marram and sand fences, the promenade (railings, lamps, bunting, the ice-cream kiosk) and its
// row of painted huts, the pier out to sea, a crowd of sunbathers beyond the groynes, rock pools with weed, barnacles
// and starfish, deckchairs, a lilo, a paddling pool, lifeguard flags and surfboards; and the moving things: kites on
// their strings and the blowhole's spout.

import * as THREE from 'three';
import { M } from './materials.js';
import { G, rng } from './geo.js';
import { tiledBox } from './batch.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const NO_CAST = { cast: false };
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- shared shapes

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

/** A matrix from a parent frame (p, yaw) and a local offset, rotation (YXZ) and scale. */
function at(p, yaw, local, rot = [0, 0, 0], scale = [1, 1, 1]) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  tmpV.set(p[0] + local[0] * c + local[2] * s, p[1] + local[1], p[2] - local[0] * s + local[2] * c);
  tmpE.set(rot[0], rot[1] + yaw, rot[2], 'YXZ');
  tmpQ.setFromEuler(tmpE);
  tmpS.set(scale[0], scale[1], scale[2]);
  return tmpM.clone().compose(tmpV, tmpQ, tmpS);
}

const capsules = new Map();
function capsuleOf(r, len) {
  const key = `${r.toFixed(3)}:${len.toFixed(2)}`;
  let g = capsules.get(key);
  if (!g) capsules.set(key, (g = new THREE.CapsuleGeometry(r, Math.max(0.002, len - 2 * r), 3, 8)));
  return g;
}

/** A limb from a to b (points in the person's frame), radius r: a capsule between them. */
export function limb(batch, mat, p, yaw, a, b, r, paint) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  const local = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, ONE);
  batch.add(mat, capsuleOf(r, len), at(p, yaw, [0, 0, 0]).multiply(local), { paint });
}

/**
 * A person, low-poly: pose 'stand' | 'sit' | 'lie' | 'lieFront' | 'kneel' | 'wade'. look: { skin, cloth, hair, top }
 * (palette indices), size (1 adult, ~0.65 a child). At p (feet on the ground there), facing yaw.
 */
export function person(batch, p, yaw, pose, look, size = 1) {
  const k = size;
  const skin = M.skinPal(), cloth = M.clothPal(), hair = M.hairPal();
  const S = (v) => v.map((x) => x * k);
  const add = (mat, geo, local, rot, scale, paint) => batch.add(mat, geo, at(p, yaw, S(local), rot, scale.map((x) => x * k)), { paint });
  const legs = (a1, b1, a2, b2) => {
    limb(batch, skin, p, yaw, S(a1), S(b1), 0.07 * k, look.skin);
    limb(batch, skin, p, yaw, S(a2), S(b2), 0.07 * k, look.skin);
  };
  if (pose === 'stand' || pose === 'wade') {
    legs([-0.1, 0.06, 0], [-0.1, 0.82, 0], [0.1, 0.06, 0], [0.1, 0.82, 0]);
    add(cloth, G.sphere, [0, 0.9, 0], [0, 0, 0], [0.2, 0.16, 0.13], look.cloth);
    add(look.top ? cloth : skin, G.sphere, [0, 1.17, 0], [0, 0, 0], [0.19, 0.27, 0.13], look.top ? look.cloth : look.skin);
    limb(batch, skin, p, yaw, S([-0.24, 1.38, 0]), S([-0.3, 0.92, 0.05]), 0.055 * k, look.skin);
    limb(batch, skin, p, yaw, S([0.24, 1.38, 0]), S([0.3, 0.92, 0.05]), 0.055 * k, look.skin);
    add(skin, G.sphere, [0, 1.58, 0], [0, 0, 0], [0.12, 0.14, 0.13], look.skin);
    add(hair, G.sphere, [0, 1.63, -0.02], [0, 0, 0], [0.13, 0.11, 0.135], look.hair);
  } else if (pose === 'sit') {
    legs([-0.1, 0.1, 0.05], [-0.1, 0.12, 0.62], [0.1, 0.1, 0.05], [0.1, 0.12, 0.62]);
    add(cloth, G.sphere, [0, 0.14, 0], [0, 0, 0], [0.2, 0.13, 0.16], look.cloth);
    add(look.top ? cloth : skin, G.sphere, [0, 0.42, -0.04], [-0.15, 0, 0], [0.19, 0.27, 0.13], look.top ? look.cloth : look.skin);
    limb(batch, skin, p, yaw, S([-0.24, 0.62, -0.04]), S([-0.26, 0.14, -0.2]), 0.055 * k, look.skin);
    limb(batch, skin, p, yaw, S([0.24, 0.62, -0.04]), S([0.26, 0.14, -0.2]), 0.055 * k, look.skin);
    add(skin, G.sphere, [0, 0.83, 0.02], [0, 0, 0], [0.12, 0.14, 0.13], look.skin);
    add(hair, G.sphere, [0, 0.88, 0], [0, 0, 0], [0.13, 0.11, 0.135], look.hair);
  } else if (pose === 'kneel') {
    legs([-0.1, 0.08, -0.35], [-0.1, 0.1, 0.1], [0.1, 0.08, -0.35], [0.1, 0.1, 0.1]);
    add(cloth, G.sphere, [0, 0.3, -0.05], [0, 0, 0], [0.2, 0.15, 0.15], look.cloth);
    add(look.top ? cloth : skin, G.sphere, [0, 0.58, 0.05], [0.35, 0, 0], [0.19, 0.26, 0.13], look.top ? look.cloth : look.skin);
    limb(batch, skin, p, yaw, S([-0.22, 0.76, 0.1]), S([-0.18, 0.2, 0.42]), 0.055 * k, look.skin);
    limb(batch, skin, p, yaw, S([0.22, 0.76, 0.1]), S([0.2, 0.2, 0.4]), 0.055 * k, look.skin);
    add(skin, G.sphere, [0, 0.95, 0.2], [0, 0, 0], [0.12, 0.14, 0.13], look.skin);
    add(hair, G.sphere, [0, 0.99, 0.17], [0, 0, 0], [0.13, 0.11, 0.135], look.hair);
  } else {
    // lying along +z (head at -z), on the back or the front
    const front = pose === 'lieFront';
    legs([-0.1, 0.08, 0.15], [-0.1, 0.08, 0.92], [0.1, 0.08, 0.15], [0.12, 0.08, 0.92]);
    add(cloth, G.sphere, [0, 0.1, 0.05], [0, 0, 0], [0.2, 0.11, 0.17], look.cloth);
    add(look.top ? cloth : skin, G.sphere, [0, 0.11, -0.3], [0, 0, 0], [0.2, 0.12, 0.28], look.top ? look.cloth : look.skin);
    limb(batch, skin, p, yaw, S([-0.25, 0.08, -0.5]), S(front ? [-0.42, 0.06, -0.85] : [-0.3, 0.06, -0.05]), 0.055 * k, look.skin);
    limb(batch, skin, p, yaw, S([0.25, 0.08, -0.5]), S(front ? [0.42, 0.06, -0.85] : [0.32, 0.06, 0.0]), 0.055 * k, look.skin);
    add(skin, G.sphere, [0, 0.12, -0.72], [0, 0, 0], [0.12, 0.12, 0.14], look.skin);
    add(hair, G.sphere, [0, front ? 0.17 : 0.1, -0.76], [0, 0, 0], [0.13, 0.1, 0.13], look.hair);
  }
}

/** A striped beach parasol on its pole (drawn only: the crowd's). */
function parasol(batch, x, y, z, r, mat, tilt = 0) {
  batch.add(M.white(), G.cyl8, { p: [x, y + 1.05, z], r: [tilt, 0, 0], s: [0.03, 2.1, 0.03] });
  const top = [x, y + 2.1, z - Math.sin(tilt) * 1.05];
  const g = new THREE.ConeGeometry(r, 0.42, 16, 1, true);
  batch.add(mat, g, { p: [top[0], top[1] + 0.12, top[2]], r: [tilt, 0, 0] }, NO_CAST);
  batch.add(M.white(), G.sphere, { p: [top[0], top[1] + 0.35, top[2]], s: [0.05, 0.05, 0.05] });
}

const STRIPES = () => [M.awningRed(), M.awningBlue(), M.awningLemon(), M.awningGreen()];

// ---------------------------------------------------------------- box looks

export const BEACH_BOX_LOOKS = {
  prom(batch, sc, w, h, d, t) {
    batch.add(M.flags(), tiledBox(w, h, d, 1.2), frame(t));
  },
  promstep(batch, sc, w, h, d, t) {
    batch.add(M.steps(), tiledBox(w, h, d, 1.2), frame(t));
    batch.add(M.trim(), G.box, frame(t, [0, h / 2 - 0.03, d / 2 - 0.05], [0, 0, 0], [w + 0.02, 0.07, 0.12]));
  },
  /** An inflatable lilo: tubes across, a pillow at the head, in stripes. */
  lilo(batch, sc, w, h, d, t, col) {
    const a = col?.tint === 'blue' ? M.plasticBlue() : M.plasticRed();
    const n = Math.max(4, Math.round((d - 0.3) / 0.19));
    const step = (d - 0.32) / n;
    for (let i = 0; i < n; i++) batch.add(i % 2 ? M.plasticWhite() : a, G.cyl, frame(t, [0, 0, -d / 2 + 0.32 + step * (i + 0.5)], [0, 0, Math.PI / 2], [h * 0.48, w * 0.96, h * 0.48]));
    batch.add(a, G.cyl, frame(t, [0, 0.03, -d / 2 + 0.15], [0, 0, Math.PI / 2], [h * 0.62, w, h * 0.62]));
    batch.add(M.plasticWhite(), G.box, frame(t, [0, -h * 0.35, 0], [0, 0, 0], [w * 0.98, h * 0.2, d * 0.98]));
  },
  /** An old timber groyne: boards between posts, weed and barnacles low down, posts standing proud. */
  groyne(batch, sc, w, h, d, t) {
    const r = rng(Math.round(t.p[0] * 7 + t.p[2]));
    batch.add(M.driftwood(), tiledBox(w * 0.62, h, d, 1.6), frame(t));
    // the weathered top board
    batch.add(M.planks(), tiledBox(w * 0.72, 0.06, d, 1.6), frame(t, [0, h / 2 - 0.02, 0]));
    // a band of weed and barnacles at the foot
    batch.add(M.algae(), G.box, frame(t, [0, 0.12 - t.p[1], 0], [0, 0, 0], [w * 0.66, 0.3, d]));
    for (let z = -d / 2 + 0.5; z < d / 2; z += 1.7) {
      const up = 0.08 + r() * 0.3;
      const side = r() < 0.5 ? -1 : 1;
      batch.add(M.driftwood(), G.cyl8, frame(t, [side * w * 0.36, up / 2, z], [0, r() * 3, 0], [0.13, h + up, 0.13]));
      batch.add(M.iron(), G.cyl8, frame(t, [0, h / 2 - 0.25, z], [0, 0, Math.PI / 2], [0.025, w * 0.95, 0.025]));
      for (let k = 0; k < 4; k++) sc.add('barnacle', G.cone, M.barnacle(), pointIn(t, [side * (w * 0.33 + 0.02), 0.03 + r() * 0.3 - t.p[1], z + (r() - 0.5) * 0.6]), [0, 0, side * 1.4], [0.025, 0.03, 0.025]);
    }
  },
  /** The boardwalk: slats across two stringers, on short posts. */
  boardwalk(batch, sc, w, h, d, t) {
    const n = Math.floor(d / 0.17);
    for (let i = 0; i < n; i++) batch.add(M.planks(), G.box, frame(t, [0, h / 2 - 0.025, -d / 2 + 0.085 + i * 0.17], [0, 0, 0], [w, 0.05, 0.15]));
    for (const sx of [-1, 1]) batch.add(M.driftwood(), G.box, frame(t, [sx * (w / 2 - 0.15), 0, 0], [0, 0, 0], [0.1, h - 0.05, d]));
    for (let z = -d / 2 + 0.6; z < d / 2; z += 1.8)
      for (const sx of [-1, 1]) batch.add(M.driftwood(), G.cyl8, frame(t, [sx * (w / 2 + 0.02), -0.1, z], [0, 0, 0], [0.07, h + 0.2, 0.07]));
  },
};

/** A frame for a box look (t: { p, r }) and a local offset/rotation/scale inside it, as a Matrix4. */
function frame(t, local = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  tmpE.set(t.r?.[0] ?? 0, t.r?.[1] ?? 0, t.r?.[2] ?? 0, 'YXZ');
  const base = new THREE.Matrix4().compose(tmpV.set(t.p[0], t.p[1], t.p[2]), tmpQ.setFromEuler(tmpE), tmpS.set(1, 1, 1));
  tmpE.set(rot[0], rot[1], rot[2], 'YXZ');
  const loc = new THREE.Matrix4().compose(new THREE.Vector3(...local), new THREE.Quaternion().setFromEuler(tmpE), new THREE.Vector3(...scale));
  return base.multiply(loc);
}

/** A world point from a box look's frame and a local point. */
function pointIn(t, local) {
  const v = new THREE.Vector3(...local).applyMatrix4(frame(t));
  return [v.x, v.y, v.z];
}

// ---------------------------------------------------------------- sphere looks: the dunes

export const BEACH_SPHERE_LOOKS = {
  /** A dune: the cap of a buried sphere, eased into the flat sand at its foot (same sand, mapped by the world). */
  dune(batch, sc, col) {
    const R = col.r, cy = col.c[1];
    const rf = Math.sqrt(R * R - cy * cy);
    const r0 = rf * 0.9, r1 = rf * 1.16;
    const y0 = cy + Math.sqrt(R * R - r0 * r0);
    const s0 = -r0 / Math.sqrt(R * R - r0 * r0);
    const height = (r) => {
      if (r <= r0) return cy + Math.sqrt(R * R - r * r);
      if (r >= r1) return -0.03;
      const u = (r - r0) / (r1 - r0);
      const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2;
      return h00 * y0 + h10 * s0 * (r1 - r0) + h01 * -0.03;
    };
    const NR = 26, NA = 56;
    const pos = [];
    const idx = [];
    pos.push(0, height(0), 0);
    for (let i = 1; i <= NR; i++) {
      const u = i / NR;
      const r = r1 * Math.sqrt(u) ** 0.8;
      for (let j = 0; j < NA; j++) {
        const a = (j / NA) * TAU;
        pos.push(Math.cos(a) * r, height(r), Math.sin(a) * r);
      }
    }
    for (let j = 0; j < NA; j++) idx.push(0, 1 + ((j + 1) % NA), 1 + j);
    for (let i = 1; i < NR; i++)
      for (let j = 0; j < NA; j++) {
        const a = 1 + (i - 1) * NA + j, b = 1 + (i - 1) * NA + ((j + 1) % NA);
        const c = 1 + i * NA + j, d = 1 + i * NA + ((j + 1) % NA);
        idx.push(a, b, d, a, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    batch.add(M.sand(), g, { p: [col.c[0], 0.004, col.c[2]] }, { ground: -1 });
  },
};

// ---------------------------------------------------------------- marram: tufts of blades, straw at the tips

let tuftGeo = null;
function tuft() {
  if (tuftGeo) return tuftGeo;
  const r = rng(77);
  const pos = [], col = [], idx = [];
  const base = new THREE.Color(0x4a5a26), mid = new THREE.Color(0x8fa04a), tip = new THREE.Color(0xd9cb8c);
  const c = new THREE.Color();
  for (let b = 0; b < 15; b++) {
    const a = r() * TAU, lean = 0.25 + r() * 0.55, h = 0.45 + r() * 0.4, w = 0.018 + r() * 0.01;
    const dx = Math.cos(a), dz = Math.sin(a);
    const v0 = pos.length / 3;
    for (let k = 0; k <= 4; k++) {
      const u = k / 4;
      const out = lean * u * u * h;
      const x = dx * (0.03 + out), z = dz * (0.03 + out), y = h * u - lean * u * u * h * 0.25;
      const ww = w * (1 - u * 0.95);
      pos.push(x - dz * ww, y, z + dx * ww, x + dz * ww, y, z - dx * ww);
      c.copy(base).lerp(mid, Math.min(1, u * 1.6)).lerp(tip, Math.max(0, u - 0.55) / 0.45);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let k = 0; k < 4; k++) {
      const i = v0 + k * 2;
      idx.push(i, i + 1, i + 3, i, i + 3, i + 2);
    }
  }
  tuftGeo = new THREE.BufferGeometry();
  tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tuftGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  tuftGeo.setIndex(idx);
  tuftGeo.computeVertexNormals();
  return tuftGeo;
}

function duneY(dunes, x, z) {
  let y = 0;
  for (const [dx, dz, top, R] of dunes ?? []) {
    const d2 = (x - dx) ** 2 + (z - dz) ** 2;
    if (d2 < R * R) y = Math.max(y, top - R + Math.sqrt(R * R - d2));
  }
  return y;
}

// ---------------------------------------------------------------- decor

export const BEACH_DECOR = {
  /** Marram grass on the dunes (not on the line over their crests), a few sand fences, tufts along the sea wall. */
  marram(batch, sc, d) {
    const r = rng(d.seed ?? 1);
    const nearWalk = (x, z) => (d.avoid ?? []).some(([ax, az], i, a) => {
      if (!i) return false;
      const [bx, bz] = a[i - 1];
      const L2 = (ax - bx) ** 2 + (az - bz) ** 2;
      const k = Math.max(0, Math.min(1, ((x - bx) * (ax - bx) + (z - bz) * (az - bz)) / L2));
      return Math.hypot(x - (bx + (ax - bx) * k), z - (bz + (az - bz) * k)) < 1.5;
    });
    const put = (x, z, s = 1) => {
      const y = duneY(d.dunes, x, z);
      sc.add('marram', tuft(), M.marram(), [x, y - 0.02, z], [0, r() * TAU, 0], [s, s * (0.8 + r() * 0.5), s]);
    };
    for (const [dx, dz, top, R] of d.dunes ?? []) {
      const rf = Math.sqrt(R * R - (R - top) ** 2);
      const n = Math.round(rf * rf * 0.9);
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, rr = rf * (0.15 + 0.95 * Math.sqrt(r()));
        const x = dx + Math.cos(a) * rr, z = dz + Math.sin(a) * rr;
        // keep the line over the crest clear (it runs along z near x 0, and over the top of the tallest)
        if (Math.abs(x - (dx > -3 ? 0 : dx)) < 1.6 && Math.abs(z - dz) < rf) continue;
        if (Math.abs(x) > 12.2 || nearWalk(x, z)) continue;
        // clumps: a few tufts together
        const m = 1 + Math.floor(r() * 3);
        for (let k = 0; k < m; k++) put(x + (r() - 0.5) * 0.7, z + (r() - 0.5) * 0.7, 0.8 + r() * 0.5);
      }
      // a sand fence along one flank: chestnut paling wired in a line, some slats leaning
      const fa = r() * TAU;
      const fx = dx + Math.cos(fa) * rf * 0.6, fz = dz + Math.sin(fa) * rf * 0.6;
      const fyaw = fa + Math.PI / 2;
      const len = rf * 0.9;
      for (let s = -len / 2; s < len / 2; s += 0.12) {
        const x = fx + Math.cos(fyaw) * s, z = fz + Math.sin(fyaw) * s;
        if (Math.abs(x) > 12.2 || Math.abs(x - (dx > -3 ? 0 : dx)) < 1.8 || nearWalk(x, z)) continue;
        const y = duneY(d.dunes, x, z);
        const h = 0.75 + r() * 0.2;
        sc.add('paling', G.box, M.paling(), [x, y + h / 2 - 0.1, z], [(r() - 0.5) * 0.12, -fyaw, (r() - 0.5) * 0.1], [0.045, h, 0.02]);
      }
    }
    // along the foot of the sea wall and the groynes
    for (let i = 0; i < (d.n ?? 60); i++) {
      const side = r();
      const x = side < 0.5 ? -12 + r() * 24 : (r() < 0.5 ? -11.8 : 11.8) + (r() - 0.5) * 0.6;
      const z = side < 0.5 ? 3.4 + r() * 1.2 : 4 + r() * 90;
      if (nearWalk(x, z) || (Math.abs(x) < 3 && z < 6)) continue;
      put(x, z, 0.7 + r() * 0.5);
    }
  },

  /** The promenade's edge: the sea wall, railings (gaps for the steps and the start), lamps, bunting, benches, the
   *  ice-cream kiosk. */
  promenade(batch, sc, d, at0) {
    const y = at0[1], z = at0[2];
    const W = d.x1 - d.x0, cx = (d.x0 + d.x1) / 2;
    batch.add(M.stone(), tiledBox(W, y + 0.6, 0.5, 1.6), { p: [cx, (y - 0.6) / 2, z - 0.25] });
    batch.add(M.trim(), G.box, { p: [cx, y + 0.04, z - 0.18], s: [W, 0.1, 0.42] });
    const gaps = [[-8.8, -4.2], [-2.6, 2.6]];
    const inGap = (x) => gaps.some(([a, b]) => x > a && x < b);
    // railings: posts, two rails, balusters between
    for (let x = d.x0; x <= d.x1; x += 1.25) {
      if (inGap(x)) continue;
      batch.add(M.blueDeep(), G.cyl8, { p: [x, y + 0.5, z - 0.3], s: [0.035, 1.0, 0.035] });
      batch.add(M.blueDeep(), G.sphere, { p: [x, y + 1.03, z - 0.3], s: [0.05, 0.05, 0.05] });
    }
    const runs = [];
    let a = d.x0;
    for (const [g0, g1] of gaps) {
      runs.push([a, g0]);
      a = g1;
    }
    runs.push([a, d.x1]);
    for (const [r0, r1] of runs) {
      if (r1 - r0 < 0.3) continue;
      for (const h of [0.98, 0.55, 0.12]) batch.add(M.blueDeep(), G.cyl8, { p: [(r0 + r1) / 2, y + h, z - 0.3], r: [0, 0, Math.PI / 2], s: [0.022, r1 - r0, 0.022] });
      for (let x = r0 + 0.15; x < r1; x += 0.16) sc.add('baluster', G.cyl8, M.blueDeep(), [x, y + 0.55, z - 0.3], [0, 0, 0], [0.011, 0.86, 0.011]);
    }
    // lamp posts with two lanterns, bunting strung between them
    const lamps = [];
    for (let x = d.x0 + 4; x <= d.x1; x += 10) {
      if (inGap(x) || Math.abs(x) < 4) continue;
      const lz = z - 0.75;
      batch.add(M.blueDeep(), G.cyl8, { p: [x, y + 0.2, lz], s: [0.16, 0.4, 0.16] });
      batch.add(M.blueDeep(), G.cyl8, { p: [x, y + 2.0, lz], s: [0.07, 3.6, 0.07] });
      batch.add(M.brass(), G.torus, { p: [x, y + 0.9, lz], r: [Math.PI / 2, 0, 0], s: [0.09, 0.09, 0.6] });
      batch.add(M.blueDeep(), G.box, { p: [x, y + 3.55, lz], s: [1.2, 0.05, 0.05] });
      for (const s of [-1, 1]) {
        batch.add(M.blueDeep(), G.cone, { p: [x + s * 0.55, y + 3.62, lz], s: [0.14, 0.12, 0.14] });
        batch.add(M.lamp(), G.cyl8, { p: [x + s * 0.55, y + 3.42, lz], s: [0.09, 0.26, 0.09] }, NO_CAST);
      }
      batch.add(M.blueDeep(), G.sphere, { p: [x, y + 3.85, lz], s: [0.06, 0.1, 0.06] });
      lamps.push([x, y + 3.5, lz]);
    }
    const pennants = [M.kiteA(), M.kiteB(), M.kiteC(), M.white()];
    const flagG = new THREE.ConeGeometry(0.11, 0.24, 3);
    for (let i = 1; i < lamps.length; i++) {
      const [ax, ay, az] = lamps[i - 1], [bx] = lamps[i];
      const L = bx - ax;
      for (let s = 0.3, k = 0; s < L - 0.2; s += 0.42, k++) {
        const u = s / L;
        const yy = ay + 0.05 - Math.sin(u * Math.PI) * 0.7;
        sc.add(`pennant${k % 4}`, flagG, pennants[k % 4], [ax + s, yy - 0.12, az], [Math.PI, 0, 0], [1, 1, 0.15]);
      }
    }
    // benches facing the sea
    for (let x = d.x0 + 9; x < d.x1; x += 12) {
      if (Math.abs(x) < 5 || inGap(x)) continue;
      const bz = z - 1.9;
      batch.add(M.planks(), G.box, { p: [x, y + 0.45, bz], s: [1.6, 0.05, 0.42] });
      batch.add(M.planks(), G.box, { p: [x, y + 0.75, bz - 0.22], r: [-0.2, 0, 0], s: [1.6, 0.36, 0.04] });
      for (const s of [-1, 1]) batch.add(M.wroughtIron(), G.box, { p: [x + s * 0.7, y + 0.37, bz], s: [0.05, 0.74, 0.46] });
    }
    // the ice-cream kiosk
    const kx = 7.2, kz = z - 4.4;
    batch.add(M.white(), tiledBox(3.0, 2.3, 2.2, 1.2), { p: [kx, y + 1.15, kz] });
    batch.add(M.dark(), G.box, { p: [kx, y + 1.45, kz + 1.11], s: [2.2, 0.9, 0.02] });
    batch.add(M.counterWood(), G.box, { p: [kx, y + 0.98, kz + 1.25], s: [2.6, 0.08, 0.32] });
    const aw = new THREE.PlaneGeometry(3.2, 1.0, 1, 1);
    const uv = aw.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 3.2) / 0.4, uv.getY(i));
    batch.add(M.awningRed(), aw, { p: [kx, y + 2.15, kz + 1.5], r: [-1.0, 0, 0] });
    batch.add(M.white(), G.box, { p: [kx, y + 2.38, kz], s: [3.2, 0.16, 2.4] });
    // the cone on the roof: wafer, three scoops, a flake
    batch.add(M.coneWafer(), G.cone, { p: [kx, y + 3.0, kz], r: [Math.PI, 0, 0], s: [0.38, 1.1, 0.38] });
    batch.add(M.scoopPink(), G.sphere, { p: [kx, y + 3.65, kz], s: [0.42, 0.36, 0.42] });
    batch.add(M.scoopVanilla(), G.sphere, { p: [kx - 0.18, y + 3.95, kz], s: [0.32, 0.3, 0.32] });
    batch.add(M.scoopChoc(), G.sphere, { p: [kx + 0.2, y + 4.0, kz + 0.05], s: [0.3, 0.28, 0.3] });
    batch.add(M.scoopChoc(), G.cyl8, { p: [kx + 0.05, y + 4.3, kz], r: [0, 0, 0.4], s: [0.05, 0.5, 0.05] });
    // a few people about
    const r = rng(19);
    for (const [px, pz, pose, yaw] of [[-14, z - 1.2, 'stand', Math.PI * 0.05], [-13.2, z - 1.0, 'stand', -0.2], [6.4, z - 2.4, 'stand', Math.PI], [8.2, z - 2.8, 'stand', Math.PI + 0.3], [17, z - 1.1, 'stand', 0.1], [24, z - 2.0, 'stand', Math.PI * 0.6], [-22, z - 1.5, 'stand', -Math.PI * 0.4], [-31, z - 1.1, 'stand', 0]]) {
      person(batch, [px, y, pz], yaw, pose, { skin: Math.floor(r() * 8), cloth: Math.floor(r() * 8), hair: Math.floor(r() * 8), top: true }, r() < 0.25 ? 0.68 : 1);
    }
  },

  /** A row of beach huts behind the promenade: painted boards, white gables, doors (some open, a deckchair out). */
  huts(batch, sc, d, at0) {
    const r = rng(53);
    const y = at0[1], z = at0[2];
    for (let x = d.x0, i = 0; x < d.x1; x += 3.1, i++) {
      if (Math.abs(x) < 3.2 || (x > 4.5 && x < 10.5) || (x > 29.5 && x < 38.5)) continue;
      const paint = i % 8;
      const W = 2.5, H = 2.3, D = 2.4;
      batch.add(M.hutPal(), tiledBox(W, H, D, 1.4), { p: [x, y + H / 2, z] }, { paint });
      // the gable: a white roof of two planes over a coloured gable end
      batch.add(M.hutPal(), G.prism, { p: [x, y + H, z + 0.01], s: [W, 0.95, D] }, { paint });
      for (const s of [-1, 1]) batch.add(M.white(), G.box, { p: [x + s * W * 0.27, y + H + 0.5, z], r: [0, 0, s * -0.65], s: [W * 0.62, 0.06, D + 0.25] });
      batch.add(M.white(), G.box, { p: [x, y + H + 0.02, z + D / 2 + 0.06], s: [W + 0.1, 0.1, 0.06] });
      // double doors: open on some
      const open = r() < 0.4;
      const door = (i * 3) % 8;
      if (open) {
        batch.add(M.dark(), G.box, { p: [x, y + 0.95, z + D / 2 + 0.005], s: [1.4, 1.9, 0.02] });
        for (const s of [-1, 1]) batch.add(M.hutPal(), G.box, { p: [x + s * 1.18, y + 0.95, z + D / 2 + 0.36], r: [0, s * 1.25, 0], s: [0.7, 1.9, 0.04] }, { paint: door });
        if (r() < 0.6) person(batch, [x + 0.3, y, z + D / 2 + 1.0], Math.PI * (0.9 + r() * 0.2), 'stand', { skin: Math.floor(r() * 8), cloth: Math.floor(r() * 8), hair: Math.floor(r() * 8), top: true });
      } else {
        for (const s of [-1, 1]) batch.add(M.hutPal(), G.box, { p: [x + s * 0.35, y + 0.95, z + D / 2 + 0.02], s: [0.68, 1.9, 0.04] }, { paint: door });
        batch.add(M.brass(), G.sphere, { p: [x + 0.08, y + 1.0, z + D / 2 + 0.06], s: [0.03, 0.03, 0.03] });
      }
      // a little deck in front, a number
      batch.add(M.planks(), G.box, { p: [x, y + 0.06, z + D / 2 + 0.5], s: [W, 0.1, 1.0] });
      batch.add(M.white(), G.cyl, { p: [x, y + 2.05, z + D / 2 + 0.04], r: [Math.PI / 2, 0, 0], s: [0.13, 0.02, 0.13] });
    }
  },

  /** The pier: a deck on iron legs out into the sea, railings and lamps, a helter-skelter, the pavilion at its end. */
  pier(batch, sc, d, at0) {
    const x = at0[0], Y = 4.2, W = 7;
    const z0 = d.z0, z1 = d.z1;
    for (let z = z0; z < z1; z += 24) {
      const len = Math.min(24, z1 - z);
      batch.add(M.planks(), tiledBox(W, 0.3, len, 1.6), { p: [x, Y, z + len / 2] });
      batch.add(M.white(), G.box, { p: [x, Y - 0.35, z + len / 2], s: [W + 0.3, 0.4, len] });
    }
    for (let z = z0 + 3; z < z1; z += 6) {
      for (const s of [-1, 1]) {
        batch.add(M.wroughtIron(), G.cyl8, { p: [x + s * (W / 2 - 0.4), (Y - 4) / 2 - 0.5, z], s: [0.16, Y + 3.5, 0.16] });
        batch.add(M.wroughtIron(), G.box, { p: [x + s * (W / 2 - 0.4), Y - 1.6, z + 3], r: [0.75, 0, 0], s: [0.06, 0.06, 4.2] });
      }
      batch.add(M.wroughtIron(), G.box, { p: [x, Y - 1.1, z], s: [W - 0.6, 0.08, 0.08] });
      for (const s of [-1, 1]) {
        batch.add(M.white(), G.cyl8, { p: [x + s * (W / 2 - 0.1), Y + 0.6, z], s: [0.05, 1.0, 0.05] });
      }
    }
    for (const s of [-1, 1]) for (const h of [1.08, 0.6]) batch.add(M.white(), G.box, { p: [x + s * (W / 2 - 0.1), Y + h, (z0 + z1) / 2], s: [0.06, 0.06, z1 - z0] });
    for (let z = z0 + 10; z < z1 - 30; z += 16)
      for (const s of [-1, 1]) {
        batch.add(M.white(), G.cyl8, { p: [x + s * (W / 2 - 0.3), Y + 2.0, z], s: [0.07, 3.6, 0.07] });
        batch.add(M.lamp(), G.sphere, { p: [x + s * (W / 2 - 0.3), Y + 3.9, z], s: [0.18, 0.22, 0.18] }, NO_CAST);
      }
    // kiosks along the deck
    for (const [kz, paint] of [[30, 0], [62, 2], [96, 1], [140, 4]]) {
      batch.add(M.hutPal(), tiledBox(2.4, 2.4, 3.2, 1.4), { p: [x + 1.6, Y + 1.35, kz] }, { paint });
      batch.add(M.white(), G.prism, { p: [x + 1.6, Y + 2.55, kz], s: [2.6, 0.9, 3.4] });
    }
    // the helter-skelter: a striped tower, a slide winding round it
    const hz = 118, hx = x - 1.2;
    batch.add(M.white(), G.cyl, { p: [hx, Y + 5, hz], s: [1.3, 10, 1.3] });
    for (let k = 0; k < 5; k++) batch.add(M.red(), G.cyl, { p: [hx, Y + 1 + k * 2, hz], s: [1.32, 0.9, 1.32] });
    batch.add(M.red(), G.cone, { p: [hx, Y + 11, hz], s: [1.8, 2.2, 1.8] });
    batch.add(M.lemonPaint(), G.sphere, { p: [hx, Y + 12.2, hz], s: [0.2, 0.2, 0.2] });
    for (let k = 0; k < 40; k++) {
      const a = k * 0.42, yy = Y + 9.5 - k * 0.22;
      batch.add(M.lemonPaint(), G.box, { p: [hx + Math.cos(a) * 1.75, yy, hz + Math.sin(a) * 1.75], r: [0, -a, 0.2], s: [0.5, 0.06, 0.8] });
    }
    // the pavilion at the end: a white hall, a green copper dome, flags
    const pz = z1 - 12;
    batch.add(M.white(), tiledBox(16, 6, 18, 1.6), { p: [x, Y + 3.15, pz] });
    for (let k = 0; k < 6; k++) batch.add(M.window(), G.box, { p: [x - 8.02, Y + 3, pz - 7 + k * 2.8], s: [0.04, 2.6, 1.6] });
    for (let k = 0; k < 6; k++) batch.add(M.window(), G.box, { p: [x + 8.02, Y + 3, pz - 7 + k * 2.8], s: [0.04, 2.6, 1.6] });
    batch.add(M.copperGreen(), new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2), { p: [x, Y + 6.2, pz], s: [6, 5, 6] });
    batch.add(M.white(), G.cyl, { p: [x, Y + 11.5, pz], s: [0.8, 1.2, 0.8] });
    batch.add(M.copperGreen(), G.cone, { p: [x, Y + 12.8, pz], s: [1.0, 1.6, 1.0] });
    for (const s of [-1, 1]) {
      batch.add(M.copperGreen(), new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2), { p: [x + s * 7, Y + 6.2, pz - 8], s: [1.6, 2.0, 1.6] });
      batch.add(M.white(), G.cyl8, { p: [x + s * 7, Y + 9.5, pz - 8], s: [0.04, 2.6, 0.04] });
      batch.add(M.red(), G.box, { p: [x + s * 7 + 0.4, Y + 10.5, pz - 8], s: [0.8, 0.5, 0.02] });
    }
  },

  /** The rest of the beach, out of reach beyond the groynes: parasols, windbreaks, towels and the people on them,
   *  children at their castles, people paddling at the water's edge. */
  crowd(batch, sc, d) {
    const r = rng(d.seed ?? 1);
    const stripes = STRIPES();
    const towel = (x, z, yaw, paint) => {
      batch.add(M.clothPal(), G.box, { p: [x, 0.012, z], r: [0, yaw, 0], s: [0.95, 0.02, 1.9] }, { paint });
      batch.add(M.white(), G.box, { p: [x, 0.014, z], r: [0, yaw, 0], s: [0.97, 0.018, 0.3] });
    };
    const look = () => ({ skin: Math.floor(r() * 8), cloth: Math.floor(r() * 8), hair: Math.floor(r() * 8), top: r() < 0.4 });
    for (let i = 0; i < d.n; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const x = side * (d.xin + r() * (d.xout - d.xin));
      const z = d.z0 + r() * (d.z1 - d.z0);
      const yaw = (r() - 0.5) * 0.8 + (r() < 0.3 ? Math.PI : 0);
      if (x > 29.5 && x < 38.5) continue;
      const k = r();
      if (k < 0.34) {
        // a parasol, a towel, someone lying under it
        parasol(batch, x, 0, z, 1.05 + r() * 0.2, stripes[Math.floor(r() * 4)], (r() - 0.5) * 0.25);
        towel(x + 0.5, z + 0.9, yaw, Math.floor(r() * 8));
        person(batch, [x + 0.5, 0.02, z + 0.95], yaw, r() < 0.5 ? 'lie' : 'lieFront', look());
      } else if (k < 0.5) {
        // a windbreak and two sitting behind it
        const wyaw = r() * 0.6 - 0.3;
        const mat = stripes[Math.floor(r() * 4)];
        for (let s = -1.6; s <= 1.6; s += 0.8) batch.add(M.driftwood(), G.cyl8, { p: [x + Math.cos(wyaw) * s, 0.6, z - Math.sin(wyaw) * s], s: [0.03, 1.3, 0.03] });
        const cloth = new THREE.PlaneGeometry(3.2, 1.0);
        const uv = cloth.attributes.uv;
        for (let q = 0; q < uv.count; q++) uv.setXY(q, (uv.getX(q) * 3.2) / 0.5, uv.getY(q));
        batch.add(mat, cloth, { p: [x, 0.62, z], r: [0, wyaw, 0] });
        person(batch, [x - 0.5, 0.02, z + 0.7], wyaw + Math.PI * (r() < 0.5 ? 0 : 1), 'sit', look());
        person(batch, [x + 0.6, 0.02, z + 0.8], wyaw, 'sit', look());
      } else if (k < 0.66) {
        towel(x, z, yaw, Math.floor(r() * 8));
        person(batch, [x, 0.02, z + 0.05], yaw, r() < 0.6 ? 'lie' : 'sit', look());
      } else if (k < 0.76) {
        // children at a sandcastle
        castle(batch, x, z, 0.5 + r() * 0.3, r);
        person(batch, [x + 0.9, 0, z + 0.2], -Math.PI / 2 + (r() - 0.5), 'kneel', look(), 0.62);
        if (r() < 0.6) person(batch, [x - 0.8, 0, z - 0.3], Math.PI / 2 + (r() - 0.5), 'kneel', look(), 0.58);
        bucket(batch, x + 0.4, z - 0.7, Math.floor(r() * 3));
      } else if (k < 0.86) {
        deckchair(batch, [x, 0, z], yaw, stripes[Math.floor(r() * 4)]);
        if (r() < 0.7) person(batch, [x, 0.22, z - 0.05], yaw, 'sit', look());
      } else if (k < 0.93) {
        // a pop-up tent
        batch.add(r() < 0.5 ? M.plasticBlue() : M.plasticOrange(), new THREE.SphereGeometry(1, 16, 8, 0, Math.PI, 0, Math.PI / 2), { p: [x, 0, z], r: [0, yaw, 0], s: [1.1, 0.95, 1.2] });
      } else {
        person(batch, [x, 0, z], r() * TAU, 'stand', look(), r() < 0.3 ? 0.65 : 1);
      }
    }
    // people paddling in the shallows, either side
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (14 + r() * 30);
      const z = 147 + r() * 6;
      const y = -0.9 * (z - 142) / 14;
      person(batch, [x, Math.max(-0.9, y) - 0.25, z], Math.PI + (r() - 0.5) * 2, 'stand', look(), r() < 0.35 ? 0.62 : 1);
    }
  },

  /** Where the dry sand meets the wet: a wavy damp edge and the line of weed and shells the tide left. */
  tideline(batch, sc, d, at0) {
    const z = at0[2];
    const r = rng(31);
    const pts = [];
    for (let x = d.x0; x <= d.x1 + 0.01; x += 0.8) pts.push([x, z - 0.4 - (Math.sin(x * 0.37) * 0.5 + Math.sin(x * 1.3) * 0.2 + 0.7)]);
    const pos = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      pos.push(ax, 0.003, az, ax, 0.003, z + 0.02, bx, 0.003, z + 0.02, ax, 0.003, az, bx, 0.003, z + 0.02, bx, 0.003, bz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    batch.add(M.wetsand(), g, null, { ground: -1 });
    for (let x = d.x0; x < d.x1; x += 0.35) {
      if (r() < 0.45) continue;
      const zz = z - 0.2 - (Math.sin(x * 0.37) * 0.5 + Math.sin(x * 1.3) * 0.2 + 0.7) * 0.6 + (r() - 0.5) * 0.5;
      sc.add('wrack', G.lowSphere, M.weed(), [x, 0.01, zz], [0, r() * 3, 0], [0.18 + r() * 0.2, 0.015, 0.05]);
      if (r() < 0.25) sc.add('shellw', G.lowSphere, M.china(), [x + 0.1, 0.015, zz + 0.08], [0, r() * 3, 0], [0.04, 0.02, 0.03]);
    }
  },

  /** Rock-pool rocks around a pool: wet sandstone, weed and barnacles on them, mussels, anemones, a starfish. `tall`:
   *  the blowhole's crater, taller and closer. */
  rocks(batch, sc, d, at0) {
    const r = rng(d.seed ?? 1);
    const n = Math.round(d.r * (d.tall ? 11 : 8));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r() * 0.3;
      const rr = d.r + 0.08 + r() * (d.tall ? 0.15 : 0.3);
      const s = (d.tall ? 0.32 : 0.2) + r() * 0.24;
      const hgt = d.tall ? 0.9 + r() * 0.6 : 0.55 + r() * 0.3;
      const p = [at0[0] + Math.cos(a) * rr, at0[1] + s * hgt * 0.3, at0[2] + Math.sin(a) * rr];
      batch.add(M.wetrock(), rockGeo(Math.floor(r() * 4)), { p, r: [r() * 0.4, r() * TAU, r() * 0.4], s: [s * 1.25, s * hgt, s] }, { ground: at0[1] });
      for (let k = 0; k < 3; k++) {
        const b = a + (r() - 0.5) * 0.5;
        sc.add('barnacle', G.cone, M.barnacle(), [at0[0] + Math.cos(b) * (rr - s * 0.9), at0[1] + 0.05 + r() * s * 0.4, at0[2] + Math.sin(b) * (rr - s * 0.9)], [r(), r() * 3, r()], [0.025, 0.03, 0.025]);
      }
      if (r() < 0.5) sc.add('mussel', G.lowSphere, M.mussel(), [p[0] - Math.cos(a) * s * 0.9, at0[1] + 0.04, p[2] - Math.sin(a) * s * 0.9], [0, r() * 3, 0.3], [0.05, 0.025, 0.028]);
      if (r() < 0.45) sc.add('weedr', G.lowSphere, M.algae(), [p[0], at0[1] + 0.03, p[2]], [0, r() * 3, 0], [s * 1.3, 0.04, s * 0.5]);
    }
    if (!d.tall) {
      for (let k = 0; k < 2; k++) {
        const a = r() * TAU, rr = d.r * (0.4 + r() * 0.5);
        sc.add('anemone', G.sphere, M.anemone(), [at0[0] + Math.cos(a) * rr, at0[1] - 0.02, at0[2] + Math.sin(a) * rr], [0, 0, 0], [0.06, 0.05, 0.06]);
      }
      const a = r() * TAU;
      sc.add('starfish', starGeo(), M.starfish(), [at0[0] + Math.cos(a) * (d.r + 0.25), at0[1] + 0.03, at0[2] + Math.sin(a) * (d.r + 0.25)], [0, r() * TAU, 0], [1, 1, 1]);
    }
  },

  /** A deckchair: a wooden frame and a striped sling. */
  deckchair(batch, sc, d, at0) {
    const tint = d.tint === 'blue' ? M.awningBlue() : d.tint === 'lemon' ? M.awningLemon() : M.awningRed();
    deckchair(batch, at0, d.yaw ?? 0, tint);
  },

  /** Lifeguard flags at the water's edge: red over yellow. */
  flags(batch, sc, d) {
    for (const [x, z] of d.at) {
      batch.add(M.white(), G.cyl8, { p: [x, 1.2, z], s: [0.035, 2.6, 0.035] });
      const g = new THREE.PlaneGeometry(0.8, 0.28, 6, 1);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) + 0.4) * 4) * 0.06 * (pos.getX(i) + 0.4));
      g.computeVertexNormals();
      batch.add(M.kiteA(), g, { p: [x + 0.42, 2.32, z] });
      batch.add(M.kiteB(), g, { p: [x + 0.42, 2.04, z] });
    }
  },

  /** Three surfboards stuck nose-up in the sand. */
  surfboards(batch, sc, d, at0) {
    const mats = [M.plasticWhite(), M.kiteC(), M.kiteB()];
    const stripe = [M.kiteA(), M.white(), M.kiteA()];
    for (let i = 0; i < 3; i++) {
      const x = at0[0] + (i - 1) * 0.55, z = at0[2] + (i % 2) * 0.2;
      const lean = (i - 1) * 0.12;
      batch.add(mats[i], G.sphere, { p: [x, 0.95, z], r: [0, 0.3 * (i - 1), lean], s: [0.27, 1.05, 0.04] });
      batch.add(stripe[i], G.box, { p: [x, 1.0, z + 0.02], r: [0, 0.3 * (i - 1), lean], s: [0.04, 1.6, 0.01] });
    }
  },

  /** An inflatable paddling pool around a puddle: two rings, a duck. */
  paddlingpool(batch, sc, d, at0) {
    const R = d.r + 0.12;
    const ring = new THREE.TorusGeometry(R, 0.12, 8, 28);
    batch.add(M.plasticBlue(), ring, { p: [at0[0], 0.12, at0[2]], r: [Math.PI / 2, 0, 0] });
    batch.add(M.plasticWhite(), ring, { p: [at0[0], 0.34, at0[2]], r: [Math.PI / 2, 0, 0] });
    batch.add(M.plasticBlue(), G.cyl, { p: [at0[0], 0.004, at0[2]], s: [R, 0.008, R] });
    batch.add(M.kiteB(), G.sphere, { p: [at0[0] + 0.3, 0.1, at0[2] - 0.2], s: [0.12, 0.09, 0.15] });
    batch.add(M.kiteB(), G.sphere, { p: [at0[0] + 0.3, 0.2, at0[2] - 0.08], s: [0.07, 0.07, 0.07] });
    batch.add(M.plasticOrange(), G.cone, { p: [at0[0] + 0.3, 0.2, at0[2] - 0.0], r: [Math.PI / 2, 0, 0], s: [0.03, 0.06, 0.02] });
  },

  /** Kites: flown by the course view; here, the people holding the strings. */
  kites(batch, sc, d) {
    kiteFlyers(batch, d.list);
  },
};

// ---------------------------------------------------------------- shared props

const rockGeos = [];
function rockGeo(i) {
  if (rockGeos[i]) return rockGeos[i];
  const ico = new THREE.IcosahedronGeometry(1, 3);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const g = mergeVertices(ico);
  const pos = g.attributes.position;
  const r = rng(101 + i * 17);
  const bumps = Array.from({ length: 6 }, () => [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, 0.15 + r() * 0.25]);
  const v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    let s = 1;
    for (const [bx, by, bz, a] of bumps) s += a * Math.max(0, v.x * bx + v.y * by + v.z * bz) ** 2 * 0.5;
    // flatten the bottom, so it sits
    v.multiplyScalar(s);
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.2;
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return (rockGeos[i] = g);
}

let starG = null;
function starGeo() {
  if (starG) return starG;
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2;
    const rr = i % 2 ? 0.05 : 0.15;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  starG = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  starG.rotateX(-Math.PI / 2);
  return starG;
}

function castle(batch, x, z, s, r) {
  batch.add(M.sandcastle(), G.cyl, { p: [x, s * 0.3, z], s: [s, s * 0.6, s] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    const tx = x + Math.cos(a) * s * 0.8, tz = z + Math.sin(a) * s * 0.8;
    batch.add(M.sandcastle(), G.cyl8, { p: [tx, s * 0.55, tz], s: [s * 0.3, s * 1.1, s * 0.33] });
    batch.add(M.sandcastle(), G.cone, { p: [tx, s * 1.25, tz], s: [s * 0.32, s * 0.4, s * 0.32] });
  }
  batch.add(M.white(), G.cyl8, { p: [x, s * 1.1, z], s: [0.012, s, 0.012] });
  batch.add(r() < 0.5 ? M.kiteA() : M.kiteC(), G.box, { p: [x + 0.08, s * 1.5, z], s: [0.16, 0.1, 0.01] });
}

function bucket(batch, x, z, k) {
  const mat = [M.plasticRed(), M.plasticBlue(), M.kiteB()][k % 3];
  batch.add(mat, new THREE.CylinderGeometry(0.13, 0.1, 0.22, 12, 1, true), { p: [x, 0.11, z] });
  batch.add(mat, G.cyl, { p: [x, 0.005, z], s: [0.1, 0.01, 0.1] });
  batch.add(M.plasticWhite(), G.torus, { p: [x, 0.2, z], r: [0, 0, Math.PI / 2], s: [0.13, 0.13, 0.13] });
}

function deckchair(batch, p, yaw, sling) {
  const fr = M.counterWood();
  // two side frames: the back leg sloping, the front leg, the arm
  for (const s of [-1, 1]) {
    batch.add(fr, G.box, at(p, yaw, [s * 0.3, 0.42, -0.12], [-0.55, 0, 0], [0.04, 1.0, 0.03]));
    batch.add(fr, G.box, at(p, yaw, [s * 0.33, 0.3, 0.32], [0.35, 0, 0], [0.04, 0.68, 0.03]));
    batch.add(fr, G.box, at(p, yaw, [s * 0.33, 0.48, 0.12], [0, 0, 0], [0.035, 0.03, 0.62]));
  }
  for (const zz of [-0.4, 0.3, 0.55]) batch.add(fr, G.box, at(p, yaw, [0, zz === -0.4 ? 0.85 : 0.12, zz], [0, 0, 0], [0.62, 0.03, 0.03]));
  // the sling: a curved strip from the top bar down and forward
  const g = new THREE.PlaneGeometry(0.56, 1.1, 1, 8);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getY(i) / 1.1 + 0.5; // 0 bottom .. 1 top
    pos.setXYZ(i, pos.getX(i), 0.12 + v * 0.72 - Math.sin(v * Math.PI) * 0.12, 0.45 - v * 0.85 + Math.sin(v * Math.PI) * 0.08);
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 0.56) / 0.18, uv.getY(i));
  batch.add(sling, g, at(p, yaw, [0, 0, 0]));
}

// ---------------------------------------------------------------- moving things: kites and the blowhole's spout

/** Kites flying over the beach: each on a string from someone on the sand, dipping and swaying, tails waving. */
export function makeKites(list) {
  const group = new THREE.Group();
  const mats = [M.kiteA(), M.kiteB(), M.kiteC()];
  const kites = [];
  const diamond = new THREE.BufferGeometry();
  diamond.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.55, 0, -0.38, 0, 0, 0, -0.75, 0, 0, 0.55, 0, 0, -0.75, 0, 0.38, 0, 0], 3));
  diamond.computeVertexNormals();
  for (const [x, z, h, i, hx, hz] of list) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(diamond, mats[i % 3]);
    const b = new THREE.Mesh(diamond, mats[(i + 1) % 3]);
    b.scale.set(0.55, 0.55, 1);
    b.position.z = 0.005;
    g.add(a, b);
    const spar = new THREE.Mesh(G.box, M.slate());
    spar.scale.set(0.015, 1.3, 0.015);
    spar.position.y = -0.1;
    g.add(spar);
    const tail = [];
    for (let k = 0; k < 7; k++) {
      const bow = new THREE.Mesh(G.box, mats[(i + k) % 3]);
      bow.scale.set(0.16, 0.06, 0.02);
      group.add(bow);
      tail.push(bow);
    }
    g.scale.setScalar(1.4);
    group.add(g);
    // the string: a thin line from the hand to the kite
    const lineG = new THREE.BufferGeometry();
    lineG.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12 * 3), 3));
    const line = new THREE.Line(lineG, new THREE.LineBasicMaterial({ color: 0xf4efe6, transparent: true, opacity: 0.7 }));
    line.frustumCulled = false;
    group.add(line);
    kites.push({ g, tail, line, x, z, h, ph: i * 1.7, hand: [hx, 1.45, hz] });
  }
  const v = new THREE.Vector3();
  return {
    group,
    update(t) {
      for (const k of kites) {
        const sx = Math.sin(t * 0.7 + k.ph) * 1.6 + Math.sin(t * 1.9 + k.ph) * 0.3;
        const sy = Math.sin(t * 1.1 + k.ph * 2) * 0.6;
        k.g.position.set(k.x + sx, k.h + sy, k.z + 2);
        k.g.rotation.set(-0.5, Math.PI + Math.sin(t * 0.7 + k.ph) * 0.3, Math.sin(t * 0.7 + k.ph) * 0.35);
        let px = k.g.position.x, py = k.g.position.y - 1.0, pz = k.g.position.z;
        for (let j = 0; j < k.tail.length; j++) {
          px += Math.sin(t * 4 + j * 0.8 + k.ph) * 0.12;
          py -= 0.32;
          pz -= 0.08;
          k.tail[j].position.set(px, py, pz);
          k.tail[j].rotation.z = Math.sin(t * 5 + j) * 0.6;
        }
        const pos = k.line.geometry.attributes.position;
        const [hx, hy, hz] = k.hand;
        for (let j = 0; j < 12; j++) {
          const u = j / 11;
          v.set(hx + (k.g.position.x - hx) * u, hy + (k.g.position.y - 0.5 - hy) * u - Math.sin(u * Math.PI) * 0.8, hz + (k.g.position.z - hz) * u);
          pos.setXYZ(j, v.x, v.y, v.z);
        }
        pos.needsUpdate = true;
      }
    },
  };
}

/** The anchors of the kites: the people flying them (static). */
export function kiteFlyers(batch, list) {
  const r = rng(5);
  for (const [x, z, , , hx, hz] of list) {
    const yaw = Math.atan2(x - hx, z + 2 - hz);
    person(batch, [hx, 0, hz], yaw, 'stand', { skin: Math.floor(r() * 8), cloth: Math.floor(r() * 8), hair: Math.floor(r() * 8), top: true }, r() < 0.4 ? 0.7 : 0.95);
  }
}

/** The blowhole's spout: a jet of white water up the column, spray bursting off its top and raining back, foam at its
 *  foot. Steady, so a player can read it. */
export function makeSpout(root, z) {
  const h = z.y1 - z.y0;
  const group = new THREE.Group();
  group.position.set(z.c[0], z.y0, z.c[2]);
  root.add(group);
  const jetMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uT;
      float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 p = vec2(vUv.x * 8.0, vUv.y * 5.0 - uT * 6.0);
        float w = n(p) * 0.6 + n(p * 2.3 + 1.7) * 0.4;
        float streak = smoothstep(0.35, 0.8, w);
        vec3 c = mix(vec3(0.55, 0.85, 0.95), vec3(1.0), streak);
        float a = (0.45 + 0.45 * streak) * smoothstep(1.0, 0.75, vUv.y) * smoothstep(0.0, 0.06, vUv.y);
        gl_FragColor = vec4(c, a);
      }`,
  });
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(z.r * 0.55, z.r * 0.3, h + 0.6, 16, 1, true), jetMat);
  jet.position.y = (h + 0.6) / 2;
  jet.renderOrder = 3;
  group.add(jet);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(z.r * 0.3, z.r * 0.16, h + 0.2, 12, 1, true), jetMat);
  core.position.y = (h + 0.2) / 2;
  group.add(core);
  // the crown and the rain: droplets thrown up off the top, falling back around
  const n = 90;
  const drops = new THREE.InstancedMesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.9 }), n);
  drops.frustumCulled = false;
  group.add(drops);
  const seeds = Array.from({ length: n }, (_, i) => [Math.sin(i * 12.9898) * 0.5 + 0.5, Math.sin(i * 78.233) * 0.5 + 0.5, Math.sin(i * 39.425) * 0.5 + 0.5]);
  // foam at the foot
  const foam = new THREE.Mesh(new THREE.RingGeometry(z.r * 0.3, z.r * 1.25, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
  foam.position.y = 0.03;
  group.add(foam);
  const m = new THREE.Matrix4();
  return {
    update(t) {
      jetMat.uniforms.uT.value = t;
      jet.scale.x = jet.scale.z = 1 + Math.sin(t * 13) * 0.04;
      for (let i = 0; i < n; i++) {
        const s = seeds[i];
        const k = (t * (0.7 + s[2] * 0.5) + s[0]) % 1;
        const a = s[1] * TAU;
        const v0 = 2.5 + s[2] * 2.5;
        const out = (0.6 + s[0] * 1.4) * k;
        const y = h + 0.3 + v0 * k * 1.1 - 9 * (k * 1.1) ** 2 * 0.5;
        if (y < 0) {
          m.makeScale(0.0001, 0.0001, 0.0001);
        } else {
          const sz = 0.03 + s[0] * 0.03;
          m.makeScale(sz, sz * 1.6, sz);
          m.setPosition(Math.cos(a) * out, y, Math.sin(a) * out);
        }
        drops.setMatrixAt(i, m);
      }
      drops.instanceMatrix.needsUpdate = true;
      foam.material.opacity = 0.45 + Math.sin(t * 7) * 0.12;
      foam.rotation.y = t * 0.6;
    },
  };
}
