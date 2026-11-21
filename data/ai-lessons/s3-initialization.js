/* Lesson: weight initialization and why zeros fail. Story: a choir school's app names the voice part of a sung
   clip; like a choir where every singer starts on the same note, a network whose units all start the same can
   never split into different roles.
   Ideas: (1) scale: each ReLU layer multiplies the signal's spread by about sqrt(fan_in) x scale x sqrt(1/2), so
   ten layers shrink it to nothing or blow it up unless scale = sqrt(2 / fan_in) (He initialization);
   (2) symmetry: all-zero or all-equal starting weights give every hidden unit the same gradient, so they stay
   copies of one unit forever.
   Depth: explain (screens 1-4, 6, 9, 10, interview), scratch (screen 5, a stepped replay of he_spreads),
   debug (screen 7, a real run that trains but stalls because every unit is the same).
   Data, all real, from runs on this Mac (NumPy 2.5.4, PyTorch 2.15.0, see env.txt):
   - docs/ai-path/runs/s3-initialization/spread.py + spread.out.txt: spread per layer of a ten-layer ReLU stack
     for three scales at width 256 and two at width 64, and the traced he_spreads (seed 0);
   - docs/ai-path/runs/s3-initialization/choir.py + choir.out.txt: a 2-16-4 network trained 2000 steps from zeros,
     from all 0.5 and from random He weights, on made-up four-group data (seeds 0 and 1);
   - docs/ai-path/runs/s3-initialization/torch_default.py + torch_default.out.txt: nn.Linear's default start
     against nn.init.kaiming_normal_ in a ten-layer ReLU stack (torch.manual_seed(0)).
   No model recordings. Lesson-local style: a spread table and a printout block (.lx-s3-initialization-*), see
   ensureStyle(). Plain browser script. */
