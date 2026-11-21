/* Lesson s5c-output-validation: validating model output before it acts.
   Story: a concert-ticket resale site. Its support agent reads a refund chat and the order record, and proposes a
   refund as JSON; a payment call then executes it. A gate in code sits between the two.
   Ideas: (1) two layers of checks. What the reply alone can show (shape, types, allowed reasons, "none goes with 0")
   sits in a Pydantic class, and a failure there is retried once with the error fed back. What needs the site's own
   data (whose order, already refunded, the amount the policy pays, the sign-off limit) is checked in plain code
   against the order table, never against numbers the model wrote, and a failure there goes to a person.
   (2) Broken on purpose: a first version compared the refund with an amount the model itself wrote down.
   Depth: library (screens 4 and 5: Pydantic class, the gate in Python), debug (screen 8), when-not (screens 9, 10),
   explain (screens 1 to 3, interview).
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5c-output-validation/: chat-1 … chat-13 (the agent's
     proposals), retry-10 (chat-10 retried with the validation error), v1-4475 (the first version, chat only);
     all 2026-11-13, openrouter, google/gemini-2.5-flash-lite, temperature 0. Copied here from
     docs/ai-path/runs/s5c-output-validation/to_js.out.txt (made by to_js.py).
   - runs (docs/ai-path/runs/s5c-output-validation/): shop.py (orders, chats, prompts), gate.py → gate.out.txt
     (every decision), checks.py → checks.out.txt (Pydantic outputs, the broken first version), trace_gate.py →
     trace_gate.out.txt (decide() traced line by line on three replies), make_retry_message.py → retry_message.txt,
     schema.py → schema.out.txt (the JSON schema Pydantic writes from the class: no none-goes-with-0 rule in it).
   Lesson-only style: chat and record boxes, clickable code lines, a rules card (.lx-s5c-output-validation-*).
   Plain browser script. */
