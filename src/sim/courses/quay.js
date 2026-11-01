// The Quay: the title, the lobby and the podium. A small stretch of harbour with a fishmonger's stall, a puddle, crates, a
// bouncy awning and the sea right there (flop in and you pop back out).

import { courseBuilder } from '../build.js';

export function quay() {
  const b = courseBuilder('quay');
  b.slab(-11, -9, 11, 7, 0, 'stone', 'quay', 2);
  b.wall(-11, -9, -11, 9);
  b.wall(11, -9, 11, 9);
  b.wall(-11, -8.6, 11, -8.6);
  b.houses(-11, -9, 7, -1, { seed: 21 });
  b.houses(11, -9, 7, 1, { seed: 23 });
  b.decor('backwall', [0, 0, -8.7], { w: 22 });

  // the fishmonger's stall at the back
  b.box([-3.5, 0.45, -5.6], [5.0, 0.9, 1.6], { surf: 'wood', look: 'counter', tint: 'blue' });
  b.box([-3.5, 0.95, -5.6], [4.8, 0.1, 1.4], { surf: 'ice', look: 'ice' });
  b.decor('pricetags', [-3.5, 1.0, -5.6], { w: 4.6, d: 1.2, n: 6, seed: 4 });
  b.decor('stallgoods', [-3.5, 1.0, -5.6], { len: 4.6, depth: 1.2, side: 0, seed: 9, alongX: true });
  b.decor('awning', [-3.5, 2.9, -5.2], { w: 5.8, d: 2.6, tint: 'red', slope: 0.25, axis: 'z' });

  // a bouncy awning over a crate step on the right
  b.crate(5.6, 0, -4.2, { size: [1.4, 0.9, 1.3], look: 'cratestack' });
  const aw = b.box([5.6, 2.1, -1.6], [2.6, 0.08, 2.4], { surf: 'bounce', look: 'awning', tint: 'blue' });
  aw.slope = 0;
  b.decor('awningposts', [5.6, 2.1, -1.6], { len: 2.4, aw: 2.6, side: 1 });

  // crates, lemons, an ice crate, a barrel, a puddle
  b.crate(-6.8, 0, -1.5, { yaw: 0.4, look: 'lemoncrate' });
  b.crate(-7.2, 0, 0.2, { yaw: -0.2 });
  b.crate(-7.15, 0.45, 0.25, { yaw: 0.1 });
  b.iceCrate(2.2, 0, -5.8, { size: [1.8, 0.42, 1.2] });
  b.barrel(8.4, 0, 2.6);
  b.puddle(0.6, 0, -1.2, 1.1);
  b.decor('mopbucket', [1.8, 0, -1.8], {});
  b.bollard(-8.5, 0, 6.0);
  b.bollard(-2.0, 0, 6.2);
  b.bollard(4.5, 0, 6.2);
  b.bollard(9.0, 0, 6.0);
  b.decor('quayedge', [0, 0, 7], { x0: -11, x1: 11 });
  // a trawler tied up alongside: land on its deck or the wheelhouse roof, then off into the sea
  b.box([-5.2, -0.12, 8.55], [5.4, 0.24, 1.9], { surf: 'wood', look: null });
  b.box([-5.55, 0.7, 8.55], [1.7, 1.4, 1.5], { surf: 'wood', look: null });
  b.decor('rope', [0, 0, 0], { a: [-8.5, 0.5, 6.0], b: [-8.3, 0.25, 7.75] });
  b.decor('rope', [0, 0, 0], { a: [-2.0, 0.5, 6.2], b: [-2.4, 0.45, 8.05] });
  b.decor('podium', [0, 0, 2.6], {});
  b.decor('bunting', [0, 0, 5.5], { x0: -11, x1: 11, h: 4.8 });

  // the sea: a splash, then you're back on the quay
  b.finish([-40, -8, 7.2], [40, -0.1, 80], 'sea', 1.6, -0.7);

  return {
    id: 'quay',
    name: 'The Quay',
    builder: b,
    spine: [[0, 0, -6], [0, 0, 7.5]],
    expert: null,
    start: { x: 0.6, y: 0.17, z: -2.2, yaw: 0 },
    slots: [[0.6, 0.17, -2.2], [-1.8, 0.17, -3.4], [2.8, 0.17, -3.0], [-0.8, 0.17, 1.4], [3.4, 0.17, 0.6], [-4.4, 0.17, -1.2], [-3.0, 0.17, 2.4], [5.6, 0.17, 2.2]],
    bounds: { minY: -10, min: [-14, -12], max: [14, 82] },
    sea: {
      y: -0.7, z0: 7.2, x0: -80, x1: 80, lighthouse: [14, 0, 70],
      moored: [{ x: -5.2, z: 8.55, yaw: 0, kind: 'trawler', i: 0, lift: 0.1 }],
      perched: [[-8.5, 0.55, 6.0, 2.2], [4.5, 0.55, 6.2, -0.6], [9.0, 0.55, 6.0, 1.1]],
    },
    sky: 'noon',
    podium: [[0, 1.4, 2.6], [-1.5, 1.0, 2.6], [1.5, 0.7, 2.6]],
  };
}
