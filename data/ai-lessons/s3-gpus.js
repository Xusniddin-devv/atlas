/* Lesson: GPUs and why they matter. Story: Lena runs a small online shop and trains a model on her laptop over the
   weekend to sort 64x64 grey product photos into 10 categories; on the laptop's processor the job takes all night,
   and a GPU is one setting away. Ideas: (1) a training step is billions of independent multiply-adds, and a GPU
   wins because it does many of them at once, so the win grows with the work per step and vanishes for tiny steps;
   (2) the model and every batch must sit on the same device: model.to(device) once, batch.to(device) every step.
   Data, all real, run on this Mac (Apple M1; its GPU through PyTorch's "mps" device):
   - docs/ai-path/runs/s3-gpus/timing.py + timing.out.txt: median ms per training step on CPU and GPU for the
     4096-2048-2048-10 network at batch 256 and 16, and a 20-16-2 network at batch 32;
   - docs/ai-path/runs/s3-gpus/train_trace.py + train_trace.out.txt: train_one_epoch traced line by line on the GPU,
     and the two real errors when the batch, then only the labels, are left on the CPU.
   No model API calls. Colab (the curriculum's tool) could not be run here: its screen is marked "Not run by us" and
   shows no output. Lesson-local style: timing rows, error block, checklist (.lx-s3-gpus-*), see ensureStyle(). */
