/* Lesson s7-debug-round: Diagnose a broken LLM system in a debugging round.
   Story: in an interview, the interviewer shares a dashboard. Oakline (a made-up furniture maker) has a document
   assistant for its after-sales team; its eval score fell overnight after a routine deploy (release v42). The
   learner reads the failing eval, opens one trace, clicks the first step whose output is wrong, reads the deploy
   diff, picks the cause (CHUNK_SIZE 1000 -> 300 split every answer table so rows reached the model without their
   header), predicts what the real splitter does, picks the smallest fix and says the cause in one sentence.
   Ideas: (1) debug from evidence: failing eval -> what the failures share -> one trace -> the first bad step ->
   the change that explains it -> the smallest fix, checked by rerunning the eval; (2) the library knob: LangChain's
   RecursiveCharacterTextSplitter cuts a table between rows, and chunk_overlap repeats rows, not the header.
   Data, all real:
   - docs/ai-path/runs/s7-debug-round/docs_corpus.py (handbook + 8-question eval), pipeline.py (chunking with the
     real splitter, a from-scratch keyword search, top 3, three releases v41 / v42 / v42-fix), grade.out.txt,
     report.json, trace/*.json, to_js.out.txt (the values copied below), splitter_run.py + splitter_run.out.txt
     (the library screen), env.txt.
   - recordings (main checkout) docs/ai-path/recordings/s7-debug-round/v41r-q1..q8, v42-q1..q8, v42-fix-q1..q8
     (24 answers, one small hosted model, temperature 0). v41-q1..q8 are a dropped first attempt whose system
     prompt had a typo; the lesson does not use them.
   Lesson-local style (prefix lx-s7-debug-round-): the eval table, the clickable trace steps, chunk boxes, the
   diff block; see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s7-debug-round";
  const P = "lx-" + ID + "-";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => sum(a) / a.length;

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s7-debug-round/docs_corpus.py: the handbook's sections and what each holds.
  const SECTIONS = [["Warranty", "text"], ["Spare parts price list", "table"], ["Delivery zones", "table"],
    ["Assembly service", "table"], ["Returns", "text"], ["Care", "text"]];
  // docs_corpus.py EVAL: [id, question, value a right answer must contain, section the answer is in]
  const EVAL = [
    ["q1", "How much does a recliner cable cost?", "19", "Spare parts price list"],
    ["q2", "What is the lead time in days for the black steel sofa leg set?", "35", "Spare parts price list"],
    ["q3", "What is the delivery fee for zone G?", "159", "Delivery zones"],
    ["q4", "How many minutes does assembling a bunk bed take?", "110", "Assembly service"],
    ["q5", "How many years are recliner mechanisms covered by the warranty?", "5", "Warranty"],
    ["q6", "Within how many days of delivery can a customer return an unused product?", "30", "Returns"],
    ["q7", "What fee does Oakline charge to collect a return?", "39", "Returns"],
    ["q8", "How often should a solid oak table top be oiled?", "6 months", "Care"]
  ];
  // From docs/ai-path/recordings/s7-debug-round/<v41r|v42|v42-fix>-q1..q8.json, graded by pipeline.py
  // (grade.out.txt, to_js.out.txt): [passed, prompt_tokens from the API's usage, answer text not altered]
  const REC = {
    src: "s7-debug-round/v41r-q*, v42-q*, v42-fix-q*",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-14",
    v41: [[true, 930, "A recliner cable costs 19 EUR."], [true, 936, "The lead time for the black steel sofa leg set is 35 days."], [true, 930, "The delivery fee for zone G is 159 EUR."], [true, 931, "Assembling a bunk bed takes 110 minutes."], [true, 933, "Recliner mechanisms are covered by the warranty for 5 years."], [true, 935, "A customer can return an unused product within 30 days of delivery."], [true, 932, "Oakline collects the return for a fee of 39 EUR."], [true, 932, "A solid oak table top should be oiled every 6 months."]],
    v42: [[false, 319, "I don't know."], [true, 414, "The lead time in days for the black steel sofa leg set is 35."], [false, 240, "I don't know."], [false, 315, "I don't know."], [true, 210, "Recliner mechanisms are covered for 5 years."], [true, 243, "A customer can return an unused product within 30 days of delivery."], [true, 242, "Oakline collects the return for a fee of 39 EUR."], [true, 319, "A solid oak table top should be oiled every 6 months with Oakline table top oil."]],
    fix: [[true, 930, "A recliner cable costs 19 EUR."], [true, 936, "The lead time for the black steel sofa leg set is 35 days."], [true, 930, "The delivery fee for zone G is 159 EUR."], [true, 931, "Assembling a bunk bed takes 110 minutes."], [true, 933, "Recliner mechanisms are covered by the warranty for 5 years."], [true, 935, "A customer can return an unused product within 30 days of delivery."], [true, 932, "Oakline collects the return for a fee of 39 EUR."], [true, 932, "A solid oak table top should be oiled every 6 months."]]
  };
  const CAPTION = `Recorded model output, ${REC.recordedAt}`;
  // pipeline.py SYSTEM (the same in every release)
  const SYSTEM = "You are Oakline's after-sales document assistant. Answer only from the context below. If the context does not contain the answer, say \"I don't know\". Answer in one sentence.";
  // pipeline.py CONFIGS: the deploy diff, v41 -> v42
  const DIFF = [
    ["CHUNK_SIZE", "1000", "300"],
    ["LOG_LEVEL", "\"info\"", "\"warning\""],
    ["TIMEOUT_S", "20", "30"],
    ["CHUNK_OVERLAP", "100", "100"],
    ["TOP_K", "3", "3"]
  ];
  // trace/v42-q1.json and trace/v41-q1.json: the retrieve step, top 3 [chunk number, score, text]. Long chunk
  // texts are trimmed with … ; nothing else changed.
  const TRACE_V42 = { nChunks: 16, retrieve: [
    [5, 3.21, "| Shelf pin, pack of 8 | SP-08 | 4 | 300 | 2 |\n| Sofa leg set, oak | SL-41 | 32 | 12 | 21 |\n| Sofa leg set, black steel | SL-42 | 28 | 0 | 35 |\n| Bed slat, single | BS-90 | 11 | 64 | 5 |\n| Recliner cable | RC-15 | 19 | 7 | 14 |\n| Table top oil, 500 ml | TO-50 | 16 | 48 | 3 |"],
    [2, 3.07, "foam are covered for 2 years. The customer needs the order number or the delivery note to make a claim. …"],
    [1, 2.37, "Every Oakline product comes with a warranty from the day it is delivered. … the delivery note to make a"]] };
  const TRACE_V41 = { nChunks: 3, retrieve: [
    [0, 3.35, "## Warranty\n…\n## Spare parts price list\n\n| Part | Code | Price (EUR) | In stock | Lead time (days) |\n|---|---|---|---|---|\n| Hinge set for wardrobe door | HG-04 | 9 | 120 | 3 |\n…\n| Recliner cable | RC-15 | 19 | 7 | 14 |\n| Table top oil, 500 ml | TO-50 | 16 | 48 | 3 |\n\n## Delivery zones"],
    [2, 0.29, "## Returns\n\nA customer can return an unused product within 30 days of delivery, … \n\n## Care\n…"],
    [1, 0.2, "## Delivery zones\n\n| Zone | Postcodes | Fee (EUR) | … \n\n## Returns"]] };
  // splitter_run.py, the first 8 lines of main()'s body (the listing on the library screen)
  const CODE = [
    "from langchain_text_splitters import RecursiveCharacterTextSplitter",
    "",
    "splitter = RecursiveCharacterTextSplitter(",
    "    chunk_size=CHUNK_SIZE,  # max chars",
    "    chunk_overlap=100,      # repeated",
    ")",
    "chunks = splitter.split_text(handbook)",
    "print(len(chunks), \"chunks\")"
  ];
  // splitter_run.out.txt
  const SPLIT = { n1000: 3, n300: 16,
    c4: "| Part | Code | Price (EUR) | In stock | Lead time (days) |\n|---|---|---|---|---|\n| Hinge set for wardrobe door | HG-04 | 9 | 120 | 3 |\n| Drawer runner, pair | DR-20 | 14 | 35 | 7 |\n| Shelf pin, pack of 8 | SP-08 | 4 | 300 | 2 |\n| Sofa leg set, oak | SL-41 | 32 | 12 | 21 |",
    c5: "| Shelf pin, pack of 8 | SP-08 | 4 | 300 | 2 |\n| Sofa leg set, oak | SL-41 | 32 | 12 | 21 |\n| Sofa leg set, black steel | SL-42 | 28 | 0 | 35 |\n| Bed slat, single | BS-90 | 11 | 64 | 5 |\n| Recliner cable | RC-15 | 19 | 7 | 14 |\n| Table top oil, 500 ml | TO-50 | 16 | 48 | 3 |" };
  // docs_corpus.py: the spare parts table as written in the handbook (for its length)
  const PARTS_TABLE = "| Part | Code | Price (EUR) | In stock | Lead time (days) |\n|---|---|---|---|---|\n| Hinge set for wardrobe door | HG-04 | 9 | 120 | 3 |\n| Drawer runner, pair | DR-20 | 14 | 35 | 7 |\n| Shelf pin, pack of 8 | SP-08 | 4 | 300 | 2 |\n| Sofa leg set, oak | SL-41 | 32 | 12 | 21 |\n| Sofa leg set, black steel | SL-42 | 28 | 0 | 35 |\n| Bed slat, single | BS-90 | 11 | 64 | 5 |\n| Recliner cable | RC-15 | 19 | 7 | 14 |\n| Table top oil, 500 ml | TO-50 | 16 | 48 | 3 |";

  /* ---------- Derived from the data ---------- */
  const kindOf = q => SECTIONS.find(s => s[0] === q[3])[1];
  const passN = rel => REC[rel].filter(r => r[0]).length;
  const N = EVAL.length;
  const FAILED = EVAL.map((q, i) => i).filter(i => !REC.v42[i][0]);
  const TABLE_Q = EVAL.map((q, i) => i).filter(i => kindOf(EVAL[i]) === "table");
  const TEXT_Q = EVAL.map((q, i) => i).filter(i => kindOf(EVAL[i]) === "text");
  const TABLE_FAILS = FAILED.filter(i => TABLE_Q.includes(i)).length;
  const TABLE_PASS_V42 = TABLE_Q.filter(i => REC.v42[i][0]);
  const TOK = rel => mean(REC[rel].map(r => r[1]));
  const TOK_RATIO = Math.round(TOK("v41") / TOK("v42"));
  const fmtTok = n => Math.round(n).toLocaleString("en");
  const lenQ = i => EVAL[i][1].length;
  const Q1 = 0, Q1_V42 = REC.v42[Q1], Q1_V41 = REC.v41[Q1];
  const chunkSizeOld = +DIFF[0][1], chunkSizeNew = +DIFF[0][2];
  const PARTS_LEN = PARTS_TABLE.length;
  const HEADER = PARTS_TABLE.split("\n")[0];
  const firstLine = s => s.split("\n")[0];
  const OVERLAP_ROWS = SPLIT.c5.split("\n").filter(l => SPLIT.c4.split("\n").includes(l)).length;
  const RECLINER = SPLIT.c5.split("\n").find(l => l.includes("Recliner cable"));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}tbl { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 15px; }
      .${P}tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding-bottom: 6px; }
      .${P}tbl th, .${P}tbl td { border-bottom: 1px solid var(--line); padding: 7px 6px; text-align: left; vertical-align: top; }
      .${P}tbl th { font: 600 12.5px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .${P}tbl td.r { font: 600 14px var(--mono); white-space: nowrap; padding-left: 10px; }
      .${P}tbl td.f { color: var(--bad); }
      .${P}secs { margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 15px; }
      .${P}secs li { border-bottom: 1px solid var(--line); padding: 4px 0; }
      .${P}secs i { font-style: normal; color: var(--muted); font-family: var(--mono); font-size: 13px; }
      .${P}steps { margin: 14px 0 0; display: grid; gap: 8px; }
      .${P}step { display: grid; grid-template-columns: 2em 1fr; gap: 4px 10px; width: 100%; text-align: left; min-height: 44px; padding: 10px 12px;
        border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); font: inherit; cursor: pointer; }
      .${P}step:hover { border-color: var(--ink-2); }
      .${P}step.on { border: 3px solid var(--ink); padding: 8px 10px; }
      .${P}step.bad { border: 3px solid var(--bad); padding: 8px 10px; background: var(--bad-soft); }
      .${P}step.ok { border: 3px solid var(--good); padding: 8px 10px; background: var(--good-soft); }
      .${P}n { font: 600 14px var(--mono); color: var(--muted); }
      .${P}nm { font: 600 15px var(--mono); }
      .${P}body { grid-column: 2; min-width: 0; font-size: 15px; line-height: 1.45; }
      .${P}chunk { margin: 6px 0 0; padding: 8px 10px; background: var(--sunk); border-radius: 4px; font: 500 12.5px/1.5 var(--mono);
        white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .${P}meta { font: 500 13px var(--mono); color: var(--muted); }
      .${P}diff { margin: 14px 0 0; padding: 10px 12px; background: var(--sunk); border-radius: 6px; font: 500 14px/1.7 var(--mono); overflow-wrap: anywhere; }
      .${P}diff .same { color: var(--muted); }
      .${P}cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${P}opt { text-align: left; }
      @media (max-width: 520px) { .${P}tbl { font-size: 14px; } .${P}tbl th, .${P}tbl td { padding: 6px 4px; } }
    `;
    document.head.appendChild(s);
  }
  const chunk = (kit, s) => `<div class="${P}chunk">${kit.esc(s)}</div>`;
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;
  const mark = ok => ok ? "pass" : "FAIL";
  function evalTable(kit, rels, heads, opts = {}) {
    return `<table class="${P}tbl"><caption>${kit.esc(opts.caption || "")}</caption><thead><tr><th>#</th><th>question</th>${heads.map(h => `<th>${kit.esc(h)}</th>`).join("")}</tr></thead><tbody>${EVAL.map((q, i) =>
      `<tr><td class="r">${i + 1}</td><td>${kit.esc(q[1])}</td>${rels.map(rel => `<td class="r${REC[rel][i][0] ? "" : " f"}">${mark(REC[rel][i][0])}</td>`).join("")}</tr>`).join("")}
      <tr><td></td><td><b>passed</b></td>${rels.map(rel => `<td class="r">${passN(rel)} / ${N}</td>`).join("")}</tr></tbody></table>`;
  }
  const retrieveHtml = (kit, tr) => tr.retrieve.map(([c, s, t]) => `<div class="${P}meta">chunk ${c} of ${tr.nChunks} · score ${s}</div>${chunk(kit, t)}`).join("");

  /* 1. The situation: the dashboard. What do the failures share? */
  function dashboard({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const failLens = FAILED.map(lenQ), passLens = EVAL.map((q, i) => i).filter(i => REC.v42[i][0]).map(lenQ);
    const opts = [
      "They all ask for a number",
      "They are the longest questions",
      "Each one's answer sits in a table",
      "The model service failed on some requests"
    ];
    const RIGHT = 2;
    const fb = [
      [`Every question in this eval asks for a number, including the ${passN("v42")} that pass. A trait that the passing questions also have cannot explain why only some fail.`, false],
      [`The failing questions are ${failLens.join(", ")} characters long; the passing ones ${passLens.join(", ")}. ${passLens.filter(n => n > Math.max(...failLens)).length} passing questions are longer than every failing one. Length does not split them.`, false],
      [`Right. All ${FAILED.length} failures are answered by a table, and all ${TEXT_Q.length} text questions pass. One table question (#${TABLE_PASS_V42.map(i => i + 1).join(", #")}) still passes, so not every table answer is broken. But every failure is a table answer. That is your first clue.`, true],
      [`Nothing failed with an error. Each failing answer is a calm “${kit.esc(Q1_V42[2])}”, which is exactly what the assistant's instructions tell it to say when the context does not contain the answer. The service answered; it just did not find the fact.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Answer quality fell overnight</h1>
        <p class="lead">In a debugging round, the interviewer shares a dashboard. Oakline, a furniture maker, has a document assistant for its after-sales team: it finds the most relevant pieces (<b>chunks</b>) of the company handbook and asks a model to answer from them. Every night a small <b>eval</b> runs: ${N} questions with known answers. Last night's routine deploy, release v42, dropped the score from ${passN("v41")} / ${N} to ${passN("v42")} / ${N}. Your job in this round: find the cause from the evidence and propose the smallest fix.</p>
        <p class="lead">The handbook has ${SECTIONS.length} sections. Each one is either plain text or a table:</p>
        <ul class="${P}secs">${SECTIONS.map(([n, k]) => `<li>${kit.esc(n)} <i>${k}</i></li>`).join("")}</ul>
        ${evalTable(kit, ["v41", "v42"], ["v41", "v42"], { caption: "Nightly eval, before and after the deploy" })}
        <p class="task">Before opening any logs: what do the failing questions have in common?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Broken on purpose: the trace of one failing question. Click the first step whose output is wrong. */
  function traceStep({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const q = EVAL[Q1];
    const STEPS = [
      ["question", kit.esc(q[1])],
      ["retrieve", `Keyword search over the ${TRACE_V42.nChunks} chunks (a higher score means a closer match); the top 3 go to the model.${retrieveHtml(kit, TRACE_V42)}`],
      ["build prompt", `The instructions, the 3 chunks and the question: <b>${Q1_V42[1]}</b> input tokens.<div class="${P}chunk">${kit.esc(SYSTEM)}</div>`],
      ["generate", `${chunk(kit, Q1_V42[2])}<p class="${P}cap">${CAPTION}</p>`],
      ["grade", `${mark(Q1_V42[0])}: the answer should contain “${kit.esc(q[2])}”.`]
    ];
    const RIGHT = 1;
    const fb = [
      ["The question is the one the team wrote for the eval, word for word, and it did not change in the deploy. A good question can still get a bad answer if what comes after it goes wrong.", false],
      [`Right. This is the first step whose output is wrong. Look at chunk ${TRACE_V42.retrieve[0][0]}: the row <code>${kit.esc(RECLINER)}</code> is there, but the table's <b>header</b>, the line that names the columns, is not. Is 19 the price, the stock or the lead time? Nothing in the context says. The search did its job and ranked the row first. The chunk itself is broken: it was cut that way when the handbook was split into chunks, before anyone asked a question.`, true],
      ["The prompt is built the same way in both releases, and it faithfully carries what retrieve handed over. It is only as good as its input. Look one step earlier.", false],
      [`The model followed its instructions: the context did not say which number is the price, so it said “${kit.esc(Q1_V42[2])}”. That is the symptom you are chasing, not the cause. A model told to answer only from the context cannot fix a context that lacks the fact.`, false],
      ["The grade is correct: the answer does not contain 19. The grader reports the failure; it did not cause it.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Find where it goes wrong</h1>
        <p class="lead">You open the trace of question 1 on release v42. The assistant logs each step of one request: what went in and what came out. A wrong answer usually starts earlier than where it shows up. (Oakline and its assistant were built for this lesson, with a plain keyword search. Every step below is from a real run.)</p>
        <p class="task">Click the first step whose output is already wrong.</p>
        <div class="${P}steps">${STEPS.map(([nm, body], i) => `<button type="button" class="${P}step${ans === i ? (i === RIGHT ? " ok" : " bad") : ""}" data-i="${i}"${i === RIGHT ? " data-right" : i === 3 ? " data-wrong" : ""}><span class="${P}n">${i + 1}</span><span class="${P}nm">${nm}</span><span class="${P}body">${body}</span></button>`).join("")}</div>
        <div class="lpanel">${ans == null ? "" : kit.feedback(fb[ans][0], fb[ans][1])}</div>`;
      el.querySelectorAll(`.${P}step`).forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. The deploy diff: which change explains it? */
  function pickCause({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `<code>LOG_LEVEL</code> ${kit.esc(DIFF[1][1])} → ${kit.esc(DIFF[1][2])}`,
      `<code>TIMEOUT_S</code> ${DIFF[2][1]} → ${DIFF[2][2]}`,
      `<code>CHUNK_SIZE</code> ${chunkSizeOld} → ${chunkSizeNew}`,
      "None of them: the hosted model changed overnight"
    ];
    const RIGHT = 2;
    const fb = [
      ["The log level decides what the app writes to its own logs. It never reaches the chunks, the prompt or the model, so it cannot change an answer.", false],
      ["A longer timeout lets slow calls finish instead of failing. Every step in the trace finished, and no request failed. A timeout change would show up as errors, not as calm “I don't know” answers.", false],
      [`Right. The chunk size decides where the handbook is cut. At ${chunkSizeOld} characters the spare parts table, header and all, sat inside chunk ${TRACE_V41.retrieve[0][0]} of ${TRACE_V41.nChunks}. At ${chunkSizeNew} the handbook became ${TRACE_V42.nChunks} chunks, and the table was cut between rows, so the row with the answer landed in a chunk without the header. It is also the only change that touches what the model reads.`, true],
      [`Possible in general, so check it rather than guess: the recordings say the same model answered on both releases, and the ${TEXT_Q.length} text questions still pass. Above all, the v42 trace already shows bad input reaching the model. Fix what you can see first.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What changed in the deploy?</h1>
        <p class="lead">Here is the same question on v41, the night before. The retrieve step returned:</p>
        ${retrieveHtml(kit, { nChunks: TRACE_V41.nChunks, retrieve: TRACE_V41.retrieve.slice(0, 1) })}
        <p class="lead">and the model answered “${kit.esc(Q1_V41[2])}” (${CAPTION.toLowerCase()}). The deploy changed these settings of the assistant (old value → new value):</p>
        <div class="${P}diff">${DIFF.map(([k, a, b]) => a === b ? `<div class="same">  ${k} = ${kit.esc(a)}   (unchanged)</div>` : `<div>  ${k} = ${kit.esc(a)} → ${kit.esc(b)}</div>`).join("")}</div>
        <p class="task">Which change explains the broken chunk you found?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: why did the text questions survive smaller chunks? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const prose = REC.v42[6][2];
    const opts = [
      "Text questions are easier for the model",
      "A sentence names its own numbers; a table row needs its header to say what each number is",
      "Smaller chunks always work well for text",
      "The text chunks happened to score higher in the search"
    ];
    const RIGHT = 1;
    const fb = [
      [`With the old chunks the same model answered all ${TABLE_Q.length} table questions right (${passN("v41")} / ${N} on v41). It can read tables. What changed is what it was given.`, false],
      [`Right. “${kit.esc(prose)}” says what 39 is, even when it sits alone in a small chunk. <code>${kit.esc(RECLINER)}</code> does not: only the header line says that the third column is the price. Cut the header off and the row is just numbers. Question ${TABLE_PASS_V42[0] + 1} passed only because the header chunk and the row chunk both made the top 3 and the model put them back together. That is luck, not design.`, true],
      [`Not always. Look at chunk ${TRACE_V42.retrieve[2][0]} in the v42 trace: it ends mid-sentence, “…to make a”. Text breaks too when a fact is cut in half. Here the text facts were short enough to survive.`, false],
      [`For question 1 the row chunk scored highest of all (${TRACE_V42.retrieve[0][1]}) and still failed. Ranking was not the problem. The top chunk lacked the header.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why only tables?</h1>
        <p class="lead">On v42 each chunk holds about ${Math.round(chunkSizeOld / chunkSizeNew)} times fewer characters, yet all ${TEXT_Q.length} text questions still pass and ${TABLE_FAILS} of ${TABLE_Q.length} table questions fail.</p>
        <p class="task">What makes a table more fragile than a paragraph when you cut it into small pieces?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. The real library: predict what RecursiveCharacterTextSplitter does to the table at 300. */
  function library({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The whole parts table in one chunk, header included",
      "The header line, then the recliner row, with the rows between them left out",
      "A run of whole rows from the middle of the table, no header, starting with rows repeated from the chunk before",
      "The recliner row alone"
    ];
    const RIGHT = 2;
    const reveal = `<p class="lead">The real run, <code>chunk_size=${chunkSizeNew}</code>: ${SPLIT.n300} chunks (it was ${SPLIT.n1000} at ${chunkSizeOld}). The parts table became these two:</p>
      <div class="${P}meta">chunk 4</div>${chunk(kit, SPLIT.c4)}<div class="${P}meta">chunk 5</div>${chunk(kit, SPLIT.c5)}
      <p class="lead">The splitter looks for places to cut in a fixed order: a blank line first, then a line break, then a space, and last between single characters. A table has no blank lines inside, so it is cut at line breaks, between rows, and only the first piece keeps the header. <code>chunk_overlap</code> repeated the last ${OVERLAP_ROWS} rows of chunk 4 at the top of chunk 5. Overlap repeats what came just before, not the header, so it cannot save a table. <code>chunk_size</code> counts characters here, because the length function is <code>len</code> by default.</p>`;
    const fb = [
      [`The parts table alone is ${PARTS_LEN} characters, more than ${chunkSizeNew}. It cannot fit in one chunk, so the splitter must cut inside it.`, false],
      ["The splitter never drops text in the middle. It cuts the document into pieces in order, and every line ends up in some chunk.", false],
      ["Right.", true],
      [`The splitter packs as many whole lines as fit under ${chunkSizeNew} characters before it starts a new chunk. One row is far shorter than that, so it shares its chunk with its neighbours.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What the splitter really does</h1>
        <p class="lead">The assistant cuts the handbook into chunks with LangChain's <code>RecursiveCharacterTextSplitter</code>. The deploy changed the <code>CHUNK_SIZE</code> it is given.</p>
        ${kit.code(CODE, 3)}
        <p class="lead"><code>chunk_size</code> is the most characters one chunk may hold. <code>chunk_overlap</code> repeats the end of one chunk at the start of the next.</p>
        <p class="lead">The parts table starts with the header line <code>${kit.esc(HEADER)}</code> and has the recliner row near its end.</p>
        <p class="task">Predict: with <code>CHUNK_SIZE = ${chunkSizeNew}</code>, what is in the chunk that holds the recliner row?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}${ans === RIGHT ? reveal : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. The smallest fix, checked by rerunning the eval. */
  function smallestFix({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      `Raise <code>TOP_K</code>, the number of chunks sent to the model, from 3 to 10, so both halves of a table come back`,
      `Put <code>CHUNK_SIZE</code> back to ${chunkSizeOld} and rerun the eval`,
      "Add to the prompt: “If a row has no header, work out the columns from the numbers”",
      "Write a table-aware chunker that repeats the header in every chunk",
      "Switch to a larger model"
    ];
    const RIGHT = 1;
    const fb = [
      ["It might bring both halves back for some questions, but it is a guess, it adds input tokens to every request, and it still hands the model a row and a header in separate chunks to glue together. The trace did not point at too few chunks; it pointed at broken ones.", false],
      [`Right. It is one line, it undoes the exact change that broke things, and you can prove it works. In the rerun below, every other v42 change is still in place.${evalTable(kit, ["v42", "fix"], ["v42", "v42 + fix"], { caption: "Eval rerun with only CHUNK_SIZE put back" })}<p class="${P}cap">${CAPTION}</p>The fix has a cost. The deploy cut input tokens per question from about ${fmtTok(TOK("v41"))} to about ${fmtTok(TOK("v42"))}, about ${TOK_RATIO} times fewer. The fix goes back to about ${fmtTok(TOK("fix"))}. Someone wanted that saving. Win it back later, on purpose, with a chunker that keeps tables whole, and ship it only if the same eval passes.`, true],
      ["That asks the model to guess which number is the price. A guess that is right today is wrong on the next table. Never ask the model to make up for missing context.", false],
      ["A good next step if the team wants small chunks back, but it is new code that needs its own tests and eval. Tonight you want the eval passing again with the smallest change you can defend.", false],
      [`The model was not the cause: with the old chunks the same model scored ${passN("v41")} / ${N}. A larger model reading a row without a header still cannot know which column is the price, and it costs more on every call.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The smallest fix</h1>
        <p class="lead">You know the cause. The interviewer asks: what do you ship tonight? The smallest fix is the one that removes the cause with the least new risk, and that you can check with the eval you already have.</p>
        <p class="task">Pick the fix you would ship tonight.</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. Say it in one sentence. */
  function oneSentence({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "The model got worse after the deploy, so it answers “I don't know” to table questions.",
      `Quality dropped from ${passN("v41")} / ${N} to ${passN("v42")} / ${N} after v42.`,
      `v42 cut CHUNK_SIZE from ${chunkSizeOld} to ${chunkSizeNew}, so table rows reached the model without their header and ${TABLE_FAILS} of ${TABLE_Q.length} table questions failed; putting it back restores ${passN("fix")} / ${N}.`,
      "Something in the retrieval is off; I would look into the chunking and the prompt and maybe the model."
    ];
    const RIGHT = 2;
    const fb = [
      ["That blames the model, which the evidence cleared, and it repeats the symptom. An interviewer hears a guess.", false],
      ["True, but that is the dashboard read back. It says what happened, not why, and offers no fix.", false],
      ["Right: the change, the mechanism, the evidence and the fix, checked. One sentence the interviewer can verify against the trace.", true],
      ["It lists every suspect, which is what you say before debugging, not after. Name the one cause the evidence points to.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Say it in one sentence</h1>
        <p class="lead">The interviewer: “So what happened?” A strong answer names the change, how it caused the failure, the evidence, and the fix you checked.</p>
        <p class="task">Which answer would you give?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Since 9:00 every request to the assistant returns an HTTP 500 error",
      "After a deploy, answers got worse on the nightly eval, with no errors anywhere",
      "Users start asking about a new product line that the eval has no questions for"
    ];
    const RIGHT = 1;
    const fb = [
      ["Nothing reaches the model, so there is no answer to judge. That is an outage: read the error logs and roll back. The eval and the traces come after the service is up.", false],
      ["Right. A quiet quality drop with no errors is exactly where you need the eval to show what broke, a trace to show where, and the diff to show why.", true],
      ["No eval case fails, because there are none for this. First add real questions about the new products to the eval; then you have something to debug against.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When this method fits</h1>
        <p class="lead"><b>What it is:</b> a way to debug a quality drop with no crash. Group the failing eval cases, open one trace, find the first step whose output is wrong, match it to a change, ship the smallest fix and rerun the eval.</p>
        <p class="lead"><b>When:</b> answers got worse and you have an eval and traces.</p>
        <p class="lead"><b>When not:</b> errors and outages (read the error logs first). Also a drop that users report but no eval case shows (add cases first).</p>
        <p class="lead"><b>Costs:</b> the eval set takes work to build and keep current. Each run is paid model calls. Traces store user questions, so they need access rules and a deletion policy.</p>
        <p class="task">In which situation is this the right first move?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise: is the chunker the first suspect? */
  const CASES = [
    ["A contracts assistant was re-indexed with a new splitter setting. Since then, questions about the fee schedule, a long table, get “not found”, while questions about clauses still work.", true,
      "Yes. A re-index changed where documents are cut, and only table questions broke. Open a failing trace and look at the retrieved chunks for rows without their header.",
      "Look at the timing and the pattern: the only change was how documents are cut, and only the table questions broke. That pattern points at the chunker."],
    ["A team switched to a cheaper model. Answers to questions asked in Korean now come back in English. The retrieved chunks in the traces are identical to last week's.", false,
      "No. The chunks did not change, so the chunker cannot be the cause. The first step with a different output is generate: look at the model swap and the prompt.",
      "The traces show the same retrieved chunks as before, so retrieval and chunking are cleared. What changed is the model, and the first wrong output is at the generate step."],
    ["After a deploy the answers are as good as before, but users complain they wait twice as long.", false,
      "No. Quality did not drop, so the eval will pass. This is a latency question: compare how long each step takes in the traces before and after.",
      "The answers are still right, so the chunker is not breaking content. You find slowness in how long each step takes, not in answer quality."],
    ["Someone raised the chunk size to 4000 characters to “give the model more context”. Now warranty answers mix up the terms of two different sofas.", true,
      "Yes. Huge chunks pull neighbouring products into the same piece, so the model reads two sofas' terms together. Chunk size can break things in both directions.",
      "The change was to chunk size, and the symptom is two products' facts in one answer: one big chunk now holds both. Look at the retrieved chunk in a failing trace."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Is the chunker the first suspect?</h1>
        <p class="lead">Four reports from other teams.</p>
        <p class="task">For each one, would you look at how documents are chunked first? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can run a debugging round</h1>
      <p class="lead">You grouped the failing eval cases, found the first wrong step in a trace, matched it to one line of the deploy, predicted how the real splitter cuts a table, chose the smallest fix and checked it with a rerun: ${passN("v42")}&nbsp;/&nbsp;${N} back to ${passN("fix")}&nbsp;/&nbsp;${N}.</p>
      <p class="lead">The lesson itself was the practice. In a real round, say each step out loud as you take it.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Here you worked inside someone else's system against the clock; next you plan your own build inside a fixed time box, eval included.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Diagnose a broken LLM system in a debugging round",
    checked: "2026-11-14",
    sources: [
      "https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter",
      "https://reference.langchain.com/python/langchain-text-splitters/base/TextSplitter",
      "https://reference.langchain.com/python/langchain-text-splitters/character/RecursiveCharacterTextSplitter",
      "https://openrouter.ai/docs/api/reference/overview"
    ],
    interview: [
      {
        q: "Your RAG assistant's eval score dropped from 92% to 70% after a deploy that changed five config values. Walk me through how you find the cause.",
        good: [
          "Group the failing cases first: what do they share that the passing ones do not",
          "Open the trace of one failing case and find the first step whose output is wrong, not the step where the error shows",
          "Compare with the same case on the old release to see what differs at that step",
          "Match that step to the one config change that can affect it; clear the others with evidence",
          "Ship the smallest fix, usually reverting that one value, and rerun the same eval to prove it"
        ],
        weak: "Roll back everything or switch to a bigger model. That may hide the problem, but you never learn which change broke it, and it comes back with the next deploy."
      },
      {
        q: "A teammate cut the chunk size to save tokens, and table questions started failing. What do you propose?",
        good: [
          "Explain the mechanism: the splitter cuts tables between rows, so most rows lose their header",
          "Overlap repeats the previous rows, not the header, so raising it does not fix tables",
          "Short term, put the old chunk size back and rerun the eval",
          "Longer term, chunk by structure: keep each table whole or repeat its header in every piece, then try smaller sizes with the eval as a gate"
        ],
        weak: "Ask the model to infer the columns from the numbers. That trades a visible failure for silent wrong answers."
      }
    ],
    screens: [dashboard, traceStep, pickCause, spotIdea, library, smallestFix, oneSentence, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
