// Turns a course (data) into a scene: merged solids, decor, puddles that read as water from far off, the sea, the
// lighthouse on the horizon, boats, and price tags spiked in the ice.

import * as THREE from 'three';
import { createBatch } from './batch.js';
import { drawCollider, drawDecor, createScatter, G } from './kit.js';
import { M } from './materials.js';
import { makeSea } from './scene.js';
import { tagAtlas } from './tags.js';

export function buildCourseView(course, camera = null) {
  const root = new THREE.Group();
  root.name = `course:${course.id}`;
  const batch = createBatch();
  const scatter = createScatter();
  const extras = { tags: [] };
  for (const col of course.builder.colliders) drawCollider(batch, scatter, col);
  for (const d of course.builder.decors) drawDecor(batch, scatter, d, extras);
  root.add(batch.build('solids'));
  scatter.build(root);

  // ---------------------------------------------------------------- puddles and sprays
  const waters = [];
  for (const z of course.builder.zones) {
    if (!z.rate || z.look === 'spray-hidden' || z.look === 'tub') continue;
    if (z.kind === 'puddle') waters.push(makePuddle(root, z));
    else waters.push(makeSpray(root, z));
  }

  // ---------------------------------------------------------------- price tags in the ice (the signature, in the world)
  if (extras.tags.length) root.add(makeTags(extras.tags));

  // ---------------------------------------------------------------- the sea, the lighthouse, boats
  let sea = null;
  if (course.sea) {
    sea = makeSea(course.sea);
    root.add(sea);
    const lh = course.sea.lighthouse;
    if (lh) root.add(makeLighthouse(lh));
    root.add(makeBoats(course));
  }
  // the surf: a sheet of foam that runs up the sand and back
  const surf = course.surf ? makeSurf(course.surf) : null;
  if (surf) root.add(surf.group);
  // gulls wheeling over the water: seen over the rooftops from anywhere on the course, they show where the sea is
  const gulls = course.sea && course.id !== 'quay' ? makeGullRing(course) : null;
  if (gulls) root.add(gulls.group);
  // blue enamel signs: a wave and an arrow
  const signs = (course.builder.decors ?? []).filter((d) => d.look === 'sign');
  const signGroup = signs.length ? makeSigns(signs) : null;
  if (signGroup) root.add(signGroup);

  const view = {
    root,
    waters,
    sea,
    update(t) {
      sea?.userData.update(t);
      for (const w of waters) w.update(t);
      gulls?.update(t);
      surf?.update(t);
      // a hanging sign the chase camera passes through steps out of the way
      if (signGroup && camera) for (const sg of signGroup.children) sg.visible = sg.position.distanceToSquared(camera.position) > 1.2;
    },
    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    },
  };
  return view;
}

function makeSurf(o) {
  const group = new THREE.Group();
  const sheets = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(o.x1 - o.x0, 2.2 + i * 0.6, 40, 1);
    g.rotateX(-Math.PI / 2);
    // a ragged leading edge
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) if (pos.getZ(k) < 0) pos.setZ(k, pos.getZ(k) + Math.sin(pos.getX(k) * 0.7 + i * 2) * 0.35 + Math.sin(pos.getX(k) * 2.3) * 0.12);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.x = (o.x0 + o.x1) / 2;
    group.add(mesh);
    sheets.push({ mesh, m, ph: i / 3 });
  }
  return {
    group,
    update(t) {
      for (const s of sheets) {
        const k = ((t / 5.5 + s.ph) % 1 + 1) % 1;
        const run = Math.sin(k * Math.PI);
        const z = o.z + 1.2 - run * 4.2;
        // ride the slope of the sand (y 0 at z0 - 8, down 0.9 over 14 m)
        const y = Math.min(0, -0.9 * (z - (o.z - 8)) / 14) + 0.03;
        s.mesh.position.set((o.x0 + o.x1) / 2, Math.max(-0.58, y), z);
        s.mesh.rotation.x = 0.064;
        s.m.opacity = 0.75 * Math.sin(k * Math.PI) ** 0.6;
      }
    },
  };
}

const rimGeo = new THREE.RingGeometry(0.9, 1.0, 40).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const rippleGeo = new THREE.RingGeometry(0.94, 1.0, 40).rotateX(-Math.PI / 2);

function makePuddle(root, z) {
  const g = new THREE.Group();
  g.position.set(z.c[0], z.c[1] + 0.012, z.c[2]);
  const disc = new THREE.Mesh(discGeo, M.puddle());
  disc.scale.setScalar(z.r * 1.02);
  disc.receiveShadow = true;
  g.add(disc);
  const rim = new THREE.Mesh(rimGeo, M.puddleRim());
  rim.scale.setScalar(z.r * 1.04);
  rim.position.y = 0.004;
  g.add(rim);
  const ripples = [];
  for (let i = 0; i < 2; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const r = new THREE.Mesh(rippleGeo, mat);
    r.position.y = 0.006;
    g.add(r);
    ripples.push(r);
  }
  root.add(g);
  const seed = (z.c[0] * 7.3 + z.c[2] * 1.7) % 3;
  return {
    zone: z,
    group: g,
    update(t) {
      for (let i = 0; i < ripples.length; i++) {
        const k = ((t * 0.55 + seed + i * 0.5) % 1 + 1) % 1;
        ripples[i].scale.setScalar(z.r * (0.25 + 0.75 * k));
        ripples[i].material.opacity = 0.55 * (1 - k) * k * 3.5;
      }
      rim.material.opacity = 0.65 + 0.25 * Math.sin(t * 3 + seed);
    },
  };
}

