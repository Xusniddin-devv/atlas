/* Lesson: batch norm against layer norm. Story: a sports-watch team trains a heart-rate model on long recordings
   and can fit only two recordings per batch on its GPU.
   Ideas: (1) batch norm normalizes each feature with the statistics of the current batch, so with two recordings
   it only says which of the two is larger, and with one it has nothing to work with; layer norm normalizes the
   features of one recording, so it does not care about the batch. (2) Batch norm keeps running statistics for
   eval mode, so forgetting model.eval() makes predictions depend on the other recordings in the batch.
   Data, all from real runs on this Mac (PyTorch 2.15, CPU), in docs/ai-path/runs/s3-normalization/:
   - by_hand.py + by_hand.out.txt: nn.BatchNorm1d and nn.LayerNorm on the hand-sized batches, the batch-of-one
     error, the running statistics after one batch;
   - train_eval.py + train_eval.out.txt: a tiny conv net on 300 synthetic heart-rate recordings, trained with
     batch norm (batches of 2), layer norm (batches of 2) and batch norm (batches of 32, "version 1");
   - forgot_eval.py + forgot_eval.out.txt: version 1 checked without model.eval(), then with it.
   No model API calls. Lesson-local style: a monospace log block (.lx-s3-normalization-*), see ensureStyle(). */
