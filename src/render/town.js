// The town at fish height: house fronts (a stone plinth, doors with steps, shop fronts, windows with frames, sills,
// shutters and flower boxes, balconies, string courses, a cornice, a drainpipe, a tiled roof), the steps, the running-water
// channel, the fountain, cafés, ledges, sails and lamps. Everything goes into the course's batch (merged, culled by area);
// flowers and other many-copies things into the scatter.

import * as THREE from 'three';
import { M } from './materials.js';
import { G, rng } from './geo.js';

const Q0 = new THREE.Quaternion();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4();

// ---------------------------------------------------------------- façade frames

/** A frame on one side of a house: u along the front (left to right seen from the street), v up from the street, n out. */
function facade(H, face) {
  const o = new THREE.Vector3();
  const u = new THREE.Vector3();
  const n = new THREE.Vector3();
  let L;
  if (face === 'x+') (o.set(H.x1, H.ground, H.z1), u.set(0, 0, -1), n.set(1, 0, 0), (L = H.z1 - H.z0));
  else if (face === 'x-') (o.set(H.x0, H.ground, H.z0), u.set(0, 0, 1), n.set(-1, 0, 0), (L = H.z1 - H.z0));
  else if (face === 'z+') (o.set(H.x0, H.ground, H.z1), u.set(1, 0, 0), n.set(0, 0, 1), (L = H.x1 - H.x0));
  else (o.set(H.x1, H.ground, H.z0), u.set(-1, 0, 0), n.set(0, 0, -1), (L = H.x1 - H.x0));
  const basis = new THREE.Matrix4().makeBasis(u, UP, n).setPosition(o);
  return { L, top: H.y0 + H.h - H.ground, basis, ground: H.ground };
}

/** A box in a façade's frame: centre (cu, cv, cn), size (su, sv, sn). */
function fb(batch, F, mat, cu, cv, cn, su, sv, sn, geo = G.box, opts = {}) {
  tmpM.compose(V.set(cu, cv, cn), opts.q ?? Q0, S.set(su, sv, sn));
  batch.add(mat, geo, F.basis.clone().multiply(tmpM), { ground: F.ground, paint: opts.paint });
}

/** A point in a façade's frame, in the world. */
function fp(F, cu, cv, cn) {
  return new THREE.Vector3(cu, cv, cn).applyMatrix4(F.basis);
}

// ---------------------------------------------------------------- shop signs (painted boards)

