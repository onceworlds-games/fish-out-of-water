// The fish: a skinned body on a short chain of springy joints, glossy while wet and chalky when dry, with big eyes.
// One controller per fish turns its body's motion (and its events) into curls, whips, tumbles and squashes.

import * as THREE from 'three';

// ---------------------------------------------------------------- species

const SPECIES = {
  mackerel: { L: 0.62, H: 0.15, W: 0.085, front: 2, back: 2, tail: 'fork', dorsal: 'two', eye: 0.034, nose: 0.12 },
  goldfish: { L: 0.5, H: 0.22, W: 0.11, front: 2, back: 2, tail: 'fan', dorsal: 'one', eye: 0.045, nose: 0.2 },
  flatfish: { L: 0.56, H: 0.34, W: 0.05, front: 2, back: 2, tail: 'round', dorsal: 'fringe', eye: 0.036, nose: 0.25, flat: true },
  puffer: { L: 0.44, H: 0.27, W: 0.25, front: 2, back: 2, tail: 'small', dorsal: 'none', eye: 0.042, nose: 0.3, spikes: true },
  eel: { L: 0.92, H: 0.085, W: 0.07, front: 2, back: 4, tail: 'eel', dorsal: 'long', eye: 0.026, nose: 0.15 },
};

// Colourways: [dorsal, belly, pattern, fin]
export const COLOURWAYS = {
  mackerel: [
    ['#1d7f8c', '#eef3f2', '#10202a', '#7fb2b8'],
    ['#2f5fb8', '#f2f0ea', '#0f1730', '#8aa8d8'],
    ['#3a8f5c', '#f3efe2', '#12261a', '#9cc4a6'],
  ],
  goldfish: [
    ['#ff7a1a', '#ffd9a8', '#ffffff', '#ffb066'],
    ['#ff4d2e', '#fff1e0', '#ffd23d', '#ff8a6a'],
    ['#f2f0ea', '#ffffff', '#ff6a2a', '#ffd0b0'],
  ],
  flatfish: [
    ['#8a6b45', '#f1e6d2', '#e4783a', '#a88a62'],
    ['#6f7a52', '#efe9d8', '#2d3322', '#93a070'],
    ['#9a8f84', '#f5f0e8', '#4a3a30', '#b8ada0'],
  ],
  puffer: [
    ['#e8c25a', '#fbf6e8', '#6b4a24', '#f0d890'],
    ['#9fd0d8', '#fbfbf6', '#1d4a5a', '#cfe8ec'],
    ['#f29a6a', '#fff4ea', '#7a2a1a', '#f8c8a8'],
  ],
  eel: [
    ['#3b5a4a', '#e8d26a', '#1c2a22', '#5b7a62'],
    ['#4a4a6a', '#f0e0a0', '#1a1a2a', '#6a6a8a'],
    ['#7a5a3a', '#f2e2b0', '#2a1a10', '#9a7a5a'],
  ],
};

const DRY = new THREE.Color('#cfc6b6');

