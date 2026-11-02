# Brief: show how a dragged card tilts

When you drag a card on our board, it tilts toward the way you move it, like a sheet of paper
pulled across a table. Engineering built the tilt as a spring: the pointer's speed over the
last 50 ms sets the angle the card aims at (3.4° at 1.2 px a millisecond or more, less for a
slower move), and the angle follows that aim as a spring with stiffness 900, damping 20 and
mass 1, never turning past 4.5°. Designers keep asking what the numbers feel like.

Make a figure for the design review that shows the tilt happening and explains it: a quick
drag to the right, a stop, a drag back. It goes in our docs, which render SVG; it may move
in a browser, but the still must make sense in the PDF export.

Deliverable: diagram.svg.
