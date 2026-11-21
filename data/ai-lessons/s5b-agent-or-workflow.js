/* Lesson: agent or fixed workflow. Story: a small accounting firm decides which back-office chores to hand to an
   assistant, and in what shape: a fixed chain (the same steps every time), a router (one call picks the kind, then
   that kind's fixed steps) or an agent loop (the model picks each next tool from the last result).
   Ideas: (1) the shape follows from WHEN the next step can be known: before the run (chain), after reading the
   input (router), only after seeing a result (agent); (2) pick the least free shape that covers the task, because
   every extra freedom costs calls and tokens and adds ways to fail.
   Data, all real:
   - docs/ai-path/runs/s5b-agent-or-workflow/firm.py (the made-up firm, its tools, a grader per chore) and
     shapes.py (runs 4 cases of each of 3 chores through all 3 shapes and grades them in code);
   - shapes-larger.out.txt (the trial model, openai/gpt-4o-mini, recordings m2-*) and shapes-small.out.txt (the
     cheaper small model, google/gemini-2.5-flash-lite; per-token prices from OpenRouter's models list on
     2026-11-13: 0.15/0.60 against 0.10/0.40 USD per million input/output tokens), whose
     SUMMARY lines are copied into RUN_L and RUN_S below; shapes-v1.out.txt is the first run, before four setup
     faults of ours were fixed (see the shapes.py docstring);
   - quoted model text from recordings in the main checkout, docs/ai-path/recordings/s5b-agent-or-workflow/.
   Lesson-local style: a results grid and a transcript block (.lx-s5b-agent-or-workflow-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s5b-agent-or-workflow";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const fmt = n => n.toLocaleString("en");
  const WORDS = ["None", "One", "Two", "Three", "Four"];

  /* ---------- Data copied from the runs ---------- */
  // SUMMARY of shapes-larger.out.txt: [chore, case, shape, model calls, input tokens, right (1) or not (0)]
  const RUN_L = [["A","INV-301","chain",2,263,1],["A","INV-302","chain",2,241,1],["A","INV-303","chain",2,239,1],["A","INV-304","chain",2,231,1],["A","INV-301","router",2,247,1],["A","INV-302","router",2,225,1],["A","INV-303","router",2,223,1],["A","INV-304","router",2,215,1],["A","INV-301","agent",4,1384,1],["A","INV-302","agent",4,1347,1],["A","INV-303","agent",4,1343,1],["A","INV-304","agent",4,1332,1],["B","B1","chain",2,181,0],["B","B2","chain",2,172,1],["B","B3","chain",2,164,0],["B","B4","chain",2,145,0],["B","B1","router",2,177,1],["B","B2","router",1,89,1],["B","B3","router",2,166,1],["B","B4","router",1,86,1],["B","B1","agent",4,1813,1],["B","B2","agent",4,1833,1],["B","B3","agent",4,1825,1],["B","B4","agent",3,1245,1],["C","C1","chain",1,956,0],["C","C2","chain",1,972,1],["C","C3","chain",1,969,0],["C","C4","chain",1,918,0],["C","C1","router",2,241,0],["C","C2","router",2,241,0],["C","C3","router",2,343,1],["C","C4","router",2,241,0],["C","C1","agent",2,1436,1],["C","C2","agent",2,1452,1],["C","C3","agent",2,1449,0],["C","C4","agent",2,1398,1]];
  // SUMMARY of shapes-small.out.txt, same columns
  const RUN_S = [["A","INV-301","chain",2,297,1],["A","INV-302","chain",2,265,1],["A","INV-303","chain",2,253,1],["A","INV-304","chain",2,259,1],["A","INV-301","router",2,273,1],["A","INV-302","router",2,241,1],["A","INV-303","router",2,229,1],["A","INV-304","router",2,235,1],["A","INV-301","agent",1,265,0],["A","INV-302","agent",1,265,0],["A","INV-303","agent",1,265,0],["A","INV-304","agent",1,265,0],["B","B1","chain",2,180,0],["B","B2","chain",2,167,1],["B","B3","chain",2,161,0],["B","B4","chain",2,134,0],["B","B1","router",2,168,1],["B","B2","router",1,80,1],["B","B3","router",2,156,1],["B","B4","router",1,77,1],["B","B1","agent",3,1717,1],["B","B2","agent",3,1727,0],["B","B3","agent",4,2441,1],["B","B4","agent",2,1066,0],["C","C1","chain",1,1123,1],["C","C2","chain",1,1144,1],["C","C3","chain",1,1142,0],["C","C4","chain",1,1078,1],["C","C1","router",2,273,1],["C","C2","router",2,229,0],["C","C3","router",2,229,0],["C","C4","router",2,279,0],["C","C1","agent",2,1723,0],["C","C2","agent",2,1742,1],["C","C3","agent",2,1739,0],["C","C4","agent",2,1678,0]];
  // The router's label for each reconciliation case (the "route:" lines of the two .out.txt files)
  const ROUTE_C_L = { C1: "timing", C2: "timing", C3: "timing", C4: "timing" };
  const ROUTE_C_S = { C1: "missing_entry", C2: "missing_entry", C3: "missing_entry", C4: "missing_entry" };
  // shapes-larger.out.txt RESULT lines, chore C, chain v3: output tokens per case, against its max_tokens of 700
  const CHAIN_C_OUT = { C1: 700, C2: 700, C3: 496, C4: 700 }, CHAIN_C_MAX = 700;
  // firm.py books("C3"): the November bank line the C3 answer needed
  const NOV_LINE = { id: "BNK-1103", date: "2026-11-03", text: "Ovenservice BV inv 2290", amount: -380.00 };
  // firm.py CAUSE_C and books(): what really caused each case's difference
  const CAUSE = { C1: ["missing_entry", "a bank fee nobody booked"], C2: ["duplicate", "a flour invoice booked twice"],
    C3: ["timing", "booked 31 October, left the bank 3 November"], C4: ["wrong_amount", "a sales invoice typed with the wrong amount"] };
  // firm.py TASK_C: the message every reconciliation case started from, word for word
  const TASK_C = "Client Bakkerij Hoek: the bank balance on 31 October 2026 does not match the ledger balance on the same date. Find the cause and name the exact line or lines involved.";
  // shapes.py HINT_C, given to the chain and the agent for chore C
  const HINT_C = "A ledger line with no matching bank line may have gone through the bank in the next month.";
  // firm.py DOCUMENTS["OVEN-2290"]
  const DOC_OVEN = "Ovenservice BV, invoice 2290, 2026-10-30: repair of deck oven 2. Total 380.00 EUR. Paid by bank transfer.";
  const BIG_N = 4; // cases per chore and shape (firm.py)
  const MAX_STEPS = 8; // shapes.py MAX_STEPS: the agent's turn limit

  // Recorded text, trimmed with … only, never altered. Recordings in docs/ai-path/recordings/<src>.json
  const REC = {
    // trial model, chore C case C3, agent: turn 1 asked for three tools at once, turn 2 answered
    agentC3: { src: "s5b-agent-or-workflow/m2-c3-agentv2-1 … m2-c3-agentv2-2", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
      calls: [["get_balances", "{\"month\": \"2026-10\"}"], ["list_bank_lines", "{\"month\": \"2026-10\"}"], ["list_ledger_lines", "{\"month\": \"2026-10\"}"]],
      balances: "{\"month\": \"2026-10\", \"bank_closing\": 4878.15, \"ledger_closing\": 4498.15}", // firm.py get_balances result, shapes-larger.out.txt
      text: "The reconciliation difference of €380.00 is caused by the ledger line with ID LED-1031, which records an expense for Ovenservice BV (inv 2290) that has not yet been reflected in the bank statement. This line does not have a matching bank line in October 2026, indicating it may have gone through the bank in the following month." },
    // trial model, chore B case B3, fixed chain, step 2 (the reply). The chain then sent it; nothing else ran.
    chainB3: { src: "s5b-agent-or-workflow/m2-b3-chain-2", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
      text: "Thank you for informing us about your new office address. We will ensure that all correspondence is sent to Keizersgracht 210, 1016 DZ Amsterdam from now on." },
    // trial model, chore C, router: C3 and C4 answers
    routerC3: { src: "s5b-agent-or-workflow/m2-c3-routerv2-2", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
      text: "The exact line ids involved are LED-1031 from the ledger and BNK-1103 from the bank statement." },
    routerC4: { src: "s5b-agent-or-workflow/m2-c4-routerv2-2", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
      text: "This check found nothing." },
    // trial model, chore A case INV-303, agent: four turns
    agentA: { src: "s5b-agent-or-workflow/m2-inv-303-agentv2-1 … m2-inv-303-agentv2-4", provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
      calls: [["get_invoice", "{\"invoice_id\":\"INV-303\"}"], ["list_accounts", "{}"], ["post_draft_entry", "{\"vendor\":\"Nordrail\",\"invoice_date\":\"2026-10-09\",\"total\":46.2,\"account\":\"6300\"}"]],
      text: "Draft ledger entry posted successfully." },
    // small model, chore A case INV-303, agent: its only turn
    smallA: { src: "s5b-agent-or-workflow/inv-303-agentv2-1", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
      text: "I need the vendor name, invoice date, total amount, and the account to post this draft entry. Can you please provide them?" },
    // small model, chore B case B2, agent: its last turn (no tool call; send_reply never ran)
    smallB2: { src: "s5b-agent-or-workflow/b2-agent-3", provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
      text: "I have found that your VAT return for the third quarter is due on 2026-10-31." }
  };
  const CAPTION = `Recorded model output, ${REC.agentC3.recordedAt}`;

  /* ---------- Derived from the data ---------- */
  const SHAPES = ["chain", "router", "agent"];
  const SHAPE_NAME = { chain: "Fixed chain", router: "Router", agent: "Agent loop" };
  const CHORES = ["A", "B", "C"];
  const CHORE_NAME = { A: "Invoices", B: "Inbox", C: "Bank vs ledger" };
  const agg = (rows, chore, shape) => {
    const r = rows.filter(x => x[0] === chore && x[2] === shape);
    return { ok: sum(r.map(x => x[5])), n: r.length, calls: sum(r.map(x => x[3])), tin: sum(r.map(x => x[4])) };
  };
  const cell = (rows, c, s) => agg(rows, c, s);
  const ratio = (a, b) => Math.round(a / b);
  const best = (rows, c, f) => SHAPES.reduce((b, s) => (b == null || f(cell(rows, c, s)) > f(cell(rows, c, b)) ? s : b), null);
  const worst = (rows, c, f) => SHAPES.reduce((b, s) => (b == null || f(cell(rows, c, s)) < f(cell(rows, c, b)) ? s : b), null);
  const routeRight = k => ROUTE_C_L[k] === CAUSE[k][0];
  const caseOk = (rows, chore, k, shape) => rows.find(x => x[0] === chore && x[1] === k && x[2] === shape)[5] === 1;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-shapes { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
      .lx-${ID}-shapes li { padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; line-height: 1.45; }
      .lx-${ID}-grid { width: 100%; margin: 16px 0 0; border-collapse: collapse; table-layout: fixed; font-size: 14.5px; }
      .lx-${ID}-grid caption { text-align: left; font-size: 13.5px; color: var(--muted); padding-bottom: 6px; }
      .lx-${ID}-grid th, .lx-${ID}-grid td { border-bottom: 1px solid var(--line); padding: 8px 4px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      .lx-${ID}-grid th { font-weight: 600; color: var(--ink-2); font-size: 13.5px; }
      .lx-${ID}-grid td b { display: block; font: 600 16px/1.3 var(--mono); color: var(--ink); }
      .lx-${ID}-grid td small { display: block; color: var(--muted); font-size: 12.5px; line-height: 1.35; }
      .lx-${ID}-grid td.lx-${ID}-hid { color: var(--faint); }
      .lx-${ID}-grid tr.lx-${ID}-now td:first-child { box-shadow: inset 3px 0 0 var(--ink); padding-left: 9px; }
      .lx-${ID}-log { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 7.5em 1fr; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
      .lx-${ID}-who { font: 600 13px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-txt { min-width: 0; font-size: 16px; line-height: 1.5; }
      .lx-${ID}-mono { font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 1fr; } .lx-${ID}-grid { font-size: 13.5px; } }
    `;
    document.head.appendChild(s);
  }
  function log(kit, rows) {
    return `<div class="lx-${ID}-log">${rows.map(([who, html]) =>
      `<div class="lx-${ID}-row"><div class="lx-${ID}-who">${kit.esc(who)}</div><div class="lx-${ID}-txt">${html}</div></div>`).join("")}</div>`;
  }
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  const cap = () => `<p class="lx-${ID}-cap">${CAPTION}</p>`;
  const optMono = (kit, s) => `<span class="lx-${ID}-opt">${kit.esc(s)}</span>`;
  // results grid: shown = set of chores whose row is revealed; now = the chore being asked about
  function grid(kit, rows, { shown, now, title, chores = CHORES, sub = a => `${plural(a.calls, "call")}` } = {}) {
    return `<table class="lx-${ID}-grid"><caption>${kit.esc(title)}</caption><thead><tr><th>chore</th>${SHAPES.map(s => `<th>${SHAPE_NAME[s]}</th>`).join("")}</tr></thead><tbody>${chores.map(c =>
      `<tr${c === now ? ` class="lx-${ID}-now"` : ""}><td>${CHORE_NAME[c]}</td>${SHAPES.map(s => {
        if (!shown.has(c)) return `<td class="lx-${ID}-hid">?</td>`;
        const a = cell(rows, c, s);
        return `<td><b>${a.ok}/${a.n}</b><small>${sub(a)}</small></td>`;
      }).join("")}</tr>`).join("")}</tbody></table>`;
  }
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }
  const SHAPE_LIST = `<ul class="lx-${ID}-shapes">
      <li><b>Fixed chain.</b> Your code runs the same steps in the same order for every case. Some steps are model calls.</li>
      <li><b>Router.</b> One model call reads the input and picks its kind. Your code then runs that kind's fixed steps.</li>
      <li><b>Agent loop.</b> The model picks each next tool from the last result, until it answers (the loop from the last lesson).</li>
    </ul>`;

  /* A screen of several "pick one" blocks; done when every block is right. items: [{ q, right, fb: [[html, ok]] }] */
  function multiPick(el, done, kit, { head, items, opts }) {
    const ans = items.map(() => null);
    const paint = () => {
      el.innerHTML = `${head()}
        ${items.map((it, i) => `<div class="lcase" id="c${i}"><p>${it.q}</p>${ask(kit, opts, it.right, ans[i], it.fb)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (items.every((it, j) => ans[j] === it.right)) done();
      }));
    };
    paint();
  }

  /* 1. The situation, and the by-hand sort of the three chores the firm tried first. */
  const OPTS3 = ["Fixed chain", "Router", "Agent loop"];
  const TRIED = [
    { q: "<b>Invoices.</b> Read each supplier invoice and post a draft ledger entry: supplier, invoice date, total, expense account.", right: 0,
      fb: [["Yes. Every invoice gets the same steps: read the fields, pick the account, post. You know them before the first invoice arrives.", true],
        ["A router chooses between branches. Here every branch would do the same thing (read the fields, pick the account, post), so its first call would decide nothing.", false],
        ["It could work, but the model would spend calls finding the same three steps on every invoice. You know the steps already. The next screen shows what the trial run spent.", false]] },
    { q: "<b>Inbox.</b> Client emails: a receipt to file, a deadline question to answer, an address change to record, or something the firm does not do.", right: 1,
      fb: [["A chain runs the same steps for every email. But a receipt must be filed and an address change must change the client record: each kind needs a different action.", false],
        ["Yes. One call reads the email and names its kind. After that the steps for that kind are known: file it, answer it, change the record, or pass it to a person.", true],
        ["Possible, but the kind is written in the email itself. Once one call has named it, there is nothing left for the model to decide step by step.", false]] },
    { q: "<b>Bank vs ledger.</b> At month end a client's bank balance and ledger balance differ. Find the line that causes it. (Checking the two records against each other is called <b>reconciliation</b>.)", right: 2,
      fb: [["What to look at next depends on what the first look shows: a bank line nobody booked, a line booked twice, a payment that left the bank later. One fixed list of steps cannot cover every cause.", false],
        ["A router must tell the kind of problem from the input. But the input is always the same complaint: “the balances do not match”. The kind only shows when you look at the data.", false],
        ["Yes. Each look decides the next one. If a ledger line has no bank line, you check the next month; if the amounts differ, you open the invoice.", true]] }
  ];
  function sortTried({ el, done, kit }) {
    ensureStyle();
    multiPick(el, done, kit, { opts: OPTS3, items: TRIED, head: () => `<h1>Which chores, in which shape?</h1>
      <p class="lead">A small accounting firm keeps the books for its clients. For each client it keeps a <b>ledger</b>: the firm's own record of every payment in and out. The bank statement is the bank's record of the same money. At month end the two should match. The firm wants an assistant for its office chores. For each chore it must first pick how much freedom the model gets. You make this choice before you build any LLM feature: it decides how many model calls you pay for and what can go wrong. There are three common shapes:</p>
      ${SHAPE_LIST}
      <p class="task">These are the three chores the firm tried first. Pick a shape for each. Pick again if you change your mind.</p>` });
  }

  /* 2. Compare with the recorded trial: predict one result per chore, then see the row. */
  function trial({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const shown = new Set();
    const cutC = Object.keys(CHAIN_C_OUT).filter(k => CHAIN_C_OUT[k] >= CHAIN_C_MAX && !caseOk(RUN_L, "C", k, "chain")).length;
    const A = c => cell(RUN_L, "A", c), B = c => cell(RUN_L, "B", c), C = c => cell(RUN_L, "C", c);
    const turnsA = [...new Set(RUN_L.filter(x => x[0] === "A" && x[2] === "agent").map(x => x[3]))];
    const sChainC = cell(RUN_S, "C", "chain");
    const c3Missed = !caseOk(RUN_L, "C", "C3", "chain") && !caseOk(RUN_S, "C", "C3", "chain");
    const Q = [
      { chore: "A", q: `On invoices, the chain used ${plural(A("chain").calls, "model call")} for the ${BIG_N} cases and got ${A("chain").ok} right. The agent got ${A("agent").ok} right too. How many model calls did the agent use?`,
        opts: [A("chain").calls, A("agent").calls, A("agent").calls * 5].map(String), right: 1,
        fb: [`The same count would mean the agent knew the steps without asking. It did not: it asked for the invoice, then the account list, then posted, then said it was done. Each of those is a model call.`, null,
          `Not that many. Each invoice took the agent ${turnsA.length === 1 ? turnsA[0] : turnsA.join(" to ")} turns (one model call per turn), well under the run's limit of ${MAX_STEPS}.`],
        after: () => `Right: ${A("agent").calls} against ${A("chain").calls}. Each call resends the tool list and the conversation so far, so the agent read ${fmt(A("agent").tin)} input tokens against the chain's ${fmt(A("chain").tin)}: the chain used about ${ratio(A("agent").tin, A("chain").tin)} times fewer input tokens, for the same ${A("chain").ok} right entries. One agent run, all four turns:${log(kit, [...REC.agentA.calls.map(c => ["model asks", mono(kit, c.join(" "))]), ["model answers", kit.esc(REC.agentA.text)]])}${cap()}` },
      { chore: "B", q: "On the inbox, which shape got the fewest emails right?", opts: OPTS3, right: SHAPES.indexOf(worst(RUN_L, "B", a => a.ok)),
        fb: [null, `The router got ${B("router").ok} of ${B("router").n}: it named each email's kind, then ran that kind's steps.`, `The agent got ${B("agent").ok} of ${B("agent").n}, with ${plural(B("agent").calls, "call")}.`],
        after: () => `Right: the chain got ${B("chain").ok} of ${B("chain").n}. Its fixed steps were “summarise the email, write a reply”, the same for every email. Only the deadline question could be handled by a reply. For the address change, the model wrote, and the chain sent:${log(kit, [["reply", kit.esc("… " + REC.chainB3.text + " …")]])}${cap()}A promise, and nothing changed the client record. The router got ${B("router").ok} of ${B("router").n} with ${plural(B("router").calls, "call")}; the agent got ${B("agent").ok} of ${B("agent").n} but needed ${plural(B("agent").calls, "call")}.` },
      { chore: "C", q: "On bank vs ledger, which shape found the right line in the most cases?", opts: OPTS3, right: SHAPES.indexOf(best(RUN_L, "C", a => a.ok)),
        fb: [`The chain got ${C("chain").ok} of ${C("chain").n}. It had October's data in one long call and nothing else. ${WORDS[cutC]} of its answers stopped at the ${CHAIN_C_MAX}-token output limit we set, before naming a line; and case C3 needed November's data, which it never had.`, `The router got ${C("router").ok} of ${C("router").n}. Screen 4 shows why it could hardly do better.`, null],
        after: () => `Right: the agent found it in ${C("agent").ok} of ${C("agent").n}, against ${C("chain").ok} for the chain and ${C("router").ok} for the router. Read this result with care. ${WORDS[cutC]} of the chain's misses were cut off by the ${CHAIN_C_MAX}-token output limit we set, before they named a line. With the cheaper model of screen 6, the same chain got ${sChainC.ok} of ${sChainC.n}. The real reason to give this chore more freedom is case C3: its cause was in November's bank lines, and a chain fixed to October's data cannot see them${c3Missed ? " (it missed C3 with both models)" : ""}. Only a shape that picks its next look can reach them. Did the agent use that freedom on C3? Screen 5 shows.` }
    ];
    const paint = () => {
      const fin = k >= Q.length, q = Q[Math.min(k, Q.length - 1)];
      el.innerHTML = `<h1>What the trial runs showed</h1>
        <p class="lead">Each chore was run in all three shapes on ${BIG_N} cases, with the same hosted model and made-up data (screen 6 repeats it with a cheaper one). Code graded every case: the right entry posted, the right action taken, the right line named. Each cell shows cases right and model calls in all.</p>
        ${grid(kit, RUN_L, { shown, now: fin ? null : q.chore, title: `cases right of ${BIG_N}, and model calls for all ${BIG_N}` })}
        ${fin ? "" : `<p class="task">${q.q}</p>`}
        <div class="lpanel">${fin ? kit.feedback(Q[Q.length - 1].after(), true) : `${kit.options(q.opts, { picked: wrong, correct: q.right })}${wrong != null ? kit.feedback(q.fb[wrong], false) : ""}`}
        ${!fin && k > 0 && wrong == null ? kit.feedback(Q[k - 1].after(), true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (i !== Q[k].right) { wrong = i; paint(); return; }
        shown.add(Q[k].chore); wrong = null; k++; paint();
        if (k >= Q.length) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: what single question picks the shape? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "How hard is the chore for a model?",
      "When can you know the next step: before the run, after reading the input, or only after seeing a result?",
      "How many tools does the chore need?",
      "How much does a mistake cost the firm?"
    ];
    const fb = [
      ["Reading an invoice and reading an email are about equally easy, yet they got different shapes. Difficulty decides how strong a model you need, not who decides the steps.", false],
      [`Right. <b>Invoices:</b> the steps are known before the run, so a chain. <b>Inbox:</b> the kind is known once you read the email, so a router. <b>Bank vs ledger:</b> the next look is known only after the last result, so an agent. Then pick the <b>least free shape that still covers the task</b>. Every bit of freedom you give the model costs calls and tokens and adds ways to fail, as the trial showed: the invoice agent took ${ratio(cell(RUN_L, "A", "agent").calls, cell(RUN_L, "A", "chain").calls)} times as many calls for the same result. The chain and the router are often called <b>workflows</b>: your code fixes the paths. In an <b>agent</b>, the model directs its own steps.`, true],
      ["The inbox chore has the most actions (file, answer, change a record, pass on), yet the router beat the agent there. What matters is whether the right action can be known from the email.", false],
      ["The cost of a mistake tells you how much checking you need (a person approving, for example). It does not tell you who should decide the next step.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What decides the shape?</h1>
        <p class="lead">The chain fitted the invoices, the router fitted the inbox, the agent fitted bank vs ledger. All three chores read text and use a few tools.</p>
        ${grid(kit, RUN_L, { shown: new Set(CHORES), title: `trial results: cases right of ${BIG_N}, and model calls` })}
        <p class="task">Which single question tells you the shape?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Diagnose: why the router failed on bank vs ledger. */
  function routerMiss({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const ks = Object.keys(ROUTE_C_L);
    const nRight = ks.filter(k => caseOk(RUN_L, "C", k, "router")).length;
    const label = ROUTE_C_L.C1;
    const nKinds = new Set(Object.values(CAUSE).map(c => c[0])).size;
    const opts = [
      "The model that picks the label is too weak",
      "Every case started from the same sentence, so the router could only give the same label every time",
      "The code for the “timing” kind has a bug",
      "It needs more kinds to choose from"
    ];
    const fb = [
      [`It was the more expensive of the two models we tried. And no model could do better: the ${ks.length} inputs were identical, word for word, so a router gives one label for all ${ks.length}. The small model's router said “${kit.esc(ROUTE_C_S.C1)}” for all ${ks.length} and found the line in ${plural(ks.filter(k => caseOk(RUN_S, "C", k, "router")).length, "case")}, the one where that happened to be the cause.`, false],
      [`Right. A router decides from the <b>input</b>. Here the input never changes; the cause is in the data, which the router does not read. So it guessed “${kit.esc(label)}” ${ks.length} times and was right ${nRight === 1 ? "once" : plural(nRight, "time")}, when the guess happened to fit. For C4 its follow-up step said:${log(kit, [["model answers", kit.esc(REC.routerC4.text)]])}${cap()}<b>When not to route:</b> when the kind of case cannot be read from the input before you look at the data.`, true],
      [`The timing code worked: in C3, where the cause really was timing, it found both lines, and the follow-up said: “${kit.esc(REC.routerC3.text)}” It found nothing in the other cases because there was no timing problem there.`, false],
      ["More kinds would not help: the router still sees the same sentence each time and must give one answer for it. The problem is what it reads, not how many boxes it can choose from.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Why the router missed</h1>
        <p class="lead">For bank vs ledger, the router's first call read the case and picked one of ${WORDS[nKinds].toLowerCase()} kinds of problem (${kit.esc([...new Set(Object.values(CAUSE).map(c => c[0]))].join(", "))}). Code then ran that kind's check. Every case started from this message:</p>
        ${log(kit, [["task", kit.esc(TASK_C)]])}
        ${kit.table(ks.map(k => [k, `real cause: ${CAUSE[k][1]}. Router said “${ROUTE_C_L[k]}”: ${caseOk(RUN_L, "C", k, "router") ? "right line named" : "nothing found"}`]), { head: ["case", "what happened"], title: `the trial model's router, ${ks.length} cases` })}
        <p class="task">Why did the router find the line in only ${nRight} of ${ks.length} cases?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 5. Diagnose: the agent case it missed. Which call should it have made? */
  function agentMiss({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const r = REC.agentC3;
    const opts = [
      optMono(kit, "get_document {\"doc_id\": \"OVEN-2290\"}"),
      optMono(kit, "list_ledger_lines {\"month\": \"2026-11\"}"),
      optMono(kit, "list_bank_lines {\"month\": \"2026-11\"}"),
      "Nothing: the answer is complete"
    ];
    const RIGHT = 2;
    const fb = [
      [`The invoice says: “${kit.esc(DOC_OVEN)}” It confirms the bill, not when the money left the bank. Only the bank lines of the next month can show that.`, false],
      ["The ledger line is already found: LED-1031, in October. The open question is when the money left the bank, and that is in the bank's lines, not the ledger's.", false],
      [`Right. November's bank lines hold ${NOV_LINE.id}: ${kit.esc(NOV_LINE.text)}, ${NOV_LINE.amount.toFixed(2).replace("-", "−")}, on ${NOV_LINE.date}. One more call, and the answer names both lines. Notice who could make that call. The <b>chain</b> never could: its steps were fixed to October's data, so it could not name ${NOV_LINE.id} in this case. The <b>router</b> named it only because its one guess, “timing”, happened to fit. The <b>agent</b> could have, was even told that such a line may go through the bank the next month, and answered with a guess. You pay for an agent's freedom on every case; it helps only when the model uses it. A trace like this is how you find out.`, true],
      ["The office asked for the exact lines. “May have gone through the bank in the following month” is a guess that no one can check. The tool to check it was right there.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>The case the agent missed</h1>
        <p class="lead">Bank vs ledger, case C3. The agent's instructions included: “${kit.esc(HINT_C)}” Its whole run:</p>
        ${log(kit, [["model asks", r.calls.map(c => mono(kit, c.join(" "))).join("")], ["tool results", `${mono(kit, r.balances)}and every October bank line and ledger line`], ["model answers", kit.esc(r.text)]])}
        ${cap()}
        <p class="task">The agent stopped after one round of look-ups. What should it have asked for before answering?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 6. Risk: the same code with a smaller model. */
  function smallModel({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const sA = cell(RUN_S, "A", "agent"), sB = cell(RUN_S, "B", "agent"), sC = cell(RUN_S, "C", "agent"), sCc = cell(RUN_S, "C", "chain");
    const opts = ["The agent loop", "The fixed chain and the router", "None of them: all got worse"];
    const fb = [
      [`The agent got ${sA.ok} of ${sA.n} invoices and ${sB.ok} of ${sB.n} emails with the small model. On every invoice it did not call a single tool. It asked a person who was not there:${log(kit, [["model answers", kit.esc(REC.smallA.text)]])}${cap()}`, false],
      [`Right. The chain still posted ${cell(RUN_S, "A", "chain").ok} of ${BIG_N} invoices and the router handled ${cell(RUN_S, "B", "router").ok} of ${BIG_N} emails: each model call there is a small, fixed job. The agent fell to ${sA.ok} of ${sA.n} invoices (it asked for the details instead of calling <code>get_invoice</code>) and ${sB.ok} of ${sB.n} emails, and on bank vs ledger it fell to ${sC.ok} of ${sC.n}, while the chain got ${sCc.ok} of ${sCc.n}. On the deadline question it ended with:${log(kit, [["model answers", kit.esc(REC.smallB2.text)]])}${cap()}It said the answer to the office, and never called <code>send_reply</code>: the client got nothing. An agent leans on the model to plan, pick tools and finish, so it needs a model that can do that, and tests that check what it <b>did</b>, not what it said.`, true],
      [`The chain and the router held up: ${cell(RUN_S, "A", "chain").ok} of ${BIG_N} invoices for the chain, ${cell(RUN_S, "B", "router").ok} of ${BIG_N} emails for the router, the same as with the trial model.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Same code, a cheaper model</h1>
        <p class="lead">The firm would like to run the cheapest model. The same trial was run again with a small hosted model whose tokens cost less (OpenRouter prices on 2026-11-13). Nothing else changed.</p>
        ${grid(kit, RUN_S, { shown: ans === 1 ? new Set(CHORES) : new Set(), title: `cheaper model: cases right of ${BIG_N}, and model calls` })}
        <p class="task">Before you see the grid: which shape kept working with the small model?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 7. Use it: three more requests from the firm. */
  const MORE = [
    { q: "<b>Month-end notes.</b> For every client, total the month's bank lines per category and write two lines about anything unusual.", right: 0,
      fb: [["Yes. Totalling is plain code, then one model call writes the note. Same steps for every client, every month.", true],
        ["There is only one kind of case here: every client gets the same totals and the same note. Nothing to route between.", false],
        ["Nothing in the next step depends on a result: you always total, then write. An agent would pay calls to find that out each month.", false]] },
    { q: "<b>Portal questions.</b> VAT questions get the VAT answer template, payroll questions go to the payroll person, requests for an invoice copy get the PDF sent.", right: 1,
      fb: [["Each kind needs a different action: a template, a hand-off, a file sent. A chain does the same steps for all of them.", false],
        ["Yes. The question itself says which kind it is. One call names the kind, then that kind's fixed steps run.", true],
        ["After the kind is known, every step is fixed. An agent would add calls and new ways to go wrong (like saying it sent the PDF without sending it).", false]] },
    { q: "<b>Tax office letter.</b> A client got a letter about a missing payment. Find which return it is about, whether the payment was made, and whether it was late, wrong or never sent.", right: 2,
      fb: [["Which records to open depends on what the letter and the first records show: a return, then a payment, then maybe a bank line or a reminder. No fixed list covers all paths.", false],
        ["Every letter says “missing payment”. The real cause (late, wrong amount, never sent) only shows in the records. That is the case where the router failed in the trial.", false],
        ["Yes. Each record you open decides the next one. Give it a step limit, and check its trace when it gets one wrong.", true]] }
  ];
  function sortMore({ el, done, kit }) {
    ensureStyle();
    multiPick(el, done, kit, { opts: OPTS3, items: MORE, head: () => `<h1>Three more requests</h1>
      <p class="lead">The firm's staff sent three more requests. Ask the question from screen 3 for each: when can the next step be known?</p>
      <p class="task">Pick the least free shape that still covers each request.</p>` });
  }

  /* 8. The big picture, with a cost question from the trial. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const ch = cell(RUN_L, "A", "chain"), ag = cell(RUN_L, "A", "agent");
    const rc = ratio(ag.calls, ch.calls), rt = ratio(ag.tin, ch.tin);
    const opts = ["The number of model calls", "The input tokens", "The cases it gets right"];
    const fb = [
      [`Calls grew: ${ag.calls} against ${ch.calls}, about ${rc} times. But each agent turn also resends the tool list and the whole conversation, so something else grew faster.`, false],
      [`Right. Input tokens went from ${fmt(ch.tin)} to ${fmt(ag.tin)}, about ${rt} times, while calls grew about ${rc} times. Each turn resends the tool list and everything before it. At the firm's volume that is the cost you feel first, and the answers also arrive later.`, true],
      [`Both got ${ag.ok} of ${ag.n} right with the trial model. With the cheaper model the agent got ${cell(RUN_S, "A", "agent").ok}. Same or worse results, for more money.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Choosing the shape</h1>
        <p class="lead">Choosing the shape means giving the model only as much freedom as the task needs.</p>
        <ul class="lx-${ID}-shapes">
          <li><b>Reach for</b> a chain when the steps are known in advance; a router when the input tells you its kind; an agent when the next step depends on what a result shows and the paths are too many to write down.</li>
          <li><b>Not:</b> an agent for fixed steps; a router when the kind only shows in the data; a chain when each kind needs a different action. Often plain code with no model is enough.</li>
          <li><b>Costs:</b> an agent spends more calls and tokens per case, answers later, needs a stronger model and is harder to test. A router adds one call and can send a case to the wrong steps. A chain means you write and maintain every step.</li>
        </ul>
        <p class="task">The firm moves invoices from the chain to an agent, at the same volume. From the trial, which cost grows the most?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 9. Recognise it in new situations, including one where no model is needed at all. */
  const OPTS4 = ["Plain code, no model", "Fixed chain", "Router", "Agent loop"];
  const CASES = [
    { q: "Every night, copy the bank's CSV file of new transactions into the ledger's import format.", right: 0,
      fb: [["Yes. Columns in, columns out, the same every night. There is no language to read, so a model adds cost and a chance of a wrong number, and nothing else.", true],
        ["A chain still makes model calls. The file has fixed columns; plain code converts it exactly, for free, every time.", false],
        ["There is only one kind of input, a CSV with fixed columns. Nothing to classify, and no model needed to convert it.", false],
        ["No step depends on a result, and no text needs reading. An agent here pays for calls to do what ten lines of code do exactly.", false]] },
    { q: "Translate each letter from a client's Dutch accountant into English, then shorten it to five bullet points.", right: 1,
      fb: [["Translating and shortening free text is a language task: plain code cannot do it well. It needs model calls.", false],
        ["Yes. Two model calls in a fixed order, the same for every letter: translate, then shorten.", true],
        ["Every letter gets the same two steps. There is nothing to route between.", false],
        ["There is nothing to look up and no step depends on a result. Two fixed calls do it with fewer calls and less to go wrong.", false]] },
    { q: "A city permit office gets requests as free-text emails: parking permits, building permits and street-event permits, each handled by a different desk in its own way.", right: 2,
      fb: [["Deciding which kind a request is means reading free text. That is what one model call does well.", false],
        ["Each kind needs a different handling. A chain would do the same steps for a parking permit and for a building plan.", false],
        ["Yes. The email says what it asks for. One call names the kind; that desk's fixed steps follow.", true],
        ["Once the kind is known, the steps are fixed. An agent adds calls and new ways to fail, like the small model that said it replied and did not.", false]] },
    { q: "A manager asks: why did late payments rise last quarter? The assistant can query invoices, payments and client records, and each answer suggests where to look next.", right: 3,
      fb: [["The question is open: which query to run next depends on what the last one showed. Code cannot fix that order in advance.", false],
        ["A fixed list of queries would cover only the causes you thought of in advance.", false],
        ["Every such question looks alike (“why did X rise?”). The cause only shows in the data, as with bank vs ledger.", false],
        ["Yes. Each query decides the next. Give it a step limit, and read the trace to see whether it really checked before answering.", true]] }
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    multiPick(el, done, kit, { opts: OPTS4, items: CASES, head: () => `<h1>Which shape here?</h1>
      <p class="lead">Four tasks from other places. One more choice now: plain code, with no model at all.</p>
      <p class="task">Pick the least free shape that still does each task.</p>` });
  }

  /* 10. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can choose the shape</h1>
      <p class="lead">You sorted ${TRIED.length + MORE.length} chores and checked ${CHORES.length} against a real trial. The question that picks the shape is <b>when the next step can be known</b>: before the run (chain), after reading the input (router), or only after a result (agent). Then you take the least free shape that covers the task, because freedom costs calls, tokens and new ways to fail, and an agent needs a model strong enough to use it.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You saw an agent stop too early and guess. Next, an agent writes a plan first, follows it, and changes the plan when a step fails.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Agent or fixed workflow: choosing the right shape",
    checked: "2026-11-13",
    sources: [
      "https://www.anthropic.com/engineering/building-effective-agents",
      "https://docs.langchain.com/oss/python/langgraph/workflows-agents",
      "https://openrouter.ai/docs/api/reference/overview",
      "https://openrouter.ai/openai/gpt-4o-mini",
      "https://openrouter.ai/google/gemini-2.5-flash-lite"
    ],
    interview: [
      {
        q: "Your team's invoice pipeline is a fixed chain and works well. A colleague wants to rebuild it as an agent “so it is smarter”. What do you say?",
        good: [
          "Ask what the agent would decide that the chain cannot: if the steps are always the same, nothing",
          "An agent spends more model calls per case, and each call resends the conversation, so tokens grow faster than calls",
          "It adds failure modes: skipping a tool, asking a person who is not there, saying it acted when it did not",
          "It is harder to test, because the path can change from case to case",
          "Keep the chain; use an agent only for the cases whose next step depends on a result, measured on a small trial"
        ],
        weak: "Agree because agents are more capable, or refuse because agents are unreliable, without asking when the next step can be known."
      },
      {
        q: "You built a router for support tickets, and it sends most tickets to the wrong handler. How do you find out whether routing was the wrong shape?",
        good: [
          "Read the misrouted tickets: can a person tell the kind from the ticket text alone?",
          "If the kind only shows after looking at account data or logs, no router can see it; that needs look-ups first, or an agent",
          "If a person can tell from the text, fix the classifier: clearer labels, examples, an “other” route",
          "Measure routing accuracy on a small labelled set before and after the change"
        ],
        weak: "Switch to a bigger model for the router, without checking whether the information needed to route is in the input at all."
      }
    ],
    screens: [sortTried, trial, spotIdea, routerMiss, agentMiss, smallModel, sortMore, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["#c0 [data-wrong]"], right: TRIED.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: MORE.map((_, i) => `#c${i} [data-right]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c2 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
