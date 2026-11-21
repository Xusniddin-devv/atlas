/* Lesson: build, train and sample a tiny GPT. Story: a map app team wants fake but plausible street names for test
   data; their small model starts repeating real names from its training list.
   Ideas: (1) a GPT is token + position embeddings, a stack of transformer blocks and a head that scores every next
   character; it trains on next-character prediction at every position, and a falling train loss with a rising
   validation loss means it is memorising the list; (2) temperature divides the scores before softmax: low
   temperature favours the most likely paths (copies of the list), high temperature makes misspellings.
   Data, all real, from runs on this Mac (no model API calls):
   - docs/ai-path/runs/s4-tiny-gpt/tiny_gpt.py + tiny_gpt.out.txt: the street-name list (built by the script from
     common English street-name parts, seed 0), the 157,808-parameter GPT, the training log every 250 steps, the
     sample sets at three temperatures from two checkpoints, and the next-letter scores after "Ashford ";
   - docs/ai-path/runs/s4-tiny-gpt/sample_by_hand.py + sample_by_hand.out.txt: sample_next in plain Python, traced
     line by line at temperature 0.5 and 1.0 with the same random draw.
   Lesson-local style (wide tables, name lists, checklist): classes prefixed lx-s4-tiny-gpt-, see ensureStyle(). */
