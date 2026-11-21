/* Lesson s1-dot-product: The dot product and cosine similarity.
   Story: a small streaming site picks the next film for one viewer, Lena, from her taste and the films' viewer tags.
   Ideas: (1) the dot product (multiply matching numbers, add) scores how well a film fits a taste, but it grows with
   the film's length, so a popular film with big numbers everywhere wins; (2) cosine similarity divides by both
   lengths and keeps only the direction (the mix), so doubling a film's tags leaves it unchanged.
   Data: taste and tag counts are written by us (docs/ai-path/runs/s1-dot-product/films.py), not real films.
   Code output comes from runs on this Mac (Python 3.12.11, NumPy 2.5.4, see env.txt):
     docs/ai-path/runs/s1-dot-product/scratch.py -> scratch.out.txt (the traced cosine() on screen 5, and checks)
     docs/ai-path/runs/s1-dot-product/library.py -> library.out.txt (the NumPy screen 6, run with python -u)
     docs/ai-path/runs/s1-dot-product/zero.py -> zero.out.txt (plain Python on an all-zero taste, screen 6)
   No model API calls were recorded for this lesson; nothing on it is "not run by us".
   Lesson-local CSS (prefix lx-s1-dot-product-): a small feature table and a recorded-output box. */
(() => {
  const ID = "s1-dot-product", P = "lx-" + ID + "-";

  // films.py: features in this order; taste = films of each kind Lena finished last month;
  // film numbers = viewers who tagged it with each kind, in hundreds
  const FEAT = ["action", "comedy", "romance"];
  const TASTE = [1, 3, 2];
  const FILMS = [["Wedding Mixup", [0, 3, 2]], ["Harbour Heist", [9, 3, 1]], ["Camp Chaos", [2, 2, 1]]];
  const NAMES = FILMS.map(f => f[0]);

  // scratch.out.txt: trace of cosine(TASTE, FILMS["Harbour Heist"]) as [line, event, vars] (not altered)
  const TRACE = [
    [1, "line", {}], [2, "line", { dot: 0 }], [3, "line", { dot: 0, t: 1, f: 9 }], [2, "line", { dot: 9, t: 1, f: 9 }],
    [3, "line", { dot: 9, t: 3, f: 3 }], [2, "line", { dot: 18, t: 3, f: 3 }], [3, "line", { dot: 18, t: 2, f: 1 }],
    [2, "line", { dot: 20, t: 2, f: 1 }], [4, "line", { dot: 20, t: 2, f: 1 }],
    [5, "line", { dot: 20, t: 2, f: 1, taste_sq: 14 }],
    [6, "line", { dot: 20, t: 2, f: 1, taste_sq: 14, taste_len: 3.7416573867739413 }],
    [7, "line", { dot: 20, t: 2, f: 1, taste_sq: 14, taste_len: 3.7416573867739413, film_sq: 91 }],
    [8, "line", { dot: 20, t: 2, f: 1, taste_sq: 14, taste_len: 3.7416573867739413, film_sq: 91, film_len: 9.539392014169456 }],
    [8, "return", { dot: 20, t: 2, f: 1, taste_sq: 14, taste_len: 3.7416573867739413, film_sq: 91, film_len: 9.539392014169456 }]
  ];
  const TRACE_RESULT = "0.5603318146805258";   // scratch.out.txt: "result"
  const TRACE_FILM = 1;                         // Harbour Heist
  const CODE5 = [
    "def cosine(taste, film):",
    "    dot = 0",
    "    for t, f in zip(taste, film):",
    "        dot += t * f",
    "    taste_sq = sum(t * t for t in taste)",
    "    taste_len = math.sqrt(taste_sq)",
    "    film_sq = sum(f * f for f in film)",
    "    film_len = math.sqrt(film_sq)",
    "    return dot / (taste_len * film_len)"
  ];
  // zero.out.txt: the same function with taste [0, 0, 0] (not altered)
  const ZERO_PY = "ZeroDivisionError: float division by zero";
  // library.py (without its first comment line) and library.out.txt (the warning's file path trimmed with …)
  const CODE6 = [
    "import numpy as np",
    "taste = np.array([1, 3, 2])",
    "films = np.array([",
    "    [0, 3, 2],   # Wedding Mixup",
    "    [9, 3, 1],   # Harbour Heist",
    "    [2, 2, 1],   # Camp Chaos",
    "])",
    "scores = films @ taste",
    "print(scores)",
    "lengths = np.linalg.norm(films, axis=1)",
    "taste_len = np.linalg.norm(taste)",
    "cos = scores / (lengths * taste_len)",
    "print(cos.round(3))",
    "print(np.argsort(-cos))",
    "",
    "new_viewer = np.array([0, 0, 0])",
    "new_len = np.linalg.norm(new_viewer)",
    "new_scores = films @ new_viewer",
    "print(new_scores / (lengths * new_len))"
  ];
  const OUT6 = ["[13 20 10]", "[0.964 0.56  0.891]", "[0 2 1]", "… RuntimeWarning: invalid value encountered in divide", "  print(new_scores / (lengths * new_len))", "[nan nan nan]"];
  const RUN_DATE = "2026-11-14";

  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const len = a => Math.sqrt(dot(a, a));
  const cosv = (a, b) => dot(a, b) / (len(a) * len(b));
  const sum = a => a.reduce((s, v) => s + v, 0);
  const f2 = x => Number.isInteger(x) ? String(x) : x.toFixed(2);
  const f3 = x => x.toFixed(3);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const vec = v => `(${v.join(", ")})`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five"];
  const ORD = ["first", "second", "third", "fourth"];
  const prodTxt = (a, b) => a.map((v, i) => `${v}×${b[i]}`).join(" + ");
  const uniq = a => a.filter((v, i) => a.indexOf(v) === i);

  const DOTS = FILMS.map(([, f]) => dot(TASTE, f));
  const LENS = FILMS.map(([, f]) => len(f));
  const TLEN = len(TASTE);
  const COS = FILMS.map(([, f]) => cosv(TASTE, f));
  const BY_DOT = NAMES.map((_, i) => i).sort((a, b) => DOTS[b] - DOTS[a]);
  const BY_COS = NAMES.map((_, i) => i).sort((a, b) => COS[b] - COS[a]);
  const TOP_DOT = BY_DOT[0], TOP_COS = BY_COS[0];

  /* ---------- lesson-local styles ---------- */
  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}wrap { overflow-x: auto; max-width: 100%; }
      .${P}ft { border-collapse: collapse; margin: 12px 0 0; font: 500 14px var(--mono); }
      .${P}ft th, .${P}ft td { padding: 6px 9px; border-bottom: 1px solid var(--line); text-align: right; color: var(--ink); white-space: nowrap; }
      .${P}ft th { font: 600 12.5px var(--font); color: var(--muted); }
      .${P}ft td:first-child, .${P}ft th:first-child { text-align: left; font-family: var(--font); }
      .${P}ft tr.on td { background: var(--sunk); font-weight: 700; }
      .${P}ft tr.me td { border-bottom: 1.5px solid var(--ink-2); }
      .${P}cap { font: 500 13px/1.4 var(--font); color: var(--muted); margin: 8px 0 0; }
      .${P}out { font: 500 14px/1.5 var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 8px 12px; margin: 10px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}out .p { color: var(--muted); }
      @media (max-width: 480px) { .${P}ft th, .${P}ft td { padding: 5px 5px; font-size: 13px; } }
    `;
    document.head.appendChild(s);
  }
  // rows: [[label, cells, cls]]; cells already formatted
  const ftable = (head, rows) => `<div class="${P}wrap"><table class="${P}ft"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(([l, v, c]) => `<tr class="${c || ""}"><td>${esc(l)}</td>${v.map(x => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const tasteRow = extra => ["Lena's taste", [...TASTE, ...extra], "me"];

  /* 1. The situation, by hand: score each film with the site's rule, then read the top pick. */
  function score({ el, done, kit }) {
    css();
    let k = 0, wrong = null, pick = null;
    const paint = () => {
      const fin = k === FILMS.length;
      const [name, film] = fin ? [] : FILMS[k];
      const right = fin ? 0 : dot(TASTE, film), own = fin ? 0 : sum(film), all = fin ? 0 : sum(TASTE) + sum(film), tot = fin ? 0 : sum(TASTE) * sum(film);
      const opts = fin ? [] : uniq([right, own, all, tot]).sort((a, b) => a - b);
      const rows = [tasteRow([""]),...FILMS.map(([n, f], i) => [n, [...f, i < k ? String(DOTS[i]) : i === k ? "?" : ""], i === k ? "on" : ""])];
      const okPick = pick === TOP_DOT;
      el.innerHTML = `<h1>What should Lena watch next?</h1>
        <p class="lead">A small streaming site shows each viewer a "next up" film. Last month Lena finished ${TASTE[0]} action film, ${TASTE[1]} comedies and ${TASTE[2]} romances: that is her taste, ${vec(TASTE)}. For each film the site counts how many viewers tagged it action, comedy or romance, in hundreds.</p>
        <p class="lead">Scoring how well two lists of numbers match is how an AI product picks what to show: films here, and later in the path, documents for a question.</p>
        <p class="lead">The site's score: for each kind, multiply Lena's number by the film's number. Then add the three products.</p>
        ${ftable(["", ...FEAT, "score"], rows)}
        ${fin ? "" : `<p class="task">Work out the score of ${esc(name)}.</p>`}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong == null ? "" : kit.feedback(wrong === own
            ? `${own} adds the film's own tags (${film.join(" + ")}). Lena's taste is missing. Multiply kind by kind first: ${prodTxt(TASTE, film)}.`
            : wrong === all
            ? `${all} adds every number in both rows. The rule multiplies each of Lena's numbers by the film's number for the same kind: ${prodTxt(TASTE, film)}, then adds.`
            : `${tot} multiplies Lena's total (${sum(TASTE)}) by the film's total (${sum(film)}). That pairs her comedies with the film's action tags too. Multiply only matching kinds: ${prodTxt(TASTE, film)}.`, false)}
        ${k > 0 && !fin && wrong == null ? kit.feedback(`${esc(NAMES[k - 1])}: ${prodTxt(TASTE, FILMS[k - 1][1])} = ${DOTS[k - 1]}.`) : ""}
        ${fin ? `${kit.meter(FILMS.map(([n], i) => ({ label: esc(n), value: DOTS[i], max: Math.max(...DOTS) })))}
          <div class="lcase" id="c-pick"><p class="task">Which film does this score put at the top of Lena's "next up" row?</p>
          ${kit.options(NAMES.map(esc), { picked: pick, correct: TOP_DOT })}
          ${pick == null ? "" : okPick ? kit.feedback(`Right: ${esc(NAMES[TOP_DOT])}, with ${DOTS[TOP_DOT]}. This rule, multiply matching numbers and add, is called the <b>dot product</b> of two vectors.`, true)
            : pick === TOP_COS ? kit.feedback(`${esc(NAMES[pick])} may well suit her better, and the next screen asks about exactly that. But the question here is what the score says: ${esc(NAMES[TOP_DOT])} ${DOTS[TOP_DOT]}, ${esc(NAMES[pick])} ${DOTS[pick]}.`, false)
            : kit.feedback(`${esc(NAMES[pick])} scored ${DOTS[pick]}, the lowest of the three. The top pick is the film with the biggest score: ${esc(NAMES[TOP_DOT])}, ${DOTS[TOP_DOT]}.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(".lpanel > .lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
      });
      el.querySelectorAll("#c-pick .lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === TOP_DOT) done(); });
    };
    paint();
  }

  /* 2. Spot the idea: the winner wins on size, not on fit. */
  function spot({ el, done, kit }) {
    css();
    let ans = null;
    const H = TOP_DOT, M = TOP_COS, hf = FILMS[H][1], mf = FILMS[M][1];
    const parts = f => f.map((v, i) => TASTE[i] * v);
    const ai = TASTE.indexOf(Math.min(...TASTE));   // her least-watched kind
    const ci = FEAT.indexOf("comedy");
    const opts = [
      `Its numbers are big in every column. Many viewers tagged it, so even ${FEAT[ai]}, the kind she watches least, adds ${parts(hf)[ai]} points.`,
      `${FEAT[ai][0].toUpperCase()}${FEAT[ai].slice(1)} is the kind Lena likes most, so an ${FEAT[ai]} film should win.`,
      `It has the most comedy tags, and comedy is her favourite kind.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did the heist film win?</h1>
        <p class="lead">The site shows Lena ${esc(NAMES[H])}. She stops it after ten minutes and gives it a thumbs-down. She almost never watches ${FEAT[ai]}.</p>
        ${ftable(["", ...FEAT, "score"], [tasteRow([""]), ...FILMS.map(([n, f], i) => [n, [...f, String(DOTS[i])], i === H ? "on" : ""])])}
        <p class="task">Why did ${esc(NAMES[H])} get the top score?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}
        ${ans == null ? "" : ans === 0 ? kit.feedback(`Right. Its ${DOTS[H]} points are ${parts(hf).join(" + ")}: ${parts(hf)[ai]} of them come from ${FEAT[ai]}. ${esc(NAMES[H])} is a hit, so every number in its row is big. Read the row as an arrow from (0, 0, 0), as in the last lesson: its <b>length</b>, √(${hf.map(v => v + "²").join(" + ")}) ≈ ${f2(LENS[H])}, is far longer than ${esc(NAMES[M])}'s ≈ ${f2(LENS[M])}. The dot product grows with that length. So it mixes two questions: does the film point the same way as her taste, and how long is the film's arrow?`, true)
          : ans === 1 ? kit.feedback(`Read her row again: ${FEAT[ai]} is ${TASTE[ai]}, the smallest of her three numbers. The score still gave ${esc(NAMES[H])} ${parts(hf)[ai]} points for it, because the film's ${FEAT[ai]} number, ${hf[ai]}, is so big.`, false)
          : kit.feedback(`${esc(NAMES[H])} and ${esc(NAMES[M])} both have comedy ${hf[ci]}, so comedy adds ${TASTE[ci]}×${hf[ci]} = ${parts(hf)[ci]} to both. The gap is in ${FEAT[ai]}: ${TASTE[ai]}×${hf[ai]} = ${parts(hf)[ai]} for ${esc(NAMES[H])}, ${TASTE[ai]}×${mf[ai]} = ${parts(mf)[ai]} for ${esc(NAMES[M])}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 3. Cosine by hand: divide the dot product by both lengths, then rank again. */
  function cosHand({ el, done, kit }) {
    css();
    let k = 0, wrong = null, pick = null;
    const posCos = i => BY_COS.indexOf(i);
    const rankTxt = order => order.map(i => esc(NAMES[i])).join(", ");
    const ch = [
      `${esc(NAMES[TOP_DOT])} fell from first to ${ORD[posCos(TOP_DOT)]}, and ${esc(NAMES[TOP_COS])} is now first.`,
      "Nothing important: every score got smaller, but the order is the same.",
      `${esc(NAMES[TOP_COS])} is now first because it has more comedy tags than the others.`
    ];
    const paint = () => {
      const fin = k === FILMS.length;
      const right = fin ? 0 : COS[k], onlyF = fin ? 0 : DOTS[k] / LENS[k], added = fin ? 0 : DOTS[k] / (TLEN + LENS[k]);
      const opts = fin ? [] : [right, onlyF, added].sort((a, b) => a - b).map(f3);
      const rows = [["Lena's taste", ["", f2(TLEN), ""], "me"], ...FILMS.map(([n], i) => [n, [String(DOTS[i]), f2(LENS[i]), i < k ? f3(COS[i]) : i === k ? "?" : ""], i === k ? "on" : ""])];
      el.innerHTML = `<h1>Divide out the length</h1>
        <p class="lead">The dot product mixes fit with arrow length. To keep only the direction (the mix of kinds), divide the dot product by both lengths: dot ÷ (taste length × film length). The result is called <b>cosine similarity</b>. Lena's length is √(${TASTE.map(v => v + "²").join(" + ")}) ≈ ${f2(TLEN)}. The lengths are worked out for you.</p>
        ${ftable(["", "dot", "length", "cosine"], rows)}
        ${fin ? "" : `<p class="task">${esc(NAMES[k])}: dot ${DOTS[k]}, length ${f2(LENS[k])}. Pick its cosine.</p>`}
        <div class="lpanel">${fin ? "" : kit.options(opts, { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(f3(right)), num: true })}
        ${wrong == null ? "" : kit.feedback(wrong === f3(onlyF)
            ? `${wrong} divides by the film's length only. Divide by Lena's length too: ${DOTS[k]} ÷ (${f2(TLEN)} × ${f2(LENS[k])}). A cosine is never above 1.`
            : `${wrong} adds the two lengths. Multiply them: ${DOTS[k]} ÷ (${f2(TLEN)} × ${f2(LENS[k])}).`, false)}
        ${fin ? `${kit.meter(FILMS.map(([n], i) => ({ label: esc(n), value: f3(COS[i]), max: 1, good: i === TOP_COS })))}
          <p class="lead">By dot product: ${rankTxt(BY_DOT)}. By cosine: ${rankTxt(BY_COS)}.</p>
          <div class="lcase" id="c-pick"><p class="task">What changed?</p>
          ${kit.options(ch, { picked: pick, correct: 0 })}
          ${pick == null ? "" : pick === 0 ? kit.feedback(`Right. Once length is divided out, only the mix counts. ${esc(NAMES[TOP_COS])}'s mix ${vec(FILMS[TOP_COS][1])} points almost the same way as Lena's ${vec(TASTE)}, so its cosine is ${f3(COS[TOP_COS])}, close to the top value of 1. ${esc(NAMES[TOP_DOT])}'s mix is mostly ${FEAT[0]}, so it drops to ${f3(COS[TOP_DOT])}.`, true)
            : pick === 1 ? kit.feedback(`Compare the two rankings above: by dot product ${rankTxt(BY_DOT)}, by cosine ${rankTxt(BY_COS)}. Dividing by a different length for each film changed the order.`, false)
            : kit.feedback(`${esc(NAMES[TOP_COS])} and ${esc(NAMES[TOP_DOT])} both have comedy ${FILMS[TOP_COS][1][1]}. ${esc(NAMES[TOP_COS])} wins because its whole mix points nearly the same way as Lena's, not because of one column.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(".lpanel > .lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== f3(right)) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
      });
      el.querySelectorAll("#c-pick .lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === 0) done(); });
    };
    paint();
  }

  /* 4. Predict: doubling the tags, and a film with exactly her mix. */
  function predict({ el, done, kit }) {
    css();
    const M = TOP_COS, H = TOP_DOT, mf = FILMS[M][1], m2 = mf.map(v => 2 * v), d2 = dot(TASTE, m2), c2 = cosv(TASTE, m2);
    const same = TASTE.map(v => 2 * v), cs = cosv(TASTE, same);
    const Q = [
      { q: `What is its new dot product with Lena's taste?`, opts: uniq([d2, DOTS[M], 2 * d2]).sort((a, b) => a - b).map(String), right: String(d2),
        no: v => +v === DOTS[M] ? `${v} is the old score. Every film number doubled, so every product doubles: ${prodTxt(TASTE, m2)} = ${d2}.`
          : `${v} doubles twice. Only the film doubled, Lena's taste did not: ${prodTxt(TASTE, m2)} = ${d2}.` },
      { q: "And its new cosine?", opts: [c2, 2 * c2, c2 / 2].sort((a, b) => a - b).map(f3), right: f3(c2),
        no: v => +v > c2 ? `The dot product doubled, but so did the film's length (√${dot(m2, m2)} ≈ ${f2(len(m2))}, twice ${f2(LENS[M])}). The division takes the 2 back out.` : `Nothing got smaller. The dot product and the film's length both doubled, and the 2 cancels.` },
      { q: `A new film, Paper Hearts, is tagged ${vec(same)}: exactly Lena's mix, twice as many. What is its cosine with her taste?`, opts: [cs, 2 * cs, cs / 2].sort((a, b) => a - b).map(f3), right: f3(cs),
        no: v => +v > cs ? `A cosine never goes above 1. Twice as many tags only makes the arrow longer, and length is divided out.` : `Half would mean the film points a different way. Its numbers are Lena's numbers times 2: the same direction exactly.` }
    ];
    const ans = Q.map(() => null);
    const paint = () => {
      const ok = Q.map((q, i) => ans[i] === q.right);
      el.innerHTML = `<h1>Predict before you compute</h1>
        <p class="lead">${esc(NAMES[M])} goes viral. Twice as many viewers tag it, in the same mix: ${vec(mf)} becomes ${vec(m2)}.</p>
        ${Q.map((q, i) => `${i === 2 ? `<p class="lead">Another case.</p>` : ""}<div class="lcase" id="q${i}"><p class="task">${q.q}</p>
          ${kit.options(q.opts, { picked: ans[i] == null ? null : q.opts.indexOf(ans[i]), correct: q.opts.indexOf(q.right), num: true })}
          ${ans[i] == null ? "" : ok[i] ? kit.feedback(i === 0 ? `Right: ${d2}, double the old ${DOTS[M]}. It now beats ${esc(NAMES[H])}'s ${DOTS[H]}, only because more people tagged it.`
            : i === 1 ? `Right: still ${f3(c2)}. Doubling every number doubles the length too, and the division takes it back out. Cosine sees the mix, not the size.`
            : `Right: ${f3(cs)}, the most a cosine can be. It is 1 when the two arrows point the same way and 0 when they are at right angles. Example: a pure ${FEAT[0]} film (5, 0, 0) against a taste of (0, 3, 2) gives dot 0, so cosine 0: they share no kind. Tag counts are never negative, so here it stays between 0 and 1.`, true)
            : kit.feedback(q.no(ans[i]), false)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = Q[i].opts[+b.dataset.i]; paint();
        if (Q.every((q, j) => ans[j] === q.right)) done();
      }));
    };
    paint();
  }

  /* 5. From scratch in Python: a replay of the traced run of cosine(taste, harbour_heist). */
  function scratch({ el, done, kit }) {
    css();
    let i = 0, guess = null;
    const film = FILMS[TRACE_FILM][1];
    const PQ = TRACE.map(t => t[0]).lastIndexOf(3), pv = TRACE[PQ][2];
    const pRight = pv.dot + pv.t * pv.f, pPlus = pv.dot + pv.t + pv.f, pTimes = pv.dot * pv.t;
    const pOpts = uniq([pRight, pPlus, pTimes]).sort((a, b) => a - b);
    const pNo = v => v === pPlus ? `${pv.dot} + ${pv.t} + ${pv.f} = ${v} adds t and f. The line adds their product: ${pv.t} × ${pv.f} = ${pv.t * pv.f}.`
      : `${pv.dot} × ${pv.t} = ${v} multiplies the running total. <code>+=</code> adds t × f to dot: ${pv.dot} + ${pv.t * pv.f}.`;
    const roundAt = j => TRACE.slice(0, j + 1).filter(t => t[0] === 2).length - 1;
    const say = j => {
      const [ln, ev, v] = TRACE[j], nx = TRACE[j + 1] ? TRACE[j + 1][2] : null, r = roundAt(j);
      if (ev === "return") return `<code>cosine</code> returns ${TRACE_RESULT}: the ${f3(+TRACE_RESULT)} you found by hand for ${esc(NAMES[TRACE_FILM])}.`;
      if (ln === 1) return `Called with Lena's taste and ${esc(NAMES[TRACE_FILM])}'s tags. The highlighted line starts dot at 0.`;
      if (ln === 2) return nx && TRACE[j + 1][0] === 3 ? `<code>zip</code> pairs the two lists kind by kind. Round ${r + 1}: ${FEAT[r]}, t = ${nx.t} (Lena), f = ${nx.f} (the film).` : `No pairs left after ${FEAT.length} rounds, so the loop ends. dot is ${v.dot}: the score from screen 1.`;
      if (ln === 3) return `dot += t × f: ${v.dot} + ${v.t} × ${v.f} = ${nx.dot}.`;
      if (ln === 4) return `Square Lena's numbers and add: ${TASTE.map(x => x + "²").join(" + ")} = ${nx.taste_sq}.`;
      if (ln === 5) return `Lena's length: √${v.taste_sq} = ${nx.taste_len}.`;
      if (ln === 6) return `The same for the film: ${film.map(x => x + "²").join(" + ")} = ${nx.film_sq}.`;
      if (ln === 7) return `The film's length: √${v.film_sq} = ${nx.film_len}.`;
      return `Divide: ${v.dot} ÷ (${f3(v.taste_len)} × ${f3(v.film_len)}).`;
    };
    const paint = () => {
      const [ln, ev, v] = TRACE[i];
      const show = x => x == null ? "–" : Number.isInteger(x) ? String(x) : f3(x);
      const ask = i === PQ, held = ask && guess !== pRight;
      el.innerHTML = `<h1>The same steps in Python</h1>
        <p class="lead">Here is cosine similarity as a plain Python function, using Python's built-in <code>math</code> module for the square root. <code>zip</code> walks two lists side by side, like pairing two arrays by index in JavaScript. We ran it on Lena's taste, <code>[${TASTE.join(", ")}]</code>, and ${esc(NAMES[TRACE_FILM])}'s tags, <code>[${film.join(", ")}]</code>, and recorded every line it ran.</p>
        <p class="task">Step through the run to the end. On the last round you predict dot before you see it.</p>
        ${kit.code(CODE5, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || held ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>t <b>${show(v.t)}</b></span><span>f <b>${show(v.f)}</b></span><span>dot <b>${show(v.dot)}</b></span><span>taste_len <b>${show(v.taste_len)}</b></span><span>film_len <b>${show(v.film_len)}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${ev === "return" ? `<div class="${P}out"><span class="p">returned</span> ${TRACE_RESULT}</div>` : ""}
        ${ask ? `<div class="lcase" id="c-pred"><p class="task">Predict before you step: dot is ${pv.dot}, t is ${pv.t}, f is ${pv.f}. What will dot hold after this line?</p>
          ${kit.options(pOpts.map(String), { picked: guess == null ? null : pOpts.indexOf(guess), correct: pOpts.indexOf(pRight), num: true })}
          ${guess != null && guess !== pRight ? kit.feedback(pNo(guess), false) : ""}</div>` : ""}
        ${held ? "" : kit.feedback(say(i))}
        <p class="${P}cap">Recorded run on our Mac, ${RUN_DATE}. The highlighted line is the one about to run; the variables are as they are at that moment, shown to 3 decimals.</p>`;
      el.querySelectorAll("#c-pred .lopts button").forEach(b => b.onclick = () => { guess = pOpts[+b.dataset.i]; paint(); });
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 6. The library: NumPy scores every film at once. Predict each printed line, then see the recorded output. */
  const ASC = NAMES.map((_, i) => i).sort((a, b) => COS[a] - COS[b]);
  const Q6 = [
    { line: 8, q: "What does print(scores) print?", opts: [OUT6[0], "The three cosines", String(sum(DOTS))], right: 0,
      no: ["The cosines come later, on the <code>cos = ...</code> line, after dividing by the lengths. <code>scores</code> holds plain dot products.",
        `${sum(DOTS)} would be the three scores added into one number. <code>@</code> keeps one score per film.`],
      yes: `Right: the three dot products you worked out by hand. <code>films @ taste</code> takes the dot product of <code>taste</code> with each row of <code>films</code>. Why a table @ a list works that way is the next lesson.` },
    { line: 13, q: "print(cos.round(3)) has printed the cosines. np.argsort gives the row numbers in sorted order, smallest value first. What does print(np.argsort(-cos)) print next?", opts: [OUT6[2], `[${ASC.join(" ")}]`, "The cosines, largest first"], right: 0,
      no: [`[${ASC.join(" ")}] is the order for <code>argsort(cos)</code>, smallest first. The minus sign flips the values, so the largest cosine comes first.`,
        "<code>argsort</code> returns positions, not values: the row numbers in sorted order."],
      yes: `Right: row ${BY_COS[0]} first, ${esc(NAMES[BY_COS[0]])}. <code>argsort</code> sorts smallest first; sorting <code>-cos</code> gives the largest cosine first: a ranked "next up" row.` },
    { line: 18, q: "A viewer signs up today and has watched nothing: new_viewer is all zeros. What does the last line give?", opts: ["Three zeros", "An error that stops the program", "A warning, then three nan (not a number)"], right: 2,
      no: ["Zero would be a real score. Here the dot product is 0 and the viewer's length is 0 too: 0 ÷ 0 has no answer.",
        `Plain Python stops: our <code>cosine()</code> from the last screen, given [0, 0, 0], raised <code>${ZERO_PY}</code>. By default, NumPy does not stop: it warns and carries on.`],
      yes: `Right: 0 ÷ 0. A taste of all zeros has no direction, so no cosine. NumPy warns and fills in <code>nan</code>; our plain Python version raised <code>${ZERO_PY}</code>; scikit-learn's <code>cosine_similarity</code> shows a zero row scoring 0 in its documentation. Whatever the tool prints, the score means nothing. Check for empty tastes before you rank.` }
  ];
  const SHOWN6 = [[], [0, 1], [0, 1, 2], [0, 1, 2, 3, 4, 5]];
  function library({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === Q6.length, q = fin ? null : Q6[k];
      const outLines = OUT6.filter((_, i) => SHOWN6[k].includes(i));
      el.innerHTML = `<h1>Every film at once, with NumPy</h1>
        <p class="lead">With the films in one 2-D array, <code>@</code> does every dot product in one go, and <code>np.linalg.norm(films, axis=1)</code> gives each row's length, as in the last lesson.</p>
        ${kit.code(CODE6, fin ? -1 : q.line)}
        ${outLines.length ? `<div class="${P}out"><span class="p">output so far</span>\n${outLines.map(esc).join("\n")}</div>` : ""}
        ${k > 0 ? kit.feedback(Q6[k - 1].yes) : ""}
        ${fin ? kit.feedback(`The whole run is above. Three lines do the work: <code>films @ taste</code>, <code>np.linalg.norm(films, axis=1)</code> and one division. The same lines rank 3 films or 30,000.`, true) : `<p class="task">${q.q}</p>
        <div class="lpanel">${kit.options(q.opts, { picked: wrong, correct: q.right })}
        ${wrong == null ? "" : kit.feedback(q.no[wrong > q.right ? wrong - 1 : wrong], false)}</div>`}
        <p class="${P}cap">Output recorded on our Mac with NumPy 2.5.4, ${RUN_DATE}. The warning's file path is cut (…); the line under it is the source line NumPy's warning repeats.</p>`;
      el.querySelectorAll(".lpanel .lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== q.right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k === Q6.length) done();
      });
    };
    paint();
  }

  /* 7. The big picture, with a task on cost. */
  const BIG = 50000;
  function bigPicture({ el, done, kit }) {
    css();
    let ans = null;
    const fmt = n => n.toLocaleString("en");
    const opts = ["Each film's length", "Each film's dot product with Lena's taste", "The length of Lena's taste"];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for it</h1>
        <p class="lead"><b>What for:</b> ranking things by how alike they are: films for a viewer, and later in the path, documents for a question.</p>
        <p class="lead"><b>Cosine when</b> the mix matters and the size does not: popular next to niche, long texts next to short ones.</p>
        <p class="lead"><b>Dot product when</b> size should count. Google's guide to similarity measures says: to capture popularity, choose the dot product. If the vectors already have length 1, the two give the same number (dividing by 1 × 1 changes nothing), and the dot product is cheaper. OpenAI's documentation (checked 2026-11-14) says its embeddings, the lists of numbers its models make from text, come that way.</p>
        <p class="lead"><b>Neither</b> for a viewer with no history: an all-zero taste has no direction. Show popular films instead.</p>
        <p class="lead"><b>Cost:</b> one dot product per film, every time a page loads.</p>
        <p class="task">The site grows to ${fmt(BIG)} films. Which of these can it work out once, ahead of time, instead of on every visit?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 0 })}
        ${ans == null ? "" : ans === 0 ? kit.feedback(`Right. A film's length only changes when its tags change, so store it next to the film. Better still, divide each film's row by its length once and store that: then each visit needs only one dot product per film, ${fmt(BIG)} of them.`, true)
          : ans === 1 ? kit.feedback(`Those depend on Lena's taste, which changes every time she finishes a film, and on which viewer is visiting. They are the work that has to happen per visit: ${fmt(BIG)} of them.`, false)
          : kit.feedback(`Her length is one number per visit, and it changes as she watches. It is also the same divisor for every film, so it never changes her ranking: dividing all ${fmt(BIG)} scores by the same number keeps their order.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations, with two "no" cases. */
  const CASES = [
    ["A help centre describes every article by how many times it uses each word. Long guides use every word many times. A customer types a question, and the site wants the article closest in topic.", 0,
      "Yes, cosine. A long guide has a long vector just by being long, and the dot product would push long guides to the top. Cosine compares the mix of words.",
      "Long guides have big counts for every word, like the heist film's tags. The dot product would rank them first for almost any question. Cosine divides the length out and compares the mix of words."],
    ["A paddle-sports shop wants to invite the 50 customers who spent the most on kayaks and paddles last year. Each customer is a list of spending per category.", 1,
      "No. Here the size is the point. Cosine would give a customer who spent 5 only on paddles the same score as one who spent 5,000 only on paddles. Add up the two categories (a dot product with weights 1 for kayaks and paddles, 0 for the rest) and rank by that.",
      "Cosine throws the size away, and the size is what the shop is asking about. Someone who spent 5 only on paddles would tie with someone who spent 5,000 only on paddles. Rank by the total spent on the two categories instead."],
    ["An audiobook app wants to recommend books to a listener who installed it a minute ago. Her listening vector is all zeros.", 1,
      "No. An all-zero vector has no direction: its length is 0, so the cosine is 0 ÷ 0. Show popular books or ask her to pick a few topics first.",
      "There is nothing to compare yet. Her length is 0, so cosine divides 0 by 0: NumPy gives nan, plain Python stops with an error. Start her with popular books or a few topic picks."],
    ["A recipe site counts reader tags for each recipe: sweet, salty, spicy. Famous recipes have thousands of tags, new ones a handful. It wants a \"more like this\" row under each recipe.", 0,
      "Yes, cosine. The famous recipes would win every dot product just by having more tags. Cosine finds the recipes with the same flavour mix.",
      "This is Lena's problem again: famous recipes have long vectors. With the dot product they would fill every \"more like this\" row. Cosine compares the flavour mix."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const opts = ["Cosine similarity", "Not cosine"];
    const paint = () => {
      el.innerHTML = `<h1>Is cosine the right score?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the streaming site.</p>
        <p class="task">For each one, decide: should it rank by cosine similarity? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(opts, { picked: ans[i], correct: y })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === y ? yes : no), ans[i] === y)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === y)) done();
      }));
    };
    paint();
  }

  /* 9. What next: the browser exercise and the next lesson. */
  function whatNext({ el, done, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now score a match with the dot product, say why a long vector wins it, and fix that with cosine similarity: by hand, in plain Python and with NumPy. You also know when the dot product is the right call, and that an all-zero vector has no cosine.</p>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write <code>dot(a, b)</code> and <code>cosine(a, b)</code> yourself and use them to rank a small film catalogue for one viewer.</p>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. It explains the <code>films @ taste</code> line: a table times a list is one dot product per row, done all at once.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "The dot product and cosine similarity",
    checked: "2026-11-14",
    sources: [
      "https://numpy.org/doc/stable/reference/generated/numpy.matmul.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.dot.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.linalg.norm.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.argsort.html",
      "https://numpy.org/doc/stable/reference/routines.err.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.cosine_similarity.html",
      "https://developers.google.com/machine-learning/clustering/dnn-clustering/supervised-similarity",
      "https://developers.openai.com/api/docs/guides/embeddings"
    ],
    interview: [{
      q: "Your recommendation feed scores items by the dot product of a user vector and an item vector, and every user keeps getting the same few blockbusters. What is going on, and what do you try?",
      good: [
        "The dot product grows with vector length, and popular items tend to have long vectors, so they score high for almost anyone",
        "Print the lengths of the top items next to the rest to confirm it",
        "Try cosine similarity, or store item vectors divided by their length, and compare the rankings on a few real users",
        "Decide on purpose how much popularity should count instead of leaving it to vector length",
        "Handle users with no history separately: an all-zero vector has no cosine"
      ],
      weak: "Retrain a bigger model or add more features, without looking at the vector lengths that drive the score."
    }, {
      q: "A teammate switches search from dot product to cosine similarity on embedding vectors, and the ranking does not change at all. Is the switch broken?",
      good: [
        "Probably not: if the vectors already have length 1, the dot product and the cosine are the same number",
        "Check by printing np.linalg.norm of a few stored vectors",
        "Also, dividing by the query's own length never changes the order for one query, only the item lengths can",
        "If they are length 1, keep the plain dot product: it is cheaper"
      ],
      weak: "Assume the code is wrong and debug the switch, without checking the vector lengths first."
    }],
    screens: [score, spot, cosHand, predict, scratch, library, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: [...FILMS.map(() => ".lpanel > .lopts [data-right]"), "#c-pick [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: [...FILMS.map(() => ".lpanel > .lopts [data-right]"), "#c-pick [data-right]"] },
      { wrong: ["#q1 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: [...Array(TRACE.map(t => t[0]).lastIndexOf(3)).fill("[data-next]"), "#c-pred [data-wrong]"],
        right: ["#c-pred [data-right]", ...Array(TRACE.length - 1 - TRACE.map(t => t[0]).lastIndexOf(3)).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: Q6.map(() => "[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
