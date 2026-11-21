/* Lesson: self-attention, multiple heads and the causal mask. Story: a subtitle tool for live football commentary
   guesses the next word and must not peek at what the commentator says later.
   Ideas: (1) causal self-attention: every word scores every word, the scores of later words are set to -inf before
   softmax, so each word mixes only itself and the words before it; scores are divided by sqrt(d);
   (2) several heads: split the width into heads, attend in each, concatenate. Debug: a mask that leaks one word.
   Data, all real (no model recordings in this lesson):
   - docs/ai-path/runs/s4-self-attention/scratch_attention.py + .out.txt: the 9-line NumPy function, traced line by
     line on 5 words with 4 numbers each (seed 0), and the sqrt(d) experiment (seed 1, 2000 tries);
   - heads.py + heads.out.txt: the multi-head function traced for shapes (5 words, d_model 8, 2 heads, seed 0);
   - leak_train.py + leak_train.out.txt: two tiny PyTorch next-word models, correct mask and leaky mask (diagonal=2);
   - mask_variants.py + mask_variants.out.txt: what each candidate fix blocks, and softmax of a fully blocked row.
   Lesson-local style: a small results table and code lines that wrap at phone width (.lx-s4-self-attention-*), see ensureStyle() and codeW(). Plain browser script. */