(() => {
  const ID = "s4-tiny-gpt";
  const P = `lx-${ID}-`;
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s4-tiny-gpt.ipynb";
  const f2 = x => x.toFixed(2), f3 = x => x.toFixed(3);
  const small = x => x < 0.0005 ? "< 0.001" : x.toFixed(3);
  const pct = (a, b) => Math.round(a / b * 100);
  const fmt = n => n.toLocaleString("en");

  /* ---------- Data copied from docs/ai-path/runs/s4-tiny-gpt/tiny_gpt.out.txt ---------- */
  const COMBOS = 8932, N_TRAIN = 600, N_VAL = 100;               // kind "data"
  const FIRST_TRAIN = ["Larkbury Grove", "Ivyside Crescent", "Southford Walk", "Abbeywood Gardens", "Brookton Walk", "Rowanfield Crescent", "Cedarlands Grove", "Chapelside Way"];
  const V = 48;                                                  // kind "vocab": 46 letters, the space, and \n
  const PARAMS = 157808, BLOCK = 24, N_EMBD = 64, N_LAYER = 3;   // kind "model"
  const EX = { x: "n Street\nMarketbury Road", y: " Street\nMarketbury Road\n" }; // kind "example"
  const BATCH_SHAPE = [32, 24];                                  // kind "shapes", idx
  const SHAPES = [["x = tok_emb + pos_emb", [32, 24, 64]], ["after block 1", [32, 24, 64]], ["after block 2", [32, 24, 64]], ["after block 3", [32, 24, 64]], ["logits = head(x)", [32, 24, 48]]];
  // kind "log": [step, train loss, validation loss, copies of list names in 100 samples at temperature 1.0]
  const LOG = [[0, 4.0592, 4.0537, 0], [250, 0.7005, 0.7716, 8], [500, 0.6393, 0.7676, 10], [750, 0.6042, 0.788, 22], [1000, 0.5638, 0.8355, 19], [1250, 0.5141, 0.8964, 33], [1500, 0.4653, 0.977, 46], [1750, 0.4308, 1.0815, 55], [2000, 0.3992, 1.161, 69], [2250, 0.3675, 1.1968, 68], [2500, 0.3549, 1.2275, 70], [2750, 0.3339, 1.2434, 78], [3000, 0.3369, 1.3402, 81]];
  const LOG_N = 100;
  // kind "samples": 200 names per checkpoint and temperature; "first" = the first 10, unaltered
  const SAMPLES = {"best@0.5": {"first": ["Birchside Terrace", "Marketgate Walk", "Brookton Walk", "Westford Grove", "Brookdale Walk", "Chapelford Grove", "Brookford Street", "Silvergate Walk", "Abbeylands Walk", "Abbeylands Grove"], "n": 200, "copies": 43, "unique": 161, "well_formed": 200, "new_unique_well": 129}, "best@1.0": {"first": ["Birchton Lane", "Birchside Lane", "Southford Drive", "Ferndale Place", "Swanton Close", "Millton Way", "Hawthornside Place", "Beechbury Terrace", "Stonewood Close", "Stationside Street"], "n": 200, "copies": 27, "unique": 190, "well_formed": 194, "new_unique_well": 158}, "best@1.6": {"first": ["Birbury Rogatlands Walk", "Limedalk Way", "Hwan Terrace", "Millford Place", "Southwood Grove", "Fern Greve", "Greencroft GIve", "Capelside Lane", "Southford Creclaceld Grove", "Garden Walk"], "n": 200, "copies": 12, "unique": 198, "well_formed": 122, "new_unique_well": 108}, "final@0.5": {"first": ["Birchton Grove", "Abbeygate Lane", "Bridgegate Walk", "Birch Walk", "Grangedale Walk", "Fernwood Close", "Chapelton Lane", "Yorkton Grove", "Stationfield Gardens", "Limedale Street"], "n": 200, "copies": 191, "unique": 102, "well_formed": 198, "new_unique_well": 7}, "final@1.0": {"first": ["Birchton Terrace", "ChapelsLondale Close", "Orchard Way", "Millton Place", "Schardwood Grove", "Fern Walk", "Swandale Way", "Ivylands Road", "Limesioldale Gardens", "Stationside Drive"], "n": 200, "copies": 158, "unique": 158, "well_formed": 194, "new_unique_well": 35}, "final@1.6": {"first": ["Birchton Terrace", "ChapelsLondale Way", "Mewton Close", "Brookford Place", "Southwood Grove", "Fern Walk", "Swandale Row", "Ivylands Road", "geford Road", "Brookdale Gardens"], "n": 200, "copies": 85, "unique": 189, "well_formed": 175, "new_unique_well": 90}};
  // kind "logits": the best checkpoint's score for every next character after "Ashford ", highest first
  const SCORES = {"G": 6.869, "C": 6.574, "R": 6.229, "W": 6.127, "P": 6.011, "T": 5.466, "A": 5.439, "D": 5.398, "S": 5.355, "L": 5.336, "B": 1.611, "H": 1.275, "O": 0.89, " ": 0.875, "n": 0.768, "V": 0.736, "F": 0.488, "K": 0.461, "M": 0.39, "Y": 0.098, "i": 0.054, "I": -0.081, "N": -0.114, "E": -0.122, "e": -0.405, "\\n": -0.7, "c": -0.746, "m": -1.175, "Q": -1.261, "p": -1.365, "z": -1.635, "g": -1.8, "k": -1.806, "d": -1.85, "b": -1.852, "v": -1.928, "a": -2.053, "x": -2.095, "h": -2.276, "f": -2.283, "r": -2.36, "s": -2.593, "y": -3.145, "l": -3.535, "o": -3.729, "u": -3.794, "w": -4.35, "t": -4.357};
  const TYPES = ["Street", "Road", "Lane", "Avenue", "Close", "Way", "Drive", "Crescent", "Grove", "Place", "Gardens", "Terrace", "Row", "Walk"]; // tiny_gpt.py TYPES

  /* ---------- From docs/ai-path/runs/s4-tiny-gpt/sample_by_hand.out.txt ---------- */
  const DRAW = 0.8444218515250481;          // random.Random(0).random()
  const RESULT_T1 = "D", RESULT_T05 = "P";  // what sample_next returned at temperature 1.0 and 0.5
  // trace at temperature 0.5: [line about to run, event (l line, r return), top, total, running, ch, p]
  const TRACE05 = [[1, "l", null, null, null, null, null], [2, "l", null, null, null, null, null], [3, "l", 13.738, null, null, null, null], [4, "l", 13.738, null, null, null, null], [5, "l", 13.738, 2.5044500077565877, null, null, null], [6, "l", 13.738, 2.5044500077565877, null, null, null], [7, "l", 13.738, 2.5044500077565877, 0.0, null, null], [8, "l", 13.738, 2.5044500077565877, 0.0, "G", 0.3992892638714599], [9, "l", 13.738, 2.5044500077565877, 0.3992892638714599, "G", 0.3992892638714599], [7, "l", 13.738, 2.5044500077565877, 0.3992892638714599, "G", 0.3992892638714599], [8, "l", 13.738, 2.5044500077565877, 0.3992892638714599, "C", 0.2213369334655065], [9, "l", 13.738, 2.5044500077565877, 0.6206261973369664, "C", 0.2213369334655065], [7, "l", 13.738, 2.5044500077565877, 0.6206261973369664, "C", 0.2213369334655065], [8, "l", 13.738, 2.5044500077565877, 0.6206261973369664, "R", 0.11101730902676389], [9, "l", 13.738, 2.5044500077565877, 0.7316435063637303, "R", 0.11101730902676389], [7, "l", 13.738, 2.5044500077565877, 0.7316435063637303, "R", 0.11101730902676389], [8, "l", 13.738, 2.5044500077565877, 0.7316435063637303, "W", 0.09053043806179725], [9, "l", 13.738, 2.5044500077565877, 0.8221739444255276, "W", 0.09053043806179725], [7, "l", 13.738, 2.5044500077565877, 0.8221739444255276, "W", 0.09053043806179725], [8, "l", 13.738, 2.5044500077565877, 0.8221739444255276, "P", 0.07178575990235803], [9, "l", 13.738, 2.5044500077565877, 0.8939597043278856, "P", 0.07178575990235803], [10, "l", 13.738, 2.5044500077565877, 0.8939597043278856, "P", 0.07178575990235803], [10, "r", 13.738, 2.5044500077565877, 0.8939597043278856, "P", 0.07178575990235803]];

  /* ---------- Listings (from the run scripts) ---------- */
  // TinyGPT.forward from tiny_gpt.py, with the run's shape-printing lines left out and one long line wrapped to fit a phone
  const FORWARD = [
    "def forward(self, idx):",
    "    B, T = idx.shape",
    "    x = self.tok_emb(idx) + \\",
    "        self.pos_emb(torch.arange(T))",
    "    for block in self.blocks:",
    "        x = block(x)",
    "    x = self.ln_f(x)",
    "    return self.head(x)"
  ];
  // the training loop from tiny_gpt.py; the logging lines inside the if are cut, one long line wrapped to fit a phone
  const TRAIN = [
    "for step in range(STEPS + 1):",
    "    if step % EVERY == 0:",
    "        ...  # logging, cut",
    "    x, y = get_batch(train_text)",
    "    logits = model(x)",
    "    loss = F.cross_entropy(",
    "        logits.view(-1, V), y.view(-1))",
    "    opt.zero_grad()",
    "    loss.backward()",
    "    opt.step()"
  ];
  // sample_next from sample_by_hand.py, line for line (line 0 = def)
  const SAMPLER = [
    "def sample_next(scores, temperature, draw):",
    "    scaled = {ch: s / temperature for ch, s in scores.items()}",
    "    top = max(scaled.values())",
    "    weights = {ch: math.exp(s - top) for ch, s in scaled.items()}",
    "    total = sum(weights.values())",
    "    probs = {ch: w / total for ch, w in weights.items()}",
    "    running = 0.0",
    "    for ch, p in probs.items():",
    "        running += p",
    "        if draw < running:",
    "            return ch",
    "    return ch"
  ];
  // make_name from tiny_gpt.py
  const MAKE = [
    "@torch.no_grad()",
    "def make_name(model, temperature):",
    "    idx = torch.tensor([[stoi[\"\\n\"]]])",
    "    while True:",
    "        logits = model(idx[:, -BLOCK:])[:, -1, :]",
    "        probs = F.softmax(logits / temperature, dim=-1)",
    "        nxt = torch.multinomial(probs, num_samples=1)",
    "        if nxt.item() == stoi[\"\\n\"] or idx.shape[1] > 40: break",
    "        idx = torch.cat([idx, nxt], dim=1)",
    "    return decode(idx[0, 1:].tolist())"
  ];

  /* ---------- Derived from the data ---------- */
  const LN_V = Math.log(V);
  const START = LOG[0][1];
  const BEST = LOG.reduce((b, r) => r[2] < b[2] ? r : b, LOG[0]);
  const LAST = LOG[LOG.length - 1];
  const BEST_I = LOG.indexOf(BEST);
  const MINTR = LOG.reduce((b, r) => r[1] < b[1] ? r : b, LOG[0]); // lowest train loss (not the last step)
  const BASE_COPY = pct(N_TRAIN, COMBOS); // a model that picked combinations evenly would hit the list this often
  const softmaxT = T => {
    const sc = Object.entries(SCORES).map(([c, s]) => [c, s / T]);
    const top = Math.max(...sc.map(x => x[1]));
    const w = sc.map(([c, s]) => [c, Math.exp(s - top)]);
    const tot = w.reduce((a, x) => a + x[1], 0);
    return Object.fromEntries(w.map(([c, x]) => [c, x / tot]));
  };
  const P05 = softmaxT(0.5), P10 = softmaxT(1.0);
  const LETTERS = Object.keys(SCORES);
  const TOP10 = LETTERS.slice(0, 10);
  const pickWith = probs => { let run = 0; for (const c of LETTERS) { run += probs[c]; if (DRAW < run) return c; } return LETTERS[LETTERS.length - 1]; };
  const rest = (probs, keys) => 1 - keys.reduce((a, c) => a + probs[c], 0);
  const typeOf = n => n.split(" ").length === 2 && TYPES.includes(n.split(" ")[1]) ? n.split(" ")[1] : null;
  const shapeTxt = s => `(${s.join(", ")})`;
  const showCh = c => c === " " ? "␣" : c === "\n" ? "↵" : c;
  const showStr = s => [...s].map(showCh).join("");

  /* ---------- Lesson-local style ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}names { margin: 12px 0 10px; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; }
      .${P}names li { font: 500 14.5px/1.5 var(--mono); color: var(--ink); overflow-wrap: anywhere; padding: 4px 0; border-bottom: 1px solid var(--line); }
      .${P}tbl { width: 100%; border-collapse: collapse; margin: 12px 0 0; font: 500 14px/1.4 var(--mono); }
      .${P}tbl caption { text-align: left; font: 600 13px var(--font); color: var(--muted); padding-bottom: 4px; }
      .${P}tbl th { text-align: right; font: 600 12.5px/1.3 var(--font); color: var(--muted); padding: 4px 6px; border-bottom: 1px solid var(--line); }
      .${P}tbl td { text-align: right; padding: 5px 6px; border-bottom: 1px solid var(--line); color: var(--ink); }
      .${P}tbl th:first-child, .${P}tbl td:first-child { text-align: left; }
      .${P}tbl tr.on td { font-weight: 700; }
      .${P}tbl tr.on td:first-child { box-shadow: inset 3px 0 0 var(--ink); padding-left: 9px; }
      .${P}tbl tr.hid td { color: var(--faint); }
      .${P}seq { margin: 10px 0 0; font: 500 15px/1.5 var(--mono); }
      .${P}seq div { display: flex; flex-wrap: wrap; gap: 2px; margin: 4px 0; align-items: center; }
      .${P}seq b { font: 600 12.5px var(--font); color: var(--muted); width: 4.5em; }
      .${P}seq span { display: inline-block; min-width: 1.15em; text-align: center; border: 1px solid var(--line); border-radius: 3px; padding: 1px 2px; background: var(--surface); }
      .${P}opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .${P}set { margin: 16px 0 0; padding: 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--surface); }
      .${P}set h3 { margin: 0; font: 600 15px var(--font); }
      .${P}cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { border-top: 1px solid var(--line); }
      .${P}check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .${P}check label span { padding-top: 10px; }
      .${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .${P}check input:checked { background-color: var(--good); outline-color: var(--good); }
      @media (max-width: 480px) {
        .${P}tbl { font-size: 12.5px; }
        .${P}tbl th { font-size: 11.5px; padding: 4px 3px; }
        .${P}tbl td { padding: 5px 3px; }
        .${P}names li { font-size: 13px; }
      }
    `;
    document.head.appendChild(s);
  }
  const names = (kit, list) => `<ul class="${P}names">${list.map(n => `<li>${kit.esc(n)}</li>`).join("")}</ul>`;
  // rows: arrays of cell strings (already escaped or numbers); o.on / o.hid: row index sets
  const tbl = (head, rows, { caption = "", on = -1, hid = () => false } = {}) =>
    `<table class="${P}tbl">${caption ? `<caption>${caption}</caption>` : ""}<thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) =>
      `<tr class="${i === on ? "on" : ""}${hid(i) ? " hid" : ""}">${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }
  // a one-question screen: paint(ans) returns the page; right = index of the right option
  function oneQ(el, done, right, paint) {
    let ans = null;
    const draw = () => {
      el.innerHTML = paint(ans);
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; draw(); if (ans === right) done(); });
    };
    draw();
  }

  /* 1. The situation, and the first by-hand task: the loss before any training. */
  function startLoss({ el, done, kit }) {
    ensureStyle();
    const opts = [`${V}`, `about ${f2(LN_V)}`, `about ${f3(1 / V)}`, "0"];
    const R = 1;
    const fb = [
      [`${V} is how many characters there are, not a loss. The loss is the average of −ln(probability the model gave the right next character). A guess spread evenly over ${V} characters gives each one 1/${V}.`, false],
      [`Right. Random weights spread the guess roughly evenly, so the right character gets about 1/${V}, and −ln(1/${V}) = ln ${V} ≈ ${f2(LN_V)}. The run printed <b>${f2(START)}</b> at step 0: close, a little higher, because random weights are not perfectly even. A start far above ln(vocabulary size) usually means a bug, such as initial weights that are too large (the model is confidently wrong) or a head that scores more classes than the vocabulary has.`, true],
      [`1/${V} ≈ ${f3(1 / V)} is the <i>probability</i> an even guess gives the right character. The loss is −ln of that probability, so it is a number above 1 here, not a tiny one.`, false],
      ["A loss of 0 means the model gives the right next character probability 1 every time. Before training, it knows nothing about street names.", false]
    ];
    oneQ(el, done, R, ans => `<h1>Fake streets for a map app</h1>
      <p class="lead">A map app team needs thousands of street names for test data: realistic-looking, but not real, so that no test screenshot shows a real address. They have a list of street names and want a small model that writes new ones, one character at a time. You will build that model: a tiny GPT, the same kind of model as the large ones you call through LangChain, only small enough to train on a laptop. In this lesson's run, a script built the list from common English street-name parts. ${N_TRAIN} names are for training, and ${N_VAL} are held back for validation. The first few:</p>
      ${names(kit, FIRST_TRAIN)}
      <p class="lead">The names use ${V - 2} different letters, plus the space and an end-of-name mark: <b>${V}</b> characters in all. The model reads some characters and gives each of the ${V} a probability of coming next. The loss is −ln(the probability it gave the right next character), averaged over many predictions. This is the cross-entropy loss you met with loss curves.</p>
      <p class="task">Before any training, with random weights, about what loss will the first step print?</p>
      <div class="lpanel">${ask(kit, opts, R, ans, fb)}</div>`);
  }

  /* 2. One window, many training examples: the target is the input shifted by one. */
  function shiftByOne({ el, done, kit }) {
    ensureStyle();
    const yWrong1 = EX.x, yWrong2 = EX.y.slice(-1);
    const opts = [`<span class="${P}opt">${kit.esc(showStr(yWrong1))}</span>`, `<span class="${P}opt">${kit.esc(showStr(EX.y))}</span>`, `<span class="${P}opt">${kit.esc(showStr(yWrong2))} (only the character after the window)</span>`];
    const R = 1;
    const perBatch = BATCH_SHAPE[0] * BATCH_SHAPE[1];
    const fb = [
      ["That is the input itself. A model that must output its own input learns to copy, not to predict. The target at each place has to be the character that comes <i>next</i>.", false],
      [`Right. The target is the same text moved one place left. Position 1 sees “${kit.esc(showStr(EX.x[0]))}” and must predict “${kit.esc(showStr(EX.y[0]))}”; position ${BLOCK} sees all ${BLOCK} characters and must predict “${kit.esc(showStr(EX.y[BLOCK - 1]))}”. So one window of ${BLOCK} characters is ${BLOCK} training examples, and one batch of ${BATCH_SHAPE[0]} windows is ${fmt(perBatch)}. What stops position 1 from peeking at position 2, which is its answer? The <b>causal mask</b> inside each attention layer: a position may only attend to itself and the positions before it.`, true],
      [`That trains only one of the ${BLOCK} positions and wastes the rest. A GPT predicts the next character at <i>every</i> position at once, because each position only sees the characters before it.`, false]
    ];
    oneQ(el, done, R, ans => `<h1>What does the model learn from one window?</h1>
      <p class="lead">Training does not feed whole names. The script joins all ${N_TRAIN} names into one long text, with ↵ (a new line) after each name, and cuts random windows of ${BLOCK} characters. This window really came out of the run (␣ is a space):</p>
      <div class="${P}seq"><div><b>input x</b>${[...EX.x].map(c => `<span>${kit.esc(showCh(c))}</span>`).join("")}</div></div>
      <p class="task">The target y is the right answer at each position. Which ${BLOCK} characters are the targets for this window?</p>
      <div class="lpanel">${ask(kit, opts, R, ans, fb)}</div>`);
  }

  /* 3. Stack the blocks: shapes through the model. */
  function stackBlocks({ el, done, kit }) {
    ensureStyle();
    const last = SHAPES[SHAPES.length - 1][1];
    const opts = [shapeTxt(SHAPES[0][1]), shapeTxt(last), shapeTxt([last[0], last[2]]), shapeTxt([last[0], SHAPES[0][1][2]])];
    const R = 1;
    const fb = [
      [`${shapeTxt(SHAPES[0][1])} is what flows <i>between</i> blocks: ${N_EMBD} numbers per character. The head's job is to turn those ${N_EMBD} into one score per character of the vocabulary.`, false],
      [`Right: ${shapeTxt(last)}. For each of the ${last[0]} windows and each of the ${last[1]} positions, one score per possible next character, ${last[2]} in all. These raw scores are <b>logits</b>; softmax turns them into probabilities. Notice what the blocks did to the shape: nothing. Each block reads ${shapeTxt(SHAPES[0][1])} and returns the same shape, which is why you can stack ${N_LAYER} or 30 of them. This model has ${fmt(PARAMS)} weights.`, true],
      [`That would be one prediction per window. The model predicts at every position, as on the last screen, so the position dimension (${last[1]}) stays.`, false],
      [`That keeps the block width (${N_EMBD}) and drops the positions. The head maps ${N_EMBD} numbers to ${V} scores, and it does so at every position.`, false]
    ];
    oneQ(el, done, R, ans => `<h1>Stack the blocks</h1>
      <p class="lead">A GPT is the transformer block from the last lesson, repeated. Each character becomes a vector (<code>tok_emb</code>). A learned vector for its position is added (<code>pos_emb</code>). ${N_LAYER} blocks mix information along the window. A final layer norm follows, and a linear layer, the <code>head</code>, scores the next character. This is the model's <code>forward</code> from the run:</p>
      ${kit.code(FORWARD, ans === R ? 7 : 5)}
      <p class="${P}cap">Read a shape as (windows, positions, numbers per position).</p>
      ${tbl(["where", "shape"], [["idx (the input)", shapeTxt(BATCH_SHAPE)], ...SHAPES.map(([n, s], i) => [kit.esc(n), i === SHAPES.length - 1 && ans !== R ? "?" : shapeTxt(s)])], { caption: "Shapes printed during the run" })}
      <p class="task">A batch of ${BATCH_SHAPE[0]} windows of ${BATCH_SHAPE[1]} characters goes in. What shape comes out of <code>head</code>?</p>
      <div class="lpanel">${ask(kit, opts, R, ans, fb)}</div>`);
  }

  /* 4. Train it: predict what validation loss and copies do while train loss keeps falling. */
  function trainIt({ el, done, kit }) {
    ensureStyle();
    const opts = [
      "Validation loss keeps falling with it, and copies stay rare",
      "Validation loss turns and rises, and copies of list names climb",
      "Both losses stop moving; nothing changes after step " + BEST[0],
      "Validation loss rises, but copies stay about where they are"
    ];
    const R = 1;
    const fb = [
      [`That is what you hope for while the model is still learning the <i>pattern</i>. But ${N_TRAIN} names is a small list, and this model has ${fmt(PARAMS)} weights. Think about what it can do with that much room.`, false],
      [`Right. Train loss fell from ${f2(BEST[1])} to ${f2(LAST[1])}, but validation loss rose from ${f2(BEST[2])} to ${f2(LAST[2])}, and copies went from ${BEST[3]} to ${LAST[3]} out of ${LOG_N}. The model is <b>memorising</b> the list: it gets better at the exact names it trains on and worse at names it never saw. For comparison, a model that had learned only the pattern and picked combinations evenly would hit a list name about ${BASE_COPY}% of the time (${N_TRAIN} of ${fmt(COMBOS)} possible combinations).`, true],
      [`Train loss is still going down (${f3(BEST[1])} at step ${BEST[0]}, ${f3(LAST[1])} at step ${LAST[0]}), so the weights are still changing. The question is what they are changing toward.`, false],
      ["A rising validation loss and copies go together here. Lower loss on the training names means the model gives those exact names higher probability, so sampling lands on them more often.", false]
    ];
    oneQ(el, done, R, ans => {
      const shown = ans === R ? LOG : LOG.slice(0, BEST_I + 1);
      return `<h1>Train it, and watch two losses</h1>
      <p class="lead">The training loop is the one you know: batch, forward, loss, backward, step. Every ${LOG[1][0]} steps the run logged the loss on training names, the loss on the ${N_VAL} held-back names, and how many of ${LOG_N} sampled names were exact copies from the list. It ran on a laptop CPU.</p>
      ${kit.code(TRAIN, 5)}
      ${tbl(["step", "train loss", "val loss", `copies / ${LOG_N}`], shown.map(r => [r[0], f3(r[1]), f3(r[2]), r[3]]), { caption: "Training log (recorded)" })}
      ${ans === R ? "" : `<p class="task">Train loss keeps falling for the rest of the run, to about ${f2(LAST[1])} at step ${LAST[0]}. What do you expect from the other two columns?</p>`}
      <div class="lpanel">${ask(kit, opts, R, ans, fb)}</div>`;
    });
  }

  /* 5. Pick the checkpoint to keep. */
  function pickCheckpoint({ el, done, kit }) {
    ensureStyle();
    const mid = LOG[Math.floor((BEST_I + LOG.length - 1) / 2)];
    const opts = [`Step ${MINTR[0]}: lowest train loss`, `Step ${BEST[0]}: lowest validation loss`, `Step ${mid[0]}: halfway`, `Step ${LOG[1][0]}: fewest copies after training starts`];
    const R = 1;
    const fb = [
      [`Lowest train loss is close to the most memorised model: ${MINTR[3]} of ${LOG_N} samples were copies, and its validation loss was ${f3(MINTR[2])}. Train loss measures how well it knows the list, not how well it writes new names.`, false],
      [`Right. Validation loss is measured on names the model never trained on, so it is the score for “writes plausible names it was not shown”. The run saved the weights whenever validation loss hit a new low; the best was step ${BEST[0]} (${f3(BEST[2])}). Stopping there, or keeping that saved copy, is <b>early stopping</b>. The idea is the one from loss curves; what is new is that for a generator, overfitting shows up as copied output.`, true],
      [`At step ${mid[0]} validation loss was already ${f3(mid[2])}, above the best ${f3(BEST[2])}, and ${mid[3]} of ${LOG_N} samples were copies. Halfway is not a rule; the log tells you where to stop.`, false],
      [`${LOG[1][3]} copies against ${BEST[3]} out of ${LOG_N} samples is a difference of ${BEST[3] - LOG[1][3]} names in a small sample: too small to decide on. Validation loss was still falling after step ${LOG[1][0]}, so the model was still learning the pattern.`, false]
    ];
    oneQ(el, done, R, ans => `<h1>Which weights do you ship?</h1>
      <p class="lead">A <b>checkpoint</b> is a saved copy of the model's weights at one training step. The log gives the numbers for each logged step. You may ship only one set of weights for the generator.</p>
      ${tbl(["step", "train loss", "val loss", `copies / ${LOG_N}`], LOG.map(r => [r[0], f3(r[1]), f3(r[2]), r[3]]), { caption: "Training log (recorded)", on: ans === R ? BEST_I : -1 })}
      <p class="task">Which checkpoint do you keep?</p>
      <div class="lpanel">${ask(kit, opts, R, ans, fb)}</div>`);
  }

  /* 6. By hand, part two: match three recorded sample sets to their temperature. */
  const SETS = [["best@1.6", 2], ["best@0.5", 0], ["best@1.0", 1]]; // shown as A, B, C; answer = index in TEMPS
  const TEMPS = ["0.5", "1.0", "1.6"];
  function matchTemps({ el, done, kit }) {
    ensureStyle();
    const ans = SETS.map(() => null);
    const nTypes = k => new Set(SAMPLES[k].first.map(typeOf).filter(Boolean)).size;
    const odd = k => SAMPLES[k].first.filter(n => !typeOf(n)).length;
    const say = (k, pick) => {
      const s = SAMPLES[k], right = TEMPS.indexOf(k.split("@")[1]);
      if (pick === right) {
        if (k === "best@0.5") return [`Right, 0.5. Only ${nTypes(k)} street types in ten names, and the same roots again and again: the model keeps taking its favourite next letter.`, true];
        if (k === "best@1.6") return [`Right, 1.6. Misspelled roots, and ${odd(k)} of ten are not one root plus one real street type (“${kit.esc(s.first[0])}”, “${kit.esc(s.first[6])}”): unlikely letters get picked often enough to break words.`, true];
        return [`Right, 1.0: varied (${nTypes(k)} street types in ten names) and still spelled correctly.`, true];
      }
      if (k === "best@1.6") return [`These contain broken words such as “${kit.esc(s.first[2])}” and “${kit.esc(s.first[5])}”. A lower temperature makes the top letters even more likely, so it would not produce misspellings this often.`, false];
      if (k === "best@0.5") return [`Look at the variety: only ${nTypes(k)} street types in ten names, with roots like Brook and Abbeylands repeating. ${pick === 2 ? "A high temperature would spread the picks out and break some words." : "That is less variety than the middle setting gives."}`, false];
      return [pick === 2 ? `All ten are spelled correctly. At the highest temperature, unlikely letters get through and break words.` : `This set uses ${nTypes(k)} different street types in ten names. At the lowest temperature the model keeps choosing the same few favourites.`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>Match the temperature</h1>
        <p class="lead">To write a name, the model scores the next character, turns the scores into probabilities, draws one, and repeats until the end mark. Before the scores become probabilities, they are divided by a number called the <b>temperature</b>. At 1.0 they stay as they are. The kept checkpoint (step ${BEST[0]}) wrote 200 names at each of three temperatures. Here are the first ten of each set, unaltered.</p>
        <p class="task">Which temperature produced each set? Pick again if you change your mind.</p>
        ${SETS.map(([k, right], i) => `<div class="${P}set lcase" id="c${i}"><h3>Set ${"ABC"[i]}</h3>${names(kit, SAMPLES[k].first)}${kit.options(TEMPS, { picked: ans[i], correct: right, num: true })}${ans[i] == null ? "" : kit.feedback(...say(k, ans[i]))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SETS.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 7. Spot the idea: why low temperature copies more. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    const lo = SAMPLES["best@0.5"], mid = SAMPLES["best@1.0"], hi = SAMPLES["best@1.6"];
    const opts = [
      "Low temperature changes the model's weights back toward the training list",
      "Dividing by a number below 1 widens the gaps between scores, so the likeliest letters win even more often, and the likeliest paths are names the model saw",
      "Low temperature makes the model read a shorter window, so it forgets the start of the name",
      "Sampling at low temperature has a bug that skips the random draw"
    ];
    const R = 1;
    const fb = [
      ["Temperature never touches the weights. The same checkpoint made all three sets; only the sampling step changed.", false],
      [`Right. A score gap of 1 becomes a gap of 2 at temperature 0.5, so the top choices take more of the probability. The likeliest paths through this model are the names it trained on, because training raised their probability. So at 0.5: ${lo.copies} copies and ${lo.unique} different names out of ${lo.n}; at 1.0: ${mid.copies} copies and ${mid.unique} different. At 1.6 copies fall to ${hi.copies}, but only ${hi.well_formed} of ${hi.n} names are well formed. Temperature trades “safe but repetitive” against “new but broken”. Temperature 1.0 samples from the model's own probabilities.`, true],
      ["The window is the same at every temperature: up to the last 24 characters. Temperature only changes how the next-letter scores become probabilities.", false],
      ["The draw still happens at 0.5; that is why the set still varies a little. Only at temperature near 0 does sampling become “always take the top letter”.", false]
    ];
    oneQ(el, done, R, ans => `<h1>Why does a low temperature copy more?</h1>
      ${tbl(["temperature", "copies", "different names", "well formed"], [["0.5", lo.copies, lo.unique, lo.well_formed], ["1.0", mid.copies, mid.unique, mid.well_formed], ["1.6", hi.copies, hi.unique, hi.well_formed]], { caption: `Kept checkpoint, ${lo.n} names per temperature (recorded)` })}
      <p class="lead">“Well formed” means one space and a known street type at the end. Same weights in every row.</p>
      <p class="task">Why does the lowest temperature give the most copies of the list?</p>
      <div class="lpanel">${ask(kit, opts, R, ans, fb)}</div>`);
  }

  /* 8. Temperature sampling from scratch, stepped, then a prediction at temperature 1.0. */
  const FR = TRACE05.map(r => ({ ln: r[0], ret: r[1] === "r", top: r[2], total: r[3], running: r[4], ch: r[5], p: r[6] }));
  function fromScratch({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null, reached = false;
    const opts = ["G", RESULT_T05, RESULT_T1, "B"];
    const R = opts.indexOf(RESULT_T1);
    const cum = []; { let run = 0; for (const c of TOP10) { run += P10[c]; cum.push([c, run]); } }
    const fb = [
      [`G is the most likely letter, but the draw is ${f3(DRAW)}, high up the line. Add the T = 1.0 probabilities from the top until the total passes ${f3(DRAW)}.`, false],
      [`P won at 0.5, where the top letters took more of the line. At 1.0 the top five letters together reach only ${f3(cum[4][1])}, below the draw ${f3(DRAW)}, so the walk goes further.`, false],
      [`Right: the recorded run returned “${RESULT_T1}”. Running totals at 1.0: ${cum.slice(0, 8).map(([c, x]) => `${c} ${f3(x)}`).join(", ")}; ${RESULT_T1} is the first to pass ${f3(DRAW)}. The same random number picked a less likely letter at the higher temperature. In PyTorch, lines 1 to 5 are <code>F.softmax(logits / temperature, dim=-1)</code> and the loop is <code>torch.multinomial</code>.`, true],
      [`B's probability at 1.0 is ${f3(P10.B)}. The ten likely letters together already pass the draw long before B: their total is ${f3(cum[9][1])}.`, false]
    ];
    const sayFrame = f => {
      if (f.ret) return `<code>draw</code> ${f3(DRAW)} < <code>running</code> ${f3(f.running)}: the function returns “${kit.esc(f.ch)}”.`;
      switch (f.ln) {
        case 1: return `About to divide all ${LETTERS.length} scores by <code>temperature</code> = 0.5. <code>draw</code> = ${f3(DRAW)} is a random number between 0 and 1, from a seeded generator.`;
        case 2: return `Line 1 divided each score by 0.5: G's ${f3(SCORES.G)} became ${f3(SCORES.G / 0.5)}. Gaps between scores doubled.`;
        case 3: return `Line 2 found the largest scaled score: <code>top</code> = ${f3(f.top)}.`;
        case 4: return `Line 3 turned each scaled score into a weight e^(score − top). G gets e^0 = 1, every other letter less than 1. Subtracting <code>top</code> keeps the numbers small; it does not change the result.`;
        case 5: return `Line 4 added the weights: <code>total</code> = ${f3(f.total)}.`;
        case 6: return `Line 5 divided each weight by the total, so the ${LETTERS.length} probabilities add up to 1. That is softmax. The table shows them.`;
        case 7: return f.running === 0 ? `<code>running</code> starts at 0. The loop walks the letters in the order the scores came, highest first, adding up their probabilities.` : `“${kit.esc(f.ch)}”: ${f3(DRAW)} is not below ${f3(f.running)}, so on to the next letter.`;
        case 8: return `Next letter “${kit.esc(f.ch)}” with probability ${f3(f.p)}.`;
        case 9: return `<code>running</code> is now ${f3(f.running)}. Is the draw ${f3(DRAW)} below it?`;
        case 10: return `${f3(DRAW)} < ${f3(f.running)}: yes, line 10 runs.`;
      }
      return "";
    };
    const paint = () => {
      const f = FR[i], last = i === FR.length - 1;
      el.innerHTML = `<h1>Sampling with temperature, from scratch</h1>
        <p class="lead">The kept checkpoint has read “Ashford␣”. It gave a score to each of the ${LETTERS.length} characters (the real scores from the run). Ten letters start a street type (G for Grove, C for Close); the rest score far lower. Here is sampling in plain Python, run at temperature 0.5 and traced. The loop lays the probabilities end to end on a line from 0 to 1, and returns the letter where the random draw lands.</p>
        ${kit.code(SAMPLER, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>top <b>${f.top == null ? "–" : f3(f.top)}</b></span><span>total <b>${f.total == null ? "–" : f3(f.total)}</b></span><span>running <b>${f.running == null ? "–" : f3(f.running)}</b></span><span>ch <b>${f.ch == null ? "–" : kit.esc(f.ch)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f))}
        ${tbl(["letter", "score", "p at T 0.5", "p at T 1.0"], [...TOP10.map(c => [c, f3(SCORES[c]), f3(P05[c]), f3(P10[c])]), [`${LETTERS.length - TOP10.length} others`, "", small(rest(P05, TOP10)), small(rest(P10, TOP10))]], { caption: "Probabilities, computed from the run's scores", on: f.ch ? TOP10.indexOf(f.ch) : -1 })}
        <p class="task">Step to the end. Then: with the same draw ${f3(DRAW)} at temperature 1.0, which letter comes out?</p>
        <div class="lpanel">${ask(kit, opts, R, ans, fb)}</div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; if (i === FR.length - 1) reached = true; paint(); if (reached && ans === R) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (reached && ans === R) done(); });
    };
    paint();
  }

  /* 9. Ship it: the PyTorch generator, a filter, and the pipeline that gives the most usable names. */
  const PIPES = [["final@0.5", `Step ${LAST[0]} weights, temperature 0.5`], ["best@1.0", `Step ${BEST[0]} weights, temperature 1.0`], ["best@1.6", `Step ${BEST[0]} weights, temperature 1.6`], ["final@1.0", `Step ${LAST[0]} weights, temperature 1.0`]];
  function shipIt({ el, done, kit }) {
    ensureStyle();
    const R = PIPES.reduce((b, p, i) => SAMPLES[p[0]].new_unique_well > SAMPLES[PIPES[b][0]].new_unique_well ? i : b, 0);
    const S = k => SAMPLES[k];
    const fb = PIPES.map(([k], i) => i === R
      ? [`Right: ${S(k).new_unique_well} usable names from ${S(k).n}. The other settings: ${PIPES.filter((_, j) => j !== R).map(([k2, l]) => `${l.toLowerCase()}: ${S(k2).new_unique_well}`).join("; ")}. Even the best setting copied ${S(k).copies} names from the list, so the filter is not optional: with any generator trained on real data, check every output against the training list before you use it.`, true]
      : k === "final@0.5" ? [`The memorised weights at a low temperature: ${S(k).copies} of ${S(k).n} names were copies, leaving ${S(k).new_unique_well} usable. Every setting that favours the model's favourite paths hands back the list.`, false]
      : k === "best@1.6" ? [`Few copies (${S(k).copies}), but only ${S(k).well_formed} of ${S(k).n} names were well formed, so the filter threw away many broken ones: ${S(k).new_unique_well} left.`, false]
      : [`Temperature 1.0 is fine, but these are the memorised weights: ${S(k).copies} of ${S(k).n} were copies, ${S(k).new_unique_well} usable.`, false]);
    oneQ(el, done, R, ans => `<h1>Ship it: generate, then filter</h1>
      <p class="lead">This is the generator from the run, in PyTorch. It starts from the end mark and asks the model for scores at the last position. It divides them by the temperature and draws a character with <code>torch.multinomial</code> (a random pick by probability). It stops at the next end mark. Libraries expose the same knob: Hugging Face's <code>generate</code> takes <code>temperature</code> together with <code>do_sample=True</code>. Without sampling, it always takes the top token. The team keeps a name only if it is <b>new</b> (not in the list), <b>well formed</b>, and <b>not a repeat</b> of one already kept. A name that passes all three is <b>usable</b>.</p>
      ${kit.code(MAKE, 5)}
      ${ans === R ? tbl(["setting", "copies", "usable"], PIPES.map(([k, l]) => [kit.esc(l), S(k).copies, S(k).new_unique_well]), { caption: `${S(PIPES[0][0]).n} names per setting, after the filter (recorded)`, on: R }) : ""}
      <p class="task">Each setting wrote ${S(PIPES[0][0]).n} names. Which one leaves the most usable names after the filter?</p>
      <div class="lpanel">${ask(kit, PIPES.map(p => kit.esc(p[1])), R, ans, fb)}</div>`);
  }

  /* 10. The big picture: when a small model is enough. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const opts = [
      "A help-desk team wants a bot that answers customers' questions about their invoices",
      "A shipping game needs 50,000 made-up cargo ship names; the studio has a list of 8,000 real ones",
      "A form needs test postcodes that follow one fixed pattern: two letters, then four digits"
    ];
    const R = 1;
    const fb = [
      ["Answering questions needs language understanding and knowledge that a model trained on a few thousand short strings never sees. Use a large pretrained model through an API (with retrieval for the invoice data), not one you train from zero.", false],
      ["Right. Short strings with a style but no fixed rule, thousands of examples, and a need for many outputs: a tiny GPT trained on a laptop CPU, then early stopping, temperature near 1 and a filter against the real list.", true],
      ["A fixed pattern is a rule. Random letters and digits in that pattern give exactly valid postcodes, every time, for free. A model can only learn the pattern approximately, and it may copy real postcodes it trained on.", false]
    ];
    oneQ(el, done, R, ans => `<h1>When is a small model enough?</h1>
      <p class="lead"><b>What it is:</b> a small next-character model that you train yourself on your own list. <b>For:</b> short strings with a style but no simple rule (names, product codes in a house style) when you have thousands of examples. <b>Reach for it</b> when you need many outputs offline, cheaply, and the data must stay with you. <b>Not</b> when a rule or template does the job exactly, when the list is too small to learn from (it will copy), or when the output needs meaning or world knowledge: use a large pretrained model instead. <b>Costs:</b> collecting and cleaning the data, training runs to tune, a check for memorisation on every model, and a filter on every output. A model that memorises can leak private rows from its training data.</p>
      <p class="task">Which of these is a job for a tiny GPT you train yourself?</p>
      <div class="lpanel">${ask(kit, opts, R, ans, fb)}</div>`);
  }

  /* 11. Recognise it in new situations. */
  const CASES = [
    ["A demo HR database needs fake employee surnames. You have 3,000 real surnames from past staff, and no real employee may appear in the demo.", true,
      "Yes, with care. Thousands of short strings with a style: a tiny GPT learns it. Because the surnames are real people's, early stopping and a filter against the list are required, not nice to have.",
      "This is the shape a tiny GPT is good at: thousands of short strings, many outputs needed. The real names in the list are the reason to add a filter, not a reason to avoid the model."],
    ["A test suite needs random but valid email addresses on the domain example.com.", false,
      "No. Valid email addresses follow a rule you can write in one line: random letters, then @example.com. A rule gives valid output every time; a learned model gives mostly valid output and needs training data you do not need.",
      "There is no style to learn, only a format. Code that fills the format is exact, instant and free. A model would only approximate the format."],
    ["A shop wants a two-sentence description for each of 4,000 products, written from each product's attribute list.", false,
      "No. Each description must say true things about one product in fluent sentences. A character model trained on short strings knows no meaning; a large pretrained model, given the attributes in the prompt, can do this.",
      "A tiny model trained from zero on a few thousand strings cannot write fluent, factual sentences about a product. This needs a pretrained language model, with the attributes in the prompt."],
    ["A fantasy map generator needs new town names that sound like the 5,000 towns of one real country.", true,
      "Yes. Thousands of examples, a sound but no rule, short outputs, many needed: a tiny GPT at a temperature near 1, with the real towns filtered out.",
      "There is no rule that captures how town names in one country sound, but 5,000 examples are enough for a small model to learn it. Filter out the real towns."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Tiny GPT or not?</h1>
        <p class="lead">Four requests from other teams.</p>
        <p class="task">Would you train a tiny GPT for each? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const firstCopy = LOG.find(r => r[0] > BEST[0] && r[3] >= 2 * BEST[3]);
    const CHECK = [
      `The loss printed at step 0 is near ln ${V} ≈ ${f2(LN_V)} (our run: ${f2(START)}).`,
      `Train loss keeps going down after that (ours: ${f3(BEST[1])} at step ${BEST[0]}, ${f3(LAST[1])} at step ${LAST[0]}).`,
      `Validation loss reaches its lowest early (ours: ${f3(BEST[2])} at step ${BEST[0]}) and then rises (${f3(LAST[2])} at step ${LAST[0]}).`,
      `Copies of list names in the log climb after that (ours: ${BEST[3]} of ${LOG_N} at step ${BEST[0]}, ${firstCopy ? `${firstCopy[3]} at step ${firstCopy[0]}, ` : ""}${LAST[3]} at step ${LAST[0]}).`,
      `At temperature 1.6 some names are misspelled; at 0.5 the same few street types repeat.`
    ];
    el.innerHTML = `<h1>You built a GPT</h1>
      <p class="lead">You stacked blocks into a character model, predicted its starting loss, saw it memorise the list while validation loss rose, kept the best weights, and sampled with temperature by hand.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a>.` : "The notebook for this lesson is on its way."} It builds and trains the same model on the same list. What you should see, from our run (yours may differ a little):</p>
      <ul class="${P}check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You trained a model that only reads left to right to write; next you meet one that reads both sides of a gap, and when each kind is the right pick.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Build, train and sample a tiny GPT",
    checked: "2026-11-14",
    sources: [
      "https://arxiv.org/abs/1706.03762",
      "https://arxiv.org/abs/1503.02531",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.functional.cross_entropy.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.functional.scaled_dot_product_attention.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.multinomial.html",
      "https://huggingface.co/docs/transformers/main_classes/text_generation"
    ],
    interview: [
      {
        q: "You trained a small model to generate synthetic customer names for test data. A colleague notices some outputs are real customers from the training set. What do you check and change?",
        good: [
          "Compare train and validation loss over training: validation rising while train falls means it is memorising",
          "Go back to the checkpoint with the lowest validation loss (early stopping), or use a smaller model or more data",
          "Check the sampling temperature: a low temperature favours the most likely paths, which are training rows",
          "Filter every output against the training set before it is used, and measure the copy rate",
          "Treat it as a privacy issue: a model trained on real people can leak them"
        ],
        weak: "Lower the temperature to make the outputs more “accurate”. That makes copies more likely, not less."
      },
      {
        q: "A new character model prints a loss of 9.5 on its first training step, with a vocabulary of 60 characters. Is that a problem?",
        good: [
          "An untrained model should start near ln(vocabulary size): ln 60 is about 4.1",
          "9.5 means it is confidently wrong before learning anything",
          "Check the initial weights: an output layer with large weights makes confident random guesses",
          "Check that the head's output size is the vocabulary size: ln of about 13,000 classes is 9.5",
          "Before a long run, check the model can drive the loss down on one small batch"
        ],
        weak: "Say losses start high and will come down with training, without knowing what the starting value should be."
      }
    ],
    screens: [startLoss, shiftByOne, stackBlocks, trainIt, pickCheckpoint, matchTemps, spotIdea, fromScratch, shipIt, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SETS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: [...Array(TRACE05.length - 1).fill("[data-next]"), "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
