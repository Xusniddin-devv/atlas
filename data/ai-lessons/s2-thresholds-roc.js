/* Lesson: thresholds, ROC and precision-recall curves. Story: a clinic screens patients with a cheap test that
   gives each person a score; everyone at or above a threshold is sent on to a costly scan.
   Ideas: (1) the model only ranks people by score; the threshold is a separate choice that trades missed sick
   patients against healthy people scanned, and the ROC curve is every such trade-off of one model at once;
   (2) the ROC point ignores how many healthy people there are, precision does not, so with few sick people read
   the precision-recall curve; (3) pick the operating point from the stated cost of each mistake.
   Data, all real runs on this Mac (simulated patients, no real people):
   - docs/ai-path/runs/s2-thresholds-roc/make_scores.py + make_scores.out.txt: 600 simulated patients (seed 0),
     a logistic regression trained on 400, scores for the 200 held out: TEN_CASES, the counts per threshold
     (OPERATING), the full ROC and precision-recall curves (CURVES), roc_curve on the ten cases;
   - trace_roc.py + trace_roc.out.txt: roc_points, the listing on the code screen, traced line by line (FRAMES:
     the steps the screen shows);
   - library_run.py + library_run.out.txt (with clinic_data.py): the scikit-learn calls and their printed output.
   No model API calls were recorded for this lesson.
   Lesson-local pictures and style: the patient list, the curve charts (inline SVG) and the cost table,
   see ensureStyle(), patients() and chart(). Plain browser script. */
