// Every number the game is tuned with, in one place. Pure data: node tests and the page read the same values.

export const STEP = 1 / 120; // fixed simulation step (s)
export const GRAVITY = 16; // m/s²

export const BODY_RADIUS = 0.16; // the gameplay sphere at the fish's middle

export const FLOP = {
  minHold: 0.15, // a tap is a hop
  fullHold: 1.1, // a full leap
  vyMin: 3.2,
  vyMax: 8.9,
  vhMin: 2.0,
  vhMax: 5.4,
  carry: 0.2, // share of the along-aim ground speed a flop keeps
  coyote: 0.1, // a flop still works this long after contact
  wallLift: 1.15, // a flop off a wall goes this much higher
};

export const SLAP = {
  before: 0.1, // a release this long before touchdown is a slap
  after: 0.12, // ... or this long after it
  minAir: 0.25, // only after a real flight
  power: 1.08,
  carry: 0.35, // share of the incoming speed a slap keeps
};

export const STUN = 0.3; // no flop after a knock
export const RESTING = 1.0; // impacts slower than this don't bounce (m/s)
export const GROUND_NY = 0.55; // contact normals steeper than this are ground

export const WATER = {
  max: 100,
  base: 2.8, // drain per second (36 s from full)
  shade: 0.6,
  low: 35, // the gauge turns red
  gasp: 15, // gasps, faster music
  dryTime: 1.0, // the gasp before the splash back
};

// friction (m/s² of sliding deceleration), keep (share of horizontal speed kept on landing), rest (restitution),
// drain (× base drain), minUp (bouncy surfaces throw you at least this fast), sound (landing sound).
export const SURFACES = {
  tile: { friction: 6, keep: 0.45, rest: 0.22, drain: 1.0, sound: 'slap' },
  wet: { friction: 2.5, keep: 0.6, rest: 0.25, drain: 0.8, sound: 'wet' },
  stone: { friction: 6, keep: 0.45, rest: 0.2, drain: 1.2, sound: 'slap' },
  wood: { friction: 7, keep: 0.4, rest: 0.3, drain: 1.0, sound: 'thud' },
  steel: { friction: 3, keep: 0.6, rest: 0.2, drain: 0.9, sound: 'plink' },
  ice: { friction: 0.6, keep: 0.9, rest: 0.15, drain: -2, sound: 'ice' },
  sand: { friction: 14, keep: 0.15, rest: 0.03, drain: 2.5, sound: 'sand' },
  wetsand: { friction: 9, keep: 0.25, rest: 0.05, drain: 0.4, sound: 'sand' },
  gravel: { friction: 10, keep: 0.25, rest: 0.1, drain: 1.5, sound: 'gravel' },
  grass: { friction: 9, keep: 0.3, rest: 0.3, drain: 0.9, sound: 'grass' },
  hot: { friction: 5, keep: 0.5, rest: 0.35, drain: 5.0, sound: 'sizzle' },
  plush: { friction: 12, keep: 0.2, rest: 0.6, drain: 1.1, sound: 'plush' },
  bounce: { friction: 4, keep: 0.7, rest: 0.85, drain: 1.0, minUp: 6.5, sound: 'boing' },
  net: { friction: 30, keep: 0, rest: 0, drain: 1.0, sticky: 0.6, sound: 'net' },
  water: { friction: 2.0, keep: 0.6, rest: 0.1, drain: 0, sound: 'splash' },
  rail: { friction: 0.25, keep: 0.92, rest: 0.05, drain: 1.0, sound: 'plink' },
  wall: { friction: 6, keep: 0.45, rest: 0.25, drain: 1.0, sound: 'thud' },
};

// The five fish: a look and a small physical character each (kept within a few percent of each other).
export const FISH = [
  { id: 'mackerel', name: 'Mackerel', gravity: 1, range: 1, height: 1, friction: 1, rest: 0, charge: 1, nodes: 5 },
  { id: 'goldfish', name: 'Goldfish', gravity: 0.9, range: 0.95, height: 1, friction: 1, rest: -0.05, charge: 1, nodes: 5 },
  { id: 'flatfish', name: 'Flatfish', gravity: 1, range: 1.04, height: 0.92, friction: 0.6, rest: 0, charge: 1, nodes: 5 },
  { id: 'puffer', name: 'Pufferfish', gravity: 1, range: 0.95, height: 1, friction: 1, rest: 0.3, charge: 1, nodes: 5 },
  { id: 'eel', name: 'Eel', gravity: 1, range: 0.92, height: 1, friction: 1, rest: 0, charge: 0.85, nodes: 6 },
];
export const fishById = (id) => FISH.find((f) => f.id === id) ?? FISH[0];

// What unlocks each fish (medals: one per tier earned on a course, 18 in all).
export const UNLOCKS = {
  mackerel: { medals: 0, golds: 0, course: null },
  goldfish: { medals: 0, golds: 0, course: 'market' },
  flatfish: { medals: 5, golds: 0, course: null },
  puffer: { medals: 9, golds: 0, course: null },
  eel: { medals: 0, golds: 3, course: null },
};

export const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
export const RACE = {
  seats: 8,
  introSeconds: 4.5,
  capSeconds: 240,
  lastCall: 60,
  roundEndSeconds: 7,
  resultsSeconds: 15,
};

export const TWISTS = {
  windy: { name: 'Windy', wind: 1.5 },
  slippery: { name: 'Slippery', friction: 0.4 },
  heatwave: { name: 'Heatwave', drain: 1.5 },
};

// Seat colours, each with a shape for pins and bobbers (colour-blind players).
export const SEAT_COLOURS = [
  { hex: '#ffc93c', shape: 'circle' },
  { hex: '#e4432d', shape: 'square' },
  { hex: '#4cd3ec', shape: 'triangle' },
  { hex: '#7bd389', shape: 'diamond' },
  { hex: '#f28ac0', shape: 'star' },
  { hex: '#ff8a3d', shape: 'hexagon' },
  { hex: '#a99cff', shape: 'cross' },
  { hex: '#f4efe6', shape: 'ring' },
];

export const PALETTE = {
  sea: '#0b5cad',
  wash: '#f4efe6',
  slate: '#1a1d22',
  red: '#e4432d',
  lemon: '#ffc93c',
  terracotta: '#cb6b3f',
  spray: '#4cd3ec',
};
