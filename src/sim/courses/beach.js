// The Beach: out of an angler's cool box on the promenade, over the dunes (the boardwalk is the cool way round, the
// parasols a springboard line along the right), past the tide pools and their crabs, up Kite Hill or the lifeguard
// tower (a lilo bounces you onto its deck; off the front the blowhole's spout throws you up), under the gulls (one of
// them a lucky one), along the old groyne over the wet sand and into the surf.

import { courseBuilder } from '../build.js';
import { slotsOn } from './market.js';

// the dunes: buried spheres, so the sand is one smooth hump a fish can roll down. [x, z, top, R]
const DUNES = [
  [-1, 16, 1.1, 16],
  [0, 34, 1.5, 18],
  [-6.5, 66, 2.0, 14],
];

/** The height of the sand at (x, z) on the upper beach (the dunes over the flat). */
export function beachY(x, z) {
  let y = 0;
  for (const [dx, dz, top, R] of DUNES) {
    const d2 = (x - dx) ** 2 + (z - dz) ** 2;
    if (d2 < R * R) y = Math.max(y, top - R + Math.sqrt(R * R - d2));
  }
  return y;
}

export function beach() {
  const b = courseBuilder('beach');
  const XW = 12.5; // the groynes either side
  const ZW = 150; // where the water starts
  const WET = 98; // where the sand turns wet
  const on = (x, z) => [x, beachY(x, z), z];

  // ---------------------------------------------------------------- ground: the promenade, the dunes, wet sand, the slope into the sea
  b.slab(-60, -12, 60, 3, 1.0, 'stone', 'prom', 2);
  b.decor('promenade', [0, 1.0, 3], { x0: -60, x1: 60 });
  b.slab(-60, 3, 60, WET, 0, 'sand', 'sand', 1);
  b.slab(-60, WET, 60, ZW - 8, 0, 'wetsand', 'wetsand', 1);
  b.rampZ(0, ZW - 8, 0, ZW + 6, -0.9, 120, 'wetsand', 'wetsand', 0.4);
  b.decor('tideline', [0, 0, WET], { x0: -60, x1: 60 });
  for (const [x, z, top, R] of DUNES) b.sphere([x, top - R, z], R, { surf: 'sand', look: 'dune' });
  b.decor('marram', [0, 0, 0], { seed: 3, dunes: DUNES, n: 120, avoid: [[-9, 3], [-9, 16], [-10.5, 22], [-10.5, 32], [-8.5, 38], [-8.5, 46]] });
  // steps down from the promenade
  for (let i = 0; i < 3; i++) b.slab(-8.5, 3, -4.5, 3.6 + i * 0.55, 0.75 - i * 0.25, 'stone', 'promstep', 0.3);
  // the groynes: old timber breakwaters, the course's edges
  for (const x of [-XW, XW]) {
    b.box([x, -0.1, (3 + ZW + 6) / 2], [0.5, 2.4, ZW + 3], { surf: 'wood', look: 'groyne' });
    b.wall(x, -2.5, x, ZW + 30, 8);
  }
  b.wall(-XW - 0.5, -2, XW + 0.5, -2, 8);
  b.decor('huts', [0, 1.0, -7], { x0: -46, x1: 46 });
  b.decor('pier', [34, 0, 0], { z0: 3, z1: 230 });
  b.decor('crowd', [0, 0, 0], { seed: 7, n: 90, xin: 15, xout: 48, z0: 8, z1: 140 });
  // kites: [x, z, height, colour, the flyer's x, z]
  b.decor('kites', [0, 0, 0], { list: [[-6.5, 68, 9, 0, -16, 57], [-24, 40, 11, 1, -27, 30], [22, 92, 10, 2, 25, 82], [-30, 110, 8, 3, -33, 101]] });

  // ---------------------------------------------------------------- the start: an angler's cool box of ice on the promenade
  b.box([0, 1.32, -0.4], [4.2, 0.64, 2.0], { surf: 'steel', look: 'coolbox' });
  b.box([0, 1.67, -0.4], [4.0, 0.08, 1.8], { surf: 'ice', look: 'ice' });
  b.decor('rods', [2.6, 1.0, -1.6], {});

  // ---------------------------------------------------------------- A: the dunes (z 3-46)
  // the main line goes over the dunes: a bucket at the foot, the beach shower in the dip, a cool box's melt
  b.puddle(3.2, 0, 6.8, 0.55, { look: 'bucket' });
  b.decor('bucket', [3.7, 0, 7.4], { tipped: true, tint: 'red' });
  b.drops([on(0.6, 9.5), on(-0.6, 13), on(-1, 16), on(-0.6, 19.5), on(0.6, 22.5)], 1.5);
  b.cyl(on(-3.4, 14.2), 0.62, 0.62, { surf: 'sand', look: 'castle' });
  b.spray(2.6, 0, 25.4, 1.3, 50, 'shower');
  b.box([-3.6, 0.25, 26.6], [1.0, 0.5, 0.6], { surf: 'plush', look: 'coolbox2' });
  b.puddle(-2.6, 0, 26.6, 0.7, { look: 'melt' });
  b.drops([on(0.2, 28), on(0, 31), on(0, 34), on(0.4, 37.5), on(1.4, 41)], 1.5);
  b.sphere([4.6, 0.42, 21], 0.42, { surf: 'bounce', look: 'beachball' });
  b.box([-4.8, 0.6, 44.5], [3.6, 1.2, 0.12], { surf: 'plush', look: 'windbreak' });
  b.puddle(3.6, 0, 44.2, 0.5, { look: 'bucket' });
  b.decor('bucket', [4.1, 0, 44.7], { tipped: true, tint: 'blue' });
  b.decor('towel', [-3.2, 0, 41], { tint: 'lemon', yaw: 0.2 });
  b.decor('deckchair', [-5.2, 0, 22], { yaw: 0.6, tint: 'blue' });
  b.decor('deckchair', [-4.4, 0, 23.2], { yaw: 0.4, tint: 'red' });
  // the boardwalk: the cool way round on the left, drops all along it
  const walk = [[-9, 3], [-9, 16], [-10.5, 22], [-10.5, 32], [-8.5, 38], [-8.5, 46]];
  for (let i = 1; i < walk.length; i++) {
    const [ax, az] = walk[i - 1], [cx, cz] = walk[i];
    const len = Math.hypot(cx - ax, cz - az) + 1.6;
    b.box([(ax + cx) / 2, 0.2, (az + cz) / 2], [1.8, 0.4, len], { surf: 'wood', look: 'boardwalk', yaw: Math.atan2(cx - ax, cz - az) });
  }
  b.drops(walk.slice(1).map(([x, z]) => [x, 0.4, z]), 1.6);
  // the parasols along the right: a springboard line (slap each canopy), shade under them, a scale high over the third
  const PARASOLS = [[8, 10, 'red'], [9.2, 16.6, 'blue'], [8, 23.2, 'lemon'], [9.2, 29.8, 'red'], [8, 36.4, 'blue']];
  for (const [x, z, tint] of PARASOLS) b.parasol(x, 0, z, { tint });
  for (let i = 1; i < PARASOLS.length; i++) b.dropArc([PARASOLS[i - 1][0], 2.18, PARASOLS[i - 1][1]], [PARASOLS[i][0], 2.18, PARASOLS[i][1]], 1.3, 2);
  b.scale(8.25, 3.1, 22.2);
  // a bucket at the start of the line, a paddling pool in the shade near its end
  b.puddle(6.2, 0, 5.6, 0.5, { look: 'bucket' });
  b.decor('bucket', [6.7, 0, 6.1], { tipped: true, tint: 'lemon' });
  b.puddle(6.6, 0, 33.2, 0.95, { look: 'paddling' });
  b.decor('paddlingpool', [6.6, 0, 33.2], { r: 0.95 });
  b.decor('towel', [8.6, 0, 11.4], { tint: 'blue', yaw: 0.15 });
  b.decor('towel', [8.4, 0, 24.6], { tint: 'red', yaw: -0.2 });
  b.decor('towel', [8.8, 0, 31.2], { tint: 'lemon', yaw: 0.1 });

  // ---------------------------------------------------------------- B: the tide pools, Kite Hill and the tower (z 46-98)
  b.puddle(3, 0, 50.5, 1.1, { look: 'pool' });
  b.decor('rocks', [3, 0, 50.5], { r: 1.1, seed: 1 });
  b.puddle(0.4, 0, 59, 1.0, { look: 'pool' });
  b.decor('rocks', [0.4, 0, 59], { r: 1.0, seed: 2 });
  b.hazard({ kind: 'crab', id: 'crab1', path: [[0.2, 53.6], [6.2, 54.2]], stops: 3, period: 2.9, tele: 0.85, phase: 0.4, face: Math.PI });
  b.hazard({ kind: 'crab', id: 'crab2', path: [[-3.6, 57.4], [-1.6, 61.6]], stops: 3, period: 3.2, tele: 0.9, phase: 1.6, face: 2.0 });
  // Kite Hill: the tallest dune, a bucket on top, kites over it; a long flop down off its crest
  b.puddle(-6.5, 2.0, 66, 0.5, { look: 'bucket' });
  b.decor('bucket', [-6.0, 2.0, 66.5], { tipped: true, tint: 'lemon' });
  b.drops([on(-4.2, 60.5), on(-5.6, 63.4), on(-6.3, 68.8), on(-5.4, 72.4)], 1.3);
  b.puddle(2, 0, 68.5, 0.45, { look: 'bucket' });
  b.decor('bucket', [2.5, 0, 69], { tipped: true, tint: 'red' });
  // the lifeguard tower: a ramp up its left half to the deck, the hut on its right half; a lilo beside the ramp
  // bounces you straight up onto the deck; off the deck's front edge the blowhole's spout throws you high
  const TX = 4.5, TZ = 82;
  b.rampZ(TX - 0.6, TZ - 8.6, 0, TZ - 1.6, 2.4, 1.6, 'wood', 'plankramp', 0.15);
  b.box([TX, 2.32, TZ], [2.4, 0.16, 3.2], { surf: 'wood', look: 'towerdeck' });
  b.box([TX + 0.65, 3.3, TZ + 0.3], [1.1, 1.8, 2.0], { surf: 'wood', look: null });
  b.decor('tower', [TX, 2.4, TZ], { w: 2.4, d: 3.2, hut: [0.65, 0.3, 1.1, 2.0] });
  b.puddle(TX - 0.6, 2.4, TZ - 0.6, 0.38, { look: 'bucket' });
  b.box([1.5, 0.11, 75.6], [0.95, 0.22, 2.0], { surf: 'bounce', look: 'lilo', tint: 'red' });
  b.dropArc([1.5, 0.22, 75.6], [TX - 0.7, 2.4, TZ - 0.4], 1.6, 3);
  b.updraft(TX - 0.6, 0, TZ + 2.7, 0.75, 4.2, 34, 'blowhole', { spread: 7, dir: [0, 1] });
  b.spray(TX - 0.6, 0, TZ + 2.7, 0.8, 60, 'spray-hidden', 4.4, { respawn: [TX - 0.6, 0.16, TZ + 4.6], bots: false });
  b.decor('rocks', [TX - 0.6, 0, TZ + 2.7], { r: 0.95, seed: 9, tall: true });
  b.scale(TX - 0.6, 4.25, TZ + 2.7);
  b.puddle(-1.2, 0, 90.5, 0.45, { look: 'bucket' });
  b.decor('bucket', [-0.7, 0, 91], { tipped: true, tint: 'blue' });
  b.decor('towel', [-2.6, 0, 79], { tint: 'red', yaw: 0.5 });
  b.decor('deckchair', [8.6, 0, 74], { yaw: -0.5, tint: 'lemon' });
  b.box([-8.4, 0.45, 86], [1.6, 0.9, 4.4], { surf: 'wood', look: 'rowboat', yaw: 0.3 });
  // gulls: two drop you back up the beach; the lucky one (gold, a gold ring) carries you 20 m on
  b.hazard({ kind: 'gull', id: 'gull1', period: 8.2, phase: 0.0, spin: 0, stations: [{ at: [1.4, 0, 54.6], drop: [-1.2, 0, 42] }, { at: [-2.4, 0, 77.5], drop: [0.5, 0, 62] }] });
  b.hazard({ kind: 'gull', id: 'gull2', period: 7.4, phase: 3.1, spin: 2, stations: [{ at: [1.6, 0, 87], drop: [1.5, 0, 70] }, { at: [-3.0, 0, 95.5], drop: [-1.0, 0, 80] }] });
  b.hazard({ kind: 'gull', id: 'lucky', lucky: true, period: 15, phase: 6.5, spin: 1, cruiseH: 6.5, stations: [{ at: [-9.6, 0, 76], drop: [-8.0, 0, 97] }] });
  b.decor('gullpost', [-10.8, 0, 75], {});

  // ---------------------------------------------------------------- C: the wet sand, the old groyne, the surf (z 98-150)
  b.decor('seaweed', [0, 0, 0], { seed: 5, z0: 100, z1: 142, x0: -12, x1: 12, n: 30 });
  b.puddle(1.5, 0, 104.5, 1.0, { look: 'pool' });
  b.decor('rocks', [1.5, 0, 104.5], { r: 1.0, seed: 4 });
  b.puddle(-2.5, 0, 119, 1.0, { look: 'pool' });
  b.decor('rocks', [-2.5, 0, 119], { r: 1.0, seed: 5 });
  b.puddle(3.5, 0, 133, 0.9, { look: 'pool' });
  b.decor('rocks', [3.5, 0, 133], { r: 0.9, seed: 6 });
  b.box([7, 0.4, 112], [1.5, 0.8, 4.2], { surf: 'wood', look: 'rowboat', yaw: -0.3 });
  b.cyl([5.2, 0, 122], 0.7, 0.72, { surf: 'sand', look: 'castle' });
  b.puddle(6.3, 0, 122.6, 0.5, { look: 'moat' });
  // the old groyne down the left: a narrow beam to balance along, drops all the way, a golden scale at its end
  b.box([-7.5, -0.18, 121.8], [0.45, 2.06, 41.6], { surf: 'wood', look: 'groyne' });
  b.drops([[-7.5, 0.85, 102.2], [-7.5, 0.85, 139.4]], 1.55, 0.28);
  b.scale(-7.5, 1.45, 144.6);
  b.hazard({ kind: 'crab', id: 'crab3', path: [[-4.2, 109.6], [1.8, 110.6]], stops: 3, period: 2.7, tele: 0.85, phase: 0.9, face: Math.PI });
  b.hazard({ kind: 'crab', id: 'crab4', path: [[0.6, 126.2], [6.4, 127.4]], stops: 3, period: 2.8, tele: 0.85, phase: 2.2, face: Math.PI });
  b.hazard({ kind: 'crab', id: 'crab5', path: [[-5.8, 133.4], [-2.6, 137.6]], stops: 3, period: 3.0, tele: 0.9, phase: 0.2, face: 2.2 });
  b.hazard({ kind: 'gull', id: 'gull3', period: 8.8, phase: 5.2, spin: 4, stations: [{ at: [0.5, 0, 115], drop: [-1.0, 0, 100] }, { at: [-3.5, 0, 128], drop: [0.0, 0, 112] }] });
  b.decor('flags', [0, 0, 143], { at: [[-4.5, 143], [4.5, 143]] });
  b.decor('surfboards', [9.5, 0, 138], {});
  // into the surf: the fish slips under the foam rather than through the sand
  b.finish([-40, -3, ZW - 2.5], [40, -0.12, 230], 'sea', 0.5);

  const spine = [
    [0, 1.72, -0.4], [0.8, 0, 4.5], [3.2, 0, 6.8], on(0.6, 9.8), on(-0.8, 15), on(0.4, 21.5), [2.6, 0, 25.4], on(0.2, 29), on(0, 34),
    on(1.2, 40), [3.6, 0, 44.2], [3, 0, 50.5], [0.4, 0, 59], [1, 0, 64], [2, 0, 68.5], [0, 0, 75], [0.4, 0, 82], [-1.2, 0, 90.5],
    [0, 0, 96], [1.5, 0, 104.5], [-1.2, 0, 112], [-2.5, 0, 119], [1, 0, 126], [3.5, 0, 133], [1, 0, 139], [0, 0, 142.5], [0, -0.35, 147],
    [0, -0.55, 149.5],
  ];
  const expert = [
    [0, 1.72, -0.4], [5.6, 0, 5], [8, 2.18, 10], [9.2, 2.18, 16.6], [8, 2.18, 23.2], [9.2, 2.18, 29.8], [8, 2.18, 36.4], [5.2, 0, 43],
    [3, 0, 50.5], [1.6, 0, 61], [TX - 0.6, 0, TZ - 8.8], [TX - 0.6, 2.4, TZ - 1.6], [TX - 0.6, 2.4, TZ + 0.6], [TX - 0.6, 0, TZ + 7.5],
    [1.5, 0, 100], [1.5, 0, 104.5], [-0.5, 0, 115], [1, 0, 126], [1.5, 0, 138], [0.5, -0.35, 147], [0.5, -0.55, 149.5],
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
    bounds: { minY: -10, min: [-20, -14], max: [20, 240] },
    sea: { y: -0.6, z0: ZW, x0: -60, x1: 80, lighthouse: [-34, 0, 250] },
    sky: 'noon',
    gentle: 30,
    surf: { z: ZW, x0: -60, x1: 60 },
  };
}
