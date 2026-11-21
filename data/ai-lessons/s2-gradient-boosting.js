/* Lesson: gradient boosting. Story: a greenhouse predicts next week's tomato harvest from light hours,
   temperature and watering. Ideas: (1) boosting adds small trees one after another, each fitted to the
   leftover errors (residuals) of the sum so far; for squared error the residual is the downhill direction, so
   this is gradient descent with trees as the steps, and the learning rate shrinks each step; (2) with the real
   library, more trees keep lowering training error while validation error turns back up, so you stop early.
   Data, all real runs on this Mac (no model calls were recorded for this lesson):
   - docs/ai-path/runs/s2-gradient-boosting/by_hand.py + by_hand.out.txt: the eight greenhouse weeks, every
     candidate split for stumps 1 and 2, the traced boost() loop (rounds=2, lr=1.0), the lr=0.5 prediction,
     training error per round at three learning rates;
   - docs/ai-path/runs/s2-gradient-boosting/library.py + library.out.txt: scikit-learn GradientBoostingRegressor
     on 360 synthetic, seeded greenhouse rows: error per round (staged_predict), early stopping at three learning
     rates, predictions outside the trained light range. Versions in env.txt.
   Lesson-local style: a small data table and row buttons (.lx-s2-gradient-boosting-*), see ensureStyle(). */
