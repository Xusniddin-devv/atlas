/* Lesson s1-gradients: Gradients and the chain rule.
   Story: a greenhouse grower has two dials, the heater setting and the lamp hours per day. The heater sets the air
   temperature, the temperature and the light set how much the plants grow. The grower wants the weekly growth
   shortfall (target minus growth) as low as possible.
   Ideas: (1) with two inputs, nudge one at a time with the other held still: two slopes, written together, are the
   gradient; minus the gradient is the steepest way down, and it does not point at the lowest point. Getting it by
   nudging costs one extra run of the model per input. (2) The chain rule: when one step feeds the next, the slope of
   the whole chain is the product of the links' slopes, each read at the point where that link is working.
   Data: the greenhouse model is made up by us for teaching (docs/ai-path/runs/s1-gradients/greenhouse.py), not
   measured. Every number comes from runs on this Mac (Python 3.12.11, NumPy 2.5.4, see env.txt):
     docs/ai-path/runs/s1-gradients/gradients.py -> gradients.out.txt (nudges, arrows, directions, the gradient at
       three settings, the traced nudge_gradient() on screen 5, the chain slopes on screens 6 and 7)
     docs/ai-path/runs/s1-gradients/broken.py -> broken.out.txt (screen 8, the chain-rule bug and its fix)
   No model API calls were recorded for this lesson; nothing on it is "not run by us".
   Lesson-local picture and CSS (prefix lx-s1-gradients-): a contour map of the shortfall drawn as SVG (rings of
   equal shortfall, the grower's setting, labelled arrows), and a small multi-column table. Plain browser script. */