function bodyTexture(species, cw) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const [dorsal, belly, pat] = cw;
  const top = new THREE.Color(dorsal), bot = new THREE.Color(belly), col = new THREE.Color();
  for (let y = 0; y < 128; y++) {
    const v = y / 128;
    const k = (1 - Math.cos(v * Math.PI * 2)) / 2; // 0 at the dorsal line, 1 at the belly
    col.copy(top).lerp(bot, THREE.MathUtils.smoothstep(k, 0.35, 0.75));
    g.fillStyle = `#${col.getHexString()}`;
    g.fillRect(0, y, 256, 1);
  }
  g.fillStyle = pat;
  if (species === 'mackerel') {
    // wavy tiger bars on the back, both sides
    for (let i = 0; i < 16; i++) {
      const x = 20 + i * 14;
      for (const side of [0, 1]) {
        g.beginPath();
        const y0 = side ? 128 : 0;
        const dir = side ? -1 : 1;
        g.moveTo(x, y0);
        for (let s = 0; s <= 10; s++) g.lineTo(x + Math.sin(s * 0.9 + i) * 4 + s * 0.5, y0 + dir * s * 3.2);
        g.lineTo(x + 5, y0 + dir * 32);
        for (let s = 10; s >= 0; s--) g.lineTo(x + 5 + Math.sin(s * 0.9 + i) * 4 + s * 0.5, y0 + dir * s * 3.2);
        g.closePath();
        g.fill();
      }
    }
  } else if (species === 'goldfish') {
    g.globalAlpha = 0.9;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.ellipse(30 + i * 33, 64 + Math.sin(i * 2.3) * 30, 14 + (i % 3) * 6, 10, i, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  } else if (species === 'flatfish' || species === 'puffer') {
    for (let i = 0; i < 46; i++) {
      const x = (i * 37) % 250, y = ((i * 53) % 110) + 4;
      if (species === 'puffer' && y > 40 && y < 88) continue;
      g.beginPath();
      g.arc(x, y, 3 + (i % 4), 0, Math.PI * 2);
      g.fill();
    }
  } else if (species === 'eel') {
    g.globalAlpha = 0.5;
    for (let i = 0; i < 60; i++) {
      g.beginPath();
      g.arc((i * 29) % 256, (i * 41) % 40, 2 + (i % 3), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  // a lateral line and a sheen
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, 30, 256, 2);
  g.fillRect(0, 96, 256, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function profile(sp, u) {
  // u: 0 tail end of the body, 1 the nose. Height and width multipliers.
  const peduncle = sp.tail === 'eel' ? 0.5 : sp.spikes ? 0.35 : 0.16;
  let k = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), sp.spikes ? 0.45 : 0.75);
  if (u > 0.9) k *= 1 - (u - 0.9) * sp.nose * 4;
  if (sp.tail === 'eel') k = u < 0.85 ? 0.75 + 0.25 * Math.sin(u * Math.PI) : (1 - u) / 0.15;
  return peduncle + (1 - peduncle) * Math.max(0, k);
}

const SHAPE_CACHE = new Map();

function finGeometry(points, thickness = 0.004) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);
  return g;
}

function buildGeometry(spId) {
  if (SHAPE_CACHE.has(spId)) return SHAPE_CACHE.get(spId);
  const sp = SPECIES[spId];
  const rings = sp.tail === 'eel' ? 40 : 26;
  const around = 16;
  const pos = [];
  const uv = [];
  const idx = [];
  const L = sp.L;
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const x = -L / 2 + u * L;
    const k = profile(sp, u);
    const hy = (sp.H / 2) * k;
    const hz = (sp.W / 2) * Math.max(0.35, k);
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      // a slightly flattened belly and a keel on top
      const y = Math.cos(a) * hy * (Math.cos(a) < 0 ? 0.92 : 1.0);
      const z = Math.sin(a) * hz;
      pos.push(x, y, z);
      uv.push(u, j / around);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j, b = a + around + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  // nose and tail caps
  const noseI = pos.length / 3;
  pos.push(L / 2 + 0.008, 0, 0);
  uv.push(1, 0.5);
  const tailI = pos.length / 3;
  pos.push(-L / 2 - 0.004, 0, 0);
  uv.push(0, 0.5);
  for (let j = 0; j < around; j++) {
    const a = rings * (around + 1) + j;
    idx.push(a, noseI, a + 1);
    idx.push(j + 1, tailI, j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // bones along x: back chain (tail) then root then front chain (head)
  const nb = sp.back, nf = sp.front;
  const step = L / (nb + nf + 1);
  const boneX = [];
  for (let i = nb; i >= 1; i--) boneX.push(-i * step);
  boneX.push(0);
  for (let i = 1; i <= nf; i++) boneX.push(i * step);
  const si = [], sw = [];
  const P = g.attributes.position;
  for (let v = 0; v < P.count; v++) {
    const x = P.getX(v);
    let a = 0;
    while (a < boneX.length - 2 && x > boneX[a + 1]) a++;
    const t = THREE.MathUtils.clamp((x - boneX[a]) / (boneX[a + 1] - boneX[a]), 0, 1);
    // map positional order to bone indices: [root, front..., back...]
    si.push(orderToBone(a, nb, nf), orderToBone(a + 1, nb, nf), 0, 0);
    sw.push(1 - t, t, 0, 0);
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const out = { geo: g, boneX, step, sp };
  SHAPE_CACHE.set(spId, out);
  return out;
}

// Bone indices in the skeleton: 0 = root; 1..nf = front chain; nf+1..nf+nb = back chain (outward).
function orderToBone(order, nb, nf) {
  if (order === nb) return 0;
  if (order > nb) return order - nb; // front
  return nf + (nb - order); // back: order nb-1 is the first back bone
}

const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
const eyePupil = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.05, metalness: 0.2 });
const eyeGeo = new THREE.SphereGeometry(1, 16, 12);
const tagGeo = new THREE.PlaneGeometry(0.07, 0.05);
const tagMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.5, side: THREE.DoubleSide });

