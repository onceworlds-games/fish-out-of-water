// The prop kit: how each look in a course is drawn. Everything is added to a batch (merged per material); things with
// many copies (ice cubes, lemons) go to instanced meshes.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M } from './materials.js';
import { tiledBox } from './batch.js';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rbox: new RoundedBoxGeometry(1, 1, 1, 2, 0.08),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  lowSphere: new THREE.SphereGeometry(1, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 10),
  torus: new THREE.TorusGeometry(1, 0.08, 6, 20),
};
export { G };

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Instanced small things (ice cubes, lemons, shells): collect transforms, build at the end. */
export function createScatter() {
  const sets = new Map();
  return {
    add(key, geo, material, p, r = [0, 0, 0], s = [1, 1, 1]) {
      let set = sets.get(key);
      if (!set) sets.set(key, (set = { geo, material, list: [] }));
      set.list.push({ p, r, s });
    },
    build(group) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const v = new THREE.Vector3();
      const sc = new THREE.Vector3();
      for (const set of sets.values()) {
        const mesh = new THREE.InstancedMesh(set.geo, set.material, set.list.length);
        set.list.forEach((it, i) => {
          e.set(it.r[0], it.r[1], it.r[2]);
          q.setFromEuler(e);
          m.compose(v.set(...it.p), q, sc.set(...it.s));
          mesh.setMatrixAt(i, m);
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
      }
      sets.clear();
    },
  };
}

// ---------------------------------------------------------------- the looks of solid colliders

/** Draw a collider by its look. `col` is a world collider (box/cyl) with a `look`. */
export function drawCollider(batch, scatter, col) {
  const look = col.look;
  if (!look) return;
  if (col.kind === 'box') {
    const [w, h, d] = [col.h[0] * 2, col.h[1] * 2, col.h[2] * 2];
    const t = { p: col.c, r: [col.pitch, col.yaw, 0] };
    const fn = BOX_LOOKS[look] ?? BOX_LOOKS.plain;
    fn(batch, scatter, w, h, d, t, col);
  } else if (col.kind === 'cyl') {
    const fn = CYL_LOOKS[look] ?? CYL_LOOKS.plain;
    fn(batch, scatter, col);
  }
}

/** A matrix for a box collider's frame, then a local offset inside it. */
function inFrame(t, local, extraRot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(t.r[0], t.r[1], t.r[2], 'YXZ'));
  m.compose(new THREE.Vector3(...t.p), q, new THREE.Vector3(1, 1, 1));
  const l = new THREE.Matrix4().compose(new THREE.Vector3(...local), new THREE.Quaternion().setFromEuler(new THREE.Euler(...extraRot, 'YXZ')), new THREE.Vector3(...scale));
  return m.multiply(l);
}

function crateBody(batch, w, h, d, t, wood = M.crate(), dark = M.crateDark()) {
  batch.add(dark, G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w - 0.04, h - 0.02, d - 0.04]));
  const slats = Math.max(2, Math.round(h / 0.15));
  const sh = (h / slats) * 0.78;
  for (let i = 0; i < slats; i++) {
    const y = -h / 2 + (h / slats) * (i + 0.5);
    batch.add(wood, G.rbox, inFrame(t, [0, y, d / 2 - 0.012], [0, 0, 0], [w, sh, 0.03]));
    batch.add(wood, G.rbox, inFrame(t, [0, y, -d / 2 + 0.012], [0, 0, 0], [w, sh, 0.03]));
    batch.add(wood, G.rbox, inFrame(t, [w / 2 - 0.012, y, 0], [0, 0, 0], [0.03, sh, d]));
    batch.add(wood, G.rbox, inFrame(t, [-w / 2 + 0.012, y, 0], [0, 0, 0], [0.03, sh, d]));
  }
  // corner posts
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) batch.add(dark, G.box, inFrame(t, [sx * (w / 2 - 0.02), 0, sz * (d / 2 - 0.02)], [0, 0, 0], [0.05, h, 0.05]));
}

