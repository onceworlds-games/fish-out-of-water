// The Beach: out of an angler's cool box on the promenade, down over hot sand (the boardwalk is the cool way round),
// past tide pools, umbrellas and the lifeguard tower, under the gulls (one of them a lucky one) to the surf.

import { courseBuilder } from '../build.js';
import { slotsOn } from './market.js';

export function beach() {
  const b = courseBuilder('beach');
  const XW = 13.5; // the groynes either side
  const ZW = 206; // where the water starts

  // ---------------------------------------------------------------- ground: the promenade, hot sand, wet sand, the slope into the sea
  b.slab(-60, -12, 60, 3, 1.0, 'stone', 'quay', 2);
  b.decor('seawall', [0, 1.0, 3], { x0: -60, x1: 60 });
  b.slab(-60, 3, 60, 150, 0, 'sand', 'sand', 1);
  b.slab(-60, 150, 60, 198, 0, 'wetsand', 'wetsand', 1);
  b.rampZ(0, 198, 0, ZW + 6, -0.9, 120, 'wetsand', 'wetsand', 0.4);
  // steps down from the promenade
  for (let i = 0; i < 3; i++) b.slab(-8.5, 3, -4.5, 3.6 + i * 0.55, 0.75 - i * 0.25, 'stone', 'quay', 0.3);
  // the groynes: wooden breakwaters down the beach, the course's edges
  for (const x of [-XW, XW]) {
    b.box([x, 0.55, 104], [0.5, 1.1, 196], { surf: 'wood', look: 'groyne' });
    b.wall(x, -2.5, x, ZW + 30, 8);
  }
  b.wall(-XW - 0.5, -2, XW + 0.5, -2, 8);
  b.decor('huts', [0, 1.0, -7], { x0: -46, x1: 46 });
  b.decor('lamps', [0, 1.0, 1.8], { x0: -40, x1: 40, every: 9, skip: 6 });
  b.decor('crowd', [0, 0, 0], { seed: 7, n: 70, xin: 16, xout: 46, z0: 8, z1: 190 });

  // ---------------------------------------------------------------- the start: an angler's cool box of ice on the promenade
  b.box([0, 1.32, -0.4], [4.2, 0.64, 2.0], { surf: 'steel', look: 'coolbox' });
  b.box([0, 1.67, -0.4], [4.0, 0.08, 1.8], { surf: 'ice', look: 'ice' });
  b.decor('rods', [2.6, 1.0, -1.6], {});

  // ---------------------------------------------------------------- A: the dunes (z 4-70): hot sand, the boardwalk the cool way round
  const walk = [[-6, 4], [-6, 22], [2, 31], [2, 47], [-5, 57], [-5, 72]];
  for (let i = 1; i < walk.length; i++) {
    const [ax, az] = walk[i - 1], [cx, cz] = walk[i];
    const len = Math.hypot(cx - ax, cz - az) + 1.6;
    b.box([(ax + cx) / 2, 0.15, (az + cz) / 2], [2.0, 0.3, len], { surf: 'wood', look: 'boardwalk', yaw: Math.atan2(cx - ax, cz - az) });
  }
  b.decor('marram', [0, 0, 0], { seed: 3, z0: 6, z1: 70, x0: -12, x1: 12, n: 46, avoid: walk });
  b.cyl([5, 0, 11], 0.05, 2.1, { surf: 'wood', look: 'pole' });
  b.cyl([5, 2.1, 11], 1.15, 0.08, { surf: 'bounce', look: 'umbrella', tint: 'red' });
  b.shade([3.8, -1, 9.8], [6.2, 2.0, 12.2]);
  b.puddle(4.0, 0, 17.5, 0.55, { look: 'bucket' });
  b.decor('bucket', [4.5, 0, 18.1], { tipped: true, tint: 'red' });
  b.sphere([0.5, 0.42, 21], 0.42, { surf: 'bounce', look: 'beachball' });
  b.cyl([8, 0, 25], 0.05, 2.1, { surf: 'wood', look: 'pole' });
  b.cyl([8, 2.1, 25], 1.15, 0.08, { surf: 'bounce', look: 'umbrella', tint: 'blue' });
  b.shade([6.8, -1, 23.8], [9.2, 2.0, 26.2]);
  b.decor('towel', [8.2, 0, 26.6], { tint: 'lemon', yaw: 0.2 });
  b.cyl([5.5, 0, 29.5], 0.7, 0.7, { surf: 'sand', look: 'castle' });
  b.spray(6.2, 0, 36.5, 1.3, 50, 'shower');
  b.cyl([3.5, 0, 42], 0.05, 2.1, { surf: 'wood', look: 'pole' });
  b.cyl([3.5, 2.1, 42], 1.15, 0.08, { surf: 'bounce', look: 'umbrella', tint: 'lemon' });
  b.shade([2.3, -1, 40.8], [4.7, 2.0, 43.2]);
  b.box([9.5, 0.6, 47], [0.12, 1.2, 4.2], { surf: 'plush', look: 'windbreak' });
  b.box([6.4, 0.25, 52.5], [1.0, 0.5, 0.6], { surf: 'plush', look: 'coolbox2' });
  b.puddle(5.4, 0, 52.5, 0.7, { look: 'melt' });
  b.cyl([7, 0, 59], 0.05, 2.1, { surf: 'wood', look: 'pole' });
  b.cyl([7, 2.1, 59], 1.15, 0.08, { surf: 'bounce', look: 'umbrella', tint: 'red' });
  b.shade([5.8, -1, 57.8], [8.2, 2.0, 60.2]);
  b.decor('towel', [6.6, 0, 61.2], { tint: 'blue', yaw: -0.3 });
  b.puddle(1.2, 0, 64.5, 0.45, { look: 'bucket' });
  b.decor('bucket', [1.7, 0, 65.0], { tipped: true, tint: 'blue' });

  // ---------------------------------------------------------------- B: the gulls and the tower (z 70-145)
  b.puddle(4.0, 0, 76.5, 1.15, { look: 'pool' });
  b.decor('rocks', [4.0, 0, 76.5], { r: 1.15, seed: 1 });
  b.puddle(-5.5, 0, 88, 1.0, { look: 'pool' });
  b.decor('rocks', [-5.5, 0, 88], { r: 1.0, seed: 2 });
  b.puddle(0.4, 0, 92, 0.42, { look: 'bucket' });
  b.decor('bucket', [0.9, 0, 92.4], { tipped: true, tint: 'lemon' });
  b.cyl([-8, 0, 81], 0.65, 0.65, { surf: 'sand', look: 'castle' });
  b.decor('towel', [-2.6, 0, 84], { tint: 'red', yaw: 0.5 });
  // the lifeguard tower: a ramp up to its deck, a long flop off the top
  b.rampZ(-3, 94.5, 0, 101.5, 2.4, 1.6, 'wood', 'plankramp', 0.15);
  b.box([-3, 2.32, 103.2], [2.4, 0.16, 3.2], { surf: 'wood', look: 'towerdeck' });
  b.decor('tower', [-3, 2.4, 103.2], { w: 2.4, d: 3.2 });
  b.puddle(-3.6, 2.4, 104.0, 0.4, { look: 'bucket' });
  b.puddle(5.2, 0, 113, 1.2, { look: 'pool' });
  b.decor('rocks', [5.2, 0, 113], { r: 1.2, seed: 3 });
  b.cyl([8, 0, 104], 0.05, 2.1, { surf: 'wood', look: 'pole' });
  b.cyl([8, 2.1, 104], 1.15, 0.08, { surf: 'bounce', look: 'umbrella', tint: 'blue' });
  b.shade([6.8, -1, 102.8], [9.2, 2.0, 105.2]);
  b.box([-8.5, 0.45, 118], [1.6, 0.9, 4.4], { surf: 'wood', look: 'rowboat', yaw: 0.3 });
  b.puddle(-1.8, 0, 131.5, 1.0, { look: 'pool' });
  b.decor('rocks', [-1.8, 0, 131.5], { r: 1.0, seed: 4 });
  b.cyl([3.6, 0, 125], 0.6, 0.6, { surf: 'sand', look: 'castle' });
  b.puddle(4.6, 0, 125.4, 0.5, { look: 'moat' });
  b.decor('towel', [7.4, 0, 133], { tint: 'lemon', yaw: -0.2 });
  b.box([-6.5, 0.6, 140], [4.2, 1.2, 0.12], { surf: 'plush', look: 'windbreak' });
  b.puddle(2.8, 0, 143, 0.45, { look: 'bucket' });
  b.decor('bucket', [3.3, 0, 143.4], { tipped: true, tint: 'red' });
  // gulls: two drop you back up the beach; the lucky one (gold, a gold ring) carries you 20 m on
  b.hazard({ kind: 'gull', id: 'gull1', period: 8.2, phase: 0.0, spin: 0, stations: [{ at: [2.2, 0, 82], drop: [-1.5, 0, 66] }, { at: [-2.4, 0, 97.5], drop: [-4.5, 0, 79] }] });
  b.hazard({ kind: 'gull', id: 'gull2', period: 7.4, phase: 3.1, spin: 2, stations: [{ at: [1.6, 0, 118.5], drop: [-1.0, 0, 99] }, { at: [-3.0, 0, 125], drop: [1.0, 0, 108] }, { at: [3.4, 0, 137], drop: [0.5, 0, 117] }] });
  b.hazard({ kind: 'gull', id: 'gull3', period: 8.8, phase: 5.2, spin: 4, stations: [{ at: [0.5, 0, 163], drop: [-2.0, 0, 146] }, { at: [-3.5, 0, 176], drop: [0.0, 0, 158] }] });
  b.hazard({ kind: 'gull', id: 'lucky', lucky: true, period: 15, phase: 6.5, spin: 1, cruiseH: 6.5, stations: [{ at: [9.6, 0, 92], drop: [8.0, 0, 112] }] });
  b.decor('gullpost', [10.8, 0, 91], {});

  // ---------------------------------------------------------------- C: wet sand to the surf (z 150-206)
  b.decor('seaweed', [0, 0, 0], { seed: 5, z0: 152, z1: 196, x0: -12, x1: 12, n: 26 });
  b.puddle(-4.5, 0, 157, 0.9, { look: 'pool' });
  b.decor('rocks', [-4.5, 0, 157], { r: 0.9, seed: 5 });
  b.cyl([2.5, 0, 168], 0.7, 0.75, { surf: 'sand', look: 'castle' });
  b.puddle(3.6, 0, 168.6, 0.55, { look: 'moat' });
  b.box([6.5, 0.4, 183], [1.5, 0.8, 4.2], { surf: 'wood', look: 'rowboat', yaw: -0.4 });
  b.puddle(-2.0, 0, 187, 0.8, { look: 'pool' });
  b.decor('rocks', [-2.0, 0, 187], { r: 0.8, seed: 6 });
  b.finish([-40, -3, ZW - 2.5], [40, -0.12, 280]);

  const spine = [
    [0, 1.72, -0.4], [-1.0, 0, 6.5], [3.0, 0, 12], [4.0, 0, 17.5], [5.0, 0, 27], [6.2, 0, 36.5], [5.4, 0, 45], [5.4, 0, 52.5],
    [3.0, 0, 59], [1.2, 0, 64.5], [3.4, 0, 70.5], [4.0, 0, 76.5], [5.5, 0, 82], [0.4, 0, 92], [-5.5, 0, 88], [-5.6, 0, 96], [-1.0, 0, 103],
    [3.6, 0, 108], [5.2, 0, 113], [-0.2, 0, 122], [-1.8, 0, 131.5], [2.8, 0, 143], [-2.0, 0, 150], [-4.5, 0, 157], [-1.0, 0, 167],
    [2.0, 0, 178], [-2.0, 0, 187], [0, 0, 197], [0, -0.4, 203], [0, -0.6, 205],
  ];
  const expert = [
    [0, 1.72, -0.4], [3.5, 0, 9], [4.0, 0, 17.5], [6.2, 0, 36.5], [5.4, 0, 52.5], [1.2, 0, 64.5], [4.0, 0, 76.5], [-1.5, 0, 88],
    [-3, 0, 94.5], [-3, 2.4, 101.5], [-3, 2.4, 104.5], [0.5, 0, 112], [-1.8, 0, 131.5], [2.8, 0, 143], [-4.5, 0, 157], [-2.0, 0, 187],
    [0, 0, 197], [0, -0.4, 203], [0, -0.6, 205],
  ];

  return {
    id: 'beach',
    name: 'The Beach',
    short: 'Beach',
    builder: b,
    spine,
    expert,
    start: { x: 0, y: 1.88, z: -0.4, yaw: 0 },
    slots: slotsOn(0, 1.88, -0.4, 0.95, 0.85),
    bounds: { minY: -10, min: [-20, -14], max: [20, 290] },
    sea: { y: -0.6, z0: ZW, x0: -60, x1: 80, lighthouse: [30, 0, 300] },
    sky: 'noon',
    gentle: 30,
    surf: { z: ZW, x0: -60, x1: 60 },
  };
}
