/* Lesson: several agents, a supervisor, handoffs and what they cost. Story: the Millbrook Courier's news desk
   (an invented town) writes a 120-word story about the council's tram line vote, once with ONE agent and once
   with a supervisor handing work to a researcher, a writer and a fact-checker.
   Ideas: (1) a handoff carries only what you put in it: the specialists are cheap because they see little, the
   supervisor is dear because it re-reads everything, and a retold brief can drop a fact; what crosses the
   boundary is a design decision; (2) the split pays only when one agent cannot cope (too many tools, very
   different instructions, independent parts); a small task like this one is better done by one agent.
   Data, all real (same small hosted model, temperature 0, 2026-11-13):
   - recordings (main checkout) docs/ai-path/recordings/s5b-multi-agent/single-1..5 (run A, one agent),
     desk-* (run B: supervisor, researcher, writer, fact-checker), fix-* (run C: run B with the researcher's notes
     passed word for word to the writer and the fact-checker);
   - the scripts that made them, with their printed output: docs/ai-path/runs/s5b-multi-agent/single_agent.py,
     three_agents.py (a LangGraph StateGraph; supervisor nodes return Command(goto, update)), desk_tools.py
     (the archive documents and prompts), llm.py; outputs single_agent.out.txt, three_agents.out.txt,
     three_agents_notes.out.txt (token rows and graph.stream(stream_mode="updates") lines).
   Lesson-local style: a call table, a desk diagram and a quoted-text block (.lx-s5b-multi-agent-*), see
   ensureStyle(). Plain browser script. */
