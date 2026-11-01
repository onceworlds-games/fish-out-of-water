// The run card: what a run added up to, counted up line by line, the Catch level bar filling (and rolling over), what a
// new level gives, the day's goals ticking off, then the buttons. Skippable: a click or a key jumps to the end.

import { h, tag, keyCap, medalDisc } from './dom.js';
import { fmtTime } from '../sim/race.js';

const SLOT_WORD = { hat: 'Hat', trail: 'Trail', splash: 'Splash', colourway: 'Colours' };

/**
 * head: { time, medal, place, note, sub } (what the run was); run: { drops, scales (numbers), kept, bestChain, perfects };
 * gain: progress.addRun's result; goals: progress.goals() after the run; streak: { n }; actions: [{ text, key, kind,
 * onclick }]. audio: for the ticks.
 */
export function runCard({ head, run, gain, goals, streak, actions, audio }) {
  const card = h('div', { class: 'run-card', 'data-ui': '' });
  const colA = h('div', { class: 'rc-col' });
  const colB = h('div', { class: 'rc-col' });
  card.append(colA, colB);
  // the head: time and medal, or the place
  const top = h('div', { class: 'rc-head' });
  if (head.place) top.append(tag(head.placeText ?? `${head.place}`, { kind: head.place === 1 ? 'red' : '', angle: -3 }));
  if (head.time !== null && head.time !== undefined) top.append(tag([head.medal ? medalDisc(head.medal) : null, fmtTime(head.time)], { kind: head.medal ? '' : 'wash', angle: head.place ? 2 : -3 }));
  if (top.childNodes.length) colA.append(top);
  if (head.note) colA.append(h('div', { class: 'stamp' }, head.note));
  if (head.sub) colA.append(h('div', { class: 'rc-sub float' }, head.sub));

  // the run in icons
  if (run) {
    const icons = h('div', { class: 'rc-icons' });
    icons.append(h('span', { class: 'ic drop' }, h('i'), String(run.drops ?? 0)));
    if (run.scales) {
      const sc = h('span', { class: 'ic scales' });
      for (let i = 0; i < 3; i++) sc.append(h('i', { class: run.scales.includes(i) ? 'got' : run.kept?.includes(i) ? 'kept' : '' }));
      icons.append(sc);
    }
    icons.append(h('span', { class: 'ic flow' }, 'Flow', h('b', {}, `×${run.bestChain ?? 0}`)));
    if (run.perfects) icons.append(h('span', { class: 'ic perfect' }, 'Perfect', h('b', {}, `×${run.perfects}`)));
    colA.append(icons);
  }

  // XP lines, the level bar
  const lines = h('div', { class: 'rc-lines' });
  const total = h('span', { class: 'n' }, '+0');
  const lvlNum = h('span', { class: 'lv' }, String(gain.before.level));
  const fill = h('span', { class: 'fill' });
  const barText = h('span', { class: 'bt' }, '');
  const bar = h('div', { class: 'rc-level' }, h('span', { class: 'lab' }, 'Catch level', lvlNum), h('span', { class: 'bar' }, fill, barText), h('span', { class: 'xp' }, total, ' XP'));
  const rewards = h('div', { class: 'rc-rewards' });
  colA.append(lines);
  colB.append(bar, rewards);

  // goals
  let goalRows = [];
  if (goals?.length) {
    const box = h('div', { class: 'rc-goals' }, h('div', { class: 'gh' }, 'Today', streak?.n ? h('span', { class: 'streak' }, `${streak.n} day${streak.n === 1 ? '' : 's'}`) : null));
    goalRows = goals.map((g) => {
      const just = gain.goalsDone.some((d) => d.id === g.id);
      const row = h('div', { class: `goal ${g.done && !just ? 'done' : ''}` }, h('span', { class: 'box' }), h('span', { class: 'gt' }, g.text), h('span', { class: 'gn' }, g.need > 1 ? `${Math.min(g.have, g.need)}/${g.need}` : ''));
      box.append(row);
      return { row, just };
    });
    colB.append(box);
  }
  const row = h('div', { class: 'row-tags rc-actions' }, ...actions.map((a, i) => tag(a.key ? [a.text, keyCap(a.key)] : a.text, { kind: a.kind ?? (i === 0 ? 'red' : 'wash'), onclick: a.onclick, angle: i % 2 ? 1.5 : -2 })));
  colB.append(row);

  // the count-up
  const timers = [];
  let finished = false;
  const at = (s, fn) => timers.push(setTimeout(() => !finished && fn(), s * 1000));
  let shownXp = 0;
  let level = gain.before.level;
  let into = gain.before.into;
  let need = gain.before.need;
  const setBar = () => {
    lvlNum.textContent = String(level);
    fill.style.width = `${Math.min(100, (into / need) * 100).toFixed(1)}%`;
    barText.textContent = `${into} / ${need}`;
    total.textContent = `+${shownXp}`;
  };
  setBar();
  const toNext = (l) => 150 + 50 * (l - 1);
  const addXp = (n) => {
    shownXp += n;
    into += n;
    while (into >= need) {
      into -= need;
      level++;
      need = toNext(level);
      levelUp(level);
    }
    setBar();
  };
  const levelUp = (l) => {
    audio?.levelUp?.();
    bar.classList.remove('up');
    void bar.offsetWidth;
    bar.classList.add('up');
    const got = gain.rewards.filter((r) => r.level === l);
    for (const r of got) rewards.append(h('div', { class: 'reward' }, h('span', { class: 'rw' }, SLOT_WORD[r.slot] ?? ''), r.name));
    if (!got.length) rewards.append(h('div', { class: 'reward' }, `Level ${l}`));
  };
  let t = 0.5;
  const lineAt = new Map();
  for (const [label, xp] of gain.lines) {
    lineAt.set(label, t);
    const line = h('div', { class: 'line' }, h('span', {}, label), h('b', {}, `+${xp}`));
    at(t, () => {
      lines.append(line);
      // count it into the bar in a few ticks
      const steps = Math.min(8, Math.max(2, Math.ceil(xp / 15)));
      let left = xp;
      for (let i = 0; i < steps; i++) {
        const n = i === steps - 1 ? left : Math.floor(xp / steps);
        left -= n;
        at(0.0001 + i * 0.035, () => {
          addXp(n);
          audio?.tick?.(i / steps);
        });
      }
    });
    t += label.startsWith('Goal') ? 0.5 : 0.28;
  }
  goals?.forEach((g, i) => {
    if (!goalRows[i].just) return;
    at((lineAt.get(`Goal: ${g.text}`) ?? t) + 0.05, () => goalRows[i].row.classList.add('done', 'just'));
  });
  for (const r of gain.rewards.filter((r) => r.feat)) at(t + 0.2, () => rewards.append(h('div', { class: 'reward feat' }, h('span', { class: 'rw' }, SLOT_WORD[r.slot] ?? ''), r.name, h('small', {}, r.feat))));
  at(t + 0.3, () => row.classList.add('in'));
  row.classList.add('wait');

  /** Jump to the end of the count. */
  const skip = () => {
    if (finished) return;
    finished = true;
    for (const id of timers) clearTimeout(id);
    lines.replaceChildren(...gain.lines.map(([label, xp]) => h('div', { class: 'line' }, h('span', {}, label), h('b', {}, `+${xp}`))));
    rewards.replaceChildren(...gain.rewards.map((r) => h('div', { class: `reward ${r.feat ? 'feat' : ''}` }, h('span', { class: 'rw' }, SLOT_WORD[r.slot] ?? ''), r.name, r.feat ? h('small', {}, r.feat) : null)));
    if (gain.after.level > gain.before.level && !gain.rewards.length) rewards.append(h('div', { class: 'reward' }, `Level ${gain.after.level}`));
    level = gain.after.level;
    into = gain.after.into;
    need = gain.after.need;
    shownXp = gain.total;
    setBar();
    for (const g of goalRows) if (g.just) g.row.classList.add('done');
    row.classList.add('in');
  };
  card.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('button')) skip();
  });
  return { el: card, skip, dispose: () => timers.forEach(clearTimeout) };
}
