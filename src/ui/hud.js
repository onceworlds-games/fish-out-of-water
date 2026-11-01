// The race HUD: timer tag, place tag, last call, the fishing line of bobbers, the gill gauge, hints, callouts, the
// name tags pinned to fish, the watch tag, the race and cup standings, the trial's finish tag.

import { h, tag, keyCap, medalDisc, placeText, shapeSvg } from './dom.js';
import { fmtTime } from '../sim/race.js';
import { SEAT_COLOURS } from '../sim/config.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (name, attrs = {}) => {
  const el = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

export function createHud(root) {
  const el = h('div', { class: 'hud', hidden: true });
  root.append(el);

  // ---------------------------------------------------------------- top centre: timer + line
  const timerTag = tag([h('span', { class: 'tv' }, '0:00.0'), h('span', { class: 'split' })], { kind: '', swing: true, angle: 0 });
  const timerWrap = h('div', { class: 'hud-timer' }, timerTag);
  const tv = timerTag.querySelector('.tv');
  const splitEl = timerTag.querySelector('.split');
  const line = svg('svg', { class: 'hud-line', viewBox: '0 0 560 34', preserveAspectRatio: 'none' });
  line.append(svg('path', { d: 'M8 12 Q 270 22 528 12', fill: 'none', stroke: '#1a1d22', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.55 }));
  line.append(svg('path', { d: 'M8 12 Q 270 22 528 12', fill: 'none', stroke: '#f4efe6', 'stroke-width': 2, 'stroke-linecap': 'round' }));
  const wave = svg('path', { d: 'M522 20 q 7 -14 14 0 q 7 -14 14 0 q 5 -9 9 -2', fill: 'none', stroke: '#0b5cad', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const waveHi = svg('path', { d: 'M522 20 q 7 -14 14 0 q 7 -14 14 0 q 5 -9 9 -2', fill: 'none', stroke: '#4cd3ec', 'stroke-width': 2, 'stroke-linecap': 'round' });
  line.append(wave, waveHi);
  const bobbers = svg('g');
  line.append(bobbers);
  const top = h('div', { class: 'hud-top' }, timerWrap, line);

  // ---------------------------------------------------------------- top right: place, last call, medal target
  const placeTag = tag(placeText(1), { kind: 'red', angle: -3 });
  const placeWrap = h('div', { class: 'hud-place' }, placeTag);
  const lastTag = tag('Last call 0:60', { kind: 'slate', angle: 2 });
  const lastWrap = h('div', { class: 'hud-lastcall', hidden: true }, lastTag);
  const medalTag = tag([medalDisc('gold'), h('span', { class: 'mt' }, '0:50.0')], { kind: 'wash', angle: 2 });
  const medalWrap = h('div', { class: 'hud-medal', hidden: true }, medalTag);
  const right = h('div', { class: 'hud-right' }, placeWrap, lastWrap, medalWrap);

  // ---------------------------------------------------------------- the gill gauge: a glass fish of water
  const gauge = svg('svg', { class: 'gauge', viewBox: '0 0 170 64' });
  const defs = svg('defs');
  const clip = svg('clipPath', { id: 'fishclip' });
  const FISH_D = 'M18 32 C 30 8, 92 4, 124 22 L 154 6 C 148 22, 148 42, 154 58 L 124 42 C 92 60, 30 56, 18 32 Z';
  clip.append(svg('path', { d: FISH_D }));
  defs.append(clip);
  gauge.append(defs);
  gauge.append(svg('path', { d: FISH_D, fill: '#1a1d22', transform: 'translate(0 3)', opacity: 0.3 }));
  gauge.append(svg('path', { d: FISH_D, fill: '#f4efe6' }));
  const waterG = svg('g', { 'clip-path': 'url(#fishclip)' });
  const water = svg('path', { class: 'vial-water', fill: '#4cd3ec' });
  const waterDeep = svg('path', { fill: '#0b5cad', opacity: 0.35 });
  waterG.append(water, waterDeep);
  gauge.append(waterG);
  const crack = svg('path', { d: 'M70 14 l 6 9 l -5 6 l 8 10', fill: 'none', stroke: '#1a1d22', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0 });
  gauge.append(crack);
  gauge.append(svg('path', { d: FISH_D, fill: 'none', stroke: '#1a1d22', 'stroke-width': 4.5, 'stroke-linejoin': 'round' }));
  gauge.append(svg('circle', { cx: 40, cy: 27, r: 5, fill: '#1a1d22' }));
  gauge.append(svg('circle', { cx: 41.5, cy: 25.5, r: 1.6, fill: '#f4efe6' }));
  gauge.append(svg('path', { d: 'M30 14 C 50 9, 80 9, 100 15', fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.7 }));

  const hint = h('div', { class: 'hint float', hidden: true });
  const callout = h('div', { class: 'callout' });
  const card = h('div', { class: 'course-card', hidden: true });
  const watch = h('div', { class: 'watching', hidden: true });
  const extra = h('div', { class: 'hud-extra' });

  el.append(top, right, gauge, hint, card, watch, extra, callout);

  // ---------------------------------------------------------------- name tags (outside the HUD: they show in the lobby too)
  const tagsLayer = h('div', { class: 'nametags' });
  root.prepend(tagsLayer);
  const nameTags = new Map();

  let waterShown = -1;
  let wavePhase = 0;
  let calloutT = 0;
  let hintText = '';
  const api = {
    el,
    show(on, opts = {}) {
      el.hidden = !on;
      placeWrap.hidden = !!opts.trial;
      line.style.display = opts.trial ? 'none' : '';
      medalWrap.hidden = !opts.trial;
      if (!on) {
        lastWrap.hidden = true;
        api.hint('');
        watch.hidden = true;
        extra.replaceChildren();
      }
    },
    showGauge(on) {
      gauge.style.display = on ? '' : 'none';
    },
    timer(seconds, split = null) {
      tv.textContent = fmtTime(seconds);
      if (split === null) splitEl.textContent = '';
      else splitEl.textContent = `${split > 0 ? '+' : '−'}${Math.abs(split).toFixed(1)}`;
    },
    place(n) {
      if (placeTag.dataset.n === String(n)) return;
      placeTag.dataset.n = String(n);
      placeTag.tagEl.replaceChildren(placeText(n));
    },
    lastCall(seconds) {
      lastWrap.hidden = seconds === null;
      if (seconds !== null) lastTag.tagEl.textContent = `Last call ${fmtTime(Math.max(0, seconds), false)}`;
    },
    medalTarget(next) {
      medalWrap.hidden = !next;
      if (next) {
        medalTag.tagEl.replaceChildren(medalDisc(next.medal), h('span', {}, fmtTime(next.time)));
      }
    },
    /** list: [{ frac 0..1, seat, me, done }] */
    line(list) {
      while (bobbers.childNodes.length < list.length) {
        const g = svg('g');
        g.innerHTML = '';
        bobbers.append(g);
      }
      while (bobbers.childNodes.length > list.length) bobbers.lastChild.remove();
      list.forEach((b, i) => {
        const g = bobbers.childNodes[i];
        const key = `${b.seat.shape}${b.seat.hex}${b.me ? 1 : 0}`;
        if (g.dataset.k !== key) {
          g.dataset.k = key;
          const s = b.me ? 20 : 14;
          g.innerHTML = `<line x1="0" y1="-10" x2="0" y2="0" stroke="#f4efe6" stroke-width="1.5"/><g transform="translate(${-s / 2} ${-s / 2 + 2})">${shapeSvg(b.seat.shape, b.seat.hex, s)}</g>`;
        }
        const x = 8 + Math.max(0, Math.min(1, b.frac)) * 520;
        const t = (x - 8) / 520;
        const y = 12 + 10 * 2 * t * (1 - t) * 2 * 0.5 + (b.me ? 0 : 0);
        g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        if (b.me) bobbers.append(g); // mine on top
      });
    },
    water(m, dt = 0) {
      wavePhase += dt * 5;
      const k = Math.max(0, Math.min(1, m / 100));
      const lvl = 58 - k * 52;
      const a = 2.2;
      let d = `M0 ${lvl}`;
      for (let x = 0; x <= 170; x += 10) d += ` L${x} ${(lvl + Math.sin(wavePhase + x * 0.09) * a).toFixed(1)}`;
      d += ' L170 70 L0 70 Z';
      water.setAttribute('d', d);
      waterDeep.setAttribute('d', `M0 ${lvl + 12} L170 ${lvl + 12} L170 70 L0 70 Z`);
      const low = m < 35;
      if (low !== waterShown) {
        waterShown = low;
        gauge.classList.toggle('low', low);
        crack.setAttribute('opacity', low ? 0.8 : 0);
      }
    },
    hint(text) {
      if (text === hintText) return;
      hintText = text;
      hint.hidden = !text;
      hint.textContent = text;
    },
    /** A big tag in the middle for a moment: 3, 2, 1, Flop!, SPLASH!, Dried out! */
    callout(text, opts = {}) {
      callout.replaceChildren(tag(text, { kind: opts.kind ?? '', swing: false }));
      callout.classList.remove('pop');
      void callout.offsetWidth;
      callout.classList.add('pop');
      callout.hidden = false;
      calloutT = opts.seconds ?? 0.9;
    },
    courseCard(name, sub) {
      card.hidden = !name;
      if (name) card.replaceChildren(tag(name, { kind: 'wash', angle: -2 }), sub ? h('span', { class: 'float' }, sub) : null);
    },
    watching(name, onPrev, onNext) {
      watch.hidden = !name;
      if (!name) return;
      if (watch.dataset.n === name) return;
      watch.dataset.n = name;
      watch.replaceChildren(
        h(
          'div',
          { class: 'row-tags' },
          tag('‹', { kind: 'wash', onclick: onPrev, swing: false, label: 'Previous fish' }),
          tag(`Watching ${name}`, { kind: 'slate', swing: false }),
          tag('›', { kind: 'wash', onclick: onNext, swing: false, label: 'Next fish' }),
        ),
      );
    },
    /** The trial's finish: time, medal stamp, new best, then Retry / Next / Back. */
    trialEnd(info, actions) {
      const kids = [h('div', { class: 'time' }, tag([info.medal ? medalDisc(info.medal) : null, fmtTime(info.time)], { kind: info.medal ? '' : 'wash', angle: -3 }))];
      const notes = [];
      if (info.newMedal) notes.push(h('div', { class: 'stamp' }, `${info.newMedal[0].toUpperCase()}${info.newMedal.slice(1)}!`));
      else if (info.newBest) notes.push(h('div', { class: 'stamp' }, 'New best'));
      if (info.split !== null && info.split !== undefined && !info.newBest) notes.push(h('div', { class: 'float', style: 'font-size:24px' }, `${info.split > 0 ? '+' : '−'}${Math.abs(info.split).toFixed(1)} on your best`));
      if (info.unlocked) notes.push(h('div', { class: 'float', style: 'font-size:26px' }, info.unlocked));
      const row = h(
        'div',
        { class: 'row-tags' },
        tag(['Retry', keyCap('R')], { kind: 'red', onclick: actions.retry, angle: -2 }),
        actions.next ? tag('Next course', { onclick: actions.next, angle: 2 }) : null,
        tag('Back', { kind: 'wash', onclick: actions.back, angle: -1 }),
      );
      extra.replaceChildren(h('div', { class: 'trial-end' }, ...kids, ...notes, row));
    },
    clearExtra() {
      extra.replaceChildren();
    },
    /** rows: [{ place, name, seat, time|null, dist|null, pts, total, me, gone }] */
    standings(head, rows, opts = {}) {
      const list = h('div', { class: 'standings' });
      rows.forEach((r, i) => {
        const t = tag(
          [
            h('span', { class: 'pl' }, String(r.place)),
            h('span', { class: 'pin' }),
            h('span', { class: 'nm' }, r.name),
            h('span', { class: 'tm' }, r.time !== null && r.time !== undefined ? fmtTime(r.time) : r.dist !== null && r.dist !== undefined ? `${Math.round(r.dist)} m` : ''),
            h('span', { class: 'pts' }, r.pts !== undefined ? (opts.total ? String(r.total) : `+${r.pts}`) : ''),
          ],
          { kind: r.me ? '' : r.place === 1 ? 'red' : 'wash', swing: false },
        );
        t.querySelector('.pin').innerHTML = shapeSvg(r.seat?.shape, r.seat?.hex ?? '#fff', 14);
        t.classList.add('row-in');
        t.style.animationDelay = `${(opts.stagger ?? 0.08) * i}s`;
        if (r.gone) t.style.opacity = 0.55;
        list.append(t);
      });
      const headEl = head ? h('div', { class: 'results-head' }, tag(head, { kind: 'slate', angle: -1 })) : null;
      extra.replaceChildren(...[headEl, list, opts.foot ? h('div', { class: 'results-foot' }, opts.foot) : null].filter(Boolean));
    },
    /** Name tags: list of { id, name, seat, sx, sy, on, me, gone } in screen pixels. */
    nameTags(list) {
      const seen = new Set();
      for (const n of list) {
        seen.add(n.id);
        let e = nameTags.get(n.id);
        if (!e) {
          const t = tag([h('span', { class: 'pin' }), h('span', { class: 'nt' })], { kind: 'wash', swing: false });
          e = { el: h('div', { class: 'nametag' }, t), name: '', key: '' };
          tagsLayer.append(e.el);
          nameTags.set(n.id, e);
        }
        const key = `${n.seat?.shape}${n.seat?.hex}`;
        if (e.key !== key) {
          e.key = key;
          e.el.querySelector('.pin').innerHTML = shapeSvg(n.seat?.shape, n.seat?.hex ?? '#fff', 12);
        }
        if (e.name !== n.name) {
          e.name = n.name;
          e.el.querySelector('.nt').textContent = n.name;
        }
        e.el.classList.toggle('me', !!n.me);
        e.el.classList.toggle('gone', !!n.gone);
        e.el.hidden = !n.on;
        if (n.on) e.el.style.transform = `translate(${n.sx.toFixed(1)}px, ${n.sy.toFixed(1)}px) rotate(${(n.tilt ?? -8).toFixed(1)}deg)`;
      }
      for (const [id, e] of nameTags) {
        if (!seen.has(id)) {
          e.el.remove();
          nameTags.delete(id);
        }
      }
    },
    update(dt) {
      if (calloutT > 0) {
        calloutT -= dt;
        if (calloutT <= 0) callout.replaceChildren();
      }
    },
  };
  return api;
}

export { SEAT_COLOURS };
