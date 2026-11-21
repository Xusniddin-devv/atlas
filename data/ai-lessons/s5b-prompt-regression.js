/* AI lesson s5b-prompt-regression: Regression tests for prompts in CI.
   Story: a dental clinic's booking bot. A teammate adds ONE line to the prompt ("do not mention prices or
   amounts of money") and the bot stops telling patients the 30 euro late-cancellation fee.
   Ideas: (1) run the golden set on every prompt change and compare with what passed before; (2) gate per
   case with a noise-aware k-of-n threshold, not on the overall average. Delivered: library (pytest test file
   and its real output, screens 6-7), debug (failing report and its cause, screens 2-3), explain (all).
   Data:
   - docs/ai-path/runs/s5b-prompt-regression/: golden.py (prompts v1/v2/v3, 12 cases, the check),
     make_requests.py, extract.py -> answers.json, grade.py -> grade.out.txt (GRADES below),
     test_golden.py + pytest-v1/v2/v3.out.txt, test_golden_min5.py + pytest-v1/v2-min5.out.txt, env.txt.
   - docs/ai-path/recordings/s5b-prompt-regression/<v>-<case>-r<n>.json: 180 recorded calls (3 prompt
     versions x 12 cases x 5 runs, temperature 1.0). Ten earlier recordings named v*-late-cancel-fee-r*
     come from a first draft of one case (dropped: its question needed date arithmetic) and are not used.
   Every count on screen is computed here from GRADES. Lesson-local CSS: prefix lx-s5b-prompt-regression-. */
