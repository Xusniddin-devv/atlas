/* Lesson s5c-lora: LoRA, training a small add-on instead of the model.
   Story: a legal-translation team wants its model to use the court glossary's fixed terms. Training every weight is
   out of reach, so they train a thin pair of matrices next to each chosen weight matrix and leave the model frozen.
   Ideas: (1) a change to a big matrix can be stored as a tall-thin B times a wide-thin A; the rank r (their shared
   width) sets the cost, 2 x 4096 x r numbers instead of 4096 x 4096; (2) the frozen W plus B·A, with B starting at
   zero, is a full working layer (it can be merged back into one matrix), and the rank caps how big a change it can learn.
   Depth: explain (screens 1-5, 8-9), scratch (screens 6-7: NumPy, from scratch, real runs).
   Runs (no model, no API call): docs/ai-path/runs/s5c-lora/ (counts.py -> counts.out.txt, forward.py ->
   forward.out.txt = the traced code screen, train.py -> train.out.txt = the loss table; env.txt).
   Facts: Hu et al. 2021, "LoRA: Low-Rank Adaptation of Large Language Models" (arXiv 2106.09685v2), checked 2026-11-13.
   Every number on screen is computed here from SIDE, the tiny matrices, FWD and TRAIN. Lesson-local CSS: the
   shape diagram of W, B and A, the matrix and output blocks, and the loss table (prefix lx-s5c-lora-). */
