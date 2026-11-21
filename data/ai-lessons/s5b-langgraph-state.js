/* Lesson: agents as state machines in LangGraph. Story: an online electronics store handles return requests that
   come in through its contact form: read the message, check the order, check the warranty, then approve the
   refund or escalate it to a person.
   Ideas: (1) put the allowed moves in a graph you own: nodes are steps, edges are the allowed moves, conditional
   edges are the branches, and a typed state record travels along; the model works inside one node and cannot
   skip a step; (2) a checkpointer saves that state after each step under a thread id, so a run that fails halfway
   continues from the failed node with invoke(None, config) instead of starting again.
   Depth: library (screens 4, 5, 6), debug (screen 2, the forgotten edge, a real TypeError), explain (1, 3, 7, 8).
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5b-langgraph-state/read-a, read-b, read-c: a small hosted
     model reading the three customer messages (requests written by make_requests.py);
   - docs/ai-path/runs/s5b-langgraph-state/refund_graph.py + refund_graph.out.txt: the LangGraph graph run on our
     Mac, replaying those three answers; store_tools.py holds the messages, the orders and the warranty rule.
   Lesson-local picture and style: a flow diagram in SVG (diagram()) and small boxes (.lx-s5b-langgraph-state-*),
   see ensureStyle(). Plain browser script. */
