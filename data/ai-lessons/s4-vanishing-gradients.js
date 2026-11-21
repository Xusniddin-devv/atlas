/* Lesson: vanishing and exploding gradients in recurrent networks. Story: an online shop's checkout model reads
   each customer's last 40 clicks and never learns that a coupon error at click 1 makes people leave.
   Ideas: (1) backpropagation through time multiplies the learning signal by a factor at every step back, so after
   many steps it shrinks to nothing (vanishing) or grows huge (exploding); you see which by measuring the gradient
   size at each step; (2) gradient clipping (torch.nn.utils.clip_grad_norm_) caps the size of one training step's
   gradients and fixes the exploding case; it cannot fix the vanishing one.
   Data, all from real runs on this Mac (PyTorch 2.15, CPU), in docs/ai-path/runs/s4-vanishing-gradients/:
   - chain.py + chain.out.txt: a one-number chain, gradient after 20 steps for factors 0.8 and 1.2 (screen 1);
   - checkout_rnn.py + checkout_rnn.out.txt (+ checkout_rnn.json): per-click gradient norms of a tanh RNNCell
     with recurrent weights at 1x, 2x, 3x the default init; training runs with and without clip_grad_norm_; the
     traced train_step; the run with clipping after optimizer.step() (screens 2 to 6);
   - extract.py + extract.out.txt: the first 20 norms of the unclipped run and clip statistics (screen 4).
   No model was called; there are no recordings.
   Lesson-local pictures and style: a log-scale strip of per-click gradient sizes, a linear strip of per-step norms
   with a threshold line, and a clickable code listing (.lx-s4-vanishing-gradients-*), see ensureStyle(). */
