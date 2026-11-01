// What hazards look like: the market cat on its barrel, shoppers' legs, and the red warning painted on the floor before
// each one strikes. Driven by the same state functions the physics uses (sim/hazards.js), so what you see is what hits.

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

const warnMat = () => new THREE.MeshBasicMaterial({ color: 0xe4432d, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const shadowMat = () => new THREE.MeshBasicMaterial({ color: 0x1a1d22, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });

const std = (color, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough });

export function createHazardViews(course, hazards, opts = {}) {
  const root = new THREE.Group();
  const items = [];
  hazards.list.forEach((hz, i) => {
    const make = MAKERS[hz.kind];
    if (!make) return;
    const it = make(hz, opts);
    root.add(it.group);
    items.push({ hz, i, it });
  });
  let lastT = 0;
  return {
    root,
    /** t: race seconds. events: optional sink for sounds { type, x, z }. */
    update(t, dt, sink) {
      const states = hazards.at(t);
      for (const { i, it, hz } of items) it.update(states[i], t, dt, sink, hz);
      lastT = t;
    },
    get t() {
      return lastT;
    },
    dispose() {
      root.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (o.material.dispose) o.material.dispose();
        }
      });
    },
  };
}

// ---------------------------------------------------------------- the cat

function makeCat(hz) {
  const group = new THREE.Group();
  const fur = std(0xd9843a, 0.85);
  const belly = std(0xf4efe6, 0.9);
  const dark = std(0x1a1d22, 0.4);
  const pink = std(0xf28ac0, 0.6);
  const cat = new THREE.Group();
  cat.position.set(hz.at[0], hz.at[1], hz.at[2]);
  group.add(cat);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12), fur);
  body.scale.set(1, 0.95, 1.35);
  body.position.y = 0.24;
  body.castShadow = true;
  cat.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), belly);
  chest.position.set(0, 0.26, 0.2);
  cat.add(chest);
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.22);
  cat.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), fur);
  skull.scale.set(1.08, 0.92, 0.95);
  skull.castShadow = true;
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), belly);
  muzzle.position.set(0, -0.05, 0.13);
  muzzle.scale.set(1.3, 0.8, 0.8);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), pink);
  nose.position.set(0, -0.02, 0.19);
  head.add(nose);
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std(0xc8e04a, 0.2));
    eye.position.set(s * 0.068, 0.03, 0.135);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.01), dark);
    pupil.position.set(s * 0.068, 0.03, 0.168);
    head.add(pupil);
    eyes.push(pupil);
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.15, 4), fur);
    ear.position.set(s * 0.1, 0.15, -0.01);
    ear.rotation.set(0, Math.PI / 4, s * -0.25);
    head.add(ear);
    ears.push(ear);
  }
  // tail: a curve of spheres
  const tail = [];
  for (let k = 0; k < 7; k++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.05 - k * 0.003, 8, 6), k > 4 ? belly : fur);
    cat.add(seg);
    tail.push(seg);
  }
  // the swiping paw
  const pawArm = new THREE.Group();
  pawArm.position.set(0, 0.3, 0.18);
  cat.add(pawArm);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.42, 8), fur);
  arm.position.y = -0.21;
  pawArm.add(arm);
  const paw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), belly);
  paw.position.y = -0.43;
  pawArm.add(paw);
  for (const s of [-1, 0, 1]) {
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 5), std(0xffffff, 0.3));
    claw.position.set(s * 0.03, -0.49, 0.03);
    claw.rotation.x = Math.PI;
    pawArm.add(claw);
  }

  // the warning: a half disc on the side it will swipe
  const warn = new THREE.Mesh(new THREE.RingGeometry(0.42, hz.radius, 40, 1, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), warnMat());
  warn.position.set(hz.at[0], hz.floor + 0.025, hz.at[2]);
  group.add(warn);
  const edge = new THREE.Mesh(new THREE.RingGeometry(hz.radius - 0.08, hz.radius, 40, 1, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), warnMat());
  edge.position.copy(warn.position);
  edge.position.y += 0.002;
  group.add(edge);

  let face = 0;
  let lastCycle = -1;
  return {
    group,
    update(s, t, dt, sink) {
      // turn to face the side about to be swiped
      const want = s.side > 0 ? Math.PI / 2 : -Math.PI / 2;
      let d = want - face;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      face += d * Math.min(1, dt * 7);
      cat.rotation.y = face;
      const crouch = s.tele > 0 ? Math.min(1, s.tele * 1.4) : 0;
      body.scale.y = 0.95 - crouch * 0.12;
      head.position.y = 0.52 - crouch * 0.09;
      head.rotation.x = crouch * 0.25;
      for (const [k, e] of ears.entries()) e.rotation.z = (k ? -1 : 1) * (0.25 + crouch * 0.9);
      for (const p of eyes) p.scale.x = 1 - crouch * 0.6;
      // the swipe: the paw sweeps out across the half disc
      const sw = s.swipe;
      const reach = sw > 0 && sw < 1 ? Math.sin(sw * Math.PI) : 0;
      pawArm.rotation.x = -0.2 - crouch * 0.4 - reach * 1.4;
      pawArm.rotation.z = reach * Math.sin(sw * Math.PI * 2) * 0.9;
      pawArm.scale.setScalar(1 + reach * 1.2);
      // tail: lazy sway, a lash when it strikes
      const lash = s.striking ? 1 : crouch;
      for (let k = 0; k < tail.length; k++) {
        const a = Math.sin(t * (2 + lash * 6) + k * 0.6) * (0.15 + lash * 0.25) * (k / tail.length);
        tail[k].position.set(Math.sin(a) * k * 0.06, 0.16 + k * 0.055, -0.3 - Math.cos(a) * k * 0.05);
      }
      const op = s.tele > 0 ? 0.25 + s.tele * 0.55 : s.striking ? 0.9 : 0;
      warn.material.opacity = op * 0.55;
      edge.material.opacity = op;
      warn.rotation.y = s.side > 0 ? 0 : Math.PI;
      edge.rotation.y = warn.rotation.y;
      if (s.striking && s.cycle !== lastCycle) {
        lastCycle = s.cycle;
        sink?.push({ type: 'swipe', x: hz.at[0], z: hz.at[2] });
      }
    },
  };
}