(() => {
  const ID = "s5b-langgraph-state";
  const NOTEBOOK_URL = "https://colab.research.google.com/github/Xusniddin-devv/atlas/blob/main/notebooks/s5b-langgraph-state.ipynb";
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s5b-langgraph-state/store_tools.py
  const TODAY = "2026-11-13", WARRANTY_MONTHS = 12;
  const ORDERS = {
    "EL-20417": { item: "wireless headphones", price: 129, delivered: "2026-03-18" },
    "EL-18862": { item: "14-inch laptop", price: 899, delivered: "2024-10-02" },
    "EL-31509": { item: "smart speaker", price: 59, delivered: "2026-09-27" }
  };
  const MESSAGES = {
    a: "Hi, my wireless headphones from order EL-20417 stopped charging last week. I got them in March. Can I have my money back?",
    b: "Hello. Order EL-18862, the laptop screen has started to flicker. I bought it a while ago but it was expensive and should not break like this. I want a refund.",
    c: "Good morning, the smart speaker I ordered (order number EL-31590) will not turn on at all. Please refund me."
  };
  // From docs/ai-path/recordings/s5b-langgraph-state/read-a, read-b, read-c (the model's whole answer, not altered)
  const REC_READ = {
    src: "s5b-langgraph-state/read-a, read-b, read-c",
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    text: {
      a: "{\n  \"order_id\": \"EL-20417\",\n  \"problem\": \"Headphones not charging\"\n}",
      b: "{\n\"order_id\": \"EL-18862\",\n\"problem\": \"flickering screen\"\n}",
      c: "{\n  \"order_id\": \"EL-31590\",\n  \"problem\": \"smart speaker will not turn on\"\n}"
    }
  };
  const CAPTION = `Recorded model output, ${REC_READ.recordedAt}`;
  // From docs/ai-path/runs/s5b-langgraph-state/refund_graph.out.txt
  const RUN = {
    // part 1: the graph without an edge for "order not found", message c (graph.stream, stream_mode="updates")
    broken: [
      ["read_request", "{\"order_id\": \"EL-31590\", \"log\": [\"model read order EL-31590\"]}"],
      ["check_order", "{\"order\": null, \"log\": [\"order not found\"]}"]
    ],
    brokenTrace: [
      "  File \"…/refund_graph.py\", line 70, in check_warranty",
      "    months = months_since(state[\"order\"][\"delivered\"])",
      "    …",
      "TypeError: 'NoneType' object is not subscriptable",
      "During task with name 'check_warranty' and id '…'"
    ],
    // part 2: the fixed graph
    fixed: {
      a: [["read_request", "{\"order_id\": \"EL-20417\", \"log\": [\"model read order EL-20417\"]}"],
          ["check_order", "{\"order\": {\"item\": \"wireless headphones\", \"price\": 129, \"delivered\": \"2026-03-18\"}, \"log\": [\"order found\"]}"],
          ["check_warranty", "{\"in_warranty\": true, \"log\": [\"7 months since delivery\"]}"],
          ["approve", "{\"log\": [\"refund 129 approved\"]}"]],
      b: [["read_request", "{\"order_id\": \"EL-18862\", \"log\": [\"model read order EL-18862\"]}"],
          ["check_order", "{\"order\": {\"item\": \"14-inch laptop\", \"price\": 899, \"delivered\": \"2024-10-02\"}, \"log\": [\"order found\"]}"],
          ["check_warranty", "{\"in_warranty\": false, \"log\": [\"25 months since delivery\"]}"],
          ["escalate", "{\"log\": [\"sent to a person\"]}"]],
      c: [["read_request", "{\"order_id\": \"EL-31590\", \"log\": [\"model read order EL-31590\"]}"],
          ["check_order", "{\"order\": null, \"log\": [\"order not found\"]}"],
          ["escalate", "{\"log\": [\"sent to a person\"]}"]]
    },
    finalLogA: ["model read order EL-20417", "order found", "7 months since delivery", "refund 129 approved"],
    finalKeysA: ["in_warranty", "log", "message", "order", "order_id"],
    // part 3: log: list without a reducer, message a
    noReducerLogA: ["refund 129 approved"],
    // part 4: checkpointer, message b, the warranty service fails once
    ckpt1: [["read_request", "{\"order_id\": \"EL-18862\", \"log\": [\"model read order EL-18862\"]}"],
            ["check_order", "{\"order\": {\"item\": \"14-inch laptop\", \"price\": 899, \"delivered\": \"2024-10-02\"}, \"log\": [\"order found\"]}"]],
    ckptError: "TimeoutError warranty service did not answer",
    ckptNext: "('check_warranty',)",
    ckptLogSaved: ["model read order EL-18862", "order found"],
    ckpt2: [["check_warranty", "{\"in_warranty\": false, \"log\": [\"25 months since delivery\"]}"],
            ["escalate", "{\"log\": [\"sent to a person\"]}"]],
    ckptEndNext: "()",
    ckptModelCalls: 1,
    plainModelCalls: 2,   // part 4b: no checkpointer, the whole run again after the failure
    // part 5
    noThread: "ValueError Checkpointer requires one or more of the following 'configurable' keys: thread_id, checkpoint_ns, checkpoint_id",
    threadId: "return-EL-18862"
  };

  /* ---------- Derived from the data ---------- */
  const J = s => JSON.parse(s);
  const READ = Object.fromEntries(Object.entries(REC_READ.text).map(([k, t]) => [k, J(t)]));
  const monthsSince = iso => {
    const [y, m, d] = iso.split("-").map(Number), [ty, tm, td] = TODAY.split("-").map(Number);
    return (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0);
  };
  const MONTHS = Object.fromEntries(Object.entries(ORDERS).map(([k, o]) => [k, monthsSince(o.delivered)]));
  const C_ASKED = READ.c.order_id;                                    // what the customer wrote
  const C_REAL = Object.keys(ORDERS).find(k => ORDERS[k].item === "smart speaker");
  const LAST_UPD = upd => J(upd[1]);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ---------- Lesson-local style, the diagram and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-dia { margin: 14px auto 0; max-width: 420px; }
      .lx-${ID}-dia svg { display: block; width: 100%; height: auto; }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .n rect { fill: var(--surface); stroke: var(--ink); stroke-width: 1.5; }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .n text { fill: var(--ink); font: 600 12.5px var(--mono); text-anchor: middle; dominant-baseline: central; }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .n.term rect { fill: var(--sunk); stroke: var(--muted); }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .n.term text { fill: var(--muted); }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .n.done rect { fill: var(--good-soft); stroke: var(--good); }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .n.on rect { stroke-width: 4; }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .n.bad rect { fill: var(--bad-soft); stroke: var(--bad); stroke-width: 3; }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .e line { stroke: var(--ink); stroke-width: 1.6; }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .e polygon { fill: var(--ink); }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .e.enter line { stroke: var(--good); stroke-width: 2.6; }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .e.enter polygon { fill: var(--good); }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .e.no line { stroke: var(--bad); stroke-width: 2.4; stroke-dasharray: 6 4; }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .e.no polygon { fill: var(--bad); }
      :is(.lx-${ID}-dia, .lx-${ID}-key) .e text { fill: var(--muted); font: 500 11.5px var(--font); text-anchor: middle; dominant-baseline: central; paint-order: stroke; stroke: var(--bg); stroke-width: 5px; stroke-linejoin: round; }
      .lx-${ID}-key { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 8px 0 0; font: 500 13px var(--font); color: var(--muted); }
      .lx-${ID}-key > span { display: inline-flex; align-items: center; gap: 6px; }
      .lx-${ID}-key svg { width: 34px; height: 20px; flex: none; }
      .lx-${ID}-msg { margin: 14px 0 0; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--sunk); font-size: 15.5px; line-height: 1.5; }
      .lx-${ID}-who { font: 600 12.5px/1.5 var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .lx-${ID}-mono { margin: 10px 0 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font: 500 13px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-mono b { color: var(--bad); font-weight: 600; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
      .lx-${ID}-ups { margin: 12px 0 0; display: grid; gap: 6px; }
      .lx-${ID}-ups > div { display: grid; grid-template-columns: 8.6em 1fr; gap: 10px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); font: 500 13px/1.5 var(--mono); }
      .lx-${ID}-ups > div > span:first-child { font-weight: 600; color: var(--ink); }
      .lx-${ID}-ups > div > span:last-child { color: var(--ink-2); overflow-wrap: anywhere; min-width: 0; }
      .lx-${ID}-ups > div.lx-${ID}-err { border: 2px solid var(--bad); }
      .lx-${ID}-pal { margin: 14px 0 0; display: grid; gap: 8px; }
      .lx-${ID}-pal button { text-align: left; font-family: var(--mono); font-size: 14px; }
      .lx-${ID}-checks button { display: flex; gap: 10px; align-items: flex-start; text-align: left; }
      .lx-${ID}-box { flex: none; width: 18px; height: 18px; margin-top: 2px; border: 2px solid var(--ink); border-radius: 3px; }
      .lx-${ID}-checks button[aria-pressed="true"] .lx-${ID}-box { background: var(--good); border-color: var(--good); }
      .lx-${ID}-wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: calc(12px + 4ch); text-indent: -4ch; }
      .lx-${ID}-small .lx-${ID}-dia { max-width: 330px; }
      .lx-${ID}-nb { display: inline-flex; align-items: center; min-height: 44px; }
      @media (max-width: 520px) {
        .lx-${ID}-ups > div { grid-template-columns: 1fr; gap: 2px; }
        .lx-${ID}-wrap .lcode div { font-size: 12.5px; }
      }
    `;
    document.head.appendChild(s);
  }

  // The flow diagram. Node positions are centres in a 340 x 400 box.
  const NODES = {
    START: { x: 170, y: 20, w: 76, term: true },
    read_request: { x: 170, y: 78, w: 136 },
    check_order: { x: 170, y: 140, w: 130 },
    check_warranty: { x: 92, y: 220, w: 150 },
    approve: { x: 72, y: 314, w: 100 },
    escalate: { x: 262, y: 314, w: 110 },
    END: { x: 170, y: 378, w: 64, term: true }
  };
  const NH = 30;
  // edges: [from, to, label?]; key "from>to"
  const ek = (a, b) => `${a}>${b}`;
  function diagram(kit, edges, { ecls = {}, ncls = {}, title = "" } = {}) {
    const clip = (a, b) => { // point where the line from a's centre to b's centre leaves box b
      const dx = a.x - b.x, dy = a.y - b.y, hw = b.w / 2 + 3, hh = NH / 2 + 3;
      const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
      return [b.x + dx * t, b.y + dy * t];
    };
    const r1 = n => Math.round(n * 10) / 10;
    const lines = edges.map(([f, t, label]) => {
      const a = NODES[f], b = NODES[t];
      const [x1, y1] = clip(b, a), [x2, y2] = clip(a, b);
      const ang = Math.atan2(y2 - y1, x2 - x1), L = 9, W = 5;
      const p = [[x2, y2], [x2 - L * Math.cos(ang) + W * Math.sin(ang), y2 - L * Math.sin(ang) - W * Math.cos(ang)], [x2 - L * Math.cos(ang) - W * Math.sin(ang), y2 - L * Math.sin(ang) + W * Math.cos(ang)]];
      const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2;
      return `<g class="e ${ecls[ek(f, t)] || ""}"><line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2 - L * 0.8 * Math.cos(ang))}" y2="${r1(y2 - L * 0.8 * Math.sin(ang))}"/><polygon points="${p.map(q => q.map(r1).join(",")).join(" ")}"/>${label ? `<text x="${r1(lx)}" y="${r1(ly)}">${kit.esc(label)}</text>` : ""}</g>`;
    }).join("");
    const boxes = Object.entries(NODES).map(([id, n]) => `<g class="n${n.term ? " term" : ""} ${ncls[id] || ""}"><rect x="${n.x - n.w / 2}" y="${n.y - NH / 2}" width="${n.w}" height="${NH}" rx="${n.term ? 15 : 6}"/><text x="${n.x}" y="${n.y}">${kit.esc(id)}</text></g>`).join("");
    return `<div class="lx-${ID}-dia">${title ? `<p class="lx-${ID}-cap">${kit.esc(title)}</p>` : ""}<svg viewBox="0 0 340 400" role="img" aria-label="${kit.esc(title || "flow diagram")}">${lines}${boxes}</svg></div>`;
  }
  // Legend for the diagram's marks, drawn with the diagram's own classes so it matches in both themes.
  const KEY_MARKS = {
    done: [`<g class="n done"><rect x="3" y="3" width="28" height="14" rx="4"/></g>`, "step ran"],
    on: [`<g class="n done on"><rect x="3" y="3" width="28" height="14" rx="4"/></g>`, "step that just ran"],
    bad: [`<g class="n bad"><rect x="3" y="3" width="28" height="14" rx="4"/></g>`, "step that crashed"],
    taken: [`<g class="e enter"><line x1="2" y1="10" x2="24" y2="10"/><polygon points="32,10 23,5 23,15"/></g>`, "arrow the run took"],
    added: [`<g class="e enter"><line x1="2" y1="10" x2="24" y2="10"/><polygon points="32,10 23,5 23,15"/></g>`, "arrow you added"],
    missing: [`<g class="e no"><line x1="2" y1="10" x2="24" y2="10"/><polygon points="32,10 23,5 23,15"/></g>`, "missing arrow"]
  };
  const legend = (kit, marks) => marks.length ? `<div class="lx-${ID}-key">${marks.map(m => `<span><svg viewBox="0 0 34 20" aria-hidden="true">${KEY_MARKS[m][0]}</svg>${kit.esc(KEY_MARKS[m][1])}</span>`).join("")}</div>` : "";
  const FIXED_EDGES = [["START", "read_request"], ["approve", "END"], ["escalate", "END"]];
  const POLICY_EDGES = [
    ["read_request", "check_order"],
    ["check_order", "check_warranty"],
    ["check_warranty", "approve", "in warranty"],
    ["check_warranty", "escalate", "out of warranty"]
  ];
  const NOT_FOUND_EDGE = ["check_order", "escalate", "not found"];
  const mono = (kit, s) => `<div class="lx-${ID}-mono">${kit.esc(s)}</div>`;
  const msg = (kit, who, text) => `<div class="lx-${ID}-msg"><div class="lx-${ID}-who">${kit.esc(who)}</div>${kit.esc(text)}</div>`;
  const ups = (kit, rows, errRow) => `<div class="lx-${ID}-ups">${rows.map(([n, u]) => `<div><span>${kit.esc(n)}</span><span>${kit.esc(u)}</span></div>`).join("")}${errRow ? `<div class="lx-${ID}-err"><span>${kit.esc(errRow[0])}</span><span>${kit.esc(errRow[1])}</span></div>` : ""}</div>`;
  const ask = (kit, opts, correct, picked, fbs) => `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;

  /* 1. The situation, and the by-hand task: draw the flow. */
  const PALETTE = [
    { e: POLICY_EDGES[0], ok: true, say: "Yes. The order number from the message is what the order check needs." },
    { e: ["read_request", "approve", "model says refund"], ok: false, say: "This arrow lets the reading step go straight to a refund. The policy says a refund comes only after the order and the warranty have been checked. Reading a message is not checking anything." },
    { e: POLICY_EDGES[1], ok: true, say: "Yes. Once the order is found, its delivery date tells you whether it is still in warranty." },
    { e: ["check_order", "approve", "order found"], ok: false, say: "Finding the order is not enough. A laptop bought two years ago is a real order too, and the policy sends it to a person. The warranty check has to sit between the order and the refund." },
    { e: POLICY_EDGES[2], ok: true, say: "Yes. Under 12 months since delivery: refund." },
    { e: ["approve", "escalate"], ok: false, say: "After a refund is approved, the request is finished. This arrow would send every approved refund to a person as well, which is the work the flow is meant to save." },
    { e: POLICY_EDGES[3], ok: true, say: "Yes. 12 months or more: a person decides." }
  ];
  const RIGHT_ARROWS = PALETTE.map((p, i) => p.ok ? i : -1).filter(i => i >= 0);
  const WRONG_ARROWS = PALETTE.map((p, i) => p.ok ? -1 : i).filter(i => i >= 0);
  const arrowTxt = ([f, t, l]) => `${f} → ${t}${l ? `  (${l})` : ""}`;
  function drawFlow({ el, done, kit }) {
    ensureStyle();
    const on = new Set();
    let last = null;
    const paint = () => {
      const fin = RIGHT_ARROWS.every(i => on.has(i));
      const edges = [...FIXED_EDGES, ...[...on].map(i => PALETTE[i].e)];
      const ecls = {};
      if (last != null && PALETTE[last].ok) ecls[ek(PALETTE[last].e[0], PALETTE[last].e[1])] = "enter";
      el.innerHTML = `<h1>A return request, drawn as a flow</h1>
        <p class="lead">An online electronics store gets return requests through its contact form. A teammate wants an AI assistant to handle them. The store's policy, in its own words: <i>read the customer's message and find the order number. Look up the order. If it was delivered less than ${WARRANTY_MONTHS} months ago it is in warranty: approve the refund. Otherwise, escalate it to a person.</i></p>
        <p class="lead">The risk: an assistant that picks its own next step can skip a check, such as the warranty check. This lesson builds the flow as a graph you own, so the model cannot leave it.</p>
        <p class="lead">Before any code, draw the flow. Each box is one step. An arrow says which step may come next.</p>
        <p class="task">Add the arrows the policy describes. Tap an arrow to add it to the diagram.</p>
        ${diagram(kit, edges, { ecls, title: "The return flow" })}
        <div class="lopts lx-${ID}-pal">${PALETTE.map((p, i) => `<button type="button" data-a="${i}" class="${on.has(i) ? "right" : last === i && !p.ok ? "wrong" : ""}"${on.has(i) ? ' aria-pressed="true"' : ""}>${kit.esc(arrowTxt(p.e))}</button>`).join("")}</div>
        <div class="lpanel">${fin
          ? kit.feedback(`That is the flow the policy describes: ${plural(RIGHT_ARROWS.length + FIXED_EDGES.length, "arrow")}, ${Object.keys(NODES).length - 2} steps, and one fork (a step with two ways out) at <code>check_warranty</code>. Next you will run a real request through it.`, true)
          : last != null ? kit.feedback(kit.esc(PALETTE[last].say), PALETTE[last].ok) : ""}</div>`;
      el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
        const i = +b.dataset.a;
        last = i;
        if (PALETTE[i].ok) on.add(i);
        paint();
        if (RIGHT_ARROWS.every(k => on.has(k))) done();
      });
    };
    paint();
  }

  /* 2. Broken on purpose: step a real run through the policy diagram and find the edge you forgot. */
  function findEdge({ el, done, kit }) {
    ensureStyle();
    let pos = -1, cause = null, fix = null;
    const STEPS = RUN.broken.length + 1;   // two node updates, then the crash
    const causes = [
      "The line in check_warranty that the traceback points to: it reads the delivery date without checking first",
      `The model read the order number wrong: it should have said ${C_REAL}`,
      "check_order has only one way out. Nothing in the flow says where to go when the order is not found",
      "A bug in LangGraph: a node returned null and the framework did not stop the run"
    ];
    const causeFb = [
      [`That line is where the error <i>shows</i>, not where it starts. <code>check_warranty</code> was written to expect an order, because the policy only sends found orders to it. The run got there anyway, with <code>order</code> set to <code>null</code>. Look at what came before it.`, false],
      [`Read the customer's message again: they wrote <code>${kit.esc(C_ASKED)}</code>, and the model copied exactly that (it was asked for the number "exactly as the customer wrote it"). The store's real order is <code>${kit.esc(C_REAL)}</code>: the customer swapped two digits. Customers will always mistype, so the flow must handle a missing order. Making the model guess would be worse.`, false],
      [`Right. <code>check_order</code> did its job: it said "not found" and set <code>order</code> to <code>null</code>. But the diagram has a single arrow out of it, so the run went on to the warranty check with no order. The policy text never said what to do with an unknown order, and neither did your diagram. That is the forgotten arrow (LangGraph calls an arrow an <b>edge</b>).`, true],
      [`LangGraph ran exactly the graph it was given. A node may set a field to <code>null</code>; that is a normal value. The graph had a plain arrow from <code>check_order</code> to <code>check_warranty</code>, so that is where the run went.`, false]
    ];
    const fixes = [
      "Add a system prompt line: “Only pass on order numbers that exist in our system”",
      "Make the arrow out of check_order a fork: order found → check_warranty, not found → escalate",
      "Catch the error around graph.invoke and run the whole request again"
    ];
    const fixFb = [
      [`The model never sees the order system. It can only copy or guess. Whether an order exists is a fact your code looks up, and what happens next is a rule your flow decides.`, false],
      [`Right. That is a <b>conditional edge</b>: after <code>check_order</code>, a small function looks at the state and picks the next step. The real run on the fixed graph:`, true],
      [`The order <code>${kit.esc(C_ASKED)}</code> still does not exist on the second try, so the run crashes in the same place again. A retry fixes a passing fault, not a missing arrow.`, false]
    ];
    const paint = () => {
      const ncls = {}, ecls = {};
      const nodesDone = RUN.broken.slice(0, Math.max(0, Math.min(pos + 1, RUN.broken.length))).map(r => r[0]);
      nodesDone.forEach(n => { ncls[n] = "done"; });
      if (pos >= 0 && pos < RUN.broken.length) ncls[RUN.broken[pos][0]] += " on";
      const crashed = pos === STEPS - 1;
      if (crashed) ncls.check_warranty = "bad";
      if (cause === 2) ecls[ek("check_order", "escalate")] = fix === 1 ? "enter" : "no";
      const edges = [...FIXED_EDGES, ...POLICY_EDGES, ...(cause === 2 ? [NOT_FOUND_EDGE] : [])];
      el.innerHTML = `<h1>Run a real request through your flow</h1>
        <p class="lead">Your flow was built as a LangGraph graph on our Mac, arrow for arrow, and fed this request from the contact form:</p>
        ${msg(kit, "customer", MESSAGES.c)}
        <p class="lead">The first step asks a model to pull out the order number. A small hosted model answered:</p>
        ${mono(kit, REC_READ.text.c)}
        <p class="lx-${ID}-cap">${CAPTION}</p>
        <p class="task">${crashed ? "The run crashed. Find the cause." : "Tap Next step to move the run through the diagram until it stops."}</p>
        ${diagram(kit, edges, { ncls, ecls })}
        ${legend(kit, [...(pos >= 0 ? ["done"] : []), ...(pos >= 0 && !crashed ? ["on"] : []), ...(crashed ? ["bad"] : []), ...(cause === 2 ? [fix === 1 ? "added" : "missing"] : [])])}
        ${pos >= 0 ? `<p class="lx-${ID}-cap">What each step wrote into the state (the record the run carries from step to step):</p>${ups(kit, RUN.broken.slice(0, Math.min(pos + 1, RUN.broken.length)), crashed ? ["check_warranty", "crashed (traceback below)"] : null)}` : ""}
        ${crashed ? `<pre class="lx-${ID}-mono">${RUN.brokenTrace.map((l, i) => l.startsWith("TypeError") ? `<b>${kit.esc(l)}</b>` : kit.esc(l)).join("\n")}</pre><p class="lx-${ID}-cap">The end of the real traceback, trimmed with …. In plain words: the code tried to read <code>["delivered"]</code> from <code>None</code>, Python's null.</p>` : ""}
        <div class="lsteps"><button type="button" class="btn" data-next ${crashed ? "disabled" : ""}>Next step</button></div>
        ${crashed ? `<div class="lpanel"><div class="lcase" id="q0"><p>Where is the cause?</p>${ask(kit, causes.map(kit.esc), 2, cause, causeFb)}</div>
          ${cause === 2 ? `<div class="lcase" id="q1"><p>Which fix belongs in the flow?</p>${ask(kit, fixes.map(kit.esc), 1, fix, fixFb)}${fix === 1 ? ups(kit, RUN.fixed.c) : ""}</div>` : ""}</div>` : ""}`;
      el.querySelector("[data-next]").onclick = () => { if (pos < STEPS - 1) { pos++; paint(); } };
      el.querySelectorAll("#q0 .lopts button").forEach(b => b.onclick = () => { cause = +b.dataset.i; if (cause !== 2) fix = null; paint(); });
      el.querySelectorAll("#q1 .lopts button").forEach(b => b.onclick = () => { fix = +b.dataset.i; paint(); if (cause === 2 && fix === 1) done(); });
    };
    paint();
  }

  /* 3. Spot the idea: where must the rule live? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "One agent loop with the tools check_order, check_warranty and issue_refund, and a system prompt: “Always check the warranty before you refund.”",
      "A graph you write: the refund step can only be reached through the “in warranty” arrow out of check_warranty. The model only reads the message.",
      "Let the model call any tool in any order, and check the logs every evening for refunds without a warranty check."
    ];
    const fb = [
      [`In an agent loop the model picks the next tool on every turn. The prompt asks it to check first, but nothing in your code stops it from calling <code>issue_refund</code> on turn one. A rule that must hold every time cannot be a request.`, false],
      [`Right. The order of the steps now lives in code you own. The model works inside one step and fills in one field; it cannot add an arrow. This is a <b>state machine</b>: a fixed set of steps (LangGraph calls them <b>nodes</b>), the allowed moves between them (<b>edges</b>), forks decided by code (<b>conditional edges</b>), and one record that travels along and that every step reads and writes (the <b>state</b>).`, true],
      [`By evening the money is gone. Logs tell you a rule was broken; they do not stop it. Put the rule where the step happens.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Where must the warranty rule live?</h1>
        <p class="lead">The store's owner adds one hard rule: <b>no refund may ever go out without a warranty check</b>. Not usually. Never.</p>
        <p class="task">Which design makes that true?</p>
        <div class="lpanel">${ask(kit, opts.map(kit.esc), 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. The typed state and its reducer: predict the real run. */
  const STATE_CODE = [
    "class Return(TypedDict):",
    "    message: str",
    "    order_id: str",
    "    order: dict | None",
    "    in_warranty: bool",
    "    log: Annotated[list, operator.add]"
  ];
  const NODE_CODE = [
    "def check_order(state):",
    "    order = find_order(state[\"order_id\"])",
    "    return {\"order\": order, \"log\": [f\"order {'found' if order else 'not found'}\"]}"
  ];
  function predictState({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null];
    const nNodes = RUN.fixed.a.length;
    const Q = [
      { q: `Request a (the headphones) runs. <code>check_order</code> returns only <code>order</code> and <code>log</code>. Afterwards, is <code>message</code> still in the state?`,
        opts: ["No: the state is now only what check_order returned", "Yes: LangGraph merges the returned keys into the state, and the other keys stay as they were", "Yes, but set to None"],
        right: 1,
        fb: [
          [`A node returns a <b>partial update</b>, not a new state. Think of React's old <code>this.setState({ order })</code>: it merges, it does not replace. The final state of run a still had all of <code>${kit.esc(RUN.finalKeysA.join(", "))}</code>.`, false],
          [`Right. The final state of run a had the keys <code>${kit.esc(RUN.finalKeysA.join(", "))}</code>. Each node returns only what it changed.`, true],
          [`Keys a node does not return are left alone. The final state of run a still held the customer's message word for word.`, false]
        ] },
      { q: `Each of the ${WORDS[nNodes]} steps in run a returns a <code>log</code> list with one line. <code>log</code> is declared with <code>operator.add</code>. What is <code>log</code> at the end?`,
        opts: ["Only the last line, from approve", `All ${WORDS[nNodes]} lines, in the order the steps ran`, `A list of ${WORDS[nNodes]} lists`],
        right: 1,
        fb: [
          [`That is what happens <i>without</i> <code>operator.add</code> (next question). With it, LangGraph combines old and new: <code>old + new</code>.`, false],
          [`Right. The real final log: <code>${kit.esc(JSON.stringify(RUN.finalLogA))}</code>. The function in <code>Annotated[...]</code> is a <b>reducer</b>: it says how an update joins the value already there. <code>operator.add</code> on two lists joins them, like JavaScript's <code>[...old, ...new]</code>.`, true],
          [`<code>operator.add</code> on two lists is <code>old + new</code>: one flat list, not nested. The real final log: <code>${kit.esc(JSON.stringify(RUN.finalLogA))}</code>.`, false]
        ] },
      { q: `The same graph, but the state says <code>log: list</code>, with no reducer. Run a again. What is <code>log</code> at the end?`,
        opts: [`All ${WORDS[nNodes]} lines, as before`, "An error: two steps wrote the same key", `Only the last line: ${RUN.noReducerLogA[0]}`],
        right: 2,
        fb: [
          [`Without a reducer the default is to replace: each step's list overwrites the one before. No error, no warning, and the history is gone. This is a quiet bug to look for when a log or a message list keeps only its last entry.`, false],
          [`Steps that run one after another may write the same key; the later one wins. The run finished without any error.`, false],
          [`Right. The real run printed <code>${kit.esc(JSON.stringify(RUN.noReducerLogA))}</code>. With no reducer, the default replaces the value. No error, just a lost history, which makes it a bug to check for whenever a list keeps only its last item.`, true]
        ] }
    ];
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== Q[i].right);
      const show = upto === -1 ? Q.length : upto + 1;
      el.innerHTML = `<h1>The record that travels: typed state</h1>
        <p class="lead">In LangGraph the state is a typed dict that you declare once, a bit like a TypeScript type for an object. Every node is a plain Python function: it gets the state and returns the keys it wants to change. From our <code>refund_graph.py</code>:</p>
        ${kit.code(STATE_CODE, -1)}
        <div class="lx-${ID}-wrap">${kit.code(NODE_CODE, -1)}</div>
        <p class="lx-${ID}-cap">The <code>log</code> line is the only unusual one. The questions below explain it.</p>
        <p class="task">Predict each result of the real run. The next question opens when you have the last one right.</p>
        ${Q.slice(0, show).map((q, i) => `<div class="lcase" id="p${i}"><p>${q.q}</p>${ask(kit, q.opts.map(kit.esc), q.right, ans[i], q.fb)}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, k) => a === Q[k].right)) done();
      }));
    };
    paint();
  }

  /* 5. The graph as code: step run b, predicting each fork. */
  // From build() in refund_graph.py, the fixed branch; the five add_node lines are cut and marked with a line "…"
  const GRAPH_CODE = [
    "g = StateGraph(Return)",
    "…",
    "g.add_edge(START, \"read_request\")",
    "g.add_edge(\"read_request\", \"check_order\")",
    "g.add_conditional_edges(\"check_order\", after_order,",
    "    {\"found\": \"check_warranty\", \"not_found\": \"escalate\"})",
    "g.add_conditional_edges(\"check_warranty\", after_warranty)",
    "g.add_edge(\"approve\", END)",
    "g.add_edge(\"escalate\", END)",
    "graph = g.compile()"
  ];
  // The two routing functions from refund_graph.py, quoted in the fork feedback
  const ROUTE_CODE = {
    after_order: ["def after_order(state):", "    return \"found\" if state[\"order\"] else \"not_found\""],
    after_warranty: ["def after_warranty(state):", "    return \"approve\" if state[\"in_warranty\"] else \"escalate\""]
  };
  function graphCode({ el, done, kit }) {
    ensureStyle();
    const B = RUN.fixed.b, orderB = LAST_UPD(B[1]).order, monthsB = MONTHS[READ.b.order_id];
    const route = name => `<pre class="lx-${ID}-mono">${ROUTE_CODE[name].map(kit.esc).join("\n")}</pre>`;
    let stage = 0, pick = [null, null];
    const asks = [
      { line: 4, q: `<code>check_order</code> found the ${kit.esc(orderB.item)}. Which node runs next?`,
        opts: ["check_warranty", "escalate", "approve"], right: 0,
        fb: [
          [`Right. The routing function is a few lines of plain Python:${route("after_order")}It saw an order and returned <code>"found"</code>, and the dict passed with it maps <code>"found"</code> to <code>check_warranty</code>.`, true],
          [`<code>escalate</code> is where <code>"not_found"</code> leads. The order is in the state, so <code>after_order</code> returns <code>"found"</code>:${route("after_order")}`, false],
          [`No arrow leads from <code>check_order</code> to <code>approve</code>. That is the whole point of the graph: the refund is out of reach until the warranty is checked.`, false]
        ] },
      { line: 6, q: `<code>check_warranty</code> wrote <code>in_warranty: false</code> (${monthsB} months since delivery). Which node runs next?`,
        opts: ["approve", "escalate", "check_order, to look again"], right: 1,
        fb: [
          [`<code>after_warranty</code> returns <code>"approve"</code> only when <code>in_warranty</code> is true:${route("after_warranty")}${monthsB} months is past the ${WARRANTY_MONTHS}-month warranty.`, false],
          [`Right. This fork has no dict that maps names to nodes, so <code>after_warranty</code> returns the node name itself:${route("after_warranty")}`, true],
          [`There is no arrow back to <code>check_order</code>, and the order is already in the state. A graph only moves along the arrows you added.`, false]
        ] }
    ];
    const paint = () => {
      const shown = stage === 0 ? 2 : stage === 1 ? 3 : 4;
      const ncls = {};
      B.slice(0, shown).forEach(([n]) => { ncls[n] = "done"; });
      ncls[B[shown - 1][0]] += " on";
      if (stage === 2) ncls.END = "done";
      const edges = [...FIXED_EDGES, ...POLICY_EDGES, NOT_FOUND_EDGE];
      const ecls = {};
      for (let i = 1; i < shown; i++) ecls[ek(B[i - 1][0], B[i][0])] = "enter";
      if (stage === 2) ecls[ek(B[3][0], "END")] = "enter";
      const a = asks[stage];
      const active = stage === 2 ? 8 : a.line;
      el.innerHTML = `<h1>The same flow, as LangGraph code</h1>
        <p class="lead">The body of <code>build()</code> in our <code>refund_graph.py</code>, which builds the fixed graph. Request b ran through it: the ${kit.esc(orderB.item)}, order ${kit.esc(READ.b.order_id)}, delivered ${kit.esc(orderB.delivered)}.</p>
        <div class="lx-${ID}-wrap">${kit.code(GRAPH_CODE, active)}</div>
        <p class="lx-${ID}-cap">The five <code>add_node</code> lines are cut (…). <code>after_order</code> and <code>after_warranty</code> are small routing functions: each reads the state and names the next step.</p>
        <p class="task">${stage < 2 ? "At each fork, predict where the run goes." : "Done: the run reached END."}</p>
        ${stage < 2 ? `<p class="lx-${ID}-cap">What <code>${kit.esc(B[shown - 1][0])}</code> just wrote into the state:</p>${ups(kit, B.slice(shown - 1, shown))}` : ups(kit, B)}
        <div class="vars"><span>step <b>${shown} / ${B.length}</b></span><span>next <b>${stage < 2 ? "?" : "END"}</b></span></div>
        <div class="lpanel">${stage > 0 ? kit.feedback(asks[stage - 1].fb[asks[stage - 1].right][0], true) : ""}${stage < 2 ? `<div class="lcase"><p>${a.q}</p>${ask(kit, a.opts.map(kit.esc), a.right, pick[stage], a.fb)}</div>`
          : kit.feedback(`The real run went <code>${B.map(r => r[0]).join(" → ")}</code>. Each row above the diagram is exactly what that node returned. <code>add_edge</code> is an arrow that is always taken; <code>add_conditional_edges</code> is a fork, and its function reads the state to choose. <code>compile()</code> turns the builder into something you can <code>invoke</code> or <code>stream</code>, and is where a checkpointer is attached (next screen). Request a took the other fork and ended with <code>${kit.esc(RUN.fixed.a[3][1])}</code>.`, true)}</div>
        <div class="lx-${ID}-small">${diagram(kit, edges, { ncls, ecls, title: "The run so far" })}${legend(kit, ["done", "on", "taken"])}</div>`;
      el.querySelectorAll(".lcase .lopts button").forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        pick[stage] = i;
        if (i === asks[stage].right) { stage++; }
        paint();
        if (stage === 2) done();
      });
    };
    paint();
  }

  /* 6. The checkpointer: predict what the real run did after a failure. */
  const CKPT_CODE = [
    "saved = build(checkpointer=InMemorySaver())",
    `config = {"configurable": {"thread_id": "${RUN.threadId}"}}`,
    "stream(saved, start(\"b\"), config)   # fails in check_warranty",
    "snap = saved.get_state(config)",
    "stream(saved, None, config)"
  ];
  function checkpoint({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null, null];
    const Q = [
      { q: `The first run stops with <code>${kit.esc(RUN.ckptError)}</code> inside <code>check_warranty</code>. What is <code>snap.next</code>, the node the saved state says comes next?`,
        opts: ["()  — nothing, the run is over", "('read_request',)  — start again", "('check_warranty',)  — the step that failed"],
        right: 2,
        fb: [
          [`<code>()</code> means a finished run. This one is not finished: it stopped in the middle.`, false],
          [`The checkpointer saved the state after <code>read_request</code> and again after <code>check_order</code>. Those steps are done; their results are in the saved state.`, false],
          [`Right. The real run printed <code>${kit.esc(RUN.ckptNext)}</code>, and the saved <code>log</code> was <code>${kit.esc(JSON.stringify(RUN.ckptLogSaved))}</code>. The checkpointer saved a snapshot of the state after each step, under the thread id.`, true]
        ] },
      { q: `The warranty service is back. The last line runs the graph again with <code>None</code> as the input and the same <code>config</code> (the same thread id). Which nodes run?`,
        opts: ["All of them again, from read_request (so the model is asked again)", "check_warranty, then escalate", "Only check_warranty, then it stops"],
        right: 1,
        fb: [
          [`<code>None</code> as input means "no new input, continue this thread". The finished steps are not run again. The run made ${plural(RUN.ckptModelCalls, "model call")} in all; the same failure without a checkpointer, run again from the start, made ${RUN.plainModelCalls}.`, false],
          [`Right. The real run printed only these two updates:${ups(kit, RUN.ckpt2)}Then <code>next</code> was <code>${kit.esc(RUN.ckptEndNext)}</code>: finished. The model was called ${RUN.ckptModelCalls === 1 ? "once" : RUN.ckptModelCalls + " times"} in all. Without a checkpointer you start over, and the same failure cost ${RUN.plainModelCalls} model calls. On a long run with many model calls, that is the difference between redoing one step and redoing the whole run. The failed step itself does run again, from its first line, so a step with a side effect (a payment, an email) must be safe to run twice.`, true],
          [`The graph continues along its arrows as usual. <code>check_warranty</code> wrote <code>in_warranty: false</code>, so the fork sent the run on to <code>escalate</code>, and then to END.`, false]
        ] },
      { q: `A teammate calls <code>saved.invoke(...)</code> on the same compiled graph but forgets the <code>config</code>. What happens?`,
        opts: ["It runs and saves under a default thread", "It runs, and nothing is saved", "It fails at once and asks for a thread_id"],
        right: 2,
        fb: [
          [`There is no default thread. A thread id is how you find a run again; LangGraph will not invent one for you.`, false],
          [`It does not run quietly. A graph compiled with a checkpointer insists on knowing where to save.`, false],
          [`Right. The real error: <code>${kit.esc(RUN.noThread)}</code>. One thread id per conversation or per case (here, per return request), stored where you can find it again.`, true]
        ] }
    ];
    const paint = () => {
      const upto = ans.findIndex((a, i) => a !== Q[i].right);
      const show = upto === -1 ? Q.length : upto + 1;
      el.innerHTML = `<h1>When a step fails halfway</h1>
        <p class="lead">Request b again. This time the warranty service times out the first time it is called (our script made it fail once on purpose). The graph now has a <b>checkpointer</b>: a store that saves a snapshot of the state after each step. Each snapshot is filed under a <b>thread id</b>, a name you choose for the run.</p>
        <div class="lx-${ID}-wrap">${kit.code(CKPT_CODE, -1)}</div>
        <p class="lx-${ID}-cap"><code>build()</code> is the code from the last screen, with the checkpointer passed to <code>compile()</code>. <code>start("b")</code> makes the first state from message b. <code>stream</code> is a helper in our script that prints each node's update. <code>get_state</code> reads the saved snapshot.</p>
        <p class="lx-${ID}-cap">The first run printed:</p>
        ${ups(kit, RUN.ckpt1, ["check_warranty", RUN.ckptError])}
        <p class="task">Predict each result of the real run. The next question opens when you have the last one right.</p>
        ${Q.slice(0, show).map((q, i) => `<div class="lcase" id="p${i}"><p>${q.q}</p>${ask(kit, q.opts.map(kit.esc), q.right, ans[i], q.fb)}</div>`).join("")}
        ${show === Q.length && ans[2] === 2 ? `<p class="lead"><code>InMemorySaver</code> keeps the snapshots in memory, so they are gone when the process stops. LangGraph also offers savers that write to a database: <code>SqliteSaver</code> for local work, <code>PostgresSaver</code> for production.</p>` : ""}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (ans.every((a, k) => a === Q[k].right)) done();
      }));
    };
    paint();
  }

  /* 7. The big picture, with a task. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A tool that turns each new blog post into a tweet: one prompt, one answer, posted by a person.",
      "Loan pre-approval: read the form, check the credit report, then three different paths depending on the score, and the credit bureau is sometimes down.",
      "A coding assistant that must not merge until the tests pass and a reviewer has looked."
    ];
    const fb = [
      ["Right. One step, no fork, nothing to resume: a graph would add a framework, a state schema and a saver to what is one function call. Write the function.", true],
      ["This one has fixed steps, forks the business decides, and an outside service that fails. Those are exactly the parts a graph and a checkpointer handle.", false],
      ["“Must not merge until…” is a rule that has to hold every time. An arrow you own (tests → review → merge) holds it; a prompt does not.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to draw the graph</h1>
        <p class="lead"><b>What it is for:</b> flows whose steps and forks are known in advance and must be followed every time. The model does the reading and writing inside the steps. A checkpointer adds runs that survive a failure, and long runs you can pick up later.</p>
        <p class="lead"><b>When not:</b> one prompt with no forks (write a function), or a task where nobody can list the steps in advance (use an agent loop that picks its own tools). LangChain's ready-made agents are themselves built on LangGraph.</p>
        <p class="lead"><b>What it costs:</b> more code and more ideas to learn than a single call, a typed state to keep in step with your data, a database for the checkpoints, and a framework that changes between versions.</p>
        <p class="task">Which one does <i>not</i> need a hand-built graph?</p>
        <div class="lpanel">${ask(kit, opts.map(kit.esc), 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations. */
  const CASES = [
    ["A clinic's booking assistant: read the patient's request, check insurance, then book, or offer a self-pay price, or hand over to the front desk. The insurance check sometimes times out.", true,
      "Yes. Known steps, a three-way fork the clinic decides, and an outside service that fails: nodes, a conditional edge, and a checkpointer so a timeout does not restart the whole booking.",
      "Look at the shape: fixed steps, a fork with three outcomes that the clinic, not the model, must decide, and a flaky service in the middle. That is a state machine with a checkpointer."],
    ["Translating 500 product descriptions into Spanish. Each one is a single prompt; nothing depends on the answer.", false,
      "Right, no. There is no fork and no step after the answer. A plain loop over the descriptions, with a list of the ones already done, gives you everything a graph would here.",
      "Ask what an arrow would decide. Every description takes the same single step, and nothing branches on the answer. A loop that skips finished items already resumes after a crash, without a graph."],
    ["A bank's onboarding agent: check the ID, then screen the name against sanctions lists. Any hit goes to a compliance officer. A screening can take a day to come back.", true,
      "Yes. The order (ID before screening, any hit to a person) is a rule that must hold every time, and a run that waits a day needs its state saved under a thread id.",
      "This is a compliance rule, so it cannot depend on a prompt, and the day-long wait means the state must be saved and picked up later. Both point to a graph with a checkpointer."]
  ];
  function recognise({ el, done, kit }) {
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>A state graph here?</h1>
        <p class="lead">Three jobs, away from the electronics store.</p>
        <p class="task">For each one, decide if it should be built as a graph of steps with saved state. Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next: the notebook and its checklist. */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CHECKS = [
    `The graph with no "not found" arrow fails on request c with <code>TypeError: 'NoneType' object is not subscriptable</code>, during the task <code>check_warranty</code>.`,
    `After adding the conditional edge, request c prints ${RUN.fixed.c.length} updates and its log ends with <code>${esc(LAST_UPD(RUN.fixed.c[RUN.fixed.c.length - 1]).log[0])}</code>.`,
    `With <code>log: list</code> and no reducer, request a's final log is <code>${esc(JSON.stringify(RUN.noReducerLogA))}</code>.`,
    `After the timeout, <code>get_state(config).next</code> is <code>${esc(RUN.ckptNext)}</code>, and running the graph again with <code>None</code> as input runs only <code>${RUN.ckpt2.map(r => r[0]).join("</code> and <code>")}</code>.`,
    `Invoking the saved graph without a config raises a <code>ValueError</code> that names <code>thread_id</code>.`
  ];
  function whatNext({ el, done, kit, topic }) {
    ensureStyle();
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can draw an agent as a state machine</h1>
      <p class="lead">You drew the return flow, found the arrow the policy forgot, put the warranty rule where the model cannot skip it, and saw the typed state, the reducer, the forks and the checkpointer do their work in a real LangGraph run.</p>
      <p class="lead"><b>Practice:</b> ${NOTEBOOK_URL ? `<a class="lx-${ID}-nb" href="${kit.esc(NOTEBOOK_URL)}" target="_blank" rel="noopener">open the notebook</a>` : "The notebook for this lesson is on its way"}. It builds the same graph with the recorded model answers, breaks it, fixes it, and makes the warranty check fail once. It is also where your portfolio agent starts: the same graph, ready for its own tools. What you should see:</p>
      <p class="lx-${ID}-cap">Tap an item when you see it. Optional; nothing is saved.</p>
      <div class="lopts lx-${ID}-checks">${CHECKS.map((c, i) => `<button type="button" data-c="${i}" aria-pressed="false"><span class="lx-${ID}-box" aria-hidden="true"></span><span>${c}</span></button>`).join("")}</div>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. The same saved state lets a graph stop before a risky step and wait for a person, then carry on.</p>` : ""}`;
    el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("right", on);
    });
    done();
  }

  LessonKit.define(ID, {
    title: "Agents as state machines in LangGraph",
    checked: "2026-11-13",
    sources: [
      "https://docs.langchain.com/oss/python/langgraph/graph-api",
      "https://docs.langchain.com/oss/python/langgraph/checkpointers",
      "https://docs.langchain.com/oss/python/langgraph/persistence",
      "https://docs.langchain.com/oss/python/langgraph/overview"
    ],
    interview: [{
      q: "Your returns agent is one LLM loop with tools, and now and then it approves a refund without checking the warranty. How would you restructure it?",
      good: [
        "Move the order of steps out of the prompt and into a graph: nodes for each step, edges for allowed moves, a conditional edge for the warranty fork",
        "Keep the model inside the steps that need language (reading the message, writing the reply); the refund is reachable only through the warranty check",
        "Declare a typed state, with reducers for lists such as a log or messages, so updates merge instead of overwrite",
        "Draw every outcome of every step, including the unhappy ones (order not found), and test each path with real cases"
      ],
      weak: "Make the prompt stricter or switch to a bigger model. That still leaves the order of steps up to the model on every turn."
    }, {
      q: "A multi-step agent run fails at step 6 of 8 because an outside API timed out. Restarting from scratch costs model calls and repeats work. What do you do?",
      good: [
        "Compile the graph with a checkpointer backed by a database, not memory, and give each case its own thread id",
        "After the failure, continue the same thread with invoke(None, config): finished steps are not run again",
        "The failed step runs again from its start, so make its side effects safe to repeat",
        "Inspect get_state(config) to see the saved values and which node is next before resuming"
      ],
      weak: "Wrap the whole run in a retry. That repeats every model call and every side effect before the failure."
    }],
    screens: [drawFlow, findEdge, spotIdea, predictState, graphCode, checkpoint, bigPicture, recognise, whatNext],
    walk: [
      { wrong: [`[data-a="${WRONG_ARROWS[0]}"]`], right: RIGHT_ARROWS.map(i => `[data-a="${i}"]`) },
      { wrong: [...Array(RUN.broken.length + 1).fill("[data-next]"), "#q0 [data-wrong]"], right: [...Array(RUN.broken.length + 1).fill("[data-next]"), "#q0 [data-right]", "#q1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#p0 [data-wrong]"], right: ["#p0 [data-right]", "#p1 [data-right]", "#p2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["#p0 [data-wrong]"], right: ["#p0 [data-right]", "#p1 [data-right]", "#p2 [data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