(() => {
  const ID = "s4-self-attention";
  const f2 = x => typeof x === "string" ? x : x.toFixed(2);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const shp = a => `(${a.join(", ")})`;

  /* ---------- Data copied from the runs ---------- */
  // scratch_attention.out.txt: WORDS, and the trace rows [line about to run, event, T, d, q.shape, scores, weights]
  const WORDS = ["the", "striker", "shoots", "and", "scores"];
  const TRACE1 = [[1,"l",null,null,null,null,null],[2,"l",5,4,null,null,null],[3,"l",5,4,[5,4],null,null],[4,"l",5,4,[5,4],[[-0.35,-0.85,0.16,0.94,-0.54],[-0.83,-1.88,1.95,3.32,-0.33],[1.43,1.36,-4.57,-6.51,-2.04],[1.37,0.98,0.9,-2.57,0.39],[0.27,-0.03,-1.7,-1.79,-1.12]],null],[5,"l",5,4,[5,4],[[-0.35,-0.85,0.16,0.94,-0.54],[-0.83,-1.88,1.95,3.32,-0.33],[1.43,1.36,-4.57,-6.51,-2.04],[1.37,0.98,0.9,-2.57,0.39],[0.27,-0.03,-1.7,-1.79,-1.12]],null],[6,"l",5,4,[5,4],[[-0.35,"-inf","-inf","-inf","-inf"],[-0.83,-1.88,"-inf","-inf","-inf"],[1.43,1.36,-4.57,"-inf","-inf"],[1.37,0.98,0.9,-2.57,"-inf"],[0.27,-0.03,-1.7,-1.79,-1.12]],null],[7,"l",5,4,[5,4],[[-0.35,"-inf","-inf","-inf","-inf"],[-0.83,-1.88,"-inf","-inf","-inf"],[1.43,1.36,-4.57,"-inf","-inf"],[1.37,0.98,0.9,-2.57,"-inf"],[0.27,-0.03,-1.7,-1.79,-1.12]],[[1.0,0.0,0.0,0.0,0.0],[1.0,0.35,0.0,0.0,0.0],[1.0,0.94,0.0,0.0,0.0],[1.0,0.68,0.63,0.02,0.0],[1.0,0.74,0.14,0.13,0.25]]],[8,"l",5,4,[5,4],[[-0.35,"-inf","-inf","-inf","-inf"],[-0.83,-1.88,"-inf","-inf","-inf"],[1.43,1.36,-4.57,"-inf","-inf"],[1.37,0.98,0.9,-2.57,"-inf"],[0.27,-0.03,-1.7,-1.79,-1.12]],[[1.0,0.0,0.0,0.0,0.0],[0.74,0.26,0.0,0.0,0.0],[0.52,0.48,0.0,0.0,0.0],[0.43,0.29,0.27,0.01,0.0],[0.44,0.33,0.06,0.06,0.11]]],[8,"r",5,4,[5,4],[[-0.35,"-inf","-inf","-inf","-inf"],[-0.83,-1.88,"-inf","-inf","-inf"],[1.43,1.36,-4.57,"-inf","-inf"],[1.37,0.98,0.9,-2.57,"-inf"],[0.27,-0.03,-1.7,-1.79,-1.12]],[[1.0,0.0,0.0,0.0,0.0],[0.74,0.26,0.0,0.0,0.0],[0.52,0.48,0.0,0.0,0.0],[0.43,0.29,0.27,0.01,0.0],[0.44,0.33,0.06,0.06,0.11]]]];
  const OUT_SHAPE = [5, 4]; // scratch_attention.out.txt "output shape (5, 4)"
  // The listing is causal_self_attention from scratch_attention.py, line for line (line 0 = def).
  const CODE1 = [
    "def causal_self_attention(words, Wq, Wk, Wv):",
    "    T, d = words.shape",
    "    q, k, v = words @ Wq, words @ Wk, words @ Wv",
    "    scores = q @ k.T / np.sqrt(d)",
    "    blocked = np.triu(np.ones((T, T), dtype=bool), k=1)",
    "    scores[blocked] = -np.inf",
    "    weights = np.exp(scores - scores.max(axis=1, keepdims=True))",
    "    weights = weights / weights.sum(axis=1, keepdims=True)",
    "    return weights @ v"
  ];
  // scratch_attention.out.txt, the sqrt(d) experiment: mean weight of the top word per row, 5 words, 2000 tries
  const SQRT = [{ d: 4, raw: 0.61, scaled: 0.44 }, { d: 64, raw: 0.9, scaled: 0.46 }];
  const TRIES = 2000;

  // heads.out.txt: trace rows [line about to run, event, shapes of the locals at that moment]
  const TRACE2 = [[1,"l",{}],[2,"l",{"T":5,"d_model":8}],[3,"l",{"T":5,"d_model":8,"d_head":4}],[4,"l",{"T":5,"d_model":8,"d_head":4,"q":[2,5,4]}],[5,"l",{"T":5,"d_model":8,"d_head":4,"q":[2,5,4],"k":[2,5,4]}],[6,"l",{"T":5,"d_model":8,"d_head":4,"q":[2,5,4],"k":[2,5,4],"v":[2,5,4]}],[7,"l",{"T":5,"d_model":8,"d_head":4,"q":[2,5,4],"k":[2,5,4],"v":[2,5,4],"scores":[2,5,5]}],[8,"l",{"T":5,"d_model":8,"d_head":4,"q":[2,5,4],"k":[2,5,4],"v":[2,5,4],"scores":[2,5,5]}],[9,"l",{"T":5,"d_model":8,"d_head":4,"q":[2,5,4],"k":[2,5,4],"v":[2,5,4],"scores":[2,5,5],"heads":[2,5,4]}],[10,"l",{"T":5,"d_model":8,"d_head":4,"q":[2,5,4],"k":[2,5,4],"v":[2,5,4],"scores":[2,5,5],"heads":[2,5,4],"joined":[5,8]}],[10,"r",{"T":5,"d_model":8,"d_head":4,"q":[2,5,4],"k":[2,5,4],"v":[2,5,4],"scores":[2,5,5],"heads":[2,5,4],"joined":[5,8]}]];
  const N_HEADS = 2;
  const LOOP_MATCHES = true;  // heads.out.txt "head-by-head loop matches: True"
  const WEIGHT_NUMBERS = 256; // heads.out.txt "Wq Wk Wv Wo each [8, 8] -> numbers in weights: 256"
  // The listing is multi_head_attention from heads.py, line for line (line 0 = def).
  const CODE2 = [
    "def multi_head_attention(words, Wq, Wk, Wv, Wo, n_heads):",
    "    T, d_model = words.shape",
    "    d_head = d_model // n_heads",
    "    q = (words @ Wq).reshape(T, n_heads, d_head).transpose(1, 0, 2)",
    "    k = (words @ Wk).reshape(T, n_heads, d_head).transpose(1, 0, 2)",
    "    v = (words @ Wv).reshape(T, n_heads, d_head).transpose(1, 0, 2)",
    "    scores = q @ k.transpose(0, 2, 1) / np.sqrt(d_head)",
    "    scores[:, np.triu(np.ones((T, T), dtype=bool), k=1)] = -np.inf",
    "    heads = softmax(scores) @ v",
    "    joined = heads.transpose(1, 0, 2).reshape(T, d_model)",
    "    return joined @ Wo"
  ];

  // leak_train.out.txt (400 training lines, 100 test lines, 26 words, 7 words per line)
  const LEAK = {
    lines: 400, test: 100, vocab: 26,
    correct: { diagonal: 1, loss: [[1, 3.675], [50, 0.824], [100, 0.822], [200, 0.821], [300, 0.821]], trainView: 0.5, live: 0.5 },
    leaky: { diagonal: 2, loss: [[1, 3.649], [50, 0.231], [100, 0.225], [200, 0.221], [300, 0.219]], trainView: 0.872, live: 0.477,
      words: ["the", "keeper", "catches", "low", "and"],
      w: [[0.0, 1.0, 0.0, 0.0, 0.0], [0.01, 0.0, 0.98, 0.0, 0.0], [0.01, 0.19, 0.67, 0.13, 0.0], [0.66, 0.0, 0.0, 0.0, 0.34], [0.0, 0.0, 0.0, 1.0, 0.0]] }
  };
  // The mask line of TinyAttentionLM.forward in leak_train.py, as it ran for the leaky model (self.diagonal = 2)
  const LEAK_LINE = "blocked = torch.triu(torch.ones(n, n, dtype=torch.bool), diagonal=2)";
  // mask_variants.out.txt: softmax of the first row when diagonal=0 blocks every cell of it
  const NAN_ROW = "[nan, nan, nan, nan, nan]";

  /* ---------- Derived from the data ---------- */
  const T = WORDS.length;
  const BLOCKED = [];
  for (let r = 0; r < T; r++) for (let c = r + 1; c < T; c++) BLOCKED.push(`${r},${c}`);
  const RAW = TRACE1[3][5], MASKED = TRACE1[5][5], W_EXP = TRACE1[6][6], W = TRACE1[7][6];
  const R = 2; // the row for "shoots"
  const rowW = W[R];
  // weight "shoots" gives itself, from its row's printed scores (only the unblocked ones count)
  const selfW = (() => { const s = MASKED[R].filter(x => typeof x === "number"), m = Math.max(...s); return Math.exp(s[R] - m) / sum(s.map(x => Math.exp(x - m))); })();
  const lastLoss = run => run.loss[run.loss.length - 1][1];
  const pct = x => `${Math.round(x * 100)}%`;
  const shapeAfter = line => TRACE2.find(t => t[0] === line + 1)[2]; // locals after `line` ran
  const LONG = 500;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin: 14px 0 4px; font-size: 15px; }
      .lx-${ID}-tbl th, .lx-${ID}-tbl td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .lx-${ID}-tbl th { font: 600 12.5px/1.4 var(--mono); color: var(--muted); }
      .lx-${ID}-tbl td.n { font: 600 15px var(--mono); white-space: nowrap; }
      .lx-${ID}-line { font: 500 14px/1.5 var(--mono); overflow-wrap: anywhere; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--sunk); margin: 12px 0 0; }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-wrap { overflow-x: visible; }
      .lx-${ID}-wrap div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + var(--ind)); text-indent: -4ch; }
      @media (max-width: 700px) { .lx-${ID}-wrap div { padding-left: calc(12px + var(--ind)); } }
    `;
    document.head.appendChild(s);
  }
  // kit.code, but long lines wrap at phone width with a hanging indent instead of running out of sight.
  const codeW = (kit, lines, active) => `<pre class="lcode lx-${ID}-wrap">${lines.map((c, j) => { const t = c.trimStart(); return `<div${j === active ? ' class="on"' : ""} style="--ind:${c.length - t.length + 4}ch">${kit.esc(t) || " "}</div>`; }).join("")}</pre>`;
  const optMono = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  // a 5 x 5 matrix of numbers with the words as row and column heads
  const matrix = (kit, words, vals, opts = {}) => kit.pics.grid(vals.map(r => r.map(f2)), { rowHead: words, colHead: words, ...opts });
  const wire = (el, sel, fn) => el.querySelectorAll(sel).forEach(b => b.onclick = () => fn(b));

  /* 1. The situation, and the by-hand task: block the cells the model must not see. */
  function blockCells({ el, done, kit }) {
    ensureStyle();
    const blocked = new Set();
    let wrong = null;
    const paint = () => {
      const cls = {};
      blocked.forEach(k => cls[k] = "wall");
      if (wrong) cls[wrong] = "no";
      const all = blocked.size === BLOCKED.length;
      let fb = "";
      if (all) fb = kit.feedback(`Right: ${BLOCKED.length} of ${T * T} cells blocked. Row “${WORDS[0]}” may look only at itself; row “${WORDS[T - 1]}” may look at all ${T} words. Every row sees its own word and the words before it, never a later one. This triangle of blocked cells is called the <b>causal mask</b>.`, true);
      else if (wrong) {
        const [r, c] = wrong.split(",").map(Number);
        fb = kit.feedback(c === r
          ? `That is “${kit.esc(WORDS[r])}” looking at itself. The commentator has just said it, so it may be used to guess the next word.`
          : `When the model guesses the word after “${kit.esc(WORDS[r])}”, the word “${kit.esc(WORDS[c])}” was said earlier. It is already on the subtitle, so the model may look at it. Block only words said <i>later</i>.`, false);
      } else if (blocked.size) fb = kit.feedback(`${blocked.size} blocked so far.`);
      el.innerHTML = `<h1>Don't look ahead</h1>
        <p class="lead">A subtitle tool for live football commentary writes each word as the commentator says it. It also guesses the next word, so the subtitle keeps up. It learns from recorded commentary, where whole lines are written down. In training it reads a whole line at once and, at every word, must guess the word that comes after it.</p>
        <p class="lead">To guess, each word looks at the other words of the same line. This is <b>self-attention</b>, the core of GPT-style text models, and this lesson builds it. Each row below is one moment: the word just said. Each column is a word it might look at.</p>
        <p class="task">Click every cell the model must not see, because during a live match that word has not been said yet.</p>
        ${kit.pics.grid(WORDS.map(() => WORDS.map(() => "")), { rowHead: WORDS, colHead: WORDS, pick: (r, c) => !blocked.has(`${r},${c}`) && !all, cls, title: "row: the word just said · column: a word it may look at" })}
        ${kit.pics.key([["wall", "blocked"]])}
        <div class="lpanel">${fb}</div>`;
      wire(el, ".lp-grid [data-i]", b => {
        const k = b.dataset.i, [r, c] = k.split(",").map(Number);
        if (c > r) { blocked.add(k); wrong = null; } else wrong = k;
        paint();
        if (blocked.size === BLOCKED.length) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: what breaks if one cell stays open. */
  function oneOpen({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const open = "1,2";
    const cls = {};
    BLOCKED.forEach(k => cls[k] = k === open ? "accent" : "wall");
    const opts = [
      "Nothing: the model learns to ignore that cell",
      `Training looks better than it should, and live subtitles get worse`,
      "The program stops with a shape error",
      "Live subtitles get better, because the model has more to look at"
    ];
    const fb = [
      [`Training rewards every guess that is right. When the model guesses the word after “${WORDS[1]}”, the open cell holds that very word, “${WORDS[2]}”. Copying it is the easiest way to be right, so the model learns to use the cell, not to ignore it.`, false],
      [`Right. In training the answer sits in the open cell, so the model learns to copy it and the training numbers look great. In a live match the commentator has not said “${WORDS[2]}” yet: the cell is empty, the trick the model relied on is gone, and its guesses get worse. You will see this happen in a real run later in this lesson.`, true],
      ["The mask has the same shape whichever cells are open. Nothing fails loudly. That is what makes a leaking mask dangerous: the code runs and the numbers even improve.", false],
      [`Live, there is nothing more to look at: the word after “${WORDS[1]}” does not exist yet. The open cell only helps when the whole line is already written down, which is only true in training.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>One cell left open</h1>
        <p class="lead">A teammate built the same mask, but by mistake left one cell open: when the model guesses the word after “${WORDS[1]}”, it can see “${WORDS[2]}”.</p>
        ${kit.pics.grid(WORDS.map(() => WORDS.map(() => "")), { rowHead: WORDS, colHead: WORDS, cls })}
        ${kit.pics.key([["wall", "blocked"], ["accent", "left open by mistake"]])}
        <p class="task">The model is trained with this mask and then used live. What happens?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      wire(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Use it: one row, from scores to weights, with predictions. */
  function oneRow({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null, ans = null;
    const picked = new Set();
    const need = BLOCKED.filter(k => k.startsWith(R + ",")).map(k => +k.split(",")[1]);
    const opts = ["Exactly 0", "Small, but above 0", `It keeps its score of ${f2(RAW[R][3])}`];
    const fb = [
      [`Right. e to the power of minus infinity is exactly 0, so “${WORDS[3]}” gets no weight at all, however high its score was.`, true],
      [`That is what happens to a low score that is <i>not</i> blocked: “${WORDS[R]}” itself has ${f2(MASKED[R][R])} and still gets about ${selfW.toFixed(3)}. A blocked cell holds minus infinity, not a low number.`, false],
      ["Softmax turns every score into a weight between 0 and 1; no score survives as it is. And this cell no longer holds a score: the mask wrote minus infinity into it.", false]
    ];
    const paint = () => {
      const cls = {};
      picked.forEach(c => cls[`0,${c}`] = "wall");
      if (wrong != null) cls[`0,${wrong}`] = "no";
      const row = stage === 0 ? RAW[R] : MASKED[R];
      let panel = "";
      if (stage === 0) {
        if (wrong != null) panel = kit.feedback(wrong === R
          ? `“${WORDS[R]}” is the word just said. It may look at itself.`
          : `“${kit.esc(WORDS[wrong])}” was said before “${WORDS[R]}”, so it stays open.`, false);
      } else {
        panel = ask(kit, opts, 0, ans, fb);
        if (ans === 0) panel += `${kit.pics.grid([rowW.map(f2)], { colHead: WORDS, title: `weights for “${WORDS[R]}” after softmax (from the run)` })}
          <p class="lead">The two open earlier words share the weight: ${f2(rowW[0])} and ${f2(rowW[1])}, which add up to ${f2(sum(rowW))}. These weights then mix the words' value vectors, exactly as in the last lesson's weighted sum.</p>`;
      }
      el.innerHTML = `<h1>One row, by hand</h1>
        <p class="lead">Here is the real row of scores for “${WORDS[R]}” from a small NumPy run. Last lesson, one query scored a list of keys. In self-attention every word makes both a query and a key from its own vector (the code shows how). Each score is one word's query times another word's key, divided by √d, where d is the length of those vectors (more on that next).</p>
        ${stage === 0 ? `<p class="task">Click the scores the mask must replace with minus infinity.</p>` : `<p class="task">The mask is applied. After softmax, what weight does “${WORDS[3]}” get?</p>`}
        ${kit.pics.grid([row.map(f2)], { colHead: WORDS, pick: stage === 0 ? (r, c) => !picked.has(c) : false, cls: stage === 0 ? cls : Object.fromEntries(need.map(c => [`0,${c}`, "gone"])), title: stage === 0 ? `scores for “${WORDS[R]}”` : `scores for “${WORDS[R]}” after the mask` })}
        <div class="lpanel">${panel}</div>`;
      if (stage === 0) wire(el, ".lp-grid [data-i]", b => {
        const c = +b.dataset.c;
        if (need.includes(c)) { picked.add(c); wrong = null; } else wrong = c;
        if (need.every(x => picked.has(x))) stage = 1;
        paint();
      });
      else wire(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 4. Why divide by sqrt(d): predict from a real experiment. */
  function whyScale({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const [small, big] = SQRT;
    const even = 1 / T;
    const opts = [`About ${f2(small.raw)}, the same as for d = ${small.d}`, "Close to 1: one word takes almost all the weight", `Close to ${f2(even)}: the weight spreads evenly`];
    const right = `Right: ${f2(big.raw)}. With longer vectors the dot products get bigger: the paper that introduced this shows that their spread grows with d. Softmax of big scores puts nearly all the weight on one word. There, a small change to a score barely changes the weights, so learning slows down. Dividing by √d brings the scores back to a normal size: ${f2(big.scaled)} for d = ${big.d}, close to the ${f2(small.scaled)} for d = ${small.d}.`;
    const fb = [
      [`The vectors are ${big.d / small.d} times longer, so each dot product adds up ${big.d / small.d} times as many products. The scores spread much wider, and softmax reacts to that.`, false],
      [right, true],
      [`An even spread needs scores that are close together. Longer vectors push the scores further apart, not closer.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why divide by √d</h1>
        <p class="lead">The code you will step through next divides every score by √d, where d is the length of the query and key vectors. A run on random query and key vectors, ${T} words, ${TRIES} tries, measured how much weight the top word of each row gets on average.</p>
        <table class="lx-${ID}-tbl"><tr><th>d</th><th>not divided</th><th>divided by √d</th></tr>
          <tr><td class="n">${small.d}</td><td class="n">${f2(small.raw)}</td><td class="n">${f2(small.scaled)}</td></tr>
          <tr><td class="n">${big.d}</td><td class="n">${ans === 1 ? f2(big.raw) : "?"}</td><td class="n">${ans === 1 ? f2(big.scaled) : "?"}</td></tr></table>
        <p class="task">Vectors of ${big.d} numbers, not divided. What is the top word's average weight?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      wire(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. The whole function in NumPy: a stepped replay of the traced run, with one prediction. */
  const FR1 = TRACE1.slice(1).map((v, k) => ({ ran: TRACE1[k][0], end: v[1] === "r", T: v[2], d: v[3], qs: v[4], scores: v[5], w: v[6] }));
  const say1 = (kit, f) => {
    if (f.end) return `The last line mixes the value vectors with these weights. The output has shape ${shp(OUT_SHAPE)}: one new vector per word, built only from that word and the words before it.`;
    switch (f.ran) {
      case 1: return `${f.T} words, each a vector of d = ${f.d} numbers.`;
      case 2: return `Three matrices (learned in a real model, random in this run) turn each word into a query (what it looks for), a key (what it offers) and a value (what it hands over). Each is ${shp(f.qs)}.`;
      case 3: return `Every query against every key, divided by √${f.d}. Row = the word asking, column = the word looked at. The later words have scores too: nothing is blocked yet.`;
      case 4: return `<code>blocked</code> is True above the diagonal: the ${BLOCKED.length} cells marked here, the same cells you clicked on the first screen.`;
      case 5: return "Minus infinity goes into every blocked cell.";
      case 6: return "Subtract each row's largest score, then take e to the power. Subtracting keeps the numbers small and does not change the final weights. Minus infinity becomes exactly 0; the row's largest score becomes 1.";
      case 7: return `Divide each row by its sum. Every row now adds up to 1 (row sums: ${f.w.map(r => f2(sum(r))).join(", ")}).`;
    }
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const opts = ["1 on “the”, 0 everywhere else", `0.2 on each of the ${T} words`, "It depends on the scores, like the other rows"];
    const fb = [
      ["Right. “the” may see only itself, so after the mask its row has one real score. Softmax of a single score is 1, whatever that score is.", true],
      [`An even 0.2 would mean “the” looks at the ${T - 1} words after it. The mask blocks all of them.`, false],
      ["The other rows do depend on their scores. This row has only one score left after the mask, and a single score always gets all the weight.", false]
    ];
    const paint = () => {
      const f = FR1[i];
      const last = i === FR1.length - 1;
      let pic = "";
      if (f.ran === 4) pic = matrix(kit, WORDS, f.scores, { cls: Object.fromEntries(BLOCKED.map(k => [k, "accent"])), title: "scores, blocked cells marked" });
      else if (f.w) pic = matrix(kit, WORDS, f.w, { cls: Object.fromEntries(BLOCKED.map(k => [k, "gone"])), title: f.ran === 6 ? "weights before dividing" : "weights" });
      else if (f.scores) pic = matrix(kit, WORDS, f.scores, { cls: f.ran === 5 ? Object.fromEntries(BLOCKED.map(k => [k, "gone"])) : {}, title: "scores" });
      el.innerHTML = `<h1>The same thing in NumPy</h1>
        <p class="lead">The whole of causal self-attention for one head. The run used made-up 4-number vectors for the ${T} words and random matrices.</p>
        <p class="task">Predict row “the” of the final weights, then step to the end to check.</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>
        ${codeW(kit, CODE1, f.end ? 8 : f.ran)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>T <b>${f.T == null ? "–" : f.T}</b></span><span>d <b>${f.d == null ? "–" : f.d}</b></span><span>q, k, v <b>${f.qs ? shp(f.qs) : "–"}</b></span><span>frame <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(say1(kit, f))}
        ${pic}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1 && ans === 0) done(); };
      wire(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 0 && i === FR1.length - 1) done(); });
    };
    paint();
  }

  /* 6. Several heads: predict the shapes after the split, the attention and the join. */
  const HQ = [
    { line: 3, name: "q", opts: [[5, 8], [2, 5, 4], [5, 2, 4], [2, 5, 8]],
      why: ["That is <code>words @ Wq</code> before the split. <code>reshape</code> cuts the 8 numbers of each word into 2 heads of 4.", null,
        "That is after <code>reshape</code>, before <code>transpose(1, 0, 2)</code>. The transpose moves the heads axis to the front, so each head holds its own 5 × 4 block of words.",
        "Each head gets d_head = 8 // 2 = 4 numbers per word, not all 8. The 8 are shared out between the heads."] },
    { line: 6, name: "scores", opts: [[5, 5], [2, 5, 5], [2, 5, 4], [2, 4, 4]],
      why: ["One 5 × 5 table per head, and there are 2 heads. Each head scores the words its own way.", null,
        "Scores pair a word with a word, so the last two sizes are words × words. 4 is the number of values per head.",
        "Scores compare words, not numbers inside a vector: a 4 × 4 table would score number against number."] },
    { line: 8, name: "heads", opts: [[2, 5, 5], [5, 8], [2, 5, 4], [5, 4]],
      why: ["That is the weights. Multiplying them by <code>v</code> (2, 5, 4) gives each word a mix of value vectors.",
        "Not joined yet. That happens on the next line.", null,
        "Both heads are still there, one block per head."] },
    { line: 9, name: "joined", opts: [[2, 5, 4], [5, 4], [5, 8], [10, 4]],
      why: ["That is before the join. <code>transpose</code> puts the words first again and <code>reshape</code> glues the heads side by side.",
        "The heads are placed side by side, not averaged: 4 numbers from each of 2 heads.", null,
        "The heads are glued along the numbers of each word, not stacked as extra words: there are still 5 words."] }
  ];
  HQ.forEach(q => { q.right = q.opts.findIndex(o => shp(o) === shp(shapeAfter(q.line)[q.name])); });
  function heads({ el, done, kit }) {
    ensureStyle();
    let qi = 0, wrong = null;
    const paint = () => {
      const fin = qi >= HQ.length;
      const q = HQ[Math.min(qi, HQ.length - 1)];
      const got = HQ.slice(0, qi).map(h => [h.name, shp(shapeAfter(h.line)[h.name])]);
      el.innerHTML = `<h1>Two heads instead of one</h1>
        <p class="lead">Real models run several attentions side by side, called <b>heads</b>, so each can follow a different link between words. Here ${T} words have ${shapeAfter(1).d_model} numbers each (<code>d_model</code> in the code), cut into ${N_HEADS} heads of ${shapeAfter(2).d_head} (<code>d_head</code>). Each head scores, masks and mixes on its own slice. Then the results are glued back together.</p>
        ${fin ? "" : `<p class="task">What is the shape of <code>${q.name}</code> after the highlighted line?</p>`}
        ${codeW(kit, CODE2, fin ? -1 : q.line)}
        ${got.length ? kit.table(got, { head: ["array", "shape in the run"], fresh: got.length - 1 }) : ""}
        <div class="lpanel">${fin ? kit.feedback(`Right: split, attend, join. The same run also computed each head separately with the single-head recipe and concatenated the results: “head-by-head loop matches: ${LOOP_MATCHES ? "True" : "False"}”. Heads are just small attentions on separate slices, done in one batched call. Each head has its own ${T} × ${T} weights, so one head can follow one kind of link between words while another follows a different one. The last line, <code>joined @ Wo</code>, mixes the heads' results back into one vector per word.`, true)
          : `${kit.options(q.opts.map(o => optMono(kit, shp(o))), { picked: wrong, correct: q.right })}${wrong != null ? kit.feedback(q.why[wrong], false) : ""}`}</div>`;
      wire(el, ".lopts button", b => {
        const p = +b.dataset.i;
        if (p !== HQ[qi].right) { wrong = p; paint(); return; }
        wrong = null; qi++; paint();
        if (qi >= HQ.length) done();
      });
    };
    paint();
  }

  /* 7. Broken on purpose: a mask that leaks one word. */
  function leak({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrongCell = null, ans = null;
    const L = LEAK.leaky, C = LEAK.correct;
    const opts = [optMono(kit, "diagonal=0"), optMono(kit, "diagonal=1"), optMono(kit, "torch.tril(torch.ones(n, n, dtype=torch.bool), diagonal=-1)"), "Keep it: run B scores higher"];
    const fb = [
      [`That blocks the diagonal too, so a word cannot see itself. Row “${L.words[0]}” then has every cell blocked, and softmax of a row of minus infinities gives ${NAN_ROW} in a real run: the model breaks.`, false],
      [`Right. <code>diagonal=1</code> blocks everything above the diagonal and nothing else: each word sees itself and the words before it. That is run A, whose live score (${pct(C.live)}) matches its whole-line score.`, true],
      ["That blocks the words <i>before</i> each word and leaves the later ones open: the opposite of what you want, a bigger leak.", false],
      [`Run B scores higher only when the next word is in the input. Live it got ${pct(L.live)}, below run A's ${pct(C.live)}. The higher number was the leak.`, false]
    ];
    const paint = () => {
      const cls = {};
      if (wrongCell) cls[wrongCell] = "no";
      const pickable = stage === 0;
      let panel = "";
      if (stage === 0 && wrongCell) {
        const [r, c] = wrongCell.split(",").map(Number);
        panel = kit.feedback(c <= r
          ? `For “${kit.esc(L.words[r])}”, “${kit.esc(L.words[c])}” is ${c === r ? "the word itself" : "an earlier word"}. Looking there is allowed.`
          : `This later word gets weight ${f2(L.w[r][c])}: the mask blocked it, as it should. Find a later word that is <i>not</i> zero.`, false);
      }
      el.innerHTML = `<h1>Too good to be true</h1>
        <p class="lead">A teammate trained two tiny next-word models on the same ${LEAK.lines} made-up commentary lines. Only the mask differs. Both were then tested on ${LEAK.test} new lines in two ways: with the whole line fed in, as in training, and live, with only the words said so far.</p>
        <table class="lx-${ID}-tbl"><tr><th>run</th><th>training loss</th><th>right, whole line in</th><th>right, live</th></tr>
          <tr><td>A</td><td class="n">${f2(lastLoss(C))}</td><td class="n">${pct(C.trainView)}</td><td class="n">${pct(C.live)}</td></tr>
          <tr><td>B</td><td class="n">${f2(lastLoss(L))}</td><td class="n">${pct(L.trainView)}</td><td class="n">${pct(L.live)}</td></tr></table>
        <p class="lead">Run B's attention weights (head 1) on a test line:</p>
        ${matrix(kit, L.words, L.w, { pick: pickable, cls: stage > 0 ? leakCls(L) : cls })}
        ${stage === 0 ? `<p class="task">Click one weight that proves run B's mask leaks.</p>` : `${kit.feedback(`Yes. “${kit.esc(L.words[1])}” puts ${f2(L.w[1][2])} of its weight on “${kit.esc(L.words[2])}”, the very word it should guess, and “${kit.esc(L.words[0])}” puts ${f2(L.w[0][1])} on “${kit.esc(L.words[1])}”. Every cell just above the diagonal is open. This is the mask line as it ran for run B:`, true)}
          <div class="lx-${ID}-line">${kit.esc(LEAK_LINE)}</div>
          <p class="lead"><code>diagonal</code> in <code>torch.triu</code> works like <code>k</code> in <code>np.triu</code> from the NumPy code.</p>
          <p class="task">What should the line say?</p>`}
        <div class="lpanel">${stage === 0 ? panel : ask(kit, opts, 1, ans, fb)}</div>`;
      if (stage === 0) wire(el, ".lp-grid [data-i]", b => {
        const r = +b.dataset.r, c = +b.dataset.c;
        if (c > r && L.w[r][c] > 0) { stage = 1; wrongCell = null; } else wrongCell = `${r},${c}`;
        paint();
      });
      else wire(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }
  // after the find: open later cells with weight marked as mistakes, blocked later cells faded
  function leakCls(L) {
    const cls = {};
    L.w.forEach((row, r) => row.forEach((x, c) => { if (c > r) cls[`${r},${c}`] = x > 0 ? "no" : "gone"; }));
    return cls;
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const now = T * T, later = LONG * LONG, times = Math.round(later / now);
    const opts = ["The table of scores, one per pair of words", "The weight matrices Wq, Wk, Wv and Wo", "The number of heads"];
    const fb = [
      [`Right. ${T} words make ${now} scores per head; ${LONG} words make ${later.toLocaleString("en")}, ${times.toLocaleString("en")} times more, for ${LONG / T} times more words. Work and memory for attention grow with the square of the length.`, true],
      [`Each is d_model × d_model: ${WEIGHT_NUMBERS} numbers for all four in the two-head run, whether the line has ${T} words or ${LONG}. They depend on the width of a word vector, not on how many words there are.`, false],
      ["You choose the number of heads when you design the model. It does not change with the length of the text.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>For:</b> letting every word pull in what it needs from other words in one step, for all words at once.</p>
        <p class="lead"><b>Add the causal mask</b> whenever a model writes text one word at a time: chat replies, autocomplete, live subtitles.</p>
        <p class="lead"><b>Leave the mask out</b> when the whole input exists before the model runs, as when classifying a finished email or embedding a search query. Then every word should see both sides.</p>
        <p class="lead"><b>Costs:</b> one score per pair of words, so long texts get expensive fast.</p>
        <p class="lead">In PyTorch you rarely write it by hand: <code>scaled_dot_product_attention(q, k, v, is_causal=True)</code> from <code>torch.nn.functional</code> applies the causal mask for you.</p>
        <p class="task">The subtitle tool's window grows from the last ${T} words to the last ${LONG}. What grows fastest?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      wire(el, ".lopts button", b => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. Recognise it: mask or no mask. */
  const CASES = [
    ["A phone keyboard suggests the next word while you type a message.", true,
      "Yes. The model writes the next word from the words typed so far. In training it must not see the words that came later in the sentence, or it learns to copy them.",
      "The words after the cursor do not exist yet when you type. A model trained to look at them would lean on a word it never has in use. Mask them."],
    ["A spam filter reads a whole email that has already arrived and labels it spam or not.", false,
      "No mask. The whole email exists before the model runs, and the label depends on all of it. Letting each word see the words after it is not cheating here; it is extra context. Models built for this let every word see both sides.",
      "Nothing is being guessed word by word. The full email is there at use time just as in training, so there is no future to hide. A mask would only hide useful context from the early words."],
    ["A chatbot writes its reply one word at a time.", true,
      "Yes. Each new word is chosen from the words before it, so in training each word must be kept from seeing the later words of the reply.",
      "Writing word by word is exactly the live-subtitle situation: the later words of the reply do not exist when each word is chosen. Mask them in training."],
    ["A search engine turns each whole query into one vector to compare with documents.", false,
      "No mask. The whole query is typed before it is turned into a vector, so every word may see every other word. “bank” next to “river” should change its meaning even when “river” comes after it.",
      "The query is complete before the model runs. Blocking later words would stop an early word from being read in light of the words after it, for no gain."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Mask or no mask?</h1>
        <p class="lead">Four models that use self-attention.</p>
        <p class="task">Does each one need the causal mask? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Needs the mask", "No mask"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can write it</h1>
      <p class="lead">You blocked the later words by hand, turned one row of scores into weights, saw why scores are divided by √d, stepped through the ${CODE1.length - 1}-line NumPy version, split it into heads, and caught a mask that leaked one word.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write causal multi-head self-attention in NumPy and a check that fails when the mask lets a word see a later one.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The attention you wrote scores words by their vectors alone; next you test whether it can tell two orders of the same words apart.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Self-attention, multiple heads and the causal mask",
    checked: "2026-11-14",
    sources: [
      "https://arxiv.org/abs/1706.03762",
      "https://arxiv.org/abs/1810.04805",
      "https://numpy.org/doc/stable/reference/generated/numpy.triu.html",
      "https://docs.pytorch.org/docs/stable/generated/torch.triu.html",
      "https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html"
    ],
    interview: [
      {
        q: "Your new text-generation model reaches a much lower training loss than the last version, but the text it writes is worse. What do you check?",
        good: [
          "Suspect a leak first: a loss that drops far below the old one with no real change is too good to be true",
          "Compare accuracy with the whole sequence fed in against step-by-step generation; a big gap points at the mask",
          "Print the attention weights for one sequence and look for weight above the diagonal",
          "Read the mask line: an off-by-one diagonal, triu and tril swapped, or the mask applied after softmax",
          "Add a test: change a later token and assert the outputs at earlier positions do not change"
        ],
        weak: "Say it is overfitting and add dropout or more data, without checking whether the model can see the tokens it is asked to predict."
      },
      {
        q: "Product wants the model to read ten times more context. What happens to the cost of self-attention, and what does not change?",
        good: [
          "Each head scores every pair of positions, so the score table grows with the square of the length: about a hundred times more",
          "Memory for the scores and the time to compute them grow the same way",
          "The weight matrices do not grow: they depend on the model width, not the length",
          "Measure on real lengths before promising latency, since attention becomes the main cost on long inputs"
        ],
        weak: "Say the cost grows ten times, like the length, missing that attention compares every position with every other."
      }
    ],
    screens: [blockCells, oneOpen, oneRow, whyScale, asCode, heads, leak, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="2,1"]'], right: BLOCKED.map(k => `[data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="0,0"]'], right: ['[data-i="0,3"]', '[data-i="0,4"]', "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: [...Array(FR1.length - 1).fill("[data-next]"), "[data-right]"] },
      { wrong: ["[data-wrong]"], right: HQ.map(() => "[data-right]") },
      { wrong: ['.lp-grid [data-i="3,0"]'], right: ['.lp-grid [data-i="1,2"]', "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
