// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// ::before and ::after, made real elements so the page can read their boxes.

const SKIPPED_TAGS = /^(ICON|IMG|SVG|STYLE|SCRIPT|G-PSEUDO)$/i;
const mayHavePseudo = element => element instanceof HTMLElement && !SKIPPED_TAGS.test(element.tagName);

// The text of a computed content value: its strings, with CSS escapes, and attr(name) read
// from the element (content: attr(data-step) numbers a list from its markup).
function contentText(content, element) {
  const parts = content.matchAll(/"((?:[^"\\]|\\.)*)"|attr\(\s*([\w-]+)\s*\)/g);
  return [...parts].map(([, quoted, attribute]) => {
    if (attribute) return element.getAttribute(attribute) || '';
    return quoted
      .replace(/\\([\da-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/\\(.)/g, '$1');
  }).join('');
}

// The properties a stand-in takes over: all but content (its text is set apart), custom
// properties and animations, which would replay on the stand-in.
const copied = property =>
  property !== 'content' && !property.startsWith('--') && !/^(animation|transition)/.test(property);

// A <g-pseudo> with a pseudo-element's computed style and text; null where there is none.
function standInFor(element, which) {
  const style = getComputedStyle(element, `::${which}`);
  if (style.content === 'none' || style.content === 'normal' || style.display === 'none') return null;
  const stand = document.createElement('g-pseudo');
  for (const property of [...style].filter(copied)) stand.style.setProperty(property, style.getPropertyValue(property));
  stand.textContent = contentText(style.content, element);
  return { element, which, stand };
}

// Every pseudo-element's stand-in, read before any is added, as adding one restyles the page.
function standInsOf(root) {
  const elements = [...root.querySelectorAll('*')].filter(mayHavePseudo);
  return elements.flatMap(element => ['before', 'after'].map(which => standInFor(element, which))).filter(Boolean);
}

// ::before and ::after have no box the page can read, so each becomes a real element: a
// <g-pseudo> with the pseudo-element's computed style and text, in its place among the
// element's children. The pseudo-elements themselves are then switched off.
export function materializePseudo(root) {
  for (const { element, which, stand } of standInsOf(root)) {
    element.setAttribute(`data-g-${which}`, '');
    if (which === 'before') element.prepend(stand);
    else element.append(stand);
  }
  const switchOff = document.createElement('style');
  switchOff.textContent = '[data-g-before]::before, [data-g-after]::after { content: none !important; }';
  root.prepend(switchOff);
}
