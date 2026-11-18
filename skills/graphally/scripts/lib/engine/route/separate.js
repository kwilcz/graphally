// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Parallel runs of different lines on one grid line are moved apart, 7px each, in the order of
// where they come from and go to, so that they read as separate lines and do not cross. The
// lines of one bundle stay together: they are its trunk.
import { listAt } from '../shared/maps.js';

const GAP = 7;

// The inner runs of every route along one axis; the end runs attach to ports and stay.
function runsOf(routes, horizontal) {
  const along = point => (horizontal ? point.x : point.y), across = point => (horizontal ? point.y : point.x);
  const runs = [];
  routes.forEach((route, routeIndex) => {
    const { points } = route;
    for (let s = 1; s < points.length - 2; s++) {
      const a = points[s], b = points[s + 1];
      if (!(Math.abs(across(a) - across(b)) < 0.01)) continue;
      runs.push({
        routeIndex, s, at: across(a),
        lo: Math.min(along(a), along(b)), hi: Math.max(along(a), along(b)),
        order: (across(points[s - 1]) + across(points[s + 2])) / 2,
      });
    }
  });
  return runs;
}

// Runs that overlap on one line: spread about the line, unless they are of one route or one bundle.
function spread(routes, cluster, horizontal) {
  const bundle = routes[cluster[0].routeIndex].bundle;
  const oneBundle = bundle && cluster.every(run => routes[run.routeIndex].bundle === bundle);
  if (new Set(cluster.map(run => run.routeIndex)).size <= 1 || oneBundle) return;
  cluster.sort((a, b) => a.order - b.order);
  cluster.forEach((run, index) => {
    const offset = (index - (cluster.length - 1) / 2) * GAP;
    const points = routes[run.routeIndex].points;
    if (horizontal) {
      points[run.s].y += offset;
      points[run.s + 1].y += offset;
    } else {
      points[run.s].x += offset;
      points[run.s + 1].x += offset;
    }
  });
}

export function separateParallels(routes) {
  for (const horizontal of [true, false]) {
    const byLine = new Map();
    for (const run of runsOf(routes, horizontal)) listAt(byLine, Math.round(run.at)).push(run);
    for (const runs of byLine.values()) {
      runs.sort((a, b) => a.lo - b.lo);
      let cluster = [], reach = -Infinity;
      for (const run of runs) {
        if (run.lo > reach - 1 && cluster.length) {
          spread(routes, cluster, horizontal);
          cluster = [];
          reach = -Infinity;
        }
        cluster.push(run);
        reach = Math.max(reach, run.hi);
      }
      if (cluster.length) spread(routes, cluster, horizontal);
    }
  }
}
