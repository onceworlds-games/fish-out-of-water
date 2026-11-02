// The Kitchen: out of the ice pan on the prep island, through the prep room (a tray of jelly bounces you up to the spice
// shelf), down the line past the chef and his pan (or ride the stockpot's steam up to the pan shelf over the hot range),
// along the pass under the heat lamps or through the dishwasher on its belt, over the drains of the scullery floor and
// into the pot sink under the harbour window.

import { courseBuilder } from '../build.js';
import { slotsOn } from './market.js';

export function kitchen() {
  const b = courseBuilder('kitchen');
  const X0 = -6, X1 = 6, ZE = 151;

  // ---------------------------------------------------------------- the room: floor, walls, three doorways
  b.slab(-6.5, -5, 6.5, ZE + 0.6, 0, 'tile', 'kfloor', 1);
  const drawn = { camera: true };
  b.wall(X0, -5, X0, ZE + 1, 6, -1, drawn);
  b.wall(X1, -5, X1, ZE + 1, 6, -1, drawn);
  b.wall(-7, -4.6, 7, -4.6, 6, -1, drawn);
  b.wall(-7, ZE + 0.4, 7, ZE + 0.4, 6, -1, drawn);
  // A tall old harbour kitchen: a leap from the pan shelf or the pass clears the hood and the heat lamps, and the ceiling,
  // the lintels, the hood and the lamps are all solid, so a fish (and the camera) can never fly out through them.
  const H = 5.4; // the ceiling
  const DOOR = 3.3; // the doorways' head
  b.decor('kroom', [0, 0, 0], { x0: X0, x1: X1, z0: -4.6, z1: ZE + 0.4, windows: [[6, 16], [24, 36], [48, 62], [70, 90], [102, 118], [126, 142]], head: 3.7, end: [-3.6, 3.6, 1.3, 3.9], h: H,
    // high windows over the inner wall where there's no hood, clocks at the start and over each doorway
    high: { windows: [[4, 16], [22, 36], [100, 118], [126, 144]], sill: 3.55, head: 4.85 },
    clocks: [[-2.5, 3.0, -4.58, 1], ...[40, 96, 122].map((z) => [0, 4.35, z - 0.16, -1, 1.6])] });
  for (let z = -5; z < ZE + 1; z += 26) b.box([0, H + 0.2, z + 13], [13, 0.4, 26], { surf: 'wall', look: null });
  for (const z of [40, 96, 122]) {
    b.box([-4.05, H / 2, z], [3.9, H, 0.3], { surf: 'wall', look: 'kwalltile' });
    b.box([4.05, H / 2, z], [3.9, H, 0.3], { surf: 'wall', look: 'kwalltile' });
    b.box([0, (DOOR + H) / 2, z], [4.2, H - DOOR, 0.3], { surf: 'wall', look: null });
    b.decor('lintel', [0, (DOOR + H) / 2, z], { w: 4.2, h: H - DOOR, plaster: true });
    b.decor('sign', [0, DOOR - 0.4, z - 0.2], { arrow: 'ahead', hang: 0.15 });
  }
  // the hood over the range (hung high, under the ceiling), the walk-in's door, mats and wet-floor signs at fish height
  b.decor('khood', [-5.15, 4.8, 68], { w: 1.75, len: 50, h: 0.6 });
  b.box([-5.15, 5.1, 68], [1.75, 0.6, 50], { surf: 'steel', look: null });
  b.decor('walkin', [X0, 0, 8.5], { sgn: 1 });
  b.decor('mat', [0, 0, 1.8], { w: 2.4, len: 1.4 });
  b.decor('mat', [-3.4, 0, 68], { w: 1.0, len: 16 });
  b.decor('mat', [3.6, 0, 106], { w: 1.0, len: 10 });
  b.decor('wetsign', [-0.4, 0, 26.2], { yaw: 0.4 });
  b.decor('wetsign', [2.3, 0, 133.6], { yaw: -0.3 });
  b.decor('tickets', [-1.05, 2.05, 109], { len: 18 });

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
  // a tray of jelly on the right-hand counter: slap it and it throws you up to the spice shelf over the sink
  b.box([5.35, 1.0, 13.6], [0.95, 0.2, 1.5], { surf: 'bounce', look: 'jelly' });
  b.box([5.6, 1.86, 21.5], [0.8, 0.08, 9.0], { surf: 'wood', look: 'shelf' });
  b.decor('jars', [5.75, 1.9, 21.5], { len: 8.6, seed: 4 });
  b.dropArc([5.35, 1.1, 13.6], [5.6, 1.9, 18.6], 1.6, 3);
  b.drops([[5.55, 1.9, 18.8], [5.55, 1.9, 24.0]], 1.3, 0.28);
  b.scale(5.55, 1.9, 25.4);
  // the floor line, and a drain by the mop that washes a careless fish back to it
  b.drops([[0, 0, 4.2], [1.8, 0, 8.5], [2.2, 0, 15], [2.2, 0, 19.5]], 1.6);
  b.drops([[-0.6, 0, 25.5], [-1.0, 0, 30], [0, 0, 36], [0.2, 0, 40.5]], 1.7);
  b.drain(0.9, 0, 31.6, 0.42);

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
  // the stockpot on the floor at the start of the line: its steam lifts a fish in the air up past the pan shelf
  b.cyl([-3.25, 0, 45.6], 0.55, 0.86, { surf: 'steel', look: 'stockpot' });
  b.updraft(-3.25, 0.86, 45.6, 0.62, 2.6, 30, 'steam');
  b.dropArc([-3.25, 0.9, 43.6], [-5.45, 1.93, 48.6], 1.6, 3);
  b.drops([[-5.45, 1.93, 49.5], [-5.45, 1.93, 90.0]], 1.6, 0.26);
  b.scale(-5.45, 1.93, 91.4);
  b.heat([-6.0, 0.9, 43], [-4.6, 1.8, 93], 2.6);
  // the floor of the line: drops between the puddles, drains to skirt
  b.drops([[2.6, 0, 50], [3.4, 0, 57], [3.4, 0, 66]], 1.9);
  b.drops([[0.5, 0, 75], [-2.6, 0, 79.5]], 1.6);
  b.drops([[0.6, 0, 88.5], [0, 0, 95]], 1.7);
  b.drain(1.7, 0, 72.6, 0.42);
  b.drain(-1.2, 0, 92.4, 0.42);
  b.puddle(2.6, 0, 50, 0.85);
  b.puddle(-2.6, 0, 79.5, 0.85);
  b.puddle(0.6, 0, 88.5, 0.65);
  b.crate(2.2, 0, 45.2, { yaw: 0.4 });
  b.crate(-1.2, 0, 84, { yaw: -0.2, look: 'lemoncrate' });

  // ---------------------------------------------------------------- C: the pass (z 96-122) and the dish pit
  b.box([0, 0.525, 109], [2.2, 1.05, 20], { surf: 'steel', look: 'pass' });
  b.decor('heatlamps', [0, 4.15, 109], { len: 19, top: H });
  b.box([0, 4.25, 109], [0.6, 0.5, 19], { surf: 'steel', look: null });
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
  // the pass is quick but the heat lamps dry you as you go
  b.heat([-1.1, 1.05, 99], [1.1, 3.95, 119], 2.6);
  b.drops([[0, 1.05, 100.4], [0, 1.05, 118.4]], 1.5, 0.26);
  // the dishwasher: a belt that carries a fish through a hood of hot spray (a drink on the way); the hood's steam vent
  // lifts a fish that jumps off the belt in front of it up onto the hood, where a golden scale waits
  b.belt([4.65, 0.45, 108.5], [1.3, 0.9, 21], [0, 2.4]);
  for (const s of [-1, 1]) b.box([4.65 + s * 0.72, 1.4, 109], [0.08, 1.0, 4.4], { surf: 'steel', look: 'hoodside' });
  b.box([4.65, 1.93, 109], [1.52, 0.1, 4.4], { surf: 'steel', look: 'hoodtop' });
  b.spray(4.65, 0.9, 109, 0.7, 70, 'spray-hidden', 0.8);
  b.updraft(4.65, 0.9, 105.6, 0.5, 1.9, 30, 'steam');
  b.drops([[4.65, 0.9, 99.2], [4.65, 0.9, 104.6]], 1.4, 0.26);
  b.scale(4.65, 1.98, 109.6);
  b.puddle(2.9, 0, 103.5, 0.7);
  b.puddle(-2.4, 0, 116, 0.6);

  // ---------------------------------------------------------------- D: the scullery and the pot sink (z 122-151)
  b.slab(-1.0, 123, 1.0, 140, 0.02, 'wet', 'drain', 0.05);
  b.puddle(-2.5, 0, 128, 0.85);
  b.puddle(2.3, 0, 137.5, 0.85);
  b.drops([[0, 0.02, 123.6], [0, 0.02, 139.6]], 1.4, 0.26);
  b.drops([[0.4, 0, 142], [0, 0.95, 146.6]], 1.3);
  b.drain(2.6, 0, 131.2, 0.42);
  b.drain(-2.3, 0, 136.4, 0.42);
  b.drain(1.9, 0, 145.0, 0.4);
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
  b.finish([-3.0, 0.5, 147.0], [3.0, 1.7, 150.95], 'sink', 1.6, 0.82);

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
    // the chase camera stays under the ceiling
    camCeil: 4.9,
    indoor: true,
  };
}
