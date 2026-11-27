// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A class of the author's own that a small building block also styles (.num, .card, .pill …). Blocks
// have no specificity, so the author's rule wins where it speaks and the block's look stays where it
// does not: a number gets a 17px circle, a card a frame. When the author's rule for the bare class
// leaves some of the block's visible properties standing, the render says which.
import { PAGE_CSS } from '../page/page-css.js';

const WATCHED = new Set(['num', 'pill', 'tag', 'badge', 'tile', 'card', 'box', 'banner', 'swatch']);
const VISIBLE = /^(width|height|background|border|padding|margin-right|font-size|font-weight|color|box-shadow)/;
const propsOf = body => body.split(';').map(declaration => declaration.split(':')[0].trim().toLowerCase())
  .filter(Boolean);
const addTo = (map, name, props) => map.set(name, new Set([...(map.get(name) || []), ...props]));

// The visible properties each watched block sets on its bare class.
const BLOCK_PROPS = new Map();
for (const [, name, body] of PAGE_CSS.matchAll(/:where\(\.graphally-page \.([a-z-]+)\)\s*\{([^}]*)\}/g)) {
  if (WATCHED.has(name)) addTo(BLOCK_PROPS, name, propsOf(body).filter(prop => VISIBLE.test(prop)));
}

const bareClass = selector => /^\s*\.([a-z][\w-]*)\s*$/i.exec(selector)?.[1];
const RULE = /([^{}]+)\{([^{}]*)\}/g;

// The properties the diagram's own rules set on a watched class written bare: .num { … }.
function authorProps(diagram) {
  const found = new Map(), css = [...diagram.querySelectorAll('style')].map(style => style.textContent).join('\n');
  for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(RULE)) {
    const names = selectors.split(',').map(bareClass).filter(name => BLOCK_PROPS.has(name));
    names.forEach(name => addTo(found, name, propsOf(body)));
  }
  return found;
}

// A property is set by the author when written, or by its shorthand (padding sets padding-left;
// border sets border-top, but not border-radius).
const covered = (props, prop) => props.has(prop) || (prop !== 'border-radius' && props.has(prop.split('-')[0]));

export function checkTakenClasses(figure) {
  for (const [name, props] of authorProps(figure.diagram)) {
    const keeps = [...BLOCK_PROPS.get(name)].filter(prop => !covered(props, prop));
    if (!keeps.length) continue;
    figure.problems.push({
      rule: 'class-taken', warn: true, class: name, keeps: keeps.join(','),
      hint: `.${name} is a building block, and its look stays under your rule: `
        + 'set these, or name your class differently',
    });
  }
}
