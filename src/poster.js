// Store art: one staged frame per poster, drawn with the game's own renderer. Races are simulated with the real physics and
// bot brains from a fixed seed, then frozen at the chosen moment. No room, no HUD. Badges are drawn flat on a canvas.

import * as THREE from 'three';
import { createStage } from './render/scene.js';
import { buildCourseView } from './render/courseView.js';
import { createHazardViews } from './render/hazards.js';
import { createFx } from './render/fx.js';
import { createFishView } from './render/fish.js';
import { getCourse } from './sim/courses/index.js';
import { createHazards } from './sim/hazards.js';
import { createBody, stepBody, chargeOf, predictArc } from './sim/body.js';
import { createBrain, createWanderer } from './sim/bot.js';
import { STEP, WATER, SEAT_COLOURS } from './sim/config.js';
import { pointAt } from './sim/build.js';
import { NO_TWIST } from './sim/race.js';
import { loadFonts } from './fonts.js';

const CAST = [
  ['mackerel', 0, 'steady'], ['goldfish', 0, 'careful'], ['puffer', 0, 'hothead'], ['flatfish', 0, 'steady'],
  ['eel', 1, 'showoff'], ['mackerel', 1, 'hothead'], ['goldfish', 1, 'steady'], ['puffer', 1, 'wobbly'],
];

export async function runPoster(name, params) {
  const W = Number(params.get('w')) || innerWidth || 1280;
  const H = Number(params.get('h')) || innerHeight || 720;
  const canvas = document.getElementById('game');
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  document.getElementById('ui').replaceChildren();
  await loadFonts(4000);
  if (name.startsWith('badge-')) {
    drawBadge(canvas, name.slice(6), W, H);
    document.body.dataset.ready = '1';
    return;
  }
  const stage = createStage(canvas, { quality: 'high', poster: true });
  stage.resize(W, H, 1);
  let make = SCENES[name] ?? SCENES.cover;
  const m = /^test-c-([a-z]+)-(\d+)$/.exec(name);
  if (m) {
    params.set('c', m[1]);
    params.set('s', m[2]);
    make = SCENES['test-course'];
  }
  const mh = /^test-h-([a-z]+)-(\d+)-(\d+)$/.exec(name);
  if (mh) {
    params.set('c', mh[1]);
    params.set('i', mh[2]);
    params.set('t', String(Number(mh[3]) / 10));
    make = SCENES['test-hazard'];
  }
  const ms = /^test-s-(?:([a-z]+)-)?(\d+)-(\d+)$/.exec(name);
  if (ms) {
    params.set('c', ms[1] ?? 'market');
    params.set('t', String(Number(ms[2]) / 100));
    params.set('f', ms[3]);
    make = SCENES['test-start'];
  }
  await make(stage, W, H, params);
  stage.render();
  await new Promise((r) => requestAnimationFrame(r));
  stage.render();
  await new Promise((r) => requestAnimationFrame(r));
  document.body.dataset.ready = '1';
}

// ---------------------------------------------------------------- a race, simulated and frozen