// ---------------------------------------------------------------- shoppers' legs

const TROUSERS = [0x2f5d8a, 0xcb6b3f, 0x5b6b3a, 0x3a3f47];
const SHOES = [0xe4432d, 0x6b3f22, 0xffc93c, 0xf4efe6];
const COATS = [0x1a1d22, 0xffc93c, 0xf4efe6, 0x0b5cad];
const BAGS = [0xe4432d, 0x4cd3ec, 0xcb6b3f, 0xffc93c];

/** Squared distance from point p to the segment a-b (THREE.Vector3s). */
function segDist2(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz || 1;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2));
  const dx = p.x - a.x - abx * k, dy = p.y - a.y - aby * k, dz = p.z - a.z - abz * k;
  return dx * dx + dy * dy + dz * dz;
}

function makeFeet(hz, opts = {}) {
  const cam = opts.camera ?? null;
  const group = new THREE.Group();
  const look = hz.look ?? 0;
  const cloth = std(TROUSERS[look % 4], 0.85);
  const shoeM = std(SHOES[look % 4], 0.5);
  const soleM = std(0x1a1d22, 0.6);
  const legs = [];
  for (let j = 0; j < 2; j++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1, 12, 1, true), cloth);
    leg.castShadow = true;
    group.add(leg);
    const shoe = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), shoeM);
    upper.scale.set(0.85, 0.55, 1.75);
    upper.position.set(0, 0.09, 0.08);
    upper.castShadow = true;
    shoe.add(upper);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.56), soleM);
    sole.position.set(0, 0.025, 0.08);
    shoe.add(sole);
    group.add(shoe);
    legs.push({ leg, shoe });
  }
  // the bottom of a coat and a shopping bag: a person far too big to see whole
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 1.3, 18, 1, true), std(COATS[look % 4], 0.8));
  coat.material.side = THREE.DoubleSide;
  coat.castShadow = true;
  group.add(coat);
  const bag = new THREE.Group();
  const bagBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.2), std(BAGS[look % 4], 0.75));
  bagBody.position.y = -0.55;
  bagBody.castShadow = true;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 6, 16, Math.PI), std(0x1a1d22, 0.5));
  handle.position.y = -0.3;
  const leek = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), std(0x5b8a3a, 0.7));
  leek.position.set(0.1, -0.25, 0);
  leek.rotation.z = 0.2;
  bag.add(bagBody, handle, leek);
  group.add(bag);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(hz.reach ?? 0.42, 24).rotateX(-Math.PI / 2), shadowMat());
  shadow.scale.z = 1.5;
  group.add(shadow);
  const ring = new THREE.Mesh(new THREE.RingGeometry((hz.reach ?? 0.42) - 0.05, hz.reach ?? 0.42, 32).rotateX(-Math.PI / 2), warnMat());
  ring.scale.z = 1.5;
  group.add(ring);
  let lastStep = -1;
  const HIP = 2.5;
  return {
    group,
    update(s, t, dt, sink) {
      const stride = hz.stride;
      const dir = Math.atan2(s.dx, s.dz);
      const planted = s.feet[0];
      const next = s.feet[1];
      const lift = Math.sin(Math.PI * s.local);
      // the swinging foot travels from two strides back to its next spot
      const back = hz.speed * stride * 2;
      const sx = next.x - next.dx * back * (1 - s.local);
      const sz = next.z - next.dz * back * (1 - s.local);
      const pos = [
        [planted.x, 0, planted.z, 0],
        [sx, lift * 0.38, sz, lift],
      ];
      const hipX = s.x, hipZ = s.z;
      for (let j = 0; j < 2; j++) {
        const [x, y, z, l] = pos[j];
        const { leg, shoe } = legs[j];
        shoe.position.set(x, y, z);
        shoe.rotation.set(-l * 0.35, dir, 0);
        const side = j === 0 ? planted.side : -planted.side;
        tmpA.set(x, y + 0.14, z);
        tmpB.set(hipX + -s.dz * 0.15 * side, HIP, hipZ + s.dx * 0.15 * side);
        const len = tmpA.distanceTo(tmpB);
        // a leg striding through the chase camera steps out of the picture instead of filling it
        leg.visible = !cam || segDist2(cam.position, tmpA, tmpB) > 0.45 * 0.45;
        leg.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
        leg.scale.set(1, len, 1);
        tmpB.sub(tmpA).normalize();
        tmpQ.setFromUnitVectors(UP, tmpB);
        leg.quaternion.copy(tmpQ);
      }
      coat.position.set(hipX, HIP + 0.55, hipZ);
      coat.rotation.y = dir;
      const sway = Math.sin((s.step + s.local) * Math.PI) * 0.18;
      bag.position.set(hipX + s.dz * 0.62, 1.75, hipZ - s.dx * 0.62);
      bag.rotation.set(sway, dir, sway * 0.4);
      if (cam) {
        const p = cam.position;
        bag.visible = (p.x - bag.position.x) ** 2 + (p.y - 1.5) ** 2 + (p.z - bag.position.z) ** 2 > 0.6 * 0.6;
        coat.visible = p.y < 2.2 || (p.x - hipX) ** 2 + (p.z - hipZ) ** 2 > 0.8 * 0.8;
      }
      shadow.position.set(next.x, 0.02, next.z);
      shadow.rotation.y = dir;
      shadow.material.opacity = s.tele > 0 ? 0.12 + s.tele * 0.4 : 0;
      ring.position.set(next.x, 0.024, next.z);
      ring.rotation.y = dir;
      ring.material.opacity = s.tele > 0 ? s.tele * 0.85 : 0;
      if (s.step !== lastStep) {
        lastStep = s.step;
        sink?.push({ type: 'stomp', x: planted.x, z: planted.z });
      }
    },
  };
}

