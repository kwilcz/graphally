// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// animate(): one rule and one @keyframes per animation, as element.animate's keyframes and
// options say. A keyframe takes opacity, rotate (a number is degrees), translate (a number or
// [dx, dy] in px) and scale, with offset (0 to 1; spread evenly when left out) and easing. The
// options: duration and delay (ms), iterations (Infinity: for ever), easing (linear unless
// told), direction, fill (none unless told), and the origin it turns about, worked out when
// animate() was called. Values go into CSS, so only plain ones pass; anything else is a problem.
import { roundTo } from '../svg.js';

const number = value => roundTo(Number(value), 3);
const plain = value => /^[-\w\s.,%()#]*$/.test(String(value));
const FILL = /^(none|forwards|backwards|both)$/;
const DIRECTION = /^(normal|reverse|alternate|alternate-reverse)$/;

const KEYFRAME = {
  opacity: value => number(value),
  rotate: value => (typeof value === 'number' ? `${number(value)}deg` : value),
  translate: value => [].concat(value).map(part => (typeof part === 'number' ? `${number(part)}px` : part))
    .join(' '),
  scale: value => [].concat(value).map(part => (typeof part === 'number' ? number(part) : part)).join(' '),
};

// Offsets as element.animate spreads them: the first at 0, the last at 1, the rest evenly
// between the given ones.
function spreadOffsets(keyframes) {
  const frames = keyframes.map(frame => ({ ...frame })), count = frames.length;
  if (frames[0].offset == null) frames[0].offset = 0;
  if (frames[count - 1].offset == null) frames[count - 1].offset = count > 1 ? 1 : 0;
  for (let index = 1; index < count; index++) {
    if (frames[index].offset != null) continue;
    let next = index;
    while (frames[next].offset == null) next++;
    const from = frames[index - 1].offset, to = frames[next].offset, gaps = next - index + 1;
    for (let between = index; between < next; between++) {
      frames[between].offset = from + (to - from) * (between - index + 1) / gaps;
    }
  }
  return frames;
}

// A keyframe's CSS declarations; a value CSS cannot take as plain text is reported instead.
function declarationsOf(frame, report) {
  const declarations = [];
  for (const [key, value] of Object.entries(frame)) {
    if (key === 'offset') continue;
    if (key === 'easing') {
      if (plain(value)) declarations.push(`animation-timing-function: ${value}`);
      else report('animate easing', value, 'an easing as in CSS: linear, ease-in-out, cubic-bezier(…)');
      continue;
    }
    if (!KEYFRAME[key]) {
      report('animate', key, 'a keyframe takes opacity, rotate, translate, scale, offset and easing');
      continue;
    }
    const css = KEYFRAME[key](value);
    if (plain(css)) declarations.push(`${key}: ${css}`);
    else report(`animate ${key}`, value, 'a number, or a plain CSS value');
  }
  return declarations;
}

// An option's value when it is allowed, else its default.
const chosen = (value, isAllowed, fallback) => (isAllowed(value ?? fallback) ? value ?? fallback : fallback);

// The animation shorthand of animate()'s options.
function animationOf(name, options) {
  const easing = chosen(options.easing, plain, 'linear');
  const fill = chosen(options.fill, value => FILL.test(value), 'none');
  const direction = chosen(options.direction, value => DIRECTION.test(value), 'normal');
  const { iterations } = options, forever = iterations === Infinity || iterations === 'infinite';
  const count = forever ? 'infinite' : Number(iterations) > 0 ? number(iterations) : '1';
  const duration = `${number(options.duration ?? 1000)}ms`, delay = `${number(options.delay ?? 0)}ms`;
  return `${name} ${duration} ${easing} ${delay} ${count} ${direction} ${fill}`;
}

export function animationCss(animations, figureId, problems) {
  let rules = '', keyframes = '';
  animations.forEach(({ frames, options, origin }, index) => {
    const name = `${figureId}-a${index}`;
    const report = (option, value, hint) =>
      problems.push({ rule: 'bad-option', option, value: String(value), hint });
    const body = spreadOffsets(frames)
      .map(frame => `  ${number(frame.offset * 100)}% { ${declarationsOf(frame, report).join('; ')}; }`)
      .join('\n');
    const pivot = `${number(origin.x)}px ${number(origin.y)}px`;
    rules += `\n  svg.graphally [data-anim="${index}"] { transform-box: view-box; transform-origin: ${pivot};`
      + ` animation: ${animationOf(name, options)}; }`;
    keyframes += `\n@keyframes ${name} {\n${body}\n}`;
  });
  return { rules, keyframes };
}