export function createFishMesh(spId = 'mackerel', cwIndex = 0, opts = {}) {
  const { geo, step, sp } = buildGeometry(spId);
  const cw = COLOURWAYS[spId][cwIndex % COLOURWAYS[spId].length];
  const ghost = !!opts.ghost;
  const mat = ghost
    ? new THREE.MeshStandardMaterial({ color: opts.ghostColor ?? 0xbff4ff, transparent: true, opacity: 0.38, roughness: 0.1, emissive: opts.ghostColor ?? 0x4cd3ec, emissiveIntensity: 0.35, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ map: bodyTexture(spId, cw), roughness: 0.28, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.12, iridescence: spId === 'mackerel' ? 0.45 : 0.15, iridescenceIOR: 1.6, envMapIntensity: 1.25 });
  const finMat = ghost ? mat : new THREE.MeshPhysicalMaterial({ color: cw[3], roughness: 0.35, transmission: 0, transparent: true, opacity: 0.88, side: THREE.DoubleSide, clearcoat: 0.6 });

  const bones = [];
  const root = new THREE.Bone();
  bones.push(root);
  let parent = root;
  for (let i = 0; i < sp.front; i++) {
    const b = new THREE.Bone();
    b.position.x = step;
    parent.add(b);
    bones.push(b);
    parent = b;
  }
  parent = root;
  for (let i = 0; i < sp.back; i++) {
    const b = new THREE.Bone();
    b.position.x = -step;
    parent.add(b);
    bones.push(b);
    parent = b;
  }
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(root);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = !ghost;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  const head = bones[sp.front];
  const tailBone = bones[sp.front + sp.back];
  const headX = sp.L / 2 - sp.front * step; // nose relative to the last front bone

  // tail fin
  const T = sp.H;
  let tail;
  if (sp.tail === 'fork') tail = finGeometry([[0, 0], [-0.13, T * 0.75], [-0.09, 0], [-0.13, -T * 0.75]]);
  else if (sp.tail === 'fan') tail = finGeometry([[0, 0], [-0.1, T * 0.6], [-0.2, T * 0.75], [-0.17, 0], [-0.2, -T * 0.75], [-0.1, -T * 0.6]]);
  else if (sp.tail === 'round') tail = finGeometry([[0, 0], [-0.06, T * 0.25], [-0.1, 0.0], [-0.06, -T * 0.25]]);
  else if (sp.tail === 'small') tail = finGeometry([[0, 0], [-0.07, T * 0.3], [-0.06, 0], [-0.07, -T * 0.3]]);
  else tail = finGeometry([[0.02, 0], [-0.08, T * 0.5], [-0.1, 0], [-0.08, -T * 0.5]]);
  const tailMesh = new THREE.Mesh(tail, finMat);
  tailMesh.position.x = -(sp.L / 2 - sp.back * step) + 0.01;
  tailMesh.castShadow = !ghost;
  tailBone.add(tailMesh);

  // dorsal and belly fins
  const fins = [];
  const addFin = (bone, pts, x, y) => {
    const f = new THREE.Mesh(finGeometry(pts), finMat);
    f.position.set(x, y, 0);
    f.castShadow = !ghost;
    bone.add(f);
    fins.push(f);
  };
  const H2 = sp.H / 2;
  if (sp.dorsal === 'two') {
    addFin(root, [[0.06, 0], [0.0, 0.06], [-0.05, 0]], 0.02, H2 * 0.9);
    addFin(bones[sp.front + 1], [[0.04, 0], [0.0, 0.035], [-0.03, 0]], 0.0, H2 * 0.6);
    addFin(root, [[0.04, 0], [0.0, -0.035], [-0.04, 0]], -0.03, -H2 * 0.85);
  } else if (sp.dorsal === 'one') {
    addFin(root, [[0.07, 0], [-0.02, 0.08], [-0.07, 0]], 0.0, H2 * 0.9);
  } else if (sp.dorsal === 'fringe') {
    addFin(root, [[0.2, 0], [0.1, 0.05], [-0.12, 0.05], [-0.22, 0]], 0.0, H2 * 0.92);
    addFin(root, [[0.18, 0], [0.08, -0.045], [-0.12, -0.045], [-0.2, 0]], 0.0, -H2 * 0.92);
  } else if (sp.dorsal === 'long') {
    for (let i = 1; i <= sp.back; i++) addFin(bones[sp.front + i], [[step * 0.5, 0], [0, 0.03], [-step * 0.5, 0.03], [-step * 0.6, 0]], 0, H2 * 0.9);
  }
  // pectoral fins (on the side that faces up when lying down, and the other)
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(finGeometry([[0, 0], [-0.06, 0.025], [-0.05, -0.01]]), finMat);
    f.position.set(-0.01, -H2 * 0.25, s * (sp.W / 2) * 0.9);
    f.rotation.y = s * 0.5;
    head.add(f);
    fins.push(f);
  }
  // spikes
  if (sp.spikes) {
    const sg = new THREE.ConeGeometry(0.012, 0.04, 5);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 * 3.1;
      const u = 0.2 + ((i * 37) % 26) / 26 * 0.6;
      const x = -sp.L / 2 + u * sp.L;
      const k = profile(sp, u);
      const y = Math.cos(a) * (sp.H / 2) * k, z = Math.sin(a) * (sp.W / 2) * k;
      const m = new THREE.Mesh(sg, finMat);
      m.position.set(x, y, z);
      m.lookAt(x, y * 2, z * 2);
      m.rotateX(Math.PI / 2);
      root.add(m);
    }
  }

  // eyes: the up side (z+) and the down side; a flatfish has both on top
  const eyes = [];
  const er = sp.eye;
  const eyeSpots = sp.flat
    ? [[headX - 0.05, H2 * 0.25, 1], [headX - 0.09, H2 * 0.55, 1]]
    : [[headX - sp.L * 0.12, H2 * 0.22, 1], [headX - sp.L * 0.12, H2 * 0.22, -1]];
  for (const [x, y, s] of eyeSpots) {
    const k = profile(sp, (x + sp.front * step + sp.L / 2) / sp.L);
    const z = s * ((sp.W / 2) * Math.max(0.35, k) * 0.86);
    const eg = new THREE.Group();
    eg.position.set(x, y, z);
    const w = new THREE.Mesh(eyeGeo, ghost ? mat : eyeWhite);
    w.scale.set(er, er, er * 0.7);
    eg.add(w);
    const p = new THREE.Mesh(eyeGeo, ghost ? mat : eyePupil);
    p.scale.setScalar(er * 0.55);
    p.position.z = s * er * 0.42;
    eg.add(p);
    const hl = new THREE.Mesh(eyeGeo, ghost ? mat : eyeWhite);
    hl.scale.setScalar(er * 0.17);
    hl.position.set(er * 0.2, er * 0.25, s * er * 0.68);
    eg.add(hl);
    head.add(eg);
    eyes.push({ group: eg, pupil: p, side: s });
  }
  // mouth
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ color: 0x5a1f22, roughness: 0.6 }));
  mouth.scale.set(0.012, 0.01, 0.02);
  mouth.position.set(headX - 0.005, -H2 * 0.2, 0);
  head.add(mouth);

  // the price tag pinned to the back, in the seat's pin colour
  let tag = null;
  if (!ghost && opts.tag !== false) {
    tag = new THREE.Group();
    const tm = new THREE.Mesh(tagGeo, tagMat);
    tm.position.set(0, 0.04, 0);
    tag.add(tm);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshStandardMaterial({ color: opts.pin ?? '#ffc93c', roughness: 0.3 }));
    pin.position.set(-0.022, 0.055, 0.004);
    tag.add(pin);
    tag.position.set(-0.04, H2 * 0.85, 0);
    tag.rotation.z = 0.3;
    root.add(tag);
  }

  return { mesh, bones, sp, spId, mat, finMat, eyes, mouth, tag, tail: tailMesh, fins, cw, ghost };
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * A fish's look in motion. update(dt, s): s = { x, y, z, vx, vy, vz, aim, curl, ground, wet (0..1), state, puff }.
 * events(list): the body's events since the last frame (flop, land, knock, refill, dry...).
 */