const signs = new Map();
export function signMat(text, bg = '#1d3f6e', fg = '#f6e7c8') {
  const key = `${text}|${bg}|${fg}`;
  if (signs.has(key)) return signs.get(key);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg;
  g.globalAlpha = 0.5;
  g.lineWidth = 5;
  g.strokeRect(12, 12, 488, 104);
  g.globalAlpha = 1;
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 74;
  do {
    g.font = `${size}px "Alfa Slab One", Georgia, serif`;
    size -= 4;
  } while (g.measureText(text).width > 450 && size > 20);
  g.fillText(text, 256, 68);
  // a little weathering
  g.globalAlpha = 0.07;
  const r = rng(text.length * 97 + text.charCodeAt(0));
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.5 ? '#000' : '#fff';
    g.fillRect(r() * 512, r() * 128, 1 + r() * 6, 1 + r() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
  signs.set(key, m);
  return m;
}

const SHOP_NAMES = ['FISH', 'BAKERY', 'TACKLE', 'CAFÉ', 'ICE CREAM', 'FRUIT', 'WINE', 'NETS & ROPE', 'BARBER', 'POST'];
const SIGN_COLOURS = [['#1d3f6e', '#f6e7c8'], ['#6e2222', '#f6e7c8'], ['#1f4f3f', '#f3d27a'], ['#f3d27a', '#22303a'], ['#22303a', '#f3d27a']];

// ---------------------------------------------------------------- houses

/** A house collider ({ house: {...} }): its block, each street front, its roof. */
export function drawHouse(batch, sc, col) {
  const H = col.house;
  const r = rng(H.seed);
  const paint = Math.floor(r() * 8);
  const shutter = Math.floor(r() * 8);
  const door = Math.floor(r() * 8);
  const shed = H.kind === 'shed';
  const wall = shed ? M.rust() : r() < 0.22 ? M.houseOld() : M.house();
  // the block
  batch.add(wall, G.box, { p: col.c, s: [H.x1 - H.x0, H.h, H.z1 - H.z0] }, { ground: H.ground, paint });
  for (const face of H.face) {
    const F = facade(H, face);
    if (shed) shedFront(batch, sc, F, r, door);
    else front(batch, sc, F, H, r, { paint, shutter, door, face });
  }
  if (!shed) roof(batch, sc, H, r);
  else {
    // a low-pitched tin roof
    batch.add(M.rust(), G.box, { p: [col.c[0], H.y0 + H.h + 0.08, col.c[2]], s: [H.x1 - H.x0 + 0.6, 0.12, H.z1 - H.z0 + 0.6] });
  }
}

function front(batch, sc, F, H, r, o) {
  const { L, top } = F;
  if (L < 1.2) return;
  const gf = 3.3; // ground floor height
  const fh = 2.95; // upper floors
  const floors = Math.max(0, Math.floor((top - gf - 0.7) / fh));
  const bays = Math.max(1, Math.round(L / 2.35));
  const bw = L / bays;
  const trim = M.trim();

  // plinth, pilasters at the ends, string courses, the cornice
  fb(batch, F, M.stone(), L / 2, 0.3, 0.04, L + 0.02, 0.8, 0.1);
  for (const u of [0.17, L - 0.17]) fb(batch, F, trim, u, (top + 0.7) / 2, 0.035, 0.34, top - 0.7, 0.07);
  for (let f = H.kind === 'hall' ? 1 : 0; f <= floors; f++) {
    const v = gf + f * fh;
    if (v > top - 0.6) break;
    fb(batch, F, trim, L / 2, v - 0.05, 0.04, L, 0.11, 0.08);
  }
  fb(batch, F, trim, L / 2, top - 0.17, 0.13, L + 0.34, 0.3, 0.26);
  fb(batch, F, trim, L / 2, top - 0.42, 0.07, L + 0.12, 0.09, 0.14);

  // the ground floor: a shop front, a hall's arches, or doors and barred windows
  if (H.kind === 'shop' || (H.kind === 'house' && r() < 0.3 && L > 4)) shopFront(batch, sc, F, r, o, H);
  else if (H.kind === 'hall') hallFront(batch, sc, F, r, o, bays, bw);
  else {
    const doorBay = Math.floor(r() * bays);
    for (let i = 0; i < bays; i++) {
      const cu = (i + 0.5) * bw;
      if (i === doorBay) doorway(batch, sc, F, cu, r, o);
      else groundWindow(batch, sc, F, cu, r, o);
    }
  }

  // upper floors: windows (some with a balcony)
  for (let f = 0; f < floors; f++) {
    const v0 = gf + f * fh;
    const balconyBay = r() < (H.kind === 'hall' ? 0 : 0.42) ? Math.floor(r() * bays) : -1;
    const wide = balconyBay >= 0 && bays >= 3 && r() < 0.35;
    for (let i = 0; i < bays; i++) {
      const cu = (i + 0.5) * bw;
      const bal = i === balconyBay || (wide && Math.abs(i - balconyBay) === 1 && i > 0 && i < bays - 1 && false);
      if (bal) {
        window1(batch, sc, F, cu, v0 + 1.2, 0.95, 2.15, r, o, { door: true });
        balcony(batch, sc, F, cu, v0 + 0.08, Math.min(bw - 0.3, 1.7), r);
      } else window1(batch, sc, F, cu, v0 + 1.45, H.kind === 'hall' ? 1.1 : 0.88, H.kind === 'hall' ? 1.9 : 1.42, r, o, { flowers: r() < 0.38 });
    }
  }

  // a drainpipe at one end, from the gutter to the street
  const pu = r() < 0.5 ? 0.42 : L - 0.42;
  fb(batch, F, M.pipe(), pu, top / 2, 0.12, 0.1, top - 0.3, 0.1, G.cyl8);
  for (let v = 1.2; v < top - 0.5; v += 2.2) fb(batch, F, M.pipe(), pu, v, 0.06, 0.16, 0.05, 0.1);
  fb(batch, F, M.pipe(), pu, 0.12, 0.2, 0.1, 0.32, 0.1, G.cyl8, { q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.9) });
  // a few things at the foot of the wall: pots, a bench, a bicycle-sized crate
  const nPots = Math.floor(r() * 3);
  for (let k = 0; k < nPots; k++) pottedPlant(batch, sc, fp(F, 0.5 + r() * (L - 1), 0, 0.35), r);
}

