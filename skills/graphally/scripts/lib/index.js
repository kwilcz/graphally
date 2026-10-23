// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// compile(<diagram>) -> { svg, width, height, problems, stats, snapshot }
// A diagram is HTML and CSS laid out by the browser; page.js turns the laid-out page into SVG.
import { createMeasurer } from './measure.js';
import { compilePage } from './page.js';
export { registerPack } from './icons.js';

export function compile(el, opts = {}) {
  if (opts.debug) globalThis.__routeDebug = true;
  const m = createMeasurer();
  try { return compilePage(el, opts, m); } finally { m.dispose(); }
}
