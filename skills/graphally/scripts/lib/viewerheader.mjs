// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The viewer header: a diagram file that loads graphally.js renders itself in a browser,
// double-clicked from disk included. The render command and tf2graphally both add it.

// Served by jsDelivr from this repository's release tags; @2 follows the latest 2.x release.
export const VIEWER = 'https://cdn.jsdelivr.net/gh/kwilcz/graphally@2/skills/graphally/viewer/graphally.js';

// The text with the header at the top, once. A part file (no <diagram>) and a file that
// already loads graphally.js come back as they are.
export function withViewer(text) {
  if (!/<diagram\b/i.test(text) || /graphally\.js["']/.test(text)) return text;
  const lines = ['<meta charset="utf-8">', '<!-- Open this file in a browser to see the diagram. Edit the text and reload; the format: https://github.com/kwilcz/graphally -->', `<script src="${VIEWER}"></script>`];
  const doctype = /^\s*<!doctype[^>]*>\s*\n?/i.exec(text);
  return doctype ? doctype[0].trimEnd() + '\n' + lines.join('\n') + '\n' + text.slice(doctype[0].length) : ['<!doctype html>', ...lines].join('\n') + '\n' + text;
}
