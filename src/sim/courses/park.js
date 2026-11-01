// The Park: off a picnic table's ice at the top of the hill, across the lawn (a bouncy castle, sprinklers, the trees'
// shade), down the slope and over the boules pitch past the fountain, down the grand stairs or slide their handrail,
// through the garden (the duck pond; a trampoline throws you onto the bandstand's springy roof) to the harbour wall.

import { courseBuilder } from '../build.js';
import { slotsOn } from './market.js';

export function park() {
  const b = courseBuilder('park');
  const XW = 12;
  const ZE = 158; // the harbour wall
  const S0 = 86; // the top of the grand stairs

  // ---------------------------------------------------------------- the hill: the lawn, a grassy slope, the terrace, the stairs
  b.slab(-40, -10, 40, 36, 6, 'grass', 'grass', 7);
  b.rampZ(0, 36, 6, 44, 4, 80, 'grass', 'grass', 0.5);
  b.slab(-40, 44, 40, S0, 4, 'grass', 'grass', 5);
  b.slab(-XW, 50, XW, 70, 4.02, 'gravel', 'gravel', 0.1);
  for (let i = 0; i < 10; i++) b.slab(-40, S0 + i, 40, S0 + 1 + i, 4 - 0.25 * (i + 1), 'stone', 'parkstep', 5 - 0.25 * (i + 1));
  b.slab(-40, S0 + 10, 40, 138, 1.5, 'grass', 'grass', 2.5);
  b.rampZ(0, 138, 1.5, 144, 0.6, 80, 'stone', 'quay', 0.5);
  b.slab(-40, 144, 40, ZE, 0.6, 'stone', 'quay', 1.6);
  b.decor('quayedge', [0, 0.6, ZE], { x0: -40, x1: 40 });
  // the edges: hedges along the sides, walls you can't flop over
  for (const x of [-XW, XW]) {
    b.box([x, 6.6, 13], [0.9, 1.2, 46], { surf: 'grass', look: 'hedge' });
    b.box([x, 4.6, 65], [0.9, 1.2, 42], { surf: 'grass', look: 'hedge' });
    b.box([x, 2.1, 117], [0.9, 1.2, 42], { surf: 'grass', look: 'hedge' });
    b.wall(x, -8, x, ZE + 10, 14, -1);
  }
  b.wall(-XW, -7, XW, -7, 14, 4);
  b.decor('mowstripes', [0, 0, 0], { x: 11.55, w: 2.5, bands: [[-6.6, 36, 6], [44, 50, 4], [70, S0, 4], [S0 + 10, 138, 1.5]] });
  // beyond the hedges: gravel walks with lamps, the woods, people out in the sun; flower borders inside the hedges
  const levels = [[44, 6], [S0 + 5, 4], [999, 1.5]];
  const skip = [[35, 45], [S0 - 1, S0 + 11], [137, 999]];
  b.decor('walks', [0, 0, 0], { x: 17, w: 2.2, bands: [[-8, 35, 6], [45, S0 - 1, 4], [S0 + 11, 137, 1.5]] });
  b.decor('woods', [0, 0, 0], { seed: 3, n: 80, xin: 15.5, xout: 46, walk: 17, z0: -8, z1: 142, levels, skip });
  b.decor('parkfolk', [0, 0, 0], { seed: 8, n: 40, xin: 14.5, xout: 30, walk: 17, z0: 0, z1: 136, levels, skip });
  b.decor('borders', [0, 0, 0], { x: 11.15, w: 0.75, bands: [[-6, 35.5, 6], [44.5, 85.5, 4], [96.5, 137.5, 1.5]] });
  b.decor('town', [0, 0, 0], { z0: 146, z1: 176 });
  b.decor('lamps', [0, 4, 46], { x0: -11, x1: 11, every: 22 });

  // ---------------------------------------------------------------- the start: an ice tray on the picnic trestle
  b.box([0, 6.71, 0], [6.6, 0.08, 2.6], { surf: 'wood', look: 'trestle' });
  b.box([0, 6.8, 0], [6.4, 0.1, 2.4], { surf: 'ice', look: 'ice' });
  b.decor('trestlelegs', [0, 6, 0], { w: 6.6, d: 2.6, h: 0.67 });

  // ---------------------------------------------------------------- A: the lawn on the hill (z 4-36)
  picnic(b, -5.5, 6, 11, 0.3);
  picnic(b, -4.2, 6, 30, 0.1);
  b.cyl([-8, 6, 16], 0.45, 0.85, { surf: 'hot', look: 'bbq' });
  b.decor('blanket', [6.5, 6, 30], { yaw: 0.3 });
  b.decor('blanket', [-7.5, 6, 22], { yaw: -0.2 });
  // the bouncy castle: a springy floor between soft walls, open at the front, a fat bumper at the back; a golden scale
  // floats high over it
  const CX = 5, CZ = 13;
  b.box([CX, 6.22, CZ], [3.4, 0.44, 3.4], { surf: 'bounce', look: 'bouncy' });
  b.box([CX + 1.82, 6.85, CZ], [0.3, 1.7, 3.4], { surf: 'plush', look: 'bouncywall' });
  b.box([CX - 1.82, 6.85, CZ], [0.3, 1.7, 3.4], { surf: 'plush', look: 'bouncywall' });
  b.box([CX, 6.66, CZ + 1.82], [3.94, 0.44, 0.34], { surf: 'bounce', look: 'bouncybump' });
  b.decor('bouncy', [CX, 6, CZ], { w: 3.4 });
  b.scale(CX, 8.9, CZ + 0.4);
  b.drops([[CX, 6.44, CZ - 1.2], [CX, 6.44, CZ + 1.2]], 1.2, 0.35);
  b.hazard({ kind: 'sprinkler', id: 'spr1', at: [-7, 6, 21.5], yaw: Math.PI / 2, arc: 1.4, period: 4.8, phase: 0 });
  b.hazard({ kind: 'sprinkler', id: 'spr2', at: [8, 6, 32], yaw: -Math.PI / 2 - 0.2, arc: 1.4, period: 5.4, phase: 1.7 });
  b.puddle(-2.8, 6, 17, 0.75);
  b.puddle(1.5, 6, 25, 0.35, { look: 'bowl' });
  b.decor('dogbowl', [1.5, 6, 25], {});
  b.puddle(-1.5, 6, 33, 0.8);
  b.tree(-9.2, 6, 5, { h: 5.2, r: 2.3, trunk: 0.24, look: 'parktree', kind: 'oak' });
  b.tree(9.4, 6, 23, { h: 5.6, r: 2.4, trunk: 0.24, look: 'parktree', kind: 'lime' });
  b.tree(-8.8, 6, 33.5, { h: 4.8, r: 2.1, trunk: 0.22, look: 'parktree', kind: 'blossom' });
  b.drops([[0, 6, 3.6], [-1.4, 6, 8], [-2.8, 6, 13]], 1.4);
  b.drops([[-1, 6, 20.5], [1.5, 6, 25], [0, 6, 29.5]], 1.5);
  // down the slope: a line to roll
  b.drops([[0, 6, 35.6], [0, 4, 44.4], [2.6, 4, 47]], 1.4);

  // ---------------------------------------------------------------- B: the terrace: the boules pitch (z 50-70) and the fountain
  b.puddle(4.6, 4, 47.5, 0.8);
  b.decor('can', [5.4, 4, 48.1], {});
  for (const [z, ph, per] of [[56, 0, 2.6], [64, 1.1, 2.9]]) {
    b.hazard({ kind: 'boules', id: `boule${z}`, z, x0: -11.4, x1: 11.4, floor: 4.02, period: per, phase: ph, wind: 0.8, speed: 5 });
    b.decor('chute', [-12.2, 4.02, z], { dir: 1 });
    b.decor('chute', [12.2, 4.02, z], { dir: -1 });
  }
  b.puddle(-3.2, 4.02, 59.8, 0.6, { look: 'can' });
  b.puddle(3.6, 4.02, 67.6, 0.6, { look: 'can' });
  b.drops([[-3.2, 4.02, 51.5], [-3.2, 4.02, 58.6]], 1.4);
  b.drops([[3.6, 4.02, 61], [3.6, 4.02, 66.4]], 1.4);
  b.decor('bench', [-9.5, 4, 74], { yaw: Math.PI / 2 });
  b.decor('bench', [9.5, 4, 76], { yaw: -Math.PI / 2 });
  b.fountain(0, 4, 77.5, 2.3, { rim: 0.5 });
  b.drops([[-3.6, 4, 72], [-3.6, 4, 83.5]], 1.5);
  b.drops([[3.6, 4, 72], [3.6, 4, 83.5]], 1.5);
  b.tree(-8.6, 4, 80, { h: 5.4, r: 2.4, trunk: 0.24, look: 'parktree', kind: 'copper' });
  b.tree(8.8, 4, 70.5, { h: 5, r: 2.2, trunk: 0.22, look: 'parktree', kind: 'oak' });

  // ---------------------------------------------------------------- C: the grand stairs and their handrails (z 86-96)
  for (const x of [-6, 0, 6]) {
    b.rampZ(x, S0 - 0.7, 4.85, S0 + 10.6, 2.35, 0.34, 'rail', 'handrail', 0.1);
    b.decor('railposts', [x, 0, 0], { z0: S0 - 0.4, y0: 4.0, z1: S0 + 10.4, y1: 1.5, top0: 4.8, top1: 2.3, s0: S0 });
  }
  // the middle rail: drops all the way down; a golden scale hangs high over the stairs (leap off the top to fly to it)
  const railY = (z) => 4.85 - ((z - (S0 - 0.7)) / 11.3) * 2.5;
  b.drops([[0, railY(S0 - 0.2), S0 - 0.2], [0, railY(S0 + 9.6), S0 + 9.6]], 1.3, 0.22);
  b.scale(0, railY(S0 + 5.2) + 1.6, S0 + 5.2);

  // ---------------------------------------------------------------- D: the garden (z 96-138): the pond, the bandstand
  b.box([-6.5, 1.75, 103], [7, 0.5, 2], { surf: 'grass', look: 'roses' });
  b.box([6.2, 1.75, 131.5], [7, 0.5, 2], { surf: 'grass', look: 'roses' });
  b.puddle(2.6, 1.5, 99.6, 0.8);
  // the duck pond: a wide shallow pool to drink from, lily pads, reeds, a duck house
  b.puddle(-4.2, 1.5, 115, 2.9, { look: 'pond' });
  b.decor('pond', [-4.2, 1.5, 115], { r: 2.9 });
  // the bandstand: a stone stage under a striped canvas roof that throws you on; the trampoline beside it gets you up
  const BX = 5, BZ = 117;
  b.cyl([BX, 1.5, BZ], 2.6, 0.7, { surf: 'stone', look: 'bandbase' });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.cyl([BX + Math.cos(a) * 2.35, 2.2, BZ + Math.sin(a) * 2.35], 0.07, 2.4, { surf: 'steel', look: null });
  }
  b.cyl([BX, 4.6, BZ], 2.9, 0.16, { surf: 'bounce', look: null });
  b.decor('bandstand', [BX, 1.5, BZ], { r: 2.6, roof: 4.6 });
  b.scale(BX, 4.76, BZ);
  b.box([BX - 0.4, 1.68, BZ - 5.6], [1.7, 0.36, 1.7], { surf: 'bounce', look: 'trampoline' });
  b.dropArc([BX - 0.4, 1.86, BZ - 5.6], [BX, 4.76, BZ - 1.2], 1.0, 3);
  b.hazard({ kind: 'sprinkler', id: 'spr3', at: [9.5, 1.5, 125], yaw: -Math.PI / 2, arc: 1.6, period: 5.0, phase: 0.8, reach: 5 });
  b.hazard({ kind: 'sprinkler', id: 'spr4', at: [-9.5, 1.5, 131], yaw: Math.PI / 2, arc: 1.6, period: 4.6, phase: 2.9, reach: 5 });
  b.puddle(-1.2, 1.5, 125.5, 0.35, { look: 'bowl' });
  b.decor('dogbowl', [-1.2, 1.5, 125.5], {});
  b.puddle(1.8, 1.5, 133.6, 0.8);
  b.drops([[2.6, 1.5, 101], [0, 1.5, 107], [-1.4, 1.5, 111.5]], 1.5);
  b.drops([[-0.8, 1.5, 119], [-1.2, 1.5, 125.5], [0.8, 1.5, 130.5], [0, 1.5, 137.6]], 1.6);
  b.tree(-9, 1.5, 125, { h: 5.4, r: 2.4, trunk: 0.24, look: 'parktree', kind: 'oak' });
  b.tree(9.2, 1.5, 106, { h: 5.2, r: 2.3, trunk: 0.22, look: 'parktree', kind: 'blossom' });

  // ---------------------------------------------------------------- E: the harbour front (z 144-158)
  b.puddle(3, 0.6, 146.6, 0.8);
  b.puddle(-2.2, 0.6, 151.5, 0.8, { look: 'bucketspill' });
  b.decor('bucket', [-1.2, 0.6, 152.2], { tipped: true });
  b.crate(-5.5, 0.6, 147, { size: [1.4, 0.9, 1.2], look: 'cratestack' });
  b.crate(6.6, 0.6, 151, { size: [1.2, 0.9, 1.2], look: 'cratestack2' });
  for (const [x, z, tint] of [[-7, 153, 'red'], [7.4, 146, 'blue']]) b.cafe(x, 0.6, z, { tint, h: 2.1 });
  b.box([9.6, 1.9, 154.5], [2.4, 2.6, 3.4], { surf: 'wood', look: 'kiosk' });
  b.decor('kioskroof', [9.6, 3.2, 154.5], { w: 2.4, d: 3.4 });
  for (const x of [-8, 0, 8]) b.bollard(x, 0.6, ZE - 1.2);
  b.decor('bunting', [0, 0, ZE - 2], { x0: -XW, x1: XW, h: 6.0 });
  b.drops([[0, 0.6, 145], [3, 0.6, 146.6], [0.5, 0.6, 156.4]], 1.5);
  b.finish([-40, -8, ZE + 0.25], [40, 0.45, 300], 'sea', 1.6, -0.6);

  // the lawn up close: tufts, daisies and clover, leaves under the trees; clear of water, blankets and anything standing
  const avoid = [
    ...b.zones.filter((z) => z.kind === 'puddle').map((z) => [z.c[0], z.c[2], z.r + (z.look === 'pond' ? 0.6 : 0.25)]),
    [6.5, 30, 1.3], [-7.5, 22, 1.3], [CX, CZ, 2.7], [BX - 0.4, BZ - 5.6, 1.3], [BX, BZ, 2.9], [0, 77.5, 2.9], [0, 0, 1.6],
    ...[-3, -2, -1, 0, 1, 2, 3].flatMap((k) => [[-6.5 + k, 103, 1.15], [6.2 + k, 131.5, 1.15]]),
  ];
  const trees = b.decors.filter((d) => d.look === 'parktree').map((d) => [d.at[0], d.at[1], d.at[2], d.r, d.kind]);
  b.decor('lawn', [0, 0, 0], { x: 11, bands: [[-6.6, 35.5, 6], [44.5, 50, 4], [70, 85.5, 4], [96.5, 137.5, 1.5]], avoid, trees, outer: [12.9, 30, 17], levels, skip, seed: 12 });

  const spine = [
    [0, 6.85, 0], [0, 6, 4.5], [-2.8, 6, 17], [1.5, 6, 25], [-1.5, 6, 33], [0, 5.0, 40], [4.6, 4, 47.5], [-3.2, 4, 59.8],
    [3.6, 4, 67.6], [-3.6, 4, 74], [-3.6, 4, 84], [-3, 1.5, S0 + 11.5], [2.6, 1.5, 99.6], [0, 1.5, 107], [-1.6, 1.5, 114],
    [-1.2, 1.5, 125.5], [1.8, 1.5, 133.6], [0, 1.5, 137.5], [0, 0.6, 145], [3, 0.6, 146.6], [-2.2, 0.6, 151.5], [1, 0.6, 157.5],
    [1, -0.4, 160],
  ];
  const expert = [
    [0, 6.85, 0], [2.6, 6, 6], [CX, 6.44, CZ - 0.6], [2, 6, 21], [1.5, 6, 25], [0, 5.0, 40], [4.6, 4, 47.5], [3.6, 4, 67.6],
    [3.6, 4, 83], [0, 4.85, S0 - 0.4], [0, 2.45, S0 + 10.3], [BX - 0.4, 1.86, BZ - 5.6], [BX, 4.76, BZ - 0.6], [1, 1.5, 128],
    [1.8, 1.5, 133.6], [0, 0.6, 145], [1, 0.6, 157.5], [1, -0.4, 160],
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
    bounds: { minY: -10, min: [-16, -10], max: [16, 240] },
    sea: { y: -0.6, z0: ZE + 0.2, x0: -60, x1: 80, lighthouse: [-24, 0, 240] },
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
