// The Park: off a picnic table's ice at the top of the hill, across the lawn and its sprinklers, over the boules pitch,
// past the fountain, down the grand stairs (or down their handrail), through the rose garden to the harbour wall.

import { courseBuilder } from '../build.js';
import { slotsOn } from './market.js';

export function park() {
  const b = courseBuilder('park');
  const XW = 12;
  const ZE = 222; // the harbour wall

  // ---------------------------------------------------------------- the hill: terraces, a grassy slope, the stairs, a stone ramp
  b.slab(-40, -10, 40, 40, 6, 'grass', 'grass', 7);
  b.rampZ(0, 40, 6, 50, 4, 80, 'grass', 'grass', 0.5);
  b.slab(-40, 50, 40, 104, 4, 'grass', 'grass', 5);
  b.slab(-XW, 56, XW, 86, 4.02, 'gravel', 'gravel', 0.1);
  for (let i = 0; i < 10; i++) b.slab(-40, 104 + i, 40, 105 + i, 4 - 0.25 * (i + 1), 'stone', 'step', 5 - 0.25 * (i + 1));
  b.slab(-40, 114, 40, 172, 1.5, 'grass', 'grass', 2.5);
  b.rampZ(0, 172, 1.5, 180, 0.6, 80, 'stone', 'quay', 0.5);
  b.slab(-40, 180, 40, ZE, 0.6, 'stone', 'quay', 1.6);
  b.decor('quayedge', [0, 0.6, ZE], { x0: -40, x1: 40 });
  // the edges: hedges along the sides, walls you can't flop over
  for (const x of [-XW, XW]) {
    b.box([x, 6.6, 15], [0.9, 1.2, 50], { surf: 'grass', look: 'hedge' });
    b.box([x, 4.6, 77], [0.9, 1.2, 54], { surf: 'grass', look: 'hedge' });
    b.box([x, 2.1, 143], [0.9, 1.2, 58], { surf: 'grass', look: 'hedge' });
    b.wall(x, -8, x, ZE + 10, 14, -1);
  }
  b.wall(-XW, -7, XW, -7, 14, 4);
  b.decor('mowstripes', [0, 0, 0], { x: 11.55, w: 2.5, bands: [[-6.6, 40, 6], [50, 56, 4], [86, 104, 4], [114, 172, 1.5]] });
  b.decor('trees', [0, 0, 0], { seed: 3, n: 46, xin: 14, xout: 40, z0: -8, z1: 170 });
  b.decor('town', [0, 0, 0], { z0: 186, z1: 216 });
  b.decor('lamps', [0, 4, 52], { x0: -11, x1: 11, every: 22 });

  // ---------------------------------------------------------------- the start: an ice tray on the picnic trestle
  b.box([0, 6.71, 0], [6.6, 0.08, 2.6], { surf: 'wood', look: 'trestle' });
  b.box([0, 6.8, 0], [6.4, 0.1, 2.4], { surf: 'ice', look: 'ice' });
  b.decor('trestlelegs', [0, 6, 0], { w: 6.6, d: 2.6, h: 0.67 });

  // ---------------------------------------------------------------- A: the picnic lawn (z 4-40)
  picnic(b, -5.5, 6, 12, 0.3);
  picnic(b, 6, 6, 21, -0.2);
  picnic(b, -4, 6, 31, 0.1);
  b.cyl([4.2, 6, 9.5], 0.45, 0.85, { surf: 'hot', look: 'bbq' });
  b.decor('blanket', [5.5, 6, 30], { yaw: 0.3 });
  b.decor('blanket', [-7, 6, 22], { yaw: -0.2 });
  b.hazard({ kind: 'sprinkler', id: 'spr1', at: [-6.5, 6, 18], yaw: Math.PI / 2, arc: 1.4, period: 4.8, phase: 0 });
  b.hazard({ kind: 'sprinkler', id: 'spr2', at: [7, 6, 35], yaw: -Math.PI / 2 - 0.2, arc: 1.4, period: 5.4, phase: 1.7 });
  b.puddle(-3.6, 6, 18, 0.75);
  b.puddle(1.5, 6, 25.5, 0.35, { look: 'bowl' });
  b.decor('dogbowl', [1.5, 6, 25.5], {});
  b.puddle(-2.5, 6, 37.5, 0.8);
  b.cyl([8.5, 6, 6], 0.28, 3, { surf: 'wood', look: 'tree' });

  // ---------------------------------------------------------------- B: the boules pitch (z 56-86) and the fountain
  b.puddle(5.2, 4, 53, 0.8);
  b.decor('can', [6.0, 4, 53.6], {});
  for (const [z, ph, per] of [[61, 0, 2.6], [69.5, 1.1, 2.9], [78, 2.0, 2.7]]) {
    b.hazard({ kind: 'boules', id: `boule${z}`, z, x0: -11.4, x1: 11.4, floor: 4.02, period: per, phase: ph, wind: 0.8, speed: 5 });
    b.decor('chute', [-12.2, 4.02, z], { dir: 1 });
    b.decor('chute', [12.2, 4.02, z], { dir: -1 });
  }
  b.puddle(-3.2, 4.02, 65.2, 0.6, { look: 'can' });
  b.puddle(3.8, 4.02, 73.8, 0.6, { look: 'can' });
  b.puddle(-1.6, 4.02, 82.2, 0.6, { look: 'can' });
  b.decor('bench', [-9.5, 4, 90], { yaw: Math.PI / 2 });
  b.decor('bench', [9.5, 4, 92], { yaw: -Math.PI / 2 });
  b.cyl([0, 4, 96], 2.3, 0.5, { surf: 'stone', look: 'basin' });
  b.cyl([0, 4.5, 96], 0.32, 1.4, { surf: 'stone', look: 'column' });
  b.puddle(0, 4.5, 96, 2.15, { look: 'fountain' });
  b.decor('fountainjet', [0, 5.9, 96], {});

  // ---------------------------------------------------------------- C: the grand stairs and their handrails (z 104-114)
  for (const x of [-6, 0, 6]) {
    b.rampZ(x, 103.3, 4.85, 114.6, 2.35, 0.34, 'rail', 'handrail', 0.1);
    b.decor('railposts', [x, 0, 0], { z0: 103.6, y0: 4.0, z1: 114.4, y1: 1.5, top0: 4.8, top1: 2.3 });
  }

  // ---------------------------------------------------------------- D: the rose garden (z 114-172)
  for (const [x, z, w, d] of [[-6, 126, 8, 2], [6, 138, 8, 2], [-5, 151, 9, 2], [5.5, 163, 8, 2]]) b.box([x, 1.5 + 0.25, z], [w, 0.5, d], { surf: 'grass', look: 'roses' });
  b.puddle(3, 1.5, 121.5, 0.8);
  b.puddle(-3.8, 1.5, 133.5, 0.35, { look: 'bowl' });
  b.decor('dogbowl', [-3.8, 1.5, 133.5], {});
  b.puddle(1.6, 1.5, 145.5, 0.8);
  b.puddle(-2.6, 1.5, 158.5, 0.8);
  b.hazard({ kind: 'sprinkler', id: 'spr3', at: [9, 1.5, 130], yaw: -Math.PI / 2, arc: 1.6, period: 5.0, phase: 0.8, reach: 5 });
  b.hazard({ kind: 'sprinkler', id: 'spr4', at: [-9, 1.5, 156], yaw: Math.PI / 2, arc: 1.6, period: 4.6, phase: 2.9, reach: 5 });
  b.hazard({ kind: 'boules', id: 'boule166', z: 167, x0: -11.4, x1: 11.4, floor: 1.5, period: 3.2, phase: 0.4, wind: 0.8, speed: 5 });
  b.decor('chute', [-12.2, 1.5, 167], { dir: 1 });
  b.decor('chute', [12.2, 1.5, 167], { dir: -1 });
  b.decor('bandstand', [-22, 1.5, 140], {});
  b.cyl([7.5, 1.5, 120], 0.3, 3.2, { surf: 'wood', look: 'tree' });
  b.cyl([-8, 1.5, 145], 0.3, 3.2, { surf: 'wood', look: 'tree' });

  // ---------------------------------------------------------------- E: the harbour front (z 180-222)
  b.puddle(3, 0.6, 186, 0.8);
  b.puddle(-2.2, 0.6, 199.5, 0.8, { look: 'bucketspill' });
  b.decor('bucket', [-1.2, 0.6, 200.2], { tipped: true });
  b.puddle(2.2, 0.6, 212, 0.7);
  b.crate(-5, 0.6, 190, { size: [1.4, 0.9, 1.2], look: 'cratestack' });
  b.crate(6, 0.6, 196, { size: [1.2, 0.9, 1.2], look: 'cratestack2' });
  b.crate(-4, 0.6, 208, { yaw: 0.4 });
  // the café: parasols to bounce off, and the ice-cream kiosk
  for (const [x, z, tint] of [[-6.5, 195.5, 'red'], [6.6, 205.5, 'blue']]) {
    b.cyl([x, 0.6, z], 0.05, 2.1, { surf: 'wood', look: 'pole' });
    b.cyl([x, 2.7, z], 1.15, 0.08, { surf: 'bounce', look: 'umbrella', tint });
    b.shade([x - 1.2, 0, z - 1.2], [x + 1.2, 2.6, z + 1.2]);
    b.cyl([x, 0.6, z], 0.42, 0.74, { surf: 'wood', look: 'cafetable' });
  }
  b.box([9.6, 1.9, 214], [2.4, 2.6, 4.0], { surf: 'wood', look: 'kiosk' });
  b.decor('kioskroof', [9.6, 3.2, 214], { w: 2.4, d: 4.0 });
  for (const x of [-8, 0, 8]) b.bollard(x, 0.6, ZE - 1.2);
  b.decor('bunting', [0, 0, ZE - 2], { x0: -XW, x1: XW, h: 6.0 });
  b.finish([-40, -8, ZE + 0.25], [40, 0.45, 300], 'sea', 1.6, -0.6);

  const spine = [
    [0, 6.85, 0], [0, 6, 5], [-3.6, 6, 18], [1.5, 6, 25.5], [-2.5, 6, 37.5], [0, 5.0, 45], [5.2, 4, 53], [-3.2, 4, 65.2],
    [3.8, 4, 73.8], [-1.6, 4, 82.2], [0, 4.5, 95], [-3, 4, 102], [-3, 1.5, 115.5], [3, 1.5, 121.5], [-3.8, 1.5, 133.5],
    [1.6, 1.5, 145.5], [-2.6, 1.5, 158.5], [0, 1.5, 170], [0, 0.6, 181], [3, 0.6, 186], [-2.2, 0.6, 199.5], [2.2, 0.6, 212],
    [1, 0.6, 221.5], [1, -0.4, 224],
  ];
  const expert = [
    [0, 6.85, 0], [0, 6, 6], [1.5, 6, 25.5], [0, 5.0, 45], [5.2, 4, 53], [3.8, 4, 73.8], [0, 4.5, 95], [0, 4.85, 104.5],
    [0, 2.45, 114.2], [0, 1.5, 121], [1.6, 1.5, 145.5], [0, 1.5, 170], [0, 0.6, 181], [-2.2, 0.6, 199.5], [1, 0.6, 221.5],
    [1, -0.4, 224],
  ];

  return {
    id: 'park',
    name: 'The Park',
    short: 'Park',
    builder: b,
    spine,
    expert,
    start: { x: 0, y: 7.02, z: 0, yaw: 0 },
    slots: slotsOn(0, 7.02, 0),
    bounds: { minY: -10, min: [-16, -10], max: [16, 300] },
    sea: { y: -0.6, z0: ZE + 0.2, x0: -60, x1: 80, lighthouse: [-24, 0, 300] },
    sky: 'noon',
    gentle: 30,
  };
}

/** A picnic table: a top and two benches (you can flop under them). */
function picnic(b, x, y, z, yaw) {
  b.box([x, y + 0.72, z], [1.0, 0.07, 2.2], { surf: 'wood', look: 'picnictop', yaw });
  const ox = Math.cos(yaw), oz = -Math.sin(yaw);
  for (const s of [-1, 1]) b.box([x + ox * s * 0.75, y + 0.44, z + oz * s * 0.75], [0.32, 0.06, 2.2], { surf: 'wood', look: 'picnicbench', yaw });
  b.decor('picniclegs', [x, y, z], { yaw });
}
