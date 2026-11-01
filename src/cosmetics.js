// Everything a fish can wear, earned by playing (never bought): hats, trails behind a flight and the splash at the finish.
// Pure data, read by the page and the node tests. `level`: the Catch level that gives it; `goal`: a feat instead.

export const HATS = {
  none: { name: 'No hat' },
  bucket: { name: 'Bucket hat', level: 2 },
  beanie: { name: 'Watch cap', level: 4 },
  sailor: { name: 'Sailor cap', level: 6 },
  lemon: { name: 'Lemon wedge', level: 8 },
  straw: { name: 'Straw hat', level: 11 },
  party: { name: 'Party hat', level: 14 },
  captain: { name: "Captain's cap", level: 17 },
  propeller: { name: 'Propeller cap', level: 20 },
  tophat: { name: 'Top hat', level: 24 },
  viking: { name: 'Horned helmet', level: 28 },
  chef: { name: "Chef's toque", goal: 'gold-kitchen' },
  pirate: { name: 'Tricorn', goal: 'scales-all' },
  crown: { name: 'Crown', goal: 'gold-all' },
};

export const TRAILS = {
  drips: { name: 'Drips' },
  bubbles: { name: 'Bubbles', level: 3 },
  sparkle: { name: 'Sparkle', level: 7 },
  confetti: { name: 'Confetti', level: 12 },
  ink: { name: 'Squid ink', level: 18 },
  rainbow: { name: 'Rainbow', level: 25 },
  gold: { name: 'Gold leaf', goal: 'flow-max' },
};

export const SPLASHES = {
  plain: { name: 'Splash' },
  crown: { name: 'Water crown', level: 5 },
  fireworks: { name: 'Fireworks', level: 13 },
  geyser: { name: 'Geyser', level: 22 },
  whale: { name: 'Whale spout', goal: 'streak-7' },
};

/** Colourways past the first: level per index (index 0 is always yours). */
export const COLOURWAY_LEVELS = [0, 5, 10, 16, 21];
export const COLOURWAY_COUNT = COLOURWAY_LEVELS.length;

/** Feats that give a cosmetic (checked by progress.js). */
export const GOALS = {
  'gold-kitchen': 'Gold in the Kitchen',
  'scales-all': 'Every golden scale',
  'gold-all': 'Gold on every course',
  'flow-max': 'Reach Flow ×4',
  'streak-7': 'A seven-day streak',
};

export const SLOTS = { hat: HATS, trail: TRAILS, splash: SPLASHES };
export const DEFAULTS = { hat: 'none', trail: 'drips', splash: 'plain' };
