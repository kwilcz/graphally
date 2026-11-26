// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The layers panel: the diagram's elements as its source nests them, to select any of them, those
// without an id (a chip in a list, a row of a table) included. A layer with children folds; a
// layer dragged onto another moves before it (its top quarter), after it (its bottom quarter) or
// into it (between).
const UNSEEN = new Set(['script', 'style', 'template']);
const ZONES = ['before', 'inside', 'after'];
let dragged = null;

function nameOf(layer) {
  const id = layer.id ? `#${layer.id}` : '';
  const classes = layer.classes ? `.${layer.classes.split(/\s+/).slice(0, 3).join('.')}` : '';
  return `${layer.tag}${id}${classes}`;
}

const zoneOf = (item, event) => {
  const { top, height } = item.getBoundingClientRect(), at = (event.clientY - top) / height;
  return at < 0.25 ? 'before' : at > 0.75 ? 'after' : 'inside';
};

const clearZones = item => item.classList.remove(...ZONES.map(zone => `drop-${zone}`));

function enableDrag(item, layer, actions) {
  item.draggable = true;
  item.addEventListener('dragstart', event => {
    dragged = { path: layer.path, version: actions.version };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', layer.path);
  });
  item.addEventListener('dragend', () => { dragged = null; });
  item.addEventListener('dragover', event => {
    if (dragged === null || layer.path === dragged.path || layer.path.startsWith(`${dragged.path}.`)) return;
    event.preventDefault();
    clearZones(item);
    item.classList.add(`drop-${zoneOf(item, event)}`);
  });
  item.addEventListener('dragleave', () => clearZones(item));
  item.addEventListener('drop', event => {
    event.preventDefault();
    clearZones(item);
    // A drag begun on an older list (the file changed under it) names elements by old paths.
    if (dragged?.version !== actions.version) return;
    actions.move(dragged.path, layer.path, zoneOf(item, event), dragged.version);
  });
}

function toggleOf(layer, folded, actions) {
  const toggle = Object.assign(document.createElement('button'), {
    type: 'button', className: 'fold', textContent: folded ? '▸' : '▾', title: folded ? 'Unfold' : 'Fold',
  });
  toggle.addEventListener('click', event => {
    event.stopPropagation();
    actions.fold(layer.path);
  });
  return toggle;
}

function itemOf(layer, { selectedPaths, folded, parents }, actions) {
  const item = document.createElement('li'), unseen = UNSEEN.has(layer.tag);
  const name = Object.assign(document.createElement('code'), { textContent: nameOf(layer) });
  const text = Object.assign(document.createElement('span'), { textContent: layer.text?.slice(0, 40) ?? '' });
  const toggle = parents.has(layer.path) ? toggleOf(layer, folded.has(layer.path), actions)
    : Object.assign(document.createElement('span'), { className: 'fold' });
  item.append(toggle, name, text);
  item.style.paddingLeft = `${2 + layer.depth * 12}px`;
  item.dataset.path = layer.path;
  item.classList.toggle('selected', selectedPaths.includes(layer.path));
  item.classList.toggle('unseen', unseen);
  if (unseen) return item;
  item.addEventListener('click', event => actions.pick(layer, event.shiftKey));
  enableDrag(item, layer, actions);
  return item;
}

const hiddenBy = (path, folded) => [...folded].some(fold => path.startsWith(`${fold}.`));

// Shows the layers; folded paths hide what they hold, except the way to the selection.
export function showLayers(list, layers, { selectedPath, selectedPaths = [selectedPath], folded }, actions) {
  const shown = layers.filter(layer => !layer.virtual);
  const parents = new Set(shown.map(layer => layer.path.split('.').slice(0, -1).join('.')).filter(Boolean));
  const open = new Set([...folded].filter(fold => !selectedPath?.startsWith(`${fold}.`)));
  const visible = shown.filter(layer => !hiddenBy(layer.path, open));
  list.replaceChildren(...visible.map(layer => itemOf(layer, { selectedPaths, folded: open, parents }, actions)));
  list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
}
