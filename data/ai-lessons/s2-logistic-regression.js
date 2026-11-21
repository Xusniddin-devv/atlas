/* Lesson: logistic regression, a probability instead of a number. Story: a small lender decides whether a loan
   applicant is likely to miss a repayment. Ideas: (1) the sigmoid squashes a weighted sum (the score) into a
   probability between 0 and 1, and a threshold on it is a straight boundary; (2) log loss charges
   -ln(probability given to what really happened), which has no ceiling, so confident mistakes cost the most.
   Then: the same model from scratch in NumPy (stepped replay), checked against scikit-learn, and a case where
   a straight boundary (logistic regression or a linear SVM) falls short.
   Data, all real, from runs on this Mac (no model recordings):
   - docs/ai-path/runs/s2-logistic-regression/make_data.py -> applications.csv (200 made-up applications, seed 0)
   - docs/ai-path/runs/s2-logistic-regression/train.py + train.out.txt: the least-squares line (LINEAR), the
     traced train() (TRACE, 3 epochs), full training (FULL), five applicants (FIVE), scikit-learn (SKLEARN),
     the two extreme applicants (EXTREMES)
   - docs/ai-path/runs/s2-logistic-regression/curve.py + curve.out.txt: the open-cards loan book (seed 1)
   Lesson-local style and picture: a small multi-column table and the sigmoid curve (SVG), see ensureStyle(). */