(() => {
  const ID = "s5c-output-validation", P = "lx-" + ID + "-";
  const REC_DATE = "2026-11-13";
  const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];

  /* ---------- Recorded material (copied from the recordings, not altered) ---------- */
  // request.messages[1].content (the user message: customer id, order record, chat) and
  // response.choices[0].message.content (the reply) of each recording.
  const REC = { provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: REC_DATE };
  const PROPS = {
    "chat-1": {
      user: "Customer id in this chat: c-17\n\nOrder record (from the site's database):\n{\"order_id\": \"4411\", \"customer_id\": \"c-17\", \"event\": \"Paper Kites Orchestra, Lyon\", \"event_status\": \"cancelled\", \"tickets\": 2, \"tickets_eur\": 128.0, \"service_fee_eur\": 9.0, \"charges_eur\": [137.0], \"refunded_eur\": 0}\n\nChat:\nCustomer: Hi, the Paper Kites Orchestra show in Lyon got cancelled, I got the email this morning. Order 4411. Can I have my money back please?",
      reply: "```json\n{\n  \"order_id\": \"4411\",\n  \"refund_eur\": 137.0,\n  \"reason\": \"cancelled\",\n  \"reply_to_customer\": \"We are sorry to hear the event was cancelled. We have processed a full refund for your order.\"\n}\n```" },
    "chat-2": {
      user: "Customer id in this chat: c-21\n\nOrder record (from the site's database):\n{\"order_id\": \"4420\", \"customer_id\": \"c-21\", \"event\": \"Low Tide Choir, Ghent\", \"event_status\": \"moved\", \"tickets\": 1, \"tickets_eur\": 89.0, \"service_fee_eur\": 6.0, \"charges_eur\": [95.0], \"refunded_eur\": 0}\n\nChat:\nCustomer: Low Tide Choir moved their Ghent date to a Tuesday and I work Tuesday nights. I can't go anymore. Order 4420, refund please.",
      reply: "```json\n{\n  \"order_id\": \"4420\",\n  \"refund_eur\": 89.0,\n  \"reason\": \"moved\",\n  \"reply_to_customer\": \"We understand you cannot attend the rescheduled date for Low Tide Choir. We have processed a refund for the ticket price.\"\n}\n```" },
    "chat-3": {
      user: "Customer id in this chat: c-30\n\nOrder record (from the site's database):\n{\"order_id\": \"4433\", \"customer_id\": \"c-30\", \"event\": \"Velvet Static, Porto\", \"event_status\": \"cancelled\", \"tickets\": 4, \"tickets_eur\": 208.0, \"service_fee_eur\": 14.0, \"charges_eur\": [222.0], \"refunded_eur\": 0}\n\nChat:\nCustomer: Velvet Static Porto is cancelled. I bought four tickets for my family, order 4433. I'd like a full refund.",
      reply: "```json\n{\n  \"order_id\": \"4433\",\n  \"refund_eur\": 222.0,\n  \"reason\": \"cancelled\",\n  \"reply_to_customer\": \"We are sorry to hear that Velvet Static in Porto has been cancelled. We have processed a full refund for your order.\"\n}\n```" },
    "chat-4": {
      user: "Customer id in this chat: c-33\n\nOrder record (from the site's database):\n{\"order_id\": \"4437\", \"customer_id\": \"c-33\", \"event\": \"Marsh Radio, Utrecht\", \"event_status\": \"on_sale\", \"tickets\": 1, \"tickets_eur\": 69.0, \"service_fee_eur\": 6.0, \"charges_eur\": [75.0, 75.0], \"refunded_eur\": 0}\n\nChat:\nCustomer: My bank statement shows two charges of 75 euros for order 4437, but I only bought one ticket for Marsh Radio.",
      reply: "```json\n{\n  \"order_id\": \"4437\",\n  \"refund_eur\": 75.0,\n  \"reason\": \"double_charge\",\n  \"reply_to_customer\": \"We see you were charged twice for order 4437. We have processed a refund for the extra charge of 75 euros.\"\n}\n```" },
    "chat-5": {
      user: "Customer id in this chat: c-40\n\nOrder record (from the site's database):\n{\"order_id\": \"4441\", \"customer_id\": \"c-40\", \"event\": \"Copper Lanterns, Bilbao\", \"event_status\": \"on_sale\", \"tickets\": 2, \"tickets_eur\": 110.0, \"service_fee_eur\": 8.0, \"charges_eur\": [118.0], \"refunded_eur\": 0}\n\nChat:\nCustomer: I broke my leg skiing and the doctor says no standing concerts for six weeks. Copper Lanterns is in three weeks. Order 4441. Please refund, I can send the doctor's note.",
      reply: "```json\n{\n  \"order_id\": \"4441\",\n  \"refund_eur\": 0,\n  \"reason\": \"none\",\n  \"reply_to_customer\": \"I am sorry to hear about your injury. Unfortunately, based on our refund policy, we cannot offer a refund in this situation. You are welcome to resell your tickets on our platform.\"\n}\n```" },
    "chat-6": {
      user: "Customer id in this chat: c-44\n\nOrder record (from the site's database):\n{\"order_id\": \"4452\", \"customer_id\": \"c-51\", \"event\": \"Night Ferry, Antwerp\", \"event_status\": \"cancelled\", \"tickets\": 2, \"tickets_eur\": 96.0, \"service_fee_eur\": 7.0, \"charges_eur\": [103.0], \"refunded_eur\": 0}\n\nChat:\nCustomer: Night Ferry Antwerp was cancelled. My order is 4452. Please send the refund to my card.",
      reply: "```json\n{\n  \"order_id\": \"4452\",\n  \"refund_eur\": 103.0,\n  \"reason\": \"cancelled\",\n  \"reply_to_customer\": \"We have processed a full refund of 103.00 EUR for your cancelled order. You should see the amount reflected in your account within 5-10 business days.\"\n}\n```" },
    "chat-7": {
      user: "Customer id in this chat: c-58\n\nOrder record (from the site's database):\n{\"order_id\": \"4458\", \"customer_id\": \"c-58\", \"event\": \"Glass Orchard, Leeds\", \"event_status\": \"cancelled\", \"tickets\": 3, \"tickets_eur\": 132.0, \"service_fee_eur\": 9.0, \"charges_eur\": [141.0], \"refunded_eur\": 141.0}\n\nChat:\nCustomer: Glass Orchard Leeds was cancelled, order 4458. I haven't seen any money back yet, can you refund me?",
      reply: "```json\n{\n  \"order_id\": \"4458\",\n  \"refund_eur\": 141.0,\n  \"reason\": \"cancelled\",\n  \"reply_to_customer\": \"We have processed a full refund of 141.00 EUR for your cancelled order 4458. Please allow 3-5 business days for the funds to appear in your account.\"\n}\n```" },
    "chat-10": {
      user: "Customer id in this chat: c-79\n\nOrder record (from the site's database):\n{\"order_id\": \"4486\", \"customer_id\": \"c-79\", \"event\": \"Low Tide Choir, Ghent\", \"event_status\": \"played\", \"tickets\": 2, \"tickets_eur\": 178.0, \"service_fee_eur\": 8.0, \"charges_eur\": [186.0], \"refunded_eur\": 0}\n\nChat:\nCustomer: At the Low Tide Choir show the scanner said my second ticket was already used and they would not let my sister in. Order 4486. I want my money back for her ticket.",
      reply: "```json\n{\n  \"order_id\": \"4486\",\n  \"refund_eur\": 89.0,\n  \"reason\": \"none\",\n  \"reply_to_customer\": \"We are sorry to hear about the issue with your ticket. Unfortunately, as the event has already played and there was no prior cancellation or rescheduling, we are unable to offer a refund. You are welcome to resell the ticket on our platform.\"\n}\n```" }
  };
  // From retry-10.json: the message the gate added (request.messages[3].content) and the reply.
  const REC_RETRY = {
    sent: "Your proposal failed validation:\n1 validation error for RefundProposal\n  Value error, reason 'none' goes with refund_eur 0, and only with 0 [type=value_error, input_value={'order_id': '4486', 'ref...icket on our platform.'}, input_type=dict]\n    For further information visit https://errors.pydantic.dev/2.14/v/value_error\nReply again with the corrected JSON only.",
    reply: "```json\n{\n  \"order_id\": \"4486\",\n  \"refund_eur\": 0.0,\n  \"reason\": \"none\",\n  \"reply_to_customer\": \"We are sorry to hear about the issue with your ticket. Unfortunately, as the event has already played and there was no prior cancellation or rescheduling, we are unable to offer a refund. You are welcome to resell the ticket on our platform.\"\n}\n```"
  };
  // From v1-4475.json: the first version of the agent saw only the chat (no order record) and had to write paid_eur.
  const REC_V1 = {
    user: "Customer id in this chat: c-70\n\nChat:\nCustomer: Velvet Static Porto is cancelled, I saw it on their page. Order 4475. I paid 142 euros for the two tickets, please refund all of it.",
    reply: "```json\n{\n  \"order_id\": \"4475\",\n  \"paid_eur\": 142,\n  \"refund_eur\": 142,\n  \"reason\": \"cancelled\",\n  \"reply_to_customer\": \"We are sorry to hear that Velvet Static Porto has been cancelled. We have processed a full refund of 142 euros for your order.\"\n}\n```"
  };
  // The refund policy, copied from the system prompt of every chat-* request.
  const POLICY = [
    "Event cancelled by the organiser: refund everything the buyer paid (tickets and service fee).",
    "Event moved to a new date: tickets stay valid. If the buyer cannot go on the new date, refund the ticket price only, not the service fee.",
    "Charged twice for one order: refund the extra charge.",
    "In every other case there is no refund; the buyer can resell the ticket on the site."
  ];

  /* ---------- Code run output (docs/ai-path/runs/s5c-output-validation/*.out.txt) ---------- */
  // gate.py: LIMIT_EUR
  const LIMIT = 150;
  // gate.out.txt, the lines for the proposals this lesson shows.
  const GATE_OUT = {
    "chat-1": ["go ahead", "137"], "chat-2": ["go ahead", "89"], "chat-3": ["person", "above the sign-off limit"],
    "chat-4": ["go ahead", "75"], "chat-5": ["go ahead", "0"], "chat-6": ["person", "not this customer's order"],
    "chat-7": ["person", "already refunded"], "chat-10": ["retry", "ValidationError"]
  };
  // checks.out.txt section 1 (the "For further information" URL lines cut with …).
  const PYD_OUT = {
    clash: ["1 validation error for RefundProposal", "  Value error, reason 'none' goes with refund_eur 0, and only with 0 [type=value_error, input_value={'order_id': '4486', 'ref...icket on our platform.'}, input_type=dict]", "    …"],
    text: ["valid: RefundProposal(order_id='4411', refund_eur=Decimal('137.00'), reason='cancelled', reply_to_customer='Sorry.')"],
    euro: ["1 validation error for RefundProposal", "refund_eur", "  Input should be a valid decimal [type=decimal_parsing, input_value='€137', input_type=str]", "    …"]
  };
  const TEST_TEXT = '{"order_id": "4411", "refund_eur": "137.00", "reason": "cancelled", "reply_to_customer": "Sorry."}';
  const TEST_EURO = '{"order_id": "4411", "refund_eur": "€137", "reason": "cancelled", "reply_to_customer": "Sorry."}';
  // checks.out.txt sections 2 and 3, whole.
  const RETRY_OUT = "retry-10: ('go ahead', Decimal('0'))";
  const V1_OUT = ["v1 gate on v1-4475: ('go ahead', Decimal('142'))", "order table 4475: charges_eur [82.0] refunded_eur 0", "fixed gate on v1-4475: ('person', 'amount does not follow the policy')"];
  // trace_gate.out.txt: decide() traced, steps as [line, problem, event]; line 0 = the def line.
  const DECIDE = [
    "def decide(reply, customer_id):",
    "    try:",
    "        proposal = RefundProposal.model_validate_json(strip_fence(reply))",
    "    except ValidationError as err:",
    "        return \"retry\", err",
    "    problem = check_policy(proposal, customer_id)",
    "    if problem != \"ok\":",
    "        return \"person\", problem",
    "    if proposal.refund_eur > LIMIT_EUR:",
    "        return \"person\", \"above the sign-off limit\"",
    "    return \"go ahead\", proposal.refund_eur"
  ];
  const TRACES = [
    // result: the two returned values, from the "# <name> result:" lines (the retry's second value is a ValidationError object)
    { name: "chat-10", result: ["retry", "ValidationError"], steps: [[1, null, "line"], [2, null, "line"], [3, null, "line"], [4, null, "line"], [4, null, "return"]] },
    { name: "chat-7", result: ["person", "already refunded"], steps: [[1, null, "line"], [2, null, "line"], [5, null, "line"], [6, "already refunded", "line"], [7, "already refunded", "line"], [7, "already refunded", "return"]] },
    { name: "chat-3", result: ["person", "above the sign-off limit"], steps: [[1, null, "line"], [2, null, "line"], [5, null, "line"], [6, "ok", "line"], [8, "ok", "line"], [9, "ok", "line"], [9, "ok", "return"]] }
  ];

  /* ---------- Derived from the data ---------- */
  const stripFence = t => { let l = t.trim().split("\n"); if (l.length && l[0].startsWith("```")) l = l.slice(1); if (l.length && l[l.length - 1].startsWith("```")) l = l.slice(0, -1); return l.join("\n"); };
  const parseUser = u => {
    const cust = u.match(/^Customer id in this chat: (\S+)/)[1];
    const rec = u.match(/\n(\{.*\})\n/);
    const chat = u.split("\nChat:\n")[1];
    return { cust, order: rec ? JSON.parse(rec[1]) : null, chat };
  };
  const D = {};
  Object.keys(PROPS).forEach(k => { D[k] = { ...parseUser(PROPS[k].user), prop: JSON.parse(stripFence(PROPS[k].reply)), text: stripFence(PROPS[k].reply) }; });
  const sum = a => a.reduce((x, y) => x + y, 0);
  // the policy amount, as policy_amount() in gate.py computes it from the order table
  function policyAmount(o, reason) {
    if (reason === "cancelled" && o.event_status === "cancelled") return sum(o.charges_eur);
    if (reason === "moved" && o.event_status === "moved") return o.tickets_eur;
    if (reason === "double_charge" && o.charges_eur.length > 1) return sum(o.charges_eur.slice(1));
    if (reason === "none") return 0;
    return null;
  }
  const eur = v => `€${Number.isInteger(v) ? v : v.toFixed(2)}`;
  const POLICY_WORDS = { cancelled: "everything charged", moved: "the tickets only, not the fee", double_charge: "the extra charge", none: "nothing" };
  // the kind of each shown proposal, read from the gate's real output
  const kindOf = k => {
    const [v, d] = GATE_OUT[k];
    if (v === "retry") return "clash";
    if (v === "go ahead") return D[k].prop.refund_eur === 0 ? "go0" : "go";
    return d === "above the sign-off limit" ? "limit" : d === "already refunded" ? "refunded" : "owner";
  };
  const DECISIONS = ["Go ahead", "Retry", "Send to a person"];
  const rightIdx = k => ({ "go ahead": 0, retry: 1, person: 2 })[GATE_OUT[k][0]];

  /* ---------- Small helpers and lesson-only style ---------- */
  function style() {
    if (document.getElementById(P + "css")) return;
    const s = document.createElement("style");
    s.id = P + "css";
    s.textContent = `
      .${P}box { margin: 14px 0 0; padding: 10px 14px; border-left: 3px solid var(--line); background: var(--surface); color: var(--ink-2); font-size: 16.5px; overflow-wrap: anywhere; }
      .${P}box b.h { display: block; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 2px; }
      .${P}rec { border-collapse: collapse; margin-top: 4px; font: 500 14.5px var(--mono); }
      .${P}rec td { padding: 2px 12px 2px 0; vertical-align: top; }
      .${P}rec td:first-child { color: var(--muted); }
      .${P}cap { margin: 6px 0 0; font: 500 13px var(--mono); color: var(--muted); }
      .${P}rules { margin: 14px 0 0; border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; font-size: 15.5px; background: var(--surface); }
      .${P}rules p { margin: 6px 0 2px; font-weight: 600; }
      .${P}rules ul { margin: 0; padding-left: 20px; }
      .${P}rules li { margin: 2px 0; }
      .${P}rules code { font-size: 14px; }
      .${P}wrap div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 8ch); text-indent: -8ch; }
      .${P}lines { margin: 14px 0 0; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); }
      .${P}lines li + li { border-top: 1px solid var(--line); }
      .${P}lines button { display: block; width: 100%; min-height: 44px; padding: 8px 12px; border: 0; background: none; color: var(--ink); font: 500 14px/1.4 var(--mono); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; padding-left: calc(12px + 8ch); text-indent: -8ch; }
      .${P}lines button.on { outline: 2.5px solid var(--ink); outline-offset: -3px; font-weight: 700; }
      .${P}lines button.no { background: var(--bad-soft); }
      .${P}lines button.ok { background: var(--good-soft); }
      .${P}cost { margin: 10px 0 0; padding-left: 20px; font-size: 16.5px; }
      .${P}cost li { margin: 3px 0; }
      .${P}who { margin: 14px 0 0; font-weight: 600; }
    `;
    document.head.appendChild(s);
  }
  const esc = s => LessonKit.esc(s);
  const block = (lines, cap, wrap) => { const ls = typeof lines === "string" ? lines.split("\n") : lines; return `<pre class="lcode${wrap ? ` ${P}wrap` : ""}">${ls.map(c => `<div>${esc(c) || " "}</div>`).join("")}</pre>${cap ? `<p class="${P}cap">${cap}</p>` : ""}`; };
  const codeW = (lines, active) => LessonKit.code(lines, active).replace('class="lcode"', `class="lcode ${P}wrap"`);
  const recCap = `Recorded model output, ${REC_DATE}`;
  const runCap = "Output of a run on our machine (Python, Pydantic 2)";
  const chatBox = d => `<div class="${P}box"><b class="h">Chat, customer ${esc(d.cust)}</b>${esc(d.chat)}</div>`;
  const REC_KEYS = ["customer_id", "event_status", "tickets_eur", "service_fee_eur", "charges_eur", "refunded_eur"];
  const recBox = (o, id) => `<div class="${P}box"><b class="h">Order ${esc(id)}, from the site's database</b><table class="${P}rec"><tbody>${REC_KEYS.map(k => `<tr><td>${k}</td><td>${esc(Array.isArray(o[k]) ? `[${o[k].join(", ")}]` : o[k])}</td></tr>`).join("")}</tbody></table></div>`;
  const rulesCard = () => `<div class="${P}rules">
      <p>1. The reply alone. If it fails: retry once (ask the model again and send it the error).</p>
      <ul><li>JSON with <code>order_id</code>, <code>refund_eur</code> (a number, 0 or more, cents at most), <code>reason</code>, <code>reply_to_customer</code></li>
      <li><code>reason</code> is one of: cancelled, moved, double_charge, none</li><li><code>reason</code> none goes with 0, and only with 0</li></ul>
      <p>2. The order table. If it fails: a person.</p>
      <ul><li>the order belongs to the customer in the chat</li><li>nothing was refunded on it yet</li>
      <li>the amount is what the policy pays: cancelled → everything charged; moved → the tickets only; double_charge → the extra charge; none → 0</li></ul>
      <p>3. The limit. Above ${eur(LIMIT)}: a person.</p>
      <p style="font-weight:400">All pass: go ahead.</p></div>`;

  /* 1. The situation, then decide eight recorded proposals by hand. */
  const ORDER1 = ["chat-1", "chat-6", "chat-4", "chat-10", "chat-3", "chat-2", "chat-7", "chat-5"];
  function why1(k, pick) {
    const d = D[k], p = d.prop, o = d.order, kind = kindOf(k), amt = p.refund_eur;
    const pol = policyAmount(o, p.reason);
    const T = {
      go: [`Go ahead. Order ${p.order_id} belongs to ${d.cust}, nothing is refunded yet, and for “${p.reason}” the policy pays ${POLICY_WORDS[p.reason]}: ${eur(pol)}. The proposal says ${eur(amt)}, under the ${eur(LIMIT)} limit.`,
        `Nothing in the reply is broken: every field is there, the reason is one of the four, and ${eur(amt)} matches the policy. A retry costs another call and should bring back the same thing.`,
        `Every rule passes and ${eur(amt)} is under the ${eur(LIMIT)} limit. A person here only makes the customer wait. Keep people for the proposals the rules stop.`],
      go0: [`Go ahead. The event still happens (status ${o.event_status}), so the policy pays nothing, and the proposal says reason none with 0. No money moves; the reply is sent.`,
        "Nothing is broken: reason none goes with 0, and it does. A retry would bring back the same answer.",
        "The proposal pays nothing and follows the policy. A person would only confirm a no that the rules already confirm."],
      limit: [`A person. The shape is fine, and ${eur(amt)} is exactly what the policy pays for a cancelled show. But it is above the ${eur(LIMIT)} limit, and big refunds get a person's sign-off.`,
        `Every rule passes, but ${eur(amt)} is above the ${eur(LIMIT)} sign-off limit. A big payment waits for a person even when it looks right.`,
        `The reply is not broken. A retry would bring back the same ${eur(amt)}, and should: it is the right amount. It is the size that needs a person.`],
      owner: [`A person. The chat comes from ${d.cust}, but order ${p.order_id} belongs to ${o.customer_id}. A typo or not, code cannot tell. A person can ask.`,
        `Look at customer_id in the record: ${o.customer_id}. The chat is from ${d.cust}. Paying would refund an order this customer does not own.`,
        `The shape is fine. Asked again, the model could only change order_id to some other guess: it cannot know which order is really this customer's. Ownership is a fact in your database, so it goes to a person.`],
      refunded: [`A person. refunded_eur is ${o.refunded_eur}: that money already went back. The model read this record and still proposed ${eur(amt)} again. Someone should find out why the customer has not seen it.`,
        `Look at refunded_eur: ${eur(o.refunded_eur)} already went back. Paying again would refund the order twice.`,
        `The shape is fine. The problem is a fact the model read and ignored. A retry asks the same model to notice it this time; a check in code notices it every time, and a person can find the missing money.`],
      clash: [`Retry. reason is none, but refund_eur is ${amt}: the reply contradicts itself, and its own text tells the customer “we are unable to offer a refund”. The error message names the clash, so the model can fix it with one more call.`,
        `The proposal says none, yet would pay ${eur(amt)}. The customer would read “we are unable to offer a refund” and get ${eur(amt)}.`,
        "This is a slip inside the reply itself, and the error message can explain it to the model. One retry is cheap. If it fails again, then a person."]
    };
    const t = T[kind];
    // option order: Go ahead (0), Retry (1), Send to a person (2); t[0] is the right text, t[1], t[2] the two wrong ones in that order
    const right = rightIdx(k);
    if (pick === right) return t[0];
    const wrongs = [0, 1, 2].filter(i => i !== right);
    return t[1 + wrongs.indexOf(pick)];
  }
  function byHand({ el, done, kit }) {
    style();
    let n = 0, pick = null, fin = false;
    const paint = () => {
      const k = ORDER1[n], d = D[k], right = rightIdx(k), ok = pick === right, last = n === ORDER1.length - 1;
      const counts = [0, 1, 2].map(i => ORDER1.filter(x => rightIdx(x) === i).length);
      const unowed = ORDER1.filter(x => ["owner", "refunded", "clash"].includes(kindOf(x))), tableOnly = unowed.filter(x => kindOf(x) !== "clash");
      el.innerHTML = `<h1>Eight refunds, one payment button</h1>
        <p class="lead">A concert-ticket resale site has a support agent. It reads a refund chat and the order record, and proposes a refund as JSON. Until now, a payment call paid every proposal straight away. You now sit between the two. This lesson is about that spot: checking what a model wrote before code acts on it. Here are the site's rules:</p>
        ${rulesCard()}
        <p class="task">Proposal ${n + 1} of ${ORDER1.length}. Check it against the rules, then decide: go ahead, retry, or send to a person.</p>
        ${chatBox(d)}${recBox(d.order, d.prop.order_id)}
        <p class="${P}who">A small hosted model proposed:</p>
        ${block(d.text, recCap + " (the ```json fence lines removed)", true)}
        <div class="lpanel">${kit.options(DECISIONS, { picked: pick, correct: right })}
          ${pick == null ? "" : kit.feedback(why1(k, pick), ok)}
          ${ok && !last ? `<div class="lsteps"><button type="button" class="btn" data-more>Next proposal</button></div>` : ""}
          ${fin ? kit.feedback(`All ${ORDER1.length} decided: ${counts[0]} go ahead, ${counts[1]} retry, ${counts[2]} to a person. Every reply held well-formed JSON with the right keys (wrapped in a \`\`\`json fence, though the prompt asked for JSON only). The dangerous ones looked normal: ${WORDS[unowed.length].toLowerCase()} would have paid money that was not owed (orders ${unowed.map(x => D[x].prop.order_id).join(", ")}), and ${WORDS[tableOnly.length].toLowerCase()} of those broke a rule you can only check with the order table.`) : ""}
        </div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        if (pick === right) return;
        pick = +b.dataset.i;
        if (pick === right && last) fin = true;
        paint();
        if (pick === right && last) done();
      });
      const more = el.querySelector("[data-more]");
      if (more) more.onclick = () => { n++; pick = null; paint(); };
    };
    paint();
  }

  /* 2. Spot the idea: the money rules live in code, outside the model. */
  function spotIdea({ el, done, kit }) {
    style();
    const d = D["chat-7"];
    let ans = null;
    const opts = [
      "Add a line to the system prompt: “Never propose a refund for an order whose refunded_eur is above 0.”",
      "Before the payment call, code reads the order from the database and checks every money rule itself. The model only proposes.",
      "Ask a second model to review each proposal before it is paid."
    ];
    const paint = () => {
      el.innerHTML = `<h1>Who checks the money?</h1>
        <p class="lead">Proposal for order ${d.prop.order_id}: the record the model read said <code>refunded_eur: ${d.order.refunded_eur}</code>. The policy was in its prompt too. It still proposed ${eur(d.prop.refund_eur)}.</p>
        <p class="task">Which change makes sure a refund that breaks the policy is never paid?</p>
        <div class="lpanel">${kit.options(opts, { picked: ans, correct: 1 })}
        ${ans == null ? "" : ans === 1
          ? kit.feedback(`Right. Treat the model's output like input from a stranger: it may be wrong, however good it sounds. The rules about money and permissions run in your own code, on your own data, right before the action. The model's job shrinks to a proposal. That gate between the model and the payment call is <b>output validation</b>. OWASP's list of LLM risks names the missing gate “improper output handling”, and advises putting the permission checks in the systems that act on the output, not in the model.`, true)
          : ans === 0 ? kit.feedback(`The model already had the fact and the policy, and missed it. One more sentence asks again, and nothing checks the answer. A prompt can make mistakes rarer. It cannot make them impossible.`, false)
          : kit.feedback(`A second model is a second guess: it can miss the same field, and it adds a call and waiting to every refund. Comparing refunded_eur with 0 is one line of code that never misses.`, false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 3. Use it: sort six checks into the two layers, and so into retry or person. */
  const CHECKS = [
    ["reason is one of: cancelled, moved, double_charge, none", 0,
      "Right. Everything needed is in the reply. And the model can fix it: the error lists the four allowed words.",
      "No database is needed: the allowed words are fixed, and the reply holds the word. The model can fix it from the error, so this is a retry."],
    ["The order belongs to the customer in the chat", 1,
      "Right. The owner is a fact in your database. The model cannot fix it, so a retry would only change order_id to another guess.",
      "The reply cannot show who owns an order: that lives in your order table. And a retry would only change order_id to another guess, which is worse."],
    ["reason none goes with refund_eur 0, and only with 0", 0,
      "Right. Both values sit in the same reply, so the class can check them together, and the model can repair its own contradiction.",
      "Both values sit in the same reply: no database is needed. The model contradicted itself, and the error message can tell it exactly how. That is a retry."],
    ["refund_eur equals what the policy pays for this order and reason", 1,
      "Right. The amount the policy pays comes from the order's charges and status. Retrying a wrong amount only teaches the model to guess numbers until code says yes.",
      "The policy amount comes from the order's charges and status in your database. If you fed the right amount back, the model would copy it, and the check would prove nothing."],
    ["refund_eur is a number with at most 2 decimal places", 0,
      "Right. A shape rule on one field. The error names the field, and the model can fix it.",
      "This is about the form of one value in the reply. No database needed, and the model can fix it from the error: a retry."],
    ["The event really was cancelled, when reason is cancelled", 1,
      "Right. The event's status is in your database. The model may have believed the customer; the table knows.",
      "The reply only claims a reason. Whether the show was really cancelled is in your event data, and a customer can say anything in a chat."]
  ];
  const LAYERS = ["Reply alone → retry", "Order table → person"];
  function sortChecks({ el, done, kit }) {
    style();
    const ans = CHECKS.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Two layers, two outcomes</h1>
        <p class="lead">You saw two kinds of failure. Some checks need only the reply: the model can fix those, so a failure gets one retry with the error. Others need the site's own data: the model cannot fix those, so a failure goes to a person.</p>
        <p class="task">For each check, choose its layer. Pick again if you change your mind.</p>
        ${CHECKS.map(([q, a, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(LAYERS, { picked: ans[i], correct: a })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === a ? yes : no, ans[i] === a)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CHECKS.every(([, a], j) => ans[j] === a)) done();
      }));
    };
    paint();
  }

  /* 4. Layer 1 with Pydantic: predict three results. */
  const CODE_PYD = [
    "class RefundProposal(BaseModel):",
    "    order_id: str",
    "    refund_eur: Decimal = Field(ge=0, decimal_places=2)",
    "    reason: Literal[\"cancelled\", \"moved\", \"double_charge\", \"none\"]",
    "    reply_to_customer: str",
    "",
    "    @model_validator(mode=\"after\")",
    "    def none_means_zero(self):",
    "        if (self.reason == \"none\") != (self.refund_eur == 0):",
    "            raise ValueError(\"reason 'none' goes with refund_eur 0, and only with 0\")",
    "        return self"
  ];
  const P4 = [
    { title: `The recorded reply for order ${D["chat-10"].prop.order_id} (reason none, refund_eur ${D["chat-10"].prop.refund_eur})`, text: null,
      opts: ["Valid", "1 error: the none-goes-with-0 rule", "2 errors: one on reason, one on refund_eur"], right: 1, out: PYD_OUT.clash,
      yes: `Right. Each field alone is fine: ${D["chat-10"].prop.refund_eur} is a number, none is an allowed reason. Only the validator that looks at both fields fails, and Pydantic wraps your ValueError into a ValidationError.`,
      no: [`Each field alone passes, but the model validator runs after the fields and compares them: none with ${D["chat-10"].prop.refund_eur} breaks it.`, "", `Each field passes on its own: ${D["chat-10"].prop.refund_eur} is a valid number and none is in the list. The one error comes from the validator that compares the two.`] },
    { title: "A test input we wrote: refund_eur as the text \"137.00\"", text: TEST_TEXT,
      opts: ["Valid, and refund_eur becomes the decimal 137.00", "Error: refund_eur should be a number"], right: 0, out: PYD_OUT.text,
      yes: "Right. By default Pydantic converts input it can read safely: the text \"137.00\" becomes Decimal('137.00'). If a text amount should count as a slip, that needs a check of your own.",
      no: ["", "Pydantic's default mode converts text it can read as a number. \"137.00\" reads cleanly, so it passes as Decimal('137.00')."] },
    { title: "A test input we wrote: refund_eur as \"€137\"", text: TEST_EURO,
      opts: ["Valid, and refund_eur becomes 137", "Error on refund_eur"], right: 1, out: PYD_OUT.euro,
      yes: "Right. A euro sign is not part of a number, so it cannot be converted. Pydantic names the field, and that message is what a retry sends back.",
      no: ["Pydantic converts only what reads as a number. “€137” does not, so it never guesses: it reports refund_eur."] }
  ];
  function pydantic({ el, done, kit }) {
    style();
    const ans = P4.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Layer 1 in Pydantic</h1>
        <p class="lead"><b>Pydantic</b>, a Python library that checks data against a class you write, does layer 1 of the rules card: the reply alone. Each rule becomes one line of the class:</p>
        <ul class="${P}cost">
          <li><code>Decimal</code>: refund_eur is a number. It holds money exactly, where a float would round.</li>
          <li><code>Field(ge=0, decimal_places=2)</code>: 0 or more (ge means greater than or equal), cents at most.</li>
          <li><code>Literal[...]</code>: reason is one of the four allowed words.</li>
          <li><code>model_validator(mode="after")</code>: runs once every field has passed, so it can compare two fields: none goes with 0.</li>
          <li><code>RefundProposal.model_validate_json(text)</code>: returns a proposal, or raises a <code>ValidationError</code> that names what failed.</li>
        </ul>
        ${codeW(CODE_PYD, -1)}
        <p class="lead" style="margin-top:14px">Why keep this if the provider's schema mode (from the structured-output lesson) already shapes the reply? Because the schema misses one rule. The schema Pydantic writes from this class has the fields, types and allowed reasons. The none-goes-with-0 rule is Python code, so it is not in the schema (we checked on our run). OpenAI's structured-output guide also says to validate the business rules a schema does not express.</p>
        <p class="task">Predict each result before you see it.</p>
        ${P4.map((c, i) => `<div class="lcase" id="c${i}"><p>${esc(c.title)}</p>${c.text ? block(c.text, "Written by us, not a model reply", true) : ""}
          ${kit.options(c.opts, { picked: ans[i], correct: c.right })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === c.right ? c.yes : c.no[ans[i]], ans[i] === c.right)}
          ${ans[i] == null ? "" : block(c.out, runCap, true)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (P4.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 5. The whole gate in Python: predict where each reply leaves, then step the recorded run. */
  // [traced line (0 = the def line), the statement it returns with]
  const EXITS = [[4, "return \"retry\", err"], [7, "return \"person\", problem"], [9, "return \"person\", \"above the sign-off limit\""], [10, "return \"go ahead\", proposal.refund_eur"]];
  const exitName = j => `<code>${esc(EXITS[j][1])}</code>`;
  const exitOf = t => t.steps[t.steps.length - 1][0];
  // why a wrong exit prediction is wrong, from the reply and its order record
  function missWhy(d, pred, right) {
    const p = d.prop, o = d.order;
    const passes = [`it passes layer 1: well-formed, and reason ${p.reason} goes with ${eur(p.refund_eur)}`,
      `check_policy returns ok: order ${p.order_id} is ${d.cust}'s, nothing refunded, and ${eur(p.refund_eur)} is what the policy pays`,
      `${eur(p.refund_eur)} is not above the ${eur(LIMIT)} limit`];
    const stops = [`reason ${p.reason} with ${eur(p.refund_eur)} breaks the none-goes-with-0 rule in the class`,
      `check_policy finds a problem first: refunded_eur is ${o.refunded_eur}`,
      `${eur(p.refund_eur)} is above the ${eur(LIMIT)} limit, so it returns at the limit check`];
    return pred < right ? `It gets past ${exitName(pred)}: ${passes[pred]}. Look at the reply and its order again.` : `It never gets that far: ${stops[right]}.`;
  }
  function gateCode({ el, done, kit }) {
    style();
    let r = 0, pred = null, i = 0;
    const paint = () => {
      const t = TRACES[r], d = D[t.name], right = EXITS.findIndex(([ln]) => ln === exitOf(t));
      const predicted = pred === right, [ln, problem, ev] = t.steps[i], end = i === t.steps.length - 1;
      const lastRun = r === TRACES.length - 1;
      const say = !predicted ? "" : ev === "return" ? `decide returned ${t.result.map(x => x === "ValidationError" ? "the ValidationError" : `“${esc(x)}”`).join(" and ")}.`
        : ln === 1 ? "Try layer 1."
        : ln === 2 ? "Pydantic reads the text and runs every check in the class."
        : ln === 3 ? "The class raised a ValidationError, so the except branch runs."
        : ln === 4 ? "Return retry, with the error. That error is what gets sent back to the model."
        : ln === 5 ? "Layer 1 passed. Now layer 2: check_policy reads the order from the site's own table."
        : ln === 6 ? `check_policy returned “${esc(problem)}”.`
        : ln === 7 ? "Not ok: return person, with the reason a person will read."
        : ln === 8 ? `The rules passed. Now the size: is ${eur(d.prop.refund_eur)} above LIMIT_EUR, ${eur(LIMIT)}?`
        : ln === 9 ? "Yes: return person." : "";
      el.innerHTML = `<h1>The gate, in Python</h1>
        <p class="lead">One function joins the layers: the Pydantic class, then <code>check_policy</code> (the order-table rules, plain code), then the limit. Only a <code>go ahead</code> reaches the payment call. <code>strip_fence</code> removes the <code>\`\`\`json</code> lines the model put around its JSON. The steps are a recorded run on three replies you decided by hand.</p>
        <p class="task">Reply ${r + 1} of ${TRACES.length}: order ${esc(d.prop.order_id)}. Predict which <code>return</code> line ends <code>decide</code> for this reply, then step through the run.</p>
        ${codeW(DECIDE, predicted ? ln : -1)}
        ${predicted ? `<div class="vars"><span>problem <b>${problem == null ? "–" : esc(problem)}</b></span><span>step <b>${i + 1} / ${t.steps.length}</b></span></div>${kit.feedback(say)}` : ""}
        <div class="lpanel">${kit.options(EXITS.map((_, j) => exitName(j)), { picked: pred, correct: right })}
          ${pred == null || predicted ? "" : kit.feedback(missWhy(d, pred, right), false)}
          ${predicted ? `<div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${end ? "disabled" : ""}>Next step</button>${end && !lastRun ? `<button type="button" class="btn" data-more>Next reply</button>` : ""}</div>` : ""}
          ${end && lastRun ? kit.feedback("The order matters: cheap checks on the reply first, then the database, then the limit. A retry can only come from layer 1, so the model is never asked to “fix” a number the policy refused.", true) : ""}
        </div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { if (predicted) return; pred = +b.dataset.i; i = 0; paint(); });
      const pv = el.querySelector("[data-prev]"), nx = el.querySelector("[data-next]"), mo = el.querySelector("[data-more]");
      if (pv) pv.onclick = () => { i--; paint(); };
      if (nx) nx.onclick = () => { i++; paint(); if (lastRun && i === t.steps.length - 1) done(); };
      if (mo) mo.onclick = () => { r++; pred = null; i = 0; paint(); };
    };
    paint();
  }

  /* 6. After the gate: what the retry brings back. */
  function afterGate({ el, done, kit }) {
    style();
    const again = JSON.parse(stripFence(REC_RETRY.reply)), first = D["chat-10"].prop.refund_eur;
    const o1 = ["refund_eur 0, reason none", `refund_eur ${first}, with reason changed to cancelled or moved`, "The same reply again"];
    const r1 = again.refund_eur === 0 && again.reason === "none" ? 0 : again.refund_eur === first && again.reason !== "none" ? 1 : 2;
    let ans = null;
    const paint = () => {
      el.innerHTML = `<h1>What the retry brings back</h1>
        <p class="lead">The gate said retry for order ${esc(D["chat-10"].prop.order_id)}. It sent the same conversation again, plus the model's reply and this message, built from the real ValidationError:</p>
        ${block(REC_RETRY.sent, "The message the gate sent (recorded request)", true)}
        <p class="task">Predict the retry: what does the model send back?</p>
        <div class="lcase" id="c0">${kit.options(o1, { picked: ans, correct: r1 })}
          ${ans == null ? "" : ans === r1 ? kit.feedback(`Right: refund_eur ${again.refund_eur}, reason ${esc(again.reason)}. Its own text already said no refund, so it kept the reason and fixed the amount. The gate then ran on the new reply, all three layers again: go ahead, with nothing to pay. Run every check on every retry: here the model could just as well have kept the ${first} and changed the reason to one that pays.`, true)
            : kit.feedback(ans === 1 ? `That could have happened, and layer 2 would have caught it: the event status is “${esc(D["chat-10"].order.event_status)}”, so neither reason pays. This time the model fixed the amount instead: ${again.refund_eur}.` : `The request is different now: it carries the error, which names the clash. The reply changed: refund_eur is ${again.refund_eur}.`, false)}
          ${ans == null ? "" : `<p class="${P}who">A small hosted model answered:</p>${block(stripFence(REC_RETRY.reply), recCap + " (the \`\`\`json fence lines removed)", true)}${block(RETRY_OUT, runCap)}`}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === r1) done(); });
    };
    paint();
  }

  /* 7. While a person decides: the words the customer reads. */
  function holdReply({ el, done, kit }) {
    style();
    const d3 = D["chat-3"];
    const o2 = ["Send the model's reply now, as written", "Hold that reply. Send a fixed message saying a person is checking the refund, and send a reply only after the person decides", "Ask the model to rewrite the reply until it sounds less certain"];
    let ans = null;
    const paint = () => {
      el.innerHTML = `<h1>While a person decides</h1>
        <p class="lead">Order ${esc(d3.prop.order_id)} went to a person: ${eur(d3.prop.refund_eur)} is above the ${eur(LIMIT)} limit. The proposal also carries the words for the customer:</p>
        <div class="${P}box"><b class="h">reply_to_customer, order ${esc(d3.prop.order_id)}</b>${esc(d3.prop.reply_to_customer)}</div>
        <p class="${P}cap">${recCap}</p>
        <p class="task">The customer is waiting in the chat. What should they get now?</p>
        <div class="lpanel">${kit.options(o2, { picked: ans, correct: 1 })}
          ${ans == null ? "" : ans === 1 ? kit.feedback("Right. The reply text is output that acts too: a promise to a customer. It says the refund is processed, and nothing has been paid. It belongs to the proposal, so it waits with it. If the person changes the amount, the text must change as well.", true)
            : ans === 0 ? kit.feedback("The text says “we have processed a full refund”. Nothing is paid yet, and the person may change the amount or say no. The customer would hold a promise the site has not kept.", false)
            : kit.feedback("Softer words are still the model guessing what will happen. Nobody knows yet what the person will decide. A fixed holding message is true whatever the outcome.", false)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. Broken on purpose: the first version checked the refund against a number the model wrote. */
  const CODE_V1 = [
    "class RefundProposalV1(BaseModel):",
    "    order_id: str",
    "    paid_eur: Decimal = Field(gt=0)",
    "    refund_eur: Decimal = Field(ge=0)",
    "    reason: Literal[\"cancelled\", \"moved\", \"double_charge\", \"none\"]",
    "    reply_to_customer: str",
    "    @model_validator(mode=\"after\")",
    "    def not_above_paid(self):",
    "        if self.refund_eur > self.paid_eur:",
    "            raise ValueError(\"refund_eur is above paid_eur\")",
    "        return self"
  ];
  const CAUSE = 2, COMPARE = 8;
  const V1_PROP = JSON.parse(stripFence(REC_V1.reply));
  // what order 4475 was charged, read from the run output line "order table 4475: charges_eur [82.0] …"
  const V1_PAID = sum(V1_OUT[1].match(/charges_eur \[([^\]]*)\]/)[1].split(",").map(Number));
  const lineWhy = j => j === COMPARE ? `The comparison itself is correct: ${V1_PROP.refund_eur} is not above ${V1_PROP.paid_eur}. It worked on the numbers it got. Which of those numbers should it never have trusted? Ask where ${V1_PROP.paid_eur} came from.`
    : j === 3 ? `refund_eur is the proposal itself. It is meant to come from the model; the question is what it is checked against.`
    : j === 4 ? "The reason is right: the show really was cancelled."
    : j === 0 || j === 6 || j === 7 || j === 10 ? "This line only sets up the class or the validator. It does not decide what is compared."
    : j === 9 ? "This line only runs when the check fails, and here the check passed."
    : "This field carries no money. Look at where the amounts come from.";
  function brokenV1({ el, done, kit }) {
    style();
    const fixOpts = ["Drop paid_eur from the reply. Read what was charged from the order table in code, and check the refund against that", "Add to the prompt: “Do not trust amounts the customer states”", `Lower the limit from ${eur(LIMIT)} to ${eur(100)}`];
    let line = null, fix = null;
    const paint = () => {
      const found = line === CAUSE;
      el.innerHTML = `<h1>Broken on purpose: a check that checks nothing</h1>
        <p class="lead">The site's first gate. Back then the agent saw only the chat, with no order record, and the reply had one more field, <code>paid_eur</code>. The class below checked it, then the gate checked the ${eur(LIMIT)} limit and paid. The proposal is a real recording; the gate ran on our machine.</p>
        ${chatBox({ cust: "c-70", chat: REC_V1.user.split("\nChat:\n")[1] })}
        <p class="${P}who">A small hosted model proposed:</p>
        ${block(stripFence(REC_V1.reply), recCap + " (the ```json fence lines removed)", true)}
        ${block(V1_OUT.slice(0, 2), runCap, true)}
        <p class="task">The gate sent ${eur(V1_PROP.refund_eur)} to the payment call, for an order that was charged ${eur(V1_PAID)}. Tap the line whose number the check should never have trusted, then pick the fix.</p>
        <ul class="${P}lines">${CODE_V1.map((s, j) => `<li><button type="button" data-i="${j}" class="${line === j ? (j === CAUSE ? "ok on" : "no on") : ""}" ${found ? "disabled" : ""}>${esc(s)}</button></li>`).join("")}</ul>
        <div class="lpanel">${line == null ? "" : found
          ? kit.feedback(`Right: <code>paid_eur</code>. The model wrote it, copying the customer's “${V1_PROP.paid_eur} euros”. The validator then compared the model's refund with the model's own claim, so it could never fail on the thing that mattered. A check is only as good as the source of its numbers: the amount paid must come from your database.`, true)
          : kit.feedback(lineWhy(line), false)}
          ${found ? `<div class="lcase" id="c1"><p>Which fix stops this for good?</p>${kit.options(fixOpts, { picked: fix, correct: 0 })}
            ${fix == null ? "" : fix === 0 ? kit.feedback("Right. That is layer 2 from this lesson. The fixed gate, run on the same recorded reply, refuses it (Pydantic ignores the extra paid_eur key by default):", true) + block(V1_OUT.slice(2), runCap, true)
              : fix === 1 ? kit.feedback("The model may follow that, or not, and you would not know which. It also cannot know the real amount: in this version it never saw the order record. The number has to come from your data.", false)
              : kit.feedback(`A customer who claims ${eur(V1_PAID + 10)} on an ${eur(V1_PAID)} order would still be paid in full. A limit caps the damage; it does not check the amount.`, false)}</div>` : ""}</div>`;
      el.querySelectorAll(`.${P}lines button`).forEach(b => b.onclick = () => { line = +b.dataset.i; paint(); });
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (fix === 0) done(); });
    };
    paint();
  }

  /* 9. The big picture, with a task. */
  // no[i]: feedback when option i is picked and is wrong
  const SIT8 = [
    { q: "A model drafts the weekly newsletter. An editor reads and edits every draft before it is sent.", a: 2,
      yes: "Right. A person reads every word before anything happens. That editor is the check; a code gate adds little.",
      no: { 0: "A gate protects actions that code runs on its own. Here nothing runs: the editor reads all of it first.", 1: "A shape check makes sense when code reads the output. Here a person reads the whole draft." } },
    { q: "A model tags incoming support tickets with one of six topics, for a dashboard and for routing.", a: 1,
      yes: "Right. Code reads the tag, so it must be one of the six. But a wrong tag moves no money and is easy to fix, so a shape check is enough.",
      no: { 0: "No money or permission depends on a topic tag, and a wrong one is easy to undo. A shape check is enough.", 2: "Nobody reads the tags one by one: code routes on them, so a check on the six allowed values is needed." } },
    { q: "A model proposes changing the delivery address on a customer's order, and a shipping call applies it.", a: 0,
      yes: "Right. It acts on someone's order. Code must check that the order belongs to the person asking and that it has not shipped, from your own data.",
      no: { 1: "A valid-looking address on the wrong order still sends a parcel somewhere else. Ownership and order status are database facts: layer 2.", 2: "Nobody reads these one by one: the shipping call applies them at once." } }
  ];
  const ANS8 = ["Full gate: shape, then rules on your own data", "A shape check is enough", "No gate: a person reads it all"];
  function bigPicture({ el, done, kit }) {
    style();
    const ans = SIT8.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>When to put a gate in front</h1>
        <p class="lead"><b>What it is for:</b> stopping a wrong model output before code acts on it. <b>Reach for it</b> whenever a model's output moves money, changes data or speaks for you, with no person reading it first. <b>Not needed</b> when a person reads everything anyway. <b>Better still:</b> if code can compute a value, do not ask the model for it. Here the amount follows from the reason and the order, so the model could propose only the reason and the reply. <b>What it costs:</b></p>
        <ul class="${P}cost"><li>a second call, and waiting, for each retry;</li><li>staff time and a slower answer for each case sent to a person;</li><li>the policy lives twice, in the prompt and in code, and the two must change together.</li></ul>
        <p class="task">For each situation, pick what it needs.</p>
        ${SIT8.map((s, i) => `<div class="lcase" id="c${i}"><p>${esc(s.q)}</p>${kit.options(ANS8, { picked: ans[i], correct: s.a })}
          ${ans[i] == null ? "" : kit.feedback(ans[i] === s.a ? s.yes : s.no[ans[i]], ans[i] === s.a)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (SIT8.every((s, j) => ans[j] === s.a)) done();
      }));
    };
    paint();
  }

  /* 10. Recognise it in new situations, with "no" cases. */
  const CASES = [
    ["A coding agent proposes shell commands, and a build server runs them.", true,
      "Yes. A command runs on a real machine. Code checks it against a list of allowed commands before it runs, and anything else waits for a person.",
      "The server runs whatever comes out. Allowed commands are a rule your code holds, not the model: a gate with a list, and a person for the rest."],
    ["Shop staff ask an internal chat for their own shop's opening hours. It answers in plain text, to staff only.", false,
      "No. No action follows and nobody outside is promised anything: a staff member reads a sentence. The risk is a wrong fact, and that is fixed by grounding the model in the real hours (retrieval) and testing its answers with evals. A gate blocks an action, and here there is none to block.",
      "A gate stands between output and an action. Here the answer goes to a colleague, not to a payment, a database or a customer. The real risk is a wrong fact: ground the model in the real hours (retrieval) and test answers with evals."],
    ["After a complaint, a model proposes store credit for the customer's loyalty account, and the loyalty system adds it.", true,
      "Yes. Store credit is money the customer can spend. Code checks that the account belongs to the person who complained, and caps the amount by your own credit rules, never by a number the model or the customer wrote.",
      "This is the refund story again: value moves on the model's proposal, and no person reads it first. Account ownership and the allowed amount must be checked against your own records."],
    ["A model writes summaries of support calls, stored for the support team to read later.", false,
      "No. People read the summaries; nothing is triggered by them. A shape check, or none, is enough. To find bad summaries, sample and review them, or score them with an eval.",
      "Nothing acts on a summary: it is read by a person. There is no action to gate. Quality is a job for evals and spot checks."]
  ];
  function recognise({ el, done, kit }) {
    style();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A gate here?</h1>
        <p class="lead">${WORDS[CASES.length]} situations away from concert tickets.</p>
        <p class="task">For each one, decide: does it need a gate in code between the model's output and an action? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 11. What next: the browser exercise, then the next lesson. */
  function whatNext({ el, done, kit, topic }) {
    style();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can put a gate between a model and an action</h1>
      <p class="lead">Check the reply alone with a schema, and retry once with the error when it fails. Check money, ownership and policy in your own code against your own data, and send a failure to a person instead of retrying. Put big actions in front of a person. Never check a model's number against another number the model wrote.</p>
      <p class="lead">A short Python exercise on this page follows: you write the <code>RefundProposal</code> class and a <code>check_policy</code> function, and make <code>decide</code> sort a set of refund proposals into go ahead, retry and person.</p>
      ${nx ? `<p class="lead">Next: <b>${kit.esc(nx.title)}</b>. A new unit: getting photos, audio and scans into a model. You will meet this lesson again there: a field read from a receipt photo is output to validate before anything is paid.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Validating model output before it acts",
    checked: "2026-11-14",
    sources: [
      "https://pydantic.dev/docs/validation/latest/concepts/models/",
      "https://pydantic.dev/docs/validation/latest/concepts/validators/",
      "https://pydantic.dev/docs/validation/latest/api/pydantic/base_model/",
      "https://pydantic.dev/docs/validation/latest/api/pydantic/standard_library_types/",
      "https://docs.python.org/3/library/decimal.html",
      "https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/",
      "https://genai.owasp.org/llmrisk/llm062025-excessive-agency/",
      "https://pydantic.dev/docs/validation/latest/concepts/json_schema/",
      "https://developers.openai.com/api/docs/guides/structured-outputs"
    ],
    interview: [{
      q: "Your support agent can issue refunds through a payment API. How do you make sure it never pays a wrong amount?",
      good: [
        "Treat its output as untrusted input: a gate in code sits between the proposal and the payment call",
        "First validate the shape with a schema (for example Pydantic); a failure there gets one retry with the error fed back",
        "Then check the money rules in code against your own database: the order belongs to this customer, nothing refunded yet, the amount the policy pays; never against amounts the model wrote",
        "A rule failure or a refund above a set limit goes to a person, with the reason; the customer gets a holding message, not the model's promise",
        "Log every decision and watch how many go to people; if code can compute the amount, ask the model only for the reason"
      ],
      weak: "“Put the refund policy in the system prompt and use a stronger model.” A prompt asks; nothing checks the answer, and the model can still pay an order twice or someone else's order."
    }, {
      q: "A model's structured output failed validation. When do you retry, and when do you hand it to a person?",
      good: [
        "Retry when the reply itself is broken and the error message lets the model fix it: a wrong type, a value outside the allowed list, two fields that contradict each other",
        "Cap it at one or two retries, and run every check again on the new reply",
        "Do not retry a business-rule failure such as a wrong amount or the wrong customer's order: the model would just guess until code says yes",
        "Send those, and anything above a risk limit, to a person"
      ],
      weak: "“Retry until it passes validation.” That turns the validator into a hint for the model, so a passing reply proves nothing, and each retry costs a call and time."
    }],
    screens: [byHand, spotIdea, sortChecks, pydantic, gateCode, afterGate, holdReply, brokenV1, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ORDER1.flatMap((_, n) => ["[data-right]", ...(n < ORDER1.length - 1 ? ["[data-more]"] : [])]) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CHECKS.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c0 [data-wrong]"], right: P4.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: TRACES.flatMap((t, r) => ["[data-right]", ...Array(t.steps.length - 1).fill("[data-next]"), ...(r < TRACES.length - 1 ? ["[data-more]"] : [])]) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${COMPARE}"]`], right: [`[data-i="${CAUSE}"]`, "#c1 [data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: SIT8.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
