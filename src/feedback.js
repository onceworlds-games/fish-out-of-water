// What your own fish's run feels like: the drops and golden scales it takes, the slaps it chains into Flow, near misses,
// the sun on its back, the slap ring under it in the air, and what the run adds up to (for the results and the Catch
// level). The page hands it your fish's events; it drives the HUD, the effects, the sound and a little slow motion.

import { predictFall } from './sim/body.js';
import { SLAP, FLOW, slapPower } from './sim/config.js';

export function createFeedback({ hud, fx, audio, cam }) {
  const run = blankRun();
  let view = null;
  let kept = [];
  let slow = 0; // seconds of slow motion left
  let slowK = 1;
  let dripStep = 0;
  let lastDripT = -9;
  let fallT = 0;
  let fall = null;
  const ringOpts = { dt: 1 / 60, maxT: 2.5 };

  function blankRun() {
    return { drops: 0, scales: [], chain: 0, bestChain: 0, slaps: 0, perfects: 0, springs: 0, close: 0, sunT: 0, t: 0 };
  }

  const api = {
    run,
    /** A new run on a course view: every pickup back, the counters to zero. `keptScales`: already collected there. */
    reset(courseView, keptScales = [], opts = {}) {
      Object.assign(run, blankRun());
      view = courseView;
      kept = keptScales.slice();
      view?.pickups?.reset(kept);
      slow = 0;
      dripStep = 0;
      fall = null;
      hud.drops(0);
      hud.flow(0);
      hud.sun(false);
      hud.scales(opts.scales === false || !view?.pickups ? null : [], kept);
      fx.slapRing(null);
    },
    /** One of my fish's events. `now`: the page clock (for the pickup animations). */
    event(a, e, now) {
      const b = a.body;
      switch (e.type) {
        case 'pick':
          view?.pickups?.take(e.i, now);
          if (e.kind === 'drop') {
            run.drops++;
            dripStep = now - lastDripT < 0.9 ? dripStep + 1 : 0;
            lastDripT = now;
            audio.drip(dripStep);
            hud.drops(run.drops, true);
            fx.burst(e.x, e.y, e.z, 7, 'splash', 0.45);
            fx.glint(e.x, e.y, e.z, 3, 0xbff4ff, 0.6);
          } else {
            if (!run.scales.includes(e.n)) run.scales.push(e.n);
            audio.scale();
            hud.scales(run.scales, kept, e.n);
            hud.stamp(kept.includes(e.n) ? 'Scale' : 'Golden scale!', 'gold');
            fx.glint(e.x, e.y, e.z, 22, 0xffd36a, 1.6);
            fx.shock(e.x, e.y - 0.3, e.z, 1.6, 0xffc93c, 0.5);
            cam.kick?.(4);
            slowMo(0.35, 0.3);
          }
          break;
        case 'flop':
          if (e.slap) {
            run.slaps++;
            run.chain = e.chain;
            if (e.chain > run.bestChain) run.bestChain = e.chain;
            if (e.perfect) run.perfects++;
            if (e.springy) run.springs++;
            audio.slapNote(e.chain, e.perfect);
            if (e.springy) audio.sproing();
            const mult = slapPower(e.chain, e.perfect) / SLAP.power;
            hud.flow(e.chain, mult, e.perfect);
            const y = b.y - 0.12;
            if (e.perfect) {
              hud.stamp(e.springy ? 'Perfect boing!' : 'Perfect!', 'gold');
              fx.shock(b.x, y, b.z, 1.5, 0xffc93c, 0.45);
              fx.glint(b.x, b.y, b.z, 10, 0xffe7a0, 1.1);
              slowMo(0.12, 0.35);
            } else {
              hud.stamp(e.springy ? 'Boing!' : e.chain >= FLOW.links ? 'Flow!' : 'Slap!', e.springy ? 'sea' : '');
              fx.shock(b.x, y, b.z, 1.05, 0x4cd3ec, 0.35);
            }
          } else if (run.chain > 0) {
            run.chain = 0;
            hud.flow(0);
          }
          break;
        case 'flowEnd':
          if (run.chain >= 3) audio.flowEnd(run.chain);
          run.chain = 0;
          hud.flow(0);
          break;
        case 'close':
          run.close++;
          audio.whoosh();
          hud.stamp('Close shave!', 'sea');
          slowMo(0.3, 0.3);
          break;
        case 'sun':
          hud.sun(e.on);
          break;
        case 'finish':
          slowMo(0.9, 0.3);
          fx.slapRing(null);
          hud.flow(0);
          break;
        case 'splashdown':
          fx.glint(e.x, e.y + 0.2, e.z, 14, 0xffffff, 1.4);
          break;
        case 'drain':
          hud.stamp('Down the drain!', 'red');
          break;
        case 'knock':
          hud.flow(0);
          run.chain = 0;
          break;
      }
    },
    /** Every frame: the slap ring under my fish while it's in the air, and the run's clock. */
    update(dt, a, world, twist, opts = {}) {
      const b = a?.body;
      if (!b || b.state !== 'ok' || opts.off) {
        fx.slapRing(null);
        fall = null;
        return;
      }
      if (opts.running) {
        run.t += dt;
        if (b.sun) run.sunT += dt;
      }
      const flying = !b.ground && b.airT > SLAP.minAir * 0.5 && b.t - b.contactT > 0.05;
      if (!flying) {
        fx.slapRing(null);
        fall = null;
        return;
      }
      // re-traced a few times a second (it's the same physics as the step, so it holds between traces)
      fallT -= dt;
      if (!fall || fallT <= 0) {
        fall = predictFall(b, world, twist, ringOpts);
        fallT = 0.08;
        fall.at = b.t;
      }
      if (!fall || !fall.surf || fall.t < 0.02) {
        fx.slapRing(null);
        return;
      }
      const left = fall.t - (b.t - fall.at);
      if (left < -SLAP.after) {
        fx.slapRing(null);
        return;
      }
      fx.slapRing(fall, Math.max(0, left), SLAP.before, !!b.holding && b.airT > SLAP.minAir);
    },
    /** The speed the world runs at now (slow motion after a scale, a perfect or a near miss); trials only. */
    timeScale(dt) {
      if (slow <= 0) return 1;
      slow -= dt;
      return slow > 0 ? slowK : 1;
    },
    /** What the run adds up to, for the results. */
    summary() {
      return { drops: run.drops, scales: run.scales.slice(), newScales: run.scales.filter((n) => !kept.includes(n)), bestChain: run.bestChain, perfects: run.perfects, slaps: run.slaps, springs: run.springs, close: run.close };
    },
  };

  function slowMo(seconds, k) {
    if (cam.reduced) return;
    slow = Math.max(slow, seconds);
    slowK = k;
  }

  return api;
}
