/* Lesson: vector indexes, exact search against fast search.
   Story: a hardware store's parts lookup. Staff describe a screw or bracket in words; the search turns the words
   into a vector and returns the catalogue parts whose vectors are nearest.
   Ideas: (1) exact search compares the query with every part; a clustered index (IVF) compares it with a few
   cluster centres and only the parts in the nearest lists, and can miss a neighbour that sits in the next list;
   (2) at catalogue size, nprobe trades recall for speed, and a vector database earns its place when the data
   changes all day, needs filters, or is shared by many servers.
   Data: docs/ai-path/runs/s5a-vector-indexes/
     toy.py -> toy.out.txt: twelve parts with made-up 2-D positions, k-means with 3 centres, exact and clustered
       search, and the line-by-line traces of exact_search and ivf_search (nprobe = 1) replayed on screen 5;
     faiss_scale.py -> faiss_scale.out.txt: FAISS IndexFlatL2 against IndexIVFFlat on 200,000 synthetic
       384-number vectors (recall@10, ms per query, vectors compared, for each nprobe); env.txt: versions.
   No model calls were recorded for this lesson.
   Lesson-local: a small SVG "parts map" (lists drawn as boxes, centres as crosses) and its CSS, prefixed
   lx-s5a-vector-indexes-. Every number on screen is computed here from PARTS, QUERY, KM, TRACE_* and FAISS.
   Plain browser script. */
