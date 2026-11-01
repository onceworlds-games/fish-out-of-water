// The fish: sculpted bodies lofted from species profiles, skinned to a springy spine, with scale normal maps, iridescent
// wet skin that dries to chalk, fin membranes with rays, glossy eyes with lids, a mouth that gasps, and a socket for a hat.
// Fish lie on their side like real ones on a quay: the curl lifts nose and tail toward the sky. One controller per fish
// turns its body's motion and events into anticipation, a whip, tail beats, tumbles, squash and wobble.

import * as THREE from 'three';
import { makeHat } from './hats.js';

// ---------------------------------------------------------------- species
// Body space: x along the fish (nose +x), y to the back (dorsal), z across. L length, H height, W width (m).
// prof: [u, top, bottom, width] from the tail end (u 0) to the nose (u 1), as fractions of H/2 and W/2.
const SPECIES = {
  mackerel: {
    L: 0.6, H: 0.15, W: 0.09, nf: 2, nb: 3,
    prof: [[0, 0.16, 0.16, 0.3], [0.12, 0.22, 0.2, 0.38], [0.3, 0.6, 0.55, 0.7], [0.5, 0.95, 0.9, 0.95], [0.66, 1, 1, 1], [0.8, 0.88, 0.92, 0.9], [0.9, 0.62, 0.7, 0.7], [0.97, 0.3, 0.38, 0.4], [1, 0.02, 0.08, 0.05]],
    tail: 'fork', dorsal: [[0.62, 0.3, 0.55], [0.32, 0.18, 0.32]], anal: [[0.32, 0.18, 0.32]], finlets: true,
    eye: 0.024, eyeAt: [0.875, 0.25], mouthAt: 0.995, scale: 7, bump: 0.22, iri: 0.8, rough: 0.2,
  },
  goldfish: {
    L: 0.46, H: 0.24, W: 0.13, nf: 2, nb: 3,
    prof: [[0, 0.24, 0.24, 0.35], [0.12, 0.34, 0.32, 0.45], [0.3, 0.78, 0.8, 0.8], [0.5, 1, 1, 1], [0.66, 0.97, 0.98, 0.96], [0.8, 0.8, 0.84, 0.82], [0.9, 0.55, 0.58, 0.6], [0.97, 0.28, 0.3, 0.32], [1, 0.05, 0.08, 0.06]],
    tail: 'fan', dorsal: [[0.64, 0.36, 0.9]], anal: [[0.3, 0.16, 0.45]],
    eye: 0.03, eyeAt: [0.85, 0.28], mouthAt: 0.995, scale: 16, bump: 0.55, iri: 0.3, rough: 0.22,
  },
  flatfish: {
    L: 0.5, H: 0.06, W: 0.34, nf: 2, nb: 3, flat: true,
    prof: [[0, 0.3, 0.3, 0.18], [0.12, 0.45, 0.45, 0.3], [0.3, 0.85, 0.85, 0.82], [0.5, 1, 1, 1], [0.7, 0.95, 0.95, 0.94], [0.85, 0.75, 0.75, 0.72], [0.94, 0.5, 0.5, 0.42], [1, 0.1, 0.1, 0.06]],
    tail: 'round', fringe: true,
    eye: 0.022, eyeAt: [0.8, 0], mouthAt: 0.99, scale: 5, bump: 0.3, iri: 0.1, rough: 0.3,
  },
  puffer: {
    L: 0.4, H: 0.27, W: 0.26, nf: 2, nb: 3,
    prof: [[0, 0.3, 0.3, 0.3], [0.1, 0.38, 0.38, 0.38], [0.25, 0.8, 0.8, 0.8], [0.45, 1, 1, 1], [0.62, 1, 1, 1], [0.78, 0.9, 0.9, 0.9], [0.9, 0.66, 0.66, 0.66], [0.97, 0.36, 0.38, 0.38], [1, 0.1, 0.12, 0.12]],
    tail: 'small', dorsal: [[0.28, 0.14, 0.42]], anal: [[0.26, 0.12, 0.38]], spikes: true,
    eye: 0.034, eyeAt: [0.8, 0.32], mouthAt: 0.995, scale: 0, bump: 0.5, iri: 0.15, rough: 0.3,
  },
  eel: {
    L: 0.9, H: 0.08, W: 0.07, nf: 2, nb: 4, long: true,
    prof: [[0, 0.1, 0.1, 0.2], [0.15, 0.5, 0.5, 0.55], [0.4, 0.92, 0.92, 0.95], [0.6, 1, 1, 1], [0.8, 1, 1, 1], [0.92, 0.9, 0.9, 0.95], [0.98, 0.6, 0.62, 0.7], [1, 0.12, 0.2, 0.2]],
    tail: 'eel', dorsal: [[0.6, 0.6, 0]], anal: [[0.45, 0.45, 0]],
    eye: 0.018, eyeAt: [0.94, 0.4], mouthAt: 0.998, scale: 0, bump: 0.35, iri: 0.25, rough: 0.16,
  },
};
export const SPECIES_IDS = Object.keys(SPECIES);

// Colourways: [back, belly, pattern, fin, iris]
export const COLOURWAYS = {
  mackerel: [
    ['#1f7a8a', '#eef3f2', '#0d1d26', '#6f9ea6', '#e8b64a'],
    ['#2c58b0', '#f2f0ea', '#0e1630', '#7f9cd0', '#f0c050'],
    ['#2f8a55', '#f3efe2', '#10241a', '#93bf9c', '#e8c25a'],
    ['#6b3fa0', '#f4ecf6', '#1d0f2e', '#b096d0', '#ffd25a'],
    ['#c9932c', '#fff6e0', '#3a2508', '#e6c27a', '#ff8a3d'],
  ],
  goldfish: [
    ['#ff7a1a', '#ffd9a8', '#ffffff', '#ffa24d', '#202020'],
    ['#ff3d2e', '#fff1e0', '#ffffff', '#ff7a66', '#202020'],
    ['#f6f2ea', '#ffffff', '#ff6a2a', '#ffd2b4', '#202020'],
    ['#1b1b22', '#ff8a3d', '#ff8a3d', '#3a3a48', '#ffcf40'],
    ['#ffd23a', '#fff6cc', '#ff8a1a', '#ffe58a', '#202020'],
  ],
  flatfish: [
    ['#8a6b45', '#f1e6d2', '#ea7a32', '#a88a62', '#e8c25a'],
    ['#6f7a52', '#efe9d8', '#ffb347', '#93a070', '#e8c25a'],
    ['#9a8f84', '#f5f0e8', '#3d2f28', '#b8ada0', '#e8c25a'],
    ['#3f5f7a', '#eef2f4', '#ffd25a', '#7a9ab0', '#ffd25a'],
    ['#b85a3a', '#fbeee2', '#2a1a10', '#d8907a', '#ffe08a'],
  ],
  puffer: [
    ['#e8c25a', '#fbf6e8', '#5a3e1c', '#f0d890', '#202020'],
    ['#9fd0d8', '#fbfbf6', '#1d4a5a', '#cfe8ec', '#202020'],
    ['#f29a6a', '#fff4ea', '#7a2a1a', '#f8c8a8', '#202020'],
    ['#9a7ad8', '#f8f4ff', '#2a1a4a', '#c8b8f0', '#202020'],
    ['#7ac85a', '#f6fff0', '#1f3a12', '#b8e09a', '#202020'],
  ],
  eel: [
    ['#3b5a4a', '#e8d26a', '#1c2a22', '#5b7a62', '#f0c050'],
    ['#3a3a5a', '#f0e0a0', '#15152a', '#5a5a80', '#f0c050'],
    ['#7a5a3a', '#f2e2b0', '#2a1a10', '#9a7a5a', '#f0c050'],
    ['#1d6a8a', '#bff0ff', '#0a2a3a', '#4aa0c0', '#ffe066'],
    ['#8a2a3a', '#ffd0a0', '#2a0a10', '#c05060', '#ffe066'],
  ],
};

