/* Lesson: trees. A rowing club's cancel-practice text chain: each rower forwards the text to at most two others.
   First idea: a rower's answer is built from the answers of the two below (how many minutes their part of the chain
   takes). Second idea: a waiting line that hands out the tree minute by minute (level by level).
   Every number on screen is computed here from NAMES. Plain browser script. */
(() => {
  // node key = heap position: root 0, children of k are 2k+1 (left) and 2k+2 (right)
  const NAMES = { 0: "Kim", 1: "Ana", 2: "Bo", 3: "Cal", 5: "Dev", 6: "Eva", 11: "Fin", 12: "Gus", 14: "Hal" };
  const KEYS = Object.keys(NAMES).map(Number).sort((a, b) => a - b), N = KEYS.length;
  const has = k => NAMES[k] !== undefined;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const raw = k => NAMES[k];      // plain text, for helpers that escape (tree, cells, table, options via kit.esc)
  const nm = k => esc(NAMES[k]);  // escaped, for names written straight into HTML
  const kids = k => [2 * k + 1, 2 * k + 2].filter(has);
  const parent = k => Math.floor((k - 1) / 2);
  const depth = k => Math.floor(Math.log2(k + 1));
  const build = k => has(k) ? { v: raw(k), l: build(2 * k + 1), r: build(2 * k + 2) } : null;
  const ROOT = build(0);
  const LEAVES = KEYS.filter(k => !kids(k).length), INNER = KEYS.filter(k => kids(k).length);
  const FORWARDS = N - 1;
  const route = k => { const r = [k]; while (r[0] !== 0) r.unshift(parent(r[0])); return r; };
  // minutes a rower's part of the chain takes after they hear: 0 for nobody to forward to, else 1 + the slower callee
  const MIN = {};
  const calc = k => { const c = kids(k).map(calc); MIN[k] = c.length ? 1 + Math.max(...c) : 0; return MIN[k]; };
  calc(0);
  const TOTAL = MIN[0];
  const SLOW = LEAVES.reduce((a, k) => a + depth(k), 0);       // forwards counted when every route is traced from Kim
  const POST = (() => { const o = []; const go = k => { kids(k).forEach(go); o.push(k); }; go(0); return o; })();
  const POST_INNER = POST.filter(k => kids(k).length);
  const LAST = LEAVES.filter(k => depth(k) === TOTAL);
  const MINUTES = Array.from({ length: TOTAL + 1 }, (_, m) => KEYS.filter(k => depth(k) === m));
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const andList = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const minTxt = m => `${m} min`;
  const edgeKey = k => k; // an edge is named by the child it leads to

  /* 1. The slow way: trace the route from Kim to every rower at the end of a chain. */
  function slowWay({ el, done, kit }) {
    const counted = {}, traced = [];
    let steps = 0, msg = null;
    const paint = () => {
      const all = traced.length === LEAVES.length, cls = {}, edges = {}, notes = {};
      traced.forEach(k => { cls[k] = all && LAST.includes(k) ? "enter" : "in"; notes[k] = `minute ${depth(k)}`; });
      const cur = traced[traced.length - 1];
      if (cur != null && !all) route(cur).forEach(k => { if (k) edges[k] = "in"; cls[k] = cls[k] || "in"; });
      if (msg && msg[2] != null) cls[msg[2]] = "no";
      const labels = {};
      Object.entries(counted).forEach(([k, c]) => { labels[k] = `${c}×`; });
      el.innerHTML = `<h1>Practice is cancelled. Who hears last?</h1>
        <p class="lead">The rowing club has a text chain. Coach Kim starts it, and each rower forwards the text to at most two others. Each line in the picture is one forward, and a forward takes one minute. Both forwards from the same rower happen in the same minute. Counting one forward along a route is one step.</p>
        <p class="task">Tap every rower who forwards to nobody. The route from Kim to them gets traced and counted. Find who hears last.</p>
        ${kit.pics.tree(ROOT, { layout: "inorder", cls, edges, edgeLabels: labels, notes, pick: true, title: "the small number on a line: times you counted that forward" })}
        <div class="lpanel">
          ${traced.length ? `<div class="sum">${plural(steps, "step")}<small>forwards counted so far</small></div>` : ""}
          ${all ? kit.feedback(`${andList(LAST.map(nm))} hear last, in minute <b>${TOTAL}</b>. To be sure, you traced every route: <b>${steps} steps</b>, but the chain only has ${FORWARDS} forwards. The forward from ${nm(0)} to ${nm(2)} was counted ${counted[2]} times, once for every route that passes through it. A chain like this, where everyone hears from exactly one person, is called a <b>tree</b>. ${nm(0)} is the <b>root</b>, each rower is a <b>node</b>, the rowers someone texts are their <b>children</b>, and rowers who forward to nobody are <b>leaves</b>.`, true)
            : msg ? kit.feedback(msg[0], msg[1]) : ""}
        </div>`;
      el.querySelectorAll("button.lp-node").forEach(b => b.onclick = () => {
        const k = +b.dataset.i;
        if (kids(k).length) {
          msg = [k === 0 ? `${nm(0)} starts the chain, so everyone hears after her. A route ends at a rower who forwards to nobody.`
            : `${nm(k)} forwards to ${andList(kids(k).map(nm))}, so ${kids(k).length > 1 ? "they hear" : "that rower hears"} after ${nm(k)}. A route ends at a rower who forwards to nobody.`, false, k];
        } else if (traced.includes(k)) {
          msg = [`You already traced the route to ${nm(k)}. ${plural(LEAVES.length - traced.length, "rower")} at the end of a chain still to go.`];
        } else {
          traced.push(k); steps += depth(k);
          route(k).forEach(c => { if (c) counted[edgeKey(c)] = (counted[edgeKey(c)] || 0) + 1; });
          msg = [`${route(k).map(nm).join(" → ")}: ${plural(depth(k), "forward")}, so ${nm(k)} hears in minute ${depth(k)}. ${plural(LEAVES.length - traced.length, "rower")} at the end of a chain still to go.`];
        }
        paint();
        if (traced.length === LEAVES.length) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: Kim only needs one number from each of her two rowers. */
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const [a, b] = kids(0), ma = MIN[a], mb = MIN[b];
    const right = 1 + Math.max(ma, mb), slower = Math.max(ma, mb), both = 1 + ma + mb;
    const opts = [right, slower, both].filter((v, i, x) => x.indexOf(v) === i).sort((p, q) => p - q);
    const partOf = k => { const o = []; const go = c => { o.push(c); kids(c).forEach(go); }; go(k); return o; };
    const paint = () => {
      const ok = ans === right, cls = {}, notes = { [a]: minTxt(ma), [b]: minTxt(mb) };
      cls[a] = cls[b] = "in";
      if (ok) { cls[0] = "enter"; notes[0] = minTxt(right); }
      el.innerHTML = `<h1>Ask from below instead</h1>
        <p class="lead">Turn it around. Each rower reports one number up the chain: how many minutes their part takes after they hear. ${nm(a)}'s part (${andList(partOf(a).map(nm))}) takes <b>${ma}</b>. ${nm(b)}'s part takes <b>${mb}</b>.</p>
        <p class="task">From ${nm(0)}'s first text, how many minutes until everyone has heard?</p>
        ${kit.pics.tree(ROOT, { layout: "inorder", cls, notes, ptrs: ok ? {} : { 0: "?" } })}
        <div class="lpanel">${kit.options(opts.map(String), { picked: ans == null ? null : opts.indexOf(ans), correct: opts.indexOf(right), num: true })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. ${nm(0)}'s text takes 1 minute to reach ${nm(a)} and ${nm(b)}. Their parts then run at the same time, so ${nm(0)} only waits for the slower one: <b>1 + max(${ma}, ${mb}) = ${right}</b>. The same answer you traced by hand, and ${nm(0)} never looked past her own two rowers.`, true)
          : ans === slower ? kit.feedback(`${slower} is how long ${nm(ma > mb ? a : b)}'s part takes after ${nm(ma > mb ? a : b)} hears. First ${nm(0)}'s text has to reach ${nm(ma > mb ? a : b)}, and that takes one more minute.`, false)
          : kit.feedback(`That adds ${ma} and ${mb} as if ${nm(b)}'s part waited for ${nm(a)}'s to finish. Both parts run at the same time, so ${nm(0)} only waits for the slower one.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => { ans = opts[+bt.dataset.i]; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 3. Fill in every rower from the bottom up: pick who can answer, then predict their number. */
  const bushySteps = n => { let s = 0; for (let i = 0; i < n; i++) if (2 * i + 1 >= n) s += Math.floor(Math.log2(i + 1)); return s; };
  // long and thin: every rower on the spine forwards to one rower who stops and one who carries on
  const thinSteps = n => { let s = 0; for (let j = 1; j < n; j++) { const leaf = j % 2 === 1 || j === n - 1; if (leaf) s += Math.ceil(j / 2); } return s; };
  function fromBelow({ el, done, kit }) {
    const known = {};
    LEAVES.forEach(k => { known[k] = 0; });
    let cur = null, wrong = null, msg = null, n = 1000;
    const ready = k => kids(k).every(c => known[c] !== undefined);
    const paint = () => {
      const fin = known[0] !== undefined, cls = {}, notes = {};
      Object.entries(known).forEach(([k, v]) => { notes[k] = minTxt(v); cls[k] = "in"; });
      if (cur != null) cls[cur] = "accent";
      if (msg && msg[2] != null) cls[msg[2]] = "no";
      if (fin) cls[0] = "enter";
      const c = cur == null ? [] : kids(cur).map(x => known[x]);
      const right = cur == null ? 0 : 1 + Math.max(...c), slower = cur == null ? 0 : Math.max(...c), sum = cur == null ? 0 : 1 + c.reduce((p, q) => p + q, 0);
      const opts = cur == null ? [] : [right, slower, sum].filter((v, i, x) => x.indexOf(v) === i).sort((p, q) => p - q);
      const done1 = Object.keys(known).length;
      el.innerHTML = `<h1>Every rower answers from below</h1>
        <p class="lead">Same chain. A leaf (a rower who forwards to nobody) reports <b>0</b> minutes. Everyone else waits for the reports of their children, the rowers they text, then answers.</p>
        ${fin ? "" : cur == null ? `<p class="task">Tap a rower who can answer now: everyone they text already shows a number.</p>` : `<p class="task">${andList(kids(cur).map(x => `${nm(x)} reports ${known[x]}`))}. What does ${nm(cur)} report?</p>`}
        ${kit.pics.tree(ROOT, { layout: "inorder", cls, notes, pick: fin || cur != null ? false : k => known[k] === undefined })}
        <div class="lpanel">${cur == null ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong != null ? kit.feedback(wrong === slower
            ? `That leaves out ${nm(cur)}'s own forward. ${andList(kids(cur).map(nm))} first need one minute to get ${nm(cur)}'s text.`
            : `${andList(kids(cur).map(nm))}'s parts run at the same time, not one after the other. ${nm(cur)} only waits for the slower one.`, false)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}
        ${fin ? `${kit.meter([{ label: "Tracing every route", value: SLOW, max: SLOW }, { label: "Asking from below", value: N, max: SLOW, good: true }])}
          <div class="sliders"><label>Rowers in the chain <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll("button.lp-node").forEach(b => b.onclick = () => {
        const k = +b.dataset.i;
        if (!ready(k)) {
          const wait = kids(k).filter(x => known[x] === undefined).map(nm);
          msg = [`${nm(k)} cannot answer yet: ${andList(wait)} ${wait.length > 1 ? "have" : "has"} not reported. Start lower down, with a rower whose texted rowers all show a number.`, false, k];
          paint(); return;
        }
        cur = k; msg = null; wrong = null; paint();
      });
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => {
        const v = opts[+bt.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        known[cur] = v; wrong = null;
        msg = cur === 0
          ? [`${nm(0)} reports <b>${v}</b>: everyone has heard by minute ${v}, as you traced. Every rower answered once, from ${kids(0).length} numbers at most. That is ${N} answers, against the ${SLOW} forwards you counted by tracing. Count each answer, and each counted forward, as one step. Now make the club bigger:`, true]
          : [`${nm(cur)} reports ${v}: 1 + max(${c.join(", ")}). ${plural(N - done1 - 1, "rower")} still to answer.`];
        cur = null; paint();
        if (known[0] !== undefined) done();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const t = thinSteps(n), bu = bushySteps(n);
        const say = (x, what) => `${what}: tracing ${fmt(x)} steps, from below ${fmt(n)}. ${x / n >= 1.2 ? `From below takes about ${x / n < 3 ? (x / n).toFixed(1) : fmt(Math.round(x / n))} times fewer steps.` : "About the same."}`;
        el.querySelector("#big").innerHTML = `${fmt(n)} steps<small>asking from below: one answer per rower, whatever the shape.${[say(t, "Long, thin chain"), say(bu, "Bushy chain, every rower forwarding to two"), "Tracing counts a shared forward again for every route through it."].map(s => `<span style="display:block;margin-top:8px">${s}</span>`).join("")}</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same moves as code: each call asks its rowers first, then answers. */
  const CODE1 = [
    "function minutes(r) {",
    "  let most = 0;",
    "  for (const texted of [r.left, r.right]) {",
    "    if (texted === null) continue;",
    "    const below = minutes(texted);",
    "    most = Math.max(most, 1 + below);",
    "  }",
    "  return most;",
    "}",
    "minutes(kim);"
  ];
  const FR1 = (() => {
    const fr = [], notes = {}, stack = [];
    let first5 = true;
    const snap = (o) => fr.push({ ...o, notes: { ...notes }, stack: stack.slice() });
    const sim = k => {
      stack.push(k);
      const c = kids(k);
      if (!c.length) {
        notes[k] = minTxt(0);
        snap({ ln: 7, cur: k, most: 0, say: `minutes(${nm(k)}): ${nm(k)} forwards to nobody, so both sides are <code>null</code> and get skipped. Return 0.` });
        stack.pop(); return 0;
      }
      const none = 2 - c.length;
      snap({ ln: 1, cur: k, most: 0, say: `${k === 0 ? "<code>minutes(r)</code> is rower <code>r</code>'s report. Each rower is an object: <code>r.left</code> and <code>r.right</code> are the two rowers <code>r</code> texts, or <code>null</code> when there is nobody. <code>minutes</code> calls itself for each of them, and a function that calls itself is called <b>recursion</b>. " : ""}minutes(${nm(k)}) starts with most = 0. Before answering, it asks ${andList(c.map(nm))}${none ? ` (the other side is <code>null</code>, skipped)` : ""}. ${nm(k)} waits.` });
      let most = 0;
      c.forEach(x => {
        const r = sim(x), nmost = Math.max(most, 1 + r);
        snap({ ln: 5, cur: k, most: nmost, say: `${nm(x)} returned below = ${r} to ${nm(k)}. most = max(${most}, 1 + ${r}) = ${nmost}.${first5 ? " Same as 1 + the slower report: adding 1 to each report before taking the max gives the same number." : ""}` });
        first5 = false;
        most = nmost;
      });
      notes[k] = minTxt(most);
      stack.pop();
      if (k === 0) snap({ ln: 9, cur: k, most, fin: true, say: `minutes(${nm(0)}) returns <b>${most}</b>: everyone has heard by minute ${most}. Each rower was asked exactly once, and every rower answered only after the rowers they text, as you did by hand.` });
      return most;
    };
    sim(0);
    return fr;
  })();
  function asCode1({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cls = {};
      f.stack.forEach(k => { cls[k] = "in"; });
      cls[f.cur] = f.fin ? "enter" : "accent";
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="task">Step through the code to the end. Match the highlighted line to the chain.</p>
        ${kit.pics.tree(ROOT, { layout: "inorder", cls, notes: f.notes })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>rower <b>${nm(f.cur)}</b></span><span>most <b>${f.most}</b></span><span>waiting <b>${f.stack.length > 1 ? f.stack.slice(0, -1).map(nm).join(", ") : "nobody"}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* The waiting line, run in order: who leaves the front, and the line after their rowers join the back. */
  const BFS = (() => {
    const out = []; let line = [0];
    while (line.length) { const k = line.shift(); out.push({ k, before: [k, ...line] }); line = [...line, ...kids(k)]; }
    return out;
  })();
  // the second-idea question: the first time the front rower forwards while someone from an earlier minute waits behind
  const ASK = BFS.find(s => kids(s.k).length && s.before.slice(1).some(x => depth(x) === depth(s.k)));
  const lineCells = (keys, front, extra = {}) => ({ values: keys.map(raw), cls: Object.fromEntries(keys.map((k, i) => [i, extra[k] || "in"])), labels: keys.map(k => `min ${depth(k)}`), ptrs: front ? { 0: "front" } : {} });

  /* 5. Spot the second trick: newcomers join the back of the line. */
  function lineTrick({ el, done, kit }) {
    let ans = null;
    const k = ASK.k, behind = ASK.before.slice(1), c = kids(k), heard = BFS.slice(0, BFS.indexOf(ASK)).map(s => s.k);
    const later = behind[0];
    const opts = [`At the back, behind ${andList(behind.map(raw))}`, `At the front, ahead of ${andList(behind.map(raw))}`, `Nowhere: ${andList(c.map(raw))} already ${c.length > 1 ? "have" : "has"} the text`];
    const grand = c.find(x => kids(x).length);
    const paint = () => {
      const ok = ans === 0, cls = {};
      heard.forEach(x => { cls[x] = "gone"; });
      cls[k] = ok ? "gone" : "accent"; behind.forEach(x => { cls[x] = "in"; });
      if (ok) c.forEach(x => { cls[x] = "enter"; });
      const now = ok ? [...behind, ...c] : ASK.before;
      const L = lineCells(now, true, ok ? Object.fromEntries(c.map(x => [x, "next"])) : {});
      el.innerHTML = `<h1>A waiting line, minute by minute</h1>
        <p class="lead">A new question. The coach wants a sheet that lists rowers by the minute they hear, without working out anyone's minute first. Keep a line of rowers who have heard but are not on the sheet yet. The one at the front goes on the sheet, forwards to their rowers (if any), then leaves. It started with ${nm(0)} alone in the line. She went on the sheet, texted ${andList(kids(0).map(nm))}, and they joined${heard.length > 1 ? `. Then the line kept going` : ""}. Struck-through rowers are already on the sheet.</p>
        <p class="task">${nm(k)} is at the front and forwards to ${andList(c.map(nm))}. Where ${c.length > 1 ? "do they" : `does ${nm(c[0])}`} join the line?</p>
        ${kit.pics.tree(ROOT, { layout: "inorder", cls })}
        <div class="lp-cap">the line</div>
        ${kit.cells(L.values, { cls: L.cls, labels: L.labels, ptrs: L.ptrs })}
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct: 0 })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. ${nm(later)} heard in minute ${depth(later)}, and ${andList(c.map(nm))} ${c.length > 1 ? "hear" : "hears"} in minute ${depth(c[0])}. Joining at the back keeps the line in the order people heard, so it hands out the chain one minute at a time. A line where people join at the back and leave from the front is called a <b>queue</b>.`, true)
          : ans === 1 ? kit.feedback(`Then ${nm(c[0])} (minute ${depth(c[0])}) would leave the front before ${nm(later)} (minute ${depth(later)}), and the sheet would list a minute-${depth(c[0])} rower ahead of a minute-${depth(later)} one. Whoever heard first must leave first.`, false)
          : kit.feedback(`${andList(c.map(nm))} ${c.length > 1 ? "have" : "has"} the text, but a rower goes on the sheet when they leave the front, and that is also when they forward. Skip the line and ${andList(c.map(nm))} ${c.length > 1 ? "are" : "is"} never written down${grand != null ? `, and ${andList(kids(grand).map(nm))} never hear` : ""}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => { ans = +bt.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 6. Run the line yourself, one minute at a time: tap who joins, in line order. */
  function runLine({ el, done, kit }) {
    let m = 0, joined = [], msg = null, fin = false;
    const sheet = [];
    const paint = () => {
      const now = MINUTES[m] || [], expect = now.flatMap(kids), batchDone = joined.length === expect.length;
      const heard = new Set([...MINUTES.slice(0, m + 1).flat(), ...joined]);
      const cls = {};
      KEYS.forEach(k => { if (depth(k) < m && !fin) cls[k] = "gone"; });
      now.forEach(k => { if (!fin) cls[k] = "in"; });
      joined.forEach(k => { cls[k] = "enter"; });
      if (msg && msg[2] != null) cls[msg[2]] = "no";
      const lineKeys = fin ? [] : [...now, ...joined];
      const L = lineCells(lineKeys, true, Object.fromEntries(joined.map(k => [k, "next"])));
      const rows = (fin ? sheet : [...sheet, now]).map((r, i) => [`minute ${i}`, r.map(raw).join(", ")]);
      el.innerHTML = `<h1>Run the line yourself</h1>
        <p class="lead">Same chain, from the start. Each minute, everyone in the line goes on the sheet as one row, forwards to their rowers (if any) and leaves the front. The rowers they text join at the back, in the order of the rowers who texted them. When one rower texts two, the one on the left joins first.</p>
        ${fin ? "" : `<p class="task">Minute ${m}: ${andList(now.map(nm))} ${now.length > 1 ? "forward" : "forwards"}. ${expect.length ? (batchDone ? "Everyone has joined. Move on to the next minute." : "Tap the rowers who join the back, in line order.") : `${now.length > 1 ? "They forward" : `${nm(now[0])} forwards`} to nobody, so nobody joins. Move on.`}</p>`}
        ${kit.pics.tree(ROOT, { layout: "inorder", cls, pick: fin || batchDone ? false : k => !heard.has(k) })}
        ${fin ? "" : `<div class="lp-cap">the line</div>`}
        ${fin ? "" : kit.cells(L.values, { cls: L.cls, labels: L.labels, ptrs: L.ptrs })}
        ${kit.table(rows, { head: ["minute", "rowers who hear"], title: "The coach's sheet", fresh: rows.length - 1, empty: "nothing written yet" })}
        <div class="lpanel">${msg ? kit.feedback(msg[0], msg[1]) : ""}
        ${!fin && batchDone ? `<div class="lsteps"><button type="button" class="btn" data-next>Next minute</button></div>` : ""}</div>`;
      el.querySelectorAll("button.lp-node").forEach(b => b.onclick = () => {
        const k = +b.dataset.i, want = expect[joined.length], p = parent(k);
        if (k === want) { joined.push(k); msg = [`${nm(k)} joins the back: ${nm(p)} texted ${nm(k)}.`]; paint(); return; }
        if (!now.includes(p)) {
          msg = [`${nm(k)} hears from ${nm(p)}, who ${heard.has(p) ? "is not forwarding this minute" : "has not had the text yet"}. Only the rowers in the line forward now.`, false, k];
        } else if (parent(want) === p) {
          msg = [`${nm(p)} texts both ${nm(want)} and ${nm(k)}, but ${nm(want)} is on the left, so ${nm(want)} joins first. Keep left before right, so the sheet reads the chain left to right.`, false, k];
        } else {
          msg = [`${nm(p)} does text ${nm(k)}, but ${nm(parent(want))} is ahead of ${nm(p)} in the line, so ${nm(want)} joins first. The line keeps the order of the texts.`, false, k];
        }
        paint();
      });
      const nx = el.querySelector("[data-next]");
      if (nx) nx.onclick = () => {
        sheet.push(now);
        msg = null;
        if (joined.length) { m++; joined = []; paint(); return; }
        fin = true;
        msg = [`The line is empty, so the sheet is done: ${N} rowers in ${MINUTES.length} rows, minute 0 to minute ${MINUTES.length - 1}. Every rower joined the line once and left it once. At the start of each minute, the line held exactly that minute's rowers and nobody else. Each row is one <b>level</b> of the tree: the rowers who are the same number of forwards from ${nm(0)}, the root. Handing out a tree one minute at a time like this is called going <b>level by level</b>.`, true];
        paint(); done();
      };
    };
    paint();
  }

  /* 7. The queue as code. */
  const CODE2 = [
    "const sheet = [], line = [kim];",
    "while (line.length > 0) {",
    "  sheet.push(line.map(r => r.name));",
    "  const size = line.length;",
    "  for (let i = 0; i < size; i++) {",
    "    const r = line.shift();",
    "    if (r.left) line.push(r.left);",
    "    if (r.right) line.push(r.right);",
    "  }",
    "}"
  ];
  const FR2 = (() => {
    const fr = [], sheet = [], left = []; let line = [0], m = 0;
    const snap = o => fr.push({ ...o, line: line.slice(), sheet: sheet.map(r => r.slice()), left: left.slice() });
    snap({ ln: 0, cur: null, size: "–", say: `<code>line</code> is the queue: <code>push</code> joins the back, <code>shift</code> leaves the front. It starts with ${nm(0)} alone. The sheet is empty.` });
    while (line.length) {
      sheet.push(line.slice());
      snap({ ln: 2, cur: null, size: "–", say: `Minute ${m} starts. Everyone in the line heard in minute ${m}, and nobody else is in it, so the whole line goes on the sheet as one row: ${andList(line.map(nm))}.` });
      const size = line.length;
      snap({ ln: 3, cur: null, size, say: `size = ${size}. Rowers who join during this minute go behind them, so take exactly ${size} off the front. <code>size</code> is how the code knows where a minute ends. By hand, the Next minute button did this.` });
      for (let i = 0; i < size; i++) {
        const k = line.shift(); left.push(k);
        snap({ ln: 5, cur: k, size, say: `i = ${i}. ${nm(k)} leaves the front.${kids(k).length ? "" : ` ${nm(k)} forwards to nobody, so nobody joins.`}` });
        if (kids(k).length) {
          line.push(...kids(k));
          snap({ ln: has(2 * k + 1) ? 6 : 7, cur: k, size, say: `${andList(kids(k).map(nm))} join${kids(k).length > 1 ? "" : "s"} the back.` });
        }
      }
      m++;
    }
    snap({ ln: 1, cur: null, size: "–", fin: true, say: `The line is empty, so the loop ends. The sheet has ${sheet.length} rows, the same sheet you made by hand.` });
    return fr;
  })();
  function asCode2({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR2[i], cls = {};
      if (!f.fin) f.left.forEach(k => { cls[k] = "gone"; });
      f.line.forEach(k => { cls[k] = "in"; });
      if (f.cur != null) cls[f.cur] = "accent";
      el.innerHTML = `<h1>The queue, written as code</h1>
        <p class="task">Step through the code to the end. Match the highlighted line to the chain.</p>
        ${kit.pics.tree(ROOT, { layout: "inorder", cls })}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>line <b>[${f.line.map(nm).join(", ")}]</b></span><span>size <b>${f.size}</b></span><span>sheet <b>${plural(f.sheet.length, "row")}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 8. Recognise it in new situations: from below, level by level, or neither. */
  const PICKS = ["Build from below", "A queue, level by level", "Neither"];
  const CASES = [
    ["An org chart: every person has one manager. For each manager, count everyone in their team, all the way down.", 0, [
      "Yes. A manager's count is 1 for each direct report plus each report's own count. Ask the people below first, then add. Every person is asked once.",
      "A queue hands you each manager before the people under them, so when a manager comes out, nobody below has a count yet. You could save every row and add them up from the last row back, but that is asking from below with extra bookkeeping.",
      "Every person has exactly one manager, so the chart is a tree. A manager's count is built from their reports' counts, which is asking from below."]],
    ["A website menu has sections, and sections hold sub-sections. Draw it one depth at a time: every top section first, then every sub-section, then the next depth.", 1, [
      "Asking from below finishes one branch all the way down before it starts the next, and deepest items answer first. The drawing wants every top section before any sub-section.",
      "Yes. Put the top sections in a queue. Each one that leaves adds its sub-sections at the back, so the menu comes out one depth at a time. Having more than two children per item changes nothing.",
      "Each sub-section sits inside one section, so the menu is a tree, and you want it by depth. A queue gives exactly that order."]],
    ["A cake needs a sponge and a cream, and both of them use the same batch of sugar syrup. The recipe lists each part with its minutes of work. Find the total work for the cake.", 2, [
      "The syrup has two parents, the sponge and the cream. Asking from below, both include the syrup's minutes in their report, so the cake counts it twice. That only works when every part has exactly one parent, as in a tree.",
      "A queue would reach the syrup twice, once from the sponge and once from the cream, and add it twice unless you also track what you counted. And order does not matter here at all.",
      "Right. The syrup has two parents, so this is not a tree, and asking from below would count it twice. No order is needed either: the recipe already lists each part once, so add up the list."]]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which idea fits?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations away from the rowing club.</p>
        <p class="task">For each one, pick the idea that fits. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, fb], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(PICKS, { picked: ans[i], correct: y })}${ans[i] == null ? "" : kit.feedback(fb[ans[i]], ans[i] === y)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === y)) done();
      }));
    };
    paint();
  }

  /* 9. On to the problems: the groups this lesson taught first. */
  const TAUGHT = {
    "simple-recursion": "You did this with minutes(r): one call per rower, each asking the rowers below first.",
    "answer-from-below": "You did this with the text chain: each rower reported 1 + the slower of their two rowers.",
    "level-by-level": "You did this with the coach's sheet: a queue, and its size at the start of each minute."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  const lineWalk = MINUTES.flatMap(row => [...row.flatMap(kids).map(k => `[data-i="${k}"]`), "[data-next]"]);
  LessonKit.define("trees", {
    title: "Trees",
    teaches: ["simple-recursion", "answer-from-below", "level-by-level"],
    screens: [slowWay, spotTrick, fromBelow, asCode1, lineTrick, runLine, asCode2, recognise, toProblems],
    walk: [
      { wrong: [`[data-i="${INNER[0]}"]`], right: LEAVES.map(k => `[data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="0"]'], right: POST_INNER.flatMap(k => [`[data-i="${k}"]`, "[data-right]"]) },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${MINUTES[2][0]}"]`], right: lineWalk },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