(() => {
  const ID = "s4-vanishing-gradients";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const pct = x => `${Math.round(x * 1000) / 10}%`;
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

  /* ---------- Data copied from the runs ---------- */
  // chain.out.txt
  const CHAIN = { 0.8: 0.0115292, 1.2: 38.3376 };
  const CHAIN_STEPS = 20;
  const CHAIN_CODE = [
    "def gradient_after(factor, steps=20):",
    "    h0 = torch.tensor(1.0, requires_grad=True)",
    "    h = h0",
    "    for _ in range(steps):",
    "        h = factor * h",
    "    h.backward()",
    "    return h0.grad.item()"
  ];
  // checkout_rnn.py: the setup
  const CLICKS = 40, SHORT = 5, HIDDEN = 32;
  // checkout_rnn.out.txt, part A ("all 40"): ||dLoss/dh_t|| for click 1 .. click 40, recurrent weights x1, x2, x3
  const PER_CLICK = {
    1: [5.49e-13, 1.03e-12, 2.01e-12, 3.93e-12, 7.73e-12, 1.48e-11, 2.85e-11, 5.55e-11, 1.03e-10, 1.84e-10, 3.24e-10, 5.55e-10, 9.68e-10, 1.77e-09, 3.52e-09, 7.21e-09, 1.4e-08, 2.75e-08, 5.68e-08, 1.09e-07, 1.9e-07, 3.59e-07, 6.72e-07, 1.14e-06, 2.14e-06, 3.36e-06, 7.33e-06, 1.56e-05, 3.19e-05, 6.27e-05, 0.000109, 0.000204, 0.000423, 0.000924, 0.00167, 0.00309, 0.00551, 0.0106, 0.0204, 0.0362],
    2: [0.0029, 0.00305, 0.00308, 0.00315, 0.00349, 0.00362, 0.00387, 0.00419, 0.00421, 0.00474, 0.00523, 0.00543, 0.00591, 0.00636, 0.0067, 0.00716, 0.00765, 0.00818, 0.00924, 0.00995, 0.0103, 0.0106, 0.0111, 0.0111, 0.0122, 0.013, 0.0148, 0.0164, 0.0187, 0.0207, 0.0207, 0.0226, 0.0258, 0.0303, 0.0298, 0.0307, 0.0311, 0.0342, 0.0364, 0.0367],
    3: [3.14, 2.11, 1.67, 1.36, 1.24, 1.1, 1.03, 0.906, 0.86, 0.752, 0.658, 0.614, 0.582, 0.534, 0.489, 0.434, 0.41, 0.395, 0.355, 0.309, 0.275, 0.245, 0.223, 0.203, 0.188, 0.164, 0.15, 0.136, 0.133, 0.122, 0.108, 0.0977, 0.0855, 0.0763, 0.0678, 0.0602, 0.0525, 0.0481, 0.043, 0.0373]
  };
  // checkout_rnn.out.txt, part B: test accuracy and mean loss per 50 steps (SGD, lr 0.1, 400 steps)
  const RUNS = {
    s1_len40: { acc: 0.514, loss: [0.694, 0.694, 0.695, 0.694, 0.694, 0.694, 0.694, 0.694] },
    s1_len5: { acc: 1.0, loss: [0.586, 0.036, 0.008, 0.004, 0.003, 0.002, 0.002, 0.001] },
    s2_len40: { acc: 1.0, loss: [0.697, 0.227, 0.008, 0.004, 0.003, 0.002, 0.002, 0.001] },
    s3_noclip: { acc: 0.499, loss: [0.697, 0.699, 0.697, 0.698, 0.696, 0.7, 0.697, 0.697], first: 12.98 },
    s3_clip1: { acc: 1.0, loss: [0.545, 0.053, 0.007, 0.004, 0.003, 0.002, 0.002, 0.001], over: 62 },
    s3_clip001: { acc: 0.508, loss: [0.706, 0.702, 0.702, 0.699, 0.703, 0.705, 0.701, 0.699], over: 400 },
    s3_clip100: { acc: 0.499, loss: [0.697, 0.699, 0.697, 0.698, 0.696, 0.7, 0.697, 0.697], over: 0 }
  };
  const TRAIN_STEPS = 400;
  // extract.out.txt
  const NOCLIP20 = [12.9766, 1.8231, 0.1941, 0.4552, 0.3128, 1.0155, 0.2568, 0.2287, 0.1718, 0.1983, 0.2158, 0.2517, 0.5126, 0.222, 0.1704, 0.7219, 0.176, 0.2999, 0.2208, 0.1733];
  const CLIP1_LAST_OVER = 63; // last step whose norm was above max_norm 1
  const CLIP1_FIRST50 = [1.4119, 17.8604]; // min and max norm before clipping, steps 0-49
  const SAME_AS_NOCLIP = { clip100: true, bug: true }; // losses identical step for step
  const THRESHOLDS = [0.01, 1, 100];
  const RUN_OF = { 0.01: "s3_clip001", 1: "s3_clip1", 100: "s3_clip100" };

  // The listing is train_step from checkout_rnn.py, line for line (line 0 = def).
  const CODE = [
    "def train_step(model, clicks, left, optimizer, max_norm):",
    "    optimizer.zero_grad()",
    "    logits = model(clicks)",
    "    loss = loss_fn(logits, left)",
    "    loss.backward()",
    "    norm_before = nn.utils.clip_grad_norm_(model.parameters(), max_norm)",
    "    norm_after = nn.utils.get_total_norm([p.grad for p in model.parameters()])",
    "    optimizer.step()",
    "    return loss.item(), norm_before.item(), norm_after.item()"
  ];
  // checkout_rnn.out.txt part D: traced step 1 of the max_norm 1 run. Rows: [line about to run, event, loss, norm_before, norm_after].
  // Consecutive identical rows are kept once (line 6 was reported 8 times: Python 3.12 runs the list comprehension
  // on that line inside train_step's own frame, one line event per parameter plus one).
  const TRACE_STEP = 1;
  const TRACE = [[1, "l", null, null, null], [2, "l", null, null, null], [3, "l", null, null, null], [4, "l", 0.6891606450080872, null, null],
    [5, "l", 0.6891606450080872, null, null], [6, "l", 0.6891606450080872, 17.860393524169922, null],
    [7, "l", 0.6891606450080872, 17.860393524169922, 0.9999998807907104], [8, "l", 0.6891606450080872, 17.860393524169922, 0.9999998807907104],
    [8, "r", 0.6891606450080872, 17.860393524169922, 0.9999998807907104]];
  const TRACE_MAX = 1.0;

  // buggy_step from checkout_rnn.py, line for line, and its log (checkout_rnn.out.txt part C, trimmed with …)
  const BUG = [
    "def buggy_step(model, clicks, left, optimizer, max_norm):",
    "    optimizer.zero_grad()",
    "    logits = model(clicks)",
    "    loss = loss_fn(logits, left)",
    "    loss.backward()",
    "    optimizer.step()",
    "    norm = nn.utils.clip_grad_norm_(model.parameters(), max_norm)",
    "    return loss.item(), norm.item(), None"
  ];
  const BUG_LOG = [
    "C clip after step: test accuracy 0.499; mean loss per 50 steps [0.697, 0.699, 0.697, 0.698, 0.696, 0.7, 0.697, 0.697]; largest norm 12.98",
    "   step   0  loss 0.7056  clip_grad_norm_ returned 12.98",
    "   step  50  loss 0.7007  clip_grad_norm_ returned 0.418",
    "   step 100  loss 0.6931  clip_grad_norm_ returned 0.1613",
    "…",
    "   step 350  loss 0.6865  clip_grad_norm_ returned 0.1948"
  ];
  const BUG_MAX = 1.0;

  /* ---------- Derived from the data ---------- */
  const PC1 = PER_CLICK[1];
  const ratioVan = PC1[CLICKS - 1] / PC1[0];
  const growthOf = s => PER_CLICK[s][0] / PER_CLICK[s][CLICKS - 1];
  const shrinkOf = s => PER_CLICK[s][CLICKS - 1] / PER_CLICK[s][0];
  const fmt = v => v >= 0.001 ? String(+v.toPrecision(3)) : v.toExponential(2);
  const words = x => { // 6.6e10 -> "about 66 billion"
    if (x >= 1e9) return `about ${Math.round(x / 1e9)} billion`;
    if (x >= 1e6) return `about ${Math.round(x / 1e6)} million`;
    return `about ${Math.round(x)}`;
  };

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-strip { margin: 16px 0 0; }
      .lx-${ID}-cap { margin: 0 0 6px; font-size: 14px; color: var(--muted); }
      .lx-${ID}-bars { position: relative; display: flex; align-items: flex-end; gap: 2px; height: 96px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-bars i { flex: 1 1 0; min-width: 0; background: var(--ink-2); border-radius: 1px 1px 0 0; }
      .lx-${ID}-bars i.lx-${ID}-cut { background: var(--bad); }
      .lx-${ID}-ends { display: flex; justify-content: space-between; gap: 12px; margin-top: 4px; font: 500 13px/1.4 var(--mono); color: var(--muted); }
      .lx-${ID}-line { position: absolute; left: 0; right: 0; border-top: 2px dashed var(--ink); }
      .lx-${ID}-line span { position: absolute; right: 0; top: -20px; font: 600 12.5px var(--mono); color: var(--ink); background: var(--surface); padding: 0 4px; }
      .lx-${ID}-vals { margin: 8px 0 0; font: 500 13.5px/1.6 var(--mono); color: var(--ink-2); overflow-wrap: anywhere; }
      .lx-${ID}-model { margin: 18px 0 0; padding: 12px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-model h2 { margin: 0 0 4px; font-size: 16px; }
      .lx-${ID}-pick { display: grid; gap: 6px; margin: 14px 0 0; }
      .lx-${ID}-pick button { min-height: 44px; text-align: left; font: 500 14px/1.45 var(--mono); padding: 8px 12px 8px calc(12px + 8ch); text-indent: -8ch; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; }
      .lx-${ID}-pick button.lx-${ID}-no { border-color: var(--bad); background: var(--bad-soft); }
      .lx-${ID}-pick button.lx-${ID}-ok { border-color: var(--good); background: var(--good-soft); }
      .lx-${ID}-code .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 8ch); text-indent: -8ch; }
      .lx-${ID}-bars.lx-${ID}-tall { height: 120px; }
      .lx-${ID}-log { margin: 14px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); font: 500 13px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
    `;
    document.head.appendChild(s);
  }
  // Per-click gradient sizes on a log scale. lo/hi: powers of ten for the bottom and top of the strip.
  function logStrip(kit, values, title, lo = -13, hi = 1) {
    const h = v => Math.max(2, (Math.log10(v) - lo) / (hi - lo) * 100);
    return `<div class="lx-${ID}-strip" role="img" aria-label="${kit.esc(title)}: click 1 ${fmt(values[0])}, click ${values.length} ${fmt(values[values.length - 1])}">
      <p class="lx-${ID}-cap">${kit.esc(title)}</p>
      <div class="lx-${ID}-bars lx-${ID}-tall">${values.map(v => `<i style="height:${h(v)}%"></i>`).join("")}</div>
      <div class="lx-${ID}-ends"><span>click 1: ${fmt(values[0])}</span><span>click ${values.length}: ${fmt(values[values.length - 1])}</span></div></div>`;
  }
  // Per-training-step norms on a linear scale, with an optional threshold line; bars above it are marked.
  function normStrip(kit, values, title, cut) {
    const mx = Math.max(...values);
    const line = cut != null && cut <= mx ? `<div class="lx-${ID}-line" style="bottom:${cut / mx * 100}%"><span>max_norm ${cut}</span></div>` : "";
    return `<div class="lx-${ID}-strip" role="img" aria-label="${kit.esc(title)}">
      <p class="lx-${ID}-cap">${kit.esc(title)}</p>
      <div class="lx-${ID}-bars">${values.map(v => `<i class="${cut != null && v > cut ? `lx-${ID}-cut` : ""}" style="height:${Math.max(2, v / mx * 100)}%"></i>`).join("")}${line}</div>
      <div class="lx-${ID}-ends"><span>step 0</span><span>step ${values.length - 1}</span></div>
      <p class="lx-${ID}-vals">${values.map(v => v.toFixed(2)).join("  ")}</p></div>`;
  }
  const ask = (kit, opts, correct, picked, fbs) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;

  /* 1. The situation, and the prediction by hand. */
  function situation({ el, done, kit }) {
    ensureStyle();
    const Q = [0.8, 1.2].map(f => {
      const right = Math.pow(f, CHAIN_STEPS), add = f * CHAIN_STEPS;
      const opts = [String(f), fmt(right), String(+add.toFixed(2))];
      return { f, right: 1, opts, fb: [
        [`${f} is the factor for one step back. The signal passes through ${CHAIN_STEPS} steps, and each one multiplies it by ${f} again.`, false],
        null,
        [`${f} × ${CHAIN_STEPS} adds the factor up ${CHAIN_STEPS} times. The chain rule multiplies instead: ${f} × ${f} × … , ${CHAIN_STEPS} factors in all.`, false]] };
    });
    let k = 0, picked = null;
    const paint = () => {
      const fin = k >= Q.length, q = Q[Math.min(k, Q.length - 1)];
      el.innerHTML = `<h1>The click forty steps back</h1>
        <p class="lead">An online shop trains a small recurrent network on each customer's last ${CLICKS} clicks, to predict who leaves without paying. The data team knows that a <b>coupon error</b> at the first of those clicks makes people leave. The model never learns it. This lesson shows why long sequences break training, how to see it, and the fix for one of the two cases.</p>
        <p class="lead">Recall the forward pass: the network reads click 1, then click 2, and so on, carrying one hidden state along. To learn, training sends the learning signal (the gradient) backward through the same ${CLICKS} steps. By the chain rule, each step back multiplies that signal by a factor. Take the smallest possible case: a hidden state of one number, <code>h = factor × h</code> at each step.</p>
        ${fin ? "" : `<p class="task">Step ${k + 1} of 2. With factor ${q.f}, how big is the gradient when it gets back to the first state, ${CHAIN_STEPS} steps earlier? (It starts at 1.)</p>`}
        <div class="lpanel">${fin ? "" : ask(kit, q.opts, q.right, picked, q.fb)}
        ${k >= 1 ? kit.feedback(`Factor 0.8: ${fmt(Math.pow(0.8, CHAIN_STEPS))}, about ${Math.round(1 / Math.pow(0.8, CHAIN_STEPS))} times smaller than where it started.`, true) : ""}
        ${fin ? `${kit.feedback(`Factor 1.2: ${fmt(Math.pow(1.2, CHAIN_STEPS))}, about ${Math.round(Math.pow(1.2, CHAIN_STEPS))} times bigger. A factor a little below 1 makes the signal <b>vanish</b>; a little above 1 makes it <b>explode</b>. Only exactly 1 keeps it the same, and real networks do not stay at exactly 1. PyTorch's autograd agrees:`, true)}
          <div class="lx-${ID}-code">${kit.code(CHAIN_CODE, -1)}</div>
          <div class="lx-${ID}-log">${Object.entries(CHAIN).map(([f, v]) => `factor ${f}: gradient after ${CHAIN_STEPS} steps = ${v}`).join("\n")}</div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        picked = +b.dataset.i;
        if (picked === Q[k].right) { k++; picked = null; paint(); if (k >= Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 2. Spot the idea: the real checkout model's per-click gradients. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "Coupon errors are too rare in the 40-click data",
      "The learning signal for click 1 shrinks at every step back, so it hardly reaches click 1",
      "The learning rate is too small; raise it ten times",
      `A hidden state of ${HIDDEN} numbers is too small to hold ${CLICKS} clicks`
    ];
    const fb = [
      ["Both versions were built the same way: half of all sessions start with a coupon error. The 5-click model saw exactly as many and learned them.", false],
      [`Right. The model's gradient at click 1 is ${words(ratioVan)} times smaller than at click ${CLICKS}. Training changes the weights in proportion to the gradient, so the weights barely move because of click 1, and the last few clicks, which are random noise here, drive the updates. This is the <b>vanishing gradient</b> problem: the signal fades on its way back through time. With ${SHORT} clicks there are only ${SHORT - 1} steps back, so the signal still arrives.`, true],
      [`A bigger learning rate makes every weight update ten times bigger: the tiny part that comes from click 1 and the large part that comes from the noisy recent clicks alike. Click 1's gradient is still ${words(ratioVan)} times smaller than click ${CLICKS}'s. The ratio is the problem, not the overall size.`, false],
      ["It only has to carry one yes-or-no fact: was the first click a coupon error. There is room. The trouble is that the training signal that would teach it to keep that fact never arrives at click 1.", false]
    ];
    const rows = [CLICKS, 30, 20, 10, 1].map(c => [`click ${c}${c === CLICKS ? " (last)" : ""}`, fmt(PC1[c - 1])]);
    const paint = () => {
      el.innerHTML = `<h1>Where the signal fades</h1>
        <p class="lead">This is the real checkout model: a recurrent cell with ${HIDDEN} hidden numbers, started with PyTorch's default weights. We measured the gradient at each click's hidden state after one backward pass: how much the loss would change if that click's state changed. (e-13 means: move the decimal point 13 places to the left.)</p>
        ${logStrip(kit, PC1, "gradient size at each click, log scale: every 10-times change is the same height")}
        ${kit.table(rows, { head: ["hidden state at", "gradient size"], title: "the same numbers" })}
        <p class="lead">Trained for ${TRAIN_STEPS} steps, the model is right on ${pct(RUNS.s1_len40.acc)} of test sessions: a coin flip. The same model on ${SHORT}-click sessions, with the coupon error ${SHORT} clicks back, is right on ${pct(RUNS.s1_len5.acc)}.</p>
        <p class="task">Why does it learn the ${SHORT}-click version and not the ${CLICKS}-click one?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Diagnose three models from their per-click gradient sizes. */
  const KINDS = ["vanishing", "fine", "exploding"];
  const MODELS = [
    { name: "Model A", scale: 1, kind: 0 },
    { name: "Model B", scale: 2, kind: 1 },
    { name: "Model C", scale: 3, kind: 2 }
  ];
  function diagnose({ el, done, kit }) {
    ensureStyle();
    const ans = MODELS.map(() => null);
    const say = (m, p) => {
      const s = m.scale;
      if (p === m.kind) {
        if (m.kind === 0) return [`Right: from ${fmt(PER_CLICK[s][CLICKS - 1])} at click ${CLICKS} down to ${fmt(PER_CLICK[s][0])} at click 1, ${words(shrinkOf(s))} times smaller. That is the model from the last screen.`, true];
        if (m.kind === 1) return [`Right: it shrinks only ${Math.round(shrinkOf(s))} times over ${CLICKS} clicks. Click 1 still gets a usable signal. This model learned the task: ${pct(RUNS.s2_len40.acc)} on test sessions.`, true];
        return [`Right: it <b>grows</b> going back, ${Math.round(growthOf(s))} times bigger at click 1 than at click ${CLICKS}. That is an <b>exploding gradient</b>. Its very first training step had a total gradient size of ${RUNS.s3_noclip.first}, and after that step the model never learned: ${pct(RUNS.s3_noclip.acc)} on test sessions.`, true];
      }
      if (p === 0) return [`Vanishing means the size falls toward zero going back. Here click 1 has ${fmt(PER_CLICK[s][0])} and click ${CLICKS} has ${fmt(PER_CLICK[s][CLICKS - 1])}: ${s === 3 ? "click 1 is the biggest, not the smallest" : `it shrinks only ${Math.round(shrinkOf(s))} times, not billions of times`}.`, false];
      if (p === 1) return [`Compare the two ends: click 1 has ${fmt(PER_CLICK[s][0])}, click ${CLICKS} has ${fmt(PER_CLICK[s][CLICKS - 1])}. ${s === 1 ? `That is ${words(shrinkOf(s))} times smaller, far beyond fine.` : `Click 1 is ${Math.round(growthOf(s))} times bigger than click ${CLICKS}.`}`, false];
      return [`Exploding means the size grows going back. Here click 1 (${fmt(PER_CLICK[s][0])}) is smaller than click ${CLICKS} (${fmt(PER_CLICK[s][CLICKS - 1])}).`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>Read the gradient sizes</h1>
        <p class="lead">The team tried a fix: start training with the recurrent weights (<code>weight_hh</code>, the ones that carry the hidden state from one click to the next) 2 times or 3 times larger than PyTorch's default. Same data, same measurement as before, same log scale. Read each strip from click ${CLICKS} back to click 1: if the size shrinks toward zero, that is vanishing; if it grows, that is exploding; if it stays in a usable range, the model is fine.</p>
        <p class="task">Label each model. Pick again if you change your mind.</p>
        ${MODELS.map((m, i) => `<div class="lx-${ID}-model" id="m${i}"><h2>${m.name}: recurrent weights × ${m.scale}</h2>
          ${logStrip(kit, PER_CLICK[m.scale], "gradient size at each click")}
          ${kit.options(KINDS, { picked: ans[i], correct: m.kind })}
          ${ans[i] == null ? "" : kit.feedback(...say(m, ans[i]))}</div>`).join("")}`;
      el.querySelectorAll(".lx-" + ID + "-model").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (MODELS.every((m, j) => ans[j] === m.kind)) done();
      }));
    };
    paint();
  }

  /* 4. Choose a clipping threshold for model C's recorded norms. */
  function threshold({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = THRESHOLDS.indexOf(1);
    const over = t => NOCLIP20.filter(v => v > t).length;
    const outcome = t => {
      const r = RUNS[RUN_OF[t]];
      return `The real ${TRAIN_STEPS}-step run with <code>max_norm=${t}</code>: average loss per 50 steps ${r.loss[0]} at first and ${r.loss[r.loss.length - 1]} at the end; ${pct(r.acc)} right on test sessions.`;
    };
    const fb = [
      [`That cuts ${over(0.01)} of ${NOCLIP20.length} steps: every one. Every update now has the same tiny size, whatever the gradient says, so the series is flattened and the shape is gone. ${outcome(0.01)} All ${RUNS.s3_clip001.over} steps were cut, and it learned nothing.`, false],
      [`Right. On this series it cuts ${over(1)} of ${NOCLIP20.length} steps: the ${NOCLIP20[0].toFixed(2)} at step 0 and ${NOCLIP20.slice(1).filter(v => v > 1).map(v => v.toFixed(2)).join(" and ")}. The ordinary steps pass unchanged. ${outcome(1)} With the cap on, training took a different path: in the first 50 steps the size before clipping stayed between ${CLIP1_FIRST50[0].toFixed(2)} and ${CLIP1_FIRST50[1].toFixed(2)}, so each of those steps was capped at 1. Then the weights settled: clipping acted on ${RUNS.s3_clip1.over} of ${TRAIN_STEPS} steps, the last one at step ${CLIP1_LAST_OVER}, and after that the gradients stayed under 1 on their own.`, true],
      [`That cuts ${over(100)} of ${NOCLIP20.length} steps: the step-0 spike of ${NOCLIP20[0].toFixed(2)} passes through untouched. ${outcome(100)} ${SAME_AS_NOCLIP.clip100 ? "Its loss matched the run without clipping at every single step: a threshold above every norm does nothing." : ""}`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Pick the clipping threshold</h1>
        <p class="lead">Model C's gradients explode, so one training step can be huge. The usual fix is <b>gradient clipping</b>: a cap on how big one step's gradients may be. PyTorch's <code>clip_grad_norm_(parameters, max_norm)</code> measures the size of all the model's gradients together, one number per training step (the <b>total norm</b>). If it is above <code>max_norm</code>, it scales every gradient down by the same factor so the total is <code>max_norm</code>. The direction stays the same; only the length shrinks. Below are model C's first ${NOCLIP20.length} training steps <b>without</b> clipping.</p>
        ${normStrip(kit, NOCLIP20, "total gradient norm at each training step, model C, no clipping", ans == null ? null : THRESHOLDS[ans])}
        <p class="task">Pick a <code>max_norm</code> that stops the spike but leaves the ordinary steps alone.</p>
        <div class="lpanel">${ask(kit, THRESHOLDS.map(t => `max_norm = ${t}`), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. The training step in PyTorch, stepped from a traced run, with one prediction. */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, guess = null, guessed = false;
    const GATE = TRACE.findIndex(r => r[0] === 6); // about to run line 6: predict norm_after first
    const nb = TRACE[GATE][3];
    const gOpts = [nb.toFixed(2), String(TRACE_MAX), (TRACE_MAX / nb).toFixed(3)];
    const gRight = 1;
    const gFb = [
      [`That is the size before clipping. <code>clip_grad_norm_</code> already scaled the gradients in place, so measuring them again gives the new, smaller size.`, false],
      null,
      [`That is the scale factor clip_grad_norm_ used (max_norm divided by the size). Every gradient was multiplied by it, so the new size is ${nb.toFixed(2)} × that factor.`, false]
    ];
    const say = r => {
      const [ln, ev] = r;
      if (ev === "r") return `The step is done. It returns the loss and both sizes: ${r[3].toFixed(2)} before, ${r[4]} after. The tiny gap below ${TRACE_MAX} is on purpose: PyTorch divides by the size plus 0.000001, so the result is never exactly at the cap.`;
      if (ln === 1) return "Clear the gradients left over from the previous step. PyTorch adds new gradients to old ones unless you clear them.";
      if (ln === 2) return `Run the model forward over all ${CLICKS} clicks of each session in the batch.`;
      if (ln === 3) return "Compare the predictions with who really left.";
      if (ln === 4) return `The loss is ${r[2].toFixed(4)}. Now <code>backward()</code> fills every weight's <code>.grad</code>, going back through all ${CLICKS} clicks.`;
      if (ln === 5) return `The gradients are ready. <code>clip_grad_norm_</code> measures their total size and, if it is above <code>max_norm = ${TRACE_MAX}</code>, scales them down in place. It returns the size it measured <b>before</b> scaling.`;
      if (ln === 6) return `It returned ${r[3].toFixed(2)}, far above ${TRACE_MAX}: this is the biggest spike of the run. The highlighted line, <code>get_total_norm</code>, measures the gradients again.`;
      if (ln === 7) return `Measured again: ${r[4]}. Now <code>optimizer.step()</code> moves the weights using these capped gradients.`;
      if (ln === 8) return "The weights moved by a capped amount. The spike changed the direction of this step but could not make it huge.";
      return "";
    };
    const paint = () => {
      const r = TRACE[i], gate = i === GATE && !guessed;
      el.innerHTML = `<h1>The training step, in PyTorch</h1>
        <p class="lead">This is the function that trained model C with <code>max_norm = ${TRACE_MAX}</code>. We traced it line by line at training step ${TRACE_STEP}, the step with the biggest gradient of that run. The highlighted line runs next.</p>
        <p class="task">Step through to the end. You will be asked one prediction on the way.</p>
        <div class="lx-${ID}-code">${kit.code(CODE, r[0])}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || gate ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>loss <b>${r[2] == null ? "–" : r[2].toFixed(4)}</b></span><span>norm_before <b>${r[3] == null ? "–" : r[3].toFixed(2)}</b></span><span>norm_after <b>${r[4] == null ? "–" : r[4]}</b></span><span>frame <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say(r))}
        ${gate ? `<div class="lpanel"><p class="task">Predict: what will <code>norm_after</code> be?</p>${ask(kit, gOpts, gRight, guess, gFb)}</div>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        guess = +b.dataset.i;
        if (guess === gRight) { guessed = true; i++; }
        paint();
      });
    };
    paint();
  }

  /* 6. Broken on purpose: clipping that does nothing. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const STEP_LN = BUG.findIndex(l => l.includes("optimizer.step()"));
    const CLIP_LN = BUG.findIndex(l => l.includes("clip_grad_norm_"));
    const ok = i => i === STEP_LN || i === CLIP_LN;
    const fbOf = i => {
      if (i === CLIP_LN) return [`Right. <code>optimizer.step()</code> already moved the weights with the full, unclipped gradients. The clip after it shrinks gradients that are never used: the next step clears them with <code>zero_grad()</code>. It even reported the spike (${RUNS.s3_noclip.first} at step 0) after the damage was done. ${SAME_AS_NOCLIP.bug ? "The losses matched the run without clipping at every step." : ""} The fix: move the clip line up, between <code>backward()</code> and <code>step()</code>.`, true];
      if (i === STEP_LN) return [`Right, this line is out of order: it moves the weights before the next line clips the gradients, so the full ${RUNS.s3_noclip.first} spike went into the weights at step 0. ${SAME_AS_NOCLIP.bug ? "The losses matched the run without clipping at every step." : ""} The fix: clip between <code>backward()</code> and <code>step()</code>.`, true];
      if (i === 0) return ["The signature is fine: it receives max_norm and passes it on. The value 1 is the same one that worked for model C.", false];
      if (i === 1) return ["Clearing old gradients first is correct. Without it, each step would add this step's gradients to the last one's.", false];
      if (i === 2 || i === 3) return ["The forward pass and the loss are the same as in the working version. The log's losses are normal numbers, not errors.", false];
      if (i === 4) return ["<code>backward()</code> has to run before clipping, because it is what fills the gradients. It is in the right place. Look at what happens between it and the clip.", false];
      return ["The return line only reports numbers. The log's numbers are honest: clipping really measured the spike. The question is what had already happened when it did.", false];
    };
    const paint = () => {
      el.innerHTML = `<h1>The clipping that did nothing</h1>
        <p class="lead">A teammate added clipping to model C's training with <code>max_norm = ${BUG_MAX}</code>, the value that worked on the last screens. Here is the step function and its real log. Test accuracy: ${pct(RUNS.s3_noclip.acc)}, the same as with no clipping at all.</p>
        <div class="lx-${ID}-log">${BUG_LOG.map(kit.esc).join("\n")}</div>
        <p class="task">Tap the line that makes the clipping useless.</p>
        <div class="lx-${ID}-pick">${BUG.map((l, i) => `<button type="button" data-i="${i}"${ok(i) && i === CLIP_LN ? " data-right" : ""}${i === 1 ? " data-wrong" : ""} class="${ans === i ? (ok(i) ? `lx-${ID}-ok` : `lx-${ID}-no`) : ""}">${kit.esc(l)}</button>`).join("")}</div>
        <div class="lpanel">${ans == null ? "" : kit.feedback(...fbOf(ans))}</div>`;
      el.querySelectorAll(`.lx-${ID}-pick button`).forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ok(ans)) done(); });
    };
    paint();
  }

  /* 7. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = 1;
    const opts = [
      "A model ignores events from the start of long sequences; its gradient at the first step is 1e-12",
      "Training runs well, then the loss jumps; the total norm log shows one step 200 times bigger than usual",
      "Training is slow but steady; the total norm is about the same on every step"
    ];
    const fb = [
      ["That is vanishing. Clipping only ever makes big gradients smaller. It never makes a small one bigger, so the first step's signal stays at 1e-12.", false],
      ["Right. One huge step is exactly what clipping caps. Put <code>clip_grad_norm_</code> between <code>backward()</code> and <code>step()</code>, with <code>max_norm</code> above the usual sizes and below the spike.", true],
      ["Nothing is exploding, so there is nothing to cap. A threshold below the usual sizes would cut every step and make training slower still.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When clipping helps, and when it cannot</h1>
        <p class="lead"><b>What for:</b> clipping stops exploding gradients, where a rare huge step throws the weights somewhere training never recovers from.</p>
        <p class="lead"><b>Reach for it</b> when you train recurrent networks on long sequences, and whenever the total norm log shows spikes.</p>
        <p class="lead"><b>Not for</b> vanishing gradients: clipping only shrinks. For those, use gated cells (LSTM, GRU: next lesson), shorter sequences, a summary input (here: “had a coupon error” as its own feature), or attention-based models that look back directly.</p>
        <p class="lead"><b>Costs:</b> one extra norm per step, which is cheap; one more setting to tune; a threshold too low quietly slows learning; and it can hide a learning rate that is too high.</p>
        <p class="task">Which of these calls for gradient clipping?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A speech model reads audio as 500 steps. Training is fine for hours, then the loss becomes nan, right after a step whose total gradient norm is thousands of times the usual.", true,
      "Yes. One enormous step is the exploding case. Clip between backward() and step(), with max_norm a little above the usual norms; then check the learning rate too.",
      "A sudden huge norm followed by nan is the exploding case, and capping the step size is exactly what clipping does."],
    ["A model must notice a door left open 300 sensor readings earlier. The loss is stuck, and the gradient at the earliest readings is about 1e-15.", false,
      "No. That is vanishing: the gradient is tiny, and clipping only shrinks gradients that are above max_norm. It cannot lift 1e-15. Use a gated cell such as an LSTM, a shorter window, or give the model the door state as an input.",
      "Clipping scales gradients down, never up. At 1e-15 there is nothing to cap; the signal from 300 readings back is already gone. That needs a different model or different inputs."],
    ["A team set max_norm = 0.001 “to be safe”. Their logged total norm is between 0.5 and 2 on every step, and training is very slow.", false,
      "No, more clipping is the problem here. Every step is above 0.001, so every step is cut to the same tiny size. Raise max_norm above the usual norms, so it only catches spikes.",
      "Every logged norm is hundreds of times above 0.001, so every step is cut. The clipping is what flattens training. The fix is a higher max_norm, not more clipping."],
    ["A model's loss falls, then jumps up every few hundred steps, each time at a step where the total norm spikes. Between spikes the norm is steady.", true,
      "Yes. Rare spikes on a steady background are what a threshold just above the steady level catches, while the ordinary steps pass unchanged.",
      "The jumps line up with the norm spikes, and the steps between them are normal. Capping only the spikes is clipping's exact job."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Clip or not?</h1>
        <p class="lead">Four training problems from other teams.</p>
        <p class="task">Does gradient clipping fix each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can read the gradients</h1>
      <p class="lead">You predicted how a factor compounds over ${CHAIN_STEPS} steps, saw the checkout model's signal fade ${words(ratioVan)} times on its way back to click 1, labelled vanishing and exploding models from their gradient sizes, picked a clipping threshold that saved model C, and found clipping placed after the optimizer step.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Clipping fixed the exploding case; gates are the usual answer to the vanishing one, so a cell can keep a fact like the coupon error for many steps.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Vanishing gradients in recurrent networks",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.utils.clip_grad_norm_.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.utils.clip_grads_with_norm_.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.utils.get_total_norm.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.RNNCell.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.backward.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.Optimizer.zero_grad.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.RNN.html",
      "https://arxiv.org/abs/1211.5063"
    ],
    interview: [
      {
        q: "Your recurrent model trains fine for a while, then the loss turns into nan. How do you find the cause, and what do you change?",
        good: [
          "Log the total gradient norm every step (clip_grad_norm_ returns it) and look for a spike just before the nan",
          "If one step's norm is far above the usual, that is an exploding gradient",
          "Add clip_grad_norm_ between loss.backward() and optimizer.step(), with max_norm a little above the usual norms",
          "Check the order in the code: clipping after step() does nothing",
          "Also check the learning rate, since clipping can hide one that is too high"
        ],
        weak: "Restart with another seed or lower the learning rate everywhere, without looking at the gradient norms to see what happened."
      },
      {
        q: "A teammate says the sequence model ignores events from early in long sessions and proposes adding gradient clipping. What do you say?",
        good: [
          "Measure the gradient at each step of the sequence first",
          "If it shrinks toward zero going back, that is vanishing, and clipping cannot help: it only scales big gradients down",
          "Fixes for vanishing: a gated cell (LSTM or GRU), shorter sequences, the early event as an explicit feature, or an attention-based model",
          "Clipping is for the opposite problem, rare huge steps"
        ],
        weak: "Agree and add clipping, or raise the learning rate. Neither changes how small the early steps' gradient is compared with the late ones."
      }
    ],
    screens: [situation, spotIdea, diagnose, threshold, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#m0 [data-wrong]"], right: MODELS.map((_, i) => `#m${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(TRACE.findIndex(r => r[0] === 6)).fill("[data-next]"), "[data-wrong]"], right: ["[data-right]", ...Array(TRACE.length - 1 - TRACE.findIndex(r => r[0] === 6) - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
