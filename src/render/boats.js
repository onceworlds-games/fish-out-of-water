// Boats on the sea: little trawlers with a wheelhouse and a gantry, and sailing dinghies leaning in the breeze; one tied
// up alongside the Quay. Every boat is one mesh (its parts merged, coloured per vertex) and rides the swell. Gulls stand
// on the bollards and the wheelhouse roof, turning their heads.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ANTIFOUL = 0x8c2f22;
const RUB = 0x26221e;
const WHITE = 0xf2efe8;
const GLASS = 0x1d2a36;
const DECK = 0x9c8a6e;
const STEEL = 0x50565c;
const HULLS = [0x1f5fa8, 0x2f8a5c, 0xd8402c, 0xf2b51e, 0x2a3f6b];

let boatMat = null;
const mat = () => (boatMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }));

function paint(g, hex) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) (a[i * 3] = c.r), (a[i * 3 + 1] = c.g), (a[i * 3 + 2] = c.b);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** A plain part: geometry placed at p, turned by r, scaled by s, painted. Non-indexed, position/normal/color only. */
function part(geo, hex, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) {
  let g = geo.clone();
  g.deleteAttribute('uv');
  if (g.index) g = g.toNonIndexed();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
  return paint(g, hex);
}

/**
 * A hull lofted along x (stern at -L/2, bow at +L/2): the gunwale rises toward the bow, the keel sweeps up into the stem.
 * Rows of each section sit on the paint lines, so the bands are crisp: antifouling under the water, the colour, a dark
 * rubbing strake, a white top strake.
 */
