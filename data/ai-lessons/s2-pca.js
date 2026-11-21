/* Lesson: dimensionality reduction with PCA. Story: a factory has twenty sensor readings per machine and wants to
   see at a glance which machines behave oddly. Ideas: (1) when columns move together, one direction (the one
   along which the points spread most) carries most of their spread, and projecting each point onto it gives one
   number in place of several: the first principal component; (2) with scikit-learn on all twenty sensors, read
   the explained variance to pick how many components to keep, plot the machines on the first two, and scale the
   columns first.
   No model calls were recorded for this lesson. Data, all real runs on this Mac (seed 0), in
   docs/ai-path/runs/s2-pca/:
   - factory.py -> factory.csv: simulated readings, 60 machines x 20 sensors (the lesson says they are simulated);
   - two_sensors.py + two_sensors.out.txt: motor current and motor temperature of M-01..M-12 as rounded
     standard scores, and the spread kept by a line at every 15 degrees;
   - trace_scratch.py + trace_scratch.out.txt: the 9-line NumPy PCA shown on the code screen, traced line by line;
   - sklearn_pca.py + sklearn_pca.out.txt: PCA with StandardScaler (explained variance, n_components=0.9, the
     2-D scores, loadings) and the same PCA without the scaler (the broken run).
   Lesson-local picture: a small SVG scatter with a projection line (scatter(), .lx-s2-pca-*), see ensureStyle(). */
