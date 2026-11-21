/* Lesson: binary search. A river cycling trip: a diary of distance totals (halve the pages to find the first
   evening past a goal), then next summer's stages and a daily limit (halve the possible limits, testing each
   one with a ride-or-camp pass). Every number on screen is computed here from RIDES, GOAL, STAGES and DAYS.
   Plain browser script. */
(() => {
  /* ---- Idea 1: the diary ---- */
  const RIDES = [58, 71, 44, 66, 39, 80, 52, 63, 47, 75, 68], N = RIDES.length, GOAL = 500;
  const TOT = RIDES.reduce((a, r) => (a.push((a.length ? a[a.length - 1] : 0) + r), a), []);
  const FIRST = TOT.findIndex(t => t >= GOAL);          // the answer (the data has one: the last total passes GOAL)
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const LONG_TRIP = 90;                                 // a longer trip, for scale
  const EVE = i => i + 1;                              // page index -> evening number
  const EVES = TOT.map((_, i) => EVE(i));
  const midOf = (lo, hi) => Math.floor((lo + hi) / 2);
  const worst = n => { let k = 0; while (n > 1) { n = Math.ceil(n / 2); k++; } return k; };
  const chain = n => { const c = [n]; while (n > 1) { n = Math.ceil(n / 2); c.push(n); } return c; };
  // the halving, round by round: { lo, hi, mid, t, keep } (keep = the middle page reached GOAL, so it stays)
  const HALVE = (() => {
    const out = []; let lo = 0, hi = N - 1;
    while (lo < hi) {
      const mid = midOf(lo, hi), t = TOT[mid], keep = t >= GOAL;
      out.push({ lo, hi, mid, t, keep });
      if (keep) hi = mid; else lo = mid + 1;
    }
    return out;
  })();
  const OPEN0 = midOf(0, N - 1);                         // the page opened on the "spot the trick" screen
  const pageVals = read => TOT.map((t, i) => read.has(i) ? t : "?");
  const ptrsOf = o => { const p = {}; for (const [name, i] of Object.entries(o)) if (i != null) p[i] = p[i] ? `${p[i]} ${name}` : name; return p; };

  /* 1. The slow way: read the diary page by page. */
  function slowWay({ el, done, kit }) {
    const read = new Set();
    const paint = () => {
      const k = read.size, found = read.has(FIRST), last = k ? k - 1 : null;
      const cls = {};
      read.forEach(i => { cls[i] = "in"; });
      if (found) cls[FIRST] = "enter"; else cls[k] = "next";
      el.innerHTML = `<h1>On which evening did you pass ${GOAL} km?</h1>
        <p class="lead">Last summer you cycled along a river for ${N} days. Each evening you wrote one line in your diary: the trip's total distance so far. A friend asks when you passed <b>${GOAL} km</b>. The pages are closed, and reading one page counts as one look.</p>
        <p class="task">Open the pages in order, starting with evening 1, until you find the first total of ${GOAL} km or more.</p>
        ${kit.pics.row1d(pageVals(read), { cls, labels: EVES, pick: found ? false : i => i === k, title: "Diary pages, by evening" })}
        <div class="lpanel">
          ${k ? `<div class="sum">${plural(k, "look")}<small>${found ? "in all" : "so far"}</small></div>` : ""}
          ${found ? kit.feedback(`Evening ${EVE(FIRST)}: <b>${TOT[FIRST]} km</b>, the first page at ${GOAL} or more. That took ${plural(k, "look")}. Had you passed ${GOAL} km on the last evening, you would have read all ${N} pages. A diary of a ${LONG_TRIP}-day trip could take ${LONG_TRIP} looks.`, true)
            : last != null ? kit.feedback(`Evening ${EVE(last)}: ${TOT[last]} km. Not ${GOAL} yet. Open the next page.`) : ""}
        </div>`;
      el.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => {
        read.add(+b.dataset.i); paint();
        if (read.has(FIRST)) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: one look at the middle page rules out everything before it. */
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const t = TOT[OPEN0], below = t < GOAL, e = EVE(OPEN0);
    const before = `evenings 1 to ${e - 1}`, after = `evenings ${e + 1} to ${N}`;
    const opts = below
      ? [`They are all under ${GOAL} km too`, "Nothing: I still have to read them", `Evening ${e + 1} must be the answer`]
      : [`They could all be ${GOAL} km or more`, "Nothing: I still have to read them", `None of them is the first past ${GOAL}`];
    const correct = 0;
    const paint = () => {
      const ok = ans === correct, cls = {};
      if (ok) { for (let i = 0; i <= OPEN0; i++) cls[i] = "gone"; } else cls[OPEN0] = "in";
      el.innerHTML = `<h1>Open the middle page first</h1>
        <p class="lead">Start again with every page closed. This time you open the middle page first: evening ${e}. It says <b>${t} km</b>.</p>
        <p class="task">What does ${t} km tell you about ${before}?</p>
        ${kit.pics.row1d(pageVals(new Set([OPEN0])), { cls, labels: EVES, ptrs: ok ? {} : { [OPEN0]: "open" }, title: "Diary pages, by evening" })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The total never goes down (the pages are sorted: each total is at least the one before). Each evening only adds that day's ride. So no page before evening ${e} can show more than ${t} km, and none of them reached ${GOAL}. One look ruled out ${OPEN0 + 1} pages, evening ${e} and the ${OPEN0} before it. Only ${after} are left. The struck-through pages are out.`, true)
          : ans === 1 ? kit.feedback(`You do not need to read them. Each evening adds that day's ride to the total, so the total only grows. Evening ${e - 1} shows at most ${t} km, and so does every page before it.`, false)
          : kit.feedback(`${t} km is ${GOAL - t} km short of ${GOAL}. One day's ride may or may not cover that, so the answer could be any of ${after}. What you do know is about the pages before evening ${e}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Halve it yourself: pick the middle page, then say which pages drop out. Then feel the saving at real sizes. */
  function halveIt({ el, done, kit }) {
    let lo = 0, hi = N - 1, mid = null, wrongPick = null, wrongDrop = null, said = null, n = 1000;
    const read = new Set();
    const DROP = [
      e => `Evening ${e} and every page before it`,
      e => `Every page after evening ${e}; evening ${e} stays`,
      e => `Evening ${e} and every page after it`
    ];
    const paint = () => {
      const fin = lo === hi, phase = fin ? "fin" : mid == null ? "pick" : "drop";
      const cls = {};
      for (let i = 0; i < N; i++) cls[i] = i < lo || i > hi ? "gone" : read.has(i) ? "in" : "";
      if (fin) cls[lo] = "enter";
      const left = hi - lo + 1, m = midOf(lo, hi);
      const t = mid == null ? null : TOT[mid], e = mid == null ? null : EVE(mid);
      const correct = t != null && t >= GOAL ? 1 : 0;
      const looks = read.size;
      let task = "";
      if (phase === "pick") task = `Evenings ${EVE(lo)} to ${EVE(hi)} are still in play: ${plural(left, "page")}. Tap the page you open next.`;
      if (phase === "drop") task = `Evening ${e} says ${t} km. Which pages are out now?`;
      let fb = "";
      if (wrongPick != null) {
        const i = wrongPick, w = Math.min(i - lo + 1, hi - i), wm = Math.min(m - lo + 1, hi - m);
        fb = kit.feedback(`Evening ${EVE(i)} is ${i < m ? "before" : "after"} the middle of the pages in play. If it shows ${i < m ? `under ${GOAL}` : `${GOAL} or more`}, only ${plural(w, "page")} drop${w === 1 ? "s" : ""} out. The middle page always rules out at least ${wm}, whatever it shows.`, false);
      } else if (wrongDrop != null) {
        const msg = t < GOAL
          ? (wrongDrop === 1 ? `${t} is under ${GOAL}, so evening ${e} did not reach it, and no page before it did either. The first page past ${GOAL} comes after evening ${e}.`
            : `The later pages have bigger totals, so that is where ${GOAL} gets passed. Under ${GOAL} means the answer is after evening ${e}, not before.`)
          : (wrongDrop === 0 ? `The pages before evening ${e} have smaller totals, and one of them may already be past ${GOAL}. That page would be the first, so you cannot drop them.`
            : `Evening ${e} reached ${GOAL}, so it may be the first one that did. Drop only the pages after it. Evening ${e} stays in play.`);
        fb = kit.feedback(msg, false);
      } else if (fin) {
        fb = kit.feedback(`One page left in play: evening ${EVE(lo)}, ${read.has(lo) ? `which you already read: <b>${TOT[lo]} km</b>` : `<b>${TOT[lo]} km</b>`}. The same answer as before, in ${plural(looks, "look")} instead of ${FIRST + 1}. Each look cut the pages in play about in half: ${chain(N).join(" → ")} pages, so at most ${plural(worst(N), "look")}. Now make the diary longer:`, true);
      } else if (said) fb = kit.feedback(said);
      el.innerHTML = `<h1>Halve the pages</h1>
        <p class="lead">Same diary, all pages closed. Pages that could still be the answer are in play. Struck-through pages are out. The middle page is the best one to open: whatever it shows, it rules out about half the pages in play.</p>
        ${task ? `<p class="task">${task}</p>` : ""}
        ${kit.pics.row1d(pageVals(read), { cls, labels: EVES, pick: phase === "pick" ? i => i >= lo && i <= hi && !read.has(i) : false, ptrs: phase === "drop" ? { [mid]: "open" } : {}, title: "Diary pages, by evening" })}
        <div class="lpanel">${phase === "drop" ? kit.options(DROP.map(f => f(e)), { picked: wrongDrop, correct }) : ""}
        ${fb}
        ${fin ? `${kit.meter([{ label: "Page by page", value: FIRST + 1, max: N }, { label: "Halving", value: looks, max: N, good: true }])}
          <div class="sliders"><label>Pages in the diary <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lp button[data-i]").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        // any page that rules out as many pages at worst as the middle does is a fair pick
        if (Math.min(i - lo + 1, hi - i) < Math.min(m - lo + 1, hi - m)) { wrongPick = i; said = null; paint(); return; }
        wrongPick = null; mid = i; read.add(i); said = null; paint();
      });
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrongDrop = v; paint(); return; }
        wrongDrop = null;
        const was = hi - lo + 1;
        if (t >= GOAL) hi = mid; else lo = mid + 1;
        const now = hi - lo + 1;
        said = `${plural(was - now, "page")} out. ${now === 1 ? "" : `${plural(now, "page")} left: evenings ${EVE(lo)} to ${EVE(hi)}.`}`;
        mid = null; paint();
        if (lo === hi) done();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const h = worst(n);
        el.querySelector("#big").innerHTML = `${fmt(n)} vs ${fmt(h)}<small>looks at worst when reading page by page, against halving (${fmt(n)} halved ${plural(h, "time")} is 1). That is about ${fmt(Math.round(n / h))} times fewer looks, and the gap grows with the diary.</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same moves as code, stepped against the same diary. */
  const CODE1 = [
    "let lo = 0, hi = totals.length - 1;",
    "while (lo < hi) {",
    "  const mid = Math.floor((lo + hi) / 2);",
    "  if (totals[mid] >= goal) hi = mid;",
    "  else lo = mid + 1;",
    "}",
    "return lo; // first total >= goal"
  ];
  const FR1 = (() => {
    const read = new Set();
    const fr = [{ ln: 0, lo: 0, hi: N - 1, mid: null, read: new Set(), say: `<code>lo</code> and <code>hi</code> mark the first and last page in play. Code counts from 0, so evening 1 is <code>totals[0]</code> and evening ${N} is <code>totals[${N - 1}]</code>.` }];
    fr.push({ ln: 1, lo: 0, hi: N - 1, mid: null, read: new Set(), say: `0 < ${N - 1}: more than one page is in play, so the loop runs.` });
    HALVE.forEach(({ lo, hi, mid, t, keep }) => {
      read.add(mid);
      fr.push({ ln: 2, lo, hi, mid, read: new Set(read), say: `mid = floor((${lo} + ${hi}) / 2) = ${mid}. <code>totals[${mid}]</code> is ${t} km: evening ${EVE(mid)}.` });
      if (keep) fr.push({ ln: 3, lo, hi: mid, mid, read: new Set(read), say: `${t} >= ${GOAL} is true, so hi = ${mid}. Evening ${EVE(mid)} stays in play and every page after it is out.` });
      else fr.push({ ln: 4, lo: mid + 1, hi, mid, read: new Set(read), say: `${t} >= ${GOAL} is false, so the <code>else</code> runs: lo = ${mid + 1}. Evening ${EVE(mid)} and every page before it are out.` });
    });
    fr.push({ ln: 1, lo: FIRST, hi: FIRST, mid: null, read: new Set(read), say: `lo and hi are both ${FIRST}: one page in play, so the loop stops.` });
    fr.push({ ln: 6, lo: FIRST, hi: FIRST, mid: null, read: new Set(read), fin: true, say: `Return ${FIRST}: <code>totals[${FIRST}]</code> is ${TOT[FIRST]} km, evening ${EVE(FIRST)}. The page you found by hand, in ${plural(HALVE.length, "look")}. When two pages share the middle, the code opens the earlier one (<code>Math.floor</code> rounds down).` });
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cls = {};
      for (let j = 0; j < N; j++) cls[j] = j < f.lo || j > f.hi ? "gone" : f.read.has(j) ? "in" : "";
      if (f.fin) cls[f.lo] = "enter";
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">This halving is called binary search. <code>totals</code> is the diary and <code>goal</code> is ${GOAL}. Each line is a move you made by hand.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the pages.</p>
        ${kit.pics.row1d(pageVals(f.read), { cls, labels: TOT.map((_, j) => j), ptrs: ptrsOf({ lo: f.lo, mid: f.mid, hi: f.hi }), title: "totals, by index" })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>lo <b>${f.lo}</b></span><span>hi <b>${f.hi}</b></span><span>mid <b>${f.mid == null ? "–" : f.mid}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* ---- Idea 2: next summer's stages and a daily limit ---- */
  const STAGES = [34, 52, 27, 45, 61, 38, 49, 30], NS = STAGES.length, DAYS = 4, TRY = 90;
  const LONGEST = Math.max(...STAGES), LONG_AT = STAGES.indexOf(LONGEST), TOTAL = STAGES.reduce((a, b) => a + b, 0);
  // ride stages in order; camp before a stage that would take today past the limit. Returns the day (1-based) of each stage.
  const plan = limit => { const d = []; let day = 1, today = 0; STAGES.forEach(s => { if (today && today + s > limit) { day++; today = 0; } today += s; d.push(day); }); return d; };
  const daysFor = limit => plan(limit)[NS - 1];
  const dayFrames = d => { const fr = []; d.forEach((x, i) => { if (i && d[i - 1] === x) fr[fr.length - 1][1]++; else fr.push([i, 1]); }); return fr; };
  const dayLabels = d => d.map(x => `day ${x}`);
  const dayTotals = d => d.reduce((a, x, i) => { a[x - 1] = (a[x - 1] || 0) + STAGES[i]; return a; }, []);
  const SEARCH = (() => {
    const out = []; let lo = LONGEST, hi = TOTAL;
    while (lo < hi) {
      const mid = midOf(lo, hi), d = daysFor(mid), ok = d <= DAYS;
      out.push({ lo, hi, mid, d, ok });
      if (ok) hi = mid; else lo = mid + 1;
    }
    return out;
  })();
  const BEST = SEARCH.length ? SEARCH[SEARCH.length - 1].ok ? SEARCH[SEARCH.length - 1].mid : SEARCH[SEARCH.length - 1].mid + 1 : LONGEST;
  const COUNT_UP = BEST - LONGEST + 1;                  // checks when trying LONGEST, LONGEST + 1, ... until one works
  const range = (a, b) => a === b ? `only ${a} km` : `${a} to ${b} km`;

  /* 5. Test one limit by hand: ride or camp, stage by stage. */
  function rideOrCamp({ el, done, kit }) {
    const d = [];
    let k = 0, day = 1, today = 0, wrong = null, said = null;
    const paint = () => {
      const fin = k === NS, s = STAGES[k], fits = today === 0 || today + s <= TRY, correct = fits ? 0 : 1;
      const cls = {}, labels = STAGES.map((_, i) => i < k ? `day ${d[i]}` : "");
      for (let i = 0; i < k; i++) cls[i] = "in";
      const frames = dayFrames(d).map(([l, n2], j, a) => [l, n2, !fin && j === a.length - 1]);
      el.innerHTML = `<h1>Next summer: ${NS} stages, ${DAYS} days</h1>
        <p class="lead">Next summer's route has ${NS} stages between campsites, and you have <b>${DAYS} days</b> off. Each bar is one stage, and the number is its length in km. Each day you ride as many stages as fit within your daily limit, then camp. A box groups the stages ridden on one day. You want the smallest limit that still fits the route into ${DAYS} days, so no day is harder than it has to be. Is a limit of <b>${TRY} km</b> a day enough?</p>
        ${fin ? "" : `<p class="task">Stage ${k + 1} is ${s} km${today ? `, and you have ridden ${today} km today (day ${day})` : ` and day ${day} has just begun`}. Ride it today, or camp first?</p>`}
        ${kit.bars(STAGES, { cls, frames, labels, ptrs: fin ? {} : { [k]: "next" } })}
        <div class="lpanel">${fin ? "" : kit.options(["Ride it today", "Camp first, ride it tomorrow"], { picked: wrong, correct })}
        ${wrong != null ? kit.feedback(wrong === 0
            ? `${today} + ${s} = ${today + s} km, over the ${TRY} km limit. Camp here and ride stage ${k + 1} tomorrow.`
            : today === 0 ? `Day ${day} has just begun, so there is nothing to rest from. Camping now wastes a whole day.`
            : `${today} + ${s} = ${today + s} km, still within ${TRY}. Stopping early leaves today short, and the trip can only get longer.`, false)
          : fin ? kit.feedback(`A limit of ${TRY} km a day needs <b>${plural(day, "day")}</b>. You have ${DAYS}, so ${TRY} km is ${day <= DAYS ? "enough" : "not enough"}. Your days: ${dayTotals(d).map(x => `${x} km`).join(", ")}. You just did one check: one pass over the stages, counting the days.`)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        if (v === 1) { day++; today = 0; said = `You camp. Day ${day} starts with stage ${k + 1}: ${s} km.`; }
        else said = `You ride stage ${k + 1}. Today is now ${today + s} km.`;
        today += s; d.push(day); k++;
        paint();
        if (k === NS) done();
      });
    };
    paint();
  }

  /* 6. Spot the trick: a lower limit can only need more days. */
  function spotTrick2({ el, done, kit }) {
    let ans = null;
    const dT = daysFor(TRY), LOWER = TRY - 5, pT = plan(TRY);
    const opts = [`No: a lower limit never needs fewer days`, "I would have to ride it through again", "Yes: shorter days are easier"];
    const correct = 0;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>Would a lower limit do?</h1>
        <p class="lead">A limit of ${TRY} km a day needed ${plural(dT, "day")}, and you have ${DAYS}. Your friend suggests ${LOWER} km a day.</p>
        <p class="task">Without riding it through, is ${LOWER} km a day enough for ${DAYS} days?</p>
        ${kit.bars(STAGES, { cls: Object.fromEntries(STAGES.map((_, i) => [i, "in"])), frames: dayFrames(pT), labels: dayLabels(pT), title: `${TRY} km a day` })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. With a lower limit, every day ends at the same campsite or earlier, never later, so ${LOWER} km needs at least the ${dT} days that ${TRY} needed. The mirror holds too: if a limit works, every bigger limit works.`, true)
          : ans === 1 ? kit.feedback(`You can tell without riding. A lower limit makes each day end at the same campsite or earlier, never later. So it needs at least as many days as ${TRY} km did: ${dT}, more than ${DAYS}.`, false)
          : kit.feedback(`Shorter days are easier, but each covers less of the route, so the trip takes as many days or more. ${TRY} km already needed ${dT}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. Halve the limits yourself: the lesson checks the middle limit, you say which limits stay possible. */
  function halveLimits({ el, done, kit }) {
    let r = 0, wrong = null, said = null;
    const paint = () => {
      const fin = r === SEARCH.length, st = fin ? null : SEARCH[r];
      let opts = [], correct = -1;
      if (!fin) {
        const { lo, hi, mid, ok } = st;
        // [text, kind] kinds: keep (right when ok), drop (mid excluded below), up (above mid), from (mid..hi), below (lo..mid-1)
        const list = ok
          ? [[range(lo, mid), "right"], mid > lo ? [range(lo, mid - 1), "drop"] : null, [range(mid + 1, hi), "up"]]
          : [[range(mid + 1, hi), "right"], [range(mid, hi), "from"], mid > lo ? [range(lo, mid - 1), "below"] : null];
        const nums = t => t.match(/\d+/g).map(Number), at = t => { const x = nums(t); return [x[0], x[x.length - 1]]; };
        const sorted = list.filter(Boolean).sort((a, b) => at(a[0])[0] - at(b[0])[0] || at(a[0])[1] - at(b[0])[1]);
        const k = r % sorted.length;                     // a fixed rotation per round, so the right option is not always in one place
        opts = sorted.slice(k).concat(sorted.slice(0, k));
        correct = opts.findIndex(o => o[1] === "right");
      }
      const show = fin ? BEST : st.mid, p = plan(show);
      const checks = fin ? SEARCH.length : r + 1;
      const lo = fin ? BEST : st.lo, hi = fin ? BEST : st.hi;
      let fb = "";
      if (wrong != null) {
        const { mid, d } = st, kind = opts[wrong][1];
        fb = kit.feedback(kind === "drop" ? `${mid} km works (${plural(d, "day")}). If no smaller limit works, ${mid} km is the answer, so it has to stay.`
          : kind === "up" ? `Bigger limits work too, but you want the smallest. ${mid} km already works, so nothing above it can be the answer.`
          : kind === "from" ? `${mid} km needs ${plural(d, "day")}, more than ${DAYS}. It cannot be the answer, so drop it too.`
          : `A smaller limit needs as many days or more. If ${mid} km is not enough, nothing below it is.`, false);
      } else if (fin) fb = kit.feedback(`The smallest limit that works is <b>${BEST} km a day</b>: ${plural(daysFor(BEST), "day")}, shown above. You checked ${plural(SEARCH.length, "limit")}. Counting up from ${LONGEST} km, one limit at a time, would have taken ${COUNT_UP} checks: about ${fmt(Math.round(COUNT_UP / SEARCH.length))} times fewer checks. Halving the possible answers like this is called binary search on the answer.`, true);
      else if (said) fb = kit.feedback(said);
      el.innerHTML = `<h1>Halve the limits</h1>
        <p class="lead">The limits line up as no, no, no, then yes, yes, yes, like the diary pages under ${GOAL} and then past it. You want the first yes. The answer is a limit from ${LONGEST} km (stage ${LONG_AT + 1} cannot be split) to ${TOTAL} km (the whole route in one day). Each round, the lesson checks the middle limit for you with the same ride-or-camp pass. The bars show its days.</p>
        ${fin ? "" : `<p class="task">Possible limits: ${range(st.lo, st.hi)}. A limit of <b>${st.mid} km</b> needs ${plural(st.d, "day")} (you have ${DAYS}). Which limits are still possible?</p>`}
        ${kit.bars(STAGES, { cls: Object.fromEntries(STAGES.map((_, i) => [i, fin ? "enter" : "in"])), frames: dayFrames(p), labels: dayLabels(p) })}
        <div class="vars"><span>limit <b>${show} km</b></span><span>days <b>${daysFor(show)}</b></span><span>possible <b>${range(lo, hi)}</b></span><span>checks <b>${checks}</b></span></div>
        <div class="lpanel">${fin ? "" : kit.options(opts.map(o => o[0]), { picked: wrong, correct })}
        ${fb}
        ${fin ? kit.meter([{ label: "Counting up", value: COUNT_UP, max: COUNT_UP }, { label: "Halving", value: SEARCH.length, max: COUNT_UP, good: true }]) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== correct) { wrong = v; paint(); return; }
        wrong = null;
        const { lo: a, hi: z, mid, ok } = st, nlo = ok ? a : mid + 1, nhi = ok ? mid : z;
        said = `${ok ? `${mid} km works, so it stays and everything above it goes.` : `${mid} km is not enough, so it goes with everything below it.`} ${plural((z - a + 1) - (nhi - nlo + 1), "limit")} out.`;
        r++; paint();
        if (r === SEARCH.length) done();
      });
    };
    paint();
  }

  /* 8. The same search as code: only the test line changed. */
  const CODE2 = [
    "let lo = Math.max(...stages);",
    "let hi = stages.reduce((a, b) => a + b);",
    "while (lo < hi) {",
    "  const mid = Math.floor((lo + hi) / 2);",
    "  if (daysNeeded(mid) <= days) hi = mid;",
    "  else lo = mid + 1;",
    "}",
    "return lo; // smallest limit that works"
  ];
  const FR2 = (() => {
    const fr = [{ ln: 0, lo: LONGEST, hi: "–", mid: null, say: `No limit below the longest stage works: stage ${LONG_AT + 1} is ${LONGEST} km. lo = ${LONGEST}.` },
      { ln: 1, lo: LONGEST, hi: TOTAL, mid: null, say: `At the sum of all stages you ride everything on day 1, so that limit surely works. hi = ${TOTAL}.` }];
    SEARCH.forEach(({ lo, hi, mid, d, ok }) => {
      fr.push({ ln: 3, lo, hi, mid, d, say: `mid = floor((${lo} + ${hi}) / 2) = ${mid}. <code>daysNeeded(${mid})</code> is ${d}.` });
      if (ok) fr.push({ ln: 4, lo, hi: mid, mid, d, say: `${d} <= ${DAYS} is true: ${mid} km works, so hi = ${mid}.` });
      else fr.push({ ln: 5, lo: mid + 1, hi, mid, d, say: `${d} <= ${DAYS} is false: ${mid} km is not enough, so lo = ${mid + 1}.` });
    });
    fr.push({ ln: 7, lo: BEST, hi: BEST, mid: null, fin: true, say: `lo and hi are both ${BEST}, so the loop stops. Return ${BEST}: the limit you found by hand, after ${plural(SEARCH.length, "check")}.` });
    return fr;
  })();
  function limitsCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR2[i], show = f.mid != null ? f.mid : f.fin ? BEST : null, p = show == null ? null : plan(show);
      el.innerHTML = `<h1>Same loop, new test</h1>
        <p class="lead">This is the diary code with a new <code>if</code> test: <code>daysNeeded(limit)</code> is your ride-or-camp pass, and <code>days</code> is ${DAYS}.</p>
        <p class="task">Step through the code to the end.</p>
        ${kit.bars(STAGES, { cls: Object.fromEntries(STAGES.map((_, j) => [j, f.fin ? "enter" : p ? "in" : ""])), frames: p ? dayFrames(p) : [], labels: p ? dayLabels(p) : STAGES.map((_, j) => `${j + 1}`) })}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>lo <b>${f.lo}</b></span><span>hi <b>${f.hi}</b></span><span>mid <b>${f.mid == null ? "–" : f.mid}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A video player keeps the start times of a film's 40 chapters, in order. The viewer drags the slider to 1:14:32. Which chapter is playing?", true,
      "Yes. The start times are sorted, so halve them: a chapter that starts after 1:14:32 rules out itself and every later one. You want the last start at or before 1:14:32, the same kind of boundary as the diary.",
      "The start times are sorted, so one look at the middle chapter rules out half of them: if it starts after 1:14:32, so does every later chapter. You want the last start at or before 1:14:32, a boundary like the diary's."],
    ["A phone's call log holds 2,000 calls, newest first. Just once, you want to know if your landlord ever called.", false,
      "No. The log is sorted by time, but you are searching by caller. The middle call's name says nothing about which half holds the landlord, so nothing can be ruled out. Sorting by name first takes more work than reading the 2,000 calls once; it only pays off if you will search many times.",
      "It is sorted, but by time, and you are searching by caller. Open the middle call and see another name: the landlord could be in either half, so nothing is ruled out. Sorting by name first takes more work than one read-through, and you only search once."],
    ["After a lake festival, 600 people wait at the pier. A small ferry lands 40 of them on the far shore every 15 minutes, a big one lands 90 every 25 minutes. How soon can everyone be across?", true,
      "Yes, by searching over the possible answers (here, times), like the daily limits. Guess a time and count the loads each ferry lands in it, then the people. More time never means fewer people across, so if a time is enough, every longer time is too. Halve the times.",
      "No single division gives the answer, because people land only in whole loads. But you can guess a time and check it: count the loads each ferry lands in that time and add up the people. More time never means fewer people across, so the times line up as no, no, then yes, yes. Halve them like the daily limits."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would binary search work here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations away from the river.</p>
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
    "find-a-value-or-boundary": "You did this with the diary: open the middle page, keep the half where the first total past the goal must be.",
    "search-the-answer": "You did this with the daily limit: guess a limit, check it with one pass, keep the half where the smallest working limit must be."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  LessonKit.define("binary-search", {
    title: "Binary search",
    teaches: ["find-a-value-or-boundary", "search-the-answer"],
    screens: [slowWay, spotTrick, halveIt, asCode, rideOrCamp, spotTrick2, halveLimits, limitsCode, recognise, toProblems],
    walk: [
      { right: Array.from({ length: FIRST + 1 }, (_, i) => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${HALVE[0].lo}"]`], right: HALVE.flatMap(h => [`[data-i="${h.mid}"]`, "[data-right]"]) },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: Array(NS).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(SEARCH.length).fill("[data-right]") },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
