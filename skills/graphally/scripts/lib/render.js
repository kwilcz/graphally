// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// Emit the SVG. Paint order is fixed: groups, edges, nodes, edge labels, legend.
// Colours are tokens (var(--ink) …) so the host page or the embedded theme decides them.
import { S, T } from './style.js';
import { resolveIcon, symbolFor } from './icons.js';

const fmt = n => String(Math.round(n * 10) / 10);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderSvg(model, geo, routes, m, opts) {
  const id = opts.id || 'g';
  const out = [], symbols = new Map(), markers = new Set(), texts = [];
  const W = geo.width, H = geo.height;

  const text = (str, x, y, cls, { anchor, tone, halo, weight } = {}) => {
    const t = m.text(str, cls);
    const left = anchor === 'middle' ? x - t.w / 2 : anchor === 'end' ? x - t.w : x;
    texts.push({ str, x: left, y: y - t.ascent, w: t.w, h: t.h });
    const style = [tone && `fill: var(--${tone})`, halo && `paint-order: stroke; stroke: var(--${halo === true ? 'card' : halo}); stroke-width: 4px; stroke-linejoin: round`, weight && `font-weight: ${weight}`].filter(Boolean);
    out.push(`<text class="${cls}" x="${fmt(x)}" y="${fmt(y)}"${anchor ? ` text-anchor="${anchor}"` : ''}${style.length ? ` style="${style.join('; ')}"` : ''}>${esc(str)}</text>`);
  };
  const icon = (name, x, y, size, owner) => {
    // <diagram icons=aws> lets AWS win names both vendors could mean ("load balancer").
    const order = String(model.attrs.icons || 'azure').toLowerCase() === 'aws' ? ['aws', 'azure'] : ['azure', 'aws'];
    const r = resolveIcon(name, order);
    if (!r) return false;
    if (r.error) {
      model.problems.push({ rule: 'unknown-icon', icon: name, on: owner, suggest: r.suggestions,
        ...(r.missing?.length ? { hint: `the ${r.missing.join(' and ')} icon pack is not downloaded: run node <skill dir>/scripts/fetch-icons.mjs` } : {}) });
      return false;
    }
    const sym = symbolFor(r, id);
    symbols.set(sym.id, sym.markup);
    out.push(`<use href="#${sym.id}" x="${fmt(x)}" y="${fmt(y)}" width="${size}" height="${size}"${r.kind === 'generic' ? ' style="color: var(--ink)"' : ''}></use>`);
    return true;
  };
  const rect = (r, { fill = 'none', stroke = 'ink', width = 1.5, dash, rx = 6 } = {}) => {
    const st = [fill !== 'none' ? `fill: var(--${fill})` : 'fill: none', stroke ? `stroke: var(--${stroke})` : 'stroke: none'];
    out.push(`<rect x="${fmt(r.x)}" y="${fmt(r.y)}" width="${fmt(r.w)}" height="${fmt(r.h)}" rx="${rx}" style="${st.join('; ')}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}></rect>`);
  };

  // A shared-service badge: the service's icon on a small card, with its name as tooltip.
  function badge(b, x, y, owner) {
    const k = S.group.badge;
    out.push(`<g><title>${esc(`uses ${b.label}${b.edge ? ` (${b.edge})` : ''}`)}</title>`);
    rect({ x, y, w: k, h: k }, { fill: 'card', stroke: 'line', width: 1, rx: 4 });
    if (!(b.icon && icon(b.icon, x + 3, y + 3, k - 6, owner))) text((b.label || '?')[0].toUpperCase(), x + k / 2, m.baseline(y, k, T.sub), T.sub, { anchor: 'middle', weight: 600 });
    out.push('</g>');
  }

  // Free shapes a layout asks for (lifelines, fragments, notes, numbers), by layer.
  function decor(layer) {
    for (const d of geo.decor || []) {
      if (d.layer !== layer) continue;
      const st = (fill, stroke) => `fill: ${fill && fill !== 'none' ? `var(--${fill})` : 'none'}; stroke: ${stroke ? `var(--${stroke})` : 'none'}`;
      if (d.t === 'rect') out.push(`<rect x="${fmt(d.x)}" y="${fmt(d.y)}" width="${fmt(d.w)}" height="${fmt(d.h)}" rx="${d.rx ?? 4}" style="${st(d.fill, d.stroke)}" stroke-width="${d.width ?? 1}"${d.dash ? ` stroke-dasharray="${d.dash}"` : ''}></rect>`);
      else if (d.t === 'line') out.push(`<line x1="${fmt(d.x1)}" y1="${fmt(d.y1)}" x2="${fmt(d.x2)}" y2="${fmt(d.y2)}" style="${st('none', d.stroke)}" stroke-width="${d.width ?? 1}"${d.dash ? ` stroke-dasharray="${d.dash}"` : ''}></line>`);
      else if (d.t === 'path') out.push(`<path d="${d.d}${d.closeTo ? ` H${fmt(d.closeTo.x)} Z` : ''}" style="${st(d.fill, d.stroke)}" stroke-width="${d.width ?? 1}"></path>`);
      else if (d.t === 'circle') out.push(`<circle cx="${fmt(d.cx)}" cy="${fmt(d.cy)}" r="${d.r}" style="${st(d.fill, d.stroke)}"></circle>`);
      else if (d.t === 'text') text(d.str, d.x, m.baseline(d.y, d.h, d.cls), d.cls, { anchor: d.anchor === 'start' ? undefined : d.anchor, tone: d.tone, halo: d.halo ? 'bg' : undefined });
    }
  }

  if (opts.standalone) out.push(`<rect width="100%" height="100%" style="fill: var(--bg)"></rect>`);

  // Title
  if (geo.title) {
    let y = geo.title.y;
    if (model.title) { text(model.title, geo.title.x, m.baseline(y, 22, T.title), T.title); y += 22; }
    if (model.subtitle) text(model.subtitle, geo.title.x, m.baseline(y, 18, T.subtitle), T.subtitle, { tone: 'muted' });
  }

  // Groups, outermost first
  const groups = [...geo.groups.values()].sort((a, b) => a.group.depth - b.group.depth);
  for (const r of groups) {
    const g = r.group, st = g.style;
    if (st === 'plain') {}
    else if (st === 'dashed' || st === 'boundary' || st === 'external' || g.external) rect(r, { fill: 'none', stroke: 'muted', width: 1.2, dash: '6 4', rx: S.group.radius });
    else if (st === 'vnet') rect(r, { fill: 'vnet', stroke: 'woad', width: 1.4, rx: 8 });
    else if (st === 'subnet') rect(r, { fill: 'card', stroke: 'woad', width: 1.1, dash: '5 4', rx: 6 });
    else if (st === 'component') rect(r, { fill: 'card', stroke: 'woad', width: 2, rx: 6 });
    else if (st === 'region') rect(r, { fill: 'none', stroke: 'woad', width: 1.4, dash: '8 5', rx: 12 });
    else rect(r, { fill: g.depth % 2 ? 'card' : 'wash', stroke: g.accent ? 'woad' : 'line', width: g.accent ? 2 : 1, rx: S.group.radius });
    if (r.lane) {
      // Swimlane: tinted title gutter, thin border shared with the next lane.
      const tint = ['lane-a', 'lane-b', 'lane-c', 'lane-d'][g.laneIndex % 4];
      rect(r, { fill: 'card', stroke: 'line', width: 1, rx: 0 });
      out.push(`<rect x="${fmt(r.x)}" y="${fmt(r.y)}" width="${fmt(r.gutter)}" height="${fmt(r.h)}" style="fill: var(--${tint}); stroke: var(--line)" stroke-width="1"></rect>`);
      g.lines.forEach((l, i) => text(l, r.head.x, m.baseline(r.head.y + i * 16, 16, T.group), T.group));
      continue;
    }
    if (r.gutter) {
      // A band with a title gutter: divider line and wrapped title.
      out.push(`<line x1="${fmt(r.x + r.gutter)}" y1="${fmt(r.y + 10)}" x2="${fmt(r.x + r.gutter)}" y2="${fmt(r.y + r.h - 10)}" style="stroke: var(--line)" stroke-width="1"></line>`);
      g.lines.forEach((l, i) => text(l, r.head.x, m.baseline(r.head.y + i * 16, 16, T.group), T.group, { tone: 'muted' }));
    } else if (r.head) {
      let x = r.head.x;
      const hh = r.head.h;
      if (g.icon && icon(g.icon, x, r.head.y + (hh - S.group.icon) / 2, S.group.icon, g.id)) x += S.group.icon + 6;
      if (g.label) {
        const y = m.baseline(r.head.y, hh, T.group);
        text(g.label, x, y, T.group, { tone: st === 'vnet' || st === 'subnet' || st === 'component' || st === 'region' ? 'woad' : 'muted' });
        x += m.width(g.label, T.group) + 8;
        if (g.sub) text(g.sub, x, y, T.gsub, { tone: 'muted' });
      }
    }
    if (r.badges) g.badges.forEach((b, i) => badge(b, r.badges.x + i * (S.group.badge + S.group.badgeGap), r.badges.y, g.id));
  }

  decor('under');
  // Edges
  for (const rt of routes) {
    const e = rt.edge, tone = e.accent ? 'woad' : 'ink', mk = e.open ? `${tone}-open` : tone;
    if (!e.line) markers.add(mk);
    const d = rounded(rt.points, S.edge.radius);
    out.push(`<path d="${d}" style="fill: none; stroke: var(--${tone})" stroke-width="${e.accent ? 2 : S.edge.width}"${e.dashed ? ' stroke-dasharray="5 4"' : ''}${!e.line ? ` marker-end="url(#${id}-${mk})"` : ''}${e.both ? ` marker-start="url(#${id}-${mk})"` : ''}></path>`);
  }
  decor('mid');

  // Nodes
  for (const r of geo.nodes.values()) {
    const n = r.node;
    const stroke = n.accent ? 'woad' : n.external || n.ghost ? 'muted' : 'ink';
    const dash = n.external || n.ghost ? '5 4' : null;
    // count=N: stacked copies behind the node (replicas, partitions, instances).
    const copies = Math.min(Number(n.attrs.count) || 1, 4) - 1;
    for (let c = copies; c >= 1; c--) if (n.style === 'card' || n.style === 'tile' || n.shape === 'task')
      rect({ x: r.x + 5 * c, y: r.y - 5 * c, w: r.w, h: r.h }, { fill: 'card', stroke, width: 1, dash, rx: 6 });
    if (n.style === 'card') {
      rect(r, { fill: 'card', stroke, width: n.accent ? 2 : 1.3, dash, rx: 6 });
      let tx = r.x + S.card.padX;
      if (n.icon && icon(n.icon, tx, r.y + (r.h - S.card.icon) / 2, S.card.icon, n.id)) tx += S.card.icon + S.card.iconGap;
      else if (n.icon) tx += S.card.icon + S.card.iconGap;
      const textH = n.lines.length * S.card.line + n.subLines.length * S.card.subLine;
      let y = r.y + (r.h - textH) / 2;
      for (const l of n.lines) { text(l, tx, m.baseline(y, S.card.line, T.label), T.label, { tone: n.accent ? 'woad' : undefined }); y += S.card.line; }
      for (const l of n.subLines) { text(l, tx, m.baseline(y, S.card.subLine, T.sub), T.sub, { tone: 'muted' }); y += S.card.subLine; }
    } else if (n.style === 'icon') {
      if (n.icon) icon(n.icon, r.x, r.y, r.w, n.id);
      else rect(r, { fill: 'card', stroke, width: 1.3, dash, rx: 8 });
      const b = n.extLabel.box;
      let y = b.y;
      for (const l of n.extLabel.lines) { text(l, b.x + b.w / 2, m.baseline(y, S.icon.line, T.tile), T.tile, { anchor: 'middle', tone: n.accent ? 'woad' : undefined }); y += S.icon.line; }
      for (const l of n.extLabel.subs) { text(l, b.x + b.w / 2, m.baseline(y, S.icon.subLine, T.sub), T.sub, { anchor: 'middle', tone: 'muted' }); y += S.icon.subLine; }
    } else if (n.style === 'tile') {
      const k = S[n.style];
      if (n.style === 'tile') rect(r, { fill: 'card', stroke: n.accent ? 'woad' : n.external ? 'muted' : 'line', width: n.accent ? 2 : 1, dash, rx: 8 });
      const top = r.y + (n.style === 'tile' ? S.tile.padY : 2);
      if (n.icon) icon(n.icon, r.x + (r.w - k.icon) / 2, top, k.icon, n.id);
      let y = top + k.icon + k.gap;
      for (const l of n.lines) { text(l, r.x + r.w / 2, m.baseline(y, k.line, T.tile), T.tile, { anchor: 'middle' }); y += k.line; }
      for (const l of n.subLines) { text(l, r.x + r.w / 2, m.baseline(y, k.subLine, T.sub), T.sub, { anchor: 'middle', tone: 'muted' }); y += k.subLine; }
    } else if (n.style === 'shape') {
      shape(n, r, stroke, dash);
    } else {
      rect(r, { fill: 'wash', stroke: n.accent ? 'woad' : 'line', width: 1, rx: r.h / 2, dash });
      text(n.label, r.x + r.w / 2, m.baseline(r.y, r.h, T.sub), T.sub, { anchor: 'middle' });
    }
  }

  // Process shapes (BPMN conventions): thin circle = start, thick = end, double = event,
  // diamond = gateway (× exclusive, + parallel, ○ inclusive), rounded box = task.
  function shape(n, r, stroke, dash) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const tone = n.accent ? 'woad' : stroke;
    if (n.shape === 'task' || n.shape === 'subprocess') {
      rect(r, { fill: 'card', stroke: tone, width: n.accent ? 2 : 1.3, dash, rx: 10 });
      // With an icon, the text centres in the space to the icon's right.
      if (n.icon) icon(n.icon, r.x + 9, r.y + 8, 18, n.id);
      const tcx = n.icon ? r.x + 30 + (r.w - 42) / 2 : cx;
      const textH = n.lines.length * 16 + n.subLines.length * 15;
      let y = r.y + (r.h - textH - (n.shape === 'subprocess' ? 10 : 0)) / 2;
      for (const l of n.lines) { text(l, tcx, m.baseline(y, 16, T.label), T.label, { anchor: 'middle' }); y += 16; }
      for (const l of n.subLines) { text(l, tcx, m.baseline(y, 15, T.sub), T.sub, { anchor: 'middle', tone: 'muted' }); y += 15; }
      if (n.shape === 'subprocess') {
        rect({ x: cx - 7, y: r.y + r.h - 18, w: 14, h: 14 }, { stroke: tone, width: 1.2, rx: 2 });
        out.push(`<path d="M${fmt(cx - 4)},${fmt(r.y + r.h - 11)} H${fmt(cx + 4)} M${fmt(cx)},${fmt(r.y + r.h - 15)} V${fmt(r.y + r.h - 7)}" style="fill: none; stroke: var(--${tone})" stroke-width="1.4"></path>`);
      }
    } else if (n.shape === 'gateway') {
      const h = r.w / 2;
      out.push(`<path d="M${fmt(cx)},${fmt(cy - h)} L${fmt(cx + h)},${fmt(cy)} L${fmt(cx)},${fmt(cy + h)} L${fmt(cx - h)},${fmt(cy)} Z" style="fill: var(--card); stroke: var(--${tone})" stroke-width="1.5"></path>`);
      const t = (n.kind2 || 'exclusive').toLowerCase(), k = 8;
      if (t === 'parallel') out.push(`<path d="M${fmt(cx - k)},${fmt(cy)} H${fmt(cx + k)} M${fmt(cx)},${fmt(cy - k)} V${fmt(cy + k)}" style="fill: none; stroke: var(--${tone})" stroke-width="2.6"></path>`);
      else if (t === 'inclusive') out.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="8" style="fill: none; stroke: var(--${tone})" stroke-width="2.2"></circle>`);
      else if (t !== 'none' && t !== 'plain') out.push(`<path d="M${fmt(cx - 6)},${fmt(cy - 6)} L${fmt(cx + 6)},${fmt(cy + 6)} M${fmt(cx + 6)},${fmt(cy - 6)} L${fmt(cx - 6)},${fmt(cy + 6)}" style="fill: none; stroke: var(--${tone})" stroke-width="2.4"></path>`);
    } else {
      const rad = r.w / 2;
      const w = n.shape === 'end' ? 3.2 : 1.5;
      out.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(rad - w / 2)}" style="fill: var(--card); stroke: var(--${tone})" stroke-width="${w}"></circle>`);
      if (n.shape === 'event') out.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(rad - 4.5)}" style="fill: none; stroke: var(--${tone})" stroke-width="1.2"></circle>`);
      const glyph = { timer: 'timer', message: 'mail', mail: 'mail', signal: 'shield', error: 'shield', user: 'user' }[(n.kind2 || '').toLowerCase()] || (n.icon || '');
      if (glyph) icon(glyph, cx - 8, cy - 8, 16, n.id);
    }
    if (n.extLabel?.box) {
      const b = n.extLabel.box;
      const end = n.extLabel.align === 'end';
      n.extLabel.lines.forEach((l, i) => text(l, end ? b.x + b.w : b.x + b.w / 2, m.baseline(b.y + i * 14, 14, T.sub), T.sub, { anchor: end ? 'end' : 'middle' }));
    }
  }

  decor('over');
  // Edge labels on top, with a halo in the background colour
  // The halo takes the colour of whatever the label sits on.
  const under = (x, y) => {
    const hits = [...geo.groups.values()].filter(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h)
      .sort((a, b) => b.group.depth - a.group.depth);
    for (const r of hits) {
      const g = r.group, st = g.style;
      if (st === 'plain' || st === 'dashed' || st === 'boundary' || st === 'external' || st === 'region' || g.external) continue;
      if (st === 'vnet') return 'vnet';
      if (st === 'subnet' || st === 'component') return 'card';
      return g.depth % 2 ? 'card' : 'wash';
    }
    return opts.standalone ? 'bg' : 'card';
  };
  for (const rt of routes) if (rt.label) text(rt.label.text, rt.label.x, m.baseline(rt.label.y, rt.label.h, T.edge), T.edge, { halo: under(rt.label.x + rt.label.w / 2, rt.label.y + rt.label.h / 2) });

  // Legend
  if (geo.legend) {
    const L = geo.legend;
    text('Key', L.x, m.baseline(L.y, 18, T.key), T.key, { tone: 'muted', weight: 600 });
    L.entries.forEach((e, i) => {
      const y = L.y + 22 + i * 24, cy = y + 9;
      if (e.kind === 'external') rect({ x: L.x, y: y + 1, w: 40, h: 16 }, { stroke: 'muted', width: 1.2, dash: '5 4', rx: 4 });
      else if (e.kind === 'badge') { const b = model.badgeSample; rect({ x: L.x + 11, y: y - 1, w: 18, h: 18 }, { fill: 'card', stroke: 'line', width: 1, rx: 4 }); if (b?.icon) icon(b.icon, L.x + 14, y + 2, 12, 'legend'); }
      else {
        markers.add('ink');
        out.push(`<path d="M${L.x},${cy} H${L.x + 40}" style="fill: none; stroke: var(--ink)" stroke-width="1.5"${e.kind === 'async' ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#${id}-ink)"></path>`);
      }
      text(e.label, L.x + 52, m.baseline(y, 18, T.key), T.key);
    });
  }

  const defs = [...[...markers].map(t => t.endsWith('-open')
    ? `<marker id="${id}-${t}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" style="fill: none; stroke: var(--${t.slice(0, -5)})" stroke-width="1.5"></path></marker>`
    : `<marker id="${id}-${t}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--${t})"></path></marker>`), ...symbols.values()];
  const label = opts.label || describe(model);
  const style = opts.standalone ? `<style>${opts.css}</style>\n` : '';
  const theme = opts.theme === 'dark' ? ' data-theme="dark"' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="graphally"${theme} viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">\n${style}<defs>${defs.join('\n')}</defs>\n<g style="color: var(--ink); fill: var(--ink)">\n${out.join('\n')}\n</g>\n</svg>`;
  return { svg, texts };
}