/** A spray (a hose, a sprinkler, a shower): drops falling in a column, a glossy wet patch below. */
function makeSpray(root, z) {
  const g = new THREE.Group();
  g.position.set(z.c[0], z.c[1], z.c[2]);
  const wet = new THREE.Mesh(discGeo, M.puddle());
  wet.scale.setScalar(z.r);
  wet.position.y = 0.01;
  wet.material = M.puddle();
  g.add(wet);
  const n = 40;
  const drops = new THREE.InstancedMesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xc8f4ff, transparent: true, opacity: 0.85 }), n);
  drops.frustumCulled = false;
  g.add(drops);
  const seeds = Array.from({ length: n }, (_, i) => [Math.sin(i * 12.9898) * 0.5 + 0.5, Math.sin(i * 78.233) * 0.5 + 0.5, Math.sin(i * 39.425) * 0.5 + 0.5]);
  const m = new THREE.Matrix4();
  const h = z.look === 'hose' ? 1.6 : 2.4;
  root.add(g);
  return {
    zone: z,
    group: g,
    update(t) {
      for (let i = 0; i < n; i++) {
        const s = seeds[i];
        const k = (t * (1.2 + s[2]) + s[0]) % 1;
        const a = s[1] * Math.PI * 2;
        const rr = z.r * (0.2 + 0.7 * s[0]) * (0.4 + 0.6 * k);
        m.makeScale(0.025, 0.06, 0.025);
        m.setPosition(Math.cos(a) * rr, h * (1 - k * k), Math.sin(a) * rr);
        drops.setMatrixAt(i, m);
      }
      drops.instanceMatrix.needsUpdate = true;
    },
  };
}

function makeTags(list) {
  const atlas = tagAtlas();
  const group = new THREE.Group();
  const quads = [];
  const pins = [];
  for (const tg of list) {
    const idx = Math.floor(tg.label * 8) % 8;
    // two faces back to back, so the price reads the right way from either side
    for (const flip of [0, Math.PI]) {
      const g = new THREE.PlaneGeometry(0.16, 0.11);
      const uv = g.attributes.uv;
      const u0 = (idx % 4) / 4, v0 = 1 - Math.floor(idx / 4) / 2 - 0.5;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 4, v0 + uv.getY(i) / 2);
      g.translate(0, 0, 0.002);
      g.rotateY(tg.yaw + flip);
      g.translate(tg.p[0], tg.p[1] + 0.13, tg.p[2]);
      quads.push(g);
    }
    const pin = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5);
    pin.translate(tg.p[0], tg.p[1] + 0.04, tg.p[2]);
    pins.push(pin);
  }
  const merge = (geos) => {
    const out = new THREE.BufferGeometry();
    const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const count = parts.reduce((a, g) => a + g.attributes.position.count, 0);
    for (const name of ['position', 'normal', 'uv']) {
      const size = parts[0].attributes[name].itemSize;
      const arr = new Float32Array(count * size);
      let o = 0;
      for (const g of parts) {
        arr.set(g.attributes[name].array, o);
        o += g.attributes[name].array.length;
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    return out;
  };
  const tagMesh = new THREE.Mesh(merge(quads), new THREE.MeshStandardMaterial({ map: atlas, transparent: false, alphaTest: 0.5, side: THREE.FrontSide, roughness: 0.55 }));
  tagMesh.castShadow = true;
  group.add(tagMesh);
  group.add(new THREE.Mesh(merge(pins), M.red()));
  return group;
}

function makeLighthouse(at) {
  const g = new THREE.Group();
  g.position.set(at[0], at[1] - 1, at[2]);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 3, 16), M.quayside());
  base.position.y = 1.5;
  g.add(base);
  const levels = 6;
  for (let i = 0; i < levels; i++) {
    const r0 = 2.2 - i * 0.18, r1 = 2.2 - (i + 1) * 0.18;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 3, 16), i % 2 ? M.white() : M.red());
    seg.position.y = 3 + i * 3 + 1.5;
    g.add(seg);
  }
  const top = 3 + levels * 3;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 16), M.iron());
  gallery.position.y = top + 0.15;
  g.add(gallery);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffd36a, emissiveIntensity: 1.2, roughness: 0.2 }));
  lamp.position.y = top + 1.1;
  g.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.2, 12), M.red());
  cap.position.y = top + 2.5;
  g.add(cap);
  return g;
}

