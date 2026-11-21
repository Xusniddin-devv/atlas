/* Lesson: mock interview, the design method on a support bot. Story: an electronics retailer (Brightwire, made up)
   wants a chat bot that answers order and warranty questions and hands angry customers to a person.
   Ideas: (1) a design answer runs in order: requirements, data, model, serving, evaluation, cost, failures,
   because each later step is sized and judged by the earlier ones; (2) the numbers come first: daily volume,
   the busiest hour, tokens per chat; (3) the hand-off is a design decision that must be tested, not assumed.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s6-design-support-bot/
       weak-answer   a small hosted model playing a rushed candidate (request in the runs folder);
       chat-1..3     one three-turn support chat, each request carrying the conversation so far
                     (made by make_chat_requests.py and add_turn.py);
       escalate-narrow / escalate-fixed  the same angry message with two descriptions of the hand-off tool
                     (made by make_escalation_requests.py);
   - docs/ai-path/runs/s6-design-support-bot/traffic_sample.py + .out.txt: a SIMULATED day of chat starts per
     hour (seed 0), said so on screen;
   - docs/ai-path/runs/s6-design-support-bot/estimate_load.py + .out.txt: the 8-line estimate on the code
     screen, traced line by line;
   - docs/ai-path/runs/s6-design-support-bot/estimate_double.py + .out.txt: the same function on a doubled day,
     the check for the prediction on the code screen.
   Lesson-local style: a transcript block and a step list (.lx-s6-design-support-bot-*), see ensureStyle(). */