/** Run `n` fish on a course for `t` seconds; returns the bodies and their views (settled over the last second). */
function stageRace(stage, courseId, t, opts = {}) {
  const course = getCourse(courseId);
  const view = buildCourseView(course);
  stage.scene.add(view.root);
  const hazards = createHazards(course, opts.seed ?? 3, {});
  const hv = createHazardViews(course, hazards);
  stage.scene.add(hv.root);
  const fx = createFx(stage.scene);
  const fish = [];
  const n = opts.n ?? 8;
  for (let i = 0; i < n; i++) {
    const [sp, cw, pers] = opts.cast?.[i] ?? CAST[i % CAST.length];
    const slot = opts.slots?.[i] ?? course.slots[i % course.slots.length];
    const b = createBody(sp, slot, course.start.yaw);
    const brain = opts.wander ? createWanderer(course.world, opts.wander, 5 + i * 3) : createBrain(course, { skill: opts.skill?.[i] ?? 0.55 + (i % 4) * 0.12, personality: pers, seed: 100 + i * 17 + (opts.seed ?? 0), yaw: course.start.yaw });
    const v = createFishView(sp, cw, { pin: SEAT_COLOURS[i].hex });
    stage.scene.add(v.group);
    fish.push({ b, brain, v, yaw: course.start.yaw, curl: 0 });
  }
  const env = { world: course.world, hazards, twist: NO_TWIST, t: 0 };
  let time = 0;
  const settleFrom = t - 1.2;
  let acc = 0;
  while (time < t) {
    time += STEP;
    env.t = time;
    for (const f of fish) {
      const inp = f.brain.step(f.b, STEP, time, hazards);
      f.yaw = inp.yaw;
      stepBody(f.b, inp, env);
      if (time > settleFrom) f.v.events(f.b.events);
      f.b.events.length = 0;
    }
    if (time > settleFrom) {
      acc += STEP;
      if (acc >= 1 / 60) {
        for (const f of fish) f.v.update(acc, stateOf(f));
        hv.update(time, acc, null);
        view.update(time);
        acc = 0;
      }
    }
  }
  for (const f of fish) f.v.update(1 / 60, stateOf(f));
  hv.update(time, 1 / 60, null);
  view.update(time);
  return { course, view, hazards, hv, fx, fish, time };
}

function stateOf(f) {
  const b = f.b;
  return { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, aim: f.yaw, curl: b.holding ? chargeOf(b.holdT, b.fish) : 0, ground: b.ground, wet: b.m / WATER.max, state: b.state };
}

/** Point the camera and the sun's shadows. */
function shoot(stage, pos, look, fov) {
  const cam = stage.camera;
  if (fov) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
  cam.position.set(...pos);
  cam.lookAt(new THREE.Vector3(...look));
  stage.focus(look[0], look[1], look[2]);
}

/** A fish posed by hand (for the close-ups): position, heading, curl, in the air or not. */
function posed(stage, sp, cw, s, steps = 40) {
  const v = createFishView(sp, cw, { pin: '#ffc93c', broadside: s.broadside ?? false });
  stage.scene.add(v.group);
  if (s.flop) v.events([{ type: 'flop', charge: 1 }]);
  for (let i = 0; i < steps; i++) v.update(1 / 60, { x: s.x, y: s.y, z: s.z, vx: s.vx ?? 0, vy: s.vy ?? 0, vz: s.vz ?? 0, aim: s.aim ?? 0, curl: s.curl ?? 0, ground: !!s.ground, wet: s.wet ?? 1, state: 'ok' });
  return v;
}

function wordmark(W, H, opts = {}) {
  const el = document.createElement('div');
  el.className = 'wordmark';
  el.style.cssText = `position:fixed;left:${opts.left ?? '50%'};top:${opts.top ?? '6%'};transform:translateX(-50%) rotate(-3deg);font-size:${opts.size ?? 118}px;z-index:5;margin:0`;
  el.innerHTML = '<span class="row">FISH</span><span class="row"><span class="small">OUT OF</span></span><span class="row">WATER</span>';
  document.getElementById('ui').append(el);
}

