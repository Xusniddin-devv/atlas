/* Lesson: arrays and hashing. Two half-used bags of flour that must make exactly 500 g (look up the partner
   in a notebook instead of trying every pair), then a café letter box (count once, answer from the counts).
   Every number on screen is computed here from GOAL, BAGS, BOX, BOARD and CHECK. Plain browser script. */
(() => {
  const GOAL = 500, BAGS = [150, 210, 420, 250, 90, 375, 290], N = BAGS.length;
  const PAIRS = N * (N - 1) / 2;   // checks in the worst order: the pair's second bag comes out last
  const BIG = 1000;
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
  const BAG_LABELS = BAGS.map((_, i) => `bag ${i}`);
  // the pair, in the order bags come out of the cupboard: [earlier bag, the bag that completes it]
  const FIT = (() => { for (let j = 0; j < N; j++) for (let i = 0; i < j; i++) if (BAGS[i] + BAGS[j] === GOAL) return [i, j]; return null; })();
  const LAST = FIT[1];
  const sorted = BAGS.slice(0, LAST).map((w, i) => [w, i]).sort((a, b) => b[0] - a[0]);
  const HEAVY = sorted[0];

  /* 1. The slow way: each bag out of the cupboard is tried with every bag already on the counter. */
  function slowWay({ el, done, kit }) {
    const out = [];
    let cur = null, last = [], checks = 0, found = false;
    const paint = () => {
      const cls = {};
      out.forEach(i => { cls[i] = "in"; });
      if (found) cls[FIT[0]] = cls[FIT[1]] = "enter";
      const hit = found ? `${BAGS[cur]} + ${BAGS[cur === FIT[1] ? FIT[0] : FIT[1]]}` : "";
      el.innerHTML = `<h1>Two bags of flour, exactly ${GOAL} g</h1>
        <p class="lead">A recipe needs exactly <b>${GOAL} g</b> of flour, and you want to finish two half-used bags. Each bar is one bag in the cupboard, and the number is the grams left in it. Adding two bags and comparing with ${GOAL} counts as one check.</p>
        <p class="task">Tap a bag to take it out. It moves to the counter, marked as the key below the bars shows. Each new one gets checked against every bag already on the counter. Keep going until two bags make ${GOAL} g.</p>
        ${kit.bars(BAGS, { cls, frames: cur == null || found ? [] : [[cur, 1]], pick: found ? false : i => !out.includes(i), labels: BAG_LABELS })}
        ${kit.pics.key([["", "in the cupboard"], ["in", "on the counter"]])}
        <div class="lpanel">
          ${cur == null ? "" : `<div class="sum">${plural(checks, "check")}<small>${found ? "in all" : "so far"}</small></div>`}
          ${last.length ? `<div class="tried">${last.map(([j, s]) => `<span class="${s === GOAL ? "top1" : ""}">${BAGS[cur]} + ${BAGS[j]} <b>${s}</b></span>`).join("")}</div>` : ""}
          ${found ? kit.feedback(`Found it: <b>${hit} = ${GOAL}</b>, after ${plural(checks, "check")}. ${checks < PAIRS ? `That was a lucky order. In the worst order the pair comes out last, and the ${N} bags take ${PAIRS} checks.` : `Every new bag had to be tried against every bag already out, so the checks pile up: ${N} bags can take ${PAIRS}.`} A cupboard of ${fmt(BIG)} bags could take up to ${fmt(BIG * (BIG - 1) / 2)}.`, true)
            : cur == null ? ""
            : last.length ? kit.feedback(`No bag on the counter makes ${GOAL} with the ${BAGS[cur]}. It stays on the counter. ${plural(N - out.length, "bag")} still in the cupboard.`)
            : kit.feedback(`The ${BAGS[cur]} is the first bag out, so there is nothing to check it against yet. It waits on the counter.`)}
        </div>`;
      el.querySelectorAll("button.col").forEach(c => c.onclick = () => {
        const i = +c.dataset.i;
        cur = i; last = out.map(j => [j, BAGS[i] + BAGS[j]]);
        checks += last.length; out.push(i);
        if (last.some(([, s]) => s === GOAL)) found = true;
        paint();
        if (found) done();
      });
    };
    paint();
  }

  /* 2. Spot the trick: one bag has exactly one partner weight. */
  function spotTrick({ el, done, kit }) {
    let ans = null;
    const w = BAGS[LAST], need = GOAL - w;
    const opts = [`Is there another ${w} g bag on the counter?`, `Is there a bag of exactly ${need} g on the counter?`, "Which bag on the counter is the heaviest?"];
    const correct = 1;
    const paint = () => {
      const ok = ans === correct, cls = {};
      for (let i = 0; i < LAST; i++) cls[i] = "in";
      if (ok) cls[FIT[0]] = cls[LAST] = "enter";
      el.innerHTML = `<h1>One bag, one question</h1>
        <p class="lead">Bags 0 to ${LAST - 1} are on the counter. You take out bag ${LAST}: <b>${w} g</b>. The slow way adds it to each of the ${LAST} bags on the counter, one by one.</p>
        <p class="task">Which single question tells you whether bag ${LAST} completes a pair?</p>
        ${kit.bars(BAGS, { cls, frames: [[LAST, 1]], labels: BAG_LABELS })}
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ok
          ? kit.feedback(`Right. ${GOAL} − ${w} = ${need}, and only a ${need} g bag can complete the ${w}. Every bag has exactly one partner weight. So keep a notebook of the bags on the counter, one line per weight, and ask it one question for each new bag. Think of a notebook with a tab for every weight: you flip straight to the ${need} page without reading the others. So a look-up is one step, however many pages it has. Screen 4 shows how code does this.`, true)
          : ans === 0 ? kit.feedback(`Two ${w} g bags make ${2 * w} g, not ${GOAL}. The partner is not the same weight. It is what is missing: ${GOAL} − ${w}.`, false)
          : kit.feedback(`The heaviest bag on the counter is the ${HEAVY[0]}, and ${HEAVY[0]} + ${w} = ${HEAVY[0] + w}. Heavy or light does not matter. Only one weight makes exactly ${GOAL}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Use the notebook: for each bag, say which weight to look up; the lesson looks it up, then writes the bag down. */
  function notebook({ el, done, kit }) {
    const rows = [], at = new Map();
    let k = 0, wrong = null, said = null, fin = false, hit = -1, n = BIG;
    const paint = () => {
      const w = BAGS[k], need = GOAL - w;
      const opts = fin ? [] : [need, w, GOAL].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
      const cls = {};
      for (let i = 0; i < k; i++) cls[i] = "in";
      if (fin) cls[FIT[0]] = cls[FIT[1]] = "enter";
      el.innerHTML = `<h1>Keep a notebook</h1>
        <p class="lead">Same bags. Now you keep a notebook of the bags on the counter: each line says a weight and which bag it is. For each new bag, look up its partner first, then write the bag down.</p>
        ${fin ? "" : `<p class="task">Bag ${k} weighs ${w} g. Which weight do you look up in the notebook?</p>`}
        ${kit.bars(BAGS, { cls, frames: fin ? [] : [[k, 1]], labels: BAG_LABELS })}
        ${kit.table(rows, { head: ["weight (g)", "bag"], title: "Notebook", hit, fresh: fin ? -1 : rows.length - 1, empty: "nothing written yet" })}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(need), num: true })}
        ${wrong != null ? kit.feedback(wrong === GOAL
            ? `No single bag weighs ${GOAL} g. You want the bag that adds up to ${GOAL} with the ${w}: ${GOAL} − ${w}.`
            : `Looking up ${w} asks for a second ${w} g bag. Even if there were one, ${w} + ${w} = ${2 * w} g, not ${GOAL}. The partner is what is missing from ${GOAL}.`, false)
          : said ? kit.feedback(said[0], said[1]) : ""}
        ${fin ? `${kit.meter([{ label: "Every pair, worst order", value: PAIRS, max: PAIRS }, { label: "Notebook", value: k + 1, max: PAIRS, good: true }])}
          <div class="sliders"><label>Bags in the cupboard <input type="range" id="sn" min="1" max="6" step="1" value="${Math.log10(n)}"><b id="snv"></b></label></div>
          <div class="lbig" id="big"></div>
          <p>The price: the notebook keeps one line per bag, so it uses memory that grows with the cupboard.</p>` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== need) { wrong = v; paint(); return; }
        wrong = null;
        if (at.has(need)) {
          const j = at.get(need);
          hit = rows.findIndex(r => r[1] === j); fin = true;
          said = [`The notebook has a line for ${need}: bag ${j}. <b>${BAGS[j]} + ${w} = ${GOAL}</b>, the same pair you found by hand, after ${plural(k + 1, "look-up")} instead of up to ${plural(PAIRS, "check")}. Now make the cupboard bigger:`, true];
          paint(); done(); return;
        }
        rows.push([w, k]); at.set(w, k);
        said = [need === w
          ? `Bag ${k} (${w} g): no line for ${need} yet. That is correct: the only ${w} g bag is this one, and it cannot pair with itself. That is why you look first and write second. Bag ${k} goes in the notebook.`
          : `Bag ${k} (${w} g): no line for ${need}, so no bag on the counter fits. Bag ${k} goes in the notebook: ${w} g, bag ${k}.`];
        k++; paint();
      });
      const sn = el.querySelector("#sn");
      if (!sn) return;
      const upd = () => {
        el.querySelector("#snv").textContent = fmt(n);
        const all = n * (n - 1) / 2;
        el.querySelector("#big").innerHTML = `${fmt(all)} vs ${fmt(n)}<small>checks at worst when trying every bag on the counter, against one notebook look-up per bag. That is about ${fmt(Math.round(all / n))} times fewer checks, and the gap grows with the cupboard.</small>`;
      };
      sn.oninput = () => { n = 10 ** +sn.value; upd(); };
      upd();
    };
    paint();
  }

  /* 4. The same moves as code: the notebook is a Map. */
  const CODE1 = [
    "const seen = new Map(); // weight -> bag",
    "for (let i = 0; i < bags.length; i++) {",
    `  const j = seen.get(${GOAL} - bags[i]);`,
    "  if (j !== undefined) return [j, i];",
    "  seen.set(bags[i], i);",
    "}",
    `return null; // no two bags make ${GOAL}`
  ];
  const FR1 = (() => {
    const rows = [], seen = new Map();
    const fr = [{ ln: 0, i: "–", j: "–", k: -1, rows: [], say: "<code>seen</code> is the notebook, empty before any bag is out." }];
    for (let i = 0; i < N; i++) {
      const w = BAGS[i], need = GOAL - w;
      if (seen.has(need)) {
        const j = seen.get(need), hit = rows.findIndex(r => r[1] === j);
        fr.push({ ln: 2, i, j, k: i, rows: rows.slice(), hit, say: `i = ${i}. Look up ${GOAL} − ${w} = ${need}. There is a line for ${need}: bag ${j}.` });
        fr.push({ ln: 3, i, j, k: i, rows: rows.slice(), hit, fin: true, say: `j is ${j}, so return [${j}, ${i}]: the ${BAGS[j]} and the ${w}, the pair you found with the notebook. One look-up per bag.` });
        return fr;
      }
      fr.push({ ln: 2, i, j: "undefined", k: i, rows: rows.slice(), say: need === w
        ? `i = ${i}. Look up ${GOAL} − ${w} = ${need}. This bag is not written down yet, so it cannot find itself: j is undefined.`
        : `i = ${i}. Look up ${GOAL} − ${w} = ${need}. No line for ${need}, so <code>get</code> gives undefined.` });
      rows.push([w, i]); seen.set(w, i);
      fr.push({ ln: 4, i, j: "undefined", k: i, rows: rows.slice(), fresh: rows.length - 1, say: i === 0
        ? `The if is skipped, and bag 0 is written down: ${w} → 0. The if compares with undefined on purpose: <code>if (j)</code> would treat bag 0 as false and wrongly skip it.`
        : `The if is skipped. Write ${w} → ${i} into <code>seen</code>.` });
    }
    fr.push({ ln: 6, i: "done", j: "–", k: N, rows: rows.slice(), say: `No two bags make ${GOAL}.` });
    return fr;
  })();
  function asCode({ el, done, kit }) {
    let i = 0;
    const paint = () => {
      const f = FR1[i];
      el.innerHTML = `<h1>The same moves, written as code</h1>
        <p class="lead">The notebook is a JavaScript <code>Map</code>, and this idea has a name: a <b>hash map</b>. It turns each key into a position (that step is called <b>hashing</b>), so it jumps straight to that line instead of reading every line. A look-up costs about the same with ${N} lines or ${N} million. <code>bags</code> is the cupboard.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the notebook.</p>
        ${kit.table(f.rows, { head: ["key (weight)", "value (bag)"], title: "seen", hit: f.hit == null ? -1 : f.hit, fresh: f.fresh == null ? -1 : f.fresh, empty: "empty Map" })}
        ${kit.code(CODE1, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR1.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>i <b>${f.i}</b></span><span>bags[i] <b>${typeof f.i === "number" ? BAGS[f.i] : "–"}</b></span><span>j <b>${f.j}</b></span><span>step <b>${i + 1} / ${FR1.length}</b></span></div>
        ${kit.feedback(f.say)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR1.length - 1) done(); };
    };
    paint();
  }

  /* 5. A second idea: count the letter box once, by hand. */
  const BOX = "TEALTOCA".split(""), NB = BOX.length;
  const tally = letters => { const m = new Map(); letters.forEach(c => m.set(c, (m.get(c) || 0) + 1)); return m; };
  const COUNT = tally(BOX);
  function countBox({ el, done, kit }) {
    const counted = new Set(), m = new Map();
    let msg = null, fresh = -1, again = null;
    const paint = () => {
      const cls = {};
      counted.forEach(i => { cls[i] = "in"; });
      if (again != null) cls[again] = "dup";
      const rows = [...m];
      const fin = counted.size === NB;
      el.innerHTML = `<h1>Count the letter box once</h1>
        <p class="lead">A second idea. Your café writes its menu on a letter board, using plastic letters from a box. Before putting any words up, you count the box once: one line per letter, with how many tiles of it there are.</p>
        <p class="task">Tap every tile to count it. Any order works.</p>
        ${kit.cells(BOX, { cls, pick: !fin })}
        ${kit.table(rows, { head: ["letter", "tiles"], title: "Notebook", fresh, empty: "nothing counted yet" })}
        <div class="lpanel">${fin ? kit.feedback(`Counted: ${NB} tiles, ${COUNT.size} different letters, and each tile was read once. From now on you can answer questions about the box without opening it.`, true)
          : msg ? kit.feedback(msg[0], msg[1]) : ""}</div>`;
      el.querySelectorAll("button.cell").forEach(b => b.onclick = () => {
        const i = +b.dataset.i, c = BOX[i];
        if (counted.size === NB) return;
        if (counted.has(i)) {
          again = i;
          msg = [`You already counted this ${c}, so it is marked as a mistake. Counting it again adds one for a tile that is not there, so at the end the notebook would say ${c}: ${COUNT.get(c) + 1} when the box holds ${COUNT.get(c)}. Each tile is counted once.`, false];
          paint(); return;
        }
        again = null; counted.add(i);
        const had = m.get(c) || 0;
        m.set(c, had + 1);
        fresh = [...m.keys()].indexOf(c);
        msg = [had ? `Another ${c}: its line goes from ${had} to ${had + 1}.` : `A new letter: write a line for ${c} with 1.`];
        paint();
        if (counted.size === NB) done();
      });
    };
    paint();
  }

  /* 6. Answer from the counts: can each word go up? */
  const BOARD = ["LATTE", "COCOA", "TOAST"];
  const NEED = BOARD.map(w => tally(w.split("")));
  const SHORT = NEED.map(nd => [...nd].filter(([c, k]) => (COUNT.get(c) || 0) < k));
  const LETTERS = BOARD.reduce((a, w) => a + w.length, 0);
  const nm = (c, k) => k === 1 ? `one ${c}` : `${k} ${c}s`;
  const needTxt = nd => [...nd].map(([c, k]) => nm(c, k)).join(", ");
  // for a word that fits: name its repeated letters, the ones a learner may think fall short
  const repTxt = nd => { const r = [...nd].filter(([, k]) => k > 1); return r.length ? `: ${r.map(([c, k]) => `${nm(c, k)} needed, ${COUNT.get(c)} in the box`).join("; ")}` : ""; };
  const shortTxt = s => s.map(([c, k]) => COUNT.has(c) ? `${nm(c, k)} (the notebook says ${c}: ${COUNT.get(c)})` : `${nm(c, k)} (the notebook has no line for ${c})`).join(" and ");
  function fromCounts({ el, done, kit }) {
    const ans = BOARD.map(() => null);
    const paint = () => {
      const all = BOARD.every((_, i) => ans[i] === (SHORT[i].length ? 1 : 0));
      el.innerHTML = `<h1>Answer from the counts</h1>
        <p class="lead">${WORDS[BOARD.length] || BOARD.length} words for today's board. A word can go up only if the box has enough tiles of each of its letters. Use the notebook, not the box.</p>
        <p class="task">Decide for each word. Pick again if you change your mind.</p>
        ${kit.table([...COUNT], { head: ["letter", "tiles"], title: "Notebook" })}
        ${BOARD.map((w, i) => {
          const can = !SHORT[i].length, right = ans[i] === (can ? 0 : 1);
          return `<div class="lcase" id="c${i}"><p>Can the board say ${w}?</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: can ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(right
            ? (can ? `Yes. ${w} needs ${needTxt(NEED[i])}, and the notebook has at least that many of each.` : `No. ${w} needs ${shortTxt(SHORT[i])}.`)
            : (can ? `Every letter is covered. ${w} needs ${needTxt(NEED[i])}, and the notebook has at least that many of each${repTxt(NEED[i])}.`
              : SHORT[i].some(([ch]) => !COUNT.has(ch)) ? `Check every letter, not just most of them. ${w} needs ${shortTxt(SHORT[i])}.`
              : `Every letter of ${w} is in the box, but not enough of them. ${w} needs ${shortTxt(SHORT[i])}.`), right)}</div>`;
        }).join("")}
        ${all ? kit.meter([{ label: "Search the box for each letter", value: LETTERS * NB, max: LETTERS * NB }, { label: "Count once, then look up", value: NB + LETTERS, max: LETTERS * NB, good: true }])
          + kit.feedback(`Without the notebook, you would dig through all ${NB} tiles for each of the ${LETTERS} letters in the ${(WORDS[BOARD.length] || String(BOARD.length)).toLowerCase()} words (${BOARD.map(w => w.length).join(" + ")}): up to ${fmt(LETTERS * NB)} reads. Counting once takes ${NB} reads, then one look-up per letter: ${NB + LETTERS}. And the next word costs only its own letters.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BOARD.every((_, j) => ans[j] === (SHORT[j].length ? 1 : 0))) done();
      }));
    };
    paint();
  }

  /* 7. Counting as code: tally the box, then check one word against a copy of the counts. */
  const CHECK = BOARD.find((_, i) => SHORT[i].length && SHORT[i].every(([c]) => COUNT.has(c))) || BOARD[0];
  const CODE2 = [
    "const count = new Map(); // letter -> tiles",
    "for (const t of box) {",
    "  count.set(t, (count.get(t) ?? 0) + 1);",
    "}",
    "const left = new Map(count); // a copy",
    "for (const ch of word) {",
    "  const n = left.get(ch) ?? 0;",
    "  if (n === 0) return false;",
    "  left.set(ch, n - 1);",
    "}",
    "return true;"
  ];
  const FR2 = (() => {
    const m = new Map(), fr = [{ ln: 0, phase: "box", k: -1, rows: [], head: "count", say: "<code>count</code> is the notebook: letter → tiles. It starts empty." }];
    BOX.forEach((t, k) => {
      const had = m.get(t);
      m.set(t, (had || 0) + 1);
      fr.push({ ln: 2, phase: "box", k, rows: [...m], head: "count", fresh: [...m.keys()].indexOf(t), say: had
        ? `t = "${t}". <code>count.get</code> gives ${had}, so ${t} becomes ${had + 1}.`
        : `t = "${t}". No line for ${t} yet: <code>get</code> gives undefined, <code>?? 0</code> turns it into 0, so ${t} becomes 1.` });
    });
    const left = new Map(m), W = CHECK.split("");
    fr.push({ ln: 4, phase: "word", k: -1, rows: [...left], head: "left", say: `The box is counted. Now check "${CHECK}" against a copy, <code>left</code>. Instead of counting the word too, take one tile per letter from the copy. Running out of a letter means the word needs more of it than the box has.` });
    for (let k = 0; k < W.length; k++) {
      const ch = W[k], n = left.get(ch) || 0, at = [...left.keys()].indexOf(ch);
      fr.push({ ln: 6, phase: "word", k, rows: [...left], head: "left", fresh: at, say: `ch = "${ch}". <code>left</code> says ${n} ${ch} ${n === 1 ? "tile" : "tiles"} left.` });
      if (n === 0) {
        fr.push({ ln: 7, phase: "word", k, rows: [...left], head: "left", fresh: at, fin: true, say: `n is 0: no ${ch} left for this one. Return false. It is what you saw by hand: ${CHECK} needs ${NEED[BOARD.indexOf(CHECK)].get(ch)} ${ch}s and the box has ${COUNT.get(ch) || 0}.` });
        return fr;
      }
      left.set(ch, n - 1);
      fr.push({ ln: 8, phase: "word", k, rows: [...left], head: "left", fresh: at, say: `Use one ${ch}: ${n} → ${n - 1}.` });
    }
    fr.push({ ln: 10, phase: "word", k: W.length, rows: [...left], head: "left", fin: true, say: `Every letter found a tile. Return true.` });
    return fr;
  })();
  function countCode({ el, done, kit }) {
    let i = 0;
    const W = CHECK.split("");
    const paint = () => {
      const f = FR2[i], cls = {};
      const row = f.phase === "box" ? BOX : W;
      row.forEach((_, j) => { cls[j] = j < f.k ? "in" : j === f.k ? "next" : ""; });
      if (f.fin && f.ln === 7) cls[f.k] = "dup";
      el.innerHTML = `<h1>Counting, written as code</h1>
        <p class="lead">The notebook is a <code>Map</code> again, this time letter → count. <code>box</code> is the tiles and <code>word</code> is ${CHECK}.</p>
        <p class="task">Step through the code to the end. Match the highlighted line to the tiles and the notebook.</p>
        ${kit.cells(row, { cls })}
        ${kit.table(f.rows, { head: ["letter", "tiles"], title: `Map: ${f.head}`, fresh: f.fresh == null ? -1 : f.fresh, empty: "empty Map" })}
        ${kit.code(CODE2, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR2.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>reading <b>${f.phase === "box" ? "box" : "word"}</b></span><span>step <b>${i + 1} / ${FR2.length}</b></span></div>
        ${kit.feedback(f.say)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR2.length - 1) done(); };
    };
    paint();
  }

  /* 8. Recognise it in new situations, including one where a notebook does not help. */
  const CASES = [
    ["A sign-up form gets thousands of new usernames a minute. Before saving one, check that nobody has taken it.", true,
      "Yes. Keep every taken name in a Set (a notebook with keys only) and ask it once per new name. No reading through the whole list each time.",
      "Reading through every taken name for each sign-up is the slow way, like trying every bag. Keep the taken names in a Set and ask it once per new name."],
    ["Two words come in. Check whether one is the other with its letters shuffled, like LISTEN and SILENT.", true,
      "Yes. Count the letters of each word, then compare the two notebooks. Same letters, same counts: one is a shuffle of the other.",
      "This is the letter box again. Count the letters of each word and compare the counts. Same counts means one word is a shuffle of the other."],
    ["Exam scores are already sorted from low to high. Find two that add up to exactly 150, with no extra memory.", false,
      "No. A notebook would find them, but it keeps one line per score (the price you saw with the flour), and here you may not use extra memory. Since the scores are sorted, put one finger on each end: if the total is too small, move the left finger up; too big, move the right finger down. That is the next topic, two pointers.",
      "A notebook would find the pair, but it keeps one line per score (its price, as with the flour), and the task allows no extra memory. The list is sorted, so one finger on each end can walk toward the pair instead: too small, move the left one up; too big, move the right one down. That is the next topic, two pointers."],
    ["Find the highest temperature in a year of daily readings.", false,
      "No. There is nothing to look up later. Walk the readings once and keep the highest so far.",
      "A notebook remembers things to look up later, but here nothing is looked up. Walk the readings once and keep one number: the highest so far."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a notebook help here?</h1>
        <p class="lead">${WORDS[CASES.length] || CASES.length} situations without flour or letters. A notebook means a Map or a Set: look up a partner, check if you have seen something, or count.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. On to the problems: the groups this lesson taught first. */
  const TAUGHT = {
    "one-pass": "Like the highest temperature: one walk, a few values kept, no notebook.",
    "seen-set": "The notebook asking only “have I seen this?”, like the username check.",
    "counting": "You did this with the letter box: count once, answer from the counts.",
    "partner": "You did this with the flour: work out the partner, look it up, then write the bag down."
  };
  function toProblems({ el, done, kit, topic }) {
    // after the taught groups, label the rest so their out-of-order numbers make sense
    let list = kit.practice(topic || { problems: [], subs: [] }, TAUGHT);
    const at = list.indexOf('<li class="">');
    if (at > 0 && list.includes('<li class="hit">')) list = `${list.slice(0, at)}</ul><p class="lead">Not covered in this lesson yet:</p><ul class="lnext">${list.slice(at)}`;
    el.innerHTML = `<h1>You have the idea. Now use it.</h1>${list}`;
    done();
  }

  LessonKit.define("arrays-hashing", {
    title: "Arrays & hashing",
    teaches: ["partner", "counting"],
    screens: [slowWay, spotTrick, notebook, asCode, countBox, fromCounts, countCode, recognise, toProblems],
    walk: [
      { right: Array.from({ length: LAST + 1 }, (_, i) => `[data-i="${i}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(LAST + 1).fill("[data-right]") },
      { right: Array(FR1.length - 1).fill("[data-next]") },
      { wrong: ['[data-i="0"]', '[data-i="0"]'], right: Array.from({ length: NB - 1 }, (_, i) => `[data-i="${i + 1}"]`) },
      { wrong: ["#c1 [data-wrong]"], right: BOARD.map((_, i) => `#c${i} [data-right]`) },
      { right: Array(FR2.length - 1).fill("[data-next]") },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
