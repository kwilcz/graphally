// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The layout of a compiled SVG, read back from its elements: every group and node wrapper
// carries data-box="x,y,w,h", every edge line data-sides="out,in", and overrides appear as
// data-nudge, data-out and data-in. The next render keeps the layout stable with it.
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attrsOf = tag => Object.fromEntries([...tag.matchAll(/\s([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, unesc(v)]));
const nums = v => v.split(',').map(Number);

// readLayout(svgText) -> { id, source, nodes, groups, edges, overrides: { nodes, edges } },
// or null when the SVG carries no layout (not a graphally render, or an older one).
export function readLayout(svg) {
  const root = attrsOf((svg.match(/<svg\b[^>]*>/) || [''])[0]);
  const L = { id: root['data-diagram'] || '', source: root['data-source'] || '', nodes: {}, groups: {}, edges: {}, overrides: { nodes: {}, edges: {} } };
  let found = false;
  for (const [tag] of svg.matchAll(/<g\b[^>]*\sdata-(?:id|group|edge)="[^>]*>/g)) {
    const a = attrsOf(tag);
    if (a['data-group'] && a['data-box']) { L.groups[a['data-group']] = nums(a['data-box']); found = true; }
    else if (a['data-id'] && a['data-box']) {
      L.nodes[a['data-id']] = nums(a['data-box']); found = true;
      if (a['data-nudge']) L.overrides.nodes[a['data-id']] = { nudge: nums(a['data-nudge']) };
    } else if (a['data-edge'] && a['data-sides']) {
      const [out, inn] = a['data-sides'].split(',');
      L.edges[a['data-edge']] = { out, in: inn };
      const o = Object.fromEntries(['out', 'in'].filter(k => a[`data-${k}`]).map(k => [k, a[`data-${k}`]]));
      if (Object.keys(o).length) L.overrides.edges[a['data-edge']] = o;
    }
  }
  return found ? L : null;
}
