/* Lesson: intervals. A kayak hut on a lake: the lifeguard's duty stretches (sort by start, then merge), then how
   many kayaks the hut must own (turn each rental into two events and sweep them with a running count).
   Every number on screen is computed here from LOG. Plain browser script. */
(() => {
  const E = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // today's logbook, in the order people booked: [name, goes out, comes back] in hours of the day
  const LOG = [["Mira", 14, 16], ["Tom", 9, 11], ["Lev", 17, 18], ["Kai", 12, 14], ["Ines", 10, 13], ["Oda", 11, 12]];
  const N = LOG.length, PAIRS = N * (N - 1) / 2;
  const DAY0 = Math.min(...LOG.map(r => r[1])), DAY1 = Math.max(...LOG.map(r => r[2]));
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const T = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  const and = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  // touching counts: the lifeguard never leaves when one kayak comes back as another goes out
  const meets = (a, b) => a[1] <= b[2] && b[1] <= a[2];
  const ORDER = LOG.map((_, i) => i).sort((a, b) => LOG[a][1] - LOG[b][1]);
  const SR = ORDER.map(i => LOG[i]);                // the logbook sorted by start
  const NAME = SR.map(r => E(r[0]));
  const ROWS = SR.map(([n, s, e]) => [s, e, n]);   // picture rows, sorted
  const AX = { min: DAY0, max: DAY1, step: 1 };

  // the merge, rental by rental over the sorted logbook
  const MERGE = (() => {
    const out = [], steps = [];
    SR.forEach(([, s, e], k) => {
      const last = out[out.length - 1];
      if (!last) { out.push([s, e]); return; }
      const before = out.map(x => x.slice()), ce = last[1];
      const kind = s > ce ? "new" : s === ce ? "touch" : e > ce ? "grow" : "inside";
      if (kind === "new") out.push([s, e]); else last[1] = Math.max(ce, e);
      steps.push({ k, before, kind, after: out.map(x => x.slice()) });
    });
    return { out, steps };
  })();
  const STRETCHES = MERGE.out;
  const stretchTxt = st => `${T(st[0])}–${T(st[1])}`;
  const stretchOf = k => STRETCHES.findIndex(([a, b]) => SR[k][1] >= a && SR[k][2] <= b);

  /* 1. The slow way: compare every rental with every other one. */
  // a pair in the same stretch that never touches, and the chain of rentals that links it (sorted indices)
  const CHAIN = (() => {
    for (let a = 0; a < N; a++) for (let b = N - 1; b > a; b--) {
      if (stretchOf(a) !== stretchOf(b) || meets(SR[a], SR[b])) continue;
      const prev = { [a]: -1 }, q = [a];
      while (q.length) { const x = q.shift(); for (let y = 0; y < N; y++) if (!(y in prev) && y !== x && meets(SR[x], SR[y])) { prev[y] = x; q.push(y); } }
      const path = []; for (let x = b; x !== -1; x = prev[x]) path.unshift(x);
      return { a, b, path };
    }
    return null;
  })();
  function slowWay({ el, done, kit }) {
    const checked = new Set(), tapped = new Set();
    let cur = null, fresh = 0, again = false;
    const key = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;
    const touching = [];
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) if (meets(SR[a], SR[b])) touching.push([a, b]);
    const paint = () => {
      const fin = checked.size === PAIRS, cls = {};
      const partners = cur == null ? [] : LOG.map((_, j) => j).filter(j => j !== cur && meets(LOG[cur], LOG[j]));
      if (cur != null) { cls[cur] = "accent"; partners.forEach(j => { cls[j] = "enter"; }); }
      const nm = i => E(LOG[i][0]);
      el.innerHTML = `<h1>When must the lifeguard be on the dock?</h1>
        <p class="lead">You run a kayak hut on a lake. Each row is one rental from today's logbook, in the order people booked, with the hours the kayak is out. A lifeguard must be on the dock whenever at least one kayak is out. If one kayak comes back the moment another goes out, she never leaves, so <b>touching counts as overlapping</b>. Comparing two rentals counts as one check.</p>
        <p class="task">You want the stretches of the day she works (each unbroken period on the dock). Tap a rental to compare it with every other one. Keep going until every pair has been compared.</p>
        ${kit.pics.intervals(LOG.map(([n, s, e]) => [s, e, n]), { cls, pick: !fin, ...AX })}
        <div class="lpanel">
          ${checked.size ? `<div class="sum">${checked.size} of ${PAIRS}<small>pairs checked</small></div>` : ""}
          ${fin ? `<div class="tried">${touching.map(([a, b]) => `<span>${NAME[a]} + ${NAME[b]}</span>`).join("")}</div>
            ${kit.feedback(`All ${PAIRS} pairs checked, and ${plural(touching.length, "pair")} touch or overlap. You are still not done: ${NAME[CHAIN.a]} and ${NAME[CHAIN.b]} never touch, yet she cannot leave between them, because ${and(CHAIN.path.slice(1).map((k, j) => `${NAME[CHAIN.path[j]]} touches ${NAME[k]}`))}. To get her stretches you still have to chain the pairs together. A logbook of 1,000 rentals has ${fmt(1000 * 999 / 2)} pairs.`, true)}`
          : cur == null ? ""
          : kit.feedback(again ? `You already compared ${nm(cur)} with every other rental. Pick one you have not tapped yet.`
            : `${nm(cur)} (${T(LOG[cur][1])}–${T(LOG[cur][2])}) ${partners.length ? `touches or overlaps ${and(partners.map(nm))} (filled)` : "touches nobody"}. That tap took ${plural(fresh, "new check")}. ${plural(PAIRS - checked.size, "pair")} left.`)}
        </div>`;
      el.querySelectorAll("button.lp-ivb").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        cur = i; again = tapped.has(i); fresh = 0; tapped.add(i);
        for (let j = 0; j < N; j++) if (j !== i && !checked.has(key(i, j))) { checked.add(key(i, j)); fresh++; }
        paint();
        if (checked.size === PAIRS) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: in start order, one comparison decides. */
  const Q2 = 2;                                        // ask about the third rental in start order
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const st = MERGE.steps[Q2 - 1], cur = st.before[st.before.length - 1], [, s] = SR[Q2], who = NAME[Q2];
    // two later rentals that both come back after the stretch ends: one joins it, one cannot
    const joiner = SR.findIndex(([, a, b], k) => k > Q2 && a <= cur[1] && b > cur[1]);
    const loner = SR.findIndex((_, k) => k > Q2 && MERGE.steps[k - 1].kind === "new");
    const opts = [`${who} with every rental above in the list`, `When ${who} goes out, against when the stretch ends`, `When ${who} comes back, against when the stretch ends`];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct, cls = {};
      for (let k = 0; k < Q2; k++) cls[k] = "in";
      cls[Q2] = ok ? "in" : "next";
      cls[N] = "enter";
      el.innerHTML = `<h1>Rewrite the logbook in start order</h1>
        <p class="lead">Chaining is easy if you go in the order the kayaks go out: then each new rental only needs to touch the stretch you have built so far. Here are the same rentals, sorted by when each kayak goes out. ${and(NAME.slice(0, Q2))} together already cover <b>${stretchTxt(cur)}</b>: the bottom bar, Duty so far. The filled rows above it are done, and the outlined row, ${who}, is next.</p>
        <p class="task">To know whether ${who} joins this stretch, what is the one thing you compare?</p>
        ${kit.pics.intervals([...ROWS, [cur[0], cur[1], "Duty so far"]], { cls, ...AX })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The list is sorted, so ${who} cannot go out before the stretch starts. The only question is whether ${who} goes out before it ends. ${who} goes out at ${T(s)}, before the stretch ends at ${T(cur[1])}, so ${who} joins. One check per rental, and the rentals above never need looking at again: the stretch already sums them up.`, true)
          : ans === 0 ? kit.feedback(`The stretch already sums up ${and(NAME.slice(0, Q2))}: it runs ${stretchTxt(cur)}. Comparing ${who} with each of them again repeats work the stretch has done.`, false)
          : kit.feedback(`Coming back late says nothing about a gap before going out. ${NAME[joiner]} and ${NAME[loner]} both come back after ${T(cur[1])}. ${NAME[joiner]} goes out at ${T(SR[joiner][1])}, while she is still on duty, but ${NAME[loner]} goes out at ${T(SR[loner][1])}, after a gap. What decides it is when the kayak goes out.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Merge it yourself, predicting each step; then feel the saving at real sizes. */
  function mergeIt({ el, done, kit }) {
    let k = 1, wrong = null, said = null, n = 1000;
    const paint = () => {
      const fin = k === N, st = fin ? null : MERGE.steps[k - 1];
      const shown = fin ? STRETCHES : st.before;
      const cls = {};
      for (let j = 0; j < N; j++) cls[j] = j < k ? "in" : "";
      if (!fin) cls[k] = "next";
      shown.forEach((_, j) => { cls[N + j] = "enter"; });
      let opts = [], correct = -1, task = "";
      if (!fin) {
        const [, s, e] = SR[k], [cs, ce] = st.before[st.before.length - 1];
        const join = `Joins: the stretch becomes ${T(cs)}–${T(Math.max(ce, e))}`;
        const alt = e < ce ? `Joins: the stretch becomes ${T(cs)}–${T(e)}` : e > ce ? `Joins: the stretch stays ${T(cs)}–${T(ce)}` : null;
        opts = [join, alt, `A new stretch: ${T(s)}–${T(e)}`].filter(Boolean);
        correct = st.kind === "new" ? opts.length - 1 : 0;
        task = `${NAME[k]} is out ${T(s)}–${T(e)}. The open stretch is ${T(cs)}–${T(ce)}. What happens?`;
      }
      el.innerHTML = `<h1>Build the stretches yourself</h1>
        <p class="lead">Go down the sorted logbook. Each rental either joins the open stretch or, after a gap, starts a new one.</p>
        ${fin ? "" : `<p class="task">${task}</p>`}
        ${kit.pics.intervals([...ROWS, ...shown.map(([a, b], j) => [a, b, `Stretch ${j + 1}`])], { cls, ...AX })}
        <div class="lpanel">${fin ? "" : kit.options(opts, { picked: wrong, correct })}
        ${wrong != null ? kit.feedback((() => {
            const [, s, e] = SR[k], [, ce] = st.before[st.before.length - 1], who = NAME[k];
            if (st.kind === "new") return `${who} goes out at ${T(s)}, but the stretch ended at ${T(ce)}. The lifeguard is off for ${plural(s - ce, "hour")} in between, so ${who} starts a new stretch.`;
            if (wrong === opts.length - 1) return s === ce ? `${who} goes out at ${T(s)}, the very moment the stretch ends. The lifeguard never gets to leave the dock, so touching joins the stretch.` : `${who} goes out at ${T(s)}, while the stretch still runs until ${T(ce)}. The lifeguard is already on the dock, so ${who} joins.`;
            return e < ce ? `${who} is back at ${T(e)}, but someone is still out until ${T(ce)}. A stretch never gets shorter: it keeps the later end.` : `${who} is out until ${T(e)}, past ${T(ce)}. The stretch has to grow to cover that.`;
          })(), false)
          : fin ? kit.feedback(`Done. The lifeguard works ${and(STRETCHES.map(stretchTxt))}, the same as all that pairing and chaining. After sorting it took ${plural(N - 1, "check")}, one per rental after the first, and nothing to chain. Sorting is not free: sorting n rentals takes about n × log₂ n comparisons (log₂ n is how many times you can halve n: about ${Math.round(Math.log2(1000))} for ${fmt(1000)}). Now make the logbook bigger:`, true)
          : said ? kit.feedback(said) : ""}
        ${fin ? `<div class="sliders"><label>Rentals in the logbook <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        const [, s, e] = SR[k], [cs, ce] = st.before[st.before.length - 1], who = NAME[k];
        said = st.kind === "inside" ? `${who} joins and is back before ${T(ce)}, so the stretch stays ${T(cs)}–${T(ce)}.`
          : st.kind === "grow" ? `${who} joins and stays out longer, so the stretch grows to ${T(cs)}–${T(e)}.`
          : st.kind === "touch" ? `${who} goes out the moment the stretch ends, so it carries on to ${T(e)}.`
          : `A gap from ${T(ce)} to ${T(s)}. Stretch ${st.before.length} is closed at ${T(cs)}–${T(ce)}, and a new one starts.`;
        k++; paint();
        if (k === N) done();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const a = n * (n - 1) / 2, b = Math.round(n * Math.log2(n)) + n - 1, r = a / b;
        el.querySelector("#big").innerHTML = `${fmt(a)} vs ${fmt(b)}<small>checks when comparing every pair, against sorting (about n × log₂ n comparisons) and one check per rental. ${r >= 1.5 ? `That is about ${fmt(Math.round(r))} times fewer checks, and no chaining on top.` : "With so few rentals, sorting costs about as much as it saves. It pays off as the logbook grows."}</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same moves as code, stepped against the same rentals. */
  const CODE1 = [
    "rentals.sort((a, b) => a[0] - b[0]);",
    "const out = [];",
    "for (const [s, e] of rentals) {",
    "  const last = out[out.length - 1];",
    "  if (last && s <= last[1]) {",
    "    last[1] = Math.max(last[1], e);",
    "  } else {",
    "    out.push([s, e]);",
    "  }",
    "}"
  ];
  const pair = p => `[${p[0]}, ${p[1]}]`;
  const FR1 = (() => {
    const out = [], snap = () => out.map(x => x.slice());
    const fr = [{ ln: 0, k: -1, out: [], s: "–", e: "–", last: "–", say: "Sort the rentals by start time: the order you walked by hand. <code>out</code> (the output) will hold the stretches." }];
    SR.forEach(([, s, e], k) => {
      const last = out[out.length - 1], ok = !!last && s <= last[1];
      fr.push({ ln: 4, k, out: snap(), s, e, last: last ? pair(last) : "–", say: !last
        ? `${NAME[k]}: s = ${s}, e = ${e}. <code>out</code> is empty, so <code>last</code> is undefined and the test is false.`
        : `${NAME[k]}: s = ${s}, e = ${e}. Is ${s} <= ${last[1]}? ${ok ? `Yes: ${NAME[k]} goes out before the open stretch ends${s === last[1] ? " (touching counts, hence <code><=</code>)" : ""}.` : `No: there is a gap after ${last[1]}.`}` });
      if (ok) {
        const was = last[1];
        last[1] = Math.max(was, e);
        fr.push({ ln: 5, k, out: snap(), s, e, last: pair(last), say: was === last[1] ? `Math.max(${was}, ${e}) is ${was}: the stretch keeps its end. Without the max it would wrongly shrink to ${e}.` : `Math.max(${was}, ${e}) is ${last[1]}: the stretch grows.` });
      } else {
        out.push([s, e]);
        fr.push({ ln: 7, k, out: snap(), s, e, last: last ? pair(last) : "–", say: `Push ${pair([s, e])}: a new stretch.` });
      }
    });
    fr.push({ ln: 9, k: N, out: snap(), s: "–", e: "–", last: "–", say: `The loop ends. <code>out</code> is ${out.map(pair).join(", ")}: the lifeguard's stretches you found by hand, in one pass after the sort.` });
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cls = {};
      for (let j = 0; j < N; j++) cls[j] = j < f.k ? "in" : j === f.k ? "accent" : "";
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">Nothing new here. <code>rentals</code> is the logbook as <code>[start, end]</code> pairs (when the kayak goes out, when it comes back). A range with a start and an end, like a rental, is called an <b>interval</b>. Merging intervals like this is called <b>sort and merge</b>.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the pictures.</p>
        ${kit.pics.intervals(SR.map(([n, s, e]) => [s, e, n[0]]), { packed: true, cls, ...AX, title: "rentals, sorted by start" })}
        ${kit.pics.intervals(f.out.map(([a, b]) => [a, b, `${a}–${b}`]), { packed: true, cls: Object.fromEntries(f.out.map((_, j) => [j, "enter"])), ...AX, title: f.out.length ? "out" : "out (empty)" })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>s <b>${f.s}</b></span><span>e <b>${f.e}</b></span><span>last <b>${f.last}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 5. A second question, the slow way: stop the clock and look at every rental. */
  const MOM = [10.5, 12.5];
  const outAt = t => SR.map((_, k) => k).filter(k => SR[k][1] < t && t < SR[k][2]);
  const SLOTS = (DAY1 - DAY0) * 2 + 1, SLOW2 = SLOTS * N;
  function slowCount({ el, done, kit }) {
    let m = 0, got = new Set(), msg = null;
    const counts = [];
    const paint = () => {
      const fin = counts.length === MOM.length, t = MOM[fin ? MOM.length - 1 : m], cls = {};
      got.forEach(k => { cls[k] = "enter"; });
      el.innerHTML = `<h1>How many kayaks does the hut need?</h1>
        <p class="lead">A second question. The hut must own enough kayaks that nobody ever waits: the most kayaks out at the same moment. The slow way: stop the clock at one moment and look at every rental. Looking at one rental counts as one check.</p>
        ${fin ? "" : `<p class="task">The line is the clock at ${T(t)}. Tap every rental that is out on the water then.</p>`}
        ${kit.pics.intervals(ROWS, { cls, pick: !fin, sweep: t, sweepLabel: T(t), ...AX })}
        <div class="lpanel">
          ${counts.length ? `<div class="tried">${counts.map(([tt, c]) => `<span>${T(tt)} <b>${c} out</b></span>`).join("")}</div>` : ""}
          ${fin ? kit.feedback(`Each moment took ${N} checks, one per rental. To find the busiest moment this way you stop the clock every half hour from ${T(DAY0)} to ${T(DAY1)}: ${SLOTS} moments, ${N} checks each, <b>${SLOW2} checks</b>. And a rental from 10:10 to 10:20 falls between two half hours, so it is never counted at all.`, true)
            : msg ? kit.feedback(msg[0], msg[1]) : ""}
        </div>`;
      el.querySelectorAll("button.lp-ivb").forEach(b => b.onclick = () => {
        const k = +b.dataset.i, [, s, e] = SR[k], need = outAt(t);
        if (!need.includes(k)) { msg = [`${NAME[k]} is out ${T(s)}–${T(e)}, so at ${T(t)} that kayak is ${s > t ? "not on the water yet" : "already back on the dock"}.`, false]; paint(); return; }
        if (got.has(k)) { msg = [`${NAME[k]} is already counted.`]; paint(); return; }
        got.add(k);
        msg = [`${NAME[k]} is out at ${T(t)}.`];
        if (got.size === need.length) {
          counts.push([t, need.length]);
          msg = [`${plural(need.length, "kayak")} out at ${T(t)}. To be sure, you looked at all ${N} rentals.${m < MOM.length - 1 ? ` Now the clock moves to ${T(MOM[m + 1])}.` : ""}`];
          if (m < MOM.length - 1) { m++; got = new Set(); }
        }
        paint();
        if (counts.length === MOM.length) done();
      });
    };
    paint();
  }

  /* 6. Spot the trick: the count only moves when a kayak goes out or comes back. */
  const cntAt = t => SR.filter(([, s, e]) => s <= t && t < e).length;   // just after everything at time t
  const EV = SR.flatMap(([, s, e], k) => [{ t: s, d: 1, k }, { t: e, d: -1, k }]).sort((a, b) => a.t - b.t || a.d - b.d);
  function spotTrick2({ el, done, kit }) {
    let ans = null;
    const times = new Set(EV.map(v => v.t));
    let calm = DAY0 + 0.5; while (times.has(calm)) calm += 1;
    const inner = EV.find(v => v.d > 0 && STRETCHES.some(([a, b]) => a < v.t && v.t < b));
    const opts = ["On every half hour", "Only when a kayak goes out or comes back", "Only when a lifeguard stretch starts or ends"];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>When can the count change?</h1>
        <p class="lead">Picture sliding the clock from ${T(DAY0)} to ${T(DAY1)} and watching how many kayaks are out. For long spells the number stays the same.</p>
        <p class="task">At which moments can the number of kayaks out change?</p>
        ${kit.pics.intervals(ROWS, { ...AX })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Between those moments nothing happens, so the count cannot change. Each rental gives two moments: one up when it goes out, one down when it comes back. ${N} rentals make ${2 * N} moments. Sort them by time and walk them once, keeping a running count.`, true)
          : ans === 0 ? kit.feedback(`At ${T(calm)} nobody goes out or comes back, so the count is the same as half an hour before: ${cntAt(calm)}. The clock ticking on does not change the count. Only a kayak leaving or arriving does, and that can happen between two half hours.`, false)
          : kit.feedback(`${NAME[inner.k]} goes out at ${T(inner.t)}, in the middle of a stretch, and the count goes from ${cntAt(inner.t) - 1} to ${cntAt(inner.t)}. The count changes inside a stretch too.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. Sweep it yourself: predict the count at each event; settle one tie on the way. */
  const TIE = EV.findIndex((v, j) => v.d < 0 && EV.some((w, x) => x > j && w.t === v.t && w.d > 0));
  const TIE_GO = EV.findIndex(w => w.t === EV[TIE].t && w.d > 0);
  // every kind of bar the sweep screen can show, in one fixed order; the key lists the ones on screen now
  const SWEEP_KEY = [["", "not gone out yet"], ["in", "out now"], ["gone", "back on the dock"], ["enter", "going out now, at the sweep line"], ["leave", "coming back now, at the sweep line"], ["next", "both at the sweep line"]];
  function sweepIt({ el, done, kit }) {
    let i = 0, c = 0, most = 0, tieOk = false, wrong = null, said = null;
    const paint = () => {
      const fin = i === EV.length, tie = !fin && i === TIE && !tieOk, ev = fin ? EV[EV.length - 1] : EV[i];
      const cls = {};
      for (let k = 0; k < N; k++) {
        const out = EV.slice(0, i).some(v => v.k === k && v.d > 0), back = EV.slice(0, i).some(v => v.k === k && v.d < 0);
        cls[k] = back ? "gone" : out ? "in" : "";
      }
      let opts = [], correct = -1, task = "";
      if (tie) {
        const b = NAME[EV[TIE].k], g = NAME[EV[TIE_GO].k];
        opts = [`${b} comes back first`, `${g} goes out first`]; correct = 0;
        cls[EV[TIE].k] = cls[EV[TIE_GO].k] = "next";
        task = `Two things happen at ${T(ev.t)}: ${b} comes back and ${g} goes out. Which do you count first?`;
      } else if (!fin) {
        cls[ev.k] = ev.d > 0 ? "enter" : "leave";
        opts = [c + ev.d, c - ev.d, c].filter((v, j, a) => v >= 0 && a.indexOf(v) === j).sort((a, b) => a - b);
        correct = opts.indexOf(c + ev.d);
        task = `${NAME[ev.k]} ${ev.d > 0 ? "goes out" : "comes back"} at ${T(ev.t)}. How many kayaks are out now?`;
      }
      const tieMsg = () => {
        const b = NAME[EV[TIE].k], g = NAME[EV[TIE_GO].k], outNow = SR.map((_, k) => k).filter(k => cls[k] === "in" || k === EV[TIE].k);
        return `If ${g} goes out first, ${outNow.length + 1} kayaks are out at ${T(ev.t)}: ${and([...outNow.map(k => NAME[k]), g])}. But ${b}'s kayak is back on the dock at that same moment, so ${g} can take it. Count the return first, or the hut buys a kayak it needs for no time at all. Unlike the lifeguard, who never gets to leave, a kayak can be handed straight over, so here touching does not count as overlapping.`;
      };
      el.innerHTML = `<h1>Sweep the day once</h1>
        <p class="lead">The moments when a kayak goes out or comes back are called <b>events</b>. Walk them in time order with a running count, and keep the highest count you see. This is called a <b>sweep line</b>. The key under the picture says what each kind of bar means, including the kayak at the sweep line.</p>
        ${fin ? "" : `<p class="task">${task}</p>`}
        ${kit.pics.intervals(ROWS, { cls, ...AX, ...(fin ? {} : { sweep: ev.t, sweepLabel: T(ev.t) }) })}
        ${kit.pics.key(SWEEP_KEY.filter(([st]) => Object.values(cls).includes(st)))}
        <div class="vars"><span>out now <b>${c}</b></span><span>most so far <b>${most}</b></span><span>event <b>${Math.min(i + 1, EV.length)} / ${EV.length}</b></span></div>
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong, correct, num: !tie })}
        ${wrong != null ? kit.feedback(tie ? tieMsg() : (() => {
            const v = opts[wrong], who = NAME[ev.k];
            if (v === c) return `Something did happen at ${T(ev.t)}: ${who} ${ev.d > 0 ? "goes out" : "comes back"}. The count moves by one.`;
            return ev.d > 0 ? `${who} takes a kayak out, so one more is on the water, not one fewer.` : `${who} brings a kayak back, so one fewer is on the water, not one more.`;
          })(), false)
          : fin ? kit.feedback(`The sweep is done. Most kayaks out at once: <b>${most}</b>, so the hut needs ${plural(most, "kayak")}. That took ${EV.length} steps, one per event, after sorting the events, against ${SLOW2} checks counting every rental at every half hour. That is about ${fmt(Math.round(SLOW2 / EV.length))} times fewer checks, and a short rental can no longer slip between two half hours.`, true)
          : said ? kit.feedback(said) : ""}
        ${fin ? kit.meter([{ label: "Every rental, every half hour", value: SLOW2, max: SLOW2 }, { label: "Sweep the events", value: EV.length, max: SLOW2, good: true }]) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        if (tie) { tieOk = true; said = `Right. ${NAME[EV[TIE].k]}'s kayak comes back and ${NAME[EV[TIE_GO].k]} takes it out. When two events share a time, the return goes first. Unlike the lifeguard, who never gets to leave, a kayak can be handed straight over, so here touching does not count as overlapping.`; paint(); return; }
        const was = most;
        c += ev.d; most = Math.max(most, c); i++;
        said = `${NAME[ev.k]} ${ev.d > 0 ? "went out" : "came back"}: ${c} out.${most > was ? ` A new most: ${most}.` : ""}`;
        paint();
        if (i === EV.length) done();
      });
    };
    paint();
  }

  /* 8. The sweep as code. */
  const CODE2 = [
    "const events = [];",
    "for (const [s, e] of rentals)",
    "  events.push([s, +1], [e, -1]);",
    "events.sort((a, b) =>",
    "  a[0] - b[0] || a[1] - b[1]);",
    "let out = 0, most = 0;",
    "for (const [t, d] of events) {",
    "  out += d;",
    "  most = Math.max(most, out);",
    "}"
  ];
  const BUILT = LOG.flatMap(r => { const k = SR.indexOf(r); return [{ t: r[1], d: 1, k }, { t: r[2], d: -1, k }]; });
  const sign = d => d > 0 ? "+1" : "−1";
  const FR2 = (() => {
    const fr = [{ ln: 2, list: BUILT, j: -1, i: 0, out: "–", most: "–", say: "Each rental adds two events: <code>[s, +1]</code> when it goes out and <code>[e, -1]</code> when it comes back. They are still in logbook order, not time order." },
      { ln: 4, list: EV, j: -1, i: 0, out: "–", most: "–", say: `Sort by time. When two events share a time, <code>a[1] - b[1]</code> puts −1 before +1: the return comes first, as you did at ${T(EV[TIE].t)}.` },
      { ln: 5, list: EV, j: -1, i: 0, out: 0, most: 0, say: "Nothing is out yet. In the loop, <code>t</code> is the time and <code>d</code> the change in the count (+1 or −1)." }];
    let out = 0, most = 0;
    EV.forEach((v, j) => {
      out += v.d;
      fr.push({ ln: 7, list: EV, j, i: j + 1, out, most, say: `t = ${v.t}, d = ${sign(v.d)}: ${NAME[v.k]} ${v.d > 0 ? "goes out" : "comes back"}. out is now ${out}.` });
      if (out > most) { fr.push({ ln: 8, list: EV, j, i: j + 1, out, most: out, say: `${out} beats ${most}, so most is now ${out}.` }); most = out; }
    });
    fr.push({ ln: 9, list: EV, j: EV.length, i: EV.length, out, most, say: `The loop ends with most = ${most}: the ${plural(most, "kayak")} you found in the sweep.` });
    return fr;
  })();
  function sweepCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR2[i], cls = {}, rcls = {};
      f.list.forEach((_, j) => { cls[j] = f.j < 0 ? "" : j < f.j ? "in" : j === f.j ? "next" : ""; });
      const seen = f.j < 0 ? [] : EV.slice(0, f.j + 1);
      for (let k = 0; k < N; k++) {
        const out = seen.some(v => v.k === k && v.d > 0), back = seen.some(v => v.k === k && v.d < 0);
        rcls[k] = back ? "gone" : out ? "in" : "";
      }
      const cur = f.j >= 0 && f.j < EV.length ? EV[f.j] : null;
      if (cur) rcls[cur.k] = cur.d > 0 ? "enter" : "leave";
      el.innerHTML = `<h1>The sweep, written as code</h1>
        <p class="lead"><code>rentals</code> is the logbook in booking order. Under each event: its time, and the first letter of whose kayak it is.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the events.</p>
        ${kit.pics.intervals(SR.map(([n, s, e]) => [s, e, n[0]]), { packed: true, cls: rcls, ...AX, ...(cur ? { sweep: cur.t, sweepLabel: T(cur.t) } : {}) })}
        ${kit.cells(f.list.map(v => sign(v.d)), { cls, labels: f.list.map(v => v.t), ptrs: Object.fromEntries(f.list.map((v, j) => [j, SR[v.k][0][0]])) })}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>out <b>${f.out}</b></span><span>most <b>${f.most}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 9. Recognise it in new situations, including one where it does not apply. */
  // the lecture parts, in the order watched; the first overlapping pair gives the seconds counted twice
  const PARTS = [[30, 95], [80, 140], [300, 320]];
  const TWICE = (() => {
    for (let a = 0; a < PARTS.length; a++) for (let b = a + 1; b < PARTS.length; b++) {
      const lo = Math.max(PARTS[a][0], PARTS[b][0]), hi = Math.min(PARTS[a][1], PARTS[b][1]);
      if (lo < hi) return [lo, hi];
    }
    return null;
  })();
  const CASES = [
    [`A video player logs the parts of a lecture a student watched, in seconds, like ${and(PARTS.map(([a, b]) => `${a}–${b}`))}, in the order he watched them. How many seconds of the lecture has he seen at least once?`, true,
      `Yes, sort and merge. Sort the parts by start, merge the ones that overlap, then add up the merged lengths. Adding the raw parts would count seconds ${TWICE[0]} to ${TWICE[1]} twice.`,
      `Parts he watched twice overlap, like ${TWICE[0]}–${TWICE[1]} above, so adding the raw lengths counts those seconds twice. Sort by start, merge, then add up the merged parts: the lifeguard's stretches again.`],
    ["A car park writes down when each car came in and when it left. The owner wants the most cars that were inside at the same time.", true,
      "Yes, a sweep. Each car is +1 when it comes in and −1 when it leaves. Sort the events by time, keep a running count and the highest value it reaches.",
      "Each car is a range of time, and the question is how many ranges are open at once. That is the kayak sweep: +1 in, −1 out, sorted by time, keep the highest count."],
    ["A marathon logs each runner's start time and finish time. Find the runner with the fastest time.", false,
      "No. They are ranges, but each runner's time is finish minus start, and no runner's range affects another. One walk keeping the smallest difference is enough. Sorting, merging and sweeping are about how ranges relate to each other, and here they do not.",
      "They are ranges, but the answer for each runner depends only on that runner: finish minus start. Whether two runners were on the course at the same time does not matter. One walk keeping the smallest time is enough, and sorting would only add work."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is this a job for merging or sweeping ranges?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations away from the lake.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. On to the problems: the groups this lesson taught first. */
  const TAUGHT = {
    "sort-and-merge": "You did this with the lifeguard: sort by start, then each rental joins the open stretch or starts a new one.",
    "count-overlaps": "You did this with the kayaks: +1 out, −1 back, sweep in time order and keep the highest count."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  const OUT0 = outAt(MOM[0]), OUT1 = outAt(MOM[1]);
  LessonKit.define("intervals", {
    title: "Intervals",
    teaches: ["sort-and-merge", "count-overlaps"],
    screens: [slowWay, spotTrick, mergeIt, asCode, slowCount, spotTrick2, sweepIt, sweepCode, recognise, toProblems],
    walk: [
      { right: Array.from({ length: N - 1 }, (_, i) => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(N - 1).fill("[data-right]") },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: [`[data-i="${SR.findIndex((_, k) => !OUT0.includes(k))}"]`], right: [...OUT0, ...OUT1].map(k => `[data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(EV.length + 1).fill("[data-right]") },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
