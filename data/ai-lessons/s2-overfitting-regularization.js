/* Lesson: overfitting and regularization. Story: an energy company forecasts a building's daily electricity use
   from the day's outdoor temperature; a degree-12 curve chases every noisy day.
   Ideas: (1) the gap between training loss and validation loss is how you see overfitting; (2) an L2 penalty
   (strength x sum of squared weights, base load left out) makes wild weights expensive, and its strength is picked
   on validation; L1 (absolute weights) sets some weights exactly to zero.
   Data, all from real runs on this Mac (seed 1), in docs/ai-path/runs/s2-overfitting-regularization/:
   - building.py: the 16 training and 16 validation days (generated, never typed), curve_features, fit_ridge, mse;
   - fit_runs.py + fit_runs.out.txt: the three curves, the degree sweep, the hand-loss weights, the strength sweep;
   - trace_pick.py + trace_pick.out.txt: pick_strength traced line by line;
   - broken_fit.py + broken_fit.out.txt: fit_ridge with the base-load line removed (broken on purpose);
   - sklearn_run.py + sklearn_run.out.txt: scikit-learn Ridge and Lasso on the same features. env.txt: versions.
   No model calls were recorded for this lesson.
   Lesson-local picture and style: a small SVG plot of days and curves, a three-column pickable table
   (.lx-s2-overfitting-regularization-*), see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s2-overfitting-regularization";
  const fmt = (n, d = 1) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d });
  const miss = mse => Math.round(Math.sqrt(mse)); // typical miss in kWh = square root of the mean squared error
  const sum = a => a.reduce((x, y) => x + y, 0);

  /* ---------- Data copied from docs/ai-path/runs/s2-overfitting-regularization/*.out.txt ---------- */
  // fit_runs.out.txt
  const TRAIN_T = [-5.0, 35.0, 0.8, 32.9, 7.5, 11.9, 28.1, 11.4, 17.0, -3.9, 25.1, 16.5, 8.2, 26.5, 7.1, 13.1];
  const TRAIN_U = [579.0, 556.0, 434.0, 444.0, 354.0, 307.0, 413.0, 349.0, 219.0, 505.0, 334.0, 287.0, 353.0, 361.0, 422.0, 276.0];
  const VAL_T = [30.9, -2.5, 16.1, 13.5, -1.6, 20.4, 28.4, 18.5, 5.9, 27.9, 15.4, 15.4, 24.6, 1.6, 27.1, 22.0];
  const VAL_U = [426.0, 504.0, 322.0, 292.0, 534.0, 275.0, 405.0, 301.0, 336.0, 362.0, 303.0, 310.0, 305.0, 409.0, 367.0, 301.0];
  const SWEEP = [[1, 9252.7, 5586.1], [2, 1202.2, 462.6], [3, 978.5, 487.4], [4, 934.4, 626.1], [5, 787.9, 983.9], [6, 446.2, 1844.3], [7, 416.3, 1704.9], [8, 357.3, 1955.0], [9, 350.9, 2051.8], [10, 347.0, 2951.2], [11, 324.0, 9710.3], [12, 299.9, 92725.6]];
  const GRID = Array.from({ length: 41 }, (_, i) => i - 5); // -5 .. 35 deg C, 1-degree steps
  const CURVE = {
    1: [408.6, 407.5, 406.4, 405.3, 404.2, 403.1, 402.0, 400.9, 399.8, 398.7, 397.6, 396.5, 395.4, 394.3, 393.2, 392.1, 390.9, 389.8, 388.7, 387.6, 386.5, 385.4, 384.3, 383.2, 382.1, 381.0, 379.9, 378.8, 377.7, 376.6, 375.5, 374.4, 373.3, 372.2, 371.0, 369.9, 368.8, 367.7, 366.6, 365.5, 364.4],
    3: [553.9, 536.4, 519.0, 501.8, 484.7, 468.0, 451.6, 435.6, 420.0, 405.0, 390.6, 376.9, 363.9, 351.6, 340.2, 329.8, 320.2, 311.8, 304.4, 298.2, 293.2, 289.5, 287.2, 286.3, 286.8, 288.9, 292.6, 298.0, 305.1, 314.0, 324.8, 337.4, 352.1, 368.8, 387.6, 408.6, 431.8, 457.3, 485.2, 515.5, 548.3],
    12: [579.0, 567.9, -69.5, -355.0, -212.7, 144.0, 496.8, 721.3, 789.4, 736.7, 623.0, 502.8, 410.4, 356.9, 335.6, 331.0, 327.8, 316.5, 295.8, 271.2, 251.4, 244.0, 252.5, 274.4, 302.5, 327.5, 341.8, 343.1, 335.2, 327.5, 330.3, 349.2, 380.6, 409.9, 417.7, 393.5, 353.8, 353.2, 460.6, 654.1, 556.0],
    best: [566.9, 527.5, 497.8, 474.4, 455.0, 438.2, 423.2, 409.6, 397.1, 385.4, 374.6, 364.5, 355.3, 346.7, 339.0, 332.0, 325.7, 320.2, 315.6, 311.7, 308.6, 306.4, 305.0, 304.6, 305.1, 306.6, 309.1, 312.8, 317.7, 323.8, 331.3, 340.2, 350.8, 363.3, 377.8, 394.7, 414.7, 438.5, 467.3, 503.3, 549.3]
  };
  // hand_deg3 and hand_deg12: weights rounded to whole kWh, training loss recomputed with the rounded weights
  const HAND = {
    3: { weights: [293, -87, 258, 84], train: 978.6 },
    12: { weights: [251, -292, 2571, 8233, -31241, -70406, 188225, 200423, -474660, -223684, 506721, 85714, -191300], train: 300.1 }
  };
  const STRENGTH_HAND = 0.01;
  // strength_sweep [strength, train_mse, val_mse] for degree 12
  const RIDGE = [[0.0, 299.9, 92725.6], [0.0001, 381.5, 1607.1], [0.001, 589.9, 915.9], [0.01, 1149.1, 627.6], [0.1, 1852.4, 1679.5], [1.0, 4465.5, 3814.5], [10.0, 8442.2, 5877.0]];

  // trace_pick.out.txt: [line about to run, event (l line, r return), strength, train_loss, val_loss, best_strength, best_val]
  const TRACE = [[1,"l",null,null,null,null,null],[2,"l",null,null,null,null,null],[3,"l",0.0,null,null,null,null],[4,"l",0.0,null,null,null,null],[5,"l",0.0,299.9,null,null,null],[6,"l",0.0,299.9,92725.6,null,null],[7,"l",0.0,299.9,92725.6,null,null],[2,"l",0.0,299.9,92725.6,0.0,92725.6],[3,"l",0.0001,299.9,92725.6,0.0,92725.6],[4,"l",0.0001,299.9,92725.6,0.0,92725.6],[5,"l",0.0001,381.5,92725.6,0.0,92725.6],[6,"l",0.0001,381.5,1607.1,0.0,92725.6],[7,"l",0.0001,381.5,1607.1,0.0,92725.6],[2,"l",0.0001,381.5,1607.1,0.0001,1607.1],[3,"l",0.001,381.5,1607.1,0.0001,1607.1],[4,"l",0.001,381.5,1607.1,0.0001,1607.1],[5,"l",0.001,589.9,1607.1,0.0001,1607.1],[6,"l",0.001,589.9,915.9,0.0001,1607.1],[7,"l",0.001,589.9,915.9,0.0001,1607.1],[2,"l",0.001,589.9,915.9,0.001,915.9],[3,"l",0.01,589.9,915.9,0.001,915.9],[4,"l",0.01,589.9,915.9,0.001,915.9],[5,"l",0.01,1149.1,915.9,0.001,915.9],[6,"l",0.01,1149.1,627.6,0.001,915.9],[7,"l",0.01,1149.1,627.6,0.001,915.9],[2,"l",0.01,1149.1,627.6,0.01,627.6],[3,"l",0.1,1149.1,627.6,0.01,627.6],[4,"l",0.1,1149.1,627.6,0.01,627.6],[5,"l",0.1,1852.4,627.6,0.01,627.6],[6,"l",0.1,1852.4,1679.5,0.01,627.6],[2,"l",0.1,1852.4,1679.5,0.01,627.6],[3,"l",1.0,1852.4,1679.5,0.01,627.6],[4,"l",1.0,1852.4,1679.5,0.01,627.6],[5,"l",1.0,4465.5,1679.5,0.01,627.6],[6,"l",1.0,4465.5,3814.5,0.01,627.6],[2,"l",1.0,4465.5,3814.5,0.01,627.6],[3,"l",10.0,4465.5,3814.5,0.01,627.6],[4,"l",10.0,4465.5,3814.5,0.01,627.6],[5,"l",10.0,8442.2,3814.5,0.01,627.6],[6,"l",10.0,8442.2,5877.0,0.01,627.6],[2,"l",10.0,8442.2,5877.0,0.01,627.6],[8,"l",10.0,8442.2,5877.0,0.01,627.6],[8,"r",10.0,8442.2,5877.0,0.01,627.6]];
  const RETURNED = 0.01; // trace_pick.out.txt: returned 0.01
  // pick_strength from trace_pick.py, line for line (line 0 = def)
  const PICK_CODE = [
    "def pick_strength(train_days, val_days, strengths):",
    "    best_strength, best_val = None, None",
    "    for strength in strengths:",
    "        weights = fit_ridge(train_days, strength)",
    "        train_loss = round(mse(train_days, weights), 1)",
    "        val_loss = round(mse(val_days, weights), 1)",
    "        if best_val is None or val_loss < best_val:",
    "            best_strength, best_val = strength, val_loss",
    "    return best_strength"
  ];

  // broken_fit.py: fit_ridge_broken, line for line; building.py: the fixed fit_ridge has one more line
  const BROKEN_CODE = [
    "def fit_ridge_broken(days, strength, degree=12):",
    "    features = curve_features(days[\"temp\"], degree)",
    "    penalty = strength * np.eye(degree + 1)",
    "    lhs = features.T @ features / len(days[\"usage\"]) + penalty",
    "    rhs = features.T @ days[\"usage\"] / len(days[\"usage\"])",
    "    return np.linalg.solve(lhs, rhs)"
  ];
  const FIX_LINE = "    penalty[0, 0] = 0          # never shrink the base load";
  // broken_fit.out.txt, strength 1.0: [temp, actual, broken_forecast, fixed_forecast] for the first six validation days
  const BROKEN = {
    strength: 1.0,
    rows: [[30.9, 426.0, 234, 386], [-2.5, 504.0, 288, 416], [16.1, 322.0, 164, 362], [13.5, 292.0, 165, 363], [-1.6, 534.0, 263, 405], [20.4, 275.0, 167, 363]],
    brokenVal: 29067.0, fixedVal: 3814.5, brokenBase: 164.0, fixedBase: 362.5,
    meanBroken: 194.0, meanFixed: 373.8, meanActual: 359.5
  };

  // sklearn_run.out.txt (scikit-learn 1.9.1)
  const SK = {
    nDays: 16,
    oursBase: 308.6, ridgeBase: 308.6,
    ours: [-53.0, 168.9, 35.0, 32.2, 14.2, 3.1, 1.9, 4.4, -2.7, 14.4, -4.3, 26.4],
    ridge: [-53.0, 168.9, 35.0, 32.2, 14.2, 3.1, 1.9, 4.4, -2.7, 14.4, -4.3, 26.4],
    maxDiff: "3.5e-12",
    ridgeAlphaSameNumberVal: 1085.9, ridgeVal: 627.6,
    lassoTried: [[0.1, 1239.0], [1.0, 485.5], [5.0, 876.3]], // [alpha, val mse]
    lasso: { alpha: 1.0, val: 485.5, base: 301.9, weights: [-34.5, 227.2, 0.0, 0.0, 19.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 20.1] }
  };
  const SK_CODE = [
    "from sklearn.linear_model import Ridge, Lasso",
    "X_train = curve_features(train_days[\"temp\"], 12)[:, 1:]   # x .. x^12",
    "ridge = Ridge(alpha=0.01 * n_days).fit(X_train, y_train)",
    "print(ridge.intercept_, ridge.coef_)"
  ];
  const LASSO_CODE = [
    "lasso = Lasso(alpha=1.0, max_iter=200000).fit(X_train, y_train)",
    "print(lasso.intercept_, lasso.coef_)"
  ];

  /* ---------- Derived from the data ---------- */
  const valOf = d => SWEEP.find(r => r[0] === d)[2];
  const trainOf = d => SWEEP.find(r => r[0] === d)[1];
  const BEST_DEG = SWEEP.reduce((a, r) => (r[2] < a[2] ? r : a))[0];
  const LOWEST_TRAIN_DEG = SWEEP.reduce((a, r) => (r[1] < a[1] ? r : a))[0];
  const FIRST_GAP = SWEEP.find(r => r[0] > BEST_DEG && r[2] > r[1])[0];
  const pen = (w, s, withBase) => s * sum(w.slice(withBase ? 0 : 1).map(x => x * x));
  const round1 = x => Math.round(x * 10) / 10;
  const PEN3 = round1(pen(HAND[3].weights, STRENGTH_HAND));
  const PEN12 = round1(pen(HAND[12].weights, STRENGTH_HAND));
  const R_AT = s => RIDGE.find(r => r[0] === s);
  const R_BEST = RIDGE.reduce((a, r) => (r[2] < a[2] ? r : a));
  const LASSO_ZEROS = SK.lasso.weights.filter(w => w === 0).length;
  const RIDGE_ZEROS = SK.ridge.filter(w => w === 0).length;
  const N_W = SK.ridge.length;
  const LASSO_KEPT = SK.lasso.weights.map((w, i) => (w !== 0 ? i + 1 : 0)).filter(Boolean); // powers of x kept

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-plot { margin: 14px 0 4px; }
      .lx-${ID}-plot svg { display: block; width: 100%; max-width: 560px; height: auto; }
      .lx-${ID}-plot .ax { stroke: var(--line); stroke-width: 1; }
      .lx-${ID}-plot text { fill: var(--muted); font: 500 10px var(--font); }
      .lx-${ID}-plot .c { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; }
      .lx-${ID}-plot .c.dash { stroke-dasharray: 7 5; }
      .lx-${ID}-plot .c.dot { stroke-dasharray: 1.5 3.5; stroke-linecap: round; stroke-width: 2.5; }
      .lx-${ID}-plot .c.faint { stroke: var(--faint); }
      .lx-${ID}-plot .tr { fill: var(--ink); }
      .lx-${ID}-plot .va { fill: var(--surface); stroke: var(--ink); stroke-width: 1.5; }
      .lx-${ID}-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 4px 0 0; padding: 0; list-style: none; font-size: 14px; color: var(--ink-2); }
      .lx-${ID}-legend li { display: flex; align-items: center; gap: 6px; }
      .lx-${ID}-legend svg { width: 28px; height: 12px; }
      .lx-${ID}-legend .c { fill: none; stroke: var(--ink); stroke-width: 2; }
      .lx-${ID}-legend .c.dash { stroke-dasharray: 7 5; }
      .lx-${ID}-legend .c.dot { stroke-dasharray: 1.5 3.5; stroke-linecap: round; stroke-width: 2.5; }
      .lx-${ID}-legend .c.faint { stroke: var(--faint); }
      .lx-${ID}-legend .tr { fill: var(--ink); }
      .lx-${ID}-legend .va { fill: var(--surface); stroke: var(--ink); stroke-width: 1.5; }
      .lx-${ID}-tbl { width: 100%; margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-tr { display: grid; grid-template-columns: 4.2em 1fr 1fr; gap: 8px; align-items: center; width: 100%; min-height: 44px; padding: 6px 8px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--ink); font: 500 15px/1.3 var(--mono); text-align: right; }
      .lx-${ID}-tr > :first-child { text-align: left; }
      .lx-${ID}-tr.head { font: 600 12.5px/1.3 var(--font); color: var(--muted); min-height: 0; }
      button.lx-${ID}-tr { cursor: pointer; }
      button.lx-${ID}-tr:hover { background: var(--sunk); }
      .lx-${ID}-tr.on { box-shadow: inset 3px 0 0 var(--ink); background: var(--sunk); }
      .lx-${ID}-tr.ok { box-shadow: inset 3px 0 0 var(--good); background: var(--good-soft); }
      .lx-${ID}-tr.no { box-shadow: inset 3px 0 0 var(--bad); background: var(--bad-soft); }
      .lx-${ID}-w { margin: 12px 0 0; font: 500 14px/1.6 var(--mono); overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-w b { font-weight: 700; }
      .lx-${ID}-sum { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); font: 500 15px/1.6 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-code .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 4ch); text-indent: -4ch; }
      .lx-${ID}-codeopt { font: 500 13.5px/1.45 var(--mono); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }

  /* An SVG plot of the days and fitted curves. curves: [{ ys, cls }]; days: "train" | "both". */
  let plotN = 0;
  function plot(curves, days, title) {
    const W = 360, H = 220, L = 40, R = 350, T = 10, B = 196;
    const Y0 = 100, Y1 = 700;
    const sx = t => L + (t + 5) / 40 * (R - L);
    const sy = u => B - (u - Y0) / (Y1 - Y0) * (B - T);
    const id = `lx-${ID}-clip-${++plotN}`;
    const yt = [200, 400, 600].map(u => `<line class="ax" x1="${L}" x2="${R}" y1="${sy(u)}" y2="${sy(u)}"/><text x="${L - 6}" y="${sy(u) + 3}" text-anchor="end">${u}</text>`).join("");
    const xt = [-5, 5, 15, 25, 35].map(t => `<text x="${sx(t)}" y="${B + 14}" text-anchor="middle">${t}°</text>`).join("");
    const cs = curves.map(c => `<polyline class="c ${c.cls || ""}" points="${GRID.map((t, i) => `${sx(t).toFixed(1)},${sy(c.ys[i]).toFixed(1)}`).join(" ")}"/>`).join("");
    const tr = TRAIN_T.map((t, i) => `<circle class="tr" cx="${sx(t).toFixed(1)}" cy="${sy(TRAIN_U[i]).toFixed(1)}" r="3.6"/>`).join("");
    const va = days === "both" ? VAL_T.map((t, i) => `<circle class="va" cx="${sx(t).toFixed(1)}" cy="${sy(VAL_U[i]).toFixed(1)}" r="3.6"/>`).join("") : "";
    return `<div class="lx-${ID}-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">
      <defs><clipPath id="${id}"><rect x="${L}" y="${T}" width="${R - L}" height="${B - T}"/></clipPath></defs>
      ${yt}${xt}<line class="ax" x1="${L}" x2="${R}" y1="${B}" y2="${B}"/>
      <text x="${L}" y="${T - 1}" text-anchor="start">kWh per day</text>
      <g clip-path="url(#${id})">${cs}</g>${tr}${va}</svg></div>`;
  }
  function legend(items) {
    const sw = it => it.kind === "tr" ? `<svg viewBox="0 0 28 12"><circle class="tr" cx="14" cy="6" r="3.6"/></svg>`
      : it.kind === "va" ? `<svg viewBox="0 0 28 12"><circle class="va" cx="14" cy="6" r="3.6"/></svg>`
      : `<svg viewBox="0 0 28 12"><line class="c ${it.cls || ""}" x1="1" x2="27" y1="6" y2="6"/></svg>`;
    return `<ul class="lx-${ID}-legend">${items.map(it => `<li>${sw(it)}<span>${it.text}</span></li>`).join("")}</ul>`;
  }
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const wire = (el, fn) => el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => fn(+b.dataset.i));
  const weightsLine = (kit, w) => `<div class="lx-${ID}-w">${w.map((x, i) => `w${i} = <b>${kit.esc(fmt(x, 1))}</b>`).join(", ")}</div>`;

  /* 1. The situation, and the first prediction: which curve wins on new days? */
  function threeCurves({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = ["The straight line", "The gentle curve", "The wiggly curve"];
    const fb = [
      [`The straight line cannot bend, and this building uses more power on cold days (heating) <i>and</i> on hot days (cooling). It misses on both ends. On the 16 new days its typical miss was ${miss(valOf(1))} kWh a day.`, false],
      [`Right. On the 16 new days the gentle curve's typical miss was ${miss(valOf(3))} kWh a day, the straight line's ${miss(valOf(1))}, and the wiggly curve's ${fmt(miss(valOf(12)), 0)}. The new days are the outlined dots. The wiggly curve fits the 16 training days best (typical miss ${miss(trainOf(12))} kWh), but between them it swings far off the chart.`, true],
      [`It does pass closest to the training days: a typical miss of ${miss(trainOf(12))} kWh there. But a day's use is not exact: weather, holidays and people add noise. The wiggly curve bent to fit that noise. On the 16 new days its typical miss was ${fmt(miss(valOf(12)), 0)} kWh a day.`, false]
    ];
    const paint = () => {
      const both = ans === RIGHT;
      el.innerHTML = `<h1>Three curves, one building</h1>
        <p class="lead">An energy company forecasts how much electricity an office building will use tomorrow, from tomorrow's outdoor temperature. An analyst has 16 past days. She fits three curves to them: a straight line, a gentle curve (degree 3) and a wiggly one (degree 12). The degree is the highest power of temperature in the formula; a higher degree lets the curve bend more.</p>
        <p class="lead">This lesson is about a model that looks great on its training data and fails on new data: how to see it, and how to stop it.</p>
        ${plot([{ ys: CURVE[1], cls: "dash" }, { ys: CURVE[3] }, { ys: CURVE[12], cls: "dot" }], both ? "both" : "train", "Daily electricity use against temperature, with three fitted curves")}
        ${legend([{ kind: "tr", text: "training day" }, ...(both ? [{ kind: "va", text: "new day" }] : []), { cls: "dash", text: "straight" }, { text: "gentle" }, { cls: "dot", text: "wiggly" }])}
        <p class="task">Next month brings 16 new days. Which curve will forecast them best?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Read the train-versus-validation gap and pick the degree to ship. */
  function readGap({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const say = d => {
      if (d === BEST_DEG) return [`Right: degree ${d} has the lowest validation loss, ${fmt(valOf(d))}. Now read the two columns together. Training loss falls every time you add a degree: a more flexible curve can always get closer to the same 16 points. Validation loss falls, then rises. From degree ${FIRST_GAP} on, validation loss is above training loss, and by degree ${LOWEST_TRAIN_DEG} it is ${fmt(valOf(LOWEST_TRAIN_DEG) / trainOf(LOWEST_TRAIN_DEG), 0)} times the training loss. That gap is <b>overfitting</b>: the curve learns the noise of these particular days, which does not repeat on new days.`, true];
      if (d === LOWEST_TRAIN_DEG) return [`Degree ${d} has the lowest <i>training</i> loss, ${fmt(trainOf(d))}. That is the score on days the curve has already seen. Its validation loss is ${fmt(valOf(d))}, the worst in the table. Choose by the column the model never trained on.`, false];
      if (d === 1) return [`Both columns are high at degree 1 (${fmt(trainOf(1))} and ${fmt(valOf(1))}). The line is too stiff to follow the U shape even on the training days. That is <b>underfitting</b>, the opposite problem. Look for the lowest validation loss.`, false];
      return [`Degree ${d} has validation loss ${fmt(valOf(d))}. Another row is lower. Pick the row with the lowest validation loss.`, false];
    };
    const paint = () => {
      const rows = SWEEP.map(([d, tr, va]) => {
        const st = pick === d ? (d === BEST_DEG ? " ok" : " no") : "";
        return `<button type="button" class="lx-${ID}-tr${st}" data-i="${d}"${d === BEST_DEG ? " data-right" : ""}${d === LOWEST_TRAIN_DEG ? " data-wrong" : ""} aria-pressed="${pick === d}"><span>${d}</span><span>${fmt(tr)}</span><span>${fmt(va)}</span></button>`;
      }).join("");
      el.innerHTML = `<h1>Read the gap</h1>
        <p class="lead">The analyst fits every degree from 1 to 12 on the 16 training days, then scores each curve on 16 validation days it never saw. The loss is the mean squared error, in kWh squared; its square root is the typical miss in kWh.</p>
        <p class="task">Tap the degree you would ship: the one you expect to forecast new days best.</p>
        <div class="lx-${ID}-tbl" role="group" aria-label="Loss by degree"><div class="lx-${ID}-tr head"><span>degree</span><span>training loss</span><span>validation loss</span></div>${rows}</div>
        <div class="lpanel">${pick == null ? "" : kit.feedback(...say(pick))}</div>`;
      el.querySelectorAll(`button.lx-${ID}-tr`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === BEST_DEG) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: the wiggles live in huge weights; charge for them. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const big = Math.max(...HAND[12].weights.map(Math.abs));
    const opts = [
      "Train longer, so the training loss goes even lower",
      "Add a charge to the loss that grows with the size of the weights",
      "Delete the coldest and the hottest training days",
      "Round every weight to a whole number"
    ];
    const fb = [
      ["The training loss is already as low as this curve can get, and a low training loss is the problem, not the cure. Lower still means fitting the noise even more closely.", false],
      [`Right. Training now minimises <b>data loss + strength × (w1² + w2² + … + w12²)</b>, where the data loss is the mean squared error from before. A weight of ${fmt(big, 0)} now costs a fortune, so the fit only keeps a big weight if it buys a large drop in data loss. This charge is the <b>L2 penalty</b>. Adding a penalty like this is called <b>regularization</b>, and a linear model trained with the L2 penalty is called <b>ridge regression</b>. <code>strength</code> is a number you choose: 0 means no penalty. w0 is left out on purpose: it is the base load, and it moves the whole curve up or down without bending it.`, true],
      ["Those are real days the forecast must handle. Fewer points leave the curve even more room to swing between them.", false],
      [`Rounding ${fmt(big, 0)} to a whole number still leaves ${fmt(big, 0)}. The size of the weights is the problem, not their decimals.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Where the wiggles come from</h1>
        <p class="lead">A degree-12 curve is <code>w0 + w1·x + w2·x² + … + w12·x¹²</code>, where x is the temperature scaled to run from −1 to 1. Here are the fitted weights, rounded to whole kWh.</p>
        <p class="lead"><b>Gentle (degree 3):</b></p>${weightsLine(kit, HAND[3].weights)}
        <p class="lead"><b>Wiggly (degree 12):</b></p>${weightsLine(kit, HAND[12].weights)}
        <p class="lead">The wiggly curve's weights are in the hundreds of thousands, with signs that flip. On the training days, these huge terms nearly cancel each other out. Between those days they stop cancelling, and the curve swings wildly.</p>
        <p class="task">You want to keep all 12 terms (x up to x¹²), but stop the swings. What change to training does that?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 4. By hand: fill in the penalised loss for the gentle weights, then compare. */
  function handLoss({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const w = HAND[3].weights;
    const withBase = round1(pen(w, STRENGTH_HAND, true));
    const noSquare = round1(STRENGTH_HAND * sum(w.slice(1).map(Math.abs)));
    const noStrength = round1(pen(w, 1));
    const P_OPTS = [withBase, PEN3, noSquare, noStrength];
    const P_RIGHT = 1;
    const pfb = [
      [`${fmt(withBase)} includes w0 = ${w[0]}. The base load is left out of the penalty: it shifts the curve, it does not bend it.`, false],
      null,
      [`${fmt(noSquare)} adds the sizes without squaring them. That is a different penalty (you will meet it later). The L2 penalty squares each weight first.`, false],
      [`${fmt(noStrength, 0)} is the sum of squares, but the strength (${STRENGTH_HAND}) was not applied. Multiply by it.`, false]
    ];
    const total3 = round1(HAND[3].train + PEN3), total12 = round1(HAND[12].train + PEN12);
    const W_OPTS = ["The gentle weights", "The wiggly weights", "They tie"];
    const wfb = [
      [`Right. The wiggly weights fit the training days better (${fmt(HAND[12].train)} against ${fmt(HAND[3].train)}), but their penalty is ${fmt(PEN12, 0)}. With the penalty, the gentle weights win by far: ${fmt(total3)} against ${fmt(total12, 0)}. Training with the penalty would never settle on weights like the wiggly ones.`, true],
      [`The wiggly weights win only on data loss (${fmt(HAND[12].train)}). Add their penalty, ${fmt(PEN12, 0)}, and their total is ${fmt(total12, 0)}, against ${fmt(total3)} for the gentle ones.`, false],
      [`Not close: ${fmt(total3)} for the gentle weights against ${fmt(total12, 0)} for the wiggly ones. The penalty grows with the square of each weight, so a few huge weights dominate it.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Work out the penalised loss</h1>
        <p class="lead">Penalised loss = data loss + strength × (w1² + w2² + w3²). The gentle curve, with its weights rounded:</p>
        ${weightsLine(kit, w)}
        <div class="vars"><span>data loss <b>${fmt(HAND[3].train)}</b></span><span>strength <b>${STRENGTH_HAND}</b></span></div>
        ${stage === 0 ? `<p class="task">What is the penalty?</p><div class="lpanel">${kit.options(P_OPTS.map(v => fmt(v, 1)), { picked: ans, correct: P_RIGHT })}${ans != null && ans !== P_RIGHT ? kit.feedback(pfb[ans][0], false) : ""}</div>`
        : `<div class="lx-${ID}-sum">${STRENGTH_HAND} × (${w.slice(1).map(x => (x < 0 ? `(${x})²` : `${x}²`)).join(" + ")}) = ${fmt(PEN3)}<br>penalised loss = ${fmt(HAND[3].train)} + ${fmt(PEN3)} = <b>${fmt(total3)}</b></div>
          <p class="lead">The wiggly weights from the last screen, same strength: data loss ${fmt(HAND[12].train)}, penalty ${fmt(PEN12, 0)}.</p>
          <p class="task">Which set of weights has the lower penalised loss?</p>
          <div class="lpanel">${ask(kit, W_OPTS, 0, ans, wfb)}</div>`}`;
      wire(el, i => {
        ans = i;
        if (stage === 0 && i === P_RIGHT) { stage = 1; ans = null; }
        paint();
        if (stage === 1 && ans === 0) done();
      });
    };
    paint();
  }

  /* 5. Predict: what does the penalty do to the training loss? Then see the curve. */
  function predictTrain({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 0;
    const r0 = R_AT(0), r1 = R_AT(STRENGTH_HAND);
    const opts = ["It goes up", "It goes down", "It stays the same"];
    const tail = `Training loss went from ${fmt(r0[1])} to ${fmt(r1[1])}; validation loss fell from ${fmt(r0[2])} to ${fmt(r1[2])}.`;
    const fb = [
      [`Right. Training now minimises data loss <i>plus</i> the penalty, so it accepts a worse fit to the training days in exchange for smaller weights. ${tail} You pay on the days you have seen and gain on the days you have not. The penalised degree-12 curve, solid, is now smooth:`, true],
      [`Without the penalty, the fit already found the lowest possible data loss on these days. Any change, including one the penalty pushes for, can only raise it. ${tail}`, false],
      [`The penalty changes the weights, and different weights give a different data loss. ${tail}`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What the penalty costs</h1>
        <p class="lead">Keep degree 12. Train it again, now with the L2 penalty at strength ${STRENGTH_HAND}.</p>
        <p class="task">Compared with no penalty, what happens to the <b>training</b> loss?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>
        ${ans === RIGHT ? `${plot([{ ys: CURVE[12], cls: "dot faint" }, { ys: CURVE.best }], "both", "Degree-12 curve with and without the penalty")}
          ${legend([{ kind: "tr", text: "training day" }, { kind: "va", text: "validation day" }, { cls: "dot faint", text: "no penalty" }, { text: `strength ${STRENGTH_HAND}` }])}` : ""}`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 6. From scratch: pick the strength on validation, a traced run with predictions. */
  const ASK_AT = TRACE.map((r, k) => k).filter(k => TRACE[k][0] === 6 && TRACE[k][1] === "l");
  function pickByVal({ el, done, kit }) {
    ensureStyle();
    let q = 0, wrong = null;
    const last = TRACE[TRACE.length - 1];
    const paint = () => {
      const fin = q >= ASK_AT.length;
      const row = fin ? last : TRACE[ASK_AT[q]];
      const yes = !fin && TRACE[ASK_AT[q] + 1][0] === 7;
      const prev = q > 0 ? TRACE[ASK_AT[q - 1]] : null;
      const prevNote = prev ? `Strength ${prev[2]}: validation loss ${fmt(prev[4])} ${TRACE[ASK_AT[q - 1] + 1][0] === 7 ? `beat the best so far, so the best was updated.` : `did not beat ${fmt(prev[6])}, so the update was skipped.`}` : "";
      const st = v => v == null ? "–" : kit.esc(fmt(v, 4));
      const wfb = wrong == null ? "" : kit.feedback(yes
        ? (row[6] == null ? "There is no best yet (best_val is None), so the first strength always becomes the best." : `${fmt(row[4])} is lower than the best so far, ${fmt(row[6])}. Lower validation loss wins, so the update runs.`)
        : `${fmt(row[4])} is higher than the best so far, ${fmt(row[6])}. Training loss does not count here: only validation loss decides. The update is skipped.`, false);
      el.innerHTML = `<h1>Pick the strength on validation</h1>
        <p class="lead">This code ran once for real; you replay it step by step. <code>fit_ridge</code> trains the degree-12 curve with the L2 penalty (the next screen shows a version of it). The loop tries ${TRACE.filter(r => r[0] === 3).length} strengths, from 0 to 10, and keeps the one with the lowest <b>validation</b> loss.</p>
        <div class="lx-${ID}-code">${kit.code(PICK_CODE, fin ? 8 : 6)}</div>
        <div class="vars"><span>strength <b>${st(row[2])}</b></span><span>train_loss <b>${st(row[3])}</b></span><span>val_loss <b>${st(row[4])}</b></span><span>best_strength <b>${st(row[5])}</b></span><span>best_val <b>${st(row[6])}</b></span></div>
        ${prevNote ? kit.feedback(prevNote) : ""}
        ${fin ? kit.feedback(`<code>pick_strength</code> returned <b>${RETURNED}</b>. Notice the two columns: training loss rose with every strength (${RIDGE.map(r => fmt(r[1])).join(", ")}), while validation loss fell, then rose. Picking by training loss would always choose 0, the overfit curve. That is why the strength is chosen on validation days, and the test set stays untouched until the very end.`, true)
          : `<p class="task">The highlighted <code>if</code> runs next. Will the line under it run, making strength ${row[2]} the new best?</p>
          <div class="lpanel">${kit.options(["Yes, the best is updated", "No, it is skipped"], { picked: wrong, correct: yes ? 0 : 1 })}${wfb}</div>`}`;
      wire(el, i => {
        const right = (i === 0) === yes;
        if (!right) { wrong = i; paint(); return; }
        wrong = null; q++; paint();
        if (q >= ASK_AT.length) done();
      });
    };
    paint();
  }

  /* 7. Broken on purpose: the forecasts are all too low. Find the line. */
  function brokenFit({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const B = BROKEN;
    const below = B.rows.filter(r => r[2] < r[1]).length;
    const opts = BROKEN_CODE.slice(1).map(l => `<span class="lx-${ID}-codeopt">${kit.esc(l.trim())}</span>`);
    const ix = BROKEN_CODE.indexOf(BROKEN_CODE.find(l => l.includes("np.eye"))) - 1; // option index of the cause line
    const fb = [
      ["Those are the same features the working fit uses: column 0 is all ones (the base load), then x, x², and so on. Nothing here depends on the strength.", false],
      [`Right. <code>np.eye</code> puts the strength on <i>every</i> diagonal entry, including the first one, so the penalty also shrinks w0, the base load. At strength ${B.strength} it pulled w0 down to ${fmt(B.brokenBase)}, and every forecast sank with it. The fix is one line after it:<div class="lx-${ID}-sum">${kit.esc(FIX_LINE.trim())}</div>With that line, the same strength gives w0 = ${fmt(B.fixedBase)}, a mean forecast of ${fmt(B.meanFixed)} kWh, and validation loss ${fmt(B.fixedVal)} instead of ${fmt(B.brokenVal, 0)}. scikit-learn's <code>Ridge</code> leaves the intercept out of the penalty too; you will check that on a later screen.`, true],
      ["This adds the penalty matrix to the left-hand side, which is how the penalty gets in. The line is right; what is <i>inside</i> <code>penalty</code> is the question.", false],
      ["The right-hand side has no strength in it at all, so it cannot depend on the penalty. It is the same as in a fit with no penalty.", false],
      ["<code>solve</code> solves exactly the system it is given. The answer is correct for the wrong system. Look at how that system was built.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Every forecast is too low</h1>
        <p class="lead">A teammate wrote his own ridge fit and tried strength ${B.strength}. The forecasts for the first six validation days:</p>
        <div class="lx-${ID}-tbl"><div class="lx-${ID}-tr head"><span>temp</span><span>actual kWh</span><span>forecast kWh</span></div>
          ${B.rows.map(r => `<div class="lx-${ID}-tr"><span>${fmt(r[0])}°</span><span>${fmt(r[1], 0)}</span><span>${fmt(r[2], 0)}</span></div>`).join("")}</div>
        <p class="lead">${below} of ${B.rows.length} forecasts are below the actual use, on cold, mild and hot days alike. Over all 16 validation days the mean forecast is ${fmt(B.meanBroken)} kWh; the mean actual use is ${fmt(B.meanActual)}. A strength that is simply too high flattens the curve toward the average day; it does not push it below every day.</p>
        <p class="lead">In this code, <code>penalty</code> is a grid with one row and one column per weight, w0 to w${HAND[12].weights.length - 1}. The number on the diagonal in row k is the charge on weight wk. <code>np.eye(n)</code> is an n × n grid with 1 on the diagonal and 0 everywhere else.</p>
        <div class="lx-${ID}-code">${kit.code(BROKEN_CODE, ans === ix ? 2 : -1)}</div>
        <p class="task">Which line causes it?</p>
        <div class="lpanel">${ask(kit, opts, ix, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === ix) done(); });
    };
    paint();
  }

  /* 8. The library: scikit-learn Ridge, and why its alpha is not your strength. */
  function libRidge({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 0;
    const alpha = round1(STRENGTH_HAND * SK.nDays * 100) / 100;
    const opts = [
      `Its loss adds up the squared errors of all ${SK.nDays} days instead of averaging them, so the same penalty needs alpha = ${STRENGTH_HAND} × ${SK.nDays}`,
      "It penalises the base load too, like the teammate's bug",
      "Its solver is random, so each fit comes out a little different",
      "It was scored on different validation days"
    ];
    const fb = [
      [`Right. scikit-learn's Ridge documentation writes its loss as ‖y − Xw‖² + alpha × ‖w‖²: a <i>sum</i> of squared errors, where ours is a <i>mean</i>. Dividing by ${SK.nDays} days turns one into the other, so alpha = ${STRENGTH_HAND} × ${SK.nDays} = ${alpha}. With that alpha the run printed base ${fmt(SK.ridgeBase)} (ours ${fmt(SK.oursBase)}) and the same 12 weights; the largest difference was ${SK.maxDiff}. The match also shows the intercept was not penalised. When you move a strength between tools, check how each one writes its loss.`, true],
      [`No: with alpha = ${alpha} its base came out ${fmt(SK.ridgeBase)}, exactly ours, and our fit leaves the base load unpenalised. Its documentation writes the loss with only the weights w in the penalty; the intercept is fitted apart from them.`, false],
      [`Not here: its weights matched our own direct solve to within ${SK.maxDiff}, so nothing random changed the fit. The difference is in what alpha multiplies.`, false],
      ["Both scores came from the same 16 validation days in the same script.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same fit with scikit-learn</h1>
        <p class="lead">In real work you call a library. scikit-learn's <code>Ridge</code> is the L2-penalised linear model; it adds the base load (<code>intercept_</code>) itself, so the features start at x. This ran on this Mac:</p>
        <div class="lx-${ID}-code">${kit.code(SK_CODE, 2)}</div>
        <p class="lead">A teammate first wrote <code>Ridge(alpha=${STRENGTH_HAND})</code>, using your winning strength as alpha. Its validation loss was ${fmt(SK.ridgeAlphaSameNumberVal)}, not ${fmt(SK.ridgeVal)}.</p>
        <p class="task">Why did the same number give a different fit?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 9. L1: a penalty on absolute weights, and why it lands on zero. */
  function lassoZero({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const small = 0.1;
    const opts = ["The squared penalty (L2)", "The absolute penalty (L1)", "Both the same"];
    const after = `<p class="lead">scikit-learn's <code>Lasso</code> uses the L1 penalty. Same 12 features, same days, run on this Mac:</p>
      <div class="lx-${ID}-code">${kit.code(LASSO_CODE, 0)}</div>
      <div class="lx-${ID}-sum">intercept ${fmt(SK.lasso.base)}<br>coef ${SK.lasso.weights.map(x => fmt(x, 1)).join(", ")}</div>
      ${kit.feedback(`${LASSO_ZEROS} of ${N_W} weights are exactly 0; Ridge left ${RIDGE_ZEROS} of ${N_W} at zero. Lasso kept only ${LASSO_KEPT.map(p => p === 1 ? "x" : `x<sup>${p}</sup>`).join(", ")}. Its alpha, ${SK.lasso.alpha}, was the best on validation of the ${SK.lassoTried.length} tried (${SK.lassoTried.map(r => r[0]).join(", ")}); its validation loss was ${fmt(SK.lasso.val)} (ridge at its best strength: ${fmt(R_BEST[2])}). Neither beats plain degree ${BEST_DEG} from the second screen (${fmt(valOf(BEST_DEG))}): when a simpler model is an option, try it too. A penalty earns its place when you cannot tell which features to drop. Use L1 when you suspect most features do nothing and you want a short list; use L2 when many features each help a little. Lasso's <code>alpha</code> has its own scaling too: its loss divides the squared errors by 2 × the number of days.`)}`;
    const fb = [
      [`Under L2, shrinking a weight of ${small} to 0 saves only ${small}² = ${round1(small * small * 1000) / 1000} times the strength, and the saving shrinks faster than the weight. So L2 makes small weights smaller but stops short of zero.`, false],
      [`Right. Under L1 the charge is the weight's size, so taking ${small} down to 0 still saves ${small} times the strength, the same rate as for a big weight. If the weight is not paying for itself in data loss, the push takes it all the way to zero.${after}`, true],
      [`They differ near zero: L2 saves ${round1(small * small * 1000) / 1000} × strength by zeroing a weight of ${small}, L1 saves ${small} × strength, ten times more.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A penalty that switches features off</h1>
        <p class="lead">The L2 penalty charges each weight its square. The <b>L1 penalty</b> charges its size: |w1| + |w2| + … + |w12|, times the strength. Think about one small weight, ${small}, that barely lowers the data loss.</p>
        <p class="task">Which penalty pushes that weight all the way to exactly 0?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 10. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    let ans = null;
    const RIGHT = 0;
    const opts = [
      "A churn model with 400 columns and 900 customers: 99% accuracy on training, 71% on validation",
      "A delivery-time model with 3 columns: its error is high on training and about as high on validation",
      "A fraud model with 99.8% on validation; one column is filled in by the fraud team after they investigate"
    ];
    const fb = [
      ["Right. Many columns, few rows, and a wide gap between training and validation: the textbook case. Add L2 or L1, first rescale the columns to similar ranges, and pick the strength on validation or with cross-validation.", true],
      ["High on both, with no gap, is underfitting. A penalty makes the model stiffer still, so the error rises. It needs better features or a more flexible model.", false],
      ["The score is too good on validation too, because the column is only known after the outcome. That is leakage; a penalty will happily keep a column that predicts the answer. Remove the column.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a penalty</h1>
        <p class="lead"><b>What it is:</b> a charge for big weights, added to the loss, so the model cannot fit the noise with huge weights.</p>
        <p class="lead"><b>For:</b> a flexible model on too little data. You see it as a training loss far below the validation loss.</p>
        <p class="lead"><b>Reach for it</b> when you have many features and cannot tell which to drop: L2 to shrink them all, L1 to zero some out.</p>
        <p class="lead"><b>Not</b> when both losses are high (underfitting: a penalty makes it worse), or when validation looks too good (leakage). Other cures: more data, fewer features, a simpler model.</p>
        <p class="lead"><b>Costs:</b> one more setting to tune, so one fit per strength (times the folds, with cross-validation). The columns must be on similar scales, or the penalty hits some harder than others. And the fit on the training data gets slightly worse, by design.</p>
        <p class="task">Which of these calls for a penalty?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 11. Recognise it, including cases where a penalty is the wrong fix. */
  const CASES = [
    ["A spam filter uses 50,000 word-count columns and 2,000 labelled emails. It gets every training email right and one in five validation emails wrong.", true,
      "Yes. Far more columns than rows lets the model memorise each email. A penalty (L1 also gives you a short list of words) and a strength picked on validation is the standard move.",
      "With 50,000 columns and 2,000 rows the model can fit each training email exactly, and the gap shows it did. That is the case a penalty is for."],
    ["A taxi fare model uses only the trip distance, with 10,000 trips. Training and validation error are almost the same.", false,
      "No. One feature and lots of data leave nothing to overfit, and there is no gap to close. A penalty would only pull the one weight away from its best value.",
      "There is no gap: the model does as well on new trips as on old ones. A penalty can only shrink the distance weight, and the fit gets worse."],
    ["A sales model trained on last year's stores scores well on validation stores from the same regions, and badly on stores in a new region.", false,
      "No. The model did not memorise noise; the new region behaves differently and is missing from the data. A penalty cannot add what the data never showed. Get data from the new region.",
      "Validation from the same regions is fine, so this is not the train-versus-validation gap. The new region is a different kind of data, and no penalty brings it in."],
    ["A crop-yield model has 30 weather columns, many nearly the same (temperature at 9, 10 and 11 o'clock). The weights come out huge with opposite signs, and change a lot when 5 rows are dropped.", true,
      "Yes. Near-copies of a column let huge opposite weights cancel, like the degree-12 curve. An L2 penalty makes those expensive and the weights settle down.",
      "Huge weights with opposite signs that jump when a few rows change are the same symptom as the wiggly curve. That is what an L2 penalty fixes."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Penalty or not?</h1>
        <p class="lead">Four models from other teams.</p>
        <p class="task">Would adding an L1 or L2 penalty fix each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can read the gap and close it</h1>
      <p class="lead">You saw a degree-12 curve beat every other curve on the training days and lose on new ones, read that as a gap between training and validation loss, added a penalty on the weights, picked its strength on validation, fixed a fit that penalised the base load, and moved the same fit to scikit-learn's <code>Ridge</code> and <code>Lasso</code>.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>fit_ridge</code> with NumPy, leaving the base load out of the penalty, and pick its strength on validation days.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You have judged models by one loss number; next you split a classifier's mistakes into kinds, because a missed case and a false alarm rarely cost the same.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Overfitting and regularization",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/linear_model.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Lasso.html",
      "https://scikit-learn.org/stable/modules/preprocessing.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.linalg.solve.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.vander.html"
    ],
    interview: [
      {
        q: "A regression model with 300 features scores R² 0.95 on training and 0.62 on validation. What do you do, and in what order?",
        good: [
          "Read the gap as overfitting: the model fits noise in the training rows",
          "Check it is not leakage first; leakage usually shows as a score that is too good on validation too",
          "Standardise the features, add an L2 or L1 penalty, and try strengths on a log scale",
          "Pick the strength on validation or with cross-validation, never on training loss, and touch the test set once at the end",
          "Also consider fewer features or more data; L1 can show which features matter"
        ],
        weak: "Train longer or add more features. That lowers the training loss further and widens the gap."
      },
      {
        q: "Product wants to know which 10 of 200 signals drive a demand forecast, and the forecast must stay accurate. Ridge or lasso, and what would worry you?",
        good: [
          "Lasso: the L1 penalty sets many weights exactly to zero, so the remaining ones are a short list",
          "Ridge shrinks every weight but keeps them all, so it does not give a list",
          "Pick alpha by cross-validation and compare the validation score with ridge's",
          "Among strongly correlated signals, lasso tends to keep one of them more or less at random; elastic net keeps them together",
          "Standardise first, or the penalty treats signals on bigger scales differently"
        ],
        weak: "Use ridge and report the 10 biggest weights. Ridge does not zero weights, and with unscaled features the biggest weights are not the most important ones."
      }
    ],
    screens: [threeCurves, readGap, spotIdea, handLoss, predictTrain, pickByVal, brokenFit, libRidge, lassoZero, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(ASK_AT.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
