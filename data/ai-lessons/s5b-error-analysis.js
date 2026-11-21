/* Lesson: error analysis. Story: a furniture shop's assembly-help bot; the team wants to spend a month fine-tuning
   because "the answers are bad". Ideas: (1) read the failing conversations and give each one tag, the first
   pipeline step that broke (search, tool, writing); (2) count the tags and pick the fix with the biggest count,
   then rerun and count again (a fix can clear more than its own bucket, and can break what passed by luck).
   Data, all real (the shop, manuals and questions are invented test data):
   - docs/ai-path/runs/s5b-error-analysis/shop.py (manuals, chunkers, keyword search, prompt, spare-part tool),
     questions.py (72 test questions), run_bot.py (the bot; every model call recorded with scripts/ai/record.mjs);
   - recordings (main checkout) docs/ai-path/recordings/s5b-error-analysis/before-<id>-<n> (first version) and
     after-<id>-<n> (search fixed: one chunk per step with the product name), run logs run_before/after.out.txt;
   - check.py + overrides.json: first-pass tags by script, then every failure read by us (check_*.out.txt);
   - tally.py + tally.out.txt: the tally function traced on the learner's eight, and the tallies of both runs.
   Lesson-local style: a conversation transcript block (.lx-s5b-error-analysis-*), see ensureStyle(). */
