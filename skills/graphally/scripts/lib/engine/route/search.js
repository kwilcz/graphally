// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The search: A* over the grid, from any of a line's start ports to any of its goal ports. A
// state is a grid point and the direction it was reached in (point * 4 + direction), so a bend
// can be priced. A route's cost is its length, weighted inside foreign containers and along
// container borders, plus bends, crossings and overlap with earlier routes.
import { BEND, CROSS, OVERLAP, RIDE, BEND_PULL, FOREIGN, MIN_END, STUB } from './costs.js';
import { Heap } from './heap.js';

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];   // east, south, west, north
const opposite = direction => (direction + 2) % 4;

// The search's arrays, made once per grid and reused: a state is unseen unless it carries the
// current search's stamp, so nothing is cleared between searches.
function memoryOf(grid) {
  const states = grid.nx * grid.ny * 4;
  grid.search ||= {
    cost: new Float64Array(states), previous: new Int32Array(states), stamp: new Uint32Array(states),
    generation: 0, heap: new Heap(),
  };
  return grid.search;
}

class Search {
  constructor(grid, starts, goals, { allowed, bundle, bendLine, marks }) {
    Object.assign(this, { grid, starts, goals, allowed, bundle, bendLine, marks });
    const memory = memoryOf(grid);
    Object.assign(this, { cost: memory.cost, previous: memory.previous, stamp: memory.stamp, heap: memory.heap });
    this.generation = ++memory.generation;
    this.heap.clear();
    this.goalAt = new Map(goals.map(goal => [goal.j * grid.nx + goal.i, goal]));
    this.goalXs = goals.map(goal => grid.xs[goal.i]);
    this.goalYs = goals.map(goal => grid.ys[goal.j]);
    this.best = { cost: Infinity, state: -1, goal: null };
  }

  run() {
    this.starts.forEach((start, index) => this.seed(start, index));
    while (this.heap.size) {
      const state = this.heap.pop(), priority = this.heap.key;
      if (priority >= this.best.cost) break;
      if (!this.isStale(state, priority)) this.settle(state);
    }
    return this.best.state < 0 ? null : this.path();
  }

  // The estimate: the Manhattan distance to the nearest goal.
  estimate(point) {
    const { grid, goalXs, goalYs } = this, x = grid.xs[point % grid.nx], y = grid.ys[(point / grid.nx) | 0];
    let nearest = Infinity;
    for (let t = 0; t < goalXs.length; t++) {
      nearest = Math.min(nearest, Math.abs(goalXs[t] - x) + Math.abs(goalYs[t] - y));
    }
    return nearest;
  }

  costOf(state) { return this.stamp[state] === this.generation ? this.cost[state] : Infinity; }

  // A cheaper way to a state: kept, and queued. A start's previous state is -2 - its index.
  reach(state, cost, previous, point) {
    if (!(cost < this.costOf(state))) return;
    this.cost[state] = cost;
    this.previous[state] = previous;
    this.stamp[state] = this.generation;
    this.heap.push(cost + this.estimate(point), state);
  }

  seed(start, index) {
    const point = start.j * this.grid.nx + start.i, initial = start.penalty || 0;
    if (this.costOf(point * 4 + start.dir) > initial) this.reach(point * 4 + start.dir, initial, -2 - index, point);
  }

  isStale(state, priority) { return priority - this.estimate((state / 4) | 0) > this.cost[state] + 1e-6; }

  settle(state) {
    const point = (state / 4) | 0, direction = state & 3, goal = this.goalAt.get(point);
    if (goal) this.arrive(state, direction, goal);
    for (let next = 0; next < 4; next++) if (next !== opposite(direction)) this.step(state, point, direction, next);
  }

  // Arriving means moving into the box: any other direction takes a bend there.
  arrive(state, direction, goal) {
    const shortEnd = this.grid.endLength && goal.standoff < MIN_END && this.marks.head ? STUB : 0;
    const turn = BEND + shortEnd + this.pullOf((state / 4) | 0);
    const total = this.cost[state] + (direction === opposite(goal.dir) ? 0 : turn) + (goal.penalty || 0);
    if (total < this.best.cost) this.best = { cost: total, state, goal };
  }

