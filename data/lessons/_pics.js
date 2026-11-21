/* Lesson pictures: shared drawings for Algorithms lessons, loaded on demand before a lesson runs
   (built to dist/data/lessons/_pics.js; src/algo.js loads it once). Adds LessonKit.pics and injects its own CSS
   once as <style id="lp-css">. Plain browser script, no import/export.

   Every helper returns an HTML string and escapes all text. States (one shared visual language with the kit):
     in      in play / highlighted (solid ink)
     enter   just added, or correct (green)
     next    up next (green outline)
     leave   being removed right now (red, struck through) - the only other use of red is a mistake:
     no      a mistake (red outline)
     dup     a clash, e.g. a repeat (solid red, as the kit's cells)
     accent  the thing to look at / current (thick ink ring, never the accent hue: in the light theme it sits too close
             to mistake red). Pointers, frames, sweep lines and loop arrows that mean "current" are ink too.
     gone    out of play (faint, struck through)
     wall    blocked (grid walls)
   Pass states as { key: "in" } maps (cls). Any other lower-case class name is passed through for lesson CSS.
   pick: true or a function (key...) => bool turns items into real <button>s with data-i, at least 44px tall.
   Lines and arrows are inline SVG (non-scaling strokes) or CSS; all colour comes from the site's tokens. */