// ---------------------------------------------------------------- the chef

function checks(a, b, n = 8) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const s = 64 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? a : b;
      g.fillRect(i * s, j * s, s, s);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 6);
  return t;
}

const lerp3 = (out, a, b, k) => out.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

function makeChef(hz) {
  const group = new THREE.Group();
  const chef = new THREE.Group();
  group.add(chef);
  const whites = std(0xf7f4ee, 0.8);
  const trousers = new THREE.MeshStandardMaterial({ map: checks('#1a1d22', '#f4efe6'), roughness: 0.85 });
  const clogM = std(0x1a1d22, 0.45);
  const skin = std(0xe9a77c, 0.65);
  const hair = std(0x3a2418, 0.7);
  const red = std(0xe4432d, 0.6);
  const iron = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.35, metalness: 0.7 });
  const wood = std(0x8a5a34, 0.7);
  const HIP = 2.6;
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 1, 14, 1, true), trousers);
    leg.castShadow = true;
    const clog = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), clogM);
    clog.scale.set(1, 0.6, 1.7);
    clog.castShadow = true;
    chef.add(leg, clog);
    legs.push({ leg, clog, sx });
  }
  // the body bends at the hip
  const torso = new THREE.Group();
  torso.position.set(0, HIP, 0);
  chef.add(torso);
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 1.75, 18), whites);
  jacket.position.y = 0.85;
  jacket.castShadow = true;
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.565, 0.6, 1.0, 18, 1, true, -0.9, 1.8), std(0x2f5d8a, 0.8));
  apron.position.y = 0.2;
  const buttons = [];
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), iron);
      b.position.set(sx * 0.2, 0.75 + i * 0.25, 0.6);
      buttons.push(b);
    }
  }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.09, 8, 18), red);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.75;
  const head = new THREE.Group();
  head.position.y = 2.15;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), skin);
  face.castShadow = true;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skin);
  nose.position.set(0, -0.02, 0.42);
  const tache = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.055, 6, 14, Math.PI), hair);
  tache.position.set(0, -0.12, 0.38);
  tache.rotation.z = Math.PI;
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0x1a1d22, 0.3));
    e.position.set(sx * 0.15, 0.1, 0.38);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), hair);
    brow.position.set(sx * 0.15, 0.2, 0.38);
    head.add(e, brow);
    eyes.push(brow);
  }
  // the toque: a band and a puffed top
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 18), whites);
  band.position.y = 0.45;
  head.add(face, nose, tache, band);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), whites);
    puff.position.set(Math.cos(a) * 0.22, 0.85, Math.sin(a) * 0.22);
    head.add(puff);
  }
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), whites);
  top.position.y = 0.95;
  head.add(top);
  torso.add(jacket, apron, scarf, head, ...buttons);
  // the free arm on the hip
  const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 1.2, 10), whites);
  elbow.position.set(0.72, 1.0, 0);
  elbow.rotation.z = -0.6;
  torso.add(elbow);
  // the pan arm: a sleeve from the shoulder to the hand, drawn between two points each frame
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 1, 10), whites);
  sleeve.castShadow = true;
  chef.add(sleeve);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
  chef.add(hand);
  const pan = new THREE.Group();
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.66, 0.16, 28), iron);
  dish.castShadow = true;
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.66, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.25, metalness: 0.8 }));
  inside.position.y = 0.081;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 8), wood);
  handle.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, 0.57, -0.82));
  handle.position.set(0, 0.57 * 1.25, -0.82 * 1.25);
  pan.add(dish, inside, handle);
  chef.add(pan);

  // the warning circle and the dust ring after a slam
  const warn = new THREE.Mesh(new THREE.CircleGeometry(hz.radius, 40).rotateX(-Math.PI / 2), warnMat());
  const edge = new THREE.Mesh(new THREE.RingGeometry(hz.radius - 0.1, hz.radius, 40).rotateX(-Math.PI / 2), warnMat());
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  group.add(warn, edge, wave);

  // the pan's poses: at his side (handle up), over his head (upside down), flat on the floor (handle up to his hand)
  const REST = [-0.95, 1.4, 0.3];
  const UPP = [-0.5, 5.9, -1.2];
  const SLAM = [0, 0.08, hz.back];
  const HDIR = new THREE.Vector3(0, 0.57, -0.82);
  const P = new THREE.Vector3();
  const Hd = new THREE.Vector3();
  const Sh = new THREE.Vector3();
  let lastCycle = -1;
  return {
    group,
    update(s, t, dt, sink) {
      chef.position.set(s.x, hz.floor, s.z);
      chef.rotation.y = Math.PI; // facing the fish coming down the line
      const raise = ease(s.tele > 0 ? s.tele * 1.25 : 0);
      const slam = s.after > 0 ? ease(Math.min(1, (s.after * (hz.period - hz.slamAt)) / 0.1)) : 0;
      const lift = s.after > 0.45 ? ease((s.after - 0.45) / 0.55) : 0;
      let rx, bend;
      if (s.after > 0 && lift > 0) {
        lerp3(P, SLAM, REST, lift);
        rx = Math.PI * 2 + 0.97 * lift;
        bend = 1.0 * (1 - lift);
      } else if (s.after > 0) {
        lerp3(P, UPP, SLAM, slam);
        P.y += Math.sin(slam * Math.PI) * 1.2;
        P.z += Math.sin(slam * Math.PI) * 0.8;
        rx = 3.17 + (Math.PI * 2 - 3.17) * slam;
        bend = 1.0 * slam - 0.18 * (1 - slam);
      } else {
        lerp3(P, REST, UPP, raise);
        rx = 0.97 + (3.17 - 0.97) * raise;
        bend = -0.18 * raise;
      }
      pan.position.copy(P);
      pan.rotation.set(rx, 0, 0);
      torso.rotation.x = bend;
      head.rotation.x = -bend * 0.6;
      for (const b of eyes) b.rotation.z = raise * 0.3 * Math.sign(b.position.x);
      // the arm from the shoulder to the handle
      Sh.set(-0.62, HIP + Math.cos(bend) * 1.55, Math.sin(bend) * 1.55);
      Hd.copy(HDIR).applyEuler(pan.rotation).multiplyScalar(1.8).add(P);
      hand.position.copy(Hd);
      const len = Sh.distanceTo(Hd);
      sleeve.position.copy(Sh).add(Hd).multiplyScalar(0.5);
      sleeve.scale.set(1, len, 1);
      tmpB.copy(Hd).sub(Sh).normalize();
      sleeve.quaternion.setFromUnitVectors(UP, tmpB);
      // feet: stepping while he walks
      for (const { leg, clog, sx } of legs) {
        const ph = s.walking ? Math.sin(s.walk * Math.PI * 4 + (sx > 0 ? 0 : Math.PI)) : 0;
        const fy = Math.max(0, ph) * 0.3;
        const fz = ph * 0.35;
        clog.position.set(sx * 0.32, 0.12 + fy, fz + 0.12);
        tmpA.set(sx * 0.32, 0.25 + fy, fz);
        tmpB.set(sx * 0.3, HIP + 0.1, 0);
        leg.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
        leg.scale.set(1, tmpA.distanceTo(tmpB), 1);
        tmpB.sub(tmpA).normalize();
        leg.quaternion.setFromUnitVectors(UP, tmpB);
      }
      // the floor: red while the pan is up, a white ring after it lands
      const op = s.tele > 0 ? 0.25 + s.tele * 0.6 : s.striking ? 0.95 : 0;
      warn.position.set(s.sx, hz.floor + 0.022, s.sz);
      edge.position.set(s.sx, hz.floor + 0.024, s.sz);
      warn.material.opacity = op * 0.5;
      edge.material.opacity = op;
      const w = s.after > 0 ? Math.min(1, s.after * 2.2) : 1;
      wave.position.set(s.sx, hz.floor + 0.03, s.sz);
      wave.scale.setScalar(hz.radius * (0.5 + w * 0.9));
      wave.material.opacity = s.after > 0 ? (1 - w) * 0.8 : 0;
      if (s.striking && s.cycle !== lastCycle) {
        lastCycle = s.cycle;
        sink?.push({ type: 'slam', x: s.sx, z: s.sz });
      }
    },
  };
}

