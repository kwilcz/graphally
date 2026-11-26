// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A grid as the drawing has it: its columns and rows, each as [start, end] in drawing units, its
// named areas as rectangles, and where an element sits in it. A subgrid (a lane of a process)
// has the tracks of the grid it takes them from.
const AXES = {
  col: { tracks: 'cols', gap: 'colGap', origin: 'x', size: 'w' },
  row: { tracks: 'rows', gap: 'rowGap', origin: 'y', size: 'h' },
};

// Where the first track starts past the content box's edge, and the gap's share of the room the
// tracks leave, as justify-content or align-content spread it.
function spreadOf(spread, room, count) {
  if (room <= 0 || count === 0) return { lead: 0, extra: 0 };
  if (spread === 'space-between') return { lead: 0, extra: count > 1 ? room / (count - 1) : 0 };
  if (spread === 'space-around') return { lead: room / count / 2, extra: room / count };
  if (spread === 'space-evenly') return { lead: room / (count + 1), extra: room / (count + 1) };
  if (spread === 'center') return { lead: room / 2, extra: 0 };
  return { lead: /end$/.test(spread ?? '') ? room : 0, extra: 0 };
}

// Each track's [start, end] in drawing units.
function spansOf(layout, axis) {
  const { tracks: name, gap: gapName, origin, size } = AXES[axis], tracks = layout[name], gap = layout[gapName];
  const used = tracks.reduce((sum, track) => sum + track, 0) + gap * Math.max(0, tracks.length - 1);
  const { lead, extra } = spreadOf(layout.spread?.[axis], (layout.size?.[size] ?? used) - used, tracks.length);
  let at = layout.origin[origin] + lead;
  return tracks.map(track => {
    const span = [at, at + track];
    at += track + gap + extra;
    return span;
  });
}

export function tracksOf(model, grid, axis) {
  for (let at = grid; at; at = model.parentOf(at)) {
    if (at.layout.kind === 'grid' && at.layout[AXES[axis].tracks].length) return spansOf(at.layout, axis);
  }
  return [];
}

// The track a coordinate is over or, in the gap between two, the nearer one.
export const trackAt = (tracks, value) => tracks.findIndex(([, end], index) => {
  const next = tracks[index + 1];
  return !next || value < (end + next[0]) / 2;
});

const isLine = value => /^-?\d+$/.test(value ?? '');
// Whether an element is placed on this axis by a numbered line (3, or 1 / -1).
export const placedByLine = (entry, axis) => isLine(entry?.place?.[axis]?.[0]);

// How many tracks an element spans: 3 / span 2, 3 / 5, or 1 / -1 (to the last line).
export function spanOf(entry, axis, count) {
  const [start, end] = entry?.place?.[axis] ?? [];
  if (/^span \d+$/.test(end ?? '')) return Number(end.split(' ')[1]);
  if (!isLine(start) || !isLine(end)) return 1;
  const last = Number(end) < 0 ? count + 2 + Number(end) : Number(end);
  return Math.max(1, last - Number(start));
}

// The area an element is placed in by name ([grid-area:edge]), or null.
export function areaOf(entry) {
  const start = entry?.place?.col?.[0];
  return start && start !== 'auto' && !isLine(start) && !start.startsWith('span') ? start : null;
}

// The grid's named areas, each with the rectangle its cells cover.
export function areasOf(model, grid) {
  const cols = tracksOf(model, grid, 'col'), rows = tracksOf(model, grid, 'row'), found = new Map();
  (grid.layout.areas ?? []).forEach((names, row) => names.forEach((name, col) => {
    if (name === '.' || !cols[col] || !rows[row]) return;
    const cell = { x1: cols[col][0], x2: cols[col][1], y1: rows[row][0], y2: rows[row][1] }, had = found.get(name);
    found.set(name, had ? { x1: Math.min(had.x1, cell.x1), x2: Math.max(had.x2, cell.x2),
      y1: Math.min(had.y1, cell.y1), y2: Math.max(had.y2, cell.y2) } : cell);
  }));
  return [...found].map(([name, { x1, x2, y1, y2 }]) => ({ name, rect: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } }));
}

// Every cell of the grid, to draw it over the diagram.
export function cellsOf(model, grid) {
  const cols = tracksOf(model, grid, 'col'), rows = tracksOf(model, grid, 'row');
  const across = cols.length ? cols : [[grid.box.x, grid.box.x + grid.box.w]];
  const down = rows.length ? rows : [[grid.box.y, grid.box.y + grid.box.h]];
  return down.flatMap(([y1, y2]) => across.map(([x1, x2]) => ({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 })));
}