(() => {
  const ID = "s5a-vector-indexes";
  const P = "lx-" + ID + "-";

  /* ---------- data from docs/ai-path/runs/s5a-vector-indexes/toy.py (positions made up for the lesson) ---------- */
  // [letter, name, column, row] on a 7 x 7 grid, row 0 at the top
  const PARTS = [
    ["A", "40 mm zinc corner brace", 2, 1], ["B", "150 mm shelf bracket", 1, 0], ["C", "flat mending plate", 0, 2], ["D", "heavy L-bracket", 1, 2],
    ["E", "wood screw 4 × 40", 5, 1], ["F", "drywall screw 3.5 × 35", 6, 0], ["G", "chipboard screw 4 × 30", 6, 2], ["H", "corner brace set with 8 screws", 4, 2],
    ["I", "cabinet hinge 35 mm", 1, 5], ["J", "brass cup hook", 3, 6], ["K", "gate hinge", 0, 6], ["L", "door stop", 2, 5]
  ];
  const QUERY = { text: "small zinc corner bracket", c: 3, r: 2 };
  const SIZE = 7, K = 3;
  // From toy.out.txt: k-means centres after each round (seed 0), the final centres and the three lists
  const KM = {
    history: [[[4.0, 2.0], [6.0, 2.0], [1.0, 5.0]], [[2.6, 1.2], [6.0, 1.0], [1.2, 4.8]], [[1.6, 1.4], [5.667, 1.0], [1.5, 5.5]], [[1.0, 1.25], [5.25, 1.25], [1.5, 5.5]], [[1.0, 1.25], [5.25, 1.25], [1.5, 5.5]]],
    centres: [[1.0, 1.25], [5.25, 1.25], [1.5, 5.5]],
    lists: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]]
  };
  // From toy.out.txt: TRACE exact_search, then TRACE ivf_search nprobe=1 (line = listing line of that function)
  const TRACE_EXACT = [
    { line: 1, event: "line", vars: { k: 3 } },
    { line: 2, event: "line", vars: { k: 3, dists: [1.414, 2.828, 3.0, 2.0, 2.236, 3.606, 3.0, 1.0, 3.606, 4.0, 5.0, 3.162] } },
    { line: 3, event: "line", vars: { k: 3, dists: [1.414, 2.828, 3.0, 2.0, 2.236, 3.606, 3.0, 1.0, 3.606, 4.0, 5.0, 3.162], order: [7, 0, 3, 4, 1, 2, 6, 11, 5, 8, 9, 10] } },
    { line: 3, event: "return", vars: { k: 3, dists: [1.414, 2.828, 3.0, 2.0, 2.236, 3.606, 3.0, 1.0, 3.606, 4.0, 5.0, 3.162], order: [7, 0, 3, 4, 1, 2, 6, 11, 5, 8, 9, 10] } }
  ];
  const TRACE_IVF = [
    { line: 2, event: "line", vars: { k: 3, nprobe: 1 } },
    { line: 3, event: "line", vars: { k: 3, nprobe: 1, c_dists: [2.136, 2.372, 3.808] } },
    { line: 4, event: "line", vars: { k: 3, nprobe: 1, c_dists: [2.136, 2.372, 3.808], probe: [0] } },
    { line: 4, event: "line", vars: { k: 3, nprobe: 1, c_dists: [2.136, 2.372, 3.808], probe: [0] } },
    { line: 5, event: "line", vars: { k: 3, nprobe: 1, c_dists: [2.136, 2.372, 3.808], probe: [0], groups: [[0, 1, 2, 3]] } },
    { line: 6, event: "line", vars: { k: 3, nprobe: 1, c_dists: [2.136, 2.372, 3.808], probe: [0], groups: [[0, 1, 2, 3]], candidates: [0, 1, 2, 3] } },
    { line: 7, event: "line", vars: { k: 3, nprobe: 1, c_dists: [2.136, 2.372, 3.808], probe: [0], groups: [[0, 1, 2, 3]], candidates: [0, 1, 2, 3], rows: [[2.0, 1.0], [1.0, 0.0], [0.0, 2.0], [1.0, 2.0]] } },
    { line: 8, event: "line", vars: { k: 3, nprobe: 1, c_dists: [2.136, 2.372, 3.808], probe: [0], groups: [[0, 1, 2, 3]], candidates: [0, 1, 2, 3], rows: [[2.0, 1.0], [1.0, 0.0], [0.0, 2.0], [1.0, 2.0]], dists: [1.414, 2.828, 3.0, 2.0] } },
    { line: 9, event: "line", vars: { k: 3, nprobe: 1, c_dists: [2.136, 2.372, 3.808], probe: [0], groups: [[0, 1, 2, 3]], candidates: [0, 1, 2, 3], rows: [[2.0, 1.0], [1.0, 0.0], [0.0, 2.0], [1.0, 2.0]], dists: [1.414, 2.828, 3.0, 2.0], order: [0, 3, 1] } },
    { line: 9, event: "return", vars: { k: 3, nprobe: 1, c_dists: [2.136, 2.372, 3.808], probe: [0], groups: [[0, 1, 2, 3]], candidates: [0, 1, 2, 3], rows: [[2.0, 1.0], [1.0, 0.0], [0.0, 2.0], [1.0, 2.0]], dists: [1.414, 2.828, 3.0, 2.0], order: [0, 3, 1] } }
  ];
  /* ---------- data from docs/ai-path/runs/s5a-vector-indexes/faiss_scale.out.txt (run 2026-11-13, Apple M1, one thread) ---------- */
  const FAISS = {
    N: 200000, D: 384, queries: 500, topics: 1000, k: 10, nlist: 2048, train: 100000,
    flatMs: 7.365,
    // [nprobe, recall@10, ms per query, vectors compared per query (mean)]
    rows: [[1, 0.735, 0.074, 153], [2, 0.893, 0.077, 251], [4, 0.928, 0.091, 515], [8, 0.937, 0.113, 1122], [16, 0.945, 0.162, 2294],
      [32, 0.953, 0.274, 4615], [64, 0.963, 0.471, 9156], [128, 0.975, 0.844, 17977], [256, 0.986, 1.744, 35009], [512, 0.995, 2.989, 67249], [2048, 1.0, 9.153, 200000]]
  };

  /* ---------- derived, all computed ---------- */
  const fmt = n => n.toLocaleString("en");
  const f2 = x => x.toFixed(2);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const Q = [QUERY.c, QUERY.r];
  const POS = PARTS.map(p => [p[2], p[3]]);
  const D_Q = POS.map(p => dist(p, Q));
  const BY_D = PARTS.map((_, i) => i).sort((a, b) => D_Q[a] - D_Q[b]);
  const EXACT = BY_D.slice(0, K);
  const L = i => PARTS[i][0];
  const nameOf = i => `${L(i)} (${PARTS[i][1]})`;
  const C_D = KM.centres.map(c => dist(c, Q));
  const C_ORDER = KM.centres.map((_, i) => i).sort((a, b) => C_D[a] - C_D[b]);
  const listOf = i => KM.lists.findIndex(l => l.includes(i));
  const ivf = nprobe => {
    const cand = C_ORDER.slice(0, nprobe).flatMap(c => KM.lists[c]);
    return { cand, top: cand.slice().sort((a, b) => D_Q[a] - D_Q[b]).slice(0, K), compared: KM.centres.length + cand.length };
  };
  const IVF1 = ivf(1), IVF2 = ivf(2);
  const MISSED = EXACT.filter(i => !IVF1.top.includes(i));
  const KM_ROUNDS = KM.history.length - 1;
  const ROWS = FAISS.rows.map(([nprobe, recall, ms, compared]) => ({ nprobe, recall, ms, compared }));
  const ALL = ROWS[ROWS.length - 1];
  const TARGET = 0.95;
  const PICK = ROWS.find(r => r.recall >= TARGET);
  const times = (a, b) => Math.round(a / b);

  let esc = s => String(s);
  function style(kit) {
    esc = kit.esc;
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}map { margin-top: 18px; max-width: 420px; }
.${P}map svg { display: block; width: 100%; height: auto; }
.${P}map .gl { stroke: var(--line); stroke-width: 2; }
.${P}map .box { fill: none; stroke: var(--muted); stroke-width: 4; stroke-dasharray: 14 10; }
.${P}map .box.open { stroke: var(--ink); stroke-width: 7; stroke-dasharray: none; }
.${P}map .box.shut { stroke: var(--faint); }
.${P}map .bl { font: 700 30px var(--mono); fill: var(--muted); }
.${P}map .bl.open { fill: var(--ink); }
.${P}map .bl.shut { fill: var(--faint); }
.${P}map .pt circle { fill: var(--surface); stroke: var(--ink-2); stroke-width: 4; }
.${P}map .pt text { font: 700 34px var(--mono); fill: var(--ink); text-anchor: middle; dominant-baseline: central; }
.${P}map .pt.found circle { fill: var(--good); stroke: var(--good); }
.${P}map .pt.found text { fill: var(--bg); }
.${P}map .pt.miss circle { fill: var(--bad-soft); stroke: var(--bad); stroke-width: 6; }
.${P}map .pt.miss text { fill: var(--bad); }
.${P}map .pt.shut circle { fill: var(--bg); stroke: var(--faint); }
.${P}map .pt.shut text { fill: var(--faint); }
.${P}map .q rect { fill: var(--bg); stroke: var(--ink); stroke-width: 8; }
.${P}map .q text { font: 800 34px var(--mono); fill: var(--ink); text-anchor: middle; dominant-baseline: central; }
.${P}map .cx line { stroke: var(--ink); stroke-width: 6; }
.${P}map .cx text { font: 700 26px var(--mono); fill: var(--ink-2); paint-order: stroke; stroke: var(--bg); stroke-width: 8px; }
.${P}map .cx.shut line { stroke: var(--faint); }
.${P}map .cx.shut text { fill: var(--faint); }
.${P}names { margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 2px 14px; font: 500 13.5px/1.45 var(--font); color: var(--ink-2); }
.${P}names b { font: 700 13.5px var(--mono); color: var(--ink); margin-right: 6px; }
.${P}blk { margin-top: 16px; }
.${P}blk > p { margin: 0 0 4px; font-weight: 600; }
.${P}tbl { width: 100%; border-collapse: collapse; margin-top: 12px; font: 500 14px var(--mono); }
.${P}tbl th, .${P}tbl td { border-bottom: 1px solid var(--line); padding: 6px 6px; text-align: right; }
.${P}tbl th:first-child, .${P}tbl td:first-child { text-align: left; }
.${P}tbl th { font: 600 12.5px var(--font); color: var(--muted); }
.${P}tbl tr.hide td { color: var(--faint); }
.${P}tbl tr.mark td { font-weight: 700; border-top: 1.5px solid var(--ink); border-bottom: 1.5px solid var(--ink); }
.${P}src { font: 500 12.5px var(--mono); color: var(--muted); margin-top: 6px; }
`;
    document.head.appendChild(s);
  }

  /* The parts map: a lesson-local SVG. pts: { index: "found" | "miss" | "shut" }, lists: { listIndex: "open" | "shut" } */
  function partsMap({ pts = {}, lists = null, centres = false, title = "" } = {}) {
    const U = 100, X = c => c * U + U / 2;
    let h = "";
    for (let i = 0; i <= SIZE; i++) h += `<line class="gl" x1="${i * U}" y1="0" x2="${i * U}" y2="${SIZE * U}"/><line class="gl" x1="0" y1="${i * U}" x2="${SIZE * U}" y2="${i * U}"/>`;
    if (lists) KM.lists.forEach((l, li) => {
      const cs = l.map(i => POS[i][0]), rs = l.map(i => POS[i][1]);
      const x0 = Math.min(...cs) * U + 6, y0 = Math.min(...rs) * U + 6, x1 = (Math.max(...cs) + 1) * U - 6, y1 = (Math.max(...rs) + 1) * U - 6;
      const st = lists[li] || "";
      const ly = y0 > 60 ? y0 - 14 : y1 + 34;
      h += `<rect class="box ${st}" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="18"/><text class="bl ${st}" x="${x0 + 6}" y="${ly}">list ${li + 1}</text>`;
    });
    // centre crosses go under the part circles (a centre can sit almost on a part); their labels go on top
    const cst = ci => lists && lists[ci] === "shut" ? "shut" : "";
    if (centres) KM.centres.forEach(([c, r], ci) => {
      const x = X(c), y = X(r);
      h += `<g class="cx ${cst(ci)}"><line x1="${x - 16}" y1="${y - 16}" x2="${x + 16}" y2="${y + 16}"/><line x1="${x - 16}" y1="${y + 16}" x2="${x + 16}" y2="${y - 16}"/></g>`;
    });
    PARTS.forEach((p, i) => { h += `<g class="pt ${pts[i] || ""}"><circle cx="${X(p[2])}" cy="${X(p[3])}" r="33"/><text x="${X(p[2])}" y="${X(p[3])}">${p[0]}</text></g>`; });
    if (centres) KM.centres.forEach(([c, r], ci) => {
      const x = X(c), y = X(r);
      // put the label on the side farthest from any part or the query
      const spots = [...POS, Q].map(([pc, pr]) => [X(pc), X(pr)]);
      const off = [[16, 46], [-52, -22], [16, -22], [-52, 46]].map(o => [o, Math.min(...spots.map(([sx, sy]) => Math.hypot(x + o[0] + 15 - sx, y + o[1] - 9 - sy)))]).sort((m, n) => n[1] - m[1])[0][0];
      h += `<g class="cx ${cst(ci)}"><text x="${x + off[0]}" y="${y + off[1]}">c${ci + 1}</text></g>`;
    });
    h += `<g class="q"><rect x="${X(Q[0]) - 34}" y="${X(Q[1]) - 34}" width="68" height="68" rx="10"/><text x="${X(Q[0])}" y="${X(Q[1])}">Q</text></g>`;
    return `<div class="${P}map">${title ? `<div class="lp-cap">${esc(title)}</div>` : ""}<svg viewBox="-4 -4 ${SIZE * U + 8} ${SIZE * U + 8}" role="img" aria-label="parts map">${h}</svg></div>`;
  }
  const names = () => `<div class="${P}names">${PARTS.map(p => `<span><b>${p[0]}</b>${esc(p[1])}</span>`).join("")}</div>`;

  /* 1. The situation, by hand: find the three nearest parts on the grid. */
  function byHand({ el, done, kit }) {
    style(kit);
    const found = new Set(), wrong = new Set();
    let msg = null;
    const at = {};
    PARTS.forEach((p, i) => { at[`${p[3]},${p[2]}`] = i; });
    const paint = () => {
      const rows = Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => r === Q[1] && c === Q[0] ? "Q" : at[`${r},${c}`] != null ? L(at[`${r},${c}`]) : ""));
      const cls = { [`${Q[1]},${Q[0]}`]: "accent" };
      found.forEach(i => { cls[`${POS[i][1]},${POS[i][0]}`] = "enter"; });
      wrong.forEach(i => { cls[`${POS[i][1]},${POS[i][0]}`] = "no"; });
      const fin = found.size === K;
      el.innerHTML = `<h1>Which parts match “${esc(QUERY.text)}”?</h1>
        <p class="lead">A hardware store has a parts lookup for its staff. A customer describes a part; the staff member types the description, and the search turns it into a vector, as in the last lesson. The parts whose vectors sit <b>nearest</b> to it come back. This "find the nearest vectors" step sits behind every semantic search and RAG app. This lesson is about doing it fast.</p>
        <p class="lead">Real vectors have hundreds of numbers. Here each part has two, so you can see them: the positions are made up for this lesson. <b>Q</b> is the query “${esc(QUERY.text)}”.</p>
        <p class="task">Tap the ${K} parts nearest to Q, measured in a straight line, as a ruler would.</p>
        ${kit.pics.grid(rows, { cls, pick: (r, c) => !fin && at[`${r},${c}`] != null && !found.has(at[`${r},${c}`]), title: "the catalogue: one cell per part, Q = the query" })}
        ${names()}
        <div class="lpanel">${fin
          ? kit.feedback(`Right: <b>${EXACT.map(i => `${L(i)} ${f2(D_Q[i])}`).join(", ")}</b>. To be sure, you had to judge the distance from Q to all ${PARTS.length} parts, and the nearest, ${nameOf(EXACT[0])}, sits among the screws, because its description mentions screws. Comparing the query with every part is called <b>exact search</b>, or brute force. It never misses, and its work grows with the catalogue: one distance per part, per lookup.`, true)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll("button.lp-gc").forEach(b => b.onclick = () => {
        const i = at[b.dataset.i];
        if (i == null || found.has(i)) return;
        if (EXACT.includes(i)) { found.add(i); wrong.delete(i); msg = [`${L(i)} is ${f2(D_Q[i])} away from Q: one of the ${K} nearest. ${K - found.size ? `${K - found.size} to go.` : ""}`]; }
        else {
          wrong.add(i);
          const closer = BY_D.filter(j => D_Q[j] < D_Q[i]).length;
          msg = [`${L(i)} is ${f2(D_Q[i])} away. ${closer} parts are closer to Q than that, so it is not in the top ${K}. Count grid steps across and down, then take the straight line: one step across and one down is ${f2(Math.SQRT2)}, not 2.`, false];
        }
        paint();
        if (found.size === K) done();
      });
    };
    paint();
  }

  /* 2. Spot the idea: skip most parts by grouping them ahead of time. */
  function spotIdea({ el, done, kit }) {
    style(kit);
    let ans = null;
    const SAMPLE = 10000;
    const opts = [
      "Sort the parts by their first number once, then jump to the parts whose first number is closest to the query's",
      "Group the parts into clusters once, ahead of time. For each lookup, find the nearest cluster centres and compare the query only with the parts in those clusters",
      `Compare the query with a random ${fmt(SAMPLE)} parts instead of all of them`
    ];
    const correct = 1;
    const same = PARTS.map((_, i) => i).filter(i => POS[i][0] === Q[0]);
    const rankOf = i => BY_D.indexOf(i) + 1;
    const paint = () => {
      el.innerHTML = `<h1>${fmt(FAISS.N)} parts, ${FAISS.D} numbers each</h1>
        <p class="lead">The store's full catalogue has ${fmt(FAISS.N)} parts, and each vector has ${FAISS.D} numbers. Exact search computes ${fmt(FAISS.N)} distances for every lookup, and each distance reads ${FAISS.D} pairs of numbers. Staff look things up all day.</p>
        <p class="task">Which idea lets a lookup skip most of the parts and still find good matches?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Group once, then each lookup compares the query with a few centres and opens only the nearest groups. Similar parts sit near each other, so the best matches are usually in the nearest group. Usually, not always: a part just over the border lives in the next group. That is the price of the speed, and the next screen shows it.`, true)
          : ans === 0 ? kit.feedback(`One number out of many says little. On the grid, ${same.map(L).join(" and ")} ${same.length === 1 ? "has" : "have"} exactly Q's first number, ${Q[0]}, yet ${same.map(i => `${L(i)} is ${f2(D_Q[i])} away, number ${rankOf(i)} of ${PARTS.length} by distance`).join("; ")}. With ${FAISS.D} numbers, parts that agree on one of them can still be far apart on the other ${FAISS.D - 1}.`, false)
          : kit.feedback(`A random ${fmt(SAMPLE)} is ${Math.round(SAMPLE / FAISS.N * 100)}% of the catalogue, so the best match is left out ${100 - Math.round(SAMPLE / FAISS.N * 100)} times in 100. The sample knows nothing about where the query is. A good shortcut uses the query to decide where to look.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Use it: open the nearest list, predict which neighbour it misses. */
  function openOne({ el, done, kit }) {
    style(kit);
    let a = null, b = null;
    const rightA = C_ORDER[0];
    const optsB = [...EXACT.map(L), "none, it finds all three"];
    const rightB = EXACT.indexOf(MISSED[0]);
    const paint = () => {
      const okA = a === rightA, okB = b === rightB;
      const lists = okA ? Object.fromEntries(KM.lists.map((_, li) => [li, li === rightA ? "open" : "shut"])) : {};
      const pts = {};
      if (okA) PARTS.forEach((_, i) => { if (listOf(i) !== rightA) pts[i] = "shut"; });
      if (okB) { IVF1.top.forEach(i => { if (EXACT.includes(i)) pts[i] = "found"; }); MISSED.forEach(i => { pts[i] = "miss"; }); }
      el.innerHTML = `<h1>Open only the nearest list</h1>
        <p class="lead">Ahead of time, a short loop called <b>k-means</b> placed ${KM.centres.length} centres (the crosses). Each round, it puts every part with its nearest centre, then moves each centre to the average position of its parts. It stops when nothing moves: here, after ${KM_ROUNDS} rounds. Each centre now owns a <b>list</b> of parts (the dashed boxes).</p>
        <p class="lead">A lookup measures Q against the ${KM.centres.length} centres, opens the nearest list, and compares Q only with the parts in it.</p>
        ${partsMap({ pts, lists, centres: true, title: "crosses: centres; boxes: the parts each centre owns" })}
        <div class="${P}blk" id="a"><p class="task">Which list does the lookup open?</p>${kit.options(KM.lists.map((l, li) => `list ${li + 1} (${l.map(L).join(" ")})`), { picked: a, correct: rightA })}
        ${a == null ? "" : okA ? kit.feedback(`Right. Q to the centres: ${C_D.map((d, ci) => `c${ci + 1} ${f2(d)}`).join(", ")}. c${rightA + 1} is nearest, so list ${rightA + 1} opens and the others are skipped (faded).`, true)
          : kit.feedback(`Measure Q to the crosses, not to the parts. Q to the centres: ${C_D.map((d, ci) => `c${ci + 1} ${f2(d)}`).join(", ")}. ${a === listOf(EXACT[0]) ? `List ${a + 1} holds the single nearest part, but the search does not know that yet: it only sees centres.` : ""}`, false)}</div>
        ${okA ? `<div class="${P}blk" id="b"><p class="task">Your ${K} nearest were ${EXACT.map(L).join(", ")}. Which one does this lookup miss?</p>${kit.options(optsB, { picked: b, correct: rightB })}
        ${b == null ? "" : okB ? kit.feedback(`Right. ${nameOf(MISSED[0])} is the nearest part of all, ${f2(D_Q[MISSED[0]])} from Q, but it sits in list ${listOf(MISSED[0]) + 1}, which was never opened. The lookup returns <b>${IVF1.top.map(L).join(", ")}</b>: it found ${K - MISSED.length} of the ${K} true nearest. That share is called <b>recall</b>: ${K - MISSED.length} ÷ ${K} = ${f2((K - MISSED.length) / K)}. It computed ${IVF1.compared} distances (${KM.centres.length} centres + ${IVF1.cand.length} parts) instead of ${PARTS.length}.`, true)
          : b === K ? kit.feedback(`Only list ${rightA + 1} is searched, so only ${KM.lists[rightA].map(L).join(", ")} can come back. Check where each of ${EXACT.map(L).join(", ")} lives.`, false)
          : kit.feedback(`${L(EXACT[b])} is in list ${listOf(EXACT[b]) + 1}, the list that was opened, so it is found. Look for the one that lives in a different box.`, false)}</div>` : ""}`;
      const bind = (id, set) => el.querySelectorAll(`#${id} .lopts button`).forEach(x => x.onclick = () => { set(+x.dataset.i); paint(); if (a === rightA && b === rightB) done(); });
      bind("a", v => { a = v; });
      if (okA) bind("b", v => { b = v; });
    };
    paint();
  }

  /* 4. The knob: open two lists. */
  function openTwo({ el, done, kit }) {
    style(kit);
    const optsF = Array.from({ length: K + 1 }, (_, i) => `${i} of ${K}`);
    const rightF = IVF2.top.filter(i => EXACT.includes(i)).length;
    const optsC = [...new Set([IVF1.compared, IVF2.compared, PARTS.length, KM.centres.length + PARTS.length])].sort((x, y) => x - y);
    const rightC = optsC.indexOf(IVF2.compared);
    let f = null, c = null;
    const paint = () => {
      const okF = f === rightF, okC = c === rightC, fin = okF && okC;
      const open = C_ORDER.slice(0, 2);
      const lists = Object.fromEntries(KM.lists.map((_, li) => [li, open.includes(li) ? "open" : "shut"]));
      const pts = {};
      PARTS.forEach((_, i) => { if (!open.includes(listOf(i))) pts[i] = "shut"; });
      if (fin) IVF2.top.forEach(i => { pts[i] = "found"; });
      el.innerHTML = `<h1>Open two lists instead</h1>
        <p class="lead">The number of lists a lookup opens is a setting. FAISS, the library on the next screens, calls it <b>nprobe</b>. With nprobe = 2, the lookup opens the two lists whose centres are nearest to Q: list ${open[0] + 1} and list ${open[1] + 1}.</p>
        ${partsMap({ pts, lists, centres: true, title: "nprobe = 2: two boxes open" })}
        <div class="${P}blk" id="f"><p class="task">How many of the true ${K} nearest (${EXACT.map(L).join(", ")}) does it find now?</p>${kit.options(optsF, { picked: f, correct: rightF })}
        ${f == null ? "" : okF ? kit.feedback(`Right: list ${open[1] + 1} holds ${L(MISSED[0])}, so the top ${K} is now ${IVF2.top.map(L).join(", ")}, the same as exact search. Recall ${f2(rightF / K)}.`, true)
          : kit.feedback(f < rightF ? `More lists open means more parts compared, and a part that was found before stays found. ${L(MISSED[0])} lives in list ${listOf(MISSED[0]) + 1}, which is open now.` : `There are only ${K} true nearest parts to find.`, false)}</div>
        <div class="${P}blk" id="c"><p class="task">How many distances does this lookup compute?</p>${kit.options(optsC.map(String), { picked: c, correct: rightC, num: true })}
        ${c == null ? "" : okC ? kit.feedback(`Right: ${KM.centres.length} centres + ${IVF2.cand.length} parts in the two open lists = ${IVF2.compared}.`, true)
          : kit.feedback(optsC[c] === IVF1.compared ? `${IVF1.compared} was one list. Now two lists are open: ${KM.centres.length} centres, plus the parts in both boxes.`
            : optsC[c] === PARTS.length ? `${PARTS.length} is exact search: every part. The third list stays shut, and the ${KM.centres.length} centres are measured too.`
            : `That counts all ${PARTS.length} parts plus the centres. The third list stays shut, so its parts are never measured.`, false)}</div>
        ${fin ? `<div class="lpanel">${kit.feedback(`So nprobe is the trade: open more lists, find more of the true neighbours, and do more work. Here ${IVF2.compared} distances is almost the ${PARTS.length} of exact search, because ${PARTS.length} parts is tiny. With ${fmt(FAISS.N)} parts and thousands of lists, opening a few lists skips almost everything. This kind of index is called <b>IVF</b>, an inverted file index: each list holds the ids of the parts that belong to one centre. An index like this, which may miss a true neighbour to save work, is called <b>approximate</b>.`)}</div>` : ""}`;
      const bind = (id, set) => el.querySelectorAll(`#${id} .lopts button`).forEach(x => x.onclick = () => { set(+x.dataset.i); paint(); if (f === rightF && c === rightC) done(); });
      bind("f", v => { f = v; });
      bind("c", v => { c = v; });
    };
    paint();
  }

  /* 5. From scratch in NumPy: exact_search, then ivf_search with nprobe = 1 (recorded traces). */
  const CODE = [
    "def exact_search(parts, query, k):",
    "    dists = norm(parts - query, axis=1)",
    "    order = np.argsort(dists)",
    "    return order[:k]",
    "",
    "def ivf_search(parts, centres, lists,",
    "               query, k, nprobe):",
    "    c_dists = norm(centres - query, axis=1)",
    "    probe = np.argsort(c_dists)[:nprobe]",
    "    groups = [lists[c] for c in probe]",
    "    candidates = np.concatenate(groups)",
    "    rows = parts[candidates]",
    "    dists = norm(rows - query, axis=1)",
    "    order = np.argsort(dists)[:k]",
    "    return candidates[order]"
  ];
  const IVF_AT = 5;
  // A trace step says "about to run line n, with these variables". On screen each step shows the line that has
  // just run and the variables after it: the line of trace step j-1 with the variables of step j. Python reports
  // the line with the list comprehension twice; the two are shown as one step (the later variables).
  const afterSteps = (trace, fn, off) => {
    const out = [{ fn, ln: off, ret: false, vars: trace[0].vars }];
    for (let j = 1; j < trace.length; j++) {
      const st = { fn, ln: trace[j - 1].line + off, ret: trace[j].event === "return", vars: trace[j].vars };
      if (out[out.length - 1].ln === st.ln && !st.ret) out[out.length - 1] = st; else out.push(st);
    }
    return out;
  };
  const STEPS = [...afterSteps(TRACE_EXACT, "exact", 0), ...afterSteps(TRACE_IVF, "ivf", IVF_AT)];
  function asCode({ el, done, kit }) {
    style(kit);
    let i = 0;
    const letters = a => a.map(L).join(" ");
    const say = s => {
      const v = s.vars;
      if (s.fn === "exact") {
        if (s.ln === 0) return `Exact search is called with all ${PARTS.length} parts as rows of <code>parts</code>, Q as <code>query</code>, and k = ${v.k}.`;
        if (s.ln === 1) return `One line computes the distance from Q to every row: ${v.dists.length} numbers, one per part. Row 7, part ${L(7)}, is ${v.dists[7]} away.`;
        if (s.ln === 2) return `<code>argsort</code> lists the row numbers from nearest to farthest: ${v.order.slice(0, 4).join(", ")}, … that is ${letters(v.order.slice(0, 4))}, …`;
        return `Return the first ${v.k}: [${v.order.slice(0, v.k).join(", ")}], parts ${letters(v.order.slice(0, v.k))}. Your ${K} picks from screen 1, after ${v.dists.length} distances.`;
      }
      if (s.ln === IVF_AT) return `The clustered search is called with the same parts and query, the ${KM.centres.length} centres and their lists, and nprobe = ${v.nprobe}.`;
      if (s.ln === IVF_AT + 2) return `Q against the ${KM.centres.length} centres only: <code>c_dists</code> = [${v.c_dists.join(", ")}]. Centre 0 (c1 on the map) is nearest.`;
      if (s.ln === IVF_AT + 3) return `<code>probe</code> = [${v.probe.join(", ")}]: open list ${v.probe[0]}, which the map calls list ${v.probe[0] + 1} (Python counts from 0).`;
      if (s.ln === IVF_AT + 4) return `<code>groups</code> holds the open lists: ${v.groups.length === 1 ? "just one" : v.groups.length}, [${v.groups[0].join(", ")}].`;
      if (s.ln === IVF_AT + 5) return `<code>candidates</code> = [${v.candidates.join(", ")}], parts ${letters(v.candidates)}: the open lists joined into one. Only these get a distance.`;
      if (s.ln === IVF_AT + 6) return `<code>rows</code> picks the positions of those ${v.rows.length} parts out of <code>parts</code>.`;
      if (s.ln === IVF_AT + 7) return `<code>dists</code> = [${v.dists.join(", ")}], one per candidate: ${v.dists.length} distances instead of ${PARTS.length}.`;
      if (s.ln === IVF_AT + 8) return `<code>order</code> = [${v.order.join(", ")}]. These are positions <i>inside</i> candidates, not part numbers. The next line maps them back.`;
      return `Return [${v.order.map(o => v.candidates[o]).join(", ")}]: parts ${letters(v.order.map(o => v.candidates[o]))}. Part ${L(MISSED[0])} was never a candidate: the miss you predicted.`;
    };
    const paint = () => {
      const s = STEPS[i], v = s.vars;
      const show = (k, f) => v[k] != null ? `<span>${k} <b>${f ? f(v[k]) : Array.isArray(v[k]) ? "[" + v[k].join(", ") + "]" : v[k]}</b></span>` : "";
      el.innerHTML = `<h1>Both searches, from scratch</h1>
        <p class="lead">The same two searches in Python with NumPy. <code>norm(..., axis=1)</code>, imported from <code>numpy.linalg</code>, is the straight-line distance for every row at once; <code>np.argsort</code> gives the row numbers sorted by distance. A recorded run on the ${PARTS.length} parts, rows numbered 0 (${L(0)}) to ${PARTS.length - 1} (${L(PARTS.length - 1)}).</p>
        <p class="task">Step through both functions to the last return.</p>
        ${kit.code(CODE, s.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === STEPS.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${s.fn === "exact" ? show("dists", d => d.length ? `${d.length} numbers` : "") : ""}${show("nprobe")}${show("c_dists")}${show("probe")}${show("candidates")}${show("rows", r => `${r.length} rows`)}${s.fn === "exact" ? show("order", o => "[" + o.slice(0, 5).join(", ") + ", …]") : show("dists")}${s.fn === "exact" ? "" : show("order")}<span>step <b>${i + 1} / ${STEPS.length}</b></span></div>
        ${kit.feedback(say(s))}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === STEPS.length - 1) done(); };
    };
    paint();
  }

  /* 6. The real library at catalogue size: FAISS, recorded run. */
  const FCODE = [
    "flat = faiss.IndexFlatL2(384)",
    "flat.add(catalogue)",
    "quantizer = faiss.IndexFlatL2(384)",
    "ivf = faiss.IndexIVFFlat(",
    "    quantizer, 384, 2048)",
    "ivf.train(train_sample)",
    "ivf.add(catalogue)",
    "ivf.nprobe = 32",
    "distances, ids = ivf.search(query, 10)"
  ];
  function library({ el, done, kit }) {
    style(kit);
    let a = null, b = null;
    const rightA = ALL.ms > FAISS.flatMs * 0.8 ? 1 : 0;
    const choices = ROWS.filter(r => r !== ALL);
    const rightB = choices.indexOf(PICK);
    const paint = () => {
      const okA = a === rightA, okB = b === rightB;
      const tbl = `<table class="${P}tbl"><thead><tr><th>nprobe</th><th>recall@${FAISS.k}</th><th>ms per query</th><th>vectors compared</th></tr></thead><tbody>
        <tr><td>exact (flat)</td><td>${f2(1)}</td><td>${FAISS.flatMs.toFixed(3)}</td><td>${fmt(FAISS.N)}</td></tr>
        ${choices.map(r => `<tr class="${okB && r === PICK ? "mark" : ""}"><td>${r.nprobe}</td><td>${r.recall.toFixed(3)}</td><td>${r.ms.toFixed(3)}</td><td>${fmt(r.compared)}</td></tr>`).join("")}
        <tr class="${okA ? "" : "hide"}"><td>${ALL.nprobe} (all)</td><td>${okA ? ALL.recall.toFixed(3) : "?"}</td><td>${okA ? ALL.ms.toFixed(3) : "?"}</td><td>${okA ? fmt(ALL.compared) : "?"}</td></tr></tbody></table>`;
      el.innerHTML = `<h1>The same idea in FAISS</h1>
        <p class="lead"><b>FAISS</b> is an open-source library for vector search. It has both searches you just built. <code>IndexFlatL2</code> is exact search, like screen 1. <code>IndexIVFFlat</code> is the clustered index, like screens 3 and 4.</p>
        <p class="lead">L2 is the straight-line distance. FAISS reports it squared, which keeps the same order. Our vectors are scaled to length 1, so ranking by L2 gives the same order as cosine similarity. For dot product, FAISS has <code>IndexFlatIP</code>.</p>
        <p class="lead">In the code: the <code>quantizer</code> is a small exact index that holds the centres. <code>train</code> runs k-means to place <b>nlist</b> centres, here ${fmt(FAISS.nlist)}. FAISS's guide suggests 4×√N to 16×√N lists for N vectors, and 30 to 256 training vectors per list. <code>add</code> puts every vector into its list. <b>nprobe</b> is how many lists a search opens; it is 1 unless you set it.</p>
        ${kit.code(FCODE, -1)}
        <p class="lead">We ran it on this Mac with ${fmt(FAISS.N)} vectors of ${FAISS.D} numbers and ${FAISS.queries} queries sent one at a time. The vectors are synthetic, not real embeddings: random points scattered loosely around ${fmt(FAISS.topics)} topic points, so that a query's neighbours often sit in different lists. Recall@${FAISS.k} is the share of the exact top ${FAISS.k} that the index returned.</p>
        ${tbl}
        <p class="${P}src">Recorded run, 2026-11-13, one CPU thread. Times are this machine's; compare them with each other, not with yours.</p>
        <div class="${P}blk" id="a"><p class="task">Predict the last row, nprobe ${ALL.nprobe}: every list is open. How fast is it next to exact search (${FAISS.flatMs.toFixed(3)} ms)?</p>${kit.options(["Much faster than exact search", "About the same, or slower"], { picked: a, correct: rightA })}
        ${a == null ? "" : okA ? kit.feedback(`Right: ${ALL.ms.toFixed(3)} ms with recall ${f2(ALL.recall)}. Opening every list compares every vector, like exact search, plus ${fmt(FAISS.nlist)} centres and the cost of walking ${fmt(FAISS.nlist)} lists. All the speed comes from what you skip.`, true)
          : kit.feedback(`Opening every list means comparing with every vector, the same work as exact search, plus the ${fmt(FAISS.nlist)} centres on top. Nothing is skipped, so nothing is saved. Measured: ${ALL.ms.toFixed(3)} ms.`, false)}</div>
        ${okA ? `<div class="${P}blk" id="b"><p class="task">The team accepts losing about 1 in ${Math.round(1 / (1 - TARGET))} of the true top ${FAISS.k}: recall at least ${f2(TARGET)}. Pick the fastest nprobe that meets it.</p>${kit.options(choices.map(r => `nprobe ${r.nprobe}`), { picked: b, correct: rightB })}
          ${b == null ? "" : okB ? kit.feedback(`Right: nprobe ${PICK.nprobe} gives recall ${PICK.recall.toFixed(3)} in ${PICK.ms.toFixed(3)} ms, about ${times(FAISS.flatMs, PICK.ms)} times fewer milliseconds than exact search, comparing ${fmt(PICK.compared)} vectors instead of ${fmt(FAISS.N)}. The last few points of recall cost the most: going from ${PICK.recall.toFixed(3)} to ${ROWS[ROWS.length - 2].recall.toFixed(3)} costs ${times(ROWS[ROWS.length - 2].ms, PICK.ms)} times more time. On real data, measure this table on your own queries before choosing.`, true)
            : choices[b].recall < TARGET ? kit.feedback(`Recall ${choices[b].recall.toFixed(3)} is under ${f2(TARGET)}: about ${Math.round((1 - choices[b].recall) * 100)} of every 100 true neighbours are lost. Open more lists.`, false)
            : kit.feedback(`Recall ${choices[b].recall.toFixed(3)} meets the target, but ${choices[b].ms.toFixed(3)} ms is slower than needed. A smaller nprobe already reaches ${f2(TARGET)}.`, false)}</div>` : ""}`;
      const bind = (id, set) => el.querySelectorAll(`#${id} .lopts button`).forEach(x => x.onclick = () => { set(+x.dataset.i); paint(); if (a === rightA && b === rightB) done(); });
      bind("a", v => { a = v; });
      if (okA) bind("b", v => { b = v; });
    };
    paint();
  }

  /* 7. The big picture: exact, an in-memory index, or a vector database. */
  const SMALL = 8000, MID = 2000000;
  const smallMs = SMALL / FAISS.N * FAISS.flatMs;
  const midGb = MID * FAISS.D * 4 / 1e9;
  const TOOLS = ["Exact search in memory", "An IVF index in memory (FAISS)", "A vector database"];
  const BIG = [
    { q: `One store's catalogue: ${fmt(SMALL)} parts, one server, a few hundred lookups a day. The catalogue changes a few times a month.`, right: 0,
      why: [`Right. Scaling our measured run, exact search over ${fmt(SMALL)} parts takes roughly ${smallMs.toFixed(2)} ms per lookup. No training, no knob, no missed matches.`,
        `An index would save a fraction of a millisecond and cost recall, training and a setting to tune. At ${fmt(SMALL)} parts exact search is already fast.`,
        `A database adds a service to run and back up. Nothing here needs it: the data is small, on one server, and rarely changes.`] },
    { q: `A national supplier: ${fmt(MID)} parts, rebuilt once a night from the catalogue file, one search server, answers must come back in a few milliseconds.`, right: 1,
      why: [`Exact search reads all ${fmt(MID)} vectors per lookup, ${times(MID, FAISS.N)} times the work of our ${FAISS.N / 1000}k run. A clustered index skips almost all of it.`,
        `Right. The data changes once a day, so rebuild and retrain the index each night, keep it in memory (about ${midGb.toFixed(1)} GB of raw vectors), save it with <code>faiss.write_index</code>. Tune nprobe on real queries.`,
        `Possible, but nothing here needs a database's extras: one server, no live updates, no filters. An in-memory index file does the job with less to run.`] },
    { q: "40 branches. Stock changes all day, lookups must show only parts in stock at the asker's branch, and five app servers share the search.", right: 2,
      why: [`Exact search could be fast enough, but someone still has to keep the vectors up to date for five servers and filter by branch stock. That is a database's job.`,
        `An in-memory index lives inside one program. Five servers would each hold a copy and rebuild it as stock changes, and the branch filter would be your own code.`,
        `Right. A database takes inserts and deletes while it serves, filters by branch in the same query, and is one shared service. In pgvector, for example, a query with no vector index is exact, and you add an approximate index (IVFFlat or HNSW) when it gets slow.`] }
  ];
  function bigPicture({ el, done, kit }) {
    style(kit);
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Exact, an index, or a database?</h1>
        <p class="lead"><b>What for:</b> finding the nearest vectors fast. Three choices, from simplest to most to run:</p>
        <p class="lead"><b>Exact search</b> is right while it is fast enough. It never misses and needs no tuning.</p>
        <p class="lead"><b>An approximate index</b> is for when exact search is too slow. You pay with recall, training and settings to tune. IVF is one kind. A graph index such as HNSW is another: it links each vector to some of its near neighbours and walks those links toward the query. It is faster for the same recall, but uses more memory and is slower to build.</p>
        <p class="lead"><b>A vector database</b> is for when the data changes all day, needs filters, or is shared by many servers. You pay with a service to run.</p>
        <p class="lead"><b>Not for:</b> exact codes; use a key look-up. And use no approximate index where a single miss is not allowed.</p>
        <p class="task">Pick what each situation needs.</p>
        ${BIG.map((c, i) => `<div class="lcase" id="c${i}"><p>${c.q}</p>${kit.options(TOOLS, { picked: ans[i], correct: c.right })}${ans[i] == null ? "" : kit.feedback(c.why[ans[i]], ans[i] === c.right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every((cc, j) => ans[j] === cc.right)) done();
      }));
    };
    paint();
  }

  /* 8. Recognise: is an approximate nearest-neighbour index the right tool? */
  const CASES = [
    ["A clothing shop lets shoppers upload a photo and shows similar items from 3 million product photos, each turned into a vector. The page must answer at once.", true,
      "Yes. Millions of vectors, answers needed at once, and a near-perfect top 10 is good enough: a shopper will not notice one similar shirt missing.",
      "Exact search would compare the photo with all 3 million vectors on every upload. An approximate index skips most of them, and a missed similar shirt costs nothing."],
    ["A library desk types an exact ISBN, such as 978-0-14-044913-6, and wants that one book.", false,
      "No. This is an exact key. A hash map or a database index on the ISBN finds it in one step, with no vectors.",
      "No. A vector search returns things that are <i>similar</i>, so a book whose ISBN differs in one digit could come back first. An exact code needs an exact look-up: a hash map or a database index on the ISBN column."],
    ["A legal team checks 20,000 contract clauses overnight against a banned clause, and every similar clause must be flagged: one miss means a fine.", false,
      "No. Missing one is the failure, so recall must be 1. And 20,000 vectors overnight is easy for exact search, which never misses.",
      "No. An approximate index may miss a neighbour that sits in an unopened list, and here a miss is the worst outcome. With 20,000 clauses and all night to run, exact search is fast enough and never misses."],
    ["Each product page on a site with 500,000 products shows 5 “similar products”, and pages must load fast.", true,
      "Yes. Half a million vectors, a fast answer needed many times a second, and a slightly different set of 5 similar products harms no one.",
      "Exact search over 500,000 vectors for every page view is the slow way. An approximate index answers in a fraction of the time, and recall a little under 1 is fine for suggestions."]
  ];
  function recognise({ el, done, kit }) {
    style(kit);
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would an approximate index help?</h1>
        <p class="lead">Four situations away from the hardware store. An approximate index means something like IVF: fast, but it can miss a true neighbour.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    style(kit);
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can now choose a vector index</h1>
      <p class="lead"><b>Exact search</b> compares the query with every vector: it never misses, and its cost grows with the catalogue. A <b>clustered (IVF) index</b> groups the vectors with k-means ahead of time and opens only the <b>nprobe</b> nearest lists: far less work, but a neighbour just over a border can be missed. Raise nprobe for recall, lower it for speed, and measure both against exact search on your own queries. Reach for a <b>vector database</b> when the data changes all day, needs filters, or is shared by many servers; the cost is a service to run. Stay with exact search while it is fast enough or when one miss is not allowed, and use a key look-up for exact codes.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson. You write <code>exact_search</code> and <code>ivf_search</code> with NumPy and measure recall for nprobe 1, 2 and 3 on a small catalogue.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Vector search finds meaning but stumbles on exact codes such as M6-40-ZN; next you combine it with keyword search and filters.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Vector indexes: exact search against fast search",
    checked: "2026-11-13",
    sources: [
      "https://github.com/facebookresearch/faiss/wiki/Getting-started",
      "https://github.com/facebookresearch/faiss/wiki/Faster-search",
      "https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index",
      "https://github.com/facebookresearch/faiss/wiki/MetricType-and-distances",
      "https://github.com/facebookresearch/faiss/wiki/Faiss-indexes",
      "https://github.com/facebookresearch/faiss/wiki/Index-IO,-cloning-and-hyper-parameter-tuning",
      "https://github.com/pgvector/pgvector",
      "https://arxiv.org/abs/1603.09320"
    ],
    interview: [{
      q: "Your semantic search over 50,000 help articles uses exact (flat) search and answers in a few milliseconds. A teammate wants to switch to an IVF index for speed. What do you say?",
      good: [
        "At 50,000 vectors exact search is already fast; an index saves little and starts losing true matches",
        "An IVF index adds training, an nlist and nprobe to tune, and retraining when the data drifts",
        "If speed really becomes a problem, measure recall@k against exact search on real queries for a few nprobe values and pick from that table",
        "Switch when the catalogue or the traffic grows so that exact search misses the latency target"
      ],
      weak: "Agreeing because approximate indexes are faster, without measuring the current latency or what recall the index would lose."
    }, {
      q: "After moving product search to an approximate index, users say some obvious matches have disappeared. How do you find out what happened and fix it?",
      good: [
        "Take a sample of real queries, run exact search as the ground truth and compute recall@k of the index",
        "If recall is low, raise nprobe (or the graph index's search setting) and measure the latency it costs",
        "Check the build: enough training vectors for the number of lists, and an index retrained after the data changed a lot",
        "If a filter runs after the index scan, as pgvector's approximate indexes do, the index may return too few rows that pass the filter; turn on pgvector's iterative index scans (0.8.0 and later) or raise the search setting"
      ],
      weak: "Switching to a bigger embedding model, without checking whether the index or the embeddings lost the matches."
    }],
    screens: [byHand, spotIdea, openOne, openTwo, asCode, library, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="6,0"]'], right: ['[data-i="2,4"]', '[data-i="1,2"]', '[data-i="2,1"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#a [data-wrong]"], right: ["#a [data-right]", "#b [data-right]"] },
      { wrong: ["#f [data-wrong]"], right: ["#f [data-right]", "#c [data-right]"] },
      { right: Array(STEPS.length - 1).fill("[data-next]") },
      { wrong: ["#a [data-wrong]"], right: ["#a [data-right]", "#b [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
