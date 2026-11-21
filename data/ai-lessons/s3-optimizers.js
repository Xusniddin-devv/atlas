/* Lesson: optimizers (SGD, momentum, Adam). Story: a sound engineer's auto-balance tool moves two mixing-desk
   faders, a very sensitive vocal fader and a gentle bass fader, towards the right mix by gradient descent.
   Ideas: (1) with one learning rate for every weight, the most sensitive weight caps the step size and the gentle
   one crawls; momentum keeps a running sum of past gradients, so zig-zag pushes cancel and steady pushes add up;
   (2) Adam gives every weight its own step size by dividing by the size of its recent gradients.
   Data, all real runs on this Mac (no model calls):
   - docs/ai-path/runs/s3-optimizers/toy_paths.py + toy_paths.out.txt: the two-fader mix with plain steps,
     momentum and Adam (paths, steps until the error is below 0.01);
   - docs/ai-path/runs/s3-optimizers/adam_trace.py + adam_trace.out.txt: Adam from scratch, traced line by line;
   - docs/ai-path/runs/s3-optimizers/torch_optim.py + torch_optim.out.txt: the same faders with torch.optim, what each
     optimizer stores per weight, and a small network trained with six optimizer settings.
   Lesson-local picture (the fader plane, an inline SVG) and table style: see ensureStyle() and plane(). */