function window1(batch, sc, F, cu, cv, w, h, r, o, opts = {}) {
  const trim = M.trim();
  fb(batch, F, M.glass(), cu, cv, 0.006, w, h, 0.02);
  // frame and glazing bars
  fb(batch, F, trim, cu, cv + h / 2 + 0.04, 0.05, w + 0.16, 0.08, 0.1);
  fb(batch, F, trim, cu, cv - h / 2 - 0.04, 0.05, w + 0.16, 0.08, 0.1);
  for (const s of [-1, 1]) fb(batch, F, trim, cu + s * (w / 2 + 0.04), cv, 0.05, 0.08, h, 0.1);
  fb(batch, F, trim, cu, cv, 0.025, 0.035, h, 0.04);
  fb(batch, F, trim, cu, cv + h * 0.18, 0.025, w, 0.035, 0.04);
  // a sill and a hood
  if (!opts.door) fb(batch, F, M.stone(), cu, cv - h / 2 - 0.1, 0.11, w + 0.34, 0.07, 0.22);
  fb(batch, F, trim, cu, cv + h / 2 + 0.16, 0.08, w + 0.3, 0.1, 0.13);
  // shutters: open flat against the wall, half open, or closed
  const st = r();
  const sw = w / 2 + 0.03;
  const paint = o.shutter;
  if (st < 0.55) {
    for (const s of [-1, 1]) fb(batch, F, M.shutterPal(), cu + s * (w / 2 + 0.1 + sw / 2), cv, 0.04, sw, h + 0.04, 0.035, G.box, { paint });
  } else if (st < 0.8) {
    // one open, one swung part way
    fb(batch, F, M.shutterPal(), cu - (w / 2 + 0.1 + sw / 2), cv, 0.04, sw, h + 0.04, 0.035, G.box, { paint });
    const q = new THREE.Quaternion().setFromAxisAngle(UP, -1.1);
    fb(batch, F, M.shutterPal(), cu + w / 2 + 0.06 + Math.cos(1.1) * sw * 0.5 - 0.02, cv, 0.06 + Math.sin(1.1) * sw * 0.5, sw, h + 0.04, 0.035, G.box, { paint, q });
  } else {
    for (const s of [-1, 1]) fb(batch, F, M.shutterPal(), cu + s * (sw / 2 - 0.01), cv, 0.05, sw - 0.02, h, 0.035, G.box, { paint });
  }
  if (opts.flowers && !opts.door) flowerBox(batch, sc, F, cu, cv - h / 2 - 0.02, w + 0.1, r);
}

function flowerBox(batch, sc, F, cu, v, w, r) {
  fb(batch, F, M.potClay(), cu, v + 0.08, 0.24, w, 0.17, 0.2);
  const mats = [M.flowerRed(), M.flowerPink(), M.flowerWhite(), M.flowerPurple()];
  const fm = mats[Math.floor(r() * mats.length)];
  const n = Math.round(w * 9);
  for (let k = 0; k < n; k++) {
    const p = fp(F, cu + (r() - 0.5) * w * 0.95, v + 0.2 + r() * 0.14, 0.24 + (r() - 0.5) * 0.18);
    const s = 0.045 + r() * 0.04;
    if (r() < 0.45) sc.add('leafblob', G.ico, M.foliage(), [p.x, p.y - 0.02, p.z], [r() * 3, r() * 3, 0], [s * 1.5, s, s * 1.4]);
    else sc.add(`fl:${fm.uuid}`, G.ico, fm, [p.x, p.y, p.z], [r() * 3, r() * 3, 0], [s, s * 0.8, s]);
  }
  // trailing leaves down the front
  for (let k = 0; k < Math.round(w * 3); k++) {
    const p = fp(F, cu + (r() - 0.5) * w, v - 0.05 - r() * 0.25, 0.35);
    sc.add('leafblob', G.ico, M.foliage(), [p.x, p.y, p.z], [r() * 3, r() * 3, 0], [0.05, 0.09, 0.04]);
  }
}

function balcony(batch, sc, F, cu, v, w, r) {
  const d = 0.72;
  fb(batch, F, M.trim(), cu, v, d / 2, w + 0.2, 0.12, d);
  for (const s of [-1, 1]) fb(batch, F, M.trim(), cu + s * (w / 2 - 0.1), v - 0.2, d / 2 - 0.05, 0.12, 0.3, d * 0.8);
  const iron = M.wroughtIron();
  fb(batch, F, iron, cu, v + 0.95, d - 0.03, w + 0.12, 0.04, 0.05);
  fb(batch, F, iron, cu, v + 0.12, d - 0.03, w + 0.12, 0.03, 0.03);
  for (const s of [-1, 1]) fb(batch, F, iron, cu + s * (w / 2 + 0.04), v + 0.95, d / 2, 0.04, 0.04, d);
  const n = Math.round(w / 0.13);
  for (let k = 0; k <= n; k++) fb(batch, F, iron, cu - w / 2 + (w * k) / n, v + 0.53, d - 0.03, 0.018, 0.82, 0.018);
  for (const s of [-1, 1]) for (let k = 1; k < 5; k++) fb(batch, F, iron, cu + s * (w / 2 + 0.04), v + 0.53, (d * k) / 5, 0.018, 0.82, 0.018);
  // pots on the balcony, laundry sometimes
  for (let k = 0; k < 2; k++) if (r() < 0.75) pottedPlant(batch, sc, fp(F, cu + (k ? 1 : -1) * w * 0.3, v + 0.06, d * 0.55), r, 0.7);
}

