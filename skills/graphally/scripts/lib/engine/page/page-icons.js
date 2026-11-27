// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Icons on the page and in the script, drawn from the packs' symbols.
import { resolveIcon, symbolFor } from '../icons/icons.js';

// The packs a name is looked up in, in order: icons="aws" puts AWS first.
const packOrderOf = diagram => {
  const first = String(diagram.getAttribute('icons') || 'azure').toLowerCase();
  return first === 'aws' ? ['aws', 'azure'] : ['azure', 'aws'];
};

// An icon's symbol id, with its markup kept for the defs. A name no pack knows is a problem,
// reported under the name as written.
export function iconSymbol(figure, name, written = name) {
  const icon = resolveIcon(name, packOrderOf(figure.diagram));
  if (!icon || icon.error) {
    figure.problems.push({ rule: 'unknown-icon', icon: written, suggest: icon?.suggestions, hint: icon?.hint });
    return undefined;
  }
  const symbol = symbolFor(icon, figure.id);
  figure.symbols.set(symbol.id, symbol.markup);
  return symbol.id;
}

// <icon name="app service" size=32> becomes a box of its size, drawn with the icon's symbol.
// Sizes change the layout, so this runs before the page is measured.
export function resolvePageIcons(figure) {
  for (const icon of figure.root.querySelectorAll('icon')) {
    const size = icon.getAttribute('size');
    if (size) {
      icon.style.width = `${size}px`;
      icon.style.height = `${size}px`;
    }
    const name = icon.getAttribute('name');
    const symbol = iconSymbol(figure, name || '', name);
    if (symbol) icon.dataset.symbol = symbol;
  }
}
