// The harbour end of the market: plastic fish boxes with the catch on ice, tarps (springboards), the fish belt's frame,
// a fishing boat up on its blocks with its wheelhouse and hatch, a gangplank, lobster pots, the auction's podium and the
// big weighing scale's gantry, rope, baskets and a wall tap. Static pieces go into the course batch; the many small
// copies (fish, lemons) into the scatter.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M } from './materials.js';
import { G, rng } from './geo.js';
import { signMat, pottedPlant } from './town.js';

const Q0 = new THREE.Quaternion();

/** A matrix for a collider's frame (t: { p, r } with r = [pitch, yaw, 0], YXZ) then a local box. */
function frame(t, local = [0, 0, 0], size = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...t.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(t.r[0], t.r[1], t.r[2] ?? 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const l = new THREE.Matrix4().compose(new THREE.Vector3(...local), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(...size));
  return m.multiply(l);
}
const at = (t, local) => new THREE.Vector3(...local).applyMatrix4(frame(t));

// ---------------------------------------------------------------- the catch: a fish to lay on ice (instanced)

let fishGeo = null;
let fishMat = null;
/** A small mackerel, 0.34 m nose to tail along +x, flattened side to side. */
export function catchFish() {
  if (fishGeo) return { geo: fishGeo, mat: fishMat };
  const prof = [];
  const L = 0.27;
  for (let i = 0; i <= 12; i++) {
    const v = i / 12;
    // fat behind the head, thin at the tail stalk
    const r = Math.sin(Math.PI * Math.pow(v, 0.8)) * 0.042 * (1 - v * 0.55) + 0.004;
    prof.push(new THREE.Vector2(r, v * L - L / 2));
  }
  const body = new THREE.LatheGeometry(prof, 10);
  body.rotateZ(-Math.PI / 2);
  body.scale(1, 1, 0.55);
  // the tail: a forked fin at -x
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(-0.075, 0.05);
  s.lineTo(-0.055, 0);
  s.lineTo(-0.075, -0.05);
  s.lineTo(0, 0);
  const tail = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false });
  tail.translate(-L / 2 + 0.01, 0, -0.003);
  const tailUv = tail.attributes.uv;
  for (let i = 0; i < tailUv.count; i++) tailUv.setXY(i, 0.5, 0.05);
  const b = body.toNonIndexed();
  const tt = tail.toNonIndexed();
  for (const g of [b, tt]) for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
  fishGeo = mergeGeometries([b, tt]);
  fishGeo.computeVertexNormals();
  // mackerel skin: a dark wavy back over a silver belly (the lathe's u goes round the body; its top is near u 0.75)
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 128, 0);
  grd.addColorStop(0, '#dfe8ec');
  grd.addColorStop(0.5, '#eef3f5');
  grd.addColorStop(0.62, '#7a96a4');
  grd.addColorStop(0.75, '#1f3e52');
  grd.addColorStop(0.88, '#7a96a4');
  grd.addColorStop(1, '#dfe8ec');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#10222e';
  g.lineWidth = 2.2;
  for (let k = 0; k < 9; k++) {
    g.beginPath();
    const y0 = 6 + k * 6.5;
    for (let x = 80; x <= 112; x += 2) g.lineTo(x, y0 + Math.sin(x * 0.35 + k) * 2.2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  fishMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.55, envMapIntensity: 1.6 });
  return { geo: fishGeo, mat: fishMat };
}

/** Lay `n` fish on ice at local (cx, y, 0) of frame t, inside w×d, heads all ways, a few on top of others. */
function layFish(sc, t, cx, y, w, d, n, r) {
  const { geo, mat } = catchFish();
  for (let i = 0; i < n; i++) {
    const p = at(t, [cx + (r() - 0.5) * Math.max(0.05, w - 0.3), y + 0.025 + (i > n * 0.6 ? 0.035 : 0), (r() - 0.5) * Math.max(0.05, d - 0.3)]);
    const yaw = t.r[1] + r() * Math.PI * 2;
    sc.add('catch', geo, mat, [p.x, p.y, p.z], [Math.PI / 2 + (r() - 0.5) * 0.25, yaw, (r() - 0.5) * 0.2, 'YXZ'], [1, 1, 1]);
  }
}

