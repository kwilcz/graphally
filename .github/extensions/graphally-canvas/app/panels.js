// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The panels around the drawing, shown for the current state and selection: the layers, the way
// from the diagram to the selection, and the properties (with the selection's placement, styles
// and lines), and whether undo and redo can go on.
import { view, byId, layerOf, selectedEntry, sourceElement, setSelection } from './view.js';
import { element, button } from './dom.js';
import { showLayers } from './layers.js';
import { showBreadcrumb } from './breadcrumb.js';
import { showProperties } from './properties.js';
import { cascadeOf } from './cascade.js';
import { placementControls } from './placement-panel.js';
import { actions } from './actions.js';
import { entryOfDrawn } from './lines.js';

const ends = value => [].concat(value ?? []);

// The element's lines, each a button that selects it: by its own key in the drawing, or by the
// key of the list it is written in.
function linesOf(id) {
  if (!id) return [];
  const pairs = entry => ends(entry.from).flatMap(from => ends(entry.to).map(to => ({ entry, from, to })));
  return view.state.lines.flatMap(pairs).filter(({ from, to }) => from === id || to === id)
    .map(({ entry, from, to }) => {
      const own = `${from}->${to}`, drawn = view.svg?.querySelector(`g[data-edge="${CSS.escape(own)}"]`);
      const text = `${from === id ? `→ ${to}` : `← ${from}`}${entry.label ? `  ${entry.label}` : ''}`;
      return button(text, () => actions.selectLine(drawn ? own : entry.key), entry.key);
    });
}

function propertiesContext() {
  const { selection, state } = view;
  if (selection?.kind === 'line') {
    return { line: { key: selection.id, found: entryOfDrawn(state.lines, selection.id) } };
  }
  const layer = selection?.kind === 'element' ? layerOf(selection.path) : null;
  if (!layer) return {};
  const source = sourceElement(layer.path), entry = selectedEntry();
  return {
    layer, styles: state.styles,
    cascade: source ? cascadeOf(source, view.parsed, state.styles) : null,
    placement: view.model ? placementControls(view.model, entry, layer, actions) : [],
    lines: linesOf(layer.id).map(item => element('div', { className: 'line-item' }, [item])),
  };
}

export function showPanels() {
  const { state, selection } = view, path = selection?.kind === 'element' ? selection.path : null;
  showLayers(byId('layers'), state?.layers ?? [], { selectedPath: path, folded: view.folded }, {
    pick: actions.pick, fold: actions.fold, move: actions.dropOnLayer,
  });
  showBreadcrumb(byId('crumbs'), path, layerOf, layer => actions.pick(layer));
  showProperties(byId('properties'), state ? propertiesContext() : {}, actions);
  byId('undo').disabled = !state?.canUndo;
  byId('redo').disabled = !state?.canRedo;
}

// The selection again after a redraw, or the agent's: found by its id when it still has one (a
// move changes paths), else by its path.
export function resolveSelection(item) {
  if (!item || !view.model) return null;
  if (item.kind === 'line') return item;
  const entry = (item.id && view.model.withId(item.id)) || view.model.entry(item.path);
  if (entry) return { kind: 'element', path: entry.src, ...(entry.id ? { id: entry.id } : {}) };
  return layerOf(item.path) ? { kind: 'element', path: item.path } : null;
}

export const selectNothing = () => setSelection(null);