function hullGeo(L, B, top0, rise, keel, colour) {
  const NS = 18;
  const pos = [], col = [], idx = [];
  const bands = [
    [ANTIFOUL, (t, bot) => [bot, bot * 0.62, bot * 0.25, 0.02]],
    [colour, (t) => [0.02, (0.02 + t - 0.24) / 2, t - 0.24]],
    [RUB, (t) => [t - 0.24, t - 0.17]],
    [WHITE, (t) => [t - 0.17, t]],
  ];
  const station = (u) => {
    const x = (u - 0.5) * L;
    const bw = (B / 2) * (u < 0.62 ? 0.84 + 0.16 * Math.sin((u / 0.62) * Math.PI * 0.5) : Math.cos(((u - 0.62) / 0.38) * Math.PI * 0.5) ** 0.75);
    const t = top0 + rise * u ** 2.4;
    const bot = keel * (u > 0.72 ? 1 - ((u - 0.72) / 0.28) ** 1.6 * 0.85 : u < 0.12 ? 0.75 + (u / 0.12) * 0.25 : 1);
    return { x, bw, t, bot };
  };
  // the section's half-breadth at height y: full by the bilge, a little flare to the gunwale
  const half = (s, y) => {
    const h = Math.max(0, Math.min(1, (y - s.bot) / (s.t - s.bot)));
    return s.bw * (h ** 0.42) * (0.94 + 0.06 * h);
  };
  for (const [hex, rowsOf] of bands) {
    const c = new THREE.Color(hex);
    for (const side of [-1, 1]) {
      const base = pos.length / 3;
      let rows = 0;
      for (let i = 0; i <= NS; i++) {
        const s = station(i / NS);
        const ys = rowsOf(s.t, s.bot);
        rows = ys.length;
        for (const y of ys) {
          pos.push(s.x, y, side * half(s, y));
          col.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < NS; i++)
        for (let k = 0; k < rows - 1; k++) {
          const a = base + i * rows + k, b = a + rows, c2 = a + 1, d = b + 1;
          if (side > 0) idx.push(a, b, c2, c2, b, d);
          else idx.push(a, c2, b, c2, d, b);
        }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const parts = [g.toNonIndexed()];
  // the transom: a flat stern, painted like the sides
  const s0 = station(0);
  const tr = new THREE.Shape();
  const ys = [s0.bot, s0.bot * 0.5, 0.02, s0.t - 0.24, s0.t - 0.17, s0.t];
  tr.moveTo(0, s0.bot);
  for (const y of ys) tr.lineTo(half(s0, y), y);
  for (const y of ys.slice().reverse()) tr.lineTo(-half(s0, y), y);
  const tg = new THREE.ShapeGeometry(tr).rotateY(Math.PI / 2);
  tg.translate(s0.x, 0, 0);
  parts.push(part(tg, colour));
  // the deck, just under the gunwale
  const dk = [];
  for (let i = 0; i < NS; i++) {
    const a = station(i / NS), b = station((i + 1) / NS);
    const ya = a.t - 0.2, yb = b.t - 0.2;
    const wa = half(a, ya) * 0.96, wb = half(b, yb) * 0.96;
    dk.push(a.x, ya, -wa, b.x, yb, -wb, a.x, ya, wa, a.x, ya, wa, b.x, yb, -wb, b.x, yb, wb);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dk, 3));
  dg.computeVertexNormals();
  parts.push(paint(dg, DECK));
  return { parts, station };
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const BALL = new THREE.SphereGeometry(1, 10, 8);

/** A little trawler, ~7 m: a wheelhouse aft of the middle, a mast, a gantry over the stern, buoys and fenders. */
function trawler(colour, detail) {
  const L = 7, B = 2.5;
  const { parts, station } = hullGeo(L, B, 0.72, 0.5, -0.75, colour);
  const deckY = (u) => station(u).t - 0.2;
  const y0 = deckY(0.42);
  // the wheelhouse: white, a band of dark windows all round, a roof in the hull's colour, a door aft
  parts.push(part(BOX, WHITE, [-0.35, y0 + 0.7, 0], [1.7, 1.4, 1.5]));
  parts.push(part(BOX, GLASS, [-0.35, y0 + 1.08, 0], [1.72, 0.36, 1.52]));
  for (const z of [-0.4, 0.4]) parts.push(part(BOX, WHITE, [0.51, y0 + 1.08, z], [0.03, 0.38, 0.08]));
  parts.push(part(BOX, colour, [-0.3, y0 + 1.45, 0], [1.95, 0.09, 1.75]));
  parts.push(part(BOX, GLASS, [-1.21, y0 + 0.55, 0.25], [0.02, 0.95, 0.5]));
  // the mast, its crosstree, a lamp on top; a radar bar on the roof
  parts.push(part(CYL, STEEL, [0.95, y0 + 2.1, 0], [0.06, 4.2, 0.06]));
  parts.push(part(BOX, STEEL, [0.95, y0 + 3.4, 0], [0.06, 0.06, 1.1]));
  parts.push(part(BALL, WHITE, [0.95, y0 + 4.25, 0], [0.09, 0.09, 0.09]));
  parts.push(part(BOX, WHITE, [-0.3, y0 + 1.62, 0], [0.12, 0.08, 0.9]));
  parts.push(part(CYL, STEEL, [-0.3, y0 + 1.55, 0], [0.04, 0.12, 0.04]));
  // the boom from the mast down to the deck, and the gantry over the stern (orange)
  parts.push(part(CYL, STEEL, [1.75, y0 + 1.5, 0], [0.04, 1.9, 0.04], [0, 0, 0.95]));
  const yS = deckY(0.03);
  for (const z of [-0.95, 0.95]) parts.push(part(BOX, 0xe86a1c, [-3.1, yS + 1.0, z], [0.1, 2.0, 0.1]));
  parts.push(part(BOX, 0xe86a1c, [-3.1, yS + 2.0, 0], [0.1, 0.1, 2.0]));
  // a net heap and fish boxes on the deck aft, buoys at the bow
  parts.push(part(BALL, 0x3e6a4a, [-2.2, yS + 0.12, 0.2], [0.55, 0.22, 0.6]));
  parts.push(part(BOX, 0x2c7fb8, [-1.8, yS + 0.13, -0.7], [0.5, 0.26, 0.4]));
  parts.push(part(BOX, 0xe8e2d4, [-2.35, yS + 0.13, -0.7], [0.5, 0.26, 0.4]));
  for (const [x, z] of [[2.1, 0.45], [2.35, -0.3]]) parts.push(part(BALL, 0xf06a1c, [x, deckY(0.8) + 0.2, z], [0.2, 0.2, 0.2]));
  // fenders down the sides
  if (detail)
    for (const x of [-2.2, -0.6, 1.0])
      for (const sd of [-1, 1]) {
        const s = station(x / L + 0.5);
        parts.push(part(CYL, 0x1d4f8a, [x, s.t - 0.55, sd * (s.bw + 0.12)], [0.11, 0.42, 0.11]));
      }
  return parts;
}

/** A sailing dinghy, ~3.6 m: a white hull, a mast, the mainsail on its boom and a jib, all leaning off the wind. */
function dinghy(colour, sailHex) {
  const { parts, station } = hullGeo(3.6, 1.45, 0.42, 0.18, -0.32, colour);
  const y0 = station(0.5).t - 0.2;
  parts.push(part(CYL, 0xc8c2b4, [0.35, y0 + 2.4, 0], [0.04, 4.8, 0.04]));
  parts.push(part(CYL, 0xc8c2b4, [-0.55, y0 + 0.55, 0], [0.035, 1.8, 0.035], [0, 0, Math.PI / 2]));
  const sail = (pts, hex) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.computeVertexNormals();
    return paint(g, hex);
  };
  // the main: a curved triangle, a little belly to leeward
  const main = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const a = i / N, b = (i + 1) / N;
    const p = (u) => [0.33 - u * 1.75 * (1 - u * 0.15), y0 + 0.6 + u * 0.0, Math.sin(u * Math.PI) * 0.18];
    const top = [0.33, y0 + 4.7, 0];
    main.push(...p(a), ...p(b), ...top);
  }
  parts.push(sail(main, sailHex));
  parts.push(sail([0.4, y0 + 0.4, 0, 1.6, y0 + 0.25, 0.05, 0.38, y0 + 3.9, 0.05], WHITE));
  return parts;
}

function boatMesh(kind, i, detail = false) {
  const colour = HULLS[i % HULLS.length];
  const parts = kind === 'dinghy' ? dinghy(i % 2 ? WHITE : 0x1f5fa8, [0xf4efe6, 0xe4432d, 0xf2b51e][i % 3]) : trawler(colour, detail);
  const m = new THREE.Mesh(mergeGeometries(parts), mat());
  m.castShadow = detail;
  return m;
}

/** A gull standing: white body and head, grey back and wings, black tips, a yellow bill, pink legs. Its head turns. */
function perchedGull() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.7 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.6 });
  const bill = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 });
  const leg = new THREE.MeshStandardMaterial({ color: 0xe0a090, roughness: 0.6 });
  const body = new THREE.Mesh(BALL, white);
  body.scale.set(0.2, 0.13, 0.12);
  body.position.y = 0.2;
  body.rotation.z = 0.25;
  const back = new THREE.Mesh(BALL, grey);
  back.scale.set(0.2, 0.08, 0.125);
  back.position.set(-0.03, 0.25, 0);
  back.rotation.z = 0.2;
  const tail = new THREE.Mesh(BALL, black);
  tail.scale.set(0.09, 0.03, 0.06);
  tail.position.set(-0.2, 0.2, 0);
  const head = new THREE.Group();
  head.position.set(0.15, 0.36, 0);
  const skull = new THREE.Mesh(BALL, white);
  skull.scale.setScalar(0.075);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.1, 6).rotateZ(-Math.PI / 2), bill);
  beak.position.set(0.1, -0.01, 0);
  const eye = new THREE.Mesh(BALL, black);
  eye.scale.setScalar(0.012);
  for (const z of [-0.055, 0.055]) {
    const e = eye.clone();
    e.position.set(0.04, 0.02, z);
    head.add(e);
  }
  head.add(skull, beak);
  for (const z of [-0.04, 0.04]) {
    const l = new THREE.Mesh(CYL, leg);
    l.scale.set(0.012, 0.12, 0.012);
    l.position.set(0.02, 0.06, z);
    g.add(l);
  }
  g.add(body, back, tail, head);
  for (const o of [body, back, head]) o.castShadow = true;
  return { g, head };
}

