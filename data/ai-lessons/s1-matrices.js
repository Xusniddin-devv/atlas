/* Lesson s1-matrices: Matrices as many dot products at once.
   Story: a wholesale bakery prices the morning orders of three cafés (Harbour, Station, Library) at once.
   Ideas: (1) each café's bill is the dot product of its order row with the price list; stack the rows into a
   matrix and "matrix @ vector" is one dot product per row; "matrix @ matrix" is one per row-column pair.
   (2) Read a matrix as a transform: it moves every vector the same way, and column j is where the j-th unit
   arrow lands (a croissant price rise of 1 moves the bills by the croissant column).
   (3) Shapes: (n, k) @ (k, m) needs the two k's to match; a mismatch fails loudly, while * instead of @ runs
   silently and gives the wrong shape.
   Data: the orders, prices and dough weights are written by us (docs/ai-path/runs/s1-matrices/bakery.py), not
   a real bakery. Code output comes from runs on this Mac (Python 3.12.11, NumPy 2.5.4, see env.txt):
     docs/ai-path/runs/s1-matrices/scratch.py        -> scratch.out.txt (the traced bill_all() on screen 6)
     docs/ai-path/runs/s1-matrices/library.py        -> library.out.txt (the NumPy screen 7)
     docs/ai-path/runs/s1-matrices/invoice_broken.py -> invoice_broken.out.txt (the traceback on screen 8)
     docs/ai-path/runs/s1-matrices/fixes.py          -> fixes.out.txt (the candidate fixes on screen 8, and the
                                                        corners of the square on screen 3)
   No model API calls were recorded for this lesson; nothing on it is "not run by us".
   Lesson-local picture and CSS (prefix lx-s1-matrices-): a tappable SVG grid for the transform, a small table
   with a highlighted row or column, and an output block. */