(() => {
  const ID = "s6-design-support-bot";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const fmt = n => n.toLocaleString("en");
  const round100 = n => Math.round(n / 100) * 100;
  const millions = n => (n / 1e6).toFixed(n < 1e6 ? 2 : 1);

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/recordings/s6-design-support-bot/weak-answer.json (whole answer, not altered)
  const REC_WEAK = {
    src: "s6-design-support-bot/weak-answer",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    question: "Design question: an electronics retailer wants a chat bot on its website that answers questions about orders and warranties, and hands angry customers to a person. How would you build it?",
    text: "I'd start by building a robust Natural Language Understanding (NLU) model using a transformer-based architecture like BERT or RoBERTa, fine-tuned on a dataset of customer service inquiries specific to electronics retail, orders, and warranties. For intent recognition and entity extraction, I'd leverage libraries like spaCy or Hugging Face's Transformers. The core logic would be a state-machine or a rule-based system initially, transitioning to a more sophisticated dialogue management framework like Rasa or Microsoft Bot Framework as complexity grows. For handling angry customers, sentiment analysis would be crucial, triggering a handover to a human agent via an API integration with their CRM or live chat system. The entire system would be deployed on a cloud platform like AWS or Azure for scalability."
  };
  const SENT = REC_WEAK.text.split(/(?<=\.) /); // five sentences

  // From docs/ai-path/recordings/s6-design-support-bot/chat-1..3.json (customer turns from the requests, replies
  // and usage from the responses, not altered)
  const REC_CHAT = {
    src: "s6-design-support-bot/chat-1 … chat-3",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    turns: [
      { user: "Hi, where is my order 48213? It should have been here by now.", inTok: 240, outTok: 42,
        bot: "Your order 48213 for wireless earbuds Kite 2 is currently delayed at the carrier, ParcelGo. The new estimated delivery date is 2026-11-18." },
      { user: "OK. Also my Halo 700 headphones stopped charging. Is that covered?", inTok: 301, outTok: 65,
        bot: "Yes, battery and charging faults for headphones and earbuds are covered under warranty for 12 months from delivery. Your order 47102 for the over-ear headphones Halo 700 was delivered on 2026-06-09, so it is still within the warranty period." },
      { user: "How do I send them in?", inTok: 375, outTok: 37,
        bot: "To initiate a warranty claim, please go to your Account > Orders, select the item, and press 'Warranty claim'. We will email you a prepaid return label within one working day." }
    ]
  };

  // From docs/ai-path/recordings/s6-design-support-bot/escalate-narrow.json and escalate-fixed.json
  // (tool descriptions from the requests; tool_calls from choices[0].message, names and arguments not altered)
  const ANGRY = "This is the third time I'm writing about order 48213. It is two weeks late and nobody has answered me. I want a refund today, or I will dispute the charge with my bank.";
  const TOOLS_DRAFT = [
    ["get_order", "order_id", "Get the status of one order of the signed-in customer."],
    ["search_policy", "query", "Search the shop's warranty and returns policy."],
    ["hand_to_person", "reason", "Hand the chat to a human agent. Use this only if the customer is rude or uses abusive language."]
  ];
  const HANDOFF_FIXED = "Hand the chat to a human agent. Use this when the customer is upset or angry, asks for a person, asks for a refund or threatens a chargeback, or says they have contacted us about the same problem before.";
  const REC_ESC = {
    src: "s6-design-support-bot/escalate-narrow, escalate-fixed",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    narrow: { finish: "tool_calls", calls: [["get_order", "{\"order_id\":\"48213\"}"], ["search_policy", "{\"query\":\"refund for late order\"}"]] },
    fixed: { finish: "tool_calls", calls: [["hand_to_person", "{\"reason\":\"Customer is upset about a late order (48213) and is threatening to dispute the charge.\"}"]] }
  };
  const CAPTION = `Recorded model output, ${REC_WEAK.recordedAt}`;

  // From docs/ai-path/runs/s6-design-support-bot/traffic_sample.out.txt (simulated, seed 0)
  const HOURLY = [3, 7, 1, 1, 3, 0, 11, 23, 41, 66, 80, 90, 125, 109, 100, 77, 70, 97, 162, 155, 186, 163, 95, 41];

  // estimate_load from docs/ai-path/runs/s6-design-support-bot/estimate_load.py, line for line (line 0 = def)
  const CODE = [
    "def estimate_load(hourly_chats, turns_per_chat, tokens_per_chat):",
    "    daily_chats = sum(hourly_chats)",
    "    busiest_hour = max(hourly_chats)",
    "    average_hour = daily_chats / 24",
    "    peak_ratio = busiest_hour / average_hour",
    "    calls_per_minute = busiest_hour * turns_per_chat / 60",
    "    daily_tokens = daily_chats * tokens_per_chat",
    "    return daily_chats, peak_ratio, calls_per_minute, daily_tokens"
  ];
  // Trace rows from estimate_load.out.txt: [line about to run, event, vars after the lines before it]
  const TRACE = [
    [1, "line", {}],
    [2, "line", { daily_chats: 1706 }],
    [3, "line", { daily_chats: 1706, busiest_hour: 186 }],
    [4, "line", { daily_chats: 1706, busiest_hour: 186, average_hour: 71.08333333333333 }],
    [5, "line", { daily_chats: 1706, busiest_hour: 186, average_hour: 71.08333333333333, peak_ratio: 2.616647127784291 }],
    [6, "line", { daily_chats: 1706, busiest_hour: 186, average_hour: 71.08333333333333, peak_ratio: 2.616647127784291, calls_per_minute: 9.3 }],
    [7, "line", { daily_chats: 1706, busiest_hour: 186, average_hour: 71.08333333333333, peak_ratio: 2.616647127784291, calls_per_minute: 9.3, daily_tokens: 1808360 }],
    [7, "return", { daily_chats: 1706, busiest_hour: 186, average_hour: 71.08333333333333, peak_ratio: 2.616647127784291, calls_per_minute: 9.3, daily_tokens: 1808360 }]
  ];
  // From docs/ai-path/runs/s6-design-support-bot/estimate_double.out.txt: the same function on a day with twice
  // the chats in every hour. [daily_chats, peak_ratio, calls_per_minute, daily_tokens]
  const DOUBLED = [3412, 2.616647127784291, 18.6, 3616720];

  /* ---------- Derived from the data ---------- */
  const DAILY = sum(HOURLY);
  const BUSIEST = Math.max(...HOURLY);
  const BUSIEST_AT = HOURLY.indexOf(BUSIEST);
  const AVG = DAILY / 24;
  const RATIO = BUSIEST / AVG;
  const C = REC_CHAT.turns;
  const TURNS = C.length;
  const PER_CALL = C.map(t => t.inTok + t.outTok);
  const TPC = sum(PER_CALL);
  const OUT_ONLY = sum(C.map(t => t.outTok));
  const IN_ONLY = sum(C.map(t => t.inTok));
  const DAILY_TOK = DAILY * TPC;
  const CALLS_MIN = BUSIEST * TURNS / 60;
  const hh = h => `${String(h).padStart(2, "0")}:00`;
  const STEPS = ["Requirements", "Data", "Model", "Serving", "Evaluation", "Cost", "Failures"];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-log { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 7.5em 1fr; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-txt { min-width: 0; font-size: 16px; line-height: 1.5; }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-ans { margin: 14px 0 0; padding: 0; list-style: none; counter-reset: s; border-top: 1px solid var(--line); }
      .lx-${ID}-ans li { counter-increment: s; display: grid; grid-template-columns: 2em 1fr; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-ans li::before { content: counter(s); font: 600 13px/1.9 var(--mono); color: var(--muted); }
      .lx-${ID}-steps { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 10px 0 0; padding: 0; list-style: none; font: 600 13.5px/1.6 var(--mono); color: var(--ink-2); counter-reset: k; }
      .lx-${ID}-steps li { counter-increment: k; }
      .lx-${ID}-steps li::before { content: counter(k) ". "; color: var(--muted); }
      .lx-${ID}-tools { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-tools li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-tools code { font: 600 14px var(--mono); }
      .lx-${ID}-case p { margin: 14px 0 6px; font-size: 16px; line-height: 1.5; }
      .lx-${ID}-hours { display: flex; justify-content: space-between; margin: 2px 0 0; font: 500 12.5px var(--mono); color: var(--muted); }
      .lx-${ID}-chart { display: flex; align-items: flex-end; gap: 3px; height: 110px; margin: 16px 0 0; border-bottom: 2px solid var(--ink); }
      .lx-${ID}-chart span { flex: 1; min-height: 1px; background: var(--muted); border-radius: 2px 2px 0 0; }
      .lx-${ID}-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0; margin: 12px 0 0; border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
      .lx-${ID}-grid div { padding: 4px 6px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
      .lx-${ID}-grid i { display: block; font: 500 11.5px var(--mono); font-style: normal; color: var(--muted); }
      .lx-${ID}-grid b { font: 600 15px var(--mono); color: var(--ink); }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  function log(kit, rows) {
    return `<div class="lx-${ID}-log">${rows.map(([who, html]) =>
      `<div class="lx-${ID}-row"><div class="lx-${ID}-who">${kit.esc(who)}</div><div class="lx-${ID}-txt">${html}</div></div>`).join("")}</div>`;
  }
  // 24 bars without value labels (they collide at phone width), then the counts as a 6-column grid
  function hourChart(kit) {
    const mx = Math.max(...HOURLY);
    return `<div class="lx-${ID}-chart" aria-hidden="true">${HOURLY.map(v => `<span style="height:${(v / mx * 100).toFixed(1)}%"></span>`).join("")}</div>
      <div class="lx-${ID}-hours"><span>00:00</span><span>12:00</span><span>23:00</span></div>
      <div class="lx-${ID}-grid" aria-label="chats per hour">${HOURLY.map((v, h) => `<div><i>${hh(h)}</i><b>${v}</b></div>`).join("")}</div>`;
  }
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  const cap = () => `<p class="lx-${ID}-cap">${CAPTION}</p>`;
  const ask = (kit, opts, correct, picked, fbs) =>
    `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  const stepList = () => `<ol class="lx-${ID}-steps">${STEPS.map(s => `<li>${s}</li>`).join("")}</ol>`;
  // a set of yes/no blocks with ids c0.., done when every block is right
  function blocks({ el, done, kit }, head, items, labels) {
    const ans = items.map(() => null);
    const paint = () => {
      el.innerHTML = `${head}${items.map((it, i) => `<div class="lcase lx-${ID}-case" id="c${i}"><p>${it.q}</p>${kit.options(labels, { picked: ans[i], correct: it.right })}${ans[i] == null ? "" : kit.feedback(it.fb[ans[i]], ans[i] === it.right)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (items.every((it, j) => ans[j] === it.right)) done();
      }));
    };
    paint();
  }

  /* 1. The situation: a recorded weak answer; mark the steps it skipped. */
  const SKIP = [
    { q: "<b>1. Requirements.</b> Who asks what, how many chats a day, what the bot must never do, when a person takes over.", right: 1,
      fb: ["Look for a number or a question back to the interviewer. Sentence 1 starts with “I'd start by building” a model. Nothing says how many chats, which questions, or what counts as a good answer.",
        "Right. The answer never asks or states what the bot must do, for how many people, or what must never go wrong. It starts at the model."] },
    { q: "<b>2. Data.</b> Where the bot's answers come from: the order records, the warranty policy.", right: 1,
      fb: ["Sentence 1 names a dataset of past inquiries, to train a model that recognises what customers ask. That is not where the answer lives. Where is order 48213 right now? Only the order system knows.",
        "Right. The past inquiries in sentence 1 teach the model what people ask, not the answer. The order status and the warranty rules never appear."] },
    { q: "<b>3. Model.</b> What does the understanding and the writing.", right: 0,
      fb: ["Right. Sentences 1 to 3 are all model and framework choices. It is the part the answer spends most of its words on.",
        "Sentences 1 to 3 name a model (a fine-tuned BERT or RoBERTa) and frameworks. This step is covered, maybe too early."] },
    { q: "<b>4. Serving.</b> How it runs for real users.", right: 0,
      fb: ["Covered, if thinly: sentence 5 deploys it on a cloud platform “for scalability”, without saying how much load.",
        "Sentence 5 says where it runs: a cloud platform. Thin, because there is no load to size it for, but it is there."] },
    { q: "<b>5. Evaluation.</b> How you know the answers and hand-offs are right.", right: 1,
      fb: ["No sentence says how anyone would check the bot. Nothing about test chats, a labelled set, or a number to watch.",
        "Right. Not one sentence says how you would know the bot answers correctly, or hands off the right chats."] },
    { q: "<b>6. Cost.</b> What each chat costs, and what the whole day costs.", right: 1,
      fb: ["No money, no tokens, no staff time appear anywhere. “For scalability” is not a cost.",
        "Right. Nothing about cost per chat, per day, or the people who take the hand-offs."] },
    { q: "<b>7. Failures.</b> What happens when the bot cannot or should not answer.", right: 0,
      fb: ["Right. Sentence 4 covers the one failure the brief named: angry customers go to a person. Whether its trigger works is another matter, and you will test that later.",
        "Sentence 4 handles it: sentiment analysis triggers a hand-over to a person. Covered. (Whether that trigger works is for a later screen.)"] }
  ];
  function skipped(ctx) {
    ensureStyle();
    const { kit } = ctx;
    const head = `<h1>A support bot, answered too fast</h1>
      <p class="lead">An electronics retailer wants a chat bot on its website. It should answer questions about orders and warranties, and hand angry customers to a person. In an interview, you get this as a design question. A strong answer walks seven steps in order, the same steps you would use to plan a real AI feature before building it:</p>
      ${stepList()}
      <p class="lead">We asked a small hosted model to play a nervous candidate in a hurry. It answered:</p>
      <ol class="lx-${ID}-ans">${SENT.map(s => `<li>${kit.esc(s)}</li>`).join("")}</ol>${cap()}
      <p class="task">For each step, did this answer cover it or skip it?</p>`;
    blocks(ctx, head, SKIP, ["Covered", "Skipped"]);
  }

  /* 2. Spot the idea: why the order matters. */
  function whyOrder({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "It does not matter much: what counts is that all seven steps get mentioned somewhere",
      "Requirements first, because every later step is sized and judged by what you learn there",
      "The model first, because it is the hardest part and the rest follows from it",
      "Cost first, because the interviewer cares most about money"
    ];
    const RIGHT = 1;
    const fb = [
      ["Mentioning is not enough. The weak answer picked a model trained to recognise questions, and that model cannot say where order 48213 is. Fixing that later throws away everything built on it. The order is what stops you building the wrong thing.", false],
      ["Right. Each step uses what the earlier ones found: the questions decide the data, the volume sizes serving and cost, “must match exactly” defines the evaluation. The interviewer's two facts already change the data (answers come from the order system) and the evaluation (a wrong date is a failure). That is why a strong answer opens with questions, and only then picks a model.", true],
      ["That is what the weak answer did. It chose a model before knowing that the answers live in the order system, so its choice did not fit the job. The model is chosen to fit the data and the volume, not the other way round.", false],
      ["Cost matters, but you cannot work it out yet: it needs the number of chats and the size of each chat, which come from the requirements. Cost is step 6 because it is computed from earlier steps.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why that order</h1>
        <p class="lead">After the weak answer, the interviewer adds two facts: most chats are “where is my order” and warranty questions, and every answer about an order must match the order system exactly. The candidate had already picked a model trained on past inquiries.</p>
        ${stepList()}
        <p class="task">Why does a strong answer walk the steps in this order?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. Requirements in numbers: daily volume and the busiest hour from a traffic sample. */
  function volume({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null;
    const Q = [
      { task: "About how many chats in the whole day?",
        opts: [`about ${fmt(Math.round(AVG))}`, `about ${fmt(round100(BUSIEST * 24))}`, `about ${fmt(round100(DAILY))}`], right: 2,
        fb: [`${fmt(Math.round(AVG))} is about one hour's worth on average. The day has 24 of them.`,
          `That is the busiest hour times 24, as if every hour were as busy as ${hh(BUSIEST_AT)}. The night hours are almost empty.`, null] },
      { task: "The busiest hour is how many times the average hour?",
        opts: ["1 time (the load is even)", `about ${(DAILY / BUSIEST).toFixed(1)} times`, `about ${RATIO.toFixed(1)} times`], right: 2,
        fb: ["The bars are far from even: some night hours have almost nothing, the evening has the most.",
          `${(DAILY / BUSIEST).toFixed(1)} is the whole day divided by the busiest hour. You want the busiest hour divided by the average hour (the day divided by 24).`, null] },
      { task: `Assume each chat makes ${TURNS} model calls, one per customer message (you will see one such chat next). How many model calls per minute must the bot handle in the busiest hour?`,
        opts: [`about ${(DAILY * TURNS / 1440).toFixed(1)}`, `about ${fmt(BUSIEST * TURNS)}`, `about ${CALLS_MIN.toFixed(1)}`], right: 2,
        fb: [`That is the whole day's calls spread over 1,440 minutes: the average minute. The busiest hour is about ${RATIO.toFixed(1)} times busier.`,
          `${fmt(BUSIEST * TURNS)} is calls in the whole busiest hour. Divide by 60 for a minute.`, null] }
    ];
    const paint = () => {
      const q = Q[stage];
      const fin = stage >= Q.length;
      el.innerHTML = `<h1>Requirements in numbers</h1>
        <p class="lead">Numbers turn “a support bot” into something you can size. You ask the interviewer for traffic, and get how many chats started in each hour of one day. (Ours is a simulated day made by a small script, shaped like a shop's day.)</p>
        ${hourChart(kit)}
        ${fin ? "" : `<p class="task">${q.task}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right: ${fmt(DAILY)} chats in the day, ${BUSIEST} of them in the hour from ${hh(BUSIEST_AT)}, while the average hour has ${AVG.toFixed(1)}. The busiest hour carries about ${RATIO.toFixed(1)} times the average, so about ${CALLS_MIN.toFixed(1)} model calls a minute. <b>Size for the peak, not the average</b>: a bot sized for the average is slow or down exactly when most customers are writing. Daily volume sets the bill. The peak sets serving (your provider's rate limit, or your own servers). Leave room above it, because chats do not arrive evenly within the hour.`, true)
          : `${kit.options(q.opts, { picked: wrong, correct: q.right })}${wrong == null ? "" : kit.feedback(q.fb[wrong], false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== Q[stage].right) { wrong = v; paint(); return; }
        wrong = null; stage++; paint();
        if (stage >= Q.length) done();
      });
    };
    paint();
  }

  /* 4. Tokens per chat, from a recorded chat. */
  function tokens({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null;
    const Q = [
      { task: "How many tokens did this one chat cost in total?",
        opts: [fmt(OUT_ONLY), fmt(PER_CALL[TURNS - 1]), fmt(TPC)], right: 2,
        fb: [`${OUT_ONLY} is only the bot's replies. Every call also pays for its input, and the input is the larger part.`,
          `${PER_CALL[TURNS - 1]} is the last call alone. Each of the ${TURNS} calls was paid for, and each sent everything before it again.`, null] },
      { task: `With ${fmt(DAILY)} chats a day like this one, about how many tokens a day?`,
        opts: [`about ${millions(BUSIEST * TPC)} million`, `about ${millions(DAILY_TOK)} million`, `about ${millions(DAILY * OUT_ONLY)} million`], right: 1,
        fb: [`That is one busiest hour (${BUSIEST} chats), not the day.`, null,
          `That counts only the replies (${OUT_ONLY} tokens a chat). The inputs are most of the bill.`] }
    ];
    const paint = () => {
      const fin = stage >= Q.length, q = Q[stage];
      const rows = [];
      C.forEach(t => { rows.push(["customer", kit.esc(t.user)]); rows.push(["bot", kit.esc(t.bot)]); });
      el.innerHTML = `<h1>Tokens per chat</h1>
        <p class="lead">Next number: how big is one chat? We gave a small hosted model the order record and the warranty section, and played one three-question chat. The bot makes one model call per customer message, and each call sends the whole chat so far. In the table, “in” is the tokens sent to the model and “out” is the tokens it wrote.</p>
        ${log(kit, rows)}${cap()}
        ${kit.table(C.map((t, i) => [`call ${i + 1}`, `${t.inTok} in + ${t.outTok} out`]), { head: ["call", "tokens the API reported"], title: "This chat" })}
        ${fin ? "" : `<p class="task">${q.task}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right: ${fmt(TPC)} tokens for the chat (${fmt(IN_ONLY)} in, ${OUT_ONLY} out), so about ${millions(DAILY_TOK)} million tokens a day. Inputs dominate because every call resends the chat so far, plus the order record and policy text. One chat is a thin sample: in the job you measure this from logs. Multiply by your provider's current price per token to get the day's model bill.`, true)
          : `${kit.options(q.opts, { picked: wrong, correct: q.right })}${wrong == null ? "" : kit.feedback(q.fb[wrong], false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== Q[stage].right) { wrong = v; paint(); return; }
        wrong = null; stage++; paint();
        if (stage >= Q.length) done();
      });
    };
    paint();
  }

  /* 5. The estimate as Python: a stepped replay of the traced run. */
  const NAMES = ["daily_chats", "busiest_hour", "average_hour", "peak_ratio", "calls_per_minute", "daily_tokens"];
  const show = v => (typeof v === "number" && !Number.isInteger(v) ? v.toFixed(2) : fmt(v));
  const SAY = [
    `The function gets the ${HOURLY.length} hourly counts, ${TURNS} turns per chat and ${fmt(TPC)} tokens per chat. The last two come from the recorded chat.`,
    "Daily volume: the sum of the hours. This is the number the monthly bill grows with.",
    "The busiest hour: the tallest bar.",
    "The average hour: the day spread evenly over 24 hours.",
    "How much busier the peak is than the average. Plan capacity for this, not for the average.",
    `Model calls per minute at the peak: each chat makes ${TURNS} calls. This is what serving must handle: your provider's rate limit, or your own servers. It ignores bursts inside the hour, so leave room above it.`,
    "Tokens per day: chats times tokens per chat. Times the price per token, this is the daily model bill.",
    "The four numbers that size serving and cost. You had them before choosing anything."
  ];
  const RET = ["daily_chats", "peak_ratio", "calls_per_minute", "daily_tokens"];
  const PRED_RIGHT = 1;
  const PRED_FB = [
    "daily_chats is a plain sum of the hours. Twice the chats in every hour gives twice the sum.",
    null,
    "calls_per_minute grows with busiest_hour. Twice the chats in every hour means twice the chats in the busiest hour, so twice the calls.",
    "daily_tokens is daily_chats times tokens per chat. Twice the chats, twice the tokens."
  ];
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, pick = null;
    const end = TRACE.length - 1;
    const check = () => { if (i === end && pick === PRED_RIGHT) done(); };
    const paint = () => {
      const [ln, ev, vars] = TRACE[i];
      const shownLine = ev === "return" ? 7 : i === 0 ? 0 : ln - 1;
      const vs = NAMES.filter(n => n in vars).map(n => `<span>${n} <b>${show(vars[n])}</b></span>`).join("");
      const ok = pick === PRED_RIGHT;
      const fb = pick == null ? "" : !ok ? kit.feedback(PRED_FB[pick], false)
        : i < end ? kit.feedback("Your prediction is in. Step to the end to see why.")
        : kit.feedback(`Right. peak_ratio is the busiest hour over the average hour; doubling every hour doubles both, and the ratio stays ${RATIO.toFixed(1)}. We ran the same function on the doubled day: ${fmt(DOUBLED[0])} chats, peak ratio ${DOUBLED[1].toFixed(1)}, ${DOUBLED[2]} calls a minute, ${millions(DOUBLED[3])} million tokens. Growth moves the bill and the serving size; the ratio only changes when the shape of the day changes.`, true);
      el.innerHTML = `<h1>The estimate, written in Python</h1>
        <p class="lead">The same arithmetic as a function you could keep next to the design. This replays a real run on the day's counts.</p>
        <p class="task">Next year the shop expects twice as many chats in every hour. Predict which returned number stays the same, then step to the end.</p>
        ${kit.code(CODE, shownLine)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === end ? "disabled" : ""}>Next step</button></div>
        <div class="vars">${vs || "<span>no variables yet</span>"}<span>frame <b>${i + 1} / ${TRACE.length}</b></span></div>
        ${kit.feedback(SAY[i])}
        <div class="lpanel">${kit.options(RET.map(n => `<code>${n}</code>`), { picked: pick, correct: PRED_RIGHT })}${fb}</div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); check(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); check(); });
    };
    paint();
  }

  /* 6. Data and model: where each answer comes from. */
  const SOURCES = ["Look it up live: a tool call to the order system", "Retrieve it: search the policy text and put the section in the prompt", "Train it in: fine-tune a model on past chats"];
  const DATA = [
    { q: `A customer asks: “Where is my order 48213?”`, right: 0,
      fb: ["Right. The status changes every hour, and only the order system has it. In the recorded chat, the website looked up the signed-in customer's orders and put the record in the prompt.",
        "Search finds text that does not change often. An order's status changes every hour and belongs to one customer: you need the live record, not a document about orders.",
        "A fine-tuned model knows what was true in its training data. Order 48213 did not exist then, and its status changes every hour. It would invent a date that sounds right."] },
    { q: "A customer asks: “Are charging faults covered on my headphones?”", right: 1,
      fb: ["The order system knows when the headphones were delivered, which helps, but not the warranty rules. The rules live in the policy text.",
        "Right. The rules sit in a policy document that changes now and then. Retrieve the right section and the model answers from it, as in the recorded chat. When the policy changes, you update a document, not a model.",
        "Fine-tuning bakes the policy into the weights. When the policy changes, the model is wrong until you train again, and you cannot show which rule it used. Retrieval keeps the text current and quotable."] }
  ];
  function dataModel(ctx) {
    ensureStyle();
    const head = `<h1>Data first, then the model</h1>
      <p class="lead">Steps 2 and 3. For each kind of question, decide where the answer comes from. Then the model choice follows. The model only has to read a record or a policy section and write a short reply. A small hosted model did that in the recorded chat.</p>
      <p class="task">Where should each answer come from?</p>`;
    blocks(ctx, head, DATA, SOURCES);
  }

  /* 7. Broken on purpose: the angry customer the bot did not hand off. */
  function broken({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null;
    const N = REC_ESC.narrow, F = REC_ESC.fixed;
    const Q = [
      { task: "Why did the bot not hand this customer to a person?",
        opts: ["The model is too small to notice that someone is angry",
          "The hand-off tool's description allows it only for rude or abusive customers; this one is angry but polite",
          "Temperature 0 stops the model from choosing tools",
          "The bot should not have the order and policy tools at all"], right: 1,
        fb: ["Maybe, but check what it was told first. Its instructions say: hand off <i>only</i> if the customer is rude or abusive. This customer is neither. Fix the instructions before you blame the model.", null,
          `Temperature 0 makes the model pick its most likely move. It did choose tools: ${N.calls.length} of them. It just did not choose the hand-off.`,
          "Those tools answer every normal chat, and the order lookup is useful to the person who takes over. They are not why the hand-off was skipped."] },
      { task: "Which fix do you put in the design?",
        opts: ["Use a bigger model for every chat",
          "Remove the other tools, so the model can only hand off",
          "Describe the real hand-off signals in the tool, and also hand off in code when your system can see a signal (a third contact about the same order, a chargeback threat)"], right: 2,
        fb: [`A bigger model costs more on every one of the ${fmt(DAILY)} daily chats, and its instructions would still say “only if rude”.`,
          "Then every chat goes to a person, and the bot answers nothing. The hand-off must be one choice among several.", null] }
    ];
    const tools = `<ul class="lx-${ID}-tools">${TOOLS_DRAFT.map(([n, a, d]) => `<li><code>${kit.esc(n)}(${kit.esc(a)})</code> ${kit.esc(d)}</li>`).join("")}</ul>`;
    const paint = () => {
      const fin = stage >= Q.length, q = Q[stage];
      el.innerHTML = `<h1>The angry customer who stayed with the bot</h1>
        <p class="lead">Step 7, failures. The draft design gives the model three tools:</p>${tools}
        <p class="lead">A message arrives. A small hosted model, with these tools and temperature 0, did not write a reply. It asked for tools to be run: the API marked the answer <code>finish_reason</code> <code>"${N.finish}"</code>. (Other APIs use other field names for the same thing.)</p>
        ${log(kit, [["customer", kit.esc(ANGRY)], ...N.calls.map(c => ["model asks", mono(kit, `${c[0]} ${c[1]}`)])])}${cap()}
        ${fin ? "" : `<p class="task">${q.task}</p>`}
        <div class="lpanel">${fin ? kit.feedback(`Right. We changed only the hand-off tool's description to: “${kit.esc(HANDOFF_FIXED)}” Same model, same message:${log(kit, F.calls.map(c => ["model asks", mono(kit, `${c[0]} ${c[1]}`)]))}${cap()}One run each proves little. The model's judgement can still miss, which is why the design also hands off in code on signals the system can count, and why the next screen measures missed hand-offs on many chats.`, true)
          : `${kit.options(q.opts, { picked: wrong, correct: q.right })}${wrong == null ? "" : kit.feedback(q.fb[wrong], false)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = +b.dataset.i;
        if (v !== Q[stage].right) { wrong = v; paint(); return; }
        wrong = null; stage++; paint();
        if (stage >= Q.length) done();
      });
    };
    paint();
  }

  /* 8. Evaluation: which number catches that bug. */
  function evaluate({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Deflection rate: the share of chats the bot finished without a person",
      "Accuracy over all chats: hand-off decisions that were right",
      "Missed hand-offs: of the chats that should have gone to a person, the share that did not",
      "Average reply length"
    ];
    const RIGHT = 2;
    const fb = [
      ["That number goes <b>up</b> when the bot fails to hand off. The bug you just found would look like success. Watch it, but never alone.", false],
      ["Most chats need no hand-off, so a bot that never hands anyone off still scores well on accuracy. The rare angry chats barely move it.", false],
      [`Right. It counts exactly the failure you found: an angry customer left with the bot. Anthropic's support-bot guide tracks the same thing: chats that should have been escalated but were not. Build the test set from real chats labelled by the support team, run every prompt change against it, and watch it after launch too. For the warranty answers, measure retrieval separately (is the right policy section in the top results, recall@k) and check that answers follow it.`, true],
      ["Length says nothing about whether the customer reached a person. Short or long, the angry customer in the recording stayed with the bot.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Evaluation: catch it before customers do</h1>
        <p class="lead">Step 5, evaluation. The support team labels a few hundred past chats: should this one have gone to a person, yes or no. You run the bot on all of them.</p>
        <p class="task">Which number would have caught the bug on the last screen?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. The big picture. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The model's tokens per chat", "Keeping the retrieved policy text and the test chats up to date", "Serving capacity at the evening peak"];
    const RIGHT = 1;
    const fb = [
      ["Tokens grow with chats and chat length. A policy change does not make chats longer.", false],
      ["Right. Every change means updating the policy documents the bot retrieves from, and the labelled test chats whose right answers just changed. If nobody owns that, the bot quotes last month's rules politely and confidently.", true],
      ["The peak depends on when customers write, not on how often the policy changes.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When a support bot pays off</h1>
        <p class="lead"><b>What it is for:</b> many repeated questions whose answers sit in records and documents, at all hours.</p>
        <p class="lead"><b>Reach for it</b> when volume is high and most chats look alike. <b>Not</b> when one page or button answers it (a tracking link), when every case needs a person's judgement or authority (refund exceptions), or when volume is too low to pay back the cost of building it.</p>
        <p class="lead"><b>Costs:</b> tokens on every chat, documents and test sets to keep current, people for the hand-offs, monitoring.</p>
        <p class="lead"><b>The method</b> fits any open design question; when asked about one part, go deep there instead.</p>
        <p class="task">The shop changes its warranty rules every month. Which cost bites first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 10. Recognise: bot or not. */
  const CASES = [
    { q: "A phone carrier gets thousands of questions a day about plans and roaming, answered in a long policy, plus “why is my bill higher” questions that need the customer's account.", right: 0,
      fb: ["Yes. High volume, repeated questions, answers in a policy (retrieve it) and in the account (look it up), and a person for disputes.",
        "This is the shape a bot fits: many similar questions whose answers sit in a policy and an account system. Retrieve one, look up the other, hand disputes to a person."] },
    { q: "A furniture shop: nearly every chat is “when does my sofa arrive?”, and the answer is one date in the delivery system.", right: 1,
      fb: ["A bot works, but it is the wrong build. One question with one answer from one field: a delivery page that shows the date answers it exactly, for free, with no model to word the date wrongly.",
        "Right. There is nothing to understand or write: one lookup, one date. A tracking page does it exactly and costs no tokens. A bot adds cost and a chance to state the date wrongly."] },
    { q: "A small architecture firm gets about five client emails a week, each about a different building project and contract.", right: 1,
      fb: ["The questions are few and all different, and each needs the project lead's judgement. There is not enough volume to pay back the build, the documents, the test set and the monitoring.",
        "Right. Five unlike emails a week will never pay back the build, and each needs a person who knows the project anyway."] },
    { q: "An online course platform gets hundreds of daily questions about deadlines, certificates and refunds, written in its help pages, from students in many time zones.", right: 0,
      fb: ["Yes. Repeated questions, answers in help pages, round-the-clock demand. Refund requests are the hand-off to a person.",
        "This fits: many similar questions at all hours, with answers in documents. Hand refund requests to a person, as with the angry customer."] }
  ];
  function recognise(ctx) {
    ensureStyle();
    const head = `<h1>Bot or not?</h1>
      <p class="lead">Four other businesses ask for a support bot.</p>
      <p class="task">Is an LLM support bot the right build for each? Pick again if you change your mind.</p>`;
    blocks(ctx, head, CASES, ["Build the bot", "Something else"]);
  }

  /* 11. What next. */
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can run the method</h1>
      <p class="lead">You marked the steps a fast answer skipped, turned a day of traffic into ${fmt(DAILY)} chats with a peak about ${RATIO.toFixed(1)} times the average, measured ${fmt(TPC)} tokens in one chat, chose live lookups for orders and retrieval for policy, found why an angry customer stayed with the bot, and picked the number that catches it.</p>
      ${stepList()}
      <p class="lead"><b>Practice:</b> this lesson was the practice. Say the seven steps out loud for the support bot, with your numbers, in about five minutes.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The same seven steps, with a new hard part: who is allowed to see which document.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Mock interview: method and a support bot",
    checked: "2026-11-14",
    sources: [
      "https://platform.claude.com/docs/en/about-claude/use-case-guides/customer-support-chat",
      "https://openrouter.ai/docs/guides/features/tool-calling",
      "https://openrouter.ai/docs/api/reference/overview"
    ],
    interview: [
      {
        q: "Design a support bot for an electronics retailer that answers order and warranty questions and hands angry customers to a person. Walk me through it.",
        good: [
          "Start with requirements: which questions, how many chats a day, the busiest hour, what must never go wrong",
          "Orders come from a live lookup in the order system; warranty rules from retrieving the policy text",
          "Size it: chats a day times tokens per chat for the bill, the peak hour times calls per chat for serving",
          "Hand-off by the model and by code rules (repeat contact, chargeback threat), with a fallback to a person when the bot fails",
          "Evaluate on labelled real chats: missed hand-offs, retrieval recall@k, answers that follow the record"
        ],
        weak: "Name a model and a cloud platform first, then add sentiment analysis for angry users, without numbers, data sources or a way to test it."
      },
      {
        q: "After launch the bot's deflection rate went up, and so did complaints. What do you suspect and how do you check?",
        good: [
          "Deflection rewards keeping chats away from people, so missed hand-offs push it up",
          "Measure missed hand-offs on a labelled sample of recent chats",
          "Read chats that ended without a hand-off but had a complaint: what did the bot do instead",
          "Check the hand-off instructions and code rules against the real signals customers show"
        ],
        weak: "Celebrate the higher deflection, or tweak the prompt's tone, without checking which chats should have reached a person."
      }
    ],
    screens: [skipped, whyOrder, volume, tokens, asCode, dataModel, broken, evaluate, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: SKIP.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] }, // three stages
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: [...Array(TRACE.length - 1).fill("[data-next]"), "[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: DATA.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
