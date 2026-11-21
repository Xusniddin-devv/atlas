/* Lesson: gradient descent. Story: the umbrella stall owner tunes one number, umbrellas per millimetre of forecast
   rain (w in "umbrellas = w × rain"), in small steps downhill on the loss instead of guessing.
   Ideas: (1) step against the gradient: new w = w − step size × gradient; the gradient gives the direction and the
   steepness, not the distance; (2) the step size (learning rate) decides everything else: too small crawls, too big
   overshoots and the loss climbs.
   Data, all real, from runs on this Mac (no model calls were recorded for this lesson):
   - docs/ai-path/runs/s2-gradient-descent/descent.py + descent.out.txt: the eight days, the nudge check, runs at
     step sizes 0.002, 0.02, 0.06, 0.08 and 0.2 from w = 1, steps needed to get the loss below 1, and the line by
     line trace of the function on the code screen (step size 0.02, 3 steps);
   - docs/ai-path/runs/s2-gradient-descent/broken.py + broken.out.txt: run A (update sign flipped, step size 0.02)
     and run B (correct code, step size 0.1), both printed by the loop itself.
   Lesson-local style: a compact multi-column table (.lx-s2-gradient-descent-*), see ensureStyle(). */
(() => {
  const ID = "s2-gradient-descent";
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const fmt = x => String(+x.toFixed(5));
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs ---------- */
  // descent.out.txt, DATA
  const RAIN = [0, 1, 2, 3, 3, 4, 5, 6];
  const SOLD = [1, 4, 5, 9, 8, 13, 15, 18];
  // descent.out.txt, NUDGE
  const NUDGE = { w: 1.0, loss: 50.625, wPlus: 1.01, lossPlus: 50.12625, grad: -50.0 };
  // descent.out.txt, RUN lines: [w, loss, grad] for steps 0..5, start w = 1
  const RUNS = {
    0.002: [[1.0, 50.625, -50.0], [1.1, 45.75, -47.49999999999999], [1.195, 41.35031249999999, -45.125], [1.28525, 37.37959453124999, -42.86875], [1.3709875, 33.79602156445312, -40.7253125], [1.452438125, 30.561846961918945, -38.689046874999995]],
    0.02: [[1.0, 50.625, -50.0], [2.0, 13.125, -25.0], [2.5, 3.75, -12.5], [2.75, 1.40625, -6.25], [2.875, 0.8203125, -3.125], [2.9375, 0.673828125, -1.5625]],
    0.06: [[1.0, 50.625, -50.0], [4.0, 13.125, 25.0], [2.5, 3.75, -12.5], [3.25, 1.40625, 6.25], [2.875, 0.8203125, -3.125], [3.0625, 0.673828125, 1.5625]],
    0.08: [[1.0, 50.625, -50.0], [5.0, 50.625, 50.0], [1.0, 50.625, -50.0], [5.0, 50.625, 50.0], [1.0, 50.625, -50.0], [5.0, 50.625, 50.0]],
    0.2: [[1.0, 50.625, -50.0], [11.0, 800.625, 200.0], [-29.0, 12800.625, -800.0], [131.0, 204800.625, 3200.0], [-509.0, 3276800.625, -12800.0], [2051.0, 52428800.625, 51200.0]]
  };
  // descent.out.txt, STEPS_TO_BELOW_1
  const BELOW1 = { 0.002: 48, 0.02: 4, 0.06: 4 };
  const BEST = { w: 3.0, loss: 0.625 }; // descent.out.txt, AVERAGES best_w, best_loss
  // broken.out.txt: [step, w, loss] printed by each loop before it updates w
  const RUN_A = { lr: 0.02, rows: [[0, 1.0, 50.625], [1, 0.0, 113.125], [2, -1.5, 253.75], [3, -3.75, 570.15625], [4, -7.125, 1282.0703125], [5, -12.1875, 2883.876953125]] };
  const RUN_B = { lr: 0.1, rows: [[0, 1.0, 50.625], [1, 6.0, 113.125], [2, -1.5, 253.75], [3, 9.75, 570.15625], [4, -7.125, 1282.0703125], [5, 18.1875, 2883.876953125]] };
  // broken.py, run_a, line for line
  const CODE_A = [
    "def run_a(rain_mm, sold, w, lr, steps):",
    "    for step in range(steps):",
    "        predicted = w * rain_mm",
    "        miss = predicted - sold",
    "        loss = np.mean(miss ** 2)",
    "        grad = np.mean(2 * miss * rain_mm)",
    "        print(step, w, loss)",
    "        w = w + lr * grad",
    "    return w"
  ];
  // descent.py, descend, line for line (line 0 = def)
  const CODE = [
    "def descend(rain_mm, sold, w, lr, steps):",
    "    for step in range(steps):",
    "        predicted = w * rain_mm",
    "        miss = predicted - sold",
    "        loss = np.mean(miss ** 2)",
    "        grad = np.mean(2 * miss * rain_mm)",
    "        w = w - lr * grad",
    "    return w"
  ];
  // descent.out.txt, TRACE lines (lr 0.02, steps 3): [line about to run, event, step, w, loss, grad, miss]
  const MISS1 = [-1.0, -3.0, -3.0, -6.0, -5.0, -9.0, -10.0, -12.0], MISS2 = [-1.0, -2.0, -1.0, -3.0, -2.0, -5.0, -5.0, -6.0], MISS3 = [-1.0, -1.5, 0.0, -1.5, -0.5, -3.0, -2.5, -3.0];
  const TRACE = [
    [1, "l", null, 1.0, null, null, null], [2, "l", 0, 1.0, null, null, null], [3, "l", 0, 1.0, null, null, null],
    [4, "l", 0, 1.0, null, null, MISS1], [5, "l", 0, 1.0, 50.625, null, MISS1], [6, "l", 0, 1.0, 50.625, -50.0, MISS1],
    [1, "l", 0, 2.0, 50.625, -50.0, MISS1], [2, "l", 1, 2.0, 50.625, -50.0, MISS1], [3, "l", 1, 2.0, 50.625, -50.0, MISS1],
    [4, "l", 1, 2.0, 50.625, -50.0, MISS2], [5, "l", 1, 2.0, 13.125, -50.0, MISS2], [6, "l", 1, 2.0, 13.125, -25.0, MISS2],
    [1, "l", 1, 2.5, 13.125, -25.0, MISS2], [2, "l", 2, 2.5, 13.125, -25.0, MISS2], [3, "l", 2, 2.5, 13.125, -25.0, MISS2],
    [4, "l", 2, 2.5, 13.125, -25.0, MISS3], [5, "l", 2, 2.5, 3.75, -25.0, MISS3], [6, "l", 2, 2.5, 3.75, -12.5, MISS3],
    [1, "l", 2, 2.75, 3.75, -12.5, MISS3], [7, "l", 2, 2.75, 3.75, -12.5, MISS3], [7, "r", 2, 2.75, 3.75, -12.5, MISS3]
  ];

  /* ---------- Derived from the data ---------- */
  const W0 = 1, LR = 0.02, BIG = 0.2;
  const lossAt = w => mean(RAIN.map((r, i) => (w * r - SOLD[i]) ** 2));
  const M = mean(RAIN.map(r => r * r));                     // average rain²
  const C = mean(RAIN.map((r, i) => r * SOLD[i]));          // average rain × umbrellas
  const gradAt = w => 2 * (M * w - C);
  const SLOPE_EST = (NUDGE.lossPlus - NUDGE.loss) / (NUDGE.wPlus - NUDGE.w);
  const R = RUNS[LR];
  const ratio = (a, b) => Math.round(a / b);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-t { border-collapse: collapse; margin-top: 18px; font: 500 15px var(--mono); max-width: 100%; }
      .lx-${ID}-t caption { text-align: left; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; padding-bottom: 6px; }
      .lx-${ID}-t th { text-align: right; font: 600 13px var(--font); color: var(--muted); padding: 4px 10px 6px; border-bottom: 2px solid var(--ink); }
      .lx-${ID}-t td { text-align: right; padding: 6px 10px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-t tr.lx-${ID}-new td { background: var(--surface); font-weight: 700; }
      .lx-${ID}-t tr.lx-${ID}-new td:first-child { box-shadow: inset 3px 0 0 var(--ink); }
      .lx-${ID}-t td.lx-${ID}-q { color: var(--faint); }
      .lx-${ID}-t td.lx-${ID}-txt, .lx-${ID}-t th.lx-${ID}-txt { text-align: left; }
      .lx-${ID}-pair { display: flex; flex-wrap: wrap; gap: 0 28px; }
      .lx-${ID}-rule { margin: 16px 0 0; padding: 10px 14px; border-left: 3px solid var(--ink); background: var(--sunk); font: 600 16px/1.5 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-opt { font: 500 14.5px/1.45 var(--mono); overflow-wrap: anywhere; }
      @media (max-width: 420px) { .lx-${ID}-t { font-size: 14px; } .lx-${ID}-t th, .lx-${ID}-t td { padding-left: 6px; padding-right: 6px; } }
    `;
    document.head.appendChild(s);
  }
  // rows: arrays of cell values (already formatted, escaped here); fresh: index of the row just written
  const grid = (kit, head, rows, { title = "", fresh = -1 } = {}) =>
    `<table class="lx-${ID}-t">${title ? `<caption>${kit.esc(title)}</caption>` : ""}<thead><tr>${head.map(h => h === "what it did" ? `<th class="lx-${ID}-txt">${kit.esc(h)}</th>` : `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) =>
      `<tr${i === fresh ? ` class="lx-${ID}-new"` : ""}>${r.map(v => v === "?" ? `<td class="lx-${ID}-q">?</td>` : isNaN(+v) ? `<td class="lx-${ID}-txt">${kit.esc(v)}</td>` : `<td>${kit.esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const mono = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  const runRows = (rows, n) => rows.slice(0, n + 1).map(([w, l], k) => [String(k), fmt(w), fmt(l)]);

  /* 1. The situation: the loss has a slope. Which way does w go? */
  function whichWay({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const far = W0 - NUDGE.grad; // "move by the slope itself"
    const down = NUDGE.w - (NUDGE.wPlus - NUDGE.w);
    const opts = [
      "Up a little: the slope is negative, so a bigger w gives a smaller loss",
      `Down: follow the slope's sign, ${fmt(NUDGE.grad)} says go lower`,
      `Up by ${fmt(-NUDGE.grad)}: the slope says how far to move`
    ];
    const fb = [
      [`Right. The loss fell when w went from ${fmt(NUDGE.w)} to ${fmt(NUDGE.wPlus)}, so more w is downhill. A negative slope means “up is downhill”, and a positive slope means “down is downhill”. Either way you move <b>against</b> the slope's sign. How far is the next question.`, true],
      [`Following the sign walks uphill. At w = ${fmt(down)} the loss is ${fmt(lossAt(down))}, higher than ${fmt(NUDGE.loss)}. A negative slope means the loss falls as w grows, so w should grow.`, false],
      [`The direction is right, the distance is not. w = ${fmt(far)} would predict ${fmt(far)} umbrellas per millimetre: the loss there is ${fmt(lossAt(far))}. The slope says how steep the loss is <i>here</i>, not how far away the bottom is.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Tuning the umbrella number</h1>
        <p class="lead">The stall owner predicts umbrellas sold from the forecast rain: <b>umbrellas = w × rain (mm)</b>. Last time you scored a guess with the loss: the mean of the squared misses. With w = ${fmt(W0)} the loss on these eight days is <b>${fmt(NUDGE.loss)}</b>. Guessing new values of w by hand is slow. This lesson shows a method that finds the number for you: follow the loss downhill. Neural networks learn their numbers the same way.</p>
        <p>Each miss is the prediction minus the sales: w × rain − sold.</p>
        ${grid(kit, ["rain mm", "sold", `w×rain`, "miss"], RAIN.map((r, i) => [String(r), String(SOLD[i]), fmt(W0 * r), fmt(W0 * r - SOLD[i])]), { title: `Eight days, w = ${fmt(W0)}` })}
        <p class="lead">Nudge w a tiny bit and watch the loss. At w = ${fmt(NUDGE.wPlus)} the loss is ${fmt(NUDGE.lossPlus)}. The change per unit of w is (${fmt(NUDGE.lossPlus)} − ${fmt(NUDGE.loss)}) ÷ ${fmt(NUDGE.wPlus - NUDGE.w)} ≈ <b>${fmt(+SLOPE_EST.toFixed(3))}</b>. That is the loss's slope at w = ${fmt(W0)}, its <b>gradient</b>. The exact value, from the derivative, is <b>${fmt(NUDGE.grad)}</b>.</p>
        <p class="task">Which way should w move to lower the loss?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 2. By hand: three fixed-size steps. Fill in the gradient, then the new w. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    let k = 0, phase = "g", wrong = null; // k = step being worked out (0..2); phase g = gradient, w = new w
    const STEPS = 3;
    const optsFor = (k, phase) => {
      const w = R[k][0], g = R[k][2], nw = R[k + 1][0];
      const raw = phase === "g"
        ? [[g, true], [-g, "sign"], [g / 2, "two"]]
        : [[nw, true], [w + LR * g, "plus"], [w - g, "whole"]];
      const rot = k % raw.length; // move the right answer around
      return raw.slice(rot).concat(raw.slice(0, rot));
    };
    const say = (why, k) => {
      const w = R[k][0], g = R[k][2];
      return {
        sign: `That is the gradient with its sign flipped. At w = ${fmt(w)} every prediction is still below the sales, so ${fmt(M)} × ${fmt(w)} is less than ${fmt(C)} and the bracket is negative.`,
        two: `You left out the 2 in front. The gradient of a mean of squares carries a factor 2: 2 × (${fmt(M)} × ${fmt(w)} − ${fmt(C)}).`,
        plus: `You added the step instead of subtracting it. w + ${LR} × (${fmt(g)}) moves uphill, and the loss there is ${fmt(lossAt(w + LR * g))}, more than ${fmt(R[k][1])} now.`,
        whole: `You subtracted the whole gradient and forgot the step size. w − (${fmt(g)}) = ${fmt(w - g)}, where the loss is ${fmt(lossAt(w - g))}. The step size ${LR} scales the gradient down first.`
      }[why];
    };
    const paint = () => {
      const fin = k >= STEPS;
      const rows = [];
      for (let j = 0; j <= Math.min(k, STEPS); j++) {
        const r = R[j];
        const showG = j < k || (j === k && phase === "w");
        rows.push([String(j), fmt(r[0]), j === STEPS ? "" : (showG ? fmt(r[2]) : "?"), fmt(r[1])]);
      }
      const opts = fin ? [] : optsFor(k, phase);
      const right = opts.findIndex(o => o[1] === true);
      el.innerHTML = `<h1>Three steps by hand</h1>
        <p class="lead">For this rule the gradient has a short formula (the code screen later shows the long form). It needs only two averages from the eight days: rain² averages <b>${fmt(M)}</b>, and rain × umbrellas averages <b>${fmt(C)}</b>. Each step moves w by the gradient times a small fixed number, the <b>step size</b>, here ${LR}. The minus sign makes w move against the gradient:</p>
        <div class="lx-${ID}-rule">gradient = 2 × (${fmt(M)} × w − ${fmt(C)})<br>new w = w − ${LR} × gradient</div>
        ${grid(kit, ["step", "w", "gradient", "loss"], rows, { fresh: rows.length - 1 })}
        ${fin ? "" : `<p class="task">Step ${k + 1}: ${phase === "g" ? `what is the gradient at w = ${fmt(R[k][0])}?` : `what is the new w?`}</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`Done. The loss went ${R.slice(0, STEPS + 1).map(r => fmt(r[1])).join(" → ")}. Look at the gradient column: it halved each step, so each step was half as long as the one before. Nobody shrank the step size. The slope flattens near the bottom, and the steps shrink on their own.`, true)
          : `${kit.options(opts.map(o => fmt(o[0])), { picked: wrong, correct: right, num: true })}${wrong != null ? kit.feedback(say(opts[wrong][1], k), false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== right) { wrong = i; paint(); return; }
        wrong = null;
        if (phase === "g") phase = "w"; else { phase = "g"; k++; }
        paint();
        if (k >= STEPS) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: a step size ten times larger. */
  function tenTimes({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const B = RUNS[BIG];
    const opts = [
      `It reaches the bottom in one step instead of three`,
      `w lands far past the bottom and the loss climbs, more each step`,
      `Nothing changes: the gradient alone decides how far w moves`
    ];
    const run = grid(kit, ["step", "w", "loss"], runRows(B, 4), { title: `Real run, step size ${BIG}` });
    const fb = [
      [`The first step is ${BIG} × ${fmt(-B[0][2])} = ${fmt(B[1][0] - B[0][0])} long. From w = ${fmt(W0)} that lands at ${fmt(B[1][0])}, far past the bottom, where the loss is ${fmt(B[1][1])}. A bigger step only helps if the slope stays the same that far away. It does not.`, false],
      [`Right. The real run:${run}At w = ${fmt(B[1][0])} the slope is steep the other way (${fmt(B[1][2])}), so the next step is even longer and lands further out on the other side. The gradient tells you <b>which way</b> and <b>how steep it is here</b>. It does not tell you how far away the bottom is. The step size, called the <b>learning rate</b>, decides how far you trust the slope you measured here. That is <b>gradient descent</b>: repeat “w = w − learning rate × gradient”, with a learning rate small enough that each step lands lower.`, true],
      [`The step is learning rate × gradient, so both decide its length. Ten times the learning rate means a ten times longer first step: ${fmt(BIG * -B[0][2])} instead of ${fmt(LR * -B[0][2])}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Ten times bigger steps</h1>
        <p class="lead">Your three steps with step size ${LR} took the loss from ${fmt(R[0][1])} to ${fmt(R[3][1])}. The owner is impatient and wants to get there faster. He tries step size <b>${BIG}</b>, ten times larger, from the same start w = ${fmt(W0)}.</p>
        <p class="task">What happens to the loss?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it with predictions: three other learning rates. */
  function predictRates({ el, done, kit }) {
    ensureStyle();
    let q = 0, wrong = null;
    const A = RUNS[0.06], O = RUNS[0.08], S = RUNS[0.002];
    const Q = [
      { lr: 0.06, shown: 1,
        task: `With learning rate 0.06, step 1 jumped from w = ${fmt(A[0][0])} to ${fmt(A[1][0])}, past the bottom: the gradient there is now ${fmt(A[1][2])}, positive. Does step 2 lower the loss?`,
        opts: [`Yes: w comes back down and the loss falls again`, `No: it overshot, so it is blowing up like step size ${BIG}`],
        right: 0,
        fb: [null, `Overshooting is not the problem by itself. What matters is whether it lands closer to the bottom than it started. Step 1 landed ${fmt(Math.abs(A[1][0] - BEST.w))} from the best w (${fmt(BEST.w)}), closer than the ${fmt(Math.abs(A[0][0] - BEST.w))} it started from. Step size ${BIG} landed ${fmt(Math.abs(RUNS[BIG][1][0] - BEST.w))} away.`] },
      { lr: 0.08, shown: 1,
        task: `With learning rate 0.08, step 1 jumped from w = ${fmt(O[0][0])} to ${fmt(O[1][0])}. The loss is ${fmt(O[1][1])}, exactly what it was. What do the next steps do?`,
        opts: [`The loss slowly comes down`, `The loss explodes`, `w bounces back and forth and the loss never moves`],
        right: 2,
        fb: [`The gradient at w = ${fmt(O[1][0])} is ${fmt(O[1][2])}, the mirror of the start. The same step size sends w back exactly as far, to ${fmt(O[2][0])}. Nothing shrinks.`, `To explode, each landing has to be further from the bottom. Here both points are the same distance, ${fmt(Math.abs(O[0][0] - BEST.w))}, from the best w ${fmt(BEST.w)}, so the loss repeats instead of growing.`, null] },
      { lr: 0.002, shown: 5,
        task: `With learning rate 0.002 the loss falls, but slowly: ${fmt(S[5][1])} after 5 steps. Learning rate ${LR} got below 1 in ${BELOW1[LR]} steps. About how many steps does 0.002 need?`,
        opts: [`Also about ${BELOW1[LR]}: it is going the right way`, `About ${BELOW1[0.002]}`, `It never gets below 1`],
        right: 1,
        fb: [`Same direction, much shorter steps. Each step here moves w ${fmt(LR / 0.002)} times less than with ${LR}, and they shrink as the slope flattens.`, null, `It does get there: every step is downhill, just short. A step size that is too small never fails, it just costs more steps.`] }
    ];
    const done3 = () => grid(kit, ["lr", "loss, step 5", "what it did"], [
      ["0.002", fmt(S[5][1]), `crawls, ${BELOW1[0.002]}`],
      [String(LR), fmt(R[5][1]), `steady, ${BELOW1[LR]}`],
      ["0.06", fmt(A[5][1]), `zigzags, ${BELOW1[0.06]}`],
      ["0.08", fmt(O[5][1]), "bounces, never"],
      [String(BIG), fmt(RUNS[BIG][5][1]), "climbs, never"]
    ], { title: "Five real runs from w = 1. The count: steps until the loss is below 1" });
    const paint = () => {
      const fin = q >= Q.length, c = Q[Math.min(q, Q.length - 1)];
      const runs = Q.slice(0, fin ? Q.length : q + 1);
      el.innerHTML = `<h1>Predict the next step</h1>
        <p class="lead">Same eight days, same start w = ${fmt(W0)}, three other learning rates (lr in the tables). The best w for these days is ${fmt(BEST.w)}, with loss ${fmt(BEST.loss)}. That loss is not 0 because no single w fits every day exactly.</p>
        <div class="lx-${ID}-pair">${runs.map((x, i) => grid(kit, ["step", "w", "loss"], runRows(RUNS[x.lr], i < q || fin ? (x.lr === 0.002 ? 5 : 3) : x.shown), { title: `lr ${x.lr}` })).join("")}</div>
        ${fin ? "" : `<p class="task">${c.task}</p>`}
        <div class="lpanel">${fin
          ? `${done3()}${kit.feedback(`Too small crawls, ${ratio(BELOW1[0.002], BELOW1[LR])} times more steps than ${LR}. A bit too big zigzags but still lands lower each time. At 0.08 it bounces forever, and above that it climbs. The shape of the first few losses tells you which case you are in.`, true)}`
          : `${kit.options(c.opts, { picked: wrong, correct: c.right })}${wrong != null ? kit.feedback(c.fb[wrong], false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== Q[q].right) { wrong = i; paint(); return; }
        wrong = null; q++; paint();
        if (q >= Q.length) done();
      });
    };
    paint();
  }

  /* 5. The same loop in Python: a stepped replay of the traced run. */
  const SHOW = new Set([3, 4, 5, 6]);
  const FR = (() => {
    const fr = [{ ln: 0, v: TRACE[0], start: true }];
    for (let k = 1; k < TRACE.length; k++) {
      const prev = TRACE[k - 1], v = TRACE[k];
      if (v[1] === "r") { fr.push({ ln: 7, v, end: true }); continue; }
      if (prev[1] === "l" && SHOW.has(prev[0])) fr.push({ ln: prev[0], v });
    }
    return fr;
  })();
  const sayFrame = (kit, f) => {
    const [, , step, w, loss, grad, miss] = f.v;
    if (f.start) return `The function starts with w = ${fmt(w)}, learning rate ${LR}, 3 steps. <code>rain_mm</code> and <code>sold</code> are NumPy arrays of the eight days, so one line works on all eight at once.`;
    if (f.end) return `The loop ran 3 times and returns w = ${fmt(w)}, the same three steps you did by hand.`;
    if (f.ln === 3) return `Pass <code>step = ${step}</code> (Python counts from 0). <code>miss</code> is every day's prediction minus its sales: ${kit.esc(miss.map(fmt).join(", "))}.`;
    if (f.ln === 4) return `The loss: the mean of the squared misses, ${fmt(loss)}. The loop does not need it to move, but you print it to watch the run.`;
    if (f.ln === 5) return `The gradient: the mean of 2 × miss × rain over the eight days, ${fmt(grad)}. This is the long form of 2 × (${fmt(M)} × w − ${fmt(C)}).`;
    if (f.ln === 6) return `The update moves w against the gradient: w is now ${fmt(w)}.`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i], [, , step, w, loss, grad] = f.v;
      el.innerHTML = `<h1>The loop in NumPy</h1>
        <p class="lead">This is the whole method: compute the misses, the loss and the gradient from all eight days, take one step, repeat. This replays a real run with learning rate ${LR} and 3 steps.</p>
        <p class="task">Step through it. Check each value against your table from the by-hand screen.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>step <b>${step == null ? "–" : step}</b></span><span>w <b>${fmt(w)}</b></span><span>loss <b>${loss == null ? "–" : fmt(loss)}</b></span><span>grad <b>${grad == null ? "–" : fmt(grad)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. Broken on purpose: two runs with the same climbing loss. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let q = 0, wrong = null;
    const lines = [2, 3, 4, 5, 7]; // CODE_A lines offered as causes
    const BUG = 7;
    const Q = [
      { task: "Both losses are identical. One run has a bug in its code. The other has correct code and too big a learning rate. Which run has the bug?",
        opts: ["Run A", "Run B"], right: 0,
        fb: [null, `Look at w in run B: ${RUN_B.rows.slice(0, 4).map(r => fmt(r[1])).join(", ")}. It jumps from one side of the best w (${fmt(BEST.w)}) to the other, a bit further each time. That is overshooting: correct direction, steps too long. Run A's w only goes one way.`] },
      { task: "Here is run A's code. Which line causes the climb?",
        opts: lines.map(l => mono(kit, CODE_A[l].trim())), right: lines.indexOf(BUG),
        fb: lines.map(l => l === BUG ? null : ({
          2: "The prediction is w × rain, the same rule as before. It is fine.",
          3: "Prediction minus sales, as in the working loop. If it were flipped, the gradient's sign would flip too, but this line matches the code you stepped through.",
          4: "The loss line only measures. Even a wrong loss here would not move w: w changes on one line only.",
          5: "This is the same gradient line as in the working loop. Check it: w went from 1 to 0 under w + 0.02 × grad, so grad was −50, the value you computed by hand. The gradient is right; the sign it is used with is the problem."
        }[l] || "")) },
      { task: `And run B, with correct code and learning rate ${RUN_B.lr}: what is the fix?`,
        opts: [`Flip the update to w + lr * grad`, `Run more steps`, `Lower the learning rate, for example to ${LR}`], right: 2,
        fb: [`Run B's update already goes against the gradient. Flipping it gives run A: always uphill.`, `Each step makes it worse; more steps only make the loss bigger.`, null] }
    ];
    const tables = `<div class="lx-${ID}-pair">${grid(kit, ["step", "w", "loss"], RUN_A.rows.map(r => r.map(fmt)), { title: `run A, lr ${RUN_A.lr}` })}${grid(kit, ["step", "w", "loss"], RUN_B.rows.map(r => r.map(fmt)), { title: `run B, lr ${RUN_B.lr}` })}</div>`;
    const paint = () => {
      const fin = q >= Q.length, c = Q[Math.min(q, Q.length - 1)];
      el.innerHTML = `<h1>Two runs that climb</h1>
        <p class="lead">A colleague ran two versions of the loop on the same eight days, both from w = ${fmt(W0)}. Each prints step, w and loss before it moves w. In both runs the loss climbs.</p>
        ${tables}
        ${q >= 1 ? kit.code(CODE_A, q >= 2 ? BUG : -1) : ""}
        ${fin ? "" : `<p class="task">${c.task}</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`Right. Run A adds the gradient: <code>w + lr * grad</code> walks uphill at every step, so w drifts steadily one way (${RUN_A.rows.slice(0, 4).map(r => fmt(r[1])).join(", ")}). Run B overshoots and flips sides. The loss column cannot tell them apart. The w column can: one way only means a sign bug; flipping sides means the step is too long.`, true)
          : `${kit.options(c.opts, { picked: wrong, correct: c.right })}${wrong != null ? kit.feedback(c.fb[wrong], false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== Q[q].right) { wrong = i; paint(); return; }
        wrong = null; q++; paint();
        if (q >= Q.length) done();
      });
    };
    paint();
  }

  /* 7. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    let ans = null;
    const opts = [
      "Raise the learning rate a little and watch the first few losses",
      "Flip the sign of the update",
      "Stop: the model has converged"
    ];
    const fb = [
      ["Right. A slow, steady fall from the first step, still far from a good loss, is the “too small” shape you saw with 0.002. A larger learning rate saves steps; watch the first losses so you notice if it starts to zigzag or climb.", true],
      ["The loss is falling, so the update already goes downhill. A flipped sign would make it climb.", false],
      ["Converged means more steps no longer lower the loss. Here every step still lowers it and the loss is still far above what a similar model reached, so the run is not done; it is just slow. Near the bottom steps shrink on their own, but this run crawled from the start.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What:</b> gradient descent repeats one step: w = w − learning rate × gradient. With a good learning rate, each step lowers the loss a little.</p>
        <p class="lead"><b>For:</b> finding a model's numbers by lowering a loss whose slope you can compute. With many numbers, the gradient has one entry per number, and every number takes its own step. Neural networks are trained this way.</p>
        <p class="lead"><b>Not for:</b> a small problem with a direct formula. scikit-learn's <code>LinearRegression</code> finds the best squared-error line with a formula, with no steps. Not for a choice among a few options or whole numbers: try them all. Not for a loss with no useful slope.</p>
        <p class="lead"><b>Costs:</b> every step reads the data. On large data, each step uses one row or a small batch of rows instead of all of them (stochastic or mini-batch gradient descent). You must also tune the learning rate and the number of steps, and a bad choice wastes runs.</p>
        <p class="task">A new training run's loss has fallen slowly and steadily from the very first step. After many thousands of steps it is still far above the loss a similar model reached. What do you try first?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A delivery firm predicts trip minutes as a weighted sum of 30 numbers per trip (distance, stops, hour…), scored by mean squared error. It has 200 million past trips, far too many to load into memory at once.", true,
      "Yes. The loss has a slope for each of the 30 weights, so the gradient has 30 entries and every step moves all 30 at once. With this many rows, each step can use a small batch of trips instead of all of them.",
      "A direct formula would need all 200 million rows at once, and they do not fit in memory. The squared-error loss has a slope for every weight, so gradient descent can step on small batches of trips."],
    ["A shop chooses how many cashiers to schedule on Saturday, 1 to 5, by simulating the queue for each choice.", false,
      "No. The choice is a whole number among five; there is no 2.37 cashiers to step to, so there is no slope to follow. Five simulations try every option and give the exact best.",
      "There is nothing between 2 and 3 cashiers, so a small step and a slope make no sense. With only five choices, try them all: it is exact and cheap."],
    ["A team trains a neural network with millions of weights to label product photos, using a smooth loss (one that changes a little when a weight changes a little).", true,
      "Yes. With millions of weights no formula gives the answer directly, and the loss has a slope for each weight. This is the standard way such networks are trained.",
      "Millions of weights and a smooth loss: no direct formula, and trying values is hopeless. Stepping all weights against the gradient is how such networks are trained."],
    ["A spam filter's settings are scored by the number of misclassified emails, and the team wants to tune them by gradient descent on that count.", false,
      "No. A tiny change to a setting usually flips no email, so the count does not change: its slope is zero almost everywhere, then it jumps. The gradient says “flat” and the settings never move. You need a smooth loss instead, which is what later lessons use.",
      "Nudge a setting a little and the count of mistakes usually stays the same, so the slope is zero; at some point it jumps. Zero slope means zero step. Gradient descent needs a loss that changes smoothly."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Gradient descent or not?</h1>
        <p class="lead">Four tuning problems from other teams.</p>
        <p class="task">Would you tune each one with gradient descent? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can walk downhill</h1>
      <p class="lead">You stepped w against the gradient by hand, saw that the learning rate decides whether the loss crawls, falls, bounces or climbs, stepped through the ${CODE.length}-line NumPy function, and told a sign bug from a too-big step by reading w.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the gradient descent loop for the umbrella rule in NumPy and choose a learning rate that gets the loss below a target within a fixed number of steps.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The same loop with several inputs: the gradient becomes one number per weight.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Gradient descent: walking downhill on the loss",
    checked: "2026-11-13",
    sources: [
      "https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent",
      "https://developers.google.com/machine-learning/crash-course/linear-regression/hyperparameters",
      "https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LinearRegression.html",
      "https://scikit-learn.org/stable/modules/sgd.html",
      "https://developers.google.com/machine-learning/crash-course/neural-networks/backpropagation",
      "https://numpy.org/doc/stable/reference/generated/numpy.mean.html"
    ],
    interview: [
      {
        q: "You start training and the loss goes up from the first few steps. How do you find out why?",
        good: [
          "Look at how the weights move, not only the loss: drifting steadily one way suggests a sign bug in the update",
          "Weights jumping from side to side, further each time, mean the learning rate is too big",
          "Rerun a few steps with the learning rate ten times smaller and see if the loss starts to fall",
          "Check the gradient against a nudge estimate: change one weight a little and compare the loss change"
        ],
        weak: "Train for longer or try a bigger model. That ignores that a climbing loss from step one means the steps themselves go wrong."
      },
      {
        q: "You are training a new model, you have no idea what learning rate to use, and your budget allows a few short runs before the real one. How do you pick it?",
        good: [
          "Try a few values spaced by factors of ten for a short run each",
          "Read the first losses: slow steady fall is too small, zigzag or climbing is too big",
          "Pick about the largest value whose loss still falls steadily, then watch the full run",
          "Mention the cost: a too-small rate wastes steps, a too-large one wastes the run"
        ],
        weak: "Always use the library's default value. Defaults can be fine, but the answer misses how to tell from the loss that a rate is wrong."
      }
    ],
    screens: [whichWay, byHand, tenTimes, predictRates, asCode, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(6).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