// ---------------------------------------------------------------- fish boxes

const PLASTIC = () => [M.plasticBlue(), M.plasticRed(), M.plasticWhite(), M.plasticGreen(), M.plasticOrange()];

/** One open plastic fish box: a floor, four walls with a lip, hand-holds in the short ends. */
function fishBox(batch, t, cx, cy, cz, w, h, d, mat, yaw = 0) {
  const th = 0.035;
  const put = (p, s) => batch.add(mat, G.box, frame(t, [cx + p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), cy + p[1], cz - p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)], s, [0, yaw, 0]));
  put([0, -h / 2 + th / 2, 0], [w, th, d]);
  put([0, 0, d / 2 - th / 2], [w, h, th]);
  put([0, 0, -d / 2 + th / 2], [w, h, th]);
  put([w / 2 - th / 2, 0, 0], [th, h, d - th * 2]);
  put([-w / 2 + th / 2, 0, 0], [th, h, d - th * 2]);
  // the lip and the ribs on the outside
  put([0, h / 2 - 0.015, d / 2 + 0.01], [w + 0.03, 0.03, 0.03]);
  put([0, h / 2 - 0.015, -d / 2 - 0.01], [w + 0.03, 0.03, 0.03]);
  put([w / 2 + 0.01, h / 2 - 0.015, 0], [0.03, 0.03, d]);
  put([-w / 2 - 0.01, h / 2 - 0.015, 0], [0.03, 0.03, d]);
  for (const sx of [-0.33, 0, 0.33]) put([sx * w, -0.02, d / 2 + 0.012], [0.025, h - 0.06, 0.02]);
  for (const sx of [-0.33, 0, 0.33]) put([sx * w, -0.02, -d / 2 - 0.012], [0.025, h - 0.06, 0.02]);
  // hand-holds: dark slots in the short ends
  for (const s of [-1, 1]) batch.add(M.dark(), G.box, frame(t, [cx + s * (w / 2 + 0.003) * Math.cos(yaw), cy + h * 0.22, cz - s * (w / 2 + 0.003) * Math.sin(yaw)], [0.012, 0.05, Math.min(0.24, d * 0.3)], [0, yaw, 0]));
}

/** A stack of fish boxes filling a collider: layers ~0.3 m, a little askew, the top one full of fish on ice. */
function fishBoxes(batch, sc, w, h, d, t) {
  const r = rng(Math.round(t.p[0] * 31 + t.p[2] * 17));
  const layers = Math.max(1, Math.round(h / 0.3));
  const lh = h / layers;
  const cols = PLASTIC();
  const base = Math.floor(r() * cols.length);
  // two side by side when the stack is wide
  const split = w > 1.25 ? 2 : 1;
  const bw = w / split;
  for (let sx = 0; sx < split; sx++) {
    const cx = -w / 2 + bw * (sx + 0.5);
    for (let i = 0; i < layers; i++) {
      const mat = cols[(base + sx * 2 + (r() < 0.75 ? 0 : 1 + Math.floor(r() * 3))) % cols.length];
      const cy = -h / 2 + lh * (i + 0.5);
      const skew = (r() - 0.5) * 0.08;
      fishBox(batch, t, cx + (r() - 0.5) * 0.04, cy, (r() - 0.5) * 0.04, bw - 0.03, lh - 0.005, d - 0.02, mat, skew);
      if (i === layers - 1) {
        // ice to the brim and the catch on it
        batch.add(M.ice(), G.box, frame(t, [cx, cy + lh / 2 - 0.06, 0], [bw - 0.1, 0.05, d - 0.1]));
        layFish(sc, t, cx, cy + lh / 2 - 0.035, bw, d, Math.round(bw * d * 9), r);
      }
    }
  }
}

// ---------------------------------------------------------------- tarps and the hatch (springboards)

