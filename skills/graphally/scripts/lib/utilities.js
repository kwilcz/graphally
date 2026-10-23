// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Utility classes with Tailwind's names, for page mode: class="flex justify-center gap-6"
// instead of a rule in a <style>. The page asks for a class, this file writes its CSS; only
// the classes a diagram uses are written. The names and the spacing scale (1 = 4px) are
// Tailwind's, so an author who knows Tailwind knows these. Two differences, both on
// purpose: colours are the theme's tokens (bg-wash, text-muted, border-woad), so a diagram
// keeps graphally's look and its dark theme; and text sizes follow the diagram's scale
// (text-base is 13px, the size of a label), not a web page's.
//
// Arbitrary values work as in Tailwind: w-[130px], grid-cols-[130px_1fr], gap-[40px_80px],
// and any property: [grid-template-areas:'a_b'] (an underscore is a space). A class that
// starts like a utility but means nothing is reported, so a typo does not pass in silence.
// Variants (hover:, md:) mean nothing in a picture and are not supported.

const TOKENS = new Set(['ink', 'muted', 'line', 'woad', 'rust', 'teal', 'green', 'purple', 'amber', 'wash', 'card', 'bg', 'icon-soft', 'vnet', 'note', 'lane-a', 'lane-b', 'lane-c', 'lane-d']);
const ALIGN = { start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around', evenly: 'space-evenly', stretch: 'stretch', baseline: 'baseline', normal: 'normal' };
const SELF = { auto: 'auto', start: 'start', end: 'end', center: 'center', stretch: 'stretch', baseline: 'baseline' };
const TEXT = { xs: ['11px', '15px'], sm: ['11.5px', '16px'], base: ['13px', '18px'], lg: ['15px', '20px'], xl: ['17px', '23px'], '2xl': ['22px', '28px'], '3xl': ['28px', '34px'] };
const WEIGHT = { thin: 100, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 };
const RADIUS = { none: '0', xs: '2px', sm: '4px', '': '6px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px', '3xl': '24px', full: '9999px' };
const SIZE = { full: '100%', auto: 'auto', fit: 'fit-content', min: 'min-content', max: 'max-content', px: '1px', none: 'none' };
const WIDTH = { '3xs': '256px', '2xs': '288px', xs: '320px', sm: '384px', md: '448px', lg: '512px', xl: '576px', '2xl': '672px' };
const STATIC = {
  block: 'display:block', 'inline-block': 'display:inline-block', inline: 'display:inline', flex: 'display:flex', 'inline-flex': 'display:inline-flex',
  grid: 'display:grid', 'inline-grid': 'display:inline-grid', contents: 'display:contents', hidden: 'display:none',
  'flex-row': 'flex-direction:row', 'flex-row-reverse': 'flex-direction:row-reverse', 'flex-col': 'flex-direction:column', 'flex-col-reverse': 'flex-direction:column-reverse',
  'flex-wrap': 'flex-wrap:wrap', 'flex-nowrap': 'flex-wrap:nowrap', 'flex-1': 'flex:1 1 0%', 'flex-auto': 'flex:1 1 auto', 'flex-initial': 'flex:0 1 auto', 'flex-none': 'flex:none',
  grow: 'flex-grow:1', 'grow-0': 'flex-grow:0', shrink: 'flex-shrink:1', 'shrink-0': 'flex-shrink:0',
  'grid-flow-row': 'grid-auto-flow:row', 'grid-flow-col': 'grid-auto-flow:column', 'grid-flow-dense': 'grid-auto-flow:dense',
  'col-span-full': 'grid-column:1 / -1', 'row-span-full': 'grid-row:1 / -1', 'col-auto': 'grid-column:auto', 'row-auto': 'grid-row:auto',
  'grid-cols-subgrid': 'grid-template-columns:subgrid', 'grid-rows-subgrid': 'grid-template-rows:subgrid',
  relative: 'position:relative', absolute: 'position:absolute', static: 'position:static',
  'text-left': 'text-align:left', 'text-center': 'text-align:center', 'text-right': 'text-align:right',
  italic: 'font-style:italic', 'not-italic': 'font-style:normal', uppercase: 'text-transform:uppercase', lowercase: 'text-transform:lowercase', capitalize: 'text-transform:capitalize',
  underline: 'text-decoration-line:underline', 'line-through': 'text-decoration-line:line-through', 'whitespace-nowrap': 'white-space:nowrap', 'whitespace-pre-line': 'white-space:pre-line',
  truncate: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap', 'overflow-hidden': 'overflow:hidden',
  'leading-none': 'line-height:1', 'leading-tight': 'line-height:1.25', 'leading-snug': 'line-height:1.375', 'leading-normal': 'line-height:1.5',
  border: 'border-width:1px;border-style:solid', 'border-solid': 'border-style:solid', 'border-dashed': 'border-style:dashed', 'border-dotted': 'border-style:dotted', 'border-none': 'border-style:none',
  'border-t': 'border-top-width:1px;border-top-style:solid', 'border-b': 'border-bottom-width:1px;border-bottom-style:solid',
  'border-l': 'border-left-width:1px;border-left-style:solid', 'border-r': 'border-right-width:1px;border-right-style:solid',
  'border-x': 'border-inline-width:1px;border-inline-style:solid', 'border-y': 'border-block-width:1px;border-block-style:solid',
  'bg-none': 'background:none', 'bg-transparent': 'background-color:transparent',
  'aspect-square': 'aspect-ratio:1 / 1', 'aspect-video': 'aspect-ratio:16 / 9',
  'mx-auto': 'margin-inline:auto', 'my-auto': 'margin-block:auto', 'ml-auto': 'margin-left:auto', 'mr-auto': 'margin-right:auto', 'mt-auto': 'margin-top:auto', 'mb-auto': 'margin-bottom:auto', 'm-auto': 'margin:auto',
};
const SPACE = {
  p: ['padding'], px: ['padding-inline'], py: ['padding-block'], pt: ['padding-top'], pr: ['padding-right'], pb: ['padding-bottom'], pl: ['padding-left'],
  m: ['margin'], mx: ['margin-inline'], my: ['margin-block'], mt: ['margin-top'], mr: ['margin-right'], mb: ['margin-bottom'], ml: ['margin-left'],
  gap: ['gap'], 'gap-x': ['column-gap'], 'gap-y': ['row-gap'],
  top: ['top'], right: ['right'], bottom: ['bottom'], left: ['left'], inset: ['inset'], 'inset-x': ['inset-inline'], 'inset-y': ['inset-block'],
  'space-x': null, 'space-y': null,
};
const BOX = { w: 'width', h: 'height', 'min-w': 'min-width', 'max-w': 'max-width', 'min-h': 'min-height', 'max-h': 'max-height', size: null, basis: 'flex-basis' };
// What starts a utility; a class that starts like one and does not parse is a problem.
const PREFIX = /^-?(p[xytrbl]?|m[xytrbl]?|gap|w|h|min-[wh]|max-[wh]|size|basis|flex|grid|col|row|justify|items|self|content|place|text|font|leading|tracking|rounded|border|bg|top|right|bottom|left|inset|z|order|opacity|space|aspect|outline)-|^\[[\w-]+:|^[a-z0-9-]+:[a-z]/;

// "6" → 24px, "1.5" → 6px, "px" → 1px, "1/2" → 50%, "[130px]" → 130px.
function length(v, { fraction = true } = {}) {
  if (v === undefined) return null;
  if (/^\[.+\]$/.test(v)) return raw(v.slice(1, -1));
  if (v === 'px') return '1px';
  if (/^\d+(\.(25|5|75))?$/.test(v)) return v === '0' ? '0' : `${Number(v) * 4}px`;
  if (fraction && /^\d+\/\d+$/.test(v)) { const [a, b] = v.split('/').map(Number); return b ? `${+(a / b * 100).toFixed(4)}%` : null; }
  return null;
}
// An arbitrary value: an underscore is a space, as in Tailwind.
const raw = v => v.replace(/\\_/g, '\u0000').replace(/_/g, ' ').replace(/\u0000/g, '_');
const color = v => TOKENS.has(v) ? `var(--${v})` : /^\[.+\]$/.test(v) ? raw(v.slice(1, -1)) : v === 'white' ? '#fff' : v === 'black' ? '#000' : v === 'current' ? 'currentColor' : v === 'transparent' ? 'transparent' : null;

// The declarations for one class, or null when it is not a utility.
export function utility(cls) {
  if (STATIC[cls]) return STATIC[cls];
  let m;
  // [property:value]: any CSS property.
  if ((m = cls.match(/^\[([a-z-]+):(.+)\]$/))) return `${m[1]}:${raw(m[2])}`;
  const neg = cls.startsWith('-') ? '-' : '';
  const c = neg ? cls.slice(1) : cls;
  const sign = v => (neg && v && v !== '0' && v !== 'auto' ? (/^calc|^var/.test(v) ? `calc(-1 * ${v})` : `-${v}`) : v);
  if ((m = c.match(/^(p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|top|right|bottom|left|inset(?:-[xy])?)-(.+)$/)) && SPACE[m[1]]) {
    if (neg && m[1][0] !== 'm' && !/top|right|bottom|left|inset/.test(m[1])) return null;
    const v = m[2] === 'auto' && /^m|top|right|bottom|left|inset/.test(m[1]) ? 'auto' : length(m[2], { fraction: !/^[pm]|gap/.test(m[1]) });
    return v == null ? null : SPACE[m[1]].map(p => `${p}:${sign(v)}`).join(';');
  }
  if ((m = c.match(/^space-([xy])-(.+)$/))) {
    const v = length(m[2]);
    return v == null ? null : { nested: `>:not(:last-child)`, css: `margin-${m[1] === 'x' ? 'right' : 'bottom'}:${v}` };
  }
  if (neg) return null;
  if ((m = c.match(/^(w|h|min-w|max-w|min-h|max-h|size|basis)-(.+)$/))) {
    const v = SIZE[m[2]] ?? (/w$/.test(m[1]) ? WIDTH[m[2]] : null) ?? length(m[2]);
    if (v == null) return null;
    return m[1] === 'size' ? `width:${v};height:${v}` : `${BOX[m[1]]}:${v}`;
  }
  if ((m = c.match(/^justify-(.+)$/))) return ALIGN[m[1]] ? `justify-content:${ALIGN[m[1]]}` : (m = c.match(/^justify-(items|self)-(.+)$/)) && SELF[m[2]] ? `justify-${m[1]}:${SELF[m[2]]}` : null;
  if ((m = c.match(/^items-(.+)$/))) return ALIGN[m[1]] && !/between|around|evenly/.test(m[1]) ? `align-items:${ALIGN[m[1]]}` : null;
  if ((m = c.match(/^self-(.+)$/))) return SELF[m[1]] ? `align-self:${SELF[m[1]]}` : null;
  if ((m = c.match(/^content-(.+)$/))) return ALIGN[m[1]] ? `align-content:${ALIGN[m[1]]}` : null;
  if ((m = c.match(/^place-(content|items|self)-(.+)$/))) return (m[1] === 'content' ? ALIGN[m[2]] : SELF[m[2]]) ? `place-${m[1]}:${m[1] === 'content' ? ALIGN[m[2]] : SELF[m[2]]}` : null;
  if ((m = c.match(/^grid-(cols|rows)-(.+)$/))) {
    const prop = `grid-template-${m[1] === 'cols' ? 'columns' : 'rows'}`;
    if (/^\d+$/.test(m[2])) return `${prop}:repeat(${m[2]}, minmax(0, 1fr))`;
    if (m[2] === 'none') return `${prop}:none`;
    return /^\[.+\]$/.test(m[2]) ? `${prop}:${raw(m[2].slice(1, -1))}` : null;
  }
  if ((m = c.match(/^(col|row)-(span|start|end)-(.+)$/))) {
    const prop = `grid-${m[1] === 'col' ? 'column' : 'row'}`, v = /^\[.+\]$/.test(m[3]) ? raw(m[3].slice(1, -1)) : /^-?\d+$/.test(m[3]) || m[3] === 'auto' ? m[3] : null;
    if (v == null) return null;
    return m[2] === 'span' ? `${prop}:span ${v} / span ${v}` : `${prop}-${m[2]}:${v}`;
  }
  if ((m = c.match(/^(col|row)-\[(.+)\]$/))) return `grid-${m[1] === 'col' ? 'column' : 'row'}:${raw(m[2])}`;
  if ((m = c.match(/^(order|z)-(\d+|\[.+\])$/))) return `${m[1] === 'z' ? 'z-index' : 'order'}:${m[2].replace(/^\[|\]$/g, '')}`;
  if ((m = c.match(/^opacity-(\d+)$/))) return `opacity:${Number(m[1]) / 100}`;
  if ((m = c.match(/^aspect-\[(.+)\]$/))) return `aspect-ratio:${raw(m[1])}`;
  if ((m = c.match(/^text-(.+)$/))) {
    if (TEXT[m[1]]) return `font-size:${TEXT[m[1]][0]};line-height:${TEXT[m[1]][1]}`;
    if (/^\[\d/.test(m[1])) return `font-size:${raw(m[1].slice(1, -1))}`;
    const col = color(m[1]);
    return col ? `color:${col}` : null;
  }
  if ((m = c.match(/^font-(.+)$/))) return WEIGHT[m[1]] ? `font-weight:${WEIGHT[m[1]]}` : m[1] === 'mono' ? 'font-family:ui-monospace, Consolas, monospace' : null;
  if ((m = c.match(/^leading-(.+)$/))) return (m = length(m[1])) ? `line-height:${m}` : null;
  if ((m = c.match(/^tracking-(tight|wide|wider|widest|normal)$/))) return `letter-spacing:${{ tight: '-0.025em', normal: '0', wide: '0.025em', wider: '0.05em', widest: '0.1em' }[m[1]]}`;
  if ((m = c.match(/^rounded(?:-([trbl]|tl|tr|bl|br))?(?:-(.+))?$/))) {
    const r = RADIUS[m[2] ?? ''] ?? (m[2] && /^\[.+\]$/.test(m[2]) ? raw(m[2].slice(1, -1)) : null);
    if (r == null) return null;
    const corners = { t: ['top-left', 'top-right'], r: ['top-right', 'bottom-right'], b: ['bottom-left', 'bottom-right'], l: ['top-left', 'bottom-left'], tl: ['top-left'], tr: ['top-right'], bl: ['bottom-left'], br: ['bottom-right'] }[m[1]];
    return corners ? corners.map(k => `border-${k}-radius:${r}`).join(';') : `border-radius:${r}`;
  }
  if ((m = c.match(/^border(?:-([xytrbl]))?-(.+)$/))) {
    const side = { x: 'inline', y: 'block', t: 'top', r: 'right', b: 'bottom', l: 'left' }[m[1]], pre = side ? `border-${side}` : 'border';
    if (/^(\d+(\.\d+)?|\[\d.*\])$/.test(m[2])) return `${pre}-width:${m[2].startsWith('[') ? raw(m[2].slice(1, -1)) : `${m[2]}px`};${pre}-style:solid`;
    const col = !side && color(m[2]);
    return col ? `border-color:${col}` : null;
  }
  if ((m = c.match(/^bg-(.+)$/))) { const col = color(m[1]); return col ? `background-color:${col}` : null; }
  if ((m = c.match(/^outline-(.+)$/))) { const col = color(m[1]); return col ? `outline:1px solid ${col}` : null; }
  return null;
}

// CSS for every utility class in root. A utility beats a building block (.node, .group,
// which have no specificity) and an author's single-class rule, as the class on the
// element is the more specific wish.
export function utilitiesFor(root, problems) {
  const seen = new Set(), rules = [];
  // A class the author styles in a <style> of their own is theirs, whatever it looks like.
  const own = [...root.querySelectorAll('style')].map(x => x.textContent).join('\n');
  for (const e of [root, ...root.querySelectorAll('[class]')]) for (const cls of e.classList) {
    if (seen.has(cls)) continue;
    seen.add(cls);
    const d = utility(cls);
    if (d == null) {
      if (PREFIX.test(cls) && !own.includes(`.${cls}`)) problems.push({ rule: 'unknown-utility', class: cls, hint: hintFor(cls) });
      continue;
    }
    const sel = `.graphally-page .${CSS.escape(cls)}`;
    rules.push(typeof d === 'string' ? `${sel} { ${d} }` : `${sel} ${d.nested} { ${d.css} }`);
  }
  return rules.join('\n');
}

function hintFor(cls) {
  if (/^(bg|text|border)-[a-z]+-\d{2,3}$/.test(cls)) return `colours are the theme's: ${[...TOKENS].slice(0, 12).join(', ')}…, or an arbitrary value as in bg-[#eef]`;
  if (/:/.test(cls) && !cls.startsWith('[')) return 'variants (hover:, md:) mean nothing in a picture';
  return 'Tailwind names, a spacing step of 4px (gap-6 is 24px); arbitrary values in brackets: w-[130px]';
}
