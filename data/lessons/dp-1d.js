/* Lesson: 1-D dynamic programming. A drummer's practice sheets: how many fills fit a bar of n beats using hits
   (1 beat) and rolls (2 beats), first as a tree that keeps asking the same questions, then as a row filled once,
   left to right. Then a band's tour where the singer needs a night off after every show: play a night or skip it.
   Every number on screen is computed here from TREE_N, ROW_N, FEES, EXTRA and BIG_N. Plain browser script. */
(() => {
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const TIMES = ["no times", "once", "2 times", "3 times", "4 times", "5 times", "6 times"];
  const ratio = (a, b) => Math.round(a / b);
  const BIG_N = 30; // the "real size" both ideas are measured at

  /* ---------- Idea 1: drum fills ---------- */
  const TREE_N = 6, ASK_N = TREE_N + 1, ROW_N = 9, BIG_MAX = 60;
  // FILLS[b]: fills of a b-beat bar (1 beat: a hit; 2 beats: hit hit, or a roll)
  const FILLS = [0, 1, 2];
  for (let b = 3; b <= BIG_MAX; b++) FILLS[b] = FILLS[b - 1] + FILLS[b - 2];
  // TREE_ADDS[b]: additions the tree makes for b beats (every inner box is one addition)
  const TREE_ADDS = [0, 0, 0];
  for (let b = 3; b <= BIG_MAX; b++) TREE_ADDS[b] = 1 + TREE_ADDS[b - 1] + TREE_ADDS[b - 2];
  const ROW_ADDS = b => Math.max(0, b - 2);
  // the tree for TREE_N beats: heap key -> beats
  const TB = new Map();
  (function grow(b, k) { TB.set(k, b); if (b > 2) { grow(b - 1, 2 * k + 1); grow(b - 2, 2 * k + 2); } })(TREE_N, 0);
  const treeObj = b => b > 2 ? { v: b, l: treeObj(b - 1), r: treeObj(b - 2) } : { v: b };
  const TREE = treeObj(TREE_N);
  const INNER = [...TB].filter(([, b]) => b > 2).map(([k]) => k).sort((a, b) => b - a); // children before parents
  const TIMES_ASKED = b => INNER.filter(k => TB.get(k) === b).length;
  const DISTINCT = [...new Set(INNER.map(k => TB.get(k)))].sort((a, b) => a - b);
  const REPEATED = DISTINCT.filter(b => TIMES_ASKED(b) > 1).sort((a, b) => b - a);
  const beatsWord = b => `${b}-beat`;
  const bars = b => Array.from({ length: b }, (_, i) => i + 1); // labels under a row of bar lengths

  /* 1. The slow way: work out the count for 6 beats on the tree, by hand. */
  function slowTree({ el, done, kit }) {
    const known = new Map([...TB].filter(([, b]) => b <= 2).map(([k, b]) => [k, FILLS[b]]));
    let adds = 0, miss = null, note = null;
    const paint = () => {
      const fin = known.has(0), cls = {}, notes = {};
      for (const [k, b] of TB) {
        notes[k] = known.has(k) ? String(known.get(k)) : "?";
        cls[k] = b <= 2 ? "in" : known.has(k) ? "enter" : "";
        if (fin && b > 2 && REPEATED.includes(b)) cls[k] = "accent";
      }
      if (miss) cls[miss.k] = "no";
      const rep = REPEATED.map(b => `${b} beats ${TIMES[TIMES_ASKED(b)]}`).join(" and ");
      el.innerHTML = `<h1>How many drum fills fit in a bar?</h1>
        <p class="lead">You write practice sheets for a drummer. A fill uses <b>hits</b> (1 beat each) and <b>rolls</b> (2 beats each) in any order, so hit-roll and roll-hit are different fills. Every fill ends with a hit or a roll. If a ${TREE_N}-beat fill ends with a hit, ${TREE_N - 1} beats are left before it. If it ends with a roll, ${TREE_N - 2} beats are left. So the fills for ${TREE_N} beats are the fills for ${TREE_N - 1} beats plus the fills for ${TREE_N - 2} beats, and so on down.</p>
        <p class="task">Each box is a bar length in beats; the number under it is how many fills it has. Tap a box when both boxes below it have their number, to add them. Find the count for ${TREE_N} beats.</p>
        ${kit.pics.tree(TREE, { cls, notes, pick: true, title: `in the box: beats; under it: fills. 1 beat: ${plural(FILLS[1], "fill")} (hit). 2 beats: ${plural(FILLS[2], "fill")} (hit hit, roll)` })}
        <div class="lpanel">
          <div class="vars"><span>additions <b>${adds}</b></span></div>
          ${fin ? kit.feedback(`A ${TREE_N}-beat bar has <b>${FILLS[TREE_N]} fills</b>. That took <b>${plural(adds, "addition")}</b>, but there were only ${WORDS[DISTINCT.length].toLowerCase()} different bar lengths to work out: ${DISTINCT.join(", ")} beats. You worked out ${rep} (the ringed boxes). For a ${BIG_N}-beat bar the same tree needs ${fmt(TREE_ADDS[BIG_N])} additions.`, true)
            : miss ? kit.feedback(miss.say, false)
            : note ? kit.feedback(note) : ""}
        </div>`;
      el.querySelectorAll(".lp-node").forEach(n => n.onclick = () => {
        if (known.has(0)) return; // finished: the tree is a picture now
        const k = +n.dataset.i, b = TB.get(k);
        note = null; miss = null;
        if (b <= 2) miss = { k, say: `The ${beatsWord(b)} box is already known: ${b === 1 ? "one hit is the only fill" : "hit hit, or one roll"}. Its number is given, so there is nothing to add. Tap a box above it.` };
        else if (known.has(k)) note = `${b} beats is already worked out here: ${known.get(k)} fills.`;
        else {
          const open = [2 * k + 1, 2 * k + 2].filter(c => !known.has(c)).map(c => TB.get(c));
          if (open.length) miss = { k, say: `You cannot add for ${b} beats yet: the ${open.map(beatsWord).join(" and the ")} box below it ${open.length > 1 ? "have" : "has"} no number. Start from the bottom of the tree and work up.` };
          else {
            const x = known.get(2 * k + 1), y = known.get(2 * k + 2);
            known.set(k, x + y); adds++;
            note = `${b} beats: ${x} + ${y} = ${x + y} fills.`;
          }
        }
        paint();
        if (known.has(0)) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: the answers are already written down. */
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const a = FILLS[ASK_N - 1], b = FILLS[ASK_N - 2];
    const opts = [`Draw the tree for ${ASK_N} beats and add it all up again`, `Add two answers you already have: ${a} + ${b}`, `Double the ${ASK_N - 1}-beat answer: 2 × ${a}`];
    const paint = () => {
      const ok = ans === 1;
      const vals = [...bars(ASK_N - 1).map(i => FILLS[i]), ok ? FILLS[ASK_N] : "?"];
      const cls = ok ? { [ASK_N - 3]: "in", [ASK_N - 2]: "in", [ASK_N - 1]: "enter" } : { [ASK_N - 1]: "next" };
      el.innerHTML = `<h1>Now the drummer wants ${ASK_N} beats</h1>
        <p class="lead">Here is every answer the tree gave you, one box per bar length. The box for ${ASK_N} beats is empty.</p>
        <p class="task">What is the least work to fill the ${ASK_N}-beat box?</p>
        ${kit.pics.row1d(vals, { cls, labels: bars(ASK_N), from: ok ? { [ASK_N - 1]: [ASK_N - 3, ASK_N - 2] } : {}, title: "in the box: fills; under it: beats" })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. A ${ASK_N}-beat fill ends with a hit (${ASK_N - 1} beats before it: ${a} ways) or a roll (${ASK_N - 2} beats before it: ${b} ways). <b>${a} + ${b} = ${FILLS[ASK_N]}</b>, one addition. Work out each bar length once, write it down, and build the next one from the last two.`, true)
          : ans === 0 ? kit.feedback(`That tree holds the whole ${ASK_N - 1}-beat tree again plus a ${ASK_N - 2}-beat tree: ${TREE_ADDS[ASK_N]} additions. Every number it would produce is already in the row.`, false)
          : kit.feedback(`Doubling treats every ${ASK_N}-beat fill as a ${ASK_N - 1}-beat fill plus one more note. But a roll is 2 beats long: a fill that ends with a roll has only ${ASK_N - 2} beats before it, and there are ${b} of those, not ${a}. So 2 × ${a} = ${2 * a} counts too many.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Fill the row yourself, predicting each box; then feel the saving at real sizes. */
  function fillRow({ el, done, kit }) {
    let b = 3, wrong = null, n = 40;
    const paint = () => {
      const end = b > ROW_N, cur = end ? ROW_N : b - 1;
      const vals = bars(ROW_N).map(i => i < b ? FILLS[i] : i === b ? "?" : "");
      const right = end ? 0 : FILLS[b - 1] + FILLS[b - 2];
      const cand = end ? [] : [right, 2 * FILLS[b - 1], FILLS[b - 1] + 1, FILLS[b - 1]];
      const opts = cand.filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
      const cls = end ? {} : { [b - 3]: "in", [b - 2]: "in", [b - 1]: "next" };
      const say = v => v === 2 * FILLS[b - 1] ? `That doubles the ${b - 1}-beat count. A fill ending with a roll has ${b - 2} beats before it, not ${b - 1}: add ${FILLS[b - 2]}, not ${FILLS[b - 1]} again.`
        : v === FILLS[b - 1] ? `That counts only the fills that end with a hit. Fills that end with a roll count too: the ${b - 2}-beat box adds ${FILLS[b - 2]} more.`
        : `Plus one counts a single fill that ends with a roll. But every ${b - 2}-beat fill can take a roll on the end, and there are ${FILLS[b - 2]} of them.`;
      el.innerHTML = `<h1>Fill the row, left to right</h1>
        <p class="lead">${end ? `The row is full: ${ROW_N} beats have <b>${FILLS[ROW_N]} fills</b>.` : `Each box is built from the two boxes just before it. Nothing is worked out twice.`}</p>
        ${end ? "" : `<p class="task">How many fills does a ${b}-beat bar have?</p>`}
        ${kit.pics.row1d(vals, { cls, labels: bars(ROW_N), from: end ? {} : { [b - 1]: [b - 3, b - 2] }, title: "in the box: fills; under it: beats" })}
        <div class="lpanel">${end ? "" : kit.options(opts, { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong == null ? "" : kit.feedback(say(wrong), false)}
        <div class="lp-cap" style="margin-top:16px">additions so far: the tree vs your row</div>
        ${kit.meter([{ label: `Tree for ${cur} beats`, value: TREE_ADDS[cur], max: TREE_ADDS[ROW_N] }, { label: "Your row", value: ROW_ADDS(cur), max: TREE_ADDS[ROW_N], good: true }])}
        ${end ? `${kit.feedback(`<b>${ROW_ADDS(ROW_N)}</b> additions for the row against ${TREE_ADDS[ROW_N]} for the tree. Now make the bar longer:`)}
          <div class="sliders"><label>Beats in the bar <input type="range" id="sn" min="10" max="${BIG_MAX}" step="5" value="${n}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => {
        const v = opts[+x.dataset.i];
        if (v === right) { b++; wrong = null; paint(); if (b > ROW_N) done(); }
        else { wrong = v; paint(); }
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      // update in place: re-drawing the screen would drop the slider the learner is dragging
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        el.querySelector("#big").innerHTML = `${fmt(TREE_ADDS[n])} vs ${fmt(ROW_ADDS(n))}<small>additions for the tree, against the row. That is about ${fmt(ratio(TREE_ADDS[n], ROW_ADDS(n)))} times fewer additions. Each answer is built from a few earlier answers, so work each one out once and reuse it.</small>`;
      };
      sn.oninput = () => { n = +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same moves as code, stepped against the same row. */
  const CODE1 = [
    "function fills(n) {",
    "  const ways = [];",
    "  ways[1] = 1; // a hit",
    "  ways[2] = 2; // hit hit, or a roll",
    "  for (let b = 3; b <= n; b++) {",
    "    ways[b] = ways[b - 1] + ways[b - 2];",
    "  }",
    "  return ways[n];",
    "}"
  ];
  const FR1 = (() => {
    const fr = [
      { ln: 1, upto: 0, say: `n = ${TREE_N}. Start an empty row: <code>ways[b]</code> will hold the fills for b beats.` },
      { ln: 2, upto: 1, say: "One beat: only a hit fits." },
      { ln: 3, upto: 2, say: "Two beats: hit hit, or one roll." }
    ];
    for (let b = 3; b <= TREE_N; b++) fr.push({ ln: 5, upto: b, b, say: `b = ${b}. ${plural(FILLS[b - 1], "fill")} ${FILLS[b - 1] === 1 ? "ends" : "end"} with a hit, ${FILLS[b - 2]} ${FILLS[b - 2] === 1 ? "ends" : "end"} with a roll: ways[${b}] = ${FILLS[b]}.` });
    fr.push({ ln: 7, upto: TREE_N, say: `The loop ends. ways[${TREE_N}] = ${FILLS[TREE_N]}, the same count your tree gave, with ${ROW_ADDS(TREE_N)} additions instead of ${TREE_ADDS[TREE_N]}. Only the last two boxes are ever read, so two plain variables would do as well as the array.` });
    return fr;
  })();
  function asCode1({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i];
      const vals = bars(TREE_N).map(x => x <= f.upto ? FILLS[x] : "");
      const cls = f.b ? { [f.b - 3]: "in", [f.b - 2]: "in", [f.b - 1]: "enter" } : f.upto ? { [f.upto - 1]: "enter" } : {};
      el.innerHTML = `<h1>The same row, written as code</h1>
        <p class="lead">Nothing new here. Each line is something you just did by hand.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the row.</p>
        ${kit.pics.row1d(vals, { cls, labels: bars(TREE_N), from: f.b ? { [f.b - 1]: [f.b - 3, f.b - 2] } : {}, title: "ways[b] (b under the box)" })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>b <b>${f.b || "–"}</b></span><span>ways[b] <b>${f.b ? FILLS[f.b] : "–"}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* ---------- Idea 2: the tour, play a night or skip it ---------- */
  const FEES = [5, 8, 6, 2, 7, 9], NIGHTS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], NN = FEES.length;
  // screen 6 only: one extra night the learner has not solved yet
  const EXTRA = { night: "Sun", fee: 4 };
  const FEES7 = [...FEES, EXTRA.fee], NIGHTS7 = [...NIGHTS, EXTRA.night];
  const sumOf = (set, fees = FEES) => set.reduce((s, i) => s + fees[i], 0);
  const allowed = m => (m & (m >> 1)) === 0;
  // best plan over the first n nights, by trying every allowed plan (used to check the learner, never shown as typed)
  const bestPlan = (n, fees = FEES) => {
    let best = [], top = -1;
    for (let m = 0; m < 1 << n; m++) if (allowed(m)) {
      const set = Array.from({ length: n }, (_, i) => i).filter(i => m >> i & 1), s = sumOf(set, fees);
      if (s > top) { top = s; best = set; }
    }
    return best;
  };
  const BEST_SET = bestPlan(NN), BEST = sumOf(BEST_SET);
  const GREEDY = (() => {
    const t = new Set();
    [...FEES.keys()].sort((a, b) => FEES[b] - FEES[a]).forEach(i => { if (!t.has(i - 1) && !t.has(i + 1)) t.add(i); });
    return [...t].sort((a, b) => a - b);
  })();
  // plans the singer can play for n nights (including none): same rule as the fills
  const PLANS = [1, 2];
  for (let n = 2; n <= BIG_N; n++) PLANS[n] = PLANS[n - 1] + PLANS[n - 2];
  // BESTN[i]: best total over the first i nights (BESTN[0] = 0, no nights)
  const BESTN = [0, FEES[0]];
  for (let i = 2; i <= NN; i++) BESTN[i] = Math.max(BESTN[i - 2] + FEES[i - 1], BESTN[i - 1]);
  const names = set => set.map(i => NIGHTS[i]).join(", ");
  const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  // the plan behind BESTN, read back from the right
  const PLAN_BACK = (() => { const p = []; let i = NN; while (i > 0) { if (BESTN[i] === BESTN[i - 1]) i--; else { p.unshift(i - 1); i -= 2; } } return p; })();

  /* 5. The slow way: plan the tour by hand. */
  function planByHand({ el, done, kit }) {
    const taken = new Set();
    let miss = null, changes = 0;
    const paint = () => {
      const set = [...taken].sort((a, b) => a - b), total = sumOf(set), fin = total === BEST;
      const cls = {};
      set.forEach(i => { cls[i] = "enter"; });
      if (miss != null) cls[miss.i] = "no";
      el.innerHTML = `<h1>Your band goes on tour</h1>
        <p class="lead">Same trick of building from earlier answers, new question: this time you want the biggest total, not a count. A club in a different town offers a fee each night, in hundreds of dollars. Your singer needs <b>a night off after every show</b>, so the band never plays two nights in a row.</p>
        <p class="task">Tap nights to play them, tap again to drop them. Find the plan that earns the most.</p>
        ${kit.pics.row1d(FEES, { cls, labels: NIGHTS, pick: true, title: "fee per night" })}
        <div class="lpanel">
          <div class="sum">${set.length > 1 ? `${set.map(i => FEES[i]).join(" + ")} = ${total}` : total}<small>${set.length ? kit.esc(names(set)) : "no nights picked"}</small></div>
          ${fin ? kit.feedback(`<b>${BEST}</b> is the most this tour can earn: ${kit.esc(names(BEST_SET))}. You found it by trying. But a ${NN}-night tour already allows ${PLANS[NN]} different plans, and a ${BIG_N}-night tour allows ${fmt(PLANS[BIG_N])}. Trying them is not an option.`, true)
            : miss ? kit.feedback(miss.say, false)
            : set.length ? kit.feedback(sameSet(set, GREEDY) ? `${total}: you took the biggest fees first. A plan that earns more exists. A big fee also costs you both nights next to it.` : `This plan earns ${total}. A plan that earns more exists. Plans changed so far: ${changes}.`) : ""}
        </div>`;
      el.querySelectorAll(".lp-r1c button").forEach(x => x.onclick = () => {
        const i = +x.dataset.i;
        miss = null;
        if (taken.has(i)) { taken.delete(i); changes++; }
        else {
          const nb = [i - 1, i + 1].find(j => taken.has(j));
          if (nb != null) miss = { i, say: `The band plays ${kit.esc(NIGHTS[nb])}, so ${kit.esc(NIGHTS[i])} would be two nights in a row and the singer gets no night off. Drop ${kit.esc(NIGHTS[nb])} first if you want ${kit.esc(NIGHTS[i])}.` };
          else { taken.add(i); changes++; }
        }
        paint();
        if (sumOf([...taken]) === BEST) done();
      });
    };
    paint();
  }

  /* 6. Spot the trick: a new last night is either played or skipped. */
  function spotChoice({ el, done, kit }) {
    let ans = null;
    const L = NN, b4 = BESTN[NN - 1], b5 = BESTN[NN], fee = EXTRA.fee, N = NIGHTS7, ANS = Math.max(b5, b4 + fee);
    const p4 = bestPlan(NN - 1), p5 = bestPlan(NN), both = p4.filter(i => p5.includes(i));
    const opts = [`${b5} + ${fee} = ${b5 + fee}`, `The larger of ${b5} (skip ${N[L]}) and ${b4} + ${fee} = ${b4 + fee} (play ${N[L]}, so ${N[L - 1]} is off)`, `${b4} + ${b5} = ${b4 + b5}`];
    const paint = () => {
      const ok = ans === 1;
      const vals = [...BESTN.slice(1, NN + 1), ok ? ANS : "?"];
      const cls = ok ? { [L - 2]: "in", [L - 1]: "in", [L]: "enter" } : { [L]: "next" };
      el.innerHTML = `<h1>One more night</h1>
        <p class="lead">A club offers one more show: ${N[L]} pays ${fee}. A friend worked out the best totals for shorter tours. Through ${N[L - 2]} the best is <b>${b4}</b> (${kit.esc(names(p4))}). Through ${N[L - 1]} it is <b>${b5}</b> (${kit.esc(names(p5))}), the plan you just found. Through a night means using only the nights up to it. The best plan may skip that night itself.</p>
        <p class="task">What is the best total for the longer tour, through ${N[L]}?</p>
        ${kit.pics.row1d(FEES7, { labels: N, cls: { [L]: "next" }, title: "fee per night" })}
        ${kit.pics.row1d(vals, { cls, labels: N, from: ok ? { [L]: [L - 2, L - 1] } : {}, title: "best total through this night" })}
        <div class="lpanel">${kit.options(opts.map(o => kit.esc(o)), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. Either the band skips ${N[L]} and keeps ${b5}, or plays it, which forces ${N[L - 1]} off, so it adds ${fee} to the best through ${N[L - 2]}: ${b4} + ${fee} = ${b4 + fee}. The larger wins: <b>${ANS}</b>. Two earlier answers and one comparison, no plans tried.`, true)
          : ans === 0 ? kit.feedback(`${b5} comes from ${kit.esc(names(p5))}.${p5.includes(L - 1) ? ` ${N[L - 1]} is in it, so adding ${N[L]} means two nights in a row.` : ""} ${b5 + fee} is not a plan the singer can play. If ${N[L]} is played, ${N[L - 1]} must be off, so start from the best through ${N[L - 2]}.`, false)
          : kit.feedback(`Those two plans share nights: ${kit.esc(names(both))} ${both.length > 1 ? "are" : "is"} in both. Adding them counts those fees twice, and the band cannot play a night twice.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. Fill the best totals yourself, night by night. */
  const ROWLAB = ["none", ...NIGHTS];
  function fillTour({ el, done, kit }) {
    let i = 2, wrong = null, last = null;
    const paint = () => {
      const end = i > NN;
      const vals = ROWLAB.map((_, j) => j < i ? BESTN[j] : j === i ? "?" : "");
      const play = end ? 0 : BESTN[i - 2] + FEES[i - 1], rest = end ? 0 : BESTN[i - 1], right = Math.max(play, rest), bad = rest + (end ? 0 : FEES[i - 1]);
      const opts = end ? [] : [play, rest, bad].filter((v, j, a) => a.indexOf(v) === j).sort((x, y) => x - y);
      const night = end ? "" : NIGHTS[i - 1], two = end ? "" : ROWLAB[i - 2], one = end ? "" : ROWLAB[i - 1];
      const cls = end ? Object.fromEntries(PLAN_BACK.map(j => [j + 1, "enter"])) : { [i - 2]: "in", [i - 1]: "in", [i]: "next" };
      const fcls = end ? Object.fromEntries(PLAN_BACK.map(j => [j + 1, "enter"])) : { [i]: "in" };
      const say = v => v === bad && v !== right ? `${rest} is the best through ${one}, and that plan may already play ${one}. Adding ${night}'s ${FEES[i - 1]} on top could put two shows in a row. Playing ${night} means starting from the best through ${two}: ${BESTN[i - 2]} + ${FEES[i - 1]}.`
        : v === play ? `That is the "play ${night}" choice: ${BESTN[i - 2]} + ${FEES[i - 1]} = ${play}. Skipping ${night} keeps ${rest}, which is more. Keep the larger.`
        : `That is the "skip ${night}" choice: ${rest}. Playing ${night} gives ${BESTN[i - 2]} + ${FEES[i - 1]} = ${play}, which is more. Keep the larger.`;
      el.innerHTML = `<h1>Build the best total, night by night</h1>
        <p class="lead">${end ? `Every night is filled. The best tour earns <b>${BEST}</b>.` : `Back to the ${NN}-night tour. The first box is a tour of no nights: 0. Each new box is the larger of two choices: play the night (add its fee to the box two back) or skip it (copy the box just before).`}</p>
        ${end ? "" : `<p class="task">What is the best total through ${night}?</p>`}
        ${kit.pics.row1d(["", ...FEES], { cls: fcls, labels: ROWLAB, title: "fee per night" })}
        ${kit.pics.row1d(vals, { cls, labels: ROWLAB, from: end ? {} : { [i]: [i - 2, i - 1] }, title: "best total through this night" })}
        <div class="lpanel">${end ? "" : kit.options(opts, { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong != null ? kit.feedback(say(wrong), false) : last ? kit.feedback(last, true) : ""}
        ${end ? kit.feedback(`Read the row back from the right. If a box equals the one before it, that night was skipped: step one box left. If not, that night was played: step two boxes left, past the night off. The filled boxes are the nights this read-back finds. The plan is ${kit.esc(names(PLAN_BACK))}, the one you hunted for by hand. It took ${NN - 1} comparisons. For a ${BIG_N}-night tour that is ${BIG_N - 1} comparisons instead of ${fmt(PLANS[BIG_N])} plans: about ${fmt(ratio(PLANS[BIG_N], BIG_N - 1))} times fewer steps.`) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => {
        const v = opts[+x.dataset.i];
        if (v !== right) { wrong = v; last = null; paint(); return; }
        last = `${night}: play gives ${BESTN[i - 2]} + ${FEES[i - 1]} = ${play}, skip keeps ${rest}. ${play >= rest ? "Play it" : "Skip it"}: ${right}.`;
        wrong = null; i++; paint();
        if (i > NN) done();
      });
    };
    paint();
  }

  /* 8. The same choice as code. */
  const CODE2 = [
    "function bestTour(fee) {",
    "  const best = [0, fee[0]];",
    "  for (let i = 2; i <= fee.length; i++) {",
    "    const play = best[i - 2] + fee[i - 1];",
    "    const skip = best[i - 1];",
    "    best[i] = Math.max(play, skip);",
    "  }",
    "  return best[fee.length];",
    "}"
  ];
  const FR2 = (() => {
    const fr = [{ ln: 1, upto: 1, say: `best[0] = 0 (no nights) and best[1] = ${FEES[0]} (${NIGHTS[0]} alone). <code>fee</code> starts counting at 0, so night i is <code>fee[i - 1]</code>.` }];
    for (let i = 2; i <= NN; i++) {
      const play = BESTN[i - 2] + FEES[i - 1], skip = BESTN[i - 1];
      fr.push({ ln: 5, upto: i, i, play, skip, say: `i = ${i}, ${NIGHTS[i - 1]}. play = ${BESTN[i - 2]} + ${FEES[i - 1]} = ${play}, skip = ${skip}. ${play >= skip ? "Playing" : "Skipping"} wins: best[${i}] = ${BESTN[i]}.` });
    }
    fr.push({ ln: 7, upto: NN, say: `The loop ends. best[${NN}] = ${BEST}, one pass over the nights.` });
    return fr;
  })();
  function asCode2({ el, done, kit }) {
    let k = 0;
    const paint = () => {
      const f = FR2[k];
      const vals = ROWLAB.map((_, j) => j <= f.upto ? BESTN[j] : "");
      const cls = f.i ? { [f.i - 2]: "in", [f.i - 1]: "in", [f.i]: "enter" } : { 0: "enter", 1: "enter" };
      el.innerHTML = `<h1>Play or skip, written as code</h1>
        <p class="lead">The same two choices for every night, then the larger one.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the row.</p>
        ${kit.pics.row1d(vals, { cls, labels: ROWLAB.map((_, j) => j), from: f.i ? { [f.i]: [f.i - 2, f.i - 1] } : {}, title: "best[i] (i under the box)" })}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>i <b>${f.i || "–"}</b></span><span>play <b>${f.i ? f.play : "–"}</b></span><span>skip <b>${f.i ? f.skip : "–"}</b></span><span>step <b>${k + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${k === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${k === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { k--; paint(); };
      el.querySelector("[data-next]").onclick = () => { k++; paint(); if (k === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["A tiler covers a hallway one tile wide and n tiles long, using tiles 1 long and 3 long. How many patterns are there?", true,
      "Yes. The last tile is 1 long or 3 long. Take it off and a shorter hallway is left, so count(n) = count(n − 1) + count(n − 3). Fill the counts from short to long.",
      "Look at the last tile: 1 long or 3 long. Take it off and what is left is a shorter hallway, whose count you would already have. So count(n) = count(n − 1) + count(n − 3), each built from earlier answers."],
    ["A night guard may walk any of 10 hourly rounds, each with its own bonus, but must rest at least one hour after each round. What is the biggest bonus?", true,
      "Yes. It is the tour again: each hour, walk it (the hour before is rest, so take the best from two hours back) or skip it (copy the best so far). Keep the larger.",
      "Each hour is the same choice as a tour night: walk it and add its bonus to the best from two hours back, or skip it and keep the best so far. One number per hour is enough."],
    ["Same tour, one more rule: still a night off after every show, and now no two shows may pay the same fee. Can you keep one best total per night and build from it?", false,
      "No. One number per night forgets which fees it used. The next choice depends on that, so the best number so far can lead you to the wrong plan. Say the best plan so far uses a 7. A later night also pays 7, so you cannot play it. A slightly worse plan without that 7 could play it and win. To be safe you would keep one answer for every set of fees used, which is no better than trying every plan.",
      "Try it. One number per night forgets which fees it used, and the next choice depends on that. Say the best plan so far uses a 7. The night you want to add pays 7 too, so you cannot add it. A slightly worse plan without that 7 could add it and win. The best number so far can lead you to the wrong plan."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Build from earlier answers here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the band.</p>
        <p class="task">For each one, decide if one answer per position, built from a few earlier answers, solves it. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. On to the problems: the groups this lesson taught first. */
  const TAUGHT = {
    "from-earlier-terms": "You did this with the drum fills: each bar length is the sum of the two before it.",
    "take-or-skip": "You did this with the tour: play a night and add it to the best two back, or skip it."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>
      <p>This is <b>dynamic programming</b>: write down one answer per size, and build each one from a few earlier answers, so nothing is worked out twice. Use it when the answer for a size depends only on a few smaller answers. It fails when the next choice depends on more than the one number you kept, like which fees were already used.</p>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  // the tour-by-hand walk: take the first night of the best plan, try its neighbour (a mistake), then the rest of the plan
  const B0 = BEST_SET[0];
  LessonKit.define("dp-1d", {
    title: "1-D dynamic programming",
    teaches: ["from-earlier-terms", "take-or-skip"],
    screens: [slowTree, spotTrick, fillRow, asCode1, planByHand, spotChoice, fillTour, asCode2, recognise, toProblems],
    walk: [
      { wrong: ['[data-i="0"]'], right: INNER.map(k => `[data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(ROW_N - 2).fill("[data-right]") },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: [`[data-i="${B0}"]`, `[data-i="${B0 + 1}"]`], right: BEST_SET.slice(1).map(i => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(NN - 1).fill("[data-right]") },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
