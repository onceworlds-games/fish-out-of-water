// The prop kit: how each look in a course is drawn. Everything is added to a batch (merged per material); things with
// many copies (ice cubes, lemons) go to instanced meshes.

import * as THREE from 'three';
import { M } from './materials.js';
import { tiledBox } from './batch.js';

import { G, rng } from './geo.js';
import { drawHouse, drawStep, drawRunnel, drawFountain, drawCafeTable, drawChair, drawParasol, drawLedge, drawLamp, drawSail } from './town.js';
import { HARBOUR_BOX_LOOKS, HARBOUR_DECOR, catchFish } from './harbour.js';
export { G };

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
          e.set(it.r[0], it.r[1], it.r[2], it.r[3] ?? 'XYZ');
          q.setFromEuler(e);
          m.compose(v.set(it.p[0], it.p[1], it.p[2]), q, sc.set(...it.s));
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
  } else if (col.kind === 'sphere') {
    const fn = SPHERE_LOOKS[look] ?? SPHERE_LOOKS.plain;
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

/** Crushed ice heaped on a surface: many small rounded lumps, half sunk, a few bigger chunks, glinting. */
function iceTop(scatter, w, d, t, y, density = 22, seed = 1) {
  const r = rng(seed + Math.round(t.p[0] * 31 + t.p[2] * 17));
  const n = Math.min(900, Math.round(w * d * density * 3.2));
  const m = inFrame(t, [0, 0, 0]);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const big = r() < 0.08;
    const s = big ? 0.05 + r() * 0.04 : 0.018 + r() * 0.03;
    // heaped a little higher in the middle
    const u = (r() - 0.5) * (w - 0.06), v = (r() - 0.5) * (d - 0.06);
    const mound = (1 - (2 * u / w) ** 2) * (1 - (2 * v / d) ** 2) * 0.035;
    p.set(u, y + mound - s * 0.3, v).applyMatrix4(m);
    scatter.add(big ? 'iceChunk' : 'iceLump', G.ico, big ? M.iceChunk() : M.iceLump(), [p.x, p.y, p.z], [r() * 3, r() * 3, r() * 3], [s, s * (0.6 + r() * 0.4), s * (0.8 + r() * 0.4)]);
  }
}