function iceTop(scatter, w, d, t, y, density = 22, seed = 1) {
  const r = rng(seed + Math.round(t.p[0] * 31 + t.p[2] * 17));
  const n = Math.min(400, Math.round(w * d * density));
  const m = inFrame(t, [0, 0, 0]);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.set((r() - 0.5) * (w - 0.08), y + r() * 0.03, (r() - 0.5) * (d - 0.08)).applyMatrix4(m);
    const s = 0.035 + r() * 0.035;
    scatter.add('ice', G.box, M.ice(), [p.x, p.y, p.z], [r() * 3, r() * 3, r() * 3], [s, s * 0.8, s]);
  }
}

const BOX_LOOKS = {
  plain(batch, sc, w, h, d, t) {
    batch.add(M.white(), G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
  },
  wettile(batch, sc, w, h, d, t) {
    batch.add(M.wettile(), tiledBox(w, h, d, 0.75), inFrame(t, [0, 0, 0]));
  },
  tile(batch, sc, w, h, d, t) {
    batch.add(M.tile(), tiledBox(w, h, d, 0.75), inFrame(t, [0, 0, 0]));
  },
  quay(batch, sc, w, h, d, t) {
    batch.add(M.quay(), tiledBox(w, h, d, 1.25), inFrame(t, [0, 0, 0]));
  },
  sand(batch, sc, w, h, d, t) {
    batch.add(M.sand(), tiledBox(w, h, d, 2.5), inFrame(t, [0, 0, 0]));
  },
  wetsand(batch, sc, w, h, d, t) {
    batch.add(M.wetsand(), tiledBox(w, h, d, 2.5), inFrame(t, [0, 0, 0]));
  },
  grass(batch, sc, w, h, d, t) {
    batch.add(M.grass(), tiledBox(w, h, d, 2.0), inFrame(t, [0, 0, 0]));
  },
  planks(batch, sc, w, h, d, t) {
    batch.add(M.planks(), tiledBox(w, h, d, 1.6), inFrame(t, [0, 0, 0]));
  },
  plankramp(batch, sc, w, h, d, t) {
    batch.add(M.planks(), tiledBox(w, h, d, 1.2), inFrame(t, [0, 0, 0]));
    batch.add(M.crateDark(), G.box, inFrame(t, [w / 2 - 0.05, 0.06, 0], [0, 0, 0], [0.08, 0.12, d]));
    batch.add(M.crateDark(), G.box, inFrame(t, [-w / 2 + 0.05, 0.06, 0], [0, 0, 0], [0.08, 0.12, d]));
  },
  steel(batch, sc, w, h, d, t) {
    batch.add(M.steel(), tiledBox(w, h, d, 1.5), inFrame(t, [0, 0, 0]));
  },
  crate(batch, sc, w, h, d, t) {
    crateBody(batch, w, h, d, t);
  },
  cratestack(batch, sc, w, h, d, t) {
    // a stack of fish boxes: split into layers
    const layers = Math.max(1, Math.round(h / 0.45));
    const lh = h / layers;
    for (let i = 0; i < layers; i++) {
      const tt = { p: t.p, r: t.r };
      const m = inFrame(tt, [0, -h / 2 + lh * (i + 0.5), 0]);
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      crateBody(batch, w, lh, d, { p: [p.x, p.y, p.z], r: t.r }, i % 2 ? M.crate() : M.blue(), M.crateDark());
    }
  },
  cratestack2(batch, sc, w, h, d, t) {
    const layers = Math.max(1, Math.round(h / 0.45));
    const lh = h / layers;
    for (let i = 0; i < layers; i++) {
      const m = inFrame(t, [0, -h / 2 + lh * (i + 0.5), 0]);
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      crateBody(batch, w, lh, d, { p: [p.x, p.y, p.z], r: t.r }, i % 2 ? M.red() : M.crate(), M.crateDark());
    }
  },
  lemoncrate(batch, sc, w, h, d, t) {
    crateBody(batch, w, h, d, t);
    const r = rng(Math.round(t.p[0] * 13 + t.p[2] * 7));
    const m = inFrame(t, [0, 0, 0]);
    const p = new THREE.Vector3();
    const n = Math.round(w * d * 60);
    for (let i = 0; i < n; i++) {
      p.set((r() - 0.5) * (w - 0.12), h / 2 - 0.01 + r() * 0.03, (r() - 0.5) * (d - 0.12)).applyMatrix4(m);
      sc.add('lemon', G.sphere, M.lemon(), [p.x, p.y, p.z], [r() * 3, r() * 3, 0], [0.055, 0.045, 0.045]);
    }
  },
  icecrate(batch, sc, w, h, d, t) {
    crateBody(batch, w, h, d, t, M.blue(), M.blueDeep());
    batch.add(M.ice(), G.box, inFrame(t, [0, h / 2 - 0.02, 0], [0, 0, 0], [w - 0.06, 0.04, d - 0.06]));
    iceTop(sc, w, d, t, h / 2, 30, 3);
  },
  ice(batch, sc, w, h, d, t) {
    batch.add(M.ice(), G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
    iceTop(sc, w, d, t, h / 2, 34, 5);
  },
  counter(batch, sc, w, h, d, t, col) {
    const tint = col.tint === 'blue' ? M.blue() : col.tint === 'lemon' ? M.lemonPaint() : M.red();
    batch.add(M.counterWood(), tiledBox(w, h, d, 1.4), inFrame(t, [0, 0, 0]));
    // painted front panels on all four sides, a white lip
    batch.add(tint, G.box, inFrame(t, [0, -0.05, d / 2 + 0.005], [0, 0, 0], [w - 0.12, h - 0.25, 0.02]));
    batch.add(tint, G.box, inFrame(t, [0, -0.05, -d / 2 - 0.005], [0, 0, 0], [w - 0.12, h - 0.25, 0.02]));
    batch.add(tint, G.box, inFrame(t, [w / 2 + 0.005, -0.05, 0], [0, 0, 0], [0.02, h - 0.25, d - 0.12]));
    batch.add(tint, G.box, inFrame(t, [-w / 2 - 0.005, -0.05, 0], [0, 0, 0], [0.02, h - 0.25, d - 0.12]));
    batch.add(M.white(), G.rbox, inFrame(t, [0, h / 2 - 0.04, 0], [0, 0, 0], [w + 0.08, 0.08, d + 0.08]));
  },
  kiosk(batch, sc, w, h, d, t) {
    batch.add(M.blue(), tiledBox(w, h, d, 1), inFrame(t, [0, 0, 0]));
    batch.add(M.white(), G.box, inFrame(t, [0, h / 2 - 0.05, 0], [0, 0, 0], [w + 0.1, 0.1, d + 0.1]));
    // a hatch on the street side and posters
    batch.add(M.window(), G.box, inFrame(t, [-w / 2 - 0.01, 0.35, 0], [0, 0, 0], [0.02, 0.9, d * 0.6]));
    batch.add(M.lemonPaint(), G.box, inFrame(t, [-w / 2 - 0.015, -0.55, -d * 0.25], [0, 0, 0], [0.02, 0.6, 0.45]));
    batch.add(M.red(), G.box, inFrame(t, [-w / 2 - 0.015, -0.55, d * 0.25], [0, 0, 0], [0.02, 0.6, 0.45]));
  },
  awning(batch, sc, w, h, d, t, col) {
    const mat = col.tint === 'blue' ? M.awningBlue() : M.awningRed();
    const g = new THREE.PlaneGeometry(w, d, 1, 1);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 0.6, uv.getY(i));
    batch.add(mat, g, inFrame(t, [0, 0.03, 0]));
    // scalloped valance on both long sides
    valance(batch, mat, t, w, d);
  },
  netpile(batch, sc, w, h, d, t) {
    const r = rng(Math.round(t.p[2] * 5));
    for (let i = 0; i < 9; i++)
      batch.add(M.net(), G.lowSphere, inFrame(t, [(r() - 0.5) * w * 0.7, 0, (r() - 0.5) * d * 0.7], [0, r() * 3, 0], [0.35 + r() * 0.4, 0.09 + r() * 0.08, 0.3 + r() * 0.4]));
    for (let i = 0; i < 5; i++) batch.add(i % 2 ? M.red() : M.white(), G.sphere, inFrame(t, [(r() - 0.5) * w * 0.8, 0.08, (r() - 0.5) * d * 0.8], [0, 0, 0], [0.09, 0.09, 0.09]));
  },
  stove(batch, sc, w, h, d, t) {
    batch.add(M.steel(), tiledBox(w, h, d, 1.5), inFrame(t, [0, 0, 0]));
  },
};

function valance(batch, mat, t, w, d) {
  // little semicircles along the front (+x side of the frame along z)
  const shape = new THREE.Shape();
  const n = Math.max(3, Math.round(d / 0.3));
  const seg = d / n;
  shape.moveTo(-d / 2, 0);
  for (let i = 0; i < n; i++) {
    const x0 = -d / 2 + i * seg;
    shape.absarc(x0 + seg / 2, 0, seg / 2, Math.PI, 0, false);
  }
  shape.lineTo(d / 2, 0.12);
  shape.lineTo(-d / 2, 0.12);
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 4);
  g.translate(0, -0.14, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, g.attributes.position.getX(i) / 0.6, 0.5);
  for (const sx of [-1, 1]) batch.add(mat, g, inFrame(t, [sx * (w / 2), 0, 0], [0, Math.PI / 2, 0]), { cast: false });
}

