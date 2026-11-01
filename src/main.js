// Fish Out of Water: the page. Joins the room once, then runs one loop over five modes: the title, the Quay (the lobby,
// playable), a cup (intro, race, race end, the podium), a time trial (or the daily catch) and the closed-room card.

import '@fontsource/alfa-slab-one/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/800.css';
import './ui/style.css';
import * as THREE from 'three';
import { createStage } from './render/scene.js';
import { createChaseCam } from './render/camera.js';
import { createFx } from './render/fx.js';
import { buildCourseView } from './render/courseView.js';
import { createHazardViews } from './render/hazards.js';
import { M } from './render/materials.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createProgress, award, submitTime, ghostAt } from './progress.js';
import { joinRoom, createCup, readPresence, BOT_STYLE } from './net.js';
import { getCourse, COURSE_IDS } from './sim/courses/index.js';
import { createHazards } from './sim/hazards.js';
import { createBrain, createWanderer } from './sim/bot.js';
import { predictArc, chargeOf, canFlop, respawn } from './sim/body.js';
import { pointAt } from './sim/build.js';
import { box as boxCollider } from './sim/world.js';
import { FISH, SEAT_COLOURS, WATER, RACE } from './sim/config.js';
import { CUPS, cupCourses, nextMedal, fmtTime, dailyCatch, NO_TWIST, ordinal } from './sim/race.js';
import { runBot } from './sim/run.js';
import { createActor, giveBody, simulate, syncFromBody, syncFromSample, stateCode, eventFx, remoteEvents, FISH_IDS, COLOURWAYS } from './actors.js';
import { hashString } from './sim/rng.js';
import { loadFonts } from './fonts.js';

const ow = typeof window !== 'undefined' ? window.onceworlds ?? null : null;
const params = new URLSearchParams(location.search);
const PROD = /(^|\.)onceworlds(usercontent)?\.com$/.test(location.hostname);
const AUTOPLAY = !PROD && params.has('autoplay') && params.get('autoplay') !== '0';
const AUTOPLAY_TO = params.get('autoplay-to');
const POSTER = params.get('poster');
const NO_HUD = params.get('hud') === '0';

if (POSTER) {
  import('./poster.js').then((m) => m.runPoster(POSTER, params)).catch((err) => {
    document.body.dataset.error = String(err?.stack ?? err);
    document.body.dataset.ready = 'error';
  });
} else {
  boot().catch((err) => {
    console.error(err);
    setTimeout(() => {
      throw err;
    });
  });
}

function setFlow(name) {
  if (document.body.dataset.flow !== name) document.body.dataset.flow = name;
}