let LITE = false;
/** Low quality: plain standard materials (no clearcoat, iridescence or sheen) for fish made from now on. */
export function setFishQuality(q) {
  LITE = q === 'low';
}

// ---------------------------------------------------------------- shape helpers

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
/** [top, bottom, width] fractions at u. */
function profAt(sp, u) {
  const P = sp.prof;
  let i = 0;
  while (i < P.length - 2 && u > P[i + 1][0]) i++;
  const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)];
  const t = THREE.MathUtils.clamp((u - b[0]) / Math.max(1e-6, c[0] - b[0]), 0, 1);
  return [Math.max(0.01, catmull(a[1], b[1], c[1], d[1], t)), Math.max(0.01, catmull(a[2], b[2], c[2], d[2], t)), Math.max(0.01, catmull(a[3], b[3], c[3], d[3], t))];
}
const sgnPow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

/** A point on the skin at (u, angle a: 0 the back, π/2 the +z flank, π the belly). */
function surface(sp, u, a, out = [0, 0, 0]) {
  const [top, bot, wid] = profAt(sp, u);
  const c = Math.cos(a), s = Math.sin(a);
  const n = 0.85; // a little boxier than an ellipse: a fish has shoulders
  out[0] = -sp.L / 2 + u * sp.L;
  out[1] = sgnPow(c, n) * (sp.H / 2) * (c >= 0 ? top : bot);
  out[2] = sgnPow(s, n) * (sp.W / 2) * wid;
  return out;
}

function boneLayout(sp) {
  const step = sp.L / (sp.nf + sp.nb + 1.6);
  const xs = [];
  for (let i = sp.nb; i >= 1; i--) xs.push(-i * step);
  xs.push(0);
  for (let i = 1; i <= sp.nf; i++) xs.push(i * step);
  return { xs, step };
}
// positional order (tail .. nose) -> bone index: 0 root, 1..nf toward the nose, nf+1.. toward the tail
function orderToBone(order, sp) {
  if (order === sp.nb) return 0;
  if (order > sp.nb) return order - sp.nb;
  return sp.nf + (sp.nb - order);
}
function weightsAt(xs, sp, x, si, sw) {
  let a = 0;
  while (a < xs.length - 2 && x > xs[a + 1]) a++;
  let t = THREE.MathUtils.clamp((x - xs[a]) / (xs[a + 1] - xs[a]), 0, 1);
  t = t * t * (3 - 2 * t);
  si.push(orderToBone(a, sp), orderToBone(a + 1, sp), 0, 0);
  sw.push(1 - t, t, 0, 0);
}

