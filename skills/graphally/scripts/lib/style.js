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