(() => {
  const ID = "s2-logistic-regression";
  const f = (x, d) => x.toFixed(d);
  const sig = z => 1 / (1 + Math.exp(-z));
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs ---------- */
  // train.out.txt, FULL: weights after 20000 epochs (lr 0.5); input order debt_share, late_payments
  const W = [7.8865, 1.0465], B = -5.3174;
  const LOSS_START = 0.6931, LOSS_END = 0.4368; // FULL / TRACE
  const N_APPS = 200, N_MISSED = 74;            // make_data.out.txt
  // train.out.txt, LINEAR: least-squares line on the 0/1 labels [debt_share, late_payments, bias]
  const LINE = [1.1737, 0.1597, -0.2999];
  const LINE_BELOW0 = 22, LINE_ABOVE1 = 3;
  const LINE_HI = { row: 138, debt: 0.67, late: 4, missed: 1 }, LINE_LO = { row: 11, debt: 0.05, late: 0, missed: 0 };
  // train.out.txt, FIVE
  const FIVE = [
    { row: 15, debt: 0.16, late: 1, missed: 0 },
    { row: 39, debt: 0.28, late: 2, missed: 0 },
    { row: 80, debt: 0.54, late: 1, missed: 0 },
    { row: 73, debt: 0.67, late: 1, missed: 1 },
    { row: 38, debt: 0.66, late: 3, missed: 1 }
  ];
  // train.out.txt, EXTREMES
  const SURE_WRONG = { row: 127, debt: 0.20, late: 0, missed: 1 };
  const UNSURE = FIVE[2]; // row 80: the model was close to 0.5, and he repaid
  // train.out.txt, FULL: counts at two thresholds, on the 200 applications the model trained on
  const AT = { 0.5: { flagged: 61, caught: 46, acc: 0.785 }, 0.3: { flagged: 106, caught: 63, acc: 0.73 } };
  // train.out.txt, TRACE: train(features, missed, 0.5, 3). Rows: [line about to run, event, epoch, w, b, loss, p[:3]]
  const TR = [[1,"l",null,null,null,null,null],[2,"l",null,[0,0],null,null,null],[3,"l",null,[0,0],0,null,null],[4,"l",0,[0,0],0,null,null],[5,"l",0,[0,0],0,null,null],[6,"l",0,[0,0],0,null,[0.5,0.5,0.5]],[7,"l",0,[0,0],0,0.6931,[0.5,0.5,0.5]],[8,"l",0,[0,0],0,0.6931,[0.5,0.5,0.5]],[9,"l",0,[-0.0037,0.0225],0,0.6931,[0.5,0.5,0.5]],[3,"l",0,[-0.0037,0.0225],-0.065,0.6931,[0.5,0.5,0.5]],[4,"l",1,[-0.0037,0.0225],-0.065,0.6931,[0.5,0.5,0.5]],[5,"l",1,[-0.0037,0.0225],-0.065,0.6931,[0.5,0.5,0.5]],[6,"l",1,[-0.0037,0.0225],-0.065,0.6931,[0.4889,0.4892,0.5006]],[7,"l",1,[-0.0037,0.0225],-0.065,0.6839,[0.4889,0.4892,0.5006]],[8,"l",1,[-0.0037,0.0225],-0.065,0.6839,[0.4889,0.4892,0.5006]],[9,"l",1,[-0.0055,0.0473],-0.065,0.6839,[0.4889,0.4892,0.5006]],[3,"l",1,[-0.0055,0.0473],-0.1252,0.6839,[0.4889,0.4892,0.5006]],[4,"l",2,[-0.0055,0.0473],-0.1252,0.6839,[0.4889,0.4892,0.5006]],[5,"l",2,[-0.0055,0.0473],-0.1252,0.6839,[0.4889,0.4892,0.5006]],[6,"l",2,[-0.0055,0.0473],-0.1252,0.6839,[0.4799,0.4802,0.5041]],[7,"l",2,[-0.0055,0.0473],-0.1252,0.6757,[0.4799,0.4802,0.5041]],[8,"l",2,[-0.0055,0.0473],-0.1252,0.6757,[0.4799,0.4802,0.5041]],[9,"l",2,[-0.0058,0.0727],-0.1252,0.6757,[0.4799,0.4802,0.5041]],[3,"l",2,[-0.0058,0.0727],-0.1817,0.6757,[0.4799,0.4802,0.5041]],[10,"l",2,[-0.0058,0.0727],-0.1817,0.6757,[0.4799,0.4802,0.5041]],[10,"r",2,[-0.0058,0.0727],-0.1817,0.6757,[0.4799,0.4802,0.5041]]];
  // train.out.txt, FULL: [epochs, w, b, loss after]
  const FULL = [[1,[-0.0037,0.0225],-0.065,0.6839],[10,[0.0203,0.2287],-0.5069,0.6313],[100,[1.2787,0.6544],-1.8404,0.5374],[1000,[6.3758,0.9303],-4.4648,0.4407],[5000,[7.8746,1.0455],-5.3106,0.4368],[20000,[7.8865,1.0465],-5.3174,0.4368]];
  // train.out.txt, SKLEARN
  const SK_DEFAULT = { coef: [3.6989, 0.7937], intercept: -3.1174, nIter: 9 };
  const SK_NOPEN = { coef: [7.8884, 1.0465], intercept: -5.3182, nIter: 11 };
  const SK_PROBA = { row: 73, proba: [0.2663, 0.7337], classes: "[0.0, 1.0]" };
  // curve.out.txt (seed 1): [open cards, missed, of]
  const CARDS = [[0,17,25],[1,20,31],[2,8,24],[3,6,32],[4,2,34],[5,2,35],[6,3,30],[7,4,25],[8,4,25],[9,5,37],[10,14,38],[11,19,35],[12,25,29]];
  const CURVE = { test: 100, always: 0.7, logistic: 0.73, cardsCoef: 0.0193, svm: 0.71, squared: 0.86 };

  // The listing is train() from docs/ai-path/runs/s2-logistic-regression/train.py, line for line (line 0 = def).
  const CODE = [
    "def train(features, missed, lr, epochs):",
    "    w = np.zeros(features.shape[1])",
    "    b = 0.0",
    "    for epoch in range(epochs):",
    "        z = features @ w + b",
    "        p = 1 / (1 + np.exp(-z))",
    "        loss = -np.mean(missed * np.log(p) + (1 - missed) * np.log(1 - p))",
    "        grad = p - missed",
    "        w = w - lr * features.T @ grad / len(missed)",
    "        b = b - lr * grad.mean()",
    "    return w, b"
  ];

  /* ---------- Derived from the data ---------- */
  const score = a => W[0] * a.debt + W[1] * a.late + B;
  const lineScore = a => LINE[0] * a.debt + LINE[1] * a.late + LINE[2];
  const lossOf = (pMiss, missed) => -Math.log(missed ? pMiss : 1 - pMiss);
  const boundaryDebt = late => (-B - W[1] * late) / W[0]; // where score = 0, i.e. p = 0.5

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-tbl { width: 100%; margin: 18px 0 0; border-collapse: collapse; font-size: 15px; }
      .lx-${ID}-tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .lx-${ID}-tbl th { text-align: left; font: 600 12.5px/1.3 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; padding: 6px 6px 6px 0; border-bottom: 1px solid var(--line); vertical-align: bottom; }
      .lx-${ID}-tbl td { padding: 8px 6px 8px 0; border-bottom: 1px solid var(--line); font: 500 14.5px/1.4 var(--mono); color: var(--ink); vertical-align: top; }
      .lx-${ID}-tbl tr.lx-${ID}-now td { font-weight: 700; }
      .lx-${ID}-row { border-top: 1px solid var(--line); padding: 14px 0; }
      .lx-${ID}-row:first-of-type { margin-top: 18px; }
      .lx-${ID}-row p { margin: 0 0 4px; font: 500 15px/1.5 var(--mono); }
      .lx-${ID}-svg { display: block; width: 100%; max-width: 460px; margin: 16px 0 0; }
      .lx-${ID}-svg .ax { stroke: var(--line); stroke-width: 1; }
      .lx-${ID}-svg .cv { stroke: var(--ink); stroke-width: 2; fill: none; }
      .lx-${ID}-svg .pt { fill: var(--surface); stroke: var(--ink); stroke-width: 2; }
      .lx-${ID}-svg .pt.m { fill: var(--ink); }
      .lx-${ID}-svg text { fill: var(--muted); font: 500 11px var(--mono); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--r); font: 500 13.5px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); background: var(--sunk); }
    `;
    document.head.appendChild(s);
  }
  // A plain multi-column table. head: [labels], rows: [[cells as HTML]], now: index of a row to set in bold.
  const tbl = (head, rows, { title = "", now = -1 } = {}) =>
    `<table class="lx-${ID}-tbl">${title ? `<caption>${title}</caption>` : ""}<thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === now ? ` class="lx-${ID}-now"` : ""}>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const out = (kit, s) => `<div class="lx-${ID}-out">${kit.esc(s)}</div>`;
  // The sigmoid curve from z = -6 to 6, with points at the given scores (filled = missed).
  function curve(points) {
    const X = z => 30 + (z + 6) / 12 * 280, Y = p => 140 - p * 120;
    let d = "";
    for (let z = -6; z <= 6.001; z += 0.25) d += `${d ? "L" : "M"}${f(X(z), 1)} ${f(Y(sig(z)), 1)}`;
    return `<svg class="lx-${ID}-svg" viewBox="0 0 320 162" role="img" aria-label="The sigmoid curve: probability against score">
      <line class="ax" x1="30" y1="140" x2="310" y2="140"/><line class="ax" x1="30" y1="20" x2="310" y2="20"/><line class="ax" x1="${X(0)}" y1="14" x2="${X(0)}" y2="146"/>
      <text x="2" y="24">p=1</text><text x="2" y="144">p=0</text><text x="${X(0) - 8}" y="158">z=0</text><text x="${X(-6) - 4}" y="158">-6</text><text x="${X(6) - 8}" y="158">6</text>
      <path class="cv" d="${d}"/>
      ${points.map(([z, m]) => `<circle class="pt${m ? " m" : ""}" cx="${f(X(z), 1)}" cy="${f(Y(sig(z)), 1)}" r="5"/>`).join("")}
    </svg>`;
  }
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const appTxt = a => `debt share ${f(a.debt, 2)}, ${plural(a.late, "late payment")}`;

  /* 1. The situation: a straight line fitted to 0/1 gives numbers that are not chances. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const hi = lineScore(LINE_HI), lo = lineScore(LINE_LO);
    const opts = [
      `A ${f(hi * 100, 0)}% chance he misses a repayment`,
      "He will certainly miss, so refuse him",
      "Nothing you can read as a chance: a straight line does not stop at 0 or 1",
      "The fit failed; fit the line again"
    ];
    const fb = [
      [`No chance can be above 100%. And the same line gave application #${LINE_LO.row} ${f(lo, 2)}: a chance below zero means nothing either.`, false],
      [`The line says nothing about certainty. It only grows by a fixed amount for each extra late payment and each bit of debt, so it keeps growing past 1 for anyone with enough of both.`, false],
      [`Right. A straight line keeps going as the inputs grow. On these ${N_APPS} applications it went below 0 for ${LINE_BELOW0} and above 1 for ${LINE_ABOVE1}. The lender needs a number between 0 and 1 that reads as “the chance this person misses”. Next you squash the score into that range.`, true],
      [`The fit is fine: it is the best straight line through the 0s and 1s. The trouble is the shape: no straight line stays between 0 and 1 for every input.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A score is not a chance</h1>
        <p class="lead">A small lender has ${N_APPS} past loan applications. For each one it knows two inputs: the <b>debt share</b> (how much of the monthly income already goes to other debts) and the number of <b>late payments</b> on other loans last year. It also knows whether the person later <b>missed</b> a repayment (1) or not (0).</p>
        <p class="lead">Many product questions are yes or no like this one. This lesson builds the first model that answers them with a chance.</p>
        <p class="lead">An analyst fitted a straight line to the 0s and 1s, the way you fitted costs in the last lesson. The line's weights: ${f(LINE[0], 4)} per unit of debt share, ${f(LINE[1], 4)} per late payment, and ${f(LINE[2], 4)} added to every application (the bias).</p>
        ${tbl(["application", "inputs", "line gives"], [[`#${LINE_HI.row}`, appTxt(LINE_HI), f(hi, 2)], [`#${LINE_LO.row}`, appTxt(LINE_LO), f(lo, 2)]])}
        <p class="task">The loan officer asks what ${f(hi, 2)} means for application #${LINE_HI.row}. What do you tell her?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 2. By hand: squash five scores with the sigmoid. */
  function squash({ el, done, kit }) {
    ensureStyle();
    const rows = FIVE.map(a => {
      const z = score(a), e = Math.exp(-z), p = 1 / (1 + e), eTxt = f(e, e < 10 ? 3 : 2);
      const right = f(p, 3), flip = f(1 - p, 3), cut = f(Math.min(1, Math.max(0, z)), 3);
      // fixed, varied order of the three answers
      const order = [[0, 1, 2], [1, 0, 2], [2, 0, 1], [0, 2, 1], [1, 2, 0]][FIVE.indexOf(a)];
      const vals = [right, flip, cut];
      return { a, z, e, eTxt, p, opts: order.map(k => vals[k]), kind: order, correct: order.indexOf(0) };
    });
    const ans = rows.map(() => null);
    const fbFor = (r, k) => k === 0
      ? [`Right: 1 / (1 + ${r.eTxt}) = ${f(r.p, 3)}.`, true]
      : k === 1
        ? [`That is 1 − p, the chance he repays. ${r.z < 0 ? "A score below 0 must give less than 0.5." : "A score above 0 must give more than 0.5."} Divide 1 by (1 + e<sup>−z</sup>).`, false]
        : [`That is the score cut off at 0 and 1, which is what the straight line would need. The formula never reaches 0 or 1: e<sup>−z</sup> is always above 0.`, false];
    const paint = () => {
      const all = rows.every((r, i) => ans[i] === r.correct);
      el.innerHTML = `<h1>Squash the score</h1>
        <p class="lead">Keep the line's output: each input times its weight, plus the bias. Call it the <b>score</b> z. Then pass it through p = 1 / (1 + e<sup>−z</sup>). A big score makes e<sup>−z</sup> tiny, so p is near 1. A very negative score makes e<sup>−z</sup> huge, so p is near 0. A score of 0 gives exactly 0.5. The lender trained this model on its ${N_APPS} applications (you will see how later). Here are five of them, with their scores and e<sup>−z</sup> worked out.</p>
        <p class="task">Fill in p, the chance of a missed repayment, for each application.</p>
        ${rows.map((r, i) => `<div class="lx-${ID}-row" id="r${i}"><p>#${r.a.row}: score z = ${f(r.z, 2)}, e<sup>−z</sup> = ${r.eTxt}</p>${kit.options(r.opts, { picked: ans[i], correct: r.correct, num: true })}${ans[i] == null ? "" : kit.feedback(...fbFor(r, r.kind[ans[i]]))}</div>`).join("")}
        ${all ? `${curve(rows.map(r => [r.z, r.a.missed]))}<p class="lx-${ID}-cap">The five applications on the curve. Filled: the person missed a repayment. Outlined: repaid.</p>
          ${kit.feedback(`This S-shaped squash is the <b>sigmoid</b> (also called the logistic function, which gives the model its name). Score plus sigmoid is <b>logistic regression</b>: a straight-line score, read as a probability. The model said ${f(rows[2].p, 3)} for #${rows[2].a.row}: a coin toss. He repaid. #${rows[4].a.row} got ${f(rows[4].p, 3)} and missed.`, true)}` : ""}`;
      el.querySelectorAll(".lx-" + ID + "-row").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (rows.every((r, j) => ans[j] === r.correct)) done();
      }));
    };
    paint();
  }

  /* 3. By hand: the log loss of a confident mistake and of a cautious answer. */
  function lossByHand({ el, done, kit }) {
    ensureStyle();
    const cases = [SURE_WRONG, UNSURE].map(a => {
      const p = sig(score(a)), q = a.missed ? p : 1 - p, other = 1 - q;
      const opts = [`−ln(${f(other, 3)}) = ${f(-Math.log(other), 2)}`, `−ln(${f(q, 3)}) = ${f(-Math.log(q), 2)}`, `(1 − ${f(q, 3)})² = ${f((1 - q) ** 2, 2)}`];
      return { a, p, q, loss: -Math.log(q), opts, correct: 1 };
    });
    const ans = cases.map(() => null);
    const fb = (c, k) => [
      [`${f(1 - c.q, 3)} is the chance the model gave to what did <b>not</b> happen. Log loss looks only at the chance it gave to what really happened: ${c.a.missed ? "he missed" : "he repaid"}.`, false],
      [`Right. He ${c.a.missed ? "missed" : "repaid"}, and the model had given that ${f(c.q, 3)}. Loss ${f(c.loss, 2)}.`, true],
      ["That is the squared error, the loss linear regression uses. Here the loss is the minus log of the chance given to what happened.", false]
    ][k];
    const paint = () => {
      const all = cases.every((c, i) => ans[i] === c.correct);
      const ratio = cases[0].loss / cases[1].loss;
      el.innerHTML = `<h1>What a wrong probability costs</h1>
        <p class="lead">To train the model you need one number that says how bad a probability was. Logistic regression uses <b>log loss</b>: take the chance the model gave to what really happened, and charge −ln of it (minus the natural log). A chance of 1 costs 0. The smaller the chance, the bigger the charge.</p>
        <p class="task">For each application, pick the loss the model pays.</p>
        ${cases.map((c, i) => `<div class="lx-${ID}-row" id="r${i}"><p>#${c.a.row} (${appTxt(c.a)}): the model said p(miss) = ${f(c.p, 3)}. He ${c.a.missed ? "missed a repayment" : "repaid"}.</p>${kit.options(c.opts, { picked: ans[i], correct: c.correct })}${ans[i] == null ? "" : kit.feedback(...fb(c, ans[i]))}</div>`).join("")}
        ${all ? kit.feedback(`#${cases[0].a.row} was a <b>confident mistake</b>: the model was almost sure he would repay, and he missed. It costs ${f(cases[0].loss, 2)}, about ${Math.round(ratio)} times more than the cautious coin toss on #${cases[1].a.row} (${f(cases[1].loss, 2)}), where the model said “could go either way” and he repaid. Being unsure costs a little; being sure and wrong costs a lot.`, true) : ""}`;
      el.querySelectorAll(".lx-" + ID + "-row").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (cases.every((x, j) => ans[j] === x.correct)) done();
      }));
    };
    paint();
  }

  /* 4. Spot the idea: log loss has no ceiling. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const PS = [0.9, 0.5, 0.1, 0.01, 0.001]; // the same values train.py printed in its LOSS section
    const rows = PS.map(p => [String(p), f(-Math.log(p), 2), f((1 - p) ** 2, 3)]);
    const opts = [
      "Log loss only counts the applications the model got wrong",
      "Log loss has no ceiling: as the chance given to what happened falls toward 0, the charge keeps growing, so one confident mistake can outweigh many cautious answers",
      "Squared error would push it away even harder",
      "The sigmoid cannot output a number as small as 0.001"
    ];
    const fb = [
      [`It counts every application. A right answer at 0.9 still costs ${f(-Math.log(0.9), 2)}; only a chance of exactly 1 costs nothing.`, false],
      [`Right. Going from 0.01 to 0.001 adds ${f(-Math.log(0.001) + Math.log(0.01), 2)} to the log loss, while squared error barely moves (${f((1 - 0.01) ** 2, 3)} to ${f((1 - 0.001) ** 2, 3)}): it can never pass 1. Training lowers the average log loss over all ${N_APPS} applications, so for a kind of applicant who sometimes misses, saying “almost surely fine” is expensive. The model learns to stay cautious where the data is mixed. Log loss, also called cross-entropy, is also the usual loss for neural networks that answer yes or no.`, true],
      [`Look at the last column: squared error stops near 1. From 0.01 to 0.001 it moves from ${f((1 - 0.01) ** 2, 3)} to ${f((1 - 0.001) ** 2, 3)}, almost nothing. It gives the model little reason to stop being overconfident.`, false],
      ["It can: a score of about −7 gives 0.001. The sigmoid gets as close to 0 as you like without reaching it. The question is what stops training from going there.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why confident mistakes cost the most</h1>
        <p class="lead">Take an applicant who missed. Here is what each loss charges as the model's chance for “misses” gets smaller.</p>
        ${tbl(["p(miss)", "log loss", "squared error"], rows, { title: "He missed a repayment" })}
        <p class="task">Training changes the weights to make the average loss over all applications smaller. Why does log loss keep the model from saying 0.001 for people it is not sure about?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. From a probability to a decision: the threshold, and the straight boundary it draws. */
  function threshold({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const a5 = AT[0.5], a3 = AT[0.3];
    const good5 = a5.flagged - a5.caught, good3 = a3.flagged - a3.caught;
    const lines = [0, 1, 2, 3, 4].map(l => [String(l), f(boundaryDebt(l), 2)]);
    const opts = [
      "The model's weights change, so all the probabilities move",
      "More people who would miss get caught, and more people who would repay get refused",
      "Accuracy goes up, because the lender is more careful",
      "Nothing changes: the probabilities are the same"
    ];
    const fb = [
      ["The threshold is applied after training, to the probabilities the model already gives. The weights stay as they are.", false],
      [`Right. On the ${N_APPS} applications the model trained on: at 0.5 it refuses ${a5.flagged} and catches ${a5.caught} of the ${N_MISSED} who missed, refusing ${good5} who repaid. At 0.3 it refuses ${a3.flagged}, catches ${a3.caught}, and refuses ${good3} who repaid. Accuracy fell from ${a5.acc} to ${a3.acc}, and that can still be the right call if a missed repayment costs the lender more than a lost customer. Where to cut is a business decision made from the probabilities, not something the model learns.`, true],
      [`Accuracy fell, from ${a5.acc} to ${a3.acc}: the lender now refuses ${good3 - good5} more people who would have repaid. A lower threshold trades one kind of mistake for the other.`, false],
      [`The probabilities are the same, but the decisions are not: everyone between 0.3 and 0.5 now gets refused. At 0.5 the lender refuses ${a5.flagged} applications; at 0.3 it refuses ${a3.flagged}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>From a chance to a decision</h1>
        <p class="lead">The model gives a probability; the lender must still say yes or no. The usual rule: refuse when p is 0.5 or more. Since p = 0.5 exactly where the score is 0, that is the same as refusing when ${f(W[0], 2)} × debt share + ${f(W[1], 2)} × late payments − ${f(-B, 2)} is 0 or more. Solve it for each number of late payments:</p>
        ${tbl(["late payments", "refuse above this debt share"], lines)}
        <p class="lead">Each extra late payment lowers the limit by the same step, ${f(W[1] / W[0], 2)}. On a chart of debt share against late payments those limits sit on one straight line: the <b>decision boundary</b>.</p>
        <p class="task">Missed repayments hurt the lender, so the risk team lowers the threshold from 0.5 to 0.3. What happens?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 6. From scratch in NumPy: predict the first pass, then step through the traced run. */
  const SHOW = new Set([2, 5, 6, 8, 9]); // frames after these lines ran
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TR.length; k++) {
      const ran = TR[k - 1], v = TR[k];
      if (v[1] === "r") { fr.push({ ln: 10, v, end: true }); continue; }
      if (SHOW.has(ran[0])) fr.push({ ln: ran[0], v });
    }
    return fr;
  })();
  const say = fr => {
    const [, , ep, w, b, loss, p] = fr.v;
    if (fr.end) return `<code>train</code> returns after ${ep + 1} passes. The loss went ${FR.filter(x => x.ln === 6).map(x => f(x.v[5], 4)).join(", ")}: small steps down. Real training runs many more passes; see below.`;
    if (fr.ln === 2) return "The weights and the bias start at 0, so every score is 0.";
    if (fr.ln === 5) return `Pass ${ep + 1}: the <code>p =</code> line squashed every score. The first three applications now have p = ${p.map(x => f(x, 4)).join(", ")}.`;
    if (fr.ln === 6) return `The <code>loss =</code> line: the average log loss over all ${N_APPS} applications is ${f(loss, 4)}.`;
    if (fr.ln === 8) return `<code>grad</code> now holds each application's error, p − missed. The <code>w =</code> line moved the weights against it: w = [${w.map(x => f(x, 4)).join(", ")}].`;
    if (fr.ln === 9) return `The <code>b =</code> line moved the bias the same way: b = ${f(b, 4)}. Back to the top for the next pass.`;
    return "";
  };
  function fromScratch({ el, done, kit }) {
    ensureStyle();
    let ans = null, i = 0;
    const share = N_MISSED / N_APPS;
    const opts = ["0.5 for everyone", `${f(share, 2)} for everyone: the share who missed`, "0 for everyone"];
    const fb = [
      null,
      [`That would be a good guess, and training moves toward it, but the first pass knows nothing yet. Every score is 0, and the sigmoid of 0 is 0.5.`, false],
      ["A score of 0 is not a probability of 0. The sigmoid of 0 is exactly 0.5, the middle of the curve.", false]
    ];
    const paint = () => {
      const fr = FR[i];
      const v = fr.v;
      el.innerHTML = `<h1>Train it in NumPy</h1>
        <p class="lead">This is the whole model, from scratch. <code>features</code> is the table of inputs, one row per application; <code>missed</code> is the column of 0s and 1s. One pass over all applications is an <b>epoch</b>. The <code>z =</code> line is the score and the <code>p =</code> line is the sigmoid. The <code>loss =</code> line is the average log loss. The last three lines in the loop are gradient descent: the error p − missed tells each weight which way to move. (With the sigmoid and log loss together, the slope of the loss works out to exactly this simple error; that is one reason the two are used as a pair.) The run below is the real one, traced for 3 passes with the learning rate (step size) <code>lr = 0.5</code>.</p>
        ${kit.code(CODE, ans === 0 ? fr.ln : -1)}
        ${ans !== 0 ? `<p class="task">Before stepping: on the first pass, w is [0, 0] and b is 0. What p does the <code>p =</code> line give each applicant?</p>
          <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}${ans == null ? "" : kit.feedback(...fb[ans])}</div>`
        : `<p class="task">Step through to the end. Watch the loss.</p>
          <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
          <div class="vars"><span>epoch <b>${v[2] == null ? "–" : v[2]}</b></span><span>w <b>${v[3] ? `[${v[3].map(x => f(x, 4)).join(", ")}]` : "–"}</b></span><span>b <b>${v[4] == null ? "–" : f(v[4], 4)}</b></span><span>loss <b>${v[5] == null ? "–" : f(v[5], 4)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
          ${kit.feedback(say(fr))}
          ${i === FR.length - 1 ? `${tbl(["passes", "w", "b", "loss after"], FULL.map(([n, w, b, l]) => [n.toLocaleString("en"), `[${w.map(x => f(x, 4)).join(", ")}]`, f(b, 4), f(l, 4)]), { title: "The same function, run longer (train.out.txt)", now: FULL.length - 1 })}
            <p class="lead">The loss fell from ${f(LOSS_START, 4)} (that is ln 2, a coin toss for everyone) to ${f(LOSS_END, 4)} and then stopped moving. These final weights are the ones you used on the earlier screens.</p>` : ""}`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); });
      const pv = el.querySelector("[data-prev]"), nx = el.querySelector("[data-next]");
      if (pv) pv.onclick = () => { i--; paint(); };
      if (nx) nx.onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. The same model in scikit-learn: why the default weights are smaller. */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const listing = [
      "from sklearn.linear_model import LogisticRegression",
      "model = LogisticRegression().fit(features, missed)",
      "model.coef_, model.intercept_"
    ];
    const opts = [
      "Your NumPy loop had not finished training",
      "scikit-learn shrinks the weights on purpose: it adds a penalty for large weights by default",
      "scikit-learn uses a different loss",
      "The two runs saw the applications in a different order"
    ];
    const fb = [
      [`The loss stopped moving: ${f(FULL[4][3], 4)} after 5,000 passes and ${f(FULL[5][3], 4)} after 20,000, and the weights barely moved. Training was done.`, false],
      null,
      ["It is the same log loss; scikit-learn's guide writes the same formula you used. Something is added to it, though.", false],
      ["Both use all the applications at once in every step, so their order does not matter here.", false]
    ];
    const right = `Right. scikit-learn's guide says it plainly: regularization (a penalty that keeps weights small) is applied by default. Its loss is the log loss <b>plus</b> a penalty on the size of the weights, and <code>C</code> (default 1.0) sets how little the penalty counts: a smaller C means a stronger pull toward 0. Turn the penalty off with <code>C=np.inf</code> and you get your own weights back:
      ${out(kit, `C=inf:   coef [${SK_NOPEN.coef.join(", ")}] intercept ${SK_NOPEN.intercept} n_iter ${SK_NOPEN.nIter}\nours:    w [${W.join(", ")}] b ${B}`)}
      <p class="lx-${ID}-cap">Output of train.py, run 2026-11-13 with scikit-learn 1.9.1.</p>
      Three things worth knowing. <code>predict_proba</code> gives one column per class, in the order of <code>classes_</code>: for #${SK_PROBA.row} it gave [${SK_PROBA.proba.join(", ")}] with classes ${SK_PROBA.classes}, so the second column is p(miss); your weights give ${f(sig(score(FIVE[3])), 4)}. <code>predict</code> cuts at 0.5; for any other threshold, cut <code>predict_proba</code> yourself. <code>class_weight="balanced"</code> makes the rarer class count more in the loss, when misses are few. The solver (the library's training method) took ${SK_NOPEN.nIter} steps (<code>n_iter</code>) where your loop took thousands: it takes smarter steps than plain gradient descent. (Since scikit-learn 1.8 the old <code>penalty</code> argument is deprecated in favour of <code>C</code>; checked 2026-11-13.)`;
    const paint = () => {
      el.innerHTML = `<h1>The same model in scikit-learn</h1>
        <p class="lead">In practice you do not write the loop. The library call on the same ${N_APPS} applications, and what it printed next to your NumPy weights:</p>
        ${kit.code(listing, -1)}
        ${out(kit, `default: coef [${SK_DEFAULT.coef.join(", ")}] intercept ${SK_DEFAULT.intercept} n_iter ${SK_DEFAULT.nIter}\nours:    w [${W.join(", ")}] b ${B}`)}
        <p class="lx-${ID}-cap">Output of train.py, run 2026-11-13 with scikit-learn 1.9.1.</p>
        <p class="task">The library's weights are smaller than yours. Why?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(...(ans === 1 ? [right, true] : fb[ans]))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. When a straight boundary falls short: risk at both ends of one input. */
  function fallsShort({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const rows = CARDS.map(([c, m, n]) => [String(c), `${m} of ${n}`, `${Math.round(m / n * 100)}%`]);
    const total = CARDS.reduce((s, r) => s + r[2], 0), missed = CARDS.reduce((s, r) => s + r[1], 0);
    const opts = [
      "Clearly better: it has both inputs to work with",
      "Barely better than always saying “repays”",
      "Much better if you switch to a support vector machine, which finds the widest gap between the classes"
    ];
    const sum = `Scored on ${CURVE.test} applications it did not train on: always saying “repays” is right ${Math.round(CURVE.always * 100)}% of the time; logistic regression on the two inputs ${Math.round(CURVE.logistic * 100)}%; a linear SVM ${Math.round(CURVE.svm * 100)}%. The weight logistic regression gave to open cards was ${CURVE.cardsCoef}: almost nothing, because a straight boundary can only put risk at <b>one</b> end of the card count. Add one more input, open cards squared, and the same logistic regression scores ${Math.round(CURVE.squared * 100)}%: the line in the new inputs is a curve in the old ones.`;
    const fb = [
      [`It barely beat the plain guess. ${sum}`, false],
      [`Right. ${sum} A linear SVM fails for the same reason: it picks the straight boundary with the widest margin to the nearest points of each side, but a straight boundary is still the wrong shape. It also gives no probability, only a side and a distance from the line (scikit-learn's <code>LinearSVC</code> has no <code>predict_proba</code>; an SVM's probabilities need an extra, costly step, cross-validation, which trains it again on slices of the data, and they can disagree with its own predictions). A kernel SVM, a variant, can bend its boundary.`, true],
      [`A linear SVM draws a straight boundary too, just placed with the widest margin. ${sum} And it gives no probability for the lender's threshold.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When a straight boundary falls short</h1>
        <p class="lead">Another lender's book: ${total} applications, ${missed} missed. One input is the number of credit cards the person has open. People with almost no cards have no credit history; people with very many are often juggling debt.</p>
        ${tbl(["open cards", "missed", "rate"], rows)}
        <p class="task">You train logistic regression on open cards and debt share. Compared with always saying “repays”, how does it do on new applications?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Training time: the model must be rebuilt from scratch every month",
      "The probabilities: they were learned from past applicants, and now they say too little risk",
      "The boundary: it stops being a straight line"
    ];
    const fb = [
      [`Training is the cheap part: your NumPy loop runs in moments on ${N_APPS} rows, and the library is faster still. What goes wrong is quieter.`, false],
      ["Right. A probability is only as good as the past it was learned from. When the world changes, a model that said 0.2 for a kind of applicant keeps saying 0.2 while more of them miss. Nothing crashes; the decisions just get worse. Check its probabilities against what really happens, and retrain on recent data.", true],
      ["The boundary is always straight in the inputs you give it; that does not change. What changed is how often people with those inputs miss.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for logistic regression</h1>
        <p class="lead"><b>For:</b> yes/no questions on table-shaped data where you need a chance, not just a label, so that someone can pick a threshold.</p>
        <p class="lead"><b>Reach for it</b> as the first model. It trains in seconds, and each weight shows how an input pushes. When a straight boundary fits, its probabilities are more likely than most models' to match real rates without extra fixing.</p>
        <p class="lead"><b>Not</b> when risk sits at both ends of an input or depends on two inputs together (add such inputs by hand, or use a model that bends), and not for raw images, sound or text (neural networks).</p>
        <p class="lead"><b>Costs:</b> very little compute; the effort goes into choosing inputs; and it must be watched, because its probabilities come from the past.</p>
        <p class="task">The lender's model has worked for a year. Then the economy turns and far more people miss repayments. What goes wrong first?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A dental clinic wants the chance that each patient skips tomorrow's appointment, from days since booking and past no-shows, so staff can phone the riskiest ten.", true,
      "Yes. A yes/no outcome, a few table inputs, and the staff need a chance to rank patients and pick a cut. Both inputs plausibly push one way.",
      "This is the lender's problem in other clothes: a yes/no outcome, and the staff want a ranking by chance, which is what the sigmoid gives."],
    ["A courier firm wants to predict how many minutes late each delivery will be.", false,
      "No. Minutes late is a number with no upper end, not a yes/no outcome. Squashing it into 0 to 1 makes no sense. That is linear regression, from the last lesson.",
      "The answer is a number of minutes, not a chance. The sigmoid would force every prediction between 0 and 1 minute. Use linear regression."],
    ["A fish shop wants to flag aquarium tanks at risk of losing fish, from the water's pH. Losses are common when the water is too acidic and when it is too alkaline.", false,
      "No, not as it stands. Risk sits at both ends of one input, like the open cards. A straight boundary in pH can only put risk on one side. Add pH squared as an input, or use a model that bends.",
      "A straight boundary in pH puts all the risk on one side: acidic or alkaline, not both. That is the open-cards trap. Add a squared input or pick a model whose boundary can bend."],
    ["An online shop flags orders likely to be sent back, from how many sizes of the same item are in the order and how many past orders the customer returned, and must show the finance team which inputs pushed each flag.", true,
      "Yes. Yes/no outcome, risk grows with both inputs, and each weight says how much an input pushed the score, which is what the finance team asks for.",
      "Both inputs push return risk one way, and the finance team wants to see why each flag happened. Logistic regression's weights show exactly that."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Logistic regression or not?</h1>
        <p class="lead">Four requests from other teams. Logistic regression means: a weighted sum of the inputs, squashed into a chance, with a straight boundary at any threshold.</p>
        <p class="task">Would you start with logistic regression on these inputs? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>A probability you can act on</h1>
      <p class="lead">You squashed scores into chances with the sigmoid, saw that log loss charges most for confident mistakes, trained the model in ${CODE.length - 1} lines of NumPy, got the same weights from scikit-learn once its default penalty was off, and saw where a straight boundary falls short.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>train</code> yourself in NumPy for a small set of applications and check your weights against <code>LogisticRegression(C=np.inf)</code>.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Most numbers in this lesson were measured on the same applications the model learned from; next you learn which score you can actually trust.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Logistic regression: a probability instead of a number",
    checked: "2026-11-13",
    sources: [
      "https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression",
      "https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html",
      "https://scikit-learn.org/stable/modules/model_evaluation.html#log-loss",
      "https://scikit-learn.org/stable/modules/svm.html",
      "https://scikit-learn.org/stable/modules/calibration.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.svm.LinearSVC.html"
    ],
    interview: [
      {
        q: "The risk team says your logistic regression lets through too many people who later default. They want a new algorithm. What do you look at first?",
        good: [
          "Check the threshold: lowering it catches more defaulters at the price of refusing more good customers; pick it from what each mistake costs",
          "Look at whether the probabilities match reality on recent data; if the world changed, retrain",
          "Check whether risk is really one-directional in each input; if it sits at both ends or depends on two inputs together, add those inputs or use a model that bends",
          "If defaulters are rare, consider class weights",
          "Measure on applications the model did not train on"
        ],
        weak: "Switch to a bigger model right away. That skips the threshold, which is often the actual fix, and the check for a boundary of the wrong shape."
      },
      {
        q: "A colleague fitted logistic regression in scikit-learn and in a statistics package on the same data and got different weights. Which is wrong?",
        good: [
          "Probably neither: scikit-learn adds a penalty on large weights by default, controlled by C",
          "With the penalty switched off (C=np.inf) the weights should match closely",
          "The penalty is a choice: it trades a little fit for smaller, more stable weights",
          "Compare the log loss and predicted probabilities, not just the raw weights"
        ],
        weak: "Say one library has a bug, without knowing that scikit-learn regularizes by default."
      }
    ],
    screens: [situation, squash, lossByHand, spotIdea, threshold, fromScratch, library, fallsShort, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#r0 [data-wrong]"], right: FIVE.map((_, i) => `#r${i} [data-right]`) },
      { wrong: ["#r0 [data-wrong]"], right: ["#r0 [data-right]", "#r1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(FR.length - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
