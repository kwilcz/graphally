// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The utility classes' names and values, as Tailwind has them; text sizes follow the diagram's
// scale (text-base is 13px, the size of a label).

export const ALIGN = {
  start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around',
  evenly: 'space-evenly', stretch: 'stretch', baseline: 'baseline', normal: 'normal',
};
export const SELF = { auto: 'auto', start: 'start', end: 'end', center: 'center', stretch: 'stretch', baseline: 'baseline' };
export const TEXT = {
  xs: ['11px', '15px'], sm: ['11.5px', '16px'], base: ['13px', '18px'], lg: ['15px', '20px'],
  xl: ['17px', '23px'], '2xl': ['22px', '28px'], '3xl': ['28px', '34px'],
};
export const WEIGHT = { thin: 100, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 };
export const TRACKING = { tight: '-0.025em', normal: '0', wide: '0.025em', wider: '0.05em', widest: '0.1em' };
export const RADIUS = {
  none: '0', xs: '2px', sm: '4px', '': '6px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px', '3xl': '24px', full: '9999px',
};
export const CORNERS = {
  t: ['top-left', 'top-right'], r: ['top-right', 'bottom-right'], b: ['bottom-left', 'bottom-right'], l: ['top-left', 'bottom-left'],
  tl: ['top-left'], tr: ['top-right'], bl: ['bottom-left'], br: ['bottom-right'],
};
export const BORDER_SIDE = { x: 'inline', y: 'block', t: 'top', r: 'right', b: 'bottom', l: 'left' };
export const SIZE = {
  full: '100%', auto: 'auto', fit: 'fit-content', min: 'min-content', max: 'max-content', px: '1px', none: 'none',
};
export const WIDTH = {
  '3xs': '256px', '2xs': '288px', xs: '320px', sm: '384px', md: '448px', lg: '512px', xl: '576px', '2xl': '672px',
};
export const BOX = {
  w: 'width', h: 'height', 'min-w': 'min-width', 'max-w': 'max-width', 'min-h': 'min-height', 'max-h': 'max-height', basis: 'flex-basis',
};
export const SPACE = {
  p: ['padding'], px: ['padding-inline'], py: ['padding-block'], pt: ['padding-top'], pr: ['padding-right'],
  pb: ['padding-bottom'], pl: ['padding-left'],
  m: ['margin'], mx: ['margin-inline'], my: ['margin-block'], mt: ['margin-top'], mr: ['margin-right'],
  mb: ['margin-bottom'], ml: ['margin-left'],
  gap: ['gap'], 'gap-x': ['column-gap'], 'gap-y': ['row-gap'],
  top: ['top'], right: ['right'], bottom: ['bottom'], left: ['left'],
  inset: ['inset'], 'inset-x': ['inset-inline'], 'inset-y': ['inset-block'],
};

// The classes that are one fixed declaration.
export const STATIC = {
  block: 'display:block', 'inline-block': 'display:inline-block', inline: 'display:inline', flex: 'display:flex',
  'inline-flex': 'display:inline-flex', grid: 'display:grid', 'inline-grid': 'display:inline-grid',
  contents: 'display:contents', hidden: 'display:none',
  'flex-row': 'flex-direction:row', 'flex-row-reverse': 'flex-direction:row-reverse', 'flex-col': 'flex-direction:column',
  'flex-col-reverse': 'flex-direction:column-reverse', 'flex-wrap': 'flex-wrap:wrap', 'flex-nowrap': 'flex-wrap:nowrap',
  'flex-1': 'flex:1 1 0%', 'flex-auto': 'flex:1 1 auto', 'flex-initial': 'flex:0 1 auto', 'flex-none': 'flex:none',
  grow: 'flex-grow:1', 'grow-0': 'flex-grow:0', shrink: 'flex-shrink:1', 'shrink-0': 'flex-shrink:0',
  'grid-flow-row': 'grid-auto-flow:row', 'grid-flow-col': 'grid-auto-flow:column', 'grid-flow-dense': 'grid-auto-flow:dense',
  'col-span-full': 'grid-column:1 / -1', 'row-span-full': 'grid-row:1 / -1', 'col-auto': 'grid-column:auto', 'row-auto': 'grid-row:auto',
  'grid-cols-subgrid': 'grid-template-columns:subgrid', 'grid-rows-subgrid': 'grid-template-rows:subgrid',
  relative: 'position:relative', absolute: 'position:absolute', static: 'position:static',
  'text-left': 'text-align:left', 'text-center': 'text-align:center', 'text-right': 'text-align:right',
  italic: 'font-style:italic', 'not-italic': 'font-style:normal', uppercase: 'text-transform:uppercase',
  lowercase: 'text-transform:lowercase', capitalize: 'text-transform:capitalize',
  underline: 'text-decoration-line:underline', 'line-through': 'text-decoration-line:line-through',
  'whitespace-nowrap': 'white-space:nowrap', 'whitespace-pre-line': 'white-space:pre-line',
  truncate: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap', 'overflow-hidden': 'overflow:hidden',
  'leading-none': 'line-height:1', 'leading-tight': 'line-height:1.25', 'leading-snug': 'line-height:1.375',
  'leading-normal': 'line-height:1.5',
  border: 'border-width:1px;border-style:solid', 'border-solid': 'border-style:solid', 'border-dashed': 'border-style:dashed',
  'border-dotted': 'border-style:dotted', 'border-none': 'border-style:none',
  'border-t': 'border-top-width:1px;border-top-style:solid', 'border-b': 'border-bottom-width:1px;border-bottom-style:solid',
  'border-l': 'border-left-width:1px;border-left-style:solid', 'border-r': 'border-right-width:1px;border-right-style:solid',
  'border-x': 'border-inline-width:1px;border-inline-style:solid', 'border-y': 'border-block-width:1px;border-block-style:solid',
  'bg-none': 'background:none', 'bg-transparent': 'background-color:transparent',
  'aspect-square': 'aspect-ratio:1 / 1', 'aspect-video': 'aspect-ratio:16 / 9',
  'mx-auto': 'margin-inline:auto', 'my-auto': 'margin-block:auto', 'ml-auto': 'margin-left:auto', 'mr-auto': 'margin-right:auto',
  'mt-auto': 'margin-top:auto', 'mb-auto': 'margin-bottom:auto', 'm-auto': 'margin:auto',
};

// The value of a table's key, and nothing for a name every object has (toString, constructor).
export const lookup = (table, key) => (Object.hasOwn(table, key) ? table[key] : undefined);
