/* Lesson: autograd. Story: the dumpling shop's delivery-wait network (from s3-backprop-by-hand) was 12 minutes
   short on Friday; re-check the blame numbers, this time with PyTorch keeping the receipts.
   Ideas: (1) mark the weights with requires_grad, run the forward pass, call loss.backward(): PyTorch recorded every
   operation as it ran (grad_fn) and walks that record backward, filling .grad on the leaves with the same numbers
   as the hand walk; (2) backward() ADDS into .grad, and a second backward on the same loss fails, so .grad must be
   cleared between checks (the broken-on-purpose screen).
   Data, all real, from runs on this Mac (PyTorch 2.15.0, CPU; see docs/ai-path/runs/s3-autograd/env.txt):
   - autograd.py + autograd.out.txt: the traced friday_blame() shown on the code screen, the table of tensors after
     backward (requires_grad, is_leaf, grad_fn, grad), the non-leaf .grad warning, the recorded graph walked back
     from loss, and hidden.retain_grad();
   - twice.py + twice.out.txt: backward twice on one loss (the error), forward + backward three times without
     clearing, the same with clearing, and retain_graph=True;
   - broken.py + broken.out.txt: the Friday-then-Tuesday check that never clears .grad, the swapped order, the fix;
   - edges.py + edges.out.txt: no requires_grad, torch.round before the loss, .numpy() in the middle, torch.no_grad().
   The weights, inputs and targets are those of s3-backprop-by-hand/backprop.py; the hand gradients are computed
   here by the same arithmetic. No model calls were recorded.
   Lesson-local style: a small table, a mono output block and a mono option label (.lx-s3-autograd-*), see
   ensureStyle(); the network picture uses kit.pics.graph. Plain browser script. */