(() => {
  const ID = "s1-gradients", P = "lx-" + ID + "-";

  /* ---------- Data copied from the runs (not altered) ---------- */
  // greenhouse.py: the model's coefficients, used only to draw the rings of the map
  const MODEL = { airBase: 12, airPerStep: 1.5, best: 24, kAir: 0.15, lampBest: 6, kLamp: 1.5, target: 40 };
  // gradients.out.txt
  const START = { heater: 4.0, lamp: 9.0, air: 18.0, growth: 21.1, shortfall: 18.9 };
  const NUDGE_H = { heater: 4.01, lamp: 9.0, shortfall: 18.873033749999998, change: -0.02696625000000097, slope: -2.696625000000097 };
  const NUDGE_L = { heater: 4.0, lamp: 9.01, shortfall: 18.990149999999996, change: 0.09014999999999773, slope: 9.014999999999773 };
  const ARROWS = [ // [d_heater, d_lamp, shortfall, change]
    [0.1, 0.1, 19.548374999999997, 0.6483749999999979],
    [0.1, -0.1, 17.748375000000003, -1.1516249999999957],
    [-0.1, 0.1, 20.088374999999996, 1.188374999999997],
    [-0.1, -0.1, 18.288375000000002, -0.6116249999999965]
  ];
  // TRACE lines: [line, event, vars, calls to shortfall so far]
  const TRACE = [
    [1, "line", { heater: 4.0, lamp: 9.0 }, 0],
    [2, "line", { heater: 4.0, lamp: 9.0, nudge: 0.001 }, 0],
    [3, "line", { heater: 4.0, lamp: 9.0, nudge: 0.001, base: 18.9 }, 1],
    [4, "line", { heater: 4.0, lamp: 9.0, nudge: 0.001, base: 18.9, up_h: 18.8973003375 }, 2],
    [5, "line", { heater: 4.0, lamp: 9.0, nudge: 0.001, base: 18.9, up_h: 18.8973003375, up_l: 18.90900149999999 }, 3],
    [6, "line", { heater: 4.0, lamp: 9.0, nudge: 0.001, base: 18.9, up_h: 18.8973003375, up_l: 18.90900149999999, slope_heater: -2.6996624999995333 }, 3],
    [7, "line", { heater: 4.0, lamp: 9.0, nudge: 0.001, base: 18.9, up_h: 18.8973003375, up_l: 18.90900149999999, slope_heater: -2.6996624999995333, slope_lamp: 9.001499999993001 }, 3],
    [8, "line", { heater: 4.0, lamp: 9.0, nudge: 0.001, base: 18.9, up_h: 18.8973003375, up_l: 18.90900149999999, slope_heater: -2.6996624999995333, slope_lamp: 9.001499999993001 }, 3],
    [8, "return", { heater: 4.0, lamp: 9.0, nudge: 0.001, base: 18.9, up_h: 18.8973003375, up_l: 18.90900149999999, slope_heater: -2.6996624999995333, slope_lamp: 9.001499999993001 }, 3]
  ];
  const GRAD = [-2.6996624999995333, 9.001499999993001]; // GRADIENT_START, nudge 0.001, 3 calls
  const DIRS = { // DIRECTION_*: a step of length 0.5 from the start
    minus: { step: [0.1436355029390617, -0.4789246728823259], shortfall: 14.552878365292052, drop: 4.347121634707946 },
    equal: { step: [0.35355339059327373, -0.35355339059327373], shortfall: 14.993112830058699, drop: 3.9068871699412995 },
    best: { step: [0.4, -0.3], shortfall: 15.30899999999999, drop: 3.591000000000008 }
  };
  const BEST_KNOWN = { heater: 8.0, lamp: 6.0 }; // gradients.py BEST_KNOWN: the lowest point of the made-up model
  const POINTS = [ // GRADIENT_AT
    { heater: 10.0, lamp: 4.0, shortfall: 7.350000000000001, gradient: [1.3503374999999096, -5.9985000000040145] },
    { heater: 8.0, lamp: 6.0, shortfall: 0.0, gradient: [0.00033749999772680894, 0.0015000000033182914] },
    { heater: 1.0, lamp: 6.0, shortfall: 16.537499999999998, gradient: [-4.724662499999255, 0.0014999999997655777] }
  ];
  const CHAIN = [ // CHAIN lines, lamp 9
    { heater: 4.0, air: 18.0, growth: 21.1, airPerHeater: 1.5000000000000568, growthPerAir: 1.7998500000047102, growthPerHeaterNudged: 2.6996624999995333, shortfallPerHeaterNudged: -2.6996624999995333 },
    { heater: 10.0, air: 27.0, growth: 25.15, airPerHeater: 1.5000000000000568, growthPerAir: -0.9001499999996554, growthPerHeaterNudged: -1.3503374999999096, shortfallPerHeaterNudged: 1.3503374999999096 }
  ];
  // gradients.py, nudge_gradient, line for line (line 0 = def)
  const CODE5 = [
    "def nudge_gradient(shortfall, heater, lamp):",
    "    nudge = 0.001",
    "    base = shortfall(heater, lamp)",
    "    up_h = shortfall(heater + nudge, lamp)",
    "    up_l = shortfall(heater, lamp + nudge)",
    "    slope_heater = (up_h - base) / nudge",
    "    slope_lamp = (up_l - base) / nudge",
    "    gradient = [slope_heater, slope_lamp]",
    "    return np.array(gradient)"
  ];
  // broken.py, growth_per_heater, line for line, and broken.out.txt (not altered)
  const CODE8 = [
    "def growth_per_heater(heater):",
    "    air = air_temp(heater)",
    "    air_per_heater = 1.5",
    "    growth_per_air = -0.3 * (heater - 24)",
    "    return air_per_heater * growth_per_air"
  ];
  const BUG_LINE = 3;
  const OUT8 = ["heater  chain_rule  nudge_check", "   2.0      9.9000       4.0497", "   4.0      9.0000       2.6997", "   8.0      7.2000      -0.0003"];
  const OUT8_FIXED = ["after the fix", "heater  chain_rule  nudge_check", "   2.0      4.0500       4.0497", "   4.0      2.7000       2.6997", "   8.0     -0.0000      -0.0003"];

  // broken.out.txt rows, split into their columns
  const B8 = OUT8.slice(1).map(r => { const [h, chain, nudge] = r.trim().split(/\s+/); return { h, chain, nudge }; });

  /* ---------- Formatting and derived numbers ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const minus = s => s.replace(/^-/, "−");
  const nd = (x, d) => { const s = x.toFixed(d); return minus(/^-0\.?0*$/.test(s) ? s.slice(1) : s); };
  const sg = (x, d) => (x > 0 && +x.toFixed(d) !== 0 ? "+" : "") + nd(x, d); // signed, for slopes and changes
  const n2 = x => String(+x.toFixed(2));
  const SH = NUDGE_H.slope, SL = NUDGE_L.slope;            // the two slopes from screen 1
  const gvec = (g, d) => `(${nd(g[0], d)}, ${nd(g[1], d)})`;
  const norm = g => Math.hypot(g[0], g[1]);
  const est = (g, dh, dl) => g[0] * dh + g[1] * dl;         // change predicted by the slopes for a small step
  const dirWord = (dh, dl) => `heater ${dh > 0 ? "up" : "down"}, lamp ${dl > 0 ? "up" : "down"}`;
  const RATIO = Math.abs(DIRS.minus.step[1] / DIRS.minus.step[0]);

  /* ---------- Lesson-local styles ---------- */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}map { width: 100%; max-width: 460px; margin: 12px 0 0; }
      .${P}map svg { display: block; width: 100%; height: auto; overflow: visible; }
      .${P}map .ring { fill: none; stroke: var(--ink-2); stroke-width: 0.35; }
      .${P}map .ring.in1 { stroke-width: 0.6; }
      .${P}map .rl { fill: var(--muted); font: 600 3px var(--mono); }
      .${P}map .frame { fill: var(--surface); stroke: var(--line); stroke-width: 0.4; }
      .${P}map .tk { fill: var(--muted); font: 500 3px var(--mono); }
      .${P}map .axl { fill: var(--ink-2); font: 600 3.2px var(--font); }
      .${P}map .dot { fill: var(--surface); stroke: var(--ink); stroke-width: 0.9; }
      .${P}map .dot.ring2 { stroke-width: 1.4; }
      .${P}map .ar { stroke: var(--ink); stroke-width: 0.7; fill: none; }
      .${P}map .ar.good { stroke: var(--good); stroke-width: 1; }
      .${P}map .ar.no { stroke: var(--bad); stroke-width: 1; }
      .${P}map .ar.faint { opacity: 0.35; }
      .${P}map .ar.dash { stroke-dasharray: 1.6 1; }
      .${P}map .ah { fill: var(--ink); }
      .${P}map .ah.good { fill: var(--good); }
      .${P}map .ah.no { fill: var(--bad); }
      .${P}map .ah.faint { opacity: 0.35; }
      .${P}map .al { fill: var(--ink); font: 700 3.6px var(--font); }
      .${P}cap { font: 500 13px/1.4 var(--font); color: var(--muted); margin: 6px 0 0; }
      .${P}t { border-collapse: collapse; margin: 14px 0 0; font: 500 14.5px var(--mono); max-width: 100%; }
      .${P}t caption { text-align: left; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; padding-bottom: 6px; }
      .${P}t th { text-align: right; font: 600 12.5px var(--font); color: var(--muted); padding: 4px 9px 6px; border-bottom: 2px solid var(--ink); }
      .${P}t td { text-align: right; padding: 6px 9px; border-bottom: 1px solid var(--line); color: var(--ink); }
      .${P}t td:first-child, .${P}t th:first-child { text-align: left; font-family: var(--font); }
      .${P}t tr.on td { background: var(--sunk); font-weight: 700; }
      .${P}rule { margin: 14px 0 0; padding: 10px 14px; border-left: 3px solid var(--ink); background: var(--sunk); font: 600 15px/1.6 var(--mono); overflow-wrap: anywhere; }
      .${P}out { font: 500 13.5px/1.5 var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin: 10px 0 0; white-space: pre; overflow-x: auto; }
      .${P}opt { font: 500 14px/1.45 var(--mono); overflow-wrap: anywhere; }
      .${P}chain { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 14px 0 0; font: 600 15px var(--font); }
      .${P}chain .box { border: 1.5px solid var(--ink); border-radius: 6px; padding: 8px 10px; background: var(--surface); }
      .${P}chain .lnk { font: 600 13.5px var(--mono); color: var(--ink-2); }
      @media (max-width: 480px) { .${P}t { font-size: 13px; } .${P}t th, .${P}t td { padding: 5px 6px; } .${P}rule { font-size: 14px; } }
    `;
    document.head.appendChild(s);
  }

  /* ---------- The contour map: heater across (0 to 10), lamp hours up (3 to 11) ----------
     Rings join settings with the same shortfall. It comes from the model's formula in greenhouse.py:
     shortfall = kAir × (airPerStep × (heater − hBest))² + kLamp × (lamp − lampBest)², an ellipse for each level. */
  const H0 = 0, H1 = 10, L0 = 3, L1 = 11, X0 = 12, Y0 = 3, U = 8.4;   // U: svg units per dial unit, same both ways
  const W = (H1 - H0) * U, HT = (L1 - L0) * U;
  const sx = h => X0 + (h - H0) * U, sy = l => Y0 + (L1 - l) * U;
  const H_BEST = (MODEL.best - MODEL.airBase) / MODEL.airPerStep;
  const A_H = MODEL.kAir * MODEL.airPerStep ** 2;   // shortfall per (heater step)², from the formula
  const LEVELS = [2, 6, 12, 20, 30];
  let mapN = 0;
  // dots: [{ h, l, label, cls }]; arrows: [{ h, l, dh, dl, scale, label, cls }]
  function map({ dots = [], arrows = [], title = "" } = {}) {
    const m = P + "m" + (++mapN);
    let g = `<defs><clipPath id="${m}c"><rect x="${X0}" y="${Y0}" width="${W}" height="${HT}"/></clipPath>`;
    for (const c of ["", "good", "no", "faint"]) g += `<marker id="${m}a${c}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path class="ah ${c}" d="M0,0 L6,3 L0,6 z"/></marker>`;
    g += `</defs><rect class="frame" x="${X0}" y="${Y0}" width="${W}" height="${HT}"/><g clip-path="url(#${m}c)">`;
    LEVELS.forEach((c, i) => {
      g += `<ellipse class="ring${i === 0 ? " in1" : ""}" cx="${sx(H_BEST)}" cy="${sy(MODEL.lampBest)}" rx="${Math.sqrt(c / A_H) * U}" ry="${Math.sqrt(c / MODEL.kLamp) * U}"/>`;
      const ty = sy(MODEL.lampBest + Math.sqrt(c / MODEL.kLamp));
      if (ty > Y0 + 2) g += `<text class="rl" x="${sx(H_BEST)}" y="${ty - 0.8}" text-anchor="middle">${c}</text>`;
    });
    g += `</g>`;
    for (let h = H0; h <= H1; h += 2) g += `<text class="tk" x="${sx(h)}" y="${Y0 + HT + 4}" text-anchor="middle">${h}</text>`;
    for (let l = L0; l <= L1; l += 2) g += `<text class="tk" x="${X0 - 1.5}" y="${sy(l) + 1}" text-anchor="end">${l}</text>`;
    g += `<text class="axl" x="${X0 + W / 2}" y="${Y0 + HT + 8.6}" text-anchor="middle">heater setting →</text>`;
    g += `<text class="axl" x="3" y="${Y0 + HT / 2}" text-anchor="middle" transform="rotate(-90 3 ${Y0 + HT / 2})">lamp hours →</text>`;
    for (const a of arrows) {
      const x1 = sx(a.h), y1 = sy(a.l), x2 = sx(a.h + a.dh * a.scale), y2 = sy(a.l + a.dl * a.scale);
      g += `<line class="ar ${a.cls || ""}${a.dash ? " dash" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#${m}a${a.cls || ""})"/>`;
      if (a.label) {
        const len = Math.hypot(x2 - x1, y2 - y1), ox = (x2 - x1) / len * 3.4, oy = (y2 - y1) / len * 3.4;
        const [lx, ly] = a.lo || [0, 0];
        g += `<text class="al" x="${x2 + ox + lx}" y="${y2 + oy + 1.3 + ly}" text-anchor="middle">${esc(a.label)}</text>`;
      }
    }
    for (const d of dots) {
      g += `<circle class="dot ${d.cls || ""}" cx="${sx(d.h)}" cy="${sy(d.l)}" r="1.6"/>`;
      if (d.label) g += `<text class="al" x="${sx(d.h) + 2.6}" y="${sy(d.l) - 2.2}">${esc(d.label)}</text>`;
    }
    return `${title ? `<div class="lp-cap">${esc(title)}</div>` : ""}<div class="${P}map"><svg viewBox="0 0 ${X0 + W + 4} ${Y0 + HT + 11}" role="img" aria-label="Contour map of the shortfall: heater setting across, lamp hours up">${g}</svg></div>`;
  }
  const table = (head, rows, { title = "", on = -1 } = {}) =>
    `<table class="${P}t">${title ? `<caption>${esc(title)}</caption>` : ""}<thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === on ? ' class="on"' : ""}>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const ask = (kit, opts, correct, picked, fb) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;

  /* 1. The situation: two dials, nudge one at a time. */
  function nudge({ el, done, kit }) {
    css();
    let q = 0, wrong = null;
    const Q = [
      { n: NUDGE_H, dial: "heater", s: SH, task: "The heater went from 4 to 4.01 and the lamp stayed at 9. What is the shortfall's slope for the heater (change ÷ nudge)?" },
      { n: NUDGE_L, dial: "lamp", s: SL, task: "The lamp went from 9 to 9.01 and the heater stayed at 4. What is the shortfall's slope for the lamp?" }
    ];
    const optsFor = c => {
      const raw = [[c.s, true], [-c.s, "sign"], [c.n.change, "nodiv"]];
      const rot = q === 0 ? 1 : 2;
      return raw.slice(rot).concat(raw.slice(0, rot));
    };
    const say = (why, c) => ({
      sign: `Check the sign. The shortfall went ${c.n.change < 0 ? "down" : "up"}, from ${n2(START.shortfall)} to ${nd(c.n.shortfall, 5)}, when the ${c.dial} went up. A slope ${c.n.change < 0 ? "is negative when more of the input means less of the output" : "is positive when more of the input means more of the output"}.`,
      nodiv: `That is the change itself, ${sg(c.n.change, 5)}, for a nudge of 0.01. The slope is change per one unit of the dial: ${sg(c.n.change, 5)} ÷ 0.01.`
    })[why];
    const paint = () => {
      const fin = q >= Q.length, c = Q[Math.min(q, 1)], opts = fin ? [] : optsFor(c), right = opts.findIndex(o => o[1] === true);
      const rows = [
        ["now", "4", "9", n2(START.shortfall), "", ""],
        ["heater +0.01", "4.01", "9", nd(NUDGE_H.shortfall, 5), sg(NUDGE_H.change, 5), q > 0 ? sg(SH, 3) : "?"],
        ["lamp +0.01", "4", "9.01", nd(NUDGE_L.shortfall, 5), sg(NUDGE_L.change, 5), q > 1 ? sg(SL, 3) : "?"]
      ];
      el.innerHTML = `<h1>A greenhouse with two dials</h1>
        <p class="lead">A grower has two dials: the <b>heater</b> setting (0 to 10) and the <b>lamp</b> hours per day. The heater sets the air temperature; the air and the light set how much the plants grow. Her target is ${MODEL.target} mm of growth a week. Today the plants grow ${n2(START.growth)} mm, so the <b>shortfall</b> is ${n2(START.shortfall)} mm. She wants it as low as possible. (The greenhouse is a small model we wrote; every number below comes from running it.)</p>
        <p class="lead">Training an AI model is the same problem with millions of dials: find which way to turn each one so that one error number goes down. Here there are only two.</p>
        <p class="lead">With one input you found a slope by nudging it a little. Now there are two. Nudge one dial and hold the other still. Then do the same for the other dial.</p>
        ${table(["", "heater", "lamp", "shortfall", "change", "slope"], rows, { on: fin ? -1 : q + 1 })}
        ${fin ? "" : `<p class="task">${c.task}</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`Two dials, two slopes. The heater's slope is <b>${sg(SH, 3)}</b>: turning it up lowers the shortfall. The lamp's is <b>${sg(SL, 3)}</b>: turning it up raises the shortfall, and about ${n2(SL / -SH)} times as fast. Each one is a slope with the other input held still, called a <b>partial derivative</b>. Written together as one list, <b>${gvec([SH, SL], 3)}</b>, they are the <b>gradient</b>: a vector with one slope per input.`, true)
          : `${kit.options(opts.map(o => sg(o[0], o[1] === "nodiv" ? 5 : 3)), { picked: wrong, correct: right, num: true })}${wrong != null ? kit.feedback(say(opts[wrong][1], c), false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== right) { wrong = i; paint(); return; }
        wrong = null; q++; paint();
        if (q >= Q.length) done();
      });
    };
    paint();
  }

  /* 2. By hand on the map: which small step goes downhill most? */
  function pickArrow({ el, done, kit }) {
    css();
    let ans = null;
    const LET = ["A", "B", "C", "D"];
    const right = ARROWS.findIndex(a => a[3] === Math.min(...ARROWS.map(x => x[3])));
    const fb = ARROWS.map(([dh, dl, s, ch], i) => {
      const e = est([SH, SL], dh, dl);
      if (i === right) return [`Right. Step ${LET[i]} takes the shortfall from ${n2(START.shortfall)} to ${nd(s, 3)} (${sg(ch, 3)}). The slopes predicted it: ${sg(SH, 3)} × ${dh} + ${sg(SL, 3)} × (${dl}) = ${sg(e, 3)}. That is close to the real ${sg(ch, 3)} because the step is small. All four steps from the run: ${ARROWS.map(([, , , c], j) => `${LET[j]} ${sg(c, 3)}`).join(", ")}.`, true];
      if (ch < 0) return [`${LET[i]} does go downhill: ${n2(START.shortfall)} → ${nd(s, 3)}. Lamp down helps a lot (slope ${sg(SL, 3)}), but heater down hurts (slope ${sg(SH, 3)}), so it gives part of the gain back: about ${sg(e, 3)}. One step does better by moving both dials the helpful way.`, false];
      return [`${LET[i]} goes uphill: ${n2(START.shortfall)} → ${nd(s, 3)}. ${dl > 0 ? `Lamp up costs a lot, because its slope is ${sg(SL, 3)}.` : ""} ${dh < 0 ? `Heater down costs too (slope ${sg(SH, 3)}).` : `Heater up helps only ${nd(-SH * dh, 3)}.`} The slopes predict about ${sg(e, 3)}.`, false];
    });
    const paint = () => {
      const arrows = ARROWS.map(([dh, dl], i) => ({ h: START.heater, l: START.lamp, dh, dl, scale: 10, label: LET[i], cls: ans == null ? "" : ans === right ? (i === right ? "good" : "faint") : i === ans ? "no" : "" }));
      el.innerHTML = `<h1>Which way is downhill?</h1>
        <p class="lead">This map shows the shortfall for every setting of the two dials. Each ring joins settings with the same shortfall, written on the ring. The ringed dot is the grower: heater ${START.heater}, lamp ${START.lamp}, shortfall ${n2(START.shortfall)}. Downhill means a lower shortfall. The arrows are four small steps: 0.1 on each dial, drawn ten times longer so you can see them.</p>
        <p class="task">Use the two slopes, heater ${sg(SH, 3)} and lamp ${sg(SL, 3)}. Which step lowers the shortfall the most?</p>
        ${map({ dots: [{ h: START.heater, l: START.lamp, cls: "ring2" }], arrows })}
        <div class="lpanel">${ask(kit, ARROWS.map(([dh, dl], i) => `${LET[i]}: ${dirWord(dh, dl)}`), right, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: the steepest step is minus the gradient. */
  function spot({ el, done, kit }) {
    css();
    let ans = null;
    const nG = norm(GRAD);
    const opts = [
      "Turn both dials by the same amount: heater up, lamp down",
      `Turn each dial the opposite way to its slope, more for the steeper one: lamp down about ${n2(RATIO)} times as much as heater up`,
      `Head straight for the middle of the rings (heater ${BEST_KNOWN.heater}, lamp ${BEST_KNOWN.lamp})`
    ];
    const fb = [
      [`Equal turns use both dials, but they spend half the step on the heater, the dial whose slope is smaller. The run: this step lowers the shortfall by ${nd(DIRS.equal.drop, 3)}. The proportional step lowers it by ${nd(DIRS.minus.drop, 3)}.`, false],
      [`Right. The run: a step of length 0.5 this way lowers the shortfall by <b>${nd(DIRS.minus.drop, 3)}</b>. Equal turns: ${nd(DIRS.equal.drop, 3)}. Straight at the middle: ${nd(DIRS.best.drop, 3)}. The gradient ${gvec(GRAD, 3)} points the way the shortfall rises fastest. <b>Minus the gradient</b> points the way it falls fastest. Its length, ${n2(nG)}, says how steep that is. It points downhill here, not at the bottom.`, true],
      [`On a real model there is no map: nobody can draw one for millions of inputs, and finding the bottom is the whole problem. Even here, the straight line to the middle is not the steepest way from this spot. The run: it lowers the shortfall by ${nd(DIRS.best.drop, 3)}, against ${nd(DIRS.minus.drop, 3)} for the proportional step.`, false]
    ];
    const paint = () => {
      const k = [["equal", "1"], ["minus", "2"], ["best", "3"]];
      const arrows = ans !== 1 ? [] : k.map(([d, lab], i) => ({ h: START.heater, l: START.lamp, dh: DIRS[d].step[0], dl: DIRS[d].step[1], scale: 6, label: lab, cls: i === 1 ? "good" : "", dash: d === "best", lo: d === "best" ? [2.2, -2.6] : null }));
      el.innerHTML = `<h1>The steepest way down</h1>
        <p class="lead">To compare directions fairly, every step below moves the same distance on the map, 0.5, even when the two dials move by different amounts. The slopes are heater ${sg(GRAD[0], 3)} and lamp ${sg(GRAD[1], 3)}. They were measured with a smaller nudge this time, 0.001, so they are a little more accurate.</p>
        <p class="task">Which direction lowers the shortfall the most for a step of length 0.5?</p>
        ${map({ dots: [{ h: START.heater, l: START.lamp, cls: "ring2" }], arrows })}
        ${ans !== 1 ? "" : `<p class="${P}cap">The three steps, drawn six times longer: 1 equal turns, 2 proportional, 3 straight at the middle (dashed).</p>`}
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it: predict the gradient's signs at three other settings from the map. */
  function predict({ el, done, kit }) {
    css();
    let q = 0, wrong = null;
    const OPTS = ["heater slope +, lamp slope −", "heater slope −, lamp slope +", "heater slope −, lamp slope about 0", "both slopes about 0"];
    const RIGHT = [0, 3, 2];
    const why = (p, i) => {
      const [gh, gl] = p.gradient, air = MODEL.airBase + MODEL.airPerStep * p.heater;
      const heaterTxt = Math.abs(gh) < 0.01 ? `At heater ${p.heater} the air is ${air} °C, the best for these plants, so a small heater change does almost nothing: slope ${sg(gh, 4)}.`
        : gh > 0 ? `At heater ${p.heater} the air is ${air} °C, warmer than the plants like. More heat makes the shortfall worse, so the heater slope is + (the run: ${sg(gh, 3)}).`
        : `At heater ${p.heater} the air is only ${air} °C. More heat helps, so the heater slope is − (the run: ${sg(gh, 3)}).`;
      const lampTxt = Math.abs(gl) < 0.01 ? `Lamp ${p.lamp} sits level with the middle of the rings, so a small lamp change barely moves the shortfall: slope ${sg(gl, 4)}.`
        : gl < 0 ? `Lamp ${p.lamp} is below the middle of the rings. More light lowers the shortfall, so the lamp slope is − (the run: ${sg(gl, 3)}).`
        : `More light raises the shortfall here (the run: ${sg(gl, 3)}).`;
      if (i !== 3) return `${heaterTxt} ${lampTxt}`;
      return Math.abs(gl) < 0.01 ? `The lamp slope is about 0 here, but the heater slope is not: ${sg(gh, 3)}. ${heaterTxt}`
        : `Both slopes are far from zero here: ${gvec(p.gradient, 3)}. ${heaterTxt}`;
    };
    const paint = () => {
      const fin = q >= POINTS.length, p = POINTS[Math.min(q, POINTS.length - 1)];
      const shown = POINTS.slice(0, fin ? POINTS.length : q + 1);
      const arrows = POINTS.slice(0, q).filter(x => norm(x.gradient) > 0.01).map(x => { const g = x.gradient, n = norm(g); return { h: x.heater, l: x.lamp, dh: -g[0] / n, dl: -g[1] / n, scale: 1.4, cls: "good" }; });
      el.innerHTML = `<h1>Read the slopes off the map</h1>
        <p class="lead">Three other settings. On the map, right is heater up and up is lamp up. A slope is + when moving that dial up reaches a ring with a bigger number, and − when it reaches a ring with a smaller number. Once you answer, the real gradient from the run appears, and an arrow shows minus the gradient: the steepest way down.</p>
        ${map({ dots: shown.map((x, i) => ({ h: x.heater, l: x.lamp, label: "PQR"[i], cls: i === q ? "ring2" : "" })), arrows })}
        ${table(["", "heater", "lamp", "shortfall", "gradient"], shown.map((x, i) => ["PQR"[i], String(x.heater), String(x.lamp), n2(x.shortfall), i < q ? gvec(x.gradient, 4) : "?"]), { on: fin ? -1 : q })}
        ${fin ? "" : `<p class="task">At ${"PQR"[q]} (heater ${p.heater}, lamp ${p.lamp}), what signs does the gradient have?</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`At P the steepest way down is heater down and lamp up, the opposite of the grower's spot. At Q, the bottom, both slopes are almost 0: no small step lowers the shortfall. They are not exactly 0, because a nudge of 0.001 is small but not zero. At R only the heater matters. A gradient of about zero is how you know you are at a flat spot.`, true)
          : `${kit.options(OPTS, { picked: wrong, correct: RIGHT[q] })}${wrong != null ? kit.feedback(why(p, wrong), false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== RIGHT[q]) { wrong = i; paint(); return; }
        wrong = null; q++; paint();
        if (q >= POINTS.length) done();
      });
    };
    paint();
  }

  /* 5. From scratch in Python: a stepped replay of the traced nudge_gradient(). */
  const FR = TRACE.map(([line, event, vars, calls]) => ({ line, event, vars, calls }));
  // each frame explains the line that has just run: the trace stops before f.line
  const sayFrame = (f, i) => {
    const v = f.vars;
    if (i === 0) return `<code>shortfall</code> is the greenhouse model: give it two dial settings, it returns the shortfall. The function starts with heater ${v.heater}, lamp ${v.lamp}.`;
    if (f.event === "return") return `It returns both slopes in one NumPy array: <b>${gvec([v.slope_heater, v.slope_lamp], 4)}</b>, the gradient. That took <b>${f.calls}</b> runs of the model for 2 dials.`;
    return ({
      2: () => `nudge = ${v.nudge}: how far each dial moves.`,
      3: () => `base = ${n2(v.base)}: the shortfall where the grower is now. That is run ${f.calls} of the model.`,
      4: () => `up_h = ${nd(v.up_h, 5)}: heater nudged, lamp held still. Model runs so far: ${f.calls}.`,
      5: () => `up_l = ${nd(v.up_l, 5)}: lamp nudged, heater held still. Model runs so far: ${f.calls}.`,
      6: () => `slope_heater = (${nd(v.up_h, 5)} − ${n2(v.base)}) ÷ ${v.nudge} = ${sg(v.slope_heater, 4)}. No new run: this is arithmetic.`,
      7: () => `slope_lamp = (${nd(v.up_l, 5)} − ${n2(v.base)}) ÷ ${v.nudge} = ${sg(v.slope_lamp, 4)}.`,
      8: () => `The two slopes go into one list, the gradient.`
    })[f.line]?.() || "";
  };
  function scratch({ el, done, kit }) {
    css();
    let i = 0, ans = null;
    const DIALS = 1000;
    const opts = [`${(DIALS + 1).toLocaleString("en")}`, "2", `${(DIALS * DIALS).toLocaleString("en")}`];
    const fb = [
      [`Right. One run for <code>base</code>, then one more run per input, each with only that input nudged: ${DIALS.toLocaleString("en")} + 1. That is the price of nudging, and why it is used to check gradients rather than to compute them for big models.`, true],
      [`The function makes one extra call per input: one nudged run per dial, each with its own nudge. Two dials took ${FR[FR.length - 1].calls} runs. ${DIALS.toLocaleString("en")} dials need ${DIALS.toLocaleString("en")} nudged runs plus the base.`, false],
      [`Each input is nudged once, on its own, not once per pair of inputs. It is one extra run per input plus the base: ${(DIALS + 1).toLocaleString("en")}.`, false]
    ];
    const paint = () => {
      const f = FR[i], fin = i === FR.length - 1;
      // the highlighted line is the one that has just run (the trace stops before f.line); on the return frame, the return line
      el.innerHTML = `<h1>The nudges in Python</h1>
        <p class="lead">The same two nudges, written once as a function you can reuse for any setting. This replays a real run at heater ${START.heater}, lamp ${START.lamp}.</p>
        <p class="task">Step through it to the end, and answer the question below.</p>
        ${kit.code(CODE5, f.event === "return" ? f.line : f.line - 1)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${fin ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>model runs <b>${f.calls}</b></span><span>base <b>${f.vars.base == null ? "–" : n2(f.vars.base)}</b></span><span>slope_heater <b>${f.vars.slope_heater == null ? "–" : sg(f.vars.slope_heater, 4)}</b></span><span>slope_lamp <b>${f.vars.slope_lamp == null ? "–" : sg(f.vars.slope_lamp, 4)}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(f, i))}
        <p class="task">A model has ${DIALS.toLocaleString("en")} inputs instead of 2. Nudging the same way, one input at a time, how many runs of the model does one gradient need?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1 && ans === 0) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0 && i === FR.length - 1) done(); });
    };
    paint();
  }

  /* 6. Idea 2 by hand: multiply the slopes of a chain. */
  function chainHand({ el, done, kit }) {
    css();
    let ans = null;
    const c = CHAIN[0], prod = c.airPerHeater * c.growthPerAir;
    const opts = [
      `${n2(c.airPerHeater)} + ${nd(c.growthPerAir, 3)} = ${nd(c.airPerHeater + c.growthPerAir, 3)}`,
      `${n2(c.airPerHeater)} × ${nd(c.growthPerAir, 3)} = ${nd(prod, 3)}`,
      `${nd(c.growthPerAir, 3)} ÷ ${n2(c.airPerHeater)} = ${nd(c.growthPerAir / c.airPerHeater, 3)}`
    ];
    const fb = [
      [`Adding mixes units: °C per step plus mm per °C is not mm per step. Think it through: one heater step adds ${n2(c.airPerHeater)} °C, and each °C adds ${nd(c.growthPerAir, 3)} mm.`, false],
      [`Right. One heater step adds ${n2(c.airPerHeater)} °C, and every one of those degrees adds ${nd(c.growthPerAir, 3)} mm, so ${n2(c.airPerHeater)} × ${nd(c.growthPerAir, 3)} = <b>${nd(prod, 3)} mm per heater step</b>. The run nudged the heater and watched the growth at the end of the chain: ${nd(c.growthPerHeaterNudged, 3)}. This is the <b>chain rule</b>: when one step feeds the next, the slope of the whole chain is the product of the slopes of its links. The units show it: °C per step × mm per °C = mm per step. You met this number already: on the first screen the shortfall's heater slope was ${sg(SH, 3)}. Shortfall is target minus growth, so its slope is the same size with the sign flipped.`, true],
      [`Dividing gives mm per °C per (°C per step), which is not the slope you want. Follow one heater step: it adds ${n2(c.airPerHeater)} °C, and each °C adds ${nd(c.growthPerAir, 3)} mm.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The heater works through the air</h1>
        <p class="lead">The grower asks a sharper question: <i>if I turn the heater up one step, how much more do the plants grow?</i> The heater does not touch the plants. It warms the air, and the air changes the growth. The run nudged each link on its own, at heater ${c.heater} (air ${n2(c.air)} °C, lamp ${START.lamp}):</p>
        <div class="${P}chain"><span class="box">heater</span><span class="lnk">${n2(c.airPerHeater)} °C per step →</span><span class="box">air</span><span class="lnk">${nd(c.growthPerAir, 3)} mm per °C →</span><span class="box">growth</span></div>
        <p class="task">Predict the slope of growth per heater step.</p>
        <div class="lpanel">${ask(kit, opts.map(o => `<span class="${P}opt">${esc(o)}</span>`), 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. Use the chain rule with predictions: a hotter greenhouse, then a third link. */
  function chainUse({ el, done, kit }) {
    css();
    let q = 0, wrong = null;
    const c = CHAIN[1], prod = c.airPerHeater * c.growthPerAir;
    const Q = [
      { task: `At heater ${c.heater} the air is ${n2(c.air)} °C, too warm. The run's link slopes: ${n2(c.airPerHeater)} °C per step, then ${nd(c.growthPerAir, 3)} mm per °C. What is the growth slope per heater step?`,
        opts: [`${nd(prod, 3)}`, `${sg(-prod, 3)}`, `${nd(c.airPerHeater + c.growthPerAir, 3)}`], right: 0,
        fb: [null, `The air link is still +${n2(c.airPerHeater)}, but the growth link is now ${nd(c.growthPerAir, 3)}: above the plants' best temperature, warmer air means less growth. A plus times a minus is a minus.`, `That adds the two slopes. Chains multiply: ${n2(c.airPerHeater)} × (${nd(c.growthPerAir, 3)}).`] },
      { task: `Add the third link: shortfall = ${MODEL.target} − growth, so the shortfall falls by 1 mm for every 1 mm of growth (slope −1). At heater ${c.heater}, what is the shortfall slope per heater step?`,
        opts: [`${sg(-prod, 3)}`, `${nd(prod, 3)}`, `${nd(c.airPerHeater * c.growthPerAir - 1, 3)}`], right: 0,
        fb: [null, `That is the growth slope. The shortfall link has slope −1, so multiply once more: ${nd(prod, 3)} × (−1).`, `The −1 is a slope of a link, so it multiplies, like the other two: ${n2(c.airPerHeater)} × (${nd(c.growthPerAir, 3)}) × (−1).`] }
    ];
    const paint = () => {
      const fin = q >= Q.length, x = Q[Math.min(q, Q.length - 1)];
      const rows = [["heater → air", `${n2(c.airPerHeater)} °C per step`], ["air → growth", `${nd(c.growthPerAir, 3)} mm per °C`], ["growth → shortfall", "−1"]].slice(0, q >= 1 ? 3 : 2);
      el.innerHTML = `<h1>Turn the heater up further</h1>
        <p class="lead">Same greenhouse, lamp still ${START.lamp}, heater now ${c.heater}. A link's slope can change when its input changes. So read each slope at today's values: the growth link at ${n2(c.air)} °C, not at ${n2(CHAIN[0].air)} °C.</p>
        ${table(["link", "slope here"], rows)}
        ${fin ? "" : `<p class="task">${x.task}</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`Right. Three links, three slopes, one product: ${n2(c.airPerHeater)} × (${nd(c.growthPerAir, 3)}) × (−1) = <b>${sg(-prod, 3)}</b>. The run nudged the heater and watched the shortfall: ${sg(c.shortfallPerHeaterNudged, 3)}. At heater ${CHAIN[0].heater} turning the heater up lowered the shortfall; at heater ${c.heater} it raises it. Only the air link's slope stayed the same. A chain can be as long as you like, and a neural network is a long one: each layer feeds the next.`, true)
          : `${kit.options(x.opts, { picked: wrong, correct: x.right, num: true })}${wrong != null ? kit.feedback(x.fb[wrong], false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== Q[q].right) { wrong = i; paint(); return; }
        wrong = null; q++; paint();
        if (q >= Q.length) done();
      });
    };
    paint();
  }

  /* 8. Broken on purpose: a chain-rule slope that disagrees with the nudge check. */
  function broken({ el, done, kit }) {
    css();
    let q = 0, wrong = null;
    const lines = [1, 2, 3, 4];
    const Q = [
      { task: "The two columns should agree, and they do not. Which column do you trust, and why?",
        opts: ["The chain rule column: it is exact, nudging is only an estimate", "The nudge check: it only runs the model, so there is no formula to get wrong", "Neither: at the last setting both should be zero"], right: 1,
        fb: [`The chain rule is exact only if the slopes were written correctly. A nudge is off by a little (at heater ${B8[2].h}: ${minus(B8[2].nudge)} where the true slope is 0), not a gap like ${minus(B8[1].chain)} against ${minus(B8[1].nudge)}. A gap this big means a mistake in the formula.`, null,
          `Both should be about zero at heater ${B8[2].h}, and the nudge check is (${minus(B8[2].nudge)}). Only the chain-rule column is off, so trust the nudge check. The chain rule says ${minus(B8[2].chain)} there. And at heater ${B8[1].h}, ${minus(B8[1].chain)} against ${minus(B8[1].nudge)}; you worked out ${nd(CHAIN[0].airPerHeater * CHAIN[0].growthPerAir, 3)} yourself on screen 6.`] },
      { task: `Here is the colleague's function. The plants grow best at ${MODEL.best} °C of air. Which line is the bug?`,
        opts: lines.map(l => `<span class="${P}opt">${esc(CODE8[l].trim())}</span>`), right: lines.indexOf(BUG_LINE),
        fb: lines.map(l => l === BUG_LINE ? null : ({
          1: "This computes the air temperature, the point where the air → growth link is working. It is correct; the question is whether the next lines use it.",
          2: `1.5 °C per heater step is the slope the run measured for the heater → air link (${n2(CHAIN[0].airPerHeater)}). Correct.`,
          4: "Multiplying the two link slopes is the chain rule. The product is right; one of the numbers going into it is not."
        }[l])) }
    ];
    const paint = () => {
      const fin = q >= Q.length, x = Q[Math.min(q, Q.length - 1)];
      el.innerHTML = `<h1>A slope that does not check out</h1>
        <p class="lead">A colleague wrote the growth-per-heater slope with the chain rule, so the grower does not need to nudge. To test it, he compares it with a nudge check (nudge 0.001) at three heater settings. The <code>chain_rule</code> column is his formula. The <code>nudge_check</code> column is the slope found by nudging. This is his real output:</p>
        <div class="${P}out">${esc(OUT8.join("\n"))}</div>
        ${q >= 1 ? kit.code(CODE8, fin ? BUG_LINE : -1) : ""}
        ${fin ? `<div class="${P}out">${esc(OUT8_FIXED.join("\n"))}</div>` : ""}
        ${fin ? "" : `<p class="task">${x.task}</p>`}
        <div class="lpanel">${fin
          ? kit.feedback(`Right. The air → growth slope must be read at the <b>air temperature</b>, but line ${BUG_LINE} uses the heater setting: <code>heater - 24</code> instead of <code>air - 24</code>. The fix is that one word, and the rerun above agrees with the nudge check. This is a common chain-rule slip: each link's slope must be read at that link's own input, the value the link before it produced. Writing slopes by formula is fast and exact but easy to get wrong; the nudge check is slow but hard to get wrong. That is why people use one to check the other, a <b>gradient check</b>.`, true)
          : `${kit.options(x.opts, { picked: wrong, correct: x.right })}${wrong != null ? kit.feedback(x.fb[wrong], false) : ""}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== Q[q].right) { wrong = i; paint(); return; }
        wrong = null; q++; paint();
        if (q >= Q.length) done();
      });
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "Each gradient would need about ten million and one runs of the model",
      "Nudging gives the wrong sign when there are many inputs",
      "Nudging only works for models with two inputs"
    ];
    const fb = [
      ["Right. One extra run per input, for every gradient, and training needs very many gradients. Libraries instead apply the chain rule through the model's steps (backpropagation, done for you by tools such as PyTorch's autograd). Nudging stays useful to check such a gradient on a few inputs.", true],
      ["Nudging gives each slope with the same small error however many inputs there are. Its problem is not accuracy, it is the number of runs.", false],
      ["Nudging works for any number of inputs: you nudge them one at a time. The catch is what that costs.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What it is for:</b> the gradient tells you, for every input at once, which way and how steeply the output moves. Training a model means lowering a loss (one number for how wrong it is). So training needs the gradient of the loss for every weight (the numbers a model tunes).</p>
        <p class="lead"><b>When:</b> nudging fits a handful of inputs, a model you can only run, and checking a gradient written by formula. The chain rule gives exact slopes through steps that feed each other. Libraries compute gradients this way.</p>
        <p class="lead"><b>When not:</b> choices with no in-between (a number of fans, which supplier). There is nothing to nudge, so try the options. Also noisy measurements: the noise hides a small nudge's effect.</p>
        <p class="lead"><b>Costs:</b> nudging takes one model run per input and is slightly off. A formula is fast but easy to get wrong.</p>
        <p class="task">A model has about ten million weights (the numbers a model tunes). Why do training libraries not get its gradient by nudging each weight?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six"];
  const OVEN_CRUST = 0.4, CRUST_SCORE = -0.5, PRICE_INPUTS = 3;   // the scenarios' given numbers
  const OVEN_SCORE = nd(OVEN_CRUST * CRUST_SCORE, 1), CHAIN_TXT = `${OVEN_CRUST} × (${nd(CRUST_SCORE, 1)}) = ${OVEN_SCORE} points per degree`;
  const IN3 = WORDS[PRICE_INPUTS], RUNS3 = WORDS[PRICE_INPUTS + 1];   // one base run plus one nudge per input
  const CASES = [
    [`A bakery knows two slopes: one more degree of oven heat darkens the crust by ${OVEN_CRUST} shade points, and one more shade point lowers the taste panel's score by ${-CRUST_SCORE}. The baker wants the score's slope per oven degree.`, true,
      `Yes. The oven feeds the crust, the crust feeds the score: a chain. Multiply the links: ${CHAIN_TXT}. Hotter costs score here.`,
      `The oven does not touch the score directly. It works through the crust, so the slopes chain: ${CHAIN_TXT}.`],
    ["A school chooses one of four textbooks for next year and has last year's exam results for each.", false,
      "No. There is nothing between textbook B and textbook C to nudge towards, so no slope exists. With four options, compare the four results directly.",
      "A slope needs an input you can change by a small amount. A choice among four named books has no in-between; compare the four options instead."],
    [`A price model scores a product's weekly profit from ${IN3} numbers (price, ad budget, discount) with a smooth formula you can run as often as you like. The manager wants to know which way to move all ${IN3}.`, true,
      `Yes. Nudge each of the ${IN3} on its own: ${RUNS3} runs of the model (the base plus one nudge each) give the gradient. Plus the gradient is the way profit rises fastest, the mirror of going down the shortfall.`,
      `${IN3[0].toUpperCase() + IN3.slice(1)} smooth inputs and a model you can run cheaply: ${RUNS3} runs (the base plus one nudge each) give the gradient, which says how to move all ${IN3} at once.`],
    ["A farm wants the slope of yield per kilogram of fertiliser. Each trial takes a whole season, and the yield of the same field changes by about a tenth from year to year with the weather alone.", false,
      "No. A small nudge in fertiliser changes the yield far less than the weather does, so the measured change is mostly noise, and each nudge costs a season. Use a designed experiment with clearly different amounts on many plots, and statistics to read it.",
      "Nudging needs a change you can see. Here the weather moves the yield by about a tenth each year, which swamps the effect of a small nudge, and every nudge costs a season."]
  ];

  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Slopes or not?</h1>
        <p class="lead">Four situations away from the greenhouse.</p>
        <p class="task">For each one, decide if a slope (found by nudging, or by chaining slopes) is the right tool. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next. */
  function whatNext({ el, done, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Two dials, one chain</h1>
      <p class="lead">You nudged two dials one at a time and wrote the two slopes as a gradient, picked the steepest way down from it (minus the gradient, not straight at the bottom), read gradients off a map, stepped through a ${CODE5.length}-line <code>nudge_gradient</code>, multiplied slopes along a chain, and caught a chain-rule slope read at the wrong point.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>nudge_gradient</code> for a function of two inputs, then check a chain-rule slope you write by hand against it.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${esc(nx.title)}. A change of subject, from slopes to data: it does not use gradients. They come back in stage 2, where gradient descent uses them to train a model.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Gradients and the chain rule",
    checked: "2026-11-14",
    sources: [
      "https://cs231n.github.io/optimization-1/",
      "https://cs231n.github.io/optimization-2/",
      "https://docs.pytorch.org/docs/stable/autograd.html",
      "https://developers.google.com/machine-learning/crash-course/neural-networks/backpropagation",
      "https://numpy.org/doc/stable/reference/generated/numpy.array.html"
    ],
    interview: [
      {
        q: "You wrote the gradient of a custom loss by hand, and training behaves strangely. How do you find out whether your gradient is right?",
        good: [
          "Run a gradient check: nudge each input a small amount, measure the change in the loss, and compare with the formula's value",
          "Do it on a small input or a few weights, because nudging costs one extra run of the model per input",
          "A small gap is the nudge's own error; a large gap or a flipped sign means a bug in the formula",
          "Check each link of the chain on its own to find the broken one; a common slip is reading a link's slope at the wrong point"
        ],
        weak: "Lower the learning rate or train longer. That treats the symptom and never tests whether the gradient itself is correct."
      },
      {
        q: "A teammate wants to avoid autograd bugs by computing the gradient of a 10-million-weight model by nudging each weight. What do you tell them, and where would nudging still help?",
        good: [
          "Nudging needs one extra run of the model per weight for every gradient, which is hopeless with millions of weights",
          "Nudging is also slightly off, because the nudge has a size",
          "The chain rule multiplies the local slopes of the model's steps (backpropagation) and gives exact slopes",
          "Nudging is still the simple, trusted way to check a hand-written or custom gradient on a few inputs"
        ],
        weak: "Because nudging is inaccurate. It misses the main reason, the cost of one model run per weight, and when nudging is still useful."
      }
    ],
    screens: [nudge, pickArrow, spot, predict, scratch, chainHand, chainUse, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: [...Array(FR.length - 1).fill("[data-next]"), "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
