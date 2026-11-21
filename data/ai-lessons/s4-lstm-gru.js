/* Lesson: LSTM and GRU, gates that decide what to keep. Story: a code editor plugin reads a long line of JSON one
   character at a time and must say, at the end, whether a bracket is still open.
   Ideas: (1) a gated memory cell, c = forget * c + input * new, keeps a value for many steps when the forget gate
   stays near 1, and the gates are computed from each character, so the network can keep on ordinary characters
   and erase on a closing bracket; (2) that additive path is what lets training reach back across a long gap,
   where a plain RNN trained on the same lines learns nothing. LSTM and GRU in PyTorch, what they cost, when not.
   Data, all real:
   - docs/ai-path/runs/s4-lstm-gru/brackets.py + brackets.out.txt: a plain RNN, an LSTM and a GRU (hidden size 16)
     trained in PyTorch on CPU on the same bracket task (training gaps 0-40, and a plain RNN on gaps 0-10), test
     accuracy at gaps 5, 20, 40, 80, parameter counts, and a gate trace of the trained LSTM recomputed from its
     weights and checked against nn.LSTM's own output. env.txt has the versions. Re-run in review on 2026-11-14 after
     shortening the class listing: every accuracy, count and trace value identical; only the timings changed.
   - The by-hand screen is a one-number toy computed by this file (no run needed): c = f * c + i * write, h = o * tanh(c).
   No model API calls. Lesson-local style: slider-like button rows and a small trace table (.lx-s4-lstm-gru-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s4-lstm-gru";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s4-lstm-gru.ipynb";
  const f3 = v => v.toFixed(3);
  const f2 = v => v.toFixed(2);
  // short cell label so 10 boxes fit at phone width: 1, .43, 0
  const sh = v => { const t = v.toFixed(2); return t === "1.00" ? "1" : t === "0.00" ? "0" : t.replace(/^0/, ""); };

  /* ---------- Data copied from docs/ai-path/runs/s4-lstm-gru/brackets.out.txt ---------- */
  const RUN = {
    torch: "2.15.0", steps: 1000, batch: 64, hidden: 16, gaps: [5, 20, 40, 80],
    // test accuracy at step 1000, one value per test gap
    acc: {
      "RNN-40": [0.488, 0.518, 0.486, 0.560],
      "LSTM-40": [1.000, 1.000, 1.000, 1.000],
      "GRU-40": [1.000, 1.000, 1.000, 1.000],
      "RNN-10": [1.000, 1.000, 1.000, 1.000]
    },
    // first logged step (every 200) at which all four test gaps were 1.000
    firstPerfect: { "LSTM-40": 200, "GRU-40": 200, "RNN-10": 200 },
    params: { RNN: 416, LSTM: 1664, GRU: 1248 },
    // timings from the review re-run on 2026-11-14 (accuracies and counts identical to the first run)
    seconds: { "RNN-40": 6.0, "LSTM-40": 17.5, "GRU-40": 8.7, "RNN-10": 3.4 }
  };
  // Gate trace, LSTM trained on gaps 0-40, unit 7. [t, char, input, forget, output, cell]
  const UNIT = 7;
  const TRACE_OPEN = { line: '{"a"a,"1"::: :a":"::," :1 a,"1""" ,": a: ",a', rows: [
    [0, "{", 0.789, 0.944, 0.868, -0.718], [1, '"', 0.716, 0.974, 0.876, -1.269], [2, "a", 0.970, 0.925, 0.967, -1.927],
    [3, '"', 0.810, 0.997, 0.976, -2.715], [4, "a", 0.987, 0.967, 0.982, -3.578], [5, ",", 0.966, 0.984, 0.967, -4.455],
    [9, ":", 0.990, 0.972, 0.980, -7.858], [19, ":", 0.985, 0.970, 0.978, -14.728], [29, "1", 0.970, 0.990, 0.969, -21.299],
    [39, ":", 0.986, 0.973, 0.980, -26.836], [43, "a", 0.983, 0.971, 0.981, -28.781]],
    fillerForget: { n: 40, min: 0.967, mean: 0.984 }, prediction: "open" };
  const TRACE_CLOSED = { line: '{}, a,"1"::: :a":"::," :1 a,"1""" ,": a: ",a', rows: [
    [0, "{", 0.789, 0.944, 0.868, -0.718], [1, "}", 0.956, 0.417, 0.890, 0.149], [2, ",", 0.800, 0.923, 0.882, 0.786],
    [3, " ", 0.796, 0.970, 0.973, 1.556], [4, "a", 0.703, 0.942, 0.980, 2.166], [5, ",", 0.514, 0.973, 0.968, 2.621],
    [9, ":", 0.481, 0.935, 0.969, 3.403], [19, ":", 0.678, 0.953, 0.981, 6.778], [29, "1", 0.277, 0.978, 0.956, 9.252],
    [39, ":", 0.679, 0.954, 0.980, 10.510], [43, "a", 0.630, 0.949, 0.982, 11.179]],
    fillerForget: { n: 40, min: 0.935, mean: 0.971 }, prediction: "closed" };

  // The class from brackets.py, line for line (lines kept short so it fits a phone screen).
  const CODE = [
    "class BracketReader(nn.Module):",
    "    def __init__(self, kind, size=16):",
    "        super().__init__()",
    "        self.embed = nn.Embedding(8, 8)",
    "        Layer = getattr(nn, kind)",
    "        self.rnn = Layer(input_size=8,",
    "                         hidden_size=size,",
    "                         batch_first=True)",
    "        self.head = nn.Linear(size, 1)",
    "",
    "    def forward(self, chars):",
    "        out, _ = self.rnn(self.embed(chars))",
    "        return self.head(out[:, -1])[:, 0]"
  ];

  /* ---------- The toy cell for the by-hand screen (computed here) ---------- */
  const TOY_LINE = '{"ab":12,';           // a bracket, then 8 more characters
  const TOY_CLOSED = '{"a":1},"b';         // a bracket opened and closed, one character longer
  const READ_AT = 0.5;                     // the plugin says "open" when h >= 0.5
  const F_OPTS = [0, 0.5, 0.9, 1], I_OPTS = [0, 0.5, 1], O_OPTS = [0, 0.5, 1];
  // write = 1 on "{", 0 on every other character; c starts at 0
  function runToy(line, f, i) {
    let c = 0; const cs = [];
    for (const ch of line) { c = f * c + i * (ch === "{" ? 1 : 0); cs.push(c); }
    return cs;
  }
  const readOut = (o, c) => o * Math.tanh(c);
  const AFTER = TOY_LINE.length - 1;       // characters after the bracket

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-knob { margin: 14px 0 0; }
      .lx-${ID}-knob > p { margin: 0 0 6px; font-size: 15.5px; }
      .lx-${ID}-knob .lx-${ID}-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .lx-${ID}-knob button { min-height: 44px; min-width: 64px; padding: 0 14px; font: 600 15px var(--mono); color: var(--ink);
        background: var(--surface); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; }
      .lx-${ID}-knob button[aria-pressed="true"] { border: 3px solid var(--ink); }
      .lx-${ID}-eq { font: 500 14.5px/1.6 var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line);
        border-radius: 8px; padding: 10px 12px; margin: 12px 0 0; overflow-wrap: anywhere; }
      .lx-${ID}-run { margin: 16px 0 0; min-height: 44px; }
      .lx-${ID}-trace { width: 100%; border-collapse: collapse; margin: 12px 0 0; font: 500 14px/1.4 var(--mono); }
      .lx-${ID}-trace th, .lx-${ID}-trace td { text-align: right; padding: 6px 6px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-trace th { font: 600 12.5px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .lx-${ID}-trace td:first-child, .lx-${ID}-trace th:first-child { text-align: left; }
      .lx-${ID}-trace tr.lx-${ID}-on td { font-weight: 700; border-bottom: 2px solid var(--ink); }
      .lx-${ID}-trace caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 4px; }
      .lx-${ID}-line { font: 500 14px/1.5 var(--mono); overflow-wrap: anywhere; background: var(--sunk); border: 1px solid var(--line);
        border-radius: 8px; padding: 8px 10px; margin: 10px 0 0; }
      .lx-${ID}-checks { margin: 10px 0 0; padding: 0; list-style: none; }
      .lx-${ID}-checks label { display: flex; gap: 10px; align-items: center; min-height: 44px; font-size: 15.5px; line-height: 1.4; cursor: pointer; }
      .lx-${ID}-checks input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 14px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -12px; }
      .lx-${ID}-checks input:checked { background-color: var(--good); outline-color: var(--good); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  const knob = (kit, key, label, opts, val) => `<div class="lx-${ID}-knob"><p>${label}</p><div class="lx-${ID}-row">${opts.map((v, k) =>
    `<button type="button" data-g="${key}" data-v="${k}" aria-pressed="${v === val}">${v}</button>`).join("")}</div></div>`;
  const lineBox = (kit, s) => `<div class="lx-${ID}-line">${kit.esc(s)}</div>`;
  const traceTable = (kit, tr, cols, on, caption) => `<table class="lx-${ID}-trace"><caption>${kit.esc(caption)}</caption><thead><tr><th>step</th><th>char</th>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tr.rows.map(r =>
    `<tr${on.includes(r[0]) ? ` class="lx-${ID}-on"` : ""}><td>${r[0]}</td><td>${kit.esc(JSON.stringify(r[1]))}</td>${cols.map(c => `<td>${({ input: f3(r[2]), forget: f3(r[3]), output: f3(r[4]), cell: (r[5] > 0 ? "+" : "") + f3(r[5]) })[c]}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const accAt = (key, gap) => RUN.acc[key][RUN.gaps.indexOf(gap)];

  /* 1. The situation, and the gate sliders by hand. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    let f = 0.5, i = 1, o = 1, ran = null;
    const paint = () => {
      const cs = ran ? runToy(TOY_LINE, ran.f, ran.i) : null;
      const h = ran ? readOut(ran.o, cs[cs.length - 1]) : null;
      let fb = "";
      if (ran) {
        const c = cs[cs.length - 1];
        const ok = h >= READ_AT;
        if (ok) fb = kit.feedback(`The plugin reads h = ${f2(ran.o)} × tanh(${f2(c)}) = <b>${f2(h)}</b>, at least ${READ_AT}: “bracket open”. Forget at ${ran.f} copies the cell forward unchanged on each of the ${AFTER} characters after the bracket. The output dial then lets the plugin read it at the end. That is the whole trick of a <b>memory cell</b>. The forget dial decides how much of it is carried forward, the input dial adds to it, and the output dial is the only way to read it.`, true);
        else if (ran.i === 0) fb = kit.feedback(`The input dial decides how much of the bracket gets <b>written</b> into the cell. At 0 nothing is written, so the cell stays ${f2(c)} all the way and the plugin reads h = ${f2(h)}: it never noticed the bracket.`, false);
        else if (ran.f < 1) fb = kit.feedback(`The bracket was written (cell ${f2(cs[0])} after the first character), then multiplied by ${ran.f} on each of the next ${AFTER} characters: ${f2(cs[0])} × ${ran.f}<sup>${AFTER}</sup> = ${f2(c)}. The plugin reads h = ${f2(h)}, under ${READ_AT}, so it says “closed”. ${ran.f >= 0.9 ? `${ran.f} sounds close to 1, but it shrinks the value at every step, the same way gradients shrank in the last lesson.` : "The memory fades long before the end of the line."}`, false);
        else if (ran.o === 0) fb = kit.feedback(`The cell holds ${f2(c)}, so the memory is there. But the output dial at 0 hides it: h = 0 × tanh(${f2(c)}) = ${f2(h)}. Remembering and reading are separate dials.`, false);
        else fb = kit.feedback(`The cell kept ${f2(c)} to the end, but only half the bracket was written or read: h = ${f2(ran.o)} × tanh(${f2(c)}) = ${f2(h)}, under ${READ_AT}. Write it fully and read it fully.`, false);
      }
      el.innerHTML = `<h1>Is a bracket still open?</h1>
        <p class="lead">A code editor plugin checks long lines of JSON as you type. It reads one character at a time. At the end of the line it must say whether a bracket is still open. A plain recurrent network (RNN) kept losing a bracket opened early in a long line, because its memory, one number per unit, is rewritten at every character. This lesson builds the fix: the gated memory inside LSTM and GRU layers, used for any sequence that a model reads step by step.</p>
        <p class="lead">Here is a memory with three dials instead. One number, the <b>cell</b> <code>c</code>, starts at 0. At each character:</p>
        <div class="lx-${ID}-eq">c = forget × c + input × write<br>(write = 1 on “{”, 0 on anything else)<br>at the end: h = output × tanh(c), and h ≥ ${READ_AT} means “open”</div>
        ${lineBox(kit, TOY_LINE)}
        <p class="task">The bracket is the first character, followed by ${AFTER} more. Set the three dials so the plugin still says “open” at the end, then run the line.</p>
        ${knob(kit, "f", "forget: how much of the old cell to keep", F_OPTS, f)}
        ${knob(kit, "i", "input: how much of the new character to write", I_OPTS, i)}
        ${knob(kit, "o", "output: how much of the cell to show at the end", O_OPTS, o)}
        <button type="button" class="btn lx-${ID}-run" data-run>Run the line</button>
        ${cs ? kit.cells(cs.map(sh), { labels: [...TOY_LINE], cls: { [cs.length - 1]: "next" } }) : ""}
        ${cs ? `<p class="lx-${ID}-cap">The boxes show the cell after each character, to two decimals.</p>` : ""}
        <div class="lpanel">${fb}</div>`;
      el.querySelectorAll("[data-g]").forEach(b => b.onclick = () => {
        const k = +b.dataset.v;
        if (b.dataset.g === "f") f = F_OPTS[k]; else if (b.dataset.g === "i") i = I_OPTS[k]; else o = O_OPTS[k];
        paint();
      });
      el.querySelector("[data-run]").onclick = () => {
        ran = { f, i, o }; paint();
        const cs2 = runToy(TOY_LINE, f, i);
        if (readOut(o, cs2[cs2.length - 1]) >= READ_AT) done();
      };
    };
    paint();
  }

  /* 2. Spot the idea: fixed dials cannot also forget a closed bracket. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const cs = runToy(TOY_CLOSED, 1, 1);
    const h = readOut(1, cs[cs.length - 1]);
    const opts = [
      "Lower forget to 0.9 for every character",
      "Let each character set the dials: forget near 1 on ordinary characters, near 0 on “}”",
      "Make write bigger on “{”, so the bracket is stored more strongly",
      "Lower the output dial so the end value is smaller"
    ];
    const fbs = [
      [`You saw that one on the first screen: 0.9 on every character shrinks an open bracket to ${f2(runToy(TOY_LINE, 0.9, 1)[AFTER])} after ${AFTER} characters, so open lines would fail instead. A dial that is the same at every step cannot both keep and erase.`, false],
      [`Right. The dials must depend on what is being read. In a real <b>LSTM</b> (long short-term memory) the three dials are the <b>gates</b>. Each gate is computed at every step from the current character and the previous output, using learned weights. A sigmoid then squashes it into a number between 0 and 1. Training finds weights that keep the cell on ordinary characters and erase it on a closing bracket. Nobody types those rules in.`, true],
      ["Storing it more strongly makes the problem worse: the closed bracket would be remembered even harder. The issue is that nothing ever erases it.", false],
      [`The output dial scales every line the same way. An open line and this closed line hold the same cell value (${f2(cs[cs.length - 1])}), so any output setting reads them the same.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Now forget it again</h1>
        <p class="lead">Keep your winning dials (forget 1, input 1, output 1) and run a line where the bracket opens and then closes:</p>
        ${lineBox(kit, TOY_CLOSED)}
        ${kit.cells(cs.map(sh), { labels: [...TOY_CLOSED], cls: { [cs.length - 1]: "no" } })}
        <p class="lx-${ID}-cap">The boxes show the cell after each character.</p>
        <p class="lead">The plugin reads h = ${f2(h)} and says “open”. Wrong: the “}” closed it. With forget fixed at 1, nothing can ever leave the cell.</p>
        <p class="task">What change lets the same cell keep an open bracket for many characters and still drop a closed one?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fbs)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Use it with predictions: what a trained LSTM's gates really did. */
  function realGates({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null; // 0: forget at "}", 1: sign of the closed cell, 2: finished
    const close = TRACE_CLOSED.rows[1], openEnd = TRACE_OPEN.rows[TRACE_OPEN.rows.length - 1], closedEnd = TRACE_CLOSED.rows[TRACE_CLOSED.rows.length - 1];
    const Q = [
      { q: `On the open line, the forget gate of this unit stayed between ${f3(TRACE_OPEN.fillerForget.min)} and 1 on all ${TRACE_OPEN.fillerForget.n} filler characters. Step 1 of the closed line is “}”. What did its forget gate do there?`,
        opts: ["Stayed near 1, like on the filler", `Dropped, to about ${f2(close[3])}`, "Went to exactly 0"], right: 1,
        fb: ["If it stayed near 1, the “{” written at step 0 would be carried forward and the line would read as open. Something has to let go of it.", null,
          "A sigmoid gate gives a value between 0 and 1 and never reaches exactly 0. Training only has to push it low enough to let go of most of the old cell."] },
      { q: `At the end of the open line the cell is ${f3(openEnd[5])}. What do you expect at the end of the closed line, which has the same ${TRACE_OPEN.fillerForget.n} filler characters?`,
        opts: [`About the same, near ${f2(openEnd[5])}`, "Near 0", "On the other side of 0"], right: 2,
        fb: ["Then the plugin could not tell the two lines apart, and the recorded predictions differ: “open” and “closed”.",
          "A plausible guess from the toy, where 0 meant “nothing open”. The trained unit did something else: after the drop at “}” it kept writing in the other direction. Look at the cell column.", null] }
    ];
    const paint = () => {
      const fin = stage >= Q.length;
      const tr = stage === 0 ? { rows: TRACE_CLOSED.rows.slice(0, 1) } : TRACE_CLOSED;
      const q = Q[Math.min(stage, Q.length - 1)];
      el.innerHTML = `<h1>What the trained gates did</h1>
        <p class="lead">We trained a real LSTM in PyTorch with ${RUN.hidden} hidden units on lines like the plugin's, Then we recomputed its gates from the learned weights, character by character, for two lines. Both lines start with 4 characters, then have the same ${TRACE_OPEN.fillerForget.n} <b>filler</b> characters (no brackets). The tables follow one of the ${RUN.hidden} units, unit ${UNIT}: its gates, and its cell value after each character. The open line:</p>
        ${lineBox(kit, TRACE_OPEN.line)}
        ${traceTable(kit, { rows: TRACE_OPEN.rows.filter((r, k) => k === 0 || k >= TRACE_OPEN.rows.length - 2) }, ["forget", "cell"], [], `Open line, unit ${UNIT} (steps 0 and the last two; real run)`)}
        <p class="lead">The closed line starts “{}”:</p>
        ${lineBox(kit, TRACE_CLOSED.line)}
        ${traceTable(kit, fin ? TRACE_CLOSED : stage === 1 ? { rows: TRACE_CLOSED.rows.slice(0, 2) } : tr, ["input", "forget", "cell"], fin ? [1] : stage === 1 ? [1] : [], `Closed line, unit ${UNIT} (real run)`)}
        ${fin ? "" : `<p class="task">${q.q}</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`Right. At “}” the forget gate fell to ${f3(close[3])}, letting go of more than half of the cell, and the input gate (${f3(close[2])}) wrote the new state. After that the forget gate stayed high again (${f3(TRACE_CLOSED.fillerForget.min)} or more on the filler). The two lines end at ${f3(openEnd[5])} and ${(closedEnd[5] > 0 ? "+" : "") + f3(closedEnd[5])}: <b>the sign</b> carries “open” or “closed”, and the model predicted “${TRACE_OPEN.prediction}” and “${TRACE_CLOSED.prediction}”. This is one of ${RUN.hidden} units, and it learned its own way to store the bit; nobody chose “negative means open”. The idea is the one you used with the dials: keep with forget near 1, erase with forget low, chosen per character.`, true)
          : `${kit.options(q.opts, { picked: wrong, correct: q.right })}${wrong == null ? "" : kit.feedback(q.fb[wrong], false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const k = +b.dataset.i;
        if (k !== Q[stage].right) { wrong = k; paint(); return; }
        wrong = null; stage++; paint(); if (stage >= Q.length) done();
      });
    };
    paint();
  }

  /* 4. Predict the recorded training results: plain RNN against LSTM and GRU. */
  function trainingRace({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Near 1.0 at every gap", "Near 1.0 at gap 5, worse at longer gaps", "Near 0.5 at every gap, even gap 5"];
    const fbs = [
      ["That is what the LSTM and the GRU did. The plain RNN did not get there in the same 1,000 training steps.", false],
      ["The natural guess, and not what happened. Look at gap 5: the plain RNN failed even on short lines.", false],
      [null, true]
    ];
    const rows = ["RNN-40", "LSTM-40", "GRU-40"];
    const table = () => `<table class="lx-${ID}-trace"><caption>Test accuracy after ${RUN.steps.toLocaleString("en")} steps (real run, 500 test lines per gap)</caption><thead><tr><th>model</th>${RUN.gaps.map(g => `<th>gap ${g}</th>`).join("")}</tr></thead><tbody>${rows.map(k =>
      `<tr><td>${k.split("-")[0]}</td>${RUN.acc[k].map(a => `<td>${f3(a)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const paint = () => {
      el.innerHTML = `<h1>Plain RNN against LSTM and GRU</h1>
        <p class="lead">Same task, three models with ${RUN.hidden} hidden units each: a plain recurrent network (RNN), an LSTM, and a <b>GRU</b> (a lighter gated cell, explained a few screens on). Each line starts with 4 characters. They open a bracket, or open and close one, or have no bracket. Then comes the <b>gap</b>: a number of filler characters. Training lines had gaps from 0 to 40 characters. The test sets use gaps of ${RUN.gaps.join(", ")}; 80 is longer than any training line. <b>Test accuracy</b> is the share of test lines the model got right. About half the test lines are open, so guessing scores about 0.5.</p>
        <p class="task">The LSTM and GRU reached 1.000 at every gap. What did the plain RNN score?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fbs.map((x, k) => k === 2 ? [`Right: ${RUN.acc["RNN-40"].map(f3).join(", ")}, a coin toss everywhere. The LSTM and the GRU were already at 1.000 on all four gaps at step ${RUN.firstPerfect["LSTM-40"]}, the first time the run checked. ${table()}Why would the plain RNN fail even at gap 5? The next screen shows it.`, true] : x))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 5. The twist: the plain RNN can hold the bit, it could not learn to. */
  function whyGatesTrain({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A plain RNN cannot store one bit for 80 characters",
      "With long gaps in training, the error signal (the gradient) had to travel back through many steps and faded before it reached the bracket",
      "The plain RNN has too few weights",
      "The test lines were longer than the training lines"
    ];
    const fbs = [
      [`This run says it can: trained on short gaps, it scored ${f3(accAt("RNN-10", 80))} at gap 80. Storing was never the problem.`, false],
      [`Right, and it is the standard explanation for this failure (Pascanu, Mikolov and Bengio describe it as making it “impossible for the model to learn correlation between temporally distant events”). To learn “look back at the bracket”, the error at the end must flow back to step 0. In a plain RNN it passes through tanh and the same weights at every step, and (as you saw last lesson) a factor below 1, repeated 40 times, leaves almost nothing. Most training lines had long gaps, so the RNN never got a usable signal. In an LSTM the cell path is <code>c = f × c + i × g</code>, where <code>g</code> is the new value to write. Going back one step multiplies the signal along the cell by the forget gate <code>f</code>. While <code>f</code> is near 1, the signal passes almost whole. That is why gated cells can learn long-range links that a plain RNN fails to learn, even though a trained plain RNN can hold them.`, true],
      [`More weights would not explain this: the same ${RUN.params.RNN}-weight RNN learned the task perfectly when the training lines were short.`, false],
      [`Gap 80 is longer than any training line, yet the short-trained RNN scored ${f3(accAt("RNN-10", 80))} there. And the long-trained one failed at gap 5, which was inside its training range.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>It could hold the bracket</h1>
        <p class="lead">One more run: the same plain RNN, same settings, but trained only on lines with gaps from 0 to 10.</p>
        <table class="lx-${ID}-trace"><caption>Test accuracy after ${RUN.steps.toLocaleString("en")} steps (real run)</caption><thead><tr><th>plain RNN trained on</th>${RUN.gaps.map(g => `<th>gap ${g}</th>`).join("")}</tr></thead><tbody>
          <tr><td>gaps 0–40</td>${RUN.acc["RNN-40"].map(a => `<td>${f3(a)}</td>`).join("")}</tr>
          <tr><td>gaps 0–10</td>${RUN.acc["RNN-10"].map(a => `<td>${f3(a)}</td>`).join("")}</tr></tbody></table>
        <p class="lead">Trained on short lines, it carries the bracket across 80 characters without a mistake.</p>
        <p class="task">So what went wrong when it was trained on gaps up to 40?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fbs)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 6. The PyTorch code, and what the gates cost in weights. */
  function inPyTorch({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null;
    const P = RUN.params;
    const Q = [
      { q: `The plain RNN layer has ${P.RNN} weights. The LSTM layer computes four things at every step (input, forget and output gates, and the new value to write), each from its own weights of the same shape. How many weights does it have?`,
        opts: [P.RNN, 2 * P.RNN, 3 * P.RNN, 4 * P.RNN], key: "LSTM" },
      { q: `The GRU computes three things per step (two gates and the new value). How many weights?`,
        opts: [P.RNN, 2 * P.RNN, 3 * P.RNN, 4 * P.RNN], key: "GRU" }
    ];
    const paint = () => {
      const fin = stage >= Q.length;
      const q = Q[Math.min(stage, Q.length - 1)];
      const right = fin ? -1 : q.opts.indexOf(P[q.key]);
      el.innerHTML = `<h1>The same model, three layers</h1>
        <p class="lead">This is the model from the run. Only <code>kind</code> changes between the three: <code>getattr(nn, kind)</code> picks the layer class by its name: <code>nn.RNN</code>, <code>nn.LSTM</code> or <code>nn.GRU</code>.</p>
        <p class="lead"><code>nn.Embedding(8, 8)</code> gives each of the 8 possible characters its own 8 numbers. <code>input_size</code> is that 8. <code>hidden_size</code> is how many units carry memory (${RUN.hidden} here). <code>batch_first=True</code> means the input is shaped (lines, characters, 8 numbers per character). The layer returns an output for every step; <code>out[:, -1]</code> keeps only the last step, where the plugin decides, and <code>[:, 0]</code> leaves one score per line.</p>
        ${kit.code(CODE, fin ? 5 : 4)}
        <p class="lead">An <code>nn.LSTM</code> returns <code>output, (h_n, c_n)</code>: the outputs plus the final hidden state and the final cell. <code>nn.RNN</code> and <code>nn.GRU</code> return <code>output, h_n</code>, with no cell. The <code>_</code> in <code>out, _ =</code> throws the second part away, so one <code>forward</code> works for all three.</p>
        ${fin ? "" : `<p class="task">${q.q}</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`Right: the run printed ${P.RNN}, ${P.LSTM} and ${P.GRU}. The LSTM has ${P.LSTM / P.RNN} times the weights of the plain RNN at the same <code>hidden_size</code>, and the GRU ${P.GRU / P.RNN} times, so a GRU of the same size is ${P.GRU / P.LSTM * 100}% of an LSTM. More weights per step also means more work per step: in this run the LSTM took ${RUN.seconds["LSTM-40"]} seconds and the GRU ${RUN.seconds["GRU-40"]} for the same ${RUN.steps.toLocaleString("en")} steps on a laptop CPU. Timings change from run to run on a shared machine, so read them as rough.`, true)
          : `${kit.options(q.opts.map(String), { picked: wrong, correct: right, num: true })}${wrong == null ? "" : kit.feedback(q.opts[wrong] < P[q.key]
            ? `Too few. Every gate has its own input weights, its own weights for the previous output, and its own biases, just like the one block the plain RNN has. Count the blocks.`
            : `Too many. Count what this layer computes per step: each item is one block of ${P.RNN} weights.`, false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const k = +b.dataset.i;
        if (k !== right) { wrong = k; paint(); return; }
        wrong = null; stage++; paint(); if (stage >= Q.length) done();
      });
    };
    paint();
  }

  /* 7. The GRU: one state, an update gate that mixes old and new. */
  function gruGate({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["z near 0", "z near 1", "z at 0.5"];
    const fbs = [
      ["With z near 0, h becomes (1 − 0) × n: all new value, nothing of the old state. On every filler character the bracket would be overwritten, which is the plain RNN's habit.", false],
      [`Right. With z near 1, h is almost all old state: the bracket passes through the filler, the way the LSTM's cell did with forget near 1. The GRU folds “forget” and “input” into one gate (keep z of the old, take 1 − z of the new), drops the separate cell and the output gate, and adds a reset gate r that decides how much of the old state is used when computing n. That is why it has three blocks of weights instead of four. In this run both learned the task equally well; which one wins on a real task is something you test, not something you know in advance.`, true],
      [`At 0.5 on every character, half of the old state is lost at each step: 0.5<sup>${AFTER}</sup> is ${(0.5 ** AFTER).toFixed(4)} after only ${AFTER} characters.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The GRU: one state, one mixing gate</h1>
        <p class="lead">The GRU (gated recurrent unit) has no separate cell. It keeps one state <code>h</code> and, at each step, computes a candidate <code>n</code> (a proposed new state) from the character. Then it mixes old and new, as the PyTorch documentation writes it:</p>
        <div class="lx-${ID}-eq">h = (1 − z) × n + z × h_previous</div>
        <p class="lead"><code>z</code> is the <b>update gate</b>, between 0 and 1, computed from the character and the previous state.</p>
        <p class="task">On an ordinary filler character after an open bracket, what should z be for the GRU to keep the bracket?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fbs)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The weights: an LSTM has four times the plain RNN's",
      "Training time: each step must wait for the step before it, so a long line cannot be spread across a GPU's parallel units",
      "Memory: the state the model carries grows with the length of the line"
    ];
    const fbs = [
      ["True, but it is a fixed factor at a given size. It does not get worse as the lines get longer.", false],
      ["Right. Step 50 needs the state from step 49, so the steps of one line run one after another. The paper that introduced the Transformer names exactly this: the sequential nature “precludes parallelization within training examples”. Attention, in the next unit, removes that chain.", true],
      [`The state the model carries is a fixed size (here ${RUN.hidden} numbers, plus ${RUN.hidden} more for the LSTM's cell) however long the line is. Training does keep every step's values for the backward pass, so memory use grows with length, but only in proportion, and a bigger GPU helps with that. It does not help with steps that must wait for each other.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for LSTM or GRU</h1>
        <p class="lead"><b>For:</b> reading a sequence step by step when something early decides something late. <b>Reach for it</b> when data arrives as a stream and you need an answer at each step with a small, fixed-size memory: sensor readings, small on-device models, short time series. GRU first if you want fewer weights; LSTM if it scores better on your data.</p>
        <p class="lead"><b>Not</b> when an exact rule exists (counting brackets is a few lines of code, and it is never wrong), or for long text and most language tasks, where Transformers with attention are now the usual choice and train faster.</p>
        <p class="lead"><b>Costs:</b> training is slow because steps run in order; gates multiply the weights; and very long gaps are still hard.</p>
        <p class="task">Your team wants to train on a large set of very long logs, on a GPU. Which cost bites hardest as the logs get longer?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fbs)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A wake-word detector on a small battery device listens to audio frame by frame and must react within a fraction of a second, with very little memory.", true,
      "Yes, a reasonable fit. Frames arrive one at a time, an answer is needed at each step, and the state stays the same small size however long it listens. A GRU or LSTM fits that shape; a model that rereads the whole recent audio at every step costs more.",
      "Frames arrive one at a time and the device has little memory. A gated recurrent model keeps a fixed-size state and updates it once per frame, which is exactly what this needs."],
    ["Before a config file is saved, check that every “{” and “[” in it is closed.", false,
      "No. This has an exact rule: push on an opening bracket, pop on a closing one. A parser does it in microseconds and is never wrong. A trained model can only be nearly always right, and it needs training data and testing. We used brackets in this lesson because the right answer is easy to check, not because a network is the right tool for them.",
      "There is an exact rule here, and a stack or a JSON parser applies it with no mistakes. A network would be slower, need training, and still be wrong sometimes."],
    ["Answer questions about a 40-page contract, where the answer to a question may depend on a clause on page 3 and another on page 38.", false,
      "No. That is thousands of tokens between the two clauses, far longer than any gap in this lesson, and the model must look back at specific places. Attention (in the next unit) looks at any earlier position directly, and Transformer models built on it are the usual choice for long text.",
      "The gap is thousands of tokens, and the answer needs two exact places, not a summary carried forward. A recurrent model squeezes everything into its fixed-size state on the way. Attention can look straight back at page 3."],
    ["A factory machine reports pressure once a second. A short spike tends to come about a minute before a failure, and an alarm must fire as readings come in.", true,
      "Yes, a reasonable fit. A spike early must still count dozens of readings later, the data is a stream, and the alarm must decide at each reading. That is the long-gap, step-by-step shape gated cells are for. Try a GRU and an LSTM and compare on held-out data.",
      "Something early (the spike) decides something later (the alarm), and the answer is needed at each reading. A plain RNN would struggle to learn that gap; a gated cell is built for it."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>LSTM or GRU, or something else?</h1>
        <p class="lead">Four jobs from other teams.</p>
        <p class="task">Would you reach for an LSTM or GRU for each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const P = RUN.params;
    const checks = [
      `The plain RNN trained on gaps 0–40 stays near 0.5 test accuracy at every gap, up to step ${RUN.steps.toLocaleString("en")}.`,
      `The LSTM and the GRU reach 1.000 at all four test gaps (${RUN.gaps.join(", ")}) early in training; in our run, by step ${RUN.firstPerfect["LSTM-40"]}.`,
      `The printed weight counts are ${P.RNN} (RNN), ${P.LSTM} (LSTM) and ${P.GRU} (GRU).`,
      `The plain RNN trained on gaps 0–10 reaches 1.000, even at gap 80.`,
      `In the gate trace, one unit's forget gate drops well below the filler values at “}” (ours: ${f3(TRACE_CLOSED.rows[1][3])}), and the two lines end with cell values of opposite sign.`
    ];
    el.innerHTML = `<h1>Train them yourself</h1>
      <p class="lead">You set the gates by hand, saw a trained LSTM keep a bracket with its forget gate near 1 and drop it at “}”, and saw why a plain RNN never learned what it could have stored.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a>` : "The notebook for this lesson is on its way"}. It trains the same three models on the same bracket lines and prints the gate trace. Your numbers may differ slightly from ours. What you should see:</p>
      <ul class="lx-${ID}-checks">${checks.map((c, i) => `<li><label><input type="checkbox" id="lx-${ID}-ck${i}"> ${kit.esc(c)}</label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You have a cell that carries information along a sequence; next you use two of them to translate, and see what breaks when one fixed-size state has to carry a whole sentence.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "LSTM and GRU: gates that decide what to keep",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.LSTM.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.GRU.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.RNN.html",
      "https://arxiv.org/abs/1406.1078",
      "https://arxiv.org/abs/1211.5063",
      "https://arxiv.org/abs/1706.03762"
    ],
    interview: [
      {
        q: "Your sequence model has to use an event from 60 steps earlier. A plain RNN gets nowhere in training. What do you try, and why should it help?",
        good: [
          "Swap the plain RNN for an LSTM or GRU; in PyTorch it is a one-line change of the layer",
          "Explain why: the gated cell's update is additive, so while the forget gate is near 1 the error signal flows back across many steps",
          "A plain RNN may be able to hold the information but cannot learn to, because the gradient fades through every step",
          "Check if training on shorter sequences first helps, and clip gradients if they explode",
          "Ask whether the gap is so long, or the data so large, that a Transformer with attention is the better choice"
        ],
        weak: "Make the RNN bigger or train longer. That does not fix a gradient that fades over 60 steps."
      },
      {
        q: "You have to ship a model that runs on a phone and reads a sensor stream. Would you pick an LSTM, a GRU or a Transformer, and how would you decide?",
        good: [
          "A recurrent model keeps a fixed-size state and does one update per reading, which suits a stream on a small device",
          "A GRU has three blocks of weights against an LSTM's four, so it is smaller and faster at the same hidden size",
          "Which scores better is an empirical question: train both, compare on held-out data",
          "A Transformer is the better pick when sequences are long and the answer needs to look back at exact earlier positions"
        ],
        weak: "Always use a Transformer because it is the newest. That ignores memory, latency and the streaming shape of the data."
      }
    ],
    screens: [byHand, spotIdea, realGates, trainingRace, whyGatesTrain, inPyTorch, gruGate, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-run]"], right: ['[data-g="f"][data-v="3"]', "[data-run]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
