/* Lesson: BERT against GPT, reading versus writing. Story: a cinema chain needs one model to sort customer
   reviews by complaint type and another to write replies to them. Ideas: (1) an encoder (BERT-style) is trained
   to fill hidden words from BOTH sides, a decoder (GPT-style) to guess the NEXT word from the left side only;
   (2) so an encoder is the reading model (labels, spans, similarity) and a decoder the writing model, and a
   decoder can still read when the whole text sits to the left of its answer, at a higher cost per item.
   Data, all real:
   - docs/ai-path/runs/s4-bert-vs-gpt/gap_fill.py + gap_fill.out.txt: the five review gaps filled by
     albert/albert-base-v2 (fill-mask, both sides) and by the SmolLM2-135M base model in Ollama (left side only);
   - docs/ai-path/runs/s4-bert-vs-gpt/code_screen.py + code_screen.out.txt: the listing on the code screen
     (lines kept short so the listing fits a phone; re-run in review);
     decoder_same_left.py + decoder_same_left.out.txt: the decoder given the same three reviews (left side "The");
   - recordings (main checkout) docs/ai-path/recordings/s4-bert-vs-gpt/sort-review and reply-review: a hosted
     decoder model sorting and answering one review.
   Lesson-local style: sentence-with-gap blocks and a small transcript (.lx-s4-bert-vs-gpt-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s4-bert-vs-gpt";
  const pct = p => `${Math.round(p * 100)}%`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs and recordings ---------- */
  // The five reviews of gap_fill.py. opts/right/why are the learner's by-hand task; leftSure is the lesson's
  // judgement of whether the words before the gap alone pin the word down.
  const REVIEWS = [
    { text: "The sound in screen 4 was so ___ that my ears hurt.", opts: ["quiet", "loud", "slow", "dark"], right: 1, leftSure: false,
      clue: "that my ears hurt",
      wrong: { 0: "Quiet sound does not hurt anyone's ears. The words after the gap, “that my ears hurt”, rule it out.", 2: "“Slow” does not describe sound that hurts. Read past the gap: “that my ears hurt”.", 3: "Sound is not dark. And “that my ears hurt” after the gap asks for something about volume." },
      unsure: "“The sound in screen 4 was so …” could go on with loud, quiet, bad or muffled. Only “that my ears hurt”, after the gap, settles it." },
    { text: "We had good seats, but the ___ was so sticky that my shoes made a noise with every step.", opts: ["screen", "sound", "carpet", "ticket"], right: 2, leftSure: false,
      clue: "so sticky that my shoes made a noise",
      wrong: { 0: "A sticky screen would not touch your shoes. The words after the gap, “my shoes made a noise with every step”, point at what you walk on.", 1: "Sound is not sticky. “My shoes made a noise with every step” points at what you walk on.", 3: "A sticky ticket stays in your hand. “With every step” points at what is under your shoes." },
      unsure: "“We had good seats, but the …” could be followed by almost anything in the cinema: sound, screen, carpet, staff. The answer is in “sticky … shoes … step”, all after the gap." },
    { text: "The film was in French with English ___.", opts: ["seats", "subtitles", "popcorn", "staff"], right: 1, leftSure: true,
      clue: "in French with English",
      wrong: { 0: "English seats is not a thing. “The film was in French with English …” is about language.", 2: "Popcorn has no language. “In French with English …” asks for something written in a language.", 3: "The staff do not belong to the film. “The film was in French with English …” asks for text on the screen." },
      sure: "The gap is the last word, so there is no right side to read. “In French with English …” already points to subtitles." },
    { text: "Half of the ___ in row F were broken, so we sat on the floor.", opts: ["lights", "tickets", "seats", "speakers"], right: 2, leftSure: false,
      clue: "so we sat on the floor",
      wrong: { 0: "Broken lights would make the row dark, but you would still have somewhere to sit. “So we sat on the floor” is the clue.", 1: "A broken ticket does not send you to the floor. Read past the gap: “so we sat on the floor”.", 3: "Broken speakers spoil the sound, not your place to sit. “So we sat on the floor” says what was missing." },
      unsure: "“Half of the …” gives almost nothing: lights, tickets, seats, speakers all fit. “So we sat on the floor” is the clue, and it comes after the gap." },
    { text: "The man behind us talked on his ___ during the whole film.", opts: ["seat", "phone", "ticket", "popcorn"], right: 1, leftSure: true,
      clue: "talked on his",
      wrong: { 0: "You talk in a seat, not on it. “Talked on his …” is an everyday phrase for one thing.", 2: "Nobody talks on a ticket. “Talked on his …” is an everyday phrase for one thing.", 3: "“Talked on his popcorn” makes no sense. The phrase before the gap points to one object." },
      sure: "“Talked on his …” is a fixed phrase: phone (or mobile, cell). The words before the gap are enough." }
  ];
  const leftOf = t => t.split("___")[0].trim();
  const rightOf = t => t.split("___")[1].trim();

  // From docs/ai-path/runs/s4-bert-vs-gpt/gap_fill.out.txt (top 5 each; encoder scores are probabilities, decoder
  // values are log-probabilities of the first next token; a leading space of a decoder token is not shown)
  const RUN = {
    encoder: "albert/albert-base-v2", decoder: "hf.co/QuantFactory/SmolLM2-135M-GGUF:Q4_0 (SmolLM2-135M base)",
    rows: [
      { enc: [["loud", 0.235], ["deafening", 0.045], ["eerie", 0.025], ["awful", 0.024], ["strong", 0.02]],
        dec: [[" loud", -2.748], [" strong", -3.168], [" good", -3.274], [" high", -3.437], [" close", -3.468]], cont: " loud that I could", fits: ["loud", "deafening"] },
      { enc: [["carpet", 0.145], ["floor", 0.116], ["mattress", 0.059], ["sidewalk", 0.038], ["air", 0.025]],
        dec: [["\n", -2.836], [" seats", -3.923], [" only", -4.098], [" first", -4.225], [" rest", -4.488]], cont: "\nworst", fits: ["carpet", "floor"] },
      { enc: [["subtitle", 0.926], ["orthography", 0.004], ["translations", 0.003], ["translation", 0.003], ["script", 0.003]],
        dec: [[" subt", -0.251], [" and", -3.871], [" sub", -3.943], [" voc", -4.573], [" dub", -4.682]], cont: " subtitles.\n", fits: ["subtitle", "subtitles", "subt"] },
      { enc: [["chairs", 0.247], ["doors", 0.13], ["seats", 0.111], ["tables", 0.084], ["benches", 0.052]],
        dec: [[" problems", -4.098], [" students", -4.432], [" people", -4.567], [" first", -4.607], ["\n", -4.62]], cont: " problems that we have", fits: ["chairs", "seats"] },
      { enc: [["phone", 0.243], ["own", 0.05], ["typewriter", 0.047], ["keyboard", 0.036], ["guitar", 0.036]],
        dec: [[" cell", -1.163], [" phone", -1.906], ["\n", -3.282], [" mobile", -3.411], [" way", -3.477]], cont: " cell phone.\n", fits: ["phone", "cell", "mobile"] }
    ]
  };

  // The code screen listing is docs/ai-path/runs/s4-bert-vs-gpt/code_screen.py, line for line.
  const CODE = [
    "from transformers import pipeline",
    "ALBERT = \"albert/albert-base-v2\"",
    "fill_mask = pipeline(\"fill-mask\", ALBERT)",
    "reviews = [",
    "    \"The [MASK] was too loud to hear.\",",
    "    \"The [MASK] was too cold to drink.\",",
    "    \"The [MASK] was too salty to eat.\",",
    "]",
    "for review in reviews:",
    "    best = fill_mask(review, top_k=1)[0]",
    "    score = round(best[\"score\"], 3)",
    "    print(best[\"token_str\"], score)"
  ];
  const CODE_OUT = [["noise", 0.131], ["wine", 0.14], ["soup", 0.042]]; // code_screen.out.txt
  const CODE_OPTS = [["noise", "wine", "soup", "seat"], ["seat", "noise", "wine", "soup"], ["wine", "seat", "noise", "soup"]];
  // decoder_same_left.out.txt: the same three reviews, cut at the gap, given to the decoder
  const SAME_LEFT = [
    { input: "The", cont: " compromiser is a" },
    { input: "The", cont: " compromiser is a" },
    { input: "The", cont: " compromiser is a" }
  ];

  // From docs/ai-path/recordings/s4-bert-vs-gpt/sort-review.json and reply-review.json (not altered)
  const REVIEW_FOR_HOSTED = "We had good seats, but the carpet was so sticky that my shoes made a noise with every step.";
  const LABELS = ["sound", "seats", "cleanliness", "other guests", "language", "staff"];
  const SORT_SYSTEM = `You sort cinema reviews by complaint type. Answer with exactly one label from this list and nothing else: ${LABELS.join(", ")}.`; // sort-review.request.json
  const REC_SORT = {
    src: "s4-bert-vs-gpt/sort-review",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "cleanliness", promptTokens: 56, outTokens: 2
  };
  const REC_REPLY = {
    src: "s4-bert-vs-gpt/reply-review",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "We're very sorry to hear about the sticky carpet in the auditorium. We'll have our cleaning team address this issue immediately to ensure a more pleasant experience for all our guests.",
    promptTokens: 60, outTokens: 37
  };
  const CAPTION = `Recorded model output, ${REC_SORT.recordedAt}`;
  const ENC_PARAMS = 11251680; // model_sizes.out.txt: albert/albert-base-v2 num_parameters()
  const DEC_PARAMS = 135e6;    // env.txt: "ollama show" reports 135M parameters for the decoder

  /* ---------- Derived from the data ---------- */
  const fitsTop = (list, fits) => fits.includes(list[0][0].trim());
  const ENC_OK = RUN.rows.map(r => fitsTop(r.enc, r.fits));
  const DEC_OK = RUN.rows.map(r => fitsTop(r.dec, r.fits));
  const NOT_SURE = REVIEWS.map((r, i) => i).filter(i => !REVIEWS[i].leftSure);
  const SIZE_X = Math.round(DEC_PARAMS / ENC_PARAMS);
  const LUCKY = REVIEWS.findIndex((r, i) => !r.leftSure && DEC_OK[i]);
  const showTok = t => t === "\n" ? "↵ (new line)" : t.trim();
  const firstWord = c => c.trim().split(/\s+/)[0].replace(/[.,]$/, "");
  // A fitting decoder guess that is only the first piece of the word it went on to write (" subt" -> "subtitles")
  const PIECE = RUN.rows.findIndex((r, i) => DEC_OK[i] && firstWord(r.cont) !== r.dec[0][0].trim());

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-say { margin: 0 0 4px; font-size: 17px; line-height: 1.55; font-weight: 500; }
      .lx-${ID}-gap { display: inline-block; min-width: 4.2em; border-bottom: 2px solid var(--ink); text-align: center; font-weight: 700; }
      .lx-${ID}-hid { color: var(--faint); letter-spacing: .1em; white-space: nowrap; }
      .lx-${ID}-log { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 8em 1fr; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-txt { min-width: 0; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-out { margin: 10px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); font: 500 14px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
      .lx-${ID}-two .ltable { width: 100%; }
      @media (max-width: 520px) { .lx-${ID}-row, .lx-${ID}-two { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  // A review with its gap: mode "both" shows everything, "left" hides the right side; fill puts a word in the gap.
  function sentence(kit, text, { mode = "both", fill = null } = {}) {
    const [l, r] = text.split("___");
    const gap = `<span class="lx-${ID}-gap">${fill ? kit.esc(fill) : "&nbsp;?&nbsp;"}</span>`;
    return `<p class="lx-${ID}-say">${kit.esc(l)}${gap}${mode === "both" ? kit.esc(r) : ` <span class="lx-${ID}-hid" aria-label="the rest is hidden">· · ·</span>`}</p>`;
  }
  function log(kit, rows) {
    return `<div class="lx-${ID}-log">${rows.map(([who, html]) => `<div class="lx-${ID}-row"><div class="lx-${ID}-who">${kit.esc(who)}</div><div class="lx-${ID}-txt">${html}</div></div>`).join("")}</div>`;
  }
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }
  // A block of independent Yes/No-style cases; calls done() when every case is answered right.
  function cases(kit, el, done, list, render) {
    const ans = list.map(() => null);
    const paint = () => {
      el.innerHTML = render(ans);
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (list.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 1. The situation, and the by-hand task with both sides visible. */
  function bothSides({ el, done, kit }) {
    ensureStyle();
    cases(kit, el, done, REVIEWS, ans => `<h1>Two jobs, two kinds of model</h1>
      <p class="lead">A cinema chain gets hundreds of online reviews a week. The manager wants two things: every review sorted by complaint type (sound, seats, cleanliness …), and a short reply written to each one. A consultant says the first job needs a “reading” model and the second a “writing” model. Picking the right kind of model for each job is one of the first choices in any AI product. Before choosing, see how reading works.</p>
      <p class="lead">Five real-looking reviews, each with one word hidden.</p>
      <p class="task">Fill each gap. You can see the whole sentence.</p>
      ${REVIEWS.map((r, i) => `<div class="lcase" id="c${i}">${sentence(kit, r.text, { fill: ans[i] === r.right ? r.opts[r.right] : null })}${kit.options(r.opts.map(kit.esc), { picked: ans[i], correct: r.right })}${ans[i] == null ? "" : ans[i] === r.right
        ? kit.feedback(`Yes. What decided it: “${kit.esc(r.clue)}”${r.leftSure ? ", before the gap." : ", after the gap."}`, true)
        : kit.feedback(r.wrong[ans[i]], false)}</div>`).join("")}`);
  }

  /* 2. The same task, left side only. */
  function leftOnly({ el, done, kit }) {
    ensureStyle();
    const list = REVIEWS.map(r => ({ right: r.leftSure ? 0 : 1 }));
    cases(kit, el, done, list, ans => {
      const all = list.every((x, j) => ans[j] === x.right);
      return `<h1>Now cover the right side</h1>
      <p class="lead">Same five gaps, but this time you only see the words <b>before</b> each gap. Forget what you saw on the last screen: imagine meeting each sentence for the first time.</p>
      <p class="task">For each one: could you still be sure of the hidden word?</p>
      ${REVIEWS.map((r, i) => `<div class="lcase" id="c${i}">${sentence(kit, r.text, { mode: "left" })}${kit.options(["Yes, sure", "No, not sure"], { picked: ans[i], correct: list[i].right })}${ans[i] == null ? "" : ans[i] === list[i].right
        ? kit.feedback(r.leftSure ? r.sure : r.unsure, true)
        : kit.feedback(r.leftSure ? `You can be sure here. ${r.sure}` : `Not from the left side alone. ${r.unsure}`, false)}</div>`).join("")}
      ${all ? kit.feedback(`${NOT_SURE.length} of ${REVIEWS.length} gaps needed the words after them. Seeing <b>both sides</b> of a gap is what made the first screen easy. Hold on to one more fact: when you <i>write</i> a sentence, you only ever have the left side, because the words after the one you are writing do not exist yet.`) : ""}`;
    });
  }

  /* 3. Spot the idea: the two training games, and why only one can write. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The decoder is bigger, so it is better at language",
      "Writing is a chain of next-word guesses with only the left side known, and that is exactly the game the decoder trained on",
      "The encoder knows fewer words, so it cannot finish sentences",
      "The encoder only reads short texts, and replies are long"
    ];
    const fb = [
      ["Size is not the difference. Either kind can be trained small or large. What differs is the game each was trained on, and so what each word is allowed to look at.", false],
      [`Right. An <b>encoder</b> (BERT is the famous one) was trained on the game you played first: hide some words and guess them from <b>both sides</b>. BERT picked 15% of the tokens in each text and replaced most of them with a <code>[MASK]</code> token. Every word looks at every other word. A <b>decoder</b> (the GPT family) was trained on the second: guess the <b>next</b> word from the left side only. That is the causal mask from the self-attention lesson: each word sees only the words before it. Writing a reply is that second game played over and over: guess a word, append it, guess the next. An encoder never practised working without a right side, so it has no natural way to write. Careful: “mask” means two things here. BERT's training is called <i>masked</i> language modelling because some input words are hidden. The decoder's causal mask is different: it stops each word from looking at the words after it.`, true],
      ["Both kinds use vocabularies of tens of thousands of pieces. The problem is not missing words. It is what each word was trained to look at.", false],
      ["Encoders read texts of hundreds of words without trouble. Length is not the issue; the direction is.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Two training games</h1>
        <p class="lead">The two kinds of model learned language by playing the two games you just played, millions of times, on huge piles of text. The model trained on the first game is called an <b>encoder</b>; the one trained on the second, a <b>decoder</b>.</p>
        ${log(kit, [["encoder", "Hide some words. Guess each hidden word from the words on <b>both sides</b>."], ["decoder", "Cut the text at a word. Guess the <b>next</b> word from the words on the <b>left</b> only."]])}
        <p class="task">The cinema's second job is writing replies, one word after another. Why is that a decoder's job?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it with predictions: two real small models on the same five gaps. */
  function predictRuns({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const OPTS = ["Both", "Only the encoder", "Only the decoder", "Neither"];
    const truth = i => ENC_OK[i] && DEC_OK[i] ? 0 : ENC_OK[i] ? 1 : DEC_OK[i] ? 2 : 3;
    const why = (i, p) => {
      const r = RUN.rows[i], left = leftOf(REVIEWS[i].text), d1 = showTok(r.dec[0][0]), e1 = r.enc[0][0];
      const encSaid = [0, 1].includes(p), decSaid = [0, 2].includes(p);
      const parts = [];
      if (decSaid && !DEC_OK[i]) parts.push(`The decoder saw only “${kit.esc(left)}”. Its top guess was “${kit.esc(d1)}”: nothing to its left says what the gap is about.`);
      if (!decSaid && DEC_OK[i]) parts.push(`The decoder's top guess from “${kit.esc(left)}” alone was “${kit.esc(d1)}”, which fits. The left side was enough here.`);
      if (encSaid && !ENC_OK[i]) parts.push(`The encoder's top guess was “${kit.esc(e1)}”, which does not fit.`);
      if (!encSaid && ENC_OK[i]) parts.push(`The encoder read the whole sentence and its top guess was “${kit.esc(e1)}”, which fits.`);
      return parts.join(" ");
    };
    const table = i => {
      const r = RUN.rows[i];
      return `<div class="lx-${ID}-two">
        ${kit.table(r.enc.map(([w, p]) => [w, pct(p)]), { head: ["guess", "chance"], title: "Encoder, both sides", hit: ENC_OK[i] ? 0 : -1 })}
        ${kit.table(r.dec.map(([w, lp]) => [showTok(w), pct(Math.exp(lp))]), { head: ["next token", "chance"], title: "Decoder, left side only", hit: DEC_OK[i] ? 0 : -1 })}
      </div><p class="lx-${ID}-cap">Run on this Mac: the decoder went on to write “${kit.esc(r.cont.trim().replace(/\n/g, "↵"))}”.</p>`;
    };
    const mark = (ok, w) => `${kit.esc(w)} ${ok ? "(fits)" : "(does not fit)"}`;
    const summary = () => `<table class="ltable"><caption>Top guess for each review</caption><thead><tr><th>review</th><th>encoder</th><th>decoder</th></tr></thead><tbody>${RUN.rows.map((r, j) =>
      `<tr><td>${j + 1}</td><td>${mark(ENC_OK[j], r.enc[0][0])}</td><td>${mark(DEC_OK[j], showTok(r.dec[0][0]))}</td></tr>`).join("")}</tbody></table>`;
    const paint = () => {
      const fin = k >= REVIEWS.length, i = Math.min(k, REVIEWS.length - 1);
      const shown = fin ? i : k - 1;
      el.innerHTML = `<h1>Two real models, the same gaps</h1>
        <p class="lead">We ran two small open models on this Mac. The <b>encoder</b> (a BERT-style model) got each whole sentence with the gap marked. The <b>decoder</b> got only the words before the gap and guessed the next token. It is about ${SIZE_X} times bigger (more parameters). It is a <i>base</i> model: trained only on the next-word game, not tuned for chat. A guess counts if it fits the sentence. The tables after each answer show each model's top five guesses and how likely it thought each one was.</p>
        ${fin ? "" : `<p class="task">Review ${k + 1} of ${REVIEWS.length}. Whose top guess will fit the gap?</p>${sentence(kit, REVIEWS[k].text)}`}
        <div class="lpanel">${fin ? "" : kit.options(OPTS, { picked: wrong, correct: truth(k) })}
        ${wrong != null ? kit.feedback(`Not this one. ${why(k, wrong)}`, false) : ""}
        ${fin ? summary() : ""}
        ${k > 0 && !fin ? `${fin ? "" : `<p class="lx-${ID}-cap">Last review: ${kit.esc(REVIEWS[shown].text.replace("___", REVIEWS[shown].opts[REVIEWS[shown].right]))}</p>`}${table(shown)}` : ""}
        ${fin ? kit.feedback(`The encoder's top guess fitted ${ENC_OK.filter(Boolean).length} of ${REVIEWS.length}; the decoder's ${DEC_OK.filter(Boolean).length} of ${REVIEWS.length}, though it is the bigger model. Its misses were reviews ${DEC_OK.map((ok, j) => ok ? null : j + 1).filter(Boolean).join(" and ")}, where only the right side holds the clue. ${LUCKY < 0 ? "" : `On review ${LUCKY + 1} you could not be sure from the left, yet its most likely next token was “${kit.esc(showTok(RUN.rows[LUCKY].dec[0][0]))}”: a decoder bets on what usually comes next, and here the bet fitted.`}${PIECE < 0 ? "" : ` On review ${PIECE + 1}, “${kit.esc(showTok(RUN.rows[PIECE].dec[0][0]))}” is a token, the first piece of “${kit.esc(firstWord(RUN.rows[PIECE].cont))}”, which it went on to write.`}`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== truth(k)) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= REVIEWS.length) done();
      });
    };
    paint();
  }

  /* 5. The library call as a recorded run: change only the right side. */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null; // k 0..2: the three reviews, 3: the decoder question, 4: finished
    const DQ = ["One", "Two", "Three"];
    const distinct = new Set(SAME_LEFT.map(s => s.cont)).size;
    const paint = () => {
      const printed = CODE_OUT.slice(0, Math.min(k, 3)).map(([w, s]) => `${w} ${s}`).join("\n");
      const line = k < 3 ? 9 : 11;
      let q = "";
      if (k < 3) {
        const opts = CODE_OPTS[k], right = opts.indexOf(CODE_OUT[k][0]);
        q = `<p class="task">Loop turn ${k + 1}: “${kit.esc(CODE[4 + k].trim().replace(/^"|",$/g, ""))}”. What is the encoder's top guess for the gap?</p>
          <div class="lpanel">${kit.options(opts, { picked: wrong, correct: right })}${wrong != null ? kit.feedback(`“${kit.esc(opts[wrong])}” does not go with the words after the gap. The left side is just “The” in all three, so the right side is all the encoder has to go on.`, false) : ""}</div>`;
      } else if (k === 3) {
        q = `<p class="task">The decoder gets each review cut at the gap and always takes its most likely next token (temperature 0, as in our run). How many different continuations can it write for these three?</p>
          <div class="lpanel">${kit.options(DQ, { picked: wrong, correct: distinct - 1 })}${wrong != null ? kit.feedback(`Cut at the gap, all three reviews are the same text: “${kit.esc(SAME_LEFT[0].input)}”. The same input to the same model, always taking the most likely token, gives the same output. The differences are all to the right, where it cannot look.`, false) : ""}</div>`;
      } else {
        q = `<div class="lpanel">${kit.feedback(`Right: ${plural(distinct, "continuation")}. We ran it: for each review the decoder got “${kit.esc(SAME_LEFT[0].input)}” and wrote “${kit.esc(SAME_LEFT[0].cont.trim())}” each time. The encoder gave three different words because only the right side changed. The <code>fill-mask</code> pipeline returns a list of guesses, each with <code>token_str</code> (the word) and <code>score</code> (its probability); <code>top_k</code> sets how many.`, true)}</div>`;
      }
      el.innerHTML = `<h1>The same thing in Python</h1>
        <p class="lead">This is the encoder from the last screen: ALBERT, a smaller version of BERT. Hugging Face Transformers wraps it in a <code>pipeline</code>. You write <code>[MASK]</code> where the gap is (ALBERT's mask token; other models use another). Three reviews, same left side, different right side.</p>
        ${kit.code(CODE, line)}
        ${printed ? `<div class="lx-${ID}-out" aria-label="printed so far">${kit.esc(printed)}</div><p class="lx-${ID}-cap">Output of our run on this Mac.</p>` : ""}
        ${q}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        const right = k < 3 ? CODE_OPTS[k].indexOf(CODE_OUT[k][0]) : distinct - 1;
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k === 4) done();
      });
    };
    paint();
  }

  /* 6. Sort ten product tasks: reading job or writing job. */
  const TASKS = [
    ["Sort each review into one of six complaint types.", 0, "The output is one label chosen from a fixed list. The model has to read the whole review, and writes nothing new."],
    ["Write a short reply to each review.", 1, "The output is new text, built one word after another. That is the next-word game."],
    ["Given one review, find other reviews about the same problem.", 0, "This is comparing meanings. An encoder turns each review into a vector (a list of numbers); similar reviews get nearby vectors. Nothing is written."],
    ["Turn this week's reviews into one paragraph for the manager.", 1, "A summary is new text that did not exist in any review. Writing is the decoder's job."],
    ["Mark each review as positive or negative.", 0, "Two labels, read off the whole review. A classic encoder job: reading, then one label."],
    ["Pick out the film title and the screen number mentioned in a review.", 0, "The answer is a span already in the text. An encoder can tag each word (title, screen, other) because every word sees the whole sentence."],
    ["Draft the weekly newsletter about new films.", 1, "Fresh text with no fixed answer. Decoder."],
    ["Hide reviews with insults before they go on the website.", 0, "Insult or not is a yes/no label from reading the whole review. Encoder; it is also fast enough to check every review."],
    ["Answer chat questions about showtimes in full sentences.", 1, "The reply is a sentence written word by word. The showtimes come from a lookup, but the words are the decoder's."],
    ["Suggest three titles for a blog post about the cinema's anniversary.", 1, "Invented text again. Decoder."]
  ];
  function sortTen({ el, done, kit }) {
    ensureStyle();
    const list = TASKS.map(t => ({ right: t[1] }));
    cases(kit, el, done, list, ans => `<h1>Reading job or writing job?</h1>
      <p class="lead">Ten jobs the cinema's product team listed. The test: is the output <b>new text</b>, or is it a <b>label, a span</b> (a piece copied from the text) <b>or a comparison</b> taken from text that already exists?</p>
      <p class="task">Sort each job: encoder (reads) or decoder (writes).</p>
      ${TASKS.map(([q, r, why], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Encoder", "Decoder"], { picked: ans[i], correct: r })}${ans[i] == null ? "" : ans[i] === r
        ? kit.feedback(why, true)
        : kit.feedback(r === 0 ? `No new text is needed. ${why}` : `Something must be written that is not in the input. ${why}`, false)}</div>`).join("")}
      ${list.every((x, j) => ans[j] === x.right) ? kit.feedback(`${TASKS.filter(t => t[1] === 0).length} reading jobs, ${TASKS.filter(t => t[1] === 1).length} writing jobs. The cinema's first job is a reading job; the second is a writing job.`) : ""}`);
  }

  /* 7. A decoder can read too: the whole text sits to the left of its answer. */
  function decoderReads({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const firstWords = REVIEW_FOR_HOSTED.split(",")[0];
    const opts = [
      "It looked at both sides after all",
      `It guessed from the first words, “${firstWords}”`,
      "The whole review is in the prompt, before the answer. When the model writes the label, every word of the review is to its left",
      "The list of labels told it the answer"
    ];
    const fb = [
      ["It did not. It only ever looks left. The question is what was on its left when it wrote the label.", false],
      [`Then it would have said “seats”, the word in those first words. It said “${kit.esc(REC_SORT.text)}”, which needs “sticky carpet” from the end of the review.`, false],
      [`Right. “Left side only” is about the words the model is <i>writing</i>. Everything in the prompt comes before the answer, so the model reads all of it. That is why one hosted decoder can do both of the cinema's jobs: put the review in the prompt and ask for a label, or ask for a reply. The catch is cost, not ability: every review is a paid call to a hosted model (here ${REC_SORT.promptTokens} input tokens to get ${plural(REC_SORT.outTokens, "token")} back), and the answer is free text you must check is one of your labels.`, true],
      [`The list holds all ${LABELS.length} labels and does not point to one. The model had to read the review to pick.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Can a writer read?</h1>
        <p class="lead">The consultant's colleague says: skip the encoder, a hosted chat model can sort reviews too. We tried it once. A small hosted model (a decoder) got the labels and one review:</p>
        ${log(kit, [["instructions", kit.esc(SORT_SYSTEM)], ["review", kit.esc(REVIEW_FOR_HOSTED)], ["model answers", `<b>${kit.esc(REC_SORT.text)}</b>`]])}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="lead">Asked for a reply to the same review, it wrote:</p>
        ${log(kit, [["model answers", kit.esc(REC_REPLY.text)]])}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="task">A decoder only looks left. How did it read the whole review to sort it?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Move the sorting to a small encoder, fine-tuned on their own labelled reviews",
      "Switch to a bigger hosted model so the labels are more accurate",
      "Keep it as it is: the cost per review stays the same, so the bill stays flat",
      "Make the prompt longer, with an example of every label"
    ];
    const fb = [
      ["Right. Fixed labels, lots of labelled examples, huge volume: that is where a small encoder wins. It runs on their own server, answers fast, always returns one of the labels, and stays cheap per review even at that volume. The hosted decoder stays for the replies, the job only it can do.", true],
      ["Accuracy was not the problem; volume was. A bigger model costs more per review and is slower, so this makes the bill grow faster.", false],
      ["The cost per review stays the same, but it is paid on every review. Many times more reviews means many times the bill.", false],
      [`Examples help a decoder, but every example is sent again with every review. Each call already carried ${REC_SORT.promptTokens} input tokens for a ${plural(REC_SORT.outTokens, "token")} answer; this makes every call bigger.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for which</h1>
        <p class="lead"><b>Encoder</b> (BERT-style): for reading jobs with fixed outputs: labels, tagged words, similarity search. Small, fast and cheap to run on your own machine. For labels it needs labelled examples to fine-tune on (train it a little more on your own data); it cannot write.</p>
        <p class="lead"><b>Decoder</b> (GPT-style): for anything that writes, and for reading jobs when you have no labelled data or the labels change often, because a prompt replaces training. It costs more per item, is slower, and its output needs checking.</p>
        <p class="lead"><b>Neither</b> when no language is involved: counting or averaging is plain code.</p>
        <p class="task">The cinema sorted reviews with a hosted decoder for a year. The labels never changed, they now have thousands of labelled reviews, and volume is growing many times over. What do you do?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including one that needs no model. */
  const NEW = [
    ["A bank routes incoming support emails into five team queues. It has two years of routed emails.", 0,
      "Encoder. A fixed set of labels, read off the whole email, and plenty of labelled examples to fine-tune on.",
      { 1: "Nothing has to be written: the output is one of five queue names. And two years of labelled emails is exactly what fine-tuning an encoder needs.", 2: "There is language to read here: the queue depends on what the email says. That is a reading job with fixed labels." }],
    ["A phone keyboard suggests the next word while you type.", 1,
      "Decoder. The words after the cursor do not exist yet, so only the left side is available, which is exactly the next-word game.",
      { 0: "An encoder needs both sides of the gap. While someone types, there is no right side yet. Guessing the next word from the left is the decoder's training game.", 2: "Guessing the next word from what came before is a language task; a model is what does it." }],
    ["A shop wants the average star rating of each product from its reviews' star fields.", 2,
      "Neither. The stars are numbers already. An average is arithmetic: plain code, exact, and free. No text needs reading.",
      { 0: "An encoder reads text. Here the input is star numbers, and the job is adding and dividing. A model would add cost and could only make the answer less exact.", 1: "A decoder writes text; nothing here is text. Averaging numbers is plain code, exact every time." }],
    ["A shop wants a product description written from a list of the product's features.", 1,
      "Decoder. The description is new text, written word by word from the features in the prompt.",
      { 0: "No label or span is being picked. The output is new sentences, which is writing.", 2: "Turning a feature list into readable sentences is a language task: it needs a model that writes." }]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const list = NEW.map(c => ({ right: c[1] }));
    cases(kit, el, done, list, ans => `<h1>Encoder, decoder, or neither?</h1>
      <p class="lead">Four jobs from other companies.</p>
      <p class="task">Pick the right tool for each. Pick again if you change your mind.</p>
      ${NEW.map(([q, r, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Encoder", "Decoder", "Neither"], { picked: ans[i], correct: r })}${ans[i] == null ? "" : ans[i] === r ? kit.feedback(yes, true) : kit.feedback(no[ans[i]], false)}</div>`).join("")}`);
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Reading model, writing model</h1>
      <p class="lead">You filled gaps with both sides and with the left side only, saw a small encoder and a larger decoder do the same, and sorted jobs by their output: a label, span or comparison is reading (encoder); new text is writing (decoder). A decoder can also read whatever sits in its prompt, at a higher cost per item. When no text needs reading or writing, use plain code, not a model.</p>
      <p class="lead">For the cinema: a small encoder sorts the reviews, a decoder writes the replies.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You chose the encoder for sorting here; next you train one on labelled examples and fix the errors that setup usually throws.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "BERT against GPT: reading versus writing",
    checked: "2026-11-14",
    sources: [
      "https://arxiv.org/abs/1810.04805",
      "https://huggingface.co/learn/llm-course/chapter1/6",
      "https://huggingface.co/docs/transformers/main_classes/pipelines",
      "https://huggingface.co/docs/transformers/model_doc/albert",
      "https://huggingface.co/HuggingFaceTB/SmolLM2-135M",
      "https://docs.ollama.com/api/generate",
      "https://sbert.net/"
    ],
    interview: [
      {
        q: "Your team plans to send five million support tickets a day to a hosted LLM to tag each with one of eight categories. What would you propose, and why?",
        good: [
          "Tagging into fixed categories is a reading job, so a small fine-tuned encoder fits it",
          "An encoder runs on our own hardware, answers fast, and always returns one of the eight labels",
          "At that volume the per-call cost and latency of a hosted decoder add up on every ticket",
          "Use the LLM to bootstrap: label a sample, check it by hand, then fine-tune the encoder on it",
          "Keep the LLM for jobs that write text, or while the categories are still changing"
        ],
        weak: "Use the biggest LLM because it is the most accurate. That ignores cost, speed and the need to check its free-text output."
      },
      {
        q: "A colleague says BERT cannot do autocomplete because it is an old model. Is that the real reason, and when would you still pick a BERT-style model?",
        good: [
          "The reason is the training game, not age: BERT fills hidden words from both sides, autocomplete has only the left side",
          "A decoder is trained to guess the next word from the left, the causal mask enforces that",
          "BERT-style encoders are still the right pick for classification, tagging words and similarity search",
          "They are small and cheap enough to run on every item at high volume"
        ],
        weak: "Agree that newer is better and use a GPT-style model for everything, without saying what each was trained to do."
      }
    ],
    screens: [bothSides, leftOnly, spotIdea, predictRuns, asCode, sortTen, decoderReads, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: REVIEWS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: REVIEWS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: REVIEWS.map(() => "[data-right]") },
      { wrong: ["[data-wrong]"], right: Array(CODE_OUT.length + 1).fill("[data-right]") },
      { wrong: ["#c0 [data-wrong]"], right: TASKS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: NEW.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
