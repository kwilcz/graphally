// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Sequence diagrams for page mode: the placing an author should not do by hand, as one
// primitive a before-layout script calls. It decides where things go, not how they look:
// everything it makes is a plain element with a class, styled by CSS like the rest.
//
//   <div class=seq id=seq>
//     <div class=node id=shop data-who>…</div>                participants, in order
//     <div class="group external" data-who-group="stripe bank">Third parties</div>
//     <p class=msg data-from=shop data-to=pay>create payment</p>
//     <p class="msg reply" data-from=pay data-to=shop>client secret</p>
//     <div class=frag data-kind=alt data-guard="3-D Secure required">
//       <p class=msg …>…</p>
//       <div class=else data-guard="no 3-D Secure"></div>
//       <p class=msg …>…</p>
//     </div>
//   </div>
//
// sequence('#seq') gives the container a grid column per participant (lines named
// <id>-s and <id>-e), a row per message in document order, and makes: .lifeline under each
// participant, .activation from a call to its reply, .frag-box, .frag-tab and .frag-else
// for each fragment (spanning the participants its messages touch), and .num in each
// message. Messages from a participant to itself get the class self. The arrows are the
// diagram script's: each message knows its row, data-from and data-to.
export function sequence(box, { number = true, activations = true } = {}, problems) {
  if (!box) { problems.push({ rule: 'bad-option', option: 'sequence', hint: 'sequence(container): no such container' }); return null; }
  const who = [...box.querySelectorAll(':scope > [data-who]')];
  if (!who.length) { problems.push({ rule: 'bad-option', option: 'sequence', hint: 'no participants: mark them data-who, as direct children of the container' }); return null; }
  const ids = who.map(w => w.id), col = id => ids.indexOf(id);
  box.style.display = 'grid';
  box.style.gridTemplateColumns = ids.map((id, i) => `[${i ? `${ids[i - 1]}-e ` : ''}${id}-s] minmax(0, 1fr)`).join(' ') + ` [${ids.at(-1)}-e]`;
  who.forEach(w => { w.style.gridRow = '1'; w.style.gridColumn = `${w.id}-s / ${w.id}-e`; });
  const make = (cls, html = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const span = (lo, hi) => `${ids[lo]}-s / ${ids[hi]}-e`;

  // Rows in document order: a fragment takes a row for its tab and one to close it, an
  // else a row for its divider, a message one row.
  let row = 2, n = 0;
  const msgs = [], frags = [], back = [];
  const walk = (parent, depth) => {
    for (const e of [...parent.children]) {
      if (e.matches('.msg')) {
        const d = e.dataset, a = col(d.from), b = col(d.to);
        if (a < 0 || b < 0) { problems.push({ rule: 'unknown-id', id: a < 0 ? d.from : d.to, on: e.textContent.trim().slice(0, 40) }); continue; }
        e.style.gridRow = String(row);
        e.style.gridColumn = span(Math.min(a, b), Math.max(a, b));
        if (a === b) e.classList.add('self');
        const label = document.createElement('span');
        label.className = 'label';
        label.append(...e.childNodes);
        if (number) label.prepend(Object.assign(document.createElement('span'), { className: 'num', textContent: String(++n) }));
        e.append(label);
        msgs.push({ e, a, b, row: row++, reply: e.matches('.reply'), async: e.matches('.async') });
      } else if (e.matches('.frag')) {
        const f = { e, depth, start: row++, elses: [], cols: [] };
        frags.push(f);
        const before = msgs.length;
        walk(e, depth + 1);
        f.cols = msgs.slice(before).flatMap(m => [m.a, m.b]);
        f.end = row++;
        e.style.display = 'contents';
      } else if (e.matches('.else')) {
        frags.at(-1)?.elses.push({ guard: e.dataset.guard || '', row: row++ });
        e.style.display = 'none';
      } else if (e.querySelector('.msg, .frag')) walk(e, depth);
    }
  };
  walk(box, 0);
  // Each fragment spans the participants its messages touch, inset from their lifelines.
  for (const f of frags) {
    const lo = Math.min(...(f.cols.length ? f.cols : [0])), hi = Math.max(...(f.cols.length ? f.cols : [0]));
    const place = (el, r) => { el.style.gridRow = r; el.style.gridColumn = span(lo, hi); el.style.setProperty('--k', hi - lo + 1); el.style.setProperty('--depth', f.depth); return el; };
    back.push(place(make(`frag-box ${f.e.dataset.kind || ''}`), `${f.start} / ${f.end + 1}`));
    back.push(place(make('frag-tab', `<b>${esc(f.e.dataset.kind || 'opt')}</b>${f.e.dataset.guard ? `<span class=guard>[${esc(f.e.dataset.guard)}]</span>` : ''}`), String(f.start)));
    for (const x of f.elses) back.push(place(make('frag-else', x.guard ? `<span class=guard>[${esc(x.guard)}]</span>` : ''), String(x.row)));
    back.push(place(make('frag-end'), String(f.end)));
  }
  for (const g of box.querySelectorAll(':scope > [data-who-group]')) {
    const cs = g.dataset.whoGroup.split(/[\s,]+/).map(col).filter(c => c >= 0);
    if (!cs.length) continue;
    g.style.gridRow = `1 / ${row}`; g.style.gridColumn = span(Math.min(...cs), Math.max(...cs)); g.style.setProperty('--k', Math.max(...cs) - Math.min(...cs) + 1);
    g.classList.add('who-group');
    back.unshift(g);
  }
  for (const id of ids) { const l = make('lifeline'); l.style.gridRow = `2 / ${row}`; l.style.gridColumn = `${id}-s / ${id}-e`; back.push(l); }
  // An activation runs from a call to the reply that answers it (or one row).
  if (activations) msgs.forEach((m, i) => {
    if (m.reply || m.async || m.a === m.b) return;
    const r = msgs.slice(i + 1).find(x => x.reply && x.a === m.b && x.b === m.a);
    const end = r ? r.row : m.row + 1;
    const act = make('activation');
    act.style.gridRow = `${m.row + 1} / ${end + 1}`; act.style.gridColumn = `${ids[m.b]}-s / ${ids[m.b]}-e`;
    back.push(act);
  });
  box.prepend(...back);
  return { participants: ids, rows: row - 1, messages: msgs.length };
}
