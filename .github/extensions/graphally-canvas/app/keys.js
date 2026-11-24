// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas's keys, outside text fields. Mod is Ctrl, or Cmd on a Mac.
//
//   Esc              stop connecting, else select the parent
//   Delete           delete the selection (a box with its lines)
//   Enter            edit the selection's text
//   Alt+↑ / Alt+↓    move it before the sibling before it / after the one after it
//   Alt+→ / Alt+←    move it into the sibling before it / out of its parent
//   Mod+D            duplicate          Mod+G / Mod+Shift+G   group / ungroup
//   Mod+Z            undo               Mod+Shift+Z, Mod+Y    redo
//   Mod+= / Mod+-    zoom in / out      Shift+1 / Shift+0     fit / 100%
import { view, selectedEntry } from './view.js';
import { actions } from './actions.js';

function chordOf(event) {
  const named = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const key = /^Digit\d$/.test(event.code) ? event.code.slice(5) : named;
  const modifiers = [(event.ctrlKey || event.metaKey) && 'Mod', event.altKey && 'Alt', event.shiftKey && 'Shift'];
  return [...modifiers.filter(Boolean), key].join('+');
}

export function enableKeys(zoom) {
  const chords = {
    Escape: () => (view.connecting ? actions.cancelConnect() : actions.selectParent()),
    Delete: actions.remove, Backspace: actions.remove,
    Enter: () => actions.editText(selectedEntry()),
    'Alt+ArrowUp': () => actions.step(-1), 'Alt+ArrowDown': () => actions.step(1),
    'Alt+ArrowRight': actions.indent, 'Alt+ArrowLeft': actions.outdent,
    'Mod+d': actions.duplicate, 'Mod+g': () => actions.wrap(), 'Mod+Shift+g': () => actions.unwrap(),
    'Mod+z': actions.undo, 'Mod+Shift+z': actions.redo, 'Mod+y': actions.redo,
    'Mod+=': () => zoom.step(1), 'Mod+Shift++': () => zoom.step(1), 'Mod+-': () => zoom.step(-1),
    'Shift+1': () => zoom.set('fit'), 'Shift+0': () => zoom.set(1),
  };
  document.addEventListener('keydown', event => {
    if (event.target.matches('input, select, textarea')) return;
    const run = chords[chordOf(event)];
    if (!run) return;
    event.preventDefault();
    run();
  });
}
