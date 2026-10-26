// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The viewer header: a diagram file that loads graphally.js renders itself in a browser,
// double-clicked from disk included. The render command and tf2graphally both add it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Served by jsDelivr from this repository's release tags: @<major> follows the latest release
// of the skill's major version (SKILL.md), so @2 now and @3 after a breaking release.
const skillMd = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../SKILL.md'), 'utf8');
export const MAJOR = /^  version: "(\d+)\.\d+\.\d+"$/m.exec(skillMd)?.[1] || null;
export const VIEWER = `https://cdn.jsdelivr.net/gh/kwilcz/graphally@${MAJOR || 'latest'}/skills/graphally/viewer/graphally.js`;
// A header of this repository on a major range (@1, @2): one older than MAJOR moves forward.
// A pinned commit, tag or branch is the author's choice and stays.
const RANGE = /<script src="https:\/\/cdn\.jsdelivr\.net\/gh\/kwilcz\/graphally@(\d+)\/skills\/graphally\/viewer\/graphally\.js"><\/script>/;

// The text with the header at the top, once. A part file (no <diagram>) and a file that
// already loads graphally.js come back as they are, but for an older major range.
export function withViewer(text) {
  if (!/<diagram\b/i.test(text)) return text;
  const range = RANGE.exec(text);
  if (range && MAJOR && Number(range[1]) < Number(MAJOR)) return text.replace(RANGE, `<script src="${VIEWER}"></script>`);
  if (/graphally\.js["']/.test(text)) return text;
  const lines = ['<meta charset="utf-8">', '<!-- Open this file in a browser to see the diagram. Edit the text and reload; the format: https://github.com/kwilcz/graphally -->', `<script src="${VIEWER}"></script>`];
  const doctype = /^\s*<!doctype[^>]*>\s*\n?/i.exec(text);
  return doctype ? doctype[0].trimEnd() + '\n' + lines.join('\n') + '\n' + text.slice(doctype[0].length) : ['<!doctype html>', ...lines].join('\n') + '\n' + text;
}
