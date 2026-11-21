/* Lesson: TF-IDF. Story: an electricity company's inbox team wants the emails about double-charged meters on top
   for the query "double charged meter", not the thank-you email that says "meter" four times.
   Ideas: (1) weight each count by how rare the word is across the inbox (idf), scale each email's row to length 1,
   rank by the sum of query weight x email weight; (2) the same with scikit-learn's TfidfVectorizer, one parameter
   (sublinear_tf) and BM25, the variant search engines use, which stops rewarding repeats.
   Data, all real, from docs/ai-path/runs/s4-tf-idf/ (no model calls):
   - inbox.py: the eight emails (written for the lesson) and the query;
   - tfidf_scratch.py + .out.txt: document frequencies, idf, raw counts, scaled weights, scores, and the traced
     tfidf() call on the query shown on the code screen (lines kept short to fit a phone);
   - sklearn_check.py + .out.txt: TfidfVectorizer idf_, scores, difference from scratch, sublinear_tf=True scores;
   - bm25.py + .out.txt: BM25 written from Apache Lucene's BM25Similarity, scores and the repeat factor.
   Lesson-local style: email list, weight grid and score rows (.lx-s4-tf-idf-*), see ensureStyle(). */
(() => {
  const ID = "s4-tf-idf";
  const f2 = v => v.toFixed(2), f4 = v => v.toFixed(4);

  /* ---------- Data copied from the runs ---------- */
  // From docs/ai-path/runs/s4-tf-idf/inbox.py
  const EMAILS = [
    "Thank you for the visit. The new meter is in, the meter light is on and the meter reading looks right. Thank you, the meter man was kind.",
    "We were double charged this month. The bill has the same meter reading on it twice.",
    "Thank you for the help with the app. The new login works, thank you.",
    "I paid twice for the same reading on the August bill.",
    "When will the engineer come to read the meter? The last reading was in May.",
    "Please update the address on the account. Thank you.",
    "The direct debit charged the wrong amount. Can you check the account?",
    "The smart meter screen is blank since the storm. Thank you."
  ];
  const QUERY = "double charged meter";
  // tfidf_scratch.out.txt: "df <word> <df> idf <idf>"
  const DF = { the: 8, meter: 4, charged: 2, double: 1 };
  const IDF = { the: 1.0, meter: 1.5878, charged: 2.0986, double: 2.5041 };
  // tfidf_scratch.out.txt, "TF-IDF WEIGHTS OF QUERY WORDS AND 'the' (after length scaling)", emails 1..8
  const COLS = ["double", "charged", "meter", "the"];
  const W = [
    [0, 0, 0.4924, 0.3876], [0.2929, 0.2455, 0.1857, 0.2340], [0, 0, 0, 0.3692], [0, 0, 0, 0.3241],
    [0, 0, 0.1858, 0.3511], [0, 0, 0, 0.3418], [0, 0.2770, 0, 0.3960], [0, 0, 0.2322, 0.2924]
  ];
  // tfidf_scratch.out.txt "QUERY VECTOR" and "TF-IDF SCORES" (email number -> score); sklearn_check.out.txt prints the same
  const QVEC = { double: 0.6893, charged: 0.5777, meter: 0.4371 };
  const SCORES = { 1: 0.2152, 2: 0.4249, 3: 0, 4: 0, 5: 0.0812, 6: 0, 7: 0.1600, 8: 0.1015 };
  // sklearn_check.out.txt
  const SK = { shape: [8, 59], idf: { the: 1.0, meter: 1.5878, charged: 2.0986, double: 2.5041 }, diff: "0.0e+00" };
  const SUB = { 1: 0.1564, 2: 0.4283, 3: 0, 4: 0, 5: 0.0839, 6: 0, 7: 0.1668, 8: 0.1027 };
  // bm25.out.txt
  const BM25 = { 1: 0.4580, 2: 1.6361, 3: 0, 4: 0, 5: 0.3096, 6: 0, 7: 0.6244, 8: 0.3485 };
  const SAT = [[1, 0.4545], [2, 0.6250], [4, 0.7692], [8, 0.8696], [16, 0.9302]]; // tf, bm25 factor (k1 1.2, average length)
  const K1 = 1.2, B = 0.75; // Lucene's defaults, used in bm25.py

  // The listing is tfidf() from tfidf_scratch.py, line for line (line 0 = def).
  const CODE = [
    "def tfidf(words, df, n):",
    "    counts = Counter(words)",
    "    weights = {}",
    "    for word, count in counts.items():",
    "        rarity = (1 + n) / (1 + df[word])",
    "        idf = math.log(rarity) + 1",
    "        weights[word] = count * idf",
    "    length = math.hypot(*weights.values())",
    "    for word in weights:",
    "        weights[word] /= length",
    "    return weights"
  ];
  // TRACE tfidf(query_words) in tfidf_scratch.out.txt (the "line" events, the final "return" left out):
  // [line about to run, word, count, rarity, idf, weights, length]
  const D1 = { double: 2.5041 }, D2 = { double: 2.5041, charged: 2.0986 }, D3 = { double: 2.5041, charged: 2.0986, meter: 1.5878 };
  const TRACE = [
    [1, null, null, null, null, null, null], [2, null, null, null, null, null, null], [3, null, null, null, null, {}, null],
    [4, "double", 1, null, null, {}, null], [5, "double", 1, 4.5, null, {}, null], [6, "double", 1, 4.5, 2.5041, {}, null],
    [3, "double", 1, 4.5, 2.5041, D1, null],
    [4, "charged", 1, 4.5, 2.5041, D1, null], [5, "charged", 1, 3.0, 2.5041, D1, null], [6, "charged", 1, 3.0, 2.0986, D1, null],
    [3, "charged", 1, 3.0, 2.0986, D2, null],
    [4, "meter", 1, 3.0, 2.0986, D2, null], [5, "meter", 1, 1.8, 2.0986, D2, null], [6, "meter", 1, 1.8, 1.5878, D2, null],
    [3, "meter", 1, 1.8, 1.5878, D3, null], [7, "meter", 1, 1.8, 1.5878, D3, null],
    [8, "meter", 1, 1.8, 1.5878, D3, 3.6326],
    [9, "double", 1, 1.8, 1.5878, D3, 3.6326], [8, "double", 1, 1.8, 1.5878, { double: 0.6893, charged: 2.0986, meter: 1.5878 }, 3.6326],
    [9, "charged", 1, 1.8, 1.5878, { double: 0.6893, charged: 2.0986, meter: 1.5878 }, 3.6326],
    [8, "charged", 1, 1.8, 1.5878, { double: 0.6893, charged: 0.5777, meter: 1.5878 }, 3.6326],
    [9, "meter", 1, 1.8, 1.5878, { double: 0.6893, charged: 0.5777, meter: 1.5878 }, 3.6326],
    [8, "meter", 1, 1.8, 1.5878, { double: 0.6893, charged: 0.5777, meter: 0.4371 }, 3.6326],
    [10, "meter", 1, 1.8, 1.5878, { double: 0.6893, charged: 0.5777, meter: 0.4371 }, 3.6326]
  ];

  /* ---------- Derived from the data ---------- */
  const N = EMAILS.length;
  const tokens = t => t.toLowerCase().match(/\b\w\w+\b/g) || []; // scikit-learn's default rule (the emails are plain ASCII)
  const WORDS = EMAILS.map(tokens);
  const QW = tokens(QUERY);
  const count = (i, w) => WORDS[i].filter(x => x === w).length;
  const RAW = WORDS.map((_, i) => QW.reduce((s, q) => s + count(i, q), 0));
  const order = sc => Object.keys(sc).map(Number).sort((a, b) => sc[b] - sc[a] || a - b);
  const RANK = order(SCORES), RANK_SUB = order(SUB), RANK_BM = order(BM25);
  const RAW_TOP = RAW.indexOf(Math.max(...RAW)) + 1; // email number
  const TOP = RANK[0], SECOND = RANK[1];
  const ZERO = RANK.filter(e => SCORES[e] === 0);
  const SYN = 4; // "I paid twice for the same reading": about a double charge, shares no query word
  const contains = w => WORDS.map((ws, i) => ws.includes(w) ? i + 1 : 0).filter(Boolean);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-mail { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-mail li { display: grid; grid-template-columns: 2.2em 1fr; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-mail li.lx-${ID}-on { border-left: 3px solid var(--ink); padding-left: 8px; }
      .lx-${ID}-n { font: 600 14px/1.45 var(--mono); color: var(--muted); }
      .lx-${ID}-q { font: 600 15px var(--mono); }
      .lx-${ID}-grid { width: 100%; border-collapse: collapse; margin: 14px 0 0; font: 500 14px/1.4 var(--mono); }
      .lx-${ID}-grid caption { text-align: left; font: 600 13px var(--font); color: var(--muted); padding-bottom: 6px; }
      .lx-${ID}-grid th, .lx-${ID}-grid td { padding: 7px 6px; border-bottom: 1px solid var(--line); text-align: right; }
      .lx-${ID}-grid th:first-child, .lx-${ID}-grid td:first-child { text-align: left; }
      .lx-${ID}-grid th { font-weight: 600; color: var(--muted); }
      .lx-${ID}-grid td.lx-${ID}-z { color: var(--faint); }
      .lx-${ID}-sc { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-sc div { display: grid; grid-template-columns: 4.6em 1fr 4.2em; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); font: 500 14px var(--mono); }
      .lx-${ID}-sc i { display: block; height: 10px; background: var(--ink-2); }
      .lx-${ID}-sc b { text-align: right; }
      .lx-${ID}-out { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
    `;
    document.head.appendChild(s);
  }
  const mailList = (kit, mark = []) => `<ol class="lx-${ID}-mail">${EMAILS.map((e, i) =>
    `<li class="${mark.includes(i + 1) ? `lx-${ID}-on` : ""}"><span class="lx-${ID}-n">${i + 1}</span><span>${kit.esc(e)}</span></li>`).join("")}</ol>`;
  // rows: [[label, value]], value shown with 4 decimals, bar width relative to the largest
  const scoreRows = (kit, rows) => {
    const mx = Math.max(...rows.map(r => r[1])) || 1;
    return `<div class="lx-${ID}-sc">${rows.map(([l, v]) => `<div><span>${kit.esc(l)}</span><span><i style="width:${(v / mx * 100).toFixed(1)}%"></i></span><b>${f4(v)}</b></div>`).join("")}</div>`;
  };
  const rankRows = (kit, sc) => scoreRows(kit, order(sc).map(e => [`email ${e}`, sc[e]]));
  const out = (kit, s) => `<div class="lx-${ID}-out">${kit.esc(s)}</div>`;
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;

  /* 1. The situation: a plain count of the query words puts the wrong email on top. */
  function inbox({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const choices = [RAW_TOP, 2, 7, SYN].filter((v, i, a) => a.indexOf(v) === i);
    const right = choices.indexOf(RAW_TOP);
    const fb = choices.map(e => e === RAW_TOP
      ? [`Right: in email ${e} the query words appear ${RAW[e - 1]} times (all of them “meter”: ${count(e - 1, "meter")}). It is a thank-you note. The email the team needs, email 2, scores ${RAW[1]}: “double”, “charged” and “meter” once each. Counting rewards the email that repeats the commonest query word.`, true]
      : e === SYN ? [`Email ${SYN} is about paying twice, but it uses none of the three query words: “paid twice”, not “double charged”. A count of query words gives it ${RAW[SYN - 1]}.`, false]
      : [`Count again: in email ${e} the query words appear ${RAW[e - 1]} times. Count every time a query word appears, and remember that email ${RAW_TOP} keeps saying one of them.`, false]);
    const paint = () => {
      el.innerHTML = `<h1>The inbox team's search</h1>
        <p class="lead">An electricity company's inbox team searches the morning's emails for <span class="lx-${ID}-q">${kit.esc(QUERY)}</span>. The search counts how many times the query words appear in each email and puts the highest count on top. In the last lesson you turned texts into word counts; this search uses exactly those counts. Ranking texts for a query is what every search box does, and what the retrieval step of a RAG app does. This lesson makes that ranking better.</p>
        ${mailList(kit)}
        <p class="task">Which email does this count put first?</p>
        <div class="lpanel">${ask(kit, choices.map(e => `Email ${e}`), right, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 2. By hand: in how many emails is each word, and what weight does that give? */
  function byHand({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null; // 0: df of "the", 1: df of "meter", 2: weight of "meter" in email 1, 3: done
    const dfOpts = w => [...new Set([2, 4, 6, 8, DF[w]])].sort((a, b) => a - b);
    const mCount = count(0, "meter"), tCount = count(0, "the");
    const wMeter = mCount * IDF.meter, wThe = tCount * IDF.the;
    const wOpts = [String(mCount), f2(IDF.meter), f2(wMeter), f2(mCount / IDF.meter)];
    const idfLine = w => `ln((1 + ${N}) / (1 + ${DF[w]})) + 1 = ${f2(IDF[w])}`;
    const say = (w, v) => v > DF[w]
      ? `Too many. Count emails that contain “${w}” at least once, not the times it appears.`
      : `Too few. Look at the short emails too: email ${contains(w).slice(-1)[0]} has “${w}”.`;
    const wFb = [
      `${mCount} is only how many times “meter” appears. That is the count you started with; the point is to weigh it by how common the word is.`,
      null,
      null,
      `Dividing makes a word weigh less the rarer it is, the opposite of what you want. Multiply the count by the rarity score.`
    ];
    wFb[1] = `${f2(IDF.meter)} is the rarity score of “meter” alone. Email 1 says it ${mCount} times; the count counts too.`;
    const paint = () => {
      const task = ["In how many of the 8 emails does “the” appear?", "In how many emails does “meter” appear?",
        `Weight = count × rarity score. Email 1 says “meter” ${mCount} times. What is its weight?`][stage];
      let body = "";
      if (stage <= 1) {
        const w = stage === 0 ? "the" : "meter", o = dfOpts(w);
        body = kit.options(o.map(String), { picked: wrong == null ? null : o.indexOf(wrong), correct: o.indexOf(DF[w]) })
          + (wrong != null ? kit.feedback(say(w, wrong), false) : "");
      } else if (stage === 2) {
        body = kit.options(wOpts, { picked: wrong, correct: 2 }) + (wrong != null ? kit.feedback(wFb[wrong], false) : "");
      }
      const known = [];
      if (stage >= 1) known.push(`“the” is in ${DF.the} of ${N} emails: rarity ${idfLine("the")}`);
      if (stage >= 2) known.push(`“meter” is in ${DF.meter} of ${N}: rarity ${idfLine("meter")}`);
      el.innerHTML = `<h1>How rare is each word?</h1>
        <p class="lead">Give each word a <b>rarity score</b> from the number of emails that contain it. The fewer emails, the higher the score. The score used here is <code>ln((1 + 8) / (1 + emails containing it)) + 1</code>, where <code>ln</code> is the natural logarithm (<code>Math.log</code> in JS). You only count; the lesson does the logarithm.</p>
        ${mailList(kit)}
        ${known.length ? out(kit, known.join("\n")) : ""}
        ${stage < 3 ? `<p class="task">${task}</p>` : ""}
        <div class="lpanel">${body}${stage === 3 ? kit.feedback(`Right: ${mCount} × ${f2(IDF.meter)} = ${f2(wMeter)}. “the” appears ${tCount} times in email 1 and gets ${tCount} × ${f2(IDF.the)} = ${f2(wThe)}. Per appearance, “meter” now weighs ${f2(IDF.meter / IDF.the)} times as much as “the”. And “double”, in only ${DF.double} email, gets ${f2(IDF.double)} per appearance.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (stage <= 1) {
          const w = stage === 0 ? "the" : "meter", v = dfOpts(w)[i];
          if (v !== DF[w]) { wrong = v; paint(); return; }
        } else if (i !== 2) { wrong = i; paint(); return; }
        wrong = null; stage++; paint();
        if (stage === 3) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: why rarity matters. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "“double” is a longer, more specific-looking word",
      `“double” is in ${DF.double} email and “meter” in ${DF.meter}: finding “double” points at far fewer emails`,
      "“double” comes first in the query",
      "“double” sounds urgent, so it should weigh more"
    ];
    const fb = [
      ["The score never looks at a word's length or spelling. “bill” is short and “engineer” is long; only how many emails contain each one matters.", false],
      [`Right. A word in every email (“the”, in all ${DF.the}) tells you nothing about which email you want. A word in one email points straight at it. Counting how often a word is in <b>this</b> email is the <b>term frequency</b> (TF). The rarity score across all emails is the <b>inverse document frequency</b> (IDF); a document here is one email, and “inverse” means fewer emails give a higher score. Their product is <b>TF-IDF</b>: a weight that is high when a word is frequent here and rare elsewhere.`, true],
      ["Word order is thrown away when you count. “meter charged double” gives the same weights.", false],
      ["The score knows nothing about meaning or urgency. It only counts emails. “double” wins because few emails contain it.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why rare words count more</h1>
        <p class="lead">Rarity scores: “double” ${f2(IDF.double)}, “charged” ${f2(IDF.charged)}, “meter” ${f2(IDF.meter)}, “the” ${f2(IDF.the)}.</p>
        <p class="task">Why should a match on “double” move an email up more than a match on “meter”?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it: scale rows to length 1, then predict the ranking. */
  function rank({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const top = [TOP, RAW_TOP, 7, SYN];
    const fb0 = top.map(e => e === TOP ? null
      : e === RAW_TOP ? [`Email ${RAW_TOP} has a big “meter” weight, ${f4(W[RAW_TOP - 1][2])}, but no “double” and no “charged”, the two rarest query words, which also weigh most in the query.`, false]
      : e === SYN ? [`Email ${SYN} has a zero in every query column. It shares no word with the query, so it cannot score.`, false]
      : [`Email ${e} has only “charged” (${f4(W[e - 1][1])}). Another email has all three query words.`, false]);
    const where = ["In the top three", "Somewhere in the middle", "Tied last, with a score of 0"];
    const fb1 = [
      [`Its row has 0 in every query column: “paid twice”, not “double charged”; “reading”, not “meter”. Every product is 0.`, false],
      ["Scores are a sum of products with the query's words. Email 4 has none of them, so there is nothing to add.", false],
      null
    ];
    const grid = () => `<table class="lx-${ID}-grid"><caption>Weights after scaling each email to length 1 (${COLS.length} of the ${SK.shape[1]} word columns; the length uses all of them)</caption><thead><tr><th>email</th>${COLS.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${W.map((r, i) => `<tr><td>${i + 1}</td>${r.map(v => `<td class="${v ? "" : `lx-${ID}-z`}">${v ? f4(v) : "0"}</td>`).join("")}</tr>`).join("")}<tr><td>query</td>${COLS.map(c => `<td>${QVEC[c] ? f4(QVEC[c]) : "–"}</td>`).join("")}</tr></tbody></table>`;
    const paint = () => {
      el.innerHTML = `<h1>Rank the inbox</h1>
        <p class="lead">An email's <b>row</b> is its list of weights, one per word. Two more moves before ranking. First, divide each weight by the row's length: the square root of the sum of squared weights. Every row then has length 1, so a long email cannot win just by having many words. Second, build the query's row the same way. An email's <b>score</b> is the sum, over the query's words, of query weight × email weight. That is the dot product of two rows of length 1, which is their cosine similarity.</p>
        ${grid()}
        ${stage === 0 ? `<p class="task">Which email ranks first for “${kit.esc(QUERY)}”? For each email, multiply each query weight by the email's weight in the same column and add.</p><div class="lpanel">${ask(kit, top.map(e => `Email ${e}`), 0, ans, fb0)}</div>` : ""}
        ${stage >= 1 ? kit.feedback(`Email ${TOP} first: ${COLS.slice(0, 3).map(c => `${f4(QVEC[c])} × ${f4(W[TOP - 1][COLS.indexOf(c)])}`).join(" + ")} = ${f4(SCORES[TOP])}. The thank-you email ${RAW_TOP} drops to second with ${f4(SCORES[SECOND])}.`, true) : ""}
        ${stage === 1 ? `<p class="task">Email ${SYN} says “${kit.esc(EMAILS[SYN - 1])}” Where does it land?</p><div class="lpanel">${ask(kit, where, 2, ans, fb1)}</div>` : ""}
        ${stage === 2 ? `${rankRows(kit, SCORES)}<div class="lpanel">${kit.feedback(`Right, and that is TF-IDF's blind spot. Email ${SYN} is about a double charge, but it shares no word with the query, so it ties at 0 with ${ZERO.length - 1} unrelated emails. TF-IDF matches words, not meaning.`, true)}</div>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        const ok = stage === 0 ? ans === 0 : ans === 2;
        if (ok) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 5. From scratch in Python: a stepped replay of tfidf() on the query. */
  // Each frame: line `ln` has just run, `v` is the traced state right after it. Shown: lines 2, 5, 6, 7, then the end.
  const SHOW = new Set([2, 5, 6, 7]);
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) if (SHOW.has(TRACE[k - 1][0])) fr.push({ ln: TRACE[k - 1][0], v: TRACE[k] });
    fr.push({ ln: 10, v: TRACE[TRACE.length - 1], end: true });
    return fr;
  })();
  const BEFORE = FR.find(f => f.ln === 7).v[5]; // weights before the division loop
  const wtxt = o => o ? `{${Object.entries(o).map(([k, v]) => `${k}: ${f4(v)}`).join(", ")}}` : "–";
  const sayFrame = f => {
    const [, word, cnt, rarity, idf, wts, len] = f.v;
    if (f.end) return `The last loop divides each weight by the length: ${Object.keys(wts).map(w => `${w} ${f4(BEFORE[w])} / ${f4(len)} = ${f4(wts[w])}`).join(", ")}. That is the query row you used on the last screen.`;
    if (f.ln === 2) return `<code>counts</code> holds each query word once (${QW.map(w => `“${w}”`).join(", ")}), and <code>weights</code> starts empty. The loop will weigh the words one by one.`;
    if (f.ln === 5) return `“${word}” is in ${DF[word]} email${DF[word] === 1 ? "" : "s"}. rarity = (1 + ${N}) / (1 + ${DF[word]}) = ${f4(rarity)}. Then idf = ln(${f4(rarity)}) + 1 = ${f4(idf)}.`;
    if (f.ln === 6) return `weight = count × idf = ${cnt} × ${f4(idf)} = ${f4(wts[word])}.`;
    if (f.ln === 7) return `<code>math.hypot</code> takes the square root of the sum of squares: length = √(${Object.values(wts).map(f4).join("² + ")}²) = ${f4(len)}.`;
    return "";
  };
  function scratch({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i], [, word, , rarity, idf, wts, len] = f.v;
      el.innerHTML = `<h1>TF-IDF from scratch, in Python</h1>
        <p class="lead"><code>df</code> maps each word to the number of emails containing it, <code>n</code> is the number of emails, and <code>Counter</code> counts words, like counting into a JS object. This replays a real run that builds the query's row. Every email's row is built by the same function.</p>
        <p class="task">Step through to the end. Check each number against the formula.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>word <b>${kit.esc(word || "–")}</b></span><span>rarity <b>${rarity == null ? "–" : f4(rarity)}</b></span><span>idf <b>${idf == null ? "–" : f4(idf)}</b></span><span>weights <b>${kit.esc(wtxt(wts))}</b></span><span>length <b>${len == null ? "–" : f4(len)}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. The library: scikit-learn's TfidfVectorizer gives the same numbers. */
  const SK_CODE = [
    "vectorizer = TfidfVectorizer()",
    "rows = vectorizer.fit_transform(EMAILS)",
    "query_row = vectorizer.transform([QUERY])",
    "scores = (rows @ query_row.T).toarray()",
    "scores = scores.ravel()",
    "print(\"matrix shape\", rows.shape)",
    "idf = vectorizer.idf_",
    "vocab = vectorizer.vocabulary_",
    "words = \"the meter charged double\".split()",
    "for w in words:",
    "    print(f\"idf_ {w} {idf[vocab[w]]:.4f}\")"
  ];
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["0.00", f2(SK.idf.the), "0.69"];
    const fb = [
      [`That is a textbook score, ln(8 / 8) = 0, which would drop “the” completely. scikit-learn always adds 1 to the logarithm, so a word in every email keeps a small weight instead of zero. Its default <code>smooth_idf=True</code> also adds 1 to both counts: ln(9 / 9) + 1 = 1.`, false],
      null,
      ["0.69 is ln 2, which you get by adding 1 inside the logarithm, ln(1 + 8 / 8). Some idf variants do that; scikit-learn adds the 1 after it: ln(9 / 9) + 1.", false]
    ];
    const outTxt = `matrix shape (${SK.shape.join(", ")})\n${["the", "meter", "charged", "double"].map(w => `idf_ ${w} ${f4(SK.idf[w])}`).join("\n")}\nranking [${RANK.join(", ")}]\n…\nlargest difference from scratch ${SK.diff}`;
    fb[1] = [`Right: ${f4(SK.idf.the)}, the same as yours. The whole recorded run:${out(kit, outTxt)}<p class="lx-${ID}-cap">Output of sklearn_check.py, run on our machine (score lines cut at …)</p>The scores match the from-scratch ones exactly, because the defaults are the same recipe: <code>lowercase=True</code> and words of 2 or more letters or digits (so “I” is dropped), raw counts, <code>smooth_idf=True</code>, and <code>norm="l2"</code> (each row scaled to length 1). <code>fit_transform</code> learns the vocabulary and the idf from the emails; <code>transform</code> reuses them for the query, so a query word never seen in the emails is ignored. The matrix has ${SK.shape[1]} columns for ${SK.shape[0]} short emails: one per distinct word.`, true];
    const paint = () => {
      el.innerHTML = `<h1>The same thing with scikit-learn</h1>
        <p class="lead">In practice you call the library. <code>TfidfVectorizer</code> does the counting, the rarity scores and the scaling. <code>@</code> multiplies the matrices: each email's row times the query's row, the same sum of products as before. <code>.T</code>, <code>toarray()</code> and <code>ravel()</code> only reshape the result into a plain list of 8 scores. <code>vocabulary_</code> maps each word to its column number, and <code>idf_</code> holds the rarity score of each column. These lines are from the script that ran on the same eight emails:</p>
        ${kit.code(SK_CODE, ans === 1 ? SK_CODE.length - 1 : -1)}
        <p class="task">Your from-scratch rarity score for “the” was ${f2(IDF.the)}. What does the loop print for “the” on its first round, to two decimals?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. One parameter: sublinear_tf. */
  function sublinear({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const pos = RANK_SUB.indexOf(RAW_TOP) + 1, was = RANK.indexOf(RAW_TOP) + 1;
    const opts = ["It moves up", "It stays where it is", "It moves down"];
    const right = pos > was ? 2 : pos < was ? 0 : 1;
    const c = count(RAW_TOP - 1, "meter");
    const fb = [
      [`Its strength was repeating “meter” ${c} times. With 1 + ln(count), ${c} repeats count as ${f2(1 + Math.log(c))} instead of ${c}, so it loses ground.`, false],
      [`The other emails say each query word once, and 1 + ln(1) = 1, so their counts do not change. Email ${RAW_TOP}'s ${c} drops to ${f2(1 + Math.log(c))}. Something has to move.`, false],
      [`Right. It drops from place ${was} to place ${pos}:${rankRows(kit, SUB)}<p class="lx-${ID}-cap">Output of sklearn_check.py with <code>sublinear_tf=True</code></p>Repeating a word now helps less and less. Two other parameters you will meet: <code>stop_words="english"</code> removes a built-in list of common words (the docs warn the list has known issues), and <code>max_df</code> drops words that appear in more than a share of the documents, which removes words like “the” using your own data.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Should the fourth “meter” count as much as the first?</h1>
        <p class="lead">With <code>TfidfVectorizer(sublinear_tf=True)</code> the count is replaced by 1 + ln(count). Once stays 1; ${c} times becomes ${f2(1 + Math.log(c))}. Email ${RAW_TOP}, the thank-you note, is now in place ${was}.</p>
        <p class="task">Where does email ${RAW_TOP} go with <code>sublinear_tf=True</code>?</p>
        <div class="lpanel">${ask(kit, opts, right, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 8. BM25: the variant search engines use. */
  function bm25({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const [t1, s1] = SAT[0], [tN, sN] = SAT[SAT.length - 1];
    const ratio = sN / s1;
    const opts = [`${tN} times as much`, `about ${Math.round(ratio)} times as much`, "the same"];
    const fb = [
      [`That is plain TF-IDF, where weight grows with the count. In BM25 the factor for ${tN} repeats is ${f4(sN)} against ${f4(s1)} for one.`, false],
      [`Right: ${f4(sN)} / ${f4(s1)} ≈ ${ratio.toFixed(1)}. The factor approaches a ceiling, so stuffing a word in brings almost nothing. The same emails ranked by BM25:${rankRows(kit, BM25)}<p class="lx-${ID}-cap">Output of bm25.py: our short version of Lucene's formula, not Elasticsearch itself</p>Email ${RANK_BM[0]} is still first, and the thank-you email ${RAW_TOP} falls to place ${RANK_BM.indexOf(RAW_TOP) + 1}. BM25 also has <code>b</code> (default ${B}): how strongly a long document is held back, which replaces scaling rows to length 1.`, true],
      [`Not the same: a second appearance still adds something (${f4(SAT[1][1])} for 2 against ${f4(s1)} for 1). It just adds less each time.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>BM25: what search engines use instead</h1>
        <p class="lead">Elasticsearch scores with <b>BM25</b> by default, and Apache Lucene, the library under it, implements it. BM25 keeps the TF-IDF idea that rare words weigh more. What it changes is the count. A word's count goes through a factor that levels off: each repeat adds less than the one before. <code>k1</code> (default ${K1}) sets how fast it levels off. For an email of average length, from our run:</p>
        ${scoreRows(kit, SAT.map(([t, v]) => [`${t}×`, v]))}
        <p class="lx-${ID}-cap">BM25 factor for a word repeated 1 to ${tN} times (k1 = ${K1})</p>
        <p class="task">An email repeats “meter” ${tN} times. How much more does it earn from “meter” than an email of the same length that says it once?</p>
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
      "Customers write “cancel”, “end my contract”, “stop my plan”: find every message that means the same thing",
      "Find the support tickets that mention error code E-4012 among a hundred thousand",
      "Decide whether the bill in a photo is from this company"
    ];
    const fb = [
      [`Three phrasings that share almost no words. TF-IDF gives a message a score only for shared words, like email ${SYN}'s 0. This needs a method that matches meaning, such as embeddings.`, false],
      ["Right. An exact, rare token like an error code is TF-IDF's best case: it appears in few tickets, so its idf is high and those tickets jump to the top. It is cheap, needs no training, and you can see which word gave each score.", true],
      ["A photo is not text. TF-IDF needs words to count; this is an image task.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for TF-IDF</h1>
        <p class="lead"><b>What it is:</b> a weight for each word that is high when the word is frequent in this document and rare in the others.</p>
        <p class="lead"><b>For:</b> keyword search, and as cheap word features for a first text classifier. <b>Reach for it</b> when queries use the same words as the documents: codes, names, product terms. For a real search box, use BM25 in a search engine rather than your own code.</p>
        <p class="lead"><b>Not</b> when the same meaning comes in different words (email ${SYN}): use embeddings, from later lessons. It also throws word order away, so it cannot tell “charged twice, not once” from “charged once, not twice”.</p>
        <p class="lead"><b>Costs:</b> fast and runs on a CPU. But there is one column per distinct word, so the matrix grows with the vocabulary. The rarity scores must be refitted as the documents change.</p>
        <p class="task">Which job would you start with TF-IDF?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A hardware shop's site: customers search 4,000 product pages by part names like “M8 hex bolt” or “PVC elbow 40 mm”.", true,
      "Yes. The queries use the same exact terms as the pages, and part names are rare across the catalogue, so they get high weights.",
      "Exact part names in the query also appear on the right page, and each is rare across the catalogue. That is the case where weighting rare shared words works best."],
    ["A council receives complaints in Uzbek and in Russian and wants each Russian complaint matched with Uzbek complaints about the same problem.", false,
      "No. A Russian and an Uzbek complaint share almost no words, so every score is close to 0, whatever the meaning. Matching across languages needs a multilingual embedding model.",
      "TF-IDF scores only shared words. Two languages use different words for the same street light, so the scores are near 0. The weighting cannot fix a vocabulary that does not overlap."],
    ["A newsroom has 30,000 old articles and wants the ten most similar to a new article, to link under it.", true,
      "Yes. Two long articles on the same story share many specific names and terms, and TF-IDF with cosine finds them cheaply. It is a common first version before trying embeddings.",
      "Long articles on the same event share many rare words: names, places, terms. The cosine of their TF-IDF rows picks that up without any training."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>TF-IDF or not?</h1>
        <p class="lead">Three other jobs. TF-IDF scores a document by the words it shares with the query, weighted by how rare each word is.</p>
        <p class="task">Would TF-IDF do the job? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can weigh words</h1>
      <p class="lead">You counted in how many emails each word appears, turned that into a rarity score, scaled rows to length 1 and ranked by the dot product with the query. scikit-learn gave the same numbers. BM25 is the search-engine version that stops rewarding repeats.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the TF-IDF function yourself and rank a small set of texts for a query.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Email ${SYN} scored 0 because it shared no word with the query; next you train word vectors that put words used in the same contexts close together.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "TF-IDF: weighting words that are rare elsewhere",
    checked: "2026-11-13",
    sources: [
      "https://scikit-learn.org/stable/modules/feature_extraction.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html",
      "https://www.elastic.co/docs/reference/elasticsearch/index-settings/similarity",
      "https://lucene.apache.org/core/10_5_0/core/org/apache/lucene/search/similarities/BM25Similarity.html",
      "https://github.com/apache/lucene/blob/main/lucene/core/src/java/org/apache/lucene/search/similarities/BM25Similarity.java"
    ],
    interview: [
      {
        q: "Your TF-IDF search over help articles puts a long general FAQ page near the top for almost every query. What do you check and change?",
        good: [
          "Check that rows are normalised (norm l2), so a long page does not win by covering many words",
          "Look at which query words gave the FAQ its score: probably common words with low but non-zero weight",
          "Remove very common words with max_df or a stop word list, and try sublinear_tf so repeats count less",
          "Move to BM25, whose b parameter controls how much long documents are held back"
        ],
        weak: "Delete the FAQ page from the index. That hides one symptom and does not explain why long pages score high."
      },
      {
        q: "A colleague wants to replace the keyword search on your parts catalogue with embeddings. When would you keep TF-IDF or BM25?",
        good: [
          "When queries are exact codes and part names that also appear in the documents: rare shared tokens are where keyword weighting is strongest",
          "It is cheap, needs no model or GPU, and each score can be explained by the words that matched",
          "Embeddings help when the same meaning is written with different words, or across languages",
          "Measure both on real queries, and consider combining them"
        ],
        weak: "Embeddings are newer, so they are better. That ignores exact-match queries, cost and explainability."
      }
    ],
    screens: [inbox, byHand, spotIdea, rank, scratch, library, sublinear, bm25, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
