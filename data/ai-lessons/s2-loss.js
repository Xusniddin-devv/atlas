/* Lesson: loss, one number for how wrong a model is. Story: a market stall owner, Mira, wants a rule that predicts
   umbrellas sold per day from the forecast rainfall, and needs a fair way to say which of two rules fits better.
   Ideas: (1) a miss is "sold minus what the rule said"; plain misses cancel, so square each one and take the mean:
   mean squared error (MSE), lower is better; (2) the loss is a function of the model's numbers, so trying other
   numbers and keeping the lowest is how a line gets fitted (the valley over the slope).
   Data, all real:
   - docs/ai-path/runs/s2-loss/loss.py + loss.out.txt (NumPy, env.txt): the eight story days, the misses and MSE of
     the owner's rule and of the flat line, the traced mse() call shown on the code screen, the loss for seven
     slopes with the base held at 7, and the least-squares floor. The eight days are made-up story data, not
     measured sales; every other number on screen is computed below from them, and matches the run.
   No recorded model calls. Lesson-local picture: a small SVG scatter plot with lines and miss segments, and a
   lesson-local table (.lx-s2-loss-*), see ensureStyle() and plot(). Plain browser script. */
(() => {
  const ID = "s2-loss";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => sum(a) / a.length;
  const fmt = (n, d = 2) => { const r = Math.round(n * 10 ** d) / 10 ** d; return Object.is(r, -0) ? "0" : String(r).replace("-", "−"); };
  const sgn = n => (n > 0 ? "+" : "") + fmt(n);

  /* ---------- Data copied from docs/ai-path/runs/s2-loss/loss.out.txt ---------- */
  const RAIN = [0, 2, 3, 5, 6, 8, 10, 14];       // forecast rain, mm (story data)
  const SOLD = [8, 9, 13, 13, 17, 18, 23, 27];   // umbrellas sold (story data)
  const RULE = { slope: 2, base: 4 };            // the owner's rule: 2 per mm, plus 4
  const FLAT = { slope: 0, base: 16 };           // "16 every day"
  // TRACE mse(rain_mm, umbrellas, 2.0, 4.0): [line about to run, event, predicted, misses, squared]
  const TRACE = [
    [1, "line", null, null, null],
    [2, "line", [4, 8, 10, 14, 16, 20, 24, 32], null, null],
    [3, "line", [4, 8, 10, 14, 16, 20, 24, 32], [4, 1, 3, -1, 1, -2, -1, -5], null],
    [4, "line", [4, 8, 10, 14, 16, 20, 24, 32], [4, 1, 3, -1, 1, -2, -1, -5], [16, 1, 9, 1, 1, 4, 1, 25]],
    [4, "return", [4, 8, 10, 14, 16, 20, 24, 32], [4, 1, 3, -1, 1, -2, -1, -5], [16, 1, 9, 1, 1, 4, 1, 25]]
  ];
  const RETURNED = 7.25;
  const VALLEY_BASE = 7;
  const VALLEY = [[0, 119.25], [0.5, 52.8125], [1, 13.5], [1.5, 1.3125], [2, 16.25], [2.5, 58.3125], [3, 127.5]];
  // two rules on eight days (loss.py part 5): misses
  const EVEN = [2, -2, 2, -2, 2, -2, 2, -2], ONE_BIG = [0, 0, 0, 0, 0, 0, 0, 8];
  // listings: the functions in loss.py, line for line (line 0 = def)
  const CODE_MSE = [
    "def mse(rain_mm, umbrellas, slope, base):",
    "    predicted = slope * rain_mm + base",
    "    misses = umbrellas - predicted",
    "    squared = misses ** 2",
    "    return squared.mean()"
  ];
  const CODE_SLOPES = [
    "slopes = np.arange(0, 3.01, 0.5)",
    "losses = [mse(rain_mm, umbrellas,",
    "              slope, 7.0)",
    "          for slope in slopes]"
  ];

  /* ---------- Derived from the data ---------- */
  const N = RAIN.length;
  const predict = (l, r) => l.slope * r + l.base;
  const missesOf = l => SOLD.map((s, i) => s - predict(l, RAIN[i]));
  const mseOf = l => mean(missesOf(l).map(m => m * m));
  const M_RULE = missesOf(RULE), M_FLAT = missesOf(FLAT);
  const MSE_RULE = mseOf(RULE), MSE_FLAT = mseOf(FLAT);
  const SQ_RULE = M_RULE.map(m => m * m);
  const BIG = M_RULE.reduce((b, m, i) => Math.abs(m) > Math.abs(M_RULE[b]) ? i : b, 0);
  const MEAN_RAIN = mean(RAIN), MEAN_SOLD = mean(SOLD);
  // least squares (the lowest MSE any straight line reaches), closed form; matches numpy.polyfit in loss.out.txt
  const FIT = (() => {
    const sxy = sum(RAIN.map((r, i) => (r - MEAN_RAIN) * (SOLD[i] - MEAN_SOLD))), sxx = sum(RAIN.map(r => (r - MEAN_RAIN) ** 2));
    const slope = sxy / sxx; return { slope, base: MEAN_SOLD - slope * MEAN_RAIN };
  })();
  const MSE_FIT = mseOf(FIT);
  const rms = a => Math.sqrt(mean(a.map(m => m * m)));
  const absMean = a => mean(a.map(Math.abs));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-plot { display: block; width: 100%; max-width: 520px; height: auto; margin: 16px 0 4px; }
      .lx-${ID}-plot text { font: 500 11px var(--mono); fill: var(--muted); }
      .lx-${ID}-plot .ax { stroke: var(--line); stroke-width: 1; }
      .lx-${ID}-plot .pt { fill: var(--ink); }
      .lx-${ID}-plot .ring { fill: none; stroke: var(--ink); stroke-width: 3; }
      .lx-${ID}-plot .ln { stroke: var(--ink); stroke-width: 2.5; fill: none; }
      .lx-${ID}-plot .ln2 { stroke: var(--ink-2); stroke-width: 2; stroke-dasharray: 7 5; fill: none; }
      .lx-${ID}-plot .miss { stroke: var(--muted); stroke-width: 2; stroke-dasharray: 2 3; }
      .lx-${ID}-plot .miss.big { stroke: var(--bad); stroke-dasharray: none; stroke-width: 3; }
      .lx-${ID}-plot .day { font: 600 11px var(--mono); fill: var(--ink-2); }
      .lx-${ID}-key { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 14px; color: var(--muted); margin: 0 0 6px; }
      .lx-${ID}-key svg { vertical-align: middle; margin-right: 6px; }
      .lx-${ID}-tw { overflow-x: auto; margin: 14px 0 0; }
      .lx-${ID}-t { border-collapse: collapse; width: 100%; font: 500 14.5px var(--mono); }
      .lx-${ID}-t th { font: 600 12.5px var(--font); color: var(--muted); text-align: right; padding: 6px 6px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-t td { text-align: right; padding: 7px 6px; border-bottom: 1px solid var(--line); color: var(--ink); }
      .lx-${ID}-t th:first-child, .lx-${ID}-t td:first-child { text-align: left; }
      .lx-${ID}-t td.q { color: var(--faint); }
      .lx-${ID}-t tr.now td { box-shadow: inset 0 -2.5px 0 var(--ink); font-weight: 700; }
      .lx-${ID}-t tr.tot td { font-weight: 700; border-bottom: 0; }
      .lx-${ID}-ctl { display: grid; grid-template-columns: auto 1fr auto; gap: 8px 12px; align-items: center; margin-top: 12px; max-width: 420px; }
      .lx-${ID}-ctl .btn { min-height: 48px; min-width: 56px; justify-content: center; font-size: 20px; }
      .lx-${ID}-ctl span { font: 600 16px var(--mono); text-align: center; }
      .lx-${ID}-score { font: 700 22px var(--mono); margin: 12px 0 0; }
      .lx-${ID}-score small { font: 500 14px var(--font); color: var(--muted); margin-left: 6px; }
    `;
    document.head.appendChild(s);
  }

  /* SVG scatter: the eight days, optional lines, miss segments for one line, ringed day. */
  const W = 340, H = 220, PL = 34, PR = 10, PT = 12, PB = 30, XMAX = 15, YMAX = 36;
  const sx = x => PL + x / XMAX * (W - PL - PR), sy = y => PT + (1 - y / YMAX) * (H - PT - PB);
  function plot(kit, { lines = [], misses = null, ring = -1, big = -1, days = true, title = "" } = {}) {
    const ticks = [0, 5, 10, 15].map(x => `<line class="ax" x1="${sx(x)}" x2="${sx(x)}" y1="${sy(0)}" y2="${sy(0) + 4}"/><text x="${sx(x)}" y="${sy(0) + 16}" text-anchor="middle">${x}</text>`).join("")
      + [0, 10, 20, 30].map(y => `<line class="ax" x1="${PL - 4}" x2="${W - PR}" y1="${sy(y)}" y2="${sy(y)}" opacity="${y ? .5 : 1}"/><text x="${PL - 7}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`).join("");
    const ln = lines.map(([l, c]) => `<line class="${c}" x1="${sx(0)}" y1="${sy(predict(l, 0))}" x2="${sx(XMAX)}" y2="${sy(predict(l, XMAX))}"/>`).join("");
    const ms = misses ? RAIN.map((r, i) => `<line class="miss${i === big ? " big" : ""}" x1="${sx(r)}" x2="${sx(r)}" y1="${sy(SOLD[i])}" y2="${sy(predict(misses, r))}"/>`).join("") : "";
    const pts = RAIN.map((r, i) => `<circle class="pt" cx="${sx(r)}" cy="${sy(SOLD[i])}" r="4.5"/>${i === ring ? `<circle class="ring" cx="${sx(r)}" cy="${sy(SOLD[i])}" r="10"/>` : ""}${days ? `<text class="day" x="${sx(r) + (i === 0 ? 9 : -9)}" y="${SOLD[i] < predict(RULE, r) ? sy(SOLD[i]) + (i === ring ? 22 : 17) : sy(SOLD[i]) - (i === ring ? 14 : 8)}" text-anchor="middle">${i + 1}</text>` : ""}`).join("");
    return `<svg class="lx-${ID}-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${kit.esc(title || "Umbrellas sold against forecast rain, eight days")}">
      <defs><clipPath id="lx-${ID}-clip"><rect x="${PL}" y="${PT}" width="${W - PL - PR}" height="${H - PT - PB}"/></clipPath></defs>
      ${ticks}<g clip-path="url(#lx-${ID}-clip)">${ln}${ms}</g>${pts}
      <text x="${W - PR}" y="${H - 2}" text-anchor="end">forecast rain (mm)</text>
      <text x="${PL + 4}" y="${PT + 10}">umbrellas sold</text></svg>`;
  }
  const keyLine = (cls, text) => `<span><svg width="30" height="10" aria-hidden="true" class="lx-${ID}-plot" style="display:inline;margin:0 6px 0 0;width:30px"><line class="${cls}" x1="0" y1="5" x2="30" y2="5"/></svg>${text}</span>`;
  function table(kit, head, rows, { now = -1, tot = null } = {}) {
    const tr = (r, c) => `<tr${c ? ` class="${c}"` : ""}>${r.map(v => v === "?" ? `<td class="q">?</td>` : `<td>${kit.esc(v)}</td>`).join("")}</tr>`;
    return `<div class="lx-${ID}-tw"><table class="lx-${ID}-t"><thead><tr>${head.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => tr(r, i === now ? "now" : "")).join("")}${tot ? tr(tot, "tot") : ""}</tbody></table></div>`;
  }
  const ask = (kit, opts, correct, picked, fbs) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  const ruleTxt = l => `${fmt(l.slope)} × rain + ${fmt(l.base)}`;

  /* 1. The situation: where does the owner's rule miss most? */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const paint = () => {
      const ok = ans === BIG;
      el.innerHTML = `<h1>How wrong is the umbrella rule?</h1>
        <p class="lead">Mira runs a market stall. On rainy days she sells umbrellas, and she wants to know the night before how many to bring. Her rule: <b>2 umbrellas per mm of forecast rain, plus 4</b>. A rule like this is a small model. Before anyone can improve a model, they need to measure how wrong it is. This lesson builds that measure.</p>
        <p class="lead">Below are eight days she wrote down: forecast rain and umbrellas sold. The line is her rule. Each dotted stroke shows how far one day is from the line.</p>
        ${plot(kit, { lines: [[RULE, "ln"]], misses: RULE, ring: ans == null ? -1 : ans, big: ok ? BIG : -1 })}
        <p class="task">Which day did the rule miss by the most umbrellas? Tap its number.</p>
        <div class="lpanel">${kit.cells(RAIN.map((_, i) => String(i + 1)), { labels: RAIN.map(r => r + " mm"), pick: true, cls: ans == null ? {} : { [ans]: ok ? "next" : "dup" } })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. On day ${BIG + 1} the forecast was ${RAIN[BIG]} mm, so the rule said ${predict(RULE, RAIN[BIG])}. She sold ${SOLD[BIG]}: off by ${Math.abs(M_RULE[BIG])}. We write a <b>miss</b> as <i>sold minus what the rule said</i>: ${SOLD[BIG]} − ${predict(RULE, RAIN[BIG])} = ${fmt(M_RULE[BIG])}. A minus means the rule said too many; a plus means too few.`, true)
          : kit.feedback(`Day ${ans + 1}: forecast ${RAIN[ans]} mm, the rule said ${predict(RULE, RAIN[ans])}, she sold ${SOLD[ans]}, so it was off by ${Math.abs(M_RULE[ans])}. ${Math.abs(M_RULE[ans]) === Math.abs(M_RULE[BIG]) ? "" : "Another day sits further from the line: compare the lengths of the strokes."}`, false)}</div>`;
      el.querySelectorAll(".cell").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === BIG) done(); });
    };
    paint();
  }

  /* 2. By hand: fill in the misses. */
  const ASK_DAYS = [0, 2, 6]; // their three options (miss, minus miss, miss without the base) are all different
  function fillMisses({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k >= ASK_DAYS.length, d = fin ? -1 : ASK_DAYS[k];
      const known = i => fin || ASK_DAYS.indexOf(i) < k || !ASK_DAYS.includes(i);
      const rows = RAIN.map((r, i) => [`day ${i + 1}`, String(r), String(SOLD[i]), String(predict(RULE, r)), known(i) ? fmt(M_RULE[i]) : "?"]);
      const m = fin ? 0 : M_RULE[d], noBase = fin ? 0 : SOLD[d] - RULE.slope * RAIN[d];
      const opts = fin ? [] : [m, -m, noBase];
      const order = [0, 2, 1].map(j => opts[j]);
      const fbFor = v => v === -m
        ? `That is the rule minus what she sold. Keep one order every time: <b>sold minus the rule</b>, so a plus always means the rule said too few.`
        : `You left out the “plus ${RULE.base}”. The rule says ${RULE.slope} × ${RAIN[d]} + ${RULE.base} = ${predict(RULE, RAIN[d])}.`;
      el.innerHTML = `<h1>Fill in the misses</h1>
        <p class="lead">Each row is one day. “Rule says” is ${RULE.slope} × rain + ${RULE.base}. The miss is sold minus rule says.</p>
        ${table(kit, ["", "rain mm", "sold", "rule says", "miss"], rows, { now: d, tot: fin ? ["total", "", "", "", fmt(sum(M_RULE))] : null })}
        ${fin ? "" : `<p class="task">What is the miss on day ${d + 1}?</p>`}
        <div class="lpanel">${fin ? kit.feedback(`All eight misses are in. Add them up: ${M_RULE.map(fmt).join(" ").replace(/ (?!−)/g, " + ").replace(/ −/g, " − ")} = <b>${fmt(sum(M_RULE))}</b>. The rule is plainly off on some days, yet the total says “no error at all”. Hold that thought.`, true)
          : `${kit.options(order.map(v => fmt(v)), { picked: wrong == null ? null : order.indexOf(wrong), correct: order.indexOf(m), num: true })}${wrong == null ? "" : kit.feedback(fbFor(wrong), false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = order[+b.dataset.i];
        if (v !== m) { wrong = v; paint(); return; }
        wrong = null; k++; paint(); if (k >= ASK_DAYS.length) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the flat line also totals zero. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const worst = Math.max(...M_FLAT.map(Math.abs));
    const opts = [
      "Nothing. Both totals are 0, so both lines fit equally well.",
      "Misses above and below the line cancel. Make each miss positive before adding, for example by squaring it.",
      "Eight days are too few. With more days the two totals would come apart.",
      "Judge each line only by its single biggest miss."
    ];
    const fb = [
      [`Look at the picture: the flat line is off by up to ${worst} umbrellas on a day. A total of 0 only says the misses above the line and the misses below it balance out.`, false],
      [`Right. A plus miss and a minus miss cancel, so a bad line can total 0. Both lines pass through the average day (${fmt(MEAN_RAIN)} mm, ${fmt(MEAN_SOLD)} sold). Any line through that point totals exactly 0 here. The fix is to drop the sign before adding. There are two common ways: take the size of each miss, or square it. Squaring is the usual first choice, and the next screen does it.`, true],
      [`More days would not fix it. A line can be far off on every day and still total 0, as long as the misses above and below balance. The problem is the plus and minus signs, not the number of days.`, false],
      [`That judges a line by one day and ignores the other ${N - 1}. A line off by 5 on one day and exact on the rest would score the same as a line off by 5 on every day. You want every day to count.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A total of zero</h1>
        <p class="lead">Mira's neighbour suggests a lazier rule: “bring ${FLAT.base} every day”. Its misses: ${M_FLAT.map(sgn).join(", ")}. Their total is <b>${fmt(sum(M_FLAT))}</b>, the same as Mira's rule.</p>
        ${plot(kit, { lines: [[RULE, "ln"], [FLAT, "ln2"]], days: false })}
        <div class="lx-${ID}-key">${keyLine("ln", "Mira's rule")}${keyLine("ln2", `${FLAT.base} every day`)}</div>
        <p class="task">The neighbour says: “Same total, so my rule is just as good.” What is wrong with comparing totals?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Square and average by hand: mean squared error. */
  function squareAverage({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null; // 0: square day 8's miss, 1: the mean, 2: finished
    const d = BIG, m = M_RULE[d];
    const total = sum(SQ_RULE);
    const Q = [
      { opts: [-(m * m), m * m, 2 * Math.abs(m)], right: 1,
        fb: { [-(m * m)]: `A square is never negative: ${fmt(m)} × ${fmt(m)} = ${m * m}. That is the whole point, the minus disappears.`, [2 * Math.abs(m)]: `That is ${fmt(m)} doubled. Squaring multiplies the miss by itself: ${fmt(m)} × ${fmt(m)}.` } },
      { opts: [total, total / N, total / (N - 1)], right: 1,
        fb: { [total]: `${total} is the sum. It grows with the number of days, so a week and a month could not be compared. Divide by the number of days.`, [total / (N - 1)]: `There are ${N} days, so divide by ${N}.` } }
    ];
    const paint = () => {
      const rows = RAIN.map((_, i) => [`day ${i + 1}`, fmt(M_RULE[i]), stage === 0 && i === d ? "?" : String(SQ_RULE[i])]);
      const q = Q[stage];
      el.innerHTML = `<h1>Square, then average</h1>
        <p class="lead">Square each miss: the sign goes away, and a big miss counts much more than a small one.</p>
        ${table(kit, ["", "miss", "miss squared"], rows, { now: stage === 0 ? d : -1, tot: stage >= 1 ? ["sum", "", String(total)] : null })}
        ${stage < 2 ? `<p class="task">${stage === 0 ? `Day ${d + 1} missed by ${fmt(m)}. What is that miss squared?` : `What one number describes the eight squared misses, so that you can compare rules fairly?`}</p>` : ""}
        <div class="lpanel">${stage < 2 ? `${kit.options(q.opts.map(v => fmt(v)), { picked: wrong == null ? null : q.opts.indexOf(wrong), correct: q.right, num: true })}${wrong == null ? "" : kit.feedback(q.fb[wrong], false)}`
          : kit.feedback(`Right: ${total} ÷ ${N} = <b>${fmt(MSE_RULE)}</b>. This is the <b>mean squared error</b>, MSE: square each miss, then take the mean. It is a <b>loss</b>, one number for how wrong a model is, and lower is better. The “${FLAT.base} every day” rule scores <b>${fmt(MSE_FLAT)}</b> on the same days, so Mira's rule fits much better, which the totals could not show. Its unit is “umbrellas squared”. Take the square root to get back to umbrellas: √${fmt(MSE_RULE)} ≈ ${fmt(Math.sqrt(MSE_RULE), 1)} umbrellas. That is the <b>root mean squared error</b>, RMSE.`, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = q.opts[+b.dataset.i];
        if (+b.dataset.i !== q.right) { wrong = v; paint(); return; }
        wrong = null; stage++; paint(); if (stage === 2) done();
      });
    };
    paint();
  }

  /* 5. Beat the rule: change the two numbers, watch the MSE. */
  function beatIt({ el, done, kit }) {
    ensureStyle();
    const cur = { slope: RULE.slope, base: RULE.base };
    let last = null, best = null, won = false;
    const paint = () => {
      const now = mseOf(cur);
      const worse = last != null && now > last, better = last != null && now < last;
      el.innerHTML = `<h1>Beat Mira's score</h1>
        <p class="lead">A rule is two numbers: umbrellas per mm (the <b>slope</b>) and the fixed amount (the <b>base</b>; machine learning texts call them the <b>weight</b> and the <b>bias</b>). Mira's rule, ${ruleTxt(RULE)}, has an MSE of ${fmt(MSE_RULE)}. The dotted strokes show your rule's misses.</p>
        ${plot(kit, { lines: [[RULE, "ln2"], [cur, "ln"]], misses: cur, days: false })}
        <div class="lx-${ID}-key">${keyLine("ln", "your rule")}${keyLine("ln2", "Mira's rule")}</div>
        <div class="lx-${ID}-ctl">
          <button type="button" class="btn" data-slope-down aria-label="slope down" ${cur.slope <= 0 ? "disabled" : ""}>−</button><span>slope ${fmt(cur.slope)}</span><button type="button" class="btn" data-slope-up aria-label="slope up" ${cur.slope >= 4 ? "disabled" : ""}>+</button>
          <button type="button" class="btn" data-base-down aria-label="base down" ${cur.base <= 0 ? "disabled" : ""}>−</button><span>base ${fmt(cur.base)}</span><button type="button" class="btn" data-base-up aria-label="base up" ${cur.base >= 20 ? "disabled" : ""}>+</button>
        </div>
        <p class="lx-${ID}-score">MSE ${fmt(now)}<small>Mira's: ${fmt(MSE_RULE)}</small></p>
        <p class="task">Change the slope (steps of 0.5) and the base (steps of 1) until your MSE is below ${fmt(MSE_RULE)}.</p>
        <div class="lpanel">${won ? kit.feedback(`You beat it: ${ruleTxt(best)} scores ${fmt(mseOf(best))}. You just did what training does: change the model's numbers, keep what lowers the loss. Keep going if you like. With any slope and base at all (not just these steps), the lowest MSE a straight line reaches on these days is ${fmt(MSE_FIT)}, at slope ${fmt(FIT.slope)} and base ${fmt(FIT.base)}. The next lessons show how a program finds it.`, true)
          : worse ? kit.feedback(`That made it worse: ${fmt(last)} → ${fmt(now)}. Look at the strokes: are most days above your line (it says too few) or below it (too many)?`, false)
          : better ? kit.feedback(`Better: ${fmt(last)} → ${fmt(now)}. Not below ${fmt(MSE_RULE)} yet.`) : ""}</div>`;
      const go = (k, dv) => () => {
        last = mseOf(cur); cur[k] = Math.round((cur[k] + dv) * 2) / 2; const v = mseOf(cur);
        if (v < MSE_RULE && (!best || v < mseOf(best))) best = { ...cur };
        if (v < MSE_RULE && !won) { won = true; paint(); done(); return; }
        paint();
      };
      el.querySelector("[data-slope-down]").onclick = go("slope", -0.5);
      el.querySelector("[data-slope-up]").onclick = go("slope", 0.5);
      el.querySelector("[data-base-down]").onclick = go("base", -1);
      el.querySelector("[data-base-up]").onclick = go("base", 1);
    };
    paint();
  }

  /* 6. Why squares: one big miss against many small ones. */
  function whySquares({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const mP = mean(EVEN.map(m => m * m)), mQ = mean(ONE_BIG.map(m => m * m));
    const aP = absMean(EVEN), aQ = absMean(ONE_BIG);
    const right = mP < mQ ? 0 : mP > mQ ? 1 : 2;
    const opts = ["Rule P (off by 2 every day)", "Rule Q (exact on 7 days, off by 8 on one)", "They tie"];
    const fb = [
      [`Right. P: every squared miss is 4, so MSE ${fmt(mP)}. Q: seven zeros and one 64, so MSE ${fmt(mQ)}. Without squaring, Q's misses are ${fmt(aQ)} umbrella on average and P's are ${fmt(aP)}, so Q would look better. Squaring makes one big miss count more than many small ones. That is good when a big miss really hurts (no umbrellas on the stormiest day). It is bad when the big miss is a mistake in the records: then fitting pulls the line toward that one wrong day. Another loss drops the sign and averages the sizes of the misses. It is called <b>mean absolute error</b> (MAE), and one big miss pulls on it less.`, true],
      [`Q is exact on seven days, which feels better. But square its one miss: 8 × 8 = 64, and ${fmt(sum(ONE_BIG.map(m => m * m)))} ÷ ${N} = ${fmt(mQ)}. P's misses square to 4 each: MSE ${fmt(mP)}. One big miss outweighs many small ones.`, false],
      [`They do not tie on either count. By size, P's misses total ${sum(EVEN.map(Math.abs))} and Q's total ${sum(ONE_BIG.map(Math.abs))}. After squaring, the order flips: P's MSE is ${fmt(mP)}, Q's is ${fmt(mQ)}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>One big miss or many small ones?</h1>
        <p class="lead">Imagine two other rules, scored on the same eight days. Their misses:</p>
        ${table(kit, ["rule", "misses, day 1 to 8"], [["P", EVEN.map(sgn).join(" ")], ["Q", ONE_BIG.map(sgn).join(" ")]])}
        <p class="task">Which rule does MSE call better (lower)?</p>
        <div class="lpanel">${ask(kit, opts, right, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 7. MSE in NumPy: stepped replay of the traced call. */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const arr = a => a ? "[" + a.map(v => fmt(v)).join(", ") + "]" : "–";
    const say = f => {
      const [ln, ev, p, m, s] = f;
      if (ev === "return") return `<code>.mean()</code> adds the ${N} squares and divides by ${N}. The run returned <b>${fmt(RETURNED)}</b>, the same number you worked out by hand.`;
      if (ln === 1) return `Called as <code>mse(rain_mm, umbrellas, 2.0, 4.0)</code>: Mira's rule. <code>rain_mm</code> and <code>umbrellas</code> are NumPy arrays of the ${N} days. Next, the <code>predicted</code> line runs.`;
      if (ln === 2) return `The highlighted line ran: <code>slope * rain_mm + base</code> worked on all ${N} days at once, no loop. NumPy applies the arithmetic to each element (like <code>arr.map(r =&gt; 2 * r + 4)</code> in JavaScript).`;
      if (ln === 3) return `The <code>misses</code> line ran: each day's sold minus predicted. These are the misses from your table, signs included.`;
      if (ln === 4) return `The <code>squared</code> line ran: <code>** 2</code> squares each miss. The signs are gone.`;
      return "";
    };
    const paint = () => {
      const f = TRACE[i], [ln, ev, p, m, s] = f;
      el.innerHTML = `<h1>The same thing in NumPy</h1>
        <p class="lead">Four lines of Python compute the MSE of any rule. This replays a real run of this function on Mira's eight days.</p>
        <p class="task">Step through to the end and check each array against your table.</p>
        ${kit.code(CODE_MSE, ev === "return" ? 4 : ln - 1)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>predicted <b>${arr(p)}</b></span><span>misses <b>${arr(m)}</b></span><span>squared <b>${arr(s)}</b></span>${ev === "return" ? `<span>returned <b>${fmt(RETURNED)}</b></span>` : ""}</div>
        ${kit.feedback(say(f))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 8. The loss over the slope: predict the shape, then see the run. */
  function valley({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const L = VALLEY.map(v => v[1]), lo = L.indexOf(Math.min(...L));
    const opts = ["It falls, reaches a lowest point, then rises", "It keeps falling: steeper is always better on rainy days", "It keeps rising as the slope grows", "It stays about the same"];
    const big = RAIN[N - 1], top = VALLEY[VALLEY.length - 1][0];
    const fb = [
      [`Right. The run printed this valley. Too flat a line says too few on rainy days; too steep says too many. In between, at slope ${fmt(VALLEY[lo][0])}, the loss is lowest (${fmt(L[lo])}). The loss is a function of the model's numbers, and fitting a model means finding the bottom of this valley.`, true],
      [`A steeper line overshoots the rainy days. At slope ${fmt(top)} the rule says ${fmt(predict({ slope: top, base: VALLEY_BASE }, big))} for the ${big} mm day, but she sold ${SOLD[N - 1]}. Those misses get squared too.`, false],
      [`At slope 0 the rule says ${VALLEY_BASE} every day, far too few on rainy days, so the loss is high there too. Raising the slope first helps, then hurts.`, false],
      [`The slope changes every prediction except at 0 mm, so the misses change a lot. The run's losses go from ${fmt(Math.min(...L))} to ${fmt(Math.max(...L))}.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The loss is a function of the numbers</h1>
        <p class="lead">Keep the base at ${VALLEY_BASE} and try slopes from ${fmt(VALLEY[0][0])} to ${fmt(top)}, computing the MSE of each. We ran this code:</p>
        ${kit.code(CODE_SLOPES, -1)}
        ${ans === 0 ? `${kit.bars(L.map(v => fmt(v, 1)), { labels: VALLEY.map(v => fmt(v[0])), cls: { [lo]: "enter" } })}<p class="lx-${ID}-key">Each bar is the MSE for one slope (the number under it); the base is ${VALLEY_BASE}.</p>` : ""}
        <p class="task">Before you see the ${VALLEY.length} losses: as the slope goes from ${fmt(VALLEY[0][0])} to ${fmt(top)}, what does the MSE do?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. The big picture, with one cost to predict: a typo in the records. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const TYPO = SOLD[N - 1] * 10;
    const typoSold = SOLD.map((s, i) => i === N - 1 ? TYPO : s);
    const mseTypo = l => mean(typoSold.map((s, i) => (s - predict(l, RAIN[i])) ** 2));
    const a = mseTypo(RULE), b = mseTypo(FLAT);
    const opts = ["Both scores jump, and that one day makes up almost all of each", "The scores barely move: it is one day out of eight", "The MSE skips days that look wrong"];
    const share = l => { const m = typoSold[N - 1] - predict(l, RAIN[N - 1]); return m * m / (mseTypo(l) * N); };
    const fb = [
      [`Right. Mira's rule goes from ${fmt(MSE_RULE)} to ${fmt(a, 1)}, the flat rule from ${fmt(MSE_FLAT)} to ${fmt(b, 1)}, and the typo day alone is ${Math.floor(share(RULE) * 1000) / 10}% of Mira's sum of squared misses. A fitted line would now tilt toward that one wrong day. Check the records, or use a loss that cares less about big misses (MAE).`, true],
      [`One day out of eight, but its miss is huge, and huge misses are squared: Mira's MSE goes from ${fmt(MSE_RULE)} to ${fmt(a, 1)}.`, false],
      ["MSE has no idea which days look wrong. It squares every miss it is given. Cleaning the data is your job.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for MSE</h1>
        <p class="lead"><b>What it is for:</b> one number that says how wrong a model is. You use it to compare two models on the same data, and training changes the model's numbers to lower it.</p>
        <p class="lead"><b>Reach for MSE</b> when the model predicts an amount (sales, minutes, a price) and big misses hurt more than small ones.</p>
        <p class="lead"><b>Not</b> for yes/no or category answers: those use log loss, coming in a later lesson. <b>Not</b> when the records hold mistakes or rare huge values that should not pull the line: use MAE, or clean the data.</p>
        <p class="lead"><b>Costs:</b> it is cheap to compute. But its unit is squared, so report RMSE or MAE to people. One number hides <i>where</i> the misses are. And two scores only compare if they come from the same days.</p>
        <p class="task">Someone types day ${N}'s sales as ${TYPO} instead of ${SOLD[N - 1]}. What happens to the two rules' MSE?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A delivery firm has two rules that predict trip minutes from distance. It wants to know which one to keep, using last month's 400 trips.", true,
      "Yes. The model predicts an amount, and both rules can be scored on the same 400 trips. Lower MSE wins; report RMSE in minutes to the team.",
      "This is exactly what MSE is for: two rules predicting an amount, scored on the same trips. Compute each rule's misses in minutes, square, average, compare."],
    ["A clinic's model predicts whether a patient will miss an appointment: yes or no.", false,
      "No. The answer is yes or no, not an amount. Such models usually output a probability, and the usual loss for that is log loss, which you meet with logistic regression.",
      "A miss here is not “how many minutes off”: the answer is yes or no. Squaring a yes/no miss is not the usual loss. Probability models for yes/no answers are trained and scored with log loss."],
    ["Rule A scored an MSE of 4.1 on March's sales. Rule B scored 3.2 on April's. The team wants to pick B because 3.2 is lower.", false,
      "No, not like this. The two scores come from different days. April may simply be easier to predict. Score both rules on the same days, then compare.",
      "MSE depends on the days it is computed on, not only on the rule. A quiet month gives every rule a low score. Compare A and B on the same days before choosing."],
    ["A bakery compares two rules that predict loaves per day, on the same three months. Being a few loaves off either way costs little; being dozens off (sold out by noon, or crates thrown away) hurts badly.", true,
      "Yes. It predicts an amount, both rules are scored on the same days, and big misses in either direction are what hurt. Squaring makes big misses count most.",
      "Big misses in either direction are the costly ones, and squaring makes them count most. Both rules are scored on the same days, so their MSEs compare fairly."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>MSE or not?</h1>
        <p class="lead">Four teams want to score a model.</p>
        <p class="task">Would you compare the models by their MSE as described? Pick again if you change your mind.</p>
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
    el.innerHTML = `<h1>You can score a model</h1>
      <p class="lead">You filled in misses, saw that plain misses cancel, squared and averaged them into the mean squared error, beat Mira's rule by changing its two numbers, and saw that the loss over the slope forms a valley.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>mse</code> in NumPy yourself and use it to pick the better of two rules.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You found a low point by trying numbers by hand; next, the slope of that valley tells the program which way to step.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Loss: one number for how wrong a model is",
    checked: "2026-11-13",
    sources: [
      "https://developers.google.com/machine-learning/crash-course/linear-regression/loss",
      "https://developers.google.com/machine-learning/crash-course/logistic-regression/loss-regularization",
      "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.mean_squared_error.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.ndarray.mean.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.polyfit.html"
    ],
    interview: [
      {
        q: "On the same test set, model A has the lower MSE and model B has the lower mean absolute error. Which do you ship, and how do you decide?",
        good: [
          "MSE squares the misses, so A probably has fewer large misses; B is closer on typical cases but has some big ones",
          "Look at the misses themselves: where are B's big misses, and are they real cases or bad records?",
          "Decide by what a big miss costs the business compared with many small ones",
          "Report the result in the target's units (RMSE or MAE) so people can read it"
        ],
        weak: "Ship A because MSE is the standard metric. That ignores what the two numbers disagree about and what a big miss costs."
      },
      {
        q: "A teammate says the model's errors on the validation set add up to almost zero, so it is accurate. What do you reply?",
        good: [
          "Errors above and below cancel; a bad model can total zero",
          "Even always predicting the average gives a total of zero",
          "Square (or take the size of) each error before averaging: MSE or MAE",
          "Compare that score with the simple baseline that always predicts the average"
        ],
        weak: "Agree that a zero total means no error, or just ask for more data, without seeing that the signs cancel."
      }
    ],
    screens: [situation, fillMisses, spotIdea, squareAverage, beatIt, whySquares, asCode, valley, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="0"]'], right: [`[data-i="${BIG}"]`] },
      { wrong: ["[data-wrong]"], right: Array(ASK_DAYS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-slope-up]"], right: ["[data-slope-down]", "[data-slope-down]", "[data-base-up]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