function finish(acc) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(acc.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(acc.sw, 4));
  g.setIndex(acc.idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- geometry

const GEO = new Map();

function buildBody(sp) {
  const rings = sp.long ? 72 : 48;
  const around = 32;
  const { xs } = boneLayout(sp);
  const acc = { pos: [], uv: [], idx: [], si: [], sw: [] };
  const p = [0, 0, 0];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const u = t - Math.sin(t * Math.PI * 2) * 0.035; // a little denser at both ends
    for (let j = 0; j <= around; j++) {
      surface(sp, u, (j / around) * Math.PI * 2, p);
      acc.pos.push(p[0], p[1], p[2]);
      acc.uv.push(u, j / around);
      weightsAt(xs, sp, p[0], acc.si, acc.sw);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j, b = a + around + 1;
      acc.idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const pf = profAt(sp, 1);
  const nose = acc.pos.length / 3;
  acc.pos.push(sp.L / 2 + 0.003, (pf[0] - pf[1]) * sp.H * 0.25, 0);
  acc.uv.push(1, 0.5);
  weightsAt(xs, sp, sp.L / 2, acc.si, acc.sw);
  const tail = acc.pos.length / 3;
  acc.pos.push(-sp.L / 2 - 0.002, 0, 0);
  acc.uv.push(0, 0.5);
  weightsAt(xs, sp, -sp.L / 2, acc.si, acc.sw);
  for (let j = 0; j < around; j++) {
    const a = rings * (around + 1) + j;
    acc.idx.push(a, a + 1, nose);
    acc.idx.push(j + 1, j, tail);
  }
  return finish(acc);
}

/** A membrane fanning from `base` out to the outline, subdivided so it bends with the spine. */
function finFan(sp, xs, base, outline, opts, acc) {
  const rings = 6;
  const flat = opts.plane === 'xz';
  const put = (x, y, bulge) => (flat ? acc.pos.push(x, bulge, y) : acc.pos.push(x, y, bulge));
  const first = acc.pos.length / 3;
  put(base[0], base[1], 0);
  acc.uv.push(0, 0.5);
  weightsAt(xs, sp, base[0], acc.si, acc.sw);
  const n = outline.length;
  for (let r = 1; r <= rings; r++) {
    const k = r / rings;
    for (let i = 0; i < n; i++) {
      const o = outline[i];
      const x = base[0] + (o[0] - base[0]) * k, y = base[1] + (o[1] - base[1]) * k;
      // pleats between the rays and a cup, so light runs along them
      const pleat = Math.sin((i / (n - 1)) * Math.PI * (n - 1)) * 0.0018 * k;
      put(x, y, Math.sin(k * Math.PI) * (opts.cup ?? 0.003) + pleat);
      acc.uv.push(k, i / (n - 1));
      weightsAt(xs, sp, x, acc.si, acc.sw);
    }
  }
  for (let i = 0; i < n - 1; i++) acc.idx.push(first, first + 1 + i, first + 2 + i);
  for (let r = 1; r < rings; r++) {
    const a0 = first + 1 + (r - 1) * n, b0 = first + 1 + r * n;
    for (let i = 0; i < n - 1; i++) acc.idx.push(a0 + i, b0 + i, a0 + i + 1, a0 + i + 1, b0 + i, b0 + i + 1);
  }
}

/** A ribbon fin along an edge: pairs of [x, y0, y1]. */
function ribbon(sp, xs, pairs, acc, plane) {
  const first = acc.pos.length / 3;
  pairs.forEach(([x, y0, y1], i) => {
    for (const [k, y] of [[0, y0], [1, y1]]) {
      if (plane === 'xz') acc.pos.push(x, 0, y);
      else acc.pos.push(x, y, 0);
      acc.uv.push(k * 0.9, i / (pairs.length - 1));
      weightsAt(xs, sp, x, acc.si, acc.sw);
    }
  });
  for (let i = 0; i < pairs.length - 1; i++) {
    const a = first + i * 2;
    acc.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
}

function arc(cx, cy, r0, a0, a1, n, shape = () => 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = a0 + (a1 - a0) * t;
    const r = r0 * shape(t);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

function buildFins(sp) {
  const { xs } = boneLayout(sp);
  const acc = { pos: [], uv: [], idx: [], si: [], sw: [] };
  const H2 = sp.H / 2;
  const X = (u) => -sp.L / 2 + u * sp.L;
  const topAt = (u) => profAt(sp, u)[0] * H2;
  const botAt = (u) => -profAt(sp, u)[1] * H2;

  // the tail fin
  const tx = -sp.L / 2 + 0.012;
  const T = sp.flat ? sp.W * 0.4 : sp.H * 0.95;
  let tail;
  if (sp.tail === 'fork')
    tail = [[tx - 0.015, T * 0.1], [tx - 0.06, T * 0.42], [tx - 0.11, T * 0.7], [tx - 0.14, T * 0.82], [tx - 0.12, T * 0.55], [tx - 0.09, T * 0.22], [tx - 0.075, 0], [tx - 0.09, -T * 0.22], [tx - 0.12, -T * 0.55], [tx - 0.14, -T * 0.82], [tx - 0.11, -T * 0.7], [tx - 0.06, -T * 0.42], [tx - 0.015, -T * 0.1]];
  else if (sp.tail === 'fan') tail = arc(tx, 0, 0.19, Math.PI * 0.6, Math.PI * 1.4, 17, (t) => 0.72 + 0.32 * Math.sin(t * Math.PI) + 0.07 * Math.sin(t * Math.PI * 7));
  else if (sp.tail === 'round') tail = arc(tx, 0, 0.1, Math.PI * 0.68, Math.PI * 1.32, 11, (t) => 0.8 + 0.25 * Math.sin(t * Math.PI));
  else if (sp.tail === 'small') tail = arc(tx, 0, 0.08, Math.PI * 0.66, Math.PI * 1.34, 11, (t) => 0.72 + 0.32 * Math.sin(t * Math.PI));
  else tail = arc(tx + 0.03, 0, 0.075, Math.PI * 0.72, Math.PI * 1.28, 9, (t) => 0.7 + 0.35 * Math.sin(t * Math.PI));
  finFan(sp, xs, [tx + 0.02, 0], tail, { plane: sp.flat ? 'xz' : 'xy', cup: 0.002 }, acc);

  if (sp.fringe) {
    // a flatfish: a frilled fringe all round the disc, in its own plane
    for (const s of [1, -1]) {
      const pairs = [];
      for (let i = 0; i <= 28; i++) {
        const u = 0.1 + (i / 28) * 0.78;
        const edge = profAt(sp, u)[2] * (sp.W / 2);
        pairs.push([X(u), s * edge * 0.9, s * (edge + 0.026 * Math.sin((i / 28) * Math.PI) + 0.006)]);
      }
      ribbon(sp, xs, pairs, acc, 'xz');
    }
  }
  for (const [u0, len, h] of sp.dorsal ?? []) {
    if (sp.long) {
      const pairs = [];
      for (let i = 0; i < 48; i++) {
        const t = i / 47;
        const u = u0 - t * len;
        pairs.push([X(u), topAt(u) - 0.004, topAt(u) + 0.024 * (1 - t * 0.4)]);
      }
      ribbon(sp, xs, pairs, acc);
      continue;
    }
    const n = 11;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const u = u0 - t * len;
      const rise = h * sp.H * Math.pow(1 - t, 0.55) * Math.sin(Math.min(1, t * 2.6 + 0.2) * Math.PI * 0.5);
      pts.push([X(u), topAt(u) + rise + 0.002]);
    }
    const bu = u0 - len * 0.45;
    finFan(sp, xs, [X(bu), topAt(bu) - 0.01], pts, { cup: 0.002 }, acc);
  }
  for (const [u0, len, h] of sp.anal ?? []) {
    if (sp.long) {
      const pairs = [];
      for (let i = 0; i < 40; i++) {
        const t = i / 39;
        const u = u0 - t * len;
        pairs.push([X(u), botAt(u) + 0.004, botAt(u) - 0.02 * (1 - t * 0.4)]);
      }
      ribbon(sp, xs, pairs, acc);
      continue;
    }
    const n = 9;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const u = u0 - t * len;
      pts.push([X(u), botAt(u) - h * sp.H * Math.pow(1 - t, 0.7) * Math.sin(Math.min(1, t * 2.6 + 0.3) * Math.PI * 0.5) - 0.002]);
    }
    const bu = u0 - len * 0.45;
    finFan(sp, xs, [X(bu), botAt(bu) + 0.008], pts, { cup: -0.002 }, acc);
  }
  if (sp.finlets) {
    // a mackerel's little finlets behind the dorsal and anal fins
    for (let i = 0; i < 5; i++) {
      const u = 0.25 - i * 0.04;
      for (const s of [1, -1]) {
        const y = s > 0 ? topAt(u) : botAt(u);
        finFan(sp, xs, [X(u) + 0.005, y - s * 0.003], [[X(u) + 0.006, y + s * 0.002], [X(u) - 0.008, y + s * 0.016], [X(u) - 0.016, y + s * 0.006]], { cup: 0 }, acc);
      }
    }
  }
  return finish(acc);
}

function pectoralGeo(sp) {
  const len = sp.flat ? 0.05 : Math.max(0.055, sp.H * 0.48);
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-len * 0.3, len * 0.42, -len * 0.8, len * 0.4, -len, len * 0.2);
  s.bezierCurveTo(-len * 1.02, len * 0.02, -len * 0.85, -len * 0.16, -len * 0.62, -len * 0.18);
  s.bezierCurveTo(-len * 0.35, -len * 0.2, -len * 0.1, -len * 0.12, 0, -len * 0.06);
  const g = new THREE.ShapeGeometry(s, 10);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, Math.min(1, -p.getX(i) / len), THREE.MathUtils.clamp((p.getY(i) / len + 0.2) / 0.62, 0, 1));
  return g;
}

function geometryFor(spId) {
  if (!GEO.has(spId)) {
    const sp = SPECIES[spId];
    GEO.set(spId, { body: buildBody(sp), fins: buildFins(sp), pec: pectoralGeo(sp), rest: restLift(sp) });
  }
  return GEO.get(spId);
}

// ---------------------------------------------------------------- textures