(() => {
  const ID = "s3-normalization";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s3-normalization.ipynb";
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toString();

  /* ---------- Data copied from the runs ---------- */
  // by_hand.out.txt: nn.BatchNorm1d(1), training mode, one value per recording (average heart rate, bpm)
  const A = 72, B = 148, C = 50;
  const BN_RUN = {
    "72,148": [-1.0, 1.0],
    "72,50": [1.0, -1.0],
    "70,74": [-0.999996, 1.0],
    "72,148,90,61": [-0.618731, 1.647466, -0.082001, -0.946734]
  };
  const ONE_ERR = "ValueError: Expected more than 1 value per channel when training, got input size torch.Size([1, 1])";
  // by_hand.out.txt: nn.LayerNorm(4) on recording A's four hidden values, alone, with two partners, in eval mode
  const HID_A = [2.0, 4.0, 6.0, 8.0];
  const LN_A = [-1.34164, -0.447213, 0.447213, 1.34164];
  const BN4_P1 = [-1.0, 1.0, 0.999999, 1.0], BN4_P2 = [0.999995, 0.999999, 1.0, 1.0];
  // by_hand.out.txt: running statistics of a fresh BatchNorm1d(1) after one training batch [72, 148]
  const RUN0 = { mean: 0.0, var: 1.0, momentum: 0.1 };
  const RUN1 = { mean: 11.0, var: 289.700012 };
  const EVAL_A = 3.583898;
  // train_eval.out.txt: [norm, batch size, epoch, mean train loss, val acc (eval mode)]
  const TRAIN = [
    ["batch", 2, 1, 0.705, 0.57], ["batch", 2, 2, 0.712, 0.53], ["batch", 2, 3, 0.702, 0.49], ["batch", 2, 4, 0.689, 0.49], ["batch", 2, 5, 0.691, 0.60],
    ["layer", 2, 1, 0.709, 0.51], ["layer", 2, 2, 0.573, 1.00], ["layer", 2, 3, 0.175, 1.00], ["layer", 2, 4, 0.008, 1.00], ["layer", 2, 5, 0.004, 1.00],
    ["batch", 32, 5, 0.497, 0.75], ["batch", 32, 10, 0.238, 1.00], ["batch", 32, 15, 0.062, 1.00], ["batch", 32, 20, 0.033, 1.00], ["batch", 32, 25, 0.024, 1.00], ["batch", 32, 30, 0.015, 1.00]
  ];
  const N_REC = 300, N_VAL = 100, LEN = 240; // train_eval.py: 200 train + 100 val recordings of 240 readings
  // forgot_eval.out.txt, the buggy check (no model.eval()), lines not altered
  const BUGGY_LOG = [
    "model.training: True",
    "val acc, batches of 2, shuffle seed 1: 0.68",
    "val acc, batches of 2, shuffle seed 2: 0.72",
    "recording 0 paired with recording 1: P(irregular) = 0.797   (true label 0)",
    "recording 0 paired with recording 2: P(irregular) = 0.007   (true label 0)",
    "recording 0 paired with recording 3: P(irregular) = 0.008   (true label 0)",
    "watch app, one recording: ValueError: Expected more than 1 value per channel when training, got input size torch.Size([1, 16])"
  ];
  const FIXED_LOG = [
    "model.training: False",
    "val acc, batches of 2, shuffle seed 1: 1.00",
    "val acc, batches of 2, shuffle seed 2: 1.00",
    "recording 0 paired with recording 1: P(irregular) = 0.009   (true label 0)",
    "recording 0 paired with recording 2: P(irregular) = 0.009   (true label 0)",
    "recording 0 paired with recording 3: P(irregular) = 0.009   (true label 0)",
    "watch app, one recording: P(irregular) = 0.009"
  ];
  // make_model from train_eval.py, line for line
  const CODE = [
    "def make_model(norm):",
    "    torch.manual_seed(0)",
    "    norm_layer = nn.BatchNorm1d(16) if norm == \"batch\" else nn.LayerNorm(16)",
    "    return nn.Sequential(",
    "        nn.Conv1d(1, 8, kernel_size=5), nn.ReLU(),",
    "        nn.AdaptiveAvgPool1d(1), nn.Flatten(),",
    "        nn.Linear(8, 16), norm_layer, nn.ReLU(),",
    "        nn.Linear(16, 2))"
  ];

  /* ---------- Derived from the data ---------- */
  const M1 = mean([A, B]), SD1 = Math.abs(A - B) / 2;       // batch mean and spread (biased std) of [72, 148]
  const OUT_A = (A - M1) / SD1;
  const M2 = mean([A, C]);
  const LN_MEAN = mean(HID_A);
  const LN_SD = Math.sqrt(mean(HID_A.map(v => (v - LN_MEAN) ** 2)));
  const CHANCE_LOSS = Math.log(2);                          // cross-entropy of a 50/50 guess on two classes
  const runOf = (n, bs) => TRAIN.filter(r => r[0] === n && r[1] === bs);
  const last = rows => rows[rows.length - 1];
  const BN2 = runOf("batch", 2), LN2 = runOf("layer", 2), BN32 = runOf("batch", 32);
  const UNBIASED_VAR1 = ((A - M1) ** 2 + (B - M1) ** 2) / (2 - 1);
  const RUN_MEAN_CALC = (1 - RUN0.momentum) * RUN0.mean + RUN0.momentum * M1;
  const RUN_VAR_CALC = (1 - RUN0.momentum) * RUN0.var + RUN0.momentum * UNBIASED_VAR1;
  const pOf = s => +s.match(/P\(irregular\) = ([\d.]+)/)[1];
  const BUG_P = BUGGY_LOG.filter(s => s.includes("paired")).map(pOf);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-log { margin: 14px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); border-radius: 6px;
        font: 500 13.5px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-done { margin: 12px 0 0; }
      .lx-${ID}-check { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-check li { border-bottom: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; font-size: 15.5px; line-height: 1.45; cursor: pointer; }
      .lx-${ID}-check label span { padding-top: 10px; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .lx-${ID}-check input:checked { background-color: var(--good); outline-color: var(--good); }
      .lx-${ID}-check input:focus-visible { outline-width: 3px; }
      .lx-${ID}-opt { text-align: left; }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  const logBlock = (kit, lines) => `<div class="lx-${ID}-log">${lines.map(l => kit.esc(l)).join("\n")}</div>`;
  const runCap = file => `<p class="lx-${ID}-cap">Real output, our run of <code>${file}</code> on a laptop CPU.</p>`;
  const py = v => Number.isInteger(v) ? v.toFixed(1) : String(v); // a PyTorch float as Python printed it
  const list = a => `[${a.map(py).join(", ")}]`;

  /* A screen of questions asked one after another. Each step: { task, opts, right, fb: [html per option] }.
     Answered steps stay on screen as their right feedback; done() after the last right answer. */
  function steps(ctx, head, S) {
    const { el, done, kit } = ctx;
    let k = 0, picked = null;
    const paint = () => {
      const fin = k >= S.length;
      const answered = S.slice(0, k).map(s => kit.feedback(s.fb[s.right], true)).join("");
      const cur = fin ? "" : `<p class="task">${S[k].task}</p>${kit.options(S[k].opts, { picked, correct: S[k].right })}${picked == null ? "" : kit.feedback(S[k].fb[picked], false)}`;
      el.innerHTML = `${head(k)}<div class="lpanel">${answered}${cur}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === S[k].right) { k++; picked = null; paint(); if (k >= S.length) done(); return; }
        picked = i; paint();
      });
    };
    paint();
  }

  /* 1. The situation, and batch norm by hand on a batch of two. */
  function byHand(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const head = () => `<h1>Two recordings per batch</h1>
      <p class="lead">A sports-watch team trains a network that reads long heart-rate recordings and flags irregular rhythm. Deep networks train faster and more steadily when the values passed between layers stay in a steady range. A <b>normalization layer</b> keeps them there, and this lesson compares the two common kinds. Each recording is long, so the GPU can hold only <b>two</b> per batch. The network has a <b>batch norm</b> layer. In training, for every feature (one number the network has for each recording) it does this: take the batch's mean, subtract it from each value, divide by the batch's spread (the standard deviation).</p>
      <p class="lead">Try it on one feature: the average heart rate of each recording. Recording A averages <b>${A}</b> bpm (beats per minute), recording B <b>${B}</b> bpm.</p>`;
    steps(ctx, head, [
      { task: "What is the batch mean?", opts: [String(A), String(M1), String(B), String(B - A)], right: 1,
        fb: [`${A} is recording A on its own. The mean uses both values in the batch.`,
          `Right: (${A} + ${B}) / 2 = ${M1}. Each recording is ${SD1} bpm away from it, so the spread is ${SD1}.`,
          `${B} is recording B on its own. The mean uses both values in the batch.`,
          `${B - A} is the gap between the two, not their mean. Add them and halve.`] },
      { task: `Now normalize A: (${A} − ${M1}) / ${SD1}. What comes out?`, opts: [fmt(OUT_A, 1), "0", String(A - M1), "+1"], right: 0,
        fb: [`Right: ${A - M1} / ${SD1} = ${fmt(OUT_A, 1)}. PyTorch's <code>nn.BatchNorm1d</code> in training mode gave exactly this for the batch [${A}, ${B}]: ${list(BN_RUN["72,148"])}.${runCap("by_hand.py")}`,
          "0 would mean A sits exactly on the mean. It is below it.",
          `${A - M1} is only the first half: A minus the mean. Divide by the spread, ${SD1}, as well.`,
          `A is below the mean, so its result is negative. +1 belongs to B.`] }
    ]);
  }

  /* 2. Change the partner, shrink the gap, take one recording away. */
  function partner(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const head = () => `<h1>Same recording, new partner</h1>
      <p class="lead">Recording A is the same ${A} bpm as before. Only the other recording in its batch changes. Predict each result by the same rule, then compare with PyTorch.</p>`;
    steps(ctx, head, [
      { task: `A (${A}) shares a batch with a recording at ${C} bpm. What does A come out as?`, opts: ["−1, as before", "+1", "0", `${A}, unchanged`], right: 1,
        fb: [`The batch mean is now ${M2}, and A is above it. The result depends on the partner, not only on A.`,
          `Right: the mean is now ${M2}, A is above it, so A becomes +1. PyTorch: [${A}, ${C}] gave ${list(BN_RUN["72,50"])}. A's heart rate did not change; its output flipped.`,
          `A is not on the mean (${M2}); it is above it.`,
          "Batch norm in training mode always rescales. Nothing passes through unchanged."] },
      { task: "Two very similar recordings: 70 and 74 bpm. What do they come out as?", opts: ["Close to 0, both", "About −1 and +1", "−2 and +2", "70 and 74"], right: 1,
        fb: ["They are close to each other, but the rule divides by their spread, which is small too. The small gap is blown up.",
          `Right: PyTorch gave ${list(BN_RUN["70,74"])}. With two different values, the result is about −1 and +1, however near or far apart they are. Only two almost equal values come out near 0. Why not exactly −1? The layer adds a tiny number, <code>eps</code> (1e-5 by default), to the spread squared so it never divides by zero, and the computer rounds.`,
          "That is subtracting the mean (72) but not dividing by the spread (2).",
          "Batch norm in training mode always rescales. Nothing passes through unchanged."] },
      { task: `A batch of one: only A (${A}). By the rule, what would A come out as?`, opts: ["+1", "−1", "0", `${A}`], right: 2,
        fb: ["With one value the mean is the value itself. Nothing is above it.",
          "With one value the mean is the value itself. Nothing is below it.",
          `Right: ${A} − ${A} = 0, and the spread is 0 too, so every recording would come out as 0. That is useless, and PyTorch refuses instead:${logBlock(kit, [ONE_ERR])}${runCap("by_hand.py")}`,
          "In training mode the layer must use the batch's own mean, which is A itself."] }
    ]);
  }

  /* 3. Spot the idea. */
  function spotIdea(ctx) {
    ensureStyle();
    const { el, done, kit } = ctx;
    let ans = null;
    const opts = [
      "A's heart rate on a common scale, so recordings can be compared across batches",
      "Only whether A is above or below the other recording in its batch",
      "Nothing at all: every output is 0",
      "How far A is from the average watch user"
    ];
    const fb = [
      `That is what batch norm gives with a big batch: the batch statistics are close to those of all recordings. With two, A came out as −1 next to ${B} and +1 next to ${C}. No common scale survives.`,
      `Right. Batch norm normalizes <b>each feature across the batch</b>. Its mean and spread come from the other recordings in the batch, so a recording's output depends on who it was batched with. With a big batch that noise averages out, and batch norm works well: the original paper used it to train with much higher learning rates. With two recordings, every value turns into about −1 or +1: the size of the gap is thrown away, and the next layer learns only which of the two is higher.`,
      "That is the batch of one. With two recordings the outputs are about −1 and +1, not 0.",
      `The layer never sees other users. It sees only the two recordings in this batch, so ${B} decided A's result.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>What survives batch norm?</h1>
        <p class="lead">Your results: A at ${A} bpm became ${py(BN_RUN["72,148"][0])} next to ${B}, and ${py(BN_RUN["72,50"][0])} next to ${C}. Two recordings ${74 - 70} bpm apart (70 and 74) became ${py(BN_RUN["70,74"][0])} and ${py(BN_RUN["70,74"][1])}. A batch of four, for comparison, gave ${list(BN_RUN["72,148,90,61"])}.</p>
        <p class="task">With two recordings per batch, what does the next layer learn about A from this output?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(fb[ans], ans === 1)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Layer norm by hand: normalize across one recording's features. */
  function layerNorm(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const head = () => `<h1>Normalize inside one recording</h1>
      <p class="lead"><b>Layer norm</b> uses the same rule in the other direction. Batch norm took one feature across the batch; layer norm takes all the features of <b>one</b> recording, here the 4 values a hidden layer produced for A: <b>${HID_A.join(", ")}</b>. It subtracts their mean and divides by their spread. Other recordings never enter.</p>`;
    steps(ctx, head, [
      { task: "Which mean does layer norm subtract from A's values?", opts: [`${fmt(LN_MEAN)}, the mean of A's 4 values`, "The mean of feature 1 over the batch", "The running mean from training", "0, it only divides"], right: 0,
        fb: [`Right: (${HID_A.join(" + ")}) / ${HID_A.length} = ${fmt(LN_MEAN)}. The spread is ${fmt(LN_SD, 3)}, so the first value becomes (${HID_A[0]} − ${fmt(LN_MEAN)}) / ${fmt(LN_SD, 3)} = ${fmt((HID_A[0] - LN_MEAN) / LN_SD, 3)}. PyTorch's <code>nn.LayerNorm(4)</code> gave ${list(LN_A)}.`,
          "That is batch norm: one feature, across the batch. Layer norm goes across the features of one recording.",
          "Layer norm keeps no running statistics. It computes the mean fresh from each recording.",
          "It subtracts a mean too, the same rule as before. Only the direction changes."] },
      { task: "A is now batched with a very different recording. What happens to A's layer-norm output?", opts: ["It flips, as with batch norm", "It stays exactly the same", "It moves a little"], right: 1,
        fb: ["Batch norm flips because it averages across the batch. Layer norm never looks at the partner.",
          `Right. In our run A came out as ${list(LN_A)} alone and with both partners. Batch norm on the same 4 values gave ${list(BN4_P1)} with one partner and ${list(BN4_P2)} with the other.${runCap("by_hand.py")}`,
          "Nothing from the partner enters the sums, so nothing can move."] },
      { task: "And a batch of one, A alone, in training mode?", opts: ["The same error as batch norm", "Works, the same output", "All zeros"], right: 1,
        fb: ["Batch norm failed because one value per feature has no spread. A has 4 values of its own, and that is all layer norm needs.",
          `Right. It works with one recording, and the PyTorch documentation says layer norm "uses statistics computed from input data in both training and evaluation modes": the same computation in both. Nothing to switch off later.`,
          "Zeros came from batch norm's rule on a single value. A's 4 values differ from each other, so they normalize normally."] }
    ]);
  }

  /* 5. The real library: the swap is one line; predict which run learns. */
  function library(ctx) {
    ensureStyle();
    const { el, done, kit } = ctx;
    let ans = null;
    const opts = ["Batch norm learns, layer norm does not", "Layer norm learns, batch norm does not", "Both learn the same", "Neither learns"];
    // rebuilds the printed line exactly (train_eval.py's f-string)
    const row = r => `${r[0]} norm, batch ${String(r[1]).padStart(2)}, epoch ${r[2]}: mean train loss ${r[3].toFixed(3)}  val acc (eval mode) ${r[4].toFixed(2)}`;
    const fb = [
      "The opposite. Think of what batch norm gives with two recordings: about −1 and +1 for every feature.",
      `Right. Batch norm with batches of 2 stayed near a loss of ${fmt(CHANCE_LOSS, 3)}, which is what a 50/50 guess scores on two classes (ln 2); its validation accuracy ended at ${last(BN2)[4].toFixed(2)}. Layer norm reached ${last(LN2)[4].toFixed(2)}. Batch norm is not broken: with batches of 32 (and ${last(BN32)[2]} epochs, since big batches take fewer steps per epoch) it reached ${last(BN32)[4].toFixed(2)} too.${logBlock(kit, [...BN2, ...LN2, last(BN32)].map(row))}${runCap("train_eval.py")}<p class="lead">The parameters that matter. <code>nn.BatchNorm1d(num_features)</code>: the number of features (16 here); <code>eps</code> (1e-5) keeps the division safe; <code>momentum</code> (0.1) sets how fast the running statistics move, next screen. <code>nn.LayerNorm(normalized_shape)</code>: the size of the last dimensions to normalize over (16 here). Both learn a scale and a shift per feature after normalizing (<code>affine</code> and <code>elementwise_affine</code>, on by default), so the network can undo the normalization where it helps.</p>`,
      "Their train losses went very different ways. Ask what each layer passes on with two recordings.",
      "One of them reached perfect validation accuracy on this data. Ask which one does not depend on the batch."
    ];
    const paint = () => {
      el.innerHTML = `<h1>The swap in PyTorch is one line</h1>
        <p class="lead">We built the team's problem small: ${N_REC} synthetic heart-rate recordings of ${LEN} readings, about half with irregular jumps, and this tiny network. The highlighted line picks the normalization: <code>nn.BatchNorm1d(16)</code> or <code>nn.LayerNorm(16)</code>, nothing else changes. Both versions were trained the same way for ${BN2.length} epochs, with <b>batches of 2</b>, and then checked in eval mode (the checking setting; the next screen explains it).</p>
        ${kit.code(CODE, 2)}
        <p class="task">Predict: which version learns to flag irregular rhythm?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}${ans == null ? "" : kit.feedback(fb[ans], ans === 1)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 6. Train and eval: running statistics. */
  function runningStats(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const head = () => `<h1>What batch norm does at test time</h1>
      <p class="lead">At test time there may be one recording, so batch norm cannot use the batch. Instead, during training it keeps a <b>running mean</b> and <b>running variance</b> (the spread squared) of every feature. After each training batch: new = ${1 - RUN0.momentum} × old + ${RUN0.momentum} × this batch's value (${RUN0.momentum} is <code>momentum</code>). A fresh layer starts with running mean ${RUN0.mean} and running variance ${RUN0.var}. In <b>eval mode</b> (<code>model.eval()</code>) it normalizes with these stored values instead of the batch.</p>`;
    steps(ctx, head, [
      { task: `One training batch [${A}, ${B}] passes (batch mean ${M1}). What is the running mean now?`, opts: [String(M1), fmt(RUN_MEAN_CALC), "0", String(A)], right: 1,
        fb: [`That is the batch mean. The running mean moves only ${RUN0.momentum} of the way towards it each batch.`,
          `Right: ${1 - RUN0.momentum} × ${RUN0.mean} + ${RUN0.momentum} × ${M1} = ${fmt(RUN_MEAN_CALC)}. PyTorch stored ${py(RUN1.mean)}. The running variance became ${RUN1.var}. For this update PyTorch divides the squared gaps by n − 1 (here 1) instead of n (here 2), so this batch's variance counts as ${fmt(UNBIASED_VAR1)}: ${1 - RUN0.momentum} × ${RUN0.var} + ${RUN0.momentum} × ${fmt(UNBIASED_VAR1)} = ${fmt(RUN_VAR_CALC, 1)}. After many batches these settle near the whole dataset's statistics.`,
          "It does move: every training batch updates it.",
          `${A} is one recording. The update uses the batch mean.`] },
      { task: `Now eval mode, A (${A}) alone. Does it work, and does the partner matter?`, opts: ["Error, as in training", "Works; the output no longer depends on any partner", "Works, but differs with each partner"], right: 1,
        fb: ["The error came from computing a spread over one value. Eval mode uses the stored values, so one recording is fine.",
          `Right. PyTorch gave ${EVAL_A} for A alone, and the same ${EVAL_A} for A inside the batch [${A}, ${B}]: (${A} − ${RUN1.mean}) / √${RUN1.var}. Eval mode is a fixed rescale. That is why you must call <code>model.eval()</code> before you check or serve a model, and <code>model.train()</code> before training again.${runCap("by_hand.py")}`,
          "Eval mode does not look at the batch at all, so the partner cannot change anything."] }
    ]);
  }

  /* 7. Broken on purpose: the check forgot model.eval(). */
  function broken(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const head = k => `<h1>Broken on purpose: the check that disagrees with itself</h1>
      <p class="lead">Version 1 of the model used batch norm and was trained earlier on a bigger machine, with batches of 32. In training it reached a validation accuracy of ${last(BN32)[4].toFixed(2)}. A new checking script, written for the watch app, printed this. It checks in batches of 2; each shuffle seed pairs the recordings differently. <code>P(irregular)</code> is the model's probability that a recording's rhythm is irregular; true label 0 means steady.</p>
      ${logBlock(kit, BUGGY_LOG)}${runCap("forgot_eval.py")}`;
    steps(ctx, head, [
      { task: `Recording 0 got ${BUG_P.join(", ")} for the same question. What is the cause?`, opts: [
        "The model overfits the training data",
        "The model is still in training mode, so batch norm uses each batch's two recordings",
        "The validation set is shuffled badly",
        "The watch sends the recording in the wrong shape"], right: 1,
        fb: ["Overfitting would give the same wrong answer every time. Here one recording's answer changes with its partner, and the same weights scored perfectly before.",
          `Right. The first line says it: <code>model.training: True</code>. Batch norm then normalizes each batch of two with its own mean and spread, so recording 0's answer depends on who it is paired with, the accuracy changes with the shuffle, and one recording alone crashes.`,
          "Shuffling changes which recordings share a batch. That only matters because something depends on the batch: a symptom, not the cause.",
          "[1, 16] is the normal shape at the batch-norm layer for one recording: its 16 hidden values. The error says the layer needs more than one value per feature, which only training mode asks for."] },
      { task: "Which change fixes the check?", opts: [
        "Wrap it in <code>torch.no_grad()</code>",
        "Call <code>model.eval()</code> before predicting",
        "Check with batches of 32",
        "Retrain with layer norm"], right: 1,
        fb: ["The check already runs under <code>torch.no_grad()</code>. That stops gradient tracking; it does not change how batch norm behaves. The PyTorch docs call eval mode and no-grad mode completely separate.",
          `Right. The same saved weights, after <code>model.eval()</code>:${logBlock(kit, FIXED_LOG)}${runCap("forgot_eval.py")}Recording 0 gets the same answer with every partner and alone. One more trap: a training-mode pass also updates the running statistics, so a check that forgets <code>eval()</code> quietly changes the model it checks.`,
          "Bigger batches make the batch statistics less noisy, but the answer still depends on the batch, and the watch still sends one recording.",
          "That would work for the next model, but this one is fine. Its weights scored perfectly in eval mode; the check is what is wrong."] }
    ]);
  }

  /* 8. The big picture. */
  function bigPicture(ctx) {
    ensureStyle();
    const { el, done, kit } = ctx;
    let ans = null;
    const opts = ["The train-versus-eval switch for the normalization layer", "The extra computation in every layer", "Scaling the input features before training"];
    const fb = [
      "Right. Layer norm computes the same thing in training and in eval, so there are no running statistics to keep right and no batch-size limit. The team still needs <code>model.eval()</code> for other layers that behave differently in training, such as dropout, the next lesson's topic.",
      "Layer norm still computes a mean and a spread at every layer, so that cost stays.",
      "Normalizing inside the network does not replace preparing the inputs. Scaling features is still done once, before training."
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to normalize, and with what</h1>
        <p class="lead"><b>What:</b> both layers rescale the values inside a network around mean 0 with spread 1. Batch norm does it for each feature across the batch; layer norm does it across the features of one item.</p>
        <p class="lead"><b>For:</b> deep networks that train slowly or unstably. <b>Batch norm</b> suits conv nets with large batches, such as image classifiers. <b>Layer norm</b> suits small or single-item batches, variable-length sequences, and transformers.</p>
        <p class="lead"><b>Not for:</b> shallow models on tabular data, where scaling the inputs once is enough. Avoid batch norm with tiny batches: use layer norm, or group norm, another layer that ignores the batch.</p>
        <p class="lead"><b>Costs:</b> some computation per layer. Batch norm also needs eval mode, running statistics, and extra syncing when a batch is split across GPUs.</p>
        <p class="task">The watch team switches to layer norm. Which worry does that remove?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}${ans == null ? "" : kit.feedback(fb[ans], ans === 0)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. Recognise: three training setups and one where neither applies. */
  const CHOICES = ["Batch norm", "Layer norm", "Neither"];
  // [situation, right option, feedback per option (Batch norm, Layer norm, Neither)]
  const CASES = [
    ["An image classifier: a conv net that checks photos of circuit boards for missing parts, 256 photos per batch on a large GPU.", 0, [
      "Yes. Big batches give batch statistics close to the whole dataset's, and conv nets for images are where batch norm is the usual pick. Remember <code>model.eval()</code> when you serve it.",
      "Layer norm would run, but there is no small-batch problem to solve: with 256 photos per batch the batch statistics are reliable. For conv nets on images, batch norm is the usual pick.",
      "A deep conv net is exactly what normalization layers are for: it trains faster and more stably with them, and the big batch makes batch norm reliable."]],
    ["A transformer that reads hotel guest reviews of very different lengths, served one review at a time.", 1, [
      "Serving one review at a time leaves batch norm nothing to compute a batch spread from in training mode, and its output would depend on which reviews are batched together. Pick the one that works inside each review.",
      "Yes. Each review is normalized on its own, so lengths and single-review serving do not matter. The original transformer puts a layer norm in every block.",
      "A transformer is a deep stack of layers; the original design normalizes inside every block. Leaving it out is not the safe choice here."]],
    ["A delivery company predicts late parcels from 6 numbers per parcel with logistic regression.", 2, [
      "Logistic regression has no hidden layers, so there is nothing inside the model to normalize. Scale the 6 inputs once, before training.",
      "Logistic regression has no hidden layers, and layer norm across 6 different measurements (weight, distance, ...) would mix units that mean different things. Scale each input once, before training.",
      "Right. There are no hidden layers whose values drift during training. Scale the 6 input features once, before training, with the statistics of the training set."]],
    ["A sleep-tracking model reads whole nights of motion data; only 2 nights fit on the GPU at once.", 1, [
      "Two nights per batch: every batch-norm output would be about −1 or +1, the watch team's problem again.",
      "Yes. Two items per batch makes batch statistics close to useless. Layer norm (or group norm, which also ignores the batch) is the safe pick.",
      "A deep model on long recordings is where normalization helps training. The batch size rules out one kind, not both."]]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which normalization?</h1>
        <p class="lead">Four setups from other teams.</p>
        <p class="task">Pick batch norm, layer norm, or neither for each. Pick again if you change your mind.</p>
        ${CASES.map(([q, r, f], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(CHOICES, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(f[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const CHECK = [
      `<code>nn.BatchNorm1d(1)</code> in training mode turns the batch [${A}, ${B}] into ${list(BN_RUN["72,148"])}, and any batch of two into about −1 and +1.`,
      `A batch of one in training mode raises <code>ValueError: Expected more than 1 value per channel when training</code>.`,
      `After one training batch [${A}, ${B}], eval mode gives ${EVAL_A} for A alone and the same ${EVAL_A} for A inside that batch.`,
      `With batches of 2, the batch-norm model's train loss stays near ${fmt(CHANCE_LOSS, 2)} for all ${BN2.length} epochs, while the layer-norm model's falls below ${fmt(LN2[3][3], 2)} by epoch ${LN2[3][2]}.`,
      `Without <code>model.eval()</code>, the same recording gets a different probability with each partner; after it, the same probability every time.`
    ];
    el.innerHTML = `<h1>You can pick the normalization</h1>
      <p class="lead">You saw batch norm reduce a batch of two to −1 and +1, layer norm ignore the batch, and a check go wrong because the model was still in training mode.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook in Colab</a>.` : "The notebook for this lesson is on its way."} In it you train the small heart-rate network with each layer and check it with and without <code>model.eval()</code>. What you should see (ticking is optional):</p>
      <ul class="lx-${ID}-check">${CHECK.map((t, i) => `<li><label><input type="checkbox" id="lx-${ID}-c${i}"><span>${t}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead lx-${ID}-done"><b>Next:</b> ${kit.esc(nx.title)}. Dropout is another layer that behaves differently in training and eval, so the <code>model.eval()</code> habit from this lesson carries straight over.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Batch norm against layer norm",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.BatchNorm1d.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.LayerNorm.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.GroupNorm.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.SyncBatchNorm.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Module.html",
      "https://docs.pytorch.org/docs/2.15/notes/autograd.html",
      "https://arxiv.org/abs/1502.03167",
      "https://arxiv.org/abs/1607.06450",
      "https://arxiv.org/abs/1803.08494",
      "https://arxiv.org/abs/1706.03762"
    ],
    interview: [
      {
        q: "Your model scores well in the training notebook, but in production the same input gets different predictions depending on what else is in the request batch, and single requests crash. What is going on?",
        good: [
          "The model is probably still in training mode, so batch norm normalizes with the request batch's own statistics",
          "That makes each prediction depend on the other items, and a batch of one has no spread, so PyTorch raises an error",
          "Call model.eval() before serving so batch norm uses its running statistics; torch.no_grad() alone does not do this",
          "Check that the running statistics were not overwritten by training-mode passes during evaluation"
        ],
        weak: "Retrain the model or add more data. That misses that the weights are fine and the layer is in the wrong mode."
      },
      {
        q: "You can fit only two long sequences per batch on your GPU. Which normalization do you use, and why?",
        good: [
          "Not batch norm: with two items the batch mean and spread are noise, and every value becomes about −1 or +1",
          "Layer norm normalizes each sequence on its own, so batch size does not matter",
          "It computes the same thing in training and eval, so there is no train-versus-eval gap to manage",
          "Group norm is another option that ignores the batch, often used in conv nets with small batches"
        ],
        weak: "Keep batch norm and lower the learning rate. The problem is the batch statistics, not the step size."
      }
    ],
    screens: [byHand, partner, spotIdea, layerNorm, library, runningStats, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
