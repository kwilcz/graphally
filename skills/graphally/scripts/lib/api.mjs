// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The Node API: render diagram files to SVG (and PNG). The command line (scripts/graphally.mjs)
// is a thin wrapper around render(), and so is any program that imports 'graphally'.
//
//   import { render } from 'graphally';
//   const { exitCode, files } = await render(['diagram.html'], { png: true });
//
// Options, each the CLI flag of the same name: out (a folder), png, png1x, png2x, dark, themes,
// inline, json, recompute, viewer (false: leave the file without the viewer header), jobs,
// debug. log(line) receives each line the CLI prints, in order; without it the lines are only
// returned. The result: exitCode (0 ok, 1 a problem or an error) and, per file, its lines, its
// exit code and its diagrams (the files written, width, height, problems, stats). A file that
// does not exist, or two that would write over each other in out, throws, with exitCode 2.
export { render } from './render/render.mjs';
