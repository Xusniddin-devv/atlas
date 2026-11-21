/* Lesson: tries. A small railway's ticket machine that shows every station starting with what the traveller has
   typed: checking the whole list on every key, then a tree where names that share a beginning share a path
   (insert, look up a beginning, look up a whole name), then a count kept in each node for "how many match".
   Every number on screen is computed here from ST, TYPED, ASK, CHECKS, NEW and BIG. Plain browser script. */
(() => {
  const ST = ["MOSS", "ROSE", "RYE", "ROW", "MOOR", "ROSS", "ROWE"], N = ST.length;
  const TYPED = "RO";                    // screens 1-2: what the traveller has typed
  const ASK = "ROS";                     // screens 4 and 6: a beginning to walk
  const CHECKS = ["ROS", "ROW", "RUE"];  // screen 5: names the traveller tries to buy
  const MISS = CHECKS.find(t => !walkTo(t, prefs(ST)).ok) || CHECKS[2]; // screen 6: a walk that falls off
  const NEW = "ROAD";                    // screens 7-8: the station that opens
  const BIG = 2500;                      // stations on a national network
  const ROOT = "^";
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  /* Every name and letter put into HTML goes through H (kit.esc is not available at the top level, where the code
     screens' frames are built). andList, spell and nodeName escape what they are given. */
  const H = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const andList = a => { a = a.map(H); return a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`; };
  const spell = p => H(p.split("").join(", "));
  const an = ch => "AEFHILMNORSX".includes(ch) ? "an" : "a"; // "an R", "a W": by the letter's spoken name
  const cap1 = t => t[0].toUpperCase() + t.slice(1);

  /* The tree as data: a node is the beginning (prefix) that leads to it; the top is ROOT. */
  function prefs(ws) { const s = new Set(); ws.forEach(w => { for (let i = 1; i <= w.length; i++) s.add(w.slice(0, i)); }); return s; }
  const kidsOf = (p, set) => [...set].filter(q => q.length === p.length + 1 && q.startsWith(p)).sort();
  const nodeOf = (p, set) => ({ v: p ? p[p.length - 1] : "", id: p || ROOT, kids: kidsOf(p, set).map(q => nodeOf(q, set)) });
  const countsOf = ws => { const m = { [ROOT]: ws.length }; prefs(ws).forEach(p => { m[p] = ws.filter(w => w.startsWith(p)).length; }); return m; };
  function walkTo(t, set) { let i = 0; while (i < t.length && set.has(t.slice(0, i + 1))) i++; return { ok: i === t.length, stop: i }; }
  const BASE = prefs(ST);
  const nodeName = p => p ? `the ${H(p)} node` : "the top";
  const under = p => ST.filter(w => w.startsWith(p));
  const pic = (kit, set, ends, opt = {}) => kit.pics.tree(nodeOf("", set), { ends: Object.fromEntries([...ends].map(w => [w, true])), ...opt });
  const pathCls = (p, c = "in") => { const o = {}; for (let i = 1; i <= p.length; i++) o[p.slice(0, i)] = c; return o; };

  /* Checking the list: compare typed letters with a name until one differs. */
  const cmp = (t, w) => { let i = 0; while (i < t.length && i < w.length && t[i] === w[i]) i++; const ok = i === t.length; return { m: i, ok, steps: ok ? t.length : i < w.length ? i + 1 : i }; };
  const CMP = ST.map(w => cmp(TYPED, w));
  const SLOW = CMP.reduce((a, c) => a + c.steps, 0);
  const MATCH = ST.filter((_, j) => CMP[j].ok);

  /* Local picture: the machine's station list, one row per name, letters as tiles. Styles in css(). */
  function css() {
    if (document.getElementById("lx-tries")) return;
    const s = document.createElement("style"); s.id = "lx-tries";
    s.textContent = `
.lx-tries-list { display: grid; gap: 8px; margin-top: 18px; max-width: 420px; }
.lx-tries-row { display: flex; align-items: center; gap: 6px; min-height: 48px; padding: 6px 12px; border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 10px; font: inherit; text-align: left; width: 100%; box-sizing: border-box; }
button.lx-tries-row { cursor: pointer; }
.lx-tries-row.hit { border-color: var(--good); background: var(--good-soft); }
.lx-tries-t { width: 30px; height: 34px; display: grid; place-items: center; font: 700 18px var(--mono); background: var(--surface); color: var(--ink-2); border-radius: 6px; }
.lx-tries-t.m { background: var(--ink); color: var(--bg); }
.lx-tries-t.x { background: transparent; color: var(--faint); box-shadow: inset 0 0 0 1.5px var(--line); text-decoration: line-through; }
.lx-tries-n { margin-left: auto; font: 500 14px var(--mono); color: var(--muted); white-space: nowrap; }
.lx-tries-gap { margin-bottom: 18px; }
.lx-tries-typed { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 16px; color: var(--muted); font-size: 15px; }
.lx-tries-typed span { display: inline-flex; gap: 4px; }
.lx-tries-typed b { min-width: 30px; height: 38px; display: grid; place-items: center; font: 700 20px var(--mono); color: var(--ink); background: var(--sunk); border-radius: 6px; }
.lx-tries-typed b.done { background: var(--ink); color: var(--bg); }
.lx-tries-typed b.nx { box-shadow: inset 0 0 0 2px var(--good); color: var(--good); background: var(--good-soft); }`;
    document.head.appendChild(s);
  }
  function board(kit, { checked, pick = false }) {
    return `<div class="lx-tries-list">${ST.map((w, j) => {
      const c = CMP[j], seen = checked.has(j), t = pick ? "button" : "div";
      const tiles = w.split("").map((ch, k) => `<span class="lx-tries-t ${!seen ? "" : k < c.m ? "m" : k === c.m && !c.ok && k < w.length ? "x" : ""}">${kit.esc(ch)}</span>`).join("");
      return `<${t}${t === "button" ? ' type="button"' : ""} class="lx-tries-row${seen && c.ok ? " hit" : ""}" data-i="${j}" aria-label="${kit.esc(w)}">${tiles}<span class="lx-tries-n">${seen ? plural(c.steps, "step") : ""}</span></${t}>`;
    }).join("")}</div>`;
  }
  const typed = (kit, t, d = t.length) => `<div class="lx-tries-typed">Typed<span>${t.split("").map((ch, k) => `<b class="${k < d ? "done" : k === d ? "nx" : ""}">${kit.esc(ch)}</b>`).join("")}</span></div>`;

  /* 1. The slow way: the machine checks every station on the list. */
  function slowWay({ el, done, kit }) {
    css();
    const checked = new Set();
    let last = null, again = false;
    const paint = () => {
      const all = checked.size === N, steps = [...checked].reduce((a, j) => a + CMP[j].steps, 0);
      const c = last == null ? null : CMP[last], w = last == null ? "" : ST[last];
      el.innerHTML = `<h1>A ticket machine that guesses the station</h1>
        <p class="lead">Your small railway has ${N} stations, kept in the ticket machine as a plain list. As a traveller types, the screen shows every station whose name starts with the letters typed so far. Comparing one typed letter with one letter of a name is one step. The machine stops at the first letter that differs.</p>
        <p class="task">The traveller has typed ${kit.esc(TYPED)}. Be the machine: tap every station to check it.</p>
        ${typed(kit, TYPED)}
        ${board(kit, { checked, pick: true })}
        <div class="lpanel">
          ${checked.size ? `<div class="sum">${plural(steps, "step")}<small>${all ? "for one key press" : "so far"}</small></div>` : ""}
          ${all ? kit.feedback(`${WORDS[MATCH.length] || MATCH.length} stations start with ${H(TYPED)}: ${andList(MATCH)}. Checking took <b>${plural(SLOW, "step")}</b> for ${N} stations. And the traveller is still typing: the next letter starts the whole list again. On a national network of ${fmt(BIG)} stations, every key press costs at least ${fmt(BIG)} steps.`, true)
            : again ? kit.feedback(`${H(w)} is already checked. ${N - checked.size} ${N - checked.size === 1 ? "station is" : "stations are"} still unchecked.`)
            : c ? kit.feedback(c.ok ? `${H(w)} starts with ${H(TYPED)}: ${plural(c.steps, "step")}, and it goes on the screen.` : `${H(w)}: ${H(w[c.m])} is not ${H(TYPED[c.m])}, so the machine stops after ${plural(c.steps, "step")}. Not a match.`) : ""}
        </div>`;
      el.querySelectorAll("button.lx-tries-row").forEach(b => b.onclick = () => {
        const j = +b.dataset.i;
        again = checked.has(j); last = j; checked.add(j);
        paint();
        if (checked.size === N) done();
      });
    };
    paint();
  }

  /* 2. Spot the repeat: the matches all re-check the same beginning. */
  function spotTrick({ el, done, kit }) {
    css();
    let ans = null;
    const at = MATCH.map(w => ST.indexOf(w)), between = ST.filter((w, j) => j > at[0] && j < at[at.length - 1] && !MATCH.includes(w));
    const odd = MATCH.find(w => w.length !== MATCH[0].length);
    const opts = [`They all have ${MATCH[0].length} letters`, `They all begin with ${spell(TYPED)}, and the machine checks those letters again for each one`, "They sit next to each other in the list"];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct;
      el.innerHTML = `<h1>What did the machine keep doing?</h1>
        <p class="lead">Here is the list after your check. ${WORDS[MATCH.length] || MATCH.length} stations matched ${H(TYPED)}: ${andList(MATCH)}.</p>
        <p class="task">What do the ${MATCH.length} matches share that made the machine repeat work?</p>
        ${board(kit, { checked: new Set(ST.map((_, j) => j)) })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. ${spell(TYPED)} was checked ${MATCH.length} times, ${MATCH.length * TYPED.length} steps, to learn one fact. So write each beginning only once: a tree that branches on the first letter, then on the second, and so on. Each circle (a node) holds one letter. The empty circle is the top, where every name starts, and a line goes down to the next letter. <b>Names that share a beginning share a path.</b> A double ring marks a node where a station's name ends.`, true)
            + pic(kit, BASE, ST, { cls: pathCls(TYPED), edges: pathCls(TYPED), title: `${N} stations, ${TYPED} written once` }) + kit.pics.key([["in", `${TYPED}: the shared path`]])
          : ans === 0 ? kit.feedback(odd ? `${H(odd)} has ${odd.length} letters and still matches. Length does not decide a match. The first letters do, and those are what the machine kept comparing.` : `Length does not decide a match. The first letters do, and those are what the machine kept comparing.`, false)
          : kit.feedback(between.length ? `They do not: ${andList(between)} ${between.length === 1 ? "sits" : "sit"} between them. And even names that sit together are each compared from the first letter: the machine would still check ${spell(TYPED)} again for every one of them.` : `Their place in the list does not change the repeat. Even names that sit together are each compared from the first letter, so ${spell(TYPED)} is checked again for every one of them.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Build the tree: predict how many new nodes each station adds. */
  const INS = (() => {
    const out = [], set = new Set(), owner = {};
    ST.forEach(w => {
      let sh = 0; while (sh < w.length && set.has(w.slice(0, sh + 1))) sh++;
      out.push({ w, shared: sh, add: w.length - sh, from: sh ? owner[w.slice(0, sh)] : null, empty: set.size === 0 });
      for (let i = 1; i <= w.length; i++) { const p = w.slice(0, i); if (!set.has(p)) { set.add(p); owner[p] = w; } }
    });
    return out;
  })();
  const LETTERS = ST.reduce((a, w) => a + w.length, 0);
  function build({ el, done, kit }) {
    let k = 0, wrong = null;
    const paint = () => {
      const fin = k === N, set = prefs(ST.slice(0, k)), ends = ST.slice(0, k);
      const cur = fin ? null : INS[k], prev = k ? INS[k - 1] : null;
      const opts = fin ? [] : [cur.add, cur.w.length, cur.shared, cur.add + 1, cur.add - 1].filter((v, i, a) => v >= 0 && a.indexOf(v) === i).slice(0, 3).sort((a, b) => a - b);
      const cls = {}, edges = {};
      if (prev) { const s = prev.w.slice(0, prev.shared); Object.assign(cls, pathCls(s)); Object.assign(edges, pathCls(s)); for (let i = prev.shared + 1; i <= prev.w.length; i++) cls[prev.w.slice(0, i)] = edges[prev.w.slice(0, i)] = "enter"; }
      const newPart = c => c.w.slice(c.shared);
      const said = prev ? (prev.shared
        ? `${H(prev.w)}: ${spell(prev.w.slice(0, prev.shared))} ${prev.shared === 1 ? "was" : "were"} already there from ${H(prev.from)}, so it walks down that path and adds ${spell(newPart(prev))}.`
        : `${H(prev.w)}: nothing it could share, so ${plural(prev.add, "new node")}.`) + (prev.add === 0 ? "" : ` The ${H(prev.w.slice(-1))} gets a double ring: ${H(prev.w)} ends there.`) : "";
      const letters = t => t.split("").join(", ");
      const legend = prev ? kit.pics.key([...(prev.shared ? [["in", `walked: ${letters(prev.w.slice(0, prev.shared))}`]] : []), ...(prev.add ? [["enter", `new: ${letters(newPart(prev))}`]] : [])]) : "";
      el.innerHTML = `<h1>Build the machine's tree</h1>
        <p class="lead">Put the stations in one at a time, in list order. A name walks down from the top, following letters that are already there, and adds a new node for each letter that is not. The node where the name ends gets a double ring.</p>
        ${fin ? "" : `<p class="task">How many new nodes does <b>${kit.esc(cur.w)}</b> add to the tree?</p>`}
        ${pic(kit, set, ends, { cls, edges, title: k ? `after ${ST.slice(0, k).join(", ")}` : "empty: just the top" })}${legend}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(cur.add), num: true })}
        ${wrong != null ? kit.feedback(
            wrong === cur.w.length && cur.shared ? `${spell(cur.w.slice(0, cur.shared))} ${cur.shared === 1 ? "is" : "are"} already in the tree from ${H(cur.from)}. ${H(cur.w)} walks down that path and only adds what comes after: ${spell(newPart(cur))}.`
            : wrong === cur.shared && cur.shared ? `${cur.shared} ${cur.shared === 1 ? "letter is" : "letters are"} already there, and ${cur.shared === 1 ? "it is" : "they are"} reused, not added. The new nodes are the letters after ${H(cur.w.slice(0, cur.shared))}: ${spell(newPart(cur))}.`
            : cur.empty ? `The tree is empty, so there is nothing to share yet. Every letter of ${H(cur.w)} needs its own node: ${cur.w.length}.`
            : cur.shared ? `Walk down from the top: ${spell(cur.w.slice(0, cur.shared))} ${cur.shared === 1 ? "exists" : "exist"}, then each letter left (${spell(newPart(cur))}) gets one node.`
            : `No station so far starts with ${H(cur.w[0])}, so nothing is shared. Every letter of ${H(cur.w)} needs its own node: ${cur.w.length}.`, false)
          : fin ? kit.feedback(`${said} All ${N} stations are in. Their names have ${LETTERS} letters, but the tree has only ${BASE.size} letter nodes, because every shared beginning is stored once.`, true)
          : said ? kit.feedback(said) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== cur.add) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k === N) done();
      });
    };
    paint();
  }

  /* 4. Type a beginning: walk it down the tree by hand. */
  const W4 = [...BASE].find(q => q.length > 1 && q[q.length - 1] === ASK[0]) || [...BASE].find(q => q.length > 1);
  function walkIt({ el, done, kit }) {
    css();
    let d = 0, bad = null, msg = null;
    const paint = () => {
      const fin = d === ASK.length, here = ASK.slice(0, d);
      const cls = pathCls(here), edges = pathCls(here);
      if (fin) under(ASK).forEach(w => { for (let i = ASK.length + 1; i <= w.length; i++) cls[w.slice(0, i)] = edges[w.slice(0, i)] = "enter"; });
      if (bad) cls[bad] = "no";
      el.innerHTML = `<h1>Now type into the tree</h1>
        <p class="lead">Same ${N} stations, stored as the tree. For each letter typed, the machine goes one step down, along the line (edge) to that letter.</p>
        ${fin ? "" : `<p class="task">The traveller types ${kit.esc(ASK)}. Tap the node the machine moves to for the letter <b>${kit.esc(ASK[d])}</b>.</p>`}
        ${typed(kit, ASK, d)}
        ${pic(kit, BASE, ST, { cls, edges, pick: fin ? false : q => q !== ROOT, title: d ? `on ${nodeName(here)}` : "starting at the top" })}${fin ? kit.pics.key([["in", `the walk: ${ASK.split("").join(", ")}`], ["enter", "below it: the matches"]]) : ""}
        <div class="lpanel">${fin ? kit.feedback(`${plural(ASK.length, "tap")} for ${plural(ASK.length, "letter")}. Every station below this ${H(ASK.slice(-1))} starts with ${H(ASK)}: ${andList(under(ASK))}. The list checked every station. With ${fmt(BIG)} stations that is at least ${fmt(BIG)} steps against ${ASK.length}: about ${fmt(Math.round(BIG / ASK.length))} times fewer steps to find where the matches are. Listing the matches still means visiting the nodes below this ${H(ASK.slice(-1))}, but only those, never the other stations.`, true)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll("button.lp-node").forEach(b => b.onclick = () => {
        const q = b.dataset.i, want = ASK.slice(0, d + 1), ch = ASK[d];
        if (q === want) {
          d++; bad = null;
          msg = d < ASK.length ? [`${H(ch)}: one step down. ${plural(under(want).length, "station")} still ${under(want).length === 1 ? "matches" : "match"}, and the machine never looked at the others.`] : null;
          paint(); if (d === ASK.length) done(); return;
        }
        bad = q;
        msg = [q.length <= d && ASK.startsWith(q) ? `You are already past this node. Go one step down from ${nodeName(here)}.`
          : q[q.length - 1] === ch ? `This ${H(ch)} is reached by ${spell(q)}, the path of ${andList(under(q))}, which ${under(q).length === 1 ? "does" : "do"} not start with ${H(want)}. The machine only goes one step down from ${nodeName(here)}, along the edge to ${H(ch)}.`
          : q.length === d + 1 && q.startsWith(here) ? `That is ${H(q[q.length - 1])}, one step below ${nodeName(here)}, but the traveller typed ${H(ch)}.`
          : `That node is not one step below ${nodeName(here)}. From there, follow the edge to ${H(ch)}.`, false];
        paint();
      });
    };
    paint();
  }

  /* 5. A beginning or a whole station? Read it off the tree. */
  const CK = CHECKS.map(t => {
    const r = walkTo(t, BASE), isSt = ST.includes(t), last = t.slice(0, r.stop);
    return { t, ...r, isSt, last, kids: kidsOf(last, BASE).map(q => q[q.length - 1]), through: r.ok ? under(t).filter(w => w !== t) : [] };
  });
  function stationOrNot({ el, done, kit }) {
    css();
    const ans = CK.map(() => null);
    const right = c => c.isSt ? 0 : 1;
    const fb = (c, ok) => {
      if (c.isSt) return ok ? `Yes. The walk ${spell(c.t)} ends on a node with a double ring${c.through.length ? `, even though ${andList(c.through)} ${c.through.length === 1 ? "carries" : "carry"} on below it` : ""}.`
        : `${c.through.length ? `${H(c.t)} has nodes below it (${andList(c.through)} ${c.through.length === 1 ? "carries" : "carry"} on), but` : "The walk reaches"} the last ${H(c.t.slice(-1))} has a double ring: a station ends there. A name can end in the middle of a path.`;
      if (c.ok) return ok ? `No. The path ${spell(c.t)} exists, but only because ${andList(c.through)} ${c.through.length === 1 ? "passes" : "pass"} through it. Its last node has no double ring.`
        : `The path is there, but a path is only a beginning. ${andList(c.through)} ${c.through.length === 1 ? "passes" : "pass"} through the ${H(c.t.slice(-1))}, and no station ends on it: it has no double ring.`;
      return ok ? `No. Below ${nodeName(c.last)} there ${c.kids.length === 1 ? "is" : "are"} only ${andList(c.kids)}, no ${H(c.t[c.stop])}. The walk falls off the tree after ${plural(c.stop, "letter")}.`
        : `Look below ${nodeName(c.last)}: only ${andList(c.kids)}. There is no ${H(c.t[c.stop])}, so the walk falls off the tree after ${plural(c.stop, "letter")}. Nothing starting with ${H(c.t.slice(0, c.stop + 1))} is stored at all.`;
    };
    const paint = () => {
      const all = CK.every((c, i) => ans[i] === right(c));
      el.innerHTML = `<h1>A beginning, or a real station?</h1>
        <p class="lead">To sell a ticket, the machine needs a whole station name, not just the start of one. Use the tree.</p>
        <p class="task">The traveller types each name and presses Buy. Is it a real station? Pick again if you change your mind.</p>
        <div class="lx-tries-gap">${pic(kit, BASE, ST)}</div>
        ${CK.map((c, i) => `<div class="lcase" id="c${i}"><p>Is ${kit.esc(c.t)} a station?</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: right(c) })}${ans[i] == null ? "" : kit.feedback(fb(c, ans[i] === right(c)), ans[i] === right(c))}</div>`).join("")}
        ${all ? kit.feedback("So one walk answers two questions. Does any station start with these letters? Only if the walk reaches the last letter. Is it a whole station? Only if it also ends on a double ring.") : ""}`;
      el.querySelectorAll(".lcase").forEach((cs, i) => cs.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CK.every((c, j) => ans[j] === right(c))) done();
      }));
    };
    paint();
  }

  /* 6. The walk as code. */
  const CODE1 = [
    "function walk(text) {",
    "  let node = root;",
    "  for (const ch of text) {",
    "    node = node.kids[ch];",
    "    if (!node) return null;",
    "  }",
    "  return node;",
    "}",
    "const isStation = t => !!walk(t)?.end;",
    "const startsWith = t => walk(t) !== null;"
  ];
  const FR1 = (() => {
    const fr = [];
    const run = (fn, ln, t) => {
      fr.push({ ln, t, at: "", ch: "–", node: "root", res: "…", say: `<code>${fn}("${H(t)}")</code> first calls <code>walk</code> to take the letters down the tree.` });
      fr.push({ ln: 1, t, at: "", ch: "–", node: "root", res: "…", say: "<code>node</code> starts at the top." });
      for (let i = 0; i < t.length; i++) {
        const p = t.slice(0, i + 1), here = t.slice(0, i);
        if (BASE.has(p)) { fr.push({ ln: 3, t, at: p, ch: t[i], node: p, res: "…", say: `ch = "${H(t[i])}". ${cap1(nodeName(here))} has ${an(t[i])} ${H(t[i])} below it, so <code>node</code> moves down to it. It exists, so the loop goes on.` }); continue; }
        fr.push({ ln: 3, t, at: here, ch: t[i], node: "undefined", res: "…", say: `ch = "${H(t[i])}". ${cap1(nodeName(here))} has only ${andList(kidsOf(here, BASE).map(q => q[q.length - 1]))} below it: <code>kids["${H(t[i])}"]</code> is undefined.` });
        fr.push({ ln: 4, t, at: here, ch: t[i], node: "undefined", res: "…", say: `<code>!node</code> is true: return null. Nothing stored starts with ${H(p)}.` });
        fr.push({ ln, t, at: here, ch: "–", node: "null", res: "false", say: `<code>walk</code> gave null, so <code>${fn}("${H(t)}")</code> is false: the same fall off the tree you saw with ${H(t)}.` });
        return;
      }
      const end = ST.includes(t);
      fr.push({ ln: 6, t, at: t, ch: "–", node: t, res: "…", say: `Every letter is used. Return the ${H(t.slice(-1))} node.` });
      fr.push({ ln, t, at: t, ch: "–", node: t, res: fn === "isStation" ? String(end) : "true", say: fn === "isStation"
        ? `<code>.end</code> is ${end}: ${end ? "a double ring" : `no double ring on this ${H(t.slice(-1))}`}. <code>isStation("${H(t)}")</code> is ${end}, as you found by hand.`
        : `<code>walk</code> found a node, so <code>startsWith("${H(t)}")</code> is true.` });
    };
    run("isStation", 8, ASK);
    run("startsWith", 9, MISS);
    return fr;
  })();
  function walkCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cls = pathCls(f.at), edges = pathCls(f.at);
      cls[f.at || ROOT] = "accent";
      el.innerHTML = `<h1>The same walk, written as code</h1>
        <p class="lead">This tree has a name: a <b>trie</b>, said like “try”, from re<b>trie</b>val. A beginning of a word is called a <b>prefix</b>. <code>root</code> is the top. Each node is an object. <code>kids</code> maps a letter to the node below it, and <code>end</code> is the double ring.</p>
        <p class="task">Step through both calls to the end. Match the highlighted line to the outlined node.</p>
        ${pic(kit, BASE, ST, { cls, edges })}
        ${kit.code(CODE1, f.ln)}
        <div class="vars"><span>text <b>"${kit.esc(f.t)}"</b></span><span>ch <b>${kit.esc(f.ch)}</b></span><span>node <b>${kit.esc(f.node)}</b></span><span>result <b>${f.res}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>
        ${kit.feedback(f.say)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 7. A second idea: keep a count in each node. Which counts change when a station opens? */
  const C0 = countsOf(ST), ALL = [...ST, NEW], C1 = countsOf(ALL), SET1 = prefs(ALL);
  const OTHER = Object.keys(C0).find(p => p !== ROOT && p.length === 1 && !NEW.startsWith(p));
  const NEWSH = (() => { let i = 0; while (BASE.has(NEW.slice(0, i + 1))) i++; return i; })();
  const DEEP = NEW.slice(0, NEWSH);
  function counts({ el, done, kit }) {
    let ans = null;
    const added = andList(NEW.slice(NEWSH).split(""));
    const opts = [`Only the new nodes, ${added}: they start at 1`, `Every node ${H(NEW)} passes through, from the top down: one more each, and the new ${added} start at 1`, "Every count in the tree goes up by 1"];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct;
      const cls = ok ? { ...pathCls(DEEP), [ROOT]: "in" } : {}, edges = ok ? pathCls(DEEP) : {};
      if (ok) for (let i = NEWSH + 1; i <= NEW.length; i++) cls[NEW.slice(0, i)] = edges[NEW.slice(0, i)] = "enter";
      el.innerHTML = `<h1>How many stations match?</h1>
        <p class="lead">The machine also shows how many stations match, as you type. Counting the double rings below a node means visiting every node under it. So each node keeps one number instead: how many stations pass through it or end on it. The top counts all ${N}. After ${H(TYPED)}, the machine just reads ${C0[TYPED]} off one node.</p>
        <p class="task">A new station, ${kit.esc(NEW)}, opens. Which numbers must change?</p>
        ${ok ? pic(kit, SET1, ALL, { cls, edges, notes: C1, title: `after ${NEW} opens` }) : pic(kit, BASE, ST, { notes: C0, title: "stations through each node" })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. ${H(NEW)} passes the top (${C0[ROOT]} → ${C1[ROOT]}), ${spell(DEEP)} (${[...DEEP].map((_, i) => `${C0[DEEP.slice(0, i + 1)]} → ${C1[DEEP.slice(0, i + 1)]}`).join(", ")}), and makes ${added} with 1. Nothing else changes. Adding a station costs one step per letter, and any “how many start with this” is one walk plus one read.`, true)
          : ans === 0 ? kit.feedback(`The ${H(DEEP)} node counts every station that starts with ${H(DEEP)}. ${H(NEW)} starts with ${H(DEEP)}, so that number must go from ${C0[DEEP]} to ${C1[DEEP]}, and every node above it too.`, false)
          : kit.feedback(`The ${H(OTHER)} node counts the stations that start with ${H(OTHER)}. ${H(NEW)} does not, so it stays ${C0[OTHER]}. Only the nodes ${H(NEW)} passes through change.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. Insert with counts, as code. */
  const CODE2 = [
    "function insert(word) {",
    "  let node = root;",
    "  node.count++;",
    "  for (const ch of word) {",
    "    node.kids[ch] ??= newNode();",
    "    node = node.kids[ch];",
    "    node.count++;",
    "  }",
    "  node.end = true;",
    "}"
  ];
  /* A count++ on a node that was already there is a prediction: the learner says the new count before the frame shows it. */
  const FR2 = (() => {
    const fr = [], set = new Set(BASE), cnt = { ...C0 }, ends = new Set(ST), fresh = new Set();
    let at = "";
    const push = (ln, ch, say, ask = null) => fr.push({ ln, ch, at, set: new Set(set), cnt: { ...cnt }, ends: new Set(ends), fresh: new Set(fresh), say, ask });
    const bump = (key, ln, ch, say) => { const old = cnt[key]; cnt[key]++; push(ln, ch, say, old > 0 ? { key, old, now: cnt[key] } : null); };
    push(1, "–", `<code>insert("${H(NEW)}")</code> on the tree of ${N} stations. <code>node</code> starts at the top.`);
    bump(ROOT, 2, "–", `The top counts every station: ${cnt[ROOT]} → ${cnt[ROOT] + 1}.`);
    for (const ch of NEW) {
      const p = at + ch, had = set.has(p), here = nodeName(at);
      if (!had) { set.add(p); cnt[p] = 0; fresh.add(p); }
      push(4, ch, had ? `ch = "${H(ch)}". ${cap1(here)} already has ${an(ch)} ${H(ch)} below it, so <code>??=</code> leaves it as it is.` : `ch = "${H(ch)}". There is no ${H(ch)} below ${here}, so <code>??=</code> makes a new node with count 0.`);
      at = p; push(5, ch, `<code>node</code> moves down to the ${H(ch)}.`);
      const c = cnt[p] + 1;
      bump(p, 6, ch, `The ${H(p)} count: ${c - 1} → ${c}. ${plural(c, "station")} now ${c === 1 ? "starts" : "start"} with ${H(p)}.`);
    }
    ends.add(NEW); push(8, "–", `The word is used up: <code>end = true</code>, a double ring on the ${H(NEW.slice(-1))}. Typing ${H(TYPED)} now shows ${cnt[TYPED]} stations, read from one node.`);
    return fr;
  })();
  const ASK1 = FR2.findIndex(f => f.ask);
  const W8 = (() => { const r = []; for (let i = 1; i < FR2.length; i++) { r.push("[data-next]"); if (FR2[i].ask) r.push("[data-right]"); } return r; })();
  function insertCode({ el, done, kit }) {
    let i = 0, wrong = null;
    const got = new Set();
    const paint = () => {
      const f = FR2[i], q = f.ask && !got.has(i) ? f.ask : null, shown = q ? FR2[i - 1].cnt : f.cnt;
      const cls = { ...pathCls(f.at), [ROOT]: "in" }, edges = pathCls(f.at);
      f.fresh.forEach(p => { cls[p] = edges[p] = "enter"; });
      cls[f.at || ROOT] = "accent";
      const name = q && (q.key === ROOT ? "the top" : `the ${kit.esc(q.key)} node`);
      const opts = q ? [q.old, q.now] : [];
      const why = q && (q.key === ROOT
        ? `${q.old} is the count before this line runs. The top counts every station, and ${kit.esc(NEW)} is one more, so <code>count++</code> adds 1 here too.`
        : `${q.old} is the count before this line runs. The ${kit.esc(q.key)} node counts the stations that start with ${kit.esc(q.key)}, and ${kit.esc(NEW)} starts with ${kit.esc(q.key)} too, so <code>count++</code> adds 1.`);
      el.innerHTML = `<h1>Adding a station, written as code</h1>
        <p class="lead"><code>insert</code> walks down like <code>walk</code>, but makes each missing node and adds 1 to every count on the way. <code>newNode()</code> returns <code>{ kids: {}, count: 0, end: false }</code>. <code>a ??= b</code> sets <code>a</code> to <code>b</code> only when <code>a</code> is empty (null or undefined).</p>
        <p class="task">Step through <code>insert("${kit.esc(NEW)}")</code> to the end. When a count that is already there is about to change, say what it becomes.</p>
        ${pic(kit, f.set, f.ends, { cls, edges, notes: shown })}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>ch <b>${kit.esc(f.ch)}</b></span><span>node <b>${f.at ? kit.esc(f.at) : "root"}</b></span><span>count <b>${q ? "?" : f.cnt[f.at || ROOT]}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 || q ? "disabled" : ""}>Next step</button></div>
        ${q ? `<div class="lpanel"><p><code>node.count++</code> runs on ${name}. What does its count become?</p>${kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: 1, num: true })}${wrong != null ? kit.feedback(why, false) : ""}</div>`
          : kit.feedback(f.say, f.ask ? true : undefined)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; wrong = null; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; wrong = null; paint(); if (i === FR2.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== q.now) { wrong = v; paint(); return; }
        wrong = null; got.add(i); paint();
      });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including one where the tree buys nothing. */
  const CASES = [
    ["A cloud drive stores files by path, like photos/2025/june/beach.jpg. Show everything inside photos/2025 without reading every path in the drive.", true,
      "Yes. Split each path at the slashes and store each folder name as one node. Files that share folders share a route down the tree, and everything inside photos/2025 sits below that one node.",
      "Paths share beginnings just like station names. The steps are folder names instead of letters: split at the slashes, one node per folder, and everything inside photos/2025 sits below one node."],
    ["A parcel locker opens when you type the whole 6-digit pickup code. Codes are random, and the locker never shows anything until all 6 digits are in.", false,
      "No. A tree would work, but it buys nothing. Every question is about a whole code, never a beginning, and a Set answers a whole code in one look-up. The tree would spend a node per digit on questions nobody asks.",
      "A tree would give the right answer, but it is the wrong tool. Nobody asks about half a code, so the shared beginnings are never used. A Set answers “is this whole code valid?” in one look-up, without a node per digit."],
    ["A phone shows, as you dial, how many saved numbers start with the digits typed so far.", true,
      "Yes. A tree of digits with a count in each node. Each digit is one step down, and the count is read off the node you reach.",
      "Each digit typed is one more letter of a beginning, and the question is how many numbers share it. That is the station count: a tree of digits, a count in each node."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a trie help here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations without trains.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. On to the problems: the kit lists the groups this lesson taught first. */
  const TAUGHT = {
    "letter-trie": "You did this with the ticket machine: names that share a beginning share one path, with a double ring where a name ends.",
    "path-trie": "New here: the same tree, with one node per folder name instead of per letter, as in the cloud drive question.",
    "trie-guided-search": "You did the first half when a station opened: a count kept in each node answers “how many start with this” in one walk. Ranking the matches is new here."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1><p>A trie stores words so that shared prefixes are stored once. Use it when you ask about beginnings. For whole-word questions only, a Set is enough.</p>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  LessonKit.define("tries", {
    title: "Tries",
    teaches: ["letter-trie", "trie-guided-search"],
    screens: [slowWay, spotTrick, build, walkIt, stationOrNot, walkCode, counts, insertCode, recognise, toProblems],
    walk: [
      { right: ST.map((_, j) => `[data-i="${j}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(N).fill("[data-right]") },
      { wrong: [`[data-i="${W4}"]`], right: ASK.split("").map((_, i) => `[data-i="${ASK.slice(0, i + 1)}"]`) },
      { wrong: ["#c0 [data-wrong]"], right: CK.map((_, i) => `#c${i} [data-right]`) },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(ASK1).fill("[data-next]"), "[data-wrong]"], right: W8.slice(ASK1) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