function tarpMat(tint) {
  return tint === 'red' ? M.tarpRed() : tint === 'green' ? M.tarpGreen() : M.tarpBlue();
}

/** A canvas stretched taut over something: a slightly domed top, skirts hanging down, rope ties and brass eyelets. */
function tarpCover(batch, t, w, d, topY, skirt, mat) {
  const g = new THREE.PlaneGeometry(w + 0.08, d + 0.08, 6, 6);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / ((w + 0.08) / 2), v = p.getZ(i) / ((d + 0.08) / 2);
    p.setY(i, (1 - u * u) * (1 - v * v) * 0.05);
  }
  g.computeVertexNormals();
  batch.add(mat, g, frame(t, [0, topY + 0.005, 0]));
  // skirts, flaring out a little
  for (const [sx, sz, len, rotY] of [[0, 1, w, 0], [0, -1, w, Math.PI], [1, 0, d, Math.PI / 2], [-1, 0, d, -Math.PI / 2]]) {
    const off = sx ? (w + 0.08) / 2 : (d + 0.08) / 2;
    batch.add(mat, G.box, frame(t, [sx * off, topY - skirt / 2, sz * off], [len + 0.08, skirt, 0.012], [0.12, rotY, 0]));
    // rope ties down from the skirt's corners
    for (const k of [-0.42, 0.42]) {
      const lx = sx ? sx * (off + 0.02) : k * len, lz = sz ? sz * (off + 0.02) : k * len;
      batch.add(M.rope(), G.cyl8, frame(t, [lx, topY - skirt - 0.12, lz], [0.012, 0.24, 0.012]));
      batch.add(M.brass(), G.sphere, frame(t, [lx, topY - skirt + 0.03, lz], [0.018, 0.018, 0.018]));
    }
  }
}

export const HARBOUR_BOX_LOOKS = {
  fishboxes(batch, sc, w, h, d, t) {
    fishBoxes(batch, sc, w, h, d, t);
  },
  tarp(batch, sc, w, h, d, t, col) {
    tarpCover(batch, t, w, d, h / 2, 0.22, tarpMat(col.tint));
  },
  hatch(batch, sc, w, h, d, t, col) {
    // a wooden coaming, the tarp lashed over it
    batch.add(M.crateDark(), G.box, frame(t, [0, -0.05, 0], [w - 0.12, h - 0.1, d - 0.12]));
    batch.add(M.hullWhite(), G.box, frame(t, [0, -h / 2 + 0.06, 0], [w, 0.12, d]));
    tarpCover(batch, t, w - 0.1, d - 0.1, h / 2, h - 0.12, tarpMat(col.tint));
  },
  belt(batch, sc, w, h, d, t) {
    // the conveyor's body under its moving belt: side rails, a skirt, rollers at both ends
    batch.add(M.iron(), G.box, frame(t, [0, -0.04, 0], [w - 0.06, h - 0.08, d]));
    for (const s of [-1, 1]) {
      batch.add(M.steel(), G.box, frame(t, [s * (w / 2 - 0.02), 0.01, 0], [0.07, h + 0.02, d + 0.04]));
      batch.add(M.steel(), G.rbox, frame(t, [s * (w / 2 - 0.02), h / 2 + 0.03, 0], [0.09, 0.05, d + 0.06]));
      // bolts down the rails
      for (let z = -d / 2 + 0.4; z < d / 2; z += 0.8) batch.add(M.iron(), G.cyl8, frame(t, [s * (w / 2 + 0.02), 0.1, z], [0.025, 0.02, 0.025], [0, 0, Math.PI / 2]));
    }
    for (const s of [-1, 1]) {
      batch.add(M.rubber(), G.cyl, frame(t, [0, h / 2 - 0.12, s * (d / 2 - 0.02)], [0.13, w - 0.1, 0.13], [0, 0, Math.PI / 2]));
      batch.add(M.yellowSteel(), G.box, frame(t, [s === 1 ? w / 2 + 0.18 : 0, -h / 2 + 0.25, s * (d / 2 - 0.3)], [s === 1 ? 0.3 : 0.01, 0.4, 0.45]));
    }
    // the hazard stripes on the ends
    batch.add(M.yellowSteel(), G.box, frame(t, [0, h / 2 - 0.2, d / 2 + 0.01], [w - 0.1, 0.12, 0.02]));
  },
  boathull(batch, sc, w, h, d, t) {
    drawHull(batch, sc, w, h, d, t);
  },
  wheelhouse(batch, sc, w, h, d, t) {
    drawWheelhouse(batch, sc, w, h, d, t);
  },
  plank(batch, sc, w, h, d, t) {
    batch.add(M.driftwood(), G.box, frame(t, [0, 0, 0], [w, h, d]));
    // cleats across it for grip
    for (let z = -d / 2 + 0.25; z < d / 2 - 0.1; z += 0.34) batch.add(M.crateDark(), G.box, frame(t, [0, h / 2 + 0.015, z], [w - 0.06, 0.03, 0.05]));
  },
  lobsterpots(batch, sc, w, h, d, t) {
    const r = rng(Math.round(t.p[2] * 13));
    const rows = Math.max(1, Math.round(h / 0.45));
    const ph = h / rows;
    const cols = Math.max(1, Math.round(w / 0.7));
    const pw = w / cols;
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        const cx = -w / 2 + pw * (j + 0.5) + (r() - 0.5) * 0.06, cy = -h / 2 + ph * i, cz = (r() - 0.5) * 0.08;
        creel(batch, t, cx, cy, cz, pw - 0.04, ph - 0.02, d - 0.06, r);
      }
    // a buoy and a coil of rope on top
    batch.add(r() < 0.5 ? M.plasticOrange() : M.plasticRed(), G.sphere, frame(t, [w * 0.25, h / 2 + 0.13, 0], [0.14, 0.14, 0.14]));
    batch.add(M.rope(), new THREE.TorusGeometry(0.16, 0.035, 6, 16), frame(t, [-w * 0.2, h / 2 + 0.035, 0.1], [1, 1, 1], [Math.PI / 2, 0, 0]));
  },
};

