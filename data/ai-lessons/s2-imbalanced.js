/* Lesson: imbalanced data. Story: a payments team hunts card fraud among thousands of ordinary transactions.
   Ideas: (1) when one class is rare, accuracy rewards a model that never finds it; judge with recall, precision
   and average precision against the "always the common class" baseline; (2) class weights, oversampling and a
   lower threshold all move the same trade (more fraud caught, more false alarms), and none adds information.
   Debug: oversampling before the train/test split puts copies of training fraud rows in the test set.
   Data, all real runs on this Mac (no model API calls):
   - docs/ai-path/runs/s2-imbalanced/fraud.py + fraud.out.txt: synthetic set (make_classification, seed 7,
     40,000 transactions, 0.5% fraud), always-"not fraud" baseline, plain / weighted / oversampled logistic
     regression, threshold sweep, split without stratify;
   - library.py + library.out.txt: the scikit-learn listing on the library screen, run as shown;
   - leak.py + leak.out.txt: the broken-on-purpose notebook (oversample, then split) and its fix.
   Lesson-local style: confusion-matrix box, listing output block and checklist (.lx-s2-imbalanced-*), see
   ensureStyle(). Plain browser script. */
(() => {
  const ID = "s2-imbalanced";
  const fmt = n => n.toLocaleString("en-US");
  const pct = (a, b, d = 1) => `${(100 * a / b).toFixed(d)}%`;

  /* ---------- Data copied from the runs ---------- */
  // fraud.out.txt
  const DATA = { n: 40000, fraud: 200 };
  const SPLIT = { train: 30000, train_fraud: 150, test: 10000, test_fraud: 50 };
  const NO_STRAT = [47, 50, 41, 47, 51, 51, 53, 48, 56, 60]; // test-set fraud count, seeds 0..9, no stratify
  const ALWAYS_NO = { tn: 9950, fp: 0, fn: 50, tp: 0, avg_precision: 0.005, roc_auc: 0.5 };
  const PLAIN = { tn: 9949, fp: 1, fn: 38, tp: 12, avg_precision: 0.5378, roc_auc: 0.8842, mean_score: 0.0049 };
  const BAL_W = [0.5025, 100.0];
  const WEIGHTED = { tn: 8618, fp: 1332, fn: 10, tp: 40, avg_precision: 0.2527, roc_auc: 0.9057, mean_score: 0.2236 };
  const OVER_TRAIN = { rows: 59700, fraud_rows: 29850, distinct_fraud_rows: 150 };
  const OVER = { tn: 8616, fp: 1334, fn: 9, tp: 41, avg_precision: 0.249, roc_auc: 0.9058, mean_score: 0.2235 };
  const RANDOM = { avg_precision: 0.0062, roc_auc: 0.5472 };
  const SWEEP = [[0.5, 13, 12], [0.2, 42, 25], [0.1, 81, 32], [0.05, 150, 35], [0.03, 253, 37], [0.02, 364, 38], [0.01, 676, 38]]; // threshold, flagged, caught
  // library.out.txt (the listing below, run as shown)
  const LIB_CODE = [
    "X_train, X_test, y_train, y_test = train_test_split(",
    "    transactions, is_fraud, test_size=0.25,",
    "    stratify=is_fraud, random_state=7)",
    "model = LogisticRegression(max_iter=1000,",
    "    class_weight=\"balanced\")",
    "model.fit(X_train, y_train)",
    "flagged = model.predict(X_test)",
    "fraud_score = model.predict_proba(X_test)[:, 1]",
    "print(\"fraud in test:\", y_test.sum(), \"flagged:\", flagged.sum())",
    "print(\"recall:\", round(recall_score(y_test, flagged), 3))",
    "print(\"precision:\", round(precision_score(y_test, flagged), 3))",
    "print(\"average precision:\", round(average_precision_score(y_test, fraud_score), 3))"
  ];
  const LIB_OUT = "fraud in test: 50 flagged: 1372\nrecall: 0.8\nprecision: 0.029\naverage precision: 0.253";
  // leak.py (lines of the broken notebook) and leak.out.txt
  const LEAK_CODE = [
    "X_bal, y_bal = oversample(transactions, is_fraud)",
    "X_train, X_test, y_train, y_test = train_test_split(X_bal, y_bal, test_size=0.25, random_state=SEED)",
    "tree = DecisionTreeClassifier(random_state=SEED).fit(X_train, y_train)",
    "score(\"broken_oversample_then_split\", tree, X_test, y_test, X_train)"
  ];
  const LEAK_OUT_TEXT = '{"broken_oversample_then_split": {"test_rows": 19900, "test_fraud": 9992, "test_fraud_also_in_train": 9992, "recall": 1.0, "precision": 0.9979}}';
  const FIXED_OUT_TEXT = '{"fixed_split_then_oversample": {"test_rows": 10000, "test_fraud": 50, "test_fraud_also_in_train": 0, "recall": 0.44, "precision": 0.4783}}';
  const LEAK_OUT = { test_rows: 19900, test_fraud: 9992, test_fraud_also_in_train: 9992, recall: 1.0, precision: 0.9979 };
  const FIXED_OUT = { test_rows: 10000, test_fraud: 50, test_fraud_also_in_train: 0, recall: 0.44, precision: 0.4783 };
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s2-imbalanced.ipynb";

  /* ---------- Derived ---------- */
  const N = SPLIT.test;
  const acc = m => (m.tn + m.tp) / (m.tn + m.fp + m.fn + m.tp);
  const flaggedOf = m => m.fp + m.tp;
  const recallOf = m => m.tp / (m.tp + m.fn);
  const precOf = m => m.tp / (m.tp + m.fp);
  const ORD = SPLIT.test - SPLIT.test_fraud;
  const BUDGET = 300;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-cm { display: grid; grid-template-columns: minmax(6.5em, auto) 1fr 1fr; margin: 16px 0 0; border-top: 1px solid var(--line); border-left: 1px solid var(--line); max-width: 460px; }
      .lx-${ID}-cm > div { padding: 8px 10px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); font-size: 14.5px; line-height: 1.35; min-width: 0; }
      .lx-${ID}-cm .h { color: var(--muted); font: 600 12.5px/1.35 var(--mono); text-transform: uppercase; letter-spacing: .03em; background: var(--sunk); }
      .lx-${ID}-cm .v { font: 600 18px/1.3 var(--mono); color: var(--ink); }
      .lx-${ID}-cm .v small { display: block; font: 400 12.5px/1.3 var(--font); color: var(--muted); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-out { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-check { list-style: none; padding: 0; margin: 12px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-check li { border-bottom: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 12px; align-items: flex-start; min-height: 44px; padding: 10px 0; font-size: 15.5px; line-height: 1.45; cursor: pointer; }
      .lx-${ID}-check label { align-items: center; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; border: 2px solid var(--ink-2); background: var(--surface); cursor: pointer; box-shadow: inset 0 0 0 12px var(--surface); }
      .lx-${ID}-check input:checked { background: var(--ink); }
      .lx-${ID}-check input:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
      .lx-${ID}-opt { text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  // confusion matrix: rows = truth, columns = what the model said
  function cm(kit, m, title) {
    const c = (v, t) => `<div class="v">${fmt(v)}<small>${kit.esc(t)}</small></div>`;
    return `${title ? `<p class="lx-${ID}-cap">${kit.esc(title)}</p>` : ""}<div class="lx-${ID}-cm" role="table">
      <div class="h">truth ↓ model →</div><div class="h">said fraud</div><div class="h">said not fraud</div>
      <div class="h">fraud</div>${c(m.tp, "caught")}${c(m.fn, "missed")}
      <div class="h">ordinary</div>${c(m.fp, "false alarm")}${c(m.tn, "correctly let through")}</div>`;
  }
  const out = (kit, s) => `<div class="lx-${ID}-out">${kit.esc(s)}</div>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const wire = (el, fn) => el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => fn(+b.dataset.i));

  /* 1. The situation, scored by hand: the model that always says "not fraud". */
  function scoreByHand({ el, done, kit }) {
    ensureStyle();
    let part = 0, ans = null;
    const accRight = pct(ALWAYS_NO.tn, N);
    const Q = [
      { right: 2, opts: [pct(SPLIT.test_fraud, N), "50.0%", accRight, pct(N - 2 * SPLIT.test_fraud, N)],
        fb: [
          [`${pct(SPLIT.test_fraud, N)} is the share of fraud in the week. Accuracy counts every transaction the model got right, and it gets every ordinary one right.`, false],
          ["50% would be a coin toss. This model is not guessing: it gives the same answer every time, and that answer is right for almost every row.", false],
          null,
          ["That would be the case if it also made mistakes on ordinary transactions. It never says “fraud”, so it never raises a false alarm.", false]] },
      { right: 0, opts: ["0", String(SPLIT.test_fraud), String(SPLIT.test_fraud / 2)],
        fb: [null,
          [`It never says “fraud”, so it cannot catch any. All ${SPLIT.test_fraud} fraud transactions go through.`, false],
          ["There is no luck involved: a model that always answers “not fraud” flags nothing, so it catches nothing.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(part, 1)];
      el.innerHTML = `<h1>A fraud model that looks excellent</h1>
        <p class="lead">A payments team checks card transactions for fraud. Their test week has <b>${fmt(N)}</b> transactions, and <b>${SPLIT.test_fraud}</b> of them are fraud. A new hire hands in a model and says its accuracy is excellent. You look inside: whatever the transaction, it answers <b>not fraud</b>.</p>
        <p class="lead">Many AI products hunt for something rare like this. This lesson shows how to judge such a model and how to make it find more.</p>
        <p class="task">${part === 0 ? "Score it yourself. Accuracy is the share of transactions it labels correctly. What is its accuracy?" : part === 1 ? "How many of the fraud transactions does it catch?" : "Scored."}</p>
        ${part >= 1 ? kit.feedback(`Accuracy ${accRight}: it labels all ${fmt(ORD)} ordinary transactions correctly and gets only the ${SPLIT.test_fraud} fraud ones wrong.`, true) : ""}
        <div class="lpanel">${part < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`It catches 0 of ${SPLIT.test_fraud}. A model that looks ${accRight} accurate stops no fraud at all, and the team would only find out from customers' complaints.`, true)}</div>`;
      wire(el, i => { ans = i; if (i === Q[part].right) { part++; ans = null; paint(); if (part === 2) done(); return; } paint(); });
    };
    paint();
  }

  /* 2. Spot the idea: why accuracy looks great. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The test week is too small to measure the model well",
      `Accuracy counts every transaction the same, and ${pct(ORD, N)} of them are ordinary, so “never fraud” is right almost every time`,
      "The model learned what fraud looks like, but its threshold is set too high",
      "Rows from training leaked into the test week"
    ];
    const fb = [
      [`${fmt(N)} transactions is plenty of rows. The problem is not how many there are but how they split: only ${SPLIT.test_fraud} are fraud.`, false],
      [`Right. When one class is rare, accuracy is mostly a measure of the common class. Data like this is called <b>imbalanced</b>. The first number to write down is the <b>baseline</b>: the accuracy of always answering the common class, here ${pct(ORD, N)}. A model is only interesting if it beats that, and accuracy is the wrong yardstick to see by how much. The matrix above is the honest picture: everything sits in the “said not fraud” column.`, true],
      ["This model never looked at the transactions at all. It always gives the label that was most common in training. There is no threshold and nothing learned.", false],
      ["Nothing leaked: the model ignores every column of every row. Its score comes only from how common “not fraud” is.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why does doing nothing score so well?</h1>
        <p class="lead">The same model, as a confusion matrix: each cell counts the transactions with that truth and that answer.</p>
        ${cm(kit, ALWAYS_NO, "Always “not fraud”, test week")}
        <p class="task">What makes its accuracy look great?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 1) done(); });
    };
    paint();
  }

  /* 3. A real model: accuracy barely beats the baseline; recall tells the truth. */
  function realModel({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const r = recallOf(PLAIN);
    const opts = [String(+(PLAIN.tp / flaggedOf(PLAIN)).toFixed(2)), String(+r.toFixed(2)), String(+acc(PLAIN).toFixed(3)), String(+(PLAIN.fn / (PLAIN.tp + PLAIN.fn)).toFixed(2))];
    const fb = [
      [`${PLAIN.tp} out of ${flaggedOf(PLAIN)} is the share of its alarms that were real fraud. That is <b>precision</b>. Recall asks a different question: out of all the fraud, how much did it catch?`, false],
      [`Right: ${PLAIN.tp} of ${PLAIN.tp + PLAIN.fn}, recall ${r.toFixed(2)}. Its accuracy is ${pct(PLAIN.tn + PLAIN.tp, N, 2)}, only slightly above the do-nothing baseline of ${pct(ORD, N, 2)}, while recall shows it lets ${PLAIN.fn} of ${SPLIT.test_fraud} frauds through. Its precision is high (${PLAIN.tp} of its ${flaggedOf(PLAIN)} alarms were real), so the model is cautious, not useless. For a rare class, report recall and precision, never accuracy alone.`, true],
      ["That is its accuracy. It barely moved from the do-nothing model, which is exactly why it cannot tell you how much fraud is caught.", false],
      [`${PLAIN.fn} of ${PLAIN.tp + PLAIN.fn} is the share of fraud it <b>missed</b>. Recall is the other part: the share it caught.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A real model, and a better number</h1>
        <p class="lead">The team trains a logistic regression on ${fmt(SPLIT.train)} earlier transactions (${SPLIT.train_fraud} fraud) and tests it on the same week. Default setting: it says “fraud” when its fraud score is above 0.5.</p>
        ${cm(kit, PLAIN, "Logistic regression, threshold 0.5, test week")}
        <p class="task">Recall is: fraud caught ÷ all fraud. What is this model's recall?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 1) done(); });
    };
    paint();
  }

  /* 4. Fix 1: class weights, predicted before shown. */
  function classWeights({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const ordTrain = SPLIT.train - SPLIT.train_fraud;
    const wOrd = SPLIT.train / (2 * ordTrain), wFraud = SPLIT.train / (2 * SPLIT.train_fraud);
    const opts = [
      "It catches more fraud, and raises many more false alarms",
      "It catches more fraud with about the same few false alarms",
      "Its accuracy goes up",
      "Nothing changes: the data is the same"
    ];
    const reveal = `${cm(kit, WEIGHTED, "class_weight=\"balanced\", test week")}<p class="lx-${ID}-cap">Recall ${recallOf(WEIGHTED).toFixed(2)}, precision ${precOf(WEIGHTED).toFixed(3)}, accuracy ${pct(WEIGHTED.tn + WEIGHTED.tp, N)}. From fraud.out.txt.</p>`;
    const fb = [
      [`Right. It now catches ${WEIGHTED.tp} of ${SPLIT.test_fraud}, but it flags ${fmt(flaggedOf(WEIGHTED))} transactions to do it, ${fmt(WEIGHTED.fp)} of them false alarms.${reveal}Weighting moved the model's line between “fraud” and “not fraud” toward the ordinary transactions, so more transactions near that line are now called fraud. Recall went up, and precision paid for it.`, true],
      [`That would be a better model, but weights do not make the model know more. They change which mistake it fears. Here: ${WEIGHTED.tp} caught, but ${fmt(WEIGHTED.fp)} false alarms.${reveal}`, false],
      [`Accuracy falls, to ${pct(WEIGHTED.tn + WEIGHTED.tp, N)}: the model now makes ${fmt(WEIGHTED.fp)} mistakes on ordinary transactions to catch ${WEIGHTED.tp - PLAIN.tp} more frauds. One more reason accuracy is the wrong yardstick here.${reveal}`, false],
      [`The rows are the same, but the training goal is not: missing a fraud row now costs about ${Math.round(wFraud / wOrd)} times more than a mistake on an ordinary row, so the fit lands somewhere else.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Fix 1: make each fraud count more</h1>
        <p class="lead">Training adds up a penalty for every mistake. With ${SPLIT.train_fraud} fraud rows against ${fmt(ordTrain)} ordinary ones, the fraud mistakes are a tiny part of that sum, so the model hardly tries to avoid them. The fix: make each fraud mistake cost more.</p>
        <p class="lead">In scikit-learn, <code>class_weight="balanced"</code> multiplies each row's penalty by <code>n_samples / (n_classes × rows of its class)</code>: ${fmt(SPLIT.train)} / (2 × ${fmt(ordTrain)}) = <b>${wOrd.toFixed(4)}</b> for ordinary rows, ${fmt(SPLIT.train)} / (2 × ${SPLIT.train_fraud}) = <b>${wFraud.toFixed(0)}</b> for fraud rows. Now both classes weigh the same in total.</p>
        <p class="task">The team retrains with these weights. Predict what happens on the test week.</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 0) done(); });
    };
    paint();
  }

  /* 5. Fix 2: oversampling. Copies, not new information. */
  function oversampling({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [fmt(OVER_TRAIN.fraud_rows), fmt(OVER_TRAIN.distinct_fraud_rows), fmt(OVER_TRAIN.fraud_rows / 2)];
    const fb = [
      [`There are ${fmt(OVER_TRAIN.fraud_rows)} fraud <i>rows</i>, but they are drawn from the same ${SPLIT.train_fraud} with replacement, so most are repeats. Count the different ones.`, false],
      [`Right: still ${OVER_TRAIN.distinct_fraud_rows} different fraud transactions, each copied about ${Math.round(OVER_TRAIN.fraud_rows / OVER_TRAIN.distinct_fraud_rows)} times. Copying a row ${Math.round(OVER_TRAIN.fraud_rows / OVER_TRAIN.distinct_fraud_rows)} times works like giving it a weight of ${Math.round(OVER_TRAIN.fraud_rows / OVER_TRAIN.distinct_fraud_rows)}, so the result is almost the same as class weights:
        ${kit.table([["class weights", `caught ${WEIGHTED.tp} of ${SPLIT.test_fraud}, ${fmt(WEIGHTED.fp)} false alarms`], ["oversampling", `caught ${OVER.tp} of ${SPLIT.test_fraud}, ${fmt(OVER.fp)} false alarms`]], { head: ["fix", "test week"] })}
        Both say “each fraud counts more”. Neither shows the model a single new kind of fraud. (Undersampling, throwing away ordinary rows, is the mirror move; it trains faster and throws information away.)`, true],
      [`${fmt(OVER_TRAIN.fraud_rows / 2)} is half the fraud rows, not a count of different ones. <code>resample</code> draws from the same ${SPLIT.train_fraud} rows again and again, so no draw can bring a transaction that was not already there.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Fix 2: copy the fraud rows</h1>
        <p class="lead">Instead of weights, a teammate <b>oversamples</b> the training part: scikit-learn's <code>resample(..., replace=True, n_samples=...)</code> draws fraud rows at random, with replacement (the same row can be picked again), until there are as many fraud rows as ordinary ones. The training set grows to ${fmt(OVER_TRAIN.rows)} rows, ${fmt(OVER_TRAIN.fraud_rows)} of them fraud.</p>
        <p class="task">How many <b>different</b> fraud transactions does the oversampled training set contain?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 1) done(); });
    };
    paint();
  }

  /* 6. The third lever: the plain model with a lower threshold, under an alert budget. */
  function thresholdLever({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const at = t => SWEEP.find(r => r[0] === t);
    const choices = [["weighted", null], ["plain", 0.5], ["plain", 0.05], ["plain", 0.03], ["plain", 0.02]];
    const row = ([k, t]) => k === "weighted" ? [flaggedOf(WEIGHTED), WEIGHTED.tp] : [at(t)[1], at(t)[2]];
    const inBudget = choices.map(row).map(([f]) => f <= BUDGET);
    const best = choices.reduce((b, c, i) => inBudget[i] && (b < 0 || row(c)[1] > row(choices[b])[1]) ? i : b, -1);
    const label = ([k, t]) => k === "weighted" ? "Weighted model, threshold 0.5" : `Plain model, threshold ${t}`;
    const opts = choices.map(c => `<span class="lx-${ID}-opt">${kit.esc(label(c))}</span>`);
    const fb = choices.map((c, i) => {
      const [f, tp] = row(c);
      if (i === best) return [`Right: ${tp} of ${SPLIT.test_fraud} caught with ${fmt(f)} alerts. The weighted model catches ${WEIGHTED.tp}, but needs ${fmt(flaggedOf(WEIGHTED))} alerts, far over the budget. In this run, lowering the plain model's threshold gave most of the catch for a fraction of the alerts. Weights, oversampling and the threshold all move the same trade; pick the point with the costs in front of you, not the default 0.5. scikit-learn's <code>TunedThresholdClassifierCV</code> can choose the threshold by cross-validation for a metric you give it.`, true];
      if (f > BUDGET) return [`${fmt(f)} alerts is over the ${BUDGET} the analysts can check, so many would never be looked at.`, false];
      return [`Within budget, but it catches only ${tp}. A setting below it catches more and still fits in ${BUDGET} alerts.`, false];
    });
    const paint = () => {
      el.innerHTML = `<h1>The lever you already know</h1>
        <p class="lead">In the last lesson you moved a threshold. Here is the <b>plain</b> model (no weights) on the same test week, at lower thresholds. Each transaction it flags is an <b>alert</b> that an analyst must check by hand.</p>
        ${kit.table(SWEEP.map(([t, f, tp]) => [String(t), `${fmt(f)} alerts, ${tp} of ${SPLIT.test_fraud} caught`]), { head: ["threshold", "test week"] })}
        <p class="lead">The fraud analysts can check at most <b>${BUDGET}</b> alerts in a week like this one.</p>
        <p class="task">Which setting catches the most fraud within that budget?</p>
        <div class="lpanel">${ask(kit, opts, best, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === best) done(); });
    };
    paint();
  }

  /* 7. The library: the three parameters that matter, run as shown. */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const lo = Math.min(...NO_STRAT), hi = Math.max(...NO_STRAT);
    const opts = [`Always ${SPLIT.test_fraud}`, `Anywhere from about ${lo} to ${hi}, depending on the shuffle`, "0, because fraud is so rare"];
    const fb = [
      [`Only with <code>stratify</code>. Without it the split is a plain random shuffle. Over ten seeds the test part got ${NO_STRAT.join(", ")} frauds.`, false],
      [`Right. Over ten seeds without <code>stratify</code>, the test part got ${NO_STRAT.join(", ")} frauds. With so few frauds, a few more or less moves recall noticeably from one run to the next. <code>stratify=is_fraud</code> keeps the fraud share the same in both parts: exactly ${SPLIT.test_fraud} here.`, true],
      [`A random quarter of ${fmt(DATA.n)} rows will almost surely contain some of the ${DATA.fraud} frauds; over ten seeds the count ran from ${lo} to ${hi}. It is not fixed.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The same thing in scikit-learn</h1>
        <p class="lead">The weighted model from before, as code. Three things matter: <code>stratify</code> in the split, <code>class_weight</code> in the model, and which score you print. <code>average_precision_score</code> turns the whole precision-recall curve into one number, built from the fraud scores. So it does not depend on any one threshold.</p>
        ${kit.code(LIB_CODE, 2)}
        ${out(kit, LIB_OUT)}
        <p class="lx-${ID}-cap">Output of library.py, run on the synthetic set (${fmt(DATA.n)} rows, ${pct(DATA.fraud, DATA.n)} fraud).</p>
        <p class="task">If line 3 had no <code>stratify=is_fraud</code>, how many frauds would land in the test part?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}
        ${ans === 1 ? kit.feedback(`One more thing about the score you print. For a model that scores at random, ROC AUC was ${RANDOM.roc_auc.toFixed(2)} and average precision ${RANDOM.avg_precision.toFixed(3)} (about the fraud share). The plain model reached ROC AUC ${PLAIN.roc_auc.toFixed(2)}, which sounds high, and average precision ${PLAIN.avg_precision.toFixed(2)}. On a rare class, average precision starts near zero, so it shows more plainly how far you are from finding the fraud. Notice too that the weighted model in the listing scores ${WEIGHTED.avg_precision.toFixed(2)}, below the plain model's ${PLAIN.avg_precision.toFixed(2)}: weights changed where it draws the line, they did not make it rank fraud better.`) : ""}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 1) done(); });
    };
    paint();
  }

  /* 8. Broken on purpose: the notebook that reports recall 1.0. */
  function brokenLeak({ el, done, kit }) {
    ensureStyle();
    let part = 0, ans = null;
    const LO = LEAK_OUT_TEXT;
    const Q = [
      { right: 0, opts: LEAK_CODE.map((l, i) => `<span class="lx-${ID}-opt">Line ${i + 1}: <code>${kit.esc(l.length > 60 ? l.slice(0, 57) + "…" : l)}</code></span>`),
        fb: [null,
          [`No <code>stratify</code> is a weakness, but it cannot make a model perfect. Look at the output: all ${fmt(LEAK_OUT.test_fraud)} fraud rows in the test part also appear in training. Where did the copies come from?`, false],
          ["A fully grown decision tree memorises its training rows. That is why the leak shows so strongly, but it is not the cause. The cause is that the tree is tested on rows it has already seen.", false],
          ["The score function only measures. It found the real problem for you: every test fraud row is also in the training set.", false]] },
      { right: 1, opts: ["Add stratify to the split", "Split first, then oversample only the training part", "Use a smaller tree", "Oversample less, to 10% fraud"],
        fb: [
          ["The test part would still be full of copies of training rows, because the copies are made before the split.", false],
          null,
          ["A smaller tree memorises less, but it would still be tested on rows it trained on. The score would still be too good to trust.", false],
          ["Fewer copies, still copies. Any copy that lands in the test part is a row the model has already seen.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(part, 1)];
      el.innerHTML = `<h1>Broken on purpose: recall 1.0</h1>
        <p class="lead">A teammate's notebook oversamples fraud, trains a decision tree (a model built from yes/no questions about the columns; the next lessons cover it) and reports a nearly perfect fraud catcher. Here are the lines and the real output:</p>
        ${kit.code(LEAK_CODE, part >= 1 ? 0 : -1)}
        ${out(kit, LO)}
        <p class="lx-${ID}-cap">Output of leak.py. <code>test_fraud_also_in_train</code> counts test fraud rows that also appear in the training part.</p>
        <p class="task">${part === 0 ? "Which line causes the too-good score?" : part === 1 ? "Which change fixes it?" : "Fixed."}</p>
        ${part >= 1 ? kit.feedback(`Line 1. Oversampling made about ${Math.round((DATA.n - DATA.fraud) / DATA.fraud)} copies of each of the ${DATA.fraud} fraud rows <i>before</i> the split, so the split scattered copies of the same rows into both parts. The test part is ${pct(LEAK_OUT.test_fraud, LEAK_OUT.test_rows, 0)} fraud, nothing like a real week, and every fraud row in it was seen in training.`, true) : ""}
        <div class="lpanel">${part < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`Right. The same tree, split first (stratified), oversampled only in training, tested on ${fmt(FIXED_OUT.test_rows)} untouched rows with ${FIXED_OUT.test_fraud} frauds:${out(kit, FIXED_OUT_TEXT)}Recall ${FIXED_OUT.recall}, precision ${FIXED_OUT.precision.toFixed(2)}: the honest number. Any step that learns from data, resampling included, belongs after the split and only on the training part. In cross-validation that means inside each fold; imbalanced-learn's <code>Pipeline</code> does this for you.`, true)}</div>`;
      wire(el, i => { ans = i; if (i === Q[part].right) { part++; ans = null; paint(); if (part === 2) done(); return; } paint(); });
    };
    paint();
  }

  /* 9. The big picture, with a "when not" task built on the inflated scores. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The weighted model", "The oversampled model", "The plain model"];
    const real = pct(SPLIT.test_fraud, N);
    const fb = [
      [`Its fraud scores average ${pct(WEIGHTED.mean_score, 1)}, while the real share is ${real}. Weighting trained it as if fraud were as common as ordinary, so its scores are no longer probabilities of the real world.`, false],
      [`Same problem as weights: its scores average ${pct(OVER.mean_score, 1)} against a real share of ${real}. The copies told it fraud is common.`, false],
      [`Right. The plain model's scores average ${pct(PLAIN.mean_score, 1, 2)}, close to the real ${real}. The weighted and oversampled ones average about ${pct(WEIGHTED.mean_score, 1, 0)}: good for ranking and flagging, wrong as probabilities. When you need the number itself, keep the plain model and move the threshold instead.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to rebalance, and when not</h1>
        <p class="lead"><b>For:</b> a rare class you must catch: fraud, defects, churn, rare illness.</p>
        <p class="lead"><b>Always:</b> drop accuracy. Report recall, precision and average precision, and compare with the do-nothing baseline.</p>
        <p class="lead"><b>Reach for</b> weights or oversampling when the model ignores the rare class. They are cheap and do the same job.</p>
        <p class="lead"><b>Not when</b> you need real probabilities (in our run they pushed the scores far too high, as the task below shows), when the classes are only a little uneven, or when you have only a handful of rare examples: copies add nothing, more labels do.</p>
        <p class="lead"><b>Costs:</b> more false alarms for people to check, a threshold to choose and keep checking, and leakage if you resample before the split.</p>
        <p class="task">Finance wants to add up the fraud scores of next month's transactions to forecast how many will be fraud. Which model's scores should they use?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 2) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    [`A factory's camera checks circuit boards. About 1 board in 400 is faulty. The vendor's model is “99.7% accurate”.`, true,
      `Yes. Always answering “fine” would already score about ${(100 * 399 / 400).toFixed(2)}%. Ask for recall on faulty boards and the baseline before you believe the number.`,
      `With 1 faulty board in 400, a model that never flags anything is right about ${(100 * 399 / 400).toFixed(2)}% of the time. The 99.7% claim may be worse than doing nothing; you need recall on the faulty boards.`],
    ["A newsletter sorts replies into “question” or “thanks”. About 45 of every 100 replies are questions. The model is 91% accurate.", false,
      `No special treatment needed. The do-nothing baseline is ${100 - 45}%, so 91% is a real gain, and both classes have plenty of examples. Accuracy is a fair first number here.`,
      `The classes are close to even: always answering “thanks” would score only ${100 - 45}%, and there are many examples of both. Weights or resampling would change little; accuracy is meaningful here.`],
    ["A small airline wants to predict engine part failures. Its records hold 3 failures in ten years. The plan is to oversample them to half the data.", false,
      "No. Copying 3 rows thousands of times gives the model 3 examples to memorise, nothing to learn from. Collect more failure data or start from engineers' rules.",
      "Oversampling only copies what exists. With 3 failures the model would memorise those 3, and any test that contains copies would look perfect. The fix is more labelled failures, or rules from engineers, not resampling."],
    ["An online shop flags orders likely to be returned for abuse; about 1 order in 100. The model flags almost nothing, and the team wants it to catch more.", true,
      "Yes. A rare class the model ignores: try class weights or a lower threshold, then pick the point where the extra alerts are worth checking.",
      "This is the fraud story with other props: a rare class, a model that flags almost nothing. Weights, oversampling or a lower threshold, judged by recall and precision, are the tools."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Rare-class problem or not?</h1>
        <p class="lead">Four situations from other jobs.</p>
        <p class="task">Is this lesson's toolkit (a baseline and recall instead of accuracy, then weights, resampling or a lower threshold) the right next step? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const items = [
      `The always-“not fraud” model prints accuracy ${ALWAYS_NO.tn / N} and recall 0.0.`,
      `<code>compute_class_weight("balanced", ...)</code> gives about ${BAL_W[0]} for ordinary and ${BAL_W[1]} for fraud.`,
      `The weighted model flags ${fmt(flaggedOf(WEIGHTED))} of ${fmt(N)} test transactions and catches ${WEIGHTED.tp} of ${SPLIT.test_fraud}.`,
      `The oversampled training set has ${fmt(OVER_TRAIN.fraud_rows)} fraud rows but only ${OVER_TRAIN.distinct_fraud_rows} different ones.`,
      `Oversampling before the split reports recall ${LEAK_OUT.recall.toFixed(1)}; splitting first reports ${FIXED_OUT.recall}.`
    ];
    el.innerHTML = `<h1>You can spot a useless model now</h1>
      <p class="lead">You scored a do-nothing model at ${pct(ALWAYS_NO.tn, N)}, swapped accuracy for recall and precision, saw that weights, copies and a lower threshold all trade false alarms for caught fraud, and found a leak that faked a perfect score.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a> and run the same experiment.` : "The notebook for this lesson is on its way. It runs the same experiment on the same synthetic data."} What you should see:</p>
      <ul class="lx-${ID}-check">${items.map(t => `<li><label><input type="checkbox"> <span>${t}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Keep today's habit: whatever model you build, check it against the do-nothing baseline and judge it with recall and precision when the class you want is rare.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Imbalanced data: when the thing you want is rare",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.train_test_split.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.utils.resample.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.dummy.DummyClassifier.html",
      "https://scikit-learn.org/stable/modules/classification_threshold.html",
      "https://imbalanced-learn.org/stable/common_pitfalls.html"
    ],
    interview: [
      {
        q: "Your fraud model shows 99.6% accuracy in testing, but the fraud team says it catches almost nothing in production. What do you check and what do you change?",
        good: [
          "Compare with the baseline: always answering “not fraud” already scores the share of ordinary transactions",
          "Report recall and precision on the fraud class, and average precision, instead of accuracy",
          "Try class weights or oversampling of the training part, or lower the threshold, and compare them at the alert volume the team can review",
          "Use a stratified split so the test set keeps the real fraud share"
        ],
        weak: "Train a bigger model or collect more ordinary transactions, without noticing that accuracy hides the rare class."
      },
      {
        q: "A colleague oversampled the fraud rows and now reports recall of 1.0 on the test set. How do you react?",
        good: [
          "Ask when the oversampling happened: before the split puts copies of training rows into the test set",
          "Check whether test fraud rows also appear in training, and whether the test set still has the real fraud share",
          "Redo it: split first, resample only the training part, inside each fold in cross-validation",
          "Expect a much lower, honest recall afterwards"
        ],
        weak: "Celebrate, or blame the model type, without checking whether the test set contains rows the model trained on."
      }
    ],
    screens: [scoreByHand, spotIdea, realModel, classWeights, oversampling, thresholdLever, library, brokenLeak, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
