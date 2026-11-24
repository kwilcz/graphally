// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Two checks after each redraw that the page and the file still mean the same elements. HTML the
// browser reads differently from how it is written (a <div> in a <p>, a <td> straight in a
// <table>) numbers the page's elements differently from the file's; edits by path would then
// change the wrong element, so the canvas stops editing and says where. And a selection of an
// element without an id, carried by its path across an edit the page did not make, is kept only
// when the element there is still of its kind.

// Where the browser's elements first differ from the file's, or null when they agree.
export function readDifferently(layers, parsed) {
  const stamped = [...parsed.querySelectorAll('[data-src]')];
  const page = new Map(stamped.map(element => [element.dataset.src, element.localName]));
  const differ = layers.find(layer => page.get(layer.path) !== layer.tag);
  if (differ) return `the <${differ.tag}> at ${differ.path}`;
  return page.size === layers.length ? null : 'the number of elements';
}

export const MISMATCH = 'The browser reads this diagram\'s HTML differently from how it is written (near WHERE), '
  + 'so the canvas would edit the wrong elements. Fix the HTML in the source (a <div> in a <p>, a stray end tag) '
  + 'to edit here.';

export const kindOf = layer => (layer ? `${layer.tag}.${layer.classes}` : null);
