// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// node .github/extensions/graphally-canvas/preview.mjs <diagram.html>
// The canvas outside the Copilot app: serves it for one diagram file and prints the address to
// open in a browser. Edits go to the file, as in the app; Ctrl+C stops it.
import { resolve } from 'node:path';
import { openCanvas } from './instances.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node .github/extensions/graphally-canvas/preview.mjs <diagram.html>');
  process.exit(2);
}
const { server } = await openCanvas('preview', resolve(file));
console.log(`graphally canvas on ${file}: ${server.url}`);