(() => {
  const ID = "s3-optimizers";
  const P = `lx-${ID}`;

  /* ---------- Data copied from the runs ---------- */
  // toy_paths.py: error = 10 * vocal**2 + 0.5 * bass**2, so gradient = (20 * vocal, bass). Points are [vocal, bass].
  const SENS_VOCAL = 20, SENS_BASS = 1, LR = 0.09, MU = 0.5, MU_HIGH = 0.9, GOAL = 0.01;
  const error = p => 10 * p[0] ** 2 + 0.5 * p[1] ** 2;
  const grad = p => [SENS_VOCAL * p[0], SENS_BASS * p[1]];
  // toy_paths.out.txt, "path_40" (start + 40 steps) and "steps_to_error_below_0.01"
  const SGD = [[0.5,-4],[-0.4,-3.64],[0.32,-3.3124],[-0.256,-3.0143],[0.2048,-2.743],[-0.1638,-2.4961],[0.1311,-2.2715],[-0.1049,-2.067],[0.0839,-1.881],[-0.0671,-1.7117],[0.0537,-1.5577],[-0.0429,-1.4175],[0.0344,-1.2899],[-0.0275,-1.1738],[0.022,-1.0682],[-0.0176,-0.972],[0.0141,-0.8845],[-0.0113,-0.8049],[0.009,-0.7325],[-0.0072,-0.6666],[0.0058,-0.6066],[-0.0046,-0.552],[0.0037,-0.5023],[-0.003,-0.4571],[0.0024,-0.416],[-0.0019,-0.3785],[0.0015,-0.3445],[-0.0012,-0.3135],[0.001,-0.2852],[-0.0008,-0.2596],[0.0006,-0.2362],[-0.0005,-0.215],[0.0004,-0.1956],[-0.0003,-0.178],[0.0003,-0.162],[-0.0002,-0.1474],[0.0002,-0.1341],[-0.0001,-0.1221],[0.0001,-0.1111],[-0.0001,-0.1011],[0.0001,-0.092]];
  const MOM = [[0.5,-4],[-0.4,-3.64],[-0.13,-3.1324],[0.239,-2.5967],[-0.0067,-2.0951],[-0.1175,-1.6558],[0.0386,-1.2871],[0.0472,-0.9869],[-0.0334,-0.748],[-0.0135,-0.5612],[0.0208,-0.4173],[0.0005,-0.3078],[-0.0106,-0.2254],[0.0029,-0.1638],[0.0044,-0.1183],[-0.0028,-0.0849],[-0.0014,-0.0606],[0.0018,-0.043],[0.0001,-0.0303],[-0.0009,-0.0212],[0.0002,-0.0148],[0.0004,-0.0102],[-0.0002,-0.007],[-0.0001,-0.0048],[0.0002,-0.0033],[0,-0.0022],[-0.0001,-0.0015],[0,-0.001],[0,-0.0006],[0,-0.0004],[0,-0.0003],[0,-0.0002],[0,-0.0001],[0,-0.0001],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]];
  const MOM_HIGH = [[0.5,-4],[-0.4,-3.64],[-0.49,-2.9884],[0.311,-2.133],[0.4721,-1.1712],[-0.2327,-0.2001],[-0.4482,0.6918],[0.1646,1.4323],[0.4198,1.9699],[-0.1062,2.2764],[-0.3884,2.3473],[0.0567,2.1999],[0.3553,1.8693],[-0.0155,1.4035],[-0.3213,0.8579],[-0.0182,0.2897],[0.2873,-0.2477],[0.0451,-0.7091],[-0.2541,-1.0606],[-0.066,-1.2815],[0.2221,-1.3649],[0.0816,-1.3172],[-0.1917,-1.1556],[-0.0926,-0.9063],[0.1633,-0.6003],[0.0997,-0.2708],[-0.137,0.05],[-0.1034,0.3343],[0.113,0.56],[0.1044,0.7128],[-0.0912,0.7862],[-0.1031,0.7814],[0.0718,0.7068],[0.0999,0.5761],[-0.0546,0.4066],[-0.0954,0.2174],[0.0396,0.0276],[0.0898,-0.1457],[-0.0267,-0.2886],[-0.0835,-0.3912],[0.0157,-0.4483]];
  const SGD_LR10 = [[0.5,-4],[-0.5,-3.6],[0.5,-3.24],[-0.5,-2.916],[0.5,-2.6244],[-0.5,-2.362]]; // "sgd lr=0.1", first 6
  const SGD_LR11 = [[0.5,-4],[-0.6,-3.56],[0.72,-3.1684],[-0.864,-2.8199],[1.0368,-2.5097],[-1.2442,-2.2336]]; // "sgd lr=0.11", first 6
  const ERR40_LR11 = 5400571.155741, ERR40_LR10 = 2.501748; // "error_after_40"
  const ADAM = [[0.5,-4],[0.4,-3.9],[0.3012,-3.8001],[0.2049,-3.7003],[0.1129,-3.6007],[0.0278,-3.5013]]; // "adam lr=0.1", first 6
  const ADAM_LR = 0.1, ADAM_LR_HIGH = 0.5;
  const REACH = { sgd: 36, mom: 14, momHigh: 46, adam: 54, adamHigh: 44 }; // steps_to_error_below_0.01

  // adam_trace.out.txt: [line about to run, event (l line / r return), t, faders, g, m, v, m_hat, v_hat]
  const TRACE = [[1,"l",null,[0.5,-4],null,null,null,null,null],[2,"l",null,[0.5,-4],null,[0,0],[0,0],null,null],[3,"l",1,[0.5,-4],null,[0,0],[0,0],null,null],[4,"l",1,[0.5,-4],[10,-4],[0,0],[0,0],null,null],[5,"l",1,[0.5,-4],[10,-4],[1,-0.4],[0,0],null,null],[6,"l",1,[0.5,-4],[10,-4],[1,-0.4],[0.1,0.016],null,null],[7,"l",1,[0.5,-4],[10,-4],[1,-0.4],[0.1,0.016],[10,-4],null],[8,"l",1,[0.5,-4],[10,-4],[1,-0.4],[0.1,0.016],[10,-4],[100,16]],[2,"l",1,[0.4,-3.9],[10,-4],[1,-0.4],[0.1,0.016],[10,-4],[100,16]],[3,"l",2,[0.4,-3.9],[10,-4],[1,-0.4],[0.1,0.016],[10,-4],[100,16]],[4,"l",2,[0.4,-3.9],[8,-3.9],[1,-0.4],[0.1,0.016],[10,-4],[100,16]],[5,"l",2,[0.4,-3.9],[8,-3.9],[1.7,-0.75],[0.1,0.016],[10,-4],[100,16]],[6,"l",2,[0.4,-3.9],[8,-3.9],[1.7,-0.75],[0.1639,0.0312],[10,-4],[100,16]],[7,"l",2,[0.4,-3.9],[8,-3.9],[1.7,-0.75],[0.1639,0.0312],[8.9474,-3.9474],[100,16]],[8,"l",2,[0.4,-3.9],[8,-3.9],[1.7,-0.75],[0.1639,0.0312],[8.9474,-3.9474],[81.991,15.6048]],[2,"l",2,[0.3012,-3.8001],[8,-3.9],[1.7,-0.75],[0.1639,0.0312],[8.9474,-3.9474],[81.991,15.6048]],[3,"l",3,[0.3012,-3.8001],[8,-3.9],[1.7,-0.75],[0.1639,0.0312],[8.9474,-3.9474],[81.991,15.6048]],[4,"l",3,[0.3012,-3.8001],[6.0237,-3.8001],[1.7,-0.75],[0.1639,0.0312],[8.9474,-3.9474],[81.991,15.6048]],[5,"l",3,[0.3012,-3.8001],[6.0237,-3.8001],[2.1324,-1.055],[0.1639,0.0312],[8.9474,-3.9474],[81.991,15.6048]],[6,"l",3,[0.3012,-3.8001],[6.0237,-3.8001],[2.1324,-1.055],[0.2,0.0456],[8.9474,-3.9474],[81.991,15.6048]],[7,"l",3,[0.3012,-3.8001],[6.0237,-3.8001],[2.1324,-1.055],[0.2,0.0456],[7.8685,-3.893],[81.991,15.6048]],[8,"l",3,[0.3012,-3.8001],[6.0237,-3.8001],[2.1324,-1.055],[0.2,0.0456],[7.8685,-3.893],[66.7406,15.2163]],[2,"l",3,[0.2049,-3.7003],[6.0237,-3.8001],[2.1324,-1.055],[0.2,0.0456],[7.8685,-3.893],[66.7406,15.2163]],[9,"l",3,[0.2049,-3.7003],[6.0237,-3.8001],[2.1324,-1.055],[0.2,0.0456],[7.8685,-3.893],[66.7406,15.2163]],[9,"r",3,[0.2049,-3.7003],[6.0237,-3.8001],[2.1324,-1.055],[0.2,0.0456],[7.8685,-3.893],[66.7406,15.2163]]];
  // The listing is adam() from adam_trace.py, line for line (line 0 = the def line).
  const CODE = [
    "def adam(faders, lr, steps, b1=0.9, b2=0.999, eps=1e-8):",
    "    m, v = np.zeros(2), np.zeros(2)",
    "    for t in range(1, steps + 1):",
    "        g = gradient(faders)",
    "        m = b1 * m + (1 - b1) * g",
    "        v = b2 * v + (1 - b2) * g * g",
    "        m_hat = m / (1 - b1 ** t)",
    "        v_hat = v / (1 - b2 ** t)",
    "        faders = faders - lr * m_hat / (np.sqrt(v_hat) + eps)",
    "    return faders"
  ];

  // torch_optim.out.txt
  const TORCH_A = { sgd: [[0.5,-4],[-0.4,-3.64],[0.32,-3.3124],[-0.256,-3.0143],[0.2048,-2.743],[-0.1638,-2.4961]],
    mom: [[0.5,-4],[-0.4,-3.64],[-0.13,-3.1324],[0.239,-2.5967],[-0.0067,-2.0951],[-0.1175,-1.6558]],
    adam: [[0.5,-4],[0.4,-3.9],[0.3012,-3.8001],[0.2049,-3.7003],[0.1129,-3.6007],[0.0278,-3.5013]] };
  const STATE = [
    { name: "SGD(lr=0.01)", weights: 4801, keys: [], extra: 0 },
    { name: "SGD(lr=0.01, momentum=0.9)", weights: 4801, keys: ["momentum_buffer"], extra: 4801 },
    { name: "Adam(lr=1e-3)", weights: 4801, keys: ["exp_avg", "exp_avg_sq", "step"], extra: 9602 }
  ];
  const BASELINE = 0.7766; // val loss if the network just predicted the training average
  const NET = [
    { name: "SGD(lr=0.01)", val: [0.7109,0.6632,0.6035,0.5326,0.4642,0.3982,0.3554,0.3194,0.2863,0.269,0.2554,0.2446,0.2286,0.2183,0.2093,0.2009,0.1961,0.183,0.1724,0.1671] },
    { name: "SGD(lr=0.01, momentum=0.9)", val: [0.4084,0.2297,0.1549,0.1061,0.0918,0.082,0.0741,0.071,0.0687,0.0644,0.0678,0.0582,0.0602,0.0562,0.0534,0.0595,0.0504,0.0512,0.0484,0.0462] },
    { name: "Adam(lr=1e-3)", val: [0.5491,0.306,0.2275,0.1691,0.1394,0.1008,0.091,0.0826,0.0759,0.0708,0.0716,0.0656,0.0648,0.06,0.0579,0.0627,0.0544,0.052,0.0541,0.051] },
    { name: "Adam(lr=1e-1)", val: [0.3142,0.1509,0.13,0.1131,0.1254,0.1167,0.133,0.0999,0.0792,0.0852,0.0769,0.0443,0.0479,0.0604,0.0752,0.0722,0.0564,0.0518,0.0856,0.0494] },
    { name: "Adam(lr=1e-5)", val: [0.7648,0.7624,0.7599,0.7575,0.7552,0.7528,0.7505,0.7482,0.7459,0.7436,0.7412,0.7389,0.7366,0.7343,0.732,0.7297,0.7274,0.7251,0.7227,0.7204] },
    { name: "AdamW(lr=1e-3, weight_decay=0.01)", val: [0.5492,0.3062,0.2276,0.1692,0.1396,0.1011,0.0913,0.0824,0.0761,0.0709,0.0717,0.066,0.0652,0.06,0.058,0.0634,0.0549,0.0522,0.054,0.0509] }
  ];

  /* ---------- Derived ---------- */
  const f2 = x => (x < -0.005 ? "−" : "") + Math.abs(x).toFixed(2);
  const pt = p => `vocal ${f2(p[0])}, bass ${f2(p[1])}`;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const scale = (a, k) => [a[0] * k, a[1] * k];
  const buf = (path, t) => scale(sub(path[t - 1], path[t]), 1 / LR); // the momentum buffer used on step t
  const same = (a, b) => a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);
  const last = a => a[a.length - 1];
  const fmtLoss = x => x.toFixed(4);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Lesson-local style and picture ---------- */
  function ensureStyle() {
    if (document.getElementById(P)) return;
    const s = document.createElement("style");
    s.id = P;
    s.textContent = `
      .${P}-fig { margin: 18px 0 0; }
      .${P}-fig svg { display: block; width: 100%; max-width: 560px; height: auto; }
      .${P}-fig text { font: 500 11px var(--font); fill: var(--muted); }
      .${P}-ring { fill: none; stroke: var(--line); stroke-width: 1; }
      .${P}-axis { stroke: var(--faint); stroke-width: 1; stroke-dasharray: 2 4; }
      .${P}-goal { fill: none; stroke: var(--ink); stroke-width: 2.5; }
      .${P}-p0 { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; }
      .${P}-p1 { fill: none; stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 5 4; stroke-linejoin: round; }
      .${P}-d0 { fill: var(--ink); }
      .${P}-d1 { fill: var(--muted); }
      .${P}-now { fill: var(--surface); stroke: var(--ink); stroke-width: 3; }
      .${P}-cap { margin: 4px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}-leg { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}-leg svg { vertical-align: middle; margin-right: 6px; }
      .${P}-tab { width: 100%; border-collapse: collapse; margin: 16px 0 0; font: 500 14px/1.4 var(--mono); }
      .${P}-tab caption { text-align: left; font: 600 13px var(--font); color: var(--muted); padding-bottom: 6px; }
      .${P}-tab th { text-align: left; font: 600 12.5px var(--font); color: var(--muted); border-bottom: 1px solid var(--line); padding: 6px 8px 6px 0; }
      .${P}-tab td { border-bottom: 1px solid var(--line); padding: 7px 8px 7px 0; color: var(--ink); overflow-wrap: anywhere; }
      .${P}-tab tr.${P}-hi td { font-weight: 700; }
      .${P}-rule { margin: 14px 0 0; padding: 10px 12px; border-left: 3px solid var(--ink); background: var(--sunk); font: 500 14.5px/1.6 var(--mono); overflow-wrap: anywhere; }
      .${P}-opt { font: 500 14.5px/1.45 var(--mono); text-align: left; }
    `;
    document.head.appendChild(s);
  }
  // The fader plane: bass across, vocal up. paths: [{ pts, k: 0 | 1 }] (k 0 = solid, 1 = dashed); now: one point ringed.
  const BX = [-4.5, 3], VY = [-0.62, 0.62], W = 360, H = 190, L0 = 34, R0 = 10, T0 = 10, B0 = 26;
  const sx = b => L0 + (b - BX[0]) / (BX[1] - BX[0]) * (W - L0 - R0);
  const sy = v => T0 + (VY[1] - v) / (VY[1] - VY[0]) * (H - T0 - B0);
  function plane(kit, paths, { now = null, label = "" } = {}) {
    const rings = [1, 4, 10.5].map(E => `<ellipse class="${P}-ring" cx="${sx(0)}" cy="${sy(0)}" rx="${(sx(Math.sqrt(2 * E)) - sx(0)).toFixed(1)}" ry="${(sy(0) - sy(Math.sqrt(E / 10))).toFixed(1)}"/>`).join("");
    const lines = paths.map(({ pts, k }) => `<polyline class="${P}-p${k}" points="${pts.map(p => `${sx(p[1]).toFixed(1)},${sy(p[0]).toFixed(1)}`).join(" ")}"/>` +
      pts.map(p => `<circle class="${P}-d${k}" cx="${sx(p[1]).toFixed(1)}" cy="${sy(p[0]).toFixed(1)}" r="${k ? 2.2 : 3}"/>`).join("")).join("");
    const nowDot = now ? `<circle class="${P}-now" cx="${sx(now[1]).toFixed(1)}" cy="${sy(now[0]).toFixed(1)}" r="6"/>` : "";
    return `<figure class="${P}-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${kit.esc(label || "The two faders as a point: bass across, vocal up; the right mix is at the centre")}">
      <defs><clipPath id="${P}-clip"><rect x="${L0}" y="${T0}" width="${W - L0 - R0}" height="${H - T0 - B0}"/></clipPath></defs>
      <line class="${P}-axis" x1="${L0}" x2="${W - R0}" y1="${sy(0)}" y2="${sy(0)}"/><line class="${P}-axis" x1="${sx(0)}" x2="${sx(0)}" y1="${T0}" y2="${H - B0}"/>
      <g clip-path="url(#${P}-clip)">${rings}${lines}</g>
      <circle class="${P}-goal" cx="${sx(0)}" cy="${sy(0)}" r="4"/>
      <text x="${sx(0) + 7}" y="${sy(0) - 7}">right mix</text>
      <text x="${W - R0}" y="${H - 6}" text-anchor="end">bass fader →</text>
      <text x="${L0 - 4}" y="${T0 + 9}" text-anchor="end">vocal</text>
      <text x="${L0 - 4}" y="${sy(0) + 4}" text-anchor="end">0</text>
      <text x="${sx(BX[0]) + 2}" y="${H - 6}">${f2(BX[0])}</text>
    </svg><figcaption class="${P}-cap">Each oval joins fader positions with the same mix error. The smaller the oval, the smaller the error.</figcaption></figure>`;
  }
  const legend = items => `<div class="${P}-leg">${items.map(([k, t]) => `<span><svg width="28" height="8" aria-hidden="true"><line class="${P}-p${k}" x1="1" x2="27" y1="4" y2="4"/></svg>${t}</span>`).join("")}</div>`;
  const tab = (head, rows, { caption = "", hi = -1 } = {}) => `<table class="${P}-tab">${caption ? `<caption>${caption}</caption>` : ""}<thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === hi ? ` class="${P}-hi"` : ""}>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const opt = s => `<span class="${P}-opt">${s}</span>`;
  function ask(kit, opts, correct, picked, fb) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  }

  /* A run of step picks: steps[k] = { from, right, wrongs: [[point, why]] }. The option order rotates per step. */
  function stepPicker({ el, done, kit }, { title, lead, rule, task, path, first, steps, finish }) {
    ensureStyle();
    let k = 0, picked = null;
    const order = s => { const all = [[s.right, null], ...s.wrongs]; const r = (k + 1) % all.length; return [...all.slice(r), ...all.slice(0, r)]; };
    const paint = () => {
      const fin = k >= steps.length;
      const s = steps[Math.min(k, steps.length - 1)];
      const os = fin ? [] : order(s);
      const correct = os.findIndex(o => o[1] == null);
      const shown = path.slice(0, first + Math.min(k, steps.length) + 1);
      el.innerHTML = `<h1>${title}</h1>
        <p class="lead">${lead}</p>
        <div class="${P}-rule">${rule}</div>
        ${plane(kit, [{ pts: shown, k: 0 }], { now: last(shown) })}
        ${fin ? "" : `<p class="task">${task(k, s)}</p>`}
        <div class="lpanel">${fin ? kit.feedback(finish, true) : `${kit.options(os.map(o => opt(pt(o[0]))), { picked, correct })}${picked != null && picked !== correct ? kit.feedback(os[picked][1], false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i === correct) { k++; picked = null; paint(); if (k >= steps.length) done(); return; }
        picked = i; paint();
      });
    };
    paint();
  }

  /* 1. The situation, and five plain steps by hand. */
  function bySgd(ctx) {
    const steps = [1, 2, 3, 4, 5].map(t => {
      const from = SGD[t - 1], g = grad(from);
      return { from, g, right: SGD[t], wrongs: [
        [[from[0] - LR * from[0], from[1] - LR * from[1]], `That moves the vocal fader as if it were as gentle as the bass: ${LR} × ${f2(from[0])}. But the vocal gradient is ${SENS_VOCAL} × vocal = ${f2(g[0])}, so its step is ${SENS_VOCAL} times bigger.`],
        [[from[0] + LR * g[0], from[1] + LR * g[1]], `That adds the step instead of taking it away, so the error goes up. Gradient descent moves <b>against</b> the gradient: new = old − learning rate × gradient.`]
      ] };
    });
    const moved = (SGD[5][1] - SGD[0][1]) / -SGD[0][1];
    stepPicker(ctx, {
      title: "Two faders, one auto-balance",
      lead: `In a training loop, the rule that turns gradients into a step for every weight is the <b>optimizer</b>. This lesson compares three of them. Lena mixes a live band. An auto-balance tool moves two faders towards the right mix; think of each fader as one weight in a model. The <b>vocal</b> fader is very sensitive: a tiny nudge changes the mix a lot. The <b>bass</b> fader is gentle. A fader's position is its distance from the right spot. The mix error is 10 × vocal² + 0.5 × bass² (the 10 is what makes the vocal sensitive). The tool does gradient descent, as in the earlier lesson, with one learning rate of ${LR} for both faders.`,
      rule: `gradient = (${SENS_VOCAL} × vocal, bass)<br>new = old − ${LR} × gradient`,
      task: (k, s) => `Step ${k + 1} of 5. The faders are at ${pt(s.from)}, so the gradient is (${f2(s.g[0])}, ${f2(s.g[1])}). Where do they land?`,
      path: SGD, first: 0, steps,
      finish: `Those are the five steps the recorded run took. Look at the vocal fader: ${SGD.slice(0, 6).map(p => f2(p[0])).join(" → ")}. Every step jumps past the right spot to the other side. The bass fader only went from ${f2(SGD[0][1])} to ${f2(SGD[5][1])}, ${Math.round(moved * 100)}% of the way. One fader swings, the other crawls.`
    });
  }

  /* 2. Why not a bigger learning rate? The sensitive fader caps it. */
  function lrCap({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const factor = lr => 1 - lr * SENS_VOCAL;
    const opts = [
      "Both faders get there faster",
      "The vocal fader's swings grow every step, and the mix gets worse and worse",
      "Only the bass fader changes; the vocal fader is unaffected",
      "The tool notices and shrinks the step by itself"
    ];
    const RIGHT = 1;
    const vocal11 = SGD_LR11.map(p => f2(p[0])).join(" → ");
    const fb = [
      [`The bass would go faster, but there is one learning rate for both. The vocal step is ${SENS_VOCAL} × bigger, and it already overshoots at ${LR}.`, false],
      [`Right. The recorded run with 0.11: vocal ${vocal11}. Each step multiplies the vocal position by 1 − 0.11 × ${SENS_VOCAL} = ${factor(0.11).toFixed(1).replace("-", "−")}, so it flips side and grows. After 40 steps the error was ${Math.round(ERR40_LR11).toLocaleString("en")}. At exactly 0.1 the factor is ${factor(0.1).toFixed(0).replace("-", "−")}: the vocal bounces between ${f2(SGD_LR10[0][0])} and ${f2(SGD_LR10[1][0])} for ever (error ${ERR40_LR10.toFixed(2)} after 40 steps). So the <b>most sensitive weight sets the largest safe learning rate</b>, and at that rate the gentle weight crawls. A network has thousands of weights with very different sensitivity, so this happens all the time.`, true],
      ["The gradient for each fader comes from its own position, but the learning rate is shared. A bigger learning rate is a bigger step for both.", false],
      ["Plain gradient descent has no memory and no checks: it applies new = old − learning rate × gradient, whatever happens. Nothing in the rule shrinks the step.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Just take bigger steps?</h1>
        <p class="lead">Lena wants the bass to arrive sooner, so she raises the learning rate from ${LR} to 0.11. Nothing else changes. Same start: ${pt(SGD[0])}.</p>
        <p class="task">What happens over the next steps?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Momentum by hand: steps 2 to 6. */
  function byMomentum(ctx) {
    const steps = [2, 3, 4, 5, 6].map(t => {
      const from = MOM[t - 1], g = grad(from), prev = buf(MOM, t - 1), b = [MU * prev[0] + g[0], MU * prev[1] + g[1]];
      return { from, g, prev, right: MOM[t], wrongs: [
        [[from[0] - LR * g[0], from[1] - LR * g[1]], `That is a plain step: it uses only today's gradient and forgets the buffer. With momentum the step uses buffer = ${MU} × old buffer + gradient = (${f2(b[0])}, ${f2(b[1])}).`],
        [[from[0] - LR * (prev[0] + g[0]), from[1] - LR * (prev[1] + g[1])], `That keeps all of the old buffer. The rule keeps only half of it (× ${MU}) before adding the new gradient, so old pushes fade out.`]
      ] };
    });
    stepPicker(ctx, {
      title: "Momentum: remember the last push",
      lead: `A second tool adds <b>momentum</b>. It keeps a running push for each fader, called the <b>buffer</b>. It steps by the buffer instead of by today's gradient. On step 1 the buffer is just the gradient, so step 1 is the same as your plain step 1: ${pt(MOM[1])}. You do the next five.`,
      rule: `buffer = ${MU} × buffer + gradient<br>new = old − ${LR} × buffer`,
      task: (k, s) => `Step ${k + 2}. The faders are at ${pt(s.from)}. Gradient (${f2(s.g[0])}, ${f2(s.g[1])}), buffer so far (${f2(s.prev[0])}, ${f2(s.prev[1])}). Where do they land?`,
      path: MOM, first: 1, steps,
      finish: `Those match the recorded run. After 6 steps with momentum the bass is at ${f2(MOM[6][1])}; with plain steps it was at ${f2(SGD[6][1])}. The vocal fader still wobbles, but it is not stuck swinging between the same two sides.`
    });
  }

  /* 4. Predict the race in the recorded run. */
  function race({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const crossAt = MOM_HIGH.findIndex(p => p[1] > 0), maxBass = Math.max(...MOM_HIGH.map(p => p[1]));
    const tableHtml = () => tab(["tool", "steps until error < " + GOAL], [
      [`plain, lr ${LR}`, String(REACH.sgd)], [`momentum ${MU}`, String(REACH.mom)], [`momentum ${MU_HIGH}`, String(REACH.momHigh)]], { hi: 1 });
    const pic = () => `${plane(kit, [{ pts: SGD, k: 1 }, { pts: MOM, k: 0 }], { label: "Forty steps of plain gradient descent and of momentum 0.5 on the fader plane" })}${legend([[0, `momentum ${MU}`], [1, "plain steps"]])}`;
    const opts = [`Plain steps (lr ${LR})`, `Momentum ${MU}`, `Momentum ${MU_HIGH}: it remembers more, so it must be fastest`];
    const RIGHT = 1;
    const fb = [
      [`Plain steps needed ${REACH.sgd} steps. The bass fader crawls at the safe learning rate, and the vocal swings are only damped slowly.${tableHtml()}`, false],
      [`Right: ${REACH.mom} steps against ${REACH.sgd} for plain steps, about ${(REACH.sgd / REACH.mom).toFixed(1)} times fewer. Momentum ${MU_HIGH} was the slowest of the three (${REACH.momHigh}): it kept so much of the old push that the bass shot past the right spot at step ${crossAt} and reached ${f2(maxBass)} before coming back.${tableHtml()}${pic()}`, true],
      [`More memory is not always better. With ${MU_HIGH}, so much of the old push survives that the bass shot past the right spot at step ${crossAt} and reached ${f2(maxBass)} before swinging back. It needed ${REACH.momHigh} steps, the slowest of the three.${tableHtml()}`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Which tool gets there first?</h1>
        <p class="lead">Three tools ran from the same start for up to 300 steps, all with learning rate ${LR}: plain steps, momentum ${MU} (the rule you just used: it keeps ${MU * 100}% of the old buffer each step) and momentum ${MU_HIGH}, which keeps ${MU_HIGH * 100}%. "There" means the mix error drops below ${GOAL}; it starts at ${error(SGD[0]).toFixed(1)}.</p>
        <p class="task">Which one gets there in the fewest steps?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Spot the idea: why momentum helped. */
  function spotMomentum({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const rows = [1, 2, 3, 4, 5].map(t => { const g = grad(MOM[t - 1]), b = buf(MOM, t); return [String(t), f2(g[0]), f2(b[0]), f2(g[1]), f2(b[1])]; });
    const opts = [
      "Momentum raises the learning rate for every fader",
      "Pushes that flip sign cancel inside the buffer; pushes that keep the same sign add up",
      "Momentum skips computing the gradient on some steps",
      "Momentum moves one fader at a time"
    ];
    const RIGHT = 1;
    const fb = [
      [`Then the vocal steps would grow too, and the vocal is already at its limit. Look at the vocal columns: the buffer is often smaller than the gradient (step 2: gradient ${rows[1][1]}, buffer ${rows[1][2]}).`, false],
      [`Right. The vocal gradient flips sign almost every step, so the old push and the new one partly cancel and the vocal moves less. The bass gradient always points the same way, so the buffer grows (${rows[0][4]} → ${rows[4][4]}) and the bass moves more. That is <b>momentum</b>: a running sum of past gradients, with old ones fading by the factor ${MU} each step. It smooths the direction that zig-zags and speeds up the direction that is steady, with the same learning rate.`, true],
      ["Every step computes a fresh gradient (the gradient column). Momentum adds memory; it does not save work.", false],
      ["Both faders move on every step; both columns change in every row. The difference is how big each move is.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did momentum help?</h1>
        <p class="lead">The first five steps of the momentum run, per fader: the gradient at that step and the buffer it actually stepped by.</p>
        ${tab(["step", "vocal grad", "vocal buffer", "bass grad", "bass buffer"], rows)}
        <p class="task">What is going on in this table?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Adam: predict the first step. */
  function adamFirst({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const g = grad(ADAM[0]);
    const mv = t => sub(ADAM[t - 1], ADAM[t]).map(Math.abs);
    const opts = [
      opt(`vocal moves ${(ADAM_LR * Math.abs(g[0])).toFixed(1)}, bass moves ${(ADAM_LR * Math.abs(g[1])).toFixed(1)}`),
      opt(`both move ${ADAM_LR.toFixed(1)}`),
      opt(`vocal moves ${(ADAM_LR / SENS_VOCAL).toFixed(3)}, bass moves ${ADAM_LR.toFixed(1)}`)
    ];
    const RIGHT = 1;
    const m1 = mv(1), m2 = mv(2);
    const fb = [
      ["That is a plain step: learning rate × gradient. Adam divides by the size of the fader's own gradient, so a big gradient does not mean a big step.", false],
      [`Right. The recorded run moved the faders from ${pt(ADAM[0])} to ${pt(ADAM[1])}: ${m1[0].toFixed(2)} and ${m1[1].toFixed(2)}. On the first step the average gradient divided by the size of the gradient is just +1 or −1, so each fader moves by the learning rate. Step 2 moved them ${m2[0].toFixed(4)} and ${m2[1].toFixed(4)}: still about the same size. Each weight gets <b>its own step size</b>. In the full run, Adam with lr ${ADAM_LR} needed ${REACH.adam} steps and with lr ${ADAM_LR_HIGH} needed ${REACH.adamHigh}; momentum ${MU} needed ${REACH.mom}. On two faders, a tuned momentum wins. Adam's gift is that you did not have to tune anything per fader, which matters when there are millions of them.`, true],
      ["That shrinks the sensitive fader by hand. Adam does not know the sensitivity in advance; it measures each fader's gradients as it goes and divides by their size.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Adam: a step size for each fader</h1>
        <p class="lead">A third tool, <b>Adam</b>, keeps two running averages per fader: the average gradient (like momentum) and the average <i>squared</i> gradient. The square root of the second is how big this fader's pushes usually are, sign ignored. Adam steps by the first divided by that size. Below, <code>lr</code> is the learning rate.</p>
        <div class="${P}-rule">step = lr × average gradient / √(average squared gradient)</div>
        <p class="lead">Start ${pt(ADAM[0])}, learning rate ${ADAM_LR}. The first gradient is (${f2(g[0])}, ${f2(g[1])}).</p>
        <p class="task">How far does each fader move on the first step?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Adam from scratch: stepped replay of the traced run. */
  const KEEP = [1, 2, 3, 4, 5, 6, 7, 8, 15, 22, 24]; // frame k shows the line rows[k-1] ran, with the variables of rows[k]
  const FR = KEEP.map(k => ({ ran: TRACE[k - 1][0], end: TRACE[k][1] === "r", t: TRACE[k][2], f: TRACE[k][3], g: TRACE[k][4], m: TRACE[k][5], v: TRACE[k][6], mh: TRACE[k][7], vh: TRACE[k][8] }));
  const pair = a => a ? `[${a.map(x => String(x)).join(", ")}]` : "–";
  function sayFrame(kit, fr, i) {
    if (fr.end) return `<code>adam</code> returns ${pair(fr.f)} after 3 steps${same([fr.f], [ADAM[3]]) ? ", the same third position as the Adam run you predicted" : ""}.`;
    switch (fr.ran) {
      case 1: return "Two running averages per fader, both starting at zero: <code>m</code> for the gradient, <code>v</code> for the squared gradient.";
      case 2: return `Step <code>t</code> = ${fr.t}.`;
      case 3: return `The gradient at ${pair(fr.f)} is ${pair(fr.g)}: the vocal push is ${(Math.abs(fr.g[0]) / Math.abs(fr.g[1])).toFixed(1)} times the bass push.`;
      case 4: return `<code>m</code> keeps 90% of the old average and adds 10% of the new gradient: ${pair(fr.m)}.`;
      case 5: return `<code>v</code> does the same with the squared gradient, keeping 99.9%: ${pair(fr.v)}.`;
      case 6: return `Both averages started at zero, so early on they are too small. Dividing by 1 − 0.9<sup>t</sup> corrects that: <code>m_hat</code> = ${pair(fr.mh)}.`;
      case 7: return `The same correction for <code>v</code>: <code>v_hat</code> = ${pair(fr.vh)}. Its square root is the usual size of each fader's gradient.`;
      case 8: return `Each fader moves lr × m_hat / √v_hat.${i === 7 ? ` On this first step m_hat / √v_hat = ${pair(fr.mh.map((x, j) => +(x / Math.sqrt(fr.vh[j])).toFixed(2)))}, so each fader moves exactly lr = ${ADAM_LR}, whatever the size of its gradient.` : ""} New faders: ${pair(fr.f)}.${i === FR.length - 2 ? "" : " Next, the loop goes round again."}`;
      default: return "";
    }
  }
  function adamCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const fr = FR[i];
      el.innerHTML = `<h1>Adam in ten lines of NumPy</h1>
        <p class="lead">This is the whole optimizer, run on the two faders with lr ${ADAM_LR} for 3 steps. <code>gradient(faders)</code> returns (${SENS_VOCAL} × vocal, bass). <code>b1</code> and <code>b2</code> are how much of the old averages to keep. <code>eps</code> only stops a division by zero. The first step is shown line by line, then the end of steps 2 and 3.</p>
        <p class="task">Step through to the end. Watch <code>m_hat / √v_hat</code> on the first step.</p>
        ${kit.code(CODE, fr.ran)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>t <b>${fr.t == null ? "–" : fr.t}</b></span><span>faders <b>${pair(fr.f)}</b></span><span>g <b>${pair(fr.g)}</b></span><span>m <b>${pair(fr.m)}</b></span><span>v <b>${pair(fr.v)}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, fr, i))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 8. The real library: torch.optim, and a small network trained six ways. */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const fin = NET.map(r => last(r.val));
    const SLOW = NET.findIndex(r => r.name === "Adam(lr=1e-5)");
    const JUMPY = NET.findIndex(r => r.name === "Adam(lr=1e-1)");
    const late = NET[JUMPY].val.slice(10);
    const matches = same(TORCH_A.sgd, SGD.slice(0, 6)) && same(TORCH_A.mom, MOM.slice(0, 6)) && same(TORCH_A.adam, ADAM);
    const listing = [
      "model = build()  # 8 -> 64 -> 64 -> 1",
      "optimizer = torch.optim.Adam(",
      "    model.parameters(), lr=1e-3)",
      "for epoch in range(20):",
      "    for xb, yb in loader:",
      "        optimizer.zero_grad()",
      "        loss_fn(model(xb), yb).backward()",
      "        optimizer.step()"
    ];
    const opts = NET.map(r => opt(kit.esc(r.name)));
    const results = () => tab(["optimizer", "val loss after 20 epochs"], NET.map((r, i) => [kit.esc(r.name), fmtLoss(fin[i])]), { caption: `Doing nothing (always predicting the average) scores ${BASELINE}.`, hi: SLOW });
    const fbFor = i => {
      if (i === SLOW) return [`Right. Adam with lr 1e-5 went from ${fmtLoss(NET[SLOW].val[0])} to only ${fmtLoss(fin[SLOW])}, barely better than doing nothing. Adam fixes the step size <i>between</i> weights, but the overall size is still lr: too small and nothing moves.${results()}<p class="lead">Two more things in the table. Adam with lr 1e-1 ends low, but its validation loss jumped between ${fmtLoss(Math.min(...late))} and ${fmtLoss(Math.max(...late))} over the last ten epochs: too big a step. And on this small problem, SGD with momentum ${MU_HIGH} ended slightly better than Adam at the default lr; a tuned SGD with momentum can match or beat Adam.</p>`, true];
      if (i === JUMPY) return [`lr 1e-1 is large, and large steps make the loss jump about, but they do move the weights a lot. It ended at ${fmtLoss(fin[JUMPY])}. Look for the setting whose steps are too small to move anything in 20 epochs.`, false];
      if (i === 0) return [`Plain SGD at lr 0.01 is slow here (it ended at ${fmtLoss(fin[0])}, far behind the others), but it still went down from ${fmtLoss(NET[0].val[0])}. One setting moved much less than that.`, false];
      return [`${kit.esc(NET[i].name)} ended at ${fmtLoss(fin[i])}, close to the best. One setting moved much less than that.`, false];
    };
    const paint = () => {
      el.innerHTML = `<h1>The same thing with torch.optim</h1>
        <p class="lead">${matches ? "First, the faders again: PyTorch's <code>torch.optim.SGD</code> (with and without <code>momentum</code>) and <code>torch.optim.Adam</code> took the same first five steps as the runs you saw." : ""} In a real loop you build the optimizer once and call <code>optimizer.step()</code> after <code>backward()</code>:</p>
        ${kit.code(listing, 1)}
        <p class="lead">The settings that matter: <code>lr</code> (all of them; PyTorch's default is 1e-3), <code>momentum</code> for SGD (default 0, so off), <code>betas</code> for Adam (how much of the two averages to keep, default (0.9, 0.999)), and <code>weight_decay</code>, which pulls weights towards zero. <code>AdamW</code> applies that pull straight to the weights instead of mixing it into the averages; its default is 0.01.</p>
        <p class="lead">A small network (${STATE[0].weights.toLocaleString("en")} weights) was trained for 20 epochs on made-up data with six settings, same starting weights each time.</p>
        <p class="task">"Doing nothing" means always predicting the average of the training answers. Which setting ends with a validation loss closest to that?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: SLOW })}${ans == null ? "" : kit.feedback(...fbFor(ans))}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === SLOW) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const ad = STATE[2], mo = STATE[1];
    const opts = ["GPU memory", "The number of training steps", "The model's accuracy"];
    const RIGHT = 0;
    const fb = [
      [`Right. PyTorch's Adam keeps <code>${ad.keys.filter(k => k !== "step").join("</code> and <code>")}</code> for every weight: in the small network that was ${ad.extra.toLocaleString("en")} extra numbers for ${ad.weights.toLocaleString("en")} weights, ${ad.extra / ad.weights} per weight. SGD with momentum keeps one (<code>${mo.keys[0]}</code>: ${mo.extra.toLocaleString("en")}); plain SGD keeps none. A model that only just fits with plain SGD will not fit with Adam unless something else gives.`, true],
      ["Adam usually needs fewer steps, not more, and it would not stop the run. Something else runs out first, before the first step finishes.", false],
      ["Accuracy is decided over many steps. The question is what breaks first, on the very first step.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for which</h1>
        <p class="lead"><b>For:</b> every network trained with gradients needs an optimizer. The choice changes how many steps training takes and how much tuning you do.</p>
        <p class="lead"><b>Reach for</b> AdamW as the first try when weights differ a lot in sensitivity and you have little time to tune. Reach for SGD with momentum when a known recipe for your task uses it. The AdamW paper notes that on image classification, SGD with momentum usually generalised better than plain Adam: it did better on images it had not trained on.</p>
        <p class="lead"><b>Not</b> the fix when the problem is elsewhere: bad data, a bug in the loop, or a model that memorises its training data.</p>
        <p class="lead"><b>Costs:</b> extra memory per weight, and new settings to tune.</p>
        <p class="task">A team fine-tunes a model that just fits on one GPU with plain SGD. They switch to Adam. What runs out first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const CASES = [
    ["A recommendation model keeps a short list of weights for each product. Rare products get a gradient only now and then. With plain SGD at one learning rate, their weights barely move.", true,
      "Yes. Some weights get small or rare gradients and others get big, frequent ones, which is the two-fader problem with many faders. Adam's per-weight step size is made for it; its paper names sparse gradients as a case it handles.",
      "This is the uneven-sensitivity problem: the frequent products set the safe learning rate, and the rare ones crawl. An optimizer with a step size per weight, such as Adam, is the change to try."],
    ["Training loss keeps falling every epoch, but validation loss has been rising since epoch 5.", false,
      "No. The optimizer is doing its job: it lowers the training loss. The model is learning the training examples by heart. That needs more data, regularisation or stopping earlier. (<code>weight_decay</code> sits in the optimizer's settings, but it is a form of regularisation, not a faster way down.) A different optimizer or learning rate only gets there sooner.",
      "A better optimizer lowers the training loss faster, and the training loss is already falling. The problem is the gap between training and validation, which the optimizer does not see. More data, regularisation (such as <code>weight_decay</code>) or early stopping is the fix."],
    ["With Adam at lr 0.1, the training loss swings between low and high from one batch to the next and never settles.", true,
      "Yes, the setting is the fix: the steps are too big, as in the lr 1e-1 run. Lower the learning rate (try 10 times smaller) before changing anything else.",
      "The swings are the sign of steps that are too large, like the vocal fader at 0.11. The learning rate is an optimizer setting, and lowering it is the first thing to try."],
    ["A feature column was filled with the wrong units for half the rows, and the model's predictions are off for exactly those rows.", false,
      "No. The optimizer finds the best weights for the data it is given. If half the data is wrong, a better optimizer fits the wrong data just as well. Fix the data.",
      "Every optimizer minimises the loss on the data you give it. Wrong units in the data are a data problem; Adam would fit the wrong values as faithfully as SGD."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Optimizer problem or not?</h1>
        <p class="lead">Four training problems from other teams.</p>
        <p class="task">For each one: is a different optimizer, or a different learning rate, the fix to try?</p>
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
    el.innerHTML = `<h1>You can pick and explain an optimizer</h1>
      <p class="lead">You saw one learning rate fail two faders of different sensitivity, used momentum to cancel the zig-zag and add up the steady push, and watched Adam give each weight its own step size, in NumPy and in <code>torch.optim</code>. You also saw what it costs: extra memory per weight, and a learning rate you still have to choose. And you saw when it is not the fix: learning the training data by heart, and bad data, need other cures.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the momentum and Adam update rules in NumPy and run them on the two faders.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. An optimizer can only move the weights from where they start; next you look at that starting point.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Optimizers: SGD, momentum and Adam",
    checked: "2026-11-14",
    sources: [
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.SGD.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.Adam.html",
      "https://docs.pytorch.org/docs/2.15/generated/torch.optim.AdamW.html",
      "https://arxiv.org/abs/1412.6980",
      "https://arxiv.org/abs/1711.05101"
    ],
    interview: [
      {
        q: "Your training loss jumps around and sometimes goes to NaN with Adam at lr 1e-2. A teammate wants to switch to SGD. What do you do?",
        good: [
          "Lower the learning rate first, about ten times, because jumping loss is the sign of steps that are too big",
          "Explain that switching optimizer does not remove the learning rate; SGD has one too, and set too high it diverges just the same",
          "Check the rest of the loop: zero_grad before backward, the loss on the right outputs, inputs on a sensible scale",
          "Change one thing at a time and compare validation curves, not single numbers"
        ],
        weak: "Switch to another optimizer straight away. It changes two things at once and hides that the step size was the problem."
      },
      {
        q: "Your model trains well with Adam, but the bigger version runs out of GPU memory. A teammate suggests SGD with momentum. What changes in each training step, and what do you trade?",
        good: [
          "Plain SGD steps by learning rate × gradient, with one rate for every weight, so the most sensitive weight caps the rate",
          "Momentum steps by a running sum of past gradients: zig-zag pushes cancel, steady pushes add up",
          "Adam keeps an average gradient and an average squared gradient per weight and divides by the second's square root, so each weight gets its own step size",
          "Adam needs two extra numbers per weight in memory; momentum one, so the switch frees one number per weight",
          "Expect to choose the learning rate again: a good Adam learning rate says nothing about a good SGD one"
        ],
        weak: "Say Adam is always better because it is adaptive. It misses the memory cost, the learning rate it still needs, and the cases where tuned momentum does as well."
      }
    ],
    screens: [bySgd, lrCap, byMomentum, race, spotMomentum, adamFirst, adamCode, library, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(5).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(5).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
