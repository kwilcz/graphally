// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The way from the diagram to the selection, each step a button that selects that element: the
// quickest way out to a parent several levels up.

const labelOf = layer => `${layer.tag}${layer.id ? `#${layer.id}` : ''}${layer.classes
  ? `.${layer.classes.split(/\s+/).find(name => name && !/[[:]/.test(name)) ?? ''}` : ''}`.replace(/\.$/, '');

function crumb(text, onClick, current) {
  const made = Object.assign(document.createElement('button'), { type: 'button', textContent: text });
  made.classList.toggle('current', current);
  made.addEventListener('click', onClick);
  return made;
}

export function showBreadcrumb(nav, path, layerOf, onPick) {
  const steps = path === null ? [] : path.split('.').map((_, at, all) => all.slice(0, at + 1).join('.'));
  const parts = [crumb('diagram', () => onPick(null), steps.length === 0)];
  for (const step of steps) {
    const layer = layerOf(step);
    if (!layer || layer.virtual) continue;
    parts.push(Object.assign(document.createElement('span'), { textContent: '›' }));
    parts.push(crumb(labelOf(layer), () => onPick(layer), step === path));
  }
  nav.replaceChildren(...parts);
}
