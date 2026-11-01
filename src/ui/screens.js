// The screens over the Quay: the title, the lobby's tags, the time-trial board, the fish picker, the daily catch, the
// pause card and the closed-room card. Each replaces what was in the screen layer; the race HUD lives in hud.js.

import { h, tag, keyCap, medalDisc, pin } from './dom.js';
import { fmtTime } from '../sim/race.js';

export function createScreens(root) {
  const layer = h('div', { class: 'screen' });
  root.append(layer);
  let current = null;
  const set = (name, ...kids) => {
    current = name;
    layer.replaceChildren(...kids);
    layer.dataset.screen = name ?? '';
  };

  const api = {
    get current() {
      return current;
    },
    clear() {
      set(null);
    },

    title({ tally, onPlay }) {
      const word = h(
        'div',
        { class: 'wordmark', role: 'heading', 'aria-level': 1 },
        h('span', { class: 'row' }, 'FISH'),
        h('span', { class: 'row' }, h('span', { class: 'small' }, 'OUT OF')),
        h('span', { class: 'row' }, 'WATER'),
      );
      const play = h('div', { class: 'play' }, tag(['Play', keyCap('Space')], { kind: 'red', onclick: onPlay, angle: -3 }));
      const kids = [word, play];
      if (tally && tally.gold + tally.silver + tally.bronze > 0) {
        kids.push(
          h(
            'div',
            { class: 'tally' },
            ...['gold', 'silver', 'bronze'].map((k) => h('span', {}, medalDisc(k), String(tally[k]))),
          ),
        );
      }
      set('title', h('div', { class: 'title' }, ...kids));
    },

    /** The Quay: cup tag, seats on a line, the solo tags. */
    quay(o) {
      const left = h(
        'div',
        { class: 'quay-left' },
        tag('Time Trials', { onclick: o.onTrials, angle: -2 }),
        tag(['Daily Catch', h('small', {}, o.dailyName)], { kind: 'spray', onclick: o.onDaily }),
        tag(['Fish', h('small', {}, o.fishName)], { kind: 'wash', onclick: o.onFish }),
      );
      const cup = h('div', { class: 'cup' });
      const seats = h('div', { class: 'seats' });
      const hint = h('div', { class: 'hint-lobby float' }, o.hint ?? '');
      set('quay', left, cup, seats, hint);
      api.quayUpdate(o);
    },
    quayUpdate(o) {
      if (current !== 'quay') return;
      const cup = layer.querySelector('.cup');
      const seats = layer.querySelector('.seats');
      const hint = layer.querySelector('.hint-lobby');
      const cupKey = `${o.cupName}|${o.races}|${o.canChange}`;
      if (cup.dataset.k !== cupKey) {
        cup.dataset.k = cupKey;
        cup.replaceChildren(tag([o.cupName, h('small', {}, o.races === 1 ? '1 race' : `${o.races} races`)], { kind: 'slate', onclick: o.canChange ? o.onCup : null, angle: 1 }));
      }
      const seatKey = JSON.stringify(o.seats.map((s) => [s.name, s.ready, s.host, s.me])) + o.bots;
      if (seats.dataset.k !== seatKey) {
        seats.dataset.k = seatKey;
        seats.replaceChildren(
          ...o.seats.map((s) =>
            tag([pin(s.colour), h('span', {}, s.name), s.ready ? h('span', { class: 'tick' }, '✓') : h('span', {})], { kind: s.me ? '' : 'wash', swing: false }),
          ),
          o.bots > 0 ? h('div', { class: 'more float' }, `+${o.bots} fish`) : null,
          o.onInvite ? tag('Invite', { kind: 'spray', onclick: o.onInvite, swing: false }) : null,
        );
      }
      if (hint.textContent !== (o.hint ?? '')) hint.textContent = o.hint ?? '';
    },

    /** Time trials: one tag per course, spiked in the ice. */
    trials({ courses, onPick, onBack }) {
      const board = h(
        'div',
        { class: 'board' },
        ...courses.map((c, i) =>
          tag(
            [
              h('span', { class: 'what' }, c.name, h('small', {}, c.open ? (c.best ? `Best ${fmtTime(c.best)}` : 'No time yet') : c.lockText)),
              c.open ? medalDisc(c.medal) : h('span', { class: 'cond' }, 'Locked'),
            ],
            { kind: c.open ? (i % 2 ? 'wash' : '') : 'locked', onclick: c.open ? () => onPick(c.id) : null, angle: i % 2 ? 1.5 : -1.5 },
          ),
        ),
      );
      set('trials', h('div', { class: 'sheet' }, h('h2', {}, 'Time Trials'), board, h('div', { class: 'row-tags' }, tag(['Back', keyCap('Esc')], { kind: 'wash', onclick: onBack }))));
    },

    /** Daily catch: today's course and twist, your best today, Play. */
    daily({ courseName, twistName, best, top, onPlay, onBack }) {
      const lines = [h('div', { class: 'big-line float' }, `${courseName}, ${twistName.toLowerCase()}`)];
      if (best) lines.push(h('div', { class: 'big-line float' }, `Your best today ${fmtTime(best)}`));
      if (top?.length) lines.push(h('div', { class: 'big-line float', style: 'font-size:21px' }, top.map((e, i) => `${i + 1}. ${e.name} ${fmtTime(e.score)}`).join('   ')));
      set(
        'daily',
        h(
          'div',
          { class: 'sheet' },
          h('h2', {}, 'Daily Catch'),
          ...lines,
          h('div', { class: 'row-tags' }, tag(['Play', keyCap('Space')], { kind: 'red', onclick: onPlay, angle: -2 }), tag(['Back', keyCap('Esc')], { kind: 'wash', onclick: onBack })),
        ),
      );
    },

    /** The fish picker: five fish, three colours each; locked ones say how to earn them. */
    fish({ fish, chosen, cw, onPick, onColour, onBack, colours }) {
      const list = h(
        'div',
        { class: 'fishes' },
        ...fish.map((f, i) =>
          tag(f.unlocked ? f.name : [f.name, h('small', {}, f.lockText)], {
            kind: f.unlocked ? (f.id === chosen ? 'on' : i % 2 ? 'wash' : '') : 'locked',
            onclick: f.unlocked ? () => onPick(f.id) : null,
            angle: i % 2 ? 2 : -2,
          }),
        ),
      );
      list.querySelectorAll('.tag').forEach((t, i) => {
        if (fish[i].id === chosen) t.classList.add('on');
        if (!fish[i].unlocked) t.classList.add('locked');
      });
      const sw = h(
        'div',
        { class: 'colours', 'data-ui': '' },
        ...colours.map((c, i) => h('button', { class: i === cw ? 'on' : '', style: `background:${c}`, 'aria-label': `Colour ${i + 1}`, onclick: () => onColour(i) })),
      );
      set('fish', h('div', { class: 'sheet', style: 'justify-content:flex-end' }, list, sw, h('div', { class: 'row-tags' }, tag(['Done', keyCap('Esc')], { kind: 'red', onclick: onBack }))));
    },

    pause({ onResume, onRetry, onPuddle, onQuit }) {
      set(
        'pause',
        h(
          'div',
          { class: 'pause', 'data-ui': '' },
          tag(['Resume', keyCap('Esc')], { kind: 'red', onclick: onResume, angle: -2 }),
          tag(['Retry', keyCap('R')], { onclick: onRetry, angle: 1 }),
          onPuddle ? tag('Back to the last puddle', { kind: 'spray', onclick: onPuddle, angle: -1 }) : null,
          tag('Quit to the Quay', { kind: 'wash', onclick: onQuit, angle: 2 }),
        ),
      );
    },

    closed({ text, button, onClick }) {
      set('closed', h('div', { class: 'closed', 'data-ui': '' }, h('div', { class: 'float' }, text), button ? tag(button, { kind: 'red', onclick: onClick }) : null));
    },
  };
  return api;
}
