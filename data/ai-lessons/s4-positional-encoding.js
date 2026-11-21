/* Lesson: positional encoding. Story: a police department's report summarizer must not swap who did what to whom
   ("dog bites man" against "man bites dog"). Ideas: (1) plain self-attention is blind to word order: shuffle the
   words and every word's output row is the same, only moved, so an averaged summary is identical; (2) adding a
   position vector per slot (sinusoid or a learned table) before attention makes the order visible.
   Data, all real, from runs on this Mac (no model recordings):
   - docs/ai-path/runs/s4-positional-encoding/order_blind.py + order_blind.out.txt: 4-number word vectors and random
     weights (numpy seed 0), every order of the three words with no positions, sinusoid positions, an untrained
     learned table and a causal mask; the sinusoid table for positions 0..7; the line trace of encode() shown on
     the code screen;
   - docs/ai-path/runs/s4-positional-encoding/who_did_it.py + who_did_it.out.txt: a one-layer attention model trained
     (torch seed 0, 400 steps) on 120 three-word reports to name the doer, with no / sinusoid / learned positions.
   Lesson-local style: a small number matrix (.lx-s4-positional-encoding-*), see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s4-positional-encoding";

  /* ---------- Data copied from docs/ai-path/runs/s4-positional-encoding/order_blind.out.txt ---------- */
  const DIM = 4; // order_blind.py DIM
  const WORD_VEC = { dog: [0.1257, -0.1321, 0.6404, 0.1049], bites: [-0.5357, 0.3616, 1.304, 0.9471], man: [-0.7037, -1.2654, -0.6233, 0.0413] };
  const SIN_TABLE = [[0.0, 1.0, 0.0, 1.0], [0.8415, 0.5403, 0.01, 1.0], [0.9093, -0.4161, 0.02, 0.9998], [0.1411, -0.99, 0.03, 0.9996], [-0.7568, -0.6536, 0.04, 0.9992], [-0.9589, 0.2837, 0.05, 0.9988], [-0.2794, 0.9602, 0.06, 0.9982], [0.657, 0.7539, 0.0699, 0.9976]];
  // "order" lines: [words, out] per order; key = position kind ("-causal" = with a causal mask, no positions)
  const RUNS = {
    none: [
      [["dog", "bites", "man"], [[-0.5598, 0.1813, -1.5783, -0.2927], [-1.0224, -0.3292, -1.3144, -0.1985], [-2.2966, -1.6793, -0.751, -0.098]]],
      [["dog", "man", "bites"], [[-0.5598, 0.1813, -1.5783, -0.2927], [-2.2966, -1.6793, -0.751, -0.098], [-1.0224, -0.3292, -1.3144, -0.1985]]],
      [["bites", "dog", "man"], [[-1.0224, -0.3292, -1.3144, -0.1985], [-0.5598, 0.1813, -1.5783, -0.2927], [-2.2966, -1.6793, -0.751, -0.098]]],
      [["bites", "man", "dog"], [[-1.0224, -0.3292, -1.3144, -0.1985], [-2.2966, -1.6793, -0.751, -0.098], [-0.5598, 0.1813, -1.5783, -0.2927]]],
      [["man", "dog", "bites"], [[-2.2966, -1.6793, -0.751, -0.098], [-0.5598, 0.1813, -1.5783, -0.2927], [-1.0224, -0.3292, -1.3144, -0.1985]]],
      [["man", "bites", "dog"], [[-2.2966, -1.6793, -0.751, -0.098], [-1.0224, -0.3292, -1.3144, -0.1985], [-0.5598, 0.1813, -1.5783, -0.2927]]]
    ],
    sinusoid: [
      [["dog", "bites", "man"], [[-0.1663, 0.3407, -1.4969, 0.1344], [-1.8819, -1.3397, -0.917, 1.1247], [-2.5183, -1.9412, -0.7581, 1.5035]]],
      [["man", "bites", "dog"], [[-0.2095, 0.1926, -1.5277, -1.8332], [-0.1258, 0.288, -1.2428, 0.2513], [-0.2121, 0.1902, -1.1284, 0.6069]]]
    ],
    learned: [
      [["dog", "bites", "man"], [[-0.3944, 1.9705, -5.5669, 0.0136], [-5.9508, -4.4063, -1.467, 3.3469], [-5.9541, -4.4103, -1.4649, 3.3481]]],
      [["man", "bites", "dog"], [[-4.4554, -2.356, -2.8287, 2.3002], [-3.6998, -2.3072, -1.6025, 3.9951], [-3.7525, -2.3145, -1.6792, 3.8876]]]
    ],
    "none-causal": [
      [["dog", "bites", "man"], [[-0.1625, 0.2802, -0.8132, 0.5897], [0.2571, 1.0144, -1.8449, -0.2654], [-2.2966, -1.6793, -0.751, -0.098]]],
      [["man", "bites", "dog"], [[-2.4454, -1.8236, -0.7242, -0.1241], [-1.4285, -0.617, -1.551, -0.5708], [-0.5598, 0.1813, -1.5783, -0.2927]]]
    ]
  };
  // attention weights (rows = the word reading, columns = the word read), no positions, from the same "order" lines
  const WEIGHTS = {
    "dog bites man": [[0.3842, 0.3004, 0.3153], [0.3208, 0.2058, 0.4734], [0.0533, 0.0081, 0.9386]],
    "man bites dog": [[0.9386, 0.0081, 0.0533], [0.4734, 0.2058, 0.3208], [0.3153, 0.3004, 0.3842]]
  };
  // The listing is encode() from order_blind.py, line for line (line 0 = def). Trace of encode(["man","bites","dog"], True):
  // [line about to run, event (l = line, r = return), variables that changed since the previous step (rounded to 3)]
  const CODE = [
    "def encode(words, positions):",
    "    x = np.stack([VEC[w] for w in words])",
    "    if positions:",
    "        x = x + sinusoid(len(words), DIM)",
    "    q, k, v = x @ W_Q, x @ W_K, x @ W_V",
    "    scores = q @ k.T / np.sqrt(DIM)",
    "    weights = softmax(scores)",
    "    out = weights @ v",
    "    return out"
  ];
  const TRACE_WORDS = ["man", "bites", "dog"];
  const TRACE = [
    [1, "l", {}],
    [2, "l", { x: [[-0.704, -1.265, -0.623, 0.041], [-0.536, 0.362, 1.304, 0.947], [0.126, -0.132, 0.64, 0.105]] }],
    [3, "l", {}],
    [4, "l", { x: [[-0.704, -0.265, -0.623, 1.041], [0.306, 0.902, 1.314, 1.947], [1.035, -0.548, 0.66, 1.105]] }],
    [5, "l", { q: [[2.802, -0.516, 0.408, -0.94], [0.388, 1.626, -2.331, -0.616], [-1.195, 0.953, -2.776, -2.116]], k: [[-0.539, 1.359, 1.566, -0.064], [-3.594, 3.332, 3.535, 3.74], [-2.209, 1.518, 0.842, 1.438]], v: [[-0.214, 0.188, -1.551, -1.994], [2.537, 3.308, -3.23, -1.259], [-0.242, 0.157, -0.846, 2.221]] }],
    [6, "l", { scores: [[-0.756, -6.932, -3.991], [-0.806, -3.262, -0.619], [-1.136, -5.128, -0.646]] }],
    [7, "l", { weights: [[0.96, 0.002, 0.038], [0.436, 0.037, 0.526], [0.377, 0.007, 0.616]] }],
    [8, "l", { out: [[-0.209, 0.193, -1.528, -1.833], [-0.126, 0.288, -1.243, 0.251], [-0.212, 0.19, -1.128, 0.607]] }],
    [8, "r", {}]
  ];

  /* ---------- Data copied from docs/ai-path/runs/s4-positional-encoding/who_did_it.out.txt ---------- */
  const NOUNS = ["dog", "man", "driver", "cyclist", "officer", "neighbour"]; // who_did_it.py NOUNS
  const VERBS = ["bites", "hits", "pushes", "follows"];                      // who_did_it.py VERBS
  const TRAIN_DIM = 16, TRAIN_STEPS = 400;                                    // who_did_it.py DIM, STEPS
  const TRAIN = [
    { pos: "none", reports: 120, params: 1078, loss: [1.8271, 0.6983, 0.6941, 0.6938, 0.6937, 0.6936, 0.6935, 0.6935, 0.6933], acc: [0.175, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], answers: { "dog bites man": "dog", "man bites dog": "dog" } },
    { pos: "sinusoid", reports: 120, params: 1078, loss: [1.8629, 0.0003, 0.0002, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001], acc: [0.1833, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], answers: { "dog bites man": "dog", "man bites dog": "man" } },
    { pos: "learned", reports: 120, params: 1126, loss: [1.8437, 0.0006, 0.0003, 0.0002, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001], acc: [0.1667, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], answers: { "dog bites man": "dog", "man bites dog": "man" } }
  ];
  const CURVE_EVERY = 50; // who_did_it.py logs every 50 steps

  /* ---------- Derived from the data ---------- */
  const key = ws => ws.join(" ");
  const run = (kind, ws) => RUNS[kind].find(r => key(r[0]) === key(ws));
  const rowOf = (kind, ws, w) => { const r = run(kind, ws); return r[1][r[0].indexOf(w)]; };
  const mean = rows => rows[0].map((_, j) => rows.reduce((s, r) => s + r[j], 0) / rows.length);
  const same = (a, b) => a.every((v, j) => Math.abs(v - b[j]) < 1e-3);
  const dist = (a, b) => Math.sqrt(a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0));
  const DBM = ["dog", "bites", "man"], MBD = ["man", "bites", "dog"];
  const f2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
  const pct = v => `${Math.round(v * 100)}%`;
  const T_NONE = TRAIN[0], T_SIN = TRAIN[1], T_LRN = TRAIN[2];
  const last = a => a[a.length - 1];
  const PAIRS = T_NONE.reports / 2;
  const SLOW = 10000 ** (2 / DIM); // the second pair's angle is pos / SLOW

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-wrap { margin: 16px 0 12px; max-width: 100%; overflow-x: auto; }
      .lx-${ID}-mat { border-collapse: collapse; font: 500 14px/1.4 var(--mono); color: var(--ink); }
      .lx-${ID}-mat caption { text-align: left; font: 600 13px/1.5 var(--font); color: var(--muted); padding-bottom: 4px; }
      .lx-${ID}-mat th { font: 600 13px/1.4 var(--mono); color: var(--muted); padding: 5px 8px; text-align: right; }
      .lx-${ID}-mat th:first-child { text-align: left; padding-left: 0; }
      .lx-${ID}-mat td { padding: 5px 8px; text-align: right; border-top: 1px solid var(--line); white-space: nowrap; }
      .lx-${ID}-mat tr.lx-${ID}-hi td, .lx-${ID}-mat tr.lx-${ID}-hi th { box-shadow: inset 0 2px 0 var(--ink), inset 0 -2px 0 var(--ink); }
      .lx-${ID}-mat tr.lx-${ID}-sum td, .lx-${ID}-mat tr.lx-${ID}-sum th { border-top: 2px solid var(--ink); font-weight: 700; color: var(--ink); }
      .lx-${ID}-mat td.lx-${ID}-q { font-weight: 700; outline: 2px solid var(--ink); outline-offset: -3px; }
      .lx-${ID}-orders { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; }
      .lx-${ID}-orders button { min-height: 44px; padding: 0 12px; font: 500 14px var(--mono); }
      .lx-${ID}-orders button[aria-pressed="true"] { outline: 3px solid var(--ink); outline-offset: 1px; font-weight: 700; }
      .lx-${ID}-sents { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-sents li { padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 16px; }
      .lx-${ID}-f { font: 600 15px/1.6 var(--mono); margin: 12px 0 0; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }
  /* A small number matrix. rows: [[label, numbers]]; hi: row indexes ringed; sum: index of a summary row; q: (r, c) => 2 marks the asked cell "?", 1 hides a cell as "…" */
  function mat(kit, rows, { head = [], title = "", hi = [], sum = -1, q = null, fmt = f2 } = {}) {
    return `<div class="lx-${ID}-wrap"><table class="lx-${ID}-mat">${title ? `<caption>${kit.esc(title)}</caption>` : ""}${head.length ? `<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>${rows.map(([lab, nums], i) =>
      `<tr class="${hi.includes(i) ? `lx-${ID}-hi` : ""}${i === sum ? ` lx-${ID}-sum` : ""}"><th>${kit.esc(lab)}</th>${nums.map((v, j) => q && q(i, j) ? `<td class="lx-${ID}-q">${q(i, j) === 2 ? "?" : "…"}</td>` : `<td>${kit.esc(fmt(v))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  const dims = n => ["", ...Array.from({ length: n }, (_, j) => `d${j}`)];
  const outRows = (kind, ws) => run(kind, ws)[1].map((r, i) => [ws[i], r]);
  const withMean = (kind, ws) => [...outRows(kind, ws), ["average", mean(run(kind, ws)[1])]];
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }
  function single(el, done, kit, render, right) {
    let ans = null;
    const paint = () => {
      el.innerHTML = render(ans);
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 1. The situation and the first prediction. */
  function situation({ el, done, kit }) {
    ensureStyle();
    const dogA = rowOf("none", DBM, "dog"), dogB = rowOf("none", MBD, "dog");
    const opts = [
      "The same four numbers, now in the last row",
      "Different numbers: dog now sits at the end, after different words",
      "The same four numbers, still in the first row",
      "All three rows become equal"
    ];
    const fb = [
      [`Right. Here is the real run for “${key(MBD)}”:${mat(kit, outRows("none", MBD), { head: dims(DIM), title: "output rows, " + key(MBD), hi: [2] })}Dog's row is ${dogB.map(f2).join(", ")}, the same as before (${same(dogA, dogB) ? "identical to four decimals" : "not identical"}). The man row and the bites row did not change either. They only swapped places.`, true],
      ["Attention does not read a word's neighbours. Every word reads <b>all</b> the words of the report. Dog reads dog, bites and man in both reports. So what changed for dog?", false],
      ["Each row belongs to one word, in the order the words come in. In “man bites dog” the first word is man, so the first row is man's row. Dog's row is somewhere else.", false],
      ["Nothing averages the words together inside attention. Each word still gets its own weights from its own query, so the rows stay different.", false]
    ];
    single(el, done, kit, ans => `<h1>Who bit whom?</h1>
      <p class="lead">A police department turns incident reports into one-line summaries for the morning briefing. The model reads each report with self-attention, then averages the word outputs into one summary vector. A small output layer on top (the <b>head</b>) turns that vector into “who did what to whom”. Two reports came in: “${key(DBM)}” and “${key(MBD)}”. The briefing said a dog attacked someone both times. This lesson finds why, and adds the piece every transformer needs to know word order.</p>
      <p class="lead">Below are the self-attention outputs for “${key(DBM)}”. It is a tiny run: each word is a vector of ${DIM} numbers, the weights are random (seed 0). One row per word; dog's row is ringed.</p>
      ${mat(kit, outRows("none", DBM), { head: dims(DIM), title: "output rows, " + key(DBM), hi: [0] })}
      <p class="task">Now the same model reads “${key(MBD)}”. What will dog's output row be?</p>
      <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`, 0);
  }

  /* 2. By hand: shuffle the words, compare the summaries. */
  function shuffle({ el, done, kit }) {
    ensureStyle();
    let ord = 0, ans = null;
    const means = RUNS.none.map(r => mean(r[1]));
    const allSame = means.every(m => same(m, means[0]));
    const opts = ["Some orders give a different average row", "Every order gives the same average row", "Only the orders that move “bites” change it"];
    const RIGHT = allSame ? 1 : 0;
    const fb = [
      [`Look at the average row for each order again: it is ${means[0].map(f2).join(", ")} every time. The word rows move up and down, and an average does not care where a row sits.`, false],
      [`Right. All ${RUNS.none.length} orders give the same average: ${means[0].map(f2).join(", ")}. The summary for “${key(DBM)}” and for “${key(MBD)}” is the same vector, so the head cannot write different lines for them. That is the briefing's mistake.`, true],
      [`Try “dog man bites”: bites moves, and the average is still ${means[1].map(f2).join(", ")}. No order changes it.`, false]
    ];
    const paint = () => {
      const ws = RUNS.none[ord][0];
      el.innerHTML = `<h1>Shuffle the report</h1>
        <p class="lead">Every order of the three words was run through the same self-attention. Pick an order to see its rows and the average the summarizer uses.</p>
        <div class="lx-${ID}-orders">${RUNS.none.map((r, i) => `<button type="button" class="btn" data-o="${i}" aria-pressed="${i === ord}">${kit.esc(key(r[0]))}</button>`).join("")}</div>
        ${mat(kit, withMean("none", ws), { head: dims(DIM), title: key(ws), sum: ws.length })}
        <p class="task">Look at a few orders. Which is true of the average row?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { ord = +b.dataset.o; paint(); });
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: why attention is blind to order. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    const wa = WEIGHTS[key(DBM)][0], wb = WEIGHTS[key(MBD)][2]; // dog reading, in each report
    const wbSorted = DBM.map(w => wb[MBD.indexOf(w)]); // dog's row in "man bites dog", columns put in the order dog, bites, man
    const opts = [
      "The weights are not trained yet. Training would teach them the order.",
      "Each weight comes from two word vectors only, and the output is a weighted sum. Nothing in either step reads where a word sits.",
      "Three words are too few. In a long report the order would show.",
      "The average throws the order away. The word rows still know it."
    ];
    const fb = [
      ["Training changes W_Q, W_K and W_V, but they multiply word vectors only. No trained number ever sees a slot number. You will see a trained model fail the same way later in this lesson.", false],
      [`Right. A score is one word's query times another word's key: both come from word vectors. Softmax and the weighted sum treat the words as a <b>set</b>. So shuffling the input only shuffles the output rows. This is called being <b>permutation-equivariant</b> (a permutation is a reordering). Average the rows and even the shuffle disappears. The Transformer paper says it plainly: the model has no recurrence (no word-by-word reading, as an RNN has) to carry order, so you must <b>inject</b> position information yourself.`, true],
      ["The same arithmetic runs for any length. Shuffle 300 words and you get the same 300 rows, shuffled. More words do not add a slot number anywhere.", false],
      [`Dog's row was identical in both reports (screen 1). If the rows knew the order, dog-first and dog-last would give different rows. They do not.`, false]
    ];
    single(el, done, kit, ans => `<h1>Why the order vanished</h1>
      <p class="lead">Here is how much dog reads each word, in both reports. These are the attention weights from the same runs.</p>
      ${mat(kit, [["in " + key(DBM), wa], ["in " + key(MBD), wbSorted]], { head: ["dog reads", ...DBM], title: "dog's attention weights (columns: the word dog reads)", fmt: v => v.toFixed(2) })}
      <p class="lead">${same(wa, wbSorted) ? `The two rows are the same: dog gives each word the same weight wherever the words sit.` : `The two rows differ.`}</p>
      <p class="task">Why can plain self-attention not see the order of the words?</p>
      <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`, 1);
  }

  /* 4. Add position vectors, predict again. */
  function addPositions({ el, done, kit }) {
    ensureStyle();
    let stage = 0, ans = null;
    const dogA = rowOf("sinusoid", DBM, "dog"), dogB = rowOf("sinusoid", MBD, "dog");
    const bA = rowOf("sinusoid", DBM, "bites"), bB = rowOf("sinusoid", MBD, "bites");
    const mA = mean(run("sinusoid", DBM)[1]), mB = mean(run("sinusoid", MBD)[1]);
    const mN = mean(run("none", DBM)[1]), mN2 = mean(run("none", MBD)[1]);
    const Q = [
      { task: `With position vectors added, the model reads “${key(MBD)}”. Is dog's output row the same as in “${key(DBM)}”?`,
        opts: ["The same as before", "Different"], right: same(dogA, dogB) ? 0 : 1,
        fb: [[`Dog now enters as dog + slot ${MBD.indexOf("dog")}, not dog + slot 0. Its query and key change, so its weights and its row change too.`, false], null] },
      { task: `“bites” is in slot 1 in both reports, so it gets the same position vector. Is its output row the same in both?`,
        opts: ["The same: its input did not change", "Different"], right: same(bA, bB) ? 0 : 1,
        fb: [[`Its own input is the same, but it reads the other two words, and they now carry different slots: dog + slot 0 and man + slot 2 in one report, the other way round in the other. Different keys and values, so a different row: ${bA.map(f2).join(", ")} against ${bB.map(f2).join(", ")}.`, false], null] }
    ];
    const paint = () => {
      const q = Q[stage];
      el.innerHTML = `<h1>Give every slot its own vector</h1>
        <p class="lead">The fix: before attention, add a vector that belongs to the <b>slot</b>, not the word. A slot is a word's place in the report: 0, 1, 2. Slot 0 always gets the same vector, whatever word sits there. These are the slot vectors used here (the next screen shows where they come from):</p>
        ${mat(kit, SIN_TABLE.slice(0, 3).map((r, i) => ["slot " + i, r]), { head: dims(DIM) })}
        <p class="lead">So dog enters as dog + slot 0 in “${key(DBM)}”, and as dog + slot ${MBD.indexOf("dog")} in “${key(MBD)}”.</p>
        ${stage < 2 ? `<p class="task">${q.task}</p><div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}</div>` : `
          ${mat(kit, withMean("sinusoid", DBM), { head: dims(DIM), title: key(DBM) + ", with positions", sum: 3, hi: [0] })}
          ${mat(kit, withMean("sinusoid", MBD), { head: dims(DIM), title: key(MBD) + ", with positions", sum: 3, hi: [2] })}
          <div class="lpanel">${kit.feedback(`Every row changed, and so did the average. The distance between the two summary vectors is ${dist(mA, mB).toFixed(2)} now; without positions it was ${dist(mN, mN2).toFixed(2)}. The head finally gets two different inputs, so it <i>can</i> learn two different answers.`, true)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[stage].right) { stage++; ans = null; paint(); if (stage === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 5. Where the sinusoid vectors come from: compute one cell. */
  function sinusoids({ el, done, kit }) {
    ensureStyle();
    const P = 3, C = 2, truth = SIN_TABLE[P][C];
    const vals = [Math.sin(P / SLOW), Math.sin(P), Math.cos(P / SLOW)];
    const opts = vals.map(v => v.toFixed(2));
    const RIGHT = 0;
    const fb = [
      [`Right: sin(${P} / ${SLOW}) = ${vals[0].toFixed(2)}, and the run printed ${truth}. Columns d0 and d1 are a fast pair: the angle is the position itself, so they swing a lot from slot to slot and come back round after about ${(2 * Math.PI).toFixed(1)} slots. Columns d2 and d3 are a slow pair: the angle is the position divided by ${SLOW}, so they barely move. Like the hands of a clock, the fast pair tells neighbours apart and the slow pair keeps counting far away. A real model has hundreds of dimensions, so it has many pairs, from very fast to very slow.`, true],
      [`sin(${P}) is the fast pair's value: that is column d0 (${SIN_TABLE[P][0]}). Column d2 is the second pair, whose angle is divided by 10000<sup>2/${DIM}</sup> = ${SLOW}.`, false],
      [`Cosine fills the odd columns: d1 and d3. Column d2 is even, so it is a sine.`, false]
    ];
    single(el, done, kit, ans => `<h1>Where the slot vectors come from</h1>
      <p class="lead">The Transformer paper's position vectors use sine and cosine. For slot number <i>pos</i> and a vector of size <i>d</i>, the columns go in pairs. Pair <i>i</i> is columns 2i and 2i+1, and it gets one angle:</p>
      <p class="lx-${ID}-f">angle = pos / 10000^(2i/d)<br>PE[pos, 2i] = sin(angle)<br>PE[pos, 2i+1] = cos(angle)</p>
      <p class="lead">Here d = ${DIM}, so pair 0 (d0, d1) uses angle = pos, and pair 1 (d2, d3) uses angle = pos / ${SLOW}. Nothing is trained: anyone can compute the table.</p>
      ${mat(kit, SIN_TABLE.map((r, i) => ["pos " + i, r]), { head: dims(DIM), q: ans === RIGHT ? null : (i, j) => j === C && i >= 2 ? (i === P ? 2 : 1) : 0, hi: [P] })}
      <p class="task">Column d${C} is hidden from position 2 on. Work out the cell marked “?”: position ${P}, column d${C}.</p>
      <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`, RIGHT);
  }

  /* 6. The same thing in Python, as a stepped replay. */
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const [ln, ev, ch] = TRACE[k];
      if (ev === "r") fr.push({ ran: 8, ch: {}, end: true });
      else fr.push({ ran: TRACE[k - 1][0], ch });
    }
    return fr;
  })();
  const SAY = {
    1: ch => `Line 1 stacks the three word vectors, one row per word: man, bites, dog. Shape ${ch.x.length} × ${ch.x[0].length}.`,
    2: () => "<code>positions</code> is True, so line 3 will run.",
    3: ch => `Line 3 adds the slot vectors: row 0 gets slot 0, row 2 gets slot 2. Man's first row changed from ${TRACE[1][2].x[0].map(f2).join(", ")} to ${ch.x[0].map(f2).join(", ")}: exactly slot 0's ${SIN_TABLE[0].map(f2).join(", ")} added.`,
    4: () => "Line 4 makes queries, keys and values from x, which now carries the slots. From here on, every number depends on where each word sits.",
    5: ch => `Line 5: each word's query times every key, divided by √${DIM}. A 3 × 3 table of scores; row 0 is man reading the three words.`,
    6: ch => `Line 6: softmax turns each row into weights that add up to 1. Man, in slot 0, puts ${ch.weights[0][0].toFixed(2)} of its attention on itself.`,
    7: ch => `Line 7: each output row is a weighted sum of the value rows. Dog's row (the last) is ${ch.out[2].map(f2).join(", ")}, the same as in the run on screen 4 (${rowOf("sinusoid", MBD, "dog").map(f2).join(", ")}).`
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      const shown = Object.entries(f.ch);
      el.innerHTML = `<h1>The same thing in NumPy</h1>
        <p class="lead">This is the function that produced the numbers you saw, run on “${key(TRACE_WORDS)}” with <code>positions=True</code>. <code>VEC</code> holds the word vectors, <code>W_Q</code>, <code>W_K</code>, <code>W_V</code> the random weights, and <code>sinusoid(n, d)</code> builds the table from the last screen.</p>
        <p class="task">Step through to the end. Watch the one line that makes order visible.</p>
        ${kit.code(CODE, f.ran)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>after line <b>${f.ran}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${shown.length === 1 ? mat(kit, shown[0][1].map((r, j) => [TRACE_WORDS[j], r]), { title: shown[0][0], head: shown[0][0] === "scores" || shown[0][0] === "weights" ? ["", ...TRACE_WORDS] : dims(DIM), hi: f.ran === 3 ? [0, 1, 2] : [] }) : ""}
        ${kit.feedback(f.end ? `Line 8 returns <code>out</code>. The whole difference from plain self-attention is line 3, one addition. Set <code>positions=False</code> and lines 4 to 7 would see a set of words again.` : SAY[f.ran](f.ch))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. Compare the outputs after training: predict the order-blind model's accuracy. */
  function trained({ el, done, kit }) {
    ensureStyle();
    const chance = 1 / NOUNS.length;
    const right = last(T_NONE.acc);
    const opts = ["100%", "about 90%", `about ${pct(right)}`, `about ${pct(chance)}, a blind guess among ${NOUNS.length} nouns`];
    const RIGHT = 2;
    const table = () => kit.table(TRAIN.map(t => [t.pos === "none" ? "no positions" : t.pos === "sinusoid" ? "sinusoid" : "learned table",
      `${pct(last(t.acc))} right, loss ${last(t.loss)}; “${key(MBD)}” → ${t.answers[key(MBD)]}`]), { head: ["model", `after ${TRAIN_STEPS} steps`], title: "the three training runs" });
    const fb = [
      [`It cannot. “dog bites man” and “man bites dog” give the same summary vector, so the model must give both the same answer, and one of them is wrong.`, false],
      [`No amount of training gets past the pairs. Each report has a mirror twin with the same words, and the model gives the twins the same answer: one right, one wrong.`, false],
      [`Right. The ${T_NONE.reports} reports are ${PAIRS} mirror pairs. The model gives both twins the same answer, so it gets one of each pair right: ${pct(right)}. Its loss stopped at ${last(T_NONE.loss)}, which is ln 2 = ${Math.log(2).toFixed(4)} to three decimals: it narrowed the answer to the two nouns and could do no better than half-and-half.${table()}With either kind of position vector, the same model reached ${pct(last(T_SIN.acc))} within ${CURVE_EVERY} steps.`, true],
      [`It does better than guessing: it learns which two nouns are in the report. It just cannot tell which of them came first.`, false]
    ];
    single(el, done, kit, ans => `<h1>Train it and compare</h1>
      <p class="lead">A real training run. ${T_NONE.reports} reports, every “<i>doer</i> <i>verb</i> <i>receiver</i>” built from ${NOUNS.length} nouns (${NOUNS.join(", ")}) and ${VERBS.length} verbs (${VERBS.join(", ")}). The model: word vectors of ${TRAIN_DIM} numbers, one self-attention layer, the average, and a head that names the doer. Trained for ${TRAIN_STEPS} steps on all ${T_NONE.reports} reports, three times: with no positions, with sinusoid positions, with a learned table.</p>
      <p class="task">The model with no positions is tested on the very reports it trained on. How many does it get right?</p>
      <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`, RIGHT);
  }

  /* 8. Sinusoid or learned table: the length limit. */
  function learnedTable({ el, done, kit }) {
    ensureStyle();
    const extra = T_LRN.params - T_SIN.params;
    const opts = [
      "It works: position 599 wraps round to position 87",
      "There are no rows for positions 512 to 599: cut or split the report, or add rows and train them",
      "The model switches to sinusoid vectors for the extra positions",
      "Attention ignores the position for words past 512"
    ];
    const fb = [
      ["Nothing wraps. A learned table is a lookup: row 0, row 1, … up to the last row. The position ids must be inside that range.", false],
      ["Right. A learned table has a fixed number of rows. The Hugging Face BERT docs describe <code>max_position_embeddings</code> (default 512) as the maximum sequence length the model might ever be used with, and position ids must be between 0 and that number minus 1. Added rows would start untrained. So you chunk long reports, or pick a model trained with longer inputs.", true],
      ["There is no fallback. The model has exactly one way to get a position vector: look up its row in the table.", false],
      ["Every token needs a position vector before attention runs. There is no rule that skips positions; the lookup simply has no row to return.", false]
    ];
    single(el, done, kit, ans => `<h1>Computed or learned?</h1>
      <p class="lead">The second option is a <b>learned table</b>: one trainable vector per slot, looked up like a word vector, and trained with everything else. In our run it added ${extra} numbers (${extra / TRAIN_DIM} slots × ${TRAIN_DIM}) and reached the same ${pct(last(T_LRN.acc))} as the sinusoids. The Transformer paper also found the two “nearly identical”. It chose sinusoids because they <i>may</i> allow the model to handle longer inputs than it saw in training: you can compute the vector for any position. Whether the model then reads it well is not promised.</p>
      <p class="task">Your summarizer uses a learned table with 512 rows. A 600-token report arrives. What happens?</p>
      <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`, 1);
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const cA = run("none-causal", DBM)[1][0], cB = rowOf("none-causal", MBD, "dog");
    const opts = [
      "Summarize a witness statement into “who did what”",
      "Flag a seized bag for a closer search from the list of items found in it, written down in whatever order the officers took them out",
      "Translate a report from Spanish into English"
    ];
    const fb = [
      ["Here order is the whole point: who did what is carried by word order. This one needs position vectors.", false],
      ["Right. The list is a set: the same items in another order mean the same thing. Order-blindness is what you want, so leave the position vectors out. Adding them would let the model learn from an order that means nothing.", true],
      ["“Police found the man” and “the man found police” translate differently. Translation needs the order.", false]
    ];
    single(el, done, kit, ans => `<h1>When to add positions</h1>
      <p class="lead"><b>For:</b> any attention model over a sequence where order carries meaning: text, audio frames, events in time.</p>
      <p class="lead"><b>Not</b> when the input is a set (order means nothing), and not for models that already read in order, such as an RNN. A causal mask also leaks some order: in our run with a mask and no positions, dog's row was ${same(cA, cB) ? "the same" : "different"} in the two reports, and research found such models can learn positions from the mask.</p>
      <p class="lead"><b>Costs:</b> sinusoids cost nothing to train; a learned table adds a vector per slot and fixes the longest input; neither promises good results past the lengths seen in training.</p>
      <p class="task">Which of these should <b>not</b> get position vectors?</p>
      <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`, 1);
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A rental-contract checker uses a transformer encoder to flag clauses. It must tell “the tenant pays the landlord” from “the landlord pays the tenant”.", true,
      "Yes. The same words in another order mean the opposite. Without positions, the encoder's rows for these two clauses would be the same rows, shuffled.",
      "Both clauses use exactly the same words. Plain attention sees them as the same set, so only position vectors let the checker tell them apart."],
    ["An LSTM tags shipping notes. It reads the words one at a time, left to right, and carries a hidden state.", false,
      "No. An LSTM reads word 1 before word 2, so the order is built into its steps. The Transformer paper adds positions because attention has no recurrence; an LSTM has it.",
      "The LSTM's hidden state after “tenant pays” differs from the one after “pays tenant”: order comes from the reading itself. Position vectors fix a problem this model does not have."],
    ["A voice-command model splits audio into short frames and runs self-attention over all frames at once.", true,
      "Yes. “Lights on, alarm off” and “alarm on, lights off” differ only by order in time. Attention over frames is as order-blind as attention over words.",
      "Frames are just vectors to attention, like words. Shuffle them and the outputs shuffle too. Something must say which frame came first: position vectors."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Does it need positions?</h1>
        <p class="lead">Three models from other teams.</p>
        <p class="task">Does each one need position vectors added to its inputs? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>Order, restored</h1>
      <p class="lead">You saw that plain self-attention treats a report as a set of words, so “${key(DBM)}” and “${key(MBD)}” got one summary. Adding one vector per slot before attention, computed from sines and cosines or learned as a table, made the order visible, and the trained model went from ${pct(last(T_NONE.acc))} to ${pct(last(T_SIN.acc))}.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>sinusoid(n, d)</code>, add it before attention, and show that shuffling the words now changes the output.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The position vectors you added go in once, before the first block reads the words.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Positional encoding: telling word order apart",
    checked: "2026-11-14",
    sources: [
      "https://arxiv.org/abs/1706.03762",
      "https://huggingface.co/docs/transformers/model_doc/bert",
      "https://arxiv.org/abs/2203.16634",
      "https://arxiv.org/abs/1810.00825",
      "https://arxiv.org/abs/2104.09864"
    ],
    interview: [
      {
        q: "A transformer classifier you inherited gives the same label to “the customer refunded the shop” and “the shop refunded the customer”. What do you check?",
        good: [
          "Whether position vectors are added at all, or added after attention instead of before it",
          "Whether the position ids are right: all zeros, or reset by padding, makes every slot look the same",
          "A quick test: shuffle the words of an input and see whether the output changes",
          "Whether pooling is an average over words, which hides order if the rows did not carry it",
          "Whether the training data even has pairs that differ only by order"
        ],
        weak: "Add more training data or a bigger model. Without positions no amount of training separates two inputs with the same words."
      },
      {
        q: "Your team's encoder has a learned position table of 512 rows, and product now wants 2,000-token documents. What are your options?",
        good: [
          "The table has no rows past 511, so the input must be cut, chunked or slid over with a window",
          "Adding rows means new, untrained vectors; the model needs training on long inputs before they mean anything",
          "Switch to a model trained with longer inputs and a position scheme meant for them, such as sinusoids or rotary embeddings",
          "Whatever the scheme, test quality on real long documents; computable positions do not promise good results past the trained length"
        ],
        weak: "Just change max_position_embeddings to 2048 in the config. The new rows are untrained, so the model reads them as noise."
      }
    ],
    screens: [situation, shuffle, spotIdea, addPositions, sinusoids, asCode, trained, learnedTable, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-o=\"5\"]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
