/* Lesson s1-pandas-frames: pandas DataFrames: load, filter, group.
   Story: a city taxi company wants to know which pickup district gives drivers the best average fare, all day
   and on the night shift.
   Ideas: (1) "X per district" is always split-apply-combine: split the rows into groups by one column, apply one
   function to each group, combine the answers into one row per group; pandas calls it groupby. (2) A DataFrame
   is a table of typed columns; a comparison on a column gives a True/False mask, and the mask filters rows.
   Always read a group's count next to its mean.
   Depth: explain (screens 1, 2, 3, 9, 10), library (4, 5, 6, 7, 8), when-not (9, 10).
   Data: TRIPS is a made-up 12-trip log written for this lesson (not real taxi data), saved as
     docs/ai-path/runs/s1-pandas-frames/trips.csv
   Every pandas output shown (the OUT and TRACE constants) is copied unaltered from runs on this Mac
   (pandas 3.1.1, NumPy 2.5.4, Python 3.12; see env.txt):
     docs/ai-path/runs/s1-pandas-frames/explore.py -> explore.out.txt (dtypes, masks, group tables, the two errors)
     docs/ai-path/runs/s1-pandas-frames/trace.py   -> trace.out.txt   (the stepped code screen; re-run 2026-11-14)
   Every other number on screen (piles, means, sums, counts) is computed below from TRIPS.
   No model API calls were recorded for this lesson. Nothing is marked "not run by us".
   Lesson-local CSS (trip-log rows, district bins, output blocks, checklist): classes prefixed lx-s1-pandas-frames-. */