function doorway(batch, sc, F, cu, r, o) {
  const trim = M.trim();
  const w = 1.1, h = 2.3;
  const arched = r() < 0.45;
  fb(batch, F, M.dark(), cu, h / 2 + 0.12, 0.004, w + 0.1, h, 0.02);
  // the door: two leaves with raised panels
  fb(batch, F, M.doorPal(), cu, h / 2 + 0.12, 0.02, w, h, 0.05, G.box, { paint: o.door });
  for (const s of [-1, 1]) {
    fb(batch, F, M.doorPal(), cu + s * w * 0.25, 0.75, 0.05, w * 0.36, 0.7, 0.03, G.box, { paint: o.door });
    fb(batch, F, M.doorPal(), cu + s * w * 0.25, 1.75, 0.05, w * 0.36, 0.9, 0.03, G.box, { paint: o.door });
  }
  fb(batch, F, M.brass(), cu + 0.08, 1.15, 0.08, 0.05, 0.05, 0.05, G.sphere);
  // the stone surround and a step
  for (const s of [-1, 1]) fb(batch, F, M.stone(), cu + s * (w / 2 + 0.12), (h + 0.12) / 2, 0.07, 0.24, h + 0.12, 0.14);
  if (arched) {
    const R = w / 2 + 0.24;
    tmpM.compose(V.set(cu, h + 0.12, 0.07), Q0, S.set(R, R, 0.14));
    batch.add(M.stone(), G.archRing, F.basis.clone().multiply(tmpM), { ground: F.ground });
    tmpM.compose(V.set(cu, h + 0.12, 0.01), Q0, S.set(w / 2 + 0.03, w / 2 + 0.03, 0.02));
    batch.add(M.glass(), G.halfDisc, F.basis.clone().multiply(tmpM), { ground: F.ground });
  } else fb(batch, F, M.stone(), cu, h + 0.22, 0.08, w + 0.6, 0.22, 0.16);
  fb(batch, F, M.steps(), cu, 0.07, 0.2, w + 0.6, 0.14, 0.4);
  // a blue enamel house number
  fb(batch, F, M.blue(), cu + w / 2 + 0.45, 1.9, 0.02, 0.2, 0.15, 0.02);
  if (r() < 0.35) pottedPlant(batch, sc, fp(F, cu - w / 2 - 0.55, 0, 0.3), r, 1.2);
}

function groundWindow(batch, sc, F, cu, r, o) {
  window1(batch, sc, F, cu, 1.55, 0.9, 1.3, r, o, {});
  const iron = M.wroughtIron();
  for (let k = 0; k < 5; k++) fb(batch, F, iron, cu - 0.4 + k * 0.2, 1.55, 0.13, 0.025, 1.4, 0.025);
  fb(batch, F, iron, cu, 1.55 + 0.3, 0.13, 0.95, 0.025, 0.025);
  fb(batch, F, iron, cu, 1.55 - 0.3, 0.13, 0.95, 0.025, 0.025);
}

function shopFront(batch, sc, F, r, o, H) {
  const { L } = F;
  const w = Math.min(L - 1.0, 4.4);
  const cu = L / 2;
  const frame = M.doorPal();
  fb(batch, F, M.glass(), cu, 1.45, 0.005, w, 2.1, 0.02);
  fb(batch, F, M.dark(), cu - w / 2 + 0.7, 1.25, 0.003, 1.0, 2.3, 0.02);
  for (const s of [-1, 1]) fb(batch, F, frame, cu + s * (w / 2 + 0.06), 1.4, 0.06, 0.14, 2.6, 0.12, G.box, { paint: o.door });
  fb(batch, F, frame, cu, 0.25, 0.06, w + 0.26, 0.5, 0.12, G.box, { paint: o.door });
  fb(batch, F, frame, cu, 2.55, 0.06, w + 0.26, 0.14, 0.12, G.box, { paint: o.door });
  for (let k = 1; k < 3; k++) fb(batch, F, frame, cu - w / 2 + (w * k) / 3, 1.5, 0.03, 0.06, 2.0, 0.05, G.box, { paint: o.door });
  // the sign board
  const name = H.sign ?? SHOP_NAMES[Math.floor(r() * SHOP_NAMES.length)];
  const [bg, fg] = SIGN_COLOURS[Math.floor(r() * SIGN_COLOURS.length)];
  const sw = Math.min(w + 0.2, 3.6);
  fb(batch, F, frame, cu, 3.0, 0.06, sw + 0.14, 0.62, 0.1, G.box, { paint: o.door });
  const g = new THREE.PlaneGeometry(sw, 0.52);
  tmpM.compose(V.set(cu, 3.0, 0.115), Q0, S.set(1, 1, 1));
  batch.add(signMat(name, bg, fg), g, F.basis.clone().multiply(tmpM));
  // a striped awning over the window
  shopAwning(batch, F, cu, w + 0.3, r);
  // things out front
  if (r() < 0.6) crateDisplay(batch, sc, F, cu + w * 0.25, r);
}

