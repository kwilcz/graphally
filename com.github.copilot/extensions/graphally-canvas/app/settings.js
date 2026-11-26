// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas's view settings, remembered in this browser: whether every grid's columns and rows
// are drawn, and whether Alt-drag nudges snap to other boxes. Both are on to begin with; a browser
// that keeps nothing starts from them each time.
const KEY = 'graphally-canvas-settings';
const DEFAULTS = { grids: true, snap: true };

function remembered() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = remembered();

export function setSetting(name, value) {
  settings[name] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch { /* kept for this page only */ }
}
