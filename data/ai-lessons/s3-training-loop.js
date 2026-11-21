/* Lesson: the training loop, line by line. Story: a print shop wants a turnaround estimate (in hours) when a
   customer enters page count, paper type and number of copies. Ideas: (1) every batch runs the same four jobs in
   order: predict, measure the loss, fill the gradients (backward), move the weights (step), with zero_grad
   clearing the last batch's gradients first, because PyTorch adds new gradients to old ones; (2) after each epoch
   a validation pass measures the model on held-back jobs without changing it.
   Data, all real, from runs on this Mac (no model API calls were recorded for this lesson):
   - docs/ai-path/runs/s3-training-loop/print_jobs.py: 400 simulated print jobs (seed 0), 300 to train, 100 held back;
   - train_loop.py + train_loop.out.txt: the PyTorch loop (train_ok) and three copies with one line removed
     (no_step, no_zero_grad, no_backward), all from torch.manual_seed(0);
   - batches.py + batches.out.txt: the same loop with batch sizes 1, 32 and 300;
   - scratch_loop.py + scratch_loop.out.txt: the NumPy loop shown on the code screen, traced line by line on 6 jobs.
   Lesson-local style: an output block and line buttons (.lx-s3-training-loop-*), see ensureStyle(). */
(() => {
  const ID = "s3-training-loop";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs ---------- */
  const RUN_DATE = "2026-11-14";
  const N_TRAIN = 300, N_VAL = 100, EPOCHS = 30, BATCH = 32; // train_loop.py
  // train_loop.out.txt, per epoch: [train loss, val loss, val off by (hours)]
  const OK = [[11.397,11.634,2.27],[9.873,10.304,2.25],[9.322,9.53,1.83],[7.616,8.139,1.95],[6.919,7.306,1.61],[5.986,6.61,1.7],[5.628,6.014,1.39],[4.891,5.574,1.51],[4.349,4.964,1.36],[4.172,4.688,1.34],[3.72,4.326,1.31],[4.075,4.475,1.37],[4.805,5.691,1.75],[2.999,3.574,1.22],[3.091,3.796,1.34],[2.651,3.268,1.2],[4.368,5.176,1.68],[2.509,2.952,1.13],[2.333,2.765,1.09],[2.09,2.577,1.07],[2.502,3.079,1.26],[1.924,2.312,0.99],[2.287,2.567,1.06],[1.952,2.249,0.97],[1.64,1.995,0.94],[1.577,1.912,0.92],[1.817,2.064,0.94],[1.438,1.735,0.88],[1.409,1.721,0.9],[1.441,1.753,0.92]];
  const OK_UPDATES = 300;
  const OK_DIAG = { change: "1.143769", grad: "9.792" };
  const NO_STEP = Array.from({ length: 30 }, () => [36.401, 34.808, 4.19]); // every epoch printed the same row
  const NO_STEP_DIAG = { change: "0.000000", grad: "10.324" };
  const NO_BACKWARD_DIAG = { change: "0.000000", grad: "None" }; // its 30 rows are the same as NO_STEP's
  const NO_ZERO = [[16.57,15.964,2.32],[9.188,8.811,1.93],[6.034,7.02,1.84],[2.848,3.313,1.42],[2.298,2.279,1.16],[2.809,2.392,1.2],[5.709,5.659,1.64],[3.254,3.388,1.13],[5.11,5.298,1.77],[5.111,5.234,1.72],[3.166,3.742,1.64],[2.609,3.281,1.57],[2.076,2.212,1.22],[13.929,13.239,2.41],[6.175,6.039,1.85],[15.25,15.385,2.89],[15.025,15.92,3.32],[13.131,11.536,2.81],[19.176,14.166,2.21],[24.057,22.41,3.29],[9.482,7.689,1.95],[19.129,18.057,3.31],[21.88,22.512,4.11],[17.721,17.366,2.9],[22.005,20.998,2.73],[17.951,17.542,2.82],[21.571,22.366,4.08],[18.982,19.092,3.53],[20.602,19.334,2.7],[20.719,19.89,2.7]];
  const NO_ZERO_DIAG = { change: "96.054192", grad: "100.670" };
  // batches.out.txt: [batch_size, updates per epoch, total updates, epoch-30 row]
  const BATCHES = [[1, 300, 9000, [0.39, 0.459, 0.43]], [32, 10, 300, [1.441, 1.753, 0.92]], [300, 1, 30, [8.622, 9.116, 2.08]]];

  // scratch_loop.py: train_numpy, line for line (line 0 = def)
  const NP_CODE = [
    "def train_numpy(jobs, hours, epochs, batch_size, lr):",
    "    weights, bias = np.zeros(jobs.shape[1]), 0.0",
    "    for epoch in range(epochs):",
    "        order = rng.permutation(len(jobs))",
    "        for start in range(0, len(jobs), batch_size):",
    "            batch = order[start:start + batch_size]",
    "            predicted = jobs[batch] @ weights + bias",
    "            error = predicted - hours[batch]",
    "            weights = weights - lr * 2 * jobs[batch].T @ error / len(batch)",
    "            bias = bias - lr * 2 * error.mean()",
    "    return weights, bias"
  ];
  const NP_ARGS = { epochs: 2, batch_size: 4, lr: 0.1 };
  const NP_JOBS = [[1.03, 2.9], [0.77, 0.96], [0.62, 2.4], [0.33, 0.57], [0.37, 1.09], [0.05, 2.02]]; // pages/100, copies/100
  const NP_HOURS = [18.4, 1.81, 5.65, 1.81, 3.31, 0.68];
  // scratch_loop.out.txt STEP rows: [line about to run, event, epoch, order, start, batch, predicted, error, weights, bias]
  const NP_TRACE = [[1,"l",null,null,null,null,null,null,null,null],[2,"l",null,null,null,null,null,null,[0.0,0.0],0.0],[3,"l",0,null,null,null,null,null,[0.0,0.0],0.0],[4,"l",0,[4,0,2,1,5,3],null,null,null,null,[0.0,0.0],0.0],[5,"l",0,[4,0,2,1,5,3],0,null,null,null,[0.0,0.0],0.0],[6,"l",0,[4,0,2,1,5,3],0,[4,0,2,1],null,null,[0.0,0.0],0.0],[7,"l",0,[4,0,2,1,5,3],0,[4,0,2,1],[0.0,0.0,0.0,0.0],null,[0.0,0.0],0.0],[8,"l",0,[4,0,2,1,5,3],0,[4,0,2,1],[0.0,0.0,0.0,0.0],[-3.31,-18.4,-5.65,-1.81],[0.0,0.0],0.0],[9,"l",0,[4,0,2,1,5,3],0,[4,0,2,1],[0.0,0.0,0.0,0.0],[-3.31,-18.4,-5.65,-1.81],[1.25,3.61],0.0],[4,"l",0,[4,0,2,1,5,3],0,[4,0,2,1],[0.0,0.0,0.0,0.0],[-3.31,-18.4,-5.65,-1.81],[1.25,3.61],1.46],[5,"l",0,[4,0,2,1,5,3],4,[4,0,2,1],[0.0,0.0,0.0,0.0],[-3.31,-18.4,-5.65,-1.81],[1.25,3.61],1.46],[6,"l",0,[4,0,2,1,5,3],4,[5,3],[0.0,0.0,0.0,0.0],[-3.31,-18.4,-5.65,-1.81],[1.25,3.61],1.46],[7,"l",0,[4,0,2,1,5,3],4,[5,3],[8.82,3.93],[-3.31,-18.4,-5.65,-1.81],[1.25,3.61],1.46],[8,"l",0,[4,0,2,1,5,3],4,[5,3],[8.82,3.93],[8.14,2.12],[1.25,3.61],1.46],[9,"l",0,[4,0,2,1,5,3],4,[5,3],[8.82,3.93],[8.14,2.12],[1.14,1.85],1.46],[4,"l",0,[4,0,2,1,5,3],4,[5,3],[8.82,3.93],[8.14,2.12],[1.14,1.85],0.43],[2,"l",0,[4,0,2,1,5,3],4,[5,3],[8.82,3.93],[8.14,2.12],[1.14,1.85],0.43],[3,"l",1,[4,0,2,1,5,3],4,[5,3],[8.82,3.93],[8.14,2.12],[1.14,1.85],0.43],[4,"l",1,[2,3,5,4,0,1],4,[5,3],[8.82,3.93],[8.14,2.12],[1.14,1.85],0.43],[5,"l",1,[2,3,5,4,0,1],0,[5,3],[8.82,3.93],[8.14,2.12],[1.14,1.85],0.43],[6,"l",1,[2,3,5,4,0,1],0,[2,3,5,4],[8.82,3.93],[8.14,2.12],[1.14,1.85],0.43],[7,"l",1,[2,3,5,4,0,1],0,[2,3,5,4],[5.58,1.86,4.22,2.87],[8.14,2.12],[1.14,1.85],0.43],[8,"l",1,[2,3,5,4,0,1],0,[2,3,5,4],[5.58,1.86,4.22,2.87],[-0.08,0.05,3.54,-0.44],[1.14,1.85],0.43],[9,"l",1,[2,3,5,4,0,1],0,[2,3,5,4],[5.58,1.86,4.22,2.87],[-0.08,0.05,3.54,-0.44],[1.14,1.52],0.43],[4,"l",1,[2,3,5,4,0,1],0,[2,3,5,4],[5.58,1.86,4.22,2.87],[-0.08,0.05,3.54,-0.44],[1.14,1.52],0.28],[5,"l",1,[2,3,5,4,0,1],4,[2,3,5,4],[5.58,1.86,4.22,2.87],[-0.08,0.05,3.54,-0.44],[1.14,1.52],0.28],[6,"l",1,[2,3,5,4,0,1],4,[0,1],[5.58,1.86,4.22,2.87],[-0.08,0.05,3.54,-0.44],[1.14,1.52],0.28],[7,"l",1,[2,3,5,4,0,1],4,[0,1],[5.87,2.62],[-0.08,0.05,3.54,-0.44],[1.14,1.52],0.28],[8,"l",1,[2,3,5,4,0,1],4,[0,1],[5.87,2.62],[-12.53,0.81],[1.14,1.52],0.28],[9,"l",1,[2,3,5,4,0,1],4,[0,1],[5.87,2.62],[-12.53,0.81],[2.37,5.08],0.28],[4,"l",1,[2,3,5,4,0,1],4,[0,1],[5.87,2.62],[-12.53,0.81],[2.37,5.08],1.45],[2,"l",1,[2,3,5,4,0,1],4,[0,1],[5.87,2.62],[-12.53,0.81],[2.37,5.08],1.45],[10,"l",1,[2,3,5,4,0,1],4,[0,1],[5.87,2.62],[-12.53,0.81],[2.37,5.08],1.45],[10,"r",1,[2,3,5,4,0,1],4,[0,1],[5.87,2.62],[-12.53,0.81],[2.37,5.08],1.45]];

  // The eight loop lines of train_ok in train_loop.py, in their working order.
  const LOOP = [
    "for epoch in range(1, epochs + 1):",
    "    model.train()",
    "    for jobs, hours in train_loader:",
    "        predicted = model(jobs)",
    "        loss = loss_fn(predicted, hours)",
    "        optimizer.zero_grad()",
    "        loss.backward()",
    "        optimizer.step()"
  ];
  // train_ok's listing (train_loop.py), trimmed: the update counter, the hours-off line and the print are cut.
  const TORCH_CODE = [
    ...LOOP,
    "    model.eval()",
    "    with torch.no_grad():",
    "        train_loss = loss_fn(model(train_jobs), train_hours)",
    "        val_loss = loss_fn(model(val_jobs), val_hours)",
    "    …"
  ];

  /* ---------- Derived from the data ---------- */
  const fmtRow = (e, r) => `epoch ${String(e).padStart(2)}  train loss ${r[0].toFixed(3).padStart(9)}  val loss ${r[1].toFixed(3).padStart(9)}  val off by ${r[2].toFixed(2).padStart(6)} h`;
  const rowsOut = (rows, pick) => pick.map(e => e === "…" ? "…" : fmtRow(e, rows[e - 1])).join("\n");
  const diagOut = d => `first layer: largest weight change ${d.change}  grad norm ${d.grad}`;
  const allSame = rows => rows.every(r => r.join() === rows[0].join());
  const minAt = (rows, k) => rows.reduce((b, r, i) => r[k] < rows[b][k] ? i : b, 0);
  const perEpoch = OK_UPDATES / EPOCHS;
  const ceilDiv = (a, b) => Math.ceil(a / b);
  const lastBatch = (n, b) => n - (ceilDiv(n, b) - 1) * b;
  const gradRatio = Math.round(parseFloat(NO_ZERO_DIAG.grad) / parseFloat(OK_DIAG.grad));
  const NZ_BEST = minAt(NO_ZERO, 0);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-out { margin: 14px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; font: 500 12.5px/1.55 var(--mono); color: var(--ink); white-space: pre; overflow-x: auto; max-width: 100%; }
      .lx-${ID}-out span.r { display: block; min-height: 1.55em; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-ln { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-built { margin: 14px 0 0; }
      .lx-${ID}-built .lcode div.lx-${ID}-empty { color: var(--faint); }
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .lx-${ID}-tbl th, .lx-${ID}-tbl td { text-align: left; padding: 7px 8px 7px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-tbl th { font-weight: 600; color: var(--muted); font-size: 13px; }
      .lx-${ID}-tbl td.n { font-family: var(--mono); white-space: nowrap; }
      @media (max-width: 620px) { .lx-${ID}-code .lcode { font-size: 11px; } .lx-${ID}-code .lcode div { padding: 0 8px 0 calc(8px + 4ch); text-indent: -4ch; white-space: pre-wrap; overflow-wrap: anywhere; } }
      @media (max-width: 620px) { .lx-${ID}-out { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11.5px; padding: 8px 10px; } .lx-${ID}-out span.r { display: block; padding-left: 2ch; text-indent: -2ch; } }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
      .lx-${ID}-check { list-style: none; padding: 0; margin: 12px 0 0; }
      .lx-${ID}-check li { border-bottom: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 10px; align-items: flex-start; min-height: 44px; padding: 10px 0; font-size: 15.5px; line-height: 1.45; cursor: pointer; }
      .lx-${ID}-check input { width: 22px; height: 44px; min-height: 44px; margin: -10px 0; flex: none; }
    `;
    document.head.appendChild(s);
  }
  const out = (kit, text, cap) => `<pre class="lx-${ID}-out">${text.split("\n").map(r => `<span class="r">${kit.esc(r)}</span>`).join("")}</pre>${cap ? `<p class="lx-${ID}-cap">${kit.esc(cap)}</p>` : ""}`;
  const runCap = file => `Real output of ${file}, run on this Mac, ${RUN_DATE}`;
  const ln = (kit, s) => `<span class="lx-${ID}-ln">${kit.esc(s.trim())}</span>`;
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. The situation, and the by-hand task: put the eight loop lines in order. */
  const POOL = [6, 2, 7, 0, 4, 5, 3, 1]; // fixed shuffle of LOOP indices
  const NEEDS = { 0: [], 1: [0], 2: [0, 1], 3: [2], 4: [3], 5: [2], 6: [4, 5], 7: [6] };
  const WHY_NOT = {
    0: () => "",
    1: () => "<code>model.train()</code> switches the model into training mode for one pass over the data. That pass is one epoch, so the switch belongs inside the epoch loop. Start with the loop that repeats the whole thing.",
    2: placed => placed.includes(0) ? "Before the batches start, switch the model into training mode with <code>model.train()</code>. Each epoch ends with a measuring pass in evaluation mode, so every epoch must switch back." : "The batch loop runs once per epoch, inside the epoch loop. Place the epoch loop first.",
    3: () => "A prediction is made for one batch of jobs. <code>jobs</code> only exists inside the batch loop, so that loop must come first.",
    4: () => "The loss compares the prediction with the real hours. There is no <code>predicted</code> yet: the model has to guess first.",
    5: () => "<code>zero_grad()</code> clears the gradients left over from the previous batch. It runs once per batch, so it belongs inside the batch loop.",
    6: placed => !placed.includes(4) ? "<code>backward()</code> works out how each weight affected the loss. There is no loss for this batch yet." : "Clear the old gradients first. <code>backward()</code> adds its new gradients to whatever is already stored, so the clearing must happen before it.",
    7: () => "<code>step()</code> moves each weight using its gradient. No gradient has been worked out for this batch yet: that is the job of <code>backward()</code>, which comes first."
  };
  function orderLines({ el, done, kit }) {
    ensureStyle();
    const placed = [];
    let wrong = null;
    const paint = () => {
      const fin = placed.length === LOOP.length;
      const listing = placed.length ? kit.code(placed.map(k => LOOP[k]), placed.length - 1) : `<pre class="lcode"><div class="lx-${ID}-empty">(your loop starts here)</div></pre>`;
      el.innerHTML = `<h1>Teach a model the print shop's hours</h1>
        <p class="lead">A print shop wants to show a turnaround estimate when a customer enters the page count, the paper type (plain, glossy or card) and the number of copies. It has records of ${N_TRAIN + N_VAL} past jobs with the real hours each took. A small neural network should learn to guess the hours from those three inputs. (The jobs are simulated: a script made them up from a known rule with some random spread, so every run here can be repeated.)</p>
        <p class="lead">You already know the pieces: a forward pass makes a guess, a loss says how wrong it is, gradients say which way to move each weight. The <b>training loop</b> is the code that repeats them until the model is good. It works through the jobs in small groups called <b>batches</b>. One full pass over all the training jobs is an <b>epoch</b>, and the loop runs many epochs. Here are its eight lines, shuffled.</p>
        <p class="task">Tap the lines in the order they must run, top to bottom.</p>
        <div class="lx-${ID}-built">${listing}</div>
        <div class="lpanel">${fin ? "" : `<div class="lopts">${POOL.filter(k => !placed.includes(k)).map(k => `<button type="button" data-line="${k}">${ln(kit, LOOP[k])}</button>`).join("")}</div>`}
        ${wrong != null ? kit.feedback(WHY_NOT[wrong](placed), false) : ""}
        ${fin ? kit.feedback(`That loop runs. For each epoch (one full pass over the training jobs): switch to training mode, then for each small batch of jobs: guess, measure, clear old gradients, work out new ones, move the weights. <code>zero_grad()</code> may also go first in the batch, before the guess; what matters is that it runs before <code>backward()</code>. The next screens show what happens when one of these lines is missing.`, true) : ""}</div>`;
      el.querySelectorAll("[data-line]").forEach(b => b.onclick = () => {
        const k = +b.dataset.line;
        if (NEEDS[k].every(p => placed.includes(p)) && !(k === 1 && placed.length !== 1)) { placed.push(k); wrong = null; paint(); if (placed.length === LOOP.length) done(); }
        else { wrong = k; paint(); }
      });
    };
    paint();
  }

  /* 2. Broken on purpose: a run whose loss never moves. */
  function flatLoss({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const LINES = [5, 6, 7, 1];
    const RIGHT = 2; // optimizer.step()
    const fb = [
      [`Without <code>zero_grad()</code> the weights still move, so the loss would change. We ran that copy too: its first epochs printed ${NO_ZERO[0][0].toFixed(3)}, ${NO_ZERO[1][0].toFixed(3)}, ${NO_ZERO[2][0].toFixed(3)}. Here the loss is identical every epoch.`, false],
      [`Look at the last line: the gradient norm is ${NO_STEP_DIAG.grad}. A gradient exists, so <code>backward()</code> ran. Without it, <code>.grad</code> stays <code>None</code>, and the script prints <code>None</code> there.`, false],
      [`Right. <code>backward()</code> filled the gradients (norm ${NO_STEP_DIAG.grad}), but nothing used them: the largest weight change is ${NO_STEP_DIAG.change}. Only <code>optimizer.step()</code> moves the weights. Same weights, same guesses, same loss, every epoch. A second trap: we also ran a copy with <code>loss.backward()</code> removed instead. It printed the very same flat rows, but its last line read <code>${kit.esc(diagOut(NO_BACKWARD_DIAG))}</code>. The flat loss alone cannot tell the two bugs apart; the gradient check can. Neither bug raised an error.`, true],
      ["<code>model.train()</code> only switches some layer types (dropout, batch norm) into training behaviour. This model has neither, and the switch never changes a weight. Removing it cannot freeze the loss.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The loss that never moves</h1>
        <p class="lead">A teammate trained the model for ${EPOCHS} epochs. One line of the eight is missing from their loop. Each row shows one epoch: the loss on the training jobs, the loss on ${N_VAL} held-back jobs the model never trains on ("val"), and how many hours its guesses for those jobs are off on average. After training, the script also printed how much the first layer's weights changed and the size (norm) of their gradients.</p>
        ${out(kit, rowsOut(NO_STEP, [1, 2, 3, "…", EPOCHS - 1, EPOCHS]) + "\n" + diagOut(NO_STEP_DIAG), runCap("train_loop.py (copy without one line)"))}
        <p class="task">Which missing line explains this output?</p>
        <div class="lpanel">${ask(kit, LINES.map(k => ln(kit, LOOP[k])), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: zero_grad, because backward adds to the stored gradient. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "The learning rate is too high for this data",
      "<code>backward()</code> adds each batch's gradient to the one already stored, so each step uses the sum of all batches so far",
      "The model started to memorise the training jobs (overfitting)",
      "Without <code>zero_grad()</code> the batches are no longer shuffled"
    ];
    const fb = [
      [`The learning rate is the same in both runs. The full loop, with that rate, kept improving to ${OK[EPOCHS - 1][0].toFixed(3)}. Only one line differs.`, false],
      [`Right. PyTorch's <code>backward()</code> <b>accumulates</b>: it adds the new gradient to whatever sits in <code>.grad</code>. Without clearing, the stored gradient after batch 10 is the sum of ten batches, after epoch ${EPOCHS} the sum of ${OK_UPDATES}. The steps get bigger and point where old batches wanted, not where this one does. The gradient norm at the end shows it: ${NO_ZERO_DIAG.grad} against ${OK_DIAG.grad} in the full loop, about ${gradRatio} times larger. That is why every batch starts with <code>zero_grad()</code>: the gradient stays stored from one batch to the next, so the loop must reset it.`, true],
      [`Overfitting looks different: the training loss keeps falling while the validation loss rises. Here both climb together (training ${NO_ZERO[NZ_BEST][0].toFixed(3)} at epoch ${NZ_BEST + 1}, ${NO_ZERO[EPOCHS - 1][0].toFixed(3)} at epoch ${EPOCHS}). The model is not fitting the training jobs better; it is getting worse at them.`, false],
      ["Shuffling is the data loader's job (<code>shuffle=True</code>). <code>zero_grad()</code> only touches the stored gradients. The batches came in the same shuffled order as before.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The loss that drops, then climbs</h1>
        <p class="lead">Same data, same random seed (so the same starting weights and the same batch order). This time only <code>optimizer.zero_grad()</code> is missing. The loss falls at first, then swings and climbs:</p>
        ${out(kit, rowsOut(NO_ZERO, [1, 2, 3, 4, 5, "…", 14, "…", 20, "…", EPOCHS]) + "\n" + diagOut(NO_ZERO_DIAG), runCap("train_loop.py (copy without zero_grad)"))}
        <p class="lead">The full loop, for comparison, ended at epoch ${EPOCHS} with train loss ${OK[EPOCHS - 1][0].toFixed(3)} and gradient norm ${OK_DIAG.grad}.</p>
        <p class="task">Why does one missing <code>zero_grad()</code> make training fall apart?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Batches and epochs: predict how many weight updates one epoch makes. */
  function batchPredict({ el, done, kit }) {
    ensureStyle();
    const ORDER = [1, 0, 2]; // ask about 32 first, then 1, then 300
    let q = 0, wrong = null;
    const paint = () => {
      const fin = q >= ORDER.length;
      const b = fin ? null : BATCHES[ORDER[q]];
      const right = fin ? 0 : ceilDiv(N_TRAIN, b[0]);
      const opts = fin ? [] : b[0] === 32 ? [Math.floor(N_TRAIN / 32), right, 32] : b[0] === 1 ? [1, EPOCHS, right] : [right, ceilDiv(N_TRAIN, 32), N_TRAIN];
      const say = v => {
        if (b[0] === 32 && v === Math.floor(N_TRAIN / 32)) return `${N_TRAIN} / 32 is ${(N_TRAIN / 32).toFixed(3)}. The ${lastBatch(N_TRAIN, 32)} jobs left over still form one last, smaller batch: the loader keeps it unless you set <code>drop_last=True</code>.`;
        if (v === b[0]) return `${b[0]} is how many jobs go into one batch. The question is how many batches it takes to get through all ${N_TRAIN} jobs once.`;
        if (v === EPOCHS) return `${EPOCHS} is the number of epochs. Within one epoch, every batch gives one update.`;
        return `One update per batch. How many batches of ${b[0]} does it take to cover ${N_TRAIN} jobs?`;
      };
      const done3 = ORDER.slice(0, q).map(i => BATCHES[i]);
      el.innerHTML = `<h1>How many updates per epoch?</h1>
        <p class="lead">The loader hands the loop the ${N_TRAIN} training jobs in shuffled batches (<code>DataLoader(..., batch_size=${BATCH}, shuffle=True)</code>). Every batch ends with one <code>optimizer.step()</code>: one weight update. One epoch is one pass over all ${N_TRAIN} jobs.</p>
        ${fin ? "" : `<p class="task">With <code>batch_size=${b[0]}</code>, how many weight updates does one epoch make?</p>`}
        ${done3.length ? `<table class="lx-${ID}-tbl"><thead><tr><th>batch_size</th><th>updates per epoch</th><th>after ${EPOCHS} epochs: updates</th><th>val off by</th></tr></thead><tbody>${done3.map(r => `<tr><td class="n">${r[0]}</td><td class="n">${r[1]}</td><td class="n">${r[2]}</td><td class="n">${r[3][2].toFixed(2)} h</td></tr>`).join("")}</tbody></table><p class="lx-${ID}-cap">${kit.esc(runCap("batches.py"))}</p>` : ""}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong != null ? kit.feedback(say(wrong), false) : ""}
        ${fin ? kit.feedback(`All three ran the same ${EPOCHS} passes over the same jobs. Batch size 1 made ${BATCHES[0][2] / BATCHES[2][2]} times more updates than batch size ${N_TRAIN}, and after ${EPOCHS} epochs its guesses on the held-back jobs were off by the least. A batch of one job gives a noisy direction: it follows that one job only. One huge batch gives a steady direction but only one step per pass. That is the trade-off you tune: more, noisier steps against fewer, steadier ones. And more steps mean more trips through the loop in each epoch. How each step uses its gradient is the next lesson.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => {
        const v = opts[+bt.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        if (v !== b[1]) throw new Error("prediction does not match batches.out.txt");
        wrong = null; q++; paint();
        if (q >= ORDER.length) done();
      });
    };
    paint();
  }

  /* 5. The loop from scratch in NumPy: a stepped replay of the traced run. */
  const SHOW = new Set([1, 3, 5, 6, 7, 9]);
  const FR = (() => {
    const fr = [];
    for (let k = 0; k < NP_TRACE.length - 1; k++) {
      const ran = NP_TRACE[k][0], v = NP_TRACE[k + 1];
      const st = { epoch: v[2], order: v[3], start: v[4], batch: v[5], predicted: v[6], error: v[7], weights: v[8], bias: v[9] };
      if (NP_TRACE[k + 1][1] === "r") { fr.push({ ln: 10, ...st, end: true }); continue; }
      if (SHOW.has(ran)) fr.push({ ln: ran, ...st });
    }
    return fr;
  })();
  const ASK_AT = FR.findIndex(f => f.ln === 5 && f.epoch === 0 && f.start > 0); // the frame the learner predicts
  const fmt = a => a == null ? "–" : Array.isArray(a) ? `[${a.join(", ")}]` : String(a);
  const sayNp = f => {
    if (f.end) return `Done: ${NP_ARGS.epochs} epochs, ${FR.filter(x => x.ln === 9).length} updates. Training gave weights [${f.weights.join(", ")}] and bias ${f.bias}: hours ≈ ${f.weights[0]} × pages/100 + ${f.weights[1]} × copies/100 + ${f.bias}.`;
    if (f.ln === 1) return "The model starts knowing nothing: every weight and the bias are 0.";
    if (f.ln === 3) return `Epoch ${f.epoch}: a fresh shuffle. <code>order</code> is the order the ${NP_JOBS.length} jobs are visited this time.`;
    if (f.ln === 5) return `The batch takes the next ${f.batch.length} positions of <code>order</code>: jobs ${f.batch.join(", ")}.`;
    if (f.ln === 6) return "Forward pass: a guess for each job in the batch, using the current weights.";
    if (f.ln === 7) return "The error of each guess: negative means the guess was too low.";
    if (f.ln === 9) return `The last two lines of the batch loop move the weights and bias against the gradient of the mean squared error. In PyTorch, <code>backward()</code> works out that gradient and <code>step()</code> does the move.`;
    return "";
  };
  function scratch({ el, done, kit }) {
    ensureStyle();
    let i = 0, answered = false, wrong = null;
    const nextB = ASK_AT >= 0 ? FR[ASK_AT].batch.length : 0;
    const opts = [NP_ARGS.batch_size, nextB, NP_JOBS.length];
    const paint = () => {
      const f = FR[i];
      const stop = i === ASK_AT - 1 && !answered;
      el.innerHTML = `<h1>The same loop, from scratch</h1>
        <p class="lead">First, the same loop in plain NumPy, with no PyTorch. A straight-line model (hours = jobs @ weights + bias, where <code>@</code> multiplies each input by its weight and adds the results) on ${NP_JOBS.length} jobs with two inputs (pages/100, copies/100), <code>batch_size=${NP_ARGS.batch_size}</code>, ${NP_ARGS.epochs} epochs. The gradient is written by hand, as in the backprop lessons.</p>
        <p class="task">Step through to the end. The run stops once to ask you a question.</p>
        <div class="lx-${ID}-code">${kit.code(NP_CODE, f.ln)}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 || stop ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>epoch <b>${fmt(f.epoch)}</b></span><span>batch <b>${fmt(f.batch)}</b></span><span>error <b>${fmt(f.error)}</b></span><span>weights <b>${fmt(f.weights)}</b></span><span>bias <b>${fmt(f.bias)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${stop ? `<div class="lpanel"><p class="task">The first batch used positions 0 to ${NP_ARGS.batch_size - 1} of <code>order</code>. The next batch starts at position ${NP_ARGS.batch_size}. How many jobs will it hold?</p>${kit.options(opts.map(String), { picked: wrong, correct: 1, num: true })}${wrong != null ? kit.feedback(wrong === 0 ? `There are only ${NP_JOBS.length} jobs. Positions ${NP_ARGS.batch_size} onward hold ${NP_JOBS.length - NP_ARGS.batch_size}; slicing past the end just stops at the end.` : `${NP_JOBS.length} is all the jobs. The first batch already used ${NP_ARGS.batch_size} of them in this epoch.`, false) : ""}</div>` : kit.feedback(sayNp(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
      if (stop) el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v === 1) { answered = true; wrong = null; i++; paint(); } else { wrong = v; paint(); }
      });
    };
    paint();
  }

  /* 6. The PyTorch loop: say what each line is for. */
  const JOBS = [
    { q: "Which line fills <code>.grad</code> on every weight?", lines: [4, 6, 7, 5], right: 6 },
    { q: "Which line changes the weights?", lines: [6, 7, 5, 1], right: 7 },
    { q: "Which line throws away the previous batch's gradients?", lines: [8, 7, 5, 6], right: 5 },
    { q: "Which line stops PyTorch recording the work for <code>backward()</code> while it measures?", lines: [8, 1, 9, 5], right: 9 }
  ];
  const WHAT = {
    1: "<code>model.train()</code> sets training mode. It changes how some layers behave, such as dropout and batch norm; it never touches a weight or a gradient.",
    4: "<code>loss_fn(...)</code> computes one number: how wrong this batch's guesses are. No gradient exists yet at this point.",
    5: "<code>optimizer.zero_grad()</code> clears the stored gradients so the next <code>backward()</code> starts from nothing.",
    6: "<code>loss.backward()</code> works out each weight's gradient and adds it into that weight's <code>.grad</code>. It moves no weight.",
    7: "<code>optimizer.step()</code> moves every weight using its <code>.grad</code>. It does not compute any gradient itself.",
    8: "<code>model.eval()</code> switches dropout and batch norm layers to their measuring behaviour. Gradients would still be recorded after it.",
    9: "<code>with torch.no_grad():</code> turns off gradient recording for the lines inside it. That saves memory, and nothing measured there can be trained on by accident."
  };
  function torchLines({ el, done, kit }) {
    ensureStyle();
    let q = 0, wrong = null;
    const paint = () => {
      const fin = q >= JOBS.length, J = JOBS[q];
      el.innerHTML = `<h1>Each line has one job</h1>
        <p class="lead">The PyTorch loop that trained the print-shop model (<code>batch_size=${BATCH}</code>, ${EPOCHS} epochs). The lines that count updates, work out the hours off and print a row are cut (…). The weights live inside <code>model</code>; <code>optimizer</code> was built with <code>torch.optim.SGD(model.parameters(), lr=0.01)</code>, so it knows which weights to move.</p>
        <div class="lx-${ID}-code">${kit.code(TORCH_CODE, -1)}</div>
        ${fin ? "" : `<p class="task">${J.q} (${q + 1} of ${JOBS.length})</p>`}
        <div class="lpanel">${fin ? "" : kit.options(J.lines.map(k => ln(kit, TORCH_CODE[k])), { picked: wrong == null ? null : J.lines.indexOf(wrong), correct: J.lines.indexOf(J.right) })}
        ${wrong != null ? kit.feedback(`Not that one. ${WHAT[wrong]}`, false) : ""}
        ${fin ? `${kit.feedback(`Four jobs, four lines: <code>backward()</code> computes, <code>step()</code> moves, <code>zero_grad()</code> clears, <code>no_grad()</code> stops recording. The run made ${OK_UPDATES} updates (${perEpoch} per epoch). Its output:`, true)}${out(kit, rowsOut(OK, [1, 2, 3, "…", 12, 13, "…", EPOCHS - 1, EPOCHS]) + `\nweight updates: ${OK_UPDATES}`, runCap("train_loop.py"))}<p class="lead">The loss does not fall every single epoch: epoch 13 is worse than epoch 12. Each epoch's steps follow differently shuffled batches, and some epochs end in a worse spot. Judge the trend, not one epoch.</p>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const k = J.lines[+b.dataset.i];
        if (k !== J.right) { wrong = k; paint(); return; }
        wrong = null; q++; paint();
        if (q >= JOBS.length) done();
      });
    };
    paint();
  }

  /* 7. The validation pass: measure on held-back jobs, never train on them. */
  function validation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 2;
    const last = OK[EPOCHS - 1];
    const opts = [
      ln(kit, "model(val_jobs)"),
      ln(kit, "loss_fn(model(val_jobs), val_hours)"),
      ln(kit, "loss.backward() then optimizer.step()"),
      ln(kit, "model.eval()")
    ];
    const fb = [
      ["You need the model's guesses for the held-back jobs; without them there is nothing to measure. A forward pass reads the weights and changes none of them.", false],
      ["Measuring is the whole point of this pass. Computing a loss changes nothing in the model; only a step does.", false],
      [`Right. A step on the held-back jobs would train on them. The model would learn those exact ${N_VAL} jobs, and their loss would stop telling you how it does on a new customer's job. That is why the pass sits inside <code>torch.no_grad()</code>: nothing in it can be trained on. After epoch ${EPOCHS} the held-back loss is ${last[1].toFixed(3)} against ${last[0].toFixed(3)} on the training jobs, a little worse, as expected for jobs it never learned from. The honest number for the shop: on the held-back jobs this model is off by ${last[2].toFixed(2)} hours on average, the best guess of how it will do on new ones.`, true],
      ["<code>model.eval()</code> belongs here: it switches dropout and batch norm to measuring behaviour. This model has neither, so here it changes nothing, but leaving it in costs nothing and keeps the loop right when such layers are added. It never changes a weight.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Measure, but do not learn</h1>
        <p class="lead">${N_VAL} of the ${N_TRAIN + N_VAL} jobs were held back and never trained on. After each epoch the loop measures the model on them: the <b>validation pass</b>. It runs after <code>model.eval()</code>, inside <code>with torch.no_grad():</code>.</p>
        <div class="lx-${ID}-code">${kit.code(TORCH_CODE.slice(8, 12), -1)}</div>
        <p class="task">Which of these must never run on the held-back jobs?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "The print shop itself: 3 inputs, 400 jobs, and the hours follow a simple rule (sheets divided by a speed per paper type)",
      "A proofing team wants a model that spots smudges in thousands of scanned pages, and needs a custom check after every epoch",
      "A model already trains with the loop above; the shop only wants the estimate shown on its website"
    ];
    const fb = [
      ["A hand-written network loop is more than this needs. With three inputs and a rule this simple, a classic model from the earlier stage (a linear regression on sheets, one per paper type) fits it, trains in one call and has no loop lines to forget.", false],
      ["Right. Images, lots of data, a neural network, and control over each epoch: that is what writing the loop yourself is for.", true],
      ["That is a serving question, not a training one. The loop is done; the website needs the trained model loaded and called once per request, with no loss, no backward and no step.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to write the loop yourself</h1>
        <p class="lead"><b>For:</b> training a neural network in PyTorch, where nothing runs the loop for you. <b>Reach for it</b> when you need control: your own validation checks, saving the best epoch, unusual data. <b>Not</b> for small tables with a simple rule: a classic model does it in one call. When your loop is completely standard, a ready-made trainer library saves you writing it. <b>Costs:</b> compute that grows with epochs and data, your time to tune batch size and learning rate, and silent bugs: a missing <code>step()</code> or <code>zero_grad()</code> raises no error, it just trains badly.</p>
        <p class="task">Which of these calls for writing a PyTorch training loop?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it: is a loop line the cause? */
  const CASES = [
    ["A sentiment model prints exactly the same training loss, to the last digit, for 20 epochs. No error appears. The optimizer was built from this model's parameters with the usual learning rate.", true,
      "Yes. Identical loss means identical weights: <code>step()</code> never ran, or <code>backward()</code> never ran. Print a weight before and after an epoch and check whether <code>.grad</code> is <code>None</code> to tell which.",
      "A loss that does not change at all means the weights do not change. Only <code>step()</code> moves them, and it needs <code>backward()</code> first. Check both lines."],
    ["A loss falls for a few epochs, then swings and grows. The learning rate is small and was never changed, and the gradient norm grows a little with every batch.", true,
      "Yes. A gradient that grows batch after batch with a fixed rate is the accumulation you saw: <code>zero_grad()</code> is missing or sits outside the batch loop.",
      "A gradient norm that grows with every batch, at a fixed learning rate, is the sign that old gradients are being added to new ones. That is the <code>zero_grad()</code> line, missing or in the wrong place."],
    ["Training and validation loss both fall smoothly and end low, but the estimates are far off in real use: the target column held the deadline promised to each customer, not the hours the job really took.", false,
      "No. The loop did its job perfectly: it learned to predict the column it was given. Reordering loop lines cannot fix a wrong target; fix the data.",
      "Every loop line works here: the loss fell on both sets. The model learned exactly what it was told to learn. The mistake is in the data, before the loop starts."],
    ["A model reports a validation loss far lower than anyone expected. You find that the validation jobs were also inside the training loader.", false,
      "No, the loop lines are fine; the split is not. The model trained on the jobs it is measured on, so the score is not honest. Rebuild the split so held-back jobs never reach the training loader.",
      "No line of the loop is missing. The problem is which jobs went into which set: measuring on jobs the model trained on makes the score look better than it is."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is a loop line the cause?</h1>
        <p class="lead">Four training problems from other teams.</p>
        <p class="task">For each one: is a missing or misplaced loop line the cause? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and its checklist. */
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s3-training-loop.ipynb";
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const first = OK[0][0], lastT = OK[EPOCHS - 1][0];
    const valAbove = OK.every(r => r[1] > r[0]);
    const CHECK = [
      `With ${N_TRAIN} training jobs and <code>batch_size=${BATCH}</code>, the loop makes ${perEpoch} weight updates per epoch (${OK_UPDATES} after ${EPOCHS} epochs).`,
      `The training loss starts near ${Math.round(first)} in epoch 1 and ends below ${Math.ceil(lastT)} by epoch ${EPOCHS}, with a few bumps on the way.`,
      valAbove ? "The validation loss stays a little above the training loss in every epoch." : "The validation loss ends close to the training loss.",
      `With <code>optimizer.step()</code> deleted, every epoch prints the same loss and the first layer's weights change by 0.`,
      "With <code>loss.backward()</code> deleted, the loss is just as flat, but the gradient norm prints <code>None</code>.",
      "With <code>optimizer.zero_grad()</code> deleted, the loss falls for a few epochs, then swings and climbs."
    ];
    el.innerHTML = `<h1>You can write the loop</h1>
      <p class="lead">You put the eight lines in order, found a missing <code>step()</code> from a flat loss and a missing <code>zero_grad()</code> from a climbing one, stepped through the loop in NumPy, and kept the validation pass free of training.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook in Colab</a>` : "The notebook for this lesson is on its way"}. You train the print-shop model yourself and break the loop on purpose. What you should see (exact numbers may differ a little on another PyTorch version):</p>
      <ul class="lx-${ID}-check">${CHECK.map(c => `<li><label><input type="checkbox"> <span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Your loop calls <code>optimizer.step()</code> without asking how it moves the weights; next you compare plain SGD with momentum and Adam.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "The training loop, line by line",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.Optimizer.zero_grad.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.backward.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Module.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.no_grad.html",
      "https://docs.pytorch.org/docs/2.15/data.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.MSELoss.html",
      "https://www.deeplearningbook.org/contents/optimization.html"
    ],
    interview: [
      {
        q: "A junior engineer's model trains for an hour, the loss prints the same value every epoch, and nothing crashes. How do you find the bug?",
        good: [
          "An identical loss means the weights are not changing, so look at the update path in the loop",
          "Print one weight before and after an epoch to confirm it does not move",
          "Check whether .grad is None (backward never ran) or filled (step never ran, or the optimizer holds different parameters)",
          "Check that the optimizer was built from model.parameters() of the same model being trained",
          "Overfit one small batch first: a working loop drives its loss down quickly"
        ],
        weak: "Raise the learning rate or train longer. Neither helps if step() or backward() never runs, and it skips checking whether the weights move at all."
      },
      {
        q: "Your validation loss looks great, but the model does badly once deployed. What in the training loop and the data split would you check?",
        good: [
          "That the validation jobs never reach the training loader, so the model was not trained on what it is measured on",
          "That the validation pass has no backward() or step(), and runs under torch.no_grad()",
          "That model.eval() is called before measuring, so dropout and batch norm behave as in use",
          "That model.train() is called again before the next epoch's training",
          "That the validation set looks like the real traffic the model now sees"
        ],
        weak: "Say the model overfits and add more layers or epochs, without checking whether the validation numbers were honest in the first place."
      }
    ],
    screens: [orderLines, flatLoss, spotIdea, batchPredict, scratch, torchLines, validation, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-line="7"]'], right: LOOP.map((_, k) => `[data-line="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(3).fill("[data-right]") },
      { wrong: [...Array(ASK_AT - 1).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]", ...Array(FR.length - 1 - ASK_AT).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: Array(JOBS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