  step(state, point, direction, next) {
    const { grid } = this, i = point % grid.nx + DX[next], j = ((point / grid.nx) | 0) + DY[next];
    if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) return;
    const segment = next === 2 ? point - 1 : next === 3 ? point - grid.nx : point, horizontal = next % 2 === 0;
    if (!(horizontal ? grid.freeH[segment] : grid.freeV[segment])) return;
    const nextPoint = j * grid.nx + i;
    const length = horizontal
      ? Math.abs(grid.xs[i] - grid.xs[point % grid.nx])
      : Math.abs(grid.ys[j] - grid.ys[(point / grid.nx) | 0]);
    const cost = this.stepCost(state, direction, next, segment, nextPoint, length);
    this.reach(nextPoint * 4 + next, this.cost[state] + cost, state, nextPoint);
  }

  stepCost(state, direction, next, segment, nextPoint, length) {
    const horizontal = next % 2 === 0;
    let cost = length * this.weightOf(segment, horizontal);
    if (next !== direction) cost = this.withTurn(cost, state, next, nextPoint, length);
    const turn = next !== direction ? BEND + this.pullOf((state / 4) | 0) : 0;
    if (this.ridesTrunk(segment, horizontal)) return length * RIDE + turn;
    return cost + this.usedOf(segment, horizontal) * OVERLAP + (this.crosses(nextPoint, horizontal) ? CROSS : 0);
  }

  // Per pixel: more inside a container the line does not belong to, and along a container's border.
  weightOf(segment, horizontal) {
    const { grid } = this, container = horizontal ? grid.containerH[segment] : grid.containerV[segment];
    const foreign = container >= 0 && !this.allowed.has(container) ? 1 + FOREIGN : 1;
    return foreign + ((horizontal ? grid.hugH[segment] : grid.hugV[segment]) ? 2 : 0);
  }

  // A bend; more for one a short step before the box, which leaves too short an end, and for one
  // right at the start. Added one by one, as the costs have always been summed.
  withTurn(cost, state, next, nextPoint, length) {
    const { grid, marks } = this;
    cost += BEND + this.pullOf((state / 4) | 0);
    if (!grid.endLength) return cost;
    const goal = this.goalAt.get(nextPoint);
    if (goal && marks.head && next === opposite(goal.dir) && length + goal.standoff < MIN_END) cost += STUB;
    const before = this.previous[state];
    if (before < -1 && this.starts[-2 - before].standoff < MIN_END) cost += marks.tail ? 3 * STUB : STUB / 2;
    return cost;
  }

  // A bend at a point costs a little more the further it is from the line the route would rather
  // bend on (bend-lines.js).
  pullOf(point) {
    if (!this.bendLine) return 0;
    const { grid, bendLine } = this;
    const at = bendLine.across === 'x' ? grid.xs[point % grid.nx] : grid.ys[(point / grid.nx) | 0];
    return BEND_PULL * Math.abs(at - bendLine.at);
  }

  ridesTrunk(segment, horizontal) {
    const owner = horizontal ? this.grid.bundleH[segment] : this.grid.bundleV[segment];
    return Boolean(this.bundle) && owner === this.bundle;
  }

  usedOf(segment, horizontal) { return horizontal ? this.grid.usedH[segment] : this.grid.usedV[segment]; }

  // Crossing an earlier route of another bundle at the point it arrives at: a run across the
  // step's axis on either side of the point.
  crosses(point, horizontal) {
    const { grid } = this;
    if (horizontal) {
      const j = (point / grid.nx) | 0;
      return this.isForeign(grid.usedV, grid.bundleV, j > 0, point - grid.nx)
        || this.isForeign(grid.usedV, grid.bundleV, j < grid.ny - 1, point);
    }
    const i = point % grid.nx;
    return this.isForeign(grid.usedH, grid.bundleH, i > 0, point - 1)
      || this.isForeign(grid.usedH, grid.bundleH, i < grid.nx - 1, point);
  }

  isForeign(used, owner, inside, segment) { return inside && used[segment] && owner[segment] !== this.bundle; }

  // The route found, walked back from its goal state.
  path() {
    const { grid, best } = this, states = [];
    let state = best.state, startIndex = 0;
    for (; state >= 0; state = this.previous[state]) {
      states.push(state);
      if (this.previous[state] < -1) {
        startIndex = -2 - this.previous[state];
        break;
      }
    }
    const start = this.starts[startIndex], cells = states.reverse().map(each => (each / 4) | 0);
    const pointOf = cell => ({ x: grid.xs[cell % grid.nx], y: grid.ys[(cell / grid.nx) | 0] });
    const points = [start.boundary, ...cells.map(pointOf), best.goal.boundary];
    return {
      points, cells, startSide: start.side, goalSide: best.goal.side,
      startCoord: start.coord, goalCoord: best.goal.coord, cost: best.cost, start, goal: best.goal,
    };
  }
}

// The cheapest route for a connection (its allowed containers, bundle and end marks), or null.
export function astar(grid, starts, goals, connection) {
  if (!starts.length || !goals.length) return null;
  return new Search(grid, starts, goals, connection).run();
}

// Marks a route's segments as used (delta 1) or frees them (delta -1); a bundle's route also
// owns them, so the bundle's other lines can ride them.
export function markUse(grid, cells, delta, bundle) {
  const own = (owners, segment) => {
    if (delta > 0 && bundle) owners[segment] = bundle;
    else if (delta <= 0 && owners[segment] === bundle) owners[segment] = 0;
  };
  for (let t = 1; t < cells.length; t++) {
    const [segment, horizontal] = segmentBetween(grid, cells[t - 1], cells[t]);
    if (segment < 0) continue;
    (horizontal ? grid.usedH : grid.usedV)[segment] += delta;
    own(horizontal ? grid.bundleH : grid.bundleV, segment);
  }
}

// The segment between two neighbouring grid points, by its west or north end, and its axis.
function segmentBetween(grid, a, b) {
  if (b === a + 1 || b === a - 1) return [Math.min(a, b), true];
  if (b === a + grid.nx || b === a - grid.nx) return [Math.min(a, b), false];
  return [-1, false];
}
