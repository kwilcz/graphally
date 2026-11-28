// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Defaults for the page and its building blocks; layout and spacing are utility classes
// (utilities.js) or plain CSS. :where() keeps their specificity at zero, so any rule of the
// author wins.
import { BLOCK_CSS } from './block-css.js';
import { SEQUENCE_CSS } from '../sequence/sequence-css.js';
import { textSize } from '../style.js';

const BASE_CSS = `
:where(.graphally-page) {
  font: 400 ${textSize(13)} Inter, "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif;
  color: var(--ink);
  line-height: 1.35;
}
:where(.graphally-page *) { box-sizing: border-box; }
:where(.graphally-page h1, .graphally-page h2, .graphally-page h3, .graphally-page h4,
  .graphally-page p, .graphally-page ul) {
  margin: 0;
}
:where(.graphally-page h1) { font-size: ${textSize(22)}; font-weight: 700; }
:where(.graphally-page h2) { font-size: ${textSize(17)}; font-weight: 600; }
:where(.graphally-page h3) { font-size: ${textSize(14)}; font-weight: 600; }
:where(.graphally-page h4) { font-size: ${textSize(13)}; font-weight: 600; }
:where(.graphally-page ul) { padding-left: 16px; }
:where(.graphally-page icon) {
  display: inline-block;
  width: 24px;
  height: 24px;
  flex: none;
  vertical-align: middle;
}
:where(.graphally-page .card) {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
}
:where(.graphally-page .box) {
  border: 1.5px solid var(--ink);
  border-radius: 6px;
  padding: 8px 12px;
  background: var(--card);
}
:where(.graphally-page .pill) {
  background: var(--wash);
  border-radius: 999px;
  padding: 4px 12px;
  text-align: center;
}
:where(.graphally-page .tag) {
  display: inline-block;
  background: var(--wash);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: ${textSize(11.5)};
  font-weight: 600;
}
:where(.graphally-page .banner) {
  background: var(--ink);
  color: var(--card);
  border-radius: 6px;
  padding: 10px 16px;
  font-weight: 600;
}
`;

export const PAGE_CSS = `${BASE_CSS}${BLOCK_CSS}${SEQUENCE_CSS}`;
