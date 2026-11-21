/* Lesson: the neuron, a weighted sum plus a bend. Story: a greenhouse controller decides how far to open the roof
   vents from temperature, humidity and sunlight. Ideas: (1) one neuron multiplies each input by a weight, adds them
   and a bias, then bends the result (ReLU: max(0, z)); (2) without the bend, stacked neurons collapse into one
   weighted sum, so they can only draw a straight boundary.
   Data, all real runs on this Mac (no model recordings):
   - docs/ai-path/runs/s3-the-neuron/neuron.py + neuron.out.txt: the five readings, the neuron() listing traced
     line by line on reading 2, and the NumPy version's printed arrays;
   - docs/ai-path/runs/s3-the-neuron/stack.py + stack.out.txt: 200 made-up readings marked by a curved rule, a stack
     of two linear layers and a small ReLU network trained the same way (PyTorch, seed 0), their accuracy, the
     decision grids and per-point answers drawn here, and the collapse of the linear stack into one neuron.
   Lesson-local style and picture: a five-reading table and an SVG scatter with the model's open area
   (.lx-s3-the-neuron-*), see ensureStyle() and plot(). Plain browser script. */
(() => {
  const ID = "s3-the-neuron";
  const P = `lx-${ID}-`;

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s3-the-neuron/neuron.py (inputs: temperature C, humidity %, sun level 0-5)
  const READINGS = [[28, 60, 4], [18, 70, 1], [31, 44, 5], [22, 66, 2], [25, 90, 3]];
  const WEIGHTS = [1.0, 0.5, 2.0];
  const BIAS = -60.0;
  const INPUTS = ["temperature", "humidity", "sun level"];
  // neuron.out.txt, "== plain Python ==" lines: the vent value per reading
  const RUN_VENT = [6.0, 0.0, 3.0, 0.0, 16.0];
  // The listing is neuron() from neuron.py, line for line (line 0 = def).
  const CODE = [
    "def neuron(reading, weights, bias):",
    "    z = 0.0",
    "    for x, w in zip(reading, weights):",
    "        z = z + w * x",
    "    z = z + bias",
    "    vent = max(0.0, z)",
    "    return vent"
  ];
  // neuron.out.txt, "== traced: reading 2 ==": [line about to run, event (l line, r return), z, x, w, vent], as printed
  const TRACE = [[1,"l",null,null,null,null],[2,"l","0.0",null,null,null],[3,"l","0.0","18","1.0",null],[2,"l","18.0","18","1.0",null],
    [3,"l","18.0","70","0.5",null],[2,"l","53.0","70","0.5",null],[3,"l","53.0","1","2.0",null],[2,"l","55.0","1","2.0",null],
    [4,"l","55.0","1","2.0",null],[5,"l","-5.0","1","2.0",null],[6,"l","-5.0","1","2.0","0.0"],[6,"r","-5.0","1","2.0","0.0"]];
  const TRACED_READING = 1; // index into READINGS
  const NP_CODE = ["R = np.array(readings, dtype=float)", "W = np.array(weights)", "z = R @ W + bias", "vent = np.maximum(0, z)"];
  const NP_OUT = "z    = [ 6. -5.  3. -1. 16.]\nvent = [ 6.  0.  3.  0. 16.]"; // neuron.out.txt, last two lines

  // From docs/ai-path/runs/s3-the-neuron/stack.out.txt
  const RULE = { t0: 10, tr: 20, h0: 30, hr: 50 }; // open when ((t-10)/20)^2 + ((h-30)/50)^2 > 1 (stack.py docstring)
  const RUN = {
    n: 200,
    linear: { right: 177, hidden: 2, line: true, grid: "11111111111111001111111111110001111111111100001111111111000001111111110000001111111100000000111111000000000111110000000000111100000000000111",
      said: "100011101110100011110000111111100100011101101101011010001100" },
    relu: { right: 198, hidden: 8, grid: "11111111111111111111111111110111111111111100000001111111000000001111110000000011111100000000011111000000000111110000000000111100000000001111",
      said: "100011110110101010111000101111100100011101101101011011001101" },
    W1: [[2.78, 2.457], [-0.104, 0.207]], b1: [0.242, 0.844], W2: [2.752, -0.076], b2: 0.629,
    maxDiff: "1.9073486328125e-06"
  };
  const GRID = { cols: 14, rows: 10, tMin: 10, tMax: 38, hMin: 30, hMax: 95 }; // top row = most humid
  const POINTS = [[27.8,50.8,0],[17.6,42.2,0],[11.1,73.7,0],[10.5,42.7,0],[32.8,67.5,1],[35.6,69.1,1],[27.0,92.6,1],[30.4,34.7,1],[25.2,62.5,1],[36.2,78.4,1],[32.8,41.5,1],[10.1,55.2,0],[34.0,34.1,1],[10.9,77.2,0],[30.4,35.7,1],[14.9,55.7,0],[34.2,86.8,1],[25.2,60.7,0],[18.4,89.3,1],[21.8,79.8,1],[10.8,89.5,1],[13.5,38.3,0],[28.8,34.8,0],[28.1,34.6,0],[27.2,86.5,1],[20.7,71.2,0],[37.9,62.3,1],[37.5,40.6,1],[29.2,73.8,1],[28.2,50.7,1],[29.3,76.2,1],[20.9,59.9,0],[13.8,63.0,0],[30.2,81.3,1],[24.7,36.0,0],[18.7,67.6,0],[23.6,42.8,0],[34.9,82.5,1],[36.2,61.8,1],[20.0,94.3,1],[26.0,41.9,0],[19.0,92.6,1],[26.6,82.1,1],[19.5,61.3,0],[21.0,82.9,1],[34.9,69.2,1],[16.4,72.6,0],[27.4,89.4,1],[12.4,34.2,0],[33.3,84.3,1],[32.0,54.8,1],[16.7,51.2,0],[34.5,94.6,1],[11.6,80.8,1],[19.4,61.6,0],[14.2,57.5,0],[22.6,87.0,1],[32.3,35.6,1],[16.5,76.0,0],[11.5,81.3,1]];

  // A hand-made one-input example for the collapse screen (inputs, not results): h = 2*temp - 40, vent = 3*h + 5
  const EX = { hw: 2, hb: -40, ow: 3, ob: 5, cold: 15 };

  /* ---------- Derived from the data ---------- */
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const Z = READINGS.map(r => dot(r, WEIGHTS) + BIAS);
  const relu = z => Math.max(0, z);
  const VENT = Z.map(relu);
  const num = v => (v < 0 ? "−" + Math.abs(v) : String(v)); // typographic minus
  const signed = v => (v < 0 ? `− ${Math.abs(v)}` : `+ ${v}`);
  const W_ONE = [0, 1].map(j => RUN.W2[0] * RUN.W1[0][j] + RUN.W2[1] * RUN.W1[1][j]);
  const B_ONE = RUN.W2[0] * RUN.b1[0] + RUN.W2[1] * RUN.b1[1] + RUN.b2;
  const said = s => s.split("").map(Number);
  const wrongPts = m => POINTS.filter((p, i) => said(m.said)[i] !== p[2]).length;
  const EX_W = EX.ow * EX.hw, EX_B = EX.ow * EX.hb + EX.ob;
  const EX_CORNER = -EX.hb / EX.hw; // temperature where the hidden sum crosses zero
  const exStack = t => EX.ow * (EX.hw * t + EX.hb) + EX.ob;
  const exBent = t => EX.ow * relu(EX.hw * t + EX.hb) + EX.ob;

  /* ---------- Lesson-local style and pictures ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .${P}w { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 14px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; font: 500 15px/1.5 var(--mono); color: var(--ink); }
      .${P}tbl { width: 100%; border-collapse: collapse; margin: 16px 0 0; font: 500 15px/1.4 var(--mono); }
      .${P}tbl caption { text-align: left; font: 600 13px var(--font); color: var(--muted); padding-bottom: 6px; }
      .${P}tbl th { font: 600 12.5px/1.3 var(--font); color: var(--muted); text-align: right; padding: 6px 4px; border-bottom: 1px solid var(--line); }
      .${P}tbl td { text-align: right; padding: 8px 4px; border-bottom: 1px solid var(--line); color: var(--ink); }
      .${P}tbl th:first-child, .${P}tbl td:first-child { text-align: left; }
      .${P}tbl tr.${P}now td { font-weight: 700; }
      .${P}tbl tr.${P}now td:first-child { border-left: 3px solid var(--ink); padding-left: 6px; }
      .${P}tbl td.${P}q { color: var(--faint); }
      .${P}plots { display: flex; flex-wrap: wrap; gap: 14px 22px; margin: 16px 0 0; }
      .${P}plot { flex: 1 1 260px; max-width: 380px; margin: 0; }
      .${P}plot figcaption { font: 600 13.5px/1.4 var(--font); color: var(--ink-2); margin-bottom: 4px; }
      .${P}plot svg { display: block; width: 100%; height: auto; }
      .${P}plot text { font: 500 10px var(--mono); fill: var(--muted); }
      .${P}key { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 10px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}key span { display: inline-flex; align-items: center; gap: 6px; }
      .${P}key svg { width: 18px; height: 18px; }
      .${P}cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}out { margin: 8px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--sunk); font: 500 14px/1.55 var(--mono); white-space: pre; overflow-x: auto; color: var(--ink); }
      .${P}f { font: 600 15px var(--mono); }
    `;
    document.head.appendChild(s);
  }

  /* The five-reading table. cols: which extra columns to show; cell(i, col) returns the cell's html or null for "?". */
  function readingTable(kit, { now = -1, sum = () => null, vent = null, title = "" } = {}) {
    const head = ["#", "temp", "humid", "sun", "sum z"].concat(vent ? ["vent"] : []);
    return `<table class="${P}tbl">${title ? `<caption>${kit.esc(title)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${READINGS.map((r, i) => {
      const s = sum(i), v = vent ? vent(i) : undefined;
      return `<tr class="${i === now ? P + "now" : ""}"><td>${i + 1}</td>${r.map(x => `<td>${x}</td>`).join("")}<td class="${s == null ? P + "q" : ""}">${s == null ? "?" : kit.esc(s)}</td>${vent ? `<td class="${v == null ? P + "q" : ""}">${v == null ? "?" : kit.esc(v)}</td>` : ""}</tr>`;
    }).join("")}</tbody></table>`;
  }
  const weightCard = kit => `<div class="${P}w">${INPUTS.map((n, i) => `<span>${kit.esc(n)} × ${WEIGHTS[i]}</span>`).join("")}<span>bias ${num(BIAS)}</span></div>`;

  /* Scatter of temperature (across) against humidity (up). model: { grid } shades where the model says open and
     draws the edge between open and shut cells; marks: per-point model answers, a ring marks a wrong one. */
  let clipN = 0;
  function plot(kit, { model = null, title = "" } = {}) {
    const L = 40, T = 6, W = 280, H = 200, cw = W / GRID.cols, ch = H / GRID.rows;
    const X = t => L + (t - GRID.tMin) / (GRID.tMax - GRID.tMin) * W;
    const Y = h => T + (GRID.hMax - h) / (GRID.hMax - GRID.hMin) * H;
    let g = "";
    if (model) {
      const cells = said(model.grid), at = (r, c) => cells[r * GRID.cols + c];
      for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) {
        if (at(r, c)) g += `<rect x="${L + c * cw}" y="${T + r * ch}" width="${cw}" height="${ch}" fill="var(--sunk)"/>`;
      }
      if (model.line) {
        // the edge where W_ONE . scaled(t, h) + B_ONE = 0, scaled as in stack.py: ((t - 24) / 14, (h - 62.5) / 32.5)
        const hAt = t => 62.5 + 32.5 * (-(B_ONE + W_ONE[0] * (t - 24) / 14) / W_ONE[1]);
        const cid = `${P}clip${++clipN}`;
        g += `<clipPath id="${cid}"><rect x="${L}" y="${T}" width="${W}" height="${H}"/></clipPath><line clip-path="url(#${cid})" x1="${X(GRID.tMin)}" y1="${Y(hAt(GRID.tMin))}" x2="${X(GRID.tMax)}" y2="${Y(hAt(GRID.tMax))}" stroke="var(--ink-2)" stroke-width="2"/>`;
      } else for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) {
        if (c + 1 < GRID.cols && at(r, c) !== at(r, c + 1)) g += `<line x1="${L + (c + 1) * cw}" y1="${T + r * ch}" x2="${L + (c + 1) * cw}" y2="${T + (r + 1) * ch}" stroke="var(--ink-2)" stroke-width="2"/>`;
        if (r + 1 < GRID.rows && at(r, c) !== at(r + 1, c)) g += `<line x1="${L + c * cw}" y1="${T + (r + 1) * ch}" x2="${L + (c + 1) * cw}" y2="${T + (r + 1) * ch}" stroke="var(--ink-2)" stroke-width="2"/>`;
      }
    }
    // the rule's curve, dashed
    const pts = [];
    for (let k = 0; k <= 40; k++) { const t = RULE.t0 + RULE.tr * k / 40; pts.push(`${X(t).toFixed(1)},${Y(RULE.h0 + RULE.hr * Math.sqrt(Math.max(0, 1 - ((t - RULE.t0) / RULE.tr) ** 2))).toFixed(1)}`); }
    g += `<polyline points="${pts.join(" ")}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    const ans = model ? said(model.said) : null;
    POINTS.forEach(([t, h, o], i) => {
      const x = X(t).toFixed(1), y = Y(h).toFixed(1);
      if (ans && ans[i] !== o) g += `<circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="var(--bad)" stroke-width="2"/>`;
      g += o ? `<circle cx="${x}" cy="${y}" r="3.6" fill="var(--ink)"/>` : `<circle cx="${x}" cy="${y}" r="3.4" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.4"/>`;
    });
    const axes = `<rect x="${L}" y="${T}" width="${W}" height="${H}" fill="none" stroke="var(--line)"/>`
      + [10, 20, 30].map(t => `<text x="${X(t)}" y="${T + H + 14}" text-anchor="middle">${t}°</text>`).join("")
      + [40, 60, 80].map(h => `<text x="${L - 4}" y="${Y(h) + 3}" text-anchor="end">${h}%</text>`).join("")
      + `<text x="${L + W}" y="${T + H + 26}" text-anchor="end">temperature →</text><text x="2" y="${T + H + 26}">humid ↑</text>`;
    return `<figure class="${P}plot">${title ? `<figcaption>${kit.esc(title)}</figcaption>` : ""}<svg viewBox="0 0 ${L + W + 6} ${T + H + 32}" role="img" aria-label="${kit.esc(title || "greenhouse readings: temperature against humidity")}">${g}${axes}</svg></figure>`;
  }
  function plotKey(withModel) {
    const sw = inner => `<svg viewBox="0 0 18 18" aria-hidden="true">${inner}</svg>`;
    return `<div class="${P}key">
      <span>${sw('<circle cx="9" cy="9" r="4" fill="var(--ink)"/>')}vents opened</span>
      <span>${sw('<circle cx="9" cy="9" r="3.8" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.4"/>')}kept shut</span>
      <span>${sw('<line x1="1" y1="9" x2="17" y2="9" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>')}the rule's curve</span>
      ${withModel ? `<span>${sw('<rect x="2" y="2" width="14" height="14" fill="var(--sunk)" stroke="var(--ink-2)" stroke-width="2"/>')}area the model opens, and its edge</span>
      <span>${sw('<circle cx="9" cy="9" r="7" fill="none" stroke="var(--bad)" stroke-width="2"/>')}model gets it wrong</span>` : ""}
    </div>`;
  }

  /* A question block: options, plus feedback for the picked one. */
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const bind = (el, fn) => el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => fn(+b.dataset.i));

  /* 1. The situation, and the weighted sum by hand for five readings. */
  function bySum({ el, done, kit }) {
    ensureStyle();
    let row = 0, picked = null;
    // per row: [right, forgot the bias, humidity at full weight], shown in a rotating order
    const cands = i => {
      const [t, h, s] = READINGS[i];
      return [
        [Z[i], true, ""],
        [Z[i] - BIAS, false, `That is ${Z[i] - BIAS}: the three products added up, but the bias is missing. Every reading gets the bias ${num(BIAS)} added at the end.`],
        [Z[i] + h * (1 - WEIGHTS[1]), false, `That uses the humidity ${h} at full size. Its weight is ${WEIGHTS[1]}, so it adds ${h * WEIGHTS[1]}, not ${h}.`]
      ];
    };
    const order = i => [[0, 1, 2], [1, 0, 2], [2, 1, 0], [1, 2, 0], [0, 2, 1]][i % 5];
    const paint = () => {
      const fin = row >= READINGS.length;
      const c = fin ? [] : order(row).map(k => cands(row)[k]);
      const right = c.findIndex(x => x[1]);
      const [t, h, s] = fin ? [] : READINGS[row];
      el.innerHTML = `<h1>When should the roof vents open?</h1>
        <p class="lead">Every neural network is built from many copies of one small unit. In this lesson you build one by hand and see what it can and cannot do.</p>
        <p class="lead">A greenhouse controller reads three sensors every few minutes: temperature (°C), humidity (%) and a sun level from 0 to 5. The controller must decide how far to open the roof vents, in notches, where 0 means shut. Open too late and the plants overheat. Open too early and the warmth the heating paid for escapes.</p>
        <p class="lead">The controller multiplies each reading by a number that says how much it matters, adds the three, and adds one fixed number at the end:</p>
        ${weightCard(kit)}
        <p class="task">${fin ? "All five sums are in." : `Work out the sum for reading ${row + 1}: ${t}°, ${h}%, sun ${s}.`}</p>
        ${readingTable(kit, { now: fin ? -1 : row, sum: i => (i < row ? num(Z[i]) : null) })}
        <div class="lpanel">${fin
          ? kit.feedback(`Right: ${Z.map(num).join(", ")}. This is a <b>weighted sum</b>, the same score you built in logistic regression. The multipliers are the <b>weights</b>, the fixed ${num(BIAS)} is the <b>bias</b>, and the result is usually called <b>z</b>. Two sums came out below zero. Hold on to that.`, true)
          : ask(kit, c.map(x => `<span class="${P}f">${num(x[0])}</span>`), right, picked,
            c.map(x => x[1] ? ["", true] : [x[2], false]))}</div>`;
      bind(el, i => {
        if (i === right) { row++; picked = null; paint(); if (row >= READINGS.length) done(); return; }
        picked = i; paint();
      });
    };
    paint();
  }

  /* 2. The bend: what to do with a negative sum, then the vent column. */
  function theBend({ el, done, kit }) {
    ensureStyle();
    const NEG = Z.findIndex(z => z < 0);
    let step = 0, picked = null; // step 0 = the question; then one row at a time (all rows except NEG)
    const rows = READINGS.map((_, i) => i).filter(i => i !== NEG);
    const q = {
      opts: [`${num(Z[NEG])} notches`, `${Math.abs(Z[NEG])} notches`, "0 notches: stay shut"], right: 2,
      fb: [
        [`A vent cannot open less than shut. “${num(Z[NEG])} notches” is not something the motor can do.`, false],
        [`That flips the sign, so a cool reading would open the vents as far as a warm one with sum ${Math.abs(Z[NEG])}. A sum below zero should mean shut.`, false],
        null]
    };
    const rowRight = i => (Z[i] < 0 ? 0 : 1); // options are always ["0", the sum]
    const paint = () => {
      const fin = step > rows.length;
      const cur = step === 0 ? NEG : fin ? -1 : rows[step - 1];
      const filled = i => fin || (step > 0 && (i === NEG || rows.indexOf(i) < step - 1));
      let panel;
      if (step === 0) panel = ask(kit, q.opts, q.right, picked, q.fb);
      else if (!fin) {
        const z = Z[cur];
        panel = ask(kit, ["0", num(z)].map(o => `<span class="${P}f">${o}</span>`), rowRight(cur), picked, z < 0
          ? [["", true], [`The sum ${num(z)} is below zero, so it becomes 0, like reading ${NEG + 1}.`, false]]
          : [[`The sum ${num(z)} is above zero, so it passes through unchanged. Only sums below zero become 0.`, false], ["", true]]);
      } else panel = kit.feedback(`Done: ${VENT.map(num).join(", ")}. The rule you applied is <code>max(0, z)</code>: keep z if it is above zero, else 0. It is called <b>ReLU</b> (rectified linear unit). The standard deep learning textbook names it the default recommendation for the bend inside a network. Weighted sum, then a bend: that is one <b>neuron</b>. The bend is its <b>activation function</b>. Logistic regression's sigmoid was a bend too, a smooth one.`, true);
      el.innerHTML = `<h1>A sum below zero</h1>
        <p class="lead">Reading ${NEG + 1} gave a sum of ${num(Z[NEG])}. The vent motor takes a number of notches to open.</p>
        ${fin ? "" : `<p class="task">${step === 0 ? "What should the motor get for reading " + (NEG + 1) + "?" : `Same rule for reading ${cur + 1}, sum ${num(Z[cur])}. How many notches?`}</p>`}
        ${readingTable(kit, { now: cur, sum: i => num(Z[i]), vent: i => (filled(i) ? num(VENT[i]) : null) })}
        <div class="lpanel">${panel}</div>`;
      bind(el, i => {
        const right = step === 0 ? q.right : rowRight(rows[step - 1]);
        if (i === right) { step++; picked = null; paint(); if (step > rows.length) done(); return; }
        picked = i; paint();
      });
    };
    paint();
  }

  /* 3. Spot the idea: can two stacked neurons with no bend draw the curve? The trained runs answer. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let picked = null;
    const opts = [
      "Yes: each neuron adds one more turn to the boundary",
      "Yes, if it trains for long enough",
      "No: a weighted sum of weighted sums is still one weighted sum, so the boundary stays straight",
      "Only if the first layer gets more neurons"
    ];
    const RIGHT = 2;
    const wl = RUN.n - RUN.linear.right, wr = RUN.n - RUN.relu.right;
    const reveal = `${plotKey(true)}<div class="${P}plots">${plot(kit, { model: RUN.linear, title: `Two linear layers, no bend: right on ${RUN.linear.right} of ${RUN.n}` })}${plot(kit, { model: RUN.relu, title: `${RUN.relu.hidden} neurons with ReLU, then one: right on ${RUN.relu.right} of ${RUN.n}` })}</div>
      <p class="${P}cap">Both trained the same way on the same ${RUN.n} readings (PyTorch, on a laptop CPU). The plots show ${POINTS.length} of them. Shaded squares: where the model says open, checked at each square's centre.</p>`;
    const fb = [
      ["A neuron without a bend only multiplies and adds. Feeding one such result into another multiplies and adds again; nothing in that can turn a corner. The first plot below is the trained result: one straight edge.", false],
      [`Training finds the best weights the model can hold, and every setting of these weights still gives a straight edge. The first plot below is after training: ${wl} of ${RUN.n} readings still wrong.`, false],
      [`Right. The first model below has two layers but no bend, and its edge is one straight line: wrong on ${wl} of ${RUN.n}. Put ReLU after the first layer and the edge can turn: wrong on only ${wr}. The bend is what lets stacked neurons draw shapes one neuron cannot.`, true],
      ["More neurons in the first layer give more weighted sums, but the second layer just adds them up with weights again. The whole thing is still one weighted sum of temperature and humidity: one straight edge.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A curved rule</h1>
        <p class="lead">The head grower wants a plain open-or-shut call from temperature and humidity. Hot days need air, and so do humid ones, and the line between “open” and “shut” bends. Below are readings made up for this lesson and marked by a curved rule.</p>
        ${picked != null ? "" :`${plotKey(false)}<div class="${P}plots">${plot(kit, { title: "Readings marked by the rule" })}</div>`}
        <p class="task">A colleague builds two layers. In the first layer, a few neurons each make a weighted sum of temperature and humidity. In the second layer, one neuron makes a weighted sum of those sums. He leaves out the bend everywhere. After training, can this model draw an edge that follows the curve?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, picked, fb)}</div>
        ${picked != null ? reveal : ""}`;
      bind(el, i => { picked = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Why: collapse two linear neurons by hand, then put a ReLU between them. */
  function collapse({ el, done, kit }) {
    ensureStyle();
    let part = 0, picked = null;
    const A = {
      opts: [`vent = ${EX_W} × temp ${signed(EX.hb + EX.ob)}`, `vent = ${EX.hw + EX.ow} × temp ${signed(EX.hb + EX.ob)}`, `vent = ${EX_W} × temp ${signed(EX_B)}`], right: 2,
      fb: [[`The weight is right, but the bias ${num(EX.hb)} also passes through the second neuron, so it is multiplied by ${EX.ow} too: ${EX.ow} × (${num(EX.hb)}) ${signed(EX.ob)} = ${num(EX_B)}.`, false],
        [`The weights multiply, they do not add: the first neuron's output is multiplied by ${EX.ow}, and that output already carries ${EX.hw} × temp. So ${EX.ow} × ${EX.hw} = ${EX_W}.`, false], null]
    };
    const cold = EX.cold, hCold = EX.hw * cold + EX.hb;
    const B = {
      opts: [num(exStack(cold)), num(exBent(cold)), "0"], right: 1,
      fb: [[`That is the answer without the bend. With ReLU the first neuron's ${num(hCold)} becomes 0 before the second neuron sees it.`, false], null,
        [`ReLU sits only between the two neurons. The first neuron gives 0, and the second still adds its own bias: ${EX.ow} × 0 ${signed(EX.ob)}.`, false]]
    };
    const line = () => {
      const L = 34, W = 260, H = 130, T = 8, t0 = 10, t1 = 30;
      const vals = [t0, t1].flatMap(t => [exStack(t), exBent(t)]);
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const X = t => L + (t - t0) / (t1 - t0) * W, Y = v => T + (hi - v) / (hi - lo) * H;
      const pl = f => [t0, EX_CORNER, t1].map(t => `${X(t).toFixed(1)},${Y(f(t)).toFixed(1)}`).join(" ");
      return `<figure class="${P}plot"><figcaption>vent against temperature, ${t0}° to ${t1}°</figcaption><svg viewBox="0 0 ${L + W + 8} ${T + H + 30}" role="img" aria-label="two lines: straight without the bend, bent at ${EX_CORNER} degrees with it">
        <line x1="${L}" y1="${Y(0)}" x2="${L + W}" y2="${Y(0)}" stroke="var(--line)"/>
        <polyline points="${pl(exStack)}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4"/>
        <polyline points="${pl(exBent)}" fill="none" stroke="var(--ink)" stroke-width="2.5"/>
        <text x="${L - 4}" y="${Y(0) + 3}" text-anchor="end">0</text>
        ${[t0, EX_CORNER, t1].map(t => `<text x="${X(t)}" y="${T + H + 16}" text-anchor="middle">${t}°</text>`).join("")}
      </svg></figure>
      <div class="${P}key"><span><svg viewBox="0 0 18 18" aria-hidden="true"><line x1="1" y1="9" x2="17" y2="9" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4"/></svg>no bend: one straight line</span><span><svg viewBox="0 0 18 18" aria-hidden="true"><line x1="1" y1="9" x2="17" y2="9" stroke="var(--ink)" stroke-width="2.5"/></svg>ReLU between: a corner at ${EX_CORNER}°</span></div>`;
    };
    const paint = () => {
      let task, panel = "";
      if (part === 0) { task = "Put the first formula into the second. Which single formula does the stack compute?"; panel = ask(kit, A.opts, A.right, picked, A.fb); }
      else if (part === 1) { task = `Now put ReLU between them: first = max(0, ${EX.hw} × temp ${signed(EX.hb)}). What is vent at ${cold}°?`;
        panel = `${kit.feedback(`Right: ${EX.ow} × (${EX.hw} × temp ${signed(EX.hb)}) ${signed(EX.ob)} = ${EX_W} × temp ${signed(EX_B)}. Two neurons, but one weight and one bias come out: it <b>is</b> one neuron. Any number of layers without a bend collapses the same way.`, true)}${ask(kit, B.opts, B.right, picked, B.fb)}`; }
      else { task = "";
        panel = `${kit.feedback(`Right: ${num(exBent(cold))}. Below ${EX_CORNER}° the first neuron is cut to 0 and vent stays at ${EX.ob}; above it, vent climbs ${EX_W} per degree. That corner is something no single weighted sum can make. Many neurons, each with its corner in a different place, add up to a curve.`, true)}${line()}
          <p class="lead">The trained two-layer stack from the last screen collapses the same way. Multiplying out its weights gives one neuron with weights ${W_ONE.map(w => w.toFixed(2)).join(" and ")} and bias ${B_ONE.toFixed(2)}. These weights apply to rescaled inputs: before training, temperature and humidity were shifted to run from about −1 to 1. Over all ${RUN.n} readings, the stack and that one neuron differed by at most ${Number(RUN.maxDiff).toFixed(7)}: rounding noise.</p>`; }
      el.innerHTML = `<h1>Why the stack stayed straight</h1>
        <p class="lead">Take one input to keep it small. The first neuron computes <code>first = ${EX.hw} × temp ${signed(EX.hb)}</code>. The second reads it: <code>vent = ${EX.ow} × first ${signed(EX.ob)}</code>. No bend anywhere.</p>
        ${task ? `<p class="task">${task}</p>` : ""}
        <div class="lpanel">${panel}</div>`;
      bind(el, i => {
        const q = part === 0 ? A : B;
        if (i === q.right) { part++; picked = null; paint(); if (part === 2) done(); return; }
        picked = i; paint();
      });
    };
    paint();
  }

  /* 5. The neuron in Python: a stepped replay of the traced run on reading 2, with one prediction. */
  const FR = TRACE.map(([ln, ev, z, x, w, vent]) => ({ ln, end: ev === "r", z, x, w, vent }));
  const ASK_AT = FR.findIndex(f => f.ln === 5 && !f.end); // about to run "vent = max(0.0, z)"
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, picked = null, answered = false;
    const r = READINGS[TRACED_READING];
    const opts = [FR[FR.length - 1].vent, FR[ASK_AT].z, FR[ASK_AT].z.replace("-", "")];
    const fb = [[`Right: max(0.0, ${FR[ASK_AT].z}) is 0.0. Step on to see it happen.`, true],
      [`max(0.0, z) picks the larger of 0.0 and ${FR[ASK_AT].z}. Zero is larger, so the negative sum never reaches the motor.`, false],
      ["max does not flip the sign. It compares z with 0.0 and keeps the larger one.", false]];
    const say = f => {
      if (f.end) return `It returns ${f.vent}: the vents stay shut for reading ${TRACED_READING + 1}, the same answer you gave by hand.`;
      if (f.ln === 1) return "About to start the running sum at 0.0.";
      if (f.ln === 2) return f.x == null ? "The loop pairs each input with its weight, one pair per turn." : `z is now ${f.z}. Back to the loop for the next pair.`;
      if (f.ln === 3) return `This turn: x = ${f.x}, w = ${f.w}. The highlighted line will add ${f.w} × ${f.x} to z.`;
      if (f.ln === 4) return `All three inputs are in: z = ${f.z}. Next the bias ${num(BIAS)} is added.`;
      if (f.ln === 5) return `After the bias, z = ${f.z}. The highlighted line is the bend.`;
      if (f.ln === 6) return `vent = ${f.vent}.`;
      return "";
    };
    const paint = () => {
      const f = FR[i], blocked = i === ASK_AT && !answered, last = i === FR.length - 1;
      const vars = `<div class="vars"><span>x <b>${f.x ?? "–"}</b></span><span>w <b>${f.w ?? "–"}</b></span><span>z <b>${f.z ?? "–"}</b></span><span>vent <b>${f.vent ?? "–"}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>`;
      el.innerHTML = `<h1>The neuron, written in Python</h1>
        <p class="lead">This is one neuron as plain Python, run on reading ${TRACED_READING + 1} (${r.join(", ")}) with the weights ${WEIGHTS.join(", ")} and bias ${num(BIAS)}. The highlighted line is the one about to run.</p>
        <p class="task">Step through to the end.${i <= ASK_AT ? " When you reach the bend, predict its result." : ""}</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || blocked ? "disabled" : ""}>Next step</button></div>
        ${vars}
        ${kit.feedback(say(f))}
        ${blocked || (i === ASK_AT && picked != null) ? `<div class="lpanel"><p class="task">What will <code>vent</code> be?</p>${ask(kit, opts.map(o => `<span class="${P}f">${kit.esc(o)}</span>`), 0, picked, fb)}</div>` : ""}
        ${last ? `<p class="lead">With NumPy, all five readings go at once. <code>R @ W</code> takes the weighted sum of every row (each reading) with the weights, and <code>np.maximum(0, z)</code> applies the bend to every value:</p>
          ${kit.code(NP_CODE, -1)}<div class="${P}out">${kit.esc(NP_OUT)}</div>
          <p class="${P}cap">Printed by neuron.py on this lesson's run. The same ${VENT.length} vent values you worked out.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; picked = null; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; picked = null; paint(); if (i === FR.length - 1) done(); };
      bind(el, k => { picked = k; if (k === 0) answered = true; paint(); });
    };
    paint();
  }

  /* 6. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let picked = null;
    const opts = [
      "Close the vents whenever the rain sensor says rain",
      "Tell a failing fan motor from a healthy one by its recorded sound, from a few thousand labelled recordings",
      "Estimate the heating bill from the hours the heater ran, when every hour costs the same"
    ];
    const RIGHT = 1;
    const fb = [
      ["That is a known rule with one input. An <code>if</code> statement does it exactly, costs nothing, and anyone can read it. No training, no data.", false],
      null,
      ["Every extra hour adds the same amount: a straight line, so one weighted sum (or the formula itself) is exact. Hidden neurons add training cost and nothing the line cannot already do.", false]
    ];
    fb[RIGHT] = ["Right. A fault shows in many sound samples together, never in one alone. The edge between healthy and failing bends. And there are labelled examples to learn from. That is what stacked neurons with a bend are for. The other two jobs have a known rule or a straight line.", true];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for neurons</h1>
        <p class="lead"><b>What it is:</b> a weighted sum plus a bend, the building block of every neural network.</p>
        <p class="lead"><b>Reach for</b> layers of them when many inputs work together (pixels, sound, text), the pattern bends, and you have many labelled examples.</p>
        <p class="lead"><b>Not</b> when a rule is known: write the <code>if</code>. Not when the pattern is a straight line: one weighted sum (linear or logistic regression) is enough. Often not for an ordinary table of features with thousands of rows: tree-based models such as boosted trees often match or beat a network there.</p>
        <p class="lead"><b>Costs:</b> data to train on, training time, and answers that are harder to explain than one weight per input. Without a bend, extra layers cost all that and add nothing.</p>
        <p class="task">Which greenhouse job calls for several neurons with a bend?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, picked, fb)}</div>`;
      bind(el, i => { picked = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Recognise it: does a bend fix this? One "no" where a ReLU would do harm, one where it adds nothing. */
  const CASES = [
    ["A model with six linear layers and no activations predicts a building's power use from outside temperature. Use is high on cold days and on hot days, low in between. It draws one sloped line. Will adding a ReLU between the layers help?", true,
      "Yes. A U shape needs a corner, and six layers without a bend are still one weighted sum. With ReLU between them, neurons can turn the line in different places.",
      "Six layers without a bend multiply out to one weight and one bias, so the model can only draw a sloped line, and a U is not a line. Only a bend between layers lets it turn."],
    ["A weather model's last neuron outputs tomorrow's night temperature in °C. Some nights are below zero. Should that last neuron get a ReLU?", false,
      "No. ReLU turns every negative output into 0, so the model could never forecast a frost, the night that matters most. Bends go between layers; the last neuron gives whatever range the answer needs (here, any number).",
      "ReLU cuts everything below zero to 0. A forecast of −3° would come out as 0°, every time. The last neuron must be able to output the full range of the answer, so it is left without ReLU here."],
    ["A courier price is a base fee plus a fixed rate per kilometre. Someone suggests a small ReLU network to learn it from past bills. Is the bend needed?", false,
      "No. The price is a straight line in distance: one weighted sum fits it exactly. A network with bends would need data and training to learn what one line already says.",
      "Nothing bends here: each extra kilometre adds the same amount. One weighted sum (or the formula itself) is exact. Extra neurons and bends add cost and nothing else."],
    ["A model tells ripe tomatoes from unripe ones using the pixels of a photo. Its layers are linear, and it fails on tomatoes under shadow. Is a missing bend a likely cause?", true,
      "Yes. Ripeness depends on many pixels together in ways no single weighted sum of pixels captures. Linear layers stacked up are still one weighted sum; bends between them are needed.",
      "Pixels interact: the same red value means ripe in sun and something else in shade. One weighted sum of pixels cannot express that, and linear layers stacked are one weighted sum."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Bend or no bend?</h1>
        <p class="lead">Four models from other jobs.</p>
        <p class="task">For each, answer the question. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 8. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can compute a neuron</h1>
      <p class="lead">You worked out five weighted sums by hand, bent them with ReLU, saw two layers without a bend collapse into one neuron (and miss the curve), and stepped through the same neuron in ${CODE.length} lines of Python.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the neuron with NumPy for a batch of greenhouse readings, add the ReLU, and check which readings open the vents.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You put several of these neurons side by side as a layer and pass numbers through two layers, written as matrix products.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "The neuron: weighted sum plus a bend",
    checked: "2026-11-14",
    sources: [
      "https://www.deeplearningbook.org/contents/mlp.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.ReLU.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.maximum.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.matmul.html",
      "https://arxiv.org/abs/2207.08815"
    ],
    interview: [
      {
        q: "A teammate's model has five linear layers and no activation functions. It underfits a clearly curved pattern, and adding two more layers changed nothing. What is going on, and what do you change?",
        good: [
          "Linear layers in a row multiply out to one linear layer, so the model is one weighted sum however deep it is",
          "One weighted sum can only draw a straight boundary, so a curved pattern stays out of reach",
          "Add a non-linear activation such as ReLU between the hidden layers",
          "Keep the output layer suited to the answer: no ReLU there if the target can be negative"
        ],
        weak: "Add more layers or train for longer. Without a bend, neither changes what the model can draw."
      },
      {
        q: "A product manager wants a neural network to decide when the greenhouse vents open. When would you push back, and what would you offer instead?",
        good: [
          "If a known rule exists, write it as code: exact, free and readable",
          "If the relationship is a straight line, one weighted sum (linear or logistic regression) is enough and easier to explain",
          "For a small table of sensor features, try decision trees or boosting first",
          "A network pays off when inputs interact, the boundary bends and there are many labelled examples"
        ],
        weak: "Neural networks are always the most accurate, so use one. That ignores data, training cost and explainability."
      }
    ],
    screens: [bySum, theBend, spotIdea, collapse, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(READINGS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: Array(READINGS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: Array(ASK_AT).fill("[data-next]").concat("[data-wrong]"), right: ["[data-right]"].concat(Array(FR.length - 1 - ASK_AT).fill("[data-next]")) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
