// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// schedule(elements): data-after="a,b" data-duration="2w" (or data-start, data-end, data-at;
// data-end with data-duration counts back)
// become data-start and data-end, YYYY-MM-DD. A task after others starts when the last of them
// ends. Each element's dates come back as day numbers, { s, e }.
import { dayOf, isoOf, lengthOf } from './dates.js';

class Scheduler {
  constructor(root, problems) {
    this.root = root;
    this.problems = problems;
    this.done = new Map();
  }

  dependenciesOf(element) {
    return element.dataset.after.split(/[\s,]+/).map(id => {
      const dependency = this.root.querySelector(`#${CSS.escape(id)}`);
      if (!dependency) this.problems.push({ rule: 'unknown-id', id, on: element.id });
      return dependency;
    }).filter(Boolean);
  }

  // An element's dates, its dependencies' first. A loop of dependencies is a problem.
  resolve(element, seen = new Set()) {
    if (this.done.has(element)) return this.done.get(element);
    if (seen.has(element)) {
      this.problems.push({ rule: 'schedule-loop', id: element.id });
      return { s: 0, e: 0 };
    }
    seen.add(element);
    const dates = this.datesOf(element, seen);
    this.done.set(element, dates);
    element.dataset.start = isoOf(dates.s);
    element.dataset.end = isoOf(dates.e);
    return dates;
  }

  datesOf(element, seen) {
    const data = element.dataset;
    let start = dayOf(data.start ?? data.at), end = dayOf(data.end);
    const after = Number.isNaN(start) && data.after ? this.dependenciesOf(element) : [];
    if (after.length) start = Math.max(...after.map(dependency => this.resolve(dependency, seen).e));
    // An end and a duration count back to the start.
    if (Number.isNaN(start) && !Number.isNaN(end)) start = end - lengthOf(data.duration);
    if (Number.isNaN(end) && !Number.isNaN(start)) {
      const duration = lengthOf(data.duration);
      end = start + (Number.isNaN(duration) ? 0 : duration);
    }
    if (Number.isNaN(start)) {
      this.problems.push({ rule: 'no-start', id: element.id, hint: 'give data-start (or data-at), or data-after' });
      start = end = 0;
    }
    return { s: start, e: Math.max(end, start) };
  }
}

export function schedule(elements, root, problems) {
  const scheduler = new Scheduler(root, problems);
  for (const element of elements) scheduler.resolve(element);
  return elements.map(element => scheduler.done.get(element));
}