(() => {
  const ID = "s2-pca";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const r2 = v => (Math.round(v * 100) / 100).toFixed(2);
  const pct = v => `${Math.round(v * 100)}%`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs ---------- */
  // two_sensors.out.txt: machines and [current, temperature] standard scores, rounded to 2 decimals
  const PAIR_NAMES = ["M-01", "M-02", "M-03", "M-04", "M-05", "M-06", "M-07", "M-08", "M-09", "M-10", "M-11", "M-12"];
  const PAIR = [[0.58, 0.36], [0.27, -0.52], [0.98, 0.97], [-0.32, -0.25], [-0.65, -0.09], [0.28, 0.26], [1.26, 1.23], [1.46, 1.81], [-1.04, -0.92], [-1.97, -2.09], [-1.13, -0.72], [0.27, -0.05]];
  const ANGLES = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165]; // the angles two_sensors.py printed
  const BEST = 45; // the angle with the largest spread in two_sensors.out.txt (recomputed below and checked)

  // trace_scratch.py: pca_scores, line for line (line 0 = def)
  const CODE = [
    "def pca_scores(readings, k):",
    "    centered = readings - readings.mean(axis=0)",
    "    cov = centered.T @ centered / (len(readings) - 1)",
    "    eigenvalues, directions = np.linalg.eigh(cov)",
    "    order = np.argsort(eigenvalues)[::-1]",
    "    eigenvalues = eigenvalues[order]",
    "    directions = directions[:, order]",
    "    share = eigenvalues / eigenvalues.sum()",
    "    scores = centered @ directions[:, :k]",
    "    return scores, share"
  ];
  // trace_scratch.out.txt, k = 1: the locals right after each line ran (the next trace row), last = the return
  const TRACE = [
    { ln: 1, centered: { shape: [12, 2], first: [0.581, 0.361] } },
    { ln: 2, cov: [[1.091, 1.027], [1.027, 1.091]] },
    { ln: 3, eigenvalues: [0.064, 2.118], directions: [[0.707, -0.707], [-0.707, -0.707]] },
    { ln: 4, order: [1, 0] },
    { ln: 5, eigenvalues: [2.118, 0.064] },
    { ln: 6, directions: [[-0.707, 0.707], [-0.707, -0.707]] },
    { ln: 7, share: [0.971, 0.029] },
    { ln: 8, scores: { shape: [12, 1], first: [-0.666] } },
    { ln: 9, ret: true }
  ];

  // sklearn_pca.py and sklearn_pca.out.txt (scaled run)
  const SK_CODE = [
    "from sklearn.decomposition import PCA",
    "from sklearn.preprocessing import StandardScaler",
    "",
    "scaled = StandardScaler().fit_transform(readings)",
    "pca = PCA()",
    "pca.fit(scaled)",
    "print(pca.explained_variance_ratio_.round(3))",
    "pca90 = PCA(n_components=0.9).fit(scaled)",
    "print(pca90.n_components_)"
  ];
  const SK_OUT1 = "[0.401 0.296 0.069 0.053 0.045 0.043 0.033 0.021 0.007 0.006 0.005 0.004\n 0.004 0.003 0.003 0.002 0.002 0.002 0.001 0.001]";
  const SK_OUT2 = "6";
  const RATIO = SK_OUT1.replace(/[\[\]]/g, " ").trim().split(/\s+/).map(Number);
  const N90 = Number(SK_OUT2);
  const N_MACHINES = 60, N_SENSORS = 20; // factory.out.txt: "machines 60 sensors 20"
  // PCA(n_components=2) scores, sklearn_pca.out.txt "scores"
  const SCORES = { "M-01": [0.46, -2.04], "M-02": [0.74, -2.3], "M-03": [0.97, 4.28], "M-04": [-0.19, -1.56], "M-05": [-1.34, -0.26], "M-06": [0.5, -0.47], "M-07": [2.21, 3.69], "M-08": [2.23, 3.69], "M-09": [-1.88, 0.36], "M-10": [-2.71, -6.13], "M-11": [-1.84, -0.44], "M-12": [0.08, 0.67], "M-13": [-5.91, -0.26], "M-14": [-0.31, -1.73], "M-15": [-3.14, 2.02], "M-16": [-1.11, -3.66], "M-17": [-2.79, 8.35], "M-18": [-0.69, 1.63], "M-19": [0.53, -0.32], "M-20": [2.72, 5.4], "M-21": [-0.22, -0.03], "M-22": [3.8, -1.22], "M-23": [-2.11, -1.94], "M-24": [1.05, -2.38], "M-25": [3.35, -2.26], "M-26": [0.07, 0.28], "M-27": [-2.54, 0.24], "M-28": [-2.65, 1.3], "M-29": [-1.03, -2.15], "M-30": [0.44, 3.09], "M-31": [-1.67, -1.59], "M-32": [-0.69, 2.71], "M-33": [-0.4, -1.16], "M-34": [1.29, -1.49], "M-35": [0.93, 0.96], "M-36": [0.18, 2.69], "M-37": [-1.15, -0.02], "M-38": [0.32, -1.45], "M-39": [2.55, -2.15], "M-40": [4.66, -2.39], "M-41": [-3.4, 0.22], "M-42": [-11.71, -1.59], "M-43": [3.21, -0.14], "M-44": [2.85, -1.96], "M-45": [-0.0, 1.97], "M-46": [0.0, -3.58], "M-47": [4.19, -0.76], "M-48": [5.37, 2.66], "M-49": [6.05, -3.82], "M-50": [3.42, 1.64], "M-51": [1.31, -1.15], "M-52": [-3.04, -0.76], "M-53": [0.56, -0.39], "M-54": [1.67, 0.46], "M-55": [-3.31, -0.37], "M-56": [1.4, -1.89], "M-57": [0.32, 2.95], "M-58": [2.06, 1.56], "M-59": [-3.64, 0.7], "M-60": [-2.0, 2.31] };
  // components_ rows ("PC1 loadings", "PC2 loadings"), sklearn_pca.out.txt
  const LOAD = [
    { motor_current_A: 0.34, power_kW: 0.34, motor_temp_C: 0.32, coolant_temp_C: 0.33, oil_temp_C: 0.29, flow_l_min: 0.34, spindle_load_pct: 0.34, cycle_time_s: -0.34, vibration_x_mm_s: -0.1, vibration_y_mm_s: -0.12, vibration_z_mm_s: -0.11, bearing_temp_C: -0.01, noise_dB: -0.12, tool_wear_pct: -0.11, hydraulic_bar: 0.02, air_pressure_Pa: -0.06, humidity_pct: -0.04, supply_voltage_V: 0.07, lubricant_level_pct: 0.07, cabinet_temp_C: 0.22 },
    { motor_current_A: 0.06, power_kW: 0.04, motor_temp_C: 0.12, coolant_temp_C: 0.05, oil_temp_C: 0.2, flow_l_min: 0.03, spindle_load_pct: 0.05, cycle_time_s: -0.06, vibration_x_mm_s: 0.38, vibration_y_mm_s: 0.37, vibration_z_mm_s: 0.37, bearing_temp_C: 0.4, noise_dB: 0.38, tool_wear_pct: 0.38, hydraulic_bar: 0.12, air_pressure_Pa: 0.09, humidity_pct: -0.07, supply_voltage_V: -0.14, lubricant_level_pct: 0.11, cabinet_temp_C: 0.1 }
  ];
  const M17_TOP = { tool_wear_pct: 3.9, vibration_y_mm_s: 3.6, noise_dB: 3.5, bearing_temp_C: 3.5 }; // "M-17 largest standard scores"
  const M42_TOP = { flow_l_min: -4.2, spindle_load_pct: -4.0, power_kW: -4.0, motor_current_A: -4.0 }; // "M-42 largest standard scores"
  // The broken run: PCA(n_components=3).fit(readings) without the scaler, sklearn_pca.out.txt
  const RAW_RATIO_LINE = "unscaled ratio [0.996 0.002 0.001]";
  const RAW_PC1_LINE = "unscaled PC1 biggest loadings {'air_pressure_Pa': 1.0, 'tool_wear_pct': 0.008, 'flow_l_min': -0.004}";
  const RAW_STD = { air_pressure_Pa: 451.1, tool_wear_pct: 18.2, flow_l_min: 11.3, motor_current_A: 6.4, vibration_x_mm_s: 0.7 }; // "raw standard deviation of each sensor" (five of twenty)

  /* ---------- Derived from the data ---------- */
  const MEAN = [0, 1].map(j => sum(PAIR.map(p => p[j])) / PAIR.length);
  const CENT = PAIR.map(p => [p[0] - MEAN[0], p[1] - MEAN[1]]);
  const dirOf = deg => [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
  const proj = (c, deg) => { const d = dirOf(deg); return c[0] * d[0] + c[1] * d[1]; };
  const varOf = a => { const m = sum(a) / a.length; return sum(a.map(v => (v - m) ** 2)) / a.length; };
  const TOTAL = varOf(CENT.map(c => c[0])) + varOf(CENT.map(c => c[1]));
  const spreadAt = deg => varOf(CENT.map(c => proj(c, deg)));
  const shareAt = deg => spreadAt(deg) / TOTAL;
  const BEST_FOUND = ANGLES.reduce((b, a) => spreadAt(a) > spreadAt(b) ? a : b, ANGLES[0]);
  if (BEST_FOUND !== BEST) throw new Error("s2-pca: best angle mismatch");
  const SHARE_CURRENT = varOf(CENT.map(c => c[0])) / TOTAL;
  const CUM = RATIO.map((_, i) => sum(RATIO.slice(0, i + 1)));
  const NAMES_OF = o => Object.keys(o);
  const topLoad = (row, n) => NAMES_OF(row).sort((a, b) => Math.abs(row[b]) - Math.abs(row[a])).slice(0, n);

  /* ---------- Lesson-local style and picture ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-fig { margin: 16px 0 0; }
      .lx-${ID}-fig svg { display: block; width: 100%; max-width: 360px; height: auto; margin: 0 auto; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); text-align: center; }
      .lx-${ID}-axis { stroke: var(--line); stroke-width: 1; }
      .lx-${ID}-lbl { fill: var(--muted); font: 500 11px var(--mono); }
      .lx-${ID}-pt { fill: var(--ink); }
      .lx-${ID}-pt.faint { fill: var(--faint); }
      .lx-${ID}-ring { fill: none; stroke: var(--ink); stroke-width: 2.5; }
      .lx-${ID}-line { stroke: var(--ink); stroke-width: 2; }
      .lx-${ID}-drop { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; }
      .lx-${ID}-shadow { fill: var(--surface); stroke: var(--ink); stroke-width: 1.5; }
      .lx-${ID}-mark { fill: var(--bg); stroke: var(--ink); stroke-width: 1.5; }
      .lx-${ID}-mtxt { fill: var(--ink); font: 700 12px var(--mono); }
      .lx-${ID}-name { fill: var(--ink); font: 600 11px var(--mono); }
      .lx-${ID}-angles { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin: 14px 0 0; }
      .lx-${ID}-angles button { min-height: 44px; font: 600 14px var(--mono); }
      .lx-${ID}-angles button[aria-pressed="true"] { outline: 2.5px solid var(--ink); outline-offset: -2.5px; }
      .lx-${ID}-pre { margin: 10px 0 0; padding: 10px 12px; background: var(--sunk); border: 1px solid var(--line); font: 500 13.5px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-pre b { font-weight: 700; }
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin: 12px 0 0; font-size: 14.5px; }
      .lx-${ID}-tbl th, .lx-${ID}-tbl td { text-align: left; padding: 6px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .lx-${ID}-tbl th { font: 600 12.5px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .lx-${ID}-tbl code { font: 500 13px var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-lock { margin: 12px 0 0; min-height: 44px; }
      .lx-${ID}-wrap { overflow-x: visible; }
      .lx-${ID}-wrap div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(16px + var(--ind)); text-indent: -4ch; }
      @media (max-width: 700px) { .lx-${ID}-wrap div { padding-left: calc(12px + var(--ind)); } }
      @media (max-width: 520px) { .lx-${ID}-angles { grid-template-columns: repeat(4, 1fr); } }
    `;
    document.head.appendChild(s);
  }

  /* An SVG scatter. pts: [{ x, y, name?, ring?, faint? }] in data units; o.R = half the range shown;
     o.line = angle in degrees through the origin; o.drops = draw each point's perpendicular drop and shadow;
     o.marks = [{ t, label }] positions along the line; o.axes = [x label, y label]. */
  function scatter(kit, pts, o = {}) {
    const S = 300, P = 22, R = o.R || 2.6, Rx = o.Rx || R, Ry = o.Ry || R;
    const X = x => P + (x + Rx) / (2 * Rx) * (S - 2 * P), Y = y => S - P - (y + Ry) / (2 * Ry) * (S - 2 * P);
    let g = `<line class="lx-${ID}-axis" x1="${X(-Rx)}" y1="${Y(0)}" x2="${X(Rx)}" y2="${Y(0)}"/><line class="lx-${ID}-axis" x1="${X(0)}" y1="${Y(-Ry)}" x2="${X(0)}" y2="${Y(Ry)}"/>`;
    if (o.axes) g += `<text class="lx-${ID}-lbl" x="${S - P}" y="${Y(0) - 6}" text-anchor="end">${kit.esc(o.axes[0])}</text><text class="lx-${ID}-lbl" x="${X(0) + 6}" y="${P - 6}">${kit.esc(o.axes[1])}</text>`;
    if (o.line != null) {
      const d = dirOf(o.line), L = Math.max(Rx, Ry) * 1.6;
      g += `<line class="lx-${ID}-line" x1="${X(-d[0] * L)}" y1="${Y(-d[1] * L)}" x2="${X(d[0] * L)}" y2="${Y(d[1] * L)}"/>`;
      if (o.drops) pts.forEach(p => { const t = p.x * d[0] + p.y * d[1]; g += `<line class="lx-${ID}-drop" x1="${X(p.x)}" y1="${Y(p.y)}" x2="${X(t * d[0])}" y2="${Y(t * d[1])}"/>`; });
      if (o.drops) pts.forEach(p => { const t = p.x * d[0] + p.y * d[1]; g += `<circle class="lx-${ID}-shadow" cx="${X(t * d[0])}" cy="${Y(t * d[1])}" r="3.5"/>`; });
    }
    pts.forEach(p => {
      g += `<circle class="lx-${ID}-pt${p.faint ? " faint" : ""}" cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.ring ? 4.5 : 4}"/>`;
      if (p.ring) g += `<circle class="lx-${ID}-ring" cx="${X(p.x)}" cy="${Y(p.y)}" r="9"/>`;
      if (p.name) g += `<text class="lx-${ID}-name" x="${X(p.x) + (p.x > Rx * 0.55 ? -12 : 12)}" y="${Y(p.y) + 4}" text-anchor="${p.x > Rx * 0.55 ? "end" : "start"}">${kit.esc(p.name)}</text>`;
    });
    if (o.line != null) { // marks on top of the dots, so a label is never hidden
      const d = dirOf(o.line);
      (o.marks || []).forEach(m => { const cx = X(m.t * d[0]), cy = Y(m.t * d[1]); g += `<circle class="lx-${ID}-mark" cx="${cx}" cy="${cy}" r="9"/><text class="lx-${ID}-mtxt" x="${cx}" y="${cy + 4}" text-anchor="middle">${kit.esc(m.label)}</text>`; });
    }
    return `<div class="lx-${ID}-fig"><svg viewBox="0 0 ${S} ${S}" role="img" aria-label="${kit.esc(o.title || "scatter plot")}">${g}</svg>${o.cap ? `<p class="lx-${ID}-cap">${o.cap}</p>` : ""}</div>`;
  }
  // kit.code, but long lines wrap at phone width with a hanging indent instead of scrolling out of sight.
  const codeW = (kit, lines, active) => `<pre class="lcode lx-${ID}-wrap">${lines.map((c, j) => { const t = c.trimStart(); return `<div${j === active ? ' class="on"' : ""} style="--ind:${c.length - t.length + 4}ch">${kit.esc(t) || " "}</div>`; }).join("")}</pre>`;
  const pairPts = (extra = {}) => CENT.map((c, i) => Object.assign({ x: c[0], y: c[1] }, extra[i] || {}));
  const PAIR_AXES = ["current →", "↑ temperature"];

  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. The situation, and the by-hand task: turn the line until the shadows spread most. */
  function byHand({ el, done, kit }) {
    ensureStyle();
    let angle = 0, locked = null; // locked: the angle the learner locked in last
    const paint = () => {
      const sp = spreadAt(angle);
      let fb = "";
      if (locked != null) {
        const sh = shareAt(locked);
        if (locked === BEST) fb = kit.feedback(`Yes. At ${BEST}° the shadows spread out the most: they keep ${pct(sh)} of all the spread the 12 dots have in the two readings together. The dots lie almost along this line because current and temperature rise and fall together. So one number per machine, its position along the line, says almost everything the two readings said.`, true);
        else if (Math.abs(locked - BEST) <= 15) fb = kit.feedback(`Close. At ${locked}° the shadows keep ${pct(sh)} of the spread. Turn one notch further toward the long side of the cloud and the shadows spread out more.`, false);
        else fb = kit.feedback(`At ${locked}° the shadows keep only ${pct(sh)} of the spread, so machines that differ land close together. Look at the cloud: it is long in one direction. Lay the line along that.`, false);
      }
      el.innerHTML = `<h1>Twenty readings, one glance</h1>
        <p class="lead">A factory has ${N_MACHINES} machines. Each one reports ${N_SENSORS} sensor readings: motor current, temperatures, vibration, flow and more. The maintenance lead wants to see at a glance which machines behave oddly. Nobody can see that in a table of ${N_MACHINES * N_SENSORS} numbers. This lesson squeezes many columns into a few, so a person can plot them or another model can use them. (The readings in this lesson are simulated.)</p>
        <p class="lead">Start with two sensors and 12 machines: motor current and motor temperature. Each reading is shown as a standard score: 0 is the 12 machines' average, 1 is one standard deviation above it. Each dot is a machine. Its <b>shadow</b> is where it lands when you drop it straight onto the line.</p>
        <p class="task">Tap the angles to turn the line. Find the angle where the shadows spread out the most, then lock it in.</p>
        ${scatter(kit, pairPts(), { line: angle, drops: true, axes: PAIR_AXES, title: "12 machines, current against temperature, with a line and each dot's shadow" })}
        <div class="lx-${ID}-angles">${ANGLES.map(a => `<button type="button" class="btn" data-a="${a}" aria-pressed="${a === angle}">${a}°</button>`).join("")}</div>
        ${kit.meter([{ label: "spread of the shadows", value: Math.round(sp * 100) / 100, max: TOTAL }])}
        <div class="lpanel"><button type="button" class="btn lx-${ID}-lock" data-lock>Lock in ${angle}°</button>${fb}</div>`;
      el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { angle = +b.dataset.a; paint(); });
      el.querySelector("[data-lock]").onclick = () => { locked = angle; paint(); if (locked === BEST) done(); };
    };
    paint();
  }

  /* 2. Predict where a machine lands: the perpendicular drop, then the number. */
  function landing({ el, done, kit }) {
    ensureStyle();
    const A = 1, B = 7; // M-02 (off the line), M-08 (far along it)
    const d = dirOf(BEST);
    const a = CENT[A];
    const tPerp = proj(a, BEST), tVert = a[0] / d[0], tHorz = a[1] / d[1];
    const marks = [["perp", tPerp], ["vert", tVert], ["horz", tHorz]].sort((p, q) => p[1] - q[1]).map((m, i) => ({ kind: m[0], t: m[1], label: "ABC"[i] }));
    const RIGHT1 = marks.findIndex(m => m.kind === "perp");
    const b = CENT[B];
    const score = proj(b, BEST);
    const opts2 = [r2(b[0]), r2(b[1]), r2(b[0] + b[1]), r2(score)];
    const RIGHT2 = 3;
    let round = 0, ans = null;
    const r3 = v => (Math.round(v * 1000) / 1000).toFixed(3);
    const vertWord = tVert * d[1] > a[1] ? "above" : "below";
    const fb1 = marks.map(m => m.kind === "perp" ? null : [m.kind === "vert"
      ? `Mark ${m.label} is straight ${vertWord} ${PAIR_NAMES[A]}: it keeps the current reading and throws the temperature away. A shadow falls at right angles to the line, so both readings count.`
      : `Mark ${m.label} is level with ${PAIR_NAMES[A]}: it keeps the temperature reading and throws the current away. A shadow falls at right angles to the line, so both readings count.`, false]);
    const fb2 = [
      [`${r2(b[0])} is the current reading alone. The line runs between both axes, so the position along it mixes current and temperature.`, false],
      [`${r2(b[1])} is the temperature reading alone. The position along the line depends on both readings.`, false],
      [`${r2(b[0] + b[1])} adds the readings but forgets that the step along the line is not one unit. The direction is (${r3(d[0])}, ${r3(d[1])}): multiply each reading by its part and add.`, false],
      null
    ];
    const paint = () => {
      const r1done = round >= 1, r2done = round >= 2;
      const ptsShow = pairPts({ [A]: { ring: !r1done, name: !r1done ? PAIR_NAMES[A] : undefined }, [B]: { ring: r1done, name: r1done ? PAIR_NAMES[B] : undefined } });
      const fig = scatter(kit, ptsShow, { line: BEST, marks: r1done ? [] : marks, axes: PAIR_AXES, title: "the 12 machines with the 45 degree line" });
      let panel;
      if (!r1done) panel = ask(kit, marks.map(m => `Mark ${m.label}`), RIGHT1, ans, fb1);
      else if (!r2done) panel = `${kit.feedback(`Right: mark ${marks[RIGHT1].label}. The drop meets the line at a right angle. That keeps the part of ${PAIR_NAMES[A]} that lies along the line, from both readings.`, true)}${ask(kit, opts2, RIGHT2, ans, fb2)}`;
      else panel = kit.feedback(`Right: ${r2(b[0])} × ${r3(d[0])} + ${r2(b[1])} × ${r3(d[1])} = ${r2(score)}. That is a dot product of the machine's readings with the line's direction, the move from the matrices lesson. The result is the machine's <b>score</b> on the line: one number in place of two. Do it for all 12 machines and you have a new column that replaces two.`, true);
      el.innerHTML = `<h1>Where does each machine land?</h1>
        <p class="lead">The line now sits at ${BEST}°, the direction you found. A machine's place on it is its shadow: the point where a drop at right angles to the line meets it.</p>
        <p class="task">${!r1done ? `Where does ${PAIR_NAMES[A]} (ringed) land on the line?` : !r2done ? `${PAIR_NAMES[B]} (ringed) has current ${r2(b[0])} and temperature ${r2(b[1])}. The line's direction is (${r3(d[0])}, ${r3(d[1])}): one step along the line moves ${r3(d[0])} in current and ${r3(d[1])} in temperature. How far along the line does it land?` : "Done."}</p>
        ${fig}
        <div class="lpanel">${panel}</div>`;
      el.querySelectorAll(".lopts button").forEach(btn => btn.onclick = () => {
        ans = +btn.dataset.i;
        const right = round === 0 ? RIGHT1 : RIGHT2;
        if (ans === right) { round++; ans = null; paint(); if (round === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 3. Spot the idea: why one score keeps more than one column. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const s45 = shareAt(BEST);
    const opts = [
      "Both keep the same: any one number keeps half of what two columns had",
      "Current alone: a real reading is more exact than a mixed score",
      "The score: the two readings rise and fall together, so one direction carries almost all of their spread",
      "The score: averaging two sensors removes the noise, whatever the sensors are"
    ];
    const RIGHT = 2;
    const fb = [
      [`Not here. Current alone keeps ${pct(SHARE_CURRENT)} of the spread, but your line kept ${pct(s45)}. A single number can keep much more than half when the columns move together.`, false],
      ["The score is built from the real readings, both of them. Keeping current alone throws away everything temperature knew, including where it disagrees with current.", false],
      [`Right. The two readings move together, so the cloud is long and thin. Along its long direction the shadows keep ${pct(s45)} of the spread. Current alone keeps ${pct(SHARE_CURRENT)}. This method has a name: <b>principal component analysis</b> (PCA). It finds the directions where the data spreads most, and describes each point by its score along them. Your line is the <b>first principal component</b>. The second sits at right angles to it and holds what is left, here ${pct(1 - s45)}. Statistics calls this spread <b>variance</b>, so the share each direction keeps is its <b>explained variance ratio</b>.`, true],
      [`If the two sensors had nothing to do with each other, the cloud would be round and every line would keep about half. The gain comes from the readings moving together, not from averaging as such.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why one number can be enough</h1>
        <p class="lead">A colleague wants one number per machine too. He keeps motor current and drops temperature. You keep each machine's score on your ${BEST}° line.</p>
        <p class="task">Which number keeps more of what makes the 12 machines different, and why?</p>
        ${scatter(kit, pairPts(), { line: BEST, drops: true, axes: PAIR_AXES, title: "the shadows on the 45 degree line" })}
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. From scratch in NumPy: a stepped replay, then a question about the sign. */
  const fmt = v => Array.isArray(v) ? `[${v.map(fmt).join(", ")}]` : String(v);
  function stateOf(i) {
    const s = {};
    for (let k = 0; k <= i; k++) Object.assign(s, TRACE[k]);
    return s;
  }
  function sayStep(kit, f) {
    const s = stateOf(TRACE.indexOf(f));
    switch (f.ln) {
      case 1: return `Line 1 subtracts each column's mean, so the cloud sits around 0. Shape ${fmt(s.centered.shape)}: 12 machines, 2 sensors.`;
      case 2: return `Line 2 builds the <b>covariance matrix</b>, a small table of spreads. On the diagonal: each sensor's own spread (${s.cov[0][0]}). Off it: how much the two move together (${s.cov[0][1]}). Large off-diagonal numbers mean a long, thin cloud.`;
      case 3: return `<code>eigh</code> reads that table and returns the directions in which the cloud spreads, as <b>columns</b>, and how much it spreads along each (the eigenvalues). It sorts them from smallest to largest: ${fmt(s.eigenvalues)}.`;
      case 4: return `<code>argsort</code> gives the order smallest first; <code>[::-1]</code> reverses it, so the largest comes first: ${fmt(s.order)}.`;
      case 5: return `The eigenvalues in that order: ${fmt(s.eigenvalues)}. The first is the spread along your line. It is a little larger than the meter on screen 1 showed, because the covariance divides by n − 1 (11) where the meter divided by n (12).`;
      case 6: return `The direction columns in the same order. The first column is now (${s.directions[0][0]}, ${s.directions[1][0]}): the ${BEST}° line.`;
      case 7: return `Each eigenvalue divided by their total is the share of spread: ${fmt(s.share)}. ${pct(s.share[0])}, as on your line.`;
      case 8: return `Line 8 drops every machine onto the first <code>k</code> directions with one matrix product. Shape ${fmt(s.scores.shape)}; ${PAIR_NAMES[0]}'s score is ${s.scores.first[0]}.`;
      default: return "The function returns the scores and the shares. The whole of PCA from scratch is these nine lines.";
    }
  }
  function scratch({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const s8 = TRACE.find(t => t.ln === 8).scores.first[0];
    const handScore = proj(CENT[0], BEST);
    const opts = [
      "A bug: the function should not subtract the mean",
      `NumPy found a different line, the one at ${BEST + 90}°`,
      "NumPy's direction points the other way along the same line, so every score flips sign",
      "Rounding in the standard scores"
    ];
    const RIGHT = 2;
    const fb = [
      [`The means are almost 0 here (the scores were already centred), so subtracting them moves ${PAIR_NAMES[0]} by less than 0.01. It cannot flip ${r2(handScore)} to ${s8}.`, false],
      [`The first column is (${TRACE[5].directions[0][0]}, ${TRACE[5].directions[1][0]}): both parts equal, so it lies on the ${BEST}° line. A ${BEST + 90}° line would have parts of opposite sign, and it keeps only ${pct(TRACE[6].share[1])} of the spread.`, false],
      [`Right. (${TRACE[5].directions[0][0]}, ${TRACE[5].directions[1][0]}) is your line pointing the other way. A direction and its reverse give the same axis, so any PCA tool may return either. Every score flips sign, and the picture is mirrored, nothing more. Never read meaning into the sign alone.`, true],
      ["Rounding changes the third decimal, not the sign.", false]
    ];
    const paint = () => {
      const f = TRACE[i], s = stateOf(i), last = i === TRACE.length - 1;
      const vars = [];
      if (s.eigenvalues) vars.push(`<span>eigenvalues <b>${fmt(s.eigenvalues)}</b></span>`);
      if (s.directions) vars.push(`<span>directions <b>${fmt(s.directions)}</b></span>`);
      if (s.share) vars.push(`<span>share <b>${fmt(s.share)}</b></span>`);
      vars.push(`<span>frame <b>${i + 1} / ${TRACE.length}</b></span>`);
      el.innerHTML = `<h1>PCA from scratch in NumPy</h1>
        <p class="lead">The same 12 machines, now in code. <code>readings</code> is the 12 × 2 array of standard scores; <code>k = 1</code> keeps one direction. This replays a real run.</p>
        <p class="task">Step through the run, then answer the question under it.</p>
        ${codeW(kit, CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${vars.join("")}</div>
        ${kit.feedback(sayStep(kit, f))}
        <div class="lpanel"><p class="lead">The run gives ${PAIR_NAMES[0]} the score ${s8}. With screen 2's sum on your ${BEST}° line, ${PAIR_NAMES[0]} lands at ${r2(handScore)}. Why the different sign?</p>${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); check(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); check(); });
    };
    const check = () => { if (i === TRACE.length - 1 && ans === RIGHT) done(); };
    paint();
  }

  /* 5. scikit-learn on all twenty sensors: read the explained variance, predict n_components_. */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const two = CUM[1];
    const before = CUM[N90 - 2], at = CUM[N90 - 1];
    const optsN = [2, N90, N90 + 3, N_SENSORS];
    const RIGHT = 1;
    const fb = [
      [`The first two keep ${r2(RATIO[0])} + ${r2(RATIO[1])}, about ${pct(two)}. That is enough for a picture, but short of 90%.`, false],
      null,
      [`By then the total is long past 90%: it crosses after ${N90} components (${pct(before)} after ${N90 - 1}, ${pct(at)} after ${N90}). A fraction asks for the fewest components that pass it.`, false],
      [`All ${N_SENSORS} keep 100%, which is what <code>PCA()</code> with no <code>n_components</code> does. A fraction asks for the fewest that pass it.`, false]
    ];
    fb[RIGHT] = [`Right: the run printed <b>${SK_OUT2}</b>. Add the ratios: after ${N90 - 1} components ${pct(before)}, after ${N90} ${pct(at)}, the first total over 90%. The other ${N_SENSORS - N90} directions are mostly noise. The first two alone keep ${pct(two)}: enough to draw a useful picture.`, true];
    const paint = () => {
      el.innerHTML = `<h1>All twenty sensors, with scikit-learn</h1>
        <p class="lead">Now all ${N_SENSORS} sensors and ${N_MACHINES} machines. <code>StandardScaler</code> turns every column into standard scores, as on screen 1. <code>PCA</code> centres the data itself but does not scale it. Its main parameter is <code>n_components</code>. A whole number keeps that many components. A fraction between 0 and 1 keeps the fewest components whose shares add up to more than that fraction. Leaving it out keeps them all. (The fraction needs the exact solver; <code>PCA</code> picks it by itself for a small table like this one.)</p>
        ${codeW(kit, SK_CODE, -1)}
        <p class="lead">The first <code>print</code> showed each component's share (<code>explained_variance_ratio_</code>), largest first:</p>
        <div class="lx-${ID}-pre">${kit.esc(SK_OUT1)}</div>
        <p class="task">What does the last line print: how many components does <code>n_components=0.9</code> keep?</p>
        <div class="lpanel">${ask(kit, optsN.map(String), RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. The map: plot the machines on two components, find the odd ones, read the loadings. */
  function theMap({ el, done, kit }) {
    ensureStyle();
    const LABELED = ["M-42", "M-17", "M-49", "M-20", "M-10"];
    const far = m => Math.hypot(SCORES[m][0], SCORES[m][1]);
    const FAR = LABELED.reduce((a, b) => far(b) > far(a) ? b : a);
    let round = 0, ans = null;
    const q1opts = LABELED;
    const R1 = q1opts.indexOf(FAR);
    const fb1 = q1opts.map(m => m === FAR ? null : m === "M-17" ? [`M-17 does stand apart too, about ${r2(far(m))} from the centre, high on the vertical axis. You will look at it next. ${FAR} is further still, about ${r2(far(FAR))} away.`, false] : [`${m} sits at (${r2(SCORES[m][0])}, ${r2(SCORES[m][1])}): at the edge of the crowd, about ${r2(far(m))} from the centre. ${FAR} is about ${r2(far(FAR))} away, with an empty gap between it and every other machine.`, false]);
    const top1 = topLoad(LOAD[0], 5), top2 = topLoad(LOAD[1], 6);
    const q2opts = ["Motor current, power and flow", "Tool wear, vibration, noise and bearing temperature", "Air pressure and humidity", "All twenty equally: a component mixes every column"];
    const R2 = 1;
    const fb2 = [
      ["Those sensors carry the big weights in component 1, the horizontal axis. M-17 sits far out on the vertical axis, component 2.", false],
      null,
      [`Their weights in component 2 are small (${r2(LOAD[1].air_pressure_Pa)} and ${r2(LOAD[1].humidity_pct)}). A machine far out on component 2 got there through the sensors with big weights.`, false],
      ["Every column has a weight, but they are not equal. A few big weights decide where a machine lands; read those first.", false]
    ];
    const tbl = (row, names) => `<table class="lx-${ID}-tbl"><thead><tr><th>sensor</th><th>weight</th></tr></thead><tbody>${names.map(n => `<tr><td><code>${kit.esc(n)}</code></td><td>${r2(row[n])}</td></tr>`).join("")}</tbody></table>`;
    const paint = () => {
      const pts = Object.keys(SCORES).map(m => ({ x: SCORES[m][0], y: SCORES[m][1], name: LABELED.includes(m) ? m : undefined, ring: round >= 1 && m === "M-17" }));
      const fig = scatter(kit, pts, { R: 13, axes: ["component 1 →", "↑ component 2"], title: "60 machines on the first two components", cap: `All ${N_MACHINES} machines, each drawn from ${N_SENSORS} readings` });
      let panel, task;
      if (round === 0) { task = "Which labelled machine sits furthest from the crowd?"; panel = ask(kit, q1opts, R1, ans, fb1); }
      else if (round === 1) {
        task = "M-17 (ringed) is far out on component 2. Which sensors would you check on it first?";
        panel = `${kit.feedback(`Right: ${FAR}. Read the weights of component 1 (<code>components_[0]</code>): its biggest are ${top1.map(n => `<code>${kit.esc(n)}</code>`).join(", ")}: the sensors that follow how hard a machine works (all rise with load except <code>cycle_time_s</code>, whose weight is negative because it falls). ${FAR}'s readings confirm it: ${NAMES_OF(M42_TOP).map(n => `${kit.esc(n)} ${M42_TOP[n]}`).join(", ")} standard deviations. It runs almost idle.`, true)}
          <p class="lead">Component 2's six biggest weights (<code>components_[1]</code>):</p>${tbl(LOAD[1], top2)}${ask(kit, q2opts, R2, ans, fb2)}`;
      } else {
        task = "";
        panel = kit.feedback(`Right. Those sensors carry the big weights in component 2, a wear direction. M-17's own readings: ${NAMES_OF(M17_TOP).map(n => `${kit.esc(n)} +${M17_TOP[n]}`).join(", ")} standard deviations. Two numbers per machine found both odd machines; the weights (<b>loadings</b>) told you which sensors to open. The picture only shows where to look; an engineer still checks the machine.`, true);
      }
      el.innerHTML = `<h1>The machines at a glance</h1>
        <p class="lead"><code>PCA(n_components=2)</code> turned the ${N_MACHINES} × ${N_SENSORS} table into ${N_MACHINES} × 2 scores, which you can plot. Together the two components keep ${pct(CUM[1])} of the spread.</p>
        ${task ? `<p class="task">${task}</p>` : ""}
        ${fig}
        <div class="lpanel">${panel}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        const right = round === 0 ? R1 : R2;
        if (ans === right) { round++; ans = null; paint(); if (round === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 7. What goes wrong without the scaler: a real run. */
  function noScaler({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Air pressure matters most for spotting odd machines",
      "PCA follows the biggest raw numbers: air pressure is measured in pascals, so its spread dwarfs every other column",
      "Three components are too few",
      `${N_MACHINES} machines are too few for ${N_SENSORS} sensors`
    ];
    const RIGHT = 1;
    const ratio = Number((RAW_RATIO_LINE.match(/\[([\d.]+)/) || [])[1]);
    const fb = [
      ["Air pressure follows neither load nor wear in this data: it is room air, the same for every machine plus noise. It only looks important because its numbers are big.", false],
      [`Right. PCA looks for the largest spread in raw numbers, and a standard deviation of ${RAW_STD.air_pressure_Pa} Pa beats ${RAW_STD.vibration_x_mm_s} mm/s by far. Change the unit and PCA changes its answer: it was measuring units, not machines. You met this trap in k-nearest neighbours. There units decided distances; here they decide spread. The fix is the line you left out: <code>StandardScaler</code> first, so each column counts by how unusual it is, not by its unit. Fit the scaler and the PCA on training data only, then reuse them on new machines.`, true],
      [`The first component alone already claims ${pct(ratio)}. More components would not change what the first one found.`, false],
      ["With the scaler, the same 60 machines gave a clear picture on the last screen. The machine count did not change; only the scaling did.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: no scaler</h1>
        <p class="lead">A colleague runs the same PCA on the raw readings, without <code>StandardScaler</code>: <code>PCA(n_components=3).fit(readings)</code>. The run printed:</p>
        <div class="lx-${ID}-pre">${kit.esc(RAW_RATIO_LINE)}\n${kit.esc(RAW_PC1_LINE)}</div>
        <p class="lead">One component claims nearly everything, and it is almost entirely one sensor. The raw standard deviation of five of the columns:</p>
        <table class="lx-${ID}-tbl"><thead><tr><th>sensor</th><th>std (raw units)</th></tr></thead><tbody>${NAMES_OF(RAW_STD).map(n => `<tr><td><code>${kit.esc(n)}</code></td><td>${RAW_STD[n]}</td></tr>`).join("")}</tbody></table>
        <p class="task">Why did this run find "one component, one sensor"?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Training time", "Explaining the decision: each component mixes all twenty sensors", "Memory for the two scores"];
    const RIGHT = 1;
    const fb = [
      ["Fitting PCA on a table this size takes a moment, and the classifier then trains on fewer columns. Time is not what hurts here.", false],
      ["Right. The auditor asks about sensors; the model only knows components. You can trace a component back through its weights, but every component mixes many sensors, so the answer is never one clean reading. When you must explain a decision column by column, keep the original columns.", true],
      ["Two numbers per machine take less memory than twenty. That is a saving, not a cost.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for PCA</h1>
        <p class="lead"><b>What it is:</b> PCA replaces many columns that move together with a few new columns, the scores along the directions of most spread.</p>
        <p class="lead"><b>Reach for it</b> to draw many columns in two dimensions as a quick, repeatable map. Or use it to shrink them before another model, into fewer inputs that do not move together.</p>
        <p class="lead"><b>Not</b> when you must say which original column caused a result: keep the columns. Not when the data lies on a curved shape: PCA only finds straight directions (kernel PCA, or t-SNE for pictures, can follow curves). Not when the signal you need has little spread: PCA never sees your labels.</p>
        <p class="lead"><b>Costs:</b> cheap to fit on tables like this one. You must scale first, and fit on training data only. The new columns are harder to explain.</p>
        <p class="task">A quality team compresses the 20 sensors to 2 components and trains a fault classifier on them. Which cost bites first when an auditor asks why one machine was flagged?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A shop has 300 columns per customer, one view count per product page. The team wants one quick picture to see whether customer groups exist.", true,
      "Yes. Many columns that move together (people who view one camera page view others), and the goal is a picture. Two components give a first map; scale the columns first.",
      "Page views of related products rise together, so a few directions carry much of the spread. Plotting the first two components is exactly the quick map PCA is for."],
    ["A bank must tell every rejected applicant which of their inputs (income, debts, missed payments) counted against them.", false,
      "No. Each component mixes every input, so a model on components can only say \"component 3 was low\". The bank needs answers in terms of the original inputs, so it should keep them.",
      "The requirement is to explain decisions input by input. Components blend all inputs with weights, so the explanation would be about mixtures nobody asked about. Keep the original columns here."],
    ["Readings from three sensors lie on a curved sheet, rolled up like a carpet. You want a flat 2-D map where rows that sit next to each other on the sheet stay next to each other.", false,
      "No. Squashing a rolled sheet along straight directions lays its turns on top of each other: rows far apart along the sheet land side by side on the map. PCA only finds straight directions; methods that follow the curved sheet (scikit-learn's manifold module, for example Isomap) are built for this.",
      "Any straight projection of a rolled sheet stacks its turns: two rows from different turns get almost the same two scores, though they are far apart along the sheet. PCA cannot unroll it; a nonlinear method that follows the sheet can."],
    ["A lab measures 1,000 closely related light intensities per sample, but has only 80 samples to train a regression. It wants fewer inputs first.", true,
      "Yes. Neighbouring intensities move together, so a handful of components keep most of the spread. Pick how many from the explained variance, and check the regression on validation data.",
      "Hundreds of columns that move together is where PCA shines: fewer, uncorrelated inputs from the same data. Fit it on the training samples only, and confirm on validation data that accuracy holds."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>PCA or not?</h1>
        <p class="lead">Four jobs from other places. PCA means: find the straight directions of most spread, and describe each row by its scores along a few of them.</p>
        <p class="task">Would you use PCA for each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can read a PCA</h1>
      <p class="lead">You found the direction of most spread by hand, scored machines along it, stepped through PCA in ${CODE.length - 1} lines of NumPy, picked how many components to keep from the explained variance, found two odd machines on a two-component map, and saw why scaling comes first.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the centre, covariance, <code>eigh</code> and project steps yourself and check your explained variance shares against scikit-learn's.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. It turns the scaling step you just saw go wrong into a habit, and adds missing values and categories.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Dimensionality reduction with PCA",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html",
      "https://scikit-learn.org/stable/modules/decomposition.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html",
      "https://scikit-learn.org/stable/modules/manifold.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.linalg.eigh.html"
    ],
    interview: [
      {
        q: "You run PCA on 50 sensor columns and the first component explains 99% of the variance and is almost all one sensor. What do you suspect, and what do you do?",
        good: [
          "Suspect units: PCA centres but does not scale, so the column with the largest raw spread takes over",
          "Check the raw standard deviations and the first component's weights to confirm",
          "Standardise the columns first (for example StandardScaler), then refit and reread the explained variance",
          "Fit the scaler and the PCA on training data only and reuse them on new data"
        ],
        weak: "Say the data is very simple because one component explains almost everything, without asking whether the units decided it."
      },
      {
        q: "A teammate wants to reduce 200 features to 10 principal components before a fraud classifier to make training faster. What do you check before agreeing?",
        good: [
          "PCA ignores the labels: a rare fraud signal can sit in a direction with little spread and get dropped",
          "Compare the classifier on validation data with and without PCA, not only the explained variance",
          "Choose the number of components from the explained variance curve and the validation result together",
          "Fit PCA on the training split only, to avoid leaking test data",
          "Components mix features, so explaining single decisions gets harder"
        ],
        weak: "Keep enough components for 95% of the variance and assume accuracy is safe. Variance kept is not the same as signal kept."
      }
    ],
    screens: [byHand, landing, spotIdea, scratch, library, theMap, noScaler, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-a="0"]', "[data-lock]"], right: ['[data-a="45"]', "[data-lock]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: [...Array(TRACE.length - 1).fill("[data-next]"), "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
