// The Kitchen: out of the ice pan on the prep island, through the prep room, down the line past the chef and his pan
// (or along the shelf over the hot stove), along the pass and into the pot sink under the harbour window.

import { courseBuilder } from '../build.js';
import { slotsOn } from './market.js';

export function kitchen() {
  const b = courseBuilder('kitchen');
  const X0 = -6, X1 = 6, ZE = 151;

  // ---------------------------------------------------------------- the room: floor, walls, three doorways
  b.slab(-6.5, -5, 6.5, ZE + 0.6, 0, 'tile', 'kfloor', 1);
  b.wall(X0, -5, X0, ZE + 1);
  b.wall(X1, -5, X1, ZE + 1);
  b.wall(-7, -4.6, 7, -4.6);
  b.wall(-7, ZE + 0.4, 7, ZE + 0.4);
  b.decor('kwalls', [0, 0, 0], { x0: X0, x1: X1, z0: -4.6, z1: ZE + 0.4, windows: [[6, 16], [24, 36], [48, 62], [70, 90], [102, 118], [126, 142]], end: [-3.6, 3.6], h: 4.2 });
  for (const z of [40, 96, 122]) {
    b.box([-4.05, 2.1, z], [3.9, 4.2, 0.3], { surf: 'wall', look: 'kwalltile' });
    b.box([4.05, 2.1, z], [3.9, 4.2, 0.3], { surf: 'wall', look: 'kwalltile' });
    b.decor('lintel', [0, 3.7, z], { w: 4.2, h: 1.0 });
    b.decor('sign', [0, 2.75, z - 0.2], { arrow: 'ahead', hang: 0.5 });
  }
  b.decor('beams', [0, 4.35, 0], { x0: X0, x1: X1, z0: -4, z1: ZE, every: 2.4 });

  // ---------------------------------------------------------------- the start: a pan of ice on the prep island
  b.box([0, 0.45, 0], [6.6, 0.9, 2.6], { surf: 'steel', look: 'steelcounter' });
  b.box([0, 0.95, 0], [6.4, 0.1, 2.4], { surf: 'ice', look: 'icepan' });

  // ---------------------------------------------------------------- A: the prep room (z 2-40)
  b.box([-5.4, 0.45, 20], [1.2, 0.9, 32], { surf: 'steel', look: 'steelcounter' });
  b.decor('veg', [-5.4, 0.92, 20], { len: 31, depth: 0.9, seed: 3 });
  b.box([5.4, 0.45, 11], [1.2, 0.9, 14], { surf: 'steel', look: 'steelcounter' });
  b.decor('veg', [5.4, 0.92, 11], { len: 13, depth: 0.9, seed: 5 });
  b.box([5.4, 0.45, 30], [1.2, 0.9, 12], { surf: 'steel', look: 'steelcounter' });
  b.decor('veg', [5.4, 0.92, 30], { len: 11, depth: 0.9, seed: 9 });
  // the prep sink between them, its tap dripping onto the floor
  b.box([5.4, 0.45, 21], [1.2, 0.9, 4], { surf: 'steel', look: 'sinkunit' });
  b.decor('taps', [5.75, 0.9, 21], { n: 1, yaw: -Math.PI / 2 });
  b.puddle(4.1, 0, 21, 0.85);
  b.decor('drips', [4.6, 0.9, 21], {});
  // the butcher's block in the middle, sacks of potatoes to bounce on
  b.box([0.2, 0.45, 15], [2.2, 0.9, 3.6], { surf: 'wood', look: 'butcher' });
  b.decor('veg', [0.2, 0.92, 15], { len: 3.2, depth: 1.8, seed: 13, sparse: true });
  b.box([-2.7, 0.3, 9], [1.0, 0.6, 0.8], { surf: 'plush', look: 'sack', yaw: 0.4 });
  b.box([-3.5, 0.3, 9.9], [0.9, 0.6, 0.8], { surf: 'plush', look: 'sack', yaw: -0.3 });
  b.box([2.9, 0.3, 28], [1.0, 0.6, 0.8], { surf: 'plush', look: 'sack', yaw: -0.5 });
  b.crate(-3.2, 0, 31, { yaw: 0.2, look: 'lemoncrate' });
  b.crate(1.6, 0, 35.5, { yaw: -0.3 });
  b.puddle(2.2, 0, 6.6, 0.6);
  b.puddle(-1.6, 0, 27, 0.95, { look: 'mop' });
  b.decor('mopbucket', [-2.6, 0, 27.6], {});

  // ---------------------------------------------------------------- B: the line (z 40-96): the range, the shelf, the chef
  b.box([-5.3, 0.45, 68], [1.4, 0.9, 50], { surf: 'hot', look: 'range' });
  b.box([-5.45, 1.88, 68], [1.1, 0.1, 48], { surf: 'wood', look: 'shelf' });
  b.decor('pans', [-5.95, 2.75, 68], { z0: 45, z1: 91 });
  b.puddle(-5.45, 1.93, 66.5, 0.42, { look: 'spill' });
  b.decor('jug', [-5.7, 1.93, 67.2], {});
  for (const z of [50, 61, 77, 87]) b.cyl([-5.2, 0.9, z], 0.38, 0.55, { surf: 'steel', look: 'pot' });
  // the cold side: low fridges with ice wells
  b.box([5.35, 0.45, 68], [1.3, 0.9, 50], { surf: 'steel', look: 'steelcounter' });
  for (const z of [53, 72, 88]) b.box([5.35, 0.93, z], [1.0, 0.08, 2.6], { surf: 'ice', look: 'icepan' });
  b.decor('veg', [5.35, 0.92, 62.5], { len: 14, depth: 0.9, seed: 17, sparse: true });
  b.decor('veg', [5.35, 0.92, 80], { len: 10, depth: 0.9, seed: 19, sparse: true });
  b.hazard({ kind: 'chef', id: 'chef', stations: [[-1.4, 59], [1.4, 61.4], [-1.4, 63.8], [1.4, 66.2], [0, 68.6]], period: 3.6, tele: 0.85, radius: 1.4, phase: 0.6 });
  b.puddle(2.6, 0, 50, 0.85);
  b.puddle(-2.6, 0, 79.5, 0.85);
  b.puddle(0.6, 0, 88.5, 0.65);
  b.crate(2.2, 0, 45.2, { yaw: 0.4 });
  b.crate(-1.2, 0, 84, { yaw: -0.2, look: 'lemoncrate' });

  // ---------------------------------------------------------------- C: the pass (z 96-122) and the dish pit
  b.box([0, 0.525, 109], [2.2, 1.05, 20], { surf: 'steel', look: 'pass' });
  b.decor('heatlamps', [0, 2.45, 109], { len: 19 });
  b.decor('plates', [0.55, 1.05, 100.5], { n: 3 });
  b.decor('plates', [-0.5, 1.05, 117.6], { n: 2 });
  // the dish pit: a deep tub of soapy water
  const tx = -4.6, tz = 108;
  b.box([tx, 0.25, tz], [2.0, 0.5, 3.2], { surf: 'steel', look: 'steel' });
  b.box([tx + 0.95, 0.42, tz], [0.1, 0.84, 3.2], { surf: 'steel', look: 'steel' });
  b.box([tx - 0.95, 0.42, tz], [0.1, 0.84, 3.2], { surf: 'steel', look: 'steel' });
  b.box([tx, 0.42, tz - 1.55], [2.0, 0.84, 0.1], { surf: 'steel', look: 'steel' });
  b.box([tx, 0.42, tz + 1.55], [2.0, 0.84, 0.1], { surf: 'steel', look: 'steel' });
  b.puddle(tx - 0.05, 0.5, tz, 1.3, { look: 'tub' });
  b.decor('suds', [tx, 0.72, tz], { w: 1.8, d: 3.0 });
  b.box([4.9, 0.7, 104], [1.4, 1.4, 1.0], { surf: 'steel', look: 'rack' });
  b.box([4.9, 0.7, 113], [1.4, 1.4, 1.0], { surf: 'steel', look: 'rack' });
  b.puddle(2.9, 0, 103.5, 0.7);
  b.puddle(-2.4, 0, 116, 0.6);

  // ---------------------------------------------------------------- D: the scullery and the pot sink (z 122-151)
  b.slab(-1.0, 123, 1.0, 140, 0.02, 'wet', 'drain', 0.05);
  b.puddle(-2.5, 0, 128, 0.85);
  b.puddle(2.3, 0, 137.5, 0.85);
  b.crate(-1.6, 0, 143.6, { size: [0.9, 0.45, 0.9], yaw: 0.2 });
  b.crate(1.9, 0, 142.8, { size: [1.0, 0.9, 1.0], look: 'cratestack' });
  b.box([-4.4, 0.7, 132], [1.4, 1.4, 1.0], { surf: 'steel', look: 'rack' });
  // the pot sink: counters either side, a long trough of water between, the harbour window above
  b.box([-4.6, 0.475, 148.9], [2.8, 0.95, 4.2], { surf: 'steel', look: 'steelcounter' });
  b.box([4.6, 0.475, 148.9], [2.8, 0.95, 4.2], { surf: 'steel', look: 'steelcounter' });
  b.box([0, 0.475, 146.9], [6.4, 0.95, 0.2], { surf: 'steel', look: 'steel' });
  b.box([0, 0.25, 149], [6.4, 0.5, 4.0], { surf: 'steel', look: 'steel' });
  b.decor('sinkwater', [0, 0.82, 149], { w: 6.0, d: 3.9 });
  b.decor('taps', [0, 0.95, 150.85], { n: 3, gap: 2.0 });
  b.finish([-3.0, 0.5, 147.0], [3.0, 1.7, 150.95], 'sink');

  const spine = [
    [0, 1.0, 0], [0, 0, 4.5], [2.0, 0, 9], [2.2, 0, 19], [-1.4, 0, 27], [0, 0, 36], [0, 0, 41], [1.2, 0, 46], [2.6, 0, 50],
    [3.4, 0, 57], [3.5, 0, 63], [3.3, 0, 70], [0.5, 0, 75], [-2.6, 0, 79.5], [0.6, 0, 88.5], [0, 0, 97], [2.8, 0, 103.5],
    [2.9, 0, 112], [1.2, 0, 121], [0, 0, 124], [-2.5, 0, 128], [0, 0, 133], [2.3, 0, 137.5], [0.3, 0, 142], [0, 0.95, 147.8],
    [0, 0.55, 149.5],
  ];
  const expert = [
    [0, 1.0, 0], [-2.0, 0, 6], [-3.5, 0, 18], [-3.5, 0, 33], [-1.4, 0, 41], [-3.4, 0, 43.5], [-5.2, 0.9, 44.5],
    [-5.45, 1.93, 48], [-5.45, 1.93, 66.5], [-5.45, 1.93, 91], [-3.0, 0, 94], [0, 0, 97], [0, 1.05, 100.5], [0, 1.05, 118],
    [0.6, 0, 122.5], [0, 0.02, 130], [0, 0.02, 138], [0, 0.95, 147.8], [0, 0.55, 149.5],
  ];

  return {
    id: 'kitchen',
    name: 'The Kitchen',
    short: 'Kitchen',
    builder: b,
    spine,
    expert,
    start: { x: 0, y: 1.16, z: 0, yaw: 0 },
    slots: slotsOn(0, 1.17, 0),
    bounds: { minY: -10, min: [-10, -8], max: [10, 158] },
    sea: { y: -0.6, z0: ZE + 1.2, x0: -60, x1: 80, lighthouse: [14, 0, 230] },
    sky: 'noon',
    gentle: 30,
    indoor: true,
  };
}
