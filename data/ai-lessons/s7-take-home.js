/* Lesson: plan a take-home task inside its time box. Story: a hiring team sends a four-hour take-home on a Friday
   evening with a Monday deadline: turn supplier emails into JSON (delivery date, amount, currency). The brief and
   the ten emails are invented for this lesson. Ideas: (1) choose the simplest approach that can work (a prompt,
   not fine-tuning, with no labels and four hours), and build a small hand-labelled set plus a scorer in the first
   hour, because every later choice and the README's result depend on it; (2) spend the box on what the brief
   judges, and put what you skipped in a "what I would do next" list, honestly (a 10/10 on the set you tuned on is
   not a result).
   Data, all real:
   - docs/ai-path/runs/s7-take-home/emails.json: the ten invented emails and the hand-written gold labels;
   - recordings (main checkout) docs/ai-path/recordings/s7-take-home/v1-e01..e10 (the first-hour prompt) and
     v2-e01..e10 (the prompt after reading v1's errors), 20 calls, request files written by make_requests.py;
   - docs/ai-path/runs/s7-take-home/score.py + score.out.txt: the from-scratch scorer shown on the code screen,
     run on all 20 recorded answers, with the line trace of the v1 run.
   Lesson-local style: email card, brief card, time-budget rows and toggle list (.lx-s7-take-home-*), see
   ensureStyle(). Plain browser script. */
