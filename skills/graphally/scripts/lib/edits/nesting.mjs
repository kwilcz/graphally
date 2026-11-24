// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What HTML lets an element hold (shared by the edits and the canvas page, which the canvas
// server serves this file to). A paragraph, a heading or a span holds text and inline elements,
// never a block: a <div> written in a <p> closes the <p> early, and the page would then number
// every element after it differently from the file. Tables, links and buttons have rules of
// their own.
const PHRASING_ONLY = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'b', 'i', 'em', 'strong', 'small', 'code', 'label',
  'button', 'pre', 'sup', 'sub', 'mark', 'q', 'cite', 'abbr', 'time', 'dt', 'caption', 'figcaption', 'summary',
]);
const BLOCKS = new Set([
  'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'figure', 'figcaption', 'ul', 'ol', 'li',
  'dl', 'dd', 'dt', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'form', 'fieldset', 'blockquote', 'p', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'details', 'summary', 'address',
]);

// Tables hold their parts only, and only in them: anything else the parser moves out of the table.
const TABLE_PARTS = { table: ['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr'], thead: ['tr'], tbody: ['tr'],
  tfoot: ['tr'], tr: ['td', 'th'] };
const PART_OF = { tr: ['table', 'thead', 'tbody', 'tfoot'], td: ['tr'], th: ['tr'], thead: ['table'], tbody: ['table'],
  tfoot: ['table'], caption: ['table'], colgroup: ['table'] };
// A link or a button in another closes the first.
const NOT_IN_ITSELF = new Set(['a', 'button', 'form', 'label']);

export function canNest(parentTag, childTag) {
  if (PHRASING_ONLY.has(parentTag) && BLOCKS.has(childTag)) return false;
  if (TABLE_PARTS[parentTag] && !TABLE_PARTS[parentTag].includes(childTag)) return false;
  if (PART_OF[childTag] && !PART_OF[childTag].includes(parentTag)) return false;
  return !(NOT_IN_ITSELF.has(childTag) && parentTag === childTag);
}

// Refuses an element where HTML does not let it stand.
export function checkNesting(parentTag, childTag) {
  if (canNest(parentTag, childTag)) return;
  const ending = `the browser would end the <${parentTag}> before it`;
  throw new Error(`a <${childTag}> cannot go inside a <${parentTag}>: ${ending}`);
}
