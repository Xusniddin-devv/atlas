/* Lesson s5c-quantization: Quantization, fewer bits per weight.
   Story: a field engineer needs a translation model on a laptop at sites with no signal. At 16 bits the model's
   weights do not fit; at 4 bits they do. What does "4 bits" do to the numbers, and how much quality does it cost?
   Ideas: (1) min-max quantization: each group of weights keeps its low end and a step, and every weight becomes
   the nearest of 2^bits evenly spaced levels; the error is at most half a step. (2) The step is set by the group's
   range, so one outlier spoils its whole group: small groups, each with its own low and step, contain the damage,
   at the price of extra bits per weight. Judge the loss on your own task, not on one number.
   Depth: explain (1-3, 8-9), scratch (4-5: NumPy, from scratch, real runs), debug (6: a real buggy quantizer and
   its real report), when-not (8-9).
   Runs (no model call, no API): docs/ai-path/runs/s5c-quantization/ (fetch.py: three real float32 weight
   matrices of T5-small fetched by byte range; group8.py -> group8.out.txt = screens 2-4 and the traced code;
   layer.py -> layer.out.txt = screens 5 and 7; broken.py -> broken.out.txt = screen 6; env.txt).
   Facts: Hugging Face Transformers quantization docs (overview, concepts, choosing a method), the LLM.int8() paper,
   the T5-small model card; checked 2026-11-14.
   Every number on screen is computed here from ORD, OUTL, TRACE, LAYER, BROKEN and PARAMS. Lesson-local CSS: the
   level strip, the tables and the printed report (prefix lx-s5c-quantization-). */
