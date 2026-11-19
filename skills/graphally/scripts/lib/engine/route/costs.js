// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// What a route costs, in pixels of length: the search finds the cheapest.

// A bend.
export const BEND = 36;
// Crossing an earlier route.
export const CROSS = 70;
// Running on a segment an earlier route uses.
export const OVERLAP = 22;
// Per pixel, riding a line of the route's own bundle: their shared trunk is drawn once.
export const RIDE = 0.35;
// Per pixel between a bundle line's bend and the line its bundle gathers on (trees.js), the extra
// for the bend. It only decides between ways that cost the same: the lines turn where they can
// all meet, as far from the shared box as that is, and run to it on one long trunk.
export const GATHER = 0.001;
// Per pixel, the extra for running through a container the line does not belong to.
export const FOREIGN = 2.2;
// An end segment shorter than MIN_END puts the arrowhead on the bend before it. The page's small
// clearance allows such ends: its ports sit a full end length out where there is room (ports.js),
// and where there is not, turning near the box costs STUB, so the bend moves out where it can.
export const MIN_END = 12;
export const STUB = 60;
// How far out from a box its ports sit with the page's small clearance; 0 when the clearance is
// itself long enough.
export const endLengthFor = clearance => (clearance < MIN_END ? MIN_END + 2 : 0);
// A bundle's lines turn this far out from a box they point at, so the arrowheads have room.
export const TRUNK = 36;
// A circle or diamond has one attachment point per side. Two flows out of the same point of a
// gateway cannot be told apart, so a side already in use costs this much more.
export const SIDE_TAKEN = 300;
// A line keeps the side the previous render used: the ports of every other side cost this much.
export const SIDE_CHANGED = 400;
// How far outside a container its ports and margin lines sit.
export const CONTAINER_MARGIN = 10;

// Which ends of an edge carry a mark (by default an arrowhead at its end).
export function marksOf({ ends }) {
  return ends ? { head: ends.head !== 'none', tail: ends.tail !== 'none' } : { head: true, tail: false };
}
