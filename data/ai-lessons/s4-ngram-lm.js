/* Lesson: n-gram language models and perplexity. Story: a phone keyboard for a regional radio station suggests
   the next word while presenters type weather bulletins.
   Ideas: (1) a bigram model predicts the next word from counts of word pairs, P(next | previous) =
   count(previous, next) / count(previous), and a sentence's probability is the product of its pairs; one unseen
   pair makes it 0, so the counts are smoothed (add-one, add-k); (2) perplexity scores a model on held-out text:
   the lower, the better, and it only means something when probabilities add up to 1 and the text was not counted.
   Data, all real, from plain Python runs on this Mac (no model API calls):
   - docs/ai-path/runs/s4-ngram-lm/bigram.py + bigram.out.txt: the 15 training bulletins, 4 held-out bulletins,
     pair counts, sentence probabilities, held-out perplexities, samples (random.Random(0));
   - docs/ai-path/runs/s4-ngram-lm/trace_perplexity.py + .out.txt: the 9-line perplexity() traced line by line on
     one held-out bulletin;
   - docs/ai-path/runs/s4-ngram-lm/broken.py + broken.out.txt: a smoothing bug (no "+ V" in the denominator) and
     the check that exposes it.
   Lesson-local style: a small multi-column table and a counter row (.lx-s4-ngram-lm-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s4-ngram-lm";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const f3 = x => x.toFixed(3);
  const f2 = x => x.toFixed(2);
  const pct = x => `${Math.round(x * 100)}%`;

  /* ---------- Data copied from the runs ---------- */
  // bigram.py BULLETINS and HELD_OUT
  const BULLETINS = [
    "heavy rain this morning", "light rain in the north", "heavy rain in the south tonight", "snow on the hills tonight",
    "heavy snow on the hills", "fog in the valleys this morning", "heavy fog on the coast road", "sunny in the south this afternoon",
    "heavy rain on the coast tonight", "light snow in the north tonight", "strong wind on the coast", "sunny spells in the north this afternoon",
    "heavy snow in the valleys tonight", "strong wind and heavy rain tonight", "light wind in the south this morning"
  ];
  const HELD_OUT = ["heavy wind on the hills tonight", "light rain on the coast this morning", "sunny spells in the south", "strong wind in the valleys tonight"];
  // bigram.out.txt
  const V = 24;                                   // tag "V": the words that can come next, </s> included
  const AFTER_HEAVY = { fog: 1, rain: 4, snow: 2 }; // tag "after_heavy"
  const COUNT_HEAVY = 7;                          // tag "count_heavy"
  // tag "sentence_prob" (model "count"), steps [prev, word, count of pair, count of prev]
  const WIND_STEPS = [["<s>", "heavy", 6, 15], ["heavy", "wind", 0, 7], ["wind", "on", 1, 3], ["on", "the", 5, 5], ["the", "hills", 2, 13], ["hills", "tonight", 1, 2], ["tonight", "</s>", 6, 6]];
  const RAIN_STEPS = [["<s>", "heavy", 6, 15], ["heavy", "rain", 4, 7], ["rain", "on", 1, 5], ["on", "the", 5, 5], ["the", "hills", 2, 13], ["hills", "tonight", 1, 2], ["tonight", "</s>", 6, 6]];
  // tag "perplexity_held_out" and "perplexity_train_add_k_0.1" (bigram_count was "inf (a probability is 0)")
  const PPL = { unigram: 19.111474142642596, addOne: 9.824222750632009, addK: 4.600093223006712 };
  const PPL_TRAIN_ADDK = 3.332639276469852;
  const N_HELD_TOKENS = 28;                        // tag "n_tokens_held_out"
  const K = 0.1;
  // tags "samples_count", "samples_add_one", "samples_add_k_0.1" (each sampler starts from random.Random(0))
  const SAMPLES_COUNT = ["strong wind in the north tonight", "heavy rain on the north this morning", "heavy snow on the valleys this morning", "snow in the north tonight", "sunny in the hills"];
  const SAMPLES_ADD1 = ["sunny sunny north in strong on the in spells snow valleys snow", "heavy strong strong in valleys", "sunny valleys morning this valleys sunny rain coast rain south valleys", "morning", "heavy sunny snow afternoon the north tonight tonight afternoon road valleys in"];
  const SAMPLES_ADDK = ["strong wind in the north this morning strong tonight", "sunny road north tonight", "heavy spells", "strong wind in the valleys tonight", "heavy rain spells valleys wind in the hills"];
  // broken.out.txt
  const BROKEN = { ppl: "1.7", pplRight: "9.82", sums: [["heavy", "4.43"], ["the", "2.85"], ["tonight", "5.00"]] };

  // The listing is perplexity() from docs/ai-path/runs/s4-ngram-lm/trace_perplexity.py, line for line (line 0 = def).
  const CODE = [
    "def perplexity(sentences):",
    "    total_log, n_tokens = 0.0, 0",
    "    for sentence in sentences:",
    "        words = [\"<s>\"] + sentence.split() + [\"</s>\"]",
    "        for prev, word in zip(words, words[1:]):",
    "            p = (pair_counts[(prev, word)] + 1) / (prev_counts[prev] + V)",
    "            total_log += math.log(p)",
    "            n_tokens += 1",
    "    return math.exp(-total_log / n_tokens)"
  ];
  // trace_perplexity.out.txt: [line about to run, event (l/r), prev, word, p, total_log, n_tokens]; result 9.641321047933594
  const TRACE = [[1,"l",null,null,null,null,null],[2,"l",null,null,null,0,0],[3,"l",null,null,null,0,0],[4,"l",null,null,null,0,0],[5,"l","<s>","heavy",null,0,0],[6,"l","<s>","heavy",0.1794871794871795,0,0],[7,"l","<s>","heavy",0.1794871794871795,-1.717651497074333,0],[4,"l","<s>","heavy",0.1794871794871795,-1.717651497074333,1],[5,"l","heavy","wind",0.1794871794871795,-1.717651497074333,1],[6,"l","heavy","wind",0.03225806451612903,-1.717651497074333,1],[7,"l","heavy","wind",0.03225806451612903,-5.151638701559479,1],[4,"l","heavy","wind",0.03225806451612903,-5.151638701559479,2],[5,"l","wind","on",0.03225806451612903,-5.151638701559479,2],[6,"l","wind","on",0.07407407407407407,-5.151638701559479,2],[7,"l","wind","on",0.07407407407407407,-7.754328387003863,2],[4,"l","wind","on",0.07407407407407407,-7.754328387003863,3],[5,"l","on","the",0.07407407407407407,-7.754328387003863,3],[6,"l","on","the",0.20689655172413793,-7.754328387003863,3],[7,"l","on","the",0.20689655172413793,-9.329864747762281,3],[4,"l","on","the",0.20689655172413793,-9.329864747762281,4],[5,"l","the","hills",0.20689655172413793,-9.329864747762281,4],[6,"l","the","hills",0.08108108108108109,-9.329864747762281,4],[7,"l","the","hills",0.08108108108108109,-11.842170371738396,4],[4,"l","the","hills",0.08108108108108109,-11.842170371738396,5],[5,"l","hills","tonight",0.08108108108108109,-11.842170371738396,5],[6,"l","hills","tonight",0.07692307692307693,-11.842170371738396,5],[7,"l","hills","tonight",0.07692307692307693,-14.407119729199932,5],[4,"l","hills","tonight",0.07692307692307693,-14.407119729199932,6],[5,"l","tonight","</s>",0.07692307692307693,-14.407119729199932,6],[6,"l","tonight","</s>",0.23333333333333334,-14.407119729199932,6],[7,"l","tonight","</s>",0.23333333333333334,-15.862406961806775,6],[4,"l","tonight","</s>",0.23333333333333334,-15.862406961806775,7],[2,"l","tonight","</s>",0.23333333333333334,-15.862406961806775,7],[8,"l","tonight","</s>",0.23333333333333334,-15.862406961806775,7],[8,"r","tonight","</s>",0.23333333333333334,-15.862406961806775,7]];
  const TRACE_RESULT = 9.641321047933594;

  /* ---------- Derived from the data ---------- */
  const N_WORDS = V - 1; // distinct words; the 24th next token is </s>
  const pCount = st => st[2] / st[3];
  const pAdd1 = st => (st[2] + 1) / (st[3] + V);
  const pAddK = (c, n) => (c + K) / (n + K * V);
  const product = a => a.reduce((x, y) => x * y, 1);
  const SEEN_AFTER_HEAVY = Object.keys(AFTER_HEAVY).length;
  const UNSEEN_MASS = (V - SEEN_AFTER_HEAVY) / (COUNT_HEAVY + V); // add-one: each unseen next word gets 1/(c+V)
  const RAIN = AFTER_HEAVY.rain, SNOW = AFTER_HEAVY.snow, FOG = AFTER_HEAVY.fog;
  const PAIRS = (() => { const s = new Set(); BULLETINS.forEach(b => { const w = ["<s>", ...b.split(" "), "</s>"]; for (let i = 1; i < w.length; i++) s.add(w[i - 1] + " " + w[i]); }); return s; })();
  const pairsOf = s => { const w = ["<s>", ...s.split(" "), "</s>"]; return w.slice(1).map((x, i) => [w[i], x]); };
  const unseenIn = s => pairsOf(s).filter(([a, b]) => !PAIRS.has(a + " " + b));
  const expo = x => { const e = Math.floor(Math.log10(x)); return `${(x / 10 ** e).toFixed(1)} × 10<sup>${e}</sup>`; };
  const FRAC = (a, b) => `${a}/${b}`;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-list { margin: 14px 0 0; padding: 0 0 0 2.2em; font: 500 15px/1.55 var(--mono); color: var(--ink); }
      .lx-${ID}-list li { padding: 2px 0; }
      .lx-${ID}-list b { font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
      .lx-${ID}-grid { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .lx-${ID}-grid caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .lx-${ID}-grid th { text-align: left; font: 600 12.5px/1.3 var(--font); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; padding: 6px 6px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-grid td { padding: 7px 6px; border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 14px; color: var(--ink); overflow-wrap: anywhere; }
      .lx-${ID}-grid tr.lx-${ID}-hit td { box-shadow: inset 0 -2px 0 var(--ink); font-weight: 700; }
      .lx-${ID}-grid tr.lx-${ID}-on td { font-weight: 700; }
      .lx-${ID}-ctr { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin: 14px 0 0; }
      .lx-${ID}-ctr > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid var(--line); grid-column: 1 / -1; }
      .lx-${ID}-ctr code { font: 600 15px var(--mono); }
      .lx-${ID}-ctr .lx-${ID}-n { display: flex; align-items: center; gap: 8px; }
      .lx-${ID}-ctr .lx-${ID}-n b { min-width: 1.6em; text-align: center; font: 700 17px var(--mono); }
      .lx-${ID}-ctr .btn { min-width: 44px; min-height: 44px; padding: 0 12px; }
      .lx-${ID}-check { margin: 14px 0 0; min-height: 44px; }
      .lx-${ID}-samp { margin: 10px 0 0; padding: 0; list-style: none; }
      .lx-${ID}-samp li { padding: 6px 0; border-bottom: 1px solid var(--line); font: 500 14.5px/1.45 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-mono { font: 500 14px/1.5 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-wrap { overflow-x: visible; }
      .lx-${ID}-wrap div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + var(--ind)); text-indent: -4ch; }
      @media (max-width: 700px) { .lx-${ID}-wrap div { padding-left: calc(12px + var(--ind)); } }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
    `;
    document.head.appendChild(s);
  }
  // A small table with any number of columns. rows: [[cells], cls?]
  function grid(kit, head, rows, title) {
    return `<table class="lx-${ID}-grid">${title ? `<caption>${kit.esc(title)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(([cells, c]) => `<tr${c ? ` class="lx-${ID}-${c}"` : ""}>${cells.map(x => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  // kit.code, but long lines wrap at phone width with a hanging indent instead of scrolling out of sight.
  const codeW = (kit, lines, active) => `<pre class="lcode lx-${ID}-wrap">${lines.map((c, j) => { const t = c.trimStart(); return `<div${j === active ? ' class="on"' : ""} style="--ind:${c.length - t.length + 4}ch">${kit.esc(t) || " "}</div>`; }).join("")}</pre>`;
  const mono = (kit, s) => `<span class="lx-${ID}-mono">${kit.esc(s)}</span>`;
  const tok = (kit, s) => `<code>${kit.esc(s)}</code>`;
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }
  const wire = (el, fn) => el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => fn(+b.dataset.i));

  /* 1. The situation, and counting by hand what follows "heavy". */
  function countByHand({ el, done, kit }) {
    ensureStyle();
    const WORDS = ["rain", "snow", "fog", "wind"];
    const truth = w => AFTER_HEAVY[w] || 0;
    const n = { rain: 0, snow: 0, fog: 0, wind: 0 };
    let verdict = null; // null, "ok", or the feedback html
    const hl = s => kit.esc(s).replace(/\bheavy\b/g, "<b>heavy</b>");
    const feedbackFor = () => {
      const off = WORDS.filter(w => n[w] !== truth(w));
      if (!off.length) return null;
      const say = off.map(w => {
        if (w === "wind" && n.wind > 0) return "<b>wind</b>: it never comes right after <i>heavy</i>. In “strong wind and heavy rain tonight”, wind comes before heavy, and the word right after heavy is rain.";
        if (n[w] < truth(w)) return `<b>${w}</b>: you have ${n[w]}, that is too few. Look for <i>heavy</i> in the middle of a bulletin too, not only at the start.`;
        return `<b>${w}</b>: you have ${n[w]}, that is too many. Count only the word that comes straight after <i>heavy</i>.`;
      });
      return say.join("<br>");
    };
    const paint = () => {
      el.innerHTML = `<h1>The keyboard that guesses the next word</h1>
        <p class="lead">A regional radio station reads a weather bulletin every hour. Its presenters type them on a phone, and the station wants the phone's keyboard to suggest the next word. Guessing the next word from the words before it is the job of every language model, the large ones behind chat assistants included. This lesson builds the simplest one, from plain counts. The only data is old bulletins. Here are fifteen:</p>
        <ol class="lx-${ID}-list">${BULLETINS.map(b => `<li>${hl(b)}</li>`).join("")}</ol>
        <p class="task">A presenter has just typed <i>heavy</i>. Count how often each word comes straight after <i>heavy</i> in these bulletins, then check.</p>
        <div class="lx-${ID}-ctr">${WORDS.map(w => `<div><code>heavy ${w}</code><span class="lx-${ID}-n"><button type="button" class="btn" data-minus="${w}" aria-label="one less ${w}">−</button><b>${n[w]}</b><button type="button" class="btn" data-plus="${w}" aria-label="one more ${w}">+</button></span></div>`).join("")}</div>
        <button type="button" class="btn primary lx-${ID}-check" data-check>Check my counts</button>
        <div class="lpanel">${verdict == null ? "" : verdict === "ok"
          ? kit.feedback(`Right: rain ${RAIN}, snow ${SNOW}, fog ${FOG}, wind 0. <i>heavy</i> appears ${COUNT_HEAVY} times, and every time one of these three words follows. You just built the first row of a <b>word-pair count table</b>: for every word, how often each other word comes straight after it.`, true)
          : kit.feedback(verdict, false)}</div>`;
      el.querySelectorAll("[data-plus]").forEach(b => b.onclick = () => { n[b.dataset.plus]++; verdict = null; paint(); });
      el.querySelectorAll("[data-minus]").forEach(b => b.onclick = () => { n[b.dataset.minus] = Math.max(0, n[b.dataset.minus] - 1); verdict = null; paint(); });
      el.querySelector("[data-check]").onclick = () => { const f = feedbackFor(); verdict = f || "ok"; paint(); if (!f) done(); };
    };
    paint();
  }

  /* 2. From counts to a probability: the bigram model. */
  function toProbability({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [FRAC(RAIN, BULLETINS.length), FRAC(RAIN, COUNT_HEAVY), FRAC(RAIN, V), "1/3"];
    const RIGHT = 1;
    const fb = [
      [`${BULLETINS.length} is the number of bulletins, but only ${COUNT_HEAVY} times was there a <i>heavy</i> to follow. The question is “after heavy”, so divide by how often heavy appeared.`, false],
      [`Right. Out of ${COUNT_HEAVY} times <i>heavy</i> was typed, rain came next ${RAIN} times: ${FRAC(RAIN, COUNT_HEAVY)}, about ${f2(RAIN / COUNT_HEAVY)}. The keyboard suggests <b>rain</b> first, then snow (${FRAC(SNOW, COUNT_HEAVY)}), then fog (${FRAC(FOG, COUNT_HEAVY)}).<br><br>That is a <b>bigram model</b> (a bigram is a pair of words in a row): P(next | previous) = count(previous, next) / count(previous). Read P(next | previous) as “the probability of next, given previous”. It looks only at the one word before. Assuming that one word is enough is called the <b>Markov assumption</b>. A model that guesses the next word from what came before is a <b>language model</b>.`, true],
      [`${V} is the number of different words that can follow (${N_WORDS} words plus the end of a bulletin). Dividing by it treats the vocabulary as the number of chances. The chances were the ${COUNT_HEAVY} times heavy appeared.`, false],
      [`That treats the three words as equally likely. The counts say otherwise: after heavy, rain came ${RAIN} times, snow ${SNOW} and fog ${FOG}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>From counts to a suggestion</h1>
        <p class="lead">Your counts after <i>heavy</i>:</p>
        ${kit.table([["heavy rain", String(RAIN)], ["heavy snow", String(SNOW)], ["heavy fog", String(FOG)], ["any other pair", "0"]], { head: ["pair", "count"] })}
        <p class="task">What probability should the keyboard give <i>rain</i> right after <i>heavy</i>?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: one unseen pair makes the whole sentence impossible. */
  function unseenPair({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Small, but above 0: every word in it appears in the old bulletins",
      "Exactly 0",
      `About the same as “${RAIN_STEPS.slice(1).map(s => s[0]).join(" ")}”`,
      "Above 0: the model gives a bulletin it has never seen a small default share"
    ];
    const RIGHT = 1;
    const pW = WIND_STEPS.map(pCount), pR = RAIN_STEPS.map(pCount);
    const fb = [
      ["Every word is known, true. But the model does not score words, it scores pairs. Look down the pair column: one pair was never counted.", false],
      null,
      [`The two bulletins differ in one pair. <i>heavy rain</i> was counted ${RAIN} times, <i>heavy wind</i> never. That one pair decides it.`, false],
      ["The model never scores a whole bulletin from memory. It multiplies the probabilities of the pairs in it, and those come from the counts in the table.", false]
    ];
    const paint = () => {
      const show = ans === RIGHT;
      el.innerHTML = `<h1>A bulletin the counts never saw</h1>
        <p class="lead">A language model also scores a whole sentence. Mark its start with ${tok(kit, "<s>")} and its end with ${tok(kit, "</s>")}, so that “which word starts a bulletin” and “where it ends” are pairs too. Then the sentence's probability is the probability of each pair, multiplied together. A new bulletin, not one of the fifteen:</p>
        <p class="lead">${mono(kit, "heavy wind on the hills tonight")}</p>
        ${grid(kit, ["pair", "count of pair", "count of first word", ...(show ? ["probability"] : [])],
          WIND_STEPS.map((s, i) => [[kit.esc(s[0] + " " + s[1]), s[2], s[3], ...(show ? [f3(pW[i])] : [])], show && s[2] === 0 ? "hit" : null]))}
        <p class="task">What probability does the counting model give this bulletin?</p>
        <div class="lpanel">${ans === RIGHT
          ? `${kit.options(opts, { picked: ans, correct: RIGHT })}${kit.feedback(`Right. <i>heavy wind</i> was never counted, so its probability is 0/${COUNT_HEAVY} = 0, and anything multiplied by 0 is 0. The model calls a perfectly normal bulletin <b>impossible</b>, and the keyboard would never offer <i>wind</i> after <i>heavy</i>. Change that one pair to <i>heavy rain</i> and the product is ${f3(product(pR))}.<br><br>Fifteen bulletins cannot contain every pair that will ever be typed. The fix is to never let a pair have probability exactly 0.`, true)}`
          : ask(kit, opts, RIGHT, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Smoothing, with predictions: add-one, then add-k. */
  function smoothing({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const c = COUNT_HEAVY;
    const Q = [
      { q: `With add-one, what probability does <i>wind</i> get after <i>heavy</i>?`, right: 1,
        opts: [FRAC(1, c), FRAC(1, c + V), FRAC(1, V), FRAC(1, c + 1)],
        fb: [[`You added 1 on top but kept the bottom at ${c}. Then every one of the ${V} next words gets at least 1/${c}, and the probabilities after heavy add up to more than 1. Each of the ${V} counts grew by 1, so the total grew by ${V}.`, false], null,
          [`That ignores the counts entirely: it is what a model that knows nothing would give. Add-one keeps the ${c} real counts and adds ${V} pretend ones.`, false],
          [`Only one count went up? Add-one adds 1 to <b>every</b> possible next word, all ${V} of them, so the total goes up by ${V}, not by 1.`, false]] },
      { q: `And <i>rain</i>, which had ${FRAC(RAIN, c)} ≈ ${f2(RAIN / c)}?`, right: 2,
        opts: [`${FRAC(RAIN, c)}, unchanged`, `${FRAC(RAIN + 1, c + 1)}, a little higher`, `${FRAC(RAIN + 1, c + V)} ≈ ${f2((RAIN + 1) / (c + V))}`],
        fb: [["The bottom of every fraction after heavy changed, because the pretend counts were added to all of them. Rain's share must shrink to make room for the words that had 0.", false],
          [`Rain got 1 extra, but so did the other ${V - 1} words. The total is ${c + V}, not ${c + 1}.`, false], null] }
    ];
    const W = ["rain", "snow", "fog", "wind"];
    const result = () => grid(kit, ["after heavy", "counts", "add-one", `add-k, k = ${K}`],
      W.map(w => { const n0 = AFTER_HEAVY[w] || 0; return [[w, f3(n0 / c), f3((n0 + 1) / (c + V)), f3(pAddK(n0, c))], w === "wind" ? "on" : null]; }));
    const paint = () => {
      const q = Q[stage];
      el.innerHTML = `<h1>Never exactly zero</h1>
        <p class="lead"><b>Add-one smoothing</b> pretends every pair was seen one more time than it was: P = (count(previous, next) + 1) / (count(previous) + V). V is the number of different tokens that can come next: here ${V}, the ${N_WORDS} words of the bulletins plus ${tok(kit, "</s>")}. <i>heavy</i> was seen ${c} times.</p>
        ${stage < 2 ? `<p class="task">${q.q}</p><div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}</div>` : ""}
        ${stage === 2 ? `${result()}
          <div class="lpanel">${kit.feedback(`Right, both. Now no pair is 0, and the new bulletin gets ${expo(product(WIND_STEPS.map(pAdd1)))} instead of 0. But look at what it cost: rain fell from ${f2(RAIN / c)} to ${f2((RAIN + 1) / (c + V))}. The ${V - SEEN_AFTER_HEAVY} words never seen after heavy now share ${pct(UNSEEN_MASS)} of the probability, because ${V} pretend counts outweigh ${c} real ones.<br><br><b>Add-k</b> adds a fraction k instead of 1: P = (count + k) / (count(previous) + k·V). With k = ${K}, rain keeps ${f2(pAddK(RAIN, c))} and wind still gets a little. Both are kinds of <b>smoothing</b>: taking some probability from seen pairs and giving it to unseen ones. You pick k by testing on bulletins the model did not count, which is the next screen.<br><br>Add-one and add-k are the simplest smoothing methods. Real n-gram systems also use shorter n-grams, such as how common the next word is on its own (methods called interpolation and backoff), but the idea is the same.`, true)}</div>` : ""}`;
      wire(el, i => {
        if (i === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        ans = i; paint();
      });
    };
    paint();
  }

  /* 5. Perplexity: predict, then compare the models on held-out bulletins. */
  function perplexity({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const uniform = Math.exp(-Math.log(1 / V)); // a model that gives every next token 1/V
    const Q = [
      { q: `First, a keyboard that knows nothing: after any word it gives all ${V} next tokens the same probability, 1/${V}. What is its perplexity?`, right: 2,
        opts: ["1", `1/${V} ≈ ${f3(1 / V)}`, String(Math.round(uniform)), String(Math.round(uniform / 2))],
        fb: [["A perplexity of 1 means the model is certain and always right: one choice, probability 1. This model is the opposite.", false],
          ["Perplexity is one over the average probability, not the probability itself, so it is never below 1. A small probability gives a big perplexity.", false], null,
          [`Every token gets exactly 1/${V}, so the average probability is 1/${V} and one over it is ${Math.round(uniform)}. Nothing is halved.`, false]] },
      { q: `Four models were scored on the ${HELD_OUT.length} held-out bulletins. Which one has the lowest perplexity?`, right: 3,
        opts: ["Word counts only, ignoring the previous word (a unigram model, add-one)", "Bigram from plain counts, no smoothing", "Bigram, add-one", `Bigram, add-k with k = ${K}`],
        fb: [[`Ignoring the previous word throws away exactly what helps: after <i>on</i>, <i>the</i> is almost certain. It scored ${f2(PPL.unigram)}, barely better than the ${Math.round(uniform)} of knowing nothing.`, false],
          [`The held-out bulletin “${HELD_OUT[0]}” has the pair <i>heavy wind</i>, probability 0. The log of 0 has no value, so the perplexity is infinite. A model that calls real text impossible cannot be compared with the others.`, false],
          [`Add-one scored ${f2(PPL.addOne)}: better than the unigram, but it gave so much probability to unseen pairs that the pairs that did happen got too little.`, false], null] }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>One number for “how surprised”</h1>
        <p class="lead">To compare models, keep some bulletins apart and never count them: the <b>held-out</b> set. Run each model over it and note the probability it gave every next token (the ${tok(kit, "</s>")} at the end counts, ${tok(kit, "<s>")} does not). <b>Perplexity</b> is one over the average of those probabilities. The average here is the geometric mean: multiply the N probabilities, then take the N-th root. Read perplexity as “the model was as unsure as if it picked among this many equally likely words”. Lower is better: the model gave the words that really came more probability.</p>
        ${stage < 2 ? `<p class="task">${q.q}</p><div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}</div>` : ""}
        ${stage === 2 ? `${kit.meter([
            { label: "knows nothing", value: Math.round(uniform), max: Math.round(uniform) },
            { label: "unigram", value: +f2(PPL.unigram), max: Math.round(uniform) },
            { label: "bigram add-one", value: +f2(PPL.addOne), max: Math.round(uniform) },
            { label: `bigram add-k ${K}`, value: +f2(PPL.addK), max: Math.round(uniform), good: true }])}
          <p class="lx-${ID}-cap">Held-out perplexity over ${N_HELD_TOKENS} tokens in ${HELD_OUT.length} bulletins. Bigram from plain counts: infinite (one pair had probability 0).</p>
          <div class="lpanel">${kit.feedback(`Right. Using the previous word cut the surprise from ${f2(PPL.unigram)} to ${f2(PPL.addOne)}, and smoothing more gently cut it to ${f2(PPL.addK)}. On the fifteen bulletins it was counted from, the add-k model scores ${f2(PPL_TRAIN_ADDK)}: lower, because it has seen those exact pairs. That is why perplexity is measured on text the model never counted. One more rule: two perplexities only compare when both models predict the same set of tokens (here the same ${V}).`, true)}</div>` : ""}`;
      wire(el, i => {
        if (i === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        ans = i; paint();
      });
    };
    paint();
  }

  /* 6. The same thing in Python: a stepped replay of perplexity() on one held-out bulletin. */
  const FR = (() => {
    const fr = [{ ln: 1, v: TRACE[1] }];
    for (let k = 1; k < TRACE.length; k++) {
      if (TRACE[k - 1][0] === 7 && TRACE[k - 1][1] === "l") fr.push({ ln: 7, v: TRACE[k] });
      if (TRACE[k][1] === "r") fr.push({ ln: 8, v: TRACE[k], end: true });
    }
    return fr;
  })();
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i], [, , prev, word, p, total, n] = f.v;
      const say = f.end
        ? `Last line: the average log probability is ${f2(total)} / ${n} = ${f2(total / n)}. <code>exp</code> of an average log is the geometric mean from the last screen, and the <code>-</code> sign makes it “one over”. Result: perplexity ${f2(TRACE_RESULT)} for this one bulletin. A higher probability gives a lower perplexity.`
        : f.ln === 1 ? "Start with a total of 0 and no tokens counted. The code adds logs instead of multiplying probabilities: log(a × b) = log a + log b. The sum holds the same information, and it stays a normal-sized number where the product would be tiny, like 10<sup>−7</sup>."
        : `Pair <code>${kit.esc(prev + " " + word)}</code>: add-one gives p = ${f3(p)}. Its log, ${f2(Math.log(p))}, was added to the total, and the token counted.${prev === "heavy" ? " The unseen pair has the smallest p, so it pulls the total down the most." : ""}`;
      el.innerHTML = `<h1>Perplexity in Python</h1>
        <p class="lead">This function was run on the held-out bulletin “${kit.esc(HELD_OUT[0])}”. <code>pair_counts</code> and <code>prev_counts</code> were filled from the fifteen bulletins exactly as you counted, and <code>V</code> is ${V}.</p>
        <p class="task">Step through to the end. Watch which pair hurts the score most.</p>
        ${codeW(kit, CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>pair <b>${prev ? kit.esc(prev + " " + word) : "–"}</b></span><span>p <b>${p == null ? "–" : f3(p)}</b></span><span>total_log <b>${f2(total)}</b></span><span>n_tokens <b>${n}</b></span></div>
        ${kit.feedback(say)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. Sampling: what a bigram model writes, and what smoothing does to it. */
  function sampling({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const NEVER = "heavy wind on the coast";
    const pool = [SAMPLES_COUNT[2], SAMPLES_COUNT[4], NEVER, SAMPLES_COUNT[1]];
    const sampleNo = s => SAMPLES_COUNT.indexOf(s) + 1;
    const pairsSeen = s => pairsOf(s).map(([a, b]) => `<i>${kit.esc(a)} ${kit.esc(b)}</i>`).join(", ");
    const Q = [
      { q: "Which of these could the bigram model with plain counts <b>never</b> write?", right: 2, opts: pool.map(s => mono(kit, s)),
        fb: pool.map((s, j) => j === 2 ? null : [`It did write this one: sample ${sampleNo(s)} of the run. Every pair in it was counted: ${pairsSeen(s)}. ${s.includes("on the north") || s.includes("on the valleys") ? "The bulletins never say this whole phrase, but each pair appears somewhere, so the model can stitch them together." : ""}`, false]) },
      { q: `Same random seed (0, so the sampler draws the same random numbers), add-one model. Its samples are word salad; the add-k samples (k = ${K}) are closer to real bulletins. Why?`, right: 1,
        opts: ["Add-one used a different random seed", `Add-one gives unseen pairs too much: after <i>heavy</i>, the ${V - SEEN_AFTER_HEAVY} words never seen there share ${pct(UNSEEN_MASS)} of the probability`, "The sampler stops looking at the previous word when smoothing is on", "The bulletins are too long for a bigram model"],
        fb: [["All three samplers started from the same seed, 0. The difference is in the probabilities they drew from.", false], null,
          ["The sampler always asks the model for P(next | previous); it is the same code for all three. The previous word still matters, it just matters less after add-one flattened the counts.", false],
          ["Length is not the issue: the plain-count model wrote readable bulletins from the same fifteen. What changed is how much probability unseen pairs get.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Let the model write</h1>
        <p class="lead"><b>Sampling</b> lets you see what a model has learned. Start at ${tok(kit, "<s>")}, pick the next word at random with the model's probabilities as weights (Python's <code>random.choices</code>), make it the new previous word, and repeat until ${tok(kit, "</s>")} (the run also stopped any sample at 12 words).</p>
        ${stage >= 1 ? `<ul class="lx-${ID}-samp" aria-label="samples">${SAMPLES_COUNT.map(s => `<li>${kit.esc(s)}</li>`).join("")}</ul><p class="lx-${ID}-cap">Plain counts: all five samples from the run (seed 0)</p>` : ""}
        ${stage >= 1 ? `<ul class="lx-${ID}-samp">${SAMPLES_ADD1.slice(0, 3).map(s => `<li>${kit.esc(s)}</li>`).join("")}</ul><p class="lx-${ID}-cap">Add-one: first three samples (seed 0)</p>
          <ul class="lx-${ID}-samp">${SAMPLES_ADDK.slice(0, 3).map(s => `<li>${kit.esc(s)}</li>`).join("")}</ul><p class="lx-${ID}-cap">Add-k, k = ${K}: first three samples (seed 0)</p>` : ""}
        ${stage < 2 ? `<p class="task">${q.q}</p><div class="lpanel">${stage === 1 ? kit.feedback(`Right: <i>heavy wind</i> has probability 0, so the sampler can never pick it. The model did write bulletins that are not among the fifteen, by stitching counted pairs. Each word only looks at the one before, so nothing keeps the whole sentence sensible.`, true) : ""}${ask(kit, q.opts, q.right, ans, q.fb)}</div>` : ""}
        ${stage === 2 ? `<div class="lpanel">${kit.feedback(`Right. Each pick only sees the previous word's row of probabilities. After add-one, a large share of every row belongs to pairs that never happened (after <i>heavy</i>, ${pct(UNSEEN_MASS)}), so many picks are one of them. That is the sampling view of the perplexity result: add-k gave the real pairs more of the probability, and scored better on bulletins it had never seen.`, true)}</div>` : ""}`;
      wire(el, i => {
        if (i === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        ans = i; paint();
      });
    };
    paint();
  }

  /* 8. Broken on purpose: a perplexity that is too good to be true. */
  const BUG_CODE = [
    "def p_smooth(prev, word):",
    "    count = pair_counts[(prev, word)]",
    "    return (count + 1) / prev_counts[prev]"
  ];
  function broken({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const out = [`held-out perplexity, teammate's smoothing: ${BROKEN.ppl}`, `held-out perplexity, add-one (bigram.py):  ${BROKEN.pplRight}`,
      "check: next-word probabilities after each word should add up to 1", ...BROKEN.sums.map(([w, s]) => `  after '${w}': sum = ${s}`)].join("\n");
    const Q = [
      { q: "What is wrong?", right: 2,
        opts: ["Nothing: below 2 means the model is nearly perfect on these bulletins", "The held-out bulletins are too easy", "The probabilities after each word add up to more than 1, so the model claims more certainty than it has", "Perplexity should use log base 2, not the natural log"],
        fb: [["A model that is “nearly perfect” would still give probabilities that add up to 1. Look at the check under the scores: the model gives out more than all of the probability.", false],
          [`The held-out bulletins are the same four that scored ${BROKEN.pplRight} with correct add-one. Same text, same counts; only the probability function changed.`, false], null,
          ["The base changes how the total is written, not the final perplexity: exp of a natural log and 2 to the power of a base-2 log give the same number. The check line is the clue.", false]] },
      { q: "Which change to the return line fixes it?", right: 0,
        opts: [mono(kit, "/ (prev_counts[prev] + V)"), mono(kit, "/ (prev_counts[prev] + 1)"), mono(kit, "drop the + 1 on top"), "Keep it, and score on the fifteen training bulletins instead"],
        fb: [null, [`One extra count on the bottom, but one extra on top for each of the ${V} next tokens. The sums would still be above 1.`, false],
          ["That is the plain-count model again: unseen pairs go back to 0, and the held-out perplexity becomes infinite.", false],
          ["Training text makes every model look better than it is, and the probabilities would still add up to more than 1. It hides the bug instead of fixing it.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(stage, 1)];
      el.innerHTML = `<h1>Too good to be true</h1>
        <p class="lead">A teammate “improved” the smoothing and reports a held-out perplexity of ${BROKEN.ppl}, against ${BROKEN.pplRight} before. You ran his code with a check added. His function and the real output:</p>
        ${codeW(kit, BUG_CODE, stage >= 1 ? 2 : -1)}
        <div class="lx-${ID}-out">${kit.esc(out)}</div>
        <p class="lx-${ID}-cap">Output of docs/ai-path/runs/s4-ngram-lm/broken.py</p>
        ${stage < 2 ? `<p class="task">${q.q}</p><div class="lpanel">${stage === 1 ? kit.feedback(`Right. After <i>heavy</i> the probabilities add up to ${BROKEN.sums[0][1]}: each of the ${V} next tokens got +1 on top, but the bottom stayed at ${COUNT_HEAVY}. A model that hands out more than 100% looks less surprised by everything, so its perplexity drops for free.`, true) : ""}${ask(kit, q.opts, q.right, ans, q.fb)}</div>` : ""}
        ${stage === 2 ? `<div class="lpanel">${kit.feedback(`Right. ${V} pretend counts on top need ${V} on the bottom; then every row adds up to 1 and the honest score is ${BROKEN.pplRight}. The habit to keep: when a perplexity suddenly improves a lot, first check that each row of probabilities adds up to 1 and that no held-out text leaked into the counts.`, true)}</div>` : ""}`;
      wire(el, i => {
        if (i === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        ans = i; paint();
      });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "An offline keyboard on cheap phones, for bulletins that always use the same few hundred words",
      "Answering a listener's question “will I need an umbrella at the match on Saturday?” in a full sentence",
      "Suggesting the end of a long sentence where the right word depends on something said twelve words earlier"
    ];
    const RIGHT = 0;
    const fb = [null,
      ["That needs understanding the question and facts from a forecast. A bigram model only knows which word tends to follow which; it has no idea what a match or Saturday is. That is a job for a large language model with access to the forecast.", false],
      ["A bigram sees one word back. Longer n-grams (three, four words) help a little, but most long word sequences never appear in the counts, so the zeros come back. Neural models that carry the whole sentence along, the next lessons, handle this.", false]];
    const paint = () => {
      el.innerHTML = `<h1>When an n-gram model is the right tool</h1>
        <p class="lead"><b>What it is:</b> a table of counts that guesses the next word from the previous n − 1 words; a bigram uses one. <b>What for:</b> next-word suggestions and scoring how likely a text is, in a narrow, repetitive domain. <b>Reach for it</b> when you need something tiny, fast, offline and easy to explain, or a baseline to beat. <b>Not</b> when the text needs meaning or long context; use a neural language model. <b>Costs:</b> it needs text from the same domain; the table grows with every new pair; bigger n means more unseen pairs. Perplexity, the score you used, is used for large language models too.</p>
        <p class="task">Which job fits a smoothed bigram model?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb.map((f, i) => i === RIGHT ? ["Right. Short, repetitive text, a small vocabulary, no server, and suggestions only need the last word or two. The model is a table of counts: it loads fast, runs on anything, and you can read exactly why it suggested <i>rain</i>.", true] : f))}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A warehouse wants its old handheld scanners to suggest the next word in short shelf notes such as “box damaged on top shelf”, with no network.", true,
      "Yes. Short, repetitive notes and a small vocabulary: pair counts from past notes, smoothed, are enough, and they run on old hardware.",
      "Shelf notes reuse the same few words in the same order. A smoothed bigram table from past notes suggests well, needs no network, and fits on the device."],
    ["Two teams built next-word models for the same app. One splits words into small pieces, the other keeps whole words. They compare their held-out perplexities to pick a winner.", false,
      "No. Perplexity is an average per token. With different vocabularies the tokens are different things, so the two numbers measure different tasks. Compare them on the same vocabulary, or on the real task (how often the suggestion was accepted).",
      "The scores are not comparable: one model predicts word pieces, the other whole words, so “per token” means different things. Same vocabulary first, or measure the real task."],
    ["Before shipping a new keyboard model, the team checks that it predicts last month's real bulletins better than the old one. Both use the same word list, and last month's bulletins were not used for counting.", true,
      "Yes. Held-out text, same vocabulary: a lower perplexity means the new model is less surprised by real bulletins. Confirm with real use after shipping.",
      "This is exactly what perplexity is for: same vocabulary, text neither model counted. The lower score wins, then check real use."],
    ["Write a one-paragraph summary of a twenty-minute phone-in show for the station's website.", false,
      "No. A summary needs what the whole show was about. A bigram model sees one word back and has no idea of topic, so sampling from it would give fluent-looking pairs with no meaning.",
      "A bigram's only context is the previous word. A summary depends on the whole twenty minutes. Use a neural language model for this."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>N-gram model and perplexity, or not?</h1>
        <p class="lead">Four situations from other jobs.</p>
        <p class="task">Is a smoothed n-gram model, or a perplexity comparison, the right move in each? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can build and score a language model</h1>
      <p class="lead">You counted word pairs, turned them into next-word probabilities, saw one unseen pair make a sentence impossible, fixed it with smoothing, and scored the models with perplexity on bulletins they never counted. You also caught a perplexity that was too good because the probabilities did not add up to 1.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the bigram counts, an add-k probability function and <code>perplexity</code> for a small set of sentences, and check that every row of probabilities adds up to 1.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. A bigram remembers one word; a recurrent network carries a hidden state through the whole sentence instead.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "N-gram language models and perplexity",
    checked: "2026-11-14",
    sources: [
      "https://web.stanford.edu/~jurafsky/slp3/3.pdf",
      "https://docs.python.org/3/library/random.html"
    ],
    interview: [
      {
        q: "Your new next-word model scores a held-out perplexity of 1.7, down from 9.8 last week. What do you check before you celebrate?",
        good: [
          "That the probabilities after each context add up to 1; a smoothing bug can hand out more than 100%",
          "That no held-out text leaked into the training counts",
          "That both models use the same vocabulary and count the same tokens, end markers included",
          "That the gain shows up on the real task, such as accepted suggestions, not only in perplexity"
        ],
        weak: "Ship it because lower perplexity is better. That trusts the number without checking it is still a valid probability on unseen text."
      },
      {
        q: "A bigram autocomplete trained on last year's bulletins calls some new, normal sentences impossible and never suggests certain words. Why, and what do you do?",
        good: [
          "Those sentences contain pairs that never appeared in the counts, so their probability is 0 and the whole product is 0",
          "Smooth: add-k with k tuned on held-out text beats add-one, which gives unseen pairs far too much; stronger methods mix in shorter n-grams (interpolation, backoff)",
          "Add recent text from the same domain and recount",
          "Measure the change with held-out perplexity and with how often suggestions are accepted"
        ],
        weak: "Collect more data. More data reduces unseen pairs but never removes them, so without smoothing some new sentences stay impossible."
      }
    ],
    screens: [countByHand, toProbability, unseenPair, smoothing, perplexity, asCode, sampling, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-check]"], right: [...Array(RAIN).fill('[data-plus="rain"]'), ...Array(SNOW).fill('[data-plus="snow"]'), ...Array(FOG).fill('[data-plus="fog"]'), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
