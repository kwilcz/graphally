// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Diagnostics an agent can act on. Model problems (unknown ids, icons, areas) come from
// parsing and rendering; geometric problems are measured on the result.
export function check(model, geo, routes, texts) {
  const problems = [...model.problems];
  const hit = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++)
    if (hit(texts[i], texts[j])) problems.push({ rule: 'text-overlap', a: texts[i].str, b: texts[j].str });
  for (const r of routes) if (r.labelCrowded) problems.push({ rule: 'label-crowded', edge: `${r.edge.from} -> ${r.edge.to}`, label: r.edge.label, hint: 'shorten the label or give the diagram more room' });
  // Crossings between edges (informational, reported as a count).
  let crossings = 0;
  const segs = routes.map(r => r.points.slice(1).map((p, i) => [r.points[i], p]));
  for (let a = 0; a < segs.length; a++) for (let b = a + 1; b < segs.length; b++) {
    let x = false;
    for (const [p1, p2] of segs[a]) { for (const [p3, p4] of segs[b]) if (cross(p1, p2, p3, p4)) { x = true; break; } if (x) break; }
    if (x) crossings++;
  }
  const ratio = geo.width / geo.height;
  const wideOk = ['lanes', 'flow', 'gantt', 'timeline'].includes(model.root.layout) ? 6.5 : 3.2;
  if (ratio > wideOk) problems.push({ rule: 'too-wide', ratio: +ratio.toFixed(1), hint: 'put some groups in a second row of the <layout> map' });
  if (ratio < 0.45 && model.root.layout !== 'sequence') problems.push({ rule: 'too-tall', ratio: +ratio.toFixed(1), hint: 'put some groups side by side in the <layout> map' });
  const seen = new Set();
  return { problems: problems.filter(p => { const k = JSON.stringify(p); return seen.has(k) ? false : seen.add(k); }), crossings };
}

function cross(p1, p2, p3, p4) {
  const h1 = Math.abs(p1.y - p2.y) < 0.01, h2 = Math.abs(p3.y - p4.y) < 0.01;
  if (h1 === h2) return false;
  const [h, v] = h1 ? [[p1, p2], [p3, p4]] : [[p3, p4], [p1, p2]];
  const y = h[0].y, x = v[0].x;
  const inX = x > Math.min(h[0].x, h[1].x) + 2 && x < Math.max(h[0].x, h[1].x) - 2;
  const inY = y > Math.min(v[0].y, v[1].y) + 2 && y < Math.max(v[0].y, v[1].y) - 2;
  return inX && inY;
}
