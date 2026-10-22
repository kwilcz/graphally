// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// The canvas in the panel: renders the diagram file with graphally's own engine, as the
// render command does, and turns gestures into edits of the file. The server writes them;
// the file change comes back as an event and the diagram renders again, so what the panel
// shows is always the file.
import { compile, registerPack } from '/engine/lib/index.js';
import { readLayout } from '/engine/lib/snapshot.mjs';

const id = new URLSearchParams(location.search).get('i');
const api = (p, body) => fetch(`/api/${p}?i=${encodeURIComponent(id)}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}).then(r => r.json());
const $ = s => document.querySelector(s), view = $('#view');
const say = text => { $('#status').textContent = text || ''; };

// The engine's theme and icon packs, loaded as the render command loads them.
const css = await (await fetch('/engine/theme.css')).text();
document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
for (const vendor of ['azure', 'aws']) { try { const r = await fetch(`/engine/icons/${vendor}.json`); if (r.ok) registerPack(vendor, await r.json()); } catch {} }
await document.fonts.ready;

let previous = null, page = false, selected = null, busy = null, again = false;

// One render at a time; a change that lands during a render renders again after it.
async function render() {
  if (busy) { again = true; return busy; }
  busy = (async () => {
    try {
      const { name, source, previous: saved } = await api('source');
      $('#name').textContent = name;
      const host = document.createElement('div');
      host.innerHTML = source;
      const el = host.querySelector('diagram');
      if (!el) { view.textContent = 'This file has no <diagram>.'; return; }
      page = (el.getAttribute('layout') || '').toLowerCase() === 'html';
      $('#hint').textContent = page ? 'drag: move · Alt-drag to a box: connect · drag a line: reroute · double-click a line: label · Delete: remove a line'
        : 'drag: move (connections of this diagram are in its <links>)';
      const theme = el.getAttribute('theme') || 'light';
      document.documentElement.dataset.theme = theme;
      // The last render's layout keeps lines on their sides while the diagram changes.
      const r = compile(el, { standalone: true, css, theme, previous: previous || saved || undefined, source: name });
      previous = readLayout(r.svg) || previous;
      const keep = selected && (selected.dataset.id ? `[data-id="${CSS.escape(selected.dataset.id)}"]` : `[data-edge="${CSS.escape(selected.dataset.edge)}"]`);
      view.innerHTML = r.svg;
      wire(view.querySelector('svg'));
      select(keep ? view.querySelector(`g${keep}`) : null, false);
      const probs = r.problems || [];
      $('#problems').textContent = probs.length ? `${probs.length} problem${probs.length > 1 ? 's' : ''}: ${[...new Set(probs.map(p => p.rule))].join(', ')}` : '';
      $('#problems').title = probs.map(p => Object.entries(p).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')).join('\n');
      await api('rendered', { svg: r.svg, problems: probs, stats: r.stats, png: await picture(r) });
    } catch (e) { say(`render failed: ${e.message}`); }
  })();
  await busy;
  busy = null;
  if (again) { again = false; await render(); }
}

// A PNG of the render, for the agent's get_diagram.
async function picture(r) {
  try {
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml' }));
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: r.width, height: r.height });
    c.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
    return c.toDataURL('image/png');
  } catch { return null; }
}

async function edit(edits, what) {
  say(what);
  const r = await api('edits', { edits });
  say(r.errors?.length ? r.errors.map(e => e.message).join('; ') : '');
}

// ---------- gestures ----------
const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const toSvg = (svg, e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());

function select(g, tell = true) {
  view.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
  view.querySelector('.frame')?.remove();
  selected = g || null;
  if (g?.dataset.id && g.dataset.box) {
    const [x, y, w, h] = g.dataset.box.split(',').map(Number);
    g.ownerSVGElement.append(node('rect', { class: 'frame', x: x - 4, y: y - 4, width: w + 8, height: h + 8, rx: 6 }));
  } else if (g) g.classList.add('sel');
  if (tell) api('select', { selection: g ? (g.dataset.id ? { element: g.dataset.id } : { connection: g.dataset.edge }) : null });
}

// Drag with the pointer captured; done(delta, upEvent) runs on release.
function drag(svg, e0, move, done) {
  const start = toSvg(svg, e0);
  svg.setPointerCapture(e0.pointerId);
  const delta = e => { const p = toSvg(svg, e); return { x: p.x - start.x, y: p.y - start.y, p }; };
  const onMove = e => move(delta(e));
  const onUp = e => { svg.removeEventListener('pointermove', onMove); svg.removeEventListener('pointerup', onUp); done(delta(e), e); };
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  return start;
}

function wire(svg) {
  if (!svg) return;
  // Lines are thin: a wide transparent copy under each makes them easy to grab.
  for (const p of svg.querySelectorAll('g[data-edge] > path')) {
    const hit = p.cloneNode();
    for (const a of ['style', 'marker-end', 'marker-start', 'stroke-dasharray', 'stroke-width']) hit.removeAttribute(a);
    hit.setAttribute('class', 'hit');
    p.before(hit);
  }
  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const line = e.target.closest('g[data-edge]'), box = !line && e.target.closest('g[data-id]');
    if (line) {
      select(line);
      if (!page) return;
      const dot = node('circle', { r: 5, fill: '#2b6cff', opacity: 0 });
      svg.append(dot);
      drag(svg, e, d => { dot.setAttribute('cx', d.p.x); dot.setAttribute('cy', d.p.y); dot.setAttribute('opacity', Math.hypot(d.x, d.y) > 4 ? 0.8 : 0); }, d => {
        dot.remove();
        if (Math.hypot(d.x, d.y) > 4) edit([{ op: 'line', key: line.dataset.edge, set: { via: [[Math.round(d.p.x), Math.round(d.p.y)]] } }], 'rerouting…');
      });
    } else if (box) {
      select(box);
      if (e.altKey && page) {
        const s = toSvg(svg, e), rubber = node('line', { x1: s.x, y1: s.y, x2: s.x, y2: s.y, stroke: '#2b6cff', 'stroke-width': 2, 'stroke-dasharray': '4 3' });
        svg.append(rubber);
        drag(svg, e, d => { rubber.setAttribute('x2', d.p.x); rubber.setAttribute('y2', d.p.y); }, (d, up) => {
          rubber.remove();
          const to = document.elementsFromPoint(up.clientX, up.clientY).map(n => n.closest?.('g[data-id]')).find(g => g && g !== box && !box.contains(g));
          if (to) edit([{ op: 'connect', from: box.dataset.id, to: to.dataset.id }], 'connecting…');
        });
      } else {
        drag(svg, e, d => box.setAttribute('transform', `translate(${d.x} ${d.y})`), d => {
          if (Math.hypot(d.x, d.y) < 3) { box.removeAttribute('transform'); return; }
          edit([{ op: 'move', id: box.dataset.id, dx: Math.round(d.x), dy: Math.round(d.y) }], 'moving…');
        });
      }
    } else select(null);
  });
  svg.addEventListener('dblclick', e => {
    const line = e.target.closest('g[data-edge]');
    if (!line || !page) return;
    const input = $('#label');
    input.style.display = 'inline-block';
    input.value = line.querySelector('text')?.textContent || '';
    input.focus();
    input.onkeydown = k => {
      if (k.key === 'Escape') input.style.display = 'none';
      if (k.key !== 'Enter') return;
      input.style.display = 'none';
      edit([{ op: 'line', key: line.dataset.edge, set: { label: input.value || null } }], 'labelling…');
    };
  });
}

document.addEventListener('keydown', e => {
  if (!selected || e.target.tagName === 'INPUT') return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected.dataset.edge && page) edit([{ op: 'unline', key: selected.dataset.edge }], 'removing…');
  const step = e.shiftKey ? 10 : 1, arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (arrows[e.key] && selected.dataset.id) { e.preventDefault(); edit([{ op: 'move', id: selected.dataset.id, dx: arrows[e.key][0], dy: arrows[e.key][1] }], 'moving…'); }
});

// The file changed (an agent's edit, a save, one of ours): render it again.
new EventSource(`/api/events?i=${encodeURIComponent(id)}`).onmessage = () => render();
render();
