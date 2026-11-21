/* Lesson: k-nearest neighbours and why scale matters. Story: a plant nursery labels seedlings healthy or weak
   from leaf width, height and leaf count. Ideas: (1) to label a new seedling, find the k labelled seedlings
   closest to it and let them vote; (2) "closest" is a distance over raw numbers, so a column measured in
   bigger units drowns out the others: standardize every column with the training rows' mean and standard
   deviation, then choose k on validation rows.
   Data, all real, from runs on this Mac (Python 3.12, NumPy 2.5.4, see env.txt):
   - docs/ai-path/runs/s2-knn/seedlings.py + seedlings.out.txt: the six labelled seedlings and the new one
     (the lesson recomputes their distances in JS; the run is the check);
   - trace_predict.py + trace_predict.out.txt: the line-by-line trace of predict() on the code screen;
   - nursery.py (invented data, seed 0), choose_k.py + choose_k.out.txt: train and validation accuracy per k;
   - broken_scaling.py + broken_scaling.out.txt: the broken-on-purpose run (validation rows never scaled).
   No model API calls. Lesson-local style: a seedling table with pickable rows (.lx-s2-knn-*), see ensureStyle(). */
(() => {
  const ID = "s2-knn";
  const P = `lx-${ID}-`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const f2 = v => v.toFixed(2);
  const pc = v => `${(Math.round(v * 1000) / 10).toFixed(1)}%`;

  /* ---------- Data ---------- */
  // The story's seedlings, as in docs/ai-path/runs/s2-knn/seedlings.py: leaf width (cm), height (cm), leaf count.
  const SEEDS = [
    { n: "A", w: 3.0, h: 11.5, c: 8, label: "healthy" },
    { n: "B", w: 2.6, h: 12.0, c: 7, label: "healthy" },
    { n: "C", w: 3.1, h: 8.5, c: 9, label: "healthy" },
    { n: "D", w: 1.6, h: 9.2, c: 4, label: "weak" },
    { n: "E", w: 1.9, h: 8.8, c: 4, label: "weak" },
    { n: "F", w: 1.4, h: 10.5, c: 5, label: "weak" }
  ];
  const NEW = { w: 2.8, h: 9.0, c: 7 };
  const K = 3;

  // From docs/ai-path/runs/s2-knn/choose_k.out.txt (240 train, 80 validation, 80 test rows; scaled with the train rows)
  const RUN_K = {
    nTrain: 240, nVal: 80, nTest: 80,
    rows: [[1, 1.0, 0.8], [3, 0.8958, 0.8125], [5, 0.8833, 0.8375], [9, 0.8708, 0.8875], [15, 0.8625, 0.8625],
      [25, 0.875, 0.9], [45, 0.8667, 0.8875], [75, 0.8542, 0.8375], [121, 0.8583, 0.8625], [239, 0.5292, 0.5125]],
    valHealthyShare: 0.5125,
    testAtBest: 0.925,
    unscaledVal: { 1: 0.65, 3: 0.625, 5: 0.5875, 9: 0.625, 15: 0.6125, 25: 0.65, 45: 0.65, 75: 0.6125, 121: 0.525, 239: 0.5125 }
  };
  // From docs/ai-path/runs/s2-knn/broken_scaling.py (the listing) and broken_scaling.out.txt (the output)
  const BROKEN_CODE = [
    "mean = X_train.mean(axis=0)",
    "std = X_train.std(axis=0)",
    "scaled_train = (X_train - mean) / std",
    "for k in [1, 5, 25]:",
    "    pred = knn_predict(scaled_train, y_train, X_val, k)",
    "    print(f\"k={k} val accuracy {acc(pred, y_val):.4f}, predicted healthy {pred.sum()} of {len(pred)}\")"
  ];
  const BROKEN_OUT = [
    "k=1 val accuracy 0.6000, predicted healthy 21 of 80",
    "k=5 val accuracy 0.5125, predicted healthy 80 of 80",
    "k=25 val accuracy 0.5125, predicted healthy 80 of 80"
  ];
  // printed as text by the run, so shown exactly as printed
  const BROKEN_CLUE = { valRow: "[3.1, 92.0, 5.0]", valRowHeight: "92.0", valRowScaled: "[1.35, -0.55, -0.79]", trainMax: "[3.01, 2.27, 1.48]" };
  const FIXED_OUT = [
    "k=1 val accuracy 0.8000, predicted healthy 49 of 80",
    "k=5 val accuracy 0.8375, predicted healthy 44 of 80",
    "k=25 val accuracy 0.9000, predicted healthy 41 of 80"
  ];

  // The listing is predict() from docs/ai-path/runs/s2-knn/trace_predict.py, line for line (line 0 = def).
  const CODE = [
    "def predict(new_seedling, seedlings, labels, k):",
    "    mean, std = seedlings.mean(axis=0), seedlings.std(axis=0)",
    "    scaled = (seedlings - mean) / std",
    "    new_scaled = (new_seedling - mean) / std",
    "    distances = np.sqrt(((scaled - new_scaled) ** 2).sum(axis=1))",
    "    nearest = np.argsort(distances)[:k]",
    "    votes = labels[nearest]",
    "    healthy = int((votes == \"healthy\").sum())",
    "    return \"healthy\" if healthy > k / 2 else \"weak\""
  ];
  // trace_predict.out.txt (height in mm, k = 3): the variable each line created, rounded to 2 places by the run.
  const TRACE = [
    { line: 1, vars: { mean: "[2.27, 100.83, 6.17]", std: "[0.67, 13.41, 1.95]" } },
    { line: 2, vars: { scaled: "[[1.1, 1.06, 0.94], [0.5, 1.43, 0.43], [1.25, -1.18, 1.45], [-1.0, -0.66, -1.11], [-0.55, -0.96, -1.11], [-1.3, 0.31, -0.6]]" } },
    { line: 3, vars: { new_scaled: "[0.8, -0.81, 0.43]" } },
    { line: 4, vars: { distances: "[1.96, 2.26, 1.18, 2.37, 2.05, 2.59]" } },
    { line: 5, vars: { nearest: "[2, 0, 4]" } },
    { line: 6, vars: { votes: "['healthy', 'healthy', 'weak']" } },
    { line: 7, vars: { healthy: "2" } },
    { line: 8, vars: { returned: "'healthy'" } }
  ];

  /* ---------- Derived from the data ---------- */
  const vec = (s, hScale) => [s.w, s.h * hScale, s.c];
  const dist = (a, b) => Math.sqrt(a.reduce((t, v, i) => t + (v - b[i]) ** 2, 0));
  function distances(hScale) {
    const nv = vec(NEW, hScale);
    return SEEDS.map(s => dist(vec(s, hScale), nv));
  }
  const rank = d => d.map((v, i) => i).sort((a, b) => d[a] - d[b]);
  const vote = idx => {
    const h = idx.filter(i => SEEDS[i].label === "healthy").length;
    return { healthy: h, weak: idx.length - h, winner: h > idx.length / 2 ? "healthy" : "weak" };
  };
  function standardize(hScale) {
    const X = SEEDS.map(s => vec(s, hScale));
    const mean = [0, 1, 2].map(j => X.reduce((t, r) => t + r[j], 0) / X.length);
    const std = [0, 1, 2].map(j => Math.sqrt(X.reduce((t, r) => t + (r[j] - mean[j]) ** 2, 0) / X.length)); // ddof = 0
    const z = r => r.map((v, j) => (v - mean[j]) / std[j]);
    const nz = z(vec(NEW, hScale));
    return { mean, std, nz, d: X.map(r => dist(z(r), nz)) };
  }
  const D_CM = distances(1), D_MM = distances(10);
  const TOP_CM = rank(D_CM).slice(0, K), TOP_MM = rank(D_MM).slice(0, K);
  const SC_MM = standardize(10), SC_CM = standardize(1);
  const TOP_SC = rank(SC_MM.d).slice(0, K);
  const BEST = RUN_K.rows.reduce((b, r) => (r[2] > b[2] ? r : b));
  const ROW_K1 = RUN_K.rows[0], ROW_ALL = RUN_K.rows[RUN_K.rows.length - 1];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "style")) return;
    const s = document.createElement("style");
    s.id = P + "style";
    s.textContent = `
      .${P}tab { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .${P}cap { margin: 14px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}row { display: grid; grid-template-columns: 2.6em 1fr 1fr 1fr 1.5fr 1.25fr; align-items: center; gap: 0 6px; width: 100%; min-height: 44px; padding: 6px 8px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--ink); font: 500 15px/1.35 var(--font); text-align: left; }
      .${P}row.${P}nod { grid-template-columns: 2.6em 1fr 1fr 1fr 1.5fr; }
      .${P}row > span { min-width: 0; overflow-wrap: anywhere; }
      .${P}head { font: 600 12.5px/1.3 var(--font); color: var(--muted); min-height: 0; }
      .${P}num { font-family: var(--mono); font-size: 14px; }
      button.${P}row { cursor: pointer; }
      button.${P}row:hover { background: var(--sunk); }
      .${P}row.${P}new { border-left: 3px solid var(--ink); padding-left: 5px; }
      .${P}row.${P}in { background: var(--good-soft); box-shadow: inset 3px 0 0 var(--good); }
      .${P}row.${P}no { background: var(--bad-soft); box-shadow: inset 3px 0 0 var(--bad); }
      .${P}out { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .${P}k { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 10px; padding: 8px 0; border-bottom: 1px solid var(--line); font: 500 14.5px/1.4 var(--mono); }
      .${P}k.${P}head { font: 600 12.5px/1.3 var(--font); }
      .${P}opt { font: 500 13.5px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }
  const unitH = hScale => (hScale === 10 ? "height (mm)" : "height (cm)");
  const hTxt = (h, hScale) => (hScale === 10 ? String(Math.round(h * 10)) : h.toFixed(1));
  // The seedling table. o.d: distances to show (or null); o.pick: rows are buttons; o.mark: { i: "in" | "no" }
  function seedTable(kit, hScale, o = {}) {
    const hasD = !!o.d;
    const rc = `${P}row${hasD ? "" : ` ${P}nod`}`;
    const head = `<div class="${rc} ${P}head"><span>plant</span><span>leaf width (cm)</span><span>${unitH(hScale)}</span><span>leaves</span><span>label</span>${hasD ? "<span>distance</span>" : ""}</div>`;
    const cells = (name, s, label, d) => `<span><b>${kit.esc(name)}</b></span><span class="${P}num">${s.w.toFixed(1)}</span><span class="${P}num">${hTxt(s.h, hScale)}</span><span class="${P}num">${s.c}</span><span>${kit.esc(label)}</span>${hasD ? `<span class="${P}num">${d == null ? "" : f2(d)}</span>` : ""}`;
    const rows = SEEDS.map((s, i) => {
      const m = o.mark && o.mark[i] ? ` ${P}${o.mark[i]}` : "";
      const attrs = o.pick ? ` data-i="${i}"${o.right && o.right.includes(i) ? " data-right" : ""}${o.wrongAt === i ? " data-wrong" : ""}` : "";
      return o.pick
        ? `<button type="button" class="${rc}${m}"${attrs} aria-pressed="${o.mark && o.mark[i] === "in" ? "true" : "false"}">${cells(s.n, s, s.label, hasD ? o.d[i] : null)}</button>`
        : `<div class="${rc}${m}">${cells(s.n, s, s.label, hasD ? o.d[i] : null)}</div>`;
    }).join("");
    const nw = `<div class="${rc} ${P}new">${cells("new", NEW, "?", null)}</div>`;
    return `<div class="${P}tab">${head}${rows}${nw}</div>`;
  }
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const voteTxt = v => `${plural(v.healthy, "healthy vote")}, ${plural(v.weak, "weak vote")}: <b>${v.winner}</b>`;

  /* 1. The situation, and one distance by hand. */
  function oneDistance({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const C = SEEDS[2];
    const dw = Math.abs(NEW.w - C.w), dh = Math.abs(NEW.h - C.h), dc = Math.abs(NEW.c - C.c);
    const sq = dw ** 2 + dh ** 2 + dc ** 2;
    const opts = [f2(sq), f2(Math.sqrt(sq)), f2(dw + dh + dc), f2(Math.max(dw, dh, dc))];
    const RIGHT = 1;
    const fb = [
      [`That is the sum of the squared differences, ${f2(dw ** 2)} + ${f2(dh ** 2)} + ${f2(dc ** 2)}. You stopped one step early: the distance is the square root of that sum.`, false],
      [`Right: the differences are ${f2(dw)}, ${f2(dh)} and ${f2(dc)}; squared and added they make ${f2(sq)}; the square root is ${f2(Math.sqrt(sq))}. That is the straight-line (Euclidean) distance from the vectors lesson, now with three columns instead of two. The smaller it is, the more alike the two plants are on paper.`, true],
      [`That adds the differences without squaring them (${f2(dw)} + ${f2(dh)} + ${f2(dc)}). That is a real distance too, but not the straight-line one. Square each difference, add, then take the root.`, false],
      [`That is only the biggest single difference, the leaf count. The distance uses every column: square each difference, add them all, take the root.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Healthy or weak?</h1>
        <p class="lead">A plant nursery sorts seedlings before they go on sale. Staff have already labelled six of them by eye. A new tray arrives and nobody has time to judge every plant. The plan: describe each plant with three numbers, and call a new plant healthy if it looks, in numbers, like the healthy ones. This is classification: giving a new item a label, learned from items people already labelled.</p>
        ${seedTable(kit, 1)}
        <p class="task">How far is the new seedling from seedling ${C.n}? Treat each plant as a vector of three numbers and use the straight-line distance.</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* Pick the three nearest seedlings in a table with distances (used for cm and for mm). */
  function pickNearest(kit, el, done, hScale, D, TOP, title, lead, after) {
    const got = new Set();
    let wrong = null;
    const order = rank(D);
    const wrongAt = SEEDS.findIndex((_, i) => !TOP.includes(i));
    const paint = () => {
      const mark = {};
      got.forEach(i => { mark[i] = "in"; });
      if (wrong != null) mark[wrong] = "no";
      const finished = got.size === K;
      const fbw = wrong == null ? "" : kit.feedback(`${SEEDS[wrong].n} is ${f2(D[wrong])} away. ${plural(order.indexOf(wrong), "seedling")} ${order.indexOf(wrong) === 1 ? "is" : "are"} closer than that, so ${SEEDS[wrong].n} is not among the ${K} nearest. Its label does not matter yet: first find the nearest, then look at their labels.`, false);
      el.innerHTML = `<h1>${title}</h1>
        <p class="lead">${lead}</p>
        <p class="task">Tap the ${K} seedlings nearest to the new one.</p>
        ${seedTable(kit, hScale, { d: D, pick: true, mark, right: TOP, wrongAt })}
        <div class="lpanel">${finished ? kit.feedback(after(vote(TOP)), true) : fbw || (got.size ? kit.feedback(`${got.size} of ${K} found.`) : "")}</div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (got.size === K) return;
        if (TOP.includes(i)) { got.add(i); wrong = null; } else wrong = i;
        paint();
        if (got.size === K) done();
      });
    };
    paint();
  }

  /* 2. Vote with k = 3, height in cm. */
  function voteCm({ el, done, kit }) {
    ensureStyle();
    pickNearest(kit, el, done, 1, D_CM, TOP_CM, "Let the nearest three vote",
      "Doing the same sum for every labelled seedling gives the distances in the last column. The rule the nursery will use: take the three nearest labelled seedlings and give the new one the label most of them have.",
      v => `Right: ${TOP_CM.map(i => SEEDS[i].n).join(", ")}. ${voteTxt(v)}. You just ran <b>k-nearest neighbours</b> (kNN) with k = ${K}: no formula was learned, the labelled plants themselves are the model, and a new plant gets the majority label of its k nearest.`);
  }

  /* 3. The same plants, height in mm. */
  function voteMm({ el, done, kit }) {
    ensureStyle();
    const vc = vote(TOP_CM).winner, vm = vote(TOP_MM).winner;
    pickNearest(kit, el, done, 10, D_MM, TOP_MM, "A new ruler",
      "The nursery buys a new measuring board that reads in millimetres. Same plants, same new seedling. Only the height column changed: every height is now ten times its old number.",
      v => `Right: ${TOP_MM.map(i => SEEDS[i].n).join(", ")}. ${voteTxt(v)}. With centimetres the vote said ${vc}; with millimetres it says ${vm}. Nothing about any plant changed.`);
  }

  /* 4. Spot the idea: why did the vote flip? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const A = SEEDS[0];
    const dhA = Math.abs(NEW.h - A.h) * 10, dcA = Math.abs(NEW.c - A.c), dwA = Math.abs(NEW.w - A.w);
    const share = dhA ** 2 / (dhA ** 2 + dcA ** 2 + dwA ** 2);
    const opts = [
      "Millimetres are more precise, so the second vote is the true one",
      "In millimetres the height differences are bigger numbers, so they outweigh leaf width and leaf count in the sum",
      `k = ${K} is too small; with more neighbours both votes would agree`,
      "Height matters more for health than leaf count, and the new unit shows it"
    ];
    const RIGHT = 1;
    const fb = [
      ["Both readings are the same heights, written with different numbers. A plant is not healthier because you measured it in a finer unit. If the answer depends on the unit, the method has a problem, not the plant.", false],
      [`Right. For seedling A, the height difference is now ${dhA.toFixed(0)}, against ${f2(dwA)} for leaf width and ${dcA} for leaf count. Squared, height makes up ${pc(share)} of the sum. The distance now mostly measures height, and only because of the unit. kNN has no idea what a column means; it adds raw numbers. So before measuring distance, put every column on the same scale.`, true],
      ["k decides how many neighbours vote, but the problem is which seedlings count as neighbours at all. In millimetres the nearest ones are simply the ones of similar height. More votes from the wrong neighbours do not fix that.", false],
      ["Nothing about health changed between the two tables, only the unit. The new unit did not reveal anything; it made height count ten times more in every difference, by accident.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Same plants, different answer</h1>
        <p class="lead">With heights in centimetres, the three nearest voted ${vote(TOP_CM).winner}. With heights in millimetres, they voted ${vote(TOP_MM).winner}.</p>
        <p class="task">Why did the answer change?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Standardize: predict the scaled height of the new seedling. */
  function standardizeScreen({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const m = SC_MM.mean[1], s = SC_MM.std[1], hn = NEW.h * 10;
    const z = (hn - m) / s;
    const opts = [f2(hn - m), f2(z), f2((m - hn) / s), f2(hn / s)];
    const RIGHT = 1;
    const same = SC_MM.d.every((v, i) => Math.abs(v - SC_CM.d[i]) < 1e-9);
    const fb = [
      [`That is only the first half: ${hn} − ${f2(m)}. It says how far from the average the plant is, but still in millimetres. Divide by the spread (${f2(s)}) to get a number without a unit.`, false],
      [`Right: (${hn} − ${f2(m)}) / ${f2(s)} = ${f2(z)}. The new seedling is about ${f2(Math.abs(z))} spreads ${z < 0 ? "shorter" : "taller"} than the average labelled one. Do the same to every column, and every column is now “how many spreads from the average”. The distances after scaling: ${SEEDS.map((x, i) => `${x.n} ${f2(SC_MM.d[i])}`).join(", ")}. The three nearest are ${TOP_SC.map(i => SEEDS[i].n).join(", ")}: ${voteTxt(vote(TOP_SC))}. ${same ? "And here is the point: scale the centimetre table the same way and you get exactly the same distances. The unit no longer matters." : ""}`, true],
      [`The sign is flipped: that is mean minus height. The new seedling (${hn} mm) is below the average (${f2(m)} mm), so its scaled height must be negative.`, false],
      [`That divides the raw height by the spread but skips subtracting the average. Every scaled value would then still depend on where zero is on the ruler. Subtract the mean first.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Put every column on one scale</h1>
        <p class="lead">The fix is called <b>standardizing</b>. For each column, take the six labelled seedlings' average (mean) and their typical distance from it (standard deviation, the spread). Then replace each value by <code>(value − mean) / spread</code>. Use the labelled seedlings' numbers for the new seedling too: it is scaled with the same ruler.</p>
        <p class="lead">Height in millimetres, labelled seedlings: mean <b>${f2(m)}</b>, spread <b>${f2(s)}</b>. The new seedling is <b>${hn}</b> mm.</p>
        <p class="task">What is the new seedling's scaled height?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. The same steps in Python: a stepped replay of the traced run. */
  const tv = name => JSON.parse(TRACE.find(t => name in t.vars).vars[name].replace(/'/g, "\""));
  const sayFrame = f => {
    const std = tv("std"), nearest = tv("nearest"), healthy = tv("healthy");
    return ({
      1: `The highlighted line takes the mean and the spread of each column over the labelled seedlings. The spreads are ${std.join(", ")}: height's is far bigger than the others only because of its unit.`,
      2: "Next, every labelled seedling is scaled. Every column is now in “spreads from the mean”, so all three columns sit in a similar range.",
      3: "The new seedling is scaled with the same mean and spread. Same ruler, or the distances mean nothing.",
      4: "This line is the distance you worked out by hand, for all six seedlings at once: subtract, square, add across the row, square root.",
      5: `<code>argsort</code> gives the positions that would sort the distances; <code>[:k]</code> keeps the first ${K}: rows ${nearest.join(", ")} (counting from 0), that is ${nearest.map(i => SEEDS[i].n).join(", ")}.`,
      6: "This line looks up their labels.",
      7: `This line counts the healthy votes: ${healthy} of ${K}.`,
      8: `The last line: ${healthy} is more than ${K} / 2, so the answer is ${tv("returned")}, the same as the scaled vote on the previous screen. The three scaling lines at the top made the unit stop mattering. No training step happened anywhere; the labelled data is used at prediction time.`
    })[f.line];
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = TRACE[i];
      el.innerHTML = `<h1>kNN in nine lines of NumPy</h1>
        <p class="lead">This function ran on the six seedlings with heights in millimetres and k = ${K}. <code>seedlings</code> is a 6 × 3 array, <code>labels</code> an array of six words.</p>
        <p class="task">Step through to the end. Watch which lines take the unit out of the distance.</p>
        ${kit.code(CODE, f.line)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${Object.entries(f.vars).map(([name, val]) => `<span>${kit.esc(name)} <b>${kit.esc(val)}</b></span>`).join("")}<span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 7. Choose k by validation. */
  function chooseK({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const best = BEST[0];
    const close = RUN_K.rows.filter(r => r !== BEST && Math.round((BEST[2] - r[2]) * RUN_K.nVal) <= 1).map(r => r[0]);
    const opts = [`k = ${ROW_K1[0]}`, `k = ${best}`, `k = ${ROW_ALL[0]}`, "The k with the best train accuracy"];
    const RIGHT = 1;
    const fb = [
      [`k = 1 scores ${pc(ROW_K1[1])} on the train rows because every train row's nearest neighbour is itself, at distance 0. That says nothing about new plants. On validation it scored ${pc(ROW_K1[2])}: one odd neighbour decides alone.`, false],
      [`Right: ${pc(BEST[2])} on validation, the best in the table. Note how flat the curve is near it: k = ${close.join(" and ")} ${close.length === 1 ? "is" : "are"} within one validation plant of it, so with only ${RUN_K.nVal} validation rows, any k in that middle range is a fair choice (cross-validation would give a steadier answer). Then, once, score the untouched test rows at k = ${best}: ${pc(RUN_K.testAtBest)}. That is the number you report. And the same k on unscaled columns (height in mm) scored only ${pc(RUN_K.unscaledVal[best])} on validation.`, true],
      [`k = ${ROW_ALL[0]} is all but one of the ${RUN_K.nTrain} train rows, so every new plant gets the same answer: the most common label. Validation ${pc(ROW_ALL[2])}, which is just the share of healthy plants (${pc(RUN_K.valHealthyShare)}). With that many neighbours, the plants close to the new one no longer decide anything.`, false],
      [`Train accuracy is highest at k = 1, for a useless reason: each train row finds itself. Choose k on rows the model has not seen, the validation rows.`, false]
    ];
    const head = `<div class="${P}k ${P}head"><span>k</span><span>train accuracy</span><span>validation accuracy</span></div>`;
    const paint = () => {
      el.innerHTML = `<h1>How many neighbours?</h1>
        <p class="lead">A bigger set of nursery records (invented for this lesson by a script): ${RUN_K.nTrain} labelled seedlings to search, ${RUN_K.nVal} for validation, ${RUN_K.nTest} kept back for the test. All columns scaled with the train rows' mean and spread. The same kNN ran with each k:</p>
        <div class="${P}tab">${head}${RUN_K.rows.map(r => `<div class="${P}k"><span>${r[0]}</span><span>${pc(r[1])}</span><span>${pc(r[2])}</span></div>`).join("")}</div>
        <p class="${P}cap">From a run of the code in this lesson on invented nursery data (seed 0).</p>
        <p class="task">Which k do you choose?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. Broken on purpose: validation rows never scaled. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const lineOpt = j => `<span class="${P}opt">${kit.esc(BROKEN_CODE[j].trim())}</span>`;
    const Q = [
      { right: 3, opts: [lineOpt(0), lineOpt(1), lineOpt(2), lineOpt(4)],
        fb: [
          ["The mean of the train rows is exactly what you should scale with. Nothing is wrong with computing it.", false],
          ["The spread of the train rows is right too. These two numbers are the ruler; the question is what gets measured with it.", false],
          ["Scaling the train rows is correct. The trouble is that they are now in “spreads from the mean” and something else is not.", false],
          null] },
      { right: 1, opts: ["Scale X_val with its own mean and spread", "Scale X_val with the train rows' mean and spread", "Drop the scaling and use raw columns everywhere"],
        fb: [
          ["Then the validation rows are measured with a different ruler from the train rows, and in real use you could not even do it: one new seedling has no spread. Use the numbers from the train rows.", false],
          null,
          [`That makes train and validation agree again, but you are back to unscaled distances where height in mm dominates: ${pc(RUN_K.unscaledVal[25])} on validation at k = 25 in the earlier run.`, false]] }
    ];
    const fixed = `<div class="${P}out">${kit.esc(FIXED_OUT.join("\n"))}</div>`;
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      const task = stage === 0 ? "Which line causes it?" : "What is the fix?";
      el.innerHTML = `<h1>Broken on purpose: ${pc(RUN_K.valHealthyShare)} after scaling</h1>
        <p class="lead">A colleague scaled the columns, as you did, then checked kNN on the ${RUN_K.nVal} validation rows. This is the code and what it printed:</p>
        ${kit.code(BROKEN_CODE, stage >= 1 ? 4 : -1)}
        <div class="${P}out">${kit.esc(BROKEN_OUT.join("\n"))}</div>
        <p class="lead">For a hint, the first validation row, before any scaling, is <code>${kit.esc(BROKEN_CLUE.valRow)}</code>. The largest value in each column of <code>scaled_train</code> is <code>${kit.esc(BROKEN_CLUE.trainMax)}</code>.</p>
        ${stage < 2 ? `<p class="task">${task}</p>` : ""}
        <div class="lpanel">${stage < 2
          ? `${stage === 1 ? kit.feedback(`Right. That line passes <code>X_val</code>, the raw rows: a height of ${BROKEN_CLUE.valRowHeight} mm is compared with train heights that are now a few units either side of 0. Every validation plant is far from everything, so they all end up next to the same few train plants. At k = 5 and k = 25 they all get the same answer: “predicted healthy 80 of 80”, and the accuracy is just the share of healthy plants.`, true) : ""}${ask(kit, q.opts, q.right, ans, q.fb)}`
          : kit.feedback(`Right: <code>scaled_val = (X_val - mean) / std</code>, with the train rows' numbers, and pass <code>scaled_val</code>. The first validation row becomes <code>${kit.esc(BROKEN_CLUE.valRowScaled)}</code>, in the same range as the train rows. The rerun printed:${fixed}The rule: work out the scaling from the train rows once, keep it, and apply it to every row you ever predict, validation, test and live plants alike.`, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Training time: it has to learn from far more plants", "Every single prediction: it compares the new plant with every stored one", "Nothing: more data only makes kNN better"];
    const RIGHT = 1;
    const fb = [
      ["kNN has no training step to slow down. It only stores the labelled rows. Look at what happens each time a plant needs a label.", false],
      ["Right. The work happens at prediction time: in the plain version, one distance per stored plant, for every new plant, and all the rows must be kept in memory. Search indexes (tree-shaped data structures) can speed the search up when there are few columns, but the cost still sits at prediction time.", true],
      ["More nearby examples can help accuracy, but each answer now needs a distance to every stored plant. That cost arrives on every prediction, forever.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for kNN</h1>
        <p class="lead"><b>What it is for:</b> labelling a new thing by its most similar labelled things, with a handful of numeric columns where “close” means “alike”.</p>
        <p class="lead"><b>Reach for it</b> as a quick first model to compare others against, when data is small, or when you want to show the neighbours as the reason for an answer.</p>
        <p class="lead"><b>Not</b> with many columns: kNN then works less well (this is called the “curse of dimensionality”). Not when columns are codes rather than amounts. For big tables, a trained model (logistic regression, boosted trees) answers faster.</p>
        <p class="lead"><b>Costs:</b> no training, but every prediction searches the stored data. You must scale the columns and keep the scaling numbers (the train rows' mean and spread). Choosing k takes a validation run.</p>
        <p class="task">The nursery grows to millions of labelled plants and wants an answer while a worker holds the tray. What gets slower?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A wine shop wants to suggest the five wines most like a customer's favourite, from acidity, sweetness, alcohol percentage and price.", true,
      "Yes, with scaling. A few numeric columns where small differences mean similar wines. Price runs into the tens while acidity changes in small steps, so standardize first or price alone picks the neighbours.",
      "This is the shape kNN is for: a handful of numeric columns where near means alike. Scale the columns first, because price would otherwise decide everything."],
    ["A courier firm wants to predict whether a parcel arrives late from its postcode, stored as a number like 10001, and its weight.", false,
      "No, not with that column. Postcode 10001 and 10002 are close as numbers but may be far apart on the map, and 10001 and 90001 are not “far” in any useful way. A distance on a code measures nothing. Turn the code into real features (distance from the depot, region) or use a model that treats it as a category.",
      "kNN adds up numeric differences. A postcode is a name written in digits: the difference between two codes means nothing, so the neighbours it finds are random. The idea fails here because “close” is not “alike”."],
    ["A lab has 40 labelled plants, each described by 2,000 gene measurements, and wants to label new plants.", false,
      "No. With 2,000 columns and 40 rows, each distance is a sum of 2,000 differences, most of them unrelated to health, so the nearest plants are not reliably the most alike. This is the curse of dimensionality. Scaling does not fix it; cut the columns down first, or use a model that picks out the few columns that matter.",
      "Scaling makes the columns fair, but with 2,000 of them each distance is a sum of 2,000 small differences, mostly noise, so the nearest plant is not reliably the most alike. kNN needs few columns that matter."],
    ["A bike repair shop sorts incoming bikes into quick fix or long job from tyre wear (mm), chain stretch (%) and age (years), with 1,500 past jobs labelled.", true,
      "Yes. Three numeric columns, a modest number of past jobs, and similar bikes really do need similar work. Standardize the three columns with the past jobs' numbers and choose k on held-out jobs.",
      "Few numeric columns, labelled past cases, and near really means alike: that is kNN's home ground. Just scale the columns, since millimetres, percent and years are on different scales."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>kNN or not?</h1>
        <p class="lead">Four requests from other teams. kNN means: label a new item by a vote of its k nearest labelled items, by distance over scaled columns.</p>
        <p class="task">Would you use kNN for each one? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>Neighbours, scaled</h1>
      <p class="lead">You labelled a seedling by a vote of its ${K} nearest, saw a change of unit flip the vote, fixed it by standardizing every column with the labelled rows' mean and spread, chose k on validation rows, and found a bug where the validation rows were never scaled.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the kNN prediction in NumPy, scale with the train rows' numbers, and pick k on a validation split.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. kNN needs numeric columns where distance means something; next you label text, where the columns are word counts and a different idea, counting and multiplying probabilities, does the work.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "k-nearest neighbours and why scale matters",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/neighbors.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html",
      "https://scikit-learn.org/stable/auto_examples/preprocessing/plot_scaling_importance.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.KNeighborsClassifier.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.argsort.html"
    ],
    interview: [
      {
        q: "Your kNN classifier scored well in the notebook, but in production it gives almost the same label to every request. What do you check?",
        good: [
          "Whether incoming rows are scaled at all, and with the training mean and spread rather than their own",
          "Whether a column's unit or format changed upstream, such as millimetres instead of centimetres",
          "Compare one live row with the training rows' ranges: if it is far outside them, it is a scaling or unit problem",
          "Save the scaler with the model and apply both in one pipeline so they cannot drift apart"
        ],
        weak: "Retrain with more data or a different k. That misses that the distances themselves are broken before k ever matters."
      },
      {
        q: "You have a working kNN model on 5,000 rows. The business wants it on 50 million rows with sub-second answers. What do you say?",
        good: [
          "kNN does its work at prediction time: each answer searches the stored rows, so cost grows with the data",
          "All rows must be kept in memory or in an index",
          "Index structures help with few columns, less as columns grow",
          "A trained model such as logistic regression or boosted trees has a prediction cost that does not grow with the training rows; compare it on validation"
        ],
        weak: "Say kNN has no training so it scales well. Training is free, but every prediction pays instead."
      }
    ],
    screens: [oneDistance, voteCm, voteMm, spotIdea, standardizeScreen, asCode, chooseK, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: TOP_CM.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: TOP_MM.map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
