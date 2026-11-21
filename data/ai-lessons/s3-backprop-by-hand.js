/* Lesson: backpropagation by hand on a 2-2-1 ReLU network. Story: a dumpling shop's delivery-wait estimate was 12
   minutes short last Friday; which weight deserves how much of the blame? Ideas: (1) walk the error backward,
   multiplying local slopes, and reuse the number that arrives at each node for every weight feeding it
   (backpropagation); (2) check one gradient numerically by nudging a weight by 0.001 (gradient check), and use the
   check to catch a buggy backward pass.
   Data, all real: docs/ai-path/runs/s3-backprop-by-hand/backprop.py + backprop.out.txt (NumPy forward and backward,
   gradient checks with eps 0.001 for the correct and a buggy backward, the line trace of backward(), and a PyTorch
   autograd cross-check). The weights, inputs and targets below are the script's; every derived number is computed
   here by the same arithmetic and matches the printed output. No model calls were recorded.
   Lesson-local style: a small three-column table and a mono option label (.lx-s3-backprop-by-hand-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s3-backprop-by-hand";

  /* ---------- Data copied from backprop.py ---------- */
  const W1 = [[2, 1], [1, 4]];  // row j = hidden unit j; column k = input k (orders in tens, rain 1/0)
  const B1 = [1, -2];
  const V = [2, 1];
  const C = 2;
  const FRIDAY = { inputs: [3, 1], actual: 35, words: "30 orders, raining" };
  const TUESDAY = { inputs: [1, 0], actual: 14, words: "10 orders, dry" };
  const EPS = 0.001;

  // From backprop.out.txt, "FRIDAY gradient check, correct backward" (W1[0, 0] row) and the buggy check.
  const RUN_W11 = { lossAfter: 71.928018, oneSided: -71.982, central: -72.0 };
  // [param, analytic, central] rows of "FRIDAY gradient check, BUGGY backward (np.outer(inputs, d_z))"
  const RUN_BUGGY = [["W1[0,0]", -72, -72], ["W1[0,1]", -36, -24], ["W1[1,0]", -24, -36], ["W1[1,1]", -12, -12],
    ["b1[0]", -24, -24], ["b1[1]", -12, -12], ["v[0]", -96, -96], ["v[1]", -60, -60], ["c", -12, -12]];
  // "PyTorch autograd cross-check, FRIDAY": W1 grad
  const RUN_TORCH_W1 = [[-72, -24], [-36, -12]];

  // The listing is backward() from backprop.py, line for line (line 0 = def).
  const CODE = [
    "def backward(inputs, z, h, pred, actual, v):",
    "    d_pred = pred - actual",
    "    d_v = d_pred * h",
    "    d_c = d_pred",
    "    d_h = d_pred * v",
    "    d_z = d_h * (z > 0)",
    "    d_W1 = np.outer(d_z, inputs)",
    "    d_b1 = d_z",
    "    return d_W1, d_b1, d_v, d_c"
  ];
  const NAMES = { "W1[0,0]": "w11", "W1[0,1]": "w12", "W1[1,0]": "w21", "W1[1,1]": "w22", "b1[0]": "h1's bias", "b1[1]": "h2's bias", "v[0]": "v1", "v[1]": "v2", "c": "c" };
  const BUG_LINE = 6, BUG_TEXT = "    d_W1 = np.outer(inputs, d_z)";
  // Trace of backward() on Friday (backprop.out.txt): the variable each line created, in order.
  const TRACE_NEW = ["d_pred", "d_v", "d_c", "d_h", "d_z", "d_W1", "d_b1"];

  /* ---------- The same arithmetic, in the page ---------- */
  function forward(s, w1 = W1, b1 = B1, v = V, c = C) {
    const z = w1.map((row, j) => row[0] * s.inputs[0] + row[1] * s.inputs[1] + b1[j]);
    const h = z.map(t => Math.max(t, 0));
    const pred = v[0] * h[0] + v[1] * h[1] + c;
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
  const nudgedW11 = (() => { const w = W1.map(r => r.slice()); w[0][0] += EPS; return forward(FRIDAY, w); })();
  const N_PARAMS = 4 + 2 + 2 + 1;

  const num = x => { const r = Math.round(x * 1e6) / 1e6; return (r < 0 ? "−" : "") + String(Math.abs(r)); };
  const mat = m => `[[${m[0].map(num).join(", ")}], [${m[1].map(num).join(", ")}]]`;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-t { width: 100%; max-width: 520px; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .lx-${ID}-t caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .lx-${ID}-t th { text-align: left; font: 600 13px var(--font); color: var(--muted); border-bottom: 1px solid var(--line); padding: 6px 8px 6px 0; }
      .lx-${ID}-t td { font: 500 14.5px var(--mono); color: var(--ink); border-bottom: 1px solid var(--line); padding: 7px 8px 7px 0; }
      .lx-${ID}-t tr.lx-${ID}-bad td { color: var(--bad); background: var(--bad-soft); }
      .lx-${ID}-t tr.lx-${ID}-new td { background: var(--good-soft); }
      .lx-${ID}-m { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-eq { font: 500 15px/1.6 var(--mono); color: var(--ink); margin: 10px 0 0; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }
  function tbl(kit, head, rows, { title = "", cls = () => "" } = {}) {
    return `<table class="lx-${ID}-t">${title ? `<caption>${kit.esc(title)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${cls(i)}">${r.map(c => `<td>${kit.esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const mono = (kit, s) => `<span class="lx-${ID}-m">${kit.esc(s)}</span>`;

  /* The 2-2-1 network as a picture. notes: { nodeId: text }. */
  function net(kit, s, notes, title) {
    const nodes = [
      { id: "x1", x: 0, y: 0.5 }, { id: "x2", x: 0, y: 1.5 },
      { id: "h1", x: 1, y: 0 }, { id: "h2", x: 1, y: 2 },
      { id: "p", label: "pred", x: 2, y: 1 }, { id: "L", x: 3, y: 1 }
    ];
    const edges = [["x1", "h1", "w11=" + num(W1[0][0])], ["x2", "h1", "w12=" + num(W1[0][1])], ["x1", "h2", "w21=" + num(W1[1][0])],
      ["x2", "h2", "w22=" + num(W1[1][1])], ["h1", "p", "v1=" + num(V[0])], ["h2", "p", "v2=" + num(V[1])], ["p", "L"]];
    return kit.pics.graph(nodes, edges, { directed: true, notes, title });
  }
  const fwdNotes = (s, f) => ({ x1: num(s.inputs[0]), x2: num(s.inputs[1]), h1: num(f.h[0]), h2: num(f.h[1]), p: num(f.pred), L: num(f.loss) });

  /* A question block that remembers a wrong pick. */
  const ask = (kit, opts, correct, picked, fbs) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;

  /* A sequence of questions on one screen: steps = [{ q, opts, right, fb, after }]. */
  function sequence({ el, done, kit }, head, steps, extra) {
    let k = 0, ans = null;
    const paint = () => {
      const fin = k >= steps.length;
      const st = steps[Math.min(k, steps.length - 1)];
      el.innerHTML = `${head(k)}
        ${steps.slice(0, k).map(s => kit.feedback(s.after, true)).join("")}
        ${fin ? (extra ? extra() : "") : `<p class="task">${st.q}</p><div class="lpanel">${ask(kit, st.opts, st.right, ans, st.fb)}</div>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === steps[k].right) { k++; ans = null; paint(); if (k >= steps.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 1. The situation: Friday's estimate, the error and the loss. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const f = FR.f;
    const opts = [num(f.pred - C), num(f.pred), num(V[1] * f.h[0] + V[0] * f.h[1] + C), num(FRIDAY.actual)];
    const RIGHT = 1;
    const fb = [
      [`You left out the bias <code>c = ${num(C)}</code>. The output adds it after the weighted sum, like the hidden units add theirs.`, false],
      [`Right: ${num(V[0])}·${num(f.h[0])} + ${num(V[1])}·${num(f.h[1])} + ${num(C)} = <b>${num(f.pred)} minutes</b>. The real wait was ${num(FRIDAY.actual)}, so the estimate was ${num(-f.err)} minutes short: <code>pred − actual = ${num(f.err)}</code>. The shop scores a miss with the loss <code>L = ½(pred − actual)²</code> = ½·${num(f.err ** 2)} = <b>${num(f.loss)}</b>. The ½ is only there so that the loss's slope with respect to <code>pred</code> is exactly <code>pred − actual</code>.`, true],
      [`You swapped the two output weights: <code>v1 = ${num(V[0])}</code> belongs to h1 (the top hidden unit), <code>v2 = ${num(V[1])}</code> to h2.`, false],
      [`${num(FRIDAY.actual)} minutes is what really happened on Friday, not what the network said. If it had said that, there would be nothing to fix.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Twelve minutes short</h1>
        <p class="lead">A dumpling shop tells each delivery customer how long to wait. A tiny network makes the estimate from two inputs: <b>x1</b>, orders in the last hour in tens, and <b>x2</b>, rain (1) or dry (0). Two hidden units with ReLU feed one output, <code>pred</code>, in minutes. Last Friday it was ${kit.esc(FRIDAY.words)}: x1 = ${num(FRIDAY.inputs[0])}, x2 = ${num(FRIDAY.inputs[1])}. When an estimate misses, training must decide how much to change each weight. This lesson finds out how much of the miss each weight caused.</p>
        ${net(kit, FRIDAY, { x1: num(FRIDAY.inputs[0]), x2: num(FRIDAY.inputs[1]), h1: num(f.h[0]), h2: num(f.h[1]) }, "Friday: inputs and hidden values (biases b1 = " + B1.map(num).join(", ") + ", c = " + num(C) + ")")}
        <p class="lead">The hidden units came out at h1 = ${num(f.h[0])} and h2 = ${num(f.h[1])}. The output is <code>pred = v1·h1 + v2·h2 + c</code>.</p>
        <p class="task">What wait did the network promise on Friday?</p>
        <div class="lpanel">${ask(kit, opts.map(o => o + " min"), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand, part 1: from the loss back through the output layer. */
  function outputLayer(ctx) {
    ensureStyle();
    const { kit } = ctx, f = FR.f;
    const steps = [
      { q: "Start at the loss. How fast does L change when <code>pred</code> moves up by a tiny bit? (The slope of ½(pred − actual)² is pred − actual.)",
        opts: [num(FR.dPred), num(-FR.dPred), num(f.loss), num(2 * FR.dPred)].map(String), right: 0,
        fb: [null,
          [`The sign is backward: it is <code>pred − actual</code> = ${num(f.pred)} − ${num(FRIDAY.actual)}. A negative slope means: raise <code>pred</code> and the loss falls. That fits, since the estimate was too low.`, false],
          [`${num(f.loss)} is the loss itself, not how fast it changes. The slope is the change in L per unit of <code>pred</code>.`, false],
          [`That would be the slope of (pred − actual)² without the ½. The ½ cancels the 2.`, false]],
        after: `<b>dL/dpred = ${num(FR.dPred)}</b>. Every gradient below starts from this number.` },
      { q: "Now the weight <code>v1</code>. pred = v1·h1 + …, so a small change in v1 moves pred by h1 times as much. What is dL/dv1?",
        opts: [num(FR.dPred * V[0]), num(FR.dV[0]), num(FR.dPred), num(-FR.dV[0])].map(String), right: 1,
        fb: [[`You multiplied by <code>v1 = ${num(V[0])}</code>, the weight itself. How much pred moves when v1 moves depends on what v1 multiplies: h1 = ${num(f.h[0])}.`, false], null,
          [`That is the slope arriving at pred. You still have to multiply by the local slope dpred/dv1, which is h1 = ${num(f.h[0])}.`, false],
          ["The magnitude is right, the sign is not. The arriving slope is negative and h1 is positive, so the product is negative."]].map(x => x && [x[0], false]),
        after: `<b>dL/dv1 = ${num(FR.dPred)} × ${num(f.h[0])} = ${num(FR.dV[0])}</b>. The chain rule: slope arriving × local slope. In the same way dL/dv2 = ${num(FR.dPred)} × ${num(f.h[1])} = ${num(FR.dV[1])}, and dL/dc = ${num(FR.dC)} (pred moves one for one with c).` },
      { q: "To go further back you need the slope at h1 itself. pred = v1·h1 + …, so how much does L change per unit of h1?",
        opts: [num(FR.dV[0]), num(FR.dPred), num(FR.dH[0]), num(FR.dV[0] * V[0])].map(String), right: 2,
        fb: [[`${num(FR.dV[0])} is dL/dv1. For h1 the roles swap: the local slope dpred/dh1 is the weight v1 = ${num(V[0])}, not h1.`, false],
          [`That is the slope at pred. Between pred and h1 sits the weight v1 = ${num(V[0])}; multiply by it.`, false], null,
          [`You chained from dL/dv1, but v1 is a side branch, not a step on the path from L to h1. The path is L → pred → h1: ${num(FR.dPred)} × ${num(V[0])}.`, false]],
        after: `<b>dL/dh1 = ${num(FR.dPred)} × ${num(V[0])} = ${num(FR.dH[0])}</b>, and dL/dh2 = ${num(FR.dPred)} × ${num(V[1])} = ${num(FR.dH[1])}. These two numbers are now waiting at the hidden units.` }
    ];
    const notes = k => {
      const n = fwdNotes(FRIDAY, f);
      if (k >= 1) n.p = num(f.pred) + "  ∂ " + num(FR.dPred);
      if (k >= 3) { n.h1 = num(f.h[0]) + "  ∂ " + num(FR.dH[0]); n.h2 = num(f.h[1]) + "  ∂ " + num(FR.dH[1]); }
      return n;
    };
    sequence(ctx, k => `<h1>Push the miss backward, step 1</h1>
      <p class="lead">You want to know, for each weight, how much the loss changes if that weight moves a tiny bit: its <b>gradient</b>, dL/d(weight). The number under each node is its value. When you find how L reacts to that node, the slope appears after the ∂ sign.</p>
      ${net(kit, FRIDAY, notes(k), "Friday, L = " + num(f.loss))}`, steps);
  }

  /* 3. By hand, part 2: through the ReLU into the first layer. */
  function hiddenLayer(ctx) {
    ensureStyle();
    const { kit } = ctx, f = FR.f, x = FRIDAY.inputs;
    const steps = [
      { q: `h1 = ReLU(z1) and z1 = ${num(f.z[0])}. ReLU passes positive values through unchanged. What is dL/dz1?`,
        opts: [num(FR.dZ[0]), "0", num(FR.dH[0] * f.z[0])].map(String), right: 0,
        fb: [null, [`ReLU's slope is 0 only where z is below zero. Here z1 = ${num(f.z[0])} is positive, so h1 moves one for one with z1: slope 1.`, false],
          [`You multiplied by z1's value. The local slope of ReLU is not its input; it is 1 for a positive input and 0 for a negative one.`, false]],
        after: `<b>dL/dz1 = ${num(FR.dH[0])} × 1 = ${num(FR.dZ[0])}</b>, and z2 = ${num(f.z[1])} is positive too, so dL/dz2 = ${num(FR.dZ[1])}.` },
      { q: `z1 = w11·x1 + w12·x2 + b1, with x1 = ${num(x[0])}. What is dL/dw11?`,
        opts: [num(FR.dZ[0]), num(FR.dW1[0][0]), num(FR.dZ[0] * W1[0][0]), num(FR.dW1[1][0])].map(String), right: 1,
        fb: [[`That is the slope at z1. One more local slope: dz1/dw11 is the input that w11 multiplies, x1 = ${num(x[0])}.`, false], null,
          [`You multiplied by the weight w11 = ${num(W1[0][0])}. A weight's local slope is the input it multiplies, not itself.`, false],
          [`That is dL/dw21: the slope at z2 (${num(FR.dZ[1])}) times x1. w11 feeds z1, so start from dL/dz1 = ${num(FR.dZ[0])}.`, false]],
        after: `<b>dL/dw11 = ${num(FR.dZ[0])} × ${num(x[0])} = ${num(FR.dW1[0][0])}</b>. Same pattern for w12: ${num(FR.dZ[0])} × ${num(x[1])} = ${num(FR.dW1[0][1])}, and h1's bias gets ${num(FR.dB1[0])}.` },
      { q: "Last one by hand: dL/dw21 (from x1 into h2).",
        opts: [num(FR.dW1[0][0]), num(FR.dW1[1][0]), num(FR.dW1[0][1]), num(FR.dZ[1])].map(String), right: 1,
        fb: [[`That is w11's gradient. w21 ends at h2, so it gets the slope waiting at z2, ${num(FR.dZ[1])}, not z1's.`, false], null,
          [`${num(FR.dW1[0][1])} is w12's: slope at z1 times x2. w21 goes from x1 into h2: slope at z2 times x1.`, false],
          [`That is the slope at z2. Multiply by the input w21 carries, x1 = ${num(x[0])}.`, false]],
        after: `<b>dL/dw21 = ${num(FR.dZ[1])} × ${num(x[0])} = ${num(FR.dW1[1][0])}</b>, and w22 gets ${num(FR.dZ[1])} × ${num(x[1])} = ${num(FR.dW1[1][1])}.` }
    ];
    const notes = () => { const n = fwdNotes(FRIDAY, f); n.h1 = num(f.h[0]) + "  ∂ " + num(FR.dH[0]); n.h2 = num(f.h[1]) + "  ∂ " + num(FR.dH[1]); n.p = num(f.pred) + "  ∂ " + num(FR.dPred); return n; };
    const all = [["v1", FR.dV[0]], ["v2", FR.dV[1]], ["w11", FR.dW1[0][0]], ["w21", FR.dW1[1][0]], ["h1's bias", FR.dB1[0]], ["w12", FR.dW1[0][1]], ["c", FR.dC], ["w22", FR.dW1[1][1]], ["h2's bias", FR.dB1[1]]]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    sequence(ctx, () => `<h1>Push the miss backward, step 2</h1>
      <p class="lead">The slopes ${num(FR.dH[0])} and ${num(FR.dH[1])} are waiting at h1 and h2. z1 and z2 are the weighted sums that go into the ReLU, so h1 = ReLU(z1). Keep going: through the ReLU, then to the weights that feed each hidden unit.</p>
      ${net(kit, FRIDAY, notes(), "Friday, z1 = " + num(f.z[0]) + ", z2 = " + num(f.z[1]))}`, steps,
      () => `${tbl(kit, ["weight", "dL/d(weight)"], all.map(([n, g]) => [n, num(g)]), { title: "All nine gradients, largest blame first" })}
        ${kit.feedback(`That is Friday's blame list. The gradient's size says how strongly the loss reacts to that weight; its sign says which way to move it. All are negative: raising any of them would have raised the estimate and cut the miss. <b>v1</b> carries the most blame (${num(FR.dV[0])}): it multiplies the larger hidden value, ${num(f.h[0])}.`)}`);
  }

  /* 4. Spot the idea: reuse, not re-running. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "It used a smaller nudge, so its numbers are more exact",
      `It worked out each node's slope once and reused it: the ${num(FR.dH[0])} at h1 served w11, w12 and h1's bias`,
      "It only needed the weights near the output; the first layer came for free",
      "It solved for the weights that make the error zero"
    ];
    const RIGHT = 1;
    const fb = [
      ["Your walk nudged nothing. It multiplied exact local slopes, so there is no nudge size at all. The difference is in how much work it repeats.", false],
      [`Right. Your colleague's way runs the whole network again for every weight: ${N_PARAMS} weights, ${N_PARAMS} extra forward passes. A network with millions of weights would need millions. Your walk went backward once: each node's slope was found one time, then shared by every weight that feeds that node. This is <b>backpropagation</b>: the chain rule, applied from the loss backward, layer by layer, reusing what arrives at each node. Training then moves each weight a little against its gradient.`, true],
      [`You reached the first layer too: w11, w21 and the rest got gradients. Nothing came free: they needed the slopes at h1 and h2 first, which is why you went backward.`, false],
      ["A gradient says which way and how strongly the loss reacts to each weight, right now. It does not tell you where the error becomes zero. Training takes many small steps along it.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why go backward?</h1>
        <p class="lead">A colleague offers another way to get the same ${N_PARAMS} gradients: nudge one weight by a tiny amount, run the network forward again, see how the loss moved, and repeat for each weight.</p>
        <p class="task">Your backward walk got all ${N_PARAMS} gradients without re-running the network. What made it cheaper?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Check one gradient numerically. */
  function numericCheck(ctx) {
    ensureStyle();
    const { kit } = ctx, f = FR.f, g = FR.dW1[0][0];
    const predicted = f.loss + g * EPS;
    const steps = [
      { q: `Your walk says dL/dw11 = ${num(g)}. Now really nudge w11 from ${num(W1[0][0])} to ${num(W1[0][0] + EPS)} and run the network forward again. About what will the loss be?`,
        opts: [num(f.loss - g * EPS), num(predicted), num(f.loss - EPS), num(g * EPS)].map(s => "about " + s), right: 1,
        fb: [[`That has the loss going up. A negative gradient means a bigger w11 gives a smaller loss.`, false], null,
          [`That treats the loss as moving one for one with w11. It moves ${num(g)} times as much: ${num(g)} × ${num(EPS)}.`, false],
          [`That is the change, not the new loss. The loss starts at ${num(f.loss)} and moves by that much.`, false]],
        after: `The run on the Mac printed a loss of <b>${num(RUN_W11.lossAfter)}</b> (this page, doing the same sums, gets ${num(nudgedW11.loss)}). The change, divided by the nudge: (${num(RUN_W11.lossAfter)} − ${num(f.loss)}) / ${num(EPS)} = <b>${num(RUN_W11.oneSided)}</b>.` },
      { q: `The check gives ${num(RUN_W11.oneSided)}, your walk gave ${num(g)}. Is your gradient wrong?`,
        opts: ["Yes: they differ, so the backward pass has a bug", "No: a one-way nudge is only close; a check that nudges both ways is much closer", "Can't say: checks like this never agree"], right: 1,
        fb: [[`A nudge sees the slope over a small stretch, not at one point, so it is off by a little when the curve bends. A bug shows up as a large difference, like a wrong sign or a swapped value, not a gap of a few hundredths out of ${num(-g)}.`, false], null,
          [`They should agree closely. A large gap means a bug, and that is exactly what the check is for.`, false]],
        after: `Right. Nudging both ways, (L(w + ${num(EPS)}) − L(w − ${num(EPS)})) / ${num(2 * EPS)}, the run printed <b>${num(RUN_W11.central)}</b>, the same as your walk. (Here the loss bends like a parabola as w11 moves, and for a parabola the two-way nudge is exact; in general it is just much closer than one way.) This is a <b>gradient check</b>: the slow, simple way, used to test the fast way. It needs two forward passes per weight, so you run it on a few weights and a few samples, never during training.` }
    ];
    sequence(ctx, () => `<h1>Check it the slow way</h1>
      <p class="lead">You never ran the network again to get your gradients. So how do you know they are right? Measure one directly.</p>
      <p class="lx-${ID}-eq">nudge w11 by ${num(EPS)}  →  L moves by about dL/dw11 × ${num(EPS)}</p>`, steps);
  }

  /* 6. A different evening: a unit that is switched off. */
  function deadUnit({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const f = TU.f;
    const zeroNames = [["v2", TU.dV[1]], ["w12", TU.dW1[0][1]], ["w21", TU.dW1[1][0]], ["w22", TU.dW1[1][1]], ["h2's bias", TU.dB1[1]]].filter(([, v]) => v === 0).map(([n]) => n);
    const opts = ["v2, w21, w22 and h2's bias", "v2, w21, w22, h2's bias and w12", "Only v2", "None: the miss was " + num(-f.err) + " minutes, so every weight shares some blame"];
    const RIGHT = 1;
    const fb = [
      [`Close. The weights at h2 are right. But look at w12: its gradient is dL/dz1 × x2, and on Tuesday it was dry, x2 = ${num(TUESDAY.inputs[1])}.`, false],
      [`Right: ${zeroNames.join(", ")} all get exactly 0 (the run printed the same). z2 = ${num(f.z[1])} is below zero, so ReLU outputs 0 and its slope there is 0. Whatever arrives at h2 is multiplied by 0, so nothing reaches the weights behind it. w12 gets 0 for a different reason: its input was 0. On this sample those weights do not learn at all. If a unit's z is below zero for <b>every</b> sample, it never gets blame and never changes again; people call it a dead unit.`, true],
      [`v2 gets 0 because h2 = 0. But follow the path further: the slope at h2 goes through ReLU, whose slope at z2 = ${num(f.z[1])} is 0.`, false],
      [`The blame flows only along paths with non-zero slopes. h2's path has a ReLU slope of 0 on this sample.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A quiet Tuesday</h1>
        <p class="lead">Same network, same weights. Tuesday: ${kit.esc(TUESDAY.words)}, x1 = ${num(TUESDAY.inputs[0])}, x2 = ${num(TUESDAY.inputs[1])}. Then z2 = ${num(W1[1][0])}·${num(TUESDAY.inputs[0])} + ${num(W1[1][1])}·${num(TUESDAY.inputs[1])} + (${num(B1[1])}) = <b>${num(f.z[1])}</b>, so h2 = ReLU(${num(f.z[1])}) = ${num(f.h[1])}. The network said ${num(f.pred)} minutes; the real wait was ${num(TUESDAY.actual)}.</p>
        ${net(kit, TUESDAY, fwdNotes(TUESDAY, f), "Tuesday, z2 = " + num(f.z[1]))}
        <p class="task">Which weights get a gradient of exactly 0 from Tuesday's miss?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. The backward pass in Python, a stepped replay of the traced run. */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let picked = null, i = -1; // i = -1: question first; then frames 0..TRACE_NEW.length (last = return)
    const opts = [mat(FR.dW1), mat([[FR.dW1[0][0], FR.dW1[1][0]], [FR.dW1[0][1], FR.dW1[1][1]]]), mat([FR.dZ, FR.dZ])];
    const fb = [null,
      [`That has rows and columns swapped: row 1 would hold w11 and w21. In this code row j belongs to hidden unit j and column k to input k, the same layout as W1, so row 1 is z1's slope (${num(FR.dZ[0])}) times each input.`, false],
      [`That copies the slopes at z1 and z2 without multiplying by the inputs. Each weight's gradient is the slope at its unit times the input it carries.`, false]];
    const last = TRACE_NEW.length;
    const val = name => ({ d_pred: num(FR.dPred), d_v: "[" + FR.dV.map(num).join(", ") + "]", d_c: num(FR.dC), d_h: "[" + FR.dH.map(num).join(", ") + "]", d_z: "[" + FR.dZ.map(num).join(", ") + "]", d_W1: mat(FR.dW1), d_b1: "[" + FR.dB1.map(num).join(", ") + "]" })[name];
    const say = j => j === last
      ? `The <code>return</code> line hands back all of them. These are the numbers you found by hand, and PyTorch's autograd, run on the same network, gave the same W1 gradient: ${kit.esc(mat(RUN_TORCH_W1))}.`
      : [`d_pred: the slope at the output, ${val("d_pred")}.`, "d_v: one multiplication for both output weights, each by its hidden value.", "d_c: the bias moves pred one for one.",
        "d_h: the slope waiting at each hidden unit, d_pred times each output weight.", "d_z: <code>(z > 0)</code> is the ReLU slope, 1 or 0 per unit. On Friday both are 1.",
        "d_W1: the outer product puts slope-at-unit-j times input-k in row j, column k. The same layout as W1.", "d_b1: a bias's input is always 1, so it just takes d_z."][j];
    const paint = () => {
      const active = i < 0 ? -1 : i === last ? 8 : i + 1;
      el.innerHTML = `<h1>The same walk in Python</h1>
        <p class="lead">This NumPy function does what you did. Its inputs come from the forward pass: <code>z</code> and <code>h</code> are the hidden values, kept for this walk. The run below was traced line by line on Friday's sample.</p>
        ${i < 0 ? `<p class="task">Before you step: the <code>d_W1</code> line builds the gradient of W1 (row = hidden unit, column = input). What will <code>d_W1</code> be?</p>
          <div class="lpanel">${kit.options(opts.map(o => mono(kit, o)), { picked, correct: 0 })}${picked != null && picked !== 0 ? kit.feedback(fb[picked][0], false) : ""}</div>` : ""}
        ${kit.code(CODE, active)}
        ${i < 0 ? "" : `<div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === last ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${TRACE_NEW.slice(0, Math.min(i + 1, last)).slice(-2).map(n => `<span>${n} <b>${kit.esc(val(n))}</b></span>`).join("")}<span>step <b>${i + 1} / ${last + 1}</b></span></div>
        ${kit.feedback(say(i))}`}
        ${i < 0 ? "" : `<p class="task">Step through to the return.</p>`}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { picked = +b.dataset.i; if (picked === 0) i = 0; paint(); });
      const p = el.querySelector("[data-prev]"), n = el.querySelector("[data-next]");
      if (p) p.onclick = () => { i--; paint(); };
      if (n) n.onclick = () => { i++; paint(); if (i === last) done(); };
    };
    paint();
  }

  /* 8. Broken on purpose: a gradient check catches a swapped outer product. */
  function broken(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const bad = RUN_BUGGY.map(r => r[1] !== r[2]);
    const lines = CODE.map((c, j) => j === BUG_LINE ? BUG_TEXT : c);
    const steps = [
      { q: "Two rows disagree, and each one's backward value is the other's check value. Which line of the code is wrong?",
        opts: ["The d_v line", "The d_z line", "The d_W1 line", "The d_b1 line"], right: 2,
        fb: [["The v rows match their check. If d_v were wrong, they would be the rows that disagree.", false],
          ["If d_z were wrong, the bias rows (h1's bias, h2's bias) would be off too, because d_b1 is d_z. Both bias rows match.", false], null,
          ["d_b1 is fine: both bias rows match. And it does not touch W1.", false]],
        after: `The d_W1 line builds <code>np.outer(inputs, d_z)</code>: row = input, column = unit. That is W1's layout flipped, so w12 and w21 trade places. Only w12 and w21 are wrong, which is exactly the pattern in the check. The fix is <code>np.outer(d_z, inputs)</code>. With a square 2×2 matrix the shapes still match, so NumPy raised no error; only the check caught it.` },
      { q: "The same buggy code was also checked on Tuesday's sample. Every row matched. Why?",
        opts: ["The bug only happens when it rains", "On Tuesday x2 = 0 and z2 < 0, so both swapped entries were 0 anyway", "The check is too rough to see it on small losses"], right: 1,
        fb: [["The bug is in every run: the d_W1 line always flips the matrix. Rain only decides whether the flip is visible.", false], null,
          [`The check sees differences far smaller than this; on Friday the gap was ${num(Math.abs(RUN_BUGGY[1][1] - RUN_BUGGY[1][2]))}. The swapped numbers were simply equal on Tuesday.`, false]],
        after: `Right: on Tuesday w12's true gradient is 0 (x2 = 0) and w21's is 0 (h2 was switched off), so swapping 0 and 0 changes nothing. A gradient check on a sample with zeros or switched-off units can pass a real bug. Check on a sample where every input is non-zero and every unit is on, and look at <b>every</b> weight group, biases included.` }
    ];
    sequence(ctx, () => `<h1>Broken on purpose: the check fails</h1>
      <p class="lead">A teammate rewrote <code>backward</code> from memory. It runs without any error:</p>
      ${kit.code(lines, -1)}
      <p class="lead">This is the real gradient check of that code on Friday's sample: the backward value of each weight against the two-way nudge.</p>
      ${tbl(kit, ["weight", "backward", "nudge check"], RUN_BUGGY.map(r => [NAMES[r[0]], num(r[1]), num(r[2])]), { title: "Gradient check, Friday, nudge " + num(EPS), cls: i => bad[i] ? `lx-${ID}-bad` : "" })}`, steps);
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Training a usual network built from the library's own layers",
      "You wrote the backward pass of a new layer yourself",
      "Each training step, to make sure the gradients stay right"
    ];
    const RIGHT = 1;
    const fb = [
      ["The framework derives the backward pass of its own layers for you (PyTorch calls this autograd), and those are tested. Checking them by hand would test the library, not your work.", false],
      ["Right. Hand-written backward code is where swapped indices and missing ReLU slopes hide, and nothing crashes. A gradient check on a few small samples catches it. PyTorch even ships one, <code>torch.autograd.gradcheck</code>, which compares a nudge check with the backward values. Its default settings expect double-precision (float64) inputs.", true],
      [`A check costs two forward passes per weight. Here that is ${2 * N_PARAMS} passes for ${N_PARAMS} weights; for millions of weights it would cost far more than the training itself. Run it once, on a few weights and samples, when the code changes.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Where backprop fits</h1>
        <p class="lead"><b>For:</b> every network trained by gradient descent. Backprop gives every weight its gradient in one backward walk. <b>In practice</b> frameworks do it for you: they record the forward pass as a graph and walk it backward with the chain rule. You do it by hand to understand a failure, or to write a layer the framework lacks. <b>Not for:</b> a step with no useful slope, such as rounding or picking one item. Also not for models that are not built from weights and sloped steps, like decision trees. <b>Instead:</b> compute the loss on the unrounded output; trees are fit by choosing splits. <b>Costs:</b> the backward walk needs the values the forward pass computed, so memory grows with layers and batch size. A gradient check is far slower still.</p>
        <p class="task">Which situation calls for writing a gradient check?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise: does backprop give this weight a useful gradient? */
  const CASES = [
    ["A network predicts a flat's monthly rent from its size and floor; the loss is the squared difference from the real rent.", true,
      "Yes. Every step from the weights to the loss has a slope: weighted sums, ReLUs, a squared difference. The chain rule reaches every weight.",
      "Every step on the way has a slope, so each weight gets a gradient. This is the same shape as the dumpling network."],
    ["A parcel app rounds the network's predicted delivery time to whole hours, and the loss compares that rounded number with the real time.", false,
      "No. Rounding is flat between the jumps: nudge the output a little and the rounded hour does not change, so its slope is 0. Zero times anything is zero, and no blame reaches the weights. Put the loss on the unrounded output and round only for display.",
      "Rounding's slope is 0 almost everywhere: a tiny nudge does not change the rounded hour. The chain multiplies by 0 there, so every weight before it gets nothing to learn from."],
    ["A network with three hidden layers instead of one predicts how long a bakery's bread needs to rise, from room temperature and humidity.", true,
      "Yes. More layers only make the chain longer: the slope arriving at each layer is passed back through its weights and ReLUs to the layer before, exactly as you did from h1 to w11.",
      "Depth does not stop backprop. Each extra layer is one more set of local slopes to multiply on the way back, the same move you made from h1 to w11."],
    ["In a trained network, one hidden unit's weighted sum is below zero for every example in the data.", false,
      "No. ReLU's slope is 0 below zero, so on every example the blame arriving at that unit is multiplied by 0. Its incoming weights get gradient 0 on every example, so the loss never pushes them: a dead unit.",
      "On every example the unit sits below zero, where ReLU's slope is 0. Whatever arrives is multiplied by 0, so its incoming weights never receive any blame."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Does the blame get through?</h1>
        <p class="lead">Four other set-ups. Backprop can only help a weight if a chain of non-zero slopes connects it to the loss.</p>
        <p class="task">Will training by backprop give the weights in question a useful gradient? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can trace the blame</h1>
      <p class="lead">You pushed Friday's ${num(-FR.f.err)}-minute miss backward through the network, multiplying local slopes and reusing the slope at each node, and got all ${N_PARAMS} gradients. You checked one by nudging a weight, saw a switched-off unit pass no blame, and caught a swapped matrix with a gradient check.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>backward</code> for this 2-2-1 network yourself and confirm every gradient with a two-way nudge.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You write the same forward, backward and update steps for a bigger network with three outputs, and train it.</p>` : ""}`;
    done();
  }

  const seqWalk = n => ({ wrong: ["[data-wrong]"], right: Array(n).fill("[data-right]") });

  LessonKit.define(ID, {
    title: "Backpropagation by hand on a tiny network",
    checked: "2026-11-13",
    sources: [
      "https://www.nature.com/articles/323533a0",
      "https://cs231n.github.io/optimization-2/",
      "https://cs231n.github.io/neural-networks-1/",
      "https://cs231n.github.io/neural-networks-3/",
      "https://docs.pytorch.org/docs/2.15/notes/autograd.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.autograd.gradcheck.gradcheck.html"
    ],
    interview: [
      {
        q: "You wrote a custom layer with its own backward pass. Training runs without errors, but the loss barely moves. How do you find out whether the gradients are wrong?",
        good: [
          "Run a gradient check: nudge single weights both ways, compare (L(w+e) − L(w−e)) / 2e with the backward value",
          "Use double precision and a few small samples, so rounding errors do not hide or fake a mismatch",
          "Pick samples with non-zero inputs and active units; zeros can make a buggy gradient look right",
          "Check every weight group, biases included, and read the pattern of mismatches: swapped entries point to a transpose",
          "Only then look at the learning rate or the data"
        ],
        weak: "Lower the learning rate or train longer. That treats a wrong gradient as a tuning problem; no amount of tuning fixes gradients that point the wrong way."
      },
      {
        q: "A teammate wants to skip writing the backward pass for a new model: nudge each weight, re-run the network, and use the loss change as that weight's gradient. What do you tell them?",
        good: [
          "Nudging needs at least one extra forward pass per weight; a large model has millions or billions of weights",
          "Backprop goes backward once and reuses the slope at each node for every weight that feeds it",
          "It gives exact gradients, not approximations that depend on the nudge size",
          "The cost: the forward pass's values must be kept in memory for the backward walk"
        ],
        weak: "Agree because it is simpler, or say backprop is “more accurate”, without explaining that the real win is reusing each node's slope instead of re-running the network per weight."
      }
    ],
    screens: [situation, outputLayer, hiddenLayer, spotIdea, numericCheck, deadUnit, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      seqWalk(3),
      seqWalk(3),
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      seqWalk(2),
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(TRACE_NEW.length).fill("[data-next]")] },
      seqWalk(2),
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
