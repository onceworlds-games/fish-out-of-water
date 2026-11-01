// The locker: your fish and its colours, hats, trails and splashes, as cards down the left of the screen while your fish
// turns in the close-up beside them. Owned things put on with a tap; locked ones say the level or the feat that gives
// them; things a new level just gave are marked New.

import { h, tag, keyCap } from './dom.js';

const TABS = [
  ['fish', 'Fish'],
  ['hat', 'Hats'],
  ['trail', 'Trails'],
  ['splash', 'Splashes'],
];

// drawn icons for the trails (laid along a flight arc) and the splashes
const ARC = [
  [8, 38],
  [15, 27],
  [23, 19],
  [32, 14],
  [41, 12],
];
const along = (fn) => ARC.map(([x, y], i) => fn(x, y, i)).join('');
const TRAIL_SVG = {
  drips: along((x, y, i) => `<path d="M${x} ${y - 4}c2 3 3.5 4.6 3.5 6.4a3.5 3.5 0 0 1-7 0c0-1.8 1.5-3.4 3.5-6.4z" fill="#7fe6f6" stroke="#1a1d22" stroke-width="1.6" transform="scale(${1 - i * 0.08})" transform-origin="${x} ${y}"/>`),
  bubbles: along((x, y, i) => `<circle cx="${x}" cy="${y}" r="${4.4 - i * 0.55}" fill="rgba(191,244,255,.35)" stroke="#e8fbff" stroke-width="1.8"/><circle cx="${x - 1.4}" cy="${y - 1.4}" r="1" fill="#fff"/>`),
  sparkle: along((x, y, i) => `<path d="M${x} ${y - 5.5}l1.3 4.2 4.2 1.3-4.2 1.3-1.3 4.2-1.3-4.2-4.2-1.3 4.2-1.3z" fill="${i % 2 ? '#fff' : '#ffe27a'}" stroke="#1a1d22" stroke-width="1.1" transform="scale(${1 - i * 0.1})" transform-origin="${x} ${y}"/>`),
  confetti: along((x, y, i) => `<rect x="${x - 2.6}" y="${y - 1.6}" width="5.2" height="3.2" rx=".6" fill="${['#e4432d', '#ffc93c', '#4cd3ec', '#7ac85a', '#b98ae8'][i]}" stroke="#1a1d22" stroke-width="1" transform="rotate(${i * 47 - 30} ${x} ${y})"/>`),
  ink: along((x, y, i) => `<path d="M${x - 4} ${y}c0-3 3-4.4 5-3.6 2.6 1 3.6 3.4 2.2 5.4-1.6 2.2-4.6 2.2-6 .6-.8-.8-1.2-1.6-1.2-2.4z" fill="${i % 2 ? '#3a2350' : '#1d1530'}" transform="scale(${1 - i * 0.09})" transform-origin="${x} ${y}"/>`),
  rainbow: `<g fill="none" stroke-linecap="round" stroke-width="3.2">${['#e4432d', '#ff9a2e', '#ffd23a', '#58c85a', '#3aa8ec', '#8a5ae8'].map((c, i) => `<path d="M6 ${41 - i * 0} Q 22 ${8 + i * 3.4} 44 ${12 + i * 3.2}" stroke="${c}" transform="translate(0 ${i * 3.1 - 8})"/>`).join('')}</g>`,
  gold: along((x, y, i) => `<path d="M${x - 3.6} ${y - 1}l3-3.4 4 1.4.6 3.6-3.4 2.6-3.6-1z" fill="${i % 2 ? '#ffe27a' : '#e8b931'}" stroke="#7a5212" stroke-width="1.1" transform="rotate(${i * 38} ${x} ${y})"/>`),
};
const SPLASH_SVG = {
  plain: '<path d="M8 38c4-1 6-6 8-12 1 6 3 9 5 10 1-8 3-14 6-18 1 7 2 12 5 15 2-4 4-6 6-7-1 5 0 9 2 12z" fill="#7fe6f6" stroke="#1a1d22" stroke-width="2" stroke-linejoin="round"/><circle cx="14" cy="17" r="2.2" fill="#bff4ff" stroke="#1a1d22" stroke-width="1.4"/><circle cx="36" cy="13" r="1.8" fill="#bff4ff" stroke="#1a1d22" stroke-width="1.4"/><path d="M4 40h40" stroke="#0b5cad" stroke-width="3" stroke-linecap="round"/>',
  crown: '<path d="M7 38 9 20l6 9 4-15 5 13 5-13 4 15 6-9 2 18z" fill="#7fe6f6" stroke="#1a1d22" stroke-width="2" stroke-linejoin="round"/><circle cx="9" cy="16" r="2" fill="#fff" stroke="#1a1d22" stroke-width="1.3"/><circle cx="19" cy="10" r="2" fill="#fff" stroke="#1a1d22" stroke-width="1.3"/><circle cx="29" cy="10" r="2" fill="#fff" stroke="#1a1d22" stroke-width="1.3"/><circle cx="39" cy="16" r="2" fill="#fff" stroke="#1a1d22" stroke-width="1.3"/><path d="M4 40h40" stroke="#0b5cad" stroke-width="3" stroke-linecap="round"/>',
  fireworks: `<g stroke-linecap="round" stroke-width="2.4">${Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    const c = ['#e4432d', '#ffc93c', '#4cd3ec', '#b98ae8', '#7ac85a'][i % 5];
    return `<path d="M${24 + Math.cos(a) * 6} ${20 + Math.sin(a) * 6}L${24 + Math.cos(a) * 15} ${20 + Math.sin(a) * 15}" stroke="${c}"/>`;
  }).join('')}</g><circle cx="24" cy="20" r="3" fill="#fff" stroke="#1a1d22" stroke-width="1.5"/><path d="M14 42h20" stroke="#0b5cad" stroke-width="3" stroke-linecap="round"/>`,
  geyser: '<path d="M19 42c1-10 2-22 1-32 2-3 6-3 8 0-1 10 0 22 1 32z" fill="#7fe6f6" stroke="#1a1d22" stroke-width="2" stroke-linejoin="round"/><path d="M14 12c3-6 7-8 10-8s7 2 10 8" fill="none" stroke="#bff4ff" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="18" r="2" fill="#bff4ff" stroke="#1a1d22" stroke-width="1.3"/><circle cx="36" cy="18" r="2" fill="#bff4ff" stroke="#1a1d22" stroke-width="1.3"/><path d="M6 42h36" stroke="#0b5cad" stroke-width="3" stroke-linecap="round"/>',
  whale: '<path d="M6 40c6-3 10-8 12-14 3 5 8 7 14 7 4 0 7-2 10-5-1 6-5 12-12 13z" fill="#3f6f9a" stroke="#1a1d22" stroke-width="2" stroke-linejoin="round"/><path d="M28 22c0-6 0-10-1-14M28 10c-3-3-7-4-10-3M28 10c3-3 7-4 10-3" fill="none" stroke="#7fe6f6" stroke-width="2.6" stroke-linecap="round"/><circle cx="17" cy="9" r="1.8" fill="#bff4ff"/><circle cx="39" cy="9" r="1.8" fill="#bff4ff"/>',
};
const PADLOCK = '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="2.5" y="7" width="11" height="8" rx="1.6" fill="#595650"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="#595650" stroke-width="2"/></svg>';

