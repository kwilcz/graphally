// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Ports: where a line leaves or enters a box. A port is a point on the box's edge (its boundary)
// and the grid point just outside it, where the search starts or ends.
import { CONTAINER_MARGIN } from './costs.js';
import { sharedSpan } from './geometry.js';

// The grid index of a coordinate: exact at half-pixel precision, else the nearest line.
function snap(indexOf, values, value) {
  const rounded = Math.round(value * 2) / 2;
  if (indexOf.has(rounded)) return indexOf.get(rounded);
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i] - value) < Math.abs(values[best] - value)) best = i;
  }
  return best;
}

// Every grid point between a port and its box's clearance is free (nothing thin stands in between).
function clearTo(grid, side, i, j, edge) {
  const horizontal = side % 2 === 0, step = side === 0 || side === 1 ? -1 : 1;
  for (let at = horizontal ? i : j; ; at += step) {
    const value = horizontal ? grid.xs[at] : grid.ys[at];
    if (value === undefined || (step < 0 ? value <= edge : value >= edge)) return true;
    if (!grid.freePoint[(horizontal ? j : at) * grid.nx + (horizontal ? at : i)]) return false;
  }
}

// The point on a box's side at a coordinate along it, and the point a standoff out from it.
function sidePoints(rect, side, coord, standoff) {
  const boundaryX = side === 0 ? rect.x + rect.w : side === 2 ? rect.x : coord;
  const boundaryY = side === 1 ? rect.y + rect.h : side === 3 ? rect.y : coord;
  const outX = side === 0 ? boundaryX + standoff : side === 2 ? boundaryX - standoff : boundaryX;
  const outY = side === 1 ? boundaryY + standoff : side === 3 ? boundaryY - standoff : boundaryY;
  return { boundaryX, boundaryY, outX, outY };
}

// A port a standoff out: its grid point must be free, and so must the way back to the box's
// clearance (inside it, every point is blocked by the box itself).
function portAtStandoff(rect, side, coord, grid, near, standoff) {
  const { boundaryX, boundaryY, outX, outY } = sidePoints(rect, side, coord, standoff);
  const i = snap(grid.indexOfX, grid.xs, outX), j = snap(grid.indexOfY, grid.ys, outY);
  const edge = (side % 2 === 0 ? boundaryX : boundaryY) + (side === 0 || side === 1 ? near : -near);
  if (!grid.freePoint[j * grid.nx + i] || (standoff !== near && !clearTo(grid, side, i, j, edge))) return null;
  // The first segment stays perpendicular: the snapped grid point defines the port.
  const along = side % 2 === 0 ? grid.ys[j] : grid.xs[i];
  const boundary = side % 2 === 0 ? { x: boundaryX, y: along } : { x: along, y: boundaryY };
  return { i, j, side, coord: along, boundary, dir: side, standoff };
}

// The port of an end on a side, at a coordinate along it. With the page's small clearance the
// port sits a full end length out (grid.endLength) when the way there is free, so the line runs
// that far before it may turn; else at the clearance. longer: a first choice further out (a
// bundle's marked end, so its trunk turns away from the box). Null when no standoff is free.
export function portAt(end, side, coord, grid, clearance, longer = 0) {
  const near = end.isGroup ? CONTAINER_MARGIN : clearance;
  const standoffs = [...new Set([longer, grid.endLength, near])].filter(out => out >= near).sort((a, b) => b - a);
  for (const standoff of standoffs) {
    const port = portAtStandoff(end.rect, side, coord, grid, near, standoff);
    if (port) return port;
  }
  return null;
}

// The ports on one side: its middle; facing the other box, the middle of the stretch they share;
// and where the middle is blocked, the first free point further along. A circle or diamond has
// the middle only.
function portsOnSide(end, side, shared, grid, clearance) {
  const { rect } = end, upright = side % 2 === 0, at = coord => portAt(end, side, coord, grid, clearance);
  const middle = at(upright ? rect.y + rect.h / 2 : rect.x + rect.w / 2);
  if (rect.round) return [middle];
  const facing = shared ? [at(shared.mid)] : [];
  if (middle) return [middle, ...facing];
  for (const fraction of [0.25, 0.75, 0.15, 0.85]) {
    const port = at(upright ? rect.y + rect.h * fraction : rect.x + rect.w * fraction);
    if (port) return [middle, ...facing, port];
  }
  return [middle, ...facing];
}

// The ports an end may use, on all four sides.
export function portsOf(connection, which, grid, clearance) {
  const end = connection[which], { rect } = end;
  const other = connection[which === 'source' ? 'target' : 'source'].rect;
  const acrossY = sharedSpan(rect.y, rect.h, other.y, other.h), acrossX = sharedSpan(rect.x, rect.w, other.x, other.w);
  return [0, 1, 2, 3].flatMap(side => portsOnSide(end, side, side % 2 === 0 ? acrossY : acrossX, grid, clearance)).filter(Boolean);
}
