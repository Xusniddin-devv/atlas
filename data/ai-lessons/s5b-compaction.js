/* Lesson: compaction, shrinking an agent's context mid-task. Story: a data-cleaning agent works through 40 messy
   supplier price sheets for a grocery chain. One supplier (Hartley Farms) quotes prices per case of 12; the agent
   asked the buyer once, and the buyer said the rule holds for every Hartley file.
   Ideas: (1) tool result clearing: old tool results that can be fetched again, or whose work is done, can be
   replaced by a placeholder; what a person told the agent cannot be fetched again and must stay word for word;
   (2) the library way (LangChain's ClearToolUsesEdit, which ContextEditingMiddleware applies before each model
   call; LangChain agents are built on LangGraph), and how a summary can silently drop the one detail the next step
   needs (broken on purpose).
   Data, all real:
   - recordings (main checkout) docs/ai-path/recordings/s5b-compaction/trace-1..13: the live run up to the moment
     06_hartley.csv is opened, made by docs/ai-path/runs/s5b-compaction/record_trace.py (tools in sheets.py);
   - next-full, next-cleared, next-inputs, next-exclude: the next model call after LangChain's real
     ClearToolUsesEdit compacted the same messages (branch.py, branch.out.txt; next-full in branch-full.out.txt);
   - summary-prompt (the summary written with SummarizationMiddleware's built-in prompt) and next-summary (the
     next call after it), made by summarize.py (summarize.out.txt);
   - sizes.out.txt: approximate tokens per message (count_tokens_approximately) and the recorded prompt_tokens.
   Lesson-local style: a trace list and a tappable code listing (.lx-s5b-compaction-*), see ensureStyle().
   Plain browser script. */
