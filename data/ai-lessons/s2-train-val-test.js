/* Lesson: train, validation and test sets, and cross-validation. Story: a language school predicts which
   students will pass the final exam, and its data teacher must convince the director the score is real.
   Ideas: (1) score a model only on rows it never learned from, and one small hold-out score swings with the
   shuffle, so rotate the scored part (k-fold cross-validation) and report the mean and the spread;
   (2) rows used to choose a setting cannot also give the final score: choose with cross-validation on the
   dev rows (they play the validation set), then score the untouched test rows once.
   Data, all real, from runs on this Mac (scikit-learn 1.9.1, see env.txt):
   - docs/ai-path/runs/s2-train-val-test/school_data.py: the generator of the invented school's students
     (120 past students, seed 7; 5000 "next year" students, seed 99, standing in for the future);
   - experiments.py + experiments.out.txt: every score on screen;
   - trace_honest.py + trace_honest.out.txt: the line-by-line trace of honest_score on the code screen.
   No model API calls. Lesson-local style: small fold list and output block (.lx-s2-train-val-test-*). */
(() => {
  const ID = "s2-train-val-test";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s2-train-val-test.ipynb";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const pc = v => `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
  const pts = d => `${(Math.round(Math.abs(d) * 1000) / 10).toFixed(1)}`;
  const gap = d => (Math.abs(d) * 100).toFixed(2); // gaps are stored to 4 places, so show 2 places of points

  /* ---------- Data copied from docs/ai-path/runs/s2-train-val-test/experiments.out.txt ---------- */
  const RUN = {
    pastRows: 120, pastPassed: 55, nextRows: 5000,
    columns: 30,                       // school_data.py: attendance, homework, mock_exam + 27 other columns
    ownRows: 0.8917, nextYear: 0.79,   // own_rows_accuracy, next_year_accuracy
    holdout: [0.8333, 0.8, 0.7667, 0.7667, 0.8667, 0.7, 0.7333, 0.8, 0.8333, 0.8], // holdout_splits[seed 0..9].test_accuracy
    holdoutTrain: 90, holdoutTest: 30,
    splitter: "StratifiedKFold",       // cv_splitter_for_cv5_classifier
    folds: [0.8333, 0.6667, 0.8333, 0.8333, 0.6667], // cv5_fold_scores
    foldMean: 0.7667, foldStd: 0.0816,
    foldTrain: 96, foldScored: 24,     // cv5_folds
    first20: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0],   // first20_passed
    foldOf: [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 2, 3, 3, 3, 4, 4, 4, 4],    // first20_fold_of_row
    knobs: [0.01, 0.1, 1, 10],
    perKnob: [                         // per_knob_split0
      { knob: 0.01, cv: 0.6667, test: 0.8, next: 0.7158 },
      { knob: 0.1, cv: 0.7556, test: 0.8333, next: 0.7746 },
      { knob: 1, cv: 0.7444, test: 0.8333, next: 0.7848 },
      { knob: 10, cv: 0.7444, test: 0.7333, next: 0.7744 }
    ],
    honest: { knob: 0.1, cv: 0.7556, test: 0.8333, dev: 90, test_rows: 30 },
    repeats: 200, gapPeek: 0.0425, gapHonest: -0.0053, abovePeek: 0.755, aboveHonest: 0.44
  };
  // Invented first names for the first 20 rows of the generated data (the data has no names).
  const NAMES = ["Amira", "Ben", "Chloe", "Dev", "Elif", "Farid", "Grace", "Hugo", "Ines", "Jonas", "Kaya", "Leo", "Maya", "Nils", "Omar", "Priya", "Quinn", "Rosa", "Sami", "Tara"];
  const FOLD = ["A", "B", "C", "D", "E"];

  // honest_score from docs/ai-path/runs/s2-train-val-test/trace_honest.py, line for line (line 0 = def)
  const CODE = [
    "def honest_score(students, passed):",
    "    dev_X, test_X, dev_y, test_y = train_test_split(",
    "        students, passed, test_size=0.25, stratify=passed, random_state=0)",
    "    best_knob, best_cv = None, 0",
    "    for knob in KNOBS:",
    "        model = make_model(knob)",
    "        cv = cross_val_score(model, dev_X, dev_y, cv=5).mean()",
    "        if cv > best_cv:",
    "            best_knob, best_cv = knob, cv",
    "    final = make_model(best_knob).fit(dev_X, dev_y)",
    "    return best_knob, best_cv, final.score(test_X, test_y)"
  ];
  // trace_honest.out.txt rows: [line about to run, event (l/r), dev_X, test_X, best_knob, best_cv, knob, cv]
  const TRACE = [[1,"l",null,null,null,null,null,null],[2,"l",null,null,null,null,null,null],[1,"l",null,null,null,null,null,null],[3,"l",90,30,null,null,null,null],[4,"l",90,30,"None",0,null,null],[5,"l",90,30,"None",0,0.01,null],[6,"l",90,30,"None",0,0.01,null],[7,"l",90,30,"None",0,0.01,0.6667],[8,"l",90,30,"None",0,0.01,0.6667],[4,"l",90,30,0.01,0.6667,0.01,0.6667],[5,"l",90,30,0.01,0.6667,0.1,0.6667],[6,"l",90,30,0.01,0.6667,0.1,0.6667],[7,"l",90,30,0.01,0.6667,0.1,0.7556],[8,"l",90,30,0.01,0.6667,0.1,0.7556],[4,"l",90,30,0.1,0.7556,0.1,0.7556],[5,"l",90,30,0.1,0.7556,1,0.7556],[6,"l",90,30,0.1,0.7556,1,0.7556],[7,"l",90,30,0.1,0.7556,1,0.7444],[4,"l",90,30,0.1,0.7556,1,0.7444],[5,"l",90,30,0.1,0.7556,10,0.7444],[6,"l",90,30,0.1,0.7556,10,0.7444],[7,"l",90,30,0.1,0.7556,10,0.7444],[4,"l",90,30,0.1,0.7556,10,0.7444],[9,"l",90,30,0.1,0.7556,10,0.7444],[10,"l",90,30,0.1,0.7556,10,0.7444],[10,"r",90,30,0.1,0.7556,10,0.7444]];
  const RETURNED = [0.1, 0.7556, 0.8333]; // trace_honest.out.txt "result"

  /* ---------- Derived from the data ---------- */
  const H_MIN = Math.min(...RUN.holdout), H_MAX = Math.max(...RUN.holdout);
  const F_MIN = Math.min(...RUN.folds), F_MAX = Math.max(...RUN.folds);
  const PEEK_BEST = Math.max(...RUN.perKnob.map(k => k.test));
  const PEEK_TIES = RUN.perKnob.filter(k => k.test === PEEK_BEST).length;
  const HONEST_NEXT = RUN.perKnob.find(k => k.knob === RUN.honest.knob).next;
  const K = FOLD.length;
  const ROWS20 = NAMES.length, PER_FOLD = ROWS20 / K;
  const foldRows = f => NAMES.map((n, i) => i).filter(i => RUN.foldOf[i] === f);
  const ONE_STUDENT = 1 / RUN.honest.test_rows;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-folds { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-folds li { display: grid; grid-template-columns: 4.5em 1fr; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .lx-${ID}-check li { grid-template-columns: 1.5em 1fr; }
      .lx-${ID}-folds b { font: 600 14px/1.45 var(--mono); }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--sunk); font: 500 14px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-code .lcode { overflow-x: visible; }
      .lx-${ID}-code .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + 10ch); text-indent: -10ch; }
      @media (max-width: 700px) { .lx-${ID}-code .lcode div { padding-left: calc(12px + 10ch); } }
      .lx-${ID}-link { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); }
      .lx-${ID}-claim { margin: 14px 0 0; padding: 10px 12px; border-left: 3px solid var(--ink); font-size: 16px; line-height: 1.5; }
    `;
    document.head.appendChild(s);
  }
  const out = (kit, s) => `<div class="lx-${ID}-out">${kit.esc(s)}</div>`;
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const wire = (el, fn) => el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => fn(+b.dataset.i));

  /* 1. The situation: a score measured on the rows the model learned from. */
  function claim({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [`About the same: close to ${pc(RUN.ownRows)}`, `Lower than ${pc(RUN.ownRows)}`, `Higher than ${pc(RUN.ownRows)}`];
    const fb = [
      [`That would be true only if next year's students were the same people. The model's weights were fitted to these ${RUN.pastRows} students, including their quirks. Asking it about them is like grading a student on the exact questions they practised.`, false],
      [`Right. On ${RUN.nextRows.toLocaleString("en")} new students from the same generator, the same model was right ${pc(RUN.nextYear)} of the time: ${pts(RUN.ownRows - RUN.nextYear)} percentage points lower (we say "points" from here on). The ${pc(RUN.ownRows)} measured how well the model fits the rows it learned from, not how well it predicts students it has never seen. The director's question is about the second.`, true],
      ["Nothing makes new students easier to predict than the ones the model was fitted to. If anything, the model has adapted to the old rows, so it usually does better on them than on anyone new.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Is ${Math.round(RUN.ownRows * 100)}% real?</h1>
        <p class="lead">A language school wants to know early which students are likely to fail the final exam, so teachers can help them in time. Mira, the teacher who handles the data, took ${RUN.pastRows} past students (${RUN.columns} columns each: attendance, homework done, mock exam score and more) and fitted the logistic regression you met in the last lesson.</p>
        <p class="lead">She scored it on the same ${RUN.pastRows} students (she counted how often its pass or fail guess was right) and wrote to the director:</p>
        <div class="lx-${ID}-claim">“The model predicts pass or fail correctly for ${pc(RUN.ownRows)} of students.”</div>
        <p class="lead">The director asks: will it be right that often for <b>next year's</b> class? The school and its students are invented; we generated them with a script, so we can also generate ${RUN.nextRows.toLocaleString("en")} “next year” students and check.</p>
        <p class="lead">Before you ship any model, you need a number that says how well it will do on new data. This lesson is about getting that number honestly.</p>
        <p class="task">Predict: on next year's students, the same model is right...</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 1) done(); });
    };
    paint();
  }

  /* 2. Spot the idea: one hold-out score depends on which rows landed in it. */
  function swing({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `Mira's colleague's ${pc(H_MAX)}: the better split shows what the model can do`,
      `Mira's ${pc(H_MIN)}: report the lower number to be safe`,
      "Neither alone. Which students land in the 30 changes the score, so rotate: let every student be scored once by a model that did not learn from them, and average",
      `The ${pc(RUN.ownRows)} from before: it uses all ${RUN.pastRows} students, so it is the most data`
    ];
    const fb = [
      [`Same model, same data, only the shuffle differed. A better split is not a better model; it is a luckier set of ${RUN.holdoutTest} students. Picking the higher one reports the luck.`, false],
      [`Also luck, just the unlucky kind. With ${RUN.holdoutTest} scored students, one student more or less right moves the score by ${pts(1 / RUN.holdoutTest)} points. The lower number is not safer, only further off in the other direction.`, false],
      [`Right. Ten shuffles gave ten scores, from ${pc(H_MIN)} to ${pc(H_MAX)}. Every one is honest (none was measured on rows the model learned from), but each sees only ${RUN.holdoutTest} students. Rotating the scored part uses every student for scoring once, and the spread between rotations tells you how much to trust the average.`, true],
      [`That number was measured on the rows the model learned from, which is the mistake from the first screen. More rows does not help if they are the wrong rows.`, false]
    ];
    const paint = () => {
      const shown = ans === 2;
      el.innerHTML = `<h1>Hold some students back</h1>
        <p class="lead">Mira fixes it: she shuffles the ${RUN.pastRows} students, trains on ${RUN.holdoutTrain}, and scores on the other ${RUN.holdoutTest}, which the model never saw. This is a <b>hold-out</b> score. She gets <b>${pc(H_MIN)}</b>. A colleague runs the same code with a different shuffle and gets <b>${pc(H_MAX)}</b>.</p>
        ${shown ? kit.bars(RUN.holdout.map(v => Math.round(v * 100)), { labels: RUN.holdout.map((_, i) => String(i + 1)) }) + `<p class="lx-${ID}-cap">Test accuracy (%, rounded to whole points) for ten shuffles, numbered under each bar. From our run.</p>` : ""}
        <p class="task">The director wants one number. Which do you give?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 2) done(); });
    };
    paint();
  }

  /* 3. By hand: five folds, five rounds, every student scored once. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    const scored = [0, null, null, null, null]; // round -> fold scored; round 1 is given
    let bad = null; // [round, fold] of the last wrong pick
    const complete = () => scored.every(f => f != null) && new Set(scored).size === K;
    const paint = () => {
      const rows = scored.map((f, r) => FOLD.map((_, c) => (f === c ? "score" : f == null ? "" : "train")));
      const cls = {};
      scored.forEach((f, r) => { if (f != null) cls[`${r},${f}`] = "in"; });
      if (bad) { rows[bad[0]][bad[1]] = "score"; cls[`${bad[0]},${bad[1]}`] = "no"; }
      const fin = complete();
      let fbHtml = "";
      if (bad) {
        const r0 = scored.findIndex((f, r) => f === bad[1] && r !== bad[0]);
        const who = foldRows(bad[1]).map(i => NAMES[i]).join(", ");
        fbHtml = kit.feedback(`Fold ${FOLD[bad[1]]} (${kit.esc(who)}) is already scored in round ${r0 + 1}. Scoring it again means those ${PER_FOLD} students count twice, and with only ${K} rounds some other fold is never scored at all.`, false);
      } else if (fin) {
        const passes = FOLD.map((_, f) => foldRows(f).filter(i => RUN.first20[i]).length);
        fbHtml = kit.feedback(`Done. Each round trains on ${plural(ROWS20 - PER_FOLD, "student")} and is scored on the other ${PER_FOLD}. Each student is scored in exactly 1 round, by a model that never saw them, and is used for training in the other ${K - 1}. This is <b>${K}-fold cross-validation</b>; each group is a <b>fold</b>. Now look at the passes. The ${RUN.first20.filter(Boolean).length} students who passed were dealt ${passes.join(", ")} per fold. scikit-learn's <code>${RUN.splitter}</code> dealt them this way on purpose. This is called <b>stratified</b>: every fold gets a similar share of passes, so no fold is all fails.`, true);
      }
      el.innerHTML = `<h1>Rotate the scored part</h1>
        <p class="lead">Take the first ${ROWS20} students only. They are already dealt into ${K} folds of ${PER_FOLD}:</p>
        <ul class="lx-${ID}-folds">${FOLD.map((F, f) => `<li><b>Fold ${F}</b><span>${foldRows(f).map(i => `${kit.esc(NAMES[i])} (${RUN.first20[i] ? "pass" : "fail"})`).join(", ")}</span></li>`).join("")}</ul>
        <p class="lead">In each round, one fold is scored and the model trains on the rest. Round 1 scores fold A.</p>
        <p class="task">For rounds 2 to ${K}, tap the fold that round scores, so that every student is scored exactly once.</p>
        ${kit.pics.grid(rows, { cls, rowHead: scored.map((_, r) => `R${r + 1}`), colHead: FOLD, pick: (r) => r > 0, title: "round × fold" })}
        ${kit.pics.key([["in", "scored this round"], ["", "train = learned from this round"]])}
        <div class="lpanel">${fbHtml}</div>`;
      el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
        const [r, c] = b.dataset.i.split(",").map(Number);
        if (r === 0) return;
        if (scored.some((f, rr) => f === c && rr !== r)) { bad = [r, c]; paint(); return; }
        bad = null; scored[r] = c; paint();
        if (complete()) done();
      });
    };
    paint();
  }

  /* 4. Use it on all 120 students, with predictions. */
  function useIt({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null; // stage 0: predict rows per round; 1: predict which number is closest; 2: done
    const Q1 = [RUN.foldScored, RUN.foldTrain, RUN.pastRows];
    const fb1 = {
      [RUN.foldScored]: `${RUN.foldScored} is the fold that is scored. The model learns from all the others.`,
      [RUN.pastRows]: `Then the scored ${RUN.foldScored} would also be in the training rows, and you are back to grading on rows it learned from.`
    };
    const nums = [["the score on its own rows", RUN.ownRows], ["the best fold", F_MAX], ["the mean of the five folds", RUN.foldMean], ["the worst fold", F_MIN]];
    const fb2 = [
      `That is the ${pc(RUN.ownRows)} from the first screen, measured on rows the model learned from. It was ${pts(RUN.ownRows - RUN.nextYear)} points above next year.`,
      `One fold is ${RUN.foldScored} students; picking the best one is picking the luckiest ${RUN.foldScored}. It is the same mistake as reporting the better shuffle.`,
      null,
      `The worst fold is as much luck as the best one, just in the other direction.`
    ];
    const paint = () => {
      const q1Done = stage >= 1;
      el.innerHTML = `<h1>Five folds on all ${RUN.pastRows}</h1>
        <p class="lead">Mira runs the same idea on all ${RUN.pastRows} students with scikit-learn. <code>make_model()</code> is her logistic regression with a scaler in front (the scaler puts every column on a similar scale before the model sees it):</p>
        ${kit.code(["fold_scores = cross_val_score(", "    make_model(), students, passed, cv=5)"], -1)}
        ${!q1Done ? `<p class="task">${RUN.pastRows} students, 5 folds. How many students does each round's model train on?</p>
          <div class="lpanel">${kit.options(Q1.map(String), { picked: wrong == null ? null : Q1.indexOf(wrong), correct: 1, num: true })}${wrong != null ? kit.feedback(fb1[wrong], false) : ""}</div>`
          : `<p class="lead">Each round trains on ${RUN.foldTrain} and scores ${RUN.foldScored}. The five fold scores from our run:</p>
          ${out(kit, `fold_scores  ${RUN.folds.map(v => v.toFixed(4)).join("  ")}`)}
          ${stage === 1 ? `<p class="task">Next year's real accuracy was ${pc(RUN.nextYear)}. Which number should land closest to it?</p>` : ""}
          <div class="lpanel">${stage === 1 ? kit.options(nums.map(([n, v]) => `${n}: ${pc(v)}`), { picked: wrong, correct: 2 }) + (wrong != null ? kit.feedback(fb2[wrong], false) : "")
            : kit.feedback(`Right. The mean, ${pc(RUN.foldMean)}, is ${pts(RUN.foldMean - RUN.nextYear)} points from next year's ${pc(RUN.nextYear)}. The folds ranged from ${pc(F_MIN)} to ${pc(F_MAX)}; their standard deviation (the typical distance of a fold score from the mean) was ${pts(RUN.foldStd)} points. Report both: “about ${pc(RUN.foldMean)}, give or take ${pts(RUN.foldStd)}”. The spread is the honest size of the doubt. With a classifier, <code>cv=5</code> deals stratified folds, as on the last screen. One catch: it does <b>not</b> shuffle the rows first unless you pass a splitter with <code>shuffle=True</code>.`, true)}</div>`}`;
      wire(el, i => {
        if (stage === 0) { const v = Q1[i]; if (v !== RUN.foldTrain) { wrong = v; paint(); return; } wrong = null; stage = 1; paint(); return; }
        if (stage === 1) { if (i !== 2) { wrong = i; paint(); return; } wrong = null; stage = 2; paint(); done(); }
      });
    };
    paint();
  }

  /* 5. Spot the second idea: choosing on the test rows makes the test score too rosy. */
  function peek({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The models were trained on the test students, so they already knew them",
      `The test students were used to choose. Among ${RUN.knobs.length} settings, the winner is partly the one that happened to suit these ${RUN.honest.test_rows} students, and that luck is now inside the score`,
      `Comparing ${RUN.knobs.length} settings is too many; she should have tried one`,
      "The setting makes the test harder, so the score is unfair"
    ];
    const fb = [
      `No model saw a test student while learning: each was fitted on the ${RUN.honest.dev} other students only. The leak is not in the training; it is in the choice.`,
      [`Right. Once you use a score to choose, it is no longer a fresh measurement. We repeated Mira's experiment with ${RUN.repeats} different shuffles. Reporting the best of ${RUN.knobs.length} on the test rows came out on average ${gap(RUN.gapPeek)} points above that model's real next-year accuracy, and was above it in ${pc(RUN.abovePeek)} of shuffles. Choosing with cross-validation on the ${RUN.honest.dev} other rows, then scoring the test rows once, came out on average ${gap(RUN.gapHonest)} points ${RUN.gapHonest > 0 ? "above" : "below"} it, and was above it in ${pc(RUN.aboveHonest)} of shuffles: sometimes high, sometimes low, not tilted. The rows you choose with are called the <b>validation set</b>; here cross-validation on the ${RUN.honest.dev} rows plays that part. The <b>test set</b> is kept for one final score.`],
      "Comparing settings is normal and useful. What matters is which rows you compare them on. Compare on rows that will not give the final score.",
      `The ${RUN.honest.test_rows} test students are the same for every setting. Nothing about the setting changes the questions; it changes the model.`
    ].map((x, i) => (i === 1 ? [x[0], true] : [x, false]));
    const paint = () => {
      el.innerHTML = `<h1>Choosing with the test rows</h1>
        <p class="lead">Logistic regression has a setting called <code>C</code>; what it does is a later lesson. Here it is just a knob with ${RUN.knobs.length} positions. Mira holds back ${RUN.honest.test_rows} test students, trains one model per knob position on the other ${RUN.honest.dev}, and scores each on the test students:</p>
        ${kit.table(RUN.perKnob.map(k => [`C = ${k.knob}`, pc(k.test)]), { head: ["knob", "test accuracy"], title: "Our run, the same 30 test students each time", hit: RUN.perKnob.findIndex(k => k.test === PEEK_BEST) })}
        <p class="lead">She keeps the best (${PEEK_TIES > 1 ? `${PEEK_TIES} settings tie at ` : ""}${pc(PEEK_BEST)}) and reports ${pc(PEEK_BEST)} as the model's accuracy.</p>
        <p class="task">Every model was scored on students it never trained on. So why is ${pc(PEEK_BEST)} still too rosy?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 1) done(); });
    };
    paint();
  }

  /* 6. The three-way protocol in Python: a stepped replay of the traced run. */
  const FR = TRACE.filter((_, k) => k !== 1 && k !== 2).map(([ln, ev, dev, test, bk, bcv, knob, cv]) => ({ ln, end: ev === "r", dev, test, bk, bcv, knob, cv }));
  const say = (f, i) => {
    const v = x => (x == null ? "–" : String(x));
    if (f.end) return `It returns <code>(${RETURNED.join(", ")})</code>: the knob CV chose, its CV score on the dev rows (${pc(RETURNED[1])}), and the test score (${pc(RETURNED[2])}), measured once, at the very end. This is the number for the director, with its size: ${RUN.honest.test_rows} students.`;
    if (f.ln === 1) return `Lines 1–2 split the ${RUN.pastRows} students once: <code>test_size=0.25</code> puts ${RUN.honest.test_rows} aside, <code>stratify=passed</code> keeps the same share of passes in both parts, <code>random_state=0</code> fixes the shuffle so a re-run gives the same split.`;
    if (f.ln === 3) return `${f.dev} dev students and ${f.test} test students. From here until line 10, nothing reads <code>test_X</code> or <code>test_y</code>.`;
    if (f.ln === 4) return f.bk === "None" ? "The loop tries each knob position in turn." : `Back to the top: best so far is <code>C = ${v(f.bk)}</code> with ${pc(f.bcv)}.`;
    if (f.ln === 5) return `<code>knob = ${v(f.knob)}</code>. A fresh, untrained model with this setting.`;
    if (f.ln === 6) return `Line 6 runs 5-fold cross-validation on the ${f.dev} dev students only: 5 trainings, 5 scores, and their mean.`;
    if (f.ln === 7) return `The mean for <code>C = ${v(f.knob)}</code> is ${pc(f.cv)}. Best so far: ${f.bk === "None" ? "none yet" : `${pc(f.bcv)}`}. ${f.cv > f.bcv ? "Higher, so line 8 runs." : "Not higher, so it is skipped."}`;
    if (f.ln === 8) return `<code>C = ${v(f.knob)}</code> becomes the best so far.`;
    if (f.ln === 9) return `All ${RUN.knobs.length} tried. CV chose <code>C = ${v(f.bk)}</code> (${pc(f.bcv)}). Line 9 trains it once more on all ${f.dev} dev students.`;
    if (f.ln === 10) return `Line 10 touches the test students for the first and only time.`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>Split three ways, in Python</h1>
        <p class="lead">Mira's whole honest procedure. The <b>dev</b> rows (short for development) are the students left after the test students are put aside. <b>CV</b> is short for cross-validation. <code>KNOBS</code> is the list of ${RUN.knobs.length} knob values; <code>make_model(knob)</code> builds the scaler plus logistic regression with <code>C=knob</code>. This replays our real run.</p>
        <p class="task">Step through to the end. Watch when the test students are first used.</p>
        <div class="lx-${ID}-code">${kit.code(CODE, f.ln)}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>knob <b>${f.knob == null ? "–" : f.knob}</b></span><span>cv <b>${f.cv == null ? "–" : pc(f.cv)}</b></span><span>best_knob <b>${f.bk == null ? "–" : f.bk}</b></span><span>best_cv <b>${f.bcv == null ? "–" : pc(f.bcv)}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(say(f, i))}
        ${i === FR.length - 1 ? `<p class="lead">Three ways: <b>train</b> (the folds a model learns from), <b>validation</b> (the scored fold inside the dev rows, used to choose), <b>test</b> (used once). With cross-validation you do not need a separate fixed validation set; you still keep the test set apart.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. Which score goes in the report. */
  function report({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `“${pc(RUN.ownRows)}, measured on all ${RUN.pastRows} students.”`,
      `“${pc(PEEK_BEST)}, the best of ${RUN.knobs.length} settings on ${RUN.honest.test_rows} held-back students.”`,
      `“${pc(RUN.honest.test)} on ${RUN.honest.test_rows} students who took no part in training or choosing. With ${RUN.honest.test_rows} students, one student moves it by ${pts(ONE_STUDENT)} points; cross-validation on the other ${RUN.honest.dev} gave ${pc(RUN.honest.cv)}.”`,
      `“${pc(RUN.honest.cv)}, the cross-validation score of the setting we chose.”`
    ];
    const fb = [
      ["Measured on the rows the model learned from. It answers “how well does it fit the past”, not the director's question.", false],
      [`The test students were used to choose, so this is the winner of a contest held on them. In our ${RUN.repeats} repeats this kind of number was too high ${pc(RUN.abovePeek)} of the time.`, false],
      [`Right. The test students played no part in any decision, so the score is not tilted. Saying how many students it rests on, and putting the CV score next to it, shows how much it can wobble. Here the test score happens to be high: the chosen model's next-year accuracy was ${pc(HONEST_NEXT)}. An honest number on ${RUN.honest.test_rows} students can still be lucky; that is why you state its size.`, true],
      ["Useful evidence, but this score is the best of four, picked on the same dev rows. scikit-learn's own docs warn that choosing a setting by a CV score and then reporting that same score is optimistic. Report the untouched test score, with this beside it.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The number for the director</h1>
        <p class="lead">Mira has four numbers from the runs you have seen. Two of them are the same, ${pc(PEEK_BEST)}, but they were made in different ways.</p>
        <p class="task">Which sentence goes in the report?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 2) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Each model trains on fewer students",
      `${K} trainings instead of 1 (and ${K} per setting when you choose a knob)`,
      "It uses up the test set"
    ];
    const fb = [
      [`The other way round: each fold's model trains on more students, ${RUN.foldTrain} of ${RUN.pastRows}, against ${RUN.holdoutTrain} for the hold-out model.`, false],
      [`Right. Cross-validation's price is compute: here ${K} trainings per score, so ${K * RUN.knobs.length} to compare ${RUN.knobs.length} knob settings, plus one final fit. With a tiny logistic regression that is nothing; with a model that takes hours to train it decides the plan.`, true],
      ["Cross-validation only reshuffles the rows it is given. Run it on the dev rows and the test rows stay untouched.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <ul class="lx-${ID}-folds">
          <li><b>What</b><span>k-fold cross-validation scores every fold in turn and averages, so no single lucky split decides the number.</span></li>
          <li><b>For</b><span>Any claim that a model will work on new data. Always hold out a test set, and touch it once. Use k-fold when data is small and one hold-out swings, like Mira's ${RUN.pastRows} students.</span></li>
          <li><b>Not</b><span>Not plain shuffled folds when rows are ordered in time: train on the past, score on the future (e.g. <code>TimeSeriesSplit</code>). Not when one person has several rows: keep each person in one fold (e.g. <code>GroupKFold</code>). With a very large dataset, one big hold-out is already steady.</span></li>
          <li><b>Costs</b><span>Training time times k, and the test rows you cannot learn from.</span></li>
        </ul>
        <p class="task">Compared with one 75/25 hold-out, what does 5-fold cross-validation cost Mira?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it: is plain shuffled k-fold the right check? */
  const CASES = [
    ["A clinic has 300 labelled skin photos, one per patient, and wants to know how accurate a classifier is before a trial.", true,
      "Yes. 300 rows is small, so one hold-out swings. One row per patient means no person can sit in both training and scoring. Average over folds, and keep a test set apart if you also tune settings.",
      "With only 300 rows, a single hold-out of 60 moves a lot with the shuffle, and each patient appears once, so shuffled folds are safe. This is the case k-fold is for."],
    ["A bakery predicts tomorrow's bread sales from three years of daily sales.", false,
      "No. Shuffled folds would train on days after the days they score, so the model learns from the future it is meant to predict, and the score looks better than it will be. Split by time: train on earlier days, score on later ones.",
      "The rows are ordered in time and next to each other they are alike. A shuffled fold scores a Tuesday with the Monday and Wednesday around it in training. That is not how the model will be used: it will only ever have the past."],
    ["A voice-command model: 50 speakers recorded 40 commands each. It must work for new speakers.", false,
      "No. Shuffled folds put the same speaker's commands in training and in scoring, so the model is scored partly on voices it already knows. Keep each speaker's commands in one fold (group-wise folds).",
      "Each speaker has 40 rows. Shuffled, almost every fold mixes a speaker's commands between training and scoring, which measures “known voices”, not new speakers. Group the folds by speaker."],
    ["A gym with 800 members, one row each, wants a churn model and must choose between three settings.", true,
      "Yes. Hold out a test set, choose the setting with k-fold on the rest, then score the test set once: the same protocol as Mira's.",
      "Members are independent rows and the data is small, so k-fold on the dev rows is the right way to choose a setting, with a test set kept for the final score."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Plain k-fold or not?</h1>
        <p class="lead">Four other jobs. Plain k-fold here means: shuffle the rows, cut them into folds, score each fold with a model trained on the rest.</p>
        <p class="task">Is plain shuffled k-fold the right way to score each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and the next lesson. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const checks = [
      `The accuracy on the ${RUN.pastRows} training students prints ${RUN.ownRows.toFixed(4)}, higher than every fold score.`,
      `Ten 75/25 shuffles give test scores between ${H_MIN.toFixed(4)} and ${H_MAX.toFixed(4)}.`,
      `<code>cross_val_score(..., cv=5)</code> returns ${K} numbers, each from ${RUN.foldScored} scored students; their mean is ${RUN.foldMean.toFixed(4)}.`,
      `<code>honest_score</code> chooses <code>C = ${RUN.honest.knob}</code> and returns the test score ${RUN.honest.test.toFixed(4)}, measured once, at the end.`,
      `Over ${RUN.repeats} shuffles, picking the knob on the test rows is on average ${RUN.gapPeek > 0 ? "+" : ""}${RUN.gapPeek.toFixed(4)} above next year's accuracy; the honest procedure is ${RUN.gapHonest > 0 ? "+" : ""}${RUN.gapHonest.toFixed(4)}.`
    ];
    el.innerHTML = `<h1>You can defend the score</h1>
      <p class="lead">You saw a score on the training rows overstate the future, a single hold-out swing with the shuffle, rotated folds by hand, and kept the test rows out of every choice so the final number is not tilted.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-link" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook in Colab</a>.` : "The notebook for this lesson is on its way."} It runs the same code on the same generated students. What you should see:</p>
      <ul class="lx-${ID}-folds lx-${ID}-check">${checks.map(c => `<li><span aria-hidden="true">☐</span><span>${c}</span></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. An honest split is not enough when a column already contains the answer; next you find such a column.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Train, validation and test sets, and cross-validation",
    checked: "2026-11-13",
    sources: [
      "https://scikit-learn.org/stable/modules/cross_validation.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.cross_val_score.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.train_test_split.html",
      "https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html"
    ],
    interview: [
      {
        q: "A teammate reports 94% accuracy for a churn model and says they tried a dozen settings and kept the one that scored best on the test set. The product manager wants to ship. What do you say, and what do you do?",
        good: [
          "The test set was used to choose, so 94% includes the luck of fitting those test rows; it is optimistic",
          "Choose settings with cross-validation (or a validation set) on the training part only",
          "Score the chosen model once on a test set that played no part in any choice; if none is left, collect fresh rows for a new test set",
          "Report the score with how many rows it rests on and the spread across folds",
          "Check the split matches use: split by time or by customer if rows are ordered or repeated"
        ],
        weak: "Say 94% is fine because the model never trained on the test rows. That misses that choosing on the test rows leaks them into the decision."
      },
      {
        q: "You have 300 labelled examples. An 80/20 split gives 0.81; after reshuffling it gives 0.74. Your manager asks which one is right. How do you answer?",
        good: [
          "Neither alone: a 60-row test set swings with which rows land in it",
          "Run k-fold cross-validation, stratified for a classifier, and report the mean and the spread",
          "Keep a final test set apart if you are also tuning settings",
          "Check whether rows are independent; time order or repeated people need a different split"
        ],
        weak: "Report the better split, or rerun until two splits agree. That reports luck, not the model."
      }
    ],
    screens: [claim, swing, byHand, useIt, peek, asCode, report, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="1,0"]'], right: ['[data-i="1,1"]', '[data-i="2,2"]', '[data-i="3,3"]', '[data-i="4,4"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
