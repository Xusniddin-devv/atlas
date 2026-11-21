/* Lesson: decision trees, choosing the best question. Story: a neighbourhood gym wants to know which members are
   about to cancel, from visits per week, contract type and tenure. Ideas: (1) a tree picks each question by
   trying every candidate and keeping the one with the lowest size-weighted Gini impurity; (2) a tree grown until
   every leaf is pure writes rules for single members, so it overfits, and depth must be limited and chosen on
   validation data.
   Data, all real (no model API calls in this lesson):
   - docs/ai-path/runs/s2-decision-tree/gym12.py + gym12.out.txt: the twelve members, the Gini of every candidate
     split, the traced best_question (the listing on the code screen) and the tree grown until pure;
   - docs/ai-path/runs/s2-decision-tree/depth_curve.py + depth_curve.out.txt: a from-scratch NumPy tree on 1000
     made-up members (seed 0), train and validation accuracy for max_depth 1 to 12 and no limit.
   Lesson-local style: member chips, a wide table and an indented tree (.lx-s2-decision-tree-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s2-decision-tree";
  const P = `lx-${ID}`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const f3 = x => x.toFixed(3);
  const pct = x => `${(x * 100).toFixed(1)}%`;

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s2-decision-tree/gym12.py (MEMBERS): name, visits per week, monthly contract (1 = yes),
  // tenure in months, cancelled (1 = yes)
  const MEMBERS = [
    ["Aziz", 0, 1, 1, 1], ["Bora", 1, 1, 1, 1], ["Chen", 1, 1, 8, 1], ["Dilnoza", 0, 0, 14, 1],
    ["Emil", 3, 1, 5, 1], ["Farida", 1, 0, 20, 0], ["Gwen", 2, 1, 6, 0], ["Hana", 3, 1, 11, 0],
    ["Ilya", 4, 1, 3, 0], ["Jae", 2, 0, 26, 0], ["Kamila", 5, 0, 9, 0], ["Leo", 3, 0, 30, 0]
  ].map(([name, visits, monthly, tenure, cancelled]) => ({ name, visits, monthly, tenure, cancelled }));

  // The listing is best_question from gym12.py, line for line (line 0 = the def line).
  const CODE = [
    "def best_question(visits, cancelled):",
    "    n = len(cancelled)",
    "    best_t, best_score = None, 1.0",
    "    for t in np.unique(visits)[:-1]:",
    "        left = cancelled[visits <= t]",
    "        right = cancelled[visits > t]",
    "        w_left = len(left) * gini(left)",
    "        w_right = len(right) * gini(right)",
    "        score = (w_left + w_right) / n",
    "        if score < best_score:",
    "            best_t, best_score = t, score",
    "    return best_t, best_score"
  ];
  const GINI_CODE = [
    "def gini(group):",
    "    p = group.mean()",
    "    return 1 - p**2 - (1 - p)**2"
  ];
  // Trace rows from gym12.out.txt: [line about to run, event (l = line, r = return), t, left members, left cancelled,
  // right members, right cancelled, score, best_t, best_score]. The traced left/right arrays are shown as their
  // length and their sum (members, cancelled); everything else is as printed. n, w_left and w_right are not shown.
  const TRACE = [[1,"l",null,null,null,null,null,null,null,null],[2,"l",null,null,null,null,null,null,null,null],[3,"l",null,null,null,null,null,null,null,1],[4,"l",0,null,null,null,null,null,null,1],[5,"l",0,2,2,null,null,null,null,1],[6,"l",0,2,2,10,3,null,null,1],[7,"l",0,2,2,10,3,null,null,1],[8,"l",0,2,2,10,3,null,null,1],[9,"l",0,2,2,10,3,0.3500000000000001,null,1],[10,"l",0,2,2,10,3,0.3500000000000001,null,1],[3,"l",0,2,2,10,3,0.3500000000000001,0,0.3500000000000001],[4,"l",1,2,2,10,3,0.3500000000000001,0,0.3500000000000001],[5,"l",1,5,4,10,3,0.3500000000000001,0,0.3500000000000001],[6,"l",1,5,4,7,1,0.3500000000000001,0,0.3500000000000001],[7,"l",1,5,4,7,1,0.3500000000000001,0,0.3500000000000001],[8,"l",1,5,4,7,1,0.3500000000000001,0,0.3500000000000001],[9,"l",1,5,4,7,1,0.27619047619047604,0,0.3500000000000001],[10,"l",1,5,4,7,1,0.27619047619047604,0,0.3500000000000001],[3,"l",1,5,4,7,1,0.27619047619047604,1,0.27619047619047604],[4,"l",2,5,4,7,1,0.27619047619047604,1,0.27619047619047604],[5,"l",2,7,4,7,1,0.27619047619047604,1,0.27619047619047604],[6,"l",2,7,4,5,1,0.27619047619047604,1,0.27619047619047604],[7,"l",2,7,4,5,1,0.27619047619047604,1,0.27619047619047604],[8,"l",2,7,4,5,1,0.27619047619047604,1,0.27619047619047604],[9,"l",2,7,4,5,1,0.41904761904761906,1,0.27619047619047604],[3,"l",2,7,4,5,1,0.41904761904761906,1,0.27619047619047604],[4,"l",3,7,4,5,1,0.41904761904761906,1,0.27619047619047604],[5,"l",3,10,5,5,1,0.41904761904761906,1,0.27619047619047604],[6,"l",3,10,5,2,0,0.41904761904761906,1,0.27619047619047604],[7,"l",3,10,5,2,0,0.41904761904761906,1,0.27619047619047604],[8,"l",3,10,5,2,0,0.41904761904761906,1,0.27619047619047604],[9,"l",3,10,5,2,0,0.4166666666666667,1,0.27619047619047604],[3,"l",3,10,5,2,0,0.4166666666666667,1,0.27619047619047604],[4,"l",4,10,5,2,0,0.4166666666666667,1,0.27619047619047604],[5,"l",4,11,5,2,0,0.4166666666666667,1,0.27619047619047604],[6,"l",4,11,5,1,0,0.4166666666666667,1,0.27619047619047604],[7,"l",4,11,5,1,0,0.4166666666666667,1,0.27619047619047604],[8,"l",4,11,5,1,0,0.4166666666666667,1,0.27619047619047604],[9,"l",4,11,5,1,0,0.4545454545454546,1,0.27619047619047604],[3,"l",4,11,5,1,0,0.4545454545454546,1,0.27619047619047604],[11,"l",4,11,5,1,0,0.4545454545454546,1,0.27619047619047604],[11,"r",4,11,5,1,0,0.4545454545454546,1,0.27619047619047604]];

  // The tree grown until every leaf is pure, from gym12.out.txt ("full tree"), leaves trimmed to n and who.
  const FULL_TREE = {
    q: "visits <= 1", n: 12, cancel: 5,
    yes: { q: "tenure <= 14", n: 5, cancel: 4,
      yes: { leaf: 1, n: 4, who: ["Aziz", "Bora", "Chen", "Dilnoza"] },
      no: { leaf: 0, n: 1, who: ["Farida"] } },
    no: { q: "tenure <= 5", n: 7, cancel: 1,
      yes: { q: "visits <= 3", n: 2, cancel: 1,
        yes: { leaf: 1, n: 1, who: ["Emil"] },
        no: { leaf: 0, n: 1, who: ["Ilya"] } },
      no: { leaf: 0, n: 5, who: ["Gwen", "Hana", "Jae", "Kamila", "Leo"] } }
  };
  const NEWCOMER = { name: "Mira", visits: 3, monthly: 1, tenure: 4 }; // a new member the lesson asks about (not in the data)

  // From docs/ai-path/runs/s2-decision-tree/depth_curve.out.txt (seed 0; 600 train, 400 validation)
  const DEPTH_RUN = {
    train: 600, val: 400, baselineVal: 0.700, // "always say 'stays'" on validation
    rows: [ // [max_depth or null = no limit, train_acc, val_acc, leaves, leaves holding one member]
      [1, 0.707, 0.695, 2, 0], [2, 0.755, 0.718, 4, 0], [3, 0.762, 0.740, 8, 0], [4, 0.775, 0.757, 15, 0],
      [5, 0.785, 0.765, 29, 1], [6, 0.808, 0.730, 48, 6], [7, 0.823, 0.733, 72, 12], [8, 0.847, 0.715, 100, 25],
      [9, 0.860, 0.698, 126, 38], [10, 0.867, 0.703, 141, 44], [11, 0.870, 0.700, 157, 52], [12, 0.875, 0.695, 165, 56],
      [null, 0.880, 0.695, 178, 61]
    ]
  };

  /* ---------- Derived from the data ---------- */
  const gini = ms => { if (!ms.length) return 0; const p = ms.filter(m => m.cancelled).length / ms.length; return 1 - p * p - (1 - p) * (1 - p); };
  const nC = ms => ms.filter(m => m.cancelled).length;
  function split(test) {
    const yes = MEMBERS.filter(test), no = MEMBERS.filter(m => !test(m));
    const w = (yes.length * gini(yes) + no.length * gini(no)) / MEMBERS.length;
    return { yes, no, w };
  }
  const SPLIT_CONTRACT = split(m => m.monthly === 1);
  const SPLIT_VISITS = split(m => m.visits <= 1);
  const SPLIT_TENURE1 = split(m => m.tenure <= 1);
  const ROOT_G = gini(MEMBERS), ROOT_C = nC(MEMBERS), N = MEMBERS.length;
  const uniq = k => [...new Set(MEMBERS.map(m => m[k]))].sort((a, b) => a - b);
  const VISIT_CUTS = uniq("visits").slice(0, -1).map(t => ({ t, ...split(m => m.visits <= t) }));
  const TENURE_CUTS = uniq("tenure").slice(0, -1).map(t => ({ t, ...split(m => m.tenure <= t) }));
  const BEST_TENURE = TENURE_CUTS.reduce((a, b) => (b.w < a.w - 1e-12 ? b : a));
  const BEST_VISIT = VISIT_CUTS.reduce((a, b) => (b.w < a.w - 1e-12 ? b : a));

  const leavesOf = n => (n.leaf != null ? [n] : [...leavesOf(n.yes), ...leavesOf(n.no)]);
  const askNode = (n, m) => { const [f, , t] = n.q.split(" "); return m[f] <= +t; };
  function pathOf(m) { const steps = []; let n = FULL_TREE; while (n.leaf == null) { const y = askNode(n, m); steps.push([n.q, y]); n = y ? n.yes : n.no; } return { steps, leaf: n }; }

  const DR = DEPTH_RUN.rows;
  const depthName = d => (d == null ? "no limit" : String(d));
  const BEST_ROW = DR.reduce((a, b) => (b[2] > a[2] ? b : a));
  const NOLIMIT = DR[DR.length - 1];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
      .${P}-wrap { overflow-x: auto; margin: 14px 0 0; }
      .${P}-tbl { border-collapse: collapse; width: 100%; font-size: 15px; }
      .${P}-tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .${P}-tbl th, .${P}-tbl td { padding: 6px 8px; border-bottom: 1px solid var(--line); text-align: right; }
      .${P}-tbl th { font: 600 12.5px/1.3 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .${P}-tbl th:first-child, .${P}-tbl td:first-child { text-align: left; }
      .${P}-tbl td { font-family: var(--mono); font-size: 14px; white-space: nowrap; }
      .${P}-tbl tr.${P}-on td { font-weight: 700; }
      .${P}-tbl tr.${P}-on td:first-child { box-shadow: inset 3px 0 0 var(--ink); padding-left: 10px; }
      .${P}-groups { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0 0; }
      .${P}-grp { border: 1px solid var(--line); border-radius: 6px; padding: 10px; background: var(--surface); min-width: 0; }
      .${P}-grp h3 { margin: 0 0 8px; font-size: 14.5px; font-weight: 600; }
      .${P}-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .${P}-chip { font-size: 13.5px; line-height: 1.3; padding: 3px 7px; border: 1px solid var(--line); border-radius: 4px; }
      .${P}-chip.${P}-c { border: 2px solid var(--ink); font-weight: 600; }
      .${P}-g { margin: 8px 0 0; font: 500 13.5px var(--mono); color: var(--muted); }
      .${P}-tree { margin: 14px 0 0; font-size: 15px; line-height: 1.45; }
      .${P}-tree ul { list-style: none; margin: 0; padding-left: 18px; border-left: 1px solid var(--line); }
      .${P}-tree > ul { padding-left: 0; border-left: 0; }
      .${P}-tree li { padding: 4px 0; }
      .${P}-q { font: 600 14px var(--mono); }
      .${P}-ans { font: 500 13px var(--mono); color: var(--muted); }
      .${P}-leaf { font-weight: 600; }
      .${P}-who { color: var(--muted); font-size: 13.5px; }
      .${P}-on > .${P}-node { box-shadow: inset 3px 0 0 var(--ink); padding-left: 8px; }
      .${P}-formula { font: 500 15px/1.6 var(--mono); padding: 8px 12px; border-left: 3px solid var(--line); margin: 12px 0 0; overflow-wrap: anywhere; }
      @media (max-width: 520px) { .${P}-groups { grid-template-columns: 1fr; } .${P}-tbl th, .${P}-tbl td { padding: 6px 5px; } }
    `;
    document.head.appendChild(s);
  }
  const keyLine = `<p class="${P}-g">Chips with a thick frame and bold name = cancelled.</p>`;
  const chips = (kit, ms) => `<div class="${P}-chips">${ms.map(m => `<span class="${P}-chip${m.cancelled ? ` ${P}-c` : ""}">${kit.esc(m.name)}</span>`).join("")}</div>`;
  const group = (kit, title, ms, extra) => `<div class="${P}-grp"><h3>${kit.esc(title)} (${ms.length})</h3>${chips(kit, ms)}${extra ? `<p class="${P}-g">${extra}</p>` : ""}</div>`;
  const groups = (kit, a, b) => `<div class="${P}-groups">${a}${b}</div>`;
  function memberTable(kit) {
    return `<div class="${P}-wrap"><table class="${P}-tbl"><caption>Last quarter's sample of ${N} members</caption>
      <thead><tr><th>member</th><th>visits / wk</th><th>contract</th><th>tenure (mo)</th><th>cancelled</th></tr></thead>
      <tbody>${MEMBERS.map(m => `<tr><td>${kit.esc(m.name)}</td><td>${m.visits}</td><td>${m.monthly ? "monthly" : "annual"}</td><td>${m.tenure}</td><td>${m.cancelled ? "yes" : "no"}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. The situation: sort the members by two candidate questions and count. */
  function situation({ el, done, kit }) {
    ensureStyle();
    const Q = [
      { ms: SPLIT_CONTRACT.yes, label: "monthly contract" },
      { ms: SPLIT_VISITS.yes, label: "1 visit a week or fewer" }
    ];
    const ans = Q.map(() => null);
    const optsFor = q => { const r = nC(q.ms); return [r - 1, r, r + 1].map(String); };
    const paint = () => {
      const ok = Q.map((q, i) => ans[i] === 1);
      el.innerHTML = `<h1>Who is about to cancel?</h1>
        <p class="lead">A neighbourhood gym loses members every month, and the front desk only notices when the card is handed back. The manager pulled last quarter's records for ${N} members: how often each one came, the kind of contract and how long they had been a member. ${ROOT_C} of the ${N} cancelled. She wants a few plain yes/no questions that point at the members likely to leave next, so the desk can call them first. A model that learns such questions from past records is a <b>decision tree</b>. This lesson shows how it picks each question.</p>
        ${memberTable(kit)}
        <p class="task">Two first questions are on the table. For each, count how many of the members who answer “yes” cancelled.</p>
        ${Q.map((q, i) => `<div class="lcase" id="c${i}"><p>Of the ${plural(q.ms.length, "member")} with a <b>${q.label}</b>, how many cancelled?</p>
          ${ask(kit, optsFor(q), 1, ans[i], [
            [`Count again in the table: the rows with ${q.label === "monthly contract" ? "“monthly” in the contract column" : "0 or 1 in the visits column"}, then the ones with “yes” in the last column.`, false],
            [`Right: ${nC(q.ms)} of ${q.ms.length}. The other ${q.ms.length - nC(q.ms)} stayed.`, true],
            [`That is one too many. Only count rows that answer “yes” to the question <i>and</i> have “yes” under cancelled.`, false]])}</div>`).join("")}
        ${ok.every(Boolean) ? `${groups(kit, group(kit, "Monthly contract", SPLIT_CONTRACT.yes, `${nC(SPLIT_CONTRACT.yes)} of ${SPLIT_CONTRACT.yes.length} cancelled`), group(kit, "Visits ≤ 1 a week", SPLIT_VISITS.yes, `${nC(SPLIT_VISITS.yes)} of ${SPLIT_VISITS.yes.length} cancelled`))}${keyLine}
          ${kit.feedback("Both questions pull cancellers together, but neither group is clean. To choose between them you need a number that says how mixed a group is. That is the next screen.")}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint(); if (ans.every(a => a === 1)) done();
      }));
    };
    paint();
  }

  /* 2. By hand: Gini impurity of the four groups, then the size-weighted score of each question. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    const C = SPLIT_CONTRACT, V = SPLIT_VISITS;
    const G = [
      { title: "Monthly contract: yes", ms: C.yes }, { title: "Monthly contract: no", ms: C.no },
      { title: "Visits ≤ 1: yes", ms: V.yes }, { title: "Visits ≤ 1: no", ms: V.no }
    ];
    const STEPS = [
      ...G.map(g => ({ kind: "g", g })),
      { kind: "w", name: "monthly contract?", s: C, a: G[0], b: G[1] },
      { kind: "w", name: "visits ≤ 1?", s: V, a: G[2], b: G[3] }
    ];
    let k = 0, wrong = null;
    const optsFor = (st, i) => {
      let vals;
      if (st.kind === "g") { const p = nC(st.g.ms) / st.g.ms.length; vals = [[gini(st.g.ms), "r"], [p, "p"], [1 - p * p, "half"]]; }
      else { const ga = gini(st.a.ms), gb = gini(st.b.ms); vals = [[st.s.w, "r"], [(ga + gb) / 2, "mean"], [ga + gb, "sum"]]; }
      const rot = i % 3; return vals.slice(rot).concat(vals.slice(0, rot));
    };
    const why = (st, kind) => {
      if (st.kind === "g") {
        const c = nC(st.g.ms), n = st.g.ms.length;
        return kind === "p" ? `That is the share who cancelled, ${c}/${n}. The score is the chance that two picks <i>disagree</i>: 1 − (${c}/${n})² − (${n - c}/${n})².`
          : `You subtracted only the cancellers' part. The stayers can also be picked twice in a row: subtract (${n - c}/${n})² too.`;
      }
      return kind === "mean" ? `That is the plain average of the two scores. It treats a group of ${st.a.ms.length} and a group of ${st.b.ms.length} as equally important. Weight each score by how many members it covers.`
        : "Adding the two scores can give more than 0.5, which no group of two outcomes can reach. Weight each score by its share of the members and add those.";
    };
    const done1 = i => `${f3(i < 4 ? gini(G[i].ms) : STEPS[i].s.w)}`;
    const paint = () => {
      const fin = k >= STEPS.length;
      const st = STEPS[Math.min(k, STEPS.length - 1)];
      const opts = fin ? [] : optsFor(st, k);
      const gx = i => (k > i ? `score ${done1(i)}` : `${nC(G[i].ms)} of ${G[i].ms.length} cancelled`);
      el.innerHTML = `<h1>How mixed is a group?</h1>
        <p class="lead">Pick one member of a group at random, put them back, pick again. The <b>score</b> of the group is the chance the two picks had different outcomes (one cancelled, one stayed). With a share <i>p</i> who cancelled:</p>
        <div class="${P}-formula">score = 1 − p² − (1 − p)²</div>
        <p class="lead">A group where everyone did the same scores 0. A half-and-half group scores 0.5, the worst for two outcomes. All ${N} members together: 1 − (${ROOT_C}/${N})² − (${N - ROOT_C}/${N})² = ${f3(ROOT_G)}. A question's score is the average of its two groups, each weighted by its share of the members. Lower is better.</p>
        ${groups(kit, group(kit, G[0].title, G[0].ms, gx(0)), group(kit, G[1].title, G[1].ms, gx(1)))}
        ${groups(kit, group(kit, G[2].title, G[2].ms, gx(2)), group(kit, G[3].title, G[3].ms, gx(3)))}
        ${keyLine}
        ${k === 5 ? `<p class="lead">Monthly contract? scores <b>${f3(C.w)}</b>.</p>` : ""}
        ${fin ? "" : `<p class="task">${st.kind === "g" ? `Score the group “${kit.esc(st.g.title)}” (${nC(st.g.ms)} of ${st.g.ms.length} cancelled).` : `Score the question “${st.name}”: ${st.a.ms.length}/${N} × ${f3(gini(st.a.ms))} + ${st.b.ms.length}/${N} × ${f3(gini(st.b.ms))}.`}</p>`}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(o => f3(o[0])), { picked: wrong, correct: opts.findIndex(o => o[1] === "r"), num: true })}
          ${wrong != null ? kit.feedback(why(st, opts[wrong][1]), false) : ""}
          ${fin ? kit.feedback(`Right. Monthly contract? scores ${f3(C.w)}; visits ≤ 1? scores ${f3(V.w)}. Both are below ${f3(ROOT_G)}, the score with no question at all, but visits ≤ 1 cuts it further, so it becomes the first question of the tree. This score is called <b>Gini impurity</b> (“impurity” because a group with mixed outcomes is impure).`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (opts[i][1] !== "r") { wrong = i; paint(); return; }
        wrong = null; k++; paint(); if (k >= STEPS.length) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: a pure but tiny group does not win. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const T = SPLIT_TENURE1, V = SPLIT_VISITS;
    const opts = [
      "Tenure ≤ 1 month: one of its groups is perfectly clean, and you cannot do better than clean",
      `Visits ≤ 1: its score, ${f3(V.w)}, is lower, because each group counts by its size and tenure leaves ${T.no.length} members still mixed`,
      "They tie: each has one group that is cleaner than the other question's groups",
      "Neither: a good first question must leave both groups clean"
    ];
    const fb = [
      [`Clean, but tiny: it sorts ${T.yes.length} of ${N} members. The other ${T.no.length} still hold ${nC(T.no)} cancellers among ${T.no.length - nC(T.no)} stayers, score ${f3(gini(T.no))}, and that big group carries ${T.no.length}/${N} of the weight. Total: ${f3(T.w)}.`, false],
      [`Right. A tree picks each question this way: try every question, score each by the size-weighted Gini impurity of the two groups it makes, keep the lowest. A clean corner of ${T.yes.length} members cannot make up for leaving ${T.no.length} members unsorted.`, true],
      [`Do the sums: tenure ≤ 1 scores ${f3(T.w)}, visits ≤ 1 scores ${f3(V.w)}. One clean group does not decide anything; the weighted average over both groups does.`, false],
      ["With real members that almost never happens on the first question. The tree does not need it: it takes the lowest score now, then asks more questions inside each group.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A perfect group that loses</h1>
        <p class="lead">A trainer suggests a third question: “Has the member been here 1 month or less?” Both members who answer yes cancelled. That group scores 0, as clean as a group can be.</p>
        ${groups(kit, group(kit, "Tenure ≤ 1: yes", T.yes, `score ${f3(gini(T.yes))}`), group(kit, "Tenure ≤ 1: no", T.no, `score ${f3(gini(T.no))}`))}
        ${keyLine}
        <p class="task">Tenure ≤ 1 month or visits ≤ 1 a week: which one should be the first question, and why?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it: scan the cut points of a number column, predicting each time. */
  function scanCuts({ el, done, kit }) {
    ensureStyle();
    let k = 1, wrong = null; // VISIT_CUTS[0] is shown as the starting best
    const bestBefore = i => VISIT_CUTS.slice(0, i).reduce((a, b) => (b.w < a.w - 1e-12 ? b : a));
    const paint = () => {
      const fin = k >= VISIT_CUTS.length;
      const cur = VISIT_CUTS[Math.min(k, VISIT_CUTS.length - 1)];
      const best = bestBefore(Math.min(k, VISIT_CUTS.length));
      const lower = !fin && cur.w < best.w - 1e-12;
      const row = (c, i) => `<tr${!fin && i === k ? ` class="${P}-on"` : ""}><td>visits ≤ ${c.t}</td><td>${c.yes.length} · ${nC(c.yes)}</td><td>${c.no.length} · ${nC(c.no)}</td><td>${i < k ? f3(c.w) : "?"}</td></tr>`;
      el.innerHTML = `<h1>Where to cut a number</h1>
        <p class="lead">Contract has one possible question. Visits per week has one for every place you can cut the sorted values ${uniq("visits").join(", ")}: “visits ≤ 0?”, “visits ≤ 1?” and so on. The tree tries each one and keeps the best score so far.</p>
        <div class="${P}-wrap"><table class="${P}-tbl"><thead><tr><th>question</th><th>yes: members · cancelled</th><th>no: members · cancelled</th><th>score</th></tr></thead>
          <tbody>${VISIT_CUTS.map(row).join("")}</tbody></table></div>
        ${fin ? "" : `<p class="task">Best so far: visits ≤ ${best.t}, score ${f3(best.w)}. Look at the counts for visits ≤ ${cur.t}. Will its score be lower?</p>`}
        <div class="lpanel">${fin ? "" : kit.options([`Lower than ${f3(best.w)}`, "Not lower"], { picked: wrong, correct: lower ? 0 : 1 })}
          ${wrong != null ? kit.feedback(wrong === 0
            ? `It scores ${f3(cur.w)}. The yes group (${cur.yes.length} members, ${nC(cur.yes)} cancelled, score ${f3(gini(cur.yes))}) is more mixed than the best cut's groups, and it is ${cur.yes.length > cur.no.length ? "the bigger one, so it counts most" : "large enough to pull the average up"}.`
            : `It scores ${f3(cur.w)}. Moving the cut here puts more cancellers with each other: ${nC(cur.yes)} of ${cur.yes.length} on the yes side, and only ${nC(cur.no)} of ${cur.no.length} on the no side.`, false) : ""}
          ${fin ? kit.feedback(`Right. The best cut is visits ≤ ${BEST_VISIT.t} (${f3(BEST_VISIT.w)}). Cuts near the ends make a tiny group and leave the big one mixed, the same trap as the trainer's question. The tree also scanned tenure: its best cut, tenure ≤ ${BEST_TENURE.t}, scores ${f3(BEST_TENURE.w)}, and monthly contract? scores ${f3(SPLIT_CONTRACT.w)}. So the tree's first question is <b>visits ≤ ${BEST_VISIT.t}?</b>`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== (lower ? 0 : 1)) { wrong = i; paint(); return; }
        wrong = null; k++; paint(); if (k >= VISIT_CUTS.length) done();
      });
    };
    paint();
  }

  /* 5. The scan as NumPy code: a stepped replay of the traced run. */
  const LN = { init: CODE.findIndex(c => c.includes("best_t, best_score = None")), loop: CODE.findIndex(c => c.includes("for t in")),
    score: CODE.findIndex(c => c.includes("score = (")), test: CODE.findIndex(c => c.includes("if score <")),
    keep: CODE.findIndex(c => c.includes("best_t, best_score = t")) };
  const FR = (() => {
    const fr = [];
    for (let i = 1; i < TRACE.length; i++) {
      const ran = TRACE[i - 1][0], r = TRACE[i];
      if (r[1] === "r") { fr.push({ ln: r[0], r, end: true }); continue; }
      if (ran === LN.init || ran === LN.score || ran === LN.keep || (ran === LN.test && r[0] === LN.loop)) fr.push({ ln: ran, r });
    }
    return fr;
  })();
  const sayFrame = f => {
    const [, , t, nl, cl, nr, cr, score, bt, bs] = f.r;
    if (f.end) return `The loop has tried every cut. <code>best_question</code> returns <code>(${bt}, ${f3(bs)})</code>: ask “visits ≤ ${bt}?”, the same answer you found by hand.`;
    if (f.ln === LN.init) return "Start with no question and a best score of 1.0, worse than any real score, so the first cut always wins.";
    if (f.ln === LN.score) return `t = ${t}. Left holds ${nl} members (${cl} cancelled), right holds ${nr} (${cr} cancelled). Each side's Gini times its size, added, divided by all ${N}: ${f3(score)}.`;
    if (f.ln === LN.keep) return `${f3(score)} is lower than the old best, so the highlighted line keeps it: best_t = ${bt}.`;
    return `${f3(score)} is not lower than ${f3(bs)}, so the best stays at t = ${bt}.`;
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i], r = f.r;
      el.innerHTML = `<h1>The same scan in NumPy</h1>
        <p class="lead"><code>gini</code> is the score from the hand-worked screen. <code>group</code> is a NumPy array of 0 (stayed) and 1 (cancelled), so its mean is the share who cancelled:</p>
        ${kit.code(GINI_CODE, -1)}
        <p class="lead"><code>np.unique</code> returns the sorted distinct values; <code>[:-1]</code> drops the largest, since “≤ the largest” puts everyone on one side. <code>cancelled[visits &lt;= t]</code> keeps the entries where the test is true. <code>w_left</code> and <code>w_right</code> are each group's Gini times its size; their sum divided by all members is the question's score, the weighting you did by hand.</p>
        <p class="task">Step through the run on the ${N} members. At each score, check whether it beats the best so far before you step on.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>t <b>${r[2] == null ? "–" : r[2]}</b></span><span>left <b>${r[3] == null ? "–" : `${r[3]} · ${r[4]} cancelled`}</b></span><span>right <b>${r[5] == null ? "–" : `${r[5]} · ${r[6]} cancelled`}</b></span><span>score <b>${r[7] == null ? "–" : f3(r[7])}</b></span><span>best_t <b>${r[8] == null ? "None" : r[8]}</b></span><span>best_score <b>${r[9] == null ? "–" : f3(r[9])}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}
        ${i === FR.length - 1 ? `<p class="lead">A full tree builder runs this scan for every column, keeps the overall best question, splits the members, and then runs the same search again inside each of the two groups.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. Keep asking until every group is clean: a rule for one person. */
  function treeNode(kit, n, on) {
    if (n.leaf != null) return `<div class="${P}-node"><span class="${P}-leaf">${n.leaf ? "cancels" : "stays"}</span> <span class="${P}-who">(${plural(n.n, "member")}: ${n.who.map(kit.esc).join(", ")})</span></div>`;
    const kid = (lab, c) => `<li class="${on.includes(c) ? `${P}-on` : ""}"><span class="${P}-ans">${lab} →</span> ${treeNode(kit, c, on)}</li>`;
    return `<div class="${P}-node"><span class="${P}-q">${kit.esc(n.q.replace("<=", "≤"))}?</span></div><ul>${kid("yes", n.yes)}${kid("no", n.no)}</ul>`;
  }
  function deepTree({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null; // stage 0: what does it say; 1: how many members; 2: finished
    const P1 = pathOf(NEWCOMER), leaf = P1.leaf;
    const onNodes = [];
    { let n = FULL_TREE; for (const [, y] of P1.steps) { n = y ? n.yes : n.no; onNodes.push(n); } }
    const other = leavesOf(FULL_TREE).find(l => l.n === 1 && l.leaf !== leaf.leaf && l.who[0] !== "Farida");
    const sizes = [...new Set([leaf.n, 4, 5, N])].sort((a, b) => a - b);
    const lastQ = P1.steps[P1.steps.length - 1][0];
    const mOf = name => MEMBERS.find(m => m.name === name);
    const Q = [
      { opts: ["Cancels", "Stays"], right: leaf.leaf ? 0 : 1,
        fb: [null, null].map((_, i) => i === (leaf.leaf ? 0 : 1) ? null : [`Follow her answers: ${P1.steps.map(([q, y]) => `${q.replace("<=", "≤")}? ${y ? "yes" : "no"}`).join(", then ")}. That ends at a leaf that says “${leaf.leaf ? "cancels" : "stays"}”.`, false]) },
      { opts: sizes.map(String), right: sizes.indexOf(leaf.n),
        fb: sizes.map(s => s === leaf.n ? null : [`Count the names in the leaf where Mira ended: ${leaf.who.map(kit.esc).join(", ")}.`, false]) }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Keep asking until every group is clean</h1>
        <p class="lead">After the first question, the tree runs the same search inside each group, and again inside those, until every group holds only one outcome. This is the tree that run built on the ${N} members. Each end point (a <b>leaf</b>) gives its answer.</p>
        <div class="${P}-tree"><ul><li>${treeNode(kit, FULL_TREE, stage >= 1 ? onNodes : [])}</li></ul></div>
        <p class="lead">A new member, ${NEWCOMER.name}: ${NEWCOMER.visits} visits a week, ${NEWCOMER.monthly ? "monthly" : "annual"} contract, ${NEWCOMER.tenure} months in.</p>
        ${stage < 2 ? `<p class="task">${stage === 0 ? `What does the tree say about ${NEWCOMER.name}?` : "Her path is marked at the left edge. How many past members is that answer built on?"}</p>` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`Right: ${plural(leaf.n, "member")}, ${kit.esc(leaf.who[0])}. The question ${kit.esc(lastQ.replace("<=", "≤"))}? exists only to separate ${kit.esc(leaf.who[0])} (${mOf(leaf.who[0]).visits} visits, cancelled) from ${kit.esc(other.who[0])} (${mOf(other.who[0]).visits} visits, stayed). It says nothing about gyms; it describes two people. If ${NEWCOMER.name} came ${mOf(other.who[0]).visits} times a week, the tree would say “stays” for the same weak reason. A tree grown until every leaf is clean gets all ${N} of its training members right. It does that by writing rules for single people. That is overfitting, and the deeper the tree, the more of those rules it has.`, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 7. How deep? Predict the depth that does best on members the tree never saw. */
  function howDeep({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const choices = [DR[0], BEST_ROW, DR[DR.length - 2], NOLIMIT];
    const RIGHT = 1;
    const fb = [
      [`One question is too few: on validation it scores ${pct(DR[0][2])}, no better than always saying “stays” (${pct(DEPTH_RUN.baselineVal)}). It misses real patterns that a second and third question would catch.`, false],
      null,
      [`Training accuracy keeps rising, but at depth ${DR[DR.length - 2][0]} the tree has ${DR[DR.length - 2][3]} leaves and ${DR[DR.length - 2][4]} of them hold a single member. On new members it scores ${pct(DR[DR.length - 2][2])}.`, false],
      [`The unlimited tree fits the training members best (${pct(NOLIMIT[1])}), with ${NOLIMIT[4]} single-member leaves among ${NOLIMIT[3]}. Those are rules about individuals; on new members it scores ${pct(NOLIMIT[2])}, below always saying “stays”.`, false]
    ];
    fb[RIGHT] = [`Right. Validation accuracy peaks at depth ${BEST_ROW[0]} (${pct(BEST_ROW[2])}) and falls after it, while training accuracy keeps climbing to ${pct(NOLIMIT[1])}. With no limit the tree scores ${pct(NOLIMIT[2])} on new members, worse than a rule that always says “stays” (${pct(DEPTH_RUN.baselineVal)}). Every extra level splits groups smaller, until the “best question” separates single members on details that will not repeat. The fix is to stop the tree early. In scikit-learn, <code>max_depth</code> caps the number of levels, <code>min_samples_leaf</code> refuses leaves smaller than a set size, and <code>ccp_alpha</code> cuts weak branches off after the tree is grown (this is called pruning). Without these settings, the tree keeps growing until its leaves are pure or too small to split. Choose the setting on validation data, as you did here.`, true];
    const paint = () => {
      const show = ans === RIGHT;
      el.innerHTML = `<h1>How deep should the tree grow?</h1>
        <p class="lead">Twelve members are too few to measure this, so we made up ${DEPTH_RUN.train + DEPTH_RUN.val} members with the same three columns, where cancelling is partly random: even the true rule gets some members wrong. The same NumPy search grew trees on ${DEPTH_RUN.train} of them with a cap on the number of levels (<code>max_depth</code>), and scored each on the other ${DEPTH_RUN.val}. Training accuracy never reaches 100% here, because some members look the same on all three columns but did different things.</p>
        <div class="${P}-wrap"><table class="${P}-tbl"><thead><tr><th>max_depth</th><th>leaves</th><th>1-member leaves</th><th>train acc</th><th>validation acc</th></tr></thead>
          <tbody>${DR.map(r => `<tr${show && r === BEST_ROW ? ` class="${P}-on"` : ""}><td>${depthName(r[0])}</td><td>${r[3]}</td><td>${r[4]}</td><td>${pct(r[1])}</td><td>${show ? pct(r[2]) : "?"}</td></tr>`).join("")}</tbody></table></div>
        <p class="task">Which depth scores best on the ${DEPTH_RUN.val} members it never saw?</p>
        <div class="lpanel">${ask(kit, choices.map(r => depthName(r[0])), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Overfitting from too many levels", "Instability: a small change in the data gives a different tree", "It cannot predict beyond the values it has seen"];
    const RIGHT = 1;
    const fb = [
      ["Depth is fixed at three every month, chosen on validation data, so the trees are not growing deeper. The questions change at the top, where groups are large.", false],
      ["Right. Each question is the winner of a close race, and a few new members can change the winner. Every question below it then changes too, because it is asked inside different groups. Averaging many trees, each grown on a slightly different sample, is the usual cure; that is the next lesson.", true],
      ["That weakness shows when a new case lies outside what the tree saw, such as a member with a far longer tenure than anyone before. Here the members are ordinary; the tree itself changes.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a decision tree</h1>
        <p class="lead"><b>For:</b> tables of mixed columns (counts, categories, amounts) where you want rules a person can read and check. <b>Reach for it</b> as a quick first model you can explain. It needs little preparation and no scaling of the columns. It finds the cut points on its own, and combinations too, such as “few visits <i>and</i> short tenure”. <b>Not</b> when you need the best accuracy on a table: use many trees together (random forests or boosting, the next lessons). Not when the answer must go beyond anything seen in training: a linear model can extend a trend; a tree cannot. Not for raw text, images or sound: use neural networks. <b>Costs:</b> cheap to train and to run, but deep trees overfit, so depth must be tuned, and a small change in the data can change the whole tree.</p>
        <p class="task">The gym retrains its depth-3 tree each month. The manager complains that the first question keeps changing: visits one month, tenure the next, with similar members. Which weakness is this?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where one tree is the wrong choice. */
  const CASES = [
    ["A bank must explain every refused loan to the applicant, using a table of eight columns: income, years at the job, existing debt and so on.", true,
      "Yes. A shallow tree gives a path of plain questions for each decision, and the bank can read out exactly which answers led to the refusal.",
      "The deciding need here is a reason a person can read. A shallow tree's path (“debt above this, years at job below that”) is that reason. Keep it shallow and check it on validation data."],
    ["Forecast a city's electricity use for next summer. Use has risen every year, and next summer will very likely be higher than any month in the records.", false,
      "No. A tree can also predict a number: the same kind of search splits the past records, and each leaf answers with the average of the records that landed in it. An average of past values can never be above the highest of them, so the forecast flattens at the old maximum. A model that extends the trend, such as a linear one, fits this.",
      "A tree that predicts a number answers, in each leaf, with the average of the past records in that leaf. So its answer always stays inside the range it saw. The question asks for a value above every past one; the tree would flatten at the old maximum."],
    ["Tell photos of ripe and unripe mangoes apart from the raw pixel values.", false,
      "No. A single pixel's value means little on its own: the same fruit shifts by a few pixels from photo to photo. Questions like “pixel 4031 ≤ 120?” do not carry over. Neural networks that learn shapes and textures are the tool for images.",
      "Tree questions test one column at a time. With pixels, one column is one dot of the picture, and it changes whenever the fruit moves. That is why images go to neural networks."],
    ["A walk-in clinic wants a short checklist of yes/no questions about symptoms that nurses can follow on paper to decide who is seen first, learned from past visits.", true,
      "Yes. A shallow tree is exactly a checklist of yes/no questions, learned from past cases, and a nurse can follow it without a computer.",
      "The output has to be a few readable questions, followed by hand. That is what a shallow tree is. Keep the depth small so each rule rests on many past visits."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Tree or not?</h1>
        <p class="lead">Four problems from other places. A decision tree here means one tree of yes/no questions on the columns of a table, each chosen by the lowest weighted impurity.</p>
        <p class="task">Would one decision tree be a good choice for each? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can choose the best question</h1>
      <p class="lead">You scored groups by Gini impurity, picked the question with the lowest size-weighted score, scanned the cut points of a number column in NumPy, and saw a tree grown until pure write a rule for one member. Depth is the setting that trades fitting the past against working on new members, and you choose it on validation data.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>gini</code> and a best-question search over every column yourself, and find the first question for a new list of members.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. One tree changes when the data shifts a little; next you grow many trees on slightly different samples and let them vote.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Decision trees: choosing the best question",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/tree.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.tree.DecisionTreeClassifier.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.unique.html"
    ],
    interview: [
      {
        q: "Your churn decision tree gets 99% accuracy on the training data but about 70% on last month's new customers, no better than predicting that nobody leaves. What is going on, and what do you change?",
        good: [
          "The tree overfits: grown without a limit, its deep leaves hold one or two customers and encode their noise",
          "Compare training and validation accuracy across depths and pick the depth where validation peaks",
          "Limit growth with max_depth or min_samples_leaf, or prune with ccp_alpha, and tune them on validation data",
          "Compare against the baseline of always predicting the majority class, since churn data is usually imbalanced",
          "If one tuned tree is still weak or unstable, try a random forest or gradient boosting"
        ],
        weak: "Add more features or train longer. That gives the tree more ways to memorise single customers and does not touch why it fails on new ones."
      },
      {
        q: "Walk me through how a decision tree picks its first split on a table with a numeric and a categorical column.",
        good: [
          "For each column, list candidate questions: each cut between sorted values for the number, each category test for the categorical",
          "For each question, split the rows and compute the impurity of both groups, for example Gini 1 − sum of squared class shares",
          "Weight each group's impurity by its share of the rows and add them; keep the question with the lowest score",
          "A question that makes one tiny pure group usually loses, because the big group stays mixed",
          "Then repeat the same search inside each group"
        ],
        weak: "It picks the most important feature first. That skips how importance is measured: the weighted impurity of the groups each question makes."
      }
    ],
    screens: [situation, byHand, spotIdea, scanCuts, asCode, deepTree, howDeep, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(6).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(VISIT_CUTS.length - 1).fill("[data-right]") },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
