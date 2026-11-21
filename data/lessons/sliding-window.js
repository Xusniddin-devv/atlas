/* Lesson: sliding window. A coffee stand's cups per hour (fixed window), then a playlist (the window that
   changes size). Every number on screen is computed here from CUPS, K, SONGS and SONGS2. Plain browser script. */
(() => {
  const CUPS = [4, 2, 7, 1, 8, 3, 6, 2], K = 3, N = CUPS.length;
  const HOURS = CUPS.map((_, i) => `${9 + i}:00`);
  const STARTS = N - K + 1;
  const sumAt = l => CUPS.slice(l, l + K).reduce((a, b) => a + b, 0);
  const SUMS = Array.from({ length: STARTS }, (_, l) => sumAt(l));
  const BEST = Math.max(...SUMS), BEST_AT = SUMS.indexOf(BEST);
  const SLOW = STARTS * K;              // steps when every shift is added up from scratch
  const win = (l, c = "in") => Object.fromEntries(Array.from({ length: K }, (_, j) => [l + j, c]));
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const MID = HOURS.slice(1, K).join(" and ");

  /* 1. The slow way, by hand. */
  function slowWay({ el, done, kit }) {
    const tried = new Map();
    let steps = 0, cur = null, miss = null;
    const paint = () => {
      const all = tried.size === STARTS, cls = cur == null ? {} : win(cur);
      if (miss != null) cls[miss] = "no";
      const left = STARTS - tried.size;
      el.innerHTML = `<h1>Your coffee stand had a busy morning</h1>
        <p class="lead">Each bar is the cups you sold in one hour. You want to hire a helper for the best <b>${K} hours in a row</b>. Adding one number to a total counts as one step.</p>
        <p class="task">Tap an hour to start a ${K}-hour shift there. Check shifts until you know which one sells the most.</p>
        ${kit.bars(CUPS, { cls, frames: cur == null ? [] : [[cur, K]], pick: true, labels: HOURS })}
        <div class="lpanel">
          ${cur == null ? "" : `<div class="sum">${CUPS.slice(cur, cur + K).join(" + ")} = ${sumAt(cur)}<small>${K} steps</small></div>`}
          ${tried.size ? `<div class="tried">${[...tried].sort((a, b) => a[0] - b[0]).map(([l, s]) => `<span class="${all && s === BEST ? "top1" : ""}">${HOURS[l]} <b>${s}</b></span>`).join("")}</div>` : ""}
          ${miss != null ? kit.feedback(`A shift starting at ${HOURS[miss]} needs ${K} hours, but only ${plural(N - miss, "hour")} ${N - miss === 1 ? "is" : "are"} left on the chart. The last shift that fits starts at ${HOURS[N - K]}, so there are ${STARTS} shifts to check.`, false)
            : all ? kit.feedback(`The best shift starts at <b>${HOURS[BEST_AT]}</b> with ${BEST} cups. To be sure, you checked all ${STARTS} shifts: <b>${steps} steps</b> for ${N} hours of data. Did you notice you kept adding the same hours again?`, true)
            : tried.size ? kit.feedback(`${plural(left, "shift")} left to check. You cannot know the best until you have seen them all. Steps so far: <b>${steps}</b>.`) : ""}
        </div>`;
      el.querySelectorAll(".col").forEach(c => c.onclick = () => {
        const l = +c.dataset.i;
        if (l > N - K) { miss = l; paint(); return; }
        miss = null; cur = l;
        if (!tried.has(l)) { tried.set(l, sumAt(l)); steps += K; }
        paint();
        if (tried.size === STARTS) done();
      });
    };
    paint();
  }

  /* 2. Spot what changes between two neighbouring shifts. */
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const opts = [`All ${K} hours are different`, "Only the two ends: one hour left, one hour came in", "Nothing changed"];
    const paint = () => {
      const ok = ans === 1, cls = ok ? { ...win(0), 0: "leave", [K]: "enter" } : win(0);
      el.innerHTML = `<h1>Look at two shifts next to each other</h1>
        <p class="lead">The solid frame is the ${HOURS[0]} shift. The dashed frame is the ${HOURS[1]} shift, one hour later.</p>
        <p class="task">Between these two shifts, what actually changed?</p>
        ${kit.bars(CUPS, { cls, frames: [[0, K], [1, K, true]], labels: HOURS })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. <b>${MID}</b> are in both shifts. Only ${HOURS[0]} drops out (crossed out) and ${HOURS[K]} comes in. So the new total is the old total, minus one number, plus one number: <b>${sumAt(0)} − ${CUPS[0]} + ${CUPS[K]} = ${sumAt(1)}</b>. Two steps, however long the shift is. A block of neighbours like this shift is called a <b>window</b>. Moving it one step is <b>sliding</b> it.`, true)
          : kit.feedback(ans === 0 ? `Look at ${MID}: they sit inside both frames, so they did not change. Which hours are in only one frame?` : `The frames do not line up: ${HOURS[0]} is only in the solid one, and ${HOURS[K]} only in the dashed one.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Slide it yourself, predicting each new total; then feel the saving at real sizes. */
  function slideIt({ el, done, kit }) {
    let l = 0, sum = sumAt(0), ops = K, wrong = null, n = 100000, k = 1000;
    const paint = () => {
      const end = l === N - K, out = CUPS[l], inn = CUPS[l + K], right = sum - out + inn;
      const opts = end ? [] : [right, sum + inn, sum - out].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
      el.innerHTML = `<h1>Now slide the shift instead of adding it all again</h1>
        <p class="lead">${end ? "The shift reached the end of the morning." : `The current shift sells <b>${sum}</b> cups. Move it one hour right.`}</p>
        ${end ? "" : `<p class="task">${out} leaves on the left (${HOURS[l]}). ${inn} comes in on the right (${HOURS[l + K]}). What is the new total?${l === 0 ? " The bars below count your steps against the slow way from screen 1." : ""}</p>`}
        ${kit.bars(CUPS, { cls: end ? win(l) : { ...win(l), [l]: "leave", [l + K]: "enter" }, frames: [[l, K]], labels: HOURS })}
        <div class="lpanel">${end ? "" : kit.options(opts, { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong == null ? "" : kit.feedback(wrong === sum + inn ? `You added the ${inn} that came in, but the ${out} on the left is no longer in the shift. Take it away too.` : `You took away the ${out} on the left, but the ${inn} on the right has to be added.`, false)}
        ${kit.meter([{ label: "Adding every shift again", value: (l + 1) * K, max: SLOW }, { label: "Sliding", value: ops, max: SLOW, good: true }])}
        ${end ? `${kit.feedback(`The whole morning took <b>${ops}</b> steps instead of ${SLOW}. Small here. Now make the data bigger:`)}
          <div class="sliders"><label>Hours of data <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label><label>Shift length <input type="range" id="sk" min="0" step="1"><b id="skv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v === right) { l++; sum = right; ops += 2; wrong = null; paint(); if (l === N - K) done(); }
        else { wrong = v; paint(); }
      });
      const sn = el.querySelector("#sn"), sk = el.querySelector("#sk");
      if (!sn) return;
      // update in place: re-drawing the screen would drop the slider the learner is dragging
      const upd = () => {
        sk.max = Math.log10(n) - 1; sk.value = Math.log10(k);
        el.querySelector("#snv").textContent = fmt(n); el.querySelector("#skv").textContent = fmt(k);
        const a = (n - k + 1) * k, b = k + 2 * (n - k), r = a / b;
        el.querySelector("#big").innerHTML = `${fmt(a)} vs ${fmt(b)}<small>steps when adding every shift again, against sliding. ${r >= 1.5 ? `That is about ${fmt(Math.round(r))} times fewer steps. That is the whole idea of a sliding window.` : "With a shift this short there is nothing to reuse, so sliding saves nothing. It pays off as the shift gets longer."}</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; k = Math.min(k, n / 10); upd(); };
      sk.oninput = () => { k = 10 ** +sk.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same moves as code, stepped against the same chart. */
  const CODE1 = [
    `let sum = ${Array.from({ length: K }, (_, j) => `cups[${j}]`).join(" + ")};`,
    "let best = sum;",
    `for (let r = ${K}; r < cups.length; r++) {`,
    "  // one in, one out",
    `  sum += cups[r] - cups[r - ${K}];`,
    "  best = Math.max(best, sum);",
    "}"
  ];
  const FR = (() => {
    const fr = [{ ln: 0, l: 0, sum: sumAt(0), best: "–", say: `Add up the first shift once: ${CUPS.slice(0, K).join(" + ")} = ${sumAt(0)}.` },
      { ln: 1, l: 0, sum: sumAt(0), best: sumAt(0), say: "best keeps the biggest total seen so far, like the best total in your list on screen 1. Only one shift is seen yet." }];
    let s = sumAt(0), b = s;
    for (let r = K; r < N; r++) {
      const l = r - K + 1;
      s += CUPS[r] - CUPS[r - K];
      fr.push({ ln: 4, l, r, sum: s, best: b, slide: true, say: `r = ${r} (${HOURS[r]}). ${CUPS[r]} comes in, cups[${r - K}] = ${CUPS[r - K]} goes out. sum is now ${s}.` });
      const nb = Math.max(b, s);
      fr.push({ ln: 5, l, r, sum: s, best: nb, say: s > b ? `${s} beats ${b}. New best.` : `${s} does not beat ${b}. best stays ${b}.` });
      b = nb;
    }
    fr.push({ ln: 6, l: N - K, sum: s, best: b, say: `The loop ends. The answer is ${b}: the ${HOURS[BEST_AT]} shift you found by hand, in one pass over the data.` });
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">Each line is something you did by hand on the last three screens. <code>r</code> is the hour coming in on the right; <code>r - ${K}</code> is the hour dropping out on the left.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the chart.</p>
        ${kit.bars(CUPS, { cls: f.slide ? { ...win(f.l), [f.l - 1]: "leave", [f.r]: "enter" } : win(f.l), frames: [[f.l, K]], labels: HOURS })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>sum <b>${f.sum}</b></span><span>best <b>${f.best}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 5. The window that changes size: move both edges by hand on a playlist. */
  const SONGS = "ABCBDCEA".split(""), NS = SONGS.length;
  const dupIn = (s, l, r) => { const seen = new Set(); for (let i = l; i < r; i++) { if (seen.has(s[i])) return s[i]; seen.add(s[i]); } return null; };
  const MOVES = (() => { let l = 0, r = 0, m = 0; while (!(r === NS && !dupIn(SONGS, l, r))) { if (dupIn(SONGS, l, r)) l++; else r++; m++; } return m; })();
  const ptrs = (l, r) => r <= l ? {} : l === r - 1 ? { [l]: "l r" } : { [l]: "l", [r - 1]: "r" };
  function growShrink({ el, done, kit }) {
    let l = 0, r = 0, best = 0, bestL = 0, shrinks = 0, msg = null;
    const paint = () => {
      const d = dupIn(SONGS, l, r), fin = r === NS && !d, cls = {};
      SONGS.forEach((c, i) => { cls[i] = i < l ? "gone" : i < r ? (c === d ? "dup" : "in") : i === r && !d ? "next" : ""; });
      const correct = d ? 1 : 0;
      el.innerHTML = `<h1>A window that grows and shrinks</h1>
        <p class="lead">Your stand plays a playlist, one song after another. Each letter is a song. You want the longest run of songs in a row where <b>no song plays twice</b>. This time the window has no fixed size. <code>l</code> marks the first song in the window, <code>r</code> the last one; <code>next</code> is the song you would take in.</p>
        <p class="task">Grow the window on the right one song at a time. When a song plays twice, shrink it from the left until it does not. Go to the end of the playlist.</p>
        ${kit.cells(SONGS, { cls, bracket: [l, r - 1], ptrs: { ...(r < NS && !d ? { [r]: "next" } : {}), ...ptrs(l, r) } })}
        <div class="vars"><span>window <b>${r > l ? SONGS.slice(l, r).join(" ") : "empty"}</b></span><span>length <b>${r - l}</b></span><span>longest with no repeat <b>${best}</b></span></div>
        <div class="lpanel">${fin ? "" : kit.options(["Grow: take in the next song", "Shrink: drop the first song"], { correct })}
        ${fin ? kit.feedback(`Done. The longest run with no repeat is <b>${best} songs</b>: ${SONGS.slice(bestL, bestL + best).join(" ")}. Both edges only ever moved right, so each song came in once and left at most once: ${NS + shrinks} moves for ${NS} songs. Checking every start separately would re-read the same songs again and again.`, true)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const grow = b.dataset.i === "0", dd = dupIn(SONGS, l, r);
        if (grow && dd) msg = [`There are two ${dd}s in the window. Taking in another song keeps both, so the window stays broken. Drop songs from the left first.`, false];
        else if (!grow && r === l) msg = ["The window is empty, so there is nothing to drop. Take in the first song.", false];
        else if (!grow && !dd) msg = ["No song plays twice in the window right now. Dropping one only makes the run shorter. Take in the next song instead.", false];
        else {
          if (grow) r++; else { l++; shrinks++; }
          const nd = dupIn(SONGS, l, r);
          if (!nd && r - l > best) { best = r - l; bestL = l; }
          msg = nd ? [grow ? `${nd} is in the window twice now. The rule is broken.` : `Still two ${nd}s. Keep dropping from the left.`] : !grow ? [`Fixed: one ${dd} left. The window is ${r - l} songs long. Any run that starts before this point would hold both ${dd}s, so you never need to go back.`, true] : null;
        }
        paint();
        if (r === NS && !dupIn(SONGS, l, r)) done();
      });
    };
    paint();
  }

  /* 6. Predict when the left edge must move; the code runs the same decision. */
  const SONGS2 = "MNOPNQOM".split(""), N2 = SONGS2.length;
  const CODE2 = [
    "let l = 0, best = 0;",
    "const inWindow = new Set();",
    "for (let r = 0; r < songs.length; r++) {",
    "  while (inWindow.has(songs[r])) {",
    "    inWindow.delete(songs[l]);",
    "    l++;",
    "  }",
    "  inWindow.add(songs[r]);",
    "  best = Math.max(best, r - l + 1);",
    "}"
  ];
  const L = "<code>l</code>", R = "<code>r</code>";
  const STEPS2 = N2 - 1; // questions for r = 1 .. N2-1 (the first song just comes in)
  function predictLeft({ el, done, kit }) {
    let l = 0, r = 1, best = 1, bestL = 0, phase = "ask", wrong = null, last = null;
    const pos = (x, from, to) => { for (let i = from; i < to; i++) if (SONGS2[i] === x) return i; return -1; };
    const paint = () => {
      const x = SONGS2[r], inside = phase === "ask" ? pos(x, l, r) : -1, before = phase === "ask" ? pos(x, 0, l) : -1;
      const top = phase === "ask" ? r : r + 1, cls = {};
      SONGS2.forEach((_, i) => { cls[i] = i < l ? "gone" : i < top ? "in" : ""; });
      if (phase === "ask") { cls[r] = "next"; if (wrong === 1 && inside >= 0) cls[inside] = "dup"; }
      const p = { [l]: "l" }; p[r] = p[r] ? "l r" : "r";
      const correct = inside >= 0 ? 0 : 1;
      el.innerHTML = `<h1>When does the left edge move?</h1>
        <p class="lead">A new playlist, and the code that does what you just did. ${L} marks the first song in the window, ${R} the next song, about to come in. Before it comes in, the <code>while</code> line decides if ${L} moves.</p>
        ${phase === "ask" ? `<p class="task">Next song in: <b>${x}</b>, at position ${r}. Does ${L} have to move before it can come in?${r === 1 ? ` The first song, ${SONGS2[0]}, came in already: nothing to repeat, so best is 1.` : ""}</p>` : ""}
        ${kit.cells(SONGS2, { cls, bracket: [l, top - 1], labels: SONGS2.map((_, i) => i), ptrs: p })}
        ${kit.code(CODE2, phase === "ask" ? 3 : last.moved ? 5 : 7)}
        <div class="vars"><span>l <b>${l}</b></span><span>r <b>${r}</b></span><span>inWindow <b>{${SONGS2.slice(l, top).join(", ")}}</b></span><span>best <b>${best}</b></span></div>
        <div class="lpanel">${phase === "ask" ? kit.options([`Yes, ${L} moves`, `No, ${L} stays`], { picked: wrong, correct }) : ""}
        ${phase === "ask" && wrong != null ? kit.feedback(wrong === 1
          ? `${x} is already in the window, at position ${inside}. Taking it in makes two ${x}s, so ${L} must move past position ${inside}.`
          : before >= 0 ? `${x} did play before, at position ${before}, but ${L} has already moved past it. Only songs inside the window count, so ${L} stays.`
          : `There is no ${x} in the window, so taking it in repeats nothing. ${L} stays where it is.`, false) : ""}
        ${phase === "told" ? kit.feedback(last.say, true) + (r < N2 - 1 ? `<div class="lsteps"><button type="button" class="btn" data-next>Next song</button></div>` : "") : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const pick = +b.dataset.i;
        if (pick !== correct) { wrong = pick; paint(); return; }
        const was = l, dropped = [];
        if (inside >= 0) while (l <= inside) dropped.push(SONGS2[l++]);
        const len = r - l + 1;
        if (len > best) { best = len; bestL = l; }
        const winTxt = SONGS2.slice(l, r + 1).join(" ");
        let say = inside >= 0
          ? `Yes. ${x} was inside at position ${inside}. The while loop drops ${dropped.join(" and ")}, so ${L} moves from ${was} to ${l}. Window: ${winTxt}.`
          : before >= 0 ? `No. The earlier ${x} at position ${before} is already outside the window, so ${L} stays. Window: ${winTxt}.`
          : `No. ${x} is new to the window, so ${L} stays and the window grows to ${len} songs.`;
        if (r === N2 - 1) say += ` That was the last song. Longest run with no repeat: <b>${best} songs</b> (${SONGS2.slice(bestL, bestL + best).join(" ")}).`;
        last = { moved: inside >= 0, say }; wrong = null; phase = "told";
        paint();
        if (r === N2 - 1) done();
      });
      const nx = el.querySelector("[data-next]");
      if (nx) nx.onclick = () => { r++; phase = "ask"; paint(); };
    };
    paint();
  }

  /* 7. Recognise it in new situations. */
  const CASES = [
    ["A weather log has one temperature per day. Find the longest stretch of days that all stayed above 20°.", true,
      "Yes. The days are in a row, and each new day either keeps the stretch going or breaks it. The window grows on the right and restarts right after a cold day.",
      "The days have to be in a row, and each new day either keeps the stretch going or breaks it. That is a window: it grows on the right and restarts right after a cold day."],
    ["A shop has 500 products. Pick any 3 of them, anywhere in the list, with the highest total price.", false,
      "No. The three do not have to be neighbours, so there is no window. Just take the three most expensive.",
      "A window only covers items that sit next to each other. These three can be anywhere in the list, so just take the three most expensive."],
    ["In a server log, find the shortest run of lines that has at least one ERROR, one WARN and one INFO.", true,
      "Yes. Grow until all three kinds are inside, then shrink from the left while they still are. Notice the flip: for the longest run you shrink when the window breaks; for the shortest run you shrink while it still works.",
      "The lines must be in a row, and you can keep a count of each kind as lines come in and go out. Grow until all three kinds are inside, then shrink from the left while they still are. For the shortest run you shrink while the window still works, not when it breaks."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a sliding window work here?</h1>
        <p class="lead">${["Zero", "One", "Two", "Three", "Four", "Five"][CASES.length] || CASES.length} situations without coffee or songs.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 8. On to the problems: the groups this lesson taught first. */
  const TAUGHT = { "fixed-size-window": "You did this with the coffee shifts: a window of set length that slides.", "grow-and-shrink": "You did this with the playlist: grow on the right, shrink on the left." };
  function toProblems({ el, done, kit, topic }) {
    const nt = Object.keys(TAUGHT).length;
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>
      <p><b>Sliding window:</b> keep a running result over a block of neighbours and update it as items come in on the right and leave on the left. Use it when the answer must be a run of items next to each other; not when the items can be anywhere.</p>
      ${kit.practice(topic || { problems: [], subs: [] }, TAUGHT).replace('<ul class="lnext">', `<p>Numbers show the usual order; the ${["zero", "one", "two", "three"][nt] || nt} groups you just learned are moved to the top.</p><ul class="lnext">`)}`;
    done();
  }

  LessonKit.define("sliding-window", {
    title: "Sliding window",
    teaches: ["fixed-size-window", "grow-and-shrink"],
    screens: [slowWay, spotTrick, slideIt, asCode, growShrink, predictLeft, recognise, toProblems],
    walk: [
      { wrong: [`[data-i="${N - 1}"]`], right: Array.from({ length: STARTS }, (_, i) => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(N - K).fill("[data-right]") },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: Array(MOVES).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: Array.from({ length: STEPS2 }, (_, i) => i < STEPS2 - 1 ? ["[data-right]", "[data-next]"] : ["[data-right]"]).flat() },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
