/* Lesson s1-vectors: Vectors as arrows and as lists of features.
   Story: a sports shop wants to suggest the running shoes most like a customer's worn-out favourite pair.
   Ideas: (1) describe each shoe as a list of feature scores; on two features that list is a point on a grid, and
   the arrow between two shoes is "subtract feature by feature"; its length (square, add, square root) is their
   distance. (2) The same rule works for any number of features, where no picture can follow: that list is a
   vector. Adding features can change which shoe is nearest.
   Data: the shoes and their 1-9 scores are written by us (docs/ai-path/runs/s1-vectors/shoes.py), not real
   products. Code output comes from runs on this Mac (Python 3.12, NumPy 2.5.4, see env.txt):
     docs/ai-path/runs/s1-vectors/scratch.py -> scratch.out.txt (the traced distance() on screen 6, math.dist)
     docs/ai-path/runs/s1-vectors/library.py -> library.out.txt (the NumPy screen 7)
   No model API calls were recorded for this lesson; nothing on it is "not run by us".
   Lesson-local picture and CSS (prefix lx-s1-vectors-): a feature grid drawn as SVG with tappable cells, arrows
   and a number keypad. */
(() => {
  const ID = "s1-vectors", P = "lx-" + ID + "-";

  // shoes.py: scores 1-9, features in this order
  const FEAT = ["weight", "cushioning", "heel drop", "grip"];
  const FAV = [4, 7, 6, 5];
  const SHOES = { A: [4, 2, 8, 8], B: [5, 9, 6, 2], C: [7, 5, 6, 5], D: [8, 8, 5, 4] };
  const KEYS = Object.keys(SHOES);
  const ALL = [["fav", FAV], ...KEYS.map(k => [k, SHOES[k]])];   // placing order on screen 1
  const NAME = k => k === "fav" ? "your favourite" : `shoe ${k}`;

  // scratch.out.txt: trace of distance(CATALOGUE["B"], FAVOURITE), keep = total, a, b, diff (not altered)
  const TRACE = [
    [1, "line", {}], [2, "line", { total: 0 }], [3, "line", { total: 0, a: 5, b: 4 }], [4, "line", { total: 0, a: 5, b: 4, diff: 1 }],
    [2, "line", { total: 1, a: 5, b: 4, diff: 1 }], [3, "line", { total: 1, a: 9, b: 7, diff: 1 }], [4, "line", { total: 1, a: 9, b: 7, diff: 2 }],
    [2, "line", { total: 5, a: 9, b: 7, diff: 2 }], [3, "line", { total: 5, a: 6, b: 6, diff: 2 }], [4, "line", { total: 5, a: 6, b: 6, diff: 0 }],
    [2, "line", { total: 5, a: 6, b: 6, diff: 0 }], [3, "line", { total: 5, a: 2, b: 5, diff: 0 }], [4, "line", { total: 5, a: 2, b: 5, diff: -3 }],
    [2, "line", { total: 14, a: 2, b: 5, diff: -3 }], [5, "line", { total: 14, a: 2, b: 5, diff: -3 }], [5, "return", { total: 14, a: 2, b: 5, diff: -3 }]
  ];
  const TRACE_RESULT = "3.7416573867739413";   // scratch.out.txt: "result", and math.dist gave the same
  const CODE6 = [
    "def distance(shoe_a, shoe_b):",
    "    total = 0",
    "    for a, b in zip(shoe_a, shoe_b):",
    "        diff = a - b",
    "        total += diff * diff",
    "    return math.sqrt(total)"
  ];
  // library.py (without its first comment line) and library.out.txt (not altered)
  const CODE7 = [
    "import numpy as np",
    "",
    "favourite = np.array([4, 7, 6, 5])",
    "catalogue = np.array([[4, 2, 8, 8],   # A",
    "                      [5, 9, 6, 2],   # B",
    "                      [7, 5, 6, 5],   # C",
    "                      [8, 8, 5, 4]])  # D",
    "",
    "diffs = catalogue - favourite",
    "print(diffs.shape)",
    "dists = np.linalg.norm(diffs, axis=1)",
    "print(dists.round(2))",
    "print(np.argmin(dists))",
    "print(np.argsort(dists))",
    "print(np.linalg.norm(diffs).round(2))"
  ];
  const OUT7 = ["(4, 4)", "[6.16 3.74 3.61 4.36]", "2", "[2 1 3 0]", "9.17"];
  const RUN_DATE = "2026-11-13";

  const sub = (p, q) => p.map((v, i) => v - q[i]);
  const sq = d => d.reduce((s, v) => s + v * v, 0);
  const dist = (p, q) => Math.sqrt(sq(sub(p, q)));
  const two = s => s.slice(0, 2);
  const f2 = x => Number.isInteger(x) ? String(x) : x.toFixed(2);
  const sqs = v => v < 0 ? `(${sgn(v)})²` : `${v}²`;   // a square written so a minus is not misread
  const sgn = v => v < 0 ? `−${-v}` : String(v);
  const vec = d => `(${d.map(sgn).join(", ")})`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const fmt = n => n.toLocaleString("en");

  const by2 = KEYS.map(k => [k, dist(two(SHOES[k]), two(FAV))]).sort((x, y) => x[1] - y[1]);
  const by4 = KEYS.map(k => [k, dist(SHOES[k], FAV)]).sort((x, y) => x[1] - y[1]);
  const NEAR2 = by2[0][0], NEAR4 = by4[0][0];

  /* ---------- lesson-local styles ---------- */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}plot { position: relative; width: 100%; max-width: 440px; aspect-ratio: 100 / 130; margin: 12px 0 0; }
      .${P}plot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
      .${P}plot .gl { stroke: var(--line); stroke-width: 0.25; }
      .${P}plot .ax { stroke: var(--ink-2); stroke-width: 0.45; }
      .${P}plot .tk { fill: var(--muted); font: 500 3.3px var(--mono); }
      .${P}plot .dot { fill: var(--surface); stroke: var(--ink); stroke-width: 0.7; }
      .${P}plot .dot.fav { fill: var(--ink); }
      .${P}plot .dot.enter { fill: var(--good-soft); stroke: var(--good); stroke-width: 1.1; }
      .${P}plot .dot.fav.enter { fill: var(--good); }
      .${P}plot .dot.no { fill: var(--bad-soft); stroke: var(--bad); stroke-width: 1.1; }
      .${P}plot .dot.gone { opacity: 0.3; }
      .${P}plot .dot.ghost { fill: none; stroke-dasharray: 1 0.8; }
      .${P}plot .lb { fill: var(--ink); font: 700 3.6px var(--font); }
      .${P}plot .lb.gone { opacity: 0.35; }
      .${P}plot .ar { stroke: var(--ink); stroke-width: 0.8; fill: none; }
      .${P}plot .ar.dash { stroke-dasharray: 1.4 1; stroke-width: 0.6; }
      .${P}plot .ah { fill: var(--ink); }
      .${P}plot button.cl { position: absolute; padding: 0; margin: 0; border: 0; background: transparent; cursor: pointer; border-radius: 4px; min-height: 44px; }
      .${P}plot button.cl:hover, .${P}plot button.cl:focus-visible { outline: 2px solid var(--ink-2); outline-offset: -3px; }
      .${P}key { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 8px 0 0; font: 500 13px/1.4 var(--font); color: var(--muted); }
      .${P}key span { display: inline-flex; align-items: center; gap: 6px; }
      .${P}key svg { width: 14px; height: 14px; flex: none; }
      .${P}key .dot { fill: var(--surface); stroke: var(--ink); stroke-width: 1.6; }
      .${P}key .dot.fav { fill: var(--ink); }
      .${P}cap { font: 500 13px/1.4 var(--font); color: var(--muted); margin: 8px 0 0; }
      .${P}ft { border-collapse: collapse; margin: 12px 0 0; font: 500 14px var(--mono); }
      .${P}ft th, .${P}ft td { padding: 6px 9px; border-bottom: 1px solid var(--line); text-align: right; color: var(--ink); }
      .${P}ft th { font: 600 12.5px var(--font); color: var(--muted); }
      .${P}ft td:first-child, .${P}ft th:first-child { text-align: left; font-family: var(--font); }
      .${P}ft tr.on td { background: var(--sunk); font-weight: 700; }
      .${P}ft tr.d td { color: var(--ink-2); }
      .${P}wrap { overflow-x: auto; max-width: 100%; }
      .${P}pad { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; max-width: 320px; margin: 10px 0 0; }
      .${P}pad button { min-height: 48px; font: 600 18px var(--mono); }
      .${P}pad .wide { grid-column: span 2; font: 600 15px var(--font); }
      .${P}show { font: 600 22px var(--mono); color: var(--ink); min-height: 48px; max-width: 320px; padding: 8px 12px; border: 1.5px solid var(--ink-2); border-radius: 8px; background: var(--surface); margin: 10px 0 0; box-sizing: border-box; }
      .${P}show .ph { color: var(--faint); font-weight: 500; }
      .${P}out { font: 500 14px/1.5 var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin: 10px 0 0; white-space: pre-wrap; }
      .${P}out .p { color: var(--muted); }
      @media (max-width: 480px) { .${P}ft th, .${P}ft td { padding: 5px 6px; font-size: 13px; } }
    `;
    document.head.appendChild(s);
  }

  /* ---------- the feature grid (weight across, cushioning up), drawn as SVG ----------
     shoes: [{ k, p: [w, c], cls }]; pick: cells become buttons data-i="w,c"; arrows: [{ from, to, dash, head }]. */
  const LO = 1, HI = 9, NC = HI - LO + 1, X0 = 10, XW = 88, Y0 = 2, YH = 114;
  const cx = w => X0 + (w - LO + 0.5) * XW / NC, cy = c => Y0 + (HI - c + 0.5) * YH / NC;
  function plot({ shoes = [], pick = false, arrows = [], ghosts = [] } = {}) {
    let g = "";
    for (let i = 0; i <= NC; i++) {
      const x = X0 + i * XW / NC, y = Y0 + i * YH / NC;
      g += `<line class="gl" x1="${x}" y1="${Y0}" x2="${x}" y2="${Y0 + YH}"/><line class="gl" x1="${X0}" y1="${y}" x2="${X0 + XW}" y2="${y}"/>`;
    }
    g += `<line class="ax" x1="${X0}" y1="${Y0 + YH}" x2="${X0 + XW}" y2="${Y0 + YH}"/><line class="ax" x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y0 + YH}"/>`;
    for (let v = LO; v <= HI; v++) g += `<text class="tk" x="${cx(v)}" y="${Y0 + YH + 5}" text-anchor="middle">${v}</text><text class="tk" x="${X0 - 2.5}" y="${cy(v) + 1.2}" text-anchor="end">${v}</text>`;
    g += `<text class="tk" x="${X0 + XW}" y="${Y0 + YH + 11}" text-anchor="end">weight →</text><text class="tk" x="3.6" y="${Y0}" text-anchor="end" transform="rotate(-90 3.6 ${Y0})">cushioning →</text>`;
    const R = 3.2;
    for (const a of arrows) {
      const [x1, y1, x2, y2] = [cx(a.from[0]), cy(a.from[1]), cx(a.to[0]), cy(a.to[1])];
      const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
      const s = a.trim0 === false ? 0 : R, e = a.head ? R + 2.6 : (a.trim1 === false ? 0 : R);
      g += `<line class="ar${a.dash ? " dash" : ""}" x1="${x1 + ux * s}" y1="${y1 + uy * s}" x2="${x2 - ux * e}" y2="${y2 - uy * e}"/>`;
      if (a.head) {
        const tx = x2 - ux * R, ty = y2 - uy * R, bx = tx - ux * 2.8, by = ty - uy * 2.8;
        g += `<polygon class="ah" points="${tx},${ty} ${bx - uy * 1.5},${by + ux * 1.5} ${bx + uy * 1.5},${by - ux * 1.5}"/>`;
      }
    }
    for (const h of ghosts) g += `<circle class="dot ghost" cx="${cx(h.p[0])}" cy="${cy(h.p[1])}" r="${R}"/>${h.label ? `<text class="lb" x="${cx(h.p[0]) + 4}" y="${cy(h.p[1]) - 3.4}">${esc(h.label)}</text>` : ""}`;
    for (const s of shoes) {
      const c = `${s.k === "fav" ? "fav " : ""}${s.cls || ""}`;
      g += `<circle class="dot ${c}" cx="${cx(s.p[0])}" cy="${cy(s.p[1])}" r="${R}"/><text class="lb ${s.cls === "gone" ? "gone" : ""}" x="${cx(s.p[0]) + (s.k === "fav" ? -4 : 4)}" y="${cy(s.p[1]) + (s.k === "fav" ? 6.4 : -3.4)}"${s.k === "fav" ? ' text-anchor="end"' : ""}>${s.k === "fav" ? "fav" : s.k}</text>`;
    }
    let cells = "";
    if (pick) for (let c = HI; c >= LO; c--) for (let w = LO; w <= HI; w++) {
      cells += `<button type="button" class="cl" data-i="${w},${c}" aria-label="weight ${w}, cushioning ${c}" style="left:${(X0 + (w - LO) * XW / NC)}%;top:${(Y0 + (HI - c) * YH / NC) / 130 * 100}%;width:${XW / NC}%;height:${YH / NC / 130 * 100}%"></button>`;
    }
    return `<div class="${P}plot"><svg viewBox="0 0 100 130" aria-hidden="true">${g}</svg>${cells}</div>
      <p class="${P}cap">Across: weight, 1 light to 9 heavy. Up: cushioning, 1 firm to 9 soft. Scores from the shop's sheet.</p>`;
  }
  // legend drawn with the plot's own dot classes, so the swatches match the grid in both themes
  const sw = cls => `<svg viewBox="0 0 14 14" aria-hidden="true"><circle class="dot${cls}" cx="7" cy="7" r="5.5"/></svg>`;
  const key = () => `<div class="${P}key"><span>${sw(" fav")}your favourite (filled)</span><span>${sw("")}a shoe on sale (outlined)</span></div>`;

  // a table of shoes and their feature scores; rows: [[label, values, cls]]
  const ftable = (feats, rows) => `<div class="${P}wrap"><table class="${P}ft"><thead><tr><th>shoe</th>${feats.map(f => `<th>${esc(f)}</th>`).join("")}</tr></thead><tbody>${rows.map(([l, v, c]) => `<tr class="${c || ""}"><td>${l}</td>${v.map(x => `<td>${typeof x === "number" ? sgn(x) : x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

  /* 1. The situation, by hand: put the five shoes on the grid. */
  function place({ el, done, kit }) {
    css();
    let n = 0, msg = null;
    const paint = () => {
      const fin = n === ALL.length;
      const shoes = ALL.slice(0, n).map(([k, s]) => ({ k, p: two(s) }));
      const [k, s] = fin ? [] : ALL[n];
      el.innerHTML = `<h1>Shoes like the old favourite</h1>
        <p class="lead">A customer walks into a running shop with a worn-out favourite pair. That model is no longer made. She asks: "Which of your shoes feels most like this one?" The staff guess from memory and often get it wrong. The shop scores every shoe from 1 to 9 on two things: <b>weight</b> and <b>cushioning</b>. Each score is a <b>feature</b>: one measured property of the shoe. Turning things into numbers and finding the nearest ones is how "more like this" suggestions work, and later in the path, how AI products search text.</p>
        ${ftable(["weight", "cushioning"], ALL.map(([kk, ss], i) => [kk === "fav" ? "favourite" : kk, two(ss), i === n ? "on" : i < n ? "d" : ""]))}
        ${fin ? "" : `<p class="task">Put ${NAME(k)} on the grid: weight ${s[0]}, cushioning ${s[1]}. Tap its square.</p>`}
        ${plot({ shoes, pick: !fin })}
        ${key(kit)}
        <div class="lpanel">${fin ? kit.feedback(`All ${WORDS[ALL.length].toLowerCase()} shoes are on the grid. Each shoe is now a point, and two numbers in a fixed order say where: (weight, cushioning). Shoes that feel alike sit near each other.`, true) : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll(`.${P}plot button.cl`).forEach(b => b.onclick = () => {
        const [x, y] = b.dataset.i.split(",").map(Number), [w, c] = two(ALL[n][1]);
        if (x === w && y === c) { n++; msg = n < ALL.length ? [`${NAME(ALL[n - 1][0])[0].toUpperCase()}${NAME(ALL[n - 1][0]).slice(1)} is at (${w}, ${c}).`] : null; paint(); if (n === ALL.length) done(); return; }
        msg = [x === c && y === w && w !== c ? `You swapped the two scores. That square is weight ${x}, cushioning ${y}. Weight is read across, from left to right, and cushioning up, from the bottom. This shoe goes at weight ${w}, cushioning ${c}.`
          : x === w ? `The weight is right (${w}, across). The cushioning is ${c}, but you tapped row ${y}: count up from the bottom.`
          : y === c ? `The cushioning is right (${c}, up). The weight is ${w}, but you tapped column ${x}: count across from the left.`
          : `That square is weight ${x}, cushioning ${y}. This shoe is weight ${w}, cushioning ${c}: across to ${w}, then up to ${c}.`, false];
        paint();
      });
    };
    paint();
  }

  /* 2. Pick the nearest shoe, then type its distance (Pythagoras). */
  function nearest({ el, done, kit }) {
    css();
    let pick = null, typed = "", tmsg = null, ok2 = false;
    const opts = KEYS.map(k => `Shoe ${k}`), right = KEYS.indexOf(NEAR2);
    const N = SHOES[NEAR2], d = sub(two(N), two(FAV)), across = Math.abs(d[0]), up = Math.abs(d[1]), D = dist(two(N), two(FAV));
    const gapNote = k => {   // name the big gap the learner overlooked
      const g = sub(two(SHOES[k]), two(FAV)).map(Math.abs), lo = g[0] <= g[1] ? 0 : 1, hi = 1 - lo;
      return `Shoe ${k} is only ${g[lo]} off in ${FEAT[lo]}, but ${g[hi]} off in ${FEAT[hi]}; both gaps count. Shoe ${NEAR2} is ${steps(NEAR2)}: neither of its gaps is bigger than ${Math.max(across, up)}.`;
    };
    const steps = k => { const e = sub(two(SHOES[k]), two(FAV)); return `${Math.abs(e[0])} across and ${Math.abs(e[1])} up or down`; };
    const paint = () => {
      const ok1 = pick === right;
      const shoes = ALL.map(([k, s]) => ({ k, p: two(s), cls: ok1 && k === NEAR2 ? "enter" : pick != null && !ok1 && k === KEYS[pick] ? "no" : "" }));
      const arrows = ok1 ? [{ from: two(FAV), to: [N[0], FAV[1]], dash: true, trim1: false }, { from: [N[0], FAV[1]], to: two(N), dash: true, trim0: false }, { from: two(FAV), to: two(N) }] : [];
      el.innerHTML = `<h1>Which shoe is nearest?</h1>
        <p class="lead">The nearer a shoe sits to the favourite on the grid, the more alike the two feel.</p>
        <div class="lcase" id="c0"><p class="task">Which shoe is nearest to the favourite, in a straight line?</p>
        ${plot({ shoes, arrows })}
        ${kit.options(opts, { picked: pick, correct: right })}
        ${pick == null ? "" : ok1 ? kit.feedback(`Right: shoe ${NEAR2} is ${steps(NEAR2)} from the favourite. The dashed lines show those two steps.`, true)
          : kit.feedback(KEYS[pick] === "A" && SHOES.A[0] === FAV[0]
            ? `Shoe A has exactly the favourite's weight, so it looks like a match. But its cushioning is ${SHOES.A[1]} against ${FAV[1]}: ${steps("A")}. Shoe ${NEAR2} is off on both features, but only by ${steps(NEAR2)}. One feature matching is not enough; the gap on every feature counts.`
            : gapNote(KEYS[pick]), false)}</div>
        ${ok1 ? `<div class="lcase" id="c1"><p class="lead">Across and up meet at a right angle, so the straight line from the favourite to shoe ${NEAR2} is the long side of a right-angled triangle. Its length is √(across² + up²).</p>
          <p class="task">Type the straight-line distance from the favourite to shoe ${NEAR2}, to one or two decimals.</p>
          <div class="${P}show" aria-live="polite">${typed ? esc(typed) : `<span class="ph">type a number</span>`}</div>
          <div class="${P}pad">${["7", "8", "9", "⌫", "4", "5", "6", ".", "1", "2", "3", "0"].map(c => `<button type="button" class="btn" data-k="${c}" aria-label="${c === "⌫" ? "delete" : c}">${c}</button>`).join("")}<button type="button" class="btn wide" data-clear>Clear</button><button type="button" class="btn primary wide" data-check>Check</button></div>
          ${tmsg ? kit.feedback(tmsg[0], tmsg[1]) : ""}</div>` : ""}`;
      el.querySelectorAll("#c0 .lopts button").forEach(b => b.onclick = () => { if (ok2) return; pick = +b.dataset.i; paint(); });
      el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
        if (ok2) return;
        const c = b.dataset.k;
        typed = c === "⌫" ? typed.slice(0, -1) : typed.length < 6 && !(c === "." && typed.includes(".")) ? typed + c : typed;
        paint();
      });
      const cl = el.querySelector("[data-clear]"); if (cl) cl.onclick = () => { if (ok2) return; typed = ""; tmsg = null; paint(); };
      const ck = el.querySelector("[data-check]"); if (ck) ck.onclick = () => {
        if (ok2) return;
        const v = parseFloat(typed), near = x => Math.abs(v - x) < 0.05;
        if (!typed || isNaN(v)) { tmsg = [`Type a number first, with the keys above.`]; paint(); return; }
        if (Math.abs(v - D) <= 0.07) {
          ok2 = true;
          tmsg = [`Right. √(${across}² + ${up}²) = √${across * across + up * up} ≈ ${f2(D)}. The other shoes are further: ${by2.slice(1).map(([k, x]) => `${k} ${f2(x)}`).join(", ")}. Square each gap, add, take the square root: that is the <b>distance</b> between two shoes.`, true];
          paint(); done(); return;
        }
        tmsg = [near(across + up) ? `${across} + ${up} = ${across + up} is the distance if you may only walk along the grid lines, like streets. The straight line cuts the corner, so it is shorter: square each step, add, then take the square root.`
          : near(across * across + up * up) ? `${across}² + ${up}² = ${across * across + up * up} is the sum of the squares. One step is missing: take the square root of ${across * across + up * up}.`
          : near(across) || near(up) ? `That is only one of the two gaps. The line goes ${across} across and ${up} up at the same time; both count.`
          : near(Math.sqrt(across + up)) ? `That is √(${across} + ${up}): the gaps were added before they were squared. Square each one first: ${across}² = ${across * across}, ${up}² = ${up * up}.`
          : `Not quite. The gaps are ${across} across and ${up} up. Square each, add them, then take the square root of the total.`, false];
        paint();
      };
    };
    paint();
  }

  /* 3. The arrow between two shoes: subtract feature by feature. */
  function arrows({ el, done, kit }) {
    css();
    const T = "C", S = SHOES[T], D1 = sub(two(S), two(FAV)), D1r = sub(two(FAV), two(S));
    const Q1 = [vec(D1), vec(D1r), vec(two(S))];
    const SOFT = [0, 2], Q2 = [vec(SOFT), vec([SOFT[1], SOFT[0]]), vec([SOFT[0], -SOFT[1]])];
    const tgt = [FAV[0] + SOFT[0], FAV[1] + SOFT[1]];
    const nearT = KEYS.map(k => [k, dist(two(SHOES[k]), tgt)]).sort((x, y) => x[1] - y[1])[0];
    const ans = [null, null];
    const paint = () => {
      const ok = [ans[0] === 0, ans[1] === 0];
      const shoes = ALL.map(([k, s]) => ({ k, p: two(s), cls: k === "fav" || k === T ? "" : ok[1] && k === nearT[0] ? "enter" : "gone" }));
      const arr = [];
      if (ok[0]) arr.push({ from: two(FAV), to: two(S), head: true });
      if (ok[1]) arr.push({ from: two(FAV), to: tgt, head: true, dash: true });
      el.innerHTML = `<h1>The arrow from one shoe to another</h1>
        <p class="lead">Think of an arrow from the favourite to shoe ${T}. It says how to walk from one to the other: how much the weight changes, and how much the cushioning changes. Write it as a list, in the same order as the features: (change in weight, change in cushioning).</p>
        ${plot({ shoes, arrows: arr, ghosts: ok[1] ? [{ p: tgt, label: "?" }] : [] })}
        <div class="lcase" id="c0"><p class="task">Favourite (${FAV.slice(0, 2).join(", ")}), shoe ${T} (${S.slice(0, 2).join(", ")}). Which list is the arrow from the favourite to shoe ${T}?</p>
        ${kit.options(Q1, { picked: ans[0], correct: 0 })}
        ${ans[0] == null ? "" : ok[0] ? kit.feedback(`Right: shoe ${T} minus the favourite, feature by feature: ${S[0]} − ${FAV[0]} = ${sgn(D1[0])}, ${S[1]} − ${FAV[1]} = ${sgn(D1[1])}. Heavier by ${D1[0]}, firmer by ${-D1[1]}. A list of numbers in a fixed order like this is a <b>vector</b>. The arrow's length, √(${sqs(D1[0])} + ${sqs(D1[1])}) ≈ ${f2(dist(two(S), two(FAV)))}, is the distance between the two shoes.`, true)
          : ans[0] === 1 ? kit.feedback(`That is the favourite minus shoe ${T}: the arrow from ${T} back to the favourite. Same length, opposite direction. Going from the favourite to ${T}, the weight goes up, so the first number is positive.`, false)
          : kit.feedback(`(${S.slice(0, 2).join(", ")}) is where shoe ${T} sits: the arrow from the corner (0, 0) to it. Every shoe is that kind of arrow too. The arrow between two shoes is the difference: subtract the favourite's scores.`, false)}</div>
        <div class="lcase" id="c1"><p class="task">Another customer says: "Like my favourite, but softer." Which arrow, starting at the favourite, points to what she wants?</p>
        ${kit.options(Q2, { picked: ans[1], correct: 0 })}
        ${ans[1] == null ? "" : ok[1] ? kit.feedback(`Right: weight unchanged, cushioning up by ${SOFT[1]}. The arrow ends at (${tgt.join(", ")}), the dashed circle. No shoe sits exactly there; the nearest is shoe ${nearT[0]}, ${f2(nearT[1])} away. An arrow is a change you can add to a point.`, true)
          : ans[1] === 1 ? kit.feedback(`${Q2[1]} changes the first number, which is weight: that makes the shoe heavier and leaves the cushioning as it is. The order of the list decides which feature each number is.`, false)
          : kit.feedback(`${Q2[2]} lowers the cushioning: a firmer shoe, the opposite of softer.`, false)}</div>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans[0] === 0 && ans[1] === 0) done();
      }));
    };
    paint();
  }

  /* 4. Spot the idea: two more features, no picture. */
  function spot({ el, done, kit }) {
    css();
    let ans = null;
    const avg = s => s.reduce((a, b) => a + b, 0) / s.length;
    const same = KEYS.find(k => avg(SHOES[k]) === avg(FAV) && k !== NEAR4 && dist(SHOES[k], FAV) === by4[by4.length - 1][1]) || KEYS.find(k => avg(SHOES[k]) === avg(FAV));
    const opts = ["You cannot: distance needs the picture, and four features do not fit on a flat grid.",
      "Use the same rule on all four: subtract feature by feature, square each difference, add the four squares, take the square root.",
      "Average each shoe's four scores, and pick the shoe whose average is nearest the favourite's."];
    const paint = () => {
      el.innerHTML = `<h1>Two more features</h1>
        <p class="lead">Customers keep saying a suggestion "felt wrong" in the heel or slipped on wet roads. So the shop adds two scores: <b>heel drop</b> (how much higher the heel sits than the toe) and <b>grip</b>. Now each shoe has ${FEAT.length} numbers.</p>
        ${ftable(FEAT, ALL.map(([k, s]) => [k === "fav" ? "favourite" : k, s, k === "fav" ? "on" : ""]))}
        <p class="task">How do you find the shoe nearest to the favourite now?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1 ? kit.feedback(`Right. Nothing in the rule needed a picture. The grid was only a way to see two features. Each shoe is a list of ${FEAT.length} numbers in a fixed order, a vector, and the distance is the same recipe with more terms. It works for 4 features or 400. The one condition: every list has the same features in the same order. Otherwise you would subtract one shoe's grip from another shoe's weight.`, true)
          : ans === 0 ? kit.feedback(`The picture stops at three features, but the arithmetic never needed it. On the grid you subtracted, squared, added and took a root. Nothing there depends on having only two numbers; with four you just have four squares to add.`, false)
          : kit.feedback(`An average throws away which feature is which. Shoe ${same}'s scores average ${avg(SHOES[same])}, exactly like the favourite's ${avg(FAV)}, yet its cushioning is ${SHOES[same][1]} against ${FAV[1]}: a firm shoe for someone who loved a soft one. Compare feature by feature, then combine.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Use it with predictions: sum of squares per shoe on four features, then the suggestion. */
  function fourD({ el, done, kit }) {
    css();
    let k = 0, wrong = null, pick = null;
    const paint = () => {
      const fin = k === KEYS.length;
      const cur = fin ? null : KEYS[k], d = fin ? null : sub(SHOES[cur], FAV);
      const right = fin ? 0 : sq(d), absSum = fin ? 0 : d.reduce((a, v) => a + Math.abs(v), 0), signed = fin ? 0 : d.reduce((a, v) => a + v, 0);
      const opts = fin ? [] : [right, absSum, signed].filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
      const rows = [["favourite", FAV, ""]];
      KEYS.forEach((kk, i) => { if (i <= k && i < KEYS.length) rows.push([kk, SHOES[kk], i === k ? "on" : "d"]); });
      if (!fin) rows.push([`${cur} − fav`, d, "on"]);
      const r = KEYS.slice(0, k).map(kk => [kk, dist(SHOES[kk], FAV)]);
      const okPick = pick === KEYS.indexOf(NEAR4);
      const B2 = by2[0][0];
      el.innerHTML = `<h1>Which shoe is nearest now?</h1>
        <p class="lead">Work out each shoe's distance to the favourite on all ${FEAT.length} features. The lesson subtracts for you; you add the squares.</p>
        ${ftable(FEAT, rows)}
        ${fin ? "" : `<p class="task">Shoe ${cur}: the differences are ${vec(d)}. What is the sum of their squares?</p>`}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong == null ? "" : kit.feedback(wrong === absSum
            ? `${absSum} adds the differences without squaring them (${d.map(v => Math.abs(v)).join(" + ")}). Square each one first: ${d.map(v => `${sqs(v)} = ${v * v}`).join(", ")}.`
            : `${wrong} adds the differences with their signs (${d.map(sgn).join(" + ")}), so the −${Math.max(...d.map(v => -v))} cancels out part of the plus numbers. Gaps in opposite directions still count. Squaring makes every gap positive: ${d.map(v => `${sqs(v)} = ${v * v}`).join(", ")}.`, false)}
        ${r.length ? kit.meter(r.map(([kk, x]) => ({ label: `shoe ${kk}: √${sq(sub(SHOES[kk], FAV))}`, value: +f2(x), max: Math.ceil(by4[by4.length - 1][1]) }))) : ""}
        ${fin ? `<div class="lcase" id="c-pick"><p class="task">Which shoe should the shop suggest now?</p>${kit.options(KEYS.map(kk => `Shoe ${kk}`), { picked: pick, correct: KEYS.indexOf(NEAR4) })}
          ${pick == null ? "" : okPick ? kit.feedback(`Right: shoe ${NEAR4}, at ${f2(by4[0][1])}. On the two-feature grid, shoe ${B2} was nearest. Its grip is ${SHOES[B2][3]} against the favourite's ${FAV[3]}, and that gap of ${Math.abs(SHOES[B2][3] - FAV[3])} adds ${(SHOES[B2][3] - FAV[3]) ** 2} to its sum. Which features you include decides what "most alike" means.`, true)
            : KEYS[pick] === B2 ? kit.feedback(`Shoe ${B2} won on two features, but read the bars: its distance is now ${f2(dist(SHOES[B2], FAV))}, and shoe ${NEAR4}'s is ${f2(by4[0][1])}. Its grip gap of ${Math.abs(SHOES[B2][3] - FAV[3])} squared adds ${(SHOES[B2][3] - FAV[3]) ** 2}.`, false)
            : kit.feedback(`Shoe ${KEYS[pick]} is at ${f2(dist(SHOES[KEYS[pick]], FAV))}. The suggestion is the shoe with the shortest bar.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(".lpanel > .lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
      });
      el.querySelectorAll("#c-pick .lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === KEYS.indexOf(NEAR4)) done(); });
    };
    paint();
  }

  /* 6. From scratch in Python: a replay of the traced run of distance(shoe B, favourite). */
  function scratch({ el, done, kit }) {
    css();
    let i = 0, guess = null;
    const B = SHOES.B;
    // the prediction: the last "total += diff * diff" step, where diff is negative
    const PQ = TRACE.map(t => t[0]).lastIndexOf(4), pv = TRACE[PQ][2];
    const pRight = pv.total + pv.diff * pv.diff, pOpts = [pRight, pv.total + pv.diff, pv.total - pv.diff].filter((v, j, a) => a.indexOf(v) === j).sort((x, y) => x - y);
    const pNo = v => v === pv.total + pv.diff
      ? `${pv.total} + (${sgn(pv.diff)}) = ${v} adds diff itself, not diff × diff. The line squares diff first: ${sqs(pv.diff)} = ${pv.diff * pv.diff}.`
      : `${pv.total} + ${-pv.diff} = ${v} adds the size of the gap, not its square. The line adds diff × diff: ${sqs(pv.diff)} = ${pv.diff * pv.diff}.`;
    const iterAt = j => TRACE.slice(0, j + 1).filter(t => t[0] === 2).length - 1;   // loop round of step j
    const say = j => {
      const [ln, ev, v] = TRACE[j], nx = TRACE[j + 1] ? TRACE[j + 1][2] : null, it = iterAt(j);
      if (ev === "return") return `<code>distance</code> returns ${TRACE_RESULT}: the ${f2(+TRACE_RESULT)} shown for shoe B on the bars. Python's own <code>math.dist(shoe_b, favourite)</code> gave the same number in our run.`;
      if (ln === 1) return `Called as <code>distance(shoe_b, favourite)</code>. Line 1 starts a running total of squares at 0.`;
      if (ln === 2) return nx && "a" in nx && TRACE[j + 1][0] === 3 ? `<code>zip</code> pairs the two lists feature by feature. Round ${it + 1}: ${FEAT[it]}, a = ${nx.a} (shoe B), b = ${nx.b} (favourite).` : `No pairs left after ${FEAT.length} rounds, so the loop ends.`;
      if (ln === 3) return `diff = a − b = ${v.a} − ${v.b} = ${sgn(nx.diff)}.${nx.diff === 0 ? " Same score, so this feature adds nothing." : ""}`;
      if (ln === 4) return `total += diff × diff: ${v.total} + ${sqs(v.diff)} = ${nx.total}.${v.diff < 0 ? " The minus sign disappears when squared." : ""}`;
      return `All four squares are in: total = ${v.total}. Now the square root.`;
    };
    const paint = () => {
      const [ln, ev, v] = TRACE[i];
      const show = x => x == null ? "–" : sgn(x);
      const ask = i === PQ, held = ask && guess !== pRight;
      el.innerHTML = `<h1>The same recipe in Python</h1>
        <p class="lead">This is the rule from the last screens as a plain Python function, using only Python's built-in <code>math</code> module for the square root. <code>zip</code> walks two lists side by side, like pairing two arrays by index in JavaScript. We ran it on shoe B, <code>shoe_b = [${B.join(", ")}]</code>, and the favourite, <code>favourite = [${FAV.join(", ")}]</code>, and recorded every line it ran.</p>
        <p class="task">Step through the run to the end. On the last round you predict the new total before you see it.</p>
        ${kit.code(CODE6, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || held ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>a <b>${show(v.a)}</b></span><span>b <b>${show(v.b)}</b></span><span>diff <b>${show(v.diff)}</b></span><span>total <b>${show(v.total)}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${ev === "return" ? `<div class="${P}out"><span class="p">returned</span> ${TRACE_RESULT}</div>` : ""}
        ${ask ? `<div class="lcase" id="c-pred"><p class="task">Predict before you step: total is ${pv.total} and diff is ${sgn(pv.diff)}. What will total hold after this line?</p>
          ${kit.options(pOpts.map(String), { picked: guess == null ? null : pOpts.indexOf(guess), correct: pOpts.indexOf(pRight), num: true })}
          ${guess != null && guess !== pRight ? kit.feedback(pNo(guess), false) : ""}</div>` : ""}
        ${held ? "" : kit.feedback(say(i))}
        <p class="${P}cap">Recorded run on our Mac, ${RUN_DATE}. The highlighted line is the one about to run; the variables are as they are at that moment.</p>`;
      el.querySelectorAll("#c-pred .lopts button").forEach(b => b.onclick = () => { guess = pOpts[+b.dataset.i]; paint(); });
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 7. The library: NumPy does every shoe at once. Predict each printed line, then see the recorded output. */
  const Q7 = [
    { line: 9, show: [0], q: "What does print(diffs.shape) print?", opts: ["(4, 4)", "(4,)", "(1, 4)"], right: 0,
      no: ["(4,) would be one row of four numbers. But NumPy subtracts the favourite from every row of the catalogue (it repeats the favourite's row for each shoe: broadcasting), so you get one difference row per shoe: 4 shoes by 4 features.",
        "(1, 4) is the shape of a single difference row. The catalogue has 4 rows, and each row gets its own difference."],
      yes: "Right: one difference row per shoe, one column per feature." },
    { line: 12, show: [0, 1], q: "print(dists.round(2)) has printed the four distances. <code>argmin</code> gives the position of the smallest value, counted from 0. What does print(np.argmin(dists)) print next?", opts: ["2", "1", "3.61"], right: 0,
      no: ["1 is shoe B's row. B was nearest on the two-feature grid, but with all four features the smallest number in dists is the third one, 3.61.",
        "3.61 is the smallest distance itself. <code>argmin</code> returns where it is: the row number, counted from 0."],
      yes: "Right: row 2, counted from 0, is shoe C. On a tie, <code>argmin</code> gives the first one. <code>argsort</code> on the next line gives every position in order, nearest first: a ranked list of suggestions." },
    { line: 14, show: [0, 1, 2, 3], q: "The last line calls norm without axis=1. What does it print?", opts: ["One number for the whole table", "Four numbers, one per shoe", "An error: norm needs an axis"], right: 0,
      no: ["Four numbers, one per row, is what axis=1 asks for. Without an axis, NumPy treats the 4-by-4 table as one thing.",
        "No error. axis is optional; without it, norm measures the whole table as one object."],
      yes: "Right: 9.17 squares all 16 differences together and takes one root. It runs without complaint and means nothing for this question. <b>axis=1</b> is the parameter that matters here: it says to measure each row on its own." }
  ];
  const SHOWN7 = [[], [0, 1], [0, 1, 2, 3], [0, 1, 2, 3, 4]];   // output lines visible at each stage
  function library({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === Q7.length, q = fin ? null : Q7[k];
      const outLines = OUT7.filter((_, i) => SHOWN7[k].includes(i));
      el.innerHTML = `<h1>All shoes at once, with NumPy</h1>
        <p class="lead">With the whole catalogue in one 2-D array, one subtraction gives every difference row, and <code>np.linalg.norm</code> does the square, add and square root. By default it measures the straight-line length you computed by hand. <code>axis=1</code> tells it to measure each row, one shoe, on its own.</p>
        ${kit.code(CODE7, fin ? -1 : q.line)}
        ${outLines.length ? `<div class="${P}out"><span class="p">output so far</span>\n${outLines.map(esc).join("\n")}</div>` : ""}
        ${k > 0 ? kit.feedback(Q7[k - 1].yes) : ""}
        ${fin ? kit.feedback(`The whole run is above. Two lines do the work: <code>catalogue - favourite</code> and <code>np.linalg.norm(diffs, axis=1)</code>. The same two lines handle 4 shoes or 40,000, with no Python loop.`, true) : `<p class="task">${q.q}</p>
        <div class="lpanel">${kit.options(q.opts, { picked: wrong, correct: q.right })}
        ${wrong == null ? "" : kit.feedback(q.no[wrong > q.right ? wrong - 1 : wrong], false)}</div>`}
        <p class="${P}cap">Output recorded on our Mac with NumPy 2.5.4, ${RUN_DATE}.</p>`;
      el.querySelectorAll(".lpanel .lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== q.right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k === Q7.length) done();
      });
    };
    paint();
  }

  /* 8. The big picture, with a task on cost. */
  const BIG = { items: 2000000, feats: 300 };
  function bigPicture({ el, done, kit }) {
    css();
    let ans = null;
    const work = BIG.items * BIG.feats;
    const opts = [`The work for every search: one distance per product, each one touching all ${BIG.feats} features`,
      "Nothing: NumPy computes all the distances in one step",
      "The formula: with this many features the distance needs a different rule"];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What for:</b> describe things as lists of numbers, then find the nearest ones. That is how "more like this" suggestions work, and later in the path, search over the vectors a model makes for text.</p>
        <p class="lead"><b>When:</b> every feature is an amount, the scores are on similar scales, and "alike" means "close on every feature at once".</p>
        <p class="lead"><b>When not:</b> a hard rule ("in stock in size 42") is a filter, not a distance. Codes that only name things (colour 1, 2, 3) have no real distance. A feature in much bigger units (grams next to 1–9 scores) outweighs every other feature in the sum; a later lesson on nearest neighbours fixes that.</p>
        <p class="lead"><b>Cost:</b> one distance per item, for every search.</p>
        <p class="task">The shop's site grows from ${ALL.length - 1} shoes to ${fmt(BIG.items)} products, each with ${BIG.feats} features. What grows?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}
        ${ans == null ? "" : ans === 0 ? kit.feedback(`Right. Each search subtracts and squares ${fmt(BIG.items)} × ${fmt(BIG.feats)} = ${fmt(work)} numbers, and the product list must be kept in memory as numbers. Fine for a shop of shoes; for millions of items and many searches a second, the vector indexes later in the path skip most of the work by not checking every item.`, true)
          : ans === 1 ? kit.feedback(`One line of code, not one step. <code>np.linalg.norm(diffs, axis=1)</code> still visits every number: ${fmt(work)} differences per search. NumPy makes each one fast; it does not make them disappear.`, false)
          : kit.feedback(`The rule does not change: you saw it work the same for 2 features and 4, and it works for ${BIG.feats}. Only the amount of arithmetic grows.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, with two "no" cases. */
  const CASES = [
    ["A music app scores every song from 0 to 1 on tempo, energy and how acoustic it sounds. It wants the songs most like the one playing now.", true,
      "Yes. Each song is a list of three amounts in the same order. The nearest lists are the most similar songs, exactly like the shoes.",
      "Each song is three amounts on the same 0 to 1 scale, in a fixed order. That is the shoe catalogue again: the songs with the smallest distance to the one playing are the suggestions."],
    ["A football coach needs a substitute who plays most like the injured number 9. The club's sheet lists each player by shirt number, and he looks for the shirt number nearest to 9.", false,
      "No. A shirt number is a label, not an amount. Number 8 is not more like number 9 than number 23 is; the numbers were handed out, not measured. Distance needs features that measure how someone plays, such as sprint speed or passes per game.",
      "The arithmetic would run, but the answer is an accident. 8 is nearer to 9 than 23 is only because of how the shirts were handed out, not because the players play alike. Distance needs numbers that measure an amount, such as sprint speed or passes per game."],
    ["A gym wants every member who has had no visits this month, to send them a reminder.", false,
      "No. This is a rule on one number: visits equal 0. A filter gives the exact list; there is nothing to be near to.",
      "Nothing here asks what is alike. It is one number checked against a rule (visits = 0), and a filter returns exactly those members. A distance would rank members, not pick them."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is a distance the right tool?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the shoe shop.</p>
        <p class="task">For each one, decide: should it describe things as vectors and look for the nearest? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: the browser exercise and the next lesson. */
  function whatNext({ el, done, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now describe a thing as a vector of features, read the arrow between two vectors as "subtract feature by feature", and find the nearest one by distance: by hand, in plain Python and with NumPy's <code>norm(..., axis=1)</code>.</p>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write <code>distance(a, b)</code> yourself and use it to return the catalogue shoe nearest to a customer's favourite.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. It keeps these arrows and asks a different question about two of them: not how far apart their tips are, but whether they point the same way.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Vectors as arrows and as lists of features",
    checked: "2026-11-14",
    sources: [
      "https://numpy.org/doc/stable/reference/generated/numpy.linalg.norm.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.argmin.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.argsort.html",
      "https://numpy.org/doc/stable/user/basics.broadcasting.html",
      "https://docs.python.org/3/library/math.html#math.dist"
    ],
    interview: [{
      q: "You built a \"more like this\" feature: every product is a row of numeric features and you suggest the nearest rows. Users say the suggestions feel random. What do you check?",
      good: [
        "Take one product whose right answer you know, print its distances to a few others, and see which feature differences make up each sum",
        "Check the scales: one feature in big units (a price, grams) can swamp all the others",
        "Check for codes posing as amounts, such as category ids, which give distances that mean nothing",
        "Check the feature list itself: adding or dropping one feature can change which item is nearest",
        "Check every row has the same features in the same order"
      ],
      weak: "Swap in a fancier similarity measure or a machine-learning model, without looking at what the features are and how each one adds to the distance."
    }, {
      q: "A teammate computes distances with np.linalg.norm(catalogue - query) and every product gets the same score. What went wrong, and how do you fix it?",
      good: [
        "Without axis, norm measures the whole difference table as one object and returns a single number",
        "Pass axis=1 so each row (each product) gets its own length",
        "Check the shapes: the difference table is items by features, and the result should have one value per item",
        "Then use argmin for the nearest item or argsort for a ranked list"
      ],
      weak: "Loop over the products in Python and call norm on each one. It works, but it hides the misunderstanding and is much slower than fixing the axis."
    }],
    screens: [place, nearest, arrows, spot, fourD, scratch, library, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-i="${FAV[1]},${FAV[0]}"]`], right: ALL.map(([, s]) => `[data-i="${s[0]},${s[1]}"]`) },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", ...f2(dist(two(SHOES[NEAR2]), two(FAV))).split("").map(c => `[data-k="${c}"]`), "[data-check]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: [...KEYS.map(() => ".lpanel > .lopts [data-right]"), "#c-pick [data-right]"] },
      { wrong: [...Array(TRACE.map(t => t[0]).lastIndexOf(4)).fill("[data-next]"), "#c-pred [data-wrong]"],
        right: ["#c-pred [data-right]", ...Array(TRACE.length - 1 - TRACE.map(t => t[0]).lastIndexOf(4)).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: Q7.map(() => "[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
