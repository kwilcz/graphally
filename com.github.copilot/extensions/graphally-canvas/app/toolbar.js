// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The buttons above the drawing: adding, zoom, undo and redo, the view settings (grids, snapping),
// rendering the diagram to an SVG or a PNG beside its file, and the layers drawer of a narrow panel.
import { api } from './api.js';
import { byId, setStatus } from './view.js';
import { actions } from './actions.js';
import { drawSelection } from './canvas.js';
import { settings, setSetting } from './settings.js';
import { element } from './dom.js';

function toggle(id, name) {
  const button = byId(id);
  button.setAttribute('aria-pressed', String(settings[name]));
  button.addEventListener('click', () => {
    setSetting(name, !settings[name]);
    button.setAttribute('aria-pressed', String(settings[name]));
    drawSelection();
  });
}

// The files an export wrote, each a link that opens it (they lie beside the diagram).
function showWritten(written, problems) {
  const links = written.flatMap((name, index) => [index ? ', ' : '',
    element('a', { href: encodeURIComponent(name), target: '_blank', rel: 'noopener', textContent: name })]);
  const note = problems.length ? ` (${problems.length} note${problems.length > 1 ? 's' : ''}: ${problems[0]})` : '';
  setStatus('');
  byId('status').replaceChildren('Wrote ', ...links, ` beside the diagram.${note}`);
}

async function exportTo(png) {
  const buttons = [byId('export-svg'), byId('export-png')];
  buttons.forEach(button => { button.disabled = true; });
  setStatus(png ? 'Rendering the SVG and the PNG…' : 'Rendering the SVG…');
  try {
    const { written = [], problems = [], ok } = await api.exportDiagram(png);
    if (ok) showWritten(written, problems);
    else setStatus(`Not exported: ${problems.join('; ') || 'the render failed'}`, true);
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

export function enableToolbar(zoom) {
  for (const kind of ['box', 'group', 'text']) byId(`add-${kind}`).addEventListener('click', () => actions.add(kind));
  byId('undo').addEventListener('click', actions.undo);
  byId('redo').addEventListener('click', actions.redo);
  byId('zoom-in').addEventListener('click', () => zoom.step(1));
  byId('zoom-out').addEventListener('click', () => zoom.step(-1));
  byId('zoom-level').addEventListener('click', () => zoom.set(1));
  byId('zoom-fit').addEventListener('click', () => zoom.set('fit'));
  toggle('toggle-grids', 'grids');
  toggle('toggle-snap', 'snap');
  byId('export-svg').addEventListener('click', () => exportTo(false));
  byId('export-png').addEventListener('click', () => exportTo(true));
  byId('toggle-layers').addEventListener('click', event => {
    const open = document.body.classList.toggle('layers-open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
}
