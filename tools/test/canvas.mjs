// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas extension's server and session, without a browser: an edit writes the file, a
// preview does not, an edit made against an older source is refused, undo restores it, and a
// request that is not the canvas page's is turned away.
import fs from 'node:fs';
import path from 'node:path';
import { check, root, work } from './helpers.mjs';
import { openCanvas, closeCanvas } from '../../com.github.copilot/extensions/graphally-canvas/instances.mjs';

const json = body => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const RENAME = [{ op: 'text', id: 'sql', text: 'Orders DB' }];

async function checkEdits(url, file) {
  const state = await (await fetch(`${url}api/state`)).json(), original = fs.readFileSync(file, 'utf8');
  const preview = await (await fetch(`${url}api/preview`, json({ edits: RENAME, version: state.version }))).json();
  const unwritten = fs.readFileSync(file, 'utf8') === original;
  check(preview.source.includes('Orders DB') && unwritten, 'preview: drawn, not written');
  const stale = await (await fetch(`${url}api/edits`, json({ edits: RENAME, version: state.version - 1 }))).json();
  check(stale.stale && fs.readFileSync(file, 'utf8') === original, 'an edit against an older source is refused');
  const done = await (await fetch(`${url}api/edits`, json({ edits: RENAME, version: state.version }))).json();
  check(!done.errors.length && fs.readFileSync(file, 'utf8').includes('Orders DB'), 'an edit writes the file');
  await fetch(`${url}api/undo`, json({}));
  check(fs.readFileSync(file, 'utf8') === original, 'undo restores the file');
}

async function checkGuards(url, file) {
  const { origin } = new URL(url), before = fs.readFileSync(file, 'utf8');
  check((await fetch(`${origin}/api/state`)).status === 404, 'the state without the secret path');
  const plain = { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ edits: RENAME }) };
  check((await fetch(`${url}api/edits`, plain)).status === 403, 'a plain-text edit (another site\'s form)');
  const headers = { 'content-type': 'application/json', origin: 'https://example.com' };
  const foreign = { ...json({ edits: RENAME }), headers };
  check((await fetch(`${url}api/edits`, foreign)).status === 403, 'an edit from another origin');
  check(fs.readFileSync(file, 'utf8') === before, 'the file after turned-away requests');
}

export async function canvas() {
  const file = path.join(work, 'canvas.html');
  fs.copyFileSync(path.join(root, 'samples/architecture/diagram.html'), file);
  const { server } = await openCanvas('test', file);
  try {
    check((await fetch(server.url)).status === 200, 'the canvas page');
    await checkEdits(server.url, file);
    await checkGuards(server.url, file);
  } finally {
    await closeCanvas('test');
  }
}
