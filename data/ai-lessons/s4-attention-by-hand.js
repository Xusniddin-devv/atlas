/* Lesson: attention by hand, a weighted lookup for one query. Story: a translation app reads the Korean station
   sign "부산행 열차 3번 승강장" and writes "Train to Busan, platform 3"; while writing each English word it decides
   which Korean word to look at. Ideas: (1) attention for one query = score every key (dot product), turn the scores
   into weights (softmax), blend the values with those weights; (2) because each output word gets its own fresh
   blend over all the stored word vectors, nothing has to fit into one fixed vector (the seq2seq bottleneck).
   Data: the keys, values and two queries are small hand-made vectors (below). The NumPy numbers come from
   docs/ai-path/runs/s4-attention-by-hand/attend.py and its output attend.out.txt (traced run of attend(), the
   second query, and the overflow case). No model was called for this lesson, so there are no recordings.
   Lesson-local style: small vector tables and the station sign (.lx-s4-attention-by-hand-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s4-attention-by-hand";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const dot = (a, b) => sum(a.map((x, i) => x * b[i]));
  const f2 = x => x.toFixed(2);
  const pct = x => Math.round(x * 100) + "%";
  const vec = (a, d = 2) => `[${a.map(x => Number.isInteger(x) && d === 0 ? String(x) : x.toFixed(d)).join(", ")}]`;
  const ivec = a => `[${a.join(", ")}]`;

  /* ---------- The lesson's data (the same arrays as in attend.py) ---------- */
  const SIGN = ["부산행", "열차", "3번", "승강장"];
  const GLOSS = ["bound for Busan", "train", "number 3", "platform"];
  const ENGLISH = ["Train", "to", "Busan,", "platform", "3"];
  const KEYS = [[0, 2, 0], [1, 1, 0], [0, 1, 1], [2, 0, 1]];
  const VALUES = [[4, 0], [0, 4], [2, 4], [6, 2]];
  const Q_PLATFORM = [1, 0, 2]; // decoder state while writing "platform"
  const Q_BUSAN = [0, 2, -1];   // decoder state while writing "Busan"

  // From docs/ai-path/runs/s4-attention-by-hand/attend.out.txt (Python 3.12.11, NumPy 2.5.4; see env.txt).
  // Trace of attend(query_platform, keys, values): [line just run, variables after it]. Arrays rounded to 4 places by the tracer.
  const RUN = {
    src: "docs/ai-path/runs/s4-attention-by-hand/attend.out.txt",
    steps: [
      [1, { scores: [0.0, 1.0, 2.0, 4.0] }],
      [2, { shifted: [-4.0, -3.0, -2.0, 0.0] }],
      [3, { exps: [0.0183, 0.0498, 0.1353, 1.0] }],
      [4, { weights: [0.0152, 0.0414, 0.1125, 0.831] }],
      [5, { blended: [5.2715, 2.2772] }],
      [6, { returned: [5.2715, 2.2772] }]
    ],
    bigScores: [0.0, 250.0, 500.0, 1000.0],
    naiveWeights: ["0.0", "0.0", "0.0", "nan"],
    shiftedWeights: [0.0, 0.0, 0.0, 1.0]
  };
  // The listing is attend() from attend.py, line for line (line 0 = def).
  const CODE = [
    "def attend(query, keys, values):",
    "    scores = keys @ query",
    "    shifted = scores - scores.max()",
    "    exps = np.exp(shifted)",
    "    weights = exps / exps.sum()",
    "    blended = weights @ values",
    "    return blended"
  ];

  /* ---------- Derived from the data ---------- */
  const softmax = s => { const m = Math.max(...s), e = s.map(x => Math.exp(x - m)), t = sum(e); return e.map(x => x / t); };
  const blend = w => VALUES[0].map((_, j) => sum(w.map((wi, i) => wi * VALUES[i][j])));
  const S_P = KEYS.map(k => dot(Q_PLATFORM, k));
  const EXP_P = S_P.map(Math.exp);
  const W_P = softmax(S_P);
  const B_P = blend(W_P);
  const S_B = KEYS.map(k => dot(Q_BUSAN, k));
  const W_B = softmax(S_B);
  const B_B = blend(W_B);
  const argmax = a => a.indexOf(Math.max(...a));
  const TOP_P = argmax(W_P), TOP_B = argmax(W_B);
  const PROP = S_P.map(s => s / sum(S_P)); // scores divided by their sum, the rule the learner rejects
  const MEAN = blend(KEYS.map(() => 1 / KEYS.length));
  const D = Q_PLATFORM.length;
  const SIGN_IN = SIGN.length, SIGN_OUT = ENGLISH.length;
  const BIG_IN = 400, BIG_OUT = 400;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-sign { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; }
      .lx-${ID}-w { border: 1.5px solid var(--ink); border-radius: 8px; padding: 8px 12px; min-width: 64px; text-align: center; background: var(--surface); }
      .lx-${ID}-w b { display: block; font-size: 20px; line-height: 1.3; }
      .lx-${ID}-w span { display: block; font-size: 13px; color: var(--muted); }
      .lx-${ID}-out { margin: 12px 0 0; font: 500 16px/1.5 var(--mono); }
      .lx-${ID}-out .now { border-bottom: 2px solid var(--ink); font-weight: 700; }
      .lx-${ID}-out .later { color: var(--faint); }
      .lx-${ID}-vt { border-collapse: collapse; margin: 16px 0 0; font: 500 15px var(--mono); }
      .lx-${ID}-vt caption { text-align: left; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; padding-bottom: 6px; }
      .lx-${ID}-vt th { text-align: left; font: 600 13px var(--font); color: var(--muted); padding: 4px 12px 6px 8px; border-bottom: 2px solid var(--ink); }
      .lx-${ID}-vt td { padding: 6px 12px 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
      .lx-${ID}-vt tr.on td { font-weight: 700; background: var(--surface); }
      .lx-${ID}-vt tr.on td:first-child { box-shadow: inset 3px 0 0 var(--ink); }
      .lx-${ID}-scroll { max-width: 100%; overflow-x: auto; }
      .lx-${ID}-q { margin: 14px 0 0; font: 600 16px var(--mono); }
      .lx-${ID}-blk { border-top: 1px solid var(--line); padding: 12px 0 4px; margin-top: 12px; }
      .lx-${ID}-blk p { margin: 0; font: 500 15px var(--mono); }
      .lx-${ID}-blk .lopts { gap: 8px; margin-top: 8px; }
      .lx-${ID}-blk .lopts button { min-width: 44px; padding: 10px 12px; text-align: center; font-family: var(--mono); }
    `;
    document.head.appendChild(s);
  }
  // rows: [[cells...]], on: index of the marked row
  function vt(kit, head, rows, { title = "", on = -1 } = {}) {
    return `<div class="lx-${ID}-scroll"><table class="lx-${ID}-vt">${title ? `<caption>${kit.esc(title)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === on ? ' class="on"' : ""}>${r.map(c => `<td>${kit.esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const sign = kit => `<div class="lx-${ID}-sign" aria-label="Station sign">${SIGN.map((w, i) => `<div class="lx-${ID}-w"><b lang="ko">${kit.esc(w)}</b><span>${kit.esc(GLOSS[i])}</span></div>`).join("")}</div>`;
  const outLine = (kit, at) => `<p class="lx-${ID}-out">${ENGLISH.map((w, i) => `<span class="${i === at ? "now" : i > at ? "later" : ""}">${kit.esc(w)}</span>`).join(" ")}</p>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const wordOpt = i => `${SIGN[i]} (${GLOSS[i]})`;

  /* 1. The situation: which word on the sign does "platform" need? */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const at = ENGLISH.indexOf("platform");
    const opts = SIGN.map((_, i) => kit.esc(wordOpt(i)));
    const fb = [
      [`${kit.esc(SIGN[0])} means “bound for Busan”. The app needed it two words ago, for “Busan”. It does not help with “platform”.`, false],
      [`${kit.esc(SIGN[1])} means “train”. The app used it for the first English word. “Platform” needs a different word.`, false],
      [`${kit.esc(SIGN[2])} means “number 3”. It is needed for the next English word, “3”, not for “platform”.`, false],
      [`Right. Notice the order: “3” is the last English word but ${kit.esc(SIGN[2])} sits third on the sign. The word the app needs changes from one English word to the next. And the app cannot read the English hints under the sign. It only has vectors. The rest of this lesson is how it finds ${kit.esc(SIGN[3])} with arithmetic.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Which word on the sign?</h1>
        <p class="lead">A translation app points a phone at a sign in a Korean train station and writes the English, one word at a time. The plain encoder-decoder from the last lesson would squeeze the whole sign into one fixed vector and write from that. On long signs that loses detail. This app does something else: before each English word, it looks back at the sign.</p>
        ${sign(kit)}
        ${outLine(kit, at)}
        <p class="task">The app has written “${kit.esc(ENGLISH.slice(0, at).join(" "))}” and is about to write “${kit.esc(ENGLISH[at])}”. Which word on the sign should it look at most?</p>
        <div class="lpanel">${ask(kit, opts, 3, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 3) done(); });
    };
    paint();
  }

  /* 2. By hand: the dot-product score of each key against the query. */
  function scores({ el, done, kit }) {
    ensureStyle();
    const picks = KEYS.map(() => null);
    const CHOICES = [0, 1, 2, 3, 4, 5, 6];
    const say = (i, v) => {
      const k = KEYS[i];
      const pairs = Q_PLATFORM.map((q, j) => `${q}×${k[j]}`).join(", ");
      if (v === sum(Q_PLATFORM) + sum(k)) return `You added all the numbers. A dot product multiplies first: pair the query and the key position by position (${pairs}), then add the ${D} products.`;
      if (v === sum(k)) return `${v} is the key's numbers added up. The query has to come in too: multiply position by position (${pairs}), then add the ${D} products.`;
      if (v === sum(Q_PLATFORM)) return `${v} is the query's numbers added up. The key has to come in too: multiply position by position (${pairs}), then add the ${D} products.`;
      return `${v} is not what the pairs give. Pair them position by position: ${pairs}. Multiply each pair, then add the ${D} products.`;
    };
    const paint = () => {
      const all = picks.every((p, i) => p != null && CHOICES[p] === S_P[i]);
      el.innerHTML = `<h1>Score each word</h1>
        <p class="lead">The app keeps a small vector for every word on the sign, called its <b>key</b>: what that word can be matched on. While writing “platform”, the decoder's own state is another vector, the <b>query</b>: what it is looking for right now. Real models learn these numbers; here they have ${D} numbers each so you can work by hand.</p>
        <p class="lx-${ID}-q">query = ${ivec(Q_PLATFORM)}</p>
        ${vt(kit, ["word", "key"], SIGN.map((w, i) => [w, ivec(KEYS[i])]))}
        <p class="lead">The score of a word is the dot product of the query with its key (written ·): multiply position by position, then add. A bigger score means a better match: the two vectors point more the same way (longer vectors also score higher).</p>
        <p class="task">Work out the score of each word.</p>
        <div class="lpanel">${SIGN.map((w, i) => `<div class="lx-${ID}-blk" id="k${i}"><p>${kit.esc(w)}: ${ivec(Q_PLATFORM)} · ${ivec(KEYS[i])} =</p>${kit.options(CHOICES.map(String), { picked: picks[i], correct: CHOICES.indexOf(S_P[i]) })}${picks[i] != null && CHOICES[picks[i]] !== S_P[i] ? kit.feedback(say(i, CHOICES[picks[i]]), false) : ""}</div>`).join("")}
        ${all ? kit.feedback(`Right: scores ${ivec(S_P)}. ${kit.esc(SIGN[TOP_P])} scores highest because its key points the same way as the query. ${kit.esc(SIGN[0])} scores ${S_P[0]}: its key shares nothing with what the query wants.`, true) : ""}</div>`;
      el.querySelectorAll(".lx-" + ID + "-blk").forEach((blk, i) => blk.querySelectorAll("button").forEach(b => b.onclick = () => {
        picks[i] = +b.dataset.i; paint();
        if (picks.every((p, j) => p != null && CHOICES[p] === S_P[j])) done();
      }));
    };
    paint();
  }

  /* 3. Scores into weights: the softmax, then predict how sharp it is. */
  function weights({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const sharePick = [Math.round(100 / KEYS.length), Math.round(PROP[TOP_P] * 100), Math.round(W_P[TOP_P] * 100), 100];
    const RULES = [
      "Divide each score by the sum of the scores",
      "Keep only the biggest score: it gets 1, the rest get 0",
      "Take e to the power of each score, then divide each by the sum of those",
      "Take e to the power of each score and use that"
    ];
    const fbA = [
      [`Then ${kit.esc(SIGN[0])}, with score ${S_P[0]}, gets exactly nothing. A negative score (they happen) would get a negative weight. With scores like 2 and −2 the sum is 0 and you cannot divide at all.`, false],
      ["That throws away the rest of the sign. When two words both matter, a hard pick keeps one. It also cannot be trained by small nudges: a tiny change in a score either flips the pick or changes nothing.", false],
      null,
      [`Those numbers (${EXP_P.map(f2).join(", ")}) do not add up to 1. Make the scores 10 bigger and every number grows: you get a bigger vector, not a choice of where to look.`, false]
    ];
    const fbB = [
      [`${sharePick[0]}% each would mean the scores did not matter. They do: ${kit.esc(SIGN[TOP_P])} scored ${S_P[TOP_P]} and ${kit.esc(SIGN[0])} scored ${S_P[0]}.`, false],
      [`${sharePick[1]}% is ${S_P[TOP_P]} out of ${sum(S_P)}, the score divided by the sum of scores. The exponent stretches the gaps first: e<sup>${S_P[TOP_P]}</sup> is ${f2(EXP_P[TOP_P])}, e<sup>${S_P[2]}</sup> only ${f2(EXP_P[2])}.`, false],
      null,
      [`Never quite 100%. e to any power is above 0, so every word keeps a small weight. That is what makes it a blend, not a pick.`, false]
    ];
    const paint = () => {
      const tbl = vt(kit, stage < 2 ? ["word", "score", "e^score"] : ["word", "score", "e^score", "weight"],
        SIGN.map((w, i) => stage < 2 ? [w, String(S_P[i]), f2(EXP_P[i])] : [w, String(S_P[i]), f2(EXP_P[i]), f2(W_P[i])]), { on: stage === 2 ? TOP_P : -1 });
      el.innerHTML = `<h1>Scores into weights</h1>
        <p class="lead">Scores say “more” or “less”. The app needs <b>weights</b>: how much of each word to take, all positive, adding up to 1. The table also shows e<sup>score</sup>: e is a fixed number, about 2.718, raised to the power of the score.</p>
        ${tbl}
        ${stage === 0 ? `<p class="task">Which rule turns the scores into weights a model can use?</p><div class="lpanel">${ask(kit, RULES.map(kit.esc), 2, ans, fbA)}</div>` : ""}
        ${stage === 1 ? `${kit.feedback(`Right. That rule is called <b>softmax</b>: every weight is above 0, they add up to 1, and a small change in a score changes the weights a little, which is what training needs.`, true)}
          <p class="task">Before you divide: roughly what share of the weight goes to ${kit.esc(SIGN[TOP_P])}?</p><div class="lpanel">${ask(kit, sharePick.map(p => p + "%"), 2, ans, fbB)}</div>` : ""}
        ${stage === 2 ? `<div class="lpanel">${kit.feedback(`Right: ${f2(EXP_P[TOP_P])} out of a total of ${f2(sum(EXP_P))} is ${f2(W_P[TOP_P])}, about ${pct(W_P[TOP_P])}. The weights add up to ${f2(sum(W_P))}. Its score was only ${S_P[TOP_P] - S_P[2]} more than the runner-up, yet it takes about ${Math.round(W_P[TOP_P] / W_P[2])} times as much weight. Softmax sharpens gaps.`, true)}</div>` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === 2) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 4. The blend: weights times values. */
  function blendScreen({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const cands = [blend(PROP), MEAN, B_P, VALUES[TOP_P]];
    const RIGHT = 2;
    const fb = [
      [`That blend uses the weights ${PROP.map(f2).join(", ")}: scores divided by their sum, the rule you turned down. Use the softmax weights from the table.`, false],
      [`That is the plain average: every word counts ${f2(1 / KEYS.length)}. It ignores the weights, so ${kit.esc(SIGN[0])} counts as much as ${kit.esc(SIGN[TOP_P])}.`, false],
      [`Right: ${SIGN.map((w, i) => `${f2(W_P[i])}×${ivec(VALUES[i])}`).join(" + ")} = ${vec(B_P)}. This vector is what the decoder gets for writing “platform”. It is mostly ${kit.esc(SIGN[TOP_P])}'s value with a little of the others. The whole move (score the keys, softmax, blend the values) is <b>attention</b>, and the blend is often called the <b>context vector</b>.`, true],
      [`That is ${kit.esc(SIGN[TOP_P])}'s value alone, as if its weight were 1. It is ${f2(W_P[TOP_P])}; the other ${f2(1 - W_P[TOP_P])} still comes from the other words.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Blend the values</h1>
        <p class="lead">Each word also has a <b>value</b>: what it hands over when it is looked at. The key decides how much weight a word gets. The value is what the decoder receives. The result is the weighted sum: each value times its weight, added up.</p>
        ${vt(kit, ["word", "weight", "value"], SIGN.map((w, i) => [w, f2(W_P[i]), ivec(VALUES[i])]), { on: TOP_P })}
        <p class="task">What vector does the decoder get while writing “platform”?</p>
        <div class="lpanel">${ask(kit, cands.map(c => kit.esc(vec(c))), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Use it: a new query, same sign. Predict where it looks. */
  function newQuery({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const at = ENGLISH.indexOf("Busan,");
    const fb = SIGN.map((w, i) => i === TOP_B
      ? [`Right. The sign's keys and values did not change; only the query did, so the weights moved.${vt(kit, ["word", "score", "weight for “Busan”", "weight for “platform”"], SIGN.map((x, j) => [x, String(S_B[j]), f2(W_B[j]), f2(W_P[j])]), { on: TOP_B })}
        The blend for “Busan” is ${vec(B_B)}; for “platform” it was ${vec(B_P)}. Same stored sign, two different vectors, one per English word.`, true]
      : [`${kit.esc(w)}'s score is ${ivec(Q_BUSAN)} · ${ivec(KEYS[i])} = ${S_B[i]}. Check the others: one is higher.`, false]);
    const paint = () => {
      el.innerHTML = `<h1>A new word, a new query</h1>
        <p class="lead">Go back two words: the app is about to write “Busan”. The decoder's state is different now, so the query is different.</p>
        ${outLine(kit, at)}
        <p class="lx-${ID}-q">query = ${ivec(Q_BUSAN)}</p>
        ${vt(kit, ["word", "key"], SIGN.map((w, i) => [w, ivec(KEYS[i])]))}
        <p class="task">Which word gets the largest weight now? Score them in your head.</p>
        <div class="lpanel">${ask(kit, SIGN.map((_, i) => kit.esc(wordOpt(i))), TOP_B, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === TOP_B) done(); });
    };
    paint();
  }

  /* 6. Spot the idea: why this removes the one-vector bottleneck. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The blended vector is bigger than the old fixed vector, so more fits in it",
      "Each output word computes its own blend over the vectors of all input words, so no single vector has to hold the whole input",
      "Attention reads the input in order, one input word for each output word",
      "The weights pick exactly one input word, so nothing gets mixed up"
    ];
    const fb = [
      [`It is not bigger: the blend has ${B_P.length} numbers, the same as one value. A long sign gives more values to blend, not a longer blend.`, false],
      [`Right. The old decoder got one vector, made once, for the whole input. Here the app keeps a vector for every word and builds a fresh blend for every output word, aimed by that word's query. A longer sign means more keys and values to look through, not more squeezing. The 2014 paper that introduced this for translation named the fixed-length vector a bottleneck and reported no drop in quality even on sentences of 50 words or more. That paper scored each input word with a small neural network; the dot-product score you used was proposed a year later (Luong and others, 2015).`, true],
      [`“Platform” looked at the 4th word, “3” needs the 3rd, and nothing stops a query from looking at any word. The weights come from scores, not from positions.`, false],
      [`They did not: ${kit.esc(SIGN[TOP_P])} got ${f2(W_P[TOP_P])}, not 1. Softmax never gives exactly 0 or 1. It is a blend that leans hard on one word.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why the long sign is fine now</h1>
        <p class="lead">In the last lesson, a museum audio guide garbled long questions: its decoder wrote every word from one fixed vector. This app is built differently.</p>
        <p class="task">Why does a long sign not garble this app's translation the same way?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. The same thing in NumPy: a stepped replay of the real run, then the shift question. */
  const FR = RUN.steps;
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const said = {
      1: v => `<code>keys @ query</code> takes the dot product of the query with all ${KEYS.length} keys at once: ${ivec(v.scores.map(x => x.toFixed(1)))}. ${v.scores.every((x, j) => x === S_P[j]) ? "The same scores you worked out." : ""}`,
      2: v => `Subtract the largest score from every score: ${ivec(v.shifted.map(x => x.toFixed(1)))}. The top word is now at 0, the rest below.`,
      3: v => `<code>np.exp</code> of each: ${ivec(v.exps)}. The top word gets e<sup>0</sup> = 1.`,
      4: v => `Divide by the sum: ${ivec(v.weights)}. Rounded to 2 places, these are the weights from the table on screen 3: ${ivec(W_P.map(f2))}.`,
      5: v => `<code>weights @ values</code> is the weighted sum: ${ivec(v.blended)}. Your hand answer was ${vec(B_P)}.`,
      6: v => `<code>attend</code> returns ${ivec(v.returned)}: the context vector for “platform”.`
    };
    const opts = [
      "No. Dividing by the sum cancels the shift; it only keeps np.exp from overflowing",
      "Yes. The top word's weight becomes 0",
      "Yes. The other weights become negative"
    ];
    const fb = [
      [`Right. Subtracting the same number from every score divides every e<sup>score</sup> by the same amount, and the division by the sum cancels it. It matters when scores are large. The run scaled the scores 250 times: ${ivec(RUN.bigScores.map(x => x.toFixed(1)))}. Without the shift, <code>np.exp(1000.0)</code> is too big to store, so it overflows to <code>inf</code> (infinity), and the weights came out as ${ivec(RUN.naiveWeights)}, with a <code>RuntimeWarning</code>. With the shift: ${ivec(RUN.shiftedWeights.map(x => x.toFixed(1)))}. Notice that too: scores this far apart turn the blend into a hard pick. The next lessons come back to that.`, true],
      [`The top word's <i>shifted score</i> becomes 0, and e<sup>0</sup> = 1, the largest of the four. Its weight in step 4 is ${f2(W_P[TOP_P])}, the same as before.`, false],
      [`The shifted scores are negative, but e to a negative power is still above 0 (step 3 shows ${ivec(FR[2][1].exps)}). Weights stay positive.`, false]
    ];
    const vars = () => {
      const seen = Object.assign({}, ...FR.slice(0, i + 1).map(f => f[1]));
      return ["scores", "weights", "blended"].filter(k => seen[k]).map(k => `<span>${k} <b>${kit.esc(ivec(seen[k]))}</b></span>`).join("");
    };
    const check = () => { if (i === FR.length - 1 && ans === 0) done(); };
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The same thing in NumPy</h1>
        <p class="lead">This is the whole of attention for one query. It replays a real run on the sign's numbers; each step shows the line that just ran.</p>
        <p class="task">Step through to the end, then answer the question below.</p>
        ${kit.code(CODE, f[0])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${vars()}<span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(said[f[0]](f[1]))}
        <p class="task">The line <code>shifted = scores - scores.max()</code> subtracts the largest score before <code>np.exp</code>. Does that change the weights?</p>
        <div class="lpanel">${ask(kit, opts.map(kit.esc), 0, ans, fb)}</div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); check(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); check(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const small = SIGN_IN * SIGN_OUT, big = BIG_IN * BIG_OUT;
    const opts = ["The size of the blended vector", "How many key and value vectors the app stores", "How many scores it computes"];
    const RIGHT = 2;
    const fb = [
      [`It stays ${B_P.length} numbers, the size of one value, however long the input is.`, false],
      [`That grows with the input only: from ${SIGN_IN} to ${BIG_IN}, ${Math.round(BIG_IN / SIGN_IN)} times more. Something else grows faster.`, false],
      [`Right. Every output word scores every input word. The sign needed ${SIGN_IN} × ${SIGN_OUT} = ${small} scores; the timetable needs ${BIG_IN} × ${BIG_OUT} = ${big.toLocaleString("en")}, about ${(big / small).toLocaleString("en")} times more, while the input grew only ${Math.round(BIG_IN / SIGN_IN)} times. That product is the cost to watch.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for attention</h1>
        <p class="lead"><b>For:</b> tasks where each piece of output needs a different part of a long input: translation, summaries, answers from a document, image captions.</p>
        <p class="lead"><b>Reach for it</b> when squeezing the input into one vector loses detail.</p>
        <p class="lead"><b>Not</b> when there is only one input item (there is nothing to weigh), or when you need one exact record: a dictionary or a database index finds it, while attention always blends.</p>
        <p class="lead"><b>Costs:</b> you keep a vector for every input word instead of one, and every output word scores every input word, so the work grows with input length times output length.</p>
        <p class="task">The app moves from ${SIGN_IN}-word signs (${SIGN_OUT} English words out) to ${BIG_IN}-word timetables translated into about ${BIG_OUT} English words. Which grows fastest?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where attention is the wrong tool. */
  const CASES = [
    ["A tool turns a long hotel review into one sentence. The words “noisy room” should come from the paragraph about the room, “great breakfast” from the one about food.", true,
      "Yes. Each output word needs a different part of a long input. Keep a vector per input word and let each output word's query weigh them.",
      "Each summary word draws on a different paragraph. One fixed vector for the whole review loses that; a fresh weighted blend per output word keeps it."],
    ["Predict tomorrow's power use for one building from a single row of three numbers: today's temperature, the weekday, a holiday flag.", false,
      "No. One row goes in and one number comes out: a single output step, so there is never a second query that would look somewhere else. Even if you call the three numbers three items, each always means the same thing in the same place, so one fixed weight per number (a plain regression model) already does the job.",
      "Attention earns its cost when what to look at changes from one output step to the next. Here there is one output, and three numbers that always mean the same thing, so a fixed weight per number is enough. Use a plain model on the three numbers."],
    ["Find a passenger's seat from a booking code, in a table of 10,000 bookings.", false,
      "No. You need one exact row. Attention returns a blend in which every row keeps a weight above 0, so other passengers' seats leak in. A dictionary or a database index returns the row exactly.",
      "Softmax never gives a weight of exactly 0 or 1, so the answer would be a mix of rows. An exact match is a job for a dictionary or an index."],
    ["Write a caption for a photo, word by word. The photo is stored as a grid of small region vectors.", true,
      "Yes. The input is many vectors (regions), and each caption word needs different ones: “dog” the region with the dog, “beach” the sand. A query per word weighs the regions.",
      "The input does not have to be words. Many region vectors plus an output that needs different regions at each word is exactly the shape attention fits."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Attention or not?</h1>
        <p class="lead">Four jobs from other teams. Attention here means: keep a vector per input item, and for each output step, score them against a query, softmax, and blend.</p>
        <p class="task">Would you use attention for each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can compute attention</h1>
      <p class="lead">You scored ${KEYS.length} keys against a query, turned the scores into softmax weights, blended the values, and saw that a new query gives a new blend over the same stored words. That per-word blend is what removes the one-vector bottleneck. Skip it when there is one input item or you need one exact record, and mind the cost: every output word scores every input word.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise follows on this page. You write <code>attend(query, keys, values)</code> in NumPy yourself, with the shift that keeps <code>np.exp</code> from overflowing.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Here the query came from the decoder and the keys from the sign; next, every word of one sentence makes its own query and attends to the others, all at once.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Attention by hand: weighted lookups",
    checked: "2026-11-14",
    sources: [
      "https://arxiv.org/abs/1409.0473",
      "https://arxiv.org/abs/1508.04025",
      "https://arxiv.org/abs/1706.03762",
      "https://numpy.org/doc/stable/reference/generated/numpy.matmul.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.exp.html"
    ],
    interview: [
      {
        q: "Your encoder-decoder translator is good on short sentences and poor on long ones. A teammate wants to double the hidden size. What do you suggest instead, and why?",
        good: [
          "The decoder writes everything from one fixed-size vector, and a long sentence does not fit in it: that is the bottleneck",
          "Keep the encoder's vector for every input word and add attention: for each output word, score every input vector against the decoder state",
          "Softmax the scores into weights and give the decoder the weighted sum, a fresh context vector per output word",
          "The cost: you store a vector per input word, and the scoring work grows with input length times output length",
          "Check it by plotting quality against input length before and after"
        ],
        weak: "Make the hidden vector bigger or add layers. It is still one fixed vector for the whole input, so long inputs still get squeezed."
      },
      {
        q: "A teammate's NumPy attention gives sensible weights on short test inputs but returns nan on some real documents. Walk me through the computation and say where you would look first.",
        good: [
          "Scores: the dot product of the query with each key, keys @ query",
          "Weights: softmax, exponentiate and divide by the sum, so they are positive and add up to 1",
          "Output: the weighted sum of the values, weights @ values",
          "Subtract the largest score before exp: the weights do not change, but large scores no longer overflow to inf and nan",
          "Very large score gaps make softmax nearly a hard pick of one item"
        ],
        weak: "It finds the most relevant word and returns it. That misses that the weights are a softmax and the output is a blend of all values."
      }
    ],
    screens: [situation, scores, weights, blendScreen, newQuery, spotIdea, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#k0 [data-wrong]"], right: SIGN.map((_, i) => `#k${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: [...Array(FR.length - 1).fill("[data-next]"), "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