function shopAwning(batch, F, cu, w, r) {
  const mat = [M.awningRed, M.awningBlue][Math.floor(r() * 2)]();
  const drop = 0.95, out = 1.25;
  const len = Math.hypot(drop, out);
  const g = new THREE.PlaneGeometry(w, len, 1, 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 0.6, uv.getY(i));
  const a = Math.atan2(drop, out);
  tmpM.compose(V.set(cu, 2.75 - drop / 2, out / 2 + 0.02), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2 + a), S.set(1, 1, 1));
  batch.add(mat, g, F.basis.clone().multiply(tmpM), { cast: true });
  // the scalloped valance
  const n = Math.max(3, Math.round(w / 0.3));
  for (let k = 0; k < n; k++) {
    tmpM.compose(V.set(cu - w / 2 + (w * (k + 0.5)) / n, 2.75 - drop - 0.11, out + 0.02), Q0, S.set(w / n / 2, 0.14, 0.01));
    batch.add(mat, G.halfDisc, F.basis.clone().multiply(tmpM).multiply(new THREE.Matrix4().makeRotationZ(Math.PI)));
  }
  for (const s of [-1, 1]) fb(batch, F, M.wroughtIron(), cu + s * (w / 2), 2.75 - drop / 2, out / 2, 0.025, 0.025, len, G.box, { q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a) });
}

function crateDisplay(batch, sc, F, cu, r) {
  // a crate of lemons or a bucket of flowers by the door
  const p = fp(F, cu, 0, 0.45);
  batch.add(M.crate(), G.box, { p: [p.x, 0.22 + F.ground, p.z], s: [0.62, 0.36, 0.42], r: [0, Math.atan2(F.basis.elements[8], F.basis.elements[10]), 0] });
  for (let k = 0; k < 14; k++) sc.add('lemon', G.sphere, M.lemon(), [p.x + (r() - 0.5) * 0.5, F.ground + 0.43 + r() * 0.05, p.z + (r() - 0.5) * 0.3], [r() * 3, r() * 3, 0], [0.055, 0.045, 0.045]);
}

function hallFront(batch, sc, F, r, o, bays, bw) {
  // big arched openings into the dark hall, a painted sign along the top
  for (let i = 0; i < bays; i++) {
    const cu = (i + 0.5) * bw;
    const w = Math.min(bw - 0.7, 2.4);
    fb(batch, F, M.dark(), cu, 1.4, 0.003, w, 2.8, 0.02);
    tmpM.compose(V.set(cu, 2.8, 0.003), Q0, S.set(w / 2, w / 2, 0.02));
    batch.add(M.dark(), G.halfDisc, F.basis.clone().multiply(tmpM), { ground: F.ground });
    for (const s of [-1, 1]) fb(batch, F, M.stone(), cu + s * (w / 2 + 0.14), 1.4, 0.08, 0.28, 2.8, 0.16);
    tmpM.compose(V.set(cu, 2.8, 0.08), Q0, S.set(w / 2 + 0.28, w / 2 + 0.28, 0.16));
    batch.add(M.stone(), G.archRing, F.basis.clone().multiply(tmpM), { ground: F.ground });
  }
  const g = new THREE.PlaneGeometry(Math.min(F.L - 1, 9), 1.0);
  tmpM.compose(V.set(F.L / 2, F.top - 1.3, 0.03), Q0, S.set(1, 1, 1));
  batch.add(signMat('FISH MARKET', '#f6e7c8', '#1d3f6e'), g, F.basis.clone().multiply(tmpM));
}

function shedFront(batch, sc, F, r, door) {
  const { L, top } = F;
  const n = Math.max(1, Math.floor(L / 4.5));
  const bw = L / n;
  for (let i = 0; i < n; i++) {
    const cu = (i + 0.5) * bw;
    const w = Math.min(bw - 0.8, 3.2);
    const up = r() < 0.5;
    if (up) {
      // rolled up: the dark inside, the shutter's roll at the top
      fb(batch, F, M.dark(), cu, 1.4, 0.003, w, 2.8, 0.02);
      fb(batch, F, M.rollshutter(), cu, 2.95, 0.12, w + 0.1, 0.3, 0.24, G.cyl8, { paint: door % 4, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2) });
    } else fb(batch, F, M.rollshutter(), cu, 1.45, 0.03, w, 2.9, 0.05, G.box, { paint: door % 4 });
    for (const s of [-1, 1]) fb(batch, F, M.iron(), cu + s * (w / 2 + 0.06), 1.5, 0.06, 0.1, 3.0, 0.1);
  }
  fb(batch, F, M.iron(), L / 2, top - 0.15, 0.08, L + 0.1, 0.3, 0.16);
  const g = new THREE.PlaneGeometry(Math.min(L - 1, 4.5), 0.7);
  tmpM.compose(V.set(L / 2, top - 0.95, 0.03), Q0, S.set(1, 1, 1));
  batch.add(signMat(['ICE', 'FISH BOXES', 'COLD STORE', 'NETS'][Math.floor(r() * 4)], '#f3d27a', '#22303a'), g, F.basis.clone().multiply(tmpM));
}

