/* Lesson s1-derivatives: Derivatives as slopes.
   Story: a small ferry line wants the cruising speed that burns the least fuel per kilometre. The engineer's table
   gives litres per km at each whole speed from 10 to 30 km/h.
   Ideas: (1) nudge the input a little and divide the change in the output by the nudge: that is the slope at that
   point; its sign says which way the output moves, its size says how fast, and it is near zero at the bottom.
   (2) The nudge must be small, but not too small: too big jumps over the bottom, and as it shrinks the estimates
   settle on one number, the derivative; far too small (in float32) and rounding swamps the change.
   Data: the ferry is made up for the lesson (fixed burn 60 L/h plus 0.004 x speed^3 L/h, divided by speed). Every
   number comes from runs on this Mac (Python 3.12.11, NumPy 2.5.4, see env.txt):
     docs/ai-path/runs/s1-derivatives/fuel.py -> fuel.out.txt (the table, the 1 km/h nudges, the 0.5 nudge at 16,
       the big nudges at 18, the exact slopes for checking, the trace of slopes() on screen 5)
     docs/ai-path/runs/s1-derivatives/broken.py -> broken.out.txt (the float32 checker on screen 6 and its fixes)
   Both scripts keep every code line short enough for a 390px code box (re-run 2026-11-14 after splitting the lines;
   every number printed is unchanged).
   No model API calls were recorded for this lesson; nothing on it is "not run by us".
   Lesson-local picture and CSS (prefix lx-s1-derivatives-): a fuel curve drawn as SVG (whole or zoomed on the bottom)
   with marked points and the straight lines between nudged points, a compact three-column table, and an output block. */