(() => {
  const ID = "s3-initialization";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  // a spread for display: 3 significant digits, or "a × 10ⁿ" when tiny or huge
  const num = v => {
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a >= 100 && a < 10000) return String(Math.round(v));
    if (a >= 0.001 && a < 100) return String(Number(v.toPrecision(3)));
    const e = Math.floor(Math.log10(a)), m = v / Math.pow(10, e);
    return `${m.toFixed(1)} × 10${String(e).split("").map(c => SUP[c]).join("")}`;
  };
  const r2 = v => String(Math.round(v * 100) / 100);
  const r3 = v => String(Math.round(v * 1000) / 1000);
  const HALF = r2(Math.SQRT1_2); // what ReLU does to the signal's size: √½

  /* ---------- Data copied from the runs ---------- */
  // spread.out.txt, "width 256, three scales". Input: 1000 clips x 256 numbers, standard normal.
  const W256 = 256, LAYERS = 10;
  const INPUT_STD = 1.001;
  const RUNS256 = [
    { scale: 0.01, spreads: [0.09404, 0.01025, 0.001248, 0.0001442, 1.594e-05, 1.712e-06, 2.04e-07, 2.227e-08, 2.556e-09, 3.035e-10] },
    { scale: 0.0884, spreads: [0.8312, 0.8011, 0.8617, 0.8803, 0.8598, 0.8164, 0.8598, 0.8295, 0.8418, 0.8833] },
    { scale: 0.2, spreads: [1.881, 4.102, 9.983, 23.08, 51.0, 109.6, 261.1, 570.0, 1309.0, 3108.0] }
  ];
  // spread.out.txt, "width 64"
  const W64 = 64, INPUT_STD64 = 0.9998;
  const RUNS64 = [
    { scale: 0.0884, spreads: [0.4171, 0.1909, 0.09351, 0.04652, 0.02773, 0.01394, 0.006662, 0.003458, 0.001864, 0.001136] },
    { scale: 0.1768, spreads: [0.8343, 0.7635, 0.7481, 0.7443, 0.8874, 0.8924, 0.8527, 0.8852, 0.9543, 1.164] }
  ];
  // he_spreads from spread.py, line for line (line 0 = def)
  const CODE = [
    "def he_spreads(signal, n_layers, rng):",
    "    width = signal.shape[1]",
    "    scale = np.sqrt(2.0 / width)",
    "    shape = (width, width)",
    "    spreads = []",
    "    for layer in range(n_layers):",
    "        W = rng.normal(0.0, scale, shape)",
    "        signal = np.maximum(0.0, signal @ W)",
    "        spread = float(signal.std())",
    "        spreads.append(round(spread, 3))",
    "    return spreads"
  ];
  // spread.out.txt, traced he_spreads: the frames after line 2 and after each line 9 ran, and the return (line 10).
  // [line that just ran, event, layer, spreads]; scale in the trace: 0.08838834764831845
  const TRACE_SCALE = 0.08838834764831845;
  const TRACE = [[2,"l",null,null],[9,"l",0,[0.831]],[9,"l",1,[0.831,0.801]],[9,"l",2,[0.831,0.801,0.862]],[9,"l",3,[0.831,0.801,0.862,0.88]],[9,"l",4,[0.831,0.801,0.862,0.88,0.86]],[9,"l",5,[0.831,0.801,0.862,0.88,0.86,0.816]],[9,"l",6,[0.831,0.801,0.862,0.88,0.86,0.816,0.86]],[9,"l",7,[0.831,0.801,0.862,0.88,0.86,0.816,0.86,0.829]],[9,"l",8,[0.831,0.801,0.862,0.88,0.86,0.816,0.86,0.829,0.842]],[9,"l",9,[0.831,0.801,0.862,0.88,0.86,0.816,0.86,0.829,0.842,0.883]],[10,"r",9,[0.831,0.801,0.862,0.88,0.86,0.816,0.86,0.829,0.842,0.883]]];

  // choir.out.txt: 2 inputs, 16 hidden ReLU units, 4 voice parts, 200 clips (50 per part), lr 0.5, 2000 steps
  const HIDDEN = 16, PARTS = ["soprano", "alto", "tenor", "bass"], LR = 0.5, STEPS = 2000;
  const LN4 = 1.3863;
  const CHOIR = {
    zeros: [{ step: 0, loss: 1.3863, accuracy: 0.25 }, { step: 100, loss: 1.3863, accuracy: 0.25 }, { step: 500, loss: 1.3863, accuracy: 0.25 }, { step: 1000, loss: 1.3863, accuracy: 0.25 }, { step: 2000, loss: 1.3863, accuracy: 0.25 }],
    half: [{ step: 0, loss: 1.3863, accuracy: 0.25 }, { step: 100, loss: 0.6449, accuracy: 0.715 }, { step: 500, loss: 0.5171, accuracy: 0.73 }, { step: 1000, loss: 0.3728, accuracy: 0.835 }, { step: 2000, loss: 0.3464, accuracy: 0.84 }],
    he: [{ step: 0, loss: 1.7936, accuracy: 0.44 }, { step: 100, loss: 0.0174, accuracy: 1.0 }, { step: 500, loss: 0.0068, accuracy: 1.0 }, { step: 1000, loss: 0.0049, accuracy: 1.0 }, { step: 2000, loss: 0.0035, accuracy: 1.0 }]
  };
  // choir.out.txt, the "all 0.5" weights after training (printed exactly like this)
  const HALF_DISTINCT = 1, HE_DISTINCT = 16;
  const HALF_W1 = "\"W1_first_4_units\": [[0.465, 0.465, 0.465, 0.465], [0.772, 0.772, 0.772, 0.772]]";
  const HALF_B1 = "\"b1_first_4\": [0.83, 0.83, 0.83, 0.83]";
  const HALF_LOG_END = "{\"step\": 2000, \"loss\": 0.3464, \"accuracy\": 0.84}";
  // choir.py, the training function's first line (the same for all three starts)
  const TRAIN_DEF = "def train(X, y, W1, b1, W2, b2, lr=0.5, steps=2000, log_at=(0, 100, 500, 1000, 2000)):";
  const HE_W1 = "\"W1_first_4_units\": [[0.297, 1.707, 0.33, -2.504], [-0.242, 0.07, -0.871, -0.781]]";

  // torch_default.out.txt (no bias, ReLU after each of 10 layers of 256)
  const TORCH_DEFAULT = [0.3348, 0.1423, 0.06097, 0.02325, 0.009345, 0.003801, 0.001456, 0.0005472, 0.0002116, 8.573e-05];
  const TORCH_KAIMING = [0.8246, 0.7996, 0.793, 0.7428, 0.7528, 0.7496, 0.8141, 0.8692, 0.8654, 0.8156];
  const GAIN_RELU = 1.4142135623730951, GAIN_TANH = 1.6666666666666667; // calculate_gain, same file

  /* ---------- Derived from the data ---------- */
  const last = a => a[a.length - 1];
  const rough = (width, scale) => Math.sqrt(width) * scale * Math.SQRT1_2; // the rule of thumb, per layer
  const realFactor = sp => Math.pow(last(sp) / sp[0], 1 / (sp.length - 1)); // average factor, layer 1 to layer 10
  const verdict = sp => last(sp) < sp[0] / 10 ? 0 : last(sp) > sp[0] * 10 ? 2 : 1; // shrink, stay, explode
  const ROOT = Math.sqrt(W256);
  const HE256 = Math.sqrt(2 / W256), HE64 = Math.sqrt(2 / W64);
  const torchBound = 1 / Math.sqrt(W256), torchStd = torchBound / Math.sqrt(3);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 14.5px; }
      .lx-${ID}-tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding: 0 0 6px; }
      .lx-${ID}-tbl th, .lx-${ID}-tbl td { padding: 6px 6px; border-bottom: 1px solid var(--line); text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; }
      .lx-${ID}-tbl th { font-family: var(--font); font-weight: 600; color: var(--ink-2); font-size: 13.5px; }
      .lx-${ID}-tbl th:first-child, .lx-${ID}-tbl td:first-child { text-align: left; }
      .lx-${ID}-tbl tr.lx-${ID}-end td { font-weight: 700; color: var(--ink); border-top: 2px solid var(--ink); }
      .lx-${ID}-out { margin: 14px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; font: 500 13.5px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-opt { font: 500 13.5px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-q { margin: 16px 0 0; }
      .lx-${ID}-q > p { margin: 0 0 8px; font-weight: 600; }
    `;
    document.head.appendChild(s);
  }
  // spread table: one row per layer, one column per run
  function spreadTable(kit, runs, heads, title, input) {
    const rows = Array.from({ length: LAYERS }, (_, k) =>
      `<tr${k === LAYERS - 1 ? ` class="lx-${ID}-end"` : ""}><td>layer ${k + 1}</td>${runs.map(r => `<td>${num(r.spreads[k])}</td>`).join("")}</tr>`).join("");
    return `<table class="lx-${ID}-tbl"><caption>${kit.esc(title)}</caption><thead><tr><th>spread</th>${heads.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody><tr><td>input</td>${runs.map(() => `<td>${num(input)}</td>`).join("")}</tr>${rows}</tbody></table>`;
  }
  const logTable = (kit, log, title) => kit.table(log.map(r => [`step ${r.step}`, `loss ${r.loss}, accuracy ${Math.round(r.accuracy * 100)}%`]), { head: ["step", "result"], title });
  const optMono = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  const ask = (kit, opts, correct, picked, fb) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const wire = (el, onPick) => el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => onPick(+b.dataset.i, b));

  /* 1. The situation, and the by-hand prediction for three starting scales. */
  const VERDICTS = ["Shrinks toward 0", "Stays near 1", "Blows up"];
  function byHand({ el, done, kit }) {
    ensureStyle();
    const ans = RUNS256.map(() => null);
    const right = RUNS256.map(r => verdict(r.spreads));
    const why = r => {
      const f = rough(W256, r.scale);
      return `${ROOT} × ${r.scale} × ${HALF} ≈ ${r2(f)} per layer`;
    };
    const fb = (r, i, pick) => {
      const f = rough(W256, r.scale), ok = pick === right[i];
      const size = f < 0.9 ? "less than 1" : f > 1.1 ? "more than 1" : "about 1";
      if (ok) return [`Right: ${why(r)}. ${f < 0.9 ? `Each layer keeps only part of the spread, and that happens ${LAYERS} times in a row.` : f > 1.1 ? `Each layer grows the spread, and that happens ${LAYERS} times in a row.` : `Each layer keeps the spread about where it was, so ${LAYERS} layers do too.`}`, true];
      if (pick === 1) return [`${why(r)}, which is ${size}. A factor away from 1 is applied ${LAYERS} times in a row, once per layer, so it does not stay near 1.`, false];
      const steady = "Each layer hands on about the spread it got.";
      if (pick === 0) return [`${why(r)}, which is ${size}, so the layers do not lose spread. ${f > 1.1 ? `A small-looking weight is not small once ${W256} products are added up.` : steady}`, false];
      return [`${why(r)}, which is ${size}, so nothing grows. ${f < 0.9 ? `Adding up ${W256} products is not enough to make up for weights this small.` : steady}`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>Ten layers, three starting sizes</h1>
        <p class="lead">A choir school is building an app that hears a short sung clip and names the voice part: ${PARTS.join(", ")}. Their network has ${LAYERS} layers of ${W256} units with ReLU. Before training, every weight needs a starting value. Training only moves the weights from there, so a bad start can stop the network learning before step 1. This lesson is about choosing that start.</p>
        <p class="lead">They pick random numbers around 0 and must choose how big they are: the <b>scale</b>. Here the <b>spread</b> of some numbers means how far they typically sit from their average (the standard deviation). The scale is the spread of the random weights.</p>
        <p class="lead">A rough rule for one layer: each unit adds up ${W256} inputs, each times a random weight. A sum of ${W256} random products has a spread about √${W256} = ${ROOT} times bigger than one product. ReLU then sets the negative numbers to 0, about half of them. That shrinks the spread by about √½ ≈ ${HALF}. So each layer multiplies the spread by roughly <b>${ROOT} × scale × ${HALF}</b>.</p>
        <p class="task">The input clips have a spread of about 1. For each scale, what is the spread at layer ${LAYERS}?</p>
        <div class="lpanel">${RUNS256.map((r, i) => `<div class="lcase" id="c${i}"><p>Scale ${r.scale}</p>${kit.options(VERDICTS, { picked: ans[i], correct: right[i] })}${ans[i] == null ? "" : kit.feedback(...fb(r, i, ans[i]))}</div>`).join("")}</div>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, j) => a === right[j])) done();
      }));
    };
    paint();
  }

  /* 2. Rough numbers, then the real run. */
  function roughNumbers({ el, done, kit }) {
    ensureStyle();
    const big = RUNS256[2], small = RUNS256[0];
    const Q = [
      { run: big, opts: ["About 20", "A few thousand", "About a billion"], right: last(big.spreads) < 100 ? 0 : last(big.spreads) < 1e5 ? 1 : 2 },
      { run: small, opts: ["About 0.1", "About a thousandth", "Less than a billionth"], right: last(small.spreads) > 0.01 ? 0 : last(small.spreads) > 1e-6 ? 1 : 2 }
    ];
    let q = 0, wrong = null;
    const say = (k, i) => {
      const f = rough(W256, Q[k].run.scale), p = n => num(Math.pow(f, n));
      const FB = [
        [`About 20 is ${r2(f)} × ${LAYERS}: the factor added up. But each layer multiplies what the last one gave, so it is ${r2(f)} multiplied by itself ${LAYERS} times: ${r2(f)}, ${p(2)}, ${p(3)}, ${p(4)}...`,
          null,
          `A billion would need a factor near 8 per layer. ${r2(f)} multiplied by itself ${LAYERS} times is about ${p(LAYERS)}.`],
        [`About 0.1 is where it is after one layer. Each next layer multiplies by ${r2(f)} again, ${LAYERS} times in all.`,
          `A thousandth is what three layers give: ${r2(f)} × ${r2(f)} × ${r2(f)} ≈ ${p(3)}. There are ${LAYERS} layers.`,
          null]
      ];
      return FB[k][i];
    };
    const paint = () => {
      const fin = q >= Q.length;
      el.innerHTML = `<h1>How far does it go?</h1>
        <p class="lead">Per layer, scale ${big.scale} gives a factor of about ${r2(rough(W256, big.scale))}, and scale ${small.scale} about ${r2(rough(W256, small.scale))}. Over ${LAYERS} layers the factor is applied ${LAYERS} times.</p>
        ${fin ? "" : `<p class="task">Roughly what spread does scale ${Q[q].run.scale} reach at layer ${LAYERS}?</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right both times. Here is the real run: ${plural(1000, "clip")} of ${W256} random numbers pushed through ${LAYERS} layers, once per scale, with NumPy on our Mac. The rough rule predicted ${num(Math.pow(rough(W256, big.scale), 10))} and ${num(Math.pow(rough(W256, small.scale), 10))}; the run gave ${num(last(big.spreads))} and ${num(last(small.spreads))}. The middle scale, ${RUNS256[1].scale}, stayed between ${Math.min(...RUNS256[1].spreads)} and ${Math.max(...RUNS256[1].spreads)} at every layer. Why a bit below 1? After ReLU no number is negative, so the average is above 0, and the spread is measured around that average. What matters is that it holds steady from layer to layer.`, true)
          : `${kit.options(Q[q].opts, { picked: wrong, correct: Q[q].right })}${wrong == null ? "" : kit.feedback(say(q, wrong), false)}`}</div>
        ${fin ? spreadTable(kit, RUNS256, RUNS256.map(r => `scale ${r.scale}`), `Spread (standard deviation) of the signal after each layer, width ${W256}`, INPUT_STD) : ""}
        ${fin ? `<p class="lead">A spread of ${num(last(small.spreads))} means the differences between clips have shrunk to almost nothing by layer ${LAYERS}. The gradients that would train the early layers shrink the same way. So the network starts unable to tell a soprano from a bass. A spread of ${num(last(big.spreads))} means huge outputs, a huge loss and huge gradients on the first step.</p>` : ""}`;
      wire(el, i => {
        if (i !== Q[q].right) { wrong = i; paint(); return; }
        wrong = null; q++; paint(); if (q >= Q.length) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the scale must depend on how many inputs a unit adds up. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `Keep ${RUNS256[1].scale}: it worked at ${W256} units`,
      "scale = 1 / √(number of inputs)",
      "scale = √(2 / number of inputs)",
      "Any scale: training will fix the weights anyway"
    ];
    const RIGHT = 2;
    const fb = [
      [`${RUNS256[1].scale} worked because √${W256} × ${RUNS256[1].scale} × ${HALF} ≈ ${r2(rough(W256, RUNS256[1].scale))}. With ${W64} inputs the √ part is ${Math.sqrt(W64)}, not ${ROOT}, so the same scale gives ${r2(rough(W64, RUNS256[1].scale))} per layer. The next screen checks that.`, false],
      [`Close, but it forgets ReLU. √inputs × (1 / √inputs) = 1 keeps the sum's spread, then ReLU multiplies by ${HALF}: a factor of ${HALF} per layer, and ${HALF} multiplied by itself ${LAYERS} times is about ${num(Math.pow(Math.SQRT1_2, LAYERS))}.`, false],
      [`Right. √inputs × √(2 / inputs) × √½ = 1, so the factor per layer is 1 at any width. That is <b>√(2 / inputs)</b>. For ${W256} inputs that is ${r3(HE256)}, the middle scale you just saw. The number of inputs to a unit is called its <b>fan-in</b>. This rule for ReLU layers is <b>He initialization</b>, from He and colleagues (2015), who showed it lets very deep ReLU networks train from scratch. Its idea: start the weights so the spread neither shrinks nor grows from layer to layer.`, true],
      [`Training starts from what the forward pass gives. With a spread of ${num(last(RUNS256[0].spreads))} at layer ${LAYERS}, every clip looks the same and the gradients for the early layers are just as tiny; with ${num(last(RUNS256[2].spreads))} the first update is huge. Bad starts often never recover.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A rule, not a lucky number</h1>
        <p class="lead">The team wants a smaller, faster network: the same ${LAYERS} layers, but ${W64} units each. Each unit now adds up ${W64} inputs, not ${W256}.</p>
        <p class="lead">The rough rule from the first screen, for any width: factor per layer ≈ √inputs × scale × ${HALF}, and ${HALF} is √½.</p>
        <p class="task">Which rule keeps the factor per layer at 1 at any width?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Use it with predictions: width 64. */
  function useIt({ el, done, kit }) {
    ensureStyle();
    const old = RUNS64[0], good = RUNS64[1];
    let q = 0, wrong = null;
    const fOld = rough(W64, old.scale);
    const Q = [
      { task: `First they forget to change it and keep scale ${old.scale}. What factor per layer does the rough rule give now?`,
        opts: [r2(fOld), "1", r2(fOld * 4)], right: 0,
        fb: [null, `√${W64} is ${Math.sqrt(W64)}, half of √${W256} = ${ROOT}. The same scale now gives half the factor: ${Math.sqrt(W64)} × ${old.scale} × ${HALF} ≈ ${r2(fOld)}.`, `Fewer inputs means a smaller sum, not a bigger one: ${Math.sqrt(W64)} × ${old.scale} × ${HALF} ≈ ${r2(fOld)}.`] },
      { task: `Which scale keeps ${W64}-unit layers healthy?`,
        opts: [String(old.scale), r3(HE64), r3(Math.sqrt(2 / (W64 * W64))), "0.5"], right: 1,
        fb: [`That is √(2/${W256}), the rule for ${W256} inputs. Here it gives ${r2(fOld)} per layer.`, null, `That divides by ${W64} × ${W64}, the number of weights in a layer, not the number of inputs per unit. The factor would be ${r2(rough(W64, Math.sqrt(2 / (W64 * W64))))}: everything vanishes.`, `${Math.sqrt(W64)} × 0.5 × ${HALF} ≈ ${r2(rough(W64, 0.5))} per layer: it blows up.`] }
    ];
    const paint = () => {
      const fin = q >= Q.length;
      el.innerHTML = `<h1>Narrower layers, new scale</h1>
        <p class="lead">Rule: scale = √(2 / fan-in), where fan-in is how many inputs each unit adds up. Here every layer has ${W64} units, so each unit has ${W64} inputs.</p>
        ${fin ? "" : `<p class="task">${Q[q].task}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right. The real run agrees: with ${old.scale} the spread fell to ${num(last(old.spreads))} by layer ${LAYERS} (about ${r2(realFactor(old.spreads))} per layer, measured); with √(2/${W64}) = ${r3(HE64)} it stayed between ${Math.min(...good.spreads)} and ${Math.max(...good.spreads)}. The scale is not a property of the network; it is set per layer, from that layer's fan-in.`, true)
          : `${kit.options(Q[q].opts, { picked: wrong, correct: Q[q].right, num: q === 0 })}${wrong == null ? "" : kit.feedback(Q[q].fb[wrong], false)}`}</div>
        ${fin ? spreadTable(kit, RUNS64, RUNS64.map(r => `scale ${r.scale}`), `Spread after each layer, width ${W64}`, INPUT_STD64) : ""}`;
      wire(el, i => {
        if (i !== Q[q].right) { wrong = i; paint(); return; }
        wrong = null; q++; paint(); if (q >= Q.length) done();
      });
    };
    paint();
  }

  /* 5. The same check in NumPy, a stepped replay of the traced run. */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const say = f => {
      if (f[0] === 2) return `The highlighted line sets the scale from the fan-in: √(2 / ${W256}) = ${r3(TRACE_SCALE)}. This line is He initialization.`;
      if (f[1] === "r") return `The function returns all ${f[3].length} spreads. The last one is ${last(f[3])}, close to the first one, ${f[3][0]}: the signal kept its size through ${LAYERS} layers.`;
      return `Layer ${f[2] + 1} (Python counts it as layer ${f[2]}): the loop drew fresh random weights <code>W</code>, ran the layer (multiply, then ReLU) and stored the spread: ${f[3][f[2]]}.`;
    };
    const paint = () => {
      const f = TRACE[i];
      el.innerHTML = `<h1>The check, written in NumPy</h1>
        <p class="lead">This function builds the ${LAYERS} layers with the He scale and measures the spread after each one. <code>signal</code> starts as the same ${1000} × ${W256} block of random clips. This replays a real run on our Mac. Seed 0 fixes the random numbers, so the run can be repeated.</p>
        <p class="task">Step through to the end. Watch whether the spread drifts.</p>
        ${kit.code(CODE, f[0])}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>scale <b>${r3(TRACE_SCALE)}</b></span><span>layer <b>${f[2] == null ? "–" : f[2]}</b></span><span>last spread <b>${f[3] && f[3].length ? last(f[3]) : "–"}</b></span><span>frame <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 6. Symmetry, part 1: start every weight at zero. */
  function zeros({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const z = CHOIR.zeros, end = last(z);
    const opts = ["It falls toward 0, like any start", `It stays at ${LN4} the whole time`, "It falls a little, to about 1", "It becomes NaN"];
    const RIGHT = end.loss === z[0].loss ? 1 : 0;
    const why = `Every hidden unit computes ReLU(0) = 0, so the output layer sees only zeros. The output weights' gradient is (hidden output) × (error) = 0. The hidden weights' gradient passes back through the output weights, which are 0, so it is 0 too. Nothing moves.`;
    const fb = [
      [`Not here. ${why}`, false],
      [`Right. The real run: ${STEPS} steps, and the loss never left ${end.loss}, accuracy ${Math.round(end.accuracy * 100)}%, a pure guess among ${PARTS.length} parts. ${why} The output biases do get a gradient, but with ${PARTS.length} equal-sized parts it is zero as well. ${LN4} is the loss of guessing ¼ for each part (ln ${PARTS.length}).${logTable(kit, z, "Real run, zero start")}`, true],
      [`Even falling a little needs some weight to change. ${why}`, false],
      [`NaN needs a number to blow up. Here every number stays exactly 0. ${why}`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Start at zero, to be safe?</h1>
        <p class="lead">Back to a small version of the app: clips described by 2 numbers, one hidden layer of ${HIDDEN} ReLU units, then ${PARTS.length} outputs, one per voice part. The practice data is made up: ${PARTS.length} groups of 50 clips. A teammate says: "Random starts are messy. Start every weight and bias at 0, it is neutral."</p>
        <p class="lead">At step 0 every part gets probability ¼, so the loss is ${LN4}.</p>
        <p class="task">After ${STEPS} steps of gradient descent from all zeros, what is the loss?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      wire(el, i => { ans = i; paint(); if (i === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Broken on purpose: all weights 0.5. It trains, then stalls. Find the cause in the printout. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let q = 0, wrong = null;
    const h = CHOIR.half, he = CHOIR.he;
    const lines = [HALF_LOG_END, HALF_W1, HALF_B1];
    const Q = [
      { task: "Which line shows the cause?", opts: [optMono(kit, HALF_LOG_END), optMono(kit, TRAIN_DEF), optMono(kit, HALF_W1)], right: 2,
        fb: [`That is the symptom: the loss stalled at ${last(h).loss}. It says that something is wrong, not why.`,
          `The random start used the same lr = ${LR} and reached loss ${last(he).loss}. The step size is not what holds this run back.`, null] },
      { task: "What fixes it?", opts: [`Train ${STEPS * 10} steps instead of ${STEPS}`, `Use ${HIDDEN * 4} hidden units instead of ${HIDDEN}`, "Start each weight at its own random value, scale √(2 / fan-in)", "Start every weight at 0.1 instead of 0.5"], right: 2,
        fb: [`More steps change nothing: the units get identical updates at every step, so they stay copies however long you train.`,
          `More copies of the same unit are still one unit. The new ones would start the same and move the same.`, null,
          `Any constant start gives every unit the same weights, so the same gradient. 0.1 only changes which single unit you get.`] }
    ];
    const paint = () => {
      const fin = q >= Q.length;
      el.innerHTML = `<h1>All 0.5: it trains, then stalls</h1>
        <p class="lead">The teammate fixes the zeros: every weight starts at 0.5, biases at 0. Now the loss falls. But it stalls at ${last(h).loss} and ${Math.round(last(h).accuracy * 100)}% accuracy, while a random start on the same data reached ${last(he).loss} and ${Math.round(last(he).accuracy * 100)}%. The run's printout, trimmed:</p>
        <div class="lx-${ID}-out">${lines.map(kit.esc).join("\n")}</div>
        <p class="lx-${ID}-cap">Real output of choir.py for the all 0.5 start, trimmed: the last log entry, then the first 4 of the ${HIDDEN} hidden units after training. Row 1 of W1 holds each unit's weight for input 1, row 2 for input 2. The training code is the same for every start:</p>
        <div class="lx-${ID}-out">${kit.esc(TRAIN_DEF)}</div>
        ${fin ? "" : `<p class="task">${Q[q].task}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right. Every hidden unit started with the same weights, so each one computed the same output, got the same error back, and took the same step. After ${STEPS} steps all ${HIDDEN} still match: the run counted ${HALF_DISTINCT} distinct hidden unit, against ${HE_DISTINCT} for the random start. That is the choir where every singer starts on the same note and copies the others: ${HIDDEN} voices, one note, no harmony. The network behaves as if it had one hidden unit. One unit squeezes each clip into a single number, and on that one number the ${PARTS.length} groups overlap, so it stops at ${Math.round(last(h).accuracy * 100)}%. A random start makes each unit different, so each gets its own gradient and learns its own part. This is called <b>breaking the symmetry</b>. The random start's first units: <code>${kit.esc(HE_W1)}</code>.`, true)
          : `${kit.options(Q[q].opts, { picked: wrong, correct: Q[q].right })}${wrong == null ? "" : kit.feedback(Q[q].fb[wrong], false)}`}</div>
        ${fin ? logTable(kit, h, "Real run, all 0.5 start") : ""}`;
      wire(el, i => {
        if (i !== Q[q].right) { wrong = i; paint(); return; }
        wrong = null; q++; paint(); if (q >= Q.length) done();
      });
    };
    paint();
  }

  /* 8. A sensible default: what PyTorch does, and what to call instead. */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const v = verdict(TORCH_DEFAULT);
    const fb = [
      [`Right. The real run: ${num(last(TORCH_DEFAULT))} at layer ${LAYERS}, about ${r2(realFactor(TORCH_DEFAULT))} per layer, measured. The same stack with <code>kaiming_normal_</code> (He, as below) stayed between ${Math.min(...TORCH_KAIMING)} and ${Math.max(...TORCH_KAIMING)}.`, true],
      [`The default's spread is ${r3(torchStd)}, below the He scale ${r3(HE256)}, so the factor per layer is below 1: √${W256} × ${r3(torchStd)} × ${HALF} ≈ ${r2(rough(W256, torchStd))}.`, false],
      [`The default scale is smaller than He's, not bigger: ${r3(torchStd)} against ${r3(HE256)}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What the library does for you</h1>
        <p class="lead">In PyTorch, <code>nn.Linear(${W256}, ${W256})</code> starts its weights uniformly between −1/√fan-in and +1/√fan-in: ±${r3(torchBound)} here. A uniform range like that has a spread of ${r3(torchStd)}. We stacked ${LAYERS} of them with ReLU, no bias, and measured on our Mac.</p>
        <p class="task">What happens to the spread by layer ${LAYERS}?</p>
        <div class="lpanel">${ask(kit, VERDICTS, v, ans, fb)}</div>
        ${ans === v ? `${kit.code(["layer = nn.Linear(256, 256)", "nn.init.kaiming_normal_(", "    layer.weight, nonlinearity=\"relu\")", "# for a tanh layer instead:", "gain = nn.init.calculate_gain(\"tanh\")", "nn.init.xavier_normal_(", "    layer.weight, gain=gain)"], 1)}
          <p class="lead">The default is not wrong, it is just not tuned for a deep plain ReLU stack. For ReLU, call <code>kaiming_normal_</code> with <code>nonlinearity="relu"</code>, PyTorch's name for He initialization. It sets spread = gain / √fan-in, where the gain is a multiplier picked for the activation. For ReLU the gain is √2 (${r3(GAIN_RELU)}), so this is the same √(2 / fan-in). For tanh or sigmoid layers the usual choice is <code>xavier_normal_</code> (Glorot initialization, 2010). It uses both fan-in and fan-out, the number of outputs of the layer. <code>calculate_gain("tanh")</code> returned ${r3(GAIN_TANH)}. Many deep models also add normalization layers, which rescale the signal inside the network; that is the next lesson.</p>` : ""}`;
      wire(el, i => { ans = i; paint(); if (i === v) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const CASES = [
      ["Fine-tuning a pretrained text model on your support tickets.", false, "The weights come from pretraining, not from a random start. Only a new output head, if you add one, is initialised, and the library's default is fine for a single layer."],
      ["A new 30-layer network built from plain layers, trained from scratch; the loss does not move from step 1.", true, "This is where the start matters most: many layers multiply a bad factor many times, and nothing pretrained rescues it. Measure the spread per layer before training."],
      ["A two-layer model trained from scratch with the library's default start already learns well. A teammate wants to spend a day choosing a custom initializer.", false, "With one or two layers the factor is applied only once or twice, so a start that is a little off cannot compound into a vanishing or exploding signal. The model already learns, so the start is not what holds it back."]
    ];
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When the start matters</h1>
        <p class="lead"><b>For:</b> any layer you create and train from scratch. <b>Reach for it</b> when you build a deep stack or a custom layer: He for ReLU layers, Glorot for tanh or sigmoid, never a constant. <b>Not needed</b> when you fine-tune a pretrained model (its weights are already learned), or for one or two layers, where the library default is fine. <b>Also helps:</b> in deep networks, normalization layers keep the signal's size steady during training. <b>Costs:</b> nothing at run time. A bad start costs a wasted training run, often blamed on the learning rate first. Checking costs one forward pass.</p>
        <p class="task">Should the team spend time on the starting weights here? Answer each.</p>
        ${CASES.map(([q, y, say], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? say : `${y ? "Yes, check it first." : "Not here."} ${say}`, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["After training, someone prints a hidden layer and sees that all its units have exactly the same weights.", true,
      "Yes. Identical units after training mean they started identical: a constant or zero start. Each one got the same gradient every step. Start each weight at its own random value.",
      "Units only end up identical if they were identical from the start and got the same update every step. That is a symmetry problem, so the start is the fix."],
    ["A 15-layer tanh network with 100 units per layer, before any training, outputs almost the same number for every input. Its weights were drawn with spread 0.01.", true,
      "Yes. Spread 0.01 is far below what Glorot initialization would pick for these layers, so the signal shrinks layer by layer and every input looks the same at the end.",
      "Before training only the start can be at fault. A tiny scale shrinks the signal at each of the 15 layers; Glorot initialization (xavier_normal_ in PyTorch) would size it from fan-in and fan-out."],
    ["A model that trained well with learning rate 0.001 gives a NaN loss after someone sets it to 1.0. Nothing else changed.", false,
      "No. The start is the same as in the run that worked. What changed is the step size: steps that big overshoot and blow the weights up. Lower the learning rate.",
      "The weights started exactly as in the good run, so the start cannot explain the difference. The one change was the learning rate, a thousand times bigger: the updates blow up, not the start."],
    ["A team fine-tunes a pretrained image model on 500 photos of shelf labels. It reaches 99% training accuracy and 70% on new photos.", false,
      "No. The weights came from pretraining, and the model learned the training photos well: that rules out a broken start. A big gap between training and new data is overfitting.",
      "A broken start shows up as a model that cannot learn at all. This one learned the training set almost perfectly. The problem is that it memorised 500 photos: overfitting, fixed with more data or regularization."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is it the start?</h1>
        <p class="lead">Four reports from other teams. A bad start shows up before or at the very beginning of training: a signal that shrinks or explodes through the layers, or units that are copies of each other.</p>
        <p class="task">Is the weight initialization the cause in each? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can pick a starting point</h1>
      <p class="lead">You predicted and then saw a ${LAYERS}-layer signal shrink to ${num(last(RUNS256[0].spreads))} or grow to ${num(last(RUNS256[2].spreads))}, found the rule that keeps it steady (scale √(2 / fan-in) for ReLU, He initialization), and saw why a zero or constant start leaves every hidden unit a copy of the others.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write a function that measures the spread after each layer of a deep ReLU stack, then choose the scale for each layer from its fan-in so the last spread stays near the first.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. A good start sets the spread right at step 0; normalization keeps it right while the weights change during training.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Weight initialization and why zeros fail",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/generated/torch.nn.Linear.html",
      "https://docs.pytorch.org/docs/2.15/nn.init.html",
      "https://arxiv.org/abs/1502.01852",
      "https://proceedings.mlr.press/v9/glorot10a.html"
    ],
    interview: [
      {
        q: "You train a 20-layer network you built from scratch. The loss barely moves from the first step, and the first layers' gradients are tiny. How do you check whether the initialization is to blame?",
        good: [
          "Push one batch through before training and print the spread of the activations after every layer",
          "If it shrinks or grows by a steady factor per layer, the weight scale is wrong for the layer width",
          "Use He initialization for ReLU layers and Glorot for tanh or sigmoid, sized from each layer's fan-in",
          "Check that no layer starts constant or at zero, which leaves its units identical",
          "If the network is very deep, also consider normalization layers, which rescale the signal inside the network"
        ],
        weak: "Lower the learning rate or train longer. That does not touch a signal that vanishes before the first update."
      },
      {
        q: "A colleague initialises every weight to zero \"to keep things neutral\". The model trains without errors. What do you tell them?",
        good: [
          "With zeros, every hidden unit computes the same output and gets the same gradient, so they never become different",
          "With ReLU and zero output weights, the gradients are exactly zero and the loss does not move at all",
          "Any constant start has the same problem: the layer behaves like a single unit",
          "Start each weight at its own random value; biases at zero are fine"
        ],
        weak: "Say zeros are fine because training will move the weights. That misses that identical units get identical updates."
      }
    ],
    screens: [byHand, roughNumbers, spotIdea, useIt, asCode, zeros, broken, library, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: RUNS256.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: [0, 1, 2].map(i => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