const CYL_LOOKS = {
  plain(batch, sc, col) {
    batch.add(M.white(), G.cyl, { p: col.c, s: [col.r, col.hh * 2, col.r] });
  },
  barrel(batch, sc, col) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const y = -col.hh + (i / 8) * col.hh * 2;
      const k = 1 - Math.pow((i / 8) * 2 - 1, 2);
      pts.push(new THREE.Vector2(col.r * (0.86 + 0.14 * k), y));
    }
    const g = new THREE.LatheGeometry(pts, 16);
    batch.add(M.barrel(), g, { p: col.c });
    batch.add(M.crateDark(), G.cyl, { p: [col.c[0], col.c[1] + col.hh - 0.01, col.c[2]], s: [col.r * 0.85, 0.02, col.r * 0.85] });
    for (const y of [-0.62, -0.2, 0.2, 0.62]) {
      const k = 1 - y * y;
      const rr = col.r * (0.86 + 0.14 * k) + 0.005;
      const tor = new THREE.TorusGeometry(rr, 0.018, 4, 20);
      tor.rotateX(Math.PI / 2);
      batch.add(M.iron(), tor, { p: [col.c[0], col.c[1] + y * col.hh, col.c[2]] });
    }
  },
  bollard(batch, sc, col) {
    const pts = [new THREE.Vector2(0.17, -col.hh), new THREE.Vector2(0.15, col.hh * 0.4), new THREE.Vector2(0.13, col.hh * 0.7), new THREE.Vector2(0.21, col.hh * 0.85), new THREE.Vector2(0.2, col.hh), new THREE.Vector2(0.0, col.hh + 0.04)];
    batch.add(M.iron(), new THREE.LatheGeometry(pts, 14), { p: col.c });
  },
};