(() => {
  const ID = "s1-matrices", P = "lx-" + ID + "-";

  // bakery.py
  const PRODUCTS = ["croissant", "baguette", "sourdough", "cinnamon bun"];
  const CAFES = ["Harbour", "Station", "Library"];
  const ORDERS = [[12, 6, 4, 10], [20, 8, 2, 5], [6, 10, 3, 12]];
  const PRICES = [2, 3, 5, 4];
  const DOUGH = [60, 250, 800, 90];
  const NC = CAFES.length, NP = PRODUCTS.length;

  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const sum = a => a.reduce((s, v) => s + v, 0);
  const BILLS = ORDERS.map(o => dot(o, PRICES));
  const DOUGHS = ORDERS.map(o => dot(o, DOUGH));
  const ITEMS = PRODUCTS.map((_, j) => [PRICES[j], DOUGH[j]]);
  const COLS = ["price (€)", "dough (g)"];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = n => n.toLocaleString("en");
  const f1 = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const RUN_DATE = "2026-11-14";

  // scratch.out.txt: trace of bill_all(ORDERS, PRICES), keep = bills, order (not altered)
  const TRACE = [
    [1, "line", {}], [2, "line", { bills: [] }], [3, "line", { bills: [], order: [12, 6, 4, 10] }],
    [2, "line", { bills: [102], order: [12, 6, 4, 10] }], [3, "line", { bills: [102], order: [20, 8, 2, 5] }],
    [2, "line", { bills: [102, 94], order: [20, 8, 2, 5] }], [3, "line", { bills: [102, 94], order: [6, 10, 3, 12] }],
    [2, "line", { bills: [102, 94, 105], order: [6, 10, 3, 12] }], [4, "line", { bills: [102, 94, 105], order: [6, 10, 3, 12] }],
    [4, "return", { bills: [102, 94, 105], order: [6, 10, 3, 12] }]
  ];
  const CODE6 = [
    "def dot(order, prices):",
    "    pairs = zip(order, prices)",
    "    return sum(q * p for q, p in pairs)",
    "",
    "def bill_all(orders, prices):",
    "    bills = []",
    "    for order in orders:",
    "        bills.append(dot(order, prices))",
    "    return bills"
  ];
  const OFF6 = 4;   // the traced function bill_all starts at listing line 4

  // library.py and library.out.txt (not altered)
  const CODE7 = [
    "import numpy as np",
    "",
    "# rows: Harbour, Station, Library",
    "orders = np.array([[12, 6, 4, 10],",
    "                   [20, 8, 2, 5],",
    "                   [6, 10, 3, 12]])",
    "prices = np.array([2, 3, 5, 4])",
    "# columns: price, dough (g)",
    "items = np.array([[2, 60], [3, 250],",
    "                  [5, 800], [4, 90]])",
    "",
    "print(orders.shape, prices.shape)",
    "print(orders @ prices)",
    "print((orders @ items).shape)",
    "print(orders @ items)",
    "print((orders * prices).shape)"
  ];
  const OUT7 = ["(3, 4) (4,)", "[102  94 105]", "(3, 2)", "[[ 102 6320]\n [  94 5250]\n [ 105 6340]]", "(3, 4)"];

  // invoice_broken.py and invoice_broken.out.txt (the file path in the traceback trimmed with …, nothing else changed)
  const CODE8 = [
    "import numpy as np",
    "",
    "orders = np.array([[12, 6, 4, 10],",
    "                   [20, 8, 2, 5],",
    "                   [6, 10, 3, 12]])",
    "prices = np.array([2, 3, 5, 4])",
    "",
    "bills = prices @ orders",
    "print(bills)"
  ];
  const TB8 = `Traceback (most recent call last):
  File "…/invoice_broken.py", line 8, in <module>
    bills = prices @ orders
            ~~~~~~~^~~~~~~~
ValueError: matmul: Input operand 1 has a mismatch in its core dimension 0, with gufunc signature (n?,k),(k,m?)->(n?,m?) (size 3 is different from 4)`;
  // fixes.out.txt (not altered)
  const FIX8 = {
    "orders @ prices": "orders @ prices -> (3,)\n[102  94 105]",
    "prices @ orders.T": "prices @ orders.T -> (3,)\n[102  94 105]",
    "prices * orders": "prices * orders -> (3, 4)\n[[24 18 20 40]\n [40 24 10 20]\n [12 30 15 48]]",
    "orders.T @ prices": "orders.T @ prices -> ValueError: matmul: Input operand 1 has a mismatch in its core dimension 0, with gufunc signature (n?,k),(k,m?)->(n?,m?) (size 4 is different from 3)"
  };

  /* ---------- lesson-local styles ---------- */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}wrap { overflow-x: auto; max-width: 100%; }
      .${P}t { border-collapse: collapse; margin: 12px 0 0; font: 500 14px var(--mono); }
      .${P}t caption { text-align: left; font: 600 12.5px var(--font); color: var(--muted); padding: 0 0 4px; }
      .${P}t th, .${P}t td { padding: 6px 9px; border-bottom: 1px solid var(--line); text-align: right; color: var(--ink); }
      .${P}t th { font: 600 12.5px var(--font); color: var(--muted); }
      .${P}t td:first-child, .${P}t th:first-child { text-align: left; font-family: var(--font); }
      .${P}t td.on, .${P}t th.on { background: var(--sunk); font-weight: 700; color: var(--ink); }
      .${P}t td.q { color: var(--faint); }
      .${P}plot { position: relative; width: 100%; max-width: 380px; aspect-ratio: 1 / 1; margin: 12px 0 0; }
      .${P}plot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
      .${P}plot .gl { stroke: var(--line); stroke-width: 0.3; }
      .${P}plot .tk { fill: var(--muted); font: 500 3.6px var(--mono); }
      .${P}plot .sq { fill: none; stroke: var(--ink-2); stroke-width: 0.6; stroke-dasharray: 1.6 1.2; }
      .${P}plot .im { fill: var(--good-soft); stroke: var(--good); stroke-width: 0.9; }
      .${P}plot .dot { fill: var(--surface); stroke: var(--ink); stroke-width: 0.8; }
      .${P}plot .dot.src { fill: var(--ink); }
      .${P}plot .dot.enter { fill: var(--good); stroke: var(--good); }
      .${P}plot .dot.no { fill: var(--bad-soft); stroke: var(--bad); stroke-width: 1.2; }
      .${P}plot .lb { fill: var(--ink); font: 700 3.6px var(--font); }
      .${P}plot button.cl { position: absolute; padding: 0; margin: 0; border: 0; background: transparent; cursor: pointer; border-radius: 4px; min-height: 44px; }
      .${P}plot button.cl:hover, .${P}plot button.cl:focus-visible { outline: 2px solid var(--ink-2); outline-offset: -3px; }
      .${P}cap { font: 500 13px/1.4 var(--font); color: var(--muted); margin: 8px 0 0; }
      .${P}out { font: 500 13.5px/1.5 var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin: 10px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}out .p { color: var(--muted); }
      .${P}mx { display: inline-flex; align-items: center; gap: 10px; margin: 12px 0 0; font: 600 16px var(--mono); color: var(--ink); }
      .${P}mx table { border-collapse: collapse; border-left: 2px solid var(--ink); border-right: 2px solid var(--ink); }
      .${P}mx td { padding: 4px 10px; text-align: right; }
      @media (max-width: 480px) { .${P}t th, .${P}t td { padding: 5px 6px; font-size: 13px; } }
    `;
    document.head.appendChild(s);
  }

  // a table with row labels; opts.col / opts.row highlight one column or one row (index into values)
  function tbl(head, rows, { col = -1, row = -1, title = "" } = {}) {
    return `<div class="${P}wrap"><table class="${P}t">${title ? `<caption>${esc(title)}</caption>` : ""}<thead><tr>${head.map((h, j) => `<th class="${j > 0 && j - 1 === col ? "on" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(([l, vals], i) => `<tr><td class="${i === row ? "on" : ""}">${esc(l)}</td>${vals.map((v, j) => `<td class="${j === col || i === row ? "on" : ""}${v === "?" ? " q" : ""}">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const ordersTbl = (o = {}) => tbl(["café", ...PRODUCTS], ORDERS.map((r, i) => [CAFES[i], r]), { title: "orders (number of items)", ...o });
  const pricesTbl = () => tbl(["", ...PRODUCTS], [["price (€)", PRICES]], { title: "price list" });
  const mat = (m, name) => `<div class="${P}mx"><span>${esc(name)} =</span><table>${m.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}</table></div>`;

  /* 1. The situation, by hand: price each café's order. */
  function byHand({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === NC;
      const o = fin ? null : ORDERS[k];
      const right = fin ? 0 : BILLS[k], avg = fin ? 0 : sum(o) * sum(PRICES) / NP, drop = fin ? 0 : right - o[NP - 1] * PRICES[NP - 1];
      const opts = fin ? [] : [right, avg, drop].filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
      const done3 = BILLS.slice(0, k).map((b, i) => `${CAFES[i]} €${b}`).join(", ");
      el.innerHTML = `<h1>Three cafés, one price list</h1>
        <p class="lead">A wholesale bakery delivers to three cafés every morning. Each café sends its order the night before, and at 5 a.m. someone prices every order by hand before the van leaves. Every café pays the same price list.</p>
        ${ordersTbl({ row: fin ? -1 : k })}
        ${pricesTbl()}
        ${fin ? "" : `<p class="task">Work out the ${CAFES[k]} café's bill: for each product, quantity times price, then add the four.</p>`}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(v => `€${f1(v)}`), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong == null ? (k > 0 && !fin ? kit.feedback(`Done so far: ${done3}.`) : "")
          : wrong === avg ? kit.feedback(`€${f1(avg)} is all the items (${sum(o)}) times the average price (€${f1(sum(PRICES) / NP)}). That is right only if the café bought equal amounts of everything. Sourdough costs more than a croissant, so each product needs its own quantity × price.`, false)
          : kit.feedback(`€${f1(drop)} leaves out the last product: ${o[NP - 1]} ${PRODUCTS[NP - 1]}s × €${PRICES[NP - 1]} = €${o[NP - 1] * PRICES[NP - 1]}. Every column of the order counts.`, false)}
        ${fin ? kit.feedback(`All three priced: ${CAFES.map((c, i) => `${c} €${BILLS[i]}`).join(", ")}. That was ${NC} × ${NP} = ${NC * NP} multiplications and the additions after them. The bakery wants to take on more cafés, and this is the job that grows. AI models have the same job at a far bigger size: each layer of a model is many dot products done at once. This lesson shows how to do them all in one step.`, true) : ""}</div>`;
      el.querySelectorAll(".lpanel > .lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k === NC) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: every bill is the same operation, a dot product with the price list. */
  function spot({ el, done, kit }) {
    css();
    let ans = null;
    const L = NC - 1, o = ORDERS[L];
    const opts = [
      `Multiply each quantity by its price and keep the ${NP} results`,
      `The dot product of that café's order row with the price list`,
      `Add up the café's items and multiply by the average price`
    ];
    const lineTotals = o.map((q, j) => q * PRICES[j]);
    const paint = () => {
      el.innerHTML = `<h1>The one move you repeated</h1>
        <p class="lead">You did the same thing ${NC} times, once per café. A fourth café, or a fortieth, would get the same treatment.</p>
        <p class="task">Which operation from the last lesson is a single café's bill?</p>
        ${ordersTbl({ row: ans === 1 ? -1 : L })}
        ${pricesTbl()}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1 ? kit.feedback(`Right. Multiply matching entries and add them up: that is a dot product. ${CAFES[L]}: ${o.map((q, j) => `${q}×${PRICES[j]}`).join(" + ")} = ${BILLS[L]}. Stack the ${NC} order rows and you have a table of numbers with ${NC} rows and ${NP} columns: a <b>matrix</b>. Its shape is written (${NC}, ${NP}). <b>Matrix times vector</b> means: one dot product per row. A (${NC}, ${NP}) matrix times a vector of ${NP} prices gives ${NC} bills. The matrix's ${NP} columns must match the ${NP} prices: one price per product.`, true)
          : ans === 0 ? kit.feedback(`That gives ${NP} numbers for the ${CAFES[L]} café (${lineTotals.join(", ")}), the line totals of the invoice. A bill is one number: those line totals still have to be added up. Multiply and then add is the dot product.`, false)
          : kit.feedback(`That shortcut gave the wrong bill on the last screen. ${CAFES[L]}: ${sum(o)} items × €${f1(sum(PRICES) / NP)} = €${f1(sum(o) * sum(PRICES) / NP)}, but the real bill is €${BILLS[L]}. Each product has its own price, so each quantity is multiplied by its own price.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. The same multiplication seen as moving points: where does M send each corner of a square? (fixes.out.txt) */
  const M = [[2, 1], [0, 1]];
  const CORNERS = [[1, 0], [0, 1], [1, 1]];
  const mv = (m, v) => m.map(r => dot(r, v));
  const mtv = (m, v) => [0, 1].map(j => m[0][j] * v[0] + m[1][j] * v[1]);   // rows used as if they were columns
  const G = 4, X0 = 10, W = 86, Y0 = 2;
  const cx = x => X0 + (x + 0.5) * W / G, cy = y => Y0 + (G - 1 - y + 0.5) * W / G;
  function plot({ src = [], dots = [], image = false, pick = false }) {
    let g = "";
    for (let i = 0; i <= G; i++) {
      g += `<line class="gl" x1="${X0 + i * W / G}" y1="${Y0}" x2="${X0 + i * W / G}" y2="${Y0 + W}"/><line class="gl" x1="${X0}" y1="${Y0 + i * W / G}" x2="${X0 + W}" y2="${Y0 + i * W / G}"/>`;
    }
    for (let v = 0; v < G; v++) g += `<text class="tk" x="${cx(v)}" y="${Y0 + W + 5}" text-anchor="middle">${v}</text><text class="tk" x="${X0 - 2.5}" y="${cy(v) + 1.2}" text-anchor="end">${v}</text>`;
    const poly = pts => pts.map(([x, y]) => `${cx(x)},${cy(y)}`).join(" ");
    const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
    if (image) g += `<polygon class="im" points="${poly(sq.map(c => mv(M, c)))}"/>`;
    g += `<polygon class="sq" points="${poly(sq)}"/>`;
    for (const p of src) g += `<circle class="dot src" cx="${cx(p[0])}" cy="${cy(p[1])}" r="2.6"/>`;
    for (const d of dots) g += `<circle class="dot ${d.cls || ""}" cx="${cx(d.p[0])}" cy="${cy(d.p[1])}" r="3"/>${d.label ? `<text class="lb" x="${cx(d.p[0]) + 3.6}" y="${cy(d.p[1]) - 3.4}">${esc(d.label)}</text>` : ""}`;
    let cells = "";
    if (pick) for (let y = G - 1; y >= 0; y--) for (let x = 0; x < G; x++) {
      cells += `<button type="button" class="cl" data-i="${x},${y}" aria-label="point (${x}, ${y})" style="left:${X0 + x * W / G}%;top:${Y0 + (G - 1 - y) * W / G}%;width:${W / G}%;height:${W / G}%"></button>`;
    }
    return `<div class="${P}plot"><svg viewBox="0 0 100 100" aria-hidden="true">${g}</svg>${cells}</div>
      <p class="${P}cap">First number across, second number up. The dashed square has corners (0, 0), (1, 0), (1, 1) and (0, 1).</p>`;
  }
  function transform({ el, done, kit }) {
    css();
    let k = 0, miss = null;
    const pt = v => `(${v.join(", ")})`;
    const work = c => `row 1 · ${pt(c)} = ${M[0][0]}×${c[0]} + ${M[0][1]}×${c[1]} = ${mv(M, c)[0]}, row 2 · ${pt(c)} = ${M[1][0]}×${c[0]} + ${M[1][1]}×${c[1]} = ${mv(M, c)[1]}`;
    const paint = () => {
      const fin = k === CORNERS.length;
      const c = fin ? null : CORNERS[k];
      const dots = CORNERS.slice(0, k).map(cc => ({ p: mv(M, cc), cls: "enter", label: `M·${pt(cc)}` }));
      if (miss) dots.push({ p: miss.p, cls: "no" });
      el.innerHTML = `<h1>A matrix moves points</h1>
        <p class="lead">There is a second way to read "matrix times vector". Here the vector is a point (x, y) on a grid, and M is a small matrix with 2 rows and 2 columns. M times the point gives a new point. The dot product of row 1 with (x, y) is the new first number. Row 2 with (x, y) gives the new second number. So M moves points.</p>
        ${mat(M, "M")}
        ${fin ? "" : `<p class="task">Where does M send the corner ${pt(c)}? Work out the two dot products, then tap that point.</p>`}
        ${plot({ src: CORNERS.slice(k).concat(fin ? [] : [[0, 0]]), dots, image: fin, pick: !fin })}
        <div class="lpanel">${fin ? kit.feedback(`All three corners moved, and (0, 0) stays where it is: anything times 0 is 0. The filled shape is where the whole square lands: twice as wide and slanted. Every point inside it moved by the same rule. That is what people mean by reading a matrix as a <b>transform</b>: it takes vectors in and gives moved vectors out.`, true)
          : miss ? kit.feedback(miss.say, false)
          : k > 0 ? kit.feedback(`${pt(CORNERS[k - 1])} went to ${pt(mv(M, CORNERS[k - 1]))}: ${work(CORNERS[k - 1])}.`) : ""}</div>`;
      el.querySelectorAll(`.${P}plot button.cl`).forEach(b => b.onclick = () => {
        const p = b.dataset.i.split(",").map(Number), r = mv(M, c);
        if (p[0] === r[0] && p[1] === r[1]) { k++; miss = null; paint(); if (k === CORNERS.length) done(); return; }
        const t = mtv(M, c);
        const say = p[0] === c[0] && p[1] === c[1] ? `That is where the corner starts. M moves it: ${work(c)}.`
          : p[0] === t[0] && p[1] === t[1] ? `That reads M's columns as if they were rows. Each new number comes from one <b>row</b> of M: ${work(c)}.`
          : p[0] === r[1] && p[1] === r[0] ? `The two numbers are swapped. The first number (across) comes from row 1, the second (up) from row 2: ${work(c)}.`
          : `That point is (${p.join(", ")}). Work it out as two dot products: ${work(c)}.`;
        miss = { p, say };
        paint();
      });
    };
    paint();
  }

  /* 4. Spot the idea: a column is what one input does to every output (the croissant price rises by 1). */
  function columns({ el, done, kit }) {
    css();
    let ans = null;
    const C0 = ORDERS.map(r => r[0]), up = BILLS.map((b, i) => b + C0[i]);
    const opts = ["Each bill goes up by €1", `Each bill goes up by €${sum(C0)}, all the croissants ordered`, `The bills go up by the croissant column: ${C0.map(v => `+€${v}`).join(", ")}`];
    const paint = () => {
      const ok = ans === 2;
      el.innerHTML = `<h1>The croissant price goes up</h1>
        <p class="lead">Read the bakery's pricing as a transform too. The vectors do not have to be points on a grid: the orders matrix takes in a price list (${NP} numbers) and gives back the bills (${NC} numbers).</p>
        ${ordersTbl({ col: ok ? 0 : -1 })}
        <p class="task">Tomorrow croissants cost €1 more; nothing else changes. How do the ${NC} bills change?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 2 })}
        ${ans == null ? "" : ok ? kit.feedback(`Right. The ${CAFES.join(", ")} cafés buy ${C0.join(", ")} croissants, so the bills become ${up.map(v => `€${v}`).join(", ")}. A change of 1 in the first input moves the outputs by exactly the first column. The square showed the same thing: (1, 0) landed on (${mv(M, [1, 0]).join(", ")}), M's first column, and (0, 1) on (${mv(M, [0, 1]).join(", ")}), its second. So you can read any matrix by its columns: <b>column j says what one unit of input j does to every output</b>. If several inputs change, add up their columns, each times its change.`, true)
          : ans === 0 ? kit.feedback(`A bill rises by €1 for every croissant on it, not €1 in total. The ${CAFES[1]} café buys ${C0[1]} croissants, so its bill rises by €${C0[1]}.`, false)
          : kit.feedback(`€${sum(C0)} is the croissant column added up: the rise for the bakery's total takings that day. Each café only pays for its own croissants: ${C0.map((v, i) => `${CAFES[i]} ${v}`).join(", ")}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 5. Matrix times matrix: bills and dough weights for every café in one product. */
  function matmat({ el, done, kit }) {
    css();
    const ans = [null, null];
    const S = 1;   // the Station café row
    const shapeOpts = [`(${NC}, ${COLS.length})`, `(${NP}, ${COLS.length})`, `(${NC}, ${NP})`, "An error: the shapes do not fit"];
    const cellOpts = [DOUGHS[S], BILLS[S], DOUGHS[0]].sort((a, b) => a - b), cellRight = cellOpts.indexOf(DOUGHS[S]);
    const paint = () => {
      const ok0 = ans[0] === 0, ok1 = ans[1] === cellRight;
      const res = CAFES.map((c, i) => [c, [ok1 ? BILLS[i] : "?", ok1 ? DOUGHS[i] : "?"]]);
      el.innerHTML = `<h1>Two questions per café at once</h1>
        <p class="lead">The van driver also needs the weight of each café's crates. So the bakery adds a second column to its item list: grams of dough per item. The item list is now a matrix too: ${NP} rows (one per product) and ${COLS.length} columns (price, dough). <b>Matrix times matrix</b> means one dot product for every pair of a row on the left and a column on the right. In NumPy it is written <code>orders @ items</code>.</p>
        ${ordersTbl()}
        ${tbl(["item", ...COLS], PRODUCTS.map((p, j) => [p, ITEMS[j]]), { title: "items", col: ok0 && !ok1 ? 1 : -1 })}
        <div class="lcase" id="c0"><p class="task">orders has shape (${NC}, ${NP}), items has shape (${NP}, ${COLS.length}). What shape is <code>orders @ items</code>?</p>
        ${kit.options(shapeOpts, { picked: ans[0], correct: 0 })}
        ${ans[0] == null ? "" : ok0 ? kit.feedback(`Right: one row per café, one column per question (price, dough). The shared ${NP} in the middle disappears, because it is what each dot product adds over. The rule: (n, k) <code>@</code> (k, m) gives (n, m).`, true)
          : ans[0] === 1 ? kit.feedback(`(${NP}, ${COLS.length}) is the shape of items itself. The answer has one row per café, and there are ${NC} cafés.`, false)
          : ans[0] === 2 ? kit.feedback(`(${NC}, ${NP}) is the shape of orders. The ${NP} products are what each dot product adds over, so they disappear; what stays is one row per café and one column per question.`, false)
          : kit.feedback(`The shapes fit: orders has ${NP} columns and items has ${NP} rows, one per product. Only those two sizes must match.`, false)}</div>
        ${ok0 ? `<div class="lcase" id="c1"><p class="task">Which number goes in the ${CAFES[S]} café's dough cell?</p>
          ${kit.options(cellOpts.map(v => fmt(v)), { picked: ans[1], correct: cellRight, num: true })}
          ${ans[1] == null ? "" : ok1 ? kit.feedback(`Right: ${CAFES[S]}'s row · the dough column = ${ORDERS[S].map((q, j) => `${q}×${DOUGH[j]}`).join(" + ")} = ${fmt(DOUGHS[S])} g. Every cell is one row times one column: ${NC} × ${COLS.length} = ${NC * COLS.length} dot products of ${NP} terms, ${NC * COLS.length * NP} multiplications in all.`, true)
            : cellOpts[ans[1]] === BILLS[S] ? kit.feedback(`${BILLS[S]} is ${CAFES[S]}'s row times the price column: its bill, the cell to the left. The dough cell uses the dough column.`, false)
            : kit.feedback(`${fmt(DOUGHS[0])} is the ${CAFES[0]} café's row times the dough column. The ${CAFES[S]} cell uses the ${CAFES[S]} row: ${ORDERS[S].join(", ")}.`, false)}
          ${tbl(["café", ...COLS], res, { title: "orders @ items" })}</div>` : ""}`;
      el.querySelectorAll("#c0 .lopts button").forEach(b => b.onclick = () => { ans[0] = +b.dataset.i; paint(); });
      el.querySelectorAll("#c1 .lopts button").forEach(b => b.onclick = () => { ans[1] = +b.dataset.i; paint(); if (ans[1] === cellRight) done(); });
    };
    paint();
  }

  /* 6. From scratch in Python: a replay of the traced run of bill_all(orders, prices). */
  const PQ = TRACE.map(t => t[0]).lastIndexOf(3);
  function scratch({ el, done, kit }) {
    css();
    let i = 0, guess = null;
    const before = TRACE[PQ][2].bills, after = TRACE[PQ + 1][2].bills, last = after[after.length - 1];
    const lastOrder = TRACE[PQ][2].order;
    const pOpts = [JSON.stringify(after), JSON.stringify([last]), JSON.stringify([...before, sum(lastOrder)])];
    const show = v => v == null ? "–" : JSON.stringify(v).replace(/,/g, ", ");
    const say = j => {
      const [ln, ev, v] = TRACE[j], nx = TRACE[j + 1] ? TRACE[j + 1][2] : null;
      if (ev === "return") return `<code>bill_all</code> returns ${show(v.bills)}: the ${NC} bills you worked out by hand, one per café.`;
      if (ln === 1) return `Called as <code>bill_all(orders, prices)</code>, with the ${NC} order rows and the ${NP} prices. <code>bills</code> starts as an empty list.`;
      if (ln === 2) return nx && TRACE[j + 1][0] === 3 ? `The loop takes the next order row: ${show(nx.order)}, the ${CAFES[nx.bills.length]} café.` : `No rows left after ${NC} rounds, so the loop ends.`;
      if (ln === 3) return `One dot product: <code>dot(order, prices)</code> = ${v.order.map((q, k) => `${q}×${PRICES[k]}`).join(" + ")} = ${dot(v.order, PRICES)}, appended to bills.`;
      return `All ${NC} bills are in.`;
    };
    const paint = () => {
      const [ln, ev, v] = TRACE[i];
      const ask = i === PQ, held = ask && guess !== 0;
      el.innerHTML = `<h1>The same idea in plain Python</h1>
        <p class="lead"><code>dot</code> is the dot product from the last lesson in two lines: <code>zip</code> pairs quantity with price, like pairing two arrays by index in JavaScript. <code>bill_all</code> is "matrix times vector": one dot product per row. We ran it on the bakery's orders and recorded every line it ran.</p>
        <p class="task">Step through the run to the end. Before the last café, you predict what <code>bills</code> will hold.</p>
        ${kit.code(CODE6, ln + OFF6)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || held ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>order <b>${show(v.order)}</b></span><span>bills <b>${show(v.bills)}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${ev === "return" ? `<div class="${P}out"><span class="p">returned</span> ${esc(show(v.bills))}</div>` : ""}
        ${ask ? `<div class="lcase" id="c-pred"><p class="task">The highlighted line is about to run with order = ${show(lastOrder)}. What will bills hold after it?</p>
          ${kit.options(pOpts.map(s => esc(s.replace(/,/g, ", "))), { picked: guess, correct: 0 })}
          ${guess == null || guess === 0 ? "" : guess === 1 ? kit.feedback(`<code>append</code> adds to the end of the list; it does not replace it. The bills of the first two cafés stay, and ${last} joins them.`, false)
            : kit.feedback(`${sum(lastOrder)} is the number of items in the order. The line appends <code>dot(order, prices)</code>: each quantity times its price, added up.`, false)}</div>` : ""}
        ${held ? "" : kit.feedback(say(i))}
        <p class="${P}cap">Recorded run on our Mac, ${RUN_DATE}. The highlighted line is the one about to run; the variables are as they are at that moment.</p>`;
      el.querySelectorAll("#c-pred .lopts button").forEach(b => b.onclick = () => { guess = +b.dataset.i; paint(); });
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 7. The library: NumPy's @ does it in one line. Predict each printed line, then see the recorded output. */
  const Q7 = [
    { line: 12, q: "What does print(orders @ prices) print?", opts: ["[102  94 105]", `A table of ${NC} × ${NP} line totals`, "One number, the day's takings"], right: 0,
      no: [`A table of line totals is what element-by-element multiplication gives. <code>@</code> multiplies and adds along each row: one dot product per café.`,
        `One number would need a dot product of two vectors. orders is a matrix with ${NC} rows, so you get one number per row.`],
      yes: `Right: one bill per café, the same three numbers as by hand and from <code>bill_all</code>. <code>@</code> is Python's matrix multiplication operator; on NumPy arrays it is shorthand for <code>np.matmul</code>. The first output line shows the shapes: (${NP},) is a 1-D array, a plain list of ${NP} numbers. On the right of <code>@</code>, NumPy treats it as a column, so every row meets all ${NP} prices.` },
    { line: 13, q: "What does print((orders @ items).shape) print?", opts: [`(${NC}, ${COLS.length})`, `(${COLS.length}, ${NC})`, `(${NP}, ${COLS.length})`], right: 0,
      no: [`(${COLS.length}, ${NC}) has the rows and columns the other way round. The rows of the answer come from the rows of the left side: cafés.`,
        `(${NP}, ${COLS.length}) is the shape of items. The ${NP} products are added over and disappear.`],
      yes: `Right: (n, k) @ (k, m) gives (n, m). The next line prints the table: each café's bill and dough weight.` },
    { line: 15, q: "A teammate types * instead of @. What does print((orders * prices).shape) print?", opts: [`(${NC}, ${NP})`, `(${NC},)`, "An error"], right: 0,
      no: [`(${NC},) is what <code>@</code> gives. <code>*</code> multiplies element by element and never adds up.`,
        `No error. With <code>*</code>, NumPy stretches the price row across every café row (broadcasting, from the NumPy lessons), and the shapes fit.`],
      yes: `Right, and no error. <code>*</code> multiplies element by element: you get the ${NC * NP} line totals, never added up. A bill printed from this is ${NP} numbers per café, not one. This is the bug that does not crash, so check the shape you expect: one bill per café is (${NC},).` }
  ];
  const SHOWN7 = [[0], [0, 1], [0, 1, 2, 3], [0, 1, 2, 3, 4]];
  function library({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === Q7.length, q = fin ? null : Q7[k];
      const outLines = OUT7.filter((_, i) => SHOWN7[k].includes(i));
      el.innerHTML = `<h1>All cafés at once, with NumPy</h1>
        <p class="lead">With the orders in one 2-D array, the whole morning's pricing is <code>orders @ prices</code>. Same arithmetic as your loop, done inside NumPy without a Python loop.</p>
        ${kit.code(CODE7, fin ? -1 : q.line)}
        <div class="${P}out"><span class="p">output so far</span>\n${outLines.map(esc).join("\n")}</div>
        ${k > 0 ? kit.feedback(Q7[k - 1].yes) : ""}
        ${fin ? kit.feedback(`The two things to get right: the operator (<code>@</code> multiplies and adds, <code>*</code> only multiplies) and the order of the two sides, so the middle sizes match.`, true) : `<p class="task">${esc(q.q)}</p>
        <div class="lpanel">${kit.options(q.opts.map(esc), { picked: wrong, correct: q.right })}
        ${wrong == null ? "" : kit.feedback(q.no[wrong > q.right ? wrong - 1 : wrong], false)}</div>`}
        <p class="${P}cap">Output recorded on our Mac with NumPy 2.5.4, ${RUN_DATE}.</p>`;
      el.querySelectorAll(".lpanel .lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== q.right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k === Q7.length) done();
      });
    };
    paint();
  }

  /* 8. Broken on purpose: a real shape error. Find the cause, then pick the fix (every fix was run). */
  const FIXES = ["orders @ prices", "prices * orders", "orders.T @ prices"];
  function broken({ el, done, kit }) {
    css();
    const ans = [null, null];
    const causes = [
      `prices is 1-D, and @ only works on 2-D matrices`,
      `prices @ orders puts the ${NP} prices against the ${NC} rows of orders: the left side's last size must equal the right side's first size, and ${NP} is not ${NC}`,
      `The arrays hold whole numbers, and matmul needs decimals`
    ];
    const paint = () => {
      const ok0 = ans[0] === 1, ok1 = ans[1] === 0;
      el.innerHTML = `<h1>The invoice script crashes</h1>
        <p class="lead">A new teammate wrote the morning invoice script. It stops before printing anything. Here is the script and the real error it printed on our Mac.</p>
        ${kit.code(CODE8, 7)}
        <div class="${P}out">${esc(TB8)}</div>
        <div class="lcase" id="c0"><p class="task">What is the cause?</p>
        ${kit.options(causes.map(esc), { picked: ans[0], correct: 1 })}
        ${ans[0] == null ? "" : ok0 ? kit.feedback(`Right. Read the shapes as (${NP},) @ (${NC}, ${NP}). The ${NP} at the end of the left side must meet a ${NP} at the start of the right side, and it meets ${NC}. That is what "size ${NC} is different from ${NP}" says. NumPy counts from 0, so operand 1 is the second one, orders, and dimension 0 is its first size, ${NC}.`, true)
          : ans[0] === 0 ? kit.feedback(`On the NumPy screen, <code>orders @ prices</code> worked with the same 1-D prices. NumPy treats a 1-D array as a row or a column as needed. The error message names sizes, not the number of dimensions.`, false)
          : kit.feedback(`<code>orders @ prices</code> ran on the same whole numbers on the NumPy screen. Whole numbers multiply fine. The message is about sizes: ${NC} is different from ${NP}.`, false)}</div>
        ${ok0 ? `<div class="lcase" id="c1"><p class="task">Which line 8 gives one bill per café? <code>.T</code> swaps an array's rows and columns. We ran all three.</p>
          ${kit.options(FIXES.map(f => `bills = ${esc(f)}`), { picked: ans[1], correct: 0 })}
          ${ans[1] == null ? "" : `<div class="${P}out"><span class="p">recorded</span>\n${esc(FIX8[FIXES[ans[1]]])}</div>`}
          ${ans[1] == null ? "" : ok1 ? kit.feedback(`Right: (${NC}, ${NP}) @ (${NP},) gives (${NC},), the bills. <code>prices @ orders.T</code> also works and gave the same numbers in our run: <code>.T</code> flips orders to (${NP}, ${NC}), so the ${NP}s meet. Pick the order of the two sides from what the rows mean, not by trying swaps until the error goes away.`, true)
            : ans[1] === 1 ? kit.feedback(`It runs, and that is the trap: ${NC * NP} line totals, shape (${NC}, ${NP}), never added up. No error does not mean right; check the result has the shape you expect, (${NC},).`, false)
            : kit.feedback(`<code>.T</code> turns orders into (${NP}, ${NC}). Now the left side ends in ${NC} and prices has ${NP}: the same clash the other way round, and NumPy says so.`, false)}</div>` : ""}`;
      el.querySelectorAll("#c0 .lopts button").forEach(b => b.onclick = () => { ans[0] = +b.dataset.i; paint(); });
      el.querySelectorAll("#c1 .lopts button").forEach(b => b.onclick = () => { ans[1] = +b.dataset.i; paint(); if (ans[1] === 0) done(); });
    };
    paint();
  }

  /* 9. The big picture, with a task on cost. */
  function bigPicture({ el, done, kit }) {
    css();
    let ans = null;
    const now = NC * NP * COLS.length, later = (2 * NC) * (2 * NP) * (2 * COLS.length), times = later / now;
    const opts = ["2 times as much", "4 times as much", `${times} times as much`, "The same: it is still one line of code"];
    const right = opts.findIndex(o => o.startsWith(String(times)));
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What for:</b> many dot products in one call. A model's layer is one: PyTorch's <code>nn.Linear</code> computes x·Aᵀ + b for every input row at once, where A is the layer's weight matrix and b a vector added to every result row (the bias). Scoring one query vector against every stored vector is another.</p>
        <p class="lead"><b>When:</b> each output is a fixed weighted sum of the inputs. A quick test: twice the input gives twice the output.</p>
        <p class="lead"><b>When not:</b> rules that change with the amount, like a discount above 100 items, are not a weighted sum. Compute those first, or add a step after. A lookup by id is a lookup, not a product.</p>
        <p class="lead"><b>Cost:</b> (n, k) <code>@</code> (k, m) takes n × k × m multiplications, and the matrices must fit in memory.</p>
        <p class="task">Today <code>orders @ items</code> is (${NC}, ${NP}) <code>@</code> (${NP}, ${COLS.length}). Next year: twice the cafés, twice the products, twice the columns per item. How much more arithmetic?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: right })}
        ${ans == null ? "" : ans === right ? kit.feedback(`Right. Now ${NC} × ${NP} × ${COLS.length} = ${now} multiplications; next year ${2 * NC} × ${2 * NP} × ${2 * COLS.length} = ${later}, ${times} times as many. All three sizes multiply. That is why big models are expensive to run: their layers are large matrix products, done for every input.`, true)
          : ans === 3 ? kit.feedback(`One line of code, not one step. <code>@</code> still does every multiplication: ${now} today, ${later} next year.`, false)
          : ans === 1 ? kit.feedback(`4 times is two sizes doubled; all three double here: cafés, products and columns, so 2 × 2 × 2.`, false)
          : kit.feedback(`Doubling one size doubles the work, but here all three sizes double: cafés, products and columns. The count is n × k × m, so it is 2 × 2 × 2.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations, with one "no". */
  const CASES = [
    ["A search service keeps 10,000 document vectors as the rows of one table. A query vector comes in, and it needs a score for every document.", true,
      "Yes. documents @ query is one dot product per row: 10,000 scores in one call. If every vector is scaled to length 1 first, those scores are the cosine similarities from the last lesson.",
      "Each score is a dot product of one document row with the query, the same for every row. That is matrix times vector: documents @ query gives all 10,000 at once."],
    ["A phone plan: the first 5 GB each month are free, then every GB costs the same price. Bill 2,000 customers from their usage with one matrix product.", false,
      "No. A matrix product can only give fixed weighted sums: double the usage, double the bill. Here 4 GB costs nothing and 8 GB costs 3 GB's worth, so no fixed weight works. Compute the billable GB first (usage minus 5, never below 0), then multiply.",
      "Try it: with a fixed price per GB, 4 GB would cost something, but here it is free. A matrix product can only give fixed weighted sums, where doubling the input doubles the output. The free allowance breaks that, so subtract it first (never below 0), then multiply."],
    ["A small model turns each set of 3 sensor readings into 2 scores, each score a fixed weighted sum of the readings. It must score a day of readings, 86,400 rows, in one go.", true,
      "Yes. readings (86,400, 3) @ weights (3, 2) gives (86,400, 2): two scores per row. This is exactly what a model layer does to a batch.",
      "Each score is a fixed weighted sum of the 3 readings: a dot product with a column of weights. All rows and both scores at once is (86,400, 3) @ (3, 2) → (86,400, 2)."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is a matrix product the right tool?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the bakery.</p>
        <p class="task">For each one, decide: can a single matrix product do the job? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the browser exercise and the next lesson. */
  function whatNext({ el, done, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now multiply a matrix by a vector (one dot product per row) and by a matrix (one per row-column pair), read a matrix as a transform whose columns say what each input does, and fix a shape clash by reading the sizes: (n, k) @ (k, m) gives (n, m).</p>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write <code>bill_all(orders, prices)</code> from dot products, then check it against <code>orders @ prices</code> and make it refuse orders whose length does not match the price list.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. ${nx.id === "s1-derivatives" ? "It asks how much an output moves when you nudge one input. For a matrix you already know the answer: the croissant column." : esc(nx.outcome || "")}</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Matrices as many dot products at once",
    checked: "2026-11-14",
    sources: [
      "https://numpy.org/doc/stable/reference/generated/numpy.matmul.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.multiply.html",
      "https://numpy.org/doc/stable/user/basics.broadcasting.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.ndarray.T.html",
      "https://peps.python.org/pep-0465/",
      "https://docs.pytorch.org/docs/stable/generated/torch.nn.Linear.html"
    ],
    interview: [{
      q: "Your model code crashes with \"matmul: Input operand 1 has a mismatch in its core dimension 0 ... (size 3 is different from 4)\". How do you fix it?",
      good: [
        "Print the shapes of both operands before the product",
        "Apply the rule (n, k) @ (k, m) -> (n, m): find which two sizes should be the shared k",
        "Decide what each axis means (rows are examples, columns are features) and fix the order or transpose to match that meaning",
        "Check the result has the shape you expect, and add an assert on it so a wrong fix cannot pass silently"
      ],
      weak: "Swap the operands or add .T until the error goes away. That can run and still be wrong, for example when the matrix happens to be square."
    }, {
      q: "A teammate scores documents with scores = doc_vectors * query. No error, but the ranking is nonsense. What happened?",
      good: [
        "* multiplies element by element; broadcasting stretches the query over every row, so the result is (documents, features), not one score per document",
        "The fix is doc_vectors @ query, one dot product per row, giving shape (documents,)",
        "Summing the element-wise product over each row would give the same scores, but @ says what is meant",
        "Assert the scores shape is (number of documents,) before ranking"
      ],
      weak: "Try a different similarity measure or a vector database, without looking at the shape of the scores."
    }],
    screens: [byHand, spot, transform, columns, matmat, scratch, library, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(NC).fill(".lpanel > .lopts [data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="0,0"]'], right: CORNERS.map(c => `[data-i="${mv(M, c).join(",")}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: [...Array(PQ).fill("[data-next]"), "#c-pred [data-wrong]"],
        right: ["#c-pred [data-right]", ...Array(TRACE.length - 1 - PQ).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: Q7.map(() => "[data-right]") },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
