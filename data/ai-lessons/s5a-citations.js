/* Lesson s5a-citations: Citations that point to real chunks.
   Story: an electricians' wiring-regulations helper. The inspector accepts an answer only if every rule in it
   points to the clause it came from, and the helper must really have read that clause.
   Ideas: (1) a citation is only worth something if code can check it: one fixed marker format, and every marker
   compared with the ids of the chunks that went into the prompt (not the whole book, not the model's word);
   (2) what to do with a marker that fails: our own short ids, rejection, or one repair call, then check again.
   Data, all real:
   - docs/ai-path/runs/s5a-citations/book.py: the invented regulations book (made up for teaching, not real rules)
   - retrieve.py / retrieve.out.txt: TF-IDF retrieval, the four clauses the helper retrieved
   - recordings in docs/ai-path/recordings/s5a-citations/ (OpenRouter, google/gemini-2.5-flash-lite, 2026-11-13):
     apprentice-1 and apprentice-6 (clause-number prompt), fixed-1 … fixed-8 (our own ids), repair-1 (repair call)
   - check.py / check.out.txt: check_citations and its trace on apprentice-1; stats.py / stats.out.txt: counts over
     every recorded run; repair.py / repair.out.txt: the check on the repaired answer; broken.py / broken.out.txt:
     the same check fed the whole book.
   Lesson-only CSS (prefix lx-s5a-citations-): quoted answers, markers and a code listing whose lines are buttons.
   Plain browser script. */