/** A lobster creel: a flat wooden base, hoops of cane over it, netting stretched over the hoops. */
function creel(batch, t, cx, cy, cz, w, h, d, r) {
  batch.add(M.crateDark(), G.box, frame(t, [cx, cy + 0.03, cz], [w, 0.05, d]));
  const R = Math.min(w / 2, h - 0.05);
  const net = new THREE.CylinderGeometry(R, R, d - 0.04, 12, 1, true, -Math.PI / 2, Math.PI);
  batch.add(M.net(), net, frame(t, [cx, cy + 0.055, cz], [w / 2 / R, 1, 1], [Math.PI / 2, 0, 0]));
  for (const k of [-0.42, 0, 0.42]) {
    const hoop = new THREE.TorusGeometry(R, 0.016, 4, 12, Math.PI);
    batch.add(M.crate(), hoop, frame(t, [cx, cy + 0.055, cz + k * d], [w / 2 / R, 1, 1]));
  }
  // the entrance funnel on one end
  batch.add(M.net(), G.cone, frame(t, [cx, cy + R * 0.5, cz + d / 2 - 0.08], [R * 0.35, 0.18, R * 0.35], [-Math.PI / 2, 0, 0]));
}

// ---------------------------------------------------------------- the boat

/** A wooden fishing boat on blocks, filling a box collider: the hull narrows to a raked bow at +z; flat transom at -z. */
function drawHull(batch, sc, w, h, d, t) {
  const hw = w / 2;
  const deckY = h / 2;
  const keelY = -h / 2 + 0.18; // up on its blocks
  const bowStart = d / 2 - 3.2;
  const taper = (z) => (z <= bowStart ? 1 : Math.max(0.03, Math.sqrt(Math.max(0, 1 - ((z - bowStart) / (d / 2 - bowStart)) ** 2))));
  const sheer = (z) => (z <= bowStart ? 0 : 0.35 * ((z - bowStart) / (d / 2 - bowStart)) ** 2);
  // a cross-section from the gunwale down to the keel, extruded along z, then the bow drawn in
  const section = (yTop, yBot) => {
    const s = new THREE.Shape();
    const pts = [
      [hw, deckY],
      [hw * 0.98, deckY - 0.45],
      [hw * 0.82, deckY - 0.85],
      [hw * 0.45, keelY + 0.1],
      [0, keelY],
    ];
    // keep the part between yTop and yBot (each side), clipped by y
    const clip = (y) => Math.min(yTop, Math.max(yBot, y));
    const side = pts.map(([x, y]) => [x, clip(y)]);
    s.moveTo(-side[0][0], side[0][1]);
    for (const [x, y] of side) s.lineTo(-x, y);
    for (let i = side.length - 1; i >= 0; i--) s.lineTo(side[i][0], side[i][1]);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, steps: 24, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), y = p.getY(i);
      const k = taper(z);
      // the bow narrows (more at the keel) and its top rises
      const kk = k + (1 - k) * Math.max(0, (y - keelY) / (deckY - keelY)) * 0.1;
      p.setX(i, p.getX(i) * kk);
      p.setY(i, y + sheer(z) * ((y - keelY) / (deckY - keelY)));
    }
    g.computeVertexNormals();
    return g;
  };
  const water = deckY - 0.75;
  batch.add(M.hullRed(), section(water, keelY - 0.01), frame(t));
  batch.add(M.hullWhite(), section(water + 0.09, water), frame(t));
  batch.add(M.hullBlue(), section(deckY - 0.08, water + 0.09), frame(t));
  batch.add(M.hullWhite(), section(deckY + 0.02, deckY - 0.08), frame(t));
  // the deck: planks inside the gunwale, a capping rail round it
  const deck = new THREE.Shape();
  const N = 16;
  const outline = [];
  for (let i = 0; i <= N; i++) {
    const z = -d / 2 + (d * i) / N;
    outline.push([hw * taper(z) - 0.08, z]);
  }
  deck.moveTo(-outline[0][0], outline[0][1]);
  for (const [x, z] of outline) deck.lineTo(-Math.max(0.02, x), z);
  for (let i = outline.length - 1; i >= 0; i--) deck.lineTo(Math.max(0.02, outline[i][0]), outline[i][1]);
  const dg = new THREE.ExtrudeGeometry(deck, { depth: 0.04, bevelEnabled: false });
  dg.rotateX(Math.PI / 2);
  dg.scale(1, 1, -1);
  batch.add(M.planks(), dg, frame(t, [0, deckY + 0.04, 0]));
  for (let i = 0; i < N; i++) {
    const z0 = -d / 2 + (d * i) / N, z1 = -d / 2 + (d * (i + 1)) / N;
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(s * hw * taper(z0), deckY + 0.08 + sheer(z0), z0), b = new THREE.Vector3(s * hw * taper(z1), deckY + 0.08 + sheer(z1), z1);
      const len = a.distanceTo(b);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const pitch = -Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
      batch.add(M.hullWhite(), G.box, frame(t, mid.toArray(), [0.1, 0.12, len + 0.02], [pitch, yaw, 0]));
    }
  }
  // the transom and its name board
  batch.add(M.hullBlue(), G.box, frame(t, [0, deckY - 0.45, -d / 2 - 0.02], [w - 0.12, 0.85, 0.04]));
  const name = signMat('MARIE-LOU', '#1d5b9a', '#f6e7c8');
  batch.add(name, G.box, frame(t, [0, deckY - 0.25, -d / 2 - 0.05], [1.4, 0.35, 0.01]));
  // the name and number up at the bow, both sides
  const num = signMat('CC 214', '#1d5b9a', '#f6e7c8');
  for (const s of [-1, 1]) {
    const z = d / 2 - 2.6;
    batch.add(num, G.box, frame(t, [s * (hw * taper(z) + 0.015), deckY - 0.3 + sheer(z), z], [0.01, 0.26, 1.05], [0, 0, 0]));
  }
  // a fender or two, the keel blocks and the props that hold it up
  for (const z of [-2, 2]) for (const s of [-1, 1]) batch.add(M.plasticWhite(), G.cyl, frame(t, [s * (hw + 0.1), deckY - 0.35, z], [0.1, 0.4, 0.1]));
  for (const z of [-d / 2 + 1.2, 0, d / 2 - 2.2]) batch.add(M.crateDark(), G.box, frame(t, [0, -h / 2 + 0.09, z], [0.9, 0.18, 0.4]));
  for (const z of [-d / 2 + 2.5, d / 2 - 3.5])
    for (const s of [-1, 1]) {
      batch.add(M.iron(), G.cyl8, frame(t, [s * (hw + 0.25), -h / 2 + 0.35, z], [0.035, 0.85, 0.035], [0, 0, s * 0.5]));
      batch.add(M.iron(), G.box, frame(t, [s * (hw + 0.42), -h / 2 + 0.02, z], [0.25, 0.04, 0.25]));
    }
  // a stem post at the bow, a cleat and a coil of rope on deck
  batch.add(M.hullWhite(), G.box, frame(t, [0, deckY + 0.05 + sheer(d / 2 - 0.05), d / 2 - 0.08], [0.1, 0.35, 0.14]));
  batch.add(M.rope(), new THREE.TorusGeometry(0.22, 0.045, 6, 18), frame(t, [hw * 0.45, deckY + 0.08, d / 2 - 3.3], [1, 1, 1], [Math.PI / 2, 0, 0]));
}

