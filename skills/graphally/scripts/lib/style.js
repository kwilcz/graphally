// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Sizes in one place. Every visual constant the layout depends on lives here, so a
// theme can change spacing without touching layout code.
export const S = {
  pad: 24,                 // around the whole figure
  titleGap: 18,            // between the title block and the content
  colGap: 80, rowGap: 32,  // between areas in a layout map (room for edges and labels)
  stackGap: 18,            // between items stacked in a group
  group: { padX: 16, padTop: 12, padBottom: 16, head: 24, icon: 18, radius: 10, badge: 20, badgeGap: 4 },
  plain: { head: 22 },
  card: { padX: 12, padY: 9, icon: 26, iconGap: 10, minW: 150, maxW: 210, line: 16, subLine: 15, minH: 48 },
  tile: { w: 112, icon: 40, padY: 10, gap: 6, line: 15, subLine: 14 },
  icon: { w: 104, icon: 48, gap: 6, line: 15, subLine: 14 },
  chip: { padX: 12, h: 26 },
  edge: { width: 1.5, radius: 6, nodePad: 12, labelPad: 4, portGap: 12 },
};

// Text classes, shared by measurement and output.
export const T = {
  title: 'g-title', subtitle: 'g-subtitle', label: 'g-label', sub: 'g-sub', group: 'g-group',
  gsub: 'g-gsub', edge: 'g-edge', key: 'g-key', tile: 'g-tile', msg: 'g-msg', num: 'g-num', frag: 'g-frag',
};

// A diagram is laid out, measured and shown in a shadow root of its own: the page's CSS does not
// reach in, and the diagram's CSS does not leak out. The theme's tokens sit on the shadow's
// host, light or dark by its data-theme, where the page can restyle them only on purpose (a
// rule on the host) and not by chance (a --card of its own on :root).
export const hostTheme = css => String(css || '')
  .replace(/(?::root|svg\.graphally)\[data-theme="dark"\]/g, ':host([data-theme="dark"])')
  .replace(/:root|svg\.graphally/g, ':host');

// A shadow root in a host that takes nothing from the page (no inherited font, colour or
// spacing), placed out of the way, with css in it. The caller removes the host.
export function shadowBox(css, place = 'left: 0; top: 0') {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `:host { all: initial !important; display: block !important; position: absolute !important; ${place.replace(/;?\s*$/, '').split(';').map(d => `${d.trim()} !important`).join('; ')}; }\n${css}`;
  root.append(style);
  document.body.appendChild(host);
  return { host, root };
}