(() => {
  const K = window.LessonKit;
  if (!K) return;
  const esc = K.esc;
  const SAFE = /^[a-z][a-z0-9-]*$/;
  const st = s => s == null || s === false ? "" : String(s).split(/\s+/).filter(x => SAFE.test(x)).join(" ");
  const isPick = (pick, ...a) => typeof pick === "function" ? !!pick(...a) : !!pick;
  const cap = title => title ? `<div class="lp-cap">${esc(title)}</div>` : "";
  const len = v => String(v == null ? "" : v).length;
  const vcls = v => len(v) > 4 ? " xl" : len(v) > 2 ? " long" : "";
  const n2 = x => Math.round(x * 1000) / 1000;
  const pct = x => `${n2(x * 100)}%`;
  // one item: <button> when picked, else <div>; attrs as [name, value] pairs
  const item = (pick, cls, attrs, inner, aria) => {
    const t = pick ? "button" : "div";
    const a = attrs.filter(([, v]) => v != null).map(([k, v]) => ` ${k}="${esc(v)}"`).join("");
    return `<${t}${pick ? ' type="button"' : ""} class="${cls}"${a}${pick && aria != null ? ` aria-label="${esc(aria)}"` : ""}>${inner}</${t}>`;
  };

  /* ---------- CSS (injected once) ---------- */
  const CSS = `
.lp { --lp-g: 8px; margin-top: 24px; position: relative; }
.lp-cap { font: 700 13px var(--mono); color: var(--muted); margin-bottom: 8px; }
.lp-face { background: var(--lf, var(--sunk)); color: var(--lt, var(--ink-2)); box-shadow: inset 0 0 0 var(--lw, 1.5px) var(--lb, var(--line)); text-decoration: var(--ld, none); text-decoration-thickness: 2px; font: 700 18px var(--mono); display: grid; place-items: center; min-width: 0; }
.lp-face.long { font-size: 15px; } .lp-face.xl { font-size: 12px; }
.lp .in { --lf: var(--ink); --lt: var(--bg); --lb: var(--ink); --le: var(--ink); --lew: 3; }
.lp .enter { --lf: var(--good); --lt: var(--bg); --lb: var(--good); --le: var(--good); --lew: 3; }
.lp .next { --lf: var(--good-soft); --lt: var(--good); --lb: var(--good); --lw: 2px; --le: var(--good); --lew: 3; }
.lp .leave { --lf: var(--bad-soft); --lt: var(--bad); --lb: var(--bad); --lw: 2px; --ld: line-through; --le: var(--bad); --lew: 3; --led: 6 4; }
.lp .no { --lf: var(--bad-soft); --lt: var(--bad); --lb: var(--bad); --lw: 2px; --le: var(--bad); --lew: 3; }
.lp .dup { --lf: var(--bad); --lt: var(--bg); --lb: var(--bad); --le: var(--bad); --lew: 3; }
.lp .accent { --lf: var(--bg); --lt: var(--ink); --lb: var(--ink); --lw: 3px; --le: var(--ink); --lew: 4; }
.lp .gone { --lf: var(--bg); --lt: var(--faint); --lb: var(--line); --ld: line-through; --le: var(--faint); --led: 4 4; }
.lp .wall { --lf: var(--faint); --lt: var(--bg); --lb: var(--faint); }
:where(.lp button) { border: 0; padding: 0; margin: 0; font: inherit; cursor: pointer; background: none; color: inherit; }
.lp button:focus-visible { outline: 2.5px solid var(--ink); outline-offset: 2px; }
@media (hover: hover) { .lp button.lp-face:hover, .lp button:hover > .lp-face { box-shadow: inset 0 0 0 2.5px var(--ink); } }
.lp-e { stroke: var(--le, var(--muted)); stroke-width: var(--lew, 2); stroke-dasharray: var(--led, none); fill: none; }
.lp-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.lp-ah { position: absolute; width: 0; height: 0; border-left: 11px solid var(--le, var(--muted)); border-top: 6px solid transparent; border-bottom: 6px solid transparent; margin: -6px 0 0 -11px; transform-origin: 11px 6px; pointer-events: none; }
.lp-chip { position: absolute; transform: translate(-50%, -50%); background: var(--bg); color: var(--ink-2); font: 700 13px var(--mono); padding: 1px 5px; border-radius: 6px; box-shadow: inset 0 0 0 1px var(--line); white-space: nowrap; pointer-events: none; }
.lp-chip.in, .lp-chip.enter, .lp-chip.accent, .lp-chip.leave, .lp-chip.no { color: var(--le); box-shadow: inset 0 0 0 1.5px var(--le); }
.lp-chip.gone { color: var(--faint); }
.lp-note { position: absolute; transform: translateX(-50%); font: 700 12px var(--mono); color: var(--muted); white-space: nowrap; pointer-events: none; text-align: center; line-height: 1.25; background: var(--bg); padding: 0 3px; border-radius: 4px; }
.lp-note b { color: var(--ink); font-weight: 700; }
.lp-side { display: flex; flex-wrap: wrap; gap: 8px 32px; align-items: flex-end; }
.lp-side > * { flex: 1 1 200px; min-width: 0; }
.lp-side > .lp-col:has(> .chart) { flex: 2 1 300px; }
.lp-key { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 12px; font: 500 13px var(--font); color: var(--muted); }
.lp-key span { display: inline-flex; align-items: center; gap: 6px; }
.lp-key i { width: 18px; height: 18px; border-radius: 5px; display: inline-block; }
/* stack */
.lp-stack { display: grid; grid-template-columns: minmax(0, 220px) auto; gap: 6px 10px; align-items: center; justify-content: start; }
.lp-stk { grid-column: 1; display: grid; gap: 6px; padding: 6px; border: 2.5px solid var(--ink-2); border-top: 0; border-radius: 0 0 12px 12px; min-height: 60px; align-content: end; }
.lp-stk .lp-face { height: 44px; border-radius: 8px; width: 100%; }
.lp-stk .lp-empty { color: var(--faint); font: 500 14px var(--font); text-align: center; padding: 10px 0; }
.lp-stl { grid-column: 2; display: grid; gap: 6px; padding: 6px 0; align-content: end; font: 700 13px var(--mono); color: var(--ink); }
.lp-stl span { height: 44px; display: flex; align-items: center; white-space: nowrap; }
.lp-stl span.m { color: var(--muted); font-weight: 500; }
.lp-move { grid-column: 1; display: flex; align-items: center; justify-content: center; gap: 8px; font: 700 13px var(--mono); color: var(--muted); padding: 0 6px; }
.lp-move .lp-face { height: 44px; flex: 1; border-radius: 8px; }
.lp-move .ar { font-size: 20px; color: var(--muted); }
/* linked list */
.lp-list { --aw: 28px; }
.lp-lrow { display: grid; position: relative; }
.lp-lu { display: flex; align-items: center; min-width: 0; }
.lp-lbox { flex: 1; height: 50px; border-radius: 10px; }
.lp-lbox.lp-null { background: var(--bg); color: var(--faint); font: 500 13px var(--mono); overflow: hidden; border: 1.5px dashed var(--faint); box-shadow: none; box-sizing: border-box; }
.lp-arw { width: var(--aw); flex: none; height: 2.5px; position: relative; background: var(--le, var(--muted)); }
.lp-arw::after { content: ""; position: absolute; right: -1px; top: -5px; border-left: 9px solid var(--le, var(--muted)); border-top: 6px solid transparent; border-bottom: 6px solid transparent; }
.lp-arw.rev::after { right: auto; left: -1px; border-left: 0; border-right: 9px solid var(--le, var(--muted)); }
.lp-arw.gone { background: none; border-top: 2px dashed var(--line); height: 0; } .lp-arw.gone::after { display: none; }
.lp-arw.none { visibility: hidden; }
.lp-lptr { display: grid; margin-top: 6px; font: 700 13px var(--mono); color: var(--ink); }
.lp-lptr span { padding-right: var(--aw); text-align: center; overflow-wrap: anywhere; line-height: 1.25; }
.lp-loop { position: absolute; top: 4px; height: 26px; border: 2.5px solid var(--ink-2); border-bottom: 0; border-radius: 12px 12px 0 0; pointer-events: none; }
.lp-loop::after { content: ""; position: absolute; left: -7.5px; bottom: -3px; border-top: 9px solid var(--ink-2); border-left: 6px solid transparent; border-right: 6px solid transparent; }
/* tree and graph nodes */
.lp-tin, .lp-graph { margin-left: auto; margin-right: auto; }
.lp-tbox { position: relative; }
.lp-node { position: absolute; width: 44px; height: 44px; transform: translate(-50%, -50%); display: grid; place-items: center; }
.lp-node .lp-face { width: 40px; height: 40px; border-radius: 50%; font-size: 16px; }
.lp-node .lp-face.long { font-size: 13px; } .lp-node .lp-face.xl { font-size: 10.5px; }
.lp-node.end .lp-face { box-shadow: inset 0 0 0 var(--lw, 1.5px) var(--lb, var(--line)), 0 0 0 3px var(--bg), 0 0 0 5px var(--lb, var(--ink-2)); }
.lp-node.end:not(.in):not(.enter):not(.accent):not(.leave):not(.no):not(.dup):not(.next) { --lb: var(--ink-2); }
.lp-heapr { margin-top: 18px; }
.lp-graph { padding: 28px 28px 34px; box-sizing: border-box; }
.lp-gbox { position: relative; width: 100%; }
/* grid */
.lp-grid { display: grid; gap: 3px; margin-left: 0; }
.lp-grid.pick { gap: 2px; }
.lp-gc { aspect-ratio: 1; border-radius: 6px; position: relative; font-size: 16px; }
.lp-gc.long { font-size: 13px; } .lp-gc.xl { font-size: 10.5px; }
.lp-grid.pick .lp-gc { min-height: 44px; }
.lp-gh { font: 600 12px var(--mono); color: var(--muted); display: grid; place-items: center; padding: 2px 4px; white-space: nowrap; }
.lp-ga { position: absolute; width: 0; height: 0; border-left: 8px solid var(--ink-2); border-top: 5px solid transparent; border-bottom: 5px solid transparent; margin: -5px 0 0 -4px; transform-origin: 4px 5px; pointer-events: none; }
/* intervals */
.lp-iv { display: grid; grid-template-columns: minmax(0, 1fr); row-gap: 6px; }
.lp-iv.gut { grid-template-columns: auto minmax(0, 1fr); column-gap: 10px; }
.lp-ivl { grid-column: 1; font: 600 14px var(--font); color: var(--ink-2); display: flex; align-items: center; white-space: nowrap; max-width: 9em; overflow: hidden; text-overflow: ellipsis; }
.lp-ivt { position: relative; height: 34px; margin: 0 14px; grid-column: -2; }
.lp-iv.pick .lp-ivt { height: 44px; }
.lp-ivb { position: absolute; top: 0; bottom: 0; min-width: 6px; border-radius: 7px; font: 700 13px var(--mono); padding: 0 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; display: block; line-height: 34px; text-align: center; box-sizing: border-box; }
.lp-iv.pick .lp-ivb { line-height: 44px; }
.lp-ivn { position: absolute; top: 50%; transform: translateY(-50%); font: 700 13px var(--mono); color: var(--muted); white-space: nowrap; pointer-events: none; }
.lp-ivx { position: relative; height: 26px; margin: 2px 14px 0; border-top: 2px solid var(--ink); grid-column: -2; }
.lp-ivx span { position: absolute; top: 4px; transform: translateX(-50%); font: 500 12px var(--mono); color: var(--muted); }
.lp-ivx span::before { content: ""; position: absolute; left: 50%; top: -6px; height: 5px; border-left: 1.5px solid var(--ink); }
.lp-ivs { grid-column: -2; grid-row: 1 / -1; position: relative; margin: 0 14px; pointer-events: none; }
.lp-ivs i { position: absolute; top: -8px; bottom: 0; border-left: 2.5px dashed var(--ink); }
.lp-ivs b { position: absolute; top: -26px; transform: translateX(-50%); font: 700 12px var(--mono); color: var(--ink); white-space: nowrap; }
.lp-iv.sw { padding-top: 22px; }
/* 1-D row */
.lp-row1 { position: relative; }
.lp-r1 { display: grid; }
.lp-r1c { padding: 0 3px; min-width: 0; display: grid; }
.lp-r1c .lp-face { height: 50px; border-radius: 8px; width: 100%; }
.lp-r1l { display: grid; margin-top: 5px; font: 500 12px var(--mono); color: var(--muted); }
.lp-r1l span { text-align: center; white-space: nowrap; overflow: hidden; }
.lp-r1l.ptrs span { font-weight: 700; font-size: 13px; color: var(--ink); overflow-wrap: anywhere; white-space: normal; }
.lp-arcs { position: relative; }
.lp-arcs .lp-e { stroke: var(--ink-2); stroke-width: 2.5; }
.lp-arcs .lp-ah { border-left-color: var(--ink-2); }
/* bits */
.lp-bits { display: grid; gap: 4px; align-items: center; justify-content: start; }
.lp-bits .lp-face { height: 44px; border-radius: 7px; min-width: 26px; }
.lp-bits .b0 { --lt: var(--faint); font-weight: 500; }
.lp-bits .b1 { --lt: var(--ink); }
.lp-bits .b0.in, .lp-bits .b1.in, .lp-bits .b0.enter, .lp-bits .b1.enter, .lp-bits .b0.dup, .lp-bits .b1.dup, .lp-bits .b0.wall, .lp-bits .b1.wall { --lt: var(--bg); }
.lp-bits .b0.next, .lp-bits .b1.next { --lt: var(--good); } .lp-bits .b0.leave, .lp-bits .b1.leave, .lp-bits .b0.no, .lp-bits .b1.no { --lt: var(--bad); }
.lp-bits .b0.accent, .lp-bits .b1.accent { --lt: var(--ink); } .lp-bits .b0.gone, .lp-bits .b1.gone { --lt: var(--faint); }
.lp-bph { font: 500 11px var(--mono); color: var(--muted); text-align: center; white-space: nowrap; }
.lp-bn { font: 700 14px var(--mono); color: var(--ink-2); padding-right: 6px; white-space: nowrap; }
.lp-bv { font: 700 15px var(--mono); color: var(--ink); padding-left: 8px; white-space: nowrap; }
.lp-bv::before { content: "= "; color: var(--muted); font-weight: 500; }
.lp-brule { grid-column: 1 / -1; border-top: 2px solid var(--ink); height: 0; margin: 2px 0; }
@media (max-width: 620px) {
  .lp { --lp-g: 4px; }
  .lp-face { font-size: 16px; } .lp-face.long { font-size: 13px; } .lp-face.xl { font-size: 10.5px; }
  .lp-node .lp-face { width: 36px; height: 36px; font-size: 14px; }
  .lp-node .lp-face.long { font-size: 12px; } .lp-node .lp-face.xl { font-size: 9.5px; }
  .lp-list { --aw: 16px; } .lp-lbox.lp-null { font-size: 10.5px; }
  .lp-lptr { font-size: 11.5px; }
  .lp-gc { font-size: 14px; }
  .lp-graph { padding: 24px 24px 30px; }
  .lp-chip { font-size: 12px; }
  .lp-note { font-size: 11px; }
  .lp-bits { gap: 3px; } .lp-bits .lp-face { min-width: 0; }
  .lp-bn { font-size: 13px; } .lp-bv { font-size: 14px; padding-left: 4px; }
}`;
  if (typeof document !== "undefined" && !document.getElementById("lp-css")) {
    const s = document.createElement("style");
    s.id = "lp-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* side(...html): pictures side by side, wrapping on a phone. Each argument is one column, however many top-level
     blocks it holds (kit.bars returns chart + labels + pointers); a column holding a bar chart gets twice the room. */
  const side = (...parts) => `<div class="lp-side">${parts.map(p => `<div class="lp-col">${p}</div>`).join("")}</div>`;
  /* key([[state, "meaning"], ...]): a small legend of swatches in the shared states. */
  const key = entries => `<div class="lp lp-key">${entries.map(([s, t]) => `<span class="${st(s)}"><i class="lp-face"></i>${esc(t)}</span>`).join("")}</div>`;

  /* stack(items, { cls, pick, top = true, labels, move, empty, title })
     items bottom → top (index 0 at the bottom, like a JS array after push). cls {i: state}; top marks the top item;
     labels {i: text} beside items; move { v, dir: "in" | "out", cls } draws an item above the open top, arriving or leaving. */
  function stack(items, { cls = {}, pick = false, top = true, labels = {}, move = null, empty = "empty", title = "" } = {}) {
    const N = items.length, rows = [];
    for (let i = N - 1; i >= 0; i--) rows.push(i);
    const tag = i => [top && i === N - 1 ? "top" : "", labels[i] != null ? String(labels[i]) : ""].filter(Boolean);
    const mv = move ? `<div class="lp-move"><span class="ar" aria-hidden="true">${move.dir === "out" ? "↑" : "↓"}</span><div class="lp-face ${st(move.cls || (move.dir === "out" ? "leave" : "enter"))}${vcls(move.v)}" style="border-radius:8px">${esc(move.v)}</div><span class="ar" aria-hidden="true">${move.dir === "out" ? "↑" : "↓"}</span></div><div></div>` : "";
    return `<div class="lp lp-stackw">${cap(title)}<div class="lp-stack">${mv}<div class="lp-stk">${N ? rows.map(i => item(isPick(pick, i), `lp-face ${st(cls[i])}${vcls(items[i])}`, [["data-i", i]], esc(items[i]), `${items[i]}${tag(i).length ? " (" + tag(i).join(", ") + ")" : ""}`)).join("") : `<div class="lp-empty">${esc(empty)}</div>`}</div>
      <div class="lp-stl" aria-hidden="true">${N ? rows.map(i => { const t = tag(i); return `<span class="${t[0] === "top" ? "" : "m"}">${t.length ? (t[0] === "top" ? "← " : "") + esc(t.join(" · ")) : ""}</span>`; }).join("") : ""}</div></div></div>`;
  }

  /* list(values, { cls, ptrs, links, cycle, nullEnd, pick, title })
     A linked list: boxes joined by arrows. cls {i: state}; ptrs {i: "slow fast"} names under nodes; links {i: state | "rev"}
     styles the arrow leaving node i ("rev" points it from node i+1 back to node i, "gone" = cut, "none" = hidden);
     cycle: k draws an arrow from the last node back to node k; nullEnd: show a "null" box after the last node. */
  function list(values, { cls = {}, ptrs = {}, links = {}, cycle = null, nullEnd = false, pick = false, title = "" } = {}) {
    const N = values.length, T = N + (nullEnd ? 1 : 0), cols = `grid-template-columns:repeat(${T},minmax(0,1fr))`;
    const units = values.map((v, i) => {
      const lk = String(links[i] || ""), last = i === N - 1 && !nullEnd;
      const arw = `<span class="lp-arw ${last ? "none" : st(lk)}" aria-hidden="true"></span>`;
      return `<div class="lp-lu">${item(isPick(pick, i), `lp-lbox lp-face ${st(cls[i])}${vcls(v)}`, [["data-i", i]], esc(v), `${v}${ptrs[i] ? " (" + ptrs[i] + ")" : ""}`)}${arw}</div>`;
    });
    if (nullEnd) units.push(`<div class="lp-lu"><div class="lp-lbox lp-face lp-null">null</div><span class="lp-arw none" aria-hidden="true"></span></div>`);
    const loop = cycle != null && cycle >= 0 && cycle < N - 1
      ? `<div class="lp-loop" aria-hidden="true" style="left:calc(${cycle} * 100% / ${T} + (100% / ${T} - var(--aw)) / 2);width:calc(${N - 1 - cycle} * 100% / ${T})"></div>` : "";
    const hasPtr = Object.keys(ptrs).length > 0;
    return `<div class="lp lp-list">${cap(title)}<div class="lp-lrow" style="${cols}${loop ? ";padding-top:30px" : ""}">${units.join("")}${loop}</div>${hasPtr ? `<div class="lp-lptr" style="${cols}">${Array.from({ length: T }, (_, i) => `<span>${ptrs[i] ? esc(ptrs[i]) : ""}</span>`).join("")}</div>` : ""}</div>`;
  }

  /* Tree input → laid-out nodes [{ key, v, x (0..1), d, parent }]. */
  function layoutTree(root, layout) {
    const out = [];
    if (root == null) return { nodes: out, depth: 0, slots: 1 };
    const kidsOf = o => Array.isArray(o.kids) ? o.kids : Array.isArray(o.children) ? o.children : null;
    if (!Array.isArray(root) && kidsOf(root)) {
      // n-ary (a trie): key = node.id, else the dotted child-index path ("0", "0.1", ...); leaves share the width
      let leaf = 0, depth = 0;
      const walk = (o, path, d, parent) => {
        depth = Math.max(depth, d + 1);
        const k = o.id != null ? o.id : path, rec = { key: k, v: o.v != null ? o.v : o.val != null ? o.val : o.value != null ? o.value : "", d, parent, edge: o.edge };
        out.push(rec);
        const ks = (kidsOf(o) || []).filter(c => c != null);
        if (!ks.length) rec.slot = leaf++;
        else { const xs = ks.map((c, j) => walk(c, path + "." + j, d + 1, k)); rec.slot = (xs[0] + xs[xs.length - 1]) / 2; }
        return rec.slot;
      };
      walk(root, "0", 0, null);
      out.forEach(r => { r.x = (r.slot + 0.5) / leaf; });
      return { nodes: out, depth, slots: leaf };
    }
    // binary: key = heap position (root 0, children 2p+1 and 2p+2)
    const vals = new Map();
    if (Array.isArray(root)) {
      // level order, LeetCode style: children of a null are not listed
      if (root.length && root[0] != null) {
        vals.set(0, root[0]);
        const q = [0]; let i = 1;
        while (q.length && i < root.length) {
          const p = q.shift();
          for (const c of [2 * p + 1, 2 * p + 2]) if (i < root.length) { const v = root[i++]; if (v != null) { vals.set(c, v); q.push(c); } }
        }
      }
    } else {
      const walk = (o, p) => {
        if (o == null) return;
        vals.set(p, o.v != null ? o.v : o.val != null ? o.val : o.value);
        walk(o.l !== undefined ? o.l : o.left, 2 * p + 1); walk(o.r !== undefined ? o.r : o.right, 2 * p + 2);
      };
      walk(root, 0);
    }
    const dep = p => Math.floor(Math.log2(p + 1));
    const keys = [...vals.keys()], depth = keys.length ? Math.max(...keys.map(dep)) + 1 : 0, n = keys.length;
    const heapSlots = 2 ** Math.max(0, depth - 1);
    const mode = layout || (heapSlots <= Math.max(n, 8) ? "heap" : "inorder");
    let rank = null;
    if (mode === "inorder") {
      rank = new Map(); let r = 0;
      const io = p => { if (!vals.has(p)) return; io(2 * p + 1); rank.set(p, r++); io(2 * p + 2); };
      io(0);
    }
    for (const p of keys.sort((a, b) => a - b)) {
      const d = dep(p), kk = p - (2 ** d - 1);
      out.push({ key: p, v: vals.get(p), d, parent: p ? Math.floor((p - 1) / 2) : null, x: mode === "inorder" ? (rank.get(p) + 0.5) / n : (kk + 0.5) / 2 ** d });
    }
    return { nodes: out, depth, slots: mode === "inorder" ? n : heapSlots, vals };
  }

  /* tree(root, { cls, edges, edgeLabels, notes, ptrs, ends, pick, layout, array, title })
     root: a level-order array with nulls ([5, 3, 8, null, 4]), a nested { v, l, r } object (also val/left/right), or an
     n-ary { v, kids: [...] } object for a trie (node key = its id, else the path "0", "0.1", ...; an optional edge: "a" labels
     the edge into it). Binary node key = heap position: root 0, children of p are 2p+1 and 2p+2.
     cls {key: state}; edges {childKey: state} styles the edge into that child; edgeLabels {childKey: text}; notes {key: text}
     (values carried up or down, shown under the node); ptrs {key: name} (bold ink, under the node); ends {key: true} double ring
     (a trie word ends here); layout "heap" | "inorder" (default: whichever fits); array: true also draws the same values as an
     array row underneath (a heap), states kept in sync by index. */
  function tree(root, { cls = {}, edges = {}, edgeLabels = {}, notes = {}, ptrs = {}, ends = {}, pick = false, layout = null, array = false, title = "" } = {}) {
    const { nodes, depth, slots, vals } = layoutTree(root, layout);
    if (!nodes.length) return `<div class="lp lp-tree">${cap(title)}<div class="lp-empty" style="color:var(--faint)">empty tree</div></div>`;
    edgeLabels = { ...edgeLabels };
    nodes.forEach(r => { if (r.edge != null && edgeLabels[r.key] == null) edgeLabels[r.key] = r.edge; });
    const hasNote = nodes.some(r => notes[r.key] != null || ptrs[r.key] != null);
    const hasLab = nodes.some(r => r.parent != null && edgeLabels[r.key] != null), rowH = hasNote || hasLab ? 86 : 66, top = 24, H = (depth - 1) * rowH + top * 2 + (hasNote ? 20 : 0);
    const at = new Map(nodes.map(r => [r.key, r])), y = r => top + r.d * rowH;
    const lines = nodes.filter(r => r.parent != null && at.has(r.parent)).map(r => {
      const p = at.get(r.parent);
      return `<line class="lp-e ${st(edges[r.key])}" x1="${n2(p.x * 1000)}" y1="${y(p)}" x2="${n2(r.x * 1000)}" y2="${y(r)}" vector-effect="non-scaling-stroke"/>`;
    }).join("");
    const chips = nodes.filter(r => r.parent != null && edgeLabels[r.key] != null && at.has(r.parent)).map(r => {
      const p = at.get(r.parent);
      return `<span class="lp-chip ${st(edges[r.key])}" style="left:${pct((p.x + r.x) / 2)};top:${(y(p) + y(r)) / 2}px">${esc(edgeLabels[r.key])}</span>`;
    }).join("");
    const nds = nodes.map(r => item(isPick(pick, r.key), `lp-node ${st(cls[r.key])}${ends[r.key] ? " end" : ""}`, [["data-i", r.key], ["style", `left:${pct(r.x)};top:${y(r)}px`]],
      `<span class="lp-face${vcls(r.v)}">${esc(r.v)}</span>`, `${r.v}${notes[r.key] != null ? ", " + notes[r.key] : ""}`)).join("");
    const nts = hasNote ? nodes.filter(r => notes[r.key] != null || ptrs[r.key] != null).map(r =>
      `<span class="lp-note" style="left:${pct(r.x)};top:${y(r) + 24}px">${ptrs[r.key] != null ? `<b>${esc(ptrs[r.key])}</b>` : ""}${ptrs[r.key] != null && notes[r.key] != null ? "<br>" : ""}${notes[r.key] != null ? esc(notes[r.key]) : ""}</span>`).join("") : "";
    let arr = "";
    if (array && vals) {
      const n = Math.max(...vals.keys()) + 1, values = Array.from({ length: n }, (_, i) => vals.has(i) ? vals.get(i) : "");
      arr = `<div class="lp-heapr">${row1d(values, { cls, pick, ptrs: {}, labels: values.map((_, i) => i), bare: true })}</div>`;
    }
    return `<div class="lp lp-tree">${cap(title)}<div class="lp-tin" style="max-width:${Math.max(260, slots * 92)}px"><div class="lp-tbox" style="height:${H}px"><svg class="lp-svg" viewBox="0 0 1000 ${H}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${chips}${nds}${nts}</div>${arr}</div></div>`;
  }

  /* graph(nodes, edges, { directed, cls, ecls, notes, pick, title })
     nodes: [{ id, x, y, label? }] at positions the lesson chooses (small whole numbers on a grid, about 5 columns at most);
     edges: [[from, to, weight?]]. cls {id: state}; ecls {"a-b": state} (undirected edges match either order); notes {id: text}
     under the node (a distance, a colour). Edges are straight: avoid two edges between the same pair. */
  function graph(nodes, edges = [], { directed = false, cls = {}, ecls = {}, notes = {}, pick = false, title = "" } = {}) {
    const xs = nodes.map(n => +n.x), ys = nodes.map(n => +n.y);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (x1 - x0 < 1) { x0 -= 0.5; x1 += 0.5; }
    if (y1 - y0 < 1) { const m = (y0 + y1) / 2; y0 = m - 0.5; y1 = m + 0.5; }
    const W = x1 - x0, H = y1 - y0, by = new Map(nodes.map(n => [String(n.id), n]));
    const P = n => [(n.x - x0) / W, (n.y - y0) / H];
    const eKey = ([a, b]) => { const k = `${a}-${b}`; return ecls[k] != null || directed ? ecls[k] : ecls[`${b}-${a}`]; };
    const lines = [], marks = [];
    for (const e of edges) {
      const a = by.get(String(e[0])), b = by.get(String(e[1]));
      if (!a || !b) continue;
      const [ax, ay] = P(a), [bx, by2] = P(b), s = st(eKey(e));
      lines.push(`<line class="lp-e ${s}" x1="${n2(ax * W * 100)}" y1="${n2(ay * H * 100)}" x2="${n2(bx * W * 100)}" y2="${n2(by2 * H * 100)}" vector-effect="non-scaling-stroke"/>`);
      const ang = Math.atan2((b.y - a.y), (b.x - a.x)), c = Math.cos(ang), sn = Math.sin(ang);
      if (directed) marks.push(`<span class="lp-ah ${s}" style="left:calc(${pct(bx)} - ${n2(c * 23)}px);top:calc(${pct(by2)} - ${n2(sn * 23)}px);transform:rotate(${n2(ang * 180 / Math.PI)}deg)"></span>`);
      if (e[2] != null) marks.push(`<span class="lp-chip ${s}" style="left:${pct((ax + bx) / 2)};top:${pct((ay + by2) / 2)}">${esc(e[2])}</span>`);
    }
    const nds = nodes.map(n => { const [px, py] = P(n), label = n.label != null ? n.label : n.id;
      return item(isPick(pick, n.id), `lp-node ${st(cls[n.id])}`, [["data-i", n.id], ["style", `left:${pct(px)};top:${pct(py)}`]], `<span class="lp-face${vcls(label)}">${esc(label)}</span>`, `${label}${notes[n.id] != null ? ", " + notes[n.id] : ""}`); }).join("");
    const nts = nodes.filter(n => notes[n.id] != null).map(n => { const [px, py] = P(n); return `<span class="lp-note" style="left:${pct(px)};top:calc(${pct(py)} + 22px)">${esc(notes[n.id])}</span>`; }).join("");
    return `<div class="lp lp-graphw">${cap(title)}<div class="lp-graph" style="max-width:${Math.round((W + 1) * 130 + 56)}px"><div class="lp-gbox" style="aspect-ratio:${n2(W)} / ${n2(H)}"><svg class="lp-svg" viewBox="0 0 ${n2(W * 100)} ${n2(H * 100)}" preserveAspectRatio="none" aria-hidden="true">${lines.join("")}</svg>${marks.join("")}${nds}${nts}</div></div></div>`;
  }

  /* grid(rows, { cls, pick, rowHead, colHead, from, title })
     rows: 2-D array of cell values ("" or null = blank). Cell key "r,c": cls {"r,c": state} (use "wall" for walls);
     pick makes cells buttons with data-i="r,c" (keep to 7 columns at phone width); rowHead/colHead: header texts;
     from {"r,c": [[r2, c2], ...]} draws a small arrow on the cell's edge for each neighbour it was built from (2-D DP). */
  function grid(rows, { cls = {}, pick = false, rowHead = null, colHead = null, from = {}, title = "" } = {}) {
    const R = rows.length, C = Math.max(0, ...rows.map(r => r.length)), anyPick = rows.some((r, i) => r.some((_, j) => isPick(pick, i, j)));
    const cs = 56, hw = rowHead ? 48 : 0;
    const tmpl = `grid-template-columns:${rowHead ? "auto " : ""}repeat(${C},minmax(0,1fr));max-width:${C * cs + hw}px`;
    const arrows = k => (from[k] || []).map(([r2, c2]) => {
      const [r, c] = k.split(",").map(Number), dr = Math.sign(r2 - r), dc = Math.sign(c2 - c);
      if (!dr && !dc) return "";
      const ang = Math.atan2(-dr, -dc) * 180 / Math.PI;
      return `<i class="lp-ga" aria-hidden="true" style="left:${50 + dc * 38}%;top:${50 + dr * 38}%;transform:rotate(${n2(ang)}deg)"></i>`;
    }).join("");
    let h = "";
    if (colHead) h += (rowHead ? `<span class="lp-gh"></span>` : "") + Array.from({ length: C }, (_, j) => `<span class="lp-gh">${colHead[j] == null ? "" : esc(colHead[j])}</span>`).join("");
    rows.forEach((row, i) => {
      if (rowHead) h += `<span class="lp-gh">${rowHead[i] == null ? "" : esc(rowHead[i])}</span>`;
      for (let j = 0; j < C; j++) {
        const v = row[j] == null ? "" : row[j], k = `${i},${j}`;
        h += item(isPick(pick, i, j), `lp-gc lp-face ${st(cls[k])}${vcls(v)}`, [["data-i", k], ["data-r", i], ["data-c", j]], esc(v) + arrows(k), `row ${i + 1}, column ${j + 1}${v !== "" ? ": " + v : ""}`);
      }
    });
    return `<div class="lp lp-gridw">${cap(title)}<div class="lp-grid${anyPick ? " pick" : ""}" style="${tmpl}">${h}</div></div>`;
  }

  /* intervals(items, { cls, packed, sweep, sweepLabel, min, max, step, pick, title })
     items: [[start, end, label?]] on one shared number line. One per row (labels in a left column), or packed: true to share
     rows when they do not overlap (labels inside the bars, keep them to a few characters). One per row shows "start–end"
     inside a wide bar or beside a short one (text: false hides it). cls {i: state}; sweep: x draws a vertical line at x;
     sweepLabel: its text; step: tick spacing (default: a round step with at most 10 ticks). */
  function intervals(items, { cls = {}, packed = false, text = true, sweep = null, sweepLabel = null, min = null, max = null, step = null, pick = false, title = "" } = {}) {
    const its = items.map(it => Array.isArray(it) ? { s: +it[0], e: +it[1], label: it[2] } : { s: +it.s, e: +it.e, label: it.label });
    const lo = min != null ? min : Math.min(...its.map(i => i.s)), hi = max != null ? max : Math.max(...its.map(i => i.e)), span = hi - lo || 1;
    const X = v => pct((v - lo) / span);
    let lane = its.map((_, i) => i);
    if (packed) {
      const ends = [], order = its.map((_, i) => i).sort((a, b) => its[a].s - its[b].s || its[a].e - its[b].e);
      for (const i of order) { let l = ends.findIndex(e => e <= its[i].s); if (l < 0) { l = ends.length; ends.push(0); } ends[l] = its[i].e; lane[i] = l; }
    }
    const lanes = packed ? Math.max(0, ...lane) + 1 : its.length, gut = !packed && its.some(i => i.label != null);
    const anyPick = its.some((_, i) => isPick(pick, i));
    let h = "";
    for (let L = 0; L < lanes; L++) {
      const idx = its.map((_, i) => i).filter(i => lane[i] === L);
      if (gut) h += `<div class="lp-ivl" style="grid-row:${L + 1}">${idx.map(i => its[i].label != null ? esc(its[i].label) : "").join("")}</div>`;
      h += `<div class="lp-ivt" style="grid-row:${L + 1}">${idx.map(i => {
        const it = its[i], wf = (it.e - it.s) / span, txt = packed ? (it.label != null ? `${it.label}` : "") : text ? `${it.s}–${it.e}` : "";
        // one-per-row: the range sits inside a wide bar, else just outside it (after the end, or before the start near the right edge)
        const inside = packed || wf >= 0.35, out = !inside && txt ? ((it.e - lo) / span <= 0.72 ? `<span class="lp-ivn" style="left:calc(${X(it.e)} + 6px)">${esc(txt)}</span>` : `<span class="lp-ivn" style="right:calc(100% - ${X(it.s)} + 6px)">${esc(txt)}</span>`) : "";
        return item(isPick(pick, i), `lp-ivb lp-face ${st(cls[i])}`, [["data-i", i], ["style", `left:${X(it.s)};width:${pct(wf)}`]], inside ? esc(txt) : "", `${it.label != null ? it.label + ": " : ""}${it.s} to ${it.e}`) + out; }).join("")}</div>`;
    }
    let sp = step;
    if (!sp) { const raw = span / 10, m = 10 ** Math.floor(Math.log10(raw)); sp = [1, 2, 5, 10].map(f => f * m).find(f => f >= raw); }
    const ticks = []; for (let t = Math.ceil(lo / sp) * sp; t <= hi + 1e-9; t += sp) ticks.push(n2(t));
    h += `<div class="lp-ivx" style="grid-row:${lanes + 1}" aria-hidden="true">${ticks.map(t => `<span style="left:${X(t)}">${t}</span>`).join("")}</div>`;
    if (sweep != null) h += `<div class="lp-ivs" style="grid-row:1 / ${lanes + 2}" aria-hidden="true"><i style="left:${X(sweep)}"></i><b style="left:${X(sweep)}">${esc(sweepLabel != null ? sweepLabel : sweep)}</b></div>`;
    return `<div class="lp lp-ivw">${cap(title)}<div class="lp-iv${gut ? " gut" : ""}${anyPick ? " pick" : ""}${sweep != null ? " sw" : ""}">${h}</div></div>`;
  }

  /* row1d(values, { cls, labels, ptrs, from, pick, title })
     A 1-D table (dp[i]): one row of cells, index labels under it (labels: false hides them, or pass your own texts),
     ptrs {i: "i"} names under cells, from {i: [j, ...]} draws arcs above the row from each earlier cell j into cell i. */
  function row1d(values, { cls = {}, labels = undefined, ptrs = {}, from = {}, pick = false, title = "", bare = false } = {}) {
    const N = values.length, cols = `grid-template-columns:repeat(${N},minmax(0,1fr))`;
    const labs = labels === false ? null : labels || values.map((_, i) => i);
    const pairs = []; for (const [i, js] of Object.entries(from)) for (const j of js || []) if (+j !== +i) pairs.push([+j, +i]);
    const maxD = pairs.length ? Math.max(...pairs.map(([j, i]) => Math.abs(i - j))) : 0, AH = Math.min(64, 18 + maxD * 10);
    const arcs = pairs.length ? `<div class="lp-arcs" style="height:${AH}px" aria-hidden="true"><svg class="lp-svg" viewBox="0 0 ${N * 100} ${AH}" preserveAspectRatio="none">${pairs.map(([j, i]) => {
      const x1 = j * 100 + 50, x2 = i * 100 + 50, top = Math.max(3, AH - 12 - Math.abs(i - j) * 10);
      return `<path class="lp-e" d="M${x1} ${AH} C${x1} ${top} ${x2} ${top} ${x2} ${AH - 2}" vector-effect="non-scaling-stroke"/>`; }).join("")}</svg>${[...new Set(pairs.map(p => p[1]))].map(i => `<span class="lp-ah" style="left:${pct((i + 0.5) / N)};top:${AH - 5}px;transform:rotate(90deg)"></span>`).join("")}</div>` : "";
    const cells = values.map((v, i) => `<div class="lp-r1c">${item(isPick(pick, i), `lp-face ${st(cls[i])}${vcls(v)}`, [["data-i", i]], esc(v == null ? "" : v), `${labs ? labs[i] + ": " : ""}${v}`)}</div>`).join("");
    const lab = labs ? `<div class="lp-r1l" style="${cols}">${labs.map(t => `<span>${t == null ? "" : esc(t)}</span>`).join("")}</div>` : "";
    const pt = Object.keys(ptrs).length ? `<div class="lp-r1l ptrs" style="${cols}">${values.map((_, i) => `<span>${ptrs[i] ? esc(ptrs[i]) : ""}</span>`).join("")}</div>` : "";
    const body = `${arcs}<div class="lp-r1" style="${cols}">${cells}</div>${lab}${pt}`;
    return bare ? `<div class="lp-row1">${body}</div>` : `<div class="lp lp-row1">${cap(title)}${body}</div>`;
  }

  /* bits(n, { width, names, cls, op, places, values, pick, title })
     A number (or 2-3 numbers, aligned for AND/OR/XOR) as bit cells, highest bit on the left, place values on top.
     Bit key = its place power (0 = the 1s bit). cls {bit: state} for one row, or an array of such maps, one per row;
     names: row labels ("a", "b", "a & b"); op: true draws a rule above the last row (the result); values: false hides the
     "= 13" column; pick makes bits buttons with data-i = bit and data-row = row. */
  function bits(n, { width = null, names = null, cls = {}, op = false, places = true, values = true, pick = false, title = "" } = {}) {
    const ns = (Array.isArray(n) ? n : [n]).map(v => Math.max(0, Math.floor(+v)));
    const w = width || Math.max(4, ...ns.map(v => v.toString(2).length));
    const C = Array.isArray(cls) ? cls : [cls], hasN = !!names;
    const tmpl = `grid-template-columns:${hasN ? "auto " : ""}repeat(${w},minmax(0,44px))${values ? " auto" : ""}`;
    const pv = b => b < 11 ? String(2 ** b) : `2^${b}`;
    let h = "";
    if (places) h += (hasN ? "<span></span>" : "") + Array.from({ length: w }, (_, k) => `<span class="lp-bph">${pv(w - 1 - k)}</span>`).join("") + (values ? "<span></span>" : "");
    ns.forEach((v, r) => {
      if (op && r === ns.length - 1 && r > 0) h += `<span class="lp-brule"></span>`;
      if (hasN) h += `<span class="lp-bn">${names[r] == null ? "" : esc(names[r])}</span>`;
      for (let k = 0; k < w; k++) {
        const b = w - 1 - k, bit = Math.floor(v / 2 ** b) % 2;
        h += item(isPick(pick, b, r), `lp-face b${bit} ${st((C[r] || {})[b])}`, [["data-i", b], ["data-row", r]], String(bit), `bit ${pv(b)}${hasN && names[r] != null ? " of " + names[r] : ""}: ${bit}`);
      }
      if (values) h += `<span class="lp-bv">${v}</span>`;
    });
    return `<div class="lp lp-bitsw">${cap(title)}<div class="lp-bits" style="${tmpl}">${h}</div></div>`;
  }

  K.pics = { stack, list, tree, graph, grid, intervals, row1d, bits, side, key };
})();