// ---------------------------------------------------------------- decor

/** Houses along a line from (x0, z0) to (x1, z1); `side` +1: the street is on their -x/left. */
export function houses(batch, sc, a, c, side, seed, base = 0, tall = 1) {
  const r = rng(seed);
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const ux = (c[0] - a[0]) / len, uz = (c[1] - a[1]) / len;
  // the facade's normal points to the street
  const nx = -uz * side, nz = ux * side;
  const yaw = Math.atan2(nx, nz);
  let s = 0;
  const walls = [M.plaster(), M.plaster(), M.white()];
  while (s < len - 0.5) {
    const w = Math.min(len - s, 4 + r() * 3.2);
    const h = (5.2 + r() * 4.5) * tall;
    const depth = 3;
    const cx = a[0] + ux * (s + w / 2) - nx * (depth / 2);
    const cz = a[1] + uz * (s + w / 2) - nz * (depth / 2);
    const t = { p: [cx, base + h / 2, cz], r: [0, yaw, 0] };
    const wall = walls[Math.floor(r() * walls.length)];
    batch.add(wall, G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, depth]));
    // a cornice and a parapet
    batch.add(M.white(), G.box, inFrame(t, [0, h / 2 + 0.08, depth / 2 - 0.15], [0, 0, 0], [w + 0.05, 0.16, 0.34]));
    if (r() < 0.45) batch.add(M.terracotta(), G.box, inFrame(t, [0, h / 2 + 0.25, 0], [0.25, 0, 0], [w + 0.1, 0.12, depth]));
    // ground floor: a door, maybe a shop
    const doorC = [M.blue(), M.blue(), M.red(), M.lemonPaint(), M.blueDeep()][Math.floor(r() * 5)];
    const dx = (r() - 0.5) * (w - 1.6);
    batch.add(doorC, G.box, inFrame(t, [dx, -h / 2 + 1.1, depth / 2 + 0.02], [0, 0, 0], [1.0, 2.2, 0.06]));
    batch.add(M.white(), G.box, inFrame(t, [dx, -h / 2 + 2.3, depth / 2 + 0.03], [0, 0, 0], [1.2, 0.18, 0.08]));
    if (r() < 0.5 && w > 4.4) {
      const sx = dx > 0 ? dx - 1.9 : dx + 1.9;
      batch.add(M.window(), G.box, inFrame(t, [sx, -h / 2 + 1.25, depth / 2 + 0.02], [0, 0, 0], [1.6, 1.5, 0.05]));
      const aw = r() < 0.5 ? M.awningRed() : M.awningBlue();
      const g = new THREE.PlaneGeometry(1.9, 0.9);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 1.9) / 0.5, uv.getY(i));
      batch.add(aw, g, inFrame(t, [sx, -h / 2 + 2.35, depth / 2 + 0.4], [-1.0, 0, 0]));
    }
    // upper floors: shuttered windows, sometimes a balcony with flowers
    const floors = Math.max(1, Math.floor((h - 3) / 2.6));
    const cols = Math.max(1, Math.floor(w / 1.8));
    for (let f = 0; f < floors; f++) {
      const y = -h / 2 + 3.4 + f * 2.6;
      const balcony = r() < 0.3;
      for (let k = 0; k < cols; k++) {
        const x = -w / 2 + (w / cols) * (k + 0.5);
        batch.add(M.window(), G.box, inFrame(t, [x, y, depth / 2 + 0.01], [0, 0, 0], [0.7, 1.15, 0.04]));
        const shut = r() < 0.75 ? M.blue() : M.blueDeep();
        const open = r() < 0.6;
        for (const sx of [-1, 1]) {
          if (open) batch.add(shut, G.box, inFrame(t, [x + sx * 0.62, y, depth / 2 + 0.06], [0, 0, 0], [0.36, 1.15, 0.04]));
          else batch.add(shut, G.box, inFrame(t, [x + sx * 0.18, y, depth / 2 + 0.05], [0, 0, 0], [0.34, 1.15, 0.04]));
        }
        batch.add(M.white(), G.box, inFrame(t, [x, y - 0.65, depth / 2 + 0.06], [0, 0, 0], [0.85, 0.08, 0.14]));
        if (!balcony && r() < 0.35) flowers(batch, sc, t, [x, y - 0.55, depth / 2 + 0.16], r);
      }
      if (balcony) {
        batch.add(M.white(), G.box, inFrame(t, [0, y - 0.7, depth / 2 + 0.4], [0, 0, 0], [w * 0.7, 0.1, 0.8]));
        batch.add(M.iron(), G.box, inFrame(t, [0, y - 0.3, depth / 2 + 0.78], [0, 0, 0], [w * 0.7, 0.04, 0.04]));
        for (let k = 0; k <= 8; k++) batch.add(M.iron(), G.box, inFrame(t, [-w * 0.35 + (w * 0.7 * k) / 8, y - 0.5, depth / 2 + 0.78], [0, 0, 0], [0.025, 0.4, 0.025]));
        flowers(batch, sc, t, [-w * 0.25, y - 0.55, depth / 2 + 0.55], r);
        flowers(batch, sc, t, [w * 0.25, y - 0.55, depth / 2 + 0.55], r);
      }
    }
    // bougainvillea over some doors
    if (r() < 0.3) {
      for (let i = 0; i < 6; i++) batch.add(M.pink(), G.lowSphere, inFrame(t, [dx + (r() - 0.5) * 2.0, -h / 2 + 2.7 + r() * 0.8, depth / 2 + 0.15], [0, 0, 0], [0.35 + r() * 0.3, 0.3 + r() * 0.2, 0.2]));
    }
    s += w;
  }
}

