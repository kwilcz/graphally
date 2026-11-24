// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The panels around the drawing, shown for the current state and selection: the layers, the way
// from the diagram to the selection, and the properties (with the selection's placement, styles
// and lines), and whether undo and redo can go on.
import { view, byId, layerOf, selectedEntry, sourceElement, setSelection, edit } from './view.js';
import { element, button } from './dom.js';
import { showLayers } from './layers.js';
import { showBreadcrumb } from './breadcrumb.js';
import { showProperties } from './properties.js';
import { cascadeOf } from './cascade.js';
import { placementControls } from './placement-panel.js';
import { actions } from './actions.js';
import { entryOfDrawn, drawnKeysOf } from './lines.js';

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

function propertiesContext(act) {
  const { selection, state } = view;
  if (selection?.kind === 'line') {
    return { line: { key: selection.id, found: entryOfDrawn(state.lines, selection.id, drawnKeysOf(view.svg)) } };
  }
  if (view.also.length) return { several: actions.selectedPaths().length };
  const layer = selection?.kind === 'element' ? layerOf(selection.path) : null;
  if (!layer) return {};
  const source = sourceElement(layer.path), entry = selectedEntry();
  const icon = source?.localName === 'icon' ? source : source?.querySelector(':scope > icon');
  return {
    layer, styles: state.styles, icon: icon && { path: icon.dataset.src, name: icon.getAttribute('name') },
    cascade: source ? cascadeOf(source, view.parsed, state.styles) : null,
    placement: view.model ? placementControls(view.model, entry, layer, act) : [],
    lines: linesOf(layer.id).map(item => element('div', { className: 'line-item' }, [item])),
  };
}

// A field with typing not yet written stays as it is when the file changes under it: the panel
// is drawn again once the field is left, and the field's edit, made against the version it was
// drawn for, is refused when it no longer fits. A field is dirty from a keystroke until its
// change is written (Enter, or leaving it).
const typingIn = panel => panel.contains(document.activeElement) && document.activeElement.dataset.dirty === 'yes';

export function showPanels() {
  const { state, selection } = view, path = selection?.kind === 'element' ? selection.path : null;
  const version = state?.version, act = {
    ...actions, edit: (edits, selectAfter) => edit(edits, selectAfter, version),
    wrap: layer => actions.wrap(layer, version), unwrap: layer => actions.unwrap(layer, version),
    renameId: (layer, next) => actions.renameId(layer, next, version),
    splitLine: (found, key) => actions.splitLine(found, key, version),
    removeLine: found => actions.removeLine(found, version),
    removeElement: layer => actions.removeElement(layer, version),
  };
  const shown = { selectedPath: path, selectedPaths: actions.selectedPaths(), folded: view.folded };
  showLayers(byId('layers'), state?.layers ?? [], shown, {
    pick: actions.pick, fold: actions.fold, version,
    move: (from, target, zone, drawnFor) => actions.dropOnLayer(from, target, zone, drawnFor),
  });
  showBreadcrumb(byId('crumbs'), path, layerOf, layer => actions.pick(layer));
  view.panelBehind = typingIn(byId('properties'));
  if (!view.panelBehind) showProperties(byId('properties'), state ? propertiesContext(act) : {}, act);
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
