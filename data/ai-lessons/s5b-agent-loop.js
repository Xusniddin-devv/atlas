/* Lesson: the agent loop. Story: a plumbing company's scheduling assistant finds out why a customer's boiler
   repair visit slipped by a week. Ideas: (1) the loop "ask the model, run the tool it asks for, send the result
   back, repeat" ends when the model answers without a tool call, and the model (not the program) decides the
   path from what each result says; (2) a hard step limit is the exit the program controls.
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5b-agent-loop/trace-1..4 (Dana's question, four model
     calls) and typo-1..2 (the same question with a misspelled name), made by
     docs/ai-path/runs/s5b-agent-loop/record_trace.py, whose tool results come from office_tools.py;
   - docs/ai-path/runs/s5b-agent-loop/replay_loop.py + replay_loop.out.txt: the 11-line loop shown on the code
     screen, traced line by line while replaying the four recorded replies (max_steps 8, then 3).
   Lesson-local style: a small transcript block (.lx-s5b-agent-loop-*), see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s5b-agent-loop";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s5b-agent-loop/office_tools.py (TOOL_SCHEMAS, SYSTEM, CUSTOMER_MESSAGE)
  const TOOLS = [
    ["find_customer", "name", "Find customers whose name contains the given text."],
    ["list_visits", "customer_id, e.g. C-1234", "List all visits booked for one customer, with status and dates."],
    ["get_visit_log", "visit_id, e.g. V-1234", "Get the change log of one visit: who changed what and why."],
    ["get_part_order", "order_id, e.g. PO-1234", "Get the status of one part order."],
    ["get_technician_schedule", "technician, date", "List one technician's visits on one date."]
  ];
  const DANA = "Hi, this is Dana Whitfield. My boiler repair was booked for Tuesday 11 November and now your app says 18 November. Why did it move?";
  const DANA_TYPO = "Hi, Dana Whitfeld here. My boiler repair was booked for Tuesday 11 November and now your app says 18 November. Why did it move?";
  const MAX_STEPS_RECORDED = 8; // record_trace.py default MAX_STEPS, used for Dana's run. The typo run's limit is
  // not in record_typo.out.txt (the docstring says --max-steps 6), so the lesson never states it.
  const RULE = "Use the tools to look things up; never guess a date or a reason."; // office_tools.py SYSTEM

  // From docs/ai-path/recordings/s5b-agent-loop/trace-1..4.json (tool calls and text not altered; results
  // are what office_tools.py returned, printed in docs/ai-path/runs/s5b-agent-loop/record_trace.out.txt)
  const REC_TRACE = {
    src: "s5b-agent-loop/trace-1 … trace-4",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    turns: [
      { sent: 2, finish: "tool_calls", promptTokens: 381, outTokens: 17, call: ["find_customer", "{\"name\":\"Dana Whitfield\"}"],
        result: "[{\"customer_id\": \"C-2093\", \"name\": \"Dana Whitfield\", \"address\": \"12 Larch Road\"}]" },
      { sent: 4, finish: "tool_calls", promptTokens: 443, outTokens: 22, call: ["list_visits", "{\"customer_id\":\"C-2093\"}"],
        result: "[{\"visit_id\": \"V-5512\", \"job\": \"Boiler repair: no hot water\", \"status\": \"rescheduled\", \"booked_for\": \"2026-11-11\", \"now_for\": \"2026-11-18\", \"technician\": \"Sam Ortiz\"}, {\"visit_id\": \"V-4870\", \"job\": \"Annual boiler service\", \"status\": \"done\", \"booked_for\": \"2026-03-02\", \"now_for\": \"2026-03-02\", \"technician\": \"Priya Nair\"}]" },
      { sent: 6, finish: "tool_calls", promptTokens: 623, outTokens: 24, call: ["get_visit_log", "{\"visit_id\":\"V-5512\"}"],
        result: "[{\"at\": \"2026-11-03 09:12\", \"by\": \"phone booking\", \"event\": \"booked for 2026-11-11\"}, {\"at\": \"2026-11-05 16:30\", \"by\": \"Sam Ortiz\", \"event\": \"remote check: diverter valve faulty, part needed\"}, {\"at\": \"2026-11-06 15:40\", \"by\": \"dispatch\", \"event\": \"moved to 2026-11-18\", \"note\": \"waiting for part, see order PO-7781\"}]" },
      { sent: 8, finish: "stop", promptTokens: 814, outTokens: 52, call: null,
        text: "The original boiler repair appointment was for November 11th. It was rescheduled to November 18th because the technician, Sam Ortiz, determined a part was needed. The change was made on November 6th while waiting for the part to arrive." }
    ]
  };
  // From docs/ai-path/recordings/s5b-agent-loop/typo-1..2.json
  const REC_TYPO = {
    src: "s5b-agent-loop/typo-1 … typo-2",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    turns: [
      { call: ["find_customer", "{\"name\":\"Dana Whitfeld\"}"], result: "{\"error\": \"no customer matches Dana Whitfeld\"}" },
      { call: null, text: "I can't find a customer named Dana Whitfeld. Can you please confirm the name and I'll look for your boiler repair details?" }
    ]
  };
  const CAPTION = `Recorded model output, ${REC_TRACE.recordedAt}`;

  // The listing is run_agent from docs/ai-path/runs/s5b-agent-loop/replay_loop.py, line for line (line 0 = def).
  const CODE = [
    "def run_agent(customer_message, max_steps):",
    "    messages = [SYSTEM_MSG, {\"role\": \"user\", \"content\": customer_message}]",
    "    for step in range(1, max_steps + 1):",
    "        reply = call_model(messages, TOOL_SCHEMAS)",
    "        messages.append(reply)",
    "        if not reply.get(\"tool_calls\"):",
    "            return reply[\"content\"]",
    "        for call in reply[\"tool_calls\"]:",
    "            result = run_tool(call[\"function\"])",
    "            messages.append(tool_message(call[\"id\"], result))",
    "    return \"Stopped: step limit reached\""
  ];
  // Trace rows from replay_loop.out.txt: [line about to run, event (l = line, r = return), step, len(messages), reply, call]
  const TRACE8 = [[1,"l",null,null,null,null],[2,"l",null,2,null,null],[3,"l",1,2,null,null],[4,"l",1,2,"tool_calls: find_customer",null],[5,"l",1,3,"tool_calls: find_customer",null],[7,"l",1,3,"tool_calls: find_customer",null],[8,"l",1,3,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[9,"l",1,3,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[7,"l",1,4,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[2,"l",1,4,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[3,"l",2,4,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[4,"l",2,4,"tool_calls: list_visits","find_customer {\"name\":\"Dana Whitfield\"}"],[5,"l",2,5,"tool_calls: list_visits","find_customer {\"name\":\"Dana Whitfield\"}"],[7,"l",2,5,"tool_calls: list_visits","find_customer {\"name\":\"Dana Whitfield\"}"],[8,"l",2,5,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[9,"l",2,5,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[7,"l",2,6,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[2,"l",2,6,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[3,"l",3,6,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[4,"l",3,6,"tool_calls: get_visit_log","list_visits {\"customer_id\":\"C-2093\"}"],[5,"l",3,7,"tool_calls: get_visit_log","list_visits {\"customer_id\":\"C-2093\"}"],[7,"l",3,7,"tool_calls: get_visit_log","list_visits {\"customer_id\":\"C-2093\"}"],[8,"l",3,7,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[9,"l",3,7,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[7,"l",3,8,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[2,"l",3,8,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[3,"l",4,8,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[4,"l",4,8,"final text","get_visit_log {\"visit_id\":\"V-5512\"}"],[5,"l",4,9,"final text","get_visit_log {\"visit_id\":\"V-5512\"}"],[6,"l",4,9,"final text","get_visit_log {\"visit_id\":\"V-5512\"}"],[6,"r",4,9,"final text","get_visit_log {\"visit_id\":\"V-5512\"}"]];
  const TRACE3 = [[1,"l",null,null,null,null],[2,"l",null,2,null,null],[3,"l",1,2,null,null],[4,"l",1,2,"tool_calls: find_customer",null],[5,"l",1,3,"tool_calls: find_customer",null],[7,"l",1,3,"tool_calls: find_customer",null],[8,"l",1,3,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[9,"l",1,3,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[7,"l",1,4,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[2,"l",1,4,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[3,"l",2,4,"tool_calls: find_customer","find_customer {\"name\":\"Dana Whitfield\"}"],[4,"l",2,4,"tool_calls: list_visits","find_customer {\"name\":\"Dana Whitfield\"}"],[5,"l",2,5,"tool_calls: list_visits","find_customer {\"name\":\"Dana Whitfield\"}"],[7,"l",2,5,"tool_calls: list_visits","find_customer {\"name\":\"Dana Whitfield\"}"],[8,"l",2,5,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[9,"l",2,5,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[7,"l",2,6,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[2,"l",2,6,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[3,"l",3,6,"tool_calls: list_visits","list_visits {\"customer_id\":\"C-2093\"}"],[4,"l",3,6,"tool_calls: get_visit_log","list_visits {\"customer_id\":\"C-2093\"}"],[5,"l",3,7,"tool_calls: get_visit_log","list_visits {\"customer_id\":\"C-2093\"}"],[7,"l",3,7,"tool_calls: get_visit_log","list_visits {\"customer_id\":\"C-2093\"}"],[8,"l",3,7,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[9,"l",3,7,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[7,"l",3,8,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[2,"l",3,8,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[10,"l",3,8,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"],[10,"r",3,8,"tool_calls: get_visit_log","get_visit_log {\"visit_id\":\"V-5512\"}"]];
  const RETURNED3 = "Stopped: step limit reached"; // replay_loop.out.txt, max_steps=3
  const LIMIT_SHORT = 3;

  /* ---------- Derived from the data ---------- */
  const T = REC_TRACE.turns;
  const MODEL_CALLS = T.length;
  const TOOL_RUNS = T.filter(t => t.call).length;
  const PROMPT = T.map(t => t.promptTokens);
  const OUT = T.map(t => t.outTokens);
  const TYPO_CALLS = REC_TYPO.turns.length;
  const callsIn = rows => rows.filter((r, k) => k > 0 && rows[k - 1][0] === 3).length; // times line 3 (call_model) ran
  const lastMsgs = rows => rows[rows.length - 1][3];
  const parse = s => JSON.parse(s);
  const VISITS = parse(T[1].result), LOG = parse(T[2].result);
  const REPAIR = VISITS.find(v => v.status === "rescheduled"), SERVICE = VISITS.find(v => v !== REPAIR);
  const PO = (LOG.find(e => e.note) || {}).note.match(/PO-\d+/)[0];
  const CUST = parse(T[0].result)[0];

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-log { margin: 18px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 7.5em 1fr; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-txt { min-width: 0; font-size: 16px; line-height: 1.5; }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-row.lx-${ID}-now { border-left: 3px solid var(--ink); padding-left: 10px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-tools { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-tools li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-tools code { font: 600 14px var(--mono); }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(s);
  }
  // rows: [[who, html, opts]]; opts.now marks the latest row
  function log(kit, rows, title) {
    return `<div class="lx-${ID}-log"${title ? ` aria-label="${kit.esc(title)}"` : ""}>${rows.map(([who, html, o]) =>
      `<div class="lx-${ID}-row${o && o.now ? ` lx-${ID}-now` : ""}"><div class="lx-${ID}-who">${kit.esc(who)}</div><div class="lx-${ID}-txt">${html}</div></div>`).join("")}</div>`;
  }
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  const callTxt = c => `${c[0]} ${c[1]}`;
  const callRow = (kit, c, o) => ["model asks", mono(kit, callTxt(c)), o];
  const resultRow = (kit, s, o) => ["tool result", mono(kit, s), o];
  const optCall = (kit, name, args) => `<span class="lx-${ID}-opt">${kit.esc(name + " " + args)}</span>`;
  const toolList = kit => `<ul class="lx-${ID}-tools">${TOOLS.map(([n, a, d]) => `<li><code>${kit.esc(n)}(${kit.esc(a)})</code> ${kit.esc(d)}</li>`).join("")}</ul>`;

  /* A question block that remembers a wrong pick and calls back on the right one. */
  function ask(kit, opts, correct, picked, feedbacks) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(feedbacks[picked][0], feedbacks[picked][1])}`;
  }

  /* 1. The situation, and the first move: you play the model. */
  function firstMove({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      optCall(kit, "list_visits", "{\"customer_id\":\"Dana Whitfield\"}"),
      optCall(kit, "get_visit_log", "{\"visit_id\":\"V-1234\"}"),
      optCall(kit, "find_customer", T[0].call[1]),
      "Answer now: “Your visit moved because of a scheduling change.”"
    ];
    const RIGHT = 2;
    const fb = [
      ["<code>list_visits</code> wants a customer id, like the example C-1234 in the tool list. A name is not an id, and you do not have Dana's id yet. Some other tool has to give it to you first.", false],
      ["V-1234 is only the example in the tool list, not Dana's visit. You do not know her visit id yet. Asking for a made-up id is a guess with extra steps.", false],
      [`Right, and it is also what the recorded model asked for first. The program ran the function and sent this back:${log(kit, [resultRow(kit, T[0].result, { now: true })])}One customer, id <b>${kit.esc(CUST.customer_id)}</b>. You know who she is, but not yet anything about her visit.`, true],
      ["That is a guess that sounds like an answer. Nothing you have seen says why the visit moved, and the office told the assistant never to guess a reason. Look something up first.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why did the boiler visit move?</h1>
        <p class="lead">A plumbing company's office uses an assistant to answer customers. The assistant is a language model. It cannot see the company's database. It can only <b>ask</b> the program to run one of these five back-office functions (its <b>tools</b>), and then read what comes back:</p>
        ${toolList(kit)}
        <p class="lead">The office's instructions to the assistant include: “${kit.esc(RULE)}”</p>
        <p class="lead">One question often needs several tool calls in a row. This lesson is about the loop that runs them: it is what turns a model with tools into an <b>agent</b>. A message arrives:</p>
        ${log(kit, [["customer", kit.esc(DANA)]])}
        <p class="task">You play the model. What do you ask for first?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. Turns 2 and 3: each next move depends on the result you just read. */
  function nextMoves({ el, done, kit }) {
    ensureStyle();
    let turn = 0, ans = null; // turn 0 = choosing the 2nd call, turn 1 = choosing the 3rd call, 2 = finished
    const Q = [
      { right: 1, opts: [optCall(kit, "find_customer", "{\"name\":\"Whitfield\"}"), optCall(kit, "list_visits", T[1].call[1]), optCall(kit, "get_visit_log", `{"visit_id":"${CUST.customer_id}"}`), "Answer now: “We are checking your booking.”"],
        fb: [
          [`You already have her: one match, ${kit.esc(CUST.customer_id)}. Asking again spends a whole turn and learns nothing new.`, false],
          null,
          [`${kit.esc(CUST.customer_id)} is a customer id. <code>get_visit_log</code> takes a visit id, and you only learn Dana's visit ids from <code>list_visits</code>.`, false],
          ["That answers nothing. Dana asked why her visit moved. You still have tools that can find out.", false]] },
      { right: 3, opts: [optCall(kit, "get_visit_log", `{"visit_id":"${SERVICE.visit_id}"}`), optCall(kit, "get_technician_schedule", `{"technician":"${REPAIR.technician}","date":"${REPAIR.booked_for}"}`), `Answer now: “Your repair moved from ${REPAIR.booked_for} to ${REPAIR.now_for}.”`, optCall(kit, "get_visit_log", T[2].call[1])],
        fb: [
          [`${kit.esc(SERVICE.visit_id)} is the ${kit.esc(SERVICE.job.toLowerCase())} from ${kit.esc(SERVICE.booked_for)}, status “${kit.esc(SERVICE.status)}”. Dana asks about the boiler repair: ${kit.esc(REPAIR.visit_id)}, status “${kit.esc(REPAIR.status)}”.`, false],
          [`That tells you what ${kit.esc(REPAIR.technician)} does on ${kit.esc(REPAIR.booked_for)}, not why Dana's visit left that day. A visit's change log records why it changed.`, false],
          ["True, but Dana already knows that. She asked <i>why</i>. Nothing you have read so far says why.", false], null] }
    ];
    const shown = () => {
      const rows = [callRow(kit, T[0].call), resultRow(kit, T[0].result)];
      if (turn >= 1) rows.push(callRow(kit, T[1].call), resultRow(kit, T[1].result, { now: turn === 1 }));
      if (turn >= 2) rows.push(callRow(kit, T[2].call), resultRow(kit, T[2].result, { now: true }));
      if (turn < 2) rows[rows.length - 1][2] = { now: true };
      return rows;
    };
    const paint = () => {
      const q = Q[turn];
      el.innerHTML = `<h1>Read the result, pick the next call</h1>
        <p class="lead">Each tool result goes back into the conversation, and the model picks its next move from what it now knows. The newest result is marked at the left edge.</p>
        ${turn < 2 ? `<p class="task">${turn === 0 ? "You have Dana's customer record. What do you ask for next?" : "You have her visits. What do you ask for next?"}</p>` : ""}
        ${log(kit, shown())}
        <div class="lpanel">${turn < 2 ? ask(kit, q.opts, q.right, ans, q.fb) : kit.feedback(`Right again, the same three calls the recorded model made. Look at what each one needed: the customer id came from the first result, the visit id from the second. You could not have written the third call before reading the second result. The log now says <b>why</b>: a part was needed (order ${kit.esc(PO)}).`, true)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans = +b.dataset.i;
        if (ans === Q[turn].right) { turn++; ans = null; paint(); if (turn === 2) done(); return; }
        paint();
      });
    };
    paint();
  }

  /* 3. The stop decision, then the recorded answer. */
  function stopOrGo({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      optCall(kit, "get_technician_schedule", `{"technician":"${REPAIR.technician}","date":"${REPAIR.now_for}"}`),
      "Stop calling tools and write the answer to Dana",
      optCall(kit, "list_visits", T[1].call[1]),
      optCall(kit, "get_part_order", `{"order_id":"${PO}"}`)
    ];
    const STOP = 1, PART = 3; // both accepted: PART is defensible, so it is marked right too
    const ANSWER = T[3];
    const recorded = `${log(kit, [["model answers", kit.esc(ANSWER.text), { now: true }]])}<p class="lx-${ID}-cap">${CAPTION}</p>`;
    const fb = [
      [`That shows ${kit.esc(REPAIR.technician)}'s day on ${kit.esc(REPAIR.now_for)}. Dana did not ask who comes or when; she asked why it moved, and the log already answers that.`, false],
      [`Yes. Dana asked why, and the log says why. This is what the recorded model did: its fourth reply had no tool call, only text.${recorded}A small hosted model wrote this. The reply had no <code>tool_calls</code> (its <code>finish_reason</code> was <code>"${ANSWER.finish}"</code>, not <code>"tool_calls"</code>). That is how the program knows the job is over; the loop checks for the missing <code>tool_calls</code>. In all: ${plural(MODEL_CALLS, "model call")}, ${plural(TOOL_RUNS, "tool run")}.`, true],
      ["You already have her visits, and nothing has changed since. Repeating a call with the same arguments gets the same result. When an agent does this again and again, it is stuck.", false],
      [`Defensible: the order would tell you whether the part arrives in time for ${kit.esc(REPAIR.now_for)}. But that is a second question Dana did not ask, and every extra call is one more round trip. The recorded model stopped instead:${recorded}Its fourth reply had no <code>tool_calls</code> (<code>finish_reason</code> <code>"${ANSWER.finish}"</code>), and that missing tool call is how the program knows the job is over.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Enough to answer?</h1>
        <p class="lead">The third result, the visit's change log, is in. Nothing forces you to call another tool. You can also reply with plain text, and then the program sends that text to the office team.</p>
        ${log(kit, [callRow(kit, T[2].call), resultRow(kit, T[2].result, { now: true })])}
        <p class="task">What do you do now?</p>
        <div class="lpanel">${ask(kit, opts, ans === PART ? PART : STOP, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === STOP || ans === PART) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: same program, a misspelled name, a different path. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const tt = REC_TYPO.turns;
    const opts = [
      "The program: it reads the message and plans how many tools to run",
      "The model: after each result it either asks for another tool or answers, and the program repeats until it answers",
      "The step limit: it was set lower for the second message",
      "The tool: an error result ends the loop"
    ];
    const fb = [
      ["The program never reads the message. It passes the conversation to the model and runs whatever the model asks for. Nothing in it decides between 2 and 4.", false],
      [`Right. The program only repeats one move: <b>ask the model, run the tool it asks for, send the result back</b>, until a reply has no tool call. Which tools, in what order, and how many turns come from the model reading each result. That repeat is the <b>agent loop</b>: think (the model picks a tool or answers), call a tool (your code runs it), look (the result goes back into the conversation), repeat. You may have sent one tool result back before; here the model chains them, and each choice depends on the last result.`, true],
      [`Neither run was stopped by a limit. Dana's ended after ${plural(MODEL_CALLS, "model call")} and this one after ${TYPO_CALLS}, both because the model replied with text instead of a tool call. A limit only matters when it is hit.`, false],
      ["An error is just another tool result sent back to the model. The loop does not look inside results. The model read the error and chose to ask Dana to check the name; it could also have tried another spelling. That choice was the model's.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Who decided the path?</h1>
        <p class="lead">Same assistant, same program, same tools. This time the customer misspelled her own name. The whole run:</p>
        ${log(kit, [["customer", kit.esc(DANA_TYPO)], callRow(kit, tt[0].call), resultRow(kit, tt[0].result), ["model answers", kit.esc(tt[1].text)]])}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="lead">Dana's run took ${plural(MODEL_CALLS, "model call")}. This one took ${plural(TYPO_CALLS, "model call")}.</p>
        <p class="task">The program's code was identical. What decided that this run needed ${TYPO_CALLS} model calls and Dana's needed ${MODEL_CALLS}?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Predict what the program sends each turn: the conversation is the memory. */
  function whatIsSent({ el, done, kit }) {
    ensureStyle();
    let k = 1, wrong = null; // k = the request being predicted (index into T)
    const paint = () => {
      const fin = k >= T.length;
      const prev = T[Math.min(k, T.length) - 1].sent;
      const right = fin ? 0 : T[k].sent;
      const opts = fin ? [] : [prev, prev + 1, prev + 2];
      const known = T.slice(0, fin ? T.length : k);
      const say = v => v === prev
        ? `Then the model would see exactly what it saw last time, with no tool result in it, and ask for the same call again. The model keeps nothing between calls, so the program must add what happened.`
        : `The model's reply goes in, but so does the tool result that answers it. That is two new messages per turn: the assistant message with the tool call, and a <code>"tool"</code> message with the result.`;
      el.innerHTML = `<h1>What the program sends each turn</h1>
        <p class="lead">The model remembers nothing between calls. So every request carries the whole conversation so far, as a list of messages, plus the tool list again. Request 1 carried ${plural(T[0].sent, "message")}: the office's instructions and Dana's message.</p>
        ${fin ? "" : `<p class="task">How many messages does request ${k + 1} carry?</p>`}
        ${kit.table(known.map((t, i) => [String(i + 1),`${plural(t.sent, "message")} → ${t.call ? t.call[0] : "final answer"}`]), { head: ["request", "sent → model replied"], title: "Dana's run", fresh: known.length - 1 })}
        <div class="lpanel">${fin ? "" : kit.options(opts.map(String), { picked: wrong == null ? null : opts.indexOf(wrong), correct: opts.indexOf(right), num: true })}
        ${wrong != null ? kit.feedback(say(wrong), false) : ""}
        ${fin ? `${kit.meter(T.map((t, i) => ({ label: `request ${i + 1}`, value: t.promptTokens, max: Math.max(...PROMPT) })))}
          ${kit.feedback(`Right: ${T.map(t => t.sent).join(", ")}. The list grows by two every turn, and the model reads all of it every time. In the recording, the input grew from ${PROMPT[0]} to ${PROMPT[PROMPT.length - 1]} tokens per request, ${sum(PROMPT)} in total, while the model's own replies stayed short (${Math.min(...OUT)} to ${Math.max(...OUT)} tokens). The messages list <b>is</b> the agent's memory, and you pay to resend it each turn.`, true)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.i];
        if (v !== right) { wrong = v; paint(); return; }
        wrong = null; k++; paint();
        if (k >= T.length) done();
      });
    };
    paint();
  }

  /* 6. The loop as Python: a stepped replay of the traced run. */
  const SHOW = new Set([1, 3, 5, 9]); // frames after these lines ran
  const FR = (() => {
    const fr = [];
    for (let k = 1; k < TRACE8.length; k++) {
      const ran = TRACE8[k - 1][0], v = TRACE8[k];
      if (TRACE8[k][1] === "r") { fr.push({ ln: 6, step: v[2], msgs: v[3], reply: v[4], call: v[5], end: true }); continue; }
      if (SHOW.has(ran) && TRACE8[k - 1][1] === "l") fr.push({ ln: ran, step: v[2], msgs: v[3], reply: v[4], call: v[5] });
    }
    return fr;
  })();
  const turnOf = f => T[f.step - 1];
  const sayFrame = (kit, f) => {
    const t = f.step ? turnOf(f) : null;
    if (f.end) return `<code>return reply["content"]</code> hands back the reply's text, and that is the answer the office sends to Dana. The loop ran ${plural(f.step, "time")} of a possible ${MAX_STEPS_RECORDED}: ${plural(MODEL_CALLS, "model call")}, ${plural(TOOL_RUNS, "tool run")}, ${plural(f.msgs, "message")} in the list at the end.`;
    if (f.ln === 1) return `<code>messages</code> starts with the office's instructions and Dana's message: ${plural(f.msgs, "message")}. This list is everything the model will know.`;
    if (f.ln === 3) return `Step ${f.step}. <code>call_model</code> sent all ${plural(t.sent, "message")} and the tool list. ${t.call ? `The reply asks for a tool: <code>${kit.esc(t.call[0])}</code>.` : "The reply is plain text, with no tool call."}`;
    if (f.ln === 5) return t.call ? `The reply has a tool call, so the <code>if</code> is false and the loop is not done. (<code>messages.append(reply)</code> already added the reply: ${plural(f.msgs, "message")} now.)` : `No tool call this time, so the <code>if</code> is true: this reply is the answer.`;
    if (f.ln === 9) return `<code>run_tool</code> ran <code>${kit.esc(callTxt(t.call))}</code> on the office's data. <code>tool_message</code> added the result as a <code>"tool"</code> message: ${plural(f.msgs, "message")}. Back to the top of the loop.`;
    return "";
  };
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0;
    const paint = () => {
      const f = FR[i];
      el.innerHTML = `<h1>The loop, written in Python</h1>
        <p class="lead">This is the whole loop. <code>call_model</code> sends the messages and the tool list to the model's API. <code>run_tool</code> runs one of the five office functions with the arguments the model sent (a JSON string). <code>tool_message</code> wraps the result as a <code>"tool"</code> message. This run replays the ${MODEL_CALLS} recorded replies in order; the tools really ran.</p>
        <p class="task">Step through to the end. The marked line is the one that just ran. Watch where the loop decides to go round again.</p>
        ${kit.code(CODE, f.ln)}
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === FR.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>step <b>${f.step == null ? "–" : f.step}</b></span><span>len(messages) <b>${f.msgs}</b></span><span>reply <b>${kit.esc(f.reply || "–")}</b></span><span>frame <b>${i + 1} / ${FR.length}</b></span></div>
        ${kit.feedback(sayFrame(kit, f))}
        ${i === FR.length - 1 ? `<p class="lead">Other model APIs use a different shape for the same loop. Anthropic's Messages API, for example, ends a turn with <code>stop_reason: "tool_use"</code> and takes results back as <code>tool_result</code> blocks. The loop is the same: repeat while the model asks for a tool.</p>` : ""}`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); if (i === FR.length - 1) done(); };
    };
    paint();
  }

  /* 7. The hard step limit: predict the run with max_steps = 3. */
  function stepLimit({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const calls3 = callsIn(TRACE3), msgs3 = lastMsgs(TRACE3);
    const opts = ["The same answer to Dana", `"${RETURNED3}"`, "It keeps going until the model answers", "An error"];
    const fb = [
      [`The answer came from model call ${MODEL_CALLS}. With <code>max_steps = ${LIMIT_SHORT}</code> the <code>for</code> loop ends after call ${LIMIT_SHORT}, so the model never reads the log it asked for.`, false],
      [`Right. The replay with <code>max_steps = ${LIMIT_SHORT}</code> returned <code>"${kit.esc(RETURNED3)}"</code> after ${plural(calls3, "model call")}. The log result was already in the list (${plural(msgs3, "message")}), but no model call came after it. Without a limit, the loop ends only when the model answers without a tool call. A model can fail to do that: it repeats a call, or keeps wanting one more check. Then the loop runs on, and every turn is a paid call that resends everything. The step limit is the exit <b>you</b> control. Set it from how many turns real questions take in your logs, and decide what the user gets when it hits: a hand-off to a person, not silence.`, true],
      [`<code>range(1, max_steps + 1)</code> gives exactly ${LIMIT_SHORT} turns. After the last one the <code>for</code> loop is over, whatever the model wanted next.`, false],
      ["Nothing fails. The loop runs out of turns, and the last line returns its fixed message. A limit is a normal exit, not a crash, which is why you must decide what that message says.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The exit you control</h1>
        <p class="lead">Dana's run needed ${plural(MODEL_CALLS, "model call")}. Now run the same loop, with the same recorded replies, but <code>max_steps = ${LIMIT_SHORT}</code>.</p>
        ${kit.code(CODE, ans === 1 ? 10 : 2)}
        <p class="task">What does <code>run_agent</code> return?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The model's reply tokens", "The number of tools in the tool list", "The input tokens"];
    const RIGHT = 2;
    const fb = [
      [`The replies were short: ${OUT.join(", ")} tokens. A tool call is a name and a few arguments. What grows is what the program sends.`, false],
      ["The tool list is the same five tools on every turn. It is part of each request, but adding turns does not make it longer.", false],
      [`Right. Every turn resends everything before it, so each request is bigger than the last. In Dana's run: ${PROMPT.join(", ")} input tokens. Two more turns add two more requests that are bigger still, so the total grows faster than the number of turns.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to reach for an agent loop</h1>
        <p class="lead"><b>For:</b> questions where the next step depends on what the last result said, like Dana's. <b>Reach for it</b> when several tools exist and different cases need different paths.</p>
        <p class="lead"><b>Not</b> when the steps are always the same: plain code, or a fixed chain of calls, does it with fewer model calls and nothing to go astray. Also not when there is nothing to look up: then one model call is enough.</p>
        <p class="lead"><b>Costs:</b> every turn is a model call, so the waiting adds up. Every turn resends the whole conversation. One wrong pick sends the later steps the wrong way. And because the path changes from case to case, it is harder to test than fixed code.</p>
        <p class="task">A new rule means every question needs two more tool calls than now. Which cost grows faster than the number of turns?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including two where a loop is the wrong tool. */
  const CASES = [
    ["A customer asks why her invoice is higher than the quote. Depending on what the invoice shows, the answer may be in the job notes, an extra parts order, or a second visit.", true,
      "Yes. Which record to open next depends on what the last one said. That is the shape the loop is for: the model reads, then picks the next tool.",
      "The path changes with what each record shows: sometimes the job notes, sometimes a parts order. You cannot fix the steps in advance, so let the model pick the next tool after each result, inside a step limit."],
    ["Every night at 2:00, export yesterday's bookings to a spreadsheet and email it to the manager. The steps never change.", false,
      "No. The steps are known before the run starts, so plain code does them in order with no model call at all. An agent loop would pay for model calls to rediscover the same three steps every night, and could skip one.",
      "There is no decision to make between steps: always export, then write, then email. A model in a loop adds paid calls and a chance it skips or repeats a step. Plain code, or a fixed chain, does this."],
    ["Translate a customer's message from Spanish to English before the office reads it.", false,
      "No. There is nothing to look up and nothing to run: one model call with the text does it. A loop only helps when the model needs results from tools to decide what to do next.",
      "No tool is needed, so the loop would end on the first turn anyway. It is one model call. The loop earns its cost only when the model has to fetch something, read it and decide the next step."],
    ["A dispatcher asks: who can take an emergency leak in the north of town this afternoon? If someone nearby is free, that is the answer; if not, someone may have to be moved off a less urgent job, or the on-call plumber checked.", true,
      "Yes. What to check next depends on what the last check found: a free technician ends it early, none free means looking at less urgent jobs. The model picks tools in turn until it can name someone, or the step limit stops it.",
      "The steps are not fixed: if a nearby technician is free, one check is enough; if not, the next check depends on what the schedules showed. Choosing the next look-up from the last result is what the loop is for."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Loop or not?</h1>
        <p class="lead">Four requests from other jobs. An agent loop means: the model picks a tool, your code runs it, the result goes back, repeat until it answers.</p>
        <p class="task">Would you build each one as an agent loop? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${q}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(ans[i] === (y ? 0 : 1) ? yes : no, ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 10. What next: a short Python exercise follows, then the next lesson. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can build the loop</h1>
      <p class="lead">You played the model, saw that it chooses each next tool from the last result, and stepped through the ${CODE.length - 1}-line loop that only repeats “ask, run, send back” until a reply has no tool call, with a step limit as the exit you control.</p>
      <p class="lead"><b>Practice:</b> a short Python exercise on this page follows: you write <code>run_agent</code> yourself, with a fake model and fake tools, and make it stop both on a final answer and on the step limit.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You now know what a free loop costs; next you decide when a task needs one at all, and when a fixed chain or a router is the better shape.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "The agent loop: think, call a tool, look, repeat",
    checked: "2026-11-13",
    sources: [
      "https://openrouter.ai/docs/guides/features/tool-calling",
      "https://openrouter.ai/docs/api/reference/overview",
      "https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works",
      "https://www.anthropic.com/engineering/building-effective-agents"
    ],
    interview: [
      {
        q: "Your support agent sometimes makes forty tool calls on one question and then times out. What do you change, and what do you look at first?",
        good: [
          "Put a hard step limit in the loop and return a clear fallback, such as a hand-off to a person, when it hits",
          "Read the trace of a bad run: look for the same tool called again with the same arguments",
          "Check what the tool results say: an error or an empty result the model cannot act on often makes it retry",
          "Make sure every tool result is appended to the messages; a missing result makes the model ask again",
          "Ask whether the task needs a free loop at all, or whether fixed steps would do"
        ],
        weak: "Raise the timeout or switch to a bigger model. That hides the loop instead of finding why the model never decides it is done."
      },
      {
        q: "After you added two more tools, the agent's bill grew faster than the number of questions. Explain why, and what you would try.",
        good: [
          "The model keeps no memory, so every turn resends the whole conversation, including every earlier tool result",
          "The two new tool definitions are sent in every request, so every turn costs more input tokens",
          "More tools usually mean more turns per question, and each turn's request is bigger than the last",
          "Return only the fields the model needs from each tool, so results stay short",
          "Measure turns per question from traces, and cap them with the step limit"
        ],
        weak: "Say that the model got more expensive, without noticing that each turn resends everything before it."
      }
    ],
    screens: [firstMove, nextMoves, stopOrGo, spotIdea, whatIsSent, asCode, stepLimit, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(REC_TRACE.turns.length - 1).fill("[data-right]") },
      { right: Array(FR.length - 1).fill("[data-next]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