function rounded(pts, r) {
  let d = `M${fmt(pts[0].x)},${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y), d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (d1 < 0.01 || d2 < 0.01) continue;
    const k = Math.min(r, d1 / 2, d2 / 2);
    d += ` L${fmt(p1.x - (p1.x - p0.x) / d1 * k)},${fmt(p1.y - (p1.y - p0.y) / d1 * k)} Q${fmt(p1.x)},${fmt(p1.y)} ${fmt(p1.x + (p2.x - p1.x) / d2 * k)},${fmt(p1.y + (p2.y - p1.y) / d2 * k)}`;
  }
  const last = pts.at(-1);
  return d + ` L${fmt(last.x)},${fmt(last.y)}`;
}

function describe(model) {
  const name = id => (model.nodes.get(id) || model.groups.get(id))?.label || id;
  const groups = [...model.groups.values()].filter(g => g.id !== '__root' && g.children.some(c => c.kind === 'node'))
    .map(g => `${g.label || g.id}: ${g.children.filter(c => c.kind === 'node').map(c => c.label).join(', ')}`);
  const edges = model.edges.map(e => `${name(e.from)} ${e.dashed ? 'sends events to' : 'to'} ${name(e.to)}${e.label ? ` (${e.label})` : ''}`);
  return [model.title, groups.join('; '), edges.length ? 'Connections: ' + edges.join('; ') : ''].filter(Boolean).join('. ');
}