export function pottedPlant(batch, sc, p, r, size = 1) {
  const s = (0.18 + r() * 0.12) * size;
  batch.add(M.potClay(), G.cyl, { p: [p.x, p.y + s * 0.6, p.z], s: [s, s * 1.2, s] });
  const kind = r();
  if (kind < 0.5) {
    // a leafy mound with flowers
    for (let k = 0; k < 7; k++) sc.add('leafblob', G.ico, M.foliage(), [p.x + (r() - 0.5) * s * 1.6, p.y + s * 1.25 + r() * s * 0.9, p.z + (r() - 0.5) * s * 1.6], [r() * 3, r() * 3, 0], [s * 0.55, s * 0.45, s * 0.55]);
    const fm = [M.flowerRed(), M.flowerPink(), M.flowerWhite()][Math.floor(r() * 3)];
    for (let k = 0; k < 6; k++) sc.add(`fl:${fm.uuid}`, G.ico, fm, [p.x + (r() - 0.5) * s * 1.7, p.y + s * 1.5 + r() * s * 0.8, p.z + (r() - 0.5) * s * 1.7], [r() * 3, r() * 3, 0], [s * 0.2, s * 0.17, s * 0.2]);
  } else {
    // a spiky agave / a small lemon tree
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      sc.add('leafspike', G.cone, M.foliageLight(), [p.x + Math.cos(a) * s * 0.4, p.y + s * 1.7, p.z + Math.sin(a) * s * 0.4], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], [s * 0.12, s * 1.3, s * 0.06]);
    }
  }
}

// ---------------------------------------------------------------- roofs

function roof(batch, sc, H, r) {
  const flat = r() < 0.25;
  const top = H.y0 + H.h;
  const cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2;
  const wx = H.x1 - H.x0, wz = H.z1 - H.z0;
  if (flat) {
    // a parapet and a roof terrace with a few pots
    const t = 0.18;
    batch.add(M.trim(), G.box, { p: [cx, top + 0.3, H.z0 + t / 2], s: [wx, 0.6, t] });
    batch.add(M.trim(), G.box, { p: [cx, top + 0.3, H.z1 - t / 2], s: [wx, 0.6, t] });
    batch.add(M.trim(), G.box, { p: [H.x0 + t / 2, top + 0.3, cz], s: [t, 0.6, wz] });
    batch.add(M.trim(), G.box, { p: [H.x1 - t / 2, top + 0.3, cz], s: [t, 0.6, wz] });
    for (let k = 0; k < 3; k++) if (r() < 0.6) pottedPlant(batch, sc, new THREE.Vector3(H.x0 + 0.6 + r() * (wx - 1.2), top, H.z0 + 0.6 + r() * (wz - 1.2)), r, 1.3);
    return;
  }
  // a pitched roof of clay tiles: the ridge runs along the street front
  const alongZ = H.face.some((f) => f[0] === 'x');
  const span = alongZ ? wx : wz; // the depth the roof slopes across
  const len = (alongZ ? wz : wx) + 0.5;
  const pitch = 0.42;
  const over = 0.45;
  const rise = (span / 2) * Math.tan(pitch);
  const slope = (span / 2 + over) / Math.cos(pitch);
  for (const s of [-1, 1]) {
    const off = s * ((span / 2 + over) / 2 - over / 2) * 1;
    const cy = top + rise / 2 - (over * Math.tan(pitch)) / 2 + 0.06;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    if (alongZ) {
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * pitch);
      m.compose(new THREE.Vector3(cx + off, cy, cz), q, new THREE.Vector3(slope, 0.14, len));
    } else {
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -s * pitch);
      m.compose(new THREE.Vector3(cx, cy, cz + off), q, new THREE.Vector3(len, 0.14, slope));
    }
    batch.add(M.roof(), G.box, m);
  }
  // the ridge cap and the gable ends
  batch.add(M.potClay(), G.cyl8, alongZ ? { p: [cx, top + rise + 0.1, cz], s: [0.13, len, 0.13], r: [Math.PI / 2, 0, 0] } : { p: [cx, top + rise + 0.1, cz], s: [0.13, len, 0.13], r: [0, 0, Math.PI / 2] });
  for (const s of [-1, 1]) {
    const m = new THREE.Matrix4();
    if (alongZ) m.compose(new THREE.Vector3(cx, top, s > 0 ? H.z1 - 0.1 : H.z0 + 0.1), Q0, new THREE.Vector3(span, rise, 0.2));
    else m.compose(new THREE.Vector3(s > 0 ? H.x1 - 0.1 : H.x0 + 0.1, top, cz), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2), new THREE.Vector3(span, rise, 0.2));
    batch.add(M.house(), G.prism, m, { ground: H.ground, paint: 7 });
  }
  // a chimney
  if (r() < 0.55) {
    const px = H.x0 + 0.8 + r() * (wx - 1.6), pz = H.z0 + 0.8 + r() * (wz - 1.6);
    batch.add(M.house(), G.box, { p: [px, top + rise * 0.6 + 0.5, pz], s: [0.55, rise + 1.2, 0.55] }, { ground: H.ground, paint: 7 });
    batch.add(M.trim(), G.box, { p: [px, top + rise * 1.1 + 1.12, pz], s: [0.7, 0.1, 0.7] });
    batch.add(M.potClay(), G.cyl8, { p: [px, top + rise * 1.1 + 1.3, pz], s: [0.12, 0.3, 0.12] });
  }
  // gutters along the eaves on the street sides
  for (const f of H.face) {
    const m = { 'x+': [H.x1 + over * 0.95, cz, 0], 'x-': [H.x0 - over * 0.95, cz, 0], 'z+': [cx, H.z1 + over * 0.95, 1], 'z-': [cx, H.z0 - over * 0.95, 1] }[f];
    if (!m || m[2] !== (alongZ ? 0 : 1)) continue;
    const y = top - over * Math.tan(pitch) + 0.02;
    batch.add(M.pipe(), G.cyl8, alongZ ? { p: [m[0], y, m[1]], s: [0.07, len, 0.07], r: [Math.PI / 2, 0, 0] } : { p: [m[0], y, m[1]], s: [0.07, len, 0.07], r: [0, 0, Math.PI / 2] });
  }
}