(() => {
  const ID = "s1-derivatives", P = "lx-" + ID + "-";

  // fuel.out.txt "== table ==": speed km/h, litres per km (rounded to 3 decimals by the script)
  const TABLE = [[10, 6.4], [11, 5.939], [12, 5.576], [13, 5.291], [14, 5.07], [15, 4.9], [16, 4.774], [17, 4.685], [18, 4.629], [19, 4.602], [20, 4.6], [21, 4.621], [22, 4.663], [23, 4.725], [24, 4.804], [25, 4.9], [26, 5.012], [27, 5.138], [28, 5.279], [29, 5.433], [30, 5.6]];
  const T = Object.fromEntries(TABLE);
  const MODEL = { fixed: 60, drag: 0.004 };            // fuel.py constants
  const HAND = [12, 20, 28];                           // the three speeds nudged by hand (fuel.out.txt agrees)
  // fuel.out.txt "== nudge 0.5 at 16 ==" (before, after, and the run's own rise/nudge from unrounded values, 4 decimals)
  const HALF = { speed: 16, nudge: 0.5, before: 4.774, after: 4.7254, runSlope: -0.0973 };
  // fuel.out.txt "== too big a nudge at 18 ==" (slopes as printed, 4 decimals)
  const BIG18 = { speed: 18, before: 4.6293, runs: [{ nudge: 1, after: 4.6019, slope: -0.0274 }, { nudge: 4, after: 4.6633, slope: 0.0085 }, { nudge: 8, after: 5.0117, slope: 0.0478 }] };
  // fuel.out.txt "== exact slope from the formula ==" (calculus, used only to check the estimates)
  const EXACT = { 12: -0.320667, 16: -0.106375, 18: -0.041185, 20: 0.01, 28: 0.147469 };
  // fuel.out.txt: trace of slopes(12, [1, 0.1, 0.01, 0.001]), keep = nudge, after, rise, estimates; [line, event, nudge, after, rise, estimates]
  const TRACE = [[1, "line", null, null, null, null], [2, "line", null, null, null, []], [3, "line", 1, null, null, []], [4, "line", 1, 5.291384615384615, null, []], [5, "line", 1, 5.291384615384615, -0.2846153846153854, []], [2, "line", 1, 5.291384615384615, -0.2846153846153854, [-0.2846153846153854]], [3, "line", 0.1, 5.291384615384615, -0.2846153846153854, [-0.2846153846153854]], [4, "line", 0.1, 5.544317685950412, -0.2846153846153854, [-0.2846153846153854]], [5, "line", 0.1, 5.544317685950412, -0.0316823140495881, [-0.2846153846153854]], [2, "line", 0.1, 5.544317685950412, -0.0316823140495881, [-0.2846153846153854, -0.316823140495881]], [3, "line", 0.01, 5.544317685950412, -0.0316823140495881, [-0.2846153846153854, -0.316823140495881]], [4, "line", 0.01, 5.572797202664447, -0.0316823140495881, [-0.2846153846153854, -0.316823140495881]], [5, "line", 0.01, 5.572797202664447, -0.003202797335553953, [-0.2846153846153854, -0.316823140495881]], [2, "line", 0.01, 5.572797202664447, -0.003202797335553953, [-0.2846153846153854, -0.316823140495881, -0.3202797335553953]], [3, "line", 0.001, 5.572797202664447, -0.003202797335553953, [-0.2846153846153854, -0.316823140495881, -0.3202797335553953]], [4, "line", 0.001, 5.5756793720526625, -0.003202797335553953, [-0.2846153846153854, -0.316823140495881, -0.3202797335553953]], [5, "line", 0.001, 5.5756793720526625, -0.0003206279473380036, [-0.2846153846153854, -0.316823140495881, -0.3202797335553953]], [2, "line", 0.001, 5.5756793720526625, -0.0003206279473380036, [-0.2846153846153854, -0.316823140495881, -0.3202797335553953, -0.3206279473380036]], [6, "line", 0.001, 5.5756793720526625, -0.0003206279473380036, [-0.2846153846153854, -0.316823140495881, -0.3202797335553953, -0.3206279473380036]], [6, "return", 0.001, 5.5756793720526625, -0.0003206279473380036, [-0.2846153846153854, -0.316823140495881, -0.3202797335553953, -0.3206279473380036]]];
  const NUDGES = [1, 0.1, 0.01, 0.001];
  // fuel.py, the two functions as written (fuel_per_km, then slopes); TRACE lines count from "def slopes"
  const CODE4 = [
    "def fuel_per_km(speed):",
    "    per_hour = FIXED + DRAG * speed ** 3",
    "    return per_hour / speed",
    "",
    "def slopes(speed, nudges):",
    "    estimates = []",
    "    for nudge in nudges:",
    "        after = fuel_per_km(speed + nudge)",
    "        rise = after - fuel_per_km(speed)",
    "        estimates.append(rise / nudge)",
    "    return estimates"
  ];
  const OFF4 = 4;
  // broken.py (comments and the comparison runs left out) and broken.out.txt (not altered)
  const CODE5 = [
    "def slope(speed, nudge):",
    "    after = fuel_per_km(speed + nudge)",
    "    rise = after - fuel_per_km(speed)",
    "    return rise / nudge",
    "",
    "speeds = np.array([12, 16, 20, 24, 28],",
    "                  dtype=np.float32)",
    "nudge = np.float32(1e-6)",
    "print(slope(speeds, nudge))"
  ];
  const B_SPEEDS = [12, 16, 20, 24, 28];
  const OUT5 = "[-0.47683716 -0.47683716  0.47683716  0.         -0.47683716]";
  const B32 = [-0.47683716, -0.47683716, 0.47683716, 0, -0.47683716];
  const INSIDE5 = ["speed + nudge  = np.float32(12.000001)", "fuel before    = np.float32(5.576)", "fuel after     = np.float32(5.5759997)", "rise           = np.float32(-4.7683716e-07)", "float32 eps    = 1.1920929e-07"];
  const EPS32 = 1.1920929e-07;
  const FIX5 = ["float64 speeds, nudge 1e-6:", "[-0.32066663 -0.10637498  0.01000001  0.08783334  0.14746939]", "float32 speeds, nudge 1e-2:", "[-0.32029152 -0.10619164  0.01015663  0.08788109  0.14753342]"];
  const SWEEP = [["1e-3", "-0.3206279473380036"], ["1e-6", "-0.3206666274735426"], ["1e-9", "-0.3206670484701135"], ["1e-12", "-0.32152058793144533"]];
  const RUN_DATE = "2026-11-14";

  /* ---------- helpers ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
  const num = (x, d = 3) => { const v = r(x, d); return (v < 0 ? "−" : "") + Math.abs(v).toFixed(d); };
  const sgn = (x, d = 3) => (r(x, d) > 0 ? "+" : "") + num(x, d);
  const lit = (x, d = 3) => T[x] != null ? num(T[x], d) : "";
  const rise1 = v => r(T[v + 1] - T[v], 3);
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const fmt = n => n.toLocaleString("en");
  const BEST = TABLE.reduce((a, b) => b[1] < a[1] ? b : a);
  const VMIN = Math.cbrt(MODEL.fixed / (2 * MODEL.drag));   // where the exact slope is zero (from the same constants)

  /* ---------- lesson-local styles ---------- */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}plot { width: 100%; max-width: 520px; margin: 12px 0 0; }
      .${P}plot svg { display: block; width: 100%; height: auto; overflow: visible; }
      .${P}plot .gl { stroke: var(--line); stroke-width: 0.25; }
      .${P}plot .ax { stroke: var(--ink-2); stroke-width: 0.4; }
      .${P}plot .tk { fill: var(--muted); font: 500 2.9px var(--mono); }
      .${P}plot .cv { stroke: var(--ink-2); stroke-width: 0.5; fill: none; }
      .${P}plot .pt { fill: var(--surface); stroke: var(--ink-2); stroke-width: 0.35; }
      .${P}plot .pt.in { fill: var(--ink); stroke: var(--ink); }
      .${P}plot .pt.enter { fill: var(--good); stroke: var(--good); }
      .${P}plot .pt.no { fill: var(--bad); stroke: var(--bad); }
      .${P}plot .sec { stroke: var(--ink); stroke-width: 0.6; }
      .${P}plot .sec.enter { stroke: var(--good); stroke-width: 0.8; }
      .${P}plot .sec.no { stroke: var(--bad); stroke-width: 0.8; }
      .${P}plot .sec.dash { stroke-dasharray: 1.2 0.9; }
      .${P}plot .lb { fill: var(--ink); font: 700 3px var(--font); }
      .${P}cap { font: 500 13px/1.4 var(--font); color: var(--muted); margin: 8px 0 0; }
      .${P}tab { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 10px; max-width: 420px; margin: 12px 0 0; font: 500 13.5px/1.2 var(--mono); }
      .${P}tab span { display: flex; justify-content: space-between; padding: 4px 6px; border-bottom: 1px solid var(--line); color: var(--ink-2); }
      .${P}tab span b { font-weight: 500; color: var(--muted); }
      .${P}tab span.on { background: var(--sunk); color: var(--ink); font-weight: 700; box-shadow: inset 2px 0 0 var(--ink); }
      .${P}tab span.on b { color: var(--ink); font-weight: 700; }
      .${P}out { font: 500 13.5px/1.5 var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin: 10px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}out .p { color: var(--muted); }
      .${P}key { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 6px 0 0; font: 500 13px/1.4 var(--font); color: var(--muted); }
      .${P}key span { display: inline-flex; align-items: center; gap: 6px; }
      .${P}key svg { width: 22px; height: 10px; flex: none; }
      .${P}key .sec { stroke: var(--ink); stroke-width: 2; }
      .${P}key .sec.dash { stroke-dasharray: 3 2.5; }
      .${P}key .sec.enter { stroke: var(--good); }
      .${P}key .sec.no { stroke: var(--bad); }
    `;
    document.head.appendChild(s);
  }

  /* ---------- the fuel curve: speed across (10..30), litres per km up ----------
     marks: { speed: state }; lines: [{ a, b, cls, dash, ya, yb }] straight lines between two speeds (ya/yb override
     the table value, for a speed that is not a whole number). */
  // The whole curve by default; ZOOM is the stretch around the bottom (screen 4), where the whole view looks flat.
  const FULL = { XL: 10, XH: 30, YL: 4.4, YH: 6.6, xs: 5, ys: 0.5, yd: 1 };
  const ZOOM = { XL: 16, XH: 24, YL: 4.56, YH: 4.84, xs: 2, ys: 0.05, yd: 2 };
  const X0 = 9, XW = 88, Y0 = 3, YHt = 44;
  function curve({ marks = {}, lines = [], labels = {}, view = FULL } = {}) {
    const { XL, XH, YL, YH, xs, ys, yd } = view;
    const px = v => X0 + (v - XL) / (XH - XL) * XW, py = y => Y0 + (YH - y) / (YH - YL) * YHt;
    const rows = TABLE.filter(([v]) => v >= XL && v <= XH);
    let g = "";
    for (let v = XL; v <= XH; v += xs) g += `<line class="gl" x1="${px(v)}" y1="${Y0}" x2="${px(v)}" y2="${Y0 + YHt}"/><text class="tk" x="${px(v)}" y="${Y0 + YHt + 4.2}" text-anchor="middle">${v}</text>`;
    for (let k = Math.ceil(YL / ys - 1e-9); k * ys <= YH + 1e-9; k++) { const y = k * ys; g += `<line class="gl" x1="${X0}" y1="${py(y)}" x2="${X0 + XW}" y2="${py(y)}"/><text class="tk" x="${X0 - 1.5}" y="${py(y) + 1}" text-anchor="end">${y.toFixed(yd)}</text>`; }
    g += `<line class="ax" x1="${X0}" y1="${Y0 + YHt}" x2="${X0 + XW}" y2="${Y0 + YHt}"/><line class="ax" x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y0 + YHt}"/>`;
    g += `<text class="tk" x="${X0 + XW}" y="${Y0 + YHt + 8.6}" text-anchor="end">speed, km/h →</text>`;
    g += `<polyline class="cv" points="${rows.map(([v, y]) => `${px(v)},${py(y)}`).join(" ")}"/>`;
    for (const l of lines) {
      const ya = l.ya != null ? l.ya : T[l.a], yb = l.yb != null ? l.yb : T[l.b];
      g += `<line class="sec ${l.cls || ""}${l.dash ? " dash" : ""}" x1="${px(l.a)}" y1="${py(ya)}" x2="${px(l.b)}" y2="${py(yb)}"/>`;
    }
    for (const [v, y] of rows) g += `<circle class="pt ${marks[v] || ""}" cx="${px(v)}" cy="${py(y)}" r="${marks[v] ? 1.2 : 0.7}"/>`;
    for (const [v, t] of Object.entries(labels)) g += `<text class="lb" x="${px(+v)}" y="${py(T[v]) - 2.6}" text-anchor="middle">${esc(t)}</text>`;
    return `<div class="${P}plot"><svg viewBox="0 0 100 58" role="img" aria-label="Fuel per kilometre against speed, ${XL} to ${XH} km/h: it falls to a low point near 20 km/h, then rises"><text class="tk" x="1" y="${Y0 - 0.6}">litres per km</text>${g}</svg></div>`;
  }
  const lkey = rows => `<div class="${P}key">${rows.map(([c, t]) => `<span><svg viewBox="0 0 22 10" aria-hidden="true"><line class="sec ${c}" x1="1" y1="5" x2="21" y2="5"/></svg>${t}</span>`).join("")}</div>`;
  // the whole table in three columns; on: speeds to highlight
  const table = (on = []) => {
    const rows = Math.ceil(TABLE.length / 3), cols = [0, 1, 2].map(c => TABLE.slice(c * rows, c * rows + rows));
    const cells = [];
    for (let i = 0; i < rows; i++) for (const c of cols) cells.push(c[i] ? `<span class="${on.includes(c[i][0]) ? "on" : ""}"><b>${c[i][0]}</b>${num(c[i][1])}</span>` : "<span></span>");
    return `<div class="${P}tab" aria-label="Fuel table: speed in km/h, litres per km">${cells.join("")}</div><p class="${P}cap">Left: speed in km/h. Right: litres per km. The engineer's table for our made-up ferry, printed by our run on ${RUN_DATE}.</p>`;
  };

  /* 1. The situation, by hand: nudge the speed by 1 km/h at three speeds. */
  function byHand({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === HAND.length, v = fin ? null : HAND[k];
      const right = fin ? 0 : rise1(v), opts = fin ? [] : [right, -right, T[v + 1]].sort((a, b) => a - b);
      const marks = {}, lines = [];
      HAND.slice(0, k).forEach(h => { marks[h] = "in"; marks[h + 1] = "in"; lines.push({ a: h, b: h + 1, cls: "enter" }); });
      if (!fin) { marks[v] = "in"; marks[v + 1] = "in"; }
      const on = fin ? [] : [v, v + 1];
      el.innerHTML = `<h1>The ferry's cheapest speed</h1>
        <p class="lead">A small ferry line runs one boat across a bay, many times a day. Fuel is its biggest bill. The captain likes to cruise fast. The owner wants the speed that burns the <b>least fuel per kilometre</b>. Going slower is not always cheaper: the engines, lights and pumps burn fuel every hour the trip lasts. The engineer worked out the fuel per km at each whole speed.</p>
        <p class="lead">You will ask one question: when the input (speed) moves a little, which way does the output (fuel) move, and how fast? Training an AI model asks the same question about each of the numbers inside it.</p>
        ${curve({ marks, lines })}
        ${table(on)}
        ${fin ? "" : `<p class="task">Nudge the speed (push it up a little): go from ${v} to ${v + 1} km/h. By how much does the fuel per km change? (after minus before)</p>`}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(x => sgn(x)), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong == null ? "" : kit.feedback(wrong === -right
          ? `That is before minus after: ${lit(v)} − ${lit(v + 1)}. It answers "what changes if you slow down from ${v + 1} to ${v}". Going faster means after minus before: ${lit(v + 1)} − ${lit(v)}.`
          : `${lit(v + 1)} is the fuel per km at ${v + 1} km/h itself. The question is how much it <i>changed</i> on the way from ${v}: subtract ${lit(v)}.`, false)}
        ${k > 0 ? kit.feedback(`${HAND.slice(0, k).map(h => `${h} → ${h + 1} km/h: ${lit(h + 1)} − ${lit(h)} = <b>${sgn(rise1(h))}</b> L/km`).join("<br>")}`, fin ? true : undefined) : ""}
        ${fin ? kit.feedback(`Each number is a change in fuel per km for one extra km/h. On the curve it is how steeply the line between the two points climbs or falls: the <b>slope</b> of the curve at that speed. You measured it by nudging the input a little and watching the output.`) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const x = opts[+b.dataset.i];
        if (x !== right) { wrong = x; paint(); return; }
        wrong = null; k++; paint();
        if (k === HAND.length) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: what the sign and the size say. */
  function spot({ el, done, kit }) {
    css();
    const ans = [null, null];
    const [a, b, c] = HAND.map(rise1), cs = HAND[2];
    const O0 = [`Speed up: a positive slope means the fuel is going the right way`,
      `Slow down: each km/h faster adds about ${num(c)} L per km here, so each km/h slower saves about that much`,
      `Nothing yet: he needs the whole table before he can decide`];
    const O1 = [`Below ${HAND[0]} km/h: the slope there is negative`, `Near ${HAND[1]} km/h, where the slope is closest to zero`, `Near ${HAND[0]} km/h, where the slope is biggest in size`];
    const paint = () => {
      const ok = [ans[0] === 1, ans[1] === 1];
      el.innerHTML = `<h1>What the slope tells the captain</h1>
        <p class="lead">Your three slopes, in litres per km for each extra km/h: <b>${sgn(a)}</b> at ${HAND[0]}, <b>${sgn(b)}</b> at ${HAND[1]}, <b>${sgn(c)}</b> at ${cs} km/h.</p>
        ${curve({ marks: Object.fromEntries(HAND.flatMap(h => [[h, "in"], [h + 1, "in"]])), lines: HAND.map(h => ({ a: h, b: h + 1, cls: "enter" })) })}
        <div class="lcase" id="c0"><p class="task">The captain cruises at ${cs} km/h. Using only the slope there, what do you tell him?</p>
        ${kit.options(O0, { picked: ans[0], correct: 1 })}
        ${ans[0] == null ? "" : ok[0] ? kit.feedback(`Right. The <b>sign</b> says which way the fuel moves when the speed goes up: plus means more fuel. The <b>size</b> says how much, per km/h. One number gives both, without the rest of the table.`, true)
          : ans[0] === 0 ? kit.feedback(`A positive slope means the fuel per km goes <i>up</i> as the speed goes up: ${lit(cs)} at ${cs}, ${lit(cs + 1)} at ${cs + 1}. Speeding up burns more. To burn less, move the other way.`, false)
          : kit.feedback(`The one number already answers it near ${cs} km/h: ${sgn(c)} means faster costs more and slower saves, about ${num(c)} L/km per km/h. The whole table helps to find the very best speed, not to see which way to go from here.`, false)}</div>
        <div class="lcase" id="c1"><p class="task">Where is the cheapest speed? Use only the three slopes.</p>
        ${kit.options(O1, { picked: ans[1], correct: 1 })}
        ${ans[1] == null ? "" : ok[1] ? kit.feedback(`Right. At the bottom of a valley the ground is flat: the slope is zero. At ${HAND[1]} the slope is small and positive (${sgn(b)}), so the bottom is just below ${HAND[1]}. The table agrees: its lowest whole-speed value is ${num(BEST[1])} at ${BEST[0]} km/h.`, true)
          : ans[1] === 0 ? kit.feedback(`A negative slope at ${HAND[0]} means going <i>faster</i> burns less. So the cheap speeds are above ${HAND[0]}, not below it. Below ${HAND[0]} the fuel per km only climbs: ${lit(XL)} at ${XL} km/h.`, false)
          : kit.feedback(`A big slope means the fuel changes fast there: you are on the steep side of the valley, far from the bottom. The bottom is where the curve flattens out, where the slope is close to zero.`, false)}</div>`;
      el.querySelectorAll(".lcase").forEach((cc, i) => cc.querySelectorAll(".lopts button").forEach(x => x.onclick = () => {
        ans[i] = +x.dataset.i; paint();
        if (ans[0] === 1 && ans[1] === 1) done();
      }));
    };
    paint();
  }

  /* 3. Use it with predictions: a nudge that is not 1 km/h means dividing by the nudge. */
  function divideNudge({ el, done, kit }) {
    css();
    let ans = null;
    const rise = r(HALF.after - HALF.before, 4), sl = rise / HALF.nudge;
    const O0 = [rise * HALF.nudge, sl, rise].sort((a, b) => a - b);
    const R0 = O0.indexOf(sl);
    const paint = () => {
      el.innerHTML = `<h1>Divide by the nudge</h1>
        <p class="lead">A nudge does not have to be 1 km/h. The engineer's script nudged ${HALF.speed} km/h by ${HALF.nudge}: fuel per km went from ${num(HALF.before, 4)} to ${num(HALF.after, 4)}, a change of ${num(rise, 4)} L/km.</p>
        <p class="task">To compare it with your other slopes, what is the change for each km/h?</p>
        <div class="lpanel">${kit.options(O0.map(x => `${num(x, 4)} L/km per km/h`), { picked: ans, correct: R0 })}
        ${ans == null ? "" : ans === R0 ? kit.feedback(`Right: ${num(rise, 4)} ÷ ${HALF.nudge} = ${num(sl, 4)}. The slope is always <b>change in output ÷ change in input</b>. With a 1 km/h nudge the division is by 1, which is why you could skip it before. (Our run divided the unrounded values and printed ${num(HALF.runSlope, 4)}; the last digit differs only because the values above are rounded.)`, true)
          : O0[ans] === rise ? kit.feedback(`${num(rise, 4)} is the change over half a km/h. Per whole km/h it is about twice that: divide by the nudge, ${num(rise, 4)} ÷ ${HALF.nudge}.`, false)
          : kit.feedback(`That multiplies by ${HALF.nudge} instead of dividing. Half a km/h gave ${num(rise, 4)}, so a whole km/h gives about twice as much: ${num(rise, 4)} ÷ ${HALF.nudge}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === R0) done(); });
    };
    paint();
  }

  /* 4. Use it with predictions: a nudge too big jumps over the bottom (picture zoomed on the bottom). */
  function bigNudge({ el, done, kit }) {
    css();
    let ans = null;
    const [n1, n4] = BIG18.runs;
    const O1 = [`Still negative, about the same`, `Negative and bigger in size`, `Positive`];
    const paint = () => {
      const ok = ans === 2;
      const lines = [{ a: BIG18.speed, b: BIG18.speed + n1.nudge, cls: "enter" }];
      if (ok) lines.push({ a: BIG18.speed, b: BIG18.speed + n4.nudge, cls: "no", dash: true });
      el.innerHTML = `<h1>Too big a nudge</h1>
        <p class="lead">At ${BIG18.speed} km/h a 1 km/h nudge gives a slope of ${sgn(n1.slope, 4)}. That is the line from ${BIG18.speed} to ${BIG18.speed + n1.nudge} below. The picture shows only ${ZOOM.XL} to ${ZOOM.XH} km/h, close up. A colleague says a bigger nudge, ${n4.nudge} km/h, would be "more robust": harder to throw off.</p>
        ${curve({ view: ZOOM, marks: { [BIG18.speed]: "in", [BIG18.speed + n1.nudge]: "in", ...(ok ? { [BIG18.speed + n4.nudge]: "no" } : {}) }, lines })}
        ${ok ? lkey([["enter", `nudge ${n1.nudge}`], ["no dash", `nudge ${n4.nudge}`]]) : ""}
        <p class="task">Predict the slope estimate at ${BIG18.speed} km/h with a ${n4.nudge} km/h nudge.</p>
        <div class="lpanel">${kit.options(O1, { picked: ans, correct: 2 })}
        ${ans == null ? "" : ok ? kit.feedback(`Right. Our run gave <b>${sgn(n4.slope, 4)}</b>, and with an ${BIG18.runs[2].nudge} km/h nudge ${sgn(BIG18.runs[2].slope, 4)}. The line from ${BIG18.speed} to ${BIG18.speed + n4.nudge} jumps over the bottom of the valley and ends higher on the far side, so it measures the average slope of a whole stretch, not the slope at ${BIG18.speed}. It would tell the captain to slow down from ${BIG18.speed}, which is wrong. A smaller nudge measures closer to the point itself.`, true)
          : ans === 0 ? kit.feedback(`It would be about the same if the curve were a straight line. It is not: the bottom is between ${BIG18.speed} and ${BIG18.speed + n4.nudge}. A ${n4.nudge} km/h nudge ends on the far side, higher up (${num(n4.after, 4)} against ${num(BIG18.before, 4)}).`, false)
          : kit.feedback(`Further along, the curve goes back up: the bottom is between ${BIG18.speed} and ${BIG18.speed + n4.nudge}. Look where ${BIG18.speed + n4.nudge} km/h sits in the table: ${lit(BIG18.speed + n4.nudge)}, above ${lit(BIG18.speed)}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 2) done(); });
    };
    paint();
  }

  /* 5. From scratch in Python: shrink the nudge and watch the estimates settle (a traced run). */
  function scratch({ el, done, kit }) {
    css();
    let i = 0, guess = null;
    const PQ = TRACE.findIndex(t => t[0] === 5 && t[2] === NUDGES[NUDGES.length - 1]);
    const [, , pn, , pr, pe] = TRACE[PQ];
    const pRight = pr / pn, last = pe[pe.length - 1], prev = pe[pe.length - 2];
    const pOpts = [r(pRight, 4), r(pe[0], 4), r(last + (last - prev), 4)].sort((a, b) => a - b);
    const pNo = v => v === r(pe[0], 4)
      ? `That is the first estimate, from the 1 km/h nudge. A smaller nudge measures closer to ${TRACE_SPEED} km/h itself, so the estimates move away from it, not back.`
      : `That keeps moving by the last jump (${num(last - prev, 4)}). But the jumps shrink each time: ${pe.slice(1).map((x, j) => num(x - pe[j], 4)).join(", ")}. The estimates are settling, not drifting. Divide: ${num(pr, 7)} ÷ ${pn}.`;
    const say = j => {
      const [ln, ev, n, af, rs, est] = TRACE[j], nx = TRACE[j + 1];
      if (ev === "return") return `<code>slopes</code> returns four estimates. Each smaller nudge moves the estimate less: they settle near <b>${num(est[est.length - 1], 4)}</b> L/km per km/h. That settled number is the <b>derivative</b> of fuel per km at ${TRACE_SPEED} km/h: the slope at that exact point. Calculus gives the exact slope of this formula: ${num(EXACT[TRACE_SPEED], 4)} (we use it only to check).`;
      if (ln === 1) return `Called as <code>slopes(${TRACE_SPEED}, [${NUDGES.join(", ")}])</code>. The highlighted line starts an empty list of estimates.`;
      if (ln === 2) return nx[0] === 3 ? `Next nudge: ${nx[2]} km/h.` : `No nudges left, so the loop ends.`;
      if (ln === 3) return `after = fuel per km at ${fmtN(TRACE_SPEED + n)} km/h = ${num(nx[3], 7)} L/km.`;
      if (ln === 4) return `rise = after minus fuel at ${TRACE_SPEED} = ${num(nx[4], 7)} L/km.`;
      if (ln === 5) return `rise ÷ nudge = ${num(rs, 7)} ÷ ${n} = ${num(nx[5][nx[5].length - 1], 4)}. Appended.`;
      return `All ${NUDGES.length} estimates are in.`;
    };
    const paint = () => {
      const [ln, ev, n, af, rs, est] = TRACE[i];
      const ask = i === PQ, held = ask && guess !== r(pRight, 4);
      const show = x => x == null ? "–" : x;
      el.innerHTML = `<h1>Shrink the nudge, in Python</h1>
        <p class="lead"><code>fuel_per_km</code> is the engineer's formula behind the table (FIXED = ${MODEL.fixed} litres an hour whatever the speed, DRAG = ${MODEL.drag}). <code>slopes</code> nudges ${TRACE_SPEED} km/h by smaller and smaller amounts and keeps each estimate. We ran it and recorded every step.</p>
        <p class="task">Step through the run to the end. Before the last estimate is added, you predict it.</p>
        ${kit.code(CODE4, ln + OFF4)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || held ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>nudge <b>${show(n)}</b></span><span>after <b>${af == null ? "–" : num(af, 7)}</b></span><span>rise <b>${rs == null ? "–" : num(rs, 7)}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        <div class="${P}out"><span class="p">estimates</span> ${est == null ? "–" : `[${est.map(x => num(x, 4)).join(", ")}]`}</div>
        ${ask ? `<div class="lcase" id="c-pred"><p class="task">Predict: nudge ${pn}, rise ${num(pr, 7)}. What will be appended?</p>
          ${kit.options(pOpts.map(x => num(x, 4)), { picked: guess == null ? null : pOpts.indexOf(guess), correct: pOpts.indexOf(r(pRight, 4)), num: true })}
          ${guess != null && guess !== r(pRight, 4) ? kit.feedback(pNo(guess), false) : ""}</div>` : ""}
        ${held ? "" : kit.feedback(say(i))}
        <p class="${P}cap">Recorded run on our Mac, ${RUN_DATE}; estimates shown to 4 decimals. The highlighted line is the one about to run.</p>`;
      el.querySelectorAll("#c-pred .lopts button").forEach(b => b.onclick = () => { guess = pOpts[+b.dataset.i]; paint(); });
      el.querySelector("[data-prev]").onclick = () => { i--; guess = null; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }
  const TRACE_SPEED = 12;
  const fmtN = x => String(r(x, 6));

  /* 6. Broken on purpose: a float32 slope checker with a tiny nudge. */
  function broken({ el, done, kit }) {
    css();
    const ans = [null, null, null];
    const HV = HAND.map(rise1);
    const O0 = HAND.map(v => `${v} km/h: ${sgn(B32[B_SPEEDS.indexOf(v)], 3)}`);
    const R0 = HAND.length - 1;
    const O1 = ["The fuel formula inside fuel_per_km is wrong",
      "The nudge is so small that the two fuel values differ only in the last digit float32 keeps, so the rise is rounding, not the curve",
      "Dividing by a tiny nudge overflows the number"];
    const O2 = ["Make the nudge smaller still, say 1e-9", "Round the slopes to 2 decimals", "Do the check in float64, or use a bigger nudge such as 0.01"];
    const steps32 = [...new Set(B32.map(x => num(Math.abs(x), 3)))].filter(x => x !== "0.000");
    const paint = () => {
      const ok = [ans[0] === R0, ans[1] === 1, ans[2] === 2];
      el.innerHTML = `<h1>The slope checker that lies</h1>
        <p class="lead">A colleague automated your nudging. To save memory, she keeps the speeds in a <code>float32</code> array. A float32 number takes half the memory of a <code>float64</code>, the kind of number a plain Python float is. To be "precise", she nudges by 0.000001 (written <code>1e-6</code> in code). Here is her code and the output it really printed.</p>
        ${kit.code(CODE5, -1)}
        <div class="${P}out"><span class="p">output, speeds ${B_SPEEDS.join(", ")}</span>\n${esc(OUT5)}</div>
        <div class="lcase" id="c0"><p class="task">Your hand slopes were ${HAND.map((v, j) => `${sgn(HV[j])} at ${v}`).join(", ")}. Which of her answers has the wrong sign?</p>
        ${kit.options(O0, { picked: ans[0], correct: R0 })}
        ${ans[0] == null ? "" : ok[0] ? kit.feedback(`Right: at ${HAND[R0]} km/h she gets a minus, so her tool says "go faster to save fuel". The table says the opposite: ${lit(HAND[R0])} at ${HAND[R0]}, ${lit(HAND[R0] + 1)} at ${HAND[R0] + 1}. Look again at the whole output: every answer is ${steps32.join(" or ")} with a sign, or 0.`, true)
          : kit.feedback(`The sign agrees with your hand slope there (${sgn(HV[ans[0]])}). The size is off, ${num(Math.abs(B32[B_SPEEDS.indexOf(HAND[ans[0]])]))} instead of about ${num(Math.abs(HV[ans[0]]))}, but it still points the right way. One answer points the wrong way.`, false)}</div>
        ${ok[0] ? `<div class="lcase" id="c1"><p class="lead">She prints what happens inside at ${HAND[0]} km/h:</p>
          <div class="${P}out">${INSIDE5.map(esc).join("\n")}</div>
          <p class="task">What causes the wrong slopes?</p>
          ${kit.options(O1, { picked: ans[1], correct: 1 })}
          ${ans[1] == null ? "" : ok[1] ? kit.feedback(`Right. float32 can only tell numbers apart to about 1 part in ${fmt(Math.round(1 / EPS32 / 1e5) / 10)} million (its <code>eps</code>, ${EPS32}, printed above). The real change in fuel is smaller than the gap between two neighbouring float32 numbers near ${lit(HAND[0])}. So the "after" value lands on the neighbouring number below or above, or on the same number, and the rise is one step of that rounding grid or 0. Divided by the nudge, the rounding step becomes the ${steps32.join(" ")} you saw.`, true)
            : ans[1] === 0 ? kit.feedback(`The same <code>fuel_per_km</code> printed the table you trusted, and the before value here, ${esc(INSIDE5[1].split("= ")[1])}, matches it. The formula is fine; the subtraction of two almost equal numbers is not.`, false)
            : kit.feedback(`Nothing overflows: ${B32[0]} is a small number. The division is not the problem; the rise it divides is already wrong (${esc(INSIDE5[3].split("= ")[1])} is one rounding step, not the curve's change).`, false)}</div>` : ""}
        ${ok[1] ? `<div class="lcase" id="c2"><p class="task">What fixes the checker?</p>
          ${kit.options(O2, { picked: ans[2], correct: 2 })}
          ${ans[2] == null ? "" : ok[2] ? kit.feedback(`Right. Both fixes, recorded:<div class="${P}out">${FIX5.map(esc).join("\n")}</div>The signs now match your hand slopes, and the sizes match the exact slopes from calculus (${HAND.map(v => num(EXACT[v], 3)).join(", ")} at ${HAND.join(", ")}). Even float64 has a floor: at ${HAND[0]} km/h, nudges of ${SWEEP.map(s => s[0]).join(", ")} gave ${SWEEP.map(s => num(+s[1], 4)).join(", ")}; the last one drifts. Too big averages over a stretch; too small measures rounding. PyTorch's gradient checker, a tool that tests the slopes a model computes, also checks them with small nudges (finite differences), and its documentation says its defaults are designed for double precision (float64) input.`, true)
            : ans[2] === 0 ? kit.feedback(`A smaller nudge makes the real change even smaller next to the rounding step, so the answer gets worse, not better. The nudge was already too small for float32.`, false)
            : kit.feedback(`Rounding hides the noise but cannot bring back the sign: ${sgn(B32[B_SPEEDS.indexOf(HAND[R0])], 2)} at ${HAND[R0]} km/h stays wrong. The rise itself must be measured with enough digits.`, false)}</div>` : ""}
        <p class="${P}cap">Output recorded on our Mac with NumPy 2.5.4, ${RUN_DATE}.</p>`;
      el.querySelectorAll(".lcase").forEach(cc => cc.querySelectorAll(".lopts button").forEach(x => x.onclick = () => {
        const i = +cc.id.slice(1);
        ans[i] = +x.dataset.i; paint();
        if (ans[0] === R0 && ans[1] === 1 && ans[2] === 2) done();
      }));
    };
    paint();
  }

  /* 7. The big picture, with a task on cost. */
  const WEIGHTS = 7000000;
  function bigPicture({ el, done, kit }) {
    css();
    let ans = null;
    const runs = WEIGHTS + 1;
    const opts = ["Checking a hand-written slope formula for a pricing function with 3 inputs",
      `Getting the slope for each of ${fmt(WEIGHTS)} model weights at every training step`,
      "Finding how much a delivery-time estimate changes when the fuel price goes up a little"];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What for:</b> a derivative says how an output responds when one input moves a little: which way, and how fast. Weights are the tuned numbers inside a model. Training moves each one a little, step after step, to lower the model's error. So for every weight it asks: which way should this one move?</p>
        <p class="lead"><b>When:</b> the output changes smoothly with the input. Nudging needs no formula for the slope, so it is the standard way to check a slope formula someone worked out by hand.</p>
        <p class="lead"><b>When not:</b> outputs that jump in steps (a price per weight band, a yes/no) give 0 or a cliff. Noisy measurements: the wobble swamps a small nudge.</p>
        <p class="lead"><b>Cost:</b> one extra run of the function per input, and a nudge that must be neither too big nor too small.</p>
        <p class="task">Three teams want slopes. Which one should <b>not</b> get them by nudging?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1 ? kit.feedback(`Right. Nudging needs one extra run per input: ${fmt(runs)} runs of the whole model for one training step, and every estimate carries the nudge-size trade-off. Backpropagation, later in the path, gets all those slopes together without one run per weight. Nudging stays useful there to spot-check a few of them.`, true)
          : ans === 0 ? kit.feedback(`Three inputs means three extra runs: cheap. And checking a hand-written formula is exactly what nudging is for, since it needs no formula itself.`, false)
          : kit.feedback(`One input, one extra run, and a price moves smoothly. That is a fine use of a nudge: it answers "how much does the estimate move for each extra cent of fuel price".`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations, with two "no" cases. */
  const CASES = [
    ["A solar engineer has a simulator that gives a panel's daily energy for any tilt angle. She wants to know whether tilting 1 degree steeper helps, and by how much.", true,
      "Yes. Energy changes smoothly with the angle, and the simulator can be run twice. Nudge the angle a little; the sign says steeper or flatter, the size says how much energy per degree.",
      "The simulator gives a smooth curve, and one extra run costs nothing. Nudge the tilt a little and divide the change in energy by the nudge: the sign says which way to tilt, the size how much it matters."],
    ["A courier charges by weight band: the same price up to 1 kg, a higher price up to 2 kg, and so on. A team nudges a parcel's weight by 1 gram to find the slope of price against weight, to decide whether lighter packaging pays.", false,
      "No. Inside a band the price does not move, so the nudge gives a slope of 0 almost everywhere, and at a band edge it gives a huge jump. Neither says how far the packaging must shrink to save money. Look at the distance to the next band edge instead.",
      "Try it: inside a band, 1 gram more costs nothing extra, so the slope is 0. It says nothing about how far away the next band edge is. A price that jumps in steps has no useful slope; compare the parcel's weight with the band edges instead."],
    ["A runner's watch reads heart rate, and each reading wobbles by a few beats. He runs one lap at 5:00 min/km and one at 4:59, and divides the difference of the two readings by one second to get the slope.", false,
      "No. One second of pace changes the heart rate far less than the watch wobbles, so the difference of two single readings is mostly wobble. Use paces far enough apart, average many readings, or fit a smooth curve first.",
      "The two readings differ mostly by the watch's wobble, not by the pace. Dividing that by a tiny nudge makes the noise look like a steep slope. With noisy measurements, nudge further apart, average many readings, or fit a curve first."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Nudge for a slope here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the ferry.</p>
        <p class="task">For each one, decide: does nudging the input give a slope worth acting on? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next: the browser exercise and the next lesson. */
  function whatNext({ el, done, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now estimate a derivative by nudging: (output after − output before) ÷ nudge. You can read it: the sign says which way the output moves, the size how fast, and near zero means you are near a bottom (or a top). You know the nudge must be small but not too small, and that float32 makes "too small" come early.</p>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write <code>slope(f, x, nudge)</code> and use it to find which of the ferry's speeds has the slope closest to zero.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. It gives the function a second input: nudge each input on its own to get its own slope, and chain slopes when one quantity drives another.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Derivatives as slopes",
    checked: "2026-11-14",
    sources: [
      "https://openstax.org/books/calculus-volume-1/pages/3-1-defining-the-derivative",
      "https://docs.python.org/3/tutorial/floatingpoint.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.finfo.html",
      "https://docs.pytorch.org/docs/stable/generated/torch.autograd.gradcheck.gradcheck.html"
    ],
    interview: [{
      q: "You wrote the gradient of a custom loss by hand and training behaves oddly. How do you check that your gradient is right?",
      good: [
        "Nudge one input at a time and compare (loss after − loss before) ÷ nudge with what my formula gives at the same point",
        "Do the check in float64: in float32 a small nudge measures rounding, not the function",
        "Try a few nudge sizes and trust the range where the estimate stops changing; too big averages over a stretch",
        "Check a handful of inputs, not all of them, since every check costs an extra run; a wrong sign points straight at a bug",
        "PyTorch's gradcheck does this comparison and expects double-precision inputs"
      ],
      weak: "Lower the learning rate or train longer and see if the loss improves. That never tests whether the gradient formula itself is right."
    }, {
      q: "A teammate suggests skipping backpropagation and getting each weight's slope by nudging it. The model has millions of weights. What do you say?",
      good: [
        "Nudging needs one extra run of the whole model per weight, for every training step: millions of runs per step",
        "Each estimate is approximate and depends on the nudge size",
        "Backpropagation gets all the slopes together without one run per weight",
        "Nudging is still the right tool to spot-check a few weights' slopes against backpropagation"
      ],
      weak: "Say nudging is \"less accurate\" and stop there, without naming the cost of one run per weight, which is what rules it out."
    }],
    screens: [byHand, spot, divideNudge, bigNudge, scratch, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: HAND.map(() => "[data-right]") },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      (() => { const pq = TRACE.findIndex(t => t[0] === 5 && t[2] === NUDGES[NUDGES.length - 1]);
        return { wrong: [...Array(pq).fill("[data-next]"), "#c-pred [data-wrong]"], right: ["#c-pred [data-right]", ...Array(TRACE.length - 1 - pq).fill("[data-next]")] }; })(),
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]", "#c2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
