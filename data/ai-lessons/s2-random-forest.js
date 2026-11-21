/* Lesson: random forests. Story: a gym predicts which members will cancel next month; its single deep tree,
   retrained each month, gives many members a different verdict every time. Ideas: (1) many trees, each grown
   on a bootstrap sample (rows drawn with repeats) and looking at a random few features per split, make
   different mistakes, and their combined verdict moves less than one tree's; (2) the forest's built-in
   feature importances are measured on training splits and favour columns with many distinct values, so
   check importance on validation data (permutation importance) before reading it as "why".
   Data: invented members from docs/ai-path/runs/s2-random-forest/gym_data.py (fixed seeds); every number
   shown comes from these runs on this Mac (scikit-learn 1.9.1, see env.txt):
   - tree_vs_forest.py / .out.txt: one deep tree vs a 100-tree forest, trained on January and on February;
   - by_hand.py / .out.txt: ten members, three bootstrap samples, three one-question trees;
   - sweep.py / .out.txt: number of trees, max_features, min_samples_leaf;
   - library.py / .out.txt: the code screen, run as shown;
   - importance.py / .out.txt: the broken-on-purpose importance chart (member_id left in).
   No model API calls. Lesson-local style: a small data table (.lx-s2-random-forest-*), see ensureStyle(). */
