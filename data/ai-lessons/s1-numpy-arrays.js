/* Lesson s1-numpy-arrays: NumPy arrays, shapes and vectorized maths.
   Story: a fitness app shows a family's week of step counts, 4 people by 7 days. The app needs one total per person
   and one total per day. The learner adds cells by hand, then predicts the shape every total comes out in.
   Ideas: (1) a NumPy array is one rectangular block of numbers of one type, with a shape such as (4, 7); adding
   along an axis removes that axis from the shape; (2) one array operation replaces a Python loop, and runs the loop
   in pre-compiled code, so it is much faster on big grids.
   Depth: explain (screens 1-4, 7-9), scratch (screen 5: the nested Python loop, a traced real run), library
   (screen 6: the same totals with NumPy, a recorded run).
   Runs (no model, no API call): docs/ai-path/runs/s1-numpy-arrays/ (week.py -> week.out.txt = the data, seed 0;
   scratch.py -> scratch.out.txt = the traced loop; library.py -> library.out.txt = the NumPy shapes;
   speed.py -> speed.out.txt = loop against array, timed; ragged.py -> ragged.out.txt = the uneven-rows error; env.txt).
   Facts checked 2026-11-14 against the NumPy manual (whatisnumpy, absolute_beginners, numpy.sum, numpy.mean,
   ufuncs, global_state, numpy.cumsum) and MDN (TypedArray).
   Every number on screen is computed here from WEEK, TRACE, RUN, SPEED and the shapes the runs printed.
   Lesson-local picture and CSS: the week grid with pickable cells, and the shape tag (prefix lx-s1-numpy-arrays-). */
