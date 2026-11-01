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

function makeFeet(hz) {
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
        leg.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
        leg.scale.set(1, len, 1);
        tmpB.sub(tmpA).normalize();
        tmpQ.setFromUnitVectors(UP, tmpB);
        leg.quaternion.copy(tmpQ);
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

const MAKERS = { cat: makeCat, feet: makeFeet };
export function registerHazardView(kind, make) {
  MAKERS[kind] = make;
}
export { warnMat, shadowMat, std };
