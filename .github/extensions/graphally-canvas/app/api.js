// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The canvas server, from the page: edits to write to the file, undo and redo, and what is selected.

const post = (path, body = {}) => fetch(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}).then(response => response.json());

export const api = {
  // Edits in the skill's format; the answer lists those applied and those that failed.
  edit: edits => post('api/edits', { edits }),
  undo: () => post('api/undo'),
  redo: () => post('api/redo'),
  select: items => post('api/selection', { items }),
};
