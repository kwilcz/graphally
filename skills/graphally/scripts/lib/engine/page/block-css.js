// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The building blocks' CSS: group, node, tile, figure, band, key and their variants.
import { textSize } from '../style.js';

export const BLOCK_CSS = `
/* Building blocks, styled like the rest of graphally: plain CSS that any rule of yours
   overrides (they have no specificity). Text after an icon is the name; <small> the line
   under it. */
:where(.graphally-page .group) {
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--wash);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 16px 16px;
}
:where(.graphally-page .group .group) { background: var(--card); }
:where(.graphally-page .group > h4) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 -6px;
  font-size: ${textSize(12)};
  font-weight: 600;
  color: var(--muted);
}
:where(.graphally-page .group > h4 > icon) { width: 18px; height: 18px; }
:where(.graphally-page .group > h4 small, .graphally-page .band > h4 small) {
  font-weight: 400;
  font-size: ${textSize(11.5)};
}
:where(.graphally-page .group.dashed, .graphally-page .group.external) {
  background: none;
  border: 1.2px dashed var(--muted);
}
:where(.graphally-page .group.plain) { background: none; border: 0; padding: 0; }
:where(.graphally-page .group.vnet) { background: var(--vnet); border: 1.4px solid var(--woad); }
:where(.graphally-page .group.subnet) { background: var(--card); border: 1.1px dashed var(--woad); }
:where(.graphally-page .group.region) {
  background: none;
  border: 1.4px dashed var(--woad);
  border-radius: 12px;
}
:where(.graphally-page .group:is(.vnet, .subnet, .region) > h4) { color: var(--woad); }
:where(.graphally-page .badges) { display: flex; gap: 4px; margin-left: auto; }
:where(.graphally-page .badge) {
  display: inline-flex;
  padding: 2px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 4px;
}
:where(.graphally-page .badge > icon) { width: 16px; height: 16px; }
:where(.graphally-page .node) {
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  column-gap: 10px;
  min-width: 150px;
  max-width: 210px;
  min-height: 48px;
  padding: 9px 12px;
  background: var(--card);
  border: 1.3px solid var(--ink);
  border-radius: 6px;
  font-weight: 500;
  line-height: 16px;
}
:where(.graphally-page .node:has(> icon)) { grid-template-columns: auto 1fr; }
:where(.graphally-page .node > icon) { grid-row: 1 / span 2; width: 26px; height: 26px; }
:where(.graphally-page :is(.node, .tile, .figure) > small) {
  grid-column: -2;
  font-size: ${textSize(11.5)};
  font-weight: 400;
  line-height: 15px;
  color: var(--muted);
}
:where(.graphally-page :is(.node, .tile).external) { border-style: dashed; border-color: var(--muted); }
:where(.graphally-page :is(.node, .tile).accent) { border: 2px solid var(--woad); color: var(--woad); }
:where(.graphally-page .figure.external) { color: var(--muted); }
:where(.graphally-page .figure.accent) { color: var(--woad); font-weight: 650; }
/* disabled: a part that is there but does not run. Grey, faded and dashed, icon included;
   a line to or from it turns grey and dashed too. */
:where(.graphally-page .disabled) { filter: grayscale(1); opacity: .5; }
:where(.graphally-page :is(.node, .tile, .card, .box, .group, .swatch).disabled) { border-style: dashed; }
:where(.graphally-page .tile) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 112px;
  padding: 10px 6px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  text-align: center;
  font-size: ${textSize(12.5)};
  font-weight: 500;
  line-height: 15px;
}
:where(.graphally-page .tile > icon) { width: 40px; height: 40px; }
:where(.graphally-page .figure) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 104px;
  text-align: center;
  font-size: ${textSize(12.5)};
  font-weight: 500;
  line-height: 15px;
}
:where(.graphally-page .figure > icon) { width: 48px; height: 48px; }
:where(.graphally-page .band) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
  background: var(--wash);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 16px;
}
:where(.graphally-page .band > h4) {
  flex-basis: 100%;
  margin: 0;
  font-size: ${textSize(12)};
  font-weight: 600;
  color: var(--muted);
}
:where(.graphally-page .key) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 22px;
  font-size: ${textSize(11.5)};
  color: var(--muted);
}
:where(.graphally-page .key > *) { display: flex; align-items: center; gap: 8px; }
:where(.graphally-page .swatch) { display: inline-block; width: 30px; border-top: 1.5px solid var(--ink); }
:where(.graphally-page .swatch.dashed) { border-top-style: dashed; }
:where(.graphally-page .swatch.box) {
  width: 26px;
  height: 14px;
  border: 1.2px dashed var(--muted);
  border-radius: 4px;
}
`;
