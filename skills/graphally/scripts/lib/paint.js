// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// CSS that component styles lean on, drawn as SVG: linear gradients, box shadows, transforms,
// and ::before / ::after (made real elements before the page is read).

// Splits a CSS list at its top-level commas (or spaces): "rgb(1, 2, 3) 0px, red 4px".
export function split(s, sep = ',') {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)) { if (cur.trim()) parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const COLOR = /^(?:(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(.*\)|#[\da-f]+|[a-z]+)$/i;

// SVG paints a colour and its opacity apart: fill: rgba(…) is not read everywhere.
export function rgbaSplit(c) {
  const m = /^rgba\(([^,]+),([^,]+),([^,]+),\s*([\d.]+)\)$/.exec(c || '');
  return m ? [`rgb(${m[1].trim()}, ${m[2].trim()}, ${m[3].trim()})`, +m[4]] : [c, 1];
}

// The first linear-gradient() of a computed background-image, laid on box b: the line it runs
// along (CSS: through the box's centre, long enough that its ends touch the far corners) and
// its stops as offsets on that line.
export function linearGradient(image, b) {
  const layer = split(image || '').find(l => /^linear-gradient\(/.test(l));
  if (!layer) return null;
  const args = split(layer.slice(layer.indexOf('(') + 1, -1));
  let dx = 0, dy = 1;                                          // to bottom
  const angle = /^(-?[\d.]+)(deg|rad|turn|grad)$/.exec(args[0]);
  if (angle) {
    const a = +angle[1] * { deg: Math.PI / 180, rad: 1, turn: 2 * Math.PI, grad: Math.PI / 200 }[angle[2]];
    [dx, dy] = [Math.sin(a), -Math.cos(a)];
    args.shift();
  } else if (args[0].startsWith('to ')) {
    const w = args.shift();
    const sx = /right/.test(w) ? 1 : /left/.test(w) ? -1 : 0, sy = /bottom/.test(w) ? 1 : /top/.test(w) ? -1 : 0;
    // A corner: the line is square to the diagonal between the other two corners.
    [dx, dy] = sx && sy ? [sx * b.h, sy * b.w] : [sx, sy];
    const n = Math.hypot(dx, dy);
    dx /= n; dy /= n;
  }
  const len = Math.abs(b.w * dx) + Math.abs(b.h * dy), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const stops = [];
  for (const s of args) {
    const words = split(s, ' '), color = words.shift();
    if (!COLOR.test(color)) continue;                            // a colour hint: left to the browser's curve
    const at = words.map(p => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p) / len));
    if (!at.length) stops.push({ color, at: null });
    for (const v of at) stops.push({ color, at: v });
  }
  if (stops.length < 2) return null;
  // Stops without a place share the room between their neighbours; none goes backwards.
  stops[0].at ??= 0;
  stops.at(-1).at ??= 1;
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].at != null) continue;
    let j = i;
    while (stops[j].at == null) j++;
    const from = stops[i - 1].at, step = (stops[j].at - from) / (j - i + 1);
    for (let k = i; k < j; k++) stops[k].at = from + step * (k - i + 1);
  }
  for (let i = 1; i < stops.length; i++) stops[i].at = Math.max(stops[i].at, stops[i - 1].at);
  return { x1: cx - dx * len / 2, y1: cy - dy * len / 2, x2: cx + dx * len / 2, y2: cy + dy * len / 2, stops };
}

// A computed box-shadow as a list, the one painted last (the list's last) first. Inset shadows
// are left out: they paint inside the box, under its content, which the SVG has no layer for.
export function boxShadows(value) {
  if (!value || value === 'none') return [];
  return split(value).map(s => {
    const words = split(s, ' ');
    if (words.includes('inset')) return null;
    const color = words.find(w => !/^-?[\d.]+(px)?$/.test(w)) || 'rgb(0, 0, 0)';
    const [x = 0, y = 0, blur = 0, spread = 0] = words.filter(w => /^-?[\d.]+(px)?$/.test(w)).map(parseFloat);
    return { color, x, y, blur, spread };
  }).filter(Boolean).reverse();
}

// The element's rotate, scale and transform as one matrix, or null when it only moves the
// element: the browser's boxes already show a move (translate, nudge), not a turn.
export function turnOf(cs) {
  const parts = [cs.rotate !== 'none' && `rotate(${cs.rotate})`, cs.scale !== 'none' && `scale(${cs.scale.split(' ').join(',')})`, cs.transform !== 'none' && cs.transform].filter(Boolean);
  if (!parts.length) return null;
  try {
    const m = new DOMMatrix(parts.join(' '));
    return Math.abs(m.a - 1) + Math.abs(m.b) + Math.abs(m.c) + Math.abs(m.d - 1) < 1e-6 ? null : m;
  } catch { return null; }
}

// ::before and ::after have no box the page can read, so each becomes a real element with the
// pseudo-element's computed style and text, and the pseudo-element is switched off.
export function materializePseudo(root) {
  const made = [];
  for (const e of [...root.querySelectorAll('*')]) {
    if (!(e instanceof HTMLElement) || /^(ICON|IMG|SVG|STYLE|SCRIPT|G-PSEUDO)$/i.test(e.tagName)) continue;
    for (const which of ['before', 'after']) {
      const ps = getComputedStyle(e, `::${which}`);
      if (ps.content === 'none' || ps.content === 'normal' || ps.display === 'none') continue;
      const s = document.createElement('g-pseudo');
      for (const p of ps) if (p !== 'content' && !p.startsWith('--') && !/^(animation|transition)/.test(p)) s.style.setProperty(p, ps.getPropertyValue(p));
      s.textContent = [...ps.content.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1].replace(/\\([\da-f]{1,6})\s?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, '$1')).join('');
      made.push([e, which, s]);
    }
  }
  for (const [e, which, s] of made) { e.setAttribute(`data-g-${which}`, ''); which === 'before' ? e.prepend(s) : e.append(s); }
  const off = document.createElement('style');
  off.textContent = '[data-g-before]::before, [data-g-after]::after { content: none !important; }';
  root.prepend(off);
}
