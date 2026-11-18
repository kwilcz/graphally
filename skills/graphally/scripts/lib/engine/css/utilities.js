// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Utility classes with Tailwind's names: class="flex justify-center gap-6"
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
import { TOKENS } from '../shared/tokens.js';
import {
  ALIGN, SELF, TEXT, WEIGHT, TRACKING, RADIUS, CORNERS, BORDER_SIDE, SIZE, WIDTH, BOX, SPACE, STATIC, lookup,
} from './utility-tables.js';
import { isArbitrary, arbitrary, unbracket, lengthOf, colorOf, negated } from './utility-values.js';

// What starts a utility; a class that starts like one and does not parse is a problem.
const UTILITY_NAMES = [
  'p[xytrbl]?', 'm[xytrbl]?', 'gap', 'w', 'h', 'min-[wh]', 'max-[wh]', 'size', 'basis',
  'flex', 'grid', 'col', 'row', 'justify', 'items', 'self', 'content', 'place',
  'text', 'font', 'leading', 'tracking', 'rounded', 'border', 'bg',
  'top', 'right', 'bottom', 'left', 'inset', 'z', 'order', 'opacity', 'space', 'aspect', 'outline',
];
const ARBITRARY_PROPERTY = '^\\[[\\w-]+:';   // [grid-template-areas:'a_b']
const VARIANT = '^[a-z0-9-]+:[a-z]';         // hover:bg-wash, md:flex
const PREFIX = new RegExp(`^-?(${UTILITY_NAMES.join('|')})-|${ARBITRARY_PROPERTY}|${VARIANT}`);
const OFFSET = /top|right|bottom|left|inset/;

// Spacing: p-4, mx-auto, gap-x-2, -mt-2, top-1/2. Only margins and offsets may be negative;
// padding and gaps take no fractions.
function spacing([, name, value], negative) {
  if (negative && name[0] !== 'm' && !OFFSET.test(name)) return null;
  const auto = value === 'auto' && /^m|top|right|bottom|left|inset/.test(name);
  const length = auto ? 'auto' : lengthOf(value, { fraction: !/^[pm]|gap/.test(name) });
  if (length == null) return null;
  return SPACE[name].map(property => `${property}:${negative ? negated(length) : length}`).join(';');
}

// space-x-4: a margin after each child but the last.
function spaceBetween([, axis, value]) {
  const length = lengthOf(value), side = axis === 'x' ? 'right' : 'bottom';
  return length == null ? null : { nested: '>:not(:last-child)', css: `margin-${side}:${length}` };
}

function boxSize([, name, value]) {
  const length = lookup(SIZE, value) ?? (/w$/.test(name) ? lookup(WIDTH, value) : null) ?? lengthOf(value);
  if (length == null) return null;
  return name === 'size' ? `width:${length};height:${length}` : `${BOX[name]}:${length}`;
}

function justify([, rest]) {
  if (lookup(ALIGN, rest)) return `justify-content:${ALIGN[rest]}`;
  const [, which, value] = /^(items|self)-(.+)$/.exec(rest) || [];
  return which && lookup(SELF, value) ? `justify-${which}:${SELF[value]}` : null;
}

// align-items takes the ALIGN values but those that distribute space (between, around, evenly).
const isItemAlignment = value => lookup(ALIGN, value) && !/between|around|evenly/.test(value);
const alignItems = ([, value]) => (isItemAlignment(value) ? `align-items:${ALIGN[value]}` : null);
const alignSelf = ([, value]) => (lookup(SELF, value) ? `align-self:${SELF[value]}` : null);
const alignContent = ([, value]) => (lookup(ALIGN, value) ? `align-content:${ALIGN[value]}` : null);

function place([, which, value]) {
  const placed = which === 'content' ? lookup(ALIGN, value) : lookup(SELF, value);
  return placed ? `place-${which}:${placed}` : null;
}

// grid-cols-3, grid-rows-none, grid-cols-[130px_1fr].
function gridTemplate([, axis, value]) {
  const property = `grid-template-${axis === 'cols' ? 'columns' : 'rows'}`;
  if (/^\d+$/.test(value)) return `${property}:repeat(${value}, minmax(0, 1fr))`;
  if (value === 'none') return `${property}:none`;
  return isArbitrary(value) ? `${property}:${unbracket(value)}` : null;
}

// col-span-2, row-start-1, col-end-[3].
function gridLine([, axis, kind, value]) {
  const property = `grid-${axis === 'col' ? 'column' : 'row'}`;
  const line = isArbitrary(value) ? unbracket(value) : /^-?\d+$/.test(value) || value === 'auto' ? value : null;
  if (line == null) return null;
  return kind === 'span' ? `${property}:span ${line} / span ${line}` : `${property}-${kind}:${line}`;
}

const gridPlacement = ([, axis, value]) => `grid-${axis === 'col' ? 'column' : 'row'}:${arbitrary(value)}`;
const orderOrZ = ([, name, value]) => `${name === 'z' ? 'z-index' : 'order'}:${value.replace(/^\[|\]$/g, '')}`;
const opacity = ([, value]) => `opacity:${Number(value) / 100}`;
const aspect = ([, value]) => `aspect-ratio:${arbitrary(value)}`;