// ---------------------------------------------------------------- street pieces

/** Stone steps: a worn tread with a rounded nose, the riser below. */
export function drawStep(batch, w, h, d, t) {
  batch.add(M.steps(), G.box, { p: t.p, s: [w, h, d], r: t.r });
  // the nose: a slightly proud, rounded front edge
  const [x, y, z] = t.p;
  batch.add(M.steps(), G.rbox, { p: [x, y + h / 2 - 0.05, z - d / 2 + 0.06], s: [w, 0.1, 0.16] });
}

/** The runnel: a stone channel with water running down it (the water is a flowing sheet drawn by the course view). */
export function drawRunnel(batch, w, h, d, t) {
  batch.add(M.stone(), G.box, { p: t.p, s: [w, h, d], r: t.r });
}

/** A fountain: the round basin (rim of stone), the column, the bowl. Water and jets are drawn by the course view. */
export function drawFountain(batch, sc, d, at) {
  const [x, y, z] = at;
  const R = d.r, rim = d.rim;
  const ring = new THREE.CylinderGeometry(R, R, 1, 40, 1, true);
  batch.add(M.stone(), ring, { p: [x, y + rim / 2, z], s: [1, rim, 1] });
  const inner = new THREE.CylinderGeometry(R - 0.26, R - 0.26, 1, 40, 1, true);
  inner.scale(-1, 1, 1); // facing in
  batch.add(M.stone(), inner, { p: [x, y + rim / 2, z], s: [1, rim, 1] });
  const top = new THREE.RingGeometry(R - 0.28, R + 0.04, 40, 1);
  top.rotateX(-Math.PI / 2);
  batch.add(M.stone(), top, { p: [x, y + rim, z] });
  batch.add(M.stone(), new THREE.TorusGeometry(R - 0.12, 0.06, 6, 40), { p: [x, y + rim, z], r: [Math.PI / 2, 0, 0] });
  // the basin floor, darker
  batch.add(M.concrete(), G.cyl20, { p: [x, y + 0.04, z], s: [R - 0.2, 0.08, R - 0.2] });
  // the column: a turned shaft with rings, the bowl with a lip
  batch.add(M.stone(), G.cyl20, { p: [x, y + 0.68, z], s: [0.24, 1.35, 0.24] });
  for (const v of [0.2, 0.9, 1.2]) batch.add(M.stone(), G.cyl20, { p: [x, y + v, z], s: [0.3, 0.09, 0.3] });
  const bowl = new THREE.CylinderGeometry(0.82, 0.35, 0.3, 28);
  batch.add(M.stone(), bowl, { p: [x, y + 1.35, z] });
  batch.add(M.stone(), new THREE.TorusGeometry(0.8, 0.05, 6, 28), { p: [x, y + 1.49, z], r: [Math.PI / 2, 0, 0] });
  // a small finial: a fish standing on its tail, spouting
  batch.add(M.brass(), G.cone, { p: [x, y + 1.75, z], s: [0.1, 0.45, 0.1] });
  batch.add(M.brass(), G.sphere, { p: [x, y + 2.0, z], s: [0.09, 0.12, 0.09] });
}