const BOX_LOOKS = {
  ...HARBOUR_BOX_LOOKS,
  house(batch, sc, w, h, d, t, col) {
    drawHouse(batch, sc, col);
  },
  step(batch, sc, w, h, d, t) {
    drawStep(batch, w, h, d, t);
  },
  runnel(batch, sc, w, h, d, t) {
    drawRunnel(batch, w, h, d, t);
  },
  curb(batch, sc, w, h, d, t) {
    batch.add(M.stone(), G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
  },
  rim() {},
  cobbles(batch, sc, w, h, d, t) {
    batch.add(M.cobbles(), G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
  },
  flags(batch, sc, w, h, d, t) {
    batch.add(M.flags(), G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
  },
  concrete(batch, sc, w, h, d, t) {
    batch.add(M.concrete(), G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
  },
  chair(batch, sc, w, h, d, t) {
    drawChair(batch, w, h, d, t);
  },
  ledge(batch, sc, w, h, d, t) {
    drawLedge(batch, w, h, d, t);
  },
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

  // ------------------------------------------------------------ the kitchen
  kfloor(batch, sc, w, h, d, t) {
    batch.add(M.kfloor(), tiledBox(w, h, d, 1.0), inFrame(t, [0, 0, 0]));
  },
  kwalltile(batch, sc, w, h, d, t) {
    batch.add(M.subway(), tiledBox(w, Math.min(h, 2.9), d, 1.2), inFrame(t, [0, -h / 2 + Math.min(h, 2.9) / 2, 0]));
    if (h > 2.9) batch.add(M.warmwall(), G.box, inFrame(t, [0, -h / 2 + 2.9 + (h - 2.9) / 2, 0], [0, 0, 0], [w, h - 2.9, d]));
    batch.add(M.bluetile(), G.box, inFrame(t, [0, -h / 2 + 1.22, 0], [0, 0, 0], [w + 0.02, 0.1, d + 0.02]));
    batch.add(M.steel(), G.box, inFrame(t, [0, -h / 2 + 0.06, 0], [0, 0, 0], [w + 0.02, 0.12, d + 0.04]));
  },
  steelcounter(batch, sc, w, h, d, t) {
    steelBody(batch, w, h, d, t);
  },
  sinkunit(batch, sc, w, h, d, t) {
    steelBody(batch, w, h, d, t);
    batch.add(M.slate(), G.box, inFrame(t, [0, h / 2 - 0.08, 0], [0, 0, 0], [w * 0.6, 0.14, d * 0.6]));
    batch.add(M.water(), G.box, inFrame(t, [0, h / 2 - 0.1, 0], [0, 0, 0], [w * 0.58, 0.02, d * 0.58]), { cast: false });
  },
  icepan(batch, sc, w, h, d, t) {
    batch.add(M.ice(), G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
    const lip = 0.05;
    batch.add(M.steel(), G.box, inFrame(t, [0, 0.02, d / 2 + lip / 2], [0, 0, 0], [w + lip * 2, h + 0.06, lip]));
    batch.add(M.steel(), G.box, inFrame(t, [0, 0.02, -d / 2 - lip / 2], [0, 0, 0], [w + lip * 2, h + 0.06, lip]));
    batch.add(M.steel(), G.box, inFrame(t, [w / 2 + lip / 2, 0.02, 0], [0, 0, 0], [lip, h + 0.06, d]));
    batch.add(M.steel(), G.box, inFrame(t, [-w / 2 - lip / 2, 0.02, 0], [0, 0, 0], [lip, h + 0.06, d]));
    iceTop(sc, w, d, t, h / 2, 16, 7);
  },
  range(batch, sc, w, h, d, t) {
    // the oven body, a black hob with glowing rings under iron grates, red knobs along the front
    batch.add(M.steel(), tiledBox(w, h - 0.06, d, 1.5), inFrame(t, [0, -0.03, 0]));
    batch.add(M.hotplate(), G.box, inFrame(t, [0, h / 2 - 0.03, 0], [0, 0, 0], [w, 0.06, d]));
    const n = Math.max(1, Math.floor(d / 1.6));
    const front = w / 2 + 0.01;
    for (let i = 0; i < n; i++) {
      const z = -d / 2 + (d / n) * (i + 0.5);
      batch.add(M.window(), G.box, inFrame(t, [front, -0.12, z], [0, 0, 0], [0.02, 0.36, 1.1]));
      batch.add(M.iron(), G.box, inFrame(t, [front + 0.04, 0.12, z], [0, 0, 0], [0.04, 0.04, 1.0]));
      for (const dz of [-0.45, -0.15, 0.15, 0.45]) batch.add(M.red(), G.cyl8, inFrame(t, [front + 0.03, h / 2 - 0.16, z + dz], [0, 0, Math.PI / 2], [0.045, 0.06, 0.045]));
      for (const dx of [-0.3, 0.3])
        for (const dz of [-0.4, 0.4]) {
          const ring = new THREE.TorusGeometry(0.17, 0.025, 4, 20).rotateX(Math.PI / 2);
          batch.add(M.glow(), ring, inFrame(t, [dx, h / 2 + 0.005, z + dz]), { cast: false });
          batch.add(M.iron(), G.box, inFrame(t, [dx, h / 2 + 0.035, z + dz], [0, 0.785, 0], [0.5, 0.025, 0.025]));
          batch.add(M.iron(), G.box, inFrame(t, [dx, h / 2 + 0.035, z + dz], [0, -0.785, 0], [0.5, 0.025, 0.025]));
        }
    }
  },
  shelf(batch, sc, w, h, d, t) {
    batch.add(M.counterWood(), tiledBox(w, h, d, 1.2), inFrame(t, [0, 0, 0]));
    for (let z = -d / 2 + 0.4; z < d / 2; z += 1.6) {
      batch.add(M.iron(), G.box, inFrame(t, [-w / 2 + 0.3, -0.2, z], [0, 0, 0.75], [0.04, 0.55, 0.04]));
      batch.add(M.iron(), G.box, inFrame(t, [-w / 2 + 0.25, -h / 2 - 0.015, z], [0, 0, 0], [0.5, 0.03, 0.05]));
    }
  },
  pass(batch, sc, w, h, d, t) {
    steelBody(batch, w, h, d, t);
    batch.add(M.lemonPaint(), G.box, inFrame(t, [0, h / 2 - 0.1, 0], [0, 0, 0], [w + 0.03, 0.06, d + 0.03]));
  },
  butcher(batch, sc, w, h, d, t) {
    batch.add(M.counterWood(), tiledBox(w, 0.3, d, 0.8), inFrame(t, [0, h / 2 - 0.15, 0]));
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) batch.add(M.steel(), G.box, inFrame(t, [sx * (w / 2 - 0.1), -0.15, sz * (d / 2 - 0.1)], [0, 0, 0], [0.08, h - 0.3, 0.08]));
    batch.add(M.steel(), G.box, inFrame(t, [0, -h / 2 + 0.15, 0], [0, 0, 0], [w - 0.1, 0.04, d - 0.1]));
  },
  sack(batch, sc, w, h, d, t) {
    // a sack lying down: a soft pillow of burlap, its tied neck to one side, a red stencilled band
    const pillow = new RoundedBoxGeometry(1, 1, 1, 4, 0.45);
    batch.add(M.burlap(), pillow, inFrame(t, [-0.05, 0, 0], [0, 0, 0], [w * 0.9, h, d]));
    batch.add(M.burlap(), G.cyl8, inFrame(t, [w * 0.45, h * 0.05, 0], [0, 0, Math.PI / 2], [0.12, 0.2, 0.12]));
    batch.add(M.burlap(), G.lowSphere, inFrame(t, [w * 0.56, h * 0.05, 0], [0, 0, 0], [0.09, 0.16, 0.16]));
    batch.add(M.rope(), G.torus, inFrame(t, [w * 0.47, h * 0.05, 0], [0, Math.PI / 2, 0], [0.13, 0.13, 0.13]));
    batch.add(M.red(), G.box, inFrame(t, [-0.05, h * 0.42, 0], [0, 0, 0], [w * 0.2, 0.02, d * 0.75]));
  },
  rack(batch, sc, w, h, d, t) {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) batch.add(M.steel(), G.cyl8, inFrame(t, [sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03)], [0, 0, 0], [0.025, h, 0.025]));
    for (let k = 0; k < 4; k++) {
      const y = -h / 2 + 0.15 + k * ((h - 0.2) / 3);
      batch.add(M.steel(), G.box, inFrame(t, [0, y, 0], [0, 0, 0], [w, 0.03, d]));
      for (let i = 0; i < 4; i++) batch.add(M.china(), G.cyl, inFrame(t, [-w / 2 + 0.2 + i * ((w - 0.4) / 3), y + 0.05, 0], [0, 0, 0], [0.16, 0.06, 0.16]));
    }
  },
  drain(batch, sc, w, h, d, t) {
    batch.add(M.grate(), tiledBox(w, h, d, 0.5), inFrame(t, [0, 0, 0]));
  },

  // ------------------------------------------------------------ the beach
  coolbox(batch, sc, w, h, d, t) {
    batch.add(M.blue(), G.rbox, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
    batch.add(M.white(), G.rbox, inFrame(t, [0, h / 2 - 0.03, 0], [0, 0, 0], [w + 0.06, 0.1, d + 0.06]));
    for (const sx of [-1, 1]) batch.add(M.white(), G.box, inFrame(t, [sx * (w / 2 + 0.04), 0.05, 0], [0, 0, 0], [0.06, 0.08, d * 0.4]));
    batch.add(M.white(), G.box, inFrame(t, [0, -0.02, d / 2 + 0.01], [0, 0, 0], [w * 0.5, 0.12, 0.02]));
  },
  coolbox2(batch, sc, w, h, d, t) {
    batch.add(M.red(), G.rbox, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
    batch.add(M.white(), G.rbox, inFrame(t, [0, h / 2 + 0.2, -d / 2 - 0.02], [-1.3, 0, 0], [w, 0.08, d * 0.9]));
    iceTop(sc, w * 0.85, d * 0.8, t, h / 2 - 0.02, 30, 9);
  },
  groyne(batch, sc, w, h, d, t) {
    batch.add(M.driftwood(), tiledBox(w * 0.6, h * 0.8, d, 1.6), inFrame(t, [0, -h * 0.1, 0]));
    for (let z = -d / 2 + 0.6; z < d / 2; z += 1.8) batch.add(M.driftwood(), G.cyl8, inFrame(t, [0, 0.1, z], [0, 0, 0], [0.16, h + 0.2, 0.16]));
  },
  boardwalk(batch, sc, w, h, d, t) {
    batch.add(M.planks(), tiledBox(w, h * 0.5, d, 1.4), inFrame(t, [0, h * 0.25, 0]));
    for (let z = -d / 2 + 0.5; z < d / 2; z += 1.6)
      for (const sx of [-1, 1]) batch.add(M.driftwood(), G.box, inFrame(t, [sx * (w / 2 - 0.12), -0.05, z], [0, 0, 0], [0.12, h, 0.12]));
  },
  towerdeck(batch, sc, w, h, d, t) {
    batch.add(M.planks(), tiledBox(w, h, d, 1.2), inFrame(t, [0, 0, 0]));
  },
  rowboat(batch, sc, w, h, d, t) {
    // an upturned rowing boat: a hull of two coloured strakes, the keel on top
    const hull = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    batch.add(M.blue(), hull, inFrame(t, [0, -h / 2, 0], [0, 0, 0], [w / 2, h, d / 2]));
    batch.add(M.white(), G.box, inFrame(t, [0, -h / 2 + 0.06, 0], [0, 0, 0], [w * 1.0, 0.1, d * 0.98]));
    batch.add(M.red(), G.box, inFrame(t, [0, h / 2 - 0.02, 0], [0, 0, 0], [0.1, 0.08, d * 0.9]));
  },
  // ------------------------------------------------------------ the park
  gravel(batch, sc, w, h, d, t) {
    batch.add(M.gravel(), tiledBox(w, h, d, 2.0), inFrame(t, [0, 0, 0]));
    for (const sz of [-1, 1]) batch.add(M.white(), G.box, inFrame(t, [0, h / 2 + 0.01, sz * (d / 2 - 0.05)], [0, 0, 0], [w, 0.03, 0.1]));
  },
  parkstep(batch, sc, w, h, d, t) {
    batch.add(M.quay(), tiledBox(w, h, d, 1.25), inFrame(t, [0, 0, 0]));
    batch.add(M.quayside(), G.box, inFrame(t, [0, h / 2 - 0.04, d / 2 - 0.06], [0, 0, 0], [w, 0.09, 0.14]));
  },
  hedge(batch, sc, w, h, d, t) {
    batch.add(M.hedge(), G.rbox, inFrame(t, [0, 0, 0], [0, 0, 0], [w, h, d]));
    const r = rng(Math.round(t.p[2] * 3 + t.p[0]));
    const L = Math.max(w, d);
    for (let i = 0; i < L * 1.2; i++) {
      const u = (r() - 0.5) * (L - 0.4);
      sc.add('hedgebump', G.lowSphere, M.hedge(), d > w ? [t.p[0] + (r() - 0.5) * w * 0.6, t.p[1] + h / 2 - 0.05, t.p[2] + u] : [t.p[0] + u, t.p[1] + h / 2 - 0.05, t.p[2]], [0, r() * 3, 0], [0.3, 0.18, 0.3]);
    }
  },
  trestle(batch, sc, w, h, d, t) {
    batch.add(M.gingham(), G.box, inFrame(t, [0, 0, 0], [0, 0, 0], [w + 0.1, h, d + 0.1]));
    for (const sz of [-1, 1]) batch.add(M.gingham(), G.box, inFrame(t, [0, -0.12, sz * (d / 2 + 0.05)], [0, 0, 0], [w + 0.1, 0.24, 0.02]));
  },
  picnictop(batch, sc, w, h, d, t) {
    batch.add(M.planks(), tiledBox(w, h, d, 1.0), inFrame(t, [0, 0, 0]));
  },
  picnicbench(batch, sc, w, h, d, t) {
    batch.add(M.planks(), tiledBox(w, h, d, 1.0), inFrame(t, [0, 0, 0]));
  },
  roses(batch, sc, w, h, d, t) {
    batch.add(M.soil(), G.box, inFrame(t, [0, -0.05, 0], [0, 0, 0], [w, h - 0.1, d]));
    batch.add(M.quayside(), G.box, inFrame(t, [0, -0.1, 0], [0, 0, 0], [w + 0.14, h - 0.2, d + 0.14]));
    const r = rng(Math.round(t.p[2] * 7 + t.p[0]));
    const n = Math.round(w * d * 5);
    const cols = [M.red(), M.pink(), M.white(), M.lemonPaint()];
    for (let i = 0; i < n; i++) {
      const p = [t.p[0] + (r() - 0.5) * (w - 0.3), t.p[1] + h / 2 + 0.05, t.p[2] + (r() - 0.5) * (d - 0.3)];
      sc.add('rosebush', G.lowSphere, M.hedge(), p, [0, r() * 3, 0], [0.22, 0.16, 0.22]);
      batch.add(cols[Math.floor(r() * 4)], G.lowSphere, { p: [p[0], p[1] + 0.13, p[2]], s: [0.08, 0.07, 0.08] });
    }
  },
  handrail(batch, sc, w, h, d, t) {
    batch.add(M.brass(), G.cyl8, inFrame(t, [0, 0, 0], [Math.PI / 2, 0, 0], [w * 0.4, d, w * 0.4]));
  },
  windbreak(batch, sc, w, h, d, t) {
    const long = d > w;
    const L = long ? d : w;
    const n = Math.max(2, Math.round(L / 0.5));
    const cols = [M.red(), M.white(), M.blue(), M.white()];
    for (let i = 0; i < n; i++) {
      const u = -L / 2 + (L / n) * (i + 0.5);
      batch.add(cols[i % 4], G.box, inFrame(t, long ? [0, 0, u] : [u, 0, 0], [0, 0, 0], long ? [0.03, h * 0.9, L / n] : [L / n, h * 0.9, 0.03]));
    }
    for (let i = 0; i <= Math.round(L / 1.2); i++) {
      const u = -L / 2 + (L * i) / Math.round(L / 1.2);
      batch.add(M.driftwood(), G.cyl8, inFrame(t, long ? [0, 0.05, u] : [u, 0.05, 0], [0, 0, 0], [0.04, h + 0.15, 0.04]));
    }
  },
};

/** A stainless steel counter: doors, a recessed kick plate, a rolled top edge, bar handles. */
function steelBody(batch, w, h, d, t) {
  batch.add(M.steel(), tiledBox(w, h - 0.14, d, 1.5), inFrame(t, [0, 0.07, 0]));
  batch.add(M.slate(), G.box, inFrame(t, [0, -h / 2 + 0.07, 0], [0, 0, 0], [w - 0.08, 0.14, d - 0.08]));
  batch.add(M.steel(), G.rbox, inFrame(t, [0, h / 2 - 0.02, 0], [0, 0, 0], [w + 0.05, 0.05, d + 0.05]));
  const long = d >= w;
  const L = long ? d : w;
  const n = Math.max(1, Math.round(L / 0.9));
  for (let i = 0; i < n; i++) {
    const u = -L / 2 + (L / n) * (i + 0.5);
    for (const s of [-1, 1]) {
      const p = long ? [s * (w / 2 + 0.03), h / 2 - 0.2, u] : [u, h / 2 - 0.2, s * (d / 2 + 0.03)];
      const sz = long ? [0.025, 0.025, (L / n) * 0.55] : [(L / n) * 0.55, 0.025, 0.025];
      batch.add(M.iron(), G.box, inFrame(t, p, [0, 0, 0], sz));
      const seam = long ? [s * (w / 2 + 0.004), 0.05, u - L / n / 2] : [u - L / n / 2, 0.05, s * (d / 2 + 0.004)];
      if (i > 0) batch.add(M.iron(), G.box, inFrame(t, seam, [0, 0, 0], long ? [0.01, h - 0.3, 0.012] : [0.012, h - 0.3, 0.01]));
    }
  }
}

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
  cafetable(batch, sc, col) {
    drawCafeTable(batch, col);
  },
  parasol(batch, sc, col) {
    drawParasol(batch, col, col.tint);
  },
  lamppost(batch, sc, col) {
    drawLamp(batch, col);
  },
  column() {},
  bowl() {},
  trunk(batch, sc, col) {
    const [x, y, z] = col.c;
    batch.add(M.bark(), G.cyl8, { p: [x, y, z], s: [col.r, col.hh * 2, col.r * 0.9] });
  },
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
  bbq(batch, sc, col) {
    const [x, y, z] = col.c;
    const top = y + col.hh;
    const bowl = new THREE.SphereGeometry(col.r, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    batch.add(M.slate(), bowl, { p: [x, top - 0.02, z] });
    batch.add(M.glow(), G.cyl, { p: [x, top - 0.06, z], s: [col.r * 0.85, 0.04, col.r * 0.85] }, { cast: false });
    for (let i = -2; i <= 2; i++) batch.add(M.iron(), G.box, { p: [x + i * 0.15, top + 0.01, z], s: [0.02, 0.02, col.r * 1.8] });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const base = y - col.hh, h = col.hh * 2 - col.r * 0.6;
      batch.add(M.slate(), G.cyl8, { p: [x + Math.cos(a) * col.r * 0.55, base + h / 2, z + Math.sin(a) * col.r * 0.55], r: [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15], s: [0.03, h, 0.03] });
    }
    batch.add(M.red(), G.box, { p: [x + 0.2, top + 0.03, z], s: [0.3, 0.04, 0.12] });
  },
  tree(batch, sc, col) {
    const [x, y, z] = col.c;
    const base = y - col.hh;
    batch.add(M.bark(), G.cyl8, { p: [x, base + col.hh, z], s: [col.r, col.hh * 2, col.r] });
    const r = rng(Math.round(x * 13 + z * 7));
    for (let i = 0; i < 6; i++) batch.add(M.hedge(), G.lowSphere, { p: [x + (r() - 0.5) * 2, base + col.hh * 2 + 0.6 + r() * 1.4, z + (r() - 0.5) * 2], s: [1.2 + r() * 0.6, 1.0 + r() * 0.4, 1.2 + r() * 0.6] });
  },
  oldcafetable(batch, sc, col) {
    const [x, y, z] = col.c;
    batch.add(M.white(), G.cyl, { p: [x, y + col.hh - 0.02, z], s: [col.r, 0.04, col.r] });
    batch.add(M.iron(), G.cyl8, { p: [x, y, z], s: [0.04, col.hh * 2, 0.04] });
    batch.add(M.iron(), G.cyl, { p: [x, y - col.hh + 0.02, z], s: [0.25, 0.04, 0.25] });
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + 0.5;
      const cx = x + Math.cos(a) * 0.7, cz = z + Math.sin(a) * 0.7;
      batch.add(M.iron(), G.box, { p: [cx, y - col.hh + 0.23, cz], s: [0.4, 0.46, 0.4] });
      batch.add(M.blue(), G.box, { p: [cx, y - col.hh + 0.47, cz], s: [0.42, 0.04, 0.42] });
    }
  },
  oldbasin(batch, sc, col) {
    const [x, y, z] = col.c;
    batch.add(M.quayside(), G.cyl, { p: col.c, s: [col.r, col.hh * 2, col.r] });
    const rim = new THREE.TorusGeometry(col.r - 0.08, 0.14, 8, 40).rotateX(Math.PI / 2);
    batch.add(M.white(), rim, { p: [x, y + col.hh + 0.04, z] });
  },
  oldcolumn(batch, sc, col) {
    const [x, y, z] = col.c;
    batch.add(M.white(), G.cyl, { p: col.c, s: [col.r, col.hh * 2, col.r] });
    batch.add(M.white(), G.cyl, { p: [x, y + col.hh, z], s: [col.r * 2.6, 0.12, col.r * 2.6] });
    batch.add(M.white(), G.sphere, { p: [x, y + col.hh + 0.1, z], s: [col.r * 2.4, 0.2, col.r * 2.4] });
  },
  pole(batch, sc, col) {
    batch.add(M.white(), G.cyl8, { p: col.c, s: [0.035, col.hh * 2, 0.035] });
  },
  umbrella(batch, sc, col) {
    // a striped parasol: eight panels alternating with white, a fringe, a knob on top
    const tint = col.tint === 'blue' ? M.blue() : col.tint === 'lemon' ? M.lemonPaint() : M.red();
    const r = col.r * 1.05;
    const top = [col.c[0], col.c[1] + col.hh, col.c[2]];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.ConeGeometry(r, 0.42, 8, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4);
      batch.add(i % 2 ? M.white() : tint, g, { p: [top[0], top[1] + 0.05, top[2]] });
    }
    batch.add(M.white(), G.sphere, { p: [top[0], top[1] + 0.3, top[2]], s: [0.06, 0.06, 0.06] });
    batch.add(tint, G.cyl, { p: [top[0], top[1] - 0.12, top[2]], s: [r * 0.97, 0.02, r * 0.97] });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      batch.add(i % 2 ? M.white() : tint, G.box, { p: [top[0] + Math.cos(a) * r * 0.98, top[1] - 0.2, top[2] + Math.sin(a) * r * 0.98], r: [0, -a, 0], s: [0.04, 0.1, 0.38] });
    }
  },
  castle(batch, sc, col) {
    const [x, y, z] = col.c;
    const base = y - col.hh;
    batch.add(M.sandcastle(), G.cyl, { p: [x, base + col.hh * 0.55, z], s: [col.r, col.hh * 1.1, col.r] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const tx = x + Math.cos(a) * col.r * 0.75, tz = z + Math.sin(a) * col.r * 0.75;
      batch.add(M.sandcastle(), G.cyl8, { p: [tx, base + col.hh * 1.45, tz], s: [col.r * 0.32, col.hh * 0.9, col.r * 0.32] });
      batch.add(M.sandcastle(), G.cone, { p: [tx, base + col.hh * 2.05, tz], s: [col.r * 0.34, col.hh * 0.35, col.r * 0.34] });
    }
    batch.add(M.white(), G.cyl8, { p: [x, base + col.hh * 2.0, z], s: [0.015, col.hh * 1.6, 0.015] });
    batch.add(M.red(), G.box, { p: [x + 0.12, base + col.hh * 2.6, z], s: [0.22, 0.14, 0.01] });
  },
  pot(batch, sc, col) {
    batch.add(M.steel(), G.cyl, { p: col.c, s: [col.r, col.hh * 2, col.r] });
    batch.add(M.steel(), G.cyl, { p: [col.c[0], col.c[1] + col.hh + 0.02, col.c[2]], s: [col.r * 1.03, 0.04, col.r * 1.03] });
    batch.add(M.iron(), G.sphere, { p: [col.c[0], col.c[1] + col.hh + 0.07, col.c[2]], s: [0.06, 0.05, 0.06] });
    for (const s of [-1, 1]) batch.add(M.iron(), G.torus, { p: [col.c[0], col.c[1] + col.hh * 0.6, col.c[2] + s * col.r], r: [0, 0, 0], s: [0.09, 0.09, 0.09] });
  },
  bollard(batch, sc, col) {
    const pts = [new THREE.Vector2(0.17, -col.hh), new THREE.Vector2(0.15, col.hh * 0.4), new THREE.Vector2(0.13, col.hh * 0.7), new THREE.Vector2(0.21, col.hh * 0.85), new THREE.Vector2(0.2, col.hh), new THREE.Vector2(0.0, col.hh + 0.04)];
    batch.add(M.iron(), new THREE.LatheGeometry(pts, 14), { p: col.c });
  },
};

const SPHERE_LOOKS = {
  plain(batch, sc, col) {
    batch.add(M.white(), G.sphere, { p: col.c, s: [col.r, col.r, col.r] });
  },
  beachball(batch, sc, col) {
    const cols = [M.red(), M.white(), M.blue(), M.lemonPaint(), M.red(), M.white()];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.SphereGeometry(col.r, 6, 12, (i / 6) * Math.PI * 2, Math.PI / 3);
      batch.add(cols[i], g, { p: col.c, r: [0.3, 0, 0.2] });
    }
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

function nearPath(path, x, z, r) {
  if (!path) return false;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [cx, cz] = path[i];
    const dx = cx - ax, dz = cz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r) return true;
  }
  return false;
}