// ---------------------------------------------------------------- gulls

function gullMesh(lucky) {
  const g = new THREE.Group();
  const white = std(lucky ? 0xffd75a : 0xfbfaf6, 0.7);
  const grey = std(lucky ? 0xf0a830 : 0xb9c2c9, 0.7);
  const black = std(0x1a1d22, 0.5);
  const beakM = std(0xffc93c, 0.5);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), white);
  body.scale.set(1, 0.9, 2.0);
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), white);
  head.position.set(0, 0.12, 0.42);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 8), beakM);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.09, 0.66);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), std(0xe4432d, 0.5));
  dot.position.set(0, 0.06, 0.66);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), black);
    e.position.set(sx * 0.11, 0.18, 0.5);
    eyes.push(e);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), grey);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.y = 1;
  tail.position.set(0, 0.02, -0.52);
  g.add(body, head, beak, dot, tail, ...eyes);
  const wings = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.16, 0.08, 0.05);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.34), grey);
    inner.position.x = sx * 0.31;
    inner.castShadow = true;
    const outerPivot = new THREE.Group();
    outerPivot.position.x = sx * 0.62;
    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.26), grey);
    outer.position.set(sx * 0.25, 0, -0.03);
    outer.castShadow = true;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.026, 0.22), black);
    tip.position.set(sx * 0.42, 0, -0.04);
    outerPivot.add(outer, tip);
    pivot.add(inner, outerPivot);
    g.add(pivot);
    wings.push({ pivot, outerPivot, sx });
  }
  g.scale.setScalar(lucky ? 1.5 : 1.25);
  return { g, wings };
}