(() => {
  const ID = "s2-gradient-boosting";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => sum(a) / a.length;
  const r2 = v => Math.round(v * 100) / 100;
  const num = v => { const x = r2(v); return (x < 0 ? "−" : "") + String(Math.abs(x)); };
  const kg = v => v.toFixed(2);
  const signed = v => (v > 0 ? "+" : "") + num(v);

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s2-gradient-boosting/by_hand.py: [light h/day, temp C, water L/bed/day, harvest kg]
  const FEATURES = ["light", "temp", "water"];
  const WEEKS = [[9, 18, 4, 29], [10, 22, 5, 38], [11, 19, 4, 30], [12, 23, 5, 51], [13, 18, 6, 44], [14, 24, 5, 53], [13, 22, 4, 52], [9, 23, 6, 39]];
  // by_hand.out.txt, "learning rate 0.5, one round: prediction per week"
  const LR05_PRED = [38, 38, 38, 46, 46, 46, 46, 38];
  // by_hand.out.txt, "training squared error per round" (rounds 0..5)
  const ERR_BY_LR = [[1.0, [644.0, 132.0, 12.0, 4.0, 2.86, 1.76]], [0.5, [644.0, 260.0, 115.6, 47.59, 23.15, 11.01]], [0.1, [644.0, 546.72, 467.92, 404.1, 352.4, 310.52]]];

  // The listing is boost() from by_hand.py, line for line (line 0 = def).
  const CODE = [
    "def boost(features, harvest, rounds, lr):",
    "    prediction = np.full(len(harvest), harvest.mean())",
    "    stumps = []",
    "    for r in range(rounds):",
    "        residual = harvest - prediction",
    "        stump = fit_stump(features, residual)",
    "        prediction = prediction + lr * stump_predict(stump, features)",
    "        stumps.append(stump)",
    "    return harvest.mean(), stumps"
  ];
  // by_hand.out.txt trace of boost(weeks, harvest, rounds=2, lr=1.0): [line about to run, event, r, prediction, residual, stump]
  const TRACE = [[1,"l",null,null,null,null],[2,"l",null,[42,42,42,42,42,42,42,42],null,null],[3,"l",null,[42,42,42,42,42,42,42,42],null,null],[4,"l",0,[42,42,42,42,42,42,42,42],null,null],[5,"l",0,[42,42,42,42,42,42,42,42],[-13,-4,-12,9,2,11,10,-3],null],[6,"l",0,[42,42,42,42,42,42,42,42],[-13,-4,-12,9,2,11,10,-3],["light",12,-8,8]],[7,"l",0,[34,34,34,50,50,50,50,34],[-13,-4,-12,9,2,11,10,-3],["light",12,-8,8]],[3,"l",0,[34,34,34,50,50,50,50,34],[-13,-4,-12,9,2,11,10,-3],["light",12,-8,8]],[4,"l",1,[34,34,34,50,50,50,50,34],[-13,-4,-12,9,2,11,10,-3],["light",12,-8,8]],[5,"l",1,[34,34,34,50,50,50,50,34],[-5,4,-4,1,-6,3,2,5],["light",12,-8,8]],[6,"l",1,[34,34,34,50,50,50,50,34],[-5,4,-4,1,-6,3,2,5],["temp",22,-5,3]],[7,"l",1,[29,37,29,53,45,53,53,37],[-5,4,-4,1,-6,3,2,5],["temp",22,-5,3]],[3,"l",1,[29,37,29,53,45,53,53,37],[-5,4,-4,1,-6,3,2,5],["temp",22,-5,3]],[8,"l",1,[29,37,29,53,45,53,53,37],[-5,4,-4,1,-6,3,2,5],["temp",22,-5,3]],[8,"r",1,[29,37,29,53,45,53,53,37],[-5,4,-4,1,-6,3,2,5],["temp",22,-5,3]]];

  // From docs/ai-path/runs/s2-gradient-boosting/library.out.txt (scikit-learn 1.9.1, seed 0)
  const LIB = {
    rows: { train: 160, val: 100, test: 100 },
    rounds: [[1, 6.77, 7.47], [10, 4.35, 5.77], [25, 2.93, 4.89], [50, 2.14, 4.71], [75, 1.82, 4.67], [100, 1.52, 4.66], [150, 1.08, 4.70], [200, 0.79, 4.74], [300, 0.44, 4.78], [400, 0.25, 4.81]], // [round, train MAE, validation MAE]
    bestRound: 102, bestVal: 4.65, testAll: 5.43,
    early: [[0.3, 17, 4.73], [0.1, 29, 4.60], [0.03, 89, 4.62]], // [learning_rate, n_estimators_, test MAE]
    lightRange: [8.0, 14.0],
    probe: [[12, 44.2], [13, 45.5], [14, 53.2], [16, 53.2], [18, 53.2], [20, 53.2]] // light hours -> predicted kg (temp 23, water 5)
  };
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s2-gradient-boosting.ipynb";

  /* ---------- Derived from the data (the by-hand boosting, computed here) ---------- */
  const N = WEEKS.length;
  const HARVEST = WEEKS.map(w => w[3]);
  const BASE = mean(HARVEST);
  const sq = a => sum(a.map(v => v * v));
  const sides = (j, t, res) => { const L = [], R = []; WEEKS.forEach((w, i) => (w[j] < t ? L : R).push(res[i])); return [L, R]; };
  const splitErr = (j, t, res) => sides(j, t, res).reduce((s, side) => { const m = mean(side); return s + sum(side.map(v => (v - m) ** 2)); }, 0);
  const stumpOf = (j, t, res) => { const [L, R] = sides(j, t, res); return { j, t, left: mean(L), right: mean(R) }; };
  const applyStump = (st, i) => WEEKS[i][st.j] < st.t ? st.left : st.right;
  function bestStump(res) {
    let best = null;
    FEATURES.forEach((_, j) => [...new Set(WEEKS.map(w => w[j]))].sort((a, b) => a - b).slice(1).forEach(t => {
      const e = splitErr(j, t, res);
      if (!best || e < best.e) best = { e, ...stumpOf(j, t, res) };
    }));
    return best;
  }
  const RES0 = HARVEST.map(h => h - BASE);
  const ST1 = bestStump(RES0);
  const RES1 = RES0.map((r, i) => r - applyStump(ST1, i));
  const ST2 = bestStump(RES1);
  const RES2 = RES1.map((r, i) => r - applyStump(ST2, i));
  const ERR = [sq(RES0), sq(RES1), sq(RES2)];
  const splitName = (j, t) => `${FEATURES[j]} < ${t}`;
  const FEAT_LABEL = { light: "light hours", temp: "temperature", water: "watering" };

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-wrap { margin: 14px 0 0; max-width: 100%; overflow-x: auto; }
      .lx-${ID}-t { border-collapse: collapse; font: 500 14.5px/1.35 var(--mono); color: var(--ink); min-width: 100%; }
      .lx-${ID}-t caption { text-align: left; font: 600 13px/1.4 var(--font); color: var(--muted); padding: 0 0 6px; }
      .lx-${ID}-t th { font: 600 12.5px/1.3 var(--font); color: var(--muted); text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: bottom; }
      .lx-${ID}-t td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-t th:first-child, .lx-${ID}-t td:first-child { text-align: left; }
      .lx-${ID}-t tr.lx-${ID}-ask td { font-weight: 700; background: var(--sunk); }
      .lx-${ID}-t tr.lx-${ID}-ask td:first-child { box-shadow: inset 3px 0 0 var(--ink); }
      .lx-${ID}-t td.lx-${ID}-new { background: var(--good-soft); }
      .lx-${ID}-t td.lx-${ID}-q { color: var(--muted); }
      .lx-${ID}-pick button { width: 100%; min-height: 44px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; align-items: center; text-align: right; font: 500 15px var(--mono); color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; margin: 0 0 6px; cursor: pointer; }
      .lx-${ID}-pick button span:first-child { text-align: left; }
      .lx-${ID}-pick button.right { border: 2px solid var(--good); background: var(--good-soft); }
      .lx-${ID}-pick button.wrong { border: 2px solid var(--bad); background: var(--bad-soft); }
      .lx-${ID}-pick .lx-${ID}-head { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding: 0 13px 6px; font: 600 12.5px var(--font); color: var(--muted); text-align: right; }
      .lx-${ID}-pick .lx-${ID}-head span:first-child { text-align: left; }
      .lx-${ID}-list { margin: 12px 0 0; padding: 0 0 0 1.1em; }
      .lx-${ID}-list li { margin: 0 0 6px; line-height: 1.5; }
      .lx-${ID}-check { list-style: none; padding: 0; margin: 12px 0 0; }
      .lx-${ID}-check label { display: flex; gap: 12px; align-items: center; min-height: 44px; padding: 8px 0; border-bottom: 1px solid var(--line); line-height: 1.45; cursor: pointer; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; border: 2px solid var(--ink-2); background: var(--surface); cursor: pointer; box-shadow: inset 0 0 0 12px var(--surface); }
      .lx-${ID}-check input:checked { background: var(--ink); }
      .lx-${ID}-check input:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  // cols: [{ h, v: i => text, cls?: i => class }]; ask: row index to ring
  function weekTable(kit, cols, { ask = -1, title = "" } = {}) {
    return `<div class="lx-${ID}-wrap"><table class="lx-${ID}-t">${title ? `<caption>${kit.esc(title)}</caption>` : ""}
      <thead><tr><th>week</th>${cols.map(c => `<th>${c.h}</th>`).join("")}</tr></thead>
      <tbody>${WEEKS.map((_, i) => `<tr${i === ask ? ` class="lx-${ID}-ask"` : ""}><td>${i + 1}</td>${cols.map(c => `<td${c.cls && c.cls(i) ? ` class="${c.cls(i)}"` : ""}>${kit.esc(c.v(i))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const C_LIGHT = { h: "light<br>h/day", v: i => WEEKS[i][0] };
  const C_TEMP = { h: "temp<br>°C", v: i => WEEKS[i][1] };
  const C_WATER = { h: "water<br>L/day", v: i => WEEKS[i][2] };
  const C_HARV = { h: "harvest<br>kg", v: i => WEEKS[i][3] };
  const C_FEATS = [C_LIGHT, C_TEMP, C_WATER];

  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct, num: true })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }
  /* Two-step screen helper: a question, then a second question once the first is right.
     build(step) returns { right, html(ans) }; after the second right answer the screen repaints with it picked. */
  function twoStep({ el, done }, build) {
    let step = 0, ans = null;
    const paint = () => {
      const q = build(step);
      el.innerHTML = q.html(ans);
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === q.right && step === 0) { step = 1; ans = null; paint(); return; }
        paint();
        if (ans === q.right) done();
      });
    };
    paint();
  }

  /* 1. The situation, and the first guess. */
  function firstGuess({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const W = 0, right = RES0[W];
    const RIGHT = 1;
    const opts = [-right, right, HARVEST[W], HARVEST[W] + BASE].map(num);
    const fb = [
      [`Close, but the sign is backwards. Take the true harvest minus the guess: ${HARVEST[W]} − ${num(BASE)}. The guess was too high, so the error must come out negative. The sign is what tells the next tree which way to push.`, false],
      [`Right: ${HARVEST[W]} − ${num(BASE)} = ${num(right)}. The guess was ${num(-right)} kg too high, and the minus sign says so. This leftover error, the true value minus the prediction, is called the <b>residual</b>. The whole table:${weekTable(kit, [C_HARV, { h: "guess", v: () => num(BASE) }, { h: "residual", v: i => num(RES0[i]), cls: () => `lx-${ID}-new` }])}Some weeks the guess is far too high, some far too low. Next you fix that, one small tree at a time.`, true],
      [`${HARVEST[W]} is the harvest itself. You need how far the guess missed it: harvest minus guess.`, false],
      [`That adds the guess to the harvest. The miss is the difference between them: harvest minus guess.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>How many tomatoes next week?</h1>
        <p class="lead">A greenhouse sells next week's tomatoes to a shop in advance. Promise too many and the shop comes up short; promise too few and unsold fruit rots. The grower keeps a log: each week's light hours, temperature and watering, and the harvest that followed. Here are ${N} weeks of it. In this lesson you build the forecast from small trees, each one fixing the errors of the ones before it. That is <b>gradient boosting</b>, a strong model for tables of numbers like this one.</p>
        ${weekTable(kit, [...C_FEATS, C_HARV], { ask: W })}
        <p class="lead">Before any model, the simplest forecast is the same number every week: the average harvest, <b>${num(BASE)} kg</b>.</p>
        <p class="task">How far off is that guess for week ${W + 1}? Harvest minus guess:</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* A split question block: options are [featureIndex, threshold]; feedback computed from the residuals. */
  function splitFeedback(kit, j, t, res, best, extra, head = "") {
    const [L, R] = sides(j, t, res), e = splitErr(j, t, res);
    return `${head}With <b>${kit.esc(splitName(j, t))}</b> the residuals fall into [${L.map(num).join(", ")}] and [${R.map(num).join(", ")}]. Side averages ${num(mean(L))} and ${num(mean(R))}. Leftover squared error: <b>${num(e)}</b>${e > best.e ? `, against ${num(best.e)} for the best split.` : "."} ${extra}`;
  }

  /* 2. Stump 1: pick the split by hand, then fill in one new residual. */
  function stumpOne(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const OPTS = [[1, 22], [0, 12], [2, 5], [0, 13]], RIGHT = 1;
    const W = 3; // week 4
    const newR = RES1[W], said = applyStump(ST1, W);
    const why = [
      "Warm weeks are mixed: some of them are among the worst misses. Temperature alone does not separate too-high guesses from too-low ones here.",
      "",
      "Watering barely sorts the weeks: big negative and big positive residuals end up on the same side.",
      "Close, but week 4 (12 hours, residual +9) lands with the dim weeks, so one side mixes signs."
    ];
    twoStep(ctx, step => {
      if (step === 0) return {
        right: RIGHT,
        html: ans => `<h1>Stump 1: one question that fixes the most</h1>
          <p class="lead">A <b>stump</b> is a decision tree with only one question, like “light &lt; 12?”. It is trained on the <b>residuals</b>, not on the harvest. Why? Its answer is added to the guess, so it should predict how far the guess is off. On each side of the question it predicts that side's average residual. A good question puts too-high guesses (negative residuals) on one side and too-low ones (positive) on the other. To score a question, use the <b>leftover squared error</b>: on each side, subtract the side's average from each residual, square, add up. Smaller is better.</p>
          ${weekTable(kit, [...C_FEATS, { h: "residual", v: i => num(RES0[i]) }])}
          <p class="task">Which question should stump 1 ask? Look at which weeks have negative residuals.</p>
          <div class="lpanel">${ask(kit, OPTS.map(([j, t]) => kit.esc(splitName(j, t))), RIGHT, ans, OPTS.map(([j, t], k) => [splitFeedback(kit, j, t, RES0, ST1, why[k]), false]))}</div>`
      };
      const opts = [RES0[W] + said, RES0[W], newR, said].map(num);
      const fbs = [
        [`That adds the stump's ${signed(said)} to the residual. The stump's answer raises the prediction, so it shrinks what is left over: ${num(RES0[W])} − ${num(said)}.`, false],
        [`That is the old residual. The prediction for week ${W + 1} just changed by ${signed(said)}, so what is left over changes too.`, false],
        [`Right: ${num(RES0[W])} − ${num(said)} = ${num(newR)}. Every week's new residual is now in the table. They are much smaller than before: squared error ${num(ERR[0])} → ${num(ERR[1])}.`, true],
        [`${signed(said)} is what the stump predicts. The new residual is the old residual minus that.`, false]];
      return {
        right: 2,
        html: ans => `<h1>Stump 1: one question that fixes the most</h1>
          ${kit.feedback(splitFeedback(kit, ST1.j, ST1.t, RES0, ST1, `Every dim week was over-guessed and every bright week under-guessed. Before any stump the squared error was ${num(ERR[0])}. Stump 1 says <b>${num(ST1.left)}</b> if ${kit.esc(splitName(ST1.j, ST1.t))}, else <b>${signed(ST1.right)}</b>, and that is added to the guess.`, "Right. "), true)}
          ${weekTable(kit, [C_LIGHT, { h: "old residual", v: i => num(RES0[i]) }, { h: "stump 1", v: i => signed(applyStump(ST1, i)) }, { h: "new residual", v: i => i === W && ans !== 2 ? "?" : num(RES1[i]), cls: i => i === W ? `lx-${ID}-q` : "" }], { ask: W })}
          <p class="task">Week ${W + 1}: what residual is left after stump 1?</p>
          <div class="lpanel">${ask(kit, opts, 2, ans, fbs)}</div>`
      };
    });
  }

  /* 3. Stump 2: fitted to what stump 1 left over. */
  function stumpTwo(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const OPTS = [[0, 12], [1, 19], [2, 5], [1, 22]], RIGHT = 3;
    const W = 4; // week 5
    const said = applyStump(ST2, W);
    const [L12, R12] = sides(0, 12, RES1);
    const why = [
      `Both sides now average ${num(mean(L12))} and ${num(mean(R12))}, so this stump would add nothing. Stump 1 already took everything this question could tell. A new stump has to find a different pattern.`,
      "Week 3 (19 °C, residual −4) lands on the warm side, so the cool weeks are not all together.",
      "Watering mixes negative and positive residuals on both sides.",
      ""
    ];
    twoStep(ctx, step => {
      if (step === 0) return {
        right: RIGHT,
        html: ans => `<h1>Stump 2 learns what stump 1 missed</h1>
          <p class="lead">The prediction is now ${num(BASE)} plus stump 1's answer. Stump 2 is trained on the residuals that are <b>left</b>. Leftover squared error so far: ${num(ERR[1])}, down from ${num(ERR[0])}.</p>
          ${weekTable(kit, [...C_FEATS, { h: "residual", v: i => num(RES1[i]) }])}
          <p class="task">Which question should stump 2 ask?</p>
          <div class="lpanel">${ask(kit, OPTS.map(([j, t]) => kit.esc(splitName(j, t))), RIGHT, ans, OPTS.map(([j, t], k) => [splitFeedback(kit, j, t, RES1, ST2, why[k]), false]))}</div>`
      };
      const opts = [RES1[W] + said, RES2[W], RES1[W], said].map(num);
      const p5 = BASE + applyStump(ST1, W) + said;
      const fbs = [[`The stump says ${signed(said)} for this week, so the prediction goes down by ${num(-said)}, and the residual moves toward zero: ${num(RES1[W])} − (${num(said)}).`, false],
        [`Right: ${num(RES1[W])} − (${num(said)}) = ${num(RES2[W])}. Week ${W + 1}'s prediction is now ${[num(BASE), ...[applyStump(ST1, W), said].map(v => (v < 0 ? "− " : "+ ") + num(Math.abs(v)))].join(" ")} = <b>${num(p5)} kg</b>, against a true ${HARVEST[W]}.
          ${kit.meter(ERR.map((e, k) => ({ label: k === 0 ? "first guess" : `+ stump ${k}`, value: e, max: ERR[0], good: k === 2 })))}
          Leftover squared error: ${ERR.map(num).join(" → ")}. Two one-question trees, each fixing what was left before it, made it about ${Math.round(ERR[0] / ERR[2])} times smaller.`, true],
        [`That is the residual before stump 2. Stump 2 changes this week's prediction, so the residual changes too.`, false],
        [`${signed(said)} is stump 2's answer. The new residual is the old one minus it.`, false]];
      return {
        right: 1,
        html: ans => `<h1>Stump 2 learns what stump 1 missed</h1>
          ${kit.feedback(splitFeedback(kit, ST2.j, ST2.t, RES1, ST2, `Light has nothing more to tell; what is left follows temperature: the cool weeks were still over-guessed. Stump 2 says <b>${num(ST2.left)}</b> if ${kit.esc(splitName(ST2.j, ST2.t))}, else <b>${signed(ST2.right)}</b>.`, "Right. "), true)}
          ${weekTable(kit, [C_TEMP, { h: "old residual", v: i => num(RES1[i]) }, { h: "stump 2", v: i => signed(applyStump(ST2, i)) }, { h: "new residual", v: i => i === W && ans !== 1 ? "?" : num(RES2[i]), cls: i => i === W ? `lx-${ID}-q` : "" }], { ask: W })}
          <p class="task">Week ${W + 1}: what residual is left after stump 2?</p>
          <div class="lpanel">${ask(kit, opts, 1, ans, fbs)}</div>`
      };
    });
  }

  /* 4. Spot the idea: what does the next stump learn? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The harvest in kg, from scratch, so it can outvote the first two stumps",
      `The residuals left after the first guess and both stumps, like week 5's ${num(RES2[4])}`,
      "Only the weeks stump 2 got most wrong; the others are dropped",
      "Stump 2's residuals again, to double-check them"
    ];
    const fb = [
      ["That is how a random forest works: many trees each learn the target on their own, and their answers are averaged. Here nothing is averaged. Stump answers are <b>added</b>, so a stump that learned the full harvest would double-count what the guess and stumps already cover.", false],
      [`Right. Each new tree is trained on what the sum so far still gets wrong, and its answer is added to that sum. That is <b>boosting</b>.<br><br>Why “gradient”? You measured error as squared error. For one week, the slope of (harvest − prediction)² with respect to the prediction is −2 × (harvest − prediction). Downhill is the opposite of the slope: 2 × (harvest − prediction), which is 2 × the residual. So the residual points exactly downhill, the way gradient descent steps. Each stump is one downhill step, taken in predictions instead of in weights. For other loss functions the library fits each tree to the negative gradient of that loss; for squared error that is the residual.`, true],
      ["No week is dropped. Every week stays in, and the size of its residual is what makes it matter: a week that is already right has residual 0 and pulls the next split nowhere.", false],
      [`Those were stump 2's own targets, and it has already answered them. What is left after stump 2 is a new list: [${RES2.map(num).join(", ")}].`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What does stump 3 learn?</h1>
        <p class="lead">You built the forecast as a sum: ${num(BASE)}, plus stump 1's answer, plus stump 2's answer. The grower adds a third stump, then a fourth, and so on.</p>
        <p class="task">What is stump 3 trained to predict?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. The learning rate: predict a shrunk step. */
  function learningRate({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const W = 0, LR = 0.5, said = applyStump(ST1, W), right = LR05_PRED[W];
    const RIGHT = 2;
    const opts = [BASE + said, BASE * LR, right, BASE - LR].map(num);
    const show = ERR_BY_LR;
    const tbl = `<div class="lx-${ID}-wrap"><table class="lx-${ID}-t"><caption>Leftover squared error on the ${N} weeks, after each round</caption><thead><tr><th>round</th>${show.map(([lr]) => `<th>lr ${lr}</th>`).join("")}</tr></thead><tbody>${show[0][1].map((_, k) => `<tr><td>${k}</td>${show.map(([, e]) => `<td>${kit.esc(num(e[k]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    const fb = [
      [`${num(BASE + said)} is the full step: learning rate 1, as you did by hand. With ${LR}, only half of the stump's ${num(said)} is added.`, false],
      [`That shrinks the whole forecast. The learning rate only scales the <b>stump's</b> answer; the first guess stays ${num(BASE)}.`, false],
      [`Right: ${num(BASE)} + ${LR} × (${num(said)}) = ${num(right)}, the same number the Python run printed. The step goes the right way, but only half as far. Here is the run with ${show[0][1].length - 1} rounds at three learning rates (lr):${tbl}With ${show[0][0]} the error drops fastest on these weeks. With ${show[2][0]} it is still at ${num(show[2][1][show[2][1].length - 1])} after ${show[2][1].length - 1} rounds. Smaller steps need more trees. Why take them at all? Because a full step also chases noise in the training rows. The scikit-learn guide says small learning rates tend to give better test error, and recommends a small rate with enough trees that early stopping can pick the number. You will see that on the next screens.`, true],
      [`That subtracts the learning rate itself. It is a multiplier on the stump's answer: ${LR} × (${num(said)}).`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Take a smaller step</h1>
        <p class="lead">By hand, you added each stump's full answer. Real boosting multiplies each answer by a <b>learning rate</b>, usually well below 1 (the library's default is 0.1), like the step size in gradient descent. The stump still asks ${kit.esc(splitName(ST1.j, ST1.t))} and still says ${num(ST1.left)} or ${signed(ST1.right)}.</p>
        <p class="task">With learning rate ${LR}, what is week ${W + 1}'s prediction after stump 1?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. From scratch in Python: a stepped replay of the traced run. */
  const FR = TRACE.map(([ln, ev, r, pred, res, st]) => ({ ln, end: ev === "r", r, pred, res, st }));
  const list = a => a ? a.map(num).join(", ") : "–";
  function sayFrame(kit, f, k) {
    const st = f.st ? `${f.st[0]} < ${f.st[1]}: ${num(f.st[2])} / ${signed(f.st[3])}` : "";
    if (f.end) return `The function returns the first guess, ${num(BASE)}, and the two stumps. To forecast a new week: start at ${num(BASE)} and add lr × each stump's answer for that week. The final predictions are the ones you computed by hand.`;
    switch (f.ln) {
      case 1: return "The function starts. The highlighted line runs next: the first guess for every week.";
      case 2: return `Every prediction is now the average harvest, ${num(f.pred[0])}. Next: an empty list for the stumps.`;
      case 3: return f.r == null ? "Next: the loop over the rounds starts." : `Round ${f.r} is done. Back to the loop${f.r + 1 < 2 ? " for the next round" : ": that was the last round"}.`;
      case 4: return `Round ${f.r} (Python counts from 0). Next: residual = harvest minus prediction, for all ${N} weeks at once (NumPy subtracts arrays element by element).`;
      case 5: return `The residuals are [${list(f.res)}]: ${f.r === 0 ? "the ones you worked out on the first screen" : "the ones you filled in after stump 1"}. Next: <code>fit_stump</code> is given these residuals, not the harvest.`;
      case 6: return `<code>fit_stump</code> tried every question and kept the one with the least leftover squared error: ${kit.esc(st)}. That is your stump ${f.r + 1}. Next: add lr × its answer to every prediction.`;
      case 7: return `With lr = 1.0 each prediction moved by the stump's full answer: [${list(f.pred)}]. Next: keep the stump in the list.`;
      case 8: return "The loop is over. Next: return.";
      default: return "";
    }
  }
  function fromScratch({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The same thing in Python</h1>
        <p class="lead">This is the whole boosting loop, run on the ${N} weeks with <code>rounds=2, lr=1.0</code>. <code>fit_stump</code> tries every “feature &lt; value” question, as you did, and returns the best one with its two side averages. <code>stump_predict</code> gives each week its side's answer. Both are in the run's script.</p>
        <p class="task">Step through to the end. Each round, watch what <code>fit_stump</code> is given.</p>
        ${kit.code(CODE, f.end ? 8 : f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>r <b>${f.r == null ? "–" : f.r}</b></span><span>prediction <b>${kit.esc(list(f.pred))}</b></span><span>residual <b>${kit.esc(list(f.res))}</b></span><span>stump <b>${f.st ? kit.esc(`${f.st[0]} < ${f.st[1]}`) : "–"}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f, i))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. The real library: when to stop adding trees. */
  const LIB_CODE = [ // library.py part 1, shortened to fit a phone
    "model = GradientBoostingRegressor(",
    "    n_estimators=400, learning_rate=0.1,",
    "    max_depth=3, random_state=0)",
    "model.fit(X_train, y_train)",
    "for pred in model.staged_predict(X_val):",
    "    print(mean_absolute_error(y_val, pred))"
  ];
  function whenToStop({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const R = LIB.rounds;
    const minVal = Math.min(...R.map(r => r[2]));
    const okRow = k => R[k][2] === minVal;
    const RIGHT = R.findIndex(r => r[2] === minVal), LAST = R.length - 1, FIRST_TR = R.findIndex(r => r[1] === Math.min(...R.map(x => x[1])));
    const tot = LIB.rows.train + LIB.rows.val + LIB.rows.test;
    const say = k => {
      const [rd, tr, va] = R[k];
      if (okRow(k)) return [`Right. Validation error is lowest here, ${kg(va)} kg (the full run's lowest was ${kg(LIB.bestVal)} at round ${LIB.bestRound}). After it, training error keeps falling, to ${kg(R[LAST][1])} at round ${R[LAST][0]}, while validation error creeps up to ${kg(R[LAST][2])}. The later trees are fitting the noise in the ${LIB.rows.train} training rows: <b>overfitting</b>. On the ${LIB.rows.test} test rows, the model with all ${R[LAST][0]} trees scored ${kg(LIB.testAll)} kg. Choosing the number of trees on validation data is called <b>early stopping</b>.`, true];
      if (k === FIRST_TR) return [`Training error is lowest here, ${kg(tr)} kg, because every extra tree fits the training rows a little more. That says nothing about new weeks. On validation rows, round ${rd} is worse (${kg(va)}) than round ${R[RIGHT][0]} (${kg(minVal)}).`, false];
      if (rd < R[RIGHT][0]) return [`Validation error is still falling here (${kg(va)} kg, against ${kg(minVal)} at round ${R[RIGHT][0]}), so more trees still help new weeks. Stopping now leaves accuracy on the table.`, false];
      return [`Past the bottom. Validation error has started to rise (${kg(va)} kg against ${kg(minVal)} at round ${R[RIGHT][0]}), while training error keeps falling. The extra trees fit noise.`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>When to stop adding trees</h1>
        <p class="lead">Now the real library, scikit-learn's <code>GradientBoostingRegressor</code>, on ${tot} records from many beds (one bed, one week per row; synthetic data from a fixed seed, so you can rerun it). ${LIB.rows.train} rows train, ${LIB.rows.val} validate, ${LIB.rows.test} are kept for the final test. Each tree may ask up to 3 questions deep (<code>max_depth=3</code>), not 1. <code>staged_predict</code> gives the prediction after each round, so you can measure the error after every round. The error here is the average miss in kg (mean absolute error), on the training rows and on the validation rows. The code is shortened from the run's script.</p>
        ${kit.code(LIB_CODE, -1)}
        <p class="task">Tap the row of the round where you would stop adding trees.</p>
        <div class="lx-${ID}-pick"><div class="lx-${ID}-head"><span>round</span><span>train kg</span><span>validation kg</span></div>
          ${R.map(([rd, tr, va], k) => `<button type="button" data-i="${k}"${k === RIGHT ? " data-right" : ""}${k === LAST ? " data-wrong" : ""} class="${ans === k ? (okRow(k) ? "right" : "wrong") : ""}"><span>${rd}</span><span>${kg(tr)}</span><span>${kg(va)}</span></button>`).join("")}</div>
        <div class="lpanel">${ans == null ? "" : kit.feedback(...say(ans))}</div>`;
      el.querySelectorAll(`.lx-${ID}-pick button`).forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (okRow(ans)) done(); });
    };
    paint();
  }

  /* 8. Early stopping in the library, and the parameters that matter. */
  const ES_CODE = [ // library.py part 2
    "model = GradientBoostingRegressor(",
    "    n_estimators=2000, learning_rate=lr,",
    "    max_depth=3, validation_fraction=0.2,",
    "    n_iter_no_change=10, random_state=0)",
    "model.fit(X_fit, y_fit)  # train + val rows",
    "print(model.n_estimators_)"
  ];
  function earlyStop({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const E = LIB.early;
    const most = E.reduce((a, b) => b[1] > a[1] ? b : a);
    const RIGHT = E.indexOf(most);
    const opts = [...E.map(e => `learning_rate=${e[0]}`), "All the same: 2000"];
    const tbl = `<div class="lx-${ID}-wrap"><table class="lx-${ID}-t"><caption>Recorded run, same data</caption><thead><tr><th>learning_rate</th><th>trees kept</th><th>test error kg</th></tr></thead><tbody>${E.map(([lr, t, te]) => `<tr><td>${lr}</td><td>${t}</td><td>${kg(te)}</td></tr>`).join("")}</tbody></table></div>`;
    const best = E.reduce((a, b) => b[2] < a[2] ? b : a);
    const fb = E.map(([lr, t]) => [`Each tree's step is ${lr === most[0] ? "smallest" : "bigger"} here. ${lr === most[0] ? "" : `Bigger steps reach the bottom of the validation curve in fewer trees, so this rate stops sooner.`}`, false]);
    fb[RIGHT] = [`Right. Smaller steps need more trees to get as far, so the validation score keeps improving for longer.${tbl}All three stopped long before ${2000}. The best test error here came at learning_rate=${best[0]} (${kg(best[2])} kg), better than the ${kg(LIB.testAll)} kg of the ${LIB.rounds[LIB.rounds.length - 1][0]}-tree model on the last screen. That is not a fair race: these models were also given the ${LIB.rows.val} validation rows, so part of the gain is more data. The three settings that matter most:
      <ul class="lx-${ID}-list"><li><code>learning_rate</code>: how much of each tree's answer is added. Smaller is usually better on new data, but needs more trees.</li><li><code>n_estimators</code>: the most trees allowed. Set it high and let <code>n_iter_no_change</code> stop early.</li><li><code>max_depth</code>: how many questions deep each tree goes. Boosting uses shallow trees (default 3) and lets the sum do the work.</li></ul>
      For tens of thousands of rows or more, scikit-learn's guide points to <code>HistGradientBoostingRegressor</code>: it first sorts each column's values into bins (small ranges), and that can make it many times faster. It turns early stopping on by itself above 10,000 rows, and it accepts missing values as they are.`, true];
    fb.push([`Early stopping is on: <code>n_iter_no_change=10</code> stops training when the score on the held-out ${0.2 * 100}% has not improved for 10 rounds. 2000 is only the ceiling.`, false]);
    const paint = () => {
      el.innerHTML = `<h1>Let the library stop early</h1>
        <p class="lead">You do not have to read the table yourself. With <code>n_iter_no_change</code> set, scikit-learn holds out <code>validation_fraction</code> of the rows it is given, scores them after every round, and stops when the score has not improved for that many rounds. <code>n_estimators_</code> then tells you how many trees it kept. The code below, shortened from the run's script, was run at three learning rates.</p>
        ${kit.code(ES_CODE, -1)}
        <p class="task">Which learning rate kept the most trees before it stopped?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "Storing the trees takes too much memory",
      "Each round must wait for the previous tree, so the rounds cannot run side by side",
      "It needs a validation set"
    ];
    const fb = [
      ["Shallow trees are small: a few questions and a few leaf numbers each. Even thousands of them are rarely the problem. The slow part here is building them, one after another.", false],
      ["Right. Every tree is fitted to the residuals the trees before it left, so round 300 cannot start before round 299 ends. A forest's trees are independent and can be built at the same time. The usual fixes: the histogram version (it sorts values into bins, much faster on large data), a larger learning rate with fewer rounds, or early stopping so you never run the rounds you do not need.", true],
      ["Holding out rows costs some data, but the team has twenty million rows. That does not make the nightly job slow.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for boosting</h1>
        <p class="lead">Boosting adds many small trees, each fitted to what the trees before it left over.</p>
        <ul class="lx-${ID}-list"><li><b>Use it for</b> tables of numbers and categories (sales, sensors, prices, risk) when you want strong accuracy. On such tables it is often the model to beat.</li><li><b>Reach for it</b> after a simple baseline, and when a random forest is good but not good enough.</li><li><b>Not</b> for images, sound or free text: neural networks learn from raw pixels and words.</li><li><b>Not</b> when you must predict outside the range you trained on: there the trees give the same answer for every value, so a linear model is safer.</li><li><b>Not</b> with a handful of rows, or when every rule must be explained: use one small tree or a linear model.</li><li><b>Costs:</b> trees are built one after another; more settings to tune than a forest; it needs held-out data to know when to stop.</li></ul>
        <p class="task">A team retrains a boosted model every night on twenty million rows, and the job no longer finishes by morning. Which cost bites?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations, including two where it is the wrong tool. */
  const P = LIB.probe, pAt = h => P.find(p => p[0] === h)[1];
  const hi = LIB.lightRange[1];
  const flatHours = P.filter(p => p[0] >= hi).map(p => p[0]);
  const CASES = [
    ["A bakery chain forecasts tomorrow's bread sales per shop from the weekday, the weather forecast, holidays and last week's sales. It has three years of daily rows.", true,
      "Yes. A table of mixed columns, plenty of rows, a number to predict, and a past period to validate on. This is the kind of problem boosting is strong at.",
      "This is boosting's home ground: tabular columns, years of rows, and a held-out month to stop early on. A boosted model is a strong choice here."],
    [`A ski resort wants to know how many day passes it would sell at a price higher than any it has ever charged.`, false,
      `No. Every tree answers with leaf values seen in training, so beyond the highest price it has seen, the forecast goes flat. You saw it in this lesson's run: trained on ${LIB.lightRange[0]} to ${hi} hours of light, the model predicted ${num(pAt(hi))} kg at ${flatHours.join(", ")} hours alike. A model that can extend a trend (a linear model in price) or a real price trial fits better.`,
      `Boosting cannot follow a trend past the data. Its trees only return values learned from the training rows, so every price above the highest one seen gets the same forecast. In this lesson's run the model said ${num(pAt(hi))} kg at ${flatHours.join(", ")} hours of light alike. Use a model that can extend a trend, or test the new price for real.`],
    ["A plant clinic wants to tell diseased leaves from healthy ones using phone photos.", false,
      "No. A photo is thousands of pixels, and one pixel on its own means nothing; the meaning is in shapes and patterns across many pixels. A threshold question on a single pixel cannot see a leaf spot. A neural network that learns those patterns from raw images is the right tool.",
      "Boosting's trees ask “is this column below a value?”. A single pixel's value does not say whether a leaf is sick. Image models (neural networks) learn the shapes across pixels themselves."],
    ["An insurer predicts the cost of each car claim from forty columns about the driver, the car and the accident, with two million past claims.", true,
      "Yes. Tabular data, a number to predict, and many rows. At this size, the histogram version is the one to use: much faster, early stopping on by default.",
      "Forty columns of tabular data and two million labelled rows is exactly where boosting shines. Use the histogram version for speed, and early stopping on a validation set."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Boosting or not?</h1>
        <p class="lead">Four requests from other teams. Boosting means: many small trees, each fitted to what the trees before it left over, added together.</p>
        <p class="task">Would you reach for gradient boosting in each? Pick again if you change your mind.</p>
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
    const R = LIB.rounds, last = R[R.length - 1], E = LIB.early;
    const most = E.reduce((a, b) => b[1] > a[1] ? b : a), fewest = E.reduce((a, b) => b[1] < a[1] ? b : a);
    const checks = [
      `Training error falls at every listed round, down to about ${kg(last[1])} kg at round ${last[0]}.`,
      `Validation error is lowest around round ${LIB.bestRound} (about ${kg(LIB.bestVal)} kg) and then rises slowly to about ${kg(last[2])} kg.`,
      `With early stopping, learning_rate=${most[0]} keeps the most trees (${most[1]} in our run) and ${fewest[0]} the fewest (${fewest[1]}).`,
      `Predictions for ${flatHours.join(", ")} hours of light are all the same number (${num(pAt(hi))} kg in our run).`
    ];
    el.innerHTML = `<h1>You can explain boosting</h1>
      <p class="lead">You fitted two stumps by hand, each to the residuals of the one before, and watched the squared error fall from ${num(ERR[0])} to ${num(ERR[2])}. You saw why it is called gradient boosting, shrank the steps with a learning rate, and stopped the real model where validation error turned.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a> and run it.` : "The notebook for this lesson is on its way."} It trains the same model on the same seeded greenhouse data. What you should see (numbers may differ slightly with other library versions):</p>
      <ul class="lx-${ID}-check">${checks.map(c => `<li><label><input type="checkbox"> <span>${kit.esc(c)}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Trees never cared what units a column was in, because they only ask “below this value?”. The next model compares distances between rows, and there units suddenly matter.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Gradient boosting: each tree fixes the last one's errors",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/ensemble.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.GradientBoostingRegressor.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html"
    ],
    interview: [
      {
        q: "You raised n_estimators on a gradient boosting model from 200 to 2000. Training error went down, but error in production got worse. What happened, and what do you change?",
        good: [
          "The later trees fit noise in the training rows: overfitting, which training error cannot show",
          "Plot validation error per round (staged_predict) and find where it stops falling",
          "Turn on early stopping (n_iter_no_change with a validation fraction) and leave n_estimators high as a ceiling",
          "Lower the learning rate and keep trees shallow; smaller steps usually generalise better",
          "Confirm the final choice once on a test set that was not used for stopping"
        ],
        weak: "More trees should always help, so add more data or a bigger max_depth. That ignores that each tree fits what is left, including noise."
      },
      {
        q: "A teammate says random forests and gradient boosting are both tree ensembles, so it does not matter which you use. How do you answer?",
        good: [
          "A forest trains deep trees independently and averages them; the trees can be built at the same time",
          "Boosting trains shallow trees one after another, each fitted to the residuals of the sum so far, and adds them",
          "Boosting is often more accurate on tables but has more settings (learning rate, trees, depth) and needs early stopping",
          "Neither can extend a trend past the feature values seen in training; both answer flat there"
        ],
        weak: "Boosting is just a better random forest. That misses how each is trained and what each costs to tune."
      }
    ],
    screens: [firstGuess, stumpOne, stumpTwo, spotIdea, learningRate, fromScratch, whenToStop, earlyStop, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