export function drawDecor(batch, sc, d, extras) {
  const at = d.at;
  const fn = DECOR[d.look];
  if (fn) fn(batch, sc, d, at, extras);
}

const DECOR = {
  ...HARBOUR_DECOR,
  fountain(batch, sc, d, at) {
    drawFountain(batch, sc, d, at);
  },
  sail(batch, sc, d, at) {
    drawSail(batch, d, at);
  },
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
      if (d.goods === 'flowers') {
        const fm = [M.flowerRed(), M.flowerPink(), M.flowerWhite(), M.flowerPurple(), M.lemon()][Math.floor(r() * 5)];
        sc.add(`fl:${fm.uuid}`, G.ico, fm, [p[0], p[1] + 0.06, p[2]], [r() * 3, r() * 3, 0], [0.06, 0.05, 0.06]);
        if (r() < 0.5) sc.add('leafblob', G.ico, M.foliage(), [p[0], p[1] + 0.02, p[2]], [r() * 3, r() * 3, 0], [0.08, 0.05, 0.08]);
      } else if (kind < 0.55) {
        const { geo, mat } = catchFish();
        sc.add('catch', geo, mat, [p[0], p[1] + 0.02, p[2]], [Math.PI / 2 + (r() - 0.5) * 0.25, r() * Math.PI * 2, 0, 'YXZ'], [1, 1, 1]);
        i++;
      } else if (kind < 0.72) sc.add('lemon', G.sphere, M.lemon(), p, [r() * 3, r() * 3, 0], [0.055, 0.045, 0.045]);
      else if (kind < 0.9) sc.add('shell', G.lowSphere, M.shell(), p, [0, r() * 3, 0.3], [0.05, 0.022, 0.032]);
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
    const c = d.tint === 'blue' ? M.blue() : d.tint === 'red' ? M.red() : M.lemonPaint();
    batch.add(c, G.cyl, { p: [at[0], at[1] + 0.14, at[2]], r: [0, 0.4, Math.PI / 2], s: [0.17, 0.32, 0.17] });
    if (d.tint) {
      const arc = new THREE.TorusGeometry(0.16, 0.012, 4, 12, Math.PI);
      batch.add(M.iron(), arc, { p: [at[0], at[1] + 0.14, at[2]], r: [0, 0.4 + Math.PI / 2, 0] });
    }
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
  // ------------------------------------------------------------ the kitchen
  kwalls(batch, sc, d) {
    // white tiles to shoulder height, plaster above; the harbour side has open windows, the far end one big one
    const H = d.h, T = 0.3;
    const sideWall = (x, sgn, windows) => {
      const segs = [];
      let z = d.z0;
      for (const [a, c] of windows ?? []) {
        segs.push([z, a, false]);
        segs.push([a, c, true]);
        z = c;
      }
      segs.push([z, d.z1, false]);
      for (const [a, c, win] of segs) {
        const len = c - a;
        if (len <= 0) continue;
        const cz = (a + c) / 2;
        const xx = x + sgn * T / 2;
        if (!win) {
          batch.add(M.subway(), tiledBox(T, 1.6, len, 1.2), { p: [xx, 0.8, cz] });
          batch.add(M.warmwall(), G.box, { p: [xx, 1.6 + (H - 1.6) / 2, cz], s: [T, H - 1.6, len] });
        } else {
          batch.add(M.subway(), tiledBox(T, 1.3, len, 1.2), { p: [xx, 0.65, cz] });
          batch.add(M.white(), G.rbox, { p: [xx - sgn * 0.05, 1.33, cz], s: [T + 0.2, 0.08, len] });
          batch.add(M.warmwall(), G.box, { p: [xx, 2.9 + (H - 2.9) / 2, cz], s: [T, H - 2.9, len] });
          batch.add(M.white(), G.box, { p: [xx - sgn * 0.02, 2.9, cz], s: [T + 0.06, 0.1, len] });
          // mullions and open blue shutters
          const n = Math.max(1, Math.round(len / 2));
          for (let i = 0; i <= n; i++) batch.add(M.white(), G.box, { p: [xx, 2.1, a + (len * i) / n], s: [T, 1.5, 0.12] });
          for (let i = 0; i < n; i++) {
            const z0 = a + (len * i) / n, z1 = a + (len * (i + 1)) / n;
            for (const [zz, s2] of [[z0, 1], [z1, -1]]) batch.add(M.blue(), G.box, { p: [x + sgn * (T + 0.05), 2.1, zz + s2 * 0.4], r: [0, s2 * sgn * 0.5, 0], s: [0.04, 1.4, 0.7] });
          }
        }
      }
      batch.add(M.steel(), G.box, { p: [x + sgn * 0.02, 0.06, (d.z0 + d.z1) / 2], s: [0.06, 0.12, d.z1 - d.z0] });
      batch.add(M.bluetile(), G.box, { p: [x + sgn * 0.01, 1.22, (d.z0 + d.z1) / 2], s: [0.04, 0.1, d.z1 - d.z0] });
    };
    sideWall(d.x0, -1, null);
    sideWall(d.x1, 1, d.windows);
    // the near wall (solid) and the far wall around the window over the sink
    batch.add(M.subway(), tiledBox(d.x1 - d.x0, 1.6, T, 1.2), { p: [0, 0.8, d.z0 - T / 2] });
    batch.add(M.warmwall(), G.box, { p: [0, 1.6 + (H - 1.6) / 2, d.z0 - T / 2], s: [d.x1 - d.x0, H - 1.6, T] });
    const [w0, w1] = d.end;
    const zf = d.z1 + T / 2;
    batch.add(M.subway(), tiledBox(d.x1 - d.x0, 1.3, T, 1.2), { p: [0, 0.65, zf] });
    batch.add(M.subway(), tiledBox(w0 - d.x0, 1.6, T, 1.2), { p: [(d.x0 + w0) / 2, 1.3 + 0.8, zf] });
    batch.add(M.subway(), tiledBox(d.x1 - w1, 1.6, T, 1.2), { p: [(w1 + d.x1) / 2, 1.3 + 0.8, zf] });
    batch.add(M.warmwall(), G.box, { p: [(d.x0 + w0) / 2, 2.9 + (H - 2.9) / 2, zf], s: [w0 - d.x0, H - 2.9, T] });
    batch.add(M.warmwall(), G.box, { p: [(w1 + d.x1) / 2, 2.9 + (H - 2.9) / 2, zf], s: [d.x1 - w1, H - 2.9, T] });
    batch.add(M.warmwall(), G.box, { p: [(w0 + w1) / 2, 2.9 + (H - 2.9) / 2, zf], s: [w1 - w0, H - 2.9, T] });
    batch.add(M.white(), G.rbox, { p: [(w0 + w1) / 2, 1.32, zf - 0.08], s: [w1 - w0 + 0.2, 0.08, T + 0.2] });
    for (const x of [w0, (w0 + w1) / 2, w1]) batch.add(M.blue(), G.box, { p: [x, 2.0, zf], s: [0.14, 1.6, T + 0.02] });
    batch.add(M.blue(), G.box, { p: [(w0 + w1) / 2, 2.82, zf], s: [w1 - w0, 0.12, T + 0.02] });
  },
  lintel(batch, sc, d, at) {
    const h = d.h ?? 0.9;
    batch.add(M.warmwall(), G.box, { p: [at[0], at[1], at[2]], s: [d.w, h, 0.3] });
    batch.add(M.blue(), G.box, { p: [at[0], at[1] - h / 2 - 0.02, at[2]], s: [d.w, 0.06, 0.34] });
  },
  beams(batch, sc, d, at) {
    for (let z = d.z0; z <= d.z1; z += d.every) batch.add(M.white(), G.box, { p: [0, at[1], z], s: [d.x1 - d.x0 + 0.6, 0.16, 0.14] });
    for (const x of [d.x0 + 0.1, 0, d.x1 - 0.1]) batch.add(M.white(), G.box, { p: [x, at[1] + 0.12, (d.z0 + d.z1) / 2], s: [0.12, 0.08, d.z1 - d.z0] });
  },
  veg(batch, sc, d, at) {
    const r = rng(d.seed ?? 1);
    const n = Math.round(d.len * (d.sparse ? 1.2 : 3));
    for (let i = 0; i < n; i++) {
      const p = [at[0] + (r() - 0.5) * (d.depth - 0.3), at[1] + 0.04, at[2] + (r() - 0.5) * (d.len - 0.4)];
      const kind = r();
      if (kind < 0.3) sc.add('tomato', G.sphere, M.tomato(), p, [0, r() * 3, 0], [0.06, 0.05, 0.06]);
      else if (kind < 0.5) sc.add('lemon', G.sphere, M.lemon(), p, [r() * 3, r() * 3, 0], [0.055, 0.045, 0.045]);
      else if (kind < 0.7) sc.add('onion', G.sphere, M.onion(), p, [0, r() * 3, 0], [0.065, 0.06, 0.065]);
      else if (kind < 0.85) sc.add('leaf', G.lowSphere, M.leaf(), p, [0, r() * 3, 0], [0.09, 0.03, 0.06]);
      else sc.add('board', G.box, M.counterWood(), [p[0], at[1] + 0.01, p[2]], [0, r() * 3, 0], [0.45, 0.025, 0.3]);
    }
  },
  taps(batch, sc, d, at) {
    const n = d.n ?? 1, gap = d.gap ?? 1;
    for (let i = 0; i < n; i++) {
      const x = at[0] + (i - (n - 1) / 2) * gap;
      const tt = { p: [x, at[1], at[2]], r: [0, d.yaw ?? 0, 0] };
      batch.add(M.steel(), G.cyl8, inFrame(tt, [0, 0.3, 0], [0, 0, 0], [0.04, 0.6, 0.04]));
      const arc = new THREE.TorusGeometry(0.22, 0.035, 6, 12, Math.PI);
      batch.add(M.steel(), arc, inFrame(tt, [0, 0.6, -0.22], [0, Math.PI / 2, 0]));
      batch.add(M.steel(), G.cyl8, inFrame(tt, [0, 0.52, -0.44], [0, 0, 0], [0.045, 0.14, 0.045]));
      for (const s of [-1, 1]) batch.add(i % 2 ? M.blue() : M.red(), G.cyl8, inFrame(tt, [s * 0.12, 0.2, 0], [0, 0, 0], [0.05, 0.06, 0.05]));
    }
  },
  drips(batch, sc, d, at) {
    for (let i = 0; i < 4; i++) sc.add('drip', G.sphere, M.water(), [at[0] - i * 0.12, at[1] - 0.15 - i * 0.18, at[2] + Math.sin(i) * 0.04], [0, 0, 0], [0.025, 0.04, 0.025]);
  },
  pans(batch, sc, d, at) {
    // copper pans on a rail along the wall, above the shelf
    batch.add(M.iron(), G.box, { p: [at[0], at[1] + 0.35, (d.z0 + d.z1) / 2], s: [0.04, 0.04, d.z1 - d.z0] });
    const r = rng(37);
    for (let z = d.z0 + 0.6; z < d.z1; z += 1.1 + r() * 0.7) {
      const rr = 0.18 + r() * 0.12;
      batch.add(M.copper(), G.cyl, { p: [at[0] + 0.05, at[1] - rr * 0.4, z], r: [0, 0, Math.PI / 2], s: [rr, 0.08, rr] });
      batch.add(M.copper(), G.box, { p: [at[0] + 0.05, at[1] + 0.1, z], s: [0.03, 0.4, 0.04] });
    }
  },
  jug(batch, sc, d, at) {
    batch.add(M.blue(), G.cyl, { p: [at[0], at[1] + 0.12, at[2]], r: [Math.PI / 2, 0.3, 0], s: [0.11, 0.3, 0.11] });
  },
  heatlamps(batch, sc, d, at) {
    batch.add(M.steel(), G.box, { p: [at[0], at[1] + 0.25, at[2]], s: [0.5, 0.08, d.len] });
    for (const z of [at[2] - d.len / 2 + 0.2, at[2] + d.len / 2 - 0.2]) batch.add(M.steel(), G.cyl8, { p: [at[0], at[1] / 2 + 0.55, z], s: [0.04, at[1] - 1.0, 0.04] });
    for (let z = at[2] - d.len / 2 + 1; z < at[2] + d.len / 2; z += 2) {
      batch.add(M.red(), G.cyl, { p: [at[0], at[1], z], s: [0.22, 0.32, 0.22] });
      batch.add(M.lamp(), G.cyl, { p: [at[0], at[1] - 0.17, z], s: [0.17, 0.03, 0.17] }, { cast: false });
    }
    // order tickets on a rail
    batch.add(M.steel(), G.box, { p: [at[0] - 0.3, at[1] - 0.5, at[2]], s: [0.04, 0.05, d.len * 0.8] });
    const r = rng(41);
    for (let z = at[2] - d.len * 0.38; z < at[2] + d.len * 0.38; z += 0.5 + r() * 0.5) batch.add(M.white(), G.box, { p: [at[0] - 0.32, at[1] - 0.68, z], r: [0, 0, (r() - 0.5) * 0.15], s: [0.01, 0.3, 0.2] });
  },
  plates(batch, sc, d, at) {
    for (let k = 0; k < d.n; k++)
      for (let i = 0; i < 7; i++) batch.add(M.china(), G.cyl, { p: [at[0] + (k % 2) * 0.35 - 0.15, at[1] + 0.015 + i * 0.03, at[2] + k * 0.4], s: [0.15, 0.022, 0.15] });
  },
  suds(batch, sc, d, at) {
    batch.add(M.water(), G.box, { p: at, s: [d.w, 0.02, d.d] }, { cast: false });
    const r = rng(43);
    for (let i = 0; i < 28; i++) sc.add('suds', G.lowSphere, M.suds(), [at[0] + (r() - 0.5) * d.w * 0.9, at[1] + 0.02, at[2] + (r() - 0.5) * d.d * 0.9], [0, 0, 0], [0.08 + r() * 0.12, 0.05, 0.08 + r() * 0.12]);
  },
  sinkwater(batch, sc, d, at) {
    batch.add(M.water(), G.box, { p: at, s: [d.w, 0.02, d.d] }, { cast: false });
    const r = rng(47);
    for (let i = 0; i < 40; i++) sc.add('suds', G.lowSphere, M.suds(), [at[0] + (r() - 0.5) * d.w * 0.95, at[1] + 0.02, at[2] + (r() - 0.5) * d.d * 0.9], [0, 0, 0], [0.08 + r() * 0.14, 0.05, 0.08 + r() * 0.14]);
  },
  // ------------------------------------------------------------ the park
  mowstripes(batch, sc, d) {
    for (const [z0, z1, y] of d.bands)
      for (let z = z0, i = 0; z < z1; z += d.w, i++) if (i % 2 === 0) batch.add(M.mow(), G.box, { p: [0, y + 0.004, z + Math.min(d.w, z1 - z) / 2], s: [d.x * 2, 0.004, Math.min(d.w, z1 - z)] }, { cast: false });
  },
  trestlelegs(batch, sc, d, at) {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) batch.add(M.crateDark(), G.box, { p: [at[0] + sx * (d.w / 2 - 0.3), at[1] + d.h / 2, at[2] + sz * (d.d / 2 - 0.3)], r: [0, 0, sx * 0.12], s: [0.1, d.h, 0.1] });
  },
  picniclegs(batch, sc, d, at) {
    const tt = { p: at, r: [0, d.yaw ?? 0, 0] };
    for (const sz of [-0.85, 0.85])
      for (const sx of [-1, 1]) batch.add(M.crateDark(), G.box, inFrame(tt, [sx * 0.45, 0.36, sz], [0, 0, sx * 0.45], [0.08, 0.82, 0.1]));
  },
  blanket(batch, sc, d, at) {
    batch.add(M.gingham(), G.box, inFrame({ p: [at[0], at[1] + 0.012, at[2]], r: [0, d.yaw ?? 0, 0] }, [0, 0, 0], [0, 0, 0], [2.0, 0.02, 1.6]));
    batch.add(M.lemonPaint(), G.cyl, inFrame({ p: [at[0], at[1], at[2]], r: [0, d.yaw ?? 0, 0] }, [0.4, 0.15, 0.2], [0, 0, 0], [0.18, 0.3, 0.18]));
    batch.add(M.terracotta(), G.box, inFrame({ p: [at[0], at[1], at[2]], r: [0, d.yaw ?? 0, 0] }, [-0.4, 0.12, -0.2], [0, 0, 0], [0.5, 0.22, 0.35]));
  },
  dogbowl(batch, sc, d, at) {
    const ring = new THREE.TorusGeometry(0.36, 0.07, 6, 24).rotateX(Math.PI / 2);
    batch.add(M.red(), ring, { p: [at[0], at[1] + 0.06, at[2]] });
  },
  can(batch, sc, d, at) {
    batch.add(M.leaf(), G.cyl, { p: [at[0], at[1] + 0.16, at[2]], r: [0, 0.6, Math.PI / 2], s: [0.16, 0.36, 0.16] });
    batch.add(M.leaf(), G.cyl8, { p: [at[0] - 0.3, at[1] + 0.2, at[2] + 0.2], r: [0.9, 0.6, 0], s: [0.03, 0.4, 0.03] });
  },
  chute(batch, sc, d, at) {
    // a wooden boules shed at the end of each lane
    batch.add(M.planks(), G.box, { p: [at[0], at[1] + 0.8, at[2]], s: [1.4, 1.6, 1.6] });
    batch.add(M.red(), G.box, { p: [at[0], at[1] + 1.65, at[2]], r: [0, 0, 0], s: [1.6, 0.12, 1.9] });
    batch.add(M.slate(), G.box, { p: [at[0] + d.dir * 0.71, at[1] + 0.4, at[2]], s: [0.02, 0.8, 0.9] });
  },
  bench(batch, sc, d, at) {
    const tt = { p: at, r: [0, d.yaw ?? 0, 0] };
    batch.add(M.blueDeep(), G.box, inFrame(tt, [0, 0.45, 0], [0, 0, 0], [1.8, 0.06, 0.5]));
    batch.add(M.blueDeep(), G.box, inFrame(tt, [0, 0.8, -0.24], [0.2, 0, 0], [1.8, 0.4, 0.05]));
    for (const sx of [-1, 1]) batch.add(M.iron(), G.box, inFrame(tt, [sx * 0.8, 0.23, 0], [0, 0, 0], [0.06, 0.46, 0.5]));
  },
  fountainjet(batch, sc, d, at) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      for (let k = 1; k < 7; k++) {
        const u = k / 7;
        sc.add('jet', G.sphere, M.water(), [at[0] + Math.cos(a) * u * 1.6, at[1] + Math.sin(u * Math.PI) * 0.6 - u * 1.1, at[2] + Math.sin(a) * u * 1.6], [0, 0, 0], [0.05, 0.08, 0.05]);
      }
    }
    batch.add(M.water(), G.cyl, { p: [at[0], at[1] + 0.35, at[2]], s: [0.06, 0.7, 0.06] }, { cast: false });
  },
  railposts(batch, sc, d, at) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const z = d.z0 + (d.z1 - d.z0) * u;
      const top = d.top0 + (d.top1 - d.top0) * u;
      const ground = 4 - 0.25 * Math.max(0, Math.min(10, Math.ceil(z - 104)));
      batch.add(M.brass(), G.cyl8, { p: [at[0], (top + ground) / 2, z], s: [0.03, top - ground, 0.03] });
    }
  },
  trees(batch, sc, d) {
    const r = rng(d.seed ?? 1);
    for (let i = 0; i < d.n; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const x = side * (d.xin + r() * (d.xout - d.xin));
      const z = d.z0 + r() * (d.z1 - d.z0);
      const y = z < 45 ? 6 : z < 104 ? 4 : 1.5;
      CYL_LOOKS.tree(batch, sc, { c: [x, y + 1.6 + r(), z], r: 0.3, hh: 1.6 + r() });
    }
  },
  town(batch, sc, d) {
    houses(batch, sc, [-14, d.z0], [-14, d.z1], -1, 91, 0.6, 0.9);
    houses(batch, sc, [14, d.z0], [14, d.z1], 1, 93, 0.6, 0.9);
  },
  bandstand(batch, sc, d, at) {
    const [x, y, z] = at;
    batch.add(M.white(), G.cyl, { p: [x, y + 0.3, z], s: [4, 0.6, 4] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      batch.add(M.white(), G.cyl8, { p: [x + Math.cos(a) * 3.6, y + 2.2, z + Math.sin(a) * 3.6], s: [0.1, 3.2, 0.1] });
    }
    batch.add(M.red(), new THREE.ConeGeometry(4.6, 1.6, 8), { p: [x, y + 4.6, z] });
    batch.add(M.lemonPaint(), G.sphere, { p: [x, y + 5.5, z], s: [0.25, 0.25, 0.25] });
  },
  // ------------------------------------------------------------ the beach
  seawall(batch, sc, d, at) {
    batch.add(M.quayside(), G.box, { p: [(d.x0 + d.x1) / 2, at[1] / 2 - 0.5, at[2] - 0.15], s: [d.x1 - d.x0, at[1] + 1, 0.3] });
    batch.add(M.white(), G.rbox, { p: [(d.x0 + d.x1) / 2, at[1] + 0.02, at[2] - 0.2], s: [d.x1 - d.x0, 0.1, 0.45] });
    for (let x = d.x0; x < d.x1; x += 2.5) batch.add(M.iron(), G.box, { p: [x, at[1] + 0.55, at[2] - 0.3], s: [0.05, 1.0, 0.05] });
    batch.add(M.white(), G.box, { p: [(d.x0 + d.x1) / 2, at[1] + 1.05, at[2] - 0.3], s: [d.x1 - d.x0, 0.06, 0.08] });
  },
  huts(batch, sc, d, at) {
    // a row of beach huts in every colour, gable roofs, striped doors
    const cols = [M.red(), M.lemonPaint(), M.blue(), M.white(), M.coral(), M.leaf()];
    const r = rng(53);
    for (let x = d.x0, i = 0; x < d.x1; x += 3.4, i++) {
      if (Math.abs(x) < 3) continue;
      const c = cols[i % cols.length];
      const h = 2.6;
      batch.add(c, G.box, { p: [x, at[1] + h / 2, at[2]], s: [2.6, h, 2.6] });
      const roof = new THREE.CylinderGeometry(0.01, 1.9, 1.0, 4, 1);
      batch.add(M.white(), roof, { p: [x, at[1] + h + 0.45, at[2]], r: [0, Math.PI / 4, 0], s: [1, 1, 1] });
      batch.add(i % 2 ? M.white() : M.blueDeep(), G.box, { p: [x, at[1] + 1.05, at[2] + 1.31], s: [1.1, 2.0, 0.04] });
      batch.add(M.white(), G.box, { p: [x, at[1] + 2.15, at[2] + 1.33], s: [1.3, 0.12, 0.06] });
      if (r() < 0.5) batch.add(M.white(), G.box, { p: [x - 0.75, at[1] + 0.45, at[2] + 1.6], s: [0.5, 0.06, 0.4] });
    }
  },
  lamps(batch, sc, d, at) {
    for (let x = d.x0; x <= d.x1; x += d.every) {
      if (Math.abs(x) < (d.skip ?? 3)) continue;
      batch.add(M.blueDeep(), G.cyl8, { p: [x, at[1] + 1.9, at[2]], s: [0.06, 3.8, 0.06] });
      batch.add(M.blueDeep(), G.box, { p: [x, at[1] + 3.8, at[2] + 0.25], s: [0.06, 0.06, 0.5] });
      batch.add(M.lamp(), G.sphere, { p: [x, at[1] + 3.65, at[2] + 0.5], s: [0.16, 0.2, 0.16] });
    }
  },
  rods(batch, sc, d, at) {
    for (let i = 0; i < 2; i++) batch.add(M.iron(), G.cyl8, { p: [at[0] + i * 0.4, at[1] + 1.6, at[2]], r: [0.25, 0, -0.2 + i * 0.3], s: [0.02, 3.2, 0.02] });
    batch.add(M.lemonPaint(), G.box, { p: [at[0] + 0.6, at[1] + 0.2, at[2] - 0.2], s: [0.6, 0.4, 0.4] });
  },
  marram(batch, sc, d) {
    const r = rng(d.seed ?? 1);
    for (let i = 0; i < d.n; i++) {
      const x = d.x0 + r() * (d.x1 - d.x0), z = d.z0 + r() * (d.z1 - d.z0);
      if (nearPath(d.avoid, x, z, 1.8)) continue;
      for (let k = 0; k < 7; k++) sc.add('marram', G.cone, M.dune(), [x + (r() - 0.5) * 0.5, 0.25, z + (r() - 0.5) * 0.5], [(r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5], [0.04, 0.55 + r() * 0.3, 0.04]);
    }
  },
  crowd(batch, sc, d) {
    // the rest of the beach, out of reach beyond the groynes: parasols, towels, windbreaks
    const r = rng(d.seed ?? 1);
    const tints = ['red', 'blue', 'lemon'];
    for (let i = 0; i < d.n; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const x = side * (d.xin + r() * (d.xout - d.xin));
      const z = d.z0 + r() * (d.z1 - d.z0);
      const tint = tints[Math.floor(r() * 3)];
      const k = r();
      if (k < 0.5) {
        CYL_LOOKS.pole(batch, sc, { c: [x, 1.05, z], hh: 1.05 });
        CYL_LOOKS.umbrella(batch, sc, { c: [x, 2.14, z], r: 1.1, hh: 0.04, tint });
        DECOR.towel(batch, sc, { tint: tints[(i + 1) % 3], yaw: r() - 0.5 }, [x + 0.6, 0, z + 1.2]);
      } else if (k < 0.75) DECOR.towel(batch, sc, { tint, yaw: r() - 0.5 }, [x, 0, z]);
      else BOX_LOOKS.windbreak(batch, sc, 0.12, 1.2, 3.5, { p: [x, 0.6, z], r: [0, r() * 0.6, 0] });
    }
  },
  towel(batch, sc, d, at) {
    const c = d.tint === 'blue' ? M.blue() : d.tint === 'lemon' ? M.lemonPaint() : M.red();
    const tt = { p: [at[0], at[1] + 0.012, at[2]], r: [0, d.yaw ?? 0, 0] };
    batch.add(M.white(), G.box, inFrame(tt, [0, 0, 0], [0, 0, 0], [0.95, 0.02, 1.9]));
    for (let i = 0; i < 4; i++) batch.add(c, G.box, inFrame(tt, [0, 0.006, -0.72 + i * 0.48], [0, 0, 0], [0.96, 0.02, 0.22]));
  },
  rocks(batch, sc, d, at) {
    const r = rng(d.seed ?? 1);
    const n = Math.round(d.r * 9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.3;
      const rr = d.r + 0.1 + r() * 0.25;
      const s = 0.18 + r() * 0.22;
      batch.add(M.rock(), G.lowSphere, { p: [at[0] + Math.cos(a) * rr, at[1] + s * 0.25, at[2] + Math.sin(a) * rr], r: [r(), r() * 3, 0], s: [s * 1.3, s * 0.7, s] });
    }
    for (let i = 0; i < 3; i++) sc.add('starfish', G.lowSphere, M.coral(), [at[0] + (r() - 0.5) * d.r, at[1] + 0.02, at[2] + (r() - 0.5) * d.r], [0, r() * 3, 0], [0.08, 0.02, 0.08]);
  },
  tower(batch, sc, d, at) {
    // the lifeguard tower: white legs, a red and lemon hut on the right of the deck (the left is the run-up), a flag
    const [x, y, z] = at;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) batch.add(M.white(), G.box, { p: [x + sx * (d.w / 2 - 0.1), y / 2 - 0.1, z + sz * (d.d / 2 - 0.1)], s: [0.14, y, 0.14] });
    batch.add(M.white(), G.box, { p: [x, y * 0.45, z], s: [d.w - 0.2, 0.08, 0.08], r: [0, 0, 0.9] });
    const hx = x + d.hut[0], hz = z + d.hut[1], hw = d.hut[2], hd = d.hut[3];
    batch.add(M.red(), G.box, { p: [hx, y + 0.9, hz], s: [hw, 1.8, hd] });
    batch.add(M.lemonPaint(), G.box, { p: [hx - 0.05, y + 1.86, hz], s: [hw + 0.4, 0.12, hd + 0.4] });
    batch.add(M.window(), G.box, { p: [hx, y + 1.2, hz + hd / 2 + 0.01], s: [hw * 0.7, 0.6, 0.02] });
    batch.add(M.window(), G.box, { p: [hx - hw / 2 - 0.01, y + 1.2, hz], s: [0.02, 0.6, hd * 0.6] });
    batch.add(M.white(), G.box, { p: [x - d.w / 2 + 0.05, y + 0.45, z - 0.3], s: [0.06, 0.06, d.d - 1.2] });
    batch.add(M.white(), G.cyl8, { p: [hx + hw / 2, y + 2.6, hz + hd / 2], s: [0.03, 2.4, 0.03] });
    batch.add(M.red(), G.box, { p: [hx + hw / 2 + 0.35, y + 3.5, hz + hd / 2], s: [0.7, 0.25, 0.02] });
    batch.add(M.lemonPaint(), G.box, { p: [hx + hw / 2 + 0.35, y + 3.25, hz + hd / 2], s: [0.7, 0.25, 0.02] });
  },
  gullpost(batch, sc, d, at) {
    batch.add(M.driftwood(), G.cyl8, { p: [at[0], at[1] + 0.9, at[2]], s: [0.14, 1.8, 0.14] });
    batch.add(M.lemonPaint(), G.cyl8, { p: [at[0], at[1] + 1.82, at[2]], s: [0.16, 0.06, 0.16] });
  },
  seaweed(batch, sc, d) {
    const r = rng(d.seed ?? 1);
    for (let i = 0; i < d.n; i++) {
      const x = d.x0 + r() * (d.x1 - d.x0), z = d.z0 + r() * (d.z1 - d.z0);
      for (let k = 0; k < 5; k++) sc.add('weed', G.lowSphere, M.weed(), [x + (r() - 0.5) * 1.2, 0.01, z + (r() - 0.5) * 0.4], [0, r() * 3, 0], [0.25 + r() * 0.2, 0.02, 0.06]);
      if (r() < 0.6) sc.add('shell2', G.lowSphere, M.china(), [x + (r() - 0.5) * 2, 0.02, z + (r() - 0.5) * 2], [0, r() * 3, 0], [0.05, 0.025, 0.04]);
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