(() => {
  const ID = "s2-random-forest";
  const pct = v => `${(v * 100).toFixed(1)}%`;
  const f3 = v => v.toFixed(3);
  const verdict = v => (v ? "cancel" : "stay");

  /* ---------- Data copied from the runs ---------- */
  // tree_vs_forest.out.txt
  const N_MONTH = 400, N_VAL = 1000;
  const TVF = {
    treeJan: { train: 1.000, val: 0.656, q: "visits_per_week <= 1.7" },
    treeFeb: { train: 1.000, val: 0.693, q: "visits_per_week <= 1.6" },
    forestJan: { train: 0.998, val: 0.729 },
    forestFeb: { train: 0.998, val: 0.735 },
    flipsTree: 343, flipsForest: 192
  };
  // tree_vs_forest.out.txt, first 8 validation members: visits/week, annual (1) or monthly (0), tenure months,
  // days since last visit, age | January tree, February tree verdicts (1 = cancel)
  const EIGHT = [
    [5.9, 0, 19, 30, 60, 0, 0], [2.3, 1, 43, 20, 50, 0, 0], [1.1, 1, 44, 28, 39, 0, 0], [0.2, 0, 31, 19, 53, 0, 0],
    [0.8, 1, 41, 24, 70, 1, 0], [2.0, 0, 12, 0, 22, 0, 0], [1.3, 0, 26, 0, 70, 0, 1], [0.6, 1, 14, 3, 31, 0, 0]
  ];
  // by_hand.out.txt (bootstrap seed 1): ten members [letter, visits/week, annual, days since last visit, cancelled]
  const TEN = [["A", 2.2, 0, 4, 0], ["B", 2.1, 0, 14, 0], ["C", 3.1, 1, 20, 0], ["D", 1.1, 0, 7, 0], ["E", 2.2, 0, 11, 0],
    ["F", 4.0, 1, 20, 1], ["G", 0.3, 1, 19, 1], ["H", 0.9, 0, 24, 1], ["I", 0.8, 1, 15, 1], ["J", 0.6, 0, 19, 1]];
  const NEWM = { visits: 1.4, annual: 0, days: 12 };
  const TREES = [ // sample letters, the question the fitted one-question tree asks (feature, threshold)
    { sample: "A B C D E F H I J J", f: "visits", label: "visits_per_week", thr: 1.0 },
    { sample: "A A C C E E F G I I", f: "visits", label: "visits_per_week", thr: 1.5 },
    { sample: "B D D E F H H I I I", f: "days", label: "days_since_last_visit", thr: 14.5 }
  ];
  const RUN_VOTES = [0, 1, 0]; // by_hand.out.txt "votes: [0, 1, 0]" (checked against the lesson's own count below)
  // sweep.out.txt (fit seconds not used: they vary with machine load)
  const SWEEP = [
    { n: 1, acc: 0.608, flips: 400 }, { n: 10, acc: 0.706, flips: 235 }, { n: 100, acc: 0.729, flips: 192 }, { n: 500, acc: 0.726, flips: 190 }
  ];
  const ALLFEAT = { acc: 0.710, flips: 234 };   // n_estimators=100, max_features=None
  const LEAF5 = { acc: 0.750, flips: 116 };     // n_estimators=100, min_samples_leaf=5
  const N_FEAT = 5;
  // library.py, the 10 lines below its marker (the import sits above it), and library.out.txt
  const CODE = [
    "forest = RandomForestClassifier(",
    "    n_estimators=300, max_features=\"sqrt\",",
    "    min_samples_leaf=5, oob_score=True,",
    "    n_jobs=-1, random_state=0)",
    "forest.fit(members_jan, cancelled_jan)",
    "print(\"oob:\", round(forest.oob_score_, 3))",
    "print(\"val:\", round(forest.score(",
    "    members_val, cancelled_val), 3))",
    "print(forest.predict_proba(",
    "    members_val[:3]).round(2))"
  ];
  const OUT = ["oob: 0.725", "val: 0.749", "[[0.66 0.34]\n [0.93 0.07]\n [0.69 0.31]]"];
  const OOB = 0.725, LIB_VAL = 0.749, PROBA0 = [0.66, 0.34];
  // importance.out.txt (300 trees, all six columns, member_id included)
  const IMP = {
    trainAcc: 1.000, valAcc: 0.719, valAccWithout: 0.725,
    mdi: [["visits_per_week", 0.222], ["tenure_months", 0.208], ["days_since_last_visit", 0.191], ["member_id", 0.188], ["age", 0.156], ["annual_contract", 0.035]],
    perm: [["visits_per_week", 0.038, 0.012], ["days_since_last_visit", 0.021, 0.009], ["tenure_months", 0.003, 0.008], ["annual_contract", 0.001, 0.005], ["age", -0.009, 0.006], ["member_id", -0.015, 0.004]]
  };

  /* ---------- Derived from the data ---------- */
  const flipsShown = EIGHT.filter(r => r[5] !== r[6]).length;
  const byLetter = Object.fromEntries(TEN.map(r => [r[0], { visits: r[1], annual: r[2], days: r[3], cancelled: r[4] }]));
  const TV = TREES.map(t => {
    const rows = t.sample.split(" ");
    const yes = NEWM[t.f] <= t.thr;
    const side = rows.filter(L => (byLetter[L][t.f] <= t.thr) === yes);
    const other = rows.filter(L => (byLetter[L][t.f] <= t.thr) !== yes);
    const cnt = rs => ({ c: rs.filter(L => byLetter[L].cancelled).length, s: rs.filter(L => !byLetter[L].cancelled).length });
    const here = cnt(side), there = cnt(other), all = cnt(rows);
    const distinct = new Set(rows).size;
    const missing = TEN.map(r => r[0]).filter(L => !rows.includes(L));
    const twice = [...new Set(side)].filter(L => side.filter(x => x === L).length > 1); // repeats on the member's side
    return { ...t, rows, yes, side, here, there, all, distinct, missing, twice, vote: here.c > here.s ? 1 : 0, otherVote: there.c > there.s ? 1 : there.c < there.s ? 0 : null, allVote: all.c > all.s ? 1 : all.c < all.s ? 0 : null };
  });
  const VOTES = TV.map(t => t.vote);
  const MAJ = VOTES.filter(v => v).length * 2 > VOTES.length ? 1 : 0;
  const LUCKLESS = TV[1].missing.filter(L => !byLetter[L].cancelled && byLetter[L].visits <= NEWM.visits); // stayers with few visits that tree 2 never saw
  const VOTES_OK = VOTES.every((v, i) => v === RUN_VOTES[i]);
  const flipDrop = TVF.flipsTree - TVF.flipsForest;
  const sqrtFeat = Math.max(1, Math.floor(Math.sqrt(N_FEAT)));
  const mdiRank = name => IMP.mdi.findIndex(r => r[0] === name) + 1;
  const mdiOf = name => IMP.mdi.find(r => r[0] === name)[1];
  const permOf = name => IMP.perm.find(r => r[0] === name)[1];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-wrap { max-width: 100%; overflow-x: auto; margin: 14px 0 0; }
      .lx-${ID}-t { border-collapse: collapse; width: 100%; font-size: 14.5px; }
      .lx-${ID}-t caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .lx-${ID}-t th { text-align: left; font: 600 12.5px/1.3 var(--font); color: var(--muted); padding: 6px 8px 6px 0; border-bottom: 1px solid var(--line); vertical-align: bottom; }
      .lx-${ID}-t td { padding: 7px 8px 7px 0; border-bottom: 1px solid var(--line); font-family: var(--mono); color: var(--ink); white-space: nowrap; }
      .lx-${ID}-t tr.lx-${ID}-hl td { font-weight: 700; }
      .lx-${ID}-t tr.lx-${ID}-faint td { color: var(--faint); }
      .lx-${ID}-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin: 16px 0 0; }
      .lx-${ID}-card { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: var(--surface); min-width: 0; }
      .lx-${ID}-card h3 { margin: 0 0 6px; font-size: 15px; }
      .lx-${ID}-q { font: 600 14px/1.45 var(--mono); margin: 0 0 4px; overflow-wrap: anywhere; }
      .lx-${ID}-small { font-size: 13.5px; color: var(--muted); margin: 6px 0 0; }
      .lx-${ID}-out { font: 500 14px/1.5 var(--mono); white-space: pre-wrap; background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; margin: 10px 0 0; min-height: 1.5em; }
      .lx-${ID}-block { margin: 18px 0 0; }
      .lx-${ID}-check { display: flex; gap: 12px; align-items: center; min-height: 44px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; cursor: pointer; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; border: 2px solid var(--ink-2); background: var(--surface); cursor: pointer; box-shadow: inset 0 0 0 12px var(--surface); }
      .lx-${ID}-check input:checked { background: var(--ink); }
      .lx-${ID}-check input:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  // rows: arrays of cell text (escaped here); opts.hl / opts.faint: sets of row indexes
  function dtable(kit, head, rows, { caption = "", hl = new Set(), faint = new Set() } = {}) {
    return `<div class="lx-${ID}-wrap"><table class="lx-${ID}-t">${caption ? `<caption>${kit.esc(caption)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) =>
      `<tr${hl.has(i) ? ` class="lx-${ID}-hl"` : faint.has(i) ? ` class="lx-${ID}-faint"` : ""}>${r.map(c => `<td>${kit.esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const plan = a => (a ? "annual" : "monthly");
  function ask(kit, opts, correct, picked, feedbacks, num) {
    return `${kit.options(opts, { picked, correct, num })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. The situation: the same members, a different verdict every month. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [0, 1, 2, 3, 4].map(String);
    const right = opts.indexOf(String(flipsShown));
    const fb = opts.map((o, i) => i === right
      ? [`Right: ${flipsShown} of these ${EIGHT.length}. The members did not change; only the training month did. Across all ${N_VAL} kept-aside members, <b>${TVF.flipsTree}</b> got a different verdict from the February tree than from the January tree. Both trees even start with almost the same first question (<code>${kit.esc(TVF.treeJan.q)}</code>, then <code>${kit.esc(TVF.treeFeb.q)}</code>); the differences grow in the deep branches, where each tree learned its own month's accidents.`, true]
      : [+o < flipsShown ? "Count again, row by row: look for rows where the two verdict columns say different things, not for rows that say cancel." : "Some of those rows say the same thing in both columns. Count only rows where January's verdict and February's verdict differ.", false]);
    const paint = () => {
      el.innerHTML = `<h1>The rule that changes its mind</h1>
        <p class="lead">A gym wants to call members who are about to cancel, before they do. Its analyst grows one deep decision tree each month from the last ${N_MONTH} members' records: visits per week, contract plan, months as a member, days since the last visit, age. The front desk complains that the list of "about to cancel" members jumps around from month to month. Staff cannot plan calls from a list that keeps changing. This lesson makes that kind of table-data prediction steadier.</p>
        <p class="lead">Here are eight members the trees never trained on, and what the January tree and the February tree say about them. (The members in this lesson are invented by a small program; every number is from a real run on them.)</p>
        ${dtable(kit, ["#", "visits/wk", "plan", "months", "days away", "Jan tree", "Feb tree"],
          EIGHT.map((r, i) => [i + 1, r[0].toFixed(1), plan(r[1]), r[2], r[3], verdict(r[5]), verdict(r[6])]))}
        <p class="task">How many of these eight members get a different verdict from the February tree?</p>
        <div class="lpanel">${ask(kit, opts, right, ans, fb, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 2. By hand: three bootstrap samples, three one-question trees, one vote. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null], OPTS = ["stay", "cancel"];
    let maj = null;
    const sideWord = t => (t.yes ? "yes" : "no");
    const fbTree = (t, pick) => {
      if (pick === t.vote) {
        const extra = t.twice.length ? ` ${t.twice.join(", ")} ${t.twice.length === 1 ? "was" : "were"} drawn more than once and count${t.twice.length === 1 ? "s" : ""} each time.` : "";
        return [`Right. The new member answers <b>${sideWord(t)}</b>. On that side this sample has ${t.side.join(" ")}: ${t.here.c} cancelled, ${t.here.s} stayed, so this tree votes <b>${verdict(t.vote)}</b>.${extra}`, true];
      }
      if (t.otherVote === pick) return [`That is the majority on the other side of the question. The new member has ${t.f === "visits" ? `${NEWM.visits} visits a week` : `${NEWM.days} days since the last visit`}, so the answer to “${t.label} ≤ ${t.thr.toFixed(1)}?” is <b>${sideWord(t)}</b>. Count only the sample rows that answer ${sideWord(t)} too.`, false];
      if (t.allVote === pick) return [`That is the majority of the whole sample (${t.all.c} cancelled, ${t.all.s} stayed). A tree votes with the rows in the leaf the member lands in, not with all its rows. The new member answers <b>${sideWord(t)}</b>; count only rows on that side.`, false];
      return [`Count the rows on the member's side, with repeats: a letter drawn twice counts twice. The new member answers <b>${sideWord(t)}</b>.`, false];
    };
    const allVoted = () => ans.every((a, i) => a === TV[i].vote);
    const paint = () => {
      const cards = TV.map((t, i) => {
        const uniq = [...new Set(t.rows)];
        const rowsInfo = uniq.map(L => [L, t.f === "visits" ? byLetter[L].visits.toFixed(1) : byLetter[L].days, byLetter[L].cancelled ? "cancel" : "stay", "×" + t.rows.filter(x => x === L).length]);
        return `<div class="lx-${ID}-card" id="t${i}"><h3>Tree ${i + 1}</h3>
          <p class="lx-${ID}-q">${kit.esc(t.label)} ≤ ${t.thr.toFixed(1)}?</p>
          <p class="lx-${ID}-small">Its sample of ${t.rows.length} rows (${uniq.length} different members):</p>
          ${dtable(kit, ["member", t.f === "visits" ? "visits/wk" : "days away", "outcome", "drawn"], rowsInfo)}
          <p class="lx-${ID}-small">This tree's vote for the new member:</p>
          ${ask(kit, OPTS, t.vote, ans[i], OPTS.map((_, k) => fbTree(t, k)))}</div>`;
      }).join("");
      el.innerHTML = `<h1>Three small trees vote</h1>
        <p class="lead">Before code, the idea by hand. Take ten January members, A to J. For each small tree, draw ten rows <b>at random, with repeats</b>: some members land twice, some not at all (×2 in the "drawn" column means that row counts twice). That draw is a <b>bootstrap sample</b>. Each sample grew a tree with one question (the run picked the question; you do not have to).</p>
        <p class="lead">A new member: <b>${NEWM.visits}</b> visits a week, ${plan(NEWM.annual)} plan, last visit <b>${NEWM.days}</b> days ago. To get a tree's vote, answer its question for the new member: yes or no. Then look only at the sample rows with the same answer, counting repeats. The tree votes for the outcome most of those rows had.</p>
        <p class="task">Fill in each tree's vote, then the majority.</p>
        <div class="lx-${ID}-cards">${cards}</div>
        <div class="lx-${ID}-block" id="m"><p class="task">Majority of the three votes:</p>
          ${allVoted() ? ask(kit, OPTS, MAJ, maj, OPTS.map((_, k) => k === MAJ
            ? [`Right: ${VOTES.filter(v => v === MAJ).length} votes to ${VOTES.filter(v => v !== MAJ).length}, the new member is predicted to <b>${verdict(MAJ)}</b>. Tree 2 voted cancel because its sample happened to miss ${LUCKLESS.join(", ")}, the low-visit member${LUCKLESS.length === 1 ? "" : "s"} who stayed: in its sample, everyone with few visits cancelled. One unlucky draw made one odd tree; the other two outvoted it.${VOTES_OK ? "" : " (Note: the lesson's count differs from the run.)"}`, true]
            : ["Count the three votes you filled in: the majority is whichever verdict has two or more.", false])) : `<p class="lx-${ID}-small">Fill in the three votes first.</p>`}</div>`;
      TV.forEach((t, i) => el.querySelectorAll(`#t${i} .lopts button`).forEach(b => b.onclick = () => { ans[i] = +b.dataset.i; paint(); }));
      el.querySelectorAll("#m .lopts button").forEach(b => b.onclick = () => { maj = +b.dataset.i; paint(); if (maj === MAJ && allVoted()) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: why the vote moves less than one tree. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "Each tree in the vote is smarter than the gym's one deep tree",
      "Each tree learns from a different draw, so their odd mistakes differ, and most are outvoted",
      "The forest learns from more members than the single tree",
      "Voting removes every mistake, so the result cannot move"
    ];
    const fb = [
      ["No: each tree is the same kind of tree as before, grown from fewer distinct rows. Tree 2 alone got the new member wrong. The gain is not in any one tree.", false],
      [`Right. A single deep tree learns the real pattern plus the accidents of its rows. Trees grown on different draws share the pattern but not the accidents, so when they vote, the accidents mostly cancel. Many trees, each on its own bootstrap sample, combined by voting: that is <b>bagging</b>. A <b>random forest</b> adds one more twist: at each split a tree may only look at a few features picked at random, so the trees grow even less alike. Retraining on a new month then moves the vote much less than it moves one tree.`, true],
      [`No: each sample has the same number of rows as the data, and fewer distinct members: your three samples held ${TV.map(t => t.distinct).join(", ")} of the 10. The forest never sees a row the single tree did not see.`, false],
      ["No: if all the trees share a mistake, the vote keeps it. Voting only helps where the trees' mistakes differ, which is why the forest works to make the trees different.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why does a vote move less?</h1>
        <p class="lead">One tree in your vote had an unlucky sample and said the wrong thing. The other two outvoted it. A forest does the same with hundreds of trees.</p>
        <p class="task">The gym retrains every month. Why should the vote of many such trees jump less than one deep tree?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Use it with predictions: one tree vs a forest, January and February. */
  function predict({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null; // stage 0: accuracy question, 1: flips question, 2: finished
    const Q = [
      { right: 0, opts: [`Higher than ${pct(TVF.treeJan.val)}`, "About the same", `Lower than ${pct(TVF.treeJan.val)}`],
        fb: [null,
          [`The single tree already scores ${pct(TVF.treeJan.train)} on its own January rows and only ${pct(TVF.treeJan.val)} on members it never saw. That gap is the accidents it memorised. Averaging trees removes some of them, so the forest should do better on unseen members.`, false],
          ["Each forest tree is grown just as deep as the single tree, but the vote cancels much of what any one tree memorised. Lower would mean the vote adds mistakes, and the vote mostly removes them.", false]] },
      { right: 1, opts: [`About ${TVF.flipsTree}, the same as the trees`, `Fewer than ${TVF.flipsTree}, but far from zero`, "Zero: the forest finds the true rule"],
        fb: [null, null,
          [`January and February are different members, and both months are noisy. Even a perfect method trained on different rows can draw some borderline lines differently. A forest moves less, not never.`, false]] }
    ];
    Q[1].fb[0] = [`The forest's vote averages away much of what each month's accidents taught the trees, so it should move less than one tree, not the same.`, false];
    const reveal1 = `Forest: ${pct(TVF.forestJan.val)} on the ${N_VAL} kept-aside members, against ${pct(TVF.treeJan.val)} for the single tree. Same January rows, same features. On their own training rows both models score almost perfectly (tree ${pct(TVF.treeJan.train)}, forest ${pct(TVF.forestJan.train)}), so training accuracy cannot tell them apart. Only validation can.`;
    const reveal2 = `In the run, ${TVF.flipsForest} of ${N_VAL} members got a different verdict from the February forest than from the January forest, against ${TVF.flipsTree} for the two trees: ${flipDrop} fewer. Steadier, not still: borderline members can still go either way.`;
    const paint = () => {
      const rows = [["one deep tree", pct(TVF.treeJan.train), pct(TVF.treeJan.val), String(TVF.flipsTree)],
        ["forest, 100 trees", stage >= 1 ? pct(TVF.forestJan.train) : "?", stage >= 1 ? pct(TVF.forestJan.val) : "?", stage >= 2 ? String(TVF.flipsForest) : "?"]];
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Predict, then check</h1>
        <p class="lead">The analyst trains a forest of 100 trees on the same January rows, and again on February, and checks both on the same ${N_VAL} kept-aside members (the validation set). "Flips" counts members whose verdict changes between the January and the February model.</p>
        ${dtable(kit, ["model (January)", "train acc", "validation acc", "flips Jan→Feb"], rows)}
        ${stage < 2 ? `<p class="task">${stage === 0 ? `The single tree reaches ${pct(TVF.treeJan.val)} on validation. What do you expect for the forest?` : `The two trees disagreed on ${TVF.flipsTree} members. How many flips do you expect for the two forests?`}</p>` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.opts.map((_, i) => i === q.right ? ["", true] : q.fb[i])) : ""}
          ${stage >= 1 ? kit.feedback(reveal1, true) : ""}${stage >= 2 ? kit.feedback(reveal2, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 5. The knobs: number of trees, features per split, leaf size. */
  function knobs({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const s100 = SWEEP.find(r => r.n === 100), s500 = SWEEP.find(r => r.n === 500);
    const Q = [
      { task: "Going from 100 to 500 trees: what happens on validation?", right: 1,
        opts: ["Clearly better again", "About the same", "Worse: too many trees overfit"],
        fb: [[`The big gains came early: from 1 tree to 10 to 100. Each new tree is one more vote, and after enough votes the average hardly moves.`, false], null,
          ["More trees do not make each tree fit the data harder. They only add votes to the average, so the forest does not overfit by growing more trees; it just gets slower.", false]],
        reveal: () => `${s500.n} trees: ${pct(s500.acc)} and ${s500.flips} flips, against ${pct(s100.acc)} and ${s100.flips} at ${s100.n}. That is ${s500.n / s100.n} times as many trees to grow and to run on every prediction, for no gain here. scikit-learn's guide says the same: results stop getting much better beyond some number of trees. Its default is 100.` },
      { task: `max_features="sqrt" lets each split look at ${sqrtFeat} of the ${N_FEAT} features, picked at random. With max_features=None every split may look at all ${N_FEAT}. What happens?`, right: 0,
        opts: ["Worse and jumpier: the trees grow more alike", "Better: each split can pick the best feature", "No change: the trees are already different"],
        fb: [null, ["Each split does pick a better question, but every tree then picks the same strong question at the top and grows alike. Alike trees make the same mistakes, and the vote cannot cancel them.", false],
          ["The bootstrap makes the trees a little different. Limiting features per split makes them much more different, because a strong feature cannot dominate every tree.", false]],
        reveal: () => `All ${N_FEAT} features per split: ${pct(ALLFEAT.acc)} and ${ALLFEAT.flips} flips, against ${pct(s100.acc)} and ${s100.flips} with ${sqrtFeat}. With every feature allowed, it is plain bagging. scikit-learn's guide: a smaller <code>max_features</code> makes the vote steadier, but each tree a little less accurate. "sqrt" is its suggested default for classification.` },
      { task: "Last knob: min_samples_leaf=5 stops any leaf from holding fewer than 5 training rows, so each tree can no longer give one odd member its own leaf. What happens?", right: 0,
        opts: ["Steadier, and here also more accurate", "Less accurate: the trees know less", "No change: the vote already averages"],
        fb: [null, ["The trees lose the ability to memorise single members, and that memory was mostly noise. On this data that trade pays off; check it on validation for yours.", false],
          ["The vote averages trees, but each tree still memorised single members. Bigger leaves remove some of that noise inside every tree, before the vote.", false]],
        reveal: () => `min_samples_leaf=5: ${pct(LEAF5.acc)} and ${LEAF5.flips} flips, the steadiest list yet. On this noisy data that helped; on another dataset it can cost accuracy, so compare on validation.` }
    ];
    const paint = () => {
      const rows = SWEEP.map(r => [String(r.n), "sqrt", "1", r.n === 500 && stage < 1 ? "?" : pct(r.acc), r.n === 500 && stage < 1 ? "?" : String(r.flips)]);
      rows.push(["100", "None", "1", stage >= 2 ? pct(ALLFEAT.acc) : "?", stage >= 2 ? String(ALLFEAT.flips) : "?"]);
      rows.push(["100", "sqrt", "5", stage >= 3 ? pct(LEAF5.acc) : "?", stage >= 3 ? String(LEAF5.flips) : "?"]);
      const q = Q[Math.min(stage, Q.length - 1)];
      el.innerHTML = `<h1>The three knobs that matter</h1>
        <p class="lead">Same January and February rows, same validation members. Each row is a forest with different settings. A 1-tree forest is one tree on one bootstrap sample, seeing ${sqrtFeat} random features per split, so it does worse than the gym's full tree.</p>
        ${dtable(kit, ["trees", "features", "min leaf", "val acc", "flips"], rows, { caption: "trees = n_estimators, features = max_features, min leaf = min_samples_leaf", hl: new Set([stage === 0 ? 3 : stage === 1 ? 4 : stage === 2 ? 5 : -1]) })}
        ${stage < Q.length ? `<p class="task">${q.task}</p>` : ""}
        <div class="lpanel">${stage < Q.length ? ask(kit, q.opts, q.right, ans, q.opts.map((_, i) => i === q.right ? ["", true] : q.fb[i])) : ""}
          ${Q.slice(0, stage).map(x => kit.feedback(x.reveal(), true)).join("")}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 6. The same thing in scikit-learn, as a recorded run. */
  const STEPS = [
    { ln: 0, out: 0, say: "One class does the whole forest: bootstrap samples, random features per split, and the combined verdict." },
    { ln: 1, out: 0, say: "Two knobs from the last screen: 300 trees, and a random few features per split (the square root of the feature count)." },
    { ln: 2, out: 0, say: "The third knob: at least 5 training rows per leaf. <code>oob_score=True</code> turns on a free check. Every bootstrap sample leaves some rows out; those rows are “out of bag” for that tree. Each training row is scored only by the trees that never saw it, so no extra data is needed." },
    { ln: 3, out: 0, say: "<code>n_jobs=-1</code> grows trees on all CPU cores at once; the trees do not depend on each other. <code>random_state</code> makes the run repeatable." },
    { ln: 4, out: 0, say: "Fit grows all 300 trees on the January rows. All of them are kept, and all of them run on every prediction." },
    { ln: 5, out: 1, say: () => `Out-of-bag accuracy, from the January rows alone: ${pct(OOB)}.` },
    { ln: 6, out: 2, say: () => `On the kept-aside members: ${pct(LIB_VAL)}. The out-of-bag estimate was in the same range, without spending any extra rows.` },
    { ln: 8, out: 3, say: "One row per member: the chance of stay, then the chance of cancel." }
  ];
  function libraryRun({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null, seenEnd = false;
    const RIGHT = 1;
    const opts = [
      `${pct(PROBA0[1])} of the 300 trees voted cancel`,
      `The average of the 300 trees' cancel chances for this member`,
      `This member cancels in ${pct(PROBA0[1])} of months`
    ];
    const fb = [
      ["Close, but scikit-learn does not count yes/no votes. Each tree gives a chance (the share of cancelled training members in the leaf the member lands in), and the forest averages those chances. The original random forest paper counted votes; scikit-learn's guide says it averages instead.", false],
      [`Right. Each tree gives the share of cancelled members in its leaf; the forest averages the 300 shares. <code>predict</code> then picks the class with the higher average, here “stay”. For calling members, you can sort them by this number instead of using the yes/no verdict.`, true],
      ["There is only one next month for this member. The number is the model's average of its trees' leaf shares, a score for ranking, not a measured frequency for this person.", false]
    ];
    const paint = () => {
      const s = STEPS[i];
      const say = typeof s.say === "function" ? s.say() : s.say;
      el.innerHTML = `<h1>The forest in scikit-learn</h1>
        <p class="lead">The class is imported first with <code>from sklearn.ensemble import RandomForestClassifier</code>. <code>members_jan</code> holds the January rows (five features), <code>cancelled_jan</code> the outcomes; <code>_val</code> are the kept-aside members. This code ran on this Mac; the output is from that run.</p>
        <p class="task">Step through the run, then answer the question below it.</p>
        ${kit.code(CODE, s.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === STEPS.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>step <b>${i + 1} / ${STEPS.length}</b></span></div>
        <div class="lx-${ID}-out" aria-label="output">${kit.esc(OUT.slice(0, s.out).join("\n"))}</div>
        ${kit.feedback(say)}
        <div class="lx-${ID}-block"><p class="task">The first member's row is <code>[${PROBA0.join(" ")}]</code>. What is ${PROBA0[1]}?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; if (i === STEPS.length - 1) seenEnd = true; paint(); if (seenEnd && ans === RIGHT) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (seenEnd && ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: an importance chart that ranks a random number. */
  function brokenImportance({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const RANK_ID = mdiRank("member_id");
    const Q = [
      { task: "Which row proves this chart cannot be read as “why members cancel”?", right: IMP.mdi.findIndex(r => r[0] === "member_id"),
        opts: IMP.mdi.map(r => `<span style="font-family:var(--mono)">${kit.esc(r[0])} ${r[1].toFixed(3)}</span>`),
        fb: IMP.mdi.map(r => r[0] === "member_id" ? null
          : r[0] === "age" ? ["Age might matter or might not; nothing on this slide proves it either way. One row is a number with no meaning at all, and it still scores high.", false]
          : r[0] === "annual_contract" ? [`Its low score is suspicious too: it has only two values, and this kind of importance under-rates columns with few values. But low is not proof of anything. Look for a row that cannot be a reason at all.`, false]
          : [`${r[0]} could plausibly drive cancelling, so a high score here proves nothing wrong. Find the row that cannot be a reason at all.`, false]) },
      { task: "Why did a random number score so high?", right: 0,
        opts: ["The scores come from the training splits: deep trees use any column with many different values to split off single members, and every such split earns it credit",
          "member_id really predicts cancelling, for example older members have lower ids",
          "300 trees are too few; with more trees member_id would fall to zero",
          "The features were not scaled to the same range"],
        fb: [null,
          ["The ids are random numbers, given with no order. And tenure is already a column: if old members had low ids, the forest would not need the id. The check on the next step shows it adds nothing on new members.", false],
          ["The score is already an average over 300 trees. More trees average the same bias; they do not remove it.", false],
          ["Trees split on thresholds such as “≤ 1.7”. Scaling a column moves its thresholds but not which rows go left or right, so scale cannot change a tree's importances.", false]] },
      { task: "What do you show the manager instead? (Permutation importance shuffles one column in the validation rows and measures how much accuracy drops.)", right: 1,
        opts: ["The same chart with member_id deleted", "Permutation importance on the validation members", "The same chart from a forest of 1,000 trees"],
        fb: [["Deleting the row you caught hides the problem but keeps it: age and the other columns with many values got the same unearned credit.", false], null,
          ["More trees average the same training-split credit. The bias stays.", false]] }
    ];
    const permTable = () => dtable(kit, ["feature", "accuracy drop", "± spread"], IMP.perm.map(r => [r[0], r[1].toFixed(3), r[2].toFixed(3)]), { caption: "Permutation importance on the validation members: average accuracy drop over 10 shuffles; ± spread is how much the drop varied" });
    const reveals = [
      `Right. <code>member_id</code> is a random six-digit number given at sign-up. It cannot cause anything, yet the forest ranks it number ${RANK_ID} of ${IMP.mdi.length}, with ${mdiOf("member_id").toFixed(3)}, almost level with days since the last visit.`,
      `Right. <code>feature_importances_</code> adds up how much each column's splits lowered the Gini impurity of the <i>training</i> rows. The forest scored ${pct(IMP.trainAcc)} on its training rows: deep trees split off single members, and a column with a different value for every member is perfect for that. scikit-learn's guide names both flaws: measured on training data, and favouring columns with many distinct values.`,
      `Right. A column the model only used to memorise training members drops nothing on new members:${permTable()}<p><code>member_id</code> and <code>age</code> come out at or below zero: shuffling them does not hurt. Removing <code>member_id</code> moved validation accuracy from ${pct(IMP.valAcc)} to ${pct(IMP.valAccWithout)}. One more caution from the same guide: when two columns are strongly related, shuffling one leaves the other, so both can look unimportant.</p>`
    ];
    const paint = () => {
      const q = Q[Math.min(stage, Q.length - 1)];
      el.innerHTML = `<h1>The chart that blamed a member number</h1>
        <p class="lead">To explain the forest to the manager, the analyst trained it on all six January columns, <code>member_id</code> included by mistake, and put its built-in <code>feature_importances_</code> on a slide titled “Top reasons members cancel”. Real output:</p>
        ${dtable(kit, ["feature", "importance"], IMP.mdi.map(r => [r[0], r[1].toFixed(3)]), { caption: "forest.feature_importances_ (300 trees, January rows)", hl: stage >= 1 ? new Set([RANK_ID - 1]) : new Set() })}
        ${stage < Q.length ? `<p class="task">${q.task}</p>` : ""}
        <div class="lpanel">${Q.slice(0, stage).map((_, k) => kit.feedback(reveals[k], true)).join("")}
          ${stage < Q.length ? ask(kit, q.opts, q.right, ans, q.opts.map((_, i) => i === q.right ? ["", true] : q.fb[i])) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 2;
    const opts = [
      "A shop predicts which orders will be returned, from 20 columns of order data, and wants fewer false alarms than its single tree gives",
      "A clinic ranks which patients may miss appointments, from a table of past visits, and only needs a good ranking",
      "A council must print the exact rule that decides who gets a parking permit, so any citizen can check their own case"
    ];
    const fb = [
      ["This is the forest's home ground: a table of columns, one jumpy tree, and accuracy that matters more than a readable rule.", false],
      ["A forest fits: tabular data, and its averaged chances give a ranking directly.", false],
      ["Right. The decision must be a rule people can read and check. A forest is hundreds of trees voting; no one can follow it by hand. One small tree or a points table (a linear model) is the honest choice there, even if it is a little less accurate.", true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a forest</h1>
        <p class="lead">A random forest is many deep trees, each grown on its own bootstrap sample with a random few features per split, whose answers are averaged.</p>
        <p class="lead"><b>For:</b> tables of rows and columns, when one tree is too jumpy. scikit-learn's default settings often do well, and out-of-bag scores give a free check.</p>
        <p class="lead"><b>Not when:</b> people must read the rule (use one small tree or a linear model); a regression must predict beyond the values it trained on (a forest averages training values, so it never goes higher than the highest it saw); the input is raw text or images (other models fit those). For the last bit of accuracy on a table, compare it with gradient boosting (the next lesson).</p>
        <p class="lead"><b>Costs:</b> every tree is stored and runs on every prediction, so memory and prediction time grow with the number of trees; the single readable rule is gone; importances need checking on validation.</p>
        <p class="task">Which of these teams should <b>not</b> reach for a random forest?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A bike repair shop predicts which tickets will be finished late, from 15 columns (part type, mechanic, queue length, ...). Its single tree's list of late tickets changes a lot every week it is retrained.", true,
      "Yes. A table of columns and a jumpy single tree is exactly what a forest fixes: many trees on different draws, combined, move less from one retrain to the next.",
      "Tabular data, a classification, and a single tree whose answers jump between retrains: that is the case the forest was made for. Try it and compare on validation."],
    ["A furniture maker predicts the price of next year's sofas from size and materials. Next year's line includes sofas larger than any it has made before, and prices above any it has sold.", false,
      "No. A forest's price prediction is an average of training prices, so it can never go above the highest price it saw. For values beyond the training range, a model that extends a trend (a linear model, for example) is the better start.",
      "A forest averages the prices in its leaves, which are all past prices. The biggest new sofa lands in the same leaves as the biggest old one and gets an old price. It cannot extrapolate."],
    ["An insurer flags suspicious claims from 30 columns per claim. It wants better accuracy than one tree and can afford to run a few hundred small trees per claim.", true,
      "Yes. Tabular data, accuracy over a readable rule, and the cost of many trees per prediction is acceptable. Check the important columns with permutation importance before telling investigators what the model looks at.",
      "Accuracy matters more than a readable rule, the data is a table, and the prediction cost is affordable. That is a good fit; just do not read its built-in importances as reasons."],
    ["A hiring rule must be explained to every rejected applicant as one short list of conditions they failed.", false,
      "No. Each rejection needs a rule a person can read. A forest's answer is an average over hundreds of trees, with no single path to show. One shallow tree or a simple scored checklist fits.",
      "The forest has no single list of conditions: each of its trees asks different questions, and the answer is their average. When the rule itself must be shown, use one small tree or a linear model."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Forest or not?</h1>
        <p class="lead">Four problems from other places.</p>
        <p class="task">Would you reach for a random forest in each? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and what you should see. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s2-random-forest.ipynb";
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const CHECK = [
      `Step 2: the single January tree prints train acc ${f3(TVF.treeJan.train)} and validation acc ${f3(TVF.treeJan.val)}.`,
      `Step 5: the 100-tree forest prints validation acc ${f3(TVF.forestJan.val)}, higher than the single tree.`,
      `Step 5: forest flips ${TVF.flipsForest} of ${N_VAL}, against tree flips ${TVF.flipsTree} of ${N_VAL}.`,
      `Step 6: 100 trees print ${f3(SWEEP.find(r => r.n === 100).acc)} and 500 trees ${f3(SWEEP.find(r => r.n === 500).acc)}: more trees barely change validation accuracy.`,
      `Steps 8 and 9: <code>feature_importances_</code> gives <code>member_id</code> ${f3(mdiOf("member_id"))}, close to the real features; permutation importance on validation puts it below zero (${f3(permOf("member_id"))}).`
    ];
    el.innerHTML = `<h1>You can grow a forest</h1>
      <p class="lead">You voted with three small trees grown on bootstrap samples, saw why their differing mistakes cancel, tuned the three knobs that matter, and caught an importance chart that ranked a random number.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a> and run it.` : "The notebook for this lesson is on its way."} It trains the tree and the forest on the gym members. What you should see:</p>
      <div>${CHECK.map(c => `<label class="lx-${ID}-check"><input type="checkbox"><span>${c}</span></label>`).join("")}</div>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Here the trees were grown apart and voted; next, each new tree is grown to fix the errors the earlier ones left.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Random forests: many trees voting",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/ensemble.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestRegressor.html",
      "https://scikit-learn.org/stable/modules/permutation_importance.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.inspection.permutation_importance.html",
      "https://link.springer.com/article/10.1023/A:1010933404324"
    ],
    interview: [
      {
        q: "Your churn model's feature importance chart puts customer_id in the top three. The product team wants to act on the chart. What do you tell them, and what do you do?",
        good: [
          "The built-in importance of a forest is measured on training splits and favours columns with many distinct values; an id is perfect for memorising rows",
          "Remove the id from the features, it cannot cause churn",
          "Recompute importance with permutation importance on a held-out set before anyone reads it",
          "Warn that related columns share importance, so a low score does not prove a column is useless",
          "Importance says what the model uses, not what causes churn"
        ],
        weak: "Say customer_id must be important because the model says so, or just delete that bar and present the rest of the chart unchanged."
      },
      {
        q: "A single decision tree gives very different predictions every time you retrain it on new data. What would you try, and what does the fix cost?",
        good: [
          "The tree has high variance: it learns the accidents of each training set",
          "Train a random forest: many trees on bootstrap samples with a random subset of features per split, combined",
          "Tune n_estimators until validation stops improving, max_features, and a minimum leaf size",
          "Measure stability directly: count how many held-out predictions change between retrains",
          "Cost: you lose the single readable rule, and memory and prediction time grow with the number of trees"
        ],
        weak: "Make the tree deeper or add more trees without checking validation, or not mention that the forest is no longer readable."
      }
    ],
    screens: [situation, byHand, spotIdea, predict, knobs, libraryRun, brokenImportance, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#t1 [data-wrong]"], right: ["#t0 [data-right]", "#t1 [data-right]", "#t2 [data-right]", "#m [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(STEPS.length - 1).fill("[data-next]").concat(["[data-right]"]) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