const SCENES = {
  // The race's first leaps off the fishmonger's ice, the street and the harbour beyond.
  async cover(stage, W, H) {
    const r = stageRace(stage, 'market', 2.05, { seed: 4 });
    const lead = r.fish.reduce((a, f) => (f.b.y > a.b.y ? f : a), r.fish[0]);
    shoot(stage, [lead.b.x - 2.6, 2.1, lead.b.z - 4.2], [lead.b.x + 0.6, 0.9, lead.b.z + 5], 52);
    for (const f of r.fish) if (!f.b.ground) r.fx.burst(f.b.x, f.b.y - 0.05, f.b.z, 6, 'splash', 0.5);
    for (let i = 0; i < 6; i++) r.fx.update(1 / 60);
    wordmark(W, H, { size: Math.round(H * 0.15), top: '5%', left: '29%' });
  },
  // A dramatic close-up: one fish at the top of a full flop over the market tiles.
  async action(stage) {
    const r = stageRace(stage, 'market', 12.5, { seed: 9, n: 6 });
    posed(stage, 'mackerel', 0, { x: 0.4, y: 1.45, z: 42.5, vx: 0.4, vy: 0.6, vz: 4.8, aim: 0.1, flop: true }, 14);
    r.fx.burst(0.4, 1.3, 42.3, 26, 'splash', 0.9);
    for (let i = 0; i < 5; i++) r.fx.update(1 / 60);
    shoot(stage, [-0.9, 1.1, 41.0], [0.5, 1.45, 42.7], 46);
  },
  // The splash home: off the end of the quay into the harbour.
  async win(stage) {
    const r = stageRace(stage, 'market', 0.1, { n: 0 });
    posed(stage, 'goldfish', 0, { x: 6.4, y: 0.25, z: 189.4, vx: 0, vy: -5, vz: 2.5, aim: 0, flop: true }, 10);
    r.fx.burst(6.4, -0.55, 189.6, 60, 'splash', 2.2);
    for (let i = 0; i < 10; i++) r.fx.update(1 / 60);
    r.fx.burst(6.4, -0.55, 189.6, 40, 'splash', 1.6);
    for (let i = 0; i < 3; i++) r.fx.update(1 / 60);
    shoot(stage, [3.2, 2.0, 183.2], [6.8, 0.2, 191], 54);
  },
  // Eight fish at once in the market crowd.
  async multi(stage) {
    const r = stageRace(stage, 'market', 9.0, { seed: 6 });
    const cx = r.fish.reduce((a, f) => a + f.b.x, 0) / r.fish.length;
    const cz = r.fish.reduce((a, f) => a + f.b.z, 0) / r.fish.length;
    shoot(stage, [cx + 3.2, 3.4, cz - 6.5], [cx - 0.4, 0.4, cz + 2.5], 54);
  },
  // One bold fish, mid-flop, against the harbour.
  async icon(stage) {
    stageRace(stage, 'quay', 0.1, { n: 0 });
    posed(stage, 'mackerel', 0, { x: 0, y: 1.6, z: 4, vx: 0.01, vy: 0.4, vz: 3, aim: Math.PI / 2, flop: true }, 12);
    shoot(stage, [0.05, 1.68, 2.85], [0, 1.6, 4], 42);
  },

  // ------------------------------------------------------------ checks (never part of the store art)
  async 'test-quay'(stage) {
    const r = stageRace(stage, 'quay', 3, { n: 5, wander: [-7, -4.5, 7.5, 5.5] });
    chase(stage, r.fish[0], 0);
  },
  async 'test-start'(stage, W, H, params) {
    const r = stageRace(stage, params.get('c') ?? 'market', Number(params.get('t') ?? 0.6), { seed: 2 });
    const f = r.fish[Number(params.get('f') ?? 0)];
    chase(stage, f, f.yaw);
    if (f.b.holding) {
      const pts = [];
      const land = predictArc(f.b, r.course.world, f.yaw, chargeOf(f.b.holdT, f.b.fish), NO_TWIST, { points: pts, every: 3 });
      r.fx.arc(pts, land, 0);
    }
  },
  async 'test-hazard'(stage, W, H, params) {
    const r = stageRace(stage, params.get('c') ?? 'kitchen', Number(params.get('t') ?? 4), { n: 0 });
    const i = Number(params.get('i') ?? 0);
    const h = r.hazards.list[i];
    const st = r.hazards.at(r.time)[i];
    const x = st.x ?? h.at?.[0] ?? 0, z = st.z ?? h.at?.[2] ?? 0;
    shoot(stage, [x + 2.5, 2.6, z - 7.5], [x, 1.6, z], 60);
  },
  async 'test-course'(stage, W, H, params) {
    const s = Number(params.get('s') ?? 40);
    const r = stageRace(stage, params.get('c') ?? 'market', 4 + s / 4, { n: 0 });
    const p = pointAt(r.course.spine, r.course.lens, s);
    const q = pointAt(r.course.spine, r.course.lens, s + 10);
    shoot(stage, [p[0] - (q[0] - p[0]) * 0.4, p[1] + 3.2, p[2] - (q[2] - p[2]) * 0.4], [q[0], q[1], q[2]], 60);
  },
};

