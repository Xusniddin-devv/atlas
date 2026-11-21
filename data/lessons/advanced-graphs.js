/* Lesson: advanced graphs. Island-hopping by ferry to reach the lighthouse island for sunset: crossings take
   different minutes, so the fewest ferries is not the quickest trip. The trick: the closest island not yet
   settled is final, so settle it next and offer its neighbours a time (Dijkstra's algorithm).
   Every number on screen is computed here from ISLANDS, FERRIES and BONUS. Plain browser script. */
(() => {
  const ISLANDS = [
    { id: "H", name: "Harbour", x: 0, y: 1 }, { id: "A", name: "Ash", x: 1, y: 0 }, { id: "B", name: "Bell", x: 1, y: 2 },
    { id: "C", name: "Cove", x: 2, y: 1 }, { id: "D", name: "Dune", x: 3, y: 0 }, { id: "L", name: "Lighthouse", x: 4, y: 1 }
  ];
  const FERRIES = [["H", "A", 4], ["H", "B", 2], ["A", "C", 3], ["B", "C", 8], ["A", "D", 10], ["C", "D", 2], ["C", "L", 10], ["D", "L", 3], ["B", "L", 14]];
  const START = "H", GOAL = "L", NI = ISLANDS.length;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const NAME = Object.fromEntries(ISLANDS.map(i => [i.id, i.name]));
  const nm = id => esc(NAME[id]);
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const ADJ = {};
  ISLANDS.forEach(i => { ADJ[i.id] = []; });
  FERRIES.forEach(([a, b, w]) => { ADJ[a].push([b, w]); ADJ[b].push([a, w]); });
  const mins = (a, b) => FERRIES.find(([x, y]) => (x === a && y === b) || (x === b && y === a))[2];
  const arrow = p => p.map(esc).join(" → ");
  const LEGEND = ISLANDS.map(i => `<b>${esc(i.id)}</b> ${esc(i.name)}`).join(", ");

  // every route from the harbour to the lighthouse that never visits an island twice, in map order
  const ROUTES = (() => {
    const out = [];
    const go = (u, path, t) => {
      if (u === GOAL) { out.push({ path, t, n: path.length - 1 }); return; }
      for (const [v, w] of ADJ[u]) if (!path.includes(v)) go(v, [...path, v], t + w);
    };
    go(START, [START], 0);
    return out;
  })();
  const SLOW = ROUTES.reduce((s, r) => s + r.n, 0);           // additions to time every route
  const BEST = ROUTES.reduce((a, r) => r.t < a.t ? r : a);
  const FEWEST = ROUTES.reduce((a, r) => r.n < a.n || (r.n === a.n && r.t < a.t) ? r : a);
  // how often the first crossing of the best route was added up, across all routes
  const FIRST = [BEST.path[0], BEST.path[1]];
  const FIRST_USES = ROUTES.filter(r => r.path[0] === FIRST[0] && r.path[1] === FIRST[1]).length;
  const pathEdges = (p, s) => Object.fromEntries(p.slice(1).map((v, i) => [`${p[i]}-${v}`, s]));
  const pathNodes = (p, s) => Object.fromEntries(p.map(v => [v, s]));

  // the unsettled island with the smallest known time (the data has no ties)
  const closestOf = (time, done) => {
    let best;
    for (const id of Object.keys(time)) if (!done.has(id) && (best === undefined || time[id] < time[best])) best = id;
    return best;
  };

  const map = (kit, o = {}) => kit.pics.graph(ISLANDS.map(i => ({ id: i.id, x: i.x, y: i.y })), FERRIES, o);

  /* 1. The slow way, by hand: add up every route, then pick the quickest. Totals stay hidden until he picks. */
  const sumOf = r => r.path.slice(1).map((v, i) => mins(r.path[i], v)).join(" + ");
  const BEST_I = ROUTES.indexOf(BEST);
  const MISS_I = ROUTES.findIndex(r => r !== BEST);   // a route that is not the quickest, for the walker
  const ROUTE_TAPS = ROUTES.map((_, i) => `.lopts [data-i="${i}"]`);
  function slowWay({ el, done, kit }) {
    const tried = new Set();
    let cur = null, steps = 0, picking = false, won = false, miss = null;
    const paint = () => {
      const all = tried.size === ROUTES.length;
      const r = won ? BEST : cur == null ? null : ROUTES[cur];
      const pr = miss == null ? null : ROUTES[miss];
      el.innerHTML = `<h1>Ferries to the lighthouse</h1>
        <p class="lead">You are spending a week on a chain of islands, and tonight you want to watch the sunset from the lighthouse. Small ferries cross between the islands. The number on each line is how many minutes that crossing takes. Islands: ${LEGEND}. Adding one crossing to a trip's total counts as one step.</p>
        <p class="task">${won ? `You found the quickest route.` : picking ? `Tap the route you think is quickest.` : all ? `You have seen every route. Add up their minutes, then pick the quickest.` : `Tap each route from ${nm(START)} to ${nm(GOAL)} to see its crossings. Add up the minutes yourself: at the end you pick the quickest.`}</p>
        ${map(kit, { cls: r ? pathNodes(r.path, won ? "enter" : "in") : {}, ecls: r ? pathEdges(r.path, won ? "enter" : "in") : {} })}
        <div class="lpanel">
          ${r && !picking ? `<div class="sum">${sumOf(r)} = ${won || miss === cur ? r.t : "?"} min<small>${plural(r.n, "step")}</small></div>` : ""}
          ${kit.options(ROUTES.map((x, i) => `${arrow(x.path)}${won ? ` <b>${x.t} min</b>` : tried.has(i) ? ` <small>(${sumOf(x)})</small>` : ""}`), won ? { picked: BEST_I, correct: BEST_I } : {})}
          ${all && !won && !picking ? `<div class="lsteps"><button type="button" class="btn" data-pickq>I have added them up: pick the quickest</button></div>` : ""}
          ${won ? kit.feedback(`Right: <b>${arrow(BEST.path)}</b>, ${sumOf(BEST)} = ${BEST.t} minutes. To be sure, you added up all ${ROUTES.length} routes: <b>${steps} steps</b> for ${NI} islands. You added the ${mins(...FIRST)}-minute crossing ${nm(FIRST[0])} → ${nm(FIRST[1])} ${FIRST_USES} times, once for every route that starts with it.`, true)
            : pr ? kit.feedback(`${arrow(pr.path)} adds up to ${sumOf(pr)} = ${pr.t} minutes.${pr.n < BEST.n ? " It has few crossings, but some of them are slow." : ""} Another route takes fewer minutes. Look at the others again, then pick once more.`, false)
            : tried.size && !all ? kit.feedback(`${plural(ROUTES.length - tried.size, "route")} left to see. Steps so far: <b>${steps}</b>.`) : ""}
        </div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (won) return;
        cur = i;
        if (picking) {
          picking = false;
          if (i === BEST_I) { won = true; miss = null; paint(); done(); return; }
          miss = i; paint(); return;
        }
        if (miss !== i) miss = null;
        if (!tried.has(i)) { tried.add(i); steps += ROUTES[i].n; }
        paint();
      });
      const q = el.querySelector("[data-pickq]");
      if (q) q.onclick = () => { picking = true; miss = null; paint(); };
    };
    paint();
  }

  /* 2. Why the fewest ferries is not the quickest: level-by-level search counts crossings, not minutes. */
  function fewestFerries({ el, done, kit }) {
    let ans = null;
    const fs = FEWEST.path.slice(1).map((v, i) => mins(FEWEST.path[i], v)).join(" + ");
    const opts = ["Yes: fewer crossings means less time on the water", `No: a route with more crossings arrives sooner`, "You cannot tell without timing every route again"];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>The fewest ferries</h1>
        <p class="lead">A friend has a shortcut: take the route with the fewest ferries. It is what level-by-level search finds, the kind that first visits every island one crossing away, then two crossings away, and so on. For tonight it picks <b>${arrow(FEWEST.path)}</b>, just ${plural(FEWEST.n, "crossing")}.</p>
        <p class="task">Is your friend's route the quickest way to ${nm(GOAL)}?</p>
        ${map(kit, { cls: ok ? { ...pathNodes(FEWEST.path, "in"), ...pathNodes(BEST.path, "enter") } : pathNodes(FEWEST.path, "in"), ecls: ok ? { ...pathEdges(FEWEST.path, "in"), ...pathEdges(BEST.path, "enter") } : pathEdges(FEWEST.path, "in") })}
        ${kit.pics.key([["in", "your friend's route"], ...(ok ? [["enter", "quickest route"]] : [])])}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. ${arrow(FEWEST.path)} takes ${fs} = ${FEWEST.t} minutes. ${arrow(BEST.path)} uses ${BEST.n} ferries but takes only ${BEST.t}. Level-by-level search treats every crossing as the same size, so it finds the fewest crossings, not the fewest minutes. When steps cost different amounts, you need another rule.`, true)
          : ans === 0 ? kit.feedback(`Count minutes, not ferries. ${arrow(FEWEST.path)} takes ${fs} = ${FEWEST.t} minutes, while ${arrow(BEST.path)} needs ${BEST.n} ferries and takes ${BEST.t}. One slow crossing can outweigh several quick ones.`, false)
          : kit.feedback(`The minutes are on the map, so you can check right now: ${arrow(FEWEST.path)} is ${fs} = ${FEWEST.t} minutes, more than the ${BEST.t} you found on the last screen.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Spot the trick: of the islands one ferry from the harbour, the closest one is already final. */
  const NEAR = ADJ[START].map(([v, w]) => ({ v, w })).sort((a, b) => a.w - b.w);
  const CL = NEAR[0], FAR = NEAR[1];
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const list = [FAR, CL];   // the further island first, so the answer is not the first button
    const opts = [`${nm(FAR.v)}, ${FAR.w} minutes`, `${nm(CL.v)}, ${CL.w} minutes`, "Neither, until every route is timed"];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct;
      const cls = { [START]: "in", [FAR.v]: "next", [CL.v]: ok ? "enter" : "next" };
      el.innerHTML = `<h1>Which time is already final?</h1>
        <p class="lead">Forget the lighthouse for a moment. Straight from ${nm(START)} you can reach ${list.map(o => `${nm(o.v)} in ${o.w} minutes`).join(" or ")}. Other, longer routes also reach both islands. The small number under an island is the quickest time known so far.</p>
        <p class="task">For which island are you already sure of the quickest time, without looking at any other ferry?</p>
        ${map(kit, { cls, ecls: { [`${START}-${CL.v}`]: ok ? "enter" : "in", [`${START}-${FAR.v}`]: "in" }, notes: { [START]: "0", [CL.v]: String(CL.w), [FAR.v]: String(FAR.w) } })}
        ${kit.pics.key([["in", "start"], ["next", "quickest time so far"], ...(ok ? [["enter", "final"]] : [])])}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. Every other way to ${nm(CL.v)} starts with the ${FAR.w}-minute ferry to ${nm(FAR.v)}. That is already more than ${CL.w}. So ${nm(CL.v)} is <b>settled</b>: its time is final. The trick: <b>the closest island not yet settled is always final</b>. Settle it, then let its ferries offer times.`, true)
          : ans === 0 ? kit.feedback(`${nm(FAR.v)} might still be beaten. A route through ${nm(CL.v)} starts at only ${CL.w} minutes. You have not looked at ${nm(CL.v)}'s ferries yet: if one of them reached ${nm(FAR.v)} in under ${FAR.w - CL.w} minutes, that route would beat ${FAR.w}.`, false)
          : kit.feedback(`For ${nm(CL.v)} you can be sure. Every other route to it begins with the ${FAR.w}-minute crossing to ${nm(FAR.v)}, which is already more than ${CL.w}, and no crossing takes less than zero minutes. Nothing can beat ${CL.w}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Settle island after island by hand. The harbour is settled and its ferries are offered, as on screen 3.
     Each turn: pick the island to settle; then, for each ferry from it to an island that already has a time,
     decide which time that island keeps. Ferries into settled islands are skipped. */
  function handStart() {
    const s = { time: { [START]: 0 }, via: {}, done: new Set([START]), pend: [], adds: 0, said: "" };
    for (const [v, w] of ADJ[START]) { s.time[v] = w; s.via[v] = START; s.adds++; }
    return s;
  }
  function settle(s, u) {
    s.done.add(u);
    if (u === GOAL) return;
    const news = [], skip = [];
    for (const [v, w] of ADJ[u]) {
      if (s.done.has(v)) { skip.push(v); continue; }
      const t = s.time[u] + w; s.adds++;
      if (s.time[v] === undefined) { s.time[v] = t; s.via[v] = u; news.push(`${nm(v)} gets ${s.time[u]} + ${w} = <b>${t}</b>`); }
      else s.pend.push({ v, u, w, t, old: s.time[v], oldVia: s.via[v] });
    }
    s.said = `Settled ${nm(u)} at ${s.time[u]}. ${news.length ? news.join(". ") + "." : ""} ${skip.length ? `${skip.map(nm).join(" and ")} ${skip.length === 1 ? "is" : "are"} settled already, so ${skip.length === 1 ? "that ferry is" : "those ferries are"} skipped.` : ""}`;
  }
  function decide(s) {
    const p = s.pend.shift();
    if (p.t < p.old) { s.time[p.v] = p.t; s.via[p.v] = p.u; s.said = `${nm(p.v)} now has ${p.t}, via ${nm(p.u)}.`; }
    else s.said = `${nm(p.v)} keeps ${p.old}, via ${nm(p.oldVia)}.`;
  }
  // the learner's right moves, for the walker: island ids to settle and "cmp" decisions
  const HAND = (() => {
    const s = handStart(), moves = [];
    while (!s.done.has(GOAL)) {
      if (s.pend.length) { moves.push("cmp"); decide(s); continue; }
      const u = closestOf(s.time, s.done); moves.push(u); settle(s, u);
    }
    return { moves, adds: s.adds, via: s.via, time: s.time };
  })();
  const routeTo = (via, v) => { const p = [v]; while (p[0] !== START) p.unshift(via[p[0]]); return p; };
  // square maps of k x k islands, ferries between neighbours: every route corner to corner, and its additions
  const GRID = {};
  const gridCount = k => {
    if (GRID[k]) return GRID[k];
    const adj = Array.from({ length: k * k }, () => []), id = (r, c) => r * k + c;
    for (let r = 0; r < k; r++) for (let c = 0; c < k; c++) {
      if (c + 1 < k) { adj[id(r, c)].push(id(r, c + 1)); adj[id(r, c + 1)].push(id(r, c)); }
      if (r + 1 < k) { adj[id(r, c)].push(id(r + 1, c)); adj[id(r + 1, c)].push(id(r, c)); }
    }
    let routes = 0, adds = 0;
    const seen = new Uint8Array(k * k), end = k * k - 1;
    const go = (u, d) => { if (u === end) { routes++; adds += d; return; } seen[u] = 1; for (const v of adj[u]) if (!seen[v]) go(v, d + 1); seen[u] = 0; };
    go(0, 0);
    return (GRID[k] = { routes, adds, ferries: 2 * k * (k - 1) });
  };
  function byHand({ el, done, kit }) {
    const s = handStart();
    let wrong = null, miss = null, k = 3;
    const paint = () => {
      const fin = s.done.has(GOAL), p = s.pend[0] || null;
      const cls = {}, ecls = {}, notes = {};
      ISLANDS.forEach(({ id }) => {
        if (s.time[id] !== undefined) notes[id] = String(s.time[id]);
        cls[id] = s.done.has(id) ? "in" : s.time[id] !== undefined ? "next" : "";
        if (s.via[id] && s.time[id] !== undefined) ecls[`${s.via[id]}-${id}`] = s.done.has(id) ? "in" : "";
      });
      if (fin) { const r = routeTo(s.via, GOAL); Object.assign(cls, pathNodes(r, "enter")); Object.assign(ecls, pathEdges(r, "enter")); }
      if (p) ecls[`${p.u}-${p.v}`] = "enter";
      if (miss) cls[miss] = "no";
      const rows = ISLANDS.filter(i => s.time[i.id] !== undefined).map(i => [i.name, `${s.time[i.id]}${i.id === START ? " start" : ` via ${s.via[i.id]}`}${s.done.has(i.id) ? ", final" : ""}`]);
      const cmpOpts = p ? [`Keep ${p.old} (via ${nm(p.oldVia)})`, `Change to ${p.t} (via ${nm(p.u)})`] : [];
      const cmpRight = p ? (p.t < p.old ? 1 : 0) : null;
      const pickable = id => !fin && !p && !s.done.has(id);
      el.innerHTML = `<h1>Settle the closest island, again and again</h1>
        <p class="lead">${nm(START)} is settled at 0, and its ferries gave ${NEAR.map(o => `${nm(o.v)} ${o.w}`).join(" and ")}. Closest means the smallest total time from ${nm(START)}: the number under the island, not the length of one ferry. Each ferry time you add counts as one step.</p>
        ${fin ? "" : p ? `<p class="task">${nm(p.u)} offers ${nm(p.v)} ${s.time[p.u]} + ${p.w} = ${p.t} minutes. ${nm(p.v)} already has ${p.old}, via ${nm(p.oldVia)}. Which time does ${nm(p.v)} keep?</p>`
          : `<p class="task">Tap the island to settle next.</p>`}
        ${map(kit, { cls, ecls, notes, pick: pickable })}
        ${kit.pics.key([["in", "settled: time is final"], ["next", "time might still drop"], ...(fin ? [["enter", "quickest route"]] : [])])}
        ${kit.table(rows, { head: ["island", "quickest so far"], title: "Times so far" })}
        <div class="lpanel">${p ? kit.options(cmpOpts, { picked: wrong, correct: cmpRight }) : ""}
        ${wrong != null && p ? kit.feedback(cmpRight === 1
            ? `${p.t} is quicker than ${p.old}. The trip via ${nm(p.u)} reaches ${nm(p.v)} sooner, so the island takes the smaller time.`
            : `${p.t} is slower than the ${p.old} ${nm(p.v)} already has via ${nm(p.oldVia)}. A slower offer is ignored.`, false)
          : miss ? kit.feedback(s.time[miss] === undefined
            ? `No ferry from a settled island reaches ${nm(miss)} yet, so it has no time at all. Pick one of the outlined islands.`
            : `${nm(miss)} has ${s.time[miss]}, but ${nm(closestOf(s.time, s.done))} has only ${s.time[closestOf(s.time, s.done)]}. A route through ${nm(closestOf(s.time, s.done))} could still reach ${nm(miss)} in under ${s.time[miss]}, so that time is not final yet. Settle the smallest time first.`, false)
          : fin ? kit.feedback(`${nm(GOAL)} is settled at <b>${s.time[GOAL]} minutes</b>: ${arrow(routeTo(s.via, GOAL))}, the route you found by timing everything.${s.done.size === NI ? " Every island is settled now." : ""} This time you added ${plural(s.adds, "ferry time")} instead of ${SLOW}. Now make the map bigger:`, true)
          : s.said ? kit.feedback(s.said) : ""}
        ${fin ? `${kit.meter([{ label: "Time every route", value: SLOW, max: SLOW }, { label: "Settle the closest first", value: s.adds, max: SLOW, good: true }])}
          <div class="sliders"><label>Islands on each side of the map <input type="range" id="sk" min="3" max="5" step="1" value="${k}"><b id="skv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lp-node").forEach(b => { if (b.tagName === "BUTTON") b.onclick = () => {
        const id = b.dataset.i, c = closestOf(s.time, s.done);
        wrong = null;
        if (id !== c) { miss = id; paint(); return; }
        miss = null; settle(s, id); paint();
        if (s.done.has(GOAL)) done();
      }; });
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== cmpRight) { wrong = i; paint(); return; }
        wrong = null; miss = null; decide(s); paint();
      });
      const sk = el.querySelector("#sk");
      if (!sk) return;
      const upd = () => {
        const g = gridCount(k), n = k * k;
        el.querySelector("#skv").textContent = `${k} × ${k} = ${n}`;
        const r = g.adds / g.ferries;
        el.querySelector("#big").innerHTML = `${fmt(g.adds)} vs ${fmt(g.ferries)}<small>On a square map, each island has a ferry to its neighbours above, below, left and right. Timing all ${fmt(g.routes)} routes from one corner to the far corner takes ${fmt(g.adds)} steps. Settling the closest island first takes at most one step per ferry line: ${fmt(g.ferries)}. That is about ${fmt(Math.round(r))} times fewer steps, and every extra row of islands multiplies the routes.</small>`;
      };
      sk.oninput = () => { k = +sk.value; upd(); };
      upd();
    };
    paint();
  }

  /* 5. The same moves as code: Dijkstra's algorithm. The code checks every ferry, settled islands too. */
  const CODE = [
    `const time = { ${START}: 0 }, done = new Set();`,
    "while (true) {",
    "  const u = closest(time, done);",
    `  if (u === "${GOAL}") return time.${GOAL};`,
    "  done.add(u);",
    "  for (const [v, mins] of ferries[u]) {",
    "    const t = time[u] + mins;",
    "    time[v] = Math.min(time[v] ?? t, t);",
    "  }",
    "}"
  ];
  const FR = (() => {
    const time = { [START]: 0 }, done = new Set(), fr = [];
    const snap = o => ({ time: { ...time }, done: new Set(done), u: "–", v: "–", t: "–", ...o });
    fr.push(snap({ ln: 0, say: `<code>time</code> holds the quickest time known for each island: only ${nm(START)}, at 0. <code>done</code> is the settled islands, none yet. In graph words, islands are nodes, ferries are edges, and the minutes are edge weights.` }));
    let firstU = true, firstV = true, firstSkip = true;
    for (;;) {
      const u = closestOf(time, done);
      if (u === GOAL) { fr.push(snap({ ln: 3, u, say: `<code>closest</code> gives ${esc(u)} (${time[u]}). It is ${nm(GOAL)}, so return <b>${time[u]}</b>: the same ${HAND.time[GOAL]} minutes you settled by hand. Level-by-level search, from screen 2, is called breadth-first search (BFS).` })); break; }
      fr.push(snap({ ln: 2, u, say: `<code>closest</code> looks through <code>time</code> for the smallest island not in <code>done</code>: ${esc(u)} (${time[u]}).${firstU ? ` Unlike your hand version, the code settles ${nm(START)} itself too.` : ""}` }));
      firstU = false;
      done.add(u);
      fr.push(snap({ ln: 4, u, say: `<code>done.add(u)</code> settles ${esc(u)}: its time of ${time[u]} minutes is final, so its circle on the map fills in.` }));
      for (const [v, w] of ADJ[u]) {
        const t = time[u] + w, old = time[v], upd = old === undefined || t < old;
        if (upd) time[v] = t;
        fr.push(snap({ ln: 7, u, v, t, edge: `${u}-${v}`, say: (firstV ? `v is the island at the other end of a ferry from u. ` : "") + (old === undefined ? `v = ${esc(v)}: t = ${time[u]} + ${w} = ${t}. ${esc(v)} had no time yet (<code>?? t</code>), so it gets ${t}.`
          : upd ? `v = ${esc(v)}: t = ${time[u]} + ${w} = ${t}, less than ${old}. ${esc(v)} drops to ${t}.`
          : done.has(v) ? `v = ${esc(v)}: t = ${time[u]} + ${w} = ${t}, not less than ${old}. ${esc(v)} is settled, and a settled time never improves.${firstSkip ? " Your hand version skipped such ferries; the code checks them, and <code>Math.min</code> just keeps the time." : ""}`
          : `v = ${esc(v)}: t = ${time[u]} + ${w} = ${t}, not less than ${old}. ${esc(v)} keeps ${old}.`) }));
        if (done.has(v)) firstSkip = false;
        firstV = false;
      }
    }
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR[i], cls = {}, notes = {}, ecls = {};
      ISLANDS.forEach(({ id }) => {
        if (f.time[id] !== undefined) notes[id] = String(f.time[id]);
        cls[id] = f.done.has(id) ? "in" : f.time[id] !== undefined ? "next" : "";
      });
      if (f.edge) ecls[f.edge] = "enter";
      if (f.ln === 3) cls[f.u] = "enter";
      if (f.ln === 2) cls[f.u] = "accent";
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">What you just did has a name: <b>Dijkstra's algorithm</b>. <code>u</code> is the island being settled, and <code>ferries[u]</code> lists its ferries as [v, minutes]. Each step below says what changes on the map.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the map.</p>
        ${map(kit, { cls, notes, ecls })}
        ${kit.code(CODE, f.ln)}
        <div class="vars"><span>u <b>${esc(f.u)}</b></span><span>v <b>${esc(f.v)}</b></span><span>t <b>${f.t}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. Recognise it in new situations, including one where settling the closest first gives a wrong answer. */
  const BONUS = { a: 3, b: 4, ba: -2 };   // home→A 3, home→B 4, B→A pays a bonus of 2
  const CASES = [
    ["A delivery drone hops between charging pads. Each hop uses a different amount of battery. Find the least battery needed to reach every pad from the depot.", true,
      "Yes. Battery per hop is a cost that is never below zero, so the closest pad not yet settled is final. Settle pads one by one; the times become battery amounts.",
      "Each hop costs a different amount, and no hop gives battery back. That is the ferry map again: settle the pad with the least battery so far, then offer its neighbours a total."],
    ["In a board game, every move to a neighbouring square costs exactly one turn. Find the fewest turns to the finish.", true,
      "Yes. It works, and with every step costing the same, the closest square is always one more level out, so it settles squares in the same order as level-by-level search. Here the simpler search is enough.",
      "It still gives the right answer. With every step costing 1, settling the closest square first visits squares in the same order as level-by-level search, so both find the fewest turns. Level-by-level search only goes wrong when steps cost different amounts."],
    [`A ride-share map where some streets pay you a bonus, so their cost is below zero. Find the cheapest trip from home to the airport.`, false,
      `No. Settling relies on every later step adding cost. Say home → A costs ${BONUS.a}, home → B costs ${BONUS.b}, and the street B → A pays ${-BONUS.ba}. Closest first settles A at ${BONUS.a}, but home → B → A costs ${BONUS.b} − ${-BONUS.ba} = ${BONUS.b + BONUS.ba}. A settled price turned out wrong.`,
      `Try it: home → A costs ${BONUS.a}, home → B costs ${BONUS.b}, and the street B → A pays you ${-BONUS.ba}. Closest first settles A at ${BONUS.a} and never looks again, yet home → B → A costs ${BONUS.b} − ${-BONUS.ba} = ${BONUS.b + BONUS.ba}. "Nothing can beat the closest" holds only when no step can make a trip cheaper.`]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would settling the closest first work here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations without ferries. The question each time: does settling the closest place first give the right answer?</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 7. On to the problems: the group this lesson taught first. */
  const TAUGHT = { "weighted-shortest-paths": "You did this with the ferries: settle the closest island not yet settled, then offer its neighbours a quicker time." };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  LessonKit.define("advanced-graphs", {
    title: "Advanced graphs",
    teaches: ["weighted-shortest-paths"],
    screens: [slowWay, fewestFerries, spotTrick, byHand, asCode, recognise, toProblems],
    walk: [
      { wrong: [...ROUTE_TAPS, "[data-pickq]", `.lopts [data-i="${MISS_I}"]`], right: [...ROUTE_TAPS, "[data-pickq]", `.lopts [data-i="${BEST_I}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`.lp-node[data-i="${FAR.v}"]`], right: HAND.moves.map(m => m === "cmp" ? ".lopts [data-right]" : `.lp-node[data-i="${m}"]`) },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
