/* Lesson s1-py-async: async and await in Python.
   Story: a shop's shipping-rate checker must ask three parcel carriers for a price (Northway 2 s, Kite 1 s,
   Harbor 3 s; made up for the lesson) before it can show the shopper the cheapest.
   Ideas: (1) a slow call is mostly waiting; at each await the call steps aside and the event loop runs another
   one, so on one thread the total becomes the longest wait instead of the sum (asyncio.gather); (2) async helps
   only with waiting: a call that blocks without awaiting, CPU-heavy work, and calls that need each other's
   answers get nothing from it.
   Depth: explain (screens 1-3, 8, 9), scratch (screen 4: a generator-based loop), library (screens 5-6: gather,
   create_task), when-not (screens 7-9).
   Data: docs/ai-path/runs/s1-py-async/ (carriers.py -> carriers.out.txt: four versions of the checker, with
   asyncio.sleep standing in for each carrier's server; tiny_loop.py -> tiny_loop.out.txt: the traced loop;
   blocking.py -> blocking.out.txt: the broken version and its fix; await_sleep.py -> await_sleep.out.txt;
   cpu.py -> cpu.out.txt). No model calls were recorded. Every number on screen is computed here from CARRIERS,
   LOG, TRACE, CPU and AWAIT_SLEEP. Lesson-local CSS: run-log block, caption, clickable code lines,
   hanging indent for wrapped code lines (prefix lx-s1-py-async-). */
