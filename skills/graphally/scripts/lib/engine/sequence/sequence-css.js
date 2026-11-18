// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The CSS of what sequence() makes: lifelines, messages, activations and fragments.

export const SEQUENCE_CSS = `
/* What sequence() makes. */
:where(.graphally-page .seq) { column-gap: 18px; }
:where(.graphally-page .seq > [data-who]) { min-width: 0; }
:where(.graphally-page .msg) { padding: 6px 0 14px; text-align: center; font-size: 12.5px; }
:where(.graphally-page .msg.self) {
  justify-self: start;
  margin-left: calc(50% + 48px);
  padding-bottom: 24px;
  text-align: left;
  white-space: nowrap;
}
:where(.graphally-page .msg > .label) { padding: 0 4px; background: var(--bg); }
:where(.graphally-page .num) {
  display: inline-grid;
  place-items: center;
  width: 17px;
  height: 17px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--card);
  font-size: 10px;
  font-weight: 700;
  vertical-align: 1px;
}
:where(.graphally-page .lifeline) { justify-self: center; width: 0; border-left: 1px dashed var(--line); }
:where(.graphally-page .activation) {
  justify-self: center;
  width: 12px;
  margin-top: -9px;
  background: var(--card);
  border: 1.2px solid var(--ink);
}
:where(.graphally-page :is(.frag-box, .frag-tab, .frag-else, .frag-end)) {
  margin-inline: max(0px, calc(100% / var(--k) / 2 - 38px + var(--depth) * 12px));
}
:where(.graphally-page .frag-box) { border: 1px solid var(--ink); }
:where(.graphally-page .frag-tab) {
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
}
:where(.graphally-page .frag-tab > b) {
  padding: 3px 16px 3px 8px;
  background: var(--card);
  border: 1px solid var(--ink);
  border-width: 0 1px 1px 0;
  clip-path: polygon(0 0, 100% 0, 100% 55%, calc(100% - 8px) 100%, 0 100%);
  font-size: 11px;
}
:where(.graphally-page .guard) { color: var(--muted); }
:where(.graphally-page .frag-else) { padding: 4px 8px; border-top: 1px dashed var(--ink); font-size: 11.5px; }
:where(.graphally-page .frag-end) { height: 12px; }
:where(.graphally-page .who-group) { margin: -36px calc(100% / var(--k) / 2 - 124px) 0; }
`;
