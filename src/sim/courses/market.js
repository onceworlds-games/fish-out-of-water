// The Fish Market: off the ice of a fishmonger's stall, down a busy market street, past the cat, over the ice crates and
// along the quay into the harbour. The gentlest course: puddles close together, feet and one cat.

import { courseBuilder } from '../build.js';

export function market() {
  const b = courseBuilder('market');

  // ---------------------------------------------------------------- ground
  b.slab(-8, -7, 15, 140, 0, 'wet', 'wettile', 1);
  b.slab(-1, 140, 15, 188, 0.6, 'stone', 'quay', 1.6);
  b.rampZ(6, 136, 0, 141, 0.6, 3.2, 'wood', 'plankramp');
  // stone steps beside the ramp
  for (let i = 0; i < 3; i++) b.slab(8.6, 137.5 + i * 1.0, 11.5, 141, 0.2 * (i + 1), 'stone', 'quay', 0.2 * (i + 1));

  // walls that keep the street a street (the houses are drawn as decor along them)
  b.wall(-7.6, -8, -7.6, 112);
  b.wall(-7.6, 112, -1.2, 130);
  b.wall(-1.2, 130, -1.2, 190);
  b.wall(7.6, -8, 7.6, 116);
  b.wall(7.6, 116, 13.8, 124);
  b.wall(13.8, 124, 13.8, 190);
  b.wall(-8, -6.5, 15, -6.5);
  b.houses(-7.6, -8, 112, -1, { seed: 3 });
  b.houses(7.6, -8, 116, 1, { seed: 7 });
  b.houses(13.8, 124, 186, 1, { seed: 11, base: 0.6 });
  b.decor('jog', [0, 0, 0], { pts: [[-7.6, 112], [-1.2, 130]], side: -1 });
  b.decor('jog', [0, 0, 0], { pts: [[7.6, 116], [13.8, 124]], side: 1 });
  b.decor('railing', [-1.0, 0.6, 140], { z1: 188 });
  b.decor('backwall', [0, 0, -6.6], { w: 16 });

  // ---------------------------------------------------------------- the start: a fishmonger's ice table
  b.box([0, 0.45, 0], [6.6, 0.9, 2.6], { surf: 'wood', look: 'counter', tint: 'blue' });
  b.box([0, 0.95, 0], [6.4, 0.1, 2.4], { surf: 'ice', look: 'ice' });
  b.decor('pricetags', [0, 1.0, 0], { w: 6.2, d: 2.2, n: 9, seed: 1 });
  b.decor('awning', [0, 3.1, -0.4], { w: 7.4, d: 3.4, tint: 'red', slope: 0.25, axis: 'z' });

  // ---------------------------------------------------------------- A: the stalls (z 2-30)
  b.stall(5.7, 12, 11, 1, { awning: 'red' });
  b.stall(-5.7, 16, 12, -1, { awning: 'blue' });
  b.crate(1.9, 0, 8.5, { yaw: 0.3 });
  b.crate(-2.4, 0, 13.5, { yaw: -0.2 });
  b.crate(-2.35, 0.45, 13.55, { yaw: -0.1, look: 'lemoncrate' });
  b.crate(0.8, 0, 23, { yaw: 0.5 });
  b.crate(3.4, 0, 26, { yaw: -0.4, look: 'lemoncrate' });
  b.puddle(-0.6, 0, 17, 0.95);
  b.puddle(4.3, 0, 9.5, 0.55);

  // ---------------------------------------------------------------- B: the crowd (z 30-70); crate tops above the feet
  b.stall(5.7, 42, 15, 1, { awning: 'red' });
  b.crate(-4.3, 0, 31.2, { size: [1.0, 0.45, 1.0] });
  b.crate(-4.3, 0, 32.4, { size: [1.0, 0.9, 1.2] });
  for (let i = 0; i < 6; i++) {
    const z = 34.2 + i * 4.0;
    b.crate(-4.3, 0, z + 1.2, { size: [1.1, 0.9, 2.6], look: i % 2 ? 'cratestack' : 'cratestack2' });
  }
  b.crate(-4.3, 0, 59.6, { size: [1.0, 0.45, 1.0] });
  b.puddle(0.6, 0, 39.5, 0.8);
  b.puddle(2.9, 0, 52, 1.0, { look: 'mop' });
  b.decor('mopbucket', [3.9, 0, 52.6], {});
  b.crate(1.0, 0, 46, { yaw: 0.2 });
  b.crate(-1.6, 0, 62, { yaw: -0.6, look: 'lemoncrate' });
  b.crate(2.4, 0, 64.5, { yaw: 0.1 });
  b.hazard({ kind: 'feet', id: 'shopper1', path: [[-3.2, 35], [4.2, 41]], speed: 1.05, phase: 0.0, look: 0 });
  b.hazard({ kind: 'feet', id: 'shopper2', path: [[4.0, 47.5], [-3.0, 53]], speed: 1.15, phase: 2.7, look: 1 });
  b.hazard({ kind: 'feet', id: 'shopper3', path: [[-2.8, 60], [3.8, 66.5]], speed: 0.95, phase: 1.3, look: 2 });
  b.hazard({ kind: 'feet', id: 'shopper4', path: [[3.6, 21], [-2.6, 27]], speed: 1.0, phase: 0.6, look: 3 });

  // ---------------------------------------------------------------- C: the cat (z 70-110), the awning line, the ice crates
  b.stall(-5.7, 76, 12, -1, { awning: 'blue' });
  b.barrel(-0.4, 0, 82, 0.36, 0.86);
  b.hazard({ kind: 'cat', id: 'cat', at: [-0.4, 0.86, 82], floor: 0, radius: 2.2, period: 2.1, tele: 0.9, phase: 0.4 });
  b.crate(-3.6, 0, 80.5, { size: [1.6, 0.9, 1.3] });
  b.crate(-3.6, 0.9, 80.6, { size: [1.2, 0.45, 1.0], look: 'lemoncrate' });
  b.crate(2.9, 0, 83.5, { size: [1.4, 0.9, 1.3] });
  // the expert line: a step, a low bouncy awning, the kiosk roof, down past the cat
  b.crate(4.6, 0, 71.2, { size: [1.2, 0.9, 1.2] });
  const low = b.box([5.4, 1.75, 75.0], [2.2, 0.08, 3.0], { surf: 'bounce', look: 'awning', tint: 'red' });
  low.slope = 0.0;
  b.decor('awningposts', [5.4, 1.75, 75.0], { len: 3.0, aw: 2.2, side: 1 });
  b.box([5.0, 1.3, 85], [3.0, 2.6, 8.0], { surf: 'wood', look: 'kiosk' });
  b.decor('kioskroof', [5.0, 2.6, 85], { w: 3.0, d: 8.0 });
  b.puddle(0.2, 0, 72.5, 0.7);
  b.iceCrate(-0.2, 0, 96.5, { size: [2.2, 0.42, 2.2] });
  for (let i = 0; i < 6; i++) b.iceCrate(-0.2, 0, 99.2 + i * 2.15, { size: [2.0, 0.42, 2.1] });
  b.puddle(-3.4, 0, 101, 0.8);
  b.stall(5.7, 102, 12, 1, { awning: 'red' });
  b.crate(-4.8, 0, 94, { yaw: 0.4 });

  // ---------------------------------------------------------------- D: the bend (z 110-145), the hose, up onto the quay
  b.crate(3.0, 0, 116.5, { yaw: -0.3 });
  b.crate(-0.2, 0, 122, { yaw: 0.6, look: 'lemoncrate' });
  b.spray(6.2, 0, 127.5, 1.4, 55, 'hose');
  b.puddle(6.4, 0, 127.6, 0.7, { look: 'puddle' });
  b.decor('hosereel', [9.0, 0, 127], {});
  b.barrel(10.6, 0, 131.5);
  b.barrel(11.3, 0, 132.4, 0.3, 0.8);
  b.crate(3.0, 0, 133, { size: [1.6, 0.9, 1.2] });

  // ---------------------------------------------------------------- E: the quay (z 141-188)
  b.bollard(1.0, 0.6, 148);
  b.bollard(1.0, 0.6, 160);
  b.bollard(1.0, 0.6, 172);
  b.bollard(1.0, 0.6, 184);
  b.box([5.0, 0.62, 154.5], [2.6, 0.06, 2.4], { surf: 'net', look: 'netpile' });
  b.crate(9.5, 0.6, 150, { size: [1.6, 0.9, 1.3], look: 'cratestack' });
  b.crate(9.5, 1.5, 150.1, { size: [1.3, 0.45, 1.0], look: 'icecrate', surf: 'ice' });
  b.crate(3.2, 0.6, 167, { size: [1.2, 0.9, 1.2] });
  b.crate(11.0, 0.6, 176, { size: [1.8, 0.9, 1.4], look: 'cratestack2' });
  b.puddle(7.4, 0.6, 162.5, 1.0, { look: 'bucketspill' });
  b.decor('bucket', [8.4, 0.6, 163.4], { tipped: true });
  b.puddle(4.0, 0.6, 179, 0.7);
  b.decor('bunting', [6.5, 0, 186], { x0: -1, x1: 13.8, h: 4.5 });
  b.finish([-30, -8, 188.25], [40, 0.45, 260]);
  b.decor('quayedge', [6.4, 0.6, 188], { x0: -1, x1: 13.8 });

  const spine = [
    [0, 1.0, 0], [0, 0, 5], [-0.4, 0, 17], [0.4, 0, 28], [0.8, 0, 39.5], [2.6, 0, 51.5], [1.8, 0, 62], [0.6, 0, 72.5],
    [1.4, 0, 79], [1.6, 0, 86], [0.0, 0, 93], [-0.2, 0.42, 98], [-0.2, 0.42, 111], [2.0, 0, 117], [5.8, 0, 125], [6.2, 0, 128],
    [6.0, 0, 135.5], [6.0, 0.6, 142], [6.8, 0.6, 152], [7.4, 0.6, 162.5], [6.5, 0.6, 175], [6.5, 0.6, 187.6], [6.5, -0.4, 191],
  ];
  const expert = [
    [0, 1.0, 0], [-1.5, 0, 8], [-3.0, 0, 20], [-4.3, 0.45, 31.2], [-4.3, 0.9, 32.4], [-4.3, 0.9, 40], [-4.3, 0.9, 50],
    [-4.3, 0.9, 57], [-1.2, 0, 64], [1.6, 0, 68], [4.6, 0.9, 71.2], [5.4, 1.8, 75], [5.0, 2.6, 82], [5.0, 2.6, 88],
    [2.0, 0, 93], [-0.2, 0.42, 98], [-0.2, 0.42, 111], [3.0, 0, 119], [6.2, 0, 127.5], [6.0, 0.6, 142], [7.4, 0.6, 162.5],
    [6.5, 0.6, 187.6], [6.5, -0.4, 191],
  ];

  return {
    id: 'market',
    name: 'The Fish Market',
    short: 'Fish Market',
    builder: b,
    spine,
    expert,
    start: { x: 0, y: 1.16, z: 0, yaw: 0 },
    slots: slotsOn(0, 1.17, 0),
    bounds: { minY: -10, min: [-12, -10], max: [20, 262] },
    sea: { y: -0.6, z0: 188.2, x0: -60, x1: 80, lighthouse: [6, 0, 245] },
    sky: 'noon',
    gentle: 30,
  };
}

/** Eight start places on a table: two rows of four. */
export function slotsOn(x, y, z, dx = 1.5, dz = 1.0) {
  const out = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) out.push([x + (c - 1.5) * dx, y, z + (r === 0 ? 0.5 : -0.5) * dz * (r === 0 ? 1 : 1)]);
  return out;
}
