/* Lesson: backtracking. A drawer of leftover stamps and a parcel that needs exact postage: build every group
   of stamps in one fixed order (choose, explore, undo), then cut every branch whose total already passes the
   postage. Every number on screen is computed here from STAMPS and POSTAGE. Plain browser script. */
(() => {
  const STAMPS = [1, 3, 4, 6], POSTAGE = 7, N = STAMPS.length;   // sorted from cheapest up: the cut relies on it
  const GROUPS = 2 ** N - 1;                                      // non-empty groups
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const sumOf = g => g.reduce((a, i) => a + STAMPS[i], 0);
  const gtxt = g => g.length ? g.map(i => STAMPS[i]).join(" + ") : "the empty envelope";
  const expr = g => g.length > 1 ? `${gtxt(g)} = ${sumOf(g)}` : `${sumOf(g)}`;
  const key = g => "g" + g.join("");
  const sel = g => `[data-i="${key(g)}"]`;
  const listTxt = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const thenTxt = a => a.map((v, j) => j === 0 ? `${v}` : `${j === a.length - 1 ? ", then" : ","} the ${v}`).join("");

  // every group, in index order; the groups that pay exactly the postage
  const ALL = [];
  (function all(pre, from) { for (let j = from; j < N; j++) { const g = [...pre, j]; ALL.push(g); all(g, j + 1); } })([], 0);
  const SOLS = ALL.filter(g => sumOf(g) === POSTAGE);
  const SOLTXT = listTxt(SOLS.map(gtxt));

  // the walk as events: visit (a stamp put on), pop (taken off), cut (break: stamp j and every later one skipped)
  function walk(prune) {
    const ev = [], env = [];
    (function rec(from, total) {
      if (prune && total === POSTAGE) { if (from < N) ev.push({ t: "cut", g: env.slice(), j: from, hit: true }); return; }
      for (let i = from; i < N; i++) {
        if (prune && total + STAMPS[i] > POSTAGE) { ev.push({ t: "cut", g: env.slice(), j: i }); break; }
        env.push(i); ev.push({ t: "visit", g: env.slice() });
        rec(i + 1, total + STAMPS[i]);
        env.pop(); ev.push({ t: "pop", g: env.slice(), j: i });
      }
    })(0, 0);
    return ev;
  }
  const FULL = walk(false), CUT = walk(true);
  const ORDER = FULL.filter(e => e.t === "visit").map(e => e.g);
  const PORDER = CUT.filter(e => e.t === "visit").map(e => e.g);
  const startsWith = (g, pre) => pre.every((x, k) => g[k] === x);
  const cutSet = e => ALL.filter(g => g.length > e.g.length && startsWith(g, e.g) && g[e.g.length] >= e.j);
  const CUTS = CUT.filter(e => e.t === "cut");
  const FIRSTCUT = CUTS.find(e => !e.hit);
  const FIRSTCUTSET = cutSet(FIRSTCUT);
  const cutOf = g => CUTS.find(e => cutSet(e).some(h => key(h) === key(g)));

  // the tree of every group: a child adds one stamp that comes after the last one (key "g" + indices)
  const TREE = (function node(pre) {
    const from = pre.length ? pre[pre.length - 1] + 1 : 0;
    return { v: pre.length ? STAMPS[pre[pre.length - 1]] : "", id: key(pre), kids: Array.from({ length: N - from }, (_, k) => node([...pre, from + k])) };
  })([]);
  // tree states: visited nodes dark (a working group green), totals as notes, the path to the envelope's group in bold
  function treeOpts(visited, cur, extra = {}) {
    const cls = {}, notes = { g: "=0" };
    visited.forEach(g => { cls[key(g)] = sumOf(g) === POSTAGE ? "enter" : "in"; notes[key(g)] = `=${sumOf(g)}`; });
    cls.g = "in";
    return { cls: { ...cls, ...(extra.cls || {}) }, notes: { ...notes, ...(extra.notes || {}) }, edges: Object.fromEntries(cur.map((_, l) => [key(cur.slice(0, l + 1)), "in"])), pick: extra.pick || false };
  }
  // what happens between two visits, in plain words (events after visit a, up to and including visit a+1)
  function narrate(ev, k) {
    let seen = -1, out = [], pops = [], firstPop = true;
    for (const e of ev) {
      if (e.t === "visit") { seen++; if (seen === k) { const s = STAMPS[e.g[e.g.length - 1]]; if (pops.length) out.push(`Take off the ${thenTxt(pops)}.`); out.push(`Put on the ${s}: ${e.g.length > 1 ? expr(e.g) : `total ${s}`}${sumOf(e.g) === POSTAGE ? `, exactly ${POSTAGE}. A group that works.` : "."}`); return out.join(" "); } continue; }
      if (seen !== k - 1) continue;
      if (e.t === "cut") {
        if (pops.length) { out.push(`Take off the ${thenTxt(pops)}.`); pops = []; }
        const s = STAMPS[e.j], more = e.j < N - 1;
        out.push(e.hit ? `${gtxt(e.g)} is exactly ${POSTAGE}, and more stamps only add, so stop there.`
          : `The ${s} would make ${sumOf(e.g) + s}, over ${POSTAGE}: cut${more ? `, with every stamp after it` : ""}.`);
      } else if (e.t === "pop") {
        if (firstPop && !out.length && ev.length && STAMPS[e.j] === STAMPS[N - 1]) out.push(`Nothing comes after the ${STAMPS[N - 1]}.`);
        firstPop = false;
        pops.push(STAMPS[e.j]);
      }
    }
    return out.join(" ");
  }
  // the events that happened before visit k (cuts only), for drawing cut branches faint
  function cutsBefore(k) {
    let seen = -1; const out = [];
    for (const e of CUT) { if (e.t === "visit") { seen++; if (seen >= k) break; } else if (e.t === "cut") out.push(e); }
    return out;
  }

  /* 1. The slow way: try groups of stamps by hand, with no system. */
  function slowWay({ el, done, kit }) {
    const on = new Set(), tried = new Map(), found = new Set();
    let msg = null, checks = 0, repeats = 0, fin = false;
    const paint = () => {
      const g = [...on].sort((a, b) => a - b), cls = {};
      g.forEach(i => { cls[i] = "in"; });
      el.innerHTML = `<h1>Exact postage from a drawer of stamps</h1>
        <p class="lead">A parcel needs exactly <b>${POSTAGE}</b> in postage. Paying more is wasted and paying less sends it back. Your drawer holds ${WORDS[N].toLowerCase()} leftover stamps, one of each: ${listTxt(STAMPS)}. Before you stick anything on, you want <b>every</b> group of stamps that pays exactly ${POSTAGE}, so you can choose which stamps to keep.</p>
        <p class="task">Tap stamps to put them on the envelope (filled) or take them off. Press Check to add up the group. Find every group that makes ${POSTAGE}.</p>
        ${kit.cells(STAMPS, { cls, pick: !fin })}
        <div class="vars"><span>envelope <b>${g.length ? expr(g) : "empty"}</b></span></div>
        <div class="lsteps"><button type="button" class="btn" id="chk" ${fin ? "disabled" : ""}>Check this group</button></div>
        <div class="lpanel">
          ${tried.size ? `<div class="tried">${[...tried].map(([k, s]) => `<span class="${s === POSTAGE ? "top1" : ""}">${k} <b>${s}</b></span>`).join("")}</div>` : ""}
          ${fin ? kit.feedback(`You found ${SOLTXT}, after ${plural(checks, "check")}${repeats ? `, ${plural(repeats, "repeat")} among them` : ""}. But are those really all? You have seen ${tried.size} of the ${GROUPS} groups ${WORDS[N].toLowerCase()} stamps can make, and nothing tells you which ones you skipped. Each stamp is either on or off: ${Array(N).fill(2).join(" × ")} = ${2 ** N} ways, minus the empty envelope, is ${GROUPS}. To be sure, you need an order that reaches every group once. Twenty stamps double the count twenty times: ${fmt(2 ** 20 - 1)} groups.`, true)
            : msg ? kit.feedback(msg) : ""}
        </div>`;
      el.querySelectorAll("button.cell").forEach(b => b.onclick = () => { const i = +b.dataset.i; on.has(i) ? on.delete(i) : on.add(i); msg = null; paint(); });
      el.querySelector("#chk").onclick = () => {
        if (!g.length) { msg = "The envelope is empty. Put at least one stamp on first."; paint(); return; }
        const k = gtxt(g), s = sumOf(g);
        checks++;
        if (tried.has(k)) { repeats++; msg = `You already checked ${k}. It still makes ${s}. A repeat costs a check and teaches nothing new.`; }
        else {
          tried.set(k, s);
          if (s === POSTAGE) found.add(k);
          msg = s === POSTAGE ? `${expr(g)}. That works. Are there others?` : `${expr(g)}, ${s < POSTAGE ? `${POSTAGE - s} short` : `${s - POSTAGE} too much`}.`;
        }
        if (found.size === SOLS.length) fin = true;
        paint();
        if (fin) done();
      };
    };
    paint();
  }

  /* 2. Spot the trick: a fixed order that reaches every group once. */
  const GREEDY = (() => { const g = []; let t = 0; for (let i = N - 1; i >= 0; i--) if (t + STAMPS[i] <= POSTAGE) { g.push(i); t += STAMPS[i]; } return g.sort((a, b) => a - b); })();
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const [a, b] = SOLS.find(g => g.length === 2) || [0, 1];
    const missed = SOLS.filter(g => key(g) !== key(GREEDY));
    const opts = ["Try groups at random, and stop once a long run of the groups you try are all ones you checked before",
      `Start with the biggest stamp, then keep adding the biggest stamp that does not take the total past ${POSTAGE}`,
      "Keep the stamps in a fixed order, and only ever add a stamp that comes after the last one you added"];
    const correct = 2;
    const paint = () => {
      el.innerHTML = `<h1>A plan that misses nothing</h1>
        <p class="lead">The stamps lie in the drawer from cheapest to most expensive: ${listTxt(STAMPS)}. You want a way to build groups that reaches every group, and builds none of them twice.</p>
        <p class="task">Which plan does that?</p>
        ${kit.cells(STAMPS, { cls: ans === correct ? { [a]: "in", [b]: "in" } : {} })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Then ${STAMPS[a]} and ${STAMPS[b]} can only be built as ${STAMPS[a]}, then ${STAMPS[b]}, never as ${STAMPS[b]}, then ${STAMPS[a]}, so no group is built twice. And every group has exactly one such order, so none is missed. You will put a stamp on, see what can follow it, then take it back off and try the next.`, true)
          : ans === 0 ? kit.feedback("A run of repeats only tells you about groups you have already seen. A group you never thought of never shows up as a repeat, so a long run of them proves nothing.", false)
          : kit.feedback(`Biggest first builds ${expr(GREEDY)} and stops. It never builds ${listTxt(missed.map(gtxt))}, which ${missed.length === 1 ? "also works" : "also work"}. It finds at most one group, not all of them.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => { ans = +bt.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Walk the tree of groups by hand: predict which group the order builds next. */
  function walkTree({ el, done, kit }) {
    let k = 0, wrong = null, said = null;
    const paint = () => {
      const visited = ORDER.slice(0, k), cur = k ? ORDER[k - 1] : [], fin = k === ORDER.length;
      const vis = new Set(visited.map(key));
      const o = treeOpts(visited, fin ? [] : cur, { pick: fin ? false : kk => kk !== "g" && !vis.has(kk), cls: wrong ? { [key(wrong.g)]: "no" } : {} });
      el.innerHTML = `<h1>Every group, in one order</h1>
        <p class="lead">The top circle is the empty envelope. Each circle below it is a group: read the stamps on the path from the top down to it. A circle only adds a stamp that comes after the one above it. The number under a circle is the group's total. The key under the tree shows which groups are built and which pay exactly ${POSTAGE}. The bold path leads to the group on the envelope now.</p>
        ${fin ? "" : `<p class="task">The envelope holds ${k ? expr(cur) : "nothing yet"}. Tap the group the plan builds next.</p>`}
        ${kit.pics.tree(TREE, o)}
        ${kit.pics.key([...(fin ? [] : [["", "not built yet"]]), ["in", "built"], ["enter", `pays exactly ${POSTAGE}`], ["no", "not the next group"]].filter(([st]) => !st || Object.values(o.cls).includes(st)))}
        <div class="vars"><span>envelope <b>${k && !fin ? gtxt(cur) : "empty"}</b></span><span>groups built <b>${k} / ${GROUPS}</b></span></div>
        <div class="lpanel">
        ${wrong ? kit.feedback(wrong.say, false)
          : fin ? kit.feedback(`All ${GROUPS} groups, each built once, and the two that work are the ones you found by hand: ${SOLTXT}. You never had to remember which groups you had tried: the order did it. The moves have a name, <b>backtracking</b>: choose a stamp, explore every group that starts that way, then undo it and choose the next.`, true)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll("button.lp-node").forEach(b => b.onclick = () => {
        const g = ALL.find(h => key(h) === b.dataset.i), nx = ORDER[k];
        if (key(g) === key(nx)) { said = narrate(FULL, k); wrong = null; k++; paint(); if (k === ORDER.length) done(); return; }
        const nxChild = nx.length === cur.length + 1 && startsWith(nx, cur), last = cur.length ? STAMPS[cur[cur.length - 1]] : null;
        let say;
        if (startsWith(g, cur) && g.length === cur.length + 1) say = `The group ${gtxt(g)} skips ahead. ${last == null ? "Start with the first stamp" : `After the ${last}, put on the very next stamp first`}: the ${STAMPS[nx[nx.length - 1]]}. Groups further right, like ${gtxt(g)}, come only after every group that starts with ${gtxt(nx)} is built.`;
        else if (startsWith(g, cur)) say = `${gtxt(g)} puts on more than one stamp at once, so the groups in between would be skipped. Put on one stamp at a time.`;
        else if (nxChild) say = `${gtxt(cur)} is not finished yet: the ${STAMPS[nx[nx.length - 1]]} can still go after the ${last}. Explore from the current group before you go anywhere else.`;
        else say = `Nothing more can go on ${gtxt(cur)}${cur[cur.length - 1] === N - 1 ? `: the ${STAMPS[N - 1]} is the last stamp` : ""}. Back up: take stamps off until one can be swapped for a later stamp. That builds a group that comes before ${gtxt(g)} in the order.`;
        wrong = { g, say }; paint();
      });
    };
    paint();
  }

  /* 4. Spot the second trick: a total that is already over can be cut, with everything after it. */
  function spotCut({ el, done, kit }) {
    let ans = null;
    const pre = FIRSTCUT.g, cand = [...pre, FIRSTCUT.j], over = sumOf(cand), s = STAMPS[FIRSTCUT.j];
    const later = STAMPS.slice(FIRSTCUT.j + 1);
    const visited = ALL.filter(g => g.length <= pre.length && startsWith(pre, g));
    const opts = [`Skip the ${s}, but still try ${later.length ? `the ${listTxt(later)}` : "the rest"}`, `Stop: no group that starts ${gtxt(pre)} and adds the ${s} or a later stamp can make ${POSTAGE}`, "Keep going: a later stamp might bring the total back down"];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct, cls = {}, notes = { [key(cand)]: `=${over}` };
      if (ok) FIRSTCUTSET.forEach(g => { cls[key(g)] = "leave"; notes[key(g)] = `=${sumOf(g)}`; });
      else cls[key(cand)] = "accent";
      el.innerHTML = `<h1>A total that is already too much</h1>
        <p class="lead">Same drawer, same order, and now one more idea. The envelope holds ${expr(pre)}. The next stamp to try is the ${s}, which makes <b>${over}</b>, over ${POSTAGE}. The ringed circle is the ${s} you are about to try.</p>
        <p class="task">What should the walk do from here?</p>
        ${kit.pics.tree(TREE, treeOpts(visited, pre, { cls, notes }))}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The stamps are sorted, so every stamp after the ${s} costs more, and stamps only ever add. One check rules out ${plural(FIRSTCUTSET.length, "group")}: ${listTxt(FIRSTCUTSET.map(g => `${gtxt(g)} (${sumOf(g)})`))}. The struck-through circles are that branch: the ${s} and everything below it${later.length ? `, plus the later ${listTxt(later)}` : ""}. Taking a whole branch off the tree like this is called <b>pruning</b>.`, true)
          : ans === 0 ? kit.feedback(`The stamps lie in order of value, so ${later.length ? `the ${listTxt(later)} ${later.length === 1 ? "costs" : "cost"} more than the ${s}: ${listTxt(later.map((v, j) => `${gtxt(pre)} + ${v} = ${sumOf(pre) + v}`))}, even further over` : "nothing comes after it"}. Once one stamp is too much, every later stamp is too.`, false)
          : kit.feedback(`Every stamp has a value above 0, so putting one on can only raise the total. Once it passes ${POSTAGE}, it never comes back down.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => { ans = +bt.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 5. Walk again with cuts: predict the next group the walk still builds. Then feel the saving at real sizes. */
  const countCut = (n, goal) => { let c = 0; (function rec(from, t) { if (t === goal) return; for (let v = from; v <= n; v++) { if (t + v > goal) break; c++; rec(v + 1, t + v); } })(1, 0); return c; };
  function walkCut({ el, done, kit }) {
    let k = 0, wrong = null, said = null, n = 20;
    const paint = () => {
      const visited = PORDER.slice(0, k), cur = k ? PORDER[k - 1] : [], fin = k === PORDER.length;
      const vis = new Set(visited.map(key)), gone = new Set();
      // cuts made before the current group was built are shown; the learner has to see the next ones coming
      (fin ? CUTS : k ? cutsBefore(k - 1) : []).forEach(e => cutSet(e).forEach(g => gone.add(key(g))));
      const cls = {};
      gone.forEach(kk => { cls[kk] = "gone"; });
      if (wrong) cls[key(wrong.g)] = "no";
      const o = treeOpts(visited, fin ? [] : cur, { cls, pick: fin ? false : kk => kk !== "g" && !vis.has(kk) && !gone.has(kk) });
      el.innerHTML = `<h1>Walk again, and cut as you go</h1>
        <p class="lead">Same tree, same order. This time, before putting a stamp on, check the new total. Over ${POSTAGE}: cut that branch and every later stamp. Exactly ${POSTAGE}: keep the group and stop adding. Cut groups fade out.</p>
        ${fin ? "" : `<p class="task">The envelope holds ${k ? expr(cur) : "nothing yet"}. Tap the next group the walk still builds.</p>`}
        ${kit.pics.tree(TREE, o)}
        <div class="vars"><span>envelope <b>${k && !fin ? gtxt(cur) : "empty"}</b></span><span>groups built <b>${k}</b></span><span>cut <b>${gone.size}</b></span></div>
        <div class="lpanel">
        ${wrong ? kit.feedback(wrong.say, false)
          : fin ? kit.feedback(`Done: ${PORDER.length} groups built instead of ${GROUPS}, and still both answers, ${SOLTXT}. Every group left out was over ${POSTAGE}, and each was ruled out by a check on a shorter group, without ever being built. Use this when you need every answer and the choices limit each other, like stamps sharing one postage.`, true)
          : said ? kit.feedback(said) : ""}
        ${fin ? `${kit.meter([{ label: "Every group", value: GROUPS, max: GROUPS }, { label: "With cuts", value: PORDER.length, max: GROUPS, good: true }])}
          <div class="sliders"><label>Drag to change the drawer: n stamps worth 1, 2, 3 … n, and postage n <input type="range" id="sn" min="1" max="6" step="1" value="${n / 5}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll("button.lp-node").forEach(b => b.onclick = () => {
        const g = ALL.find(h => key(h) === b.dataset.i), nx = PORDER[k];
        if (key(g) === key(nx)) { said = narrate(CUT, k); wrong = null; k++; paint(); if (k === PORDER.length) done(); return; }
        const inWalk = PORDER.some(h => key(h) === key(g)), c = cutOf(g);
        let say;
        if (!inWalk) {
          say = c.hit ? `${expr(g)}, over ${POSTAGE}. The walk never builds it: ${gtxt(c.g)} already makes exactly ${POSTAGE}, and more stamps only add.`
            : `${expr(g)}, over ${POSTAGE}. The walk never builds it: at ${gtxt(c.g)}, the ${STAMPS[c.j]} already makes ${sumOf(c.g) + STAMPS[c.j]}, so that branch is cut${c.j < N - 1 ? " with every later stamp" : ""}.`;
        } else if (startsWith(g, cur) && g.length > cur.length + 1) say = `${gtxt(g)} puts on more than one stamp at once. Put on one stamp at a time, checking the total each time.`;
        else say = `${gtxt(g)} is built, but later. The walk always finishes every group that starts like the current one before it moves right. Check the stamps that can still go on ${k ? gtxt(cur) : "the envelope"}, and back up only when none of them fits.`;
        wrong = { g, say }; paint();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = `n = ${n}`;
        const all = 2 ** n - 1, cut = countCut(n, n);
        el.querySelector("#big").innerHTML = `${fmt(all)} vs ${fmt(cut)}<small>groups built when trying every group, against cutting as soon as the total passes the postage. Same walk and same cut, just a bigger drawer: about ${fmt(Math.round(all / cut))} times fewer groups. The cut only saves work when totals pass the limit early; if they rarely do, the walk still builds nearly every group.</small>`;
      };
      sn.oninput = () => { n = 5 * +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 6. The same moves as code, stepped against the drawer. */
  const CODE = [
    "function build(from, total) {",
    "  if (total === postage) return save();",
    "  for (let i = from; i < n; i++) {",
    "    const s = stamps[i];",
    "    if (total + s > postage) break; // cut",
    "    env.push(s);             // choose",
    "    build(i + 1, total + s); // explore",
    "    env.pop();               // undo",
    "  }",
    "}"
  ];
  const FR = (() => {
    const env = [], found = [], fr = [];
    const snap = (o) => fr.push({ env: env.slice(), found: found.map(g => g.slice()), total: sumOf(env), ...o });
    snap({ ln: 0, say: "build(0, 0): the envelope is empty, the total is 0, and every stamp may come next." });
    (function rec(from, total) {
      if (total === POSTAGE) { found.push(env.slice()); snap({ ln: 1, hit: true, say: `total is ${POSTAGE}: save() keeps ${gtxt(env)}, and return. More stamps would only add.` }); return; }
      for (let i = from; i < N; i++) {
        const s = STAMPS[i];
        if (total + s > POSTAGE) { snap({ ln: 4, i, cut: i, say: `i = ${i}. total + s = ${total} + ${s} = ${total + s}, over ${POSTAGE}. break: the ${s}${i < N - 1 ? " and every stamp after it are" : " is"} cut.` }); break; }
        env.push(i);
        snap({ ln: 5, i, say: `i = ${i}. Choose the ${s}: the envelope holds ${expr(env)}. The next line then explores every group that starts this way.` });
        rec(i + 1, total + s);
        const was = gtxt(env);
        env.pop();
        snap({ ln: 7, i, say: `Back from exploring ${was}. Undo: take off the ${s}.` });
      }
    })(0, 0);
    snap({ ln: 9, say: `build(0, 0) is done. found holds ${SOLTXT}: the groups you found by hand, after putting on a stamp ${PORDER.length} times: the ${PORDER.length} groups built on the tree.` });
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR[i], cls = {};
      f.env.forEach(j => { cls[j] = "in"; });
      if (f.cut != null) for (let j = f.cut; j < N; j++) cls[j] = "gone";
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead"><code>stamps</code> is the drawer, cheapest first, and <code>n</code> is how many. <code>env</code> is the envelope, and <code>save()</code> puts a copy of it into <code>found</code>. <code>from</code> is the first stamp still allowed: after choosing stamp <code>i</code>, the next call starts at <code>i&nbsp;+&nbsp;1</code>, so only later stamps can follow. Each call first checks whether the envelope already pays exactly the postage. The walk starts with <code>build(0, 0)</code>.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the drawer.</p>
        ${kit.cells(STAMPS, { cls, ptrs: f.i != null ? { [f.i]: "i" } : {} })}
        ${kit.code(CODE, f.ln)}
        <div class="vars"><span>env <b>[${f.env.map(j => STAMPS[j]).join(", ")}]</b></span><span>total <b>${f.total}</b></span><span>found <b>${f.found.length ? f.found.map(g => `[${g.map(j => STAMPS[j]).join(", ")}]`).join(" ") : "none"}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. Recognise it in new situations, including one where trying groups is pointless. */
  const BIGN = 40;
  const CASES = [
    ["A sandwich bar has 8 fillings, each with its calories. List every sandwich, with each filling used at most once, that stays under 600 calories.", true,
      "Yes. Each filling is in or out, and fillings are only added after the last one, so no sandwich is built twice. Sort them by calories and cut a branch the moment it passes 600.",
      "This is the stamp drawer again: a group of items, each used at most once, under a limit, and you want every group. Add fillings in a fixed order, take the last back off, and cut as soon as the total passes 600."],
    [`A list of ${BIGN} numbers, some below 0. Choose the group of them with the largest total.`, false,
      `No. It is a group of items, but no choice depends on another: a number above 0 raises the total whatever else is in the group, and a number below 0 lowers it. So decide each number on its own in one pass: take it if it is above 0. Trying groups would build up to ${fmt(2 ** BIGN - 1)} of them to reach the same answer.`,
      `It is a group of items, but no choice depends on any other: a number above 0 raises the total whatever else is in the group, and one below 0 lowers it. No cut can help, because nothing goes over a limit. Take every number above 0 in one pass instead of building up to ${fmt(2 ** BIGN - 1)} groups.`],
    ["You hold the letter tiles R, A, T, E and S. List every real word you can lay down, each tile at most once, and give up on a start as soon as no word begins with it.", true,
      "Yes, as a variant you will meet in the problems. Order matters here, so any unused tile can go next, not only later ones: mark a tile used as it goes down and free it as it comes back. A start like RT begins no word, so its whole branch is cut.",
      "It is a variant you will meet in the problems. It looks different because the order of the tiles matters, but it is the same walk: lay a tile, explore, pick it back up. The cut is a start that begins no word, like RT, which removes every word that would start with it."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would backtracking fit here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations without stamps. Backtracking means: build a choice one piece at a time, explore, undo, and cut branches that cannot work. Only adding later items is one way to choose; the core is choose, explore, undo, and the next item may come from any rule that fits the problem.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 8. On to the problems: the group this lesson taught first. */
  const TAUGHT = {
    "subsets-and-combinations": "You did this with the stamps: only add stamps after the last one, take it back off, and cut once the total is too much.",
    "orderings": "Like the letter tiles: any unused tile can go next; mark it on the way in and free it on the way out."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  const lastSol = SOLS.length - 1;
  LessonKit.define("backtracking", {
    title: "Backtracking",
    teaches: ["subsets-and-combinations"],
    screens: [slowWay, spotTrick, walkTree, spotCut, walkCut, asCode, recognise, toProblems],
    walk: [
      { right: SOLS.flatMap((g, k) => [...g.map(i => `[data-i="${i}"]`), "#chk", ...(k < lastSol ? g.map(i => `[data-i="${i}"]`) : [])]) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [sel(ORDER[ORDER.length - 1])], right: ORDER.map(sel) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [sel(FIRSTCUTSET[0])], right: PORDER.map(sel) },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