function flowers(batch, sc, t, at, r) {
  batch.add(M.terracotta(), G.box, inFrame(t, at, [0, 0, 0], [0.55, 0.18, 0.2]));
  for (let i = 0; i < 4; i++) batch.add(r() < 0.5 ? M.pink() : M.red(), G.lowSphere, inFrame(t, [at[0] + (r() - 0.5) * 0.45, at[1] + 0.16, at[2]], [0, 0, 0], [0.11, 0.1, 0.1]));
  batch.add(M.leaf(), G.lowSphere, inFrame(t, [at[0], at[1] + 0.1, at[2]], [0, 0, 0], [0.3, 0.08, 0.1]));
}

export function drawDecor(batch, sc, d, extras) {
  const at = d.at;
  const fn = DECOR[d.look];
  if (fn) fn(batch, sc, d, at, extras);
}

const DECOR = {
  houses(batch, sc, d, at) {
    houses(batch, sc, [at[0], at[2]], [at[0], d.z1], d.side, d.seed, d.base ?? 0, d.tall ?? 1);
  },
  jog(batch, sc, d) {
    const [a, c] = d.pts;
    houses(batch, sc, a, c, d.side, 77 + Math.round(a[1]), 0);
  },
  backwall(batch, sc, d, at) {
    houses(batch, sc, [at[0] + d.w / 2, at[2]], [at[0] - d.w / 2, at[2]], -1, 41, 0, 1.1);
  },
  awning(batch, sc, d, at) {
    const mat = d.tint === 'blue' ? M.awningBlue() : M.awningRed();
    const g = new THREE.PlaneGeometry(d.w, d.d);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * d.w) / 0.6, uv.getY(i));
    const t = { p: at, r: [-(d.slope ?? 0.2), 0, 0] };
    batch.add(mat, g, inFrame(t, [0, 0, 0]));
    valanceFront(batch, mat, t, d.w, d.d);
    for (const sx of [-1, 1]) batch.add(M.iron(), G.cyl8, { p: [at[0] + sx * (d.w / 2 - 0.1), at[1] / 2 - 0.1, at[2] + d.d / 2 - 0.1], s: [0.035, at[1] - 0.2, 0.035] });
  },
  awningposts(batch, sc, d, at) {
    for (const sz of [-1, 1]) {
      const x = at[0] - d.side * (d.aw / 2 - 0.08);
      batch.add(M.iron(), G.cyl8, { p: [x, at[1] / 2, at[2] + sz * (d.len / 2 - 0.1)], s: [0.035, at[1], 0.035] });
    }
  },
  stallgoods(batch, sc, d, at) {
    const r = rng(d.seed ?? 1);
    const n = Math.round(d.len * 3);
    for (let i = 0; i < n; i++) {
      const along = (r() - 0.5) * (d.len - 0.4);
      const across = (r() - 0.5) * (d.depth - 0.4);
      const p = d.alongX ? [at[0] + along, at[1] + 0.03, at[2] + across] : [at[0] + across, at[1] + 0.03, at[2] + along];
      const kind = r();
      if (kind < 0.35) sc.add('lemon', G.sphere, M.lemon(), p, [r() * 3, r() * 3, 0], [0.055, 0.045, 0.045]);
      else if (kind < 0.7) sc.add('shell', G.lowSphere, M.shell(), p, [0, r() * 3, 0.3], [0.05, 0.022, 0.032]);
      else if (kind < 0.85) sc.add('leaf', G.lowSphere, M.leaf(), p, [0, r() * 3, 0], [0.09, 0.03, 0.06]);
      else sc.add('coral', G.lowSphere, M.coral(), p, [0, r() * 3, 0], [0.07, 0.05, 0.07]);
    }
  },
  pricetags(batch, sc, d, at, extras) {
    const r = rng(d.seed ?? 1);
    for (let i = 0; i < d.n; i++) {
      const p = [at[0] + (r() - 0.5) * d.w * 0.9, at[1], at[2] + (r() - 0.5) * d.d * 0.8];
      extras?.tags?.push({ p, yaw: (r() - 0.5) * 0.8, label: r() });
    }
  },
  kioskroof(batch, sc, d, at) {
    batch.add(M.awningBlue(), G.box, { p: [at[0], at[1] + 0.02, at[2]], s: [d.w + 0.3, 0.06, d.d + 0.3] });
  },
  mopbucket(batch, sc, d, at) {
    batch.add(M.lemonPaint(), G.cyl, { p: [at[0], at[1] + 0.2, at[2]], s: [0.22, 0.4, 0.22] });
    batch.add(M.iron(), G.cyl8, { p: [at[0] + 0.1, at[1] + 0.75, at[2]], r: [0, 0, 0.35], s: [0.02, 1.2, 0.02] });
    for (let i = 0; i < 7; i++) batch.add(M.rope(), G.cyl8, { p: [at[0] + Math.cos(i) * 0.08, at[1] + 0.3, at[2] + Math.sin(i) * 0.08], r: [Math.sin(i * 2) * 0.4, 0, Math.cos(i * 2) * 0.4], s: [0.018, 0.22, 0.018] });
  },
  bucket(batch, sc, d, at) {
    batch.add(M.lemonPaint(), G.cyl, { p: [at[0], at[1] + 0.14, at[2]], r: [0, 0.4, Math.PI / 2], s: [0.17, 0.32, 0.17] });
  },
  hosereel(batch, sc, d, at) {
    const tor = new THREE.TorusGeometry(0.3, 0.05, 6, 18);
    batch.add(M.leaf(), tor, { p: [at[0], at[1] + 0.4, at[2]], r: [0, Math.PI / 2, 0] });
    batch.add(M.leaf(), tor, { p: [at[0], at[1] + 0.4, at[2] + 0.08], r: [0, Math.PI / 2, 0], s: [0.8, 0.8, 0.8] });
    batch.add(M.red(), G.box, { p: [at[0], at[1] + 0.2, at[2]], s: [0.1, 0.4, 0.5] });
  },
  railing(batch, sc, d, at) {
    const len = d.z1 - at[2];
    batch.add(M.iron(), G.box, { p: [at[0], at[1] + 1.0, at[2] + len / 2], s: [0.05, 0.05, len] });
    batch.add(M.iron(), G.box, { p: [at[0], at[1] + 0.5, at[2] + len / 2], s: [0.03, 0.03, len] });
    for (let z = at[2]; z <= d.z1; z += 1.5) batch.add(M.iron(), G.box, { p: [at[0], at[1] + 0.5, z], s: [0.05, 1.0, 0.05] });
  },
  quayedge(batch, sc, d, at) {
    const len = d.x1 - d.x0;
    batch.add(M.quayside(), G.box, { p: [(d.x0 + d.x1) / 2, at[1] - 1.4, at[2] - 0.2], s: [len, 2.8, 0.4] });
    batch.add(M.white(), G.rbox, { p: [(d.x0 + d.x1) / 2, at[1] + 0.02, at[2] - 0.15], s: [len, 0.12, 0.42] });
    for (let x = d.x0 + 1.5; x < d.x1 - 1; x += 3.2) {
      const tor = new THREE.TorusGeometry(0.28, 0.1, 8, 16);
      batch.add(M.tyre(), tor, { p: [x, at[1] - 0.55, at[2] + 0.05], r: [0, 0, 0] });
    }
  },
  bunting(batch, sc, d, at) {
    const cols = [M.red(), M.white(), M.blue(), M.lemonPaint()];
    const n = Math.round((d.x1 - d.x0) / 0.5);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = d.x0 + (d.x1 - d.x0) * u;
      const sag = Math.sin(u * Math.PI) * 0.7;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.17, 0, 0, 0.17, 0, 0, 0, -0.38, 0]), 3));
      g.computeVertexNormals();
      batch.add(cols[i % 4], g, { p: [x, d.h - sag, at[2]] }, { cast: false });
    }
  },
  podium(batch, sc, d, at) {
    // drawn by the results scene (visible only then)
  },
};

function valanceFront(batch, mat, t, w, dd) {
  const shape = new THREE.Shape();
  const n = Math.max(3, Math.round(w / 0.3));
  const seg = w / n;
  shape.moveTo(-w / 2, 0);
  for (let i = 0; i < n; i++) shape.absarc(-w / 2 + i * seg + seg / 2, 0, seg / 2, Math.PI, 0, false);
  shape.lineTo(w / 2, 0.14);
  shape.lineTo(-w / 2, 0.14);
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 4);
  g.translate(0, -0.16, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, g.attributes.position.getX(i) / 0.6, 0.5);
  batch.add(mat, g, inFrame(t, [0, 0, dd / 2], [0, 0, 0]), { cast: false });
}
