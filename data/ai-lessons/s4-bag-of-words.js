/* Lesson: bag of words. Story: a job board wants to group vacancy ads and finds that word counts cannot tell
   "Remote, no night shifts." from "Night shifts, no remote." Ideas: (1) a count matrix keeps which words an ad
   uses and how often, and throws away where they stand, so ads with opposite meaning can get identical rows;
   (2) the vocabulary is fixed when it is built, so words it has never seen vanish from a new ad's row.
   Depth: explain (screens 1-3, 6, 7), scratch (screen 4, count_row replayed from a real trace), when-not
   (screens 6 and 7).
   Data, all real: docs/ai-path/runs/s4-bag-of-words/bag_of_words.py + bag_of_words.out.txt (vocabulary,
   the six rows, the identical pair, the new ad's row, the word-pair columns, the traced run of count_row on ad 6).
   No model calls were recorded for this lesson.
   Lesson-local style: a count matrix with tappable cells and pickable rows (.lx-s4-bag-of-words-*), see
   ensureStyle(). Plain browser script. */
(() => {
  const ID = "s4-bag-of-words";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  /* ---------- Data copied from docs/ai-path/runs/s4-bag-of-words/bag_of_words.out.txt ---------- */
  const ADS = [
    "Remote, no night shifts.",
    "Night shifts, good pay.",
    "Day shifts, good pay, no remote.",
    "Remote, day shifts.",
    "Night shifts, no remote.",
    "Night shifts? No. Day shifts, good pay."
  ];
  const VOCAB = { remote: 0, no: 1, night: 2, shifts: 3, good: 4, pay: 5, day: 6 };
  const VOCAB_PRINTED = '{"remote": 0, "no": 1, "night": 2, "shifts": 3, "good": 4, "pay": 5, "day": 6}'; // first line of the output, as printed
  const MATRIX = [
    [1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0],
    [1, 1, 0, 1, 1, 1, 1],
    [1, 0, 0, 1, 0, 0, 1],
    [1, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 2, 1, 1, 1]
  ];
  const NEW_AD = "Remote warehouse job, no night shifts.";
  const NEW_ROW = [1, 1, 1, 1, 0, 0, 0];
  const PAIRS = ["remote no", "no night", "night shifts", "shifts good", "good pay", "day shifts", "pay no", "no remote", "remote day", "shifts no", "no day"];
  const PAIRS_AD1 = ["remote no", "no night", "night shifts"];
  const PAIRS_AD5 = ["night shifts", "shifts no", "no remote"];
  // The listing is count_row from bag_of_words.py, line for line (line 0 = def).
  const CODE = [
    "def count_row(ad, vocabulary):",
    "    row = [0] * len(vocabulary)",
    "    for word in WORD.findall(ad.lower()):",
    "        if word in vocabulary:",
    "            row[vocabulary[word]] += 1",
    "    return row"
  ];
  // Trace of count_row(ad 6, vocabulary): [line about to run, event (l = line, r = return), row, word]
  const TRACE = [[1,"l",null,null],[2,"l",[0,0,0,0,0,0,0],null],[3,"l",[0,0,0,0,0,0,0],"night"],[4,"l",[0,0,0,0,0,0,0],"night"],[2,"l",[0,0,1,0,0,0,0],"night"],[3,"l",[0,0,1,0,0,0,0],"shifts"],[4,"l",[0,0,1,0,0,0,0],"shifts"],[2,"l",[0,0,1,1,0,0,0],"shifts"],[3,"l",[0,0,1,1,0,0,0],"no"],[4,"l",[0,0,1,1,0,0,0],"no"],[2,"l",[0,1,1,1,0,0,0],"no"],[3,"l",[0,1,1,1,0,0,0],"day"],[4,"l",[0,1,1,1,0,0,0],"day"],[2,"l",[0,1,1,1,0,0,1],"day"],[3,"l",[0,1,1,1,0,0,1],"shifts"],[4,"l",[0,1,1,1,0,0,1],"shifts"],[2,"l",[0,1,1,2,0,0,1],"shifts"],[3,"l",[0,1,1,2,0,0,1],"good"],[4,"l",[0,1,1,2,0,0,1],"good"],[2,"l",[0,1,1,2,1,0,1],"good"],[3,"l",[0,1,1,2,1,0,1],"pay"],[4,"l",[0,1,1,2,1,0,1],"pay"],[2,"l",[0,1,1,2,1,1,1],"pay"],[5,"l",[0,1,1,2,1,1,1],"pay"],[5,"r",[0,1,1,2,1,1,1],"pay"]];
  const TRACED_AD = 5; // the trace is count_row(ADS[5]), ad 6

  /* ---------- Derived from the data ---------- */
  const WORDS = Object.keys(VOCAB).sort((a, b) => VOCAB[a] - VOCAB[b]);
  const W = WORDS.length, N = ADS.length;
  const TWINS = (() => { for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (same(MATRIX[i], MATRIX[j])) return [i, j]; return null; })();
  const NEW_SAME = MATRIX.map((r, i) => same(r, NEW_ROW) ? i : -1).filter(i => i >= 0);
  const tokens = s => s.toLowerCase().match(/[a-z]+/g) || [];
  const UNSEEN = tokens(NEW_AD).filter(w => !(w in VOCAB));
  const FILLED = 3; // rows 0..2 are shown filled on screen 1; the learner fills the rest
  const SHIFTS_ADS = MATRIX.filter(r => r[VOCAB.shifts] > 0).length;
  const ZEROS = MATRIX.flat().filter(v => v === 0).length;
  const adName = i => `ad ${i + 1}`;
  const AdName = i => `Ad ${i + 1}`;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-ads { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-ads li { display: grid; grid-template-columns: 3.4em 1fr; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 16px; line-height: 1.45; }
      .lx-${ID}-ads b { font: 600 13px/1.9 var(--mono); color: var(--muted); }
      .lx-${ID}-ads li.lx-${ID}-hi { border-left: 3px solid var(--ink); padding-left: 8px; }
      .lx-${ID}-mx { margin: 16px 0 0; display: grid; gap: 3px; max-width: 520px; }
      .lx-${ID}-mx > * { min-width: 0; }
      .lx-${ID}-h { font: 600 10.5px/1.2 var(--mono); letter-spacing: -.04em; color: var(--muted); text-align: center; align-self: end; white-space: nowrap; overflow: visible; padding-bottom: 3px; }
      .lx-${ID}-rh { font: 600 13px var(--mono); color: var(--muted); display: flex; align-items: center; }
      .lx-${ID}-c { min-height: 44px; display: flex; align-items: center; justify-content: center; font: 600 16px var(--mono); color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 4px; }
      .lx-${ID}-c.lx-${ID}-z { color: var(--faint); font-weight: 500; }
      button.lx-${ID}-c { cursor: pointer; background: var(--surface); border: 1.5px solid var(--ink-2); }
      .lx-${ID}-c.lx-${ID}-no { background: var(--bad-soft); border: 2px solid var(--bad); }
      .lx-${ID}-c.lx-${ID}-ok { background: var(--good-soft); border-color: var(--good); }
      button.lx-${ID}-rb { min-height: 44px; font: 600 13px var(--mono); color: var(--ink); background: var(--surface); border: 1.5px solid var(--ink-2); border-radius: 4px; cursor: pointer; padding: 0 2px; }
      button.lx-${ID}-rb[aria-pressed="true"] { border: 3px solid var(--ink); }
      .lx-${ID}-rb.lx-${ID}-no { background: var(--bad-soft); border-color: var(--bad); }
      .lx-${ID}-rb.lx-${ID}-ok { background: var(--good-soft); border-color: var(--good); }
      .lx-${ID}-row { display: contents; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-opt { font: 500 15px/1.45 var(--mono); text-align: left; }
      .lx-${ID}-check { margin-top: 14px; min-height: 44px; }
    `;
    document.head.appendChild(s);
  }
  const adList = (kit, hi = []) => `<ul class="lx-${ID}-ads">${ADS.map((a, i) => `<li${hi.includes(i) ? ` class="lx-${ID}-hi"` : ""}><b>${AdName(i)}</b><span>${kit.esc(a)}</span></li>`).join("")}</ul>`;
  /* Count matrix. rows: arrays of numbers (or null for an empty cell). opts.edit(i) -> cells of row i are buttons;
     opts.cls[i,j] -> "no" | "ok"; opts.pickRow -> row heads are buttons (data-row), opts.picked: Set, opts.rowCls[i]. */
  function matrix(kit, rows, o = {}) {
    const cols = `grid-template-columns: 2.9em repeat(${W}, minmax(0, 1fr))`;
    let h = `<span></span>${WORDS.map(w => `<span class="lx-${ID}-h">${kit.esc(w)}</span>`).join("")}`;
    rows.forEach((r, i) => {
      h += o.pickRow
        ? `<button type="button" class="lx-${ID}-rb${o.rowCls && o.rowCls[i] ? ` lx-${ID}-${o.rowCls[i]}` : ""}" data-row="${i}" aria-pressed="${o.picked && o.picked.has(i) ? "true" : "false"}">${AdName(i)}</button>`
        : `<span class="lx-${ID}-rh">${o.labels ? o.labels[i] : AdName(i)}</span>`;
      r.forEach((v, j) => {
        const c = o.cls && o.cls[`${i},${j}`] ? ` lx-${ID}-${o.cls[`${i},${j}`]}` : "";
        const z = v === 0 ? ` lx-${ID}-z` : "";
        if (o.edit && o.edit(i)) h += `<button type="button" class="lx-${ID}-c${z}${c}" data-i="${i},${j}" aria-label="${AdName(i)}, ${kit.esc(WORDS[j])}: ${v}">${v}</button>`;
        else h += `<span class="lx-${ID}-c${z}${c}">${v == null ? "" : v}</span>`;
      });
    });
    return `<div class="lx-${ID}-mx" style="${cols}" ${o.title ? `aria-label="${kit.esc(o.title)}"` : ""}>${h}</div>`;
  }
  const rowTxt = r => `[${r.join(", ")}]`;
  const ask = (kit, opts, correct, picked, fb) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;

  /* 1. The situation, and filling the count matrix by hand. */
  function countByHand({ el, done, kit }) {
    ensureStyle();
    const mine = MATRIX.map((r, i) => i < FILLED ? r.slice() : r.map(() => 0));
    let checked = null; // null = not checked since the last tap; else list of wrong "i,j"
    const paint = () => {
      const cls = {};
      if (checked) {
        if (checked.length) checked.forEach(k => cls[k] = "no");
        else for (let i = FILLED; i < N; i++) for (let j = 0; j < W; j++) cls[`${i},${j}`] = "ok";
      }
      let fb = "";
      if (checked && checked.length) {
        const say = checked.slice(0, 3).map(k => {
          const [i, j] = k.split(",").map(Number), want = MATRIX[i][j], got = mine[i][j];
          return `${AdName(i)}, “${kit.esc(WORDS[j])}”: you put ${got}, but the ad ${want === 0 ? "does not use it" : `uses it ${want === 1 ? "once" : want + " times"}`}.`;
        }).join(" ");
        const started6 = mine[5].some(v => v > 0);
        const hint = !started6 ? "" : checked.some(k => k === `5,${VOCAB.no}`) ? " Punctuation only cuts words apart: “No.” on its own is still the word “no”." : checked.some(k => k === `5,${VOCAB.shifts}`) ? " A cell counts every time the word appears, not just whether it is there." : "";
        fb = kit.feedback(`${plural(checked.length, "cell")} ${checked.length === 1 ? "does" : "do"} not match the ads. ${say}${hint}`, false);
      } else if (checked) {
        fb = kit.feedback(`All ${N * W} cells match. This table is a <b>count matrix</b>: one row per ad, one column per word, and each cell says how many times that word appears in that ad. Every ad, long or short, is now a row of exactly ${W} numbers, which is what a program can compare.`, true);
      }
      el.innerHTML = `<h1>Six ads, counted</h1>
        <p class="lead">A job board wants to group ads that offer the same job, so a job seeker sees one group instead of ten near-copies. A program cannot compare text directly; it needs numbers. Its first try does not read the ads. It counts words: the simplest way to turn text into numbers.</p>
        ${adList(kit)}
        <p class="lead">The rule: make the ad lowercase. Cut it at anything that is not a letter (spaces, commas, full stops, question marks). In the last two lessons a token could be part of a word; here every token is a whole word, so you can count by eye. Each different word gets one column. The list of these words is the <b>vocabulary</b>. Rows 1 to ${FILLED} are done.</p>
        <p class="task">Fill rows ${FILLED + 1} to ${N}. Tap a cell to add one (after 2 it goes back to 0), then press Check.</p>
        ${matrix(kit, mine, { edit: i => i >= FILLED, cls, title: "count matrix" })}
        <div class="lpanel"><button type="button" class="btn lx-${ID}-check" data-check>Check</button>${fb}</div>`;
      el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
        const [i, j] = b.dataset.i.split(",").map(Number);
        mine[i][j] = (mine[i][j] + 1) % 3; checked = null; paint();
      });
      el.querySelector("[data-check]").onclick = () => {
        checked = [];
        for (let i = FILLED; i < N; i++) for (let j = 0; j < W; j++) if (mine[i][j] !== MATRIX[i][j]) checked.push(`${i},${j}`);
        paint();
        if (!checked.length) done();
      };
    };
    paint();
  }

  /* 2. Find the two ads with identical rows (byHand, second half). */
  function findTwins({ el, done, kit }) {
    ensureStyle();
    let picked = new Set(), result = null; // result: null | "ok" | "no"
    const diffCols = (a, b) => WORDS.filter((_, j) => MATRIX[a][j] !== MATRIX[b][j]);
    const paint = () => {
      const p = [...picked].sort((a, b) => a - b);
      let fb = "";
      if (result === "no") {
        const d = diffCols(p[0], p[1]);
        fb = kit.feedback(`${AdName(p[0])} and ${adName(p[1])} differ in ${plural(d.length, "column")}: ${d.map(w => `“${kit.esc(w)}”`).join(", ")}. Compare the rows number by number, not the ads' meaning. Pick two other rows.`, false);
      } else if (result === "ok") {
        fb = kit.feedback(`Right: ${adName(TWINS[0])} and ${adName(TWINS[1])} have the same row, ${rowTxt(MATRIX[TWINS[0]])}. Now read them. ${AdName(TWINS[0])} is a remote job with no night shifts. ${AdName(TWINS[1])} is a night-shift job that is not remote. Opposite offers, and the board puts them in one group. Meanwhile ${adName(3)} (“${kit.esc(ADS[3])}”) means almost what ${adName(0)} means, and its row differs in ${plural(diffCols(0, 3).length, "column")}.`, true);
      }
      el.innerHTML = `<h1>Which two ads look the same?</h1>
        <p class="lead">The board puts ads with identical rows into one group. Here is the matrix you filled.</p>
        <p class="task">Find the two ads whose rows are identical: tap their row labels.</p>
        ${matrix(kit, MATRIX, { pickRow: true, picked, rowCls: result ? Object.fromEntries(p.map(i => [i, result])) : null, title: "count matrix" })}
        ${result === "ok" ? adList(kit, TWINS) : ""}
        <div class="lpanel">${fb}</div>`;
      el.querySelectorAll("[data-row]").forEach(b => b.onclick = () => {
        const i = +b.dataset.row;
        if (result === "ok") return;
        if (picked.size >= 2) { picked = new Set(); result = null; }
        if (picked.has(i)) picked.delete(i); else picked.add(i);
        if (picked.size === 2) {
          const q = [...picked].sort((a, b) => a - b);
          result = q[0] === TWINS[0] && q[1] === TWINS[1] ? "ok" : "no";
        }
        paint();
        if (result === "ok") done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: what the counts keep and what they throw away. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const [a, b] = TWINS;
    const opts = [
      "The vocabulary is too small. Add more words as columns.",
      "A cell keeps which word and how many times, not where it stands. The “no” before “night” and the “no” before “remote” are both just one “no”.",
      "“no” is a small, common word. Leave it out of the vocabulary.",
      "Every word counts the same. Weight the rarer words more."
    ];
    const RIGHT = 1;
    const fb = [
      [`Both ads use exactly the same four words. Any new column is a word that neither ad contains, so it is 0 in both rows. The rows stay identical however many columns you add.`, false],
      [`Right. Imagine tipping the words of each ad into a bag and shaking it: you can still count what is in the bag, but not what came first. That is why this method is called <b>bag of words</b>. It keeps the words and their counts. It loses the order, and with the order, which word a “no” belongs to. ${AdName(a)} and ${adName(b)} differ only in order, so no count can separate them.`, true],
      [`Then both rows lose their “no” the same way and are still identical. Worse, ${adName(a)} would now read “remote night shifts” to the board. The word that decided the meaning is the one you would drop.`, false],
      [`Weighting multiplies each column by a number (the next lesson does this). Two identical rows multiplied by the same numbers are still identical. Weights change how much a word counts, not where it stood.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why the counts are blind here</h1>
        <p class="lead">${AdName(a)}: “${kit.esc(ADS[a])}” and ${adName(b)}: “${kit.esc(ADS[b])}” both became ${rowTxt(MATRIX[a])}.</p>
        ${matrix(kit, [MATRIX[a], MATRIX[b]], { labels: [AdName(a), AdName(b)], title: "the two rows" })}
        <p class="task">Which explanation is the real reason the board cannot tell them apart?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. The same counting in Python, replayed from a real trace, with a prediction. */
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const prev = TRACE[k - 1], v = TRACE[k];
      if (v[1] === "r") { fr.push({ ln: 5, row: v[2], word: v[3], end: true }); continue; }
      if (prev[0] === 1) fr.push({ ln: 1, row: v[2], word: v[3] });          // after row = [0] * len(vocabulary)
      if (prev[0] === 4) fr.push({ ln: 4, row: v[2], word: v[3] });          // after one count was added
    }
    return fr;
  })();
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const RET = MATRIX[TRACED_AD];
    const once = RET.map(v => Math.min(v, 1));
    const noNo = RET.map((v, j) => j === VOCAB.no ? 0 : v);
    const opts = [rowTxt(once), rowTxt(noNo), rowTxt(RET)].map(t => `<span class="lx-${ID}-opt">${kit.esc(t)}</span>`);
    const RIGHT = 2;
    const fb = [
      [`That counts “shifts” as present or absent. <code>row[vocabulary[word]] += 1</code> adds 1 every time the loop meets a word, and ad 6 says “shifts” twice.`, false],
      [`That leaves out “no”. In “Night shifts? No. Day shifts” the word stands alone between full stops, but <code>WORD</code> (letters only) still finds it. Punctuation only separates words; it never removes one.`, false],
      [`Right. Now step through to see each count go in.`, true]
    ];
    const say = f => {
      if (f.end) return `<code>return row</code> gives back ${kit.esc(rowTxt(f.row))}, the same row you filled for ad 6 by hand.`;
      if (f.ln === 1) return `<code>row</code> starts as ${W} zeros, one per word in the vocabulary.`;
      const j = VOCAB[f.word];
      return `“${kit.esc(f.word)}” is in the vocabulary at column ${j} (columns count from 0), so the highlighted line added 1: <code>row[${j}]</code> is now ${f.row[j]}.`;
    };
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The counting, written in Python</h1>
        <p class="lead">First the program read all six ads once. It gave each new word the next column number. The real run built this vocabulary (word: column): <code>${kit.esc(VOCAB_PRINTED)}</code>.</p>
        <p class="lead">Then <code>count_row</code> turns one ad into one row. <code>WORD</code> is <code>re.compile(r"[a-z]+")</code>: a word is a run of letters, the same rule you counted by. Below is a replay of a real run on ad 6, “${kit.esc(ADS[TRACED_AD])}”.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 || ans == null ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>word <b>${kit.esc(f.word || "–")}</b></span><span>row <b>${kit.esc(rowTxt(f.row))}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(say(f))}
        <p class="task">Predict what <code>count_row</code> returns for ad 6. Then step through to the end (stepping opens once you have picked).</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1 && ans === RIGHT) done(); };
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === RIGHT && i === FR.length - 1) done(); });
    };
    paint();
  }

  /* 5. Use it with a prediction: a new ad with words the vocabulary has never seen. */
  function newAd({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const [a, b] = NEW_SAME;
    const opts = [
      `None: “${UNSEEN.join("” and “")}” make it different`,
      `Only ${adName(a)}`,
      `${AdName(a)} and ${adName(b)}`,
      `${AdName(3)}`
    ];
    const RIGHT = 2;
    const fb = [
      [`Look at the check <code>if word in vocabulary</code> in <code>count_row</code>. “${UNSEEN.join("” and “")}” have no column, so they are skipped without a word of warning. They cannot make the row different.`, false],
      [`Its row equals ${adName(a)}'s, and ${adName(b)}'s row equals ${adName(a)}'s too. Equal to one means equal to both.`, false],
      [`Right. The real run returned ${rowTxt(NEW_ROW)}, the same row as ${adName(a)} and ${adName(b)}. That is the second thing a count matrix loses: <b>words outside the vocabulary</b>. The vocabulary is fixed when it is built, so “${UNSEEN.join("” and “")}”, the words that say what the job is, leave no trace. scikit-learn's <code>CountVectorizer</code> behaves the same way: words not seen when the vocabulary was built are ignored when it counts new text.`, true],
      [`${AdName(3)} is “${kit.esc(ADS[3])}”: it has “day” and no “no” or “night”. The new ad uses “no”, “night” and no “day”.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>A new ad arrives</h1>
        <p class="lead">The board keeps the ${W}-word vocabulary it built and counts each new ad with <code>count_row</code>. A new ad comes in:</p>
        <p class="lead"><b>“${kit.esc(NEW_AD)}”</b></p>
        ${kit.code(CODE, ans === RIGHT ? 3 : -1)}
        <p class="task">Which existing ads will have exactly the same row as the new one?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. The big picture, with a task on the usual fix: counting neighbouring word pairs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const [a, b] = TWINS;
    const opts = [
      "Yes: they still use the same words",
      "No: the pair columns differ",
      "No: with pairs the board now keeps the full order of each ad"
    ];
    const RIGHT = 1;
    const fb = [
      [`The words are the same, but the pairs are not. ${AdName(a)}'s pairs: ${PAIRS_AD1.map(p => `“${p}”`).join(", ")}. ${AdName(b)}'s: ${PAIRS_AD5.map(p => `“${p}”`).join(", ")}. Only one pair is shared.`, false],
      [`Right. ${AdName(a)} has the pair “no night”, ${adName(b)} has “no remote”. In the real run the rows differ, because a pair keeps the order of two neighbours, and that is enough to tie “no” to the next word. The price: the six short ads gave ${plural(PAIRS.length, "pair column")} on top of the ${W} word columns, ${W + PAIRS.length} in all. In scikit-learn this is <code>CountVectorizer(ngram_range=(1, 2))</code>.`, true],
      [`The rows do differ, but pairs only tie each word to the one right next to it. In a longer ad such as “Remote role. Night shifts: no.” the “no” no longer sits next to “remote” or “night”, and the link is lost again. The order of a whole ad is never kept.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When word counts are enough</h1>
        <p class="lead"><b>What it does:</b> turns any text into a row of numbers of the same length, with no model and no training.</p>
        <p class="lead"><b>Reach for it</b> when the words themselves carry the meaning: sorting emails by topic, filtering spam, keyword search. It is also a good first version (a baseline) that any fancier method must beat.</p>
        <p class="lead"><b>Not</b> when order or a “no” decides the meaning (the task below tries a cheap patch; the full fix is a model that reads in order). Not when the same idea comes in different words, like “remote” and “work from home”: for that, use embeddings (lists of numbers that put similar meanings close together, later in this unit). Not when new words matter.</p>
        <p class="lead"><b>Costs:</b> the counting itself is almost free. But there is one column per different word, so real tables are very wide and almost all zeros (already ${ZEROS} of ${N * W} cells here; with thousands of words, nearly every cell). And the vocabulary must be rebuilt to learn new words.</p>
        <p class="task">The board also counts each pair of neighbouring words as an extra column. Do ${adName(a)} and ${adName(b)} still get identical rows?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(x => x.onclick = () => { ans = +x.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Recognise it in new situations, including two where word counts fail. */
  const CASES = [
    ["A shop routes incoming support emails to the billing team or the delivery team. Billing emails talk about invoices and refunds; delivery emails talk about couriers and parcels.", true,
      "Yes. Which words appear is the signal; their order hardly matters. A count matrix plus a simple classifier is a cheap, explainable first version.",
      "The two kinds of email use different words, and that alone separates them. Word counts capture exactly that, at almost no cost."],
    ["A banking chatbot must tell “move 200 from savings to card” from “move 200 from card to savings”.", false,
      "No. Both messages have the same words, each once, so their rows are identical: the same trap as the two job ads. Only the order says which way the money goes. Word pairs would split this exact pair (“from savings” against “from card”), but a bank cannot leave the direction of a payment to which neighbours happen to stand together. It needs something that reads the whole sentence and pulls out the source and the target, such as a model that reads the words in order.",
      "Count the words: move, 200, from, savings, to, card, once each in both. Identical rows, opposite actions. No classifier can separate two identical rows."],
    ["A forum wants to merge duplicate questions, such as “How do I reset my password?” and “Forgot my login code, how to change it?”", false,
      "No. These mean the same but share almost no words, so their rows look unrelated. Counts only match on the exact same words. Embeddings, which place similar meanings close together, fit this job.",
      "Compare the two rows: apart from “how” and “my”, no column is non-zero in both. Word counts see two different questions. The task is about meaning across different words, which counts cannot see."],
    ["A marketplace flags listings that mention any item from a list of banned products.", true,
      "Yes. A listing is flagged if a banned word appears at all; where it appears does not matter. A count above 0 in a banned word's column is the whole test.",
      "The rule only asks whether a word is present, and a count matrix answers that directly. Order would add nothing here."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Counts or not?</h1>
        <p class="lead">Four jobs from other teams. Word counts mean: each text becomes a row of how many times each word appears, order thrown away.</p>
        <p class="task">Would word counts do each job well? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 8. What next: a short Python exercise follows, then TF-IDF. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can count, and you know what counting loses</h1>
      <p class="lead">You turned ${N} ads into a ${N} × ${W} count matrix, found two opposite ads with identical rows, and saw why: a bag of words keeps which words and how many, and drops their order and every word outside its vocabulary.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you build the vocabulary and <code>count_row</code> yourself for a new set of texts, and find the texts whose rows come out identical.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Your counts treat “shifts”, which is in ${SHIFTS_ADS === N ? `all ${N}` : `${SHIFTS_ADS} of ${N}`} ads, the same as a rare, telling word; next you weight each column by how rare its word is.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Bag of words: counting instead of reading",
    checked: "2026-11-13",
    sources: [
      "https://scikit-learn.org/stable/modules/feature_extraction.html",
      "https://web.stanford.edu/~jurafsky/slp3/B.pdf"
    ],
    interview: [
      {
        q: "A ticket classifier built on word counts keeps confusing “refund approved, not shipped” with “shipped, refund not approved”. Explain why, and what you would try.",
        good: [
          "Both tickets contain the same words the same number of times, so their count rows are identical",
          "No classifier can separate two identical rows; more data or a different classifier will not help",
          "Add pairs of neighbouring words (n-grams) so that local order and negation show up as columns",
          "Check how often order really decides the label in real tickets before paying for a wider vocabulary",
          "If order matters often, move to a model that reads text in order"
        ],
        weak: "Add more training data or tune the classifier. That misses that the two inputs are already identical before any model sees them."
      },
      {
        q: "You have two days to ship a first filter that groups job ads by type. Would you start with word counts? What would you watch for?",
        good: [
          "Yes, as a baseline: no training of the representation, fast, and each column is a readable word",
          "Watch for ads that mean the same thing in different words; counts see them as unrelated",
          "Watch for order and negation flipping the meaning with the same words",
          "New words are ignored until the vocabulary is rebuilt, so plan to refresh it",
          "Store the matrix as sparse: it is wide and almost all zeros"
        ],
        weak: "Send every ad to a large language model from day one, without a cheap baseline to compare its cost and quality against."
      }
    ],
    screens: [countByHand, findTwins, spotIdea, asCode, newAd, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-check]"], right: [...MATRIX.slice(FILLED).flatMap((r, k) => r.flatMap((v, j) => Array(v).fill(`[data-i="${k + FILLED},${j}"]`))), "[data-check]"] },
      { wrong: ['[data-row="0"]', '[data-row="3"]'], right: [`[data-row="${TWINS[0]}"]`, `[data-row="${TWINS[1]}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", ...Array(FR.length - 1).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