(() => {
  const P = "lx-s5c-quantization-";
  const RUN_DATE = "2026-11-14";
  const BITS = 4, NLEV = 2 ** BITS;                      // 16 levels, numbered 0..15
  const fmt = n => n.toLocaleString("en");
  const num = (x, d = 4) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(d);
  const pct = (x, d = 1) => `${x.toFixed(d)}%`;
  const PARAMS = 7e9;                                   // the 7-billion-parameter model of the previous lesson
  const gb = bitsPerWeight => PARAMS * bitsPerWeight / 8 / 1e9;
  const gbTxt = bitsPerWeight => `${+gb(bitsPerWeight).toFixed(2)} GB`;

  // From docs/ai-path/runs/s5c-quantization/group8.out.txt: T5-small,
  // decoder.block.0.layer.2.DenseReluDense.wo.weight (512 x 2048), row 4.
  const ORD = [-0.2333984375, -0.19140625, 0.255859375, -0.00726318359375, 0.033203125, -0.26953125, 0.1220703125, 0.1455078125]; // columns 944-951
  const OUTL = [-10.1875, -0.220703125, -0.345703125, 0.328125, 0.298828125, 0.1962890625, 0.29296875, -0.16796875];               // columns 936-943
  const STD = 0.3353;                                   // std of all 1,048,576 weights of the matrix

  // The same arithmetic as quantize_group in the runs (min-max, round to nearest). Checked against group8.out.txt.
  function quant(ws, bits = BITS) {
    const levels = 2 ** bits - 1, low = Math.min(...ws), step = (Math.max(...ws) - low) / levels;
    const codes = ws.map(w => Math.round((w - low) / step));
    const restored = codes.map(c => low + c * step);
    const err = ws.map((w, i) => Math.abs(restored[i] - w));
    return { levels, low, high: Math.max(...ws), step, codes, restored, err };
  }
  const QO = quant(ORD), QX = quant(OUTL);
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const ORD_ERR = mean(QO.err);
  const OUT_ORD = OUTL.map((w, i) => i).filter(i => Math.abs(OUTL[i]) < 3);   // the seven ordinary weights of the outlier group
  const OUT_I = OUTL.findIndex(w => Math.abs(w) >= 3);
  const OUT_ERR = mean(OUT_ORD.map(i => QX.err[i]));
  const OUT_LEVELS = [...new Set(OUT_ORD.map(i => QX.codes[i]))].sort((a, b) => a - b);
  const times = (a, b) => Math.round(a / b);

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}strip{position:relative;height:58px;margin:14px 14px 8px}
      .${P}axis{position:absolute;left:0;right:0;top:22px;border-top:2px solid var(--line)}
      .${P}tick{position:absolute;top:14px;width:2px;height:18px;margin-left:-1px;background:var(--faint)}
      .${P}tick.c{background:var(--ink);height:22px;top:12px}
      .${P}tlab{position:absolute;top:38px;transform:translateX(-50%);font:12px var(--mono);color:var(--muted);white-space:nowrap}
      .${P}tlab.c{color:var(--ink);font-weight:600}
      .${P}mark{position:absolute;top:8px;width:14px;height:14px;margin-left:-7px;border:3px solid var(--ink);border-radius:50%;background:var(--surface);box-sizing:border-box}
      .${P}mlab{position:absolute;top:-12px;transform:translateX(-50%);font:12px var(--mono);color:var(--ink);white-space:nowrap}
      .${P}cap{font-size:12px;color:var(--muted);margin:2px 0 6px}
      .${P}tb{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0;font-variant-numeric:tabular-nums}
      .${P}tb th,.${P}tb td{border-bottom:1px solid var(--line);padding:6px 4px;text-align:right}
      .${P}tb th:first-child,.${P}tb td:first-child{text-align:left}
      .${P}tb th{color:var(--muted);font-weight:500;font-size:12px}
      .${P}tb tr.cur td{background:var(--sunk)}
      .${P}tb td.out{font-weight:700}
      .${P}tb td.bad{color:var(--bad)}
      .${P}hid{color:var(--faint)}
      .${P}mat{font-family:var(--mono);font-size:13px;background:var(--sunk);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;white-space:pre-wrap;word-break:break-word;color:var(--ink)}
      .${P}q{margin-top:16px}
      .${P}lopt code{font-family:var(--mono);font-size:13px;white-space:pre-wrap;word-break:break-word}
    `;
    document.head.appendChild(s);
  }

  // A number line with the 16 levels of a group as ticks and one weight as a ring.
  function strip(q, w, show = []) {
    const at = x => `${(x - q.low) / (q.high - q.low) * 100}%`;
    const ticks = Array.from({ length: q.levels + 1 }, (_, k) => {
      const c = show.includes(k), x = q.low + k * q.step;
      return `<span class="${P}tick${c ? " c" : ""}" style="left:${at(x)}"></span>${c || k === 0 || k === q.levels ? `<span class="${P}tlab${c ? " c" : ""}" style="left:${at(x)}">${k}</span>` : ""}`;
    }).join("");
    return `<div class="${P}strip" aria-label="the ${q.levels + 1} levels of the group and the weight ${num(w)}"><span class="${P}axis"></span>${ticks}
      <span class="${P}mark" style="left:${at(w)}"></span><span class="${P}mlab" style="left:${at(w)}">${num(w)}</span></div>`;
  }

  // a weights table: weight | level | restored | error; rows up to `upto` are filled
  function groupTable(ws, q, { upto = ws.length, cur = -1, bold = -1 } = {}) {
    return `<table class="${P}tb"><thead><tr><th>weight</th><th>level</th><th>restored</th><th>error</th></tr></thead><tbody>
      ${ws.map((w, i) => {
        const on = i < upto;
        return `<tr class="${i === cur ? "cur" : ""}"><td class="${i === bold ? "out" : ""}">${num(w)}</td>${on
          ? `<td>${q.codes[i]}</td><td>${num(q.restored[i])}</td><td>${num(q.err[i])}</td>`
          : `<td class="${P}hid">${i === cur ? "?" : "–"}</td><td class="${P}hid">–</td><td class="${P}hid">–</td>`}</tr>`;
      }).join("")}</tbody></table>`;
  }

  /* 1. The situation: what "4 bits" allows. */
  function situation({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [String(BITS), String(NLEV), fmt(2 ** 16)];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>A translator with no signal</h1>
        <p class="lead">A field engineer services water pumps at remote sites. The manuals and the site notes are in another language, and there is often no phone signal, so a hosted translation service is out. He wants an open translation model running on his laptop.</p>
        <p class="lead">From the last lesson: a ${fmt(PARAMS / 1e9)}-billion-parameter model needs about ${gbTxt(16)} for its weights at 16 bits each. His laptop cannot spare that. At <b>${BITS} bits</b> per weight it is about ${gbTxt(BITS)}, which fits. But a weight is a number like ${num(ORD[0])}, and ${BITS} bits cannot hold that number exactly.</p>
        <p class="task">How many different values can a ${BITS}-bit number take?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct, num: true })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right: each bit doubles the count, 2 × 2 × 2 × 2 = <b>${NLEV}</b>. So every weight, which could be any number, must become one of just ${NLEV} values. Replacing numbers with a few allowed values is <b>quantization</b>. Which ${NLEV} values, and how much is lost? That is this lesson.`, true)
          : ans === 0 ? kit.feedback(`${BITS} is the number of bits, not the number of values. Each bit is 0 or 1, and each extra bit doubles the count: 2 × 2 × 2 × 2.`, false)
          : kit.feedback(`${fmt(2 ** 16)} is what 16 bits can take: 2 multiplied by itself 16 times. With ${BITS} bits it is 2 multiplied by itself ${BITS} times.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 2. By hand: round eight real weights to the 16 levels of their group. */
  function byHand({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const q = QO;
    const paint = () => {
      const end = k >= ORD.length;
      const w = end ? 0 : ORD[k], x = end ? 0 : (w - q.low) / q.step;
      const right = end ? 0 : q.codes[k];
      // the three levels nearest the weight, in order
      const cand = end ? [] : Array.from({ length: q.levels + 1 }, (_, c) => c)
        .sort((a, b) => Math.abs(a - x) - Math.abs(b - x)).slice(0, 3).sort((a, b) => a - b);
      const val = c => q.low + c * q.step;
      const maxErr = Math.max(...q.err);
      el.innerHTML = `<h1>Round eight weights by hand</h1>
        <p class="lead">Eight real weights, side by side in one row of a weight matrix of <b>T5-small</b>, a small open model that translates. They form one <b>group</b>. The group stores two full-size numbers. The first is its <b>low</b> end: the smallest weight (${num(q.low)}). The second is a <b>step</b>. The ${NLEV} levels are low, low + 1 step, low + 2 steps, … up to the largest weight (${num(q.high)}). That is ${q.levels} steps, so step = (${num(q.high)} − ${num(q.low)}) ÷ ${q.levels} = <b>${num(q.step)}</b>. Each weight is stored as its level number, 0 to ${q.levels}: ${BITS} bits. In the table, <b>restored</b> is the number that level stands for, and <b>error</b> is how far it is from the weight.</p>
        ${end ? "" : `<p class="task">Weight ${k + 1} is ${num(w)}. Which level is nearest?</p>`}
        ${end ? "" : strip(q, w, cand)}
        ${groupTable(ORD, q, { upto: k, cur: end ? -1 : k })}
        <div class="lpanel">${end ? "" : kit.options(cand.map(c => `level ${c}: ${num(val(c))}`), { picked: wrong == null ? null : cand.indexOf(wrong), correct: cand.indexOf(right) })}
        ${wrong != null ? kit.feedback(`Level ${wrong} restores ${num(val(wrong))}, which is ${num(Math.abs(val(wrong) - w))} away from ${num(w)}. Level ${right} restores ${num(val(right))}, only ${num(Math.abs(val(right) - w))} away. Pick the level closest to the weight.`, false) : ""}
        ${end ? kit.feedback(`The table is full. Every weight moved a little: the largest error is ${num(maxErr)}, and none can be more than half a step (${num(q.step / 2)}), because a weight always sits between two levels. The smallest and the largest weight come back exactly: they are the ends of the range. <b>The step sets the error.</b>`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const c = cand[+b.dataset.i];
        if (c !== right) { wrong = c; paint(); return; }
        wrong = null; k++; paint();
        if (k >= ORD.length) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: one outlier stretches the range for the whole group. */
  function outlier({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "About the same as your group: the big weight only affects itself",
      "Much bigger: the big weight stretches the range, so the step grows for every weight",
      "Smaller: a wider range gives the levels more room"
    ];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>One weight far from the rest</h1>
        <p class="lead">The group just before yours, in the same row, holds <b>${num(OUTL[OUT_I], 2)}</b>: the weight farthest from zero in the whole matrix. The typical size of a weight in this matrix (the standard deviation) is ${num(STD)}. The other seven in that group are ordinary, like yours. Your eight weights had an average error of ${num(ORD_ERR)}.</p>
        <p class="task">Quantize that group the same way. Predict the average error of its seven ordinary weights.</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The low end is now ${num(QX.low, 4)}, so step = (${num(QX.high)} − ${num(QX.low)}) ÷ ${QX.levels} = <b>${num(QX.step)}</b>, about ${times(QX.step, QO.step)} times your step. The seven ordinary weights all land on level ${OUT_LEVELS.join(" or ")}, and their average error is <b>${num(OUT_ERR)}</b>: about ${times(OUT_ERR, ORD_ERR)} times yours. The big weight takes level 0, so ${NLEV - OUT_LEVELS.length - 1} of the ${NLEV} levels go unused, spread over the empty space between ${num(OUTL[OUT_I], 2)} and the rest.`, true)
          : ans === 0 ? kit.feedback(`The big weight is restored exactly, but it is the low end of the range. The step is (high − low) ÷ ${QX.levels}, so a far-away low end makes the step big for every weight in the group.`, false)
          : kit.feedback(`There are still only ${NLEV} levels. Spreading them over a range ${times(QX.high - QX.low, QO.high - QO.low)} times wider puts them ${times(QX.step, QO.step)} times farther apart, and the ordinary weights fall between them.`, false)}
        ${ok ? groupTable(OUTL, QX, { bold: OUT_I }) + kit.feedback(`So keep groups <b>small</b>, each with its own low and step: an outlier then spoils only its own group. The Hugging Face quantization guide describes the same effect: one large value stretches the range for every other weight. Outliers are a known problem in big models; the LLM.int8() paper found a few outlier dimensions in large models' hidden states (the numbers one layer passes to the next) and keeps those in 16 bits, while more than 99.9% of the values stay in 8 bits.`) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. The same rounding in NumPy, a recorded run on your eight weights, stepped. */
  const CODE1 = [
    "def quantize_group(weights, bits):",
    "    levels = 2 ** bits - 1",
    "    low = weights.min()",
    "    step = (weights.max() - low) / levels",
    "    codes = np.round((weights - low) / step)",
    "    restored = low + codes * step",
    "    return codes, restored"
  ];
  // group8.out.txt, TRACE of quantize_group(ORDINARY group, 4): the state before each listing line runs, then the return
  const TRACE = [
    { line: 1, vars: { bits: 4 } },
    { line: 2, vars: { bits: 4, levels: 15 } },
    { line: 3, vars: { bits: 4, levels: 15, low: -0.26953125 } },
    { line: 4, vars: { bits: 4, levels: 15, low: -0.26953125, step: 0.03502604166666667 } },
    { line: 5, vars: { bits: 4, levels: 15, low: -0.26953125, step: 0.03502604166666667, codes: [1, 2, 15, 7, 9, 0, 11, 12] } },
    { line: 6, vars: { bits: 4, levels: 15, low: -0.26953125, step: 0.03502604166666667, codes: [1, 2, 15, 7, 9, 0, 11, 12],
      restored: [-0.23450520833333333, -0.19947916666666665, 0.255859375, -0.024348958333333337, 0.04570312500000001, -0.26953125, 0.11575520833333336, 0.15078124999999998] } },
    { line: 6, event: "return", vars: { bits: 4, levels: 15, low: -0.26953125, step: 0.03502604166666667, codes: [1, 2, 15, 7, 9, 0, 11, 12],
      restored: [-0.23450520833333333, -0.19947916666666665, 0.255859375, -0.024348958333333337, 0.04570312500000001, -0.26953125, 0.11575520833333336, 0.15078124999999998] } }
  ];
  const FRAMES = TRACE.slice(0, -1).map((s, i) => ({ ln: s.line, vars: TRACE[i + 1].vars }));
  const GATE_LN = 4;                                     // predict before the codes line runs
  const HI_I = ORD.indexOf(Math.max(...ORD));
  const arr = (a, d = 4) => `[${a.map(v => Number.isInteger(v) && d === 0 ? String(v) : num(v, d)).join(", ")}]`;
  const SAY1 = {
    1: f => `${NLEV} levels have ${f.vars.levels} steps between them, so levels = 2 ** ${f.vars.bits} − 1 = ${f.vars.levels}.`,
    2: f => `low is the smallest weight, ${num(f.vars.low)}: level 0.`,
    3: f => `step = (largest − low) ÷ ${f.vars.levels} = ${num(f.vars.step)}, the step you used by hand.`,
    4: f => `Every weight at once: how many steps above low it is, rounded to the nearest whole number. These are the level numbers in your table: ${arr(f.vars.codes, 0)}. They are what gets stored, ${BITS} bits each.`,
    5: f => `Turning the levels back into numbers: low + level × step. This is what the model computes with when it runs.`,
    6: f => `Returned. Each restored weight is your table's restored column. The file keeps ${ORD.length} levels of ${BITS} bits plus two numbers for the group, low and step. Libraries, and the Hugging Face docs, call the step the <b>scale</b>. Instead of low, many store a <b>zero point</b>: the level number that stands for 0.0.`
  };
  function codeGroup({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const GATE = FRAMES.findIndex(f => f.ln === GATE_LN);
    const top = QO.levels;
    const popts = [String(top - 1), String(top), String(top + 1)];
    const pright = 1;
    const paint = () => {
      const f = FRAMES[i], gate = i === GATE - 1 && pred !== pright, v = f.vars;
      const show = k => v[k] == null ? `<span class="${P}hid">–</span>` : Array.isArray(v[k]) ? arr(v[k], k === "codes" ? 0 : 4) : typeof v[k] === "number" && !Number.isInteger(v[k]) ? num(v[k]) : v[k];
      el.innerHTML = `<h1>The same rounding in NumPy</h1>
        <p class="lead"><code>weights</code> is a NumPy array holding your eight weights, and <code>bits</code> is ${BITS}. NumPy does the arithmetic on all eight at once. The code calls the level numbers <b>codes</b>. Each step replays a real run on this site's Mac.</p>
        <p class="task">Step through to the end. Before the codes are computed, predict one of them.</p>
        ${kit.code(CODE1, f.ln)}
        <div class="${P}mat">weights  ${arr(ORD)}\nlevels ${show("levels")}   low ${show("low")}   step ${show("step")}\ncodes    ${show("codes")}\nrestored ${show("restored")}</div>
        <div class="vars"><span>step <b>${i + 1} / ${FRAMES.length}</b></span></div>
        ${kit.feedback(SAY1[f.ln](f))}
        ${gate ? `<div id="pred"><p class="task">Next: <code>codes = np.round((weights - low) / step)</code>. What code will the largest weight, ${num(ORD[HI_I])}, get?</p>${kit.options(popts, { picked: pred, correct: pright, num: true })}
          ${pred == null ? "" : pred === 2 ? kit.feedback(`There are ${NLEV} levels, but they are numbered from 0, so the top one is ${top}. The largest weight is exactly ${top} steps above low: (largest − low) ÷ step = ${top}.`, false)
          : kit.feedback(`Too low. The step was chosen so that the largest weight sits exactly on the top level: (largest − low) ÷ step has nothing to round. Which number is the top level?`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FRAMES.length - 1 || gate ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FRAMES.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 5. The whole real matrix: predict how group size and bits change the error. */
  // From docs/ai-path/runs/s5c-quantization/layer.out.txt: [bits, group, bits per weight, mean |weight error|, output error %]
  const LAYER = [
    [8, "whole", 8.0, 0.017189, 5.836], [8, 2048, 8.0156, 0.002721, 1.057], [8, 128, 8.25, 0.00175, 0.66], [8, 32, 9.0, 0.001258, 0.482],
    [4, "whole", 4.0, 0.314868, 102.545], [4, 2048, 4.0156, 0.046278, 18.192], [4, 128, 4.25, 0.029721, 11.263], [4, 32, 5.0, 0.021406, 8.242],
    [3, "whole", 3.0, 0.276427, 104.207], [3, 2048, 3.0156, 0.099848, 38.747], [3, 128, 3.25, 0.063872, 24.149], [3, 32, 4.0, 0.045917, 17.687],
    [2, "whole", 2.0, 1.522266, 438.29], [2, 2048, 2.0156, 0.236624, 89.537], [2, 128, 2.25, 0.149737, 56.452], [2, 32, 3.0, 0.107942, 41.133]
  ];
  const ROWS = 512, COLS = 2048, NW = ROWS * COLS;
  const L = (bits, group) => LAYER.find(r => r[0] === bits && r[1] === group);
  const oe = (bits, group) => L(bits, group)[4];
  const groupName = g => g === "whole" ? "whole matrix" : g === COLS ? `one row (${fmt(g)})` : String(g);
  function layerTable(rows, { hl = -1 } = {}) {
    return `<table class="${P}tb"><thead><tr><th>bits</th><th>group size</th><th>output error</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr class="${i === hl ? "cur" : ""}"><td>${r[0]}</td><td>${groupName(r[1])}</td><td class="${r[4] >= 50 ? "bad" : ""}">${pct(r[4], 2)}</td></tr>`).join("")}</tbody></table>`;
  }
  function wholeLayer({ el, done, kit }) {
    css();
    let q1 = null, q2 = null, q3 = null;
    const g = 32;
    const o4 = oe(4, g), o8 = oe(8, g), o3 = oe(3, g), ow = oe(4, "whole");
    const r84 = o4 / o8, r43 = o3 / o4;
    const lev = b => 2 ** b - 1;
    const q1opts = [`About the same, near ${pct(o4, 0)}`, "Near 100%: the outputs are mostly rounding noise", `Below ${pct(o4, 0)}: fewer numbers to store`];
    const q2opts = ["About 2 times bigger", `About ${times(lev(8), lev(4))} times bigger`, `About ${fmt(2 ** 8)} times bigger`];
    const q3opts = ["About 1.3 times bigger", "About 2 times bigger", "About 8 times bigger"];
    const paint = () => {
      el.innerHTML = `<h1>The whole matrix</h1>
        <p class="lead">The same <code>quantize_group</code>, run over the whole ${ROWS} × ${fmt(COLS)} matrix: ${fmt(NW)} weights, cut into groups of consecutive weights along each row. To see what the rounding does to the layer's work, the run multiplies 64 made-up inputs (random numbers, seed 0) by the original and by the restored matrix. <b>Output error</b> is how far the outputs moved, as a share of their size.</p>
        <div id="q1" class="${P}q"><p class="task">At ${BITS} bits with groups of ${g}, the output error is ${pct(o4, 2)}. Now use one low and one step for the <b>whole matrix</b> (which holds the ${num(OUTL[OUT_I], 2)}). Predict.</p>
          ${kit.options(q1opts, { picked: q1, correct: 1 })}
          ${q1 == null ? "" : q1 === 1 ? kit.feedback(`Right: <b>${pct(ow, 1)}</b>. One outlier now sets the step for all ${fmt(NW)} weights, and most of them fall onto a few levels. Smaller groups bring it down:`, true) + layerTable([4].flatMap(b => ["whole", COLS, 128, 32].map(x => L(b, x))))
            : q1 === 0 ? kit.feedback(`The ${num(OUTL[OUT_I], 2)} used to spoil one group of ${g}. With one range for the whole matrix it sets the step for every weight, as it did for the seven in screen 3.`, false)
            : kit.feedback(`It does store fewer numbers: one low and one step instead of one pair per group. But that one step must stretch from ${num(OUTL[OUT_I], 2)} to the largest weight, so it is big for everyone.`, false)}</div>
        ${q1 === 1 ? `<div id="q2" class="${P}q"><p class="task">Back to groups of ${g}. At <b>8 bits</b> the output error is ${pct(o8, 2)}. Predict how much bigger it is at ${BITS} bits.</p>
          ${kit.options(q2opts, { picked: q2, correct: 1 })}
          ${q2 == null ? "" : q2 === 1 ? kit.feedback(`Right: ${pct(o4, 2)} ÷ ${pct(o8, 2)} ≈ <b>${r84.toFixed(1)} times</b>. 8 bits give ${lev(8) + 1} levels, ${lev(8)} steps; ${BITS} bits give ${lev(4)} steps. The same range in ${lev(4)} steps makes each step ${lev(8)} ÷ ${lev(4)} = ${times(lev(8), lev(4))} times bigger, and the error follows the step.`, true)
            : q2 === 0 ? kit.feedback(`Halving the bits does not halve the levels. Each bit doubles the count, so 8 bits have ${lev(8) + 1} levels and ${BITS} bits only ${lev(4) + 1}. Compare the steps: ${lev(8)} against ${lev(4)}.`, false)
            : kit.feedback(`${fmt(2 ** 8)} is the number of levels at 8 bits. The error follows the step size, and the step grows by ${lev(8)} ÷ ${lev(4)}: the number of steps at 8 bits divided by the number at ${BITS}.`, false)}</div>` : ""}
        ${q2 === 1 ? `<div id="q3" class="${P}q"><p class="task">One bit fewer: <b>3 bits</b>, groups of ${g}. How much bigger than at ${BITS} bits?</p>
          ${kit.options(q3opts, { picked: q3, correct: 1 })}
          ${q3 == null ? "" : q3 === 1 ? kit.feedback(`Right: ${pct(o3, 2)}, about <b>${r43.toFixed(1)} times</b>. 3 bits give ${lev(3) + 1} levels, ${lev(3)} steps instead of ${lev(4)}, so each step is about twice as big. Every bit you remove roughly doubles the error.`, true) + layerTable([8, 4, 3, 2].map(b => L(b, g)))
            : q3 === 0 ? kit.feedback(`Going from ${BITS} to 3 bits is not a quarter less precision. The levels halve, ${lev(4) + 1} to ${lev(3) + 1}, so the step about doubles.`, false)
            : kit.feedback(`One bit fewer halves the number of levels, it does not divide them by 8. ${lev(4)} steps become ${lev(3)}: each step about twice as big.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { q1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { q2 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q3 .lopts button").forEach(b => b.onclick = () => { q3 = +b.dataset.i; paint(); if (q3 === 1) done(); });
    };
    paint();
  }

  /* 6. Broken on purpose: a colleague's quantizer with a real, measured bug. Report first, then the code. */
  const BROKEN_CODE = [
    "def quantize_group(weights, bits):",
    "    levels = 2 ** bits - 1",
    "    low = weights.min()",
    "    step = (weights.max() - low) / levels",
    "    scaled = (weights - low) / step",
    "    codes = scaled.astype(np.uint8)",
    "    restored = low + codes * step",
    "    return codes, restored"
  ];
  // From docs/ai-path/runs/s5c-quantization/broken.out.txt (4 bits, groups of 32, the same matrix). The header lines
  // are cut (shown as …); the lines kept are copied unaltered.
  const BROKEN = [
    "  codes used: 0..15",
    "  mean error (restored - original): -0.043055",
    "  restored below original: 93.9%   above: 0.0%",
    "  largest error, in steps: 1.000",
    "  mean |error|: 0.043055",
    "  output error: 15.766%"
  ];
  const FIXED = [
    "  codes used: 0..15",
    "  mean error (restored - original): -0.000028",
    "  restored below original: 46.8%   above: 46.7%",
    "  largest error, in steps: 0.500",
    "  mean |error|: 0.021406",
    "  output error: 8.242%"
  ];
  const report = rows => ["…", ...rows].map(LessonKit.esc).join("\n");
  const val = line => line.split(": ")[1];
  const REPORT_OPTS = [0, 2, 4, 5];                       // report lines offered in the first question
  const SIDE_LN = 2;                                      // the below/above line
  const BUG_LN = 5;
  const LINE_FB = {
    1: `15 steps between 16 levels is right, and the report agrees: the codes use 0 to 15, all ${NLEV} levels. A wrong count would show up there.`,
    2: "low is the smallest weight of the group. It is correct: the smallest weight comes back exactly. A wrong low would shift weights both ways, but here none is restored above its original.",
    3: "The step is the range divided by the number of steps, the same as your hand-made table. If it were wrong, codes would fall outside 0..15 or never reach 15.",
    4: "This line measures how many steps above low each weight is, as a fraction such as 6.9. That is correct, and it is the same sum as in your NumPy version. Look at what happens to that fraction on the next line.",
    6: "This line only turns codes back into numbers: low plus level times step. The codes it receives are already wrong."
  };
  function broken({ el, done, kit }) {
    css();
    let a0 = null, a1 = null, a2 = null;
    const lineOpts = [1, 2, 3, 4, 5, 6];
    const fixOpts = [
      "<code>codes = np.round(scaled)</code>",
      "<code>codes = scaled.astype(np.int16)</code>",
      "<code>step = (weights.max() - low) / 2 ** bits</code>"
    ];
    const REPORT_FB = {
      0: `That line is normal: all ${NLEV} levels, 0 to ${QO.levels}, are used, the same as in a correct quantizer.`,
      4: `That line says the errors are bigger (${val(BROKEN[4])}), but not which way they go. Look for a line that compares down and up.`,
      5: "That is the symptom you already know: the outputs moved more. It says nothing about how each weight was rounded."
    };
    const paint = () => {
      const c0 = a0 === REPORT_OPTS.indexOf(SIDE_LN), c1 = a1 === lineOpts.indexOf(BUG_LN);
      el.innerHTML = `<h1>A colleague's quantizer</h1>
        <p class="lead">A colleague wrote his own version of <code>quantize_group</code> that stores each code in one byte. On the same matrix, at ${BITS} bits with groups of 32, the correct version gives ${val(FIXED[5])} output error; his gives ${val(BROKEN[5])}. His check script printed this report.</p>
        <div class="${P}cap">Printed by broken.py on this site's Mac, ${RUN_DATE}</div>
        <div class="${P}mat">${report(BROKEN)}</div>
        <div id="q0" class="${P}q"><p class="task">Read the report before the code. Which line shows <b>how</b> the rounding goes wrong, not just that the result is worse?</p>
          <div class="${P}lopt">${kit.options(REPORT_OPTS.map(n => `<code>${kit.esc(BROKEN[n].trim())}</code>`), { picked: a0, correct: REPORT_OPTS.indexOf(SIDE_LN) })}</div>
          ${a0 == null ? "" : c0 ? kit.feedback(`Right. Rounding to the nearest level sends about as many weights down as up. Here ${BROKEN[2].match(/[\d.]+%/g)[0]} go down and ${BROKEN[2].match(/[\d.]+%/g)[1]} go up: every weight that moves, drops. Two other lines agree: the mean error is ${kit.esc(val(BROKEN[1]))}, not near zero, and the largest error is ${val(BROKEN[3])} step, not half a step.`, true)
            : kit.feedback(REPORT_FB[REPORT_OPTS[a0]], false)}</div>
        ${c0 ? `${kit.code(BROKEN_CODE, -1)}
        <div id="q1" class="${P}q"><p class="task">The rounding only goes down. Which line of his code causes it?</p>
          <div class="${P}lopt">${kit.options(lineOpts.map(n => `<code>${kit.esc(BROKEN_CODE[n].trim())}</code>`), { picked: a1, correct: lineOpts.indexOf(BUG_LN) })}</div>
          ${a1 == null ? "" : c1 ? kit.feedback(`Right. <code>.astype(np.uint8)</code> turns a number into a whole number by cutting off the fraction: 6.9 becomes 6, not 7. The scaled weights are never negative, so every weight drops to the level at or below it. That is why the errors all point one way, and why they reach up to a full step instead of half a step. The average error is ${(+val(BROKEN[4]) / +val(FIXED[4])).toFixed(1)} times the correct version's, as if the quantizer had lost a bit.`, true)
            : kit.feedback(LINE_FB[lineOpts[a1]], false)}</div>` : ""}
        ${c1 ? `<div id="q2" class="${P}q"><p class="task">Which change fixes it?</p>
          <div class="${P}lopt">${kit.options(fixOpts, { picked: a2, correct: 0 })}</div>
          ${a2 == null ? "" : a2 === 0 ? kit.feedback(`Right. Round to the nearest level first; then the codes can be stored in any small integer type. The fixed version's report:`, true) + `<div class="${P}mat">${report(FIXED)}</div>` + kit.feedback(`Errors now point both ways (${FIXED[2].trim().replace(/\s+/g, " ")}), the mean is near zero, and no weight is more than half a step off. The lesson for debugging: a quantizer's errors should be balanced around zero and at most half a step. An error that leans one way points to the rounding.`)
            : a2 === 1 ? kit.feedback("A wider integer type still cuts off the fraction. The problem is how the number becomes whole, not how big the box is.", false)
            : kit.feedback(`Dividing by ${NLEV} instead of ${QO.levels} makes the step smaller, so the largest weight gets code ${NLEV}, which does not fit in ${BITS} bits. And the fraction is still cut off: every weight still drops down.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q0 .lopts button").forEach(b => b.onclick = () => { a0 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { a2 = +b.dataset.i; paint(); if (a2 === 0) done(); });
    };
    paint();
  }

  /* 7. What it costs: extra bits per group, a memory budget, and how to judge the loss. */
  const EXTRA = 32;                                       // low and step, 16 bits each, per group
  const bpw = (bits, group) => bits + EXTRA / group;
  const BUDGET = 4;                                       // GB the laptop can give the weights (story)
  const CHOICES = [[8, 32], [4, 32], [4, 128], [3, 32], [3, 128]];
  function cost({ el, done, kit }) {
    css();
    let q1 = null, q2 = null, q3 = null;
    const b1 = [BITS, BITS + 16 / 32, bpw(BITS, 32)];
    const fits = CHOICES.filter(([b, g]) => gb(bpw(b, g)) <= BUDGET);
    const best = fits.reduce((x, y) => oe(...x) <= oe(...y) ? x : y);
    const bestI = CHOICES.findIndex(c => c === best);
    const runner = fits.filter(c => c !== best).reduce((x, y) => oe(...x) <= oe(...y) ? x : y);   // next-best that fits
    const lbl = ([b, g]) => `${b} bits, groups of ${g}`;
    const q3opts = [
      "Yes: it is well under 20%",
      "No: any error over 1% ruins a translation",
      "This number cannot tell. Translate his own test sentences with the 16-bit model and the quantized one, and compare"
    ];
    const paint = () => {
      const tab = `<table class="${P}tb"><thead><tr><th>setting</th><th>bits per weight</th><th>output error</th></tr></thead><tbody>
        ${CHOICES.map(c => `<tr><td>${lbl(c)}</td><td>${q1 === 2 ? +bpw(...c).toFixed(2) : "?"}</td><td>${pct(oe(...c), 2)}</td></tr>`).join("")}</tbody></table>`;
      el.innerHTML = `<h1>What the groups cost</h1>
        <p class="lead">Small groups cut the error, but every group stores its own low and step. In this lesson's scheme each is a 16-bit number: ${EXTRA} extra bits per group.</p>
        <div id="q1" class="${P}q"><p class="task">At ${BITS} bits with groups of 32, how many bits does each weight really cost?</p>
          ${kit.options(b1.map(String), { picked: q1, correct: 2, num: true })}
          ${q1 == null ? "" : q1 === 2 ? kit.feedback(`Right: ${BITS} + ${EXTRA} ÷ 32 = <b>${bpw(BITS, 32)}</b>. Groups of 128 share the same ${EXTRA} bits among 4 times as many weights: ${bpw(BITS, 128)} bits per weight.`, true)
            : q1 === 0 ? kit.feedback(`${BITS} bits is only the level. Each group of 32 also stores low and step, ${EXTRA} bits, shared by its 32 weights.`, false)
            : kit.feedback(`That counts one 16-bit number per group. The group keeps two, low and step: ${EXTRA} bits shared by 32 weights.`, false)}</div>
        ${q1 === 2 ? `<div id="q2" class="${P}q"><p class="task">After the system, the app and the KV cache, the laptop can give <b>${BUDGET} GB</b> to the weights of the ${fmt(PARAMS / 1e9)}-billion-parameter model. Which setting has the lowest error that fits? (The errors are from the T5 matrix of screen 5.)</p>
          ${tab}
          ${kit.options(CHOICES.map(lbl), { picked: q2, correct: bestI })}
          ${q2 == null ? "" : q2 === bestI ? kit.feedback(`Right. ${lbl(best)}: ${fmt(PARAMS / 1e9)} billion × ${bpw(...best)} bits ÷ 8 = <b>${gbTxt(bpw(...best))}</b>, and the lowest error of the settings that fit. ${lbl(runner)} costs a little less, ${bpw(...runner)} bits per weight, but its error is ${pct(oe(...runner), 2)}: here, ${best[0]} bits with bigger groups beat ${runner[0]} bits with small groups.`, true)
            : gb(bpw(...CHOICES[q2])) > BUDGET ? kit.feedback(`${lbl(CHOICES[q2])} costs ${bpw(...CHOICES[q2])} bits per weight: ${fmt(PARAMS / 1e9)} billion × ${bpw(...CHOICES[q2])} ÷ 8 = ${gbTxt(bpw(...CHOICES[q2]))}. That is over ${BUDGET} GB.`, false)
            : kit.feedback(`It fits (${gbTxt(bpw(...CHOICES[q2]))}), but its error is ${pct(oe(...CHOICES[q2]), 2)}. Another setting that fits has less.`, false)}</div>` : ""}
        ${q2 === bestI ? `<div id="q3" class="${P}q"><p class="task">${lbl(best)} moved this matrix's outputs by ${pct(oe(...best), 1)}. Is that good enough for his translations?</p>
          ${kit.options(q3opts, { picked: q3, correct: 2 })}
          ${q3 == null ? "" : q3 === 2 ? kit.feedback(`Right. One matrix, random inputs and the simplest rounding do not say how translations change. A model has many layers, real inputs differ, and the tools people use round more cleverly: the Hugging Face guide says methods that calibrate on sample data usually give better accuracy at 4 bits and below. So keep a small set of his real sentences, translate them with the 16-bit model and with each quantized one, and compare. The same guide's advice: benchmark accuracy on your own task and hardware before you pick.`, true)
            : kit.feedback(`There is no safe threshold for this number. It comes from one matrix, random inputs and plain rounding, not from the translations he needs. Test on his own sentences instead.`, false)}</div>` : ""}`;
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { q1 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q2 .lopts button").forEach(b => b.onclick = () => { q2 = +b.dataset.i; paint(); });
      el.querySelectorAll("#q3 .lopts button").forEach(b => b.onclick = () => { q3 = +b.dataset.i; paint(); if (q3 === 2) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, cost; task: which cost bites first. */
  const COSTS = [
    "Quality loss that must be measured",
    "Hardware that must support the format",
    "Time to quantize with sample data"
  ];
  const BIG = [
    ["A team squeezes a model that reads medicine doses from forms down to 2 bits, so it fits on a phone.", 0,
      "Right. The Hugging Face benchmarks show a noticeable drop below 4 bits, especially at 2. For doses, every mistake matters: measure on real forms before shipping, or use more bits and a smaller model."],
    ["A team downloads a model stored in an 8-bit floating-point format (FP8) to run on an older graphics card.", 1,
      "Right. FP8 arithmetic needs recent hardware support; the Hugging Face docs list which GPUs have it. A format the hardware cannot run is the first wall, before any question of quality."],
    ["A team wants the best possible 4-bit accuracy for a big model with a method that calibrates on sample data, and the release is tonight.", 2,
      "Right. Calibration runs sample data through the model to choose how to round each layer; the Hugging Face guide says it takes minutes to hours. Plan for it, or start from a checkpoint someone already quantized."]
  ];
  const BIG_WRONG = [
    { 1: "Even if the phone runs the format, the first question is whether a 2-bit model still reads doses correctly. At 2 bits the rounding error is large, and a wrong dose is costly.", 2: "Quantizing takes time, but the first question is whether a 2-bit model still reads doses correctly." },
    { 0: "Quality comes second. First, the card has to be able to run FP8 arithmetic at all.", 2: "The model is already quantized; nothing needs to be calibrated. The question is whether the card can run that format." },
    { 0: "Calibration exists to keep quality up; the first thing to bite here is the clock: calibration takes minutes to hours.", 1: "Nothing here says the hardware is wrong. The deadline is tonight, and calibration takes time." }
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to quantize</h1>
        <p class="lead"><b>What it is for:</b> making a model's weights smaller, so it fits in less memory and is quicker to load and move. Generating one token at a time mostly reads weights from memory, so fewer bits can also make that faster.</p>
        <p class="lead"><b>Reach for it</b> when memory is the limit: a laptop, one GPU, many copies to serve.</p>
        <p class="lead"><b>Not when</b> the model already fits and you need every bit of quality: keep 16 bits. Not to fix wrong answers: rounding only removes information. Not to train every weight: train an adapter on a frozen quantized model instead, as QLoRA does.</p>
        <p class="lead"><b>Cost:</b> some quality, which you must measure on your task; tools that support the format; time, if the method calibrates.</p>
        <p class="task">For each situation, pick the cost that bites first.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(COSTS.map(kit.esc), { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === r ? yes : BIG_WRONG[i][ans[i]]), ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: would quantizing help? Two "no" cases. */
  const CHAT_GB = 16, GPU_GB = 12;                        // scenario data for the first case
  const chat8 = CHAT_GB * 8 / 16;                         // GB at 8 bits instead of 16
  const CASES = [
    [`A chat model needs about ${CHAT_GB} GB for its weights at 16 bits. The company's GPU has ${GPU_GB} GB, and buying a bigger one will take months.`, true,
      `Yes. At 8 bits the weights need 8/16 of that, around ${chat8} GB, and the Hugging Face benchmarks put 8-bit accuracy very close to 16-bit. Check on your own test set, then serve it.`,
      `Memory is exactly the limit here. 8 bits instead of 16 halves the weights to about ${chat8} GB, under the ${GPU_GB} GB, and 8-bit quality is usually very close to 16-bit. Measure it on your own tests.`],
    ["A desktop app ships an open model to customers' laptops, and many customers have slow internet. The download is too big.", true,
      `Yes. A ${BITS}-bit file is about 1/${16 / BITS} the size of the 16-bit one (${BITS} bits per weight instead of 16). Test the quantized model on the app's real tasks before you ship it.`,
      `A smaller file is what quantization gives you: about 1/${16 / BITS} of the size at ${BITS} bits. The cost is some quality, which you test before shipping.`],
    ["A 16-bit model keeps mistranslating the names of pump parts. Someone suggests quantizing it to 8 bits to make the answers cleaner.", false,
      "No. Quantization replaces each weight with a nearby level, which can only add error. It cannot teach the model part names. Put a glossary in the prompt or tune the model on examples.",
      "Rounding the weights can only move the model away from what it learned. It never adds knowledge. The fix for missing part names is a glossary in the prompt or fine-tuning."],
    ["A server has plenty of GPU memory. It is slow because it runs large batches of long documents at once, and the GPU's arithmetic is fully busy.", false,
      "No, not with weight-only quantization (only the weights get fewer bits, as in this lesson). The Hugging Face guide says it saves memory but does not always run faster, because the weights must be turned back into numbers before each multiplication. It helps when reading weights is the bottleneck, not when the arithmetic is.",
      "Memory is not the limit here, the arithmetic is. Weight-only quantization saves memory and helps when reading weights is the bottleneck. Turning weights back into numbers adds work, so a busy GPU may get slower, not faster."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would quantizing help?</h1>
        <p class="lead">Four situations without the field engineer.</p>
        <p class="task">For each one, decide if quantizing the model's weights is the right move. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (browser practice). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Fewer bits, measured</h1>
      <p class="lead">You can now say what quantization is: each group of weights keeps a low end and a step, and every weight becomes the nearest of 2<sup>bits</sup> levels. Why it works: the error is at most half a step, and small groups keep the step small even when a group holds an outlier. What it costs: about ${times(oe(BITS, 32), oe(8, 32))} times more error at ${BITS} bits than at 8 in your run, roughly double for each bit you remove, and extra bits per weight for every group's low and step. Whether the loss is too high is decided on your own task, against the 16-bit model.</p>
      <p class="lead"><b>When to reach for it:</b> memory or download size is the limit. <b>When not:</b> the model already fits and you need full quality, the answers are wrong for another reason, or the GPU's arithmetic is the bottleneck.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson: you write quantize and restore for groups of weights in NumPy and measure the error at 8, 4 and 3 bits.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. The model you run there on a laptop is already quantized, and you find out why one run is much slower than another.</p>` : ""}`;
    done();
  }

  LessonKit.define("s5c-quantization", {
    title: "Quantization: fewer bits per weight",
    checked: "2026-11-14",
    sources: [
      "https://huggingface.co/docs/transformers/main/en/quantization/concept_guide",
      "https://huggingface.co/docs/transformers/main/en/quantization/overview",
      "https://huggingface.co/docs/transformers/main/en/quantization/selecting",
      "https://arxiv.org/abs/2208.07339",
      "https://huggingface.co/google-t5/t5-small"
    ],
    interview: [{
      q: "You quantized a 7B model to 4 bits so it fits on one GPU, and users report that some answers got worse. How do you find out whether quantization is the cause, and what do you try?",
      good: [
        "Run the same golden set through the 16-bit and the 4-bit model and compare per task, so you know where the loss is and how big",
        "If quantization is the cause, try smaller groups, 8 bits for the sensitive layers or the whole model, or a method that calibrates on sample data",
        "Check the memory budget for each option: smaller groups and more bits cost memory, so pick the best quality that still fits",
        "Rule out other changes first: the prompt, the chat template, the sampling settings"
      ],
      weak: "Saying 4-bit is always fine, or always bad, without measuring both models on the same task."
    }, {
      q: "You quantized a layer to 4 bits with one scale for the whole weight matrix, and its outputs are badly off. The matrix holds one weight of about −10, while most weights are well under 1. What is going on, what do you change, and what does the change cost in memory?",
      good: [
        "Each weight is rounded to the nearest of 2^bits levels spread over its group's range, so the error is at most half a step",
        "One outlier stretches the range and makes the step big for every weight that shares it; small groups keep the damage local",
        "Each group stores its scale (and low end or zero point), so smaller groups add bits per weight: 32 extra bits over 32 weights is one more bit each",
        "Removing one bit roughly doubles the error; group size and bits are traded against a memory budget"
      ],
      weak: "Saying groups are for speed or parallelism, without the link between range, step and error."
    }],
    screens: [situation, byHand, outlier, codeGroup, wholeLayer, broken, cost, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(ORD.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(FRAMES.findIndex(f => f.ln === GATE_LN) - 1).fill("[data-next]"), "#pred [data-wrong]"],
        right: ["#pred [data-right]", ...Array(FRAMES.length - FRAMES.findIndex(f => f.ln === GATE_LN)).fill("[data-next]")] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", "#q2 [data-right]", "#q3 [data-right]"] },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q1 [data-right]", "#q2 [data-right]", "#q3 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
