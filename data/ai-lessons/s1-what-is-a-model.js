/* Lesson: what a model is, a function with tuned numbers. Story: Lena runs an ice-cream kiosk on a beach and
   orders tomorrow's cones from the weather forecast.
   Ideas: (1) a model is a fixed rule shape (a function) plus a few numbers (parameters) chosen to fit past
   records; predicting is plugging a new input into the rule; (2) the model only knows its inputs and the range
   of records it was fitted on: anything it does not take in (a holiday) and any input outside that range (a
   heatwave, a forecast in other units) gives a confident, silent, wrong answer.
   Data, all from real runs on this Mac (docs/ai-path/runs/s1-what-is-a-model/, env.txt):
   - model.py + model.out.txt: the 14 recorded days (made-up story data from a seeded generator, not measured
     sales), np.polyfit's two numbers, the traced predict() call shown on the code screen, and the new days
     (ordinary day, public holiday, two heatwave days; their sales are story data typed in the script).
   - library.py + library.out.txt: the NumPy listing and its printed output, line for line.
   - broken.py + broken.out.txt: the nightly stock plan fed Fahrenheit forecasts, and the fix with a range check.
   No recorded model calls. Lesson-local picture: an SVG scatter plot with lines and the fitted range, a
   clickable log and a small stepper (.lx-s1-what-is-a-model-*), see ensureStyle() and plot(). Plain browser script. */
