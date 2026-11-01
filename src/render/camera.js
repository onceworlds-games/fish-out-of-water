// The chase camera: behind the fish, looking where it will flop. Yaw is the player's aim, exactly; the position
// springs. It never ends up inside a wall, and shakes from a decaying trauma (none with reduced motion).

import * as THREE from 'three';

const tmpV = new THREE.Vector3();

export function createChaseCam(camera) {
  const pos = new THREE.Vector3(0, 3, -5);
  const look = new THREE.Vector3(0, 0, 0);
  const follow = new THREE.Vector3(0, 0, 0); // smoothed fish position
  const followV = new THREE.Vector3();
  let block = 1; // 0..1 how much of the boom is free
  let trauma = 0;
  let t = 0;
  let charge = 0;
  let inited = false;
  const rig = {
    reduced: false,
    pos,
    look,
    snap() {
      inited = false;
    },
    addTrauma(k) {
      if (rig.reduced) return;
      trauma = Math.min(1, trauma + k);
    },
    /** Follow a fish. s: { x, y, z, yaw, curl, ground }; world: for the boom's collision. */
    follow(dt, s, world, opts = {}) {
      t += dt;
      const target = tmpV.set(s.x, s.y, s.z);
      if (!inited) {
        follow.copy(target);
        followV.set(0, 0, 0);
      }
      // critically damped springs: snappy across, softer up and down (flops are bouncy)
      const wx = 11, wy = s.ground ? 7 : 4.5;
      for (const [k, w] of [['x', wx], ['y', wy], ['z', wx]]) {
        const x = follow[k] - target[k];
        const a = -w * w * x - 2 * w * followV[k];
        followV[k] += a * dt;
        follow[k] += followV[k] * dt;
      }
      charge += ((s.curl ?? 0) - charge) * Math.min(1, dt * 5);
      const dist = (opts.dist ?? 3.7) + charge * 0.7;
      const up = (opts.up ?? 1.55) + charge * 0.55;
      const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
      const ahead = 1.3 + charge * 1.8;
      look.set(follow.x + dx * ahead, follow.y + 0.25 + charge * 0.1, follow.z + dz * ahead);
      const want = new THREE.Vector3(follow.x - dx * dist, follow.y + up, follow.z - dz * dist);
      // keep the boom out of walls: ease in fast, out slowly
      let free = 1;
      if (world) {
        const ox = follow.x, oy = follow.y + 0.45, oz = follow.z;
        free = world.sweep(ox, oy, oz, want.x, want.y, want.z, 0.22, 14);
      }
      block += (free - block) * Math.min(1, dt * (free < block ? 18 : 2.5));
      const k = Math.max(0.22, block);
      pos.set(follow.x + (want.x - follow.x) * k, follow.y + 0.45 + (want.y - follow.y - 0.45) * k, follow.z + (want.z - follow.z) * k);
      inited = true;
      rig.apply(dt);
    },
    /** Place the camera directly (flyovers, the title, the podium), with optional smoothing. */
    place(dt, p, l, smooth = 0) {
      if (smooth > 0 && inited) {
        const a = Math.min(1, dt * smooth);
        pos.lerp(p, a);
        look.lerp(l, a);
      } else {
        pos.copy(p);
        look.copy(l);
      }
      follow.copy(l);
      followV.set(0, 0, 0);
      inited = true;
      rig.apply(dt);
    },
    apply(dt) {
      camera.position.copy(pos);
      trauma = Math.max(0, trauma - dt * 1.6);
      const sh = trauma * trauma;
      if (sh > 0) {
        camera.position.x += Math.sin(t * 37.1) * 0.16 * sh;
        camera.position.y += Math.sin(t * 41.7 + 1.3) * 0.12 * sh;
        camera.position.z += Math.sin(t * 33.3 + 2.1) * 0.16 * sh;
      }
      camera.lookAt(look);
      if (sh > 0) camera.rotation.z += Math.sin(t * 29.3) * 0.025 * sh;
    },
  };
  return rig;
}