function chase(stage, f, yaw) {
  // the game's chase camera at rest (camera.js with CHASE in main.js)
  const c = f.b.holding ? chargeOf(f.b.holdT, f.b.fish) : 0;
  const dist = 2.6 + c * 0.7, up = 1.45 + c * 0.55, ahead = 1 + c * 1.9;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  shoot(stage, [f.b.x - dx * dist, f.b.y + up, f.b.z - dz * dist], [f.b.x + dx * ahead, f.b.y + 0.15 + c * 0.1, f.b.z + dz * ahead]);
}

// ---------------------------------------------------------------- badges: a bold symbol on a coloured disc

const BADGES = {
  'first-flop': { bg: '#ffc93c', draw: (g) => fishGlyph(g, '#1a1d22', 0.0, true) },
  splash: { bg: '#0b5cad', draw: (g) => splashGlyph(g) },
  'gold-fin': { bg: '#e4432d', draw: (g) => medalGlyph(g, '#e8b931') },
  'bone-dry': { bg: '#cb6b3f', draw: (g) => boneGlyph(g) },
  'gull-bait': { bg: '#4cd3ec', draw: (g) => gullGlyph(g) },
  'ice-skater': { bg: '#9fd2ee', draw: (g) => iceGlyph(g) },
  'slap-happy': { bg: '#ffc93c', draw: (g) => slapGlyph(g) },
  'whole-catch': { bg: '#1a1d22', draw: (g) => netGlyph(g) },
  'golden-catch': { bg: '#e8b931', draw: (g) => fishGlyph(g, '#1a1d22', 0, false, '#fff3c4') },
  'cup-champion': { bg: '#e4432d', draw: (g) => cupGlyph(g) },
};