(() => {
  const ID = "s5b-compaction";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const pct = (a, b) => Math.round(a / b * 100);

  /* ---------- Data copied from the runs and recordings ---------- */
  // From docs/ai-path/runs/s5b-compaction/sheets.py
  const SUPPLIER_CYCLE = ["greenleaf", "hartley", "ostrava", "greenleaf", "brightwater", "hartley", "ostrava", "brightwater"];
  const FILE_COUNT = 40;
  const FILES = Array.from({ length: FILE_COUNT }, (_, i) => `${String(i + 1).padStart(2, "0")}_${SUPPLIER_CYCLE[i % SUPPLIER_CYCLE.length]}.csv`);
  const SHEETS = {
    "01_greenleaf.csv": ["Greenleaf Produce", 212], "02_hartley.csv": ["Hartley Farms", 96], "03_ostrava.csv": ["Ostrava Bakery", 58],
    "04_greenleaf.csv": ["Greenleaf Produce", 205], "05_brightwater.csv": ["Brightwater Fish", 40], "06_hartley.csv": ["Hartley Farms", 91]
  };
  const RULE = "When a price column does not say what the price is for (one item, a pack, a case), ask the buyer once per supplier; the answer holds for all of that supplier's files.";
  const BUYER = "Hartley Farms quotes every price per case of 12, even when the column just says Price. Divide by 12 to get the unit price. Same for every Hartley file this season.";

  // From docs/ai-path/recordings/s5b-compaction/trace-1..13.json (tool calls not altered). tokens: approximate
  // tokens of each message from docs/ai-path/runs/s5b-compaction/sizes.out.txt. m = index in the message list.
  const REC_TRACE = {
    src: "s5b-compaction/trace-1 … trace-13",
    provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    steps: [
      { m: 3, tool: "list_files", args: "{}", callTok: 30, tok: 209 },
      { m: 5, tool: "open_sheet", args: "{\"file\":\"01_greenleaf.csv\"}", callTok: 36, tok: 107 },
      { m: 7, tool: "save_clean", args: "{\"file\":\"01_greenleaf.csv\",\"column_map\":{\"Code\":\"sku\",\"Item\":\"product\",\"Unit $\":\"unit_price\"},\"price_divisor\":1}", callTok: 60, tok: 26 },
      { m: 9, tool: "open_sheet", args: "{\"file\":\"02_hartley.csv\"}", callTok: 36, tok: 111 },
      { m: 11, tool: "ask_buyer", args: "{\"question\":\"For Hartley Farms, is the price listed for one item, a pack, or a case?\"}", callTok: 51, tok: 55 },
      { m: 13, tool: "save_clean", args: "{\"file\":\"02_hartley.csv\",\"column_map\":{\"Item code\":\"sku\",\"Description\":\"product\",\"Price\":\"unit_price\"},\"price_divisor\":12}", callTok: 62, tok: 25 },
      { m: 15, tool: "open_sheet", args: "{\"file\":\"03_ostrava.csv\"}", callTok: 36, tok: 107 },
      { m: 17, tool: "save_clean", args: "{\"file\":\"03_ostrava.csv\",\"column_map\":{\"SKU\":\"sku\",\"Product name\":\"product\",\"Price per item (USD)\":\"unit_price\"},\"price_divisor\":1}", callTok: 64, tok: 25 },
      { m: 19, tool: "open_sheet", args: "{\"file\":\"04_greenleaf.csv\"}", callTok: 36, tok: 103 },
      { m: 21, tool: "save_clean", args: "{\"file\":\"04_greenleaf.csv\",\"column_map\":{\"Code\":\"sku\",\"Item\":\"product\",\"Unit $\":\"unit_price\"},\"price_divisor\":1}", callTok: 60, tok: 26 },
      { m: 23, tool: "open_sheet", args: "{\"file\":\"05_brightwater.csv\"}", callTok: 37, tok: 109 },
      { m: 25, tool: "save_clean", args: "{\"file\":\"05_brightwater.csv\",\"column_map\":{\"sku\":\"sku\",\"name\":\"product\",\"unit_price_usd\":\"unit_price\"},\"price_divisor\":1}", callTok: 62, tok: 26 },
      { m: 27, tool: "open_sheet", args: "{\"file\":\"06_hartley.csv\"}", callTok: 36, tok: 115 }
    ],
    // usage.prompt_tokens of trace-1..13 (each request also carries the four tool definitions)
    promptTokens: [306, 594, 769, 835, 1006, 1088, 1156, 1332, 1405, 1573, 1639, 1819, 1889]
  };
  const SYS_USER_TOK = 143; // sizes.out.txt: system message 123 + user message 20
  const APPROX_FULL = 1793; // branch.out.txt: approx tokens of the whole message list at 06_hartley.csv

  // From docs/ai-path/recordings/s5b-compaction/next-*.json; approx = branch.out.txt after the edit
  const REC_NEXT = {
    src: "s5b-compaction/next-full, next-cleared, next-inputs, next-exclude",
    provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    full: { prompt: 2065, call: ["save_clean", "{\"file\":\"06_hartley.csv\",\"column_map\":{\"Item code\":\"sku\",\"Description\":\"product\",\"Price\":\"unit_price\"},\"price_divisor\":12}"] },
    versions: [
      { key: "cleared", title: "Clear old results, keep the calls", cfg: "keep=3", cleared: [3, 5, 7, 9, 11, 13, 15, 17, 19, 21], inputs: false,
        approx: 1159, prompt: 1138, kind: 0, call: ["save_clean", "{\"file\":\"06_hartley.csv\",\"column_map\":{\"Item code\":\"sku\",\"Description\":\"product\",\"Price\":\"unit_price\"},\"price_divisor\":12}"] },
      { key: "inputs", title: "Clear old results and the old calls' arguments", cfg: "keep=3, clear_tool_inputs=True", cleared: [3, 5, 7, 9, 11, 13, 15, 17, 19, 21], inputs: true,
        approx: 987, prompt: 954, kind: 1, call: ["ask_buyer", "{\"question\":\"For Hartley Farms, does the price in the sheet represent the cost for one item, a pack, or a case?\"}"] },
      { key: "exclude", title: "The same, but never clear ask_buyer", cfg: "keep=3, clear_tool_inputs=True, exclude_tools=[\"ask_buyer\"]", cleared: [3, 5, 7, 9, 13, 15, 17, 19, 21], inputs: true,
        approx: 1048, prompt: 1012, kind: 0, call: ["save_clean", "{\"file\":\"06_hartley.csv\",\"column_map\":{\"Item code\":\"sku\",\"Description\":\"product\",\"Price\":\"unit_price\"},\"price_divisor\":12}"] }
    ]
  };
  const TRIGGER = 1500, KEEP = 3, DEFAULT_TRIGGER = 100000, PLACEHOLDER = "[cleared]"; // branch.py; defaults from the LangChain docs

  // From docs/ai-path/recordings/s5b-compaction/summary-prompt.json (trimmed with … , not altered) and next-summary.json
  const REC_SUMMARY = {
    src: "s5b-compaction/summary-prompt",
    provider: "openrouter", model: "openai/gpt-4o-mini", recordedAt: "2026-11-13",
    summarised: 23, keep: 3, kept: 4, promptIn: 2431, out: 327,
    text: "## SESSION INTENT\nThe user's primary goal is to clean supplier files in the inbox, starting with listing the files. … The cleaning process involved opening each file, mapping columns to standardized names, and adjusting prices where necessary (e.g., dividing Hartley Farms prices by 12 to get unit prices). … - **01_greenleaf.csv**: Cleaned and saved with 212 rows.\n- **02_hartley.csv**: Cleaned (price divided by 12) and saved with 96 rows. … ## NEXT STEPS\nContinue cleaning the remaining supplier files, starting with **05_brightwater.csv**.",
    next: { prompt: 876, call: ["ask_buyer", "{\"question\":\"For Hartley Farms, is the price listed for one item, a pack, or a case?\"}"] }
  };
  const CAPTION = `Recorded model output, ${REC_TRACE.recordedAt}`;

  /* ---------- Derived from the data ---------- */
  const S = REC_TRACE.steps;
  const RESULT_TOK = sum(S.map(s => s.tok)), CALL_TOK = sum(S.map(s => s.callTok));
  const PT = REC_TRACE.promptTokens;
  const BUYER_STEP = S.find(s => s.tool === "ask_buyer"), NOW_STEP = S[S.length - 1];
  const MUST_KEEP = [BUYER_STEP.m, NOW_STEP.m];
  const HARTLEY_FILES = FILES.filter(f => f.includes("hartley")).length;
  const fileOf = s => { try { return JSON.parse(s.args).file || null; } catch (e) { return null; } };
  const resultText = s => {
    if (s.tool === "list_files") return `[${FILES.slice(0, 3).map(f => JSON.stringify(f)).join(", ")}, … ${FILE_COUNT} file names]`;
    if (s.tool === "ask_buyer") return BUYER;
    const f = fileOf(s), sh = SHEETS[f];
    if (s.tool === "open_sheet") return `{"file": "${f}", "supplier": "${sh[0]}", "columns": […], "row_count": ${sh[1]}, "rows": […]}`;
    return `{"saved": "clean/${f}", "rows": ${sh[1]}}`;
  };
  const SAVE02 = S.find(s => s.tool === "save_clean" && fileOf(s) === "02_hartley.csv");
  const KEEP_TOK = sum(S.filter(s => MUST_KEEP.includes(s.m)).map(s => s.tok));

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-trace { margin: 16px 0 0; border-top: 1px solid var(--line); }
      .lx-${ID}-row { display: grid; grid-template-columns: 2.4em 1fr auto; gap: 2px 10px; width: 100%; min-height: 44px; padding: 9px 8px; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--ink); font: inherit; text-align: left; align-items: start; }
      button.lx-${ID}-row { cursor: pointer; }
      button.lx-${ID}-row:hover { background: var(--sunk); }
      .lx-${ID}-n { font: 600 13px/1.6 var(--mono); color: var(--muted); }
      .lx-${ID}-body { min-width: 0; }
      .lx-${ID}-call { font: 600 13.5px/1.5 var(--mono); overflow-wrap: anywhere; }
      .lx-${ID}-res { font: 400 13.5px/1.5 var(--mono); color: var(--ink-2); overflow-wrap: anywhere; margin-top: 2px; }
      .lx-${ID}-tok { font: 500 13px/1.6 var(--mono); color: var(--muted); white-space: nowrap; }
      .lx-${ID}-row.keep { box-shadow: inset 4px 0 0 var(--good); background: var(--good-soft); }
      .lx-${ID}-row.no { box-shadow: inset 4px 0 0 var(--bad); background: var(--bad-soft); }
      .lx-${ID}-row.gone .lx-${ID}-res, .lx-${ID}-row.gone .lx-${ID}-tok { color: var(--faint); }
      .lx-${ID}-row.now { box-shadow: inset 4px 0 0 var(--ink); }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-quote { margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); font: 400 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-code { margin: 14px 0 0; border: 1px solid var(--line); border-radius: 6px; background: var(--sunk); overflow: hidden; }
      .lx-${ID}-ln { display: block; width: 100%; min-height: 44px; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--ink); font: 500 14px/1.5 var(--mono); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-ln:last-child { border-bottom: 0; }
      div.lx-${ID}-ln { min-height: 0; padding: 6px 12px; color: var(--ink-2); }
      button.lx-${ID}-ln { cursor: pointer; }
      button.lx-${ID}-ln:hover { background: var(--surface); }
      .lx-${ID}-ln.no { box-shadow: inset 4px 0 0 var(--bad); background: var(--bad-soft); }
      .lx-${ID}-ln.keep { box-shadow: inset 4px 0 0 var(--good); background: var(--good-soft); }
      .lx-${ID}-opt { font: 500 14px/1.45 var(--mono); text-align: left; overflow-wrap: anywhere; }
      .lx-${ID}-tbl { width: 100%; margin: 14px 0 0; border-collapse: collapse; font-size: 14.5px; }
      .lx-${ID}-tbl th, .lx-${ID}-tbl td { padding: 8px 6px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
      .lx-${ID}-tbl th { font-weight: 600; color: var(--muted); font-size: 13px; }
      .lx-${ID}-tbl td.n { font-family: var(--mono); white-space: nowrap; }
      @media (max-width: 520px) { .lx-${ID}-row { grid-template-columns: 2em 1fr; } .lx-${ID}-tok { grid-column: 2; } }
    `;
    document.head.appendChild(s);
  }
  // one row per tool call + result. o: { pick, cls: {m: state}, cleared: Set(m), inputs: bool }
  function trace(kit, steps, o = {}) {
    const cls = o.cls || {}, cleared = o.cleared || new Set();
    return `<div class="lx-${ID}-trace">${steps.map(s => {
      const gone = cleared.has(s.m), tag = o.pick ? "button" : "div";
      const args = gone && o.inputs ? "{}" : s.args;
      return `<${tag}${o.pick ? ` type="button" data-i="${s.m}"` : ""} class="lx-${ID}-row ${cls[s.m] || ""}${gone ? " gone" : ""}">
        <span class="lx-${ID}-n">${s.m}</span>
        <span class="lx-${ID}-body"><span class="lx-${ID}-call">${kit.esc(s.tool + " " + args)}</span><span class="lx-${ID}-res" style="display:block">→ ${kit.esc(gone ? PLACEHOLDER : resultText(s))}</span></span>
        <span class="lx-${ID}-tok">${gone ? "" : `${s.tok} tok`}</span></${tag}>`;
    }).join("")}</div>`;
  }
  // Screen 4: cleared rows other than the ones that matter are folded into summary lines.
  function shortTrace(kit, v) {
    const cleared = new Set(v.cleared), show = new Set([BUYER_STEP.m, SAVE02.m]);
    const parts = [];
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const names = [...new Set(run.map(s => s.tool))].join(", ");
      parts.push(`<div class="lx-${ID}-row gone">
        <span class="lx-${ID}-n">${run[0].m}–${run[run.length - 1].m}</span>
        <span class="lx-${ID}-body"><span class="lx-${ID}-call">${plural(run.length, "older call")} (${kit.esc(names)}): ${v.inputs ? "each shows {}" : "each keeps its arguments"}</span><span class="lx-${ID}-res" style="display:block">→ ${kit.esc(PLACEHOLDER)} for all ${run.length} results</span></span>
        <span class="lx-${ID}-tok"></span></div>`);
      run = [];
    };
    S.forEach(s => {
      if (cleared.has(s.m) && !show.has(s.m)) { run.push(s); return; }
      flush();
      parts.push(trace(kit, [s], { cleared, inputs: v.inputs, cls: { [NOW_STEP.m]: "now" } }).replace(`<div class="lx-${ID}-trace">`, "").replace(/<\/div>$/, ""));
    });
    flush();
    return `<div class="lx-${ID}-trace">${parts.join("")}</div>`;
  }
  const mono = (kit, c) => `<div class="lx-${ID}-quote">${kit.esc(c[0] + " " + c[1])}</div>`;
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }

  /* 1. The situation: what fills the context as the agent works. */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["The tool results: sheet previews, the file list, answers", "The model's own tool calls", "The instructions and the task"];
    const fb = [
      [`Right. Counted roughly, message by message, the ${S.length} tool results take about <b>${RESULT_TOK}</b> tokens, the model's ${S.length} calls about ${CALL_TOK}, the instructions and task about ${SYS_USER_TOK}. This demo previews only six rows per sheet; a real preview is longer, so the gap grows. And every request resends all of it: the ${PT.length} requests so far added up to ${sum(PT).toLocaleString("en")} input tokens, and the agent has only just opened file ${Object.keys(SHEETS).length} of ${FILE_COUNT}.`, true],
      [`The calls are short: a tool name and a few arguments, about ${CALL_TOK} tokens for all ${S.length}. What comes back is longer.`, false],
      [`They are sent once per request and never grow: about ${SYS_USER_TOK} tokens. What grows is the pile of results after them.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Forty spreadsheets, one growing context</h1>
        <p class="lead">A grocery chain's buying team gets price lists from many suppliers, each in its own format. An agent cleans them: it opens a file, maps the columns to <code>sku</code>, <code>product</code> and <code>unit_price</code>, and saves it. There are ${FILE_COUNT} files. Each tool result goes back into the conversation, and every request resends the whole conversation. So each request is bigger, costs more and takes longer than the one before. This lesson is about shrinking that conversation while the agent keeps working.</p>
        <p class="lead">Real input size of each request in the recorded run, up to the moment the agent opens the sixth file:</p>
        ${kit.meter(PT.map((t, i) => ({ label: `request ${i + 1}`, value: t, max: Math.max(...PT) })))}
        <p class="task">The size keeps climbing with every file. Which part of the messages takes the most room?</p>
        <div class="lpanel">${ask(kit, opts, 0, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 0) done(); });
    };
    paint();
  }

  /* 2. By hand: which old tool results must stay word for word? */
  function markByHand({ el, done, kit }) {
    ensureStyle();
    const kept = new Set();
    let miss = null, note = null;
    const why = s => {
      if (s.tool === "list_files") return "The file list can be fetched again with one <code>list_files</code> call, at any time. Nothing is lost if it goes.";
      if (s.tool === "save_clean") return `It only says the file was saved and how many rows. The decisions (column map, <code>price_divisor</code>) are in the call above it, not in this result, and the work is done.`;
      return `${kit.esc(fileOf(s))} is already cleaned and saved. If the agent ever needs it again, <code>open_sheet</code> reads it again from the file.`;
    };
    const paint = () => {
      const fin = MUST_KEEP.every(m => kept.has(m)), cls = {};
      kept.forEach(m => { cls[m] = "keep"; });
      if (miss) cls[miss.m] = "no";
      el.innerHTML = `<h1>What can the agent forget?</h1>
        <p class="lead">To make room, you will replace old tool results with a placeholder: the short text <code>${kit.esc(PLACEHOLDER)}</code>. The calls stay; only what came back goes.</p>
        <p class="lead">The agent's instructions include: “${kit.esc(RULE)}” It has just opened <b>06_hartley.csv</b> and has not saved it yet. In this demo a script plays the buyer.</p>
        <p class="lx-${ID}-cap">Each row below is one call (first line) and its result (after →). The number on the left is its position in the message list; “tok” is the result's size in tokens.</p>
        <p class="task">Tap each result that must stay word for word. Leave the ones the agent can do without.</p>
        ${trace(kit, S, { pick: true, cls })}
        <div class="lpanel">
          <div class="vars"><span>kept <b>${kept.size} / ${MUST_KEEP.length}</b></span></div>
          ${fin ? kit.feedback(`Those two. Message ${NOW_STEP.m} is the sheet the agent is working on: its next call needs those columns. Message ${BUYER_STEP.m} is an answer from a person. No tool brings it back without asking the buyer again, and it carries a rule for every later Hartley file (${HARTLEY_FILES} of the ${FILE_COUNT}). The other ${S.length - MUST_KEEP.length} results hold about ${RESULT_TOK - KEEP_TOK} of the ${RESULT_TOK} tokens of results, and the agent can do without all of them.`, true)
            : miss ? kit.feedback(miss.say, false) : note ? kit.feedback(note, true) : ""}
        </div>`;
      el.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => {
        const m = +b.dataset.i, s = S.find(x => x.m === m);
        miss = null; note = null;
        if (MUST_KEEP.includes(m)) {
          kept.add(m);
          note = m === BUYER_STEP.m ? "Keep. A person answered this, and the answer covers every Hartley file, not just this one." : "Keep. This is the file being cleaned right now.";
        } else miss = { m, say: why(s) };
        paint();
        if (MUST_KEEP.every(k => kept.has(k))) done();
      });
    };
    paint();
  }

  /* 3. Spot the idea: why most results are safe to drop and one is not. */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Old results are far back, so the model pays no attention to them anyway",
      "Most results can be fetched again or have done their job; the buyer's answer exists only in the conversation",
      "Sheet previews are long and the buyer's answer is short",
      "Results older than the last three are always safe to drop"
    ];
    const fb = [
      ["The model reads the whole request every time. In this run it used things from far back: on the next screen you will see it copy a decision it made much earlier in the run.", false],
      [`Right. That is the test for every piece of an agent's context: <b>can it be fetched again, or is its work done?</b> Then a placeholder will do. <b>Did it come from somewhere you cannot ask again</b> (a person, a one-off event, a decision with its reason)? Then keep it word for word. Shrinking an agent's context while it works is called <b>compaction</b>. Swapping old tool results for a placeholder is <b>tool result clearing</b>, the lightest kind; rewriting old turns as a short summary, as you did for a long chat in the last lesson, is the heavier kind.`, true],
      [`Length tells you how much room you gain, not whether it is safe. The file list (${S[0].tok} tokens) is the longest result here and the safest to drop.`, false],
      [`A count says nothing about what a result holds. The buyer's answer is message ${BUYER_STEP.m}, older than the last three, and it is the one result the agent cannot get back.`, false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>What made the two different?</h1>
        <p class="lead">You let ${S.length - MUST_KEEP.length} results go and kept two: the sheet in progress and the buyer's answer.</p>
        <p class="task">What rule decides whether an old tool result is safe to replace?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 4. Predict the next move after three real compactions. */
  function predict({ el, done, kit }) {
    ensureStyle();
    let k = 0, wrong = null;
    const V = REC_NEXT.versions;
    const OPTS = ["Saves 06_hartley.csv with price_divisor 12", "Asks the buyer the Hartley question again", "Saves 06_hartley.csv with price_divisor 1"];
    const say = (v, pick) => {
      if (v.key === "cleared") return pick === 1
        ? `The buyer's answer is cleared, but the calls kept their arguments. The <code>save_clean</code> call in row ${SAVE02.m} is still there: <code>save_clean</code> for 02_hartley.csv with <code>"price_divisor":12</code>. The model can read its own earlier decision.`
        : `Nothing in the request says 1 for Hartley. The old <code>save_clean</code> call for 02_hartley.csv still shows <code>"price_divisor":12</code>, and the model can read its own earlier decision.`;
      if (v.key === "inputs") return pick === 0
        ? `Now the old calls are blanked too: every cleared call shows <code>{}</code> instead of its arguments. Nothing left in the request says 12, or that the buyer was asked.`
        : `In this run it did not guess. The instructions say to ask when the price column does not say what it is for, and nothing left in the request shows that it already asked: the old call to <code>ask_buyer</code> now shows <code>{}</code>.`;
      return pick === 1
        ? `<code>ask_buyer</code> is in <code>exclude_tools</code>, so its call and its result were never cleared. The answer “Same for every Hartley file this season” is in the request.`
        : `The buyer's answer was never cleared: <code>ask_buyer</code> is in <code>exclude_tools</code>. “Divide by 12” is right there in the request.`;
    };
    const paint = () => {
      const fin = k >= V.length, v = V[Math.min(k, V.length - 1)];
      const rows = fin ? "" : shortTrace(kit, v);
      el.innerHTML = `<h1>Three ways to clear, three next moves</h1>
        <p class="lead">We took the real run at the moment it opened 06_hartley.csv and cleared it with LangChain's <code>ClearToolUsesEdit</code> (the next screen shows the code), three ways, then sent each version to the same small hosted model once. Without any clearing, it saved the file with <code>"price_divisor":12</code>.</p>
        ${fin ? "" : `<p class="lead"><b>Version ${k + 1} of ${V.length}: ${kit.esc(v.title)}</b> (<code>${kit.esc(v.cfg)}</code>). The request it gets:</p>${rows}
        <p class="task">What does the model do next?</p>`}
        <div class="lpanel">${fin ? "" : kit.options(OPTS.map(o => kit.esc(o)), { picked: wrong, correct: v.kind })}
        ${wrong != null ? kit.feedback(say(v, wrong), false) : ""}
        ${fin ? `<table class="lx-${ID}-tbl"><thead><tr><th>version</th><th>input tokens</th><th>next move</th></tr></thead><tbody>
            <tr><td>no clearing</td><td class="n">${REC_NEXT.full.prompt}</td><td>${kit.esc(REC_NEXT.full.call[0])}, divisor 12</td></tr>
            ${V.map((x, i) => `<tr><td>${i + 1}. ${kit.esc(x.title)}</td><td class="n">${x.prompt}</td><td>${x.kind === 1 ? "asks the buyer again" : `${kit.esc(x.call[0])}, divisor 12`}</td></tr>`).join("")}
          </tbody></table>
          <p class="lx-${ID}-cap">${CAPTION}. Input tokens as the API reported them, tool list included.</p>
          ${kit.feedback(`Version 2 cut the request by ${pct(REC_NEXT.full.prompt - V[1].prompt, REC_NEXT.full.prompt)}% but broke the instruction “ask the buyer once per supplier”: the buyer gets the same question again, and could get it again on later Hartley files (${HARTLEY_FILES} of the ${FILE_COUNT} are Hartley's). Version 3 kept one short answer and still cut ${pct(REC_NEXT.full.prompt - V[2].prompt, REC_NEXT.full.prompt)}%. Version 1 survived only because its old call happened to repeat the decision. Do not count on that: decide on purpose what must survive.`, true)}` : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const p = +b.dataset.i;
        if (p !== V[k].kind) { wrong = p; paint(); return; }
        wrong = null; k++; paint();
        if (k >= V.length) done();
      });
    };
    paint();
  }

  /* 5. The library call: which line keeps the buyer's answer? */
  const CODE_HEAD = [
    "from langchain.agents.middleware import ClearToolUsesEdit",
    "from langchain_core.messages.utils import count_tokens_approximately"
  ];
  const CODE = [
    "edit = ClearToolUsesEdit(",
    `    trigger=${TRIGGER},`,
    `    keep=${KEEP},`,
    "    clear_tool_inputs=True,",
    "    exclude_tools=[\"ask_buyer\"],",
    ")",
    "edit.apply(messages, count_tokens=count_tokens_approximately)"
  ];
  const PICK_LINES = [1, 2, 3, 4], RIGHT_LINE = 4;
  function libraryCode({ el, done, kit }) {
    ensureStyle();
    let pick = null;
    const V = REC_NEXT.versions;
    const fb = {
      1: `Without <code>trigger</code> the default is ${DEFAULT_TRIGGER.toLocaleString("en")} tokens. This request was about ${APPROX_FULL} by the same counter, so nothing would be cleared at all. The model would get the full request, and with it, it saved with divisor 12.`,
      2: `<code>keep</code> already has its default value, ${KEEP}: the three newest tool results stay. Deleting the line changes nothing.`,
      3: `Without it, <code>clear_tool_inputs</code> is <code>False</code>: old calls keep their arguments. The buyer's answer is still excluded from clearing, so it stays in the request, word for word. This line does not decide whether the answer survives.`,
      4: `Right: that is version 2 on the last screen, where the model asked the buyer again. <code>trigger</code>: start clearing once the messages pass this many tokens. <code>keep</code>: how many of the newest tool results stay. <code>clear_tool_inputs</code>: also blank the arguments of the cleared calls (more room, but the decisions in them go too). <code>exclude_tools</code>: tools whose results are never cleared; put every tool that brings in something you cannot fetch again here. Cleared results become the text <code>${kit.esc(PLACEHOLDER)}</code>. In this run the whole message list went from about ${APPROX_FULL} to ${V[2].approx} tokens.`
    };
    const paint = () => {
      const ok = pick === RIGHT_LINE;
      el.innerHTML = `<h1>The same clearing, in LangChain</h1>
        <p class="lead">This is the code we ran on the real messages for version 3. <code>messages</code> is the agent's list of LangChain messages; <code>apply</code> edits it in place.</p>
        <div class="lx-${ID}-code">${CODE_HEAD.map(c => `<div class="lx-${ID}-ln">${kit.esc(c) || " "}</div>`).join("")}${CODE.map((c, i) => PICK_LINES.includes(i) && !ok
          ? `<button type="button" class="lx-${ID}-ln ${pick === i ? "no" : ""}" data-i="${i}" ${i === RIGHT_LINE ? "data-right" : i === PICK_LINES[0] ? "data-wrong" : ""}>${kit.esc(c)}</button>`
          : `<div class="lx-${ID}-ln ${ok && i === RIGHT_LINE ? "keep" : ""}">${kit.esc(c)}</div>`).join("")}</div>
        <p class="task">Delete one parameter line, and the agent asks the buyer the Hartley question a second time. Tap that line.</p>
        <div class="lpanel">${pick == null ? "" : kit.feedback(fb[pick], ok)}
        ${ok ? `<p class="lead" style="margin-top:14px">In an agent you do not call <code>apply</code> yourself. You hand the edit to <code>ContextEditingMiddleware</code>, which runs it on a copy of the messages before every model call, so the agent's saved state keeps every full result:</p>
          ${kit.code(["context_edit = ContextEditingMiddleware(", "    edits=[edit],", ")", "agent = create_agent(", "    model,", "    tools=TOOLS,", "    middleware=[context_edit],", ")"], -1)}
          <p class="lead"><b>Not run by us.</b> Written from the <a href="https://docs.langchain.com/oss/python/langchain/middleware/built-in" target="_blank" rel="noopener">official documentation</a>, checked 2026-11-13. LangChain's agents are built on LangGraph, which keeps that state.</p>` : ""}</div>`;
      el.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => { pick = +b.dataset.i; paint(); if (pick === RIGHT_LINE) done(); });
    };
    paint();
  }

  /* 6. Broken on purpose: a summary that kept the number and lost the rule. */
  function brokenSummary({ el, done, kit }) {
    ensureStyle();
    let stage = 0, wrong = null;
    const DIAG = [
      "That Hartley prices are divided by 12",
      "That the buyer was already asked about Hartley, and said the answer holds for every Hartley file",
      "The columns and rows of 02_hartley.csv",
      "The list of 40 files from list_files"
    ];
    const DFB = [
      "It is there: “dividing Hartley Farms prices by 12 to get unit prices” and “Cleaned (price divided by 12)”. The number survived. Read the agent's instructions again: what do they tell it to do when a price column does not say what it is for?",
      null,
      "06_hartley.csv is open, and its own columns are in the kept messages. The rows of an earlier file do not decide this step.",
      "The next step is about 06_hartley.csv, which is already open. The file list can be fetched again with one call."
    ];
    const FIX = [
      `Keep more recent messages: <code>keep=("messages", 10)</code>`,
      "Do not leave answers from people to the summary: keep them where compaction never reaches (a rules note sent with every request), and tell the summary prompt to copy such answers word for word",
      "Use a bigger model to write the summary",
      "Turn summarisation off for this agent"
    ];
    const FFB = [
      "The buyer's answer is near the start of the run. A bigger <code>keep</code> only holds back the newest messages; at the next summary the answer is folded in again.",
      null,
      "It might keep the rule this time, but nothing tells it this sentence matters more than the others. You would be betting on it at every summary.",
      `Then the context grows with every one of the ${FILE_COUNT} files, and the requests keep getting bigger and slower. The fix is to protect the one answer, not to give up shrinking.`
    ];
    const paint = () => {
      el.innerHTML = `<h1>Broken on purpose: the summary that lost a rule</h1>
        <p class="lead">Second approach, same moment in the run. LangChain's <code>SummarizationMiddleware</code> (<code>trigger=("tokens", ${TRIGGER})</code>, <code>keep=("messages", ${REC_SUMMARY.keep})</code>) folded the oldest ${REC_SUMMARY.summarised} messages into one summary, using its built-in summary prompt. It kept the last ${REC_SUMMARY.kept} messages, not ${REC_SUMMARY.keep}, because it never cuts between a tool call and its result. A small hosted model wrote the summary:</p>
        <div class="lx-${ID}-quote">${kit.esc(REC_SUMMARY.text)}</div>
        <p class="lx-${ID}-cap">${CAPTION} (trimmed at …)</p>
        <p class="lead">With this summary plus the last ${REC_SUMMARY.kept} messages (saving file 05, opening 06_hartley.csv), the request fell to ${REC_SUMMARY.next.prompt} input tokens. The agent's next move:</p>
        ${mono(kit, REC_SUMMARY.next.call)}
        <p class="lead">Its instructions say: “${kit.esc(RULE)}”</p>
        ${stage < 2 ? `<p class="task">${stage === 0 ? "The buyer gets the same question twice. What did the summary drop that the next step needed?" : "Found it. Now pick the fix."}</p>` : ""}
        <div class="lpanel">${stage === 0 ? kit.options(DIAG.map(o => kit.esc(o)), { picked: wrong, correct: 1 }) : stage === 1 ? kit.options(FIX, { picked: wrong, correct: 1 }) : ""}
        ${wrong != null ? kit.feedback(stage === 0 ? DFB[wrong] : FFB[wrong], false) : ""}
        ${stage >= 1 && wrong == null ? kit.feedback("Right. The summary kept what was done (02 was divided by 12), but nothing in it says the buyer was asked, or that the answer covers every Hartley file. Under the instruction “ask once per supplier”, the agent asked again.", true) : ""}
        ${stage === 2 ? kit.feedback(`Right. A summary is written by a model, so it can drop any sentence, and you will not see an error, only a wrong next step. Protect what cannot be fetched again by keeping it out of the summary's reach. When you tune the summary prompt, first make it keep everything that matters, even if the summary gets longer. Only after that, cut what is not needed. This summary call itself read ${REC_SUMMARY.promptIn.toLocaleString("en")} tokens and wrote ${REC_SUMMARY.out}: every summary is one more model call.`, true) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => {
        const p = +b.dataset.i;
        if (p !== 1) { wrong = p; paint(); return; }
        wrong = null; stage++; paint();
        if (stage === 2) done();
      });
    };
    paint();
  }

  /* 7. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["A cached prompt start stops matching", "An extra model call, with its time and price, at every compaction", "Details can be lost without any error"];
    const fb = [
      ["Not new. Clearing also changes earlier messages (a result becomes a placeholder), so a cached prompt start stops matching with either approach.", false],
      [`Right. Clearing is a cheap edit to the list: no model call. A summary needs a model to read the old messages and write: in our run, ${REC_SUMMARY.promptIn.toLocaleString("en")} tokens in and ${REC_SUMMARY.out} out, just to make room. In return it can shrink a long conversation that has no tool results to clear.`, true],
      ["Not new. Clearing loses details silently too: in version 2 on the predict screen, the old arguments went, no error appeared, and the agent asked the buyer again.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When to compact, and when not</h1>
        <p class="lead"><b>For:</b> long agent runs where old tool output piles up.</p>
        <p class="lead"><b>Reach for it</b> when an agent makes many tool calls with big results (files, pages, search hits). Clear old tool results first: no model call, and the calls stay visible. Summarise when the conversation itself is long, not the tool output.</p>
        <p class="lead"><b>Not</b> for runs that fit easily: there it can only lose things. Not when later steps need earlier text exactly (quotes, figures for an audit): keep those in a note or store the agent can read back.</p>
        <p class="lead"><b>Costs:</b> details can be lost without any error. A summary is an extra model call each time. Changing earlier messages means a prompt cache no longer matches the start of the request. And you need tests that replay long runs through compaction.</p>
        <p class="task">You switch an agent from clearing old tool results to summarising old messages. Which cost is new?</p>
        <div class="lpanel">${ask(kit, opts, 1, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === 1) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations, including one where compaction is the wrong move. */
  const CASES = [
    ["A coding agent reads about 30 source files during a long refactor. It can open any file again whenever it needs to.", true,
      "Yes. File contents can be read again, so old reads are safe to clear. Keep its notes on what it changed and why: those came from its own work and exist nowhere else.",
      "Old file reads are the easiest thing to clear: the agent can open any file again. Clearing them keeps a long refactor inside the window. Keep its notes on decisions word for word."],
    ["A help-desk bot answers one question about an order with a single lookup, then stops.", false,
      "No. The whole run is a few messages and fits easily. Compaction has nothing to gain here, and anything it removes is something the model might have needed.",
      "There is nothing to shrink: one lookup, one answer, far under any limit. Compacting would only add a step that can lose details."],
    ["A contract-review agent reads a dozen long contracts, one by one, and calls a flag_clause tool on each risky clause. Its final report must quote every flagged clause word for word.", true,
      "Yes, with care. The long contract reads take most of the room and can be read again, so clear them. Keep the flagged clauses out of reach: put flag_clause in exclude_tools, or save each clause by id in a store and fetch the exact text for the report. Do not summarise them: a summary rewrites them in other words.",
      "Compaction still pays here. The contract reads are most of the room, and any contract can be read again. Only the flagged clauses need protecting: exclude flag_clause from clearing, or save each clause by id outside the context and fetch it for the report."],
    ["A research agent runs about 60 web searches. It writes what it learns into a notes file and only needs the notes at the end.", true,
      "Yes. Old search results have done their job once the notes hold what mattered, and a search can be run again. Clear the old results and keep the notes.",
      "The notes already hold what mattered, and any search can be repeated. Clearing old results is safe here and keeps the run inside the window."]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>Compact or not?</h1>
        <p class="lead">Four agents from other jobs. Compacting means clearing old tool results or summarising old messages while the agent works.</p>
        <p class="task">Would you add compaction to each one? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], i) => `<div class="lcase" id="c${i}"><p>${kit.esc(q)}</p>${kit.options(["Yes", "No"], { picked: ans[i], correct: y ? 0 : 1 })}${ans[i] == null ? "" : kit.feedback(kit.esc(ans[i] === (y ? 0 : 1) ? yes : no), ans[i] === (y ? 0 : 1))}</div>`).join("")}`;
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
    el.innerHTML = `<h1>You can shrink an agent's context safely</h1>
      <p class="lead">You marked what an agent can forget (what can be fetched again, or has done its job) and what it cannot (what a person told it). You saw three real clearings change the next move, set <code>exclude_tools</code> so the buyer's answer survives, and found the rule a summary dropped.</p>
      <p class="lead">This lesson is the practice: there is no separate exercise.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. A new unit starts there, and the habit from here carries over: before you change what a model sees, check what it needs.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Compaction: shrinking an agent's context mid-task",
    checked: "2026-11-13",
    sources: [
      "https://docs.langchain.com/oss/python/langchain/middleware/built-in",
      "https://reference.langchain.com/python/langchain/agents/middleware/context_editing/ClearToolUsesEdit",
      "https://reference.langchain.com/python/langchain/agents/middleware/summarization/SummarizationMiddleware",
      "https://github.com/langchain-ai/langchain/blob/master/libs/langchain_v1/langchain/agents/middleware/context_editing.py",
      "https://github.com/langchain-ai/langchain/blob/master/libs/langchain_v1/langchain/agents/middleware/summarization.py",
      "https://docs.langchain.com/oss/python/langchain/short-term-memory",
      "https://docs.langchain.com/oss/python/langchain/overview",
      "https://platform.claude.com/docs/en/build-with-claude/context-editing",
      "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
    ],
    interview: [
      {
        q: "After you turned on summarisation in a long-running agent, it started asking users the same question twice. How do you find the cause and fix it?",
        good: [
          "Compare the request just before and just after compaction, and read the summary for what it dropped",
          "Look for things that cannot be fetched again, like answers from a person, and check whether their scope survived",
          "Keep those outside the summary's reach: a notes field or rules block sent with every request, or exclude that tool from clearing",
          "Tune the summary prompt to keep everything important first, then trim",
          "Add a regression test that replays a long recorded run through compaction and checks the next step"
        ],
        weak: "Switch to a model with a bigger context window. That postpones compaction instead of finding what the summary loses."
      },
      {
        q: "Your agent reads many large files and its requests keep growing. Would you clear old tool results or summarise, and what would you keep?",
        good: [
          "Clear old tool results first: no extra model call, and the calls stay visible",
          "File reads can be repeated, so they are safe to clear; keep the newest few",
          "Exclude tools whose results cannot be fetched again, such as a human's answer",
          "Summarise only if the conversation itself, not tool output, is what grows",
          "Expect a cached prompt start to stop matching when old messages change, so clear in large chunks"
        ],
        weak: "Summarise everything every few turns. That adds a model call each time and can drop details silently."
      }
    ],
    screens: [situation, markByHand, spotIdea, predict, libraryCode, brokenSummary, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: [`[data-i="${S[0].m}"]`], right: MUST_KEEP.map(m => `[data-i="${m}"]`) },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: Array(REC_NEXT.versions.length).fill("[data-right]") },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]", "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, i) => `#c${i} [data-right]`) },
      { right: [] }
    ]
  });
})();
