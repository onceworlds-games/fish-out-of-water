// The chase camera: low behind the fish (fish height, not a drone), looking where it will flop. Yaw is the player's aim,
// exactly; the position springs. While you charge it rises and looks further out so the arc's end is in view; on release
// the lens kicks wider; in a long flight it leads the fish; landings punch it. It never ends up inside a wall, and shakes
// from a decaying trauma (none with reduced motion).

import * as THREE from 'three';

const tmpV = new THREE.Vector3();
const tmpW = new THREE.Vector3();
const tmpB = new THREE.Vector3();
// where the boom may go when the straight one is blocked: [yaw offset, lift]
const SWINGS = [[0, 0], [0, 1], [0.6, 0], [-0.6, 0], [0.6, 1], [-0.6, 1], [1.2, 0], [-1.2, 0]];

/** The end of the boom behind a fish facing `yaw`, swung by `off` and lifted by `lf` (0..1), under the ceiling. */
function boomEnd(f, yaw, dist, up, off, lf, ceil, out) {
  const a = yaw + off;
  const d = dist * (1 - 0.35 * lf);
  out.set(f.x - Math.sin(a) * d, Math.min(ceil, f.y + up + 1.5 * lf), f.z - Math.cos(a) * d);
  return out;
}

export function createChaseCam(camera) {
  const pos = new THREE.Vector3(0, 3, -5);
  const look = new THREE.Vector3(0, 0, 0);
  const lookS = new THREE.Vector3(0, 0, 0); // smoothed look point
  const follow = new THREE.Vector3(0, 0, 0); // smoothed fish position
  const followV = new THREE.Vector3();
  let block = 1;
  let lift = 0;
  let swing = 0;
  let aimOff = 0, aimLift = 0;
  let trauma = 0;
  let t = 0;
  let charge = 0;
  let lead = 0; // how far the look runs ahead in a flight
  let air = 0; // 0..1 eased in-flight
  let kick = 0, kickV = 0; // FOV impulse (degrees)
  let punch = 0, punchV = 0; // dolly impulse (metres in)
  let roll = 0;
  let inited = false;
  const springs = (h) => {
    kickV += (-kick * 90 - kickV * 13) * h;
    kick += kickV * h;
    punchV += (-punch * 70 - punchV * 12) * h;
    punch += punchV * h;
  };
  const rig = {
    reduced: false,
    pos,
    look,
    /** Degrees to add to the lens this frame. */
    fovKick: 0,
    snap() {
      inited = false;
      swing = lift = aimOff = aimLift = 0;
      block = 1;
      kick = kickV = punch = punchV = 0;
    },
    addTrauma(k) {
      if (rig.reduced) return;
      trauma = Math.min(1, trauma + k);
    },
    /** A wider lens for a moment (a release, a slap). */
    kick(deg) {
      if (rig.reduced) return;
      kickV += deg * 14;
    },
    /** A quick dolly in (or out, negative) that springs back. */
    punch(m) {
      if (rig.reduced) return;
      punchV += m * 12;
    },
    /** Follow a fish. s: { x, y, z, yaw, curl, ground, vx, vy, vz }; world: for the boom's collision. */
    follow(dt, s, world, opts = {}) {
      t += dt;
      const target = tmpV.set(s.x, s.y, s.z);
      if (!inited) {
        follow.copy(target);
        followV.set(0, 0, 0);
      }
      const subs = Math.max(1, Math.ceil(dt * 120));
      const h = dt / subs;
      // critically damped springs: snappy across, softer up and down (flops are bouncy), looser in a flight
      const inAir = !s.ground;
      air += ((inAir ? 1 : 0) - air) * Math.min(1, dt * (inAir ? 3 : 6));
      const wx = 11 - air * 2, wy = s.ground ? 7 : 5.5;
      for (const [k, w] of [['x', wx], ['y', wy], ['z', wx]]) {
        for (let i = 0; i < subs; i++) {
          const a = -w * w * (follow[k] - target[k]) - 2 * w * followV[k];
          followV[k] += a * h;
          follow[k] += followV[k] * h;
        }
      }
      for (let i = 0; i < subs; i++) springs(h);
      rig.fovKick = kick;
      charge += ((s.curl ?? 0) - charge) * Math.min(1, dt * 4);
      const ce = charge * charge * (3 - 2 * charge);
      const dist = (opts.dist ?? 1.8) + ce * (opts.chargeBack ?? 0.9) - punch + air * 0.2;
      const up = (opts.up ?? 0.8) + ce * (opts.chargeUp ?? 0.7) + air * 0.25;
      const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
      // the look: ahead of the fish, further while charging (the arc's end), leading along a flight
      const hv = (s.vx ?? 0) * dx + (s.vz ?? 0) * dz;
      lead += (Math.max(0, hv) * 0.32 * air - lead) * Math.min(1, dt * 4);
      const ahead = (opts.ahead ?? 1.0) + ce * (opts.chargeAhead ?? 2.6) + lead;
      // the look tracks the fish's real height closely (the boom's height lags, so a fall stays in frame)
      const ly = s.y * 0.7 + follow.y * 0.3;
      tmpB.set(follow.x + dx * ahead, ly - 0.04 - ce * 0.1 - air * 0.15, follow.z + dz * ahead);
      if (!inited) lookS.copy(tmpB);
      lookS.lerp(tmpB, Math.min(1, dt * 9));
      look.copy(lookS);
      const ceil = opts.ceil ?? Infinity;
      const want = boomEnd(follow, s.yaw, dist, up, 0, 0, ceil, tmpW);
      // keep the boom out of walls: with something right behind the fish, swing round it or up over it and look down;
      // otherwise pull in (fast) and let out (slowly)
      let free = 1;
      if (world) {
        const ox = follow.x, oy = follow.y + 0.35, oz = follow.z;
        const freeOf = (off, lf) => {
          const e = boomEnd(follow, s.yaw, dist, up, off, lf, ceil, tmpB);
          return world.sweep(ox, oy, oz, e.x, e.y, e.z, 0.16, 14);
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
        free = Math.abs(swing) < 0.01 && lift < 0.01 ? straight : world.sweep(ox, oy, oz, want.x, want.y, want.z, 0.16, 14);
      }
      block += (free - block) * Math.min(1, dt * (free < block ? 18 : 2.5));
      const k = Math.max(0.15, block);
      pos.set(follow.x + (want.x - follow.x) * k, follow.y + 0.35 + (want.y - follow.y - 0.35) * k, follow.z + (want.z - follow.z) * k);
      // never far above or below the fish itself
      pos.y = THREE.MathUtils.clamp(pos.y, s.y + 0.25, s.y + up + 1.2 + lift * 1.5);
      // a little bank into a turn of the aim
      const turn = opts.turnRate ?? 0;
      roll += (THREE.MathUtils.clamp(-turn * 0.02, -0.05, 0.05) - roll) * Math.min(1, dt * 4);
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
      lookS.copy(look);
      follow.copy(l);
      followV.set(0, 0, 0);
      inited = true;
      for (let i = 0; i < 4; i++) springs(dt / 4);
      rig.fovKick = kick;
      roll *= 0.9;
      rig.apply(dt);
    },
    apply(dt) {
      camera.position.copy(pos);
      trauma = Math.max(0, trauma - dt * 1.6);
      const sh = trauma * trauma;
      if (sh > 0) {
        camera.position.x += (Math.sin(t * 37.1) + Math.sin(t * 61.3) * 0.4) * 0.1 * sh;
        camera.position.y += (Math.sin(t * 41.7 + 1.3) + Math.sin(t * 73.1) * 0.4) * 0.08 * sh;
        camera.position.z += Math.sin(t * 33.3 + 2.1) * 0.1 * sh;
      }
      camera.lookAt(look);
      camera.rotation.z += roll + (sh > 0 ? Math.sin(t * 29.3) * 0.03 * sh : 0);
    },
  };
  return rig;
}