(() => {
  const P = "lx-s1-py-async-";
  const RAN = "2026-11-13";

  // The three carriers as in carriers.py: seconds the server takes, price in cents
  const CARRIERS = [
    { name: "Northway", s: 2, cents: 740, fn: "ask_northway" },
    { name: "Kite", s: 1, cents: 810, fn: "ask_kite" },
    { name: "Harbor", s: 3, cents: 695, fn: "ask_harbor" }
  ];
  const SLOTS = 6; // seconds shown on the timeline

  // From docs/ai-path/runs/s1-py-async/carriers.out.txt (one block per version, not altered)
  const LOG = {
    one: `== cheapest_one_by_one ==
  0.00 s  ask Northway
  2.00 s  Northway answers 740
  2.00 s  ask Kite
  3.00 s  Kite answers 810
  3.00 s  ask Harbor
  6.00 s  Harbor answers 695
  cheapest 695, total 6.00 s`,
    together: `== cheapest ==
  0.00 s  ask Northway
  0.00 s  ask Kite
  0.00 s  ask Harbor
  1.00 s  Kite answers 810
  2.00 s  Northway answers 740
  3.00 s  Harbor answers 695
  quotes: [740, 810, 695]
  cheapest 695, total 3.00 s`,
    js: `== cheapest_js_habit ==
  0.00 s  ask Northway
  2.00 s  Northway answers 740
  2.00 s  ask Kite
  3.00 s  Kite answers 810
  3.00 s  ask Harbor
  6.00 s  Harbor answers 695
  cheapest 695, total 6.00 s`,
    tasks: `== cheapest_tasks ==
  0.00 s  ask Northway
  0.00 s  ask Kite
  0.00 s  ask Harbor
  1.00 s  Kite answers 810
  2.00 s  Northway answers 740
  3.00 s  Harbor answers 695
  cheapest 695, total 3.00 s`,
    // From docs/ai-path/runs/s1-py-async/blocking.out.txt
    blocked: `== cheapest ==
  0.00 s  ask Northway
  2.01 s  Northway answers 740
  2.01 s  ask Kite
  3.01 s  Kite answers 810
  3.01 s  ask Harbor
  6.01 s  Harbor answers 695
  cheapest 695, total 6.01 s`,
    fixed: `== cheapest_fixed ==
  0.00 s  ask Northway
  0.00 s  ask Kite
  0.00 s  ask Harbor
  1.01 s  Kite answers 810
  2.00 s  Northway answers 740
  3.01 s  Harbor answers 695
  cheapest 695, total 3.01 s`
  };
  // From docs/ai-path/runs/s1-py-async/await_sleep.out.txt
  const AWAIT_SLEEP = "after 1.01 s: TypeError: 'NoneType' object can't be awaited";
  // From docs/ai-path/runs/s1-py-async/cpu.out.txt (three CPU-only jobs of about a second each, Apple M1)
  const CPU = { seq: 2.87, gather: 2.84, procs: 1.38 };

  // From docs/ai-path/runs/s1-py-async/tiny_loop.out.txt, from the first step at line 3 on:
  // [line about to run, 1 = return event, clock, quotes, waiting [[wake-up time, name]], name, wait]
  const TRACE = [
    [3, 0, 0, {}, [[0, "Northway"], [0, "Kite"], [0, "Harbor"]], null, null],
    [4, 0, 0, {}, [[0, "Northway"], [0, "Kite"], [0, "Harbor"]], null, null],
    [5, 0, 0, {}, [[0, "Northway"], [0, "Kite"], [0, "Harbor"]], null, null],
    [6, 0, 0, {}, [[0, "Kite"], [0, "Harbor"]], "Northway", null],
    [7, 0, 0, {}, [[0, "Kite"], [0, "Harbor"]], "Northway", null],
    [8, 0, 0, {}, [[0, "Kite"], [0, "Harbor"]], "Northway", 2],
    [3, 0, 0, {}, [[0, "Kite"], [0, "Harbor"], [2, "Northway"]], "Northway", 2],
    [4, 0, 0, {}, [[0, "Kite"], [0, "Harbor"], [2, "Northway"]], "Northway", 2],
    [5, 0, 0, {}, [[0, "Kite"], [0, "Harbor"], [2, "Northway"]], "Northway", 2],
    [6, 0, 0, {}, [[0, "Harbor"], [2, "Northway"]], "Kite", 2],
    [7, 0, 0, {}, [[0, "Harbor"], [2, "Northway"]], "Kite", 2],
    [8, 0, 0, {}, [[0, "Harbor"], [2, "Northway"]], "Kite", 1],
    [3, 0, 0, {}, [[0, "Harbor"], [2, "Northway"], [1, "Kite"]], "Kite", 1],
    [4, 0, 0, {}, [[0, "Harbor"], [2, "Northway"], [1, "Kite"]], "Kite", 1],
    [5, 0, 0, {}, [[0, "Harbor"], [1, "Kite"], [2, "Northway"]], "Kite", 1],
    [6, 0, 0, {}, [[1, "Kite"], [2, "Northway"]], "Harbor", 1],
    [7, 0, 0, {}, [[1, "Kite"], [2, "Northway"]], "Harbor", 1],
    [8, 0, 0, {}, [[1, "Kite"], [2, "Northway"]], "Harbor", 3],
    [3, 0, 0, {}, [[1, "Kite"], [2, "Northway"], [3, "Harbor"]], "Harbor", 3],
    [4, 0, 0, {}, [[1, "Kite"], [2, "Northway"], [3, "Harbor"]], "Harbor", 3],
    [5, 0, 0, {}, [[1, "Kite"], [2, "Northway"], [3, "Harbor"]], "Harbor", 3],
    [6, 0, 1, {}, [[2, "Northway"], [3, "Harbor"]], "Kite", 3],
    [7, 0, 1, {}, [[2, "Northway"], [3, "Harbor"]], "Kite", 3],
    [9, 0, 1, {}, [[2, "Northway"], [3, "Harbor"]], "Kite", 3],
    [10, 0, 1, {}, [[2, "Northway"], [3, "Harbor"]], "Kite", 3],
    [3, 0, 1, { Kite: 810 }, [[2, "Northway"], [3, "Harbor"]], "Kite", 3],
    [4, 0, 1, { Kite: 810 }, [[2, "Northway"], [3, "Harbor"]], "Kite", 3],
    [5, 0, 1, { Kite: 810 }, [[2, "Northway"], [3, "Harbor"]], "Kite", 3],
    [6, 0, 2, { Kite: 810 }, [[3, "Harbor"]], "Northway", 3],
    [7, 0, 2, { Kite: 810 }, [[3, "Harbor"]], "Northway", 3],
    [9, 0, 2, { Kite: 810 }, [[3, "Harbor"]], "Northway", 3],
    [10, 0, 2, { Kite: 810 }, [[3, "Harbor"]], "Northway", 3],
    [3, 0, 2, { Kite: 810, Northway: 740 }, [[3, "Harbor"]], "Northway", 3],
    [4, 0, 2, { Kite: 810, Northway: 740 }, [[3, "Harbor"]], "Northway", 3],
    [5, 0, 2, { Kite: 810, Northway: 740 }, [[3, "Harbor"]], "Northway", 3],
    [6, 0, 3, { Kite: 810, Northway: 740 }, [], "Harbor", 3],
    [7, 0, 3, { Kite: 810, Northway: 740 }, [], "Harbor", 3],
    [9, 0, 3, { Kite: 810, Northway: 740 }, [], "Harbor", 3],
    [10, 0, 3, { Kite: 810, Northway: 740 }, [], "Harbor", 3],
    [3, 0, 3, { Kite: 810, Northway: 740, Harbor: 695 }, [], "Harbor", 3],
    [11, 0, 3, { Kite: 810, Northway: 740, Harbor: 695 }, [], "Harbor", 3],
    [11, 1, 3, { Kite: 810, Northway: 740, Harbor: 695 }, [], "Harbor", 3]
  ];

  /* ---------- derived ---------- */
  const N = CARRIERS.length;
  const SUM = CARRIERS.reduce((a, c) => a + c.s, 0);
  const LONGEST = Math.max(...CARRIERS.map(c => c.s));
  const FASTEST = CARRIERS.reduce((a, c) => c.s < a.s ? c : a);
  const SLOWEST = CARRIERS.reduce((a, c) => c.s > a.s ? c : a);
  const CHEAP = CARRIERS.reduce((a, c) => c.cents < a.cents ? c : a);
  const money = c => "$" + (c / 100).toFixed(2);
  const total = log => +log.match(/total ([\d.]+) s/)[1];
  const logLines = log => log.split("\n").slice(1);              // without the "== name ==" header
  const startsSeq = CARRIERS.map((_, i) => CARRIERS.slice(0, i).reduce((a, c) => a + c.s, 0));
  const plusSum = CARRIERS.map(c => c.s).join(" + ");

  function css() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}out { white-space: pre-wrap; font: 500 14px/1.6 var(--mono); background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin: 12px 0 0; overflow-wrap: anywhere; font-variant-ligatures: none; }
      .${P}out b { font-weight: 700; }
      .${P}cap { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
      .${P}pick { padding: 6px 0; }
      .${P}pick button { display: block; width: 100%; min-height: 44px; text-align: left; font: inherit; color: inherit; background: transparent; border: 0; border-left: 3px solid transparent; padding: 0 12px; white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; }
      .${P}pick button:hover { background: color-mix(in srgb, var(--code-ink) 8%, var(--code-bg)); }
      .${P}pick button.on { background: color-mix(in srgb, var(--code-ink) 16%, var(--code-bg)); border-left-color: var(--code-ink); }
      .${P}pick button.no { border-left-color: var(--bad); }
      .${P}wl { margin-top: 12px; }
      .${P}wrap .lcode div, .${P}pick button { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + var(--ind, 4ch)); text-indent: calc(-1 * var(--ind, 4ch)); }
    `;
    document.head.appendChild(s);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const runLog = (text, file) => `<pre class="${P}out">${esc(text)}</pre><p class="${P}cap">Run on our Mac, ${RAN} (docs/ai-path/runs/s1-py-async/${file}).</p>`;

  // a wrapped piece of a line starts 4 characters right of that line's own indentation, as Python continuation lines do
  const ind = line => `--ind:${line.match(/^ */)[0].length + 4}ch`;
  const code = (kit, lines, active) => { let j = 0; return `<div class="${P}wrap">${kit.code(lines, active).replace(/<div/g, () => `<div style="${ind(lines[j++])}"`)}</div>`; };

  /* timeline picture: one row per carrier, one cell per second; a bar fills the seconds its call is open */
  function timeline(kit, starts, bad, pick) {
    const rows = CARRIERS.map(() => Array(SLOTS).fill(""));
    const cls = {};
    CARRIERS.forEach((c, r) => {
      const st = starts[r];
      if (st == null) return;
      for (let k = st; k < Math.min(SLOTS, st + c.s); k++) cls[`${r},${k}`] = bad === r ? "no" : "in";
      rows[r][st] = `${c.s} s`;
    });
    return kit.pics.grid(rows, {
      cls, pick, rowHead: CARRIERS.map(c => c.name),
      colHead: Array.from({ length: SLOTS }, (_, k) => `${k}`),
      title: "seconds after the shopper clicks (column = the second a call starts)"
    });
  }

  /* 1. The situation, and the slow version laid out by hand. */
  const SEQ = [
    "async def cheapest_one_by_one(parcel):",
    "    north = await ask_northway(parcel)",
    "    kite = await ask_kite(parcel)",
    "    harbor = await ask_harbor(parcel)",
    "    return min(north, kite, harbor)"
  ];
  function oneByOne({ el, done, kit }) {
    css();
    const starts = CARRIERS.map(() => null);
    let miss = null, ans = null;
    const allRight = () => starts.every((s, i) => s === startsSeq[i]);
    const paint = () => {
      const placed = allRight(), ok = ans === 1;
      el.innerHTML = `<h1>Three carriers, one waiting shopper</h1>
        <p class="lead">You build the shipping step of a web shop. Before the shopper pays, a rate checker asks three parcel carriers what this box costs and shows the cheapest. Each carrier's server takes a while to answer: ${CARRIERS.map(c => `${c.name} ${c.s}&nbsp;s`).join(", ")}. AI products wait in the same way: every call to a model API is a slow network call. This lesson shows how to make such waits overlap. The first version awaits the carriers one after another. Each <code>ask_…</code> is an <code>async def</code> (Python's async function) that calls one carrier and returns its price in cents.</p>
        ${code(kit, SEQ, -1)}
        <p class="task">Lay out the calls on the timeline: in each carrier's row, tap the second its call starts.</p>
        ${timeline(kit, starts, miss ? miss.r : -1, !ok)}
        <div class="lpanel">
          ${miss ? kit.feedback(miss.say, false) : ""}
          ${placed ? `<div id="t"><p class="task">How long does the shopper wait for the cheapest price?</p>
            ${kit.options([`${LONGEST} s`, `${SUM} s`], { picked: ans, correct: 1, num: true })}
            ${ans == null ? "" : ok ? kit.feedback(`Right: ${plusSum} = <b>${SUM} s</b>. Each await holds the function on its line until that carrier answers, so the waits add up. We ran this version with a pause of the same length standing in for each server:`, true)
              : kit.feedback(`${LONGEST} s is ${SLOWEST.name} alone. Here ${SLOWEST.name} cannot start until the two calls above it have answered, so the waits add up: ${plusSum}.`, false)}
            ${ok ? runLog(LOG.one, "carriers.py") : ""}</div>` : ""}
        </div>`;
      el.querySelectorAll(".lp-gc[data-i]").forEach(b => b.onclick = () => {
        if (ok) return;
        const r = +b.dataset.r, c = +b.dataset.c, car = CARRIERS[r], prev = CARRIERS[r - 1];
        const ln = k => `the <code>${kit.esc(SEQ[k + 1].trim().split(" ")[0])} = await …</code> line`;   // carrier k's line in SEQ
        miss = null;
        if (r > 0 && starts[r - 1] !== startsSeq[r - 1]) {
          miss = { r, say: `Place ${prev.name} first. ${ln(r)[0].toUpperCase() + ln(r).slice(1)} runs only after ${ln(r - 1)} has finished, so ${car.name}'s start depends on where ${prev.name} ends.` };
        } else if (c + car.s > SLOTS) {
          miss = { r, say: `${car.name} takes ${car.s} s: starting at ${c} s it would run past the end of the timeline. Nothing waits that long here.` };
          starts[r] = null;
        } else {
          starts[r] = c;
          if (c !== startsSeq[r]) miss = { r, say: r === 0
            ? `Nothing runs before ${ln(0)}. The shopper clicks at 0 s and the function asks ${car.name} right away.`
            : c < startsSeq[r]
              ? `At ${c} s, ${prev.name} has not answered yet: its call is open until ${startsSeq[r]} s. The <code>await</code> in ${ln(r - 1)} keeps the function there until then, so ${ln(r)} cannot ask ${car.name} earlier.`
              : `Nothing pauses between the lines. ${prev.name} answers at ${startsSeq[r]} s, and ${ln(r)} runs at once.` };
        }
        paint();
      });
      el.querySelectorAll("#t .lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 2. The same calls handed to asyncio.gather. */
  const GATHER = [
    "async def cheapest(parcel):",
    "    quotes = await asyncio.gather(",
    "        ask_northway(parcel),",
    "        ask_kite(parcel),",
    "        ask_harbor(parcel),",
    "    )",
    "    print(\"  quotes:\", quotes)",
    "    return min(quotes)"
  ];
  function together({ el, done, kit }) {
    css();
    const starts = CARRIERS.map(() => null);
    let miss = null, ans = null;
    const OPTS = [FASTEST.s, SUM / N, LONGEST, SUM].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const right = OPTS.indexOf(LONGEST);
    const placed = () => starts.every(s => s === 0);
    const say = v => v === FASTEST.s ? `${FASTEST.name} answers at ${FASTEST.s} s, but the cheapest price needs all ${N} prices. The last one, ${SLOWEST.name}, arrives at ${SLOWEST.s} s.`
      : v === SUM / N ? `${SUM} ÷ ${N} = ${SUM / N} s treats the waits as work shared out. Nothing is shared: each call still waits its own time. The calls overlap, so the shopper waits as long as the slowest one.`
      : `${SUM} s is the one-after-another version. Here all ${N} calls are open at the same time, so their waits overlap.`;
    const paint = () => {
      const ok = ans === right;
      el.innerHTML = `<h1>Ask all three at once</h1>
        <p class="lead">The second version hands the three calls to <code>asyncio.gather</code>. Like <code>Promise.all</code> in JavaScript, it waits until all have answered and returns their results in a list. Unlike <code>Promise.all</code>, it is also what starts the calls: it starts all of them before it waits for any.</p>
        ${code(kit, GATHER, -1)}
        <p class="task">Lay out these calls on the timeline: tap the second each call starts.</p>
        ${timeline(kit, starts, miss ? miss.r : -1, !ok)}
        <div class="lpanel">
          ${miss ? kit.feedback(miss.say, false) : ""}
          ${placed() ? `<div id="t"><p class="task">Predict: how long does the shopper wait now?</p>
            ${kit.options(OPTS.map(v => `${v} s`), { picked: ans, correct: right, num: true })}
            ${ans == null ? "" : ok ? kit.feedback(`Right: <b>${LONGEST} s</b>, the longest single wait, instead of ${SUM} s, the sum. Our run of this version:`, true) : kit.feedback(say(OPTS[ans]), false)}
            ${ok ? runLog(LOG.together, "carriers.py") : ""}</div>` : ""}
        </div>`;
      el.querySelectorAll(".lp-gc[data-i]").forEach(b => b.onclick = () => {
        if (ok) return;
        const r = +b.dataset.r, c = +b.dataset.c, car = CARRIERS[r];
        miss = null;
        if (c + car.s > SLOTS) { miss = { r, say: `${car.name} takes ${car.s} s: starting at ${c} s it would run past the end of the timeline.` }; starts[r] = null; }
        else {
          starts[r] = c;
          if (c !== 0) miss = { r, say: `gather starts all ${N} calls before it waits for any of them. ${car.name} does not wait for another carrier to answer: its call starts at 0 s.` };
        }
        paint();
      });
      el.querySelectorAll("#t .lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: one thread, three waits. */
  function spotIdea({ el, done, kit }) {
    css();
    let ans = null;
    const opts = [
      "gather opens one thread per carrier, and the three threads wait side by side",
      "Each call steps aside while it waits, so the three waits overlap on one thread",
      "Python runs the three calls' lines at the same moment on three processor cores"
    ];
    const paint = () => {
      const ok = ans === 1;
      el.innerHTML = `<h1>How can one thread do three things?</h1>
        <p class="lead">The asyncio code runs on one thread: one line of Python at a time. Yet in the gather version the ${N} calls were all open at the same time, and the shopper waited ${total(LOG.together).toFixed(2)} s instead of ${total(LOG.one).toFixed(2)} s.</p>
        <p class="task">What makes that possible?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok ? kit.feedback(`Right. During those ${LONGEST} s Python has almost nothing to do: each call sent a request and is waiting for a carrier's server. Three names for what you just saw: a function defined with <code>async def</code> is a <b>coroutine</b>, a function that can pause. <code>await</code> is where it pauses and hands control back. The <b>event loop</b> is the part of asyncio that keeps the paused coroutines and resumes each one when what it waits for is ready. So waits overlap, and the total is close to the longest wait.`, true)
          : ans === 0 ? kit.feedback("asyncio does not start threads for this: asyncio runs all the calls in one thread, one at a time. Threads are a different tool (you will meet one on screen 7). Here nothing needs a second thread, because the calls are not working, they are waiting.", false)
          : kit.feedback("One thread runs one line at a time, so no two lines of these calls ever run at the same moment. They do not need to: the processor is nearly idle while each call waits for a server. The gain comes from overlapping waits, not from running code side by side.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. From scratch: a tiny event loop on generators, stepped from the real trace. */
  const CARRIER_GEN = [
    "def carrier(seconds, cents):",
    "    yield seconds",
    "    return cents"
  ];
  const LOOP = [
    "def run_all(carriers):",
    "    clock, quotes = 0, {}",
    "    waiting = [(0, name, task) for name, task in carriers]",
    "    while waiting:",
    "        waiting.sort(key=lambda w: w[0])",
    "        clock, name, task = waiting.pop(0)",
    "        try:",
    "            wait = next(task)",
    "            waiting.append((clock + wait, name, task))",
    "        except StopIteration as stop:",
    "            quotes[name] = stop.value",
    "    return quotes, clock"
  ];
  // frames: the moments that matter in the trace (the line that just ran, and the variables after it)
  const LFR = (() => {
    const fr = [{ ran: 2, kind: "start", s: TRACE[0] }];
    for (let i = 1; i < TRACE.length; i++) {
      const s = TRACE[i], p = TRACE[i - 1];
      if (s[1] === 1) fr.push({ ran: 11, kind: "end", s });
      else if (s[0] === 6) fr.push({ ran: 5, kind: "pop", s, before: p[2] });
      else if (s[0] === 3 && p[0] === 8) fr.push({ ran: 8, kind: "append", s });
      else if (s[0] === 3 && p[0] === 10) fr.push({ ran: 10, kind: "quote", s });
    }
    return fr;
  })();
  const LGATE = LFR.findIndex(f => f.kind === "pop" && f.s[2] > f.before);   // the first time the clock jumps
  function tinyLoop({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const before = LFR[LGATE - 1].s[4], soon = before.reduce((a, w) => w[0] < a[0] ? w : a), first = LFR[0].s[4][0], last = before[before.length - 1];
    const popts = [
      `${first[1]}, and the clock stays at 0: it was first in the list at the start`,
      `${soon[1]}, and the clock jumps to ${soon[0]}`,
      `${last[1]}, because it was added last`
    ];
    const SAY = {
      start: () => `Every carrier starts in <code>waiting</code> with wake-up time 0: ready to run now. The clock is at 0.`,
      pop: f => `Sort by wake-up time and take the first: <b>${f.s[5]}</b>, which wakes at ${f.s[2]}. ${f.s[2] === f.before ? `The clock stays at ${f.s[2]}.` : `The clock jumps from ${f.before} to ${f.s[2]}: nothing else can happen before then, so the loop skips ahead instead of sleeping.`}`,
      append: f => { const w = f.s[4][f.s[4].length - 1]; return `<code>next(task)</code> runs ${f.s[5]} until its <code>yield</code>: it is now waiting ${f.s[6]} s. It goes back in the list, to wake at ${f.s[2]} + ${f.s[6]} = ${w[0]}.`; },
      quote: f => `<code>next(task)</code> resumes ${f.s[5]} after its <code>yield</code>, and it reaches <code>return</code>. A generator signals its return by raising <code>StopIteration</code>, which carries the value: ${f.s[3][f.s[5]]} goes into <code>quotes</code>.`,
      end: f => `The list is empty. All ${Object.keys(f.s[3]).length} quotes are in at clock = ${f.s[2]}: the longest wait, not the sum ${SUM}. No line ever slept. The loop only kept the list and chose who runs next.`
    };
    const paint = () => {
      const f = LFR[i], gate = i === LGATE - 1 && pred !== 1, last = i === LFR.length - 1;
      const q = f.s[3], qs = Object.keys(q).length ? Object.entries(q).map(([k, v]) => `${k}: ${v}`).join(", ") : "empty";
      el.innerHTML = `<h1>Build the loop yourself</h1>
        <p class="lead">Here is the whole trick in plain Python, with no asyncio. Each carrier is a <b>generator</b>: a function that can pause, like a JavaScript <code>function*</code>. It is <code>${kit.esc(CARRIER_GEN[0])}</code>, and its body is two lines. <code>${kit.esc(CARRIER_GEN[1].trim())}</code> pauses it and says "I am waiting this long, run someone else". <code>next(task)</code> runs it to its next pause; the second time, <code>${kit.esc(CARRIER_GEN[2].trim())}</code> ends it with the price. The loop below keeps a list of paused carriers, each with the time it wakes up. On every pass it sorts the list, soonest wake-up first, and resumes that carrier. The clock is pretend: it jumps ahead instead of sleeping. Step through a real run of this code.</p>
        ${code(kit, LOOP, f.ran)}
        <div class="vars"><span>clock <b>${f.s[2]}</b></span><span>name <b>${f.kind === "start" ? "–" : kit.esc(f.s[5])}</b></span><span>wait <b>${f.kind === "append" ? f.s[6] : "–"}</b></span><span>quotes <b>${kit.esc(qs)}</b></span><span>step <b>${i + 1} / ${LFR.length}</b></span></div>
        <div class="${P}wl">${kit.table(f.s[4].map(([t, n]) => [`${t} s`, n]), { head: ["wakes at", "waiting"], title: "waiting (in list order)", empty: "empty" })}</div>
        ${kit.feedback(SAY[f.kind](f))}
        ${i === LGATE - 1 ? `<div id="pred"><p class="task">All ${before.length} carriers are waiting. Which one does the loop resume next, and what is the clock then?</p>${kit.options(popts.map(kit.esc), { picked: pred, correct: 1 })}
          ${pred == null ? "" : pred === 1 ? kit.feedback(`Right. ${soon[1]} wakes first, at ${soon[0]}. The loop does not care who started first: it resumes whoever is ready soonest. That is why ${FASTEST.name}, the fastest carrier, answers first.`, true)
            : pred === 0 ? kit.feedback(`${first[1]} was first at the start, but the list is sorted by wake-up time on every pass. ${first[1]} wakes at ${before.find(w => w[1] === first[1])[0]}, later than ${soon[1]} at ${soon[0]}.`, false)
            : kit.feedback(`The order of adding does not matter: the sort line orders the list by wake-up time on every pass. ${last[1]} wakes at ${last[0]}, the latest of all.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || gate ? "disabled" : ""}>Next step</button></div>
        ${last ? kit.feedback(`asyncio's event loop does the same bookkeeping for real: a coroutine pauses at <code>await</code> as this generator pauses at <code>yield</code>, and the loop resumes it when what it waits for is ready. Instead of a pretend clock it uses the real one, and it asks the operating system which network answers have arrived.`) : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === LFR.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 5. Predict: two ways a JavaScript developer would write it. */
  const JS_HABIT = [
    "async def cheapest_js_habit(parcel):",
    "    north = ask_northway(parcel)",
    "    kite = ask_kite(parcel)",
    "    harbor = ask_harbor(parcel)",
    "    return min(await north, await kite, await harbor)"
  ];
  const TASKS = [
    "async def cheapest_tasks(parcel):",
    "    north = asyncio.create_task(ask_northway(parcel))",
    "    kite = asyncio.create_task(ask_kite(parcel))",
    "    harbor = asyncio.create_task(ask_harbor(parcel))",
    "    return min(await north, await kite, await harbor)"
  ];
  function jsHabit({ el, done, kit }) {
    css();
    const CASES = [
      { code: JS_HABIT, log: LOG.js, file: "carriers.py" },
      { code: TASKS, log: LOG.tasks, file: "carriers.py" }
    ].map(c => ({ ...c, t: total(c.log), right: total(c.log) > LONGEST + 0.5 ? 1 : 0 }));
    const kiteAt = log => logLines(log).find(l => l.includes(`ask ${CARRIERS[1].name}`)).trim().split(" ")[0];
    const ans = CASES.map(() => null);
    const SAY = [
      [`In JavaScript, calling an async function starts it at once, so this pattern overlaps the calls there. In Python, calling <code>ask_kite(parcel)</code> only builds a <b>coroutine object</b>; it does not run until something awaits it. So Kite is not asked until <code>await kite</code>, after Northway has answered.`, `Right. Calling a coroutine function in Python does not start it. Nothing runs until <code>await north</code>, then nothing more until <code>await kite</code>: one after another again. In our run Kite was asked at ${kiteAt(LOG.js)} s:`],
      [`<code>asyncio.create_task</code> schedules the coroutine to run soon, as a <b>task</b>. All ${N} are scheduled before the first <code>await</code>, and at that await the loop starts them all. Kite was asked at ${kiteAt(LOG.tasks)} s, not after Northway.`, `Right. A task starts on its own as soon as the function reaches its first <code>await</code>, so all ${N} calls are open together. Kite was asked at ${kiteAt(LOG.tasks)} s. gather does this for you: it wraps each coroutine you pass in a task. Keep every task you create in a variable, as here. The loop's own reference to a task does not keep it alive, so a task nothing else points to can be deleted before it finishes.`]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The JavaScript habit</h1>
        <p class="lead">In JavaScript you may write: start every call, keep the promises, await them later. Here are two Python versions of that habit, with the same three carriers (${CARRIERS.map(c => `${c.name} ${c.s}&nbsp;s`).join(", ")}). <code>asyncio.create_task(coro)</code> hands a coroutine to the event loop to run as soon as the current function pauses, and returns a task you can await later. Both ran on our Mac.</p>
        <p class="task">Predict how long the shopper waits with each one.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}">${code(kit, c.code, -1)}${kit.options([`${LONGEST} s`, `${SUM} s`], { picked: ans[i], correct: c.right, num: true })}
          ${ans[i] == null ? "" : kit.feedback(SAY[i][ans[i] === c.right ? 1 : 0], ans[i] === c.right)}
          ${ans[i] === c.right ? runLog(c.log, c.file) : ""}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 6. The library version, stepped through the real log. */
  const ASK = [
    "async def ask(carrier, seconds, cents):",
    "    log(f\"ask {carrier}\")",
    "    await asyncio.sleep(seconds)   # the carrier's server",
    "    log(f\"{carrier} answers {cents}\")",
    "    return cents"
  ];
  const GFR = (() => {
    const fr = [{ fn: "c", ln: 1, line: null }];
    for (const l of logLines(LOG.together)) {
      const t = l.trim();
      fr.push({ line: l, fn: /^cheapest/.test(t) ? "c" : /quotes:/.test(t) ? "c" : "a", ln: /^cheapest/.test(t) ? 7 : /quotes:/.test(t) ? 6 : / answers /.test(t) ? 3 : 1 });
    }
    return fr;
  })();
  const GGATE = GFR.findIndex(f => f.line && /quotes:/.test(f.line));
  function gatherCode({ el, done, kit }) {
    css();
    let i = 0, pred = null;
    const passed = CARRIERS.map(c => c.cents);
    const finished = logLines(LOG.together).filter(l => / answers /.test(l)).map(l => +l.trim().split(" ").pop());
    const sorted = [...passed].sort((a, b) => a - b);
    const fmtList = a => `[${a.join(", ")}]`;
    const popts = [fmtList(finished), fmtList(passed), fmtList(sorted)];
    const name = l => l.trim().split(/\s+/)[2] === "ask" ? l.trim().split(/\s+/)[3] : l.trim().split(/\s+/)[2];
    const say = f => {
      if (!f.line) return `gather receives three coroutines. It wraps each one in a task, so all three are scheduled, then it waits for all of them.`;
      const t = f.line.trim(), at = t.split(" ")[0];
      if (/ ask /.test(` ${t} `) && !/answers/.test(t)) return `${at} s: ${name(f.line)}'s task runs <code>${kit.esc(ASK[1].trim())}</code>, then reaches <code>await asyncio.sleep</code> and steps aside. The loop starts the next task.`;
      if (/answers/.test(t)) return `${at} s: ${name(f.line)}'s wait is over. The loop resumes it after the <code>await</code>: it logs and returns ${t.split(" ").pop()}.`;
      if (/quotes:/.test(t)) return `All three tasks are done, and gather hands back the list.`;
      return `<code>cheapest</code> returns <code>min(quotes)</code> = ${CHEAP.cents} (${money(CHEAP.cents)}, ${CHEAP.name}); our runner printed it with the total time.`;
    };
    const paint = () => {
      const f = GFR[i], gate = i === GGATE - 1 && pred !== 1, last = i === GFR.length - 1;
      const shown = GFR.slice(1, i + 1).map(x => x.line).join("\n");
      el.innerHTML = `<h1>asyncio.gather, step by step</h1>
        <p class="lead">The real version. <code>ask</code> is shared by all three carriers: <code>${CARRIERS[0].fn}(parcel)</code> just calls <code>ask("${CARRIERS[0].name}", ${CARRIERS[0].s}, ${CARRIERS[0].cents})</code>, and the other two do the same with their own numbers. In our run, <code>asyncio.sleep</code> stands in for the request to the carrier's server. <code>asyncio.run(cheapest(parcel))</code> starts the event loop and runs <code>cheapest</code> in it. This replays the run's log, line by line.</p>
        ${code(kit, ASK, f.fn === "a" ? f.ln : -1)}
        ${code(kit, GATHER, f.fn === "c" ? f.ln : -1)}
        <div class="vars"><span>step <b>${i + 1} / ${GFR.length}</b></span></div>
        ${kit.feedback(say(f))}
        <pre class="${P}out">${shown ? kit.esc(shown) : "(no output yet)"}</pre>
        ${i === GGATE - 1 ? `<div id="pred"><p class="task">The answers came in as ${finished.join(", ")}. What list does gather return?</p>${kit.options(popts, { picked: pred, correct: 1 })}
          ${pred == null ? "" : pred === 1 ? kit.feedback(`Right. The results come back in the order you passed the calls in, not the order they finished: ${CARRIERS.map(c => c.name).join(", ")}. So <code>quotes[0]</code> is always Northway's price.`, true)
            : pred === 0 ? kit.feedback(`That is the order the answers arrived in. gather puts each result in the place of the call you passed, so the list does not depend on which server was fastest today.`, false)
            : kit.feedback(`gather does not sort anything. It keeps the order of the calls you passed: Northway, Kite, Harbor.`, false)}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${last || gate ? "disabled" : ""}>Next step</button></div>
        ${last ? kit.feedback(`Total ${total(LOG.together).toFixed(2)} s. If one carrier fails, gather by default raises that error and you lose all the prices; with <code>return_exceptions=True</code> the error takes that carrier's place in the list, and you can still show the other prices.`) : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === GFR.length - 1) done(); };
      el.querySelectorAll("#pred .lopts button").forEach(b => b.onclick = () => { pred = +b.dataset.i; paint(); });
    };
    paint();
  }

  /* 7. When async does not help: a call that blocks. A real run, find the cause and the fix. */
  const ASK_BLOCK = [
    "async def ask(carrier, seconds, cents):",
    "    log(f\"ask {carrier}\")",
    "    time.sleep(seconds)            # the carrier's server",
    "    log(f\"{carrier} answers {cents}\")",
    "    return cents"
  ];
  const BLOCK_LINE = 2;
  function blocking({ el, done, kit }) {
    css();
    let line = null, fix = null;
    const LINE_SAY = {
      0: "<code>async def</code> is correct: it makes <code>ask</code> a coroutine that gather can run as a task. But being a coroutine only means it <i>may</i> pause. It pauses only where it awaits.",
      1: (() => { const ls = logLines(LOG.blocked).map(l => l.trim().split(/\s+/)), k = ls.findIndex((w, j) => j > 0 && w[2] === "ask" && ls[j - 1][3] === "answers"), a = ls[k - 1], b = ls[k];
        return `Logging takes no time: ${a[2]} answers at ${a[0]} s and ${b[3]} is asked at ${b[0]} s. The time goes somewhere else.`; })(),
      3: "This line runs after the wait is over, as in the good version. Look at what happens between the two log lines.",
      4: "<code>return</code> only hands back the price, after the wait. The time is spent before it."
    };
    const FIX = [
      "Call asyncio.gather a second time around the three calls",
      "Run the blocking call in a worker thread: await asyncio.to_thread(time.sleep, seconds), or use an HTTP client that supports await",
      "Put await in front of it: await time.sleep(seconds)"
    ];
    const paint = () => {
      const found = line === BLOCK_LINE, ok = fix === 1;
      el.innerHTML = `<h1>gather, and still ${total(LOG.blocked).toFixed(2)} seconds</h1>
        <p class="lead">A teammate swapped the carrier request for a library call that does not support <code>await</code>. In our copy, <code>time.sleep</code> stands in for it: it holds the thread for the whole wait, as such a call does. <code>cheapest</code> is the gather version, unchanged. The real run:</p>
        ${runLog(LOG.blocked, "blocking.py")}
        <p class="task">Tap the line that makes the three calls run one after another.</p>
        <div class="lcode ${P}pick">${ASK_BLOCK.map((c, j) => `<button type="button" data-l="${j}" style="${ind(c)}" class="${line === j ? (found ? "on" : "no") : ""}">${kit.esc(c)}</button>`).join("")}</div>
        <div class="lpanel">
          ${line == null ? "" : found ? kit.feedback(`Right. <code>time.sleep</code> never hands control back. gather started Northway's task, and that task holds the only thread for ${CARRIERS[0].s} s; the loop cannot start Kite until it finishes. An <code>async def</code> without an <code>await</code> on its slow part is still a blocking function.`, true) : kit.feedback(LINE_SAY[line], false)}
          ${found ? `<div id="fix"><p class="task">Which change makes the shopper wait about ${LONGEST} s again?</p>${kit.options(FIX.map(kit.esc), { picked: fix, correct: 1 })}
            ${fix == null ? "" : ok ? kit.feedback(`Right. <code>asyncio.to_thread</code> runs the blocking call in another thread and gives the loop something to await, so the other tasks run meanwhile. Better still, use a library built for asyncio, so no extra threads are needed. Our run with the fix:`, true)
              : fix === 0 ? kit.feedback(`gather already started all three. The trouble is inside each call: the first one never steps aside, so a second gather would wait in the same way.`, false)
              : kit.feedback(`<code>time.sleep</code> returns <code>None</code>, which cannot be awaited. We tried it: <code>${kit.esc(AWAIT_SLEEP)}</code>. It still blocked for the whole second first, then failed.`, false)}
            ${ok ? runLog(LOG.fixed, "blocking.py") : ""}</div>` : ""}
        </div>`;
      el.querySelectorAll(`.${P}pick button`).forEach(b => b.onclick = () => { if (found) return; line = +b.dataset.l; paint(); });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture, with a task. */
  const BIG_OPTS = ["asyncio helps", "No: it is computing, use processes", "No: each step needs the last answer"];
  const BIG = [
    ["A notes app sends 30 meeting transcripts to a model API to be summarised, each one on its own.", 0,
      "Right. 30 independent waits for a server: gather them. Also limit how many run at once, or the API's rate limit will reject some. An <code>asyncio.Semaphore</code> does that: it lets only a set number of calls in at a time."],
    ["A script scores the similarity of every pair among 5,000 product descriptions, in plain Python loops.", 1,
      `Right. Nothing waits here; the processor is busy the whole time. Our test: three jobs of counting took ${CPU.seq.toFixed(2)} s one after another, ${CPU.gather.toFixed(2)} s with gather (no gain), and ${CPU.procs.toFixed(2)} s in three processes.`],
    ["A checkout holds the money at the bank, then books a courier with the hold's id, then emails a receipt with the courier's tracking number.", 2,
      "Right. Each call needs the previous call's answer, so they cannot overlap. The total is the sum of the waits whatever you write."]
  ];
  const BIG_WRONG = [
    ["", "Summarising happens on the model provider's servers. Your program only sends and waits, 30 times over.", "The 30 transcripts do not depend on each other: each summary needs only its own transcript."],
    [`This is all computing, no waiting. With one thread, the loop runs one job at a time either way: in our test gather took ${CPU.gather.toFixed(2)} s against ${CPU.seq.toFixed(2)} s.`, "", "The pairs do not depend on each other's scores, so they could be split up. The limit is processor work, not order."],
    ["The courier needs the hold's id, and the receipt needs the tracking number. No call can start before the one before it answers, so there is nothing to overlap.", "Each step is a call to someone else's server, so it is waiting, not computing. The problem is the order: each step needs the previous answer.", ""]
  ];
  function bigPicture({ el, done, kit }) {
    css();
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to reach for asyncio</h1>
        <p class="lead"><b>What it is for:</b> many slow waits (network calls, model APIs, databases) on one thread, overlapped so the total is close to the longest wait.</p>
        <p class="lead"><b>Reach for it</b> when you have several independent calls and your libraries support <code>await</code> (or you wrap their blocking calls in <code>to_thread</code>). If one failure should stop the others, use <code>asyncio.TaskGroup</code> (Python 3.11 and later) instead of gather: it cancels the rest.</p>
        <p class="lead"><b>Not when</b> the work is computing (use processes) or each call needs the last one's answer.</p>
        <p class="lead"><b>Cost:</b> <code>await</code> works only inside <code>async def</code>, so async spreads to every function that calls it. You need async versions of your libraries. Firing many calls at once can hit a server's rate limit.</p>
        <p class="task">Pick the right answer for each situation.</p>
        ${BIG.map(([q, r, yes], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(BIG_OPTS, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(ans[i] === r ? yes : BIG_WRONG[i][ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A travel site asks five airlines' servers for fares and shows them side by side.", true,
      "Yes. Five independent waits for other servers: gather them, and the page is ready after the slowest airline instead of after all five in a row.",
      "Each fare request mostly waits for an airline's server, and no request needs another's answer. That is exactly the shape gather overlaps."],
    ["A photo tool resizes 500 images that are already on the disk, using pixel loops written in Python.", false,
      "No. Reading a file is quick next to the resizing, and the resizing is processor work in Python. There is no wait to overlap, so asyncio gains nothing. Spread the images over several processes.",
      "Ask where the time goes: into the pixel loops, which keep the processor busy. One thread can run only one loop at a time, with or without await."],
    ["A research agent searches the web, then opens the top result, then writes an answer from that page.", false,
      "No. Each step needs the previous step's output, so the calls cannot overlap: the total is the sum of the waits. asyncio would help only inside a step that makes several independent calls, such as opening the top three results at once.",
      "The page to open is known only after the search answers, and the answer needs the page. Nothing can start early, so there is nothing to overlap."],
    ["A monitoring script checks 200 company websites every minute and reports which ones are down.", true,
      "Yes. 200 independent requests that mostly wait. Gather them, with a semaphore to cap how many are open at once and a timeout so one dead site cannot hold up the report.",
      "Each check waits for a website and needs nothing from the other checks. One after another, the slow sites add up; overlapped, the minute is easy to keep."]
  ];
  function recognise({ el, done, kit }) {
    css();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Will asyncio make it faster?</h1>
        <p class="lead">Four situations without carriers. Ask: is the time spent waiting, and are the waits independent of each other?</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next (browser practice follows). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Overlap the waits</h1>
      <p class="lead">You can now say what async is (one thread that switches between calls at each <code>await</code>), why it works (the calls are waiting, not working), when to reach for it (several independent waits), when not (computing, chained calls, blocking libraries) and what it costs (async spreads to every function that calls it, and you need async versions of your libraries).</p>
      <p class="lead">The rate checker went from ${total(LOG.one).toFixed(2)} s to ${total(LOG.together).toFixed(2)} s, the time of its slowest carrier. Two traps to remember: in Python a coroutine does not start until it is awaited or made a task, and a blocking call inside <code>async def</code> stops every other task.</p>
      <p class="lead">A short exercise in Python on this page follows the lesson: you write the rate checker with <code>asyncio.gather</code> for three pretend carriers and make it answer in about the time of the slowest one.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. The functions you write from here on, async ones included, need tests that prove they work; that lesson shows how to write them.</p>` : ""}`;
    done();
  }

  const cellSel = (r, c) => `[data-i="${r},${c}"]`;
  LessonKit.define("s1-py-async", {
    title: "async and await in Python",
    checked: "2026-11-13",
    sources: [
      "https://docs.python.org/3/library/asyncio-task.html",
      "https://docs.python.org/3/library/asyncio-dev.html",
      "https://docs.python.org/3/library/asyncio-eventloop.html",
      "https://docs.python.org/3/library/asyncio-sync.html",
      "https://docs.python.org/3/reference/expressions.html#await",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all",
      "https://www.python-httpx.org/async/"
    ],
    interview: [{
      q: "Your service summarises 50 documents by calling a model API one at a time, and it takes minutes. A teammate wrapped each call in async def and used asyncio.gather, but it is just as slow. What do you check?",
      good: [
        "Whether the client really awaits: a synchronous HTTP client inside async def blocks the loop, so the calls still run one after another",
        "Log a timestamp when each call starts: if the starts are spread out instead of all near zero, something blocks",
        "Switch to the library's async client, or move the blocking call into a thread with asyncio.to_thread",
        "Look for CPU-heavy work between the calls, which async cannot overlap",
        "Then cap concurrency with a semaphore so 50 parallel calls do not hit the API's rate limit, and wrap each call in asyncio.timeout (Python 3.11 and later) so one hung call cannot stall the batch"
      ],
      weak: "Add more threads or a bigger machine. That misses that one blocking call inside async def stops every other task, so async was never overlapping anything."
    }, {
      q: "A teammate wants to make the whole codebase async because 'async is faster'. Where do you agree and where not?",
      good: [
        "Async only overlaps waiting: it helps code that makes many independent network or database calls",
        "It does not speed up computing; CPU-heavy work needs processes",
        "Calls that need each other's answers stay sequential however they are written",
        "It has a cost: await works only inside async def, so it spreads through callers, and every library on the path needs async support"
      ],
      weak: "Agreeing that async makes code faster in general, or rejecting it outright, without asking where the time actually goes."
    }],
    screens: [oneByOne, together, spotIdea, tinyLoop, jsHabit, gatherCode, blocking, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [cellSel(0, 1)], right: [...startsSeq.map((s, r) => cellSel(r, s)), "#t [data-right]"] },
      { wrong: [cellSel(1, 1)], right: [...CARRIERS.map((_, r) => cellSel(r, 0)), "#t [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(LGATE - 1).fill("[data-next]"), "#pred [data-wrong]"], right: ["#pred [data-right]", ...Array(LFR.length - LGATE).fill("[data-next]")] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: [...Array(GGATE - 1).fill("[data-next]"), "#pred [data-wrong]"], right: ["#pred [data-right]", ...Array(GFR.length - GGATE).fill("[data-next]")] },
      { wrong: ['[data-l="0"]'], right: [`[data-l="${BLOCK_LINE}"]`, "#fix [data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
