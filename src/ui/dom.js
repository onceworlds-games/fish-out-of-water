// Small DOM helpers: elements, price tags, seat pins. Text always goes in as text (names come from other players).

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** A price tag (a span, or a button when `onclick` is given), wrapped so it can swing and cast its shadow. */
export function tag(content, opts = {}) {
  const inner = h(opts.onclick ? 'button' : 'span', { class: `tag ${opts.kind ?? ''}`, type: opts.onclick ? 'button' : null, onclick: opts.onclick, 'aria-label': opts.label }, content);
  if (opts.onclick) inner.addEventListener('pointerdown', (e) => e.stopPropagation());
  const wrap = h('span', { class: `tag-wrap ${opts.swing === false ? '' : 'swing'} ${opts.wrapClass ?? ''}`, 'data-ui': opts.onclick ? '' : null }, inner);
  if (opts.swing !== false) wrap.style.animationDelay = `${-(Math.random() * 3).toFixed(2)}s`;
  if (opts.angle !== undefined) {
    wrap.style.setProperty('--r0', `${opts.angle - 2}deg`);
    wrap.style.setProperty('--r1', `${opts.angle + 2}deg`);
  }
  wrap.tagEl = inner;
  return wrap;
}

export function keyCap(text) {
  return h('span', { class: 'key' }, text);
}

const SHAPES = {
  circle: '<circle cx="7" cy="7" r="5.6"/>',
  square: '<rect x="1.6" y="1.6" width="10.8" height="10.8" rx="1.5"/>',
  triangle: '<path d="M7 1.2 L13 12.4 H1 Z"/>',
  diamond: '<path d="M7 0.8 L13.2 7 L7 13.2 L0.8 7 Z"/>',
  star: '<path d="M7 0.8l1.9 4.1 4.4.5-3.3 3 .9 4.4L7 10.6l-3.9 2.2.9-4.4-3.3-3 4.4-.5z"/>',
  hexagon: '<path d="M4 1.3h6L13.2 7 10 12.7H4L.8 7z"/>',
  cross: '<path d="M5 1h4v4h4v4H9v4H5V9H1V5h4z"/>',
  ring: '<circle cx="7" cy="7" r="4.4" fill="none" stroke-width="2.6"/>',
};

/** A seat's pin: its colour and its shape (colour-blind players read the shape). */
export function pin(seat) {
  const s = SHAPES[seat?.shape] ?? SHAPES.circle;
  const el = h('span', { class: 'pin' });
  el.innerHTML = `<svg viewBox="0 0 14 14" width="14" height="14" fill="${seat?.hex ?? '#fff'}" stroke="${seat?.shape === 'ring' ? seat?.hex : '#1a1d22'}" stroke-width="${seat?.shape === 'ring' ? 2.6 : 1.4}">${s}</svg>`;
  return el;
}

export function shapeSvg(shape, hex, size = 14) {
  const s = SHAPES[shape] ?? SHAPES.circle;
  return `<svg viewBox="0 0 14 14" width="${size}" height="${size}" fill="${hex}" stroke="${shape === 'ring' ? hex : '#1a1d22'}" stroke-width="${shape === 'ring' ? 2.6 : 1.4}">${s}</svg>`;
}

export function medalDisc(kind) {
  return h('span', { class: `medal ${kind ?? 'none'}`, 'aria-label': kind ? `${kind} medal` : 'no medal' });
}

export function placeText(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  const suf = s[(v - 20) % 10] || s[v] || s[0];
  return h('span', {}, String(n), h('sup', {}, suf));
}