(() => {
  const ID = "s3-autograd";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s3-autograd.ipynb";

  /* ---------- Data copied from the scripts ---------- */
  const W1 = [[2, 1], [1, 4]];   // row j = hidden unit j; column k = input k (orders in tens, rain 1/0)
  const B1 = [1, -2];
  const V = [2, 1];
  const C = 2;
  const FRIDAY = { inputs: [3, 1], actual: 35 };
  const TUESDAY = { inputs: [1, 0], actual: 14 };

  // friday_blame() from docs/ai-path/runs/s3-autograd/autograd.py, line for line (line 0 = def).
  const CODE = [
    "def friday_blame():",
    "    w1 = torch.tensor([[2.0, 1.0], [1.0, 4.0]], requires_grad=True)",
    "    b1 = torch.tensor([1.0, -2.0], requires_grad=True)",
    "    v = torch.tensor([2.0, 1.0], requires_grad=True)",
    "    c = torch.tensor(2.0, requires_grad=True)",
    "    orders_rain = torch.tensor(FRIDAY_ORDERS_RAIN)",
    "    hidden = torch.relu(w1 @ orders_rain + b1)",
    "    pred = v @ hidden + c",
    "    loss = 0.5 * (pred - FRIDAY_WAIT) ** 2",
    "    loss.backward()",
    "    return w1.grad, v.grad, c.grad"
  ];
  // autograd.out.txt, "trace of friday_blame()": [line that just ran, { name: [value, grad, grad_fn] }]
  const TRACE = [[1,{"w1":[[[2.0,1.0],[1.0,4.0]],null,null]}],[2,{"w1":[[[2.0,1.0],[1.0,4.0]],null,null],"b1":[[1.0,-2.0],null,null]}],[3,{"w1":[[[2.0,1.0],[1.0,4.0]],null,null],"b1":[[1.0,-2.0],null,null],"v":[[2.0,1.0],null,null]}],[4,{"w1":[[[2.0,1.0],[1.0,4.0]],null,null],"b1":[[1.0,-2.0],null,null],"v":[[2.0,1.0],null,null],"c":[2.0,null,null]}],[5,{"w1":[[[2.0,1.0],[1.0,4.0]],null,null],"b1":[[1.0,-2.0],null,null],"v":[[2.0,1.0],null,null],"c":[2.0,null,null],"orders_rain":[[3.0,1.0],null,null]}],[6,{"w1":[[[2.0,1.0],[1.0,4.0]],null,null],"b1":[[1.0,-2.0],null,null],"v":[[2.0,1.0],null,null],"c":[2.0,null,null],"orders_rain":[[3.0,1.0],null,null],"hidden":[[8.0,5.0],null,"ReluBackward0"]}],[7,{"w1":[[[2.0,1.0],[1.0,4.0]],null,null],"b1":[[1.0,-2.0],null,null],"v":[[2.0,1.0],null,null],"c":[2.0,null,null],"orders_rain":[[3.0,1.0],null,null],"hidden":[[8.0,5.0],null,"ReluBackward0"],"pred":[23.0,null,"AddBackward0"]}],[8,{"w1":[[[2.0,1.0],[1.0,4.0]],null,null],"b1":[[1.0,-2.0],null,null],"v":[[2.0,1.0],null,null],"c":[2.0,null,null],"orders_rain":[[3.0,1.0],null,null],"hidden":[[8.0,5.0],null,"ReluBackward0"],"pred":[23.0,null,"AddBackward0"],"loss":[72.0,null,"MulBackward0"]}],[9,{"w1":[[[2.0,1.0],[1.0,4.0]],[[-72.0,-24.0],[-36.0,-12.0]],null],"b1":[[1.0,-2.0],[-24.0,-12.0],null],"v":[[2.0,1.0],[-96.0,-60.0],null],"c":[2.0,-12.0,null],"orders_rain":[[3.0,1.0],null,null],"hidden":[[8.0,5.0],null,"ReluBackward0"],"pred":[23.0,null,"AddBackward0"],"loss":[72.0,null,"MulBackward0"]}]];
  const RETURN_LINE = 10;

  // autograd.out.txt, "receipts: every tensor after loss.backward()": [name, requires_grad, is_leaf, grad_fn, grad]
  const RECEIPTS = [["orders_rain", false, true, null, null], ["w1", true, true, null, [[-72.0, -24.0], [-36.0, -12.0]]],
    ["b1", true, true, null, [-24.0, -12.0]], ["v", true, true, null, [-96.0, -60.0]], ["c", true, true, null, -12.0],
    ["z", true, false, "AddBackward0", null], ["hidden", true, false, "ReluBackward0", null],
    ["pred", true, false, "AddBackward0", null], ["loss", true, false, "MulBackward0", null]];
  const GRAD_BEFORE = "w1.grad before backward: None";   // autograd.out.txt
  // autograd.out.txt, the warning printed when a non-leaf's .grad is read (trimmed with …)
  const NONLEAF_WARNING = "The .grad attribute of a Tensor that is not a leaf Tensor is being accessed. Its .grad attribute won't be populated during autograd.backward(). If you indeed want the .grad field to be populated for a non-leaf Tensor, use .retain_grad() on the non-leaf Tensor. …";
  const RETAINED_HIDDEN = [-24.0, -12.0];                // autograd.out.txt, "hidden.retain_grad() before backward"
  // autograd.out.txt, "the recorded graph, walked back from loss" (two spaces per level)
  const GRAPH = ["MulBackward0", "  PowBackward0", "    SubBackward0", "      AddBackward0", "        DotBackward0",
    "          AccumulateGrad", "          ReluBackward0", "            AddBackward0", "              MvBackward0",
    "                AccumulateGrad", "              AccumulateGrad", "        AccumulateGrad"];

  // twice.out.txt
  const TWICE_ERROR = "RuntimeError: Trying to backward through the graph a second time (or directly access saved tensors after they have already been freed). Saved intermediate values of the graph are freed when you call .backward() or autograd.grad(). Specify retain_graph=True if you need to backward through the graph a second time or if you need to access saved tensors after calling backward.";
  const AFTER_ERROR_W1 = [[-72.0, -24.0], [-36.0, -12.0]];                 // "after the error"
  const REPEAT_W1 = [[[-72.0, -24.0], [-36.0, -12.0]], [[-144.0, -48.0], [-72.0, -24.0]], [[-216.0, -72.0], [-108.0, -36.0]]]; // B, runs 1-3
  const REPEAT_C = [-12.0, -24.0, -36.0];
  const CLEARED_W1 = [[[-72.0, -24.0], [-36.0, -12.0]], [[-72.0, -24.0], [-36.0, -12.0]]];   // C, runs 1-2
  const RETAIN_W1 = [[-144.0, -48.0], [-72.0, -24.0]];                     // D

  // broken.py: check() and the loop, line for line
  const BROKEN_CODE = [
    "def check(day):",
    "    orders_rain, wait = days[day]",
    "    pred = v @ torch.relu(w1 @ torch.tensor(orders_rain) + b1) + c",
    "    loss = 0.5 * (pred - wait) ** 2",
    "    loss.backward()",
    "    match = w1.grad.tolist() == by_hand[day]",
    "    print(day, \"w1.grad\", w1.grad.tolist(), \"by hand\", by_hand[day], \"OK\" if match else \"MISMATCH\")",
    "",
    "for day in [\"friday\", \"tuesday\"]:",
    "    check(day)"
  ];
  const FIX_CODE = [
    "def check_fixed(day):",
    "    for p in (w1, b1, v, c):",
    "        p.grad = None",
    "    check(day)"
  ];
  // broken.out.txt, verbatim lines; the numbers used in feedback are parsed from them below
  const OUT_BROKEN = [
    "friday w1.grad [[-72.0, -24.0], [-36.0, -12.0]] by hand [[-72.0, -24.0], [-36.0, -12.0]] OK",
    "tuesday w1.grad [[-84.0, -24.0], [-36.0, -12.0]] by hand [[-12.0, 0.0], [0.0, 0.0]] MISMATCH"
  ];
  const OUT_SWAPPED = [
    "tuesday w1.grad [[-12.0, -0.0], [0.0, 0.0]] by hand [[-12.0, 0.0], [0.0, 0.0]] OK",
    "friday w1.grad [[-84.0, -24.0], [-36.0, -12.0]] by hand [[-72.0, -24.0], [-36.0, -12.0]] MISMATCH"
  ];
  const OUT_FIXED = [
    "friday w1.grad [[-72.0, -24.0], [-36.0, -12.0]] by hand [[-72.0, -24.0], [-36.0, -12.0]] OK",
    "tuesday w1.grad [[-12.0, -0.0], [0.0, 0.0]] by hand [[-12.0, 0.0], [0.0, 0.0]] OK"
  ];

  // edges.out.txt
  const NO_REQ_ERROR = "RuntimeError: element 0 of tensors does not require grad and does not have a grad_fn";
  const ROUND_W1 = [[0.0, 0.0], [0.0, 0.0]], ROUND_C = 0.0, ROUND_LOSS = 72.0;
  const NUMPY_ERROR = "RuntimeError: Can't call numpy() on Tensor that requires grad. Use tensor.detach().numpy() instead.";
  const NOGRAD = { pred: 23.0, requires_grad: false, grad_fn: "None" };

  /* ---------- The hand arithmetic, in the page ---------- */
  function forward(s) {
    const z = W1.map((row, j) => row[0] * s.inputs[0] + row[1] * s.inputs[1] + B1[j]);
    const h = z.map(t => Math.max(t, 0));
    const pred = V[0] * h[0] + V[1] * h[1] + C;
    return { z, h, pred, err: pred - s.actual, loss: 0.5 * (pred - s.actual) ** 2 };
  }
  function backward(s) {
    const f = forward(s);
    const dPred = f.err;
    const dV = f.h.map(t => dPred * t);
    const dH = V.map(t => dPred * t);
    const dZ = dH.map((t, j) => f.z[j] > 0 ? t : 0);
    const dW1 = dZ.map(d => s.inputs.map(x => d * x));
    return { f, dPred, dV, dC: dPred, dH, dZ, dW1, dB1: dZ };
  }
  const FR = backward(FRIDAY), TU = backward(TUESDAY);
  const parseGrad = line => JSON.parse(line.split(" w1.grad ")[1].split(" by hand ")[0]);
  const TU_SEEN = parseGrad(OUT_BROKEN[1]);
  const TORCH_W1 = TRACE[TRACE.length - 1][1].w1[1];
  const sameMat = (a, b) => a.every((r, i) => r.every((x, j) => x === b[i][j]));

  const num = x => { const r = Math.round(x * 1e6) / 1e6; return (r < 0 ? "−" : "") + String(Math.abs(r) === 0 ? 0 : Math.abs(r)); };
  const vec = a => `[${a.map(num).join(", ")}]`;
  const mat = m => `[${m.map(vec).join(", ")}]`;
  const show = x => x == null ? "None" : Array.isArray(x) ? (Array.isArray(x[0]) ? mat(x) : vec(x)) : num(x);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-t { width: 100%; max-width: 560px; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .lx-${ID}-t caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .lx-${ID}-t th { text-align: left; font: 600 13px var(--font); color: var(--muted); border-bottom: 1px solid var(--line); padding: 6px 8px 6px 0; }
      .lx-${ID}-t td { font: 500 14px var(--mono); color: var(--ink); border-bottom: 1px solid var(--line); padding: 7px 8px 7px 0; white-space: nowrap; }
      .lx-${ID}-t td:last-child { white-space: normal; overflow-wrap: anywhere; }
      .lx-${ID}-t tr.lx-${ID}-hit td { background: var(--good-soft); }
      .lx-${ID}-out { margin: 12px 0 0; padding: 10px 12px; border: 1px solid var(--line); background: var(--sunk); border-radius: 6px;
        font: 500 13.5px/1.55 var(--mono); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-out b { font-weight: 700; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-m { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-checks { list-style: none; padding: 0; margin: 12px 0 16px; display: grid; gap: 8px; }
      .lx-${ID}-checks label { display: flex; gap: 6px; align-items: center; min-height: 44px; padding: 4px 12px 4px 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); cursor: pointer; font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-checks input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 14px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -12px; }
      .lx-${ID}-wrap.lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + var(--ind, 4ch)); text-indent: calc(-1 * var(--ind, 4ch)); }
      .lx-${ID}-link { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); }
      .lx-${ID}-checks input:checked { background-color: var(--good); outline-color: var(--good); }
    `;
    document.head.appendChild(s);
  }
  function tbl(kit, head, rows, { title = "", hit = () => false } = {}) {
    return `<table class="lx-${ID}-t">${title ? `<caption>${kit.esc(title)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${hit(i) ? `lx-${ID}-hit` : ""}">${r.map(c => `<td>${kit.esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const out = (kit, lines, cap) => `<div class="lx-${ID}-out">${lines.map(l => kit.esc(l)).join("\n")}</div>${cap ? `<p class="lx-${ID}-cap">${kit.esc(cap)}</p>` : ""}`;
  /* kit.code, but long lines wrap with a hanging indent instead of scrolling sideways on a phone. */
  const codeW = (kit, lines, active = -1) => `<pre class="lcode lx-${ID}-wrap">${lines.map((c, j) =>
    `<div${j === active ? ' class="on"' : ""} style="--ind:${c.match(/^ */)[0].length + 4}ch">${kit.esc(c) || " "}</div>`).join("")}</pre>`;
  const mono = (kit, s) => `<span class="lx-${ID}-m">${kit.esc(s)}</span>`;

  function net(kit, title) {
    const f = FR.f;
    const nodes = [
      { id: "x1", x: 0, y: 0.5 }, { id: "x2", x: 0, y: 1.5 },
      { id: "h1", x: 1, y: 0 }, { id: "h2", x: 1, y: 2 },
      { id: "p", label: "pred", x: 2, y: 1 }, { id: "L", x: 3, y: 1 }
    ];
    const edges = [["x1", "h1", "w11=" + num(W1[0][0])], ["x2", "h1", "w12=" + num(W1[0][1])], ["x1", "h2", "w21=" + num(W1[1][0])],
      ["x2", "h2", "w22=" + num(W1[1][1])], ["h1", "p", "v1=" + num(V[0])], ["h2", "p", "v2=" + num(V[1])], ["p", "L"]];
    const notes = { x1: num(FRIDAY.inputs[0]), x2: num(FRIDAY.inputs[1]), h1: num(f.h[0]), h2: num(f.h[1]), p: num(f.pred), L: num(f.loss) };
    return kit.pics.graph(nodes, edges, { directed: true, notes, title });
  }

  const ask = (kit, opts, correct, picked, fbs) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;

  /* A sequence of questions on one screen: steps = [{ q, opts, right, fb, after }]. */
  function sequence({ el, done, kit }, head, steps, extra) {
    let k = 0, ans = null;
    const paint = () => {
      const fin = k >= steps.length;
      const st = steps[Math.min(k, steps.length - 1)];
      el.innerHTML = `${head(k)}
        ${steps.slice(0, k).map(s => typeof s.after === "function" ? s.after() : kit.feedback(s.after, true)).join("")}
        ${fin ? (extra ? extra() : "") : `<p class="task">${st.q}</p><div class="lpanel">${ask(kit, st.opts, st.right, ans, st.fb)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === steps[k].right) { k++; ans = null; paint(); if (k >= steps.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 1. The situation, and the gradients by hand. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    const f = FR.f;
    const Q = [
      { q: "dL/dc, the output bias", right: 1,
        opts: [num(-FR.dC), num(FR.dC), num(f.loss), "1"],
        fb: [[`The size is right, the sign is not. pred − actual = ${num(f.pred)} − ${num(FRIDAY.actual)} = ${num(f.err)}, and c moves pred one for one, so the slope stays negative: raising c would shrink the miss.`, false], null,
          [`${num(f.loss)} is the loss itself. The gradient is how fast the loss changes when c moves: dL/dpred = pred − actual, times dpred/dc = 1.`, false],
          [`1 is only the local slope dpred/dc. Multiply it by the slope arriving at pred, pred − actual = ${num(f.err)}.`, false]] },
      { q: "dL/dv2, the weight from h2 to pred", right: 2,
        opts: [num(FR.dV[0]), num(FR.dPred), num(FR.dV[1]), num(-FR.dV[1])],
        fb: [[`${num(FR.dV[0])} is v1's: ${num(f.err)} × h1. v2 multiplies h2 = ${num(f.h[1])}.`, false],
          [`${num(FR.dPred)} is the slope at pred. One more factor: pred moves by h2 = ${num(f.h[1])} per unit of v2.`, false], null,
          [`The sign flipped. The slope at pred is ${num(f.err)} and h2 = ${num(f.h[1])} is positive, so the product is negative.`, false]] },
      { q: "dL/dw12, the weight from x2 (rain) into h1", right: 0,
        opts: [num(FR.dW1[0][1]), num(FR.dW1[0][0]), num(FR.dW1[1][0]), num(FR.dW1[1][1])],
        fb: [null,
          [`${num(FR.dW1[0][0])} is w11's: the slope at z1 (${num(FR.dZ[0])}) times x1 = ${num(FRIDAY.inputs[0])}. w12 multiplies x2 = ${num(FRIDAY.inputs[1])}.`, false],
          [`${num(FR.dW1[1][0])} is w21's: it feeds h2, so it gets the slope at z2 (${num(FR.dZ[1])}) times x1. w12 feeds h1.`, false],
          [`${num(FR.dW1[1][1])} is w22's: slope at z2 times x2. w12 goes into h1, whose slope is ${num(FR.dZ[0])}.`, false]] }
    ];
    const ans = Q.map(() => null);
    const paint = () => {
      const all = Q.every((q, i) => ans[i] === q.right);
      el.innerHTML = `<h1>Twelve minutes short, checked again</h1>
        <p class="lead">The dumpling shop's tiny network promised a ${num(f.pred)}-minute wait last Friday (30 orders, raining). The real wait was ${num(FRIDAY.actual)}. Last lesson you pushed that miss backward by hand and got a gradient, a blame number, for every weight. The shop wants those numbers double-checked before anyone trains on them, this time by PyTorch. Training any network needs these gradients, and for a real network nobody works them out by hand: the library does it. This lesson shows how, and how to check it.</p>
        ${net(kit, `Friday: x1 = orders in tens, x2 = rain; hidden ReLU units; L = ½(pred − actual)² = ${num(f.loss)}`)}
        <p class="lead">Biases: h1 ${num(B1[0])}, h2 ${num(B1[1])}, output c = ${num(C)}. Both hidden units are positive, so ReLU passes slopes through unchanged.</p>
        <p class="task">Write down your three hand gradients first, so you have something to check PyTorch against.</p>
        ${Q.map((q, i) => `<div class="lcase" id="c${i}"><p>${q.q}</p>${ans[i] === q.right ? kit.options(q.opts, { picked: ans[i], correct: q.right }) : ask(kit, q.opts, q.right, ans[i], q.fb)}</div>`).join("")}
        ${all ? kit.feedback(`Those are your receipts: dL/dc = ${num(FR.dC)}, dL/dv2 = ${num(FR.dV[1])}, dL/dw12 = ${num(FR.dW1[0][1])}. Writing them down took a chain of multiplications per weight. Next, PyTorch does the same job.`, true) : ""}`;
      el.querySelectorAll(".lcase").forEach((cs, i) => cs.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (Q.every((q, j) => ans[j] === q.right)) done();
      }));
    };
    paint();
  }

  /* 2. The same network in PyTorch: predict, then step through the real run. */
  const FRAMES = [...TRACE.map(([ln, vars]) => ({ ln, vars })), { ln: RETURN_LINE, vars: TRACE[TRACE.length - 1][1], end: true }];
  const NEW_AT = { 1: "w1", 2: "b1", 3: "v", 4: "c", 5: "orders_rain", 6: "hidden", 7: "pred", 8: "loss" };
  function sayFrame(kit, f) {
    const v = f.vars;
    if (f.end) {
      const ok = sameMat(v.w1[1], FR.dW1) && v.c[1] === FR.dC && v.v[1][1] === FR.dV[1];
      return `The function returns the gradients. Your hand numbers: dL/dc ${num(FR.dC)}, dL/dv2 ${num(FR.dV[1])}, dL/dw12 ${num(FR.dW1[0][1])}. PyTorch's: <code>c.grad</code> ${num(v.c[1])}, <code>v.grad[1]</code> ${num(v.v[1][1])}, <code>w1.grad[0][1]</code> ${num(v.w1[1][0][1])}. ${ok ? "All of them match, and so does the rest of w1.grad: " + kit.esc(mat(v.w1[1])) + "." : ""}`;
    }
    const n = NEW_AT[f.ln], t = v[n];
    if (f.ln <= 4) return `<code>${n}</code> = ${kit.esc(show(t[0]))}. <code>requires_grad=True</code> asks PyTorch to track every result computed from it. Its <code>.grad</code> is still None.`;
    if (f.ln === 5) return `<code>orders_rain</code> = ${kit.esc(show(t[0]))}: Friday's inputs. No <code>requires_grad</code>: nobody will change the orders, so PyTorch tracks nothing for it.`;
    if (f.ln <= 8) return `<code>${n}</code> = ${kit.esc(show(t[0]))}, the same as your forward pass. It also carries <code>grad_fn = ${kit.esc(t[2])}</code>: a note of the operation that made it.`;
    return `One call. <code>w1.grad</code> is now ${kit.esc(show(v.w1[1]))}, <code>b1.grad</code> ${kit.esc(show(v.b1[1]))}, <code>v.grad</code> ${kit.esc(show(v.v[1]))}, <code>c.grad</code> ${kit.esc(show(v.c[1]))}. You wrote no backward code.`;
  }
  function asCode(ctx) {
    const { el, done, kit } = ctx;
    ensureStyle();
    let i = 0, ans = null;
    const opts = [
      "None: .grad stays empty until you read it",
      mono(kit, mat(TORCH_W1)) + ", the hand numbers",
      `${num(FR.f.loss)} in every cell: the loss, copied to each weight`,
      mono(kit, mat(W1)) + ": the weights themselves"
    ];
    const fb = [
      [`.grad is not filled on reading. It is filled by <code>loss.backward()</code> on line 9, and before that it really is None (the run printed <code>${kit.esc(GRAD_BEFORE)}</code>).`, false],
      ["Right. Step through and watch it happen on line 9.", true],
      [`The loss is one number for the whole network. Each weight gets its own share of the blame, and the shares differ: you found ${num(FR.dV[1])} for v2 and ${num(FR.dW1[0][1])} for w12.`, false],
      [".grad holds the slope of the loss with respect to the weight, not the weight's value. The weights do not change at all here; nothing updates them.", false]
    ];
    const paint = () => {
      const fr = FRAMES[i];
      el.innerHTML = `<h1>The same network in PyTorch</h1>
        <p class="lead">This function builds Friday's network from tensors, runs it forward and calls <code>loss.backward()</code>. <code>FRIDAY_ORDERS_RAIN</code> is [3.0, 1.0] and <code>FRIDAY_WAIT</code> is 35.0. We ran it and recorded every variable after each line.</p>
        <p class="task">Predict what <code>w1.grad</code> holds after line 9, then step through to the end.</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>
        ${codeW(kit, CODE, fr.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>line <b>${fr.ln}</b></span><span>w1.grad <b>${kit.esc(show(fr.vars.w1[1]))}</b></span><span>c.grad <b>${fr.vars.c ? kit.esc(show(fr.vars.c[1])) : "not made yet"}</b></span><span>frame <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, fr))}`;
      const check = () => { if (ans === 1 && i === FRAMES.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); check(); });
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); check(); };
    };
    paint();
  }

  /* 3. Spot the idea: the receipts are a graph recorded during the forward pass. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "It nudged each weight a little and measured how much the loss moved",
      "It read the Python source of your forward pass and differentiated the formula",
      "While the forward pass ran, each operation left a note of what it did and kept the values it needs; backward() walks those notes from the loss back to the weights, multiplying local slopes",
      "It looked the gradients up in a table of known networks"
    ];
    const fb = [
      [`That is the gradient check from last lesson: two forward passes per weight, and the answer comes out close, not exact. PyTorch returned exactly ${num(FR.dW1[0][0])} for w11 after one forward and one backward pass.`, false],
      ["PyTorch never sees your source code. It records operations as they run, so if a Python <code>if</code> picks one branch, only that branch is in the record. The docs put it as “what you run is what you differentiate”.", false],
      null,
      ["There is no such table. Change one weight and the gradients change; they are computed fresh for every run.", false]
    ];
    fb[2] = [`Right. That record is the <b>computation graph</b>, and following it backward is <b>automatic differentiation</b>, autograd for short. Read the printout from the top: <code>MulBackward0</code> is the ½·, <code>PowBackward0</code> the square, <code>SubBackward0</code> the “− 35”, then the “+ c”, the <code>v @ hidden</code>, the ReLU, the “+ b1” and the <code>w1 @ orders_rain</code>. Each <code>AccumulateGrad</code> is a weight you marked with <code>requires_grad</code>: the place where a gradient is written into its <code>.grad</code>. It is your hand walk, done by the library. The graph is built again on every forward pass.`, true];
    const paint = () => {
      el.innerHTML = `<h1>Where did the receipts come from?</h1>
        <p class="lead">You wrote only the forward pass, yet PyTorch produced every gradient, exactly. Each result (<code>hidden</code>, <code>pred</code>, <code>loss</code>) carried a <code>grad_fn</code> note. Our run started at <code>loss.grad_fn</code> and followed each note back to the notes it was made from. Each indent is one step further back from the loss:</p>
        ${out(kit, GRAPH)}
        <p class="task">How did PyTorch get the gradients without a backward function from you?</p>
        <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 4. Which tensors get a .grad: leaves only. */
  function receipts(ctx) {
    const { kit } = ctx;
    ensureStyle();
    const leaves = RECEIPTS.filter(r => r[4] != null).map(r => r[0]);
    const nonLeaves = RECEIPTS.filter(r => !r[2]).map(r => r[0]);
    const noReq = RECEIPTS.filter(r => !r[1]).map(r => r[0]);
    const table = () => tbl(kit, ["tensor", "is_leaf", "grad_fn", ".grad"],
      RECEIPTS.map(r => [r[0], r[2] ? "True" : "False", r[3] || "None", show(r[4])]),
      { title: `Our run, after loss.backward(). requires_grad is True for all but ${noReq.join(", ")}.`, hit: i => RECEIPTS[i][4] != null });
    const steps = [
      { q: "After <code>loss.backward()</code>, which tensors have a <code>.grad</code> filled in?", right: 1,
        opts: ["All of them, including orders_rain and loss",
          `Only the ones you created with requires_grad=True: ${leaves.join(", ")}`,
          `Every tensor that requires grad, so also ${nonLeaves.join(", ")}`,
          "Only loss, since backward() was called on it"],
        fb: [[`<code>orders_rain</code> was made without <code>requires_grad</code>, so nothing was tracked for it and it gets no gradient. You never asked how the loss depends on Friday's orders; you cannot change them.`, false], null,
          [`${nonLeaves.join(", ")} do require grad, but they are in-between results: each was made by an operation and has a <code>grad_fn</code>. Their slopes are computed on the way back, used, and not kept.`, false],
          ["backward() starts at loss, but it writes into the tensors at the far end of the graph, the ones you made yourself. loss.grad stays None.", false]],
        after: () => `${kit.feedback(`Right. A tensor you create yourself is a <b>leaf</b> of the graph. A tensor made by an operation is not a leaf. Only leaves with <code>requires_grad=True</code> get <code>.grad</code>. The table shows our run:`, true)}${table()}<p class="lead">When our script read the in-between tensors' <code>.grad</code>, PyTorch printed a warning:</p>${out(kit, [NONLEAF_WARNING])}` },
      { q: `You are debugging and want the slope that arrived at <code>hidden</code>, the ${vec(FR.dH)} you found by hand last lesson. What do you do?`, right: 0,
        opts: ["Call hidden.retain_grad() before loss.backward(), then read hidden.grad",
          "Read hidden.grad after loss.backward()",
          "Call hidden.backward() instead of loss.backward()"],
        fb: [null,
          ["That is exactly what printed the warning above: hidden.grad is None. It is not a leaf, so its slope is used and dropped.", false],
          ["hidden has two numbers, and backward() without arguments only works on a single number, such as the loss. Even with an extra argument, the walk would start at hidden, so it would not give the loss's slope.", false]],
        after: kit.feedback(`Right. Our run with <code>hidden.retain_grad()</code> printed <code>hidden.grad</code> = ${kit.esc(vec(RETAINED_HIDDEN))}, the same as your hand numbers ${kit.esc(vec(FR.dH))}.`, true) }
    ];
    sequence(ctx, () => `<h1>Who gets a receipt?</h1>
      <p class="lead">Nine tensors took part in Friday's run: the input <code>orders_rain</code>, the four you marked with <code>requires_grad=True</code>, and the in-between results <code>z</code> (before ReLU), <code>hidden</code>, <code>pred</code> and <code>loss</code>.</p>`, steps);
  }

  /* 5. Predict what calling backward twice does. */
  function twice(ctx) {
    const { kit } = ctx;
    ensureStyle();
    const g = REPEAT_W1.map(m => m[0][0]);
    const steps = [
      { q: `You run the forward pass again with the same <code>w1</code>, <code>b1</code>, <code>v</code>, <code>c</code>, and call <code>loss.backward()</code> again. You never touch <code>.grad</code>. What is <code>w1.grad[0][0]</code> now? (It was ${num(g[0])}.)`, right: 1,
        opts: [num(g[0]), num(g[1]), "0", "An error"],
        fb: [[`That expects backward() to replace the old gradient. It does not replace it: it adds to it.`, false], null,
          ["Nothing cancels. Both runs have the same inputs and the same weights, so both produce the same negative slope.", false],
          ["A new forward pass builds a new graph, so a new backward() works. The question is what it does to the number already sitting in .grad.", false]],
        after: kit.feedback(`Right. Three runs in a row printed <code>w1.grad[0][0]</code> = ${g.map(num).join(", ")} and <code>c.grad</code> = ${REPEAT_C.map(num).join(", ")}. backward() <b>adds</b> into <code>.grad</code>. The PyTorch docs say so: it “accumulates gradients in the leaves”, and you “might need to zero .grad attributes or set them to None” first. With <code>.grad</code> set to None before each run, both runs printed ${kit.esc(mat(CLEARED_W1[1]))}.`, true) },
      { q: `Now no new forward pass: you call <code>loss.backward()</code> a second time on the same <code>loss</code>. What happens?`, right: 1,
        opts: [`w1.grad[0][0] becomes ${num(g[1])}`, "An error", `w1.grad[0][0] stays ${num(g[0])}, nothing happens`, "w1.grad is reset to 0"],
        fb: [[`That happens only if you passed <code>retain_graph=True</code> to the first call: our run printed ${kit.esc(mat(RETAIN_W1))}. By default, the first backward throws away the values it saved, so there is nothing left to walk.`, false], null,
          ["PyTorch does not ignore it quietly. Think about what the graph needs for the walk back, such as hidden's values for the ReLU's slope, and whether it still has them.", false],
          ["backward() never clears anything. Clearing is your job. Later, the optimizer (the object that updates the weights) does it for you.", false]],
        after: () => `${kit.feedback("Right. Our run raised this:", true)}${out(kit, [TWICE_ERROR])}<p class="lead">The first backward frees the values that the forward pass saved. <code>w1.grad</code> was untouched by the failed call: it stayed ${kit.esc(mat(AFTER_ERROR_W1))}. You almost never need <code>retain_graph=True</code>; a new forward pass builds a fresh graph.</p>` }
    ];
    sequence(ctx, () => `<h1>Call backward() twice</h1>
      <p class="lead">One run left <code>w1.grad</code> at ${kit.esc(mat(REPEAT_W1[0]))}, matching your hand walk. What does a second backward do to it?</p>`, steps);
  }

  /* 6. Broken on purpose: Tuesday's check fails. */
  function broken(ctx) {
    const { kit } = ctx;
    ensureStyle();
    const tz = TU.f.z;
    const extra = TU_SEEN[0][0] - TU.dW1[0][0];
    const steps = [
      { q: "Tuesday's line says MISMATCH. What is the cause?", right: 2,
        opts: ["Tuesday's hand numbers are wrong: w21 and w22 cannot be 0",
          "PyTorch's ReLU let blame through to h2 on Tuesday",
          "w1.grad still held Friday's gradient, and Tuesday's was added on top",
          "Tuesday's loss was computed with Friday's wait of 35"],
        fb: [[`They are right. On Tuesday z2 = ${num(W1[1][0])}·${num(TUESDAY.inputs[0])} + ${num(W1[1][1])}·${num(TUESDAY.inputs[1])} + (${num(B1[1])}) = ${num(tz[1])}, below zero, so h2's ReLU is off and passes no blame to w21 and w22.`, false],
          [`Look at the numbers, not the ReLU: the wrong cells, ${num(TU_SEEN[1][0])} and ${num(TU_SEEN[1][1])}, are exactly Friday's w21 and w22. That is a leftover, not new blame.`, false], null,
          [`A different wait would change the size of Tuesday's slopes, but h2 is off on Tuesday whatever the wait, so w21 and w22 would still get 0. And the code reads <code>wait</code> from <code>days[day]</code>.`, false]],
        after: kit.feedback(`Right. ${num(TU_SEEN[0][0])} = ${num(FR.dW1[0][0])} (Friday) + ${num(TU.dW1[0][0])} (Tuesday), and the other three cells are Friday's unchanged. Nothing crashed: the check only caught it because you had hand numbers to compare with. In a training run nothing would print MISMATCH; the updates would just be wrong.`, true) },
      { q: "Which change fixes the check?", right: 1,
        opts: ["Check Tuesday first, then Friday",
          "Set each weight's .grad to None at the start of every check",
          "Call loss.backward(retain_graph=True)",
          `Add ${num(-extra)} to Tuesday's w1.grad[0][0]`],
        fb: [[`We ran that too. Tuesday passed, then Friday failed with ${kit.esc(show(parseGrad(OUT_SWAPPED[1])))}: the leftover just moved to the second day.`, false], null,
          ["retain_graph keeps the graph for a second backward on the same loss. It does not clear .grad, and the second day would still be added on top.", false],
          [`That fixes one cell of four: w21 and w22 would still show Friday's ${num(TU_SEEN[1][0])} and ${num(TU_SEEN[1][1])}. And any other order or a third day needs a new patch. Remove the leftover at its source.`, false]],
        after: () => `${kit.feedback("Right. Our fixed run clears every leaf's <code>.grad</code> first:", true)}${codeW(kit, FIX_CODE, 2)}${out(kit, OUT_FIXED)}<p class="lead">Setting <code>.grad</code> to None (or zeroing it) is how you start a fresh sum. In a training loop, the optimizer's <code>zero_grad()</code> does this for every weight. By default it sets each <code>.grad</code> to None.</p>` }
    ];
    sequence(ctx, () => `<h1>Broken on purpose: Tuesday fails</h1>
      <p class="lead">A teammate extends the check to two days. Tuesday was 10 orders, dry, with a real wait of ${num(TUESDAY.actual)} minutes. The same four weight tensors are reused for both days, and <code>by_hand</code> holds the gradients from the hand walk. Our run of this code:</p>
      ${codeW(kit, BROKEN_CODE, 4)}
      ${out(kit, OUT_BROKEN)}`, steps);
  }

  /* 7. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Run each estimate inside a with torch.no_grad(): block",
      "Keep requires_grad=True: tracking is free when you never call backward()",
      "Call backward() after each estimate so the gradients stay current",
      "Set .grad to None after each estimate"
    ];
    const fb = [
      [`Right. Under <code>torch.no_grad()</code> our run gave the same estimate, ${num(NOGRAD.pred)}, with <code>requires_grad</code> ${NOGRAD.requires_grad ? "True" : "False"} and <code>grad_fn</code> ${kit.esc(NOGRAD.grad_fn)}: nothing recorded. The docs say it reduces memory use for work that would otherwise track gradients, and is meant for inference, when you will not call backward().`, true],
      ["It is not free. Every operation on a tracked tensor builds a graph node and keeps the values its backward step would need, even if backward never comes.", false],
      ["Serving estimates needs no gradients at all: nobody trains on them. Each backward would cost time and add into .grad for nothing.", false],
      [".grad is never filled if backward() is never called, so clearing it changes nothing. The cost is the recording during the forward pass.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When autograd is the right tool</h1>
        <p class="lead"><b>For:</b> exact gradients of any loss built from PyTorch operations, without writing backward code. <b>Reach for it</b> whenever you train, and to check a hand derivation. <b>Not</b> when you only run the model to get answers: then switch tracking off. <b>Not</b> through steps it cannot see or that have no slope: a NumPy step breaks the chain, and rounding gives zero gradients.</p>
        <p class="lead"><b>Costs:</b> memory, because values saved in the forward pass are kept until backward; one backward pass of extra compute; and a gradient that silently adds up if you forget to clear it.</p>
        <p class="task">The trained network now serves wait estimates to every customer, and nobody trains on them. Which change fits?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 8. Recognise it: does autograd give a useful gradient? */
  const cases = kit => [
    ["A house-price model's loss charges a price guessed too high twice as much as one guessed too low. It is written with ordinary PyTorch operations on the prediction and the real price.", true,
      "Yes. Every step is a PyTorch operation on tracked tensors, so each one leaves a note and backward() walks through all of them. No backward code to write.",
      "Each operation in that loss is recorded as it runs, like the ½, the square and the subtraction in Friday's loss. backward() handles any chain of them, so you get exact gradients for free."],
    ["A cinema model predicts seats sold. Before the loss, the prediction is rounded with torch.round, since half a seat makes no sense.", false,
      `No. We tried the same rounding on the dumpling network: loss ${num(ROUND_LOSS)}, but <code>w1.grad</code> ${mono(kit, mat(ROUND_W1))} and <code>c.grad</code> ${num(ROUND_C)}. Rounding is flat between whole numbers, so its slope is 0 and every gradient behind it is 0. Round only for display, after the loss.`,
      `Autograd runs, but the answer is useless: the same rounding on the dumpling network gave all-zero gradients (<code>c.grad</code> ${num(ROUND_C)}) with the loss still at ${num(ROUND_LOSS)}. Rounding is flat between whole numbers, so its slope is 0 and nothing reaches the weights.`],
    ["A text model turns its hidden values into a NumPy array in the middle of the forward pass, does a lookup, and turns the result back into a tensor.", false,
      `No. Autograd only sees PyTorch operations. On the dumpling network our run stopped at once: <code>${mono(kit, NUMPY_ERROR)}</code> The fix the message offers, <code>.detach()</code>, cuts the chain, so the weights before that point get no blame. Do the lookup with a PyTorch operation.`,
      `On the dumpling network our run raised: <code>${mono(kit, NUMPY_ERROR)}</code> NumPy is outside the record, so the chain from loss back to w1 would be cut. Keep every step in PyTorch.`],
    ["A weather app's model takes an extra Python branch, if snowing: …, that adds a snow unit; on other days it skips it.", true,
      "Yes. The graph is recorded as the code runs, so each forward pass records only the branch that ran, and backward() follows that one. The docs: “what you run is what you differentiate”.",
      "Autograd does not need the code to be the same every time. It records what actually ran on this pass and differentiates that, rebuilding the graph on each forward pass."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const CASES = cases(kit);
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Will the receipts add up?</h1>
        <p class="lead">Four other teams' models. Autograd gives useful gradients when every step from the weights to the loss is a recorded PyTorch operation with a slope.</p>
        <p class="task">Will <code>loss.backward()</code> give the weights a useful gradient? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next: the notebook and its checklist. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    const items = [
      `<code>w1.grad</code> prints None before <code>loss.backward()</code>.`,
      `After one backward, <code>w1.grad</code> is ${kit.esc(mat(TORCH_W1))} and <code>c.grad</code> is ${num(TRACE[TRACE.length - 1][1].c[1])}: your hand numbers.`,
      `<code>hidden.grad</code> is None, with a warning about non-leaf tensors, until you call <code>hidden.retain_grad()</code>; then it is ${kit.esc(vec(RETAINED_HIDDEN))}.`,
      `A second <code>loss.backward()</code> on the same loss raises “Trying to backward through the graph a second time”.`,
      `Forward and backward again without clearing: <code>w1.grad[0][0]</code> goes ${REPEAT_W1.map(m => num(m[0][0])).join(", ")}.`,
      `With <code>.grad</code> set to None before each day, Tuesday's <code>w1.grad</code> matches the hand numbers (it may print <code>-0.0</code> in one cell; that equals 0).`
    ];
    el.innerHTML = `<h1>PyTorch keeps the receipts</h1>
      <p class="lead">You marked the weights with <code>requires_grad</code>, let PyTorch record the forward pass, and got your hand gradients back from one <code>loss.backward()</code>. You saw that only leaves keep a <code>.grad</code>, that backward adds into it, and you found the leftover that broke Tuesday's check.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-link" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the Colab notebook</a> and run the same code.` : "The notebook for this lesson is on its way. When it arrives, run the same code and tick what you see."}</p>
      <p class="lead"><b>What you should see</b> (ticking is optional):</p>
      <ul class="lx-${ID}-checks">${items.map(t => `<li><label><input type="checkbox"><span>${t}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You put backward() into a loop with batches, clearing the gradients and updating the weights on every step.</p>` : ""}`;
    done();
  }

  const seqWalk = n => ({ wrong: ["[data-wrong]"], right: Array(n).fill("[data-right]") });

  LessonKit.define(ID, {
    title: "Autograd: let PyTorch do the backward pass",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/notes/autograd.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.backward.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.Tensor.is_leaf.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.no_grad.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.Optimizer.zero_grad.html"
    ],
    interview: [
      {
        q: "A colleague's training loop has no zero_grad call. The loss falls for a few steps, then the updates grow and it blows up. Explain what is going on.",
        good: [
          "backward() adds into each weight's .grad; it never replaces it",
          "Without clearing, every step's gradient is the sum of all earlier steps', so the updates keep growing",
          "Clear before each backward: optimizer.zero_grad(), or set .grad to None",
          "Check it on a tiny case: two backward passes give double the gradient"
        ],
        weak: "Lower the learning rate. That shrinks the symptom but the gradients still pile up from every earlier step."
      },
      {
        q: "A teammate's custom loss trains nothing: after backward, every weight's gradient is exactly zero. What do you check?",
        good: [
          "Zero, not None, means the chain reached the weights but a step on the way has slope zero",
          "Look for flat steps between the weights and the loss: rounding, floor, or a clamp that always sits at its limit",
          "Contrast: a step outside PyTorch (NumPy, .item(), detach) cuts the chain, which gives an error or a .grad of None, not zeros",
          "Follow grad_fn from the loss backward, or retain_grad on in-between tensors, to see where the slope becomes zero",
          "Compare one gradient with a two-way nudge of one weight"
        ],
        weak: "Train longer or use a bigger learning rate. A zero gradient times any learning rate is still zero."
      }
    ],
    screens: [byHand, asCode, spotIdea, receipts, twice, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(FRAMES.length - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      seqWalk(2),
      seqWalk(2),
      seqWalk(2),
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: [0, 1, 2, 3].map(i => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