function makeGull(hz) {
  const group = new THREE.Group();
  const { g, wings } = gullMesh(hz.lucky);
  group.add(g);
  const floorY = (st) => st.at[1] + 0.02;
  // its shadow on the sand, and the ring where it will land (lemon for the lucky gull)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), shadowMat());
  shadow.scale.set(1.6, 1, 0.8);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), warnMat());
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), warnMat());
  if (hz.lucky) {
    ring.material.color.set(0xffc93c);
    disc.material.color.set(0xffc93c);
  }
  group.add(shadow, ring, disc);
  let lastDive = -1;
  let flap = Math.random() * 6;
  return {
    group,
    update(s, t, dt, sink) {
      const p = s.pos;
      g.position.set(p[0], p[1], p[2]);
      g.rotation.set(0, s.heading, 0);
      // wings: glide with a flap now and then, tucked in a dive, beating hard while carrying
      let amp = 0.25, rate = 4;
      if (s.mode === 'dive') {
        amp = 0.05;
        g.rotation.x = 0.5 * s.tele;
      } else g.rotation.x = s.mode === 'carry' ? -0.15 : 0;
      if (s.mode === 'carry' || s.mode === 'back' || s.mode === 'strike') {
        amp = 0.75;
        rate = 13;
      } else if (s.mode === 'cruise') {
        const burst = Math.sin(t * 0.7 + hz.phase) > 0.6;
        amp = burst ? 0.55 : 0.12;
        rate = burst ? 9 : 2;
      }
      flap += dt * rate;
      const a = Math.sin(flap) * amp;
      const tuck = s.mode === 'dive' ? 0.9 * s.tele : 0;
      for (const w of wings) {
        w.pivot.rotation.z = w.sx * (a + 0.08) ;
        w.pivot.rotation.y = -w.sx * tuck;
        w.outerPivot.rotation.z = w.sx * (a * 0.6 - tuck * 0.4);
      }
      const fy = floorY(s);
      const hgt = Math.max(0, p[1] - fy);
      shadow.position.set(p[0], fy + 0.01, p[2]);
      shadow.rotation.y = s.heading;
      shadow.material.opacity = Math.max(0.08, 0.35 - hgt * 0.04);
      const k = s.mode === 'dive' ? s.tele : s.mode === 'strike' ? 1 : 0;
      ring.position.set(s.at[0], fy + 0.015, s.at[2]);
      disc.position.copy(ring.position);
      ring.scale.setScalar(hz.radius * (0.5 + 0.5 * k));
      disc.scale.setScalar(hz.radius * (0.5 + 0.5 * k));
      ring.material.opacity = k > 0 ? 0.35 + k * 0.6 : 0;
      disc.material.opacity = k > 0 ? 0.15 + k * 0.35 : 0;
      if (s.mode === 'dive' && s.cycle !== lastDive) {
        lastDive = s.cycle;
        sink?.push({ type: 'squawk', x: p[0], z: p[2], lucky: !!hz.lucky });
      }
    },
  };
}

