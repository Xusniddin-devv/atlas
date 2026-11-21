/* Lesson: confusion matrix, precision, recall and F1. Story: a support team for online shop software lets a
   small language model flag customer messages as urgent; a missed outage report costs far more than a false
   alarm. Ideas: (1) sort predictions into four boxes (the confusion matrix) and read two different questions
   off it: precision (when it flags, is it right?) and recall (of the real emergencies, how many did it flag?),
   with F1 as their harmonic mean; (2) choose the number to watch from the cost of each kind of mistake.
   Data, all real:
   - docs/ai-path/runs/s2-precision-recall/messages.py: the twenty messages and the team's own review of each
     (the ground truth, written for the lesson);
   - recordings (main checkout) docs/ai-path/recordings/s2-precision-recall/flags-strict and flags-cautious:
     the same model given two different instructions (made by make_requests.py in the runs folder);
   - docs/ai-path/runs/s2-precision-recall/count_boxes.py + .out.txt: the plain Python counter, traced line by
     line on the strict flags;
   - docs/ai-path/runs/s2-precision-recall/numpy_matrix.py + .out.txt: the NumPy matrix on the cautious flags,
     then on a flagger that flags nothing.
   Lesson-local style: the 2 x 2 box picture and the message card (.lx-s2-precision-recall-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s2-precision-recall";
  const X = `lx-${ID}`;

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s2-precision-recall/messages.py: [message, team's review (1 = really urgent)]
  const MESSAGES = [
    ["Checkout page shows a blank screen for every customer since 9:40. We are losing orders.", 1],
    ["How do I change the font on my product pages?", 0],
    ["URGENT!!! I need a copy of my March invoice for my accountant today.", 0],
    ["hey, quick one, is it normal that we have had zero orders since lunch? usually we get about forty by now.", 1],
    ["Can you add PayPal to the list of payment options? Would be great.", 0],
    ["Card payments keep failing with error 502, three customers called us already.", 1],
    ["I forgot my password and the reset email is not arriving.", 0],
    ["Our shop has been down for an hour, customers see 'site not found'.", 1],
    ["Please cancel my subscription at the end of the month.", 0],
    ["Someone logged into our admin from another country and changed the bank account for payouts.", 1],
    ["The new theme looks great, thanks for the update!", 0],
    ["Product images load slowly on mobile, maybe 3-4 seconds.", 0],
    ["Emergency: my logo is blurry on the homepage, we launch a campaign next week.", 0],
    ["Orders are going through but customers are being charged twice.", 1],
    ["Our shop was down for ten minutes last night, but it is back now. Just letting you know.", 0],
    ["Just wondering, the Add to cart button is greyed out on every product today. Did you change something?", 1],
    ["Payments failed for one customer yesterday. Her card had expired, so she used another one.", 0],
    ["Our shipping labels print the German addresses in the wrong format.", 0],
    ["A customer forwarded us her order confirmation email, and it shows another customer's name and home address.", 1],
    ["Could you call me back about upgrading our plan? No rush.", 0]
  ];
  // The two instructions, quoted from make_requests.py (SYSTEM), the parts that differ
  const RULE_STRICT = "Mark a message URGENT only if the customer says their shop is down or their payments are failing. Everything else is NOT_URGENT.";
  const RULE_CAUTIOUS = "A missed emergency is much worse than a false alarm. Mark a message URGENT if there is any chance that it reports a shop that is down, money being lost, or a security problem, or if the customer sounds like they need help today. Only clearly routine messages are NOT_URGENT.";

  // From docs/ai-path/recordings/s2-precision-recall/flags-strict.json and flags-cautious.json (full text, not altered)
  const REC_STRICT = {
    src: "s2-precision-recall/flags-strict",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "1: URGENT\n2: NOT_URGENT\n3: NOT_URGENT\n4: NOT_URGENT\n5: NOT_URGENT\n6: URGENT\n7: NOT_URGENT\n8: URGENT\n9: NOT_URGENT\n10: NOT_URGENT\n11: NOT_URGENT\n12: NOT_URGENT\n13: NOT_URGENT\n14: URGENT\n15: NOT_URGENT\n16: NOT_URGENT\n17: NOT_URGENT\n18: NOT_URGENT\n19: NOT_URGENT\n20: NOT_URGENT"
  };
  const REC_CAUTIOUS = {
    src: "s2-precision-recall/flags-cautious",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: "1: URGENT\n2: NOT_URGENT\n3: URGENT\n4: URGENT\n5: NOT_URGENT\n6: URGENT\n7: URGENT\n8: URGENT\n9: NOT_URGENT\n10: URGENT\n11: NOT_URGENT\n12: NOT_URGENT\n13: URGENT\n14: URGENT\n15: NOT_URGENT\n16: URGENT\n17: NOT_URGENT\n18: URGENT\n19: URGENT\n20: NOT_URGENT"
  };
  const CAPTION = `Recorded model output, ${REC_STRICT.recordedAt}`;

  // count_boxes from docs/ai-path/runs/s2-precision-recall/count_boxes.py, line for line (line 0 = def in the trace;
  // the screen text counts from 1, as a reader counts the listing)
  const CODE = [
    "def count_boxes(is_urgent, flagged):",
    "    caught = missed = false_alarm = left_alone = 0",
    "    for urgent, flag in zip(is_urgent, flagged):",
    "        if urgent and flag:",
    "            caught += 1",
    "        elif urgent:",
    "            missed += 1",
    "        elif flag:",
    "            false_alarm += 1",
    "        else:",
    "            left_alone += 1",
    "    return caught, missed, false_alarm, left_alone"
  ];
  // Trace rows from count_boxes.out.txt: [line about to run, event (l = line, r = return), urgent, flag,
  // caught, missed, false_alarm, left_alone]
  const TRACE = [[1,"l",null,null,null,null,null,null],[2,"l",null,null,0,0,0,0],[3,"l",1,1,0,0,0,0],[4,"l",1,1,0,0,0,0],[2,"l",1,1,1,0,0,0],[3,"l",0,0,1,0,0,0],[5,"l",0,0,1,0,0,0],[7,"l",0,0,1,0,0,0],[10,"l",0,0,1,0,0,0],[2,"l",0,0,1,0,0,1],[3,"l",0,0,1,0,0,1],[5,"l",0,0,1,0,0,1],[7,"l",0,0,1,0,0,1],[10,"l",0,0,1,0,0,1],[2,"l",0,0,1,0,0,2],[3,"l",1,0,1,0,0,2],[5,"l",1,0,1,0,0,2],[6,"l",1,0,1,0,0,2],[2,"l",1,0,1,1,0,2],[3,"l",0,0,1,1,0,2],[5,"l",0,0,1,1,0,2],[7,"l",0,0,1,1,0,2],[10,"l",0,0,1,1,0,2],[2,"l",0,0,1,1,0,3],[3,"l",1,1,1,1,0,3],[4,"l",1,1,1,1,0,3],[2,"l",1,1,2,1,0,3],[3,"l",0,0,2,1,0,3],[5,"l",0,0,2,1,0,3],[7,"l",0,0,2,1,0,3],[10,"l",0,0,2,1,0,3],[2,"l",0,0,2,1,0,4],[3,"l",1,1,2,1,0,4],[4,"l",1,1,2,1,0,4],[2,"l",1,1,3,1,0,4],[3,"l",0,0,3,1,0,4],[5,"l",0,0,3,1,0,4],[7,"l",0,0,3,1,0,4],[10,"l",0,0,3,1,0,4],[2,"l",0,0,3,1,0,5],[3,"l",1,0,3,1,0,5],[5,"l",1,0,3,1,0,5],[6,"l",1,0,3,1,0,5],[2,"l",1,0,3,2,0,5],[3,"l",0,0,3,2,0,5],[5,"l",0,0,3,2,0,5],[7,"l",0,0,3,2,0,5],[10,"l",0,0,3,2,0,5],[2,"l",0,0,3,2,0,6],[3,"l",0,0,3,2,0,6],[5,"l",0,0,3,2,0,6],[7,"l",0,0,3,2,0,6],[10,"l",0,0,3,2,0,6],[2,"l",0,0,3,2,0,7],[3,"l",0,0,3,2,0,7],[5,"l",0,0,3,2,0,7],[7,"l",0,0,3,2,0,7],[10,"l",0,0,3,2,0,7],[2,"l",0,0,3,2,0,8],[3,"l",1,1,3,2,0,8],[4,"l",1,1,3,2,0,8],[2,"l",1,1,4,2,0,8],[3,"l",0,0,4,2,0,8],[5,"l",0,0,4,2,0,8],[7,"l",0,0,4,2,0,8],[10,"l",0,0,4,2,0,8],[2,"l",0,0,4,2,0,9],[3,"l",1,0,4,2,0,9],[5,"l",1,0,4,2,0,9],[6,"l",1,0,4,2,0,9],[2,"l",1,0,4,3,0,9],[3,"l",0,0,4,3,0,9],[5,"l",0,0,4,3,0,9],[7,"l",0,0,4,3,0,9],[10,"l",0,0,4,3,0,9],[2,"l",0,0,4,3,0,10],[3,"l",0,0,4,3,0,10],[5,"l",0,0,4,3,0,10],[7,"l",0,0,4,3,0,10],[10,"l",0,0,4,3,0,10],[2,"l",0,0,4,3,0,11],[3,"l",1,0,4,3,0,11],[5,"l",1,0,4,3,0,11],[6,"l",1,0,4,3,0,11],[2,"l",1,0,4,4,0,11],[3,"l",0,0,4,4,0,11],[5,"l",0,0,4,4,0,11],[7,"l",0,0,4,4,0,11],[10,"l",0,0,4,4,0,11],[2,"l",0,0,4,4,0,12],[11,"l",0,0,4,4,0,12],[11,"r",0,0,4,4,0,12]];
  const COUNT_OUT = "precision 1.0 recall 0.5 f1 0.667"; // last line of count_boxes.out.txt

  // From docs/ai-path/runs/s2-precision-recall/numpy_matrix.py (the part shown) and numpy_matrix.out.txt
  const NP_CODE = [
    "import numpy as np",
    "is_urgent = np.array(TEAM_LABELS)",
    "flagged = np.array(CAUTIOUS_FLAGS)",
    "matrix = np.zeros((2, 2), dtype=int)",
    "np.add.at(matrix, (is_urgent, flagged), 1)",
    "print(matrix)",
    "precision = matrix[1, 1] / matrix[:, 1].sum()",
    "recall = matrix[1, 1] / matrix[1, :].sum()",
    "f1 = 2 * precision * recall / (precision + recall)",
    "print(precision, recall, f1)"
  ];
  const NP_MATRIX = [[8, 4], [0, 8]];            // printed as [[8 4]\n [0 8]]
  const NP_SCORES = "0.6666666666666666 1.0 0.8";
  const NP_EMPTY_MATRIX = "[[12  0]\n [ 8  0]]";  // the flagger that flags nothing
  const NP_EMPTY_SCORES = "nan 0.0";
  const NP_WARNING = "RuntimeWarning: invalid value encountered in scalar divide"; // line printed as "<stdin>:24: RuntimeWarning: …", between the matrix and the scores (run with python -u)

  /* ---------- Derived from the data ---------- */
  const N = MESSAGES.length;
  const parseFlags = rec => rec.text.split("\n").map(l => l.split(": ")[1] === "URGENT" ? 1 : 0);
  const STRICT = parseFlags(REC_STRICT), CAUTIOUS = parseFlags(REC_CAUTIOUS);
  const boxOf = (u, f) => u ? (f ? "tp" : "fn") : (f ? "fp" : "tn");
  const countBoxes = flags => {
    const c = { tp: 0, fn: 0, fp: 0, tn: 0 };
    MESSAGES.forEach(([, u], i) => c[boxOf(u, flags[i])]++);
    return c;
  };
  const scores = c => {
    const precision = c.tp / (c.tp + c.fp), recall = c.tp / (c.tp + c.fn);
    return { precision, recall, f1: 2 * precision * recall / (precision + recall), accuracy: (c.tp + c.tn) / N };
  };
  const CS = countBoxes(STRICT), CC = countBoxes(CAUTIOUS);
  const SS = scores(CS), SC = scores(CC);
  const URGENT = MESSAGES.filter(m => m[1]).length, ROUTINE = N - URGENT;
  const f2 = v => v.toFixed(2);
  const frac = (a, b) => `${a} / ${b}`;
  const plural = (n, w) => `${n} ${n === 1 ? w : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : w + "s"}`;
  const NAMES = { tp: "caught", fn: "missed", fp: "false alarm", tn: "left alone" };
  const TERMS = { tp: "true positive", fn: "false negative", fp: "false positive", tn: "true negative" };

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById(X)) return;
    const s = document.createElement("style");
    s.id = X;
    s.textContent = `
      .${X}-card { margin: 16px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
      .${X}-card p { margin: 0; font-size: 16px; line-height: 1.5; }
      .${X}-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 10px !important; font-size: 14.5px !important; color: var(--ink-2); }
      .${X}-meta b { font-family: var(--mono); font-weight: 600; color: var(--ink); }
      .${X}-n { font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px !important; }
      .${X}-m { display: grid; grid-template-columns: 6.6em 1fr 1fr; gap: 6px; margin: 16px 0 0; max-width: 480px; }
      .${X}-h { font-size: 13.5px; line-height: 1.3; color: var(--muted); align-self: end; padding: 0 2px 2px; }
      .${X}-r { font-size: 13.5px; line-height: 1.3; color: var(--muted); align-self: center; }
      .${X}-b { min-height: 64px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); text-align: left; font: inherit; display: flex; flex-direction: column; justify-content: space-between; gap: 4px; }
      button.${X}-b { cursor: pointer; }
      button.${X}-b:hover { border-color: var(--ink-2); }
      .${X}-b span { font-size: 13.5px; line-height: 1.3; color: var(--ink-2); }
      .${X}-b b { font: 600 22px/1 var(--mono); }
      .${X}-b.${X}-no { border: 2px solid var(--bad); background: var(--bad-soft); }
      .${X}-b.${X}-new { border: 2px solid var(--good); background: var(--good-soft); }
      .${X}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .${X}-quote { margin: 12px 0 0; padding: 8px 12px; border-left: 3px solid var(--line); font-size: 15.5px; line-height: 1.5; color: var(--ink-2); }
      .${X}-out { margin: 10px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--sunk); font: 500 14px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .${X}-steps { margin: 12px 0 0; }
    `;
    document.head.appendChild(s);
  }
  // The 2 x 2 boxes: rows = team's review (urgent first), columns = flagger (flagged first).
  // o.pick: boxes are buttons (data-box, data-right on o.right, data-wrong on the first other one);
  // o.no: key marked as a mistake; o.fresh: key just filled; o.terms: show the textbook names too.
  function boxes(kit, c, o = {}) {
    const cell = k => {
      const label = o.terms ? `${NAMES[k]} (${TERMS[k]})` : NAMES[k];
      const cls = `${X}-b${o.no === k ? ` ${X}-no` : ""}${o.fresh === k ? ` ${X}-new` : ""}`;
      if (!o.pick) return `<div class="${cls}"><span>${kit.esc(label)}</span><b>${c[k]}</b></div>`;
      const wrongKey = ["tp", "fn", "fp", "tn"].find(x => x !== o.right);
      return `<button type="button" class="${cls}" data-box="${k}"${k === o.right ? " data-right" : ""}${k === wrongKey ? " data-wrong" : ""} aria-label="${kit.esc(label)}: ${c[k]}"><span>${kit.esc(label)}</span><b>${c[k]}</b></button>`;
    };
    return `<div class="${X}-m"${o.title ? ` aria-label="${kit.esc(o.title)}"` : ""}>
      <span></span><span class="${X}-h">flagged</span><span class="${X}-h">not flagged</span>
      <span class="${X}-r">team says urgent</span>${cell("tp")}${cell("fn")}
      <span class="${X}-r">team says not urgent</span>${cell("fp")}${cell("tn")}</div>`;
  }
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked][0], fb[picked][1])}`;

  /* 1. The situation, and the by-hand sort into four boxes. */
  function sortByHand({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const c = { tp: 0, fn: 0, fp: 0, tn: 0 };
    let last = null;
    const why = (u, f, pick) => {
      const rowOk = (pick === "tp" || pick === "fn") === !!u, colOk = (pick === "tp" || pick === "fp") === !!f;
      const parts = [];
      if (!rowOk) parts.push(`The team's review says this message is ${u ? "really urgent" : "not urgent"}, so it belongs in the “team says ${u ? "urgent" : "not urgent"}” row.`);
      if (!colOk) parts.push(`The flagger answered ${f ? "URGENT" : "NOT_URGENT"}, so it belongs in the “${f ? "flagged" : "not flagged"}” column.`);
      return parts.join(" ");
    };
    const paint = () => {
      const fin = k >= N;
      const cur = fin ? null : MESSAGES[k], f = fin ? null : STRICT[k];
      const right = fin ? null : boxOf(cur[1], f);
      el.innerHTML = `<h1>Which messages are urgent?</h1>
        <p class="lead">A company sells online shop software. Its support team gets hundreds of messages a day. A small language model, the <b>flagger</b>, now marks the urgent ones so an engineer looks at them first. The team's instruction to it: “${kit.esc(RULE_STRICT)}”</p>
        <p class="lead">A shop that is down loses orders every minute. So a <b>missed</b> emergency costs far more than a <b>false alarm</b>, which costs an engineer a few minutes. Before the team switches the flagger on, they must measure how well it works. This lesson is about that measuring.</p>
        <p class="lead">To check the flagger, the team reviewed ${N} messages themselves. Next to each one you see their verdict and what the model answered.</p>
        ${fin ? "" : `<p class="task">Tap the box that fits both answers: the team's verdict picks the row, the flagger's answer picks the column.</p>
        <div class="${X}-card"><p class="${X}-n">message ${k + 1} of ${N}</p><p>${kit.esc(cur[0])}</p>
          <p class="${X}-meta"><span>team says <b>${cur[1] ? "urgent" : "not urgent"}</b></span><span>flagger <b>${f ? "URGENT" : "NOT_URGENT"}</b></span></p></div>`}
        ${boxes(kit, c, fin ? { terms: false } : { pick: true, right, no: wrong, fresh: wrong ? null : last })}
        ${fin ? `<p class="${X}-cap">Flags: ${CAPTION}</p>` : ""}
        <div class="lpanel">${wrong ? kit.feedback(why(cur[1], f, wrong), false) : ""}
        ${fin ? kit.feedback(`All ${N} sorted. The flagger raised ${plural(c.tp + c.fp, "flag")}, and every one was real: no false alarms. But look at the other column: ${plural(c.fn, "urgent message")} sat in the queue unflagged, among them “${kit.esc(MESSAGES[MESSAGES.findIndex((m, i) => m[1] && !STRICT[i])][0])}” This 2&nbsp;×&nbsp;2 table of counts is called a <b>confusion matrix</b>: one row per true answer (the team's review), one column per prediction (the flagger's answer).`, true) : ""}</div>`;
      el.querySelectorAll("[data-box]").forEach(b => b.onclick = () => {
        const pick = b.dataset.box;
        if (pick !== right) { wrong = pick; paint(); return; }
        c[right]++; last = right; wrong = null; k++; paint();
        if (k >= N) done();
      });
    };
    paint();
  }

  /* 2. Fill in precision, recall and F1 yourself, then name them. */
  function computeByHand({ el, done, kit }) {
    ensureStyle();
    let q = 0, ans = null;
    const c = CS, s = SS;
    const Q = [
      { task: "When the flagger says URGENT, how often does the team agree?",
        opts: [frac(c.tp, c.tp + c.fn), frac(c.tp, c.tp + c.fp), frac(c.tp, N), frac(c.tp + c.tn, N)], right: 1,
        fb: [
          [`${c.tp + c.fn} is the number of really urgent messages (the whole top row). That answers a different question: how many of the urgent ones it found. Here you only look at what it flagged: the “flagged” column.`, false],
          null,
          [`Most of the ${N} messages were never flagged, so they say nothing about whether its flags are right. Divide by the flags it raised: the “flagged” column.`, false],
          [`${c.tp + c.tn} is every box where the flagger agreed with the team, flags and non-flags together. That is <b>accuracy</b>. The question is only about the times it said URGENT.`, false]] },
      { task: "Of the messages that really were urgent, what share did it flag?",
        opts: [frac(c.tp, c.tp + c.fp), frac(URGENT, N), frac(c.tp, N), frac(c.tp, c.tp + c.fn)], right: 3,
        fb: [
          [`That is the answer to the last question: its flags were all real. This question starts from the other side, from the ${URGENT} urgent messages in the top row.`, false],
          [`${URGENT} of ${N} messages are urgent, whatever the flagger did. That is how common emergencies are, not how many it found.`, false],
          [`Divide by the urgent messages only, the top row. The routine messages could never have been “found”.`, false],
          null] },
      { task: `Precision is ${f2(s.precision)} and recall is ${f2(s.recall)}. F1 = 2 × precision × recall / (precision + recall). What is F1?`,
        opts: [f2((s.precision + s.recall) / 2), f2(s.accuracy), f2(s.f1), f2(Math.min(s.precision, s.recall))], right: 2,
        fb: [
          [`That is the plain average. F1 is a different mean (the harmonic mean): it is pulled toward the smaller of the two, so a very good precision cannot hide a weak recall. Work the formula: 2 × ${f2(s.precision)} × ${f2(s.recall)} / ${f2(s.precision + s.recall)}.`, false],
          [`${f2(s.accuracy)} is the accuracy, ${frac(c.tp + c.tn, N)}. Work the formula with the two numbers given.`, false],
          null,
          [`That is just the smaller of the two. F1 sits between them, closer to the smaller one. Work the formula: 2 × ${f2(s.precision)} × ${f2(s.recall)} / ${f2(s.precision + s.recall)}.`, false]] }
    ];
    const named = [
      `Right: ${frac(c.tp, c.tp + c.fp)} = ${f2(s.precision)}. That share is called <b>precision</b>: of everything flagged, how much was real. Its mistakes are the false alarms.`,
      `Right: ${frac(c.tp, c.tp + c.fn)} = ${f2(s.recall)}. That share is called <b>recall</b>: of everything really urgent, how much got flagged. Its mistakes are the misses.`,
      `Right: ${f2(s.f1)}. <b>F1</b> folds both into one number, and it counts a miss and a false alarm as equally bad.`
    ];
    const paint = () => {
      const fin = q >= Q.length, cur = fin ? null : Q[q];
      el.innerHTML = `<h1>Two questions, two numbers</h1>
        <p class="lead">Here are the boxes you filled. The textbook names: caught = <b>true positive</b> (TP), missed = <b>false negative</b> (FN), false alarm = <b>false positive</b> (FP), left alone = <b>true negative</b> (TN). “Positive” just means the class you are hunting, here “urgent”.</p>
        ${boxes(kit, c, { terms: false })}
        ${named.slice(0, q).map(t => kit.feedback(t, true)).join("")}
        ${fin ? "" : `<p class="task">${cur.task}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`So: precision = TP / (TP + FP) = ${f2(s.precision)}, recall = TP / (TP + FN) = ${f2(s.recall)}, F1 = ${f2(s.f1)}. Same matrix, two different questions, two very different answers.`) : ask(kit, cur.opts, cur.right, ans, cur.fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[q].right) { q++; ans = null; paint(); if (q >= Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 3. Spot the idea: the number to watch comes from the cost of each mistake. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const nothingAcc = ROUTINE / N;
    const opts = [
      "Ship it: every flag it raises is real, so no engineer's time is wasted",
      `Do not ship: recall is ${f2(SS.recall)}, so ${plural(CS.fn, "real emergency")} went unflagged, and misses are the expensive mistake`,
      `Ship it: ${f2(SS.accuracy)} accuracy is a good score`,
      `Do not ship: an F1 of ${f2(SS.f1)} is below the usual bar`
    ];
    const fb = [
      ["That protects against the cheap mistake. A false alarm costs a few minutes; a missed outage costs a shop its orders for hours. Perfect precision says nothing about the messages it never flagged.", false],
      [`Right. Choose the number to watch from what each mistake costs. Misses cost more: watch <b>recall</b>. False alarms cost more (say, each flag wakes someone at night): watch <b>precision</b>. Both cost about the same: <b>F1</b> is a fair single number. Here the team should watch recall and keep precision at a level the engineers can live with.`, true],
      [`Accuracy counts every right answer, and most of the ${N} messages are routine ones that are easy to leave alone. A flagger that flags nothing at all would score ${ROUTINE} / ${N} = ${f2(nothingAcc)} on this set, while missing every emergency.`, false],
      ["There is no usual bar for F1; a good value depends on the task. And F1 treats a miss and a false alarm as equally bad, which is not true for this team. The real reason is in the misses.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Is it good enough?</h1>
        <p class="lead">The flagger you just scored:</p>
        ${kit.table([["accuracy", `${frac(CS.tp + CS.tn, N)} = ${f2(SS.accuracy)}`], ["precision", f2(SS.precision)], ["recall", f2(SS.recall)], ["F1", f2(SS.f1)]], { head: ["number", "value"], title: "Strict flagger, " + N + " messages" })}
        <p class="lead">The team lead wants to switch it on for everyone: “Precision is perfect and accuracy is ${Math.round(SS.accuracy * 100)}%.”</p>
        <p class="task">What do you tell her?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Use it: predict the rewrite, compute its precision, choose a version. */
  function rewrite({ el, done, kit }) {
    ensureStyle();
    let q = 0, ans = null;
    const moved = MESSAGES.map((m, i) => [m, boxOf(m[1], STRICT[i]), boxOf(m[1], CAUTIOUS[i])]).filter(r => r[1] !== r[2]);
    const newFA = moved.filter(r => r[2] === "fp").map(r => r[0][0]);
    const Q = [
      { task: "Same model, same messages, only the instruction changed. Compared with the strict version, what happens to the boxes?",
        opts: ["Fewer misses, and still no false alarms", "Nothing changes: it is the same model", "Fewer misses, more false alarms", "More misses"], right: 2,
        fb: [
          ["“If the customer sounds like they need help today” also fits routine messages written in a hurry. Asking it to flag more makes it flag some routine ones too.", false],
          ["The instruction is part of the model's input. Change the input and the answers can change, even with the same model and the same messages.", false],
          null,
          ["It was told that a miss is much worse and to flag when in doubt. That pushes toward more flags, not fewer.", false]] },
      { task: "What is the cautious version's precision?",
        opts: [frac(CC.tp, CC.tp + CC.fn), frac(CC.tp, CC.tp + CC.fp), frac(CC.tp, N), frac(CC.tp + CC.tn, N)], right: 1,
        fb: [
          ["That divides by the urgent row: it is the recall. Precision divides by everything flagged, the “flagged” column.", false], null,
          [`Divide by the flags it raised, not by all ${N} messages.`, false],
          ["That is the accuracy: all agreements, flags and non-flags. Precision only looks at the flagged column.", false]] },
      { task: "Which version should the team switch on?",
        opts: ["The strict one: its precision is higher", "The cautious one: it flagged every urgent message", "Either: their accuracy is the same"], right: 1,
        fb: [
          [`Higher precision means fewer wasted minutes, but the strict one let ${plural(CS.fn, "emergency")} sit unflagged. For this team a miss costs far more.`, false],
          null,
          [`Accuracy is the same, ${frac(CS.tp + CS.tn, N)} each, because it counts a miss and a false alarm as one mistake each. The strict one made ${plural(CS.fn, "miss")}; the cautious one made ${plural(CC.fp, "false alarm")}. For this team those are not the same.`, false]] }
    ];
    const say = [
      `Right. The recorded run: misses fell from ${CS.fn} to ${CC.fn}, false alarms rose from ${CS.fp} to ${CC.fp}. The new false alarms: ${newFA.map(t => `“${kit.esc(t)}”`).join(" ")}`,
      `Right: ${frac(CC.tp, CC.tp + CC.fp)} = ${f2(SC.precision)}. Recall is ${frac(CC.tp, CC.tp + CC.fn)} = ${f2(SC.recall)}.`,
      `Right. Recall ${f2(SC.recall)} against ${f2(SS.recall)}, at the price of ${plural(CC.fp, "false alarm")}. One warning: recall alone can be gamed. Flag all ${N} messages and recall is ${f2(1)}, but precision falls to ${frac(URGENT, N)} = ${f2(URGENT / N)}, and engineers stop reading flags. Watch recall, and keep an eye on precision.`
    ];
    const paint = () => {
      const fin = q >= Q.length, cur = fin ? null : Q[q];
      el.innerHTML = `<h1>The team rewrites the instruction</h1>
        <p class="lead">The new instruction says:</p>
        <p class="${X}-quote">${kit.esc(RULE_CAUTIOUS)}</p>
        ${q >= 1 ? `${boxes(kit, CC, { title: "cautious flagger" })}<p class="${X}-cap">Cautious flagger. Flags: ${CAPTION}</p>` : ""}
        ${q >= 2 ? kit.table([["accuracy", `${f2(SS.accuracy)} · ${f2(SC.accuracy)}`], ["precision", `${f2(SS.precision)} · ${f2(SC.precision)}`], ["recall", `${f2(SS.recall)} · ${f2(SC.recall)}`], ["F1", `${f2(SS.f1)} · ${f2(SC.f1)}`]], { head: ["number", "strict · cautious"] }) : ""}
        ${say.slice(0, q).map(t => kit.feedback(t, true)).join("")}
        ${fin ? "" : `<p class="task">${cur.task}</p>`}
        <div class="lpanel">${fin ? "" : ask(kit, cur.opts, cur.right, ans, cur.fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[q].right) { q++; ans = null; paint(); if (q >= Q.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 5. From scratch: the four counters in plain Python, a stepped replay of the traced run. */
  const INC = { 4: "caught", 6: "missed", 8: "false_alarm", 10: "left_alone" };
  const FR = (() => {
    const fr = [{ ln: 1, msg: null, row: TRACE[1] }];
    let msg = 0;
    for (let k = 0; k < TRACE.length; k++) {
      const r = TRACE[k];
      if (INC[r[0]] && r[1] === "l") { msg++; fr.push({ ln: r[0], msg, row: TRACE[k + 1] }); }
    }
    fr.push({ ln: 11, msg: null, row: TRACE[TRACE.length - 1], end: true });
    return fr;
  })();
  function scratch({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i], r = f.row;
      const v = (x, d = "–") => x == null ? d : x;
      let txt;
      if (f.end) txt = `The loop is over. Line 12 returns (${r[4]}, ${r[5]}, ${r[6]}, ${r[7]}), the same four boxes you filled by hand. The script then printed: <code>${kit.esc(COUNT_OUT)}</code>`;
      else if (!f.msg) txt = "Line 2 sets all four counters to 0. <code>zip</code> will hand over one pair at a time: the team's answer and the flag for the same message.";
      else txt = `Message ${f.msg}: urgent = ${r[2]}, flag = ${r[3]}, so line ${f.ln + 1} ran and <code>${INC[f.ln]}</code> is now ${r[4 + [4, 6, 8, 10].indexOf(f.ln)]}.`;
      el.innerHTML = `<h1>The same count in Python</h1>
        <p class="lead"><code>is_urgent</code> holds the team's answers and <code>flagged</code> the strict flagger's, as 1 and 0. The order of the <code>if</code> tests matters: once the first one fails, <code>elif urgent</code> can only be true for an urgent message that was not flagged.</p>
        <p class="task">Step through all ${N} messages to the end.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>caught <b>${v(r[4])}</b></span><span>missed <b>${v(r[5])}</b></span><span>false_alarm <b>${v(r[6])}</b></span><span>left_alone <b>${v(r[7])}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(txt)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 6. With NumPy: read the printed matrix. Its layout is not the one you drew. */
  function withNumpy({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const RIGHT = "0,1";
    const meaning = { "0,0": "not urgent and not flagged: left alone", "0,1": "not urgent but flagged: the false alarms", "1,0": "urgent but not flagged: the misses", "1,1": "urgent and flagged: caught" };
    const fb = k => k === RIGHT
      ? [`Right: row 0 is <code>is_urgent == 0</code>, column 1 is <code>flagged == 1</code>, so <code>matrix[0, 1]</code> = ${NP_MATRIX[0][1]} counts the false alarms. NumPy puts index 0 first, so this matrix is your hand-drawn one flipped: “not urgent” is the top row and “not flagged” the left column. That is why line 7 divides by <code>matrix[:, 1]</code> (the whole flagged column). The run printed <code>${kit.esc(NP_SCORES)}</code>: precision, recall and F1, the same as you computed. scikit-learn's <code>confusion_matrix</code> uses this layout too: rows are the true labels, columns the predictions, labels in sorted order, so true negatives sit top left. Before reading any matrix, check which axis is which.`, true]
      : [`<code>matrix[${k.replace(",", ", ")}]</code> is ${meaning[k]}. Line 5 adds 1 at (is_urgent, flagged) for each message, so the row is the team's answer (0 or 1) and the column is the flag (0 or 1).`, false];
    const paint = () => {
      el.innerHTML = `<h1>The same matrix with NumPy</h1>
        <p class="lead">Now the cautious flagger, scored with NumPy. <code>TEAM_LABELS</code> and <code>CAUTIOUS_FLAGS</code> are the two lists of 1 and 0. For each message, line 5 adds 1 to the cell at (row = <code>is_urgent</code>, column = <code>flagged</code>). Below the code is the matrix our run printed.</p>
        ${kit.code(NP_CODE, 5)}
        ${kit.pics.grid(NP_MATRIX, { pick: true, rowHead: ["row 0", "row 1"], colHead: ["col 0", "col 1"], cls: ans ? { [ans]: ans === RIGHT ? "enter" : "no" } : {}, title: "print(matrix)" })}
        <p class="task">Which printed number counts the false alarms?</p>
        <div class="lpanel">${ans ? kit.feedback(...fb(ans)) : ""}</div>`;
      el.querySelectorAll(".lp-gc[data-i]").forEach(b => b.onclick = () => { ans = b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 7. A flagger that flags nothing: what NumPy does with 0 / 0. */
  function emptyColumn({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["0.0 0.0", "It stops with ZeroDivisionError", "nan 0.0, with a RuntimeWarning", "1.0 0.0"];
    const RIGHT = 2;
    const fb = [
      [`Recall is 0.0: nothing caught out of ${URGENT}. But precision divides by the flagged column, which is 0 + 0. There is no share of nothing; NumPy does not invent a 0 for it.`, false],
      ["That is what plain Python numbers do with a division by zero. These are NumPy integers, and NumPy does not stop the program for it.", false],
      [`Right. Our run printed this:<div class="${X}-out">${kit.esc(NP_EMPTY_MATRIX)}\n… ${kit.esc(NP_WARNING)}\n${kit.esc(NP_EMPTY_SCORES)}</div>(The warning, trimmed, comes from the precision line, when the division runs.) <code>nan</code> means “not a number”, and the warning is easy to miss in a log. A report that shows nan, or a check like <code>precision &gt; 0.9</code> that is simply false for nan, can hide a flagger that has stopped flagging. scikit-learn's <code>precision_score</code> handles this case with its <code>zero_division</code> parameter: by default it returns 0 and warns, and you can set it to 0.0, 1.0 or nan. Either way, look at the counts, not only the ratio.`, true],
      ["A precision of 1.0 would mean every flag was right. There were no flags at all, so there is nothing to be right about.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When the flagger flags nothing</h1>
        <p class="lead">One night the model's provider has an outage and the flagger answers NOT_URGENT for everything. The team reruns the same NumPy code with every flag 0.</p>
        ${kit.code(NP_CODE.slice(6, 8).concat(["print(precision, recall)"]), -1)}
        <p class="task">What does it print?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The counting is slow on large data", "Someone has to give the true answer for every message you score", "They only work for neural networks"];
    const fb = [
      ["It is four counters and two divisions, fast on millions of rows. The cost is elsewhere.", false],
      [`Right. Every number in this lesson rests on the team's review of ${N} messages. A metric is only as good as those labels, and people have to write them, and write them again when the messages change.`, true],
      ["The flagger here was a language model following an instruction. A keyword rule or a classic model is scored the same way: all you need is its yes/no answers and the true answers.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for these numbers</h1>
        <p class="lead"><b>For:</b> judging any yes/no classifier (a rule, a trained model, a prompted LLM). They matter most when the class you hunt is rare, or when the two mistakes cost different amounts.</p>
        <p class="lead"><b>When:</b> before you switch a classifier on, and when you compare two versions.</p>
        <p class="lead"><b>Not</b> when the output is a number (a delivery time: measure the error in minutes), when you rank a list (use measures made for ranked results), or when classes are balanced and both mistakes cost the same (accuracy is simpler).</p>
        <p class="lead"><b>Costs:</b> a labelled set (the true answer for every message). The numbers score one fixed yes or no per message (the next lesson moves the cut-off). And one number hides which messages failed, so read the misses themselves.</p>
        <p class="task">Which cost hits a team first when it wants these numbers?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including one where it does not apply. */
  const CHOICES = ["Watch recall", "Watch precision", "Neither: not a yes/no call"];
  const CASES = [
    ["A camera on a bottling line pushes off bottles it thinks are cracked. A cracked bottle that reaches a shop means the whole batch is taken back; a good bottle pushed off costs a few cents.", 0,
      "Yes. A crack that slips through is the expensive mistake, so you want to catch as many cracks as possible: high recall, and you accept some good bottles pushed off.",
      { 1: "Precision would protect the cheap side: a few cents per good bottle. The costly mistake is a cracked bottle that gets through, which is a miss. Watch recall.",
        2: "It is a yes/no call: cracked or not, pushed off or not. Each bottle lands in one of the four boxes." }],
    ["A small blog's filter deletes comments it marks as spam, with no way to undo it. A real customer comment deleted is lost for good; a spam comment left up is removed by hand later.", 1,
      "Yes. The expensive mistake is deleting a real comment, a false alarm. So when it marks spam it had better be right: high precision, and accept some spam slipping past.",
      { 0: "High recall means deleting as much spam as possible, which also deletes more real comments. Here the false alarm is the costly mistake. Watch precision.",
        2: "Spam or not spam is a yes/no call; every comment lands in one of the four boxes." }],
    ["A pizza shop's app predicts how many minutes a delivery will take.", 2,
      "Right. The answer is a number of minutes, not yes or no. There is no “flagged” to count: a prediction of 31 minutes for a 33-minute trip is not a hit or a miss but 2 minutes off. Measure the error in minutes instead.",
      { 0: "Recall counts how many real yes cases got a yes. A delivery time has no yes or no; 31 against 33 minutes is 2 minutes off, not a miss. Measure the error in minutes.",
        1: "Precision needs flags to check. A delivery time is a number, so measure how many minutes off the prediction is." }],
    ["A hospital's first screening test decides who gets a closer look. Missing a sick patient can be deadly; a healthy patient sent on costs one more appointment.", 0,
      "Yes. A miss is the dangerous mistake, so the first test should catch nearly everyone who is sick: high recall. The closer look then sorts out the false alarms.",
      { 1: "High precision would mean sending on only patients who are surely sick, and missing others. Here a miss is the deadly mistake. Watch recall.",
        2: "Sick or not, sent on or not: a yes/no call, so the four boxes apply." }]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Which number would you watch?</h1>
        <p class="lead">Four systems from other places. For each, ask what one mistake of each kind costs.</p>
        <p class="task">Pick the number to watch for each. Pick again if you change your mind.</p>
        ${CASES.map(([q, right, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(CHOICES, { picked: ans[i], correct: right })}${ans[i] == null ? "" : kit.feedback(ans[i] === right ? yes : no[ans[i]], ans[i] === right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can score a classifier</h1>
      <p class="lead">You sorted ${N} real flags into the four boxes of a confusion matrix, read precision and recall off it, saw two versions with the same accuracy and opposite mistakes, and chose recall because a missed outage costs more than a false alarm.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write the four counters and precision, recall and F1 yourself, and make them safe when nothing was flagged.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. Both flaggers here gave a fixed yes or no; next you use a model's score and move the cut-off yourself, trading precision for recall step by step.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Confusion matrix, precision, recall and F1",
    checked: "2026-11-14",
    sources: [
      "https://scikit-learn.org/stable/modules/model_evaluation.html#precision-recall-and-f-measures",
      "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.confusion_matrix.html",
      "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_score.html",
      "https://numpy.org/doc/stable/reference/generated/numpy.ufunc.at.html"
    ],
    interview: [
      {
        q: "Your team's message classifier reports 95% accuracy, but the on-call engineers still hear about outages from customers first. What do you check?",
        good: [
          "Build the confusion matrix on a labelled sample and look at the urgent class on its own",
          "Check recall for urgent messages: accuracy is dominated by the many routine ones",
          "Read the missed messages to see what they share, such as casual wording",
          "Decide the target from cost: misses are expensive here, so raise recall while keeping precision bearable for the engineers"
        ],
        weak: "Say 95% is a good score, or swap in a bigger model, without counting what kind of mistakes it makes."
      },
      {
        q: "A product manager wants one number to track the flagger every week. Do you give them F1?",
        good: [
          "F1 treats a miss and a false alarm as equally bad, which may not match the business",
          "If misses cost more, track recall, with precision as a floor that must not drop below an agreed level",
          "F-beta with a beta above 1 is a single number that weighs recall more",
          "Also show the raw counts, so a flagger that stops flagging (precision undefined) is visible"
        ],
        weak: "Yes, F1, because it is the standard metric. That skips asking what each mistake costs."
      }
    ],
    screens: [sortByHand, computeByHand, spotIdea, rewrite, scratch, withNumpy, emptyColumn, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: Array(N).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ['[data-i="1,1"]'], right: ['[data-i="0,1"]'] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
