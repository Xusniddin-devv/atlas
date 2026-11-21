/* Lesson: broadcasting and shape errors (AI path, unit "NumPy and pandas").
   Story: a camping-gear shop sells in three markets and keeps one price table, one row per product and one column
   per market, each column in that market's currency. Finance converts the whole table to US dollars with one row of
   exchange rates (made-up round numbers, not real rates), then applies one end-of-season discount per product.
   Ideas: (1) NumPy lines shapes up from the right and stretches size-1 or missing dimensions without copying;
   (2) a shape error names the two shapes, and the fix is to give the small array the axis you mean (np.newaxis);
   when shapes happen to match, the same mistake runs silently along the wrong axis.
   Depth: explain (screens 1-4, 8, interview), debug (screens 5 and 7), when-not (screens 8 and 9).
   Every output, shape and error message on screen comes from real runs on this Mac (Python 3.12.11, NumPy 2.5.4),
   kept in docs/ai-path/runs/s1-numpy-broadcasting/: data.py (inputs), convert.py, shapes.py, broken.py, fixes.py,
   fixed.py, trace.py, silent.py, memory.py, ragged.py, each with its .out.txt. No model calls were recorded.
   Everything else is computed here from that data. Plain browser script. */
(() => {
  const ID = "s1-numpy-broadcasting", P = "lx-" + ID + "-";

  /* ---------- Data: inputs from data.py, outputs copied from the runs ---------- */
  const PRODUCTS = ["backpack", "tent", "stove", "lamp"];
  const CUR = ["EUR", "GBP", "JPY"];
  const PRICES = [[80, 70, 13000], [200, 175, 32000], [45, 40, 7000], [20, 18, 3000]];
  const RATES = [1.1, 1.3, 0.007];            // example rates: US dollars per unit, not real rates
  const DISCOUNT = [0.1, 0, 0.25, 0.5];       // one per product
  // convert.out.txt: (prices * rates).round(2), and the view numpy.broadcast_to makes of rates
  const IN_USD = [[88, 91, 91], [220, 227.5, 224], [49.5, 52, 49], [22, 23.4, 21]];
  const VIEW = { shape: [4, 3], strides: [0, 8], shares: true };
  // trace.out.txt: a traced run of price_report (vars: shape and value rounded to 2 places)
  const CODE = [
    "def price_report(prices, rates, discount):",
    "    in_usd = prices * rates",
    "    per_row = discount[:, np.newaxis]",
    "    sale = in_usd * (1 - per_row)",
    "    return sale.round(2)"
  ];
  const TRACE = [
    { line: 1, event: "line", vars: {} },
    { line: 2, event: "line", vars: { in_usd: [4, 3] } },
    { line: 3, event: "line", vars: { in_usd: [4, 3], per_row: [4, 1] } },
    { line: 4, event: "line", vars: { in_usd: [4, 3], per_row: [4, 1], sale: [4, 3] } },
    { line: 4, event: "return", vars: { in_usd: [4, 3], per_row: [4, 1], sale: [4, 3] } }
  ];
  const SALE = [[79.2, 81.9, 81.9], [220, 227.5, 224], [37.13, 39, 36.75], [11, 11.7, 10.5]];
  // shapes.out.txt: arrays of ones with these shapes, multiplied for real; out = result shape, else the error text
  const RUN_RULE = [
    { a: [4, 3], b: [3], out: [4, 3] },
    { a: [4, 3], b: [4], error: "operands could not be broadcast together with shapes (4,3) (4,) " }
  ];
  const RUN_SIX = [
    { a: [2, 5], b: [5], out: [2, 5] },
    { a: [6, 2], b: [6], error: "operands could not be broadcast together with shapes (6,2) (6,) " },
    { a: [6, 2], b: [6, 1], out: [6, 2] },
    { a: [5, 1], b: [1, 3], out: [5, 3] },
    { a: [8, 4, 3], b: [4, 3], out: [8, 4, 3] },
    { a: [4, 3], b: [3, 1], error: "operands could not be broadcast together with shapes (4,3) (3,1) " }
  ];
  const RUN_BIG = [{ a: [1000, 3], b: [3], out: [1000, 3] }, { a: [3, 3], b: [3], out: [3, 3] }];
  const RUN_REC = [
    { a: [32, 10], b: [10], out: [32, 10] },
    { a: [100, 28, 28], b: [28, 28], out: [100, 28, 28] },
    { a: [365, 24], b: [365], error: "operands could not be broadcast together with shapes (365,24) (365,) " },
    { a: [365, 24], b: [365, 1], out: [365, 24] }
  ];
  // broken.out.txt (the path before broken.py trimmed with …, nothing else changed)
  const TRACEBACK = [
    "Traceback (most recent call last):",
    '  File "…/broken.py", line 7, in <module>',
    "    sale = in_usd * (1 - discount)",
    "           ~~~~~~~^~~~~~~~~~~~~~~~",
    "ValueError: operands could not be broadcast together with shapes (4,3) (4,) "
  ];
  // fixes.out.txt: the three candidate fixes, run for real
  const FIXES = [
    { code: "in_usd * (1 - discount[:, np.newaxis])", out: [4, 3] },
    { code: "in_usd * (1 - discount.reshape(1, 4))", error: "operands could not be broadcast together with shapes (4,3) (1,4) " },
    { code: "in_usd.T * (1 - discount)", out: [3, 4] }
  ];
  // silent.out.txt: the first 3 products only, so the table is (3, 3) and the discount (3,)
  const SILENT_IN = IN_USD.slice(0, 3);
  const SILENT_WRONG = [[79.2, 91, 68.25], [198, 227.5, 168], [44.55, 52, 36.75]];
  const SILENT_RIGHT = SALE.slice(0, 3);
  // memory.out.txt: np.broadcast_shapes((50000, 1), (1, 50000)), its cells and float64 size (computed, never built)
  const MEM = { n: 50000, shape: [50000, 50000], cells: 2500000000, gb: 20.0 };
  // ragged.out.txt: three branch lists of lengths 2, 3 and 1 passed to np.array
  const RAGGED_ERR = "setting an array element with a sequence. The requested array has an inhomogeneous shape after 1 dimensions. The detected shape was (3,) + inhomogeneous part.";

  /* ---------- Helpers ---------- */
  const fmt = n => n.toLocaleString("en");
  const sh = s => `(${s.join(", ")}${s.length === 1 ? "," : ""})`;   // Python's way of writing a shape
  const pct = d => `${Math.round(d * 100)} %`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  // The rule, used only to explain each pair in words; whether a pair works is always taken from the run.
  function rule(a, b) {
    const n = Math.max(a.length, b.length), steps = [], out = [];
    for (let k = 1; k <= n; k++) {
      const x = a.length - k >= 0 ? a[a.length - k] : null, y = b.length - k >= 0 ? b[b.length - k] : null;
      const xv = x == null ? 1 : x, yv = y == null ? 1 : y;
      const kind = xv === yv ? "equal" : (xv === 1 || yv === 1) ? "stretch" : "clash";
      steps.push({ x, y, kind, size: Math.max(xv, yv) });
      if (kind === "clash") return { steps, ok: false };
      out.unshift(Math.max(xv, yv));
    }
    return { steps, ok: true, out };
  }
  const side = v => v == null ? "nothing" : String(v);
  const stepTxt = s => s.kind === "equal" ? `${s.x} and ${s.y} are equal, keep ${s.size}`
    : s.kind === "stretch" ? `${side(s.x)} and ${side(s.y)}: ${s.x == null || s.y == null ? "a missing one counts as 1" : "one is 1"}, so it stretches to ${s.size}`
    : `${s.x} and ${s.y} clash: different, and neither is 1`;
  const explain = (a, b) => rule(a, b).steps.map(stepTxt).join("; then ");

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}tw { margin: 14px 0 0; max-width: 100%; }
.${P}cap { font: 600 13px var(--mono); color: var(--muted); margin: 0 0 6px; }
.${P}t { border-collapse: separate; border-spacing: 4px; margin-left: -4px; }
.${P}t th { font: 600 13px var(--font); color: var(--muted); padding: 0 4px; text-align: right; white-space: nowrap; }
.${P}t thead th { text-align: right; padding-right: 10px; }
.${P}c { display: flex; align-items: center; justify-content: flex-end; min-width: 58px; min-height: 40px; padding: 0 9px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: 600 15px var(--mono); box-sizing: border-box; width: 100%; }
button.${P}c { min-height: 44px; cursor: pointer; }
button.${P}c:hover { border-color: var(--ink); }
.${P}c.hot { outline: 3px solid var(--ink); outline-offset: 1px; }
.${P}c.ok { background: var(--good-soft); border-color: var(--good); }
.${P}c.no { background: var(--bad-soft); border-color: var(--bad); }
.${P}c.rep { border-style: dashed; color: var(--muted); background: var(--bg); }
.${P}c.miss { border-style: dashed; color: var(--faint); background: var(--bg); justify-content: center; }
.${P}c.gone { color: var(--faint); }
.${P}c.empty { color: var(--faint); justify-content: center; }
.${P}shape { font: 700 15px var(--mono); }
.${P}tb div { white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}t th[scope="row"] { min-width: 5.2em; }
`;
    document.head.appendChild(s);
  }

  // A small table of cells. rows: arrays of text; cls: {"r,c": state}; pick: (r, c) => bool makes cells buttons with data-i="r,c".
  function tbl(rows, { rowHead = null, colHead = null, cls = {}, pick = null, title = "" } = {}, kit) {
    const head = colHead ? `<thead><tr>${rowHead ? "<th></th>" : ""}${colHead.map(h => `<th scope="col">${kit.esc(h)}</th>`).join("")}</tr></thead>` : "";
    const body = rows.map((row, r) => `<tr>${rowHead ? `<th scope="row">${kit.esc(rowHead[r])}</th>` : ""}${row.map((v, c) => {
      const k = `${r},${c}`, p = pick && pick(r, c), st = cls[k] || "";
      return `<td>${p ? `<button type="button" class="${P}c ${st}" data-i="${k}" aria-label="${kit.esc((rowHead ? rowHead[r] + ", " : "") + (colHead ? colHead[c] + ": " : "") + v)}">${kit.esc(v)}</button>` : `<div class="${P}c ${st}">${kit.esc(v)}</div>`}</td>`;
    }).join("")}</tr>`).join("");
    return `<div class="${P}tw">${title ? `<p class="${P}cap">${kit.esc(title)}</p>` : ""}<table class="${P}t">${head}<tbody>${body}</tbody></table></div>`;
  }
  // Two shapes written right-aligned, one column per dimension, the current one ringed.
  function dims(a, b, names, { at = -1, verdicts = [] } = {}, kit) {
    const n = Math.max(a.length, b.length);
    const pad = s => Array.from({ length: n }, (_, i) => { const j = i - (n - s.length); return j >= 0 ? String(s[j]) : "missing"; });
    const rows = [pad(a), pad(b)], cls = {};
    rows.forEach((row, r) => row.forEach((v, c) => { if (v === "missing") cls[`${r},${c}`] = "miss"; }));
    const res = Array.from({ length: n }, (_, i) => { const k = n - 1 - i, v = verdicts[k]; return v == null ? "" : v; });
    res.forEach((v, c) => { cls[`2,${c}`] = v === "error" ? "no" : v === "" ? "empty" : "ok"; });
    if (at >= 0) for (let r = 0; r < 2; r++) cls[`${r},${n - 1 - at}`] = (cls[`${r},${n - 1 - at}`] || "") + " hot";
    return tbl([...rows, res.map(v => v === "" ? "?" : v)], { rowHead: [...names, "result"], cls, title: "shapes lined up on the right" }, kit);
  }

  /* 1. The situation, by hand: which rate does each cell need? */
  const ROUNDS = [[0, 0], [2, 2], [3, 0], [1, 1]];
  function byHand({ el, done, kit }) {
    style();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === ROUNDS.length;
      const cls = {}, usd = IN_USD.map(row => row.map(() => "")), ucls = {};
      ROUNDS.slice(0, k).forEach(([r, c]) => { usd[r][c] = String(IN_USD[r][c]); ucls[`${r},${c}`] = "ok"; });
      let task = "", opts = "";
      if (!fin) {
        const [r, c] = ROUNDS[k];
        cls[`${r},${c}`] = "hot";
        task = `<p class="task">The ringed cell is the ${PRODUCTS[r]}'s price in ${CUR[c]}. Which rate converts it to US dollars?</p>`;
        opts = kit.options(CUR.map((cu, j) => `${cu} rate: × ${RATES[j]}`), { picked: wrong, correct: c });
      }
      const last = k ? ROUNDS[k - 1] : null;
      el.innerHTML = `<h1>One row of rates, a whole table of prices</h1>
        <p class="lead">AI code often combines a big array with a small one, such as a table of data and one average per column. This lesson shows how NumPy does that, and how to read the error when the shapes do not fit. We start by hand.</p>
        <p class="lead">A camping-gear shop sells in three markets. Its price list has one row per product and one column per market. Each column is in that market's own currency. Finance wants every price in US dollars for one report. They have one row of exchange rates: dollars per unit of each currency (round example numbers, not real rates).</p>
        ${task}
        ${tbl(PRICES.map(r => r.map(String)), { rowHead: PRODUCTS, colHead: CUR, cls, title: "prices" }, kit)}
        ${tbl([RATES.map(String)], { rowHead: ["rates"], colHead: CUR, title: "rates (US dollars per unit)" }, kit)}
        <div class="lpanel">${opts}
        ${wrong != null ? (() => { const [r, c] = ROUNDS[k]; return kit.feedback(`That is the ${CUR[wrong]} rate. This price sits in the ${CUR[c]} column, so it is ${PRICES[r][c]} ${CUR[c]}. Multiplying it by the ${CUR[wrong]} rate would treat it as ${CUR[wrong]}. The column decides the currency, so the column decides the rate.`, false); })()
          : fin ? kit.feedback(`Done. In all ${WORDS[ROUNDS.length].toLowerCase()} cells the rate came from the <b>column</b>, never from the product. The whole table needs ${PRICES.length} × ${CUR.length} = ${PRICES.length * CUR.length} multiplications, but only ${CUR.length} rates: the same row of rates is used again for every product.`, true)
          : last ? kit.feedback(`${PRICES[last[0]][last[1]]} ${CUR[last[1]]} × ${RATES[last[1]]} = <b>${IN_USD[last[0]][last[1]]}</b> US dollars.`) : ""}
        ${tbl(usd, { rowHead: PRODUCTS, colHead: CUR.map(c => c + "→USD"), cls: ucls, title: "in US dollars, so far" }, kit)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== ROUNDS[k][1]) { wrong = i; paint(); return; }
        wrong = null; k++; paint();
        if (k === ROUNDS.length) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: what NumPy does with (4, 3) * (3,). */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const A = [PRICES.length, CUR.length], B = [CUR.length];
    const opts = [
      `It raises an error: the shapes differ, so you must copy the rates into a ${sh(A)} table first.`,
      `It uses the row of ${B[0]} rates again for each of the ${A[0]} products, as you did, and gives a ${sh(A)} table.`,
      `It gives the first rate to the whole first row, the second rate to the second row, and so on.`
    ];
    const paint = () => {
      const ok = ans === 1;
      const rep = RATES.map(String), cls = {};
      for (let r = 1; r < A[0]; r++) for (let c = 0; c < B[0]; c++) cls[`${r},${c}`] = "rep";
      el.innerHTML = `<h1>What does NumPy do with the rates?</h1>
        <p class="lead">In NumPy the table is <code>prices</code>, shape <b>${sh(A)}</b>: ${A[0]} rows, ${A[1]} columns. The rates are <code>rates</code>, shape <b>${sh(B)}</b>: one flat row of ${B[0]}. You write <code>prices * rates</code>.</p>
        <p class="task">What happens?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. This is called <b>broadcasting</b>: NumPy acts as if the row of rates were repeated down all ${A[0]} rows, and multiplies cell by cell. The loop runs inside NumPy's compiled code, not in Python. And the repeated rows are never stored. In our run we asked NumPy for that repeated ${sh(VIEW.shape)} table with <code>np.broadcast_to(rates, ${sh(VIEW.shape)})</code>. It ${VIEW.shares ? "shares memory with" : "did not share memory with"} <code>rates</code>: the same ${B[0]} numbers are read again for each row, never copied.`, true)
          : ans === 0 ? kit.feedback(`That is how you would do it in plain JavaScript: build a full ${sh(A)} copy, then multiply. NumPy does not need the copy. When the shapes fit its rule (next screen), it combines arrays of different shapes directly.`, false)
          : kit.feedback(`That pairs rates with products, but there are ${A[0]} products and only ${B[0]} rates, and the ${CUR[0]} rate would land on the ${PRODUCTS[0]}'s ${CUR[2]} price. NumPy lines shapes up from the right: the ${B[0]} rates line up with the ${A[1]} columns, so each rate stays with its currency.`, false)}
        ${ok ? tbl(Array.from({ length: A[0] }, () => rep), { rowHead: PRODUCTS.map((p, i) => i ? "repeated" : "rates"), colHead: CUR, cls, title: "what NumPy acts as if it had (dashed: never stored)" }, kit)
          + tbl(IN_USD.map(r => r.map(String)), { rowHead: PRODUCTS, colHead: CUR.map(c => c + "→USD"), title: `prices * rates, shape ${sh(A)} (from our run)` }, kit) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. The rule, one dimension at a time, on the story's two pairs. */
  const VERDICTS = ["Equal: keep that size", "One is 1 or missing: stretch it", "Clash: error"];
  const KIND_I = { equal: 0, stretch: 1, clash: 2 };
  function theRule({ el, done, kit }) {
    style();
    const pairs = [
      { a: RUN_RULE[0].a, b: RUN_RULE[0].b, names: ["prices", "rates"], run: RUN_RULE[0] },
      { a: RUN_RULE[1].a, b: RUN_RULE[1].b, names: ["in_usd", "discount"], run: RUN_RULE[1] }
    ];
    const plan = pairs.map(p => rule(p.a, p.b));
    let pi = 0, si = 0, wrong = null, said = null;
    const paint = () => {
      const p = pairs[pi], R = plan[pi], fin = pi === pairs.length;
      const cur = fin ? null : R.steps[si];
      el.innerHTML = `<h1>The rule: line the shapes up on the right</h1>
        <p class="lead">NumPy compares two shapes one dimension (one axis) at a time, starting from the <b>right</b>. A pair of sizes is fine when they are <b>equal</b>, or when <b>one of them is 1</b> (it stretches). A missing dimension counts as 1. The result takes the larger size. Any other pair is a clash: NumPy raises a <code>ValueError</code>.</p>
        ${fin ? "" : `<p class="lead">${pi === 0 ? `First pair: the prices and the rates.` : `Second pair. Finance now wants the end-of-season discount, one per product: <code>discount</code> has shape ${sh(p.b)}, one number for each of the ${p.b[0]} products. They write <code>in_usd * (1 - discount)</code>, where <code>in_usd</code> is the converted table, <code>prices * rates</code>.`}</p>
        <p class="task">Judge the ringed pair of sizes.</p>`}
        ${fin ? dims(pairs[1].a, pairs[1].b, pairs[1].names, { verdicts: ["error"] }, kit) : dims(p.a, p.b, p.names, { at: si, verdicts: R.steps.slice(0, si).map(s => String(s.size)) }, kit)}
        <div class="lpanel">${fin ? "" : kit.options(VERDICTS, { picked: wrong, correct: KIND_I[cur.kind] })}
        ${wrong != null ? kit.feedback(wrong === 2 ? `No clash here: ${side(cur.x)} and ${side(cur.y)} ${cur.kind === "equal" ? "are equal" : "include a 1 or a missing size, which stretches"}.`
            : wrong === 1 ? (cur.kind === "equal" ? `Nothing needs to stretch: both sizes are ${cur.x}.` : `Neither size is 1 and neither is missing: ${cur.x} and ${cur.y}. NumPy will not stretch ${cur.y} into ${cur.x}; only a size of 1 can stretch.`)
            : (cur.kind === "stretch" ? `They are not equal: one side has ${side(cur.x)}, the other ${side(cur.y)}. ${cur.x == null || cur.y == null ? "A missing size counts as 1" : "A size of 1"} stretches to ${cur.size}.` : `${cur.x} and ${cur.y} are not equal. Look again at the two ringed sizes.`), false)
          : said ? kit.feedback(said[0], said[1]) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== KIND_I[cur.kind]) { wrong = i; paint(); return; }
        wrong = null;
        if (cur.kind === "clash") {
          said = [`Right: ${cur.x} and ${cur.y} clash, so NumPy stops here. Our run raised exactly this:<br><code>ValueError: ${kit.esc(p.run.error)}</code><br>The rule paired the ${p.b[0]} discounts with the ${p.a[1]} market columns, not with the ${p.a[0]} products. It never looks at what you meant, only at the shapes. Screen 5 fixes it.`, true];
          pi++; si = 0; paint(); done(); return;
        }
        si++;
        if (si === R.steps.length) {
          said = [`Right. Both pairs are fine, so the result is <b>${sh(R.out)}</b>: the same as our run, which gave ${sh(p.run.out)}. Now the second pair.`, true];
          pi++; si = 0;
        } else said = [`Right: ${stepTxt(cur)}. Now the next size to the left.`, true];
        paint();
      });
    };
    paint();
  }

  /* 4. Six pairs by hand: broadcast or error, and which shape. */
  const SIX_OPTS = [["(2, 5)", "(5, 2)"], ["(6, 2)", "(6, 6)"], ["(6, 2)", "(6, 1)"], ["(5, 1)", "(5, 3)"], ["(8, 4, 3)", "(4, 3)"], ["(4, 3)", "(3, 3)"]].map(o => [...o, "error"]);
  const SIX_RIGHT = RUN_SIX.map((r, i) => SIX_OPTS[i].indexOf(r.error ? "error" : sh(r.out)));
  function sixPairs({ el, done, kit }) {
    style();
    const ans = RUN_SIX.map(() => null);
    const say = (i, pick) => {
      const r = RUN_SIX[i], why = explain(r.a, r.b), opt = SIX_OPTS[i][pick];
      if (pick === SIX_RIGHT[i]) return r.error ? `Error, as in our run: <code>${kit.esc(r.error)}</code>. From the right: ${why}.` : `Yes, ${sh(r.out)}. From the right: ${why}.`;
      if (opt === "error") return `It works. From the right: ${why}.${r.a.length !== r.b.length ? " A different number of dimensions is fine: the missing ones count as 1." : ""}`;
      if (r.error) return `This one fails. From the right: ${why}. Our run raised a ValueError.`;
      return `Each size in the result is the larger of its pair. From the right: ${why}. So the result is ${sh(r.out)}, not ${opt}.${r.a.includes(1) && r.b.includes(1) ? " Here both arrays stretch, each along its own size-1 dimension." : ""}`;
    };
    const paint = () => {
      el.innerHTML = `<h1>Six pairs, by hand</h1>
        <p class="lead">Each pair is two arrays combined with <code>*</code>. Line them up on the right and judge each size.</p>
        <p class="task">For each pair, pick the shape that comes out, or "error". Pick again if you change your mind.</p>
        ${RUN_SIX.map((r, i) => `<div class="lcase" id="c${i}"><p><span class="${P}shape">${sh(r.a)}</span> and <span class="${P}shape">${sh(r.b)}</span></p>${kit.options(SIX_OPTS[i], { picked: ans[i], correct: SIX_RIGHT[i] })}${ans[i] == null ? "" : kit.feedback(say(i, ans[i]), ans[i] === SIX_RIGHT[i])}</div>`).join("")}
        ${ans.every((a, i) => a === SIX_RIGHT[i]) ? kit.feedback(`All ${RUN_SIX.length} match the run: ${RUN_SIX.filter(r => !r.error).length} broadcast and ${RUN_SIX.filter(r => r.error).length} raise an error. Notice the last one: rates pasted as a column, shape ${sh(RUN_SIX[5].b)}, cannot multiply the ${sh(RUN_SIX[5].a)} table, because the 3 now lines up with the 4 products.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, j) => a === SIX_RIGHT[j])) done();
      }));
    };
    paint();
  }

  /* 5. Broken on purpose: the real traceback, find the cause, pick the fix. */
  function brokenError({ el, done, kit }) {
    style();
    let a0 = null, a1 = null;
    const q0 = ["<code>in_usd</code>", "<code>(1 - discount)</code>", "<code>rates</code>"];
    const q1 = FIXES.map(f => `<code>${kit.esc(f.code)}</code>`);
    const paint = () => {
      const ok0 = a0 === 1, ok1 = a1 === 0;
      el.innerHTML = `<h1>Broken on purpose: read the error</h1>
        <p class="lead">This is the real error from running the discount line on the table (<code>in_usd</code> is the converted table from before). Only the folder path is cut.</p>
        ${kit.code(TRACEBACK, TRACEBACK.length - 1).replace('class="lcode"', `class="lcode ${P}tb"`)}
        <p class="task">The message names two shapes, in the order of the two sides of the <code>*</code>. Which side has shape (4,)?</p>
        <div class="lpanel" id="q0">${kit.options(q0, { picked: a0, correct: 1 })}
        ${a0 == null ? "" : ok0 ? kit.feedback(`Right. The left side, <code>in_usd</code>, is the (4,3) table. The right side, <code>1 - discount</code>, keeps the discount's shape: (4,). Its 4 lines up with the 3 market columns and clashes.`, true)
          : a0 === 0 ? kit.feedback(`<code>in_usd</code> is the first shape in the message, (4,3): the table. It is fine. The (4,) is the second shape, so it belongs to the right side of the <code>*</code>.`, false)
          : kit.feedback(`<code>rates</code> is not on the failing line. It was used one line earlier, in <code>prices * rates</code>, and that worked. Read the line the error points at.`, false)}</div>
        ${ok0 ? `<p class="task">Which change fixes it? Each one was run for real.</p>
        <div class="lpanel" id="q1">${kit.options(q1, { picked: a1, correct: 0 })}
        ${a1 == null ? "" : ok1 ? kit.feedback(`Right. Inside the brackets, the colon keeps the existing axis (all 4 products). <code>np.newaxis</code> after it adds a second axis of size 1. So the discount becomes a column, shape (4, 1): one row per product. Now (4,3) and (4,1) line up, the 1 stretches across the 3 markets, and our run gave ${sh(FIXES[0].out)}.`, true)
          : a1 === 1 ? kit.feedback(`Our run: <code>ValueError: ${kit.esc(FIXES[1].error)}</code>. Shape (1, 4) still puts the 4 on the right, against the 3 columns. The products are the rows, so the discount must be a column: (4, 1).`, false)
          : kit.feedback(`It runs: our run gave ${sh(FIXES[2].out)}. But now rows are markets and columns are products, so the report is flipped, and every later line that expects one row per product reads it wrong. Fix the small array's shape; leave the table as it is.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q0 button").forEach(b => b.onclick = () => { a0 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q1 button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); if (a1 === 0 && a0 === 1) done(); });
    };
    paint();
  }

  /* 6. The fixed code as a recorded run, predicting each shape before the line runs. */
  const ASK = { 1: "in_usd", 2: "per_row", 3: "sale" };
  const ASK_OPTS = { in_usd: ["(3,)", "(4, 3)", "(4, 1)"], per_row: ["(4,)", "(4, 1)", "(1, 4)"], sale: ["(4, 1)", "(4, 3)", "(4, 4)"] };
  const ASK_WHY = {
    in_usd: { "(3,)": "rates is (3,), but each size of the result is the larger of its pair, so the result is as big as the table.", "(4, 1)": "(4, 1) would be one number per product. Every one of the 12 cells gets its own converted price." },
    per_row: { "(4,)": "That is the discount's shape before this line. <code>[:, np.newaxis]</code> adds a size-1 axis after the existing one.", "(1, 4)": "The new axis comes after the colon, so it is the second one: 4 rows, 1 column. (1, 4) is what <code>discount[np.newaxis, :]</code> gives; it clashes, like the <code>reshape(1, 4)</code> option on screen 5." },
    sale: { "(4, 1)": "The (4, 1) discount stretches across the 3 market columns; it does not shrink the table.", "(4, 4)": "Each size is the larger of its pair: 4 and 4 give 4, 3 and 1 give 3. Not 4 by 4." }
  };
  function codeRun({ el, done, kit }) {
    style();
    let i = 0, wrong = null;
    const paint = () => {
      const st = TRACE[i], fin = st.event === "return";
      const ask = !fin && ASK[st.line] ? ASK[st.line] : null;
      const next = !fin && !ask;
      const vs = Object.entries(st.vars);
      const want = ask ? sh(TRACE[i + 1].vars[ask]) : null;
      el.innerHTML = `<h1>The fixed code, as a recorded run</h1>
        <p class="lead">The whole report as one Python function, replayed from a run we recorded line by line on our machine. The highlighted line is the one about to run.</p>
        ${kit.code(CODE, st.line)}
        <div class="vars">${vs.length ? vs.map(([k, v]) => `<span>${k} <b>${sh(v)}</b></span>`).join("") : "<span>no local variables yet</span>"}<span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${ask ? `<p class="task">The highlighted line runs next. What shape will <code>${ask}</code> have?</p>` : next ? `<p class="task">Run the last line.</p>` : ""}
        <div class="lpanel">${ask ? kit.options(ASK_OPTS[ask], { picked: wrong, correct: ASK_OPTS[ask].indexOf(want) }) : ""}
        ${next ? `<div class="lsteps"><button type="button" class="btn" data-next>Next step</button></div>` : ""}
        ${wrong != null ? kit.feedback(ASK_WHY[ask][ASK_OPTS[ask][wrong]], false)
          : i > 0 && !fin ? kit.feedback(`Right: <code>${ASK[TRACE[i - 1].line]}</code> is ${sh(st.vars[ASK[TRACE[i - 1].line]])}.`, true) : ""}
        ${fin ? kit.feedback(`The function returns <code>sale</code>, ${sh(st.vars.sale)}. The ${PRODUCTS[1]} has no discount, so its row is unchanged: ${SALE[1].join(", ")}. The ${PRODUCTS[3]} is ${pct(DISCOUNT[3])} off: ${IN_USD[3][0]} becomes ${SALE[3][0]}.`, true)
            + tbl(SALE.map(r => r.map(String)), { rowHead: PRODUCTS, colHead: CUR.map(c => c + "→USD"), title: "sale, after the discount (from our run)" }, kit) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const k = +b.dataset.i;
        if (ASK_OPTS[ask][k] !== want) { wrong = k; paint(); return; }
        wrong = null; i++; paint();
      });
      const nb = el.querySelector("[data-next]");
      if (nb) nb.onclick = () => { i++; paint(); if (TRACE[i].event === "return") done(); };
    };
    paint();
  }

  /* 7. Broken on purpose, the quiet kind: a square table runs the same mistake without an error. */
  const TENT = 1;
  const TENT_CHANGED = SILENT_WRONG[TENT].map((v, c) => v !== SILENT_IN[TENT][c]);
  const TENT_HIT = TENT_CHANGED.indexOf(true);
  function silentBug({ el, done, kit }) {
    style();
    let tap = null, a1 = null;
    const D3 = DISCOUNT.slice(0, 3);
    const opts = [
      `(3, 3) and (3,) line up on the right: 3 and 3 are equal, so the ${D3.length} discounts went along the columns, one per market.`,
      "NumPy saw a square table and guessed between rows and columns.",
      "The discount went to the right rows; the tent changed because of rounding."
    ];
    const paint = () => {
      const found = tap && tap.ok;
      const cls = {};
      if (tap) cls[tap.k] = tap.ok ? "no" : "hot";
      if (found) TENT_CHANGED.forEach((ch, c) => { if (ch) cls[`${TENT},${c}`] = "no"; });
      el.innerHTML = `<h1>Broken on purpose: no error at all</h1>
        <p class="lead">Next season the shop drops the ${PRODUCTS[3]}. Now there are ${D3.length} products and ${CUR.length} markets, so the table is (3, 3) and the discount is (3,): ${D3.map((d, i) => `${PRODUCTS[i]} ${pct(d)}`).join(", ")}. Someone runs the broken discount line from screen 5, without the new axis. This time it runs. Here is what it printed.</p>
        <p class="task">The ${PRODUCTS[TENT]} has no discount. Tap a ${PRODUCTS[TENT]} price that changed anyway.</p>
        ${tbl(SILENT_IN.map(r => r.map(String)), { rowHead: PRODUCTS.slice(0, 3), colHead: CUR.map(c => c + "→USD"), title: "in_usd, before the discount" }, kit)}
        ${tbl(SILENT_WRONG.map(r => r.map(String)), { rowHead: PRODUCTS.slice(0, 3), colHead: CUR.map(c => c + "→USD"), cls, pick: () => !found, title: "after the discount line (no error)" }, kit)}
        <div class="lpanel">${tap ? kit.feedback(tap.say, tap.ok ? true : false) : ""}
        ${found ? `<p class="task">Why did NumPy not raise an error this time?</p><div id="q1">${kit.options(opts, { picked: a1, correct: 0 })}
          ${a1 == null ? "" : a1 === 0 ? kit.feedback(`Right. The rule only sees shapes, and these fit. So the backpack's ${pct(D3[0])} hit the ${CUR[0]} column, the tent's ${pct(D3[1])} the ${CUR[1]} column, the stove's ${pct(D3[2])} the ${CUR[2]} column. With 4 products it crashed; with 3 it is quietly wrong. The fix is the same column, <code>discount[:, np.newaxis]</code>, which gave ${SILENT_RIGHT[TENT].join(", ")} for the tent in our run. A habit that catches it: write the axis you mean even when the shapes happen to fit, and check the result's shape and a few known values.`, true)
            : a1 === 1 ? kit.feedback(`There is no guessing. The rule always pairs the rightmost sizes, so the same input gives the same wrong answer every time. That is worse than a guess: it looks reliable.`, false)
            : kit.feedback(`Rounding moves cents. Here the tent's ${CUR[0]} price fell from ${SILENT_IN[TENT][0]} to ${SILENT_WRONG[TENT][0]}: that is the backpack's ${pct(D3[0])} discount, landing on the ${CUR[0]} column.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(`button.${P}c`).forEach(b => b.onclick = () => {
        const [r, c] = b.dataset.i.split(",").map(Number), k = b.dataset.i;
        if (r !== TENT) tap = { k, ok: false, say: `That is the ${PRODUCTS[r]}'s row. Find the ${PRODUCTS[TENT]}'s row and compare it with the table above.` };
        else if (!TENT_CHANGED[c]) tap = { k, ok: false, say: `This one did not change: ${SILENT_IN[TENT][c]} before, ${SILENT_WRONG[TENT][c]} after. It sits in the ${CUR[c]} column, and that column got the discount meant for the ${PRODUCTS[c]}: ${pct(D3[c])}. Right by accident. Look at the other ${PRODUCTS[TENT]} prices.` };
        else tap = { k, ok: true, say: `Yes: ${SILENT_IN[TENT][c]} became ${SILENT_WRONG[TENT][c]}, though the ${PRODUCTS[TENT]} has no discount. ${TENT_CHANGED.filter(Boolean).length} of its ${CUR.length} prices changed. No error, no warning.` };
        paint();
      });
      el.querySelectorAll("#q1 button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); if (a1 === 0) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs; which cost bites first. */
  const COSTS = ["Memory: the result is huge", "Wrong axis, and no error", "Nothing: this is the plain case"];
  const BIG = [
    { q: `Compare each of ${fmt(MEM.n)} customers with every other customer: a (${fmt(MEM.n)}, 1) array minus a (1, ${fmt(MEM.n)}) array.`, right: 0,
      yes: `Memory. The inputs are small, but the result is ${sh(MEM.shape.map(fmt))}: ${fmt(MEM.cells)} cells, about ${MEM.gb} GB as 64-bit floats (worked out with <code>np.broadcast_shapes</code>, not built). Work on a block of rows at a time instead.`,
      no: {
        1: `The axes are right here: a column (${fmt(MEM.n)}, 1) against a row (1, ${fmt(MEM.n)}) is exactly how you ask for every pair. The danger is the size of the result: ${fmt(MEM.cells)} cells.`,
        2: `Look at the size of the result, not the inputs. Each input has ${fmt(MEM.n)} numbers, but the result has one cell for every pair: ${fmt(MEM.cells)} cells.` } },
    { q: `A ${sh(RUN_BIG[1].a)} table times one factor per row, shape ${sh(RUN_BIG[1].b)}, written as <code>table * factor</code>.`, right: 1,
      yes: `Wrong axis. It runs and gives ${sh(RUN_BIG[1].out)}, but the ${RUN_BIG[1].b[0]} factors go to the columns. A per-row factor needs <code>factor[:, np.newaxis]</code>.`,
      no: {
        0: `The result is ${sh(RUN_BIG[1].out)}, ${RUN_BIG[1].out.reduce((m, v) => m * v, 1)} cells: memory is no issue. The danger is that the ${RUN_BIG[1].b[0]} per-row factors run along the columns.`,
        2: `It runs (our run gave ${sh(RUN_BIG[1].out)}), so nothing warns you. But a per-row factor lines up with the columns here, as the tent's prices did on the last screen.` } },
    { q: `A ${sh(RUN_BIG[0].a)} table minus each column's average, shape ${sh(RUN_BIG[0].b)}.`, right: 2,
      yes: `Plain case. One value per column lines up with the columns, which is what you mean. Result ${sh(RUN_BIG[0].out)}, and the averages are never copied.`,
      no: {
        0: `The result is ${sh(RUN_BIG[0].out)}, no bigger than the table, and the ${RUN_BIG[0].b[0]} averages are never copied. Memory is no issue.`,
        1: `The averages are one per column, and the rightmost size of the table is the columns: they line up as intended, so the axis is right.` } }
  ];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for broadcasting</h1>
        <p class="lead"><b>What for:</b> combining a small array with a big one, such as the shop's one rate per currency or one average per column, with no Python loop and no copy of the small one.</p>
        <p class="lead"><b>When:</b> one array repeats along an axis of the other.</p>
        <p class="lead"><b>When not:</b> data that is not one rectangle (lists of different lengths: loop over them or group them), and results too big for memory (work on a block of rows at a time).</p>
        <p class="lead"><b>What it costs:</b> the result is always full size, and a wrong axis can pass silently when two sizes happen to match. So write the axis you mean with <code>np.newaxis</code>, and check the result's shape. (On a sum or mean, <code>keepdims=True</code> does the same job: it keeps the summed axis as size 1.)</p>
        <p class="task">For each situation, which cost bites first?</p>
        ${BIG.map((b, i) => `<div class="lcase" id="c${i}"><p>${b.q}</p>${kit.options(COSTS, { picked: ans[i], correct: b.right })}${ans[i] == null ? "" : kit.feedback(ans[i] === b.right ? b.yes : b.no[ans[i]], ans[i] === b.right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: will one broadcast operation do this, as written? */
  const CASES = [
    { q: `A batch of model scores, shape ${sh(RUN_REC[0].a)}: ${RUN_REC[0].a[0]} examples, ${RUN_REC[0].a[1]} classes (the possible answers, one score each). Add one bias per class (a fixed extra number for that class), shape ${sh(RUN_REC[0].b)}, with <code>scores + bias</code>.`, y: true,
      yes: `Yes. From the right: ${explain(RUN_REC[0].a, RUN_REC[0].b)}. Our run gave ${sh(RUN_REC[0].out)}. Adding a bias like this comes back in the neural network lessons.`,
      no: `It works. From the right: ${explain(RUN_REC[0].a, RUN_REC[0].b)}. Our run gave ${sh(RUN_REC[0].out)}.` },
    { q: `${RUN_REC[1].a[0]} small single-channel photos (one number per pixel), ${RUN_REC[1].a[1]} by ${RUN_REC[1].a[2]} pixels, shape ${sh(RUN_REC[1].a)}. Subtract the average photo, shape ${sh(RUN_REC[1].b)}, with <code>photos - mean_photo</code>.`, y: true,
      yes: `Yes. From the right: ${explain(RUN_REC[1].a, RUN_REC[1].b)}. Our run gave ${sh(RUN_REC[1].out)}.`,
      no: `It works. Two dimensions can line up at once: ${explain(RUN_REC[1].a, RUN_REC[1].b)}. Our run gave ${sh(RUN_REC[1].out)}.` },
    { q: `A year of hourly readings, shape ${sh(RUN_REC[2].a)}. Subtract each day's average, shape ${sh(RUN_REC[2].b)}, with <code>readings - day_mean</code>.`, y: false,
      yes: `No, not as written. ${explain(RUN_REC[2].a, RUN_REC[2].b)}. Our run: <code>ValueError: {E}</code>. One average per day is one per row, so make it a column: <code>day_mean[:, np.newaxis]</code>, shape ${sh(RUN_REC[3].b)}, gave ${sh(RUN_REC[3].out)}.`,
      no: `Line them up on the right: ${explain(RUN_REC[2].a, RUN_REC[2].b)}, so it raises a ValueError. The ${RUN_REC[2].b[0]} averages belong to the rows, so they need shape ${sh(RUN_REC[3].b)}.` },
    { q: "Three shop branches keep their prices as Python lists of different lengths: 2, 3 and 1 products. Convert all three with one NumPy operation and one rate per branch.", y: false,
      yes: `No. Broadcasting works on arrays, and an array must be a rectangle. These lists are not: in our run <code>np.array</code> refused them with "${"{R}"}". There is no shape to line up. Loop over the branches (each branch's prices times its one rate broadcasts fine), or keep all products in one long table with a branch column, which the next lesson does with pandas.`,
      no: `Try to write the shape of these lists: 3 branches, then 2, 3 or 1 products. There is no single number for the second size, so they are not one array, and broadcasting has nothing to line up. Our run of <code>np.array</code> on them raised a ValueError. Loop over the branches instead, or use one long table with a branch column.` }
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const fill = s => s.replace("{E}", kit.esc(RUN_REC[2].error)).replace("{R}", kit.esc(RAGGED_ERR));
    const paint = () => {
      el.innerHTML = `<h1>Will one broadcast do it?</h1>
        <p class="lead">${WORDS[CASES.length]} new situations.</p>
        <p class="task">For each one: will a single broadcast operation do it, exactly as written? Pick again if you change your mind.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${c.q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: c.y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(fill(ans[i] === (c.y ? 0 : 1) ? c.yes : c.no), ans[i] === (c.y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((x, j) => ans[j] === (x.y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can predict the shape</h1>
      <p class="lead">Line the shapes up on the right. Each pair of sizes must be equal or contain a 1 (a missing size counts as 1); the result takes the larger size. Otherwise NumPy raises "operands could not be broadcast together", and the two shapes in the message tell you which array to reshape. When the shapes fit by accident, nothing warns you, so write the axis you mean.</p>
      <p class="lead">Reach for broadcasting when a small array repeats along one axis of a big one. Do not use it for lists of different lengths, or when the full-size result would not fit in memory. Its cost: the result is always full size, even though the small array is never copied.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson. You write <code>to_usd(prices, rates, discount)</code> that converts the shop's table and applies one discount per product, and check that it fails loudly when a discount list has the wrong length.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Tables get named columns, and grouping rows by a column, like the branch column from the last screen, becomes one call.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Broadcasting and shape errors",
    checked: "2026-11-14",
    sources: [
      "https://numpy.org/doc/stable/user/basics.broadcasting.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.broadcast_shapes.html",
      "https://numpy.org/doc/stable/reference/constants.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.mean.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.broadcast_to.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.sum.html"
    ],
    interview: [
      {
        q: "A teammate's normalisation code subtracts each row's mean from an (n, d) feature matrix. The unit test on a 4 × 4 example passes, but on real data it crashes with \"operands could not be broadcast together\". What happened, and how do you fix and prevent it?",
        good: [
          "NumPy compares shapes from the right, so the (n,) row means were lined up with the d columns.",
          "On the 4 × 4 test n equals d, so it ran silently along the wrong axis; real data has n ≠ d, so it crashes.",
          "Fix: keep the row axis, with mean(axis=1, keepdims=True) or means[:, np.newaxis], shape (n, 1).",
          "Prevent: test with non-square shapes and assert the result's shape and a few known values."
        ],
        weak: "Transpose the matrix until the error goes away. It may run, but nobody checked which axis the means belong to, and the square test still hides the bug."
      },
      {
        q: "You compute the difference between every pair of 100,000 vectors with broadcasting, and the job runs out of memory although the inputs are small. Why, and what do you do?",
        good: [
          "Broadcasting avoids copying the inputs, but the result is always full size: one cell per pair, times the vector length.",
          "Work out the result shape before running it (np.broadcast_shapes) and multiply by the item size.",
          "Process the rows in chunks so only one block of the result exists at a time.",
          "Ask whether every pair is really needed; a search for the nearest few uses a tool built for that."
        ],
        weak: "Get a machine with more RAM. That postpones the problem: the result grows with the square of the number of vectors."
      }
    ],
    screens: [byHand, spotIdea, theRule, sixPairs, brokenError, codeRun, silentBug, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(ROUNDS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(rule(RUN_RULE[0].a, RUN_RULE[0].b).steps.length + rule(RUN_RULE[1].a, RUN_RULE[1].b).steps.length).fill("[data-right]") },
      { wrong: ["#c0 [data-wrong]"], right: RUN_SIX.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: [...Object.keys(ASK).map(() => "[data-right]"), "[data-next]"] },
      { wrong: [`[data-i="${TENT},${TENT_CHANGED.indexOf(false)}"]`], right: [`[data-i="${TENT},${TENT_HIT}"]`, "#q1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
