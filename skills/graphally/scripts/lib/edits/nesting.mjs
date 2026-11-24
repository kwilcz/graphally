// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What HTML lets an element hold (shared by the edits and the canvas page, which the canvas
// server serves this file to). A paragraph, a heading or a span holds text and inline elements,
// never a block: a <div> written in a <p> closes the <p> early, and the page would then number
// every element after it differently from the file.
const PHRASING_ONLY = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'b', 'i', 'em', 'strong', 'small', 'code', 'label',
  'button', 'pre', 'sup', 'sub', 'mark', 'q', 'cite', 'abbr', 'time', 'dt', 'caption', 'figcaption', 'summary',
]);
const BLOCKS = new Set([
  'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'figure', 'figcaption', 'ul', 'ol', 'li',
  'dl', 'dd', 'dt', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'form', 'fieldset', 'blockquote', 'p', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'details', 'summary', 'address',
]);

export const canNest = (parentTag, childTag) => !(PHRASING_ONLY.has(parentTag) && BLOCKS.has(childTag));

// Refuses an element where HTML does not let it stand.
export function checkNesting(parentTag, childTag) {
  if (canNest(parentTag, childTag)) return;
  const ending = `the browser would end the <${parentTag}> before it`;
  throw new Error(`a <${childTag}> cannot go inside a <${parentTag}>: ${ending}`);
}