// ---------------------------------------------------------------- the boules lane: steel balls from the sheds

function chevrons() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(10, 4);
  g.lineTo(34, 16);
  g.lineTo(10, 28);
  g.lineTo(22, 28);
  g.lineTo(46, 16);
  g.lineTo(22, 4);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function makeBoules(hz) {
  const group = new THREE.Group();
  const y = hz.floor;
  const len = Math.abs(hz.x1 - hz.x0);
  const cx = (hz.x0 + hz.x1) / 2;
  // the lane: a raked strip, and red chevrons that run the way the next ball will come while it winds up
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9).rotateX(-Math.PI / 2), shadowMat());
  lane.position.set(cx, y + 0.012, hz.z);
  lane.material.opacity = 0.1;
  const tex = chevrons();
  tex.repeat.set(len / 1.1, 1);
  const arrows = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.8).rotateX(-Math.PI / 2), warnMat());
  arrows.material.map = tex;
  arrows.position.set(cx, y + 0.016, hz.z);
  group.add(lane, arrows);
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.22, metalness: 0.95, envMapIntensity: 1.5 });
  const groove = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4, metalness: 0.6 });
  const balls = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(hz.r, 20, 14), steel);
    ball.castShadow = true;
    g.add(ball);
    for (const rx of [0, Math.PI / 2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(hz.r * 0.995, 0.012, 4, 32), groove);
      ring.rotation.x = rx;
      g.add(ring);
    }
    g.visible = false;
    group.add(g);
    balls.push(g);
  }
  let lastK = null;
  return {
    group,
    update(s, t, dt, sink) {
      balls.forEach((g, i) => {
        const b = s.balls[i];
        g.visible = !!b;
        if (!b) return;
        g.position.set(b.x, y + hz.r, b.z);
        g.rotation.set(0, 0, -b.dir * b.roll);
      });
      const live = s.balls.length > 0;
      const k = s.tele;
      arrows.material.opacity = k > 0 ? 0.25 + 0.6 * k : live ? 0.18 : 0;
      const dir = k > 0 ? s.nextDir : s.balls[s.balls.length - 1]?.dir ?? 1;
      tex.repeat.x = (dir > 0 ? 1 : -1) * Math.abs(tex.repeat.x);
      tex.offset.x = (-t * 1.6) % 1;
      const newest = s.balls.reduce((m, b) => (b.k > m ? b.k : m), -Infinity);
      if (newest !== -Infinity && newest !== lastK) {
        if (lastK !== null) sink?.push({ type: 'throw', x: newest % 2 === 0 ? hz.x0 : hz.x1, z: hz.z });
        lastK = newest;
      }
    },
  };
}

