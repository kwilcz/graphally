// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The connections as data: <script type="application/json"> holding [{ "from": "a", "to": "b",
// "label": "…", …options of connect }] or ["a", "b", "label"]. via points are [x, y] or
// "id.anchor" (anchor: top, right, center …).
import { pointAt } from './geometry.js';

const BAD_LINES_HINT = 'the connections must be a JSON array';

// One entry as connect()'s from, to and options.
function entryOf(item) {
  if (Array.isArray(item)) return { from: item[0], to: item[1], ...(item[2] ? { label: item[2] } : {}) };
  return { ...item };
}

// The connections of one source; a source that is not a JSON array is a problem.
function parseConnections(source, problems) {
  try {
    const list = JSON.parse(source);
    if (Array.isArray(list)) return list;
    problems.push({ rule: 'bad-lines', message: 'not an array', hint: BAD_LINES_HINT });
  } catch (error) {
    problems.push({ rule: 'bad-lines', message: error.message, hint: BAD_LINES_HINT });
  }
  return [];
}

export function addConnectionsData(figure, api, geometry, sources) {
  // A via point: [x, y], or an element's named point ("db.top").
  const anchor = value => {
    if (Array.isArray(value)) return pointAt(Number(value[0]), Number(value[1]));
    const [reference, side = 'center'] = String(value).split('.'), box = geometry.find(reference)[0];
    if (!box[side]?.x && box[side]?.x !== 0) throw new Error(`"${value}": no anchor "${side}"`);
    return box[side];
  };
  for (const source of sources) {
    parseConnections(source, figure.problems).forEach((item, index) => {
      const entry = entryOf(item);
      try {
        if (!entry.from || !entry.to) throw new Error('needs "from" and "to"');
        const { from, to, via, ...options } = entry;
        // One via point, or a list of them.
        const points = Array.isArray(via?.[0]) || typeof via?.[0] === 'string' ? via : [via];
        const vias = via ? [].concat(points).map(anchor) : null;
        api.connect(from, to, { ...options, ...(vias ? { via: vias } : {}) });
      } catch (error) {
        figure.problems.push({ rule: 'bad-line', line: index + 1, message: error.message });
      }
    });
  }
}