(() => {
  const ID = "s2-thresholds-roc";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const f2 = v => v.toFixed(2);
  const f3 = v => (Math.round(v * 1000) / 1000).toString();

  /* ---------- Data copied from the runs ---------- */
  // make_scores.out.txt, TEN_CASES: scores rounded to 2 places, highest first; sick 1 / healthy 0
  const SCORES = [0.86, 0.73, 0.43, 0.22, 0.2, 0.06, 0.05, 0.04, 0.03, 0.02];
  const SICK = [1, 1, 1, 0, 0, 0, 0, 1, 0, 0];
  const NAMES = "ABCDEFGHIJ".split("");
  // make_scores.out.txt, roc_curve on the ten cases with drop_intermediate=False, and roc_auc_score
  const SK_TEN = { fpr: [0.0, 0.0, 0.0, 0.0, 0.1667, 0.3333, 0.5, 0.6667, 0.6667, 0.8333, 1.0], tpr: [0.0, 0.25, 0.5, 0.75, 0.75, 0.75, 0.75, 0.75, 1.0, 1.0, 1.0], auc: 0.8333 };
  // the five stops the learner slides through (trace_roc.py `stops`)
  const STOPS = [0.80, 0.40, 0.10, 0.04, 0.00];
  // trace_roc.out.txt FRAMES: the steps the code screen shows (first step, each loop head at line 4, each
  // "counts done" step at line 9, the end at line 11), as [line about to run, event, t, tp, fp, len(points)]
  const TRACE = [[1,"l",null,null,null,0],[4,"l",null,null,null,0],[9,"l",0.8,1,0,0],[4,"l",0.8,1,0,1],[9,"l",0.4,3,0,1],[4,"l",0.4,3,0,2],[9,"l",0.1,3,2,2],[4,"l",0.1,3,2,3],[9,"l",0.04,4,4,3],[4,"l",0.04,4,4,4],[9,"l",0.0,4,6,4],[4,"l",0.0,4,6,5],[11,"l",0.0,4,6,5],[11,"r",0.0,4,6,5]];
  const N_SICK_T = 4, N_HEALTHY_T = 6; // trace_roc.out.txt: n_sick 4, n_healthy 6
  // trace_roc.out.txt RESULT
  const RESULT = [[0.0, 0.25], [0.0, 0.75], [0.3333333333333333, 0.75], [0.6666666666666666, 1.0], [1.0, 1.0]];
  // The listing is roc_points from trace_roc.py, line for line (line 0 = def).
  const CODE = [
    "def roc_points(scores, sick, stops):",
    "    n_sick = sum(sick)",
    "    n_healthy = len(sick) - n_sick",
    "    points = []",
    "    for t in stops:",
    "        tp = fp = 0",
    "        for s, ill in zip(scores, sick):",
    "            if s >= t and ill: tp += 1",
    "            elif s >= t: fp += 1",
    "        x, y = fp / n_healthy, tp / n_sick",
    "        points.append((x, y))",
    "    return points"
  ];
  // make_scores.out.txt: the 200 held-out patients
  const TEST = { n: 200, sick: 34, healthy: 166 };
  // OPERATING: [threshold, scanned, sick found, healthy scanned, sick missed]
  const OPERATING = [[0.05, 145, 33, 112, 1], [0.1, 109, 32, 77, 2], [0.15, 85, 31, 54, 3], [0.2, 74, 30, 44, 4], [0.3, 54, 27, 27, 7], [0.4, 32, 22, 10, 12], [0.5, 24, 19, 5, 15], [0.6, 21, 18, 3, 16]];
  // CURVES: roc_curve (default drop_intermediate=True) and precision_recall_curve on the 200, rounded to 4 places
  const ROC_FPR = [0.0,0.0,0.006,0.006,0.012,0.012,0.0181,0.0181,0.0241,0.0241,0.0361,0.0361,0.0422,0.0422,0.0663,0.0663,0.0723,0.0723,0.1024,0.1024,0.1566,0.1566,0.1627,0.1627,0.1807,0.1807,0.2048,0.2048,0.253,0.253,0.3012,0.3012,0.3675,0.3675,0.506,0.506,0.753,0.753,1.0];
  const ROC_TPR = [0.0,0.0294,0.0294,0.3235,0.3235,0.4412,0.4412,0.5294,0.5294,0.5588,0.5588,0.6176,0.6176,0.6471,0.6471,0.6765,0.6765,0.7059,0.7059,0.7353,0.7353,0.7647,0.7647,0.7941,0.7941,0.8235,0.8235,0.8529,0.8529,0.8824,0.8824,0.9118,0.9118,0.9412,0.9412,0.9706,0.9706,1.0,1.0];
  const PR_P = [0.17,0.1709,0.1717,0.1726,0.1735,0.1744,0.1753,0.1762,0.1771,0.178,0.1789,0.1799,0.1809,0.1818,0.1828,0.1838,0.1848,0.1858,0.1868,0.1878,0.1889,0.1899,0.191,0.1921,0.1932,0.1943,0.1954,0.1965,0.1977,0.1988,0.2,0.2012,0.2024,0.2036,0.2048,0.2061,0.2073,0.2086,0.2099,0.2112,0.2125,0.2138,0.2089,0.2102,0.2115,0.2129,0.2143,0.2157,0.2171,0.2185,0.22,0.2215,0.223,0.2245,0.226,0.2276,0.2292,0.2308,0.2324,0.234,0.2357,0.2374,0.2391,0.2409,0.2426,0.2444,0.2463,0.2481,0.25,0.2519,0.2538,0.2558,0.2578,0.2598,0.2619,0.264,0.2661,0.2683,0.2705,0.2727,0.275,0.2773,0.2797,0.2821,0.2759,0.2783,0.2807,0.2832,0.2857,0.2883,0.2909,0.2936,0.2963,0.2991,0.3019,0.3048,0.3077,0.3107,0.3137,0.3168,0.32,0.3232,0.3265,0.3299,0.3333,0.3368,0.3404,0.3441,0.337,0.3407,0.3444,0.3483,0.3523,0.3563,0.3605,0.3647,0.369,0.3735,0.378,0.3827,0.375,0.3797,0.3846,0.3896,0.3947,0.4,0.4054,0.411,0.4167,0.4085,0.4143,0.4203,0.4265,0.4328,0.4394,0.4462,0.4531,0.4603,0.4516,0.459,0.4667,0.4746,0.4828,0.4737,0.4821,0.4909,0.5,0.4906,0.5,0.4902,0.5,0.5102,0.5208,0.5319,0.5435,0.5556,0.5682,0.5814,0.5952,0.5854,0.6,0.6154,0.6316,0.6486,0.6667,0.6571,0.6765,0.6667,0.6875,0.7097,0.7333,0.7586,0.75,0.7778,0.7692,0.76,0.7917,0.8261,0.8182,0.8571,0.85,0.8421,0.8333,0.8824,0.875,0.8667,0.8571,0.8462,0.9167,0.9091,0.9,0.8889,0.875,0.8571,0.8333,0.8,0.75,0.6667,0.5,1.0,1.0];
  const PR_R = [1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9706,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9412,0.9118,0.9118,0.9118,0.9118,0.9118,0.9118,0.9118,0.9118,0.9118,0.9118,0.9118,0.9118,0.8824,0.8824,0.8824,0.8824,0.8824,0.8824,0.8824,0.8824,0.8824,0.8529,0.8529,0.8529,0.8529,0.8529,0.8529,0.8529,0.8529,0.8529,0.8235,0.8235,0.8235,0.8235,0.8235,0.7941,0.7941,0.7941,0.7941,0.7647,0.7647,0.7353,0.7353,0.7353,0.7353,0.7353,0.7353,0.7353,0.7353,0.7353,0.7353,0.7059,0.7059,0.7059,0.7059,0.7059,0.7059,0.6765,0.6765,0.6471,0.6471,0.6471,0.6471,0.6471,0.6176,0.6176,0.5882,0.5588,0.5588,0.5588,0.5294,0.5294,0.5,0.4706,0.4412,0.4412,0.4118,0.3824,0.3529,0.3235,0.3235,0.2941,0.2647,0.2353,0.2059,0.1765,0.1471,0.1176,0.0882,0.0588,0.0294,0.0294,0.0];
  // library_run.py, lines 6-16, and library_run.out.txt (printed output, not altered)
  const LIB_CODE = [
    "scores = model.predict_proba(X)[:, 1]",
    "fpr, tpr, th = roc_curve(sick, scores)",
    "auc = roc_auc_score(sick, scores)",
    "print(len(th), th[0], round(auc, 3))",
    "pr = precision_recall_curve(sick, scores)",
    "ap = average_precision_score(sick, scores)",
    "print(len(pr[0]), len(pr[2]), round(ap, 3))",
    "labels = model.predict(X)",
    "hard_th = roc_curve(sick, labels)[2]",
    "hard_auc = roc_auc_score(sick, labels)",
    "print(len(hard_th), round(hard_auc, 3))"
  ];
  const LIB_OUT = ["39 inf 0.899", "201 200 0.708", "3 0.764"];
  const LIB = { rocPoints: 39, auc: 0.899, prLen: 201, prTh: 200, ap: 0.708, hardPoints: 3, hardAuc: 0.764 };

  /* ---------- Derived from the data ---------- */
  const N = SCORES.length;
  const nSick = SICK.reduce((a, b) => a + b, 0), nHealthy = N - nSick;
  const count = t => {
    let tp = 0, fp = 0;
    SCORES.forEach((s, i) => { if (s >= t) { if (SICK[i]) tp++; else fp++; } });
    return { tp, fp, fn: nSick - tp, tn: nHealthy - fp };
  };
  const T1 = 0.40;                                   // screen 1 threshold
  const C1 = count(T1);
  const HIDDEN = SCORES.findIndex((s, i) => SICK[i] && s < T1); // the sick patient the test ranks low
  // pairs: a sick and a healthy patient, how often does the sick one score higher?
  const PAIRS = (() => { let win = 0, all = 0; SCORES.forEach((s, i) => { if (!SICK[i]) return; SCORES.forEach((h, j) => { if (SICK[j]) return; all++; if (s > h) win++; }); }); return { win, all }; })();
  const cost = (row, miss) => row[1] + miss * row[4];
  const best = miss => OPERATING.reduce((b, r) => cost(r, miss) < cost(b, miss) ? r : b);
  const MISS_HI = 20, MISS_LO = 3;

  /* ---------- Lesson-local style and pictures ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-pl { margin: 16px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); max-width: 460px; }
      .lx-${ID}-pl li { border-bottom: 1px solid var(--line); }
      .lx-${ID}-p { display: grid; grid-template-columns: 2.4em 3.6em 1fr auto; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 6px 8px; font: inherit; font-size: 15.5px; text-align: left; color: var(--ink); background: transparent; border: 0; border-left: 3px solid transparent; }
      button.lx-${ID}-p { cursor: pointer; }
      button.lx-${ID}-p:hover { background: var(--sunk); }
      .lx-${ID}-p b { font: 600 15px var(--mono); }
      .lx-${ID}-sc { font: 500 15px var(--mono); }
      .lx-${ID}-st { color: var(--muted); font-size: 14.5px; }
      .lx-${ID}-p.lx-${ID}-on { border-left-color: var(--ink); background: var(--good-soft); }
      .lx-${ID}-tag { font-size: 13.5px; color: var(--ink-2); }
      .lx-${ID}-line { display: flex; align-items: center; gap: 8px; padding: 2px 0; font: 600 13px var(--mono); color: var(--ink); }
      .lx-${ID}-line::before, .lx-${ID}-line::after { content: ""; flex: 1; border-top: 2px dashed var(--ink); }
      .lx-${ID}-chart { display: block; width: 100%; max-width: 340px; height: auto; margin: 10px 0 0; }
      .lx-${ID}-chart text { font: 500 11px var(--font); fill: var(--muted); }
      .lx-${ID}-chart .ax { stroke: var(--line); stroke-width: 1; fill: none; }
      .lx-${ID}-chart .dg { stroke: var(--faint); stroke-width: 1; stroke-dasharray: 4 4; fill: none; }
      .lx-${ID}-chart .cv { stroke: var(--ink); stroke-width: 2; fill: none; }
      .lx-${ID}-chart .dt { fill: var(--ink); }
      .lx-${ID}-charts { display: flex; flex-wrap: wrap; gap: 8px 24px; }
      .lx-${ID}-charts > div { flex: 1 1 240px; min-width: 0; }
      .lx-${ID}-cap { margin: 4px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-tb { width: 100%; max-width: 460px; margin: 14px 0 0; border-collapse: collapse; font-size: 15px; }
      .lx-${ID}-tb th, .lx-${ID}-tb td { padding: 7px 6px; border-bottom: 1px solid var(--line); text-align: right; }
      .lx-${ID}-tb th { font-weight: 600; font-size: 13px; color: var(--muted); }
      .lx-${ID}-tb th:first-child, .lx-${ID}-tb td:first-child { text-align: left; }
      .lx-${ID}-tb td { font-family: var(--mono); }
      .lx-${ID}-tb tr.lx-${ID}-best td { font-weight: 700; background: var(--sunk); }
      .lx-${ID}-tb tr.lx-${ID}-best td:first-child { box-shadow: inset 3px 0 0 var(--ink); }
      .lx-${ID}-out { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-axes { margin: 6px 0 0; font-size: 14px; color: var(--muted); }
    `;
    document.head.appendChild(s);
  }

  /* The ten patients, highest score first. opts: pick (rows are buttons), on {i: true}, line (threshold drawn),
     showSick (the follow-up result). */
  function patients(kit, { pick = false, on = {}, line = null, showSick = true } = {}) {
    let h = "", drawn = false;
    SCORES.forEach((s, i) => {
      if (line != null && !drawn && s < line) { h += `<li class="lx-${ID}-line" aria-label="threshold ${f2(line)}">scan if score ≥ ${f2(line)}</li>`; drawn = true; }
      const tag = pick ? "button" : "div";
      h += `<li><${tag}${pick ? ` type="button" data-i="${i}"` : ""} class="lx-${ID}-p${on[i] ? ` lx-${ID}-on` : ""}"><b>${NAMES[i]}</b><span class="lx-${ID}-sc">${f2(s)}</span><span class="lx-${ID}-st">${showSick ? (SICK[i] ? "sick" : "healthy") : ""}</span><span class="lx-${ID}-tag">${on[i] ? "scan" : ""}</span></${tag}></li>`;
    });
    if (line != null && !drawn) h += `<li class="lx-${ID}-line">scan if score ≥ ${f2(line)}</li>`;
    return `<ul class="lx-${ID}-pl">${h}</ul>`;
  }

  /* A small square chart, 0..1 on both axes. lines: [{ x, y, steps }], dots: [[x, y]], diag: chance line,
     base: a horizontal chance line at this height. */
  function chart(kit, { lines = [], dots = [], diag = false, base = null, xLabel, yLabel, title }) {
    const W = 300, H = 260, L = 40, R = 12, T = 12, B = 40, w = W - L - R, hgt = H - T - B;
    const X = v => (L + v * w).toFixed(1), Y = v => (T + (1 - v) * hgt).toFixed(1);
    const path = ({ x, y, steps }) => x.map((xv, i) => {
      if (i === 0) return `M${X(xv)},${Y(y[0])}`;
      return steps ? `L${X(xv)},${Y(y[i - 1])}L${X(xv)},${Y(y[i])}` : `L${X(xv)},${Y(y[i])}`;
    }).join("");
    const ticks = [0, 0.5, 1];
    return `<svg class="lx-${ID}-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${kit.esc(title)}">
      <rect class="ax" x="${L}" y="${T}" width="${w}" height="${hgt}"/>
      ${ticks.map(t => `<text x="${X(t)}" y="${H - B + 16}" text-anchor="middle">${t}</text><text x="${L - 6}" y="${+Y(t) + 4}" text-anchor="end">${t}</text>`).join("")}
      <text x="${L + w / 2}" y="${H - 6}" text-anchor="middle">${kit.esc(xLabel)}</text>
      <text x="12" y="${T + hgt / 2}" text-anchor="middle" transform="rotate(-90 12 ${T + hgt / 2})">${kit.esc(yLabel)}</text>
      ${diag ? `<path class="dg" d="M${X(0)},${Y(0)}L${X(1)},${Y(1)}"/>` : ""}
      ${base != null ? `<path class="dg" d="M${X(0)},${Y(base)}L${X(1)},${Y(base)}"/>` : ""}
      ${lines.map(l => `<path class="cv" d="${path(l)}"/>`).join("")}
      ${dots.map(([x, y]) => `<circle class="dt" cx="${X(x)}" cy="${Y(y)}" r="4.5"/>`).join("")}
    </svg>`;
  }

  /* A question block that remembers a wrong pick. */
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }
  /* Several questions in a row on one screen; each opens after the one before is right. */
  function sequence({ el, done, kit }, head, qs, after) {
    let k = 0, ans = null;
    const paint = () => {
      const past = qs.slice(0, k).map(q => `<p class="lead">${q.ask}</p>${kit.feedback(q.fb[q.right][0], true)}`).join("");
      const q = qs[k];
      el.innerHTML = `${head(k)}${past}${q ? `<p class="task">${q.ask}</p><div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}</div>` : after()}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === qs[k].right) { k++; ans = null; paint(); if (k === qs.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 1. The situation: who gets the scan at one threshold? */
  function whoIsScanned({ el, done, kit }) {
    ensureStyle();
    const on = {};
    let fb = "";
    const need = SCORES.map((s, i) => s >= T1 ? i : -1).filter(i => i >= 0);
    const paint = () => {
      const fin = need.every(i => on[i]);
      el.innerHTML = `<h1>Who gets the scan?</h1>
        <p class="lead">A clinic screens patients with a cheap blood test. A small model turns each result into a <b>score</b> between 0 and 1: higher means more likely sick. A costly scan gives the final answer, so the clinic sends a person to the scan only if the score is at or above a <b>threshold</b>. A year later, the clinic learned who was really sick. (The patients in this lesson are simulated; the scores come from a real model trained on them.)</p>
        <p class="lead">Every classifier you ship works like this: the model gives a score, and someone picks the threshold that turns it into a yes or a no. This lesson is about how to pick it.</p>
        <p class="lead">Here are ${N} of the patients, highest score first. The clinic's threshold is ${f2(T1)}.</p>
        <p class="task">Tap every patient who gets sent to the scan.</p>
        ${patients(kit, { pick: !fin, on })}
        <div class="lpanel">${fin ? kit.feedback(`Right: ${need.map(i => NAMES[i]).join(", ")}. All ${C1.tp + C1.fp} patients sent on are sick, so no healthy person gets a scan: good. But patient ${NAMES[HIDDEN]} was sick too, with a score of only ${f2(SCORES[HIDDEN])}. At this threshold the clinic finds ${C1.tp} of ${nSick} sick patients and scans ${C1.fp} of ${nHealthy} healthy ones. Two shares describe that: the <b>true positive rate</b> (sick patients sent on, out of all sick: ${C1.tp}/${nSick}; you met it as recall) and the <b>false positive rate</b> (healthy patients sent on, out of all healthy: ${C1.fp}/${nHealthy}).`, true) : fb}</div>`;
      el.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (SCORES[i] < T1) {
          fb = kit.feedback(`${NAMES[i]}'s score is ${f2(SCORES[i])}, below ${f2(T1)}. The rule only looks at the score: ${NAMES[i]} stays home${SICK[i] ? ", even though follow-up found " + NAMES[i] + " sick. The test cannot know that yet" : ""}.`, false);
        } else { on[i] = !on[i]; fb = ""; }
        paint();
        if (need.every(j => on[j])) done();
      });
    };
    paint();
  }

  /* 2. By hand: slide the threshold, count, and place each point on the chart. */
  function slideByHand({ el, done, kit }) {
    ensureStyle();
    let k = 0, fb = "";
    const placed = [[nSick, 0, "0"]]; // [row, col, label]; row = nSick - tp, col = fp. Start: nobody scanned.
    const paint = () => {
      const fin = k >= STOPS.length;
      const t = fin ? STOPS[STOPS.length - 1] : STOPS[k];
      const cls = {}, rows = Array.from({ length: nSick + 1 }, () => Array(nHealthy + 1).fill(""));
      placed.forEach(([r, c, lab], j) => { rows[r][c] = lab; cls[`${r},${c}`] = j === placed.length - 1 && j > 0 ? "enter" : "in"; });
      el.innerHTML = `<h1>Slide the threshold</h1>
        <p class="lead">Now you move the threshold down, one stop at a time. At each stop, count the patients above the dashed line. Then tap one cell in the grid below the list. Up is the true positive rate (sick sent on, out of ${nSick}). Across is the false positive rate (healthy sent on, out of ${nHealthy}). The cell marked 0 is the start: a threshold above every score, so nobody is scanned.</p>
        ${fin ? "" : `<p class="task">Stop ${k + 1} of ${STOPS.length}: threshold ${f2(t)}. Tap the cell for this stop.</p>`}
        ${patients(kit, { line: t })}
        ${kit.pics.grid(rows, { cls, pick: !fin, rowHead: rows.map((_, r) => `${nSick - r}/${nSick}`), colHead: rows[0].map((_, c) => `${c}/${nHealthy}`), title: "up: sick sent on · across: healthy sent on" })}
        <div class="lpanel">${fin ? kit.feedback(`All ${STOPS.length} stops placed. Lowering the threshold only ever moves the point up (one more sick patient found) or right (one more healthy patient scanned). Join the points and you get the <b>ROC curve</b> of this test (ROC is just the standard name for this chart): one point per threshold, from nobody scanned (0, 0) to everybody scanned (1, 1).`, true) : fb}</div>`;
      el.querySelectorAll(".lp-grid [data-i]").forEach(b => b.onclick = () => {
        const [r, c] = b.dataset.i.split(",").map(Number);
        const { tp, fp } = count(t), want = [nSick - tp, fp];
        if (r === want[0] && c === want[1]) {
          placed.push([r, c, String(k + 1)]); k++; fb = "";
          paint(); if (k >= STOPS.length) done(); return;
        }
        const gotTp = nSick - r, gotFp = c, msg = [];
        if (gotTp === fp && gotFp === tp && tp !== fp) msg.push("You swapped the two counts: up is sick patients sent on, across is healthy patients sent on.");
        else {
          if (gotTp !== tp) msg.push(`Up says ${gotTp} sick sent on, but above the line ${tp === 1 ? "there is" : "there are"} ${plural(tp, "sick patient")}.`);
          if (gotFp !== fp) msg.push(`Across says ${gotFp} healthy sent on, but above the line ${fp === 1 ? "there is" : "there are"} ${plural(fp, "healthy patient")}.`);
        }
        fb = kit.feedback(msg.join(" ") + ` Count only the patients above the dashed line (score ≥ ${f2(t)}).`, false);
        paint();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the scores are the test; the threshold is a choice. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const c4 = count(STOPS[3]), c5 = count(0.5);
    const opts = [
      "Buy a better test: this one is broken",
      `Keep the test and lower the threshold to ${f2(STOPS[3])}, accepting ${plural(c4.fp, "healthy scan")} out of ${nHealthy}`,
      "Lower the threshold to 0.00: then nobody is ever missed, which is the best point",
      "Use 0.50: a score above one half means more likely sick than not"
    ];
    const fb = [
      [`The scores did not change between your stops; only the line moved. The same test gave every point you placed. Whether a stop is acceptable depends on the threshold, not on the test alone. (A better test would push the whole curve up and to the left, but that is a bigger and slower fix.)`, false],
      [`Right. The model's job is to <b>rank</b>: put sick patients above healthy ones. The threshold is a separate decision about how far down the ranking to go, and every stop is the same test. Here ${c4.tp}/${nSick} sick are found for ${c4.fp}/${nHealthy} healthy scans. How well does this test rank? Take every pair of one sick and one healthy patient: in ${PAIRS.win} of ${PAIRS.all} pairs the sick one scores higher, ${f3(PAIRS.win / PAIRS.all)}. That share has a name: the <b>area under the ROC curve</b> (AUC), when the curve has a point at every score. 1 is a perfect ranking; 0.5 is a coin toss.`, true],
      [`At 0.00 everyone is scanned: ${nHealthy}/${nHealthy} healthy people too. That is the point (1, 1). It misses no one, but the cheap test then does nothing; you could skip it and scan everybody.`, false],
      [`0.50 is only a default: scikit-learn's <code>predict</code> cuts there when you never chose. Nothing about this clinic's costs makes it right. Here it would find only ${c5.tp} of ${nSick} sick patients, worse than ${f2(T1)}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Is the test broken?</h1>
        <p class="lead">The manager sees that at ${f2(T1)} the clinic missed patient ${NAMES[HIDDEN]}, who was sick. She says the clinic needs a new test. The clinic's doctors want every sick patient in these ten found, and they accept some extra scans.</p>
        ${chart(kit, { lines: [{ x: [0, ...RESULT.map(p => p[0])], y: [0, ...RESULT.map(p => p[1])] }], dots: [[0, 0], ...RESULT], diag: true, xLabel: "false positive rate", yLabel: "true positive rate", title: "Your five points and the start point, joined" })}
        <p class="lx-${ID}-cap">Your points, joined. The dashed diagonal is what random scores give on average.</p>
        <p class="task">What do you tell her?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Predictions: precision, and what more healthy people do to each chart. */
  function prevalence(ctx) {
    ensureStyle();
    const t = STOPS[2], c = count(t), M = 10;
    const fpM = c.fp * M, hM = nHealthy * M;
    const qs = [
      { ask: `At threshold ${f2(t)}, what share of the people sent to the scan are really sick (the <b>precision</b>)?`, right: 0,
        opts: [`${c.tp} of ${c.tp + c.fp}`, `${c.tp} of ${nSick}`, `${c.fp} of ${nHealthy}`],
        fb: [[`Right: ${c.tp} of the ${c.tp + c.fp} scanned are sick, ${f2(c.tp / (c.tp + c.fp))}. The other ${c.fp} scans were on healthy people.`, true],
          [`${c.tp} of ${nSick} is the true positive rate: out of all sick patients, how many were found. Precision divides by the people you sent, ${c.tp + c.fp}.`, false],
          [`${c.fp} of ${nHealthy} is the false positive rate: out of all healthy people, how many were scanned. Precision asks about the scanned group instead.`, false]] },
      { ask: `A bigger clinic uses the same test. It sees ${M} times as many healthy people, with the same scores, and the same ${nSick} sick. At ${f2(t)}, where is its point on the ROC chart?`, right: 0,
        opts: ["In the same place", `${M} times further right`, "Lower down"],
        fb: [[`Right. Healthy scanned: ${fpM} of ${hM}, still ${f2(fpM / hM)}. Sick found: still ${c.tp} of ${nSick}. Each rate divides by its own group, so the number of healthy people cancels out.`, true],
          [`The count of healthy scans grows ${M} times (${c.fp} to ${fpM}), but so does the group it is divided by (${nHealthy} to ${hM}). The rate stays ${f2(fpM / hM)}.`, false],
          [`Up and down is about the sick patients only. There are still ${nSick}, and the same ${c.tp} score above ${f2(t)}.`, false]] },
      { ask: `And the precision at the bigger clinic?`, right: 1,
        opts: [`Still ${c.tp} of ${c.tp + c.fp}`, `${c.tp} of ${c.tp + fpM}`, `${c.tp * M} of ${(c.tp + c.fp) * M}`],
        fb: [[`Precision divides by everyone scanned, and that group now holds ${fpM} healthy people, not ${c.fp}.`, false],
          [`Right: ${f2(c.tp / (c.tp + fpM))}, down from ${f2(c.tp / (c.tp + c.fp))}. The ROC point did not move, but most scans are now wasted. When the thing you look for is rare, the ROC chart can look fine while most alarms are false. The <b>precision-recall curve</b> (precision up, recall across) shows it, so read that one when positives are rare.`, true],
          [`Only the healthy group grew. The sick patients found are still ${c.tp}, not ${c.tp * M}.`, false]] }
    ];
    sequence(ctx, () => `<h1>More healthy people, same test</h1>
      <p class="lead">Take the stop at ${f2(t)} from your chart: ${c.tp} sick and ${c.fp} healthy patients above the line.</p>`, qs, () => "");
  }

  /* 5. Pick the operating point from the stated cost. */
  function operatingPoint(ctx) {
    ensureStyle();
    const bHi = best(MISS_HI), bLo = best(MISS_LO);
    const showRows = [OPERATING[0], bHi, OPERATING[4], OPERATING[6]].filter((r, i, a) => a.indexOf(r) === i);
    const table = (miss, mark) => `<table class="lx-${ID}-tb"><thead><tr><th>threshold</th><th>scans</th><th>sick missed</th>${miss ? `<th>cost (miss = ${miss})</th>` : ""}</tr></thead><tbody>${OPERATING.map(r => `<tr${mark === r ? ` class="lx-${ID}-best"` : ""}><td>${f2(r[0])}</td><td>${r[1]}</td><td>${r[4]}</td>${miss ? `<td>${cost(r, miss)}</td>` : ""}</tr>`).join("")}</tbody></table>`;
    const qs = [
      { ask: `A scan costs 1 unit. The clinic's finance team says a missed sick patient costs ${MISS_HI} units (later, harder treatment). Which threshold costs least in total?`,
        right: showRows.indexOf(bHi), opts: showRows.map(r => f2(r[0])),
        fb: showRows.map(r => r === bHi
          ? [`Right: ${r[1]} scans + ${MISS_HI} × ${r[4]} missed = ${cost(r, MISS_HI)} units, the lowest in the table. Going lower still finds more sick people, but each one costs many healthy scans; going higher saves scans but each miss costs ${MISS_HI}.`, true]
          : [`${f2(r[0])} costs ${r[1]} + ${MISS_HI} × ${r[4]} = ${cost(r, MISS_HI)} units. ${r[0] < bHi[0] ? `It finds ${bHi[4] - r[4]} more sick ${bHi[4] - r[4] === 1 ? "patient" : "patients"} than ${f2(bHi[0])}, but pays ${r[1] - bHi[1]} more scans for ${bHi[4] - r[4] === 1 ? "it" : "them"}.` : `It saves ${bHi[1] - r[1]} scans against ${f2(bHi[0])}, but misses ${r[4] - bHi[4]} more sick people at ${MISS_HI} units each.`}`, false]) },
      { ask: `Now say a miss only costs ${MISS_LO} units. Where does the cheapest threshold move?`, right: 1,
        opts: ["Lower: scan more people", "Higher: scan fewer people", "It stays where it is"],
        fb: [[`A miss got cheaper. Lowering the threshold adds scans to avoid misses, and misses are now cheap, so those extra scans no longer pay for themselves.`, false],
          [`Right: the cheapest is now ${f2(bLo[0])} (${cost(bLo, MISS_LO)} units). The model and the ROC curve did not change at all; only the price of each mistake did, and the operating point moved with it.`, true],
          [`The scans and misses at each threshold stay the same, but their total cost changes: at ${f2(bHi[0])} it falls to ${cost(bHi, MISS_LO)}, while at ${f2(bLo[0])} it is ${cost(bLo, MISS_LO)}.`, false]] }
    ];
    sequence(ctx, k => `<h1>Pick the threshold from the cost</h1>
      <p class="lead">Now all ${TEST.n} held-out patients (${TEST.sick} sick), people the model never saw in training. For each threshold: how many are scanned, and how many sick are missed.</p>
      ${table(k >= 1 ? MISS_HI : 0, k >= 1 ? bHi : null)}`, qs,
      () => `${table(MISS_LO, bLo)}<p class="lead">The cheapest point is a fact about your costs, not about the model. Choose it on held-out data, as here, not on the data the model learned from.</p>`);
  }

  /* 6. From scratch in Python: the stepped replay of roc_points. */
  const FR = TRACE.map(([ln, ev, t, tp, fp, np]) => ({ ln, ev, t, tp, fp, np }));
  function fromScratch({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const say = f => {
      if (f.ln === 1) return `Start: about to count the sick (line 1) and the healthy (line 2) in the ten cases.`;
      if (f.ln === 4 && f.np === 0) return `<code>n_sick</code> is ${N_SICK_T}, <code>n_healthy</code> is ${N_HEALTHY_T}. These are the two numbers every rate is divided by. Now the loop over the stops. (<code>ill</code> is 1 for a sick patient, 0 for a healthy one.)`;
      if (f.ln === 9) return `Threshold ${f2(f.t)}: lines 5 to 8 went through the ten patients and counted those at or above it: ${plural(f.tp, "sick patient")} and ${plural(f.fp, "healthy patient")}. Line 9 turns the two counts into rates.`;
      if (f.ln === 4) { const p = RESULT[f.np - 1]; return `Point ${f.np} stored: (${f3(p[0])}, ${f3(p[1])}), that is ${f.fp}/${N_HEALTHY_T} across and ${f.tp}/${N_SICK_T} up, the cell you tapped at stop ${f.np}.${f.np < STOPS.length ? " Next stop." : ""}`; }
      if (f.ln === 11 && f.ev === "r") return `Returned all ${RESULT.length} points. The list of thresholds was yours to choose; the scores and the sick labels came from the data.`;
      return `All ${STOPS.length} stops done: about to return the points.`;
    };
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The same thing in Python</h1>
        <p class="lead">Your by-hand work as a function: for each threshold, mark who is scanned, count sick and healthy among them, store one point. This replays a real run on the ten cases and your ${STOPS.length} stops.</p>
        <p class="task">Step through to the end, and check each point against the cells you tapped.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>t <b>${f.t == null ? "–" : f2(f.t)}</b></span><span>tp <b>${f.tp == null ? "–" : f.tp}</b></span><span>fp <b>${f.fp == null ? "–" : f.fp}</b></span><span>len(points) <b>${f.np}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(say(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. The real library: scikit-learn's curves, and a prediction about a common mistake. */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const tenMatch = RESULT.every(([x, y]) => SK_TEN.fpr.some((fx, j) => Math.abs(fx - x) < 1e-3 && Math.abs(SK_TEN.tpr[j] - y) < 1e-3));
    const opts = [String(LIB.rocPoints), String(LIB.hardPoints), String(TEST.n + 1)];
    const RIGHT = 1;
    const fb = [
      [`${LIB.rocPoints} came from the scores: many different values, so many thresholds. <code>predict</code> returns only 0 or 1, so there are only two values to put a threshold at.`, false],
      [`Right: the last line of the output is <code>${kit.esc(LIB_OUT[2])}</code>. Two values give thresholds 1 and 0 plus the starting infinity: three points, one real operating point in the middle, and an area of ${LIB.hardAuc} instead of ${LIB.auc}. Nothing errors, so this mistake slips through. Always pass scores (<code>predict_proba(...)[:, 1]</code>, or <code>decision_function</code> on models that have it), never labels.`, true],
      [`That would be one point per distinct score plus the start. With 0/1 labels there are only two distinct values.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same curves in scikit-learn</h1>
        <p class="lead">This run uses all ${TEST.n} held-out patients. Each <code>print</code> gives one line of output.</p>
        <p class="lead"><code>roc_curve</code> returns the two rates and the thresholds, highest threshold first. The first threshold is infinity (<code>inf</code>): nobody scanned, the point (0, 0). By default (<code>drop_intermediate=True</code>) it leaves out points that sit on a straight line between their neighbours. That changes neither the shape nor the area.</p>
        <p class="lead"><code>precision_recall_curve</code> returns precision, recall and thresholds (<code>pr[0]</code>, <code>pr[1]</code>, <code>pr[2]</code>). It has one more precision and recall than thresholds: a final point (precision 1, recall 0) with no threshold.</p>
        ${tenMatch ? `<p class="lead">On your ten cases, <code>roc_curve</code> gives every point you placed, plus one for each score your stops skipped. <code>roc_auc_score</code> gives ${f3(SK_TEN.auc)}, the pair count from before.</p>` : ""}
        ${kit.code(LIB_CODE, ans === RIGHT ? 8 : -1)}
        <div class="lx-${ID}-out">${kit.esc((ans === RIGHT ? LIB_OUT : LIB_OUT.slice(0, 2)).join("\n"))}</div>
        <p class="lx-${ID}-cap">Output of this run on our machine${ans === RIGHT ? "" : " (last line hidden)"}.</p>
        <div class="lx-${ID}-charts">
          <div>${chart(kit, { lines: [{ x: ROC_FPR, y: ROC_TPR }], diag: true, xLabel: "false positive rate", yLabel: "true positive rate", title: "ROC curve, 200 patients" })}<p class="lx-${ID}-cap">ROC, area ${LIB.auc}. Dashed: random scores.</p></div>
          <div>${chart(kit, { lines: [{ x: PR_R, y: PR_P, steps: true }], base: TEST.sick / TEST.n, xLabel: "recall", yLabel: "precision", title: "Precision-recall curve, 200 patients" })}<p class="lx-${ID}-cap">Precision-recall, average precision (one number that sums up this curve, like the area for ROC) ${LIB.ap}. Dashed: random scores, at the share of sick people (${f2(TEST.sick / TEST.n)}).</p></div>
        </div>
        <p class="task">A teammate passes <code>labels</code> (the 0/1 output of <code>predict</code>) instead of scores, as on the last four lines. How many thresholds does <code>roc_curve</code> return?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const CASES = [
      ["A health service compares two screening models before choosing one. The winner will run in several hospitals where the share of sick patients differs, and each hospital sets its own threshold later.", 0,
        ["Right. No threshold is set yet and the share of sick patients differs between hospitals. The ROC area compares how well each model ranks over every threshold, and it does not move when that share changes.", true],
        ["Precision depends on the share of sick patients, so the same model would get a different precision-recall curve at each hospital. The ROC area compares the rankings in a way that does not move with that share, as you saw with the bigger clinic.", false]],
      ["A water company scores pipes for leaks from sensor readings. A leak is one pipe in many thousands, and every flag sends a crew out to dig.", 1,
        ["With so many sound pipes, the false positive rate stays tiny even when most flags are wrong. Look at precision: what share of the digs find a real leak.", false],
        ["Right. Positives are rare and each alarm has a cost, so precision is what the team feels. The precision-recall curve shows it; the ROC chart hides it.", true]]
    ];
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for curves and thresholds</h1>
        <p class="lead"><b>For:</b> any model that gives a score, when someone must turn it into a yes or no.</p>
        <p class="lead"><b>Reach for</b> the ROC area to compare models before the threshold is set. Reach for the precision-recall curve when positives are rare, and a cost table to set the threshold.</p>
        <p class="lead"><b>Not</b> when the model only gives labels (one point, no curve: ask for scores). Not when the output is a number to predict rather than a yes or no. Not when a fixed capacity decides instead of cost (thirty scans a day: rank and take the top thirty).</p>
        <p class="lead"><b>Costs:</b> labelled held-out data with enough positives, and prices for each mistake that people agree on. The threshold must be checked again when the patients or the share of sick people change.</p>
        <p class="task">Which chart or number should each team look at first?</p>
        ${CASES.map(([q, r, a, b], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["ROC area", "Precision-recall curve"], { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback((ans[i] === 0 ? a : b)[0], (ans[i] === 0 ? a : b)[1])}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const RECOG = [
    ["A mail service's spam model gives every message a score. Users complain that real mail lands in the spam folder.", true,
      "Yes. There is a score and a cut-off. Losing real mail is the costly mistake, so raise the threshold until precision is high enough, and accept a little more spam in the inbox.",
      "There is a score and a cut-off, and one mistake (real mail hidden) costs more than the other. That is exactly the trade a threshold controls: move it up until precision is high enough."],
    ["A bought-in service sorts support tickets into 'urgent' and 'normal'. It returns only the label, no score.", false,
      "No. With only labels there is one threshold the vendor already chose. You get one point, not a curve, and nothing to slide. Ask the vendor for scores, or build a model that gives them.",
      "There is nothing to move: a label is a score that has already been cut at a threshold someone else picked. You would get one point, not a curve. You need scores first."],
    ["A delivery app predicts how many minutes late each order will be.", false,
      "No. The answer is a number of minutes, not yes or no, so there are no sick and healthy groups to count. Measure the size of the errors (for example the average minutes off) instead.",
      "True and false positive rates need a yes-or-no answer and a group of real positives. Minutes late is a number. Use an error measure for numbers, unless the business turns it into a yes or no such as 'late by more than 15 minutes'."],
    ["A factory camera scores each part for cracks. A missed crack means a recall; a wrongly binned part costs a few cents.", true,
      "Yes. A score, two mistakes with very different prices: write the costs down and pick the threshold from a cost table on held-out parts. The price gap pushes the threshold low.",
      "This is the clinic again with parts: a score, a cut-off, and a miss that costs far more than a false alarm. Pick the threshold from the costs; it will sit low."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = RECOG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Threshold or not?</h1>
        <p class="lead">Four situations from other jobs. The idea: a model's score, a threshold you choose from the cost of each mistake, read off a ROC or precision-recall curve.</p>
        <p class="task">Does this idea fit each one? Pick again if you change your mind.</p>
        ${RECOG.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (RECOG.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can pick the threshold</h1>
      <p class="lead">You slid a threshold over ten scored patients, placed the ROC points by hand, saw that the model only ranks and the threshold is a separate choice, saw why precision falls when healthy people far outnumber the sick while the ROC point stays put, and picked the cheapest threshold from the cost of a scan and of a miss.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the function that turns scores and labels into ROC points, then pick the threshold with the lowest total cost.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You saw precision collapse when the thing you look for is rare; next you meet a model whose accuracy looks great for exactly that reason, and the fixes.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Thresholds, ROC and precision-recall curves",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_curve.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_recall_curve.html",
      "https://scikit-learn.org/stable/modules/model_evaluation.html",
      "https://scikit-learn.org/stable/modules/classification_threshold.html",
      "https://doi.org/10.1016/j.patrec.2005.10.010"
    ],
    interview: [
      {
        q: "Your fraud model has a ROC AUC of 0.95, but the operations team says most of the alerts it raises are false. How can both be true, and what do you do?",
        good: [
          "Fraud is rare, so even a small false positive rate means many false alerts next to few real ones",
          "ROC rates divide by each class separately, so they ignore how rare fraud is; precision does not",
          "Look at the precision-recall curve and average precision instead of only the ROC area",
          "Agree the cost of a missed fraud and of a false alert, and set the threshold from that on held-out data",
          "Re-check the threshold when the share of fraud changes"
        ],
        weak: "Say the model is good because 0.95 is high, or retrain it, without looking at precision or at the threshold."
      },
      {
        q: "A teammate ships a classifier using predict(), which cuts at 0.5. The product needs to miss almost no positives. What would you change?",
        good: [
          "0.5 is only a default; the threshold should come from the cost of each kind of mistake",
          "Get scores with predict_proba or decision_function and draw the ROC or precision-recall curve on held-out data",
          "Pick the threshold that reaches the needed recall at the least cost, for example from a cost table",
          "Tune it on validation data or with cross-validation, never on the training data (scikit-learn has TunedThresholdClassifierCV for this)"
        ],
        weak: "Retrain a bigger model to get more positives right, without noticing the threshold can be moved for free."
      }
    ],
    screens: [whoIsScanned, slideByHand, spotIdea, prevalence, operatingPoint, fromScratch, library, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-i="${SCORES.findIndex(s => s < 0.40)}"]`], right: SCORES.map((s, i) => s >= 0.40 ? `[data-i="${i}"]` : null).filter(Boolean) },
      { wrong: [`.lp-grid [data-i="0,${nHealthy}"]`], right: STOPS.map(t => { const c = count(t); return `.lp-grid [data-i="${nSick - c.tp},${c.fp}"]`; }) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: RECOG.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
