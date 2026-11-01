// The Fish Market: down through the old town to the harbour. Off the fishmonger's ice at the top of the lane, between
// the stalls, down the steps (or down the running-water channel in the middle of them), across the fountain square (the
// cat dozes in the shade; the café parasols bounce you up to the flower ledge in the sun), down the auction yard on the
// fish belt, a ride on the big scale, along the quay and off the bow of a boat into the sea. The sea is in view from the
// top. The gentlest course.

import { courseBuilder } from '../build.js';

export function market() {
  const b = courseBuilder('market');

  // ---------------------------------------------------------------- the levels
  // the top lane (y 4), the steps, the fountain square (y 2), the auction yard sloping down, the quay (y 0.6), the sea
  b.slab(-4, -7, 4, 18, 4, 'wet', 'cobbles', 6);
  b.slab(-7.5, 30, 7.5, 62.2, 2, 'stone', 'flags', 4);
  b.rampZ(0, 62, 2, 90, 0.6, 10, 'wet', 'concrete', 1.4);
  b.slab(-9, 89.8, 9, 120, 0.6, 'stone', 'quay', 2.6);

  // the steps, either side of the channel down the middle
  b.steps(-4, -0.61, 18, 30, 4, 2, 5);
  b.steps(0.61, 4, 18, 30, 4, 2, 5);
  b.runnel(0, 0.9, 17.7, 4, 30.4, 2);

  // ---------------------------------------------------------------- the houses (solid: shade, and the camera stays out)
  b.house(-10, -13, 10, -7, 4, 9.5, { face: 'z+', seed: 5 });
  b.row(-4, -7, 18, 1, { base: 4, seed: 11, heights: [8, 10.5] });
  b.row(4, -7, 18, -1, { base: 4, seed: 12, heights: [8.5, 11] });
  b.row(-4, 18, 24, 1, { base: 2, seed: 13, heights: [10, 12] });
  b.row(4, 18, 24, -1, { base: 2, seed: 14, heights: [10.5, 12.5] });
  // the corners where the lane opens into the square
  b.house(-10, 24, -4, 30, 2, 10, { face: ['x+', 'z+'], seed: 15 });
  b.house(4, 24, 10, 30, 2, 11, { face: ['x-', 'z+'], seed: 16 });
  b.row(-7.5, 30, 60, 1, { base: 2, seed: 17, heights: [9, 11.5], widths: [5, 8] });
  b.row(7.5, 30, 60, -1, { base: 2, seed: 18, heights: [9.5, 12], widths: [5, 8] });
  // the auction yard: the hall on the left, fish sheds on the right
  b.house(-14, 62, -5, 90, 0.6, 10, { face: ['x+', 'z+'], kind: 'hall', seed: 19 });
  b.house(-13.5, 60, -5, 62, 0.6, 11, { face: ['z+'], seed: 20 });
  b.house(5, 62, 13, 84, 0.6, 9, { face: ['x-'], kind: 'shed', seed: 21 });
  b.house(5, 60, 13.5, 62, 0.6, 11.5, { face: ['z+'], seed: 22 });
  b.house(9, 84, 15, 104, 0.6, 9, { face: ['x-', 'z-'], seed: 23 });
  b.house(-17, 90, -9, 108, 0.6, 9.5, { face: ['x+', 'z-'], kind: 'shop', seed: 24 });
  // the yard's open edges and the quay's sides past the houses
  b.wall(-5, 62, -5, 90, 6, -1);
  b.wall(5, 62, 5, 84, 6, -1);
  b.wall(5, 84, 9, 84, 6, -1);
  b.wall(-9, 90, -9, 124, 6, -1);
  b.wall(9, 84, 9, 124, 6, -1);

  // ---------------------------------------------------------------- the top lane (z -6 → 18): stalls, shoppers, a tap
  b.box([0, 4.45, 0], [6.4, 0.9, 2.4], { surf: 'wood', look: 'counter', tint: 'blue' });
  b.box([0, 4.95, 0], [6.2, 0.1, 2.2], { surf: 'ice', look: 'ice' });
  b.decor('pricetags', [0, 5.0, 0], { w: 6.0, d: 2.0, n: 9, seed: 1 });
  b.stall(-3.25, 6.5, 6, -1, { h: 0.9, depth: 1.3, awning: 'blue', awningH: 2.4, base: 4 });
  b.stall(3.25, 10, 7, 1, { h: 0.9, depth: 1.3, awning: 'red', awningH: 2.4, base: 4 });
  b.crate(1.5, 4, 4.2, { yaw: 0.3 });
  b.crate(-1.9, 4, 13.6, { yaw: -0.2, look: 'lemoncrate' });
  b.crate(2.6, 4, 15.6, { size: [0.9, 0.9, 0.9], look: 'cratestack' });
  b.decor('basket', [-3.2, 4, 15.5], { kind: 'lemons' });
  b.puddle(-3.0, 4, 11.2, 0.75, { look: 'tap' });
  b.decor('walltap', [-3.95, 4.9, 11.2], { yaw: Math.PI / 2 });
  b.hazard({ kind: 'feet', id: 'shopper1', path: [[-2.6, 12.5], [2.4, 16.0]], speed: 0.95, phase: 0, look: 0, floor: 4 });
  b.drops([[-1.5, 4, 3.4], [-1.6, 4, 9], [-1.2, 4, 15.5]], 1.4);

  // ---------------------------------------------------------------- the steps (z 18 → 30): the channel's the quick way
  b.drops([[0, 3.85, 18.6], [0, 2.05, 29.8]], 1.3, 0.24);
  b.decor('pots', [-3.6, 2, 19], { z1: 29.5, side: 1, seed: 3, steps: [18, 30, 4, 2, 5] });
  b.decor('pots', [3.6, 2, 19], { z1: 29.5, side: -1, seed: 4, steps: [18, 30, 4, 2, 5] });

  // ---------------------------------------------------------------- the fountain square (z 30 → 62)
  b.fountain(0, 2, 46, 1.75);
  b.drops([[-1.65, 2.45, 46], [-1.15, 2.45, 47.5], [0, 2.45, 48.05]], 0.75);
  // the sunny side: a terrace of café parasols in a line, each a springboard to the next (slap one: a boost)
  const cafes = [[-3.1, 37.5, 'red', 0.2], [-3.3, 49.0, 'lemon', -0.3], [-2.6, 60.4, 'blue', 0.4]];
  for (const [x, z, tint, yaw] of cafes) {
    b.cafe(x, 2, z, { tint, yaw, h: 1.8 });
    b.drops([[x, 4.25, z]], 1, 0);
  }
  b.dropArc([-3.1, 3.84, 37.5], [-3.3, 3.84, 49.0], 3.0, 4);
  b.dropArc([-3.3, 3.84, 49.0], [-2.6, 3.84, 60.4], 3.0, 4);
  b.cafe(-5.6, 2, 43.2, { tint: 'red', yaw: 1.1, h: 1.8 });
  b.cafe(-5.7, 2, 54.6, { tint: 'lemon', yaw: 0.6, h: 1.8 });
  // above them, the flower ledge along the house fronts: a boost up from a parasol, water drops, a golden scale
  b.ledge(-7.5, 37.5, -6.4, 58.5, 4.75);
  b.decor('ledgepots', [-6.95, 4.75, 37.5], { z1: 58.5, seed: 8 });
  b.drops([[-6.95, 4.75, 40.5], [-6.95, 4.75, 56]], 1.4);
  b.scale(-6.95, 4.75, 58.0);
  // the shady side: the cat on its barrel by the fountain, a flower stall
  b.barrel(5.2, 2, 50.5, 0.36, 0.86);
  b.hazard({ kind: 'cat', id: 'cat', at: [5.2, 2.86, 50.5], floor: 2, radius: 2.2, period: 2.2, tele: 0.9, phase: 0.4 });
  b.stall(6.3, 35.5, 5, 1, { h: 0.85, depth: 1.1, awning: 'lemon', awningH: 2.3, base: 2, goods: 'flowers', ice: false });
  b.crate(5.8, 2, 57.4, { size: [1.2, 0.9, 1.0], look: 'cratestack2' });
  b.crate(3.4, 2, 58.2, { yaw: 0.4 });
  b.crate(-2.6, 2, 32.6, { yaw: -0.5, look: 'lemoncrate' });
  b.lamp(-6.6, 2, 49.5);
  b.lamp(6.6, 2, 43);
  b.hazard({ kind: 'feet', id: 'shopper2', path: [[-3.0, 39.6], [3.6, 40.4]], speed: 1.0, phase: 1.7, look: 1, floor: 2 });
  b.hazard({ kind: 'feet', id: 'shopper3', path: [[2.6, 55.5], [-3.0, 59.0]], speed: 1.05, phase: 0.6, look: 2, floor: 2 });
  b.puddle(2.6, 2, 33.4, 0.6);

  // ---------------------------------------------------------------- the auction yard (z 62 → 90): the belt, the big scale
  // the yard's floor falls 1.4 m over 28 m
  const yy = (z) => 2 + ((0.6 - 2) * (z - 62)) / 28;
  const belt = b.rampZ(0.6, 62.6, yy(62.6) + 0.62, 88.4, yy(88.4) + 0.62, 1.3, 'belt', 'belt', 0.62);
  belt.belt = [0, 2.3];
  b.drops([[0.6, yy(64) + 0.62, 64], [0.6, yy(87.5) + 0.62, 87.5]], 1.6);
  b.sail(-3.5, 66, 3.5, 75, yy(70) + 4.4, 'cream');
  b.sail(-3.2, 77.5, 3.0, 84, yy(80) + 4.2, 'blue');
  // fish boxes under tarps down the left: springboards, like the parasols
  const tarps = [72.0, 83.5];
  for (const z of tarps) {
    b.crate(-2.2, yy(z), z, { size: [1.5, 0.95, 1.4], look: 'fishboxes' });
    b.box([-2.2, yy(z) + 1.0, z], [1.7, 0.1, 1.6], { surf: 'bounce', look: 'tarp', tint: 'blue' });
    b.drops([[-2.2, yy(z) + 1.05, z]], 1, 0.35);
  }
  b.dropArc([-2.6, 3.84, 60.4], [-2.2, yy(72) + 1.05, 72], 2.6, 4);
  b.dropArc([-2.2, yy(72) + 1.05, 72], [-2.2, yy(83.5) + 1.05, 83.5], 2.6, 4);
  // and a tall stack on the right with a scale on top
  b.crate(3.3, yy(73), 73, { size: [1.3, 1.35, 1.2], look: 'fishboxes' });
  b.crate(-2.4, yy(66), 66, { size: [1.2, 0.9, 1.2], look: 'fishboxes' });
  b.crate(3.6, yy(81.6), 81.6, { size: [1.3, 2.25, 1.3], look: 'fishboxes' });
  b.scale(3.6, yy(81.6) + 2.25, 81.6);
  b.puddle(3.2, yy(67.5), 67.5, 0.7, { look: 'hose' });
  b.decor('hosereel', [4.6, yy(67.1), 67.1], {});
  // a buyer walks up and down by the hall
  b.hazard({ kind: 'feet', id: 'buyer1', path: [[-3.8, 64.5], [-3.6, 87]], speed: 1.1, phase: 0.0, look: 3, floor: 1.3 });
  b.decor('auctioneer', [-4.4, yy(70.5), 70.5], {});
  // the big scale: a pan on chains that swings across the end of the yard
  b.decor('gantry', [0, 0.6, 88.6], { w: 6.2, h: 5.6 });
  b.hazard({ kind: 'pendulum', id: 'scale', pivot: [0, 5.6, 88.6], len: 3.1, amp: 0.78, period: 3.8, yaw: Math.PI / 2, size: [1.15, 0.1, 1.15], phase: 0, look: 'scalepan' });

  // ---------------------------------------------------------------- the quay (z 90 → 120) and the boat on its blocks
  b.box([-5.75, 1.25, 106], [3.4, 1.3, 12], { surf: 'wood', look: 'boathull' });
  b.box([-5.75, 2.35, 101.6], [2.4, 0.9, 2.6], { surf: 'wood', look: 'wheelhouse' });
  // the tarp over the fish hold: the last springboard, off the boat and into the sea
  b.box([-5.75, 2.175, 107.4], [2.6, 0.55, 2.8], { surf: 'bounce', look: 'hatch', tint: 'red' });
  b.drops([[-5.75, 2.5, 107.4]], 1, 0.35);
  b.dropArc([-5.75, 2.5, 107.4], [-4.6, -0.6, 124], 3.4, 5);
  b.rampX(103.6, -1.6, 0.6, -4.05, 1.9, 0.55, 'wood', 'plank', 0.08);
  b.drops([[-1.9, 0.75, 103.6], [-3.9, 1.95, 103.6]], 1.0);
  b.scale(-4.9, 4.2, 114.5);
  b.bollard(-6.5, 0.6, 118.8);
  b.bollard(-1.5, 0.6, 118.8);
  b.bollard(3.5, 0.6, 118.8);
  b.bollard(7.8, 0.6, 118.8);
  b.box([3.2, 0.63, 97.5], [2.4, 0.06, 2.2], { surf: 'net', look: 'netpile' });
  b.crate(6.8, 0.6, 94.2, { size: [1.4, 0.9, 1.2], look: 'lobsterpots' });
  b.crate(6.9, 0.6, 108.4, { size: [1.4, 1.35, 1.2], look: 'lobsterpots' });
  b.crate(2.0, 0.6, 112.4, { yaw: 0.3 });
  b.iceCrate(-1.3, 0.6, 96.5, { size: [1.6, 0.42, 1.2] });
  b.puddle(4.6, 0.6, 102.6, 0.9, { look: 'bucketspill' });
  b.decor('bucket', [5.6, 0.6, 103.3], { tipped: true });
  b.puddle(-1.2, 0.6, 114.0, 0.7);
  b.decor('ropecoil', [0.6, 0.6, 118.3], {});
  b.hazard({ kind: 'gull', id: 'gull1', period: 8.4, phase: 2.0, spin: 0, cruiseH: 5.5, floor: 0.6, stations: [{ at: [1.6, 0.6, 108], drop: [0.5, 0.6, 94] }] });
  b.decor('quayedge', [0, 0.6, 120], { x0: -9, x1: 9 });
  b.finish([-40, -8, 120.25], [40, 0.45, 200], 'sea', 1.6, -0.6);

  const spine = [
    [0, 4.95, 0], [0, 4, 3.4], [-0.6, 4, 9], [-1.0, 4, 15], [-2.2, 3.3, 22], [-2.2, 2.3, 28.5], [-0.6, 2, 34], [2.4, 2, 41],
    [2.9, 2, 48], [2.4, 2, 55], [1.2, 2, 61], [-0.6, 1.7, 68], [-0.9, 1.2, 77], [-0.8, 0.8, 85], [0, 0.6, 93],
    [1.2, 0.6, 100], [-0.6, 0.6, 107], [-1.2, 0.6, 114], [0, 0.6, 119.6], [0, -0.4, 122],
  ];
  const tp = (z) => [-2.2, yy(z) + 1.21, z];
  const expert = [
    [0, 4.95, 0], [0, 4, 4], [0, 4, 15], [0, 3.9, 18.4], [0, 2.05, 30.4], [-3.1, 4.0, 37.5], [-3.3, 4.0, 49.0], [-2.6, 4.0, 60.4],
    tp(72), tp(83.5), [-2.0, 0.76, 95], [-5.75, 2.66, 107.4], [-4.6, -0.4, 122],
  ];

  return {
    id: 'market',
    name: 'The Fish Market',
    short: 'Fish Market',
    builder: b,
    spine,
    expert,
    start: { x: 0, y: 5.16, z: 0, yaw: 0 },
    slots: slotsOn(0, 5.17, 0, 1.45, 0.95),
    bounds: { minY: -10, min: [-12, -10], max: [14, 200] },
    sea: { y: -0.6, z0: 120.2, x0: -60, x1: 80, lighthouse: [18, 0, 210] },
    sky: 'noon',
    gentle: 14,
  };
}

/** Eight start places on a table: two rows of four. */
export function slotsOn(x, y, z, dx = 1.5, dz = 1.0) {
  const out = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) out.push([x + (c - 1.5) * dx, y, z + (r === 0 ? 0.5 : -0.5) * dz]);
  return out;
}