/** The wheelhouse: a white cabin with windows all round, a door at the back, a roof with a mast, a lifebuoy. */
function drawWheelhouse(batch, sc, w, h, d, t) {
  batch.add(M.hullWhite(), G.box, frame(t, [0, 0, 0], [w - 0.04, h, d - 0.04]));
  batch.add(M.hullBlue(), G.box, frame(t, [0, -h / 2 + 0.06, 0], [w, 0.12, d]));
  batch.add(M.hullWhite(), G.rbox, frame(t, [0, h / 2 + 0.04, 0.05], [w + 0.2, 0.08, d + 0.3]));
  // windows: three forward (raked a little), two each side
  for (const k of [-0.33, 0, 0.33]) batch.add(M.glass(), G.box, frame(t, [k * w, 0.12, d / 2 - 0.005], [w * 0.28, h * 0.42, 0.02], [-0.12, 0, 0]));
  for (const s of [-1, 1]) for (const k of [-0.22, 0.22]) batch.add(M.glass(), G.box, frame(t, [s * (w / 2 - 0.015), 0.12, k * d], [0.02, h * 0.38, d * 0.3]));
  batch.add(M.hullBlue(), G.box, frame(t, [w * 0.2, -0.08, -d / 2 + 0.005], [0.5, h * 0.82, 0.02]));
  batch.add(M.brass(), G.sphere, frame(t, [w * 0.2 + 0.18, -0.05, -d / 2 - 0.02], [0.03, 0.03, 0.03]));
  // the lifebuoy on the side
  const buoy = new THREE.TorusGeometry(0.2, 0.06, 8, 20);
  batch.add(M.red(), buoy, frame(t, [w / 2 + 0.06, -0.05, -d * 0.15], [1, 1, 1], [0, Math.PI / 2, 0]));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    batch.add(M.white(), G.box, frame(t, [w / 2 + 0.06, -0.05 + Math.sin(a) * 0.2, -d * 0.15 + Math.cos(a) * 0.2], [0.05, 0.13, 0.13], [a, 0, 0]));
  }
  // the mast with its lights and a radar bar
  batch.add(M.pipe(), G.cyl8, frame(t, [0, h / 2 + 0.75, -0.2], [0.04, 1.4, 0.04]));
  batch.add(M.pipe(), G.box, frame(t, [0, h / 2 + 1.0, -0.2], [0.9, 0.06, 0.06]));
  batch.add(M.white(), G.box, frame(t, [0, h / 2 + 1.25, -0.2], [0.75, 0.08, 0.14]));
  batch.add(M.lamp(), G.sphere, frame(t, [0, h / 2 + 1.47, -0.2], [0.05, 0.06, 0.05]));
  batch.add(M.red(), G.sphere, frame(t, [-0.45, h / 2 + 1.0, -0.2], [0.04, 0.04, 0.04]));
  batch.add(M.leaf(), G.sphere, frame(t, [0.45, h / 2 + 1.0, -0.2], [0.04, 0.04, 0.04]));
}

