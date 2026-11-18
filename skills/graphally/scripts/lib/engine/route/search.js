// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The search: A* over the grid, from any of a line's start ports to any of its goal ports. A
// state is a grid point and the direction it was reached in (point * 4 + direction), so a bend
// can be priced. A route's cost is its length, weighted inside foreign containers and along
// container borders, plus bends, crossings and overlap with earlier routes.
import { BEND, CROSS, OVERLAP, FOREIGN, MIN_END, STUB } from './costs.js';
import { Heap } from './heap.js';

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];   // east, south, west, north

// The cheapest route for a connection (its allowed containers, bundle and end marks), or null.
export function astar(grid, starts, goals, { allowed, bundle, marks }) {
  if (!starts.length || !goals.length) return null;
  const { nx, ny, xs, ys, freeH, freeV, containerH, containerV, hugH, hugV } = grid;
  const { usedH, usedV, bundleH, bundleV, endLength } = grid, states = nx * ny * 4;
  // The search's arrays are made once per grid and reused: a state is unseen unless it carries
  // this search's stamp, so nothing is cleared between searches.
  const memory = grid.search ||= {
    cost: new Float64Array(states), previous: new Int32Array(states), stamp: new Uint32Array(states),
    generation: 0, heap: new Heap(),
  };
  const { cost, previous, stamp, heap } = memory, generation = ++memory.generation;
  heap.clear();
  const goalAt = new Map();
  for (const goal of goals) goalAt.set(goal.j * nx + goal.i, goal);
  const goalXs = goals.map(goal => xs[goal.i]), goalYs = goals.map(goal => ys[goal.j]);
  // The estimate: the Manhattan distance to the nearest goal.
  const estimate = point => {
    const x = xs[point % nx], y = ys[(point / nx) | 0];
    let nearest = Infinity;
    for (let t = 0; t < goalXs.length; t++) {
      nearest = Math.min(nearest, Math.abs(goalXs[t] - x) + Math.abs(goalYs[t] - y));
    }
    return nearest;
  };
  // A start's previous state is -2 - its index among the starts.
  for (const start of starts) {
    const point = start.j * nx + start.i, state = point * 4 + start.dir, initial = start.penalty || 0;
    if ((stamp[state] === generation ? cost[state] : Infinity) > initial) {
      cost[state] = initial;
      previous[state] = -2 - starts.indexOf(start);
      stamp[state] = generation;
      heap.push(initial + estimate(point), state);
    }
  }
  let best = Infinity, bestState = -1, bestGoal = null;
  while (heap.size) {
    const state = heap.pop(), priority = heap.key;
    if (priority >= best) break;
    const reached = cost[state], point = (state / 4) | 0;
    if (priority - estimate(point) > reached + 1e-6) continue;   // a stale entry
    const direction = state & 3, i = point % nx, j = (point / nx) | 0;
    const goal = goalAt.get(point);
    if (goal) {
      const inward = (goal.dir + 2) % 4;   // arriving means moving into the box
      const shortEnd = endLength && goal.standoff < MIN_END && marks.head ? STUB : 0;
      const total = reached + (direction === inward ? 0 : BEND + shortEnd) + (goal.penalty || 0);
      if (total < best) {
        best = total;
        bestState = state;
        bestGoal = goal;
      }
    }
    for (let next = 0; next < 4; next++) {
      if (next === (direction + 2) % 4) continue;   // no turning back
      const ni = i + DX[next], nj = j + DY[next];
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const segment = next === 0 ? point : next === 2 ? point - 1 : next === 1 ? point : point - nx;
      const horizontal = next % 2 === 0;
      if (!(horizontal ? freeH[segment] : freeV[segment])) continue;
      const nextPoint = nj * nx + ni;
      const length = horizontal ? Math.abs(xs[ni] - xs[i]) : Math.abs(ys[nj] - ys[j]);
      const container = horizontal ? containerH[segment] : containerV[segment];
      const weight = container >= 0 && !allowed.has(container) ? 1 + FOREIGN : 1;
      let step = length * (weight + ((horizontal ? hugH[segment] : hugV[segment]) ? 2 : 0));
      if (next !== direction) {
        step += BEND;
        // A turn one short step before the box leaves too short an end.
        const goalNext = goalAt.get(nextPoint);
        const intoGoal = goalNext && marks.head && next === (goalNext.dir + 2) % 4;
        if (endLength && intoGoal && length + goalNext.standoff < MIN_END) step += STUB;
        // A turn right at the start.
        if (endLength && previous[state] < -1 && starts[-2 - previous[state]].standoff < MIN_END) {
          step += marks.tail ? 3 * STUB : STUB / 2;
        }
      }
      if (bundle && (horizontal ? bundleH[segment] : bundleV[segment]) === bundle) {
        step = length * 0.35;   // ride the bundle's trunk
      } else {
        step += (horizontal ? usedH[segment] : usedV[segment]) * OVERLAP;
        // Crossing an earlier route at the point it arrives at.
        const crosses = horizontal
          ? (nj > 0 && usedV[nextPoint - nx] && bundleV[nextPoint - nx] !== bundle)
            || (nj < ny - 1 && usedV[nextPoint] && bundleV[nextPoint] !== bundle)
          : (ni > 0 && usedH[nextPoint - 1] && bundleH[nextPoint - 1] !== bundle)
            || (ni < nx - 1 && usedH[nextPoint] && bundleH[nextPoint] !== bundle);
        if (crosses) step += CROSS;
      }
      const nextState = nextPoint * 4 + next, total = reached + step;
      if (total < (stamp[nextState] === generation ? cost[nextState] : Infinity)) {
        cost[nextState] = total;
        previous[nextState] = state;
        stamp[nextState] = generation;
        heap.push(total + estimate(nextPoint), nextState);
      }
    }
  }
  if (bestState < 0) return null;
  return pathOf(grid, previous, bestState, starts, bestGoal, best);
}

// The route the search found, walked back from its goal state.
function pathOf({ nx, xs, ys }, previous, goalState, starts, goal, cost) {
  const states = [];
  let state = goalState, startIndex = 0;
  while (state >= 0) {
    states.push(state);
    const before = previous[state];
    if (before < -1) {
      startIndex = -2 - before;
      break;
    }
    state = before;
  }
  states.reverse();
  const start = starts[startIndex], cells = states.map(each => (each / 4) | 0);
  const points = [start.boundary, ...cells.map(cell => ({ x: xs[cell % nx], y: ys[(cell / nx) | 0] }))];
  points.push(goal.boundary);
  return {
    points, cells, startSide: start.side, goalSide: goal.side,
    startCoord: start.coord, goalCoord: goal.coord, cost, start, goal,
  };
}

// Marks a route's segments as used (delta 1) or frees them (delta -1); a bundle's route also
// owns them, so the bundle's other lines can ride them.
export function markUse(grid, cells, delta, bundle) {
  const own = (owners, segment) => {
    if (delta > 0) {
      if (bundle) owners[segment] = bundle;
    } else if (owners[segment] === bundle) owners[segment] = 0;
  };
  for (let t = 1; t < cells.length; t++) {
    const a = cells[t - 1], b = cells[t];
    if (b === a + 1) { grid.usedH[a] += delta; own(grid.bundleH, a); }
    else if (b === a - 1) { grid.usedH[b] += delta; own(grid.bundleH, b); }
    else if (b === a + grid.nx) { grid.usedV[a] += delta; own(grid.bundleV, a); }
    else if (b === a - grid.nx) { grid.usedV[b] += delta; own(grid.bundleV, b); }
  }
}
