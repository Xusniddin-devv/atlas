/* Lesson: scikit-learn pipelines from raw table to model. Story: a telecom team predicts which subscribers will
   switch provider, and a colleague must be able to rerun the model next month.
   Ideas: (1) every step that learns numbers from data (a fill value, a mean and spread, a list of categories)
   learns them from the training rows only ("fit"), then applies them unchanged to every other row
   ("transform"); bundling the steps with the model makes that automatic, also inside cross-validation;
   (2) the real tool: ColumnTransformer routes columns to their steps, Pipeline joins them to the model,
   GridSearchCV tunes it with "<step>__<parameter>" names, and the fitted whole is saved for next month, where a
   category it never saw breaks it until the encoder is told how to handle unknowns.
   Data, all real runs on a made-up table (no model API calls in this lesson), in docs/ai-path/runs/s2-sklearn-pipeline/:
   - make_data.py (+ .out.txt): the invented October (2,000 rows) and November (400 rows) subscriber tables, seed 0;
   - leaky.py / fixed.py (+ .out.txt): the colleague's script with the scaler fitted before the split, and fixed;
   - why_same.py (+ .out.txt): what the two scalers learned, and how many test predictions differ;
   - scratch_pipeline.py (+ .out.txt): MeanFiller, Scaler and a tiny logistic regression in NumPy, with
     fit_then_score traced line by line;
   - sk_pipeline.py, sk_pipeline_classes.py (+ sk_pipeline.out.txt, sk_pipeline_ignore.out.txt): ColumnTransformer,
     Pipeline, cross_val_score, GridSearchCV, joblib.dump; a StandardScaler subclass counts fit calls;
   - rerun_november.py (+ rerun_november.out.txt: the ValueError; rerun_november_ignore.out.txt: after the fix);
   - env.txt: Python 3.12.11, scikit-learn 1.9.1, pandas 3.1.1, NumPy 2.5.4, joblib 1.6.0.
   Lesson-local style: option text in code type, an output block, a notebook checklist (.lx-s2-sklearn-pipeline-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s2-sklearn-pipeline";
  const RUN_DATE = "2026-11-14";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const pct = v => `${(Math.round(v * 1000) / 10).toFixed(1)}%`;

  /* ---------- Data copied from the runs ---------- */
  // make_data.out.txt
  const OCT = { rows: 2000, churnRate: 0.257, blankGb: 156 };
  const NOV_ROWS = 400;
  const SAMPLE_HEAD = ["customer_id", "tenure_months", "monthly_charge", "support_calls", "data_gb", "contract", "payment", "churned"];
  const SAMPLE = [
    ["T-10000", "62", "58.74", "3", "9.0", "month-to-month", "card", "0"],
    ["T-10001", "46", "55.48", "2", "17.2", "two-year", "bank transfer", "0"],
    ["T-10003", "20", "35.17", "1", "NaN", "month-to-month", "cash", "1"]
  ];
  // leaky.py, the lines after the imports, unchanged; leaky.out.txt and fixed.out.txt
  const LEAKY = [
    "subscribers = pd.read_csv(\"subscribers_october.csv\")",
    "usage = subscribers[[\"tenure_months\", \"monthly_charge\",",
    "                     \"support_calls\"]]",
    "scaled = StandardScaler().fit_transform(usage)",
    "X_train, X_test, y_train, y_test = train_test_split(",
    "    scaled, subscribers[\"churned\"], test_size=0.25, random_state=0)",
    "model = LogisticRegression().fit(X_train, y_train)",
    "print(\"test accuracy:\", round(model.score(X_test, y_test), 4))"
  ];
  const FIXED = [
    "subscribers = pd.read_csv(\"subscribers_october.csv\")",
    "usage = subscribers[[\"tenure_months\", \"monthly_charge\",",
    "                     \"support_calls\"]]",
    "X_train, X_test, y_train, y_test = train_test_split(",
    "    usage, subscribers[\"churned\"], test_size=0.25, random_state=0)",
    "scaler = StandardScaler().fit(X_train)",
    "model = LogisticRegression().fit(scaler.transform(X_train), y_train)",
    "X_test = scaler.transform(X_test)",
    "print(\"test accuracy:\", round(model.score(X_test, y_test), 4))"
  ];
  const LEAKY_ACC = 0.782, FIXED_ACC = 0.782;
  // why_same.out.txt: [column, mean all rows, mean train rows, std all rows, std train rows]
  const WHY = [
    ["tenure_months", 37.404, 37.056, 20.616, 20.640],
    ["monthly_charge", 66.127, 65.834, 24.456, 24.305],
    ["support_calls", 1.607, 1.607, 1.256, 1.258]
  ];
  const WHY_TEST_ROWS = 500, WHY_DIFFER = 0;
  // scratch_pipeline.out.txt
  const SPLIT = { train: 1500, test: 500 };
  const GB = { train: 12.0033, all: 12.1208, test: 12.4685 }; // mean data_gb, blanks left out
  const BLANKS = { train: 122, test: 34 };
  // The listing is fit_then_score from scratch_pipeline.py, line for line (line 0 = def).
  const SCRATCH = [
    "def fit_then_score(steps, model, train_rows, train_churn, test_rows, test_churn):",
    "    for step in steps:",
    "        step.fit(train_rows)",
    "        train_rows = step.transform(train_rows)",
    "    model.fit(train_rows, train_churn)",
    "    for step in steps:",
    "        test_rows = step.transform(test_rows)",
    "    return model.score(test_rows, test_churn)"
  ];
  // Trace rows from scratch_pipeline.out.txt: [line about to run, event, step, step fitted, step's learned mean of
  // data_gb, train blanks, train data_gb mean, test blanks, test data_gb mean, model fitted]
  const TR = [
    [1, "l", null, null, null, 122, 12.0033, 34, 12.4685, false],
    [2, "l", "MeanFiller", false, null, 122, 12.0033, 34, 12.4685, false],
    [3, "l", "MeanFiller", true, 12.0033, 122, 12.0033, 34, 12.4685, false],
    [1, "l", "MeanFiller", true, 12.0033, 0, 12.0033, 34, 12.4685, false],
    [2, "l", "Scaler", false, null, 0, 12.0033, 34, 12.4685, false],
    [3, "l", "Scaler", true, 12.0033, 0, 12.0033, 34, 12.4685, false],
    [1, "l", "Scaler", true, 12.0033, 0, 0.0, 34, 12.4685, false],
    [4, "l", "Scaler", true, 12.0033, 0, 0.0, 34, 12.4685, false],
    [5, "l", "Scaler", true, 12.0033, 0, 0.0, 34, 12.4685, true],
    [6, "l", "MeanFiller", true, 12.0033, 0, 0.0, 34, 12.4685, true],
    [5, "l", "MeanFiller", true, 12.0033, 0, 0.0, 0, 12.4368, true],
    [6, "l", "Scaler", true, 12.0033, 0, 0.0, 0, 12.4368, true],
    [5, "l", "Scaler", true, 12.0033, 0, 0.0, 0, 0.0544, true],
    [7, "l", "Scaler", true, 12.0033, 0, 0.0, 0, 0.0544, true],
    [7, "r", "Scaler", true, 12.0033, 0, 0.0, 0, 0.0544, true]
  ];
  const SCRATCH_ACC = 0.778; // "returned" on the return row
  // sk_pipeline.py, the lines between the listing markers, with CountingScaler() shown as the StandardScaler()
  // it subclasses and the IGNORE switch shown in its default branch.
  const SK = [
    "numbers = [\"tenure_months\", \"monthly_charge\", \"support_calls\", \"data_gb\"]",
    "categories = [\"contract\", \"payment\"]",
    "prepare = ColumnTransformer([",
    "    (\"numbers\", make_pipeline(SimpleImputer(strategy=\"mean\"),",
    "                              StandardScaler()), numbers),",
    "    (\"categories\", OneHotEncoder(), categories),",
    "])",
    "churn_model = Pipeline([(\"prepare\", prepare), (\"model\", LogisticRegression())])",
    "search = GridSearchCV(churn_model, {\"model__C\": [0.01, 0.1, 1, 10]}, cv=5)",
    "search.fit(X_train, y_train)",
    "joblib.dump(search.best_estimator_, \"churn_model.joblib\")"
  ];
  const NUMBERS = ["tenure_months", "monthly_charge", "support_calls", "data_gb"];
  const CATEGORIES = ["contract", "payment"];
  // sk_pipeline.out.txt (the same in sk_pipeline_ignore.out.txt)
  const CV_FOLDS = [0.787, 0.823, 0.777, 0.777, 0.763];
  const CV_FITS = 5;
  const C_GRID = [0.01, 0.1, 1, 10], CV_K = 5;
  const BEST = { C: 0.1, cv: 0.7853 };
  const SEARCH_FITS = 21;
  const TEST_ACC = 0.79;
  const FEATURES = ["numbers__tenure_months", "numbers__monthly_charge", "numbers__support_calls", "numbers__data_gb",
    "categories__contract_month-to-month", "categories__contract_one-year", "categories__contract_two-year",
    "categories__payment_bank transfer", "categories__payment_card", "categories__payment_cash"];
  const OUT_LINES = [
    "cross-validation accuracy: [0.787 0.823 0.777 0.777 0.763]",
    "scaler fits so far: 5",
    "best: {'model__C': 0.1} cv accuracy: 0.7853",
    "scaler fits in the search: 21",
    "test accuracy: 0.79"
  ];
  // rerun_november.out.txt, trimmed: whole frames cut where "…" stands, the "^^^" underline lines left out,
  // and the folder before each file name cut to "…/"
  const NOV_COUNTS = { "card": 178, "bank transfer": 115, "e-wallet": 64, "cash": 43 };
  const TRACEBACK = [
    "november payment values: {'card': 178, 'bank transfer': 115, 'e-wallet': 64, 'cash': 43}",
    "Traceback (most recent call last):",
    "  File \"…/rerun_november.py\", line 9, in <module>",
    "    risk = churn_model.predict_proba(november.drop(columns=\"churned\"))[:, 1]",
    "  File \"…/sklearn/pipeline.py\", line 925, in predict_proba",
    "    Xt = transform.transform(Xt)",
    "  …",
    "  File \"…/sklearn/compose/_column_transformer.py\", line 1074, in transform",
    "    Xs = self._call_func_on_transformers(",
    "  …",
    "  File \"…/sklearn/preprocessing/_encoders.py\", line 221, in _transform",
    "    raise ValueError(msg)",
    "ValueError: Found unknown categories ['e-wallet'] in column 1 during transform"
  ];
  const UNKNOWN = "e-wallet", ERR_COL = 1;
  // rerun_november_ignore.out.txt
  const NOV_FIXED = { scored: 400, flagged: 62, accuracy: 0.78 };

  /* ---------- Derived from the data ---------- */
  const expectFits = C_GRID.length * CV_K + 1; // checked against the counted SEARCH_FITS below
  const fitsMatch = expectFits === SEARCH_FITS;
  const oneHotCols = FEATURES.filter(f => f.startsWith("categories__")).length;
  const catValues = c => FEATURES.filter(f => f.startsWith(`categories__${c}_`)).map(f => f.slice(`categories__${c}_`.length));
  const PAYMENTS_OCT = catValues("payment");
  const novNew = NOV_COUNTS[UNKNOWN];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-line { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; white-space: pre-wrap; }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); font: 500 13.5px/1.5 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-col { margin: 0; font: 600 15px var(--mono); }
      .lx-${ID}-wrap div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 4ch); text-indent: -4ch; }
      .lx-${ID}-link { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); }
      .lx-${ID}-check { list-style: none; padding: 0; margin: 12px 0 0; }
      .lx-${ID}-check li { border-top: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .lx-${ID}-check label span { padding-top: 10px; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .lx-${ID}-check input:checked { background-color: var(--good); outline-color: var(--good); }
    `;
    document.head.appendChild(s);
  }
  // Code that wraps long lines (hanging indent) instead of scrolling sideways at phone width.
  // A continuation line indented past 24 spaces (inside brackets, so the indent means nothing to Python) is shown
  // with an 8-space indent, so it does not wrap into an empty line at phone width.
  const codeW = (kit, lines, active) => kit.code(lines.map(l => l.replace(/^ {25,}/, "        ")), active).replace('class="lcode"', `class="lcode lx-${ID}-wrap"`);
  const lineOpt = (kit, txt) => `<span class="lx-${ID}-line">${kit.esc(txt)}</span>`;
  const out = (kit, lines, cap) => `<div class="lx-${ID}-out">${kit.esc(lines.join("\n"))}</div><p class="lx-${ID}-cap">${cap || `Output of our run, ${RUN_DATE}`}</p>`;
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }

  /* 1. The situation, and the bug: which line lets the test rows shape training? */
  function findBug({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    // options: line indexes into LEAKY
    const pickLines = [0, 1, 3, 4, 6];
    const RIGHT = 2; // LEAKY[3], the scaler
    const fb = [
      ["Reading the file only loads rows. Nothing is learned from them yet, so nothing can leak here.", false],
      ["Choosing three columns uses no values from any row. It is the same choice whichever rows end up in the test set.", false],
      [`Right. <code>fit_transform</code> on <code>usage</code> makes the scaler learn each column's mean and spread from all ${OCT.rows} rows, and only <b>then</b> is a quarter of them set aside as the test set. The test rows helped decide the numbers that every training row was scaled with. This is the leak you met in the leakage lesson, in its most common everyday form.`, true],
      ["The split itself is fine: a quarter held out, a fixed seed. The trouble is what happened before it. By the time the rows are split, they were already scaled with numbers learned from all of them.", false],
      ["The model is fitted on <code>X_train</code> only, which looks right. But <code>X_train</code> was already scaled with numbers that the test rows helped compute. The leak happened one step earlier.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A model a colleague can rerun</h1>
        <p class="lead">A phone company's data team wants to know which subscribers are about to switch to another provider (to <b>churn</b>), so the retention team can call them first. Next month a colleague will rerun the model on new subscribers, without you. This lesson is about the part between the raw table and the model: the preparation steps, and how to keep them honest and easy to rerun. Here is the first script, on a table of ${OCT.rows.toLocaleString("en")} subscribers. (The table is made up by our script; ${pct(OCT.churnRate)} of them churned.)</p>
        ${codeW(kit, LEAKY, -1)}
        ${out(kit, [`test accuracy: ${LEAKY_ACC}`])}
        <p class="task">The test rows are meant to stand in for subscribers the model has never seen. Which line lets the test rows shape what the model learns?</p>
        <div class="lpanel">${ask(kit, pickLines.map(i => lineOpt(kit, LEAKY[i] + (i === 1 ? " …" : i === 4 ? " …" : ""))), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Predict how the score changes once fixed. */
  function predictFix({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Clearly lower: the leak was lifting it", "A little lower", `Exactly the same: ${FIXED_ACC}`, "Higher"];
    const RIGHT = 2;
    const fb = [
      [`That is the usual guess, and it is wrong this time. The leak only moved the scaler's mean and spread. How much can a mean move when ${SPLIT.test} test rows are added to ${SPLIT.train.toLocaleString("en")} training rows?`, false],
      ["Closer, but our run printed the same number to the last digit. A small change in the scaler's numbers can move no prediction at all.", false],
      null,
      ["A leak can only give the model information it should not have. Taking that away does not make it better informed. Here it changed nothing.", false]
    ];
    const whyRows = WHY.map(([c, ma, mt]) => [c, `${ma.toFixed(3)} vs ${mt.toFixed(3)}`]);
    const spreadGap = Math.max(...WHY.map(([, , , sa, st]) => Math.abs(sa - st)));
    const rightFb = `Right: ${FIXED_ACC}, the same as before. The table shows why. With ${SPLIT.train.toLocaleString("en")} of ${OCT.rows.toLocaleString("en")} rows in the training set, the means and spreads hardly move, and of the ${WHY_TEST_ROWS} test predictions, <b>${WHY_DIFFER}</b> changed. ${kit.table(whyRows, { head: ["column", "mean: all rows vs train rows"], title: "What each scaler learned (why_same.py)" })}<p class="lx-${ID}-cap">Output of our run, ${RUN_DATE}. The spreads differ by at most ${spreadGap.toFixed(3)}.</p>So was it a bug at all? The next screen asks that.`;
    const paint = () => {
      el.innerHTML = `<h1>Fix it, then predict the score</h1>
        <p class="lead">The fixed script splits first, fits the scaler on the training rows only, and reuses that same scaler on the test rows. Same data, same seed.</p>
        ${codeW(kit, FIXED, 5)}
        <p class="task">The leaky script printed ${LEAKY_ACC}. What does the fixed one print?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: RIGHT })}${ans == null ? "" : ans === RIGHT ? kit.feedback(rightFb, true) : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: the rule behind the fix. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Nothing. The score did not change, so scaling before the split is harmless",
      "Every step that learns numbers from data must learn them from the training rows only, then reuse them unchanged on test rows and next month's rows. So keep those steps together with the model and fit them together",
      "Next month, fit a fresh scaler on the new subscribers before predicting",
      "Stop scaling the columns, so there is nothing to leak"
    ];
    const RIGHT = 1;
    const fb = [
      [`It was harmless <b>here</b>, by luck: a mean barely moves when ${SPLIT.test} rows join ${SPLIT.train.toLocaleString("en")}. In the leakage lesson, picking columns on all rows before cross-validation lifted a score far above chance. Fill values, category lists and column choices can all leak. The score is not the proof; the order of the steps is.`, false],
      [`Right. A step has two parts: <b>fit</b> learns its numbers (a fill value, a mean and spread, the list of categories), <b>transform</b> applies them. Fit happens on training rows only; transform runs on everything. The test score is only honest if it was made the way next month's predictions will be made: with numbers learned before those rows existed. Writing that by hand in every script is how the bug got in. Keeping the steps and the model in one object that is fitted as a whole makes the order automatic.`, true],
      ["Then November's rows are scaled with November's numbers, while the model's weights were learned on columns scaled with October's. The same subscriber would get a different input. A small month makes it worse: its mean is noisy. The model must get the scaling it was trained with.", false],
      ["The problem was never scaling. It was where the scaler learned its numbers. Filling blanks and encoding categories learn numbers too, and you cannot skip those: the model cannot read a blank or the word “cash”.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>So what was the bug?</h1>
        <p class="lead">The fix changed no prediction on this data. Your colleague will rerun the script next month, with new subscribers, and probably with a few more preparation steps added.</p>
        <p class="task">What is the rule that the fix follows, and that every later step must follow too?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Use the rule with predictions: fill and scale the test rows. */
  function predictSteps({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const Q = [
      { task: `${BLANKS.test} test rows have a blank <code>data_gb</code> (monthly data used). The filler was fitted on the training rows. Which value goes into those blanks?`,
        opts: [`${GB.train} (mean of the training rows)`, `${GB.test} (mean of the test rows)`, `${GB.all} (mean of all rows)`, "0"], right: 0,
        fb: [null,
          `That means fitting the filler on the test rows: the leak again. The filler must already have its number before new rows arrive, as it will next month.`,
          "That is the leaky way from the first screen: the test rows would help choose the fill value.",
          "Zero means “used no data at all”, which these subscribers did not. The filler was fitted to learn a sensible value, and it learned a mean."],
        ok: `Right: ${GB.train}. The test rows get the number learned from the training rows, unchanged. After filling, the test column's mean is ${TR[10][8]}, not ${GB.train}, because ${BLANKS.test} blanks were filled and the other ${SPLIT.test - BLANKS.test} values are the test rows' own.` },
      { task: `Then the scaler. On the training rows, scaling makes <code>data_gb</code> average to ${TR[6][6].toFixed(1)}. What does the test column average after the same scaler transforms it?`,
        opts: [`Exactly ${TR[6][6].toFixed(1)}`, "Close to it, but not exactly", `Still about ${GB.train}`], right: 1,
        fb: [`Only the rows the scaler was fitted on average exactly ${TR[6][6].toFixed(1)}: it subtracted <b>their</b> mean. The test rows have a slightly different mean of their own.`, null,
          "Transform does change the test rows: it subtracts the training mean and divides by the training spread. It just does not refit them."],
        ok: `Right: ${TR[12][8]} in our run. Not exactly ${TR[6][6].toFixed(1)}, because the test rows were scaled with the training rows' mean and spread. That small offset is what honest looks like: the test rows are treated exactly like new subscribers next month will be.` }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      const fin = stage === 2;
      el.innerHTML = `<h1>Fit on training rows, apply everywhere</h1>
        <p class="lead">Now a fuller version, written from scratch in NumPy: four number columns (<code>data_gb</code> included, ${OCT.blankGb} blanks in October), split into ${SPLIT.train.toLocaleString("en")} training and ${SPLIT.test} test rows. Two steps run before the model: a <b>filler</b> that puts a column's mean into its blanks, and a <b>scaler</b>.</p>
        ${kit.table([["training rows", `mean ${GB.train}, ${BLANKS.train} blanks`], ["test rows", `mean ${GB.test}, ${BLANKS.test} blanks`], ["all rows", `mean ${GB.all}`]], { head: ["data_gb", "before any step"], title: "What the rows hold" })}
        ${stage >= 1 ? kit.feedback(Q[0].ok, true) : ""}
        ${fin ? kit.feedback(Q[1].ok, true) : `<p class="task">${q.task}</p>
        <div class="lpanel">${kit.options(q.opts, { picked: ans, correct: q.right })}${ans == null ? "" : kit.feedback(q.fb[ans], false)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; }
        paint();
        if (stage === 2) done();
      });
    };
    paint();
  }

  /* 5. The same thing as a stepped Python replay. */
  const FR = TR.slice(1).map((v, k) => ({ ran: TR[k][0], ret: v[1] === "r", next: v[0], step: v[2], fitted: v[3], learned: v[4], trB: v[5], trM: v[6], teB: v[7], teM: v[8], model: v[9] }));
  const sayFrame = (kit, f) => {
    if (f.ret) return `The <code>return</code> line gives the test accuracy: <b>${SCRATCH_ACC}</b>. Look back over the run: <code>fit</code> ran only on <code>train_rows</code>. The test rows went through <code>transform</code> alone.`;
    if (f.ran === 1) return f.next === 4 ? "No steps left: every step has learned its numbers and the training rows are ready." : `The loop takes the next step: <code>${kit.esc(f.step)}</code>.`;
    if (f.ran === 2) return `<code>${kit.esc(f.step)}.fit</code> learned from the ${SPLIT.train.toLocaleString("en")} training rows only. Its mean for <code>data_gb</code>: <b>${f.learned}</b>.`;
    if (f.ran === 3) return f.step === "MeanFiller" ? `The training blanks are filled with that mean: ${BLANKS.train} blanks before, ${f.trB} now.` : `The training rows are scaled: <code>data_gb</code> now averages ${f.trM.toFixed(1)} on them.`;
    if (f.ran === 4) return "The model learns from the prepared training rows. Its weights only make sense for columns prepared exactly this way.";
    if (f.ran === 5) return f.next === 7 ? "Both steps applied. The test rows now look like the training rows did when the model learned." : `Now the test rows, step <code>${kit.esc(f.step)}</code>. No <code>fit</code> in this loop.`;
    if (f.ran === 6) return f.step === "MeanFiller" ? `${BLANKS.test} test blanks filled with the <b>training</b> mean ${f.learned}: ${f.teB} blanks left, column mean ${f.teM}.` : `Scaled with the training mean and spread: the test column averages ${f.teM}, close to 0 but not exactly.`;
    return "";
  };
  function scratchCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The pipeline idea, written from scratch</h1>
        <p class="lead"><code>steps</code> is a list of objects with a <code>fit</code> and a <code>transform</code> method, here <code>[MeanFiller(), Scaler()]</code>. The model is a small logistic regression in NumPy. This replays our traced run.</p>
        <p class="task">Step through to the end, and watch which rows ever reach <code>fit</code>.</p>
        ${codeW(kit, SCRATCH, f.ran)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>step <b>${kit.esc(f.step || "–")}</b></span><span>train blanks <b>${f.trB}</b></span><span>test blanks <b>${f.teB}</b></span><span>test data_gb mean <b>${f.teM}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. The real tool, part 1: route each column to its step. */
  const ROUTES = ["numbers", "categories", "left out"];
  const COLS = [
    ["customer_id", 2, {
      0: "An id like T-10000 is a label, not a quantity: subscriber T-10500 is not “more” than T-10000. It is not even a number, so the filler and scaler would fail on it.",
      1: "One-hot would make one column per subscriber. Each new subscriber next month is an unseen id, so the model learns nothing it can reuse." }],
    ["tenure_months", 0, { 1: "It is a count of months: 62 really is more than 20. One-hot would throw that order away and make a column for every value.", 2: "How long someone has stayed is one of the most telling columns for churn. Leaving it out throws away signal." }],
    ["data_gb", 0, { 1: "Gigabytes are a quantity, and they have blanks: that is what the numbers branch fills before scaling.", 2: "It has blanks, but blanks are what the filler is for. A column with some blanks is still worth keeping." }],
    ["contract", 1, { 0: "“month-to-month” is a word. The filler and scaler can only do arithmetic; they would fail on text.", 2: "Contract type is a strong churn signal in this table. Encode it, do not drop it." }],
    ["payment", 1, { 0: "“bank transfer” is not a number. It needs one column per value, which is what the categories branch builds.", 2: "It is a short list of values, easy to encode, and cash payers churn more in this table. Keep it." }],
    ["churned", 2, { 0: "This is the answer the model must predict. Feeding it in as a column is the worst leak there is: the model just copies it.", 1: "This is the label, the answer itself. It goes to <code>fit</code> as <code>y</code>, never into the columns the model reads." }]
  ];
  function routeColumns({ el, done, kit }) {
    ensureStyle();
    const ans = COLS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Different columns, different steps</h1>
        <p class="lead">The real table mixes numbers, words and ids. In scikit-learn, a <b>ColumnTransformer</b> sends each named column to its own steps and glues the results side by side. Ours has two branches: <b>numbers</b> (fill the blanks with the mean, then scale) and <b>categories</b> (one-hot: one 0/1 column per value). Columns you do not name are left out.</p>
        ${kit.table(SAMPLE_HEAD.map((h, j) => [h, SAMPLE.map(r => r[j]).join(", ")]), { head: ["column", "three subscribers"], title: "October table, three rows (make_data.out.txt)" })}
        <p class="task">Send each column where it belongs. Pick again if you change your mind.</p>
        ${COLS.map(([c, r, why], i) => `<div class="lcase" id="c${i}"><p class="lx-${ID}-col">${kit.esc(c)}</p>${kit.options(ROUTES, { picked: ans[i], correct: r })}${ans[i] == null ? "" : ans[i] === r ? kit.feedback(r === 2 && c === "churned" ? "Right. It is the label: the column the model learns to predict. It is passed separately, as <code>y</code>." : r === 2 ? "Right. An id names a subscriber but says nothing the model can reuse for the next one." : r === 0 ? "Right: a quantity, so fill and scale it." : "Right: a short list of words, so one 0/1 column per value.", true) : kit.feedback(why[ans[i]], false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (COLS.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 7. The real tool, part 2: Pipeline + GridSearchCV, and how often the scaler is fitted. */
  function tune({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const Q = [
      { task: `<code>GridSearchCV</code> tries ${C_GRID.length} values of <code>C</code> (the penalty setting from the logistic regression lesson: smaller C pulls the weights harder toward 0), each with ${CV_K}-fold cross-validation. How many times is the scaler fitted in the whole search?`,
        opts: ["1", String(C_GRID.length), String(C_GRID.length * CV_K), String(expectFits)], right: 3,
        fb: [`One fit for the whole search is the leaky way: one scaler that has seen every fold, including the fold being scored. Because the scaler sits inside <code>churn_model</code>, every fit of the pipeline refits it.`,
          "Each value of C is scored on several folds, and every fold trains a fresh copy of the whole pipeline on its own training part. So the count is per fold, not per value.",
          `Close. That is every value times every fold. But after choosing the best <code>C</code>, the search fits the pipeline once more on all the training rows (its <code>refit</code> setting is on by default). That final copy is the one you save.`, null],
        ok: `Right: ${C_GRID.length} × ${CV_K} + 1 = ${expectFits}, and the counter in our run printed <b>${SEARCH_FITS}</b>. ${fitsMatch ? "" : "(They differ.) "}Each fold's scaler learned only from that fold's training part, so the fold it was scored on stayed unseen, like the test rows. A plain <code>cross_val_score</code> on the same pipeline fitted it ${CV_FITS} times. This is why the docs call pipelines safe from leakage in cross-validation.` },
      { task: "The model step is named <code>\"model\"</code> in the Pipeline. Which key in the search's dictionary sets that step's <code>C</code>?",
        opts: ["<code>\"C\"</code>", "<code>\"model__C\"</code>", "<code>\"LogisticRegression__C\"</code>", "<code>\"model.C\"</code>"], right: 1,
        fb: ["The pipeline has several steps, and more than one could have a parameter called C. The key must say which step.", null,
          "The key uses the name you gave the step, not the class name. You could have two LogisticRegression steps; their names tell them apart.",
          "Not a dot: scikit-learn joins the step name and the parameter with two underscores."],
        ok: `Right: step name, two underscores, parameter. The search picked <code>C = ${BEST.C}</code>.` }
    ];
    const paint = () => {
      const fin = stage === 2;
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>One object: prepare, model, tune</h1>
        <p class="lead">A <b>Pipeline</b> joins the steps and the model into one object. Its <code>fit</code> fits each step on the rows it gets, transforms them and passes them to the next step. Its <code>predict</code> only transforms, then asks the model. Here is the version a colleague can rerun. (In our run the scaler was a <code>StandardScaler</code> subclass that also counts its fits.)</p>
        ${codeW(kit, SK, fin ? -1 : stage === 0 ? 9 : 8)}
        ${stage >= 1 ? kit.feedback(Q[0].ok, true) : ""}
        ${fin ? `${kit.feedback(`${Q[1].ok} Its mean cross-validation accuracy was ${BEST.cv}; the untouched test rows then gave ${TEST_ACC}. The two agree, which is what an honest set-up looks like.`, true)}
          ${out(kit, OUT_LINES, `Output of our run, ${RUN_DATE}. The listing above leaves out the print lines and the <code>cross_val_score</code> call our script ran before the search.`)}
          <p class="lead">The fitted pipeline turned ${CATEGORIES.length} word columns into ${oneHotCols} one-hot columns and kept ${NUMBERS.length} number columns, ${FEATURES.length} in all. <code>joblib.dump</code> saved the whole fitted object, steps and model together, so your colleague loads one file and calls <code>predict</code>.</p>` : `<p class="task">${q.task}</p>
        <div class="lpanel">${kit.options(q.opts, { picked: ans, correct: q.right })}${ans == null ? "" : kit.feedback(q.fb[ans], false)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; }
        paint();
        if (stage === 2) done();
      });
    };
    paint();
  }

  /* 8. Broken on purpose: next month's rerun crashes. */
  function nextMonth({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const Q = [
      { task: "The error says “column 1”. Which column of the table is it talking about?",
        opts: ["customer_id", "tenure_months", "contract", "payment"], right: 3,
        fb: ["The error comes from <code>_encoders.py</code>, the OneHotEncoder. That encoder never sees the whole table, only the columns its branch was given.",
          "That is column 1 of the whole table, counting from 0. But the error is raised inside the OneHotEncoder, which only receives its own branch's columns.",
          "Close: you looked at the encoder's columns. Python counts from 0, so <code>contract</code> is column 0 there.", null],
        ok: `Right. The OneHotEncoder only gets <code>${CATEGORIES.map(c => kit.esc(c)).join("</code> and <code>")}</code>, counted from 0. Column 1 is <code>payment</code>. In October it held only ${PAYMENTS_OCT.map(p => `“${kit.esc(p)}”`).join(", ")}; November has ${novNew} subscribers paying by “${kit.esc(UNKNOWN)}”. The encoder has no column for that value, and its default is to stop with an error.` },
      { task: "What is the fix that lets the colleague score all of November?",
        opts: ["Fit the whole pipeline again on November's rows", `Drop the ${novNew} “${kit.esc(UNKNOWN)}” rows before predicting`, "Set <code>OneHotEncoder(handle_unknown=\"ignore\")</code>, refit on October, save again", "Delete the payment column from November's file"], right: 2,
        fb: ["New subscribers have not churned yet: there is no answer to learn from. And refitting on the rows you are about to score is the leak from the first screen again.",
          `Then ${novNew} subscribers are silently never scored, and the retention team never calls them. The model should still say something about them.`, null,
          "The pipeline was fitted with a payment column and expects one. A missing column breaks it too, just with a different error."],
        ok: "" }
    ];
    const paint = () => {
      const fin = stage === 2;
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Next month, the rerun breaks</h1>
        <p class="lead">A month later your colleague loads <code>churn_model.joblib</code> and scores ${NOV_ROWS} new subscribers. This is what our run printed:</p>
        ${out(kit, TRACEBACK, `Output of our run, ${RUN_DATE} (trimmed with …; the ^^^ marker lines left out)`)}
        ${stage >= 1 ? kit.feedback(Q[0].ok, true) : ""}
        ${fin ? kit.feedback(`Right. With <code>handle_unknown="ignore"</code> an unseen value gets all zeros in that column's one-hot block: the model treats the subscriber as “none of the payment methods it knows” and uses the other columns. Refitted on October and saved again, the rerun printed:${out(kit, [`subscribers scored: ${NOV_FIXED.scored}`, `flagged (risk over 0.5): ${NOV_FIXED.flagged}`])}It is a stopgap, not a cure: the model knows nothing about e-wallet payers. Once some of them have stayed or left, retrain with them in the data.`, true)
          : `<p class="task">${q.task}</p><div class="lpanel">${kit.options(q.opts, { picked: ans, correct: q.right })}${ans == null ? "" : kit.feedback(q.fb[ans], false)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; }
        paint();
        if (stage === 2) done();
      });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "It loads and works the same: a saved file is just data",
      "Loading across versions is not supported: it may warn, give different results or crash. Pin the version, or retrain",
      "joblib converts the file to the new version automatically"
    ];
    const RIGHT = 1;
    const fb = [
      "The file holds Python objects whose insides belong to one scikit-learn version. The docs say there is no supported way to load it in another version.",
      null,
      "There is no conversion. The docs say loading in another version is unsupported, and scikit-learn raises an <code>InconsistentVersionWarning</code> when the versions differ."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a pipeline</h1>
        <p class="lead"><b>What it is:</b> the preparation steps and the model as one object, fitted, tuned and saved as a whole, so preparing and predicting cannot drift apart.</p>
        <p class="lead"><b>Reach for it</b> for any model on a table that needs preparing, and always when you cross-validate or tune, or when someone else will rerun or serve the model.</p>
        <p class="lead"><b>Not</b> for a one-off chart with no model. Not for deep learning, which scikit-learn's own FAQ calls out of scope (PyTorch, next stage). Tree models such as <code>HistGradientBoostingClassifier</code> need a shorter pipeline: they handle blanks themselves, and a tree's threshold questions do not care about a column's scale.</p>
        <p class="lead"><b>Costs:</b> a search refits everything for every value and every fold (${SEARCH_FITS} fits here). The saved file is tied to its scikit-learn version. Load pickle files only from people you trust.</p>
        <p class="task">The colleague's laptop has a newer scikit-learn than the one <code>churn_model.joblib</code> was saved with. What should he expect?</p>
        <div class="lpanel">${ans === RIGHT ? `${kit.options(opts, { picked: ans, correct: RIGHT })}${kit.feedback("Right. So the hand-over is more than the file: the script that trains it, a pinned list of package versions, which data it was trained on, and its cross-validation score. Then anyone can rebuild it in a new version and check they got the same score.", true)}` : ask(kit, opts, RIGHT, ans, fb.map(t => [t, false]))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A farm co-op predicts each field's grain harvest. The table has blanks in rainfall, a soil type picked from a short list, and field sizes and fertiliser amounts in very different ranges. The model is retrained every quarter by whoever is on duty.", true,
      "Yes. Several columns need steps that learn numbers (fill values, categories, scales), and someone else retrains and runs it. One fitted object keeps preparing and predicting in step.",
      "Fill values, category lists and scales are all learned from data here, and a different person retrains it each quarter. A pipeline keeps those steps fitted with the model and saved with it."],
    ["A marketing analyst wants one bar chart for a meeting: the average monthly bill for each contract type, from last month's table.", false,
      "No. Nothing is trained or scored, so nothing can leak and nothing needs rerunning as a model. A pandas group-by and a chart are enough.",
      "A pipeline joins learned preparation to a model. Here there is no model and no test set: averaging bills per group is a pandas group-by."],
    ["A researcher picks the number of neighbours for a k-nearest-neighbours model with 10-fold cross-validation. Distances only make sense after the columns are scaled.", true,
      "Yes. The scaler must be refitted inside each fold, or every fold's scaler has seen the rows it is scored on. Put scaler and model in one pipeline and tune it.",
      "Tuning with cross-validation is exactly where fitting the scaler once, on all rows, leaks into every fold. The scaler belongs inside the pipeline that is tuned."],
    ["A team fine-tunes an image classifier on photos of damaged phone screens, on a GPU, with PyTorch.", false,
      "No. scikit-learn's FAQ says deep learning is out of its scope. PyTorch has its own way to load batches and run a training loop on a GPU. The idea, preparing with numbers learned from training data only, still applies there.",
      "scikit-learn pipelines are built for tables that fit in memory and models with fit and predict. Training a deep network on a GPU is out of scikit-learn's scope, per its own FAQ; PyTorch handles that."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Pipeline or not?</h1>
        <p class="lead">Four jobs from other teams.</p>
        <p class="task">Would you build each one as a scikit-learn pipeline? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and its checklist. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s2-sklearn-pipeline.ipynb";
  const CHECKS = [
    `<code>cross_val_score</code> prints ${CV_FOLDS.length} accuracies between ${Math.min(...CV_FOLDS)} and ${Math.max(...CV_FOLDS)}`,
    `The scaler counter prints ${CV_FITS} after cross-validation and ${SEARCH_FITS} after the grid search`,
    `The search picks <code>{'model__C': ${BEST.C}}</code> with cross-validation accuracy ${BEST.cv}, and the test rows give ${TEST_ACC}`,
    `<code>get_feature_names_out()</code> lists ${FEATURES.length} columns, each starting with <code>numbers__</code> or <code>categories__</code>`,
    `Scoring November with the default encoder raises <code>ValueError</code> naming '${UNKNOWN}'; with <code>handle_unknown="ignore"</code> all ${NOV_FIXED.scored} subscribers are scored`
  ];
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can hand the model over</h1>
      <p class="lead">You found a scaler fitted before the split, saw that the score did not move and why the order still matters, wrote fit-on-train, transform-everywhere by hand, then built it with ColumnTransformer, Pipeline and GridSearchCV, and fixed next month's crash.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-link" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook in Colab</a> and run it top to bottom.` : "The notebook for this lesson is on its way."} What you should see when you run it:</p>
      <ul class="lx-${ID}-check">${CHECKS.map(c => `<li><label><input type="checkbox"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Classic models end here; next you build the unit a neural network is made of, and the pipeline habit (learn from training rows only) comes with you.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "scikit-learn pipelines from raw table to model",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/common_pitfalls.html",
      "https://scikit-learn.org/stable/modules/compose.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.compose.ColumnTransformer.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.OneHotEncoder.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GridSearchCV.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html",
      "https://scikit-learn.org/stable/model_persistence.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingClassifier.html",
      "https://scikit-learn.org/stable/faq.html"
    ],
    interview: [
      {
        q: "Your churn model scored well in the notebook, but a month after release its predictions look off. The notebook filled blanks and scaled columns on the whole table before splitting. What do you check and what do you change?",
        good: [
          "Check the order: any step that learns numbers (fill values, scaling, encoding, column selection) must be fitted on training rows only",
          "Move every preparation step into a Pipeline with the model, and cross-validate the whole pipeline so each fold refits it",
          "Compare the cross-validation score with an untouched test set; they should roughly agree",
          "Check the new data for things training never saw: new category values, new blanks, columns in other units",
          "Save and serve the fitted pipeline, not the bare model, so production prepares rows exactly as training did"
        ],
        weak: "Retrain on more data or try a stronger model, without checking whether preparation learned from the test rows or whether production prepares rows differently."
      },
      {
        q: "A colleague must rerun your scikit-learn model every month without you. What do you hand over, and what can break?",
        good: [
          "One fitted Pipeline file, so preparing and predicting cannot drift apart",
          "The training script, pinned package versions and a reference to the training data: loading a saved model in another scikit-learn version is not supported",
          "Decide how unseen categories are handled (for example OneHotEncoder with handle_unknown=\"ignore\") and plan to retrain when new values become common",
          "The cross-validation score, so a rebuilt model can be checked against it",
          "Only load pickle or joblib files from a trusted source"
        ],
        weak: "Send the .joblib file and say “call predict”. That misses version pinning, new categories in next month's data and how to rebuild it."
      }
    ],
    screens: [findBug, predictFix, spotIdea, predictSteps, scratchCode, routeColumns, tune, nextMonth, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: COLS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