function makeBoats(course) {
  const g = new THREE.Group();
  const sea = course.sea;
  const hullCols = [M.blue(), M.red(), M.white(), M.lemonPaint()];
  const positions = [
    [sea.x0 * 0.3 - 12, sea.z0 + 22],
    [sea.x1 * 0.3 + 14, sea.z0 + 30],
    [-26, sea.z0 + 55],
    [32, sea.z0 + 70],
    [-6, sea.z0 + 95],
  ];
  positions.forEach(([x, z], i) => {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.7, 6, 10, 1, false, 0, Math.PI), hullCols[i % 4]);
    hull.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    hull.scale.set(1, 1, 0.6);
    b.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), M.white());
    cabin.position.set(-0.6, 0.7, 0);
    b.add(cabin);
    const mast = new THREE.Mesh(G.cyl8, M.crateDark());
    mast.scale.set(0.06, 4, 0.06);
    mast.position.set(0.8, 2, 0);
    b.add(mast);
    b.position.set(x, sea.y + 0.1, z);
    b.rotation.y = i * 1.3;
    g.add(b);
  });
  return g;
}

// ---------------------------------------------------------------- gulls over the harbour

function gullGeometry() {
  // a white V with dark wing tips, made of two thin triangles per wing
  const g = new THREE.BufferGeometry();
  const v = [0, 0, 0, -0.9, 0.25, -0.15, -0.35, 0.05, 0.1, 0, 0, 0, 0.35, 0.05, 0.1, 0.9, 0.25, -0.15];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  return g;
}

function makeGullRing(course) {
  const group = new THREE.Group();
  const end = course.spine[course.spine.length - 1];
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false });
  const geo = gullGeometry();
  const birds = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(1.6 + (i % 3) * 0.3);
    group.add(m);
    birds.push({ m, a: (i / 9) * Math.PI * 2, r: 9 + (i % 4) * 3, h: 17 + (i % 5) * 2.2, s: 0.22 + (i % 3) * 0.05, f: 5 + (i % 4) });
  }
  return {
    group,
    update(t) {
      for (const b of birds) {
        const a = b.a + t * b.s;
        b.m.position.set(end[0] + Math.cos(a) * b.r, b.h + Math.sin(t * 0.7 + b.a) * 1.2, end[2] + 6 + Math.sin(a) * b.r);
        b.m.rotation.set(0, -a, Math.sin(t * 0.5 + b.a) * 0.3);
        b.m.scale.y = (1.6 + (b.r % 3) * 0.1) * (0.7 + 0.3 * Math.sin(t * b.f + b.a));
      }
    },
  };
}

// ---------------------------------------------------------------- street signs to the harbour

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const g = c.getContext('2d');
  // older Safari has no roundRect: square corners there
  if (!g.roundRect) g.roundRect = (x, y, w, h) => g.rect(x, y, w, h);
  const draw = (y0, arrow) => {
    g.fillStyle = '#0b5cad';
    g.beginPath();
    g.roundRect(6, y0 + 6, 244, 116, 18);
    g.fill();
    g.strokeStyle = '#f4efe6';
    g.lineWidth = 7;
    g.beginPath();
    g.roundRect(16, y0 + 16, 224, 96, 12);
    g.stroke();
    // waves
    g.lineWidth = 8;
    g.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let x = 0; x <= 90; x += 3) g.lineTo(34 + x, y0 + 56 + k * 26 + Math.sin(x * 0.11) * 8);
      g.stroke();
    }
    // arrow
    g.fillStyle = '#ffc93c';
    g.save();
    g.translate(184, y0 + 64);
    g.rotate(arrow);
    g.beginPath();
    g.moveTo(0, -38);
    g.lineTo(30, -2);
    g.lineTo(11, -2);
    g.lineTo(11, 34);
    g.lineTo(-11, 34);
    g.lineTo(-11, -2);
    g.lineTo(-30, -2);
    g.closePath();
    g.fill();
    g.restore();
  };
  draw(0, 0);
  draw(128, -Math.PI / 2);
  draw(256, Math.PI / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const ARROW_ROW = { ahead: 0, left: 1, right: 2 };
function makeSigns(list) {
  const tex = signTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1 });
  const back = new THREE.MeshStandardMaterial({ color: 0x0b5cad, roughness: 0.4 });
  const iron = M.iron();
  const g = new THREE.Group();
  for (const d of list) {
    const s = new THREE.Group();
    s.position.set(d.at[0], d.at[1], d.at[2]);
    s.rotation.y = d.yaw ?? Math.PI;
    const geo = new THREE.PlaneGeometry(1.0, 0.5);
    const row = ARROW_ROW[d.arrow ?? 'ahead'] ?? 0;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - (row + 1 - uv.getY(i)) / 3);
    const face = new THREE.Mesh(geo, mat);
    face.position.z = 0.016;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.52, 0.03), back);
    s.add(plate, face);
    if (d.hang) {
      for (const x of [-0.4, 0.4]) {
        const wire = new THREE.Mesh(new THREE.BoxGeometry(0.02, d.hang, 0.02), iron);
        wire.position.set(x, 0.25 + d.hang / 2, 0);
        s.add(wire);
      }
    }
    g.add(s);
  }
  return g;
}
