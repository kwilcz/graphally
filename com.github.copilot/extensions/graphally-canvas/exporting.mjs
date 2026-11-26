// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Rendering the diagram file to an SVG (and a sharp PNG) beside it, with the skill's own render,
// so the files are those `graphally render` writes. The file itself is left as it is (no viewer
// header is added); one export runs at a time.
import { basename } from 'node:path';
import { render } from '../../../skills/graphally/scripts/lib/api.mjs';

let running = null;

async function renderOnce(filePath, png) {
  const result = await render([filePath], { viewer: false, png2x: png });
  const diagrams = result.files.flatMap(file => file.diagrams ?? []);
  const written = diagrams.flatMap(diagram => [diagram.svg, png ? diagram.png : null]).filter(Boolean);
  const problems = result.files.flatMap(file => file.lines.slice(1));
  return { written: written.map(file => basename(file)), problems, ok: result.exitCode === 0 || written.length > 0 };
}

export async function exportDiagram(filePath, png) {
  if (running) return { written: [], problems: ['An export is running already.'], ok: false };
  running = renderOnce(filePath, png);
  try {
    return await running;
  } catch (error) {
    return { written: [], problems: [error.message], ok: false };
  } finally {
    running = null;
  }
}