(() => {
  const ID = "s3-gpus", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s3-gpus.ipynb";
  const RUN_DATE = "2026-11-14";

  /* ---------- Data copied from the runs ---------- */
  // The network in timing.py and train_trace.py (BIG): 64x64 photo = 4096 numbers in, 10 categories out.
  const NET = [4096, 2048, 2048, 10];
  const BATCH = 256;
  // The tiny network in timing.py (TINY) and its batch.
  const TINY = [20, 16, 2], TINY_BATCH = 32, SMALL_BATCH = 16;
  // From timing.out.txt (median ms per training step; batch moved to the device inside each step)
  const T = {
    big256: { cpu: 296.032, gpu: 22.984 },
    big16: { cpu: 115.802, gpu: 15.686 },
    tiny32: { cpu: 2.458, gpu: 9.229 }
  };
  // Lena's job (story numbers, not measured): photos and passes over them.
  const PHOTOS = 200000, EPOCHS = 100;

  // train_one_epoch from train_trace.py, line for line (line 0 = the def line)
  const CODE = [
    "def train_one_epoch(model, batches, device):",
    "    model.to(device)",
    "    for photos, labels in batches:",
    "        photos = photos.to(device)",
    "        labels = labels.to(device)",
    "        loss = loss_fn(model(photos), labels)",
    "        opt.zero_grad()",
    "        loss.backward()",
    "        opt.step()",
    "    return loss.item()"
  ];
  // train_trace.out.txt, one row per trace step: [line about to run, l = line / r = return, model on, photos on, labels on, loss]
  const TRACE = [[1,"l","cpu","","",""],[2,"l","mps:0","","",""],[3,"l","mps:0","cpu","cpu",""],[4,"l","mps:0","mps:0","cpu",""],[5,"l","mps:0","mps:0","mps:0",""],[6,"l","mps:0","mps:0","mps:0","2.2980"],[7,"l","mps:0","mps:0","mps:0","2.2980"],[8,"l","mps:0","mps:0","mps:0","2.2980"],[2,"l","mps:0","mps:0","mps:0","2.2980"],[3,"l","mps:0","cpu","cpu","2.2980"],[4,"l","mps:0","mps:0","cpu","2.2980"],[5,"l","mps:0","mps:0","mps:0","2.2980"],[6,"l","mps:0","mps:0","mps:0","2.3003"],[7,"l","mps:0","mps:0","mps:0","2.3003"],[8,"l","mps:0","mps:0","mps:0","2.3003"],[2,"l","mps:0","mps:0","mps:0","2.3003"],[9,"l","mps:0","mps:0","mps:0","2.3003"],[9,"r","mps:0","mps:0","mps:0","2.3003"]];
  const RETURNED = "2.300259590148926"; // train_trace.out.txt "returned"

  // train_one_epoch_broken from train_trace.py, line for line
  const BROKEN = [
    "def train_one_epoch_broken(model, batches, device):",
    "    model.to(device)",
    "    for photos, labels in batches:",
    "        loss = loss_fn(model(photos), labels)",
    "        opt.zero_grad()",
    "        loss.backward()",
    "        opt.step()",
    "    return loss.item()"
  ];
  // From train_trace.out.txt (trimmed with …, not altered otherwise; the run printed the home folder as ~)
  const ERR_BATCH = [
    "Traceback (most recent call last):",
    "  …",
    "  File \"…/train_trace.py\", line 72, in train_one_epoch_broken",
    "    loss = loss_fn(model(photos), labels)",
    "                   ^^^^^^^^^^^^^",
    "  …",
    "  File \"…/torch/nn/modules/linear.py\", line 134, in forward",
    "    return F.linear(input, self.weight, self.bias)",
    "           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
    "RuntimeError: Tensor for argument input is on cpu but expected on mps"
  ];
  const ERR_LABELS = [
    "  …",
    "  File \"…/torch/nn/functional.py\", line 3561, in cross_entropy",
    "    return torch._C._nn.cross_entropy_loss(",
    "           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
    "RuntimeError: target must be an MPS tensor"
  ];

  /* ---------- Derived from the data ---------- */
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
  const bn = n => f1(n / 1e9);
  const LAYER = NET.slice(0, -1).map((n, i) => n * NET[i + 1]);           // multiply-adds per photo, per layer
  const PER_PHOTO = LAYER.reduce((a, b) => a + b, 0);
  const FWD = PER_PHOTO * BATCH;                                          // one batch, forward
  const STEP = FWD * 3;                                                    // forward + backward (about twice the forward)
  const speed = k => T[k].cpu / T[k].gpu;
  const RATE_CPU = STEP / (T.big256.cpu / 1000), RATE_GPU = STEP / (T.big256.gpu / 1000);
  const STEPS_JOB = Math.ceil(PHOTOS / BATCH) * EPOCHS;
  const HOURS_CPU = STEPS_JOB * T.big256.cpu / 1000 / 3600;
  const MIN_GPU = STEPS_JOB * T.big256.gpu / 1000 / 60;
  const TINY_STEP = TINY.slice(0, -1).reduce((a, n, i) => a + n * TINY[i + 1], 0) * TINY_BATCH * 3;
  const SMALL_STEP = PER_PHOTO * SMALL_BATCH * 3;
  const PARAMS = NET.slice(0, -1).reduce((a, n, i) => a + n * NET[i + 1] + NET[i + 1], 0);
  const PARAM_MB = PARAMS * 4 / 1e6; // float32 = 4 bytes per number

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}net { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .${P}net li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; }
      .${P}net b { font: 600 14.5px var(--mono); white-space: nowrap; }
      .${P}err { margin: 14px 0 0; padding: 12px; border: 1px solid var(--line); background: var(--sunk); font: 500 13px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .${P}err b { color: var(--bad); font-weight: 600; }
      .${P}cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { border-top: 1px solid var(--line); }
      .${P}check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .${P}check label span { padding-top: 10px; }
      .${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .${P}check input:checked { background-color: var(--good); outline-color: var(--good); }
      .${P}links { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0 20px; }
      .${P}links a { display: inline-flex; align-items: center; min-height: 44px; }
      .${P}opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  const RUNCAP = `Measured on our Mac (Apple M1: its processor, and its GPU through PyTorch), ${RUN_DATE}. Median of 5 repeats.`;
  const errBlock = (kit, lines) => `<pre class="${P}err">${lines.map(l => /Error:/.test(l) ? `<b>${kit.esc(l)}</b>` : kit.esc(l)).join("\n")}</pre>`;
  const optCode = (kit, s) => `<span class="${P}opt">${kit.esc(s)}</span>`;
  const netList = (kit, rows) => `<ul class="${P}net">${rows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join("")}</ul>`;
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }
  // A screen made of questions asked one after another. Q: [{ task, opts, right, fb, after }]; after = html shown once answered.
  function sequence(el, done, kit, head, Q, tail) {
    let k = 0, ans = null;
    const paint = () => {
      const past = Q.slice(0, k).map(q => q.after).join("");
      const q = Q[k];
      el.innerHTML = `${head()}${past}${q ? `<p class="task">${q.task}</p><div class="lpanel">${ask(kit, q.opts, q.right, ans, q.fb)}</div>` : (tail ? tail() : "")}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[k].right) { k++; ans = null; paint(); if (k === Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 1. The situation, and counting the work of one training step by hand. */
  function countWork({ el, done, kit }) {
    ensureStyle();
    const head = () => `<h1>A job that takes all night</h1>
      <p class="lead">Lena runs a small online shop. On Saturday evening she starts training a model on her laptop. It sorts product photos, 64 by 64 grey pixels each, into ${NET[NET.length - 1]} categories. Each photo is ${fmt(NET[0])} numbers. The network is three plain layers: ${NET.join(" → ")} (how many numbers go into and out of each layer). In the morning it is still running.</p>
      <p class="lead">This lesson is about where training runs: on the laptop's processor or on a GPU, and how to move it. Before blaming the laptop, count the work. A layer computes each output as a weighted sum of all its inputs. One <b>multiply-add</b> is one weight times one input, added to the sum. (We ignore the biases and ReLU: they are tiny next to this.)</p>`;
    const Q = [
      { task: `How many multiply-adds does the first layer (${fmt(NET[0])} → ${fmt(NET[1])}) do for <b>one</b> photo?`,
        opts: [`${fmt(NET[0])} + ${fmt(NET[1])} = ${fmt(NET[0] + NET[1])}`, `${fmt(NET[0])} × ${fmt(NET[1])} = ${fmt(LAYER[0])}`, `${fmt(NET[0])} × ${fmt(NET[1])} × ${fmt(NET[1])} = ${fmt(LAYER[0] * NET[1])}`],
        right: 1,
        fb: [
          ["That counts the numbers going in and out, not the work between them. Each of the outputs needs every input times its own weight.", false],
          null,
          [`That multiplies by the output count twice. Each of the ${fmt(NET[1])} outputs takes ${fmt(NET[0])} multiply-adds, one per input: that is all.`, false]
        ],
        after: `${netList(kit, NET.slice(0, -1).map((n, i) => [`layer ${i + 1}: ${fmt(n)} × ${fmt(NET[i + 1])}`, fmt(LAYER[i])]).concat([["one photo, all layers", fmt(PER_PHOTO)]]))}` },
      { task: `One training step feeds a batch of ${BATCH} photos forward. How many multiply-adds is that?`,
        opts: [`${fmt(PER_PHOTO)}: the batch is done in one go`, `${fmt(PER_PHOTO)} × ${BATCH} = ${fmt(FWD)}`, `${fmt(PER_PHOTO)} × ${BATCH} × ${BATCH} = ${fmt(FWD * BATCH)}`],
        right: 1,
        fb: [
          ["The hardware may handle the batch together, but every photo still needs its own weighted sums. Doing them together saves time, not work.", false],
          null,
          ["Each photo meets the weights once. The batch size multiplies the work once, not twice.", false]
        ],
        after: kit.feedback(`Forward pass for one batch: about <b>${bn(FWD)} billion</b> multiply-adds.`) },
      { task: "Training also runs the backward pass (the gradients) and then updates the weights. The backward pass costs about twice the forward pass. About how much work is one whole training step?",
        opts: [`About ${bn(FWD)} billion: backward reuses the forward numbers`, `About ${bn(FWD * 2)} billion`, `About ${bn(STEP)} billion`],
        right: 2,
        fb: [
          ["Backward does reuse values saved in the forward pass, but it still computes a gradient for every weight and every input: new multiply-adds.", false],
          ["That is forward plus one more forward. Backward is about two forwards, so the total is forward plus two forwards.", false],
          null
        ],
        after: kit.feedback(`Right: forward ${bn(FWD)} + backward about ${bn(FWD * 2)} = about <b>${bn(STEP)} billion multiply-adds per step</b>. The “backward is about twice forward” rule is the estimate used in the scaling-laws paper (see sources).`, true) }
    ];
    sequence(el, done, kit, head, Q);
  }

  /* 2. Compare the count with the recorded timings: the CPU, then predict the GPU. */
  function timings({ el, done, kit }) {
    ensureStyle();
    const head = () => `<h1>What the laptop really does</h1>
      <p class="lead">We timed exactly this step (same network, batch ${BATCH}, random numbers in place of photos) on our Mac's processor, the <b>CPU</b>. The middle of 5 timed runs (the median): <b>${f1(T.big256.cpu)} ms</b> per step. That is ${bn(STEP)} billion multiply-adds in ${f1(T.big256.cpu)} ms, about <b>${bn(RATE_CPU)} billion per second</b>.</p>
      <p class="lead">Lena's job: ${fmt(PHOTOS)} photos, batches of ${BATCH}, ${EPOCHS} passes over all of them (${EPOCHS} <b>epochs</b>). That is ${fmt(Math.ceil(PHOTOS / BATCH))} batches per epoch × ${EPOCHS} = ${fmt(STEPS_JOB)} steps.</p>`;
    const gpuOpts = [T.big256.cpu, T.big256.cpu / 2, T.big256.gpu, T.big256.cpu / 1000];
    const Q = [
      { task: "At that speed, how long does her whole job take on the CPU?",
        opts: [`About ${f1(HOURS_CPU / 10)} hours`, `About ${f1(HOURS_CPU)} hours`, `About ${f1(HOURS_CPU * 10)} hours`],
        right: 1,
        fb: [
          [`${fmt(STEPS_JOB)} steps × ${f1(T.big256.cpu)} ms is ${fmt(STEPS_JOB * T.big256.cpu / 1000)} seconds. Divide by 3,600 for hours; you are one zero short.`, false],
          null,
          [`${fmt(STEPS_JOB)} × ${f1(T.big256.cpu)} ms = ${fmt(STEPS_JOB * T.big256.cpu / 1000)} seconds. Divided by 3,600 that is fewer hours than this.`, false]
        ],
        after: kit.feedback(`About <b>${f1(HOURS_CPU)} hours</b>: all night, as Lena found. And that is one try. Change one setting and she waits another night.`) },
      { task: "A computer's <b>GPU</b> (graphics processor) can run the same step. We timed it on the same Mac. Predict the time per step.",
        opts: gpuOpts.map(v => `About ${v < 1 ? v.toFixed(1) : Math.round(v)} ms`),
        right: 2,
        fb: [
          ["Same work, but not the same speed: the GPU is built for exactly this kind of work. It is much faster here.", false],
          ["Faster than that. Twice as fast would be a modest win; the measured win is much larger.", false],
          null,
          [`That would be ${fmt(STEP / (T.big256.cpu / 1000 / 1000) / 1e9)} billion multiply-adds per second, a thousand times the CPU's rate on the same work. A GPU is fast, not magic: the real win is far smaller.`, false]
        ],
        after: `${kit.meter([{ label: "CPU ms", value: +f1(T.big256.cpu), max: T.big256.cpu }, { label: "GPU ms", value: +f1(T.big256.gpu), max: T.big256.cpu, good: true }])}<p class="${P}cap">${RUNCAP} We ran 5 warm-up steps first, and waited for the GPU to finish before stopping the clock: PyTorch hands work to the GPU and moves on before it is done, so a clock stopped too early measures too little.</p>
          ${kit.feedback(`Measured: <b>${f1(T.big256.gpu)} ms</b>, about ${Math.round(speed("big256"))} times fewer milliseconds per step: about ${bn(RATE_GPU)} billion multiply-adds per second. Her ${f1(HOURS_CPU)}-hour night becomes about ${Math.round(MIN_GPU)} minutes on this GPU. (Our Mac was busy with other jobs while we timed, so treat the exact numbers as rough; your notebook run gives its own.)`, true)}` }
    ];
    sequence(el, done, kit, head, Q);
  }

  /* 3. Spot the idea: why the GPU wins. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "It runs each multiply-add at a much higher clock speed",
      "It works on thousands of multiply-adds at the same time, because none of them waits for another",
      "It skips the multiply-adds whose weights are close to zero",
      "It has its own memory, so the photos load faster"
    ];
    const fb = [
      ["No. NVIDIA's own guide says a GPU accepts being slower at one long chain of operations, to get much more work done in total. The win is not in each multiply-add being quicker.", false],
      [`Right. The ${fmt(NET[1])} outputs of a layer, for each of ${BATCH} photos, are separate weighted sums. None needs another's result, so they can all run side by side. NVIDIA's programming guide puts it this way: a CPU is built to run a sequence of operations as fast as possible and can run a few tens of them in parallel; a GPU is built to run thousands in parallel. A training step is almost all matrix multiplication, which is exactly that shape.`, true],
      ["Nothing is skipped: the GPU computes the same multiply-adds and gets the same kind of result. It does them in a different order, many at once.", false],
      [`Its memory matters for holding the model and the batch, but here the batch is only ${fmt(BATCH * NET[0])} numbers and it was copied over in every step anyway. The time goes into the ${bn(STEP)} billion multiply-adds.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why is the GPU faster?</h1>
        <p class="lead">Same step, same ${bn(STEP)} billion multiply-adds: ${f1(T.big256.cpu)} ms on the CPU, ${f1(T.big256.gpu)} ms on the GPU. Think of how a layer's outputs are computed: output 1 is a weighted sum of all inputs, output 2 is another weighted sum of the same inputs, and so on.</p>
        <p class="task">What does the GPU do differently?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it with predictions: a smaller batch, then a tiny network. */
  function predictSizes({ el, done, kit }) {
    ensureStyle();
    const row = (label, k) => [label, `CPU ${f1(T[k].cpu)} ms · GPU ${f1(T[k].gpu)} ms`];
    const head = () => `<h1>Does the GPU always win?</h1>
      <p class="lead">If the win comes from doing many multiply-adds at once, it should depend on how many there are per step. We timed two smaller cases.</p>
      ${netList(kit, [row(`${NET.join("-")}, batch ${BATCH}: ${bn(STEP)} billion per step`, "big256")])}`;
    const Q = [
      { task: `Same network, batch ${SMALL_BATCH}: ${BATCH / SMALL_BATCH} times fewer multiply-adds per step (${bn(SMALL_STEP)} billion). How does the GPU do now?`,
        opts: [`Even more ahead than ${Math.round(speed("big256"))} times`, "Still ahead, but by less", "Slower than the CPU"],
        right: 1,
        fb: [
          ["Less work per step means fewer things to run side by side, so the GPU has less to gain. Its lead shrinks rather than grows.", false],
          null,
          [`${bn(SMALL_STEP)} billion multiply-adds is still a lot of work that can run side by side. The GPU loses some of its lead, not all of it.`, false]
        ],
        after: `${netList(kit, [row(`same network, batch ${SMALL_BATCH}`, "big16")])}${kit.feedback(`Measured: about ${f1(speed("big16"))} times fewer milliseconds on the GPU, down from about ${Math.round(speed("big256"))}. Still a clear win.`, true)}` },
      { task: `Now a tiny network, ${TINY.join("-")}, batch ${TINY_BATCH}: only ${fmt(TINY_STEP)} multiply-adds per step. Predict.`,
        opts: ["The GPU is far ahead", "About the same", "The CPU is faster"],
        right: 2,
        fb: [
          [`${fmt(TINY_STEP)} multiply-adds is almost nothing; a CPU does that in a blink. There is not enough work for the GPU's many cores (its small calculating units) to share.`, false],
          ["Closer, but the measurement tips one way clearly. Every step also pays a fixed cost to copy the batch over and hand the work to the GPU. With this little work, that fixed cost is most of the step.", false],
          null
        ],
        after: `${netList(kit, [row(`${TINY.join("-")}, batch ${TINY_BATCH}`, "tiny32")])}<p class="${P}cap">${RUNCAP}</p>${kit.feedback(`Measured: the GPU took about ${f1(1 / speed("tiny32"))} times as long as the CPU. Every step pays a fixed cost to copy the batch to the GPU and start the work there; with only ${fmt(TINY_STEP)} multiply-adds, that fixed cost is the likely reason the GPU lost. A GPU pays off when each step has a lot of work that can run side by side: big layers, big batches.`, true)}` }
    ];
    sequence(el, done, kit, head, Q);
  }

  /* 5. The library: moving the model and each batch, as a traced run. */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const say = r => {
      const [ln, ev, m, ph] = r;
      if (ev === "r") return `The function returns <code>loss.item()</code>: ${RETURNED}, a plain Python number copied back from the GPU. The model is still on the GPU, ready for the next epoch.`;
      if (ln === 1) return `About to run <code>model.to(device)</code>. The model was built on the CPU: by default PyTorch creates new models and tensors there. <code>device</code> is <code>"mps"</code>, the name PyTorch gives a Mac's GPU. On Colab or any NVIDIA card it is <code>"cuda"</code>.`;
      if (ln === 2 && !ph) return `<code>model.to(device)</code> moved every weight to the GPU (<code>mps:0</code> is the first GPU). For a model, <code>.to</code> changes the model itself, so there is no copy to assign. It is done once, before the loop. In your own script, move the model before you create the optimizer, as PyTorch's documentation advises.`;
      if (ln === 2) return "Back to the top of the loop for the next batch, or out of it if there are none left.";
      if (ln === 3) return `A new batch from the list. Its photos and labels are on the <b>CPU</b>, where the data was loaded. The model is on the GPU.`;
      if (ln === 4) return `<code>photos.to(device)</code> returned a copy on the GPU, and the name now points to the copy. The labels are still on the CPU.`;
      if (ln === 5) return "Now the model, the photos and the labels are all on the same device. Only now can they meet.";
      if (ln === 6) return `Forward and loss ran on the GPU. <code>loss</code> is ${r[5]}, and it lives on the GPU too.`;
      if (ln === 7) return "<code>zero_grad</code> clears the old gradients, which also live on the GPU next to the weights.";
      if (ln === 8) return "<code>backward</code> ran on the GPU: the gradients are on the same device as the weights, so the update can run there too.";
      if (ln === 9) return "The loop is over.";
      return "";
    };
    const paint = () => {
      const r = TRACE[i];
      el.innerHTML = `<h1>The same loop, on the GPU</h1>
        <p class="lead">This is the training loop you know, with two kinds of change: the model moves to the GPU once, and every batch moves in every step. We traced it on our Mac's GPU with two batches of ${BATCH}.</p>
        <p class="task">Step through to the end. Watch where each thing lives.</p>
        ${kit.code(CODE, r[0])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>model on <b>${r[2]}</b></span><span>photos on <b>${r[3] || "–"}</b></span><span>labels on <b>${r[4] || "–"}</b></span><span>loss <b>${r[5] || "–"}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say(r))}
        <p class="${P}cap">Traced run on our Mac, PyTorch 2.15, ${RUN_DATE}.</p>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 6. Broken on purpose: the real device-mismatch error. */
  function broken({ el, done, kit }) {
    ensureStyle();
    const head = () => `<h1>Broken on purpose: two devices</h1>
      <p class="lead">A first try at the GPU version. It moves the model and nothing else. We ran it on our Mac:</p>
      ${kit.code(BROKEN, 3)}
      ${errBlock(kit, ERR_BATCH)}
      <p class="${P}cap">Real error from our run, trimmed with …, ${RUN_DATE}.</p>`;
    const fixOpts = [
      optCode(kit, "model.to(\"cpu\")  # train on the CPU instead"),
      optCode(kit, "photos = photos.to(device)  # added before the loss line"),
      optCode(kit, "photos, labels = photos.to(device), labels.to(device)")
    ];
    const Q = [
      { task: "What is on the wrong device?",
        opts: ["The model: model.to(device) did not work", "The photos: they never left the CPU", "The loss function: it needs moving too", "Nothing: the GPU ran out of memory"],
        right: 1,
        fb: [
          ["The message says the <b>input</b> is on cpu and it <b>expected</b> mps. It expected mps because the layer's weights are there: <code>model.to</code> worked.", false],
          null,
          ["This loss function has no weights, so there is nothing in it to move. And the error is raised inside the first linear layer, before the loss runs.", false],
          ["A memory error says so in its message. This one names two devices: the input on cpu, the weights on mps.", false]
        ],
        after: kit.feedback("Right. The weights are on the GPU, the photos are still on the CPU, and PyTorch will not compute with tensors on two devices. It raises an error instead of copying for you. The exact wording depends on the device and the operation, so read the message for the device names.", true) },
      { task: "Which fix do you add as the first line inside the loop?",
        opts: fixOpts,
        right: 2,
        fb: [
          [`That runs without an error, because everything is on the CPU again. It also throws away the ${Math.round(speed("big256"))} times speedup you came for. Move the data to the model, not the model to the data.`, false],
          [`Close, and we ran that too. The photos error is gone, and the next one appears in the loss:${errBlock(kit, ERR_LABELS)}The labels are also part of the batch. Everything that meets the model's output must move.`, false],
          null
        ],
        after: kit.feedback(`Right: this is what the first two lines inside the traced loop did. Each batch comes from the CPU, so each batch moves, every step. When you see “expected … on”, “must be … tensor” or two device names in an error, print <code>.device</code> of each tensor on the failing line.`, true) }
    ];
    sequence(el, done, kit, head, Q);
  }

  /* 7. Colab: the free notebook GPU. Not run by us. */
  function colab({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The free notebook GPU is slower than her laptop's processor",
      "Her code still sends the work to the CPU",
      "The batch is too small for any GPU",
      "The GPU only speeds up the forward pass"
    ];
    const fb = [
      ["Possible in principle, but you cannot know that yet. The first thing to check is where the model and batches are. If her code never moved them, the GPU sat idle.", false],
      ["Right. Colab's own FAQ says: “Executing code in a GPU or TPU runtime does not automatically mean that the GPU or TPU is being utilized.” The runtime gives her a GPU; only <code>model.to(device)</code> and <code>batch.to(device)</code> put work on it. A <code>device</code> hard-coded to <code>\"cpu\"</code> keeps everything on the processor. Print <code>next(model.parameters()).device</code> to check.", true],
      [`Even at batch ${SMALL_BATCH} our GPU was about ${f1(speed("big16"))} times faster for her network. Batch ${BATCH} is plenty.`, false],
      ["In our trace the loss, the backward pass and the update all ran on the GPU, next to the weights. The whole step moves.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The free notebook GPU</h1>
        <p class="lead"><b>Not run by us.</b> Written from the official documentation, checked ${RUN_DATE}:</p>
        <ul class="${P}links"><li><a href="https://research.google.com/colaboratory/faq.html" target="_blank" rel="noopener">Colab FAQ</a></li><li><a href="https://docs.pytorch.org/docs/2.15/notes/cuda.html" target="_blank" rel="noopener">PyTorch CUDA notes</a></li></ul>
        <p class="lead">Lena's laptop has no GPU that PyTorch can use, so she opens her code in Google Colab, a free hosted notebook. In the menu she picks <b>Runtime &gt; Change runtime type</b> and sets the hardware accelerator to a GPU. PyTorch reaches NVIDIA GPUs through the device name <code>"cuda"</code>. These lines pick the GPU when PyTorch can see one, and the CPU otherwise:</p>
        ${kit.code(["if torch.cuda.is_available():", "    device = \"cuda\"", "else:", "    device = \"cpu\""], -1)}
        <p class="lead">The FAQ is clear about limits: in the free version GPU access is “heavily restricted”, resources are “not guaranteed and not unlimited”, notebooks run “for at most 12 hours”, and idle runtimes time out.</p>
        <p class="task">She switches the runtime and runs her old notebook, where <code>device = "cpu"</code> is written at the top. It is just as slow. Why?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `The GPU's memory: the model will not fit`,
      "The session can stop before the job ends, and the trained weights with it",
      "The GPU gives a less accurate model"
    ];
    const fb = [
      [`Her model has ${fmt(PARAMS)} weights and biases: at 4 bytes each, about ${Math.round(PARAM_MB)} MB. Training needs a few times that for gradients and saved values, still small for a GPU. Memory bites with much bigger models.`, false],
      ["Right. Free GPU time is limited and not guaranteed: a session can end on a time limit, an idle timeout or a usage limit, and everything in it goes. Save the model's weights to a file in her own storage every few epochs (a <b>checkpoint</b>), so a cut-off run resumes instead of starting over.", true],
      ["Same multiply-adds, same model. PyTorch's docs warn that results may not be exactly reproducible between CPU and GPU runs, even with the same seed, but tiny differences are not a worse model.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When a GPU is worth it</h1>
        <p class="lead"><b>For:</b> training and running neural networks whose steps are big matrix multiplications.</p>
        <p class="lead"><b>Reach for it</b> when one step has billions of multiply-adds and you wait hours for a run.</p>
        <p class="lead"><b>Not</b> for tiny models or tiny batches (the fixed cost per step wins, as in our ${TINY.join("-")} run), for classic models on spreadsheet-sized data, or when the step is waiting on something else, like reading files from disk. A faster calculator does not help a step that is not calculating.</p>
        <p class="lead"><b>Costs:</b> GPU time is scarce and paid beyond free tiers; GPU memory limits model and batch size; moving data between devices takes time; and code must put every tensor on the right device.</p>
        <p class="task">Lena moves her ${f1(HOURS_CPU)}-hour job to the free notebook GPU. Which cost should she plan for first?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A team trains an image network with dozens of large layers on a million photos. One epoch takes a day on their server's processor.", true,
      "Yes. Large layers on large batches are billions of independent multiply-adds per step: the shape a GPU is built for. This is the case where a day can become an hour or two.",
      "Every step is big matrix multiplications with outputs that do not depend on each other. That is exactly the work a GPU runs side by side; leaving it on a processor wastes most of the day."],
    ["An analyst fits a small model with 12 input columns on 5,000 rows from a spreadsheet. It finishes in two seconds.", false,
      "No. There is very little work per step, like our tiny network, where the GPU was slower than the CPU. The fixed cost of copying data over and starting the work would be most of the time, and two seconds is not worth saving.",
      "With so few multiply-adds per step, the GPU cannot spread the work over its cores, and every step still pays the copy-and-start cost. Our tiny-network run measured exactly that: the GPU lost."],
    ["A training job uses a big network, but a profiler (a tool that shows where the time goes) shows the GPU idle most of each step, waiting while each batch of images is read and decoded from disk.", false,
      "No, not more GPU. The step is waiting on the disk and the decoding, not on multiply-adds. A faster GPU would sit idle for longer. Fix the loading: read in parallel, decode ahead, keep data closer.",
      "The slow part is reading and decoding images, which happens on the CPU before the GPU gets anything. A bigger or second GPU does not speed up a step that is not calculating."],
    ["A text model with large layers trains on millions of sentences; each step multiplies big matrices for a batch of 64 sentences.", true,
      "Yes. Big matrices times a batch is a large number of independent multiply-adds per step, so the GPU's many cores have plenty to share.",
      "Large layers and a real batch mean billions of multiply-adds per step that do not wait for each other. That is the GPU's case, whatever the data is: photos or text."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>GPU or not?</h1>
        <p class="lead">Four jobs from other teams. The question is the same each time: is there a lot of multiply-add work per step, and is the step waiting on it?</p>
        <p class="task">Would a GPU make each one much faster? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and what you should see (from our run). */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const CHECK = [
      "The first cell prints <code>GPU device: cuda</code> on a Colab GPU runtime (ours, on a Mac: <code>mps</code>). <code>none</code> means the runtime has no GPU.",
      `For the ${NET.join("-")} network at batch ${BATCH}, the GPU line prints a shorter time than the CPU line and a “times faster” number above 1 (our notebook run, on a quieter Mac than the timings above: 2.5).`,
      `For the tiny ${TINY.join("-")} network at batch ${TINY_BATCH}, the line ends in “times SLOWER”: the GPU is not faster.`,
      "In the trace, the model is on <code>cpu</code> before <code>model.to(device)</code> and on the GPU after it, and <code>next(model.parameters()).device</code> names the GPU.",
      "The loop that never moves the batch prints a <code>RuntimeError</code> that names the CPU and the GPU; the fixed loop prints a loss and no error."
    ];
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now say why a GPU speeds up training (a step is billions of independent multiply-adds, and it runs many at once), when it does not (tiny steps, steps waiting on data), and how to use one: <code>model.to(device)</code> once, every batch <code>.to(device)</code> every step, and read a device-mismatch error for the two devices it names.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a>.` : "The notebook for this lesson is on its way."} It times the same step on Colab's CPU and GPU and walks through the broken loop. What you should see:</p>
      <ul class="${P}check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. The same ideas, model, batch, device and training loop, written in another framework's words.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "GPUs and why they matter",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/notes/cuda.html",
      "https://docs.pytorch.org/docs/2.15/notes/mps.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.to.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Module.html",
      "https://research.google.com/colaboratory/faq.html",
      "https://arxiv.org/abs/2001.08361",
      "https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/introduction.html",
      "https://docs.pytorch.org/docs/2.15/notes/randomness.html"
    ],
    interview: [
      {
        q: "A colleague moved training to a GPU machine and says it is no faster than on his laptop. What do you check, in order?",
        good: [
          "Check the device: print where the model's parameters and a batch actually are; code that never calls .to(device) leaves the GPU idle",
          "Check how much work a step has: a small model or a tiny batch can be as slow or slower on a GPU because of the fixed cost per step",
          "Check whether the step waits on data loading or preprocessing on the CPU rather than on the math",
          "Time it fairly: warm up first and wait for the GPU to finish before stopping the clock, since GPU work runs asynchronously"
        ],
        weak: "Ask for a bigger GPU. That does nothing if the model is on the CPU or the step is waiting on data."
      },
      {
        q: "Your training script crashes with an error saying a tensor is on cpu but expected on the GPU. Walk me through the fix.",
        good: [
          "The model's weights are on the GPU and some input is not; PyTorch does not copy between devices for you",
          "Read the failing line and print .device for every tensor it uses: the batch, the labels, anything created inside the loop",
          "Move each batch, inputs and labels, to the device inside the loop; move the model once before it",
          "Do not fix it by moving the model back to the CPU: that removes the error and the speedup"
        ],
        weak: "Move everything to the CPU so it runs. The error goes away and so does the reason for using a GPU."
      }
    ],
    screens: [countWork, timings, spotIdea, predictSizes, asCode, broken, colab, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