function svg(inner) {
  const el = h('span', { class: 'ic-svg' });
  el.innerHTML = `<svg viewBox="0 0 48 48" width="56" height="56">${inner}</svg>`;
  return el;
}

/**
 * o: { tab, level: { level, into, need }, streak, fish: [{ id, name, unlocked, lockText }], chosen, cw,
 * colours: [{ back, belly, owned, howTo }], items: { hat|trail|splash: [{ id, name, owned, worn, howTo, isNew }] },
 * newTabs: { hat: true, ... }, thumbs: { hat(id), fish(id, cw) }, onTab, onFish, onColour, onWear(slot, id), onBack }
 */
export function buildLocker(o) {
  const panel = h('div', { class: 'locker', 'data-ui': '' });
  const lv = o.level;
  panel.append(
    h(
      'div',
      { class: 'lk-head' },
      h('h2', {}, 'Locker'),
      h(
        'div',
        { class: 'lk-level' },
        h('span', { class: 'lv' }, h('small', {}, 'Level'), String(lv.level)),
        h('span', { class: 'bar' }, h('span', { class: 'fill', style: `width:${((lv.into / lv.need) * 100).toFixed(1)}%` }), h('span', { class: 'bt' }, `${lv.into} / ${lv.need}`)),
        o.streak ? h('span', { class: 'streak' }, String(o.streak)) : null,
      ),
    ),
  );
  const tabs = h(
    'div',
    { class: 'lk-tabs', role: 'tablist' },
    ...TABS.map(([id, label]) =>
      h('button', { class: `lk-tab ${o.tab === id ? 'on' : ''}`, type: 'button', role: 'tab', 'aria-selected': o.tab === id ? 'true' : 'false', onclick: () => o.onTab(id) }, label, o.newTabs?.[id] ? h('i', { class: 'dot' }) : null),
    ),
  );
  panel.append(tabs);
  const grid = h('div', { class: `lk-grid lk-${o.tab}` });
  if (o.tab === 'fish') {
    o.fish.forEach((f) => {
      const url = f.unlocked ? o.thumbs?.fish(f.id, f.id === o.chosen ? o.cw : 0) : '';
      grid.append(card({ name: f.name, owned: f.unlocked, worn: f.id === o.chosen, howTo: f.lockText, pic: url ? h('img', { src: url, alt: '' }) : h('span', { class: 'ic-none' }, '?'), onclick: () => o.onFish(f.id) }));
    });
    const sw = h(
      'div',
      { class: 'lk-colours' },
      ...o.colours.map((c, i) =>
        h(
          'button',
          {
            type: 'button',
            class: `${i === o.cw ? 'on' : ''} ${c.owned ? '' : 'locked'} ${c.isNew ? 'new' : ''}`,
            style: `--a:${c.back};--b:${c.belly}`,
            'aria-label': c.owned ? `Colours ${i + 1}` : `Colours ${i + 1}, ${c.howTo}`,
            onclick: c.owned ? () => o.onColour(i) : null,
          },
          c.owned ? null : h('small', {}, c.howTo.replace('Level ', 'Lv ')),
        ),
      ),
    );
    panel.append(grid, h('div', { class: 'lk-sub' }, 'Colours'), sw);
  } else {
    for (const it of o.items[o.tab]) {
      const pic = o.tab === 'hat' ? (it.id === 'none' ? h('span', { class: 'ic-none' }, '—') : imgOr(o.thumbs?.hat(it.id))) : svg((o.tab === 'trail' ? TRAIL_SVG : SPLASH_SVG)[it.id] ?? '');
      grid.append(card({ ...it, pic, onclick: () => o.onWear(o.tab, it.id) }));
    }
    panel.append(grid);
  }
  panel.append(h('div', { class: 'row-tags lk-actions' }, tag(['Done', keyCap('Esc')], { kind: 'red', onclick: o.onBack, angle: -2 })));
  return panel;
}

function imgOr(url) {
  return url ? h('img', { src: url, alt: '' }) : h('span', { class: 'ic-none' }, '');
}

function card({ name, owned, worn, howTo, isNew, pic, onclick }) {
  const el = h(
    'button',
    { type: 'button', class: `lk-card ${owned ? 'owned' : 'locked'} ${worn ? 'worn' : ''} ${isNew ? 'new' : ''}`, 'aria-pressed': worn ? 'true' : 'false', onclick: owned ? onclick : null },
    h('span', { class: 'pic' }, pic),
    h('span', { class: 'nm' }, name),
    owned ? null : h('span', { class: 'how' }, howTo),
    isNew ? h('span', { class: 'new-tag' }, 'New') : null,
  );
  if (!owned) {
    const lock = h('span', { class: 'lock' });
    lock.innerHTML = PADLOCK;
    el.append(lock);
  }
  return el;
}
