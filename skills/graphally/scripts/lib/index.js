// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// compile(<diagram>) -> { svg, width, height, problems, stats, snapshot }
// A diagram is HTML and CSS laid out by the browser; page.js turns the laid-out page into SVG.
import { createMeasurer } from './measure.js';
import { compilePage } from './page.js';
export { registerPack } from './icons.js';

// The elements of the old tag syntax (<node>, <group>, <links>, layout=tree…), removed:
// a diagram that still uses them is told so instead of drawing an empty page.
const OLD_TAGS = 'node, group, links, link, layout, band, lane, task, milestone, level, include, start, end, gateway, event';
const OLD_LAYOUTS = /^(areas|row|tree|flow|lanes|sequence|gantt|timeline)$/i;

export function compile(el, opts = {}) {
  if (opts.debug) globalThis.__routeDebug = true;
  const old = [...el.children].filter(c => c.matches(OLD_TAGS)).map(c => `<${c.tagName.toLowerCase()}>`);
  const layout = el.getAttribute('layout') || '';
  const m = createMeasurer();
  try {
    const r = compilePage(el, opts, m);
    if (old.length || OLD_LAYOUTS.test(layout)) r.problems.unshift({ rule: 'old-syntax', found: [...new Set([...(OLD_LAYOUTS.test(layout) ? [`layout=${layout}`] : []), ...old])].join(' '),
      hint: 'the tag syntax is gone: write the diagram as HTML and CSS (references/format.md), connections as a JSON list' });
    return r;
  } finally { m.dispose(); }
}