async function boot() {
  const canvas = document.getElementById('game');
  const uiRoot = document.getElementById('ui');
  const settings = ow?.settings ?? null;
  const pr = () => {
    try {
      return settings?.pixelRatio?.(2) ?? Math.min(2, devicePixelRatio || 1);
    } catch {
      return Math.min(2, devicePixelRatio || 1);
    }
  };
  const stage = createStage(canvas, { quality: settings?.quality ?? 'high' });
  const { scene, camera } = stage;
  const cam = createChaseCam(camera);
  const fx = createFx(scene);
  const input = createInput(canvas, { ownFlopZone: true });
  const audio = createAudio();
  const hud = createHud(uiRoot);
  const screens = createScreens(uiRoot);
  const progress = createProgress();
  if (NO_HUD) uiRoot.style.display = 'none';

  const applySettings = () => {
    const q = settings?.quality ?? 'high';
    stage.setQuality(q, pr());
    fx.lowQuality = q === 'low';
    const reduced = !!settings?.reducedMotion;
    cam.reduced = reduced;
    fx.reduced = reduced;
    document.body.classList.toggle('reduced', reduced);
    resize();
  };
  const resize = () => {
    stage.resize(innerWidth, innerHeight, pr());
    layout();
  };
  function layout() {
    let areas = [];
    try {
      areas = (ow && ow.ui && ow.ui.reserved) || [];
    } catch {}
    let top = 12, bottom = 12, left = 12, right = 12, menuBottom = 12;
    for (const a of areas ?? []) {
      if (a.kind === 'menu' && a.y < 40) {
        if (a.x < innerWidth / 2) menuBottom = Math.max(menuBottom, a.y + a.h + 8);
        else right = Math.max(right, innerWidth - a.x + 8);
      }
      if (a.kind === 'lobby' && a.y > innerHeight / 2) bottom = Math.max(bottom, innerHeight - a.y + 10);
      if (a.kind === 'buttons' && a.y > innerHeight / 2 && a.x < innerWidth / 2 + 100) bottom = Math.max(bottom, innerHeight - a.y + 10);
    }
    const st = document.documentElement.style;
    st.setProperty('--top', `${top}px`);
    st.setProperty('--bottom', `${bottom}px`);
    st.setProperty('--left', `${left}px`);
    st.setProperty('--right', `${right}px`);
    st.setProperty('--menu-h', `${menuBottom}px`);
    uiRoot.querySelectorAll('.quay-left').forEach((e) => (e.style.top = `${menuBottom + 6}px`));
  }
  addEventListener('resize', resize);
  try {
    settings?.on?.('change', applySettings);
    ow?.on?.('reserved', layout);
    ow?.ui?.setLook?.({ accent: '#ffc93c', panel: '#1a1d22', text: '#f4efe6' });
  } catch {}
  applySettings();

  // ---------------------------------------------------------------- courses and their views
  const views = new Map();
  let shownView = null;
  function showCourse(id) {
    const course = getCourse(id);
    let v = views.get(id);
    if (!v) {
      v = buildCourseView(course, camera);
      views.set(id, v);
      scene.add(v.root);
    }
    if (shownView && shownView !== v) shownView.root.visible = false;
    v.root.visible = true;
    shownView = v;
    return { course, view: v };
  }

  // the podium: three crate stacks on the quay, shown for the cup results
  const podium = new THREE.Group();
  const quayDef = getCourse('quay');
  for (let i = 0; i < 3; i++) {
    const p = quayDef.podium[i];
    const h = p[1] - 0.15;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, h, 1.1), [M.crate, M.crate, M.lemonPaint ?? M.crate, M.crate, M.crate, M.crate]);
    mesh.position.set(p[0], h / 2, p[2]);
    mesh.castShadow = mesh.receiveShadow = true;
    podium.add(mesh);
  }
  podium.visible = false;
  scene.add(podium);
  // its crates are solid only while it's shown
  const podiumCols = quayDef.podium.map((p) => boxCollider([p[0], (p[1] - 0.15) / 2, p[2]], [0.65, (p[1] - 0.15) / 2, 0.55], { surf: 'wood' }));
  function showPodium(on) {
    podium.visible = on;
    const dyn = quayDef.world.dynamic;
    for (const c of podiumCols) {
      const i = dyn.indexOf(c);
      if (on && i < 0) dyn.push(c);
      else if (!on && i >= 0) dyn.splice(i, 1);
    }
  }

  // the "this way" chevron
  const chevShape = new THREE.Shape();
  chevShape.moveTo(0, 0.45);
  chevShape.lineTo(0.38, -0.05);
  chevShape.lineTo(0.18, -0.05);
  chevShape.lineTo(0, 0.2);
  chevShape.lineTo(-0.18, -0.05);
  chevShape.lineTo(-0.38, -0.05);
  chevShape.closePath();
  const chevron = new THREE.Mesh(new THREE.ShapeGeometry(chevShape).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0, depthWrite: false }));
  chevron.renderOrder = 5;
  scene.add(chevron);

  // ---------------------------------------------------------------- state
  const G = {
    mode: 'boot',
    course: null,
    view: null,
    hazards: null,
    hview: null,
    twist: NO_TWIST,
    me: null,
    actors: new Map(),
    t: 0,
    raceT: 0,
    trial: null,
    paused: false,
    watch: null,
    round: null,
    resultsShown: null,
    roundEndShown: null,
    room: null,
    cup: null,
    wasHost: false,
    snaps: [],
    tips: { flops: 0, shownLow: false, lockHint: 0 },
    camMode: 'orbit',
    awayT: 0,
    lastPresence: 0,
    sub: '',
    autoplayBrain: null,
    readySent: false,
  };
  const ctx = { scene, audio, fx, cam };
  const listener = () => (G.me && G.me.visible ? G.me.rs : { x: camera.position.x, y: camera.position.y, z: camera.position.z });
  const nearOf = (a) => {
    if (a.kind === 'me') return 1;
    const l = listener();
    const d = Math.hypot(a.rs.x - l.x, a.rs.z - l.z);
    return Math.max(0, 1 - d / 14) * 0.6;
  };

  await Promise.all([progress.load(), loadFonts()]);

  // ---------------------------------------------------------------- actors
  function clearActors() {
    for (const a of G.actors.values()) a.dispose();
    G.actors.clear();
    if (G.me) {
      G.me.dispose();
      G.me = null;
    }
    fx.clear();
  }

  function makeMe(seatIndex = 0, pos, yaw) {
    const d = progress.data;
    const name = G.room?.me?.name ?? 'You';
    const a = createActor(ctx, { id: G.room?.me?.id ?? 'me', name, seat: seatIndex, fish: d.fish, cw: d.cw, kind: 'me' });
    giveBody(a, pos, yaw);
    input.state.yaw = yaw;
    syncFromBody(a);
    cam.snap();
    G.me = a;
    return a;
  }

  let controlsOn = null;
  function setControls(on) {
    on = !!on;
    if (on === controlsOn) return; // called every frame in a race: only tell the platform about a change
    controlsOn = on;
    try {
      ow?.controls?.set?.(on ? { buttons: [{ id: 'flop', label: 'Flop', key: ' ' }] } : null);
    } catch {}
  }
  const hideLobby = (on) => {
    try {
      room?.hideLobby?.(on);
    } catch {}
  };

  // ---------------------------------------------------------------- input wiring
  input.state.onAnyInput = () => audio.unlock();
  input.state.onEsc = () => {
    if (G.mode === 'trial' && !G.trial?.done) setPause(!G.paused);
    else if (G.mode === 'trials' || G.mode === 'fish' || G.mode === 'daily') toQuay();
  };
  input.state.onKey = (k) => {
    if (G.mode === 'title' && (k === 'Space' || k === 'Enter')) toQuay();
    else if (G.mode === 'daily' && (k === 'Space' || k === 'Enter')) startTrial(dailyCatch().course, { daily: true });
    else if (G.mode === 'trial' && k === 'KeyR' && (G.trial?.done || G.paused)) startTrial(G.trial.course.id, { daily: G.trial.daily });
    else if (G.mode === 'match' && !match.me && (k === 'ArrowLeft' || k === 'ArrowRight')) switchWatch(k === 'ArrowLeft' ? -1 : 1);
  };
  input.state.onLockLost = () => {
    if (G.mode === 'trial' && !G.trial?.done && !G.paused) setPause(true);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      input.clear();
      if (G.mode === 'trial' && !G.trial?.done) setPause(true);
    }
  });
  try {
    ow?.on?.('pause', () => {
      input.clear();
      if (G.mode === 'trial' && !G.trial?.done) setPause(true);
    });
  } catch {}

  // ---------------------------------------------------------------- the title
  const wanderers = [];
  function toTitle() {
    G.mode = 'title';
    clearActors();
    clearWanderers();
    hud.show(false);
    setControls(false);
    input.setWantLock(false);
    hideLobby(true);
    const { course, view } = showCourse('quay');
    G.course = course;
    G.view = view;
    G.hazards = null;
    showPodium(false);
    const box = [-7, -4.5, 7.5, 5.5];
    const picks = [['mackerel', 0], ['goldfish', 0], ['puffer', 1], ['flatfish', 0], ['eel', 2], ['mackerel', 1]];
    picks.forEach(([fish, cw], i) => {
      const a = createActor(ctx, { id: `w${i}`, fish, cw, kind: 'wander', seat: i + 1 });
      const s = course.slots[i];
      giveBody(a, s, (i * 1.7) % 6.28);
      a.brain = createWanderer(course.world, box, 11 + i * 7);
      wanderers.push(a);
    });
    screens.title({ tally: progress.tally(), onPlay: () => toQuay() });
    audio.mood('calm');
    G.camMode = 'orbit';
    setFlow('title');
  }
  function clearWanderers() {
    for (const w of wanderers) w.dispose();
    wanderers.length = 0;
  }

  // ---------------------------------------------------------------- the Quay (the lobby, playable)
  function toQuay() {
    audio.unlock();
    if (G.mode === 'closed') return;
    if (!match) {
      G.wantQuay = true;
      return;
    }
    audio.setLow?.(false);
    if (match.phase !== 'lobby' && match.phase !== 'countdown') {
      enterMatch();
      return;
    }
    if (G.trial) {
      clearHazards();
      clearTrial();
    }
    clearWanderers();
    if (G.mode !== 'quay' && G.mode !== 'trials' && G.mode !== 'fish' && G.mode !== 'daily') {
      clearActors();
      const { course, view } = showCourse('quay');
      G.course = course;
      G.view = view;
      G.hazards = null;
      G.twist = NO_TWIST;
      const s = course.slots[(hashString(room.me?.id ?? 'me') % 7) + 1] ?? course.start;
      makeMe(seatIndexInLobby(), s, 0);
    }
    if (G.me) G.me.visible = true;
    G.mode = 'quay';
    G.paused = false;
    showPodium(false);
    hud.show(false);
    setControls(true);
    input.setWantLock(false);
    hideLobby(false);
    G.camMode = 'chase';
    audio.mood('calm');
    drawQuay();
    setFlow(match.phase === 'countdown' ? 'countdown' : 'lobby');
  }
  function seatIndexInLobby() {
    const ids = (room.online ?? []).map((p) => p.id).sort();
    return Math.max(0, ids.indexOf(room.me?.id ?? 'me'));
  }
  function quayInfo() {
    const settings = room.settings ?? {};
    const cupId = CUPS[settings.cup] ? settings.cup : 'harbour';
    const races = Number(settings.races) === 1 ? 1 : 3;
    const online = room.online ?? [];
    const ids = online.map((p) => p.id).sort();
    const seats = online
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((p) => ({ name: p.name, ready: !!p.ready, host: p.id === room.host, me: p.id === room.me?.id, colour: SEAT_COLOURS[ids.indexOf(p.id) % 8] }));
    const canChange = room.isHost && room.kind !== 'public';
    const daily = dailyCatch();
    const fish = FISH.find((f) => f.id === progress.data.fish);
    let hint = '';
    if (ow?.controls?.touch) hint = 'Hold Flop, let go to flop. Drag to turn.';
    else hint = 'Hold Space, let go to flop. A/D or drag to turn.';
    if (progress.data.tips >= 3) hint = '';
    return {
      cupName: CUPS[cupId].name,
      races,
      canChange,
      onCup: () => {
        const order = [['harbour', 3], ['harbour', 1], ['seaside', 3], ['seaside', 1], ['tour', 3], ['tour', 1]];
        const i = order.findIndex(([c, r]) => c === cupId && r === races);
        const [c, r] = order[(i + 1) % order.length];
        try {
          if (c !== cupId) room.setSetting?.('cup', c);
          if (r !== races) room.setSetting?.('races', r);
        } catch {}
        audio.click();
      },
      seats,
      bots: Math.max(0, RACE.seats - seats.length),
      onInvite: room.kind === 'private' || room.kind === 'named' ? () => ow?.ui?.showInvite?.() : null,
      onTrials: () => toTrials(),
      onDaily: () => toDaily(),
      onFish: () => toFish(),
      dailyName: `${getCourse(daily.course).short ?? getCourse(daily.course).name}`,
      fishName: fish?.name ?? 'Mackerel',
      hint,
    };
  }
  function drawQuay() {
    screens.quay(quayInfo());
    layout();
  }

  // ---------------------------------------------------------------- the time-trial board, the daily, the fish picker
  function toTrials() {
    audio.click();
    G.mode = 'trials';
    hideLobby(true);
    setControls(false);
    const courses = COURSE_IDS.map((id) => {
      const c = getCourse(id);
      const i = COURSE_IDS.indexOf(id);
      return {
        id,
        name: c.name,
        open: progress.courseOpen(id),
        best: progress.data.best[id],
        medal: progress.data.medals[id],
        lockText: i > 0 ? `Finish ${getCourse(COURSE_IDS[i - 1]).short ?? getCourse(COURSE_IDS[i - 1]).name}` : '',
      };
    });
    screens.trials({ courses, onPick: (id) => startTrial(id, {}), onBack: () => toQuay() });
    setFlow('trials');
  }
  async function toDaily() {
    audio.click();
    G.mode = 'daily';
    hideLobby(true);
    setControls(false);
    const d = dailyCatch();
    const c = getCourse(d.course);
    const draw = (top) => screens.daily({ courseName: c.name, twistName: d.twist.name, best: progress.dailyBest(d.day), top, onPlay: () => startTrial(d.course, { daily: true }), onBack: () => toQuay() });
    draw(null);
    setFlow('daily');
    try {
      const board = await ow?.leaderboards?.top?.(`daily-${d.course}-${d.twistId}`, { limit: 3, lowerIsBetter: true });
      if (G.mode === 'daily' && board?.entries?.length) draw(board.entries);
    } catch {}
  }
  function toFish() {
    audio.click();
    G.mode = 'fish';
    hideLobby(true);
    setControls(false);
    G.camMode = 'closeup';
    drawFish();
    setFlow('fish');
  }
  function drawFish() {
    const d = progress.data;
    screens.fish({
      fish: FISH.map((f) => ({ id: f.id, name: f.name, unlocked: progress.unlocked(f.id), lockText: progress.unlockText(f.id) })),
      chosen: d.fish,
      cw: d.cw,
      colours: COLOURWAYS[d.fish].map((c) => c[0]),
      onPick: (id) => {
        progress.setFish(id, 0);
        swapMyFish();
        drawFish();
        audio.click();
      },
      onColour: (i) => {
        progress.setFish(d.fish, i);
        swapMyFish();
        drawFish();
        audio.click();
      },
      onBack: () => toQuay(),
    });
  }
  function swapMyFish() {
    if (!G.me) return;
    const b = G.me.body;
    const pos = [b.x, b.y, b.z];
    const seat = G.me.seatIndex;
    G.me.dispose();
    G.me = null;
    makeMe(seat, pos, input.state.yaw);
  }

  // ---------------------------------------------------------------- time trials
  const goldGhosts = new Map();
  function goldTrack(courseId) {
    if (!goldGhosts.has(courseId)) {
      // the quickest of a few clean runs, whichever line it takes
      let best = null;
      for (const route of ['expert', 'spine'])
        for (const seed of [0, 1]) {
          const r = runBot(getCourse(courseId), { skill: 1, seed, route, track: true, personality: 'steady' });
          if (r.finished && (!best || r.time < best.time)) best = r;
        }
      goldGhosts.set(courseId, best ? best.track : null);
    }
    return goldGhosts.get(courseId);
  }
  /** Leave the current trial: its ghosts go with it. */
  function clearTrial() {
    for (const g of G.trial?.ghosts ?? []) g.actor?.dispose();
    G.trial = null;
  }
  async function startTrial(courseId, opts = {}) {
    audio.unlock();
    audio.click();
    clearTrial();
    clearActors();
    clearWanderers();
    G.mode = 'trial';
    G.paused = false;
    screens.clear();
    hideLobby(true);
    setControls(true);
    input.setWantLock(true);
    showPodium(false);
    const daily = opts.daily ? dailyCatch() : null;
    const { course, view } = showCourse(courseId);
    G.course = course;
    G.view = view;
    G.twist = daily ? daily.twist : NO_TWIST;
    setHazards(course, 0);
    makeMe(0, [course.start.x, course.start.y, course.start.z], course.start.yaw);
    G.me.track = [];
    G.me.nextTrack = 0;
    const trial = { course, daily, t: -1.6, done: false, ghosts: [], best: progress.data.best[courseId] ?? 0, lastBeat: 4 };
    G.trial = trial;
    if (!daily) {
      const gold = progress.data.medals[courseId] === 'gold' ? null : goldTrack(courseId);
      if (gold) trial.ghosts.push({ track: gold, actor: createActor(ctx, { id: 'ghost-gold', fish: 'mackerel', cw: 0, kind: 'ghost', ghostColor: 0xffd75a }) });
      const mine = await progress.ghost(courseId);
      if (G.trial !== trial) return;
      if (mine) trial.ghosts.push({ track: mine, actor: createActor(ctx, { id: 'ghost-me', fish: progress.data.fish, cw: progress.data.cw, kind: 'ghost', ghostColor: 0xbff4ff }) });
    }
    hud.show(true, { trial: true });
    hud.clearExtra();
    hud.medalTarget(daily ? null : nextMedal(courseId, trial.best));
    hud.courseCard(course.name, daily ? `Daily Catch, ${daily.twist.name.toLowerCase()}` : null);
    G.camMode = 'chase';
    audio.mood('race');
    setFlow('trial');
  }
  function setHazards(course, seed, gentle = false) {
    if (G.hview) {
      scene.remove(G.hview.root);
      G.hview.dispose();
      G.hview = null;
    }
    // a player's very first race: nothing strikes in the first metres
    G.hazards = createHazards(course, seed, { gentle: gentle ? course.gentle : 0 });
    G.hview = createHazardViews(course, G.hazards, { camera });
    scene.add(G.hview.root);
  }
  function clearHazards() {
    if (G.hview) {
      scene.remove(G.hview.root);
      G.hview.dispose();
      G.hview = null;
    }
    G.hazards = null;
  }
  function setPause(on) {
    if (G.mode !== 'trial') return;
    G.paused = on;
    if (on) {
      input.releaseLock();
      input.clear();
      screens.pause({
        onResume: () => setPause(false),
        onRetry: () => startTrial(G.trial.course.id, { daily: !!G.trial.daily }),
        onPuddle: () => {
          if (G.me?.body) respawn(G.me.body);
          setPause(false);
        },
        onQuit: () => {
          clearHazards();
          clearTrial();
          G.mode = 'boot';
          toQuay();
        },
      });
      setFlow('paused');
    } else {
      screens.clear();
      setFlow('trial');
    }
  }
  function trialFinished() {
    const tr = G.trial;
    tr.done = true;
    const time = G.me.finishT ?? tr.t;
    input.releaseLock();
    setControls(false);
    award('splash');
    if (G.me.body.m < 10) award('bone-dry');
    let info;
    if (tr.daily) {
      const newBest = progress.dailyFinish(tr.daily.day, time);
      submitTime(`daily-${tr.daily.course}-${tr.daily.twistId}`, time);
      info = { time, newBest, medal: null };
    } else {
      const r = progress.finish(tr.course.id, time);
      submitTime(`time-${tr.course.id}`, time);
      if (r.newBest && G.me.track) progress.saveGhost(tr.course.id, G.me.track);
      if (r.newMedal === 'gold') award('gold-fin');
      if (COURSE_IDS.every((c) => progress.data.finished[c])) award('whole-catch');
      if (COURSE_IDS.every((c) => progress.data.medals[c] === 'gold')) award('golden-catch');
      if (r.newMedal) audio.medal();
      const fishNames = r.unlockedFish.map((id) => FISH.find((f) => f.id === id)?.name).filter(Boolean);
      info = { time, medal: r.medal, newBest: r.newBest && tr.best > 0, newMedal: r.newMedal, split: tr.best > 0 ? time - tr.best : null, unlocked: fishNames.length ? `New fish: ${fishNames.join(', ')}` : null };
    }
    const i = COURSE_IDS.indexOf(tr.course.id);
    const nextId = !tr.daily && i >= 0 && i < COURSE_IDS.length - 1 && progress.courseOpen(COURSE_IDS[i + 1]) ? COURSE_IDS[i + 1] : null;
    setTimeout(() => {
      if (G.trial !== tr) return;
      hud.trialEnd(info, {
        retry: () => startTrial(tr.course.id, { daily: !!tr.daily }),
        next: nextId ? () => startTrial(nextId, {}) : null,
        back: () => {
          clearHazards();
          clearTrial();
          G.mode = 'boot';
          toQuay();
        },
      });
      setFlow('trial-end');
    }, 900);
  }

  // ---------------------------------------------------------------- the cup
  function enterMatch() {
    if (G.mode === 'trial') {
      clearHazards();
      clearTrial();
    }
    clearWanderers();
    G.mode = 'match';
    G.paused = false;
    screens.clear();
    hud.show(true);
    G.round = null;
    setFlow(match.phase);
  }
  function leaveMatch() {
    clearHazards();
    clearActors();
    G.round = null;
    G.mode = 'boot';
    G.snaps.length = 0;
    hud.show(false);
    hud.clearExtra();
    showPodium(false);
    toQuay();
  }
  function seatOf(id) {
    return match.seats.find((s) => s.id === id) ?? null;
  }
  function setupRace() {
    const d = match.data;
    if (!d || typeof d.c !== 'string' || !COURSE_IDS.includes(d.c)) return false;
    clearActors();
    clearHazards();
    fx.clear();
    G.snaps.length = 0;
    const { course, view } = showCourse(d.c);
    G.course = course;
    G.view = view;
    G.twist = NO_TWIST;
    showPodium(false);
    setHazards(course, (match.room.match?.seed ?? 0) + match.round * 7919, progress.data.races === 0 && match.round === 1);
    G.round = match.roundId;
    G.raceT = 0;
    G.wasHost = match.isHost;
    G.watch = null;
    const onlyHuman = match.seats.filter((s) => !s.bot).length === 1;
    for (const s of match.seats) {
      const slot = course.slots[s.index % course.slots.length];
      if (s.me) {
        const a = makeMe(s.index, slot, course.start.yaw);
        a.name = s.name;
        if (AUTOPLAY) G.autoplayBrain = createBrain(course, { skill: 0.95, seed: 7, yaw: course.start.yaw, personality: 'steady' });
        continue;
      }
      const style = s.bot ? BOT_STYLE[s.name] ?? { personality: 'steady', fish: FISH_IDS[s.index % 5], cw: s.index % 3 } : null;
      const a = createActor(ctx, { id: s.id, name: s.name, seat: s.index, fish: style ? style.fish : 'mackerel', cw: style ? style.cw : 0, kind: s.bot ? 'bot' : 'remote' });
      a.skill = s.skill;
      a.style = style;
      a.slot = slot;
      a.rs.x = slot[0];
      a.rs.y = slot[1];
      a.rs.z = slot[2];
      a.rs.aim = course.start.yaw;
      if (s.bot && match.isHost) hostBot(a, slot, course.start.yaw, onlyHuman && match.round === 1);
      G.actors.set(s.id, a);
    }
    G.camMode = G.me ? 'chase' : 'watch';
    hud.courseCard(course.name, match.rounds > 1 ? `Race ${match.round} of ${match.rounds}` : null);
    G.introStart = performance.now();
    G.beat = 4;
    audio.mood('race');
    return true;
  }
  function hostBot(a, pos, yaw, gentle) {
    giveBody(a, pos, yaw);
    const skill = (a.skill ?? 0.5) * (gentle ? 0.75 : 1);
    a.brain = createBrain(G.course, { skill, personality: a.style?.personality, seed: hashString(`${a.id}:${G.round}`), yaw });
    a.body.m = WATER.max;
  }
  function takeOverBots() {
    for (const a of G.actors.values()) {
      if (a.kind !== 'bot' || a.body) continue;
      giveBody(a, [a.rs.x, a.rs.y + 0.05, a.rs.z], a.rs.aim);
      a.body.m = Math.max(20, a.rs.wet * WATER.max);
      a.simT = G.raceT;
      a.body.t = G.raceT;
      if (a.rs.state === 'done' || match.data?.fin?.[a.id] !== undefined) {
        a.body.state = 'done';
        a.done = true;
      }
      a.brain = createBrain(G.course, { skill: a.skill ?? 0.5, personality: a.style?.personality, seed: hashString(`${a.id}:${G.round}:x`), yaw: a.rs.aim });
    }
  }
  function dropBots() {
    for (const a of G.actors.values()) if (a.kind === 'bot') a.body = null;
  }
  function switchWatch(dir) {
    const list = [...G.actors.values()].filter((a) => !a.gone);
    if (!list.length) return;
    const i = list.findIndex((a) => a.id === G.watch);
    G.watch = list[(i + dir + list.length) % list.length].id;
    audio.click();
  }

  /** Places now: finishers by time, then everyone else by distance. */
  function ranking() {
    const fin = match.data?.fin ?? {};
    const all = [];
    if (G.me && match.me) all.push({ id: G.me.id, a: G.me, t: fin[G.me.id] ?? (G.me.done ? G.me.finishT * 1000 : undefined), p: G.me.prog });
    for (const a of G.actors.values()) all.push({ id: a.id, a, t: fin[a.id], p: a.done ? 1e4 : a.prog });
    all.sort((x, y) => {
      const fx_ = x.t !== undefined, fy = y.t !== undefined;
      if (fx_ && fy) return x.t - y.t;
      if (fx_) return -1;
      if (fy) return 1;
      return y.p - x.p;
    });
    return all;
  }

  function showRoundEnd() {
    G.roundEndShown = match.roundId;
    const last = match.last;
    const fin = match.data?.fin ?? {};
    const rows = [];
    let place = 1;
    for (const group of last?.ranking ?? []) {
      for (const id of group) {
        const s = seatOf(id);
        const a = id === G.me?.id ? G.me : G.actors.get(id);
        rows.push({ place, name: s?.name ?? '', seat: SEAT_COLOURS[(s?.index ?? 0) % 8], time: fin[id] !== undefined ? fin[id] / 1000 : null, dist: fin[id] === undefined ? Math.max(0, (G.course.length ?? 0) - (a?.prog ?? 0)) : null, pts: last.points?.[id] ?? 0, me: !!s?.me, gone: !!s?.left });
      }
      place += group.length;
    }
    for (const r of rows) if (r.dist !== null) r.dist = Math.round(r.dist);
    rows.forEach((r) => {
      if (r.dist !== null && r.dist !== undefined) r.time = null;
    });
    hud.standings(match.round >= match.rounds && match.rounds > 0 ? 'Last race' : `Race ${match.round}`, rows.map((r) => ({ ...r, dist: r.dist !== null ? r.dist : null, time: r.time })), {});
    // distances read as "12 m to go"
    hud.el.querySelectorAll('.standings .tm').forEach((el, i) => {
      if (rows[i] && rows[i].time === null) el.textContent = `${rows[i].dist} m to go`;
    });
    const mine = rows.find((r) => r.me);
    if (mine && fin[G.me?.id] !== undefined) award('splash');
  }

  function showResults() {
    G.resultsShown = match.roundId + ':results';
    clearHazards();
    clearActors();
    const { course, view } = showCourse('quay');
    G.course = course;
    G.view = view;
    showPodium(true);
    const standings = match.results ?? match.standings ?? [];
    // the top three on the podium, flopping in place
    standings.slice(0, 3).forEach((st, i) => {
      const s = seatOf(st.id);
      const style = s?.bot ? BOT_STYLE[s.name] : null;
      const isMe = !!s?.me;
      const fish = isMe ? progress.data.fish : style?.fish ?? 'mackerel';
      const cw = isMe ? progress.data.cw : style?.cw ?? 0;
      const a = createActor(ctx, { id: `pod${i}`, name: st.name, seat: s?.index ?? i, fish, cw, kind: isMe ? 'podme' : 'podium' });
      const p = course.podium[i];
      giveBody(a, [p[0], p[1] + 0.02, p[2]], Math.PI);
      a.brain = { t: 0.4 + i * 0.5, step(b, dt) {
        this.t -= dt;
        if (this.t < 0 && b.ground) {
          this.t = 1.2 + Math.random() * 0.8;
          this.hold = 0.16;
        }
        if (this.hold > 0) {
          this.hold -= dt;
          return { hold: true, yaw: Math.PI };
        }
        return { hold: false, yaw: Math.PI };
      } };
      G.actors.set(a.id, a);
    });
    const rows = standings.map((st) => {
      const s = seatOf(st.id);
      return { place: st.place, name: st.name, seat: SEAT_COLOURS[(s?.index ?? 0) % 8], time: null, pts: 0, total: st.points, me: !!s?.me, gone: !!s?.left };
    });
    const winner = standings[0];
    const head = winner ? `${winner.name} wins the ${CUPS[match.settings?.cup]?.name ?? 'cup'}` : 'Cup results';
    hud.standings(head, rows, { total: true, stagger: 0.12 });
    G.camMode = 'podium';
    fx.burst(0, 2.2, 2.6, 60, 'confetti', 1.2);
    audio.cheer();
    audio.mood('calm');
  }

  // ---------------------------------------------------------------- presence
  function sendPresence(tagName) {
    if (!room) return;
    const now = performance.now();
    if (now - G.lastPresence < 50) return;
    G.lastPresence = now;
    const a = G.me;
    if (!a?.body) {
      try {
        room.setPresence({ r: tagName });
      } catch {}
      return;
    }
    const b = a.body;
    const h = Math.atan2(Math.sin(a.rs.aim), Math.cos(a.rs.aim));
    try {
      room.setPresence({
        x: Math.round(b.x * 100),
        y: Math.round(b.y * 100),
        z: Math.round(b.z * 100),
        h: Math.round(h * 1000) / 1000,
        c: Math.round(a.rs.curl * 100),
        m: Math.round(b.m),
        s: stateCode(b),
        p: Math.round(Math.max(0, a.prog) * 10),
        f: Math.max(0, FISH_IDS.indexOf(a.fish)),
        k: a.cw,
        r: tagName,
        n: a.n,
        l: a.l,
      });
    } catch {}
  }

  /** Other players' fish, from their presence (only those on the same course: tag `r`). */
  function updateRemotes(dt, tagName, inMatch) {
    const ids = inMatch ? match.seats.filter((s) => !s.bot && !s.me).map((s) => s.id) : (room.online ?? []).filter((p) => p.id !== room.me?.id).map((p) => p.id);
    const seen = new Set();
    for (const id of ids) {
      let raw = null;
      try {
        raw = room.presenceAt(id, { angles: ['h'], snap: 300 });
      } catch {}
      const p = readPresence(raw);
      // counters and flags (state, fish, colourway, flop and landing counts, course tag) come from the latest update as
      // they are: presenceAt blends numbers between two updates, which would pass a state of 0 → 3 through 1 and 2
      const last = readPresence(room.players?.get?.(id)?.presence);
      if (p && last) {
        p.s = last.s;
        p.f = last.f;
        p.k = last.k;
        p.n = last.n;
        p.l = last.l;
        p.g = last.g;
        p.r = last.r;
      }
      let a = G.actors.get(id);
      if (!p || p.r !== tagName) {
        if (a && !inMatch) {
          a.dispose();
          G.actors.delete(id);
        } else if (a) a.visible = false;
        continue;
      }
      seen.add(id);
      const fish = FISH_IDS[p.f] ?? 'mackerel';
      if (a && (a.fish !== fish || a.cw !== p.k) && a.kind === 'remote') {
        const keep = { name: a.name, seat: a.seatIndex };
        a.dispose();
        G.actors.delete(id);
        a = null;
        a = createActor(ctx, { id, name: keep.name, seat: keep.seat, fish, cw: p.k, kind: 'remote' });
        G.actors.set(id, a);
      }
      if (!a) {
        const player = room.players?.get?.(id);
        const idx = inMatch ? seatOf(id)?.index ?? 0 : (room.online ?? []).map((q) => q.id).sort().indexOf(id);
        a = createActor(ctx, { id, name: player?.name ?? '', seat: Math.max(0, idx), fish, cw: p.k, kind: 'remote' });
        G.actors.set(id, a);
      }
      a.visible = true;
      syncFromSample(a, p, dt);
      a.prog = p.p;
      a.done = (p.s & 3) === 3;
      remoteEvents(ctx, a, p, nearOf(a));
      const player = room.players?.get?.(id);
      if (player?.name && a.name !== player.name) a.name = player.name;
      a.gone = inMatch ? !!seatOf(id)?.left || !!seatOf(id)?.away : false;
    }
    if (!inMatch) {
      for (const [id, a] of G.actors) {
        if (a.kind === 'remote' && !seen.has(id)) {
          a.dispose();
          G.actors.delete(id);
        }
      }
    }
  }

  /** Bots drawn from the host's snapshots, 120 ms behind. */
  function updateSnapshotBots(dt) {
    const snaps = G.snaps.filter((s) => s.rid === G.round);
    if (!snaps.length) return;
    const renderAt = performance.now() - 120;
    let a0 = snaps[0], a1 = snaps[snaps.length - 1];
    for (let i = 0; i < snaps.length - 1; i++) {
      if (snaps[i].at <= renderAt && snaps[i + 1].at >= renderAt) {
        a0 = snaps[i];
        a1 = snaps[i + 1];
        break;
      }
    }
    const k = a1.at > a0.at ? Math.max(0, Math.min(1, (renderAt - a0.at) / (a1.at - a0.at))) : 1;
    for (const a of G.actors.values()) {
      if (a.kind !== 'bot' || a.body) continue;
      const r0 = a0.rows.get(a.id), r1 = a1.rows.get(a.id) ?? r0;
      if (!r1) continue;
      const q = r0 ?? r1;
      const lerp = (i) => q[i] + (r1[i] - q[i]) * k;
      let dh = r1[4] - q[4];
      dh = Math.atan2(Math.sin(dh / 100), Math.cos(dh / 100)) * 100;
      const p = { x: lerp(1) / 100, y: lerp(2) / 100, z: lerp(3) / 100, h: (q[4] + dh * k) / 100, c: r1[5] / 100, m: r1[6], s: r1[7], p: r1[8] / 10, n: r1[9], l: r1[10] };
      syncFromSample(a, p, dt);
      a.prog = p.p;
      a.done = (p.s & 3) === 3;
      remoteEvents(ctx, a, p, nearOf(a));
    }
  }

  function publishBots() {
    if (!match.isHost) return;
    const now = performance.now();
    if (now - (G.lastBotPub ?? 0) < 100) return;
    G.lastBotPub = now;
    const list = [];
    for (const a of G.actors.values()) {
      if (a.kind !== 'bot' || !a.body) continue;
      const b = a.body;
      list.push([a.id, Math.round(b.x * 100), Math.round(b.y * 100), Math.round(b.z * 100), Math.round(Math.atan2(Math.sin(a.rs.aim), Math.cos(a.rs.aim)) * 100), Math.round(a.rs.curl * 100), Math.round(b.m), stateCode(b), Math.round(a.prog * 10), a.n, a.l]);
    }
    cup.botsState.set({ rid: G.round ?? '', list });
  }

  // ---------------------------------------------------------------- simulation helpers
  const env = () => ({ world: G.course.world, hazards: G.hazards, twist: G.twist, t: 0 });
  const myInput = (a, dt, t) => {
    if (G.autoplayBrain && G.mode === 'match') {
      const r = G.autoplayBrain.step(a.body, dt, t, G.hazards);
      input.state.yaw = r.yaw;
      return r;
    }
    let hold = input.holding();
    if (!hold && input.state.tap) {
      hold = true;
      input.state.tap = false;
    }
    return { hold, yaw: input.state.yaw };
  };
  const brainInput = (a, dt, t) => a.brain.step(a.body, dt, t, G.hazards);
  const onEvent = (a, e) => {
    eventFx(ctx, a, e, nearOf(a));
    if (a.kind !== 'me') return;
    if (e.type === 'flop') {
      G.tips.flops++;
      if (G.tips.flops === 1) award('first-flop');
      if (e.chain >= 5) award('slap-happy');
      if (G.tips.flops === 6 && progress.data.tips < 3) {
        progress.data.tips++;
        progress.save();
      }
    } else if (e.type === 'slide' && e.dist >= 10) award('ice-skater');
    else if (e.type === 'dry') hud.callout('Dried out!', { kind: 'red', seconds: 1.1 });
    else if (e.type === 'grab') {
      hud.callout(e.lucky ? 'Lucky gull!' : 'Gull!', { kind: e.lucky ? '' : 'red', seconds: 1.1 });
      if (!e.lucky) award('gull-bait');
    }
    else if (e.type === 'finish') {
      hud.callout('SPLASH!', { kind: '', seconds: 1.6 });
      if (G.mode === 'match' && match.phase === 'round' && !a.sentFinish) {
        a.sentFinish = true;
        cup.finish(match.roundId, a.finishT * 1000);
        award('splash');
        if (a.body.m < 10) award('bone-dry');
      }
    }
  };

  // ---------------------------------------------------------------- arc preview, wayfinding, name tags
  const arcPts = [];
  function updateArc() {
    const a = G.me;
    if (!a?.body || G.paused || a.kind !== 'me') return fx.hideArc();
    const b = a.body;
    if (b.state !== 'ok' || !b.holding || !canFlop(b)) return fx.hideArc();
    const land = predictArc(b, G.course.world, input.state.yaw, chargeOf(b.holdT, b.fish), G.twist, { points: arcPts, every: 3, dt: 1 / 120 });
    fx.arc(arcPts, land, G.t);
  }
  const way = [0, 0, 0];
  function updateWay(dt) {
    const a = G.me;
    if (!a?.body || !G.course?.spine || G.course.id === 'quay' || a.done) {
      chevron.material.opacity = Math.max(0, chevron.material.opacity - dt * 4);
      return;
    }
    pointAt(G.course.spine, G.course.lens, a.prog + 5, way);
    const want = Math.atan2(way[0] - a.body.x, way[2] - a.body.z);
    let d = want - input.state.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    G.awayT = Math.abs(d) > 1.25 && a.body.ground ? G.awayT + dt : 0;
    const on = G.awayT > 1.6;
    chevron.material.opacity += ((on ? 0.92 : 0) - chevron.material.opacity) * Math.min(1, dt * 6);
    if (chevron.material.opacity > 0.02) {
      chevron.position.set(a.body.x + Math.sin(want) * 1.2, a.body.y - 0.12, a.body.z + Math.cos(want) * 1.2);
      chevron.rotation.y = want;
      chevron.scale.setScalar(1 + 0.08 * Math.sin(G.t * 6));
    }
    if (on) hud.hint('This way');
    else if (G.hintWas === 'This way') hud.hint('');
    G.hintWas = on ? 'This way' : '';
  }
  const v3 = new THREE.Vector3();
  function updateNameTags() {
    const list = [];
    const all = [...G.actors.values()];
    if (G.me && G.mode === 'match') all.push(G.me);
    for (const a of all) {
      if (!a.name || a.kind === 'ghost' || a.kind === 'wander') continue;
      v3.set(a.rs.x, a.rs.y + 0.42, a.rs.z);
      const dist = v3.distanceTo(camera.position);
      v3.project(camera);
      const on = a.visible && v3.z < 1 && v3.z > -1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 && dist < 28 && !(a.kind === 'me' && G.camMode === 'chase');
      list.push({ id: a.id, name: a.name, seat: a.seat, sx: (v3.x * 0.5 + 0.5) * innerWidth, sy: (-v3.y * 0.5 + 0.5) * innerHeight - 10, on, me: a.kind === 'me' || a.kind === 'podme', gone: a.gone, tilt: -6 });
    }
    hud.nameTags(list);
  }

  // ---------------------------------------------------------------- cameras
  const camP = new THREE.Vector3();
  const camL = new THREE.Vector3();
  function orbitCam(dt) {
    const t = G.t * 0.06;
    camP.set(Math.sin(t) * 3.2 + 0.5, 4.3 + Math.sin(t * 1.7) * 0.2, -8.1);
    camL.set(Math.sin(t) * 1.2 + 0.5, 0.2, 4.5);
    cam.place(dt, camP, camL, 2);
  }
  const CHASE = { dist: 1.8, up: 0.8, ceil: Infinity };
  const WATCH = { dist: 2.8, up: 1.3, ahead: 1.6, ceil: Infinity };
  function chaseCam(dt, a) {
    const b = a.body;
    CHASE.ceil = G.course.camCeil ?? Infinity;
    if (b && b.state === 'done') {
      // in: the camera stops up over the edge and looks down into the splash (steep enough to see past the quay wall)
      const [ix, iy, iz] = b.inAt ?? [b.x, b.y, b.z];
      const yaw = input.state.yaw;
      camP.set(ix - Math.sin(yaw) * 2.4, Math.min(iy + 3.6, CHASE.ceil), iz - Math.cos(yaw) * 2.4);
      camL.set(ix, iy + 0.2, iz);
      cam.place(dt, camP, camL, 4);
      return;
    }
    const r = a.rs;
    const s = { x: r.x, y: r.y, z: r.z, vx: r.vx, vy: r.vy, vz: r.vz, yaw: b ? input.state.yaw : r.aim, curl: r.curl, ground: b ? b.ground : r.ground };
    cam.follow(dt, s, G.course.world, CHASE);
  }
  function watchCam(dt, a) {
    const yaw = Math.atan2(a.rs.vx, a.rs.vz);
    const s = { x: a.rs.x, y: a.rs.y, z: a.rs.z, vx: a.rs.vx, vy: a.rs.vy, vz: a.rs.vz, yaw: Math.hypot(a.rs.vx, a.rs.vz) > 1 ? yaw : a.rs.aim, curl: 0, ground: a.rs.ground };
    WATCH.ceil = G.course.camCeil ?? Infinity;
    cam.follow(dt, s, G.course.world, WATCH);
  }
  const fp = [0, 0, 0];
  const fl = [0, 0, 0];
  function flyCam(dt, k) {
    // from the water back along the course to the start
    const c = G.course;
    const e = 1 - Math.pow(1 - k, 2.2);
    const s = c.length * (1 - e);
    pointAt(c.spine, c.lens, s, fp);
    pointAt(c.spine, c.lens, Math.max(0, s - 10), fl);
    camP.set(fp[0] + 2.5, fp[1] + 4.2 - e * 1.6, fp[2] + 6);
    camL.set(fl[0], fl[1] + 0.6, fl[2]);
    cam.place(dt, camP, camL, 0);
  }
  function podiumCam(dt) {
    const t = G.t * 0.25;
    camP.set(Math.sin(t) * 0.8, 2.3, -3.2);
    camL.set(0, 1.2, 2.6);
    cam.place(dt, camP, camL, 3);
  }
  function closeupCam(dt) {
    const a = G.me;
    if (!a) return orbitCam(dt);
    const yaw = G.t * 0.35;
    camP.set(a.rs.x + Math.sin(yaw) * 1.6, a.rs.y + 0.75, a.rs.z + Math.cos(yaw) * 1.6);
    camL.set(a.rs.x, a.rs.y + 0.15, a.rs.z);
    cam.place(dt, camP, camL, 4);
  }
  function finishCam(dt) {
    const c = G.course;
    const end = c.spine[c.spine.length - 2];
    camP.set(end[0] - 3, end[1] + 3.2, end[2] - 7);
    camL.set(end[0] + 1, end[1], end[2] + 6);
    cam.place(dt, camP, camL, 2);
  }

  // ---------------------------------------------------------------- the frame
  let lastNow = performance.now();
  const sunAt = new THREE.Vector3();
  const sunAhead = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    if (!(dt > 0)) dt = 1 / 60;
    G.t += dt;
    input.update(dt);
    try {
      tick(dt);
    } catch (err) {
      console.error(err);
    }
    hud.update(dt);
    // the sun's shadow box follows what the camera is looking at (your fish, in a race)
    stage.camera.getWorldDirection(sunAt).multiplyScalar(5).add(stage.camera.position);
    if (G.camMode === 'chase' && G.me?.rs) {
      // centred a little ahead of the fish, where it will land next
      stage.camera.getWorldDirection(sunAhead);
      sunAhead.y = 0;
      sunAhead.normalize().multiplyScalar(6);
      sunAt.set(G.me.rs.x + sunAhead.x, G.me.rs.y, G.me.rs.z + sunAhead.z);
    }
    stage.focus(sunAt.x, Math.min(sunAt.y, 6), sunAt.z);
    stage.fovKick = cam.fovKick;
    stage.fit();
    stage.render(dt);
  }

  function tick(dt) {
    if (G.mode === 'closed') {
      orbitCam(dt);
      return;
    }
    const mph = match ? match.phase : 'lobby';
    // the cup takes over whenever a match runs (and back to the Quay after it)
    if (mph !== 'lobby' && mph !== 'countdown') {
      if (G.mode === 'quay' || ((G.mode === 'title' || G.mode === 'trials' || G.mode === 'fish' || G.mode === 'daily' || G.mode === 'trial') && match.me)) enterMatch();
    } else if (G.mode === 'match') leaveMatch();

    if (G.mode === 'title') {
      for (const w of wanderers) {
        simulate(w, w.simT + dt, brainInput, env(), (a, e) => eventFx(ctx, a, e, nearOf(a) * 0.5), 20);
        syncFromBody(w);
        w.view.update(dt, w.rs);
      }
      orbitCam(dt);
      G.view?.update(G.t);
      fx.update(dt);
      hud.nameTags([]);
      sendPresence('title');
      setFlow('title');
      if (AUTOPLAY && G.t > 1.2) toQuay();
      return;
    }

    if (G.mode === 'quay' || G.mode === 'trials' || G.mode === 'fish' || G.mode === 'daily') return tickQuay(dt);
    if (G.mode === 'trial') return tickTrial(dt);
    if (G.mode === 'match') return tickMatch(dt);
  }

  function tickQuay(dt) {
    const a = G.me;
    const playing = G.mode === 'quay';
    input.state.enabled = playing;
    if (a?.body) {
      simulate(a, a.simT + dt, myInput, env(), onEvent, 30);
      // a fish in the sea pops back onto the quay
      if (a.body.state === 'done') {
        respawn(a.body, G.course.slots[(hashString(a.id) % 7) + 1] ?? [0, 0.2, 0]);
        a.body.vy = 3;
      }
      syncFromBody(a);
      a.prog = 0;
      a.view.update(dt, a.rs);
      a.view.setVisible(true);
      fx.halo(a.body.x, (a.body.ground ? a.body.y - 0.16 : a.body.y - 0.16), a.body.z, false);
    }
    updateRemotes(dt, 'quay', false);
    for (const r of G.actors.values()) {
      r.view.setVisible(r.visible);
      r.view.update(dt, r.rs);
    }
    if (G.mode === 'fish') closeupCam(dt);
    else if (a) chaseCam(dt, a);
    updateArc();
    G.view?.update(G.t);
    fx.update(dt);
    sendPresence('quay');
    if (G.mode === 'quay') {
      screens.quayUpdate(quayInfo());
      updateNameTags();
      setFlow(match.phase === 'countdown' ? 'countdown' : 'lobby');
      if (AUTOPLAY && !G.readySent && G.t > 2) {
        G.readySent = true;
        try {
          if (room.isHost && room.kind !== 'public' && room.kind !== 'solo') match.start();
          else match.ready(true);
        } catch {}
      }
    } else hud.nameTags([]);
  }

  function tickTrial(dt) {
    const tr = G.trial;
    const a = G.me;
    if (!tr || !a) return;
    input.state.enabled = !G.paused && !tr.done;
    if (!G.paused) {
      const before = tr.t;
      tr.t += dt;
      // 3, 2, 1 over the first 1.5 s
      if (before < 0) {
        const beat = Math.ceil(-tr.t / 0.5);
        if (beat !== tr.lastBeat && beat >= 0 && beat <= 3) {
          tr.lastBeat = beat;
          if (beat > 0) {
            hud.callout(String(beat), { kind: beat === 1 ? 'red' : '', seconds: 0.45 });
            audio.bell(false);
          }
        }
        if (tr.t >= 0) {
          hud.callout('Flop!', { kind: 'red', seconds: 0.7 });
          hud.courseCard(null);
          audio.horn();
          a.simT = 0;
          a.body.t = 0;
        }
      }
      if (tr.t >= 0 && !tr.done) {
        simulate(a, tr.t, myInput, env(), onEvent, 30);
        if (a.body.state === 'done') trialFinished();
      }
      if (input.state.rHeld > 0.5 && !tr.done && tr.t > 0) {
        input.state.rHeld = -10; // one restart per press
        startTrial(tr.course.id, { daily: !!tr.daily });
        return;
      }
    }
    syncFromBody(a);
    a.prog = G.course.progress(a.body.x, a.body.z, a.hint).s;
    a.view.update(dt, a.rs);
    for (const g of tr.ghosts) {
      const p = ghostAt(g.track, Math.max(0, tr.t));
      if (!p) continue;
      const r = g.actor.rs;
      syncFromSample(g.actor, { x: p.x, y: p.y, z: p.z, h: p.h, c: 0, m: 100, s: p.done ? 3 : Math.abs(p.vy) < 0.3 ? 4 : 0 }, dt);
      g.actor.view.setVisible(!p.done && tr.t > 0 && Math.hypot(r.x - a.rs.x, r.z - a.rs.z) > 0.5);
      g.actor.view.update(dt, r);
    }
    G.hview?.update(Math.max(0, tr.t), dt, hazardSink);
    playHazardSounds();
    if (!tr.done) chaseCam(dt, a);
    else chaseCam(dt, a);
    fx.halo(a.body.x, a.body.y - 0.16, a.body.z, false);
    updateArc();
    updateWay(dt);
    G.view?.update(G.t);
    fx.update(dt);
    hud.timer(Math.max(0, tr.done ? a.finishT ?? tr.t : tr.t));
    hud.water(a.body.m, dt);
    audio.setLow(a.body.m < WATER.low && !tr.done);
    if (!tr.done) tipHints(a, tr.t);
    sendPresence('trial');
    hud.nameTags([]);
  }

  const hazardSink = [];
  function playHazardSounds() {
    const l = listener();
    for (const e of hazardSink) {
      const d = Math.hypot(e.x - l.x, e.z - l.z);
      if (d > 12) continue;
      const v = 1 - d / 12;
      if (e.type === 'stomp') audio.stomp(0.32 * v);
      else if (e.type === 'swipe') audio.swipe();
      else if (e.type === 'slam') audio.knock('pan');
      else if (e.type === 'squawk') audio.gull((e.lucky ? 0.22 : 0.16) * Math.max(0.4, v));
      else if (e.type === 'throw') audio.clack(0.25 * v);
    }
    hazardSink.length = 0;
  }

  function tipHints(a, t) {
    if (progress.data.tips >= 3 || G.hintWas === 'This way') return;
    const touch = !!ow?.controls?.touch;
    let text = '';
    if (G.tips.flops < 2 && t < 12) text = touch ? 'Hold Flop, let go to flop' : 'Hold Space, let go to flop';
    else if (G.tips.flops < 5 && t < 20) text = touch ? 'Drag to turn' : 'Mouse or A/D to turn';
    else if (a.body.m < 45 && !G.tips.shownLow) {
      text = 'Puddles fill your gills';
      G.tips.lowAt ??= t;
      if (t - G.tips.lowAt > 4) G.tips.shownLow = true;
    }
    if (input.state.wantLock && !input.state.locked && !touch && !input.state.lockRefused && t > 0.5) text = 'Click to aim with the mouse';
    hud.hint(text);
  }

  function tickMatch(dt) {
    const ph = match.phase;
    setFlow(ph === 'round' ? 'race' : ph);
    if (ph === 'results') {
      if (G.resultsShown !== match.roundId + ':results') showResults();
      for (const a of G.actors.values()) {
        if (a.body) {
          simulate(a, a.simT + dt, brainInput, { world: G.course.world, hazards: null, twist: NO_TWIST, t: 0 }, (x, e) => eventFx(ctx, x, e, 0.3), 20);
          syncFromBody(a);
        }
        a.view.update(dt, a.rs);
      }
      podiumCam(dt);
      G.view?.update(G.t);
      fx.update(dt);
      updateNameTags();
      hud.show(true);
      hud.el.querySelector('.hud-top').hidden = true;
      hud.el.querySelector('.hud-right').hidden = true;
      hud.showGauge(false);
      sendPresence('results');
      return;
    }
    hud.el.querySelector('.hud-top').hidden = false;
    hud.el.querySelector('.hud-right').hidden = false;
    if (G.round !== match.roundId) {
      if (!setupRace()) {
        orbitCam(dt);
        return;
      }
      hud.clearExtra();
    }
    const course = G.course;
    const racing = ph === 'round';
    G.raceT = racing ? match.elapsed / 1000 : ph === 'roundEnd' ? G.raceT : 0;
    input.state.enabled = racing && !!G.me && !G.me.done;
    input.setWantLock(racing && !!G.me && !G.me.done);
    setControls(racing && !!G.me && !G.me.done);

    // host changes
    if (match.isHost && !G.wasHost) takeOverBots();
    else if (!match.isHost && G.wasHost) dropBots();
    G.wasHost = match.isHost;

    const e = { world: course.world, hazards: G.hazards, twist: G.twist, t: 0 };
    // me
    const me = G.me;
    if (me?.body) {
      if (racing) {
        simulate(me, G.raceT, myInput, e, onEvent, 40);
        if (me.body.state === 'done') me.done = true;
        if (input.state.rHeld > 0.6 && me.body.state === 'ok') {
          respawn(me.body);
          input.state.rHeld = -10;
        }
      } else me.simT = G.raceT;
      syncFromBody(me);
      me.prog = me.done ? course.length : course.progress(me.body.x, me.body.z, me.hint).s;
      me.view.update(dt, me.rs);
    }
    // bots
    for (const a of G.actors.values()) {
      if (a.kind !== 'bot') continue;
      if (a.body) {
        if (racing) {
          simulate(a, G.raceT, brainInput, e, onEvent, 180);
          if (a.body.state === 'done' && !a.done) {
            a.done = true;
            cup.botFinish(a.id, (a.finishT ?? G.raceT) * 1000);
          }
        } else a.simT = G.raceT;
        syncFromBody(a);
        a.prog = a.done ? course.length : course.progress(a.body.x, a.body.z, a.hint).s;
      }
    }
    if (match.isHost) publishBots();
    else updateSnapshotBots(dt);
    updateRemotes(dt, G.round, true);
    for (const a of G.actors.values()) {
      if (a.kind === 'remote' && a.visible === false && racing) {
        // a player with no presence yet sits on their slot
        a.rs.x = a.slot?.[0] ?? a.rs.x;
      }
      a.view.setVisible(a.visible !== false);
      a.view.update(dt, a.rs);
    }
    G.hview?.update(G.raceT, dt, hazardSink);
    playHazardSounds();

    // cameras
    if (ph === 'intro') {
      const left = match.secondsLeft ?? 0;
      const total = RACE.introSeconds;
      const k = Math.min(1, (total - left) / 2.6);
      if (k < 1) flyCam(dt, k);
      else if (me) chaseCam(dt, me);
      else watchLeader(dt);
      const beat = Math.ceil(left / 0.5);
      if (left <= 1.5 && beat !== G.beat && beat > 0) {
        G.beat = beat;
        hud.callout(String(beat), { kind: beat === 1 ? 'red' : '', seconds: 0.45 });
        audio.bell(false);
        hud.courseCard(null);
      }
    } else if (ph === 'round') {
      if (G.beat !== 0) {
        G.beat = 0;
        hud.courseCard(null);
        if (G.raceT < 1.5) {
          hud.callout('Flop!', { kind: 'red', seconds: 0.7 });
          audio.horn();
        }
      }
      if (me && (!me.done || me.simT - (me.finishT ?? 0) < 2.5)) chaseCam(dt, me);
      else watchLeader(dt);
    } else if (ph === 'roundEnd') {
      if (G.roundEndShown !== match.roundId) showRoundEnd();
      finishCam(dt);
    }

    // HUD
    if (ph !== 'roundEnd') {
      const rank = ranking();
      const myPlace = me ? rank.findIndex((r) => r.id === me.id) + 1 : 0;
      hud.place(Math.max(1, myPlace));
      hud.timer(me?.done ? me.finishT ?? G.raceT : G.raceT);
      const d = match.data;
      hud.lastCall(d?.first > 0 && racing ? Math.max(0, (d.first + RACE.lastCall * 1000 - match.elapsed) / 1000) : null);
      hud.line(
        rank.map((r) => ({ frac: r.t !== undefined ? 1 : Math.min(1, (r.a.prog ?? 0) / course.length), seat: r.a.seat, me: r.a.kind === 'me' })),
      );
      hud.showGauge(!!me && !me.done);
      if (me?.body) {
        hud.water(me.body.m, dt);
        audio.setLow(me.body.m < WATER.low && !me.done && racing);
        fx.halo(me.body.x, me.body.y - 0.16, me.body.z, false);
      }
      if (racing && me && !me.done) tipHints(me, G.raceT);
      else hud.hint('');
      if (!me || me.done) {
        const w = G.actors.get(G.watch);
        hud.watching(w && !me ? w.name : null, () => switchWatch(-1), () => switchWatch(1));
      }
    } else {
      hud.showGauge(false);
      hud.lastCall(null);
      hud.hint('');
      audio.setLow(false);
    }
    updateArc();
    updateWay(dt);
    G.view?.update(G.t);
    fx.update(dt);
    updateNameTags();
    sendPresence(G.round ?? 'race');
  }

  function watchLeader(dt) {
    let a = G.actors.get(G.watch);
    if (!a || a.done) {
      const rank = ranking().filter((r) => r.a !== G.me && !r.a.done);
      a = rank[0]?.a ?? [...G.actors.values()][0];
      G.watch = a?.id ?? null;
    }
    if (a) watchCam(dt, a);
    else if (G.me) chaseCam(dt, G.me);
  }

  // ---------------------------------------------------------------- the room (joined while the title shows)
  let room = null;
  let cup = null;
  let match = null;
  async function connect() {
    room = await joinRoom();
    G.room = room;
    const hooks = {
      courseLength: (id) => (COURSE_IDS.includes(id) ? getCourse(id).length : 150),
      botProgress() {
        const out = {};
        for (const a of G.actors.values()) if (a.kind === 'bot') out[a.id] = a.done ? 1e4 : a.prog;
        return out;
      },
      myProgress: () => (G.me ? G.me.prog : 0),
      // autoplay only (never in production): ?course=<id> runs that course first, for capturing footage
      firstCourse: () => (AUTOPLAY && COURSE_IDS.includes(params.get('course')) ? params.get('course') : null),
      onResume() {},
    };
    cup = createCup(room, hooks);
    G.cup = cup;
    match = cup.match;
    cup.botsState.on((v) => {
      if (!v || typeof v.rid !== 'string') return;
      const rows = new Map();
      for (const r of v.list) rows.set(r[0], r);
      G.snaps.push({ at: performance.now(), rid: v.rid, rows });
      if (G.snaps.length > 4) G.snaps.shift();
    });
    room.on('close', (reason) => {
      G.mode = 'closed';
      clearActors();
      hud.show(false);
      input.setWantLock(false);
      setControls(false);
      const text = reason === 'kicked' ? 'You were taken off this server.' : reason === 'replaced' ? 'This game is open in another tab.' : 'The connection to the server dropped.';
      const button = reason === 'kicked' ? 'Play' : reason === 'replaced' ? 'Play here' : 'Rejoin';
      screens.closed({ text, button, onClick: () => location.reload() });
      setFlow('closed');
    });
    match.on('results', (standings, mine) => {
      if (!mine) return;
      progress.data.races++;
      if (mine.place === 1) {
        progress.data.wins++;
        award('cup-champion');
      }
      progress.save();
    });
    if (G.mode === 'title') hideLobby(true);
    if (match.phase !== 'lobby' && match.phase !== 'countdown') enterMatch();
    else if (G.wantQuay || AUTOPLAY || AUTOPLAY_TO === 'lobby') toQuay();
  }

  // ---------------------------------------------------------------- go
  resize();
  toTitle();
  // tap-between-frames: a press of the Flop button that came and went is still a tap
  let lastPresses = 0;
  setInterval(() => {
    try {
      const n = ow?.controls?.presses?.('flop') ?? 0;
      if (n > lastPresses && !input.holding()) input.state.tap = true;
      lastPresses = n;
    } catch {}
  }, 16);
  requestAnimationFrame(frame);
  window.__fish = { G, stage, cam, progress, get match() { return match; }, get room() { return room; } };
  connect().catch((err) => {
    console.error(err);
    setTimeout(() => {
      throw err;
    });
  });
}