const TEX = new Map();
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The skin: x along the fish (tail -> nose), y round the body (0 the back, 0.5 the belly, 1 the back again). */
function skinTexture(spId, cw) {
  const key = `${spId}:${cw.join()}`;
  if (TEX.has(key)) return TEX.get(key);
  const W = 1024, H = 512;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const [back, belly, pat] = cw;
  const top = new THREE.Color(back), bot = new THREE.Color(belly), col = new THREE.Color();
  const mid = new THREE.Color(back).lerp(new THREE.Color(belly), 0.5);
  for (let y = 0; y < H; y++) {
    const k = (1 - Math.cos((y / H) * Math.PI * 2)) / 2; // 0 back, 1 belly
    // the back's colour reaches past the lateral line: a fish on its side shows its flank to the sky
    if (spId === 'flatfish') col.copy(top).lerp(bot, THREE.MathUtils.smoothstep(k, 0.47, 0.53));
    else if (k < 0.66) col.copy(top).lerp(mid, THREE.MathUtils.smoothstep(k, 0.42, 0.66));
    else col.copy(mid).lerp(bot, THREE.MathUtils.smoothstep(k, 0.66, 0.84));
    g.fillStyle = `#${col.getHexString()}`;
    g.fillRect(0, y, W, 1);
  }
  const r = rng(spId.length * 977 + cw[0].charCodeAt(1) * 13 + cw[0].charCodeAt(3));
  const both = (fn) => {
    fn(0, 1);
    fn(H, -1);
  };
  g.save();
  if (spId === 'mackerel') {
    g.fillStyle = pat;
    for (let i = 0; i < 30; i++) {
      const x = 30 + i * 28;
      const fade = x > W * 0.8 ? Math.max(0, 1 - (x - W * 0.8) / 80) : 1;
      both((y0, dir) => {
        g.globalAlpha = 0.9 * fade;
        const len = 118 + r() * 40;
        const ph = r() * 6;
        g.beginPath();
        g.moveTo(x, y0);
        for (let s = 0; s <= 14; s++) g.lineTo(x + Math.sin(s * 0.75 + ph) * 8 + s * 1.4, y0 + dir * (s / 14) * len);
        for (let s = 14; s >= 0; s--) g.lineTo(x + 8 - s * 0.25 + Math.sin(s * 0.75 + ph) * 8 + s * 1.4, y0 + dir * (s / 14) * len);
        g.closePath();
        g.fill();
      });
    }
    // a silver flank and a pearly belly
    g.globalAlpha = 0.3;
    g.fillStyle = '#ffffff';
    both((y0, dir) => g.fillRect(0, y0 + dir * 150, W, dir * 30));
  } else if (spId === 'goldfish') {
    g.fillStyle = pat;
    for (let i = 0; i < 11; i++) {
      g.globalAlpha = 0.7;
      g.beginPath();
      g.ellipse(60 + r() * 820, 40 + r() * 430, 26 + r() * 70, 20 + r() * 44, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.35;
    const grd = g.createRadialGradient(W * 0.88, H * 0.5, 10, W * 0.88, H * 0.5, 220);
    grd.addColorStop(0, '#ffe2a8');
    grd.addColorStop(1, 'rgba(255,226,168,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  } else if (spId === 'flatfish') {
    // the top side is the +y half: rows near y 0 and y H. Bright spots and freckles.
    g.fillStyle = pat;
    for (let i = 0; i < 70; i++) {
      const y = r() < 0.5 ? r() * H * 0.22 : H - r() * H * 0.22;
      g.globalAlpha = 0.9;
      g.beginPath();
      g.arc(50 + r() * 900, y, 6 + r() * 10, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.25;
    g.fillStyle = '#2a1e14';
    for (let i = 0; i < 500; i++) g.fillRect(r() * W, r() < 0.5 ? r() * H * 0.25 : H - r() * H * 0.25, 3, 3);
  } else if (spId === 'puffer') {
    g.fillStyle = pat;
    for (let i = 0; i < 110; i++) {
      const y = r() < 0.5 ? r() * H * 0.3 : H - r() * H * 0.3;
      g.globalAlpha = 0.85;
      g.beginPath();
      g.arc(r() * W, y, 4 + r() * 9, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.55;
    both((y0) => {
      g.beginPath();
      g.ellipse(W * 0.55, y0, 100, 120, 0, 0, Math.PI * 2);
      g.fill();
    });
  } else if (spId === 'eel') {
    g.fillStyle = pat;
    g.globalAlpha = 0.35;
    for (let i = 0; i < 700; i++) g.fillRect(r() * W, r() < 0.5 ? r() * H * 0.3 : H - r() * H * 0.3, 2 + r() * 4, 2 + r() * 4);
  }
  g.restore();
  // the gill cover, a lateral line
  g.save();
  const gx = W * (spId === 'eel' ? 0.9 : spId === 'flatfish' ? 0.74 : 0.79);
  g.globalAlpha = 0.18;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(gx + 24, H * 0.5, 36, H * 0.44, 0, -Math.PI / 2, Math.PI / 2);
  g.fill();
  g.globalAlpha = 0.45;
  g.strokeStyle = 'rgba(30,10,10,0.7)';
  g.lineWidth = 3;
  for (const cy of [0.25, 0.75]) {
    g.beginPath();
    g.ellipse(gx, H * cy, 22, H * 0.17, 0, -Math.PI / 2, Math.PI / 2);
    g.stroke();
  }
  g.globalAlpha = 0.25;
  g.fillStyle = '#ffffff';
  g.fillRect(0, H * 0.235, gx - 20, 3);
  g.fillRect(0, H * 0.765, gx - 20, 3);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  TEX.set(key, tex);
  return tex;
}

/** Scales as a normal map (overlapping toward the tail); smooth species get a fine wrinkled skin. */
function scaleNormals(spId) {
  const key = `n:${spId}`;
  if (TEX.has(key)) return TEX.get(key);
  const sp = SPECIES[spId];
  const W = 512, H = 256;
  const hgt = new Float32Array(W * H);
  const s = sp.scale;
  const r = rng(91 + spId.length);
  if (s > 0) {
    const sx = s, sy = s * 0.8;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const row = Math.floor(y / sy);
        const off = row % 2 ? sx / 2 : 0;
        const col = Math.floor((x + off) / sx);
        const cx = col * sx - off + sx * 0.8, cy = row * sy + sy / 2;
        const dx = (x - cx) / sx, dy = (y - cy) / sy;
        const d = Math.hypot(dx * 1.1, dy);
        hgt[y * W + x] = Math.pow(Math.max(0, 1 - d), 0.7) * (0.55 + 0.45 * Math.min(1, Math.max(0, -dx + 0.6)));
      }
  } else {
    for (let i = 0; i < 1800; i++) {
      const x0 = r() * W, y0 = r() * H, rad = 2 + r() * 6;
      for (let y = Math.floor(y0 - rad); y <= y0 + rad; y++)
        for (let x = Math.floor(x0 - rad); x <= x0 + rad; x++) {
          const xx = (x + W) % W, yy = (y + H) % H;
          const d = Math.hypot(x - x0, y - y0) / rad;
          if (d < 1) hgt[yy * W + xx] += (1 - d * d) * 0.5;
        }
    }
  }
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const k = s > 0 ? 2.4 : 1.3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const hx = hgt[y * W + ((x + 1) % W)] - hgt[y * W + ((x - 1 + W) % W)];
      const hy = hgt[((y + 1) % H) * W + x] - hgt[((y - 1 + H) % H) * W + x];
      const nx = -hx * k, ny = -hy * k;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * W + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(sp.long ? 4 : 2, 2);
  tex.colorSpace = THREE.NoColorSpace;
  TEX.set(key, tex);
  return tex;
}

/** Fin membranes: rays from the base to a ragged, translucent edge. */
function finTexture() {
  if (TEX.has('fin')) return TEX.get('fin');
  const W = 256, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const ray = Math.pow(Math.abs(Math.sin(v * Math.PI * 16)), 8);
      const edge = 1 - THREE.MathUtils.smoothstep(u, 0.8 + 0.1 * Math.sin(v * 61) * Math.sin(v * 23), 1.0);
      const lum = 205 + ray * 50 - u * 45;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = lum;
      img.data[i + 3] = Math.round(255 * edge * Math.min(1, 0.78 + ray * 0.22 - u * 0.2));
    }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  TEX.set('fin', tex);
  return tex;
}

/** An eyeball's colour, mapped by the sphere's own uv: rows run from the pupil (top) out over the iris to the white. */
function eyeTexture(color) {
  const key = `eye:${color}`;
  if (TEX.has(key)) return TEX.get(key);
  const W = 128, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const base = new THREE.Color(color);
  const grd = g.createLinearGradient(0, 0, 0, H);
  const stop = (deg, col) => grd.addColorStop(deg / 180, col);
  stop(0, '#010102');
  stop(19, '#010102');
  stop(21, base.clone().multiplyScalar(0.45).getStyle());
  stop(30, base.getStyle());
  stop(44, base.clone().lerp(new THREE.Color('#ffffff'), 0.2).getStyle());
  stop(52, base.clone().multiplyScalar(0.5).getStyle());
  stop(56, '#18120c');
  stop(60, '#d9d0bd');
  stop(180, '#efe8da');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // streaks in the iris
  g.globalAlpha = 0.28;
  for (let i = 0; i < 48; i++) {
    g.fillStyle = i % 2 ? '#fff4c8' : '#000';
    g.fillRect((i / 48) * W, (22 / 180) * H, 1.2, (28 / 180) * H);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  TEX.set(key, tex);
  return tex;
}

// ---------------------------------------------------------------- one fish

const eyeBallGeo = new THREE.SphereGeometry(1, 32, 24).rotateX(Math.PI / 2); // the pole looks out along +z
const lidGeo = new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
const glintGeo = new THREE.CircleGeometry(0.17, 12);
const lipGeo = new THREE.TorusGeometry(1, 0.34, 8, 24);
const spikeGeo = new THREE.ConeGeometry(0.008, 0.034, 6).translate(0, 0.017, 0);
const stickerGeo = new THREE.CircleGeometry(1, 24);
const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const mouthMat = new THREE.MeshStandardMaterial({ color: 0x2e0b10, roughness: 0.7 });
const stickerBack = new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: 0.8 });
const DRY = new THREE.Color('#cfc2aa');
const WHITE = new THREE.Color(1, 1, 1);
const SHARED_MATS = new Set([glintMat, mouthMat, stickerBack]);

/** How high the middle of the fish sits off the floor, lying as it does (on its side, leaned toward the camera). */
const LEAN = { side: -0.42, flat: -0.22 };
function restLift(sp) {
  const m = new THREE.Matrix4().makeRotationX(sp.flat ? LEAN.flat : LEAN.side);
  if (!sp.flat) m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const v = new THREE.Vector3();
  let low = 0;
  const p = [0, 0, 0];
  for (let u = 0.2; u <= 0.85; u += 0.05)
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      surface(sp, u, a, p);
      v.set(p[0], p[1], p[2]).applyMatrix4(m);
      low = Math.min(low, v.y);
    }
  return -low;
}

export function createFishMesh(spId = 'mackerel', cwIndex = 0, opts = {}) {
  if (!SPECIES[spId]) spId = 'mackerel';
  const sp = SPECIES[spId];
  const geos = geometryFor(spId);
  const cws = COLOURWAYS[spId];
  const cw = cws[((cwIndex % cws.length) + cws.length) % cws.length];
  const ghost = !!opts.ghost;
  const lite = LITE || !!opts.lite;
  let mat, finMat, skinMat;
  if (ghost) {
    mat = new THREE.MeshStandardMaterial({ color: opts.ghostColor ?? 0xbff4ff, transparent: true, opacity: 0.32, roughness: 0.1, emissive: opts.ghostColor ?? 0x4cd3ec, emissiveIntensity: 0.7, depthWrite: false });
    finMat = skinMat = mat;
  } else {
    const common = { map: skinTexture(spId, cw), normalMap: scaleNormals(spId), normalScale: new THREE.Vector2(sp.bump, sp.bump), roughness: sp.rough, metalness: 0.04, envMapIntensity: 1.25 };
    mat = lite
      ? new THREE.MeshStandardMaterial(common)
      : new THREE.MeshPhysicalMaterial({
          ...common,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          iridescence: sp.iri,
          iridescenceIOR: 1.75,
          iridescenceThicknessRange: [200, 560],
          sheen: 0.35,
          sheenRoughness: 0.4,
          sheenColor: new THREE.Color(cw[3]),
        });
    finMat = new THREE.MeshStandardMaterial({ map: finTexture(), color: cw[3], roughness: 0.32, transparent: true, side: THREE.DoubleSide, alphaTest: 0.03, depthWrite: false, envMapIntensity: 1.1 });
    skinMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(cw[0]).multiplyScalar(0.8), roughness: 0.3, clearcoat: lite ? 0 : 0.8 });
  }

  // the skeleton: 0 the root, 1..nf toward the nose, then nf+1.. toward the tail
  const { step } = boneLayout(sp);
  const bones = [new THREE.Bone()];
  const root = bones[0];
  let parent = root;
  for (let i = 0; i < sp.nf; i++) {
    const b = new THREE.Bone();
    b.position.x = step;
    parent.add(b);
    bones.push(b);
    parent = b;
  }
  parent = root;
  for (let i = 0; i < sp.nb; i++) {
    const b = new THREE.Bone();
    b.position.x = -step;
    parent.add(b);
    bones.push(b);
    parent = b;
  }
  const group = new THREE.Group();
  group.add(root);
  group.updateMatrixWorld(true); // the bind pose is the bones as laid out (not all at the origin)
  const skeleton = new THREE.Skeleton(bones);
  const body = new THREE.SkinnedMesh(geos.body, mat);
  body.bind(skeleton);
  body.castShadow = !ghost;
  body.frustumCulled = false;
  group.add(body);
  const fins = new THREE.SkinnedMesh(geos.fins, finMat);
  fins.bind(skeleton);
  fins.frustumCulled = false;
  fins.renderOrder = 1;
  fins.castShadow = !ghost && !lite;
  group.add(fins);
  // lying down: a round fish on its side (the -z flank up), a flatfish on its blind side
  if (!sp.flat) group.rotation.x = Math.PI / 2;
  const upSide = sp.flat ? 0 : -1; // the flank that faces the sky (z sign); 0: the flatfish's top (+y)

  const head = bones[sp.nf];
  const hx = (u) => -sp.L / 2 + u * sp.L - sp.nf * step; // body x -> the head bone's x

  // pectoral fins
  const pecs = [];
  const pu = sp.eyeAt[0] - 0.1;
  for (const s of sp.flat ? [1] : [1, -1]) {
    const pivot = new THREE.Group();
    const p = surface(sp, pu, sp.flat ? Math.PI * 0.5 : Math.PI * 0.6 * s, [0, 0, 0]);
    pivot.position.set(hx(pu), p[1] * 0.85, p[2] * 0.97);
    const fin = new THREE.Mesh(geos.pec, finMat);
    fin.castShadow = false;
    pivot.add(fin);
    head.add(pivot);
    pecs.push({ pivot, side: s });
  }

  // eyes: on both flanks (a flatfish has both on top)
  const eyes = [];
  const er = sp.eye;
  const eyeMat = ghost ? mat : lite ? new THREE.MeshStandardMaterial({ map: eyeTexture(cw[4]), roughness: 0.25 }) : new THREE.MeshPhysicalMaterial({ map: eyeTexture(cw[4]), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.9 });
  const spots = sp.flat
    ? [[sp.eyeAt[0], 0.08, 1, new THREE.Vector3(0.15, 1, 0.3)], [sp.eyeAt[0] - 0.08, -0.12, 1, new THREE.Vector3(0.05, 1, -0.3)]]
    : [[sp.eyeAt[0], sp.eyeAt[1], 1, null], [sp.eyeAt[0], sp.eyeAt[1], -1, null]];
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), M = new THREE.Matrix4();
  for (const [u, v, s, nrm] of spots) {
    const eg = new THREE.Group();
    const p = [0, 0, 0];
    if (sp.flat) {
      const [top, , wid] = profAt(sp, u);
      eg.position.set(hx(u), (sp.H / 2) * top * 0.8, v * (sp.W / 2) * wid);
      Z.copy(nrm).normalize();
    } else {
      // on the flank a little toward the back, sunk so it bulges by under half its size; turned a little toward the
      // belly, which is the side a camera behind a lying fish sees
      surface(sp, u, s * (Math.PI / 2 - 0.28), p);
      const n = new THREE.Vector3(0, p[1] / (sp.H / 2) ** 2, p[2] / (sp.W / 2) ** 2).normalize();
      eg.position.set(hx(u), p[1], p[2]).addScaledVector(n, -er * 0.5);
      Z.set(0.12, -0.5, s).normalize();
    }
    X.set(s, 0, 0);
    Y.crossVectors(Z, X).normalize();
    X.crossVectors(Y, Z).normalize();
    M.makeBasis(X, Y, Z);
    eg.quaternion.setFromRotationMatrix(M);
    // the ball (rolls to look) carries the iris; the lid and the glint stay put
    const ball = new THREE.Group();
    const eyeball = new THREE.Mesh(eyeBallGeo, eyeMat);
    eyeball.scale.setScalar(er);
    ball.add(eyeball);
    eg.add(ball);
    if (!ghost) {
      const glint = new THREE.Mesh(glintGeo, glintMat);
      glint.scale.setScalar(er);
      glint.position.set(er * 0.3 * s, er * 0.34, er * 1.02);
      eg.add(glint);
    }
    const lid = new THREE.Mesh(lidGeo, skinMat);
    lid.scale.setScalar(er);
    lid.rotation.x = -Math.PI / 2;
    eg.add(lid);
    head.add(eg);
    eyes.push({ group: eg, ball, lid, side: s, up: sp.flat || s === upSide });
  }

  // the mouth: dark inside, soft lips; it drops open
  const mouth = new THREE.Group();
  const [mt, mb] = profAt(sp, 0.97);
  mouth.position.set(hx(sp.mouthAt) - 0.006, sp.flat ? 0 : ((mt - mb) * sp.H) / 4 - sp.H * 0.05, 0);
  const inner = new THREE.Mesh(eyeBallGeo, ghost ? mat : mouthMat);
  const mh = sp.flat ? 0.006 : Math.min(0.016, sp.H * 0.08), mw = sp.flat ? 0.018 : Math.min(0.016, sp.W * 0.16);
  inner.scale.set(0.007, mh, mw);
  mouth.add(inner);
  const lip = new THREE.Mesh(lipGeo, skinMat);
  lip.rotation.y = Math.PI / 2;
  lip.scale.set(mw * 1.05, mh * 1.05, 0.012);
  mouth.add(lip);
  if (sp.flat) mouth.rotation.x = Math.PI / 2;
  head.add(mouth);

  // a puffer's spines
  const spikes = [];
  if (sp.spikes) {
    const r = rng(5);
    const sm = ghost ? mat : new THREE.MeshStandardMaterial({ color: new THREE.Color(cw[3]).lerp(WHITE, 0.35), roughness: 0.45 });
    const up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3();
    for (let i = 0; i < 56; i++) {
      const u = 0.22 + r() * 0.62, a = r() * Math.PI * 2;
      const p = surface(sp, u, a, [0, 0, 0]);
      const m = new THREE.Mesh(spikeGeo, sm);
      n.set(-0.4, p[1] / (sp.H / 2), p[2] / (sp.W / 2)).normalize();
      m.position.set(p[0], p[1], p[2]);
      m.quaternion.setFromUnitVectors(up, n);
      m.castShadow = false;
      root.add(m);
      spikes.push(m);
    }
  }

  // the hat socket: on the up flank above the eye, its up toward the sky
  const hatSocket = new THREE.Group();
  if (sp.flat) {
    hatSocket.position.set(hx(0.7), (sp.H / 2) * 0.9, 0);
  } else {
    const hu = sp.eyeAt[0] - 0.07;
    const p = surface(sp, hu, -Math.PI * 0.5 + 0.55, [0, 0, 0]);
    hatSocket.position.set(hx(hu), p[1], p[2]);
    hatSocket.rotation.set(-Math.PI / 2, 0, 0);
    hatSocket.rotateX(0.3);
    hatSocket.rotateZ(-0.15);
  }
  head.add(hatSocket);

  // a seat sticker on the up flank, like a price label
  let sticker = null;
  if (!ghost && opts.pin) {
    sticker = new THREE.Group();
    const face = new THREE.Mesh(stickerGeo, new THREE.MeshStandardMaterial({ color: opts.pin, roughness: 0.55 }));
    const rim = new THREE.Mesh(stickerGeo, stickerBack);
    const sz = Math.min(sp.H, sp.W * (sp.flat ? 0.4 : 3)) * 0.085;
    face.scale.set(sz * 1.3, sz, 1);
    rim.scale.set(sz * 1.3 + 0.004, sz + 0.004, 1);
    face.position.z = 0.0006;
    sticker.add(rim, face);
    const p = surface(sp, sp.flat ? 0.3 : 0.3, sp.flat ? 0.5 : -Math.PI / 2 + 0.25, [0, 0, 0]);
    const nrm = new THREE.Vector3(0, p[1] / (sp.H / 2) ** 2, p[2] / (sp.W / 2) ** 2).normalize();
    sticker.position.set(p[0], p[1], p[2]).addScaledVector(nrm, 0.0015);
    sticker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    sticker.rotateZ(0.25);
    root.add(sticker);
  }

  return { group, body, fins, bones, skeleton, sp, spId, mat, finMat, skinMat, eyes, mouth, pecs, spikes, hatSocket, sticker, cw, ghost, step, rest: geos.rest, upSide };
}

