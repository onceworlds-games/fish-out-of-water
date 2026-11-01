// The chase camera: behind the fish, looking where it will flop. Yaw is the player's aim, exactly; the position
// springs. It never ends up inside a wall, and shakes from a decaying trauma (none with reduced motion).

import * as THREE from 'three';

const tmpV = new THREE.Vector3();
const tmpW = new THREE.Vector3();
const tmpB = new THREE.Vector3();
// where the boom may go when the straight one is blocked: [yaw offset, lift]
const SWINGS = [[0, 0], [0, 1], [0.7, 0], [-0.7, 0], [0.7, 1], [-0.7, 1], [1.3, 0], [-1.3, 0]];

/** The end of the boom behind a fish facing `yaw`, swung by `off` and lifted by `lf` (0..1), under the ceiling. */
function boomEnd(f, yaw, dist, up, off, lf, ceil, out) {
  const a = yaw + off;
  const d = dist * (1 - 0.45 * lf);
  out.set(f.x - Math.sin(a) * d, Math.min(ceil, f.y + up + 1.8 * lf), f.z - Math.cos(a) * d);
  return out;
}

export function createChaseCam(camera) {
  const pos = new THREE.Vector3(0, 3, -5);
  const look = new THREE.Vector3(0, 0, 0);
  const follow = new THREE.Vector3(0, 0, 0); // smoothed fish position
  const followV = new THREE.Vector3();
  let block = 1; // 0..1 how much of the boom is free
  let lift = 0; // 0..1 how far the boom has swung up over something right behind the fish
  let swing = 0; // how far (radians) the boom has swung round something right behind the fish
  let aimOff = 0, aimLift = 0;
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
      swing = lift = aimOff = aimLift = 0;
      block = 1;
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
      const subs = Math.max(1, Math.ceil(dt * 90));
      const h = dt / subs;
      for (const [k, w] of [['x', wx], ['y', wy], ['z', wx]]) {
        for (let i = 0; i < subs; i++) {
          const a = -w * w * (follow[k] - target[k]) - 2 * w * followV[k];
          followV[k] += a * h;
          follow[k] += followV[k] * h;
        }
      }
      charge += ((s.curl ?? 0) - charge) * Math.min(1, dt * 5);
      const dist = (opts.dist ?? 3.7) + charge * 0.7;
      const up = (opts.up ?? 1.55) + charge * 0.55;
      const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
      const ahead = 1.0 + charge * 1.9;
      look.set(follow.x + dx * ahead, follow.y + 0.15 + charge * 0.1, follow.z + dz * ahead);
      const ceil = opts.ceil ?? Infinity;
      const want = boomEnd(follow, s.yaw, dist, up, 0, 0, ceil, tmpW);
      // keep the boom out of walls: with something right behind the fish, swing round it or up over it and look down;
      // otherwise pull in (fast) and let out (slowly)
      let free = 1;
      if (world) {
        const ox = follow.x, oy = follow.y + 0.45, oz = follow.z;
        const freeOf = (off, lf) => {
          const e = boomEnd(follow, s.yaw, dist, up, off, lf, ceil, tmpB);
          return world.sweep(ox, oy, oz, e.x, e.y, e.z, 0.22, 14);
        };
        const straight = freeOf(0, 0);
        if (straight >= 0.75) {
          aimOff = 0;
          aimLift = 0;
        } else {
          // the way it swung last time wins ties, so it never flips from side to side
          let best = (aimOff === 0 && aimLift === 0 ? straight : freeOf(aimOff, aimLift)) + 0.12;
          if (aimOff !== 0 || aimLift !== 0) best -= Math.abs(aimOff) * 0.08 + aimLift * 0.05;
          for (const [off, lf] of SWINGS) {
            if (off === aimOff && lf === aimLift) continue;
            const f = (off === 0 && lf === 0 ? straight : freeOf(off, lf)) - Math.abs(off) * 0.08 - lf * 0.05;
            if (f > best) {
              best = f;
              aimOff = off;
              aimLift = lf;
            }
          }
        }
        swing += (aimOff - swing) * Math.min(1, dt * 3.2);
        lift += (aimLift - lift) * Math.min(1, dt * (aimLift > lift ? 5 : 1.2));
        boomEnd(follow, s.yaw, dist, up, swing, lift, ceil, want);
        free = Math.abs(swing) < 0.01 && lift < 0.01 ? straight : world.sweep(ox, oy, oz, want.x, want.y, want.z, 0.22, 14);
      }
      block += (free - block) * Math.min(1, dt * (free < block ? 18 : 2.5));
      const k = Math.max(0.12, block);
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