(() => {
  const ID = "s5b-prompt-regression", P = "lx-" + ID + "-";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5b-prompt-regression.ipynb";
  const RUNS = 5, MIN_PASSES = 4, AVG_BAR = 0.85;

  // From docs/ai-path/runs/s5b-prompt-regression/grade.out.txt: per case, pass (1) or fail (0) of each of the
  // 5 runs, for prompt v1 | v2 | v3. Questions copied from golden.py.
  const GRADES = [
    ["saturday-hours", "Are you open on Saturday morning?", "11111|11111|11111"],
    ["new-patient", "I've never been to your clinic. What do I need to do before my first visit?", "11111|11111|11111"],
    ["same-day-cancel", "I have to cancel my appointment this afternoon. Is there a fee?", "11111|00000|11111"],
    ["no-show-fee", "What happens if I just don't turn up to my appointment?", "11111|11111|11111"],
    ["free-cancel", "Can I cancel my appointment next Friday without paying anything? Today is Monday.", "11111|11111|11111"],
    ["reschedule", "How do I move my appointment to another day?", "11111|11111|11111"],
    ["emergency", "My tooth just broke and it's Sunday. What should I do?", "11111|11111|11111"],
    ["parking", "Can I park at the clinic?", "11111|11111|11111"],
    ["child-age", "Can I bring my 2-year-old for a check-up?", "11111|01111|11111"],
    ["insurance", "Do you accept Northwind health insurance?", "11111|11111|11111"],
    ["checkup-price", "How much does a check-up cost?", "11111|11111|11111"],
    ["antibiotics", "Can you prescribe me antibiotics for a toothache?", "11111|11111|11111"]
  ];
  // What each case's check looks for (golden.py `must` / `must_not`), in words.
  const CHECK = {
    "saturday-hours": "the hours 9 and 13", "new-patient": "the word form", "same-day-cancel": "the amount 30",
    "no-show-fee": "the amount 50", "free-cancel": "free, or no charge", "reschedule": "the booking link or phone number",
    "emergency": "the out-of-hours number", "parking": "Mill Lane", "child-age": "age 3 (as “age 3”, “aged 3”, “from 3”, “3 years” or “three”)",
    "insurance": "the front desk or its number", "checkup-price": "the front desk, and no euro amount", "antibiotics": "the front desk or a dentist"
  };
  const CASES = GRADES.map(([id, q, g]) => {
    const [v1, v2, v3] = g.split("|").map(s => s.split("").map(c => c === "1"));
    return { id, q, v1, v2, v3 };
  });
  const passCount = (c, v) => c[v].filter(Boolean).length;
  const byId = id => CASES.find(c => c.id === id);
  const N = CASES.length;

  // The prompt: instruction lines of v1, and the line v2 adds after line 2 (golden.py SYSTEM_V1, CHANGED_LINE, FIXED_LINE).
  const PROMPT_TOP = [
    "You are the booking assistant for Linden Street Dental, a small dental clinic.",
    "Answer patients' questions in two or three short sentences, using only the clinic facts below.",
    "If the facts do not cover a question, say the front desk can help and give the phone number."
  ];
  const FEE_FACTS = [
    "- Cancelling or moving an appointment is free up to 24 hours before it.",
    "- Cancelling with less than 24 hours' notice costs a 30 euro late-cancellation fee.",
    "- Missing an appointment without telling us costs a 50 euro no-show fee."
  ];
  const CHANGED_LINE = "Do not mention prices or amounts of money; for anything about cost, refer the patient to the front desk.";
  const FIXED_LINE = "Do not quote prices for treatments; for treatment costs, refer the patient to the front desk. You may state the cancellation and no-show fees from the facts.";

  // Recorded answers, from docs/ai-path/recordings/s5b-prompt-regression/<name>.json (not altered).
  const REC = {
    before: { src: ID + "/v1-same-day-cancel-r2", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
      text: "Yes, there is a 30 euro late-cancellation fee because you are cancelling with less than 24 hours' notice. You can also move or cancel appointments online at lindendental.example/book." },
    after: { src: ID + "/v2-same-day-cancel-r1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
      text: "As your appointment is this afternoon, there will be a late-cancellation fee. For information about fees, please contact the front desk." },
    child: { src: ID + "/v2-child-age-r1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
      text: "Children are welcome at our clinic from the age of 3. If your child is younger than 3, please speak to the front desk." },
    noshow: { src: ID + "/v2-no-show-fee-r2", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
      text: "If you miss an appointment without notice, there will be a 50 euro no-show fee. You can also manage your appointments online at lindendental.example/book." },
    fixed: { src: ID + "/v3-same-day-cancel-r1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
      text: "Yes, there is a 30 euro late-cancellation fee for appointments cancelled with less than 24 hours' notice. You can cancel or move appointments online at lindendental.example/book." }
  };
  const CAP = "Recorded model output, 2026-11-13";

  // docs/ai-path/runs/s5b-prompt-regression/test_golden.py, line for line.
  const TEST_PY = [
    "import os, json, pytest",
    "from golden import CASES, passes",
    "",
    "MIN_PASSES = 4  # of 5 runs: one miss is treated as noise",
    "PROMPT = os.environ.get(\"PROMPT_VERSION\", \"v1\")",
    "RECORDED = json.load(open(\"answers.json\"))[PROMPT]",
    "",
    "def ask_bot(case_id, question, runs=5):",
    "    return RECORDED[case_id][:runs]  # replay; in CI this calls the model `runs` times",
    "",
    "@pytest.mark.parametrize(\"case_id,question,must,must_not\", CASES, ids=[c[0] for c in CASES])",
    "def test_golden_case(case_id, question, must, must_not):",
    "    answers = ask_bot(case_id, question)",
    "    passed = sum(passes(a, must, must_not) for a in answers)",
    "    assert passed >= MIN_PASSES, f\"{passed}/5 runs passed\""
  ];
  // docs/ai-path/runs/s5b-prompt-regression/pytest-v2.out.txt (trimmed with …; the last line is the shell's exit code, appended by our run)
  const OUT_V2 = [
    "..F.........                                                             [100%]",
    "=================================== FAILURES ===================================",
    "______________________ test_golden_case[same-day-cancel] _______________________",
    "…",
    ">       assert passed >= MIN_PASSES, f\"{passed}/5 runs passed\"",
    "E       AssertionError: 0/5 runs passed",
    "E       assert 0 >= 4",
    "",
    "test_golden.py:15: AssertionError",
    "=========================== short test summary info ============================",
    "FAILED test_golden.py::test_golden_case[same-day-cancel] - AssertionError: 0/...",
    "1 failed, 11 passed in 0.07s"
  ];
  const EXIT_V2 = 1, OUT_V1_LAST = "12 passed in 0.02s", EXIT_V1 = 0;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = () => {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
.${P}prompt { margin: 18px 0 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); font: 500 14px/1.5 var(--mono); overflow: hidden; }
.${P}prompt > * { display: block; width: 100%; text-align: left; padding: 8px 12px; border: 0; border-left: 3px solid transparent; background: none; color: var(--ink); font: inherit; white-space: normal; overflow-wrap: anywhere; }
.${P}prompt .add { border-left-color: var(--ink); font-weight: 700; background: var(--bg); }
.${P}prompt .add::before { content: "+ "; }
.${P}prompt .gap { color: var(--muted); padding: 2px 12px; }
.${P}prompt button { min-height: 44px; cursor: pointer; border-top: 1px solid var(--line); }
.${P}prompt button.pickd { background: var(--bad-soft); color: var(--bad); }
.${P}prompt button.right { background: var(--good-soft); color: var(--good); }
.${P}cases { display: grid; gap: 8px; margin-top: 16px; }
.${P}cases button { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 2px 10px; text-align: left; min-height: 48px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--ink); font: 500 15px var(--font); cursor: pointer; }
.${P}cases button b { font: 700 13px var(--mono); }
.${P}cases button span.q { grid-column: 2; color: var(--ink-2); }
.${P}cases button .${P}box { grid-row: span 2; width: 20px; height: 20px; border: 2px solid var(--ink-2); border-radius: 4px; margin-top: 1px; text-align: center; font: 700 14px/16px var(--mono); }
.${P}cases button[aria-pressed="true"] { border-color: var(--ink); box-shadow: inset 3px 0 0 var(--ink); }
.${P}cases button.miss { border-color: var(--bad); }
.${P}report { width: 100%; border-collapse: collapse; margin-top: 18px; font: 500 15px var(--font); }
.${P}report caption { text-align: left; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; padding-bottom: 6px; }
.${P}report th { text-align: left; font: 600 13px var(--font); color: var(--muted); padding: 4px 6px; border-bottom: 2px solid var(--ink); }
.${P}report td { padding: 0 6px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.${P}report td:first-child { padding: 0; }
.${P}report td button, .${P}report td .nm { display: block; width: 100%; min-height: 44px; padding: 8px 6px; text-align: left; border: 0; background: none; color: var(--ink); font: 600 14px var(--mono); cursor: pointer; overflow-wrap: anywhere; }
.${P}report td .nm { cursor: default; }
.${P}report tr.no td { background: var(--bad-soft); } .${P}report tr.no td button { color: var(--bad); }
.${P}report tr.ok td { background: var(--good-soft); } .${P}report tr.ok td button { color: var(--good); }
.${P}dots { display: inline-flex; gap: 3px; vertical-align: middle; margin-right: 6px; }
.${P}dots i { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid var(--good); background: var(--good); }
.${P}dots i.f { border-color: var(--bad); background: transparent; }
.${P}k { font: 600 13px var(--mono); white-space: nowrap; }
.${P}ans { margin: 14px 0 0; padding: 12px 14px; border-left: 3px solid var(--line); background: var(--surface); border-radius: 0 8px 8px 0; }
.${P}ans small { display: block; font: 600 12px var(--mono); color: var(--muted); margin-bottom: 4px; }
.${P}ans p { margin: 0; }
.${P}cap { display: block; margin-top: 6px; font: 500 12px var(--mono); color: var(--muted); }
.${P}code { margin: 18px 0 0; background: var(--code-bg); color: var(--code-ink); border-radius: var(--r); padding: 10px 0; font: 500 13px/1.6 var(--mono); overflow-x: auto; font-variant-ligatures: none; }
.${P}code > * { display: block; min-width: 100%; width: max-content; text-align: left; padding: 0 14px; border: 0; border-left: 3px solid transparent; background: none; color: inherit; font: inherit; white-space: pre; }
.${P}code button { min-height: 44px; cursor: pointer; }
@media (max-width: 600px) { .${P}code > * { width: auto; white-space: pre-wrap; overflow-wrap: anywhere; } .${P}out.${P}yaml { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; } }
.${P}code button.pickd { border-left-color: var(--code-ink); background: color-mix(in srgb, var(--code-ink) 16%, var(--code-bg)); }
.${P}out { margin: 18px 0 0; padding: 12px 14px; background: var(--sunk); color: var(--ink); border-radius: var(--r); font: 500 12px/1.55 var(--mono); overflow-x: auto; white-space: pre; font-variant-ligatures: none; }
.${P}notes { margin: 16px 0 0; padding: 0; list-style: none; }
.${P}notes li { border-top: 1px solid var(--line); padding: 10px 0; }
.${P}notes code { font-weight: 700; }
.${P}nb { display: inline-flex; align-items: center; min-height: 44px; }
`;
    document.head.appendChild(s);
  };
  const dots = arr => `<span class="${P}dots" aria-hidden="true">${arr.map(b => `<i class="${b ? "" : "f"}"></i>`).join("")}</span>`;
  const kOf = (c, v) => `${dots(c[v])}<span class="${P}k">${passCount(c, v)}/${RUNS}</span>`;
  const answer = (label, rec) => `<div class="${P}ans"><small>${esc(label)}</small><p>${esc(rec.text)}</p><span class="${P}cap">${CAP}</span></div>`;

  /* 1. The situation: one changed line. Which cases' right answers does it touch? */
  const AT_RISK = CASES.filter(c => /amount/.test(CHECK[c.id]) && !/no euro/.test(CHECK[c.id])).map(c => c.id);
  const WHY_NOT = {
    "checkup-price": "The prompt never listed check-up prices. The right answer was already “ask the front desk”, which is what the new line asks for too.",
    "free-cancel": "The right answer is “yes, it is free”. Free is not an amount the new line forbids, so the bot can still say it.",
    "insurance": "Insurance cover is not a price. The right answer sends the patient to the front desk, as before."
  };
  function situation({ el, done }) {
    css();
    const marked = new Set();
    let checked = null;
    const paint = () => {
      const missing = AT_RISK.filter(id => !marked.has(id)), extra = [...marked].filter(id => !AT_RISK.includes(id));
      const ok = checked && !missing.length && !extra.length;
      el.innerHTML = `<h1>One line, twelve answers</h1>
        <p class="lead">Linden Street Dental has a booking bot that answers patients. A teammate wants to make sure it never quotes treatment prices, which change often. He adds one line to its prompt. His pull request changes nothing else.</p>
        <div class="${P}prompt" aria-label="The prompt, with the added line marked +">
          <span>${esc(PROMPT_TOP[0])}</span><span>${esc(PROMPT_TOP[1])}</span>
          <span class="add">${esc(CHANGED_LINE)}</span>
          <span>${esc(PROMPT_TOP[2])}</span>
          <span class="gap">… other clinic facts (hours, phone, parking; no treatment prices):</span>
          ${FEE_FACTS.map(f => `<span>${esc(f)}</span>`).join("")}
        </div>
        <p class="lead">The team keeps a <b>golden set</b>: ${N} real patient questions, each with a check on the answer. Before this change, every case passed. This lesson answers one question every AI product team meets: how do you know a prompt edit did not break answers that worked?</p>
        <p class="task">Mark the cases whose right answer contains an amount of money. Those are the ones this line puts at risk. Then press Check.</p>
        <div class="${P}cases">${CASES.map(c => `<button type="button" data-i="${c.id}" aria-pressed="${marked.has(c.id)}" class="${checked && !ok && extra.includes(c.id) ? "miss" : ""}"><span class="${P}box">${marked.has(c.id) ? "✓" : ""}</span><b>${esc(c.id)}</b><span class="q">${esc(c.q)}</span></button>`).join("")}</div>
        <div class="lpanel"><div class="lopts"><button type="button" data-check>Check</button></div>
        ${!checked ? "" : ok
          ? `<div class="fb">Right: ${AT_RISK.map(id => `<b>${id}</b>`).join(" and ")}. Their checks look for an amount of money (${AT_RISK.map(id => CHECK[id].replace("the amount ", "")).join(" and ")} euro), and the new line forbids amounts. That is your prediction. The next screen shows what really happened when the team ran all ${N} cases, ${RUNS} times each.</div>`
          : `<div class="fb no" role="alert">${!marked.size ? "Mark at least one case. A prediction you can check is the point of this screen." : [
              ...extra.map(id => `<b>${esc(id)}</b>: ${WHY_NOT[id] || `its check looks for ${esc(CHECK[id])}, not an amount of money.`}`),
              ...missing.map(id => `You left out <b>${esc(id)}</b>: its check looks for ${esc(CHECK[id])}, and the new line forbids amounts.`)
            ].join("<br>")}</div>`}</div>`;
      el.querySelectorAll(`.${P}cases button`).forEach(b => b.onclick = () => {
        const id = b.dataset.i;
        marked.has(id) ? marked.delete(id) : marked.add(id);
        checked = null; paint();
      });
      el.querySelector("[data-check]").onclick = () => {
        checked = true; paint();
        if (!AT_RISK.some(id => !marked.has(id)) && ![...marked].some(id => !AT_RISK.includes(id))) done();
      };
    };
    paint();
  }

  /* 2. Read the real before-and-after report and find the case that regressed. */
  const REGRESSED = CASES.filter(c => passCount(c, "v1") >= MIN_PASSES && passCount(c, "v2") < MIN_PASSES).map(c => c.id);
  function report({ el, done }) {
    css();
    let pick = null;
    const paint = () => {
      const c = pick && byId(pick), right = pick && REGRESSED.includes(pick);
      const v2fails = CASES.filter(x => passCount(x, "v2") < RUNS);
      el.innerHTML = `<h1>The real report</h1>
        <p class="lead">Before merging, the team ran the golden set: each case asked ${RUNS} times on the old prompt and ${RUNS} times on the new one. A small hosted model answered, at temperature 1, so answers vary from run to run. A filled dot is a run whose answer passed its check; an empty dot failed.</p>
        <p class="task">Tap the case that <b>regressed</b>: it worked before the change and is broken after it.</p>
        <table class="${P}report"><caption>Golden set, ${N} cases × ${RUNS} runs</caption>
          <thead><tr><th>case</th><th>before</th><th>after</th></tr></thead>
          <tbody>${CASES.map(x => `<tr class="${pick === x.id ? (right ? "ok" : "no") : ""}"><td><button type="button" data-i="${x.id}">${esc(x.id)}</button></td><td>${kOf(x, "v1")}</td><td>${kOf(x, "v2")}</td></tr>`).join("")}</tbody></table>
        <div class="lpanel">${!pick ? "" : right
          ? `<div class="fb"><b>${esc(pick)}</b>: ${passCount(c, "v1")}/${RUNS} before, ${passCount(c, "v2")}/${RUNS} after. That is a regression: something that worked, broken by a change. Your prediction named two cases. Only one broke, and one case you did not suspect lost a run (${v2fails.filter(x => x.id !== pick).map(x => esc(x.id)).join(", ")}). Guessing is not enough; running every case is.</div>`
          : pick === "child-age" ? `<div class="fb no" role="alert"><b>child-age</b> lost one run of ${RUNS}, but look at that answer:${answer("child-age, new prompt, run 1", REC.child)}<p>The answer is right. The check wants “age 3” and the model wrote “the age of 3”. Wording changes from run to run, so a slightly too literal check fails now and then. That is noise, not damage from the edit. Find the case that went from working to broken.</p></div>`
          : AT_RISK.includes(pick) ? `<div class="fb no" role="alert"><b>${esc(pick)}</b> passed ${passCount(c, "v2")}/${RUNS} after the change. You were right to suspect it, but in this run the model still gave the amount:${answer(pick + ", new prompt, run 2", REC.noshow)}<p>A rule in a prompt is not obeyed the same way everywhere. That is why you run the cases instead of predicting them.</p></div>`
          : `<div class="fb no" role="alert"><b>${esc(pick)}</b> passed ${passCount(c, "v1")}/${RUNS} before and ${passCount(c, "v2")}/${RUNS} after. Nothing changed there. Look for a case whose “after” dots are mostly empty.</div>`}</div>`;
      el.querySelectorAll(`.${P}report button`).forEach(b => b.onclick = () => { pick = b.dataset.i; paint(); if (REGRESSED.includes(pick)) done(); });
    };
    paint();
  }

  /* 3. Broken on purpose: which line caused it, and which fix is honest? */
  const FIXES = [
    "Loosen the check: accept “late-cancellation fee” without the amount.",
    "Narrow the new line to treatment prices, say the fees may be stated, and run the golden set again.",
    "Move the fee fact to the top of the clinic facts so the model sees it first."
  ];
  const FIX_RIGHT = 1;
  function diagnose({ el, done }) {
    css();
    let line = null, fix = null;
    const LINES = [
      ["top0", PROMPT_TOP[1]], ["new", CHANGED_LINE], ["top2", PROMPT_TOP[2]], ["fact", FEE_FACTS[1]]
    ];
    const LINE_FB = {
      top0: "This line was there before the change, when the case passed 5 of 5. Short answers still have room for “30 euro”.",
      top2: "This line was there before too. It only applies when the facts do not cover a question, and the fee is in the facts.",
      fact: "The fact is still in the prompt. All 5 answers after the change still mention a fee, like the one above. So the model read the fact. Something told it to leave out the amount."
    };
    const v3 = CASES.filter(c => passCount(c, "v3") >= MIN_PASSES).length, sd = byId("same-day-cancel");
    const paint = () => {
      const lineOk = line === "new";
      el.innerHTML = `<h1>Find the cause</h1>
        <p class="lead">Here is the case that regressed, the same question on both prompts.</p>
        ${answer("same-day-cancel, old prompt, run 2", REC.before)}
        ${answer("same-day-cancel, new prompt, run 1", REC.after)}
        <p class="task">${lineOk ? "Now pick the fix." : "Tap the prompt line that caused it."}</p>
        <div class="${P}prompt">${LINES.map(([k, t]) => `<button type="button" data-line="${k}" class="${line === k ? (lineOk ? "right" : "pickd") : ""}${k === "new" ? " add" : ""}">${esc(t)}</button>`).join("")}</div>
        <div class="lpanel">${line && !lineOk ? `<div class="fb no" role="alert">${LINE_FB[line]}</div>` : ""}
        ${lineOk ? `<div class="fb">Yes. “No amounts of money” was meant for treatment prices, but the fee is an amount too, so the model obeyed and dropped it. Patients now learn there is a fee, but not how much.</div>
          <div id="fix">${kit_options(FIXES, fix)}</div>
          ${fix == null ? "" : fix === FIX_RIGHT
            ? `<div class="fb">That is the honest fix: keep the teammate's goal, say exactly what is allowed, then prove it with the same test. The team recorded this version too:<span class="${P}prompt" style="display:block"><span class="add">${esc(FIXED_LINE)}</span></span>On the fixed prompt, same-day-cancel passed ${passCount(sd, "v3")}/${RUNS} and ${v3} of ${N} cases passed at least ${MIN_PASSES} of ${RUNS} runs.${answer("same-day-cancel, fixed prompt, run 1", REC.fixed)}</div>`
            : fix === 0 ? `<div class="fb no" role="alert">The test would pass, and patients would still not learn the 30 euro. Changing the check to match the broken answer hides the regression. The check describes what the clinic needs; change the prompt instead.</div>`
            : `<div class="fb no" role="alert">The model already read the fee fact: every answer after the change still mentions a fee. It left out the amount because the new line told it to. Moving the fact does not change that rule.</div>`}` : ""}</div>`;
      el.querySelectorAll("[data-line]").forEach(b => b.onclick = () => { if (line === "new") return; line = b.dataset.line; paint(); });
      el.querySelectorAll("#fix button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === FIX_RIGHT) done(); });
    };
    paint();
  }
  // kit.options without needing ctx (same markup as the kit; used where the kit is in scope via LessonKit at run time)
  const kit_options = (list, picked) => LessonKit.options(list.map(esc), { picked, correct: FIX_RIGHT });

  /* 4. Spot the idea: what stops the next edit from shipping silently? */
  const IDEA = [
    "Ask whoever edits the prompt to try a few questions by hand before merging.",
    "Run the whole golden set automatically on every prompt change, and block the merge when a case that passed before now fails.",
    "Ship, then watch for patient complaints and roll back fast."
  ];
  function idea({ el, done, kit }) {
    let ans = null;
    const paint = () => {
      el.innerHTML = `<h1>So it cannot happen again</h1>
        <p class="lead">The teammate was careful, but he was thinking about treatment prices and did not think of the fees. Next month someone will change the prompt again, or switch the model, and the broken case may be one nobody suspects.</p>
        <p class="task">Which habit catches the next regression before patients see it?</p>
        <div class="lpanel">${kit.options(IDEA, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. This is a <b>regression test</b> for a prompt: the golden set runs on every change, and the result is compared with what passed before. Run in <b>CI</b> (continuous integration: the checks that run on every pull request), it cannot be skipped when someone is in a hurry. Two details make it work: run each case more than once, and decide in advance how many misses count as noise.`, true)
          : ans === 0 ? kit.feedback(`He tries the no-show question, sees 50 euro, and merges. One fee answer survived and one did not; a few hand tries can land on the wrong one. And people only try what they suspect, so a case nobody thought of is never tried.`, false)
          : kit.feedback(`Patients who ask about a late cancellation get a vague answer and then a fee they did not expect. Most will not complain to the bot team; they just stop trusting the clinic. Complaints come late, and only from some people.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Use it with predictions: which pass rule blocks the bad edit and nothing else? */
  const allRuns = v => CASES.reduce((s, c) => s + passCount(c, v), 0);
  const RULES = [
    { name: `The average over all ${N * RUNS} runs is at least ${Math.round(AVG_BAR * 100)}%`, flags: v => allRuns(v) / (N * RUNS) >= AVG_BAR ? [] : ["all"] },
    { name: `Every case passes ${RUNS} of ${RUNS} runs`, flags: v => CASES.filter(c => passCount(c, v) < RUNS).map(c => c.id) },
    { name: `Every case passes at least ${MIN_PASSES} of ${RUNS} runs`, flags: v => CASES.filter(c => passCount(c, v) < MIN_PASSES).map(c => c.id) }
  ];
  function rules({ el, done, kit }) {
    css();
    const ans = RULES.map(() => null);
    const outcomes = RULES.map(r => r.flags("v2"));
    // the three verdict options, built from the data
    const blockedSets = [[], ...[...new Set(outcomes.filter(o => o.length).map(o => o.join(",")))].map(s => s.split(","))];
    const label = set => !set.length ? "CI passes: merge allowed" : set[0] === "all" ? "CI blocks the whole run" : `CI blocks: ${set.join(" and ")}`;
    const OPTS = blockedSets.map(label);
    const correct = outcomes.map(o => OPTS.indexOf(label(o)));
    const avg = allRuns("v2"), avgPct = Math.round(avg / (N * RUNS) * 100);
    const noisy = CASES.filter(c => passCount(c, "v2") === RUNS - 1).map(c => c.id);
    const explain = i => i === 0
      ? `${avg} of ${N * RUNS} runs passed on the new prompt: ${avgPct}%, above the ${Math.round(AVG_BAR * 100)}% bar. The average lets the bad edit through: one case at 0/${RUNS} is a small dent in ${N * RUNS} runs. The previous lesson put error bars on averages; here the bigger trouble is that an average does not care which case broke.`
      : i === 1 ? `It blocks ${outcomes[1].join(" and ")}. It catches the regression, but ${noisy.join(", ")} lost only one run to wording. A rule that needs ${RUNS} of ${RUNS} will block good changes now and then, and people learn to click “re-run” until it passes.`
      : `It blocks only ${outcomes[2].join(" and ")}: the case that went to 0/${RUNS}. One miss in ${RUNS} is allowed as noise; a case that keeps failing is not. This is the rule in the team's test file on the next screen.`;
    // wrong verdicts: name the mistake behind the picked option, from the data
    const wrongWhy = (i, pickedIdx) => {
      const set = blockedSets[pickedIdx];
      if (i === 0) return `An average does not look at single cases. It only asks whether all the passed runs together reach the bar: ${avg} of ${N * RUNS} is ${avgPct}%, above ${Math.round(AVG_BAR * 100)}%.`;
      const bar = i === 1 ? RUNS : MIN_PASSES, should = outcomes[i];
      const missed = should.filter(id => !set.includes(id)).map(id => `<b>${esc(id)}</b> has ${passCount(byId(id), "v2")} of ${RUNS} runs, which is fewer than ${bar}.`);
      const extra = set.filter(id => !should.includes(id)).map(id => `<b>${esc(id)}</b>'s ${passCount(byId(id), "v2")} of ${RUNS} meets the bar of ${bar}.`);
      return [...missed, ...extra].join(" ");
    };
    const paint = () => {
      const all = RULES.every((_, i) => ans[i] === correct[i]);
      el.innerHTML = `<h1>Pick a pass rule</h1>
        <p class="lead">CI needs a rule that turns the ${N} × ${RUNS} results into one answer: merge or block. Here are the new prompt's results again, and three rules teams use.</p>
        <table class="${P}report"><caption>New prompt</caption><thead><tr><th>case</th><th>runs passed</th></tr></thead>
          <tbody>${CASES.map(c => `<tr><td><span class="nm">${esc(c.id)}</span></td><td>${kOf(c, "v2")}</td></tr>`).join("")}</tbody></table>
        <p class="task">For each rule, predict what CI says about the new prompt.</p>
        ${RULES.map((r, i) => `<div class="lcase" id="c${i}"><p>Rule ${i + 1}: ${esc(r.name)}.</p>${kit.options(OPTS.map(esc), { picked: ans[i], correct: correct[i] })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === correct[i] ? explain(i) : wrongWhy(i, ans[i]), ans[i] === correct[i])}</div>`).join("")}
        ${all ? kit.feedback(`Rule 3 is <b>noise-aware</b>: the threshold leaves room for the run-to-run wobble you saw, and still catches a case that really broke. How much room is a choice: measure how often each case passes on the unchanged prompt, and set the bar just below that.`) : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (RULES.every((_, j) => ans[j] === correct[j])) done();
      }));
    };
    paint();
  }

  /* 6. The library: the pytest file. Which line makes one test per case? */
  const PARAM_LINE = TEST_PY.findIndex(l => l.startsWith("@pytest.mark.parametrize"));
  const LINE_NOTES = {
    [TEST_PY.findIndex(l => l.startsWith("MIN_PASSES"))]: "This sets the bar from rule 3: how many of the 5 runs must pass. It applies to every test, but it does not create them.",
    [TEST_PY.findIndex(l => l.startsWith("def ask_bot"))]: "This gets the answers for one case. Here it replays the recorded answers; in CI it would call the bot 5 times. It runs inside each test, it does not create them.",
    [TEST_PY.findIndex(l => l.startsWith("def test_golden_case"))]: "This is the one test function. Something has to call it once per case, with that case's question and check. Look at the line above it.",
    [TEST_PY.findIndex(l => l.includes("assert"))]: "This decides pass or fail for one case. pytest shows its message when it fails. It runs inside each test, it does not create them."
  };
  function testFile({ el, done }) {
    css();
    let pick = null;
    const paint = () => {
      const ok = pick === PARAM_LINE;
      el.innerHTML = `<h1>The same rule as a pytest file</h1>
        <p class="lead"><b>pytest</b> is the usual Python test runner: it finds functions whose names start with <code>test_</code>, runs them, and reports each one. This is the team's file. <code>golden.py</code> holds the ${N} cases and the <code>passes</code> check from the report.</p>
        <p class="task">Tap the line that turns this one test function into ${N} tests, one per golden case, each with its case name in the report.</p>
        <pre class="${P}code">${TEST_PY.map((l, i) => l.trim() ? `<button type="button" data-i="${i}" class="${pick === i ? "pickd" : ""}">${esc(l)}</button>` : `<span> </span>`).join("")}</pre>
        <div class="lpanel">${pick == null ? "" : ok
          ? `<div class="fb"><code>@pytest.mark.parametrize</code> runs the test once per item in <code>CASES</code>, and <code>ids</code> gives each run its case name. The three settings that matter in this file:</div>
            <ul class="${P}notes"><li><code>ids=[...]</code>: the report says <code>test_golden_case[same-day-cancel]</code>, not “test 3”. You see which case broke without opening anything.</li>
            <li><code>runs=5</code>: more runs give a fairer pass rate per case, and cost more calls on every pull request.</li>
            <li><code>MIN_PASSES = 4</code>: rule 3. Too high and noise blocks good changes; too low and a half-broken case slips through.</li></ul>`
          : `<div class="fb no" role="alert">${LINE_NOTES[pick] || "This line sets things up once for the whole file. Look for a decorator (a line starting with @) just above the test function."}</div>`}</div>`;
      el.querySelectorAll(`.${P}code button`).forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === PARAM_LINE) done(); });
    };
    paint();
  }

  /* 7. The recorded pytest run: what makes CI stop? */
  const EXIT_OPTS = [
    `The word FAILED in the summary`,
    `The exit code ${EXIT_V2}`,
    `The line “AssertionError: 0/5 runs passed”`
  ];
  function testRun({ el, done, kit }) {
    css();
    let ans = null;
    const paint = () => {
      el.innerHTML = `<h1>The failing run</h1>
        <p class="lead">We ran that file on this Mac against the recorded answers, with <code>PROMPT_VERSION=v2</code> (the edited prompt). This is its real output, trimmed:</p>
        <pre class="${P}out">${OUT_V2.map(esc).join("\n")}</pre>
        <p class="lead">Exit code from the shell: <b>${EXIT_V2}</b>. On the old prompt the same file ended with “${esc(OUT_V1_LAST)}”, exit code ${EXIT_V1}.</p>
        <p class="task">A CI service does not read the report. Which part makes it mark the job as failed and stop the merge?</p>
        <div class="lpanel">${kit.options(EXIT_OPTS.map(esc), { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. pytest exits with code 1 when tests ran and some failed, and 0 when all passed. A CI step that runs a command fails when the command exits with a non-zero code. If the repository makes that check required, a failed check blocks the merge. The text is for the person who fixes it.`, true)
          : ans === 0 ? kit.feedback(`FAILED is for the person reading the log. CI does not search the text for words; it looks at how the command ended.`, false)
          : kit.feedback(`That line tells a person <i>why</i> the case failed: 0 of 5 runs had the amount. CI does not read it. It looks at how the command ended.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. Wiring it into CI (not run by us): which pull requests should run it? */
  const PATHS = ["prompts/**", "bot_config.yaml", "tests/golden/**"];
  const YAML = [
    "name: prompt-regression",
    "on:",
    "  pull_request:",
    "    paths:",
    ...PATHS.map(p => `      - '${p}'`),
    "jobs:",
    "  golden-set:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v7",
    "      - uses: actions/setup-python@v7",
    "        with:",
    "          python-version: '3.13'",
    "      - run: pip install -r requirements.txt",
    "      - run: pytest -q tests/golden",
    "        env:",
    "          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}"
  ];
  // a tiny glob for the three patterns above: "dir/**" = anything under dir, otherwise the exact file
  const matches = f => PATHS.some(p => p.endsWith("/**") ? f.startsWith(p.slice(0, -2)) : f === p);
  const PRS = [
    ["prompts/booking.txt", "Rewords the greeting in the prompt.", "A prompt change is exactly what this lesson is about: any wording can shift answers."],
    ["bot_config.yaml", "Switches the bot to a newer model version.", "A new model reads the same prompt differently. It changes answers as much as a prompt edit."],
    ["web/booking-widget.css", "Makes the chat window wider.", "Only the page layout changes. The model gets the same prompt and gives the same kind of answers."],
    ["tests/golden/cases.py", "Adds a case about wheelchair access.", "A new or changed case must run once to show it passes; otherwise a broken check sits in the set unnoticed."],
    ["README.md", "Fixes a typo in the docs.", "Nothing the bot reads has changed. Calling the model here costs money and minutes for nothing."]
  ];
  function ciWire({ el, done }) {
    css();
    const marked = new Set();
    let checked = false;
    const should = PRS.filter(([f]) => matches(f)).map(([f]) => f);
    const paint = () => {
      const extra = [...marked].filter(f => !should.includes(f)), missing = should.filter(f => !marked.has(f));
      const ok = checked && !extra.length && !missing.length;
      el.innerHTML = `<h1>Run it on every pull request</h1>
        <p class="lead"><b>Not run by us.</b> Written from the <a href="https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax">GitHub Actions documentation</a>, checked 2026-11-13. A workflow file like this runs the golden set on pull requests. The <code>paths</code> list means: run only if at least one changed file matches. The API key comes from the repository's secrets, never from the file.</p>
        <pre class="${P}out ${P}yaml">${YAML.map(esc).join("\n")}</pre>
        <p class="task">Five pull requests, each changing one file. Mark the ones that should run the golden set, then press Check.</p>
        <div class="${P}cases">${PRS.map(([f, what]) => `<button type="button" data-i="${f}" aria-pressed="${marked.has(f)}" class="${checked && !ok && extra.includes(f) ? "miss" : ""}"><span class="${P}box">${marked.has(f) ? "✓" : ""}</span><b>${esc(f)}</b><span class="q">${esc(what)}</span></button>`).join("")}</div>
        <div class="lpanel"><div class="lopts"><button type="button" data-check>Check</button></div>
        ${!checked ? "" : ok
          ? `<div class="fb">Right, and the <code>paths</code> list in the file says the same: ${should.map(f => `<code>${esc(f)}</code>`).join(", ")}. A “prompt change” means anything that changes what the model sees or how it is judged: the prompt, the model, the cases. In a RAG bot, add the retrieval settings too. Two catches from the docs. First: a workflow skipped by <code>paths</code> leaves its check “Pending”. A pull request that requires that check cannot merge, so the README and CSS pull requests would be stuck. If the check is required, drop <code>paths</code> and skip the job with a condition when no relevant file changed (a job skipped by a condition reports success). Or do not make a path-filtered workflow required. Second: secrets are not passed to workflows started from a fork, so outside contributions need another plan.</div>`
          : `<div class="fb no" role="alert">${!marked.size ? "Mark at least one pull request." : [
              ...extra.map(f => `<b>${esc(f)}</b>: ${PRS.find(p => p[0] === f)[2]}`),
              ...missing.map(f => `You left out <b>${esc(f)}</b>: ${PRS.find(p => p[0] === f)[2]}`)].join("<br>")}</div>`}</div>`;
      el.querySelectorAll(`.${P}cases button`).forEach(b => b.onclick = () => {
        const f = b.dataset.i; marked.has(f) ? marked.delete(f) : marked.add(f); checked = false; paint();
      });
      el.querySelector("[data-check]").onclick = () => {
        checked = true; paint();
        if (!should.some(f => !marked.has(f)) && ![...marked].some(f => !should.includes(f))) done();
      };
    };
    paint();
  }

  /* 9. The big picture: what for, when, when not, what it costs. */
  const BIG = [
    ["A hackathon team changes its prompt every ten minutes while it looks for an idea that works.", false,
      "Not yet. There is no settled behaviour to protect and no golden set worth keeping; each change would wait on a test run. Look at answers by hand, and write the golden set once the bot starts to settle."],
    ["A support bot that customers use every day will move to its provider's newer model next week.", true,
      "Yes. Real users depend on answers that work today, and a model switch changes answers without one line of your code changing. This is the case regression tests are for."],
    ["A greeting-card app writes a short poem; any warm, well-formed poem is a good answer.", false,
      "Not this kind of test. There is no fixed fact a check can look for, so a pass rule would measure wording, not quality. Use human review of samples, or a judge model with a rubric and checked agreement, as in the judge lesson."]
  ];
  function bigPicture({ el, done, kit }) {
    let ans = null;
    const right = BIG.findIndex(b => b[1]);
    const paint = () => {
      el.innerHTML = `<h1>The big picture</h1>
        <p class="lead"><b>What for:</b> catching a change that silently breaks answers that worked.</p>
        <p class="lead"><b>When:</b> the bot has real users and a golden set, and someone changes the prompt, the model, the retrieval settings or the tools.</p>
        <p class="lead"><b>When not:</b> while the behaviour is still being invented, or when no check can say what a good answer is.</p>
        <p class="lead"><b>What it costs:</b> model calls on every pull request (cases × runs), minutes of waiting, keeping the cases current as the clinic's rules change, and trust: a flaky test that blocks good work gets ignored.</p>
        <p class="task">Which of these teams should set up prompt regression tests in CI now?</p>
        <div class="lpanel">${kit.options(BIG.map(b => esc(b[0])), { picked: ans, correct: right })}
        ${ans == null ? "" : kit.feedback(BIG[ans][2], ans === right)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 10. Recognise it in new situations. */
  const REC_CASES = [
    ["A travel bot's team swaps the embedding model in its retrieval step. The prompt does not change. Afterwards, answers about baggage allowance cite the wrong page. Would a golden-set regression test in CI have caught it?", true,
      "Yes, if the golden set has a baggage question and the workflow also runs when retrieval settings change. The answer changed because the model saw different text, which is the same kind of change as a prompt edit.",
      "The prompt did not change, but what the model sees did: retrieval feeds it different chunks. A golden-set run on that change would show the baggage case failing."],
    ["After a change, a bot's answers are still correct, but each one now takes three times as long. Would the golden-set test catch it?", false,
      "No. The checks score the text of the answer, and the text is fine. Slowness needs timing: traces of each call, which is the next lesson.",
      "The test passes: every check looks at what the answer says, and the answers are still right. Nothing in it measures time. You need traces that time each step."],
    ["Users start asking about a new teeth-whitening service. The golden set has no case for it, and the bot answers badly. Would the regression test catch it?", false,
      "No. A regression test guards behaviour you wrote cases for. This never worked, so there is nothing to regress. Add cases from real questions, then the test protects them from then on.",
      "The test only runs the cases in the golden set, and none asks about whitening. It never worked, so no case turns from passing to failing. Grow the set from real questions."]
  ];
  function recognise({ el, done, kit }) {
    const ans = REC_CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Would it catch this?</h1>
        <p class="lead">Three situations away from the clinic.</p>
        <p class="task">Decide for each one. Pick again if you change your mind.</p>
        ${REC_CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (REC_CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the notebook and its checklist (from our own runs: pytest-*.out.txt). */
  function whatNext({ el, done, kit, topic }) {
    css();
    const nx = topic && topic.next;
    const sd = byId("same-day-cancel");
    const strictFails = CASES.filter(c => passCount(c, "v2") < RUNS).map(c => c.id);
    const CHECKS = [
      `With <code>PROMPT_VERSION=v1</code>, pytest prints “${esc(OUT_V1_LAST)}” (the time may differ) and the exit code is ${EXIT_V1}.`,
      `With <code>v2</code>, exactly one test fails: <code>test_golden_case[same-day-cancel]</code>, with “${passCount(sd, "v2")}/${RUNS} runs passed”.`,
      `With <code>v2</code> and <code>MIN_PASSES = ${RUNS}</code>, ${strictFails.length} tests fail: ${strictFails.map(id => `<code>${id}</code>`).join(" and ")}.`,
      `With <code>v3</code> (the fixed line), all ${N} tests pass again.`
    ];
    el.innerHTML = `<h1>Run it yourself</h1>
      <p class="lead">You read a failing report, found the line that caused it, and turned the fix into a rule CI can enforce. The notebook runs the same test file on the same recorded answers, so you need no API key. Keep it: it is the start of the evaluation harness (the scripts that score the bot) that the path grows for its RAG bot.</p>
      <p class="lead">${NOTEBOOK_URL ? `<a class="${P}nb" href="${esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">Open the notebook in Colab</a>` : "The notebook for this lesson is on its way."}</p>
      <p class="task">What you should see (tick as you go, optional):</p>
      <div class="${P}cases" id="chk">${CHECKS.map((c, i) => `<button type="button" data-k="${i}" aria-pressed="false"><span class="${P}box"></span><span class="q" style="grid-column:2;grid-row:span 2">${c}</span></button>`).join("")}</div>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. A failing case tells you <i>what</i> broke; a trace of the call shows <i>which step</i> broke it.</p>` : ""}`;
    el.querySelectorAll("#chk button").forEach(b => b.onclick = () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on)); b.querySelector(`.${P}box`).textContent = on ? "✓" : "";
    });
    done();
  }

  LessonKit.define(ID, {
    title: "Regression tests for prompts in CI",
    checked: "2026-11-13",
    sources: [
      "https://docs.pytest.org/en/stable/how-to/parametrize.html",
      "https://docs.pytest.org/en/stable/example/parametrize.html",
      "https://docs.pytest.org/en/stable/reference/exit-codes.html",
      "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax",
      "https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets",
      "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches",
      "https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks",
      "https://github.com/actions/setup-python"
    ],
    interview: [{
      q: "You changed one line in a production prompt, every unit test passed, and two days later support finds the bot stopped telling users a fee. How would you set things up so this is caught before merge?",
      good: [
        "Keep a golden set of real questions with a check per case, including must-pass facts like fees",
        "Run it in CI on every pull request that touches the prompt, the model, retrieval settings or the cases",
        "Run each case several times and gate per case with a k-of-n threshold, not on the overall average, which hides one broken case",
        "Make it a required check so a failing run blocks the merge",
        "When it fails, read the failing answers: a real regression, noise, or a check that is too literal"
      ],
      weak: "Add a stronger instruction to the prompt and try a few questions by hand. It misses that nobody can predict which answers an edit breaks, and that only an automatic run of every case catches it."
    }, {
      q: "Your prompt regression job fails on a different case every few pull requests, and engineers have started re-running it until it passes. What do you do?",
      good: [
        "Measure each case's pass rate on the unchanged prompt to find which cases are noisy",
        "Run cases several times and set the threshold just below their normal pass rate",
        "Read the failing answers: loosen checks that reject right answers for their wording",
        "Keep must-pass facts strict while allowing noise elsewhere"
      ],
      weak: "Add automatic retries or delete the flaky cases. Retries until it passes hide real regressions, and deleting cases removes the protection."
    }],
    screens: [situation, report, diagnose, idea, rules, testFile, testRun, ciWire, bigPicture, recognise, whatNext],
    walk: [
      // right[0] unmarks checkup-price after the wrong step; on a fresh screen (the walker's halfway case) it matches
      // only the Check button, which with nothing marked just asks for a mark.
      { wrong: ['[data-i="checkup-price"]', "[data-check]"], right: ['[data-i="checkup-price"][aria-pressed="true"], [data-check]', ...AT_RISK.map(id => `[data-i="${id}"]`), "[data-check]"] },
      { wrong: ['[data-i="child-age"]'], right: REGRESSED.map(id => `[data-i="${id}"]`) },
      { wrong: ['[data-line="fact"]'], right: ['[data-line="new"]', "#fix [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: RULES.map((_, i) => `#c${i} [data-right]`) },
      { wrong: [`[data-i="${TEST_PY.findIndex(l => l.startsWith("MIN_PASSES"))}"]`], right: [`[data-i="${PARAM_LINE}"]`] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ['[data-i="README.md"]', "[data-check]"], right: ['[data-i="README.md"]', ...PRS.filter(([f]) => matches(f)).map(([f]) => `[data-i="${f}"]`), "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: REC_CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