(() => {
  const ID = "s5b-error-analysis";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Data copied from the runs and recordings ---------- */
  const N_CONVOS = 72; // check_before.out.txt and check_after.out.txt: "72 conversations"
  const OVERRIDES_BEFORE = 4; // overrides.json "before": tags we changed after reading (q07, q35, q40, q51)
  const REFUSAL = "Sorry, I can't find that in our manuals."; // shop.py REFUSAL, quoted in the prompt's rule 2

  // Tags as check.py names them, in pipeline order, with the step each belongs to.
  const TAGS = [
    { key: "wrong retrieval", label: "Wrong retrieval", step: "search", say: "the pieces the search returned do not hold the answer" },
    { key: "tool error", label: "Tool error", step: "tool", say: "the tool returned an error, or a tool was called that should not have been" },
    { key: "refused", label: "Refused when it should answer", step: "writing", say: "the answer was in the pieces, but the bot said it could not find it" },
    { key: "wrong answer", label: "Right sources, wrong answer", step: "writing", say: "the answer was in the pieces, but the reply gets it wrong" },
    { key: "bad format", label: "Bad format", step: "writing", say: "right content, but no source ids in brackets, or more than four steps" }
  ];
  const TAG = Object.fromEntries(TAGS.map(t => [t.key, t]));

  // From tally.out.txt ("failing ids"): the final tag of every failing conversation (check.py + overrides.json).
  const BEFORE_FAIL = [["q03","wrong retrieval"],["q04","wrong retrieval"],["q07","wrong retrieval"],["q09","wrong retrieval"],["q11","refused"],["q12","wrong retrieval"],["q14","tool error"],["q15","wrong retrieval"],["q16","refused"],["q17","wrong retrieval"],["q18","wrong retrieval"],["q20","wrong retrieval"],["q21","tool error"],["q22","refused"],["q23","tool error"],["q26","wrong retrieval"],["q27","refused"],["q32","tool error"],["q33","refused"],["q34","wrong retrieval"],["q35","wrong retrieval"],["q40","wrong retrieval"],["q45","wrong retrieval"],["q46","refused"],["q53","wrong retrieval"],["p01","tool error"],["p02","tool error"],["p03","tool error"],["p04","tool error"],["p05","tool error"],["p06","tool error"],["p08","tool error"],["p09","tool error"],["p10","tool error"],["q55","refused"],["q58","tool error"],["q59","refused"],["q62","wrong retrieval"]];
  const AFTER_FAIL = [["q06","wrong retrieval"],["q11","refused"],["q26","wrong retrieval"],["q32","tool error"],["q33","tool error"],["q35","wrong retrieval"],["q36","wrong retrieval"],["q45","wrong retrieval"],["q51","refused"],["q52","wrong retrieval"],["q59","tool error"],["p01","tool error"],["p02","tool error"],["p03","tool error"],["p04","tool error"],["p05","tool error"],["p06","tool error"],["p08","tool error"],["p09","tool error"],["p10","tool error"]];
  // questions.py: ids starting with "p" are customers reporting a missing or broken part (the tool should run).
  const isPartQuestion = id => id[0] === "p";

  // From docs/ai-path/recordings/s5b-error-analysis/before-<id>-<n>.json (model output: tool calls and answers, not
  // altered) and docs/ai-path/runs/s5b-error-analysis/before.jsonl (the search's pieces and our tool's results).
  const REC = {
    src: "s5b-error-analysis/before-q53-1, before-q22-1, before-q62-1, before-p03-1..2, before-q40-1, before-q03-1, before-q46-1, before-q23-1..2, before-q34-1, before-q36-1, after-q36-1",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-17"
  };
  const CAPTION = `Recorded model output, ${REC.recordedAt}`;
  const CONV = {
    q53: { q: "What holds the hanging rail in the wardrobe?",
      chunks: [["BB-1#c2", "fully yet. Step 2. Drop the twelve slats BB-05 into the rail grooves of the lower bed, curved side facing up. Step 3. Lift the upper bed frame onto the four corner posts"],
               ["BB-1#c3", "and lock each post with one guide pin BB-07. You need two adults for this step. Step 4. Hook the ladder over the upper rail on the right side and fix its bottom with two"]],
      tool: [], answer: "Sorry, I can't find that in our manuals.", step: ["WR-2", 4] },
    q22: { q: "What hex key size for the corner desk legs?",
      chunks: [["CD-4#c2", "frames to the desktop with eight bolts CD-02, using the 5 mm hex key. Step 3. Fit the corner leg CD-10 under the joint. Turn its foot until the desktop is level. Step 4."],
               ["BB-1#c1", "Bunk bed BB-1. Step 1. Lay the two end frames flat. Fix the four side rails to the end frames with eight long bolts BB-03, using the 6 mm hex key. Do not tighten them"]],
      tool: [], answer: "Sorry, I can't find that in our manuals.", step: ["CD-4", 2] },
    q62: { q: "Which side of the bunk bed does the ladder go on?",
      chunks: [["BB-1#c1", "Bunk bed BB-1. Step 1. Lay the two end frames flat. Fix the four side rails to the end frames with eight long bolts BB-03, using the 6 mm hex key. Do not tighten them"],
               ["BB-1#c2", "fully yet. Step 2. Drop the twelve slats BB-05 into the rail grooves of the lower bed, curved side facing up. Step 3. Lift the upper bed frame onto the four corner posts"]],
      tool: [], answer: "Sorry, I can't find that in our manuals.", step: ["BB-1", 4] },
    p03: { q: "Corner desk: the corner leg CD-10 is missing from the box.",
      chunks: [["CD-4#c1", "Corner desk CD-4. Step 1. Join the two desktop halves from underneath with three metal plates CD-06 and twelve short screws CD-07. Step 2. Screw the left and right leg"],
               ["CD-4#c2", "frames to the desktop with eight bolts CD-02, using the 5 mm hex key. Step 3. Fit the corner leg CD-10 under the joint. Turn its foot until the desktop is level. Step 4."]],
      tool: [["order_spare_part", "{\"product_code\":\"CD-4\",\"quantity\":1,\"part_code\":\"CD-10\"}", "{\"error\": \"unknown part code CD-10\"}"]],
      answer: "Sorry, I can't find that in our manuals.", step: null },
    q40: { q: "When should I fix the glass cabinet to the wall?",
      chunks: [["GC-5#c1", "Glass-door cabinet GC-5. Step 1. Build the frame with ten dowels GC-01 and four cam locks GC-03. Step 2. Fix the cabinet to the wall with the wall bracket GC-11 before"],
               ["CH-3#c4", "CH-12 and slide its bottom panel into the groove, smooth side up. Step 6. Fix the anti-tip strap CH-15 to the wall and to the back of the top panel. Always use it: the"]],
      tool: [], answer: "You should fix the cabinet to the wall with the wall bracket before proceeding with further assembly steps. [GC-5#c1]", step: ["GC-5", 2] },
    q03: { q: "Bunk bed: what locks the top bed onto the corner posts?",
      chunks: [["BB-1#c2", "fully yet. Step 2. Drop the twelve slats BB-05 into the rail grooves of the lower bed, curved side facing up. Step 3. Lift the upper bed frame onto the four corner posts"],
               ["BB-1#c4", "short screws BB-09. Step 5. Fit the safety rail on the upper bed with four cam locks BB-11. The top of the rail must sit at least 16 cm above the mattress. Step 6. Now"]],
      tool: [], answer: "The cam locks BB-11 lock the top bed onto the corner posts [BB-1#c4].", step: ["BB-1", 3] },
    q46: { q: "How do I fix the plinth of the wardrobe?",
      chunks: [["WR-2#c1", "Two-door wardrobe WR-2. Step 1. Fix the base plinth to the bottom panel with four screws WR-04. Step 2. Join the side panels to the top and bottom panels with eight cam"],
               ["WR-2#c4", "hinge. Step 6. Fix the wardrobe to the wall with two angle brackets WR-18. The wardrobe can tip over if you do not."]],
      tool: [], answer: "Sorry, I can't find that in our manuals.", step: ["WR-2", 1] },
    q23: { q: "My corner desk is not level at the joint. How do I fix it?",
      chunks: [["CD-4#c2", "frames to the desktop with eight bolts CD-02, using the 5 mm hex key. Step 3. Fit the corner leg CD-10 under the joint. Turn its foot until the desktop is level. Step 4."],
               ["CD-4#c1", "Corner desk CD-4. Step 1. Join the two desktop halves from underneath with three metal plates CD-06 and twelve short screws CD-07. Step 2. Screw the left and right leg"]],
      tool: [["order_spare_part", "{\"product_code\":\"CD-4\",\"quantity\":1,\"part_code\":\"CD-10\"}", "{\"error\": \"unknown part code CD-10\"}"]],
      answer: "Sorry, I can't find that in our manuals.", step: ["CD-4", 3] },
    q34: { q: "My shoe bench scratches the floor. Is there something for that?",
      chunks: [["SB-2#c1", "Shoe bench SB-2. Step 1. Fix the two shelves between the side panels with eight cam locks SB-03. Step 2. Screw the seat board to the top from below with six screws SB-05."],
               ["SB-2#c3", "protect the floor. Step 5. The bench holds two adults sitting. Wipe it with a damp cloth only."]],
      tool: [], answer: "[SB-2#c3]", step: ["SB-2", 4] },
    q36: { q: "How should I clean the shoe bench?",
      chunks: [["SB-2#c1", "Shoe bench SB-2. Step 1. Fix the two shelves between the side panels with eight cam locks SB-03. Step 2. Screw the seat board to the top from below with six screws SB-05."],
               ["SB-2#c3", "protect the floor. Step 5. The bench holds two adults sitting. Wipe it with a damp cloth only."]],
      tool: [], answer: "Wipe it with a damp cloth only. [SB-2#c3]", step: ["SB-2", 5] }
  };
  // From docs/ai-path/recordings/s5b-error-analysis/after-q36-1.json and after.jsonl
  const CONV_AFTER_Q36 = { q: "How should I clean the shoe bench?",
    chunks: [["SB-2#s1", "Shoe bench SB-2, step 1: Fix the two shelves between the side panels with eight cam locks SB-03."],
             ["SB-2#s2", "Shoe bench SB-2, step 2: Screw the seat board to the top from below with six screws SB-05."]],
    tool: [], answer: "Sorry, I can't find that in our manuals." };

  // From shop.py MANUALS: the step each shown question needs (product code, step number) -> text.
  const MANUAL = {
    "WR-2 1": "Fix the base plinth to the bottom panel with four screws WR-04.",
    "WR-2 4": "Screw the hanging rail WR-12 into the two rail holders WR-13, 6 cm below the top panel.",
    "CD-4 2": "Screw the left and right leg frames to the desktop with eight bolts CD-02, using the 5 mm hex key.",
    "CD-4 3": "Fit the corner leg CD-10 under the joint. Turn its foot until the desktop is level.",
    "BB-1 3": "Lift the upper bed frame onto the four corner posts and lock each post with one guide pin BB-07. You need two adults for this step.",
    "BB-1 4": "Hook the ladder over the upper rail on the right side and fix its bottom with two short screws BB-09.",
    "GC-5 2": "Fix the cabinet to the wall with the wall bracket GC-11 before you put anything on the shelves.",
    "SB-2 4": "Fit the four felt pads SB-10 under the legs to protect the floor.",
    "SB-2 5": "The bench holds two adults sitting. Wipe it with a damp cloth only."
  };
  const PRODUCT = { "WR-2": "Two-door wardrobe", "CD-4": "Corner desk", "BB-1": "Bunk bed", "GC-5": "Glass-door cabinet", "SB-2": "Shoe bench" };

  // The listing is tally() from docs/ai-path/runs/s5b-error-analysis/tally.py, line for line (line 0 = def).
  const CODE = [
    "def tally(tagged):",
    "    counts = {}",
    "    for convo_id, tag in tagged:",
    "        counts[tag] = counts.get(tag, 0) + 1",
    "    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)",
    "    return ranked"
  ];
  // Trace rows from tally.out.txt: [line about to run, event (l line, r return), convo_id, tag, counts, ranked]
  const TRACE = [[1,"l",null,null,null,null],[2,"l",null,null,{},null],[3,"l","q22","refused",{},null],[2,"l","q22","refused",{"refused":1},null],[3,"l","q62","wrong retrieval",{"refused":1},null],[2,"l","q62","wrong retrieval",{"refused":1,"wrong retrieval":1},null],[3,"l","p03","tool error",{"refused":1,"wrong retrieval":1},null],[2,"l","p03","tool error",{"refused":1,"wrong retrieval":1,"tool error":1},null],[3,"l","q40","wrong retrieval",{"refused":1,"wrong retrieval":1,"tool error":1},null],[2,"l","q40","wrong retrieval",{"refused":1,"wrong retrieval":2,"tool error":1},null],[3,"l","q03","wrong retrieval",{"refused":1,"wrong retrieval":2,"tool error":1},null],[2,"l","q03","wrong retrieval",{"refused":1,"wrong retrieval":3,"tool error":1},null],[3,"l","q46","refused",{"refused":1,"wrong retrieval":3,"tool error":1},null],[2,"l","q46","refused",{"refused":2,"wrong retrieval":3,"tool error":1},null],[3,"l","q23","tool error",{"refused":2,"wrong retrieval":3,"tool error":1},null],[2,"l","q23","tool error",{"refused":2,"wrong retrieval":3,"tool error":2},null],[3,"l","q34","wrong retrieval",{"refused":2,"wrong retrieval":3,"tool error":2},null],[2,"l","q34","wrong retrieval",{"refused":2,"wrong retrieval":4,"tool error":2},null],[4,"l","q34","wrong retrieval",{"refused":2,"wrong retrieval":4,"tool error":2},null],[5,"l","q34","wrong retrieval",{"refused":2,"wrong retrieval":4,"tool error":2},[["wrong retrieval",4],["refused",2],["tool error",2]]],[5,"r","q34","wrong retrieval",{"refused":2,"wrong retrieval":4,"tool error":2},[["wrong retrieval",4],["refused",2],["tool error",2]]]];

  /* ---------- Derived from the data ---------- */
  const tagOf = (list, id) => (list.find(r => r[0] === id) || [])[1] || null;
  const countTags = list => Object.fromEntries(TAGS.map(t => [t.key, list.filter(r => r[1] === t.key).length]));
  const B = countTags(BEFORE_FAIL), A = countTags(AFTER_FAIL);
  const NB = BEFORE_FAIL.length, NA = AFTER_FAIL.length;
  const RANKED_B = TAGS.map(t => t.key).sort((x, y) => B[y] - B[x]);
  const BIGGEST = RANKED_B[0];
  const TOOL_DASH = BEFORE_FAIL.filter(([id, t]) => t === "tool error" && isPartQuestion(id)).length; // part orders the tool rejected
  const TOOL_UNASKED = B["tool error"] - TOOL_DASH; // tool calls on plain assembly questions
  const RETR_IDS = BEFORE_FAIL.filter(r => r[1] === "wrong retrieval").map(r => r[0]);
  const RETR_FIXED = RETR_IDS.filter(id => !tagOf(AFTER_FAIL, id)).length;
  const REF_IDS = BEFORE_FAIL.filter(r => r[1] === "refused").map(r => r[0]);
  const REF_FIXED = REF_IDS.filter(id => !tagOf(AFTER_FAIL, id)).length;
  const REF_STILL = REF_IDS.filter(id => tagOf(AFTER_FAIL, id) === "refused").length;
  const REF_MOVED = REF_IDS.length - REF_FIXED - REF_STILL;
  const NEW_FAILS = AFTER_FAIL.filter(([id]) => !tagOf(BEFORE_FAIL, id)).map(r => r[0]);
  const YOURS = ["q22", "q62", "p03", "q40", "q03", "q46", "q23", "q34"]; // tally.py YOURS, in this order
  const nth = id => YOURS.indexOf(id) + 1; // the conversation's number on the tagging screen
  const andList = a => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const YOURS_RETR = YOURS.filter(id => tagOf(BEFORE_FAIL, id) === "wrong retrieval").map(nth);
  // Of your eight: wrong retrieval, and the reply is a statement (not the refusal, not only an id).
  const YOURS_STATED = YOURS.filter(id => tagOf(BEFORE_FAIL, id) === "wrong retrieval" && CONV[id].answer !== REFUSAL && !/^\[[^\]]*\]$/.test(CONV[id].answer)).map(nth);

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-log { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 8.5em 1fr; gap: 4px 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-who { font: 600 12.5px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-txt { min-width: 0; font-size: 16px; line-height: 1.5; }
      .lx-${ID}-mono { font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-id { font: 700 13px var(--mono); margin-right: 6px; }
      .lx-${ID}-row.lx-${ID}-ref { background: var(--sunk); padding-left: 10px; padding-right: 10px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-steps { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-steps li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-steps b { font-family: var(--mono); font-size: 13.5px; text-transform: uppercase; letter-spacing: .04em; margin-right: 6px; }
      .lx-${ID}-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; }
      .lx-${ID}-pair h3 { margin: 16px 0 0; font-size: 15px; }
      .lx-${ID}-after { margin-top: 14px; }
      @media (max-width: 720px) { .lx-${ID}-pair { grid-template-columns: 1fr; } }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  function convo(kit, c, { ref = true } = {}) {
    const rows = [["customer", kit.esc(c.q)]];
    c.chunks.forEach(([cid, t], i) => rows.push([i === 0 ? "search found" : "", `<div class="lx-${ID}-mono"><span class="lx-${ID}-id">[${kit.esc(cid)}]</span>${kit.esc(t)}</div>`]));
    c.tool.forEach(([n, args, res]) => { rows.push(["model asks", mono(kit, `${n} ${args}`)]); rows.push(["tool result", mono(kit, res)]); });
    rows.push(["bot answers", mono(kit, c.answer)]);
    if (ref && c.step) rows.push([`manual, step ${c.step[1]}`, `${kit.esc(PRODUCT[c.step[0]])} ${kit.esc(c.step[0])}: ${kit.esc(MANUAL[c.step.join(" ")])}`, true]);
    return `<div class="lx-${ID}-log">${rows.map(([who, html, isRef]) =>
      `<div class="lx-${ID}-row${isRef ? ` lx-${ID}-ref` : ""}"><div class="lx-${ID}-who">${kit.esc(who)}</div><div class="lx-${ID}-txt">${html}</div></div>`).join("")}</div>
      <p class="lx-${ID}-cap">${CAPTION}. The search's pieces${c.tool.length ? " and the tool result" : ""} come from our code${ref && c.step ? "; the manual step is shown for you, the bot never saw it" : ""}.</p>`;
  }
  const pipeline = kit => `<ul class="lx-${ID}-steps">
      <li><b>1 search</b>Finds the two manual pieces (<i>chunks</i>) whose words best match the question. A code step called the <i>chunker</i> cut each manual into pieces of a fixed size, so a piece can start or end in the middle of a sentence. Each piece has an id like <code>BB-1#c2</code>.</li>
      <li><b>2 tool</b>If a part is missing or broken, the model may call <code>order_spare_part</code>, a function in the shop's code.</li>
      <li><b>3 writing</b>The model answers from the two pieces. Its rules: at most four numbered steps; cite the piece ids in square brackets; answer only if the pieces are about the exact product the customer names, otherwise reply exactly “${kit.esc(REFUSAL)}”</li>
    </ul>`;
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }
  const meterOf = (kit, counts, max) => kit.meter(TAGS.map(t => ({ label: kit.esc(t.label), value: counts[t.key], max })));

  /* 1. The situation, and the first diagnosis. */
  function whereBroke({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const c = CONV.q53;
    const opts = ["1 search: the pieces it found do not hold the answer", "2 tool: a tool call went wrong", "3 writing: the model refused an easy question"];
    const RIGHT = 0;
    const fb = [
      ["Right. Both pieces come from the bunk bed manual. The wardrobe step about the rail holders never reached the model. Given what it saw, refusing is exactly what its rule asks for. A month of fine-tuning the model would not change this conversation at all.", true],
      ["No tool was called here. The conversation has no “model asks” line, only the search and the answer.", false],
      [`The refusal is the symptom. Read the two pieces it was given: slats, corner posts, a ladder, all from the bunk bed (<code>BB-1</code>). Nothing about a wardrobe rail. With these pieces, “${kit.esc(REFUSAL)}” is what the rules tell it to say.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>“The answers are bad”</h1>
        <p class="lead">A furniture shop runs a chat bot that helps customers put together what they bought. Customers complain. The team's plan: spend a month <b>fine-tuning</b> the model (training it further on example answers), because “the answers are bad”. Before anyone trains anything, you read what actually went wrong. This is <b>error analysis</b>: read the failures, find where each one broke, and let that choose the fix.</p>
        <p class="lead">(The shop, its manuals and its test questions are made up for this lesson. The bot and every answer you will read are real.) The bot works in three steps:</p>
        ${pipeline(kit)}
        <p class="lead">One failing conversation, with what each step produced:</p>
        ${convo(kit, c)}
        <p class="task">Which step broke first in this conversation?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Tag eight failing conversations by hand. */
  const NO_TOOL = "No tool was called in this conversation, so the tool step cannot be where it broke.";
  const FB = {
    q22: {
      right: "The first piece says “…using the 5 mm hex key” for the leg frames. The answer was in front of the model, and it refused anyway. Why? That piece starts mid-sentence and never names the corner desk. The rule says to answer only about the exact product named.",
      "wrong retrieval": "Read <code>CD-4#c2</code>: “…leg frames to the desktop with eight bolts CD-02, using the 5 mm hex key.” The search found the right piece.",
      "wrong answer": "There is no answer to be wrong: the bot refused.",
      "bad format": "The refusal is the exact sentence the rules ask for. The problem is that it refused at all."
    },
    q62: {
      right: "Neither piece mentions the ladder. Step 4 (“Hook the ladder over the upper rail on the right side…”) is in a piece the search did not return. With what it was given, the model was right to refuse.",
      refused: "It did refuse, but was refusing the mistake? Neither piece says anything about the ladder. With these pieces, refusing is what the rules ask.",
      "wrong answer": "It gave no answer, so nothing it said is wrong. Look one step earlier: did the pieces contain the ladder step?",
      "bad format": "The refusal is the exact sentence the rules ask for. The customer still got no answer: look at what the model was given."
    },
    p03: {
      right: "The model did the right thing: it called <code>order_spare_part</code> with the code from the manual, CD-10. Our tool answered “unknown part code CD-10”. The part exists; the tool could not find it. That is a bug in the shop's code, not in the model.",
      "wrong retrieval": "A missing part needs the tool, not the manual. And <code>CD-4#c2</code> even mentions CD-10.",
      refused: "It refused only after the tool failed. Tag the first step that broke: the tool's error came before the refusal.",
      "wrong answer": "The reply came after the tool's error. Tag the first step that broke.",
      "bad format": "The format is not the problem: the customer got no part, because the tool call failed."
    },
    q40: {
      right: "The piece <code>GC-5#c1</code> stops mid-sentence: “…with the wall bracket GC-11 before”. The rest, “before you put anything on the shelves”, is in the next piece, which the search did not return. The model filled the gap with a guess. Fix the search and there is no gap to fill.",
      "wrong answer": "The answer is wrong, yes. But look at what the model was given: its piece ends at “before”. The end of the sentence never reached it, so the first broken step is earlier.",
      refused: "It did not refuse; it answered.",
      "bad format": "The answer has a source id in brackets and is one sentence. The format is fine; the content is not."
    },
    q03: {
      right: "Two problems here: the answer names the wrong part (BB-11 holds the safety rail), and the search missed the guide-pin piece. You tag the first one, the search, because fixing it may fix the answer too. One tag per conversation also means the counts add up to the number of failures.",
      "wrong answer": "The answer is wrong, but the guide pin BB-07 is in neither piece. The model could not have named it. Tag the first step that went wrong.",
      refused: "It did not refuse; it answered, wrongly.",
      "bad format": "The answer cites a piece and is one sentence. The format is fine."
    },
    q46: {
      right: "<code>WR-2#c1</code> starts with “Two-door wardrobe WR-2” and holds the plinth step: four screws WR-04. Right product, right step, and the bot still refused. The trace shows <b>where</b> it broke; it cannot show what the model was thinking. The tag records the step.",
      "wrong retrieval": "The first piece names the wardrobe and holds the plinth step. The search did its job.",
      "wrong answer": "There is no answer to be wrong: the bot refused.",
      "bad format": "The refusal is the exact sentence the rules ask for. The problem is that it refused when the answer was right there."
    },
    q23: {
      right: "The customer asked how to level the desk. Nothing is missing or broken, but the model ordered a corner leg, and our tool failed as well. The first wrong move is at the tool step: a call that should not have happened. <code>CD-4#c2</code> already said “Turn its foot until the desktop is level.”",
      "wrong retrieval": "<code>CD-4#c2</code> holds the answer: “Turn its foot until the desktop is level.” The search was fine.",
      refused: "The refusal came last. Before it, the model called a tool it did not need.",
      "wrong answer": "Before any answer, the model called a tool it should not have. That is the first step that went wrong.",
      "bad format": "The format is the least of it: before the reply, the model ordered a part nobody asked for."
    },
    q34: {
      right: "The felt-pad step was cut in two: <code>SB-2#c3</code> starts at “protect the floor.”, the end of that sentence. The part naming the felt pads SB-10 is in a piece the search did not return. The model got the tail of the right step and gave back only an id.",
      "bad format": "An answer that is only an id does look like a format problem. But the piece it cites starts at “protect the floor.”, after the words that name the felt pads. The model never saw the answer.",
      "wrong answer": "The reply is useless, but look at the pieces first: the felt pads are named in neither. Tag the first step that broke.",
      refused: "It did not refuse; it returned an id."
    }
  };
  const fbFor = (id, key, right) => {
    if (key === right) return [FB[id].right, true];
    if (key === "tool error" && !CONV[id].tool.length) return [NO_TOOL, false];
    return [FB[id][key] || "That step did not break here. Read the pieces, then any tool line, then the answer, in that order.", false];
  };
  function tagEight({ el, done, kit }) {
    ensureStyle();
    let k = 0, picked = null;
    const tagged = [];
    const paint = () => {
      const fin = k >= YOURS.length;
      const id = fin ? null : YOURS[k];
      const right = fin ? null : TAGS.findIndex(t => t.key === tagOf(BEFORE_FAIL, id));
      el.innerHTML = `<h1>Tag the failures</h1>
        <p class="lead">The team pulled the failing conversations from one test run. The five tags, in the order the steps run:</p>
        <ul class="lx-${ID}-steps">${TAGS.map(t => `<li><b>${kit.esc(t.step)}</b>${kit.esc(t.label)}: ${kit.esc(t.say)}.</li>`).join("")}</ul>
        ${fin ? "" : `<p class="task">Give conversation ${k + 1} of ${YOURS.length} one tag: the <b>first</b> step that went wrong.</p>
        ${convo(kit, CONV[id])}
        <div class="lpanel">${kit.options(TAGS.map(t => kit.esc(t.label)), { picked, correct: right })}${picked == null ? "" : kit.feedback(...fbFor(id, TAGS[picked].key, TAGS[right].key))}</div>`}
        ${fin ? `${kit.table(tagged.map((t, i) => [String(i + 1), TAG[t].label]), { head: ["conversation", "your tag"], title: "Your eight tags" })}
          ${kit.feedback(`All ${YOURS.length} tagged. Notice what the tags say about the team's plan: not one of your eight is “right sources, wrong answer”. In conversations ${andList(YOURS_STATED)} the bot stated something wrong, and each time the search had already failed.`, true)}` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        picked = +b.dataset.i;
        if (picked === right) { tagged.push(TAGS[right].key); k++; picked = null; paint(); if (k >= YOURS.length) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 3. The hunch against the count. */
  function hunch({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Right sources, wrong answer, and bad format", "Wrong retrieval and tool error", "Refused when it should answer, and tool error"];
    const RIGHT = 0;
    const maxB = Math.max(...Object.values(B));
    const fb = [
      [`Right: if the model writes badly, the failures pile up where the model writes from good pieces. Now the real count of all ${NB}:${meterOf(kit, B, maxB)}<p class="lx-${ID}-after">The hunch's two tags: right sources, wrong answer has ${B["wrong answer"]}; bad format has ${B["bad format"]}. The biggest tag is ${TAG[BIGGEST].label.toLowerCase()} (${B[BIGGEST]} of ${NB}), a failure in the step before the model writes. “The answers are bad” was true for the customer and wrong about the cause.</p>`, true],
      ["Those are the two steps that run <b>before</b> the model writes: the search is plain code, and a tool error comes from the shop's tool. If the model wrote badly, these would not grow.", false],
      ["Refusals are the model's doing, but a tool error mostly comes from the shop's tool code, not from how the model writes. A model that writes bad answers from good pieces shows up first in the tags about the answer itself: its content and its format.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The hunch against the count</h1>
        <p class="lead">The bot answered ${N_CONVOS} test questions, and ${NB} answers failed. You tagged eight; the team tagged the other ${NB - YOURS.length} the same way. (A script tagged them first. Reading each conversation then changed ${OVERRIDES_BEFORE} of the script's tags. One of those was a right answer that the script had marked as failed.)</p>
        <p class="task">The team's hunch is “the model writes bad answers”. If the hunch were right, which tags would be the biggest?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. The tally in Python: a stepped replay of the traced run on your eight. */
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE.length; k++) {
      const prev = TRACE[k - 1], v = TRACE[k];
      if (v[1] === "r") { fr.push({ ln: 5, id: v[2], tag: v[3], counts: v[4], ranked: v[5], end: true }); continue; }
      if (prev[1] === "l" && (prev[0] === 1 || prev[0] === 3 || prev[0] === 4)) fr.push({ ln: prev[0], id: v[2], tag: v[3], counts: v[4], ranked: v[5] });
    }
    return fr;
  })();
  const countsTxt = c => !c ? "–" : Object.keys(c).length ? Object.entries(c).map(([t, n]) => `${t}: ${n}`).join(", ") : "{}";
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const say = f => {
      if (f.end) return `<code>return ranked</code>. Your eight in one line: ${f.ranked.map(([t, n]) => `${kit.esc(t)} ${n}`).join(", ")}. The same function on all ${NB} failures gives ${RANKED_B.filter(t => B[t]).map(t => `${kit.esc(t)} ${B[t]}`).join(", ")}.`;
      if (f.ln === 1) return "<code>counts</code> starts empty. It will map each tag to how many conversations carry it, like a JS object used as a counter.";
      if (f.ln === 4) return "<code>counts.items()</code> gives (tag, count) pairs. <code>key=lambda kv: kv[1]</code> sorts them by the count, like <code>kv =&gt; kv[1]</code> in JS. <code>reverse=True</code> puts the biggest count first. Equal counts keep the order the tags first appeared.";
      return `Conversation <code>${kit.esc(f.id)}</code> is tagged <b>${kit.esc(f.tag)}</b>. <code>counts.get(tag, 0)</code> gives the count so far (0 for a new tag), plus one.`;
    };
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The tally, written in Python</h1>
        <p class="lead">Counting is the easy part, once every conversation has one tag. Here is the whole tally, run on your eight tags in the order you gave them. <code>tagged</code> is a list of pairs: (conversation id, tag).</p>
        <p class="task">Step through to the end. The marked line is the one that just ran.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>convo_id <b>${kit.esc(f.id || "–")}</b></span><span>counts <b>${kit.esc(countsTxt(f.counts))}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(say(f), f.end ? true : undefined)}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 5. Spot the idea: the count picks the fix. */
  function pickFix({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const maxB = Math.max(...Object.values(B));
    const opts = [
      "Fine-tune the model on good answers for a month",
      `Fix the chunker: one piece per manual step, each starting with the product name and code`,
      "Fix the tool: remove the dash from the part code before the lookup",
      "Delete the rule that makes the bot refuse unless the product is named"
    ];
    const RIGHT = 1;
    const fb = [
      [`Fine-tuning trains the model on example inputs with the outputs you want. It can teach a model to keep a format. It cannot change which pieces the search hands over (${B["wrong retrieval"]} failures) or what the shop's tool code returns. At most the ${B.refused} refusals and the ${TOOL_UNASKED} unneeded tool calls are about how the model behaves: ${B.refused + TOOL_UNASKED} of ${NB}, after a month, if it works.`, false],
      [`Right. Wrong retrieval is the biggest tag: ${B["wrong retrieval"]} of ${NB}. You saw why in conversations ${andList(YOURS_RETR)}: steps cut in half between two pieces, and pieces that hold the wrong steps. This is a small change in the shop's code, not a month of training. That is the whole method: <b>read, tag, count, and fix the biggest count first</b>. The count says where the most failures sit; only a rerun says how many the fix really removes.`, true],
      [`Tool error has ${B["tool error"]}, but read them: ${TOOL_DASH} are part orders the tool rejected because the warehouse stores codes without the dash (CD10, not CD-10). The other ${TOOL_UNASKED} are the model calling a tool on an assembly question, like conversation ${nth("q23")}. Removing the dash fixes at most ${TOOL_DASH}. A tag can hide two causes; reading tells them apart.`, false],
      [`Refused has ${B.refused} of ${NB}. And the rule exists for a reason: without it, the bot could answer a wardrobe question from bunk bed pieces, like the ones it got on the first screen.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Which fix first?</h1>
        <p class="lead">The count of all ${NB} failures:</p>
        ${meterOf(kit, B, maxB)}
        <p class="task">The team has time for one change this month. Which one removes the most failures?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Fix, rerun, count again: predict three results of the real rerun. */
  function rerun({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const R = RETR_IDS.length, F = REF_IDS.length;
    const retrRight = RETR_FIXED === R ? 0 : RETR_FIXED >= R * 0.75 ? 1 : RETR_FIXED >= R * 0.25 ? 2 : 3;
    const refRight = REF_FIXED > F / 2 ? 1 : REF_STILL === F ? 0 : 2;
    const Q = [
      { task: `Of the ${R} wrong-retrieval failures, how many pass after the fix?`,
        opts: [`All ${R}`, "Most of them, but not all", "About half", "None: the model is the problem"], right: retrRight,
        fb: [`Not all. A chunker cannot fix a question whose key word is not in the step: in “How much weight can the corner desk take?” only “corner” and “desk” match, and the step says “The desk holds at most 50 kg”, not “weight”. Every corner desk piece matches equally well, so the search keeps the first two.`,
             null,
             "More than that: many of the misses were steps cut in half, and every step is whole now.",
             "The model was not changed, and most of these now pass. The pieces were the problem."],
        say: `Wrong retrieval: ${RETR_FIXED} of ${R} pass now.` },
      { task: `The rule about naming the product was <b>not</b> changed. What happens to the ${F} refusals?`,
        opts: [`They stay at ${F}: the rule did not change`, "Most of them pass now", "They grow"], right: refRight,
        fb: ["The rule did not change, but what it checks did. Every piece now starts with the product name, which is exactly what the rule asks the model to look for.",
             null,
             "They shrink. Every piece now names its product, so the rule is satisfied more often, not less."],
        say: `Refused: ${REF_FIXED} of ${F} pass now; ${REF_STILL} still refuses and ${REF_MOVED} now fail at the tool step instead. Most refusals had the same cause as the search misses: pieces that did not name the product. One fix cleared most of both tags.` },
      { task: `Did any conversation that <b>passed</b> before fail now?`,
        opts: ["No: a fix only removes failures", `Yes, a few`], right: NEW_FAILS.length ? 1 : 0,
        fb: ["It can add failures too. Something that passed before may have passed by luck, and a change to the search changes every question's pieces.", null],
        say: `New failures: ${plural(NEW_FAILS.length, "conversation")} that passed before fail now. One of them, before and after:` }
    ];
    const paint = () => {
      const fin = k >= Q.length;
      const q = fin ? null : Q[k];
      const said = Q.slice(0, k).map(x => `<li>${x.say}</li>`).join("");
      el.innerHTML = `<h1>Fix, rerun, count again</h1>
        <p class="lead">The team made that one change, kept everything else (the model, the prompt, the buggy tool), and reran all ${N_CONVOS} questions. Predict, then see the real rerun.</p>
        ${said ? `<ul class="lx-${ID}-steps">${said}</ul>` : ""}
        ${fin ? "" : `<p class="task">${q.task}</p>
          <div class="lpanel">${kit.options(q.opts, { picked: wrong, correct: q.right })}${wrong != null ? kit.feedback(q.fb[wrong], false) : ""}</div>`}
        ${fin ? `<div class="lx-${ID}-pair"><div><h3>Before the fix: passed</h3>${convo(kit, CONV.q36, { ref: false })}</div><div><h3>After the fix: failed</h3>${convo(kit, CONV_AFTER_Q36, { ref: false })}</div></div>
          <p class="lead lx-${ID}-after">The manual says “Wipe”, not “clean”, so in the shoe bench manual only “shoe” and “bench” can match. Before, the cleaning step happened to share a piece with the word “bench”, and that piece came second. Now every shoe bench piece starts with “Shoe bench”, so they all match equally well, and the search keeps the first two. It passed by luck before.</p>
          ${kit.meter([{ label: "failing before", value: NB, max: NB }, { label: "failing after", value: NA, max: NB, good: true }])}
          ${kit.feedback(`From ${NB} failures to ${NA}. The new count: ${TAGS.filter(t => A[t.key]).sort((x, y) => A[y.key] - A[x.key]).map(t => `${t.label.toLowerCase()} ${A[t.key]}`).join(", ")}. Now the tool is the biggest, so it is next. Every fix changes the count, which is why you rerun and count again after each one.`, true)}` : ""}`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== Q[k].right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= Q.length) done();
      });
    };
    paint();
  }

  /* 7. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Paying for model calls to tag them", "A person's hours reading them", "Storage for the traces"];
    const RIGHT = 1;
    const fb = [
      ["You can have a model tag them, as an LLM judge, but only after your own reading has fixed what each tag means, and you have checked its tags against yours on a sample. The reading comes first either way.", false],
      ["Right. Reading is slow and needs someone who knows the product. Read a random sample instead of all of them, and refresh the sample as the bot changes. Then count the sample. If you later hand the tagging to an LLM judge, check it against your own tags first.", true],
      ["Traces are text and the previous lessons already store them. The scarce thing is someone's time to read them.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to count failures</h1>
        <p class="lead"><b>For:</b> any LLM app that can fail in more than one place: RAG, agents, tools. <b>Reach for it</b> before an expensive fix (fine-tuning, a bigger model, a rewrite), and again after every fix, because the biggest count moves.</p>
        <p class="lead"><b>Not</b> when you have only a handful of failures: read them, but a count of five ranks nothing. Not for one dangerous failure: fix it now, whatever its count. Not before anything is recorded: collect traces or a golden set first.</p>
        <p class="lead"><b>Costs:</b> a person's time to read and tag; traces you must keep; tags that mean different things when different people tag; and counts that go stale with each fix.</p>
        <p class="task">Next month the bot has 2,000 failing conversations. Which cost bites first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations, including two where counting first is the wrong move. */
  const CASES = [
    ["A ticket router sends support emails to the wrong team. Last month 300 were misrouted. Half the team wants a bigger model; the other half wants better team descriptions in the prompt.", true,
      "Yes. Read a sample of the 300, tag where each went wrong (unclear email, overlapping team descriptions, a team missing from the list), count, and let the biggest count settle the argument.",
      "There are plenty of failures and two competing fixes. That is the moment to read and count: the tally shows which fix covers more of the 300, instead of whoever argues louder."],
    ["Once in 5,000 chats, a recipe bot told a user that a cake is nut-free. The recipe it cited lists ground almonds.", false,
      "No. A count ranks how often a failure happens, not how much harm it does. This one is dangerous: fix it now and add it to the golden set as a test, whatever its count.",
      "Waiting for this tag's count to grow means waiting for more people with nut allergies to eat that cake. Frequency is the wrong measure for a safety failure. Fix it now, and keep the case as a test so it never comes back."],
    ["A research agent plans searches, reads pages and writes a report. The reports are weak, and nobody knows which step to improve.", true,
      "Yes. Read the traces of weak reports step by step, note which step first fell short, and count by step. The step with the most marks is where to start.",
      "This is the same shape as the shop's bot: several steps, one bad output. Without a count by step, the team guesses which step to improve."],
    ["The team tried a prototype in five test chats. Two went wrong, in two different ways.", false,
      "No. Read both, and fix what is obvious. But a count of two ranks nothing: one more chat could flip the order. Collect more real conversations, or build a golden set, before you count.",
      "Five chats cannot tell you which failure is most common. Error analysis needs enough failures for the counts to mean something. Read these, then gather more before ranking fixes by count."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Count first, or not?</h1>
        <p class="lead">Four situations from other teams. Counting first means: read the failures, tag each, count, and fix the biggest count.</p>
        <p class="task">Is reading and counting the failures the right first move? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>Read, tag, count, fix the biggest</h1>
      <p class="lead">You read failing conversations step by step, gave each one tag for the first step that broke, counted ${NB} of them with a ${CODE.length}-line function, and saw the count overturn the team's hunch: the biggest tag was wrong retrieval, a search problem, and fine-tuning could have touched at most ${B.refused + TOOL_UNASKED} of ${NB}. One small fix took the failures from ${NB} to ${NA}, cleared most of a second tag that shared its cause, and broke ${plural(NEW_FAILS.length, "conversation")} that had passed before.</p>
      <p class="lead">This lesson was the practice. Use it on the next thing that “gives bad answers”: ask for twenty failing traces before you ask for a bigger model.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. When a run fails there, read the trace and find the first step that broke, as you did here.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Error analysis: read the failures, count them, fix the biggest",
    checked: "2026-11-17",
    sources: [
      "https://www.deeplearning.ai/the-batch/improve-agentic-performance-with-evals-and-error-analysis-part-1",
      "https://www.deeplearning.ai/the-batch/improve-agentic-performance-with-evals-and-error-analysis-part-2",
      "https://www.deeplearning.ai/resources/ai-engineering-skills",
      "https://developers.openai.com/api/docs/guides/model-optimization"
    ],
    interview: [
      {
        q: "Your team says the support bot's answers are bad and wants to fine-tune it. What do you do before agreeing?",
        good: [
          "Pull a sample of failing conversations with their traces: the retrieved chunks, any tool calls, the answer",
          "Tag each with the first pipeline step that broke: retrieval, tool, refusal, wrong content, format",
          "Count the tags; fine-tuning can only help the failures that are about how the model writes",
          "Fix the biggest bucket first, often retrieval or a tool bug, then rerun and count again",
          "Keep the tagged failures as test cases so the fix is measured, not guessed"
        ],
        weak: "Agree to fine-tune, or switch to a bigger model, because the answers look bad. That never checks whether the model even saw the right document."
      },
      {
        q: "You fixed the biggest failure category and the total failures dropped, but some questions that used to pass now fail. How do you explain that, and what do you do?",
        good: [
          "A change to retrieval changes the context for every question, not just the failing ones",
          "Some old passes were luck: the right chunk came back for a reason that the fix removed",
          "Rerun the whole test set after each fix, not only the failures, and compare pass by pass",
          "Read the new failures and tag them; they start the next round of counting"
        ],
        weak: "Say the model is non-deterministic and rerun until it passes, without looking at what the new failures have in common."
      }
    ],
    screens: [whereBroke, tagEight, hunch, asCode, pickFix, rerun, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(YOURS.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
