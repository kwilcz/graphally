// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas server, from the page: edits to write to the file, undo and redo, and what is selected.

const post = (path, body = {}) => fetch(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}).then(response => response.json());

export const api = {
  // Edits in the skill's format, made against a version of the source (an older one is refused);
  // the answer lists those applied and those that failed.
  edit: (edits, version) => post('api/edits', { edits, version }),
  // The source as these edits would leave it, the file untouched: a drag's preview.
  preview: (edits, version) => post('api/preview', { edits, version }),
  icons: () => fetch('api/icons').then(response => response.json()),
  // Renders the file to an SVG (and a PNG) beside it; the answer names the files written.
  exportDiagram: png => post('api/export', { png }),
  undo: () => post('api/undo'),
  redo: () => post('api/redo'),
  select: items => post('api/selection', { items }),
};