/** A café table: a round marble top on an iron stem. */
export function drawCafeTable(batch, col) {
  const [x, y, z] = col.c;
  const b = y - col.hh;
  batch.add(M.wroughtIron(), G.cyl8, { p: [x, b + 0.36, z], s: [0.035, 0.72, 0.035] });
  batch.add(M.wroughtIron(), G.cyl, { p: [x, b + 0.02, z], s: [0.26, 0.04, 0.26] });
  batch.add(M.trim(), G.cyl20, { p: [x, b + 0.73, z], s: [col.r, 0.035, col.r] });
}

/** A bistro chair: rattan seat, iron legs, a back. */
export function drawChair(batch, w, h, d, t) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...t.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.r[1], 0)), new THREE.Vector3(1, 1, 1));
  const put = (mat, geo, p, s) => batch.add(mat, geo, m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p), Q0, new THREE.Vector3(...s))));
  put(M.burlap(), G.rbox, [0, 0.0, 0], [w, 0.05, d]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(M.wroughtIron(), G.cyl8, [sx * (w / 2 - 0.04), -h / 4, sz * (d / 2 - 0.04)], [0.018, h / 2, 0.018]);
  put(M.burlap(), G.rbox, [0, 0.26, -d / 2 + 0.03], [w, 0.38, 0.04]);
  for (const sx of [-1, 1]) put(M.wroughtIron(), G.cyl8, [sx * (w / 2 - 0.04), 0.2, -d / 2 + 0.02], [0.018, 0.45, 0.018]);
}

/** A café or beach parasol: a striped canopy with scallops, ribs and a pole. */
export function drawParasol(batch, col, tint = 'red') {
  const [x, y, z] = col.c;
  const R = col.r;
  const top = y + col.hh;
  const mat = tint === 'blue' ? M.awningBlue() : tint === 'lemon' ? M.awningLemon() : tint === 'green' ? M.awningGreen() : M.awningRed();
  // the canopy: a shallow cone, the stripes going round
  const g = new THREE.ConeGeometry(R, 0.42, 16, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i));
  batch.add(mat, g, { p: [x, top + 0.1, z] });
  const under = g.clone();
  under.scale(1, -1, 1);
  under.translate(0, 0.0, 0);
  // scallops round the rim
  for (let k = 0; k < 16; k++) {
    const a = ((k + 0.5) / 16) * Math.PI * 2;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x + Math.sin(a) * R * 0.99, top - 0.12, z + Math.cos(a) * R * 0.99), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, Math.PI)), new THREE.Vector3((Math.PI * R) / 16, 0.1, 0.01));
    batch.add(mat, G.halfDisc, m);
  }
  batch.add(M.wroughtIron(), G.sphere, { p: [x, top + 0.33, z], s: [0.05, 0.05, 0.05] });
}

/** A ledge: a thick plank on iron brackets. */
export function drawLedge(batch, w, h, d, t) {
  batch.add(M.counterWood(), G.box, { p: t.p, s: [w, h, d] });
  const along = d > w ? 'z' : 'x';
  const len = Math.max(w, d);
  const n = Math.max(2, Math.round(len / 1.6));
  for (let k = 0; k <= n; k++) {
    const o = -len / 2 + (len * k) / n;
    const p = along === 'z' ? [t.p[0], t.p[1] - 0.22, t.p[2] + o] : [t.p[0] + o, t.p[1] - 0.22, t.p[2]];
    batch.add(M.wroughtIron(), G.box, { p, s: along === 'z' ? [Math.min(w, d) * 0.8, 0.32, 0.04] : [0.04, 0.32, Math.min(w, d) * 0.8] });
  }
}

/** A lamp post: a fluted iron column, a lantern on a curl of iron. */
export function drawLamp(batch, col) {
  const [x, y, z] = col.c;
  const b = y - col.hh, h = col.hh * 2;
  batch.add(M.wroughtIron(), G.cyl8, { p: [x, b + 0.25, z], s: [0.14, 0.5, 0.14] });
  batch.add(M.wroughtIron(), G.cyl8, { p: [x, b + h / 2, z], s: [0.06, h, 0.06] });
  batch.add(M.wroughtIron(), G.box, { p: [x + 0.25, b + h - 0.12, z], s: [0.5, 0.04, 0.04] });
  batch.add(M.lamp(), G.cyl8, { p: [x + 0.5, b + h - 0.45, z], s: [0.14, 0.32, 0.14] });
  batch.add(M.wroughtIron(), G.cone, { p: [x + 0.5, b + h - 0.22, z], s: [0.2, 0.18, 0.2] });
}

/** A sail: a sagging canvas sheet with ropes to the walls. */
export function drawSail(batch, d, at) {
  const g = new THREE.PlaneGeometry(d.w, d.d, 8, 8);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (d.w / 2), v = p.getZ(i) / (d.d / 2);
    p.setY(i, -(1 - u * u) * (1 - v * v) * 0.35);
  }
  g.computeVertexNormals();
  const mat = d.tint === 'blue' ? M.sailBlue() : M.sailCream();
  batch.add(mat, g, { p: at });
}