(() => {
  const P = "lx-s1-numpy-arrays-";
  const fmt = n => n.toLocaleString("en");
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];

  // From docs/ai-path/runs/s1-numpy-arrays/week.out.txt (np.random.default_rng(0), integers 2000..13999)
  const PEOPLE = ["Mum", "Dad", "Mia", "Leo"];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const WEEK = [
    [12207, 9643, 8133, 5237, 5693, 2491, 2902],
    [2198, 4103, 11759, 9792, 12953, 8043, 9279],
    [13648, 10753, 9587, 8523, 8719, 13220, 5328],
    [11790, 10050, 2032, 6729, 12288, 8651, 2403]
  ];
  const NP = WEEK.length, ND = WEEK[0].length, CELLS = NP * ND;
  const sum = a => a.reduce((s, v) => s + v, 0);
  const ROW = WEEK.map(sum);                                       // one total per person
  const COL = DAYS.map((_, j) => sum(WEEK.map(r => r[j])));        // one total per day
  const ALL = sum(ROW);
  const shp = a => `(${a.join(", ")}${a.length === 1 ? "," : ""})`; // Python writes a one-number tuple as (4,)
  const DAYI = COL.indexOf(Math.min(...COL));                      // the quietest day

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}wk{display:grid;grid-template-columns:36px repeat(${ND},minmax(0,1fr));gap:3px;max-width:520px;margin:12px 0;font-family:var(--mono);font-size:12px}
      .${P}h{display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px;min-height:22px;font-family:var(--font)}
      .${P}h.r{justify-content:flex-start}
      .${P}c{min-height:44px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);font:inherit;padding:0;min-width:0;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
      button.${P}c{cursor:pointer}
      button.${P}c:hover{border-color:var(--ink-2)}
      .${P}c.in{border:2px solid var(--ink);background:var(--sunk);font-weight:600}
      .${P}c.enter{border:2px solid var(--good);background:var(--good-soft);font-weight:600}
      .${P}c.no{border:2px solid var(--bad);background:var(--bad-soft)}
      .${P}c.gone{color:var(--faint)}
      .${P}c.tot{background:var(--sunk);border-style:dashed;font-weight:600;font-size:11px}
      .${P}cap{font-size:12px;color:var(--muted);margin:10px 0 -6px}
      .${P}shape{display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap;margin:12px 0;font-family:var(--mono)}
      .${P}dim{display:flex;flex-direction:column;align-items:center;min-width:64px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--surface);color:var(--ink)}
      .${P}dim b{font-size:18px}
      .${P}dim span{font-size:11px;color:var(--muted);font-family:var(--font);text-align:center}
      .${P}dim.x{border-style:dashed;color:var(--faint)}
      .${P}dim.x b{text-decoration:line-through}
      .${P}out{font-family:var(--mono);font-size:13px;background:var(--sunk);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;white-space:pre-wrap;word-break:break-word;color:var(--ink)}
      .${P}out .m{color:var(--muted)}
      .${P}q{margin-top:14px}
    `;
    document.head.appendChild(s);
  }

  // The week as a grid: one row per person, one column per day. pick(r, c) -> bool makes a cell a button.
  function weekGrid(kit, { cls = {}, pick = null, colTot = null, title = "" } = {}) {
    let h = `<span class="${P}h"></span>` + DAYS.map(d => `<span class="${P}h">${kit.esc(d)}</span>`).join("");
    WEEK.forEach((row, r) => {
      h += `<span class="${P}h r">${kit.esc(PEOPLE[r])}</span>`;
      row.forEach((v, c) => {
        const k = `${r},${c}`, st = cls[k] || "";
        h += pick && pick(r, c)
          ? `<button type="button" class="${P}c ${st}" data-i="${k}" aria-label="${kit.esc(PEOPLE[r])}, ${DAYS[c]}: ${v}">${v}</button>`
          : `<span class="${P}c ${st}">${v}</span>`;
      });
    });
    if (colTot) h += `<span class="${P}h r">total</span>` + colTot.map(v => `<span class="${P}c tot">${v == null ? "" : v}</span>`).join("");
    return `${title ? `<p class="${P}cap">${kit.esc(title)}</p>` : ""}<div class="${P}wk">${h}</div>`;
  }

  // A shape drawn as one box per axis: the size on top, "axis i" and its meaning under it. cross: axes removed.
  function shapeTag(dims, names, cross = []) {
    return `<div class="${P}shape" aria-label="shape ${shp(dims)}">${dims.map((d, i) =>
      `<div class="${P}dim${cross.includes(i) ? " x" : ""}"><b>${d}</b><span>axis ${i}<br>${names[i]}</span></div>`).join("")}</div>`;
  }

  /* 1. By hand: Mum's week, one cell at a time. */
  function rowByHand({ el, done, kit }) {
    css();
    const R = 0, got = [];
    let miss = null;
    const paint = () => {
      const fin = got.length === ND, cls = {};
      got.forEach(c => { cls[`${R},${c}`] = fin ? "enter" : "in"; });
      if (miss) cls[miss.k] = "no";
      const s = sum(got.map(c => WEEK[R][c]));
      el.innerHTML = `<h1>A week of steps</h1>
        <p class="lead">A fitness app tracks a family of ${WORDS[NP].toLowerCase()}. Each cell is one person's step count for one day. The app's weekly screen needs a total for each person.</p>
        <p class="task">Add up ${PEOPLE[R]}'s week: tap each of her ${ND} days.</p>
        ${weekGrid(kit, { cls, pick: fin ? null : () => true })}
        <div class="lpanel">
          <div class="sum">${fmt(s)}<small>${got.length ? `${got.length} of ${ND} days added` : "nothing added yet"}</small></div>
          ${fin ? kit.feedback(`${PEOPLE[R]} walked <b>${fmt(ROW[R])}</b> steps: ${ND} cells, ${ND - 1} additions. The app does the same for every row: ${NP} rows × ${ND - 1} = ${NP * (ND - 1)} additions, and it gets one total per person.`, true)
            : miss ? kit.feedback(miss.say, false)
            : got.length ? kit.feedback(`${DAYS[got[got.length - 1]]}: ${fmt(WEEK[R][got[got.length - 1]])}. Running total ${fmt(s)}.`) : ""}
          ${fin ? kit.table(PEOPLE.map((p, i) => [p, fmt(ROW[i])]), { head: ["person", "week total"], title: "one total per person", fresh: 0 }) : ""}
        </div>`;
      el.querySelectorAll(`button.${P}c`).forEach(b => b.onclick = () => {
        const [r, c] = b.dataset.i.split(",").map(Number);
        miss = null;
        if (r !== R) miss = { k: b.dataset.i, say: `That is ${PEOPLE[r]}'s ${DAYS[c]}, ${fmt(WEEK[r][c])} steps. ${PEOPLE[R]}'s total uses only her own row, the ${ND} cells next to her name.` };
        else if (got.includes(c)) miss = { k: b.dataset.i, say: `${PEOPLE[R]}'s ${DAYS[c]} is already added. Adding it again counts ${fmt(WEEK[R][c])} steps she did not walk. Each cell counts once.` };
        else got.push(c);
        paint();
        if (got.length === ND) done();
      });
    };
    paint();
  }

  /* 2. By hand: one day for the whole family, down a column. */
  function colByHand({ el, done, kit }) {
    css();
    const C = DAYI, got = [];
    let miss = null;
    const paint = () => {
      const fin = got.length === NP, cls = {};
      got.forEach(r => { cls[`${r},${C}`] = fin ? "enter" : "in"; });
      if (miss) cls[miss.k] = "no";
      const s = sum(got.map(r => WEEK[r][C]));
      el.innerHTML = `<h1>Now one day for everyone</h1>
        <p class="lead">The app also draws a family chart with one bar per day, so it needs a total for each day. ${DAYS[C]} looks quiet.</p>
        <p class="lead">AI code does sums like these on grids with millions of cells. This lesson shows how NumPy, a Python library, does them in one line, and how to predict how many numbers come out.</p>
        <p class="task">Add up ${DAYS[C]} for the whole family: tap each person's ${DAYS[C]}.</p>
        ${weekGrid(kit, { cls, pick: fin ? null : () => true, colTot: fin ? COL : null })}
        <div class="lpanel">
          <div class="sum">${fmt(s)}<small>${got.length ? `${got.length} of ${NP} people added` : "nothing added yet"}</small></div>
          ${fin ? kit.feedback(`The family walked <b>${fmt(COL[C])}</b> steps on ${DAYS[C]}, the quietest day: ${NP} cells, ${NP - 1} additions. Every day takes the same: ${ND} days × ${NP - 1} = ${ND * (NP - 1)} additions, shown in the total row. The person totals and the day totals read the same ${CELLS} cells, in two different directions.`, true)
            : miss ? kit.feedback(miss.say, false)
            : got.length ? kit.feedback(`${PEOPLE[got[got.length - 1]]}: ${fmt(WEEK[got[got.length - 1]][C])}. Running total ${fmt(s)}.`) : ""}
        </div>`;
      el.querySelectorAll(`button.${P}c`).forEach(b => b.onclick = () => {
        const [r, c] = b.dataset.i.split(",").map(Number);
        miss = null;
        if (c !== C) miss = { k: b.dataset.i, say: `That is ${PEOPLE[r]}'s ${DAYS[c]}. A day's total goes down one column: only the ${DAYS[C]} cells, one per person.` };
        else if (got.includes(r)) miss = { k: b.dataset.i, say: `${PEOPLE[r]}'s ${DAYS[C]} is already added. Adding it twice counts ${fmt(WEEK[r][C])} steps nobody walked.` };
        else got.push(r);
        paint();
        if (got.length === NP) done();
      });
    };
    paint();
  }

  /* 3. By hand: predict the shape of each set of totals, then read NumPy's axis numbers. */
  function predictShapes({ el, done, kit }) {
    css();
    const ans = [null, null, null];
    const Q = [
      { opts: [shp([ND]), shp([NP]), shp([NP, ND]), shp([1])], r: 1,
        no: { 0: `${ND} counts the days. You squeezed each person's ${ND} days into one number, so ${NP} numbers are left, one per person.`,
          2: `${shp([NP, ND])} is the grid you started from. Adding squeezed each row of ${ND} into one number, so the ${ND} is gone.`,
          3: `One number would be the whole family's week, ${fmt(ALL)}. You kept one total per person.` },
        yes: `Right: ${NP} numbers, one per person, along one axis.` },
      { opts: [shp([NP]), shp([NP, ND]), shp([ND])], r: 2,
        no: { 0: `${NP} counts the people. Each day's ${NP} cells became one number, so ${ND} numbers are left, one per day.`,
          1: `That is the grid itself. Each column of ${NP} became one number, so the ${NP} is gone.` },
        yes: `Right: ${ND} numbers, one per day.` },
      { opts: [`One total per day, shape ${shp([ND])}`, `One total per person, shape ${shp([NP])}`], r: 1,
        no: { 0: `axis=1 is not the axis you keep; it is the one that disappears. Adding along the days squeezes each person's row into one number: one total per person.` },
        yes: `Right. You name the axis you add <b>along</b>, and that axis disappears from the shape. NumPy's documentation of <code>sum</code> says it in those words: the result has the input's shape "with the specified axis removed".` }
    ];
    const names = ["people", "days"];
    const paint = () => {
      const block = (i, task) => `<div id="q${i}" class="${P}q"><p class="task">${task}</p>${kit.options(Q[i].opts.map(kit.esc), { picked: ans[i], correct: Q[i].r })}${ans[i] == null ? "" : kit.feedback(ans[i] === Q[i].r ? Q[i].yes : Q[i].no[ans[i]], ans[i] === Q[i].r)}</div>`;
      el.innerHTML = `<h1>How many numbers come out?</h1>
        <p class="lead">NumPy, the Python library for grids of numbers, describes this grid by its <b>shape</b>: ${shp([NP, ND])}, ${NP} rows of ${ND}. Each direction is an <b>axis</b>, numbered from 0. Axis 0 runs down through the people; axis 1 runs across the days. A shape with only one axis ends in a comma, because that is how Python writes a tuple of one item.</p>
        ${shapeTag([NP, ND], names)}
        ${weekGrid(kit, {})}
        ${block(0, "Your per-person totals: what shape are they?")}
        ${ans[0] === Q[0].r ? block(1, "Your per-day totals: what shape?") : ""}
        ${ans[1] === Q[1].r ? block(2, "In NumPy you write which axis to add along. If <code>steps</code> holds the grid, <code>steps.sum(axis=1)</code> adds along axis 1, the days. What do you get?") : ""}
        ${ans[2] === Q[2].r ? shapeTag([NP, ND], names, [1]) : ""}`;
      Q.forEach((_, i) => el.querySelectorAll(`#q${i} .lopts button`).forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (Q.every((q, j) => ans[j] === q.r)) done();
      }));
    };
    paint();
  }

  /* 4. Spot the idea: a third axis, the same rule. Shapes from library.out.txt. */
  const W3 = { shape: [3, NP, ND], names: ["weeks", "people", "days"],
    out: { 0: [NP, ND], 1: [3, ND], 2: [3, NP] } };               // three_weeks.sum(axis=k).shape, as printed
  function spotRule({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [shp(W3.out[1]), shp(W3.out[2]), shp(W3.out[0]), shp(W3.shape)];
    const correct = 1;
    const said = {
      0: `${shp(W3.out[1])} removes the people, axis 1: one total per week per day, the family added together. The app wants each person kept apart.`,
      2: `${shp(W3.out[0])} removes the weeks, axis 0: each person's ${ND} days added across the three weeks. The app wants each week kept apart.`,
      3: `That is the shape you start with. Adding along the days squeezes each run of ${ND} days into one number, so the days axis goes away.`
    };
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>Three weeks at once</h1>
        <p class="lead">The app now keeps three weeks: an array of shape ${shp(W3.shape)}. One grid like yours per week.</p>
        ${shapeTag(W3.shape, W3.names, ok ? [2] : [])}
        <p class="task">The app wants each person's total for each week. What shape comes out?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. Each person's week is added along the days, axis 2. Cross that axis out: ${shp(W3.shape)} becomes <b>${shp(W3.out[2])}</b>, ${W3.out[2][1]} totals for each of ${W3.out[2][0]} weeks. That is the whole rule: the axis you add along disappears, the others stay in order. A recorded run on the same shape printed all three:`, true)
            + `<div class="${P}out">${[2, 0, 1].map(k => `three_weeks.sum(axis=${k}).shape <b>${shp(W3.out[k])}</b>`).join("\n")}</div>`
          : kit.feedback(said[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. From scratch in plain Python, a traced run (scratch.py -> scratch.out.txt). */
  const CODE1 = [
    "def totals_per_person(week):",
    "    totals = []",
    "    for person in week:",
    "        total = 0",
    "        for count in person:",
    "            total += count",
    "        totals.append(total)",
    "    return totals"
  ];
  // scratch.out.txt, one row per step: [line about to run (0 = def), return?, totals, total, count]
  const TRACE = [
    [1,0,null,null,null], [2,0,[],null,null], [3,0,[],null,null], [4,0,[],0,null],
    [5,0,[],0,12207], [4,0,[],12207,12207], [5,0,[],12207,9643], [4,0,[],21850,9643],
    [5,0,[],21850,8133], [4,0,[],29983,8133], [5,0,[],29983,5237], [4,0,[],35220,5237],
    [5,0,[],35220,5693], [4,0,[],40913,5693], [5,0,[],40913,2491], [4,0,[],43404,2491],
    [5,0,[],43404,2902], [4,0,[],46306,2902], [6,0,[],46306,2902], [2,0,[46306],46306,2902],
    [3,0,[46306],46306,2902], [4,0,[46306],0,2902], [5,0,[46306],0,2198], [4,0,[46306],2198,2198],
    [5,0,[46306],2198,4103], [4,0,[46306],6301,4103], [5,0,[46306],6301,11759], [4,0,[46306],18060,11759],
    [5,0,[46306],18060,9792], [4,0,[46306],27852,9792], [5,0,[46306],27852,12953], [4,0,[46306],40805,12953],
    [5,0,[46306],40805,8043], [4,0,[46306],48848,8043], [5,0,[46306],48848,9279], [4,0,[46306],58127,9279],
    [6,0,[46306],58127,9279], [2,0,[46306,58127],58127,9279], [3,0,[46306,58127],58127,9279], [4,0,[46306,58127],0,9279],
    [5,0,[46306,58127],0,13648], [4,0,[46306,58127],13648,13648], [5,0,[46306,58127],13648,10753], [4,0,[46306,58127],24401,10753],
    [5,0,[46306,58127],24401,9587], [4,0,[46306,58127],33988,9587], [5,0,[46306,58127],33988,8523], [4,0,[46306,58127],42511,8523],
    [5,0,[46306,58127],42511,8719], [4,0,[46306,58127],51230,8719], [5,0,[46306,58127],51230,13220], [4,0,[46306,58127],64450,13220],
    [5,0,[46306,58127],64450,5328], [4,0,[46306,58127],69778,5328], [6,0,[46306,58127],69778,5328], [2,0,[46306,58127,69778],69778,5328],
    [3,0,[46306,58127,69778],69778,5328], [4,0,[46306,58127,69778],0,5328], [5,0,[46306,58127,69778],0,11790], [4,0,[46306,58127,69778],11790,11790],
    [5,0,[46306,58127,69778],11790,10050], [4,0,[46306,58127,69778],21840,10050], [5,0,[46306,58127,69778],21840,2032], [4,0,[46306,58127,69778],23872,2032],
    [5,0,[46306,58127,69778],23872,6729], [4,0,[46306,58127,69778],30601,6729], [5,0,[46306,58127,69778],30601,12288], [4,0,[46306,58127,69778],42889,12288],
    [5,0,[46306,58127,69778],42889,8651], [4,0,[46306,58127,69778],51540,8651], [5,0,[46306,58127,69778],51540,2403], [4,0,[46306,58127,69778],53943,2403],
    [6,0,[46306,58127,69778],53943,2403], [2,0,[46306,58127,69778,53943],53943,2403], [7,0,[46306,58127,69778,53943],53943,2403], [7,1,[46306,58127,69778,53943],53943,2403]
  ];
  const ADDS = TRACE.filter(s => s[0] === 5 && !s[1]).length;      // how often `total += count` ran
  // A frame = one line just ran: its line, and the variables after it (the next trace step).
  // Shown: every step of Mum's row; for the other rows only the append (their inner loops are skipped on screen).
  const FR = (() => {
    const fr = [];
    let day = -1;
    for (let i = 0; i < TRACE.length - 1; i++) {
      const [ln] = TRACE[i], [, , totals, total, count] = TRACE[i + 1];
      const who = (TRACE[i][2] || []).length;                       // the row being read = totals so far
      if (ln === 2 && who > 0 && who < NP) continue;                 // later rows: keep only their append
      if (who > 0 && (ln === 3 || ln === 4 || ln === 5)) continue;
      if (ln === 4) day = TRACE[i + 1][0] === 5 ? day + 1 : day;
      fr.push({ ln, totals, total, count, who, day, exit: ln === 4 && TRACE[i + 1][0] === 6, ret: TRACE[i + 1][1] ? totals : null });
    }
    return fr;
  })();
  const arr = a => a == null ? "–" : `[${a.join(", ")}]`;
  function sayStep(f) {
    const name = PEOPLE[f.who];
    if (f.ln === 1) return "An empty list for the answers.";
    if (f.ln === 2) return f.who === NP ? "No rows left: the outer loop ends." : `<code>person</code> is now ${name}'s row, the ${ND} numbers next to her name.`;
    if (f.ln === 3) return `${name}'s total starts at 0.`;
    if (f.ln === 4) return f.exit ? `No days left in ${name}'s row: the inner loop ends.` : `<code>count</code> is ${name}'s ${DAYS[f.day]}: ${f.count}.`;
    if (f.ln === 5) return `total = ${f.total - f.count} + ${f.count} = <b>${f.total}</b>.`;
    if (f.ln === 6) return f.who === 0
      ? `${name}'s total, ${fmt(f.total)}, goes into <code>totals</code>: the number you got by hand.`
      : `${name}'s row ran the same ${ND} steps (skipped on screen). <code>totals</code> gets ${fmt(f.total)}.`;
    return `Returned: ${arr(f.ret)}, one total per person, the same ${NP} numbers as on screen 1.`;
  }
  function scratchCode({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const popts = [NP * (ND - 1), ADDS, ND].filter((v, j, a) => a.indexOf(v) === j).sort((a, b) => a - b);
    const pright = popts.indexOf(ADDS);
    const paint = () => {
      const f = FR[i], end = i === FR.length - 1;
      el.innerHTML = `<h1>The same totals, as a Python loop</h1>
        <p class="lead">First without NumPy, the way you would write it with what you already know: <code>week</code> is a list of ${NP} lists, one per person. Each step replays a real run.</p>
        <p class="task">Step through to the end, then answer the question that appears.</p>
        ${kit.code(CODE1, f.ln)}
        <div class="${P}out">totals ${arr(f.totals)}\ntotal  ${f.total == null ? "–" : f.total}\ncount  ${f.count == null ? "–" : f.count}</div>
        <div class="vars"><span>row <b>${PEOPLE[Math.min(f.who, NP - 1)]}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayStep(f))}
        ${end ? `<div id="pred" class="${P}q"><p class="task">How many times did the line <code>total += count</code> run in all?</p>${kit.options(popts.map(String), { picked: pred, correct: pright, num: true })}
          ${pred == null ? "" : pred === pright
            ? kit.feedback(`Right: ${ADDS}, once per cell. By hand you started from the first cell, ${ND - 1} additions per person; the code starts at 0 and adds all ${ND}. Either way the work grows with the number of cells, and Python runs each addition as its own step, checking what kind of value <code>count</code> is every time.`, true)
            : popts[pred] === ND ? kit.feedback(`${ND} is one row. The outer loop repeats the inner loop for each of the ${NP} people.`, false)
            : kit.feedback(`${NP * (ND - 1)} is what you did by hand, starting from each person's first cell. The code starts <code>total</code> at 0, so it adds every cell, the first one too.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${end ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); if (pred === pright) done(); });
    };
    paint();
  }

  /* 6. The same with NumPy, a recorded run (library.py -> library.out.txt); predict each shape first. */
  // From library.out.txt: `lines` are the printed lines, copied exactly; `shapes` are the shapes those lines print
  const RUN = {
    shape: "(4, 7)", dtype: "int64",
    lines: {
      steps: ["steps.shape (4, 7)", "steps.dtype int64"],
      per_person: ["per_person [46306 58127 69778 53943] (4,)"],
      per_day: ["per_day [39843 34549 31511 30281 39653 32405 19912] (7,)"],
      whole_week: ["whole_week 228154 ()"],
      goal_met: ["goal_met.shape (4, 7) bool"],
      goal_days: ["goal_days [3 5 6 4] (4,)"]
    },
    shapes: { per_person: [4], per_day: [7], whole_week: [], goal_met: [4, 7], goal_days: [4] }
  };
  const GOAL = 8000;
  const CODE2 = [
    "import numpy as np",
    "steps = np.array(week)",
    "per_person = steps.sum(axis=1)",
    "per_day = steps.sum(axis=0)",
    "whole_week = steps.sum()",
    `goal_met = steps >= ${GOAL}`,
    "goal_days = goal_met.sum(axis=1)"
  ];
  const tup = a => a.length ? shp(a) : "()";
  const ASK = [
    { ln: 2, name: "per_person", opts: [[4], [7], [4, 7]],
      no: { 1: `axis=1 is the days, and it is the axis that disappears. ${NP} totals are left, one per person.`, 2: `Adding along an axis removes it; ${shp([NP, ND])} would mean nothing was added.` },
      yes: `Right. The same four numbers your loop returned, from one line.` },
    { ln: 3, name: "per_day", opts: [[4], [7], [4, 7]],
      no: { 0: `axis=0 is the people, and it disappears: each day's ${NP} cells become one number, so ${ND} are left.`, 2: `Adding along an axis removes it; ${shp([NP, ND])} would mean nothing was added.` },
      yes: `Right. One total per day, the total row from screen 2.` },
    { ln: 4, name: "whole_week", opts: [[], [1], [CELLS]],
      no: { 1: `No axis is left at all, so it is a single number, not a list holding one number.`, 2: `${CELLS} is every cell laid out in a line. <code>sum()</code> adds them all into one number.` },
      yes: `Right. With no axis given, every axis is removed: one plain number, shape <code>()</code>, zero axes. It is the family's ${fmt(ALL)} steps.` },
    { ln: 5, name: "goal_met", opts: [[NP], [NP, ND], []],
      no: { 0: `Nothing is added here. A comparison works cell by cell, so every one of the ${CELLS} cells gets its own True or False, in the same grid.`, 2: `In JavaScript, comparing with <code>&gt;=</code> gives one boolean. NumPy compares every cell with ${fmt(GOAL)}, so the grid's shape stays and each cell gets its own True or False.` },
      yes: `Right. The comparison runs on every cell at once and gives a grid of True and False, type <code>bool</code>. The single number ${GOAL} is used against every cell; the next lesson shows how two whole arrays of different shapes combine.` },
    { ln: 6, name: "goal_days", opts: [[NP], [ND], [NP, ND]], out: () => `${RUN.goal_days}  shape ${tup(RUN.shapes.goal_days)}`,
      no: { 1: `axis=1 is the days again, so it disappears. One count per person is left.`, 2: `Summing along axis 1 removes the days axis, as before.` },
      yes: `Right. True counts as 1 and False as 0, so this counts each person's days at ${fmt(GOAL)} steps or more.` }
  ];
  function numpyRun({ el, done, kit }) {
    css();
    let k = 0, wrong = null;
    const paint = () => {
      const end = k >= ASK.length, a = end ? null : ASK[k];
      const shown = ["steps", ...ASK.slice(0, k).map(q => q.name)].flatMap(n => RUN.lines[n]);
      el.innerHTML = `<h1>The same totals with NumPy</h1>
        <p class="lead"><code>np.array(week)</code> copies the list of lists into one block of numbers. The recorded run printed its shape <b>${RUN.shape}</b> and its type (<code>dtype</code>) <b>${RUN.dtype}</b>: every cell is a whole number stored in 64 bits, ${SPEED.itemsize} bytes. Each line below works on the whole grid at once, with no Python loop.</p>
        <p class="lead">The box under the code shows what the run printed for each line: the name, the value, then the shape.</p>
        ${kit.code(CODE2, end ? -1 : a.ln)}
        <div class="${P}out">${shown.map(kit.esc).join("\n")}</div>
        ${end ? kit.feedback(`${ASK[ASK.length - 1].yes} Five results, five shapes, all from one rule: the axis you add along disappears, and a comparison keeps the shape.`, true)
          : `<p class="task">Predict the shape of <code>${a.name}</code> before the run shows it.</p>
          <div class="lpanel">${kit.options(a.opts.map(tup), { picked: wrong, correct: a.opts.findIndex(o => tup(o) === tup(RUN.shapes[a.name])) })}
          ${wrong != null ? kit.feedback(a.no[wrong], false) : k > 0 ? kit.feedback(ASK[k - 1].yes, true) : ""}</div>`}
`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i, right = a.opts.findIndex(o => tup(o) === tup(RUN.shapes[a.name]));
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= ASK.length) done();
      });
    };
    paint();
  }

  /* 7. Why it is fast: loop against array on 100,000 users (speed.py -> speed.out.txt). */
  // From speed.out.txt: 100,000 users x 7 days, seed 2, best of 5 runs, Apple M1, 2026-11-13
  const SPEED = { users: 100000, cells: 700000, loopMs: 44.48, numpyMs: 0.77, same: true, dtype: "int64", nbytes: 5600000, itemsize: 8 };
  function whyFast({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "It skips some cells or rounds the totals",
      "It loops in pre-compiled code over one block of same-type numbers",
      "It spreads the work over several CPU cores or the GPU"
    ];
    const correct = 1, times = Math.round(SPEED.loopMs / SPEED.numpyMs);
    const paint = () => {
      el.innerHTML = `<h1>Why one line beats the loop</h1>
        <p class="lead">The app has ${fmt(SPEED.users)} users, ${fmt(SPEED.cells / SPEED.users)} days each: ${fmt(SPEED.cells)} cells. A recorded run timed your loop from screen 5 against <code>steps.sum(axis=1)</code> on the same numbers (an Apple M1 laptop, 2026-11-13, best of 5 runs; other machines give other times, the gap is what matters). Both gave the same ${fmt(SPEED.users)} totals.</p>
        ${kit.meter([{ label: "Python loop, ms", value: SPEED.loopMs, max: SPEED.loopMs }, { label: "NumPy sum, ms", value: SPEED.numpyMs, max: SPEED.loopMs, good: true }])}
        <p class="task">The array was about ${times} times faster. What does NumPy do differently?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. NumPy's documentation calls this <b>vectorization</b>: the looping still happens, "behind the scenes in optimized, pre-compiled C code". That works because every cell has the same type and size: here ${fmt(SPEED.cells)} cells × ${SPEED.itemsize} bytes = ${fmt(SPEED.cells * SPEED.itemsize)} bytes in one block. A Python list is like a JavaScript array, where each slot can hold anything. A NumPy array is closer to a JavaScript typed array such as <code>Int32Array</code> or <code>Float64Array</code>: one number type for every slot, and no <code>push</code>. The price: the whole grid sits in memory at once, and most operations make a new array for their result.`, true)
          : ans === 0 ? kit.feedback(`The run compared the two answers: all ${fmt(SPEED.users)} totals were the same. Nothing is skipped or rounded; NumPy adds every cell.`, false)
          : kit.feedback(`NumPy's documentation says NumPy itself is normally limited to a single thread during a function call, so <code>sum</code> ran on one CPU core. The gain comes from the loop running in compiled code over one block of same-type numbers, not from more hardware.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, cost; task: which limit bites first. */
  // From ragged.out.txt (np.array on lists of different lengths)
  const RAGGED = "ValueError: setting an array element with a sequence. The requested array has an inhomogeneous shape after 1 dimensions. The detected shape was (3,) + inhomogeneous part.";
  const ROWS2B = 2e9;
  const LIMITS = [
    "The whole array must fit in memory",
    "One rectangle of one type",
    "Each step needs the step before it"
  ];
  const BIG = [
    [`A fitness company wants per-user totals from ${fmt(ROWS2B / 1e9)} billion daily step counts, on a laptop with 16 GB of memory.`, 0,
      `Right. At ${SPEED.itemsize} bytes per count that is about ${fmt(ROWS2B * SPEED.itemsize / 1e9)} GB for the counts alone, before any result array. Read the data in pieces, or let a database add it up.`],
    ["Each customer's record has a name, a birthday, and a list of workouts whose length differs from customer to customer.", 1,
      `Right. A NumPy array is a rectangle of one type. A recorded run that passed rows of different lengths to <code>np.array</code> was refused: <code>${RAGGED}</code> Tables with named columns of different types are what pandas is for, two lessons on.`],
    ["A streak counter: a day adds 1 to the streak if the user reached the goal, and a missed day resets the streak to 0.", 2,
      "Right. An array operation does the same thing to every cell, independently. Here each day's value depends on the day before through an if, so a plain loop is the honest answer. A few common running results have their own NumPy function, such as <code>np.cumsum</code> for running totals."]
  ];
  const BIG_WRONG = [
    { 1: `The counts are one type and form a rectangle of users by days. The problem is their size: at ${SPEED.itemsize} bytes each they fill the laptop's memory.`, 2: "Each user's total is independent of the others. The problem is the size of the data, not the order of the steps." },
    { 0: "A few thousand customers fit in memory easily. The problem is that names, dates and lists of different lengths are not one rectangle of one type.", 2: "Nothing here depends on an earlier step. The data simply does not form a rectangle of numbers." },
    { 0: "A year of days is tiny. The problem is that each day needs the result of the day before.", 1: "The days are one type and fit a rectangle. The problem is that each day's value depends on yesterday's value through an if." }
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When arrays are the right tool</h1>
        <p class="lead"><b>What for:</b> grids of numbers that get the same arithmetic in every cell: sensor readings, pixels, embeddings, model weights.</p>
        <p class="lead"><b>Reach for it</b> when the data is a rectangle of one number type and a Python loop over it is slow.</p>
        <p class="lead"><b>Not for</b> rows of different lengths or mixed types (pandas, or plain Python), steps that depend on the previous step (a loop), or code that is slow because it waits on a network.</p>
        <p class="lead"><b>Cost:</b> the whole array in memory, usually a new array for each result, and thinking in shapes instead of loops.</p>
        <p class="task">For each situation, pick the limit that causes trouble first.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(LIMITS.map(kit.esc), { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : BIG_WRONG[i][ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it: would one array operation replace the loop? One "no". */
  const WT = { turbines: 50, days: 30, perDay: 24 }, EMB = { rows: 50000, dims: 768 };
  const CASES = [
    [`A wind farm logs the power output of ${WT.turbines} turbines every hour for ${WT.days} days, the same number of readings for each. It wants each turbine's average output.`, true,
      `Yes. It is a rectangle of shape (${WT.turbines}, ${fmt(WT.days * WT.perDay)}): turbines by hours. <code>output.mean(axis=1)</code> removes the hours axis and leaves ${shp([WT.turbines])}, one average per turbine.`,
      `Every turbine has the same ${fmt(WT.days * WT.perDay)} readings, so the data is a rectangle (${WT.turbines}, ${fmt(WT.days * WT.perDay)}). One <code>mean(axis=1)</code> replaces the loop and gives ${shp([WT.turbines])}.`],
    [`A search feature stores ${fmt(EMB.rows)} text embeddings, ${EMB.dims} numbers each. For a question's ${EMB.dims} numbers, it multiplies matching numbers and adds them up, once for every stored row, to score each row.`, true,
      `Yes. The store is a (${fmt(EMB.rows)}, ${EMB.dims}) array. Multiply cell by cell, then add along axis 1: ${fmt(EMB.rows)} scores with no Python loop. The next lesson shows how one row of ${EMB.dims} numbers combines with every stored row.`,
      `It is the same arithmetic in every row of a rectangle of numbers: exactly what arrays are for. Adding along axis 1 leaves one score per stored row, (${fmt(EMB.rows)},).`],
    ["A support tool sends 200 customer emails to a language model API one at a time, and each call waits about a second for its answer.", false,
      "No. The time goes into waiting for the network, not into arithmetic. There are no numbers for NumPy to add up faster. Sending the calls at the same time is what helps.",
      "An array operation speeds up arithmetic on numbers already in memory. Here the program sits idle waiting for answers; NumPy has nothing to do. Sending the calls at the same time is what helps."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would an array operation help?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the family's steps.</p>
        <p class="task">For each one, decide if one NumPy operation on a whole array is the fix. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>A grid, a shape, one line</h1>
      <p class="lead"><b>What it is:</b> a NumPy array is one rectangle of numbers of one type, with a shape such as ${shp([NP, ND])}. The loop over the cells runs in pre-compiled code, not one Python step per number: about ${Math.round(SPEED.loopMs / SPEED.numpyMs)} times faster in the run you saw. The axis you add along disappears from the shape.</p>
      <p class="lead"><b>Reach for it</b> when the same arithmetic runs over every cell of a big grid of numbers. <b>Not for</b> rows of different lengths or mixed types, steps that need the step before, or code that waits on a network. <b>Cost:</b> the whole array sits in memory, and the data must fit a rectangle of one type.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson: you turn a list of lists of readings into an array, replace a loop with one <code>sum</code> or <code>mean</code> along the right axis, and check the shape of each result.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. Here every operation used one array, or one array and a single number; next you combine arrays of different shapes and read the error when they do not fit.</p>` : ""}`;
    done();
  }

  LessonKit.define("s1-numpy-arrays", {
    title: "NumPy arrays, shapes and vectorized maths",
    checked: "2026-11-14",
    sources: [
      "https://numpy.org/doc/stable/user/whatisnumpy.html",
      "https://numpy.org/doc/stable/user/absolute_beginners.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.sum.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.mean.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.cumsum.html",
      "https://numpy.org/doc/stable/reference/ufuncs.html",
      "https://numpy.org/doc/stable/reference/global_state.html",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray"
    ],
    interview: [{
      q: "A teammate's feature-preparation script loops over two million rows in Python, one value at a time, and takes minutes. How would you speed it up, and what would you check?",
      good: [
        "Load the data into a NumPy array of one number type and replace the inner loops with whole-array operations and sums along an axis",
        "Name each axis and check the shape after every step, so a sum along the wrong axis cannot slip through",
        "Compare the new result with the old loop on a sample before switching",
        "Watch memory: the whole array is in memory and most operations make a new array",
        "Keep a loop for steps that depend on the previous step, and leave rows of different lengths or mixed types to pandas or plain Python"
      ],
      weak: "Run the same loop on a bigger machine or in parallel. The per-value Python work stays; it does not remove the loop."
    }, {
      q: "A model hands you an array of shape (32, 128, 768): 32 examples, 128 tokens each, 768 numbers per token. You need one 768-number vector per example by averaging over the tokens. What do you write, and what shape do you expect?",
      good: [
        "Average along the tokens axis, axis 1: x.mean(axis=1)",
        "The axis you reduce disappears, so the result is (32, 768)",
        "Check it with the shape before using it, for example an assert on x.mean(axis=1).shape",
        "If the batch has padding, average only the real tokens: multiply by a mask of real tokens, sum along axis 1, then divide by each example's count of real tokens"
      ],
      weak: "Writing mean(axis=-1) or axis=2 because it is the last one. That averages the 768 numbers away and gives (32, 128), one number per token."
    }],
    screens: [rowByHand, colByHand, predictShapes, spotRule, scratchCode, numpyRun, whyFast, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="1,0"]'], right: DAYS.map((_, c) => `[data-i="0,${c}"]`) },
      { wrong: [`[data-i="0,${DAYI === 0 ? 1 : 0}"]`], right: PEOPLE.map((_, r) => `[data-i="${r},${DAYI}"]`) },
      { wrong: ["#q0 [data-wrong]"], right: ["#q0 [data-right]", "#q1 [data-right]", "#q2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(FR.length - 1).fill("[data-next]"), "#pred [data-wrong]"], right: ["#pred [data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(ASK.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