/**
 * The boats out on the bay (and any tied up: sea.moored [{ x, z, yaw, kind, i }]) and the gulls standing about
 * (sea.perched [[x, y, z, yaw]]). Returns { group, update(t) }.
 */
export function makeBoats(course) {
  const group = new THREE.Group();
  const sea = course.sea;
  const boats = [];
  const out = [
    [sea.x0 * 0.3 - 12, sea.z0 + 22, 'trawler'],
    [sea.x1 * 0.3 + 14, sea.z0 + 30, 'dinghy'],
    [-26, sea.z0 + 55, 'trawler'],
    [32, sea.z0 + 70, 'dinghy'],
    [-6, sea.z0 + 95, 'dinghy'],
    [18, sea.z0 + 48, 'trawler'],
  ];
  out.forEach(([x, z, kind], i) => {
    const m = boatMesh(kind, i);
    m.position.set(x, sea.y, z);
    m.rotation.y = i * 1.3 + 0.4;
    group.add(m);
    boats.push({ m, x, z, y: sea.y, yaw: m.rotation.y, ph: i * 1.7, k: kind === 'dinghy' ? 1.6 : 1, heel: kind === 'dinghy' ? 0.16 : 0, drift: kind === 'dinghy' ? 0.35 : 0.08 });
  });
  for (const [i, b] of (sea.moored ?? []).entries()) {
    const m = boatMesh(b.kind ?? 'trawler', b.i ?? i, true);
    m.position.set(b.x, sea.y + (b.lift ?? 0), b.z);
    m.rotation.y = b.yaw ?? 0;
    group.add(m);
    boats.push({ m, x: b.x, z: b.z, y: sea.y + (b.lift ?? 0), yaw: m.rotation.y, ph: i * 2.3 + 0.5, k: 0.55, heel: 0, drift: 0 });
  }
  const gulls = [];
  for (const [i, [x, y, z, yaw]] of (sea.perched ?? []).entries()) {
    const { g, head } = perchedGull();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    group.add(g);
    gulls.push({ head, ph: i * 2.9 });
  }
  return {
    group,
    update(t) {
      for (const b of boats) {
        const s = t * 0.9 + b.ph;
        b.m.position.y = b.y + Math.sin(s) * 0.07 * b.k;
        b.m.rotation.set(Math.sin(s * 0.8 + 1) * 0.035 * b.k + b.heel, b.yaw + Math.sin(t * 0.05 + b.ph) * 0.05, Math.sin(s * 0.65) * 0.022 * b.k, 'YXZ');
        if (b.drift) {
          const d = (Math.sin(t * 0.02 + b.ph) * 6) * b.drift;
          b.m.position.x = b.x + Math.cos(b.yaw) * d;
          b.m.position.z = b.z - Math.sin(b.yaw) * d;
        }
      }
      // a gull looks about in little jerks, now and then
      for (const g of gulls) {
        const k = Math.floor(t * 0.7 + g.ph);
        const r = Math.sin(k * 12.9898 + g.ph * 78.233) * 43758.5453;
        g.head.rotation.y = ((r - Math.floor(r)) - 0.5) * 2.2;
      }
    },
  };
}