(() => {
  const ID = "s5b-multi-agent";
  const fmt = n => n.toLocaleString("en");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const say = n => WORD[n] || String(n);

  /* ---------- Data copied from the runs and recordings ---------- */
  // Token usage per model call, in run order, from the recordings' response.usage (printed as ROW / CALL lines in
  // single_agent.out.txt, three_agents.out.txt and three_agents_notes.out.txt): [agent, input tokens, output tokens]
  const RUN_A = [["agent", 179, 18], ["agent", 319, 32], ["agent", 543, 31], ["agent", 679, 23], ["agent", 792, 213]];
  const RUN_B = [["sup", 310, 31], ["res", 140, 20], ["res", 282, 30], ["res", 506, 23], ["res", 619, 31], ["res", 755, 500],
    ["sup", 875, 182], ["wri", 197, 218], ["sup", 1295, 445], ["chk", 459, 349], ["sup", 2107, 233]];
  const RUN_C = [["sup", 310, 31], ["res", 140, 20], ["res", 282, 30], ["res", 506, 23], ["res", 619, 31], ["res", 755, 500],
    ["sup", 875, 182], ["wri", 707, 202], ["sup", 1280, 245], ["chk", 768, 74], ["sup", 1619, 254], ["wri", 772, 251],
    ["sup", 2145, 294], ["chk", 815, 1], ["sup", 2458, 267]];
  const AGENT = { agent: "one agent", sup: "supervisor", res: "researcher", wri: "writer", chk: "fact-checker" };
  const RES_LIMIT = 500; // max_tokens of every request (llm.py); desk-res-5 stopped there (finish_reason "length")

  // From docs/ai-path/runs/s5b-multi-agent/desk_tools.py (DOCS["council-minutes-2026-11-04"], EDITOR_REQUEST): our own
  // invented archive text, not model output
  const SOURCE_LINE = "Without the grant, the council would build only the first section (Riverside to Market Square) and open it in 2031.";
  const EDITOR = "Write a news story of about 120 words for tomorrow's local page about the council's tram line decision. Every figure and date must come from the archive.";

  // Recorded model output, trimmed with … (each part is a verbatim piece of the recording), not altered.
  // pre / post: text was cut before the first part / after the last part; shown() marks those cuts with … too.
  const REC = {
    provider: "openrouter", model: "google/gemini-2.5-flash-lite", recordedAt: "2026-11-13",
    // desk-res-5: the researcher's reply (content), returned to the supervisor
    notes: { src: "s5b-multi-agent/desk-res-5", pre: true, post: true, parts: [
      "Expected opening: Late 2029 (if grant approved).\nAlternative plan (without grant): Build only the first section (Riverside to Market Square), opening in 2031.\nConstruction disruption: Up to 18 months of road works feared by Market Street traders.",
      "**Alternative Plan (if grant is not approved):** Only the first section (Riverside to Market Square) would be built, opening in 2031."] },
    // desk-sup-2: the supervisor's tool call transfer_to_writer, argument "task"
    brief: { src: "s5b-multi-agent/desk-sup-2 (tool call arguments)", parts: [
      "Write a news story of about 120 words for tomorrow's local page about the council's tram line decision. Use the following figures and dates:",
      "Expected opening: Late 2029 (if grant approved). Alternative plan: Riverside to Market Square section only, opening 2031. Disruption: No block closed for more than 10 weeks."] },
    // desk-wri-1: the writer's draft (content)
    draft: { src: "s5b-multi-agent/desk-wri-1", pre: true, post: true, parts: [
      "**[City Name]** – The council has given the green light to a significant new tram line project",
      "An alternative, shorter plan to extend the line only to Market Square, with an opening in 2031, was also considered."] },
    // desk-chk-1: the fact-checker's verdict (content)
    check: { src: "s5b-multi-agent/desk-chk-1", pre: true, parts: [
      "The draft mentions an alternative, shorter plan to extend the line only to Market Square, with an opening in 2031. The research notes confirm this.",
      "APPROVED"] },
    // fix-wri-1: run C's first draft (content)
    fixDraft: { src: "s5b-multi-agent/fix-wri-1", pre: true, post: true, parts: [
      "An alternative plan, should the grant not be approved, involves building only the Riverside to Market Square section, with an opening in 2031."] },
    // fix-chk-1 and fix-chk-2: run C's two verdicts (content)
    fixCheck: { src: "s5b-multi-agent/fix-chk-1", pre: true, parts: [
      "**Construction disruption:** The draft states \"no single block closed for more than 10 weeks,\" but the research notes mention \"up to 18 months of road works feared by Market Street traders.\" While the council spokesperson's statement is included, the potential for longer disruption is not fully represented."] },
    fixCheck2: { src: "s5b-multi-agent/fix-chk-2", parts: ["APPROVED"] }
  };
  const CAPTION = `Recorded model output, ${REC.recordedAt}`;

  // The listing is supervisor() from docs/ai-path/runs/s5b-multi-agent/three_agents.py, line for line (line 0 = def).
  const CODE = [
    "def supervisor(state: DeskState) -> Command[Literal[\"researcher\", \"writer\", \"fact_checker\", \"__end__\"]]:",
    "    reply = call_model(\"sup\", state[\"messages\"], HANDOFF_TOOLS)",
    "    handoff = reply[\"tool_calls\"][0][\"function\"]",
    "    args = json.loads(handoff[\"arguments\"])",
    "    if handoff[\"name\"] == \"finish\":",
    "        return Command(goto=END, update={\"messages\": [reply], \"story\": args[\"story\"]})",
    "    return Command(goto=AGENT_OF[handoff[\"name\"]],",
    "                   update={\"messages\": [reply], \"task\": args[\"task\"]})"
  ];
  // graph.stream(start, stream_mode="updates") in run B, from three_agents.out.txt: [node, keys it changed, handoff tool]
  const UPDATES = [["supervisor", ["messages", "task"], "transfer_to_researcher"], ["researcher", ["messages", "notes"], null],
    ["supervisor", ["messages", "task"], "transfer_to_writer"], ["writer", ["messages"], null],
    ["supervisor", ["messages", "task"], "transfer_to_fact_checker"], ["fact_checker", ["messages"], null],
    ["supervisor", ["messages", "story"], "finish"]];

  /* ---------- Derived from the data ---------- */
  const total = run => sum(run.map(r => r[1] + r[2]));
  const TOT_A = total(RUN_A), TOT_B = total(RUN_B), TOT_C = total(RUN_C);
  const RATIO_BA = Math.round(TOT_B / TOT_A), RATIO_CA = Math.round(TOT_C / TOT_A);
  const byAgent = run => { const m = {}; run.forEach(([a, i, o]) => { m[a] = m[a] || { calls: 0, tokens: 0, inputs: [] }; m[a].calls++; m[a].tokens += i + o; m[a].inputs.push(i); }); return m; };
  const B_AG = byAgent(RUN_B), C_AG = byAgent(RUN_C);
  const B_ORDER = ["sup", "res", "wri", "chk"];
  const B_TOP = B_ORDER.reduce((a, b) => (B_AG[b].tokens > B_AG[a].tokens ? b : a));
  // contiguous runs of the same agent = one node run in the graph (matches UPDATES one to one)
  const SEGMENTS = RUN_B.reduce((s, r) => { if (s.length && s[s.length - 1].a === r[0]) s[s.length - 1].n++; else s.push({ a: r[0], n: 1 }); return s; }, []);
  const RES_LAST_OUT = RUN_B.filter(r => r[0] === "res").slice(-1)[0][2];
  const C_WRI = C_AG.wri.calls, C_CHK = C_AG.chk.calls;

  /* ---------- Lesson-local style and helpers ---------- */
  function ensureStyle() {
    if (document.getElementById("lx-" + ID)) return;
    const s = document.createElement("style");
    s.id = "lx-" + ID;
    s.textContent = `
      .lx-${ID}-tbl { border-collapse: collapse; margin-top: 18px; width: 100%; max-width: 460px; font: 500 15px var(--mono); }
      .lx-${ID}-tbl caption { text-align: left; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; padding-bottom: 6px; }
      .lx-${ID}-tbl th { text-align: left; font: 600 13.5px var(--font); color: var(--muted); padding: 4px 10px 6px; border-bottom: 2px solid var(--ink); }
      .lx-${ID}-tbl td { padding: 6px 10px; border-bottom: 1px solid var(--line); }
      .lx-${ID}-tbl td.n, .lx-${ID}-tbl th.n { text-align: right; }
      .lx-${ID}-tbl tr.lx-${ID}-sum td { font-weight: 700; border-bottom: 2px solid var(--ink); }
      .lx-${ID}-desk { display: grid; gap: 10px; margin-top: 16px; align-content: start; }
      .lx-${ID}-wrap .lcode div { white-space: pre-wrap; overflow-wrap: anywhere; padding-left: 2.2em; text-indent: -1.2em; }
      .lx-${ID}-desk h3 { margin: 0; font: 700 12px var(--mono); color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
      .lx-${ID}-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .lx-${ID}-box { border: 1.5px solid var(--ink); border-radius: 8px; padding: 8px 12px; font: 600 15px var(--font); background: var(--surface); }
      .lx-${ID}-box small { display: block; font: 500 13px var(--font); color: var(--muted); }
      .lx-${ID}-arrow { font: 500 13.5px var(--font); color: var(--muted); }
      .lx-${ID}-card { margin-top: 16px; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: var(--surface); }
      .lx-${ID}-desks { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 620px) { .lx-${ID}-desks { grid-template-columns: 1fr; } }
      .lx-${ID}-q { margin: 10px 0 0; padding: 10px 12px; border-left: 3px solid var(--ink); background: var(--sunk); font: 500 14px/1.55 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
      .lx-${ID}-who { font: 600 12.5px var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin-top: 12px; }
      .lx-${ID}-cap { margin: 6px 0 0; font-size: 13.5px; color: var(--muted); }
      .lx-${ID}-opt { display: block; }
      .lx-${ID}-opt b { display: block; font-size: 15px; margin-bottom: 4px; }
      .lx-${ID}-opt span { display: block; font: 500 13.5px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
      .lx-${ID}-upd { font: 500 14px/1.6 var(--mono); overflow-wrap: anywhere; }
    `;
    document.head.appendChild(s);
  }
  const shown = r => `${r.pre ? "… " : ""}${r.parts.join(" … ")}${r.post ? " …" : ""}`;
  const quote = (kit, r) => `<div class="lx-${ID}-q">${kit.esc(shown(r))}</div>`;
  const cap = () => `<p class="lx-${ID}-cap">${CAPTION}</p>`;
  function callTable(kit, run, title, { totals = true } = {}) {
    const rows = run.map(([a, i, o], k) => `<tr><td>${k + 1}</td><td>${kit.esc(AGENT[a])}</td><td class="n">${fmt(i)}</td><td class="n">${fmt(o)}</td></tr>`).join("");
    const sumRow = totals ? `<tr class="lx-${ID}-sum"><td></td><td>all ${run.length} calls</td><td class="n">${fmt(sum(run.map(r => r[1])))}</td><td class="n">${fmt(sum(run.map(r => r[2])))}</td></tr>` : "";
    return `<table class="lx-${ID}-tbl"><caption>${kit.esc(title)}</caption><thead><tr><th>call</th><th>agent</th><th class="n">input tokens</th><th class="n">output tokens</th></tr></thead><tbody>${rows}${sumRow}</tbody></table>`;
  }
  function desks() {
    return `<div class="lx-${ID}-desks">
      <div class="lx-${ID}-card lx-${ID}-desk"><h3>Run A: one agent</h3>
        <div class="lx-${ID}-row"><span class="lx-${ID}-box">assistant<small>tools: search_archive, read_document</small></span></div>
        <p class="lx-${ID}-cap">Researches, writes and checks in one conversation.</p></div>
      <div class="lx-${ID}-card lx-${ID}-desk"><h3>Run B: supervisor and three specialists</h3>
        <div class="lx-${ID}-row"><span class="lx-${ID}-box">supervisor<small>tools: transfer_to_…, finish</small></span></div>
        <div class="lx-${ID}-row"><span class="lx-${ID}-arrow">hands a task text to</span></div>
        <div class="lx-${ID}-row"><span class="lx-${ID}-box">researcher<small>archive tools</small></span><span class="lx-${ID}-box">writer</span><span class="lx-${ID}-box">fact-checker</span></div>
        <p class="lx-${ID}-cap">Each specialist sees only the task text. Its last message goes back to the supervisor.</p></div>
    </div>`;
  }
  function ask(kit, opts, correct, picked, fbs) {
    return `${kit.options(opts, { picked, correct })}${picked == null ? "" : kit.feedback(fbs[picked][0], fbs[picked][1])}`;
  }

  /* 1. The situation, and a prediction: which desk spends more? */
  function situation({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = ["Fewer than run A: each specialist gets a short, focused prompt",
      "About the same as run A: the same three documents are read once either way",
      "Several times more than run A"];
    const RIGHT = 2;
    const fb = [
      [`Each specialist's prompt was short, true: the writer's single call read ${fmt(RUN_B.find(r => r[0] === "wri")[1])} input tokens. But run B made ${RUN_B.length} model calls against ${RUN_A.length}, and the supervisor re-read its growing conversation on each of its turns. Short prompts, many of them.`, false],
      [`The documents were read once in each run, yes. But reading is not the whole bill: in run B the notes and the draft are each sent again to the next agent, and everything is sent again to the supervisor on each of its turns. ${RUN_B.length} calls against ${RUN_A.length}.`, false],
      [`Right. Run A: <b>${plural(RUN_A.length, "model call")}, ${fmt(TOT_A)} tokens</b>. Run B: <b>${plural(RUN_B.length, "model call")}, ${fmt(TOT_B)} tokens</b>, about ${RATIO_BA} times as many, for a story of the same length. The next screen finds out where they went.`, true]
    ];
    const paint = () => {
      el.innerHTML = `<h1>One story, two news desks</h1>
        <p class="lead">At the <i>Millbrook Courier</i> (a town we made up), the night editor asks for a short story: <i>“${kit.esc(EDITOR)}”</i> The archive holds three documents: the council minutes, the tram operator's draft plan, and a letter from shop owners.</p>
        <p class="lead">This lesson asks when it is worth splitting one agent's job between several agents. We ran the same request twice on the same small hosted model. In run A, one agent does everything. In run B, a <b>supervisor</b> agent does no research or writing itself: it hands each part of the job to a <b>specialist</b> agent and reads the reply. Passing work from one agent to another is called a <b>handoff</b>.</p>
        ${desks()}
        <p class="task">Add up every token sent to the model and returned by it, over the whole run. Before you see the numbers: how will run B's total compare with run A's?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}
        ${ans === RIGHT ? kit.meter([{ label: "Run A, one agent", value: TOT_A, max: TOT_B }, { label: "Run B, four agents", value: TOT_B, max: TOT_B }]) : ""}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 2. By hand: add up run B's calls per agent and find who spent the most. */
  function whereTokens({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = B_ORDER.map(a => AGENT[a]);
    const RIGHT = B_ORDER.indexOf(B_TOP);
    const t = a => `${fmt(B_AG[a].tokens)} tokens in ${plural(B_AG[a].calls, "call")}`;
    const fb = [];
    fb[B_ORDER.indexOf("res")] = [`The researcher used ${t("res")}. That is the cost of reading the three documents in a small loop: about what run A spent on its whole run (${fmt(TOT_A)}). Large, but it is work run A did too.`, false];
    fb[B_ORDER.indexOf("wri")] = [`The writer used only ${t("wri")}. It saw nothing but the short task text the supervisor wrote. Cheap, and you will see on the next screen what that cheapness costs.`, false];
    fb[B_ORDER.indexOf("chk")] = [`The fact-checker used ${t("chk")}: one call with the draft and some notes. Not small, not the biggest.`, false];
    fb[RIGHT] = [`Right: the supervisor used <b>${t("sup")}</b>, more than the researcher's ${fmt(B_AG.res.tokens)}. Look at its input on each turn: ${B_AG.sup.inputs.map(fmt).join(", ")}. It keeps the whole conversation: after each handoff, the specialist's reply is added to it, and the next turn sends all of it again. So in this shape the specialists are cheap because they see little, and the supervisor is expensive because it sees everything.`, true];
    const paint = () => {
      el.innerHTML = `<h1>Where did run B's tokens go?</h1>
        <p class="lead">Here is every model call of run B, in order, with the token counts the API reported. Five of the calls belong to the researcher: it ran its own small loop of search and read calls.</p>
        ${callTable(kit, RUN_B, "Run B, every model call")}
        <p class="task">Add up input and output tokens for each agent. Which agent used the most?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 3. By hand: find the handoff where a condition got lost. */
  function lostFact({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const hops = [
      ["1. Researcher → supervisor: the notes", REC.notes],
      ["2. Supervisor → writer: the task text", REC.brief],
      ["3. Writer → supervisor: the draft", REC.draft],
      ["4. Fact-checker → supervisor: the verdict", REC.check]
    ];
    const RIGHT = 1;
    const opts = hops.map(([h, r]) => `<span class="lx-${ID}-opt"><b>${kit.esc(h)}</b><span>${kit.esc(shown(r))}</span></span>`);
    const fb = [
      [`The condition is still here: “Alternative plan (without grant)”. The notes are messy (the researcher hit its ${RES_LIMIT}-token output limit after writing them twice), but both copies keep the condition. Look at the next hop.`, false],
      [`Right. The notes said “Alternative plan (without grant)”. The supervisor retold them as “Alternative plan:”, and the condition was gone. The same task text dropped the shop owners' fear of 18 months of road works, and never gave the town's name: the writer printed <b>[City Name]</b>. The writer saw only this text, so it filled the gap with “was also considered”. The checker approved, and the supervisor sent that story to the editor.`, true],
      ["The writer did get it wrong, but it could only work from the task text it was handed, and that text no longer had the condition. The writer guessed. The fact went missing one hop earlier.", false],
      ["The checker failed too: the supervisor's retelling of the notes that it was given still said “without grant”, yet it wrote “The research notes confirm this”. But it is the last hop. The fact was already missing from the draft, and before that from the writer's task text. Find where it first vanished.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Where did the fact go missing?</h1>
        <p class="lead">The council minutes say: <i>“${kit.esc(SOURCE_LINE)}”</i> Run B's final story says the shorter tram line “was also considered”, as if it were an idea the council turned down. Here is what crossed each handoff in run B, trimmed.</p>
        <p class="task">Tap the handoff where “without the grant” first disappeared.</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}${cap()}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 4. Spot the idea: what fixes the cause? */
  function spotIdea({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "Give the writer a bigger, stronger model",
      "In code, pass the researcher's notes word for word to the writer and the fact-checker, next to the supervisor's task text",
      "Add a fourth agent, an editor, that reads the final story",
      "Add to the supervisor's prompt: “keep every condition when you write a task”"
    ];
    const RIGHT = 1;
    const fb = [
      ["The writer guessed (“was also considered”) because the condition was not in its text. No model, however strong, can keep a condition it was never shown. The problem is what it was handed.", false],
      ["Right. A handoff carries only what you put into it. When a model retells the facts in its own words, any detail can drop out, and the next agent cannot know. So decide in code what crosses each boundary: the original facts, plus the instruction. LangChain's documentation calls this choosing of what each agent sees context engineering.", true],
      ["Another agent is another handoff, another set of model calls, and it too sees only what it is handed. Run B's fact-checker was exactly this kind of reviewer, and it approved the wrong sentence.", false],
      ["It may help on some runs, but the retelling is still done by a model, so nothing guarantees the next one keeps every detail. Passing the notes in code is a guarantee; a prompt is a request.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>Make the fact survive</h1>
        <p class="lead">You found the cause: the writer only saw the supervisor's retelling of the notes. The supervisor's model wrote that task text, and nothing checked it against the notes.</p>
        <p class="task">The editor will run this desk every night. Which change removes the cause?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 5. Use it, with predictions: run C passes the notes word for word. */
  function predictFix({ el, done, kit }) {
    ensureStyle();
    const ans = [null, null];
    const Q = [
      { q: "Does the writer's first draft keep the 2031 condition?", opts: ["Yes", "No"], right: 0,
        fb: [[`Yes. With the notes in front of it, the writer wrote:${quote(kit, REC.fixDraft)}${cap()}`, true],
          ["The writer now has the notes word for word, and they say “Alternative plan (without grant)” in plain words. It kept the condition. Pick again.", false]] },
      { q: `Run B used ${fmt(TOT_B)} tokens. Run C, in total:`, opts: ["Fewer than run B", "About the same as run B", "More than run B"], right: 2,
        fb: [[`The notes are now copied into every writer and fact-checker call, so each of those calls is bigger, not smaller: the writer's first call read ${fmt(RUN_C.find(r => r[0] === "wri")[1])} input tokens, against ${fmt(RUN_B.find(r => r[0] === "wri")[1])} in run B.`, false],
          [`The first steps were the same as run B, but every writer and fact-checker call now carries the notes too. And something else happened: the run did not end after one check.`, false],
          [`More: <b>${plural(RUN_C.length, "model call")}, ${fmt(TOT_C)} tokens</b>, about ${RATIO_CA} times run A. Each writer and checker call now carries the notes. And the fact-checker, now holding the notes, found a real gap, a fact the draft left out:${quote(kit, REC.fixCheck)}${cap()}The supervisor sent the draft back to the writer, and the second check said “${kit.esc(shown(REC.fixCheck2))}”: ${plural(C_WRI, "writer call")} and ${plural(C_CHK, "check")} instead of one each. Better story, bigger bill.`, true]] }
    ];
    const paint = () => {
      el.innerHTML = `<h1>Run C: hand over the notes</h1>
        <p class="lead">We ran desk B again with one change in code: the writer and the fact-checker now get the supervisor's task text <b>and</b> the researcher's notes, word for word. Everything else is the same.</p>
        <p class="task">Predict both results. Pick again if you change your mind.</p>
        ${Q.map((x, i) => `<div class="lcase" id="c${i}"><p>${x.q}</p>${kit.options(x.opts, { picked: ans[i], correct: x.right })}${ans[i] == null ? "" : kit.feedback(...(ans[i] === x.right ? x.fb[x.right] : x.fb[ans[i]]))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, i) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[i] = +b.dataset.i; paint();
        if (Q.every((x, j) => ans[j] === x.right)) done();
      }));
    };
    paint();
  }

  /* 6. The same desk in LangGraph: the supervisor node returns Command(goto, update). */
  function asCode({ el, done, kit }) {
    ensureStyle();
    let i = 0, ans = null;
    const steps = UPDATES.map(([node, keys, tool], k) => {
      const seg = SEGMENTS[k];
      if (node === "supervisor") {
        const fin = tool === "finish";
        return { line: fin ? 5 : 6, node, keys, text: fin
          ? `The supervisor's model called <code>finish</code>. The highlighted line returns <code>Command(goto=END)</code> and writes the story into the state. The graph stops.`
          : `The supervisor's model called <code>${tool}</code>. The highlighted line returns a <code>Command</code>: <code>goto</code> names the next node, and <code>update</code> on the line below writes the task text into the state.` };
      }
      return { line: -1, node, keys, text: `The ${AGENT[seg.a]} node ran: ${plural(seg.n, "model call")} inside it. It returned <code>Command(goto="supervisor")</code>, and its last message went back to the supervisor as the answer to the handoff.` };
    });
    const opts = ["<code>reply = call_model(...)</code>, the model call", "<code>update={..., \"task\": args[\"task\"]}</code>", "<code>Command[Literal[...]]</code>, the type hint on the first line"];
    const RIGHT = 1;
    const fb = [
      ["The model call is where the supervisor's model decides, but the writer never sees that reply. The writer sees only what gets put into the state for it.", false],
      ["Right. <code>args[\"task\"]</code> is the text the supervisor's model wrote in its tool call, and this line puts it into the state, where the writer node reads it. That one line is the boundary where run B lost the condition. Run C added the notes to what the writer reads.", true],
      ["The type hint lists where the supervisor may route, so LangGraph can draw the edges. It says nothing about what the next agent reads.", false]
    ];
    const paint = () => {
      const s = steps[i];
      el.innerHTML = `<h1>The same desk in LangGraph</h1>
        <p class="lead">Run B was a LangGraph graph: a <code>StateGraph</code> with four nodes, one per agent. The graph starts at the supervisor. A node can return a <code>Command</code>, which does two things at once: <code>goto</code> picks the next node, and <code>update</code> changes the state. Below is the supervisor node.</p>
        <p class="lead">The steps replay what <code>graph.stream(..., stream_mode="updates")</code> really printed for run B. Each step is one node run and the state keys it changed.</p>
        <p class="task">Step through the run to the end, then answer the question.</p>
        <div class="lx-${ID}-wrap">${kit.code(CODE, s.line)}</div>
        <div class="lsteps"><button type="button" class="btn" data-prev ${i === 0 ? "disabled" : ""}>Step back</button><button type="button" class="btn" data-next ${i === steps.length - 1 ? "disabled" : ""}>Next step</button></div>
        <div class="vars"><span>update <b>${i + 1} / ${steps.length}</b></span><span>node <b>${s.node}</b></span><span>keys <b>${s.keys.join(", ")}</b></span></div>
        ${kit.feedback(s.text)}
        <div class="lpanel"><p>Which line decides what the writer gets to read?</p>${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelector("[data-prev]").onclick = () => { i--; paint(); };
      el.querySelector("[data-next]").onclick = () => { i++; paint(); check(); };
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); check(); });
    };
    const check = () => { if (i === steps.length - 1 && ans === RIGHT) done(); };
    paint();
  }

  /* 7. The big picture: what for, when, when not, what it costs. */
  function bigPicture({ el, done, kit }) {
    ensureStyle();
    let ans = null;
    const opts = [
      "A support bot answers order questions with three tools: find order, track parcel, start a return",
      "A research assistant must search contracts, company filings and patent records, each with its own set of a dozen tools and its own rules, and the three searches do not depend on each other",
      "Turn one meeting transcript into five bullet points"
    ];
    const RIGHT = 1;
    const fb = [
      ["Three tools is a small tool list. One agent can pick among them well, as run A did with two. Splitting would add handoffs, calls and lost details for nothing.", false],
      ["Right. One agent with three dozen tools and three sets of rules in one prompt would get crowded and pick wrong tools. Three specialists each see only their own tools and rules, can run side by side, and the supervisor only joins the results. Here the extra calls buy something.", true],
      ["There is nothing to research and nothing to hand over: one model call with the transcript does it. Even one agent loop would be too much.", false]
    ];
    const paint = () => {
      el.innerHTML = `<h1>When several agents pay off</h1>
        <p class="lead"><b>For:</b> work with parts that need very different instructions, tools or permissions. <b>Reach for it</b> when one agent has so many tools that it picks the wrong ones, or its prompt is too long to follow, or the parts can run side by side. <b>Not</b> for small tasks like the tram story: one agent with the tools did it with fewer calls. Try one agent with better tools first.</p>
        <p class="lead"><b>Costs:</b> every handoff adds model calls (slower, more expensive), the supervisor re-reads everything, each boundary can drop a fact, and there are more traces to debug.</p>
        <p class="task">Which of these jobs is worth a supervisor and specialists?</p>
        <div class="lpanel">${ask(kit, opts, RIGHT, ans, fb)}</div>`;
      el.querySelectorAll(".lopts button").forEach(b => b.onclick = () => { ans = +b.dataset.i; paint(); if (ans === RIGHT) done(); });
    };
    paint();
  }

  /* 8. Recognise it in new situations, including two where one agent is the better choice. */
  const CASES = [
    ["A code-migration assistant must update forty small services to a new logging library. Each service needs reading, changing and testing, and no service depends on another.", true,
      "Yes. The parts are independent, so specialists can work side by side, each with a clean context holding one service. The supervisor hands out services and collects results. The extra calls buy speed and focus.",
      "Forty independent parts are the case where splitting pays: each worker sees one service, not forty, and they can run at the same time. One agent would carry every service's code in one ever-growing conversation."],
    ["A clinic's assistant drafts a discharge letter from one patient's ward notes. A doctor reads every letter before it is sent.", false,
      "No. One writer and one source. A second agent would only retell the ward notes, and every retelling can drop a detail, as run B's task text did with the grant condition. The doctor is already the check.",
      "Splitting adds a handoff where a detail can be dropped, like the grant condition in run B, and the doctor already checks each letter. One model call with the ward notes is the right size."],
    ["A shop's chat assistant has grown to sixty tools across returns, billing, shipping and loyalty points. Its traces show it often calls a billing tool for a shipping question.", true,
      "Yes. Picking among too many tools is the problem a split solves. A supervisor routes the question, and each specialist sees only the dozen tools of its own area.",
      "The traces show the classic sign: too many tools, wrong picks. Give each area its own specialist with a short tool list, and let a supervisor route. Then compare tokens and accuracy with the old agent on the same questions."],
    ["A one-person newsletter: read three links and write a 200-word summary, within a few seconds, on a small budget.", false,
      "No. This is the tram story again: one agent with a fetch tool does it. Every handoff would add model calls, so seconds and money, plus a place where a fact can drop out.",
      `Same size as the tram story, where the four-agent desk used about ${RATIO_BA} times the tokens of one agent. Splitting adds calls (latency and cost) and handoffs that lose details. One agent with a tool fits.`]
  ];
  function recognise({ el, done, kit }) {
    ensureStyle();
    const ans = CASES.map(() => null);
    const paint = () => {
      el.innerHTML = `<h1>One agent or several?</h1>
        <p class="lead">${say(CASES.length).replace(/^./, c => c.toUpperCase())} jobs from other places. Several agents means: a supervisor hands parts of the work to specialists, each seeing only what it is handed.</p>
        <p class="task">Would you split each job across several agents? Pick again if you change your mind.</p>
        ${CASES.map(([q, y, yes, no], k) => `<div class="lcase" id="c${k}"><p>${q}</p>${kit.options(["Yes, split it", "No, one agent or one call"], { picked: ans[k], correct: y ? 0 : 1 })}${ans[k] == null ? "" : kit.feedback(ans[k] === (y ? 0 : 1) ? yes : no, ans[k] === (y ? 0 : 1))}</div>`).join("")}`;
      el.querySelectorAll(".lcase").forEach((c, k) => c.querySelectorAll("button").forEach(b => b.onclick = () => {
        ans[k] = +b.dataset.i; paint();
        if (CASES.every(([, y], j) => ans[j] === (y ? 0 : 1))) done();
      }));
    };
    paint();
  }

  /* 9. What next. */
  function whatNext({ el, done, kit, topic }) {
    const nx = topic && topic.next;
    el.innerHTML = `<h1>You can weigh a multi-agent design</h1>
      <p class="lead">You counted two real runs of the same story: one agent used ${fmt(TOT_A)} tokens, the supervisor desk ${fmt(TOT_B)}, mostly in the supervisor re-reading everything. You found the handoff where a condition vanished, fixed it by passing the notes in code, and saw the fix cost more again (${fmt(TOT_C)}). In LangGraph, the boundary is one line: what a node's <code>Command</code> writes into the state for the next agent.</p>
      <p class="lead">Before splitting, ask: does one agent fail here because of too many tools, too many rules, or work that could run side by side? If not, keep one agent.</p>
      ${nx ? `<p class="lead"><b>Next:</b> ${kit.esc(nx.title)}. You saw a handoff lose a fact; next you read traces where agents fail in other ways, such as loops and made-up arguments, and add the guard for each.</p>` : ""}`;
    done();
  }

  LessonKit.define(ID, {
    title: "Several agents: supervisor, handoffs and their cost",
    checked: "2026-11-13",
    sources: [
      "https://docs.langchain.com/oss/python/langchain/multi-agent",
      "https://docs.langchain.com/oss/python/langchain/multi-agent/subagents",
      "https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs",
      "https://docs.langchain.com/oss/python/langgraph/graph-api",
      "https://docs.langchain.com/oss/python/langgraph/streaming"
    ],
    interview: [
      {
        q: "Your team replaced a single agent with a planner, a researcher and a writer. Quality looks similar, but the bill went up several times and users report details missing from answers. What do you look at, and what might you change?",
        good: [
          "Read the traces call by call and see whose input tokens grow; a supervisor that re-reads the whole conversation is often most of the bill",
          "Read each handoff message and compare it with what the previous agent produced, to find where a detail was dropped",
          "Pass the facts the next agent needs in code, word for word or as structured fields, instead of a model's retelling",
          "Compare with the single agent on the same golden set: tokens, latency and accuracy, and go back to one agent if the split buys nothing"
        ],
        weak: "Add a reviewer agent or a bigger model. That adds another handoff and more calls without finding where the details are lost."
      },
      {
        q: "A product manager asks you to make the support assistant multi-agent because it sounds more capable. How do you decide?",
        good: [
          "Start from the failures of the current agent: wrong tool picks from a long tool list, a prompt too long to follow, parts that could run in parallel",
          "If none of those shows up in traces, keep one agent; a single agent with the right tools often does as well",
          "Every handoff adds model calls, latency and a place where context gets lost",
          "If you split, decide explicitly what each agent sees, and measure both designs on the same questions before switching"
        ],
        weak: "Agree, because specialists sound better, without checking what the current agent gets wrong or what the extra calls cost."
      }
    ],
    screens: [situation, whereTokens, lostFact, spotIdea, predictFix, asCode, bigPicture, recognise, whatNext],
    walk: [
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c0 [data-wrong]"], right: ["#c0 [data-right]", "#c1 [data-right]"] },
      { wrong: ["[data-wrong]"], right: [...Array(UPDATES.length - 1).fill("[data-next]"), "[data-right]"] },
      { wrong: ["[data-wrong]"], right: ["[data-right]"] },
      { wrong: ["#c1 [data-wrong]"], right: CASES.map((_, k) => `#c${k} [data-right]`) },
      { right: [] }
    ]
  });
})();
