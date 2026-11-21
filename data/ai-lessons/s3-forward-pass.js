/* Lesson: forward pass through a small network. Story: a dumpling shop predicts tonight's delivery wait from the
   number of orders and whether it rains; later the owner wants to add the couriers on shift.
   Ideas: (1) a layer is one matrix product plus a bias, then ReLU: each column of W holds one hidden neuron's
   weights, and stacking evenings as rows runs all of them in the same line; (2) shapes chain: (n, 2) @ (2, 3) ->
   (n, 3) @ (3, 1) -> (n, 1), and a wrong shape either crashes (loud) or broadcasts into nonsense (silent).
   Depth: explain (screens 1-5, 9, 10, interview), scratch (screen 6, a stepped replay of predict_wait),
   debug (screens 7 and 8, two real failures).
   Data, all real, from runs on this Mac (NumPy 2.5.4, PyTorch 2.15.0, see env.txt):
   - docs/ai-path/runs/s3-forward-pass/forward.py + forward.out.txt: the hand-set 2-3-1 weights, one evening by
     hand, the traced predict_wait on four evenings, the weight counts, the NumPy errors for W1 @ x and x * W1;
   - docs/ai-path/runs/s3-forward-pass/broken.py + broken.out.txt: a third input column with the old W1 (ValueError),
     the zero-row fix, and b1 written as a (3, 1) column (silent (3, 1) output for one evening);
   - docs/ai-path/runs/s3-forward-pass/torch_linear.py + torch_linear.out.txt: how nn.Linear stores the same layers.
   No model recordings. Lesson-local style: a small matrix table and output block (.lx-s3-forward-pass-*), see
   ensureStyle(). Plain browser script. */
