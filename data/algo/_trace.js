/* Trace player for Algorithms solutions ("Watch it run on Example 1"). Plain browser script, no import/export,
   built to dist/data/algo/_trace.js and loaded on first play, after the lesson pictures module (LessonKit.pics).
   Adds window.TraceView and injects its CSS once as <style id="tv-css">.

   Data: dist/data/algo/trace/<id>.json = { case, sols: [{ ts|py: { steps, gap? } | { skip }, jsMap, notes }], expected | calls }
   Step = { l, d, fn, v, self?, stack, ch, c?, r? }: line l ran; v/self = the state right after it (encoding in
   docs/superpowers/plans/2026-11-20-code-trace.md: $u undefined, $n number text, $cut truncated, $map, $set,
   $list/$tree with id, $ref {id, at} = a variable pointing into that structure, $obj object fields).

   Pure renderers (all text escaped; notes are authored HTML): code(src, lit), state(step, opts), note(notes, lang, line),
   result(step, expected), gapLine(gap). mount(el, opts) runs one player. No colour words anywhere: themes invert. */
(() => {
  const K = window.LessonKit;
  if (!K || !K.pics) return;
  const esc = K.esc, pics = K.pics;
  const IDX = new Set(["i", "j", "k", "l", "r", "lo", "hi", "mid", "left", "right", "start", "end", "slow", "fast", "p", "q"]);
  const PAIRS = [["i", "j"], ["r", "c"], ["row", "col"], ["x", "y"]];
  const isObj = x => x !== null && typeof x === "object" && !Array.isArray(x);
  const isInt = x => typeof x === "number" && Number.isInteger(x);
  const prim = x => x === null || typeof x !== "object" || (isObj(x) && ("$u" in x || "$n" in x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* Short text for any encoded value; q = quote strings. */
  function fmt(x, q = true, depth = 0) {
    if (x === null) return "null";
    if (typeof x === "string") return q ? JSON.stringify(x) : x;
    if (typeof x !== "object") return String(x);
    if (depth > 2) return "…";
    const list = (a, n) => a.map(v => fmt(v, q, depth + 1)).join(", ") + (n > a.length ? `, … ${n - a.length} more` : "");
    if (Array.isArray(x)) return `[${list(x, x.length)}]`;
    if ("$u" in x) return "undefined";
    if ("$n" in x) return x.$n;
    if ("$cut" in x) return typeof x.$cut === "string" ? (q ? JSON.stringify(x.$cut + "…") : x.$cut + "…") + ` (${x.n} letters)` : `[${list(x.$cut, x.n)}]`;
    if ("$map" in x) return `{${x.$map.map(([k, v]) => fmt(k, q, depth + 1) + ": " + fmt(v, q, depth + 1)).join(", ")}${x.n ? ", …" : ""}}`;
    if ("$set" in x) return `{${list(x.$set, x.n || x.$set.length)}}`;
    if ("$list" in x) return x.$list.map(v => fmt(v, q, depth + 1)).join(" → ") + (x.more ? " → …" : "");
    if ("$tree" in x) return `tree [${x.$tree.map(v => fmt(v, q, depth + 1)).join(", ")}]`;
    if ("$ref" in x) return `node ${x.at} of ${x.$ref}`;
    if ("$obj" in x) return `{${Object.entries(x.$obj).map(([k, v]) => k + ": " + fmt(v, q, depth + 1)).join(", ")}}`;
    if ("$fn" in x) return x.$fn + "()";
    if ("$it" in x) return `(${x.$it})`;
    return "…";
  }
  /* Encoded value → plain JSON (for "matches Example 1"); undefined when it can't be compared. */
  function plain(x) {
    if (x === null || typeof x !== "object") return x;
    if (Array.isArray(x)) { const a = x.map(plain); return a.includes(undefined) ? undefined : a; }
    if ("$list" in x) return x.more || x.cycle !== undefined ? undefined : x.$list;
    if ("$tree" in x) return x.$tree;
    if ("$u" in x) return null;
    return undefined;
  }

  /* level-order index → heap key (pics.tree keys binary nodes by heap position) */
  function heapKeys(arr) {
    const keys = [];
    if (!arr.length || arr[0] === null) return keys;
    keys[0] = 0;
    const q = [0];
    let qi = 0, i = 1;
    while (qi < q.length && i < arr.length) {
      const k = q[qi++];
      for (const c of [2 * k + 1, 2 * k + 2]) { if (i < arr.length) { if (arr[i] !== null) { keys[i] = c; q.push(c); } i++; } }
    }
    return keys;
  }

  const cellsOf = x => typeof x === "string" ? [...x] : Array.isArray(x) ? x : isObj(x) && "$cut" in x ? (typeof x.$cut === "string" ? [...x.$cut] : x.$cut) : null;
  const isRow = x => {
    const c = cellsOf(x);
    if (!c) return false;
    if (typeof x === "string" || (isObj(x) && typeof x.$cut === "string")) return c.length >= 2;
    return c.every(prim);
  };
  const isGrid = x => Array.isArray(x) && x.length > 0 && x.every(r => Array.isArray(r) && r.every(prim));

  /* one variable → { html, scalar? } */
  function render(name, x, ctx) {
    const changed = ctx.ch.has(name);
    const prev = ctx.prev ? ctx.prevVal(name) : undefined;
    const sect = (body, extra = "") => `<section class="tv-var" data-var="${esc(name)}"${changed ? ' data-ch="1"' : ""}><div class="tv-name">${esc(ctx.label(name))}${extra}</div>${body}</section>`;
    if (x && isObj(x) && "$obj" in x) {
      return { html: Object.entries(x.$obj).map(([k, v]) => render(name + "." + k, v, ctx)).map(r => r.html || scalarHtml(r)).join("") };
    }
    if (isGrid(x)) {
      const cls = {};
      const pc = prev && isGrid(prev) ? prev : null;
      x.forEach((row, r) => row.forEach((v, c) => { if (pc && (!pc[r] || !same(pc[r][c], v))) cls[r + "," + c] = "enter"; }));
      for (const [a, b] of PAIRS) {
        const ra = ctx.vars[a], cb = ctx.vars[b];
        if (isInt(ra) && isInt(cb) && ra >= 0 && ra < x.length && cb >= 0 && cb < x[ra].length) cls[ra + "," + cb] = "accent";
      }
      return { html: sect(pics.grid(x.map(r => r.map(v => typeof v === "string" ? v : fmt(v))), { cls })) };
    }
    if (isRow(x) && (typeof x !== "string" || x.length <= 24 || ctx.ptrsFor(x, name).size)) {
      const cells = cellsOf(x).map(v => typeof v === "string" && cellsOf(x) !== x ? v : prim(v) ? (typeof v === "string" ? v : fmt(v)) : fmt(v));
      const ptrs = {}, cls = {};
      for (const [pn, pv] of ctx.ptrsFor(x, name)) ptrs[pv] = ptrs[pv] ? ptrs[pv] + " " + pn : pn;
      const pc = cellsOf(prev);
      if (pc) cells.forEach((v, i) => { if (i >= pc.length || !same(pc[i], cellsOf(x)[i])) cls[i] = "enter"; });
      const more = isObj(x) && "$cut" in x ? ` <span class="tv-more">… ${x.n - cells.length} more</span>` : "";
      return { html: sect(cells.length ? pics.row1d(cells, { ptrs, cls }) : `<span class="tv-empty">empty</span>`, more) };
    }
    if (Array.isArray(x) && x.length === 0) return { scalar: [name, "[]", changed] };
    if (isObj(x) && "$map" in x) {
      const rows = x.$map.map(([k, v]) => `<tr><td>${esc(fmt(k, false))}</td><td>${esc(fmt(v, false))}</td></tr>`).join("");
      return { html: sect(x.$map.length ? `<table class="tv-map"><tbody>${rows}</tbody></table>${x.n ? `<span class="tv-more">… ${x.n - x.$map.length} more</span>` : ""}` : `<span class="tv-empty">empty</span>`) };
    }
    if (isObj(x) && "$set" in x) {
      return { html: sect(x.$set.length ? pics.row1d(x.$set.map(v => typeof v === "string" ? v : fmt(v)), { labels: false }) : `<span class="tv-empty">empty</span>`) };
    }
    if (isObj(x) && "$list" in x) {
      const ptrs = {};
      for (const [pn, at] of ctx.refs(x.id)) ptrs[at] = ptrs[at] ? ptrs[at] + " " + pn : pn;
      return { html: sect(x.$list.length ? pics.list(x.$list.map(v => fmt(v, false)), { ptrs, cycle: x.cycle == null ? null : x.cycle }) : `<span class="tv-empty">empty</span>`) };
    }
    if (isObj(x) && "$tree" in x) {
      const keys = heapKeys(x.$tree), ptrs = {};
      for (const [pn, at] of ctx.refs(x.id)) if (keys[at] != null) ptrs[keys[at]] = ptrs[keys[at]] ? ptrs[keys[at]] + " " + pn : pn;
      const loop = x.cycle ? `<p class="tv-more">Some links point back up the tree (linked back for the walk); they are not drawn.</p>` : "";
      // a tree deeper than 10 levels can't be drawn readably (and would take long to lay out): list it instead
      if (Math.max(0, ...keys.filter(k => k != null)) > 2046) return { html: sect(`<code>${esc(fmt(x))}</code>${loop}`) };
      return { html: sect(pics.tree(x.$tree.map(v => v === null ? null : fmt(v, false)), { ptrs }) + loop) };
    }
    if (isObj(x) && "$ref" in x) return ctx.shown.has(x.$ref) ? { skip: true } : { scalar: [name, fmt(x), changed] };
    return { scalar: [name, fmt(x), changed] };
  }
  const scalarHtml = r => r.scalar ? `<span class="tv-sc" data-var="${esc(r.scalar[0])}"${r.scalar[2] ? ' data-ch="1"' : ""}>${esc(r.label || r.scalar[0])} = ${esc(r.scalar[1])}</span>` : "";

  /* which names the code indexes with each pointer: `w[i]`, `first[i + 1]`, `first[:i]` → { i: Set(["w", "first"]) } */
  const indexedCache = new Map();
  function indexedBy(src) {
    if (!src) return null;
    if (indexedCache.has(src)) return indexedCache.get(src);
    const m = {};
    for (const p of IDX) {
      const re = new RegExp(`([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)\\s*\\[\\s*:?\\s*${p}\\b`, "g");
      for (const x of src.matchAll(re)) (m[p] = m[p] || new Set()).add(x[1].replace(/^(this|self)\./, "self."));
    }
    indexedCache.set(src, m);
    return m;
  }

  function state(step, { calls = null, prev = null, lang = "ts", code: src = null } = {}) {
    const selfName = lang === "py" ? "self" : "this";
    const vars = {};
    if (step.self) for (const [k, v] of Object.entries(step.self)) vars["self." + k] = v;
    Object.assign(vars, step.v || {});
    // a node held inside an array/map/object (a BFS queue, a stack of nodes) shows the node's value; only a variable
    // that IS a node pointer stays a pointer (drawn on its structure)
    const structs = {};
    for (const v of Object.values(vars)) if (isObj(v) && v.id) structs[v.id] = v.$list || v.$tree || [];
    const deref = (x, top) => {
      if (!x || typeof x !== "object") return x;
      if (Array.isArray(x)) return x.map(y => deref(y, false));
      if ("$ref" in x) return top || !structs[x.$ref] ? x : structs[x.$ref][x.at];
      if ("$cut" in x && Array.isArray(x.$cut)) return { ...x, $cut: x.$cut.map(y => deref(y, false)) };
      if ("$map" in x) return { ...x, $map: x.$map.map(([k, v]) => [deref(k, false), deref(v, false)]) };
      if ("$set" in x) return { ...x, $set: x.$set.map(y => deref(y, false)) };
      if ("$obj" in x) return { $obj: Object.fromEntries(Object.entries(x.$obj).map(([k, v]) => [k, deref(v, true)])) };
      return x;
    };
    for (const n of Object.keys(vars)) vars[n] = deref(vars[n], true);
    const prevVars = {};
    if (prev) { if (prev.self) for (const [k, v] of Object.entries(prev.self)) prevVars["self." + k] = v; Object.assign(prevVars, prev.v || {}); }
    for (const n of Object.keys(prevVars)) prevVars[n] = deref(prevVars[n], true);
    const ints = Object.entries(vars).filter(([n, v]) => IDX.has(n) && isInt(v));
    const ctx = {
      vars, prev, ch: new Set(step.ch || []),
      label: n => n.startsWith("self.") ? selfName + n.slice(4) : n,
      prevVal: n => { const parts = n.split("."); let x = prevVars[parts[0] === "self" ? parts[0] + "." + parts[1] : parts[0]]; for (const p of parts.slice(parts[0] === "self" ? 2 : 1)) x = x && x.$obj ? x.$obj[p] : undefined; return x; },
      // a pointer goes under the rows the code indexes with it; one the code never uses as an index goes under every row it fits
      ptrsFor: (x, name) => { const n = (cellsOf(x) || []).length, m = new Map(), ix = indexedBy(src); for (const [pn, pv] of ints) { if (pv < 0 || pv >= n) continue; if (name && ix && ix[pn] && ix[pn].size && !ix[pn].has(name)) continue; m.set(pn, pv); } return m; },
      refs: id => Object.entries(vars).filter(([, v]) => isObj(v) && v.$ref === id).map(([n, v]) => [n, v.at]),
      shown: new Set(Object.values(vars).filter(v => isObj(v) && v.id).map(v => v.id))
    };
    const blocks = [], scalars = [];
    for (const [n, x] of Object.entries(vars)) {
      const r = render(n, x, ctx);
      if (r.skip) continue;
      if (r.html) blocks.push(r.html);
      if (r.scalar) scalars.push(scalarHtml({ ...r, label: ctx.label(n) }));
    }
    const head = [];
    if (step.c !== undefined && calls && calls[step.c]) {
      const c = calls[step.c];
      head.push(`<div class="tv-call"><span class="label">now calling</span> <code>${esc(c.op)}(${esc((c.args || []).map(a => fmt(a)).join(", "))})</code></div>`);
    }
    if (step.stack && step.stack.length) {
      const chip = f => { const a = Object.entries(f.args || {}).map(([k, v]) => `${k} = ${fmt(v)}`).join(", "); return `${f.fn}(${a.length > 48 ? a.slice(0, 47) + "…" : a})`; };
      head.push(`<div class="tv-stack"><span class="label">inside</span>${step.stack.map(f => `<span class="tv-frame">${esc(chip(f))}</span>`).join("")}<span class="tv-frame tv-top">${esc(step.fn)}</span></div>`);
    }
    return `<div class="tv-state">${head.join("")}${blocks.join("")}${scalars.length ? `<div class="tv-scs">${scalars.join("")}</div>` : ""}${!blocks.length && !scalars.length ? `<p class="tv-empty">No variables yet.</p>` : ""}</div>`;
  }

  function code(src, lit) {
    return `<pre class="tv-code"><code>${String(src).split("\n").map((line, i) => `<span class="tv-ln${i + 1 === lit ? " tv-lit" : ""}" data-l="${i + 1}"${i + 1 === lit ? ' aria-current="step"' : ""}>${esc(line) || " "}</span>`).join("")}</code></pre>`;
  }
  const note = (notes, lang, line) => { const n = notes && notes[lang] && notes[lang][line]; return n ? `<div class="tv-note"><span class="label">What this line does</span><p>${n}</p></div>` : ""; };
  /* Every recorded run already passed the problem's own comparison (scripts/algo/trace.mjs), so the box never calls it
     wrong: an exact match says so; otherwise it is accepted the way the problem compares (mode = P.compare). */
  function result(step, expected, mode = null) {
    if (!step || step.r === undefined) return "";
    const got = plain(step.r);
    const what = isObj(step.r) && "$u" in step.r ? "returns nothing" : `returns ${esc(fmt(step.r))}`;
    if (got === undefined || same(got, expected) || (got === null && expected === null)) return `<div class="tv-result ok"><b>${what}</b> · matches Example 1</div>`;
    const why = mode === "unordered" || mode === "unordered-deep" ? "any order" : mode === "float" ? "rounded" : mode && mode.check ? "any valid answer" : "same answer";
    return `<div class="tv-result ok"><b>${what}</b> · accepted (${why}): Example 1 shows ${esc(fmt(expected))}</div>`;
  }
  const gapLine = gap => gap ? `<div class="tv-gap">… ${gap.skipped} steps skipped here: the run keeps going the same way …</div>` : "";

  /* Packed steps (scripts/algo/trace/steps.mjs pack) → full steps. */
  function unpack(packed) {
    let v = {}, self, stack = [];
    return packed.map(o => {
      v = { ...v, ...o.v };
      for (const n of o.x || []) delete v[n];
      if (o.stack) stack = o.stack;
      if ("self" in o) { self = { ...(self || {}), ...o.self }; for (const n of o.sx || []) delete self[n]; }
      else if (o.ns) self = undefined;
      const s = { l: o.l, d: o.d, fn: o.fn, v, stack, ch: o.ch || [] };
      if (self) s.self = self;
      if (o.c !== undefined) s.c = o.c;
      if (o.r !== undefined) s.r = o.r;
      return s;
    });
  }

  /* mount(el, { trace, si, lang, code: {ts, js, py}, step, onStep, codeEl }) → player in el (replaces its content);
     the lit code goes into codeEl when given (the solution's own dark code block), else above the controls.
     lang "ts" | "js" | "py"; the JS view plays the TypeScript trace on the mapped lines. */
  function mount(el, o) {
    const sol = o.trace.sols[o.si], tl = o.lang === "py" ? "py" : "ts", run = sol[tl];
    if (!run || run.skip || !run.steps) {
      el.innerHTML = `<p class="tv-skip">This run can't be shown step by step${run && run.skip ? ` (${esc(run.skip === "random" ? "it uses randomness" : "it is too long")})` : ""}.</p>`;
      return;
    }
    const steps = run.full || (run.full = unpack(run.steps)), N = steps.length, gap = run.gap;
    const toJs = {};
    for (const [j, t] of Object.entries(sol.jsMap || {})) if (toJs[t] == null) toJs[t] = +j;
    let k = Math.min(Math.max(0, o.step || 0), N - 1);
    const expectedOf = s => o.trace.calls ? (s.c !== undefined && o.trace.calls[s.c] ? o.trace.calls[s.c].expected : undefined) : o.trace.expected;
    el.innerHTML = `<div class="tv" tabindex="-1">
      ${o.codeEl ? "" : `<div class="tv-codebox"></div>`}
      <div class="tv-bar">
        <button class="btn sm" data-tv="restart" type="button">Restart</button>
        <button class="btn sm" data-tv="prev" type="button" aria-label="Previous step">◀</button>
        <button class="btn sm" data-tv="next" type="button" aria-label="Next step">▶</button>
        <input type="range" min="1" max="${N}" value="${k + 1}" aria-label="Step" data-tv="slider">
        <span class="tv-count" aria-live="polite"></span>
      </div>
      <div class="tv-gapbox"></div><div class="tv-notebox"></div><div class="tv-statebox"></div><div class="tv-resbox"></div>
    </div>`;
    const $ = s => el.querySelector(s), box = $(".tv");
    function draw() {
      const s = steps[k], line = o.lang === "js" ? toJs[s.l] : s.l;
      const cb = o.codeEl || $(".tv-codebox");
      cb.innerHTML = code(o.code[o.lang], line);
      const litEl = cb.querySelector(".tv-lit"), pre = cb.querySelector(".tv-code");
      if (litEl && pre) pre.scrollTop = Math.max(0, litEl.offsetTop - pre.clientHeight / 2);
      $(".tv-count").textContent = `Step ${k + 1} / ${N}${gap && k >= gap.after ? ` (after ${gap.skipped} skipped)` : ""}`;
      $("[data-tv=slider]").value = String(k + 1);
      $(".tv-gapbox").innerHTML = gap && (k === gap.after || k === gap.after - 1) ? gapLine(gap) : "";
      $(".tv-notebox").innerHTML = note(sol.notes, tl, s.l);
      $(".tv-statebox").innerHTML = state(s, { calls: o.trace.calls, prev: k ? steps[k - 1] : null, lang: tl, code: o.code[o.lang] });
      const isEnd = k === N - 1 || (s.r !== undefined && s.d === 0);
      $(".tv-resbox").innerHTML = isEnd ? result(s, expectedOf(s), o.trace.compare || null) : "";
      $("[data-tv=prev]").disabled = k === 0;
      $("[data-tv=next]").disabled = k === N - 1;
      if (o.onStep) o.onStep(k);
    }
    const go = n => { k = Math.min(Math.max(0, n), N - 1); draw(); };
    el.querySelector("[data-tv=restart]").addEventListener("click", () => go(0));
    el.querySelector("[data-tv=prev]").addEventListener("click", () => go(k - 1));
    el.querySelector("[data-tv=next]").addEventListener("click", () => go(k + 1));
    el.querySelector("[data-tv=slider]").addEventListener("input", e => go(+e.target.value - 1));
    box.addEventListener("keydown", e => {
      if (e.target.matches && e.target.matches("input[type=range]")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(k + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(k - 1); }
    });
    draw();
  }

  if (typeof document !== "undefined" && document.head && !document.getElementById("tv-css")) {
    const s = document.createElement("style");
    s.id = "tv-css";
    s.textContent = `
.tv { margin-top: 10px; outline: none; }
.tv-code { margin: 0; padding: 10px 0 14px; max-height: 340px; overflow: auto; font-family: var(--mono); font-size: 13.5px; line-height: 1.65; font-variant-ligatures: none; background: var(--code-bg); color: var(--code-ink); border-radius: var(--R); }
.code .tv-code { border-radius: 0; padding-top: 4px; }
.tv-code code { background: none; padding: 0; font-size: inherit; color: inherit; display: block; }
.tv-ln { display: block; padding: 0 20px 0 calc(20px + 2ch); text-indent: -2ch; white-space: pre-wrap; overflow-wrap: anywhere; border-left: 4px solid transparent; }
.tv-ln.tv-lit { background: rgba(255,255,255,.12); border-left-color: var(--code-ink); font-weight: 700; }
.tv-bar { display: flex; align-items: center; gap: 8px; margin: 12px 0 4px; flex-wrap: wrap; }
.tv-bar .btn.sm { min-height: 44px; min-width: 44px; }
.tv-bar input[type=range] { flex: 1 1 140px; min-width: 120px; height: 44px; accent-color: var(--ink); }
.tv-count { font-family: var(--mono); font-size: 13px; color: var(--muted); white-space: nowrap; }
.tv-note { margin: 10px 0; padding: 12px 16px; border-radius: var(--r); background: var(--surface); border-left: 4px solid var(--ink); }
.tv-note .label { display: block; margin-bottom: 2px; font-size: 13px; }
.tv-note p { margin: 0; font-size: 16px; line-height: 1.55; color: var(--ink); }
.tv-state { display: grid; gap: 14px; margin-top: 12px; min-width: 0; }
.tv-var { min-width: 0; overflow-x: auto; }
.tv-name { font-family: var(--mono); font-size: 13.5px; font-weight: 700; margin-bottom: 4px; color: var(--ink-2); }
.tv-var[data-ch] > .tv-name::after, .tv-sc[data-ch]::after { content: "changed"; margin-left: 8px; font-family: var(--sans, inherit); font-size: 11.5px; font-weight: 700; letter-spacing: .02em; padding: 1px 7px; border-radius: 99px; background: var(--good-soft); color: var(--good); }
.tv-scs { display: flex; flex-wrap: wrap; gap: 8px 18px; font-family: var(--mono); font-size: 14px; }
.tv-sc { overflow-wrap: anywhere; min-width: 0; }
.tv-map { border-collapse: collapse; font-family: var(--mono); font-size: 13.5px; }
.tv-map td { border: 1px solid var(--line); padding: 4px 10px; }
.tv-map td:first-child { font-weight: 700; }
.tv-call, .tv-stack { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 14px; }
.tv-frame { font-family: var(--mono); font-size: 12.5px; padding: 3px 8px; border: 1px solid var(--line); border-radius: 8px; }
.tv-frame.tv-top { border-color: var(--ink); font-weight: 700; }
.tv-more, .tv-empty { font-size: 13px; color: var(--muted); }
.tv-result { margin-top: 14px; padding: 10px 14px; border-radius: var(--r); background: var(--surface); font-size: 15.5px; }
.tv-result.ok { background: var(--good-soft); }
.tv-gap { margin: 8px 0; font-size: 14px; color: var(--muted); font-style: italic; }
.tv-skip { color: var(--muted); }
.tv-watch { margin-top: 10px; }
`;
    document.head.appendChild(s);
  }

  window.TraceView = { code, state, note, result, gapLine, mount, fmt, unpack };
})();