export function createFishView(spId, cwIndex, opts = {}) {
  const f = createFishMesh(spId, cwIndex, opts);
  const group = new THREE.Group(); // position + heading
  const tumble = new THREE.Group(); // pitch and roll
  group.add(tumble);
  tumble.add(f.mesh);
  f.mesh.rotation.x = -Math.PI / 2; // lying on its side: lateral axis (z) up
  const n = f.sp.front + f.sp.back;
  const bend = new Float32Array(n + 1);
  const bendV = new Float32Array(n + 1);
  const st = {
    heading: opts.yaw ?? 0,
    roll: 0, // extra roll about the long axis (0 or PI: which side is down)
    rollV: 0,
    pitch: 0,
    squash: 0,
    squashV: 0,
    eyeOpen: 1,
    wide: 0,
    blink: 2 + Math.random() * 3,
    twitch: 1 + Math.random() * 2,
    t: Math.random() * 10,
    puff: 0,
    wet: 1,
    lift: 0,
    spin: 0,
    flight: false,
  };
  const offY = -0.16 + f.sp.W / 2 + 0.005;
  const broad = opts.broadside !== false;
  const view = {
    group,
    fish: f,
    events(list) {
      for (const e of list) {
        if (e.type === 'flop') {
          for (let i = 0; i <= n; i++) bendV[i] -= 9 + e.charge * 10;
          st.squashV -= 6;
          st.wide = 0.45;
          st.spin = (broad || Math.random() < 0.5 ? 1 : -1) * (4.5 + e.charge * 5.5);
          st.flight = true;
        } else if (e.type === 'land') {
          const k = Math.min(1, e.speed / 9);
          for (let i = 0; i <= n; i++) bendV[i] += (i % 2 ? 1 : -1) * 12 * k;
          st.squash = 0.35 * k;
          st.squashV = 0;
          st.spin *= 0.2;
          st.flight = false;
          if (f.sp.spikes) st.puff = 1;
        } else if (e.type === 'knock') {
          st.spin = (Math.random() < 0.5 ? -1 : 1) * 12;
          st.flight = true;
          for (let i = 0; i <= n; i++) bendV[i] += 14;
          st.wide = 0.6;
        } else if (e.type === 'refill') {
          st.wide = Math.max(st.wide, 0.2);
        } else if (e.type === 'respawn') {
          st.squash = 0.4;
          st.flight = false;
          st.spin = 0;
        }
      }
    },
    update(dt, s) {
      st.t += dt;
      group.position.set(s.x, s.y + offY, s.z);
      const hs = Math.hypot(s.vx, s.vz);
      // heading: broadside to the aim (head to the left of a camera behind it) on the ground, so the curl reads as a
      // fish; held through a flight, where it log-rolls forward. Nose-first fish (posed shots) follow their travel.
      let want = st.heading;
      if (broad) {
        if (s.ground || !st.flight) want = s.aim + Math.PI / 2;
      } else if (s.curl > 0.02 && s.ground) want = s.aim;
      else if (!s.ground && hs > 0.8) want = Math.atan2(s.vx, s.vz);
      let d = want - st.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      st.heading += d * Math.min(1, dt * (s.ground ? 14 : 8));
      group.rotation.y = st.heading - Math.PI / 2;

      // pitch: nose follows the arc in flight
      const wantPitch = !broad && !s.ground && hs + Math.abs(s.vy) > 1 ? Math.atan2(s.vy, Math.max(0.5, hs)) * 0.7 : 0;
      st.pitch += (wantPitch - st.pitch) * Math.min(1, dt * 10);
      // roll: a comic barrel roll in flight, back to lying flat (either side) on the ground
      // springs step at most 1/90 s at a time, so a long frame can't blow them up
      const subs = Math.max(1, Math.ceil(dt * 90));
      const h = dt / subs;
      if (st.flight && !s.ground) st.roll += st.spin * dt;
      else {
        const target = Math.round(st.roll / Math.PI) * Math.PI;
        for (let k = 0; k < subs; k++) {
          st.rollV += ((target - st.roll) * 160 - st.rollV * 16) * h;
          st.roll += st.rollV * h;
        }
      }
      tumble.rotation.set(st.roll, 0, st.pitch, 'XYZ');

      // the spine: springs toward a target shape
      const curl = s.curl;
      const flying = !s.ground && st.flight;
      st.twitch -= dt;
      if (s.ground && curl < 0.02 && st.twitch <= 0 && s.state !== 'done') {
        st.twitch = s.state === 'dry' ? 0.35 : 1.4 + Math.random() * 2.2;
        const k = s.state === 'dry' ? 0.6 : 1;
        for (let i = 0; i <= n; i++) bendV[i] += (Math.random() < 0.5 ? 1 : -1) * 6 * k;
      }
      const flip = Math.cos(st.roll) >= 0 ? 1 : -1; // curl toward the sky whichever side is down
      for (let i = 0; i <= n; i++) {
        let target = curl * 0.62 * flip;
        if (flying) target = Math.sin(st.t * 15 + i * 1.1) * 0.32;
        if (s.state === 'dry') target = Math.sin(st.t * 3 + i) * 0.15;
        for (let k = 0; k < subs; k++) {
          bendV[i] += ((target - bend[i]) * 220 - bendV[i] * 14) * h;
          bend[i] += bendV[i] * h;
        }
      }
      // apply: front bones bend one way, back bones the other, so both ends lift
      const B = f.bones;
      const nf = f.sp.front;
      for (let i = 1; i <= nf; i++) B[i].rotation.y = -bend[i - 1] * (i === 1 ? 0.8 : 1.1);
      for (let i = 1; i <= f.sp.back; i++) B[nf + i].rotation.y = bend[nf + i - 1] * (i === 1 ? 0.8 : 1.1);
      // squash and stretch: anticipation while curling, splat on landing
      for (let k = 0; k < subs; k++) {
        st.squashV += (-st.squash * 260 - st.squashV * 16) * h;
        st.squash += st.squashV * h;
      }
      const sq = st.squash + curl * 0.12;
      st.puff = Math.max(0, st.puff - dt * 1.6);
      const puff = f.sp.spikes ? 1 + st.puff * 0.35 : 1;
      f.mesh.scale.set((1 - sq * 0.4) * puff, (1 + sq * 0.5) * puff, (1 + sq * 0.6) * puff);

      // eyes: squint while charging hard, wide on a flop, blink now and then
      st.wide = Math.max(0, st.wide - dt * 1.4);
      st.blink -= dt;
      let open = 1 - Math.max(0, curl - 0.55) * 1.6 + st.wide * 0.9;
      if (st.blink < 0) {
        open *= 0.1;
        if (st.blink < -0.12) st.blink = 2 + Math.random() * 4;
      }
      if (s.state === 'dry' || s.wet < 0.15) open *= 0.55;
      st.eyeOpen += (open - st.eyeOpen) * Math.min(1, dt * 20);
      for (const e of f.eyes) e.group.scale.set(1, Math.max(0.12, st.eyeOpen), 1);
      // the mouth gasps when dry
      const gasp = s.wet < 0.35 || s.state === 'dry' ? 0.5 + 0.5 * Math.sin(st.t * (s.wet < 0.15 ? 14 : 7)) : 0.15;
      f.mouth.scale.set(0.012, 0.006 + gasp * 0.014, 0.02);

      // wet to dry
      st.wet += (s.wet - st.wet) * Math.min(1, dt * 4);
      if (!f.ghost) {
        const w = st.wet;
        f.mat.roughness = 0.22 + (1 - w) * 0.58;
        f.mat.clearcoat = 0.08 + w * 0.92;
        f.mat.color.copy(DRY).lerp(WHITE, Math.min(1, w * 1.3));
        f.mat.iridescence = (f.spId === 'mackerel' ? 0.45 : 0.15) * w;
      }
      if (f.tag) f.tag.rotation.z = 0.3 + bend[nf] * 0.6 + Math.sin(st.t * 9) * 0.05;
    },
    setVisible(v) {
      group.visible = v;
    },
    dispose() {
      // everything this fish made for itself (the body geometry, eyes and tag pieces are shared)
      const shared = new Set([f.mesh.geometry, eyeGeo, tagGeo, eyeWhite, eyePupil, tagMat]);
      group.traverse((o) => {
        if (!o.isMesh) return;
        if (!shared.has(o.geometry)) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (shared.has(m)) continue;
          m.map?.dispose();
          m.dispose();
        }
      });
    },
  };
  return view;
}

const WHITE = new THREE.Color(1, 1, 1);
export { UP };