(() => {
  const ID = "s7-take-home";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);

  /* ---------- Data copied from the runs and recordings ---------- */
  const BOX_HOURS = 4, BLOCK_MIN = 30; // the brief's time box, planned in half-hour blocks
  const EMAILS_SENT = 40;              // the brief: 40 emails, no answers
  // From docs/ai-path/runs/s7-take-home/emails.json (body, sent date, gold labels written by hand)
  const MAIL = {
    e06: { sent: "2026-11-10", from: "Lumen Cable Co.", body: "Hello,\nWe can send the first half of the cable on 16 Nov and the rest on 23 Nov.\nTotal for the order: 5,600 USD.\nRegards, Ana" },
    e08: { sent: "2026-11-11", from: "Sato Resin", body: "Dear buyer,\nThe resin ships to arrive on 30 Nov (Mon).\nOrder total 2,400.00 USD. You paid a 30% deposit (720.00 USD); the balance of 1,680.00 USD is due on delivery.\nSato Resin, sales" },
    e09: { sent: "2026-11-12", from: "QuickParts", body: "Good news: the replacement fan will arrive tomorrow morning.\nCharge: USD 99.90.\nQuickParts support" }
  };
  const GOLD = {
    e01: { delivery_date: "2026-11-18", amount: 1240.00, currency: "USD" },
    e02: { delivery_date: "2026-11-12", amount: 845.00, currency: "EUR" },
    e03: { delivery_date: "2026-11-20", amount: 3450000, currency: "KRW" },
    e04: { delivery_date: "2026-12-03", amount: 1980.50, currency: "EUR" },
    e05: { delivery_date: "2026-11-27", amount: null, currency: null },
    e06: { delivery_date: "2026-11-23", amount: 5600, currency: "USD" },
    e07: { delivery_date: "2026-11-25", amount: 612.40, currency: "USD" },
    e08: { delivery_date: "2026-11-30", amount: 2400.00, currency: "USD" },
    e09: { delivery_date: "2026-11-13", amount: 99.90, currency: "USD" },
    e10: { delivery_date: "2026-12-01", amount: 140800, currency: "JPY" }
  };
  // From docs/ai-path/recordings/s7-take-home/v1-e01..e10.json and v2-e01..e10.json: the JSON line of each answer,
  // copied exactly (the model wrapped all but one answer in a ```json fence, cut here as the scorer does).
  const REC = { provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-14", temperature: 0 };
  const V1 = {
    e01: '{"delivery_date": "18 November", "amount": "1,240.00", "currency": "USD"}',
    e02: '{"delivery_date": "Thursday", "amount": 845.00, "currency": "EUR"}',
    e03: '{"delivery_date": "20 November", "amount": "3,450,000", "currency": "KRW"}',
    e04: '{"delivery_date": "03.12.2026", "amount": "1.980,50", "currency": "€"}',
    e05: '{"delivery_date": "27 November", "amount": null, "currency": null}',
    e06: '{"delivery_date": "2023-11-23", "amount": 5600, "currency": "USD"}',
    e07: '{"delivery_date": "2026-11-25", "amount": "612.40", "currency": "$"}',
    e08: '{"delivery_date": "30 Nov", "amount": "1680.00", "currency": "USD"}',
    e09: '{"delivery_date": "tomorrow morning", "amount": 99.90, "currency": "USD"}',
    e10: '{"delivery_date": "1 December", "amount": 140800, "currency": "JPY"}'
  };
  const V2 = {
    e01: '{"delivery_date": "2026-11-18", "amount": 1240.00, "currency": "USD"}',
    e02: '{"delivery_date": "2026-11-12", "amount": 845.00, "currency": "EUR"}',
    e03: '{"delivery_date": "2026-11-20", "amount": 3450000, "currency": "KRW"}',
    e04: '{"delivery_date": "2026-12-03", "amount": 1980.50, "currency": "EUR"}',
    e05: '{"delivery_date": "2026-11-27", "amount": null, "currency": null}',
    e06: '{"delivery_date": "2026-11-23", "amount": 5600, "currency": "USD"}',
    e07: '{"delivery_date": "2026-11-25", "amount": 612.40, "currency": "USD"}',
    e08: '{"delivery_date": "2026-11-30", "amount": 2400.00, "currency": "USD"}',
    e09: '{"delivery_date": "2026-11-13", "amount": 99.90, "currency": "USD"}',
    e10: '{"delivery_date": "2026-12-01", "amount": 140800, "currency": "JPY"}'
  };
  // The first-hour prompt, from docs/ai-path/runs/s7-take-home/make_requests.py (V1_SYSTEM); the user message was
  // the email body alone. v2 added the sent date to the message and the brief's rules to the instructions.
  const V1_PROMPT = 'Extract the delivery date and the amount from this supplier email. Reply with JSON only: {"delivery_date": ..., "amount": ..., "currency": ...}';
  const V2_RULE_DATE = 'Work out words like "Thursday" or "tomorrow" from the date the email was sent.';
  const V2_RULE_AMOUNT = "amount: the order total including tax and shipping, not a subtotal, deposit or balance.";

  // The listing is score() from docs/ai-path/runs/s7-take-home/score.py, line for line (line 0 = def).
  const CODE = [
    "def score(predictions, gold):",
    "    hits = {\"delivery_date\": 0, \"amount\": 0, \"currency\": 0}",
    "    for email_id, truth in gold.items():",
    "        guess = predictions[email_id]",
    "        for field in hits:",
    "            if guess.get(field) == truth[field]:",
    "                hits[field] += 1",
    "    return hits"
  ];
  // v1 trace rows from score.out.txt: [line about to run, event, email_id, field, hits [date, amount, currency]].
  // The first email step by step (the first 12 rows), then the row at line 2 after each later email, then the return.
  const TRACE = [
    [1,"l",null,null,null],[2,"l",null,null,[0,0,0]],[3,"l","e01",null,[0,0,0]],[4,"l","e01",null,[0,0,0]],
    [5,"l","e01","delivery_date",[0,0,0]],[4,"l","e01","delivery_date",[0,0,0]],[5,"l","e01","amount",[0,0,0]],
    [4,"l","e01","amount",[0,0,0]],[5,"l","e01","currency",[0,0,0]],[6,"l","e01","currency",[0,0,0]],
    [4,"l","e01","currency",[0,0,1]],[2,"l","e01","currency",[0,0,1]],
    [2,"l","e02","currency",[0,1,2]],[2,"l","e03","currency",[0,1,3]],[2,"l","e04","currency",[0,1,3]],
    [2,"l","e05","currency",[0,2,4]],[2,"l","e06","currency",[0,3,5]],[2,"l","e07","currency",[1,3,5]],
    [2,"l","e08","currency",[1,3,6]],[2,"l","e09","currency",[1,4,7]],[2,"l","e10","currency",[1,5,8]],
    [7,"r","e10","currency",[1,5,8]]
  ];
  const TRACE_STEPS = 108; // score.out.txt: "== v1 trace (108 steps)"

  /* ---------- Derived from the data ---------- */
  const FIELDS = ["delivery_date", "amount", "currency"];
  const IDS = Object.keys(GOLD);
  const parse = o => Object.fromEntries(Object.entries(o).map(([k, s]) => [k, JSON.parse(s)]));
  const P1 = parse(V1), P2 = parse(V2);
  const score = P => Object.fromEntries(FIELDS.map(f => [f, IDS.filter(id => P[id][f] === GOLD[id][f]).length]));
  const S1 = score(P1), S2 = score(P2);
  const N = IDS.length;
  const BLOCKS = BOX_HOURS * 60 / BLOCK_MIN;
  const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  const CAPTION = `Recorded model output, ${REC.recordedAt}`;
  const NICE = { delivery_date: "delivery date", amount: "amount", currency: "currency" };

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-card { margin: 16px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
      .lx-${ID}-card h2 { margin: 0 0 6px; font: 600 13px/1.4 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-card p, .lx-${ID}-card li { margin: 4px 0; font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-card ul { margin: 4px 0; padding-left: 20px; }
      .lx-${ID}-mail { white-space: pre-wrap; font: 500 14.5px/1.55 var(--mono); overflow-wrap: anywhere; margin: 0; color: var(--ink); }
      .lx-${ID}-meta { font: 500 13px/1.4 var(--mono); color: var(--muted); margin: 0 0 6px; }
      .lx-${ID}-ans { margin: 8px 0 0; padding: 8px 10px; background: var(--sunk); border-radius: 4px; font: 500 14px/1.5 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-cap { margin: 4px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-note { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-bud { margin: 14px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-row span { font-size: 15.5px; line-height: 1.4; min-width: 0; }
      .lx-${ID}-ctl { display: flex; align-items: center; gap: 6px; }
      .lx-${ID}-ctl button { min-width: 44px; min-height: 44px; font: 600 18px var(--font); border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); cursor: pointer; }
      .lx-${ID}-ctl button:disabled { color: var(--faint); cursor: default; }
      .lx-${ID}-ctl b { min-width: 3.2em; text-align: center; font: 600 15px var(--mono); }
      .lx-${ID}-total { margin: 10px 0 0; font: 600 15px var(--mono); }
      .lx-${ID}-tog { display: grid; gap: 8px; margin: 14px 0 0; }
      .lx-${ID}-tog button { min-height: 44px; padding: 10px 12px 10px 42px; position: relative; text-align: left; font: 500 15.5px/1.45 var(--font); border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); cursor: pointer; }
      .lx-${ID}-tog button::before { content: ""; position: absolute; left: 12px; top: 12px; width: 18px; height: 18px; border: 2px solid var(--ink-2); border-radius: 3px; box-sizing: border-box; }
      .lx-${ID}-tog button[aria-pressed="true"] { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
      .lx-${ID}-tog button[aria-pressed="true"]::before { background: var(--ink); }
      .lx-${ID}-check { margin: 12px 0 0; min-height: 44px; }
      .lx-${ID}-plan { margin: 10px 0 0; padding: 0; list-style: none; }
      .lx-${ID}-plan li { font: 500 14px/1.6 var(--mono); }
    `;
    document.head.appendChild(s);
  }
  const mailCard = (kit, id) => {
    const m = MAIL[id];
    return `<div class="lx-${ID}-card"><p class="lx-${ID}-meta">email ${kit.esc(id)} · sent ${kit.esc(m.sent)} · ${kit.esc(m.from)}</p><pre class="lx-${ID}-mail">${kit.esc(m.body)}</pre>
      <div class="lx-${ID}-ans">${kit.esc(V1[id])}</div><p class="lx-${ID}-cap">${CAPTION}, first-hour prompt</p></div>`;
  };
  const ask = (kit, opts, correct, picked, fb) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fb[picked], picked === correct)}`;
  const pyv = v => v === null ? "None" : typeof v === "string" ? `"${v}" (text)` : `${v} (a number)`;

  /* 1. The situation: the brief, and the first choice. */
  function theBrief({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Fine-tune a small open model on the emails",
      "Prompt a hosted model with clear rules, and score it on emails you label yourself",
      "Build retrieval (RAG) over all 40 emails",
      "Write regular expressions for dates and amounts"
    ];
    const RIGHT = 1;
    const fb = [
      `Fine-tuning learns from labelled examples, and the brief sends ${EMAILS_SENT} emails with no answers. You would first have to label many of them by hand, then train, then still compare against something simpler. That is more than ${BOX_HOURS} hours before you have one number to report.`,
      `Right. A prompt can work today with zero training data, and it takes minutes to change. Labelling a handful of emails yourself gives you something to score it against. Fine-tuning becomes worth it later, when there are many labelled emails and a prompt has been measured and found not good enough.`,
      `Retrieval finds documents that contain an answer. Here the answer is inside the one email you are reading: there is nothing to look up. RAG adds an index and a search step and solves no problem the brief has.`,
      `Fine for a few fixed formats, but these emails are written by people: “on Thursday”, “tomorrow morning”, “03.12.2026”, a deposit next to a total. Every new wording needs a new rule. A regex can be a quick comparison later, not the main plan.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Four hours, due Monday</h1>
        <p class="lead">Friday evening. A hiring team sends you a take-home task. You have the weekend, but the brief asks you to spend about ${BOX_HOURS} hours. This lesson is about planning those hours: what to build, how to measure it, and what to skip and say so. (The brief and the emails in this lesson are invented.)</p>
        <div class="lx-${ID}-card"><h2>The brief</h2>
          <p>We attach ${EMAILS_SENT} emails from our suppliers. Build something that turns one email into JSON:</p>
          <ul><li><code>delivery_date</code>: YYYY-MM-DD, the latest confirmed date (the last part, if it comes in parts)</li>
          <li><code>amount</code>: the order total including tax, as a number</li>
          <li><code>currency</code>: ISO code, such as USD; <code>null</code> when the email does not say</li></ul>
          <p>Time box: about ${BOX_HOURS} hours. Send a repo with a README: how you measured quality, what you chose and why, what you would do next.</p>
          <p>We look at: the result and how you measured it, your choices, and how clearly you explain them.</p></div>
        <p class="task">The emails come with no answers. What do you build?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand: read the first prompt's real answers and find what is wrong. */
  const BYHAND = [
    { id: "e06", right: 0,
      opts: ["The year: 2023, but the email was sent in 2026", "The date: it should be the first part's date, 16 Nov", "The amount should be written 5,600.00", "Nothing is wrong"],
      fb: [`Right. The email says only “23 Nov”. The model never saw when the email was sent, so it filled in a year by itself, and the wrong one.`,
           `The brief says: the last part, if it comes in parts. 23 Nov is the last part, so the day is right. Look at the rest of the date.`,
           `5600 and 5600.00 are the same number. The brief asks for a number, not a written format.`,
           `Compare the date with the email's “sent” line. One part of it cannot be right.`] },
    { id: "e08", right: 1,
      opts: ["The date should be the day the deposit was paid", "The amount: 1,680 is the balance, the order total is 2,400", "The currency should be the $ sign", "Nothing is wrong"],
      fb: [`The brief asks for the delivery date. The deposit has no date in this email, and “30 Nov” is when the resin arrives.`,
           `Right. The email has three amounts: total, deposit and balance. The first prompt said only “the amount”, so the model picked one. The brief means the total including tax. (“30 Nov” also misses the YYYY-MM-DD form; the next screens deal with dates.)`,
           `The brief asks for an ISO code such as USD, and this answer has USD. The $ sign would be the mistake.`,
           `Read the email's numbers again: 2,400.00, 720.00 and 1,680.00. Which one does the brief call the amount?`] },
    { id: "e09", right: 2,
      opts: ["The amount should be 99.9", "It should be null: the email gives no date", "“tomorrow morning” is not a date: the model was never told when the email was sent", "The currency is missing"],
      fb: [`99.90 and 99.9 are the same number once parsed. That is not the problem.`,
           `“Tomorrow” is a date once you know the email was sent on ${MAIL.e09.sent}. A null here would throw away information the email does give.`,
           `Right. The first prompt sent only the email body, so “tomorrow” could not be turned into a date. The fix is in your input, not in the model: send the sent date too.`,
           `The answer has <code>"currency": "USD"</code>, and the email says USD 99.90.`] }
  ];
  function byHand({ el, done, kit }) {
    ensureStyle();
    const ans = BYHAND.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Read the first answers</h1>
        <p class="lead">In your first hour you wrote a short prompt and ran it on a few emails. A small hosted model answered. The prompt:</p>
        <div class="lx-${ID}-ans">${kit.esc(V1_PROMPT)}</div>
        <p class="task">For each email, find what is wrong with the answer under it, using the brief's rules.</p>
        ${BYHAND.map((q, i) => `<div class="lcase" id="c${i}">${mailCard(kit, q.id)}${ask(kit, q.opts, q.right, ans[i], q.fb)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (BYHAND.every((q, j) => ans[j] === q.right)) done();
      }));
    };
    paint();
  }

  /* 3. Spot the idea: three fixed answers are not a measurement. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Yes: the three answers that were wrong are now right",
      "Not yet: run both prompts on the same set of emails you labelled, and count right fields for each",
      "Not yet: you need a fine-tuned model to compare against",
      "Yes, if you ran it with temperature 0"
    ];
    const RIGHT = 1;
    const fb = [
      `You wrote the new rules while looking at exactly those three emails, so they were always going to pass. A rule that fixes one email can break another one you did not look at. Three emails you picked is a demo, not a measurement.`,
      `Right. Before you change anything, label a small set of emails by hand (the correct JSON for each), and write a small script that counts how many fields each prompt gets right on that set. Then “better” means a number that went up on the same emails. This small labelled set is your <b>evaluation set</b>. It is the first thing to build, because every later choice and the README's result depend on it.`,
      `A fine-tuned model is another thing to measure, not the measure. You still need labelled emails to know whether either one is right.`,
      `Temperature 0 makes answers repeat more, which helps you compare runs. It does not tell you whether the answers are right. Only comparing with known correct answers does that.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Is the new prompt better?</h1>
        <p class="lead">You rewrite the prompt. Now each message also says the date the email was sent. The instructions now include the brief's rules, for example: “${kit.esc(V2_RULE_DATE)}” and “${kit.esc(V2_RULE_AMOUNT)}” You run it on e06, e08 and e09 again, and all three answers are now right.</p>
        <p class="task">Can your README say “the second prompt is better”?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Plan the four hours: move half-hour blocks between tasks. */
  const BUCKETS = [
    { k: "label", name: "Label 10 emails by hand (the evaluation set)", start: 0 },
    { k: "base", name: "First prompt, run it on all 10", start: 2 },
    { k: "score", name: "Scoring script", start: 0 },
    { k: "improve", name: "Improve the prompt from the errors", start: 1 },
    { k: "readme", name: "README: result, choices, what next", start: 0 },
    { k: "ft", name: "Fine-tune a model", start: 3 },
    { k: "demo", name: "A web page to paste emails into", start: 2 }
  ];
  const RULES = [
    [p => p.ft > 0, "Fine-tuning is still in the plan. There are no labelled emails to train on, and the hours go into training before you have a single number. Take those blocks out."],
    [p => p.label === 0, "Nothing is labelled. Without emails whose correct JSON you wrote yourself, the scoring script has nothing to compare with, and the README cannot say how good the result is."],
    [p => p.score === 0, "No time for the scoring script. Labels alone do not give you a number: something has to compare each answer with them and count. Without it, “better” is a feeling."],
    [p => p.readme === 0, "No time for the README. The brief asks for it by name, and it is the first thing the reviewers read: your result, your choices and what you skipped all live there."],
    [p => p.demo > 0, "The web page is still in. The brief does not ask for one, and it measures nothing. Reviewers judge the result and how you measured it; a page is time taken from that."],
    [p => p.base === 0, "There is no first prompt. Improving the prompt needs a first version and its score to improve on."]
  ];
  function budget({ el, done, kit }) {
    ensureStyle();
    const plan = Object.fromEntries(BUCKETS.map(b => [b.k, b.start]));
    let verdict = null; // null, or [html, ok]
    const used = () => sum(Object.values(plan));
    const paint = () => {
      const u = used();
      let t = 0;
      const timeline = BUCKETS.filter(b => plan[b.k] > 0).map(b => { const a = t; t += plan[b.k] * BLOCK_MIN; return `<li>${hm(a)}–${hm(t)} ${kit.esc(b.name)}</li>`; }).join("");
      el.innerHTML = `<h1>Plan the four hours</h1>
        <p class="lead">You have ${BLOCKS} blocks of ${BLOCK_MIN} minutes. This is the plan many people start with: it builds the impressive parts first.</p>
        <p class="task">Change the plan so it gives the brief what it asks for, then check it. Tap − to take ${BLOCK_MIN} minutes from a task and + to give them to another. When all ${BLOCKS} blocks are used, take one out before you add one.</p>
        <div class="lx-${ID}-bud">${BUCKETS.map(b => `<div class="lx-${ID}-row" data-b="${b.k}"><span>${kit.esc(b.name)}</span><div class="lx-${ID}-ctl">
          <button type="button" data-d="-1" aria-label="Less time for ${kit.esc(b.name)}" ${plan[b.k] === 0 ? "disabled" : ""}>−</button>
          <b>${hm(plan[b.k] * BLOCK_MIN)}</b>
          <button type="button" data-d="1" aria-label="More time for ${kit.esc(b.name)}" ${u >= BLOCKS ? "disabled" : ""}>+</button></div></div>`).join("")}</div>
        <p class="lx-${ID}-total">planned ${hm(u * BLOCK_MIN)} of ${hm(BLOCKS * BLOCK_MIN)}</p>
        <div class="lpanel"><button type="button" class="btn lx-${ID}-check" data-check>Check the plan</button>
        ${verdict ? kit.feedback(verdict[0] + (verdict[1] ? `<ul class="lx-${ID}-plan">${timeline}</ul>` : ""), verdict[1]) : ""}</div>`;
      el.querySelectorAll("[data-d]").forEach(b => b.onclick = () => {
        const k = b.closest("[data-b]").dataset.b;
        plan[k] = Math.max(0, plan[k] + +b.dataset.d);
        verdict = null; paint();
      });
      el.querySelector("[data-check]").onclick = () => {
        const bad = RULES.find(([f]) => f(plan));
        if (bad) { verdict = [bad[1], false]; paint(); return; }
        const spare = BLOCKS - used();
        verdict = [`This plan fits. The evaluation set and the scorer come early, so every change after them is measured, and the README has its own time instead of whatever is left.${spare ? ` You left ${hm(spare * BLOCK_MIN)} unplanned; finishing early is fine.` : ""} Your plan, hour by hour:`, true];
        paint(); done();
      };
    };
    paint();
  }

  /* 5. Use it, with predictions: score both prompts on the ten labelled emails. */
  function predictScores({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null;
    const worst1 = FIELDS.reduce((a, f) => S1[f] < S1[a] ? f : a, FIELDS[0]);
    const gain = f => S2[f] - S1[f];
    const most = FIELDS.reduce((a, f) => gain(f) > gain(a) ? f : a, FIELDS[0]);
    const textAmounts = IDS.filter(id => typeof P1[id].amount === "string");
    const isoDates = IDS.filter(id => /^\d{4}-\d{2}-\d{2}$/.test(P1[id].delivery_date));
    const fb1 = {
      amount: `Amount was right in ${S1.amount} of ${N}. ${textAmounts.length} answers wrote the amount as text, like ${kit.esc(V1[textAmounts[0]].match(/"amount": ("[^"]*")/)[1])}. The brief asks for a number, and text never equals your number label. Still, another field did worse.`,
      currency: `Currency was right in ${S1.currency} of ${N}: most emails say USD, EUR or KRW in plain letters. Only the € and $ signs missed. Another field did worse.`
    };
    const fb2 = {
      amount: `Amount does gain (${S1.amount} → ${S2.amount}), mostly because the rules said “a number” and “the order total”. But one field started much lower.`,
      currency: `Currency was already ${S1.currency} of ${N}. There was little left to gain. Look at which field started lowest.`
    };
    const table = s => kit.table(FIELDS.map(f => [NICE[f], s ? `${S1[f]} → ${S2[f]}` : `${S1[f]}`]), { head: ["field", s ? "v1 → v2" : "v1"], title: `Fields right, out of ${N} labelled emails` });
    const paint = () => {
      const q = stage === 0 ? "Which field did the first prompt (v1) get right least often?" : stage === 1 ? "The second prompt (v2) adds the sent date and the rules. Which field gains the most?" : "";
      const right = stage === 0 ? worst1 : most;
      el.innerHTML = `<h1>Score both prompts</h1>
        <p class="lead">You labelled 10 emails by hand and ran both prompts on all 10, with the same settings. A field counts as right only when it equals your label exactly: the same text, or the same number.</p>
        ${stage >= 1 ? table(stage >= 2) : ""}
        ${q ? `<p class="task">${q}</p>` : ""}
        <div class="lpanel">${stage < 2 ? kit.options(FIELDS.map(f => NICE[f]), { picked: wrong == null ? null : FIELDS.indexOf(wrong), correct: FIELDS.indexOf(right) }) : ""}
        ${wrong ? kit.feedback((stage === 0 ? fb1 : fb2)[wrong], false) : ""}
        ${stage === 1 && !wrong ? kit.feedback(`Right: the delivery date, ${S1.delivery_date} of ${N}. Only ${plural(isoDates.length, "answer")} used the brief's YYYY-MM-DD form, and one of those had the wrong year; the others wrote things like “18 November”, “Thursday” or “tomorrow morning”. That came from the prompt, which never asked for a format or gave the sent date.`, true) : ""}
        ${stage === 2 ? kit.feedback(`Right. The delivery date went from ${S1.delivery_date} to ${S2.delivery_date} of ${N}. In all, v1 had ${sum(Object.values(S1))} of ${N * FIELDS.length} fields right and v2 had ${sum(Object.values(S2))}. This is a number you can put in the README, with the set and the rule that produced it. Keep it in mind: you will be asked what it really proves.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const f = FIELDS[+b.dataset.i];
        if (f !== right) { wrong = f; paint(); return; }
        wrong = null; stage++; paint();
        if (stage === 2) done();
      });
    };
    paint();
  }

  /* 6. The scorer from scratch, as a stepped replay of the real run. */
  const FR = TRACE.map(([ln, ev, id, field, hits]) => ({ ln, ret: ev === "r", id, field, hits }));
  const isQ = i => FR[i].ln === 5 && FR[i].id === "e01";
  const missesOf = id => FIELDS.filter(f => P1[id][f] !== GOLD[id][f]);
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, wrong = null;
    const answered = new Set();
    const say = f => {
      const h = f.hits ? `date ${f.hits[0]}, amount ${f.hits[1]}, currency ${f.hits[2]}` : "";
      if (f.ret) return `<code>return hits</code> gives back the counts: ${h}. All ${N} emails took ${TRACE_STEPS} traced steps. The same function scored v2 with no change.`;
      if (f.ln === 1) return `The function got two dicts keyed by email id: <code>predictions</code>, the parsed model answers, and <code>gold</code>, your labels (“gold” is the usual name for the correct answers). A Python dict is like a JS object. First it sets up <code>hits</code>.`;
      if (f.ln === 2 && !f.id) return `<code>hits</code> starts at zero for each field. Next, the loop over the emails.`;
      if (f.ln === 3) return `Email <code>${f.id}</code>: <code>guess</code> is the model's answer, <code>truth</code> is your label.`;
      if (f.ln === 4 && !f.field) return `Now each field in turn.`;
      if (f.ln === 5) return `The <code>if</code> line compares the ${NICE[f.field]}: model ${kit.esc(pyv(P1.e01[f.field]))}, label ${kit.esc(pyv(GOLD.e01[f.field]))}.${f.field === FIELDS[0] ? " (<code>guess.get(field)</code> reads the field, or gives <code>None</code> if the answer left it out.)" : ""}`;
      if (f.ln === 6) return `Equal, so <code>hits[field] += 1</code> runs next and adds one.`;
      if (f.ln === 4 && f.field === FIELDS[FIELDS.length - 1]) return `No fields left for this email.${FR[FR.indexOf(f) - 1].ln === 5 ? " The <code>+= 1</code> line was skipped: not equal." : ""}`;
      if (f.ln === 4) return `Back to the next field.${FR[FR.indexOf(f) - 1].ln === 5 ? " The <code>+= 1</code> line was skipped: not equal." : ""}`;
      if (f.ln === 2 && f.id === "e01") return `Email e01 done: ${h}. From here the replay jumps one whole email per step.`;
      if (f.ln === 2) { const m = missesOf(f.id); return `Email <code>${f.id}</code> done${m.length ? `, missed: ${m.map(x => NICE[x]).join(", ")}` : ""}. Counts so far: ${h}.`; }
      return "";
    };
    const paint = () => {
      const f = FR[i];
      const q = isQ(i) && !answered.has(i);
      const eq = i + 1 < FR.length && FR[i + 1].ln === 6;
      el.innerHTML = `<h1>The scorer, from scratch</h1>
        <p class="lead">The scoring script is ${CODE.length} lines of plain Python. This replays its real run on the first prompt's ${N} answers. (Before it, a few lines strip the <code>\`\`\`json</code> fence the model put around most answers and parse the JSON.)</p>
        <p class="task">Step through. When the <code>if</code> line compares two values, predict whether they are equal.</p>
        ${kit.code(CODE, f.ln)}
        <div class="vars"><span>email_id <b>${f.id || "–"}</b></span><span>field <b>${f.field || "–"}</b></span><span>hits (date / amount / currency) <b>${f.hits ? f.hits.join(" / ") : "–"}</b></span><span>step <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(say(f))}
        ${q ? `<div class="lpanel">${kit.options(["Equal: the += 1 line runs", "Not equal: the += 1 line is skipped"], { picked: wrong, correct: eq ? 0 : 1 })}
          ${wrong != null ? kit.feedback(eq ? "They are the same text, so == is true." : (typeof P1.e01[f.field] === "string" && typeof GOLD.e01[f.field] === "number" ? "One is text and one is a number. In Python, a string never equals a float, even when they look alike." : "The two texts differ, and == compares text exactly: no guessing that they mean the same day."), false) : ""}</div>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 || q ? "disabled" : ""}>Next step</button></div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; wrong = null; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; wrong = null; paint(); if (i === FR.length - 1) done(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const k = +b.dataset.i;
        if (k === (eq ? 0 : 1)) { answered.add(i); wrong = null; } else wrong = k;
        paint();
      });
    };
    paint();
  }

  /* 7. Skip and say so: pick the items for "What I would do next". */
  const NEXT = [
    [`Label the other ${EMAILS_SENT - N} emails without looking at v2's answers, and score v2 on them`, true,
      ""],
    ["Ask the team which date they want when goods come in parts, and state the rule I assumed", true, ""],
    ["Fine-tune a model only if the prompt falls short on held-out emails and there are many labelled emails to train on, and compare both on the same held-out emails", true, ""],
    ["Add a web page to paste emails into", false,
      "The web page measures nothing and nobody asked for it. A “next” list shows what you would learn next, not features."],
    ["Write the scoring script", false,
      "The scoring script is not “next”: without it you have no result at all. It belongs inside the four hours, and it is already done."],
    ["Run the same prompt again with the same settings, hoping for a better score", false,
      `Running the same prompt with the same settings (temperature ${REC.temperature}) on the same emails mostly repeats the same answers. It costs time and teaches nothing new.`]
  ];
  const NEXT_MISS = [
    `You left out the held-out emails. v2's rules were written while reading the errors on these same ${N} emails, so its ${sum(Object.values(S2))} of ${N * FIELDS.length} is a score on emails it was tuned for. Fresh emails are the honest test.`,
    "You left out the part-delivery question. The brief's rule for it was your reading; a reviewer wants to see that you noticed the guess and would check it.",
    "You left out fine-tuning. It was the right thing to skip inside four hours, and that is exactly why it belongs here, with the condition that would make it worth doing."
  ];
  function whatNextList({ el, done, kit }) {
    ensureStyle();
    const on = NEXT.map(() => false);
    let verdict = null;
    const paint = () => {
      el.innerHTML = `<h1>What I would do next</h1>
        <p class="lead">You are writing the README. v2 scored ${S2.delivery_date}, ${S2.amount} and ${S2.currency} out of ${N} on the three fields. But you wrote v2's rules while reading v1's mistakes on those same ${N} emails, and the set is small. Emails you did not look at while writing the prompt are called <b>held-out</b> emails. The README needs a short list of what you skipped, and why.</p>
        <p class="task">Pick the items that belong in “What I would do next”, then check.</p>
        <div class="lx-${ID}-tog">${NEXT.map(([t], k) => `<button type="button" data-t="${k}" aria-pressed="${on[k]}">${kit.esc(t)}</button>`).join("")}</div>
        <div class="lpanel"><button type="button" class="btn lx-${ID}-check" data-check>Check the list</button>${verdict ? kit.feedback(verdict[0], verdict[1]) : ""}</div>`;
      el.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { const k = +b.dataset.t; on[k] = !on[k]; verdict = null; paint(); });
      el.querySelector("[data-check]").onclick = () => {
        const badPick = NEXT.findIndex(([, good], k) => on[k] && !good);
        const miss = NEXT.findIndex(([, good], k) => good && !on[k]);
        if (badPick >= 0) verdict = [NEXT[badPick][2], false];
        else if (miss >= 0) verdict = [NEXT_MISS[miss], false];
        else { verdict = [`Right. Each item names what you skipped and when it would be worth doing. Together they also tell the reviewer the honest limits of your number: ${N} emails, labelled by you, the same ones you tuned on. A README that says this plainly reads stronger than one that says “100% accurate”.`, true]; done(); }
        paint();
      };
    };
    paint();
  }

  /* 8. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Keep improving the prompt; write the README in the last ten minutes",
      "Stop changing code; write the README with the scores you have and the list of what you skipped",
      "Start fine-tuning, since the prompt is already good"
    ];
    const RIGHT = 1;
    const fb = [
      "A rushed README hides the work the reviewers grade: how you measured, what you chose, what you skipped. One more point on a 10-email set is worth less than a clear page that explains the points you have.",
      "Right. The time box is part of the task. Freeze the code, report the numbers with the set they came from, and let the “next” list carry what did not fit. If you go over, say by how much.",
      "Fine-tuning now would start a new project with half an hour left and no training data beyond your 10 labels. Put it in the “next” list with the condition that makes it worth doing."
    ];
    const paint = () => {
      el.innerHTML = `<h1>The take-home, from above</h1>
        <p class="lead"><b>For:</b> a take-home tests your judgment under a time limit, not how much you can build.</p>
        <p class="lead"><b>Reach for this plan</b> when the brief has a time box and leaves the method to you: a small labelled set and a scorer first, the simplest approach that can work, one round of fixes driven by the errors, a README that says what you skipped.</p>
        <p class="lead"><b>Not</b> when the brief names the method (follow it, still with a simple baseline to compare), or when the fields sit in fixed places (plain parsing code is exact and free).</p>
        <p class="lead"><b>Costs:</b> labelling eats the first hour and shows nothing flashy. A small set gives only a rough number. Going far over the time box makes your work hard to compare with other candidates' work.</p>
        <p class="task">Another run: it is 3:30 into your four hours. A third prompt might gain one more field, and the README is not written. What do you do?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it: which first move for three other briefs. */
  const APPROACH = ["A prompt, scored on a small set you label", "Plain parsing code, no model", "Fine-tuning, compared with a simple baseline"];
  const CASES = [
    ["Three hours: sort 200 customer support messages into five teams (billing, delivery, returns, account, other). No labels come with them.", 0,
      ["Right. Messages written by people, no labels, a short box: label about twenty yourself, prompt a model with the five team names, and score it.",
       "There is no fixed format to parse: the messages are free text, and which team gets one is a judgment about meaning. Keyword rules would miss most wordings.",
       "There are no labels to train on, and three hours. Label a small set and score a prompt first; fine-tuning goes in the “next” list."]],
    ["Two hours: every invoice is a CSV file exported by the same accounting system, with the columns total and due_date. Turn each into JSON.", 1,
      ["A model is the wrong tool here. The values already sit in named columns of a fixed format, so reading the CSV gives them exactly, for free, every time. A model would add cost, delay and a chance of copying a number wrong from data that is already structured.",
       "Right. The data is already structured: the fields are in fixed, named columns. Plain code reads them exactly and can be tested completely. A model adds cost and errors and solves no problem here. You still check the result on a few files.",
       "Nothing here needs learning: the values are in fixed columns. Training a model to copy them would be slower, dearer and less exact than reading the CSV."]],
    ["Six hours, a GPU notebook provided, 20,000 labelled product titles. The brief says: fine-tune a small model to sort them into categories, and compare it with a baseline.", 2,
      ["A prompt is a fine baseline here, but the brief names the method and gives the data and the GPU for it. Skipping the fine-tuning would skip the task.",
       "Product titles are written by people, in many forms: no fixed columns to parse. And the brief asks for a fine-tuned model.",
       "Right. The brief names the method and supplies the labels and the hardware. Hold some labelled titles out, score a simple baseline on them, fine-tune, and report both on the same held-out set."]]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Three other briefs</h1>
        <p class="lead">Each is a time-boxed take-home. Pick the first thing you would build.</p>
        <p class="task">Choose an approach for each brief. Pick again if you change your mind.</p>
        ${CASES.map(([q, r, fbs], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(APPROACH, { picked: ans[i], correct: r })}${ans[i] == null ? "" : kit.feedback(fbs[ans[i]], ans[i] === r)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, r], j) => ans[j] === r)) done();
      }));
    };
    paint();
  }

  /* 10. What next: done on entry. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can plan a take-home</h1>
      <p class="lead">You chose a prompt over fine-tuning for a brief with no labels and ${BOX_HOURS} hours, found the first prompt's mistakes by hand, saw why three fixed answers are not a measurement, planned the box around a labelled set and a scorer, stepped through that scorer, and wrote an honest “what I would do next” list.</p>
      <p class="lead"><b>Practice:</b> this lesson was the practice. For your next real take-home, write the ${BLOCKS}-block plan before you open an editor.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. It builds on the plan and the honest README you practised here.</p>` : `<p class="lead">This is the last lesson of the AI engineering path. The portfolio projects and the interview lessons of this stage are what you take into applications.</p>`}`;
    done();
  }

  /* walk for the code screen: Next through every frame, answering each prediction on the way */
  const CODE_WALK = (() => {
    const w = [];
    for (let i = 0; i < FR.length - 1; i++) { if (isQ(i)) w.push("[data-right]"); w.push("[data-next]"); }
    return w;
  })();

  LessonKit.define(ID, {
    title: "Plan a take-home task inside its time box",
    checked: "2026-11-14",
    sources: [
      "https://developers.openai.com/api/docs/guides/model-optimization",
      "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests",
      "https://openrouter.ai/docs/api/reference/parameters"
    ],
    interview: [
      {
        q: "You get a four-hour take-home: pull delivery dates and amounts out of supplier emails, and nothing is labelled. Walk me through how you spend the four hours.",
        good: [
          "Read the emails and the brief's rules, then label a small set by hand first, so there is something to measure against",
          "Write a short scoring script that counts right fields per prompt on that set",
          "Start with a prompt, not fine-tuning: no training data, and it changes in minutes",
          "Fix the prompt from the errors the scorer shows, and re-score after each change",
          "Keep real time for the README: the result, the choices, and what I skipped and why"
        ],
        weak: "Start fine-tuning or build a demo app straight away, and check the output by eye on a few emails. There is then no number to report and no time left to explain the choices."
      },
      {
        q: "Your take-home README says the prompt scored 10 out of 10. The reviewer asks what that number proves. What do you say?",
        good: [
          "It is 10 emails, labelled by me, so it is a rough number, not a guarantee",
          "I wrote the prompt's rules while reading mistakes on those same emails, so it may be tuned to them",
          "The honest test is emails I did not look at: I would label the rest and score on them",
          "I would also say how the scorer decides a field is right, for example exact match on the date text"
        ],
        weak: "Say the extractor is 100% accurate. That misses that the set is tiny and was used to tune the prompt."
      }
    ],
    screens: [theBrief, byHand, spotIdea, budget, predictScores, asCode, whatNextList, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: BYHAND.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-check]"], right: [
        ...Array(BUCKETS.find(b => b.k === "ft").start).fill('[data-b="ft"] [data-d="-1"]'),
        ...Array(BUCKETS.find(b => b.k === "demo").start).fill('[data-b="demo"] [data-d="-1"]'),
        '[data-b="label"] [data-d="1"]', '[data-b="score"] [data-d="1"]', '[data-b="readme"] [data-d="1"]',
        '[data-b="improve"] [data-d="1"]', '[data-b="readme"] [data-d="1"]', "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { right: CODE_WALK },
      { wrong: ['[data-t="3"]', "[data-check]"], right: ['[data-t="3"]', '[data-t="0"]', '[data-t="1"]', '[data-t="2"]', "[data-check]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
