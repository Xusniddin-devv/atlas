/* Lesson: 2-D dynamic programming. A wheelbarrow through a pumpkin patch that only has paths going right or
   down (each bed's best haul comes from the bed above or the bed to its left), then the patch's website, where a
   designer reordered the homepage sections (a table over two lists, comparing their prefixes). Every number on
   screen is computed here from PATCH, OLD and NEW. Plain browser script. */
(() => {
  /* ---------- idea 1: the pumpkin patch ---------- */
  const PATCH = [[2, 5, 2, 3], [4, 1, 6, 2], [1, 6, 4, 3]];
  const R = PATCH.length, C = PATCH[0].length, LEN = R + C - 2;   // additions along one route
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const K = (r, c) => `${r},${c}`;
  // best haul arriving at each bed
  const HAUL = PATCH.map(row => row.slice());
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) HAUL[r][c] += Math.max(r ? HAUL[r - 1][c] : 0, c ? HAUL[r][c - 1] : 0);
  const BEST = HAUL[R - 1][C - 1];
  // every route, by brute force: [keys, total]
  const ROUTES = (() => {
    const out = [];
    const go = (r, c, keys, sum) => {
      keys = [...keys, K(r, c)]; sum += PATCH[r][c];
      if (r === R - 1 && c === C - 1) { out.push([keys, sum]); return; }
      if (c + 1 < C) go(r, c + 1, keys, sum);
      if (r + 1 < R) go(r + 1, c, keys, sum);
    };
    go(0, 0, [], 0);
    return out;
  })();
  const NR = ROUTES.length;
  const SLOW = NR * LEN + (NR - 1);                       // add every route, compare the totals
  const TABLE = (R * C - 1) + (R - 1) * (C - 1);          // one addition per bed, one comparison per inner bed
  // the best route, traced back from the shed
  const BEST_ROUTE = (() => {
    const keys = []; let r = R - 1, c = C - 1;
    while (true) {
      keys.unshift(K(r, c));
      if (!r && !c) break;
      if (r && (!c || HAUL[r - 1][c] >= HAUL[r][c - 1])) r--; else c--;
    }
    return keys;
  })();
  const binom = (n, k) => { let x = 1; for (let i = 1; i <= k; i++) x = x * (n - k + i) / i; return Math.round(x); };
  const slowN = n => { const rt = binom(2 * n - 2, n - 1); return rt * (2 * n - 2) + rt - 1; };
  const tableN = n => n * n - 1 + (n - 1) * (n - 1);
  const TRY = 3;
  // like kit.code, but can highlight more than one line
  const codeLines = (kit, lines, active) => { const on = [].concat(active); return `<pre class="lcode">${lines.map((c, j) => `<div${on.includes(j) ? ' class="on"' : ""}>${kit.esc(c) || " "}</div>`).join("")}</pre>`; };

  // haul grid: cells in `known` show their best haul, `ask` shows "?"
  const haulRows = (known, ask) => HAUL.map((row, r) => row.map((v, c) => known.has(K(r, c)) ? v : ask === K(r, c) ? "?" : ""));
  const patchPic = (kit, cls = {}, title = "Pumpkins on each bed") => kit.pics.grid(PATCH, { cls, title });

  /* 1. The slow way: walk routes by hand and add them up. */
  function slowWay({ el, done, kit }) {
    const tried = new Map();
    let path = [[0, 0]], last = null, steps = 0, miss = null, msg = null;
    const paint = () => {
      const [er, ec] = path[path.length - 1], cls = {};
      if (last) last.forEach(k => { cls[k] = "enter"; });
      path.forEach(([r, c]) => { cls[K(r, c)] = "in"; });
      const fin = tried.size >= TRY;
      if (!fin) { if (ec + 1 < C) cls[K(er, ec + 1)] = "next"; if (er + 1 < R) cls[K(er + 1, ec)] = "next"; }
      if (miss) cls[miss] = "no";
      const sum = path.reduce((a, [r, c]) => a + PATCH[r][c], 0);
      const best = Math.max(...tried.values());
      el.innerHTML = `<h1>A wheelbarrow through the pumpkin patch</h1>
        <p class="lead">Each square is a bed, and the number is how many pumpkins are ripe on it. You push a wheelbarrow from the gate (top left) to the weighing shed (bottom right) and pick every pumpkin on the beds you pass. The paths between beds only go <b>right or down</b>. Adding one bed to a total, or comparing two totals, counts as one step.</p>
        <p class="task">Walk ${WORDS[TRY].toLowerCase()} different routes: tap the next bed each time (one of the two outlined beds). Find the route with the most pumpkins.</p>
        ${kit.pics.grid(PATCH, { cls, pick: !fin, title: "Gate top left, shed bottom right" })}
        ${kit.pics.key([["", "other beds"], ["in", "this route so far"], ["next", "beds you can tap next"], ["enter", "your last route"], ["no", "not a next bed"]].filter(([st]) => st ? Object.values(cls).includes(st) : Object.keys(cls).length < R * C))}
        <div class="lpanel">
          ${path.length > 1 ? `<div class="sum">${path.map(([r, c]) => PATCH[r][c]).join(" + ")} = ${sum}<small>this route so far</small></div>` : ""}
          ${tried.size ? `<div class="tried">${[...tried].map(([k, s]) => `<span class="${fin && s === best ? "top1" : ""}">route ${k.split("|")[1]} <b>${s}</b></span>`).join("")}</div>` : ""}
          ${fin ? kit.feedback(`Your best route carries <b>${best}</b>. ${best === BEST ? "It is in fact the best, but you could not know that yet." : "But is it the best of all?"} The patch has <b>${NR} routes</b>, and only adding up every one proves it: ${NR} × ${LEN} additions plus ${NR - 1} comparisons, <b>${SLOW} steps</b>. A 10 × 10 patch has ${fmt(binom(18, 9))} routes. And every route starts at the same gate and shares stretches with others, yet you added each one up from scratch.`, true)
            : msg ? kit.feedback(msg[0], msg[1]) : ""}
        </div>`;
      el.querySelectorAll("button.lp-gc").forEach(b => b.onclick = () => {
        const r = +b.dataset.r, c = +b.dataset.c, [pr, pc] = path[path.length - 1];
        if (!((r === pr && c === pc + 1) || (r === pr + 1 && c === pc))) {
          miss = K(r, c);
          msg = [r === pr && c === pc ? "That is the bed you are on. Tap the next bed: one of the two outlined beds, to the right or below."
            : r < pr || c < pc ? "The paths only go right or down, so the wheelbarrow can never go back up or left. Tap one of the outlined beds."
            : "Beds are passed one at a time, with no jumping. From here the next bed is the one to the right or the one below: the two outlined beds.", false];
          paint(); return;
        }
        miss = null; path.push([r, c]); last = null;
        if (r === R - 1 && c === C - 1) {
          const keys = path.map(([a, d]) => K(a, d)), id = keys.join(";"), total = path.reduce((a, [x, y]) => a + PATCH[x][y], 0);
          const seen = [...tried.keys()].find(k => k.startsWith(id + "|"));
          if (seen) msg = [`You already walked this route: ${total} pumpkins. Try a different one.`];
          else {
            tried.set(`${id}|${tried.size + 1}`, total);
            steps += LEN + (tried.size > 1 ? 1 : 0);
            msg = [`Route ${tried.size}: <b>${total}</b> pumpkins, ${LEN} additions${tried.size > 1 ? " and one comparison with the best so far" : ""}. Steps so far: <b>${steps}</b>. Back at the gate for the next one.`];
          }
          last = keys; path = [[0, 0]];
        } else msg = null;
        paint();
        if (tried.size >= TRY) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: a bed's best haul from the two beds next to it. */
  const T2 = [1, 1];   // its neighbours above and left are plain sums, so the grid does not give the rule away
  function spotTrick({ el, done, kit }) {
    const [tr, tc] = T2, up = HAUL[tr - 1][tc], left = HAUL[tr][tc - 1], v = PATCH[tr][tc], right = Math.max(up, left) + v;
    const known = new Set();
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (r * C + c < tr * C + tc) known.add(K(r, c));
    const opts = [`${up} + ${left} + ${v} = ${up + left + v}: both ways in, plus this bed`, `${Math.max(up, left)} + ${v} = ${right}: the better way in, plus this bed`, "No way to tell without tracing every route into this bed"];
    const correct = 1;
    let ans = null;
    const paint = () => {
      const ok = ans === correct, k = K(tr, tc);
      const rows = haulRows(known, ok ? null : k);
      if (ok) rows[tr][tc] = right;
      const cls = { [k]: ok ? "enter" : "next", [K(tr - 1, tc)]: "in", [K(tr, tc - 1)]: "in" };
      el.innerHTML = `<h1>Ask the beds next door</h1>
        <p class="lead">A second grid. In each bed it holds the <b>most pumpkins the wheelbarrow can carry on arriving there</b>, counting that bed. The top row and the left column have only one way in, so their numbers just add up. The outlined bed has ${plural(v, "pumpkin")}. The bed above it can be reached with at most ${up}, the bed to its left with at most ${left}. The two filled beds are the ways in, and the arrows show where the wheelbarrow comes from.</p>
        <p class="task">What is the most the wheelbarrow can carry on arriving at the outlined bed?</p>
        ${kit.pics.side(patchPic(kit, { [k]: "next" }), kit.pics.grid(rows, { cls, from: { [k]: [[tr - 1, tc], [tr, tc - 1]] }, title: "Best haul on arriving" }))}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. Every route into this bed steps in from above or from the left. The best route from above brings ${up}, the best from the left brings ${left}, and any other route carries less. So take ${Math.max(up, left)} and add this bed's ${v}: <b>${right}</b>. Two numbers you already have, instead of a list of routes.`, true)
          : ans === 0 ? kit.feedback(`${up} and ${left} belong to two different routes. One wheelbarrow travels one route, so it carries one of them, not both. Take the larger.`, false)
          : kit.feedback(`Every route into this bed ends with one step, from above or from the left. The best of all routes ending above is already written there: ${up}. The best from the left: ${left}. Tracing them again would add up the same beds again.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Fill the rest of the grid yourself, predicting each bed. */
  const FILL = [];
  for (let r = 1; r < R; r++) for (let c = 0; c < C; c++) FILL.push([r, c]);
  function fillIt({ el, done, kit }) {
    const known = new Set(PATCH[0].map((_, c) => K(0, c)));
    let k = 0, wrong = null, said = null, n = 10;
    const paint = () => {
      const fin = k === FILL.length;
      const [r, c] = fin ? [R - 1, C - 1] : FILL[k];
      const v = PATCH[r][c], up = HAUL[r - 1][c], left = c ? HAUL[r][c - 1] : null;
      const right = HAUL[r][c];
      const cand = c ? [right, up + left + v, Math.min(up, left) + v] : [right, v, up];
      const opts = fin ? [] : cand.filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => a - b);
      const rows = haulRows(known, fin ? null : K(r, c)), cls = {}, pcls = {};
      if (fin) BEST_ROUTE.forEach(q => { cls[q] = "enter"; pcls[q] = "enter"; });
      else { cls[K(r, c)] = "next"; pcls[K(r, c)] = "next"; cls[K(r - 1, c)] = "in"; if (c) cls[K(r, c - 1)] = "in"; }
      const from = fin ? {} : { [K(r, c)]: c ? [[r - 1, c], [r, c - 1]] : [[r - 1, c]] };
      el.innerHTML = `<h1>Fill the grid, bed by bed</h1>
        <p class="lead">Same patch. The top row is filled. Go row by row, left to right, so the beds above and to the left are always ready. A bed in the left column has only one way in: from above.</p>
        ${fin ? "" : `<p class="task">The outlined bed has ${plural(v, "pumpkin")}. ${c ? `Above: ${up}. Left: ${left}.` : `Above: ${up}. Nothing to its left.`} What is its best haul?</p>`}
        ${kit.pics.side(patchPic(kit, pcls), kit.pics.grid(rows, { cls, from, title: "Best haul on arriving" }))}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong != null ? kit.feedback(
            !c && wrong === v ? `The wheelbarrow arrives with ${up} pumpkins from the bed above. Those are still in it: ${up} + ${v}.`
            : !c ? `That is the haul above, without this bed. ${v === 1 ? "The 1 pumpkin here goes" : `The ${v} pumpkins here go`} in too.`
            : wrong === up + left + v ? `${up} and ${left} are two different routes, and the wheelbarrow takes only one. Take the larger, ${Math.max(up, left)}, then add ${v}.`
            : `${Math.min(up, left)} is the smaller of the two ways in. You want the most pumpkins: ${Math.max(up, left)} + ${v}.`, false)
          : said ? kit.feedback(said[0], said[1]) : ""}
        ${fin ? `${kit.meter([{ label: "Add up every route", value: SLOW, max: SLOW }, { label: "Fill the grid", value: TABLE, max: SLOW, good: true }])}
          <div class="sliders"><label>Beds per side <input type="range" id="sn" min="3" max="20" step="1" value="${n}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const x = opts[+b.dataset.i];
        if (x !== right) { wrong = x; paint(); return; }
        wrong = null; known.add(K(r, c)); k++;
        if (k === FILL.length) {
          said = [`The shed's number is the answer: <b>${BEST}</b> pumpkins. Walk back from the shed, each time to the neighbour above or to the left with the larger number, and you get the route itself, filled in on both grids: ${BEST_ROUTE.map(q => { const [a, d] = q.split(",").map(Number); return PATCH[a][d]; }).join(" + ")} = ${BEST}. Each bed was filled once: one addition per bed after the gate (${R * C - 1}) and one comparison for each bed with two ways in (${(R - 1) * (C - 1)}), so ${TABLE} steps instead of ${SLOW}. Now make the patch bigger:`, true];
          paint(); done(); return;
        }
        said = [c ? `${Math.max(up, left)} ${up >= left ? "from above" : "from the left"} + ${v} = ${right}.` : `${up} from above + ${v} = ${right}.`];
        paint();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = `${n} × ${n}`;
        const a = slowN(n), t = tableN(n);
        el.querySelector("#big").innerHTML = `${fmt(a)} vs ${fmt(t)}<small>steps for a ${n} × ${n} patch: adding up all ${fmt(binom(2 * n - 2, n - 1))} routes, against filling the grid once. That is about ${fmt(Math.round(a / t))} times fewer steps.</small>`;
      };
      sn.oninput = () => { n = +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same moves as code. */
  const CODE1 = [
    "const haul = patch.map(row => [...row]);",
    "const R = haul.length, C = haul[0].length;",
    "for (let r = 0; r < R; r++) {",
    "  for (let c = 0; c < C; c++) {",
    "    const up = r ? haul[r - 1][c] : 0;",
    "    const left = c ? haul[r][c - 1] : 0;",
    "    haul[r][c] += Math.max(up, left);",
    "  }",
    "}",
    "return haul[R - 1][C - 1];"
  ];
  const FR1 = (() => {
    const g = PATCH.map(row => row.slice());
    const fr = [{ ln: 0, g: g.map(x => x.slice()), say: "<code>haul</code> starts as a copy of the patch: each bed holds only its own pumpkins so far." }];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const up = r ? g[r - 1][c] : 0, left = c ? g[r][c - 1] : 0;
      fr.push({ ln: [4, 5], g: g.map(x => x.slice()), r, c, up, left, say: !r && !c ? "r = 0, c = 0: the gate. Nothing above, nothing to the left, so both are 0."
        : !r ? `r = 0, c = ${c}. No row above, so up is 0. left is ${left}.`
        : !c ? `r = ${r}, c = 0. up is ${up}. No bed to the left, so left is 0.`
        : `r = ${r}, c = ${c}. up is ${up}, left is ${left}.` });
      g[r][c] += Math.max(up, left);
      fr.push({ ln: 6, g: g.map(x => x.slice()), r, c, up, left, wrote: true, say: `${PATCH[r][c]} + the larger of ${up} and ${left} = ${g[r][c]}.` });
    }
    fr.push({ ln: 9, g: g.map(x => x.slice()), say: `Return the shed's number, ${g[R - 1][C - 1]}: the same haul you found by hand. Two loops, one visit per bed.` });
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i], cls = {}, from = {};
      if (f.r != null) {
        const k = K(f.r, f.c);
        cls[k] = f.wrote ? "enter" : "accent";
        if (f.r) cls[K(f.r - 1, f.c)] = "in";
        if (f.c) cls[K(f.r, f.c - 1)] = "in";
        const src = []; if (f.r) src.push([f.r - 1, f.c]); if (f.c) src.push([f.r, f.c - 1]);
        from[k] = src;
      }
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">Nothing new here. <code>patch</code> is the pumpkins grid. When <code>r</code> or <code>c</code> is 0 there is no neighbour on that side, and it counts as 0. That is safe because no bed has fewer than 0 pumpkins.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the grid.</p>
        ${kit.pics.grid(f.g, { cls, from, title: "haul" })}
        ${codeLines(kit, CODE1, f.ln)}
        <div class="vars"><span>r <b>${f.r ?? "–"}</b></span><span>c <b>${f.c ?? "–"}</b></span><span>up <b>${f.up ?? "–"}</b></span><span>left <b>${f.left ?? "–"}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* ---------- idea 2: the patch's homepage, reordered ---------- */
  const OLD = ["nav", "hero", "price", "faq"], NEW = ["nav", "faq", "hero", "price"];
  const N1 = OLD.length, M1 = NEW.length;
  const T = Array.from({ length: N1 + 1 }, () => Array(M1 + 1).fill(0));
  for (let i = 1; i <= N1; i++) for (let j = 1; j <= M1; j++) T[i][j] = OLD[i - 1] === NEW[j - 1] ? T[i - 1][j - 1] + 1 : Math.max(T[i - 1][j], T[i][j - 1]);
  const KEEP = T[N1][M1];
  // trace back: the kept sections and the cells on the way
  const TRACE = (() => {
    const kept = [], hits = []; let i = N1, j = M1;
    while (i && j) {
      if (OLD[i - 1] === NEW[j - 1]) { kept.unshift(OLD[i - 1]); hits.push(K(i, j)); i--; j--; }
      else if (T[i - 1][j] >= T[i][j - 1]) i--; else j--;
    }
    return { kept, hits };
  })();
  const MOVED = OLD.filter(s => !TRACE.kept.includes(s));
  // the shared sections of two prefixes, read off the finished table
  const sharedOf = (i, j) => { const out = []; while (i && j) { if (OLD[i - 1] === NEW[j - 1]) { out.unshift(OLD[i - 1]); i--; j--; } else if (T[i - 1][j] >= T[i][j - 1]) i--; else j--; } return out; };
  // sections that both the cell above and the cell to the left count
  const overlapOf = (i, j) => { const l = sharedOf(i, j - 1); return sharedOf(i - 1, j).filter(s => l.includes(s)); };
  const andList = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const ROWH = ["", ...OLD], COLH = ["", ...NEW];
  const srcOf = (i, j) => OLD[i - 1] === NEW[j - 1] ? [[i - 1, j - 1]]
    : T[i - 1][j] > T[i][j - 1] ? [[i - 1, j]] : T[i - 1][j] < T[i][j - 1] ? [[i, j - 1]] : [[i - 1, j], [i, j - 1]];
  const tRows = (known, ask) => T.map((row, i) => row.map((v, j) => !i || !j || known.has(K(i, j)) ? v : ask === K(i, j) ? "?" : ""));
  const tPic = (kit, rows, o = {}) => kit.pics.grid(rows, { rowHead: ROWH, colHead: COLH, ...o });
  const join = a => a.join(" ");
  const pageCells = (kit, list, keep) => kit.cells(list, { cls: keep ? Object.fromEntries(list.map((s, i) => [i, keep.includes(s) ? "in" : ""])) : {} });

  /* 5. Spot the trick: both shortened pages end with the same section. */
  const T5 = [3, 4];
  function spotStrings({ el, done, kit }) {
    const [ti, tj] = T5, d = T[ti - 1][tj - 1], up = T[ti - 1][tj], left = T[ti][tj - 1], right = d + 1;
    const e = kit.esc, last = e(OLD[ti - 1]);
    const known = new Set();
    for (let i = 1; i <= N1; i++) for (let j = 1; j <= M1; j++) if (i * 100 + j < ti * 100 + tj) known.add(K(i, j));
    const opts = [`${up + left}: above plus left`, `${Math.max(up, left)}: the larger of above and left, as with the pumpkins`, `${right}: the up-left cell plus one`];
    const correct = 2;
    let ans = null;
    const paint = () => {
      const ok = ans === correct, k = K(ti, tj), rows = tRows(known, ok ? null : k);
      if (ok) rows[ti][tj] = right;
      const cls = { [k]: ok ? "enter" : "next", [K(ti - 1, tj - 1)]: "in" };
      el.innerHTML = `<h1>A new order for the homepage</h1>
        <p class="lead">A new idea. The patch has a website, and a designer sent a new order for its homepage sections. Sections that stay in the same order as each other can stay put; every other one has to be cut and pasted. Here ${e(andList(TRACE.kept))} are already in the same order on both pages, so only ${e(andList(MOVED))} ${MOVED.length === 1 ? "needs" : "need"} to move. So you want the <b>most sections both orders share, in the same order</b>.</p>
        ${kit.pics.side(`<div class="lp"><div class="lp-cap">old order</div>${pageCells(kit, OLD)}</div>`, `<div class="lp"><div class="lp-cap">new order</div>${pageCells(kit, NEW)}</div>`)}
        <p class="lead">Each cell looks at a shorter version of both pages: the old page cut after its row's section, and the new page cut after its column's section. The first row and column stand for an empty page: it shares nothing, so they are 0. The cell for old <b>${e(join(OLD.slice(0, 2)))}</b> and new <b>${e(join(NEW.slice(0, 3)))}</b> says ${T[2][3]}: they share ${e(andList(sharedOf(2, 3)))}, in that order on both.</p>
        <p class="task">The outlined cell compares old ${e(join(OLD.slice(0, ti)))} with new ${e(join(NEW.slice(0, tj)))}. Both end with ${last}. Without that last section each, the up-left cell says ${d}. What goes in the outlined cell?</p>
        ${tPic(kit, rows, { cls, from: ok ? { [k]: [[ti - 1, tj - 1]] } : {}, title: "most shared, in order" })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. The ${d} shared sections come before ${last} on both pages, and ${last} is last on both, so it can follow them on both: ${d} + 1 = <b>${right}</b>. When the two last sections match, step diagonally up-left and add one.`, true)
          : ans === 1 ? kit.feedback(`Above and left each leave ${last} out of one page, so neither can keep it. Here both pages end with ${last}, so you can keep it on both: take the up-left cell, ${d}, and add one.`, false)
          : kit.feedback(`Above and left both count ${e(andList(overlapOf(ti, tj)))}, so adding them counts those twice. ${up + left} is more than these two short pages could ever share.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 6. Fill the table yourself. */
  const FILL2 = [];
  for (let i = 2; i <= N1; i++) for (let j = 1; j <= M1; j++) FILL2.push([i, j]);
  function fillStrings({ el, done, kit }) {
    const known = new Set(NEW.map((_, j) => K(1, j + 1)));
    let k = 0, wrong = null, said = null;
    const paint = () => {
      const fin = k === FILL2.length;
      const [i, j] = fin ? [N1, M1] : FILL2[k];
      const same = OLD[i - 1] === NEW[j - 1], a = kit.esc(OLD[i - 1]), b = kit.esc(NEW[j - 1]), d = T[i - 1][j - 1], up = T[i - 1][j], left = T[i][j - 1], right = T[i][j];
      const ov = overlapOf(i, j);
      const twice = ov.length ? `Above and left both count ${kit.esc(andList(ov))}, so adding them counts ${ov.length === 1 ? "it" : "those"} twice.`
        : `Above and left both count some of the same kept sections, so adding them counts those twice.`;
      // wrong answers in priority order: [value, the mistake behind it]; the first reason for a value wins
      const why = same ? [
        [Math.max(up, left), `${a} ends both short pages, so it can be kept on both. Do not settle for the larger of above and left: take up-left, ${d}, plus one.`],
        [d, `${a} is kept on both pages, so it adds one to the up-left ${d}: ${d} + 1.`],
        [up + left, `${twice} ${a} matches: take up-left, ${d}, plus one.`]
      ] : [
        [d + 1, `${a} and ${b} are different sections, so there is no new match to count. Up-left plus one is only for a match. Take the larger of above and left: ${Math.max(up, left)}.`],
        [Math.min(up, left), `${Math.min(up, left)} is the smaller of above and left. You want the most sections kept: ${Math.max(up, left)}.`],
        [up + left, `${twice} Take the larger, ${Math.max(up, left)}.`]
      ];
      const reason = new Map();
      why.forEach(([x, m]) => { if (x !== right && !reason.has(x)) reason.set(x, m); });
      const opts = fin ? [] : [right, ...reason.keys()].sort((x, y) => x - y);
      const rows = tRows(known, fin ? null : K(i, j)), cls = {}, from = {};
      if (fin) TRACE.hits.forEach(q => { cls[q] = "enter"; const [x, y] = q.split(",").map(Number); from[q] = [[x - 1, y - 1]]; });
      else { cls[K(i, j)] = "next"; if (same) cls[K(i - 1, j - 1)] = "in"; else { cls[K(i - 1, j)] = "in"; cls[K(i, j - 1)] = "in"; } }
      el.innerHTML = `<h1>Fill the table, cell by cell</h1>
        <p class="lead">Same two orders. Row by row, left to right. When the row's section and the column's section <b>match</b>, take the up-left cell plus one. When they <b>differ</b>, one of them cannot be kept here, so drop one. The row above covers the same old sections minus this one; the column to the left covers the same new sections minus this one. Take the larger, as with the pumpkins.</p>
        ${fin ? "" : `<p class="task">Row ${a}, column ${b}: ${same ? "they match" : "they differ"}. Above: ${up}. Left: ${left}. Up-left: ${d}. What goes in the outlined cell?</p>`}
        ${tPic(kit, rows, { cls, from, title: "most shared, in order" })}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong != null ? kit.feedback(reason.get(wrong), false)
          : said ? kit.feedback(said[0], said[1]) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(bt => bt.onclick = () => {
        const x = opts[+bt.dataset.i];
        if (x !== right) { wrong = x; paint(); return; }
        wrong = null; known.add(K(i, j)); k++;
        if (k === FILL2.length) {
          const big = 20, a1 = 2 ** N1 * M1, a2 = 2 ** big * big;
          said = [`The last cell is the answer: <b>${KEEP}</b>. Walk back from it: at a match go up-left, otherwise go to the larger neighbour. The filled cells are the matches: keep ${kit.esc(TRACE.kept.join(", "))} where they are and move ${kit.esc(MOVED.join(", "))}, so ${N1} − ${KEEP} = ${plural(N1 - KEEP, "section")} to cut and paste. The slow way: each of the ${N1} old sections is either kept or not, so there are 2<sup>${N1}</sup> sets to try, each checked against ${M1} new sections. That is 2<sup>${N1}</sup> × ${M1} = ${fmt(a1)} steps here against ${N1 * M1} cells: about ${fmt(Math.round(a1 / (N1 * M1)))} times fewer steps. For two pages of ${big} sections: ${fmt(a2)} against ${fmt(big * big)}, about ${fmt(Math.round(a2 / (big * big)))} times fewer steps.`, true];
          paint(); done(); return;
        }
        said = [same ? `${a} matches ${b}: ${d} + 1 = ${right}.` : `${a} and ${b} differ: the larger of ${up} and ${left} is ${right}.`];
        paint();
      });
    };
    paint();
  }

  /* 7. The table as code. */
  const CODE2 = [
    "const n = a.length, m = b.length;",
    "const t = Array.from({ length: n + 1 },",
    "  () => Array(m + 1).fill(0));",
    "for (let i = 1; i <= n; i++)",
    "  for (let j = 1; j <= m; j++)",
    "    t[i][j] = a[i - 1] === b[j - 1]",
    "      ? t[i - 1][j - 1] + 1",
    "      : Math.max(t[i - 1][j], t[i][j - 1]);",
    "return t[n][m];"
  ];
  const FR2 = (() => {
    const g = T.map(row => row.map(() => 0)), known = new Set();
    const snap = () => g.map((row, i) => row.map((v, j) => !i || !j || known.has(K(i, j)) ? v : ""));
    const fr = [{ ln: 1, g: snap(), say: `<code>a</code> is the old order, <code>b</code> the new, <code>n</code> and <code>m</code> their lengths, <code>t</code> the table. <code>t</code> gets a row and a column of zeros: an empty page shares nothing.` }];
    for (let i = 1; i <= N1; i++) for (let j = 1; j <= M1; j++) {
      const same = OLD[i - 1] === NEW[j - 1];
      g[i][j] = T[i][j]; known.add(K(i, j));
      fr.push({ ln: same ? 6 : 7, g: snap(), i, j, say: e => same
        ? `i = ${i}, j = ${j}: a[${i - 1}] and b[${j - 1}] are both "${e(OLD[i - 1])}". Up-left ${T[i - 1][j - 1]} + 1 = ${T[i][j]}.`
        : `i = ${i}, j = ${j}: "${e(OLD[i - 1])}" and "${e(NEW[j - 1])}" differ. The larger of ${T[i - 1][j]} and ${T[i][j - 1]} is ${T[i][j]}.` });
    }
    fr.push({ ln: CODE2.length - 1, g: snap(), say: `The loops end. <code>t[n][m]</code>, the last cell, is ${KEEP}: the same answer you filled by hand.` });
    return fr;
  })();
  function stringsCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR2[i], cls = {}, from = {};
      if (f.i != null) {
        const k = K(f.i, f.j), src = srcOf(f.i, f.j);
        cls[k] = "enter"; src.forEach(([x, y]) => { cls[K(x, y)] = "in"; }); from[k] = src;
      }
      el.innerHTML = `<h1>The same table, written as code</h1>
        <p class="lead">Row <code>i</code> stands for the first <code>i</code> old sections, column <code>j</code> for the first <code>j</code> new ones. So the sections being compared are <code>a[i - 1]</code> and <code>b[j - 1]</code>.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the table.</p>
        ${tPic(kit, f.g, { cls, from, title: "t" })}
        ${kit.code(CODE2, f.ln)}
        <div class="vars"><span>i <b>${f.i ?? "–"}</b></span><span>j <b>${f.j ?? "–"}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(typeof f.say === "function" ? f.say(kit.esc) : f.say)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A delivery robot crosses a city from its depot to a client on the opposite corner of a block grid, only ever heading east or north. Some crossings are closed for roadworks. How many different routes can it take?", true,
      "Yes. Every route into a crossing arrives from the south or from the west, so its count is the two counts added (here you add, because you count routes instead of keeping the best). A closed crossing holds 0.",
      "Each crossing can only be reached from the one to the south or the one to the west, so it gets its number from two cells already filled. That is the pumpkin grid, with counts added instead of the larger one kept, and 0 on closed crossings."],
    ["A spell checker suggests the dictionary word that needs the fewest single-letter changes (add, remove or replace one letter) to match what you typed.", true,
      "Yes. Two words, compared by their beginnings: a table over every pair of beginnings, where each cell comes from the cell above, to the left and up-left. Same idea as the homepage table, with a different rule per cell.",
      "It compares two strings in order, and the cost for two beginnings depends on slightly shorter beginnings: drop a letter from one word (above or left) or match the last letters (up-left). That is a table over pairs of beginnings, like the homepage one."],
    ["A park map: paths link benches in every direction, up, down, left and right. Find the shortest walk from the gate to the fountain.", false,
      "No. It looks like a grid, but the table only works because every bed's ways in were filled before it. Here you can walk up or left too, so a bench can be reached from a bench that comes later in any filling order. There is no order to fill in. A search that spreads out from the gate (the graphs topic) fits.",
      "It is drawn as a grid, but the table needs every cell's ways in to be filled before the cell itself. Paths here go up and left too, so a bench can depend on benches further along, which depend on it in turn. No row-by-row order works. A search spreading out from the gate (the graphs topic) does."],
    ["Two wedding guest lists, in no particular order. Which guests are invited to both weddings?", false,
      "No. The table respects order: it walks both lists front to back and keeps only shared items in the same order. Here order means nothing. Put one list in a Set and check each guest of the other once, instead of filling a whole table.",
      "Both are lists, but the table is for when order matters: it keeps only items shared in the same order. The guest lists have no order, so the table would miss guests who appear in a different position. A Set of one list, checked once per guest of the other, gives every shared guest."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a 2-D table work here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations away from the pumpkin patch.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}
        ${CASES.every(([, y], j) => ans[j] === (y ? 0 : 1)) ? kit.feedback("This is <b>2-D dynamic programming</b>: store the answer to every smaller version in a table, fill it in an order where each cell's sources are ready, and read the answer from the last cell. The homepage one is called the <b>longest common subsequence</b>.") : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. On to the problems. */
  const TAUGHT = {
    "grid-paths": "You did this with the pumpkin patch: each cell from the cell above and the cell to the left, row by row.",
    "two-strings": "You did this with the homepage sections: a table over every pair of beginnings of two lists."
  };
  function toProblems({ el, done, kit, topic }) {
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${kit.practice(topic || { problems: [], subs: [] }, TAUGHT)}`;
    done();
  }

  LessonKit.define("dp-2d", {
    title: "2-D dynamic programming",
    teaches: ["grid-paths", "two-strings"],
    screens: [slowWay, spotTrick, fillIt, asCode, spotStrings, fillStrings, stringsCode, recognise, toProblems],
    walk: [
      { wrong: [`[data-i="${K(1, 1)}"]`], right: [
        ...["0,1", "0,2", "0,3", "1,3", "2,3"], ...["1,0", "2,0", "2,1", "2,2", "2,3"], ...["0,1", "1,1", "1,2", "2,2", "2,3"]
      ].map(k => `[data-i="${k}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(FILL.length).fill("[data-right]") },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(FILL2.length).fill("[data-right]") },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
