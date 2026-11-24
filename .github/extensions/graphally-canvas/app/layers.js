// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The layers panel: the diagram's elements as its source nests them, to select any of them,
// those without an id (a chip in a list, a row of a table) included.
const UNSEEN = new Set(['script', 'style', 'template']);

function nameOf(layer) {
  const id = layer.id ? `#${layer.id}` : '';
  const classes = layer.classes ? `.${layer.classes.split(/\s+/).slice(0, 3).join('.')}` : '';
  return `${layer.tag}${id}${classes}`;
}

function itemOf(layer, selectedPath, onPick) {
  const item = document.createElement('li');
  const name = document.createElement('code'), text = document.createElement('span');
  name.textContent = nameOf(layer);
  text.textContent = layer.text ? ` ${layer.text.slice(0, 40)}` : '';
  item.append(name, text);
  item.style.paddingLeft = `${6 + layer.depth * 12}px`;
  item.classList.toggle('selected', layer.path === selectedPath);
  item.classList.toggle('unseen', UNSEEN.has(layer.tag));
  if (!UNSEEN.has(layer.tag)) item.addEventListener('click', () => onPick(layer));
  return item;
}

export function showLayers(list, layers, selectedPath, onPick) {
  list.replaceChildren(...layers.filter(layer => !layer.virtual).map(layer => itemOf(layer, selectedPath, onPick)));
  list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
}
