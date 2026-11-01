// Shared unit geometries and a small seeded random for the world's drawing code.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** A triangular prism: base from x -0.5..0.5 at y 0, apex at (0, 1), z -0.5..0.5 (a gable end, a roof's side). */
function prism() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(0.5, 0);
  s.lineTo(0, 1);
  s.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
}

/** A flat half disc (an arch's fanlight) in the xy plane: radius 1, flat side on y 0, z -0.5..0.5. */
function halfDisc(seg = 16) {
  const s = new THREE.Shape();
  s.moveTo(-1, 0);
  s.absarc(0, 0, 1, Math.PI, 0, true);
  s.lineTo(-1, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -0.5);
  return g;
}

/** An arch ring (the stone around an arched door): inner radius `ri` of an outer radius 1, flat on y 0. */
function archRing(ri = 0.82, seg = 16) {
  const s = new THREE.Shape();
  s.moveTo(-1, 0);
  s.absarc(0, 0, 1, Math.PI, 0, true);
  s.lineTo(ri, 0);
  s.absarc(0, 0, ri, 0, Math.PI, false);
  s.lineTo(-1, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -0.5);
  return g;
}

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rbox: new RoundedBoxGeometry(1, 1, 1, 2, 0.08),
  rbox2: new RoundedBoxGeometry(1, 1, 1, 2, 0.2),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  lowSphere: new THREE.SphereGeometry(1, 8, 6),
  ico: new THREE.IcosahedronGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl20: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone: new THREE.ConeGeometry(1, 1, 10),
  torus: new THREE.TorusGeometry(1, 0.08, 6, 20),
  prism: prism(),
  halfDisc: halfDisc(),
  archRing: archRing(),
};

export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