(() => {
  const ID = "s1-pandas-frames", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s1-pandas-frames.ipynb";
  const RUN_DATE = "2026-11-13", TRACE_DATE = "2026-11-14";

  // trips.csv, row by row: [trip_id, pickup, dropoff, hour, minutes, fare]
  const TRIPS = [
    ["T01", "Center", "Harbor", 8, 14, 11.5],
    ["T02", "Airport", "Center", 9, 15, 12.0],
    ["T03", "Harbor", "Airport", 11, 28, 20.0],
    ["T04", "Center", "Center", 12, 10, 9.0],
    ["T05", "Airport", "Harbor", 14, 24, 17.0],
    ["T06", "Center", "Center", 17, 9, 8.5],
    ["T07", "Harbor", "Center", 20, 31, 23.0],
    ["T08", "Center", "Airport", 20, 20, 14.0],
    ["T09", "Airport", "Center", 21, 45, 34.0],
    ["T10", "Harbor", "Center", 22, 36, 25.5],
    ["T11", "Center", "Harbor", 22, 17, 12.0],
    ["T12", "Harbor", "Airport", 23, 33, 23.5]
  ].map(([id, pickup, dropoff, hour, minutes, fare]) => ({ id, pickup, dropoff, hour, minutes, fare }));
  const COLS = ["trip_id", "pickup", "dropoff", "hour", "minutes", "fare"];
  const N = TRIPS.length;
  const DISTRICTS = [...new Set(TRIPS.map(t => t.pickup))].sort();
  const NIGHT_FROM = 20;

  // explore.out.txt (copied unaltered)
  const OUT = {
    dtypes: "trip_id        str\npickup         str\ndropoff        str\nhour         int64\nminutes      int64\nfare       float64\ndtype: object",
    shape: "(12, 6)",
    harborNight: "   trip_id  pickup  dropoff  hour  minutes  fare\n6      T07  Harbor   Center    20       31  23.0\n9      T10  Harbor   Center    22       36  25.5\n11     T12  Harbor  Airport    23       33  23.5",
    errAnd: "ValueError: The truth value of a Series is ambiguous. Use a.empty, a.item(), a.any() or a.all().",
    errPrec: "TypeError: unsupported operand type(s) for &: 'int' and 'StringArray'",
    allDay: "         mean  count\npickup              \nAirport  21.0      3\nCenter   11.0      5\nHarbor   23.0      4",
    mem: { pickup: 663, fare: 96 }
  };
  // trace.out.txt: night_fares("trips.csv"), traced line by line (variable reprs copied unaltered)
  const TRACE = {
    trips: "   trip_id   pickup  dropoff  hour  minutes  fare\n0      T01   Center   Harbor     8       14  11.5\n1      T02  Airport   Center     9       15  12.0\n2      T03   Harbor  Airport    11       28  20.0\n3      T04   Center   Center    12       10   9.0\n4      T05  Airport   Harbor    14       24  17.0\n5      T06   Center   Center    17        9   8.5\n6      T07   Harbor   Center    20       31  23.0\n7      T08   Center  Airport    20       20  14.0\n8      T09  Airport   Center    21       45  34.0\n9      T10   Harbor   Center    22       36  25.5\n10     T11   Center   Harbor    22       17  12.0\n11     T12   Harbor  Airport    23       33  23.5",
    is_night: "0     False\n1     False\n2     False\n3     False\n4     False\n5     False\n6      True\n7      True\n8      True\n9      True\n10     True\n11     True\nName: hour, dtype: bool",
    night: "   trip_id   pickup  dropoff  hour  minutes  fare\n6      T07   Harbor   Center    20       31  23.0\n7      T08   Center  Airport    20       20  14.0\n8      T09  Airport   Center    21       45  34.0\n9      T10   Harbor   Center    22       36  25.5\n10     T11   Center   Harbor    22       17  12.0\n11     T12   Harbor  Airport    23       33  23.5",
    groups: "<pandas.api.typing.DataFrameGroupBy object at 0x10d597aa0>",
    fares: "<pandas.api.typing.SeriesGroupBy object at 0x10d597770>",
    tableUnsorted: "         mean  count\npickup              \nAirport  34.0      1\nCenter   13.0      2\nHarbor   24.0      3",
    table: "         mean  count\npickup              \nAirport  34.0      1\nHarbor   24.0      3\nCenter   13.0      2"
  };

  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => sum(a) / a.length;
  const f1 = x => Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? x.toFixed(1) : x.toFixed(2);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const by = (rows, col) => Object.fromEntries(DISTRICTS.map(d => [d, rows.filter(t => t[col] === d)]));
  const PILES = by(TRIPS, "pickup");
  const DROPS = by(TRIPS, "dropoff");
  const MEAN = Object.fromEntries(DISTRICTS.map(d => [d, mean(PILES[d].map(t => t.fare))]));
  const SUM = Object.fromEntries(DISTRICTS.map(d => [d, sum(PILES[d].map(t => t.fare))]));
  const DROP_MEAN = Object.fromEntries(DISTRICTS.map(d => [d, mean(DROPS[d].map(t => t.fare))]));
  const BEST = DISTRICTS.reduce((a, d) => MEAN[d] > MEAN[a] ? d : a);
  const NIGHT = TRIPS.filter(t => t.hour >= NIGHT_FROM);
  const NPILES = by(NIGHT, "pickup");
  const NMEAN = Object.fromEntries(DISTRICTS.map(d => [d, NPILES[d].length ? mean(NPILES[d].map(t => t.fare)) : null]));
  const NBEST = DISTRICTS.reduce((a, d) => NMEAN[d] > NMEAN[a] ? d : a);
  const NMOST = DISTRICTS.reduce((a, d) => NPILES[d].length > NPILES[a].length ? d : a);
  const MAXMIN = Object.fromEntries(DISTRICTS.map(d => [d, Math.max(...PILES[d].map(t => t.minutes))]));
  const AVGMIN = Object.fromEntries(DISTRICTS.map(d => [d, mean(PILES[d].map(t => t.minutes))]));
  const LONGEST = TRIPS.reduce((a, t) => t.minutes > a.minutes ? t : a);
  const ALL_MEAN = mean(TRIPS.map(t => t.fare));

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}log { display: flex; flex-direction: column; gap: 4px; margin: 12px 0 0; }
      .${P}row { display: grid; grid-template-columns: 3em 1fr 1fr 2.6em 3.4em 3.4em; gap: 4px; align-items: center; width: 100%; min-height: 44px; padding: 4px 10px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: 500 14px var(--mono); text-align: left; }
      .${P}row.head { min-height: 0; border: 0; background: transparent; color: var(--muted); font-size: 12px; padding-top: 0; padding-bottom: 0; }
      .${P}row span:nth-child(n+4) { text-align: right; }
      button.${P}row { cursor: pointer; }
      .${P}row.cur { border: 3px solid var(--ink); }
      .${P}row.gone { color: var(--faint); border-style: dashed; }
      .${P}row.on { border-color: var(--good); background: var(--good-soft); }
      .${P}row.bad { border-color: var(--bad); background: var(--bad-soft); }
      .${P}bins { display: grid; grid-template-columns: repeat(${DISTRICTS.length}, 1fr); gap: 8px; margin: 12px 0 0; }
      .${P}bin { display: flex; flex-direction: column; gap: 4px; align-items: stretch; min-height: 96px; padding: 8px; border: 1.5px solid var(--ink-2); border-radius: 8px; background: var(--surface); color: var(--ink); font: 600 15px var(--font); cursor: pointer; text-align: left; }
      .${P}bin small { font: 500 12.5px/1.5 var(--mono); color: var(--ink-2); overflow-wrap: anywhere; }
      .${P}pile { padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 8px; background: var(--surface); margin: 8px 0 0; }
      .${P}pile b { font: 600 15px var(--font); }
      .${P}pile .f { font: 500 14px var(--mono); color: var(--ink-2); margin-top: 2px; overflow-wrap: anywhere; }
      .${P}out { margin: 10px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--sunk); color: var(--ink); font: 500 13px/1.45 var(--mono); white-space: pre; overflow-x: auto; max-width: 100%; }
      .${P}out.wrap { white-space: pre-wrap; overflow-wrap: anywhere; }
      .${P}gap { margin-top: 14px; }
      .${P}cap { font: 500 12.5px var(--mono); color: var(--muted); margin: 6px 0 0; }
      .${P}cols { display: flex; flex-direction: column; gap: 4px; }
      .${P}check-btn { margin-top: 12px; min-height: 48px; padding: 10px 18px; }
      .${P}nb { display: inline-flex; align-items: center; min-height: 48px; padding: 10px 18px; text-decoration: none; }
      .${P}check { list-style: none; padding: 0; margin: 12px 0 0; }
      .${P}check li { border-top: 1px solid var(--line); }
      .${P}check label { display: flex; gap: 6px; align-items: flex-start; min-height: 44px; padding: 4px 0; cursor: pointer; }
      .${P}check label span { padding-top: 10px; }
      .${P}check input { appearance: none; -webkit-appearance: none; width: 44px; height: 44px; margin: 0; flex: none; cursor: pointer; border: 0; border-radius: 0; background: transparent; padding: 15px; background-clip: content-box; outline: 2px solid var(--ink-2); outline-offset: -11px; }
      .${P}check input:checked { background-color: var(--good); outline-color: var(--good); }
      .${P}opt code { white-space: normal; overflow-wrap: anywhere; }
      @media (max-width: 480px) {
        .${P}row { font-size: 12.5px; padding: 4px 6px; gap: 2px; grid-template-columns: 2.7em 1fr 1fr 2.2em 3em 3em; }
        .${P}row.head { font-size: 11px; }
        .${P}bins { gap: 6px; }
        .${P}bin { font-size: 14px; padding: 6px; }
        .${P}out { font-size: 12px; }
      }
    `;
    document.head.appendChild(s);
  }

  // the trip log as rows; pick = rows become buttons with data-i; cls(i) = row class
  const HEAD = ["trip", "pickup", "dropoff", "hour", "min", "fare"];
  const logRows = (rows, { pick = false, cls = () => "" } = {}) => `<div class="${P}log">
      <div class="${P}row head" aria-hidden="true">${HEAD.map(h => `<span>${h}</span>`).join("")}</div>
      ${rows.map(t => {
        const i = TRIPS.indexOf(t), c = cls(i), tag = pick ? "button" : "div";
        return `<${tag}${pick ? ` type="button" data-i="${i}" aria-pressed="${c.includes("on")}"` : ""} class="${P}row ${c}"><span>${t.id}</span><span>${t.pickup}</span><span>${t.dropoff}</span><span>${t.hour}</span><span>${t.minutes}</span><span>${t.fare.toFixed(1)}</span></${tag}>`;
      }).join("")}</div>`;
  const out = (text, cap, wrap = false) => `<pre class="${P}out${wrap ? " wrap" : ""}">${esc(text)}</pre>${cap ? `<p class="${P}cap">${cap}</p>` : ""}`;
  const RUNCAP = `Output from our run, pandas 3.1.1, ${RUN_DATE}.`;

  /* 1. The situation, and sorting the log into pickup piles by hand. */
  function sortPiles({ el, done, kit }) {
    css();
    let k = 0, msg = null;
    const piles = Object.fromEntries(DISTRICTS.map(d => [d, []]));
    const paint = () => {
      const fin = k === N;
      el.innerHTML = `<h1>Which district pays best?</h1>
        <p class="lead">A city taxi company has three districts: ${DISTRICTS.join(", ")}. Drivers choose where to wait for passengers, and they ask the office: where is the average fare best? Here is one day of the trip log: ${N} trips, each with where it started (pickup), where it ended (dropoff), the hour, the minutes it took and the fare.</p>
        <p class="lead">Questions like this about a table come before any model in an AI product. You will answer this one by hand first, then with pandas, the Python library for tables.</p>
        <p class="task">Sort the trips into piles by the district where the driver picked the passenger up. The ringed trip is next: tap its pile.</p>
        ${logRows(TRIPS, { cls: i => i < k ? "gone" : i === k ? "cur" : "" })}
        <div class="${P}bins">${DISTRICTS.map(d => `<button type="button" class="${P}bin" data-bin="${d}" ${fin ? "disabled" : ""}>${d}<small>${piles[d].join(" ") || "empty"}</small></button>`).join("")}</div>
        <div class="lpanel">${fin
          ? kit.feedback(`Sorted. ${DISTRICTS.map(d => `${d}: ${plural(PILES[d].length, "trip")}`).join(", ")}. Each trip went into exactly one pile, decided by one column: pickup. The next screen turns each pile into one number.`, true)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll(`button.${P}bin`).forEach(b => b.onclick = () => {
        const t = TRIPS[k], d = b.dataset.bin;
        if (d === t.pickup) {
          piles[d].push(t.id); k++;
          msg = [`${t.id} was picked up in ${t.pickup}: into the ${t.pickup} pile.`];
          paint(); if (k === N) done(); return;
        }
        msg = d === t.dropoff
          ? [`${t.id} ends in ${t.dropoff}: that is its dropoff. The drivers ask where to wait for passengers, so the pile is decided by pickup, which is ${t.pickup}.`, false]
          : [`${t.id} has nothing to do with ${d}: it was picked up in ${t.pickup} and dropped off in ${t.dropoff}. Read the pickup column.`, false];
        paint();
      });
    };
    paint();
  }

  /* 2. One number per pile: the average fare. */
  function averagePiles({ el, done, kit }) {
    css();
    const ans = DISTRICTS.map(() => null);
    const optsFor = d => [MEAN[d], SUM[d], DROP_MEAN[d]].filter((v, i, a) => a.findIndex(x => Math.abs(x - v) < 1e-9) === i).sort((a, b) => a - b);
    const paint = () => {
      const all = DISTRICTS.every((d, i) => ans[i] != null && Math.abs(optsFor(d)[ans[i]] - MEAN[d]) < 1e-9);
      el.innerHTML = `<h1>One number per pile</h1>
        <p class="lead">Here are the piles, each with its trips' fares. The drivers asked for the average fare in each district.</p>
        <p class="task">Work out each pile's average fare and pick it. Pick again if you change your mind.</p>
        ${DISTRICTS.map((d, i) => {
          const o = optsFor(d), correct = o.findIndex(v => Math.abs(v - MEAN[d]) < 1e-9), v = ans[i] == null ? null : o[ans[i]];
          const fb = v == null ? "" : ans[i] === correct
            ? kit.feedback(`Right: ${PILES[d].map(t => t.fare.toFixed(1)).join(" + ")} = ${f1(SUM[d])}, divided by ${PILES[d].length} trips = ${f1(MEAN[d])}.`, true)
            : Math.abs(v - SUM[d]) < 1e-9
              ? kit.feedback(`${f1(v)} is the total of the ${plural(PILES[d].length, "fare")}, not the average. A total grows with the number of trips, so a busy district with cheap trips can look best. Divide by ${PILES[d].length}.`, false)
              : kit.feedback(`${f1(v)} is the average of the ${plural(DROPS[d].length, "trip")} that ended in ${d} (dropoff). This pile holds the trips picked up in ${d}.`, false);
          return `<div class="lcase" id="c${i}"><div class="${P}pile"><b>${d}</b><div class="f">${PILES[d].map(t => `${t.id} ${t.fare.toFixed(1)}`).join(", ")}</div></div>${kit.options(o.map(f1), { picked: ans[i], correct, num: true })}${fb}</div>`;
        }).join("")}
        ${all ? kit.feedback(`The answer for the drivers: ${BEST}, with ${f1(MEAN[BEST])} on average, then ${DISTRICTS.filter(d => d !== BEST).sort((a, b) => MEAN[b] - MEAN[a]).map(d => `${d} ${f1(MEAN[d])}`).join(", ")}. For comparison, all ${N} trips together average ${f1(ALL_MEAN)}. You did three things: sorted rows into piles by one column, made one number from each pile, and put the numbers side by side.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (DISTRICTS.every((d, j) => ans[j] != null && Math.abs(optsFor(d)[ans[j]] - MEAN[d]) < 1e-9)) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: a new question changes only the middle step. */
  function spot({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "Sort the trips into new piles, by how long each trip took.",
      "Only the step inside each pile: largest minutes instead of average fare.",
      "Nothing: the average minutes per district already tells you the longest trip.",
      `Go through all ${N} trips once and keep the longest one.`
    ];
    const correct = 1;
    const A = "Airport";
    const fb = [
      "The question is still per district, so the piles are still by district. Trip length is what you measure inside each pile, not how you split the rows.",
      "",
      `An average hides the extremes. ${A} trips average ${f1(AVGMIN[A])} minutes, but its longest took ${MAXMIN[A]}.`,
      `That gives one number for the whole city: ${LONGEST.minutes} minutes (${LONGEST.id}). The manager wants one number per district.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>A new question from the manager</h1>
        <p class="lead">The manager liked the answer and asks a second question: what is the longest trip, in minutes, that started in each district? Think about the three things you just did by hand.</p>
        <p class="task">What changes in your work?</p>
        <div class="lpanel">${kit.options(opts.map(esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. ${DISTRICTS.map(d => `${d} ${MAXMIN[d]} min`).join(", ")}. Every question shaped like "something per district" is the same three moves. <b>Split</b> the rows into groups by one column. <b>Apply</b> one function to each group on its own: mean, max, count, sum. <b>Combine</b> the answers into one table, one row per group. The pandas documentation calls this <b>split-apply-combine</b>, and the pandas method for it is <code>groupby</code>. Only the middle step changes from question to question.`, true)
          : kit.feedback(fb[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Load: read_csv makes a DataFrame of typed columns. Predict each column's type. */
  const TYPE_OPTS = ["text (str)", "whole numbers (int64)", "decimal numbers (float64)"];
  const TYPE_Q = [
    { col: "hour", right: 1, yes: "Right: 8, 9, 11 … 23 are all whole numbers.", why: {
      0: "In the file every value is text, but read_csv looks at what each column holds. hour holds 8, 9, 11 … 23: whole numbers only, so it becomes int64.",
      2: "No value in hour has a decimal point (8, 9, 11 … 23), so read_csv has no reason to use decimals. It picks int64." } },
    { col: "fare", right: 2, yes: "Right: 11.5 and 25.5 have a decimal part, so the whole column is float64, even 12.0.", why: {
      0: "Every fare is a number such as 11.5 or 12.0, so read_csv turns the column into numbers. Text would make an average impossible.",
      1: "11.5 and 25.5 have a decimal part, and one column holds one type, so the whole column becomes float64. Even 12.0 is stored as a decimal." } },
    { col: "pickup", right: 0, yes: "Right: Center, Airport and Harbor are words.", why: {
      1: "Center, Airport and Harbor are words, not numbers. A column with words becomes text.",
      2: "Center, Airport and Harbor are words, not numbers. A column with words becomes text." } }
  ];
  function load({ el, done, kit }) {
    css();
    const ans = TYPE_Q.map(() => null);
    const csv = [COLS.join(","), ...TRIPS.slice(0, 3).map(t => [t.id, t.pickup, t.dropoff, t.hour, t.minutes, t.fare.toFixed(1)].join(",")), "…"].join("\n");
    const paint = () => {
      const all = TYPE_Q.every((q, i) => ans[i] === q.right);
      el.innerHTML = `<h1>Load the log into a DataFrame</h1>
        <p class="lead">In real work the log is a file, <code>trips.csv</code>, with thousands of rows. Its first lines:</p>
        ${out(csv)}
        <p class="lead">pandas loads it with one line: <code>trips = pd.read_csv("trips.csv")</code>. The result is a <b>DataFrame</b>: a table with named columns. In the file every value is just text. read_csv looks at each column and gives the whole column one type, the way every value in a NumPy array has one type.</p>
        <p class="task">Predict the type read_csv gave each column. Pick again if you change your mind.</p>
        ${TYPE_Q.map((q, i) => `<div class="lcase" id="c${i}"><p><code>${q.col}</code></p>${kit.options(TYPE_OPTS, { picked: ans[i], correct: q.right })}${ans[i] == null ? "" : ans[i] === q.right ? kit.feedback(q.yes, true) : kit.feedback(q.why[ans[i]], false)}</div>`).join("")}
        ${all ? `<p class="lead">Our run printed <code>trips.shape</code> as <code>${OUT.shape}</code> (rows, columns) and <code>trips.dtypes</code> as:</p>${out(OUT.dtypes, RUNCAP + " The last line, dtype: object, describes this list of types itself, not a column.")}
          ${kit.feedback(`Each column has one type. That is why <code>trips["fare"].mean()</code> works without a loop: it runs over one column of numbers, as NumPy does. One column on its own, <code>trips["fare"]</code>, is called a <b>Series</b>. A Series holds the values and the row labels 0 to ${N - 1}, called the <b>index</b>. Since pandas 3.0 (January 2026) text columns show <code>str</code>; older versions show <code>object</code>. If a column you expect to hold numbers shows <code>str</code>, some value in it could not be read as a number: that is the next lesson.`)}` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (TYPE_Q.every((q, j) => ans[j] === q.right)) done();
      }));
    };
    paint();
  }

  /* 5. Filter: a comparison makes a mask, the mask keeps rows. Tap the rows that survive. */
  function filter({ el, done, kit }) {
    css();
    const on = new Set();
    let msg = null, fin = false, bad = -1;
    const keep = i => TRIPS[i].hour >= NIGHT_FROM;
    const paint = () => {
      el.innerHTML = `<h1>Keep only the night trips</h1>
        <p class="lead">Night-shift drivers start at ${NIGHT_FROM}:00 and want the same answer for their hours only. In pandas you keep rows like this:</p>
        ${kit.code([`night = trips[trips["hour"] >= ${NIGHT_FROM}]`], -1)}
        <p class="task">Tap every trip that <code>night</code> keeps. Then press Check.</p>
        ${logRows(TRIPS, { pick: !fin, cls: i => (on.has(i) ? "on " : "") + (i === bad ? "bad" : "") })}
        ${fin ? "" : `<button type="button" class="btn ${P}check-btn" data-check>Check</button>`}
        <div class="lpanel">${msg || ""}
        ${fin ? `<p class="lead">What pandas did, in two parts. First <code>trips["hour"] >= ${NIGHT_FROM}</code> compares the whole column at once and gives one True or False per row, a <b>mask</b>:</p>${out(TRACE.is_night)}
          <p class="lead">Then <code>trips[mask]</code> keeps the rows marked True:</p>${out(TRACE.night, RUNCAP)}
          ${kit.feedback(`Look at the numbers on the left of the output: the kept rows keep their labels, ${TRIPS.findIndex(t => keep(TRIPS.indexOf(t)))} to ${N - 1}. The index stays with the row. No loop and no if: the comparison and the selection each work on whole columns.`)}` : ""}</div>`;
      el.querySelectorAll(`button.${P}row`).forEach(b => b.onclick = () => { const i = +b.dataset.i; on.has(i) ? on.delete(i) : on.add(i); bad = -1; paint(); });
      const c = el.querySelector("[data-check]");
      if (c) c.onclick = () => {
        const wrong = [...on].find(i => !keep(i)), miss = TRIPS.findIndex((t, i) => keep(i) && !on.has(i));
        if (wrong != null) {
          bad = wrong;
          msg = kit.feedback(`${TRIPS[wrong].id} started at ${TRIPS[wrong].hour}:00. ${TRIPS[wrong].hour} >= ${NIGHT_FROM} is False, so the mask drops it.`, false);
        } else if (miss >= 0) {
          bad = miss;
          msg = kit.feedback(`${TRIPS[miss].id} is missing. It started at ${TRIPS[miss].hour}:00, and ${TRIPS[miss].hour} >= ${NIGHT_FROM} is True${TRIPS[miss].hour === NIGHT_FROM ? ": >= includes the hour itself" : ""}.`, false);
        } else {
          fin = true; bad = -1;
          msg = kit.feedback(`Right: ${plural(NIGHT.length, "trip")}, ${NIGHT.map(t => t.id).join(", ")}.`, true);
          paint(); done(); return;
        }
        paint();
      };
    };
    paint();
  }

  /* 6. Two conditions: & with parentheses. The two broken lines fail for real (explore.out.txt). */
  function twoConditions({ el, done, kit }) {
    css();
    let ans = null;
    const LINES = [
      `trips[(trips["hour"] >= ${NIGHT_FROM}) and (trips["pickup"] == "Harbor")]`,
      `trips[trips["hour"] >= ${NIGHT_FROM} & trips["pickup"] == "Harbor"]`,
      `trips[(trips["hour"] >= ${NIGHT_FROM}) & (trips["pickup"] == "Harbor")]`
    ];
    const correct = 2;
    const harborNight = NIGHT.filter(t => t.pickup === "Harbor");
    const fb = {
      0: `Our run stopped with:${out(OUT.errAnd, "", true)}Python's <code>and</code> wants one True or False for the whole left side, but the left side is ${N} of them, one per row. pandas refuses to guess whether you mean "any" or "all". Row by row, mask with mask, is written <code>&amp;</code>.`,
      1: `Our run stopped with:${out(OUT.errPrec, "", true)}In Python, <code>&amp;</code> runs before <code>&gt;=</code> and <code>==</code>, so this tries <code>${NIGHT_FROM} &amp; trips["pickup"]</code> first: a number and a text column. The pandas docs say it plainly: each condition must sit in its own parentheses.`
    };
    const paint = () => {
      el.innerHTML = `<h1>Two conditions at once</h1>
        <p class="lead">A driver who lives near the harbor asks about night trips that start in Harbor only. Both conditions must hold for a row to stay.</p>
        <p class="task">Which line keeps exactly those rows? We ran all three.</p>
        <div class="lpanel ${P}opt">${kit.options(LINES.map(l => `<code>${esc(l)}</code>`), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Each condition makes its own mask, and <code>&amp;</code> combines them row by row: True only where both are True. <code>|</code> means or, <code>~</code> means not. Our run gave ${plural(harborNight.length, "row")}:${out(OUT.harborNight, RUNCAP)}`, true)
          : kit.feedback(fb[ans], false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. Use it with predictions: the night table, and why count sits next to mean. */
  function predictNight({ el, done, kit }) {
    css();
    let a0 = null, a1 = null;
    const c0 = DISTRICTS.indexOf(NBEST);
    const OPTS1 = [
      `Yes: ${NBEST} has the best average at night.`,
      `Not yet: ${NBEST}'s number rests on ${plural(NPILES[NBEST].length, "trip")}. ${NMOST}'s ${f1(NMEAN[NMOST])} rests on ${NPILES[NMOST].length}. Collect more nights before deciding.`,
      "Use the total fare per district instead of the average."
    ];
    const c1 = 1;
    const nightSum = d => sum(NPILES[d].map(t => t.fare));
    const fb0 = d => d === NMOST
      ? `${d} has the most night trips (${NPILES[d].length}) and averages ${f1(NMEAN[d])}. But the single ${NBEST} night trip, ${NPILES[NBEST][0].id}, paid ${f1(NPILES[NBEST][0].fare)}, and the average of one trip is that trip.`
      : `${d}'s night trips paid ${NPILES[d].map(t => f1(t.fare)).join(" and ")}: an average of ${f1(NMEAN[d])}. Look at the other districts' night trips in the rows above.`;
    const paint = () => {
      el.innerHTML = `<h1>The night-shift table</h1>
        <p class="lead">Now filter, then group. This line splits the ${NIGHT.length} night trips by pickup and applies two functions to each group's fares: the mean, and the count of trips. <code>agg</code> takes the list of functions to apply.</p>
        ${kit.code([`(night.groupby("pickup")["fare"]`, `      .agg(["mean", "count"]))`], -1)}
        <p class="lead ${P}gap">The ${NIGHT.length} night trips that <code>night</code> holds, from screen 5:</p>
        ${logRows(NIGHT)}
        <p class="task">Predict the table before you see it, then answer the driver.</p>
        <div class="lcase" id="c0"><p>Which district tops the night table by average fare?</p>${kit.options(DISTRICTS, { picked: a0, correct: c0 })}
          ${a0 == null ? "" : a0 === c0 ? kit.feedback(`Right. Our run:${out(TRACE.tableUnsorted, RUNCAP)}Compare the whole day: ${DISTRICTS.map(d => `${d} ${f1(MEAN[d])}`).join(", ")}. Filtering first changed the winner.`, true) : kit.feedback(fb0(DISTRICTS[a0]), false)}</div>
        ${a0 === c0 ? `<div class="lcase" id="c1"><p>A driver sees this table and wants to wait at ${NBEST} every night. What do you tell him?</p>${kit.options(OPTS1.map(esc), { picked: a1, correct: c1 })}
          ${a1 == null ? "" : a1 === c1
            ? kit.feedback(`Right. A mean says nothing about how much evidence is behind it; the count does. That is why the line asks for both. Make it a habit: a group table without its count can mislead.`, true)
            : a1 === 0 ? kit.feedback(`Look at the count column: ${NBEST} has ${NPILES[NBEST].length}. One long trip on one night decides the whole number. A single cheap trip tomorrow could put ${NBEST} last.`, false)
            : kit.feedback(`The totals at night are ${DISTRICTS.map(d => `${d} ${f1(nightSum(d))}`).join(", ")}. A total rewards the district with more trips, not better fares, and the driver earns per trip he takes. The problem is too few trips behind ${NBEST}'s number, and the count shows it.`, false)}</div>` : ""}`;
      const c = el.querySelectorAll(".lcase");
      c[0].querySelectorAll(".lopts button").forEach(b => b.onclick = () => { a0 = +b.dataset.i; paint(); });
      if (c[1]) c[1].querySelectorAll(".lopts button").forEach(b => b.onclick = () => { a1 = +b.dataset.i; paint(); if (a0 === c0 && a1 === c1) done(); });
    };
    paint();
  }

  /* 8. The whole thing in Python: a traced run of night_fares (trace.out.txt). Listing = traced source. */
  const CODE = [
    "def night_fares(path):",
    "    trips = pd.read_csv(path)",
    "    is_night = trips[\"hour\"] >= 20",
    "    night = trips[is_night]",
    "    groups = night.groupby(\"pickup\")",
    "    fares = groups[\"fare\"]",
    "    table = fares.agg([\"mean\", \"count\"])",
    "    table = table.sort_values(",
    "        \"mean\", ascending=False)",
    "    return table"
  ];
  // one step per traced event that made a variable: [highlighted line (just ran), the variable it made, its repr].
  // The trace's two extra events inside the two-line sort_values call (lines 8, then 7) change no variable and are
  // left out; the sort step highlights the call's first line, 7.
  const STEPS = [
    [0, "path", "'trips.csv'"],
    [1, "trips", TRACE.trips],
    [2, "is_night", TRACE.is_night],
    [3, "night", TRACE.night],
    [4, "groups", TRACE.groups],
    [5, "fares", TRACE.fares],
    [6, "table", TRACE.tableUnsorted],
    [7, "table", TRACE.table],
    [9, "returns", TRACE.table]
  ];
  const SAY = [
    "The function gets the file name. Nothing is loaded yet.",
    `read_csv reads the file and picks a type for each column: ${N} rows, ${COLS.length} columns. With <code>usecols=["pickup", "hour", "fare"]</code> it would load only the three columns this question needs; on a big file that saves memory.`,
    `One comparison over the whole hour column: ${N} True or False values, one per row. This is the mask.`,
    `The mask keeps the True rows: ${NIGHT.length} trips, with their labels.`,
    `Look at what came back: not a table, a GroupBy object. The pandas docs say no splitting happens until it is needed; this line only checks that you grouped by a real column. The split is ready, nothing is computed yet.`,
    `<code>groups["fare"]</code> picks the fare column inside every group. Still an object with no numbers in it: the work waits for the function you apply.`,
    `<code>agg</code> does apply and combine: one row per district, one column per function. The district names are sorted and become the row labels (the index). <code>groupby("pickup", as_index=False)</code> would keep them as an ordinary column instead.`,
    `<code>sort_values("mean", ascending=False)</code>, written over two lines so it fits the screen, puts the best average first. Without <code>ascending=False</code> the lowest would come first.`,
    `The function returns the table you predicted. Filter, group, aggregate, sort: the same four steps for any "per district" question, on ${N} rows or a few million that fit in memory.`
  ];
  const Q8 = ["groups = night.groupby(…)", "table = fares.agg(…)", "table = table.sort_values(…)"];
  const Q8_RIGHT = 1;
  const Q8_NO = {
    0: "That line makes a GroupBy object, not numbers: step to it and look at what it printed. The pandas docs say no splitting happens until it is needed; the work waits for the function you apply.",
    2: "By then the means and counts already exist: sort_values only reorders the rows of a finished table."
  };
  function asCode({ el, done, kit }) {
    css();
    let i = 0, ans = null;
    const check = () => { if (i === STEPS.length - 1 && ans === Q8_RIGHT) done(); };
    const paint = () => {
      const [ln, name, repr] = STEPS[i];
      el.innerHTML = `<h1>The same steps in Python</h1>
        <p class="lead">Everything so far in one function, replayed from a real run. The highlighted line is the one that just ran; under it is the value that line made, as Python printed it.</p>
        <p class="task">Predict, then step through to the end to check: on which line does pandas actually compute the mean fare of each district?</p>
        <div class="lpanel" id="q8">${kit.options(Q8.map(esc), { picked: ans, correct: Q8_RIGHT })}
        ${ans == null ? "" : ans === Q8_RIGHT ? kit.feedback("Right. Step through and watch the groups and fares lines print objects with no numbers in them.", true) : kit.feedback(Q8_NO[ans], false)}</div>
        ${kit.code(CODE, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === STEPS.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>${esc(name)}</span><span>step <b>${i + 1} / ${STEPS.length}</b></span></div>
        ${out(repr, name === "groups" || name === "fares" ? `From our traced run, pandas 3.1.1, ${TRACE_DATE}. The address after "at" differs on every run.` : i === STEPS.length - 1 ? `From our traced run, pandas 3.1.1, ${TRACE_DATE}.` : "")}
        ${kit.feedback(SAY[i])}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); check(); };
      el.querySelectorAll("#q8 .lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); check(); });
    };
    paint();
  }

  /* 9. The big picture: what for, when not, what it costs. */
  const SITS = [
    { s: "Last year's trip log is one CSV file, about half the size of the laptop's memory. The same trips are also in the company database. You need the average fare per district.",
      o: ["read_csv the whole file, then group", "read_csv with usecols for the two columns you need, or let the company database run the grouping", "Open it in a spreadsheet first"], ok: 1,
      no: { 0: "The pandas docs warn that even data that takes a large part of memory becomes hard to work with, because some operations make temporary copies. And text columns cost more: in our run the pickup column took " + OUT.mem.pickup + " bytes against " + OUT.mem.fare + " for fare, for the same " + N + " rows.",
            2: "A spreadsheet hits the same memory wall and adds manual steps nobody can repeat. Load less, or let a database do the grouping where the data already lives." },
      yes: "Right. Load only what the question needs. When the data lives in a database, a GROUP BY query there sends back three rows instead of a year of trips." },
    { s: "The booking app must show each rider their own last five trips, thousands of times per minute.",
      o: ["Load the trip log into a DataFrame for each request and filter it", "A database query by rider, inside the app"], ok: 1,
      no: { 0: "Each request would load the whole log to keep five rows. pandas is for analysing a table you hold in memory, not for answering many small lookups in a live service." },
      yes: "Right. One rider's rows is an indexed lookup, which a database is built for. pandas is for the analysis behind the app, not the app's requests." },
    { s: "The company adds a 10% booking fee to every fare in the table.",
      o: ["A for loop over the rows that updates each fare", "One column operation: trips[\"fare\"] * 1.1"], ok: 1,
      no: { 0: "The pandas docs say iterating over rows is generally slow and usually not needed: the same work on a whole column runs at once, the way the mask did." },
      yes: "Right. Whole-column operations are the point of pandas. A loop over rows throws that away." }
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = SITS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for pandas</h1>
        <p class="lead"><b>What it is for:</b> answering questions about a table: load it, filter rows, group and aggregate, then pass clean columns to a model.</p>
        <p class="lead"><b>When not:</b> data bigger than memory (load less, read it in chunks, a part at a time, or use a database or a tool built for data larger than memory); single-record lookups inside a live app (a database); logic written as a loop over rows (use column operations).</p>
        <p class="lead"><b>What it costs:</b> the whole table sits in memory, text columns cost more than numbers, some steps make copies, and an average without its count can mislead you.</p>
        <p class="task">For each situation, pick what you do. Pick again if you change your mind.</p>
        ${SITS.map((t, i) => `<div class="lcase" id="c${i}"><p>${esc(t.s)}</p>${kit.options(t.o.map(esc), { picked: ans[i], correct: t.ok })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === t.ok ? t.yes : t.no[ans[i]]), ans[i] === t.ok)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SITS.every((t, j) => ans[j] === t.ok)) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it: is filter + groupby the tool? */
  const CASES = [
    ["A driving school exports 8,000 booked lessons to a CSV and wants the share of no-shows (booked lessons where the student did not come) for each weekday.", true,
      "Yes. Split by weekday, apply \"share of no-shows\" to each group, combine into seven rows. The CSV fits easily in memory.",
      "This is \"something per weekday\": split by weekday, apply one function (the share of no-shows), combine. That is groupby on a table that fits in memory."],
    ["A music school has a 600-row table of exam results and wants the average score per instrument, only for this year's students.", true,
      "Yes. Filter to this year's students with a mask, then group by instrument, and ask for the count next to the mean: a rare instrument may have two students.",
      "Filter first (a mask on the year), then split by instrument and take the mean. Add the count: a rare instrument with two students should not top the table by luck."],
    ["An online shop must check, at checkout, whether the coupon code a customer typed is still valid.", false,
      "No. This is one lookup per checkout in a live app, not a question about a whole table. The coupon codes belong in a database or a dict keyed by code.",
      "There is nothing to split or average: one customer, one code, one yes or no, many times a minute in a live app. Loading a table into pandas per checkout would be slow and pointless. A database lookup or a dict keyed by code answers it."],
    ["A writer wants to know which of her 40 short stories mention the sea.", false,
      "No. This is searching text, not grouping rows. Read each story's text and look for the word (or use search); there are no columns to group by.",
      "There is no table here: no rows with columns like district and fare. It is a text search over 40 documents. You could force them into a DataFrame, but split-apply-combine has nothing to split by."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is this a filter-and-group job?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from taxis.</p>
        <p class="task">For each one, decide: is a pandas filter and groupby the right tool? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and what you should see (from our run). */
  function whatNext({ el, done, topic }) {
    css();
    const nx = topic && topic.next;
    const CHECK = [
      `<code>trips.shape</code> prints <code>(${N}, ${COLS.length})</code>.`,
      `<code>trips.dtypes</code> shows <code>str</code> for trip_id, pickup and dropoff (<code>object</code> if your pandas is older than 3.0), <code>int64</code> for hour and minutes, <code>float64</code> for fare.`,
      `<code>trips["hour"] >= ${NIGHT_FROM}</code> prints ${N} True/False values, and the last ${NIGHT.length} are True.`,
      `<code>trips.groupby("pickup")["fare"].mean()</code> gives ${DISTRICTS.map(d => `${d} ${f1(MEAN[d])}`).join(", ")}.`,
      `The night table puts ${NBEST} first with a mean of ${f1(NMEAN[NBEST])} and a count of ${NPILES[NBEST].length}.`,
      `The Harbor-at-night line with <code>&amp;</code> but no parentheses raises a TypeError; the one with <code>and</code> raises a ValueError: "The truth value of a Series is ambiguous".`
    ];
    el.innerHTML = `<h1>What next</h1>
      <p class="lead">You can now say what a DataFrame is (named columns, one type each, row labels), how a comparison becomes a mask that filters rows, and how any "something per group" question is split-apply-combine with <code>groupby</code>. You also know to read the count next to a mean, and when pandas is the wrong tool.</p>
      ${NOTEBOOK_URL ? `<p><a class="btn ${P}nb" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook for this lesson in Colab</a></p>` : ""}
      <p class="lead">${NOTEBOOK_URL ? "The notebook" : "The notebook for this lesson is on its way. It"} loads the same ${N}-trip log and runs every step of this lesson. What you should see, from our run:</p>
      <ul class="${P}check">${CHECK.map((c, i) => `<li><label><input type="checkbox" id="${P}k${i}"><span>${c}</span></label></li>`).join("")}</ul>
      ${nx ? `<p class="lead">Next: <b>${esc(nx.title)}</b>. Every value in this log was clean; real exports have blanks, "N/A", duplicates and numbers stored as text, and the same groupby gives wrong answers until you fix them.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "pandas DataFrames: load, filter, group",
    checked: "2026-11-13",
    sources: [
      "https://pandas.pydata.org/docs/user_guide/groupby.html",
      "https://pandas.pydata.org/docs/user_guide/indexing.html",
      "https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html",
      "https://pandas.pydata.org/docs/whatsnew/v3.0.0.html",
      "https://pandas.pydata.org/docs/user_guide/scale.html",
      "https://pandas.pydata.org/docs/user_guide/basics.html"
    ],
    interview: [{
      q: "You get a CSV of a year of taxi trips and the product team asks which pickup zone has the highest average fare. Walk me through how you answer it with pandas, and what could make your answer wrong.",
      good: [
        "Load with read_csv, only the columns needed (usecols), and check dtypes: fare must be a number column",
        "Filter the rows the question is about with a boolean mask, for example completed trips or a time window, using & and parentheses",
        "groupby the zone and aggregate the fare with both mean and count",
        "Do not trust a top mean that rests on a handful of trips; report the count or set a minimum",
        "If the file does not fit in memory, load less, read in chunks, or run the GROUP BY in the database"
      ],
      weak: "Loop over the rows, keep a running total per zone in a dict, and report the highest average. It works on a small file but is slow, skips the type check, and hides how many trips are behind each number."
    }, {
      q: "A colleague's report says the airport zone pays best at night. You notice the table has no count column. What do you do?",
      good: [
        "Re-run the groupby with count (or size) next to the mean",
        "If a group has only a few rows, say the result is not reliable yet and gather more data",
        "Check that the night filter is right, for example that the hour condition includes the boundary hour",
        "Compare with the all-day result to see whether filtering changed the winner"
      ],
      weak: "Accept the result because the mean is the highest. An average of one or two trips is just those trips."
    }],
    screens: [sortPiles, averagePiles, spot, load, filter, twoConditions, predictNight, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-bin="${TRIPS[0].dropoff}"]`], right: TRIPS.map(t => `[data-bin="${t.pickup}"]`) },
      { wrong: ["#c0 [data-wrong]"], right: DISTRICTS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: TYPE_Q.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ['[data-i="0"]', "[data-check]", '[data-i="0"]'], right: [...TRIPS.map((t, i) => t.hour >= NIGHT_FROM ? `[data-i="${i}"]` : null).filter(Boolean), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["#q8 [data-wrong]"], right: ["#q8 [data-right]", ...Array(STEPS.length - 1).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: SITS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
