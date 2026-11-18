// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Connection sides and overrides: a side asked for is kept, a blocked or unknown one is
// reported, and an override whose attribute was removed is reported as dropped.
import path from 'node:path';
import {
  check, checkReported, checkSucceeded, folder, readSnapshot, render, tail, twoGroups, write,
} from './helpers.mjs';

const NUDGE = ' nudge="0,24"';

export async function sides() {
  const dir = folder('sides');
  const out = path.join(dir, 'out');
  // a2 is the lower box of its stack, so its bottom side is free.
  const source = twoGroups({ line: '{ "from": "a2", "to": "b1", "out": "bottom", "in": "bottom" }' });
  checkSucceeded(await render(write(dir, source), out));
  const edge = readSnapshot(path.join(out, 'diagram.svg')).edges?.['a2->b1'];
  check(edge && edge.out === 'bottom' && edge.in === 'bottom', `connection a2->b1 is ${JSON.stringify(edge)}`);
}

export async function badSides() {
  const dir = folder('bad-sides');
  const out = path.join(dir, 'out');
  // a1's bottom is blocked by a2 right under it; "diagonal" is no side.
  const tight = twoGroups({ line: '{ "from": "a1", "to": "b1", "out": "bottom" }' })
    .replace('class=group id=ga', 'class="group gap-0" id=ga');
  const blocked = await render(write(dir, tight), out);
  checkReported(blocked, /override-ignored: id=a1->b1 attr=out/, 'override-ignored for a1->b1 out');
  const unknown = await render(write(dir, twoGroups({ line: '{ "from": "a1", "to": "b1", "out": "diagonal" }' })), out);
  checkReported(unknown, /diagonal/, 'a problem naming "diagonal"');
}

export async function dropped() {
  const dir = folder('dropped');
  const out = path.join(dir, 'out');
  const file = write(dir, twoGroups({ attr: NUDGE }));
  checkSucceeded(await render(file, out));
  write(dir, twoGroups());
  const result = await render(file, out);
  checkSucceeded(result);
  check(result.text.includes('override dropped: nudge on b1 (attribute removed)'),
    `no "override dropped: nudge on b1 (attribute removed)" line: ${tail(result.text)}`);
  const fresh = await render(file, out, ['--recompute']);
  checkSucceeded(fresh);
  check(!fresh.text.includes('override dropped'), 'a --recompute render still reports a dropped override');
}