// ---------------------------------------------------------------- the lawn sprinkler

function makeSprinkler(hz) {
  const group = new THREE.Group();
  const [x, y, z] = hz.at;
  // the swept patch of wet grass
  const patch = new THREE.Mesh(new THREE.CircleGeometry(hz.reach, 28, hz.yaw - hz.arc / 2 - Math.PI / 2, hz.arc).rotateX(-Math.PI / 2), shadowMat());
  patch.material.color.set(0x1d4a1a);
  patch.material.opacity = 0.18;
  patch.position.set(x, y + 0.012, z);
  // the head: a stake, a brass drum, an oscillating bar
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.3, metalness: 0.8 });
  const green = std(0x2f8a3c, 0.5);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 12), green);
  base.position.set(x, y + 0.06, z);
  const head = new THREE.Group();
  head.position.set(x, y + 0.2, z);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 10), brass);
  drum.rotation.z = Math.PI / 2;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.22, 8), brass);
  nozzle.position.set(0, 0.06, 0.08);
  nozzle.rotation.x = 0.9;
  head.add(drum, nozzle);
  for (const m of [base, drum, nozzle]) m.castShadow = true;
  // the jet: droplets flying out along an arc
  const N = 44;
  const water = new THREE.MeshStandardMaterial({ color: 0xb5e6f7, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), water, N);
  drops.frustumCulled = false;
  group.add(patch, base, head, drops);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const e = new THREE.Euler();
  return {
    group,
    update(s, t) {
      head.rotation.y = s.angle;
      for (let i = 0; i < N; i++) {
        const u = (i / N + t * 0.9) % 1;
        const spread = ((i * 7) % 5) / 5 - 0.4;
        const a = s.angle + spread * 0.05;
        const d = 0.25 + u * (hz.reach - 0.25);
        const h = 0.3 + Math.sin(u * Math.PI) * 1.3 * (1 - u * 0.25) - u * 0.3;
        pos.set(x + Math.sin(a) * d, y + h, z + Math.cos(a) * d);
        const k = 0.022 + 0.022 * Math.sin(u * Math.PI);
        sc.set(k, k * 1.8, k);
        e.set(0, a, Math.cos(u * Math.PI) * 0.9 - 0.3);
        q.setFromEuler(e);
        m4.compose(pos, q, sc);
        drops.setMatrixAt(i, m4);
      }
      drops.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- the big scale's pan (a pendulum you can ride)

function makePendulum(hz) {
  const group = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.28, metalness: 0.9, envMapIntensity: 1.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, roughness: 0.35, metalness: 0.85, envMapIntensity: 1.2 });
  const [w, , d] = hz.size;
  // the pan: a shallow brass dish, a rolled rim; fish scales are round, the collider square: the dish covers it
  const R = Math.hypot(w, d) / 2 * 0.92;
  const pan = new THREE.Group();
  group.add(pan);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.82, 0.12, 32), brass);
  dish.castShadow = dish.receiveShadow = true;
  pan.add(dish);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.03, 8, 32), brass);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.06;
  pan.add(rim);
  // chains from the rim up to a ring, and the ring to the hook on the rod
  const hookH = 1.05;
  const link = new THREE.TorusGeometry(0.03, 0.009, 4, 8);
  const linkMesh = new THREE.InstancedMesh(link, steel, 4 * 22);
  linkMesh.castShadow = true;
  let n = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const from = new THREE.Vector3(Math.cos(a) * R * 0.96, 0.06, Math.sin(a) * R * 0.96);
    const to = new THREE.Vector3(0, hookH, 0);
    const dir = to.clone().sub(from);
    const len = dir.length();
    dir.normalize();
    for (let i = 0; i < 22; i++) {
      const p = from.clone().addScaledVector(dir, (len * (i + 0.5)) / 22);
      q.setFromUnitVectors(UP, dir);
      if (i % 2) q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2));
      m4.compose(p, q, new THREE.Vector3(1, 1.6, 1));
      linkMesh.setMatrixAt(n++, m4);
    }
  }
  pan.add(linkMesh);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 16), steel);
  ring.position.y = hookH;
  pan.add(ring);
  // the rod from the pivot to the ring, and the dial's needle on the gantry
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), steel);
  rod.castShadow = true;
  group.add(rod);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.015), new THREE.MeshStandardMaterial({ color: 0xc8402c, roughness: 0.4 }));
  needle.geometry.translate(0, 0.18, 0);
  needle.position.set(hz.pivot[0], hz.pivot[1] + 0.95 + 0.18, hz.pivot[2] - 0.13);
  group.add(needle);
  const hook = new THREE.Vector3();
  const piv = new THREE.Vector3(...hz.pivot);
  let wob = 0, wobV = 0;
  return {
    group,
    update(s, t, dt) {
      pan.position.set(s.x, s.y + 0.06, s.z);
      hook.set(s.x, s.y + 0.06 + hookH, s.z);
      const mid = hook.clone().add(piv).multiplyScalar(0.5);
      rod.position.copy(mid);
      const dir = piv.clone().sub(hook);
      rod.scale.set(1, dir.length(), 1);
      rod.quaternion.setFromUnitVectors(UP, dir.normalize());
      // the needle reads the swing's pull (heavier at the bottom of the swing), on a damped spring
      const pull = 0.6 + 0.9 * Math.cos(s.angle) ** 8 - 0.3;
      wobV += ((pull - wob) * 40 - wobV * 6) * Math.min(dt, 0.05);
      wob += wobV * Math.min(dt, 0.05);
      needle.rotation.z = -1.9 + wob * 2.2;
    },
  };
}

const MAKERS = { cat: makeCat, feet: makeFeet, chef: makeChef, gull: makeGull, boules: makeBoules, sprinkler: makeSprinkler, pendulum: makePendulum };
export function registerHazardView(kind, make) {
  MAKERS[kind] = make;
}
export { warnMat, shadowMat, std };
