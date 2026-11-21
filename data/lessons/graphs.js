/* Lesson: graphs. A corn maze after a storm: which path squares can visitors still reach from the gate (spread
   from the gate, marking each square once, with a list), then the fewest steps from the gate to the scarecrow
   (take the list oldest first and every square's first number is its fewest steps). Every number on screen is
   computed here from MAZE, GATE and GOAL. Plain browser script. */
(() => {
  // a letter = a path square, "#" = corn or a fallen hay bale
  const MAZE = ["A#BC##", "DEFGH#", "I#J###", "KLM#NO", "P###Q#"];
  const GATE = "A", GOAL = "H";
  const R = MAZE.length, C = MAZE[0].length;
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const and = xs => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  const isAre = xs => xs.length === 1 ? "is" : "are";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const POS = {};
  MAZE.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== "#") POS[ch] = [r, c]; }));
  const OPEN = Object.keys(POS).sort(), NOPEN = OPEN.length;
  const at = (r, c) => r >= 0 && r < R && c >= 0 && c < C && MAZE[r][c] !== "#" ? MAZE[r][c] : null;
  // path squares touching a square, in the order up, right, down, left
  const nbs = ch => { const [r, c] = POS[ch]; return [[r - 1, c], [r, c + 1], [r + 1, c], [r, c - 1]].map(([a, b]) => at(a, b)).filter(Boolean); };
  const touch = (a, b) => nbs(a).includes(b);
  const sel = ch => `[data-i="${POS[ch][0]},${POS[ch][1]}"]`;
  const CORN = (() => { for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (MAZE[r][c] === "#") return `[data-i="${r},${c}"]`; return null; })();
  // spreading from the gate with a list, oldest first: the order, each square's number, and what each step marked
  const { ORDER, DIST, STEPS } = (() => {
    const DIST = new Map([[GATE, 0]]), ORDER = [GATE], STEPS = [];
    for (let i = 0; i < ORDER.length; i++) {
      const cur = ORDER[i], old = nbs(cur).filter(n => DIST.has(n)), fresh = nbs(cur).filter(n => !DIST.has(n));
      fresh.forEach(n => { DIST.set(n, DIST.get(cur) + 1); ORDER.push(n); });
      STEPS.push({ cur, old, fresh });
    }
    return { ORDER, DIST, STEPS };
  })();
  const REACH = ORDER.length, CUT = OPEN.filter(ch => !DIST.has(ch));
  const MAXD = Math.max(...DIST.values());
  const LAYERS = Array.from({ length: MAXD + 1 }, (_, d) => ORDER.filter(ch => DIST.get(ch) === d));
  const PASSES = MAXD + 1;                          // passes 1..MAXD mark squares, one more finds nothing
  const PASS_READS = PASSES * NOPEN;
  const LOOKS = ORDER.reduce((s, ch) => s + nbs(ch).length, 0);
  const SIZES = LAYERS.slice(1).map(l => l.length);
  // routes from the gate to the goal that never visit a square twice
  const ROUTES = (() => {
    let n = 0; const on = new Set([GATE]);
    const go = ch => { if (ch === GOAL) { n++; return; } for (const x of nbs(ch)) if (!on.has(x)) { on.add(x); go(x); on.delete(x); } };
    go(GATE); return n;
  })();
  const LOOPS20 = 20;
  // loops (rings of path) among the reachable squares: links minus squares plus one
  const LOOPS = (() => { const reach = OPEN.filter(ch => { const seen = new Set([GATE]), q = [GATE]; for (let i = 0; i < q.length; i++) for (const n of nbs(q[i])) if (!seen.has(n)) { seen.add(n); q.push(n); } return seen.has(ch); }); return reach.reduce((s, ch) => s + nbs(ch).length, 0) / 2 - reach.length + 1; })();
  const GOAL_D = DIST.get(GOAL), GOAL_STEP = STEPS.findIndex(s => s.fresh.includes(GOAL));
  const SPOT = 3;                                   // the spot-the-trick screen stops after this pass
  const BIG = 1000;                                 // starting size for the "bigger maze" slider
  // the "no" case: roads with driving times
  const SHORT_MIN = 2, SHORT_N = 3, LONG_MIN = 10, HUGE_MIN = 90;

  // grid helpers: values per path square, corn as walls
  const rows = val => MAZE.map(row => [...row].map(ch => ch === "#" ? "" : val(ch)));
  const clsOf = st => { const c = {}; MAZE.forEach((row, r) => [...row].forEach((ch, j) => { const s = ch === "#" ? "wall" : st(ch); if (s) c[`${r},${j}`] = s; })); return c; };
  // a legend listing only the marks on the grid right now ("" = a path square with no mark)
  const keyOf = (kit, cls, list) => { const v = Object.values(cls), plain = Object.keys(cls).length < MAZE.length * MAZE[0].length; return kit.pics.key(list.filter(([s]) => s ? v.includes(s) : plain)); };
  const chOf = b => { const [r, c] = b.dataset.i.split(",").map(Number); return MAZE[r][c] === "#" ? null : MAZE[r][c]; };
  const CORN_SAY = "That square is corn or a fallen bale. Nobody can stand there, so it is never marked.";
  const steps = (i, n) => `<div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === n - 1 ? "disabled" : ""}>Next step</button></div>`;

  /* 1. The slow way: passes over the whole map, like ink spreading one square per pass. */
  function passes({ el, done, kit }) {
    const mark = new Map([[GATE, 0]]);
    let k = 1, read = 0, msg = null, fin = false;
    const due = () => OPEN.filter(ch => !mark.has(ch) && nbs(ch).some(n => mark.has(n) && mark.get(n) < k));
    const paint = () => {
      const g = kit.pics.grid(rows(ch => mark.has(ch) ? mark.get(ch) : ""), {
        cls: clsOf(ch => !mark.has(ch) ? "" : fin || mark.get(ch) < k ? "in" : "enter"), pick: !fin });
      el.innerHTML = `<h1>A corn maze after the storm</h1>
        <p class="lead">A farm opens its corn maze tomorrow, but last night's storm knocked hay bales across some paths. Which path squares can a visitor still reach from the gate? The key under the map shows which squares are corn or fallen bales. Two squares touch when they share a side: up, down, left or right, not diagonally. The gate, top left, is marked <b>0</b>. You mark the map the way ink spreads: one pass at a time, and a pass means going over all ${NOPEN} path squares.</p>
        ${fin ? "" : `<p class="task">Pass ${k}: tap every path square that touches a square marked before this pass. Mark it ${k}.</p>`}
        ${g}
        ${kit.pics.key([["wall", "Corn or a fallen bale"], ["", "Path, not marked yet"], ["in", "Marked in an earlier pass"], ["enter", "Marked in this pass"]])}
        <div class="lpanel">
          <div class="sum">${fmt(read)} squares read<small>${NOPEN} for each finished pass</small></div>
          ${fin ? kit.feedback(`Pass ${PASSES} reads all ${NOPEN} squares again and marks nothing, so you stop. <b>${REACH} path squares</b> can be reached from the gate, and the ${CUT.length} in the bottom right are cut off by the bales. It cost ${PASSES} passes × ${NOPEN} = ${fmt(PASS_READS)} squares read to mark ${REACH - 1}, and each pass found only ${Math.min(...SIZES)} to ${Math.max(...SIZES)} new ones.`, true)
            : msg ? kit.feedback(msg[0], msg[1]) : ""}
        </div>`;
      el.querySelectorAll(".lp-gc").forEach(b => b.onclick = () => {
        if (fin) return;
        const ch = chOf(b);
        if (!ch) { msg = [CORN_SAY, false]; paint(); return; }
        if (mark.has(ch)) {
          const p = mark.get(ch);
          msg = p === k ? [`You marked this one in this pass already.`] : [`This square is already marked ${p}${p === 0 ? ": it is the gate" : `, in pass ${p}`}. Each square is marked once.`, false];
          paint(); return;
        }
        if (!due().includes(ch)) {
          const thisPass = nbs(ch).some(n => mark.get(n) === k);
          msg = [thisPass ? `This square only touches a square you marked in this pass. Ink spreads one square per pass, so it gets marked in pass ${k + 1}.`
            : `This square does not touch any marked square yet. Only squares next to the ink can be marked.`, false];
          paint(); return;
        }
        mark.set(ch, k);
        if (due().length) { msg = null; paint(); return; }
        read += NOPEN;
        const got = OPEN.filter(x => mark.get(x) === k).length;
        k++;
        if (!due().length) { read += NOPEN; fin = true; paint(); done(); return; }
        msg = [`Pass ${k - 1} is done: you went over all ${NOPEN} path squares to find ${got} new ${got === 1 ? "one" : "ones"}.`];
        paint();
      });
    };
    paint();
  }

  /* 2. Spot the trick: only the squares marked last have unchecked neighbours. */
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const marked = ORDER.filter(ch => DIST.get(ch) <= SPOT), last = LAYERS[SPOT];
    const older = marked.filter(ch => DIST.get(ch) < SPOT);
    const far = OPEN.filter(ch => !marked.includes(ch) && !nbs(ch).some(n => marked.includes(n)));
    const opts = [`All ${marked.length} marked squares`, `Only the ${last.length} marked ${SPOT}`, "Every path square, as before"];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Where can the ink go next?</h1>
        <p class="lead">The same maze after pass ${SPOT}. ${marked.length} squares are marked, and pass ${SPOT + 1} is next.</p>
        <p class="task">Pass ${SPOT + 1} marks the unmarked squares touching a marked one. Which squares does it need to look around?</p>
        ${kit.pics.grid(rows(ch => DIST.get(ch) <= SPOT ? DIST.get(ch) : ""), { cls: clsOf(ch => DIST.get(ch) <= SPOT ? "in" : "") })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The squares marked 0 to ${SPOT - 1} already had their turn: everything touching them was marked in the pass after. Only the ${last.length} squares marked ${SPOT} have neighbours nobody has checked. So keep a <b>list</b>. When you mark a square, add it to the end. Take squares from the front, one at a time, and look only at the squares touching each one.`, true)
          : ans === 0 ? kit.feedback(`Look at the ${older.length} squares marked 0 to ${SPOT - 1}. Every path square touching them is already marked: that is what the passes after them did. Checking around them again finds nothing new.`, false)
          : kit.feedback(`Going over every path square is the slow way. A square that touches no marked square cannot be marked in this pass, and right now ${far.length} of the ${NOPEN} path squares touch no mark at all, so reading them is wasted. That is where the ${fmt(PASS_READS)} reads went.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Use the list by hand: take the front square, mark its unmarked neighbours. */
  function listByHand({ el, done, kit }) {
    const marked = new Set([GATE]), list = [GATE], pending = new Set();
    let head = 0, looked = 0, msg = null, fin = false, n = BIG;
    const paint = () => {
      const cur = fin ? null : list[head], st = fin ? null : STEPS[head];
      const waiting = list.slice(head + 1);
      const ord = st ? st.fresh.filter(x => pending.has(x)) : [];
      const shown = fin ? [] : [cur, ...waiting, ...ord];
      const cls = clsOf(ch => list.indexOf(ch) > -1 && list.indexOf(ch) < head ? "in" : ch === cur ? "accent" : pending.has(ch) ? "enter" : waiting.includes(ch) ? "next" : "");
      const lcls = {}; shown.forEach((ch, i) => { lcls[i] = i === 0 ? "accent" : pending.has(ch) ? "enter" : "next"; });
      el.innerHTML = `<h1>Keep a list instead</h1>
        <p class="lead">Same maze, and now every path square has a letter. The list starts with the gate, A. Take the square at the front, mark each square touching it that is not marked yet, and add those to the end of the list. Each touching square you check counts as one look, even if it is already marked. The key under the maze says what each mark means.</p>
        ${fin ? "" : `<p class="task">${cur} is at the front of the list. Tap each square touching ${cur} that is not marked yet. If there is none, tap Nothing new.</p>`}
        ${kit.pics.grid(rows(ch => ch), { cls, pick: !fin })}
        ${keyOf(kit, cls, [["wall", "corn or a fallen bale"], ["", "path, not marked yet"], ["accent", "the square you took"], ["enter", "just added to the list"], ["next", "waiting on the list"], ["in", "taken earlier"]])}
        ${fin ? "" : kit.pics.row1d(shown, { cls: lcls, labels: false, ptrs: { 0: "front" }, title: "List" })}
        <div class="lpanel">
          <div class="sum">${looked} looks<small>squares looked at so far</small></div>
          ${fin ? "" : `<div class="lopts"><button type="button" data-none>Nothing new</button></div>`}
          ${msg ? kit.feedback(msg[0], msg[1]) : ""}
          ${fin ? `${kit.meter([{ label: "Passes", value: PASS_READS, max: PASS_READS }, { label: "List", value: LOOKS, max: PASS_READS, good: true }])}
            <div class="sliders"><label>Path squares in a winding maze <input type="range" id="sn" min="2" max="5" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
            <div class="lbig" id="big"></div>` : ""}
        </div>`;
      const step = () => {
        looked += nbs(cur).length;
        list.push(...st.fresh); pending.clear(); head++;
        if (head === list.length) {
          fin = true;
          msg = [`The list is empty. <b>${REACH} squares</b> reached, the same ${REACH} the passes found. Each square was taken once and looked only at the squares touching it: ${LOOKS} looks instead of ${fmt(PASS_READS)} reads, about ${Math.round(PASS_READS / LOOKS)} times fewer. Now make the maze bigger, with one path winding through it:`, true];
          paint(); done(); return;
        }
        msg = [st.fresh.length ? `${cur} is done. ${and(st.fresh)} ${st.fresh.length === 1 ? "joins" : "join"} the end of the list.` : `${cur} is done. Everything touching it was already marked.`];
        paint();
      };
      el.querySelectorAll(".lp-gc").forEach(b => b.onclick = () => {
        if (fin) return;
        const ch = chOf(b);
        if (!ch) { msg = [CORN_SAY, false]; paint(); return; }
        if (ch === cur) { msg = [`That is ${cur} itself, the square you took from the list. Tap the squares touching it.`, false]; paint(); return; }
        if (pending.has(ch)) { msg = [`You already marked ${ch} for ${cur}.`]; paint(); return; }
        if (!touch(cur, ch)) { msg = [`${ch} does not touch ${cur}. Right now you only look at the squares touching ${cur}${waiting.includes(ch) ? `. ${ch} is on the list and gets its own turn later` : ""}.`, false]; paint(); return; }
        if (marked.has(ch)) { msg = [`${ch} touches ${cur}, but it is already marked. Adding it to the list again would make you look at it twice, and the paths here form loops, so you would go round them forever.`, false]; paint(); return; }
        marked.add(ch); pending.add(ch);
        if (st.fresh.every(x => pending.has(x))) { step(); return; }
        msg = null; paint();
      });
      const none = el.querySelector("[data-none]");
      if (none) none.onclick = () => {
        const left = st.fresh.filter(x => !pending.has(x));
        if (left.length) { msg = [`${and(left)} ${isAre(left)} touching ${cur} and not marked yet.`, false]; paint(); return; }
        step();
      };
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        el.querySelector("#big").innerHTML = `${fmt(n * n)} vs ${fmt(4 * n)}<small>reads for the passes, against at most this many looks for the list. One winding path of ${fmt(n)} squares needs ${fmt(n)} passes of ${fmt(n)} reads; the list looks at most 4 times per square. That is about ${fmt(Math.round(n / 4))} times fewer looks.</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The list as code: flood fill. */
  const CODE1 = [
    "const seen = new Set([gate]);",
    "const list = [gate];",
    "for (let i = 0; i < list.length; i++) {",
    "  for (const sq of neighbours(list[i])) {",
    "    if (seen.has(sq)) continue;",
    "    seen.add(sq);",
    "    list.push(sq);",
    "  }",
    "}",
    "return seen.size; // squares you can reach"
  ];
  const FR1 = (() => {
    const fr = [{ ln: 1, i: "–", head: 0, len: 1, say: `<code>seen</code> holds the marked squares and <code>list</code> the order they were marked in. Both start with the gate, A.` }];
    let len = 1;
    STEPS.forEach(({ cur, old, fresh }, i) => {
      len += fresh.length;
      fr.push({ ln: fresh.length ? 6 : 4, i, head: i, len, fresh, say: `i = ${i}: <code>list[${i}]</code> is ${cur}. ${old.length ? `${and(old)} ${isAre(old)} in <code>seen</code> already, so <code>continue</code>. ` : ""}${fresh.length ? `${and(fresh)} ${isAre(fresh)} new: <code>seen.add</code>, then <code>list.push</code>.` : "Nothing new here."}` });
    });
    fr.push({ ln: 9, i: REACH, head: REACH, len: REACH, fin: true, say: `i is ${REACH}, the length of the list, so the loop ends. <code>seen.size</code> is ${REACH}, the squares you marked by hand. ${and(CUT)} never got in.` });
    return fr;
  })();
  function asCode1({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cur = f.fin ? null : ORDER[f.head], fresh = f.fresh || [];
      const cls = clsOf(ch => { const j = ORDER.indexOf(ch); return j < 0 || j >= f.len ? "" : j < f.head || f.fin ? "in" : ch === cur && f.i !== "–" ? "accent" : fresh.includes(ch) ? "enter" : "next"; });
      el.innerHTML = `<h1>The list, written as code</h1>
        <p class="lead"><code>neighbours(sq)</code> gives the path squares touching <code>sq</code>. Reading <code>list[i]</code> with a growing <code>i</code> is taking from the front. Spreading from a start like this is called <b>flood fill</b>.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the maze.</p>
        ${kit.pics.grid(rows(ch => ch), { cls })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>i <b>${f.i}</b></span><span>list[i] <b>${cur && f.i !== "–" ? cur : "–"}</b></span><span>seen.size <b>${f.len}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        ${steps(i, FR1.length)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 5. A second question: the fewest steps to the scarecrow. Trace a route by hand. */
  function traceRoute({ el, done, kit }) {
    const route = [GATE];
    let msg = null, fin = false;
    const paint = () => {
      const end = route[route.length - 1];
      el.innerHTML = `<h1>How far is the scarecrow?</h1>
        <p class="lead">The farmer hides a prize at the scarecrow on square <b>${GOAL}</b>. The sign at the gate should say the fewest steps to it. One step is one move to a touching square.</p>
        ${fin ? "" : `<p class="task">Walk a route from the gate to ${GOAL}: tap one touching square at a time. Tap the last square of your route to step back.</p>`}
        ${kit.pics.grid(rows(ch => ch), { cls: clsOf(ch => route.includes(ch) ? (ch === GOAL ? "enter" : "in") : ch === GOAL ? "accent" : ""), pick: !fin })}
        <div class="lpanel">
          <div class="sum">${plural(route.length - 1, "step")}<small>on your route</small></div>
          ${fin ? kit.feedback(`You reached the scarecrow in ${plural(route.length - 1, "step")}. But is that the fewest? This maze has ${ROUTES} routes from the gate to ${GOAL} that never visit a square twice, so to be sure you would walk all ${ROUTES}. ${2 ** LOOPS === ROUTES ? `This maze has ${LOOPS} loops (rings of path you can walk round), and each loop doubles the routes: ${Array(LOOPS).fill(2).join(" × ")} = ${ROUTES}. ` : "Every loop on the way doubles the routes. "}A maze with ${LOOPS20} loops one after another has 2<sup>${LOOPS20}</sup> = ${fmt(2 ** LOOPS20)}.`, true)
            : msg ? kit.feedback(msg[0], msg[1]) : ""}
        </div>`;
      el.querySelectorAll(".lp-gc").forEach(b => b.onclick = () => {
        if (fin) return;
        const ch = chOf(b);
        if (!ch) { msg = [CORN_SAY.replace(", so it is never marked", ""), false]; paint(); return; }
        if (ch === end && route.length > 1) { route.pop(); msg = [`Stepped back to ${route[route.length - 1]}.`]; paint(); return; }
        if (route.includes(ch)) { msg = [`${ch} is already on your route. Coming back to a square only adds steps. Tap ${end}, the end of your route, to step back.`, false]; paint(); return; }
        if (!touch(end, ch)) { msg = [`${ch} does not touch ${end}, the end of your route. One step moves to a touching square.`, false]; paint(); return; }
        route.push(ch); msg = null;
        if (ch === GOAL) { fin = true; paint(); done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 6. Spot the trick: the pass a square was first marked in is its fewest steps. */
  function spotTrick2({ el, done, kit }) {
    let ans = null;
    const opts = [`No, ${GOAL_D} is the fewest`, `Yes, a route the passes missed could be shorter`, `Cannot tell without walking all ${ROUTES} routes`];
    const correct = 0;
    const back = (() => { const out = [GOAL]; let ch = GOAL; while (DIST.get(ch) > 0) { ch = nbs(ch).find(n => DIST.get(n) === DIST.get(ch) - 1); out.push(ch); } return out.reverse(); })();
    const why = `A route of fewer steps, say ${GOAL_D - 1}, has ${GOAL_D - 1} squares after the gate, each touching the one before, and the last is ${GOAL}. Its 1st square is marked in pass 1 or earlier, its 2nd in pass 2 or earlier, and so on, so ${GOAL} would be marked in pass ${GOAL_D - 1} or earlier.`;
    const paint = () => {
      const ok = ans === correct;
      const c6 = clsOf(ch => !DIST.has(ch) ? "" : ok && back.includes(ch) ? "enter" : ch === GOAL ? "accent" : "in");
      el.innerHTML = `<h1>The passes already knew</h1>
        <p class="lead">These are the numbers from your passes on the first screen. Square ${GOAL}, the scarecrow, was first marked in pass <b>${GOAL_D}</b>.</p>
        <p class="task">Could some route reach ${GOAL} in fewer than ${GOAL_D} steps?</p>
        ${kit.pics.grid(rows(ch => DIST.has(ch) ? DIST.get(ch) : ""), { cls: c6 })}
        ${keyOf(kit, c6, [["wall", "corn or a fallen bale"], ["", "path the passes never reached"], ["in", "marked, with its pass number"], ["accent", `${GOAL}, the scarecrow`], ["enter", `a route of ${GOAL_D} steps`]])}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. ${why} So nothing beats ${GOAL_D}, and a route of exactly ${GOAL_D} exists: step back from ${GOAL} to a touching ${GOAL_D - 1}, then a ${GOAL_D - 2}, down to the gate: the route in the key. <b>Every pass number is the fewest steps.</b><br><br>Also: your list took squares in pass order: all the 1s, then all the 2s, because each square joined the end when a square one pass earlier was taken. So the list can write the numbers as it goes.`, true)
          : ans === 1 ? kit.feedback(`The passes cannot miss a route. ${why} It was first marked in pass ${GOAL_D}, so no such route exists.`, false)
          : kit.feedback(`You do not need the routes. ${why} So no route is shorter than ${GOAL_D}, whatever the routes look like.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. Use it: take waiting squares in the right order; each new square gets one more than the square that found it. */
  function takeOrder({ el, done, kit }) {
    const num = new Map([[GATE, 0]]), taken = new Set();
    let msg = null, fin = false;
    const paint = () => {
      const waiting = [...num.keys()].filter(ch => !taken.has(ch)), low = Math.min(...waiting.map(ch => num.get(ch)));
      const c7 = clsOf(ch => ch === GOAL ? (num.has(ch) ? "enter" : "accent") : taken.has(ch) ? "in" : num.has(ch) ? "next" : "");
      el.innerHTML = `<h1>Write the steps as the list goes</h1>
        <p class="lead">Same maze, new rule: when a square marks a new one, the new square gets <b>one more</b> than the square that found it. The gate is 0. Squares waiting on the list are outlined; the key under the maze shows every mark. The list keeps the order squares got their numbers, so the front square always has the smallest number. The scarecrow is square ${GOAL}.</p>
        ${fin ? "" : `<p class="task">Which waiting square can the list take next? Tap it. Stop when ${GOAL} gets a number.</p>`}
        ${kit.pics.grid(rows(ch => num.has(ch) ? num.get(ch) : ch === GOAL ? GOAL : ""), { cls: c7, pick: !fin })}
        ${keyOf(kit, c7, [["wall", "corn or a fallen bale"], ["", "path, no number yet"], ["in", "taken"], ["next", "waiting on the list"], ["accent", "the scarecrow, no number yet"], ["enter", "the scarecrow, numbered"]])}
        <div class="lpanel">
          ${fin ? kit.feedback(`${GOAL} gets <b>${num.get(GOAL)}</b>: the fewest steps from the gate, the same as its pass number. The sign says ${num.get(GOAL)} steps. You stopped as soon as ${GOAL} got a number, while ${plural(OPEN.filter(ch => DIST.has(ch) && !num.has(ch)).length, "reachable square")} still had no number.`, true)
            : msg ? kit.feedback(msg[0], msg[1]) : ""}
        </div>`;
      el.querySelectorAll(".lp-gc").forEach(b => b.onclick = () => {
        if (fin) return;
        const ch = chOf(b);
        if (!ch) { msg = [CORN_SAY, false]; paint(); return; }
        if (taken.has(ch)) { msg = [`This square has already been taken and has marked its neighbours. Each square is taken once.`, false]; paint(); return; }
        if (!num.has(ch)) { msg = [`${ch === GOAL ? "The scarecrow's square" : "This square"} has no number yet: no square touching it has been taken. Only waiting squares (outlined) can be taken.`, false]; paint(); return; }
        const d = num.get(ch);
        if (d > low) { msg = [`This square has ${d}, but a waiting square with ${low} has not been taken yet. It joined the list earlier, so it leaves first: every ${low} is taken before any ${d}. That order is why the first number a square gets is its fewest steps.`, false]; paint(); return; }
        taken.add(ch);
        const fresh = nbs(ch).filter(n => !num.has(n));
        fresh.forEach(n => num.set(n, d + 1));
        if (num.has(GOAL)) { fin = true; paint(); done(); return; }
        msg = [fresh.length ? `Taken. ${plural(fresh.length, "new square")} ${fresh.length === 1 ? "gets" : "get"} ${d} + 1 = ${d + 1}.` : `Taken. Everything touching it already has a number.`];
        paint();
      });
    };
    paint();
  }

  /* 8. As code: breadth-first search. */
  const CODE2 = [
    "const steps = new Map([[gate, 0]]);",
    "const list = [gate];",
    "for (let i = 0; i < list.length; i++) {",
    "  for (const sq of neighbours(list[i])) {",
    "    if (steps.has(sq)) continue;",
    "    steps.set(sq, steps.get(list[i]) + 1);",
    "    if (sq === goal) return steps.get(sq);",
    "    list.push(sq);",
    "  }",
    "}",
    "return -1; // goal cut off"
  ];
  const FR2 = (() => {
    const fr = [{ ln: 1, i: "–", head: 0, len: 1, say: `<code>steps</code> holds each square's number: the gate, A, is 0. <code>list</code> starts with the gate, as before.` }];
    let len = 1;
    for (let i = 0; i <= GOAL_STEP; i++) {
      const { cur, fresh } = STEPS[i], d = DIST.get(cur);
      // the goal step returns as soon as it reaches the goal, so it only skips squares checked before it
      const old = i === GOAL_STEP ? nbs(cur).slice(0, nbs(cur).indexOf(GOAL)).filter(x => STEPS[i].old.includes(x)) : STEPS[i].old;
      const skip = old.length ? `${and(old)} ${old.length === 1 ? "has" : "have"} a number already, so <code>continue</code>. ` : "";
      if (i === GOAL_STEP) {
        const before = fresh.slice(0, fresh.indexOf(GOAL));
        len += before.length + 1;
        fr.push({ ln: 6, i, head: i, len, fresh: [...before, GOAL], fin: true, say: `i = ${i}: <code>list[${i}]</code> is ${cur}, with ${d}. ${skip}${before.length ? `${and(before)} get${before.length === 1 ? "s" : ""} ${d + 1}. ` : ""}${GOAL} gets ${d} + 1 = ${d + 1}, and ${GOAL} is the goal: return ${d + 1}, the number you wrote by hand.` });
        break;
      }
      len += fresh.length;
      fr.push({ ln: fresh.length ? 7 : 4, i, head: i, len, fresh, say: `i = ${i}: <code>list[${i}]</code> is ${cur}, with ${d}. ${skip}${fresh.length ? `${and(fresh)} get${fresh.length === 1 ? "s" : ""} ${d} + 1 = ${d + 1} and join the list.` : "Nothing new here."}` });
    }
    return fr;
  })();
  function asCode2({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR2[i], cur = f.i === "–" ? null : ORDER[f.head], fresh = f.fresh || [];
      const has = ch => { const j = ORDER.indexOf(ch); return j > -1 && j < f.len; };
      const cls = clsOf(ch => !has(ch) ? (ch === GOAL ? "accent" : "") : ch === GOAL && f.fin ? "enter" : ORDER.indexOf(ch) < f.head ? "in" : ch === cur ? "accent" : fresh.includes(ch) ? "enter" : "next");
      el.innerHTML = `<h1>Fewest steps, written as code</h1>
        <p class="lead">Two changes from the flood fill: a <code>Map</code> keeps each square's number, and the loop stops when the goal gets one. If the list runs out first, the goal is cut off, so the last line returns -1. Each square shows its letter and its number. A list you add to at the back and take from the front is a <b>queue</b>. Spreading like this, all the 1s, then all the 2s, is <b>breadth-first search</b> (BFS).</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the maze.</p>
        ${kit.pics.grid(rows(ch => has(ch) ? `${ch}${DIST.get(ch)}` : ch === GOAL ? GOAL : ""), { cls })}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>i <b>${f.i}</b></span><span>list[i] <b>${cur || "–"}</b></span><span>steps.size <b>${f.len}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        ${steps(i, FR2.length)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 9. Recognise it in new situations. */
  const CASES = [
    ["In a drawing app, the paint bucket fills the shape you tap: every touching pixel of the same colour turns blue, and the fill stops at the outline.", true,
      "Yes, flood fill. Start a list at the tapped pixel and mark each touching pixel of the same colour once. The outline plays the part of the corn.",
      "It is the maze again: pixels are squares and the outline is the corn. Start a list at the tapped pixel and mark each touching pixel of the same colour once."],
    ["A social app shows how many introductions apart you are from someone: a friend is 1, a friend of a friend is 2, and so on.", true,
      "Yes, breadth-first search. You are 0. Take people oldest first, and each new person gets one more than the person who found them. The first number someone gets is the fewest introductions.",
      "Each friendship is one step, like one move between squares. Spread from yourself with the list, oldest first: friends get 1, their new friends 2. The first number a person gets is the fewest introductions."],
    ["A map app wants the quickest drive in minutes. Each road takes its own number of minutes.", false,
      `No. The list finds the fewest roads, not the fewest minutes. If ${SHORT_N} roads of ${SHORT_MIN} minutes (${SHORT_N * SHORT_MIN} in all) and one road of ${LONG_MIN} minutes both lead to the end, the single road gives it the number 1 first, and a first number is never changed. Cutting every road into 1-minute pieces would work, but a ${HUGE_MIN}-minute road would become ${HUGE_MIN} steps. The lesson Advanced graphs shows a method that keeps the roads whole.`,
      `The list counts roads, not minutes. If ${SHORT_N} roads of ${SHORT_MIN} minutes (${SHORT_N * SHORT_MIN} in all) and one road of ${LONG_MIN} minutes both lead to the end, the single road reaches it first and gives it 1, and a first number is never changed. Cutting roads into 1-minute pieces would fix that, but a ${HUGE_MIN}-minute road would become ${HUGE_MIN} steps.`]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would spreading with a list work here?</h1>
        <p class="lead">The maze is a <b>graph</b>: things (squares) joined by links (touching). Pixels joined by touching, or people joined by friendship, are graphs too, so flood fill and BFS work on any graph. The things are called <b>nodes</b> and the links <b>edges</b>. ${WORDS[CASES.length] || CASES.length} situations away from the corn maze.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. On to the problems. */
  const TAUGHT = {
    "grid-flood-fill": "You did this in the corn maze: mark a square once, put it on the list, and look only at the squares touching it.",
    "bfs-fewest-steps": "You did this with the scarecrow: take the oldest square first, and the first number a square gets is its fewest steps."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  const shortest = (() => { const out = [GOAL]; let ch = GOAL; while (DIST.get(ch) > 0) { ch = nbs(ch).find(n => DIST.get(n) === DIST.get(ch) - 1); out.push(ch); } return out.reverse(); })();
  LessonKit.define("graphs", {
    title: "Graphs",
    teaches: ["grid-flood-fill", "bfs-fewest-steps"],
    screens: [passes, spotTrick, listByHand, asCode1, traceRoute, spotTrick2, takeOrder, asCode2, recognise, toProblems],
    walk: [
      { wrong: [CORN], right: LAYERS.slice(1).flat().map(sel) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [CORN], right: STEPS.flatMap(s => s.fresh.length ? s.fresh.map(sel) : ["[data-none]"]) },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: [CORN], right: shortest.slice(1).map(sel) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [CORN], right: ORDER.slice(0, GOAL_STEP + 1).map(sel) },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
