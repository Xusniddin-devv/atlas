/* Lesson: retrieval metrics (recall@k, precision@k, reciprocal rank and MRR).
   Story: a ski resort's staff assistant searches its operations manual for lift-closure and avalanche rules.
   Ideas: (1) score a retriever against a golden set of needed chunks, three numbers that answer three different
   questions; (2) a bigger k and a reranker move different numbers, and which number matters depends on the product.
   Data: docs/ai-path/runs/s5b-retrieval-metrics/ (manual.json: the made-up manual and golden labels;
   retrieve.py -> retrieve.out.txt / retrieve.json: a from-scratch TF-IDF keyword retriever, top results and scores;
   metrics.py -> metrics.out.txt: the metric numbers and the traced score_query run) and three recorded reranker
   answers in docs/ai-path/recordings/s5b-retrieval-metrics/rerank-q1|q2|q3.json.
   Every number on screen is computed here from MANUAL, GOLDEN, RET, REC and TRACE. Plain browser script. */
(() => {
  const ID = "s5b-retrieval-metrics";
  const P = "lx-" + ID + "-";
  let esc = s => String(s), kit_fb = (h, ok) => h;

  // From docs/ai-path/runs/s5b-retrieval-metrics/manual.json (made up for this lesson; trimmed to the chunks shown, M09 and M13 left out, wording not altered)
  const MANUAL = {
    M01: "Opening check: before the first guests board, the operator runs the empty chairlift for one full loop and logs the brake test.",
    M02: "Wind closure: close a chairlift when the wind at the top station stays above 60 km/h for ten minutes. The gondola may keep running up to 75 km/h.",
    M03: "Gusts: read the wind from the anemometer on the top station mast. A single gust does not close a lift; write it in the wind log.",
    M04: "Lightning: when the detector reports a strike within 10 km, stop loading guests at the bottom station and bring every occupied chair down to unload.",
    M05: "Reopening after a storm: wait 30 minutes after the last strike inside 10 km before any lift reopens.",
    M06: "The avalanche danger level comes from the regional warning service each morning, on its five-level danger scale. Post today's level at every lift.",
    M07: "Danger level 3: patrol puts a warning sign at every off-piste gate and checks the gates every two hours.",
    M08: "At level 4, close all off-piste gates and the Ridge chairlift. Only patrol may go past the ropes.",
    M10: "Ski school groups ride up before the public. Instructors count their guests at the top station.",
    M11: "Evacuation: if a chairlift stops for more than 15 minutes and cannot restart, start the rope evacuation and lower guests chair by chair.",
    M12: "Snow level 4 on the grooming board means the groomers work the upper runs first. It is not an avalanche level.",
    M14: "Lost ride pass: guests can still ride up after the desk blocks the old pass and prints a new one.",
    M15: "Strong wind: the operator may slow the chairlift to half speed before it reaches the closing limit.",
    M16: "Uphill guests on touring skis may go up the Blue run only before 8:00 and must stay at the edge."
  };
  const GOLDEN = [
    { id: "Q1", question: "At what wind speed does the chairlift close?", relevant: ["M02", "M03"] },
    { id: "Q2", question: "What must we close when the avalanche danger is level 4?", relevant: ["M08"] },
    { id: "Q3", question: "Can guests still ride up if there is thunder nearby?", relevant: ["M04", "M05"] }
  ];
  // From docs/ai-path/runs/s5b-retrieval-metrics/retrieve.json: the keyword retriever's top 6 per question, with scores
  const RET = {
    Q1: [["M15", 0.402], ["M02", 0.299], ["M03", 0.297], ["M08", 0.193], ["M01", 0.073], ["M11", 0.061]],
    Q2: [["M06", 0.41], ["M12", 0.358], ["M08", 0.271], ["M07", 0.174], ["M16", 0.133], ["M03", 0.077]],
    Q3: [["M14", 0.522], ["M10", 0.315], ["M16", 0.149], ["M02", 0.067], ["M01", 0.062], ["M04", 0.058]]
  };
  // From docs/ai-path/recordings/s5b-retrieval-metrics/rerank-q1|q2|q3.json (full answers, not altered)
  const REC = {
    src: "s5b-retrieval-metrics/rerank-q1, rerank-q2, rerank-q3",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: {
      Q1: "M15 5\nM02 10\nM03 2\nM08 0\nM01 0\nM11 0",
      Q2: "M06 0\nM12 0\nM08 10\nM07 0\nM16 0\nM03 0",
      Q3: "M14 0\nM10 0\nM16 0\nM02 0\nM01 0\nM04 10"
    }
  };
  // From docs/ai-path/runs/s5b-retrieval-metrics/metrics.out.txt: score_query traced on Q3 with k = 6.
  // Each step: [line, chunk (or c on line 2), rank, hits, recall, precision, rr, isReturn]
  const TRACE = [[1,null,null,null,null,null,null,false],[2,null,null,null,null,null,null,false],[2,"M14",null,null,null,null,null,false],[2,"M10",null,null,null,null,null,false],[2,"M16",null,null,null,null,null,false],[2,"M02",null,null,null,null,null,false],[2,"M01",null,null,null,null,null,false],[2,"M04",null,null,null,null,null,false],[3,null,null,["M04"],null,null,null,false],[4,null,null,["M04"],0.5,null,null,false],[5,null,null,["M04"],0.5,0.16666666666666666,null,false],[6,null,null,["M04"],0.5,0.16666666666666666,0.0,false],[7,"M14",1,["M04"],0.5,0.16666666666666666,0.0,false],[6,"M14",1,["M04"],0.5,0.16666666666666666,0.0,false],[7,"M10",2,["M04"],0.5,0.16666666666666666,0.0,false],[6,"M10",2,["M04"],0.5,0.16666666666666666,0.0,false],[7,"M16",3,["M04"],0.5,0.16666666666666666,0.0,false],[6,"M16",3,["M04"],0.5,0.16666666666666666,0.0,false],[7,"M02",4,["M04"],0.5,0.16666666666666666,0.0,false],[6,"M02",4,["M04"],0.5,0.16666666666666666,0.0,false],[7,"M01",5,["M04"],0.5,0.16666666666666666,0.0,false],[6,"M01",5,["M04"],0.5,0.16666666666666666,0.0,false],[7,"M04",6,["M04"],0.5,0.16666666666666666,0.0,false],[8,"M04",6,["M04"],0.5,0.16666666666666666,0.0,false],[9,"M04",6,["M04"],0.5,0.16666666666666666,0.16666666666666666,false],[10,"M04",6,["M04"],0.5,0.16666666666666666,0.16666666666666666,false],[10,"M04",6,["M04"],0.5,0.16666666666666666,0.16666666666666666,true]];
  const TRACE_Q = "Q3", TRACE_K = 6;

  /* ---------- derived data, all computed ---------- */
  const SMALL_K = 3, BIG_K = 6;
  const f2 = x => x.toFixed(2);
  const ids = q => RET[q].map(r => r[0]);
  const gold = q => GOLDEN.find(g => g.id === q);
  // the reranker's scores, parsed from the recorded text; ties keep the retrieval order (a stable sort)
  const RR_SCORES = Object.fromEntries(GOLDEN.map(g => [g.id, Object.fromEntries(REC.text[g.id].split("\n").map(l => { const [c, s] = l.split(" "); return [c, +s]; }))]));
  const RERANKED = Object.fromEntries(GOLDEN.map(g => [g.id, ids(g.id).slice().sort((a, b) => RR_SCORES[g.id][b] - RR_SCORES[g.id][a])]));
  function scoreQuery(results, relevant, k) {
    const top = results.slice(0, k), hits = top.filter(c => relevant.includes(c));
    const first = top.findIndex(c => relevant.includes(c));
    return { top, hits, recall: hits.length / relevant.length, precision: hits.length / k, rr: first < 0 ? 0 : 1 / (first + 1), first: first < 0 ? null : first + 1 };
  }
  function evaluate(byQ, k) {
    const rows = GOLDEN.map(g => ({ id: g.id, ...scoreQuery(byQ[g.id], g.relevant, k) }));
    const mean = key => rows.reduce((s, r) => s + r[key], 0) / rows.length;
    return { rows, recall: mean("recall"), precision: mean("precision"), mrr: mean("rr") };
  }
  const KW = Object.fromEntries(GOLDEN.map(g => [g.id, ids(g.id)]));
  const E_SMALL = evaluate(KW, SMALL_K), E_BIG = evaluate(KW, BIG_K), E_RR = evaluate(RERANKED, SMALL_K), E_RR_BIG = evaluate(RERANKED, BIG_K);
  const move = (a, b) => Math.abs(a - b) < 1e-9 ? 2 : b > a ? 0 : 1; // index into MOVES
  const MOVES = ["goes up", "goes down", "stays the same"];

  function style(kit) {
    esc = kit.esc; kit_fb = kit.feedback;
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}q { font: 600 16px/1.45 var(--font); margin: 14px 0 6px; }
.${P}chunks { display: grid; gap: 8px; margin-top: 10px; }
.${P}chunk { display: grid; grid-template-columns: 44px 1fr; gap: 10px; align-items: start; text-align: left; width: 100%; min-height: 44px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font: 400 14.5px/1.45 var(--font); }
button.${P}chunk { cursor: pointer; }
.${P}chunk b { font: 700 13px var(--mono); color: var(--ink-2); }
.${P}chunk small { display: block; font: 500 12px var(--mono); color: var(--muted); margin-top: 2px; }
.${P}chunk.on { border: 3px solid var(--ink); padding: 8.5px 10.5px; }
.${P}chunk.enter { border-color: var(--good); background: var(--good-soft); }
.${P}chunk.no { border-color: var(--bad); background: var(--bad-soft); }
.${P}chunk .tag { font: 600 12px var(--font); color: var(--good); }
.${P}src { font: 500 12.5px var(--mono); color: var(--muted); margin-top: 6px; }
.${P}pre { font: 500 14px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; margin-top: 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
.${P}tbl { width: 100%; border-collapse: collapse; margin-top: 12px; font: 500 14px var(--mono); }
.${P}tbl th, .${P}tbl td { border-bottom: 1px solid var(--line); padding: 7px 6px; text-align: right; }
.${P}tbl th:first-child, .${P}tbl td:first-child { text-align: left; }
.${P}tbl th { font: 600 12.5px var(--font); color: var(--muted); }
.${P}tbl tr.sum td { font: 700 14px var(--mono); border-top: 1.5px solid var(--ink); }
.${P}row { margin-top: 12px; }
.${P}row > p { margin: 0 0 4px; font-weight: 600; }
.${P}check { margin-top: 12px; min-height: 44px; }
`;
    document.head.appendChild(s);
  }
  const chunkCard = (cid, { tag = "", cls = "", pick = false, rank = null, score = null } = {}) => {
    const t = pick ? "button" : "div";
    return `<${t}${pick ? ' type="button"' : ""} class="${P}chunk ${cls}" data-i="${cid}"><b>${rank != null ? `#${rank}` : ""}<small>${cid}</small></b><span>${esc(MANUAL[cid])}${score != null ? `<small>keyword score ${score}</small>` : ""}${tag ? ` <span class="tag">${tag}</span>` : ""}</span></${t}>`;
  };
  const metricTable = (cols, rowsets) => `<table class="${P}tbl"><thead><tr><th></th>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rowsets}</tbody></table>`;

  /* 1. The situation: read the search results for one question and pick the chunks that answer it. */
  const S1_Q = "Q3";
  const S1_WHY = {
    M14: "This is about a lost ride pass. It shares the words “guests”, “still”, “ride up” with the question, which is why the keyword search put it first, but it says nothing about thunder.",
    M10: "Ski school groups riding up before the public: same words “ride up” and “guests”, nothing about a storm.",
    M16: "Touring skiers going uphill early in the morning. “Up” and “guests” match, the topic does not.",
    M02: "Wind closure. Weather, yes, but wind, not thunder or lightning. A staff member reading this would still not know what to do.",
    M01: "The morning opening check. It mentions guests boarding, nothing about storms."
  };
  function situation({ el, done, kit }) {
    style(kit);
    const g = gold(S1_Q), list = RET[S1_Q], need = list.map(r => r[0]).filter(c => g.relevant.includes(c));
    const sel = new Set();
    let checked = null; // null, or { wrong: [...], missed: [...] }
    const paint = () => {
      const ok = checked && !checked.wrong.length && !checked.missed.length;
      el.innerHTML = `<h1>Can the lifts keep running in a storm?</h1>
        <p class="lead">A ski resort gives its staff an assistant that searches the operations manual and answers from what it finds. A lift operator types a question. If the search brings back the wrong rules, the answer is wrong, and here a wrong answer can strand guests on a chairlift in a storm. This lesson is about measuring that search step on its own, before the model writes anything.</p>
        <p class="lead">The question was <b>“${esc(g.question)}”</b> The search returned these ${list.length} chunks of the manual, best match first.</p>
        <p class="task">Tap every chunk that helps answer the question, then press Check.</p>
        <div class="${P}chunks">${list.map(([c, s], i) => chunkCard(c, { rank: i + 1, pick: !ok, cls: ok ? (need.includes(c) ? "enter" : "") : checked && checked.wrong.includes(c) ? "no" : sel.has(c) ? "on" : "" })).join("")}</div>
        ${ok ? "" : `<button type="button" class="btn ${P}check" data-check ${sel.size ? "" : "disabled"}>Check</button>`}
        <div class="lpanel">${!checked ? "" : ok
          ? kit_fb(`Right: only ${need.join(", ")} helps, and it sits at place ${list.findIndex(r => r[0] === need[0]) + 1} of ${list.length}. The other chunks share words with the question (“guests”, “ride up”) but not its meaning. And one rule is missing altogether: the manual also has <b>M05</b>, “${esc(MANUAL.M05)}” The search gave it a score of 0, because it shares no word with the question. Measuring a search starts here: for each question, write down which chunks it needs. You already know a <b>golden set</b>: test questions with known answers. Here each golden question also lists its needed chunks.`, true)
          : kit_fb([...checked.wrong.map(c => `<b>${c}</b>: ${S1_WHY[c]}`), ...checked.missed.map(c => `You left out a chunk that does answer it. Read #${list.findIndex(r => r[0] === c) + 1} again: it says what to do when lightning strikes nearby.`)].join("<br>"), false)}</div>`;
      el.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => { const c = b.dataset.i; sel.has(c) ? sel.delete(c) : sel.add(c); checked = null; paint(); });
      const ch = el.querySelector("[data-check]");
      if (ch) ch.onclick = () => {
        checked = { wrong: [...sel].filter(c => !need.includes(c)), missed: need.filter(c => !sel.has(c)) };
        checked.wrong.forEach(c => sel.delete(c)); // a wrong pick is shown as a mistake and un-picked
        paint();
        if (!checked.wrong.length && !checked.missed.length) done();
      };
    };
    paint();
  }

  /* 2. By hand: three plain counts for each golden question, top 3 results. */
  function byHand({ el, done, kit }) {
    style(kit);
    let qi = 0;
    const picks = GOLDEN.map(() => [null, null, null]);
    const paint = () => {
      const g = GOLDEN[qi], s = scoreQuery(KW[g.id], g.relevant, SMALL_K), nR = g.relevant.length;
      const rows = [
        { p: `How many of the ${nR} needed ${nR === 1 ? "chunk is" : "chunks are"} in the top ${SMALL_K}?`, opts: Array.from({ length: nR + 1 }, (_, i) => `${i} of ${nR}`), right: s.hits.length },
        { p: `How many of the ${SMALL_K} shown chunks are needed?`, opts: Array.from({ length: SMALL_K + 1 }, (_, i) => `${i} of ${SMALL_K}`), right: s.hits.length },
        { p: "At which place is the first needed chunk?", opts: [...Array.from({ length: SMALL_K }, (_, i) => `place ${i + 1}`), "none in the top " + SMALL_K], right: s.first == null ? SMALL_K : s.first - 1 }
      ];
      const why = (r, v) => {
        const found = s.hits.length ? s.hits.join(" and ") : "none of them";
        if (r === 0) return `The golden set lists ${nR} needed: ${g.relevant.join(", ")}. Of those, the top ${SMALL_K} holds ${found}. ${v > s.hits.length ? "Too many: a chunk counts only if it is in the golden list and in the top " + SMALL_K + "." : "Too few: look for each needed id among the three cards."}`;
        if (r === 1) return v > s.hits.length
          ? `Too many. Only cards marked needed count; the others share words with the question but are not in the golden list. Of ${s.top.join(", ")}, the needed ones are ${found}.`
          : `Too few. Count every card marked needed among the ${SMALL_K} shown: ${s.top.join(", ")}. The needed ones among them: ${found}.`;
        return s.first == null ? `No needed chunk (${g.relevant.join(", ")}) is in the top ${SMALL_K}, so there is no first place.` : `Count from the top: ${s.top.map((c, i) => `${i + 1}: ${c}${g.relevant.includes(c) ? " (needed)" : ""}`).join(", ")}.`;
      };
      const allOk = picks[qi].every((v, r) => v === rows[r].right);
      const last = qi === GOLDEN.length - 1, fin = last && allOk;
      el.innerHTML = `<h1>Score the search by hand</h1>
        <p class="lead">Three questions from the golden set. For each, the search shows its top ${SMALL_K}. Chunks the golden set lists as needed are marked.</p>
        <p class="task">Question ${qi + 1} of ${GOLDEN.length}: answer the three counts.</p>
        <p class="${P}q">${g.id}: “${esc(g.question)}”<br><small>needed: ${g.relevant.join(", ")}</small></p>
        <div class="${P}chunks">${s.top.map((c, i) => chunkCard(c, { rank: i + 1, cls: g.relevant.includes(c) ? "enter" : "", tag: g.relevant.includes(c) ? "needed" : "" })).join("")}</div>
        ${rows.map((r, i) => `<div class="${P}row" id="r${i}"><p>${r.p}</p>${kit.options(r.opts, { picked: picks[qi][i], correct: r.right })}${picks[qi][i] != null && picks[qi][i] !== r.right ? kit.feedback(why(i, picks[qi][i]), false) : ""}</div>`).join("")}
        <div class="lpanel">${allOk && !last ? `<button type="button" class="btn" data-nextq>Next question</button>` : ""}
        ${fin ? kit.feedback(`Done. Those three counts have names. <b>k</b> is how many results you look at, here ${SMALL_K}, and “@${SMALL_K}” is read “at ${SMALL_K}”:
          <p><b>recall@${SMALL_K}</b> = needed chunks found ÷ needed chunks. Did the search find what the answer needs?<br><b>precision@${SMALL_K}</b> = needed chunks shown ÷ ${SMALL_K}. How much of what it shows is useful?<br><b>reciprocal rank</b> = 1 ÷ place of the first needed chunk, or 0 if there is none. How high is the first useful chunk? Its average over all questions is the <b>MRR</b>, the mean reciprocal rank.</p>
          ${metricTable([`recall@${SMALL_K}`, `precision@${SMALL_K}`, "reciprocal rank"], E_SMALL.rows.map(r => `<tr><td>${r.id}</td><td>${f2(r.recall)}</td><td>${f2(r.precision)}</td><td>${f2(r.rr)}</td></tr>`).join("") + `<tr class="sum"><td>mean</td><td>${f2(E_SMALL.recall)}</td><td>${f2(E_SMALL.precision)}</td><td>${f2(E_SMALL.mrr)} (MRR)</td></tr>`)}`, true) : ""}</div>`;
      el.querySelectorAll(`.${P}row`).forEach((row, r) => row.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        picks[qi][r] = +b.dataset.i; paint();
        if (qi === GOLDEN.length - 1 && picks[qi].every((v, j) => v === rows[j].right)) done();
      }));
      const nx = el.querySelector("[data-nextq]");
      if (nx) nx.onclick = () => { qi++; paint(); };
    };
    paint();
  }

  /* 3. Spot the idea: which number matters depends on what reads the results. */
  function spotIdea({ el, done, kit }) {
    style(kit);
    let ans = null;
    const opts = [`precision@${SMALL_K}: noise in the prompt confuses the model`, `recall@${SMALL_K}: a rule that is not in the prompt cannot be in the answer`, "MRR: the best chunk should come first"];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>Which number do you watch?</h1>
        <p class="lead">The assistant pastes all ${SMALL_K} chunks into the model's prompt, and the model answers only from them. Staff never see the list. The worst outcome is a confident answer that leaves out a closure rule.</p>
        <p class="task">Which number tells you first whether this search is good enough?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The model can only use what is in the prompt. On Q3 recall@${SMALL_K} was ${f2(E_SMALL.rows[2].recall)}: neither lightning rule reached the model, so no prompt and no model can answer it well. Precision still matters: each useless chunk costs prompt tokens and can pull the answer off course. MRR matters when a <i>person</i> reads the list from the top and stops at the first good result. Same three numbers; the product decides which one leads.`, true)
          : ans === 0 ? kit.feedback(`Noise does cost something: tokens, and sometimes a distracted answer. But a model can ignore a useless chunk; it cannot invent a rule that never reached it. Q3 had precision ${f2(E_SMALL.rows[2].precision)} and recall ${f2(E_SMALL.rows[2].recall)}: the missing rules are the failure here.`, false)
          : kit.feedback(`Order inside the prompt matters much less here: the model reads all ${SMALL_K} chunks, no one stops at the first. MRR fits a list a person scans from the top. What hurts this product is a needed chunk that never made the top ${SMALL_K}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. Predict: k from 3 to 6. */
  function predictK({ el, done, kit }) {
    style(kit);
    const M = [
      { name: "mean recall", a: E_SMALL.recall, b: E_BIG.recall },
      { name: "mean precision", a: E_SMALL.precision, b: E_BIG.precision },
      { name: "MRR", a: E_SMALL.mrr, b: E_BIG.mrr }
    ].map(m => ({ ...m, right: move(m.a, m.b) }));
    const picks = M.map(() => null);
    const q3 = E_BIG.rows[2];
    const why = [
      `Recall can only grow when you take more results: the chunks already found stay found. Here Q3's ${q3.hits.join(", ")} appears at place ${q3.first}, so its recall goes from ${f2(E_SMALL.rows[2].recall)} to ${f2(q3.recall)}.`,
      `Precision divides by k. Doubling k doubles the bottom of the fraction, and the new places mostly hold chunks that are not needed. Q1 still has ${E_BIG.rows[0].hits.length} needed chunks, now out of ${BIG_K}: ${f2(E_SMALL.rows[0].precision)} becomes ${f2(E_BIG.rows[0].precision)}.`,
      `MRR looks only at the first needed chunk. For Q1 and Q2 it was already in the top ${SMALL_K}, so nothing changes for them. But Q3 had none in the top ${SMALL_K} (reciprocal rank 0), and now its first needed chunk is at place ${q3.first}: 1 ÷ ${q3.first} = ${f2(q3.rr)}.`
    ];
    const paint = () => {
      const all = picks.every((p, i) => p === M[i].right);
      el.innerHTML = `<h1>Predict: show ${BIG_K} chunks instead of ${SMALL_K}</h1>
        <p class="lead">A teammate wants to send the top ${BIG_K} chunks to the model instead of the top ${SMALL_K}. Same search, same ranking, just a longer list. You measure the change on the same three golden questions.</p>
        <p class="task">Predict what happens to each number, from k = ${SMALL_K} to k = ${BIG_K}.</p>
        ${M.map((m, i) => `<div class="${P}row" id="m${i}"><p>${m.name}: ${f2(m.a)} at k = ${SMALL_K}</p>${kit.options(MOVES, { picked: picks[i], correct: m.right })}${picks[i] == null ? "" : kit.feedback(picks[i] === m.right ? `Measured: ${f2(m.b)}. ` + why[i] : why[i], picks[i] === m.right)}</div>`).join("")}
        ${all ? `<div class="lpanel">${kit.feedback(`A longer list raised recall and cost precision: you pay for the extra ${BIG_K - SMALL_K} chunks in prompt tokens on every question, to catch one rule on one question. And M05 is still missing: it is not in the keyword search's top ${BIG_K} at all.`)}</div>` : ""}`;
      el.querySelectorAll(`.${P}row`).forEach((row, i) => row.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        picks[i] = +b.dataset.i; paint();
        if (picks.every((p, j) => p === M[j].right)) done();
      }));
    };
    paint();
  }

  /* 5. Predict: a reranker reorders the top 6, the top 3 are kept. */
  function predictRerank({ el, done, kit }) {
    style(kit);
    const M = [
      { name: `mean recall@${SMALL_K}`, a: E_SMALL.recall, b: E_RR.recall },
      { name: `MRR (top ${SMALL_K})`, a: E_SMALL.mrr, b: E_RR.mrr },
      { name: `mean recall@${BIG_K} (all ${BIG_K}, reordered)`, a: E_BIG.recall, b: E_RR_BIG.recall }
    ].map(m => ({ ...m, right: move(m.a, m.b) }));
    const picks = M.map(() => null);
    const q3 = RERANKED.Q3;
    const why = [
      `The reranker can pull a needed chunk from places ${SMALL_K + 1} to ${BIG_K} into the top ${SMALL_K}. It did for Q3: ${q3[0]} went from place ${KW.Q3.indexOf(q3[0]) + 1} to place 1, so Q3's recall@${SMALL_K} went from ${f2(E_SMALL.rows[2].recall)} to ${f2(E_RR.rows[2].recall)}.`,
      `The reranker put a needed chunk first on all ${GOLDEN.length} questions (${GOLDEN.map(g => RERANKED[g.id][0]).join(", ")}), so every reciprocal rank became 1 ÷ 1. This is exactly what a reranker is for: order.`,
      `Reordering the same ${BIG_K} chunks cannot change which chunks are in the ${BIG_K}. Recall@${BIG_K} counts the same set, so it stays ${f2(E_BIG.recall)}. A reranker never finds a chunk the search did not return: M05 is still missing.`
    ];
    const paint = () => {
      const all = picks.every((p, i) => p === M[i].right);
      el.innerHTML = `<h1>Predict: add a reranker</h1>
        <p class="lead">Instead, you keep k = ${SMALL_K} but add a reranker. The search fetches its top ${BIG_K}. A second model scores each of those ${BIG_K} against the question. The ${SMALL_K} best go to the assistant. Here the reranker was a small hosted model asked for a 0 to 10 score per chunk. For Q3 it answered (chunk id, then its score):</p>
        <div class="${P}pre">${esc(REC.text.Q3)}</div>
        <p class="${P}src">Recorded model output, ${REC.recordedAt}.</p>
        <p class="task">Predict each number after reranking.</p>
        ${M.map((m, i) => `<div class="${P}row" id="m${i}"><p>${m.name}: ${f2(m.a)} without the reranker</p>${kit.options(MOVES, { picked: picks[i], correct: m.right })}${picks[i] == null ? "" : kit.feedback(picks[i] === m.right ? `Measured: ${f2(m.b)}. ` + why[i] : why[i], picks[i] === m.right)}</div>`).join("")}
        ${all ? `<div class="lpanel">${metricTable([`recall@${SMALL_K}`, `precision@${SMALL_K}`, "MRR"], [["keyword, top " + SMALL_K, E_SMALL], ["keyword, top " + BIG_K + " *", E_BIG], [`reranked, top ${SMALL_K}`, E_RR]].map(([n, e]) => `<tr><td>${n}</td><td>${f2(e.recall)}</td><td>${f2(e.precision)}</td><td>${f2(e.mrr)}</td></tr>`).join(""))}
          <p class="${P}src">* all three numbers in this row measured at k = ${BIG_K}</p>
          ${kit.feedback(`The reranker raised recall@${SMALL_K}, precision@${SMALL_K} and MRR while the prompt kept ${SMALL_K} chunks. Its price is a second model call on ${BIG_K} chunks for every question: time and money. And it only reorders: what the search never returned stays lost. It also scored M03, the gust rule Q1 needs, only ${RR_SCORES.Q1.M03} of 10, so the golden labels and the reranker disagree there.`)}</div>` : ""}`;
      el.querySelectorAll(`.${P}row`).forEach((row, i) => row.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        picks[i] = +b.dataset.i; paint();
        if (picks.every((p, j) => p === M[j].right)) done();
      }));
    };
    paint();
  }

  /* 6. Read the numbers right: precision@k has a ceiling. */
  function ceiling({ el, done, kit }) {
    style(kit);
    const g = gold("Q2"), perfect = [g.relevant[0], ...ids("Q2").filter(c => !g.relevant.includes(c))];
    const s = scoreQuery(perfect, g.relevant, SMALL_K);
    const vals = [1, s.precision, 2 / 3].map(f2);
    const opts = [...new Set(vals)].sort();
    const correct = opts.indexOf(f2(s.precision));
    let ans = null;
    const paint = () => {
      el.innerHTML = `<h1>A perfect search, and a low score</h1>
        <p class="lead">Q2, “${esc(g.question)}”, has exactly ${g.relevant.length} needed chunk: ${g.relevant[0]}. Imagine a perfect search that puts ${g.relevant[0]} at place 1. The other ${SMALL_K - 1} places still have to hold something.</p>
        <p class="task">What precision@${SMALL_K} does the perfect search get on Q2?</p>
        <div class="${P}chunks">${s.top.map((c, i) => chunkCard(c, { rank: i + 1, cls: g.relevant.includes(c) ? "enter" : "", tag: g.relevant.includes(c) ? "needed" : "" })).join("")}</div>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct, num: true })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right: ${s.hits.length} ÷ ${SMALL_K} = ${f2(s.precision)}, the best Q2 can ever score at k = ${SMALL_K}, while its recall@${SMALL_K} and reciprocal rank are ${f2(s.recall)}. Precision@k can never be higher than needed chunks ÷ k. So do not compare it with 1.00. Compare two set-ups on the same golden set instead.`, true)
          : opts[ans] === "1.00" ? kit.feedback(`1.00 would mean all ${SMALL_K} shown chunks are needed. Q2 has only ${g.relevant.length} needed chunk, so ${SMALL_K - 1} of the ${SMALL_K} places are filled with chunks that are not. Precision divides by k, not by the number of needed chunks.`, false)
          : kit.feedback(`That would need ${Math.round(+opts[ans] * SMALL_K)} needed chunks in the top ${SMALL_K}. Q2 has only one: ${g.relevant[0]}. Count the marked cards above and divide by ${SMALL_K}.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 7. The same counts in Python: score_query, traced on Q3 with k = 6. */
  const CODE = [
    "def score_query(results, relevant, k):",
    "    top = results[:k]",
    "    hits = [c for c in top if c in relevant]",
    "    recall = len(hits) / len(relevant)",
    "    precision = len(hits) / k",
    "    rr = 0.0",
    "    for rank, chunk in enumerate(top, 1):",
    "        if chunk in relevant:",
    "            rr = 1 / rank",
    "            break",
    "    return recall, precision, rr"
  ];
  function asCode({ el, done, kit }) {
    style(kit);
    let i = 0;
    const g = gold(TRACE_Q), top = KW[TRACE_Q].slice(0, TRACE_K);
    const num = v => v == null ? "–" : String(+v.toFixed(3));
    const say = (st, prev) => {
      const [ln, chunk, rank, hits, recall, precision, rr, ret] = st;
      if (ret) return `Return (${num(recall)}, ${num(precision)}, ${num(rr)}): Q3's numbers at k = ${TRACE_K}. Screen 4 averaged them with Q1 and Q2.`;
      if (ln === 1) return `<code>results</code> is the search's ranked list, <code>relevant</code> is the golden set's needed chunks (${g.relevant.join(", ")}), k = ${TRACE_K}. <code>results[:k]</code> takes the first ${TRACE_K}, like <code>results.slice(0, k)</code> in JavaScript.`;
      if (ln === 2) return chunk ? `c = ${chunk}. Is it in <code>relevant</code>? ${g.relevant.includes(chunk) ? "Yes, it is kept." : "No."}` : "Like <code>top.filter(c =&gt; relevant.includes(c))</code> in JavaScript: keep only the chunks of the top k that the golden set lists.";
      if (ln === 3) return `This line computes recall: ${hits.length} hit out of ${g.relevant.length} needed = ${num(hits.length / g.relevant.length)}. M05 is needed but was not in the top ${TRACE_K}.`;
      if (ln === 4) return `This line computes precision: ${hits.length} hit out of k = ${TRACE_K} shown = ${num(hits.length / TRACE_K)}.`;
      if (ln === 5) return "Reciprocal rank starts at 0, the value when no needed chunk shows up.";
      if (ln === 6) return prev && prev[0] === 7 ? `Not needed, so the loop moves on to the next place.` : `Walk the top ${TRACE_K} from place 1, looking for the first needed chunk. <code>enumerate(top, 1)</code> gives each chunk with its place, counting from 1.`;
      if (ln === 7) return `Place ${rank}: ${chunk}. ${g.relevant.includes(chunk) ? "Needed." : "Not needed, keep walking."}`;
      if (ln === 8) return `This line computes rr = 1 / ${rank} = ${num(1 / rank)}.`;
      if (ln === 9) return "Only the first needed chunk counts, so stop here.";
      if (ln === 10) return "Hand back the three numbers.";
      return "";
    };
    const paint = () => {
      const st = TRACE[i];
      const [ln, chunk, rank, hits, recall, precision, rr] = st;
      el.innerHTML = `<h1>The same counts, in Python</h1>
        <p class="lead">The function behind the tables, from scratch: lists and a loop, no library. A recorded run on Q3's top ${TRACE_K}: <code>[${top.map(c => `"${c}"`).join(", ")}]</code>.</p>
        <p class="task">Step through to the return. Match each line to the count you did by hand.</p>
        ${kit.code(CODE, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>${ln === 2 ? "c" : "chunk"} <b>${chunk || "–"}</b></span><span>rank <b>${rank || "–"}</b></span><span>hits <b>${hits ? "[" + hits.join(", ") + "]" : "–"}</b></span><span>recall <b>${num(recall)}</b></span><span>precision <b>${num(precision)}</b></span><span>rr <b>${num(rr)}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(say(st, i > 0 ? TRACE[i - 1] : null))}
        ${i === TRACE.length - 1 ? kit.feedback(`Averaging these three numbers over every golden question gives the table rows you saw. The full script, with the reranking step, is in the lesson's runs folder.`) : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 8. The big picture. */
  const BIG = [
    ["After switching to a new embedding model, the team wants to know whether the right manual chunks still reach the assistant.", true,
      "Yes. This is the job: the same golden questions, scored before and after the change, on the search step alone."],
    ["Staff say the assistant's answers are correct but too long and too formal.", false,
      "Length and tone are about the generated answer. The right chunks can arrive and the wording can still be off. Retrieval metrics do not look at the answer at all."],
    ["Staff say the assistant now takes too long to answer, and the team wants to find which step got slow.", false,
      "Recall, precision and MRR count which chunks arrived and where they sat, never how long anything took. A search can score 1.00 and still be slow. Time each step instead: the search, the reranker, the model call."]
  ];
  function bigPicture({ el, done, kit }) {
    style(kit);
    const ans = BIG.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to measure retrieval</h1>
        <p class="lead"><b>What for:</b> checking the search step alone, so you know whether a bad answer started with bad chunks.</p>
        <p class="lead"><b>When:</b> every time chunking, embeddings, k or a reranker change, on the same golden set.</p>
        <p class="lead"><b>When not:</b> for problems in the generated answer (wording, made-up claims) or in speed. Also not when some chunks answer the question and others only touch it. Then use a graded metric such as DCG, which gives more credit for a chunk that answers the question.</p>
        <p class="lead"><b>What it costs:</b> someone must label the needed chunks for every question. When the manual is re-chunked, the chunk ids change, so the labels must be redone. A bigger k costs prompt tokens on every call; a reranker costs a second model call.</p>
        <p class="task">Would retrieval metrics be the right tool? Decide for each.</p>
        ${BIG.map(([q, y, why], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? why : (y ? "It is. " : "Not here. ") + why, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BIG.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. Recognise: which number leads, or none. */
  const CASES = [
    { q: "A law firm's search page lists ten past cases. Lawyers open results from the top and stop at the first one that fits.",
      opts: ["recall@10", "precision@10", "MRR"], right: 2,
      why: ["Recall asks whether all the fitting cases are somewhere in the ten. These lawyers stop at the first good one; the rest of the list is rarely read.",
        "Precision counts how many of the ten fit. A lawyer who stops at place 1 does not care whether places 6 to 10 are good.",
        "Right. A person reading from the top feels the place of the first good result. That is what reciprocal rank measures."] },
    { q: "A pharmacy bot pastes the top 8 leaflet chunks into the model's prompt. Leaving out a warning that two medicines must not be taken together is the worst outcome.",
      opts: ["recall@8", "precision@8", "MRR"], right: 0,
      why: ["Right. The model reads all 8 and can only use what is there. A missing warning is a missing warning, however well the rest ranks.",
        "Precision tells you how much of the prompt is wasted. Worth watching, but a wasted chunk is not dangerous; a missing warning is.",
        "No one reads this list from the top; the model reads all 8. The place of the first good chunk barely matters here."] },
    { q: "A shop's “more like this” row shows 4 products. There are dozens of good matches; one odd product in the row looks broken to shoppers.",
      opts: ["recall@4", "precision@4", "MRR"], right: 1,
      why: ["With dozens of good matches, 4 slots can never hold most of them, so recall@4 stays tiny even for a perfect row. It does not measure what shoppers see.",
        "Right. Every slot is seen, and every bad one hurts. The share of good products among the 4 is the number.",
        "Shoppers see the whole row at once, not top-down until a hit. A row with a good first product and three odd ones still looks broken."] },
    { q: "On the resort's golden set, recall@3 is 1.00 for every question. Yet the assistant answered that chairlifts close at 75 km/h.",
      opts: ["Raise recall@3", "Raise precision@3", "None: the search is not the problem"], right: 2,
      why: ["Recall is already 1.00: every needed chunk, the wind closure rule included, was in the prompt. There is nothing left for the search to find.",
        "Precision might drop a useless chunk or two, but the model had the right rule in front of it and still answered wrong.",
        "Right. M02 says 60 km/h for a chairlift and 75 km/h for the gondola. The chunk arrived; the answer mixed up its two numbers. The fault is in generation, and retrieval metrics cannot see it."] }
  ];
  function recognise({ el, done, kit }) {
    style(kit);
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which number leads?</h1>
        <p class="lead">Three new products, then the ski resort again. For each, ask who reads the results, and what the worst miss would be.</p>
        <p class="task">Pick the number that matters most for each, or say that none does.</p>
        ${CASES.map((c, i) => `<div class="lcase" id="c${i}"><p>${c.q}</p>${kit.options(c.opts, { picked: ans[i], correct: c.right })}${ans[i] == null ? "" : kit.feedback(c.why[ans[i]], ans[i] === c.right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every((cc, j) => ans[j] === cc.right)) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    style(kit);
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can now measure a search</h1>
      <p class="lead">Label the needed chunks for each golden question. Then <b>recall@k</b> says whether the search found them, <b>precision@k</b> how much of what it returned is useful, and <b>MRR</b> how high the first useful chunk sits. A bigger k raises recall but lowers precision and costs prompt tokens. A reranker fixes the order of what was fetched, at the price of a second model call; it never brings back what was missed. Which number leads depends on who reads the results. These numbers judge the search step only: they say nothing about the wording of the answer or about speed.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson. You write <code>score_query</code> and an <code>evaluate</code> loop that returns mean recall@k, precision@k and MRR for a small golden set, and check it against the numbers in this lesson.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}${/[.?!]$/.test(nx.title) ? "" : "."} You can now tell whether the right chunks arrived; next you check whether the answer actually sticks to them.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Retrieval metrics: recall@k, precision@k and MRR",
    checked: "2026-11-13",
    sources: [
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-rank-eval"
    ],
    interview: [{
      q: "You add a reranker to your RAG pipeline. On your golden set, recall@10 is exactly the same as before, and a teammate says the reranker does nothing. What do you tell them?",
      good: [
        "If the reranker reorders the same 10 candidates, recall@10 and precision@10 cannot change: the set is the same",
        "Measure at the k you actually send to the model, for example recall@3, and MRR: that is where reordering shows",
        "A reranker cannot recover a chunk the first search never returned; low recall at the candidate depth needs better retrieval, not reranking",
        "Weigh the gain against the cost: an extra model call per question adds latency and money"
      ],
      weak: "Agreeing that it does nothing, or saying \"rerankers always help\", without asking at which k the metrics were measured."
    }, {
      q: "Your assistant pastes the top 5 chunks into the prompt. A change raises precision@5 but users start complaining about missing information. What happened, and which number should have caught it?",
      good: [
        "Precision and recall answer different questions: precision is how much of the 5 is useful, recall is whether all needed chunks are there",
        "The change probably returned fewer different needed chunks, for example near-duplicates of one rule, so recall@5 fell",
        "For a model that answers only from the prompt, recall@k leads: a missing chunk cannot be in the answer",
        "Check per question on the golden set, not only the mean, to see which questions lost a needed chunk"
      ],
      weak: "Saying higher precision means better search, without looking at recall or at which questions got worse."
    }],
    screens: [situation, byHand, spotIdea, predictK, predictRerank, ceiling, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ['[data-i="M14"]', "[data-check]"], right: ['[data-i="M04"]', "[data-check]"] },
      { wrong: ["#r0 [data-wrong]"], right: GOLDEN.flatMap((_, q) => [...[0, 1, 2].map(r => `#r${r} [data-right]`), ...(q < GOLDEN.length - 1 ? ["[data-nextq]"] : [])]) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#m0 [data-wrong]"], right: [0, 1, 2].map(i => `#m${i} [data-right]`) },
      { wrong: ["#m2 [data-wrong]"], right: [0, 1, 2].map(i => `#m${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(TRACE.length - 1).fill("[data-next]") },
      { wrong: ["#c1 [data-wrong]"], right: BIG.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c3 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
