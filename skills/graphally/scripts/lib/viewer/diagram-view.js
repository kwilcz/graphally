// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where a diagram is shown: a .graphally-view after it, with a shadow root of its own, so its SVG
// ids do not meet another diagram's and the page's CSS does not reach it.
import THEME from '../../../assets/theme.css';
import { viewCss } from './page-style.js';

export function viewOf(diagram) {
  const existing = diagram.nextElementSibling?.classList.contains('graphally-view') ? diagram.nextElementSibling : null;
  const view = existing || Object.assign(document.createElement('div'), { className: 'graphally-view' });
  if (!existing) diagram.after(view);
  return { view, shadow: view.shadowRoot || view.attachShadow({ mode: 'open' }) };
}

export function show(shadow, nodes) {
  const css = document.createElement('style'), view = document.createElement('div');
  css.textContent = viewCss(THEME);
  view.className = 'view';
  view.append(...nodes);
  shadow.replaceChildren(css, view);
}

function valueText(value) {
  if (Array.isArray(value)) return value.join('|');
  return typeof value === 'object' ? JSON.stringify(value) : value;
}

function problemItem({ rule, hint, ...fields }) {
  const item = document.createElement('li');
  const values = Object.entries(fields).map(([key, value]) => `${key}=${valueText(value)}`).join(' ');
  item.textContent = `${rule}: ${values}${hint ? ` (${hint})` : ''}`;
  return item;
}

export function problemsList(problems) {
  const list = document.createElement('ul');
  list.className = 'problems';
  list.append(...problems.map(problemItem));
  return list;
}

export function failureNote(error) {
  const note = document.createElement('p');
  note.className = 'problems';
  note.textContent = `graphally could not draw this diagram: ${error.message}`;
  return note;
}