(() => {
  const P = "lx-s5c-lora-";
  const fmt = n => n.toLocaleString("en");
  const SIDE = 4096;                                   // one square weight matrix of the team's model: SIDE x SIDE
  const FULL = SIDE * SIDE;
  const pairCount = r => SIDE * r + r * SIDE;          // B is SIDE x r, A is r x SIDE
  const RANKS = [8, 2, 32];                            // the byHand order: fill in rank 8, then predict 2 and 32
  const times = (a, b) => fmt(Math.round(a / b));

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}shape{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;margin:12px 0;font-family:var(--mono);font-size:13px;color:var(--ink-2)}
      .${P}blk{position:relative;border:2px solid var(--ink);background:var(--sunk);display:flex;align-items:center;justify-content:center;color:var(--ink);font-weight:600;box-sizing:border-box}
      .${P}blk.fz{border-style:dashed;border-color:var(--muted);color:var(--muted);background:var(--surface)}
      .${P}blk.tr{background:var(--good-soft);border-color:var(--good)}
      .${P}lab{display:block;text-align:center;font-size:12px;color:var(--muted);margin-top:4px}
      .${P}col{display:flex;flex-direction:column;align-items:center}
      .${P}op{font-size:18px;color:var(--ink)}
      .${P}mat{font-family:var(--mono);font-size:13px;background:var(--sunk);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;white-space:pre-wrap;word-break:break-word;color:var(--ink)}
      .${P}mat b{color:var(--ink)}
      .${P}tb{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0;font-variant-numeric:tabular-nums}
      .${P}tb th,.${P}tb td{border-bottom:1px solid var(--line);padding:6px 4px;text-align:right}
      .${P}tb th:first-child,.${P}tb td:first-child{text-align:left}
      .${P}tb th{color:var(--muted);font-weight:500;font-size:12px}
      .${P}tb td.stuck{color:var(--bad)}
      .${P}tb td.zero{color:var(--good)}
      .${P}hid{color:var(--faint)}
      .${P}q{margin-top:14px}
    `;
    document.head.appendChild(s);
  }

  // A to-scale sketch: frozen W (SIDE x SIDE) beside the trainable B (SIDE x r) and A (r x SIDE).
  function shape(r, { big = 96 } = {}) {
    const thin = Math.max(4, Math.round(big * r / SIDE));
    return `<div class="${P}shape" aria-label="frozen W ${SIDE} by ${SIDE}, plus B ${SIDE} by ${r} times A ${r} by ${SIDE}">
      <span class="${P}col"><span class="${P}blk fz" style="width:${big}px;height:${big}px"></span><span class="${P}lab">W (frozen)<br>${SIDE} × ${SIDE}</span></span>
      <span class="${P}op">+</span>
      <span class="${P}col"><span class="${P}blk tr" style="width:${thin}px;height:${big}px"></span><span class="${P}lab">B<br>${SIDE} × ${r}</span></span>
      <span class="${P}op">×</span>
      <span class="${P}col"><span class="${P}blk tr" style="width:${big}px;height:${thin}px"></span><span class="${P}lab">A<br>${r} × ${SIDE}</span></span>
    </div>`;
  }

  /* 1. The situation: what full fine-tuning would train in one matrix. */
  function situation({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [SIDE + SIDE, FULL, SIDE];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>A glossary the model will not follow</h1>
        <p class="lead">A legal-translation team translates court papers. Their glossary fixes one translation for every court term, but the model keeps choosing everyday words. The glossary is stable. The problem is the model's habit of wording, not missing facts: the kind of failure the last lesson sent to fine-tuning.</p>
        <p class="lead">Fine-tuning the usual way trains every number in the model. This lesson is about LoRA, a cheaper way to fine-tune. First, see the cost of the usual way. Each layer of the model holds several big weight matrices (the LoRA paper counts four in the attention part alone). Take one of them: in their model it is ${fmt(SIDE)} by ${fmt(SIDE)} numbers.</p>
        <p class="task">How many numbers would full fine-tuning train in just one of those matrices?</p>
        <div class="lpanel">${kit.options(opts.map(fmt), { picked: ans, correct, num: true })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right: ${fmt(SIDE)} × ${fmt(SIDE)} = <b>${fmt(FULL)}</b> numbers, for one matrix out of many. Every one needs a gradient and optimizer memory while training, and the result is a whole new copy of the model to store. The team wants something smaller.`, true)
          : ans === 0 ? kit.feedback(`${fmt(SIDE)} + ${fmt(SIDE)} counts the edges of the square. The matrix has a number in every cell: ${fmt(SIDE)} rows, each with ${fmt(SIDE)} numbers. Multiply, do not add.`, false)
          : kit.feedback(`${fmt(SIDE)} is one row. The matrix has ${fmt(SIDE)} rows like it.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. Spot the idea: a change whose rows repeat one pattern is a column times a row. */
  const COL = [1, 2, -1, 3], ROW = [2, 0, -1, 1];
  const CHANGE = COL.map(c => ROW.map(v => c * v));
  const ROWSUM = CHANGE.map(r => r.reduce((s, v) => s + v, 0));
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const n = COL.length;
    const opts = [
      `Rows 1 and 2 (${2 * n} numbers); rows 3 and 4 become zeros`,
      `The numbers [${COL.join(", ")}] and row 1 [${ROW.join(", ")}] (${n + n} numbers)`,
      `The diagonal (${n} numbers) and the sum of each row (${n} numbers)`
    ];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>Store a change in fewer numbers</h1>
        <p class="lead">Fine-tuning a weight matrix means adding a change to it: one number per weight, so the change is a matrix of the same size. Start small. A tiny layer has a ${n} × ${n} weight matrix, and here is a change the team wants to add to it: ${n * n} numbers. Look at the rows.</p>
        <p class="task">You may store only ${n + n} numbers and must rebuild all ${n * n} exactly. What do you store?</p>
        ${kit.pics.grid(CHANGE, { rowHead: COL.map((c, i) => ok ? `×${c}` : `row ${i + 1}`), colHead: ROW.map((_, j) => `col ${j + 1}`), cls: ok ? Object.fromEntries(ROW.map((_, j) => [`0,${j}`, "enter"])) : {}, title: "the change, one number per cell" })}
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. Every row is row 1 times a multiplier: row 2 is ×${COL[1]}, row 3 is ×${COL[2]}, row 4 is ×${COL[3]}. So cell (row i, column j) = multiplier i × row-1 number j. A column of ${n} times a row of ${n} rebuilds all ${n * n} cells. In matrix terms: a ${n} × 1 matrix times a 1 × ${n} matrix.`, true)
          : ans === 0 ? kit.feedback(`Rows 3 and 4 are not zeros: they are [${CHANGE[2].join(", ")}] and [${CHANGE[3].join(", ")}]. Dropping them loses half the change. Look for a rule that links the rows.`, false)
          : kit.feedback(`The row sums are ${ROWSUM.join(", ")}. A sum tells you a row's total, not how it splits across the columns: [${ROW.join(", ")}] and [1, 1, 0, 0] both add up to ${ROWSUM[0]}. You cannot rebuild the cells from it.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Use it: build cells of B·A by hand, first one pair (rank 1), then two pairs (rank 2). */
  const TB = [[1, 0], [2, 1], [0, -1], [-1, 2]];       // B: 4 x 2
  const TA = [[3, 1, 0, -2], [1, 0, 2, 1]];            // A: 2 x 4
  const N4 = TB.length;
  const cell = (i, j, pairs) => Array.from({ length: pairs }, (_, p) => TB[i][p] * TA[p][j]).reduce((s, v) => s + v, 0);
  // [row, col, pairs used]
  const ASKS = [[1, 0, 1], [3, 3, 1], [1, 0, 2], [2, 2, 2]];
  function buildCells({ el, done, kit }) {
    css();
    let k = 0, wrong = null, last = null;
    const paint = () => {
      const end = k >= ASKS.length;
      const pairs = end ? 2 : ASKS[k][2];
      const [ri, cj] = end ? [-1, -1] : ASKS[k];
      const right = end ? 0 : cell(ri, cj, pairs);
      const first = end ? 0 : TB[ri][0] * TA[0][cj];
      const addUp = end ? 0 : TB[ri][0] + TA[0][cj];
      const cand = end ? [] : pairs === 1 ? [right, addUp, -right] : [right, first, -right];
      const opts = cand.filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
      const vals = Array.from({ length: N4 }, (_, i) => Array.from({ length: N4 }, (_, j) =>
        end ? cell(i, j, 2) : i === ri && j === cj ? "?" : ASKS.slice(0, k).some(([a, b, p]) => a === i && b === j && p === pairs) ? cell(i, j, pairs) : ""));
      const say = v => pairs === 1
        ? (v === addUp ? `That adds ${neg(TB[ri][0])} + ${neg(TA[0][cj])}. A cell is B's number <b>times</b> A's number: ${prod(0)}.` : `Check the sign: ${prod(0)} = ${right}.`)
        : (v === first ? `That is only the first pair: ${prod(0)} = ${first}. With two pairs, add the second pair's product too: ${prod(1)}.` : `Check the signs: ${prod(0)} + ${prod(1)} = ${right}.`);
      const neg = v => v < 0 ? `(${v})` : `${v}`;
      const prod = p => `${neg(TB[ri][p])} × ${neg(TA[p][cj])}`;
      const ring = (rows, cols, on) => Object.fromEntries(on ? rows.flatMap(i => cols.map(j => [`${i},${j}`, "accent"])) : []);
      const bShow = TB.map(r => r.slice(0, pairs)), aShow = TA.slice(0, pairs);
      const pairIdx = Array.from({ length: pairs }, (_, p) => p);
      el.innerHTML = `<h1>Build the change from thin pieces</h1>
        <p class="lead">${pairs === 1
          ? `One column B and one row A. Cell (row i, column j) of the change = B's number in row i × A's number in column j.`
          : `Now B has two columns and A has two rows: <b>two</b> column-row pairs. A cell is B's row times A's column, the way you multiply matrices: first numbers multiplied, plus second numbers multiplied. The number of pairs is the <b>rank</b> r of the add-on.`}</p>
        ${kit.pics.side(
          kit.pics.grid(bShow, { rowHead: TB.map((_, i) => `row ${i + 1}`), cls: ring([ri], pairIdx, !end), title: `B (${N4} × ${pairs})` }),
          kit.pics.grid(aShow, { colHead: TA[0].map((_, j) => `col ${j + 1}`), cls: ring(pairIdx, [cj], !end), title: `A (${pairs} × ${N4})` }))}
        ${end ? "" : `<p class="task">What goes in row ${ri + 1}, column ${cj + 1} of B × A? Use the ringed numbers.</p>`}
        ${kit.pics.grid(vals, { rowHead: TB.map((_, i) => `row ${i + 1}`), colHead: TA[0].map((_, j) => `col ${j + 1}`), cls: end ? {} : { [`${ri},${cj}`]: "next" }, title: end ? "the whole change, B × A with r = 2" : `B × A, rank ${pairs}` })}
        <div class="lpanel">${end ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong != null ? kit.feedback(say(wrong), false) : last && !end ? kit.feedback(last, true) : ""}
        ${end ? kit.feedback(`That is the whole of LoRA's arithmetic: the change to a layer is <b>B × A</b>. Here B is ${N4} × 2 and A is 2 × ${N4}: ${N4 * 2 + 2 * N4} numbers for ${N4 * N4} cells, so at this tiny size rank 2 saves nothing. The saving shows when the matrix is big and r stays small. LoRA stands for <b>low-rank adaptation</b>: the change is built from a few column-row pairs, a low rank.`) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== right) { wrong = v; last = null; paint(); return; }
        const neg = x => x < 0 ? `(${x})` : `${x}`, pr = q => `${neg(TB[ri][q])} × ${neg(TA[q][cj])}`;
        last = pairs === 1 ? `${pr(0)} = ${right}.` : `${pr(0)} + ${pr(1)} = ${right}.`;
        wrong = null; k++; paint();
        if (k >= ASKS.length) done();
      });
    };
    paint();
  }

  /* 4. Count by hand at the real size: rank 8, then predict rank 2 and rank 32. */
  function countReal({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const paint = () => {
      const end = k >= RANKS.length, r = end ? RANKS[RANKS.length - 1] : RANKS[k];
      const right = pairCount(r), oneSide = SIDE * r, divided = FULL / r;
      const opts = end ? [] : [right, oneSide, divided].sort((a, b) => a - b);
      const doneR = RANKS.slice(0, k);
      const sortedR = [...RANKS].sort((a, b) => a - b), ratio = sortedR[1] / sortedR[0];
      const rankStep = ({ 2: "Two", 3: "Three", 4: "Four" })[ratio] || String(ratio);
      el.innerHTML = `<h1>Count at the real size</h1>
        <p class="lead">Back to one ${fmt(SIDE)} × ${fmt(SIDE)} matrix. LoRA leaves it frozen and trains B (${fmt(SIDE)} × r) and A (r × ${fmt(SIDE)}). B × A is a full ${fmt(SIDE)} × ${fmt(SIDE)} change, but only B and A are stored and trained.</p>
        ${shape(r)}
        ${end ? "" : `<p class="task">${k === 0 ? `How many numbers do B and A hold together at rank ${r}?` : `Predict before the page checks: how many at rank ${r}?`}</p>`}
        <div class="lpanel">${end ? "" : kit.options(opts.map(fmt), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong != null ? kit.feedback(wrong === oneSide
            ? `${fmt(SIDE)} × ${r} = ${fmt(oneSide)} is B alone. A holds the same amount again: ${r} × ${fmt(SIDE)}.`
            : `${fmt(FULL)} ÷ ${r} would mean the rank divides the full matrix. It does not: B and A each have ${fmt(SIDE)} × ${r} numbers, so the count is 2 × ${fmt(SIDE)} × ${r}.`, false) : ""}
        ${doneR.length ? kit.meter([{ label: "Full update", value: FULL, max: FULL }, ...[...doneR].sort((a, b) => a - b).map(x => ({ label: `Rank ${x}`, value: pairCount(x), max: FULL, good: true }))]) : ""}
        ${doneR.length ? `<p class="lead">${[...doneR].sort((a, b) => a - b).map(x => `Rank ${x}: ${fmt(pairCount(x))}, about ${times(FULL, pairCount(x))} times fewer numbers.`).join(" ")}</p>` : ""}
        ${end ? kit.feedback(`${rankStep} times the rank, ${rankStep.toLowerCase()} times the count: the count grows in step with r. The full update stays the same size whatever you do. As long as r is far below ${fmt(SIDE)}, the add-on is a small fraction of the matrix. At r = ${fmt(SIDE)} the pair would hold ${fmt(pairCount(SIDE))} numbers, twice the full matrix.`) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= RANKS.length) done();
      });
    };
    paint();
  }

  /* 5. Why it is safe to start: B starts at zero, W never moves. */
  function startZero({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "Random nonsense: A is filled with random numbers",
      "Exactly what the original model translated",
      "Already a little closer to the glossary"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>The first training step</h1>
        <p class="lead">A layer with LoRA takes the input numbers <code>x</code> and computes <code>W·x + B·(A·x)</code>: the frozen layer's output plus the add-on's output, added number by number. Training only ever changes A and B; W gets no updates. The LoRA paper starts A with random numbers and <b>B with zeros</b>.</p>
        <p class="task">Before any training step, a translator runs a court sentence through the model with the new add-ons in place. What comes out?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. B is all zeros, so B·(A·x) is zero whatever A holds: the change B·A starts at zero, and the model starts exactly where it was. Training then moves A and B a little at a time, from a model that already translates well. And since W never changes, removing the add-on gives back the original model.`, true)
          : ans === 0 ? kit.feedback(`A·x is random, but it is then multiplied by B, and B is all zeros. Zero times anything is zero, so the add-on adds nothing yet.`, false)
          : kit.feedback(`Nothing has been trained yet: no example has been seen, so nothing has moved toward the glossary. B is zero, so the add-on adds exactly zero.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 6. The same layer in NumPy, a recorded run, stepped. */
  // From docs/ai-path/runs/s5c-lora/forward.py and forward.out.txt (seed 0; A and B stand for an already-trained add-on)
  const FWD = {
    W: [[2, 1, 0, -1, -1, -2], [-2, -2, -2, 2, 1, 2], [0, 1, 2, 1, 1, 0], [0, 2, -1, 2, 1, -2], [-1, 2, 0, -2, 1, 1], [2, -2, -2, 2, -2, 0]],
    A: [[-1, -1, 0, 0, 0, -1], [-1, -1, -1, 1, 0, 0]],
    B: [[-1, 0], [1, 0], [0, 1], [1, 1], [0, 1], [1, 0]],
    token: [1, 0, 2, 0, 1, 0],
    alpha: 4,
    merged: [3, -7, -1, -9, -6, -6], maxDiff: "0.0"
  };
  const CODE1 = [
    "def lora_forward(token, W, A, B, alpha):",
    "    r = A.shape[0]",
    "    base = W @ token",
    "    down = A @ token",
    "    up = B @ down",
    "    scale = alpha / r",
    "    return base + scale * up"
  ];
  // forward.out.txt: the state before each listing line runs (0 = the def line), then the return
  const TRACE = [
    { line: 1, vars: {} },
    { line: 2, vars: { r: 2 } },
    { line: 3, vars: { r: 2, base: [1, -5, 5, -1, 0, -4] } },
    { line: 4, vars: { r: 2, base: [1, -5, 5, -1, 0, -4], down: [-1, -3] } },
    { line: 5, vars: { r: 2, base: [1, -5, 5, -1, 0, -4], down: [-1, -3], up: [1, -1, -3, -4, -3, -1] } },
    { line: 6, vars: { r: 2, base: [1, -5, 5, -1, 0, -4], down: [-1, -3], up: [1, -1, -3, -4, -3, -1], scale: 2 } },
    { line: 6, event: "return", vars: { r: 2, base: [1, -5, 5, -1, 0, -4], down: [-1, -3], up: [1, -1, -3, -4, -3, -1], scale: 2, ret: [3, -7, -1, -9, -6, -6] } }
  ];
  const FRAMES = TRACE.slice(0, -1).map((s, i) => ({ ln: s.line, vars: TRACE[i + 1].vars }));
  const GATE_LN = 3;                                   // predict the size of `down` before this line runs
  const D6 = FWD.token.length;
  const arr = a => `[${a.join(", ")}]`;
  const SAY1 = {
    1: f => `r is the number of rows in A: ${f.vars.r}. That is the rank, the width of the thin pair.`,
    2: f => `The frozen layer's own output, W @ token: ${arr(f.vars.base)}. This is what the original model computes.`,
    3: f => `A squeezes the ${D6} input numbers down to ${f.vars.down.length}: ${arr(f.vars.down)}.`,
    4: f => `B spreads those ${f.vars.down.length} numbers back out to ${f.vars.up.length}: ${arr(f.vars.up)}. Together, B @ (A @ token) is the same as (B @ A) @ token, without ever building the full B @ A.`,
    5: f => `scale = alpha / r = ${FWD.alpha} / ${f.vars.r} = ${f.vars.scale}. alpha is a fixed number you choose. The paper scales the add-on's output by alpha / r and sets alpha once, so trying a different r needs less retuning of the other training settings.`,
    6: f => `Returned: base + ${f.vars.scale} × up = ${arr(f.vars.ret)}. The same run also built one merged matrix, W + ${f.vars.scale} × (B @ A), and multiplied the token by it: ${arr(FWD.merged)}, largest difference ${FWD.maxDiff}. So after training the add-on can be folded into W, and the layer costs no extra time when serving.`
  };
  function codeForward({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const GATE = FRAMES.findIndex(f => f.ln === GATE_LN);
    const popts = [String(FWD.A.length), String(D6), String(D6 * D6)];
    const pright = 0;
    const nW = FWD.W.length * FWD.W[0].length, nAB = FWD.A.length * FWD.A[0].length + FWD.B.length * FWD.B[0].length;
    const paint = () => {
      const f = FRAMES[i], gate = i === GATE - 1 && pred !== pright, v = f.vars;
      const show = k => v[k] == null ? `<span class="${P}hid">–</span>` : Array.isArray(v[k]) ? arr(v[k]) : v[k];
      el.innerHTML = `<h1>One LoRA layer in NumPy</h1>
        <p class="lead">A tiny layer: ${D6} numbers in (<code>token</code>), ${D6} out, rank ${FWD.A.length}. <code>W</code> is frozen; <code>A</code> and <code>B</code> stand for an add-on that is already trained (small whole numbers drawn at random, so you can follow them; nothing is learned in this run). <code>@</code> is matrix multiplication. Each step replays a real run.</p>
        <div class="${P}mat">token = ${arr(FWD.token)}   alpha = ${FWD.alpha}\nA = ${FWD.A.map(arr).join("\n    ")}\nB = ${FWD.B.map(row => arr(row).replace(/, /g, ", ")).join(" ")}  (${FWD.B.length} rows)\nW: ${FWD.W.length} × ${FWD.W[0].length}, not shown</div>
        <p class="task">Step through to the end. Before <code>down</code> is computed, predict how many numbers it holds.</p>
        ${kit.code(CODE1, f.ln)}
        <div class="${P}mat">r     ${show("r")}\nbase  ${show("base")}\ndown  ${show("down")}\nup    ${show("up")}\nscale ${show("scale")}</div>
        <div class="vars"><span>step <b>${i + 1} / ${FRAMES.length}</b></span><span>numbers in W <b>${nW}</b></span><span>in A and B <b>${nAB}</b></span></div>
        ${kit.feedback(SAY1[f.ln](f))}
        ${gate ? `<div id="pred"><p class="task">Next: <code>down = A @ token</code>. How many numbers will <code>down</code> hold?</p>${kit.options(popts, { picked: pred, correct: pright, num: true })}
          ${pred == null ? "" : pred === 1 ? kit.feedback(`${D6} would be the size of the input. But A has only ${FWD.A.length} rows, and each row gives one number: A is ${FWD.A.length} × ${D6}, so A @ token has ${FWD.A.length}.`, false)
          : kit.feedback(`${D6 * D6} is the size of a full ${D6} × ${D6} matrix. Multiplying a matrix by a vector gives one number per row of the matrix, and A has ${FWD.A.length} rows.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 || gate ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 7. Train only A and B (NumPy, real run): the rank caps how big a change the add-on can learn. */
  const CODE2 = [
    "def train_lora(W, inputs, targets, r):",
    "    A = small_random(r, d)",
    "    B = np.zeros((d, r))",
    "    for step in range(301):",
    "        down = A @ inputs",
    "        out = W @ inputs + B @ down",
    "        error = out - targets",
    "        if step in SHOW:",
    "            report(step, error)",
    "        ...  # update B and A only",
    "    return A, B"
  ];
  // From docs/ai-path/runs/s5c-lora/train.out.txt (seed 0 data, seed 1 starting A). d = 16, 256 example inputs.
  const TRAIN = {
    d: 16, steps: [0, 10, 25, 50, 100, 300], wChanged: "0.0",
    small: { rankOfChange: 2, loss: {
      1: ["14.1583", "9.9503", "4.8011", "4.7971", "4.7971", "4.7971"],
      2: ["14.1583", "7.3423", "0.0002", "0.0000", "0.0000", "0.0000"],
      4: ["14.1583", "5.8964", "0.0001", "0.0000", "0.0000", "0.0000"],
      16: ["14.1583", "0.4547", "0.0001", "0.0000", "0.0000", "0.0000"] } },
    big: { rankOfChange: 16, loss: {
      1: ["15.7339", "15.5149", "12.6028", "11.9000", "11.8812", "11.8812"],
      2: ["15.7339", "14.9506", "10.0142", "9.7358", "9.6247", "9.5465"],
      4: ["15.7339", "14.3908", "6.6884", "5.7823", "5.5053", "5.4541"],
      16: ["15.7339", "9.2309", "0.9983", "0.1393", "0.0277", "0.0002"] } }
  };
  const TR_RANKS = [1, 2, 4, 16];
  const lastLoss = (set, r) => +TRAIN[set].loss[r][TRAIN.steps.length - 1];
  const ZERO = 0.001;                                   // "about zero" at the 4-decimal precision the run printed
  const reaches = set => TR_RANKS.filter(r => lastLoss(set, r) < ZERO);
  const SHOW_STEPS = [0, 2, 4, 5];                      // columns shown: steps 0, 25, 100, 300 (all six are in the run)
  function lossTable(set) {
    const L = TRAIN[set].loss, last = TRAIN.steps.length - 1;
    return `<table class="${P}tb"><thead><tr><th>rank (numbers trained)</th>${SHOW_STEPS.map(j => `<th>step ${TRAIN.steps[j]}</th>`).join("")}</tr></thead><tbody>
      ${TR_RANKS.map(r => `<tr><td>${r} (${r * TRAIN.d * 2})</td>${SHOW_STEPS.map(j => `<td class="${j === last ? (+L[r][j] < ZERO ? "zero" : "stuck") : ""}">${L[r][j]}</td>`).join("")}</tr>`).join("")}
    </tbody></table>`;
  }
  function trainRanks({ el, done, kit }) {
    css();
    let q1 = null, q2 = null;
    const smallMin = Math.min(...reaches("small"));
    const q1opts = ["Every rank, 1 and up", `Rank ${smallMin} and up`, "Only rank 16"];
    const q1r = 1;
    const big4 = lastLoss("big", 4), big4start = +TRAIN.big.loss[4][0];
    const q2opts = ["It reaches about 0, just more slowly", "It stops at a loss well above 0", "It goes up: training breaks"];
    const q2r = 1;
    const dd = TRAIN.d * TRAIN.d;
    const paint = () => {
      el.innerHTML = `<h1>Train only A and B</h1>
        <p class="lead">A toy, not a language model. <code>W</code> is a frozen ${TRAIN.d} × ${TRAIN.d} layer (${dd} numbers, so <code>d</code> = ${TRAIN.d}). The targets come from a changed layer: <code>(W + change) @ inputs</code>. The add-on must learn that change.</p>
        <p class="lead">The loop trains only A and B by gradient descent, starting from B = 0. <code>small_random</code> fills A with small random numbers. <code>report</code> prints the loss (the mean squared error). The scale alpha / r is left at 1 here. The update lines are cut (marked <code>...</code>). They never touch W: in every run W changed by ${TRAIN.wChanged}.</p>
        ${kit.code(CODE2, -1)}
        <div id="q1" class="${P}q"><p class="task">First target: a <b>small change</b>, built as a ${TRAIN.d} × ${TRAIN.small.rankOfChange} matrix times a ${TRAIN.small.rankOfChange} × ${TRAIN.d} matrix. Which add-on ranks bring the loss to about 0?</p>
          ${kit.options(q1opts, { picked: q1, correct: q1r })}
          ${q1 == null ? "" : q1 === q1r ? kit.feedback(`Right. The change is ${TRAIN.small.rankOfChange} column-row pairs, so an add-on with ${smallMin} or more pairs can hold it exactly. Rank 1 has one pair and gets stuck at ${TRAIN.small.loss[1][5]}.`, true)
            : q1 === 0 ? kit.feedback(`Rank 1 is one column times one row. This change needs ${TRAIN.small.rankOfChange} pairs, like the second half of screen 3. One pair cannot make it, however long it trains.`, false)
            : kit.feedback(`Rank 16 can make any 16 × 16 change, but this change is only ${TRAIN.small.rankOfChange} pairs. Any rank of ${smallMin} or more has enough room.`, false)}
          ${q1 === q1r ? lossTable("small") : ""}</div>
        ${q1 === q1r ? `<div id="q2" class="${P}q"><p class="task">Second target: a <b>big change</b>, a full random ${TRAIN.d} × ${TRAIN.d} matrix (rank ${TRAIN.big.rankOfChange}). What does the loss do at rank 4?</p>
          ${kit.options(q2opts, { picked: q2, correct: q2r })}
          ${q2 == null ? "" : q2 === q2r ? kit.feedback(`Right. Rank 4 falls from ${big4start} to ${TRAIN.big.loss[4][5]} and stays there: 4 pairs cannot form a change that needs ${TRAIN.big.rankOfChange}. Only rank 16 reaches about 0, and at rank 16 A and B hold ${16 * TRAIN.d * 2} numbers, more than the ${dd} in W itself. LoRA pays off when the change you need is small. The paper found very small ranks enough for the tasks it tested, and says it does not expect a small rank to work for every task: for a task in a language the model was not trained on, retraining the whole model could do better.`, true)
            : q2 === 0 ? kit.feedback(`More steps do not add room. Rank 4 can only form changes made of 4 column-row pairs, and this one needs ${TRAIN.big.rankOfChange}. The part it cannot form stays as loss.`, false)
            : kit.feedback(`Nothing here makes training unstable: B starts at zero and the loss only falls. It falls until the add-on runs out of room, then stays flat.`, false)}
          ${q2 === q2r ? lossTable("big") : ""}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { q1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { q2 = +b.dataset.i; paint(); if (q2 === q2r) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, cost; task: which cost bites first. */
  const COSTS = [
    "The whole base model must still fit in memory",
    "An adapter only works on the base model it was trained on",
    "Merged adapters cannot share one batch"
  ];
  const BIG = [
    ["The model's maker releases a new version of the base model. The team wants to switch to it and keep their glossary adapter.", 1,
      "Right. B·A was trained as a correction to one particular W. On a new base the W matrices are different, so the old correction no longer fits. The adapter has to be trained again."],
    ["A team member tries to train the adapter on a laptop whose graphics card cannot hold the base model.", 0,
      "Right. Only A and B are trained, but every training step still runs the full frozen model forward and backward. The whole model must be loaded; LoRA saves the gradients and optimizer memory for W, not W itself."],
    ["One server answers three law firms, each with its own adapter merged into its own copy of the weights, and wants to answer all three firms' requests together.", 2,
      "Right. A merged adapter is baked into W, so each firm's requests need a different W. The paper notes you can keep the adapters unmerged and pick one per request, where a little extra time per call is acceptable."]
  ];
  const BIG_WRONG = [
    { 0: "Memory is not the problem here: the new base is about the same size. The problem is that B·A corrects the old W, which is gone.", 2: "Nothing is being batched here. The adapter was trained against the old W, and the new base has different W matrices." },
    { 1: "The base model is the same one the adapter is for. The problem is that the card cannot hold that base model at all.", 2: "This is training on one machine, not serving several adapters. Every step runs the whole frozen model, so it must fit in memory." },
    { 0: "Three merged copies do cost memory, but even with room to spare, one batch runs through one set of weights, and each firm's set is different.", 1: "Each adapter is on the base it was trained for. The trouble is that merging makes three different weight sets, and one batch runs through one set." }
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When LoRA is the right tool</h1>
        <p class="lead"><b>What it is for:</b> teaching a model a stable new habit, such as fixed terms, a house style, a format or a narrow task, by training small add-ons beside chosen weight matrices.</p>
        <p class="lead"><b>Reach for it</b> when a prompt cannot hold the habit reliably, you have good examples, and you want cheap variants: many adapters can share one base model.</p>
        <p class="lead"><b>Not for</b> facts that change: use retrieval. Not when a better prompt or a few examples already work. For a change far from what the model knows, a small rank may not be enough.</p>
        <p class="lead"><b>Cost:</b> a clean dataset, training runs and an evaluation, and the full model in memory.</p>
        <p class="task">For each situation, pick the cost that bites first.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(COSTS.map(kit.esc), { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === r ? yes : BIG_WRONG[i][ans[i]]), ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: is a LoRA adapter the fix? One "no". */
  const CASES = [
    ["A help desk wants every reply in its fixed ticket template. It has thousands of good past replies. A prompt full of examples works, but it is long and is paid for on every call.", true,
      "Yes. A stable format, plenty of examples, and a prompt that costs on every call: train an adapter on the past replies and drop the long examples from the prompt.",
      "The format never changes and there are thousands of examples. An adapter learns the template once, and every call stops paying for the long example prompt."],
    ["An agency runs one open model for five client companies. Each client wants replies in its own brand voice.", true,
      "Yes. Five small adapters on one shared base model, one per client. Each adapter is a small set of extra weights beside the base, not a copy of the model.",
      "This is the case LoRA makes cheap: one base model, a small adapter per client, swapped in per request. Five fully fine-tuned models would mean five full copies."],
    ["A pharmacy chatbot must answer from a price list that changes every morning.", false,
      "No. An adapter bakes in what it saw during training. Tomorrow's prices were not in that data, so the adapter would answer with old prices until it is trained again. Retrieval reads today's list on every call.",
      "Training freezes a snapshot. The prices change every morning, so an adapter would be out of date the day after training. Fetch the current list with retrieval instead."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is an adapter the fix?</h1>
        <p class="lead">Three situations without the translators.</p>
        <p class="task">For each one, decide if training a LoRA adapter is the right fix. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (browser practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next, r = RANKS[0];
    el.innerHTML = `<h1>A small add-on, a frozen model</h1>
      <p class="lead">You can now say what LoRA is: keep the model's weights frozen and train a thin pair beside each chosen matrix W, so that layer computes W·x + scale·B·(A·x).</p>
      <p class="lead">Why it works: the paper expected, and found on the tasks it tested, that the change a narrow task needs is small, so a few column-row pairs can hold it. B starts at zero, so training starts from the original model. When to use it: to teach a stable habit, such as fixed terms or a format. Not for facts that change: use retrieval. What it costs: rank ${r} on one ${fmt(SIDE)} × ${fmt(SIDE)} matrix trains ${fmt(pairCount(r))} numbers instead of ${fmt(FULL)}, but the full model must still be in memory, and the adapter fits only its own base.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson: you build a LoRA layer in NumPy, check that it changes nothing while B is zero, and merge it into W.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. An adapter learns only what its examples show; that lesson builds and cleans the examples it trains on.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5c-lora", {
    title: "LoRA: training a small add-on instead of the model",
    checked: "2026-11-13",
    sources: [
      "https://arxiv.org/abs/2106.09685",
      "https://arxiv.org/html/2106.09685v2"
    ],
    interview: [{
      q: "Your team needs a model to follow a company glossary and house style. A colleague proposes full fine-tuning; you propose LoRA. Explain what LoRA trains and why it is cheaper, and what it still costs.",
      good: [
        "The base weights stay frozen; for chosen weight matrices we train two thin matrices B (d × r) and A (r × k), and the layer adds B·A·x to W·x",
        "Trainable numbers per matrix drop from d × k to r × (d + k), so gradients, optimizer memory and the saved file are small",
        "B starts at zero, so training starts from the original model; after training B·A can be merged into W, so serving is not slower",
        "It still needs the full model in memory to train, a clean dataset and an evaluation, and the adapter only fits the base it was trained on"
      ],
      weak: "Saying LoRA is a smaller or compressed model. It is the same full model plus a small trained change; the base is not smaller."
    }, {
      q: "You trained a LoRA adapter at a small rank and the validation loss stops improving well above the full fine-tuning baseline. What could be going on, and what do you try?",
      good: [
        "The rank may be too small for the change the task needs: a low-rank add-on cannot form a change that needs more column-row pairs",
        "Try a larger rank, or adapt more weight matrices, and compare on the same validation set",
        "Check whether the task is far from what the base model knows, where the paper itself expects small ranks to fall short",
        "Rule out the plain causes too: too few or noisy examples, or a learning rate that is off"
      ],
      weak: "Just training for more epochs. Extra steps do not give a too-small rank more room; the loss stays flat."
    }],
    screens: [situation, spotIdea, buildCells, countReal, startZero, codeForward, trainRanks, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(ASKS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: Array(RANKS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(FRAMES.findIndex(f => f.ln === GATE_LN) - 1).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FRAMES.length - FRAMES.findIndex(f => f.ln === GATE_LN)).fill("[data-next]")] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
