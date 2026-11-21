/* Lesson: linear regression from scratch, then in scikit-learn. Story: a freight broker estimates the cost of a
   shipment from its weight, distance and volume before quoting a client.
   Ideas: (1) with several inputs the model is one weight per input plus a base, fitted by the same gradient
   descent as for one slope, done for all columns at once (shipments @ w, shipments.T @ err); (2) a weight is a
   price per ONE unit, so weights can only be compared, and gradient descent only works with one step size, once
   the inputs are on the same scale; scikit-learn's LinearRegression solves least squares directly and gets the
   same weights without a step size.
   Data, all real runs on this Mac (docs/ai-path/runs/s2-linear-regression/, seed 0, env.txt):
   - make_data.py -> shipments.csv: 200 made-up past shipments (a price rule plus random noise of size 15);
   - fit_scratch.py + fit_scratch.out.txt: the `fit` listing traced line by line (lr 0.1, 200 steps, standardized);
   - raw_gd.py + raw_gd.out.txt: the same loop on raw kg, km, m3 (lr 0.1, then lr 1e-7);
   - sklearn_fit.py + sklearn_fit.out.txt: LinearRegression on raw and on standardized inputs, and one quote;
   - collinear.py + collinear.out.txt: a near-copy column (billed_kg) added, fitted on two halves.
   No recorded model calls. Lesson-local style: a data table and an output block (.lx-s2-linear-regression-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s2-linear-regression";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const f = (x, d) => Number(x).toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });
  const money = x => "$" + f(x, 2);

  /* ---------- Data copied from the runs ---------- */
  const INPUTS = [
    { key: "weight_kg", name: "shipment weight", unit: "kg" },
    { key: "distance_km", name: "distance", unit: "km" },
    { key: "volume_m3", name: "volume", unit: "m³" }
  ];
  const N_ROWS = 200; // make_data.out.txt "rows 200"
  // make_data.out.txt, "first 6": [kg, km, m3, cost]
  const FIRST6 = [[1292, 269, 2.6, 322], [576, 166, 11.3, 270], [130, 545, 1.3, 371], [82, 172, 0.3, 154], [1636, 471, 4.0, 469], [1830, 490, 11.9, 592]];
  const NOISE_SD = 15; // make_data.py: noise = rng.normal(0, 15, n)
  // fit_scratch.out.txt
  const MEAN = [1102.24, 426.94, 6.273];
  const STD = [587.6722, 224.5729, 3.1659];
  const LR = 0.1, STEPS = 200; // fit_scratch.py: trace_run(fit, Xs, y, 0.1, 200, ...)
  const SCRATCH_RAW = { w: [0.081358, 0.597242, 8.759742], b: 35.3723 }; // "w (per kg, per km, per m3)", "b (raw units)"
  // sklearn_fit.out.txt
  const SK = { coef: [0.081358, 0.597242, 8.759742], intercept: 35.3723, quote: 353.29, coefS: [47.8119, 134.1244, 27.7321], interceptS: 434.985 };
  const NEW_SHIP = [800, 350, 5.0]; // sklearn_fit.py new_shipment
  const SK_OUT = [
    "coef_ [0.081358 0.597242 8.759742]",
    "intercept_ 35.3723",
    "quote [353.29]"
  ];
  // The listing is `fit` from fit_scratch.py, line for line (line 0 = def).
  const CODE = [
    "def fit(shipments, costs, lr, steps):",
    "    n, k = shipments.shape",
    "    w = np.zeros(k)",
    "    b = 0.0",
    "    for step in range(steps):",
    "        pred = shipments @ w + b",
    "        err = pred - costs",
    "        loss = (err ** 2).mean()",
    "        w = w - lr * 2 * shipments.T @ err / n",
    "        b = b - lr * 2 * err.mean()",
    "    return w, b"
  ];
  // Frames from fit_scratch.out.txt: [line that just ran, event (l/r), step, w, b, loss]. All lines of steps 0 and 1,
  // then the end of steps 9, 49, 99 and 199 (the frames in between were cut), then the return.
  const FR = [[1,"l",null,null,null,null],[2,"l",null,[0.0,0.0,0.0],null,null],[3,"l",null,[0.0,0.0,0.0],0.0,null],[4,"l",0,[0.0,0.0,0.0],0.0,null],[5,"l",0,[0.0,0.0,0.0],0.0,null],[6,"l",0,[0.0,0.0,0.0],0.0,null],[7,"l",0,[0.0,0.0,0.0],0.0,209920.255],[8,"l",0,[8.3128,26.3632,5.8315],0.0,209920.255],[9,"l",0,[8.3128,26.3632,5.8315],86.997,209920.255],[4,"l",1,[8.3128,26.3632,5.8315],86.997,209920.255],[5,"l",1,[8.3128,26.3632,5.8315],86.997,209920.255],[6,"l",1,[8.3128,26.3632,5.8315],86.997,209920.255],[7,"l",1,[8.3128,26.3632,5.8315],86.997,134601.6883],[8,"l",1,[15.2072,47.5333,10.4448],86.997,134601.6883],[9,"l",1,[15.2072,47.5333,10.4448],156.5946,134601.6883],[9,"l",9,[40.9538,119.0047,25.1765],388.2788,4060.5357],[9,"l",49,[47.8099,134.1217,27.7321],434.9788,232.6964],[9,"l",99,[47.8119,134.1244,27.7321],434.985,232.6963],[9,"l",199,[47.8119,134.1244,27.7321],434.985,232.6963],[10,"r",199,[47.8119,134.1244,27.7321],434.985,232.6963]];
  // raw_gd.out.txt, verbatim
  const RAW_FAST = [
    "lr=0.1 step 0: loss 209920  w [0. 0. 0.]  b 0",
    "lr=0.1 step 1: loss 2.03052e+16  w [100776.756  43062.963    564.194]  b 87",
    "lr=0.1 step 2: loss 2.36373e+27  w [-3.5444e+10 -1.1355e+10 -1.6317e+08]  b -2.589e+07",
    "lr=0.1 step 3: loss 2.75299e+38  w [1.2114e+16 3.8173e+15 5.5356e+13]  b 8.783e+12",
    "lr=0.1 step 4: loss 3.20635e+49  w [-4.1347e+21 -1.3017e+21 -1.8886e+19]  b -2.997e+18",
    "lr=0.1 step 5: loss 3.73438e+60  w [1.4111e+27 4.4423e+26 6.4451e+24]  b 1.023e+24"
  ];
  const RAW_SLOW = [
    "lr=1e-07 step 0: loss 209920  w [0. 0. 0.]  b 0",
    "lr=1e-07 step 1: loss 110119  w [0.1008 0.0431 0.0006]  b 8.7e-05",
    "lr=1e-07 step 10: loss 25752.1  w [0.2701 0.1899 0.0022]  b 0.0003265",
    "lr=1e-07 step 100: loss 2952.91  w [0.1501 0.5875 0.0072]  b 0.0008835",
    "lr=1e-07 step 1000: loss 1922.77  w [0.1174 0.6909 0.0351]  b 0.00286",
    "lr=1e-07 step 2000: loss 1913.59  w [0.1173 0.6907 0.0653]  b 0.004945"
  ];
  // collinear.out.txt: [label, coef_, rmse on all 200]
  const COLL_R = 0.99972;
  const COLL = [
    ["3 inputs, first 100", [0.083, 0.5949, 8.6051], 15.31],
    ["3 inputs, last 100", [0.0799, 0.599, 8.8806], 15.30],
    ["4 inputs, first 100", [0.0451, 0.5951, 8.5782, 0.0379], 15.33],
    ["4 inputs, last 100", [0.1799, 0.5991, 8.8625, -0.0999], 15.31]
  ];

  /* ---------- Derived from the data ---------- */
  const SPREAD_EFFECT = SK.coef.map((w, j) => w * STD[j]); // cost change for one typical spread of each input
  const argmax = a => a.indexOf(Math.max(...a));
  const BIG_RAW = argmax(SK.coef), BIG_STD = argmax(SPREAD_EFFECT);
  const QUOTE = SK.intercept + sum(SK.coef.map((w, j) => w * NEW_SHIP[j]));
  const parseLine = s => {
    const m = s.match(/step (\d+): loss (\S+)\s+w \[([^\]]*)\]\s+b (\S+)/);
    return { step: +m[1], loss: +m[2], w: m[3].trim().split(/\s+/).map(Number), b: +m[4] };
  };
  const FAST = RAW_FAST.map(parseLine), SLOW = RAW_SLOW.map(parseLine);
  const SLOW_END = SLOW[SLOW.length - 1];
  const SLOW_RATIO = SK.coef.map((w, j) => SLOW_END.w[j] / w); // how far each weight got, as a share of the fitted one
  const FAR = SLOW_RATIO.indexOf(Math.min(...SLOW_RATIO));
  const FINAL = FR[FR.length - 1];
  const FIRST_UPDATE = FR.find(r => r[0] === 8 && r[2] === 0);
  const FINAL_LOSS = FINAL[5];
  const TYPICAL_MISS = Math.sqrt(FINAL_LOSS);
  const ROUND_MATCH = SK.coef.every((w, j) => w === SCRATCH_RAW.w[j]) && SK.intercept === SCRATCH_RAW.b;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-wrap { margin: 14px 0 0; overflow-x: auto; }
      .lx-${ID}-tbl { border-collapse: collapse; width: 100%; font-size: 15px; }
      .lx-${ID}-tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .lx-${ID}-tbl th { text-align: right; font: 600 12.5px/1.3 var(--mono); color: var(--muted); padding: 6px 8px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-tbl th:first-child, .lx-${ID}-tbl td:first-child { text-align: left; }
      .lx-${ID}-tbl td { text-align: right; padding: 7px 8px; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; color: var(--ink); }
      .lx-${ID}-tbl tr.lx-${ID}-hit td { font-weight: 700; }
      .lx-${ID}-tbl tr.lx-${ID}-hit td:first-child { box-shadow: inset 3px 0 0 var(--ink); }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; font: 500 13px/1.6 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-step { margin-top: 18px; }
      @media (max-width: 520px) { .lx-${ID}-tbl { font-size: 14px; } .lx-${ID}-tbl th, .lx-${ID}-tbl td { padding: 6px 5px; } }
      @media (max-width: 420px) { .lx-${ID}-code .lcode { font-size: 11.5px; } .lx-${ID}-code .lcode div { padding: 0 8px; } }
    `;
    document.head.appendChild(s);
  }
  // head: [..], rows: [[..]], hit: row index to mark
  function tbl(kit, head, rows, { caption = "", hit = -1 } = {}) {
    return `<div class="lx-${ID}-wrap"><table class="lx-${ID}-tbl">${caption ? `<caption>${kit.esc(caption)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === hit ? ` class="lx-${ID}-hit"` : ""}>${r.map(c => `<td>${kit.esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const codeBox = (kit, lines, active) => `<div class="lx-${ID}-code">${kit.code(lines, active)}</div>`;
  const out = (kit, lines, cap) => `<div class="lx-${ID}-out">${kit.esc(lines.join("\n"))}</div>${cap ? `<p class="lx-${ID}-cap">${kit.esc(cap)}</p>` : ""}`;
  const ask = (kit, opts, correct, picked, fb) => `${kit.options(opts, { picked, correct })}${picked == null || !fb[picked] ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const shipRows = rows => rows.map(r => [f(r[0], 0), f(r[1], 0), f(r[2], 1), "$" + f(r[3], 0)]);
  const SHIP_HEAD = ["weight kg", "distance km", "volume m³", "cost"];
  const perUnit = j => `per ${INPUTS[j].unit}`;
  const vec = w => "[" + w.map(x => f(x, 2)).join(", ") + "]";

  /* 1. The situation, and the by-hand prediction: which input gets the largest weight? */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = INPUTS.map((x, j) => `${x.name}: dollars ${perUnit(j)}`);
    const fb = INPUTS.map((x, j) => j === BIG_RAW
      ? [`Right. The fitted numbers on all ${N_ROWS} shipments:${tbl(kit, ["", "symbol", "fitted value"], [["base", "b", money(SK.intercept)], ...INPUTS.map((y, i) => [y.name, `w${i + 1}`, `$${f(SK.coef[i], 4)} ${perUnit(i)}`])], { hit: BIG_RAW + 1 })}One more ${x.unit} adds about ${money(SK.coef[j])}; one more kg adds about ${f(SK.coef[0] * 100, 0)} cents. One cubic metre is a lot of freight, one kilogram is very little, so a price <b>per unit</b> is big for big units. Later in this lesson you fit these numbers yourself.`, true]
      : [`One ${x.unit} is a ${j === 0 ? "very small amount: a parcel weighs dozens of them, a pallet hundreds" : "small step: a trip is hundreds of them"}. The weight is the price of <b>one</b> more ${x.unit}, so it must be small, or a ${j === 0 ? "1,000 kg" : "500 km"} shipment would cost a fortune. Look at the size of one unit of each input in the table.`, false]);
    const paint = () => {
      el.innerHTML = `<h1>Quote before the truck moves</h1>
        <p class="lead">Mira is a freight broker. A client sends a shipment's weight, distance and volume, and wants a price within the hour. If she quotes too low she loses money on the haul; too high and the client books someone else. She has the real costs of ${N_ROWS} past shipments. (We made them up for this lesson from a price rule plus random noise, so a good answer exists.) The first six:</p>
        ${tbl(kit, SHIP_HEAD, shipRows(FIRST6))}
        <p class="lead">Her plan: <b>cost ≈ base + w1 × kg + w2 × km + w3 × m³</b>. Each <b>weight</b> w is the dollars that <b>one more unit</b> of its input adds. Fitting means finding the base and the three weights that miss the past costs the least. This kind of model is called <b>linear regression</b>. It is the usual first model whenever a product must predict a number.</p>
        <p class="task">Before any fitting: which of the three weights will come out as the largest number?</p>
        <div class="lpanel">${ask(kit, opts, BIG_RAW, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === BIG_RAW) done(); });
    };
    paint();
  }

  /* 2. Spot the idea: a big weight is not a big effect; compare on one scale. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `${INPUTS[BIG_RAW].name}: it has the largest weight`,
      ...INPUTS.map((x, j) => j).filter(j => j !== BIG_RAW).map(j => INPUTS[j].name),
      "You cannot tell from these numbers"
    ];
    const order = [BIG_RAW, ...INPUTS.map((x, j) => j).filter(j => j !== BIG_RAW)];
    const right = order.indexOf(BIG_STD);
    const effRows = INPUTS.map((x, j) => [x.name, `$${f(SK.coef[j], 4)}`, `${f(STD[j], 1)} ${x.unit}`, money(SPREAD_EFFECT[j])]);
    const fb = opts.map((_, i) => {
      if (i === right) return [`Right. Multiply each weight by its spread:${tbl(kit, ["input", "weight", "spread", "weight × spread"], effRows, { hit: BIG_STD })}A trip one spread longer (about ${f(STD[BIG_STD], 0)} ${INPUTS[BIG_STD].unit} more) adds about ${money(SPREAD_EFFECT[BIG_STD])}. A shipment one spread bulkier (about ${f(STD[BIG_RAW], 1)} ${INPUTS[BIG_RAW].unit} more) adds only about ${money(SPREAD_EFFECT[BIG_RAW])}. A weight is a price per unit, so <b>you can only compare weights after putting the inputs on one scale</b>. The usual scale: <b>standardize</b> each input, z = (x − mean) / spread. Then “one unit” means one spread for every input. Weights fitted on standardized inputs equal the last column: scikit-learn gave ${vec(SK.coefS)}.`, true];
      if (i === opts.length - 1) return ["You can: the spread says how much each input really varies between shipments. Weight times spread is how much the cost moves for a typical change in that input.", false];
      const j = order[i];
      if (j === BIG_RAW) return [`That compares prices per unit, and units differ in size. Volume varies by only about ${f(STD[j], 1)} ${INPUTS[j].unit} between typical shipments, so its large weight moves the cost by only about ${money(SPREAD_EFFECT[j])}. Multiply each weight by its spread.`, false];
      return [`${INPUTS[j].name}: weight × spread = $${f(SK.coef[j], 4)} × ${f(STD[j], 1)} ≈ ${money(SPREAD_EFFECT[j])}. Work out the same product for the other two.`, false];
    });
    const paint = () => {
      el.innerHTML = `<h1>Does volume drive the price?</h1>
        <p class="lead">Mira's manager reads the fitted numbers and says: “Volume has by far the biggest weight, so volume is what drives our prices. Let's give discounts on volume.” Here is how much each input really varies across the ${N_ROWS} shipments (its <b>spread</b>, the standard deviation: about how far a typical shipment is from the average one):</p>
        ${tbl(kit, ["input", "weight", "spread"], INPUTS.map((x, j) => [x.name, `$${f(SK.coef[j], 4)} ${perUnit(j)}`, `${f(STD[j], 1)} ${x.unit}`]))}
        <p class="task">If each input grows by its spread, which one changes the cost the most?</p>
        <div class="lpanel">${ask(kit, opts, right, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 3. Use it: one quote by hand, then all shipments at once as a matrix times a vector. */
  function useIt({ el, done, kit }) {
    ensureStyle();
    let part = 0, ans = null;
    const noBase = QUOTE - SK.intercept;
    const noMult = SK.intercept + sum(SK.coef);
    const litres = SK.intercept + SK.coef[0] * NEW_SHIP[0] + SK.coef[1] * NEW_SHIP[1] + SK.coef[2] * NEW_SHIP[2] * 1000;
    const Q = [
      { right: 1, opts: [money(noBase), money(QUOTE), money(noMult), money(litres)],
        fb: [[`That is the three weighted inputs without the base. Every shipment pays the base ${money(SK.intercept)} on top.`, false], null,
          [`That adds the weights themselves, as if the shipment were 1 kg, 1 km and 1 m³. Multiply each weight by the shipment's amount first.`, false],
          [`That used the volume in litres (${f(NEW_SHIP[2] * 1000, 0)}). The weight is per m³, so the volume must be in m³: ${f(NEW_SHIP[2], 1)}.`, false]] },
      { right: 0, opts: [`(${N_ROWS},)`, "(3,)", `(${N_ROWS}, 3)`],
        fb: [null, ["That is the shape of w: one weight per input. The product has one number per row of the matrix.", false],
          ["That is the shape of the input matrix. Multiplying by w collapses each row of three inputs into one number.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(part, 1)];
      el.innerHTML = `<h1>One quote, then all of them</h1>
        <p class="lead">Use the fitted numbers: base $${f(SK.intercept, 4)}, ${INPUTS.map((x, j) => `$${f(SK.coef[j], 6)} ${perUnit(j)}`).join(", ")}. A new request: <b>${f(NEW_SHIP[0], 0)} kg, ${f(NEW_SHIP[1], 0)} km, ${f(NEW_SHIP[2], 1)} m³</b>.</p>
        ${part === 0 ? `<p class="task">What does Mira quote?</p><div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}</div>` : `
          ${kit.feedback(`Right: ${f(SK.intercept, 4)} + ${INPUTS.map((x, j) => `${f(SK.coef[j], 6)} × ${f(NEW_SHIP[j], j === 2 ? 1 : 0)}`).join(" + ")} = ${money(QUOTE)}. scikit-learn's <code>predict</code> gave the same: ${money(SK.quote)}. Each input times its weight, added up, plus the base: that is a <b>dot product</b> plus b.`, true)}
          <div class="lx-${ID}-step"><p class="lead">For all ${N_ROWS} past shipments at once, put them in a matrix, one row per shipment and one column per input: <code>shipments</code> has shape (${N_ROWS}, 3). <code>w</code> holds the three weights, shape (3,).</p>
          ${part === 1 ? `<p class="task">What shape is <code>shipments @ w + b</code>?</p>` : ""}
          <div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}${part === 2 ? kit.feedback(`Right: one predicted cost per shipment. One matrix product does all ${N_ROWS} dot products, and <code>+ b</code> adds the base to each. This one line is the whole model.`, true) : ""}</div></div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        if (part === 2) return;
        ans = +b.dataset.i;
        if (ans === q.right) { part++; ans = part === 2 ? q.right : null; paint(); if (part === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 4. Predict the first gradient step for three weights. */
  function firstStep({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const w1 = FIRST_UPDATE[3];
    const moved = argmax(w1.map(Math.abs));
    const opts = [...INPUTS.map(x => x.name), "All three move by the same amount"];
    const fb = opts.map((_, i) => i === moved
      ? [`Right. After one step the weights are ${vec(w1)} (${INPUTS.map(x => x.name).join(", ")}). All three went up because shipments with more of any input tend to cost more, and the zero predictions miss those shipments by the most. ${INPUTS[moved].name[0].toUpperCase() + INPUTS[moved].name.slice(1)} moved most because its column lines up best with the errors: long trips are where the zero predictions miss by the most. That match between a column and the errors is what <code>shipments.T @ err</code> measures.`, true]
      : i === 3 ? ["Each weight gets its own gradient, from its own column. A column that lines up with the errors more gets a bigger push.", false]
      : [`${INPUTS[i].name[0].toUpperCase() + INPUTS[i].name.slice(1)} does move up, but less. Think back: which input moved the cost most between typical shipments? The zero predictions miss most where that input is large.`, false]);
    const paint = () => {
      el.innerHTML = `<h1>Gradient descent, three weights at once</h1>
        <p class="lead">Now Mira fits the numbers herself, with the gradient descent you know from one slope. First she standardizes the three inputs, so one step size suits all of them. She starts with every weight and the base at 0, so every prediction is 0 and every error (prediction − cost) is negative.</p>
        <p class="lead">The update is the same rule as for one slope, done for every column at once: <code>w = w − lr × 2 × shipments.T @ err / n</code>, with step size lr = ${LR}. The part <code>shipments.T @ err</code> multiplies each input's column by the errors and adds them up, so each weight gets its own push.</p>
        <p class="task">After the first step, which weight has moved the most?</p>
        <div class="lpanel">${ask(kit, opts, moved, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === moved) done(); });
    };
    paint();
  }

  /* 5. The loop in NumPy: a stepped replay of the traced run, then read the final loss. */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null, seen = false;
    const say = r => {
      const [ln, ev, step, w, b, loss] = r;
      if (ev === "r") return `Returned after ${STEPS} steps: w = ${vec(w)}, b = ${f(b, 2)}. These match scikit-learn on the same standardized inputs: ${vec(SK.coefS)} and ${f(SK.interceptS, 2)}.`;
      if (ln === 1) return `<code>n, k</code> = ${N_ROWS}, 3: ${N_ROWS} shipments, 3 inputs (already standardized).`;
      if (ln === 2) return "Line 2: one weight per input, all zero.";
      if (ln === 3) return "Line 3: the base starts at zero too.";
      if (ln === 4) return `Step ${step} begins.`;
      if (ln === 5) return `Line 5 predicted all ${N_ROWS} costs with one matrix product.`;
      if (ln === 6) return "Line 6: an error per shipment, prediction minus real cost.";
      if (ln === 7) return `Line 7: the loss is the mean squared error, ${f(loss, 1)}.`;
      if (ln === 8) return `Line 8 moved all three weights at once: ${vec(w)}.`;
      if (ln === 9 && step <= 1) return `Line 9 moved the base to ${f(b, 2)}. Back to the top of the loop.`;
      return `… end of step ${step}. Loss this step ${f(loss, 1)}, w = ${vec(w)}, b = ${f(b, 2)}.`;
    };
    const opts = [`A typical quote misses the real cost by about ${money(TYPICAL_MISS)}`, `A typical quote is off by about ${f(TYPICAL_MISS, 0)}%`, `The fit is still bad: ${f(FINAL_LOSS, 0)} is a large loss`];
    const fb = [[`Right. The loss is in squared dollars; its square root, √${f(FINAL_LOSS, 1)} ≈ ${f(TYPICAL_MISS, 2)}, is back in dollars. We made the data with random noise of typical size ${NOISE_SD}, so about $${NOISE_SD} is the best any line can do here. The fit has found the rule; what is left is noise.`, true],
      ["The loss is in squared dollars, not percent. Take its square root to get back to dollars.", false],
      [`The loss is a mean of <b>squared</b> dollar errors, so it looks large. Take its square root to get a typical miss in dollars, then compare it with the noise in the data.`, false]];
    const paint = () => {
      const r = FR[i], last = i === FR.length - 1;
      el.innerHTML = `<h1>The same thing in NumPy</h1>
        <p class="lead">This is the whole from-scratch fit. <code>shipments</code> is the standardized (${N_ROWS}, 3) matrix and <code>costs</code> the ${N_ROWS} real costs. It ran with lr = ${LR} for ${STEPS} steps. Each press of Next step shows the next line that ran, with the numbers recorded from that run.</p>
        <p class="task">Step through to the end, then read the final loss.</p>
        ${codeBox(kit, CODE, r[0])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>step <b>${r[2] == null ? "–" : r[2]}</b></span><span>w <b>${r[3] ? vec(r[3]) : "–"}</b></span><span>b <b>${r[4] == null ? "–" : f(r[4], 2)}</b></span><span>loss <b>${r[5] == null ? "–" : f(r[5], 1)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(say(r))}
        ${seen ? `<div class="lx-${ID}-step"><p class="task">The loss settled at ${f(FINAL_LOSS, 1)}. What does that say about Mira's quotes?</p><div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div></div>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; if (i === FR.length - 1) seen = true; paint(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 6. Broken on purpose: the same loop on raw kg, km, m3. */
  function rawInputs({ el, done, kit }) {
    ensureStyle();
    let part = 0, ans = null;
    const Q = [
      { right: 2, opts: ["The same weights, now per kg, km and m³", "The same weights, just more slowly", "The loss gets bigger every step"],
        fb: [[`Gradient descent has no idea what units are. Raw kg values are in the hundreds and thousands, so the gradient for the kg weight is huge, and lr = ${LR} turns it into a giant jump.`, false],
          [`Slower would happen with a step that is too small. Here raw kg values are in the thousands, while standardized ones are around −2 to 2, so the same step is far too big for them.`, false], null] },
      { right: FAR, opts: INPUTS.map(x => x.name),
        fb: INPUTS.map((x, j) => j === FAR ? null : [`After ${SLOW_END.step} steps the weight ${perUnit(j)} is ${f(SLOW_END.w[j], 4)}, against ${f(SK.coef[j], 4)} fitted: ${f(SLOW_RATIO[j] * 100, 0)}% of it. Off, but the right size. Compare each weight with its fitted value and find the one furthest from 100%.`, false]) }
    ];
    const paint = () => {
      const q = Q[Math.min(part, 1)];
      el.innerHTML = `<h1>Broken on purpose: skip the scaling</h1>
        <p class="lead">A colleague runs the same <code>fit</code> on the raw columns (kg, km, m³), not standardized, with the same lr = ${LR}.</p>
        ${part === 0 ? `<p class="task">What happens over the first few steps?</p><div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}</div>` : `
          ${out(kit, RAW_FAST, "Output of raw_gd.py, run on this Mac")}
          ${kit.feedback(`Right. The loss went from ${f(FAST[0].loss, 0)} to about ${FAST[FAST.length - 1].loss.toExponential(1)} in ${FAST.length - 1} steps, and the weights flip sign every step, each jump bigger than the last. The step size that suits standardized inputs is far too big for raw kilograms. Leave it running and the numbers overflow.`, true)}
          <div class="lx-${ID}-step"><p class="lead">So the colleague shrinks the step until it no longer blows up: lr = 1e-7, ${f(SLOW_END.step, 0)} steps. The fitted weights from before were ${INPUTS.map((x, j) => `$${f(SK.coef[j], 4)} ${perUnit(j)}`).join(", ")}.</p>
          ${out(kit, RAW_SLOW, "Output of raw_gd.py, run on this Mac")}
          ${part === 1 ? `<p class="task">Which weight is furthest from where it should be?</p>` : ""}
          <div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}${part === 2 ? kit.feedback(`Right: ${f(SLOW_END.w[FAR], 4)} against ${f(SK.coef[FAR], 4)}, only ${f(SLOW_RATIO[FAR] * 100, 1)}% of the way, and the loss is stuck near ${f(SLOW_END.loss, 0)} instead of ${f(FINAL_LOSS, 0)}. A step small enough for the kg column is far too small for the m³ column, whose values are a few units. <b>One step size cannot suit inputs on different scales.</b> The fix is not a cleverer step size: standardize the inputs first, as Mira did.`, true) : ""}</div></div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        if (part === 2) return;
        ans = +b.dataset.i;
        if (ans === q.right) { part++; ans = part === 2 ? q.right : null; paint(); if (part === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 7. The real library: scikit-learn's LinearRegression on the raw inputs. */
  const SK_CODE = [
    "from sklearn.linear_model import LinearRegression",
    "",
    "model = LinearRegression()",
    "model.fit(shipments, costs)",
    "print(\"coef_\", model.coef_.round(6))",
    "print(\"intercept_\", round(model.intercept_, 4))",
    "new_shipment = np.array([[800, 350, 5.0]])",
    "quote = model.predict(new_shipment)",
    "print(\"quote\", quote.round(2))"
  ];
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "It solves for the least-squared-error weights directly, so there is no step size to get wrong",
      "It standardizes the inputs for you behind the scenes",
      "It uses a much smaller step size and more steps",
      "It was lucky with these inputs"
    ];
    const fb = [
      [`Right. The scikit-learn docs describe <code>LinearRegression</code> as plain ordinary least squares, computed with <code>scipy.linalg.lstsq</code>: a direct solve, no steps. That is why raw kg and m³ were fine. Scaling still matters for <b>reading</b> the weights, as the volume weight showed, and for any model trained by gradient steps. One is scikit-learn's <code>SGDRegressor</code>: its docs call it “sensitive to feature scaling” and suggest it for large sets (over 10,000 samples).`, true],
      ["Then <code>coef_</code> would be per spread, not per kg, km and m³. The numbers came out per raw unit, the same as Mira's converted ones. It used the raw columns as they are.", false],
      ["There are no steps at all in <code>LinearRegression</code>. Its docs say it is plain ordinary least squares, solved directly.", false],
      ["Not luck: the same method would work on any columns, because it never takes a step that could be too big.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same fit in scikit-learn</h1>
        <p class="lead">In real work you use the library. Here it is on the <b>raw</b> columns, the same ones that made gradient descent blow up:</p>
        ${codeBox(kit, SK_CODE, -1)}
        ${out(kit, SK_OUT, "Output of sklearn_fit.py, run on this Mac")}
        <p class="lead">Mira's from-scratch weights, converted back from standardized units to per kg, km and m³ (weight ÷ spread), were ${SCRATCH_RAW.w.map(x => f(x, 6)).join(", ")} with base ${f(SCRATCH_RAW.b, 4)}${ROUND_MATCH ? ": the same to the last printed digit" : ""}.</p>
        <p class="lead">Two parameters matter: <code>fit_intercept</code> (default <code>True</code>) fits the base b; set it to <code>False</code> and the line is forced through zero cost. <code>positive=True</code> forces every weight to be zero or more. The fitted numbers are in <code>coef_</code> and <code>intercept_</code>.</p>
        <p class="task">Why did scikit-learn get the right weights from raw kg, km and m³, when gradient descent with one step size could not?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a real run of a near-copy column. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const kgSwing = [COLL[2][1][0], COLL[3][1][0]];
    const opts = ["The quotes get much worse", "The weights on kg and on billed weight stop meaning anything", "Training becomes too slow to use"];
    const fb = [
      [`Look at the last column: the typical miss stayed at about ${money(COLL[3][2])} with four inputs, as with three. The quotes are fine. Something else changed.`, false],
      [`Right. The two columns carry almost the same information (correlation ${COLL_R}, where 1 means they move in perfect step), so the fit can split the kg effect between them almost any way: the kg weight was ${f(kgSwing[0], 4)} on one half and ${f(kgSwing[1], 4)} on the other, and billed weight even came out negative once. The predictions stay as good, but reading “one more kg costs this much” from the weights is now meaningless. The scikit-learn docs call this <b>multicollinearity</b>. Drop one of the near-copies before you read weights.`, true],
      ["Four columns instead of three is nothing; a least-squares solve on a few hundred rows takes a moment. Compare the rows of the table instead.", false]
    ];
    const rows = COLL.map(([label, c, rmse]) => [label, f(c[0], 4), c.length > 3 ? f(c[3], 4) : "–", money(rmse)]);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>For:</b> predicting a number from inputs whose effects roughly add up. <b>Reach for it</b> first, as the baseline: the simple score every fancier model must beat. Also reach for it when someone must be able to read the price of each input.</p>
        <p class="lead"><b>Not</b> when the answer is a yes or no: that is the next lesson. <b>Not</b> when an effect bends or depends on another input either, such as a price per km that drops on long hauls. Then use a model that can bend, such as a tree-based one, or add an input that captures the bend.</p>
        <p class="lead"><b>Costs:</b> training is cheap. The effort is in the data: units, scaling for gradient methods, and inputs that repeat each other.</p>
        <p class="lead">Mira adds a fourth column, <b>billed weight</b> (the weight rounded up to the next 50 kg), and fits twice, on the first and the last 100 shipments:</p>
        ${tbl(kit, ["fit", "w kg", "w billed", "typical miss"], rows)}
        <p class="lx-${ID}-cap">Output of collinear.py, run on this Mac (typical miss = root mean squared error on all ${N_ROWS})</p>
        <p class="task">What went wrong when she added billed weight?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where it is the wrong tool. */
  const CASES = [
    ["A supermarket wants next month's electricity bill from its floor area, the number of freezers and the opening hours. Each adds to the bill roughly in proportion.", true,
      "Yes. A number to predict, from a few inputs whose effects add up. Fit it, and the weights even tell the owner what one more freezer costs.",
      "The target is a number, and each input adds to it roughly in proportion: that is exactly the shape a linear regression fits. It is the right first model here."],
    ["A clinic wants to know whether a patient will miss an appointment, from the booking lead time and past no-shows.", false,
      "No. The answer is yes or no, not an amount. A straight line would happily predict 1.4 or −0.3. You need a probability between 0 and 1, which is the next lesson.",
      "A weighted sum can be any number, but the answer here is a yes or a no. Treat it as a probability instead of a number: that is logistic regression, the next lesson."],
    ["A taxi app estimates fares from the trip length in km and minutes stuck in traffic.", true,
      "Yes. A number from two inputs that each add to it. Standardize before you compare their weights, since a km and a minute are different units.",
      "Fare is a number, and length and waiting time each add to it. A linear regression is the natural baseline, and its two weights read as price per km and per minute."],
    ["A parking garage wants to predict a car's fee from hours parked. Its posted tariff is a flat fee for the first hour, then the fee jumps at 3 hours and at 6 hours.", false,
      "No. The fee is flat inside each band and jumps between them, so one price per hour would undercharge right after each jump and overcharge right before it. And the tariff is already written down: look the fee up, there is nothing to fit.",
      "A straight line gives one price per hour everywhere, but this fee is flat inside each band and jumps between them, so any line misses at every jump. The rule is already known from the tariff: a lookup gives the exact fee, with nothing to fit."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Linear regression or not?</h1>
        <p class="lead">Four requests from other jobs. Linear regression means: a number predicted as a base plus one weight times each input.</p>
        <p class="task">Is it a good fit for each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can fit a line with several inputs</h1>
      <p class="lead">You found that a weight is a price per unit, so you compare weights only after standardizing. You ran gradient descent on three weights at once in ${CODE.length - 1} lines of NumPy and saw why it breaks on unscaled inputs. Then you got the same numbers from scikit-learn's direct solve.</p>
      <p class="lead">Reach for it first when you predict a number from inputs that add up. Skip it for yes-or-no answers and for effects that bend.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the NumPy fit for several inputs yourself and check its weights against scikit-learn's <code>LinearRegression</code>.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The same weighted sum, turned into a probability, for questions whose answer is yes or no.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Linear regression from scratch, then in scikit-learn",
    checked: "2026-11-13",
    sources: [
      "https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LinearRegression.html",
      "https://scikit-learn.org/stable/modules/linear_model.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html",
      "https://scikit-learn.org/stable/modules/sgd.html"
    ],
    interview: [
      {
        q: "You fit a linear regression for delivery cost. A product manager sees that volume has by far the largest coefficient and wants to price mainly on volume. What do you tell them?",
        good: [
          "A coefficient is the price of one unit, so its size depends on the unit: per m³ is big because a m³ is big",
          "To compare inputs, standardize them first, or multiply each coefficient by the input's spread",
          "Check whether inputs are near-copies of each other; then the coefficients are unstable and should not be read at all",
          "Coefficients show association in this data, not that changing the input would change the cost"
        ],
        weak: "Agree that volume matters most because its coefficient is largest, without asking about units or scale."
      },
      {
        q: "Your gradient-descent regression worked, then started returning huge numbers or NaN after someone added a raw 'annual revenue' column. What happened and how do you fix it?",
        good: [
          "The new column is on a much larger scale, so its gradient is huge and the step size that worked is now far too big",
          "Shrinking the step stops the blow-up but leaves the small-scale weights barely moving",
          "Standardize every input (fit the scaler on training data only, apply it to new data too)",
          "For a small dataset, a direct least-squares solve such as scikit-learn's LinearRegression has no step size at all"
        ],
        weak: "Lower the learning rate until it stops diverging, without noticing that the other weights then hardly train."
      }
    ],
    screens: [situation, spotIdea, useIt, firstStep, asCode, rawInputs, library, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(FR.length - 1).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