(() => {
  const ID = "s5a-citations";
  const P = "lx-" + ID + "-";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const REC_DATE = "2026-11-13";

  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}q { margin: 12px 0 0; padding: 10px 14px; border-left: 3px solid var(--line); background: var(--surface); font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
      .${P}q .run { display: block; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 4px; }
      .${P}m { font: 700 15px var(--mono); color: var(--ink); white-space: normal; }
      .${P}cap { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
      .${P}src { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .${P}src li { display: grid; grid-template-columns: 4.2em minmax(0, 1fr); gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15px; }
      .${P}src li b { font: 700 15px var(--mono); }
      .${P}src li.out { color: var(--faint); }
      .${P}code { margin: 18px 0 0; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r); padding: 8px 0; overflow-x: auto; }
      .${P}code button { display: block; min-width: 100%; width: max-content; min-height: 44px; padding: 0 14px; border: 0; border-left: 3px solid transparent; background: transparent; color: inherit; font: 500 14px/44px var(--mono); text-align: left; white-space: pre; cursor: pointer; font-variant-ligatures: none; }
      .${P}code button:hover { background: color-mix(in srgb, var(--code-ink) 10%, var(--code-bg)); }
      .${P}code button.no { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 22%, var(--code-bg)); }
      .${P}code button.yes { border-left-color: var(--good); background: color-mix(in srgb, var(--good) 22%, var(--code-bg)); }
      .${P}out { margin: 12px 0 0; padding: 10px 14px; background: var(--sunk); font: 500 14px/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; border-radius: var(--r); }
      .${P}small { font-size: 15px; color: var(--ink-2); }
    `;
    document.head.appendChild(s);
  }

  /* ---------- Data ---------- */
  // The question the electrician typed (the request in every recording).
  const QUESTION = "A customer wants a socket outlet and a shaver point in the bathroom. How far from the bath must the socket be, what does the shaver point need, and does the bathroom circuit need an RCD?";
  // From docs/ai-path/runs/s5a-citations/book.py (invented for teaching). Only the clauses this lesson shows.
  const BOOK = {
    "4.4.1": "The test button of every RCD must be pressed every six months to check that it trips.",
    "6.1.1": "In a room with a bath or shower, zone 1 is the space above the bath or shower tray up to 2.25 m from the floor. Zone 2 extends 0.6 m beyond zone 1.",
    "6.1.4": "In a room with a bath or shower, a socket outlet must be at least 3 m from the edge of zone 1 (zones: see 6.1.1). A shaver supply unit is allowed in zone 2 (see 6.3.2).",
    "6.1.7": "Every circuit in a room with a bath or shower must be protected by an RCD of 30 mA (testing: see 4.4.1).",
    "6.3.2": "A shaver supply unit must contain an isolating transformer.",
    "7.1.2": "In a kitchen, a socket outlet must be at least 0.3 m from the edge of the sink."
  };
  const BOOK_SIZE = 10; // clauses in book.py
  // From retrieve.out.txt: "TOP4 ["6.1.4", "6.3.2", "7.1.2", "6.1.7"]"
  const RETRIEVED = ["6.1.4", "6.3.2", "7.1.2", "6.1.7"];

  // From docs/ai-path/recordings/s5a-citations/apprentice-1.json and apprentice-6.json (whole sentences cut out, not altered)
  const REC_RUN1 = { src: "s5a-citations/apprentice-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE };
  const REC_RUN2 = { src: "s5a-citations/apprentice-6", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE };
  // [run, sentence, marker]; the marker follows the sentence in the recording
  const PIECES = [
    [1, "Firstly, regarding the socket outlet, it must be positioned at least 3 metres away from the edge of Zone 1.", "[6.1.4]"],
    [1, "Zone 1 is the area directly around the bath or shower.", "[6.1.1]"],
    [1, "Importantly, any shaver supply unit installed must contain an isolating transformer.", "[6.3.2]"],
    [1, "This RCD needs to be tested to ensure it's functioning correctly.", "[4.4.1]"],
    [2, "Zone 1 is the vertical area directly above the bath or shower up to a height of 2.25 meters from the finished floor level.", "[refer to diagram associated with 6.1.1, not provided]"]
  ];
  // the clause that names an unretrieved number (where the model could have read it)
  const crossRef = id => RETRIEVED.find(r => BOOK[r].includes("see " + id));
  const SHAPE = /^\[\d+\.\d+\.\d+\]$/;
  const kindOf = m => !SHAPE.test(m) ? 2 : RETRIEVED.includes(m.slice(1, -1)) ? 0 : 1;
  const KINDS = ["Points to a retrieved clause", "Names a clause that was never retrieved", "Malformed"];

  // From stats.out.txt ("per prompt: runs, runs with a bad marker, markers, bad markers")
  const STATS = { apprentice: [11, 6, 70, 12], fixed: [8, 0, 40, 0] };

  // From fixed-1.request.json (the system prompt and the sources as sent)
  const FIXED_SYSTEM = "You help electricians with the wiring regulations. Explain fully, for an apprentice, including where the zones are and how the RCD is tested. Use only the sources below. End every sentence with the id of the source it came from, in exactly this form: [S1]. One id per bracket. Use only the ids listed. If the sources do not cover something, write a sentence that says so, with no id.";
  const SHORT = RETRIEVED.map((cid, i) => ["S" + (i + 1), cid]);
  // From fixed-1.json … fixed-8.json: the sentence in each run about testing the RCD (copied, not altered)
  const REC_FIXED = { src: "s5a-citations/fixed-1 … fixed-8", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE };
  const TESTING = [
    "The sources do not explain how the RCD is tested.",
    "Testing of the RCD is covered in section 4.4.1 [S4].",
    "The sources do not specify how the RCD is tested.",
    "The sources do not explain how an RCD is tested.",
    "The provided sources do not explain how an RCD is tested.",
    "The testing of the RCD is detailed in section 4.4.1 [S4].",
    "The provided sources do not detail how an RCD is tested [S4].",
    "Testing of the RCD is described in section 4.4.1 of the regulations [S4]."
  ];

  // From fixed-4.json: a sentence whose marker resolves, though its chunk does not say it (copied, not altered)
  const FIXED4_ZONE = { run: 4, text: "Zone 1 in a room with a bath or shower is the area directly above and around the bath or shower", marker: "[S1]" };

  // The function from check.py, line for line (line 0 = the def line, as in the trace)
  const CODE = [
    "def check_citations(answer, retrieved_ids):",
    "    report = []",
    String.raw`    for marker in re.findall(r"\[[^\]]*\]", answer):`,
    "        cid = marker[1:-1]",
    String.raw`        if not re.fullmatch(r"\d+\.\d+\.\d+", cid):`,
    `            report.append((marker, "malformed"))`,
    "        elif cid not in retrieved_ids:",
    `            report.append((marker, "not retrieved"))`,
    "        else:",
    `            report.append((marker, "ok"))`,
    "    return report"
  ];
  // From check.out.txt, "== apprentice-1": the report check_citations returned
  const FINAL = [["[6.1.4]", "ok"], ["[6.1.1]", "not retrieved"], ["[6.1.4]", "ok"], ["[6.3.2]", "ok"], ["[6.1.7]", "ok"], ["[4.4.1]", "not retrieved"]];
  // From check.out.txt, "== TRACE apprentice-1": [line about to run, event, marker, cid, entries in report (null = not set yet)]
  // (each step's report is the first k entries of FINAL; checked against the trace)
  const TRACE = [
    [1, "l", null, null, null], [2, "l", null, null, 0], [3, "l", "[6.1.4]", null, 0], [4, "l", "[6.1.4]", "6.1.4", 0],
    [6, "l", "[6.1.4]", "6.1.4", 0], [9, "l", "[6.1.4]", "6.1.4", 0], [2, "l", "[6.1.4]", "6.1.4", 1],
    [3, "l", "[6.1.1]", "6.1.4", 1], [4, "l", "[6.1.1]", "6.1.1", 1], [6, "l", "[6.1.1]", "6.1.1", 1], [7, "l", "[6.1.1]", "6.1.1", 1],
    [2, "l", "[6.1.1]", "6.1.1", 2], [3, "l", "[6.1.4]", "6.1.1", 2], [4, "l", "[6.1.4]", "6.1.4", 2], [6, "l", "[6.1.4]", "6.1.4", 2],
    [9, "l", "[6.1.4]", "6.1.4", 2], [2, "l", "[6.1.4]", "6.1.4", 3], [3, "l", "[6.3.2]", "6.1.4", 3], [4, "l", "[6.3.2]", "6.3.2", 3],
    [6, "l", "[6.3.2]", "6.3.2", 3], [9, "l", "[6.3.2]", "6.3.2", 3], [2, "l", "[6.3.2]", "6.3.2", 4], [3, "l", "[6.1.7]", "6.3.2", 4],
    [4, "l", "[6.1.7]", "6.1.7", 4], [6, "l", "[6.1.7]", "6.1.7", 4], [9, "l", "[6.1.7]", "6.1.7", 4], [2, "l", "[6.1.7]", "6.1.7", 5],
    [3, "l", "[4.4.1]", "6.1.7", 5], [4, "l", "[4.4.1]", "4.4.1", 5], [6, "l", "[4.4.1]", "4.4.1", 5], [7, "l", "[4.4.1]", "4.4.1", 5],
    [2, "l", "[4.4.1]", "4.4.1", 6], [10, "l", "[4.4.1]", "4.4.1", 6], [10, "r", "[4.4.1]", "4.4.1", 6]
  ];
  // From check.out.txt, "== apprentice-6": the same function on run 2
  const RUN2_REPORT = [["[6.1.4]", "ok"], ["[6.1.4]", "ok"], ["[6.3.2]", "ok"], ["[6.1.7]", "ok"], ["[refer to diagram associated with 6.1.1, not provided]", "malformed"], ["[refer to diagram associated with 6.1.1, not provided]", "malformed"]];

  // From repair-1.request.json (the last message, built by repair.py from the report) and repair-1.json
  const REPAIR_MSG = "These citations do not point to a clause you were given: [6.1.1], [4.4.1]. Rewrite the answer. Cite only the clauses given above, in the same form. If a sentence has no given clause behind it, say that the given clauses do not cover it, with no citation.";
  const REC_REPAIR = {
    src: "s5a-citations/repair-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE,
    text: "Let's go through the requirements for your customer's bathroom step-by-step.\n\nFor the socket outlet, it needs to be placed a minimum of 3 metres away from the edge of Zone 1. [6.1.4]\n\nRegarding the shaver point, a shaver supply unit is allowed in Zone 2. [6.1.4] This shaver supply unit must include an isolating transformer. [6.3.2]\n\nAs for the RCD protection, every circuit in a room with a bath or shower is required to be protected by a 30 mA RCD. [6.1.7]"
  };
  // From repair.out.txt, "== check"
  const REPAIR_REPORT = [["[6.1.4]", "ok"], ["[6.1.4]", "ok"], ["[6.3.2]", "ok"], ["[6.1.7]", "ok"]];

  // broken.py as run, from the def line to the end (the same function, called with the whole book), and broken.out.txt
  const BROKEN = [
    "def check_citations(answer, book_ids):",
    "    report = []",
    String.raw`    for marker in re.findall(r"\[[^\]]*\]", answer):`,
    "        cid = marker[1:-1]",
    String.raw`        if not re.fullmatch(r"\d+\.\d+\.\d+", cid):`,
    `            report.append((marker, "malformed"))`,
    "        elif cid not in book_ids:",
    `            report.append((marker, "not retrieved"))`,
    "        else:",
    `            report.append((marker, "ok"))`,
    "    return report",
    "book_ids = list(BOOK)",
    `run1 = answer_of("apprentice-1")`,
    "for row in check_citations(run1, book_ids):",
    "    print(row)"
  ];
  const BROKEN_OUT = [
    "('[6.1.4]', 'ok')", "('[6.1.1]', 'ok')", "('[6.1.4]', 'ok')", "('[6.3.2]', 'ok')", "('[6.1.7]', 'ok')", "('[4.4.1]', 'ok')"
  ];

  /* ---------- small helpers ---------- */
  const caption = () => `<p class="${P}cap">Recorded model output, ${REC_DATE}</p>`;
  const sources = (ids, { all = false } = {}) => `<ul class="${P}src">${ids.map(id => `<li class="${all && !RETRIEVED.includes(id) ? "out" : ""}"><b>${id}</b><span>${kit_esc(BOOK[id])}</span></li>`).join("")}</ul>`;
  const kit_esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const count = (rep, s) => rep.filter(r => r[1] === s).length;

  /* 1. By hand: go through a recorded answer marker by marker. */
  function byHand({ el, done, kit }) {
    style();
    const ans = PIECES.map(() => null);
    const rightAll = () => PIECES.every((p, i) => ans[i] === kindOf(p[2]));
    const say = (i, a) => {
      const m = PIECES[i][2], k = kindOf(m), id = m.slice(1, -1);
      if (a === k) {
        if (k === 0) return `Right. ${id} is in the retrieved list. The model read that clause, and the inspector can open it.`;
        if (k === 1) return `Right. ${id} is a real clause in the book, but it is not one of the ${RETRIEVED.length} the helper retrieved. The model never saw its text. The number does appear in a clause it did see: ${crossRef(id)} says “see ${id}”.`;
        return "Right. The agreed form is one clause number in square brackets. This marker holds a whole phrase. Code that looks for a clause number cannot read it, and the inspector has nothing to open.";
      }
      if (k === 0) return a === 1 ? `Look at the list again: ${id} is there. The marker points to a clause the model was shown.` : `The marker is one clause number in square brackets, the agreed form. Nothing is wrong with its shape.`;
      if (k === 1) return a === 0 ? `${id} looks fine, and it is in the regulations book. But it is not in the list of ${RETRIEVED.length} the helper retrieved, so the model never read it. Where did the number come from? Clause ${crossRef(id)} says “see ${id}”.` : `The shape is right: one clause number in square brackets. The problem is which number. Is ${id} in the retrieved list?`;
      return a === 0 ? "It mentions 6.1.1, but the marker is not a clause number in square brackets. It is a phrase. And 6.1.1 was not retrieved either." : "6.1.1 appears inside it, but first look at the shape: it is a phrase, not one clause number in square brackets. Code that expects the agreed form cannot even read a number out of it.";
    };
    const paint = () => {
      const all = rightAll();
      const ok = PIECES.filter(p => kindOf(p[2]) === 0).length;
      el.innerHTML = `<h1>The inspector wants the clause</h1>
        <p class="lead">An electricians' firm uses a helper that answers questions from the wiring regulations. The inspector accepts an answer only if every rule in it points to the clause it came from, and the helper really read that clause. For each question, a retriever picks ${WORDS[RETRIEVED.length].toLowerCase()} clauses; each clause is one chunk. A small hosted model writes the answer and is asked to put the clause number after each sentence, in square brackets, like [6.1.4]. That bracket is a <b>marker</b>. (The regulations here are invented for this lesson.)</p>
        <p class="lead"><b>Question:</b> ${kit.esc(QUESTION)}</p>
        <p class="lp-cap">The ${RETRIEVED.length} clauses the helper retrieved</p>
        ${sources(RETRIEVED)}
        <p class="task">The model was asked this question several times. Here are ${plural(PIECES.length, "sentence")} from two of its answers. For each marker, decide what it is.</p>
        ${PIECES.map(([run, s, m], i) => `<div class="lcase" id="c${i}"><div class="${P}q"><span class="run">Run ${run}</span>${kit.esc(s)} <span class="${P}m">${kit.esc(m)}</span></div>
          ${kit.options(KINDS, { picked: ans[i], correct: kindOf(m) })}
          ${ans[i] == null ? "" : kit.feedback(kit.esc(say(i, ans[i])), ans[i] === kindOf(m))}</div>`).join("")}
        ${caption()}
        ${all ? kit.feedback(`Only ${ok} of the ${PIECES.length} markers would pass the inspector. The other ${PIECES.length - ok} look like citations, but there is nothing behind them that the helper read. You checked them against a list. Code can do the same.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (rightAll()) done();
      }));
    };
    paint();
  }

  /* 2. Spot the idea: which check catches both kinds of bad marker. */
  function spotIdea({ el, done, kit }) {
    style();
    let ans = null;
    const nr = PIECES.filter(p => kindOf(p[2]) === 1).map(p => p[2].slice(1, -1));
    const opts = [
      `Look up every cited number in the full regulations book (${BOOK_SIZE} clauses) and reject numbers that are not there`,
      "In code, read every marker in the agreed form and compare its id with the ids of the chunks you put into the prompt",
      "Ask the model to read its answer again and confirm that every citation is right"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>One check before the inspector</h1>
        <p class="lead">You want a check that runs on every answer, before anyone sees it, and catches both problems you found: a number that was never retrieved, and a marker that is not a clause number at all.</p>
        <p class="task">Which check catches both?</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. Your code built the prompt, so it knows exactly which ${RETRIEVED.length} ids went in. A marker that does not have the agreed form is <b>malformed</b>. A well-formed id that is not one of those ${RETRIEVED.length} is <b>not retrieved</b>. Everything else <b>resolves</b>: it points to a chunk the model was shown. The check is a membership test in a short list: exact, instant, and free. What it does not tell you is whether the clause really says what the sentence says. That needs a different check.`, true)
          : ans === 0 ? kit.feedback(`${nr.join(" and ")} are both in the book, so they pass. The book check proves a clause exists, not that the helper read it. The inspector asked for the clause the answer came from.`, false)
          : kit.feedback("A “yes, all correct” would come from the same model that wrote [6.1.1] in the first place, so you would still have to check it. A second call also costs time and money. Your code already holds the exact list of chunks it sent.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 3. Use it: a fixed format with our own ids; predict, then see eight real runs. */
  function fixedFormat({ el, done, kit }) {
    style();
    let ans = null;
    const [aRuns, aBad, aMarks, aBadM] = STATS.apprentice, [fRuns, fBad, fMarks, fBadM] = STATS.fixed;
    const opts = [`None of the ${fRuns}`, `About half of them, like before`, `All ${fRuns} of them`];
    const correct = fBad === 0 ? 0 : -1;
    const noId = TESTING.filter(t => !/\[S\d+\]/.test(t)).length;
    const saysNot = t => /do not/.test(t);
    const notWithId = TESTING.filter(t => saysNot(t) && /\[S\d+\]/.test(t)).length;
    const pointS4 = TESTING.filter(t => !saysNot(t)).length;
    const paint = () => {
      el.innerHTML = `<h1>A fixed format, with your own ids</h1>
        <p class="lead">You change the prompt in three ways. Each chunk gets a short id that exists only in this prompt: S1 to S${RETRIEVED.length}, not its clause number. The format is spelled out. And the model gets a way out when the chunks do not cover something. Your code keeps a map from each S id to its clause number and swaps them back before the inspector sees the answer.</p>
        <div class="${P}q"><span class="run">System prompt</span>${kit.esc(FIXED_SYSTEM)}</div>
        ${kit.table(SHORT, { head: ["id in the prompt", "clause"], title: "Your map" })}
        <p class="lead">With the old prompt, ${aBad} of ${aRuns} recorded runs had at least one bad marker (${aBadM} of ${aMarks} markers). The same question was sent ${fRuns} times with the new prompt.</p>
        <p class="task">Predict: in how many of the ${fRuns} runs did the check find a bad marker?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right: ${fBadM} bad markers out of ${fMarks}, in ${fRuns} runs. S ids appear nowhere else, so the model cannot borrow one from a “see 6.1.1” or from what it learned in training. A clause number in brackets would now be malformed, and your check would catch it. This was one small model, ${fRuns} runs, and three changes at once. So keep the check: the prompt asks, the check makes sure.`, true)
          : ans === 1 ? kit.feedback("Before, the model wrote clause numbers, and it found extra ones inside the clause texts (“see 6.1.1”). The S ids exist only in this prompt, so there is no other id to borrow.", false)
          : kit.feedback("The model mostly followed the format before too: most of its markers resolved. The trouble was borrowed clause numbers. With ids that exist only in this prompt, there is nothing to borrow.", false)}
        ${ans === correct ? `<p class="lead" style="margin-top:16px">Every run passed. But read what each run wrote about testing the RCD, which no retrieved chunk explains:</p>
          ${TESTING.map((t, i) => `<div class="${P}q"><span class="run">Run ${i + 1}</span>${kit.esc(t)}</div>`).join("")}
          ${caption()}
          ${kit.feedback(`${noId} runs said the chunks do not cover it, with no id: the way out worked. ${pointS4} runs said testing is in 4.4.1 and cited [S4]. That is true: S4 says “testing: see 4.4.1”. ${notWithId === 1 ? "One run" : `${notWithId} runs`} said the chunks do not cover it and still cited [S4]: a marker on a sentence that the chunk does not support. Every one of these markers resolves. The check proves where a marker points. It cannot prove the sentence says what the chunk says.`)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 4. The check in Python, replayed from a real trace on run 1. */
  function asCode({ el, done, kit }) {
    style();
    let i = 0, guess = null;
    // the step where the first not-retrieved marker reaches the retrieved-ids test: predict the next line
    const Q = TRACE.findIndex(t => t[0] === 6 && FINAL[t[4]] && FINAL[t[4]][1] === "not retrieved");
    const nextLine = TRACE[Q + 1][0];
    const qOpts = [7, 9].map(l => `Line ${l}: ${CODE[l].trim()}`);
    const qRight = [7, 9].indexOf(nextLine);
    const blocked = () => i === Q && guess !== qRight;
    const byHandOk = PIECES.filter(p => p[0] === 1 && kindOf(p[2]) === 0).length;
    const sayFor = k => {
      const [ln, ev, marker, cid, n] = TRACE[k];
      const prev = k ? TRACE[k - 1] : null;
      if (ev === "r") return `Returned ${plural(FINAL.length, "marker")}: ${count(FINAL, "ok")} ok and ${count(FINAL, "not retrieved")} not retrieved. That is the same ${WORDS[count(FINAL, "not retrieved")].toLowerCase()} bad markers you found by hand, plus ${WORDS[count(FINAL, "ok") - byHandOk].toLowerCase()} more ok markers from sentences of run 1 you did not see. The “malformed” line never ran: run 1 has no malformed marker. On run 2 the same function returned ${count(RUN2_REPORT, "ok")} ok and ${count(RUN2_REPORT, "malformed")} malformed.`;
      if (ln === 1) return `<code>answer</code> is run 1's full text. <code>retrieved_ids</code> is the list of the ${RETRIEVED.length} clause numbers that went into the prompt: ${RETRIEVED.join(", ")}.`;
      if (ln === 2 && n === 0) return "<code>report</code> starts empty. <code>re.findall</code> returns every piece of text from a [ to the next ], left to right. The loop takes them one at a time.";
      if (ln === 2) return `<code>report</code> has ${plural(n, "entry")} now. ${n === FINAL.length ? "No markers left." : "Take the next marker."}`;
      if (ln === 3) return `marker = ${marker}. This line strips the two brackets and keeps the clause id as <code>cid</code>.${prev && prev[3] ? ` (cid still shows the last marker's value until this line runs.)` : ""}`;
      if (ln === 4) return `cid = "${cid}". Is it in the agreed form: digits, dot, digits, dot, digits? <code>re.fullmatch</code> needs the whole string to match.`;
      if (k === Q) return `"${cid}" has the agreed form, so the “malformed” line is skipped. Is it one of the retrieved ids? Predict before you step on.`;
      if (ln === 6) return `"${cid}" has the agreed form, so the “malformed” line is skipped. Is it one of the retrieved ids?`;
      if (ln === 7) return `No: ${cid} is not in retrieved_ids. Record it as not retrieved.`;
      if (ln === 9) return `Yes: ${cid} is in retrieved_ids. Record it as ok.`;
      if (ln === 10) return "The loop is done. Return the report.";
      return "";
    };
    const paint = () => {
      const [ln, , marker, cid, n] = TRACE[i];
      el.innerHTML = `<h1>The same check, in Python</h1>
        <p class="lead">This is the check you just did by hand, as a short Python function. It was run on run 1's full answer. Each step below is from that real run. The highlighted line is the one about to run.</p>
        <p class="task">Step through to the end. Watch which branch each marker takes. At one step you predict the next line before you can go on. “Next marker” jumps to the next marker.</p>
        ${kit.code(CODE, ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === TRACE.length - 1 || blocked() ? "disabled" : ""}>Next step</button><button type="button" class="btn" data-skip ${i === TRACE.length - 1 || blocked() ? "disabled" : ""}>Next marker</button></div>
        <div class="vars"><span>marker <b>${kit.esc(marker || "–")}</b></span><span>cid <b>${kit.esc(cid || "–")}</b></span><span>step <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(sayFor(i))}
        ${i === Q ? `<div class="lpanel" id="q"><p class="${P}small"><b>Which line runs next?</b></p>${kit.options(qOpts.map(kit.esc), { picked: guess, correct: qRight })}
          ${guess == null ? "" : guess === qRight
            ? kit.feedback(`Right. ${kit.esc(cid)} is not in retrieved_ids (${RETRIEVED.join(", ")}), so the test is true and line ${nextLine} records it as not retrieved.`, true)
            : kit.feedback(`Line 9 runs only when the test on line 6 is false, that is, when the id is in retrieved_ids. Is ${kit.esc(cid)} in ${RETRIEVED.join(", ")}?`, false)}</div>` : ""}
        ${n == null ? "" : kit.table(FINAL.slice(0, n), { head: ["marker", "status"], title: "report", fresh: n - 1, empty: "empty list" })}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelectorAll("#q .lopts button").forEach(b => b.onclick = () => { guess = +b.dataset.i; paint(); });
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === TRACE.length - 1) done(); };
      // jump to the next time the loop takes a marker (or to the end)
      el.querySelector("[data-skip]").onclick = () => { let j = i + 1; while (j < TRACE.length - 1 && TRACE[j][0] !== 3 && !(j === Q && guess !== qRight)) j++; i = j; paint(); if (i === TRACE.length - 1) done(); };
    };
    paint();
  }

  /* 5. Repair: send the report back once, predict what happens, check again. */
  function repair({ el, done, kit }) {
    style();
    let ans = null;
    const opts = [
      "It now cites [6.1.7], the retrieved clause about the RCD",
      "It says the given clauses do not cover RCD testing, as asked",
      "The sentence about testing is gone"
    ];
    const correct = /test/i.test(REC_REPAIR.text) ? -1 : 2;
    const paint = () => {
      const passed = REPAIR_REPORT.every(r => r[1] === "ok");
      el.innerHTML = `<h1>Reject, or repair once</h1>
        <p class="lead">Run 1 failed the check: ${FINAL.filter(r => r[1] !== "ok").map(r => r[0]).join(" and ")} did not resolve. You can reject the answer and show “no answer”. Or you can repair it: send the answer back to the model with a message your code builds from the report, then check the new answer again.</p>
        <div class="${P}q"><span class="run">The message your code sent</span>${kit.esc(REPAIR_MSG)}</div>
        <p class="task">Run 1 had a sentence saying the RCD must be tested [4.4.1]. Predict what the rewrite did with it.</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback(`Right. The rewrite dropped both sentences that had bad markers: the zone 1 sentence and the testing sentence. It did not say they were not covered, though the message asked for that. The check on the new answer: ${plural(REPAIR_REPORT.length, "marker")}, ${count(REPAIR_REPORT, "ok")} ok. ${passed ? "It passes." : ""} So the repair worked, but it cost a second model call, and the electrician silently lost the testing rule. Check again after every repair, try at most once or twice, then reject or show what is missing.`, true)
          : ans === 0 ? kit.feedback("6.1.7 says an RCD is needed, not how to test it. The rewrite did not move the citation. Look at the answer below.", false)
          : kit.feedback("The message asked for exactly that, so it is a fair guess. This model did not do it. A request in the prompt is not a guarantee. Look at the answer below.", false)}
        ${ans == null ? "" : `<div class="${P}q"><span class="run">The rewritten answer</span>${kit.esc(REC_REPAIR.text).replace(/\n\n/g, "<br><br>")}</div>${caption()}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 6. Broken on purpose: the check says everything is fine. */
  function broken({ el, done, kit }) {
    style();
    const CAUSE = [11, 13];
    let line = null, found = false, fix = null;
    const lineSay = {
      2: "The regex finds all six markers: the output has six rows. Finding markers is not the problem.",
      3: "Stripping the brackets works: the output shows clean numbers like 6.1.1.",
      4: "The shape test is fine: these markers really are well formed, so they correctly skip the “malformed” line.",
      6: "The test is the same as in the correct check; it is only as good as the list it is given. Where does book_ids come from?",
      9: "This line only runs after the test above it said yes. Look at what that test compares against.",
      12: "run1 is run 1's full answer, the same text you checked by hand. The answer is right. What is it compared with?"
    };
    const fixes = [
      "Pass the ids of the retrieved chunks: check_citations(answer, retrieved_ids)",
      "Make the regex that finds markers stricter",
      "Add “cite only the clauses given” to the prompt"
    ];
    const paint = () => {
      el.innerHTML = `<h1>The check that passes everything</h1>
        <p class="lead">A teammate added the check to the helper. On run 1's answer it reports every marker as ok, yet you know two of them were never retrieved. This is the real script and its real output.</p>
        <div class="${P}code">${BROKEN.map((c, j) => `<button type="button" data-line="${j}" class="${line === j ? (CAUSE.includes(j) ? "yes" : "no") : found && CAUSE.includes(j) ? "yes" : ""}">${kit.esc(c) || " "}</button>`).join("")}</div>
        <div class="${P}out">${BROKEN_OUT.map(kit.esc).join("\n")}</div>
        <p class="task">${found ? "Now pick the fix." : "Tap the line that causes the wrong result."}</p>
        <div class="lpanel">
        ${line == null ? "" : CAUSE.includes(line)
          ? kit.feedback(`Yes. <code>book_ids</code> is every clause in the book, all ${BOOK_SIZE} of them. The test asks “is this clause in the book?”, not “did the model see this clause?”. 6.1.1 and 4.4.1 are in the book, so they pass. ${line === 11 ? "This line builds the wrong list, and the call below passes it in." : "This call passes the wrong list in. It was built two lines up: <code>book_ids = list(BOOK)</code>."}`, true)
          : kit.feedback(lineSay[line] || "This line is not where the result goes wrong. Two markers say ok but should say not retrieved. Which list decides that?", false)}
        ${found ? `<div id="fix">${kit.options(fixes.map(kit.esc), { picked: fix, correct: 0 })}</div>
          ${fix == null ? "" : fix === 0 ? kit.feedback(`Right. With the ${RETRIEVED.length} retrieved ids, the same function gave the report you stepped through: 6.1.1 and 4.4.1 not retrieved. The list you compare with is the list you put in the prompt. Keep it next to the prompt when you build it.`, true)
            : fix === 1 ? kit.feedback("The regex already finds every marker, and these markers are well formed. A stricter regex cannot tell a retrieved clause from one that only exists in the book.", false)
            : kit.feedback("The prompt already asked the model to use the given clauses, and it still cited 6.1.1. Prompts ask; the check is what catches it, and this check is comparing against the wrong list.", false)}` : ""}
        </div>`;
      el.querySelectorAll(`.${P}code button`).forEach(b => b.onclick = () => {
        if (found) return;
        line = +b.dataset.line;
        if (CAUSE.includes(line)) found = true;
        paint();
      });
      el.querySelectorAll("#fix .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 7. The big picture. */
  function bigPicture({ el, done, kit }) {
    style();
    const zoneClause = SHORT.find(([sid]) => "[" + sid + "]" === FIXED4_ZONE.marker)[1];
    let ans = null;
    const opts = [
      "Every sentence in the answer is true",
      "Every marker points to a chunk that was in the prompt",
      "The retriever found the best clauses for the question"
    ];
    const correct = 1;
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <p><b>What it is for.</b> Answers that someone must check against a source: regulations, policies, contracts, manuals. Give each chunk an id, ask for one fixed marker format, and check every marker in code against the ids you sent.</p>
        <p><b>When not.</b> Chat with no documents, creative writing, and answers computed from data: a chunk cannot prove a sum. Show the query and its result instead.</p>
        <p><b>What it costs.</b> A few tokens per marker, and a check that costs almost nothing. A repair costs a whole second call and can drop sentences.</p>
        <p><b>Other shapes.</b> Ask for JSON with a list of ids per sentence (structured output): the check stays the same. Some APIs return citations as data: Anthropic's citations feature says its pointers are guaranteed valid, and its docs still tell you to check that a citation is there.</p>
        <p class="task">The check passes on an answer. The inspector asks what that proves.</p>
        <div class="lpanel">${kit.options(opts.map(kit.esc), { picked: ans, correct })}
        ${ans == null ? "" : ans === correct
          ? kit.feedback("Right. It proves where each marker points, nothing more. Whether the chunk supports the sentence is a separate check, and whether retrieval found the right chunks is another. You saw markers that resolve on sentences their chunk does not say.", true)
          : ans === 0 ? kit.feedback(`No. Run ${FIXED4_ZONE.run} with the new prompt wrote “${kit.esc(FIXED4_ZONE.text)} ${FIXED4_ZONE.marker}” and passed. ${FIXED4_ZONE.marker.slice(1, -1)} is clause ${zoneClause}, which only says “zones: see 6.1.1”. It never says where zone 1 is, and “around” is not in it. A marker can resolve on a sentence its chunk does not support.`, false)
          : kit.feedback("No. The check only looks at what was retrieved. Retrieval left out 6.1.1, which defines the zones, and every answer still passed with the new prompt.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === correct) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A bank's staff helper answers from the internal policy handbook. Compliance must be able to open the exact paragraph behind every answer.", true,
      "Yes. Number the paragraphs you send, ask for those ids in one format, and reject any id that was not sent. Compliance opens the paragraph through your map.",
      "This is the inspector again under another name. Someone must open the source of each answer, so give the paragraphs ids, ask for one marker format and check every marker against the ids you sent."],
    ["A team lead asks a bot “how many overtime hours did my team log last month?”. The bot runs a database query over the timesheets and reports the total.", false,
      "No. The answer is a calculation, not a passage. No chunk holds the total, so a citation could only point at rows, and that does not prove the sum. Show the query and its result so the lead can check them.",
      "A citation points to a passage that says the claim. Here no passage says the total: the bot added numbers up. Citing a chunk cannot prove the sum is right. Show the query and its result instead."],
    ["A lawyer's assistant retrieves past cases from a case database. In testing it sometimes also names well-known cases it seems to remember from training.", true,
      "Yes. A remembered case is exactly a citation that was never retrieved. The check rejects any case id not in the retrieved set, before a lawyer relies on it.",
      "Those remembered cases are the 6.1.1 problem: a real-looking reference the model never read in this prompt. Checking every case id against the retrieved set catches them."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would a citation check help?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from the electricians.</p>
        <p class="task">For each one, decide if checked citations to retrieved chunks are the right tool. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>What you can do now</h1>
      <p class="lead">You can make a model cite chunk ids in one fixed format, check every marker in code against the ids you sent, and reject or repair the answer when a marker is malformed or was never retrieved. You also know the limit: a marker that resolves is not yet a sentence that is true.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows the lesson. You write <code>check_citations</code> yourself and run it on recorded answers, including malformed markers and ids that were never retrieved.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. It moves from chunks to facts linked in a graph, for questions that need several of them joined together.</p>` : ""}`;
    done();
  }

  const Q_STEP = TRACE.findIndex(t => t[0] === 6 && FINAL[t[4]] && FINAL[t[4]][1] === "not retrieved");
  LessonKit.define(ID, {
    title: "Citations that point to real chunks",
    checked: "2026-11-13",
    sources: [
      "https://docs.python.org/3/library/re.html",
      "https://openrouter.ai/docs/features/structured-outputs",
      "https://platform.claude.com/docs/en/build-with-claude/citations"
    ],
    interview: [{
      q: "Your RAG assistant for a compliance team cites section numbers after each sentence. Auditors say some cited sections do not contain the claim, and some were never in the retrieved context. How do you fix it?",
      good: [
        "Give each retrieved chunk an id of my own and ask for one fixed marker format, then map ids back to section numbers in code",
        "Parse every marker and compare it with the set of ids that went into the prompt: flag malformed and not-retrieved ones",
        "On a failure, reject or send the report back once and check the rewrite again; cap the retries",
        "Treat “points to a retrieved chunk” and “the chunk supports the sentence” as two separate checks, and measure the second one too",
        "Log failures per prompt version, so a prompt change that makes them worse shows up"
      ],
      weak: "Tell the model in the prompt to cite only real sections, or check the numbers against the whole document. Neither proves the model saw that section in this answer's context."
    }],
    screens: [byHand, spotIdea, fixedFormat, asCode, repair, broken, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c1 [data-wrong]"], right: PIECES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [...Array(Q_STEP).fill("[data-next]"), "#q [data-wrong]"], right: ["#q [data-right]", ...Array(TRACE.length - 1 - Q_STEP).fill("[data-next]")] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-line="6"]'], right: ['[data-line="13"]', "#fix [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
