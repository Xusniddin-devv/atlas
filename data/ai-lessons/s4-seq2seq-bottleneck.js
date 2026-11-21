/* Lesson: sequence-to-sequence and its bottleneck. Story: a museum audio guide translates visitors' spoken
   questions; long questions come back garbled. Ideas: (1) an encoder-decoder reads the whole input into ONE
   fixed-size vector and writes the output from that vector alone; (2) because that vector has the same size for
   every input, long inputs lose detail: the score falls with length, and a bigger vector only moves the drop.
   Data, all real:
   - docs/ai-path/runs/s4-seq2seq-bottleneck/train_seq2seq.py: a tiny GRU encoder-decoder (no attention) in
     PyTorch, trained on a made-up word-for-word "translation" (20 words, order kept, sentences of 2 to 16 words),
     seed 0. hidden32.out.txt (vector of 32 numbers) and hidden128.out.txt (128 numbers): training loss, word
     accuracy and whole-sentence accuracy per length (200 test sentences each), accuracy per word position for
     16-word sentences, and sample translations. hidden32-8000.out.txt: the 32-number model trained four times
     longer (8000 steps), to test "it only needed more training" (screens 6 and 7). env.txt: versions.
   - The by-hand toy on screen 1 (keep three words, fill the rest from the most common question) is computed in
     the page and is presented as a toy, not as a model.
   No model calls were recorded. Lesson-local style (.lx-s4-seq2seq-bottleneck-*): word buttons, a marked word
   row, the encoder-decoder flow picture and a two-column bar table; see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s4-seq2seq-bottleneck";
  const P = "lx-" + ID;
  const pct = v => Math.round(v * 100);

  /* ---------- Data copied from docs/ai-path/runs/s4-seq2seq-bottleneck/*.out.txt ---------- */
  const VOCAB = 20;           // train_seq2seq.py: SRC_WORDS = a..t
  const TRAIN_MIN = 2, TRAIN_MAX = 16, STEPS = 2000, TEST_PER_LEN = 200;
  // [length, word_accuracy, exact_sentences]
  const H32 = [[2, 1.0, 1.0], [3, 0.965, 0.965], [4, 0.871, 0.81], [5, 0.796, 0.66], [6, 0.609, 0.315], [7, 0.539, 0.15], [8, 0.436, 0.055], [9, 0.404, 0.01], [10, 0.332, 0.01], [11, 0.314, 0.0], [12, 0.279, 0.0], [13, 0.272, 0.0], [14, 0.233, 0.0], [15, 0.235, 0.0], [16, 0.214, 0.0]];
  const H128 = [[2, 1.0, 1.0], [3, 1.0, 1.0], [4, 0.996, 0.99], [5, 0.987, 0.965], [6, 0.985, 0.96], [7, 0.954, 0.85], [8, 0.917, 0.735], [9, 0.881, 0.585], [10, 0.804, 0.355], [11, 0.799, 0.305], [12, 0.701, 0.13], [13, 0.702, 0.12], [14, 0.609, 0.015], [15, 0.558, 0.005], [16, 0.53, 0.0]];
  const POS16_32 = [0.87, 0.615, 0.415, 0.27, 0.17, 0.13, 0.12, 0.125, 0.095, 0.07, 0.105, 0.07, 0.07, 0.05, 0.065, 0.035];
  const LOSS32 = [[500, "1.843"], [1000, "1.493"], [1500, "1.170"], [2000, "1.019"]];
  // hidden32-8000.out.txt: same model and seed, 8000 steps. Loss readings and the [length, word_accuracy, exact] rows used.
  const LONG_STEPS = 8000;
  const LOSS32_LONG = [[2000, "1.019"], [5000, "0.821"], [6000, "0.807"], [7000, "0.689"], [8000, "0.693"]];
  const H32_LONG = [[2, 1.0, 1.0], [3, 0.977, 0.975], [4, 0.927, 0.9], [5, 0.891, 0.83], [6, 0.852, 0.75], [7, 0.743, 0.45], [8, 0.663, 0.28], [9, 0.603, 0.195], [10, 0.523, 0.06], [11, 0.464, 0.015], [12, 0.401, 0.0], [13, 0.385, 0.0], [14, 0.343, 0.0], [15, 0.32, 0.0], [16, 0.307, 0.0]];
  // samples from hidden32.out.txt: [length, source, correct, model]
  const SAMPLES32 = [
    [4, "h s r e", "C N B A", "C N B A"],
    [4, "l t p s", "H M P N", "H M P N"],
    [8, "c t a p i r h g", "Q M K P D B C L", "Q M K P D B C L"],
    [8, "p r r p m e h e", "P B B P E A C A", "P B B A P E C S"],
    [12, "q m a c f s b j a i p t", "I E K Q R N S J K D P M", "I K E Q N B S H K D E R"],
    [12, "m n m s o e l d b e p g", "E T E N G A H O S A P L", "E T N E A G S H O L H S"],
    [16, "i n j n q m s l r s n s h k a i", "D T J T I E N H B N T N C F K D", "D T E I Q C J A N I F G B O M J"],
    [16, "t f k r s s d g s i j d c p p c", "M R F B N N O L N D J O Q P P Q", "N M C Q O J B C P J A O Q D B F"]
  ];
  // From train_seq2seq.py (Seq2Seq.encode and forward); long calls trimmed with … and the comment cut, to fit a phone
  const CODE = [
    "def encode(self, src, lens):",
    "    packed = …(self.src_emb(src), lens, …)",
    "    _, h = self.encoder(packed)",
    "    return h",
    "def forward(self, src, lens, tin):",
    "    h = self.encode(src, lens)",
    "    y, _ = self.decoder(…, h)",
    "    return self.out(y)"
  ];

  /* ---------- The by-hand toy (screen 1), computed here ---------- */
  const Q = "Where can I see the golden crown from the old kingdom today".split(" ");
  const FILL = "Where can I find the nearest toilet on the ground floor please".split(" ");
  const KEEP = 3;
  const CROWN = Q.indexOf("crown");
  const decode = kept => Q.map((w, i) => kept.includes(i) ? w : FILL[i]);
  const wrongAt = kept => decode(kept).map((w, i) => w !== Q[i]);
  const DIFF = Q.filter((w, i) => w !== FILL[i]).length;
  const MIN_WRONG = DIFF - KEEP;

  /* ---------- Derived from the data ---------- */
  const firstBelow = (rows, k) => { const r = rows.find(x => x[k] < 0.5); return r ? r[0] : null; };
  const BELOW32 = firstBelow(H32, 1);
  const BELOW128 = firstBelow(H128, 1);
  const BELOW32_LONG = firstBelow(H32_LONG, 1);
  const at = (rows, n) => rows.find(r => r[0] === n);
  const NO_EXACT32 = (H32.find(r => r[2] === 0) || [null])[0];
  const LAST = H32[H32.length - 1][0];
  const SHORT_OK = H32.filter(r => r[1] === 1).map(r => r[0]);
  const CHANCE = 1 / VOCAB;
  const marks = (correct, model) => { const c = correct.split(" "), m = model.split(" "); return c.map((w, i) => m[i] === w); };
  const wrongCount = s => marks(s[2], s[3]).filter(ok => !ok).length;
  const HID_SMALL = 32, HID_BIG = 128;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
      .${P}-words { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; }
      .${P}-w { min-height: 44px; min-width: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface); color: var(--ink); font: 500 16px var(--font); cursor: pointer; }
      .${P}-w[aria-pressed="true"] { border: 3px solid var(--ink); font-weight: 700; }
      .${P}-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; }
      .${P}-t { padding: 4px 8px; border: 1px solid var(--line); border-radius: 4px; font: 500 15px/1.4 var(--mono); }
      .${P}-t.${P}-bad { border: 2px solid var(--bad); background: var(--bad-soft); text-decoration: line-through; }
      .${P}-t.${P}-ok { border: 2px solid var(--good); background: var(--good-soft); }
      .${P}-lab { margin: 14px 0 0; font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}-flow { margin: 16px 0 0; padding: 12px; border: 1px solid var(--line); border-radius: 4px; background: var(--sunk); }
      .${P}-flow .${P}-row { align-items: center; }
      .${P}-h { padding: 4px 8px; border: 1px dashed var(--muted); border-radius: 4px; font: 500 14px var(--mono); color: var(--muted); }
      .${P}-vec { padding: 6px 10px; border: 3px solid var(--ink); border-radius: 4px; font: 700 14px var(--mono); }
      .${P}-arrow { font: 500 15px var(--mono); color: var(--muted); }
      .${P}-tbl { width: 100%; margin: 16px 0 0; border-collapse: collapse; font-size: 14.5px; }
      .${P}-tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding-bottom: 6px; }
      .${P}-tbl th, .${P}-tbl td { padding: 3px 6px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
      .${P}-tbl th { font-weight: 600; color: var(--muted); font-size: 13px; }
      .${P}-tbl td:first-child { font: 600 14px var(--mono); width: 3.2em; }
      .${P}-bar { display: flex; align-items: center; gap: 6px; }
      .${P}-track { flex: 1 1 auto; min-width: 0; }
      .${P}-bar u { display: block; height: 12px; background: var(--ink-2); border-radius: 2px; text-decoration: none; }
      .${P}-bar b { font: 600 13.5px var(--mono); min-width: 3em; }
      .${P}-tbl tr.${P}-hit td { font-weight: 700; border-bottom: 2px solid var(--ink); }
      .${P}-samp { margin: 12px 0 0; padding: 10px 0 0; border-top: 1px solid var(--line); }
      .${P}-samp p { margin: 4px 0 0; font-size: 14px; color: var(--muted); }
      .${P}-mono { font: 500 14px/1.5 var(--mono); overflow-wrap: anywhere; }
      .${P}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
    `;
    document.head.appendChild(s);
  }
  const tok = (kit, w, cls) => `<span class="${P}-t${cls ? ` ${P}-${cls}` : ""}">${kit.esc(w)}</span>`;
  const markedRow = (kit, words, okList) => `<div class="${P}-row">${words.map((w, i) => tok(kit, w, okList[i] ? "ok" : "bad")).join("")}</div>`;
  const plainRow = (kit, words) => `<div class="${P}-row">${words.map(w => tok(kit, w)).join("")}</div>`;
  const barCell = (v, title) => `<div class="${P}-bar" title="${title || ""}"><span class="${P}-track"><u style="width:${Math.max(2, pct(v))}%"></u></span><b>${pct(v)}%</b></div>`;
  // rows: [[label, [values...]]]; head: column names
  const barTable = (head, rows, caption, hit) => `<table class="${P}-tbl"><caption>${caption}</caption><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(([lab, vals]) => `<tr${hit && hit(lab) ? ` class="${P}-hit"` : ""}><td>${lab}</td>${vals.map(v => `<td>${barCell(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const sampleBlock = (kit, s) => {
    const m = s[3].split(" ");
    const ok = marks(s[2], s[3]);
    const extra = m.length - s[2].split(" ").length;
    return `<div class="${P}-samp"><p>${s[0]} words in: <span class="${P}-mono">${kit.esc(s[1])}</span></p><p>right translation: <span class="${P}-mono">${kit.esc(s[2])}</span></p>${markedRow(kit, m, m.map((_, i) => ok[i] === true))}<p>${wrongCount(s)} of ${s[0]} words wrong${extra > 0 ? `, and ${extra} extra word${extra > 1 ? "s" : ""} at the end` : ""}</p></div>`;
  };
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }
  const simpleQ = (el, done, kit, render, opts, right, fb) => {
    let ans = null;
    const paint = () => {
      el.innerHTML = render(ans) + `<div class="lpanel">${ask(kit, opts, right, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  };

  /* 1. The situation and the by-hand task: three numbers for twelve words. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    let kept = [];
    const paint = () => {
      const full = kept.length === KEEP;
      const dec = decode(kept), bad = wrongAt(kept);
      const nBad = bad.filter(Boolean).length;
      const wasted = kept.filter(i => Q[i] === FILL[i]).map(i => Q[i]);
      let fb = "";
      if (full && !kept.includes(CROWN)) {
        fb = kit.feedback(`The staff hear: “${kit.esc(dec.join(" "))}”. The visitor wanted the <b>crown</b>, and that word did not survive, so ${nBad} words came back wrong and the question now asks for something else.${wasted.length ? ` You also spent a number on “${kit.esc(wasted.join("”, “"))}”, which the fill-in already gets right.` : ""} Clear and try again.`, false);
      } else if (full) {
        fb = kit.feedback(`The staff hear: “${kit.esc(dec.join(" "))}”. The crown survived, but ${nBad} of ${Q.length} words are still wrong${wasted.length ? `, partly because “${kit.esc(wasted.join("”, “"))}” came back by itself anyway` : ""}. Try other picks if you like: ${DIFF} words differ from the common question and you can keep only ${KEEP}, so <b>at least ${MIN_WRONG} words always come back wrong</b>. The note is too small for this question.`, true);
      }
      el.innerHTML = `<h1>Three numbers for twelve words</h1>
        <p class="lead">A museum's audio guide lets visitors speak a question in their own language and translates it for the staff. Short questions come through fine. Long ones come back garbled. Translation, summaries and chat replies all turn one sequence of words into another; this lesson shows an early neural design for that job and where it breaks.</p>
        <p class="lead">First, play a simplified guide. You may pass on a note of only <b>${KEEP} numbers</b>. Each number is the place of one word you keep, so that word arrives exactly. The other side fills every other place with the word from the most common question, the <b>fill-in</b>: “${kit.esc(FILL.join(" "))}”.</p>
        <p class="task">The visitor asks the question below. Tap ${KEEP} words to keep, so the staff still know what the visitor wants to see.</p>
        <div class="${P}-words">${Q.map((w, i) => `<button type="button" class="${P}-w" data-w="${i}" aria-pressed="${kept.includes(i)}">${kit.esc(w)}</button>`).join("")}</div>
        <div class="lsteps"><button type="button" class="btn" data-clear ${kept.length ? "" : "disabled"}>Clear</button></div>
        <p class="${P}-lab">rebuilt from your note (${kept.length} of ${KEEP} kept)</p>
        ${full ? markedRow(kit, dec, bad.map(b => !b)) : plainRow(kit, dec.map((w, i) => kept.includes(i) ? w : "…"))}
        ${full ? kit.pics.key([["enter", "came back right"], ["no", "came back wrong"]]) : ""}
        <div class="lpanel">${fb}</div>`;
      el.querySelectorAll(`.${P}-w`).forEach(b => b.onclick = () => {
        const i = +b.dataset.w;
        if (kept.includes(i)) kept = kept.filter(k => k !== i);
        else if (kept.length < KEEP) kept = [...kept, i];
        paint();
        if (kept.length === KEEP && kept.includes(CROWN)) done();
      });
      el.querySelector("[data-clear]").onclick = () => { kept = []; paint(); };
    };
    paint();
  }

  /* 2. Spot the idea: the note has the same size whatever the length. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    const SHORT_LEN = 4;
    const opts = [
      "Long questions use rarer words, which the guide knows less well",
      `The note is ${KEEP} numbers for every question, so the longer the question, the more words must share it`,
      "The fill-in question is a bad guess; a better one would fix long questions",
      "The guide hears long questions less clearly"
    ];
    const fb = [
      [`The visitor's words were all ordinary: golden, crown, old, kingdom. You lost words because there was no room for them, not because they were rare.`, false],
      [`Right. A ${SHORT_LEN}-word question leaves at most ${SHORT_LEN - KEEP} word to guess; the ${Q.length}-word one left ${Q.length - KEEP}. The note does not grow with the question. A neural translator built this way, the <b>encoder-decoder</b>, has the same weakness: it squeezes the whole input into one list of numbers of fixed size, and that one list is a <b>bottleneck</b>, a narrow place everything has to pass through.`, true],
      [`A better fill-in would guess a few more words, but it can only guess what most visitors say. The words that make this visitor's question different are exactly the ones a guess gets wrong.`, false],
      [`In your note nothing was misheard: you had every word in front of you and still could not pass them all on. The loss happened in the note.`, false]
    ];
    simpleQ(el, done, kit, () => `<h1>Why do long questions break?</h1>
      <p class="lead">With a ${SHORT_LEN}-word question, your ${KEEP} numbers cover almost every word. With the ${Q.length}-word question, at least ${MIN_WRONG} words came back wrong whatever you picked.</p>
      <p class="task">What made the long question fail?</p>`, opts, 1, fb);
  }

  /* 3. The real thing: encoder, one vector, decoder. */
  function encoderDecoder({ el, done, kit }) {
    ensureStyle();
    const s = SAMPLES32[1];
    const src = s[1].split(" "), out = s[3].split(" ");
    const flow = `<div class="${P}-flow" aria-label="encoder-decoder picture">
      <p class="${P}-lab">encoder: reads one word at a time; h1, h2, … = its hidden state after each word</p>
      <div class="${P}-row">${src.map((w, i) => `${tok(kit, w)}<span class="${P}-arrow">→</span><span class="${P}-h">h${i + 1}</span>`).join("")}</div>
      <p class="${P}-lab">handed over: only the last state</p>
      <div class="${P}-row"><span class="${P}-vec">h${src.length} = ${HID_SMALL} numbers</span></div>
      <p class="${P}-lab">decoder: writes one word at a time, starting from that vector</p>
      <div class="${P}-row">${["start", ...out].map((w, i) => `${tok(kit, w)}${i < out.length ? `<span class="${P}-arrow">→</span>` : `<span class="${P}-arrow">→ end</span>`}`).join("")}</div>
    </div>`;
    const opts = [
      `All ${src.length} encoder states, h1 to h${src.length}`,
      "The encoder state from the third source word",
      `Its own hidden state, which began as the one vector h${src.length}, plus the word it wrote just before`,
      "The source words themselves"
    ];
    const fb = [
      [`Look at the highlighted line of the code: <code>_, h = self.encoder(packed)</code>. A PyTorch GRU returns two things: the state after every word, and the final state. The <code>_</code> throws the per-word states away. Only <code>h</code> reaches the decoder.`, false],
      [`Nothing lines up word 3 of the output with word 3 of the input. The decoder never receives h3; it gets h${src.length} once, at the start.`, false],
      [`Right. The encoder (a recurrent network, like the LSTM and GRU of the last lesson) reads the source and keeps only its final hidden state: <b>one vector of ${HID_SMALL} numbers</b>, the context vector. The decoder (a second GRU) starts from that vector and writes the translation one word at a time, feeding each word it wrote back in, until it writes an end mark. That pair is a <b>sequence-to-sequence</b> model: a sequence in, a sequence of another length out. Whatever the decoder needs about the source must be inside those ${HID_SMALL} numbers.`, true],
      [`The decoder has its own word list (the target language). It never sees the source words; the encoder has already turned them into numbers.`, false]
    ];
    simpleQ(el, done, kit, () => `<h1>Encoder, one vector, decoder</h1>
      <p class="lead">The guide's real model is not ours to run, so we built a tiny translator of the same kind in PyTorch and trained it on a made-up language: ${VOCAB} words, each with one fixed translation, word order kept. Here it translates a real ${src.length}-word input from that run:</p>
      ${flow}
      ${kit.code(CODE, 2)}
      <p class="${P}-cap">The model's code, from our training script (long calls cut with …). <code>src_emb</code> turns each source word into a short list of numbers; <code>packed</code> is those lists, ready for the encoder GRU.</p>
      <p class="task">While the decoder writes the third word, what does it have to go on?</p>`, opts, 2, fb);
  }

  /* 4. Predict where the recorded score-by-length chart drops. */
  function predictDrop({ el, done, kit }) {
    ensureStyle();
    const buckets = [4, 8, 12, null];
    const right = BELOW32 == null ? 3 : buckets.reduce((b, v, i) => v != null && Math.abs(v - BELOW32) < Math.abs((buckets[b] || 99) - BELOW32) ? i : b, 0);
    const opts = ["Around 4 words", "Around 8 words", "Around 12 words", `Not before ${LAST} words`];
    const chart = barTable(["length", "words right", "whole sentence right"], H32.map(r => [r[0], [r[1], r[2]]]),
      `Vector of ${HID_SMALL} numbers. Length = words in the sentence; ${TEST_PER_LEN} fresh test sentences per length`, lab => lab === BELOW32);
    const s = at(H32, BELOW32);
    const say = i => i === right ? null : buckets[i] == null
      ? `It falls well before that. Even sentences it was trained on, up to ${TRAIN_MAX} words, come back mostly wrong.`
      : buckets[i] < BELOW32
        ? `Too early. At ${buckets[i]} words it still gets ${pct(at(H32, buckets[i])[1])}% of words right. ${HID_SMALL} numbers hold a few words well.`
        : `Later than that. By ${buckets[i]} words only ${pct(at(H32, buckets[i])[1])}% of words come back right.`;
    const fb = opts.map((_, i) => i === right
      ? [`Right. Words right falls below half at <b>${BELOW32} words</b> (${pct(s[1])}%), and from ${NO_EXACT32} words on not one whole sentence of the ${TEST_PER_LEN} is right. At ${LAST} words it gets ${pct(at(H32, LAST)[1])}% of words right; pure guessing among ${VOCAB} words would get ${pct(CHANCE)}%. Same model, same training, same words; only the length changed. That is what Cho and colleagues reported in 2014 for real encoder-decoder translation: fine on short sentences, worse quickly as sentences get longer.${chart}`, true]
      : [say(i), false]);
    simpleQ(el, done, kit, ans => `<h1>Predict where it drops</h1>
      <p class="lead">We trained that model for ${STEPS} steps on sentences of ${TRAIN_MIN} to ${TRAIN_MAX} words, then gave it ${TEST_PER_LEN} new sentences of each length. Sentences of ${SHORT_OK.join(" or ")} words: every word came back right.</p>
      <p class="task">Predict: at what length does it first get fewer than half of the words right?</p>`, opts, right, fb);
  }

  /* 5. Where in a long sentence the errors are. */
  function wherePos({ el, done, kit }) {
    ensureStyle();
    const n = POS16_32.length;
    const third = Math.floor(n / 3);
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const first = avg(POS16_32.slice(0, third)), last = avg(POS16_32.slice(n - third));
    const right = first > last ? 0 : 1;
    const opts = ["The first few words", "The last few words", "All positions about the same"];
    const s = SAMPLES32[4];
    const posTable = barTable(["place", "right"], POS16_32.map((v, i) => [i + 1, [v]]), `${n}-word sentences: how often the output word at each place was right`);
    const fb = [
      [`Right. Word 1 was right ${pct(POS16_32[0])}% of the time, word ${n} only ${pct(POS16_32[n - 1])}%. The decoder starts fresh from the vector, so its first words are its best. After that it leans on its own earlier words; once one goes wrong, the next ones are built on a mistake. And the details of later words were never stored clearly in ${HID_SMALL} numbers. In the run's ${s[0]}-word example below, the first word is right and words start trading places soon after.${posTable}${sampleBlock(kit, s)}`, true],
      [`The encoder did read the last words most recently, but in this run they came back worst: word ${n} was right only ${pct(POS16_32[n - 1])}% of the time, word 1 ${pct(POS16_32[0])}%. The decoder has to carry everything through every word it writes before it gets there.`, false],
      [`Not in this run: word 1 was right ${pct(POS16_32[0])}% of the time and word ${n} ${pct(POS16_32[n - 1])}%. The errors pile up along the sentence.`, false]
    ];
    simpleQ(el, done, kit, () => `<h1>Where do the errors sit?</h1>
      <p class="lead">Take only the ${n}-word test sentences and check each output position separately.</p>
      <p class="task">Which words of the translation come back right most often?</p>`, opts, right, fb);
  }

  /* 6. Broken on purpose: the real failing run; find the cause. */
  function diagnose({ el, done, kit }) {
    ensureStyle();
    const opts = [
      "Long sentences contain words the model never learned",
      `The model never saw long sentences while training`,
      "The decoder stops too early and cuts long translations short",
      `Every sentence, long or short, has to pass through the same ${HID_SMALL}-number vector`,
      "It was not trained long enough: the loss was still falling"
    ];
    const SHOWN = SAMPLES32.filter((_, i) => i % 2 === 0 || i === 3);
    const lens = SHOWN.map(s => s[3].split(" ").length);
    const fb = [
      [`The model uses the same ${VOCAB} words at every length, and the ${SAMPLES32[0][0]}-word lines are built from them and come back right. Unknown words do hurt real translators, but here there are none.`, false],
      [`The run's first line says it trained on lengths ${TRAIN_MIN} to ${TRAIN_MAX}. The ${LAST}-word sentences were in training, and they still fail.`, false],
      [`Count the output words: ${lens.join(", ")}. The long outputs are full length or longer. Their words are wrong, not missing.`, false],
      [`Right. Nothing else changes with length: same words, same training, outputs of full length. What a long sentence needs is room to store more, and the vector has the same ${HID_SMALL} numbers for ${TRAIN_MIN} words as for ${TRAIN_MAX}. Bahdanau and colleagues suggested exactly this in 2014: that the fixed-length vector is a bottleneck for the basic encoder-decoder.`, true],
      [`Fair suspicion, so we tested it: the same model trained ${LONG_STEPS / STEPS} times longer, ${LONG_STEPS} steps. The loss only went ${LOSS32_LONG.map(([st, l]) => `${l} at step ${st}`).join(", ")}: it levels off. Words right at ${LAST} words rose from ${pct(at(H32, LAST)[1])}% to ${pct(at(H32_LONG, LAST)[1])}%, it still falls below half at ${BELOW32_LONG} words, and still not one ${LAST}-word sentence comes back whole. More training helps a little; it does not fix long sentences.`, false]
    ];
    simpleQ(el, done, kit, () => `<h1>Broken on purpose: find the cause</h1>
      <p class="lead">The museum's team asks you to look at the failing translator. Here is what our run with the ${HID_SMALL}-number vector printed: its setup, its training loss, and test translations with the wrong words marked.</p>
      <div class="${P}-mono">hidden_size=${HID_SMALL} steps=${STEPS} train lengths ${TRAIN_MIN}..${TRAIN_MAX}<br>${LOSS32.map(([st, l]) => `step ${st} train_loss ${l}`).join("<br>")}</div>
      ${SHOWN.map(s => sampleBlock(kit, s)).join("")}
      ${kit.pics.key([["enter", "right word"], ["no", "wrong word"]])}
      <p class="task">Which cause fits all of this evidence?</p>`, opts, 3, fb);
  }

  /* 7. Will a bigger vector fix it? */
  function biggerVector({ el, done, kit }) {
    ensureStyle();
    const big = at(H128, LAST), small = at(H32, LAST);
    const opts = ["About the same as before at every length", "Better, but long sentences still clearly worse than short ones", "Near perfect at every length"];
    const table = barTable(["length", `${HID_SMALL} numbers`, `${HID_BIG} numbers`], H32.map((r, i) => [r[0], [r[1], H128[i][1]]]), `Words right by sentence length, same task, same ${STEPS} steps`);
    const fb = [
      [`More numbers do help: at ${LAST} words, ${pct(small[1])}% of words right became ${pct(big[1])}%. Training the ${HID_SMALL}-number model ${LONG_STEPS / STEPS} times longer only reached ${pct(at(H32_LONG, LAST)[1])}%, so the size of the vector was holding it back.`, false],
      [`Right. With ${HID_BIG} numbers the drop starts later, ${BELOW128 == null ? `and words right stays above half up to ${LAST} words (${pct(big[1])}% at ${LAST})` : `falling below half at ${BELOW128} words`}. But whole sentences right still fall to ${pct(big[2])}% at ${LAST} words. A bigger vector moves the drop but does not remove it: the vector is still the same size for every input. It also costs more on every step of both networks. (Sutskever and colleagues did report a very large, deep LSTM that coped with long sentences, helped by feeding the source in reverse order. Size and tricks push the limit out; they do not remove it.)${table}`, true],
      [`At ${LAST} words only ${pct(big[1])}% of words came back right, and ${pct(big[2])}% of whole sentences. A larger fixed size still has an input long enough to overflow it.`, false]
    ];
    simpleQ(el, done, kit, () => `<h1>Will a bigger vector fix it?</h1>
      <p class="lead">The obvious fix: make the vector bigger. We trained the same model again with <b>${HID_BIG}</b> numbers instead of ${HID_SMALL}, four times the room.</p>
      <p class="task">Predict the scores with ${HID_BIG} numbers.</p>`, opts, 1, fb);
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const opts = [
      "Translate the guide's room names of two or three words, such as “Hall of Clocks”, into each visitor's language",
      "Translate a visitor's 60-word complaint into English",
      "Answer questions about a 20-page exhibition catalogue"
    ];
    const fb = [
      [`Right. The input is short, so a small vector holds all of it: in the run, a vector of ${HID_SMALL} numbers got every word of ${SHORT_OK.join(" or ")}-word inputs right. One short sequence in, a few words out is exactly the shape. Short, fixed-format inputs are where a plain encoder-decoder is enough.`, true],
      [`That is the museum's own failure, at its worst: a long input squeezed into one vector loses its details, as the run showed from ${BELOW32} words on. Use a model with attention.`, false],
      [`Twenty pages is far past what one vector can carry. And the answer may hide in one sentence anywhere in the catalogue; you need a model that can look back at the right part of the input (attention), or a search step that finds the passage first.`, false]
    ];
    simpleQ(el, done, kit, () => `<h1>When a single vector is enough</h1>
      <p class="lead"><b>What it is for:</b> turning one sequence into another of a different length, such as translation or summaries. Early neural translation, in 2014, used this shape.</p>
      <p class="lead"><b>Reach for it</b> to understand those systems, or when inputs are short and a small model is enough.</p>
      <p class="lead"><b>Not</b> for long inputs, or inputs whose exact details matter (names, numbers). Use a model with <b>attention</b> instead: the decoder looks back at every encoder state. Transformers are built on it.</p>
      <p class="lead"><b>Costs:</b> pairs of example sentences to train on; both networks run one word at a time, which is slow and hard to spread over many processors; a bigger vector costs more memory and time on every step.</p>
      <p class="task">Which museum job could a plain encoder-decoder with one vector do well?</p>`, opts, 0, fb);
  }

  /* 9. Recognise it: is the one-vector bottleneck the likely cause? */
  const CASES = [
    ["An old phone app subtitles videos with an LSTM encoder-decoder. Short lines are fine; in long lines, names near the end come out wrong.", true,
      "Yes. The failure grows with length and it is an encoder-decoder with one vector. Check scores by line length to confirm, then move to a model with attention.",
      "This has both signs: one vector between encoder and decoder, and errors that grow with the length of the line. That is the bottleneck pattern you saw in the run."],
    ["A support chatbot answers every question about this year's prices wrongly, short or long. The prices changed after it was trained.", false,
      "No. Length does not matter here; short questions fail too. The model never saw the new prices, and no vector size fixes missing knowledge. Give it the current price list at question time.",
      "The bottleneck shows as failures that grow with input length. Here short questions fail just as much, because the facts are missing from what the model learned. That is a knowledge problem, not a size problem."],
    ["A summariser built as a GRU encoder-decoder writes good summaries of short emails, but summaries of long reports miss most of their points.", true,
      "Yes. Same shape as the museum guide: everything passes through one fixed vector, and the longer the input, the more is lost. Attention, or splitting the report, is the fix to try.",
      "One fixed vector, and quality falling as the input gets longer: that is the bottleneck. A long report has more to say than the vector can hold."],
    ["A transformer translator handles long English sentences well, but garbles text in a rare dialect even when the sentences are short.", false,
      "No. Transformers use attention, so there is no single vector to overflow, and the failures do not follow length. The dialect is barely in its training data; more examples of it are the fix.",
      "Attention lets the decoder look back at every input word, so there is no one-vector bottleneck here. And short sentences fail too: the cause is the dialect missing from the training data."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Bottleneck or not?</h1>
        <p class="lead">Four failing systems from other teams.</p>
        <p class="task">Is the one-vector bottleneck the likely cause in each? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You found the bottleneck</h1>
      <p class="lead">You squeezed a twelve-word question into ${KEEP} numbers and lost words, saw that an encoder-decoder hands its decoder one vector of fixed size, predicted where a real run's score fell with length, and saw a vector four times bigger only move the drop.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Instead of one vector, the decoder looks back at every encoder state and weighs them: the fix for the bottleneck you just found.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Sequence-to-sequence and its bottleneck",
    checked: "2026-11-14",
    sources: [
      "https://arxiv.org/abs/1409.3215",
      "https://arxiv.org/abs/1409.1259",
      "https://arxiv.org/abs/1409.0473",
      "https://arxiv.org/abs/1706.03762",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.GRU.html"
    ],
    interview: [
      {
        q: "Your LSTM encoder-decoder summariser is good on short support tickets but long tickets lose key details. How do you find out whether the fixed-size vector is the cause, and what do you change?",
        good: [
          "Score the outputs by input length on a held-out set; a steady fall with length points at the vector",
          "Rule out other causes: unknown words, long inputs missing from training data, outputs cut off by a length limit",
          "Look at where errors sit in the output: in a plain encoder-decoder they pile up later in the sequence",
          "A bigger hidden size moves the drop but does not remove it, and costs more per step",
          "Switch to attention (or a transformer), or split long inputs into pieces"
        ],
        weak: "Train longer or add more data, without checking whether the errors follow input length."
      },
      {
        q: "A colleague wants to double the hidden size of your encoder-decoder translator so it handles long sentences. What do you expect, and what would you propose instead?",
        good: [
          "It will help somewhat: more numbers can hold more of the sentence",
          "The vector is still the same size for every input, so a long enough sentence still overflows it",
          "Every step of both networks gets slower and the model needs more memory",
          "Attention removes the single vector: the decoder looks back at all encoder states"
        ],
        weak: "Agree that a bigger model always fixes it, or reject it without saying what the fixed size does to long inputs."
      }
    ],
    screens: [byHand, spotIdea, encoderDecoder, predictDrop, wherePos, diagnose, biggerVector, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-w="0"]', '[data-w="1"]', '[data-w="2"]'], right: ["[data-clear]", `[data-w="${CROWN}"]`, '[data-w="5"]', '[data-w="10"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
