// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// <script type="graphally" before>: runs on the page before it is laid out, to make or place
// elements (rows from a list, bars on a timeline). Dates come from time.js.
import { schedule } from '../time/schedule.js';
import { timeline } from '../time/timeline.js';
import { sequence } from '../sequence/sequence.js';
import { runAuthorScript } from './run-script.js';

const DATED = '[data-start], [data-after], [data-at], [data-end]';
// A reference that is already a selector, not a bare id.
const SELECTOR = /^[#.[]|[\s>:]/;

function make(tag, attributes = {}, text = '') {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text) element.textContent = text;
  return element;
}

export function runBeforeScripts(root, scripts, problems) {
  const elementOf = reference => (typeof reference === 'string' ? root.querySelector(reference) : reference);
  const scope = {
    root,
    el: selector => root.querySelector(SELECTOR.test(selector) ? selector : `#${CSS.escape(selector)}`),
    all: selector => [...root.querySelectorAll(selector)],
    make,
    schedule: (selector = DATED) => {
      const elements = typeof selector === 'string' ? root.querySelectorAll(selector) : [].concat(selector);
      return schedule([...elements], root, problems);
    },
    timeline: (box, options) => timeline(elementOf(box), options, problems),
    sequence: (box, options) => sequence(elementOf(box), options, problems),
  };
  for (const code of scripts) runAuthorScript(code, scope, problems, { when: 'before' });
}
