/* Lesson: data leakage. Story: a hospital's 30-day readmission model scores 99% until someone asks when the
   "discharge follow-up booked" field is filled in. Ideas: (1) a column whose value is only known after the
   outcome leaks the answer, and a held-out test set does not catch it, because the leak is in the test rows
   too; the check is "would this value be known at the moment of prediction?"; (2) a step (here feature
   selection) fitted on all rows before cross-validation leaks too; the fix is a Pipeline, refitted per fold.
   Data, all real runs on simulated data (no model API calls in this lesson):
   - docs/ai-path/runs/s2-leakage/leak_runs.py + leak_runs.out.txt (seed 0): the simulated discharge table
     (2,000 rows), scores with and without followup_booked, the "day of discharge" replay, and the pilot study
     (100 patients, 2,000 random-noise markers) with selection before and inside cross-validation.
   - docs/ai-path/runs/s2-leakage/env.txt: Python 3.12.11, NumPy 2.5.4, scikit-learn 1.9.1.
   Lesson-local style: column and code-line option text, a small output block (.lx-s2-leakage-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s2-leakage";
  const pct = v => `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from docs/ai-path/runs/s2-leakage/leak_runs.out.txt ---------- */
  const ROWS = 2000, TEST_N = 400, TEST_YES = 110, TRAIN_N = 1600;
  const LEAK = { cvMean: 0.9944, cvFolds: [0.9938, 0.9938, 0.9969, 0.9938, 0.9938], test: 0.985, caught: 109 };
  const ALONE_FOLLOWUP = 0.9944; // "alone followup_booked"
  const CROSS = { yes: { rows: 443, back: 438 }, no: { rows: 1157, back: 4 } }; // training rows
  const WARD = { flagged: 0, caught: 0, accuracy: 0.725 }; // "ward_day with_leak"
  const HONEST = { cvMean: 0.7969, cvFolds: [0.7875, 0.7688, 0.7937, 0.8063, 0.8281], test: 0.775, caught: 49 };
  const PILOT = { rows: 100, cols: 2000, yes: 52, k: 20 };
  const STEP_LEAK = { printed: "0.8699999999999999", folds: [1.0, 0.85, 1.0, 0.75, 0.75] };
  const STEP_FIXED = { printed: "0.45", folds: [0.3, 0.5, 0.35, 0.55, 0.55] };

  // The listings are the lines in leak_runs.py under "--- broken" and "--- fixed", unchanged.
  const BROKEN = [
    "selector = SelectKBest(f_classif, k=20)",
    "markers_best = selector.fit_transform(markers, readmitted)",
    "model = LogisticRegression(max_iter=1000)",
    "scores = cross_val_score(model, markers_best, readmitted, cv=5)",
    "print(scores.mean())"
  ];
  const FIXED = [
    "pipe = make_pipeline(",
    "    SelectKBest(f_classif, k=20),",
    "    LogisticRegression(max_iter=1000))",
    "scores = cross_val_score(",
    "    pipe, markers, readmitted, cv=5)",
    "print(scores.mean())"
  ];

  // The columns as the data team described them (the descriptions are the lesson's setup, see leak_runs.py).
  const COLS = [
    ["age", "Age on the day of discharge."],
    ["prev_admissions", "Hospital stays in the 12 months before this one."],
    ["length_of_stay", "Days in hospital this time."],
    ["num_medications", "Medicines listed on the discharge letter."],
    ["lives_alone", "From the social-work form filled in on the ward."],
    ["followup_booked", "“Discharge follow-up booked”: yes if the clinic system shows a follow-up visit for the patient. Copied from the clinic system when the table was built, 30 days after each discharge."]
  ];
  const LEAK_COL = 5;

  /* ---------- Derived from the data ---------- */
  const TEST_NO = TEST_N - TEST_YES;
  const BASE = TEST_NO / TEST_N;
  const shareBack = c => c.back / c.rows;
  const PILOT_BASE = Math.max(PILOT.yes, PILOT.rows - PILOT.yes) / PILOT.rows;
  const PILOT_FOLD = PILOT.rows / 5;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-opt { display: block; text-align: left; font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-opt code { font: 600 14.5px var(--mono); }
      .lx-${ID}-line { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); font: 500 14px/1.5 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
    `;
    document.head.appendChild(s);
  }
  const colOpt = (kit, [name, desc]) => `<span class="lx-${ID}-opt"><code>${kit.esc(name)}</code> ${kit.esc(desc)}</span>`;
  const lineOpt = (kit, i, txt) => `<span class="lx-${ID}-line">${i + 1}  ${kit.esc(txt)}</span>`;
  const out = (kit, lines) => `<div class="lx-${ID}-out">${kit.esc(lines.join("\n"))}</div><p class="lx-${ID}-cap">Output of our run, ${RUN_DATE}</p>`;
  const RUN_DATE = "2026-11-13"; // the day leak_runs.py was run
  const CHECKED = "2026-11-14"; // the day the sources were re-read
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }
  const evalTable = kit => kit.table([
    ["5-fold cross-validation, mean accuracy", pct(LEAK.cvMean)],
    [`Held-out test set (${TEST_N} discharges)`, pct(LEAK.test)],
    ["Readmitted test patients it caught", `${LEAK.caught} of ${TEST_YES}`]
  ], { head: ["evaluation", "result"], title: "What the data team sent" });

  /* 1. The situation: a score that is too good. Find the floor first. */
  function tooGood({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["50.0%", pct(BASE), pct(TEST_YES / TEST_N), "0.0%"];
    const RIGHT = 1;
    const fb = [
      ["50% is a coin flip between two answers equally likely. Here they are not equally likely: most patients do not come back. Count the test rows that say “not readmitted”.", false],
      [`Right: ${TEST_NO} of ${TEST_N} test patients did not come back, so always saying “no” is right ${pct(BASE)} of the time and catches nobody. That is the floor. The model claims ${pct(LEAK.test)}, which means it is wrong on only ${Math.round((1 - LEAK.test) * TEST_N)} of ${TEST_N} patients. Whether a person comes back to hospital depends on what happens to them after they go home, and the table knows nothing about that. A score that close to perfect is a reason to look closer, not to celebrate.`, true],
      [`${pct(TEST_YES / TEST_N)} is the share who <i>did</i> come back (${TEST_YES} of ${TEST_N}). A model that always says “no” is right on the other ones.`, false],
      ["Always saying “no” is wrong only on the patients who came back. It is right on everyone else, and that is most of the test set.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A model that is too good</h1>
        <p class="lead">A hospital wants to know, on the day a patient goes home, who is likely to be back within 30 days (a <b>readmission</b>), so a nurse can call them first. The data team trained a classifier on ${ROWS.toLocaleString("en")} past discharges (a <b>discharge</b> is one patient leaving hospital) and sent this:</p>
        ${evalTable(kit)}
        <p class="lead">The director is delighted. You are not sure yet. This lesson is about how a score like this can be false before a model ever ships, and how to find out. (The table in this lesson is simulated: we generated it, so we know the truth about every column.)</p>
        <p class="task">The test set has ${TEST_N} discharges, and ${TEST_YES} of those patients came back. What accuracy does a “model” get that always answers “not readmitted”?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand: find the column that is only known after the outcome. */
  function markColumn({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const fb = [
      ["Age is written down when the patient arrives. It is known on the day of discharge, so the model may use it.", false],
      ["This one does help the model, and patients who were in hospital often before do come back more. But it counts stays <i>before</i> this one. On the day of discharge it is already known. Strong is not the same as leaking.", false],
      ["The stay ends on the day of discharge, so its length is known that day. Nothing in it comes from after.", false],
      ["The discharge letter is written before the patient leaves. Known on the day.", false],
      ["The form is filled in on the ward, during the stay. Known on the day.", false],
      [`Right. The table was built 30 days after each discharge, and patients who came back got a follow-up booked by the ward that readmitted them. So the column is filled in mostly <i>because</i> of the outcome. In the training rows: of ${CROSS.yes.rows} patients with a follow-up booked, ${CROSS.yes.back} came back (${pct(shareBack(CROSS.yes))}); of ${CROSS.no.rows.toLocaleString("en")} without one, ${CROSS.no.back} did (${pct(shareBack(CROSS.no))}). On its own, this one column scores ${pct(ALONE_FOLLOWUP)} in cross-validation: the whole “model” was this column.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Which column knows the answer?</h1>
        <p class="lead">The model predicts on the day of discharge. These are its six input columns, as the data team describes them. The label, <code>readmitted</code>, means “back in hospital within 30 days”.</p>
        <p class="task">Pick the column whose value is only known after the outcome.</p>
        <div class="lpanel">${ask(kit, COLS.map(c => colOpt(kit, c)), LEAK_COL, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === LEAK_COL) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: the test set did not catch it. What would have? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Drop any column that scores very high on its own",
      "Score the model on a held-out test set it never trained on",
      "For every column, ask: would its value be known at the moment the model has to predict?",
      "Collect more rows before trusting the score"
    ];
    const RIGHT = 2;
    const fb = [
      ["Strong honest columns exist, and you need them. And a leak can be weak: a column that is only partly filled in after the outcome still leaks. Strength is a hint to look, not the test.", false],
      [`They did that: ${pct(LEAK.test)} on ${TEST_N} rows the model never saw. The leaking column is in the test rows too, filled in the same late way, so the test set confirms the mistake instead of catching it. A held-out set catches a model that memorised its training rows, not a column that should not exist.`, false],
      [`Right. This is <b>data leakage</b>: information that would not be available at prediction time is used to build the model. The score looks great in testing and falls apart in use. The check is about timing, not about strength: for each column, find out when and by whom it is filled in, and compare with the moment the model will run. Here that moment is the day of discharge, and <code>followup_booked</code> is filled in up to 30 days later.`, true],
      [`More rows built the same way carry the same late column. The score would stay near ${pct(LEAK.cvMean)}, and you would trust it more, not less.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did the test set not catch it?</h1>
        <p class="lead">The team did not cheat in the usual way. They split the data, trained on ${TRAIN_N.toLocaleString("en")} rows, and scored ${TEST_N} rows the model never saw: ${pct(LEAK.test)}.</p>
        <p class="task">Which habit would have caught this column before anyone celebrated?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Predict: what the 99% model does on the ward. */
  function wardDay({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [`About ${LEAK.caught}, as in the test`, "About half of them", `${WARD.caught}`, "It cannot run without the column"];
    const RIGHT = 2;
    const fb = [
      [`In the test, <code>followup_booked</code> said “yes” for the patients who came back. On the day of discharge nothing has been booked yet, so the column says “no” for everyone, and the model learned that “no” means “will not come back”.`, false],
      ["Half would need some honest signal the model leans on. This model leaned almost entirely on one column, and that column is “no” for every patient on the day it runs.", false],
      [`Right. We replayed the ${TEST_N} test patients with <code>followup_booked</code> set to “no”, as it is on the day of discharge. The model flagged ${WARD.flagged} patients and caught ${WARD.caught} of the ${TEST_YES} who came back. Its accuracy fell to ${pct(WARD.accuracy)}: exactly the always-“no” floor from the first screen. The nurses would get an empty call list every day.`, true],
      ["The column still exists on the day of discharge; it is just empty, which the system stores as “no”. The model runs fine and answers with confidence. That is what makes a leak dangerous: nothing crashes.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The model goes to the ward</h1>
        <p class="lead">The hospital switches the model on. Each morning it scores the patients going home that day. At that moment, no follow-up has been booked for anyone yet, so <code>followup_booked</code> is “no” for every patient.</p>
        <p class="task">Of the ${TEST_YES} test patients who later came back, how many would it flag on their day of discharge?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Rebuild without the column and predict the honest score. */
  function honestScore({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [`Still above 95%`, `Between ${pct(BASE)} and 85%`, `Below ${pct(BASE)}`];
    const RIGHT = 1;
    const fb = [
      ["Every point above 95% came from the late column. The five honest columns know only what was true on the day of discharge, and a lot happens after that.", false],
      [`Right. Without <code>followup_booked</code>: ${pct(HONEST.cvMean)} in 5-fold cross-validation (folds ${HONEST.cvFolds.map(pct).join(", ")}) and ${pct(HONEST.test)} on the held-out test set. It caught ${HONEST.caught} of the ${TEST_YES} patients who came back, and it will catch about as many on the ward, because every column it uses exists on the day of discharge. This is the number to show the director: lower, but true. It also says what to do next: find better columns that are known at discharge, not tune the model.`, true],
      [`Below the floor would mean the honest columns make the model worse than always saying “no”. Patients with many earlier stays and patients living alone do come back more, so the model has something real to learn from.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Rebuild it so it cannot leak</h1>
        <p class="lead">The team drops <code>followup_booked</code> and keeps the five columns that are known on the day of discharge. Same split, same model, same 5-fold cross-validation. The floor is ${pct(BASE)} (always “no”); the leaky model claimed ${pct(LEAK.test)}.</p>
        <p class="task">Predict the honest test accuracy.</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Broken on purpose: a step that leaks. Click the line. */
  function brokenStep({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const fb = [
      ["Creating the selector only stores the settings (keep the 20 best columns). It has not looked at any data yet.", false],
      [`Right. <code>fit_transform(markers, readmitted)</code> picks the 20 columns that best match the label across <b>all ${PILOT.rows}</b> patients, including the ${PILOT_FOLD} patients that each fold will later score. Among ${PILOT.cols.toLocaleString("en")} random columns, some match those labels by pure chance, and the selector picks exactly those. Cross-validation then splits rows that already know their answers. The leak is not a column; it is a step that looked at the test rows' labels.`, true],
      ["Any model would show the same thing. Logistic regression only sees the 20 columns it is handed; the damage is done before this line.", false],
      ["<code>cross_val_score</code> does keep the folds apart for the model: it trains on four fifths and scores the rest each time. But the columns it receives were chosen by looking at every row's label, the scored rows included.", false],
      ["That line only prints the score. The score is the symptom, not the cause.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: a leaking step</h1>
        <p class="lead">A pilot study: ${PILOT.rows} patients, ${PILOT.cols.toLocaleString("en")} blood-marker columns, and the same label. With so many columns and so few patients, the team first keeps only the 20 columns that look most useful. <code>SelectKBest(f_classif, k=20)</code> does that: it scores how well each column separates the “yes” rows from the “no” rows, and keeps the 20 best.</p>
        <p class="lead">In our run the markers are random numbers and the labels are coin flips (${PILOT.yes} “yes”). So an honest score should land near ${pct(PILOT_BASE)} (always answering the more common label), give or take luck. What the team's five lines printed:</p>
        ${out(kit, [STEP_LEAK.printed])}
        <p class="lead">Per fold: ${STEP_LEAK.folds.map(pct).join(", ")}. No column here knows the future, yet the score is ${pct(Number(STEP_LEAK.printed))} on noise.</p>
        <p class="task">The five lines are the buttons below. Click the line that lets the answers in.</p>
        <div class="lpanel">${ask(kit, BROKEN.map((l, i) => lineOpt(kit, i, l)), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. The fix: pick it, then predict its score. */
  function fixStep({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const Q = [
      { right: 2, opts: ["Keep 5 columns instead of 20", "Use 10 folds instead of 5", "Put the selector and the model in one pipeline and cross-validate the pipeline", "Select columns once on all rows, then score on a separate test set"],
        fb: [
          ["Fewer columns, still chosen by looking at every row's label. The chance matches are just fewer and stronger.", false],
          ["More folds split the same pre-chosen columns more finely. The columns were still picked with the scored rows' labels.", false],
          null,
          ["That is the same leak in a new place: the selection still looked at the test rows' labels before the test.", false]
        ] },
      { right: 1, opts: [`About ${pct(Number(STEP_LEAK.printed))} again`, `Near ${pct(PILOT_BASE)}, a coin flip`, "100%"],
        fb: [
          ["The pipeline changes what the selector sees: in each fold it never sees the labels of the rows that fold scores. Chance matches found on the training rows do not repeat on the scored rows.", false],
          null,
          ["Nothing here can be perfect: the labels are coin flips. Only a leak could push it up, and the pipeline closes it.", false]
        ] }
    ];
    const paint = () => {
      const q = Q[stage] || Q[1];
      el.innerHTML = `<h1>Fix the step</h1>
        <p class="lead">Same ${PILOT.rows} patients, same random markers. The selection must only ever see the rows a model trains on. In scikit-learn, a <b>pipeline</b> joins several steps (here: choose columns, then train) into one object that you fit and score like a single model.</p>
        ${stage >= 1 ? `${kit.code(FIXED, -1)}<p class="lead"><code>cross_val_score</code> now refits the whole pipeline in each fold: the selector picks its 20 columns from that fold's training rows only, then the model trains, then the held-out rows are scored.</p>` : ""}
        ${stage < 2 ? `<p class="task">${stage === 0 ? "Which change closes the leak?" : "Predict what this prints."}</p>` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : `${out(kit, [STEP_FIXED.printed])}${kit.feedback(`Right. ${pct(Number(STEP_FIXED.printed))} (folds ${STEP_FIXED.folds.map(pct).join(", ")}), around the ${pct(PILOT_BASE)} floor, which is the truth for random columns. (Each fold scores only ${PILOT_FOLD} patients, so one patient moves a fold by ${pct(1 / PILOT_FOLD)}; landing a little under the floor is luck.) The leaky version said ${pct(Number(STEP_LEAK.printed))}. The same rule holds for every step that learns from data, such as scaling, filling in missing values or choosing columns: fit it on training rows only. A pipeline makes that automatic.`, true)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 8. The big picture: what it is, when to suspect it, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Team A: 78% where always-“no” gets 72%, similar in every fold, columns all filled in before the prediction",
      "Team B: 97% where doctors would be happy with 70%, and one column does almost all the work",
      "Team C: 60% where a coin flip gets 50%, built with a pipeline"
    ];
    const RIGHT = 1;
    const fb = [
      ["A modest gain over the floor, steady across folds, and every column checked for timing. That looks like an honest, ordinary model. Check B first.", false],
      ["Right. Far above what experts expect, and one column carrying the model: the two strongest signs of a leak. Ask when that column is filled in before anything else.", true],
      ["Weak, but nothing suggests the answer got in: the steps are fitted per fold and the score is barely above chance. Its problem is weak columns, not a leak.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to go looking for a leak</h1>
        <p class="lead"><b>What it is:</b> anything that lets the answer reach training: a column filled in after the outcome, a step fitted on all rows, the same patient in training and test rows, or later rows used to predict earlier ones.</p>
        <p class="lead"><b>Suspect it</b> when a score is far above the floor or above what experts expect, or when one column does all the work. <b>Not a leak:</b> a strong column known at prediction time; keep it.</p>
        <p class="lead"><b>Costs:</b> a pipeline costs nothing. Checking timing means asking whoever fills in each column. The honest score is lower, and may end the project. A leak costs more, later, in production.</p>
        <p class="task">Three teams report results. Which one do you check for leakage first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, with two "no" cases. */
  const CASES = [
    ["A bank predicts which new loans will go unpaid. One input is “number of reminder calls made”.", true,
      "Yes. Reminder calls start after a payment is missed, so the column is filled in because of the outcome. When the loan is approved, it is zero for everyone.",
      "Ask when it is filled in: reminder calls happen only after a payment is missed. At approval time it is zero for everyone, so the model learned from something it will never see."],
    ["A delivery app predicts how long an order will take. The strongest inputs are the distance and the hour the order is placed.", false,
      "No. Both are known the moment the order is placed, which is when the prediction runs. A strong column is not a leak; the timing decides.",
      "Strong does not mean leaking. Distance and order hour are known at the moment the app predicts, so the model can use them in production exactly as in testing."],
    ["A skin clinic trains a classifier on photos, several per patient, and splits the photos at random into training and test rows.", true,
      "Yes. Photos of the same patient land on both sides, so the model can score well by recognising the patient. Split by patient instead (scikit-learn's GroupKFold keeps each group on one side).",
      "Random photo splits put the same patient in training and test rows. The test then rewards recognising a person, not the condition. Keep each patient on one side, for example with GroupKFold."],
    ["A shop scales its features with a scaler inside a pipeline, cross-validates the pipeline, and scores 81% where the floor is 75%.", false,
      "No. The scaler is refitted inside each fold on training rows only, and the score is a believable step above the floor. Nothing described here lets the answer in.",
      "The step that could leak, the scaler, sits inside the pipeline, so each fold fits it on its own training rows. And 81% against a 75% floor is not a suspicious score."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Leak or not?</h1>
        <p class="lead">Four models from other places. A leak means information the model will not have at prediction time got into training or into the score.</p>
        <p class="task">Is there a leak in each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Leak", "No leak"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can find a leak</h1>
      <p class="lead">You saw a ${pct(LEAK.cvMean)} model catch ${WARD.caught} patients on the ward, found the column filled in after the outcome, rebuilt it to an honest ${pct(HONEST.test)}, and closed a leaking step with a pipeline. Two questions to ask. For every column: would its value be known at the moment the model predicts? For every step that learns from data: was it fitted without seeing the rows being scored?</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Now that the score is honest, you read the gap between training and validation scores, and learn to close it.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Data leakage: when the model sees the answer",
    checked: CHECKED,
    sources: [
      "https://scikit-learn.org/stable/common_pitfalls.html",
      "https://scikit-learn.org/stable/modules/cross_validation.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.pipeline.make_pipeline.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.feature_selection.SelectKBest.html",
      "https://scikit-learn.org/stable/developers/develop.html"
    ],
    interview: [
      {
        q: "A churn model scores 98% in validation but does no better than guessing after launch. How do you investigate?",
        good: [
          "Suspect leakage first: compare the score with a simple baseline and with what the business expects",
          "Look at which features carry the model, then ask for each one when it is filled in compared with the moment of prediction",
          "Check the pipeline: any scaling, imputing or feature selection fitted on all rows before the split",
          "Check the split: the same customer on both sides, or later records used to predict earlier ones",
          "Rebuild with only features known at prediction time, inside a pipeline, and report the lower honest score"
        ],
        weak: "Retrain on fresher data or try a stronger model. That keeps the leaking feature and repeats the same false score."
      },
      {
        q: "Your colleague says: we used a held-out test set, so the score cannot be inflated. Do you agree?",
        good: [
          "No: a test set guards against overfitting, not against a feature that should not exist",
          "A column filled in after the outcome is in the test rows too, so the test confirms the leak",
          "A step fitted on all rows before the split has already seen the test rows",
          "The check is timing: would each value be known when the model runs in production"
        ],
        weak: "Agree, because the model never trained on the test rows. That misses that the leak travels inside the features."
      }
    ],
    screens: [tooGood, markColumn, spotIdea, wardDay, honestScore, brokenStep, fixStep, bigPicture, recognise, whatNext],
    walk: [
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