(() => {
  const ID = "s1-what-is-a-model";
  const P = "lx-" + ID;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const fmt = (n, d = 2) => { const r = Math.round(n * 10 ** d) / 10 ** d; return Object.is(r, -0) ? "0" : String(r).replace("-", "−"); };
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];

  /* ---------- Data copied from docs/ai-path/runs/s1-what-is-a-model/*.out.txt ---------- */
  // model.out.txt PART 1 (story data, seed 7)
  const TEMP = [17, 18, 19, 21, 22, 23, 24, 25, 27, 28, 29, 30, 32, 33];
  const CONES = [49, 59, 61, 69, 80, 82, 99, 117, 115, 120, 137, 143, 155, 153];
  // model.out.txt PART 2: params.tolist()
  const FIT = { perDeg: 6.992975206611563, base: -71.03966942148739 };
  // library.out.txt, printed lines exactly
  const LIB_OUT = ["[  6.99297521 -71.03966942]", "[ 68.81983471 110.77768595 145.74256198]"];
  // model.out.txt PART 3: the numbers the kiosk keeps (rounded), and the trace of predict([20, 26, 31], model)
  const MODEL = { perDeg: 6.99, base: -71.0 };
  const FORECAST = [20, 26, 31];
  const TRACE = [ // [line about to run, event, stock, t, cones]
    [1, "line", null, null, null],
    [2, "line", [], null, null],
    [3, "line", [], 20, null],
    [4, "line", [], 20, 139.8],
    [5, "line", [], 20, 68.80000000000001],
    [2, "line", [69], 20, 68.80000000000001],
    [3, "line", [69], 26, 68.80000000000001],
    [4, "line", [69], 26, 181.74],
    [5, "line", [69], 26, 110.74000000000001],
    [2, "line", [69, 111], 26, 110.74000000000001],
    [3, "line", [69, 111], 31, 110.74000000000001],
    [4, "line", [69, 111], 31, 216.69],
    [5, "line", [69, 111], 31, 145.69],
    [2, "line", [69, 111, 146], 31, 145.69],
    [6, "line", [69, 111, 146], 31, 145.69],
    [6, "return", [69, 111, 146], 31, 145.69]
  ];
  const RESULT = [69, 111, 146];
  // model.out.txt PART 4: [day, temp, what she really sold] (story data)
  const NEW = { tue: ["Tue", 26, 116], sat: ["Sat", 24, 205], wed: ["Wed", 38, 121], thu: ["Thu", 40, 98] };
  // broken.out.txt PART A (the header line cut) and PART B, lines exactly
  const LOG = ["loaded model per_degree=6.99 base=-71.0", "forecast Fri: 27", "stock Fri: 118 cones", "forecast Sat: 81", "stock Sat: 495 cones", "forecast Sun: 84", "stock Sun: 516 cones"];
  const LOG_FIXED = ["Fri: stock 118 cones", "Sat: forecast 81 is outside 17..33 C, the range the model was fitted on. Not planned; ask a person.", "Sun: forecast 84 is outside 17..33 C, the range the model was fitted on. Not planned; ask a person."];
  // listings: predict() in model.py (line 0 = def) and library.py without its comment lines
  const CODE_PREDICT = [
    "def predict(forecast_c, model):",
    "    stock = []",
    "    for t in forecast_c:",
    "        cones = model[\"per_degree\"] * t",
    "        cones += model[\"base\"]",
    "        stock.append(round(cones))",
    "    return stock"
  ];
  const CODE_LIB = [
    "import numpy as np",
    "temp_c = np.array([17, 18, 19, 21, 22,",
    "                   23, 24, 25, 27, 28,",
    "                   29, 30, 32, 33])",
    "cones = np.array([49, 59, 61, 69, 80,",
    "                  82, 99, 117, 115, 120,",
    "                  137, 143, 155, 153])",
    "params = np.polyfit(temp_c, cones, 1)",
    "print(params)",
    "print(np.polyval(params, [20, 26, 31]))"
  ];

  /* ---------- Derived from the data ---------- */
  const N = TEMP.length;
  const LO = Math.min(...TEMP), HI = Math.max(...TEMP);
  const at = (m, t) => m.perDeg * t + m.base;
  const say = t => Math.round(at(MODEL, t));               // what the kiosk's model says, as predict() rounds it
  const RESID = TEMP.map((t, i) => CONES[i] - at(FIT, t));
  const WORST = Math.max(...RESID.map(Math.abs));          // biggest miss on the recorded days
  const NEAR = Math.ceil(WORST / 5) * 5 + 5;               // "close" = within this many cones
  const HL = 18, HR = 32;                                  // where the two handles of the hand-drawn line sit
  const FIT_L = at(FIT, HL), FIT_R = at(FIT, HR);
  const TOL = 12;                                          // a hand-drawn end this close to NumPy's counts as through the cloud
  const lineOf = (yl, yr) => { const perDeg = (yr - yl) / (HR - HL); return { perDeg, base: yl - perDeg * HL }; };

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
      .${P}-plot { display: block; width: 100%; max-width: 540px; height: auto; margin: 16px 0 4px; }
      .${P}-plot text { font: 500 11px var(--mono); fill: var(--muted); }
      .${P}-plot .ax { stroke: var(--line); stroke-width: 1; }
      .${P}-plot .band { fill: var(--sunk); }
      .${P}-plot .pt { fill: var(--ink); }
      .${P}-plot .new { fill: var(--surface); stroke: var(--ink); stroke-width: 2.5; }
      .${P}-plot .ln { stroke: var(--ink); stroke-width: 2.5; fill: none; }
      .${P}-plot .ln2 { stroke: var(--ink-2); stroke-width: 2; stroke-dasharray: 7 5; fill: none; }
      .${P}-plot .hd { fill: var(--surface); stroke: var(--ink); stroke-width: 2.5; }
      .${P}-plot .lab { font: 600 11px var(--mono); fill: var(--ink-2); }
      .${P}-key { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 14px; color: var(--muted); margin: 0 0 6px; }
      .${P}-key svg { vertical-align: middle; margin-right: 6px; }
      .${P}-ctl { display: grid; grid-template-columns: auto 1fr auto; gap: 8px 12px; align-items: center; margin-top: 12px; max-width: 420px; }
      .${P}-ctl .btn { min-height: 48px; min-width: 56px; justify-content: center; font-size: 20px; }
      .${P}-ctl span { font: 600 15px var(--mono); text-align: center; }
      .${P}-log { margin: 16px 0 0; display: grid; gap: 6px; }
      .${P}-log button, .${P}-log div { display: block; width: 100%; min-height: 44px; text-align: left; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); font: 500 14px/1.4 var(--mono); cursor: pointer; overflow-wrap: anywhere; }
      .${P}-log div { cursor: default; }
      .${P}-log .no { border-color: var(--bad); background: var(--bad-soft); }
      .${P}-log .yes { border-color: var(--good); background: var(--good-soft); }
      .${P}-day { margin: 12px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
      .${P}-day p { margin: 0 0 6px; }
      .${P}-out { margin: 12px 0 0; font: 500 14px/1.6 var(--mono); background: var(--sunk); border-radius: 8px; padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
    `;
    document.head.appendChild(s);
  }

  /* SVG scatter: the recorded days, optional lines, the fitted range, new days as hollow rings. */
  const W = 340, H = 230, PL = 34, PR = 10, PT = 14, PB = 30;
  function plot(kit, { xmin = 14, xmax = 36, ymax = 180, lines = [], band = false, news = [], handles = null, title = "" } = {}) {
    const sx = x => PL + (x - xmin) / (xmax - xmin) * (W - PL - PR), sy = y => PT + (1 - y / ymax) * (H - PT - PB);
    const xt = []; for (let x = Math.ceil(xmin / 5) * 5; x <= xmax; x += 5) xt.push(x);
    const yt = []; for (let y = 0; y <= ymax; y += 50) yt.push(y);
    const ticks = xt.map(x => `<line class="ax" x1="${sx(x)}" x2="${sx(x)}" y1="${sy(0)}" y2="${sy(0) + 4}"/><text x="${sx(x)}" y="${sy(0) + 16}" text-anchor="middle">${x}</text>`).join("")
      + yt.map(y => `<line class="ax" x1="${PL - 4}" x2="${W - PR}" y1="${sy(y)}" y2="${sy(y)}" opacity="${y ? .5 : 1}"/><text x="${PL - 7}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`).join("");
    const bd = band ? `<rect class="band" x="${sx(LO)}" y="${PT}" width="${sx(HI) - sx(LO)}" height="${sy(0) - PT}"/><text x="${(sx(LO) + sx(HI)) / 2}" y="${PT + 10}" text-anchor="middle">recorded ${LO}–${HI}°</text>` : "";
    const seg = (m, a, b, c) => `<line class="${c}" x1="${sx(a)}" y1="${sy(at(m, a))}" x2="${sx(b)}" y2="${sy(at(m, b))}"/>`;
    // a line: [model, class, range?]; with range "fit", solid over the recorded days and dashed outside
    const ln = lines.map(([m, c, r]) => r === "fit" ? seg(m, xmin, LO, "ln2") + seg(m, LO, HI, c) + seg(m, HI, xmax, "ln2") : seg(m, xmin, xmax, c)).join("");
    const pts = TEMP.map((t, i) => `<circle class="pt" cx="${sx(t)}" cy="${sy(CONES[i])}" r="4"/>`).join("");
    const nw = news.map(([lab, t, y]) => `<circle class="new" cx="${sx(t)}" cy="${sy(y)}" r="6"/><text class="lab" x="${sx(t)}" y="${sy(y) - 11}" text-anchor="middle">${kit.esc(lab)}</text>`).join("");
    const hd = handles ? [[HL, handles[0]], [HR, handles[1]]].map(([t, y]) => `<circle class="hd" cx="${sx(t)}" cy="${sy(y)}" r="7"/>`).join("") : "";
    return `<svg class="${P}-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${kit.esc(title || "Cones sold against noon temperature")}">
      <defs><clipPath id="${P}-clip"><rect x="${PL}" y="${PT}" width="${W - PL - PR}" height="${H - PT - PB}"/></clipPath></defs>
      ${bd}${ticks}<g clip-path="url(#${P}-clip)">${ln}</g>${pts}${nw}${hd}
      <text x="${W - PR}" y="${H - 2}" text-anchor="end">noon temperature (°C)</text>
      <text x="${PL + 4}" y="${band ? PT + 24 : PT + 10}">cones sold</text></svg>`;
  }
  const keyLine = (cls, text) => `<span><svg width="30" height="10" aria-hidden="true" class="${P}-plot" style="display:inline;margin:0 6px 0 0;width:30px"><line class="${cls}" x1="0" y1="5" x2="30" y2="5"/></svg>${text}</span>`;
  const keyDot = (cls, text) => `<span><svg width="16" height="16" aria-hidden="true" class="${P}-plot" style="display:inline;margin:0 6px 0 0;width:16px"><circle class="${cls}" cx="8" cy="8" r="${cls === "pt" ? 4 : 5.5}"/></svg>${text}</span>`;
  const ask = (kit, opts, correct, picked, fbs) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  const rule = m => `cones = ${fmt(m.perDeg)} × temperature ${m.base < 0 ? "−" : "+"} ${fmt(Math.abs(m.base), 1)}`;

  /* 1. The situation, by hand: draw a line by eye through the recorded days. */
  function drawLine({ el, done, kit }) {
    ensureStyle();
    const START = 100, STEP = 10;
    let yl = START, yr = START, msg = null, fin = false;
    const near = (side, y) => {
      const sel = TEMP.map((t, i) => i).filter(i => side === "l" ? TEMP[i] <= 22 : TEMP[i] >= 28);
      const line = lineOf(yl, yr);
      const above = sel.filter(i => CONES[i] > at(line, TEMP[i])).length;
      return [sel.length, above, sel.length - above];
    };
    const paint = () => {
      el.innerHTML = `<h1>How many cones for tomorrow?</h1>
        <p class="lead">Lena runs an ice-cream kiosk on a beach. Every evening she orders cones for the next day from the forecast. Too few, and she sells out by two o'clock. Too many, and the rest melts into waste. For ${N} days she wrote down the noon temperature and the cones she sold: each dot below is one day.</p>
        ${plot(kit, { lines: [[lineOf(yl, yr), "ln"]], handles: [yl, yr] })}
        <div class="${P}-ctl">
          <button type="button" class="btn" data-l-down aria-label="left end down" ${yl <= 0 ? "disabled" : ""}>−</button><span>at ${HL}°: ${yl}</span><button type="button" class="btn" data-l-up aria-label="left end up" ${yl >= 180 ? "disabled" : ""}>+</button>
          <button type="button" class="btn" data-r-down aria-label="right end down" ${yr <= 0 ? "disabled" : ""}>−</button><span>at ${HR}°: ${yr}</span><button type="button" class="btn" data-r-up aria-label="right end up" ${yr >= 180 ? "disabled" : ""}>+</button>
        </div>
        <p class="task">Move the two ends of the line (the rings at ${HL}° and ${HR}°) until the line runs through the middle of the dots, with the dots spread evenly above and below it.</p>
        <div class="lpanel">${fin ? kit.feedback(`That runs through the middle of the dots. Your line goes from ${yl} cones at ${HL}° to ${yr} at ${HR}°. Lena can now read any forecast off it: find the temperature, go up to the line, read the cones.`, true)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      const go = (side, dv) => () => {
        const fitY = side === "l" ? FIT_L : FIT_R;
        const before = Math.abs((side === "l" ? yl : yr) - fitY);
        if (side === "l") yl += dv; else yr += dv;
        const now = side === "l" ? yl : yr, after = Math.abs(now - fitY);
        const [n, above, below] = near(side);
        const where = side === "l" ? `the cool days (${LO}° to 22°)` : `the hot days (28° to ${HI}°)`;
        fin = Math.abs(yl - FIT_L) <= TOL && Math.abs(yr - FIT_R) <= TOL;
        msg = after > before
          ? [`That moved the ${side === "l" ? "left" : "right"} end away from the dots. Of the ${n} dots for ${where}, ${above} ${above === 1 ? "is" : "are"} above the line and ${below} below. Move the end toward the side that has more.`, false]
          : [`Closer. Of the ${n} dots for ${where}, ${above} ${above === 1 ? "is" : "are"} above the line and ${below} below.${!fin && Math.abs(now - fitY) <= TOL ? " This end is about right; now check the other one." : ""}`];
        paint();
        if (fin) done();
      };
      el.querySelector("[data-l-down]").onclick = go("l", -STEP);
      el.querySelector("[data-l-up]").onclick = go("l", STEP);
      el.querySelector("[data-r-down]").onclick = go("r", -STEP);
      el.querySelector("[data-r-up]").onclick = go("r", STEP);
    };
    paint();
  }

  /* 2. Spot the idea: what is "the model" you would send to a friend? */
  function spotModel({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `All ${N} days she wrote down`,
      `Two numbers, ${fmt(MODEL.perDeg)} and ${fmt(MODEL.base, 1)}, and the rule “multiply the temperature by the first, then add the second”`,
      "A photo of the chart with the line on it",
      "Tomorrow's forecast"
    ];
    const fb = [
      [`The days are what the line was made <i>from</i>. With them, the friend would have to draw her own line again, and might draw a different one. Once the line is drawn, Lena never looks at the ${N} days to make a prediction: the line alone answers.`, false],
      [`Right. The line is fully described by a rule shape (multiply, then add) and two numbers. That is what a <b>model</b> is: a function whose shape is fixed, plus numbers called <b>parameters</b> that were tuned until its answers matched past records. Moving the line on the last screen was tuning the two parameters. Tuning them from data is called <b>fitting</b> or <b>training</b>. Plugging in a new input to get an answer is <b>predicting</b>. Machine learning texts call these numbers <b>weights</b> and the added one the <b>bias</b>.`, true],
      ["A photo shows the line, but the friend would have to measure it with a ruler to use it, and she would get slightly different numbers each time. The exact line is two numbers.", false],
      ["The forecast is the input: it changes every day, and the friend gets it from the weather service anyway. The model is what turns any forecast into a number of cones.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What is the model?</h1>
        <p class="lead">Lena keeps one careful line through her ${N} days. Written as a rule, it is <b>${rule(MODEL)}</b>. For a ${FORECAST[1]}° day that is ${fmt(MODEL.perDeg)} × ${FORECAST[1]} − ${fmt(-MODEL.base, 1)} ≈ ${say(FORECAST[1])} cones. Her friend runs a kiosk on the same beach and wants to plan with the same line. (Every AI model, up to the large language models you call from LangChain, is this same idea at a far bigger size.)</p>
        <p class="task">What is the least Lena has to send so that her friend gets exactly the same predictions for any forecast?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Use it: same rule, different numbers, different answers. */
  const LAKE = { perDeg: 3.1, base: -22 };   // an imagined second kiosk, for this screen only
  function sameRule({ el, done, kit }) {
    ensureStyle();
    const T = 30;
    const Q = [
      { m: MODEL, who: "Lena's beach kiosk" },
      { m: LAKE, who: "a kiosk by a cold mountain lake" }
    ];
    const ansOf = m => Math.round(at(m, T));
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k >= Q.length, q = fin ? null : Q[k];
      let opts = [], fbOf = () => "";
      if (!fin) {
        const right = ansOf(q.m), noBase = Math.round(q.m.perDeg * T), other = ansOf(k === 0 ? LAKE : MODEL);
        opts = k === 0 ? [right, noBase, Math.round(q.m.perDeg + T + q.m.base)] : [right, other, noBase];
        opts = opts.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
        fbOf = v => v === noBase ? `You left out the second number. The rule is multiply, <i>then add</i> ${fmt(q.m.base, 1)}: ${fmt(q.m.perDeg)} × ${T} = ${fmt(q.m.perDeg * T, 1)}, then ${fmt(q.m.base, 1)}.`
          : v === other ? `That is the beach kiosk's answer. The rule shape is the same, but this kiosk's numbers are ${fmt(LAKE.perDeg)} and ${fmt(LAKE.base, 1)}: ${fmt(LAKE.perDeg)} × ${T} − ${fmt(-LAKE.base, 1)}.`
          : `That adds all three numbers. The first number multiplies the temperature: ${fmt(q.m.perDeg)} × ${T}, then add ${fmt(q.m.base, 1)}.`;
      }
      el.innerHTML = `<h1>Same rule, other numbers</h1>
        <p class="lead">The forecast for tomorrow says <b>${T}°</b> everywhere. Two kiosks use the same rule shape, <i>cones = first number × temperature + second number</i>, each with numbers fitted to its own records. (The lake kiosk is imagined for this screen.)</p>
        ${kit.table(Q.map((x, i) => [x.who, `${fmt(x.m.perDeg)} and ${fmt(x.m.base, 1)}${i < k ? ` → ${ansOf(x.m)} cones` : ""}`]), { head: ["kiosk", "its two numbers"], fresh: fin ? -1 : k })}
        ${fin ? "" : `<p class="task">How many cones does ${q.who === "Lena's beach kiosk" ? "Lena's model" : "the lake kiosk's model"} say for ${T}°?</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Same input, same code, ${ansOf(MODEL)} against ${ansOf(LAKE)} cones. The function is shared; the parameters are what make each model different. That is why a saved model file is mostly a list of numbers. Here there are two. Large language models are built the same way at a vastly bigger scale: a far more complex function with billions of tuned parameters.`, true)
          : `${kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(ansOf(q.m)), num: true })}${wrong == null ? "" : kit.feedback(fbOf(wrong), false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== ansOf(q.m)) { wrong = v; paint(); return; }
        wrong = null; k++; paint(); if (k >= Q.length) done();
      });
    };
    paint();
  }

  /* 4. The model from scratch in Python: stepped replay of the traced run. */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const arr = a => a == null ? "–" : "[" + a.join(", ") + "]";
    const sayOf = (f, j) => {
      const [ln, ev, st, t, c] = f;
      if (ev === "return") return `It returns <b>${arr(RESULT)}</b>: the stock for ${FORECAST.map(x => x + "°").join(", ")}. The model's numbers live in a plain dict; the function is ${CODE_PREDICT.length - 1} lines. Nothing here learned anything: the numbers were fitted beforehand.`;
      if (j === 0) return `Called as <code>predict([${FORECAST.join(", ")}], model)</code> with <code>model = {'per_degree': 6.99, 'base': -71.0}</code> (as the run printed it). A Python dict is like a JS object. Next, an empty list for the answers.`;
      if (ln === 2 && t == null) return "The loop takes each forecast in turn, like <code>for (const t of forecastC)</code> in JavaScript.";
      if (ln === 3) return `t = ${t}. Next: multiply it by the first number, ${fmt(MODEL.perDeg)}.`;
      if (ln === 4) return `cones = ${fmt(MODEL.perDeg)} × ${t} = ${fmt(c)}. Not done: next, <code>+=</code> adds the second number, ${fmt(MODEL.base, 1)}.`;
      if (ln === 5) {
        const cut = String(c).match(/0{5,}\d$/);
        return `cones = ${fmt(TRACE[j - 1][4])} − ${fmt(-MODEL.base, 1)} = ${fmt(c)}.${cut ? ` (The run printed ${c}: decimal numbers are stored in binary, so tiny tails like that are normal.)` : ""} Next, round it and append it.`;
      }
      if (ln === 2) return `${Math.round(c)} cones appended. Back to the loop for the next forecast.`;
      if (ln === CODE_PREDICT.length - 1) return "No forecasts left. Next, return the list.";
      return "";
    };
    const paint = () => {
      const f = TRACE[i], [ln, ev, st, t, c] = f;
      el.innerHTML = `<h1>The model in Python, from scratch</h1>
        <p class="lead">This replays a real run of this function on three forecasts. The highlighted line is the one about to run.</p>
        <p class="task">Step through to the end. Check each <code>cones</code> against the rule.</p>
        ${kit.code(CODE_PREDICT, ev === "return" ? CODE_PREDICT.length - 1 : ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>t <b>${t == null ? "–" : t}</b></span><span>cones <b>${c == null ? "–" : fmt(c)}</b></span><span>stock <b>${arr(st)}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(sayOf(f, i))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 5. The real library: NumPy picks the two numbers. Predict the order first. */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["[cones per degree, the added number]", "[the added number, cones per degree]", "One number: the cones for a typical day"];
    const fb = [
      [`Right. <code>np.polyfit</code> returns its numbers (the <b>coefficients</b>) <b>highest power first</b>. For a line that means the number that multiplies the temperature, then the plain added number. NumPy picked ${fmt(FIT.perDeg)} cones per degree and ${fmt(FIT.base)}; the kiosk's model keeps them rounded to ${fmt(MODEL.perDeg)} and ${fmt(MODEL.base, 1)}. <code>np.polyval(params, …)</code> plugs temperatures into the same rule.`, true],
      ["That order is a common slip. <code>np.polyfit</code> lists its numbers highest power first: the number that multiplies the temperature comes first, the plain added number last. Swap them by mistake and every prediction is nonsense, with no error.", false],
      ["<code>polyfit</code> does not predict anything. It returns the line itself: with <code>deg=1</code>, two numbers, one that multiplies the temperature and one that is added. Predictions come after, from <code>np.polyval</code>.", false]
    ];
    const paint = () => {
      const ok = ans === 0;
      el.innerHTML = `<h1>Let NumPy pick the numbers</h1>
        <p class="lead">Drawing by eye works for one line. A program fits it from the records instead. <code>np.polyfit(x, y, deg)</code> fits a <b>polynomial</b>, a rule built from powers of x. <code>deg=1</code> is a straight line (two numbers). <code>deg=2</code> would be a curve with three. We ran this:</p>
        ${kit.code(CODE_LIB, -1)}
        ${ok ? `<div class="${P}-out">${LIB_OUT.map(kit.esc).join("\n")}</div>
          ${plot(kit, { lines: [[FIT, "ln"]] })}
          <p class="lead">NumPy's line through the same days. A miss is how far a dot is from the line. NumPy chose the two numbers that make the squared misses, added up, as small as possible. The next lessons show what that means and how a program searches for them. The NumPy docs call <code>polyfit</code> part of the old polynomial API and recommend <code>Polynomial.fit</code> for new code; <code>polyfit</code> is used here because it hands back the two numbers directly.</p>` : ""}
        <p class="task">Before you see the output: in what order does <code>print(params)</code> show the two numbers?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 6. Predict two new days, then see what she really sold. */
  const DAYS6 = [
    { d: NEW.tue, note: "an ordinary school-term weekday" },
    { d: NEW.sat, note: "a public holiday: the town's sand-sculpture festival is on the beach" }
  ];
  const kind = (d) => { const off = d[2] - say(d[1]); return Math.abs(off) <= NEAR ? 0 : off > 0 ? 1 : 2; };
  function twoDays({ el, done, kit }) {
    ensureStyle();
    const ans = DAYS6.map(() => null);
    const OPTS = [`Close to the model (within ${NEAR} cones)`, "Far above the model", "Far below the model"];
    const paint = () => {
      const all = DAYS6.every((x, i) => ans[i] === kind(x.d));
      el.innerHTML = `<h1>Two days the line never saw</h1>
        <p class="lead">On the ${N} recorded days, NumPy's line was never more than ${fmt(WORST, 1)} cones off. Lena now uses the model for real. Two forecasts:</p>
        <p class="task">Predict each day before you see it. Pick again if you change your mind.</p>
        ${DAYS6.map((x, i) => {
          const [day, t, sold] = x.d, k = kind(x.d), right = ans[i] === k;
          return `<div class="lcase" id="c${i}"><p><b>${day}, ${t}°</b>, ${kit.esc(x.note)}. The model says <b>${say(t)}</b> cones. What will she really sell?</p>${kit.options(OPTS, { picked: ans[i], correct: k })}${ans[i] == null ? "" : kit.feedback(right
            ? `She sold <b>${sold}</b>: ${sold - say(t) >= 0 ? "+" : "−"}${Math.abs(sold - say(t))} against the model. ${k === 0 ? "An ordinary day at a temperature it has seen: the model does what it was fitted to do." : "A crowd that has nothing to do with the temperature."}`
            : k === 0 ? `Nothing about ${day} is unusual: ${t}° is inside the recorded ${LO}–${HI}°, on an ordinary day. That is exactly what the line was fitted on.`
              : `The festival brings people to the beach whatever the temperature. Picture the extra crowd: more people, more cones than a normal ${t}° day.`, right)}</div>`;
        }).join("")}
        ${all ? plot(kit, { lines: [[FIT, "ln"]], news: DAYS6.map(x => [x.d[0], x.d[1], x.d[2]]), ymax: 250 }) + `<div class="${P}-key">${keyDot("pt", "recorded day")}${keyDot("new", "new day, what she sold")}</div>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (DAYS6.every((x, j) => ans[j] === kind(x.d))) done();
      }));
    };
    paint();
  }

  /* 7. Spot the second idea: why did the model miss Saturday? */
  function spotBlind({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const [sd, st, ss] = NEW.sat, [td, tt, ts] = NEW.tue, off = ss - say(st);
    const opts = [
      "Its two numbers are badly fitted. Refit them and Saturday will come out right.",
      "Its only input is the temperature. “Holiday” never reaches it, so it answers as for any ordinary 24° day.",
      "Bad luck: sales always jump around a bit.",
      "A straight line is too simple. A curve (deg=2) would have caught the festival."
    ];
    const fb = [
      [`The same numbers came within ${Math.abs(ts - say(tt))} cones on ${td}. They are fine for what they were fitted on. Refitting with the same input still gives the festival no way into the model.`, false],
      [`Right. A model can only respond to what it takes in. This one takes one number, the temperature, so a holiday at ${st}° and a quiet weekday at ${st}° look identical to it. It was off by ${off}, and it gave no warning: a model always returns an answer. To use holidays, they must become an input (for example a column that is 1 on holidays and 0 on other days) in the records it is fitted on.`, true],
      [`On the ${N} recorded days the line was never more than ${fmt(WORST, 1)} cones off. ${off} is far outside that spread: something the model does not know about happened.`, false],
      [`A curve still takes only the temperature. Both would see “${st}°” and nothing else, so neither can tell the festival from a quiet day.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did it miss Saturday?</h1>
        <p class="lead">${td}, ${tt}°: the model said ${say(tt)}, she sold ${ts}. ${sd}, ${st}°, festival: the model said ${say(st)}, she sold ${ss}. Same model, same week.</p>
        <p class="task">What explains the Saturday miss?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. Mark the days where the line should not be trusted. */
  const WEEK = [
    ["Mon", 22, "ordinary"], ["Tue", 29, "ordinary"], ["Wed", NEW.wed[1], "heatwave"], ["Thu", NEW.thu[1], "heatwave"],
    ["Fri", 31, "ordinary"], ["Sat", 25, "public holiday"], ["Sun", 14, "cold and windy"]
  ];
  const untrusted = ([, t, note]) => t < LO || t > HI || note === "public holiday";
  const BAD = WEEK.map((w, i) => i).filter(i => untrusted(WEEK[i]));
  function markWeek({ el, done, kit }) {
    ensureStyle();
    const picked = new Set();
    let msg = null, miss = null;
    const paint = () => {
      const fin = BAD.every(i => picked.has(i));
      const cls = {};
      picked.forEach(i => { cls[i] = "next"; });
      if (miss != null) cls[miss] = "dup";
      el.innerHTML = `<h1>Where should Lena not trust it?</h1>
        <p class="lead">Next week's forecast. The filled strip marked “recorded ${LO}–${HI}°” is the temperatures Lena has records for; outside it the line simply carries on, dashed.</p>
        ${plot(kit, { xmin: 10, xmax: 42, ymax: 250, lines: [[FIT, "ln", "fit"]], band: true, news: fin ? [[NEW.wed[0], NEW.wed[1], NEW.wed[2]], [NEW.thu[0], NEW.thu[1], NEW.thu[2]]] : [] })}
        ${kit.cells(WEEK.map(w => w[0]), { labels: WEEK.map(w => w[1] + "°"), pick: !fin, cls })}
        <p class="lead">${WEEK.map(w => `${w[0]}: ${w[1]}°, ${w[2]}`).join(" · ")}</p>
        <p class="task">Tap every day where the model's answer should not be trusted.</p>
        <div class="lpanel">${fin ? kit.feedback(`All ${WORDS[BAD.length].toLowerCase()} found. Sunday and the two heatwave days are outside ${LO}–${HI}°: the line never saw a day like that and just continues. Saturday is inside the range but has something the model cannot see. Later that week, Wed and Thu really happened (the rings): the model said ${say(NEW.wed[1])} and ${say(NEW.thu[1])}, she sold ${NEW.wed[2]} and ${NEW.thu[2]}. The town warned people off the midday beach, so the hotter it got, the <i>fewer</i> cones she sold. Going beyond the records is called <b>extrapolation</b>, and a straight line has no way of knowing the pattern bends there.`, true)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll("button.cell").forEach(b => b.onclick = () => {
        const i = +b.dataset.i, [d, t, note] = WEEK[i];
        miss = null;
        if (picked.has(i)) { picked.delete(i); msg = [`${d} unmarked.`]; }
        else if (!untrusted(WEEK[i])) { miss = i; msg = [`${d} is ${t}°, inside the recorded ${LO}–${HI}°, on an ${note} day: the kind of day the line was fitted on. It said ${say(t)}; trust it about as far as on the recorded days.`, false]; }
        else {
          picked.add(i);
          msg = [t > HI ? `${d}: ${t}° is hotter than any recorded day (the hottest was ${HI}°). The line keeps rising there only because lines keep going.`
            : t < LO ? `${d}: ${t}° is colder than any recorded day (the coolest was ${LO}°). The line says ${say(t)}, but no record backs that up.`
            : `${d}: ${t}° is inside the range, but a holiday is not one of the model's inputs.`];
        }
        paint();
        if (BAD.every(j => picked.has(j))) done();
      });
    };
    paint();
  }

  /* 9. Broken on purpose: a stock plan that asks for 495 cones. */
  const CAUSE = [3, 5];
  const fToC = f => Math.round((f - 32) * 5 / 9);
  function brokenPlan({ el, done, kit }) {
    ensureStyle();
    let line = null, fix = null;
    const lineFb = {
      0: "The model loaded with the same two numbers as always. Nothing wrong here.",
      1: `27 is inside the recorded ${LO}–${HI}°. Friday's plan is fine.`,
      2: `${fmt(MODEL.perDeg)} × 27 − 71 ≈ 118. Correct for a 27° day.`,
      4: `This is where you <i>notice</i> the problem, but the arithmetic is right: ${fmt(MODEL.perDeg)} × 81 − 71 ≈ 495. The model did exactly what it does. Look at what went <i>into</i> it.`,
      6: "Same as Saturday's stock: a symptom. The arithmetic is right for the number it was given. Look at the input."
    };
    const fixOpts = [
      "Check each input against the range (and units) the model was fitted on, and stop the plan when one falls outside",
      "Refit the model with Saturday's 81 added to the records",
      "Cap every order at 200 cones",
      "Round the numbers to more decimals"
    ];
    const fixFb = [
      [`Right. 81 and 84 are Fahrenheit (about ${fToC(81)}° and ${fToC(84)}°C): the weather service changed its default units. The model has no idea what units mean; it saw 81 and multiplied. A check against the fitted range catches this and the heatwave days alike. We added it and reran:`, true],
      ["81 is not a real temperature in Celsius. Fitting to it would bend the numbers toward a mistake and spoil every ordinary day. Fix the input, not the model.", false],
      ["A cap hides the symptom. Sunday's 84 would still be planned from a wrong number, just a smaller wrong number, and a real hot day could be cut short too.", false],
      ["The rounding is not the problem: 495 is the right answer for the input 81. The input is wrong.", false]
    ];
    const paint = () => {
      const found = line != null && CAUSE.includes(line), ok = fix === 0;
      el.innerHTML = `<h1>Broken on purpose: 495 cones</h1>
        <p class="lead">Lena's nightly plan reads the forecast from a weather service and runs the model. One night it asks for 495 cones; her best day ever was ${Math.max(...CONES, ...Object.values(NEW).map(d => d[2]))}. Nothing crashed. This is the log of that real run:</p>
        <div class="${P}-log">${LOG.map((t, i) => found ? `<div class="${CAUSE.includes(i) ? "yes" : ""}">${kit.esc(t)}</div>` : `<button type="button" data-line="${i}" class="${i === line ? "no" : ""}">${kit.esc(t)}</button>`).join("")}</div>
        <p class="task">${found ? "Which fix stops this from happening again?" : "Tap the log line where things first go wrong."}</p>
        <div class="lpanel">${!found ? (line == null ? "" : kit.feedback(lineFb[line], false))
          : `${kit.feedback(`Yes: the forecast. ${LO}–${HI}° is all the model was fitted on, and 81 is far outside it.`)}${ask(kit, fixOpts, 0, fix, fixFb)}${ok ? `<div class="${P}-out">${LOG_FIXED.map(kit.esc).join("\n")}</div>` : ""}`}</div>`;
      el.querySelectorAll("[data-line]").forEach(b => b.onclick = () => { line = +b.dataset.line; paint(); });
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 10. The big picture, with one choice to make. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A till must add sales tax to every sale at a fixed rate.",
      "A bus company has two years of records of weather, hour and how late each bus was, and wants tomorrow's delays.",
      "A shop launches a product unlike anything it sold before and wants the first week's sales."
    ];
    const fb = [
      ["The rule is already known exactly: price × rate. Write the formula. Fitting numbers to past sales would only get it slightly wrong.", false],
      ["Right. Lots of records of inputs and outcomes, a pattern that repeats, and tomorrow's inputs look like past ones. That is what a fitted model is for.", true],
      ["There are no records of anything like it, so there is nothing to fit, and the launch would be outside any range anyway. Use judgement, a similar product's history, or a small test sale.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for a model</h1>
        <p class="lead"><b>What it does:</b> turns past records into a rule that answers new cases at once. <b>Reach for it</b> when you have many records of inputs and outcomes, and new inputs look like old ones. <b>Do not</b> when the exact rule is known (write the formula) or when there is no history. <b>Do not trust it</b> when an input is outside the records, or the outcome depends on something it does not take in: ask a person, use a fixed rule, or collect new data. <b>Costs:</b> collecting and cleaning records, refitting when the world changes, and checking every input. The worst cost: when a model is wrong, it does not tell you.</p>
        <p class="task">Which one calls for a model fitted to data?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 11. Recognise it in new situations. */
  const FLAT = { lo: 40, hi: 120, ask: 95, villa: 600 };   // m², scenario data
  const CASES = [
    [`A flat-price model was fitted on 3,000 sales of ${FLAT.lo} to ${FLAT.hi} m² flats in one city. An agent asks it about a ${FLAT.ask} m² flat in that city.`, true,
      "Yes. Same kind of input, inside the range it was fitted on. Its answer is as good as it was on the records.",
      `${FLAT.ask} m² is inside ${FLAT.lo} to ${FLAT.hi} m², in the same city: exactly the kind of case the numbers were fitted on. Trust it about as far as on the records.`],
    [`The same flat-price model is asked about a ${FLAT.villa} m² villa with a pool.`, false,
      `No. ${FLAT.villa} m² is ${WORDS[FLAT.villa / FLAT.hi].toLowerCase()} times the largest flat it saw. The model will extend its line and give a confident number that no record supports.`,
      `${FLAT.villa} m² is far outside ${FLAT.lo} to ${FLAT.hi} m². The model extends its pattern past its records, like the heatwave days, and gives no warning.`],
    ["A delivery-time model takes the usual road distance and the hour of day, fitted on a year of trips. Today the main bridge is closed.", false,
      "No. The closure is not one of its inputs. It sees a normal distance and hour and answers as on any normal day, like the festival Saturday.",
      "Distance and hour look normal, but the model cannot see the bridge. Something that drives the outcome is outside its inputs, so its answer is blind to it."],
    ["A spam filter learned one number per word from 50,000 emails people marked as spam or not. A new, ordinary email arrives.", true,
      "Yes. Still a function with tuned numbers, just many more of them, and the new email is like the ones it was fitted on.",
      "It is the same idea at a bigger size: one number per word, tuned on labelled emails. An ordinary email is like its records, so its answer can be trusted about as well as on them."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Trust the model here?</h1>
        <p class="lead">${WORDS[CASES.length]} models, each fitted to past records, each asked one question.</p>
        <p class="task">For each one, would you trust the model's answer? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 12. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can say what a model is</h1>
      <p class="lead">You drew a line by eye, saw that it is a rule plus two numbers, ran it in Python, let NumPy pick the numbers, and found where it fails: inputs it does not take in, and inputs outside the records it was fitted on.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>predict</code> for a model stored as a dict of numbers, and add a check that refuses forecasts outside the fitted range.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You judged “through the middle of the dots” by eye; next, one number says how wrong a line is, so lines can be compared.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "What a model is: a function with tuned numbers",
    checked: "2026-11-14",
    sources: [
      "https://developers.google.com/machine-learning/crash-course/linear-regression",
      "https://numpy.org/doc/stable/reference/generated/numpy.polyfit.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.polyval.html",
      "https://developers.google.com/machine-learning/crash-course/llm/transformers"
    ],
    interview: [
      {
        q: "A demand-forecast model did well in testing. After launch in a new region its forecasts are far off, and nothing raised an error. How do you investigate?",
        good: [
          "Compare the new region's inputs with the training data: ranges, units, missing values",
          "Ask what drives demand there that is not an input: local holidays, events, a competitor",
          "A model always returns a number; being outside its data gives no error, so add input checks",
          "Look at the biggest misses first, then refit with the new region's records or add the missing input"
        ],
        weak: "Retrain with a bigger model, or retrain longer. That does not ask whether the inputs are outside the data or whether the cause is something the model cannot see."
      },
      {
        q: "A teammate wants to use a model fitted on summer sales to plan stock all year. What do you tell them?",
        good: [
          "The numbers were fitted on summer inputs; winter inputs are outside that range",
          "Outside its data the model just extends the pattern, which may bend or reverse",
          "Things like season or holidays may matter and are not inputs",
          "Collect a year of records, add the missing inputs, and check new inputs against the fitted range"
        ],
        weak: "It will be fine because the model was accurate in testing. Testing was on summer days, so it says nothing about winter."
      }
    ],
    screens: [drawLine, spotModel, sameRule, asCode, library, twoDays, spotBlind, markWeek, brokenPlan, bigPicture, recognise, whatNext],
    walk: [
      // the wrong move lowers the right end; the right clicks finish the line from either start (100 or 90 at the right end)
      { wrong: ["[data-r-down]"], right: [...Array(5).fill("[data-l-down]"), ...Array(6).fill("[data-r-up]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: DAYS6.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="0"]'], right: BAD.map(i => `[data-i="${i}"]`) },
      { wrong: ['[data-line="4"]'], right: ['[data-line="3"]', "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
