/* Lesson: naive Bayes for text. Story: a mobile game studio sorts app-store reviews into bug reports and
   everything else. Ideas: (1) score a review per label as "share of reviews with that label × the chance of
   each word under that label", multiplied, which only works because we pretend the words are independent once
   the label is known (the "naive" assumption); (2) the two fixes every real version has, add-one smoothing for
   unseen words and sums of logs instead of products, then the same model in scikit-learn, and what the
   assumption gives up (meaning, word forms, honest probabilities).
   Data, all real (no model API calls in this lesson):
   - docs/ai-path/runs/s2-naive-bayes/reviews.py: the ten labelled training reviews (written for the lesson);
     the lesson counts their words itself with the same token rule as scikit-learn's CountVectorizer;
   - scratch.py + scratch.out.txt: counts, the unsmoothed products, and the line-by-line trace of classify()
     shown on the code screen;
   - underflow.py + underflow.out.txt: the product of many word probabilities becoming 0.0;
   - library.py + library.out.txt: CountVectorizer + MultinomialNB(alpha=1.0) on the same reviews (scikit-learn 1.9.1).
   Lesson-local style: review lists, a three-column table and an output block (.lx-s2-naive-bayes-*), see
   ensureStyle(). Plain browser script. */
(() => {
  const ID = "s2-naive-bayes";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s2-naive-bayes/reviews.py
  const TRAIN = [
    ["crashes after every update", "bug"],
    ["game crashes on level five", "bug"],
    ["stuck on loading screen after update", "bug"],
    ["game freezes and crashes", "bug"],
    ["love this game", "other"],
    ["great update no crashes so far", "other"],
    ["too many ads after level ten", "other"],
    ["fun game but too many ads", "other"],
    ["cute art and great music", "other"],
    ["best puzzle game this year", "other"]
  ];
  const LABELS = ["bug", "other"];
  const REV_A = "game crashes after update";
  const REV_B = "love this game but it freezes after update";

  // From underflow.out.txt: [words, product as Python printed it, sum of logs]. Each word's probability is
  // (1 + 1) / (19 + 31): "freezes" in bug reports with add-one smoothing, see underflow.py.
  const UNDER = [[10, "1.0485760000000003e-14", -32.19], [100, "1.606938044258993e-140", -321.89],
    [200, "2.582249878086919e-280", -643.78], [300, "0.0", -965.66], [400, "0.0", -1287.55]];
  const UNDER_P = [2, 50];
  const UNDER_WORD = "freezes";

  // classify() from scratch.py, line for line (line 0 = def).
  const CODE = [
    "def classify(review):",
    "    words = [w for w in tokenize(review) if w in vocab]",
    "    best_label, best_score = None, -math.inf",
    "    for label in labels:",
    "        score = math.log(prior[label])",
    "        for word in words:",
    "            count = word_counts[label][word]",
    "            score += math.log((count + 1) / (total_words[label] + vocab_size))",
    "        if score > best_score:",
    "            best_label, best_score = label, score",
    "    return best_label"
  ];
  // Trace frames from scratch.out.txt, classify(REV_B): [line that just ran, event, label, word, count, score,
  // best_label, best_score]; null best_score = -inf. Kept: after lines 1, 4, 7, 9 and the return.
  const TRACE_WORDS = ["love", "this", "game", "but", "freezes", "after", "update"];
  const TRACE = [[1,"l",null,null,null,null,null,null],[4,"l","bug",null,null,-0.916290731874155,null,null],[7,"l","bug","love",0,-4.828313737302301,null,null],[7,"l","bug","this",0,-8.740336742730447,null,null],[7,"l","bug","game",2,-11.553747459490484,null,null],[7,"l","bug","but",0,-15.46577046491863,null,null],[7,"l","bug","freezes",1,-18.68464628978683,null,null],[7,"l","bug","after",2,-21.498057006546865,null,null],[7,"l","bug","update",2,-24.3114677233069,null,null],[9,"l","bug","update",2,-24.3114677233069,"bug",-24.3114677233069],[4,"l","other","update",2,-0.5108256237659907,"bug",-24.3114677233069],[7,"l","other","love",1,-3.9448128282511368,"bug",-24.3114677233069],[7,"l","other","this",2,-6.973334924628119,"bug",-24.3114677233069],[7,"l","other","game",3,-9.714174948553321,"bug",-24.3114677233069],[7,"l","other","but",1,-13.148162153038466,"bug",-24.3114677233069],[7,"l","other","freezes",0,-17.27529653808356,"bug",-24.3114677233069],[7,"l","other","after",1,-20.709283742568704,"bug",-24.3114677233069],[7,"l","other","update",1,-24.14327094705385,"bug",-24.3114677233069],[9,"l","other","update",1,-24.14327094705385,"other",-24.14327094705385],[10,"r","other","update",1,-24.14327094705385,"other",-24.14327094705385]];
  const TRACE_RESULT = "other"; // scratch.out.txt: classify(...) -> 'other'

  // library.py lines 11-22, and library.out.txt (the part under "--- listing output ---")
  const CODE_SK = [
    "from sklearn.feature_extraction.text import CountVectorizer",
    "from sklearn.naive_bayes import MultinomialNB",
    "",
    "vectorizer = CountVectorizer()",
    "word_counts = vectorizer.fit_transform(review_texts)",
    "model = MultinomialNB(alpha=1.0)",
    "model.fit(word_counts, review_labels)",
    "",
    "new_counts = vectorizer.transform(new_reviews)",
    "print(model.classes_)",
    "print(model.predict(new_counts))",
    "print(model.predict_proba(new_counts).round(3))"
  ];
  const SK_NEW = ["love this game but it freezes after update", "too many ads it keeps crashing",
    "the update fixed the crashes", "crashes", "crashes crashes crashes"];
  const SK_OUT = "['bug' 'other']\n['other' 'other' 'bug' 'bug' 'bug']\n[[0.458 0.542]\n [0.045 0.955]\n [0.755 0.245]\n [0.623 0.377]\n [0.91  0.09 ]]";
  const SK_PRED = ["other", "other", "bug", "bug", "bug"];
  const SK_PROBA = [[0.458, 0.542], [0.045, 0.955], [0.755, 0.245], [0.623, 0.377], [0.91, 0.09]];
  // library.out.txt "counted words" for review 2
  const SK_KEPT_2 = ["ads", "many", "too"];
  const SK_VERSION = "1.9.1"; // env.txt

  /* ---------- Derived from the data ---------- */
  const tokenize = s => s.toLowerCase().match(/\b\w\w+\b/g) || []; // CountVectorizer's default rule
  const COUNTS = {}, TOTAL = {}, NREV = {};
  LABELS.forEach(l => { COUNTS[l] = {}; TOTAL[l] = 0; NREV[l] = 0; });
  TRAIN.forEach(([t, l]) => { NREV[l]++; tokenize(t).forEach(w => { COUNTS[l][w] = (COUNTS[l][w] || 0) + 1; TOTAL[l]++; }); });
  const VOCAB = [...new Set(TRAIN.flatMap(([t]) => tokenize(t)))];
  const V = VOCAB.length;
  const N = TRAIN.length;
  const cnt = (l, w) => COUNTS[l][w] || 0;
  const ALL_WORDS = TOTAL.bug + TOTAL.other;
  const WORDS_A = tokenize(REV_A);
  const WORDS_B = tokenize(REV_B).filter(w => VOCAB.includes(w));
  const DROPPED_B = tokenize(REV_B).filter(w => !VOCAB.includes(w));
  const plainScore = (l, words) => NREV[l] / N * words.reduce((p, w) => p * cnt(l, w) / TOTAL[l], 1);
  const SA = { bug: plainScore("bug", WORDS_A), other: plainScore("other", WORDS_A) };
  const SB = { bug: plainScore("bug", WORDS_B), other: plainScore("other", WORDS_B) };
  const zerosB = l => WORDS_B.filter(w => cnt(l, w) === 0);
  const FREEZE_OTHER = [cnt("other", "freezes") + 1, TOTAL.other + V];
  const fin = TRACE[TRACE.length - 1];
  const SCORE_B = { bug: TRACE.find(r => r[0] === 9 && r[2] === "bug")[5], other: TRACE.find(r => r[0] === 9 && r[2] === "other")[5] };

  /* ---------- Formatting ---------- */
  const pow10 = e => `10<sup>${String(e).replace("-", "−")}</sup>`;
  function sci(x, digits = 2) {
    if (x === 0) return "0";
    const e = Math.floor(Math.log10(Math.abs(x)));
    const m = x / Math.pow(10, e);
    return `${m.toFixed(digits - 1)}&nbsp;×&nbsp;${pow10(e)}`;
  }
  // a number written as Python printed it, e.g. "1.0485760000000003e-14", shown as 1.05 × 10⁻¹⁴
  const pySci = s => s === "0.0" ? "0.0" : sci(parseFloat(s), 3);
  const frac = (a, b) => `${a}/${b}`;
  const f2 = x => x.toFixed(2);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-revs { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; margin: 14px 0 0; }
      .lx-${ID}-revs h3 { margin: 0 0 4px; font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-revs ul { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-revs li { padding: 7px 0; border-bottom: 1px solid var(--line); font: 500 14.5px/1.4 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
      .lx-${ID}-new { margin: 14px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-left: 3px solid var(--ink); background: var(--sunk); font: 500 15px/1.45 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
      .lx-${ID}-new small { display: block; font: 600 12px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-t { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .lx-${ID}-t caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .lx-${ID}-t th, .lx-${ID}-t td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-t th { font: 600 12.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .lx-${ID}-t td { font: 500 14.5px/1.4 var(--mono); color: var(--ink); }
      .lx-${ID}-t td.z { font-weight: 700; outline: 2px solid var(--ink); outline-offset: -4px; }
      .lx-${ID}-t sup, .lx-${ID}-opt sup { font-size: .75em; line-height: 0; }
      .lx-${ID}-t tr.sum td { border-top: 2px solid var(--ink); font-weight: 700; }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); font: 500 14px/1.5 var(--mono); color: var(--ink); white-space: pre; overflow-x: auto; }
      .lx-${ID}-code .lcode div { white-space: pre-wrap; }
      .lx-${ID}-ln { display: block; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      @media (max-width: 520px) { .lx-${ID}-revs { grid-template-columns: 1fr; gap: 12px; } .lx-${ID}-t th, .lx-${ID}-t td { padding: 7px 5px; } }
    `;
    document.head.appendChild(s);
  }
  const reviewsBlock = kit => `<div class="lx-${ID}-revs">${LABELS.map(l => `<div><h3>${l === "bug" ? "bug reports" : "other reviews"} (${NREV[l]})</h3><ul>${TRAIN.filter(r => r[1] === l).map(r => `<li>${kit.esc(r[0])}</li>`).join("")}</ul></div>`).join("")}</div>`;
  const newReview = (kit, text, tag = "new review") => `<div class="lx-${ID}-new"><small>${kit.esc(tag)}</small>${kit.esc(text)}</div>`;
  // rows: [[cells...], cls]; zeroCells: set of "r,c" keys to mark as a zero
  function grid3(kit, head, rows, { caption = "", zero = () => false } = {}) {
    return `<table class="lx-${ID}-t">${caption ? `<caption>${kit.esc(caption)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(([cells, cls], r) =>
      `<tr${cls ? ` class="${cls}"` : ""}>${cells.map((c, j) => `<td${zero(r, j) ? ' class="z"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  // kit.code, but long lines wrap on a phone with a hanging indent under their own indentation,
  // so the whole line stays readable without sideways scrolling.
  const codeWrap = (kit, lines, active) => `<div class="lx-${ID}-code">${kit.code(lines, active).replace(/<div([^>]*)>([\s\S]*?)<\/div>/g, (m, a, body) => {
    const n = body.match(/^ */)[0].length + 4;
    return `<div${a}><span class="lx-${ID}-ln" style="padding-left:${n}ch;text-indent:-${n}ch">${body}</span></div>`;
  })}</div>`;
  const opt = (kit, s) => `<span class="lx-${ID}-opt">${s}</span>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }

  /* 1. The situation, and the first count. */
  function firstCount({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const cB = cnt("bug", "crashes"), cAll = cB + cnt("other", "crashes");
    const docs = TRAIN.filter(([t, l]) => l === "bug" && tokenize(t).includes("crashes")).length;
    const opts = [frac(docs, NREV.bug), frac(cAll, ALL_WORDS), frac(cB, TOTAL.bug), frac(cB, ALL_WORDS)];
    const RIGHT = 2;
    const fb = [
      [`That is how many bug <b>reports</b> contain “crashes”: ${docs} of ${NREV.bug}. The question counts <b>words</b>. A report that said “crashes” twice would count twice, and a long report gives more words to share out.`, false],
      [`${cAll} counts “crashes” in both piles, including the one in “no crashes so far”, and ${ALL_WORDS} is every word of all ${N} reviews. You want the bug pile only.`, false],
      [`Right: “crashes” is ${cB} of the ${TOTAL.bug} words in bug reports. Write it as P(crashes | bug), “the chance a word is <i>crashes</i>, given the review is a bug report”. In other reviews it is ${frac(cnt("other", "crashes"), TOTAL.other)}. These word fractions, and the share of reviews with each label, are everything this method learns.`, true],
      [`${cB} is the right count, but ${ALL_WORDS} is every word in all ${N} reviews, other reviews included. Divide by the words in bug reports only, so the fraction describes bug reports.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Bug report or not?</h1>
        <p class="lead">A mobile game studio gets hundreds of app-store reviews a day. Bug reports should go to the testers; everything else goes to the community team. Reading each one by hand is slow, so the team wants a program to sort them: a <b>text classifier</b>. They start from reviews a person already sorted. Each review's pile, bug or other, is its <b>label</b>. Ten reviews are enough to do it by hand:</p>
        ${reviewsBlock(kit)}
        <p class="lead">Count words the way the program will: lowercase, and only words of two or more letters or digits (so “it” counts, “a” does not). The bug reports hold ${TOTAL.bug} words; the other reviews hold ${TOTAL.other}.</p>
        <p class="task">Out of all the words in bug reports, what share are “crashes”?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Multiply the fractions for a new review and choose its label. */
  function multiply({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const fr = l => WORDS_A.map(w => frac(cnt(l, w), TOTAL[l]));
    const noPrior = WORDS_A.reduce((p, w) => p * cnt("bug", w) / TOTAL.bug, 1);
    const added = NREV.bug / N + WORDS_A.reduce((s, w) => s + cnt("bug", w) / TOTAL.bug, 0);
    const Q = [
      { right: 1, opts: [
          opt(kit, `${fr("bug").join(" × ")} = ${sci(noPrior)}`),
          opt(kit, `${frac(NREV.bug, N)} × ${fr("bug").join(" × ")} = ${sci(SA.bug)}`),
          opt(kit, `${frac(NREV.bug, N)} + ${fr("bug").join(" + ")} = ${added.toFixed(2)}`)],
        fb: [
          [`This leaves out how common bug reports are in the first place: ${NREV.bug} of ${N} reviews. Two labels with the same word fractions would tie, even if one label is far more common.`, false],
          null,
          ["Adding is for “this or that”. The review has this word <b>and</b> that word <b>and</b> the label, and chances of things that all happen together multiply. A sum can even go above 1, which no chance can.", false]] },
      { right: 0, opts: ["bug", "other", "Neither: both scores are too small to mean anything"],
        fb: [null,
          [`Other reviews are more common (${NREV.other} of ${N}), but the words pull the other way: ${WORDS_A.filter(w => 2 * cnt("other", w) * TOTAL.bug < cnt("bug", w) * TOTAL.other).map(w => `“${w}”`).join(", ")} are much more common in bug reports than in other reviews. Compare the two scores.`, false],
          [`Both are tiny because any one exact review is unlikely. By Bayes' rule, P(bug | review) is the bug score divided by P(review), and P(other | review) is the other score divided by <b>the same</b> P(review). So you never need P(review): only which score is bigger.`, false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Multiply and choose</h1>
        <p class="lead">A new review arrives. To score it for one label, take the share of reviews with that label, then multiply by each word's fraction under that label.</p>
        ${newReview(kit, REV_A)}
        ${grid3(kit, ["word", "in bug", "in other"], [
          [["share of reviews", frac(NREV.bug, N), frac(NREV.other, N)]],
          ...WORDS_A.map(w => [[kit.esc(w), frac(cnt("bug", w), TOTAL.bug), frac(cnt("other", w), TOTAL.other)]])])}
        ${stage >= 1 ? `<p class="lead">Bug score: ${sci(SA.bug)}. Other score: ${frac(NREV.other, N)} × ${fr("other").join(" × ")} = ${sci(SA.other)}.</p>` : ""}
        ${stage < 2 ? `<p class="task">${stage === 0 ? "Which line is the bug score?" : "Which label does the review get?"}</p>` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`Bug. Its score is about ${Math.round(SA.bug / SA.other)} times bigger than the other score, even though other reviews are more common. You just labelled a review that appears nowhere in the training data.`, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 3. Spot the idea: why a review never seen before could be scored at all. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const shuffled = WORDS_A.slice().reverse().join(" ");
    const opts = [
      "We found the most similar training review and copied its label",
      "We pretended that, once the label is known, each word appears independently of the other words, so we could multiply word by word",
      "We used the order of the words: “crashes after update” is a bug pattern",
      "The share of reviews did most of the work"
    ];
    const fb = [
      ["That is k-nearest neighbours, the last lesson. Here no review was compared with another. Only word counts per label were used.", false],
      [`Right. Bayes' rule says P(bug | review) grows with P(bug) × P(review | bug). Nobody can count P(review | bug) for a whole review: almost every review is new. So we <b>pretend</b> the words are independent once the label is known, and replace P(review | bug) with P(game | bug) × P(crashes | bug) × … . That pretence is the <b>naive</b> part; the method is <b>naive Bayes</b>. It is false (“crashes” and “update” clearly come together), yet the label it picks is often right.`, true],
      [`Order was never used. Scramble it to “${kit.esc(shuffled)}” and the same four fractions get multiplied, so the scores are identical.`, false],
      [`The share favoured <i>other</i>: ${frac(NREV.other, N)} against ${frac(NREV.bug, N)}. The word fractions overturned it. The words did the work.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>How could that work?</h1>
        <p class="lead">None of the ${N} training reviews says “${kit.esc(REV_A)}”. So the chance of that exact review among bug reports, counted from the data, is 0. The same is true for almost every new review.</p>
        <p class="task">So what let you score it anyway?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. One zero wipes out a score; add one to every count. */
  function zeros({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const zb = zerosB("bug"), zo = zerosB("other");
    const Q = [
      { right: 0, opts: ["Both scores are 0", "Bug is 0, other is above 0", "Bug is above 0, other is 0", "Both are small but above 0"],
        fb: [null,
          [`Other reviews never contain “${zo.join("”, “")}”, so one fraction in the other score is 0/${TOTAL.other}. One zero makes the whole product 0, however much the other words favour it.`, false],
          [`Bug reports never contain “${zb.join("”, “")}”. Any one of those zeros makes the bug score 0.`, false],
          [`Look for zeros in the table: bug reports never say “${zb[0]}”, other reviews never say “${zo[0]}”. A single 0 in a product makes it 0.`, false]] },
      { right: 0, opts: [frac(FREEZE_OTHER[0], FREEZE_OTHER[1]), frac(FREEZE_OTHER[0], TOTAL.other + 1), frac(FREEZE_OTHER[0], TOTAL.other), frac(0, TOTAL.other + V)],
        fb: [null,
          [`You added one to “freezes” only. The fix adds one to <b>every</b> word's count, ${V} words in all, so the bottom number grows by ${V}. Otherwise the fractions for one label would add up to more than 1.`, false],
          [`Adding one to the top number but not the bottom makes the fractions for one label add up to more than 1. All ${V} counts grew by one, so the bottom number grows by ${V}.`, false],
          ["The point of the fix is that no word gets 0 any more. Add one to the count too.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Words a label never saw</h1>
        <p class="lead">Another review. “${kit.esc(DROPPED_B.join(", "))}” is in no training review at all, so it has no count under either label and is skipped. The rest are below; each zero count has a box around it:</p>
        ${newReview(kit, REV_B)}
        ${grid3(kit, ["word", "in bug", "in other"], WORDS_B.map(w => [[kit.esc(w), frac(cnt("bug", w), TOTAL.bug), frac(cnt("other", w), TOTAL.other)]]),
          { zero: (r, j) => j > 0 && cnt(LABELS[j - 1], WORDS_B[r]) === 0 })}
        ${stage >= 1 ? `<p class="lead">The usual fix: add 1 to every word's count under every label, so no fraction is ever 0. Then the bottom number of each fraction (the label's word total) must grow by the <b>vocabulary</b> size: the ${V} different words in the training reviews.</p>` : ""}
        ${stage < 2 ? `<p class="task">${stage === 0 ? "Multiply as before. What are the two scores?" : "With the fix, what is P(freezes | other)?"}</p>` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`Right: (0 + 1) / (${TOTAL.other} + ${V}) = ${frac(FREEZE_OTHER[0], FREEZE_OTHER[1])}. Small, but not 0, so the other words still count. This is <b>add-one</b> or <b>Laplace smoothing</b>. In scikit-learn it is the <code>alpha</code> setting, 1.0 by default; a value below 1 adds less to each count.`, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 5. Long reviews: the product rounds to 0.0, so add logs instead. */
  function logs({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const ask300 = UNDER.findIndex(r => r[0] === 300);
    const exp300 = UNDER[ask300][0] * Math.log10(UNDER_P[0] / UNDER_P[1]);
    const trueVal = `${Math.pow(10, exp300 - Math.floor(exp300)).toFixed(1)}&nbsp;×&nbsp;${pow10(Math.floor(exp300))}`;
    const opts = [opt(kit, trueVal), opt(kit, "0.0"), "An error: the number is too small"];
    const fb = [
      ["That is the true value on paper. A Python float cannot hold a number that small, so it does not stay that size.", false],
      [`Right, Python printed <code>0.0</code>. The true value is about ${trueVal}, too small for a float, so it rounds to 0, and then every label scores 0 again. This is called <b>underflow</b>. The fix: add <b>logs</b> instead of multiplying. log(a × b) = log a + log b, and a bigger probability always has a bigger log, so the winning label is the same. The sum for ${UNDER[ask300][0]} words was ${UNDER[ask300][2]}: an ordinary number. That is why the code you will see adds <code>math.log(...)</code>, and why scikit-learn keeps its word probabilities as logs.`, true],
      ["No error is raised. The multiplication quietly gives a result, which is worse: the scores just become wrong.", false]
    ];
    const paint = () => {
      const rows = UNDER.slice(0, ask300).concat(ans === 1 ? UNDER.slice(ask300) : []);
      el.innerHTML = `<h1>A long review</h1>
        <p class="lead">Real reviews can run to hundreds of words. A Python run tested this. It took one word probability, ${frac(UNDER_P[0], UNDER_P[1])}, and multiplied it in once per word. That number is P(${UNDER_WORD} | bug) with the add-one fix: (${cnt("bug", UNDER_WORD)} + 1) / (${TOTAL.bug} + ${V}). Here is what it printed:</p>
        ${grid3(kit, ["words", "product", "sum of logs"], rows.map(([n, p, s]) => [[String(n), pySci(p), ans === 1 ? f2(s) : "…"]]), { caption: "underflow.py output (products rounded to 3 digits)" })}
        <p class="task">What does the product print for ${UNDER[ask300][0]} words?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 6. From scratch in Python: a stepped replay of classify(). */
  const FR = TRACE.map(r => ({ ln: r[0], end: r[1] === "r", label: r[2], word: r[3], count: r[4], score: r[5], best: r[6], bestScore: r[7] }));
  // which label each word's step favoured: the one whose score dropped less (gaps under 0.2 left out)
  const PULL = (() => {
    const d = {};
    TRACE.forEach((r, k) => { if (r[0] === 7) d[r[2] + " " + r[3]] = r[5] - TRACE[k - 1][5]; });
    const out = { bug: [], other: [] };
    TRACE_WORDS.forEach(w => { const g = d["bug " + w] - d["other " + w]; if (Math.abs(g) >= 0.2) out[g > 0 ? "bug" : "other"].push(w); });
    return out;
  })();
  function sayFrame(kit, f) {
    if (f.end) return `Line 10 returns <b>${kit.esc(f.best)}</b>: ${f2(SCORE_B.other)} beats ${f2(SCORE_B.bug)}. A close call. ${PULL.other.map(w => `“${kit.esc(w)}”`).join(", ")} pulled towards other; ${PULL.bug.map(w => `“${kit.esc(w)}”`).join(", ")} towards bug.`;
    if (f.ln === 1) return `Line 1 keeps the words that appear in the training reviews: ${TRACE_WORDS.length} of them. “${kit.esc(DROPPED_B.join(", "))}” is dropped. The counting code that built <code>word_counts</code>, <code>total_words</code>, <code>prior</code> and <code>vocab</code> ran before this, on the ${N} reviews.`;
    if (f.ln === 4) return `Label <b>${kit.esc(f.label)}</b>. The score starts at the log of its share of reviews (<code>prior</code>), ${frac(NREV[f.label], N)}: ${f2(f.score)}.`;
    if (f.ln === 7) return `“${kit.esc(f.word)}” appears ${plural(f.count, "time")} under ${kit.esc(f.label)}. Add log((${f.count} + 1) / (${TOTAL[f.label]} + ${V})). Score now ${f2(f.score)}.`;
    if (f.ln === 9) return `${kit.esc(f.label)} scored ${f2(f.score)}, the best so far, so line 9 keeps it.`;
    return "";
  }
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>From scratch in Python</h1>
        <p class="lead">The same method with both fixes, run on “${kit.esc(REV_B)}”. Each probability is below 1, and the log of a number below 1 is negative. So the scores are negative, and the one closer to 0 wins.</p>
        <p class="task">Step through to the end. Watch which words move each score most.</p>
        ${codeWrap(kit, CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>label <b>${kit.esc(f.label || "–")}</b></span><span>word <b>${f.ln === 7 ? kit.esc(f.word) : "–"}</b></span><span>count <b>${f.ln === 7 ? f.count : "–"}</b></span><span>score <b>${f.score == null ? "–" : f2(f.score)}</b></span><span>best <b>${f.best ? `${kit.esc(f.best)} ${f2(f.bestScore)}` : "–"}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. The real library: predict two of its labels before seeing the output. */
  function library({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null];
    const right = [LABELS.indexOf(SK_PRED[0]), LABELS.indexOf(SK_PRED[1])];
    const fb = [
      [[`Same method, same add-one smoothing (<code>alpha=1.0</code>), same counts. Your scratch run said ${TRACE_RESULT}, so this says ${SK_PRED[0]} too.`, false],
       [`Right, the same as your scratch run. Its probabilities, ${SK_PROBA[0][0]} and ${SK_PROBA[0][1]}, are the two scratch scores turned back from logs and scaled to add up to 1.`, true]],
      [[`“crashing” looks like a bug word, but it is not “crashes”. <code>CountVectorizer</code> only counts words it saw in <code>fit_transform</code>; in this run it kept only ${SK_KEPT_2.map(w => `“${w}”`).join(", ")}, all from other reviews.`, false],
       [`Right. The vectorizer kept only ${SK_KEPT_2.map(w => `“${w}”`).join(", ")}. “crashing” and “keeps” were never in the training reviews, so they count for nothing, and “crashes” does not help “crashing”: to the model they are different words.`, true]]
    ];
    const paint = () => {
      const allDone = ans.every((a, k) => a === right[k]);
      el.innerHTML = `<h1>The same model in scikit-learn</h1>
        <p class="lead"><code>CountVectorizer</code> turns each review into word counts (lowercase, words of two or more letters or digits, the rule you used). <code>fit_transform</code> learns the vocabulary from the training reviews and counts their words; <code>transform</code> counts new reviews with that same vocabulary. <code>MultinomialNB</code> is naive Bayes on counts. <code>review_texts</code> and <code>review_labels</code> are the ${N} reviews; <code>new_reviews</code> holds ${SK_NEW.length} new ones.</p>
        ${codeWrap(kit, CODE_SK, -1)}
        <p class="task">Predict the label for the first two new reviews.</p>
        ${[0, 1].map(k => `<div class="lcase" id="c${k}">${newReview(kit, SK_NEW[k], `new review ${k + 1}`)}${kit.options(LABELS, { picked: ans[k], correct: right[k] })}${ans[k] == null ? "" : kit.feedback(...fb[k][ans[k] === right[k] ? 1 : 0])}</div>`).join("")}
        ${allDone ? `<div class="lx-${ID}-out">${kit.esc(SK_OUT)}</div><p class="lx-${ID}-cap">Output of library.py, scikit-learn ${SK_VERSION}</p>
          <p class="lead">The first line is <code>classes_</code>, the label order. The second holds the ${SK_PRED.length} predicted labels. The last block has one row per new review: P(bug), then P(other). Three settings matter. <code>alpha</code> is the add-one smoothing. <code>fit_prior=True</code> (the default) learns each label's share of reviews; <code>class_prior</code> lets you set the shares yourself. And the vectorizer's vocabulary is fixed when you fit it: new words count for nothing until you retrain.</p>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, k) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[k] = +b.dataset.i; paint();
        if (ans.every((a, j) => a === right[j])) done();
      }));
    };
    paint();
  }

  /* 8. What the naive assumption gives up. */
  function givesUp({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const iFixed = SK_NEW.indexOf("the update fixed the crashes"), i1 = SK_NEW.indexOf("crashes"), i3 = SK_NEW.indexOf("crashes crashes crashes");
    const pBug = k => SK_PROBA[k][LABELS.indexOf("bug")];
    const Q = [
      { right: 2, opts: [
          "The share of reviews favours bug",
          "Too little smoothing: alpha should be higher",
          "The model sees separate words, not what they say together: “crashes” and “update” both lean bug, and “fixed” was never seen",
          "It learned that “fixed the crashes” is a bug phrase"],
        fb: [
          [`It favours other: ${frac(NREV.other, N)} of the reviews. The words outweighed it.`, false],
          ["Smoothing only stops zeros. Both words that counted, “crashes” and “update”, really are more common in bug reports, so more smoothing would only shrink the lead, not fix the reason.", false],
          null,
          ["It never sees phrases, only single words counted separately. No training review contains “fixed” at all.", false]] },
      { right: 2, opts: [`The same, ${pBug(i1)}`, `Lower than ${pBug(i1)}`, `Higher than ${pBug(i1)}`],
        fb: [
          [`The model multiplies in P(crashes | bug) once per copy. Three copies means three times the push towards bug, so the result changes.`, false],
          ["Each copy multiplies in the same fraction again, and “crashes” leans bug, so each copy pushes further towards bug, not back.", false],
          null] }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>What “naive” gives up</h1>
        ${stage === 0 ? `<p class="lead">The same run put new review ${iFixed + 1} in the testers' queue, with probability ${pBug(iFixed)} for bug:</p>${newReview(kit, SK_NEW[iFixed], `new review ${iFixed + 1}`)}` :
          `<p class="lead">Right: words are counted one by one, so order, “not”, “no” and “fixed” cannot change what a word means. Second question. For new review ${i1 + 1}, “${kit.esc(SK_NEW[i1])}”, the model gave bug ${pBug(i1)}. Review ${i3 + 1} is the same word three times:</p>${newReview(kit, SK_NEW[i3], `new review ${i3 + 1}`)}`}
        ${stage < 2 ? `<p class="task">${stage === 0 ? "Why did it land there?" : "What probability of bug did it get?"}</p>` : ""}
        <div class="lpanel">${stage < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`Higher: ${pBug(i3)}. The model treats each copy as new, independent evidence, though the reviewer said one thing. Real text is full of words that come together, so naive Bayes pushes its probabilities towards 0 or 1. The scikit-learn guide puts it plainly: a decent classifier, but a bad estimator. So do not take <code>predict_proba</code> too seriously. Use the label, or the order of the scores. To read the numbers as real chances, calibrate them first: fit a small correction on reviews the model did not train on (scikit-learn's <code>CalibratedClassifierCV</code>).`, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Training takes longer as the reviews pile up",
      "The new words count for nothing, so those reviews are judged on the few old words left",
      "With alpha at 1.0 the new words get a small share, so they lean the wrong way"
    ];
    const fb = [
      ["Training is counting: one pass over the reviews. That stays fast. The trouble is what the counts do not contain.", false],
      ["Right. The vocabulary was fixed when the model was trained. Until someone labels new reviews and retrains, the words that now matter most are invisible to it.", true],
      ["Smoothing only helps words the vocabulary already has. A word that was in no training review is not in the vocabulary at all, so it gets no fraction under either label, whatever alpha is.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for naive Bayes</h1>
        <p class="lead"><b>For:</b> sorting short texts into labels by their words: reviews, tickets, spam. <b>Reach for it</b> as a first <b>baseline</b>, the simple model a stronger one must beat: it needs little labelled data, trains by counting, runs fast, and you can explain any decision from the counts. <b>Not</b> when meaning lives in order or negation (“not broken”), when you need probabilities you can trust, or when you have lots of data and need the best accuracy: try logistic regression on the same counts, or a language model that reads the whole sentence (later lessons). <b>Costs:</b> labelling examples; retraining as players' words change; and probabilities that need calibrating.</p>
        <p class="task">Two months after launch, players start calling a new boss “Grimjaw”, and reviews say “grimjaw fight softlocks”. What goes wrong first?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A help desk has 2,000 past emails, each tagged billing, login or other. They want a first router running this week and a number to beat later.", true,
      "Yes. Labelled texts, a handful of labels, words that differ by label (“invoice”, “password”), and a need for a fast baseline. Measure precision and recall per label on held-out emails before trusting it.",
      "This is the case naive Bayes is built for: labelled texts, a few labels, and words that differ between them. It trains in moments and gives a baseline that a stronger model must beat."],
    ["A food site wants to flag sarcastic restaurant reviews, such as “Great, another cold pizza. Just what I wanted.”", false,
      "No. Each word on its own leans positive (“great”, “wanted”). The sarcasm is in how the words combine with the situation, and naive Bayes scores words one at a time. A model that reads the whole sentence, such as a fine-tuned language model, is the better tool.",
      "Counted word by word, this review looks happy: “great” and “wanted” lean positive. The meaning comes from the words together, which is exactly what the naive assumption throws away."],
    ["An estate agent wants to predict a flat's rent from its size, floor and distance to the metro.", false,
      "No. The answer is a number, not a label, and the inputs are measurements, not word counts. That is a regression problem: start with linear regression.",
      "Naive Bayes picks a label. Rent is a number on a scale, and size or distance are not counts of words. Linear regression fits this."],
    ["A phone carrier has 5,000 text messages labelled spam or not, and wants to filter new ones as they arrive, cheaply, on its own servers.", true,
      "Yes. Spam filtering is one of the classic uses: the words differ sharply (“prize”, “claim”, “free”), scoring a message is a few additions, and it retrains quickly as spammers change words.",
      "Labelled short texts, two labels, words that differ strongly, and a need for something cheap per message: a good fit. Retrain it as the spam vocabulary changes."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Naive Bayes or not?</h1>
        <p class="lead">Four requests from other teams. Naive Bayes here means: count each word per label, multiply (or add logs), pick the label with the higher score.</p>
        <p class="task">Would you start with naive Bayes for each one? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can score a review</h1>
      <p class="lead">You counted words per label, multiplied their fractions with each label's share of reviews, and saw why that works: the naive pretence that words are independent once the label is known. You fixed zeros with add-one smoothing and tiny products with logs, matched your scratch run to scikit-learn, and saw what the pretence costs: meaning, word forms and honest probabilities.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the counting and <code>classify</code> yourself, with add-one smoothing and logs, and check your labels against the ten reviews.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Everything so far learned from labels a person gave; next you find groups in data that has no labels at all.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Naive Bayes for text: counting words",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/naive_bayes.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.naive_bayes.MultinomialNB.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.CountVectorizer.html",
      "https://scikit-learn.org/stable/modules/calibration.html"
    ],
    interview: [
      {
        q: "You have 3,000 support tickets labelled by team and need an automatic router by Friday. Would you start with naive Bayes, and what would you watch for?",
        good: [
          "Yes, as a baseline: it trains by counting, runs fast, and every decision can be explained from word counts",
          "Use smoothing (alpha) so a word unseen under one label does not zero out its score",
          "Hold out tickets and measure precision and recall per team, not just accuracy",
          "Do not read predict_proba as a real chance; the independence assumption pushes it towards 0 or 1",
          "Watch for negation and new product words; retrain as the vocabulary changes, and compare with logistic regression"
        ],
        weak: "Say naive Bayes is outdated and go straight to a large model, without a cheap baseline or a held-out measurement to compare against."
      },
      {
        q: "Your naive Bayes classifier says 0.99 on many predictions that turn out wrong. Why, and what do you do?",
        good: [
          "It multiplies each word as independent evidence, but words come together, so evidence is counted twice and scores are pushed to the extremes",
          "Its labels can still be good while its probabilities are poor; scikit-learn's guide calls it a decent classifier but a bad estimator",
          "Choose the threshold on a validation set by precision and recall instead of trusting 0.99",
          "If calibrated probabilities are needed, calibrate on held-out data, for example with CalibratedClassifierCV"
        ],
        weak: "Raise alpha until the numbers look smaller. Smoothing only fixes zero counts; it does not fix double-counted evidence."
      }
    ],
    screens: [firstCount, multiply, spotIdea, zeros, logs, asCode, library, givesUp, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["#c1 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