(() => {
  const ID = "s3-forward-pass";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const fmt = n => { const r = Math.round(n * 100) / 100; return (r < 0 ? "−" : "") + String(Math.abs(r)); };
  const shp = a => `(${a.join(", ")}${a.length === 1 ? "," : ""})`;

  /* ---------- Data copied from the runs ---------- */
  // forward.py: weights set by hand for the lesson (no training). Rows of W1: orders, rain. Columns: hidden units 1-3.
  const W1 = [[0.5, 0.25, -1.0], [4.0, -2.0, 3.0]];
  const B1 = [-2.0, 1.0, 0.0];
  const W2 = [[1.5], [2.0], [0.5]];
  const B2 = [10.0];
  const X1 = [12, 1]; // one evening: 12 orders, raining
  // forward.out.txt, "one evening"
  const RUN1 = { z: [8.0, 2.0, -9.0], h: [8.0, 2.0, 0.0], y: [26.0], noBias: [10.0, 1.0, -9.0],
    shapes: { W1: [2, 3], b1: [3], W2: [3, 1], b2: [1] } };
  // forward.out.txt, "four evenings": the traced predict_wait (line 0 = def)
  const EVENINGS = [[12, 1], [2, 1], [20, 0], [15, 1]];
  const CODE = [
    "def predict_wait(evenings, W1, b1, W2, b2):",
    "    z = evenings @ W1 + b1",
    "    hidden = np.maximum(z, 0)",
    "    wait = hidden @ W2 + b2",
    "    return wait"
  ];
  const Z4 = [[8.0, 2.0, -9.0], [3.0, -0.5, 1.0], [8.0, 6.0, -20.0], [9.5, 2.75, -12.0]];
  const H4 = [[8.0, 2.0, 0.0], [3.0, 0.0, 1.0], [8.0, 6.0, 0.0], [9.5, 2.75, 0.0]];
  const WAIT4 = [[26.0], [15.0], [34.0], [29.75]];
  // trace steps: [line about to run, event, names of the locals set at that moment]
  const TRACE = [[1, "line", []], [2, "line", ["z"]], [3, "line", ["z", "hidden"]], [4, "line", ["z", "hidden", "wait"]], [4, "return", ["z", "hidden", "wait"]]];
  const VALS = { z: Z4, hidden: H4, wait: WAIT4 };
  const SHAPES = { evenings: [4, 2], z: [4, 3], hidden: [4, 3], wait: [4, 1] };
  // forward.out.txt, "multiply-adds per evening" and "wrong ways"
  const WEIGHTS_231 = 9, PARAMS_231 = 13, WIDE = 300, WEIGHTS_WIDE = 900;
  const ERR_W1X = "ValueError: matmul: Input operand 1 has a mismatch in its core dimension 0, with gufunc signature (n?,k),(k,m?)->(n?,m?) (size 2 is different from 3)";
  const ERR_XW1 = "ValueError: operands could not be broadcast together with shapes (2,) (2,3)";
  // broken.out.txt, bug A (trimmed with … , not altered)
  const BUG_A = [
    "evenings (4, 3) W1 (2, 3)",
    "Traceback (most recent call last):",
    "  File \"broken.py\", line 15, in predict_wait",
    "    z = evenings @ W1 + b1",
    "        ~~~~~~~~~^~~~",
    "ValueError: matmul: Input operand 1 has a mismatch in its core dimension 0, with gufunc signature (n?,k),(k,m?)->(n?,m?) (size 2 is different from 3)"
  ];
  const EVENINGS3 = [[12, 1, 3], [2, 1, 2], [20, 0, 4], [15, 1, 3]];
  const FIX_A = { W1: [3, 3], wait: [[26.0], [15.0], [34.0], [29.75]] };
  // broken.out.txt, bug B
  const BUG_B_CODE = [
    "b1_col = np.array([[-2.0], [1.0], [0.0]])",
    "x = np.array([12.0, 1.0])",
    "z = x @ W1 + b1_col",
    "hidden = np.maximum(z, 0)",
    "wait = hidden @ W2 + b2"
  ];
  const BUG_B_OUT = [
    "x (2,) x @ W1 (3,) b1_col (3, 1)",
    "z (3, 3) [[8.0, -1.0, -11.0], [11.0, 2.0, -8.0], [10.0, 1.0, -9.0]]",
    "hidden (3, 3)",
    "wait (3, 1) [[22.0], [30.5], [27.0]]"
  ];
  const BUG_B_WAIT = [22.0, 30.5, 27.0];
  // torch_linear.out.txt
  const TORCH = { w1: [3, 2], b1: [3], w2: [1, 3], b2: [1], out: [4, 1] };

  /* ---------- Derived from the data ---------- */
  const relu = v => Math.max(v, 0);
  const col = (M, j) => M.map(r => r[j]);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const NIN = W1.length, NH = W1[0].length, NOUT = W2[0].length;
  const MULTS_HAND = NIN * NH + NH * NOUT;
  const WIDE_MULTS = NIN * WIDE + WIDE * NOUT;
  const zj = j => dot(X1, col(W1, j)) + B1[j];
  const NAMES = ["orders", "rain"];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-mats { display: flex; flex-wrap: wrap; gap: 14px 22px; margin: 14px 0 12px; align-items: flex-start; }
      .lx-${ID}-mat { border-collapse: collapse; font: 500 15px/1.3 var(--mono); color: var(--ink); }
      .lx-${ID}-mat caption { text-align: left; font: 600 13px/1.4 var(--font); color: var(--muted); padding: 0 0 4px; }
      .lx-${ID}-mat th { font: 500 12.5px/1.3 var(--mono); color: var(--muted); padding: 4px 8px; text-align: right; }
      .lx-${ID}-mat td { border: 1px solid var(--line); background: var(--surface); padding: 6px 9px; text-align: right; min-width: 3.2em; }
      .lx-${ID}-mat td.lx-${ID}-on { outline: 3px solid var(--ink); outline-offset: -3px; }
      .lx-${ID}-mat td.lx-${ID}-off { color: var(--faint); }
      .lx-${ID}-out { margin: 14px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); font: 500 13.5px/1.5 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-sum { font: 500 14.5px/1.5 var(--mono); overflow-wrap: anywhere; }
      .lcase .lopts button { font-family: var(--mono); }
    `;
    document.head.appendChild(s);
  }
  // A matrix as a small table. rowHead/colHead optional; on/off: sets of "r,c" keys to ring or fade.
  function mat(kit, rows, { title = "", rowHead = null, colHead = null, on = new Set(), off = new Set() } = {}) {
    const head = colHead ? `<tr>${rowHead ? "<th></th>" : ""}${colHead.map(h => `<th scope="col">${kit.esc(h)}</th>`).join("")}</tr>` : "";
    const body = rows.map((r, i) => `<tr>${rowHead ? `<th scope="row">${kit.esc(rowHead[i])}</th>` : ""}${r.map((v, j) =>
      `<td class="${on.has(`${i},${j}`) ? `lx-${ID}-on` : off.has(`${i},${j}`) ? `lx-${ID}-off` : ""}">${kit.esc(typeof v === "number" ? fmt(v) : v)}</td>`).join("")}</tr>`).join("");
    return `<table class="lx-${ID}-mat">${title ? `<caption>${kit.esc(title)}</caption>` : ""}${head}${body}</table>`;
  }
  const mats = (...m) => `<div class="lx-${ID}-mats">${m.join("")}</div>`;
  const out = (kit, lines) => `<div class="lx-${ID}-out">${kit.esc(lines.join("\n"))}</div>`;
  const net = (kit, notes, cls = {}) => kit.pics.graph(
    [{ id: "x1", x: 0, y: 0.5 }, { id: "x2", x: 0, y: 1.5 }, { id: "h1", x: 1, y: 0 }, { id: "h2", x: 1, y: 1 }, { id: "h3", x: 1, y: 2 }, { id: "y", x: 2, y: 1 }],
    [["x1", "h1"], ["x1", "h2"], ["x1", "h3"], ["x2", "h1"], ["x2", "h2"], ["x2", "h3"], ["h1", "y"], ["h2", "y"], ["h3", "y"]],
    { directed: true, notes, cls, title: "The shop's network: 2 inputs, 3 hidden units, 1 output" });
  const W1mat = (kit, on) => mat(kit, W1, { title: "W1", rowHead: NAMES, colHead: ["h1", "h2", "h3"], on });
  const B1mat = kit => mat(kit, [B1], { title: "b1", colHead: ["h1", "h2", "h3"] });
  const W2mat = kit => mat(kit, W2, { title: "W2", rowHead: ["h1", "h2", "h3"], colHead: ["wait"] });
  const B2mat = kit => mat(kit, [B2], { title: "b2" });

  /* Several independent question blocks (#c0, #c1, ...); done() when all are right. */
  function blocks({ el, done, kit }, head, items, tail = () => "") {
    const ans = items.map(() => null);
    const paint = () => {
      el.innerHTML = head() + items.map((it, i) => `<div class="lcase" id="c${i}"><p>${it.q}</p>${kit.options(it.opts.map(o => o.t), { picked: ans[i], correct: it.right })}${ans[i] == null ? "" : kit.feedback(it.opts[ans[i]].fb, ans[i] === it.right)}</div>`).join("") + (items.every((it, j) => ans[j] === it.right) ? tail() : "");
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (items.every((it, j) => ans[j] === it.right)) done();
      }));
    };
    paint();
  }
  /* One question; done() on the right pick. */
  function single({ el, done, kit }, head, opts, right, extra = () => "") {
    let ans = null;
    const paint = () => {
      el.innerHTML = `${head(ans)}<div class="lpanel">${kit.options(opts.map(o => o.t), { picked: ans, correct: right })}${ans == null ? "" : kit.feedback(opts[ans].fb, ans === right)}</div>${extra(ans)}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }
  /* Questions one after another; done() after the last right pick. */
  function sequence({ el, done, kit }, head, qs, tail) {
    let k = 0, ans = null;
    const paint = () => {
      const q = qs[k];
      const past = qs.slice(0, k).filter(p => p.after).map(p => kit.feedback(p.after, true)).join("");
      el.innerHTML = `${head(k)}${past}${q ? `<p class="task">${q.q}</p><div class="lpanel">${kit.options(q.opts.map(o => o.t), { picked: ans, correct: q.right })}${ans == null ? "" : kit.feedback(q.opts[ans].fb, false)}</div>` : tail()}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === qs[k].right) { k++; ans = null; paint(); if (k === qs.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 1. The situation, and the three hidden cells by hand. */
  function handHidden(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const sumTxt = j => `${X1[0]} × ${fmt(W1[0][j])} + ${X1[1]} × ${fmt(W1[1][j])} ${B1[j] < 0 ? "−" : "+"} ${fmt(Math.abs(B1[j]))} = ${fmt(zj(j))}`;
    const items = [0, 1, 2].map(j => {
      const right = relu(zj(j));
      const cands = [
        [right, null],
        [relu(dot(X1, col(W1, j))), `That is ${fmt(relu(dot(X1, col(W1, j))))} with the bias left out. Each unit adds its own bias after the weighted sum: here ${fmt(B1[j])}.`],
        [zj(j), `${fmt(zj(j))} is the weighted sum plus bias, but the unit does not stop there. ReLU keeps a positive sum and turns a negative one into 0.`],
        [relu(X1[0] * W1[1][j] + X1[1] * W1[0][j] + B1[j]), `That multiplies orders by the rain weight and rain by the orders weight. Row 1 of W1 belongs to orders, row 2 to rain.`]
      ];
      const seen = new Set(), opts = [];
      for (const [v, fb] of cands) { const k = fmt(v); if (seen.has(k)) continue; seen.add(k); opts.push({ v, t: k, fb: fb || `Right: ${sumTxt(j)}${zj(j) < 0 ? `, and ReLU turns ${fmt(zj(j))} into 0` : ""}.` }); }
      opts.sort((a, b) => a.v - b.v);
      return { q: `Hidden unit h${j + 1} (column ${j + 1} of W1):`, opts, right: opts.findIndex(o => o.v === right) };
    });
    blocks(ctx, () => `<h1>How long will tonight's delivery take?</h1>
      <p class="lead">A dumpling shop tells each customer how long delivery will take. A small network makes the guess from two numbers: <b>x1</b>, the orders tonight, and <b>x2</b>, rain (1 if it rains, 0 if dry). The weights below were set by hand for this lesson; training them comes later. Here you learn how a network turns its inputs into a guess, the step that runs every time a neural network gives an answer.</p>
      ${net(kit, { x1: String(X1[0]), x2: String(X1[1]) })}
      ${mats(W1mat(kit), B1mat(kit))}
      <p class="lead">The <b>hidden units</b> h1, h2, h3 sit between the inputs and the output. Each one is a neuron from the last lesson: multiply each input by its weight in that unit's column, add them, add the unit's bias, then ReLU (a negative result becomes 0).</p>
      <p class="task">Tonight: ${X1[0]} orders, and it rains. Work out the three hidden units.</p>`, items);
  }

  /* 2. The output unit by hand: the whole trip is a forward pass. */
  function handOutput(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const h = RUN1.h, y = RUN1.y[0];
    const noB2 = dot(h, col(W2, 0)), noRelu = dot(RUN1.z, col(W2, 0)) + B2[0], plainSum = h.reduce((a, b) => a + b, 0) + B2[0];
    const opts = [
      { v: noB2, fb: `${fmt(noB2)} is the weighted sum without b2. The output unit has a bias too: add ${fmt(B2[0])}.` },
      { v: plainSum, fb: `${fmt(plainSum)} adds the hidden values and b2, but skips the weights. Each hidden value is first multiplied by its own row of W2.` },
      { v: noRelu, fb: `${fmt(noRelu)} uses h3 = ${fmt(RUN1.z[2])}, the value before ReLU. The output reads what the hidden units send, and h3 sent 0.` },
      { v: y, fb: `Right: ${h.map((v, i) => `${fmt(v)} × ${fmt(W2[i][0])}`).join(" + ")} + ${fmt(B2[0])} = ${fmt(y)} minutes. That whole trip, inputs to hidden units to the output, is a <b>forward pass</b>: the network's prediction. You did ${plural(MULTS_HAND, "multiplication")} for one evening. (The output has no ReLU: a wait time is just the number.)` }
    ].sort((a, b) => a.v - b.v).map(o => ({ ...o, t: fmt(o.v) }));
    single(ctx, () => `<h1>From the hidden units to a wait time</h1>
      <p class="lead">Your hidden units for tonight: h1 = ${fmt(h[0])}, h2 = ${fmt(h[1])}, h3 = ${fmt(h[2])}. The output unit is one more neuron, with the hidden units as its inputs.</p>
      ${net(kit, { x1: String(X1[0]), x2: String(X1[1]), h1: fmt(h[0]), h2: fmt(h[1]), h3: fmt(h[2]), y: "?" }, { y: "accent" })}
      ${mats(W2mat(kit), B2mat(kit))}
      <p class="task">What wait, in minutes, does the network predict tonight?</p>`, opts, opts.findIndex(o => o.v === y));
  }

  /* 3. Spot the idea: the three hidden sums are one matrix product. */
  function spotIdea(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const colSums = [0, 1, 2].map(j => W1[0][j] + W1[1][j]);
    const lumped = (X1[0] + X1[1]) * colSums[0] + B1[0];
    const opts = [
      { t: "<code>W1 @ x + b1</code>", fb: `NumPy refuses: <code>${kit.esc(ERR_W1X)}</code>. <code>@</code> pairs the last size of the left side with the first size of the right side. W1 is (2, 3), so it wants 3 numbers on its right, and x has 2.` },
      { t: "<code>x @ W1 + b1</code>", fb: `Right. <code>@</code> is matrix multiplication. x (${X1.length} numbers) acts as one row; each <b>column</b> of W1 is one hidden unit's weights; row times column is exactly the weighted sum you did by hand. One line gives all ${NH} sums: ${RUN1.z.map(fmt).join(", ")} in the run, the same as yours. ReLU then works on each number on its own: <code>np.maximum(z, 0)</code>.` },
      { t: "<code>x * W1 + b1</code>", fb: `<code>*</code> multiplies number by number; it never adds across. NumPy refused here: <code>${kit.esc(ERR_XW1)}</code>. Even where shapes do fit, <code>*</code> leaves the products unsummed.` },
      { t: "<code>(x[0] + x[1]) * W1.sum(axis=0) + b1</code>", fb: `That adds orders and rain first, so the network can no longer weigh them differently. For h1 it gives ${fmt(lumped)}, not ${fmt(RUN1.z[0])}. Each input must meet its own weight before anything is added.` }
    ];
    single(ctx, () => `<h1>The same sums, in one line</h1>
      <p class="lead">For each hidden unit you went down one column of W1: orders times the top weight, plus rain times the bottom weight. In NumPy, tonight's inputs are <code>x = np.array([${X1.join(", ")}])</code>, W1 is the ${W1.length} × ${NH} table and b1 holds ${NH} biases.</p>
      ${mats(mat(kit, [X1], { title: "x", colHead: NAMES }), W1mat(kit, new Set(["0,0", "1,0"])), B1mat(kit))}
      <p class="task">Which line gives all three hidden sums (before ReLU) at once?</p>`, opts, 1);
  }

  /* 4. Predict the shape of every weight matrix and bias. */
  function shapes(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const S = ["(2, 3)", "(3, 2)", "(3,)", "(3, 1)", "(1,)"];
    const mk = (name, rightShape, why, fbs) => ({ q: `<code>${name}</code>: ${why}`, right: S.indexOf(shp(rightShape)), opts: S.map(t => ({ t, fb: t === shp(rightShape) ? fbs.ok : (fbs[t] || fbs.other) })) });
    const items = [
      mk("W1", RUN1.shapes.W1, "the weights from 2 inputs to 3 hidden units", {
        ok: "Right: one row per input, one column per hidden unit. x (2 numbers) @ (2, 3) gives 3 numbers.",
        "(3, 2)": "That is the flipped table. x has 2 numbers, so the left size of W1 must be 2 for <code>x @ W1</code> to work. (PyTorch stores it flipped; see below.)",
        other: "W1 holds a weight for every input–unit pair: 2 × 3 of them, in rows (inputs) and columns (units)." }),
      mk("b1", RUN1.shapes.b1, "one bias per hidden unit", {
        ok: "Right: 3 numbers, one per hidden unit, added to the 3 sums.",
        "(3, 1)": "A column of 3. It looks harmless, but adding a (3, 1) column to 3 sums in a row does not do what you want. Screen 8 shows what happens.",
        other: "A bias belongs to a unit, not to an input or a weight. There are 3 hidden units." }),
      mk("W2", RUN1.shapes.W2, "the weights from 3 hidden units to 1 output", {
        ok: "Right: one row per hidden unit, one column per output. 3 numbers @ (3, 1) gives 1 number.",
        "(2, 3)": "That is W1. W2 starts where W1 ends: 3 hidden values come in, 1 wait goes out.",
        other: "Rows match what comes in (3 hidden values), columns match what goes out (1 wait)." }),
      mk("b2", RUN1.shapes.b2, "the output unit's bias", {
        ok: `Right: one output, one bias. In the run, one evening gave a wait of shape (1,): [${fmt(RUN1.y[0])}].`,
        other: "There is one output unit, so one bias." })
    ];
    blocks(ctx,
      () => `<h1>Read the network from its shapes</h1>
        <p class="lead">A NumPy array's <b>shape</b> lists its size along each direction: (2, 3) is 2 rows and 3 columns; (3,) is a flat list of 3 numbers. Before you run any code, you should be able to say each shape from the picture.</p>
        ${net(kit, {})}
        <p class="task">Pick the shape of each matrix and bias.</p>`, items,
      () => kit.feedback(`The rule: a layer's W has shape (numbers in, units out), and its bias has one number per unit out. You can read the whole network off the shapes: ${NIN} → ${NH} → ${NOUT}. <b>PyTorch stores it the other way round.</b> In our run, <code>nn.Linear(2, 3).weight</code> had shape ${shp(TORCH.w1)} and <code>nn.Linear(3, 1).weight</code> ${shp(TORCH.w2)}, because a Linear layer computes <code>x @ weight.T + bias</code> (<code>.T</code> flips rows and columns). Same numbers, stored as (out, in).`, true));
  }

  /* 5. Many evenings at once: rows in, rows out. */
  function batch(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const n = EVENINGS.length;
    const qs = [
      { q: `<code>evenings</code> has shape ${shp(SHAPES.evenings)}. What is the shape of <code>evenings @ W1</code>?`, right: 0,
        opts: [{ t: shp(SHAPES.z) }, { t: "(2, 3)", fb: "That is W1 itself. The product keeps one row per evening: the 4 from the left side stays." }, { t: "(4, 2)", fb: "That is the input. The 2 in the middle is used up: (4, 2) @ (2, 3) pairs the two 2s, and (4, 3) is left." }, { t: "an error", fb: "The inner sizes match (2 and 2), so the product works. It only fails when they differ, as with W1 @ x." }],
        after: `(4, 2) @ (2, 3) → (4, 3): the inner 2s must match and disappear; the outer sizes stay. One row of hidden sums per evening.` },
      { q: `b1 has shape ${shp(RUN1.shapes.b1)}. What happens in <code>evenings @ W1 + b1</code>?`, right: 1,
        opts: [{ t: "an error: (4, 3) and (3,) differ", fb: "NumPy lines shapes up from the right: 3 and 3 match, and the missing direction is treated as 1, so the 3 biases can be reused." }, { t: "b1 is added to every row" }, { t: "b1 is added to the first row only", fb: "Then evenings 2 to 4 would get no bias, and each evening's prediction would depend on its position in the table. NumPy repeats b1 for every row." }],
        after: `NumPy <b>broadcasts</b> b1: it lines up shapes from the right (3 matches 3) and repeats b1 down all ${n} rows. Each evening gets the same 3 biases.` },
      { q: "After ReLU, <code>hidden</code> is (4, 3). What is the shape of <code>hidden @ W2 + b2</code>?", right: 2,
        opts: [{ t: "(4,)", fb: "W2 is (3, 1), a table with one column, so the result keeps that column: (4, 1). You get (4,) only with a flat W2." }, { t: "(1, 4)", fb: "The rows are still evenings: 4 rows on the left stay 4 rows. (4, 3) @ (3, 1) leaves 4 and 1." }, { t: shp(SHAPES.wait) }],
        after: "(4, 3) @ (3, 1) → (4, 1): one wait per evening, in a column." }
    ];
    sequence(ctx, () => `<h1>Four evenings in one go</h1>
      <p class="lead">The shop wants tomorrow's estimates for several evenings at once. Stack them as rows: one row per evening, one column per input.</p>
      ${mats(mat(kit, EVENINGS, { title: "evenings", rowHead: EVENINGS.map((_, i) => `#${i + 1}`), colHead: NAMES }))}`, qs,
      () => `${mats(mat(kit, WAIT4, { title: "wait (run)", rowHead: EVENINGS.map((_, i) => `#${i + 1}`), colHead: ["min"] }))}
        <p class="lx-${ID}-cap">From forward.out.txt, a real NumPy run.</p>
        ${kit.feedback(`The run agrees: shape ${shp(SHAPES.wait)}, and evening #1, which is tonight, gives ${fmt(WAIT4[0][0])} minutes, the same as your hand pass. The weights never changed size: ${n} evenings or 4,000 only changes the first number of each shape. That is why networks are run on <b>batches</b>: one product does the whole stack.`, true)}`);
  }

  /* 6. The forward pass as Python: a stepped replay of the traced run. */
  const FR = (() => {
    const fr = [{ ln: 0, set: [], end: false }];
    for (let k = 1; k < TRACE.length; k++) fr.push({ ln: TRACE[k][1] === "return" ? 4 : TRACE[k - 1][0], set: TRACE[k][2], end: TRACE[k][1] === "return" });
    return fr;
  })();
  const PRED_AT = FR.findIndex(f => f.ln === 1);
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, pred = null;
    const zAll = Z4.flat(), nNeg = zAll.filter(v => v < 0).length, nPos = zAll.filter(v => v > 0).length;
    const nH3Neg = Z4.filter(r => r[2] < 0).length;
    const POPTS = [
      { v: 0, fb: `ReLU does change some of them: z has negative sums, and ReLU turns every negative into 0.` },
      { v: nH3Neg, fb: `${nH3Neg} counts the negatives in the h3 column only. Look at #2: its h2 is ${fmt(Z4[1][1])}, also negative, so that one becomes 0 as well.` },
      { v: nNeg, fb: null },
      { v: nPos, fb: `${nPos} is how many stay as they are: the positive sums. The question asks how many become 0.` }
    ].filter((o, k, a) => a.findIndex(p => p.v === o.v) === k).sort((a, b) => a.v - b.v);
    const PRIGHT = POPTS.findIndex(o => o.v === nNeg);
    const predOk = () => pred === PRIGHT;
    const name = f => f.end ? "wait" : f.set[f.set.length - 1];
    const say = f => {
      if (f.ln === 0) return `The call starts with <code>evenings</code> of shape ${shp(SHAPES.evenings)} and the hand-set weights.`;
      if (f.end) return `<code>predict_wait</code> returns the ${shp(SHAPES.wait)} column. Three lines did ${EVENINGS.length} evenings × ${MULTS_HAND} multiplications; for one evening you did the same ${MULTS_HAND} by hand.`;
      if (f.ln === 1 && !predOk()) return `One matrix product and the broadcast bias: <code>z</code> is ${shp(SHAPES.z)}. The next line is ReLU.`;
      if (f.ln === 1) return `One matrix product and the broadcast bias: <code>z</code> is ${shp(SHAPES.z)}. Negative sums: ${Z4.map((r, a) => `#${a + 1} in ${r.map((x, b) => x < 0 ? `h${b + 1}` : "").filter(Boolean).join(", ") || "none"}`).join("; ")}.`;
      if (f.ln === 2) return `ReLU, number by number. Same shape, ${shp(SHAPES.hidden)}; every negative became 0. Those faded cells send nothing on.`;
      return `The second layer. ${shp(SHAPES.hidden)} @ ${shp(RUN1.shapes.W2)} + b2 gives ${shp(SHAPES.wait)}.`;
    };
    const paint = () => {
      const f = FR[i], v = name(f);
      const off = new Set();
      if (v === "hidden") H4.forEach((r, a) => r.forEach((x, b) => { if (x === 0) off.add(`${a},${b}`); }));
      const show = v ? mat(kit, VALS[v], { title: `${v} ${shp(SHAPES[v])}`, rowHead: EVENINGS.map((_, k) => `#${k + 1}`), colHead: v === "wait" ? ["min"] : ["h1", "h2", "h3"], off })
        : mat(kit, EVENINGS, { title: `evenings ${shp(SHAPES.evenings)}`, rowHead: EVENINGS.map((_, k) => `#${k + 1}`), colHead: NAMES });
      el.innerHTML = `<h1>The forward pass in NumPy</h1>
        <p class="lead">This is the whole forward pass for the shop's network, run on the four evenings. <code>np.maximum(z, 0)</code> is ReLU: it keeps each number or 0, whichever is bigger.</p>
        <p class="task">Step through it. At each line, say the shape before you look. Before ReLU runs, predict what it does to <code>z</code>.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 || (i === PRED_AT && !predOk()) ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${["z", "hidden", "wait"].map(k => `<span>${k} <b>${f.set.includes(k) ? shp(SHAPES[k]) : "–"}</b></span>`).join("")}<span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${mats(show)}
        ${kit.feedback(say(f))}
        ${i === PRED_AT ? `<div class="lpanel" id="pred"><p>The next line runs ReLU on <code>z</code>. How many of its ${zAll.length} numbers become 0?</p>${kit.options(POPTS.map(o => String(o.v)), { picked: pred, correct: PRIGHT })}${pred == null ? "" : kit.feedback(predOk() ? `Right: ${nNeg} sums are negative, so ${nNeg} become 0. Now take the next step and check.` : POPTS[pred].fb, predOk())}</div>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 7. Broken on purpose, loud: a third input with the old W1. */
  function brokenLoud(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const qs = [
      { q: "What is the cause?", right: 2,
        opts: [
          { t: "b1 has 3 numbers, but there are now 3 inputs plus the bias", fb: "b1 is never reached: the error points at the <code>@</code> (the <code>^</code> mark under the line), before <code>+ b1</code>. And b1 belongs to the 3 hidden units, which did not change." },
          { t: "Matrix products need square matrices", fb: `They do not: (4, 2) @ (2, 3) worked on the screens before. Only the inner sizes must match. Here they are 3 and 2.` },
          { t: "W1 has 2 rows, one per input, but each evening now has 3 numbers" },
          { t: "Four evenings is too many; it needs one at a time", fb: "The 4 is the outer size, which is free. The message says <code>size 2 is different from 3</code>: the 3 is the new column count, the 2 is W1's rows." }
        ],
        after: `Inner sizes: evenings has ${EVENINGS3[0].length} columns, W1 has ${W1.length} rows. The message's <code>size 2 is different from 3</code> is exactly that.` },
      { q: "Which fix makes the code run with couriers as an input?", right: 1,
        opts: [
          { t: "Change W1 to shape (2, 4)", fb: "That adds a fourth hidden unit, not an input. The rows must match the 3 input columns." },
          { t: `Give W1 a third row: shape ${shp(FIX_A.W1)}` },
          { t: "Drop the couriers column before predicting", fb: "It runs, but the shop wanted couriers to count. That is hiding the change, not making it." }
        ],
        after: "" }
    ];
    sequence(ctx, k => `<h1>Broken on purpose: a new input</h1>
      <p class="lead">The owner wants the couriers on shift to count, so he adds a third column to the evenings table and runs <code>predict_wait</code> again with the same weights. The real output:</p>
      ${mats(mat(kit, EVENINGS3, { title: "evenings", colHead: ["orders", "rain", "couriers"] }))}
      ${out(kit, BUG_A)}
      <p class="lx-${ID}-cap">From broken.out.txt, a real NumPy run.</p>`, qs,
      () => `${kit.feedback(`Right. In the run, W1 got a row of zeros for couriers: shape ${shp(FIX_A.W1)}. It ran, and the waits were ${FIX_A.wait.map(r => fmt(r[0])).join(", ")}, <b>exactly the same as before</b>. A zero weight means couriers count for nothing. The shape fix makes the code run; only training sets useful weights for the new input. In a real model, a new input means a new first layer and retraining.`, true)}`);
  }

  /* 8. Broken on purpose, silent: b1 written as a column. */
  function brokenSilent(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const opts = [
      { t: "W2 should be (1, 3)", fb: "With W2 as (1, 3), <code>hidden @ W2</code> would fail: (3, 3) @ (1, 3) has inner sizes 3 and 1. W2 is right; what reaches it is already wrong." },
      { t: "ReLU added a direction to the array", fb: "ReLU keeps the shape it gets. The printout says z was already (3, 3) before ReLU ran." },
      { t: "b1_col is (3, 1). Added to 3 sums in a row, NumPy stretches both into a 3 × 3 grid", fb: `Right. Broadcasting lines up from the right: (3,) is treated as (1, 3), and (1, 3) + (3, 1) becomes (3, 3). Every sum got every bias. The fix is b1 with shape ${shp(RUN1.shapes.b1)}; the run then gave (1,): [${fmt(RUN1.y[0])}]. The lesson: a shape bug does not always crash. Check shapes where you build the network, for example, for a table of evenings, <code>assert wait.shape == (len(evenings), 1)</code>.` },
      { t: "x should be a column, (2, 1)", fb: "x as a flat (2,) is what worked on every earlier screen and in the fixed run. The new thing here is b1's shape." }
    ];
    single(ctx, () => `<h1>Broken on purpose: no error at all</h1>
      <p class="lead">A teammate typed b1 as a column. The code ran without a complaint, for one evening (${X1[0]} orders, rain):</p>
      ${kit.code(BUG_B_CODE, -1)}
      ${out(kit, BUG_B_OUT)}
      <p class="lx-${ID}-cap">From broken.out.txt, a real NumPy run.</p>
      <p class="task">One evening came back as ${plural(BUG_B_WAIT.length, "wait")} (${BUG_B_WAIT.map(fmt).join(", ")}), and none is ${fmt(RUN1.y[0])}. What went wrong?</p>`, opts, 2);
  }

  /* 9. The big picture. */
  function bigPicture(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const opts = [
      { v: WIDE, fb: `${WIDE} counts the hidden units, not the weights. Each of them has a weight from each of the ${NIN} inputs, and a weight to the output.` },
      { v: WIDE_MULTS, fb: `Right: ${NIN} × ${WIDE} + ${WIDE} × ${NOUT} = ${WIDE_MULTS} weights (the run printed ${WEIGHTS_WIDE}), one multiplication each, against ${WEIGHTS_231} now: ${WIDE_MULTS / WEIGHTS_231} times more work per evening. Cost grows with the number of weights, and so does memory.` },
      { v: WIDE * WIDE, fb: `That would be a layer of ${WIDE} feeding another ${WIDE}. Here a ${WIDE}-unit layer sits between ${NIN} inputs and ${NOUT} output.` },
      { v: WIDE + NIN + NOUT, fb: "That counts units. The work is in the weights between them: every connection is one multiplication." }
    ].sort((a, b) => a.v - b.v).map(o => ({ ...o, t: o.v.toLocaleString("en") }));
    single(ctx, () => `<h1>Where the forward pass fits</h1>
      <p class="lead"><b>What it is for:</b> every prediction a network makes is a forward pass. Each layer does a matrix product, adds a bias and applies an activation such as ReLU. Training runs it too, then works backwards to change the weights.</p>
      <p class="lead"><b>How to use it:</b> always in matrix form. Stack examples as rows and check every shape.</p>
      <p class="lead"><b>What it is not:</b> a learning step. A forward pass never changes the weights. And for a few numbers with a known rule, plain code is simpler than any network.</p>
      <p class="lead"><b>What it costs:</b> one multiplication (plus an add) per weight, for each example. Work and memory grow with the number of weights. A shape mistake either crashes or, worse, runs and gives wrong numbers.</p>
      <p class="lead">The shop's network has ${PARAMS_231} numbers: ${WEIGHTS_231} weights and ${PARAMS_231 - WEIGHTS_231} biases.</p>
      <p class="task">The shop widens the hidden layer from ${NH} units to ${WIDE}. How many multiplications per evening now?</p>`, opts, opts.findIndex(o => o.v === WIDE_MULTS));
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A trained network takes 10 numbers per loan application and has 16 hidden units. The bank scores 5,000 applications overnight.", true,
      "Yes. Stack them: (5000, 10) @ (10, 16) → (5000, 16), then on to the output. The weights stay the same size; only the row count grows.",
      "This is exactly the batch case: 5,000 rows of 10 numbers, W1 of (10, 16). The 5,000 is the outer size, which is free."],
    ["A model was trained on 3 sensor readings per machine. A fourth sensor is installed, and the data now arrives with 4 columns.", false,
      "No. W1 has 3 rows, so (n, 4) @ (3, units) fails, as with the couriers. A new input needs a new row of weights, and those only mean something after retraining.",
      "The inner sizes are 4 and 3, so the product crashes. And padding W1 with zeros would just ignore the sensor. The model has to be retrained with a 4-row first layer."],
    ["Product reviews arrive as lists of word ids: one review has 7 words, the next 112.", false,
      "No, not as they are. Rows of different lengths do not stack into one matrix, and W1 needs a fixed number of rows. Each review must first become a fixed-length list of numbers (later lessons show how).",
      "A matrix needs every row the same length; 7 and 112 are not. And W1 has one row per input number, a count fixed when it was built. Turn each review into a fixed-length list of numbers first."],
    ["The shop's app asks for one evening's wait at a time, while a nightly report asks for all 30 days of next month.", true,
      "Yes. The same weights serve both: one evening is a (1, 2) or (2,) input, the report is (30, 2). Only the first size changes.",
      "Nothing about the weights depends on how many evenings you send. One at a time or 30 at once, it is the same matrix products."],
    ["The predictions are off by a few minutes, so a teammate suggests running more forward passes on last month's data until they improve.", false,
      "No. A forward pass only reads the weights; it never changes them. The same input gives the same output every time. Improving the predictions needs training: a loss and a backward pass.",
      "Running it again gives the same numbers, because nothing in a forward pass updates W1, b1, W2 or b2. That is what the next lessons add."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Forward pass or not?</h1>
        <p class="lead">Five situations from other jobs.</p>
        <p class="task">Does a forward pass, written as matrix products layer by layer, do the job as asked? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can trace a forward pass</h1>
      <p class="lead">You computed the shop's ${NIN}-${NH}-${NOUT} network by hand, saw that each layer is <code>X @ W + b</code> followed by ReLU, read every shape from the picture, and found one shape bug that crashed and one that quietly gave three answers.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>predict_wait</code> for a network with a third input and 4 hidden units, with an <code>assert</code> on every shape.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The forward pass gave a wait; next you take one wrong wait and work backwards to see how much each weight is to blame.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Forward pass through a small network",
    checked: "2026-11-13",
    sources: [
      "https://numpy.org/doc/stable/reference/generated/numpy.matmul.html",
      "https://numpy.org/doc/stable/user/basics.broadcasting.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.maximum.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Linear.html"
    ],
    interview: [
      {
        q: "You add a new feature column to the input of a trained model, and the prediction service crashes with a matmul shape error. What happened, and what do you do?",
        good: [
          "The first layer's weight has one row per input feature, so its inner size no longer matches the input's column count",
          "Read the error's two sizes: one is the new feature count, the other the layer's expected input size",
          "Padding the weights with zeros makes it run but ignores the feature; the model needs a new first layer and retraining",
          "Until then, keep the serving input schema identical to training, and check it at the service boundary"
        ],
        weak: "Reshape or transpose the input until the error goes away. That makes numbers flow but gives meaningless predictions."
      },
      {
        q: "Your model returns predictions of shape (32, 32) for a batch of 32, with no error. How do you find the bug?",
        good: [
          "That pattern smells of broadcasting: a (32,) and a (32, 1) array, or a bias with the wrong shape, combined into a grid",
          "Print or assert the shape after every layer and find the first one that differs from (batch, units)",
          "Check biases are flat (units,) and outputs keep the batch as the first size",
          "Add shape asserts in the code so the next slip fails loudly"
        ],
        weak: "Take the diagonal or the mean of the output to get 32 numbers. That hides the bug instead of finding which line made the grid."
      }
    ],
    screens: [handHidden, handOutput, spotIdea, shapes, batch, asCode, brokenLoud, brokenSilent, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]", "#c3 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: [...Array(PRED_AT).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FR.length - 1 - PRED_AT).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
