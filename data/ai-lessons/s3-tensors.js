/* Lesson: what PyTorch tensors add to NumPy arrays. Story: a parking-garage operator stores a week of occupancy
   counts as levels x hours x days (4 x 24 x 7, 120 spaces per level) and feeds them to a small model.
   Ideas: (1) a tensor carries a dtype and a device that must match the model's weights, and PyTorch's type
   rules (float32 by default) differ from NumPy's; (2) a tensor is a view over memory with strides: transpose
   only changes the strides, view() works only when the memory order allows it, reshape() copies when it must.
   Data, all real, no model recordings (nothing here needs a language model):
   - docs/ai-path/runs/s3-tensors/tensors.py + tensors.out.txt: dtypes of six mixed operations, strides, the four
     view calls, memory sharing, the device moves (on the Mac's mps device) and the three error messages;
   - docs/ai-path/runs/s3-tensors/prepare_trace.py + prepare_trace.out.txt: to_model_input traced line by line
     (tensors summarised as dtype, shape, stride, contiguous, device);
   - docs/ai-path/runs/s3-tensors/int_input.py + int_input.out.txt (review): nn.Linear refuses an int64 input
     (Long and Float), and an in-place float division on an int64 tensor fails (screen 1 and screen 9 feedback);
   - env.txt: Python 3.12.11, torch 2.15.0, numpy 2.5.4, Apple M1.
   Lesson-local style: a monospace block for code results and error messages (.lx-s3-tensors-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s3-tensors";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s3-tensors.ipynb";

  /* ---------- Data copied from tensors.out.txt ---------- */
  const SHAPE = [4, 24, 7];          // levels, hours, days
  const CAPACITY = 120;              // tensors.py CAPACITY (spaces per level)
  const STRIDE = [168, 7, 1];        // counts.stride()
  const T_SHAPE = [4, 7, 24];        // by_day = counts.transpose(1, 2)
  const T_STRIDE = [168, 1, 7];      // by_day.stride()
  const SIZE_F64 = 8, SIZE_F32 = 4; // torch.ones(3, dtype=torch.float64).element_size(), counts.float().element_size()
  const NP_DIV = "float64";          // week_counts / 2 in NumPy
  const NP_ONES = "float64", PT_ONES = "float32"; // np.ones(3).dtype, torch.ones(3).dtype
  const ERR_MEAN = "NotImplementedError: mean(): could not infer output dtype. Input dtype must be either a floating point or complex dtype. Got: Long";
  const OPS = [
    { code: "counts / 2", got: "float32" },
    { code: "counts // 2", got: "int64" },
    { code: "counts * 0.5", got: "float32" },
    { code: "counts + torch.from_numpy(rates)", got: "float64", note: "rates is a NumPy float64 array of the same shape" },
    { code: "counts.float() + torch.tensor(1.0, dtype=torch.float64)", got: "float32" },
    { code: "counts.mean()", got: "error", err: ERR_MEAN }
  ];
  const ERR_VIEW = "RuntimeError: view size is not compatible with input tensor's size and stride (at least one dimension spans across two contiguous subspaces). Use .reshape(...) instead.";
  const VIEWS = [ // [call, new shape, ok, stride of the result when it worked]
    ["by_day.view(4, 168)", [4, 168], false, null],
    ["by_day.view(2, 2, 7, 24)", [2, 2, 7, 24], true, [336, 168, 1, 7]],
    ["by_day.view(-1)", [672], false, null],
    ["by_day.view(4, 7, 4, 6)", [4, 7, 4, 6], true, [168, 1, 42, 7]]
  ];
  const MEM = { aBefore: 102, aAfter: 999, aShares: true, bBefore: 1, bAfter: 1, bShares: false, aWrite: 999, bWrite: 555 };
  const DEV = { start: "cpu", afterBare: "cpu", kept: "mps:0", sameMemory: false, toCpuIsSelf: true };
  const ERRORS = [
    { code: ["model = torch.nn.Linear(HOURS, 1)", "day_np = (week_counts[0, :, 0] / CAPACITY).reshape(1, HOURS)", "model(torch.from_numpy(day_np))"],
      msg: "RuntimeError: mat1 and mat2 must have the same dtype, but got Double and Float",
      fix: "model(torch.from_numpy(day_np).float())" },
    { code: ["model_gpu = torch.nn.Linear(HOURS, 1).to(\"mps\")", "day = torch.from_numpy(day_np).float()", "model_gpu(day)"],
      msg: "RuntimeError: Tensor for argument input is on cpu but expected on mps",
      fix: "model_gpu(day.to(\"mps\"))" },
    { code: ["counts.transpose(1, 2).view(LEVELS, -1)"],
      msg: ERR_VIEW,
      fix: "counts.transpose(1, 2).reshape(LEVELS, -1)" }
  ];

  /* ---------- The code screen: to_model_input from prepare_trace.py, line for line (line 0 = def) ---------- */
  const CODE = [
    "def to_model_input(week_counts, device):",
    "    counts = torch.from_numpy(week_counts)",
    "    by_day = counts.permute(2, 0, 1)",
    "    rows = by_day.reshape(DAYS, -1)",
    "    rows = rows.float() / CAPACITY",
    "    rows = rows.to(device)",
    "    return rows"
  ];
  // prepare_trace.out.txt: each step = [line about to run, event, {var: [dtype, shape, stride, contiguous, device]}]
  const TV = (d, sh, st, c, dev) => ({ dtype: d, shape: sh, stride: st, contiguous: c, device: dev });
  const C0 = TV("int64", [4, 24, 7], [168, 7, 1], true, "cpu");
  const B0 = TV("int64", [7, 4, 24], [1, 168, 7], false, "cpu");
  const TRACE = [
    [1, "line", {}],
    [2, "line", { counts: C0 }],
    [3, "line", { counts: C0, by_day: B0 }],
    [4, "line", { counts: C0, by_day: B0, rows: TV("int64", [7, 96], [1, 7], false, "cpu") }],
    [5, "line", { counts: C0, by_day: B0, rows: TV("float32", [7, 96], [1, 7], false, "cpu") }],
    [6, "line", { counts: C0, by_day: B0, rows: TV("float32", [7, 96], [1, 7], false, "mps:0") }],
    [6, "return", { counts: C0, by_day: B0, rows: TV("float32", [7, 96], [1, 7], false, "mps:0") }]
  ];
  const ROWS_SHARES = true; // tensors.py section G: counts.permute(2, 0, 1).reshape(7, -1) shares storage with counts
  const MODEL_OUT = [7, 1]; // prepare_trace.out.txt: model(result).shape with nn.Linear(96, 1)

  /* ---------- Derived ---------- */
  const prod = a => a.reduce((x, y) => x * y, 1);
  const N = prod(SHAPE);
  const tup = a => `(${a.join(", ")}${a.length === 1 ? "," : ""})`;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-mono { margin: 14px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); border-radius: 6px;
        font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-err { border-left: 3px solid var(--bad); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-tab { width: 100%; margin: 14px 0 0; border-collapse: collapse; font-size: 15px; }
      .lx-${ID}-tab th, .lx-${ID}-tab td { text-align: left; padding: 7px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .lx-${ID}-tab th { font-weight: 600; color: var(--muted); font-size: 13.5px; }
      .lx-${ID}-tab td code { font: 500 13.5px var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-now td { font-weight: 600; }
      .lx-${ID}-check { list-style: none; padding: 0; margin: 12px 0 0; }
      .lx-${ID}-check li { border-bottom: 1px solid var(--line); }
      .lx-${ID}-check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; font-size: 15.5px; line-height: 1.45; cursor: pointer; }
      .lx-${ID}-check label span { padding-top: 10px; }
      .lx-${ID}-check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .lx-${ID}-check input:checked { background-color: var(--good); outline-color: var(--good); }
      .lx-${ID}-check input:focus-visible { outline-width: 3px; }
      .lx-${ID}-nb { min-height: 44px; margin-top: 4px; }
    `;
    document.head.appendChild(s);
  }
  const mono = (kit, s, err) => `<div class="lx-${ID}-mono${err ? ` lx-${ID}-err` : ""}">${kit.esc(s)}</div>`;
  const opt = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  function tab(kit, head, rows, now) {
    return `<table class="lx-${ID}-tab"><thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) =>
      `<tr${i === now ? ` class="lx-${ID}-now"` : ""}>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }

  /* 1. The situation, and six dtype predictions. */
  const DT = ["int64", "float32", "float64", "error"];
  function whyWrong(k, pick) {
    const o = OPS[k];
    if (pick === "error") return "No error here. When arithmetic makes a new tensor, PyTorch converts mixed types by itself (it calls this type promotion). The errors come from operations that need a certain type, or from writing a float result back into a whole-number tensor in place.";
    if (k === 0) return pick === "int64"
      ? "<code>/</code> is true division: 3 / 2 is 1.5, so the result must hold fractions. Whole numbers cannot."
      : `That is NumPy's habit: in NumPy the same division gave ${NP_DIV}. PyTorch gives the result its <b>default</b> float type instead, and that is float32.`;
    if (k === 1) return "<code>//</code> rounds down, so every answer is a whole number. Nothing forces a float, and the int64 stays int64.";
    if (k === 2) return pick === "int64"
      ? "0.5 is a float, a higher kind of number than the whole-number tensor, so the result must become a float."
      : "A Python float like 0.5 does not count as float64 in PyTorch. It counts as the default float type, float32, so the result is float32.";
    if (k === 3) return pick === "int64"
      ? "The other tensor holds floats, so the result must hold floats too."
      : "<code>torch.from_numpy</code> keeps NumPy's float64; nothing converts it. Two tensors with dimensions, one int64 and one float64: the float64 sets the result type.";
    if (k === 4) return pick === "float64"
      ? "The float64 here is a zero-dimension tensor: one number, no shape. Such a number only changes the result type if it is a higher <i>kind</i> (float over whole number). Both are floats already, so the float32 tensor with dimensions decides."
      : "<code>counts.float()</code> is already float32, and the other side is a float too. A float plus a float is never a whole number.";
    if (k === 5) return pick === "int64"
      ? "PyTorch does not round a mean to a whole number. It does something stricter, see the other options."
      : "Reasonable, and NumPy would give a float mean. PyTorch is stricter: <code>mean</code> refuses whole-number input.";
    return "";
  }
  function sixOps({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const first = OPS.map(() => true);
    const paint = () => {
      const fin = k >= OPS.length;
      const rows = OPS.slice(0, Math.min(k + 1, OPS.length)).map((o, i) => [`<code>${kit.esc(o.code)}</code>`, i < k ? kit.esc(o.got) : "?"]);
      const o = fin ? null : OPS[k];
      const score = first.filter(Boolean).length;
      el.innerHTML = `<h1>A week of parking, into PyTorch</h1>
        <p class="lead">A parking garage has ${SHAPE[0]} levels of ${CAPACITY} spaces. Its system exports how many cars were on each level, every hour, every day for a week: a NumPy array of whole numbers, shape <code>${tup(SHAPE)}</code> (levels, hours, days). The operator wants a small PyTorch model to learn the busy hours. A PyTorch model reads its input only as <b>tensors</b>, PyTorch's arrays. So step one, between the data and the model, is turning the array into a tensor:</p>
        ${mono(kit, "counts = torch.from_numpy(week_counts)\n# dtype int64, shape " + tup(SHAPE))}
        <p class="lead">Before any model, the counts get scaled and mixed with other numbers. Each result has a number type, its <b>dtype</b>: int64 holds whole numbers; float32 and float64 hold fractions, float64 with more digits.</p>
        ${fin ? "" : `<p class="task">Operation ${k + 1} of ${OPS.length}: what dtype comes out?${o.note ? ` (${kit.esc(o.note)}.)` : ""}</p>`}
        ${tab(kit, ["operation", "result dtype"], rows, fin ? -1 : k)}
        <div class="lpanel">${fin ? "" : kit.options(DT, { picked: wrong == null ? null : DT.indexOf(wrong), correct: DT.indexOf(o.got) })}
        ${wrong != null ? kit.feedback(whyWrong(k, wrong), false) : ""}
        ${fin ? `${mono(kit, OPS[5].err, true)}<p class="lx-${ID}-cap">Real output, our run (PyTorch on a Mac)</p>
          ${kit.feedback(`You got ${score} of ${OPS.length} on the first try. Three rules cover all six. 1. A new float result gets PyTorch's default float, <b>float32</b>. NumPy would pick float64. 2. When two tensors with dimensions mix, the higher type wins: float64 (from NumPy here) beats int64. A single number (a tensor with no dimensions) is weaker: a float64 one does not turn a float32 tensor into float64. 3. Some operations refuse whole numbers. <code>mean</code> wants floats, so convert first with <code>counts.float()</code>. The message says <code>Long</code>: that is PyTorch's other name for int64.`, true)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = DT[+b.dataset.i];
        if (v !== OPS[k].got) { wrong = v; first[k] = false; paint(); return; }
        wrong = null; k++; paint();
        if (k >= OPS.length) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: what a tensor carries that the model checks. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Its shape and its values",
      "Its dtype and its device: the input must use the same number type as the weights, and sit in the same memory",
      "Whether it was made with torch.from_numpy or with torch.tensor",
      "Nothing: PyTorch converts the input the way it converted the six operations"
    ];
    const fb = [
      ["The shape must fit, yes: 24 hours in, 24 weights. But the values are never checked; any numbers of the right type go through. Something else must match too.", false],
      [`Right. A tensor is a NumPy-like array plus two facts the model checks: the <b>dtype</b> (the number type, float32 for the weights here) and the <b>device</b> (where its memory lives: the computer's main memory, <code>cpu</code>, or a graphics chip, such as <code>mps</code> on a Mac). A model's layers do not convert for you; a mismatch is an error. (Tensors add a third thing, recording the math for training, in the next lesson.)`, true],
      ["How a tensor was made does not stay with it. Two tensors with the same dtype, device and shape behave the same, whatever made them.", false],
      ["Arithmetic between two tensors converts, as you saw. A model's layer is stricter: it multiplies the input by its weights, and it refuses an input whose type differs from the weights. You will see the error on a later screen.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What the tensor carries</h1>
        <p class="lead">The same request in both libraries, from our run:</p>
        ${tab(kit, ["", "NumPy", "PyTorch"], [
          ["<code>ones(3)</code> dtype", NP_ONES, PT_ONES],
          ["bytes per number", `${SIZE_F64} (float64)`, `${SIZE_F32} (float32)`],
          ["where it lives", "main memory", `<code>${DEV.start}</code> unless moved`]
        ])}
        <p class="lead">So PyTorch's default, float32, needs ${SIZE_F32} bytes per number where NumPy's float64 needs ${SIZE_F64}. The garage's model is a PyTorch layer with ${SHAPE[1]} weights, one per hour, stored as float32 on the Mac's graphics chip (its GPU, which has its own memory).</p>
        <p class="task">Before the layer multiplies anything, what about the input tensor must match its weights?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Devices: .to() returns a new tensor. */
  function devices({ el, done, kit }) {
    ensureStyle();
    let phase = 0, ans = null;
    const Q = [
      { code: `x = counts.float()\nx.to("mps")\nprint(x.device)`, task: "What does the last line print?",
        opts: ["cpu", "mps:0", "An error: x was already used"], right: 0,
        fb: [null,
          ["That is what most people expect. But <code>.to</code> does not change <code>x</code>. It returns a <b>new</b> tensor on the other device, and this line throws it away.", false],
          ["Nothing stops you from moving a tensor you used before. The line runs fine. The question is what it did to <code>x</code>.", false]] },
      { code: `x_gpu = x.to("mps")\n# do they share memory?\nx_gpu.data_ptr() == x.data_ptr()\nx.to("cpu") is x`, task: "What do the last two lines print? (<code>data_ptr()</code> is the address of a tensor's memory. <code>is</code> asks whether both sides are the very same object, like <code>===</code> on JS objects.)",
        opts: ["False, then True", "True, then True", "False, then False"], right: 0,
        fb: [null,
          ["The graphics chip has its own memory in PyTorch's view. Moving a tensor there copies every number into new memory, so the two tensors do not share it.", false],
          ["The first part is right: moving copies. But <code>x</code> is already on <code>cpu</code> with the same dtype, so there is nothing to do, and <code>.to</code> hands back <code>x</code> itself.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(phase, 1)];
      el.innerHTML = `<h1>Moving to the graphics chip</h1>
        <p class="lead">The model lives on <code>mps</code>: that is PyTorch's name for the Mac's graphics chip (GPU). <code>cuda</code> is another common device name. The input must go there too. The tool is <code>.to(device)</code>.</p>
        ${phase < 2 ? `${mono(kit, q.code)}<p class="task">${q.task}</p>` : `${mono(kit, Q[0].code + "   # " + DEV.afterBare)}${mono(kit, Q[1].code.replace("x.data_ptr()\n", `x.data_ptr()\n# printed: ${DEV.sameMemory ? "True" : "False"}\n`) + "   # " + (DEV.toCpuIsSelf ? "True" : "False"))}`}
        <div class="lpanel">${phase < 2 ? ask(kit, q.opts, q.right, ans, q.fb.map((f, i) => i === q.right ? ["", true] : f)) : ""}
        ${phase === 1 && ans == null ? kit.feedback(`Right: <code>${DEV.afterBare}</code>. The new tensor was made and dropped. Keep it: <code>x = x.to("mps")</code>.`, true) : ""}
        ${phase === 2 ? kit.feedback(`Right: ${DEV.sameMemory ? "True" : "False"}, then ${DEV.toCpuIsSelf ? "True" : "False"}. The PyTorch docs say it plainly: if the tensor already has the dtype and device you ask for, <code>.to</code> returns it; otherwise it returns a copy. So every move to another device is a copy of all the numbers, and it costs time each time you do it. Move data once, early, not inside a loop.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[phase].right) { phase++; ans = null; paint(); if (phase === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 4. Strides, transpose and the four view calls. */
  function views({ el, done, kit }) {
    ensureStyle();
    let phase = 0, ans = null;
    const vAns = VIEWS.map(() => null);
    const sOpts = [tup(T_STRIDE), tup([T_SHAPE[1] * T_SHAPE[2], T_SHAPE[2], 1]), tup([...STRIDE].reverse())];
    const sFb = [null,
      [`${tup([T_SHAPE[1] * T_SHAPE[2], T_SHAPE[2], 1])} is what a fresh tensor of shape ${tup(T_SHAPE)} would have. But transpose copies nothing: the numbers stay where they were, so the steps over them must change instead.`, false],
      ["That reverses all three. Transpose only swapped hours and days; the level step is untouched.", false]];
    // a view works if each new dimension splits one old dimension, or merges neighbours d..d+k with stride[i] = stride[i+1] * size[i+1]
    const vWhy = [
      `Fails. 168 would merge days and hours into one dimension. In <code>by_day</code> the day step is ${T_STRIDE[1]} and the hour step ${T_STRIDE[2]}; merging needs day step = hour step × ${T_SHAPE[2]} hours = ${T_STRIDE[2] * T_SHAPE[2]}, and ${T_STRIDE[1]} is not ${T_STRIDE[2] * T_SHAPE[2]}. No single step size walks those numbers in this order.`,
      `Works. It only splits the levels (${T_SHAPE[0]}) into 2 × 2 and leaves the rest alone. Splitting one dimension is always possible. Result strides: ${tup(VIEWS[1][3])}.`,
      `Fails, for the same reason as the first: one flat row has to merge days and hours, and their steps (${T_STRIDE[1]} and ${T_STRIDE[2]}) do not line up.`,
      `Works. It splits the hours (${T_SHAPE[2]}) into 4 × 6, a split inside one dimension. Result strides: ${tup(VIEWS[3][3])}.`
    ];
    const paint = () => {
      const allRight = VIEWS.every((v, i) => vAns[i] === (v[2] ? 0 : 1));
      el.innerHTML = `<h1>Transpose moves nothing</h1>
        <p class="lead">A tensor's numbers sit in one long row in memory. The <b>strides</b> say how far to jump in that row to move one step along each dimension. <code>counts</code> has shape ${tup(SHAPE)} and strides ${tup(STRIDE)}: next level = ${STRIDE[0]} numbers on (${SHAPE[1]} hours × ${SHAPE[2]} days), next hour = ${STRIDE[1]}, next day = ${STRIDE[2]}.</p>
        <p class="lead">The model wants each level as days × hours. <code>by_day = counts.transpose(1, 2)</code> swaps dimension 1 (hours) and dimension 2 (days), counting from 0. New shape: ${tup(T_SHAPE)}. It shares the memory of <code>counts</code>; no number moved.</p>
        ${phase === 0 ? `<p class="task">What are the strides of <code>by_day</code>?</p><div class="lpanel">${ask(kit, sOpts.map(s => opt(kit, s)), 0, ans, sFb.map((f, i) => i === 0 ? ["", true] : f))}</div>` : `
        ${kit.feedback(`Strides ${tup(T_STRIDE)}: the day and hour steps just swapped. The order of the numbers in memory no longer matches the order of the shape, so PyTorch calls <code>by_day</code> not <b>contiguous</b>.`, true)}
        <p class="lead"><code>.view(shape)</code> gives the same memory a new shape, without copying. It only works if new strides can describe it. Splitting one dimension into two always works. Merging two neighbouring dimensions into one works only if the outer step equals the inner step × the inner size (in <code>counts</code>: hour step ${STRIDE[1]} = day step ${STRIDE[2]} × ${SHAPE[2]} days, so hours and days can merge).</p>
        <p class="task">For each call on <code>by_day</code>: does it work? (Each keeps ${N} numbers. A <code>-1</code> means “work out this size”.)</p>
        ${VIEWS.map((v, i) => `<div class="lcase" id="c${i}"><p><code>${kit.esc(v[0])}</code></p>${kit.options(["Works", "Fails"], { picked: vAns[i], correct: v[2] ? 0 : 1 })}${vAns[i] == null ? "" : kit.feedback(vAns[i] === (v[2] ? 0 : 1) ? vWhy[i] : (v[2] ? `It works. ${vWhy[i].slice(7)}` : `It fails. ${vWhy[i].slice(7)}`), vAns[i] === (v[2] ? 0 : 1))}</div>`).join("")}
        ${allRight ? `${mono(kit, ERR_VIEW, true)}<p class="lx-${ID}-cap">Real output of the failing calls, our run</p>${kit.feedback("The rule: a view may split a dimension freely, but may merge neighbouring dimensions only when their steps line up. After a transpose they often do not.", true)}` : ""}`}`;
      if (phase === 0) el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; if (ans === 0) { phase = 1; ans = null; } paint(); });
      else el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        vAns[i] = +b.dataset.i; paint();
        if (VIEWS.every((v, j) => vAns[j] === (v[2] ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 5. reshape: a view when it can, a copy when it must. */
  function reshapeCopy({ el, done, kit }) {
    ensureStyle();
    let phase = 0, ans = null;
    const Q = [
      { code: `# counts is contiguous\nflat_a = counts.reshape(4, 168)\nprint(counts[0, 0, 0])   # ${MEM.aBefore}\nflat_a[0, 0] = ${MEM.aWrite}\nprint(counts[0, 0, 0])`,
        opts: [String(MEM.aAfter), String(MEM.aBefore)], right: MEM.aShares ? 0 : 1,
        fb: [null, ["<code>counts</code> is contiguous, so merging hours and days lines up: reshape can return a view, and here it did. A view shares memory, so writing into it writes into <code>counts</code>.", false]] },
      { code: `flat_b = counts.transpose(1, 2).reshape(4, 168)\nprint(counts[0, 1, 0])   # ${MEM.bBefore}\nflat_b[0, 1] = ${MEM.bWrite}         # day 0, hour 1\nprint(counts[0, 1, 0])`,
        opts: [String(MEM.bWrite), String(MEM.bAfter)], right: MEM.bShares ? 0 : 1,
        fb: [null, ["You just saw that this shape cannot be a view of the transposed tensor: <code>.view(4, 168)</code> failed. So reshape had to copy the numbers into new memory, and the write lands in the copy only.", false]] }
    ];
    const paint = () => {
      const q = Q[Math.min(phase, 1)];
      el.innerHTML = `<h1>reshape: view or copy?</h1>
        <p class="lead">The error said “Use .reshape(...) instead.” <code>reshape</code> returns a view when the strides allow it and a copy when they do not. Find out which one you got, by writing into the result. (These ran on a fresh copy of the counts.)</p>
        ${phase < 2 ? `${mono(kit, q.code)}<p class="task">What does the last line print?</p>` : `${mono(kit, Q[0].code + "   # " + MEM.aAfter)}${mono(kit, Q[1].code + "   # " + MEM.bAfter)}`}
        <div class="lpanel">${phase < 2 ? ask(kit, q.opts, q.right, ans, q.fb.map((f, i) => i === q.right ? ["", true] : f)) : ""}
        ${phase === 1 && ans == null ? kit.feedback(`Right: ${MEM.aAfter}. That reshape was a view, so <code>counts</code> changed too.`, true) : ""}
        ${phase === 2 ? kit.feedback(`Right: still ${MEM.bAfter}. Same call, different result: once a view, once a copy, decided by the strides. The PyTorch docs warn not to depend on which one you get. So: use <code>reshape</code> when you only read the result, and never rely on a write going through (or not). <code>torch.from_numpy</code> shares memory too: in our run, changing the NumPy array changed the tensor.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[phase].right) { phase++; ans = null; paint(); if (phase === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 6. The whole preparation as Python, a stepped replay of the traced run. */
  const FR = (() => {
    const fr = [{ ln: -1, vars: {}, next: TRACE[0][0] }];
    for (let k = 1; k < TRACE.length; k++) {
      if (TRACE[k][1] === "return") { fr.push({ ln: 6, vars: TRACE[k][2], end: true }); continue; }
      fr.push({ ln: TRACE[k - 1][0], vars: TRACE[k][2] });
    }
    return fr;
  })();
  const NEWVAR = { 1: "counts", 2: "by_day", 3: "rows", 4: "rows", 5: "rows", 6: "rows" };
  const SAY = {
    "-1": "The function gets the NumPy array and the device name. Step through it.",
    1: "<code>from_numpy</code> keeps NumPy's int64 and shares its memory. Contiguous, on the cpu.",
    2: "<code>permute(2, 0, 1)</code> puts the dimensions in a new order: old dimension 2 (days) first, then 0 (levels), then 1 (hours). Like transpose, it moves nothing: only the strides change, so it is not contiguous.",
    3: `<code>reshape(DAYS, -1)</code> joins levels and hours into one row per day. -1 means “work it out”: ${N} / ${SHAPE[2]} = ${N / SHAPE[2]}. Can levels and hours merge? Level step ${B0.stride[1]} = hour step ${B0.stride[2]} × ${B0.shape[2]} hours, so yes: this one was a view, not a copy.${ROWS_SHARES ? " Our run confirmed it shares the memory of <code>counts</code>." : ""}`,
    4: "<code>.float()</code> makes float32 (a new tensor), and dividing by the capacity turns counts into how full each level was, from 0 to 1.",
    5: "<code>.to(device)</code> copied the numbers to the graphics chip. Note the assignment: the result is kept.",
    6: `Returned: float32, on the device, one row per day. A layer <code>nn.Linear(${SHAPE[0] * SHAPE[1]}, 1)</code> (${SHAPE[0] * SHAPE[1]} inputs = ${SHAPE[0]} levels × ${SHAPE[1]} hours, 1 output) on the same device took it and gave shape ${tup(MODEL_OUT)}: one number per day.`
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      const v = f.ln > 0 ? f.vars[NEWVAR[f.ln]] : null;
      el.innerHTML = `<h1>The preparation in Python</h1>
        <p class="lead">Everything so far, as one function (<code>DAYS</code> = ${SHAPE[2]}, <code>CAPACITY</code> = ${CAPACITY}). Each step shows the tensor the line made: its dtype, shape, strides, whether it is contiguous, and its device. Recorded from a real run on a Mac.</p>
        <p class="task">Step through to the end. Watch which line changes which of the five facts.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${v ? `<span>${NEWVAR[f.ln]} <b>${v.dtype}</b></span><span>shape <b>${tup(v.shape)}</b></span><span>stride <b>${tup(v.stride)}</b></span><span>contiguous <b>${v.contiguous}</b></span><span>device <b>${v.device}</b></span>` : `<span>week_counts <b>numpy int64 ${tup(SHAPE)}</b></span>`}<span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(SAY[f.end ? 6 : f.ln])}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. Broken on purpose: three real error messages. */
  const DIAG = [
    { opts: ["day_np is float64 (Double) and the weights are float32 (Float); the input needs .float()", "The input has the wrong shape for 24 weights", "The model has not been trained yet"], right: 0,
      fb: [null, ["A shape problem names shapes. This message names two dtypes: Double is PyTorch's name for float64, Float for float32. The shape (1, 24) fits the 24 weights.", false],
        ["An untrained model still computes; its weights are just random. Training has nothing to do with this message.", false]] },
    { opts: ["This Mac has no mps device", "day was made on the cpu and never moved; the model's weights are on mps", "day is still float64"], right: 1,
      fb: [["The model moved to mps without complaint on the line before, so the device exists. The message says where each side is.", false], null,
        ["<code>.float()</code> already made it float32 on that line. The message is about place, not type.", false]] },
    { opts: ["LEVELS × -1 cannot hold all the numbers", "view only works on float tensors", "After the transpose, days and hours are out of order in memory, so no strides can merge them; use reshape"], right: 2,
      fb: [[`LEVELS is ${SHAPE[0]} and -1 means “work it out”: ${N} / ${SHAPE[0]} = ${N / SHAPE[0]}, and ${SHAPE[0]} × ${N / SHAPE[0]} = ${N}. The count fits. The problem is the order in memory.`, false],
        ["The view <code>by_day.view(2, 2, 7, 24)</code> worked on this same int64 tensor. dtype is not the issue.", false], null] }
  ];
  function broken({ el, done, kit }) {
    ensureStyle();
    const ans = DIAG.map(() => null);
    const paint = () => {
      const all = DIAG.every((d, i) => ans[i] === d.right);
      el.innerHTML = `<h1>Three real errors</h1>
        <p class="lead">Three lines from the operator's script, run on a Mac, and the messages PyTorch really printed. Read each message as a clue: it names what does not match. In the script, <code>LEVELS</code> = ${SHAPE[0]}, <code>HOURS</code> = ${SHAPE[1]}, <code>CAPACITY</code> = ${CAPACITY}.</p>
        <p class="task">Pick the cause of each error.</p>
        ${ERRORS.map((e, i) => `<div class="lcase" id="c${i}"><p><b>Error ${i + 1}</b></p>${mono(kit, e.code.join("\n"))}${mono(kit, e.msg, true)}
          ${kit.options(DIAG[i].opts.map(o => kit.esc(o)), { picked: ans[i], correct: DIAG[i].right })}
          ${ans[i] == null ? "" : ans[i] === DIAG[i].right ? kit.feedback(`Right. The fix, which ran without error: <code>${kit.esc(e.fix)}</code>`, true) : kit.feedback(DIAG[i].fb[ans[i]][0], false)}</div>`).join("")}
        ${all ? kit.feedback("Two of the three were the facts a tensor carries: dtype and device. The third was the memory order. All three messages named the mismatch; reading them closely beats guessing. (This device message is the wording on a Mac's mps device.)", true) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (DIAG.every((d, j) => ans[j] === d.right)) done();
      }));
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Memory: the week is int64",
      "Time: every step copies the whole week to the graphics chip again",
      "Correctness: the tensor is not contiguous"
    ];
    const fb = [
      [`The int64 counts become float32 inside the function anyway, and one week is only ${N} numbers. That is not what grows with the number of steps.`, false],
      ["Right. <code>.to(device)</code> copies every time it is called. Inside a training loop that is one copy per step, of data that never changed. Move it once, before the loop.", true],
      ["Not contiguous is not wrong: operations give correct results on non-contiguous tensors. Of the calls in this lesson, only <code>view</code> cared, and it said so with an error. Nothing here runs per step that needs it.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When tensors, when plain NumPy</h1>
        <p class="lead">A tensor is a NumPy-like array that also carries a dtype, a device and strides.</p>
        <p class="lead"><b>For:</b> numbers going into or out of a PyTorch model. <b>Reach for them</b> when a model will read the data, when it should run on a graphics chip, or when you need gradients (next lesson).</p>
        <p class="lead"><b>Not</b> for loading, cleaning, joining and counting: NumPy or pandas do that in fewer steps. Convert once, at the edge, right before the model.</p>
        <p class="lead"><b>Costs:</b> each move between devices copies all the numbers; float64 takes twice the memory of float32; a copy from <code>reshape</code> or <code>.contiguous()</code> costs memory; and dtype and device mistakes only show up when the code runs.</p>
        <p class="task">The operator's training loop runs <code>x = to_model_input(week_counts, "mps")</code> at the top of every step. Which cost bites?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["An orchard's scale logs each crate's weight as whole grams. A PyTorch model on the GPU will estimate ripeness from them. The crate weights arrive as a NumPy int64 array.", true,
      "Yes. A model will read them, so they need float32 (to match the weights) and the model's device, once, before training.",
      "The model's layers refuse int64 input against float32 weights, and refuse cpu input against GPU weights. This is exactly the conversion you did."],
    ["A library sums last month's loans per branch from a spreadsheet for a monthly report. No model is involved.", false,
      "No. Nothing here runs on a graphics chip or needs gradients. NumPy or pandas sum it directly; a tensor would add a conversion and a dtype to get wrong, and gain nothing.",
      "What a tensor adds is a device and a place in a model's math. A monthly sum uses neither, so converting only adds steps."],
    ["A sound model wants recordings as (clips, samples), but the loader gives (samples, clips). After transposing, the next line calls .view(-1) and crashes.", true,
      "Yes, the stride idea. The transpose left the numbers out of order for a flat view. Use reshape, or .contiguous() then view.",
      "This is the view error from earlier: transpose changes strides only, and view(-1) must merge dimensions whose steps no longer line up."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Tensor work, or not?</h1>
        <p class="lead">Three jobs from elsewhere. For each: does it need what this lesson covered (dtype, device, views and strides)?</p>
        <p class="task">Answer each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the notebook and its checklist. */
  const CHECK = [
    `<code>counts / 2</code> prints dtype <code>torch.float32</code>, while the same NumPy division gives <code>${NP_DIV}</code>`,
    "<code>counts.mean()</code> raises an error that ends in <code>Got: Long</code>; <code>counts.float().mean()</code> works",
    `<code>by_day.stride()</code> prints <code>${tup(T_STRIDE)}</code> and <code>by_day.is_contiguous()</code> prints <code>False</code>`,
    "<code>by_day.view(4, 168)</code> raises “view size is not compatible…”, and <code>by_day.reshape(4, 168)</code> works",
    "After a bare <code>x.to(device)</code> line, <code>x.device</code> still prints <code>device(type='cpu')</code>"
  ];
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can feed a model its tensors</h1>
      <p class="lead">You predicted PyTorch's dtypes, moved data to a device and kept the result, read strides to tell which views work, and fixed three errors from their messages.</p>
      ${NOTEBOOK_URL ? `<p><a class="btn lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook in Colab</a></p>` : ""}
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? "run the notebook." : "The notebook for this lesson is on its way."} When you run it, you should see (ticking is optional; on a machine without a graphics chip the device is <code>cpu</code> and the move does nothing):</p>
      <ul class="lx-${ID}-check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="lx-${ID}-k${i}"> <span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Tensors can also record the math done on them; next you let PyTorch use that record to compute gradients.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "What PyTorch tensors add to NumPy arrays",
    checked: "2026-11-13",
    sources: [
      "https://docs.pytorch.org/docs/2.15/tensor_attributes.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.view.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.reshape.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.from_numpy.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.to.html",
      "https://docs.pytorch.org/docs/2.15/notes/mps.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.get_default_dtype.html"
    ],
    interview: [
      {
        q: "Your training script runs on your laptop but on the GPU server it fails with a device error, and after you fix that, a teammate's data gives 'mat1 and mat2 must have the same dtype'. How do you make the input handling robust?",
        good: [
          "Read both messages: one names devices, the other dtypes (Double vs Float), so the input does not match the weights",
          "Convert in one place, right before the model: .float() (or the model's dtype) and .to(device), keeping the result",
          "Take the device from the model or from one config value instead of hard-coding it",
          "Move the data once, before the loop, not on every step",
          "Add a check or test that asserts the input dtype and device before training starts"
        ],
        weak: "Call model.double() or sprinkle .to() calls until it runs, without knowing which tensor was wrong or what each copy costs."
      },
      {
        q: "A teammate replaced every .reshape with .view 'for speed', and now one call crashes after a transpose. What happened, and what do you tell them?",
        good: [
          "Transpose and permute only change strides, so the tensor is no longer contiguous",
          "view never copies, so it fails when the new shape must merge dimensions whose steps do not line up",
          "reshape returns a view when it can and copies only when it must, so it is not slower when a view works",
          "Do not rely on whether reshape copied; do not write into the result expecting the original to change"
        ],
        weak: "Say view is buggy and add .contiguous() everywhere, which copies even where no copy was needed."
      }
    ],
    screens: [sixOps, spotIdea, devices, views, reshapeCopy, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: OPS.map(() => "[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...VIEWS.map((_, i) => `#c${i} [data-right]`)] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: ERRORS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
