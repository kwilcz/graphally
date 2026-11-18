// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Text measurement with the same SVG text classes the output uses, so what is measured is what
// renders. In a shadow root of its own, so the CSS of a page the diagram is embedded in (a
// letter-spacing on body) does not change it.
import { hostTheme, shadowBox } from './style.js';

const NS = 'http://www.w3.org/2000/svg';

class Measurer {
  // css: the theme, whose text classes the probe measures.
  constructor(css) {
    this.box = shadowBox(hostTheme(css), 'left: -10000px; top: 0; visibility: hidden');
    this.probe = document.createElementNS(NS, 'svg');
    this.box.root.append(this.probe);
    this.cache = new Map();
  }

  // A text's width, ascent and height in a text class.
  text(text, cls) {
    const key = `${cls}\u0000${text}`;
    if (!this.cache.has(key)) this.cache.set(key, this.measure(text, cls));
    return this.cache.get(key);
  }

  measure(text, cls) {
    const element = document.createElementNS(NS, 'text');
    element.setAttribute('class', cls);
    element.textContent = text || ' ';
    this.probe.appendChild(element);
    const box = element.getBBox();
    element.remove();
    return { w: text ? box.width : 0, ascent: -box.y, h: box.height };
  }

  width(text, cls) { return this.text(text, cls).w; }

  // The y of the baseline that centres one line of a text class in a box of height h at top.
  baseline(top, h, cls) {
    const line = this.text('Hg', cls);
    return top + (h - line.h) / 2 + line.ascent;
  }

  dispose() { this.box.host.remove(); }
}

export const createMeasurer = css => new Measurer(css);
