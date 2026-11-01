// Every course, built on demand, with what the race needs around it: the world to collide with, the spine to measure
// progress along, the start places.

import { createWorld } from '../world.js';
import { polyLengths, project } from '../build.js';
import { quay } from './quay.js';
import { market } from './market.js';
import { kitchen } from './kitchen.js';
import { beach } from './beach.js';
import { park } from './park.js';

const MAKERS = { quay, market, kitchen, beach, park };
/** The race courses, in unlock order. */
export const COURSE_IDS = ['market', 'kitchen', 'beach', 'park'];
export const COURSE_NAMES = { quay: 'The Quay', market: 'The Fish Market', kitchen: 'The Kitchen', beach: 'The Beach', park: 'The Park' };

const cache = new Map();

export function getCourse(id) {
  if (cache.has(id)) return cache.get(id);
  const make = MAKERS[id] ?? MAKERS.market;
  const c = make();
  c.lens = polyLengths(c.spine);
  c.length = c.lens[c.lens.length - 1];
  if (c.expert) c.expertLens = polyLengths(c.expert);
  c.world = createWorld({ colliders: c.builder.colliders, zones: c.builder.zones, bounds: c.bounds, casters: c.builder.casters, items: c.builder.items, sun: !c.indoor });
  c.drops = c.builder.items.filter((it) => it.kind === 'drop').length;
  c.scales = c.builder.items.filter((it) => it.kind === 'scale');
  c.refills = c.builder.zones.filter((z) => z.rate);
  /** Metres along the spine for a position (with a hint for speed). */
  c.progress = (x, z, hint) => project(c.spine, c.lens, x, z, hint);
  cache.set(id, c);
  return c;
}
