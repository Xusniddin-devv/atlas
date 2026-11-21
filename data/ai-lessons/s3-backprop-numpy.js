/* Lesson: train a three-class network from scratch. Story: a recycling plant sorts plastic flakes into three
   bins (PET, HDPE, PP) from two sensor readings; the three kinds wind around each other like spiral arms, so no
   straight line separates them. Ideas: (1) softmax turns scores into probabilities, cross-entropy scores the
   right bin's probability, and the slope of that loss with respect to the scores is "probabilities minus 1 for
   the right bin": the start of the backward pass; (2) forward, backward and update fit in ten lines of NumPy,
   the learning rate decides whether the loss falls, stalls or blows up, and a gradient check finds a missing
   ReLU slope; scikit-learn's MLPClassifier does the same job in two lines.
   Data, all from real runs on this Mac (no model recordings), in docs/ai-path/runs/s3-backprop-numpy/:
   - flakes.py: the data (seed 0, 300 training and 150 test flakes) and train_step, the listing on screen 5;
   - run_train.py + run_train.out.txt: the half-trained flake's scores (screens 1-3), the three learning rates
     (screen 6), the full run and the no-hidden-layer run with their decision grids (screen 4);
   - trace_step.py + trace_step.out.txt: one train_step on 3 flakes, 4 hidden units, traced line by line;
   - run_bug.py + run_bug.out.txt: the same step without the ReLU slope, its training run and gradient check;
   - run_sklearn.py + run_sklearn.out.txt: MLPClassifier on the same flakes, three settings.
   Lesson-local pictures and style (see ensureStyle): a region map with the flakes on it, a small loss chart, a
   matrix table. Plain browser script. */