// text-lg (a size and its line height), text-[15px], text-muted (a colour).
function text([, value]) {
  const size = lookup(TEXT, value);
  if (size) return `font-size:${size[0]};line-height:${size[1]}`;
  if (/^\[\d/.test(value)) return `font-size:${unbracket(value)}`;
  const color = colorOf(value);
  return color ? `color:${color}` : null;
}

function font([, value]) {
  if (lookup(WEIGHT, value)) return `font-weight:${WEIGHT[value]}`;
  return value === 'mono' ? 'font-family:ui-monospace, Consolas, monospace' : null;
}

const leading = ([, value]) => {
  const length = lengthOf(value);
  return length ? `line-height:${length}` : null;
};
const tracking = ([, value]) => `letter-spacing:${TRACKING[value]}`;

// rounded, rounded-lg, rounded-t-xl, rounded-[10px].
function rounded([, corner, size]) {
  const radius = lookup(RADIUS, size ?? '') ?? (size && isArbitrary(size) ? unbracket(size) : null);
  if (radius == null) return null;
  const corners = lookup(CORNERS, corner);
  return corners ? corners.map(each => `border-${each}-radius:${radius}`).join(';') : `border-radius:${radius}`;
}

// border-2, border-t-[3px] (a width and a solid style), border-woad (a colour, for every side).
function border([, sideKey, value]) {
  const side = lookup(BORDER_SIDE, sideKey), prefix = side ? `border-${side}` : 'border';
  if (/^(\d+(\.\d+)?|\[\d.*\])$/.test(value)) {
    return `${prefix}-width:${value.startsWith('[') ? unbracket(value) : `${value}px`};${prefix}-style:solid`;
  }
  const color = !side && colorOf(value);
  return color ? `border-color:${color}` : null;
}

const colored = template => ([, value]) => {
  const color = colorOf(value);
  return color ? template(color) : null;
};

// The utilities that may be negative (-mt-2), then the rest, each a pattern and its handler. The
// first pattern a class matches decides what it means.
const SIGNED = [
  [/^(p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|top|right|bottom|left|inset(?:-[xy])?)-(.+)$/, spacing],
  [/^space-([xy])-(.+)$/, spaceBetween],
];
const UNSIGNED = [
  [/^(w|h|min-w|max-w|min-h|max-h|size|basis)-(.+)$/, boxSize],
  [/^justify-(.+)$/, justify],
  [/^items-(.+)$/, alignItems],
  [/^self-(.+)$/, alignSelf],
  [/^content-(.+)$/, alignContent],
  [/^place-(content|items|self)-(.+)$/, place],
  [/^grid-(cols|rows)-(.+)$/, gridTemplate],
  [/^(col|row)-(span|start|end)-(.+)$/, gridLine],
  [/^(col|row)-\[(.+)\]$/, gridPlacement],
  [/^(order|z)-(\d+|\[.+\])$/, orderOrZ],
  [/^opacity-(\d+)$/, opacity],
  [/^aspect-\[(.+)\]$/, aspect],
  [/^text-(.+)$/, text],
  [/^font-(.+)$/, font],
  [/^leading-(.+)$/, leading],
  [/^tracking-(tight|wide|wider|widest|normal)$/, tracking],
  [/^rounded(?:-([trbl]|tl|tr|bl|br))?(?:-(.+))?$/, rounded],
  [/^border(?:-([xytrbl]))?-(.+)$/, border],
  [/^bg-(.+)$/, colored(color => `background-color:${color}`)],
  [/^outline-(.+)$/, colored(color => `outline:1px solid ${color}`)],
];

// The meaning of the first pattern a name matches; undefined when it matches none.
function firstMeaning(handlers, name, negative) {
  const entry = handlers.find(([pattern]) => pattern.test(name));
  return entry ? entry[1](entry[0].exec(name), negative) : undefined;
}

// The declarations for one class, or null when it is not a utility.
export function utility(cls) {
  const fixed = lookup(STATIC, cls);
  if (fixed) return fixed;
  // [property:value]: any CSS property.
  const property = /^\[([a-z-]+):(.+)\]$/.exec(cls);
  if (property) return `${property[1]}:${arbitrary(property[2])}`;
  const negative = cls.startsWith('-'), name = negative ? cls.slice(1) : cls;
  const signed = firstMeaning(SIGNED, name, negative);
  if (signed !== undefined) return signed;
  return negative ? null : firstMeaning(UNSIGNED, name, false) ?? null;
}

// Every class the page uses, each once, in the order it first appears.
const classesOf = root => {
  const elements = [root, ...root.querySelectorAll('[class]')];
  return [...new Set(elements.flatMap(element => [...element.classList]))];
};

function hintFor(cls) {
  if (/^(bg|text|border)-[a-z]+-\d{2,3}$/.test(cls)) {
    return `colours are the theme's: ${TOKENS.slice(0, 12).join(', ')}…, or an arbitrary value as in bg-[#eef]`;
  }
  if (/:/.test(cls) && !cls.startsWith('[')) return 'variants (hover:, md:) mean nothing in a picture';
  return 'Tailwind names, a spacing step of 4px (gap-6 is 24px); arbitrary values in brackets: w-[130px]';
}

// A class that starts like a utility but is none.
const unknownUtility = cls => ({ rule: 'unknown-utility', class: cls, hint: hintFor(cls) });

function ruleFor(cls, declarations) {
  const selector = `.graphally-page .${CSS.escape(cls)}`;
  return typeof declarations === 'string'
    ? `${selector} { ${declarations} }`
    : `${selector} ${declarations.nested} { ${declarations.css} }`;
}

// CSS for every utility class in root. A utility beats a building block (.node, .group, which
// have no specificity) and an author's single-class rule, as the class on the element is the
// more specific wish. A class the author styles in a <style> of their own is theirs, whatever
// it looks like.
export function utilitiesFor(root, problems) {
  const own = [...root.querySelectorAll('style')].map(style => style.textContent).join('\n'), rules = [];
  for (const cls of classesOf(root)) {
    const declarations = utility(cls);
    if (declarations != null) rules.push(ruleFor(cls, declarations));
    else if (PREFIX.test(cls) && !own.includes(`.${cls}`)) problems.push(unknownUtility(cls));
  }
  return rules.join('\n');
}
