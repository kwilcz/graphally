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

// The port of an end on a side, at a coordinate along it. With the page's small clearance the
// port sits a full end length out (grid.endLength) when the way there is free, so the line runs
// that far before it may turn; else at the clearance. longer: a first choice further out (a
// bundle's marked end, so its trunk turns away from the box). Null when no standoff is free.
export function portAt(end, side, coord, grid, clearance, longer = 0) {
  const { rect } = end, near = end.isGroup ? CONTAINER_MARGIN : clearance;
  const standoffs = [...new Set([longer, grid.endLength, near])]
    .filter(out => out >= near)
    .sort((a, b) => b - a);
  for (const standoff of standoffs) {
    // The point on the box's edge, and the point a standoff out from it.
    let boundaryX = coord, boundaryY = coord;
    if (side === 0) boundaryX = rect.x + rect.w;
    else if (side === 2) boundaryX = rect.x;
    else if (side === 1) boundaryY = rect.y + rect.h;
    else boundaryY = rect.y;
    const outX = side === 0 ? boundaryX + standoff : side === 2 ? boundaryX - standoff : boundaryX;
    const outY = side === 1 ? boundaryY + standoff : side === 3 ? boundaryY - standoff : boundaryY;
    const i = snap(grid.indexOfX, grid.xs, outX), j = snap(grid.indexOfY, grid.ys, outY);
    // The way back to the clearance must be free; inside it, every point is blocked by the box itself.
    const edge = (side % 2 === 0 ? boundaryX : boundaryY) + (side === 0 || side === 1 ? near : -near);
    if (!grid.freePoint[j * grid.nx + i] || (standoff !== near && !clearTo(grid, side, i, j, edge))) continue;
    // Keep the first segment perpendicular: the snapped grid point defines the port.
    if (side % 2 === 0) boundaryY = grid.ys[j];
    else boundaryX = grid.xs[i];
    const along = side % 2 === 0 ? grid.ys[j] : grid.xs[i];
    return { i, j, side, coord: along, boundary: { x: boundaryX, y: boundaryY }, dir: side, standoff };
  }
  return null;
}

// The ports an end may use: the middle of each side; on a side facing the other box, the middle
// of the stretch they share; and where the middle is blocked, a free point further along. A
// circle or diamond has the middles only.
export function portsOf(connection, which, grid, clearance) {
  const end = connection[which], { rect } = end;
  const other = connection[which === 'source' ? 'target' : 'source'].rect;
  const acrossY = sharedSpan(rect.y, rect.h, other.y, other.h);
  const acrossX = sharedSpan(rect.x, rect.w, other.x, other.w);
  const ports = [];
  for (const side of [0, 1, 2, 3]) {
    const upright = side % 2 === 0;
    const middle = portAt(end, side, upright ? rect.y + rect.h / 2 : rect.x + rect.w / 2, grid, clearance);
    ports.push(middle);
    if (rect.round) continue;
    if (upright && acrossY) ports.push(portAt(end, side, acrossY.mid, grid, clearance));
    if (!upright && acrossX) ports.push(portAt(end, side, acrossX.mid, grid, clearance));
    if (middle) continue;
    for (const fraction of [0.25, 0.75, 0.15, 0.85]) {
      const along = upright ? rect.y + rect.h * fraction : rect.x + rect.w * fraction;
      const port = portAt(end, side, along, grid, clearance);
      if (port) {
        ports.push(port);
        break;
      }
    }
  }
  return ports.filter(Boolean);
}