function drawBadge(canvas, id, W, H) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const def = BADGES[id] ?? BADGES.splash;
  g.clearRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(W / 256, H / 256);
  g.fillStyle = 'rgba(26,29,34,0.35)';
  g.beginPath();
  g.arc(0, 6, 118, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1a1d22';
  g.beginPath();
  g.arc(0, 0, 118, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = def.bg;
  g.beginPath();
  g.arc(0, 0, 106, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = '#1a1d22';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  def.draw(g);
  g.restore();
}

function fishGlyph(g, ink, rot, curled, fill = '#f4efe6') {
  g.save();
  g.rotate(rot - (curled ? 0.25 : 0));
  g.fillStyle = fill;
  g.beginPath();
  if (curled) {
    g.moveTo(-62, 10);
    g.quadraticCurveTo(-10, -60, 46, -8);
    g.lineTo(78, -40);
    g.quadraticCurveTo(70, 0, 80, 34);
    g.lineTo(46, 8);
    g.quadraticCurveTo(-10, 40, -62, 10);
  } else {
    g.moveTo(-70, 0);
    g.quadraticCurveTo(-10, -52, 44, -6);
    g.lineTo(80, -36);
    g.quadraticCurveTo(70, 0, 80, 36);
    g.lineTo(44, 6);
    g.quadraticCurveTo(-10, 52, -70, 0);
  }
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = ink;
  g.beginPath();
  g.arc(-38, curled ? -8 : -6, 7, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function splashGlyph(g) {
  g.fillStyle = '#f4efe6';
  g.beginPath();
  g.moveTo(-70, 40);
  g.quadraticCurveTo(-60, -10, -30, -20);
  g.quadraticCurveTo(-30, 20, -10, 30);
  g.quadraticCurveTo(-8, -50, 10, -70);
  g.quadraticCurveTo(20, -20, 14, 30);
  g.quadraticCurveTo(36, 10, 40, -24);
  g.quadraticCurveTo(66, 0, 70, 40);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#4cd3ec';
  g.fillRect(-84, 40, 168, 26);
  g.strokeRect(-84, 40, 168, 26);
}

function medalGlyph(g, c) {
  g.fillStyle = '#4cd3ec';
  g.beginPath();
  g.moveTo(-40, -86);
  g.lineTo(-6, -20);
  g.lineTo(6, -20);
  g.lineTo(40, -86);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = c;
  g.beginPath();
  g.arc(0, 18, 52, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.save();
  g.translate(0, 18);
  g.scale(0.42, 0.42);
  fishGlyph(g, '#1a1d22', 0, false, '#fff3c4');
  g.restore();
}

function boneGlyph(g) {
  g.fillStyle = '#f4efe6';
  g.beginPath();
  g.moveTo(-50, 0);
  g.lineTo(46, 0);
  g.stroke();
  for (let i = 0; i < 5; i++) {
    const x = -24 + i * 16;
    g.beginPath();
    g.moveTo(x, -30 + i * 3);
    g.quadraticCurveTo(x + 8, 0, x, 30 - i * 3);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(-82, 0);
  g.quadraticCurveTo(-64, -34, -46, -4);
  g.quadraticCurveTo(-64, 34, -82, 0);
  g.closePath();
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(46, 0);
  g.lineTo(82, -30);
  g.lineTo(76, 0);
  g.lineTo(82, 30);
  g.closePath();
  g.fill();
  g.stroke();
}

function gullGlyph(g) {
  g.fillStyle = '#f4efe6';
  g.beginPath();
  g.moveTo(-86, -10);
  g.quadraticCurveTo(-44, -54, 0, -6);
  g.quadraticCurveTo(44, -54, 86, -10);
  g.quadraticCurveTo(40, -24, 0, 18);
  g.quadraticCurveTo(-40, -24, -86, -10);
  g.closePath();
  g.fill();
  g.stroke();
  g.save();
  g.translate(0, 52);
  g.scale(0.38, 0.38);
  g.rotate(Math.PI / 2);
  fishGlyph(g, '#1a1d22', 0, true);
  g.restore();
}

function iceGlyph(g) {
  g.fillStyle = '#f4efe6';
  for (const [x, y, s] of [[-30, -20, 46], [22, 6, 52], [-14, 40, 36]]) {
    g.save();
    g.translate(x, y);
    g.rotate(0.3);
    g.fillRect(-s / 2, -s / 2, s, s);
    g.strokeRect(-s / 2, -s / 2, s, s);
    g.restore();
  }
  g.beginPath();
  g.moveTo(-80, 76);
  g.lineTo(80, 60);
  g.stroke();
}

function slapGlyph(g) {
  g.save();
  g.translate(0, 10);
  fishGlyph(g, '#1a1d22', -0.5, true);
  g.restore();
  for (const [a, l] of [[-2.4, 30], [-2.0, 40], [-1.6, 30]]) {
    g.beginPath();
    g.moveTo(Math.cos(a) * 70, Math.sin(a) * 70 + 10);
    g.lineTo(Math.cos(a) * (70 + l), Math.sin(a) * (70 + l) + 10);
    g.stroke();
  }
  g.fillStyle = '#4cd3ec';
  g.fillRect(-80, 66, 160, 18);
  g.strokeRect(-80, 66, 160, 18);
}

function netGlyph(g) {
  g.strokeStyle = '#f4efe6';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(0, -10, 72, 0, Math.PI);
  g.stroke();
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.moveTo(i * 20, -10);
    g.quadraticCurveTo(i * 12, 40, 0, 62);
    g.stroke();
  }
  for (let k = 1; k <= 3; k++) {
    g.beginPath();
    g.ellipse(0, -10 + k * 16, 72 - k * 18, 8, 0, 0, Math.PI);
    g.stroke();
  }
  g.strokeStyle = '#ffc93c';
  g.beginPath();
  g.moveTo(-72, -10);
  g.lineTo(72, -10);
  g.stroke();
}

function cupGlyph(g) {
  g.fillStyle = '#ffc93c';
  g.beginPath();
  g.moveTo(-54, -70);
  g.lineTo(54, -70);
  g.quadraticCurveTo(54, 10, 0, 22);
  g.quadraticCurveTo(-54, 10, -54, -70);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillRect(-10, 22, 20, 30);
  g.strokeRect(-10, 22, 20, 30);
  g.fillRect(-40, 52, 80, 20);
  g.strokeRect(-40, 52, 80, 20);
  g.beginPath();
  g.arc(-58, -40, 20, Math.PI / 2, (Math.PI * 3) / 2);
  g.stroke();
  g.beginPath();
  g.arc(58, -40, 20, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.save();
  g.translate(0, -36);
  g.scale(0.36, 0.36);
  fishGlyph(g, '#1a1d22', 0, false);
  g.restore();
}
