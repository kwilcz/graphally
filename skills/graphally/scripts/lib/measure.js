// Copyright (c) 2026 Kamil Wilczyński (kwilcz). graphally Use-Only License: see LICENSE.
// Text measurement with the same SVG text classes the output uses, so what we measure is
// what renders.
const NS = 'http://www.w3.org/2000/svg';

export function createMeasurer() {
  const probe = document.createElementNS(NS, 'svg');
  probe.setAttribute('style', 'position:absolute;left:-10000px;top:0;visibility:hidden');
  document.body.appendChild(probe);
  const cache = new Map();
  const m = {
    text(str, cls) {
      const key = cls + '\u0000' + str;
      if (!cache.has(key)) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('class', cls);
        t.textContent = str || ' ';
        probe.appendChild(t);
        const b = t.getBBox();
        t.remove();
        cache.set(key, { w: str ? b.width : 0, ascent: -b.y, h: b.height });
      }
      return cache.get(key);
    },
    width: (str, cls) => m.text(str, cls).w,
    // Word wrap to a measured width, balanced: find the narrowest width that keeps the same
    // number of lines, so "Sandbox Team / A" becomes "Sandbox / Team A".
    wrap(str, cls, max) {
      // A word wider than the line breaks after its dots, hyphens or slashes
      // ("privatelink.database." / "windows.net").
      const tokens = String(str).split(/\s+/).filter(Boolean).flatMap(w => {
        if (m.width(w, cls) <= max) return [w];
        const parts = w.split(/(?<=[.\-/_])/), out = [];
        let cur = '';
        for (const p of parts) { if (cur && m.width(cur + p, cls) > max) { out.push(cur + '\u0000'); cur = p; } else cur += p; }
        if (cur) out.push(cur);
        return out;
      });
      const greedy = (limit) => {
        const words = tokens, lines = [];
        let line = '';
        for (const w of words) {
          const next = line ? (line.endsWith('\u0000') ? line.slice(0, -1) + w : `${line} ${w}`) : w;
          if (line && m.width(next, cls) > limit) { lines.push(line); line = w; } else line = next;
        }
        if (line) lines.push(line);
        // A separator never ends or starts a line: "Azure Firewall" / "Premium · public IP".
        return lines.length ? lines.map(l => l.replace(/\u0000$/, '').replace(/\s+[·|,]$/, '').replace(/^[·|]\s+/, '')) : [''];
      };
      const first = greedy(max);
      if (first.length < 2) return first;
      let lo = Math.max(...tokens.map(w => m.width(w.replace(/\u0000$/, ''), cls))), hi = max;
      for (let i = 0; i < 12 && hi - lo > 1; i++) {
        const mid = (lo + hi) / 2;
        if (greedy(mid).length > first.length) lo = mid; else hi = mid;
      }
      return greedy(hi);
    },
    // y of the baseline that centres one line of `cls` in a box of height h at top.
    baseline(top, h, cls) { const t = m.text('Hg', cls); return top + (h - t.h) / 2 + t.ascent; },
    dispose() { probe.remove(); },
  };
  return m;
}