// ---------------------------------------------------------------- decor

export const HARBOUR_DECOR = {
  basket(batch, sc, d, p) {
    const [x, y, z] = p;
    const r = rng(Math.round(x * 7 + z * 11));
    const g = new THREE.CylinderGeometry(0.3, 0.24, 0.3, 14, 1, true);
    batch.add(M.burlap(), g, { p: [x, y + 0.15, z] });
    batch.add(M.burlap(), G.cyl, { p: [x, y + 0.02, z], s: [0.24, 0.04, 0.24] });
    batch.add(M.crate(), new THREE.TorusGeometry(0.3, 0.025, 6, 16), { p: [x, y + 0.3, z], r: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.22;
      sc.add('lemon', G.sphere, M.lemon(), [x + Math.cos(a) * rr, y + 0.28 + r() * 0.06 + (rr < 0.12 ? 0.05 : 0), z + Math.sin(a) * rr], [r() * 3, r() * 3, 0], [0.055, 0.045, 0.045]);
    }
  },
  walltap(batch, sc, d, p) {
    const [x, y, z] = p;
    const yaw = d.yaw ?? 0;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    batch.add(M.brass(), G.cyl, { p: [x, y, z], r: [Math.PI / 2, yaw, 0], s: [0.07, 0.03, 0.07] });
    batch.add(M.brass(), G.cyl8, { p: [x + dx * 0.1, y, z + dz * 0.1], r: [Math.PI / 2, yaw, 0], s: [0.025, 0.2, 0.025] });
    batch.add(M.brass(), G.cyl8, { p: [x + dx * 0.2, y - 0.06, z + dz * 0.2], s: [0.022, 0.12, 0.022] });
    batch.add(M.red(), G.box, { p: [x + dx * 0.08, y + 0.07, z + dz * 0.08], r: [0, yaw, 0], s: [0.12, 0.02, 0.03] });
  },
  pots(batch, sc, d, p) {
    const r = rng(d.seed ?? 3);
    const z1 = d.z1 ?? p[2] + 6;
    for (let z = p[2]; z <= z1; z += 1.6 + r() * 1.4) {
      // down the steps: each pot stands on the step it's beside
      let y = p[1];
      if (d.steps) {
        const [z0, zs1, yTop, yBot, n] = d.steps;
        const dz = (zs1 - z0) / n, dy = (yTop - yBot) / (n + 1);
        const i = Math.min(n - 1, Math.max(0, Math.floor((z - z0) / dz)));
        y = yTop - (i + 1) * dy;
        // keep clear of the step's front edge
        z = Math.max(z, z0 + i * dz + 0.35);
      }
      pottedPlant(batch, sc, new THREE.Vector3(p[0] + (r() - 0.5) * 0.2, y, z), r, 1.1);
    }
  },
  ledgepots(batch, sc, d, p) {
    const r = rng(d.seed ?? 8);
    for (let z = p[2] + 0.4; z <= d.z1 - 0.3; z += 0.9 + r() * 1.3) {
      if (r() < 0.25) continue;
      pottedPlant(batch, sc, new THREE.Vector3(p[0] - 0.3 + (r() - 0.5) * 0.12, p[1], z), r, 0.85);
    }
  },
  auctioneer(batch, sc, d, p) {
    const [x, y, z] = p;
    // a wooden podium on a step, a brass bell on a post, a slate with the morning's prices
    batch.add(M.crateDark(), G.box, { p: [x, y + 0.1, z], s: [1.0, 0.2, 1.0] });
    batch.add(M.counterWood(), G.box, { p: [x, y + 0.75, z], s: [0.7, 1.1, 0.55] });
    batch.add(M.counterWood(), G.box, { p: [x + 0.08, y + 1.33, z], r: [0, 0, -0.25], s: [0.6, 0.06, 0.6] });
    batch.add(M.iron(), G.cyl8, { p: [x - 0.35, y + 1.3, z + 0.25], s: [0.025, 0.8, 0.025] });
    batch.add(M.brass(), new THREE.CylinderGeometry(0.06, 0.13, 0.16, 14, 1, true), { p: [x - 0.35, y + 1.62, z + 0.25] });
    batch.add(signMat('CRIÉE 6H', '#1a1d22', '#f6e7c8'), G.box, { p: [x + 0.36, y + 0.8, z], r: [0, Math.PI / 2, 0], s: [0.5, 0.28, 0.02] });
  },
  gantry(batch, sc, d, p) {
    const [x, y, z] = p;
    const w = d.w ?? 6, top = d.h ?? 5.6;
    // two A-frames of yellow steel, a crossbeam just over the pivot, the dial on top
    for (const s of [-1, 1]) {
      for (const k of [-1, 1]) batch.add(M.yellowSteel(), G.box, { p: [x + s * w / 2, (y + top + 0.2) / 2, z + k * 0.35], r: [k * 0.12, 0, 0], s: [0.16, top + 0.2 - y, 0.16] });
      batch.add(M.iron(), G.box, { p: [x + s * w / 2, y + 0.05, z], s: [0.5, 0.1, 1.4] });
    }
    batch.add(M.yellowSteel(), G.box, { p: [x, top + 0.18, z], s: [w + 0.3, 0.22, 0.22] });
    batch.add(M.iron(), G.cyl8, { p: [x, top + 0.04, z], r: [Math.PI / 2, 0, 0], s: [0.08, 0.3, 0.08] });
    // the dial: a white face in a red ring, facing up the yard (the needle is the scale's own)
    batch.add(M.red(), G.cyl20, { p: [x, top + 0.95, z - 0.02], r: [Math.PI / 2, 0, 0], s: [0.62, 0.14, 0.62] });
    batch.add(dialMat(), G.cyl20, { p: [x, top + 0.95, z - 0.1], r: [Math.PI / 2, 0, 0], s: [0.55, 0.02, 0.55] });
    batch.add(M.yellowSteel(), G.box, { p: [x, top + 0.42, z], s: [0.18, 0.3, 0.18] });
  },
  ropecoil(batch, sc, d, p) {
    const [x, y, z] = p;
    for (let i = 0; i < 4; i++) batch.add(M.rope(), new THREE.TorusGeometry(0.32 - i * 0.02, 0.045, 6, 20), { p: [x, y + 0.045 + i * 0.075, z], r: [Math.PI / 2, 0, i] });
  },
};

let dial = null;
function dialMat() {
  if (dial) return dial;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f1e6';
  g.fillRect(0, 0, 256, 256);
  g.translate(128, 128);
  g.strokeStyle = '#1a1d22';
  g.fillStyle = '#1a1d22';
  g.font = 'bold 22px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k <= 40; k++) {
    const a = -Math.PI * 0.75 + (k / 40) * Math.PI * 1.5;
    const long = k % 5 === 0;
    g.lineWidth = long ? 4 : 2;
    g.beginPath();
    g.moveTo(Math.sin(a) * (long ? 92 : 100), -Math.cos(a) * (long ? 92 : 100));
    g.lineTo(Math.sin(a) * 110, -Math.cos(a) * 110);
    g.stroke();
    if (long) g.fillText(String(k * 5), Math.sin(a) * 74, -Math.cos(a) * 74);
  }
  g.font = 'bold 26px Georgia, serif';
  g.fillStyle = '#c8402c';
  g.fillText('KG', 0, 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // a cylinder's cap maps the canvas across its face; turn it to read upright facing -z
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI;
  dial = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 });
  return dial;
}
