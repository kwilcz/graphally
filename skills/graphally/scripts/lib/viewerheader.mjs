// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The viewer header: a diagram file that loads graphally.js renders itself in a browser,
// double-clicked from disk included. The render command and tf2graphally both add it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The viewer of this very release, served by jsDelivr from its tag (v<version in SKILL.md>).
// An exact tag never changes, so a diagram opens with the engine that drew it. A range such
// as @2 resolves through jsDelivr's list of the repository's tags, which can lag a release by
// days.
const skillMd = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../SKILL.md'), 'utf8');
export const VERSION = /^  version: "(\d+\.\d+\.\d+)"$/m.exec(skillMd)?.[1] || null;
export const VIEWER = `https://cdn.jsdelivr.net/gh/kwilcz/graphally@${VERSION ? `v${VERSION}` : 'latest'}/skills/graphally/viewer/graphally.js`;
// The header of any release (or commit, or branch) of this repository.
const OURS = /<script src="https:\/\/cdn\.jsdelivr\.net\/gh\/kwilcz\/graphally@[^/"]+\/skills\/graphally\/viewer\/graphally\.js"><\/script>/;

// The text with the header at the top, once; a header of another release now loads this one.
// A part file (no <diagram>) and a file that loads graphally.js from elsewhere come back as
// they are.
export function withViewer(text) {
  if (!/<diagram\b/i.test(text)) return text;
  if (OURS.test(text)) return text.replace(OURS, `<script src="${VIEWER}"></script>`);
  if (/graphally\.js["']/.test(text)) return text;
  const lines = ['<meta charset="utf-8">', '<!-- Open this file in a browser to see the diagram. Edit the text and reload; the format: https://github.com/kwilcz/graphally -->', `<script src="${VIEWER}"></script>`];
  const doctype = /^\s*<!doctype[^>]*>\s*\n?/i.exec(text);
  return doctype ? doctype[0].trimEnd() + '\n' + lines.join('\n') + '\n' + text.slice(doctype[0].length) : ['<!doctype html>', ...lines].join('\n') + '\n' + text;
}