(() => {
  const ID = "s3-backprop-numpy";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const f2 = x => x.toFixed(2), f3 = x => x.toFixed(3);
  const pct = x => `${Math.round(x * 1000) / 10}%`;
  const sgn = x => (x >= 0 ? "+" : "−") + f2(Math.abs(x));

  /* ---------- Data copied from the runs ---------- */
  const BINS = ["PET", "HDPE", "PP"]; // flakes.py
  const N_TRAIN = 300, N_TEST = 150; // run_train.out.txt "data"
  // run_train.out.txt "early": test flake 0, before the 21st update of the lr 1.0 run
  const EARLY = { step: 20, reading: [-0.324, 0.305], right: 1, predicted: 2, scores: [-1.69, 0.74, 0.93] };
  // run_train.out.txt "lr": loss every 10 steps, steps 0..300, same starting weights
  const LR_RUNS = [
    { lr: 0.001, loss: [1.1454, 1.1423, 1.1392, 1.1362, 1.1332, 1.1303, 1.1274, 1.1245, 1.1217, 1.1189, 1.1161, 1.1134, 1.1107, 1.1081, 1.1055, 1.1029, 1.1004, 1.0978, 1.0954, 1.0929, 1.0905, 1.0881, 1.0858, 1.0834, 1.0811, 1.0789, 1.0766, 1.0744, 1.0722, 1.07, 1.0679] },
    { lr: 1.0, loss: [1.1454, 0.7432, 0.6853, 0.6297, 0.5744, 0.5208, 0.4695, 0.4203, 0.3759, 0.3376, 0.305, 0.2773, 0.254, 0.2342, 0.2172, 0.2026, 0.1899, 0.1787, 0.1687, 0.1598, 0.1518, 0.1446, 0.1379, 0.1318, 0.1261, 0.1208, 0.1159, 0.1113, 0.107, 0.103, 0.0993] },
    { lr: 30.0, loss: [1.1454, 14.6191, 3.846, 8.8063, 13.9563, 6.6236, 11.0292, 14.3699, 6.089, 10.1053, 13.605, 4.4796, 9.2931, 7.3565, 9.3575, 8.7634, 8.2042, 10.9318, 14.3353, 7.7664, 11.7138, 13.0667, 4.4359, 6.2799, 10.1175, 7.6188, 9.9402, 15.0502, 3.7213, 9.6341, 12.9706] }
  ];
  const LR_EVERY = 10;
  const LR_WARNING = "RuntimeWarning: divide by zero encountered in log"; // run_train.out.txt, printed during the lr 30 run
  // run_train.out.txt "train" and "linear"
  const TRAIN = { lr: 1.0, every: 100, loss: [1.1454, 0.305, 0.1518, 0.0993, 0.0732, 0.0575, 0.047, 0.0396, 0.0341, 0.0299, 0.0267, 0.0242, 0.0221, 0.0203, 0.0188, 0.0176, 0.0165, 0.0156, 0.0148, 0.0141, 0.0134], accTrain: 0.9966666666666667, accTest: 0.9866666666666667, hidden: 32, params: 195 };
  const LINEAR = { loss: 0.7728, accTrain: 0.52, accTest: 0.5 };
  // run_train.out.txt "grid": predicted bin on a 21 x 21 grid over -1.1..1.1; row 0 = second reading -1.1 (bottom)
  const GRID_NET = ["000000000000000000000", "000000000000000000000", "000000000000000000000", "000000000000000000000", "000000000000000000000", "222002222220000000000", "222222222222000000000", "222222222222200000001", "222222222222200000011", "222222111122200001111", "222221111112000011111", "222221111100000011111", "222221111100000011111", "222222111110001111111", "222222111111111111111", "222222211111111111111", "222222211111111111111", "222222222111111111111", "222222222111111111111", "222222222111111111111", "222222222111111111111"];
  const GRID_LIN = ["222200000000000000000", "222220000000000000000", "222222000000000000000", "222222000000000000000", "222222200000000000000", "222222220000000000000", "222222220000000000000", "222222222000000000000", "222222222200000000000", "222222222220000000000", "222222222221100000000", "222222222211111111100", "222222222111111111111", "222222221111111111111", "222222211111111111111", "222222111111111111111", "222221111111111111111", "222211111111111111111", "222111111111111111111", "221111111111111111111", "211111111111111111111"];
  const PTS = [[-0.324, 0.305, 1], [-0.017, -0.362, 2], [-0.697, -0.672, 0], [-0.171, 0.533, 1], [0.975, 0.194, 1], [-0.762, -0.053, 2], [0.973, -0.165, 1], [0.046, 0.629, 1], [-0.022, -0.317, 2], [0.148, -0.149, 2], [-0.101, -0.342, 2], [-0.305, 0.128, 1], [0.405, -0.253, 0], [0.013, 0.061, 0], [0.125, -0.206, 2], [0.058, 0.147, 0], [0.764, 0.381, 1], [0.095, -0.051, 2], [-0.244, -0.504, 2], [0.416, -0.293, 0], [-0.062, -0.043, 1], [-0.277, 0.038, 1], [0.018, 0.08, 0], [0.3, 0.619, 1], [-0.725, -0.141, 2], [-0.731, 0.332, 2], [-0.292, -0.936, 0], [0.053, -0.018, 2], [0.099, -0.098, 2], [0.005, -0.407, 2], [0.344, -0.063, 0], [0.098, -0.848, 0], [0.532, -0.512, 0], [-0.488, 0.731, 2], [-0.66, -0.69, 0], [0.421, 0.065, 0], [-0.664, -0.153, 2], [-0.287, -0.332, 2], [0.657, 0.426, 1], [0.4, 0.128, 0], [-0.147, -0.039, 1], [-0.706, 0.433, 2], [0.817, 0.416, 1], [0.041, 0.078, 0], [0.527, 0.646, 1], [0.009, 0.139, 0], [-0.113, 0.594, 1], [0.407, -0.016, 0], [-0.387, -0.473, 2], [-0.077, -0.875, 0], [0.082, -0.301, 2], [0.059, 0.64, 1], [0.045, -0.022, 2], [0.935, -0.057, 1], [0.501, -0.12, 0], [0.814, -0.046, 1], [-0.346, -0.473, 2], [-0.265, 0.247, 1], [0.446, -0.104, 0], [-0.715, 0.594, 2]];

  // train_step from flakes.py, line for line (line 0 = def)
  const CODE = [
    "def train_step(flakes, bins, W1, b1, W2, b2, lr):",
    "    hidden = np.maximum(0, flakes @ W1 + b1)",
    "    scores = hidden @ W2 + b2",
    "    exp = np.exp(scores - scores.max(axis=1, keepdims=True))",
    "    probs = exp / exp.sum(axis=1, keepdims=True)",
    "    loss = -np.log(probs[np.arange(len(bins)), bins]).mean()",
    "    d_scores = (probs - np.eye(3)[bins]) / len(bins)",
    "    d_hidden = (d_scores @ W2.T) * (hidden > 0)",
    "    W1 -= lr * flakes.T @ d_hidden; b1 -= lr * d_hidden.sum(axis=0)",
    "    W2 -= lr * hidden.T @ d_scores; b2 -= lr * d_scores.sum(axis=0)",
    "    return loss"
  ];
  // run_bug.py train_step_bug: line 7 without the ReLU slope
  const CODE_BUG = CODE.map((l, i) => i === 0 ? l.replace("train_step", "train_step_bug") : i === 7 ? "    d_hidden = d_scores @ W2.T" : l);

  // trace_step.out.txt: first 3 training flakes, 4 hidden units, lr 1.0. bins [2, 2, 0].
  const TR_BINS = [2, 2, 0];
  const TR_BEFORE = {
    W1: [[0.126, -0.132, 0.64, 0.105], [-0.536, 0.362, 1.304, 0.947]],
    W2: [[-0.07, -0.127, -0.062], [0.004, -0.233, -0.022], [-0.125, -0.073, -0.054], [-0.032, 0.041, 0.104]]
  };
  // [line that just ran, variables it changed (as traced)]
  const TRACE = [
    [1, { hidden: [[0.222, 0.0, 0.0, 0.0], [0.148, 0.0, 0.0, 0.0], [0.0, 0.0, 0.472, 0.173]] }],
    [2, { scores: [[-0.016, -0.028, -0.014], [-0.01, -0.019, -0.009], [-0.064, -0.027, -0.008]] }],
    [3, {}],
    [4, { probs: [[0.335, 0.33, 0.335], [0.334, 0.331, 0.335], [0.323, 0.335, 0.342]] }],
    [5, { loss: 1.1061327736207722 }],
    [6, { d_scores: [[0.112, 0.11, -0.222], [0.111, 0.11, -0.222], [-0.226, 0.112, 0.114]] }],
    [7, { d_hidden: [[-0.008, -0.0, -0.0, -0.0], [-0.008, -0.0, -0.0, -0.0], [-0.0, -0.0, 0.014, 0.024]] }],
    [8, { W1: [[0.119, -0.132, 0.634, 0.094], [-0.543, 0.362, 1.302, 0.944]] }],
    [9, { W2: [[-0.112, -0.167, 0.02], [0.004, -0.233, -0.022], [-0.018, -0.126, -0.108], [0.007, 0.022, 0.085]], b2: [0.003, -0.332, 0.33] }],
    [10, { returned: 1.1061327736207722 }]
  ];
  const LOSS_AFTER_ONE = 0.8944; // trace_step.out.txt "loss_after_one_update"

  // run_bug.out.txt
  const BUG = {
    correct: { loss: [1.1454, 0.305, 0.1518, 0.0993, 0.0732, 0.0575, 0.047, 0.0396, 0.0341, 0.0299, 0.0267, 0.0242, 0.0221, 0.0203, 0.0188, 0.0176, 0.0165, 0.0156, 0.0148, 0.0141, 0.0134], accTest: 0.9866666666666667 },
    bug: { loss: [1.1454, 0.6841, 0.6662, 0.6549, 0.6693, 0.6906, 0.7326, 0.6661, 0.6504, 0.7002, 0.7026, 0.7321, 0.6413, 0.5791, 0.7916, 0.6934, 0.7214, 0.6076, 0.7244, 0.7137, 0.7397], accTest: 0.6666666666666666 },
    every: 100,
    check: {
      correct: { W1: 5.7e-10, b1: 0.001, W2: 7.6e-11, b2: 5.1e-11 },
      bug: { W1: 0.47, b1: 1.0, W2: 7.6e-11, b2: 5.1e-11 }
    }
  };

  // run_sklearn.py (lines shown) and run_sklearn.out.txt (trimmed with … , not altered)
  const SK_CODE = [
    "from sklearn.neural_network import MLPClassifier",
    "",
    "model = MLPClassifier(hidden_layer_sizes=(32,), random_state=0)",
    "model.fit(flakes_train, bins_train)",
    "print(model.n_iter_, model.loss_, model.out_activation_)",
    "print(model.score(flakes_test, bins_test))"
  ];
  // run 2 and 3 change only the model = MLPClassifier(...) line (run_sklearn.py)
  const SK_RUNS = [
    { settings: "MLPClassifier(hidden_layer_sizes=(32,), random_state=0)",
      warn: "…/sklearn/neural_network/_multilayer_perceptron.py:785: ConvergenceWarning: Stochastic Optimizer: Maximum iterations (200) reached and the optimization hasn't converged yet.\n  warnings.warn(",
      out: "200 0.7147737814202626 softmax\n0.5533333333333333", nIter: 200, test: 0.5533333333333333 },
    { settings: "MLPClassifier(hidden_layer_sizes=(32,), max_iter=2000, random_state=0)",
      out: "1791 0.11476086434960195 softmax\n0.9266666666666666", nIter: 1791, test: 0.9266666666666666 },
    { settings: "MLPClassifier(hidden_layer_sizes=(32,), learning_rate_init=0.01, max_iter=2000, random_state=0)",
      out: "683 0.021227716584363794 softmax\n0.9733333333333334", nIter: 683, test: 0.9733333333333334 }
  ];
  const SK_BATCH_AUTO = 200; // MLPClassifier docs: batch_size "auto" = min(200, n_samples)

  /* ---------- Derived from the data ---------- */
  const softmax = s => { const m = Math.max(...s), e = s.map(v => Math.exp(v - m)), t = sum(e); return e.map(v => v / t); };
  const xent = (s, k) => -Math.log(softmax(s)[k]);
  const S = EARLY.scores, R = EARLY.right;
  const E = S.map(Math.exp), P = softmax(S);
  const LOSS1 = -Math.log(P[R]);
  const G = P.map((p, k) => p - (k === R ? 1 : 0)); // slope of the loss with respect to each score
  const last = a => a[a.length - 1];
  const nRight = acc => Math.round(acc * N_TEST);
  const LIN_RIGHT = nRight(LINEAR.accTest), NET_RIGHT = nRight(TRAIN.accTest);

  /* ---------- Lesson-local style and pictures ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-figs { display: flex; flex-wrap: wrap; gap: 14px 22px; margin: 14px 0 0; }
      .lx-${ID}-fig { flex: 1 1 220px; max-width: 330px; min-width: 0; }
      .lx-${ID}-fig svg { display: block; width: 100%; height: auto; }
      .lx-${ID}-cap { margin: 4px 0 0; font-size: 13.5px; color: var(--muted); line-height: 1.4; }
      .lx-${ID}-key { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 10px 0 0; font-size: 14px; color: var(--ink-2); }
      .lx-${ID}-key span { display: inline-flex; align-items: center; gap: 6px; }
      .lx-${ID}-key svg { width: 18px; height: 18px; }
      .lx-${ID}-mat { border-collapse: collapse; font: 500 14px/1.4 var(--mono); margin: 8px 0 0; }
      .lx-${ID}-mat th { font: 600 12.5px/1.3 var(--mono); color: var(--muted); text-align: right; padding: 3px 8px; }
      .lx-${ID}-mat td { text-align: right; padding: 3px 8px; border-top: 1px solid var(--line); color: var(--ink); }
      .lx-${ID}-mat td.lx-${ID}-hit { box-shadow: inset 0 0 0 2px var(--ink); }
      .lx-${ID}-mat td.lx-${ID}-zero { color: var(--faint); }
      .lx-${ID}-matname { font: 600 13px var(--mono); color: var(--muted); margin: 12px 0 0; }
      .lx-${ID}-wrap { overflow-x: auto; max-width: 100%; }
      .lx-${ID}-out { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; font: 500 13px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-calc { margin: 12px 0 0; }
    `;
    document.head.appendChild(s);
  }

  // Marks: PET an open circle, HDPE a filled square, PP an open triangle. Regions: plain / dotted / hatched.
  function mark(b, x, y, r) {
    if (b === 0) return `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.6"/>`;
    if (b === 1) return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" fill="var(--ink)" stroke="var(--surface)" stroke-width="0.8"/>`;
    return `<path d="M${x} ${y - r * 1.2} L${x + r * 1.1} ${y + r * 0.8} L${x - r * 1.1} ${y + r * 0.8} Z" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.6"/>`;
  }
  let patN = 0;
  function region(b, x, y, w, pid) {
    if (b === 0) return "";
    return `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="url(#${pid}${b === 1 ? "d" : ""})"/>`;
  }
  function regionPlot(grid, points, caption, hit) {
    const n = grid.length, W = 210, c = W / n, pid = `lx-${ID}-hatch${++patN}`;
    const to = v => (v + 1.1) / 2.2 * W;
    let cells = "";
    grid.forEach((row, r) => [...row].forEach((ch, k) => { cells += region(+ch, k * c, (n - 1 - r) * c, c + 0.2, pid); }));
    const pts = points.map(([x, y, b], i) => mark(b, to(x), W - to(y), i === hit ? 6 : 4)).join("");
    const ring = hit != null ? `<circle cx="${to(points[hit][0])}" cy="${W - to(points[hit][1])}" r="11" fill="none" stroke="var(--ink)" stroke-width="2"/>` : "";
    return `<figure class="lx-${ID}-fig" style="margin:0"><svg viewBox="0 0 ${W} ${W}" role="img" aria-label="${caption}">
      <defs><pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--faint)" stroke-width="2"/></pattern><pattern id="${pid}d" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="var(--surface)"/><circle cx="2.5" cy="2.5" r="1.3" fill="var(--faint)"/></pattern></defs>
      <rect width="${W}" height="${W}" fill="var(--surface)" stroke="var(--line)"/>${cells}${pts}${ring}</svg>
      <figcaption class="lx-${ID}-cap">${caption}</figcaption></figure>`;
  }
  function legend(withRegions) {
    const sw = b => `<svg viewBox="0 0 18 18">${withRegions ? `<rect width="18" height="18" fill="${b === 0 ? "var(--surface)" : b === 1 ? `url(#lx-${ID}-kdots)` : `url(#lx-${ID}-khatch)`}" stroke="var(--line)"/>` : ""}${mark(b, 9, 9.5, 4.5)}</svg>`;
    return `<svg width="0" height="0" style="position:absolute"><defs><pattern id="lx-${ID}-khatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--faint)" stroke-width="2"/></pattern><pattern id="lx-${ID}-kdots" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="var(--surface)"/><circle cx="2.5" cy="2.5" r="1.3" fill="var(--faint)"/></pattern></defs></svg>
      <div class="lx-${ID}-key">${BINS.map((b, i) => `<span>${sw(i)}${b}${withRegions ? (i === 0 ? " (plain area)" : i === 1 ? " (dotted area)" : " (hatched area)") : ""}</span>`).join("")}</div>`;
  }
  // Loss chart: series [{ vals, every, dash }], one shared y range from 0
  function chart(series, { ymax, caption }) {
    const W = 300, H = 140, L = 34, B = 22, T = 8, Rr = 8;
    const steps = Math.max(...series.map(s => (s.vals.length - 1) * s.every));
    const x = v => L + v / steps * (W - L - Rr), y = v => T + (1 - Math.min(v, ymax) / ymax) * (H - T - B);
    const lines = series.map(s => `<polyline fill="none" stroke="var(${s.dash ? "--muted" : "--ink"})" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ""} points="${s.vals.map((v, i) => `${x(i * s.every).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>`).join("");
    const t = (tx, ty, s, a) => `<text x="${tx}" y="${ty}" font-size="11" fill="var(--muted)" text-anchor="${a}" font-family="var(--mono)">${s}</text>`;
    return `<figure class="lx-${ID}-fig" style="margin:0"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${caption}">
      <line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="var(--line)"/><line x1="${L}" y1="${H - B}" x2="${W - Rr}" y2="${H - B}" stroke="var(--line)"/>
      ${t(L - 4, y(0) + 4, "0", "end")}${t(L - 4, y(ymax) + 9, ymax, "end")}${t(L, H - 6, "step 0", "start")}${t(W - Rr, H - 6, `step ${steps}`, "end")}
      ${lines}</svg><figcaption class="lx-${ID}-cap">${caption}</figcaption></figure>`;
  }
  // Matrix table: rows of numbers; rowNames, colNames; hit(r, c) rings a cell; faint zeros
  function mat(name, rows, rowNames, colNames, hit) {
    return `<div class="lx-${ID}-matname">${name}</div><div class="lx-${ID}-wrap"><table class="lx-${ID}-mat"><tr><th></th>${colNames.map(c => `<th>${c}</th>`).join("")}</tr>${rows.map((row, r) => `<tr><th>${rowNames[r]}</th>${row.map((v, c) => `<td class="${hit && hit(r, c) ? `lx-${ID}-hit` : ""} ${v === 0 ? `lx-${ID}-zero` : ""}">${f3(v).replace("-0.000", "0.000")}</td>`).join("")}</tr>`).join("")}</table></div>`;
  }
  const opt = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }

  /* 1. The situation, and softmax by hand. */
  function softmaxByHand({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [f3(S[R]), f3(E[R]), f3(1 / 3), f3(P[R])].map(s => opt(kit, s));
    const RIGHT = 3;
    const fb = [
      [`${f3(S[R])} is the HDPE score itself. A score is not a probability: scores can be negative (PET's is ${f2(S[0])}) and need not add up to 1. Raise e to each score first, then divide by the total.`, false],
      [`${f3(E[R])} is e<sup>score</sup> for HDPE, but you stopped halfway. It is more than 1, so it cannot be a probability. Divide it by the total of all three: ${E.map(f2).join(" + ")} = ${f2(sum(E))}.`, false],
      ["A third each would mean the network has no opinion. Its scores differ, so its probabilities differ too: the bigger the score, the bigger the share.", false],
      [`Right: ${f2(E[R])} ÷ ${f2(sum(E))} = ${f3(P[R])}. The three probabilities are ${P.map(f3).join(", ")}; they add up to 1. This recipe is called <b>softmax</b>. The network gives PP the biggest share, so it would drop this HDPE flake in the PP bin.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Three bins, two sensors</h1>
        <p class="lead">A recycling plant shreds plastic into flakes and must sort them into three bins: PET, HDPE and PP. Each flake passes two sensors, and each gives one reading. A small neural network reads both and gives each bin a <b>score</b>. The plant needs a probability per bin, to decide and to learn from mistakes. In this lesson you train that network yourself, from scratch: the steps PyTorch will later run for you.</p>
        <p class="lead">The recipe: raise e (about 2.718) to each score (so every number turns positive), then divide each by the total of the three. Here is a real HDPE flake, scored by the network after ${EARLY.step} training updates:</p>
        ${mat(`flake reading (${EARLY.reading.join(", ")}), right bin ${BINS[R]}`, [S, E], ["score", "e^score"], BINS)}
        <p class="task">What probability does the network give the right bin, HDPE?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Cross-entropy: one number for how wrong the flake's answer is. */
  function crossEntropy({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [-Math.log(P[2]), 1 - P[R], -Math.log10(P[R]), LOSS1].map(v => opt(kit, f3(v)));
    const RIGHT = 3;
    const SAMPLES = [0.9, 0.5, 0.1, 0.01];
    const fb = [
      [`${f3(-Math.log(P[2]))} is minus the log of PP's probability, the bin the network <i>picked</i>. The loss always looks at the <b>right</b> bin, HDPE, whatever the network picked. Otherwise it would reward confident mistakes.`, false],
      [`${f3(1 - P[R])} is 1 minus the probability. That shrinks toward 0 as the network gets it right, but it never grows past 1, so a confident wrong answer costs at most 1. The rule here is minus the natural log, which has no ceiling.`, false],
      [`${f3(-Math.log10(P[R]))} uses a base-10 log. The loss uses the natural log (ln), the one whose slope makes the next screen work out so neatly.`, false],
      [`Right: −ln ${f3(P[R])} = ${f3(LOSS1)}. This loss is called <b>cross-entropy</b>. Look how it grows when the right bin's probability falls: ${SAMPLES.map(p => `${p} → ${f2(-Math.log(p))}`).join(", ")}. A confident wrong answer costs a lot. Training lowers the average of this number over all flakes.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>How wrong was it?</h1>
        <p class="lead">Training needs one number per flake that says how bad the answer was. The rule: take the probability the network gave the <b>right</b> bin, and the loss is minus its natural log, −ln(p). A probability of 1 gives a loss of 0. It is the log loss from logistic regression, now with three bins.</p>
        ${mat("the same flake, right bin HDPE", [S, P], ["score", "probability"], BINS, (r, c) => r === 1 && c === R)}
        <p class="task">What is this flake's loss?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: the loss's slope for each score is probability minus 1 for the right bin. */
  function spotGradient({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const H = 0.001;
    const numeric = S.map((_, k) => { const up = S.slice(), dn = S.slice(); up[k] += H; dn[k] -= H; return (xent(up, R) - xent(dn, R)) / (2 * H); });
    const shifted = softmax(S.map(v => v - 1));
    const nud = v => BINS.map((b, k) => `${b} ${sgn(v[k])}`).join(", ");
    const opts = [
      `Raise HDPE by ${f2(-G[R])}; leave PET and PP alone`,
      `Lower all three scores by the same amount`,
      `Move each score against its slope: ${nud(G.map(g => -g))}`,
      `Lower PET the most: ${BINS[0]} −${f2(-G[R])}, the others unchanged`
    ];
    const RIGHT = 2;
    const fb = [
      [`That helps, but it ignores PP. The probabilities share one total, so PP's ${f3(P[2])} is taken straight from HDPE. Lowering PP raises HDPE's share too. The loss has a slope for every score, not just the right one.`, false],
      [`Try it: lower every score by 1 and the probabilities are ${shifted.map(f3).join(", ")}, exactly the same as before. Softmax only sees the <b>differences</b> between scores, so a shift of all three changes nothing and the loss stays ${f3(LOSS1)}.`, false],
      [`Right. For each score, the slope of the loss is its probability, minus 1 for the right bin: ${BINS.map((b, k) => `${b} ${f3(G[k])}`).join(", ")}. Check it by nudging each score by ${H} and watching the loss: the measured slopes are ${numeric.map(f3).join(", ")}. This vector is the <b>gradient</b> of the loss with respect to the scores. In NumPy it is one line, <code>probs - one_hot</code>, and it is where the backward pass starts. From here it flows back through the layers exactly as in the previous lesson.`, true],
      [`PET has a probability of only ${f3(P[0])}. Lowering its score frees almost nothing for HDPE: its slope is ${f3(G[0])}, nearly flat. The big slopes are on HDPE (too low) and PP (too high).`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Which way should each score move?</h1>
        <p class="lead">Training changes the network's weights, and that moves this flake's scores. Forget the weights for a moment. Each score has a <b>slope</b>: how much the loss changes when that score goes up a little. If you could push the three scores directly, which push lowers the loss of ${f3(LOSS1)} fastest?</p>
        ${mat("the same flake, right bin HDPE", [S, P], ["score", "probability"], BINS)}
        <p class="task">Pick the push that lowers the loss fastest.</p>
        <div class="lpanel">${ask(kit, opts.map(s => kit.esc(s)), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Why a hidden layer: a model with no hidden layer can only draw straight borders. */
  function lineVsNet({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "It needs more training steps",
      "Its borders between bins can only be straight lines, and the three kinds curl around each other",
      "The learning rate was too small",
      "Softmax can only choose well between two bins"
    ];
    const RIGHT = 1;
    const fb = [
      ["More steps move the borders, but cannot bend them. With no hidden layer, the bin with the top score changes only along straight lines, whatever the weights are. Look at the map: three wedges with straight edges.", false],
      [`Right. With scores = readings @ W + b, each border between two bins is where two straight-line formulas are equal: a straight line. No setting of W fits three arms that wind around each other. The network adds a hidden layer of ${TRAIN.hidden} units with a ReLU, max(0, ·), between the readings and the scores. Each unit bends the map along one line, and together they bend the borders around the arms. Same softmax, same loss, same update rule: ${pct(TRAIN.accTest)} of the test flakes right (${NET_RIGHT} of ${N_TEST}), with ${TRAIN.params} weights in all.`, true],
      [`The learning rate changes how fast the weights move, not what shapes the borders can take. The same rate, 1.0, trains a network with a hidden layer to ${pct(TRAIN.accTest)} of these test flakes.`, false],
      ["Softmax handles any number of bins, and a better network uses the same softmax over the same three bins. The limit is in what comes before it: the scores are straight-line formulas of the readings.", false]
    ];
    const paint = () => {
      const after = ans === RIGHT;
      el.innerHTML = `<h1>Why not a straight line?</h1>
        <p class="lead">The plant first tried the simplest model: each bin's score is a weighted sum of the two readings plus a constant, then softmax, the same loss, and about ${(TRAIN.loss.length - 1) * TRAIN.every} steps of gradient descent. It sorted ${LIN_RIGHT} of ${N_TEST} test flakes right (${pct(LINEAR.accTest)}). The map shows which bin it picks at each point: across is the first reading, up is the second. ${PTS.length} of the test flakes sit on top.</p>
        <div class="lx-${ID}-figs">${regionPlot(GRID_LIN, PTS, `No hidden layer: ${pct(LINEAR.accTest)} of test flakes right`)}${after ? regionPlot(GRID_NET, PTS, `${TRAIN.hidden} hidden units: ${pct(TRAIN.accTest)} right`) : ""}</div>
        ${legend(true)}
        <p class="task">Why can this model not do better?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. One training step in NumPy, replayed from a real trace, with one prediction. */
  const FLAKES3 = ["flake 1", "flake 2", "flake 3"];
  const UNITS = ["unit 1", "unit 2", "unit 3", "unit 4"];
  const QF = TRACE.findIndex(t => t[0] === 6); // the frame that reveals d_scores
  const probsRow = TRACE.find(t => t[1].probs)[1].probs;
  const dRow = TRACE[QF][1].d_scores;
  const unchangedCols = (a, b) => a[0].map((_, c) => c).filter(c => a.every((row, r) => row[c] === b[r][c]));
  const unchangedRows = (a, b) => a.map((_, r) => r).filter(r => a[r].every((v, c) => v === b[r][c]));
  function sayFrame(i) {
    const [ln, ch] = TRACE[i];
    const binsTxt = TR_BINS.map(b => BINS[b]).join(", ");
    if (ln === 1) return `Forward pass. Each of the 3 flakes (bins ${binsTxt}) goes through ${ch.hidden[0].length} hidden units. ReLU, <code>np.maximum(0, …)</code>, turned every negative into 0. Unit 2 is 0 for all three flakes.`;
    if (ln === 2) return "Three scores per flake. The output weights start small, so all scores are near 0.";
    if (ln === 3) return "Before raising e, each row subtracts its own largest score. This changes no probability: softmax only sees the differences between scores. It is there so that e<sup>score</sup> does not overflow when scores get big.";
    if (ln === 4) return "Softmax: each row now adds up to 1. With scores near 0, every bin gets about a third.";
    if (ln === 5) return `The loss is the mean of −ln(probability of the right bin) over the 3 flakes: ${f3(ch.loss)}. A network that gives a third to everything scores −ln(1/3) = ${f3(Math.log(3))}, so a fresh network whose output weights start small begins close to that.`;
    if (ln === 6) return "Backward pass starts: probabilities minus 1 in the right bin's column, divided by 3 because the loss is a mean over 3 flakes.";
    if (ln === 7) return "The slopes go back through W2 to the hidden units, times 0 wherever a unit was off (its ReLU output was 0). Unit 2 was off for every flake, so its whole column is 0: it gets no blame.";
    if (ln === 8) { const u = unchangedCols(TR_BEFORE.W1, ch.W1); return `Update the first layer: each weight moves against its slope, times <code>lr</code>, the learning rate (the step size). Column${u.length === 1 ? "" : "s"} ${u.map(c => c + 1).join(", ")} of W1 did not change: ${u.length === 1 ? "that unit" : "those units"} got no blame.`; }
    if (ln === 9) { const u = unchangedRows(TR_BEFORE.W2, ch.W2); return `Update the output layer. Row ${u.map(r => r + 1).join(", ")} of W2 did not move: it multiplies unit ${u.map(r => r + 1).join(", ")}, whose output was 0. b2 moved toward PP, because 2 of the 3 flakes are PP.`; }
    return `It returns the loss from line 5. Run on the same 3 flakes after this one update, the loss is ${f3(LOSS_AFTER_ONE)}, down from ${f3(ch.returned)}. One step downhill.`;
  }
  function frameVars(i) {
    const ch = TRACE[i][1];
    const parts = [];
    if (ch.hidden) parts.push(mat("hidden (3 × 4)", ch.hidden, FLAKES3, UNITS));
    if (ch.scores) parts.push(mat("scores (3 × 3)", ch.scores, FLAKES3, BINS));
    if (ch.probs) parts.push(mat("probs (3 × 3)", ch.probs, FLAKES3, BINS, (r, c) => c === TR_BINS[r]));
    if (ch.d_scores) parts.push(mat("d_scores (3 × 3)", ch.d_scores, FLAKES3, BINS, (r, c) => c === TR_BINS[r]));
    if (ch.d_hidden) parts.push(mat("d_hidden (3 × 4)", ch.d_hidden, FLAKES3, UNITS));
    if (ch.W1) parts.push(mat("W1 after (2 × 4)", ch.W1, ["reading 1", "reading 2"], UNITS));
    if (ch.W2) parts.push(mat("W2 after (4 × 3)", ch.W2, UNITS, BINS), mat("b2 after", [ch.b2], [""], BINS));
    return parts.join("");
  }
  function codeStep({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const r3 = probsRow[2], b3 = TR_BINS[2];
    const raw = r3.map((p, k) => p - (k === b3 ? 1 : 0));
    const fmtRow = a => `[${a.map(f3).join(", ")}]`;
    const qOpts = [fmtRow(raw.map(v => -v / 3)), fmtRow(raw), fmtRow(dRow[2]), fmtRow(r3.map(v => v / 3))];
    const QR = 2;
    const qFb = [
      ["The signs are flipped. The slope is probability minus 1 for the right bin, so the right bin's entry is negative: raising that score lowers the loss. The update line then subtracts the slope.", false],
      ["Close, but you left out the division by <code>len(bins)</code>. The loss is the <b>mean</b> over 3 flakes, so each flake's share of the slope is divided by 3.", false],
      null,
      ["You divided by 3 but forgot the minus 1 in the right bin's column. Without it, every score gets pushed down, the right one included, and the flake never learns which bin it belongs in.", false]
    ];
    const paint = () => {
      const [ln] = TRACE[i];
      const gate = i === QF && ans !== QR;
      el.innerHTML = `<h1>One training step in NumPy</h1>
        <p class="lead">This is the whole step: forward (lines 1–5), backward (6–7), update (8–9); the <code>def</code> line is line 0. It ran on 3 training flakes with 4 hidden units so every number fits on screen. Step through it; each step shows what the highlighted line just made.</p>
        <p class="task">${gate ? `Line 6 runs now. Flake 3 is ${BINS[b3]} and its probabilities are ${fmtRow(r3)}. What row of <code>d_scores</code> will it get?` : "Step through to the end."}</p>
        ${kit.code(CODE, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || gate ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>line <b>${ln}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${gate ? `<div class="lpanel">${ask(kit, qOpts.map(s => opt(kit, s)), QR, ans, qFb)}</div>` : `${kit.feedback(sayFrame(i) + (i === QF ? ` You predicted flake 3's row: ${fmtRow(dRow[2])}.` : ""))}${frameVars(i)}`}`;
      const prev = el.querySelector("[data-prev]"), next = el.querySelector("[data-next]");
      prev.onclick = () => { i--; paint(); };
      next.onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); });
    };
    // Frames before QF show the line that ran; QF asks first, then shows d_scores.
    paint();
  }

  /* 6. Learning rate: predict falls, stalls or blows up. */
  const SHAPES = ["Falls fast, then levels off low", "Creeps down, almost flat", "Jumps up and bounces"];
  const LR_RIGHT = [1, 0, 2];
  function lrFeedback(k, pick) {
    const r = LR_RUNS[k], a = r.loss[0], z = last(r.loss), hi = Math.max(...r.loss), steps = (r.loss.length - 1) * LR_EVERY;
    const real = [`From ${f3(a)} to ${f3(z)} in ${steps} steps: it does fall, but so slowly that it looks flat.`,
      `From ${f3(a)} to ${f3(z)} in ${steps} steps.`,
      `It jumped from ${f3(a)} to ${f3(r.loss[1])} within ${LR_EVERY} steps and bounced as high as ${f3(hi)}, ending at ${f3(z)}.`][k];
    if (pick === LR_RIGHT[k]) {
      const why = [`Each update moves the weights by <code>lr</code> × slope, so ${r.lr} makes steps a thousand times smaller than 1.0.`,
        "The step is big enough to make progress and small enough that the loss is lower at every checkpoint.",
        `Each step jumps far past the low point, lands somewhere worse, and jumps again. The run even printed <code>${LR_WARNING}</code>: at one step a flake's probability for its right bin came out as exactly 0 in floating point, so its loss was infinite.`][k];
      return [`${real} ${why}`, true];
    }
    const wrongWhy = {
      "0,0": "It does go down, but only a little: lr × slope with lr = 0.001 makes tiny steps, so it never gets near a low loss in this run.", "0,2": "Tiny steps cannot overshoot; they only crawl.",
      "1,1": "1.0 is a thousand times the rate that crawled. A good rate depends on the network and the data, not on how the number looks.", "1,2": "1.0 sounds big, but the step is lr × slope, and whether that overshoots depends on this loss, not on the number alone.",
      "2,0": "Thirty times the working rate does not mean thirty times faster. The steps overshoot the low point.", "2,1": "A big rate never stalls quietly: every step moves the weights a lot."
    }[`${k},${pick}`];
    return [`${wrongWhy} The real run: ${real}`, false];
  }
  function learningRates({ el, done, kit }) {
    ensureStyle();
    const ans = LR_RUNS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Falls, stalls or blows up?</h1>
        <p class="lead">The full network (${TRAIN.hidden} hidden units) trains on all ${N_TRAIN} training flakes, one step at a time: each step runs <code>train_step</code> once, and every weight moves by <code>lr</code> × its slope. Three runs start from the same weights and differ only in <code>lr</code>. Each runs ${(LR_RUNS[0].loss.length - 1) * LR_EVERY} steps. The loss starts at ${f3(LR_RUNS[0].loss[0])}.</p>
        <p class="task">For each learning rate, predict what the loss does. Pick again if you change your mind.</p>
        ${LR_RUNS.map((r, k) => `<div class="lcase" id="c${k}"><p><b>lr = ${r.lr}</b></p>${kit.options(SHAPES, { picked: ans[k], correct: LR_RIGHT[k] })}${ans[k] == null ? "" : kit.feedback(...lrFeedback(k, ans[k]))}${ans[k] === LR_RIGHT[k] ? `<div class="lx-${ID}-figs">${chart([{ vals: r.loss, every: LR_EVERY }], { ymax: Math.ceil(Math.max(...r.loss)), caption: `loss, lr = ${r.lr}` })}</div>` : ""}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, k) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[k] = +b.dataset.i; paint();
        if (LR_RUNS.every((_, j) => ans[j] === LR_RIGHT[j])) done();
      }));
    };
    paint();
  }

  /* 7. Broken on purpose: a backward pass with the ReLU slope missing. */
  function brokenBackward({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const ck = BUG.check;
    const names = ["W1", "b1", "W2", "b2"];
    const fmtE = v => v >= 0.01 ? String(v) : v.toExponential(1);
    const lineOpts = [4, 6, 7, 9];
    const L_RIGHT = 2;
    const lineFb = [
      ["Line 4 is part of the forward pass. The numerical check measures the slope of this same forward pass, so a forward bug would not make backprop and the check disagree. And the loss does fall at first.", false],
      ["Line 6 feeds W2 and b2, and those two pass the check almost exactly. If <code>d_scores</code> were wrong, they would be wrong too.", false],
      null,
      ["Line 9 updates W2 and b2, which pass the check. The parameters that fail, W1 and b1, are updated on line 8 from <code>d_hidden</code>.", false]
    ];
    const fixOpts = ["    d_hidden = (d_scores @ W2.T) * (hidden > 0)", "    d_hidden = np.maximum(0, d_scores @ W2.T)", "Keep the line and lower lr to 0.1", "Delete np.maximum from line 1 so there is no ReLU to undo"];
    const F_RIGHT = 0;
    const fixFb = [
      [`Right. That is line 7 of the working <code>train_step</code>. A ReLU unit that output 0 does not change the loss when its input moves a little, so its slope is 0 and it must get no blame. Without the mask, units that were off still had their weights pushed, in directions that do not lower the loss. With the mask: test accuracy ${pct(BUG.correct.accTest)} instead of ${pct(BUG.bug.accTest)}, and every parameter passes the check.`, true],
      ["This clips the <b>slopes</b> at 0, which is not what ReLU's derivative does. The mask must depend on whether the unit was on in the forward pass (<code>hidden > 0</code>), not on the sign of the slope coming back.", false],
      ["The direction is wrong, not the step size. A smaller step in a wrong direction is still wrong; the check would still fail for W1 and b1 at any lr.", false],
      [`Without ReLU the hidden layer is a straight-line formula again, and the whole network can only draw straight borders, like the ${pct(LINEAR.accTest)} model on screen 4.`, false]
    ];
    const paint = () => {
      const table = kit.table(names.map(n => [n, `${fmtE(ck.correct[n])}   vs   ${fmtE(ck.bug[n])}`]), { head: ["parameter", "working   vs   new"], title: "gradient check: relative error" });
      el.innerHTML = `<h1>Broken on purpose: the loss stops falling</h1>
        <p class="lead">A teammate rewrote the step. Same data, same start, lr 1.0, about ${(BUG.bug.loss.length - 1) * BUG.every} steps. The new version's loss drops to ${f3(BUG.bug.loss[1])} and then wanders between ${f3(Math.min(...BUG.bug.loss.slice(1)))} and ${f3(Math.max(...BUG.bug.loss.slice(1)))}; test accuracy ${pct(BUG.bug.accTest)}. The working version reaches ${f3(last(BUG.correct.loss))}.</p>
        <div class="lx-${ID}-figs">${chart([{ vals: BUG.bug.loss, every: BUG.every }, { vals: BUG.correct.loss, every: BUG.every, dash: true }], { ymax: Math.ceil(BUG.bug.loss[0]), caption: "loss: new version (solid), working version (dashed)" })}</div>
        <p class="lead">A <b>gradient check</b> compares each parameter's backprop slope with a measured one (nudge the weight, watch the loss, as in the previous lesson). A relative error near 0 means the two agree. In the code below, the <code>def</code> line is line 0.</p>
        ${table}
        ${kit.code(CODE_BUG, stage === 0 ? -1 : 7)}
        <p class="task">${stage === 0 ? "Which line of the new version is wrong?" : "Line 7 it is. What should it say?"}</p>
        <div class="lpanel">${stage === 0
          ? ask(kit, lineOpts.map(n => opt(kit, `line ${n}: ${CODE_BUG[n].trim()}`)), L_RIGHT, ans, lineFb)
          : ask(kit, fixOpts.map(s => opt(kit, s.trim())), F_RIGHT, ans, fixFb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (stage === 0 && ans === L_RIGHT) { stage = 1; ans = null; paint(); return; }
        paint();
        if (stage === 1 && ans === F_RIGHT) done();
      });
    };
    paint();
  }

  /* 8. The same job with scikit-learn: two lines, and the parameters that matter. */
  function withSklearn({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const r0 = SK_RUNS[0];
    const epochSteps = Math.ceil(N_TRAIN / Math.min(SK_BATCH_AUTO, N_TRAIN));
    const opts = [
      "Raise max_iter: it stopped at its limit before it finished",
      "Shrink the hidden layer to hidden_layer_sizes=(2,)",
      "Switch back to the NumPy code: MLPClassifier cannot learn curled shapes",
      "Ignore the warning: about 55% is the best this data allows"
    ];
    const RIGHT = 0;
    const out = r => `<div class="lx-${ID}-out">${r === r0 ? "" : `model = ${kit.esc(r.settings)}\n…\n`}${r.warn ? kit.esc(r.warn) + "\n" : ""}${kit.esc(r.out)}</div>`;
    const fb = [
      [`Right. The warning says it hit the limit of ${r0.nIter}. Two more runs:${out(SK_RUNS[1])}${out(SK_RUNS[2])}<p class="lx-${ID}-cap">Recorded run on this Mac, run_sklearn.py</p>
        The three parameters that matter here: <code>hidden_layer_sizes</code> (one hidden layer of 32 units, like yours); <code>max_iter</code>, which for this solver counts <b>epochs</b>, passes over all ${N_TRAIN} flakes in batches of up to ${SK_BATCH_AUTO} (so about ${epochSteps} weight updates per epoch), not single steps; and <code>learning_rate_init</code>, the starting step size (default 0.001). Raising it to 0.01 reached ${pct(SK_RUNS[2].test)} in ${SK_RUNS[2].nIter} epochs. <code>fit</code> runs the forward pass, backward pass and updates you wrote, with a smarter update rule (Adam, by default). The docs also warn the network is sensitive to the scale of the inputs; these readings are already between about −1 and 1.`, true],
      ["Two hidden units can bend the borders only along two lines. Your NumPy network needed many more to wrap the arms. Fewer units cannot fix a run that simply stopped too early.", false],
      [`<code>out_activation_='softmax'</code>: it is the same kind of network, softmax and cross-entropy on top of a ReLU hidden layer. Your NumPy version reached ${pct(TRAIN.accTest)} on these flakes, so the shape is learnable; this run stopped too early.`, false],
      [`Your own NumPy network got ${pct(TRAIN.accTest)} of the same test flakes right. And the warning says plainly that the optimization had not converged. ${pct(r0.test)} is where it stopped, not the best possible.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same network in scikit-learn</h1>
        <p class="lead">scikit-learn's <code>MLPClassifier</code> builds and trains the same kind of network. Here it is on the same ${N_TRAIN} training and ${N_TEST} test flakes:</p>
        ${kit.code(SK_CODE, -1)}
        ${out(r0)}
        <p class="lx-${ID}-cap">Recorded run on this Mac, run_sklearn.py (path trimmed with …). The lines are: the warning; then n_iter_ (how many rounds it ran), loss_ (the final training loss) and out_activation_ (the output function); then the test accuracy.</p>
        <p class="task">Test accuracy ${pct(r0.test)} and a warning. What do you change first?</p>
        <div class="lpanel">${ask(kit, opts.map(s => kit.esc(s)), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Training goes badly until the readings are put on the same scale",
      "scikit-learn runs out of GPU memory",
      "The gradient check starts failing",
      "Softmax cannot take three readings"
    ];
    const RIGHT = 0;
    const fb = [
      ["Right. The scikit-learn docs say it plainly: the network is sensitive to feature scaling; scale every input (for example with <code>StandardScaler</code>) and apply the same scaling to new flakes. A reading in the hundreds next to readings near 1 makes its weights' slopes far bigger than the others', so no single learning rate suits them all.", true],
      [`The scikit-learn guide for MLPClassifier says it offers no GPU support, so it never asks for GPU memory; and ${N_TRAIN} flakes with three readings is a tiny job for a CPU.`, false],
      ["The gradients are still correct; backprop does not care about units. What goes wrong is the size of the steps each weight takes, which is a training problem, not a gradient bug.", false],
      ["Softmax works on the scores at the end, not on the readings. The first layer simply gets one more row of weights.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for this</h1>
        <p class="lead"><b>For:</b> classes whose borders curve, with enough labelled examples to fit the weights.</p>
        <p class="lead"><b>Write it from scratch</b> once to understand it, and when you must debug a training run. <b>Use a library</b> for real work: <code>MLPClassifier</code> for small tables on a CPU, a deep learning framework for large data or a GPU.</p>
        <p class="lead"><b>Not</b> when a straight line separates the classes (logistic regression), when each decision must be explained (a small tree or a linear model), or for images and millions of rows (a deep learning framework on a GPU).</p>
        <p class="lead"><b>Costs:</b> choices to tune (hidden size, learning rate, iterations), runs that differ with the random start, and inputs that must be scaled.</p>
        <p class="task">The plant adds a third sensor: density, in kg/m³, readings in the hundreds. The other two stay near 1. What goes wrong first?</p>
        <div class="lpanel">${ask(kit, opts.map(s => kit.esc(s)), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it, including cases where this is the wrong tool. */
  const CASES = [
    ["A packaging line labels 40,000 items as one of five materials from four light readings. The materials overlap in curved patches when you plot the readings.", true,
      "Yes. Curved borders between several classes, plenty of labelled rows, a few numeric inputs: a small network with a softmax output fits. Scale the four readings first.",
      "The borders curve, so a straight-line model will miss whole patches, and 40,000 labelled rows is plenty for a small hidden layer. This is the shape of the flake problem."],
    ["A clinic has 120 patient rows and must explain to an auditor why each request was turned down.", false,
      "No. The auditor needs a reason for each decision, and a hidden layer gives you a pile of weights, not a reason. With only 120 rows you also cannot hold back many for testing, and the scikit-learn docs note that different random starts can give different results. Start with logistic regression or a small decision tree, whose rules you can show.",
      "The deciding point is the auditor: each decision needs a reason a person can read, and a hidden layer's weights do not give one. With 120 rows there is also too little left over to test a network and its tuning. A linear model or a small tree can show its rules."],
    ["Two kinds of bottle are told apart by weight alone: everything over 30 g is one kind.", false,
      "No. One threshold on one reading already separates them: a straight line. A hidden layer adds tuning (size, learning rate, iterations) and buys nothing. Logistic regression, or the threshold itself.",
      "The border is a single cut on one reading. A network would learn that cut after much tuning; a linear model or the plain rule gets it at once."],
    ["Sorting two million product photos by material, on a machine with a GPU.", false,
      "No, not with this tool. Images need a far bigger network, and the scikit-learn docs say MLPClassifier is not meant for large-scale use and has no GPU support. Use a deep learning framework such as PyTorch (next unit).",
      "A neural network, yes; MLPClassifier or hand-written NumPy, no. Millions of images need a GPU and a framework built for big networks. The scikit-learn docs point you elsewhere for that."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Small network or not?</h1>
        <p class="lead">Four jobs from other places. The tool is a small network with one hidden layer and a softmax output, trained by backprop. That means scikit-learn's <code>MLPClassifier</code>, or the NumPy version you just stepped through.</p>
        <p class="task">Would you reach for it in each case? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You trained a network from scratch</h1>
      <p class="lead">You turned scores into probabilities with softmax, scored them with cross-entropy, found that the loss's slope is "probabilities minus 1 for the right bin", stepped through forward, backward and update in ${CODE.length - 1} lines of NumPy, saw the learning rate decide between crawling, learning and blowing up, caught a missing ReLU slope with a gradient check, and got the same network from <code>MLPClassifier</code>.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the backward pass and the update for a small softmax network yourself, and make a gradient check pass.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. PyTorch tensors hold the same matrices you used here, and they can run on a GPU and work out the backward pass for you.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Train a three-class network from scratch",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/generated/sklearn.neural_network.MLPClassifier.html",
      "https://scikit-learn.org/stable/modules/neural_networks_supervised.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.sum.html",
      "https://www.deeplearningbook.org/contents/mlp.html"
    ],
    interview: [
      {
        q: "You wrote a training loop by hand. The loss drops at first, then wanders well above where it should settle. How do you find out whether the backward pass is wrong?",
        good: [
          "Run a gradient check: on a small batch, compare each parameter's backprop gradient with a numerical one from nudging it",
          "Look at the relative error per parameter: the ones that fail point to the layer, and the ones that pass clear the lines that feed them",
          "Check activation derivatives: a ReLU unit that was off must pass back zero",
          "If every gradient checks out, look at the learning rate and the input scaling instead"
        ],
        weak: "Lower the learning rate and train longer. That can hide a wrong gradient without ever finding it."
      },
      {
        q: "A teammate wants a neural network for a 300-row table with four numeric columns and three classes. What do you ask, and what do you try first?",
        good: [
          "Try a linear baseline such as logistic regression first; if a straight border works, a network adds nothing",
          "Plot or inspect the classes: a network earns its cost only when the borders curve",
          "If you try one, start with a small MLPClassifier, scale the inputs, and compare test accuracy with the baseline",
          "Expect to tune hidden size, learning rate and iterations, and check the result over a few random seeds",
          "Ask whether each decision must be explained; if so, prefer a model whose rules can be read"
        ],
        weak: "Neural networks are the most powerful option, so use one. That skips the baseline, the scaling and the question of whether the data even needs curves."
      }
    ],
    screens: [softmaxByHand, crossEntropy, spotGradient, lineVsNet, codeStep, learningRates, brokenBackward, withSklearn, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(QF).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]", ...Array(TRACE.length - 1 - QF).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: LR_RUNS.map((_, k) => `#c${k} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