// ---------------------------------------------------------------- the controller

/**
 * A fish's look in motion. update(dt, s): s = { x, y, z, vx, vy, vz, aim, curl, ground, wet (0..1), state }.
 * events(list): the body's events since the last frame (flop, land, knock, refill, dry, respawn, finish, splashdown).
 * opts: { ghost, ghostColor, pin, hat, broadside (default true), yaw, lite }
 */
export function createFishView(spId, cwIndex, opts = {}) {
  const f = createFishMesh(spId, cwIndex, opts);
  const sp = f.sp;
  const group = new THREE.Group(); // where and which way
  const tilt = new THREE.Group(); // lean, roll and pitch about the fish's middle
  group.add(tilt);
  const body = new THREE.Group(); // squash and stretch
  tilt.add(body);
  body.add(f.group);
  const lean0 = sp.flat ? LEAN.flat : LEAN.side;

  let hat = null;
  const setHat = (id) => {
    if (hat) f.hatSocket.remove(hat);
    hat = null;
    if (id && id !== 'none' && !f.ghost) {
      hat = makeHat(id, Math.max(0.075, Math.min(0.13, (sp.flat ? 0.14 : sp.H) * 0.62)));
      if (hat) f.hatSocket.add(hat);
    }
  };
  setHat(opts.hat);

  const B = f.bones;
  const nf = sp.nf, nb = sp.nb, nj = nf + nb;
  const axis = sp.flat ? 'z' : 'y';
  const bend = new Float32Array(nj + 1); // per bone (1..nj)
  const bendV = new Float32Array(nj + 1);
  const st = {
    heading: opts.yaw ?? 0,
    roll: 0,
    rollV: 0,
    spin: 0,
    pitch: 0,
    lean: 0,
    leanV: 0,
    sq: 0,
    sqV: 0,
    stretch: 0,
    eyeOpen: 1,
    wide: 0,
    blink: 1 + Math.random() * 3,
    look: [0, 0],
    lookT: [0, 0],
    saccade: 0.5,
    twitch: 1 + Math.random() * 2,
    flap: 0,
    t: Math.random() * 10,
    puff: 0,
    wet: 1,
    flight: false,
    planned: false,
    charge: 0,
    dizzy: 0,
    jaw: 0,
    joy: 0,
    shine: 0,
    hatSq: 0,
    hatV: 0,
  };
  const broad = opts.broadside !== false;
  const lift = f.rest;

  const view = {
    group,
    fish: f,
    setHat,
    events(list) {
      for (const e of list) {
        switch (e.type) {
          case 'flop': {
            // the whip: the curl snaps through straight and past, the body stretches, the eyes pop, the jaw drops
            const c = e.charge ?? 0.6;
            for (let j = 1; j <= nj; j++) bendV[j] -= 12 + c * 18;
            st.stretch = 0.12 + c * 0.16;
            st.sqV += 4 + c * 4;
            st.wide = 0.7;
            st.jaw = 0.9;
            st.flight = true;
            st.planned = false;
            st.charge = c;
            st.hatV += 6 + c * 6;
            if (e.slap) st.shine = 1;
            break;
          }
          case 'land': {
            const k = Math.min(1, (e.speed ?? 4) / 9);
            for (let j = 1; j <= nj; j++) bendV[j] += (j % 2 ? 1 : -1) * 8 * k + 9 * k;
            st.sq = -0.38 * k;
            st.sqV = 0;
            st.leanV += (Math.random() - 0.5) * 9 * k;
            st.flight = false;
            st.spin = 0;
            st.jaw = Math.max(st.jaw, 0.5 * k);
            st.hatV -= 10 * k;
            if (sp.spikes && k > 0.3) st.puff = 1;
            break;
          }
          case 'knock':
            st.spin = (Math.random() < 0.5 ? -1 : 1) * 16;
            st.flight = true;
            st.planned = true;
            for (let j = 1; j <= nj; j++) bendV[j] += 18;
            st.wide = 1;
            st.dizzy = 1.6;
            st.jaw = 1;
            st.hatV += 14;
            if (sp.spikes) st.puff = 1;
            break;
          case 'refill':
            st.wide = Math.max(st.wide, 0.35);
            st.shine = Math.max(st.shine, 0.8);
            st.joy = Math.max(st.joy, 0.4);
            break;
          case 'respawn':
            st.sq = 0.3;
            st.flight = false;
            st.spin = 0;
            st.dizzy = 0;
            st.shine = 1;
            break;
          case 'finish':
          case 'win':
          case 'splashdown':
            st.joy = 2;
            st.wide = 1;
            break;
          case 'dry':
            st.dizzy = 1.2;
            break;
          case 'bonk':
            st.wide = 0.8;
            st.hatV += 8;
            break;
        }
      }
    },
    /** A little celebration (podium, locker). */
    cheer() {
      st.joy = 1.8;
      st.sqV += 6;
      for (let j = 1; j <= nj; j++) bendV[j] += 12;
      st.hatV += 8;
    },
    update(dt, s) {
      dt = Math.min(dt, 0.1);
      st.t += dt;
      const subs = Math.max(1, Math.ceil(dt * 120));
      const h = dt / subs;
      const ground = !!s.ground;
      if (ground && st.flight && s.state !== 'grab') st.flight = false;
      const flying = !ground && st.flight;
      const curl = THREE.MathUtils.clamp(s.curl ?? 0, 0, 1);
      const dry = s.state === 'dry';
      const hs = Math.hypot(s.vx, s.vz);
      group.position.set(s.x, s.y - 0.16 + lift, s.z);

      // which way: broadside to the aim (nose to the left of a camera behind), held through a flight
      let want = st.heading;
      if (broad) {
        if (ground || !st.flight) want = s.aim + Math.PI / 2;
      } else if (curl > 0.02 && ground) want = s.aim + Math.PI / 2;
      else if (!ground && hs > 0.8) want = Math.atan2(s.vx, s.vz) + Math.PI / 2;
      let d = want - st.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      st.heading += d * Math.min(1, dt * (ground ? 12 : 5));
      group.rotation.y = st.heading - Math.PI / 2;

      // a flight: one forward roll for a big leap, timed to land flat; small hops stay flat
      if (flying && !st.planned && s.vy > 0.5) {
        st.planned = true;
        const T = (2 * s.vy) / 16 + 0.05;
        const rolls = st.charge > 0.62 ? 1 : 0;
        st.spin = (rolls * Math.PI * 2) / T;
      }
      if (flying) st.roll += st.spin * dt;
      else {
        const target = Math.round(st.roll / (Math.PI * 2)) * Math.PI * 2;
        for (let k = 0; k < subs; k++) {
          st.rollV += ((target - st.roll) * 170 - st.rollV * 17) * h;
          st.roll += st.rollV * h;
        }
        if (Math.abs(st.roll) > 200) st.roll = st.roll % (Math.PI * 2);
      }
      // a wobble about the long axis after a landing, rocking on the belly
      for (let k = 0; k < subs; k++) {
        st.leanV += (-st.lean * 110 - st.leanV * 6) * h;
        st.lean += st.leanV * h;
      }
      const wantPitch = flying && !broad ? Math.atan2(s.vy, Math.max(0.5, hs)) * 0.5 : 0;
      st.pitch += (wantPitch - st.pitch) * Math.min(1, dt * 8);
      tilt.rotation.set(st.roll + lean0 + st.lean * 0.5 + (dry ? -0.25 : 0), 0, st.pitch, 'XYZ');

      // the spine
      st.twitch -= dt;
      if (ground && curl < 0.02 && st.twitch <= 0 && s.state !== 'done' && s.state !== 'grab') {
        // a flap of the tail on the floor now and then (weak and often when drying out)
        st.twitch = dry ? 0.35 + Math.random() * 0.3 : 1.2 + Math.random() * 2.6;
        st.flap = dry ? 0.5 : 0.8 + Math.random() * 0.4;
        if (!dry && Math.random() < 0.35) {
          for (let j = 1; j <= nj; j++) bendV[j] += 6;
          st.sqV += 2.5;
          st.leanV += (Math.random() - 0.5) * 4;
        }
      }
      st.flap = Math.max(0, st.flap - dt * 3);
      const flapW = Math.sin((1 - st.flap) * Math.PI * 3) * st.flap;
      const quiver = curl > 0.25 ? Math.sin(st.t * 64) * (curl - 0.25) * 0.07 : 0;
      for (let j = 1; j <= nj; j++) {
        const back = j > nf;
        const along = back ? (j - nf) / nb : j / nf; // 0 near the middle .. 1 at the ends
        let target = curl * (back ? 0.62 : 0.5) + quiver * (0.5 + along);
        if (flying) target = 0.08 + Math.sin(st.t * 17 - along * 2.2) * (back ? 0.3 : 0.08) * (0.4 + along);
        else if (dry) target = 0.05 + Math.sin(st.t * 2.4 + j) * 0.05;
        else if (st.joy > 0) target = Math.sin(st.t * 14 - along * 2) * 0.28 * Math.min(1, st.joy) * (back ? 1 : 0.4);
        if (back && st.flap > 0) target += flapW * 0.45 * along;
        for (let k = 0; k < subs; k++) {
          bendV[j] += ((target - bend[j]) * 260 - bendV[j] * 14) * h;
          bend[j] += bendV[j] * h;
        }
        const r = (back ? -1 : 1) * bend[j] * (along < 0.5 ? 0.75 : 1.05);
        B[j].rotation[axis] = r;
      }

      // squash and stretch (about the middle; held down onto the floor)
      for (let k = 0; k < subs; k++) {
        st.sqV += (-st.sq * 280 - st.sqV * 15) * h;
        st.sq += st.sqV * h;
      }
      st.stretch = Math.max(0, st.stretch - dt * 1.4);
      const sq = THREE.MathUtils.clamp(st.sq - curl * 0.12, -0.45, 0.45);
      st.puff = Math.max(0, st.puff - dt * 0.9);
      const puff = sp.spikes ? 1 + Math.min(1, st.puff * 1.5) * 0.3 : 1;
      const sy = (1 + sq) * puff;
      body.scale.set((1 - sq * 0.4 + st.stretch) * puff, sy, (1 - sq * 0.4 - st.stretch * 0.35) * puff);
      body.position.y = ground ? (sy - 1) * lift : 0;
      for (const sk of f.spikes) sk.scale.setScalar(0.35 + Math.min(1, st.puff * 1.5) * 0.9);

      // fins row: lazily at rest, fast in the air and when happy
      const row = flying ? 18 : st.joy > 0 ? 14 : curl > 0.1 ? 22 : 4;
      const amp = flying ? 0.6 : st.joy > 0 ? 0.55 : curl > 0.1 ? 0.12 + curl * 0.15 : 0.22;
      for (const p of f.pecs) p.pivot.rotation.set(0, p.side * (0.35 + Math.sin(st.t * row + (p.side > 0 ? 0 : 1.3)) * amp), Math.sin(st.t * row * 0.5) * 0.25);

      // eyes: saccades, a squint at full charge, wide on a flop, blinks; dizzy after a knock
      st.wide = Math.max(0, st.wide - dt * 1.4);
      st.blink -= dt;
      let open = 1 - Math.max(0, curl - 0.55) * 1.2 + st.wide * 0.3;
      if (st.blink < 0) {
        open = 0;
        if (st.blink < -0.1) st.blink = 1.6 + Math.random() * 3.5;
      }
      if (dry || s.wet < 0.15) open = Math.min(open, 0.5);
      st.eyeOpen += (open - st.eyeOpen) * Math.min(1, dt * 24);
      st.saccade -= dt;
      if (st.saccade < 0) {
        st.saccade = 0.4 + Math.random() * 1.6;
        st.lookT[0] = (Math.random() - 0.5) * 0.7;
        st.lookT[1] = (Math.random() - 0.3) * 0.5;
      }
      if (curl > 0.05 || flying) {
        // looking where it's going: toward the back (forward from the camera)
        st.lookT[0] = 0.15;
        st.lookT[1] = 0.55;
      }
      st.look[0] += (st.lookT[0] - st.look[0]) * Math.min(1, dt * 30);
      st.look[1] += (st.lookT[1] - st.look[1]) * Math.min(1, dt * 30);
      st.dizzy = Math.max(0, st.dizzy - dt * 0.7);
      const closed = THREE.MathUtils.clamp(1 - st.eyeOpen, 0, 1);
      const under = Math.cos(st.roll + lean0) > 0.2; // lying on its side as usual: the floor-side eye is out of sight
      for (const e of f.eyes) {
        e.group.visible = e.up || !under;
        e.lid.rotation.x = -Math.PI / 2 + closed * Math.PI * 0.98;
        e.lid.visible = closed > 0.04;
        e.ball.scale.setScalar(1 + st.wide * 0.16);
        if (st.dizzy > 0) e.ball.rotation.set(Math.sin(st.t * 13) * 0.45, Math.cos(st.t * 13) * 0.45, 0);
        else e.ball.rotation.set(-st.look[1], st.look[0] * e.side, 0);
      }

      // the mouth: drops on a flop, gasps when dry, breathes at rest
      st.jaw = Math.max(0, st.jaw - dt * 2.4);
      const gasp = s.wet < 0.35 || dry ? 0.5 + 0.5 * Math.sin(st.t * (s.wet < 0.15 ? 13 : 6.5)) : 0.18 + 0.12 * Math.sin(st.t * 2.2);
      const jaw = Math.max(st.jaw, gasp, st.joy > 0 ? 0.7 : 0) * (curl > 0.6 ? 0.3 : 1);
      f.mouth.scale.set(1, 0.3 + jaw * 1.2, 1 + jaw * 0.15);

      // the hat rides a spring of its own
      for (let k = 0; k < subs; k++) {
        st.hatV += (-st.hatSq * 300 - st.hatV * 10) * h;
        st.hatSq += st.hatV * h;
      }
      if (hat) {
        const q = THREE.MathUtils.clamp(st.hatSq * 0.05, -0.3, 0.3);
        hat.scale.set(1 - q * 0.5, 1 + q, 1 - q * 0.5);
        hat.rotation.z = Math.sin(st.t * 3) * 0.02 + st.lean * 0.3;
        hat.userData.update?.(dt, { flight: flying, joy: st.joy });
      }

      // wet to dry: chalky, rough, no coat; a refill sends a shine over it
      st.wet += (THREE.MathUtils.clamp(s.wet ?? 1, 0, 1) - st.wet) * Math.min(1, dt * 4);
      st.shine = Math.max(0, st.shine - dt * 1.5);
      st.joy = Math.max(0, st.joy - dt);
      if (!f.ghost) {
        const w = st.wet;
        const m = f.mat;
        m.roughness = sp.rough + (1 - w) * 0.6;
        m.color.copy(DRY).lerp(WHITE, Math.min(1, w * 1.4));
        m.emissive.setRGB(st.shine * 0.18, st.shine * 0.24, st.shine * 0.28);
        if (m.isMeshPhysicalMaterial) {
          m.clearcoat = 0.05 + w * 0.95;
          m.clearcoatRoughness = 0.04 + (1 - w) * 0.4;
          m.iridescence = sp.iri * w;
        }
        f.finMat.opacity = 0.6 + w * 0.4;
      }
    },
    setVisible(v) {
      group.visible = v;
    },
    dispose() {
      setHat(null);
      const keep = new Set([eyeBallGeo, lidGeo, glintGeo, lipGeo, spikeGeo, stickerGeo]);
      for (const g of GEO.values()) keep.add(g.body).add(g.fins).add(g.pec);
      group.traverse((o) => {
        if (!o.isMesh) return;
        if (!keep.has(o.geometry)) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!SHARED_MATS.has(m)) m.dispose();
      });
    },
  };
  return view;
}

export { SPECIES };
