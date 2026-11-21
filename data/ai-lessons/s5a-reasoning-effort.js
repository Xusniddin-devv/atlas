/* Lesson: reasoning models and the effort setting. Story: a clinic's booking assistant that must fit six patients
   into two doctors' free slots under seven rules, next to the same assistant answering opening-hours questions and
   other quick jobs. Ideas: (1) a reasoning model writes hidden thinking tokens before its answer; the effort
   setting gives it more or less room for them, and the extra room only pays off on tasks with many dependent steps;
   (2) in the API, effort and max_tokens work together, and the thinking tokens are billed as output.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5a-reasoning-effort/<task>-<low|high>.json for the six tasks
     date, lookup, schedule, rewrite, maths, classify (same model, max_tokens 4000, reasoning.effort low or high),
     and schedule-tight.json (the schedule puzzle at high effort with max_tokens 400). Requests written by
     docs/ai-path/runs/s5a-reasoning-effort/make_requests.py;
   - docs/ai-path/runs/s5a-reasoning-effort/record_all.sh + timings.out.txt, timings-tight.out.txt: the seconds each
     call took (recording file time minus its recordedAt) and the token usage;
   - docs/ai-path/runs/s5a-reasoning-effort/schedule_solver.py + .out.txt: the puzzle has exactly one solution;
     correct_answers.py + .out.txt: the right answer to every task, computed without a model.
   Lesson-local style: a compact results table and a monospace block (.lx-s5a-reasoning-effort-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s5a-reasoning-effort";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const fmt = n => n.toLocaleString("en");
  const x1 = (a, b) => (a / b).toFixed(1);

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s5a-reasoning-effort/make_requests.py
  const MAX_TOKENS = 4000, MAX_TIGHT = 400;
  const SYSTEM = "You are the booking assistant at Linden Street Clinic. Staff send you requests. Reply briefly. Your last line must start with ANSWER: and give only the answer.";
  const FREE = { Osei: ["09:00", "09:30", "10:00", "11:00"], Lindqvist: ["09:00", "10:30", "11:00", "11:30"] };
  const PUZZLE_RULES = [
    "Amir needs 60 minutes: two back-to-back free slots with the same doctor, and he must be finished by 10:30.",
    "Bea is 7 years old. Only Dr Lindqvist sees children.",
    "Chen must be finished by 10:00.",
    "Farah's follow-up must be with Dr Osei, and she cannot come before 10:00.",
    "Goran cannot come before 11:00.",
    "Hana and Bea are sisters: their appointments start at the same time.",
    "Amir and Chen must not see the same doctor."
  ];
  // OpenRouter's documented effort ratios (share of max_tokens given to thinking), checked 2026-11-18
  const RATIO = { low: 0.2, high: 0.8 };

  // From docs/ai-path/recordings/s5a-reasoning-effort/*.json (text not altered; out = completion_tokens,
  // think = completion_tokens_details.reasoning_tokens) and runs/s5a-reasoning-effort/timings.out.txt (sec)
  const REC = { src: "s5a-reasoning-effort/<task>-<effort>", provider: "openrouter", model: "google/gemini-2.5-flash", recordedAt: "2026-11-17" };
  const TASKS = [
    { id: "date", label: "A date question",
      ask: "Today is Wednesday 18 November 2026. Dr Osei books follow-ups 10 working days after the visit. Working days are Monday to Friday, and the clinic is closed on Thursday 26 November. A patient was seen today. On what date is the follow-up?",
      low: { text: "ANSWER: Thursday 3 December 2026", out: 389, think: 380, sec: 3.41 },
      high: { text: "ANSWER: Thursday 3 December 2026", out: 307, think: 298, sec: 2.89 } },
    { id: "lookup", label: "A lookup",
      ask: "Opening hours: Monday to Friday 08:00-18:00, Saturday 09:00-13:00, Sunday closed. A patient asks: can I walk in on Saturday at 14:30?",
      low: { text: "No, the clinic is closed then.\nANSWER: No.", out: 84, think: 73, sec: 2.39 },
      high: { text: "ANSWER: No, the clinic is closed on Saturday at 14:30.", out: 89, think: 73, sec: 1.97 } },
    { id: "schedule", label: "The schedule puzzle",
      ask: "The puzzle from the first screen: fit the patients into tomorrow's free slots under the rules.",
      low: { text: "Here is the schedule:\n\nAmir: Dr Osei 09:30; Bea: Dr Lindqvist 09:00; Chen: Dr Osei 09:00; Farah: Dr Osei 10:00; Goran: Dr Lindqvist 11:00; Hana: Dr Lindqvist 09:00\nANSWER: Amir: Dr Osei 09:30; Bea: Dr Lindqvist 09:00; Chen: Dr Osei 09:00; Farah: Dr Osei 10:00; Goran: Dr Lindqvist 11:00; Hana: Dr Lindqvist 09:00", out: 814, think: 663, sec: 4.88 },
      high: { text: "Here is tomorrow's schedule:\n\nAmir: Dr Osei 09:00; Bea: Dr Lindqvist 11:00; Chen: Dr Lindqvist 09:00; Farah: Dr Osei 10:00; Goran: Dr Lindqvist 11:30; Hana: Dr Osei 11:00\nANSWER: Amir: Dr Osei 09:00; Bea: Dr Lindqvist 11:00; Chen: Dr Lindqvist 09:00; Farah: Dr Osei 10:00; Goran: Dr Lindqvist 11:30; Hana: Dr Osei 11:00", out: 2446, think: 2297, sec: 11.14 } },
    { id: "rewrite", label: "A rewrite",
      ask: "Rewrite this text-message reminder so it sounds friendly, in 25 words or fewer. Keep the date, the time and the doctor. APPT THU 3 DEC 10:30 DR OSEI. LATE >10 MIN = REBOOK. NO REPLY.",
      low: { text: "Friendly reminder about your appointment with Dr. Osei on Thu 3 Dec at 10:30 AM. Please aim to arrive on time.\nANSWER: Friendly reminder about your appointment with Dr. Osei on Thu 3 Dec at 10:30 AM. Please aim to arrive on time.", out: 475, think: 414, sec: 3.36 },
      high: { text: "Friendly reminder: Your appointment with Dr. Osei is Thursday, December 3rd at 10:30 AM. Please arrive promptly.\nANSWER: Friendly reminder: Your appointment with Dr. Osei is Thursday, December 3rd at 10:30 AM. Please arrive promptly.", out: 1450, think: 1393, sec: 8.04 } },
    { id: "maths", label: "A maths word problem",
      ask: "Dr Lindqvist works 08:30 to 16:00 with a 50-minute lunch break. A new-patient visit takes 40 minutes and a follow-up takes 20 minutes. After every visit she needs 5 minutes for notes, except after the last visit of the day. Tomorrow she has 4 new patients. At most how many follow-ups can still fit?",
      low: { text: "ANSWER: 9", out: 663, think: 662, sec: 3.95 },
      high: { text: "Dr. Lindqvist's total working time is 08:30 to 16:00, which is 7 hours and 30 minutes (450 minutes). … F = 9\n\nSo, 9 follow-up appointments can fit. … This exactly matches the available time.\n\nANSWER: 9", out: 2010, think: 1527, sec: 9.22 } },
    { id: "classify", label: "A classification",
      ask: "Sort this patient message into exactly one category: booking, cancellation, billing, urgent-medical. Message: \"Hi, I was charged twice for my visit on Monday. Can someone refund one of them?\"",
      low: { text: "billing\nANSWER: billing", out: 75, think: 72, sec: 1.99 },
      high: { text: "Category: billing\nANSWER: billing", out: 169, think: 164, sec: 2.11 } }
  ];
  // From docs/ai-path/recordings/s5a-reasoning-effort/schedule-tight.json and runs/.../timings-tight.out.txt
  const REC_TIGHT = { src: "s5a-reasoning-effort/schedule-tight", provider: "openrouter", model: "google/gemini-2.5-flash", recordedAt: "2026-11-17",
    text: "ANSWER: Amir: Dr Osei 09:00; Bea: Dr Lindqvist 09:00; Chen: Dr Lindqvist 10:30; Farah: Dr Osei 10:00; Goran: Dr Osei 11:00; Hana: Dr Osei 09:30",
    out: 324, think: 252, finish: "stop", sec: 2.75 };
  // From schedule-low.json, choices[0].message.reasoning (the reasoning text returned with the reply; trimmed with …)
  const REC_LOW_REASONING = "**Listing Slot Availabilities** … I have generated the available options for Amir: Osei at 09:00-10:00 or 09:30-10:30. … **Evaluating Patient Slot Options** … I now need to consider how these patients might fit together to devise a valid schedule.";
  // From schedule-high.json: usage and finish_reason
  const HIGH_USAGE = { prompt: 298, finish: "stop" };
  const CAPTION = `Recorded model output, ${REC.recordedAt}`;

  // Right answers, computed in docs/ai-path/runs/s5a-reasoning-effort/correct_answers.out.txt and schedule_solver.out.txt
  const RIGHT = { date: "3 December 2026", lookup: "No", maths: 9, classify: "billing", rewriteMaxWords: 25 };

  /* ---------- Derived from the data ---------- */
  const mins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const hhmm = n => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  const answerLine = text => (text.split("\n").filter(l => l.startsWith("ANSWER:")).pop() || "").slice(7).trim();
  // "Amir: Dr Osei 09:30; ..." -> { Amir: { doc: "Osei", t: "09:30" }, ... }
  const parsePlan = s => Object.fromEntries(s.split(";").map(p => p.trim().match(/^(\w+): Dr (\w+) (\d\d:\d\d)$/)).filter(Boolean).map(m => [m[1], { doc: m[2], t: m[3] }]));
  // Every rule a plan breaks, in words. Rule numbers as in the prompt; "slot" = the one-patient-per-slot rule.
  function broken(plan) {
    const out = [], cells = {};
    const take = (who, doc, t) => {
      const k = doc + " " + t;
      if (!FREE[doc].includes(t)) out.push(`${who} is booked at ${t} with Dr ${doc}, who is not free then`);
      else if (cells[k]) out.push(`${cells[k]} and ${who} share Dr ${doc}'s ${t} slot`);
      else cells[k] = who;
    };
    for (const [who, b] of Object.entries(plan)) {
      take(who, b.doc, b.t);
      if (who === "Amir") take(who, b.doc, hhmm(mins(b.t) + 30));
    }
    const A = plan.Amir, B = plan.Bea, C = plan.Chen, F = plan.Farah, G = plan.Goran, H = plan.Hana;
    if (mins(A.t) + 60 > mins("10:30")) out.push("rule 1: Amir is not finished by 10:30");
    if (B.doc !== "Lindqvist") out.push("rule 2: Bea is with Dr Osei");
    if (mins(C.t) + 30 > mins("10:00")) out.push(`rule 3: Chen at ${C.t} is not finished by 10:00`);
    if (F.doc !== "Osei" || mins(F.t) < mins("10:00")) out.push("rule 4: Farah's booking");
    if (mins(G.t) < mins("11:00")) out.push(`rule 5: Goran comes at ${G.t}`);
    if (H.t !== B.t) out.push(`rule 6: Hana starts at ${H.t}, Bea at ${B.t}`);
    if (A.doc === C.doc) out.push(`rule 7: Amir and Chen both see Dr ${A.doc}`);
    return out;
  }
  const words = s => s.trim().split(/\s+/).length;
  function grade(id, text) {
    const a = answerLine(text);
    if (id === "date") return a.includes(RIGHT.date);
    if (id === "lookup") return a.startsWith(RIGHT.lookup);
    if (id === "schedule") return broken(parsePlan(a)).length === 0;
    if (id === "rewrite") return words(a) <= RIGHT.rewriteMaxWords && /Osei/.test(a) && /10:30/.test(a) && /\b3/.test(a) && /Dec/.test(a);
    if (id === "maths") return Number(a) === RIGHT.maths;
    if (id === "classify") return a === RIGHT.classify;
    return false;
  }
  for (const t of TASKS) for (const e of ["low", "high"]) t[e].ok = grade(t.id, t[e].text);
  const helps = t => t.high.ok && !t.low.ok;
  const HELPED = TASKS.filter(helps);
  const SCHED = TASKS.find(t => t.id === "schedule"), REWRITE = TASKS.find(t => t.id === "rewrite"), DATE = TASKS.find(t => t.id === "date");
  const LOW_PLAN = parsePlan(answerLine(SCHED.low.text)), HIGH_PLAN = parsePlan(answerLine(SCHED.high.text)), TIGHT_PLAN = parsePlan(answerLine(REC_TIGHT.text));
  const LOW_BROKEN = broken(LOW_PLAN), TIGHT_BROKEN = broken(TIGHT_PLAN);
  const N_PATIENTS = Object.keys(HIGH_PLAN).length, N_SLOTS = sum(Object.values(FREE).map(ts => ts.length));
  const tot = (e, k) => sum(TASKS.map(t => t[e][k]));
  const rightCount = pick => TASKS.filter(t => t[pick(t)].ok).length;
  const PLANS = [
    { name: "Low effort for all six", pick: () => "low" },
    { name: "High effort for all six", pick: () => "high" },
    { name: "High effort for the schedule puzzle only, low for the rest", pick: t => t.id === "schedule" ? "high" : "low" }
  ].map(p => ({ ...p, right: rightCount(p.pick), out: sum(TASKS.map(t => t[p.pick(t)].out)), sec: sum(TASKS.map(t => t[p.pick(t)].sec)) }));
  const budget = (e, max) => Math.round(RATIO[e] * max);
  const visible = r => r.out - r.think;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-tbl { width: 100%; border-collapse: collapse; margin: 14px 0 0; font-size: 14.5px; }
      .lx-${ID}-tbl caption { text-align: left; font-size: 13.5px; color: var(--muted); padding-bottom: 6px; }
      .lx-${ID}-tbl th, .lx-${ID}-tbl td { text-align: left; padding: 7px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .lx-${ID}-tbl th { font: 600 12.5px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
      .lx-${ID}-tbl td.n { font-family: var(--mono); white-space: nowrap; }
      .lx-${ID}-ok { color: var(--good); font-weight: 600; }
      .lx-${ID}-bad { color: var(--bad); font-weight: 600; }
      .lx-${ID}-mono { font: 500 13.5px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); background: var(--sunk); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; margin: 10px 0 0; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-rules { margin: 10px 0 0; padding-left: 1.4em; font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-rules li { padding: 2px 0; }
      .lx-${ID}-ask { margin: 6px 0 8px; font-size: 15px; line-height: 1.5; color: var(--ink-2); }
    `;
    document.head.appendChild(s);
  }
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  const okWord = ok => `<span class="lx-${ID}-${ok ? "ok" : "bad"}">${ok ? "right" : "wrong"}</span>`;
  const freeList = () => Object.entries(FREE).map(([d, ts]) => `<b>Dr ${d}</b> is free at ${ts.join(", ")}.`).join(" ");
  const rulesList = kit => `<ol class="lx-${ID}-rules">${PUZZLE_RULES.map(r => `<li>${kit.esc(r)}</li>`).join("")}</ol>`;
  const list = (kit, xs) => xs.map(x => kit.esc(x)).join("; ");
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  function single(el, kit, done, render, right) {
    let ans = null;
    const paint = () => {
      el.innerHTML = render(ans);
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === right) done(); });
    };
    paint();
  }

  /* 1. The situation: check the low-effort schedule against the rules, by hand. */
  function checkLow({ el, done, kit }) {
    ensureStyle();
    const opts = [
      "Amir is not finished by 10:30",
      "Amir and Chen both see Dr Osei",
      "Goran comes before 11:00",
      "Bea is with a doctor who does not see children"
    ];
    const A = LOW_PLAN.Amir, G = LOW_PLAN.Goran;
    const fb = [
      [`Amir starts at ${A.t} and takes 60 minutes, so he finishes at ${hhmm(mins(A.t) + 60)}. That is in time, so rule 1 is kept. Check the rules that name two patients.`, false],
      [`Right: rule 7 is broken. Checking every booking the same way finds more: ${list(kit, LOW_BROKEN)}. The model had the same ${PUZZLE_RULES.length} rules as you. With little room to think, it wrote a schedule that looks complete and breaks rules.`, true],
      [`Goran is at ${G.t}. Rule 5 says he cannot come <i>before</i> 11:00, so ${G.t} is allowed.`, false],
      ["Bea is with Dr Lindqvist, who does see children. Rule 2 is kept.", false]
    ];
    single(el, kit, done, ans => `<h1>${N_PATIENTS} patients, ${N_SLOTS} free slots</h1>
      <p class="lead">A clinic's booking assistant is a language model. Staff ask it quick things all day: opening hours, a reminder to rewrite. Tonight they also ask it to fit tomorrow's patients into the doctors' free slots. Every slot is 30 minutes and holds one patient. ${freeList()}</p>
      ${rulesList(kit)}
      <p class="lead">The model is a <b>reasoning model</b>. Before it writes the answer, it works the problem out in text that is not part of the reply: its <b>thinking tokens</b>. A setting called <b>effort</b> decides how much room it gets for that thinking. More room can fix a hard task, but you pay for every thinking token and wait for it. This lesson is about when that is worth it. At <b>low</b> effort it answered:</p>
      ${mono(kit, answerLine(SCHED.low.text))}
      <p class="lx-${ID}-cap">${CAPTION}</p>
      <p class="task">Check the answer against the rules. Which of these is a real mistake?</p>
      <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`, 1);
  }

  /* 2. By hand: six tasks, predict where high effort helps, compare with the recordings. */
  function sixTasks({ el, done, kit }) {
    ensureStyle();
    const ans = TASKS.map(() => null);
    const row = t => `Low effort: ${okWord(t.low.ok)}, ${fmt(t.low.out)} output tokens, ${t.low.sec} s. High effort: ${okWord(t.high.ok)}, ${fmt(t.high.out)} output tokens, ${t.high.sec} s.`;
    const why = {
      date: "Counting ten working days and skipping one closed day was easy enough at both settings.",
      lookup: "One look at the hours answers it. There is nothing to work out.",
      schedule: "This is the one where the extra room changed the answer.",
      rewrite: "Both reminders keep the date, time and doctor and stay under the word limit. Thinking harder did not make the wording better.",
      maths: "A careful reader might expect this one to need it. In this run, low effort also found the answer.",
      classify: "The message plainly says “charged twice” and “refund”. One step, no search."
    };
    const paint = () => {
      el.innerHTML = `<h1>Where does more effort pay?</h1>
        <p class="lead">The assistant got six requests, each run once at low effort and once at high effort. Same model, same prompt, same token limit. You saw the schedule puzzle already. The others:</p>
        <p class="task">For each request, predict: did high effort turn a wrong answer into a right one? Pick again if you change your mind.</p>
        ${TASKS.map((t, i) => {
          const right = helps(t) ? 0 : 1, picked = ans[i];
          const fbHtml = picked == null ? "" : kit.feedback(`${picked === right ? (right === 0 ? "Yes. " : "No. ") : (right === 0 ? "It did. " : "It did not. ")}${row(t)} ${why[t.id]}`, picked === right);
          return `<div class="lcase" id="t${i}"><p><b>${kit.esc(t.label)}.</b></p><p class="lx-${ID}-ask">${kit.esc(t.ask)}</p>${kit.options(["Yes, high effort helped", "No, low was already right"], { picked, correct: right })}${fbHtml}</div>`;
        }).join("")}
        <p class="lx-${ID}-cap">Seconds measured on our side, from sending each request to saving the reply, one run each. Treat small gaps as noise.</p>`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (TASKS.every((t, j) => ans[j] === (helps(t) ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: what made the schedule puzzle different. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    const others = TASKS.length - HELPED.length;
    const opts = [
      "It was the longest request",
      `Each placement limits the next ones, so the model must try a placement, check it against ${PUZZLE_RULES.length} rules, and go back when one fails`,
      "It needs facts the model does not have",
      "It asks for the answer in a special list format"
    ];
    const fb = [
      ["A long request is more text to read, and reading was not the problem. Look at the reasoning text: it ends right after listing the options for the first few patients, before it has tried and checked a whole schedule.", false],
      [`Right. Placing Amir decides which slots Farah and Hana can have, and a wrong early choice only shows up several steps later. Finding that out takes many steps of trying and checking, and that is what thinking tokens are spent on. The other ${others} requests needed one or two steps. In the last lesson you asked a model to “work step by step”. A reasoning model does that on its own, before the answer, in tokens you do not see in the reply.`, true],
      [`Everything needed is in the request: the free slots and the ${PUZZLE_RULES.length} rules. The high-effort run solved it from exactly the same text. Thinking cannot supply a fact that is missing; here none was.`, false],
      ["The low-effort answer has the format exactly right. Its content is what is wrong: patients share slots and rule 7 is broken.", false]
    ];
    single(el, kit, done, ans => `<h1>What made the puzzle different?</h1>
      <p class="lead">High effort changed the answer on ${plural(HELPED.length, "request")} out of ${TASKS.length}: ${HELPED.map(t => kit.esc(t.label.toLowerCase())).join(", ")}. With the low-effort reply, the model also returned a short text about its reasoning. This is part of it:</p>
      ${mono(kit, REC_LOW_REASONING)}
      <p class="lx-${ID}-cap">${CAPTION}. The API returns a short summary of the thinking, not all of it.</p>
      <p class="lead">Then it answered with the schedule you checked.</p>
      <p class="task">What made this request need more thinking than the other ${others}?</p>
      <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`, 1);
  }

  /* 4. What effort really sets: room, not a fixed amount. */
  function whatEffortSets({ el, done, kit }) {
    ensureStyle();
    const r = x1(REWRITE.high.think, REWRITE.low.think);
    const opts = [
      "An exact number of thinking tokens",
      "How much room the model gets for thinking; it decides how much of that room to use",
      "How long the visible answer is",
      "Which model answers"
    ];
    const fb = [
      [`Then the date question at high effort could not think less than at low. It did: ${DATE.high.think} thinking tokens against ${DATE.low.think}.`, false],
      [`Right. Effort sets an upper limit, and the model chooses how much of it to use. Through OpenRouter, which sent these requests, the limit is a share of <code>max_tokens</code>: its documentation gives about ${RATIO.low * 100}% of it for low and ${RATIO.high * 100}% for high, so at ${fmt(MAX_TOKENS)} that is about ${fmt(budget("low", MAX_TOKENS))} and ${fmt(budget("high", MAX_TOKENS))} thinking tokens. The most any low run used was ${fmt(Math.max(...TASKS.map(t => t.low.think)))}, below the ${fmt(budget("low", MAX_TOKENS))} that low allows. Anthropic's documentation says the same in other words: effort is “a behavioral signal, not a strict token budget”. Look at the rewrite: given more room, the model used ${r} times more thinking for a reminder that was no better.`, true],
      [`The visible part barely changed. For the rewrite, the reply itself was ${visible(REWRITE.low)} tokens at low and ${visible(REWRITE.high)} at high; almost all of the difference is thinking.`, false],
      ["Both runs asked for the same model, and the recording says the same model answered. Only the effort setting changed.", false]
    ];
    single(el, kit, done, ans => `<h1>Room to think, not a fixed amount</h1>
      <p class="lead">With every reply, the API also sends token counts. They say how many of the output tokens were thinking. For each request:</p>
      <table class="lx-${ID}-tbl"><caption>Thinking tokens per request</caption><thead><tr><th>request</th><th>low</th><th>high</th></tr></thead><tbody>
        ${TASKS.map(t => `<tr><td>${kit.esc(t.label)}</td><td class="n">${fmt(t.low.think)}</td><td class="n">${fmt(t.high.think)}</td></tr>`).join("")}
      </tbody></table>
      <p class="task">The date question used fewer thinking tokens at high effort. The rewrite used ${r} times more. What does the effort setting control?</p>
      <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`, 1);
  }

  /* 5. Use it: pick the plan that gets all six right for the fewest output tokens. */
  function pickPlan({ el, done, kit }) {
    ensureStyle();
    const allRight = PLANS.filter(p => p.right === TASKS.length);
    const best = allRight.reduce((a, b) => (b.out < a.out ? b : a));
    const RIGHT_I = PLANS.indexOf(best);
    const say = p => `${p.right} of ${TASKS.length} right, ${fmt(p.out)} output tokens, ${p.sec.toFixed(1)} s of waiting in total`;
    const fb = PLANS.map((p, i) => i === RIGHT_I
      ? [`Right: ${say(p)}. All high: ${say(PLANS[1])}. You get the same answers for ${x1(PLANS[1].out, p.out)} times fewer output tokens than all high. Thinking tokens are billed as output tokens, so this is where the bill grows. The catch: your code has to know which requests are puzzles before it sends them, for example from the request type.`, true]
      : [`${say(p)}. ${p.right < TASKS.length ? "It gets the puzzle wrong." : `It gets every answer right, but pays for thinking that changed nothing on ${TASKS.length - HELPED.length} requests.`}`, false]);
    single(el, kit, done, ans => `<h1>Pay for thinking where it counts</h1>
      <p class="lead">The clinic gets these six kinds of requests every day. Thinking tokens are billed as output tokens, and the reply comes only after the thinking is done. You can set effort per request.</p>
      <table class="lx-${ID}-tbl"><caption>Output tokens per request (thinking included), from the recorded runs</caption><thead><tr><th>request</th><th>low</th><th>high</th></tr></thead><tbody>
        ${TASKS.map(t => `<tr><td>${kit.esc(t.label)}</td><td class="n">${fmt(t.low.out)} ${okWord(t.low.ok)}</td><td class="n">${fmt(t.high.out)} ${okWord(t.high.ok)}</td></tr>`).join("")}
      </tbody></table>
      <p class="task">Which plan gets all six right for the fewest output tokens?</p>
      <div class="lpanel">${ask(kit, PLANS.map(p => kit.esc(p.name)), RIGHT_I, ans, fb)}</div>`, RIGHT_I);
  }

  /* 6. The real API: read the request and the usage block. */
  function theRequest({ el, done, kit }) {
    ensureStyle();
    const h = SCHED.high, vis = visible(h);
    const opts = [fmt(h.out), fmt(h.think), fmt(vis), fmt(HIGH_USAGE.prompt)];
    const fb = [
      [`${fmt(h.out)} is every output token, thinking included. Part of it the staff never see.`, false],
      [`${fmt(h.think)} is the thinking part. The question asks for the reply the staff can read.`, false],
      [`Right: ${fmt(h.out)} − ${fmt(h.think)} = ${fmt(vis)}. The reply was ${fmt(vis)} tokens, and you paid output price for all ${fmt(h.out)}. Thinking also counts against <code>max_tokens</code>, so the limit must leave room for both. The next screen shows what happens when it does not.`, true],
      [`${fmt(HIGH_USAGE.prompt)} is <code>prompt_tokens</code>: the system prompt and the puzzle, the input.`, false]
    ];
    const req = `{
  "model": "…",
  "messages": [
    { "role": "system", "content": "You are the booking assistant at Linden Street Clinic. …" },
    { "role": "user", "content": "Fit six patients into tomorrow's free 30-minute slots. …" }
  ],
  "max_tokens": ${MAX_TOKENS},
  "reasoning": { "effort": "high" }
}`;
    const usage = `"finish_reason": "${HIGH_USAGE.finish}",
"usage": {
  "prompt_tokens": ${HIGH_USAGE.prompt},
  "completion_tokens": ${h.out},
  "completion_tokens_details": { "reasoning_tokens": ${h.think}, … }
}`;
    single(el, kit, done, ans => `<h1>The setting in the request</h1>
      <p class="lead">This is the request body that produced the right schedule, sent to OpenRouter's chat completions API (trimmed with …). The effort is one field, <code>reasoning.effort</code>. <code>max_tokens</code> caps all output: thinking plus reply.</p>
      ${mono(kit, req)}
      <p class="lead">Part of what came back. <code>completion_tokens</code> counts all output tokens; <code>reasoning_tokens</code> counts the thinking among them.</p>
      ${mono(kit, usage)}
      <p class="lx-${ID}-cap">${CAPTION}</p>
      <p class="task">How many tokens long was the reply the staff could read?</p>
      <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>
      <p class="lead"><b>Not run by us.</b> Other APIs name the same control differently. Written from Anthropic's and OpenAI's official documentation (linked in this lesson's sources), checked 2026-11-18: Anthropic's Messages API takes <code>"output_config": { "effort": "low" }</code>, OpenAI's Responses API takes <code>"reasoning": { "effort": "low" }</code>. The levels each one accepts depend on the model. In both, thinking tokens are billed as output.</p>`, 2);
  }

  /* 7. max_tokens too small: high effort with little room. */
  function tight({ el, done, kit }) {
    ensureStyle();
    const b = budget("high", MAX_TIGHT);
    const opts = [
      "The same right schedule: the effort is still high",
      "An error: 400 tokens is too small",
      "It thinks much less than before, and the schedule may come out wrong",
      "It thinks as long as before, and the reply is cut off"
    ];
    const rec = `${mono(kit, REC_TIGHT.text)}<p class="lx-${ID}-cap">Recorded model output, ${REC_TIGHT.recordedAt}. ${fmt(REC_TIGHT.think)} thinking tokens, <code>finish_reason</code> "${REC_TIGHT.finish}".</p>`;
    const fb = [
      [`Through OpenRouter, “high” is a share of <code>max_tokens</code>, not a fixed amount: its documentation gives about ${RATIO.high * 100}%, so about ${b} thinking tokens here, and thinking plus reply can never pass ${MAX_TIGHT}. The right answer used ${fmt(SCHED.high.think)} thinking tokens.`, false],
      [`No error. The reply came back complete, with <code>finish_reason</code> "${REC_TIGHT.finish}". That is the trouble: nothing tells you it went wrong.`, false],
      [`Right. It used ${fmt(REC_TIGHT.think)} thinking tokens instead of ${fmt(SCHED.high.think)} and answered:${rec}It breaks rules again: ${list(kit, TIGHT_BROKEN)}. The word “high” did not help; the room did. When you raise effort, raise <code>max_tokens</code> with it, and log <code>reasoning_tokens</code> and <code>finish_reason</code> so you can see when thinking is squeezed.`, true],
      [`The thinking itself was squeezed: ${fmt(REC_TIGHT.think)} tokens, not ${fmt(SCHED.high.think)}. The reply was not cut off: <code>finish_reason</code> was "${REC_TIGHT.finish}".`, false]
    ];
    single(el, kit, done, ans => `<h1>High effort, little room</h1>
      <p class="lead">A teammate copies the request to a service that caps every call at <code>max_tokens: ${MAX_TIGHT}</code> to keep costs down. Effort stays <code>"high"</code>. Same puzzle, same model.</p>
      <p class="task">What comes back?</p>
      <div class="lpanel">${ask(kit, opts, 2, ans, fb)}</div>`, 2);
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    const L = REWRITE.low, H = REWRITE.high;
    const wl = words(answerLine(L.text)), wh = words(answerLine(H.text));
    const opts = [
      "Better reminders",
      `About ${x1(H.out, L.out)} times the output tokens and ${x1(H.sec, L.sec)} times the wait, for reminders that were no better`,
      "Fewer mistakes in dates and times"
    ];
    const fb = [
      [`Both met every requirement: ${wl} and ${wh} words, both under ${RIGHT.rewriteMaxWords}, both with the date, time and doctor. Neither was better in a way the clinic asked for.`, false],
      [`Right: ${fmt(L.out)} against ${fmt(H.out)} output tokens, ${L.sec} s against ${H.sec} s. On a job that runs for every booking, that is a cost on every call, for nothing.`, true],
      ["Both reminders kept the date and time exactly. A rewrite has no dates to work out; it copies them.", false]
    ];
    single(el, kit, done, ans => `<h1>When to turn effort up</h1>
      <p class="lead"><b>For:</b> tasks with many steps that depend on each other: schedules under rules, multi-step maths, planning, tricky code. <b>Reach for high effort</b> when your tests show low effort getting those wrong.</p>
      <p class="lead"><b>Not for:</b> lookups, classification, rewrites, extraction. Low effort, or a model without thinking, does them as well. And not when the facts are missing: thinking cannot invent a fact that is not in the request. Fetch the data instead.</p>
      <p class="lead"><b>Costs:</b> thinking tokens are billed as output, the reply waits for the thinking, and <code>max_tokens</code> must leave room for both.</p>
      <p class="task">The reminder rewrite runs for every booking. What does switching it from low to high effort buy?</p>
      <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`, 1);
  }

  /* 9. Recognise it in new situations, including two where more effort is the wrong fix. */
  const CASES = [
    ["A hospital ward needs next month's night rota: 14 nurses, nobody on two nights in a row, at least two senior nurses every night, and everyone's leave days respected.", true,
      "Yes. Every placement limits the next ones, and a bad early choice only shows later. That is search with checking, the kind of task where the extra room changed the answer in the clinic puzzle. Check the result against the rules in code; for a very large rota, a scheduling solver in code is the safer tool.",
      "This is the clinic puzzle, only bigger: many rules that depend on each other, and an early choice that can break a later rule. A low budget is likely to give a schedule that looks complete and breaks rules. If a model writes it, turn effort up, and check every rule in code afterwards."],
    ["Copy the phone number out of each patient's message into the booking form. Thousands of messages a day.", false,
      "No. It is one step: find the number and copy it. Like the classification and the lookup, low effort or no thinking does it, and at this volume the extra tokens and waiting add up on every message.",
      "There is nothing to work out, only something to copy. Extra thinking costs tokens and time on every one of thousands of messages and does not make the copy more correct. Keep effort low."],
    ["A patient asks the chat assistant whether Dr Osei works on 24 December. The holiday rota is not in the prompt, and the assistant has no tool to read it.", false,
      "No. The answer is a fact the model does not have. More thinking cannot produce it; it can only produce a more confident guess. Give the assistant the rota, through retrieval or a tool, and then even low effort answers it.",
      "Thinking works on what is in front of the model. The rota is not there, so high effort reasons longer about a fact it cannot know, and may guess. The fix is to fetch the rota, not to think harder."],
    ["A refund request must be checked against a 12-clause policy. Clause 4 allows refunds within 30 days, clause 7 makes an exception for prescriptions, and clause 9 cancels that exception for children's prescriptions.", true,
      "Yes. Each clause changes what the next one means, so the model must follow a chain of exceptions and check the case against each step. Many dependent steps: worth the room.",
      "This is not a lookup: the answer depends on clause 4, then the exception in clause 7, then the exception to the exception in clause 9. A wrong turn early gives a confident wrong answer. Turn effort up, and test it on real cases."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Turn effort up, or not?</h1>
        <p class="lead">Four requests from other teams.</p>
        <p class="task">Would you turn reasoning effort up for each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes, high effort", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can set the effort</h1>
      <p class="lead">You checked a schedule by hand, predicted where more thinking would pay, and saw it pay on ${plural(HELPED.length, "request")} of ${TASKS.length}. Effort gives a reasoning model room to think. Turn it up only for tasks with many steps that depend on each other. The thinking is billed as output and makes you wait, and <code>max_tokens</code> must leave room for it.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The schedule came back as a line of text you had to parse; next you make the model return a shape your code can check.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Reasoning models and the effort setting",
    checked: "2026-11-18",
    sources: [
      "https://openrouter.ai/docs/guides/best-practices/reasoning-tokens",
      "https://aistudio.google.com/docs/thinking",
      "https://platform.claude.com/docs/en/build-with-claude/effort",
      "https://platform.claude.com/docs/en/build-with-claude/extended-thinking",
      "https://developers.openai.com/api/docs/guides/reasoning"
    ],
    interview: [
      {
        q: "After one hard scheduling bug, your team set reasoning effort to high on every model call. Now replies are slow and the bill is up. How do you decide the effort per request?",
        good: [
          "Group requests by type and run a small test set for each at low and high effort",
          "Keep high only where it changes answers: many dependent steps, like schedules under rules, multi-step maths or planning",
          "Use low, or a model without thinking, for lookups, classification, extraction and rewrites",
          "Read reasoning_tokens in the usage: thinking is billed as output and the user waits for it",
          "Check that max_tokens leaves room for thinking plus the reply wherever effort is high"
        ],
        weak: "Keep high everywhere because accuracy matters most. That ignores that most requests get the same answer at low effort, for several times fewer tokens."
      },
      {
        q: "A planning feature works in testing, but in production it often returns schedules that break rules, with no error. Production caps max_tokens much lower. What do you suspect and check?",
        good: [
          "Thinking tokens count against max_tokens, so a low cap squeezes the thinking",
          "With some providers effort is turned into a share of max_tokens, so the same effort gives far less room",
          "Compare reasoning_tokens and finish_reason between test and production calls",
          "Raise max_tokens for that request type, and validate the result against the rules in code"
        ],
        weak: "The model is flaky; add retries. That pays again for the same squeezed thinking instead of finding the cap."
      }
    ],
    screens: [checkLow, sixTasks, spotIdea, whatEffortSets, pickPlan, theRequest, tight, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#t0 [data-wrong]"], right: TASKS.map((_, i) => `#t${i} [data-right]`) },
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
